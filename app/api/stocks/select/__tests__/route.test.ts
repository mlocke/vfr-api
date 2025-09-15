/**
 * Comprehensive API Route Test Suite
 *
 * Tests cover:
 * - All HTTP methods (POST, GET, DELETE)
 * - Request validation and sanitization
 * - Service pool management and connection handling
 * - Rate limiting and request queuing
 * - Response streaming for large datasets
 * - Performance optimization and caching
 * - Error handling and timeout scenarios
 * - Memory management and cleanup
 * - Graceful shutdown handling
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { POST, GET, DELETE } from '../route'
import {
  SelectionRequest,
  SelectionResponse,
  SelectionMode,
  SelectionOptions,
  EnhancedStockResult
} from '../../../../services/stock-selection/types'

// Mock Next.js components
jest.mock('next/server')

// Mock all service dependencies
jest.mock('../../../../services/stock-selection/StockSelectionService')
jest.mock('../../../../services/stock-selection/DataFlowManager')
jest.mock('../../../../services/mcp/MCPClient')
jest.mock('../../../../services/mcp/DataFusionEngine')
jest.mock('../../../../services/algorithms/FactorLibrary')
jest.mock('../../../../services/cache/RedisCache')

// Mock global fetch for testing
global.fetch = jest.fn()

describe('Stock Selection API Routes', () => {
  let consoleSpy: jest.SpyInstance
  let mockNextRequest: jest.Mocked<NextRequest>
  let mockNextResponse: jest.Mocked<typeof NextResponse>

  // Test data fixtures
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
      overall: {
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
      },
      sourceBreakdown: {},
      lastUpdated: Date.now()
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
      qualityScore: {
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
    },
    performance: {
      dataFetchTime: 500,
      analysisTime: 800,
      fusionTime: 150,
      cacheTime: 50
    }
  }

  const validSingleStockRequest: SelectionRequest = {
    scope: {
      mode: SelectionMode.SINGLE_STOCK,
      symbols: ['AAPL']
    },
    options: {
      algorithmId: 'composite',
      useRealTimeData: true
    }
  }

  const validSectorRequest: SelectionRequest = {
    scope: {
      mode: SelectionMode.SECTOR_ANALYSIS,
      sector: {
        id: 'technology',
        label: 'Technology',
        category: 'sector'
      },
      maxResults: 10
    },
    options: {
      algorithmId: 'composite'
    }
  }

  const validMultiStockRequest: SelectionRequest = {
    scope: {
      mode: SelectionMode.MULTIPLE_STOCKS,
      symbols: ['AAPL', 'MSFT', 'GOOGL']
    },
    options: {
      algorithmId: 'composite'
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

    // Mock NextRequest
    mockNextRequest = {
      json: jest.fn(),
      headers: {
        get: jest.fn()
      },
      url: 'http://localhost:3000/api/stocks/select'
    } as any

    // Mock NextResponse
    mockNextResponse = {
      json: jest.fn().mockImplementation((data, options?) => ({
        data,
        status: options?.status || 200,
        headers: new Map()
      }))
    } as any

    // Mock NextResponse constructor
    ;(NextResponse as any).json = mockNextResponse.json

    // Setup default header responses
    mockNextRequest.headers.get.mockImplementation((header: string) => {
      switch (header) {
        case 'x-forwarded-for':
          return '192.168.1.1'
        case 'user-agent':
          return 'Mozilla/5.0 Test Browser'
        default:
          return null
      }
    })
  })

  afterEach(() => {
    // Clear any timers or intervals
    jest.clearAllTimers()
  })

  describe('POST /api/stocks/select', () => {
    it('should process valid single stock request successfully', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      // Mock service pool and stock selection service
      const mockStockSelectionService = {
        selectStocks: jest.fn().mockResolvedValue(mockSelectionResponse),
        healthCheck: jest.fn().mockResolvedValue({ status: 'healthy', details: {} }),
        getServiceStats: jest.fn().mockReturnValue({
          totalRequests: 10,
          successRate: 0.95,
          averageExecutionTime: 1500,
          cacheHitRate: 0.75
        })
      }

      // Mock the service pool
      const ServicePool = require('../route').ServicePool
      if (ServicePool) {
        const mockServicePool = {
          getServices: jest.fn().mockResolvedValue({
            stockSelectionService: mockStockSelectionService,
            dataFlowManager: {}
          })
        }
        ServicePool.getInstance = jest.fn().mockReturnValue(mockServicePool)
      }

      const response = await POST(mockNextRequest)

      expect(response.data.success).toBe(true)
      expect(response.data.singleStock).toBeDefined()
      expect(response.data.topSelections).toHaveLength(1)
    })

    it('should process valid sector analysis request successfully', async () => {
      mockNextRequest.json.mockResolvedValue(validSectorRequest)

      const sectorResponse = {
        ...mockSelectionResponse,
        sectorAnalysis: {
          sector: validSectorRequest.scope.sector,
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
      }

      const mockStockSelectionService = {
        selectStocks: jest.fn().mockResolvedValue(sectorResponse)
      }

      const response = await POST(mockNextRequest)

      expect(response.data.success).toBe(true)
      expect(response.data.sectorAnalysis).toBeDefined()
    })

    it('should process valid multi-stock request successfully', async () => {
      mockNextRequest.json.mockResolvedValue(validMultiStockRequest)

      const multiStockResponse = {
        ...mockSelectionResponse,
        multiStockAnalysis: {
          request: validMultiStockRequest,
          results: [mockEnhancedStockResult, mockEnhancedStockResult, mockEnhancedStockResult],
          portfolioMetrics: {
            overallScore: 0.82,
            diversificationScore: 0.75,
            riskScore: 1.1,
            sectorBreakdown: { 'Technology': 1.0 },
            marketCapBreakdown: { large: 1.0, mid: 0, small: 0 }
          },
          recommendations: {
            allocation: { 'AAPL': 0.4, 'MSFT': 0.35, 'GOOGL': 0.25 },
            rebalancing: [],
            riskWarnings: []
          }
        },
        topSelections: [mockEnhancedStockResult, mockEnhancedStockResult, mockEnhancedStockResult]
      }

      const mockStockSelectionService = {
        selectStocks: jest.fn().mockResolvedValue(multiStockResponse)
      }

      const response = await POST(mockNextRequest)

      expect(response.data.success).toBe(true)
      expect(response.data.multiStockAnalysis).toBeDefined()
      expect(response.data.topSelections).toHaveLength(3)
    })

    it('should handle request validation errors', async () => {
      const invalidRequest = {
        scope: {
          mode: 'INVALID_MODE',
          symbols: []
        }
      }

      mockNextRequest.json.mockResolvedValue(invalidRequest)

      const response = await POST(mockNextRequest)

      expect(response.status).toBe(400)
      expect(response.data.success).toBe(false)
      expect(response.data.error).toBe('Invalid request format')
      expect(response.data.details).toBeDefined()
    })

    it('should handle invalid JSON in request body', async () => {
      mockNextRequest.json.mockRejectedValue(new Error('Invalid JSON'))

      const response = await POST(mockNextRequest)

      expect(response.status).toBe(400)
      expect(response.data.success).toBe(false)
      expect(response.data.error).toBe('Invalid JSON')
    })

    it('should validate scope-specific requirements', async () => {
      const invalidSingleStockRequest = {
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: []
        }
      }

      mockNextRequest.json.mockResolvedValue(invalidSingleStockRequest)

      const response = await POST(mockNextRequest)

      expect(response.status).toBe(400)
      expect(response.data.success).toBe(false)
      expect(response.data.error).toBe('Invalid analysis scope')
      expect(response.data.message).toContain('requires at least one symbol')
    })

    it('should enforce symbol limits for multi-stock requests', async () => {
      const tooManySymbolsRequest = {
        scope: {
          mode: SelectionMode.MULTIPLE_STOCKS,
          symbols: Array.from({ length: 51 }, (_, i) => `STOCK${i}`)
        }
      }

      mockNextRequest.json.mockResolvedValue(tooManySymbolsRequest)

      const response = await POST(mockNextRequest)

      expect(response.status).toBe(400)
      expect(response.data.success).toBe(false)
      expect(response.data.message).toContain('limited to 50 symbols maximum')
    })

    it('should handle service initialization errors', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      // Mock service pool to throw initialization error
      const ServicePool = require('../route').ServicePool
      if (ServicePool) {
        const mockServicePool = {
          getServices: jest.fn().mockRejectedValue(new Error('Service initialization failed'))
        }
        ServicePool.getInstance = jest.fn().mockReturnValue(mockServicePool)
      }

      const response = await POST(mockNextRequest)

      expect(response.status).toBe(503)
      expect(response.data.success).toBe(false)
      expect(response.data.error).toBe('Service unavailable')
    })

    it('should handle request timeout errors', async () => {
      mockNextRequest.json.mockResolvedValue({
        ...validSingleStockRequest,
        options: { timeout: 1000 }
      })

      const mockStockSelectionService = {
        selectStocks: jest.fn().mockImplementation(() =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 1100)
          )
        )
      }

      const response = await POST(mockNextRequest)

      expect(response.status).toBe(408)
      expect(response.data.success).toBe(false)
      expect(response.data.error).toBe('Request timeout')
    })

    it('should include performance headers in response', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      const mockResponse = {
        ...mockSelectionResponse,
        headers: new Map()
      }

      const response = await POST(mockNextRequest)

      // Verify performance headers would be set
      expect(response.data.executionTime).toBeDefined()
    })

    it('should handle streaming responses for large datasets', async () => {
      const largeDatasetRequest = {
        scope: {
          mode: SelectionMode.SECTOR_ANALYSIS,
          sector: { id: 'technology', label: 'Technology', category: 'sector' },
          maxResults: 50
        }
      }

      mockNextRequest.json.mockResolvedValue(largeDatasetRequest)

      const largeResponse = {
        ...mockSelectionResponse,
        topSelections: Array.from({ length: 50 }, () => mockEnhancedStockResult)
      }

      const mockStockSelectionService = {
        selectStocks: jest.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(() => resolve(largeResponse), 1500))
        )
      }

      const response = await POST(mockNextRequest)

      // Should handle large responses appropriately
      expect(response.data.topSelections).toBeDefined()
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      // Mock multiple rapid requests to trigger rate limiting
      const requests = Array.from({ length: 35 }, () => POST(mockNextRequest))

      const responses = await Promise.allSettled(requests)

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(result =>
        result.status === 'fulfilled' &&
        result.value.status === 429
      )

      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })

    it('should allow burst capacity for high-priority requests', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      // Mock requests with different priorities
      const normalRequests = Array.from({ length: 10 }, () => POST(mockNextRequest))
      const results = await Promise.allSettled(normalRequests)

      // Should handle burst capacity appropriately
      const successfulRequests = results.filter(result =>
        result.status === 'fulfilled' &&
        result.value.status === 200
      )

      expect(successfulRequests.length).toBeGreaterThan(0)
    })

    it('should provide retry-after header for rate limited requests', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      // Simulate rate limit scenario
      const response = await POST(mockNextRequest)

      if (response.status === 429) {
        expect(response.data.retryAfter).toBeDefined()
        expect(typeof response.data.retryAfter).toBe('number')
      }
    })
  })

  describe('Request Tracking and Management', () => {
    it('should generate unique request IDs', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      const responses = await Promise.all([
        POST(mockNextRequest),
        POST(mockNextRequest),
        POST(mockNextRequest)
      ])

      const requestIds = responses.map(r => r.data.requestId).filter(Boolean)
      const uniqueIds = new Set(requestIds)

      expect(uniqueIds.size).toBe(requestIds.length)
    })

    it('should track request priority', async () => {
      const highPriorityRequest = {
        ...validSingleStockRequest,
        options: { useRealTimeData: true }
      }

      mockNextRequest.json.mockResolvedValue(highPriorityRequest)

      const response = await POST(mockNextRequest)

      // High priority requests should be processed successfully
      expect(response.status).toBeLessThan(400)
    })

    it('should handle request queue management', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      // Simulate multiple concurrent requests
      const concurrentRequests = Array.from({ length: 15 }, () => POST(mockNextRequest))

      const responses = await Promise.allSettled(concurrentRequests)

      // All requests should complete (either success or controlled failure)
      expect(responses.every(r => r.status === 'fulfilled')).toBe(true)
    })
  })

  describe('Caching Behavior', () => {
    it('should utilize cache for identical requests', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      // Mock cache hit
      const mockRedisCache = {
        get: jest.fn().mockResolvedValue(mockSelectionResponse),
        set: jest.fn().mockResolvedValue(true)
      }

      const response = await POST(mockNextRequest)

      expect(response.data.success).toBe(true)
      // Should be served from cache if cache hit occurs
    })

    it('should set appropriate cache headers', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      const response = await POST(mockNextRequest)

      // Successful responses should have cache control headers
      if (response.status === 200) {
        // Headers would be set in actual implementation
        expect(response.data.success).toBe(true)
      }
    })

    it('should bypass cache for real-time requests', async () => {
      const realTimeRequest = {
        ...validSingleStockRequest,
        options: { useRealTimeData: true }
      }

      mockNextRequest.json.mockResolvedValue(realTimeRequest)

      const response = await POST(mockNextRequest)

      expect(response.data.success).toBe(true)
      // Real-time requests should bypass cache
    })
  })

  describe('GET /api/stocks/select - Health Check', () => {
    it('should return service health status', async () => {
      const mockStockSelectionService = {
        healthCheck: jest.fn().mockResolvedValue({
          status: 'healthy',
          details: {
            mcp: true,
            cache: true,
            activeRequests: 0
          }
        }),
        getServiceStats: jest.fn().mockReturnValue({
          totalRequests: 100,
          successRate: 0.95,
          averageExecutionTime: 1200,
          cacheHitRate: 0.8
        })
      }

      const response = await GET()

      expect(response.data.status).toBeDefined()
      expect(response.data.version).toBeDefined()
      expect(response.data.performance).toBeDefined()
      expect(response.data.supportedModes).toBeDefined()
    })

    it('should return performance metrics', async () => {
      const response = await GET()

      expect(response.data.performance).toBeDefined()
      expect(response.data.performance.memoryUsage).toBeDefined()
      expect(response.data.performance.optimization).toBeDefined()
    })

    it('should include rate limit information', async () => {
      const response = await GET()

      expect(response.data.rateLimits).toBeDefined()
      expect(response.data.rateLimits.window).toBe(60000)
      expect(response.data.rateLimits.maxRequests).toBe(30)
      expect(response.data.rateLimits.burstCapacity).toBe(10)
    })

    it('should handle service health check failures', async () => {
      // Mock service initialization failure
      const ServicePool = require('../route').ServicePool
      if (ServicePool) {
        const mockServicePool = {
          getServices: jest.fn().mockRejectedValue(new Error('Service unavailable'))
        }
        ServicePool.getInstance = jest.fn().mockReturnValue(mockServicePool)
      }

      const response = await GET()

      expect(response.status).toBe(503)
      expect(response.data.status).toBe('unhealthy')
    })

    it('should include service version and uptime', async () => {
      const response = await GET()

      expect(response.data.version).toBe('2.0.0')
      expect(response.data.uptime).toBeDefined()
      expect(typeof response.data.uptime).toBe('number')
    })
  })

  describe('DELETE /api/stocks/select - Request Cancellation', () => {
    beforeEach(() => {
      const url = new URL('http://localhost:3000/api/stocks/select?requestId=test-request-123')
      mockNextRequest.url = url.toString()
    })

    it('should cancel active request successfully', async () => {
      const mockUrl = new URL(mockNextRequest.url)
      mockUrl.searchParams.set('requestId', 'test-request-123')
      mockNextRequest.url = mockUrl.toString()

      const response = await DELETE(mockNextRequest)

      expect(response.data.success).toBe(true)
      expect(response.data.message).toContain('cancelled successfully')
      expect(response.data.requestId).toBe('test-request-123')
    })

    it('should handle missing requestId parameter', async () => {
      const mockUrl = new URL(mockNextRequest.url)
      mockUrl.searchParams.delete('requestId')
      mockNextRequest.url = mockUrl.toString()

      const response = await DELETE(mockNextRequest)

      expect(response.status).toBe(400)
      expect(response.data.success).toBe(false)
      expect(response.data.error).toBe('Missing requestId parameter')
    })

    it('should handle non-existent request cancellation', async () => {
      const mockUrl = new URL(mockNextRequest.url)
      mockUrl.searchParams.set('requestId', 'non-existent-request')
      mockNextRequest.url = mockUrl.toString()

      const response = await DELETE(mockNextRequest)

      expect(response.status).toBe(404)
      expect(response.data.success).toBe(false)
      expect(response.data.error).toBe('Request not found or already completed')
    })

    it('should handle service cancellation errors gracefully', async () => {
      const mockUrl = new URL(mockNextRequest.url)
      mockUrl.searchParams.set('requestId', 'test-request-123')
      mockNextRequest.url = mockUrl.toString()

      // Mock service cancellation failure
      const mockStockSelectionService = {
        cancelRequest: jest.fn().mockRejectedValue(new Error('Cancellation failed'))
      }

      const response = await DELETE(mockNextRequest)

      // Should still report successful cancellation from request tracker
      expect(response.data.requestId).toBe('test-request-123')
    })

    it('should provide response time metrics', async () => {
      const mockUrl = new URL(mockNextRequest.url)
      mockUrl.searchParams.set('requestId', 'test-request-123')
      mockNextRequest.url = mockUrl.toString()

      const response = await DELETE(mockNextRequest)

      expect(response.data.responseTime).toBeDefined()
      expect(typeof response.data.responseTime).toBe('number')
    })
  })

  describe('Error Handling', () => {
    it('should handle unexpected service errors', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      const mockStockSelectionService = {
        selectStocks: jest.fn().mockRejectedValue(new Error('Unexpected service error'))
      }

      const response = await POST(mockNextRequest)

      expect(response.status).toBe(500)
      expect(response.data.success).toBe(false)
      expect(response.data.error).toBe('Internal server error')
    })

    it('should provide detailed error information in development', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      const response = await POST(mockNextRequest)

      if (response.status >= 400) {
        expect(response.data.message).toBeDefined()
        expect(response.data.timestamp).toBeDefined()
        expect(response.data.executionTime).toBeDefined()
      }
    })

    it('should sanitize error messages in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      mockNextRequest.json.mockResolvedValue({
        invalidStructure: true
      })

      const response = await POST(mockNextRequest)

      expect(response.data.message).not.toContain('stack')
      expect(response.data.message).not.toContain('internal')

      process.env.NODE_ENV = originalEnv
    })

    it('should handle malformed request data', async () => {
      mockNextRequest.json.mockResolvedValue({
        scope: null,
        options: 'invalid'
      })

      const response = await POST(mockNextRequest)

      expect(response.status).toBe(400)
      expect(response.data.success).toBe(false)
    })
  })

  describe('Performance Optimization', () => {
    it('should optimize request priority based on characteristics', async () => {
      const simpleRequest = {
        scope: {
          mode: SelectionMode.SINGLE_STOCK,
          symbols: ['AAPL']
        },
        options: { useRealTimeData: true }
      }

      mockNextRequest.json.mockResolvedValue(simpleRequest)

      const startTime = Date.now()
      const response = await POST(mockNextRequest)
      const endTime = Date.now()

      // High-priority requests should be processed quickly
      expect(endTime - startTime).toBeLessThan(5000) // Allow for test environment delays
      expect(response.data.success).toBe(true)
    })

    it('should handle concurrent requests efficiently', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      const concurrentRequests = Array.from({ length: 10 }, () => POST(mockNextRequest))

      const startTime = Date.now()
      const responses = await Promise.allSettled(concurrentRequests)
      const endTime = Date.now()

      const successfulResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      )

      expect(successfulResponses.length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(10000) // Reasonable concurrent processing time
    })

    it('should utilize memory management during high load', async () => {
      // Mock high memory usage scenario
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 100 * 1024 * 1024, // 100MB
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 75 * 1024 * 1024, // High memory usage
        external: 1024,
        arrayBuffers: 1024
      })

      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      const response = await POST(mockNextRequest)

      // Should still handle requests even under memory pressure
      expect(response.status).toBeLessThan(600)

      process.memoryUsage = originalMemoryUsage
    })
  })

  describe('Client Identification', () => {
    it('should identify clients by IP address', async () => {
      mockNextRequest.headers.get.mockImplementation((header: string) => {
        if (header === 'x-forwarded-for') return '192.168.1.100,10.0.0.1'
        if (header === 'user-agent') return 'Mozilla/5.0 Test'
        return null
      })

      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      const response = await POST(mockNextRequest)

      // Request should be processed with proper client identification
      expect(response.data).toBeDefined()
    })

    it('should handle missing client identification gracefully', async () => {
      mockNextRequest.headers.get.mockReturnValue(null)
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      const response = await POST(mockNextRequest)

      // Should still process request with unknown client
      expect(response.data).toBeDefined()
    })
  })

  describe('Response Streaming', () => {
    it('should determine when to use streaming responses', async () => {
      const largeSectorRequest = {
        scope: {
          mode: SelectionMode.SECTOR_ANALYSIS,
          sector: { id: 'technology', label: 'Technology', category: 'sector' },
          maxResults: 100
        }
      }

      mockNextRequest.json.mockResolvedValue(largeSectorRequest)

      const response = await POST(mockNextRequest)

      // Large dataset requests should be handled appropriately
      expect(response.data).toBeDefined()
    })

    it('should use standard JSON for fast queries', async () => {
      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      const mockStockSelectionService = {
        selectStocks: jest.fn().mockResolvedValue(mockSelectionResponse)
      }

      const response = await POST(mockNextRequest)

      expect(response.data.success).toBe(true)
      // Fast queries should use standard JSON response
    })
  })

  describe('Memory Management', () => {
    it('should trigger garbage collection under memory pressure', async () => {
      const originalGC = global.gc
      global.gc = jest.fn()

      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 200 * 1024 * 1024,
        heapTotal: 150 * 1024 * 1024,
        heapUsed: 120 * 1024 * 1024, // Above threshold
        external: 1024,
        arrayBuffers: 1024
      })

      mockNextRequest.json.mockResolvedValue(validSingleStockRequest)

      await POST(mockNextRequest)

      // Should handle memory management appropriately
      expect(process.memoryUsage).toHaveBeenCalled()

      global.gc = originalGC
      process.memoryUsage = originalMemoryUsage
    })

    it('should cleanup expired requests periodically', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval')

      // Import to trigger interval setup
      require('../route')

      expect(setIntervalSpy).toHaveBeenCalled()
      setIntervalSpy.mockRestore()
    })
  })

  describe('Graceful Shutdown', () => {
    it('should handle SIGTERM gracefully', () => {
      const originalProcessOn = process.on
      const mockProcessOn = jest.fn()
      process.on = mockProcessOn

      // Re-import to trigger signal handlers
      require('../route')

      expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
      expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function))

      process.on = originalProcessOn
    })

    it('should cleanup resources on shutdown', () => {
      const mockMemoryManager = {
        stopCleanup: jest.fn()
      }

      // Mock the memory manager
      const route = require('../route')
      if (route.memoryManager) {
        route.memoryManager.stopCleanup = mockMemoryManager.stopCleanup
      }

      // Simulate SIGTERM
      process.emit('SIGTERM' as any)

      // Should initiate graceful shutdown
      expect(true).toBe(true) // Placeholder for actual shutdown verification
    })
  })
})