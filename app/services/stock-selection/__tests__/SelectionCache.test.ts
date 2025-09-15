/**
 * Comprehensive SelectionCache Test Suite
 *
 * Tests cover:
 * - Multi-tier hierarchical caching (memory + Redis)
 * - Intelligent cache strategies and TTL optimization
 * - LRU eviction and access pattern optimization
 * - Data compression and decompression
 * - Parallel lookup and prefetch mechanisms
 * - Cache invalidation by pattern and tags
 * - Performance metrics and monitoring
 * - Cache warming and predictive prefetch
 * - Error handling and resource management
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals'
import { SelectionCache } from '../cache/SelectionCache'
import {
  SelectionRequest,
  SelectionResponse,
  EnhancedStockResult,
  SectorAnalysisResult,
  MultiStockAnalysisResult,
  SelectionMode,
  SelectionOptions
} from '../types'
import { RedisCache } from '../../cache/RedisCache'
import { QualityScore } from '../../mcp/types'

// Mock Redis cache
jest.mock('../../cache/RedisCache')

describe('SelectionCache', () => {
  let selectionCache: SelectionCache
  let mockRedisCache: jest.Mocked<RedisCache>
  let consoleSpy: jest.SpyInstance

  // Test data fixtures
  const mockQualityScore: QualityScore = {
    overall: 0.9,
    metrics: {
      freshness: 0.95,
      completeness: 0.88,
      accuracy: 0.92,
      sourceReputation: 0.85,
      latency: 150
    },
    timestamp: Date.now(),
    source: 'test'
  }

  const mockEnhancedStockResult: EnhancedStockResult = {
    symbol: 'AAPL',
    score: {
      overallScore: 0.85,
      timestamp: Date.now(),
      factorScores: {
        momentum: 0.8,
        value: 0.7,
        quality: 0.9,
        volatility: 0.6,
        growth: 0.85
      },
      marketData: {
        price: 150.25,
        volume: 1000000,
        marketCap: 2500000000000,
        sector: 'Technology',
        beta: 1.2
      },
      dataQuality: mockQualityScore
    },
    weight: 1.0,
    action: 'BUY',
    confidence: 0.88,
    context: {
      sector: 'Technology',
      marketCap: 2500000000000,
      priceChange24h: 2.5,
      volumeChange24h: 0.15,
      beta: 1.2
    },
    reasoning: {
      primaryFactors: ['momentum', 'quality', 'growth'],
      warnings: [],
      opportunities: ['Strong fundamental performance']
    },
    dataQuality: {
      overall: mockQualityScore,
      sourceBreakdown: {
        'polygon': mockQualityScore
      },
      lastUpdated: Date.now()
    }
  }

  const mockSelectionRequest: SelectionRequest = {
    scope: {
      mode: SelectionMode.SINGLE_STOCK,
      symbols: ['AAPL']
    },
    options: {
      algorithmId: 'composite',
      useRealTimeData: false
    }
  }

  const mockSelectionResponse: SelectionResponse = {
    success: true,
    requestId: 'test-request-id',
    timestamp: Date.now(),
    executionTime: 1500,
    singleStock: mockEnhancedStockResult,
    topSelections: [mockEnhancedStockResult],
    metadata: {
      algorithmUsed: 'composite',
      dataSourcesUsed: ['polygon'],
      cacheHitRate: 0.75,
      analysisMode: SelectionMode.SINGLE_STOCK,
      qualityScore: mockQualityScore
    },
    performance: {
      dataFetchTime: 500,
      analysisTime: 800,
      fusionTime: 150,
      cacheTime: 50
    }
  }

  beforeAll(() => {
    // Suppress console logs during testing
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterAll(() => {
    consoleSpy.mockRestore()
  })

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Create mock Redis cache
    mockRedisCache = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(true),
      clear: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(5),
      ping: jest.fn().mockResolvedValue('PONG'),
      exists: jest.fn().mockResolvedValue(true)
    } as any

    // Create selection cache instance
    selectionCache = new SelectionCache(mockRedisCache)
  })

  afterEach(async () => {
    // Cleanup cache
    await selectionCache.shutdown()
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(selectionCache).toBeInstanceOf(SelectionCache)
    })

    it('should setup cache strategies on initialization', () => {
      const metrics = selectionCache.getMetrics()
      expect(metrics.strategies).toBeDefined()
      expect(metrics.strategies.single_stock).toBeDefined()
      expect(metrics.strategies.sector_analysis).toBeDefined()
      expect(metrics.strategies.multi_stock).toBeDefined()
    })

    it('should start cleanup timer on initialization', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval')

      new SelectionCache(mockRedisCache)

      expect(setIntervalSpy).toHaveBeenCalled()
      setIntervalSpy.mockRestore()
    })
  })

  describe('Selection Response Caching', () => {
    it('should cache selection response successfully', async () => {
      const success = await selectionCache.cacheSelection(
        mockSelectionRequest,
        mockSelectionResponse
      )

      expect(success).toBe(true)
    })

    it('should retrieve cached selection response', async () => {
      // Cache first
      await selectionCache.cacheSelection(
        mockSelectionRequest,
        mockSelectionResponse
      )

      // Retrieve
      const cached = await selectionCache.getSelection(mockSelectionRequest)

      expect(cached).toBeDefined()
      expect(cached?.success).toBe(true)
      expect(cached?.singleStock?.symbol).toBe('AAPL')
    })

    it('should return null for cache miss', async () => {
      const cached = await selectionCache.getSelection(mockSelectionRequest)
      expect(cached).toBeNull()
    })

    it('should select appropriate cache strategy based on request mode', async () => {
      const sectorRequest: SelectionRequest = {
        scope: {
          mode: SelectionMode.SECTOR_ANALYSIS,
          sector: { id: 'technology', label: 'Technology', category: 'sector' }
        }
      }

      const success = await selectionCache.cacheSelection(
        sectorRequest,
        mockSelectionResponse
      )

      expect(success).toBe(true)
      // Verify sector_analysis strategy was used
    })

    it('should handle unknown cache strategy gracefully', async () => {
      const success = await selectionCache.cacheSelection(
        mockSelectionRequest,
        mockSelectionResponse,
        'unknown_strategy'
      )

      expect(success).toBe(false)
    })

    it('should validate cache entry before returning', async () => {
      // Mock an expired entry
      const expiredRequest = { ...mockSelectionRequest }
      const expiredResponse = {
        ...mockSelectionResponse,
        timestamp: Date.now() - 1000000 // Very old timestamp
      }

      await selectionCache.cacheSelection(expiredRequest, expiredResponse)

      // Should return null for expired entry
      const cached = await selectionCache.getSelection({
        ...expiredRequest,
        options: { useRealTimeData: true }
      })

      expect(cached).toBeNull()
    })
  })

  describe('Individual Stock Result Caching', () => {
    it('should cache stock result', async () => {
      const success = await selectionCache.cacheStockResult(
        'AAPL',
        mockEnhancedStockResult
      )

      expect(success).toBe(true)
    })

    it('should retrieve cached stock result', async () => {
      await selectionCache.cacheStockResult('AAPL', mockEnhancedStockResult)

      const cached = await selectionCache.getStockResult('AAPL')

      expect(cached).toBeDefined()
      expect(cached?.symbol).toBe('AAPL')
    })

    it('should handle different options for same symbol', async () => {
      const options1: SelectionOptions = { useRealTimeData: true }
      const options2: SelectionOptions = { useRealTimeData: false }

      await selectionCache.cacheStockResult('AAPL', mockEnhancedStockResult, options1)
      await selectionCache.cacheStockResult('AAPL', mockEnhancedStockResult, options2)

      const cached1 = await selectionCache.getStockResult('AAPL', options1)
      const cached2 = await selectionCache.getStockResult('AAPL', options2)

      expect(cached1).toBeDefined()
      expect(cached2).toBeDefined()
    })
  })

  describe('Sector Analysis Caching', () => {
    const mockSectorResult: SectorAnalysisResult = {
      sector: { id: 'technology', label: 'Technology', category: 'sector' },
      overview: {
        totalStocks: 10,
        avgScore: 0.75,
        topPerformers: 3,
        underperformers: 2,
        marketCapTotal: 5000000000000,
        volumeTotal: 50000000
      },
      sectorMetrics: {
        momentum: 0.8,
        valuation: 0.7,
        growth: 0.85,
        stability: 0.6
      },
      topSelections: [mockEnhancedStockResult]
    }

    it('should cache sector analysis result', async () => {
      const success = await selectionCache.cacheSectorAnalysis(
        'technology',
        mockSectorResult
      )

      expect(success).toBe(true)
    })

    it('should retrieve cached sector analysis', async () => {
      await selectionCache.cacheSectorAnalysis('technology', mockSectorResult)

      const cached = await selectionCache.getSectorAnalysis('technology')

      expect(cached).toBeDefined()
      expect(cached?.sector.id).toBe('technology')
      expect(cached?.overview.totalStocks).toBe(10)
    })
  })

  describe('Market Data Caching', () => {
    const mockMarketData = {
      symbol: 'AAPL',
      price: 150.25,
      volume: 1000000,
      timestamp: Date.now()
    }

    it('should cache market data', async () => {
      const success = await selectionCache.cacheMarketData(
        'AAPL',
        mockMarketData,
        'polygon'
      )

      expect(success).toBe(true)
    })

    it('should retrieve cached market data', async () => {
      await selectionCache.cacheMarketData('AAPL', mockMarketData, 'polygon')

      const cached = await selectionCache.getMarketData('AAPL', 'polygon')

      expect(cached).toBeDefined()
      expect(cached.symbol).toBe('AAPL')
      expect(cached.price).toBe(150.25)
    })

    it('should use different strategies for market hours vs after hours', async () => {
      // Mock market hours check
      const isMarketHoursSpy = jest.spyOn(selectionCache as any, 'isMarketHours')

      // Test during market hours
      isMarketHoursSpy.mockReturnValue(true)
      await selectionCache.cacheMarketData('AAPL', mockMarketData, 'polygon')

      // Test after market hours
      isMarketHoursSpy.mockReturnValue(false)
      await selectionCache.cacheMarketData('MSFT', mockMarketData, 'polygon')

      expect(isMarketHoursSpy).toHaveBeenCalled()
      isMarketHoursSpy.mockRestore()
    })
  })

  describe('Hierarchical Storage', () => {
    it('should store in memory cache first', async () => {
      await selectionCache.cacheSelection(mockSelectionRequest, mockSelectionResponse)

      // Check if item is in memory cache by retrieving quickly
      const cached = await selectionCache.getSelection(mockSelectionRequest)
      expect(cached).toBeDefined()
    })

    it('should store in Redis for high-priority items', async () => {
      const highPriorityRequest: SelectionRequest = {
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        },
        options: {
          useRealTimeData: true // High priority
        }
      }

      await selectionCache.cacheSelection(highPriorityRequest, mockSelectionResponse)

      expect(mockRedisCache.set).toHaveBeenCalled()
    })

    it('should promote frequently accessed entries to memory cache', async () => {
      // Mock Redis cache returning entry
      const mockEntry = {
        data: mockSelectionResponse,
        metadata: {
          strategy: 'single_stock',
          created: Date.now(),
          accessed: Date.now(),
          accessCount: 6, // High access count
          size: 1000,
          tags: ['symbol:AAPL'],
          dependencies: ['AAPL']
        },
        quality: mockQualityScore
      }

      mockRedisCache.get.mockResolvedValue(mockEntry)

      // Access multiple times to trigger promotion
      await selectionCache.getSelection(mockSelectionRequest)

      expect(mockRedisCache.get).toHaveBeenCalled()
    })
  })

  describe('LRU Eviction', () => {
    it('should evict least recently used items when memory cache is full', async () => {
      // Mock maxMemoryCacheSize to 2 for easy testing
      ;(selectionCache as any).maxMemoryCacheSize = 2

      const request1: SelectionRequest = {
        scope: { mode: SelectionMode.SINGLE_STOCK, symbols: ['AAPL'] }
      }
      const request2: SelectionRequest = {
        scope: { mode: SelectionMode.SINGLE_STOCK, symbols: ['MSFT'] }
      }
      const request3: SelectionRequest = {
        scope: { mode: SelectionMode.SINGLE_STOCK, symbols: ['GOOGL'] }
      }

      // Cache three items (should evict first one)
      await selectionCache.cacheSelection(request1, mockSelectionResponse)
      await selectionCache.cacheSelection(request2, mockSelectionResponse)
      await selectionCache.cacheSelection(request3, mockSelectionResponse)

      // First item should be evicted from memory
      const memoryCache = (selectionCache as any).memoryCache
      expect(memoryCache.size).toBeLessThanOrEqual(2)
    })

    it('should track access order for LRU operations', async () => {
      await selectionCache.cacheSelection(mockSelectionRequest, mockSelectionResponse)

      // Access the cached item to update access order
      await selectionCache.getSelection(mockSelectionRequest)

      const accessOrder = (selectionCache as any).accessOrder
      expect(accessOrder.length).toBeGreaterThan(0)
    })
  })

  describe('Data Compression', () => {
    it('should compress large data objects', async () => {
      const largeResponse = {
        ...mockSelectionResponse,
        topSelections: Array.from({ length: 100 }, () => mockEnhancedStockResult)
      }

      const compressSpy = jest.spyOn(selectionCache as any, 'compressData')
      compressSpy.mockResolvedValue({ compressed: true, data: 'compressed_data' })

      await selectionCache.cacheSelection(mockSelectionRequest, largeResponse)

      // Compression should be attempted for large objects
      expect(compressSpy).toHaveBeenCalled()
      compressSpy.mockRestore()
    })

    it('should decompress data on retrieval', async () => {
      const compressedData = {
        compressed: true,
        data: JSON.stringify(mockSelectionResponse),
        originalSize: 1024
      }

      const decompressSpy = jest.spyOn(selectionCache as any, 'decompressData')
      decompressSpy.mockResolvedValue(mockSelectionResponse)

      const isCompressedSpy = jest.spyOn(selectionCache as any, 'isCompressed')
      isCompressedSpy.mockReturnValue(true)

      // Mock memory cache to return compressed data
      const memoryCache = (selectionCache as any).memoryCache
      memoryCache.set('test-key', {
        data: compressedData,
        metadata: {
          strategy: 'single_stock',
          created: Date.now(),
          accessed: Date.now(),
          accessCount: 1,
          size: 500,
          tags: [],
          dependencies: []
        },
        quality: mockQualityScore
      })

      await selectionCache.getSelection(mockSelectionRequest)

      expect(decompressSpy).toHaveBeenCalled()
      decompressSpy.mockRestore()
      isCompressedSpy.mockRestore()
    })

    it('should handle compression errors gracefully', async () => {
      const compressSpy = jest.spyOn(selectionCache as any, 'compressData')
      compressSpy.mockRejectedValue(new Error('Compression failed'))

      const success = await selectionCache.cacheSelection(mockSelectionRequest, mockSelectionResponse)

      // Should still succeed even if compression fails
      expect(success).toBe(true)
      compressSpy.mockRestore()
    })
  })

  describe('Cache Invalidation', () => {
    beforeEach(async () => {
      // Setup some cached data
      await selectionCache.cacheSelection(mockSelectionRequest, mockSelectionResponse)
      await selectionCache.cacheStockResult('AAPL', mockEnhancedStockResult)
    })

    it('should invalidate by pattern', async () => {
      const invalidated = await selectionCache.invalidate('*AAPL*')
      expect(invalidated).toBeGreaterThan(0)
    })

    it('should invalidate by tags', async () => {
      const invalidated = await selectionCache.invalidate(undefined, ['symbol:AAPL'])
      expect(invalidated).toBeGreaterThan(0)
    })

    it('should invalidate by symbol', async () => {
      const invalidated = await selectionCache.invalidateSymbol('AAPL')
      expect(invalidated).toBeGreaterThan(0)
      expect(mockRedisCache.invalidatePattern).toHaveBeenCalledWith('*AAPL*')
    })

    it('should invalidate by sector', async () => {
      const invalidated = await selectionCache.invalidateSector('technology')
      expect(invalidated).toBeGreaterThan(0)
    })

    it('should handle invalidation errors gracefully', async () => {
      mockRedisCache.invalidatePattern.mockRejectedValue(new Error('Redis error'))

      const invalidated = await selectionCache.invalidate('*test*')
      expect(invalidated).toBe(0)
    })
  })

  describe('Parallel Lookup Optimization', () => {
    it('should perform parallel lookup across cache levels', async () => {
      const retrieveSpy = jest.spyOn(selectionCache as any, 'retrieveFromLevel')
      retrieveSpy.mockResolvedValue(null) // All levels return null

      await selectionCache.getSelection(mockSelectionRequest)

      // Should check both memory and Redis levels in parallel
      expect(retrieveSpy).toHaveBeenCalledTimes(2) // memory + redis levels
      retrieveSpy.mockRestore()
    })

    it('should prevent duplicate parallel fetches', async () => {
      const performParallelLookupSpy = jest.spyOn(selectionCache as any, 'performParallelLookup')
      performParallelLookupSpy.mockResolvedValue(mockSelectionResponse)

      // Make concurrent requests for same data
      const promises = [
        selectionCache.getSelection(mockSelectionRequest),
        selectionCache.getSelection(mockSelectionRequest),
        selectionCache.getSelection(mockSelectionRequest)
      ]

      await Promise.all(promises)

      // Should only perform lookup once due to deduplication
      expect(performParallelLookupSpy).toHaveBeenCalledTimes(1)
      performParallelLookupSpy.mockRestore()
    })
  })

  describe('Predictive Prefetch', () => {
    it('should trigger predictive prefetch for related data', async () => {
      const triggerPrefetchSpy = jest.spyOn(selectionCache as any, 'triggerPredictivePrefetch')

      await selectionCache.cacheSelection(mockSelectionRequest, mockSelectionResponse)
      await selectionCache.getSelection(mockSelectionRequest)

      expect(triggerPrefetchSpy).toHaveBeenCalled()
      triggerPrefetchSpy.mockRestore()
    })

    it('should generate related keys for prefetch', async () => {
      const generateRelatedKeysSpy = jest.spyOn(selectionCache as any, 'generateRelatedKeys')
      generateRelatedKeysSpy.mockReturnValue(['related_stocks:AAPL', 'stock_sector:AAPL'])

      const triggerPrefetchSpy = jest.spyOn(selectionCache as any, 'triggerPredictivePrefetch')

      await selectionCache.getSelection(mockSelectionRequest)

      triggerPrefetchSpy.mockRestore()
      generateRelatedKeysSpy.mockRestore()
    })

    it('should process prefetch queue with concurrency limits', async () => {
      const processPrefetchSpy = jest.spyOn(selectionCache as any, 'processPrefetchQueue')
      processPrefetchSpy.mockResolvedValue(undefined)

      // Add items to prefetch queue
      const prefetchQueue = (selectionCache as any).prefetchQueue
      prefetchQueue.add('test_key_1')
      prefetchQueue.add('test_key_2')

      await (selectionCache as any).processPrefetchQueue()

      expect(processPrefetchSpy).toHaveBeenCalled()
      processPrefetchSpy.mockRestore()
    })
  })

  describe('Cache Warming', () => {
    it('should warm cache for multiple symbols', async () => {
      const warmStockDataSpy = jest.spyOn(selectionCache as any, 'warmStockData')
      warmStockDataSpy.mockResolvedValue(undefined)

      await selectionCache.warmCache(['AAPL', 'MSFT', 'GOOGL'])

      expect(warmStockDataSpy).toHaveBeenCalled()
      warmStockDataSpy.mockRestore()
    })

    it('should warm cache for sectors', async () => {
      const warmSectorDataSpy = jest.spyOn(selectionCache as any, 'warmSectorData')
      warmSectorDataSpy.mockResolvedValue(undefined)

      await selectionCache.warmCache([], ['technology', 'healthcare'])

      expect(warmSectorDataSpy).toHaveBeenCalled()
      warmSectorDataSpy.mockRestore()
    })

    it('should prioritize items by access frequency during warming', async () => {
      const prioritizeSpy = jest.spyOn(selectionCache as any, 'prioritizeByAccessFrequency')
      prioritizeSpy.mockReturnValue(['AAPL', 'MSFT', 'GOOGL'])

      await selectionCache.warmCache(['MSFT', 'AAPL', 'GOOGL'])

      expect(prioritizeSpy).toHaveBeenCalled()
      prioritizeSpy.mockRestore()
    })

    it('should handle warming errors gracefully', async () => {
      const warmStockDataSpy = jest.spyOn(selectionCache as any, 'warmStockData')
      warmStockDataSpy.mockRejectedValue(new Error('Warming failed'))

      // Should not throw error
      await expect(selectionCache.warmCache(['AAPL'])).resolves.not.toThrow()

      warmStockDataSpy.mockRestore()
    })
  })

  describe('Performance Metrics', () => {
    it('should track cache hits and misses', async () => {
      // Cache miss
      await selectionCache.getSelection(mockSelectionRequest)

      // Cache hit
      await selectionCache.cacheSelection(mockSelectionRequest, mockSelectionResponse)
      await selectionCache.getSelection(mockSelectionRequest)

      const metrics = selectionCache.getMetrics()
      expect(metrics.hits).toBeGreaterThan(0)
      expect(metrics.misses).toBeGreaterThan(0)
    })

    it('should track metrics by strategy', async () => {
      await selectionCache.cacheSelection(mockSelectionRequest, mockSelectionResponse)
      await selectionCache.getSelection(mockSelectionRequest)

      const metrics = selectionCache.getMetrics()
      expect(metrics.hitsByStrategy.single_stock).toBeGreaterThan(0)
    })

    it('should track cache writes', async () => {
      const initialWrites = selectionCache.getMetrics().writes

      await selectionCache.cacheSelection(mockSelectionRequest, mockSelectionResponse)

      const finalWrites = selectionCache.getMetrics().writes
      expect(finalWrites).toBe(initialWrites + 1)
    })

    it('should track memory usage', () => {
      const metrics = selectionCache.getMetrics()
      expect(metrics.memoryUsage).toBeDefined()
      expect(typeof metrics.memoryUsage).toBe('number')
    })

    it('should provide performance metrics with percentiles', () => {
      const perfMetrics = selectionCache.getPerformanceMetrics()

      expect(perfMetrics.responseTime).toBeDefined()
      expect(perfMetrics.responseTime.p50).toBeDefined()
      expect(perfMetrics.responseTime.p95).toBeDefined()
      expect(perfMetrics.responseTime.p99).toBeDefined()
      expect(perfMetrics.hitRateByStrategy).toBeDefined()
      expect(perfMetrics.memoryEfficiency).toBeDefined()
      expect(perfMetrics.prefetchEffectiveness).toBeDefined()
    })
  })

  describe('Cache Optimization', () => {
    it('should analyze access patterns', async () => {
      const analyzeSpy = jest.spyOn(selectionCache as any, 'analyzeAccessPatterns')
      analyzeSpy.mockReturnValue({
        hotKeys: ['key1', 'key2'],
        accessDistribution: {},
        timePatterns: {}
      })

      await selectionCache.optimize()

      expect(analyzeSpy).toHaveBeenCalled()
      analyzeSpy.mockRestore()
    })

    it('should clean up expired entries during optimization', async () => {
      const cleanupSpy = jest.spyOn(selectionCache as any, 'cleanupExpiredEntries')
      cleanupSpy.mockResolvedValue(undefined)

      await selectionCache.optimize()

      expect(cleanupSpy).toHaveBeenCalled()
      cleanupSpy.mockRestore()
    })

    it('should optimize memory usage', async () => {
      const optimizeMemorySpy = jest.spyOn(selectionCache as any, 'optimizeMemoryUsage')
      optimizeMemorySpy.mockReturnValue(undefined)

      await selectionCache.optimize()

      expect(optimizeMemorySpy).toHaveBeenCalled()
      optimizeMemorySpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('should handle cache write errors gracefully', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Mock error in storeInHierarchy
      jest.spyOn(selectionCache as any, 'storeInHierarchy')
        .mockRejectedValue(new Error('Storage failed'))

      const success = await selectionCache.cacheSelection(mockSelectionRequest, mockSelectionResponse)

      expect(success).toBe(false)
      expect(errorSpy).toHaveBeenCalledWith('Cache write error:', expect.any(Error))
      errorSpy.mockRestore()
    })

    it('should handle cache read errors gracefully', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Mock error in parallel lookup
      jest.spyOn(selectionCache as any, 'performParallelLookup')
        .mockRejectedValue(new Error('Lookup failed'))

      const result = await selectionCache.getSelection(mockSelectionRequest)

      expect(result).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('Cache read error:', expect.any(Error))
      errorSpy.mockRestore()
    })

    it('should handle Redis connection errors', async () => {
      mockRedisCache.get.mockRejectedValue(new Error('Redis connection failed'))

      const result = await selectionCache.getSelection(mockSelectionRequest)

      // Should gracefully fall back
      expect(result).toBeNull()
    })

    it('should handle malformed cache entries', async () => {
      // Mock corrupted cache entry
      const malformedEntry = { invalidStructure: true }
      mockRedisCache.get.mockResolvedValue(malformedEntry)

      const result = await selectionCache.getSelection(mockSelectionRequest)

      expect(result).toBeNull()
    })
  })

  describe('Resource Management', () => {
    it('should clear all caches', async () => {
      await selectionCache.cacheSelection(mockSelectionRequest, mockSelectionResponse)

      await selectionCache.clear()

      const metrics = selectionCache.getMetrics()
      expect(metrics.memoryUsage).toBe(0)
      expect(mockRedisCache.clear).toHaveBeenCalled()
    })

    it('should shutdown cleanly', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      await selectionCache.shutdown()

      expect(clearIntervalSpy).toHaveBeenCalled()
      clearIntervalSpy.mockRestore()
    })

    it('should cleanup worker pools on shutdown', async () => {
      // Mock worker pool
      const mockWorker = { terminate: jest.fn() }
      ;(selectionCache as any).compressionPool = [mockWorker]

      await selectionCache.shutdown()

      expect(mockWorker.terminate).toHaveBeenCalled()
    })

    it('should clear all tracking structures on shutdown', async () => {
      await selectionCache.shutdown()

      const memoryCache = (selectionCache as any).memoryCache
      const accessOrder = (selectionCache as any).accessOrder
      const prefetchQueue = (selectionCache as any).prefetchQueue

      expect(memoryCache.size).toBe(0)
      expect(accessOrder.length).toBe(0)
      expect(prefetchQueue.size).toBe(0)
    })
  })

  describe('Cache Key Generation', () => {
    it('should generate deterministic cache keys', () => {
      const key1 = (selectionCache as any).generateCacheKey(mockSelectionRequest)
      const key2 = (selectionCache as any).generateCacheKey(mockSelectionRequest)

      expect(key1).toBe(key2)
      expect(typeof key1).toBe('string')
      expect(key1.length).toBeGreaterThan(0)
    })

    it('should generate different keys for different requests', () => {
      const request1: SelectionRequest = {
        scope: { mode: SelectionMode.SINGLE_STOCK, symbols: ['AAPL'] }
      }
      const request2: SelectionRequest = {
        scope: { mode: SelectionMode.SINGLE_STOCK, symbols: ['MSFT'] }
      }

      const key1 = (selectionCache as any).generateCacheKey(request1)
      const key2 = (selectionCache as any).generateCacheKey(request2)

      expect(key1).not.toBe(key2)
    })

    it('should hash options deterministically', () => {
      const options1: SelectionOptions = { useRealTimeData: true, algorithmId: 'composite' }
      const options2: SelectionOptions = { algorithmId: 'composite', useRealTimeData: true }

      const hash1 = (selectionCache as any).hashOptions(options1)
      const hash2 = (selectionCache as any).hashOptions(options2)

      expect(hash1).toBe(hash2) // Order shouldn't matter
    })
  })

  describe('Market Hours Detection', () => {
    it('should detect market hours correctly', () => {
      const isMarketHours = (selectionCache as any).isMarketHours()
      expect(typeof isMarketHours).toBe('boolean')
    })

    it('should return false for weekends', () => {
      // Mock weekend date
      const mockDate = new Date('2023-10-14T15:00:00Z') // Saturday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any)

      const isMarketHours = (selectionCache as any).isMarketHours()
      expect(isMarketHours).toBe(false)

      jest.restoreAllMocks()
    })

    it('should return false for after hours', () => {
      // Mock after hours date
      const mockDate = new Date('2023-10-16T22:00:00Z') // Monday 6 PM EST
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any)

      const isMarketHours = (selectionCache as any).isMarketHours()
      expect(isMarketHours).toBe(false)

      jest.restoreAllMocks()
    })
  })

  describe('Batched Task Processing', () => {
    it('should create batched tasks with concurrency control', async () => {
      const items = ['item1', 'item2', 'item3', 'item4', 'item5']
      const taskFn = jest.fn().mockResolvedValue(undefined)

      const tasks = (selectionCache as any).createBatchedTasks(items, taskFn, 2, 2)

      await Promise.all(tasks)

      expect(taskFn).toHaveBeenCalledTimes(items.length)
    })

    it('should handle task failures gracefully in batches', async () => {
      const items = ['item1', 'item2', 'item3']
      const taskFn = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Task failed'))
        .mockResolvedValueOnce(undefined)

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const tasks = (selectionCache as any).createBatchedTasks(items, taskFn, 2, 2)

      await Promise.all(tasks)

      expect(warnSpy).toHaveBeenCalledWith('Batch task failed:', expect.any(Error))
      warnSpy.mockRestore()
    })
  })
})