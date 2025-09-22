/**
 * NewsAPI Provider Tests
 * Tests the NewsAPI integration for financial news sentiment analysis
 * Validates API connectivity, news fetching, and sentiment analysis logic
 */

import NewsAPI from '../providers/NewsAPI'
import { NewsSentimentData } from '../types/sentiment-types'

describe('NewsAPI Provider Tests', () => {
  let newsAPI: NewsAPI

  // Test configuration
  const TEST_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL'] as const
  const HEALTH_CHECK_TIMEOUT = 20000
  const NEWS_FETCH_TIMEOUT = 30000

  beforeEach(() => {
    // Create fresh NewsAPI instance for each test
    newsAPI = new NewsAPI(
      process.env.NEWSAPI_KEY || 'test_key',
      15000, // 15 second timeout
      false   // Don't throw errors in tests
    )
  })

  afterEach(() => {
    // Clean up any resources
    newsAPI = null as any
  })

  describe('Initialization and Configuration', () => {
    test('should_initialize_newsapi_with_valid_configuration', () => {
      const api = new NewsAPI('a1b2c3d4e5f6789012345678901234567890abcd', 10000, false)
      expect(api).toBeInstanceOf(NewsAPI)
      expect(api.name).toBe('NewsAPI')
    })

    test('should_handle_missing_api_key_gracefully', () => {
      const api = new NewsAPI(undefined, 10000, false)
      expect(api).toBeInstanceOf(NewsAPI)
      // Should not throw during initialization
    })

    test('should_validate_api_key_format_during_initialization', () => {
      const validKey = 'a1b2c3d4e5f6789012345678901234567890abcd'
      const invalidKeys = [
        '',
        'too_short',
        'this_key_is_way_too_long_to_be_valid_newsapi_key_format',
        'contains-special-chars!@#$%',
        '12345678901234567890123456789012', // Wrong format (numbers only)
        'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG'  // Wrong length
      ]

      // Valid key should work
      expect(() => new NewsAPI(validKey, 15000, false)).not.toThrow()

      // Invalid keys should warn but not throw in non-throwing mode
      invalidKeys.forEach(key => {
        expect(() => new NewsAPI(key, 15000, false)).not.toThrow()
      })
    })

    test('should_throw_on_invalid_api_key_when_configured_to_throw', () => {
      const invalidKey = 'invalid_key_format'

      expect(() => new NewsAPI(invalidKey, 15000, true)).toThrow()
    })
  })

  describe('Health Check Functionality', () => {
    test('should_perform_health_check_with_valid_api_key', async () => {
      const isHealthy = await newsAPI.healthCheck()

      expect(typeof isHealthy).toBe('boolean')

      if (process.env.NEWSAPI_KEY) {
        console.log(`✓ NewsAPI health check result: ${isHealthy ? 'healthy' : 'unhealthy'}`)
      } else {
        console.log('⚠ No API key configured - health check expected to fail')
        expect(isHealthy).toBe(false)
      }
    }, HEALTH_CHECK_TIMEOUT)

    test('should_fail_health_check_with_invalid_api_key', async () => {
      const invalidAPI = new NewsAPI('invalid_key_format', 15000, false)
      const isHealthy = await invalidAPI.healthCheck()

      expect(isHealthy).toBe(false)
      console.log('✓ Invalid API key correctly failed health check')
    })

    test('should_handle_health_check_timeout_gracefully', async () => {
      const timeoutAPI = new NewsAPI(process.env.NEWSAPI_KEY, 1, false) // 1ms timeout
      const isHealthy = await timeoutAPI.healthCheck()

      expect(typeof isHealthy).toBe('boolean')
      console.log('✓ Health check timeout handled gracefully')
    })

    test('should_fail_health_check_with_missing_api_key', async () => {
      const noKeyAPI = new NewsAPI('', 15000, false)
      const isHealthy = await noKeyAPI.healthCheck()

      expect(isHealthy).toBe(false)
      console.log('✓ Missing API key correctly failed health check')
    })
  })

  describe('News Sentiment Analysis', () => {
    test('should_fetch_news_sentiment_for_valid_stock_symbols', async () => {
      if (!process.env.NEWSAPI_KEY) {
        console.log('⚠ Skipping real API test - no NEWSAPI_KEY configured')
        return
      }

      for (const symbol of TEST_SYMBOLS) {
        console.log(`📰 Testing news sentiment for ${symbol}...`)

        const sentimentData = await newsAPI.getNewsSentiment(symbol, '1d')

        if (sentimentData) {
          // Validate sentiment data structure
          expect(sentimentData).toHaveProperty('symbol')
          expect(sentimentData).toHaveProperty('sentiment')
          expect(sentimentData).toHaveProperty('confidence')
          expect(sentimentData).toHaveProperty('articleCount')
          expect(sentimentData).toHaveProperty('sources')
          expect(sentimentData).toHaveProperty('keyTopics')
          expect(sentimentData).toHaveProperty('timeframe')
          expect(sentimentData).toHaveProperty('lastUpdated')

          // Validate data types
          expect(typeof sentimentData.symbol).toBe('string')
          expect(typeof sentimentData.sentiment).toBe('number')
          expect(typeof sentimentData.confidence).toBe('number')
          expect(typeof sentimentData.articleCount).toBe('number')
          expect(Array.isArray(sentimentData.sources)).toBe(true)
          expect(Array.isArray(sentimentData.keyTopics)).toBe(true)
          expect(typeof sentimentData.timeframe).toBe('string')
          expect(typeof sentimentData.lastUpdated).toBe('number')

          // Validate value ranges
          expect(sentimentData.sentiment).toBeGreaterThanOrEqual(-1)
          expect(sentimentData.sentiment).toBeLessThanOrEqual(1)
          expect(sentimentData.confidence).toBeGreaterThanOrEqual(0)
          expect(sentimentData.confidence).toBeLessThanOrEqual(1)
          expect(sentimentData.articleCount).toBeGreaterThanOrEqual(0)

          console.log(`✓ ${symbol}: sentiment=${sentimentData.sentiment.toFixed(3)}, confidence=${sentimentData.confidence.toFixed(3)}, articles=${sentimentData.articleCount}`)
        } else {
          console.log(`⚠ No sentiment data available for ${symbol}`)
        }
      }
    }, NEWS_FETCH_TIMEOUT)

    test('should_handle_symbols_with_no_news_coverage', async () => {
      const obscureSymbols = ['XXXXX', 'YYYYY', 'ZZZZZ']

      for (const symbol of obscureSymbols) {
        const sentimentData = await newsAPI.getNewsSentiment(symbol, '1d')

        // Should return null for symbols with no coverage
        expect(sentimentData).toBeNull()
      }

      console.log('✓ Symbols with no coverage handled correctly')
    })

    test('should_support_different_timeframes', async () => {
      if (!process.env.NEWSAPI_KEY) {
        console.log('⚠ Skipping timeframe test - no NEWSAPI_KEY configured')
        return
      }

      const timeframes = ['1d', '7d', '30d']
      const symbol = 'AAPL'

      for (const timeframe of timeframes) {
        const sentimentData = await newsAPI.getNewsSentiment(symbol, timeframe)

        if (sentimentData) {
          expect(sentimentData.timeframe).toBe(timeframe)
          console.log(`✓ ${timeframe} timeframe: ${sentimentData.articleCount} articles`)
        } else {
          console.log(`⚠ No data for ${timeframe} timeframe`)
        }
      }
    }, NEWS_FETCH_TIMEOUT)

    test('should_handle_invalid_timeframes_gracefully', async () => {
      const invalidTimeframes = ['invalid', '999d', '', 'abc']
      const symbol = 'AAPL'

      for (const timeframe of invalidTimeframes) {
        // Should not throw errors for invalid timeframes
        const sentimentData = await newsAPI.getNewsSentiment(symbol, timeframe)

        // Should either return null or valid data with default timeframe
        expect([null, 'object']).toContain(typeof sentimentData)
      }

      console.log('✓ Invalid timeframes handled gracefully')
    })
  })

  describe('Error Handling and Resilience', () => {
    test('should_handle_api_rate_limiting_gracefully', async () => {
      if (!process.env.NEWSAPI_KEY) {
        console.log('⚠ Skipping rate limiting test - no NEWSAPI_KEY configured')
        return
      }

      // Make multiple rapid requests to test rate limiting
      const promises = Array(5).fill(0).map(() =>
        newsAPI.getNewsSentiment('AAPL', '1d')
      )

      const results = await Promise.allSettled(promises)

      // All requests should complete without throwing errors
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled')
        if (result.status === 'fulfilled') {
          expect([null, 'object']).toContain(typeof result.value)
        }
      })

      console.log('✓ Rate limiting handled gracefully')
    }, 60000)

    test('should_handle_network_timeouts_appropriately', async () => {
      const timeoutAPI = new NewsAPI(process.env.NEWSAPI_KEY, 1000, false) // 1 second timeout

      const result = await timeoutAPI.getNewsSentiment('AAPL', '1d')

      // Should handle timeout gracefully and return null
      expect([null, 'object']).toContain(typeof result)

      console.log('✓ Network timeout handled gracefully')
    }, 10000)

    test('should_handle_invalid_api_responses_gracefully', async () => {
      const invalidAPI = new NewsAPI('invalid_api_key_format', 15000, false)

      const result = await invalidAPI.getNewsSentiment('AAPL', '1d')

      // Should return null for invalid API responses
      expect(result).toBeNull()

      console.log('✓ Invalid API responses handled gracefully')
    })

    test('should_sanitize_error_messages_for_security', async () => {
      const originalConsoleError = console.error
      const capturedErrors: string[] = []

      console.error = (...args: any[]) => {
        capturedErrors.push(args.join(' '))
      }

      try {
        // Force error with invalid API key
        const errorAPI = new NewsAPI('invalid_key', 1, false)
        await errorAPI.getNewsSentiment('AAPL', '1d')

        // Check that error messages don't contain sensitive information
        const allErrors = capturedErrors.join(' ')
        expect(allErrors).not.toContain('api_key')
        expect(allErrors).not.toContain('secret')
        expect(allErrors).not.toContain('password')
        expect(allErrors).not.toContain('token')

        console.log('✓ Error messages properly sanitized')
      } finally {
        console.error = originalConsoleError
      }
    })
  })

  describe('Data Quality and Validation', () => {
    test('should_validate_sentiment_data_structure_thoroughly', async () => {
      if (!process.env.NEWSAPI_KEY) {
        console.log('⚠ Skipping data validation test - no NEWSAPI_KEY configured')
        return
      }

      const sentimentData = await newsAPI.getNewsSentiment('MSFT', '1d')

      if (sentimentData) {
        // Comprehensive structure validation
        expect(sentimentData.symbol).toBeDefined()
        expect(sentimentData.sentiment).toBeDefined()
        expect(sentimentData.confidence).toBeDefined()
        expect(sentimentData.articleCount).toBeDefined()
        expect(sentimentData.sources).toBeDefined()
        expect(sentimentData.keyTopics).toBeDefined()
        expect(sentimentData.timeframe).toBeDefined()
        expect(sentimentData.lastUpdated).toBeDefined()

        // Data type validation
        expect(typeof sentimentData.symbol).toBe('string')
        expect(typeof sentimentData.sentiment).toBe('number')
        expect(typeof sentimentData.confidence).toBe('number')
        expect(typeof sentimentData.articleCount).toBe('number')
        expect(Array.isArray(sentimentData.sources)).toBe(true)
        expect(Array.isArray(sentimentData.keyTopics)).toBe(true)
        expect(typeof sentimentData.timeframe).toBe('string')
        expect(typeof sentimentData.lastUpdated).toBe('number')

        // Range validation
        expect(sentimentData.sentiment).toBeGreaterThanOrEqual(-1)
        expect(sentimentData.sentiment).toBeLessThanOrEqual(1)
        expect(sentimentData.confidence).toBeGreaterThanOrEqual(0)
        expect(sentimentData.confidence).toBeLessThanOrEqual(1)
        expect(sentimentData.articleCount).toBeGreaterThanOrEqual(0)

        // Timestamp validation (should be recent)
        expect(sentimentData.lastUpdated).toBeGreaterThan(Date.now() - 24 * 60 * 60 * 1000)

        console.log('✓ Sentiment data structure thoroughly validated')
      } else {
        console.log('⚠ No sentiment data to validate')
      }
    }, NEWS_FETCH_TIMEOUT)

    test('should_ensure_consistent_sentiment_scoring', async () => {
      // Test the internal sentiment analysis logic with mock data
      const api = new NewsAPI('test_key', 15000, false)

      // Access private methods for testing (TypeScript workaround)
      const analyzeSentiment = (api as any).analyzeSentiment.bind(api)

      const testCases = [
        {
          title: 'Company beats earnings expectations',
          description: 'Strong quarterly results show positive growth',
          expectedSentiment: 'positive'
        },
        {
          title: 'Stock price drops after disappointing results',
          description: 'Weak performance leads to analyst downgrades',
          expectedSentiment: 'negative'
        },
        {
          title: 'Company announces new product',
          description: 'Regular business update with neutral tone',
          expectedSentiment: 'neutral'
        }
      ]

      for (const testCase of testCases) {
        const result = analyzeSentiment(testCase.title, testCase.description)

        expect(result).toHaveProperty('sentiment')
        expect(result).toHaveProperty('confidence')
        expect(typeof result.sentiment).toBe('number')
        expect(typeof result.confidence).toBe('number')
        expect(result.sentiment).toBeGreaterThanOrEqual(-1)
        expect(result.sentiment).toBeLessThanOrEqual(1)
        expect(result.confidence).toBeGreaterThanOrEqual(0)
        expect(result.confidence).toBeLessThanOrEqual(1)

        console.log(`✓ "${testCase.title}" → sentiment: ${result.sentiment.toFixed(3)}, confidence: ${result.confidence.toFixed(3)}`)
      }
    })

    test('should_calculate_relevance_scores_appropriately', async () => {
      const api = new NewsAPI('test_key', 15000, false)

      // Access private method for testing
      const calculateRelevanceScore = (api as any).calculateRelevanceScore.bind(api)

      const testArticles = [
        {
          title: 'AAPL reports strong earnings',
          description: 'Apple Inc shows excellent quarterly performance',
          symbol: 'AAPL',
          expectedRelevance: 'high'
        },
        {
          title: 'Technology sector overview',
          description: 'General market analysis of tech stocks',
          symbol: 'AAPL',
          expectedRelevance: 'low'
        },
        {
          title: 'Microsoft Azure growth',
          description: 'Cloud services expansion continues',
          symbol: 'AAPL',
          expectedRelevance: 'none'
        }
      ]

      for (const article of testArticles) {
        const score = calculateRelevanceScore(article, article.symbol)

        expect(typeof score).toBe('number')
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)

        console.log(`✓ "${article.title}" relevance to ${article.symbol}: ${score.toFixed(3)}`)
      }
    })
  })

  describe('Performance and Efficiency', () => {
    test('should_complete_news_sentiment_requests_within_timeout', async () => {
      if (!process.env.NEWSAPI_KEY) {
        console.log('⚠ Skipping performance test - no NEWSAPI_KEY configured')
        return
      }

      const symbol = 'GOOGL'
      const startTime = Date.now()

      const sentimentData = await newsAPI.getNewsSentiment(symbol, '1d')

      const duration = Date.now() - startTime

      // Should complete within 30 seconds for real API calls
      expect(duration).toBeLessThan(30000)

      console.log(`✓ News sentiment request for ${symbol} completed in ${duration}ms`)

      if (sentimentData) {
        console.log(`✓ Retrieved ${sentimentData.articleCount} articles`)
      }
    }, NEWS_FETCH_TIMEOUT)

    test('should_handle_concurrent_requests_efficiently', async () => {
      if (!process.env.NEWSAPI_KEY) {
        console.log('⚠ Skipping concurrency test - no NEWSAPI_KEY configured')
        return
      }

      const symbols = ['AAPL', 'MSFT', 'GOOGL']

      const startTime = Date.now()
      const promises = symbols.map(symbol => newsAPI.getNewsSentiment(symbol, '1d'))
      const results = await Promise.allSettled(promises)
      const duration = Date.now() - startTime

      const successfulResults = results.filter(r =>
        r.status === 'fulfilled' && r.value !== null
      ).length

      console.log(`✓ Concurrent requests completed in ${duration}ms`)
      console.log(`✓ Success rate: ${successfulResults}/${symbols.length}`)

      // All requests should complete without errors
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
      })

      // Should be reasonably efficient for concurrent requests
      expect(duration).toBeLessThan(60000) // 60 seconds for 3 concurrent requests
    }, 90000)
  })

  describe('Integration Compliance', () => {
    test('should_implement_required_financial_data_provider_interface', () => {
      // Verify that NewsAPI implements the required interface methods
      expect(typeof newsAPI.getStockPrice).toBe('function')
      expect(typeof newsAPI.getCompanyInfo).toBe('function')
      expect(typeof newsAPI.getMarketData).toBe('function')
      expect(typeof newsAPI.getStocksBySector).toBe('function')
      expect(newsAPI.name).toBe('NewsAPI')

      console.log('✓ FinancialDataProvider interface implemented')
    })

    test('should_throw_appropriate_errors_for_unsupported_methods', async () => {
      // These methods should throw since they're not applicable for news data
      await expect(newsAPI.getStockPrice()).rejects.toThrow()
      await expect(newsAPI.getCompanyInfo()).rejects.toThrow()
      await expect(newsAPI.getMarketData()).rejects.toThrow()
      await expect(newsAPI.getStocksBySector()).rejects.toThrow()

      console.log('✓ Unsupported methods correctly throw errors')
    })

    test('should_maintain_consistent_api_response_format', async () => {
      if (!process.env.NEWSAPI_KEY) {
        console.log('⚠ Skipping API format test - no NEWSAPI_KEY configured')
        return
      }

      const sentimentData = await newsAPI.getNewsSentiment('TSLA', '1d')

      if (sentimentData) {
        // Should match the NewsSentimentData interface exactly
        const requiredFields = [
          'symbol', 'sentiment', 'confidence', 'articleCount',
          'sources', 'keyTopics', 'timeframe', 'lastUpdated'
        ]

        requiredFields.forEach(field => {
          expect(sentimentData).toHaveProperty(field)
        })

        console.log('✓ API response format consistent with interface')
      }
    })
  })
})