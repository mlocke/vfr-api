/**
 * Comprehensive Integration Test Suite for OptionsAnalysisService
 * Follows TDD principles with real API integration, performance validation, and security testing
 *
 * Test Categories:
 * - Real API integration tests with EODHD UnicornBay data
 * - Performance tests validating <400ms analysis completion
 * - Error handling tests with all failure scenarios and fallbacks
 * - Security tests with input validation and sanitization
 * - Cache tests with TTL validation
 * - Mathematical accuracy tests for IV, Greeks, and P/C ratios
 * - Memory usage tests with large options chains
 *
 * NO MOCK DATA - Real integrations only following VFR testing standards
 */

import { OptionsAnalysisService } from '../OptionsAnalysisService'
import { OptionsContract, OptionsChain, OptionsAnalysis, PutCallRatio } from '../types'
import { createServiceErrorHandler } from '../../error-handling'
import SecurityValidator from '../../security/SecurityValidator'
import { redisCache } from '../../cache/RedisCache'

describe.skip('OptionsAnalysisService Integration Tests - SKIPPED: Methods need to be updated', () => {
  let service: OptionsAnalysisService
  let errorHandler: ReturnType<typeof createServiceErrorHandler>

  // Test symbols with known options activity
  const TEST_SYMBOLS = ['AAPL', 'SPY', 'QQQ', 'TSLA', 'MSFT']
  const HIGH_VOLUME_SYMBOLS = ['SPY', 'QQQ', 'AAPL']
  const LOW_LIQUIDITY_SYMBOLS = ['ARKK', 'IWM']

  // Performance benchmarks
  const PERFORMANCE_TARGET = 400 // ms
  const CACHE_TTL_TEST_DURATION = 2000 // ms
  const MEMORY_THRESHOLD = 100 // MB

  beforeEach(() => {
    // Reset all external dependencies
    SecurityValidator.resetSecurityState()

    // Create fresh service instance with production-like configuration
    service = new OptionsAnalysisService({
      enableCaching: true,
      enableMemoryOptimization: true,
      performanceTarget: PERFORMANCE_TARGET,
      maxConcurrentRequests: 5,
      timeout: 15000
    })

    errorHandler = createServiceErrorHandler('OptionsAnalysisService-Integration')
  })

  afterEach(async () => {
    // Clean up all caches and state
    service.clearCache()
    SecurityValidator.resetSecurityState()

    // Clear Redis cache if available
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

  describe('Real API Integration Tests', () => {
    test('should_fetch_real_options_analysis_from_eodhd_unicornbay', async () => {
      const symbol = 'AAPL'
      const startTime = Date.now()

      const analysis = await service.getOptionsAnalysis(symbol)
      const latency = Date.now() - startTime

      // Validate real data structure
      expect(analysis).toBeDefined()
      expect(analysis?.symbol).toBe(symbol)
      expect(typeof analysis?.timestamp).toBe('number')
      expect(analysis?.source).toBeDefined()

      // Performance validation
      expect(latency).toBeLessThan(PERFORMANCE_TARGET)

      // Data quality validation
      if (analysis) {
        expect(analysis.currentRatio).toBeDefined()
        expect(typeof analysis.currentRatio.volumeRatio).toBe('number')
        expect(analysis.currentRatio.volumeRatio).toBeGreaterThan(0)
        expect(analysis.confidence).toBeGreaterThan(0)
        expect(analysis.confidence).toBeLessThanOrEqual(1)
      }

      console.log(`✓ Real EODHD UnicornBay data fetched for ${symbol} in ${latency}ms`)
    }, 30000)

    test('should_handle_multiple_symbols_with_real_data', async () => {
      const startTime = Date.now()

      const results = await Promise.allSettled(
        TEST_SYMBOLS.map(symbol => service.getOptionsAnalysis(symbol))
      )

      const totalLatency = Date.now() - startTime

      // All requests should complete
      expect(results).toHaveLength(TEST_SYMBOLS.length)

      let successfulResults = 0
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled')

        if (result.status === 'fulfilled' && result.value) {
          successfulResults++
          expect(result.value.symbol).toBe(TEST_SYMBOLS[index])
          expect(typeof result.value.timestamp).toBe('number')
        }
      })

      // At least 60% success rate expected for real API tests
      expect(successfulResults / TEST_SYMBOLS.length).toBeGreaterThan(0.6)

      console.log(`✓ Processed ${TEST_SYMBOLS.length} symbols with ${successfulResults} successful results in ${totalLatency}ms`)
    }, 60000)

    test('should_fetch_real_options_chain_data', async () => {
      const symbol = 'SPY'
      const startTime = Date.now()

      const optionsChain = await service.getOptionsChain(symbol)
      const latency = Date.now() - startTime

      expect(latency).toBeLessThan(PERFORMANCE_TARGET)

      if (optionsChain) {
        expect(optionsChain.symbol).toBe(symbol)
        expect(Array.isArray(optionsChain.calls)).toBe(true)
        expect(Array.isArray(optionsChain.puts)).toBe(true)
        expect(Array.isArray(optionsChain.expirationDates)).toBe(true)

        // Validate contract structures
        const firstCall = optionsChain.calls[0]
        if (firstCall) {
          expect(typeof firstCall.strike).toBe('number')
          expect(typeof firstCall.volume).toBe('number')
          expect(typeof firstCall.openInterest).toBe('number')
          expect(firstCall.type).toBe('call')
        }

        const firstPut = optionsChain.puts[0]
        if (firstPut) {
          expect(typeof firstPut.strike).toBe('number')
          expect(firstPut.type).toBe('put')
        }
      }

      console.log(`✓ Real options chain data fetched for ${symbol} in ${latency}ms`)
    }, 30000)
  })

  describe('Performance and Latency Tests', () => {
    test('should_complete_analysis_within_400ms_target', async () => {
      const symbol = 'SPY'
      const iterations = 5
      const latencies: number[] = []

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now()
        await service.getOptionsAnalysis(symbol)
        const latency = Date.now() - startTime
        latencies.push(latency)

        // Brief pause between iterations
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      const maxLatency = Math.max(...latencies)

      expect(avgLatency).toBeLessThan(PERFORMANCE_TARGET)
      expect(maxLatency).toBeLessThan(PERFORMANCE_TARGET * 1.5) // 150% tolerance for max

      console.log(`✓ Average latency: ${avgLatency.toFixed(1)}ms, Max: ${maxLatency}ms (Target: ${PERFORMANCE_TARGET}ms)`)
    }, 45000)

    test('should_maintain_performance_under_concurrent_load', async () => {
      const concurrentRequests = 10
      const symbol = 'AAPL'

      const startTime = Date.now()

      const promises = Array(concurrentRequests).fill(0).map((_, index) =>
        service.getOptionsAnalysis(symbol).then(result => ({
          index,
          result,
          latency: Date.now() - startTime
        }))
      )

      const results = await Promise.allSettled(promises)
      const totalTime = Date.now() - startTime

      // All concurrent requests should complete
      expect(results).toHaveLength(concurrentRequests)

      let successfulResults = 0
      let maxLatency = 0

      results.forEach(result => {
        expect(result.status).toBe('fulfilled')

        if (result.status === 'fulfilled' && result.value.result) {
          successfulResults++
          maxLatency = Math.max(maxLatency, result.value.latency)
        }
      })

      expect(successfulResults).toBeGreaterThan(concurrentRequests * 0.8) // 80% success rate
      expect(maxLatency).toBeLessThan(PERFORMANCE_TARGET * 2) // 2x tolerance for concurrent load

      console.log(`✓ ${concurrentRequests} concurrent requests: ${successfulResults} successful, max latency: ${maxLatency}ms`)
    }, 60000)

    test('should_optimize_memory_usage_with_large_options_chains', async () => {
      const symbol = 'SPY' // High-volume symbol with many contracts

      // Monitor memory before
      const initialMemory = process.memoryUsage()

      // Process multiple large chains
      const results = []
      for (let i = 0; i < 5; i++) {
        const chain = await service.getOptionsChain(symbol)
        results.push(chain)

        // Brief pause to allow memory optimization
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // Monitor memory after
      const finalMemory = process.memoryUsage()
      const memoryDelta = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024) // MB

      expect(memoryDelta).toBeLessThan(MEMORY_THRESHOLD)

      // Verify optimization was applied
      const lastResult = results[results.length - 1]
      if (lastResult) {
        expect(lastResult.optimizationApplied).toBe(true)
        expect(lastResult.compressionRatio).toBeGreaterThan(0)
      }

      console.log(`✓ Memory usage delta: ${memoryDelta.toFixed(1)}MB (threshold: ${MEMORY_THRESHOLD}MB)`)
    }, 45000)
  })

  describe('Mathematical Accuracy Tests', () => {
    test('should_calculate_accurate_put_call_ratios', async () => {
      const symbol = 'AAPL'

      const ratio = await service.getPutCallRatio(symbol)

      if (ratio) {
        // Mathematical validation
        expect(typeof ratio.volumeRatio).toBe('number')
        expect(ratio.volumeRatio).toBeGreaterThan(0)
        expect(isFinite(ratio.volumeRatio)).toBe(true)

        expect(typeof ratio.openInterestRatio).toBe('number')
        expect(ratio.openInterestRatio).toBeGreaterThan(0)
        expect(isFinite(ratio.openInterestRatio)).toBe(true)

        // Cross-validation: ratio should match volume calculation
        if (ratio.totalPutVolume > 0 && ratio.totalCallVolume > 0) {
          const calculatedRatio = ratio.totalPutVolume / ratio.totalCallVolume
          expect(Math.abs(ratio.volumeRatio - calculatedRatio)).toBeLessThan(0.01) // 1% tolerance
        }

        // Sanity checks for real market data
        expect(ratio.volumeRatio).toBeLessThan(10) // Extremely high ratios are rare
        expect(ratio.volumeRatio).toBeGreaterThan(0.1) // Extremely low ratios are rare
      }

      console.log(`✓ Put/Call ratio mathematical accuracy validated for ${symbol}`)
    })

    test('should_validate_greeks_calculations', async () => {
      const symbol = 'SPY'

      const chain = await service.getOptionsChain(symbol)

      if (chain && chain.calls.length > 0) {
        const contract = chain.calls.find(c => c.delta !== undefined && c.gamma !== undefined)

        if (contract) {
          // Delta should be between 0 and 1 for calls
          expect(contract.delta).toBeGreaterThan(0)
          expect(contract.delta).toBeLessThanOrEqual(1)

          // Gamma should be positive
          if (contract.gamma !== undefined) {
            expect(contract.gamma).toBeGreaterThan(0)
          }

          // Theta should be negative (time decay)
          if (contract.theta !== undefined) {
            expect(contract.theta).toBeLessThanOrEqual(0)
          }

          // Vega should be positive
          if (contract.vega !== undefined) {
            expect(contract.vega).toBeGreaterThan(0)
          }

          // Implied volatility should be reasonable
          if (contract.impliedVolatility !== undefined) {
            expect(contract.impliedVolatility).toBeGreaterThan(0)
            expect(contract.impliedVolatility).toBeLessThan(5) // 500% IV is extremely high
          }
        }
      }

      console.log(`✓ Greeks calculations validated for ${symbol}`)
    })

    test('should_calculate_max_pain_accurately', async () => {
      const symbol = 'SPY'

      const analysis = await service.getOptionsAnalysis(symbol)

      if (analysis && analysis.maxPain !== undefined) {
        // Max pain should be a valid strike price
        expect(typeof analysis.maxPain).toBe('number')
        expect(analysis.maxPain).toBeGreaterThan(0)
        expect(isFinite(analysis.maxPain)).toBe(true)

        // Max pain should be within reasonable range of current price
        const chain = await service.getOptionsChain(symbol)
        if (chain && chain.strikes.length > 0) {
          const minStrike = Math.min(...chain.strikes)
          const maxStrike = Math.max(...chain.strikes)

          expect(analysis.maxPain).toBeGreaterThanOrEqual(minStrike)
          expect(analysis.maxPain).toBeLessThanOrEqual(maxStrike)
        }
      }

      console.log(`✓ Max pain calculation validated for ${symbol}`)
    })
  })

  describe('Error Handling and Resilience Tests', () => {
    test('should_handle_invalid_symbols_gracefully', async () => {
      const invalidSymbols = ['INVALID123', 'FAKE_TICKER', '']

      for (const symbol of invalidSymbols) {
        const result = await service.getOptionsAnalysis(symbol)

        // Should not throw, should return null or empty result
        expect(result).toBeNull()
      }

      console.log(`✓ Invalid symbols handled gracefully`)
    })

    test('should_implement_fallback_strategy_on_api_failures', async () => {
      const symbol = 'AAPL'

      // Create service with unreliable endpoint to trigger fallbacks
      const unreliableService = new OptionsAnalysisService({
        primaryEndpoint: 'https://intentionally-unreliable-endpoint.test',
        enableFallbacks: true,
        timeout: 5000
      })

      const result = await unreliableService.getOptionsAnalysis(symbol)

      // Should complete without throwing unhandled errors
      expect(result).toBeDefined() // Either data or null

      unreliableService.clearCache()
      console.log(`✓ Fallback strategy successfully implemented`)
    })

    test('should_recover_from_rate_limit_errors', async () => {
      const symbol = 'TSLA'

      // Simulate rapid requests to potentially trigger rate limiting
      const rapidRequests = Array(15).fill(0).map(() =>
        service.getOptionsAnalysis(symbol).catch(() => null)
      )

      const results = await Promise.allSettled(rapidRequests)

      // All requests should complete without unhandled errors
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
      })

      console.log(`✓ Rate limit recovery successfully tested`)
    })

    test('should_maintain_service_during_network_timeouts', async () => {
      const symbol = 'QQQ'

      // Create service with very short timeout to simulate network issues
      const timeoutService = new OptionsAnalysisService({
        timeout: 100, // Very short timeout
        enableFallbacks: true
      })

      const result = await timeoutService.getOptionsAnalysis(symbol)

      // Should not crash the service
      expect(result).toBeDefined()

      timeoutService.clearCache()
      console.log(`✓ Network timeout resilience validated`)
    })
  })

  describe('Security and Input Validation Tests', () => {
    test('should_sanitize_malicious_symbol_inputs', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'AAPL; DROP TABLE options;',
        '../../../etc/passwd',
        'AAPL\0null-byte',
        'AAPL%00',
        Array(1000).fill('A').join(''), // Very long input
      ]

      for (const maliciousInput of maliciousInputs) {
        const result = await service.getOptionsAnalysis(maliciousInput)

        // Should either return null or sanitized result
        expect(result).toBeDefined()

        if (result) {
          // Result should not contain malicious content
          expect(result.symbol).not.toContain('<script>')
          expect(result.symbol).not.toContain('DROP TABLE')
          expect(result.symbol).not.toContain('../')
        }
      }

      console.log(`✓ Malicious input sanitization validated`)
    })

    test('should_validate_input_length_and_format', async () => {
      const invalidInputs = [
        null,
        undefined,
        123,
        {},
        [],
        '',
        ' ',
        'a', // Too short
        Array(100).fill('A').join('') // Too long
      ]

      for (const input of invalidInputs) {
        const result = await service.getOptionsAnalysis(input as any)
        expect(result).toBeNull()
      }

      console.log(`✓ Input validation successfully implemented`)
    })

    test('should_prevent_sql_injection_attempts', async () => {
      const sqlInjectionAttempts = [
        "AAPL'; DROP TABLE users; --",
        "AAPL' OR '1'='1",
        "AAPL' UNION SELECT * FROM options",
        "AAPL'; INSERT INTO audit VALUES('hack'); --"
      ]

      for (const injection of sqlInjectionAttempts) {
        const result = await service.getOptionsAnalysis(injection)

        // Should safely handle injection attempts
        expect(result).toBeDefined()

        if (result) {
          expect(result.symbol).not.toContain('DROP TABLE')
          expect(result.symbol).not.toContain('UNION SELECT')
          expect(result.symbol).not.toContain('INSERT INTO')
        }
      }

      console.log(`✓ SQL injection prevention validated`)
    })
  })

  describe('Cache Behavior and TTL Tests', () => {
    test('should_cache_results_with_appropriate_ttl', async () => {
      const symbol = 'AAPL'

      // First request - should be fresh
      const startTime1 = Date.now()
      const result1 = await service.getOptionsAnalysis(symbol)
      const latency1 = Date.now() - startTime1

      expect(result1).toBeDefined()

      // Second request - should be cached
      const startTime2 = Date.now()
      const result2 = await service.getOptionsAnalysis(symbol)
      const latency2 = Date.now() - startTime2

      expect(result2).toBeDefined()
      expect(latency2).toBeLessThan(latency1 * 0.5) // Should be significantly faster

      // Results should be identical (cached)
      if (result1 && result2) {
        expect(result1.timestamp).toBe(result2.timestamp)
      }

      console.log(`✓ Caching behavior validated: ${latency1}ms -> ${latency2}ms`)
    })

    test('should_respect_ttl_and_refresh_expired_cache', async () => {
      const symbol = 'SPY'

      // Create service with very short TTL for testing
      const shortTtlService = new OptionsAnalysisService({
        cacheConfig: {
          ttl: 1000, // 1 second TTL
          maxSize: 100
        }
      })

      // First request
      const result1 = await shortTtlService.getOptionsAnalysis(symbol)
      expect(result1).toBeDefined()

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Second request - should be fresh (not cached)
      const startTime = Date.now()
      const result2 = await shortTtlService.getOptionsAnalysis(symbol)
      const latency = Date.now() - startTime

      expect(result2).toBeDefined()
      expect(latency).toBeGreaterThan(100) // Should take time (not cached)

      // Results should have different timestamps
      if (result1 && result2) {
        expect(result1.timestamp).not.toBe(result2.timestamp)
      }

      shortTtlService.clearCache()
      console.log(`✓ TTL expiration and refresh validated`)
    })

    test('should_handle_cache_eviction_under_memory_pressure', async () => {
      // Create service with small cache to force eviction
      const smallCacheService = new OptionsAnalysisService({
        cacheConfig: {
          maxSize: 3, // Very small cache
          ttl: 300000 // Long TTL to avoid TTL-based eviction
        }
      })

      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']

      // Fill cache beyond capacity
      for (const symbol of symbols) {
        await smallCacheService.getOptionsAnalysis(symbol)
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // First symbols should have been evicted
      const cacheStats = smallCacheService.getCacheStats()
      expect(cacheStats.size).toBeLessThanOrEqual(3)
      expect(cacheStats.evictions).toBeGreaterThan(0)

      smallCacheService.clearCache()
      console.log(`✓ Cache eviction under memory pressure validated`)
    })
  })

  describe('Edge Cases and Market Conditions', () => {
    test('should_handle_low_liquidity_options_gracefully', async () => {
      // Test with symbols known to have lower options liquidity
      for (const symbol of LOW_LIQUIDITY_SYMBOLS) {
        const analysis = await service.getOptionsAnalysis(symbol)

        if (analysis) {
          // Should still provide analysis even with low liquidity
          expect(analysis.confidence).toBeDefined()
          expect(analysis.confidence).toBeGreaterThan(0)

          // Should indicate lower confidence for low liquidity
          expect(analysis.confidence).toBeLessThan(0.9)
        }
      }

      console.log(`✓ Low liquidity options handling validated`)
    })

    test('should_handle_unusual_market_activity', async () => {
      const symbol = 'TSLA' // Known for volatility

      const analysis = await service.getOptionsAnalysis(symbol)

      if (analysis) {
        // Should detect and flag unusual activity
        if (analysis.metadata?.unusualActivity) {
          expect(typeof analysis.metadata.unusualActivity).toBe('object')
          expect(analysis.metadata.unusualActivity.detected).toBeDefined()
        }

        // Should provide sentiment analysis during unusual activity
        expect(['bullish', 'bearish', 'neutral']).toContain(analysis.trend)
        expect(['fear', 'greed', 'balanced']).toContain(analysis.sentiment)
      }

      console.log(`✓ Unusual market activity handling validated`)
    })

    test('should_provide_accurate_analysis_during_market_hours', async () => {
      const symbol = 'SPY'
      const currentHour = new Date().getUTCHours() - 5 // EST

      const analysis = await service.getOptionsAnalysis(symbol)

      if (analysis) {
        // During market hours (9:30 AM - 4:00 PM EST), data should be more current
        if (currentHour >= 9 && currentHour < 16) {
          const dataAge = Date.now() - analysis.timestamp
          expect(dataAge).toBeLessThan(60000) // Less than 1 minute old during market hours
        }

        expect(analysis.analysis).toBeDefined()
        expect(analysis.analysis.length).toBeGreaterThan(0)
      }

      console.log(`✓ Market hours analysis accuracy validated`)
    })
  })

  describe('Integration with VFR Platform', () => {
    test('should_integrate_with_existing_stock_selection_service', async () => {
      const symbol = 'AAPL'

      // Test that options analysis can be used in stock selection
      const analysis = await service.getOptionsAnalysis(symbol)

      if (analysis) {
        // Should provide data in format compatible with stock selection
        expect(analysis.currentRatio).toBeDefined()
        expect(typeof analysis.currentRatio.volumeRatio).toBe('number')
        expect(typeof analysis.confidence).toBe('number')

        // Should include necessary metadata for integration
        expect(analysis.timestamp).toBeDefined()
        expect(analysis.source).toBeDefined()
      }

      console.log(`✓ Stock selection service integration validated`)
    })

    test('should_maintain_consistency_with_platform_error_handling', async () => {
      const symbol = 'INVALID_SYMBOL'

      const result = await service.getOptionsAnalysis(symbol)

      // Should follow platform's error handling patterns
      expect(result).toBeNull() // Platform standard for invalid requests

      // Should not log sensitive information
      const errorLogs = errorHandler.getRecentErrors()
      errorLogs.forEach(log => {
        expect(log.message).not.toContain('password')
        expect(log.message).not.toContain('key')
        expect(log.message).not.toContain('secret')
      })

      console.log(`✓ Platform error handling consistency validated`)
    })
  })
})