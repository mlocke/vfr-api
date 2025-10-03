/**
 * Intelligent Caching Strategy for Institutional Data
 * Optimized TTL management for quarterly 13F vs real-time Form 4 data
 * Maintains <3 second response time through strategic cache warming and invalidation
 */

import { redisCache } from "../cache/RedisCache";
import { InstitutionalHolding, InsiderTransaction, InstitutionalIntelligence } from "./types";
import { createServiceErrorHandler } from "../error-handling";

interface CacheConfig {
	thirteenF: {
		ttl: number; // 6 hours - quarterly data updates infrequently
		warmupPeriod: number; // Time before expiration to start background refresh
		maxSymbols: number; // Maximum symbols to cache
	};
	form4: {
		ttl: number; // 1 hour - insider trading data updates more frequently
		warmupPeriod: number; // Time before expiration to start background refresh
		maxTransactions: number; // Maximum transactions per symbol
	};
	intelligence: {
		ttl: number; // 3 hours - composite analysis
		warmupPeriod: number; // Background refresh time
		dependencies: string[]; // Keys that invalidate this cache
	};
	performance: {
		batchSize: number; // Cache operations batch size
		concurrentWarmups: number; // Concurrent cache warming operations
		memoryThresholdMB: number; // Memory limit for cache operations
	};
}

interface CacheMetrics {
	hits: { thirteenF: number; form4: number; intelligence: number };
	misses: { thirteenF: number; form4: number; intelligence: number };
	warmups: { successful: number; failed: number };
	evictions: { manual: number; automatic: number };
	memoryUsage: number;
	responseTimeMs: { min: number; max: number; avg: number };
}

interface CacheWarmupJob {
	symbol: string;
	type: "thirteenF" | "form4" | "intelligence";
	priority: number;
	scheduledAt: number;
	attempts: number;
}

export class InstitutionalCacheManager {
	private readonly config: CacheConfig;
	private readonly errorHandler = createServiceErrorHandler("InstitutionalCacheManager");
	private readonly metrics: CacheMetrics;
	private readonly warmupQueue: CacheWarmupJob[] = [];
	private readonly popularSymbols: Set<string> = new Set();
	private isWarmupProcessing = false;
	private warmupInterval?: NodeJS.Timeout;

	constructor(config?: Partial<CacheConfig>) {
		this.config = {
			thirteenF: {
				ttl: 6 * 60 * 60, // 6 hours
				warmupPeriod: 30 * 60, // 30 minutes before expiration
				maxSymbols: 1000,
			},
			form4: {
				ttl: 60 * 60, // 1 hour
				warmupPeriod: 10 * 60, // 10 minutes before expiration
				maxTransactions: 500,
			},
			intelligence: {
				ttl: 3 * 60 * 60, // 3 hours
				warmupPeriod: 20 * 60, // 20 minutes before expiration
				dependencies: ["thirteenF", "form4"],
			},
			performance: {
				batchSize: 10,
				concurrentWarmups: 3,
				memoryThresholdMB: 200,
			},
			...config,
		};

		this.metrics = {
			hits: { thirteenF: 0, form4: 0, intelligence: 0 },
			misses: { thirteenF: 0, form4: 0, intelligence: 0 },
			warmups: { successful: 0, failed: 0 },
			evictions: { manual: 0, automatic: 0 },
			memoryUsage: 0,
			responseTimeMs: { min: 0, max: 0, avg: 0 },
		};

		this.initializeWarmupScheduler();
		this.loadPopularSymbols();
	}

	/**
	 * Get 13F holdings with intelligent caching
	 */
	async get13FHoldings(symbol: string): Promise<InstitutionalHolding[] | null> {
		const startTime = Date.now();
		const cacheKey = this.build13FCacheKey(symbol);

		try {
			// Attempt cache retrieval
			const cached = await redisCache.get<{
				data: InstitutionalHolding[];
				metadata: { cachedAt: number; ttl: number; symbol: string };
			}>(cacheKey);

			if (cached) {
				this.metrics.hits.thirteenF++;
				this.updateResponseTime(Date.now() - startTime);

				// Check if we need to schedule warmup
				const timeUntilExpiration =
					cached.metadata.cachedAt + cached.metadata.ttl * 1000 - Date.now();
				if (timeUntilExpiration <= this.config.thirteenF.warmupPeriod * 1000) {
					this.scheduleWarmup(symbol, "thirteenF", 2); // Medium priority
				}

				this.errorHandler.logger.debug(`13F cache hit for ${symbol}`, {
					symbol,
					holdingsCount: cached.data.length,
					timeUntilExpiration: Math.round(timeUntilExpiration / 1000),
				});

				return cached.data;
			}

			this.metrics.misses.thirteenF++;
			this.updateResponseTime(Date.now() - startTime);

			// Schedule immediate warmup for cache miss
			this.scheduleWarmup(symbol, "thirteenF", 1); // High priority

			return null;
		} catch (error) {
			this.errorHandler.logger.warn(`13F cache retrieval failed for ${symbol}`, { error });
			return null;
		}
	}

	/**
	 * Cache 13F holdings with optimized metadata
	 */
	async cache13FHoldings(symbol: string, holdings: InstitutionalHolding[]): Promise<boolean> {
		const cacheKey = this.build13FCacheKey(symbol);

		try {
			// Optimize data size by removing redundant fields for caching
			const optimizedHoldings = holdings.map(holding => ({
				...holding,
				// Remove verbose fields that can be reconstructed
				securityName:
					holding.securityName.length > 50
						? holding.securityName.substring(0, 50) + "..."
						: holding.securityName,
			}));

			const cacheData = {
				data: optimizedHoldings,
				metadata: {
					cachedAt: Date.now(),
					ttl: this.config.thirteenF.ttl,
					symbol: symbol.toUpperCase(),
					version: "1.0.0",
				},
			};

			const success = await redisCache.set(cacheKey, cacheData, this.config.thirteenF.ttl, {
				source: "institutional_13f",
				version: "1.0.0",
			});

			if (success) {
				this.trackPopularSymbol(symbol);
				this.errorHandler.logger.debug(`Cached 13F holdings for ${symbol}`, {
					symbol,
					holdingsCount: holdings.length,
					ttl: this.config.thirteenF.ttl,
				});
			}

			return success;
		} catch (error) {
			this.errorHandler.logger.error(`Failed to cache 13F holdings for ${symbol}`, { error });
			return false;
		}
	}

	/**
	 * Get Form 4 insider transactions with caching
	 */
	async getForm4Transactions(symbol: string): Promise<InsiderTransaction[] | null> {
		const startTime = Date.now();
		const cacheKey = this.buildForm4CacheKey(symbol);

		try {
			const cached = await redisCache.get<{
				data: InsiderTransaction[];
				metadata: { cachedAt: number; ttl: number; symbol: string };
			}>(cacheKey);

			if (cached) {
				this.metrics.hits.form4++;
				this.updateResponseTime(Date.now() - startTime);

				// Check if we need to schedule warmup (shorter window for Form 4)
				const timeUntilExpiration =
					cached.metadata.cachedAt + cached.metadata.ttl * 1000 - Date.now();
				if (timeUntilExpiration <= this.config.form4.warmupPeriod * 1000) {
					this.scheduleWarmup(symbol, "form4", 1); // High priority for real-time data
				}

				this.errorHandler.logger.debug(`Form 4 cache hit for ${symbol}`, {
					symbol,
					transactionCount: cached.data.length,
					timeUntilExpiration: Math.round(timeUntilExpiration / 1000),
				});

				return cached.data;
			}

			this.metrics.misses.form4++;
			this.updateResponseTime(Date.now() - startTime);

			// Schedule immediate warmup for cache miss
			this.scheduleWarmup(symbol, "form4", 1); // High priority

			return null;
		} catch (error) {
			this.errorHandler.logger.warn(`Form 4 cache retrieval failed for ${symbol}`, { error });
			return null;
		}
	}

	/**
	 * Cache Form 4 transactions with size optimization
	 */
	async cacheForm4Transactions(
		symbol: string,
		transactions: InsiderTransaction[]
	): Promise<boolean> {
		const cacheKey = this.buildForm4CacheKey(symbol);

		try {
			// Limit transaction count to manage memory
			const limitedTransactions = transactions
				.sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime())
				.slice(0, this.config.form4.maxTransactions);

			const cacheData = {
				data: limitedTransactions,
				metadata: {
					cachedAt: Date.now(),
					ttl: this.config.form4.ttl,
					symbol: symbol.toUpperCase(),
					version: "1.0.0",
				},
			};

			const success = await redisCache.set(cacheKey, cacheData, this.config.form4.ttl, {
				source: "institutional_form4",
				version: "1.0.0",
			});

			if (success) {
				this.trackPopularSymbol(symbol);
				this.errorHandler.logger.debug(`Cached Form 4 transactions for ${symbol}`, {
					symbol,
					transactionCount: limitedTransactions.length,
					ttl: this.config.form4.ttl,
				});
			}

			return success;
		} catch (error) {
			this.errorHandler.logger.error(`Failed to cache Form 4 transactions for ${symbol}`, {
				error,
			});
			return false;
		}
	}

	/**
	 * Get institutional intelligence with dependency-aware caching
	 */
	async getInstitutionalIntelligence(symbol: string): Promise<InstitutionalIntelligence | null> {
		const startTime = Date.now();
		const cacheKey = this.buildIntelligenceCacheKey(symbol);

		try {
			const cached = await redisCache.get<{
				data: InstitutionalIntelligence;
				metadata: { cachedAt: number; ttl: number; dependencies: number[] };
			}>(cacheKey);

			if (cached) {
				// Check if dependencies are still valid
				const dependenciesValid = await this.validateCacheDependencies(
					symbol,
					cached.metadata.dependencies
				);

				if (dependenciesValid) {
					this.metrics.hits.intelligence++;
					this.updateResponseTime(Date.now() - startTime);

					// Schedule warmup if needed
					const timeUntilExpiration =
						cached.metadata.cachedAt + cached.metadata.ttl * 1000 - Date.now();
					if (timeUntilExpiration <= this.config.intelligence.warmupPeriod * 1000) {
						this.scheduleWarmup(symbol, "intelligence", 2);
					}

					return cached.data;
				} else {
					// Dependencies invalidated, remove from cache
					await redisCache.delete(cacheKey);
					this.metrics.evictions.automatic++;
				}
			}

			this.metrics.misses.intelligence++;
			this.updateResponseTime(Date.now() - startTime);

			return null;
		} catch (error) {
			this.errorHandler.logger.warn(`Intelligence cache retrieval failed for ${symbol}`, {
				error,
			});
			return null;
		}
	}

	/**
	 * Cache institutional intelligence with dependency tracking
	 */
	async cacheInstitutionalIntelligence(
		symbol: string,
		intelligence: InstitutionalIntelligence
	): Promise<boolean> {
		const cacheKey = this.buildIntelligenceCacheKey(symbol);

		try {
			// Get dependency timestamps
			const dependencyTimestamps = await this.getDependencyTimestamps(symbol);

			const cacheData = {
				data: intelligence,
				metadata: {
					cachedAt: Date.now(),
					ttl: this.config.intelligence.ttl,
					dependencies: dependencyTimestamps,
					version: "1.0.0",
				},
			};

			const success = await redisCache.set(
				cacheKey,
				cacheData,
				this.config.intelligence.ttl,
				{
					source: "institutional_intelligence",
					version: "1.0.0",
				}
			);

			return success;
		} catch (error) {
			this.errorHandler.logger.error(
				`Failed to cache institutional intelligence for ${symbol}`,
				{ error }
			);
			return false;
		}
	}

	/**
	 * Batch cache warming for popular symbols
	 */
	async warmupPopularSymbols(limit = 50): Promise<void> {
		const symbols = Array.from(this.popularSymbols).slice(0, limit);

		this.errorHandler.logger.info(
			`Starting cache warmup for ${symbols.length} popular symbols`
		);

		// Process in batches to control load
		const batchSize = this.config.performance.batchSize;
		for (let i = 0; i < symbols.length; i += batchSize) {
			const batch = symbols.slice(i, i + batchSize);

			const warmupPromises = batch.map(
				symbol => this.scheduleWarmup(symbol, "intelligence", 3) // Lower priority for batch warmup
			);

			await Promise.allSettled(warmupPromises);

			// Brief pause between batches
			if (i + batchSize < symbols.length) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}
	}

	/**
	 * Intelligent cache invalidation based on market events
	 */
	async invalidateByMarketEvent(
		event: "earnings" | "acquisition" | "insider_activity",
		symbols: string[]
	): Promise<void> {
		const invalidationPromises = symbols.map(async symbol => {
			const keys = [];

			switch (event) {
				case "earnings":
					// Earnings may affect institutional sentiment
					keys.push(this.buildIntelligenceCacheKey(symbol));
					break;
				case "acquisition":
					// Acquisitions may affect all institutional data
					keys.push(
						this.build13FCacheKey(symbol),
						this.buildForm4CacheKey(symbol),
						this.buildIntelligenceCacheKey(symbol)
					);
					break;
				case "insider_activity":
					// New insider activity invalidates Form 4 and intelligence
					keys.push(
						this.buildForm4CacheKey(symbol),
						this.buildIntelligenceCacheKey(symbol)
					);
					break;
			}

			const deletionPromises = keys.map(key => redisCache.delete(key));
			await Promise.allSettled(deletionPromises);

			this.metrics.evictions.manual += keys.length;
		});

		await Promise.allSettled(invalidationPromises);

		this.errorHandler.logger.info(
			`Invalidated caches for ${event} affecting ${symbols.length} symbols`
		);
	}

	/**
	 * Memory-aware cache management
	 */
	async manageCacheMemory(): Promise<void> {
		try {
			const stats = await redisCache.getStats();
			const memoryUsageMB = this.parseMemoryUsage(stats.memoryUsage);

			this.metrics.memoryUsage = memoryUsageMB;

			if (memoryUsageMB > this.config.performance.memoryThresholdMB) {
				this.errorHandler.logger.warn(`Cache memory usage high: ${memoryUsageMB}MB`, {
					threshold: this.config.performance.memoryThresholdMB,
					currentUsage: memoryUsageMB,
				});

				// Evict least recently used institutional data
				await this.evictLRUInstitutionalData();
			}
		} catch (error) {
			this.errorHandler.logger.error("Cache memory management failed", { error });
		}
	}

	/**
	 * Private helper methods
	 */

	private build13FCacheKey(symbol: string): string {
		return `institutional:13f:${symbol.toUpperCase()}`;
	}

	private buildForm4CacheKey(symbol: string): string {
		return `institutional:form4:${symbol.toUpperCase()}`;
	}

	private buildIntelligenceCacheKey(symbol: string): string {
		return `institutional:intelligence:${symbol.toUpperCase()}`;
	}

	private scheduleWarmup(
		symbol: string,
		type: "thirteenF" | "form4" | "intelligence",
		priority: number
	): void {
		// Avoid duplicate warmup jobs
		const existingJob = this.warmupQueue.find(
			job => job.symbol === symbol && job.type === type
		);
		if (existingJob) {
			existingJob.priority = Math.min(existingJob.priority, priority); // Higher priority wins
			return;
		}

		this.warmupQueue.push({
			symbol: symbol.toUpperCase(),
			type,
			priority,
			scheduledAt: Date.now(),
			attempts: 0,
		});

		// Sort by priority (lower number = higher priority)
		this.warmupQueue.sort((a, b) => a.priority - b.priority);
	}

	private initializeWarmupScheduler(): void {
		// Process warmup queue every 30 seconds
		this.warmupInterval = setInterval(async () => {
			if (!this.isWarmupProcessing && this.warmupQueue.length > 0) {
				await this.processWarmupQueue();
			}
		}, 30000);

		// Allow process to exit even with active timer
		if (this.warmupInterval.unref) {
			this.warmupInterval.unref();
		}
	}

	private async processWarmupQueue(): Promise<void> {
		if (this.isWarmupProcessing) return;

		this.isWarmupProcessing = true;

		try {
			const concurrentLimit = this.config.performance.concurrentWarmups;
			const jobsToProcess = this.warmupQueue.splice(0, concurrentLimit);

			if (jobsToProcess.length === 0) {
				return;
			}

			this.errorHandler.logger.debug(`Processing ${jobsToProcess.length} cache warmup jobs`);

			const warmupPromises = jobsToProcess.map(async job => {
				try {
					// This would integrate with the actual data fetching services
					// For now, we'll simulate the warmup process
					await this.executeWarmupJob(job);
					this.metrics.warmups.successful++;
				} catch (error) {
					this.metrics.warmups.failed++;
					job.attempts++;

					// Retry failed jobs with exponential backoff
					if (job.attempts < 3) {
						job.scheduledAt = Date.now() + job.attempts * 60000; // 1, 2, 3 minute delays
						this.warmupQueue.push(job);
					}

					this.errorHandler.logger.warn(
						`Cache warmup failed for ${job.symbol}:${job.type}`,
						{ error, job }
					);
				}
			});

			await Promise.allSettled(warmupPromises);
		} finally {
			this.isWarmupProcessing = false;
		}
	}

	private async executeWarmupJob(job: CacheWarmupJob): Promise<void> {
		// This would integrate with InstitutionalDataService to fetch fresh data
		// Implementation would depend on the specific service methods
		this.errorHandler.logger.debug(`Executing warmup for ${job.symbol}:${job.type}`);
	}

	private async validateCacheDependencies(
		symbol: string,
		dependencyTimestamps: number[]
	): Promise<boolean> {
		try {
			const currentTimestamps = await this.getDependencyTimestamps(symbol);
			return JSON.stringify(dependencyTimestamps) === JSON.stringify(currentTimestamps);
		} catch (error) {
			return false;
		}
	}

	private async getDependencyTimestamps(symbol: string): Promise<number[]> {
		const timestamps: number[] = [];

		// Get timestamps of dependency caches
		for (const dep of this.config.intelligence.dependencies) {
			let cacheKey: string;
			switch (dep) {
				case "thirteenF":
					cacheKey = this.build13FCacheKey(symbol);
					break;
				case "form4":
					cacheKey = this.buildForm4CacheKey(symbol);
					break;
				default:
					continue;
			}

			try {
				const cached = await redisCache.get<{ metadata: { cachedAt: number } }>(cacheKey);
				timestamps.push(cached?.metadata.cachedAt || 0);
			} catch (error) {
				timestamps.push(0);
			}
		}

		return timestamps;
	}

	private trackPopularSymbol(symbol: string): void {
		this.popularSymbols.add(symbol.toUpperCase());

		// Limit popular symbols to prevent unbounded growth
		if (this.popularSymbols.size > this.config.thirteenF.maxSymbols) {
			const symbolArray = Array.from(this.popularSymbols);
			const toRemove = symbolArray.slice(
				0,
				symbolArray.length - this.config.thirteenF.maxSymbols
			);
			toRemove.forEach(s => this.popularSymbols.delete(s));
		}
	}

	private loadPopularSymbols(): void {
		// Load from a predefined list or database
		const defaultPopular = [
			"AAPL",
			"MSFT",
			"GOOGL",
			"AMZN",
			"TSLA",
			"META",
			"NVDA",
			"NFLX",
			"JPM",
			"JNJ",
			"V",
			"PG",
			"UNH",
			"HD",
			"MA",
			"DIS",
			"BAC",
			"ADBE",
		];

		defaultPopular.forEach(symbol => this.popularSymbols.add(symbol));
	}

	private updateResponseTime(responseTime: number): void {
		if (
			this.metrics.responseTimeMs.min === 0 ||
			responseTime < this.metrics.responseTimeMs.min
		) {
			this.metrics.responseTimeMs.min = responseTime;
		}
		if (responseTime > this.metrics.responseTimeMs.max) {
			this.metrics.responseTimeMs.max = responseTime;
		}

		// Simple moving average
		const total =
			this.metrics.hits.thirteenF +
			this.metrics.hits.form4 +
			this.metrics.hits.intelligence +
			this.metrics.misses.thirteenF +
			this.metrics.misses.form4 +
			this.metrics.misses.intelligence;

		this.metrics.responseTimeMs.avg =
			(this.metrics.responseTimeMs.avg * (total - 1) + responseTime) / total;
	}

	private parseMemoryUsage(memoryString: string): number {
		const match = memoryString.match(/(\d+(?:\.\d+)?)(K|M|G)B?/i);
		if (!match) return 0;

		const value = parseFloat(match[1]);
		const unit = match[2].toUpperCase();

		switch (unit) {
			case "K":
				return value / 1024;
			case "M":
				return value;
			case "G":
				return value * 1024;
			default:
				return value / 1024 / 1024;
		}
	}

	private async evictLRUInstitutionalData(): Promise<void> {
		// Implementation would identify and remove least recently used institutional cache entries
		this.errorHandler.logger.info("Evicting LRU institutional data to free memory");
	}

	/**
	 * Get cache performance metrics
	 */
	getMetrics(): CacheMetrics {
		return { ...this.metrics };
	}

	/**
	 * Reset cache metrics
	 */
	resetMetrics(): void {
		Object.assign(this.metrics, {
			hits: { thirteenF: 0, form4: 0, intelligence: 0 },
			misses: { thirteenF: 0, form4: 0, intelligence: 0 },
			warmups: { successful: 0, failed: 0 },
			evictions: { manual: 0, automatic: 0 },
			memoryUsage: 0,
			responseTimeMs: { min: 0, max: 0, avg: 0 },
		});
	}

	/**
	 * Shutdown cache manager
	 */
	shutdown(): void {
		if (this.warmupInterval) {
			clearInterval(this.warmupInterval);
		}
	}
}
