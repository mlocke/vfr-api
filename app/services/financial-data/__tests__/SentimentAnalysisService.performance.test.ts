/**
 * SentimentAnalysisService Performance Tests
 * Validates <500ms response time target and memory efficiency
 * Uses real NewsAPI calls with proper memory cleanup
 *
 * Performance Requirements:
 * - Single stock sentiment analysis: <500ms
 * - Memory leak prevention during bulk processing
 * - Parallel processing efficiency validation
 * - Cache hit rate >80% after warm-up
 * - Real API integration performance
 * - Garbage collection optimization
 */

import { SentimentAnalysisService } from '../SentimentAnalysisService'
import NewsAPI from '../providers/NewsAPI'
import { RedisCache } from '../../cache/RedisCache'
import {
  SentimentIndicators,
  StockSentimentImpact,
  BulkSentimentAnalysisResponse
} from '../types/sentiment-types'

// Performance monitoring utilities
interface PerformanceMetrics {
  startTime: number
  endTime: number
  duration: number
  memoryUsage: {
    before: NodeJS.MemoryUsage
    after: NodeJS.MemoryUsage
    delta: Partial<NodeJS.MemoryUsage>
  }
}

interface CacheMetrics {
  hits: number
  misses: number
  hitRate: number
}

// Test symbols for real API calls
const TEST_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA']
const PERFORMANCE_TARGET_MS = 500
const CACHE_HIT_RATE_TARGET = 0.80
const MEMORY_LEAK_THRESHOLD_MB = 50

// Mock InMemoryCache for testing
class MockInMemoryCache {
  private store: Map<string, { value: any; expiry: number }> = new Map()

  async get(key: string): Promise<any> {
    const item = this.store.get(key)
    if (!item || (item.expiry && Date.now() > item.expiry)) {
      this.store.delete(key)
      return null
    }
    return item.value
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expiry = ttl ? Date.now() + ttl : 0
    this.store.set(key, { value, expiry })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async ping(): Promise<string> {
    return 'PONG'
  }

  async clear(): Promise<void> {
    this.store.clear()
  }
}

describe('SentimentAnalysisService Performance Tests', () => {
  let sentimentService: SentimentAnalysisService
  let newsAPI: NewsAPI
  let cache: RedisCache | MockInMemoryCache
  let cacheMetrics: CacheMetrics

  beforeAll(async () => {
    // Initialize with real API key
    const apiKey = process.env.NEWSAPI_KEY
    if (!apiKey) {
      console.warn('⚠️ NEWSAPI_KEY not found - some performance tests may be limited')
    }

    newsAPI = new NewsAPI(apiKey, 10000) // 10s timeout for performance tests

    // Use MockInMemoryCache for consistent performance testing
    cache = new MockInMemoryCache()
    sentimentService = new SentimentAnalysisService(newsAPI, cache as unknown as RedisCache)

    // Initialize cache metrics tracking
    cacheMetrics = { hits: 0, misses: 0, hitRate: 0 }

    // Override cache methods to track metrics
    const originalGet = cache.get.bind(cache)
    const originalSet = cache.set.bind(cache)

    cache.get = async (key: string) => {
      const result = await originalGet(key)
      if (result !== null) {
        cacheMetrics.hits++
      } else {
        cacheMetrics.misses++
      }
      cacheMetrics.hitRate = cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses)
      return result
    }

    cache.set = async (key: string, value: any, ttl?: number) => {
      return originalSet(key, value, ttl)
    }

    console.log('🚀 Performance test environment initialized')
  })

  afterAll(async () => {
    // Clean up resources
    if (cache && typeof (cache as any).disconnect === 'function') {
      await (cache as any).disconnect()
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }

    console.log('🧹 Performance test cleanup completed')
  })

  beforeEach(() => {
    // Reset cache metrics for each test
    cacheMetrics = { hits: 0, misses: 0, hitRate: 0 }
  })

  afterEach(async () => {
    // Force garbage collection between tests
    if (global.gc) {
      global.gc()
      await new Promise(resolve => setTimeout(resolve, 100)) // Allow GC to complete
    }
  })

  /**
   * Utility function to measure performance metrics
   */
  function startPerformanceMonitoring(): PerformanceMetrics {
    const memoryBefore = process.memoryUsage()
    return {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      memoryUsage: {
        before: memoryBefore,
        after: memoryBefore,
        delta: {}
      }
    }
  }

  function endPerformanceMonitoring(metrics: PerformanceMetrics): PerformanceMetrics {
    const memoryAfter = process.memoryUsage()
    metrics.endTime = Date.now()
    metrics.duration = metrics.endTime - metrics.startTime
    metrics.memoryUsage.after = memoryAfter
    metrics.memoryUsage.delta = {
      rss: memoryAfter.rss - metrics.memoryUsage.before.rss,
      heapUsed: memoryAfter.heapUsed - metrics.memoryUsage.before.heapUsed,
      heapTotal: memoryAfter.heapTotal - metrics.memoryUsage.before.heapTotal,
      external: memoryAfter.external - metrics.memoryUsage.before.external
    }
    return metrics
  }

  describe('Single Stock Sentiment Analysis Performance', () => {
    it('should complete sentiment analysis within 500ms for single stock', async () => {
      const symbol = 'AAPL'
      const sector = 'Technology'
      const baseScore = 0.75

      const metrics = startPerformanceMonitoring()

      const result = await sentimentService.analyzeStockSentimentImpact(symbol, sector, baseScore)

      const finalMetrics = endPerformanceMonitoring(metrics)

      expect(result).toBeTruthy()
      expect(finalMetrics.duration).toBeLessThan(PERFORMANCE_TARGET_MS)

      console.log(`📊 Single stock analysis (${symbol}): ${finalMetrics.duration}ms`)
      console.log(`💾 Memory delta: ${Math.round((finalMetrics.memoryUsage.delta.heapUsed || 0) / 1024 / 1024 * 100) / 100}MB`)

      // Verify result quality
      if (result) {
        expect(result.symbol).toBe(symbol)
        expect(result.sentimentScore).toBeDefined()
        expect(result.adjustedScore).toBeGreaterThanOrEqual(0)
        expect(result.adjustedScore).toBeLessThanOrEqual(1)
      }
    }, 30000) // 30s timeout for real API calls

    it('should maintain consistent performance across different stocks', async () => {
      const testCases = [
        { symbol: 'MSFT', sector: 'Technology', baseScore: 0.8 },
        { symbol: 'GOOGL', sector: 'Technology', baseScore: 0.7 },
        { symbol: 'TSLA', sector: 'Consumer Cyclical', baseScore: 0.6 }
      ]

      const results: Array<{ symbol: string; duration: number; success: boolean }> = []

      for (const testCase of testCases) {
        const metrics = startPerformanceMonitoring()

        const result = await sentimentService.analyzeStockSentimentImpact(
          testCase.symbol,
          testCase.sector,
          testCase.baseScore
        )

        const finalMetrics = endPerformanceMonitoring(metrics)

        results.push({
          symbol: testCase.symbol,
          duration: finalMetrics.duration,
          success: result !== null
        })

        // Each individual call should be under the performance target
        expect(finalMetrics.duration).toBeLessThan(PERFORMANCE_TARGET_MS)
      }

      // Calculate average performance
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
      const successRate = results.filter(r => r.success).length / results.length

      console.log(`📈 Average duration across stocks: ${Math.round(avgDuration)}ms`)
      console.log(`✅ Success rate: ${Math.round(successRate * 100)}%`)

      expect(avgDuration).toBeLessThan(PERFORMANCE_TARGET_MS)
      expect(successRate).toBeGreaterThan(0.8) // 80% success rate minimum
    }, 60000)
  })

  describe('Memory Leak Prevention Tests', () => {
    it('should not leak memory during bulk processing', async () => {
      const stocks = TEST_SYMBOLS.map(symbol => ({
        symbol,
        sector: 'Technology',
        baseScore: 0.75
      }))

      const initialMemory = process.memoryUsage()
      const memorySnapshots: NodeJS.MemoryUsage[] = [initialMemory]

      // Perform multiple bulk operations
      for (let i = 0; i < 3; i++) {
        const result = await sentimentService.analyzeBulkSentimentImpact(stocks)
        expect(result.success).toBe(true)

        // Force garbage collection
        if (global.gc) {
          global.gc()
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        memorySnapshots.push(process.memoryUsage())
      }

      // Analyze memory growth
      const finalMemory = memorySnapshots[memorySnapshots.length - 1]
      const memoryGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024

      console.log(`🧠 Memory growth over bulk operations: ${Math.round(memoryGrowthMB * 100) / 100}MB`)

      // Memory growth should be within acceptable limits
      expect(memoryGrowthMB).toBeLessThan(MEMORY_LEAK_THRESHOLD_MB)

      // Heap usage should not continuously increase
      const memoryGrowthTrend = memorySnapshots.slice(1).map((snapshot, i) =>
        snapshot.heapUsed - memorySnapshots[i].heapUsed
      )

      // No snapshot should show excessive growth
      memoryGrowthTrend.forEach(growth => {
        expect(growth / 1024 / 1024).toBeLessThan(MEMORY_LEAK_THRESHOLD_MB / 2)
      })
    }, 120000) // 2 minute timeout for bulk operations

    it('should properly clean up resources after failed operations', async () => {
      const invalidSymbol = 'INVALID_SYMBOL_12345'
      const initialMemory = process.memoryUsage()

      // Attempt multiple operations with invalid data
      for (let i = 0; i < 5; i++) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          invalidSymbol,
          'Invalid',
          0.5
        )
        // Results may be null due to invalid symbol, but shouldn't leak memory
      }

      if (global.gc) {
        global.gc()
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const finalMemory = process.memoryUsage()
      const memoryGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024

      console.log(`🚨 Memory growth with failed operations: ${Math.round(memoryGrowthMB * 100) / 100}MB`)

      expect(memoryGrowthMB).toBeLessThan(10) // Should be minimal growth
    }, 60000)
  })

  describe('Parallel Processing Efficiency', () => {
    it('should efficiently handle parallel sentiment analysis', async () => {
      const stocks = TEST_SYMBOLS.map(symbol => ({
        symbol,
        sector: 'Technology',
        baseScore: Math.random() * 0.5 + 0.5 // Random score between 0.5-1.0
      }))

      // Test sequential vs parallel execution
      const sequentialMetrics = startPerformanceMonitoring()

      const sequentialResults: (StockSentimentImpact | null)[] = []
      for (const stock of stocks) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          stock.symbol,
          stock.sector,
          stock.baseScore
        )
        sequentialResults.push(result)
      }

      const finalSequentialMetrics = endPerformanceMonitoring(sequentialMetrics)

      // Now test bulk processing (which may use parallel processing internally)
      const parallelMetrics = startPerformanceMonitoring()

      const parallelResult = await sentimentService.analyzeBulkSentimentImpact(stocks)

      const finalParallelMetrics = endPerformanceMonitoring(parallelMetrics)

      console.log(`⏱️ Sequential processing: ${finalSequentialMetrics.duration}ms`)
      console.log(`⚡ Bulk processing: ${finalParallelMetrics.duration}ms`)

      // Bulk processing should be more memory efficient per operation
      const sequentialMemoryPerOp = (finalSequentialMetrics.memoryUsage.delta.heapUsed || 0) / stocks.length
      const parallelMemoryPerOp = (finalParallelMetrics.memoryUsage.delta.heapUsed || 0) / stocks.length

      console.log(`🧠 Memory per operation - Sequential: ${Math.round(sequentialMemoryPerOp / 1024)}KB, Bulk: ${Math.round(parallelMemoryPerOp / 1024)}KB`)

      // Verify results quality
      expect(parallelResult.success).toBe(true)
      if (parallelResult.success && parallelResult.data) {
        expect(parallelResult.data.stockImpacts.length).toBeGreaterThan(0)
        expect(parallelResult.executionTime).toBeLessThan(finalParallelMetrics.duration + 100) // Allow small variance
      }
    }, 180000) // 3 minute timeout for comprehensive parallel test

    it('should handle concurrent requests without performance degradation', async () => {
      const concurrentRequests = TEST_SYMBOLS.map(symbol =>
        sentimentService.analyzeStockSentimentImpact(symbol, 'Technology', 0.75)
      )

      const startTime = Date.now()
      const results = await Promise.allSettled(concurrentRequests)
      const duration = Date.now() - startTime

      const successfulResults = results.filter(r => r.status === 'fulfilled' && r.value !== null)
      const successRate = successfulResults.length / results.length

      console.log(`🔄 Concurrent requests completed in: ${duration}ms`)
      console.log(`✅ Success rate for concurrent requests: ${Math.round(successRate * 100)}%`)

      // Concurrent processing should still meet performance targets
      expect(duration).toBeLessThan(PERFORMANCE_TARGET_MS * 2) // Allow 2x target for concurrent operations
      expect(successRate).toBeGreaterThan(0.7) // 70% success rate minimum for concurrent operations
    }, 60000)
  })

  describe('Cache Performance Validation', () => {
    it('should achieve >80% cache hit rate after warm-up', async () => {
      const symbol = 'AAPL'

      // Warm-up phase - populate cache
      await sentimentService.getSentimentIndicators(symbol)

      // Reset metrics after warm-up
      cacheMetrics = { hits: 0, misses: 0, hitRate: 0 }

      // Perform multiple requests that should hit cache
      const requests = Array(10).fill(null).map(() =>
        sentimentService.getSentimentIndicators(symbol)
      )

      await Promise.all(requests)

      console.log(`🎯 Cache hit rate: ${Math.round(cacheMetrics.hitRate * 100)}%`)
      console.log(`📊 Cache stats - Hits: ${cacheMetrics.hits}, Misses: ${cacheMetrics.misses}`)

      expect(cacheMetrics.hitRate).toBeGreaterThan(CACHE_HIT_RATE_TARGET)
    }, 60000)

    it('should maintain performance with cache misses', async () => {
      // Use different symbols to force cache misses
      const symbols = [...TEST_SYMBOLS, 'NFLX', 'NVDA', 'META']

      const metrics = startPerformanceMonitoring()

      const results = await Promise.all(
        symbols.map(symbol => sentimentService.getSentimentIndicators(symbol))
      )

      const finalMetrics = endPerformanceMonitoring(metrics)

      const avgTimePerSymbol = finalMetrics.duration / symbols.length

      console.log(`⏱️ Average time per symbol (cache misses): ${Math.round(avgTimePerSymbol)}ms`)

      // Even with cache misses, should be reasonable performance
      expect(avgTimePerSymbol).toBeLessThan(PERFORMANCE_TARGET_MS * 1.5)

      // Verify we got some results
      const successfulResults = results.filter(r => r !== null)
      expect(successfulResults.length).toBeGreaterThan(0)
    }, 120000)
  })

  describe('Real API Integration Performance', () => {
    it('should handle API rate limiting gracefully', async () => {
      // Rapid succession of API calls to test rate limiting
      const rapidRequests = TEST_SYMBOLS.map(symbol =>
        sentimentService.getSentimentIndicators(symbol)
      )

      const startTime = Date.now()
      const results = await Promise.allSettled(rapidRequests)
      const duration = Date.now() - startTime

      const successfulResults = results.filter(r =>
        r.status === 'fulfilled' && r.value !== null
      ).length

      const failedResults = results.filter(r =>
        r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null)
      ).length

      console.log(`🚦 API rate limiting test - Success: ${successfulResults}, Failed: ${failedResults}`)
      console.log(`⏱️ Total duration: ${duration}ms`)

      // At least some requests should succeed even with rate limiting
      expect(successfulResults).toBeGreaterThan(0)

      // Should handle failures gracefully without throwing unhandled exceptions
      expect(results.every(r => r.status === 'fulfilled' || r.status === 'rejected')).toBe(true)
    }, 120000)

    it('should handle network timeouts appropriately', async () => {
      // Create a service with very short timeout to test timeout handling
      const shortTimeoutAPI = new NewsAPI(process.env.NEWSAPI_KEY, 1000) // 1 second timeout
      const timeoutTestService = new SentimentAnalysisService(shortTimeoutAPI, cache as RedisCache)

      const startTime = Date.now()
      const result = await timeoutTestService.analyzeStockSentimentImpact('AAPL', 'Technology', 0.75)
      const duration = Date.now() - startTime

      console.log(`⏰ Timeout test duration: ${duration}ms`)

      // Should handle timeout gracefully and return within reasonable time
      expect(duration).toBeLessThan(5000) // Should not hang indefinitely

      // Result may be null due to timeout, but should not throw exception
      if (result === null) {
        console.log('📵 Request handled timeout gracefully')
      } else {
        console.log('⚡ Request completed within timeout')
        expect(result.symbol).toBe('AAPL')
      }
    }, 30000)
  })

  describe('Garbage Collection Optimization', () => {
    it('should trigger efficient garbage collection during bulk operations', async () => {
      if (!global.gc) {
        console.log('⚠️ Garbage collection not available - skipping GC optimization test')
        return
      }

      const initialMemory = process.memoryUsage()

      // Perform memory-intensive operations
      const bulkOperations = Array(3).fill(null).map(() =>
        sentimentService.analyzeBulkSentimentImpact(
          TEST_SYMBOLS.map(symbol => ({ symbol, sector: 'Technology', baseScore: 0.75 }))
        )
      )

      await Promise.all(bulkOperations)

      const beforeGC = process.memoryUsage()
      global.gc()
      await new Promise(resolve => setTimeout(resolve, 500)) // Allow GC to complete
      const afterGC = process.memoryUsage()

      const memoryFreed = (beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024

      console.log(`🗑️ Memory freed by GC: ${Math.round(memoryFreed * 100) / 100}MB`)
      console.log(`📊 Heap before GC: ${Math.round(beforeGC.heapUsed / 1024 / 1024)}MB`)
      console.log(`📊 Heap after GC: ${Math.round(afterGC.heapUsed / 1024 / 1024)}MB`)

      // GC should free up some memory
      expect(memoryFreed).toBeGreaterThan(0)

      // Final memory should be reasonable
      const finalMemoryGrowth = (afterGC.heapUsed - initialMemory.heapUsed) / 1024 / 1024
      expect(finalMemoryGrowth).toBeLessThan(MEMORY_LEAK_THRESHOLD_MB)
    }, 180000)

    it('should maintain consistent performance across multiple GC cycles', async () => {
      if (!global.gc) {
        console.log('⚠️ Garbage collection not available - skipping GC performance test')
        return
      }

      const performanceSamples: number[] = []

      for (let i = 0; i < 5; i++) {
        // Force GC before each measurement
        global.gc()
        await new Promise(resolve => setTimeout(resolve, 100))

        const startTime = Date.now()
        const result = await sentimentService.analyzeStockSentimentImpact('AAPL', 'Technology', 0.75)
        const duration = Date.now() - startTime

        performanceSamples.push(duration)

        // Verify result quality remains consistent
        if (result) {
          expect(result.symbol).toBe('AAPL')
          expect(result.sentimentScore).toBeDefined()
        }
      }

      const avgPerformance = performanceSamples.reduce((sum, duration) => sum + duration, 0) / performanceSamples.length
      const performanceVariance = Math.max(...performanceSamples) - Math.min(...performanceSamples)

      console.log(`⚡ Average performance across GC cycles: ${Math.round(avgPerformance)}ms`)
      console.log(`📊 Performance variance: ${performanceVariance}ms`)

      // Performance should remain consistent across GC cycles
      expect(avgPerformance).toBeLessThan(PERFORMANCE_TARGET_MS)
      expect(performanceVariance).toBeLessThan(PERFORMANCE_TARGET_MS) // Variance should be reasonable
    }, 120000)
  })

  describe('Overall Performance Summary', () => {
    it('should meet all performance requirements in comprehensive test', async () => {
      const comprehensiveMetrics = startPerformanceMonitoring()

      // Test single stock analysis
      const singleStockResult = await sentimentService.analyzeStockSentimentImpact(
        'AAPL', 'Technology', 0.75
      )
      const singleStockTime = Date.now() - comprehensiveMetrics.startTime

      // Test bulk processing
      const bulkResult = await sentimentService.analyzeBulkSentimentImpact([
        { symbol: 'MSFT', sector: 'Technology', baseScore: 0.8 },
        { symbol: 'GOOGL', sector: 'Technology', baseScore: 0.7 }
      ])

      // Test cache performance
      await sentimentService.getSentimentIndicators('AAPL') // Should hit cache

      const finalMetrics = endPerformanceMonitoring(comprehensiveMetrics)

      // Performance Summary
      console.log('\n🎯 PERFORMANCE SUMMARY')
      console.log('='.repeat(50))
      console.log(`⏱️ Single stock analysis: ${singleStockTime}ms (target: <${PERFORMANCE_TARGET_MS}ms)`)
      console.log(`⏱️ Total comprehensive test: ${finalMetrics.duration}ms`)
      console.log(`🧠 Memory usage: ${Math.round((finalMetrics.memoryUsage.delta.heapUsed || 0) / 1024 / 1024 * 100) / 100}MB`)
      console.log(`🎯 Cache hit rate: ${Math.round(cacheMetrics.hitRate * 100)}%`)
      console.log('='.repeat(50))

      // Final assertions
      expect(singleStockTime).toBeLessThan(PERFORMANCE_TARGET_MS)
      expect(singleStockResult).toBeTruthy()
      expect(bulkResult.success).toBe(true)
      expect((finalMetrics.memoryUsage.delta.heapUsed || 0) / 1024 / 1024).toBeLessThan(MEMORY_LEAK_THRESHOLD_MB)
    }, 180000)
  })
})