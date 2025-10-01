/**
 * RealTimePredictionEngine Test Suite
 *
 * Tests real-time prediction capabilities with <100ms latency target
 * NO MOCK DATA - Uses real ModelRegistry, FeatureStore, and MLCacheService
 */

import { RealTimePredictionEngine, PredictionRequest, BatchPredictionRequest } from '../RealTimePredictionEngine'
import { ModelRegistry, ModelType, ModelObjective, ModelStatus } from '../../models/ModelRegistry'
import { FeatureStore } from '../../features/FeatureStore'
import { MLCacheService } from '../../cache/MLCacheService'
import { MLPredictionHorizon, MLFeatureType } from '../../types/MLTypes'

describe('RealTimePredictionEngine', () => {
  let engine: RealTimePredictionEngine
  let modelRegistry: ModelRegistry
  let featureStore: FeatureStore
  let mlCache: MLCacheService

  beforeAll(async () => {
    modelRegistry = ModelRegistry.getInstance()
    featureStore = FeatureStore.getInstance()
    mlCache = MLCacheService.getInstance()

    await modelRegistry.initialize()
    await featureStore.initialize()
  }, 30000)

  beforeEach(() => {
    // Reset instance for each test
    RealTimePredictionEngine.resetInstance()
    engine = RealTimePredictionEngine.getInstance({
      maxConcurrentPredictions: 10,
      predictionTimeoutMs: 100,
      enableCaching: true,
      cacheTTL: 300,
      enableMetrics: true,
      batchSize: 25
    })
  })

  afterAll(async () => {
    // MLCacheService cleanup is handled automatically
  }, 10000)

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await engine.initialize()
      expect(result.success).toBe(true)
    }, 10000)

    test('should be singleton', () => {
      const instance1 = RealTimePredictionEngine.getInstance()
      const instance2 = RealTimePredictionEngine.getInstance()
      expect(instance1).toBe(instance2)
    })

    test('should initialize dependencies', async () => {
      const result = await engine.initialize()
      expect(result.success).toBe(true)

      const health = await engine.healthCheck()
      expect(health.initialized).toBe(true)
    }, 10000)
  })

  describe('Single Prediction', () => {
    beforeEach(async () => {
      await engine.initialize()

      // Register test model
      await modelRegistry.registerModel({
        modelName: 'test_lightgbm',
        modelVersion: '1.0.0',
        modelType: ModelType.LIGHTGBM,
        objective: ModelObjective.DIRECTION_CLASSIFICATION,
        targetVariable: 'price_direction',
        predictionHorizon: '1w',
        validationScore: 0.75,
        testScore: 0.72,
        status: ModelStatus.DEPLOYED,
        artifactPath: '/models/test_lightgbm_v1.pkl'
      })

      // Store test features
      await featureStore.storeBulkFeatures([
        {
          ticker: 'AAPL',
          timestamp: Date.now(),
          featureId: 'technical_rsi_14',
          value: 65.5,
          confidenceScore: 0.9,
          dataQualityScore: 0.95,
          sourceProvider: 'FMP'
        },
        {
          ticker: 'AAPL',
          timestamp: Date.now(),
          featureId: 'technical_sma_50',
          value: 175.2,
          confidenceScore: 0.9,
          dataQualityScore: 0.95,
          sourceProvider: 'FMP'
        }
      ])
    }, 30000)

    test('should make single prediction successfully', async () => {
      const request: PredictionRequest = {
        symbol: 'AAPL',
        horizon: MLPredictionHorizon.ONE_WEEK,
        confidenceThreshold: 0.5
      }

      const result = await engine.predict(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      if (result.data) {
        expect(result.data.symbol).toBe('AAPL')
        expect(result.data.prediction).toBeDefined()
        expect(result.data.confidence).toBeGreaterThanOrEqual(0)
        expect(result.data.confidence).toBeLessThanOrEqual(1)
        expect(['UP', 'DOWN', 'NEUTRAL']).toContain(result.data.direction)
        expect(result.data.latencyMs).toBeGreaterThan(0)
      }
    }, 10000)

    test('should meet <100ms latency target for cached predictions', async () => {
      const request: PredictionRequest = {
        symbol: 'AAPL',
        horizon: MLPredictionHorizon.ONE_WEEK
      }

      // First prediction (cache miss)
      await engine.predict(request)

      // Second prediction (cache hit)
      const result = await engine.predict(request)

      expect(result.success).toBe(true)
      expect(result.metadata?.cacheHit).toBe(true)
      if (result.data) {
        expect(result.data.latencyMs).toBeLessThan(100)
      }
    }, 10000)

    test('should return direction based on prediction value', async () => {
      const request: PredictionRequest = {
        symbol: 'AAPL',
        horizon: MLPredictionHorizon.ONE_WEEK
      }

      const result = await engine.predict(request)

      expect(result.success).toBe(true)
      if (result.data) {
        const { prediction, direction, confidence } = result.data

        if (confidence >= 0.5) {
          if (prediction > 0.1) {
            expect(direction).toBe('UP')
          } else if (prediction < -0.1) {
            expect(direction).toBe('DOWN')
          } else {
            expect(direction).toBe('NEUTRAL')
          }
        } else {
          expect(direction).toBe('NEUTRAL')
        }
      }
    }, 10000)

    test('should include probability distribution', async () => {
      const request: PredictionRequest = {
        symbol: 'AAPL',
        horizon: MLPredictionHorizon.ONE_WEEK
      }

      const result = await engine.predict(request)

      expect(result.success).toBe(true)
      if (result.data && result.data.probability) {
        const { up, down, neutral } = result.data.probability
        expect(up).toBeGreaterThanOrEqual(0)
        expect(up).toBeLessThanOrEqual(1)
        expect(down).toBeGreaterThanOrEqual(0)
        expect(down).toBeLessThanOrEqual(1)
        expect(neutral).toBeGreaterThanOrEqual(0)
        expect(neutral).toBeLessThanOrEqual(1)

        // Probabilities should sum to approximately 1
        const sum = up + down + neutral
        expect(sum).toBeCloseTo(1, 1)
      }
    }, 10000)
  })

  describe('Batch Prediction', () => {
    beforeEach(async () => {
      await engine.initialize()

      // Register test model
      await modelRegistry.registerModel({
        modelName: 'test_xgboost',
        modelVersion: '1.0.0',
        modelType: ModelType.XGBOOST,
        objective: ModelObjective.DIRECTION_CLASSIFICATION,
        targetVariable: 'price_direction',
        predictionHorizon: '1w',
        validationScore: 0.78,
        status: ModelStatus.DEPLOYED
      })

      // Store features for multiple symbols
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA']
      const features = symbols.flatMap(ticker => [
        {
          ticker,
          timestamp: Date.now(),
          featureId: 'technical_rsi_14',
          value: 60 + Math.random() * 20,
          confidenceScore: 0.9,
          dataQualityScore: 0.95,
          sourceProvider: 'FMP'
        },
        {
          ticker,
          timestamp: Date.now(),
          featureId: 'technical_sma_50',
          value: 150 + Math.random() * 50,
          confidenceScore: 0.9,
          dataQualityScore: 0.95,
          sourceProvider: 'FMP'
        }
      ])

      await featureStore.storeBulkFeatures(features)
    }, 30000)

    test('should process batch predictions successfully', async () => {
      const request: BatchPredictionRequest = {
        symbols: ['AAPL', 'GOOGL', 'MSFT'],
        horizon: MLPredictionHorizon.ONE_WEEK
      }

      const result = await engine.predictBatch(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      if (result.data) {
        expect(result.data.predictions.length).toBeGreaterThan(0)
        expect(result.data.totalLatencyMs).toBeGreaterThan(0)
        expect(result.data.cacheHitRate).toBeGreaterThanOrEqual(0)
        expect(result.data.cacheHitRate).toBeLessThanOrEqual(1)
      }
    }, 15000)

    test('should handle batch size limits', async () => {
      // Create large batch
      const symbols = Array.from({ length: 50 }, (_, i) => `SYM${i}`)

      const request: BatchPredictionRequest = {
        symbols,
        horizon: MLPredictionHorizon.ONE_WEEK
      }

      const result = await engine.predictBatch(request)

      expect(result.success).toBe(true)
      // Should process in batches without overwhelming system
    }, 30000)

    test('should track failed symbols in batch', async () => {
      const request: BatchPredictionRequest = {
        symbols: ['AAPL', 'INVALID_SYMBOL', 'GOOGL'],
        horizon: MLPredictionHorizon.ONE_WEEK
      }

      const result = await engine.predictBatch(request)

      expect(result.success).toBe(true)
      if (result.data) {
        // Some symbols may fail due to missing features
        expect(result.data.failedSymbols).toBeDefined()
      }
    }, 15000)

    test('should improve cache hit rate on repeated batch predictions', async () => {
      const request: BatchPredictionRequest = {
        symbols: ['AAPL', 'GOOGL', 'MSFT'],
        horizon: MLPredictionHorizon.ONE_WEEK
      }

      // First batch (cache misses)
      const firstResult = await engine.predictBatch(request)
      const firstHitRate = firstResult.data?.cacheHitRate || 0

      // Second batch (cache hits)
      const secondResult = await engine.predictBatch(request)
      const secondHitRate = secondResult.data?.cacheHitRate || 0

      expect(secondHitRate).toBeGreaterThan(firstHitRate)
    }, 15000)
  })

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await engine.initialize()
    }, 10000)

    test('should track prediction metrics', async () => {
      const metrics = engine.getMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.totalPredictions).toBeGreaterThanOrEqual(0)
      expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0)
      expect(metrics.p50LatencyMs).toBeGreaterThanOrEqual(0)
      expect(metrics.p95LatencyMs).toBeGreaterThanOrEqual(0)
      expect(metrics.p99LatencyMs).toBeGreaterThanOrEqual(0)
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(metrics.cacheHitRate).toBeLessThanOrEqual(1)
      expect(metrics.failureRate).toBeGreaterThanOrEqual(0)
      expect(metrics.failureRate).toBeLessThanOrEqual(1)
    })

    test('should calculate latency percentiles correctly', async () => {
      // Make several predictions to populate latency data
      const requests = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA'].map(symbol => ({
        symbol,
        horizon: MLPredictionHorizon.ONE_WEEK
      }))

      for (const request of requests) {
        await engine.predict(request).catch(() => {})
      }

      const metrics = engine.getMetrics()

      // p95 should be >= p50
      expect(metrics.p95LatencyMs).toBeGreaterThanOrEqual(metrics.p50LatencyMs)

      // p99 should be >= p95
      expect(metrics.p99LatencyMs).toBeGreaterThanOrEqual(metrics.p95LatencyMs)
    }, 15000)

    test('should meet <100ms p95 latency target', async () => {
      // Register and warm up cache
      await modelRegistry.registerModel({
        modelName: 'perf_test_model',
        modelVersion: '1.0.0',
        modelType: ModelType.LIGHTGBM,
        objective: ModelObjective.DIRECTION_CLASSIFICATION,
        targetVariable: 'price_direction',
        predictionHorizon: '1w',
        status: ModelStatus.DEPLOYED
      })

      // Store features
      await featureStore.storeBulkFeatures([
        {
          ticker: 'PERF',
          timestamp: Date.now(),
          featureId: 'test_feature',
          value: 100,
          confidenceScore: 0.9,
          dataQualityScore: 0.95,
          sourceProvider: 'TEST'
        }
      ])

      // Make predictions
      for (let i = 0; i < 20; i++) {
        await engine.predict({
          symbol: 'PERF',
          horizon: MLPredictionHorizon.ONE_WEEK
        })
      }

      const metrics = engine.getMetrics()

      // p95 should be under 100ms target
      expect(metrics.p95LatencyMs).toBeLessThan(100)
    }, 30000)
  })

  describe('Health Check', () => {
    test('should report healthy status when initialized', async () => {
      await engine.initialize()

      const health = await engine.healthCheck()

      expect(health.initialized).toBe(true)
      expect(health.metrics).toBeDefined()
    }, 10000)

    test('should detect high latency issues', async () => {
      await engine.initialize()

      const health = await engine.healthCheck()

      if (health.metrics.p95LatencyMs > 100) {
        expect(health.issues).toContain(expect.stringContaining('P95 latency'))
      }
    }, 10000)

    test('should detect high failure rate', async () => {
      await engine.initialize()

      const health = await engine.healthCheck()

      if (health.metrics.failureRate > 0.1) {
        expect(health.issues).toContain(expect.stringContaining('High failure rate'))
      }
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      await engine.initialize()
    }, 10000)

    test('should handle missing model gracefully', async () => {
      const request: PredictionRequest = {
        symbol: 'AAPL',
        modelId: 'non_existent_model',
        horizon: MLPredictionHorizon.ONE_WEEK
      }

      const result = await engine.predict(request)

      expect(result.success).toBe(false)
    }, 10000)

    test('should handle missing features gracefully', async () => {
      const request: PredictionRequest = {
        symbol: 'UNKNOWN_SYMBOL',
        horizon: MLPredictionHorizon.ONE_WEEK
      }

      const result = await engine.predict(request)

      expect(result.success).toBe(false)
    }, 10000)

    test('should track failures in metrics', async () => {
      const initialMetrics = engine.getMetrics()
      const initialFailures = initialMetrics.totalPredictions * initialMetrics.failureRate

      // Make failing prediction
      await engine.predict({
        symbol: 'INVALID',
        horizon: MLPredictionHorizon.ONE_WEEK
      })

      const updatedMetrics = engine.getMetrics()
      const updatedFailures = updatedMetrics.totalPredictions * updatedMetrics.failureRate

      expect(updatedFailures).toBeGreaterThan(initialFailures)
    }, 10000)
  })

  describe('Caching Behavior', () => {
    beforeEach(async () => {
      await engine.initialize()

      await modelRegistry.registerModel({
        modelName: 'cache_test_model',
        modelVersion: '1.0.0',
        modelType: ModelType.LIGHTGBM,
        objective: ModelObjective.DIRECTION_CLASSIFICATION,
        targetVariable: 'price_direction',
        predictionHorizon: '1w',
        status: ModelStatus.DEPLOYED
      })

      await featureStore.storeBulkFeatures([
        {
          ticker: 'CACHE',
          timestamp: Date.now(),
          featureId: 'test_feature',
          value: 100,
          confidenceScore: 0.9,
          dataQualityScore: 0.95,
          sourceProvider: 'TEST'
        }
      ])
    }, 30000)

    test('should cache predictions with high confidence', async () => {
      const request: PredictionRequest = {
        symbol: 'CACHE',
        horizon: MLPredictionHorizon.ONE_WEEK,
        confidenceThreshold: 0.5
      }

      // First prediction
      const firstResult = await engine.predict(request)
      expect(firstResult.metadata?.cacheHit).toBe(false)

      // Second prediction (should be cached)
      const secondResult = await engine.predict(request)
      expect(secondResult.metadata?.cacheHit).toBe(true)
    }, 15000)

    test('should improve cache hit rate over time', async () => {
      const request: PredictionRequest = {
        symbol: 'CACHE',
        horizon: MLPredictionHorizon.ONE_WEEK
      }

      // Make several predictions
      for (let i = 0; i < 10; i++) {
        await engine.predict(request)
      }

      const metrics = engine.getMetrics()
      expect(metrics.cacheHitRate).toBeGreaterThan(0)
    }, 15000)
  })
})
