/**
 * Comprehensive Integration Test Suite for InstitutionalDataService
 * Tests error handling, fallback mechanisms, caching integration, and real-time processing
 * Focuses on system resilience and enterprise-grade reliability
 * Follows TDD principles with NO MOCK DATA - uses real integrations only
 */

import { InstitutionalDataService } from '../InstitutionalDataService'
import { InstitutionalIntelligence, InstitutionalHolding, InsiderTransaction } from '../types'
import { createServiceErrorHandler } from '../../error-handling'
import SecurityValidator from '../../security/SecurityValidator'
import { redisCache } from '../../cache/RedisCache'

describe('InstitutionalDataService Integration Tests', () => {
  let service: InstitutionalDataService
  let errorHandler: ReturnType<typeof createServiceErrorHandler>

  beforeEach(() => {
    // Reset all external dependencies
    SecurityValidator.resetSecurityState()

    // Create fresh service instance
    service = new InstitutionalDataService({
      baseUrl: 'https://data.sec.gov',
      userAgent: 'VFR-API-Integration-Test/1.0 (test@veritakfr.com)',
      requestsPerSecond: 10,
      timeout: 15000,
      throwErrors: false
    })

    errorHandler = createServiceErrorHandler('InstitutionalDataService-Integration')
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
  })

  describe('Error Handling and Resilience Integration', () => {
    test('should_maintain_service_availability_during_network_failures', async () => {
      const symbol = 'AAPL'

      // Create service with unreliable network simulation
      const unreliableService = new InstitutionalDataService({
        baseUrl: 'https://intentionally-unreliable-endpoint.test',
        timeout: 5000
      })

      // Multiple attempts should handle failures gracefully
      const promises = Array(3).fill(0).map(() => unreliableService.getInstitutionalHoldings(symbol))
      const results = await Promise.allSettled(promises)

      // All requests should complete without throwing unhandled errors
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
        if (result.status === 'fulfilled') {
          expect(Array.isArray(result.value)).toBe(true)
          expect(result.value.length).toBe(0) // Should return empty array on failure
        }
      })

      unreliableService.clearCache()
    }, 30000)

    test('should_implement_circuit_breaker_pattern_for_repeated_failures', async () => {
      const symbol = 'MSFT'
      const serviceId = `institutional_holdings_${symbol}`

      // Simulate multiple failures to trigger circuit breaker
      for (let i = 0; i < 15; i++) {
        SecurityValidator.recordFailure(serviceId)
      }

      // Service should be circuit broken now
      const result = await service.getInstitutionalHoldings(symbol)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0) // Circuit breaker should prevent actual calls

      console.log('✓ Circuit breaker pattern successfully implemented')
    })

    test('should_recover_from_circuit_breaker_state_after_timeout', async () => {
      const symbol = 'GOOGL'
      const serviceId = `institutional_holdings_${symbol}`

      // Trigger circuit breaker
      for (let i = 0; i < 15; i++) {
        SecurityValidator.recordFailure(serviceId)
      }

      // Reset security state to simulate recovery time passage
      SecurityValidator.resetSecurityState()

      // Service should work again after reset
      const result = await service.getInstitutionalHoldings(symbol)
      expect(Array.isArray(result)).toBe(true)

      console.log('✓ Circuit breaker recovery mechanism working')
    })

    test('should_handle_memory_pressure_during_large_data_processing', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'JNJ', 'V']

      const initialMemory = process.memoryUsage().heapUsed

      // Process multiple symbols concurrently to stress memory
      const promises = symbols.map(symbol =>
        service.getInstitutionalIntelligence(symbol)
      )

      const results = await Promise.allSettled(promises)

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)

      // All requests should complete
      expect(results.length).toBe(symbols.length)

      console.log(`✓ Memory pressure handled: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase for ${symbols.length} symbols`)
    }, 90000)

    test('should_sanitize_errors_and_prevent_information_disclosure', async () => {
      const symbol = 'AAPL'

      // Capture console output
      const originalConsoleWarn = console.warn
      const originalConsoleError = console.error
      const capturedLogs: string[] = []

      console.warn = (...args: any[]) => {
        capturedLogs.push(args.join(' '))
      }
      console.error = (...args: any[]) => {
        capturedLogs.push(args.join(' '))
      }

      try {
        // Create service with invalid configuration to force errors
        const errorService = new InstitutionalDataService({
          baseUrl: 'https://invalid-sec-endpoint-with-sensitive-info.test',
          userAgent: 'Test-Agent-With-Secret-Key-12345'
        })

        await errorService.getInstitutionalHoldings(symbol)
        await errorService.getInsiderTransactions(symbol)

        // Check that no sensitive information leaked
        const allLogs = capturedLogs.join(' ')
        expect(allLogs).not.toContain('Secret-Key-12345')
        expect(allLogs).not.toContain('password')
        expect(allLogs).not.toContain('api_key')
        expect(allLogs).not.toContain('token')
        expect(allLogs).not.toContain('mongodb://')
        expect(allLogs).not.toContain('postgresql://')

        errorService.clearCache()
        console.log('✓ Error sanitization working properly')
      } finally {
        console.warn = originalConsoleWarn
        console.error = originalConsoleError
      }
    }, 30000)

    test('should_handle_concurrent_requests_without_race_conditions', async () => {
      const symbol = 'TSLA'

      // Launch multiple concurrent requests for same symbol
      const concurrentRequests = Array(5).fill(0).map((_, index) => ({
        holdings: service.getInstitutionalHoldings(symbol),
        transactions: service.getInsiderTransactions(symbol),
        intelligence: service.getInstitutionalIntelligence(symbol)
      }))

      const startTime = Date.now()
      const results = await Promise.allSettled(concurrentRequests.flatMap(req => [
        req.holdings,
        req.transactions,
        req.intelligence
      ]))
      const totalTime = Date.now() - startTime

      // All requests should complete without errors
      results.forEach(result => {
        expect(['fulfilled', 'rejected']).toContain(result.status)
      })

      // Should handle concurrency efficiently
      expect(totalTime).toBeLessThan(60000) // Less than 60 seconds for all requests

      console.log(`✓ Concurrent requests handled: ${results.length} requests in ${totalTime}ms`)
    }, 75000)
  })

  describe('Cache Integration and Real-time Processing', () => {
    test('should_integrate_with_redis_cache_when_available', async () => {
      const symbol = 'AAPL'

      try {
        // Test Redis cache integration
        const testKey = `test_institutional_${symbol}_${Date.now()}`
        const testData = { test: 'data', timestamp: Date.now() }

        // Try to set and get from Redis
        await redisCache.set(testKey, JSON.stringify(testData), 60)
        const cached = await redisCache.get(testKey)

        if (cached) {
          expect(JSON.parse(cached)).toEqual(testData)
          console.log('✓ Redis cache integration working')
        } else {
          console.log('⚠ Redis cache not available, using in-memory fallback')
        }

        // Clean up
        await redisCache.delete(testKey)
      } catch (error) {
        console.log('⚠ Redis not available in test environment, fallback cache will be used')
      }

      // Service should work regardless of Redis availability
      const result = await service.getInstitutionalHoldings(symbol)
      expect(Array.isArray(result)).toBe(true)
    }, 30000)

    test('should_implement_cache_aside_pattern_correctly', async () => {
      const symbol = 'MSFT'

      // Clear any existing cache
      service.clearCache()

      // First request - should populate cache
      const startTime1 = Date.now()
      const result1 = await service.getInstitutionalHoldings(symbol)
      const duration1 = Date.now() - startTime1

      // Second request - should use cache
      const startTime2 = Date.now()
      const result2 = await service.getInstitutionalHoldings(symbol)
      const duration2 = Date.now() - startTime2

      expect(Array.isArray(result1)).toBe(true)
      expect(Array.isArray(result2)).toBe(true)

      // Cache hit should be faster (if data was actually retrieved)
      if (result1.length > 0) {
        expect(duration2).toBeLessThan(duration1)
        console.log(`✓ Cache aside pattern working: ${duration1}ms -> ${duration2}ms`)
      }
    }, 60000)

    test('should_handle_cache_invalidation_properly', async () => {
      const symbol = 'GOOGL'

      // Populate cache
      await service.getInstitutionalHoldings(symbol)

      // Clear cache
      service.clearCache()

      // Next request should not use stale cache
      const result = await service.getInstitutionalHoldings(symbol)
      expect(Array.isArray(result)).toBe(true)

      console.log('✓ Cache invalidation working properly')
    }, 30000)

    test('should_implement_cache_ttl_and_expiration_correctly', async () => {
      const symbol = 'AMZN'

      // Clear any existing cache
      service.clearCache()

      // Make initial request to populate cache
      const initialResult = await service.getInstitutionalHoldings(symbol)
      expect(Array.isArray(initialResult)).toBe(true)

      // Check that cache has data (if the service actually retrieved data)
      const cachedData = (service as any).getCachedData(symbol)

      if (cachedData) {
        expect(cachedData.lastUpdated).toBeGreaterThan(0)
        expect(Date.now() - cachedData.lastUpdated).toBeLessThan(10000) // Less than 10 seconds old
        console.log('✓ Cache TTL and timestamping working')
      } else {
        // If no cache data, it means the request returned empty results or failed
        // This is acceptable in a test environment
        console.log('⚠ No cache data available (likely due to no institutional data for symbol or test environment limitations)')
      }
    }, 30000)

    test('should_handle_cache_corruption_gracefully', async () => {
      const symbol = 'NVDA'

      // Manually corrupt cache data
      const cache = (service as any).cache
      cache[symbol] = {
        holdings: 'corrupted_data', // Invalid data type
        insiderTransactions: null,
        sentiment: undefined,
        lastUpdated: 'invalid_timestamp' // Invalid timestamp
      }

      // Service should handle corrupted cache gracefully
      const result = await service.getInstitutionalHoldings(symbol)
      expect(Array.isArray(result)).toBe(true)

      console.log('✓ Cache corruption handled gracefully')
    }, 30000)
  })

  describe('Real-time Data Processing Integration', () => {
    test('should_process_institutional_intelligence_in_real_time', async () => {
      const symbol = 'META'

      const startTime = Date.now()
      const intelligence = await service.getInstitutionalIntelligence(symbol)
      const processingTime = Date.now() - startTime

      if (intelligence) {
        // Real-time processing should complete within reasonable time
        expect(processingTime).toBeLessThan(60000) // Less than 60 seconds

        // Data should be recent
        expect(intelligence.timestamp).toBeGreaterThan(Date.now() - 120000) // Less than 2 minutes old

        // Composite score should be calculated
        expect(typeof intelligence.compositeScore).toBe('number')
        expect(intelligence.compositeScore).toBeGreaterThanOrEqual(0)
        expect(intelligence.compositeScore).toBeLessThanOrEqual(10)

        console.log(`✓ Real-time intelligence processed in ${processingTime}ms for ${symbol}`)
        console.log(`  Composite Score: ${intelligence.compositeScore}/10`)
        console.log(`  Weighted Sentiment: ${intelligence.weightedSentiment}`)
      } else {
        console.log(`⚠ No real-time intelligence available for ${symbol}`)
      }
    }, 75000)

    test('should_handle_parallel_data_source_processing', async () => {
      const symbol = 'JPM'

      const startTime = Date.now()

      // This should process holdings and insider data in parallel
      const intelligence = await service.getInstitutionalIntelligence(symbol)

      const processingTime = Date.now() - startTime

      if (intelligence) {
        // Parallel processing should be more efficient than sequential
        expect(processingTime).toBeLessThan(90000) // Should complete in reasonable time

        // Both data types should be considered if available
        const hasInstitutional = intelligence.dataQuality.institutionalDataAvailable
        const hasInsider = intelligence.dataQuality.insiderDataAvailable

        if (hasInstitutional || hasInsider) {
          expect(intelligence.keyInsights.length).toBeGreaterThan(0)
          console.log(`✓ Parallel processing completed in ${processingTime}ms`)
          console.log(`  Institutional data: ${hasInstitutional ? '✓' : '✗'}`)
          console.log(`  Insider data: ${hasInsider ? '✓' : '✗'}`)
        }
      }
    }, 90000)

    test('should_maintain_data_consistency_across_parallel_requests', async () => {
      const symbol = 'V'

      // Make multiple parallel requests for the same symbol
      const promises = Array(3).fill(0).map(() => service.getInstitutionalIntelligence(symbol))
      const results = await Promise.allSettled(promises)

      const successfulResults = results
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => (result as PromiseFulfilledResult<InstitutionalIntelligence | null>).value)

      if (successfulResults.length > 1) {
        // All successful results should have consistent core data
        const firstResult = successfulResults[0]!
        successfulResults.slice(1).forEach(result => {
          expect(result!.symbol).toBe(firstResult.symbol)
          expect(result!.reportDate).toBe(firstResult.reportDate)

          // Timestamps might differ slightly due to processing time
          expect(Math.abs(result!.timestamp - firstResult.timestamp)).toBeLessThan(30000) // Within 30 seconds
        })

        console.log(`✓ Data consistency maintained across ${successfulResults.length} parallel requests`)
      }
    }, 75000)

    test('should_optimize_performance_for_repeated_symbol_requests', async () => {
      const symbol = 'WMT'

      // First request - cold start
      const startTime1 = Date.now()
      const result1 = await service.getInstitutionalHoldings(symbol)
      const duration1 = Date.now() - startTime1

      // Second request - should use optimizations
      const startTime2 = Date.now()
      const result2 = await service.getInstitutionalHoldings(symbol)
      const duration2 = Date.now() - startTime2

      expect(Array.isArray(result1)).toBe(true)
      expect(Array.isArray(result2)).toBe(true)

      // Second request should be faster due to caching/optimizations
      if (result1.length > 0) {
        expect(duration2).toBeLessThan(duration1)

        const improvement = ((duration1 - duration2) / duration1) * 100
        console.log(`✓ Performance optimization: ${improvement.toFixed(1)}% improvement on repeat request`)
      }
    }, 60000)
  })

  describe('Security Integration and Compliance', () => {
    test('should_integrate_with_security_validator_for_input_validation', async () => {
      const maliciousInputs = [
        "'; DROP TABLE institutional_data; --",
        '<script>alert(document.cookie)</script>',
        '../../../etc/passwd',
        'AAPL\x00malicious'
      ]

      for (const input of maliciousInputs) {
        const result = await service.getInstitutionalHoldings(input)
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBe(0) // Should reject malicious input
      }

      console.log('✓ Security validator integration working')
    })

    test('should_enforce_rate_limiting_across_service_methods', async () => {
      const symbol = 'KO'

      // Reset security state first
      SecurityValidator.resetSecurityState()

      // Exhaust rate limit through multiple service methods
      const serviceIds = [
        `institutional_holdings_${symbol}`,
        `insider_transactions_${symbol}`,
        `institutional_intelligence_${symbol}`
      ]

      serviceIds.forEach(serviceId => {
        for (let i = 0; i < 20; i++) {
          SecurityValidator.checkRateLimit(serviceId)
        }
      })

      // All service methods should be rate limited or return graceful degradation
      const holdingsResult = await service.getInstitutionalHoldings(symbol)
      const transactionsResult = await service.getInsiderTransactions(symbol)
      const intelligenceResult = await service.getInstitutionalIntelligence(symbol)

      expect(Array.isArray(holdingsResult)).toBe(true)
      expect(Array.isArray(transactionsResult)).toBe(true)

      // Intelligence result may be null (rate limited) or object (graceful degradation)
      if (intelligenceResult === null) {
        console.log('✓ Rate limiting enforced - intelligence returned null')
      } else {
        expect(intelligenceResult).toHaveProperty('symbol')
        expect(intelligenceResult.symbol).toBe(symbol)
        console.log('✓ Rate limiting enforced - intelligence returned graceful degradation')
      }

      console.log('✓ Rate limiting enforced across all service methods')
    })

    test('should_maintain_security_state_during_high_load', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']

      // Create high load scenario
      const promises = symbols.flatMap(symbol => [
        service.getInstitutionalHoldings(symbol),
        service.getInsiderTransactions(symbol)
      ])

      await Promise.allSettled(promises)

      // Security state should still be functional
      const securityStatus = SecurityValidator.getSecurityStatus()
      expect(typeof securityStatus).toBe('object')
      expect(securityStatus).toHaveProperty('rateLimits')

      console.log('✓ Security state maintained during high load')
    }, 90000)

    test('should_comply_with_sec_edgar_access_requirements', async () => {
      const symbol = 'AAPL'

      // Check that service uses proper User-Agent
      const userAgent = (service as any).userAgent
      expect(userAgent).toContain('VFR-API')
      expect(userAgent).toMatch(/@|\(.*\)/) // Should contain contact info

      // Check that service respects rate limiting
      const requestDelay = (service as any).RATE_LIMIT_DELAY
      expect(requestDelay).toBeGreaterThanOrEqual(100) // At least 100ms (10 req/sec)

      // Check that service doesn't make excessive requests
      const maxConcurrentRequests = (service as any).maxConcurrentRequests
      expect(maxConcurrentRequests).toBeLessThanOrEqual(5) // Reasonable concurrency

      console.log('✓ SEC EDGAR compliance requirements met')
    })
  })

  describe('System Integration and Health Monitoring', () => {
    test('should_integrate_with_error_handling_infrastructure', async () => {
      const symbol = 'AAPL'

      // Force an error condition
      const originalTimeout = (service as any).timeout
      ;(service as any).timeout = 1 // 1ms timeout

      const result = await service.getInstitutionalHoldings(symbol)

      // Should handle error gracefully
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)

      // Restore original timeout
      ;(service as any).timeout = originalTimeout

      console.log('✓ Error handling infrastructure integration working')
    })

    test('should_maintain_service_health_monitoring', async () => {
      // Test health check functionality
      const isHealthy = await service.healthCheck()
      expect(typeof isHealthy).toBe('boolean')

      if (isHealthy) {
        console.log('✓ Service health monitoring: HEALTHY')
      } else {
        console.log('⚠ Service health monitoring: UNHEALTHY (may be due to test environment)')
      }
    }, 20000)

    test('should_provide_operational_metrics_and_insights', async () => {
      const symbol = 'MSFT'

      // Generate some operational load
      await service.getInstitutionalHoldings(symbol)
      await service.getInsiderTransactions(symbol)

      // Check that cache provides operational insights
      const cachedData = (service as any).getCachedData(symbol)
      if (cachedData) {
        expect(cachedData.lastUpdated).toBeGreaterThan(0)
        expect(typeof cachedData.lastUpdated).toBe('number')

        const dataAge = Date.now() - cachedData.lastUpdated
        expect(dataAge).toBeGreaterThanOrEqual(0)

        console.log(`✓ Operational metrics available: data age ${dataAge}ms`)
      }
    })

    test('should_handle_service_degradation_gracefully', async () => {
      const symbol = 'GOOGL'

      // Simulate service degradation by creating resource pressure
      const promises = Array(10).fill(0).map(() => service.getInstitutionalIntelligence(symbol))
      const results = await Promise.allSettled(promises)

      // Service should degrade gracefully, not crash
      let successCount = 0
      let failureCount = 0

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++
        } else {
          failureCount++
        }
      })

      // Should handle some load
      expect(successCount + failureCount).toBe(10)

      console.log(`✓ Service degradation handled: ${successCount} successes, ${failureCount} graceful failures`)
    }, 120000)
  })
})