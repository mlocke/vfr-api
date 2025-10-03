/**
 * Model Cache Service for VFR Machine Learning Enhancement Layer
 * Provides hot model caching with LRU eviction strategy
 *
 * Features:
 * - Hot model caching (keep popular models in memory)
 * - LRU eviction strategy when cache is full
 * - <50ms model load from cache (target performance)
 * - Lazy loading (load on first access)
 * - Cache statistics tracking (hits, misses, load times)
 * - Memory management (configurable max cache size)
 *
 * Pattern: Singleton with getInstance()
 * Performance Target: <50ms cache retrieval
 */

import { Logger } from "../../error-handling/Logger";
import { ErrorHandler, ErrorType, ErrorCode } from "../../error-handling/ErrorHandler";
import { MLModelType, MLServiceResponse } from "../types/MLTypes";

// ===== Configuration Types =====

export interface ModelCacheConfig {
	maxCachedModels: number; // Default: 5
	enableLRU: boolean; // Default: true
	maxLoadTimeMs: number; // Default: 50ms
	enableMetrics: boolean; // Default: true
	warmCacheOnStartup: boolean; // Default: false
}

// ===== Cache Entry Types =====

export interface ModelCacheEntry {
	modelId: string;
	modelName: string;
	modelVersion: string;
	artifact: any; // The actual model object
	metadata: Record<string, any>;
	loadedAt: number;
	lastAccessedAt: number;
	accessCount: number;
	sizeBytes: number;
}

// ===== Statistics Types =====

export interface CacheStatistics {
	totalRequests: number;
	cacheHits: number;
	cacheMisses: number;
	hitRate: number;
	avgLoadTimeMs: number;
	p95LoadTimeMs: number;
	cachedModels: number;
	totalEvictions: number;
	memoryUsageMB: number;
}

// ===== Model Load Result =====

interface ModelLoadResult {
	success: boolean;
	artifact?: any;
	loadTime: number;
	fromCache: boolean;
	error?: string;
}

/**
 * ModelCache Service
 * Manages in-memory caching of ML models with LRU eviction
 */
export class ModelCache {
	private static instance: ModelCache;
	private logger: Logger;
	private config: ModelCacheConfig;
	private cache: Map<string, ModelCacheEntry>;
	private loadTimes: number[];
	private statistics: {
		totalRequests: number;
		cacheHits: number;
		cacheMisses: number;
		totalEvictions: number;
		loadTimeSum: number;
	};

	private constructor(config?: Partial<ModelCacheConfig>) {
		this.logger = Logger.getInstance("ModelCache");
		this.config = {
			maxCachedModels: config?.maxCachedModels ?? 5,
			enableLRU: config?.enableLRU ?? true,
			maxLoadTimeMs: config?.maxLoadTimeMs ?? 50,
			enableMetrics: config?.enableMetrics ?? true,
			warmCacheOnStartup: config?.warmCacheOnStartup ?? false,
		};
		this.cache = new Map<string, ModelCacheEntry>();
		this.loadTimes = [];
		this.statistics = {
			totalRequests: 0,
			cacheHits: 0,
			cacheMisses: 0,
			totalEvictions: 0,
			loadTimeSum: 0,
		};

		this.logger.info("ModelCache initialized", {
			config: this.config,
		});
	}

	static getInstance(config?: Partial<ModelCacheConfig>): ModelCache {
		if (!ModelCache.instance) {
			ModelCache.instance = new ModelCache(config);
		}
		return ModelCache.instance;
	}

	// ===== Core Cache Operations =====

	/**
	 * Get model from cache or load from storage
	 * Primary method for retrieving models
	 *
	 * @param modelId - Unique identifier for the model
	 * @returns Model artifact or null if not found/failed
	 */
	async getModel(modelId: string): Promise<any | null> {
		const startTime = Date.now();
		this.statistics.totalRequests++;

		try {
			// Check if model is in cache
			if (this.cache.has(modelId)) {
				const entry = this.cache.get(modelId)!;

				// Update access metrics
				entry.lastAccessedAt = Date.now();
				entry.accessCount++;

				this.statistics.cacheHits++;
				const loadTime = Date.now() - startTime;
				this.recordLoadTime(loadTime);

				this.logger.debug("Model cache hit", {
					modelId,
					loadTime,
					accessCount: entry.accessCount,
				});

				return entry.artifact;
			}

			// Cache miss - load from storage
			this.statistics.cacheMisses++;
			this.logger.debug("Model cache miss", { modelId });

			const loadResult = await this.loadModelFromStorage(modelId);

			if (loadResult.success && loadResult.artifact) {
				// Add to cache
				await this.addToCache(modelId, loadResult.artifact, loadResult.loadTime);

				const totalLoadTime = Date.now() - startTime;
				this.recordLoadTime(totalLoadTime);

				this.logger.info("Model loaded and cached", {
					modelId,
					loadTime: totalLoadTime,
					storageLoadTime: loadResult.loadTime,
				});

				return loadResult.artifact;
			}

			this.logger.warn("Model load failed", {
				modelId,
				error: loadResult.error,
			});

			return null;
		} catch (error) {
			this.logger.error("Error getting model from cache", {
				modelId,
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return null;
		}
	}

	/**
	 * Explicitly load a model into cache
	 * Used for cache warming scenarios
	 *
	 * @param modelId - Unique identifier for the model
	 * @param artifact - The model artifact to cache
	 * @returns Success status
	 */
	async loadModel(modelId: string, artifact?: any): Promise<boolean> {
		const startTime = Date.now();

		try {
			// If artifact not provided, load from storage
			if (!artifact) {
				const loadResult = await this.loadModelFromStorage(modelId);

				if (!loadResult.success || !loadResult.artifact) {
					this.logger.warn("Failed to load model for caching", {
						modelId,
						error: loadResult.error,
					});
					return false;
				}

				artifact = loadResult.artifact;
			}

			// Add to cache
			const success = await this.addToCache(modelId, artifact, Date.now() - startTime);

			if (success) {
				this.logger.info("Model explicitly loaded into cache", {
					modelId,
					loadTime: Date.now() - startTime,
				});
			}

			return success;
		} catch (error) {
			this.logger.error("Error loading model into cache", {
				modelId,
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return false;
		}
	}

	/**
	 * Remove a specific model from cache
	 *
	 * @param modelId - Unique identifier for the model
	 * @returns True if model was cached and removed
	 */
	evictModel(modelId: string): boolean {
		try {
			const wasInCache = this.cache.has(modelId);

			if (wasInCache) {
				const entry = this.cache.get(modelId)!;
				this.cache.delete(modelId);

				this.logger.info("Model evicted from cache", {
					modelId,
					accessCount: entry.accessCount,
					ageMs: Date.now() - entry.loadedAt,
				});
			}

			return wasInCache;
		} catch (error) {
			this.logger.error("Error evicting model from cache", {
				modelId,
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return false;
		}
	}

	/**
	 * Pre-load specific models into cache
	 * Used for cache warming on startup or known access patterns
	 *
	 * @param modelIds - Array of model identifiers to warm
	 * @returns Number of models successfully warmed
	 */
	async warmCache(modelIds: string[]): Promise<number> {
		const startTime = Date.now();
		let successCount = 0;

		this.logger.info("Starting cache warming", {
			modelCount: modelIds.length,
		});

		try {
			const warmPromises = modelIds.map(async modelId => {
				const success = await this.loadModel(modelId);
				if (success) successCount++;
				return success;
			});

			await Promise.all(warmPromises);

			const duration = Date.now() - startTime;

			this.logger.info("Cache warming completed", {
				totalModels: modelIds.length,
				successCount,
				failureCount: modelIds.length - successCount,
				duration,
			});

			return successCount;
		} catch (error) {
			this.logger.error("Error during cache warming", {
				error: error instanceof Error ? error.message : "Unknown error",
				modelCount: modelIds.length,
			});
			return successCount;
		}
	}

	/**
	 * Clear all cached models
	 *
	 * @returns Number of models cleared
	 */
	clearCache(): number {
		try {
			const clearedCount = this.cache.size;
			this.cache.clear();

			this.logger.info("Cache cleared", {
				modelsCleared: clearedCount,
			});

			return clearedCount;
		} catch (error) {
			this.logger.error("Error clearing cache", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return 0;
		}
	}

	// ===== Statistics & Monitoring =====

	/**
	 * Get comprehensive cache performance statistics
	 *
	 * @returns Complete cache statistics
	 */
	getCacheStats(): CacheStatistics {
		const hitRate =
			this.statistics.totalRequests > 0
				? (this.statistics.cacheHits / this.statistics.totalRequests) * 100
				: 0;

		const avgLoadTimeMs =
			this.statistics.totalRequests > 0
				? this.statistics.loadTimeSum / this.statistics.totalRequests
				: 0;

		const p95LoadTimeMs = this.calculateP95LoadTime();
		const memoryUsageMB = this.estimateMemoryUsage();

		return {
			totalRequests: this.statistics.totalRequests,
			cacheHits: this.statistics.cacheHits,
			cacheMisses: this.statistics.cacheMisses,
			hitRate: Math.round(hitRate * 100) / 100,
			avgLoadTimeMs: Math.round(avgLoadTimeMs * 100) / 100,
			p95LoadTimeMs: Math.round(p95LoadTimeMs * 100) / 100,
			cachedModels: this.cache.size,
			totalEvictions: this.statistics.totalEvictions,
			memoryUsageMB: Math.round(memoryUsageMB * 100) / 100,
		};
	}

	/**
	 * Get load time for a specific model
	 *
	 * @param modelId - Unique identifier for the model
	 * @returns Load time in milliseconds or null if not cached
	 */
	getModelLoadTime(modelId: string): number | null {
		const entry = this.cache.get(modelId);
		if (!entry) return null;

		// Return time since loaded (age) as proxy for load time
		return Date.now() - entry.loadedAt;
	}

	/**
	 * Get detailed information about cached models
	 *
	 * @returns Array of model information
	 */
	getCachedModels(): Array<{
		modelId: string;
		modelName: string;
		modelVersion: string;
		accessCount: number;
		ageMs: number;
		sizeMB: number;
	}> {
		const models: Array<{
			modelId: string;
			modelName: string;
			modelVersion: string;
			accessCount: number;
			ageMs: number;
			sizeMB: number;
		}> = [];

		this.cache.forEach((entry, modelId) => {
			models.push({
				modelId,
				modelName: entry.modelName,
				modelVersion: entry.modelVersion,
				accessCount: entry.accessCount,
				ageMs: Date.now() - entry.loadedAt,
				sizeMB: Math.round((entry.sizeBytes / (1024 * 1024)) * 100) / 100,
			});
		});

		return models.sort((a, b) => b.accessCount - a.accessCount);
	}

	/**
	 * Reset cache statistics
	 */
	resetStats(): void {
		this.statistics = {
			totalRequests: 0,
			cacheHits: 0,
			cacheMisses: 0,
			totalEvictions: 0,
			loadTimeSum: 0,
		};
		this.loadTimes = [];

		this.logger.info("Cache statistics reset");
	}

	// ===== Private Helper Methods =====

	/**
	 * Add a model to the cache with LRU eviction if necessary
	 */
	private async addToCache(modelId: string, artifact: any, loadTime: number): Promise<boolean> {
		try {
			// Check if cache is full and eviction is needed
			if (this.cache.size >= this.config.maxCachedModels && this.config.enableLRU) {
				this.evictLRU();
			}

			// Estimate artifact size
			const sizeBytes = this.estimateArtifactSize(artifact);

			// Create cache entry
			const entry: ModelCacheEntry = {
				modelId,
				modelName: this.extractModelName(modelId),
				modelVersion: this.extractModelVersion(modelId),
				artifact,
				metadata: {
					loadTime,
					cacheTime: Date.now(),
				},
				loadedAt: Date.now(),
				lastAccessedAt: Date.now(),
				accessCount: 1,
				sizeBytes,
			};

			this.cache.set(modelId, entry);

			this.logger.debug("Model added to cache", {
				modelId,
				sizeKB: Math.round(sizeBytes / 1024),
				cacheSize: this.cache.size,
				maxCacheSize: this.config.maxCachedModels,
			});

			return true;
		} catch (error) {
			this.logger.error("Error adding model to cache", {
				modelId,
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return false;
		}
	}

	/**
	 * Evict least recently used model from cache
	 */
	private evictLRU(): void {
		try {
			let oldestModelId: string | null = null;
			let oldestEntry: ModelCacheEntry | null = null;
			let oldestAccessTime = Date.now();

			// Find least recently used entry
			this.cache.forEach((entry, modelId) => {
				if (entry.lastAccessedAt < oldestAccessTime) {
					oldestAccessTime = entry.lastAccessedAt;
					oldestModelId = modelId;
					oldestEntry = entry;
				}
			});

			if (oldestModelId && oldestEntry) {
				this.cache.delete(oldestModelId);
				this.statistics.totalEvictions++;

				this.logger.info("LRU eviction performed", {
					evictedModelId: oldestModelId,
					accessCount: (oldestEntry as ModelCacheEntry).accessCount,
					ageMs: Date.now() - (oldestEntry as ModelCacheEntry).loadedAt,
					idleMs: Date.now() - (oldestEntry as ModelCacheEntry).lastAccessedAt,
				});
			}
		} catch (error) {
			this.logger.error("Error during LRU eviction", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	/**
	 * Load model from storage (integration point for ModelRegistry)
	 * Currently returns a placeholder - will integrate with ModelRegistry.getModelArtifact()
	 */
	private async loadModelFromStorage(modelId: string): Promise<ModelLoadResult> {
		const startTime = Date.now();

		try {
			// TODO: Integration point for ModelRegistry.getModelArtifact()
			// For now, return a placeholder indicating storage load would happen here

			this.logger.debug("Loading model from storage", { modelId });

			// Simulate storage load (replace with actual ModelRegistry integration)
			const artifact = {
				modelId,
				type: "placeholder",
				loaded: true,
				timestamp: Date.now(),
			};

			const loadTime = Date.now() - startTime;

			return {
				success: true,
				artifact,
				loadTime,
				fromCache: false,
			};
		} catch (error) {
			return {
				success: false,
				loadTime: Date.now() - startTime,
				fromCache: false,
				error: error instanceof Error ? error.message : "Unknown storage error",
			};
		}
	}

	/**
	 * Estimate the size of a model artifact in bytes
	 */
	private estimateArtifactSize(artifact: any): number {
		try {
			// Simple estimation based on JSON serialization
			const serialized = JSON.stringify(artifact);
			return serialized.length * 2; // Rough estimate (UTF-16 encoding)
		} catch {
			// If serialization fails, use rough estimate
			return 1024 * 1024; // 1MB default estimate
		}
	}

	/**
	 * Extract model name from modelId
	 */
	private extractModelName(modelId: string): string {
		// Expected format: modelType_horizon_version (e.g., "lightgbm_1d_v1.0")
		const parts = modelId.split("_");
		return parts[0] || modelId;
	}

	/**
	 * Extract model version from modelId
	 */
	private extractModelVersion(modelId: string): string {
		// Expected format: modelType_horizon_version (e.g., "lightgbm_1d_v1.0")
		const parts = modelId.split("_");
		return parts[2] || "v1.0";
	}

	/**
	 * Record a load time measurement
	 */
	private recordLoadTime(loadTime: number): void {
		if (!this.config.enableMetrics) return;

		this.loadTimes.push(loadTime);
		this.statistics.loadTimeSum += loadTime;

		// Keep only last 1000 measurements for P95 calculation
		if (this.loadTimes.length > 1000) {
			this.loadTimes.shift();
		}

		// Warn if load time exceeds threshold
		if (loadTime > this.config.maxLoadTimeMs) {
			this.logger.warn("Model load time exceeded threshold", {
				loadTime,
				threshold: this.config.maxLoadTimeMs,
			});
		}
	}

	/**
	 * Calculate 95th percentile load time
	 */
	private calculateP95LoadTime(): number {
		if (this.loadTimes.length === 0) return 0;

		const sorted = [...this.loadTimes].sort((a, b) => a - b);
		const index = Math.floor(sorted.length * 0.95);
		return sorted[index] || 0;
	}

	/**
	 * Estimate total memory usage of cached models
	 */
	private estimateMemoryUsage(): number {
		let totalBytes = 0;

		this.cache.forEach(entry => {
			totalBytes += entry.sizeBytes;
		});

		return totalBytes / (1024 * 1024); // Convert to MB
	}

	/**
	 * Health check for the cache
	 */
	async healthCheck(): Promise<{
		healthy: boolean;
		stats: CacheStatistics;
		issues: string[];
	}> {
		const stats = this.getCacheStats();
		const issues: string[] = [];

		// Check if average load time is within acceptable range
		if (stats.avgLoadTimeMs > this.config.maxLoadTimeMs) {
			issues.push(
				`Average load time (${stats.avgLoadTimeMs}ms) exceeds threshold (${this.config.maxLoadTimeMs}ms)`
			);
		}

		// Check if P95 load time is within acceptable range (allow 2x threshold)
		if (stats.p95LoadTimeMs > this.config.maxLoadTimeMs * 2) {
			issues.push(
				`P95 load time (${stats.p95LoadTimeMs}ms) exceeds threshold (${this.config.maxLoadTimeMs * 2}ms)`
			);
		}

		// Check memory usage
		if (stats.memoryUsageMB > 500) {
			// 500MB warning threshold
			issues.push(`Memory usage (${stats.memoryUsageMB}MB) is high`);
		}

		const healthy = issues.length === 0;

		this.logger.info("Cache health check completed", {
			healthy,
			issueCount: issues.length,
			stats,
		});

		return {
			healthy,
			stats,
			issues,
		};
	}
}

// Export singleton instance
export const modelCache = ModelCache.getInstance();
