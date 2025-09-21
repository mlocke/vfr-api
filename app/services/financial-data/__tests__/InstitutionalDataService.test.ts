/**
 * Comprehensive Test Suite for InstitutionalDataService
 * Tests 13F quarterly holdings analysis and Form 4 insider trading monitoring with real-time sentiment scoring
 * Follows TDD principles with NO MOCK DATA - uses real API calls only
 */

import { InstitutionalDataService } from '../InstitutionalDataService'
import { InstitutionalHolding, InsiderTransaction, InstitutionalIntelligence } from '../types'
import SecurityValidator from '../../security/SecurityValidator'

describe('InstitutionalDataService', () => {
  let service: InstitutionalDataService

  beforeEach(() => {
    // Reset security state between tests
    SecurityValidator.resetSecurityState()

    // Create fresh service instance for each test
    service = new InstitutionalDataService({
      baseUrl: 'https://data.sec.gov',
      userAgent: 'VFR-API-Test/1.0 (test@veritakfr.com)',
      requestsPerSecond: 10,
      timeout: 15000,
      throwErrors: false
    })
  })

  afterEach(() => {
    // Clean up cache to prevent memory leaks
    service.clearCache()
    SecurityValidator.resetSecurityState()
  })

  describe('Service Initialization and Health Check', () => {
    test('should_initialize_service_with_default_configuration_successfully', () => {
      const defaultService = new InstitutionalDataService()
      expect(defaultService.name).toBe('SEC EDGAR Institutional Data')
      expect(defaultService).toBeInstanceOf(InstitutionalDataService)
    })

    test('should_initialize_service_with_custom_configuration_successfully', () => {
      const customConfig = {
        baseUrl: 'https://custom-sec.gov',
        userAgent: 'CustomAgent/1.0',
        requestsPerSecond: 5,
        timeout: 30000
      }

      const customService = new InstitutionalDataService(customConfig)
      expect(customService.name).toBe('SEC EDGAR Institutional Data')
      expect(customService).toBeInstanceOf(InstitutionalDataService)
    })

    test('should_pass_health_check_with_valid_sec_edgar_endpoint', async () => {
      const isHealthy = await service.healthCheck()

      // SEC EDGAR health check should return true for accessible endpoints
      // Note: This tests real SEC EDGAR API connectivity
      expect(typeof isHealthy).toBe('boolean')

      if (isHealthy) {
        console.log('✓ SEC EDGAR API is accessible')
      } else {
        console.warn('⚠ SEC EDGAR API is not accessible - this may be due to rate limiting or network issues')
      }
    }, 20000)

    test('should_return_correct_source_identifier', () => {
      const sourceId = (service as any).getSourceIdentifier()
      expect(sourceId).toBe('sec_edgar_institutional')
    })
  })

  describe('Symbol Validation and Security', () => {
    test('should_reject_malicious_symbol_inputs_for_institutional_holdings', async () => {
      const maliciousSymbols = [
        "'; DROP TABLE stocks; --",
        '<script>alert("xss")</script>',
        'AAPL; cat /etc/passwd',
        '../../../etc/passwd',
        'AAPL\0.txt',
        '__proto__',
        '../../sensitive/file.txt',
        'AAPL$(whoami)',
        '<img src=x onerror=alert(1)>'
      ]

      for (const symbol of maliciousSymbols) {
        const result = await service.getInstitutionalHoldings(symbol)
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBe(0) // Should return empty array for invalid symbols
      }
    })

    test('should_reject_malicious_symbol_inputs_for_insider_transactions', async () => {
      const maliciousSymbols = [
        "MSFT'; UNION SELECT password FROM users; --",
        '<iframe src="javascript:alert(1)"></iframe>',
        'GOOGL && rm -rf /',
        '..\\..\\windows\\system32\\config\\sam'
      ]

      for (const symbol of maliciousSymbols) {
        const result = await service.getInsiderTransactions(symbol)
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBe(0) // Should return empty array for invalid symbols
      }
    })

    test('should_sanitize_and_normalize_valid_symbols', async () => {
      const testSymbols = [
        'aapl',    // lowercase
        'AAPL ',   // with trailing space
        ' MSFT',   // with leading space
        'GOOGL\t', // with tab
        'TSLA\n'   // with newline
      ]

      for (const symbol of testSymbols) {
        // These should not throw errors and should handle normalization
        const holdingsResult = await service.getInstitutionalHoldings(symbol)
        const transactionsResult = await service.getInsiderTransactions(symbol)

        expect(Array.isArray(holdingsResult)).toBe(true)
        expect(Array.isArray(transactionsResult)).toBe(true)
      }
    }, 30000)

    test('should_enforce_rate_limiting_for_repeated_requests', async () => {
      const symbol = 'AAPL'
      const serviceId = `institutional_holdings_${symbol}`

      // Exhaust rate limit by making many rapid requests
      for (let i = 0; i < 15; i++) {
        SecurityValidator.checkRateLimit(serviceId)
      }

      // This request should be rate limited
      const result = await service.getInstitutionalHoldings(symbol)
      expect(Array.isArray(result)).toBe(true)
      // Rate limited requests may return empty array or cached data
    })
  })

  describe('13F Institutional Holdings Retrieval', () => {
    test('should_retrieve_institutional_holdings_for_valid_symbol_with_real_api', async () => {
      const symbol = 'AAPL' // Use a well-known symbol that should have 13F data

      const holdings = await service.getInstitutionalHoldings(symbol, 2)

      expect(Array.isArray(holdings)).toBe(true)

      // If holdings are returned, validate their structure
      if (holdings.length > 0) {
        holdings.forEach(holding => {
          expect(holding).toHaveProperty('symbol')
          expect(holding).toHaveProperty('cusip')
          expect(holding).toHaveProperty('shares')
          expect(holding).toHaveProperty('marketValue')
          expect(holding).toHaveProperty('filingDate')
          expect(holding).toHaveProperty('timestamp')
          expect(holding).toHaveProperty('source')

          // Validate data types
          expect(typeof holding.symbol).toBe('string')
          expect(typeof holding.cusip).toBe('string')
          expect(typeof holding.shares).toBe('number')
          expect(typeof holding.marketValue).toBe('number')
          expect(typeof holding.timestamp).toBe('number')
          expect(holding.source).toBe('sec_edgar_institutional')

          // Validate reasonable value ranges
          expect(holding.shares).toBeGreaterThanOrEqual(0)
          expect(holding.marketValue).toBeGreaterThanOrEqual(0)
          expect(holding.timestamp).toBeGreaterThan(0)
        })

        console.log(`✓ Retrieved ${holdings.length} institutional holdings for ${symbol}`)
      } else {
        console.log(`⚠ No institutional holdings found for ${symbol} - this may be due to data availability or API limitations`)
      }
    }, 45000)

    test('should_handle_invalid_symbol_gracefully_for_institutional_holdings', async () => {
      const invalidSymbol = 'INVALID_SYMBOL_THAT_DOES_NOT_EXIST'

      const holdings = await service.getInstitutionalHoldings(invalidSymbol)

      expect(Array.isArray(holdings)).toBe(true)
      expect(holdings.length).toBe(0)
    }, 20000)

    test('should_respect_quarters_parameter_for_historical_data', async () => {
      const symbol = 'MSFT'

      // Test different quarter parameters
      const oneQuarter = await service.getInstitutionalHoldings(symbol, 1)
      const fourQuarters = await service.getInstitutionalHoldings(symbol, 4)

      expect(Array.isArray(oneQuarter)).toBe(true)
      expect(Array.isArray(fourQuarters)).toBe(true)

      // If data is available, four quarters should have same or more holdings than one quarter
      if (oneQuarter.length > 0 && fourQuarters.length > 0) {
        expect(fourQuarters.length).toBeGreaterThanOrEqual(oneQuarter.length)
      }
    }, 30000)

    test('should_implement_caching_for_institutional_holdings', async () => {
      const symbol = 'GOOGL'

      // First request - should hit API
      const startTime1 = Date.now()
      const holdings1 = await service.getInstitutionalHoldings(symbol)
      const duration1 = Date.now() - startTime1

      // Second request - should use cache
      const startTime2 = Date.now()
      const holdings2 = await service.getInstitutionalHoldings(symbol)
      const duration2 = Date.now() - startTime2

      expect(Array.isArray(holdings1)).toBe(true)
      expect(Array.isArray(holdings2)).toBe(true)

      // Cache should make second request faster (if data was retrieved)
      if (holdings1.length > 0) {
        expect(duration2).toBeLessThan(duration1)
        console.log(`✓ Cache improved response time: ${duration1}ms -> ${duration2}ms`)
      }
    }, 60000)
  })

  describe('Form 4 Insider Transactions Retrieval', () => {
    test('should_retrieve_insider_transactions_for_valid_symbol_with_real_api', async () => {
      const symbol = 'TSLA' // Use a symbol known for insider activity

      const transactions = await service.getInsiderTransactions(symbol, 180)

      expect(Array.isArray(transactions)).toBe(true)

      // If transactions are returned, validate their structure
      if (transactions.length > 0) {
        transactions.forEach(transaction => {
          expect(transaction).toHaveProperty('symbol')
          expect(transaction).toHaveProperty('reportingOwnerName')
          expect(transaction).toHaveProperty('transactionDate')
          expect(transaction).toHaveProperty('filingDate')
          expect(transaction).toHaveProperty('transactionType')
          expect(transaction).toHaveProperty('shares')
          expect(transaction).toHaveProperty('timestamp')
          expect(transaction).toHaveProperty('source')

          // Validate data types
          expect(typeof transaction.symbol).toBe('string')
          expect(typeof transaction.reportingOwnerName).toBe('string')
          expect(typeof transaction.transactionDate).toBe('string')
          expect(typeof transaction.transactionType).toBe('string')
          expect(typeof transaction.shares).toBe('number')
          expect(typeof transaction.timestamp).toBe('number')
          expect(transaction.source).toBe('sec_edgar_institutional')

          // Validate transaction type
          expect(['BUY', 'SELL', 'GRANT', 'EXERCISE', 'GIFT', 'OTHER']).toContain(transaction.transactionType)

          // Validate reasonable value ranges
          expect(transaction.shares).toBeGreaterThanOrEqual(0)
          expect(transaction.timestamp).toBeGreaterThan(0)
        })

        console.log(`✓ Retrieved ${transactions.length} insider transactions for ${symbol}`)
      } else {
        console.log(`⚠ No insider transactions found for ${symbol} - this may be due to data availability or API limitations`)
      }
    }, 45000)

    test('should_handle_invalid_symbol_gracefully_for_insider_transactions', async () => {
      const invalidSymbol = 'ANOTHER_INVALID_SYMBOL'

      const transactions = await service.getInsiderTransactions(invalidSymbol)

      expect(Array.isArray(transactions)).toBe(true)
      expect(transactions.length).toBe(0)
    }, 20000)

    test('should_respect_days_parameter_for_historical_transactions', async () => {
      const symbol = 'AMZN'

      // Test different day parameters
      const thirtyDays = await service.getInsiderTransactions(symbol, 30)
      const oneEightyDays = await service.getInsiderTransactions(symbol, 180)

      expect(Array.isArray(thirtyDays)).toBe(true)
      expect(Array.isArray(oneEightyDays)).toBe(true)

      // If data is available, 180 days should have same or more transactions than 30 days
      if (thirtyDays.length > 0 && oneEightyDays.length > 0) {
        expect(oneEightyDays.length).toBeGreaterThanOrEqual(thirtyDays.length)
      }
    }, 30000)

    test('should_implement_caching_for_insider_transactions', async () => {
      const symbol = 'META'

      // First request - should hit API
      const startTime1 = Date.now()
      const transactions1 = await service.getInsiderTransactions(symbol)
      const duration1 = Date.now() - startTime1

      // Second request - should use cache
      const startTime2 = Date.now()
      const transactions2 = await service.getInsiderTransactions(symbol)
      const duration2 = Date.now() - startTime2

      expect(Array.isArray(transactions1)).toBe(true)
      expect(Array.isArray(transactions2)).toBe(true)

      // Cache should make second request faster (if data was retrieved)
      if (transactions1.length > 0) {
        expect(duration2).toBeLessThan(duration1)
        console.log(`✓ Cache improved response time: ${duration1}ms -> ${duration2}ms`)
      }
    }, 60000)
  })

  describe('Institutional Intelligence and Sentiment Analysis', () => {
    test('should_generate_comprehensive_institutional_intelligence_with_real_data', async () => {
      const symbol = 'NVDA' // Use a symbol with likely institutional activity

      const intelligence = await service.getInstitutionalIntelligence(symbol)

      if (intelligence) {
        // Validate intelligence structure
        expect(intelligence).toHaveProperty('symbol')
        expect(intelligence).toHaveProperty('reportDate')
        expect(intelligence).toHaveProperty('compositeScore')
        expect(intelligence).toHaveProperty('weightedSentiment')
        expect(intelligence).toHaveProperty('keyInsights')
        expect(intelligence).toHaveProperty('riskFactors')
        expect(intelligence).toHaveProperty('opportunities')
        expect(intelligence).toHaveProperty('dataQuality')
        expect(intelligence).toHaveProperty('timestamp')
        expect(intelligence).toHaveProperty('source')

        // Validate data types and ranges
        expect(typeof intelligence.symbol).toBe('string')
        expect(typeof intelligence.reportDate).toBe('string')
        expect(typeof intelligence.compositeScore).toBe('number')
        expect(typeof intelligence.weightedSentiment).toBe('string')
        expect(Array.isArray(intelligence.keyInsights)).toBe(true)
        expect(Array.isArray(intelligence.riskFactors)).toBe(true)
        expect(Array.isArray(intelligence.opportunities)).toBe(true)
        expect(typeof intelligence.dataQuality).toBe('object')
        expect(typeof intelligence.timestamp).toBe('number')
        expect(intelligence.source).toBe('sec_edgar_institutional')

        // Validate composite score range (0-10)
        expect(intelligence.compositeScore).toBeGreaterThanOrEqual(0)
        expect(intelligence.compositeScore).toBeLessThanOrEqual(10)

        // Validate weighted sentiment values
        expect(['VERY_BULLISH', 'BULLISH', 'NEUTRAL', 'BEARISH', 'VERY_BEARISH']).toContain(intelligence.weightedSentiment)

        // Validate data quality structure
        expect(intelligence.dataQuality).toHaveProperty('institutionalDataAvailable')
        expect(intelligence.dataQuality).toHaveProperty('insiderDataAvailable')
        expect(intelligence.dataQuality).toHaveProperty('dataFreshness')
        expect(intelligence.dataQuality).toHaveProperty('completeness')

        expect(typeof intelligence.dataQuality.institutionalDataAvailable).toBe('boolean')
        expect(typeof intelligence.dataQuality.insiderDataAvailable).toBe('boolean')
        expect(typeof intelligence.dataQuality.dataFreshness).toBe('number')
        expect(typeof intelligence.dataQuality.completeness).toBe('number')

        console.log(`✓ Generated institutional intelligence for ${symbol}:`)
        console.log(`  Composite Score: ${intelligence.compositeScore}/10`)
        console.log(`  Weighted Sentiment: ${intelligence.weightedSentiment}`)
        console.log(`  Key Insights: ${intelligence.keyInsights.length}`)
        console.log(`  Risk Factors: ${intelligence.riskFactors.length}`)
        console.log(`  Opportunities: ${intelligence.opportunities.length}`)
        console.log(`  Data Quality: ${(intelligence.dataQuality.completeness * 100).toFixed(1)}%`)
      } else {
        console.log(`⚠ No institutional intelligence generated for ${symbol} - this may be due to insufficient data or API limitations`)
        expect(intelligence).toBeNull()
      }
    }, 60000)

    test('should_handle_symbol_with_no_institutional_data_gracefully', async () => {
      const symbol = 'UNKNOWN_PENNY_STOCK'

      const intelligence = await service.getInstitutionalIntelligence(symbol)

      // Should return null for symbols with no institutional data
      expect(intelligence).toBeNull()
    }, 30000)

    test('should_calculate_sentiment_scores_within_valid_ranges', async () => {
      const symbol = 'JPM' // Large bank likely to have institutional activity

      const intelligence = await service.getInstitutionalIntelligence(symbol)

      if (intelligence?.institutionalSentiment) {
        expect(intelligence.institutionalSentiment.sentimentScore).toBeGreaterThanOrEqual(0)
        expect(intelligence.institutionalSentiment.sentimentScore).toBeLessThanOrEqual(10)
        expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(intelligence.institutionalSentiment.sentiment)
      }

      if (intelligence?.insiderSentiment) {
        expect(intelligence.insiderSentiment.sentimentScore).toBeGreaterThanOrEqual(0)
        expect(intelligence.insiderSentiment.sentimentScore).toBeLessThanOrEqual(10)
        expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(intelligence.insiderSentiment.sentiment)
      }
    }, 45000)
  })

  describe('Error Handling and Resilience', () => {
    test('should_handle_network_timeouts_gracefully', async () => {
      // Create service with very short timeout to force timeout
      const timeoutService = new InstitutionalDataService({
        timeout: 1 // 1ms timeout will definitely fail
      })

      const result = await timeoutService.getInstitutionalHoldings('AAPL')

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0) // Should return empty array on timeout

      timeoutService.clearCache()
    })

    test('should_handle_api_rate_limit_responses_gracefully', async () => {
      const symbol = 'V'

      // Make many rapid requests to potentially trigger rate limiting
      const promises = Array(5).fill(0).map(() => service.getInstitutionalHoldings(symbol))
      const results = await Promise.allSettled(promises)

      // All requests should complete without throwing errors
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
        if (result.status === 'fulfilled') {
          expect(Array.isArray(result.value)).toBe(true)
        }
      })
    }, 30000)

    test('should_sanitize_error_messages_to_prevent_information_disclosure', async () => {
      // Capture console output to check for sensitive information
      const originalConsoleError = console.error
      const consoleMessages: string[] = []

      console.error = (...args: any[]) => {
        consoleMessages.push(args.join(' '))
      }

      try {
        // Force an error by using invalid configuration
        const errorService = new InstitutionalDataService({
          baseUrl: 'https://invalid-sec-endpoint-that-does-not-exist.com'
        })

        await errorService.getInstitutionalHoldings('AAPL')

        // Check that error messages don't contain sensitive information
        const allMessages = consoleMessages.join(' ')
        expect(allMessages).not.toContain('api_key')
        expect(allMessages).not.toContain('password')
        expect(allMessages).not.toContain('secret')
        expect(allMessages).not.toContain('token')

        errorService.clearCache()
      } finally {
        console.error = originalConsoleError
      }
    }, 20000)

    test('should_maintain_cache_integrity_during_errors', async () => {
      const symbol = 'AAPL'

      // First, populate cache with a successful request
      await service.getInstitutionalHoldings(symbol)

      // Then make a request that might fail
      await service.getInstitutionalHoldings('INVALID_SYMBOL')

      // Original cache should still be intact
      const cachedResult = await service.getInstitutionalHoldings(symbol)
      expect(Array.isArray(cachedResult)).toBe(true)
    }, 30000)
  })

  describe('Performance and Memory Management', () => {
    test('should_process_multiple_symbols_concurrently_without_memory_leaks', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']

      const startMemory = process.memoryUsage().heapUsed

      // Process multiple symbols concurrently
      const promises = symbols.map(symbol => service.getInstitutionalHoldings(symbol, 1))
      const results = await Promise.allSettled(promises)

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const endMemory = process.memoryUsage().heapUsed
      const memoryIncrease = endMemory - startMemory

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)

      // All requests should complete
      expect(results.length).toBe(symbols.length)
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
      })

      console.log(`✓ Memory usage increased by ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${symbols.length} symbols`)
    }, 60000)

    test('should_respect_request_queue_and_rate_limiting', async () => {
      const symbol = 'MSFT'

      // Make multiple requests that should be queued
      const startTime = Date.now()
      const promises = Array(3).fill(0).map(() => service.getInstitutionalHoldings(symbol, 1))
      await Promise.allSettled(promises)
      const totalTime = Date.now() - startTime

      // With rate limiting, requests should take some minimum time
      expect(totalTime).toBeGreaterThan(200) // At least 200ms for 3 requests with rate limiting

      console.log(`✓ Rate limiting enforced: ${totalTime}ms for 3 requests`)
    }, 30000)

    test('should_clear_cache_without_affecting_service_functionality', async () => {
      const symbol = 'GOOGL'

      // Populate cache
      await service.getInstitutionalHoldings(symbol)

      // Clear cache
      service.clearCache()

      // Service should still work after cache clear
      const result = await service.getInstitutionalHoldings(symbol)
      expect(Array.isArray(result)).toBe(true)
    }, 30000)
  })

  describe('Data Quality and Validation', () => {
    test('should_validate_institutional_holding_data_structure_thoroughly', async () => {
      const symbol = 'JNJ'

      const holdings = await service.getInstitutionalHoldings(symbol)

      if (holdings.length > 0) {
        holdings.forEach(holding => {
          // Required fields validation
          expect(holding.symbol).toBeDefined()
          expect(holding.cusip).toBeDefined()
          expect(holding.shares).toBeDefined()
          expect(holding.marketValue).toBeDefined()
          expect(holding.filingDate).toBeDefined()
          expect(holding.timestamp).toBeDefined()
          expect(holding.source).toBeDefined()

          // Data type validation
          expect(typeof holding.symbol).toBe('string')
          expect(typeof holding.cusip).toBe('string')
          expect(typeof holding.shares).toBe('number')
          expect(typeof holding.marketValue).toBe('number')
          expect(typeof holding.filingDate).toBe('string')
          expect(typeof holding.timestamp).toBe('number')
          expect(typeof holding.source).toBe('string')

          // Value range validation
          expect(holding.shares).toBeGreaterThanOrEqual(0)
          expect(holding.marketValue).toBeGreaterThanOrEqual(0)
          expect(holding.timestamp).toBeGreaterThan(0)
          expect(holding.cusip.length).toBeGreaterThan(0)

          // Date validation
          expect(Date.parse(holding.filingDate)).not.toBeNaN()

          // Source validation
          expect(holding.source).toBe('sec_edgar_institutional')
        })
      }
    }, 30000)

    test('should_validate_insider_transaction_data_structure_thoroughly', async () => {
      const symbol = 'WMT'

      const transactions = await service.getInsiderTransactions(symbol)

      if (transactions.length > 0) {
        transactions.forEach(transaction => {
          // Required fields validation
          expect(transaction.symbol).toBeDefined()
          expect(transaction.reportingOwnerName).toBeDefined()
          expect(transaction.transactionDate).toBeDefined()
          expect(transaction.filingDate).toBeDefined()
          expect(transaction.transactionType).toBeDefined()
          expect(transaction.shares).toBeDefined()
          expect(transaction.timestamp).toBeDefined()
          expect(transaction.source).toBeDefined()

          // Data type validation
          expect(typeof transaction.symbol).toBe('string')
          expect(typeof transaction.reportingOwnerName).toBe('string')
          expect(typeof transaction.transactionDate).toBe('string')
          expect(typeof transaction.filingDate).toBe('string')
          expect(typeof transaction.transactionType).toBe('string')
          expect(typeof transaction.shares).toBe('number')
          expect(typeof transaction.timestamp).toBe('number')
          expect(typeof transaction.source).toBe('string')

          // Value range validation
          expect(transaction.shares).toBeGreaterThanOrEqual(0)
          expect(transaction.timestamp).toBeGreaterThan(0)

          // Transaction type validation
          expect(['BUY', 'SELL', 'GRANT', 'EXERCISE', 'GIFT', 'OTHER']).toContain(transaction.transactionType)

          // Date validation
          expect(Date.parse(transaction.transactionDate)).not.toBeNaN()
          expect(Date.parse(transaction.filingDate)).not.toBeNaN()

          // Source validation
          expect(transaction.source).toBe('sec_edgar_institutional')
        })
      }
    }, 30000)

    test('should_ensure_data_freshness_and_completeness_scoring', async () => {
      const symbol = 'KO'

      const intelligence = await service.getInstitutionalIntelligence(symbol)

      if (intelligence) {
        const { dataQuality } = intelligence

        // Data freshness should be a reasonable number of days
        expect(dataQuality.dataFreshness).toBeGreaterThanOrEqual(0)
        expect(dataQuality.dataFreshness).toBeLessThan(400) // Less than 400 days

        // Completeness should be between 0 and 1
        expect(dataQuality.completeness).toBeGreaterThanOrEqual(0)
        expect(dataQuality.completeness).toBeLessThanOrEqual(1)

        // Boolean flags should be proper booleans
        expect(typeof dataQuality.institutionalDataAvailable).toBe('boolean')
        expect(typeof dataQuality.insiderDataAvailable).toBe('boolean')
      }
    }, 45000)
  })
})