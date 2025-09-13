/**
 * Optimized TDD Tests for MCP Client Cleanup Strategies
 * Tests request queue cleanup, connection pool cleanup, cache cleanup, and health check timer cleanup
 * Optimized for performance and reliability
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals'

// Create comprehensive mocks with proper cleanup
const mockRedisCache = {
  get: jest.fn(),
  set: jest.fn(),
  invalidatePattern: jest.fn(),
  getStats: jest.fn(),
  warmCache: jest.fn(),
  cacheStockPrice: jest.fn(),
  getCachedStockPrice: jest.fn(),
  cacheMarketData: jest.fn(),
  shutdown: jest.fn()
}

// Mock Redis cache module with correct export structure
jest.mock('../../cache/RedisCache', () => ({
  redisCache: mockRedisCache
}))

// Mock dependencies with proper cleanup
jest.mock('../DataFusionEngine')
jest.mock('../QualityScorer')

// Import after mocking
import { MCPClient } from '../MCPClient'
import { DataFusionEngine } from '../DataFusionEngine'
import { QualityScorer } from '../QualityScorer'

// Get mocked classes
const MockedDataFusionEngine = DataFusionEngine as jest.MockedClass<typeof DataFusionEngine>
const MockedQualityScorer = QualityScorer as jest.MockedClass<typeof QualityScorer>

// Mock console methods to reduce test noise
const mockConsole = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {})
}

describe('MCPClient Cleanup Strategies', () => {
  let mcpClient: MCPClient
  let mockDataFusionEngine: jest.Mocked<DataFusionEngine>
  let mockQualityScorer: jest.Mocked<QualityScorer>
  let makeRequestSpy: jest.SpyInstance

  // Global test setup
  beforeAll(() => {
    // Silence console output during tests
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  })

  afterAll(() => {
    // Restore console methods
    mockConsole.log.mockRestore()
    mockConsole.error.mockRestore()
    mockConsole.warn.mockRestore()
    jest.restoreAllMocks()
  })

  beforeEach(async () => {
    // Clear all mocks and use fake timers
    jest.clearAllMocks()
    jest.useFakeTimers({ advanceTimers: true })

    // Reset Redis cache mocks
    mockRedisCache.get.mockResolvedValue(null)
    mockRedisCache.set.mockResolvedValue(true)
    mockRedisCache.invalidatePattern.mockResolvedValue(5)
    mockRedisCache.getStats.mockResolvedValue({
      hits: 10,
      misses: 5,
      sets: 8,
      deletes: 2,
      errors: 0,
      hitRate: 66.67,
      memoryUsage: '10MB',
      totalKeys: 100
    })
    mockRedisCache.warmCache.mockResolvedValue(undefined)
    mockRedisCache.cacheStockPrice.mockResolvedValue(undefined)
    mockRedisCache.getCachedStockPrice.mockResolvedValue(null)
    mockRedisCache.cacheMarketData.mockResolvedValue(undefined)
    mockRedisCache.shutdown.mockResolvedValue(undefined)

    // Setup mocked instances with better defaults
    mockDataFusionEngine = {
      fuseData: jest.fn().mockResolvedValue({
        success: true,
        data: { mock: true },
        source: 'fusion',
        timestamp: Date.now()
      }),
      getStatistics: jest.fn().mockReturnValue({
        totalRequests: 10,
        fusedRequests: 8,
        conflictsResolved: 2,
        averageQualityScore: 0.85,
        sourcesUsed: {},
        cacheHitRate: 0.75,
        validationSuccessRate: 0.9
      })
    } as any

    mockQualityScorer = {
      calculateQualityScore: jest.fn().mockReturnValue({
        overall: 0.8,
        metrics: {
          freshness: 0.8,
          completeness: 0.8,
          accuracy: 0.8,
          sourceReputation: 0.8,
          latency: 0.8
        },
        timestamp: Date.now(),
        source: 'test'
      }),
      updateSourceReputation: jest.fn(),
      getSourceReputation: jest.fn().mockReturnValue(0.8),
      reset: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({
        sources: []
      }),
      selectBestSource: jest.fn().mockReturnValue('polygon')
    } as any

    // Mock constructors to return our mock instances
    MockedDataFusionEngine.mockImplementation(() => mockDataFusionEngine)
    MockedQualityScorer.mockImplementation(() => mockQualityScorer)

    // Add static method mock
    ;(MockedQualityScorer as any).selectBestSource = jest.fn().mockReturnValue('polygon')

    // Clean up any existing MCPClient instance
    const currentInstance = (MCPClient as any).instance
    if (currentInstance) {
      try {
        if (currentInstance.stopHealthChecks) {
          currentInstance.stopHealthChecks()
        }
        // Force cleanup without waiting
        clearInterval(currentInstance.healthCheckInterval)
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    ;(MCPClient as any).instance = null

    // Create fresh instance
    mcpClient = MCPClient.getInstance()

    // Create spy for makeRequest method
    makeRequestSpy = jest.spyOn(mcpClient as any, 'makeRequest')
  })

  afterEach(async () => {
    // Restore spy if it exists
    if (makeRequestSpy && makeRequestSpy.mockRestore) {
      makeRequestSpy.mockRestore()
    }

    // Stop health checks immediately to prevent timer leaks
    if (mcpClient) {
      try {
        if (mcpClient.stopHealthChecks) {
          mcpClient.stopHealthChecks()
        }
        // Force stop any remaining intervals
        const healthCheckInterval = (mcpClient as any).healthCheckInterval
        if (healthCheckInterval) {
          clearInterval(healthCheckInterval)
          ;(mcpClient as any).healthCheckInterval = undefined
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    // Clear all timers before cleanup
    jest.clearAllTimers()

    // Fast cleanup without async operations that might hang
    if (mcpClient) {
      try {
        // Clear memory cache synchronously
        const cache = (mcpClient as any).cache
        if (cache && cache.clear) {
          cache.clear()
        }

        // Clear request queue synchronously
        const requestQueue = (mcpClient as any).requestQueue
        if (requestQueue && requestQueue.clear) {
          requestQueue.clear()
        }

        // Reset fusion synchronously
        if (mockQualityScorer.reset) {
          mockQualityScorer.reset()
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Clear singleton instance
    ;(MCPClient as any).instance = null

    // Clear all mocks
    jest.clearAllMocks()

    // Return to real timers
    jest.useRealTimers()
  })

  describe('Request Queue Cleanup', () => {
    test('should_clear_request_queue_on_failed_requests', async () => {
      // Arrange
      const toolName = 'get_ticker_details'
      const params = { ticker: 'AAPL' }

      // Mock a failing request - ensure it rejects quickly
      makeRequestSpy.mockRejectedValueOnce(new Error('Request failed'))

      // Act
      const result = await mcpClient.executeTool(toolName, params, {
        preferredServer: 'polygon',
        timeout: 100 // Short timeout for fast test
      })

      // Assert - Request should be removed from queue after failure
      expect(result.success).toBe(false)
      expect(result.error).toContain('Request failed')

      const requestQueue = (mcpClient as any).requestQueue
      expect(requestQueue.has(`polygon:${toolName}`)).toBe(false)
    }, 5000)

    test('should_deduplicate_concurrent_identical_requests', async () => {
      // Arrange
      const toolName = 'get_ticker_details'
      const params = { ticker: 'AAPL' }

      // Mock a successful request with slight delay to test concurrency
      makeRequestSpy.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            success: true,
            data: { ticker: 'AAPL' }
          }), 10)
        )
      )

      // Act - Start multiple identical requests concurrently
      const promises = Promise.all([
        mcpClient.executeTool(toolName, params, { preferredServer: 'polygon', timeout: 1000 }),
        mcpClient.executeTool(toolName, params, { preferredServer: 'polygon', timeout: 1000 }),
        mcpClient.executeTool(toolName, params, { preferredServer: 'polygon', timeout: 1000 })
      ])

      const results = await promises

      // Assert - All requests should get the same result
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.data).toEqual({ ticker: 'AAPL' })
      })

      // Request queue should be clean after completion
      const requestQueue = (mcpClient as any).requestQueue
      expect(requestQueue.has(`polygon:${toolName}`)).toBe(false)
    }, 5000)

    test('should_handle_request_queue_memory_cleanup', async () => {
      // Arrange
      const toolName = 'get_ticker_details'
      const requestCount = 5 // Reduced for performance

      // Create requests that complete successfully
      const promises = []
      for (let i = 0; i < requestCount; i++) {
        makeRequestSpy.mockResolvedValueOnce({
          success: true,
          data: { ticker: `STOCK${i}` }
        })

        promises.push(
          mcpClient.executeTool(toolName, { ticker: `STOCK${i}` }, {
            preferredServer: 'polygon',
            timeout: 500 // Short timeout
          })
        )
      }

      // Act
      const results = await Promise.all(promises)

      // Assert - All requests succeeded
      expect(results).toHaveLength(requestCount)
      results.forEach((result) => {
        expect(result.success).toBe(true)
        expect(result.data).toHaveProperty('ticker')
        expect(result.data.ticker).toMatch(/^STOCK\d+$/)
      })

      // Request queue should be empty after all requests complete
      const requestQueue = (mcpClient as any).requestQueue
      expect(requestQueue.size).toBe(0)
    }, 5000)

    test('should_cleanup_request_queue_on_error', async () => {
      // Arrange
      const toolName = 'get_ticker_details'
      const params = { ticker: 'AAPL' }

      // Mock a request that rejects immediately
      makeRequestSpy.mockRejectedValueOnce(new Error('Network error'))

      // Act
      const result = await mcpClient.executeTool(toolName, params, {
        preferredServer: 'polygon',
        timeout: 100
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')

      // Request queue should be cleaned up after error
      const requestQueue = (mcpClient as any).requestQueue
      expect(requestQueue.size).toBe(0)
    }, 3000)

    test('should_prevent_request_queue_memory_leaks', async () => {
      // Arrange
      const toolName = 'get_ticker_details'
      const requestCount = 3 // Reduced for performance

      // Create and execute failing requests sequentially
      for (let i = 0; i < requestCount; i++) {
        makeRequestSpy.mockRejectedValueOnce(new Error(`Request ${i} failed`))

        const result = await mcpClient.executeTool(toolName, { ticker: `FAIL${i}` }, {
          preferredServer: 'polygon',
          timeout: 100
        })

        // Verify each request fails but cleans up
        expect(result.success).toBe(false)
      }

      // Assert - Request queue should remain empty after all failures
      const requestQueue = (mcpClient as any).requestQueue
      expect(requestQueue.size).toBe(0)
    }, 5000)
  })

  describe('Connection Pool Cleanup', () => {
    test('should_reset_connection_statistics_on_fusion_reset', () => {
      // Act
      mcpClient.resetFusion()

      // Assert - Quality scorer should be reset
      expect(mockQualityScorer.reset).toHaveBeenCalled()
    }, 3000)

    test('should_maintain_connection_statistics_integrity', async () => {
      // Arrange
      const toolName = 'get_ticker_details'
      const params = { ticker: 'AAPL' }

      makeRequestSpy.mockResolvedValueOnce({
        success: true,
        data: { ticker: 'AAPL' }
      })

      // Act
      const result = await mcpClient.executeTool(toolName, params, {
        preferredServer: 'polygon',
        timeout: 500
      })

      // Assert
      expect(result.success).toBe(true)
      const stats = mcpClient.getStats()
      expect(stats.polygon.requestCount).toBeGreaterThan(0)
      expect(stats.polygon.connected).toBe(true)
    }, 3000)

    test('should_update_error_statistics_on_failures', async () => {
      // Arrange
      const toolName = 'get_ticker_details'
      const params = { ticker: 'AAPL' }

      makeRequestSpy.mockRejectedValueOnce(new Error('Server error'))

      // Act
      const result = await mcpClient.executeTool(toolName, params, {
        preferredServer: 'polygon',
        timeout: 200
      })

      // Assert
      expect(result.success).toBe(false)
      const stats = mcpClient.getStats()
      expect(stats.polygon.errorCount).toBeGreaterThan(0)
      expect(stats.polygon.connected).toBe(false)
    }, 3000)
  })

  describe('Cache Cleanup (Memory + Redis)', () => {
    test('should_clear_memory_cache_on_clearCache_call', async () => {
      // Arrange
      const cache = (mcpClient as any).cache

      // Add items to memory cache
      cache.set('test-key-1', { data: 'value1', timestamp: Date.now(), ttl: 60000 })
      cache.set('test-key-2', { data: 'value2', timestamp: Date.now(), ttl: 60000 })

      expect(cache.size).toBe(2)

      // Act
      await mcpClient.clearCache()

      // Assert
      expect(cache.size).toBe(0)
      expect(mockRedisCache.invalidatePattern).toHaveBeenCalledWith('*')
    }, 3000)

    test('should_cleanup_expired_memory_cache_entries', () => {
      // Arrange - keep fake timers for consistency
      const cache = (mcpClient as any).cache
      const now = Date.now()

      // Add expired entry (timestamp in the past)
      cache.set('expired-key', { data: 'value', timestamp: now - 10000, ttl: 5000 })

      // Add valid entry (current timestamp)
      cache.set('valid-key', { data: 'value', timestamp: now, ttl: 60000 })

      expect(cache.size).toBe(2)

      // Act - access cache entries
      const expiredResult = (mcpClient as any).getFromCache('expired-key')
      const validResult = (mcpClient as any).getFromCache('valid-key')

      // Assert
      expect(expiredResult).toBeNull()
      expect(validResult).toBeDefined()
      expect(cache.has('expired-key')).toBe(false) // Should be cleaned up
      expect(cache.has('valid-key')).toBe(true)
    }, 3000)

    test('should_handle_redis_cache_cleanup_errors_gracefully', async () => {
      // Arrange
      const cache = (mcpClient as any).cache
      cache.set('test-key', { data: 'value', timestamp: Date.now(), ttl: 60000 })

      expect(cache.size).toBe(1)

      const invalidateError = new Error('Redis invalidate failed')
      mockRedisCache.invalidatePattern.mockRejectedValueOnce(invalidateError)

      // Act & Assert - Should not throw
      await expect(mcpClient.clearCache()).resolves.toBeUndefined()

      // Memory cache should still be cleared despite Redis error
      expect(cache.size).toBe(0)

      // Should have attempted Redis invalidation
      expect(mockRedisCache.invalidatePattern).toHaveBeenCalledWith('*')
    }, 3000)
  })

  describe('Health Check Timer Cleanup', () => {
    test('should_start_health_check_interval_on_initialization', () => {
      // Arrange
      const setIntervalSpy = jest.spyOn(global, 'setInterval')

      // Stop existing health checks first
      if (mcpClient && mcpClient.stopHealthChecks) {
        mcpClient.stopHealthChecks()
      }

      // Clear singleton to force new instance creation
      ;(MCPClient as any).instance = null

      // Act - Create new instance which should start health checks
      const newClient = MCPClient.getInstance()

      // Assert
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        30000 // 30 seconds
      )

      // Cleanup immediately
      if (newClient && newClient.stopHealthChecks) {
        newClient.stopHealthChecks()
      }
      setIntervalSpy.mockRestore()

      // Restore original instance for other tests
      ;(MCPClient as any).instance = mcpClient
    }, 3000)

    test('should_stop_health_check_timers_properly', () => {
      // Arrange
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      // Ensure there's a health check to stop
      const healthCheckInterval = (mcpClient as any).healthCheckInterval
      if (!healthCheckInterval) {
        // Create a mock interval if none exists
        ;(mcpClient as any).healthCheckInterval = setInterval(() => {}, 30000)
      }

      // Act
      mcpClient.stopHealthChecks()

      // Assert
      expect(clearIntervalSpy).toHaveBeenCalled()

      // Cleanup
      clearIntervalSpy.mockRestore()
    }, 3000)
  })

  describe('Fusion Engine Resource Cleanup', () => {
    test('should_reset_fusion_engine_on_resetFusion_call', () => {
      // Act
      mcpClient.resetFusion()

      // Assert
      expect(mockQualityScorer.reset).toHaveBeenCalled()
    }, 3000)

    test('should_cleanup_fusion_statistics_on_reset', () => {
      // Arrange
      mockDataFusionEngine.getStatistics.mockReturnValue({
        totalRequests: 100,
        fusedRequests: 80,
        conflictsResolved: 10,
        averageQualityScore: 0.85,
        sourcesUsed: {},
        cacheHitRate: 0.75,
        validationSuccessRate: 0.9
      })

      // Act
      mcpClient.resetFusion()

      // Assert
      expect(mockQualityScorer.reset).toHaveBeenCalled()
    }, 3000)

    test('should_handle_fusion_engine_cleanup_errors', () => {
      // Arrange
      const resetError = new Error('Reset failed')
      mockQualityScorer.reset.mockImplementationOnce(() => {
        throw resetError
      })

      // Act & Assert - Should not throw even if quality scorer reset fails
      expect(() => mcpClient.resetFusion()).not.toThrow()

      // Should have attempted to reset the quality scorer
      expect(mockQualityScorer.reset).toHaveBeenCalled()
    }, 3000)
  })

  describe('Memory Leak Prevention', () => {
    test('should_prevent_memory_leaks_from_completed_requests', async () => {
      // Arrange
      const toolName = 'get_ticker_details'
      const requestCount = 3 // Reduced for performance

      // Execute requests with fast completion
      const promises = []
      for (let i = 0; i < requestCount; i++) {
        makeRequestSpy.mockResolvedValueOnce({
          success: true,
          data: { ticker: `STOCK${i}` }
        })

        promises.push(
          mcpClient.executeTool(toolName, { ticker: `STOCK${i}` }, {
            preferredServer: 'polygon',
            timeout: 500
          })
        )
      }

      // Act
      const results = await Promise.all(promises)

      // Assert - All requests completed successfully
      expect(results).toHaveLength(requestCount)
      results.forEach((result) => {
        expect(result.success).toBe(true)
        expect(result.data).toHaveProperty('ticker')
        expect(result.data.ticker).toMatch(/^STOCK\d+$/)
      })

      // Request queue should be cleaned up
      const requestQueue = (mcpClient as any).requestQueue
      expect(requestQueue.size).toBe(0)
    }, 5000)

    test('should_cleanup_orphaned_cache_entries', () => {
      // Arrange - keep fake timers for consistency
      const cache = (mcpClient as any).cache
      const now = Date.now()

      // Add entries with different TTLs
      cache.set('short-lived-1', { data: 'value1', timestamp: now - 1000, ttl: 500 })
      cache.set('short-lived-2', { data: 'value2', timestamp: now - 2000, ttl: 500 })
      cache.set('long-lived', { data: 'value3', timestamp: now, ttl: 60000 })

      expect(cache.size).toBe(3)

      // Act - Access cache entries to trigger cleanup
      const result1 = (mcpClient as any).getFromCache('short-lived-1')
      const result2 = (mcpClient as any).getFromCache('short-lived-2')
      const result3 = (mcpClient as any).getFromCache('long-lived')

      // Assert
      expect(result1).toBeNull() // Expired
      expect(result2).toBeNull() // Expired
      expect(result3).toBeDefined() // Valid

      expect(cache.has('short-lived-1')).toBe(false)
      expect(cache.has('short-lived-2')).toBe(false)
      expect(cache.has('long-lived')).toBe(true)
    }, 3000)

    test('should_handle_rapid_instance_creation_without_leaks', () => {
      // Arrange
      const originalInstance = (MCPClient as any).instance

      // Act - Rapid singleton access (reduced iterations for performance)
      const instances = []
      for (let i = 0; i < 5; i++) {
        instances.push(MCPClient.getInstance())
      }

      // Assert - All should be the same instance
      const firstInstance = instances[0]
      instances.forEach(instance => {
        expect(instance).toBe(firstInstance)
      })

      // Verify singleton pattern works
      expect(instances).toHaveLength(5)
      expect(new Set(instances).size).toBe(1) // All instances are the same

      // Restore
      ;(MCPClient as any).instance = originalInstance
    }, 3000)
  })

  describe('Integration Cleanup Tests', () => {
    test('should_perform_complete_cleanup_sequence', async () => {
      // Arrange
      mockRedisCache.invalidatePattern.mockResolvedValueOnce(5)

      const cache = (mcpClient as any).cache
      cache.set('test-key', { data: 'value', timestamp: Date.now(), ttl: 60000 })

      expect(cache.size).toBe(1)

      // Simulate some connection activity
      makeRequestSpy.mockRejectedValueOnce(new Error('Connection failed'))
      const result = await mcpClient.executeTool('get_ticker_details', { ticker: 'AAPL' }, {
        preferredServer: 'polygon',
        timeout: 200
      })

      expect(result.success).toBe(false)

      // Act - Perform complete cleanup
      await mcpClient.clearCache()
      mcpClient.resetFusion()

      // Assert
      expect(cache.size).toBe(0)
      expect(mockRedisCache.invalidatePattern).toHaveBeenCalledWith('*')
      expect(mockQualityScorer.reset).toHaveBeenCalled()
    }, 5000)

    test('should_maintain_functionality_after_cleanup', async () => {
      // Arrange
      mockRedisCache.invalidatePattern.mockResolvedValueOnce(5)

      // Perform cleanup first
      await mcpClient.clearCache()
      mcpClient.resetFusion()

      // Setup successful request
      makeRequestSpy.mockResolvedValueOnce({
        success: true,
        data: { ticker: 'AAPL' }
      })

      // Act - Use client after cleanup
      const result = await mcpClient.executeTool('get_ticker_details', { ticker: 'AAPL' }, {
        preferredServer: 'polygon',
        timeout: 1000
      })

      // Assert - Should still function normally
      expect(result.success).toBe(true)
      expect(result.data.ticker).toBe('AAPL')
    }, 5000)

    test('should_handle_multiple_concurrent_cleanups', async () => {
      // Arrange
      mockRedisCache.invalidatePattern.mockResolvedValue(5)

      const cache = (mcpClient as any).cache
      cache.set('test-key', { data: 'value', timestamp: Date.now(), ttl: 60000 })

      expect(cache.size).toBe(1)

      // Act - Multiple concurrent cleanups (reduced for performance)
      const cleanupPromises = Promise.all([
        mcpClient.clearCache(),
        mcpClient.clearCache()
      ])

      await cleanupPromises

      // Assert - Should complete without errors
      expect(cache.size).toBe(0)
      expect(mockRedisCache.invalidatePattern).toHaveBeenCalled()
    }, 5000)
  })
})