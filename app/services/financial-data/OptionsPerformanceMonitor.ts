/**
 * Options Performance Monitor
 * Tracks and optimizes options data integration performance for VFR's <3 second target
 */

import { RedisCache } from "../cache/RedisCache";
import ErrorHandler from "../error-handling/ErrorHandler";

interface OptionsPerformanceMetrics {
	requestId: string;
	symbol: string;
	operation: "analysis" | "chain" | "put_call_ratio" | "batch";
	startTime: number;
	endTime: number;
	latency: number;
	cacheHit: boolean;
	source: string;
	contractsProcessed: number;
	memoryUsage: number;
	compressionRatio: number;
	errors: string[];
}

interface PerformanceReport {
	totalRequests: number;
	averageLatency: number;
	latencyTarget: number;
	cacheHitRate: number;
	memoryEfficiency: number;
	errorRate: number;
	performanceGrade: "A" | "B" | "C" | "D" | "F";
	recommendations: string[];
	breakdown: {
		analysis: PerformanceMetrics;
		chain: PerformanceMetrics;
		putCallRatio: PerformanceMetrics;
		batch: PerformanceMetrics;
	};
}

interface PerformanceMetrics {
	count: number;
	averageLatency: number;
	cacheHitRate: number;
	errorRate: number;
}

export class OptionsPerformanceMonitor {
	private cache: RedisCache;
	private metrics: OptionsPerformanceMetrics[] = [];
	private readonly MAX_METRICS_HISTORY = 1000;
	private readonly LATENCY_TARGET = 500; // 500ms for options operations
	private readonly MEMORY_EFFICIENCY_TARGET = 0.7; // 70% memory reduction target

	constructor(cache: RedisCache) {
		this.cache = cache;
	}

	/**
	 * Start tracking an options operation
	 */
	startTracking(symbol: string, operation: OptionsPerformanceMetrics["operation"]): string {
		const requestId = `options_${operation}_${symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Store in cache for distributed tracking
		this.cache.set(
			`perf_tracking:${requestId}`,
			{
				requestId,
				symbol,
				operation,
				startTime: Date.now(),
				cacheHit: false,
				source: "",
				contractsProcessed: 0,
				memoryUsage: process.memoryUsage().heapUsed,
				compressionRatio: 0,
				errors: [],
			},
			60 // 1 minute TTL for tracking data
		);

		return requestId;
	}

	/**
	 * Record cache hit for performance tracking
	 */
	async recordCacheHit(requestId: string, source: string): Promise<void> {
		try {
			const tracking = await this.cache.get(`perf_tracking:${requestId}`);
			if (tracking) {
				tracking.cacheHit = true;
				tracking.source = source;
				await this.cache.set(`perf_tracking:${requestId}`, tracking, 60);
			}
		} catch (error) {
			// Silent fail for tracking
		}
	}

	/**
	 * Record processing metrics during operation
	 */
	async recordProcessingMetrics(
		requestId: string,
		contractsProcessed: number,
		compressionRatio: number
	): Promise<void> {
		try {
			const tracking = await this.cache.get(`perf_tracking:${requestId}`);
			if (tracking) {
				tracking.contractsProcessed = contractsProcessed;
				tracking.compressionRatio = compressionRatio;
				await this.cache.set(`perf_tracking:${requestId}`, tracking, 60);
			}
		} catch (error) {
			// Silent fail for tracking
		}
	}

	/**
	 * Record error during operation
	 */
	async recordError(requestId: string, error: string): Promise<void> {
		try {
			const tracking = await this.cache.get(`perf_tracking:${requestId}`);
			if (tracking) {
				tracking.errors.push(error);
				await this.cache.set(`perf_tracking:${requestId}`, tracking, 60);
			}
		} catch (error) {
			// Silent fail for tracking
		}
	}

	/**
	 * Finish tracking and record final metrics
	 */
	async finishTracking(
		requestId: string,
		source?: string
	): Promise<OptionsPerformanceMetrics | null> {
		try {
			const tracking = await this.cache.get(`perf_tracking:${requestId}`);
			if (!tracking) return null;

			const endTime = Date.now();
			const latency = endTime - tracking.startTime;
			const currentMemory = process.memoryUsage().heapUsed;
			const memoryUsage = currentMemory - tracking.memoryUsage;

			const finalMetrics: OptionsPerformanceMetrics = {
				...tracking,
				endTime,
				latency,
				memoryUsage,
				source: source || tracking.source,
			};

			// Store in local metrics history
			this.addToHistory(finalMetrics);

			// Cache performance data for reporting
			await this.cachePerformanceData(finalMetrics);

			// Cleanup tracking data
			await this.cache.delete(`perf_tracking:${requestId}`);

			// Log performance if it exceeds target
			if (latency > this.LATENCY_TARGET) {
				console.warn(
					`⚠️ Options ${tracking.operation} for ${tracking.symbol} exceeded target: ${latency}ms > ${this.LATENCY_TARGET}ms`
				);
			}

			return finalMetrics;
		} catch (error) {
			console.error("OptionsPerformanceMonitor.finishTracking error:", error, { requestId });
			return null;
		}
	}

	/**
	 * Add metrics to local history with cleanup
	 */
	private addToHistory(metrics: OptionsPerformanceMetrics): void {
		this.metrics.push(metrics);

		// Keep only recent metrics to prevent memory bloat
		if (this.metrics.length > this.MAX_METRICS_HISTORY) {
			this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY);
		}
	}

	/**
	 * Cache performance data for distributed reporting
	 */
	private async cachePerformanceData(metrics: OptionsPerformanceMetrics): Promise<void> {
		try {
			const cacheKey = `options_perf_metrics:${metrics.operation}:${Date.now()}`;
			await this.cache.set(cacheKey, metrics, 3600); // 1 hour TTL
		} catch (error) {
			// Silent fail for caching
		}
	}

	/**
	 * Generate comprehensive performance report
	 */
	async generateReport(): Promise<PerformanceReport> {
		// Combine local metrics with cached metrics
		const allMetrics = await this.getAllMetrics();

		if (allMetrics.length === 0) {
			return this.getEmptyReport();
		}

		const totalRequests = allMetrics.length;
		const totalLatency = allMetrics.reduce((sum, m) => sum + m.latency, 0);
		const averageLatency = totalLatency / totalRequests;

		const cacheHits = allMetrics.filter(m => m.cacheHit).length;
		const cacheHitRate = (cacheHits / totalRequests) * 100;

		const errorsCount = allMetrics.filter(m => m.errors.length > 0).length;
		const errorRate = (errorsCount / totalRequests) * 100;

		const totalMemoryReduction = allMetrics.reduce((sum, m) => sum + m.compressionRatio, 0);
		const memoryEfficiency = (totalMemoryReduction / totalRequests) * 100;

		const performanceGrade = this.calculatePerformanceGrade(
			averageLatency,
			cacheHitRate,
			errorRate,
			memoryEfficiency
		);

		const recommendations = this.generateRecommendations(
			averageLatency,
			cacheHitRate,
			errorRate,
			memoryEfficiency
		);

		return {
			totalRequests,
			averageLatency: Math.round(averageLatency),
			latencyTarget: this.LATENCY_TARGET,
			cacheHitRate: Math.round(cacheHitRate * 10) / 10,
			memoryEfficiency: Math.round(memoryEfficiency * 10) / 10,
			errorRate: Math.round(errorRate * 10) / 10,
			performanceGrade,
			recommendations,
			breakdown: {
				analysis: this.calculateBreakdown(allMetrics, "analysis"),
				chain: this.calculateBreakdown(allMetrics, "chain"),
				putCallRatio: this.calculateBreakdown(allMetrics, "put_call_ratio"),
				batch: this.calculateBreakdown(allMetrics, "batch"),
			},
		};
	}

	/**
	 * Get all metrics from both local storage and cache
	 */
	private async getAllMetrics(): Promise<OptionsPerformanceMetrics[]> {
		try {
			// Get cached metrics - simplified approach using known key patterns
			const cachedMetrics: OptionsPerformanceMetrics[] = [];
			// Note: Redis keys pattern matching would require exposing the keys method
			// For now, we'll rely on local metrics only

			// Combine with local metrics (dedup by requestId)
			const allMetrics = [...this.metrics];
			const existingIds = new Set(allMetrics.map(m => m.requestId));

			for (const cached of cachedMetrics) {
				if (!existingIds.has(cached.requestId)) {
					allMetrics.push(cached);
				}
			}

			return allMetrics.sort((a, b) => b.startTime - a.startTime);
		} catch (error) {
			return this.metrics;
		}
	}

	/**
	 * Get pattern keys from cache (if Redis supports it)
	 */
	private async getPatternKeys(pattern: string): Promise<string[]> {
		try {
			// This would require Redis KEYS command - implement if available
			return [];
		} catch (error) {
			return [];
		}
	}

	/**
	 * Calculate performance breakdown by operation type
	 */
	private calculateBreakdown(
		metrics: OptionsPerformanceMetrics[],
		operation: OptionsPerformanceMetrics["operation"]
	): PerformanceMetrics {
		const operationMetrics = metrics.filter(m => m.operation === operation);

		if (operationMetrics.length === 0) {
			return { count: 0, averageLatency: 0, cacheHitRate: 0, errorRate: 0 };
		}

		const totalLatency = operationMetrics.reduce((sum, m) => sum + m.latency, 0);
		const averageLatency = totalLatency / operationMetrics.length;

		const cacheHits = operationMetrics.filter(m => m.cacheHit).length;
		const cacheHitRate = (cacheHits / operationMetrics.length) * 100;

		const errors = operationMetrics.filter(m => m.errors.length > 0).length;
		const errorRate = (errors / operationMetrics.length) * 100;

		return {
			count: operationMetrics.length,
			averageLatency: Math.round(averageLatency),
			cacheHitRate: Math.round(cacheHitRate * 10) / 10,
			errorRate: Math.round(errorRate * 10) / 10,
		};
	}

	/**
	 * Calculate overall performance grade
	 */
	private calculatePerformanceGrade(
		averageLatency: number,
		cacheHitRate: number,
		errorRate: number,
		memoryEfficiency: number
	): "A" | "B" | "C" | "D" | "F" {
		let score = 0;

		// Latency score (40% weight)
		if (averageLatency <= this.LATENCY_TARGET * 0.5) score += 40;
		else if (averageLatency <= this.LATENCY_TARGET) score += 30;
		else if (averageLatency <= this.LATENCY_TARGET * 1.5) score += 20;
		else if (averageLatency <= this.LATENCY_TARGET * 2) score += 10;

		// Cache hit rate score (30% weight)
		if (cacheHitRate >= 80) score += 30;
		else if (cacheHitRate >= 60) score += 25;
		else if (cacheHitRate >= 40) score += 20;
		else if (cacheHitRate >= 20) score += 10;

		// Error rate score (20% weight) - lower is better
		if (errorRate <= 1) score += 20;
		else if (errorRate <= 5) score += 15;
		else if (errorRate <= 10) score += 10;
		else if (errorRate <= 20) score += 5;

		// Memory efficiency score (10% weight)
		if (memoryEfficiency >= this.MEMORY_EFFICIENCY_TARGET * 100) score += 10;
		else if (memoryEfficiency >= this.MEMORY_EFFICIENCY_TARGET * 80) score += 8;
		else if (memoryEfficiency >= this.MEMORY_EFFICIENCY_TARGET * 60) score += 6;
		else if (memoryEfficiency >= this.MEMORY_EFFICIENCY_TARGET * 40) score += 4;

		if (score >= 90) return "A";
		if (score >= 80) return "B";
		if (score >= 70) return "C";
		if (score >= 60) return "D";
		return "F";
	}

	/**
	 * Generate performance recommendations
	 */
	private generateRecommendations(
		averageLatency: number,
		cacheHitRate: number,
		errorRate: number,
		memoryEfficiency: number
	): string[] {
		const recommendations: string[] = [];

		if (averageLatency > this.LATENCY_TARGET) {
			recommendations.push(
				`Latency (${Math.round(averageLatency)}ms) exceeds target (${this.LATENCY_TARGET}ms). Consider optimizing API calls or increasing cache TTL.`
			);
		}

		if (cacheHitRate < 60) {
			recommendations.push(
				`Cache hit rate (${cacheHitRate.toFixed(1)}%) is low. Review caching strategy and TTL settings.`
			);
		}

		if (errorRate > 5) {
			recommendations.push(
				`Error rate (${errorRate.toFixed(1)}%) is high. Check API connectivity and fallback mechanisms.`
			);
		}

		if (memoryEfficiency < this.MEMORY_EFFICIENCY_TARGET * 100) {
			recommendations.push(
				`Memory efficiency (${memoryEfficiency.toFixed(1)}%) could be improved. Review field extraction and compression strategies.`
			);
		}

		if (recommendations.length === 0) {
			recommendations.push(
				"Performance is within acceptable parameters. Continue monitoring."
			);
		}

		return recommendations;
	}

	/**
	 * Get empty report structure
	 */
	private getEmptyReport(): PerformanceReport {
		return {
			totalRequests: 0,
			averageLatency: 0,
			latencyTarget: this.LATENCY_TARGET,
			cacheHitRate: 0,
			memoryEfficiency: 0,
			errorRate: 0,
			performanceGrade: "F",
			recommendations: [
				"No performance data available. Start using options services to generate metrics.",
			],
			breakdown: {
				analysis: { count: 0, averageLatency: 0, cacheHitRate: 0, errorRate: 0 },
				chain: { count: 0, averageLatency: 0, cacheHitRate: 0, errorRate: 0 },
				putCallRatio: { count: 0, averageLatency: 0, cacheHitRate: 0, errorRate: 0 },
				batch: { count: 0, averageLatency: 0, cacheHitRate: 0, errorRate: 0 },
			},
		};
	}

	/**
	 * Clear performance history (for testing/reset)
	 */
	clearHistory(): void {
		this.metrics = [];
	}

	/**
	 * Get real-time performance metrics
	 */
	getRealTimeMetrics(): any {
		const recentMetrics = this.metrics.slice(-10); // Last 10 operations

		if (recentMetrics.length === 0) {
			return {
				activeOperations: 0,
				recentAverageLatency: 0,
				recentCacheHitRate: 0,
				trend: "stable",
			};
		}

		const recentLatency =
			recentMetrics.reduce((sum, m) => sum + m.latency, 0) / recentMetrics.length;
		const recentCacheHits = recentMetrics.filter(m => m.cacheHit).length;
		const recentCacheHitRate = (recentCacheHits / recentMetrics.length) * 100;

		// Simple trend calculation
		const firstHalf = recentMetrics.slice(0, Math.floor(recentMetrics.length / 2));
		const secondHalf = recentMetrics.slice(Math.floor(recentMetrics.length / 2));

		const firstHalfLatency =
			firstHalf.reduce((sum, m) => sum + m.latency, 0) / firstHalf.length;
		const secondHalfLatency =
			secondHalf.reduce((sum, m) => sum + m.latency, 0) / secondHalf.length;

		let trend = "stable";
		if (secondHalfLatency > firstHalfLatency * 1.1) trend = "degrading";
		else if (secondHalfLatency < firstHalfLatency * 0.9) trend = "improving";

		return {
			activeOperations: 0, // Would track from cache if needed
			recentAverageLatency: Math.round(recentLatency),
			recentCacheHitRate: Math.round(recentCacheHitRate * 10) / 10,
			trend,
		};
	}
}
