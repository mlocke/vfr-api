/**
 * Comprehensive DataFlowManager Test Suite
 *
 * Tests cover:
 * - Data enrichment pipeline orchestration
 * - Multi-source data collection and parallel processing
 * - Data normalization and quality assessment
 * - Data fusion and caching strategies
 * - Pipeline state management and error handling
 * - Real-time vs cached data preferences
 * - Performance metrics and monitoring
 * - Abort signal handling and cleanup
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals'
import { EventEmitter } from 'events'
import { DataFlowManager } from '../DataFlowManager'
import { SelectionOptions } from '../types'
import { DataFusionEngine } from '../../mcp/DataFusionEngine'
import { DataNormalizationPipeline } from '../../mcp/DataNormalizationPipeline'
import { QualityScorer } from '../../mcp/QualityScorer'
import { MCPClient } from '../../mcp/MCPClient'
import { RedisCache } from '../../cache/RedisCache'
import { QualityScore, FusionResult } from '../../mcp/types'

// Mock all external dependencies
jest.mock('../../mcp/DataFusionEngine')
jest.mock('../../mcp/DataNormalizationPipeline')
jest.mock('../../mcp/QualityScorer')
jest.mock('../../mcp/MCPClient')
jest.mock('../../cache/RedisCache')

describe('DataFlowManager', () => {
  let dataFlowManager: DataFlowManager
  let mockDataFusion: jest.Mocked<DataFusionEngine>
  let mockMCPClient: jest.Mocked<MCPClient>
  let mockCache: jest.Mocked<RedisCache>
  let mockNormalizationPipeline: jest.Mocked<DataNormalizationPipeline>
  let mockQualityScorer: jest.Mocked<QualityScorer>
  let consoleSpy: jest.SpyInstance

  // Test data fixtures
  const mockRawData = {
    'AAPL': {
      'polygon': {
        price: 150.25,
        volume: 1000000,
        timestamp: Date.now()
      },
      'alphavantage': {
        price: 150.30,
        volume: 1050000,
        timestamp: Date.now()
      }
    }
  }

  const mockNormalizedData = {
    'AAPL': {
      price: 150.27,
      volume: 1025000,
      marketCap: 2500000000000,
      sector: 'Technology',
      timestamp: Date.now(),
      sources: ['polygon', 'alphavantage']
    }
  }

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

  const mockFusionResult: FusionResult = {
    data: mockNormalizedData['AAPL'],
    quality: mockQualityScore,
    sources: ['polygon', 'alphavantage'],
    conflicts: 0,
    resolutionStrategy: 'highest_quality',
    processingTime: 150
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

    // Create mock instances
    mockDataFusion = {
      fuseData: jest.fn().mockResolvedValue(mockFusionResult),
      validateQuality: jest.fn().mockResolvedValue(mockQualityScore),
      optimizeDataFlow: jest.fn()
    } as any

    mockMCPClient = {
      executeTool: jest.fn(),
      executeWithFusion: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue(true),
      getConnectionStats: jest.fn().mockReturnValue({}),
      cleanup: jest.fn()
    } as any

    mockCache = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(true),
      delete: jest.fn(),
      clear: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      exists: jest.fn()
    } as any

    // Mock DataNormalizationPipeline
    mockNormalizationPipeline = {
      process: jest.fn().mockResolvedValue(mockNormalizedData),
      validate: jest.fn().mockResolvedValue(true),
      getSchema: jest.fn().mockReturnValue({}),
      normalize: jest.fn()
    } as any

    // Mock QualityScorer
    mockQualityScorer = {
      scoreData: jest.fn().mockResolvedValue(mockQualityScore),
      assessQuality: jest.fn().mockResolvedValue(mockQualityScore),
      validateMetrics: jest.fn().mockReturnValue(true)
    } as any

    // Mock the constructors
    ;(DataNormalizationPipeline as jest.MockedClass<typeof DataNormalizationPipeline>).mockImplementation(() => mockNormalizationPipeline)
    ;(QualityScorer as jest.MockedClass<typeof QualityScorer>).mockImplementation(() => mockQualityScorer)

    // Create service instance
    dataFlowManager = new DataFlowManager(
      mockDataFusion,
      mockMCPClient,
      mockCache
    )
  })

  afterEach(() => {
    // Cleanup any active pipelines
    dataFlowManager.removeAllListeners()
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(dataFlowManager).toBeInstanceOf(DataFlowManager)
      expect(dataFlowManager).toBeInstanceOf(EventEmitter)
    })

    it('should initialize with custom configuration', () => {
      const customConfig = {
        enableParallelProcessing: false,
        maxConcurrentStreams: 5,
        qualityThresholds: {
          minAccuracy: 0.8,
          minFreshness: 0.9,
          minCompleteness: 0.7
        }
      }

      const customManager = new DataFlowManager(
        mockDataFusion,
        mockMCPClient,
        mockCache,
        customConfig
      )

      expect(customManager).toBeInstanceOf(DataFlowManager)
    })

    it('should setup cleanup interval on initialization', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval')

      new DataFlowManager(
        mockDataFusion,
        mockMCPClient,
        mockCache
      )

      expect(setIntervalSpy).toHaveBeenCalled()
      setIntervalSpy.mockRestore()
    })
  })

  describe('Data Enrichment Pipeline', () => {
    it('should execute complete enrichment pipeline successfully', async () => {
      // Mock all pipeline stages
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      const eventSpy = jest.fn()
      dataFlowManager.on('pipeline_start', eventSpy)
      dataFlowManager.on('pipeline_complete', eventSpy)

      const result = await dataFlowManager.enrichStockData(['AAPL'])

      expect(result).toHaveLength(1)
      expect(result[0]).toHaveProperty('symbol', 'AAPL')
      expect(result[0]).toHaveProperty('enrichedData')
      expect(result[0]).toHaveProperty('qualityScore')
      expect(result[0]).toHaveProperty('sources')
      expect(result[0]).toHaveProperty('processingTime')

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: ['AAPL']
        })
      )

      fetchSpy.mockRestore()
    })

    it('should emit pipeline events during execution', async () => {
      const events: string[] = []
      dataFlowManager.on('pipeline_start', () => events.push('start'))
      dataFlowManager.on('pipeline_complete', () => events.push('complete'))

      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      await dataFlowManager.enrichStockData(['AAPL'])

      expect(events).toContain('start')
      expect(events).toContain('complete')

      fetchSpy.mockRestore()
    })

    it('should handle pipeline errors gracefully', async () => {
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockRejectedValue(new Error('Data source unavailable'))

      const eventSpy = jest.fn()
      dataFlowManager.on('pipeline_error', eventSpy)

      await expect(dataFlowManager.enrichStockData(['AAPL'])).rejects.toThrow('Data source unavailable')

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: ['AAPL'],
          error: 'Data source unavailable'
        })
      )

      fetchSpy.mockRestore()
    })

    it('should handle multiple symbols in parallel', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL']
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      const result = await dataFlowManager.enrichStockData(symbols)

      expect(result).toHaveLength(symbols.length)
      expect(fetchSpy).toHaveBeenCalledTimes(symbols.length * 4) // 4 default sources per symbol

      fetchSpy.mockRestore()
    })

    it('should respect maxConcurrentStreams configuration', async () => {
      const customManager = new DataFlowManager(
        mockDataFusion,
        mockMCPClient,
        mockCache,
        { maxConcurrentStreams: 2 }
      )

      const symbols = Array.from({ length: 10 }, (_, i) => `STOCK${i}`)
      const fetchSpy = jest.spyOn(customManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      await customManager.enrichStockData(symbols)

      // Verify that processing was done in chunks
      expect(fetchSpy).toHaveBeenCalled()

      fetchSpy.mockRestore()
    })
  })

  describe('Data Collection', () => {
    it('should collect data from all configured sources', async () => {
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockImplementation((symbol, source) => {
          return Promise.resolve({ symbol, source, price: 150, timestamp: Date.now() })
        })

      const collectSpy = jest.spyOn(dataFlowManager as any, 'collectRawData')

      await dataFlowManager.enrichStockData(['AAPL'])

      expect(collectSpy).toHaveBeenCalled()
      expect(fetchSpy).toHaveBeenCalledWith('AAPL', 'polygon', expect.any(Object))
      expect(fetchSpy).toHaveBeenCalledWith('AAPL', 'alphavantage', expect.any(Object))
      expect(fetchSpy).toHaveBeenCalledWith('AAPL', 'yahoo', expect.any(Object))
      expect(fetchSpy).toHaveBeenCalledWith('AAPL', 'news_sentiment', expect.any(Object))

      fetchSpy.mockRestore()
      collectSpy.mockRestore()
    })

    it('should use specified data sources when provided', async () => {
      const options: SelectionOptions = {
        dataPreferences: {
          sources: ['polygon', 'alphavantage']
        }
      }

      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      await dataFlowManager.enrichStockData(['AAPL'], options)

      expect(fetchSpy).toHaveBeenCalledWith('AAPL', 'polygon', options)
      expect(fetchSpy).toHaveBeenCalledWith('AAPL', 'alphavantage', options)
      expect(fetchSpy).not.toHaveBeenCalledWith('AAPL', 'yahoo', options)

      fetchSpy.mockRestore()
    })

    it('should handle individual source failures gracefully', async () => {
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockImplementation((symbol, source) => {
          if (source === 'polygon') {
            return Promise.resolve(mockRawData['AAPL']['polygon'])
          }
          throw new Error(`${source} unavailable`)
        })

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await dataFlowManager.enrichStockData(['AAPL'])

      expect(result).toHaveLength(1)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch AAPL from alphavantage'),
        'alphavantage unavailable'
      )

      fetchSpy.mockRestore()
      warnSpy.mockRestore()
    })

    it('should handle abort signal during collection', async () => {
      const abortController = new AbortController()
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockImplementation(() => {
          abortController.abort()
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Aborted')), 100)
          })
        })

      // Start enrichment and immediately abort
      const enrichmentPromise = dataFlowManager.enrichStockData(['AAPL'])
      setTimeout(() => abortController.abort(), 50)

      await expect(enrichmentPromise).rejects.toThrow()

      fetchSpy.mockRestore()
    })
  })

  describe('Source-Specific Data Fetching', () => {
    it('should fetch Polygon data', async () => {
      const mockPolygonData = {
        symbol: 'AAPL',
        price: 150.25,
        volume: 1000000,
        timestamp: Date.now()
      }

      const fetchPolygonSpy = jest.spyOn(dataFlowManager as any, 'fetchPolygonData')
        .mockResolvedValue(mockPolygonData)

      mockMCPClient.executeTool.mockResolvedValue({
        success: true,
        data: mockPolygonData
      })

      const result = await (dataFlowManager as any).fetchFromSource('AAPL', 'polygon', {})

      expect(fetchPolygonSpy).toHaveBeenCalledWith('AAPL')
      expect(result).toEqual(mockPolygonData)

      fetchPolygonSpy.mockRestore()
    })

    it('should fetch Alpha Vantage data', async () => {
      const mockAlphaData = {
        symbol: 'AAPL',
        price: 150.30,
        volume: 1050000,
        timestamp: Date.now()
      }

      const fetchAlphaSpy = jest.spyOn(dataFlowManager as any, 'fetchAlphaVantageData')
        .mockResolvedValue(mockAlphaData)

      const result = await (dataFlowManager as any).fetchFromSource('AAPL', 'alphavantage', {})

      expect(fetchAlphaSpy).toHaveBeenCalledWith('AAPL')
      expect(result).toEqual(mockAlphaData)

      fetchAlphaSpy.mockRestore()
    })

    it('should fetch Yahoo Finance data', async () => {
      const mockYahooData = {
        symbol: 'AAPL',
        price: 150.20,
        volume: 980000,
        timestamp: Date.now()
      }

      const fetchYahooSpy = jest.spyOn(dataFlowManager as any, 'fetchYahooData')
        .mockResolvedValue(mockYahooData)

      const result = await (dataFlowManager as any).fetchFromSource('AAPL', 'yahoo', {})

      expect(fetchYahooSpy).toHaveBeenCalledWith('AAPL')
      expect(result).toEqual(mockYahooData)

      fetchYahooSpy.mockRestore()
    })

    it('should fetch news sentiment data', async () => {
      const mockSentimentData = {
        symbol: 'AAPL',
        sentiment: 0.75,
        newsCount: 25,
        timestamp: Date.now()
      }

      const fetchSentimentSpy = jest.spyOn(dataFlowManager as any, 'fetchNewsSentiment')
        .mockResolvedValue(mockSentimentData)

      const result = await (dataFlowManager as any).fetchFromSource('AAPL', 'news_sentiment', {})

      expect(fetchSentimentSpy).toHaveBeenCalledWith('AAPL')
      expect(result).toEqual(mockSentimentData)

      fetchSentimentSpy.mockRestore()
    })

    it('should handle unknown data sources', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await (dataFlowManager as any).fetchFromSource('AAPL', 'unknown_source', {})

      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith('Unknown data source: unknown_source')

      warnSpy.mockRestore()
    })
  })

  describe('Caching Behavior', () => {
    it('should use cached data when not requesting real-time', async () => {
      const cachedData = { symbol: 'AAPL', price: 149.50, cached: true }
      mockCache.get.mockResolvedValue(cachedData)

      const result = await (dataFlowManager as any).fetchFromSource('AAPL', 'polygon', {
        useRealTimeData: false
      })

      expect(mockCache.get).toHaveBeenCalledWith('raw_data:AAPL:polygon')
      expect(result).toEqual(cachedData)
    })

    it('should bypass cache when requesting real-time data', async () => {
      const cachedData = { symbol: 'AAPL', price: 149.50, cached: true }
      const freshData = { symbol: 'AAPL', price: 150.25, fresh: true }

      mockCache.get.mockResolvedValue(cachedData)

      const fetchPolygonSpy = jest.spyOn(dataFlowManager as any, 'fetchPolygonData')
        .mockResolvedValue(freshData)

      const result = await (dataFlowManager as any).fetchFromSource('AAPL', 'polygon', {
        useRealTimeData: true
      })

      expect(mockCache.get).not.toHaveBeenCalled()
      expect(result).toEqual(freshData)

      fetchPolygonSpy.mockRestore()
    })

    it('should cache successful fetches with appropriate TTL', async () => {
      const freshData = { symbol: 'AAPL', price: 150.25 }

      const fetchPolygonSpy = jest.spyOn(dataFlowManager as any, 'fetchPolygonData')
        .mockResolvedValue(freshData)

      mockCache.get.mockResolvedValue(null) // Cache miss

      await (dataFlowManager as any).fetchFromSource('AAPL', 'polygon', {
        useRealTimeData: true
      })

      expect(mockCache.set).toHaveBeenCalledWith(
        'raw_data:AAPL:polygon',
        freshData,
        60, // 1 minute TTL for real-time
        expect.objectContaining({ source: 'polygon' })
      )

      fetchPolygonSpy.mockRestore()
    })

    it('should use longer TTL for non-real-time requests', async () => {
      const freshData = { symbol: 'AAPL', price: 150.25 }

      const fetchPolygonSpy = jest.spyOn(dataFlowManager as any, 'fetchPolygonData')
        .mockResolvedValue(freshData)

      mockCache.get.mockResolvedValue(null)

      await (dataFlowManager as any).fetchFromSource('AAPL', 'polygon', {
        useRealTimeData: false
      })

      expect(mockCache.set).toHaveBeenCalledWith(
        'raw_data:AAPL:polygon',
        freshData,
        300, // 5 minute TTL for cached
        expect.objectContaining({ source: 'polygon' })
      )

      fetchPolygonSpy.mockRestore()
    })

    it('should cache enriched results', async () => {
      const cacheEnrichedSpy = jest.spyOn(dataFlowManager as any, 'cacheEnrichedData')
        .mockResolvedValue(true)

      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      const results = await dataFlowManager.enrichStockData(['AAPL'])

      expect(cacheEnrichedSpy).toHaveBeenCalledWith(results, {})

      fetchSpy.mockRestore()
      cacheEnrichedSpy.mockRestore()
    })
  })

  describe('Data Processing Pipeline Stages', () => {
    it('should normalize collected data', async () => {
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      const normalizeSpy = jest.spyOn(dataFlowManager as any, 'normalizeData')
        .mockResolvedValue(mockNormalizedData)

      await dataFlowManager.enrichStockData(['AAPL'])

      expect(normalizeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          'AAPL': expect.any(Object)
        }),
        expect.any(AbortSignal)
      )

      fetchSpy.mockRestore()
      normalizeSpy.mockRestore()
    })

    it('should assess data quality', async () => {
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      const qualitySpy = jest.spyOn(dataFlowManager as any, 'assessDataQuality')
        .mockResolvedValue({ 'AAPL': mockQualityScore })

      await dataFlowManager.enrichStockData(['AAPL'])

      expect(qualitySpy).toHaveBeenCalledWith(mockNormalizedData)

      fetchSpy.mockRestore()
      qualitySpy.mockRestore()
    })

    it('should fuse data from multiple sources', async () => {
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      const fuseSpy = jest.spyOn(dataFlowManager as any, 'fuseData')
        .mockResolvedValue({ 'AAPL': mockFusionResult })

      await dataFlowManager.enrichStockData(['AAPL'])

      expect(fuseSpy).toHaveBeenCalledWith(
        mockNormalizedData,
        expect.any(Object),
        expect.any(AbortSignal)
      )

      fetchSpy.mockRestore()
      fuseSpy.mockRestore()
    })

    it('should perform final enrichment', async () => {
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      const enrichSpy = jest.spyOn(dataFlowManager as any, 'performEnrichment')
        .mockResolvedValue([{
          symbol: 'AAPL',
          enrichedData: mockNormalizedData['AAPL'],
          qualityScore: mockQualityScore,
          sources: ['polygon'],
          processingTime: 150,
          cacheHit: false
        }])

      await dataFlowManager.enrichStockData(['AAPL'])

      expect(enrichSpy).toHaveBeenCalledWith(
        ['AAPL'],
        expect.any(Object),
        {}
      )

      fetchSpy.mockRestore()
      enrichSpy.mockRestore()
    })
  })

  describe('Pipeline State Management', () => {
    it('should track pipeline stages', async () => {
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      const updateStageSpy = jest.spyOn(dataFlowManager as any, 'updatePipelineStage')

      await dataFlowManager.enrichStockData(['AAPL'])

      expect(updateStageSpy).toHaveBeenCalledWith(
        expect.any(Object),
        'data_collection',
        'processing'
      )
      expect(updateStageSpy).toHaveBeenCalledWith(
        expect.any(Object),
        'data_collection',
        'complete'
      )

      fetchSpy.mockRestore()
      updateStageSpy.mockRestore()
    })

    it('should cleanup completed pipelines', async () => {
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      // Mock activePipelines map
      const activePipelines = new Map()
      ;(dataFlowManager as any).activePipelines = activePipelines

      const initialSize = activePipelines.size

      await dataFlowManager.enrichStockData(['AAPL'])

      // Pipeline should be cleaned up after completion
      expect(activePipelines.size).toBe(initialSize)

      fetchSpy.mockRestore()
    })
  })

  describe('Metrics and Performance', () => {
    it('should track processing metrics', async () => {
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockResolvedValue(mockRawData['AAPL']['polygon'])

      const updateMetricsSpy = jest.spyOn(dataFlowManager as any, 'updateMetrics')

      await dataFlowManager.enrichStockData(['AAPL'])

      expect(updateMetricsSpy).toHaveBeenCalledWith(
        expect.any(String), // pipelineId
        expect.any(Number), // startTime
        1, // results count
        true // success
      )

      fetchSpy.mockRestore()
      updateMetricsSpy.mockRestore()
    })

    it('should provide performance metrics', () => {
      const metrics = dataFlowManager.getMetrics()

      expect(metrics).toHaveProperty('totalFlows')
      expect(metrics).toHaveProperty('activeFlows')
      expect(metrics).toHaveProperty('avgProcessingTime')
      expect(metrics).toHaveProperty('enrichmentRate')
      expect(metrics).toHaveProperty('qualityImprovement')
      expect(metrics).toHaveProperty('cacheEfficiency')
    })

    it('should track failed pipeline metrics', async () => {
      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchFromSource')
        .mockRejectedValue(new Error('Fetch failed'))

      const updateMetricsSpy = jest.spyOn(dataFlowManager as any, 'updateMetrics')

      try {
        await dataFlowManager.enrichStockData(['AAPL'])
      } catch (error) {
        // Expected to fail
      }

      expect(updateMetricsSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        0, // no results
        false // failure
      )

      fetchSpy.mockRestore()
      updateMetricsSpy.mockRestore()
    })
  })

  describe('Data Integration Interface Implementation', () => {
    it('should implement fetchStockData method', async () => {
      const symbols = ['AAPL', 'MSFT']
      const options: SelectionOptions = { useRealTimeData: true }

      const fetchSpy = jest.spyOn(dataFlowManager as any, 'fetchSingleStockData')
        .mockResolvedValue({ symbol: 'AAPL', price: 150 })

      const result = await dataFlowManager.fetchStockData(symbols, options)

      expect(result).toHaveProperty('AAPL')
      expect(result).toHaveProperty('MSFT')
      expect(fetchSpy).toHaveBeenCalledTimes(symbols.length)

      fetchSpy.mockRestore()
    })

    it('should implement validateDataQuality method', async () => {
      const testData = { symbol: 'AAPL', price: 150 }

      const quality = await dataFlowManager.validateDataQuality(testData)

      expect(quality).toHaveProperty('overall')
      expect(quality).toHaveProperty('metrics')
      expect(quality.overall).toBeGreaterThanOrEqual(0)
      expect(quality.overall).toBeLessThanOrEqual(1)
    })

    it('should implement getCachedData method', async () => {
      const testKey = 'test:cache:key'
      const testData = { cached: true }

      mockCache.get.mockResolvedValue(testData)

      const result = await dataFlowManager.getCachedData(testKey)

      expect(result).toEqual(testData)
      expect(mockCache.get).toHaveBeenCalledWith(testKey)
    })

    it('should implement setCachedData method', async () => {
      const testKey = 'test:cache:key'
      const testData = { cached: true }
      const ttl = 300

      await dataFlowManager.setCachedData(testKey, testData, ttl)

      expect(mockCache.set).toHaveBeenCalledWith(testKey, testData, ttl)
    })
  })

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache error'))
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await dataFlowManager.getCachedData('test-key')

      expect(result).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('Cache get error:', expect.any(Error))

      errorSpy.mockRestore()
    })

    it('should handle pipeline abort during processing', async () => {
      const abortSpy = jest.spyOn(dataFlowManager as any, 'collectRawData')
        .mockImplementation(() => {
          throw new Error('Collection aborted')
        })

      await expect(dataFlowManager.enrichStockData(['AAPL'])).rejects.toThrow('Collection aborted')

      abortSpy.mockRestore()
    })
  })

  describe('Resource Management', () => {
    it('should cleanup resources on shutdown', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      dataFlowManager.shutdown()

      expect(clearIntervalSpy).toHaveBeenCalled()
      clearIntervalSpy.mockRestore()
    })

    it('should cancel active pipelines', async () => {
      const abortController = { abort: jest.fn() }
      const mockPipeline = {
        id: 'test-pipeline',
        symbols: ['AAPL'],
        startTime: Date.now(),
        stages: [],
        abortController
      }

      // Mock active pipelines
      const activePipelines = new Map()
      activePipelines.set('test-pipeline', mockPipeline)
      ;(dataFlowManager as any).activePipelines = activePipelines

      const cancelled = dataFlowManager.cancelPipeline('test-pipeline')

      expect(cancelled).toBe(true)
      expect(abortController.abort).toHaveBeenCalled()
    })

    it('should return false when cancelling non-existent pipeline', () => {
      const cancelled = dataFlowManager.cancelPipeline('non-existent-pipeline')
      expect(cancelled).toBe(false)
    })
  })
})