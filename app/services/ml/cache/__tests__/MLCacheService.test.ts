/**
 * MLCacheService Tests
 * Comprehensive test suite for ML caching functionality
 * Following VFR NO MOCK DATA policy - tests use real Redis connections
 */

import { MLCacheService, ML_CACHE_TTL, ML_CACHE_KEYS, MLEnhancementStatus } from '../MLCacheService'
import { RedisCache } from '../../../cache/RedisCache'
import {
  MLPrediction,
  MLFeatureVector,
  MLModelConfig,
  MLModelType,
  MLPredictionHorizon,
  MLModelStatus,
  MLFeatureType
} from '../../types/MLTypes'

describe('MLCacheService', () => {
  let mlCacheService: MLCacheService
  let redisCache: RedisCache

  beforeAll(() => {
    mlCacheService = MLCacheService.getInstance()
    redisCache = RedisCache.getInstance()
  })

  afterAll(async () => {
    // Clean up Redis connections
    await redisCache.shutdown()
  })

  beforeEach(async () => {
    // Reset stats before each test
    mlCacheService.resetStats()
  })

  describe('ML Prediction Caching', () => {
    it('should cache and retrieve ML prediction', async () => {
      const symbol = 'AAPL'
      const horizon = MLPredictionHorizon.ONE_DAY
      const modelId = 'test-model-v1'

      const prediction: MLPrediction = {
        symbol,
        modelId,
        modelVersion: '1.0',
        horizon,
        prediction: 0.75,
        confidence: 0.85,
        timestamp: Date.now(),
        features: { momentum: 0.5, volatility: 0.3 },
        metadata: { predictionType: 'price_direction', source: 'ml-engine' }
      }

      // Cache prediction
      const cached = await mlCacheService.cachePrediction(symbol, horizon, modelId, prediction)
      expect(cached).toBe(true)

      // Retrieve prediction
      const retrieved = await mlCacheService.getCachedPrediction(symbol, horizon, modelId)
      expect(retrieved).toBeTruthy()
      expect(retrieved?.symbol).toBe(symbol)
      expect(retrieved?.prediction).toBe(0.75)
      expect(retrieved?.confidence).toBe(0.85)
    }, 10000)

    it('should handle large prediction payloads with compression', async () => {
      const symbol = 'NVDA'
      const horizon = MLPredictionHorizon.ONE_WEEK
      const modelId = 'large-model-v1'

      // Create large prediction payload
      const largeFeatures: Record<string, number> = {}
      for (let i = 0; i < 1000; i++) {
        largeFeatures[`feature_${i}`] = Math.random()
      }

      const prediction: MLPrediction = {
        symbol,
        modelId,
        modelVersion: '1.0',
        horizon,
        prediction: 0.65,
        confidence: 0.90,
        timestamp: Date.now(),
        features: largeFeatures,
        metadata: { predictionType: 'ensemble', source: 'ml-engine' }
      }

      // Cache large prediction (should compress)
      const cached = await mlCacheService.cachePrediction(symbol, horizon, modelId, prediction)
      expect(cached).toBe(true)

      // Retrieve and verify decompression
      const retrieved = await mlCacheService.getCachedPrediction(symbol, horizon, modelId)
      expect(retrieved).toBeTruthy()
      expect(retrieved?.features).toEqual(largeFeatures)
      expect(Object.keys(retrieved?.features || {}).length).toBe(1000)
    }, 10000)

    it('should batch cache multiple predictions', async () => {
      const predictions = [
        {
          symbol: 'AAPL',
          horizon: MLPredictionHorizon.ONE_DAY,
          modelId: 'batch-model-v1',
          prediction: {
            symbol: 'AAPL',
            modelId: 'batch-model-v1',
            modelVersion: '1.0',
            horizon: MLPredictionHorizon.ONE_DAY,
            prediction: 0.75,
            confidence: 0.85,
            timestamp: Date.now(),
            features: {},
            metadata: {}
          } as MLPrediction
        },
        {
          symbol: 'GOOGL',
          horizon: MLPredictionHorizon.ONE_DAY,
          modelId: 'batch-model-v1',
          prediction: {
            symbol: 'GOOGL',
            modelId: 'batch-model-v1',
            modelVersion: '1.0',
            horizon: MLPredictionHorizon.ONE_DAY,
            prediction: 0.68,
            confidence: 0.82,
            timestamp: Date.now(),
            features: {},
            metadata: {}
          } as MLPrediction
        },
        {
          symbol: 'MSFT',
          horizon: MLPredictionHorizon.ONE_DAY,
          modelId: 'batch-model-v1',
          prediction: {
            symbol: 'MSFT',
            modelId: 'batch-model-v1',
            modelVersion: '1.0',
            horizon: MLPredictionHorizon.ONE_DAY,
            prediction: 0.72,
            confidence: 0.88,
            timestamp: Date.now(),
            features: {},
            metadata: {}
          } as MLPrediction
        }
      ]

      const count = await mlCacheService.batchCachePredictions(predictions)
      expect(count).toBe(3)

      // Verify all cached
      for (const item of predictions) {
        const retrieved = await mlCacheService.getCachedPrediction(
          item.symbol,
          item.horizon,
          item.modelId
        )
        expect(retrieved).toBeTruthy()
        expect(retrieved?.symbol).toBe(item.symbol)
      }
    }, 10000)

    it('should return null for non-existent prediction', async () => {
      const retrieved = await mlCacheService.getCachedPrediction(
        'NONEXISTENT',
        MLPredictionHorizon.ONE_DAY,
        'fake-model'
      )
      expect(retrieved).toBeNull()
    }, 10000)
  })

  describe('ML Feature Vector Caching', () => {
    it('should cache and retrieve feature vector', async () => {
      const symbol = 'TSLA'
      const featureVector: MLFeatureVector = {
        symbol,
        features: {
          momentum_1d: 0.05,
          momentum_5d: 0.12,
          volatility: 0.25,
          volume_ratio: 1.15
        },
        featureNames: ['momentum_1d', 'momentum_5d', 'volatility', 'volume_ratio'],
        timestamp: Date.now(),
        completeness: 1.0,
        qualityScore: 0.95
      }

      // Cache feature vector
      const cached = await mlCacheService.cacheFeatureVector(symbol, featureVector)
      expect(cached).toBe(true)

      // Retrieve feature vector
      const retrieved = await mlCacheService.getCachedFeatureVector(symbol)
      expect(retrieved).toBeTruthy()
      expect(retrieved?.symbol).toBe(symbol)
      expect(retrieved?.features).toEqual(featureVector.features)
      expect(retrieved?.completeness).toBe(1.0)
    }, 10000)

    it('should batch cache feature vectors', async () => {
      const vectors = [
        {
          symbol: 'AAPL',
          vector: {
            symbol: 'AAPL',
            features: { momentum: 0.1 },
            featureNames: ['momentum'],
            timestamp: Date.now(),
            completeness: 1.0,
            qualityScore: 0.9
          } as MLFeatureVector
        },
        {
          symbol: 'GOOGL',
          vector: {
            symbol: 'GOOGL',
            features: { momentum: 0.2 },
            featureNames: ['momentum'],
            timestamp: Date.now(),
            completeness: 1.0,
            qualityScore: 0.9
          } as MLFeatureVector
        }
      ]

      const count = await mlCacheService.batchCacheFeatureVectors(vectors)
      expect(count).toBe(2)

      // Verify all cached
      for (const item of vectors) {
        const retrieved = await mlCacheService.getCachedFeatureVector(item.symbol)
        expect(retrieved).toBeTruthy()
        expect(retrieved?.symbol).toBe(item.symbol)
      }
    }, 10000)
  })

  describe('ML Model Metadata Caching', () => {
    it('should cache and retrieve model metadata', async () => {
      const modelId = 'test-model-metadata-v1'
      const config: MLModelConfig = {
        modelId,
        modelType: MLModelType.LIGHTGBM,
        version: '1.0',
        status: MLModelStatus.ACTIVE,
        horizon: MLPredictionHorizon.ONE_DAY,
        features: ['momentum', 'volatility', 'volume'],
        hyperparameters: { learningRate: 0.1, numLeaves: 31 },
        performanceMetrics: {
          accuracy: 0.75,
          precision: 0.72,
          recall: 0.78,
          f1Score: 0.75,
          sharpeRatio: 1.5,
          validationAccuracy: 0.73,
          trainingLoss: 0.25,
          validationLoss: 0.27,
          lastUpdated: Date.now()
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      // Cache model metadata
      const cached = await mlCacheService.cacheModelMetadata(modelId, config)
      expect(cached).toBe(true)

      // Retrieve model metadata
      const retrieved = await mlCacheService.getCachedModelMetadata(modelId)
      expect(retrieved).toBeTruthy()
      expect(retrieved?.modelId).toBe(modelId)
      expect(retrieved?.modelType).toBe(MLModelType.LIGHTGBM)
      expect(retrieved?.performanceMetrics.accuracy).toBe(0.75)
    }, 10000)
  })

  describe('ML Enhancement Status Caching', () => {
    it('should cache and retrieve enhancement status', async () => {
      const status: MLEnhancementStatus = {
        available: true,
        modelsLoaded: 3,
        featuresReady: true,
        lastUpdate: Date.now(),
        performance: {
          averageLatency: 85,
          cacheHitRate: 0.92,
          activeModels: 3
        }
      }

      // Cache enhancement status
      const cached = await mlCacheService.cacheEnhancementStatus(status)
      expect(cached).toBe(true)

      // Retrieve enhancement status
      const retrieved = await mlCacheService.getCachedEnhancementStatus()
      expect(retrieved).toBeTruthy()
      expect(retrieved?.available).toBe(true)
      expect(retrieved?.modelsLoaded).toBe(3)
      expect(retrieved?.performance.averageLatency).toBe(85)
    }, 10000)
  })

  describe('Cache Invalidation', () => {
    it('should invalidate predictions for a symbol', async () => {
      const symbol = 'INVAL'
      const horizon = MLPredictionHorizon.ONE_DAY
      const modelId = 'inval-model-v1'

      const prediction: MLPrediction = {
        symbol,
        modelId,
        modelVersion: '1.0',
        horizon,
        prediction: 0.65,
        confidence: 0.80,
        timestamp: Date.now(),
        features: {},
        metadata: {}
      }

      // Cache prediction
      await mlCacheService.cachePrediction(symbol, horizon, modelId, prediction)

      // Verify cached
      let retrieved = await mlCacheService.getCachedPrediction(symbol, horizon, modelId)
      expect(retrieved).toBeTruthy()

      // Invalidate
      const invalidated = await mlCacheService.invalidatePredictions(symbol)
      expect(invalidated).toBeGreaterThan(0)

      // Verify invalidated
      retrieved = await mlCacheService.getCachedPrediction(symbol, horizon, modelId)
      expect(retrieved).toBeNull()
    }, 10000)

    it('should invalidate feature vectors for a symbol', async () => {
      const symbol = 'INVALFEAT'
      const featureVector: MLFeatureVector = {
        symbol,
        features: { test: 1.0 },
        featureNames: ['test'],
        timestamp: Date.now(),
        completeness: 1.0,
        qualityScore: 0.9
      }

      // Cache feature vector
      await mlCacheService.cacheFeatureVector(symbol, featureVector)

      // Verify cached
      let retrieved = await mlCacheService.getCachedFeatureVector(symbol)
      expect(retrieved).toBeTruthy()

      // Invalidate
      const invalidated = await mlCacheService.invalidateFeatures(symbol)
      expect(invalidated).toBeGreaterThan(0)

      // Verify invalidated
      retrieved = await mlCacheService.getCachedFeatureVector(symbol)
      expect(retrieved).toBeNull()
    }, 10000)
  })

  describe('Cache Statistics', () => {
    it('should track cache statistics', async () => {
      // Reset stats
      mlCacheService.resetStats()

      const symbol = 'STATS'
      const horizon = MLPredictionHorizon.ONE_DAY
      const modelId = 'stats-model-v1'

      const prediction: MLPrediction = {
        symbol,
        modelId,
        modelVersion: '1.0',
        horizon,
        prediction: 0.70,
        confidence: 0.85,
        timestamp: Date.now(),
        features: {},
        metadata: {}
      }

      // Cache prediction
      await mlCacheService.cachePrediction(symbol, horizon, modelId, prediction)

      // Hit (retrieve cached)
      await mlCacheService.getCachedPrediction(symbol, horizon, modelId)

      // Miss (non-existent)
      await mlCacheService.getCachedPrediction('NONEXIST', horizon, modelId)

      // Get stats
      const stats = mlCacheService.getStats()
      expect(stats.predictionHits).toBeGreaterThan(0)
      expect(stats.predictionMisses).toBeGreaterThan(0)
      expect(stats.hitRate).toBeGreaterThan(0)
      expect(stats.hitRate).toBeLessThanOrEqual(100)
    }, 10000)
  })

  describe('Cache Health Check', () => {
    it('should perform health check', async () => {
      const health = await mlCacheService.healthCheck()
      expect(health).toHaveProperty('healthy')
      expect(health).toHaveProperty('latency')
      expect(health).toHaveProperty('stats')
      expect(typeof health.latency).toBe('number')
    }, 10000)
  })

  describe('Cache Performance', () => {
    it('should meet latency targets (<10ms for cache operations)', async () => {
      const symbol = 'PERF'
      const horizon = MLPredictionHorizon.ONE_DAY
      const modelId = 'perf-model-v1'

      const prediction: MLPrediction = {
        symbol,
        modelId,
        modelVersion: '1.0',
        horizon,
        prediction: 0.80,
        confidence: 0.90,
        timestamp: Date.now(),
        features: {},
        metadata: {}
      }

      // Cache prediction
      await mlCacheService.cachePrediction(symbol, horizon, modelId, prediction)

      // Measure retrieval latency
      const startTime = Date.now()
      await mlCacheService.getCachedPrediction(symbol, horizon, modelId)
      const latency = Date.now() - startTime

      // Verify latency target (<10ms)
      expect(latency).toBeLessThan(10)
    }, 10000)

    it('should achieve >85% hit rate with proper caching', async () => {
      mlCacheService.resetStats()

      const symbols = ['HIT1', 'HIT2', 'HIT3', 'HIT4', 'HIT5']
      const horizon = MLPredictionHorizon.ONE_DAY
      const modelId = 'hitrate-model-v1'

      // Cache predictions for all symbols
      for (const symbol of symbols) {
        const prediction: MLPrediction = {
          symbol,
          modelId,
          modelVersion: '1.0',
          horizon,
          prediction: 0.70,
          confidence: 0.85,
          timestamp: Date.now(),
          features: {},
          metadata: {}
        }
        await mlCacheService.cachePrediction(symbol, horizon, modelId, prediction)
      }

      // Retrieve cached predictions (should all hit)
      for (const symbol of symbols) {
        await mlCacheService.getCachedPrediction(symbol, horizon, modelId)
      }

      // Get stats
      const stats = mlCacheService.getStats()
      expect(stats.hitRate).toBeGreaterThanOrEqual(85)
    }, 10000)
  })
})
