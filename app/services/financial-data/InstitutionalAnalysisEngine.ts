/**
 * Institutional Analysis Engine
 * High-performance parallel processing for multiple stock institutional analysis
 * Integrates with existing Promise.allSettled pattern for <3 second response target
 */

import { InstitutionalDataService } from "./InstitutionalDataService";
import { InstitutionalCacheManager } from "./InstitutionalCacheManager";
import { Form13FParser } from "./Form13FParser";
import { Form4Parser } from "./Form4Parser";
import {
	InstitutionalHolding,
	InsiderTransaction,
	InstitutionalIntelligence,
	InstitutionalSentiment,
	InsiderSentiment,
} from "./types";
import { createServiceErrorHandler } from "../error-handling";
import SecurityValidator from "../security/SecurityValidator";

interface AnalysisRequest {
	symbols: string[];
	includeHoldings: boolean;
	includeInsiderActivity: boolean;
	includeIntelligence: boolean;
	maxAge?: number; // Maximum age in seconds for cached data
}

interface BatchAnalysisResult {
	symbol: string;
	institutionalHoldings?: InstitutionalHolding[];
	insiderTransactions?: InsiderTransaction[];
	institutionalIntelligence?: InstitutionalIntelligence;
	success: boolean;
	error?: string;
	processingTime: number;
	dataSource: "cache" | "api" | "hybrid";
}

interface PerformanceMetrics {
	totalRequests: number;
	averageResponseTime: number;
	cacheHitRate: number;
	errorRate: number;
	parallelEfficiency: number; // Speedup factor from parallel processing
	memoryUsage: number;
	apiCallsAvoided: number;
}

export class InstitutionalAnalysisEngine {
	private readonly institutionalService: InstitutionalDataService;
	private readonly cacheManager: InstitutionalCacheManager;
	private readonly form13FParser: Form13FParser;
	private readonly form4Parser: Form4Parser;
	private readonly errorHandler = createServiceErrorHandler("InstitutionalAnalysisEngine");

	// Performance optimization settings
	private readonly maxConcurrentAnalysis = 5; // Optimize for SEC rate limits
	private readonly batchSize = 10; // Process symbols in batches
	private readonly responseTimeTarget = 3000; // 3 second target
	private readonly memoryThresholdMB = 500; // Memory limit for analysis operations

	// Performance tracking
	private metrics: PerformanceMetrics = {
		totalRequests: 0,
		averageResponseTime: 0,
		cacheHitRate: 0,
		errorRate: 0,
		parallelEfficiency: 1.0,
		memoryUsage: 0,
		apiCallsAvoided: 0,
	};

	constructor() {
		this.institutionalService = new InstitutionalDataService();
		this.cacheManager = new InstitutionalCacheManager();
		this.form13FParser = new Form13FParser();
		this.form4Parser = new Form4Parser();
	}

	/**
	 * Analyze institutional data for multiple symbols with parallel optimization
	 * Follows existing Promise.allSettled pattern for compatibility
	 */
	async analyzeBatch(request: AnalysisRequest): Promise<BatchAnalysisResult[]> {
		const startTime = Date.now();

		try {
			// Validate request
			const validation = this.validateAnalysisRequest(request);
			if (!validation.isValid) {
				throw new Error(`Invalid analysis request: ${validation.errors.join(", ")}`);
			}

			const sanitizedSymbols = validation.sanitizedSymbols!;

			this.errorHandler.logger.info(`Starting batch institutional analysis`, {
				symbolCount: sanitizedSymbols.length,
				includeHoldings: request.includeHoldings,
				includeInsiderActivity: request.includeInsiderActivity,
				includeIntelligence: request.includeIntelligence,
			});

			// Process symbols in optimized batches using Promise.allSettled pattern
			const results = await this.executeParallelAnalysis(sanitizedSymbols, request);

			// Update performance metrics
			const processingTime = Date.now() - startTime;
			this.updateMetrics(results, processingTime);

			this.errorHandler.logger.info(`Batch institutional analysis completed`, {
				symbolCount: sanitizedSymbols.length,
				successCount: results.filter(r => r.success).length,
				processingTime,
				averageSymbolTime: Math.round(processingTime / sanitizedSymbols.length),
			});

			return results;
		} catch (error) {
			this.errorHandler.logger.error("Batch institutional analysis failed", {
				error,
				symbolCount: request.symbols.length,
				processingTime: Date.now() - startTime,
			});

			// Return error results for all symbols
			return request.symbols.map(symbol => ({
				symbol: symbol.toUpperCase(),
				success: false,
				error: error instanceof Error ? error.message : "Analysis failed",
				processingTime: Date.now() - startTime,
				dataSource: "api" as const,
			}));
		}
	}

	/**
	 * Get institutional intelligence for a single symbol with performance optimization
	 */
	async analyzeSymbol(
		symbol: string,
		options: {
			includeHoldings?: boolean;
			includeInsiderActivity?: boolean;
			useCache?: boolean;
			maxAge?: number;
		} = {}
	): Promise<BatchAnalysisResult> {
		const startTime = Date.now();
		const sanitizedSymbol = symbol.toUpperCase();

		try {
			const {
				includeHoldings = true,
				includeInsiderActivity = true,
				useCache = true,
				maxAge = 3600,
			} = options;

			this.errorHandler.logger.debug(`Analyzing single symbol: ${sanitizedSymbol}`);

			// Try cache first if enabled
			let cacheHit = false;
			let intelligence: InstitutionalIntelligence | null = null;

			if (useCache) {
				intelligence =
					await this.cacheManager.getInstitutionalIntelligence(sanitizedSymbol);
				if (intelligence && this.isCacheDataFresh(intelligence, maxAge)) {
					cacheHit = true;
					this.metrics.apiCallsAvoided++;
				}
			}

			// Fetch fresh data if no cache hit
			if (!intelligence) {
				intelligence =
					await this.institutionalService.getInstitutionalIntelligence(sanitizedSymbol);

				// Cache the result
				if (intelligence && useCache) {
					await this.cacheManager.cacheInstitutionalIntelligence(
						sanitizedSymbol,
						intelligence
					);
				}
			}

			// Fetch additional data if requested
			const additionalData: Partial<BatchAnalysisResult> = {};

			if (includeHoldings || includeInsiderActivity) {
				const [holdingsResult, insiderResult] = await Promise.allSettled([
					includeHoldings
						? this.getHoldingsWithCache(sanitizedSymbol, useCache, maxAge)
						: Promise.resolve(undefined),
					includeInsiderActivity
						? this.getInsiderActivityWithCache(sanitizedSymbol, useCache, maxAge)
						: Promise.resolve(undefined),
				]);

				if (holdingsResult.status === "fulfilled" && holdingsResult.value) {
					additionalData.institutionalHoldings = holdingsResult.value;
				}

				if (insiderResult.status === "fulfilled" && insiderResult.value) {
					additionalData.insiderTransactions = insiderResult.value;
				}
			}

			const processingTime = Date.now() - startTime;

			return {
				symbol: sanitizedSymbol,
				institutionalIntelligence: intelligence || undefined,
				...additionalData,
				success: !!intelligence,
				processingTime,
				dataSource: cacheHit ? "cache" : "api",
			};
		} catch (error) {
			const processingTime = Date.now() - startTime;

			this.errorHandler.logger.warn(`Symbol analysis failed: ${sanitizedSymbol}`, {
				error,
				processingTime,
				symbol: sanitizedSymbol,
			});

			return {
				symbol: sanitizedSymbol,
				success: false,
				error: error instanceof Error ? error.message : "Analysis failed",
				processingTime,
				dataSource: "api",
			};
		}
	}

	/**
	 * Execute parallel analysis using Promise.allSettled pattern for optimal performance
	 */
	private async executeParallelAnalysis(
		symbols: string[],
		request: AnalysisRequest
	): Promise<BatchAnalysisResult[]> {
		const allResults: BatchAnalysisResult[] = [];

		// Process symbols in batches to control memory usage and API rate limits
		for (let i = 0; i < symbols.length; i += this.batchSize) {
			const batch = symbols.slice(i, i + this.batchSize);

			this.errorHandler.logger.debug(
				`Processing batch ${Math.floor(i / this.batchSize) + 1}`,
				{
					batchSize: batch.length,
					totalBatches: Math.ceil(symbols.length / this.batchSize),
					symbols: batch.join(", "),
				}
			);

			// Use Promise.allSettled for fault tolerance - follows existing pattern
			const batchPromises = batch.map(symbol =>
				this.createSemaphore(this.maxConcurrentAnalysis)(async () => {
					return this.analyzeSymbol(symbol, {
						includeHoldings: request.includeHoldings,
						includeInsiderActivity: request.includeInsiderActivity,
						useCache: true,
						maxAge: request.maxAge || 3600,
					});
				})
			);

			const batchResults = await Promise.allSettled(batchPromises);

			// Process results from Promise.allSettled
			batchResults.forEach((result, index) => {
				if (result.status === "fulfilled") {
					allResults.push(result.value);
				} else {
					// Handle rejected promises
					allResults.push({
						symbol: batch[index].toUpperCase(),
						success: false,
						error: result.reason?.message || "Unknown error",
						processingTime: 0,
						dataSource: "api",
					});
				}
			});

			// Brief pause between batches to prevent overwhelming the system
			if (i + this.batchSize < symbols.length) {
				await this.smartDelay(batchResults);
			}

			// Memory pressure check
			await this.checkMemoryPressure();
		}

		return allResults;
	}

	/**
	 * Get holdings with intelligent caching
	 */
	private async getHoldingsWithCache(
		symbol: string,
		useCache: boolean,
		maxAge: number
	): Promise<InstitutionalHolding[] | undefined> {
		if (useCache) {
			const cached = await this.cacheManager.get13FHoldings(symbol);
			if (cached && this.isCacheDataFresh({ timestamp: Date.now() }, maxAge)) {
				return cached;
			}
		}

		const holdings = await this.institutionalService.getInstitutionalHoldings(symbol, 4);

		if (holdings.length > 0 && useCache) {
			await this.cacheManager.cache13FHoldings(symbol, holdings);
		}

		return holdings.length > 0 ? holdings : undefined;
	}

	/**
	 * Get insider activity with intelligent caching
	 */
	private async getInsiderActivityWithCache(
		symbol: string,
		useCache: boolean,
		maxAge: number
	): Promise<InsiderTransaction[] | undefined> {
		if (useCache) {
			const cached = await this.cacheManager.getForm4Transactions(symbol);
			if (cached && this.isCacheDataFresh({ timestamp: Date.now() }, maxAge)) {
				return cached;
			}
		}

		const transactions = await this.institutionalService.getInsiderTransactions(symbol, 180);

		if (transactions.length > 0 && useCache) {
			await this.cacheManager.cacheForm4Transactions(symbol, transactions);
		}

		return transactions.length > 0 ? transactions : undefined;
	}

	/**
	 * Validate analysis request with security controls
	 */
	private validateAnalysisRequest(request: AnalysisRequest): {
		isValid: boolean;
		errors: string[];
		sanitizedSymbols?: string[];
	} {
		const errors: string[] = [];

		// Validate symbols
		if (!request.symbols || !Array.isArray(request.symbols) || request.symbols.length === 0) {
			errors.push("Symbols array is required and must not be empty");
		}

		if (request.symbols.length > 50) {
			errors.push("Maximum 50 symbols allowed per batch request");
		}

		// Validate and sanitize symbols
		let sanitizedSymbols: string[] = [];
		if (request.symbols) {
			const symbolValidation = SecurityValidator.validateSymbolBatch(request.symbols, 50);
			if (!symbolValidation.isValid) {
				errors.push(...symbolValidation.errors);
			} else {
				sanitizedSymbols = JSON.parse(symbolValidation.sanitized!);
			}
		}

		// Validate options
		if (request.maxAge !== undefined && (request.maxAge < 0 || request.maxAge > 86400)) {
			errors.push("maxAge must be between 0 and 86400 seconds (24 hours)");
		}

		return {
			isValid: errors.length === 0,
			errors,
			sanitizedSymbols: errors.length === 0 ? sanitizedSymbols : undefined,
		};
	}

	/**
	 * Create semaphore for concurrency control
	 */
	private createSemaphore(maxConcurrent: number) {
		let running = 0;
		const queue: Array<() => void> = [];

		return async <T>(task: () => Promise<T>): Promise<T> => {
			return new Promise((resolve, reject) => {
				const run = async () => {
					running++;
					try {
						const result = await task();
						resolve(result);
					} catch (error) {
						reject(error);
					} finally {
						running--;
						if (queue.length > 0 && running < maxConcurrent) {
							const next = queue.shift()!;
							next();
						}
					}
				};

				if (running < maxConcurrent) {
					run();
				} else {
					queue.push(run);
				}
			});
		};
	}

	/**
	 * Smart delay between batches based on performance
	 */
	private async smartDelay(
		batchResults: PromiseSettledResult<BatchAnalysisResult>[]
	): Promise<void> {
		// Calculate average response time for this batch
		const successfulResults = batchResults
			.filter(
				(r): r is PromiseFulfilledResult<BatchAnalysisResult> => r.status === "fulfilled"
			)
			.map(r => r.value);

		const avgResponseTime =
			successfulResults.reduce((sum, r) => sum + r.processingTime, 0) /
			successfulResults.length;

		// Adaptive delay: longer delay if responses are slow
		let delay = 50; // Base delay

		if (avgResponseTime > 2000) {
			delay = 200; // Slow responses, give system more time
		} else if (avgResponseTime > 1000) {
			delay = 100; // Medium responses
		}

		await new Promise(resolve => setTimeout(resolve, delay));
	}

	/**
	 * Check and manage memory pressure
	 */
	private async checkMemoryPressure(): Promise<void> {
		if (typeof process !== "undefined" && process.memoryUsage) {
			const memUsage = process.memoryUsage();
			const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

			this.metrics.memoryUsage = heapUsedMB;

			if (heapUsedMB > this.memoryThresholdMB) {
				this.errorHandler.logger.warn(
					`High memory usage detected: ${heapUsedMB.toFixed(1)}MB`,
					{
						heapUsed: heapUsedMB,
						threshold: this.memoryThresholdMB,
					}
				);

				// Trigger garbage collection if available
				if (global.gc) {
					global.gc();
					this.errorHandler.logger.debug("Triggered garbage collection");
				}

				// Trigger cache memory management
				await this.cacheManager.manageCacheMemory();
			}
		}
	}

	/**
	 * Check if cached data is fresh enough
	 */
	private isCacheDataFresh(data: { timestamp: number }, maxAge: number): boolean {
		const age = (Date.now() - data.timestamp) / 1000;
		return age <= maxAge;
	}

	/**
	 * Update performance metrics
	 */
	private updateMetrics(results: BatchAnalysisResult[], processingTime: number): void {
		this.metrics.totalRequests++;

		// Update average response time
		this.metrics.averageResponseTime =
			(this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + processingTime) /
			this.metrics.totalRequests;

		// Update cache hit rate
		const cacheHits = results.filter(r => r.dataSource === "cache").length;
		const totalRequests = results.length;
		this.metrics.cacheHitRate =
			(this.metrics.cacheHitRate * (this.metrics.totalRequests - 1) +
				cacheHits / totalRequests) /
			this.metrics.totalRequests;

		// Update error rate
		const errors = results.filter(r => !r.success).length;
		this.metrics.errorRate =
			(this.metrics.errorRate * (this.metrics.totalRequests - 1) + errors / totalRequests) /
			this.metrics.totalRequests;

		// Calculate parallel efficiency (estimate)
		const avgSymbolTime = processingTime / results.length;
		const serialTime = avgSymbolTime * results.length;
		this.metrics.parallelEfficiency = Math.min(10, serialTime / processingTime);
	}

	/**
	 * Optimize system for peak performance
	 */
	async optimizePerformance(): Promise<void> {
		try {
			// Warm up caches for popular symbols
			await this.cacheManager.warmupPopularSymbols(25);

			// Clear any stale performance data
			this.form13FParser.resetPerformanceStats();
			this.form4Parser.resetMetrics();

			this.errorHandler.logger.info("Performance optimization completed", {
				cacheWarmedUp: true,
				metricsReset: true,
			});
		} catch (error) {
			this.errorHandler.logger.error("Performance optimization failed", { error });
		}
	}

	/**
	 * Get comprehensive performance metrics
	 */
	getPerformanceMetrics(): PerformanceMetrics & {
		parserStats: {
			form13F: any;
			form4: any;
		};
		cacheStats: any;
	} {
		return {
			...this.metrics,
			parserStats: {
				form13F: this.form13FParser.getPerformanceStats(),
				form4: this.form4Parser.getPerformanceMetrics(),
			},
			cacheStats: this.cacheManager.getMetrics(),
		};
	}

	/**
	 * Reset all performance metrics
	 */
	resetMetrics(): void {
		this.metrics = {
			totalRequests: 0,
			averageResponseTime: 0,
			cacheHitRate: 0,
			errorRate: 0,
			parallelEfficiency: 1.0,
			memoryUsage: 0,
			apiCallsAvoided: 0,
		};

		this.form13FParser.resetPerformanceStats();
		this.form4Parser.resetMetrics();
		this.cacheManager.resetMetrics();
	}

	/**
	 * Shutdown the analysis engine
	 */
	async shutdown(): Promise<void> {
		try {
			this.cacheManager.shutdown();
			this.errorHandler.logger.info("Institutional Analysis Engine shutdown completed");
		} catch (error) {
			this.errorHandler.logger.error("Shutdown error", { error });
		}
	}
}
