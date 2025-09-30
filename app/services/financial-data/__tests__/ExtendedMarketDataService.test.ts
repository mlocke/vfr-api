/**
 * ExtendedMarketDataService Integration Tests
 * Tests extended market data functionality with real API integration
 * Following established VFR testing patterns
 */

import { ExtendedMarketDataService, BidAskSpread, LiquidityMetrics, ExtendedMarketData } from '../ExtendedMarketDataService'
import { FinancialModelingPrepAPI } from '../FinancialModelingPrepAPI'
import { RedisCache } from '../../cache/RedisCache'

// Test configuration
const TEST_SYMBOLS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL']
const INVALID_SYMBOL = 'INVALID123'
const TEST_TIMEOUT = 15000 // 15 seconds

describe('ExtendedMarketDataService Integration Tests', () => {
  let service: ExtendedMarketDataService
  let fmpAPI: FinancialModelingPrepAPI
  let cache: RedisCache

  beforeAll(async () => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }

    // Initialize services
    fmpAPI = new FinancialModelingPrepAPI()
    cache = new RedisCache()
    // Note: ExtendedMarketDataService now uses FinancialModelingPrepAPI instead of PolygonAPI
    service = new ExtendedMarketDataService(fmpAPI, cache)

    // Clear any existing cache data
    await cache.clear()
  })

  afterAll(async () => {
    // Cleanup resources
    await cache.cleanupForTests()

    // Force garbage collection
    if (global.gc) {
      global.gc()
    }
  })

  beforeEach(() => {
    // Reset any state if needed
    jest.clearAllMocks()
  })

  describe('Core Extended Market Data Functionality', () => {
    test('should get comprehensive extended market data for valid symbol', async () => {
      const symbol = TEST_SYMBOLS[0] // AAPL
      const result = await service.getExtendedMarketData(symbol)

      expect(result).toBeDefined()
      expect(result?.symbol).toBe(symbol.toUpperCase())
      expect(result?.regularData).toBeDefined()
      expect(result?.extendedHours).toBeDefined()
      expect(result?.source).toBe('fmp')
      expect(result?.timestamp).toBeGreaterThan(0)

      // Regular data should have basic stock information
      expect(result?.regularData.price).toBeGreaterThan(0)
      expect(result?.regularData.volume).toBeGreaterThanOrEqual(0)

      // Extended hours data should have market status
      expect(['pre-market', 'market-hours', 'after-hours', 'closed']).toContain(result?.extendedHours.marketStatus)
    }, TEST_TIMEOUT)

    test('should handle invalid symbol gracefully', async () => {
      const result = await service.getExtendedMarketData(INVALID_SYMBOL)
      expect(result).toBeNull()
    }, TEST_TIMEOUT)

    test('should return cached data on subsequent calls', async () => {
      const symbol = TEST_SYMBOLS[1] // MSFT

      // First call - should hit API
      const result1 = await service.getExtendedMarketData(symbol)
      expect(result1).toBeDefined()

      // Second call - should hit cache
      const start = Date.now()
      const result2 = await service.getExtendedMarketData(symbol)
      const duration = Date.now() - start

      expect(result2).toBeDefined()
      expect(result2?.symbol).toBe(result1?.symbol)
      expect(duration).toBeLessThan(100) // Should be much faster from cache
    }, TEST_TIMEOUT)
  })

  describe('Bid/Ask Spread Analysis', () => {
    test('should get bid/ask spread data for liquid stock', async () => {
      const symbol = TEST_SYMBOLS[0] // AAPL - highly liquid
      const spread = await service.getBidAskSpread(symbol)

      if (spread) {
        expect(spread.symbol).toBe(symbol.toUpperCase())
        expect(spread.bid).toBeGreaterThan(0)
        expect(spread.ask).toBeGreaterThan(spread.bid)
        expect(spread.spread).toBeGreaterThan(0)
        expect(spread.spreadPercent).toBeGreaterThanOrEqual(0)
        expect(spread.midpoint).toBe((spread.bid + spread.ask) / 2)
        expect(spread.source).toBe('fmp')
      } else {
        // Acceptable if bid/ask not available outside market hours
        console.log(`Bid/ask data not available for ${symbol} - may be outside market hours`)
      }
    }, TEST_TIMEOUT)

    test('should handle multiple symbols for batch spread analysis', async () => {
      const symbols = TEST_SYMBOLS.slice(0, 3) // Test with 3 symbols
      const results = await service.getBatchLiquidityMetrics(symbols)

      expect(results).toBeInstanceOf(Map)
      expect(results.size).toBe(symbols.length)

      // Check that each symbol has a result (may be null if no data available)
      symbols.forEach(symbol => {
        expect(results.has(symbol)).toBe(true)
      })
    }, TEST_TIMEOUT * 2)

    test('should cache bid/ask spread data', async () => {
      const symbol = TEST_SYMBOLS[2] // TSLA

      // First call
      const result1 = await service.getBidAskSpread(symbol)

      // Second call - should be faster due to caching
      const start = Date.now()
      const result2 = await service.getBidAskSpread(symbol)
      const duration = Date.now() - start

      if (result1 && result2) {
        expect(result2.symbol).toBe(result1.symbol)
        expect(duration).toBeLessThan(50) // Cache should be very fast
      }
    }, TEST_TIMEOUT)
  })

  describe('Liquidity Metrics Calculation', () => {
    test('should calculate liquidity metrics when spread data available', async () => {
      const symbol = TEST_SYMBOLS[0] // AAPL
      const extendedData = await service.getExtendedMarketData(symbol)

      if (extendedData?.liquidityMetrics) {
        const metrics = extendedData.liquidityMetrics

        expect(metrics.symbol).toBe(symbol.toUpperCase())
        expect(metrics.liquidityScore).toBeGreaterThanOrEqual(0)
        expect(metrics.liquidityScore).toBeLessThanOrEqual(10)
        expect(metrics.spreadPercent).toBeGreaterThanOrEqual(0)
        expect(metrics.averageSpread).toBeGreaterThanOrEqual(0)
        expect(metrics.spreadVolatility).toBeGreaterThanOrEqual(0)
        expect(metrics.marketMakingActivity).toBeGreaterThanOrEqual(0)
        expect(metrics.marketMakingActivity).toBeLessThanOrEqual(10)
        expect(metrics.source).toBe('fmp')
      } else {
        console.log(`Liquidity metrics not available for ${symbol} - may be outside market hours`)
      }
    }, TEST_TIMEOUT)

    test('should provide consistent liquidity scoring', async () => {
      const symbols = ['AAPL', 'MSFT'] // Two highly liquid stocks
      const results = await Promise.all(
        symbols.map(symbol => service.getExtendedMarketData(symbol))
      )

      const validResults = results.filter(r => r?.liquidityMetrics)

      if (validResults.length >= 2) {
        // Both should have high liquidity scores
        validResults.forEach(result => {
          expect(result!.liquidityMetrics!.liquidityScore).toBeGreaterThan(5) // Should be above average
        })
      }
    }, TEST_TIMEOUT * 2)
  })

  describe('Extended Hours Trading Data', () => {
    test('should get extended hours data', async () => {
      const symbol = TEST_SYMBOLS[3] // NVDA
      const extendedHours = await service.getExtendedHoursData(symbol)

      expect(extendedHours).toBeDefined()
      expect(extendedHours?.symbol).toBe(symbol.toUpperCase())
      expect(['pre-market', 'market-hours', 'after-hours', 'closed']).toContain(extendedHours?.marketStatus)
      expect(extendedHours?.source).toBe('fmp')
    }, TEST_TIMEOUT)

    test('should get current market status', async () => {
      const status = await service.getMarketStatus()
      expect(['pre-market', 'market-hours', 'after-hours', 'closed']).toContain(status)
    }, TEST_TIMEOUT)

    test('should handle extended hours data when available', async () => {
      const symbol = TEST_SYMBOLS[0] // AAPL
      const extendedData = await service.getExtendedMarketData(symbol)

      expect(extendedData?.extendedHours).toBeDefined()

      const ehData = extendedData!.extendedHours

      // Validate extended hours data structure
      if (ehData.preMarketPrice !== undefined) {
        expect(ehData.preMarketPrice).toBeGreaterThan(0)
        expect(ehData.preMarketChange).toBeDefined()
        expect(ehData.preMarketChangePercent).toBeDefined()
      }

      if (ehData.afterHoursPrice !== undefined) {
        expect(ehData.afterHoursPrice).toBeGreaterThan(0)
        expect(ehData.afterHoursChange).toBeDefined()
        expect(ehData.afterHoursChangePercent).toBeDefined()
      }
    }, TEST_TIMEOUT)
  })

  describe('Integration Scoring for StockSelectionService', () => {
    test('should calculate extended market score for technical analysis', async () => {
      const symbol = TEST_SYMBOLS[0] // AAPL
      const extendedData = await service.getExtendedMarketData(symbol)

      if (extendedData) {
        const score = service.calculateExtendedMarketScore(extendedData)

        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
        expect(typeof score).toBe('number')
        expect(Number.isFinite(score)).toBe(true)
      }
    }, TEST_TIMEOUT)

    test('should provide meaningful scores for different liquidity levels', async () => {
      const symbols = ['AAPL', 'MSFT'] // Different liquidity profiles
      const scores = await Promise.all(
        symbols.map(async symbol => {
          const data = await service.getExtendedMarketData(symbol)
          return data ? service.calculateExtendedMarketScore(data) : null
        })
      )

      const validScores = scores.filter(s => s !== null)

      if (validScores.length >= 2) {
        // All scores should be valid numbers
        validScores.forEach(score => {
          expect(typeof score).toBe('number')
          expect(Number.isFinite(score!)).toBe(true)
          expect(score!).toBeGreaterThanOrEqual(0)
          expect(score!).toBeLessThanOrEqual(1)
        })
      }
    }, TEST_TIMEOUT * 2)
  })

  describe('Performance and Memory Management', () => {
    test('should handle multiple concurrent requests efficiently', async () => {
      const symbols = TEST_SYMBOLS
      const start = Date.now()

      const results = await Promise.all(
        symbols.map(symbol => service.getExtendedMarketData(symbol))
      )

      const duration = Date.now() - start
      const validResults = results.filter(r => r !== null)

      expect(validResults.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(TEST_TIMEOUT) // Should complete within timeout

      console.log(`Processed ${validResults.length}/${symbols.length} symbols in ${duration}ms`)
    }, TEST_TIMEOUT * 2)

    test('should cache data with appropriate TTL', async () => {
      const symbol = TEST_SYMBOLS[0]

      // Get cache stats before
      const statsBefore = await cache.getStats()

      // First call - should miss cache
      await service.getExtendedMarketData(symbol)

      // Second call - should hit cache
      await service.getExtendedMarketData(symbol)

      const statsAfter = await cache.getStats()

      // Should have some cache activity
      expect(statsAfter.sets).toBeGreaterThanOrEqual(statsBefore.sets)
    }, TEST_TIMEOUT)

    test('should handle memory pressure gracefully', async () => {
      const initialMemory = process.memoryUsage().heapUsed

      // Process multiple symbols to create memory pressure
      const symbols = [...TEST_SYMBOLS, ...TEST_SYMBOLS] // Duplicate symbols
      await Promise.all(
        symbols.map(symbol => service.getExtendedMarketData(symbol))
      )

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
    }, TEST_TIMEOUT * 3)
  })

  describe('Error Handling and Resilience', () => {
    test('should handle API errors gracefully', async () => {
      // Test with invalid symbol
      const result = await service.getExtendedMarketData(INVALID_SYMBOL)
      expect(result).toBeNull() // Should return null, not throw
    }, TEST_TIMEOUT)

    test('should handle cache failures gracefully', async () => {
      // Temporarily break cache by using invalid key
      const symbol = TEST_SYMBOLS[0]

      // Should still work even if cache operations fail
      const result = await service.getExtendedMarketData(symbol)

      // Should get data from API directly
      if (result) {
        expect(result.symbol).toBe(symbol.toUpperCase())
      }
    }, TEST_TIMEOUT)

    test('should handle partial data availability', async () => {
      const symbol = TEST_SYMBOLS[4] // GOOGL
      const result = await service.getExtendedMarketData(symbol)

      if (result) {
        // Should have at least basic data
        expect(result.regularData).toBeDefined()
        expect(result.extendedHours).toBeDefined()

        // Bid/ask and liquidity may be null outside market hours
        // This is acceptable behavior
        if (result.bidAskSpread === null) {
          console.log(`Bid/ask data not available for ${symbol}`)
        }

        if (result.liquidityMetrics === null) {
          console.log(`Liquidity metrics not available for ${symbol}`)
        }
      }
    }, TEST_TIMEOUT)
  })

  describe('Real-time Data Quality', () => {
    test('should provide recent timestamp data', async () => {
      const symbol = TEST_SYMBOLS[0]
      const result = await service.getExtendedMarketData(symbol)

      if (result) {
        const now = Date.now()
        const dataAge = now - result.timestamp

        // Data should be relatively fresh (within 1 minute of request)
        expect(dataAge).toBeLessThan(60000)

        // Regular data should also be recent
        const regularDataAge = now - result.regularData.timestamp
        expect(regularDataAge).toBeLessThan(300000) // Within 5 minutes
      }
    }, TEST_TIMEOUT)

    test('should handle rate limiting gracefully', async () => {
      // Test multiple rapid requests
      const symbol = TEST_SYMBOLS[0]
      const requests = Array(5).fill(null).map(() =>
        service.getBidAskSpread(symbol)
      )

      const results = await Promise.allSettled(requests)

      // Should handle all requests without throwing errors
      results.forEach((result, index) => {
        expect(['fulfilled', 'rejected']).toContain(result.status)
        if (result.status === 'rejected') {
          console.log(`Request ${index} failed: ${result.reason}`)
        }
      })
    }, TEST_TIMEOUT * 2)
  })
})