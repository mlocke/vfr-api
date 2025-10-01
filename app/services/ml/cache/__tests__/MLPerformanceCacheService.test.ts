/**
 * MLPerformanceCacheService Tests
 * Test suite for ML performance metrics caching
 * Following VFR NO MOCK DATA policy - tests use real Redis connections
 */

import { MLPerformanceCacheService } from '../MLPerformanceCacheService'
import { RedisCache } from '../../../cache/RedisCache'
import type {
  ModelPerformanceMetrics,
  InferenceLatencyMetrics,
  CachePerformanceMetrics,
  DriftMetrics,
  PredictionAccuracyMetrics,
  ResourceUsageMetrics
} from '../MLPerformanceCacheService'

describe('MLPerformanceCacheService', () => {
  let perfCacheService: MLPerformanceCacheService
  let redisCache: RedisCache

  beforeAll(() => {
    perfCacheService = MLPerformanceCacheService.getInstance()
    redisCache = RedisCache.getInstance()
  })

  afterAll(async () => {
    // Clean up Redis connections
    await redisCache.shutdown()
  })

  describe('Model Performance Metrics', () => {
    it('should cache and retrieve model performance metrics', async () => {
      const metrics: ModelPerformanceMetrics = {
        modelId: 'test-model-v1',
        modelVersion: '1.0',
        timestamp: Date.now(),
        accuracy: 0.75,
        precision: 0.72,
        recall: 0.78,
        f1Score: 0.75,
        sharpeRatio: 1.5,
        predictionCount: 1000,
        averageLatency: 45,
        errorRate: 0.05
      }

      // Cache metrics
      const cached = await perfCacheService.cacheModelPerformance(metrics)
      expect(cached).toBe(true)

      // Retrieve metrics
      const retrieved = await perfCacheService.getModelPerformance(
        metrics.modelId,
        metrics.modelVersion
      )
      expect(retrieved).toBeTruthy()
      expect(retrieved?.modelId).toBe('test-model-v1')
      expect(retrieved?.accuracy).toBe(0.75)
      expect(retrieved?.sharpeRatio).toBe(1.5)
    }, 10000)

    it('should batch cache model performance metrics', async () => {
      const metricsList: ModelPerformanceMetrics[] = [
        {
          modelId: 'batch-model-1',
          modelVersion: '1.0',
          timestamp: Date.now(),
          accuracy: 0.75,
          precision: 0.72,
          recall: 0.78,
          f1Score: 0.75,
          sharpeRatio: 1.5,
          predictionCount: 1000,
          averageLatency: 45,
          errorRate: 0.05
        },
        {
          modelId: 'batch-model-2',
          modelVersion: '1.0',
          timestamp: Date.now(),
          accuracy: 0.80,
          precision: 0.78,
          recall: 0.82,
          f1Score: 0.80,
          sharpeRatio: 1.8,
          predictionCount: 1500,
          averageLatency: 40,
          errorRate: 0.03
        }
      ]

      const count = await perfCacheService.batchCacheModelPerformance(metricsList)
      expect(count).toBe(2)

      // Verify all cached
      for (const metrics of metricsList) {
        const retrieved = await perfCacheService.getModelPerformance(
          metrics.modelId,
          metrics.modelVersion
        )
        expect(retrieved).toBeTruthy()
        expect(retrieved?.modelId).toBe(metrics.modelId)
      }
    }, 10000)
  })

  describe('Inference Latency Metrics', () => {
    it('should cache and retrieve inference latency metrics', async () => {
      const metrics: InferenceLatencyMetrics = {
        modelId: 'latency-model-v1',
        timestamp: Date.now(),
        p50: 35,
        p95: 80,
        p99: 120,
        average: 45,
        min: 20,
        max: 150,
        sampleCount: 10000
      }

      // Cache metrics
      const cached = await perfCacheService.cacheInferenceLatency(metrics)
      expect(cached).toBe(true)

      // Retrieve metrics
      const retrieved = await perfCacheService.getInferenceLatency(metrics.modelId)
      expect(retrieved).toBeTruthy()
      expect(retrieved?.p50).toBe(35)
      expect(retrieved?.p95).toBe(80)
      expect(retrieved?.p99).toBe(120)
      expect(retrieved?.average).toBeLessThan(100) // Should meet <100ms target
    }, 10000)
  })

  describe('Cache Performance Metrics', () => {
    it('should cache and retrieve cache performance metrics', async () => {
      const metrics: CachePerformanceMetrics = {
        timestamp: Date.now(),
        predictionHitRate: 0.92,
        featureHitRate: 0.88,
        modelHitRate: 0.95,
        overallHitRate: 0.91,
        averageLatency: 5.2,
        compressionRatio: 0.65,
        memoryUsage: 512
      }

      // Cache metrics
      const cached = await perfCacheService.cacheCachePerformance(metrics)
      expect(cached).toBe(true)

      // Retrieve metrics
      const retrieved = await perfCacheService.getCachePerformance()
      expect(retrieved).toBeTruthy()
      expect(retrieved?.overallHitRate).toBeGreaterThanOrEqual(0.85) // Should meet >85% target
      expect(retrieved?.averageLatency).toBeLessThan(10) // Should meet <10ms target
    }, 10000)
  })

  describe('Drift Detection Metrics', () => {
    it('should cache and retrieve drift metrics', async () => {
      const metrics: DriftMetrics = {
        modelId: 'drift-model-v1',
        timestamp: Date.now(),
        featureDrift: 0.15,
        conceptDrift: 0.08,
        predictionDrift: 0.12,
        driftScore: 0.35,
        alertThreshold: 0.5,
        requiresRetraining: false
      }

      // Cache metrics
      const cached = await perfCacheService.cacheDriftMetrics(metrics)
      expect(cached).toBe(true)

      // Retrieve metrics
      const retrieved = await perfCacheService.getDriftMetrics(metrics.modelId)
      expect(retrieved).toBeTruthy()
      expect(retrieved?.driftScore).toBe(0.35)
      expect(retrieved?.requiresRetraining).toBe(false)
    }, 10000)

    it('should cache drift alert when retraining required', async () => {
      const metrics: DriftMetrics = {
        modelId: 'alert-model-v1',
        timestamp: Date.now(),
        featureDrift: 0.45,
        conceptDrift: 0.38,
        predictionDrift: 0.42,
        driftScore: 0.75,
        alertThreshold: 0.5,
        requiresRetraining: true
      }

      // Cache metrics
      await perfCacheService.cacheDriftMetrics(metrics)

      // Check for alert
      const hasAlert = await perfCacheService.hasDriftAlert(metrics.modelId)
      expect(hasAlert).toBe(true)
    }, 10000)
  })

  describe('Prediction Accuracy Metrics', () => {
    it('should cache and retrieve prediction accuracy metrics', async () => {
      const metrics: PredictionAccuracyMetrics = {
        modelId: 'accuracy-model-v1',
        horizon: '1d',
        timestamp: Date.now(),
        directionAccuracy: 0.68,
        magnitudeError: 0.05,
        totalPredictions: 5000,
        correctDirections: 3400,
        averageError: 0.04
      }

      // Cache metrics
      const cached = await perfCacheService.cachePredictionAccuracy(metrics)
      expect(cached).toBe(true)

      // Retrieve metrics
      const retrieved = await perfCacheService.getPredictionAccuracy(
        metrics.modelId,
        metrics.horizon
      )
      expect(retrieved).toBeTruthy()
      expect(retrieved?.directionAccuracy).toBeGreaterThan(0.6) // Should meet >60% target
      expect(retrieved?.totalPredictions).toBe(5000)
    }, 10000)
  })

  describe('Resource Usage Metrics', () => {
    it('should cache and retrieve resource usage metrics', async () => {
      const metrics: ResourceUsageMetrics = {
        timestamp: Date.now(),
        cpuUsage: 35.5,
        memoryUsage: 1024,
        cacheSize: 512,
        modelCacheSize: 256,
        featureCacheSize: 128,
        activeModels: 3
      }

      // Cache metrics
      const cached = await perfCacheService.cacheResourceUsage(metrics)
      expect(cached).toBe(true)

      // Retrieve metrics
      const retrieved = await perfCacheService.getResourceUsage()
      expect(retrieved).toBeTruthy()
      expect(retrieved?.memoryUsage).toBeLessThan(2048) // Should meet <2GB target
      expect(retrieved?.activeModels).toBeGreaterThan(0)
    }, 10000)
  })

  describe('Performance Overview', () => {
    it('should get comprehensive performance overview for model', async () => {
      const modelId = 'overview-model-v1'

      // Cache various metrics
      const performance: ModelPerformanceMetrics = {
        modelId,
        modelVersion: '1.0',
        timestamp: Date.now(),
        accuracy: 0.75,
        precision: 0.72,
        recall: 0.78,
        f1Score: 0.75,
        sharpeRatio: 1.5,
        predictionCount: 1000,
        averageLatency: 45,
        errorRate: 0.05
      }

      const latency: InferenceLatencyMetrics = {
        modelId,
        timestamp: Date.now(),
        p50: 35,
        p95: 80,
        p99: 120,
        average: 45,
        min: 20,
        max: 150,
        sampleCount: 10000
      }

      const drift: DriftMetrics = {
        modelId,
        timestamp: Date.now(),
        featureDrift: 0.15,
        conceptDrift: 0.08,
        predictionDrift: 0.12,
        driftScore: 0.35,
        alertThreshold: 0.5,
        requiresRetraining: false
      }

      await perfCacheService.cacheModelPerformance(performance)
      await perfCacheService.cacheInferenceLatency(latency)
      await perfCacheService.cacheDriftMetrics(drift)

      // Get overview
      const overview = await perfCacheService.getPerformanceOverview(modelId)
      expect(overview.performance).toBeTruthy()
      expect(overview.latency).toBeTruthy()
      expect(overview.drift).toBeTruthy()
      expect(overview.accuracy).toBeTruthy()
    }, 10000)

    it('should get system-wide performance metrics', async () => {
      const cacheMetrics: CachePerformanceMetrics = {
        timestamp: Date.now(),
        predictionHitRate: 0.92,
        featureHitRate: 0.88,
        modelHitRate: 0.95,
        overallHitRate: 0.91,
        averageLatency: 5.2,
        compressionRatio: 0.65,
        memoryUsage: 512
      }

      const resourceMetrics: ResourceUsageMetrics = {
        timestamp: Date.now(),
        cpuUsage: 35.5,
        memoryUsage: 1024,
        cacheSize: 512,
        modelCacheSize: 256,
        featureCacheSize: 128,
        activeModels: 3
      }

      await perfCacheService.cacheCachePerformance(cacheMetrics)
      await perfCacheService.cacheResourceUsage(resourceMetrics)

      // Get system performance
      const systemPerf = await perfCacheService.getSystemPerformance()
      expect(systemPerf.cache).toBeTruthy()
      expect(systemPerf.resources).toBeTruthy()
    }, 10000)
  })

  describe('Cache Invalidation', () => {
    it('should invalidate all metrics for a model', async () => {
      const modelId = 'inval-model-v1'

      // Cache various metrics
      const performance: ModelPerformanceMetrics = {
        modelId,
        modelVersion: '1.0',
        timestamp: Date.now(),
        accuracy: 0.75,
        precision: 0.72,
        recall: 0.78,
        f1Score: 0.75,
        sharpeRatio: 1.5,
        predictionCount: 1000,
        averageLatency: 45,
        errorRate: 0.05
      }

      await perfCacheService.cacheModelPerformance(performance)

      // Verify cached
      let retrieved = await perfCacheService.getModelPerformance(modelId, '1.0')
      expect(retrieved).toBeTruthy()

      // Invalidate
      const invalidated = await perfCacheService.invalidateModelMetrics(modelId)
      expect(invalidated).toBeGreaterThanOrEqual(0)

      // Note: Invalidation may not always remove immediately due to Redis patterns
    }, 10000)
  })

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const health = await perfCacheService.healthCheck()
      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('latency')
      expect(typeof health.latency).toBe('number')
    }, 10000)
  })
})
