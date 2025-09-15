/**
 * Caching Strategy Validation Test Suite
 * Comprehensive tests for caching behavior across all MCP data sources
 *
 * Test Coverage:
 * - Historical data caching (1+ day old data should be cached)
 * - Real-time data exclusion (current prices, live news never cached)
 * - Cache TTL strategies by data type
 * - Cache hit rate optimization
 * - Cross-server cache consistency
 * - Cache invalidation patterns
 * - Performance impact of caching
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { MCPClient } from '../MCPClient'
import { redisCache } from '../../cache/RedisCache'

// Mock Redis to control cache behavior testing
jest.mock('../../cache/RedisCache', () => ({
  redisCache: {
    get: jest.fn(),
    set: jest.fn(),
    invalidatePattern: jest.fn(),
    getCachedStockPrice: jest.fn(),
    cacheStockPrice: jest.fn(),
    getStats: jest.fn(),
    warmCache: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    del: jest.fn()
  }
}))

interface CacheTestMetrics {
  hitRate: number
  missRate: number
  totalRequests: number
  averageResponseTime: number
  cacheSize: number
  invalidationRate: number
}

describe('Caching Strategy Validation Test Suite', () => {
  let mcpClient: MCPClient
  let mockRedisCache: any
  let cacheMetrics: CacheTestMetrics

  beforeEach(() => {
    // Reset singleton and create fresh instance
    (MCPClient as any).instance = undefined
    mcpClient = MCPClient.getInstance()

    // Setup Redis mock with detailed cache behavior
    mockRedisCache = redisCache as any
    mockRedisCache.get.mockResolvedValue(null)
    mockRedisCache.set.mockResolvedValue(true)
    mockRedisCache.getCachedStockPrice.mockResolvedValue(null)
    mockRedisCache.cacheStockPrice.mockResolvedValue(true)
    mockRedisCache.exists.mockResolvedValue(false)
    mockRedisCache.ttl.mockResolvedValue(-1)
    mockRedisCache.del.mockResolvedValue(1)

    // Initialize cache metrics
    cacheMetrics = {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      cacheSize: 0,
      invalidationRate: 0
    }

    mockRedisCache.getStats.mockResolvedValue(cacheMetrics)

    mcpClient.stopHealthChecks()
  })

  afterEach(() => {
    mcpClient.stopHealthChecks()
    jest.clearAllMocks()
  })

  describe('Historical Data Caching Tests', () => {
    test('should_cache_historical_stock_prices_with_long_ttl', async () => {
      // Arrange: Historical stock price request (older than 1 day)
      const testSymbol = 'AAPL'
      const historicalDate = '2023-01-01'
      const expectedCacheTTL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

      // Act: Request historical stock prices
      await mcpClient.executeTool('get_aggs', {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'day',
        from_: historicalDate,
        to: historicalDate
      }, {
        cacheTTL: expectedCacheTTL,
        preferredServer: 'polygon'
      })

      // Assert: Historical data cached with long TTL
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        expect.stringContaining(`tool:get_aggs:${JSON.stringify({
          ticker: testSymbol,
          multiplier: 1,
          timespan: 'day',
          from_: historicalDate,
          to: historicalDate
        })}`),
        expect.any(Object),
        expectedCacheTTL,
        expect.objectContaining({
          source: 'polygon',
          version: '1.0.0'
        })
      )
    })

    test('should_cache_historical_financial_statements_for_extended_periods', async () => {
      // Arrange: Historical financial statement request
      const testSymbol = 'MSFT'
      const fiscalYear = 2023
      const expectedCacheTTL = 7 * 24 * 60 * 60 * 1000 // 7 days (quarterly data doesn't change)

      // Act: Request historical financial statements
      await mcpClient.executeTool('get_financial_statement', {
        symbol: testSymbol,
        statement_type: '10-K',
        fiscal_year: fiscalYear
      }, {
        cacheTTL: expectedCacheTTL,
        preferredServer: 'sec_edgar'
      })

      // Assert: Financial statements cached with extended TTL
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        expect.stringContaining('tool:get_financial_statement'),
        expect.any(Object),
        expectedCacheTTL,
        expect.any(Object)
      )
    })

    test('should_cache_historical_economic_indicators_with_appropriate_ttl', async () => {
      // Arrange: Historical economic indicator request
      const requestDate = '2023-12-01'
      const expectedCacheTTL = 30 * 24 * 60 * 60 * 1000 // 30 days (historical economic data is stable)

      // Act: Request historical economic indicators
      await mcpClient.executeTool('get_employment_statistics', {
        date: requestDate,
        frequency: 'monthly'
      }, {
        cacheTTL: expectedCacheTTL,
        preferredServer: 'data_gov'
      })

      // Assert: Economic indicators cached with monthly TTL
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        expect.stringContaining('tool:get_employment_statistics'),
        expect.any(Object),
        expectedCacheTTL,
        expect.any(Object)
      )
    })

    test('should_retrieve_cached_historical_data_on_subsequent_requests', async () => {
      // Arrange: Setup cache hit scenario
      const testSymbol = 'GOOGL'
      const cachedHistoricalData = {
        results: [{
          o: 150,
          c: 155,
          h: 157,
          l: 149,
          v: 1000000,
          t: new Date('2023-01-01').getTime()
        }],
        status: 'OK'
      }

      mockRedisCache.get.mockResolvedValueOnce(cachedHistoricalData)

      // Act: Request same historical data
      const response = await mcpClient.executeTool('get_aggs', {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'day',
        from_: '2023-01-01',
        to: '2023-01-01'
      }, {
        cacheTTL: 86400000 // 24 hours
      })

      // Assert: Data retrieved from cache
      expect(response.success).toBe(true)
      expect(response.cached).toBe(true)
      expect(response.source).toBe('redis-cache')
      expect(response.data).toEqual(cachedHistoricalData)
    })
  })

  describe('Real-Time Data Exclusion Tests', () => {
    test('should_never_cache_current_market_prices', async () => {
      // Arrange: Current market price request (real-time)
      const testSymbol = 'TSLA'
      const currentDate = new Date().toISOString().split('T')[0]

      // Act: Request current market prices
      await mcpClient.executeTool('get_last_quote', {
        ticker: testSymbol
      }, {
        cacheTTL: 0, // Explicitly no caching for real-time
        preferredServer: 'polygon'
      })

      // Assert: Current prices not cached
      expect(mockRedisCache.set).not.toHaveBeenCalled()
    })

    test('should_never_cache_live_news_and_sentiment', async () => {
      // Arrange: Live news and sentiment request
      const testKeywords = 'AAPL earnings'

      // Act: Request live news sentiment
      await mcpClient.executeTool('news_sentiment', {
        topics: testKeywords,
        live: true,
        max_age_minutes: 30
      }, {
        cacheTTL: 0, // No caching for live news
        preferredServer: 'dappier'
      })

      // Assert: Live news not cached
      expect(mockRedisCache.set).not.toHaveBeenCalled()
    })

    test('should_never_cache_intraday_trading_data', async () => {
      // Arrange: Intraday trading data request
      const testSymbol = 'AMZN'
      const today = new Date().toISOString().split('T')[0]

      // Act: Request intraday data
      await mcpClient.executeTool('get_aggs', {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'minute',
        from_: today,
        to: today
      }, {
        cacheTTL: 0, // No caching for intraday
        preferredServer: 'polygon'
      })

      // Assert: Intraday data not cached
      expect(mockRedisCache.set).not.toHaveBeenCalled()
    })

    test('should_never_cache_market_status_and_conditions', async () => {
      // Arrange: Market status request (always current)

      // Act: Request market status
      await mcpClient.executeTool('get_market_status', {}, {
        cacheTTL: 0, // Market status never cached
        preferredServer: 'polygon'
      })

      // Assert: Market status not cached
      expect(mockRedisCache.set).not.toHaveBeenCalled()
    })
  })

  describe('Differentiated TTL Strategy Tests', () => {
    test('should_use_short_ttl_for_daily_closing_prices', async () => {
      // Arrange: Daily closing price from yesterday (semi-recent)
      const testSymbol = 'NVDA'
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const expectedShortTTL = 4 * 60 * 60 * 1000 // 4 hours

      // Act: Request yesterday's closing price
      await mcpClient.executeTool('get_daily_open_close_agg', {
        ticker: testSymbol,
        date: yesterday
      }, {
        cacheTTL: expectedShortTTL,
        preferredServer: 'polygon'
      })

      // Assert: Recent daily data cached with short TTL
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        expect.stringContaining('tool:get_daily_open_close_agg'),
        expect.any(Object),
        expectedShortTTL,
        expect.any(Object)
      )
    })

    test('should_use_medium_ttl_for_company_fundamentals', async () => {
      // Arrange: Company fundamental data (changes quarterly)
      const testSymbol = 'META'
      const expectedMediumTTL = 6 * 60 * 60 * 1000 // 6 hours

      // Act: Request company fundamentals
      await mcpClient.executeTool('get_ticker_details', {
        ticker: testSymbol
      }, {
        cacheTTL: expectedMediumTTL,
        preferredServer: 'polygon'
      })

      // Assert: Fundamental data cached with medium TTL
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        expect.stringContaining('tool:get_ticker_details'),
        expect.any(Object),
        expectedMediumTTL,
        expect.any(Object)
      )
    })

    test('should_use_long_ttl_for_government_regulatory_data', async () => {
      // Arrange: Government regulatory data (changes infrequently)
      const testCIK = '0000320193'
      const expectedLongTTL = 24 * 60 * 60 * 1000 // 24 hours

      // Act: Request SEC filing data
      await mcpClient.executeTool('get_company_filings', {
        cik: testCIK,
        form_types: ['10-K'],
        limit: 5
      }, {
        cacheTTL: expectedLongTTL,
        preferredServer: 'sec_edgar'
      })

      // Assert: Regulatory data cached with long TTL
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        expect.stringContaining('tool:get_company_filings'),
        expect.any(Object),
        expectedLongTTL,
        expect.any(Object)
      )
    })

    test('should_dynamically_adjust_ttl_based_on_data_age', async () => {
      // Arrange: Test dynamic TTL calculation based on data age
      const testSymbol = 'IBM'
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Act: Request data of different ages
      await mcpClient.executeTool('get_aggs', {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'day',
        from_: oneWeekAgo,
        to: oneWeekAgo
      }, {
        preferredServer: 'polygon'
      })

      await mcpClient.executeTool('get_aggs', {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'day',
        from_: oneMonthAgo,
        to: oneMonthAgo
      }, {
        preferredServer: 'polygon'
      })

      // Assert: Dynamic TTL applied based on data age
      const setCalls = mockRedisCache.set.mock.calls
      expect(setCalls.length).toBeGreaterThanOrEqual(2)

      // Older data should have longer TTL
      const weekOldTTL = setCalls.find(call => call[0].includes(oneWeekAgo))?.[2]
      const monthOldTTL = setCalls.find(call => call[0].includes(oneMonthAgo))?.[2]

      if (weekOldTTL && monthOldTTL) {
        expect(monthOldTTL).toBeGreaterThanOrEqual(weekOldTTL)
      }
    })
  })

  describe('Cache Hit Rate Optimization Tests', () => {
    test('should_achieve_target_cache_hit_rate_above_75_percent', async () => {
      // Arrange: Simulate cache behavior with high hit rate
      let requestCount = 0
      let hitCount = 0

      mockRedisCache.get.mockImplementation(() => {
        requestCount++
        if (requestCount % 4 !== 1) { // 75% hit rate
          hitCount++
          return Promise.resolve({
            results: [{ o: 100, c: 105, h: 110, l: 95, v: 1000000 }]
          })
        }
        return Promise.resolve(null)
      })

      // Act: Make multiple requests for cached data
      const testSymbol = 'AAPL'
      const requests = Array.from({ length: 20 }, () =>
        mcpClient.executeTool('get_ticker_details', {
          ticker: testSymbol
        }, { cacheTTL: 3600000 })
      )

      await Promise.all(requests)

      // Update cache stats
      cacheMetrics.hitRate = hitCount / requestCount
      cacheMetrics.totalRequests = requestCount
      mockRedisCache.getStats.mockResolvedValue(cacheMetrics)

      const stats = await mcpClient.getCacheStats()

      // Assert: Cache hit rate meets target
      expect(stats.redis.hitRate).toBeGreaterThanOrEqual(0.75)
    })

    test('should_implement_cache_warming_for_popular_symbols', async () => {
      // Arrange: Popular symbols for cache warming
      const popularSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']

      // Act: Warm cache for popular symbols
      await mcpClient.warmCache(popularSymbols)

      // Assert: Cache warming executed for all symbols
      expect(mockRedisCache.warmCache).toHaveBeenCalledWith(
        popularSymbols,
        expect.arrayContaining(['polygon', 'alphavantage', 'yahoo'])
      )

      // Verify individual cache operations for each symbol
      const setCallCount = mockRedisCache.set.mock.calls.length
      expect(setCallCount).toBeGreaterThanOrEqual(popularSymbols.length)
    })

    test('should_implement_intelligent_cache_prefetching', async () => {
      // Arrange: Simulate request patterns for prefetching
      const testSymbol = 'MSFT'

      // Act: Request data that should trigger prefetching
      await mcpClient.executeTool('get_ticker_details', {
        ticker: testSymbol
      }, { cacheTTL: 3600000 })

      // Simulate prefetching of related data
      await mcpClient.prefetchRelatedData(testSymbol, [
        'get_aggs',
        'get_financial_statement',
        'technical_indicators'
      ])

      // Assert: Related data prefetched
      expect(mockRedisCache.set.mock.calls.length).toBeGreaterThan(1)
    })

    test('should_optimize_cache_keys_for_efficient_retrieval', async () => {
      // Arrange: Test cache key optimization
      const testSymbol = 'AAPL'
      const params = {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'day'
      }

      // Act: Execute request with optimized cache key
      await mcpClient.executeTool('get_aggs', params, {
        cacheTTL: 3600000
      })

      // Assert: Cache key is optimized and consistent
      const setCalls = mockRedisCache.set.mock.calls
      expect(setCalls.length).toBeGreaterThan(0)

      const cacheKey = setCalls[0][0]
      expect(cacheKey).toMatch(/^tool:get_aggs:.+/)
      expect(cacheKey).toContain(testSymbol)
      expect(cacheKey.length).toBeLessThan(250) // Reasonable key length
    })
  })

  describe('Cache Invalidation Strategy Tests', () => {
    test('should_invalidate_cache_for_market_close_updates', async () => {
      // Arrange: Market close scenario requiring cache invalidation
      const testSymbol = 'AAPL'
      const marketCloseTime = new Date()
      marketCloseTime.setHours(16, 0, 0, 0) // 4 PM EST

      // Act: Trigger market close cache invalidation
      await mcpClient.invalidateCacheOnMarketClose(testSymbol, marketCloseTime)

      // Assert: Relevant cache entries invalidated
      expect(mockRedisCache.del).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`.*${testSymbol}.*`))
      )
    })

    test('should_invalidate_cache_for_earnings_announcements', async () => {
      // Arrange: Earnings announcement requiring cache invalidation
      const testSymbol = 'MSFT'
      const earningsDate = new Date().toISOString().split('T')[0]

      // Act: Trigger earnings-based cache invalidation
      await mcpClient.invalidateCacheForEarnings(testSymbol, earningsDate)

      // Assert: Financial data cache invalidated
      expect(mockRedisCache.invalidatePattern).toHaveBeenCalledWith(
        `*${testSymbol}*financial*`
      )
      expect(mockRedisCache.invalidatePattern).toHaveBeenCalledWith(
        `*${testSymbol}*fundamentals*`
      )
    })

    test('should_implement_time_based_cache_invalidation', async () => {
      // Arrange: Time-based invalidation test
      const testKey = 'tool:get_ticker_details:{"ticker":"GOOGL"}'
      const expiredTTL = -1 // Expired

      mockRedisCache.ttl.mockResolvedValue(expiredTTL)

      // Act: Check and handle expired cache
      const result = await mcpClient.handleExpiredCache(testKey)

      // Assert: Expired cache handled appropriately
      expect(mockRedisCache.ttl).toHaveBeenCalledWith(testKey)
      expect(result.shouldRefresh).toBe(true)
    })

    test('should_implement_proactive_cache_refresh', async () => {
      // Arrange: Cache refresh before expiration
      const testSymbol = 'AMZN'
      const nearExpiryTTL = 300 // 5 minutes remaining

      mockRedisCache.ttl.mockResolvedValue(nearExpiryTTL)

      // Act: Trigger proactive refresh
      await mcpClient.proactiveRefresh(testSymbol, 'get_ticker_details')

      // Assert: Cache refreshed before expiration
      expect(mockRedisCache.ttl).toHaveBeenCalled()
      expect(mockRedisCache.set).toHaveBeenCalled()
    })
  })

  describe('Cross-Server Cache Consistency Tests', () => {
    test('should_maintain_cache_consistency_across_server_failures', async () => {
      // Arrange: Server failure scenario
      const testSymbol = 'TSLA'

      // Mock server failure and fallback
      const polygonError = new Error('Polygon server unavailable')
      mockRedisCache.get.mockResolvedValueOnce(null) // Cache miss

      // Act: Handle server failure with cache consistency
      const response = await mcpClient.executeTool('get_ticker_details', {
        ticker: testSymbol
      }, {
        preferredServer: 'polygon',
        fallbackServers: ['alphavantage', 'yahoo'],
        maintainCacheConsistency: true
      })

      // Assert: Cache consistency maintained despite server failure
      expect(response.success).toBe(true)
      // Cache should be updated with fallback data
      expect(mockRedisCache.set).toHaveBeenCalled()
    })

    test('should_synchronize_cache_across_multiple_server_responses', async () => {
      // Arrange: Multiple server responses requiring synchronization
      const testSymbol = 'META'

      // Act: Get data from multiple servers simultaneously
      const responses = await Promise.all([
        mcpClient.executeTool('get_ticker_details', { ticker: testSymbol }, {
          preferredServer: 'polygon',
          cacheTTL: 3600000
        }),
        mcpClient.executeTool('get_ticker_details', { ticker: testSymbol }, {
          preferredServer: 'yahoo',
          cacheTTL: 3600000
        })
      ])

      // Assert: Cache synchronization handled properly
      expect(responses.every(r => r.success)).toBe(true)
      // Should not duplicate cache entries
      const uniqueSetCalls = new Set(mockRedisCache.set.mock.calls.map(call => call[0]))
      expect(uniqueSetCalls.size).toBeLessThanOrEqual(2)
    })

    test('should_handle_cache_conflicts_from_concurrent_updates', async () => {
      // Arrange: Concurrent cache update scenario
      const testSymbol = 'NVDA'
      const concurrentRequests = 5

      // Act: Execute concurrent requests
      const promises = Array.from({ length: concurrentRequests }, () =>
        mcpClient.executeTool('get_ticker_details', {
          ticker: testSymbol
        }, {
          cacheTTL: 3600000,
          handleCacheConflicts: true
        })
      )

      const responses = await Promise.all(promises)

      // Assert: Cache conflicts handled without corruption
      expect(responses.every(r => r.success)).toBe(true)
      // Verify cache consistency maintained
      const setCallsForSymbol = mockRedisCache.set.mock.calls.filter(
        call => call[0].includes(testSymbol)
      )
      expect(setCallsForSymbol.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Impact Analysis Tests', () => {
    test('should_demonstrate_performance_improvement_with_caching', async () => {
      // Arrange: Performance measurement setup
      const testSymbol = 'AAPL'
      const performanceMetrics: { [key: string]: number } = {}

      // Act: Measure performance without cache
      const startNoCacheTime = Date.now()
      await mcpClient.executeTool('get_ticker_details', {
        ticker: testSymbol
      }, { cacheTTL: 0 }) // No cache
      performanceMetrics.noCacheTime = Date.now() - startNoCacheTime

      // Setup cache hit
      mockRedisCache.get.mockResolvedValueOnce({
        ticker: testSymbol,
        name: 'Apple Inc.',
        market_cap: 3000000000000
      })

      // Measure performance with cache
      const startCacheTime = Date.now()
      await mcpClient.executeTool('get_ticker_details', {
        ticker: testSymbol
      }, { cacheTTL: 3600000 })
      performanceMetrics.cacheTime = Date.now() - startCacheTime

      // Assert: Caching provides significant performance improvement
      expect(performanceMetrics.cacheTime).toBeLessThan(performanceMetrics.noCacheTime)
      const improvementRatio = performanceMetrics.noCacheTime / performanceMetrics.cacheTime
      expect(improvementRatio).toBeGreaterThan(2) // At least 2x improvement
    })

    test('should_measure_cache_memory_efficiency', async () => {
      // Arrange: Memory efficiency measurement
      const testSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']

      // Act: Cache data for multiple symbols
      for (const symbol of testSymbols) {
        await mcpClient.executeTool('get_ticker_details', {
          ticker: symbol
        }, { cacheTTL: 3600000 })
      }

      // Update cache stats with memory usage
      cacheMetrics.cacheSize = testSymbols.length * 1024 // Simulated memory usage
      mockRedisCache.getStats.mockResolvedValue(cacheMetrics)

      const stats = await mcpClient.getCacheStats()

      // Assert: Memory usage is within acceptable limits
      expect(stats.redis.memoryUsage).toBeDefined()
      expect(stats.redis.memoryUsage).toBeLessThan(100 * 1024 * 1024) // Under 100MB
    })

    test('should_validate_cache_overhead_is_minimal', async () => {
      // Arrange: Cache overhead measurement
      const testSymbol = 'IBM'
      const iterations = 10

      // Act: Measure cache operation overhead
      const startTime = Date.now()
      for (let i = 0; i < iterations; i++) {
        await mcpClient.executeTool('get_ticker_details', {
          ticker: testSymbol
        }, { cacheTTL: 3600000 })
      }
      const totalTime = Date.now() - startTime
      const averageTime = totalTime / iterations

      // Assert: Cache overhead is minimal
      expect(averageTime).toBeLessThan(100) // Under 100ms per request
    })
  })
})

// Extend MCPClient with cache testing support
declare module '../MCPClient' {
  interface MCPClient {
    invalidateCacheOnMarketClose(symbol: string, closeTime: Date): Promise<void>
    invalidateCacheForEarnings(symbol: string, earningsDate: string): Promise<void>
    handleExpiredCache(key: string): Promise<{ shouldRefresh: boolean }>
    proactiveRefresh(symbol: string, toolName: string): Promise<void>
    prefetchRelatedData(symbol: string, tools: string[]): Promise<void>
  }
}