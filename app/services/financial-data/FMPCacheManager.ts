/**
 * FMP-Specific Cache Manager
 * Optimized caching strategy for Financial Modeling Prep API data
 * Maximizes efficiency for 300 req/min starter plan capacity
 */

import { createServiceErrorHandler } from "../error-handling";
import { FundamentalRatios, StockData, CompanyInfo, AnalystRatings, PriceTarget } from "./types";

interface CacheConfig {
	ttl: number; // Time to live in seconds
	priority: "low" | "medium" | "high" | "critical";
	compressionEnabled: boolean;
	refreshThreshold: number; // Refresh when TTL reaches this percentage (0-1)
}

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
	hitCount: number;
	lastAccessed: number;
	priority: CacheConfig["priority"];
	compressed?: boolean;
	size: number;
}

interface CacheStats {
	totalEntries: number;
	totalSize: number;
	hitRate: number;
	totalHits: number;
	totalMisses: number;
	memoryUsage: number;
	oldestEntry: number;
	newestEntry: number;
}

export class FMPCacheManager {
	private cache = new Map<string, CacheEntry<any>>();
	private errorHandler = createServiceErrorHandler("FMPCacheManager");
	private stats = {
		hits: 0,
		misses: 0,
		evictions: 0,
		refreshes: 0,
	};

	// Cache configurations for different data types
	private cacheConfigs: Record<string, CacheConfig> = {
		// High-frequency data with shorter TTL
		stock_price: {
			ttl: 60, // 60 seconds (1 minute) - balance between freshness and API efficiency
			priority: "high",
			compressionEnabled: false,
			refreshThreshold: 0.8,
		},
		market_data: {
			ttl: 120, // 2 minutes
			priority: "high",
			compressionEnabled: false,
			refreshThreshold: 0.8,
		},

		// Fundamental data with longer TTL (changes less frequently)
		fundamental_ratios: {
			ttl: 3600, // 1 hour
			priority: "critical",
			compressionEnabled: true,
			refreshThreshold: 0.7,
		},
		company_info: {
			ttl: 7200, // 2 hours
			priority: "medium",
			compressionEnabled: true,
			refreshThreshold: 0.6,
		},

		// Analyst data with moderate TTL
		analyst_ratings: {
			ttl: 1800, // 30 minutes
			priority: "medium",
			compressionEnabled: true,
			refreshThreshold: 0.7,
		},
		price_targets: {
			ttl: 1800, // 30 minutes
			priority: "medium",
			compressionEnabled: true,
			refreshThreshold: 0.7,
		},

		// Batch operations - longer TTL to maximize efficiency
		batch_fundamental_ratios: {
			ttl: 7200, // 2 hours
			priority: "critical",
			compressionEnabled: true,
			refreshThreshold: 0.5,
		},

		// Financial statements - longer TTL (quarterly/annual updates)
		income_statement: {
			ttl: 86400, // 24 hours
			priority: "critical",
			compressionEnabled: true,
			refreshThreshold: 0.3,
		},
		balance_sheet: {
			ttl: 86400, // 24 hours
			priority: "critical",
			compressionEnabled: true,
			refreshThreshold: 0.3,
		},
		cash_flow_statement: {
			ttl: 86400, // 24 hours
			priority: "critical",
			compressionEnabled: true,
			refreshThreshold: 0.3,
		},

		// Corporate actions - very long TTL (historical data)
		dividend_data: {
			ttl: 604800, // 7 days
			priority: "medium",
			compressionEnabled: true,
			refreshThreshold: 0.2,
		},
		stock_split_data: {
			ttl: 604800, // 7 days
			priority: "medium",
			compressionEnabled: true,
			refreshThreshold: 0.2,
		},

		// ESG ratings - long TTL (infrequent updates)
		esg_rating: {
			ttl: 259200, // 3 days
			priority: "low",
			compressionEnabled: true,
			refreshThreshold: 0.3,
		},

		// Economic data - moderate TTL
		economic_calendar: {
			ttl: 3600, // 1 hour
			priority: "medium",
			compressionEnabled: true,
			refreshThreshold: 0.6,
		},
		treasury_rates: {
			ttl: 1800, // 30 minutes
			priority: "medium",
			compressionEnabled: false,
			refreshThreshold: 0.7,
		},

		// Comprehensive data bundles - longer TTL to reduce API usage
		comprehensive_financial_data: {
			ttl: 43200, // 12 hours
			priority: "critical",
			compressionEnabled: true,
			refreshThreshold: 0.4,
		},
	};

	private maxCacheSize = 10000; // Maximum number of entries
	private maxMemoryUsage = 100 * 1024 * 1024; // 100MB max memory usage

	/**
	 * Get data from cache with intelligent refresh logic
	 */
	get<T>(key: string, dataType: string): T | null {
		const entry = this.cache.get(key);

		if (!entry) {
			this.stats.misses++;
			return null;
		}

		const now = Date.now();
		const age = (now - entry.timestamp) / 1000;
		const config = this.cacheConfigs[dataType];

		// Check if entry has expired
		if (age > entry.ttl) {
			this.cache.delete(key);
			this.stats.misses++;
			this.errorHandler.logger.debug(`Cache entry expired for ${key}`, {
				age: `${age.toFixed(1)}s`,
				ttl: `${entry.ttl}s`,
				dataType,
			});
			return null;
		}

		// Update access statistics
		entry.hitCount++;
		entry.lastAccessed = now;
		this.stats.hits++;

		// Check if entry needs proactive refresh
		const refreshNeeded = config && age / entry.ttl > config.refreshThreshold;
		if (refreshNeeded) {
			this.errorHandler.logger.debug(`Cache entry needs refresh for ${key}`, {
				age: `${age.toFixed(1)}s`,
				ttl: `${entry.ttl}s`,
				refreshThreshold: config.refreshThreshold,
			});
			// Note: Refresh logic would be handled by the calling service
		}

		return entry.compressed ? this.decompress(entry.data) : entry.data;
	}

	/**
	 * Set data in cache with intelligent storage optimization
	 */
	set<T>(key: string, data: T, dataType: string): void {
		try {
			const config = this.cacheConfigs[dataType] || this.cacheConfigs.stock_price;
			const now = Date.now();

			// Calculate approximate size
			const dataSize = this.estimateSize(data);

			// Check memory constraints
			if (this.getCurrentMemoryUsage() + dataSize > this.maxMemoryUsage) {
				this.evictLeastImportant();
			}

			// Apply compression if configured
			const shouldCompress = config.compressionEnabled && dataSize > 1024; // Compress if > 1KB
			const processedData: T | string = shouldCompress ? this.compress(data) : data;

			const entry: CacheEntry<T> = {
				data: processedData as T,
				timestamp: now,
				ttl: config.ttl,
				hitCount: 0,
				lastAccessed: now,
				priority: config.priority,
				compressed: shouldCompress,
				size: dataSize,
			};

			this.cache.set(key, entry);

			// Enforce cache size limits
			if (this.cache.size > this.maxCacheSize) {
				this.evictOldest();
			}

			this.errorHandler.logger.debug(`Cache entry set for ${key}`, {
				dataType,
				ttl: `${config.ttl}s`,
				compressed: shouldCompress,
				size: `${(dataSize / 1024).toFixed(1)}KB`,
			});
		} catch (error) {
			this.errorHandler.logger.error("Cache set operation failed", {
				key,
				dataType,
				error,
			});
		}
	}

	/**
	 * Batch set multiple entries efficiently
	 */
	setBatch<T>(entries: Array<{ key: string; data: T; dataType: string }>): void {
		const startTime = Date.now();

		try {
			entries.forEach(({ key, data, dataType }) => {
				this.set(key, data, dataType);
			});

			this.errorHandler.logger.info(`Batch cache operation completed`, {
				entriesSet: entries.length,
				duration: `${Date.now() - startTime}ms`,
				cacheSize: this.cache.size,
			});
		} catch (error) {
			this.errorHandler.logger.error("Batch cache operation failed", { error });
		}
	}

	/**
	 * Get batch data from cache
	 */
	getBatch<T>(keys: string[], dataType: string): Map<string, T> {
		const results = new Map<string, T>();

		keys.forEach(key => {
			const data = this.get<T>(key, dataType);
			if (data !== null) {
				results.set(key, data);
			}
		});

		this.errorHandler.logger.debug(`Batch cache retrieval`, {
			requested: keys.length,
			found: results.size,
			hitRate: `${((results.size / keys.length) * 100).toFixed(1)}%`,
		});

		return results;
	}

	/**
	 * Generate optimized cache key for FMP data
	 */
	generateKey(symbol: string, dataType: string, params?: Record<string, any>): string {
		const baseKey = `fmp:${dataType}:${symbol.toUpperCase()}`;

		if (params) {
			const paramString = Object.keys(params)
				.sort()
				.map(key => `${key}=${params[key]}`)
				.join("&");
			return `${baseKey}:${paramString}`;
		}

		return baseKey;
	}

	/**
	 * Intelligent cache eviction based on priority and usage
	 */
	private evictLeastImportant(): void {
		const entries = Array.from(this.cache.entries());

		if (entries.length === 0) return;

		// Score entries based on priority, age, and usage
		const scored = entries.map(([key, entry]) => {
			const age = (Date.now() - entry.timestamp) / 1000;
			const timeSinceAccess = (Date.now() - entry.lastAccessed) / 1000;
			const ageScore = Math.min(age / entry.ttl, 1); // 0-1, higher = older
			const usageScore = 1 / (entry.hitCount + 1); // Lower = more used
			const accessScore = Math.min(timeSinceAccess / 3600, 1); // 0-1, higher = longer since access

			const priorityScores = { critical: 0.1, high: 0.3, medium: 0.5, low: 0.8 };
			const priorityScore = priorityScores[entry.priority];

			const evictionScore = (ageScore + usageScore + accessScore + priorityScore) / 4;

			return { key, entry, score: evictionScore };
		});

		// Sort by eviction score (highest first) and remove top 10%
		scored.sort((a, b) => b.score - a.score);
		const toEvict = Math.max(1, Math.floor(scored.length * 0.1));

		for (let i = 0; i < toEvict; i++) {
			this.cache.delete(scored[i].key);
			this.stats.evictions++;
		}

		this.errorHandler.logger.info(`Cache eviction completed`, {
			entriesEvicted: toEvict,
			remainingEntries: this.cache.size,
			memoryFreed: "estimated",
		});
	}

	/**
	 * Evict oldest entries
	 */
	private evictOldest(): void {
		const entries = Array.from(this.cache.entries());
		entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

		const toEvict = Math.max(1, Math.floor(entries.length * 0.1));
		for (let i = 0; i < toEvict; i++) {
			this.cache.delete(entries[i][0]);
			this.stats.evictions++;
		}
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats {
		const entries = Array.from(this.cache.values());
		const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
		const timestamps = entries.map(e => e.timestamp);

		return {
			totalEntries: this.cache.size,
			totalSize,
			hitRate: (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 || 0,
			totalHits: this.stats.hits,
			totalMisses: this.stats.misses,
			memoryUsage: this.getCurrentMemoryUsage(),
			oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
			newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
		};
	}

	/**
	 * Clear cache entries for a specific data type
	 */
	clearByDataType(dataType: string): number {
		let cleared = 0;
		const keysToDelete: string[] = [];

		for (const [key] of this.cache) {
			if (key.includes(`:${dataType}:`)) {
				keysToDelete.push(key);
			}
		}

		keysToDelete.forEach(key => {
			this.cache.delete(key);
			cleared++;
		});

		this.errorHandler.logger.info(`Cleared cache entries`, {
			dataType,
			entriesCleared: cleared,
		});

		return cleared;
	}

	/**
	 * Estimate memory usage of data
	 */
	private estimateSize(data: any): number {
		try {
			return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
		} catch {
			return 1000; // Fallback estimate
		}
	}

	/**
	 * Get current memory usage estimate
	 */
	private getCurrentMemoryUsage(): number {
		return Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
	}

	/**
	 * Simple compression (placeholder - could use real compression library)
	 */
	private compress<T>(data: T): string {
		return JSON.stringify(data); // Placeholder - implement real compression if needed
	}

	/**
	 * Simple decompression
	 */
	private decompress<T>(data: string): T {
		return JSON.parse(data); // Placeholder - implement real decompression if needed
	}
}
