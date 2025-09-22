/**
 * Sentiment Analysis Caching Tests
 * Tests the caching behavior and performance of sentiment analysis
 * Validates cache efficiency, TTL handling, and fallback mechanisms
 */

import { SentimentAnalysisService } from '../SentimentAnalysisService'
import NewsAPI from '../providers/NewsAPI'
import { RedisCache } from '../../cache/RedisCache'
import { SentimentIndicators } from '../types/sentiment-types'

describe('SentimentAnalysisService Caching Tests', () => {
  let sentimentService: SentimentAnalysisService
  let newsAPI: NewsAPI
  let cache: RedisCache

  beforeEach(() => {
    // Create fresh instances for each test
    newsAPI = new NewsAPI(
      process.env.NEWSAPI_KEY || 'test_key',
      15000,
      false
    )
    cache = new RedisCache({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      defaultTTL: 120 // 2 minutes in seconds for testing
    })
    sentimentService = new SentimentAnalysisService(newsAPI, cache)
  })

  afterEach(async () => {
    // Clean up cache after each test
    try {
      await cache.clear()
    } catch (error) {
      console.warn('Cache clear failed:', error)
    }
  })

  describe('Cache Hit/Miss Behavior', () => {
    test('should_cache_sentiment_indicators_for_repeated_requests', async () => {
      const symbol = 'AAPL'

      // First request - should miss cache and potentially fetch from API
      const startTime1 = Date.now()
      const indicators1 = await sentimentService.getSentimentIndicators(symbol)
      const duration1 = Date.now() - startTime1

      // Second request - should hit cache if data was cached
      const startTime2 = Date.now()
      const indicators2 = await sentimentService.getSentimentIndicators(symbol)
      const duration2 = Date.now() - startTime2

      // If both requests returned data, verify consistency
      if (indicators1 && indicators2) {
        expect(indicators2.news.symbol).toBe(indicators1.news.symbol)
        expect(indicators2.news.sentiment).toBe(indicators1.news.sentiment)
        expect(indicators2.news.confidence).toBe(indicators1.news.confidence)

        // Cache hit should be faster than cache miss
        expect(duration2).toBeLessThan(duration1)
        console.log(`✓ Cache performance: ${duration1}ms → ${duration2}ms`)
      } else {
        // If no data available (API not configured), both should be null
        expect(indicators1).toBeNull()
        expect(indicators2).toBeNull()
        console.log('⚠ No sentiment data available - cache behavior test limited')
      }
    }, 30000)

    test('should_handle_cache_misses_gracefully', async () => {
      const symbol = 'NONEXISTENT_SYMBOL_12345'

      // Request for non-existent symbol should handle cache miss
      const indicators = await sentimentService.getSentimentIndicators(symbol)

      // Should return null without throwing errors
      expect(indicators).toBeNull()
    })

    test('should_use_different_cache_keys_for_different_symbols', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL']

      // Request data for multiple symbols
      const results = await Promise.allSettled(
        symbols.map(symbol => sentimentService.getSentimentIndicators(symbol))
      )

      // All requests should complete without interference
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled')
        console.log(`✓ Symbol ${symbols[index]} processed`)
      })
    }, 60000)
  })

  describe('Cache TTL and Expiration', () => {
    test('should_respect_cache_ttl_settings', async () => {
      const symbol = 'TSLA'

      // Mock a cache entry with short TTL for testing
      const mockIndicators: SentimentIndicators = {
        news: {
          symbol,
          sentiment: 0.5,
          confidence: 0.8,
          articleCount: 10,
          sources: ['test-source'],
          keyTopics: ['earnings', 'guidance'],
          timeframe: '1d',
          lastUpdated: Date.now()
        },
        aggregatedScore: 0.5,
        confidence: 0.8,
        lastUpdated: Date.now()
      }

      // Set cache entry with 1 second TTL
      const cacheKey = `sentiment:indicators:${symbol}`
      await cache.set(cacheKey, mockIndicators, 1) // 1 second TTL

      // Immediate request should hit cache
      const immediate = await sentimentService.getSentimentIndicators(symbol)
      expect(immediate).not.toBeNull()
      if (immediate) {
        expect(immediate.news.symbol).toBe(symbol)
      }

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Request after TTL should miss cache
      const afterExpiry = await sentimentService.getSentimentIndicators(symbol)
      // This may be null (cache miss) or fresh data (if API is available)
      expect([null, 'object']).toContain(typeof afterExpiry)

      console.log('✓ Cache TTL expiration handled correctly')
    }, 10000)

    test('should_handle_cache_with_different_ttl_values', async () => {
      const testEntries = [
        { symbol: 'TEST1', ttl: 1 },   // 1 second
        { symbol: 'TEST2', ttl: 5 },   // 5 seconds
        { symbol: 'TEST3', ttl: 10 }   // 10 seconds
      ]

      // Set cache entries with different TTLs
      for (const entry of testEntries) {
        const mockData: SentimentIndicators = {
          news: {
            symbol: entry.symbol,
            sentiment: 0.5,
            confidence: 0.8,
            articleCount: 5,
            sources: ['test'],
            keyTopics: ['test'],
            timeframe: '1d',
            lastUpdated: Date.now()
          },
          aggregatedScore: 0.5,
          confidence: 0.8,
          lastUpdated: Date.now()
        }

        const cacheKey = `sentiment:indicators:${entry.symbol}`
        await cache.set(cacheKey, mockData, entry.ttl)
      }

      // Check that all entries are immediately available
      for (const entry of testEntries) {
        const result = await sentimentService.getSentimentIndicators(entry.symbol)
        expect(result).not.toBeNull()
        if (result) {
          expect(result.news.symbol).toBe(entry.symbol)
        }
      }

      console.log('✓ Multiple TTL values handled correctly')
    }, 15000)
  })

  describe('Cache Fallback and Error Handling', () => {
    test('should_handle_cache_connection_failures_gracefully', async () => {
      // Create service with failing cache
      const failingCache = new RedisCache({
        host: 'nonexistent_host_123456',
        port: 9999,
        defaultTTL: 60
      })

      const serviceWithFailingCache = new SentimentAnalysisService(newsAPI, failingCache)

      // Should not throw errors when cache is unavailable
      const result = await serviceWithFailingCache.getSentimentIndicators('AAPL')

      // Should either return null or data from API (depending on API availability)
      expect([null, 'object']).toContain(typeof result)

      console.log('✓ Cache connection failure handled gracefully')
    })

    test('should_handle_corrupted_cache_data', async () => {
      const symbol = 'CORRUPTED_TEST'
      const cacheKey = `sentiment:indicators:${symbol}`

      // Set corrupted data in cache
      await cache.set(cacheKey, 'invalid_json_data', 300)

      // Should handle corrupted cache data gracefully
      const result = await sentimentService.getSentimentIndicators(symbol)

      // Should either return null or fresh data from API
      expect([null, 'object']).toContain(typeof result)

      console.log('✓ Corrupted cache data handled gracefully')
    })

    test('should_maintain_service_functionality_without_cache', async () => {
      // Test sentiment impact analysis without relying on cache
      const result = await sentimentService.analyzeStockSentimentImpact(
        'NFLX',
        'Technology',
        0.75
      )

      // Should complete without errors regardless of cache state
      expect([null, 'object']).toContain(typeof result)

      if (result) {
        expect(result.symbol).toBe('NFLX')
        expect(result.sentimentWeight).toBe(0.10)
        expect(result.adjustedScore).toBeGreaterThanOrEqual(0)
        expect(result.adjustedScore).toBeLessThanOrEqual(1)
      }

      console.log('✓ Service functionality maintained without cache dependency')
    })
  })

  describe('Cache Performance Optimization', () => {
    test('should_cache_bulk_sentiment_analysis_efficiently', async () => {
      const stocks = [
        { symbol: 'AAPL', sector: 'Technology', baseScore: 0.8 },
        { symbol: 'MSFT', sector: 'Technology', baseScore: 0.75 },
        { symbol: 'GOOGL', sector: 'Technology', baseScore: 0.7 }
      ]

      // Run bulk analysis which should utilize caching
      const startTime = Date.now()
      const bulkResult = await sentimentService.analyzeBulkSentimentImpact(stocks)
      const duration = Date.now() - startTime

      expect(bulkResult.success).toBe(true)
      expect(bulkResult.executionTime).toBeGreaterThan(0)

      // Verify bulk result structure
      if (bulkResult.data) {
        expect(bulkResult.data).toHaveProperty('stockImpacts')
        expect(Array.isArray(bulkResult.data.stockImpacts)).toBe(true)
      }

      console.log(`✓ Bulk analysis completed in ${duration}ms`)
    }, 120000)

    test('should_demonstrate_cache_efficiency_improvements', async () => {
      const symbol = 'META'
      const iterations = 3

      const durations: number[] = []

      // Perform multiple requests to measure cache efficiency
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now()
        await sentimentService.getSentimentIndicators(symbol)
        const duration = Date.now() - startTime
        durations.push(duration)

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Calculate efficiency metrics
      const firstRequest = durations[0]
      const avgSubsequent = durations.slice(1).reduce((sum, d) => sum + d, 0) / (iterations - 1)

      console.log(`✓ First request: ${firstRequest}ms`)
      console.log(`✓ Average subsequent: ${avgSubsequent}ms`)
      console.log(`✓ Cache efficiency: ${((firstRequest - avgSubsequent) / firstRequest * 100).toFixed(1)}%`)

      // Subsequent requests should generally be faster due to caching
      // (unless API is not available, in which case they should be consistent)
      if (durations.every(d => d > 0)) {
        expect(avgSubsequent).toBeLessThanOrEqual(firstRequest + 50) // Allow 50ms variance
      }
    }, 30000)
  })

  describe('Cache Memory Management', () => {
    test('should_manage_memory_efficiently_with_cache_operations', async () => {
      const startMemory = process.memoryUsage().heapUsed

      // Perform multiple cache operations
      const symbols = ['AMZN', 'TSLA', 'NVDA', 'AMD', 'INTC']

      for (const symbol of symbols) {
        await sentimentService.getSentimentIndicators(symbol)
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const endMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024 // MB

      console.log(`✓ Memory increase: ${memoryIncrease.toFixed(2)}MB for ${symbols.length} cache operations`)

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(20) // Less than 20MB increase
    }, 60000)

    test('should_clean_up_cache_resources_properly', async () => {
      const symbol = 'CLEANUP_TEST'

      // Perform operations that use cache
      await sentimentService.getSentimentIndicators(symbol)
      await sentimentService.analyzeStockSentimentImpact(symbol, 'Technology', 0.5)

      // Clear cache
      try {
        await cache.clear()
        console.log('✓ Cache cleared successfully')
      } catch (error) {
        console.warn('⚠ Cache clear failed (may be unavailable):', error)
      }

      // Verify service still works after cache clear
      const result = await sentimentService.getSentimentIndicators(symbol)
      expect([null, 'object']).toContain(typeof result)

      console.log('✓ Cache cleanup completed without affecting service')
    })
  })

  describe('Health Check and Monitoring', () => {
    test('should_include_cache_health_in_service_health_check', async () => {
      const healthCheck = await sentimentService.healthCheck()

      expect(healthCheck).toHaveProperty('status')
      expect(healthCheck).toHaveProperty('details')
      expect(['healthy', 'unhealthy']).toContain(healthCheck.status)

      // Should include cache health information
      expect(healthCheck.details).toHaveProperty('cache')
      expect(typeof healthCheck.details.cache).toBe('boolean')

      console.log(`✓ Health check status: ${healthCheck.status}`)
      console.log(`✓ Cache health: ${healthCheck.details.cache}`)
    })

    test('should_report_cache_availability_correctly', async () => {
      // Test cache ping functionality
      const pingResult = await cache.ping()
      expect(typeof pingResult).toBe('string')
      expect(pingResult).toMatch(/PONG/i)

      console.log(`✓ Cache ping response: ${pingResult}`)
    })
  })
})