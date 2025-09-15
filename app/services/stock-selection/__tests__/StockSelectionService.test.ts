/**
 * Comprehensive StockSelectionService Test Suite
 *
 * Tests cover:
 * - All selection modes (single, sector, multiple stocks)
 * - Integration with AlgorithmEngine and MCP infrastructure
 * - Caching strategies and performance optimization
 * - Error handling and timeout scenarios
 * - Real-time data integration
 * - Event emission and service management
 * - Data quality validation and fusion
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals'
import { EventEmitter } from 'events'
import { StockSelectionService, createStockSelectionService } from '../StockSelectionService'
import {
  SelectionRequest,
  SelectionResponse,
  SelectionMode,
  SelectionOptions,
  EnhancedStockResult,
  SectorAnalysisResult,
  MultiStockAnalysisResult,
  SelectionServiceEvent
} from '../types'
import { AlgorithmEngine } from '../../algorithms/AlgorithmEngine'
import { DataFusionEngine } from '../../mcp/DataFusionEngine'
import { MCPClient } from '../../mcp/MCPClient'
import { FactorLibrary } from '../../algorithms/FactorLibrary'
import { RedisCache } from '../../cache/RedisCache'
import { SelectionResult, StockScore, AlgorithmType } from '../../algorithms/types'
import { QualityScore } from '../../mcp/types'
import { SectorOption } from '../../../components/SectorDropdown'

// Mock all external dependencies
jest.mock('../../algorithms/AlgorithmEngine')
jest.mock('../../mcp/DataFusionEngine')
jest.mock('../../mcp/MCPClient')
jest.mock('../../algorithms/FactorLibrary')
jest.mock('../../cache/RedisCache')
jest.mock('../integration/AlgorithmIntegration')
jest.mock('../integration/SectorIntegration')

// Mock SectorDropdown component type
jest.mock('../../../components/SectorDropdown', () => ({
  SectorOption: {}
}))

describe('StockSelectionService', () => {
  let stockSelectionService: StockSelectionService
  let mockMCPClient: jest.Mocked<MCPClient>
  let mockDataFusion: jest.Mocked<DataFusionEngine>
  let mockFactorLibrary: jest.Mocked<FactorLibrary>
  let mockCache: jest.Mocked<RedisCache>
  let consoleSpy: jest.SpyInstance

  // Test data fixtures
  const mockStockScore: StockScore = {
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
    dataQuality: {
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
  }

  const mockSelectionResult: SelectionResult = {
    selections: [
      {
        symbol: 'AAPL',
        score: mockStockScore,
        weight: 1.0,
        action: 'BUY',
        confidence: 0.88
      }
    ],
    metadata: {
      algorithmUsed: AlgorithmType.COMPOSITE,
      executionTime: 1500,
      dataSourcesUsed: ['polygon', 'alphavantage'],
      confidence: 0.88
    },
    metrics: {
      totalStocksEvaluated: 1,
      avgConfidence: 0.88,
      dataQualityScore: 0.9,
      processingTime: 1500
    }
  }

  const mockSectorOption: SectorOption = {
    id: 'technology',
    label: 'Technology',
    category: 'sector'
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
    mockMCPClient = {
      executeTool: jest.fn(),
      executeWithFusion: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue(true),
      getConnectionStats: jest.fn().mockReturnValue({}),
      cleanup: jest.fn()
    } as any

    mockDataFusion = {
      fuseData: jest.fn(),
      validateQuality: jest.fn().mockResolvedValue(mockQualityScore),
      optimizeDataFlow: jest.fn()
    } as any

    mockFactorLibrary = {
      getFactorList: jest.fn().mockReturnValue(['momentum', 'value', 'quality']),
      calculateFactor: jest.fn().mockReturnValue(0.8),
      getFactorWeights: jest.fn().mockReturnValue({ momentum: 0.3, value: 0.4, quality: 0.3 })
    } as any

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      exists: jest.fn()
    } as any

    // Create service instance
    stockSelectionService = new StockSelectionService(
      mockMCPClient,
      mockDataFusion,
      mockFactorLibrary,
      mockCache
    )
  })

  afterEach(async () => {
    // Cleanup any active requests or intervals
    if (stockSelectionService) {
      await stockSelectionService.clearCache()
    }
  })

  describe('Service Initialization', () => {
    it('should initialize with all required dependencies', () => {
      expect(stockSelectionService).toBeInstanceOf(StockSelectionService)
      expect(stockSelectionService).toBeInstanceOf(EventEmitter)
    })

    it('should perform health check during initialization via factory', async () => {
      mockMCPClient.healthCheck = jest.fn().mockResolvedValue(true)
      mockCache.ping = jest.fn().mockResolvedValue('PONG')

      const service = await createStockSelectionService(
        mockMCPClient,
        mockDataFusion,
        mockFactorLibrary,
        mockCache
      )

      expect(service).toBeInstanceOf(StockSelectionService)
    })

    it('should warn about unhealthy dependencies during initialization', async () => {
      mockMCPClient.healthCheck = jest.fn().mockResolvedValue(false)
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      await createStockSelectionService(
        mockMCPClient,
        mockDataFusion,
        mockFactorLibrary,
        mockCache
      )

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('unhealthy dependencies')
      )
      warnSpy.mockRestore()
    })
  })

  describe('Single Stock Analysis', () => {
    const singleStockRequest: SelectionRequest = {
      scope: {
        mode: SelectionMode.SINGLE_STOCK,
        symbols: ['AAPL']
      },
      options: {
        algorithmId: AlgorithmType.COMPOSITE,
        useRealTimeData: true
      }
    }

    it('should execute single stock analysis successfully', async () => {
      // Mock algorithm integration
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue(mockSelectionResult)
      }))

      // Mock cache miss
      mockCache.get.mockResolvedValue(null)
      mockCache.set.mockResolvedValue(true)

      const result = await stockSelectionService.selectStocks(singleStockRequest)

      expect(result.success).toBe(true)
      expect(result.singleStock).toBeDefined()
      expect(result.singleStock?.symbol).toBe('AAPL')
      expect(result.topSelections).toHaveLength(1)
      expect(result.metadata.analysisMode).toBe(SelectionMode.SINGLE_STOCK)
    })

    it('should return cached result for single stock analysis', async () => {
      const cachedResult = {
        symbol: 'AAPL',
        score: mockStockScore,
        weight: 1.0,
        action: 'BUY',
        confidence: 0.88
      }

      mockCache.get.mockResolvedValue(cachedResult)

      const result = await stockSelectionService.selectStocks(singleStockRequest)

      expect(result.success).toBe(true)
      expect(result.singleStock).toEqual(cachedResult)
      expect(mockCache.get).toHaveBeenCalled()
    })

    it('should handle single stock analysis with no symbol', async () => {
      const invalidRequest: SelectionRequest = {
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: []
        }
      }

      const result = await stockSelectionService.selectStocks(invalidRequest)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Single stock analysis requires at least one symbol')
    })

    it('should warn when multiple symbols provided for single stock analysis', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const multiSymbolRequest: SelectionRequest = {
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL', 'MSFT']
        }
      }

      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue(mockSelectionResult)
      }))

      mockCache.get.mockResolvedValue(null)

      await stockSelectionService.selectStocks(multiSymbolRequest)

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Single stock analysis with multiple symbols')
      )
      warnSpy.mockRestore()
    })

    it('should enhance single stock result with additional context', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue(mockSelectionResult)
      }))

      mockCache.get.mockResolvedValue(null)

      const result = await stockSelectionService.selectStocks(singleStockRequest)

      expect(result.singleStock?.context).toBeDefined()
      expect(result.singleStock?.context.sector).toBe('Technology')
      expect(result.singleStock?.reasoning).toBeDefined()
      expect(result.singleStock?.reasoning.primaryFactors).toBeInstanceOf(Array)
      expect(result.singleStock?.dataQuality).toBeDefined()
    })
  })

  describe('Sector Analysis', () => {
    const sectorRequest: SelectionRequest = {
      scope: {
        mode: SelectionMode.SECTOR_ANALYSIS,
        sector: mockSectorOption,
        maxResults: 10
      },
      options: {
        algorithmId: AlgorithmType.COMPOSITE
      }
    }

    it('should execute sector analysis successfully', async () => {
      // Mock sector integration
      const mockSectorIntegration = require('../integration/SectorIntegration')
      mockSectorIntegration.SectorIntegration.mockImplementation(() => ({
        getSectorStocks: jest.fn().mockResolvedValue(['AAPL', 'MSFT', 'GOOGL']),
        getSectorMetrics: jest.fn().mockResolvedValue({
          momentum: { strength: 0.8 },
          valuation: { avgPE: 25 },
          quality: { growth: 0.75 },
          marketCap: { total: 5000000000000 }
        })
      }))

      // Mock algorithm integration for multi-stock analysis
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue({
          ...mockSelectionResult,
          selections: [
            { symbol: 'AAPL', score: mockStockScore, weight: 0.4, action: 'BUY', confidence: 0.9 },
            { symbol: 'MSFT', score: mockStockScore, weight: 0.35, action: 'BUY', confidence: 0.85 },
            { symbol: 'GOOGL', score: mockStockScore, weight: 0.25, action: 'HOLD', confidence: 0.8 }
          ],
          metrics: {
            totalStocksEvaluated: 3,
            avgConfidence: 0.85,
            dataQualityScore: 0.9,
            processingTime: 2500
          }
        })
      }))

      mockCache.get.mockResolvedValue(null)

      const result = await stockSelectionService.selectStocks(sectorRequest)

      expect(result.success).toBe(true)
      expect(result.sectorAnalysis).toBeDefined()
      expect(result.sectorAnalysis?.sector).toEqual(mockSectorOption)
      expect(result.sectorAnalysis?.overview.totalStocks).toBe(3)
      expect(result.sectorAnalysis?.topSelections).toHaveLength(3)
      expect(result.sectorAnalysis?.sectorMetrics).toBeDefined()
    })

    it('should handle sector analysis without sector specification', async () => {
      const invalidRequest: SelectionRequest = {
        scope: {
          mode: SelectionMode.SECTOR_ANALYSIS
        }
      }

      const result = await stockSelectionService.selectStocks(invalidRequest)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Sector analysis requires sector specification')
    })

    it('should handle sector with no stocks found', async () => {
      const mockSectorIntegration = require('../integration/SectorIntegration')
      mockSectorIntegration.SectorIntegration.mockImplementation(() => ({
        getSectorStocks: jest.fn().mockResolvedValue([]),
        getSectorMetrics: jest.fn().mockResolvedValue({})
      }))

      mockCache.get.mockResolvedValue(null)

      const result = await stockSelectionService.selectStocks(sectorRequest)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('No stocks found for sector: Technology')
    })

    it('should limit sector stocks for performance', async () => {
      const mockSectorIntegration = require('../integration/SectorIntegration')
      const largeSectorStocks = Array.from({ length: 100 }, (_, i) => `STOCK${i}`)

      mockSectorIntegration.SectorIntegration.mockImplementation(() => ({
        getSectorStocks: jest.fn().mockResolvedValue(largeSectorStocks),
        getSectorMetrics: jest.fn().mockResolvedValue({})
      }))

      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockImplementation((request) => {
          // Verify that symbols are limited
          expect(request.scope.symbols?.length).toBeLessThanOrEqual(50)
          return Promise.resolve(mockSelectionResult)
        })
      }))

      mockCache.get.mockResolvedValue(null)

      await stockSelectionService.selectStocks(sectorRequest)
    })
  })

  describe('Multiple Stocks Analysis', () => {
    const multiStockRequest: SelectionRequest = {
      scope: {
        mode: SelectionMode.MULTIPLE_STOCKS,
        symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN']
      },
      options: {
        algorithmId: AlgorithmType.COMPOSITE
      }
    }

    it('should execute multi-stock analysis successfully', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue({
          ...mockSelectionResult,
          selections: [
            { symbol: 'AAPL', score: mockStockScore, weight: 0.3, action: 'BUY', confidence: 0.9 },
            { symbol: 'MSFT', score: mockStockScore, weight: 0.25, action: 'BUY', confidence: 0.85 },
            { symbol: 'GOOGL', score: mockStockScore, weight: 0.25, action: 'HOLD', confidence: 0.8 },
            { symbol: 'AMZN', score: mockStockScore, weight: 0.2, action: 'HOLD', confidence: 0.75 }
          ]
        })
      }))

      mockCache.get.mockResolvedValue(null)

      const result = await stockSelectionService.selectStocks(multiStockRequest)

      expect(result.success).toBe(true)
      expect(result.multiStockAnalysis).toBeDefined()
      expect(result.multiStockAnalysis?.results).toHaveLength(4)
      expect(result.multiStockAnalysis?.portfolioMetrics).toBeDefined()
      expect(result.multiStockAnalysis?.recommendations).toBeDefined()
      expect(result.topSelections).toHaveLength(4)
    })

    it('should handle multi-stock analysis with no symbols', async () => {
      const invalidRequest: SelectionRequest = {
        scope: {
          mode: SelectionMode.MULTIPLE_STOCKS,
          symbols: []
        }
      }

      const result = await stockSelectionService.selectStocks(invalidRequest)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Multi-stock analysis requires at least one symbol')
    })

    it('should calculate portfolio metrics correctly', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue({
          ...mockSelectionResult,
          selections: [
            {
              symbol: 'AAPL',
              score: { ...mockStockScore, marketData: { ...mockStockScore.marketData, marketCap: 3000000000000 } },
              weight: 0.5,
              action: 'BUY',
              confidence: 0.9
            },
            {
              symbol: 'MSFT',
              score: { ...mockStockScore, marketData: { ...mockStockScore.marketData, marketCap: 1500000000000, sector: 'Financial' } },
              weight: 0.5,
              action: 'BUY',
              confidence: 0.85
            }
          ]
        })
      }))

      mockCache.get.mockResolvedValue(null)

      const result = await stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.MULTIPLE_STOCKS,
          symbols: ['AAPL', 'MSFT']
        }
      })

      expect(result.multiStockAnalysis?.portfolioMetrics.sectorBreakdown).toBeDefined()
      expect(result.multiStockAnalysis?.portfolioMetrics.marketCapBreakdown).toBeDefined()
      expect(result.multiStockAnalysis?.portfolioMetrics.diversificationScore).toBeGreaterThan(0)
    })
  })

  describe('Request Validation', () => {
    it('should reject requests without scope', async () => {
      const invalidRequest = {
        options: { algorithmId: AlgorithmType.COMPOSITE }
      } as any

      const result = await stockSelectionService.selectStocks(invalidRequest)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Request scope is required')
    })

    it('should reject requests with too many symbols', async () => {
      const symbols = Array.from({ length: 101 }, (_, i) => `STOCK${i}`)
      const invalidRequest: SelectionRequest = {
        scope: {
          mode: SelectionMode.MULTIPLE_STOCKS,
          symbols
        }
      }

      const result = await stockSelectionService.selectStocks(invalidRequest)

      expect(result.success).toBe(false)
      expect(result.errors?.[0]).toContain('Too many symbols')
    })

    it('should reject requests when max concurrent requests exceeded', async () => {
      // Mock the private method to simulate max concurrent requests
      const validateRequestSpy = jest.spyOn(stockSelectionService as any, 'validateRequest')
      validateRequestSpy.mockImplementation(() => {
        throw new Error('Too many concurrent requests')
      })

      const request: SelectionRequest = {
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      }

      const result = await stockSelectionService.selectStocks(request)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Too many concurrent requests')

      validateRequestSpy.mockRestore()
    })
  })

  describe('Timeout Handling', () => {
    it('should handle request timeout', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
        )
      }))

      mockCache.get.mockResolvedValue(null)

      const request: SelectionRequest = {
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        },
        options: {
          timeout: 1000 // 1 second timeout
        }
      }

      const result = await stockSelectionService.selectStocks(request)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Request timeout')
    })

    it('should use default timeout when not specified', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue(mockSelectionResult)
      }))

      mockCache.get.mockResolvedValue(null)

      const request: SelectionRequest = {
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      }

      const result = await stockSelectionService.selectStocks(request)

      expect(result.success).toBe(true)
    })
  })

  describe('Event Emission', () => {
    it('should emit request_start event', async () => {
      const eventSpy = jest.fn()
      stockSelectionService.on('event', eventSpy)

      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue(mockSelectionResult)
      }))

      mockCache.get.mockResolvedValue(null)

      await stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      })

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request_start'
        })
      )
    })

    it('should emit request_complete event on success', async () => {
      const eventSpy = jest.fn()
      stockSelectionService.on('event', eventSpy)

      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue(mockSelectionResult)
      }))

      mockCache.get.mockResolvedValue(null)

      await stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      })

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request_complete',
          data: expect.objectContaining({
            success: true
          })
        })
      )
    })

    it('should emit request_error event on failure', async () => {
      const eventSpy = jest.fn()
      stockSelectionService.on('event', eventSpy)

      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockRejectedValue(new Error('Algorithm failed'))
      }))

      mockCache.get.mockResolvedValue(null)

      await stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      })

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request_error',
          data: expect.objectContaining({
            error: 'Algorithm failed'
          })
        })
      )
    })

    it('should emit cache_hit event when cache is used', async () => {
      const eventSpy = jest.fn()
      stockSelectionService.on('event', eventSpy)

      const cachedResult = { symbol: 'AAPL', score: mockStockScore }
      mockCache.get.mockResolvedValue(cachedResult)

      await stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      })

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cache_hit'
        })
      )
    })
  })

  describe('Caching Functionality', () => {
    it('should cache successful results', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue(mockSelectionResult)
      }))

      mockCache.get.mockResolvedValue(null)
      mockCache.set.mockResolvedValue(true)

      await stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      })

      expect(mockCache.set).toHaveBeenCalled()
    })

    it('should handle cache errors gracefully', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue(mockSelectionResult)
      }))

      mockCache.get.mockRejectedValue(new Error('Cache error'))
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = await stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      })

      expect(result.success).toBe(true) // Should still succeed despite cache error
      expect(errorSpy).toHaveBeenCalledWith('Cache get error:', expect.any(Error))
      errorSpy.mockRestore()
    })

    it('should clear cache when requested', async () => {
      await stockSelectionService.clearCache()
      expect(mockCache.clear).toHaveBeenCalled()
    })
  })

  describe('Service Management', () => {
    it('should cancel active requests', async () => {
      const mockController = {
        abort: jest.fn()
      }

      // Mock the private activeRequests map
      const activeRequestsMap = new Map()
      activeRequestsMap.set('test-request-id', mockController)
      ;(stockSelectionService as any).activeRequests = activeRequestsMap

      const result = await stockSelectionService.cancelRequest('test-request-id')

      expect(result).toBe(true)
      expect(mockController.abort).toHaveBeenCalled()
    })

    it('should return false when cancelling non-existent request', async () => {
      const result = await stockSelectionService.cancelRequest('non-existent-id')
      expect(result).toBe(false)
    })

    it('should provide service statistics', () => {
      const stats = stockSelectionService.getServiceStats()

      expect(stats).toHaveProperty('totalRequests')
      expect(stats).toHaveProperty('successRate')
      expect(stats).toHaveProperty('averageExecutionTime')
      expect(stats).toHaveProperty('cacheHitRate')
      expect(stats).toHaveProperty('requestsByMode')
    })

    it('should perform health check', async () => {
      const health = await stockSelectionService.healthCheck()

      expect(health).toHaveProperty('status')
      expect(health).toHaveProperty('details')
      expect(['healthy', 'unhealthy']).toContain(health.status)
    })

    it('should handle health check errors', async () => {
      mockMCPClient.healthCheck = jest.fn().mockRejectedValue(new Error('Health check failed'))

      const health = await stockSelectionService.healthCheck()

      expect(health.status).toBe('unhealthy')
      expect(health.details).toHaveProperty('error')
    })
  })

  describe('Data Quality Validation', () => {
    it('should validate data quality', async () => {
      const testData = { symbol: 'AAPL', price: 150 }
      const quality = await stockSelectionService.validateDataQuality(testData)

      expect(quality).toHaveProperty('overall')
      expect(quality).toHaveProperty('metrics')
      expect(quality.overall).toBeGreaterThanOrEqual(0)
      expect(quality.overall).toBeLessThanOrEqual(1)
    })
  })

  describe('Error Handling Edge Cases', () => {
    it('should handle unsupported selection mode', async () => {
      const invalidRequest: SelectionRequest = {
        scope: {
          mode: 'UNSUPPORTED_MODE' as SelectionMode,
          symbols: ['AAPL']
        }
      }

      const result = await stockSelectionService.selectStocks(invalidRequest)

      expect(result.success).toBe(false)
      expect(result.errors?.[0]).toContain('Unsupported selection mode')
    })

    it('should handle algorithm analysis failure', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockRejectedValue(new Error('Algorithm execution failed'))
      }))

      mockCache.get.mockResolvedValue(null)

      const result = await stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      })

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Algorithm execution failed')
    })

    it('should handle missing analysis result', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue({
          selections: [], // Empty selections
          metadata: {},
          metrics: { totalStocksEvaluated: 0 }
        })
      }))

      mockCache.get.mockResolvedValue(null)

      const result = await stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      })

      expect(result.success).toBe(false)
      expect(result.errors?.[0]).toContain('No analysis result found')
    })
  })

  describe('Performance Metrics', () => {
    it('should track execution time', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(() => resolve(mockSelectionResult), 100))
        )
      }))

      mockCache.get.mockResolvedValue(null)

      const result = await stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      })

      expect(result.executionTime).toBeGreaterThan(0)
      expect(result.performance).toBeDefined()
      expect(result.performance.dataFetchTime).toBeGreaterThanOrEqual(0)
      expect(result.performance.analysisTime).toBeGreaterThanOrEqual(0)
    })

    it('should update service statistics on completion', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockResolvedValue(mockSelectionResult)
      }))

      mockCache.get.mockResolvedValue(null)

      const initialStats = stockSelectionService.getServiceStats()
      const initialTotalRequests = initialStats.totalRequests

      await stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        }
      })

      const updatedStats = stockSelectionService.getServiceStats()
      expect(updatedStats.totalRequests).toBe(initialTotalRequests + 1)
    })
  })

  describe('Request Tracking', () => {
    it('should track active requests', async () => {
      const mockAlgorithmIntegration = require('../integration/AlgorithmIntegration')
      let resolveAnalysis: Function
      const analysisPromise = new Promise(resolve => {
        resolveAnalysis = resolve
      })

      mockAlgorithmIntegration.AlgorithmIntegration.mockImplementation(() => ({
        executeAnalysis: jest.fn().mockReturnValue(analysisPromise)
      }))

      mockCache.get.mockResolvedValue(null)

      const requestPromise = stockSelectionService.selectStocks({
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        },
        requestId: 'test-tracking-id'
      })

      // Request should be tracked while active
      const activeRequestsSize = (stockSelectionService as any).activeRequests.size
      expect(activeRequestsSize).toBeGreaterThan(0)

      // Complete the request
      resolveAnalysis(mockSelectionResult)
      await requestPromise

      // Request should be cleaned up
      const finalActiveRequestsSize = (stockSelectionService as any).activeRequests.size
      expect(finalActiveRequestsSize).toBe(0)
    })
  })
})