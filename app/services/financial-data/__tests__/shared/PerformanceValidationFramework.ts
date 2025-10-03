/**
 * Performance and Memory Validation Framework for FMP Integration Tests
 * Provides comprehensive benchmarking, memory tracking, and rate limit compliance
 * Used across all FMP service integration tests for consistent validation
 */

import { performance } from "perf_hooks";

export interface PerformanceBenchmarks {
	maxExecutionTime: number; // milliseconds
	maxMemoryIncrease: number; // bytes
	maxApiCalls: number;
	minRateLimit: number; // milliseconds between calls
	cacheEfficiencyThreshold: number; // percentage
}

export interface MemorySnapshot {
	heapUsed: number;
	heapTotal: number;
	external: number;
	arrayBuffers: number;
	rss: number;
	timestamp: number;
}

export interface PerformanceMetrics {
	executionTime: number;
	memoryIncrease: number;
	apiCallCount: number;
	averageResponseTime: number;
	cacheHitRatio: number;
	rateLimitCompliance: boolean;
	memoryLeakDetected: boolean;
}

export interface RateLimitConfig {
	fmpStarterLimit: 300; // requests per minute
	fmpProfessionalLimit: 600; // requests per minute
	fmpEnterpriseLimit: 2000; // requests per minute
	utilizationTarget: 80; // percentage of limit to use
}

export class PerformanceValidationFramework {
	private initialMemory: MemorySnapshot | null = null;
	private startTime: number = 0;
	private apiCallTimestamps: number[] = [];
	private cacheHits: number = 0;
	private cacheMisses: number = 0;
	private benchmarks: PerformanceBenchmarks;
	private rateLimitConfig: RateLimitConfig;

	constructor(benchmarks: Partial<PerformanceBenchmarks> = {}) {
		this.benchmarks = {
			maxExecutionTime: 3000, // 3 seconds default
			maxMemoryIncrease: 100 * 1024 * 1024, // 100MB default
			maxApiCalls: 4, // FMP rate limit safe
			minRateLimit: 200, // 200ms between calls
			cacheEfficiencyThreshold: 50, // 50% cache hit ratio
			...benchmarks,
		};

		this.rateLimitConfig = {
			fmpStarterLimit: 300,
			fmpProfessionalLimit: 600,
			fmpEnterpriseLimit: 2000,
			utilizationTarget: 80,
		};
	}

	/**
	 * Start performance tracking
	 */
	startTracking(): void {
		this.initialMemory = this.captureMemorySnapshot();
		this.startTime = performance.now();
		this.apiCallTimestamps = [];
		this.cacheHits = 0;
		this.cacheMisses = 0;

		// Force garbage collection if available
		if (global.gc) {
			global.gc();
		}
	}

	/**
	 * Record API call for rate limit tracking
	 */
	recordApiCall(): void {
		this.apiCallTimestamps.push(performance.now());
	}

	/**
	 * Record cache hit
	 */
	recordCacheHit(): void {
		this.cacheHits++;
	}

	/**
	 * Record cache miss
	 */
	recordCacheMiss(): void {
		this.cacheMisses++;
	}

	/**
	 * Complete tracking and generate metrics
	 */
	completeTracking(): PerformanceMetrics {
		const endTime = performance.now();
		const finalMemory = this.captureMemorySnapshot();

		if (!this.initialMemory) {
			throw new Error("Performance tracking not started");
		}

		const executionTime = endTime - this.startTime;
		const memoryIncrease = finalMemory.heapUsed - this.initialMemory.heapUsed;
		const apiCallCount = this.apiCallTimestamps.length;

		// Calculate average response time
		let averageResponseTime = 0;
		if (apiCallCount > 1) {
			const totalApiTime =
				this.apiCallTimestamps[apiCallCount - 1] - this.apiCallTimestamps[0];
			averageResponseTime = totalApiTime / apiCallCount;
		}

		// Calculate cache hit ratio
		const totalCacheRequests = this.cacheHits + this.cacheMisses;
		const cacheHitRatio =
			totalCacheRequests > 0 ? (this.cacheHits / totalCacheRequests) * 100 : 0;

		// Check rate limit compliance
		const rateLimitCompliance = this.checkRateLimitCompliance();

		// Detect memory leaks
		const memoryLeakDetected = this.detectMemoryLeak(finalMemory);

		return {
			executionTime,
			memoryIncrease,
			apiCallCount,
			averageResponseTime,
			cacheHitRatio,
			rateLimitCompliance,
			memoryLeakDetected,
		};
	}

	/**
	 * Validate performance metrics against benchmarks
	 */
	validatePerformance(metrics: PerformanceMetrics): {
		passed: boolean;
		violations: string[];
		recommendations: string[];
	} {
		const violations: string[] = [];
		const recommendations: string[] = [];

		// Execution time validation
		if (metrics.executionTime > this.benchmarks.maxExecutionTime) {
			violations.push(
				`Execution time ${metrics.executionTime.toFixed(0)}ms exceeds limit ${this.benchmarks.maxExecutionTime}ms`
			);
			recommendations.push(
				"Consider optimizing API calls, implementing better caching, or reducing data processing"
			);
		}

		// Memory increase validation
		if (metrics.memoryIncrease > this.benchmarks.maxMemoryIncrease) {
			const memoryMB = (metrics.memoryIncrease / 1024 / 1024).toFixed(2);
			const limitMB = (this.benchmarks.maxMemoryIncrease / 1024 / 1024).toFixed(2);
			violations.push(`Memory increase ${memoryMB}MB exceeds limit ${limitMB}MB`);
			recommendations.push(
				"Review memory usage patterns, implement data streaming, or reduce concurrent operations"
			);
		}

		// API call count validation
		if (metrics.apiCallCount > this.benchmarks.maxApiCalls) {
			violations.push(
				`API call count ${metrics.apiCallCount} exceeds limit ${this.benchmarks.maxApiCalls}`
			);
			recommendations.push(
				"Implement better caching, batch requests, or reduce API dependencies"
			);
		}

		// Rate limit compliance validation
		if (!metrics.rateLimitCompliance) {
			violations.push("Rate limit compliance failed - calls too frequent");
			recommendations.push(
				"Increase delays between API calls, implement exponential backoff"
			);
		}

		// Cache efficiency validation
		if (metrics.cacheHitRatio < this.benchmarks.cacheEfficiencyThreshold) {
			violations.push(
				`Cache hit ratio ${metrics.cacheHitRatio.toFixed(1)}% below threshold ${this.benchmarks.cacheEfficiencyThreshold}%`
			);
			recommendations.push(
				"Improve caching strategy, increase cache TTL, or optimize cache keys"
			);
		}

		// Memory leak validation
		if (metrics.memoryLeakDetected) {
			violations.push("Potential memory leak detected");
			recommendations.push(
				"Review object lifecycle, implement proper cleanup, check for circular references"
			);
		}

		return {
			passed: violations.length === 0,
			violations,
			recommendations,
		};
	}

	/**
	 * Generate performance report
	 */
	generateReport(metrics: PerformanceMetrics, testName: string): string {
		const validation = this.validatePerformance(metrics);

		let report = `\n=== Performance Report: ${testName} ===\n`;
		report += `Execution Time: ${metrics.executionTime.toFixed(0)}ms (limit: ${this.benchmarks.maxExecutionTime}ms)\n`;
		report += `Memory Increase: ${(metrics.memoryIncrease / 1024 / 1024).toFixed(2)}MB (limit: ${(this.benchmarks.maxMemoryIncrease / 1024 / 1024).toFixed(2)}MB)\n`;
		report += `API Calls: ${metrics.apiCallCount} (limit: ${this.benchmarks.maxApiCalls})\n`;
		report += `Cache Hit Ratio: ${metrics.cacheHitRatio.toFixed(1)}% (threshold: ${this.benchmarks.cacheEfficiencyThreshold}%)\n`;
		report += `Rate Limit Compliance: ${metrics.rateLimitCompliance ? "PASS" : "FAIL"}\n`;
		report += `Memory Leak Detection: ${metrics.memoryLeakDetected ? "DETECTED" : "CLEAN"}\n`;

		if (validation.violations.length > 0) {
			report += `\n❌ VIOLATIONS (${validation.violations.length}):\n`;
			validation.violations.forEach((violation, index) => {
				report += `${index + 1}. ${violation}\n`;
			});
		}

		if (validation.recommendations.length > 0) {
			report += `\n💡 RECOMMENDATIONS:\n`;
			validation.recommendations.forEach((rec, index) => {
				report += `${index + 1}. ${rec}\n`;
			});
		}

		report += `\n✓ Overall Status: ${validation.passed ? "PASSED" : "FAILED"}\n`;
		report += "==========================================\n";

		return report;
	}

	/**
	 * Calculate optimal rate limit for FMP plan
	 */
	calculateOptimalRateLimit(planType: "starter" | "professional" | "enterprise" = "starter"): {
		maxRequestsPerMinute: number;
		recommendedDelayMs: number;
		burstCapacity: number;
	} {
		const limits = {
			starter: this.rateLimitConfig.fmpStarterLimit,
			professional: this.rateLimitConfig.fmpProfessionalLimit,
			enterprise: this.rateLimitConfig.fmpEnterpriseLimit,
		};

		const maxRequestsPerMinute = limits[planType];
		const utilizationLimit = Math.floor(
			maxRequestsPerMinute * (this.rateLimitConfig.utilizationTarget / 100)
		);
		const recommendedDelayMs = Math.ceil(60000 / utilizationLimit); // Milliseconds per request
		const burstCapacity = Math.floor(utilizationLimit / 4); // 25% of utilization limit

		return {
			maxRequestsPerMinute: utilizationLimit,
			recommendedDelayMs,
			burstCapacity,
		};
	}

	/**
	 * Create memory-optimized test configuration
	 */
	createMemoryOptimizedConfig(): {
		maxWorkers: number;
		maxMemory: string;
		gcOptions: string[];
		jestOptions: object;
	} {
		return {
			maxWorkers: 1, // Single worker to prevent memory contention
			maxMemory: "4096MB", // 4GB heap limit
			gcOptions: [
				"--expose-gc",
				"--max-old-space-size=4096",
				"--initial-old-space-size=2048",
				"--max-semi-space-size=128",
			],
			jestOptions: {
				runInBand: true,
				detectOpenHandles: false, // Disabled for memory optimization
				detectLeaks: false, // Custom memory leak detection
				forceExit: true,
				testTimeout: 300000, // 5 minutes
				maxConcurrency: 1,
			},
		};
	}

	/**
	 * Capture current memory snapshot
	 */
	private captureMemorySnapshot(): MemorySnapshot {
		const memUsage = process.memoryUsage();
		return {
			heapUsed: memUsage.heapUsed,
			heapTotal: memUsage.heapTotal,
			external: memUsage.external,
			arrayBuffers: memUsage.arrayBuffers,
			rss: memUsage.rss,
			timestamp: performance.now(),
		};
	}

	/**
	 * Check rate limit compliance
	 */
	private checkRateLimitCompliance(): boolean {
		if (this.apiCallTimestamps.length <= 1) return true;

		for (let i = 1; i < this.apiCallTimestamps.length; i++) {
			const delay = this.apiCallTimestamps[i] - this.apiCallTimestamps[i - 1];
			if (delay < this.benchmarks.minRateLimit) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Detect potential memory leaks
	 */
	private detectMemoryLeak(finalMemory: MemorySnapshot): boolean {
		if (!this.initialMemory) return false;

		// Check for excessive heap growth
		const heapGrowthRatio = finalMemory.heapUsed / this.initialMemory.heapUsed;
		if (heapGrowthRatio > 3.0) return true; // More than 3x growth indicates potential leak

		// Check for RSS vs heap discrepancy
		const rssToHeapRatio = finalMemory.rss / finalMemory.heapUsed;
		if (rssToHeapRatio > 3.0) return true; // Large discrepancy indicates fragmentation/leaks

		// Check for excessive external memory
		const externalGrowth = finalMemory.external - this.initialMemory.external;
		if (externalGrowth > 100 * 1024 * 1024) return true; // More than 100MB external growth

		return false;
	}
}

/**
 * Helper function to create standard benchmarks for FMP services
 */
export function createFMPServiceBenchmarks(serviceType: string): PerformanceBenchmarks {
	const baseBenchmarks = {
		maxExecutionTime: 3000, // 3 seconds
		maxMemoryIncrease: 80 * 1024 * 1024, // 80MB
		maxApiCalls: 4,
		minRateLimit: 200,
		cacheEfficiencyThreshold: 50,
	};

	// Service-specific adjustments
	const adjustments = {
		CongressionalTradingService: {
			maxExecutionTime: 2500,
			maxMemoryIncrease: 60 * 1024 * 1024,
		},
		EarningsTranscriptService: {
			maxExecutionTime: 4000, // NLP processing takes longer
			maxMemoryIncrease: 120 * 1024 * 1024, // Larger text processing
			maxApiCalls: 2, // Fewer calls due to large payloads
		},
		InstitutionalPerformanceService: {
			maxExecutionTime: 3500,
			maxMemoryIncrease: 100 * 1024 * 1024,
		},
		RevenueSegmentationService: {
			maxExecutionTime: 3000,
			maxMemoryIncrease: 70 * 1024 * 1024,
		},
		EnhancedSentimentAnalysisService: {
			maxExecutionTime: 4500, // Multi-source analysis
			maxMemoryIncrease: 150 * 1024 * 1024,
			cacheEfficiencyThreshold: 60, // Higher cache usage
		},
		SectorRotationService: {
			maxExecutionTime: 3500,
			maxMemoryIncrease: 90 * 1024 * 1024,
		},
		OwnerEarningsService: {
			maxExecutionTime: 3000,
			maxMemoryIncrease: 80 * 1024 * 1024,
		},
	};

	return {
		...baseBenchmarks,
		...(adjustments[serviceType as keyof typeof adjustments] || {}),
	};
}

/**
 * Helper function to setup performance tracking in tests
 */
export function setupPerformanceTracking(
	serviceName: string,
	customBenchmarks?: Partial<PerformanceBenchmarks>
): {
	framework: PerformanceValidationFramework;
	startTracking: () => void;
	completeTracking: () => PerformanceMetrics;
	validateAndReport: (testName: string) => void;
} {
	const benchmarks = createFMPServiceBenchmarks(serviceName);
	const framework = new PerformanceValidationFramework({
		...benchmarks,
		...customBenchmarks,
	});

	return {
		framework,
		startTracking: () => framework.startTracking(),
		completeTracking: () => framework.completeTracking(),
		validateAndReport: (testName: string) => {
			const metrics = framework.completeTracking();
			const validation = framework.validatePerformance(metrics);
			const report = framework.generateReport(metrics, testName);

			console.log(report);

			// Jest assertions
			if (!validation.passed) {
				const errorMessage = `Performance validation failed for ${testName}:\n${validation.violations.join("\n")}`;
				throw new Error(errorMessage);
			}
		},
	};
}

/**
 * Utility for memory pressure testing
 */
export class MemoryPressureTester {
	private snapshots: MemorySnapshot[] = [];

	captureSnapshot(label: string): void {
		const snapshot = {
			...this.captureMemorySnapshot(),
			label,
		} as MemorySnapshot & { label: string };
		this.snapshots.push(snapshot);
	}

	analyzeMemoryPattern(): {
		peakMemory: number;
		memoryGrowthRate: number;
		leakSuspected: boolean;
		recommendations: string[];
	} {
		if (this.snapshots.length < 2) {
			throw new Error("Need at least 2 snapshots for analysis");
		}

		const heapUsages = this.snapshots.map(s => s.heapUsed);
		const peakMemory = Math.max(...heapUsages);
		const initialMemory = heapUsages[0];
		const finalMemory = heapUsages[heapUsages.length - 1];

		const memoryGrowthRate = ((finalMemory - initialMemory) / initialMemory) * 100;

		// Simple leak detection based on consistent growth
		let leakSuspected = false;
		if (heapUsages.length >= 3) {
			const growthPoints = [];
			for (let i = 1; i < heapUsages.length; i++) {
				if (heapUsages[i] > heapUsages[i - 1]) {
					growthPoints.push(i);
				}
			}
			leakSuspected = growthPoints.length > heapUsages.length * 0.7; // More than 70% growing
		}

		const recommendations: string[] = [];
		if (memoryGrowthRate > 50) {
			recommendations.push(
				"High memory growth detected - review object lifecycle management"
			);
		}
		if (peakMemory > 200 * 1024 * 1024) {
			recommendations.push("Peak memory usage high - consider data streaming or pagination");
		}
		if (leakSuspected) {
			recommendations.push(
				"Memory leak suspected - implement proper cleanup and check for circular references"
			);
		}

		return {
			peakMemory,
			memoryGrowthRate,
			leakSuspected,
			recommendations,
		};
	}

	private captureMemorySnapshot(): MemorySnapshot {
		const memUsage = process.memoryUsage();
		return {
			heapUsed: memUsage.heapUsed,
			heapTotal: memUsage.heapTotal,
			external: memUsage.external,
			arrayBuffers: memUsage.arrayBuffers,
			rss: memUsage.rss,
			timestamp: performance.now(),
		};
	}
}
