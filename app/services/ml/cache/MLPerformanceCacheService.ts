/**
 * ML Performance Cache Service for VFR Machine Learning Enhancement Layer
 * Specialized caching for ML performance metrics, monitoring, and telemetry
 *
 * Features:
 * - Model performance metrics caching
 * - Inference latency tracking
 * - Cache hit rate monitoring
 * - Model drift detection metrics
 * - Real-time performance telemetry
 * - Historical performance trends
 */

import { RedisCache } from '../../cache/RedisCache'
import ErrorHandler from '../../error-handling/ErrorHandler'
import { ML_CACHE_TTL, ML_CACHE_KEYS } from './MLCacheService'

// Performance-specific cache keys
const PERF_CACHE_KEYS = {
  MODEL_PERFORMANCE: 'vfr:ml:perf:model',
  INFERENCE_LATENCY: 'vfr:ml:perf:latency',
  CACHE_METRICS: 'vfr:ml:perf:cache',
  DRIFT_METRICS: 'vfr:ml:perf:drift',
  PREDICTION_ACCURACY: 'vfr:ml:perf:accuracy',
  RESOURCE_USAGE: 'vfr:ml:perf:resources'
} as const

export interface ModelPerformanceMetrics {
  modelId: string
  modelVersion: string
  timestamp: number
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  sharpeRatio: number
  predictionCount: number
  averageLatency: number
  errorRate: number
}

export interface InferenceLatencyMetrics {
  modelId: string
  timestamp: number
  p50: number
  p95: number
  p99: number
  average: number
  min: number
  max: number
  sampleCount: number
}

export interface CachePerformanceMetrics {
  timestamp: number
  predictionHitRate: number
  featureHitRate: number
  modelHitRate: number
  overallHitRate: number
  averageLatency: number
  compressionRatio: number
  memoryUsage: number
}

export interface DriftMetrics {
  modelId: string
  timestamp: number
  featureDrift: number
  conceptDrift: number
  predictionDrift: number
  driftScore: number
  alertThreshold: number
  requiresRetraining: boolean
}

export interface PredictionAccuracyMetrics {
  modelId: string
  horizon: string
  timestamp: number
  directionAccuracy: number
  magnitudeError: number
  totalPredictions: number
  correctDirections: number
  averageError: number
}

export interface ResourceUsageMetrics {
  timestamp: number
  cpuUsage: number
  memoryUsage: number
  cacheSize: number
  modelCacheSize: number
  featureCacheSize: number
  activeModels: number
}

export class MLPerformanceCacheService {
  private static instance: MLPerformanceCacheService
  private redisCache: RedisCache

  private constructor() {
    this.redisCache = RedisCache.getInstance()
  }

  static getInstance(): MLPerformanceCacheService {
    if (!MLPerformanceCacheService.instance) {
      MLPerformanceCacheService.instance = new MLPerformanceCacheService()
    }
    return MLPerformanceCacheService.instance
  }

  // ===== Model Performance Metrics =====

  /**
   * Cache model performance metrics
   */
  async cacheModelPerformance(metrics: ModelPerformanceMetrics): Promise<boolean> {
    try {
      const key = `${PERF_CACHE_KEYS.MODEL_PERFORMANCE}:${metrics.modelId}:${metrics.modelVersion}`
      await this.redisCache.set(
        key,
        metrics,
        ML_CACHE_TTL.PERFORMANCE_METRICS,
        { source: 'ml-performance-tracker', version: metrics.modelVersion }
      )
      return true
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.cacheModelPerformance',
        modelId: metrics.modelId
      })
      return false
    }
  }

  /**
   * Get cached model performance metrics
   */
  async getModelPerformance(
    modelId: string,
    modelVersion: string
  ): Promise<ModelPerformanceMetrics | null> {
    try {
      const key = `${PERF_CACHE_KEYS.MODEL_PERFORMANCE}:${modelId}:${modelVersion}`
      return await this.redisCache.get<ModelPerformanceMetrics>(key)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.getModelPerformance',
        modelId
      })
      return null
    }
  }

  /**
   * Batch cache model performance metrics for multiple models
   */
  async batchCacheModelPerformance(metrics: ModelPerformanceMetrics[]): Promise<number> {
    let successCount = 0

    try {
      const cachePromises = metrics.map(metric => this.cacheModelPerformance(metric))
      const results = await Promise.all(cachePromises)
      successCount = results.filter(r => r).length
      return successCount
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.batchCacheModelPerformance',
        count: metrics.length
      })
      return successCount
    }
  }

  // ===== Inference Latency Metrics =====

  /**
   * Cache inference latency metrics
   */
  async cacheInferenceLatency(metrics: InferenceLatencyMetrics): Promise<boolean> {
    try {
      const key = `${PERF_CACHE_KEYS.INFERENCE_LATENCY}:${metrics.modelId}:latest`
      await this.redisCache.set(
        key,
        metrics,
        ML_CACHE_TTL.PERFORMANCE_METRICS,
        { source: 'ml-inference-tracker', version: '1.0' }
      )
      return true
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.cacheInferenceLatency',
        modelId: metrics.modelId
      })
      return false
    }
  }

  /**
   * Get cached inference latency metrics
   */
  async getInferenceLatency(modelId: string): Promise<InferenceLatencyMetrics | null> {
    try {
      const key = `${PERF_CACHE_KEYS.INFERENCE_LATENCY}:${modelId}:latest`
      return await this.redisCache.get<InferenceLatencyMetrics>(key)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.getInferenceLatency',
        modelId
      })
      return null
    }
  }

  // ===== Cache Performance Metrics =====

  /**
   * Cache overall cache performance metrics
   */
  async cacheCachePerformance(metrics: CachePerformanceMetrics): Promise<boolean> {
    try {
      const key = `${PERF_CACHE_KEYS.CACHE_METRICS}:current`
      await this.redisCache.set(
        key,
        metrics,
        ML_CACHE_TTL.PERFORMANCE_METRICS,
        { source: 'ml-cache-monitor', version: '1.0' }
      )
      return true
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.cacheCachePerformance'
      })
      return false
    }
  }

  /**
   * Get cached cache performance metrics
   */
  async getCachePerformance(): Promise<CachePerformanceMetrics | null> {
    try {
      const key = `${PERF_CACHE_KEYS.CACHE_METRICS}:current`
      return await this.redisCache.get<CachePerformanceMetrics>(key)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.getCachePerformance'
      })
      return null
    }
  }

  // ===== Drift Detection Metrics =====

  /**
   * Cache model drift metrics
   */
  async cacheDriftMetrics(metrics: DriftMetrics): Promise<boolean> {
    try {
      const key = `${PERF_CACHE_KEYS.DRIFT_METRICS}:${metrics.modelId}:latest`
      await this.redisCache.set(
        key,
        metrics,
        ML_CACHE_TTL.PERFORMANCE_METRICS,
        { source: 'ml-drift-detector', version: '1.0' }
      )

      // If drift requires retraining, cache alert
      if (metrics.requiresRetraining) {
        const alertKey = `${PERF_CACHE_KEYS.DRIFT_METRICS}:${metrics.modelId}:alert`
        await this.redisCache.set(
          alertKey,
          { modelId: metrics.modelId, driftScore: metrics.driftScore, timestamp: metrics.timestamp },
          ML_CACHE_TTL.ENHANCEMENT_STATUS,
          { source: 'ml-drift-alert', version: '1.0' }
        )
      }

      return true
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.cacheDriftMetrics',
        modelId: metrics.modelId
      })
      return false
    }
  }

  /**
   * Get cached drift metrics
   */
  async getDriftMetrics(modelId: string): Promise<DriftMetrics | null> {
    try {
      const key = `${PERF_CACHE_KEYS.DRIFT_METRICS}:${modelId}:latest`
      return await this.redisCache.get<DriftMetrics>(key)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.getDriftMetrics',
        modelId
      })
      return null
    }
  }

  /**
   * Check if model has drift alert
   */
  async hasDriftAlert(modelId: string): Promise<boolean> {
    try {
      const alertKey = `${PERF_CACHE_KEYS.DRIFT_METRICS}:${modelId}:alert`
      const alert = await this.redisCache.get(alertKey)
      return alert !== null
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.hasDriftAlert',
        modelId
      })
      return false
    }
  }

  // ===== Prediction Accuracy Metrics =====

  /**
   * Cache prediction accuracy metrics
   */
  async cachePredictionAccuracy(metrics: PredictionAccuracyMetrics): Promise<boolean> {
    try {
      const key = `${PERF_CACHE_KEYS.PREDICTION_ACCURACY}:${metrics.modelId}:${metrics.horizon}`
      await this.redisCache.set(
        key,
        metrics,
        ML_CACHE_TTL.PERFORMANCE_METRICS,
        { source: 'ml-accuracy-tracker', version: '1.0' }
      )
      return true
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.cachePredictionAccuracy',
        modelId: metrics.modelId
      })
      return false
    }
  }

  /**
   * Get cached prediction accuracy metrics
   */
  async getPredictionAccuracy(
    modelId: string,
    horizon: string
  ): Promise<PredictionAccuracyMetrics | null> {
    try {
      const key = `${PERF_CACHE_KEYS.PREDICTION_ACCURACY}:${modelId}:${horizon}`
      return await this.redisCache.get<PredictionAccuracyMetrics>(key)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.getPredictionAccuracy',
        modelId,
        horizon
      })
      return null
    }
  }

  // ===== Resource Usage Metrics =====

  /**
   * Cache resource usage metrics
   */
  async cacheResourceUsage(metrics: ResourceUsageMetrics): Promise<boolean> {
    try {
      const key = `${PERF_CACHE_KEYS.RESOURCE_USAGE}:current`
      await this.redisCache.set(
        key,
        metrics,
        ML_CACHE_TTL.PERFORMANCE_METRICS,
        { source: 'ml-resource-monitor', version: '1.0' }
      )
      return true
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.cacheResourceUsage'
      })
      return false
    }
  }

  /**
   * Get cached resource usage metrics
   */
  async getResourceUsage(): Promise<ResourceUsageMetrics | null> {
    try {
      const key = `${PERF_CACHE_KEYS.RESOURCE_USAGE}:current`
      return await this.redisCache.get<ResourceUsageMetrics>(key)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.getResourceUsage'
      })
      return null
    }
  }

  // ===== Aggregated Performance Metrics =====

  /**
   * Get comprehensive performance overview
   */
  async getPerformanceOverview(modelId: string): Promise<{
    performance: ModelPerformanceMetrics | null
    latency: InferenceLatencyMetrics | null
    drift: DriftMetrics | null
    accuracy: Record<string, PredictionAccuracyMetrics | null>
  }> {
    try {
      const horizons = ['1h', '4h', '1d', '1w', '1m']

      const [performance, latency, drift, ...accuracyResults] = await Promise.all([
        this.getModelPerformance(modelId, 'latest'),
        this.getInferenceLatency(modelId),
        this.getDriftMetrics(modelId),
        ...horizons.map(h => this.getPredictionAccuracy(modelId, h))
      ])

      const accuracy: Record<string, PredictionAccuracyMetrics | null> = {}
      horizons.forEach((horizon, index) => {
        accuracy[horizon] = accuracyResults[index]
      })

      return { performance, latency, drift, accuracy }
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.getPerformanceOverview',
        modelId
      })
      return {
        performance: null,
        latency: null,
        drift: null,
        accuracy: {}
      }
    }
  }

  /**
   * Get system-wide performance metrics
   */
  async getSystemPerformance(): Promise<{
    cache: CachePerformanceMetrics | null
    resources: ResourceUsageMetrics | null
  }> {
    try {
      const [cache, resources] = await Promise.all([
        this.getCachePerformance(),
        this.getResourceUsage()
      ])

      return { cache, resources }
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.getSystemPerformance'
      })
      return {
        cache: null,
        resources: null
      }
    }
  }

  // ===== Cache Management =====

  /**
   * Invalidate all performance metrics for a model
   */
  async invalidateModelMetrics(modelId: string): Promise<number> {
    try {
      const patterns = [
        `${PERF_CACHE_KEYS.MODEL_PERFORMANCE}:${modelId}:*`,
        `${PERF_CACHE_KEYS.INFERENCE_LATENCY}:${modelId}:*`,
        `${PERF_CACHE_KEYS.DRIFT_METRICS}:${modelId}:*`,
        `${PERF_CACHE_KEYS.PREDICTION_ACCURACY}:${modelId}:*`
      ]

      const results = await Promise.all(
        patterns.map(pattern => this.redisCache.invalidatePattern(pattern))
      )

      return results.reduce((sum, count) => sum + count, 0)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.invalidateModelMetrics',
        modelId
      })
      return 0
    }
  }

  /**
   * Invalidate all performance metrics
   */
  async invalidateAllMetrics(): Promise<number> {
    try {
      const pattern = 'vfr:ml:perf:*'
      return await this.redisCache.invalidatePattern(pattern)
    } catch (error) {
      console.error("ML cache error:", error, {
        context: 'MLPerformanceCacheService.invalidateAllMetrics'
      })
      return 0
    }
  }

  /**
   * Health check for performance cache
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const startTime = Date.now()

    try {
      await this.redisCache.ping()
      return {
        healthy: true,
        latency: Date.now() - startTime
      }
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime
      }
    }
  }
}

// Export singleton instance
export const mlPerformanceCacheService = MLPerformanceCacheService.getInstance()
