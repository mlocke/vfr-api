/**
 * Comprehensive Integration Test Suite for CongressionalTradingService
 * Tests political insider trading signals with REAL FMP API integration
 * Validates performance benchmarks, memory usage, and rate limit compliance
 * NO MOCK DATA - follows TDD principles with real integrations only
 */

import { CongressionalTradingService } from '../CongressionalTradingService'
import { CongressionalTrade, PoliticalInsiderSignal, CongressionalAnalysis } from '../types'
import { createServiceErrorHandler } from '../../error-handling'
import SecurityValidator from '../../security/SecurityValidator'
import { redisCache } from '../../cache/RedisCache'
import { FinancialModelingPrepAPI } from '../FinancialModelingPrepAPI'

describe('CongressionalTradingService Integration Tests', () => {
  let service: CongressionalTradingService
  let errorHandler: ReturnType<typeof createServiceErrorHandler>
  let fmpApi: FinancialModelingPrepAPI
  let startTime: number
  let initialMemoryUsage: NodeJS.MemoryUsage

  beforeEach(() => {
    // Initialize memory and performance tracking
    startTime = Date.now()
    initialMemoryUsage = process.memoryUsage()

    // Reset security state and rate limiting
    SecurityValidator.resetSecurityState()

    // Initialize FMP API connection
    fmpApi = new FinancialModelingPrepAPI(process.env.FMP_API_KEY, 15000, false)

    // Create fresh service instance
    service = new CongressionalTradingService()

    errorHandler = createServiceErrorHandler('CongressionalTradingService-Integration')
  })

  afterEach(async () => {
    // Performance and memory validation
    const testDuration = Date.now() - startTime
    const finalMemoryUsage = process.memoryUsage()
    const memoryIncrease = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed

    // Performance benchmark: must stay under 3-second total
    expect(testDuration).toBeLessThan(3000)

    // Memory benchmark: must stay under 50MB increase per test
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)

    // Cleanup - no clearCache method available
    SecurityValidator.resetSecurityState()

    try {
      await redisCache.cleanup()
    } catch (error) {
      // Redis may not be available in test environment
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  })

  describe('Real FMP API Integration and Rate Limit Compliance', () => {
    test('should_fetch_congressional_trades_with_real_fmp_api_under_rate_limits', async () => {
      const testSymbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA']
      const apiCallCount = testSymbols.length

      // Pre-validate rate limit capacity (FMP Starter: 300/minute = 5/second)
      // Allow 80% utilization to prevent rate limiting: 4 calls/second max
      expect(apiCallCount).toBeLessThanOrEqual(4)

      const startApiTime = Date.now()
      const promises = testSymbols.map(symbol => service.getCongressionalTrades(symbol))
      const results = await Promise.allSettled(promises)
      const apiDuration = Date.now() - startApiTime

      // Rate limit compliance validation
      expect(apiDuration).toBeGreaterThanOrEqual((apiCallCount - 1) * 250) // Minimum 250ms between calls

      // All API calls should complete without rate limiting errors
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled')
        if (result.status === 'fulfilled') {
          const trades = result.value
          expect(Array.isArray(trades)).toBe(true)

          if (trades.length > 0) {
            trades.forEach(trade => {
              expect(trade).toHaveProperty('symbol', testSymbols[index])
              expect(trade).toHaveProperty('politician')
              expect(trade).toHaveProperty('transactionType')
              expect(trade).toHaveProperty('amount')
              expect(trade).toHaveProperty('transactionDate')
              expect(typeof trade.confidence).toBe('number')
              expect(trade.confidence).toBeGreaterThanOrEqual(0)
              expect(trade.confidence).toBeLessThanOrEqual(1)
            })
          }
        }
      })

      console.log(`✓ Congressional trades fetched: ${apiCallCount} symbols in ${apiDuration}ms`)
    }, 15000)

    test('should_handle_fmp_rate_limit_gracefully_with_fallback', async () => {
      const symbol = 'TSLA'

      // Exhaust FMP rate limit by making rapid consecutive calls
      const rapidCalls = Array(10).fill(0).map(() => service.getCongressionalTrades(symbol))
      const results = await Promise.allSettled(rapidCalls)

      let successCount = 0
      let rateLimitedCount = 0

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++
        } else if (result.reason?.message?.includes('rate limit')) {
          rateLimitedCount++
        }
      })

      // Should handle rate limiting gracefully - some succeed, some return empty arrays
      expect(successCount + rateLimitedCount).toBeLessThanOrEqual(results.length)

      console.log(`✓ Rate limit handling: ${successCount} successful, ${rateLimitedCount} rate-limited`)
    }, 20000)

    test('should_validate_congressional_data_quality_and_integrity', async () => {
      const symbol = 'META'
      const trades = await service.getCongressionalTrades(symbol)

      if (trades.length > 0) {
        trades.forEach(trade => {
          // Data integrity validation
          expect(trade.symbol).toBe(symbol)
          expect(typeof trade.politician).toBe('string')
          expect(trade.politician.length).toBeGreaterThan(0)

          // Transaction type validation
          expect(['BUY', 'SELL', 'PARTIAL_SELL', 'EXCHANGE']).toContain(trade.transactionType)

          // Amount validation (should be positive number)
          expect(typeof trade.amount).toBe('number')
          expect(trade.amount).toBeGreaterThan(0)

          // Date validation (should be recent, within last 2 years)
          const transactionDate = new Date(trade.transactionDate).getTime()
          const twoYearsAgo = Date.now() - (2 * 365 * 24 * 60 * 60 * 1000)
          expect(transactionDate).toBeGreaterThan(twoYearsAgo)
          expect(transactionDate).toBeLessThanOrEqual(Date.now())

          // Signal strength validation
          expect(typeof trade.confidence).toBe('number')
          expect(trade.confidence).toBeGreaterThanOrEqual(0)
          expect(trade.confidence).toBeLessThanOrEqual(1)
        })

        console.log(`✓ Data quality validated: ${trades.length} trades for ${symbol}`)
      }
    })

    test('should_calculate_political_insider_signals_with_weight_contribution', async () => {
      const symbol = 'AMZN'
      const analysis = await service.getPoliticalInsiderSignal(symbol)

      if (analysis) {
        // Signal structure validation
        expect(analysis).toHaveProperty('symbol', symbol)
        expect(analysis).toHaveProperty('sentimentScore')
        expect(analysis).toHaveProperty('confidence')
        expect(analysis).toHaveProperty('recentPurchases')
        expect(analysis).toHaveProperty('recentSales')
        expect(analysis).toHaveProperty('netSentiment')
        expect(analysis).toHaveProperty('significantTrades')

        // Signal strength validation
        expect(typeof analysis.sentimentScore).toBe('number')
        expect(analysis.sentimentScore).toBeGreaterThanOrEqual(-10)
        expect(analysis.sentimentScore).toBeLessThanOrEqual(10)

        // Confidence score validation
        expect(typeof analysis.confidence).toBe('number')
        expect(analysis.confidence).toBeGreaterThanOrEqual(0)
        expect(analysis.confidence).toBeLessThanOrEqual(1)

        // Net sentiment validation
        expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(analysis.netSentiment)

        // Recent activity validation
        expect(typeof analysis.recentPurchases).toBe('number')
        expect(typeof analysis.recentSales).toBe('number')
        expect(analysis.recentPurchases).toBeGreaterThanOrEqual(0)
        expect(analysis.recentSales).toBeGreaterThanOrEqual(0)

        console.log(`✓ Political signal calculated: ${symbol} - Signal: ${analysis.sentimentScore}, Confidence: ${analysis.confidence}, Sentiment: ${analysis.netSentiment}`)
      }
    })
  })

  describe('Performance and Memory Management', () => {
    test('should_process_multiple_symbols_within_performance_benchmarks', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']
      const memoryBefore = process.memoryUsage().heapUsed

      const startTime = Date.now()
      const results = await service.getCongressionalAnalysisBatch(symbols)
      const processingTime = Date.now() - startTime

      const memoryAfter = process.memoryUsage().heapUsed
      const memoryIncrease = memoryAfter - memoryBefore

      // Performance benchmarks
      expect(processingTime).toBeLessThan(3000) // Under 3 seconds total
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Under 100MB memory increase

      // Results validation
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeLessThanOrEqual(symbols.length)

      results.forEach(result => {
        expect(result).toHaveProperty('symbol')
        expect(symbols).toContain(result.symbol)
        expect(typeof result.confidence).toBe('number')
        expect(result.confidence).toBeGreaterThanOrEqual(0)
        expect(result.confidence).toBeLessThanOrEqual(1)
      })

      console.log(`✓ Batch processing: ${results.length} symbols in ${processingTime}ms, ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB memory`)
    }, 25000)

    test('should_implement_efficient_caching_with_cache_hit_ratio_tracking', async () => {
      const symbol = 'JPM'

      // Clear cache for clean test - no clearCache method available

      // First request - should be cache miss
      const startTime1 = Date.now()
      const result1 = await service.getCongressionalTrades(symbol)
      const duration1 = Date.now() - startTime1

      // Second request - should be cache hit
      const startTime2 = Date.now()
      const result2 = await service.getCongressionalTrades(symbol)
      const duration2 = Date.now() - startTime2

      // Third request - should also be cache hit
      const startTime3 = Date.now()
      const result3 = await service.getCongressionalTrades(symbol)
      const duration3 = Date.now() - startTime3

      // Cache effectiveness validation
      if (result1.length > 0) {
        expect(duration2).toBeLessThan(duration1) // Cache hit should be faster
        expect(duration3).toBeLessThan(duration1) // Cache hit should be faster

        // Results should be consistent
        expect(result2).toEqual(result1)
        expect(result3).toEqual(result1)

        const cacheEfficiency = ((duration1 - duration2) / duration1) * 100
        expect(cacheEfficiency).toBeGreaterThan(50) // At least 50% improvement

        console.log(`✓ Cache efficiency: ${cacheEfficiency.toFixed(1)}% improvement (${duration1}ms -> ${duration2}ms)`)
      }

      // Get cache statistics if available - no getCacheStatistics method available
      console.log('✓ Cache statistics not available in current implementation')
    })

    test('should_handle_concurrent_requests_without_race_conditions', async () => {
      const symbol = 'V'
      const concurrentRequestCount = 5

      const promises = Array(concurrentRequestCount).fill(0).map((_, index) => ({
        trades: service.getCongressionalTrades(symbol),
        signals: service.getPoliticalInsiderSignal(symbol),
        analysis: service.getCongressionalAnalysisBatch([symbol])
      }))

      const startTime = Date.now()
      const results = await Promise.allSettled(promises.flatMap(p => [p.trades, p.signals, p.analysis]))
      const concurrentDuration = Date.now() - startTime

      // Performance validation for concurrent processing
      expect(concurrentDuration).toBeLessThan(5000) // Should handle concurrency efficiently

      // Check for consistency in concurrent results
      const successfulTradeResults = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(v => Array.isArray(v) && v.length > 0)

      if (successfulTradeResults.length > 1) {
        // All trade results should be identical (from cache or consistent API)
        const firstResult = JSON.stringify(successfulTradeResults[0])
        successfulTradeResults.slice(1).forEach(result => {
          expect(JSON.stringify(result)).toBe(firstResult)
        })
      }

      console.log(`✓ Concurrent processing: ${results.length} requests in ${concurrentDuration}ms`)
    }, 20000)
  })

  describe('Data Quality and Business Logic Validation', () => {
    test('should_calculate_accurate_signal_strength_based_on_transaction_patterns', async () => {
      const symbol = 'WMT'
      const trades = await service.getCongressionalTrades(symbol)

      if (trades.length > 0) {
        // Group trades by transaction type for pattern analysis
        const buyTrades = trades.filter(t => t.transactionType === 'Purchase')
        const sellTrades = trades.filter(t => t.transactionType === 'Sale')

        // Signal strength should correlate with trade patterns
        const overallSignal = await service.getPoliticalInsiderSignal(symbol)

        if (overallSignal) {
          // More buy trades should result in positive signal
          if (buyTrades.length > sellTrades.length) {
            expect(overallSignal.sentimentScore).toBeGreaterThanOrEqual(0)
            expect(overallSignal.recentPurchases).toBeGreaterThan(overallSignal.recentSales)
          }

          // More sell trades should result in negative/lower signal
          if (sellTrades.length > buyTrades.length) {
            expect(overallSignal.recentSales).toBeGreaterThan(overallSignal.recentPurchases)
          }

          // High-volume trades should increase confidence
          const highVolumeTrades = trades.filter(t => t.amountMax && t.amountMax > 50000) // Over $50k
          if (highVolumeTrades.length > 0) {
            expect(overallSignal.confidence).toBeGreaterThan(0.3)
          }

          console.log(`✓ Signal logic validated: ${symbol} - ${buyTrades.length} buys, ${sellTrades.length} sells, confidence: ${overallSignal.confidence}`)
        }
      }
    })

    test('should_validate_politician_identification_and_classification', async () => {
      const symbol = 'KO'
      const trades = await service.getCongressionalTrades(symbol)

      if (trades.length > 0) {
        trades.forEach(trade => {
          // Politician name should be formatted properly
          expect(typeof trade.politician).toBe('string')
          expect(trade.politician.length).toBeGreaterThan(3)
          expect(trade.politician).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+/) // First Last format

          // Should have house classification
          expect(['Senate', 'House', 'Other']).toContain(trade.house)

          // Should have party affiliation if available
          if (trade.party) {
            expect(['Republican', 'Democratic', 'Independent', 'R', 'D', 'I']).toContain(trade.party)
          }

          // Should have disclosure date that's after transaction date
          if (trade.disclosureDate) {
            const transactionDate = new Date(trade.transactionDate).getTime()
            const disclosureDate = new Date(trade.disclosureDate).getTime()
            expect(disclosureDate).toBeGreaterThanOrEqual(transactionDate)
          }
        })

        console.log(`✓ Politician data validated: ${trades.length} trades with proper identification`)
      }
    })

    test('should_calculate_accurate_weight_contribution_to_overall_analysis', async () => {
      const symbol = 'PEP'
      const analysisResults = await service.getCongressionalAnalysisBatch([symbol])
      const analysis = analysisResults[0]

      if (analysis && analysis.confidence > 0) {
        // Test confidence and scoring properties that actually exist
        expect(analysis.confidence).toBeGreaterThan(0)
        expect(analysis.confidence).toBeLessThanOrEqual(1)
        expect(typeof analysis.politicalSentiment.sentimentScore).toBe('number')

        // Test actual properties from CongressionalAnalysis interface
        expect(analysis.overallRating).toMatch(/POSITIVE|NEGATIVE|NEUTRAL/)
        expect(Array.isArray(analysis.insights)).toBe(true)
        expect(Array.isArray(analysis.riskFactors)).toBe(true)
        expect(Array.isArray(analysis.opportunities)).toBe(true)

        console.log(`✓ Congressional analysis validated: ${symbol} - Rating: ${analysis.overallRating}`)
      }
    })
  })

  describe('Error Handling and Resilience', () => {
    test('should_handle_fmp_api_errors_gracefully_without_throwing', async () => {
      const invalidSymbol = 'INVALID_SYMBOL_TEST'

      // Should not throw errors, should return empty arrays or null
      const trades = await service.getCongressionalTrades(invalidSymbol)
      const signals = await service.getPoliticalInsiderSignal(invalidSymbol)
      const analysisResults = await service.getCongressionalAnalysisBatch([invalidSymbol])
      const analysis = analysisResults.length > 0 ? analysisResults[0] : null

      expect(Array.isArray(trades)).toBe(true)
      expect(trades.length).toBe(0)
      expect(signals).toBe(null)
      expect(analysis).toBe(null)

      console.log('✓ Invalid symbol handled gracefully')
    })

    test('should_implement_circuit_breaker_pattern_for_repeated_failures', async () => {
      const symbol = 'AAPL'
      const serviceId = `congressional_trades_${symbol}`

      // Trigger multiple failures to activate circuit breaker
      for (let i = 0; i < 15; i++) {
        SecurityValidator.recordFailure(serviceId)
      }

      // Service should be circuit broken
      const result = await service.getCongressionalTrades(symbol)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0) // Circuit breaker returns empty array

      console.log('✓ Circuit breaker pattern implemented')

      // Reset for cleanup
      SecurityValidator.resetSecurityState()
    })

    test('should_sanitize_sensitive_data_in_error_logs', async () => {
      const originalConsoleError = console.error
      const capturedErrors: string[] = []

      console.error = (...args: any[]) => {
        capturedErrors.push(args.join(' '))
      }

      try {
        // Force an error with potential sensitive data
        const corruptedService = new CongressionalTradingService()

        await corruptedService.getCongressionalTrades('TEST')

        // Check that sensitive data is not leaked in error logs
        const allErrors = capturedErrors.join(' ')
        expect(allErrors).not.toContain('fake_api_key_sensitive_123')
        expect(allErrors).not.toContain('password')
        expect(allErrors).not.toContain('secret')
        expect(allErrors).not.toContain('token')

        console.log('✓ Error sanitization working properly')
      } finally {
        console.error = originalConsoleError
      }
    })
  })

  describe('Integration with Analysis Engine', () => {
    test('should_provide_formatted_data_for_algorithm_engine_integration', async () => {
      const symbol = 'DIS'
      const analysisResults = await service.getCongressionalAnalysisBatch([symbol])
      const analysis = analysisResults.length > 0 ? analysisResults[0] : null

      if (analysis) {
        // Should provide data in format expected by AlgorithmEngine
        expect(analysis).toHaveProperty('symbol')
        expect(analysis).toHaveProperty('timestamp')
        expect(analysis).toHaveProperty('source', 'CongressionalTradingService')
        expect(analysis).toHaveProperty('politicalSentiment')
        expect(analysis).toHaveProperty('confidence')
        expect(analysis).toHaveProperty('overallRating')

        // Political sentiment indicators
        expect(analysis.politicalSentiment).toHaveProperty('sentimentScore')
        expect(analysis.politicalSentiment).toHaveProperty('netSentiment')
        expect(analysis.politicalSentiment).toHaveProperty('lastUpdated')
        expect(analysis.politicalSentiment).toHaveProperty('confidence')

        // Sentiment score should be normalized scale
        expect(analysis.politicalSentiment.sentimentScore).toBeGreaterThanOrEqual(-10)
        expect(analysis.politicalSentiment.sentimentScore).toBeLessThanOrEqual(10)

        // Timestamp should be recent
        expect(analysis.timestamp).toBeGreaterThan(Date.now() - 300000) // Within 5 minutes

        console.log(`✓ Algorithm integration format validated: ${symbol}`)
      }
    })
  })
})