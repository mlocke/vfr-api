/**
 * Yahoo Finance Sentiment API - High Performance Provider
 * Optimized replacement for NewsAPI with <1.5s target response time
 *
 * Key Optimizations:
 * - Batch processing with 100ms consolidation window
 * - Intelligent caching with 5-minute TTL
 * - Memory-efficient connection pooling
 * - Parallel processing with Yahoo Finance + yfinance
 */

import { FinancialDataProvider, ApiResponse } from "../types.js";
import { NewsSentimentData, SentimentAnalysisConfig } from "../types/sentiment-types";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

interface CachedSentiment {
	data: NewsSentimentData;
	timestamp: number;
	hits: number; // Track cache usage for LRU eviction
}

interface BatchRequest {
	symbols: string[];
	resolve: (results: Map<string, NewsSentimentData>) => void;
	reject: (error: Error) => void;
}

export class YahooFinanceSentimentAPI implements FinancialDataProvider {
	name = "Yahoo Finance Sentiment";

	// Performance-optimized caching
	private sentimentCache = new Map<string, CachedSentiment>();
	private requestPool = new Map<string, Promise<NewsSentimentData | null>>();
	private batchQueue: BatchRequest[] = [];
	private batchTimer: NodeJS.Timeout | null = null;

	// Performance configuration
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes (news changes frequently)
	private readonly BATCH_WINDOW = 100; // 100ms batch consolidation
	private readonly MAX_BATCH_SIZE = 10; // Optimal batch size for Yahoo Finance
	private readonly MAX_CACHE_SIZE = 1000; // LRU eviction threshold
	private readonly TIMEOUT = 25000; // 25s timeout for batch operations

	// Performance metrics
	private stats = {
		requests: 0,
		cacheHits: 0,
		batchRequests: 0,
		avgResponseTime: 0,
		memoryUsage: 0,
	};

	constructor() {
		// Periodic cache cleanup to prevent memory leaks
		setInterval(() => this.optimizeCache(), 10 * 60 * 1000); // Every 10 minutes
	}

	/**
	 * Get news sentiment with intelligent batching and caching
	 */
	async getNewsSentiment(symbol: string, timeframe = "1d"): Promise<NewsSentimentData | null> {
		const startTime = Date.now();
		this.stats.requests++;

		try {
			const upperSymbol = symbol.toUpperCase();

			// Check cache first
			const cached = this.getCachedSentiment(upperSymbol);
			if (cached) {
				this.stats.cacheHits++;
				const responseTime = Date.now() - startTime;
				this.updateResponseTime(responseTime);
				return cached;
			}

			// Check if request is already in progress
			const requestKey = `sentiment:${upperSymbol}`;
			if (this.requestPool.has(requestKey)) {
				return await this.requestPool.get(requestKey)!;
			}

			// Create batched request
			const requestPromise = this.createBatchedRequest(upperSymbol);
			this.requestPool.set(requestKey, requestPromise);

			try {
				const result = await requestPromise;

				// Cache successful results
				if (result) {
					this.setCachedSentiment(upperSymbol, result);
				}

				const responseTime = Date.now() - startTime;
				this.updateResponseTime(responseTime);

				return result;
			} finally {
				this.requestPool.delete(requestKey);
			}
		} catch (error) {
			console.error(`Yahoo Finance Sentiment error for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Create a batched request for optimal Yahoo Finance API usage
	 */
	private createBatchedRequest(symbol: string): Promise<NewsSentimentData | null> {
		return new Promise((resolve, reject) => {
			// Find existing batch with capacity
			let targetBatch = this.batchQueue.find(
				batch => batch.symbols.length < this.MAX_BATCH_SIZE
			);

			if (!targetBatch) {
				// Create new batch
				targetBatch = {
					symbols: [],
					resolve: results => resolve(results.get(symbol) || null),
					reject,
				};
				this.batchQueue.push(targetBatch);
			}

			// Add symbol to batch (avoid duplicates)
			if (!targetBatch.symbols.includes(symbol)) {
				targetBatch.symbols.push(symbol);
			}

			// Set batch timer if not already running
			if (!this.batchTimer) {
				this.batchTimer = setTimeout(() => {
					this.processBatches();
				}, this.BATCH_WINDOW);
			}
		});
	}

	/**
	 * Process all queued batches efficiently
	 */
	private async processBatches(): Promise<void> {
		this.batchTimer = null;

		if (this.batchQueue.length === 0) return;

		const batches = this.batchQueue.splice(0); // Take all batches
		this.stats.batchRequests++;

		try {
			// Collect unique symbols across all batches
			const allSymbols = Array.from(new Set(batches.flatMap(batch => batch.symbols)));

			console.log(`📊 Processing sentiment batch: ${allSymbols.length} symbols`);

			// Execute optimized Python script
			const results = await this.executeBatchSentimentAnalysis(allSymbols);

			// Resolve all batch promises
			batches.forEach(batch => {
				try {
					batch.resolve(results);
				} catch (error) {
					batch.reject(error as Error);
				}
			});
		} catch (error) {
			console.error("Batch sentiment processing error:", error);
			batches.forEach(batch => batch.reject(error as Error));
		}
	}

	/**
	 * Execute optimized Python script for batch sentiment analysis
	 */
	private async executeBatchSentimentAnalysis(
		symbols: string[]
	): Promise<Map<string, NewsSentimentData>> {
		const pythonScript = path.join(process.cwd(), "scripts", "fetch_yahoo_news.py");
		const command = `python3 "${pythonScript}" ${symbols.join(" ")}`;

		const { stdout, stderr } = await execAsync(command, {
			timeout: this.TIMEOUT,
			maxBuffer: 2 * 1024 * 1024, // 2MB buffer
			encoding: "utf8",
		});

		// Log warnings but don't fail on them
		if (stderr && !stderr.includes("Warning") && !stderr.includes("FutureWarning")) {
			console.warn("Python script stderr:", stderr);
		}

		const response = JSON.parse(stdout);
		if (!response.success) {
			throw new Error(`Batch sentiment analysis failed: ${response.error}`);
		}

		// Convert to Map for efficient lookups
		const results = new Map<string, NewsSentimentData>();

		for (const [symbol, data] of Object.entries(response.data as Record<string, any>)) {
			if (!data.error && data.sentiment !== undefined) {
				results.set(symbol.toUpperCase(), {
					symbol: symbol.toUpperCase(),
					sentiment: data.sentiment,
					confidence: data.confidence || 0.5,
					articleCount: data.articleCount || 0,
					sources: data.sources || [],
					keyTopics: data.keyTopics || [],
					timeframe: "1d",
					lastUpdated: data.lastUpdated || Date.now(),
				});
			}
		}

		console.log(`✅ Batch sentiment completed: ${results.size}/${symbols.length} successful`);
		return results;
	}

	/**
	 * Optimized cache management with LRU eviction
	 */
	private getCachedSentiment(symbol: string): NewsSentimentData | null {
		const cached = this.sentimentCache.get(symbol);

		if (!cached) return null;

		// Check expiration
		if (Date.now() - cached.timestamp > this.CACHE_TTL) {
			this.sentimentCache.delete(symbol);
			return null;
		}

		// Update access count for LRU
		cached.hits++;
		return cached.data;
	}

	private setCachedSentiment(symbol: string, data: NewsSentimentData): void {
		// Implement LRU eviction if cache is full
		if (this.sentimentCache.size >= this.MAX_CACHE_SIZE) {
			this.evictLRU();
		}

		this.sentimentCache.set(symbol, {
			data,
			timestamp: Date.now(),
			hits: 1,
		});
	}

	/**
	 * LRU eviction to prevent memory bloat
	 */
	private evictLRU(): void {
		let lruSymbol = "";
		let minHits = Infinity;
		let oldestTime = Date.now();

		for (const [symbol, cached] of this.sentimentCache.entries()) {
			// Prioritize by access frequency, then by age
			if (
				cached.hits < minHits ||
				(cached.hits === minHits && cached.timestamp < oldestTime)
			) {
				minHits = cached.hits;
				oldestTime = cached.timestamp;
				lruSymbol = symbol;
			}
		}

		if (lruSymbol) {
			this.sentimentCache.delete(lruSymbol);
		}
	}

	/**
	 * Periodic cache optimization
	 */
	private optimizeCache(): void {
		const now = Date.now();
		let evicted = 0;

		// Remove expired entries
		for (const [symbol, cached] of this.sentimentCache.entries()) {
			if (now - cached.timestamp > this.CACHE_TTL) {
				this.sentimentCache.delete(symbol);
				evicted++;
			}
		}

		// Update memory usage stats
		this.stats.memoryUsage = this.sentimentCache.size;

		if (evicted > 0) {
			console.log(`🧹 Evicted ${evicted} expired sentiment cache entries`);
		}
	}

	private updateResponseTime(responseTime: number): void {
		this.stats.avgResponseTime =
			(this.stats.avgResponseTime * (this.stats.requests - 1) + responseTime) /
			this.stats.requests;
	}

	/**
	 * Performance monitoring
	 */
	getPerformanceStats() {
		return {
			...this.stats,
			cacheSize: this.sentimentCache.size,
			hitRate: this.stats.requests > 0 ? this.stats.cacheHits / this.stats.requests : 0,
			avgBatchSize:
				this.stats.batchRequests > 0 ? this.stats.requests / this.stats.batchRequests : 0,
		};
	}

	/**
	 * Cache warming for frequently accessed symbols
	 */
	async warmCache(symbols: string[]): Promise<number> {
		console.log(`🔥 Warming sentiment cache for ${symbols.length} symbols`);

		const promises = symbols.map(symbol => this.getNewsSentiment(symbol).catch(() => null));

		const results = await Promise.allSettled(promises);
		const successful = results.filter(r => r.status === "fulfilled" && r.value).length;

		console.log(`🔥 Cache warm-up complete: ${successful}/${symbols.length} cached`);
		return successful;
	}

	/**
	 * Memory cleanup
	 */
	cleanup(): void {
		this.sentimentCache.clear();
		this.requestPool.clear();
		if (this.batchTimer) {
			clearTimeout(this.batchTimer);
			this.batchTimer = null;
		}
		this.batchQueue.length = 0;
	}

	/**
	 * Health check
	 */
	async healthCheck(): Promise<boolean> {
		try {
			const result = await this.getNewsSentiment("AAPL");
			return result !== null;
		} catch {
			return false;
		}
	}

	// Required FinancialDataProvider methods (not implemented for sentiment provider)
	async getStockPrice(): Promise<any> {
		throw new Error("getStockPrice not implemented - use getNewsSentiment instead");
	}

	async getCompanyInfo(): Promise<any> {
		throw new Error("getCompanyInfo not implemented - use getNewsSentiment instead");
	}

	async getMarketData(): Promise<any> {
		throw new Error("getMarketData not implemented - use getNewsSentiment instead");
	}

	async getStocksBySector(): Promise<any[]> {
		throw new Error("getStocksBySector not implemented");
	}
}

export default YahooFinanceSentimentAPI;
