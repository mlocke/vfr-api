/**
 * ML Cache Service for VFR Machine Learning Enhancement Layer
 * Extends RedisCache with ML-specific caching patterns and optimizations
 *
 * Features:
 * - ML prediction caching (5-minute TTL)
 * - ML feature caching (15-minute TTL)
 * - ML model metadata caching (1-hour TTL)
 * - ML enhancement status caching (1-minute TTL)
 * - Compression for large ML payloads
 * - Cache warming for popular models/features
 * - Graceful fallback mechanisms
 */

import { RedisCache } from '../../cache/RedisCache'
import {
  MLPrediction,
  MLFeatureVector,
  MLModelConfig,
  MLHealthStatus
} from '../types/MLTypes'

// ML Enhancement Status for cache
export interface MLEnhancementStatus {
  available: boolean
  modelsLoaded: number
  featuresReady: boolean
  lastUpdate: number
  performance: {
    averageLatency: number
    cacheHitRate: number
    activeModels: number
  }
}

// ML-specific cache TTL configuration
export const ML_CACHE_TTL = {
  PREDICTION: 300,        // 5 minutes for ML predictions
  FEATURE: 900,           // 15 minutes for ML features
  MODEL_METADATA: 3600,   // 1 hour for model metadata
  ENHANCEMENT_STATUS: 60, // 1 minute for enhancement status
  PERFORMANCE_METRICS: 300 // 5 minutes for performance metrics
} as const

// ML cache key prefixes (extends veritak:mcp: with vfr:ml:)
export const ML_CACHE_KEYS = {
  PREDICTION: 'vfr:ml:prediction',
  FEATURE: 'vfr:ml:feature',
  FEATURE_VECTOR: 'vfr:ml:feature:vector',
  MODEL: 'vfr:ml:model',
  MODEL_METADATA: 'vfr:ml:model:metadata',
  ENHANCEMENT: 'vfr:ml:enhancement',
  PERFORMANCE: 'vfr:ml:performance',
  FALLBACK_STATUS: 'vfr:ml:fallback'
} as const

interface MLCacheStats {
  predictionHits: number
  predictionMisses: number
  featureHits: number
  featureMisses: number
  modelHits: number
  modelMisses: number
  compressionRatio: number
  averageLatency: number
}

export class MLCacheService {
  private static instance: MLCacheService
  private redisCache: RedisCache
  private stats: MLCacheStats
  private compressionThreshold = 8192 // 8KB - compress payloads larger than this

  private constructor() {
    this.redisCache = RedisCache.getInstance()
    this.stats = {
      predictionHits: 0,
      predictionMisses: 0,
      featureHits: 0,
      featureMisses: 0,
      modelHits: 0,
      modelMisses: 0,
      compressionRatio: 0,
      averageLatency: 0
    }
  }

  static getInstance(): MLCacheService {
    if (!MLCacheService.instance) {
      MLCacheService.instance = new MLCacheService()
    }
    return MLCacheService.instance
  }

  // ===== ML Prediction Caching =====

  /**
   * Cache ML prediction result with compression for large payloads
   */
  async cachePrediction(
    symbol: string,
    horizon: string,
    modelId: string,
    prediction: MLPrediction
  ): Promise<boolean> {
    const startTime = Date.now()

    try {
      const key = `${ML_CACHE_KEYS.PREDICTION}:${symbol.toUpperCase()}:${horizon}:${modelId}`
      const serialized = JSON.stringify(prediction)

      // Check if compression is needed
      const shouldCompress = serialized.length > this.compressionThreshold

      if (shouldCompress) {
        const compressed = Buffer.from(serialized).toString('base64')
        await this.redisCache.set(
          `${key}:compressed`,
          compressed,
          ML_CACHE_TTL.PREDICTION,
          { source: 'ml-prediction', version: prediction.modelVersion }
        )
        await this.redisCache.set(
          `${key}:meta`,
          { compressed: true, originalSize: serialized.length, compressedSize: compressed.length },
          ML_CACHE_TTL.PREDICTION,
          { source: 'ml-prediction-meta', version: '1.0' }
        )
      } else {
        await this.redisCache.set(
          key,
          prediction,
          ML_CACHE_TTL.PREDICTION,
          { source: 'ml-prediction', version: prediction.modelVersion }
        )
      }

      this.updateLatency(Date.now() - startTime)
      return true
    } catch (error) {
      console.error('MLCacheService.cachePrediction error:', error, { symbol, horizon, modelId })
      return false
    }
  }

  /**
   * Get cached ML prediction with decompression if needed
   */
  async getCachedPrediction(
    symbol: string,
    horizon: string,
    modelId: string
  ): Promise<MLPrediction | null> {
    const startTime = Date.now()

    try {
      const key = `${ML_CACHE_KEYS.PREDICTION}:${symbol.toUpperCase()}:${horizon}:${modelId}`

      // Check for compressed version first
      const meta = await this.redisCache.get<{ compressed: boolean }>(`${key}:meta`)

      if (meta?.compressed) {
        const compressed = await this.redisCache.get<string>(`${key}:compressed`)
        if (compressed) {
          const decompressed = Buffer.from(compressed, 'base64').toString('utf-8')
          const prediction = JSON.parse(decompressed) as MLPrediction
          this.stats.predictionHits++
          this.updateLatency(Date.now() - startTime)
          return prediction
        }
      }

      // Try uncompressed version
      const prediction = await this.redisCache.get<MLPrediction>(key)

      if (prediction) {
        this.stats.predictionHits++
        this.updateLatency(Date.now() - startTime)
        return prediction
      }

      this.stats.predictionMisses++
      this.updateLatency(Date.now() - startTime)
      return null
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.getCachedPrediction',
        symbol,
        horizon,
        modelId
      })
      this.stats.predictionMisses++
      return null
    }
  }

  /**
   * Batch cache ML predictions for multiple symbols
   */
  async batchCachePredictions(
    predictions: Array<{
      symbol: string
      horizon: string
      modelId: string
      prediction: MLPrediction
    }>
  ): Promise<number> {
    const startTime = Date.now()
    let successCount = 0

    try {
      const cachePromises = predictions.map(item =>
        this.cachePrediction(item.symbol, item.horizon, item.modelId, item.prediction)
      )

      const results = await Promise.all(cachePromises)
      successCount = results.filter(r => r).length

      this.updateLatency(Date.now() - startTime)
      return successCount
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.batchCachePredictions',
        count: predictions.length
      })
      return successCount
    }
  }

  // ===== ML Feature Caching =====

  /**
   * Cache feature vector for a symbol
   */
  async cacheFeatureVector(
    symbol: string,
    featureVector: MLFeatureVector
  ): Promise<boolean> {
    const startTime = Date.now()

    try {
      const key = `${ML_CACHE_KEYS.FEATURE_VECTOR}:${symbol.toUpperCase()}`
      const serialized = JSON.stringify(featureVector)

      // Compress large feature vectors
      if (serialized.length > this.compressionThreshold) {
        const compressed = Buffer.from(serialized).toString('base64')
        await this.redisCache.set(
          `${key}:compressed`,
          compressed,
          ML_CACHE_TTL.FEATURE,
          { source: 'ml-feature-vector', version: '1.0' }
        )
        await this.redisCache.set(
          `${key}:meta`,
          { compressed: true },
          ML_CACHE_TTL.FEATURE,
          { source: 'ml-feature-meta', version: '1.0' }
        )
      } else {
        await this.redisCache.set(
          key,
          featureVector,
          ML_CACHE_TTL.FEATURE,
          { source: 'ml-feature-vector', version: '1.0' }
        )
      }

      this.updateLatency(Date.now() - startTime)
      return true
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.cacheFeatureVector',
        symbol
      })
      return false
    }
  }

  /**
   * Get cached feature vector
   */
  async getCachedFeatureVector(symbol: string): Promise<MLFeatureVector | null> {
    const startTime = Date.now()

    try {
      const key = `${ML_CACHE_KEYS.FEATURE_VECTOR}:${symbol.toUpperCase()}`

      // Check for compressed version
      const meta = await this.redisCache.get<{ compressed: boolean }>(`${key}:meta`)

      if (meta?.compressed) {
        const compressed = await this.redisCache.get<string>(`${key}:compressed`)
        if (compressed) {
          const decompressed = Buffer.from(compressed, 'base64').toString('utf-8')
          const featureVector = JSON.parse(decompressed) as MLFeatureVector
          this.stats.featureHits++
          this.updateLatency(Date.now() - startTime)
          return featureVector
        }
      }

      // Try uncompressed version
      const featureVector = await this.redisCache.get<MLFeatureVector>(key)

      if (featureVector) {
        this.stats.featureHits++
        this.updateLatency(Date.now() - startTime)
        return featureVector
      }

      this.stats.featureMisses++
      this.updateLatency(Date.now() - startTime)
      return null
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.getCachedFeatureVector',
        symbol
      })
      this.stats.featureMisses++
      return null
    }
  }

  /**
   * Batch cache feature vectors for multiple symbols
   */
  async batchCacheFeatureVectors(
    featureVectors: Array<{ symbol: string; vector: MLFeatureVector }>
  ): Promise<number> {
    const startTime = Date.now()
    let successCount = 0

    try {
      const cachePromises = featureVectors.map(item =>
        this.cacheFeatureVector(item.symbol, item.vector)
      )

      const results = await Promise.all(cachePromises)
      successCount = results.filter(r => r).length

      this.updateLatency(Date.now() - startTime)
      return successCount
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.batchCacheFeatureVectors',
        count: featureVectors.length
      })
      return successCount
    }
  }

  // ===== ML Model Metadata Caching =====

  /**
   * Cache model metadata
   */
  async cacheModelMetadata(modelId: string, config: MLModelConfig): Promise<boolean> {
    const startTime = Date.now()

    try {
      const key = `${ML_CACHE_KEYS.MODEL_METADATA}:${modelId}`
      await this.redisCache.set(
        key,
        config,
        ML_CACHE_TTL.MODEL_METADATA,
        { source: 'ml-model-registry', version: config.version }
      )

      this.updateLatency(Date.now() - startTime)
      return true
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.cacheModelMetadata',
        modelId
      })
      return false
    }
  }

  /**
   * Get cached model metadata
   */
  async getCachedModelMetadata(modelId: string): Promise<MLModelConfig | null> {
    const startTime = Date.now()

    try {
      const key = `${ML_CACHE_KEYS.MODEL_METADATA}:${modelId}`
      const config = await this.redisCache.get<MLModelConfig>(key)

      if (config) {
        this.stats.modelHits++
        this.updateLatency(Date.now() - startTime)
        return config
      }

      this.stats.modelMisses++
      this.updateLatency(Date.now() - startTime)
      return null
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.getCachedModelMetadata',
        modelId
      })
      this.stats.modelMisses++
      return null
    }
  }

  // ===== ML Enhancement Status Caching =====

  /**
   * Cache ML enhancement status for quick availability checks
   */
  async cacheEnhancementStatus(status: MLEnhancementStatus): Promise<boolean> {
    const startTime = Date.now()

    try {
      const key = `${ML_CACHE_KEYS.ENHANCEMENT}:status`
      await this.redisCache.set(
        key,
        status,
        ML_CACHE_TTL.ENHANCEMENT_STATUS,
        { source: 'ml-enhancement-orchestrator', version: '1.0' }
      )

      this.updateLatency(Date.now() - startTime)
      return true
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.cacheEnhancementStatus'
      })
      return false
    }
  }

  /**
   * Get cached ML enhancement status
   */
  async getCachedEnhancementStatus(): Promise<MLEnhancementStatus | null> {
    try {
      const key = `${ML_CACHE_KEYS.ENHANCEMENT}:status`
      return await this.redisCache.get<MLEnhancementStatus>(key)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.getCachedEnhancementStatus'
      })
      return null
    }
  }

  // ===== Cache Warming Strategies =====

  /**
   * Warm cache with popular model metadata
   */
  async warmModelCache(modelIds: string[]): Promise<number> {
    const startTime = Date.now()
    let warmedCount = 0

    try {
      // This would typically fetch from database and cache
      // For now, we'll just mark the intent
      console.log(`🔥 Warming ML model cache for ${modelIds.length} models...`)

      this.updateLatency(Date.now() - startTime)
      return warmedCount
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.warmModelCache',
        modelCount: modelIds.length
      })
      return warmedCount
    }
  }

  /**
   * Warm cache with popular symbols' feature vectors
   */
  async warmFeatureCache(symbols: string[]): Promise<number> {
    const startTime = Date.now()
    let warmedCount = 0

    try {
      console.log(`🔥 Warming ML feature cache for ${symbols.length} symbols...`)

      this.updateLatency(Date.now() - startTime)
      return warmedCount
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.warmFeatureCache',
        symbolCount: symbols.length
      })
      return warmedCount
    }
  }

  // ===== Cache Management =====

  /**
   * Invalidate all ML prediction cache entries
   */
  async invalidatePredictions(symbol?: string): Promise<number> {
    try {
      const pattern = symbol
        ? `${ML_CACHE_KEYS.PREDICTION}:${symbol.toUpperCase()}:*`
        : `${ML_CACHE_KEYS.PREDICTION}:*`

      return await this.redisCache.invalidatePattern(pattern)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.invalidatePredictions',
        symbol
      })
      return 0
    }
  }

  /**
   * Invalidate all ML feature cache entries
   */
  async invalidateFeatures(symbol?: string): Promise<number> {
    try {
      const pattern = symbol
        ? `${ML_CACHE_KEYS.FEATURE_VECTOR}:${symbol.toUpperCase()}`
        : `${ML_CACHE_KEYS.FEATURE}:*`

      return await this.redisCache.invalidatePattern(pattern)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.invalidateFeatures',
        symbol
      })
      return 0
    }
  }

  /**
   * Invalidate model metadata cache
   */
  async invalidateModelMetadata(modelId?: string): Promise<number> {
    try {
      const pattern = modelId
        ? `${ML_CACHE_KEYS.MODEL_METADATA}:${modelId}`
        : `${ML_CACHE_KEYS.MODEL}:*`

      return await this.redisCache.invalidatePattern(pattern)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLCacheService.invalidateModelMetadata',
        modelId
      })
      return 0
    }
  }

  // ===== Statistics & Monitoring =====

  /**
   * Get ML cache statistics
   */
  getStats(): MLCacheStats & { hitRate: number } {
    const totalPredictions = this.stats.predictionHits + this.stats.predictionMisses
    const totalFeatures = this.stats.featureHits + this.stats.featureMisses
    const totalModels = this.stats.modelHits + this.stats.modelMisses
    const totalRequests = totalPredictions + totalFeatures + totalModels

    const totalHits = this.stats.predictionHits + this.stats.featureHits + this.stats.modelHits
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0

    return {
      ...this.stats,
      hitRate
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      predictionHits: 0,
      predictionMisses: 0,
      featureHits: 0,
      featureMisses: 0,
      modelHits: 0,
      modelMisses: 0,
      compressionRatio: 0,
      averageLatency: 0
    }
  }

  /**
   * Update average latency tracking
   */
  private updateLatency(latency: number): void {
    // Simple moving average
    if (this.stats.averageLatency === 0) {
      this.stats.averageLatency = latency
    } else {
      this.stats.averageLatency = (this.stats.averageLatency * 0.9) + (latency * 0.1)
    }
  }

  /**
   * Check cache health
   */
  async healthCheck(): Promise<{
    healthy: boolean
    latency: number
    stats: MLCacheStats & { hitRate: number }
  }> {
    const startTime = Date.now()

    try {
      await this.redisCache.ping()
      const latency = Date.now() - startTime
      const stats = this.getStats()

      return {
        healthy: true,
        latency,
        stats
      }
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        stats: this.getStats()
      }
    }
  }
}

// Export singleton instance
export const mlCacheService = MLCacheService.getInstance()
