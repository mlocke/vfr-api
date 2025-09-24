/**
 * Yahoo Finance Sentiment API Performance Tests
 * Validates <1.5s response time target and optimizations
 *
 * Performance Requirements:
 * - Single sentiment analysis: <1.5s (improved from <500ms NewsAPI target)
 * - Batch processing: <2.5s for 10 symbols
 * - Cache hit rate: >90% after warmup
 * - Memory efficiency: LRU eviction prevents bloat
 * - API call consolidation: Batch processing
 */

import { YahooFinanceSentimentAPI } from '../providers/YahooFinanceSentimentAPI'
import { NewsSentimentData } from '../types/sentiment-types'

const PERFORMANCE_TARGET_MS = 1500 // 1.5s target
const BATCH_TARGET_MS = 2500 // 2.5s for batch processing
const CACHE_HIT_TARGET = 0.9 // 90% cache hit rate
const MEMORY_LIMIT_MB = 50 // Memory usage limit

// Test symbols - mix of high volume and regular stocks
const TEST_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']

interface PerformanceMetrics {
  responseTime: number
  memoryBefore: NodeJS.MemoryUsage
  memoryAfter: NodeJS.MemoryUsage
  memoryDelta: number
}

describe('Yahoo Finance Sentiment API Performance Tests', () => {
  let sentimentAPI: YahooFinanceSentimentAPI
  let initialMemory: NodeJS.MemoryUsage

  beforeAll(async () => {
    // Force garbage collection before tests
    if (global.gc) {
      global.gc()
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    initialMemory = process.memoryUsage()
    sentimentAPI = new YahooFinanceSentimentAPI()

    console.log('🚀 Yahoo Finance Sentiment Performance Testing')
    console.log(`📊 Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`)
  })

  afterAll(async () => {
    // Cleanup and memory verification
    sentimentAPI.cleanup()

    if (global.gc) {
      global.gc()
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    const finalMemory = process.memoryUsage()
    const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024

    console.log('🧹 Performance test cleanup')
    console.log(`📊 Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`)
    console.log(`📈 Memory growth: ${Math.round(memoryGrowth * 100) / 100}MB`)

    expect(memoryGrowth).toBeLessThan(MEMORY_LIMIT_MB)
  })

  function measurePerformance(fn: () => Promise<any>): Promise<PerformanceMetrics> {
    return new Promise(async (resolve) => {
      const memoryBefore = process.memoryUsage()
      const startTime = Date.now()

      await fn()

      const responseTime = Date.now() - startTime
      const memoryAfter = process.memoryUsage()
      const memoryDelta = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024

      resolve({
        responseTime,
        memoryBefore,
        memoryAfter,
        memoryDelta
      })
    })
  }

  describe('Single Symbol Performance', () => {
    it('should complete sentiment analysis within 1.5s target', async () => {
      const symbol = 'AAPL'

      const metrics = await measurePerformance(async () => {
        const result = await sentimentAPI.getNewsSentiment(symbol)
        expect(result).toBeDefined()
        if (result) {
          expect(result.symbol).toBe(symbol.toUpperCase())
          expect(result.sentiment).toBeGreaterThanOrEqual(-1)
          expect(result.sentiment).toBeLessThanOrEqual(1)
          expect(result.confidence).toBeGreaterThanOrEqual(0)
          expect(result.confidence).toBeLessThanOrEqual(1)
        }
      })

      console.log(`⏱️ Single symbol (${symbol}): ${metrics.responseTime}ms`)
      console.log(`💾 Memory usage: ${Math.round(metrics.memoryDelta * 100) / 100}MB`)

      expect(metrics.responseTime).toBeLessThan(PERFORMANCE_TARGET_MS)
      expect(metrics.memoryDelta).toBeLessThan(20) // Max 20MB per operation
    }, 30000)

    it('should maintain performance consistency across different symbols', async () => {
      const results: Array<{symbol: string, responseTime: number, success: boolean}> = []

      // Test each symbol with delay to respect rate limits
      for (let i = 0; i < Math.min(TEST_SYMBOLS.length, 3); i++) {
        const symbol = TEST_SYMBOLS[i]

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // 1s delay
        }

        const metrics = await measurePerformance(async () => {
          const result = await sentimentAPI.getNewsSentiment(symbol)
          return result
        })

        const result = await sentimentAPI.getNewsSentiment(symbol)
        results.push({
          symbol,
          responseTime: metrics.responseTime,
          success: result !== null
        })
      }

      const successfulResults = results.filter(r => r.success)
      const avgResponseTime = successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / Math.max(successfulResults.length, 1)

      console.log(`📊 Average response time: ${Math.round(avgResponseTime)}ms`)
      console.log(`✅ Success rate: ${Math.round((successfulResults.length / results.length) * 100)}%`)

      expect(avgResponseTime).toBeLessThan(PERFORMANCE_TARGET_MS * 1.2) // Allow 20% variance
      expect(successfulResults.length / results.length).toBeGreaterThan(0.5) // 50% minimum success
    }, 45000)
  })

  describe('Batch Processing Performance', () => {
    it('should efficiently process multiple symbols via batching', async () => {
      const batchSymbols = TEST_SYMBOLS.slice(0, 3) // Limit to 3 for testing

      const metrics = await measurePerformance(async () => {
        // Make concurrent requests to trigger batching
        const promises = batchSymbols.map(symbol =>
          sentimentAPI.getNewsSentiment(symbol)
        )

        const results = await Promise.allSettled(promises)
        const successful = results.filter(r =>
          r.status === 'fulfilled' && r.value !== null
        )

        expect(successful.length).toBeGreaterThan(0)
      })

      const avgTimePerSymbol = metrics.responseTime / batchSymbols.length

      console.log(`⚡ Batch processing: ${metrics.responseTime}ms for ${batchSymbols.length} symbols`)
      console.log(`⏱️ Average per symbol: ${Math.round(avgTimePerSymbol)}ms`)
      console.log(`💾 Memory usage: ${Math.round(metrics.memoryDelta * 100) / 100}MB`)

      expect(metrics.responseTime).toBeLessThan(BATCH_TARGET_MS)
      expect(avgTimePerSymbol).toBeLessThan(PERFORMANCE_TARGET_MS)
      expect(metrics.memoryDelta).toBeLessThan(25) // Reasonable memory for batch
    }, 45000)
  })

  describe('Caching Performance', () => {
    it('should achieve high cache hit rate after warmup', async () => {
      const symbol = 'MSFT'

      // Warmup cache
      await sentimentAPI.getNewsSentiment(symbol)
      await new Promise(resolve => setTimeout(resolve, 100)) // Let cache settle

      const initialStats = sentimentAPI.getPerformanceStats()

      // Make multiple requests to test caching
      const cacheTestPromises = Array(5).fill(null).map(() =>
        sentimentAPI.getNewsSentiment(symbol)
      )

      const cacheMetrics = await measurePerformance(async () => {
        await Promise.all(cacheTestPromises)
      })

      const finalStats = sentimentAPI.getPerformanceStats()
      const testHits = finalStats.cacheHits - initialStats.cacheHits
      const testRequests = finalStats.requests - initialStats.requests
      const hitRate = testHits / testRequests

      console.log(`🎯 Cache hit rate: ${Math.round(hitRate * 100)}%`)
      console.log(`⚡ Cache response time: ${Math.round(cacheMetrics.responseTime / cacheTestPromises.length)}ms avg`)
      console.log(`📊 Cache size: ${finalStats.cacheSize}`)

      expect(hitRate).toBeGreaterThan(CACHE_HIT_TARGET)
      expect(cacheMetrics.responseTime / cacheTestPromises.length).toBeLessThan(50) // Cache should be fast
    }, 30000)

    it('should prevent memory bloat with LRU eviction', async () => {
      const largeBatch = Array.from({length: 15}, (_, i) => `TEST${i}`)

      const metrics = await measurePerformance(async () => {
        // Fill cache beyond capacity
        const promises = largeBatch.map(symbol =>
          sentimentAPI.getNewsSentiment(symbol).catch(() => null)
        )

        await Promise.allSettled(promises)

        // Force cache optimization
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      const stats = sentimentAPI.getPerformanceStats()

      console.log(`🧠 Memory after large batch: ${Math.round(metrics.memoryDelta * 100) / 100}MB`)
      console.log(`📊 Final cache size: ${stats.cacheSize}`)

      // Cache should not grow unbounded
      expect(stats.cacheSize).toBeLessThan(20) // Should evict old entries
      expect(metrics.memoryDelta).toBeLessThan(30) // Memory should be controlled
    }, 60000)
  })

  describe('Memory Efficiency', () => {
    it('should efficiently manage memory during sustained operations', async () => {
      const iterations = 5
      const memorySnapshots: number[] = []

      for (let i = 0; i < iterations; i++) {
        await sentimentAPI.getNewsSentiment(TEST_SYMBOLS[i % TEST_SYMBOLS.length])

        if (global.gc) {
          global.gc()
          await new Promise(resolve => setTimeout(resolve, 50))
        }

        const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024
        memorySnapshots.push(currentMemory)
      }

      const initialMemoryMB = memorySnapshots[0]
      const finalMemoryMB = memorySnapshots[memorySnapshots.length - 1]
      const memoryGrowth = finalMemoryMB - initialMemoryMB

      console.log(`🔄 Memory across ${iterations} operations:`)
      console.log(`📊 Initial: ${Math.round(initialMemoryMB)}MB`)
      console.log(`📊 Final: ${Math.round(finalMemoryMB)}MB`)
      console.log(`📈 Growth: ${Math.round(memoryGrowth * 100) / 100}MB`)

      expect(memoryGrowth).toBeLessThan(15) // Should not leak significantly
    }, 45000)
  })

  describe('Error Handling Performance', () => {
    it('should handle invalid symbols efficiently', async () => {
      const invalidSymbols = ['INVALID123', 'FAKE456', 'NONEXISTENT789']

      const metrics = await measurePerformance(async () => {
        const promises = invalidSymbols.map(symbol =>
          sentimentAPI.getNewsSentiment(symbol)
        )

        const results = await Promise.allSettled(promises)
        // Should handle errors gracefully
        expect(results.every(r => r.status === 'fulfilled')).toBe(true)
      })

      console.log(`🚨 Error handling: ${metrics.responseTime}ms for ${invalidSymbols.length} invalid symbols`)
      console.log(`💾 Memory usage: ${Math.round(metrics.memoryDelta * 100) / 100}MB`)

      expect(metrics.responseTime).toBeLessThan(PERFORMANCE_TARGET_MS * 2)
      expect(metrics.memoryDelta).toBeLessThan(10) // Should not allocate much for errors
    }, 30000)
  })

  describe('Overall Performance Summary', () => {
    it('should meet all performance targets in comprehensive test', async () => {
      const comprehensiveMetrics = await measurePerformance(async () => {
        // Test single symbol
        const single = await sentimentAPI.getNewsSentiment('AAPL')

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Test caching (should hit cache)
        const cached = await sentimentAPI.getNewsSentiment('AAPL')

        // Test batch processing
        const batch = await Promise.allSettled([
          sentimentAPI.getNewsSentiment('MSFT'),
          sentimentAPI.getNewsSentiment('GOOGL')
        ])

        return { single, cached, batch }
      })

      const stats = sentimentAPI.getPerformanceStats()

      console.log('\n🎯 YAHOO FINANCE SENTIMENT PERFORMANCE SUMMARY')
      console.log('='.repeat(60))
      console.log(`⏱️ Total comprehensive test: ${comprehensiveMetrics.responseTime}ms`)
      console.log(`🧠 Memory usage: ${Math.round(comprehensiveMetrics.memoryDelta * 100) / 100}MB`)
      console.log(`🎯 Cache hit rate: ${Math.round(stats.hitRate * 100)}%`)
      console.log(`📊 Average response time: ${Math.round(stats.avgResponseTime)}ms`)
      console.log(`⚡ Average batch size: ${Math.round(stats.avgBatchSize * 100) / 100}`)
      console.log(`📊 Cache size: ${stats.cacheSize}`)
      console.log(`🔄 Total requests: ${stats.requests}`)
      console.log('='.repeat(60))

      // Performance assertions
      expect(stats.avgResponseTime).toBeLessThan(PERFORMANCE_TARGET_MS)
      expect(comprehensiveMetrics.memoryDelta).toBeLessThan(MEMORY_LIMIT_MB)
      expect(stats.requests).toBeGreaterThan(0)

      // Should have some successful operations
      expect(stats.cacheHits + stats.batchRequests).toBeGreaterThan(0)
    }, 90000)
  })
})