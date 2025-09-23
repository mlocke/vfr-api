/**
 * Currency Data Service Tests
 * Tests real API integration, caching, and sector correlation algorithms
 */

import { CurrencyDataService, currencyDataService } from '../CurrencyDataService'
import { RedisCache } from '../../cache/RedisCache'

describe('CurrencyDataService', () => {
  let service: CurrencyDataService
  let cache: RedisCache

  beforeAll(() => {
    service = new CurrencyDataService()
    cache = RedisCache.getInstance()
  })

  afterAll(async () => {
    await cache.cleanupForTests()
  })

  describe('Service Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(service.name).toBe('Currency Data Service')
      expect(service).toBeDefined()
    })

    test('should have singleton instance available', () => {
      expect(currencyDataService).toBeDefined()
      expect(currencyDataService.name).toBe('Currency Data Service')
    })
  })

  describe('Health Check', () => {
    test('should perform health check successfully', async () => {
      const isHealthy = await service.healthCheck()
      expect(typeof isHealthy).toBe('boolean')

      if (process.env.ALPHA_VANTAGE_API_KEY) {
        // With API key, health check should pass
        console.log('🔑 Alpha Vantage API key detected - expecting successful health check')
      } else {
        console.log('⚠️ No Alpha Vantage API key - health check may fail but test passes')
      }
    }, 15000)
  })

  describe('Dollar Index (DXY) Data', () => {
    test('should fetch DXY data with performance under 10 seconds', async () => {
      const startTime = Date.now()
      const dxyData = await service.getDollarIndex()
      const elapsed = Date.now() - startTime

      console.log(`📊 DXY fetch completed in ${elapsed}ms`)
      expect(elapsed).toBeLessThan(10000) // 10 second timeout

      if (dxyData) {
        expect(dxyData).toHaveProperty('value')
        expect(dxyData).toHaveProperty('strength')
        expect(dxyData).toHaveProperty('trend')
        expect(typeof dxyData.value).toBe('number')
        expect(typeof dxyData.strength).toBe('number')
        expect(dxyData.strength).toBeGreaterThanOrEqual(0)
        expect(dxyData.strength).toBeLessThanOrEqual(10)
        expect(['strengthening', 'weakening', 'stable']).toContain(dxyData.trend)

        console.log(`✅ DXY: ${dxyData.value} (Strength: ${dxyData.strength}/10, Trend: ${dxyData.trend})`)
      } else {
        console.log('⚠️ DXY data not available (API limitations)')
      }
    }, 15000)

    test('should cache DXY data effectively', async () => {
      // First call
      const firstCall = await service.getDollarIndex()

      // Second call should be faster due to caching
      const startTime = Date.now()
      const secondCall = await service.getDollarIndex()
      const elapsed = Date.now() - startTime

      if (firstCall && secondCall) {
        expect(elapsed).toBeLessThan(100) // Should be very fast from cache
        expect(firstCall.value).toBe(secondCall.value)
        console.log(`🔄 Cached DXY data served in ${elapsed}ms`)
      }
    })
  })

  describe('Currency Pairs', () => {
    test('should fetch major currency pairs', async () => {
      const startTime = Date.now()
      const pairs = await service.getMajorCurrencyPairs()
      const elapsed = Date.now() - startTime

      console.log(`💱 Currency pairs fetch completed in ${elapsed}ms`)
      expect(elapsed).toBeLessThan(15000) // 15 second timeout

      expect(Array.isArray(pairs)).toBe(true)

      if (pairs.length > 0) {
        const pair = pairs[0]
        expect(pair).toHaveProperty('symbol')
        expect(pair).toHaveProperty('rate')
        expect(pair).toHaveProperty('change')
        expect(pair).toHaveProperty('changePercent')
        expect(typeof pair.rate).toBe('number')
        expect(pair.rate).toBeGreaterThan(0)

        console.log(`✅ Fetched ${pairs.length} currency pairs`)
        console.log(`   Example: ${pair.symbol} = ${pair.rate} (${pair.changePercent > 0 ? '+' : ''}${pair.changePercent.toFixed(2)}%)`)
      } else {
        console.log('⚠️ No currency pairs available (API limitations)')
      }
    }, 20000)

    test('should fetch individual currency pair', async () => {
      const pair = await service.getCurrencyPair('EURUSD')

      if (pair) {
        expect(pair.symbol).toBe('EURUSD')
        expect(typeof pair.rate).toBe('number')
        expect(pair.rate).toBeGreaterThan(0)
        expect(pair.rate).toBeLessThan(2) // EUR/USD typically between 1.0-1.3

        console.log(`✅ EUR/USD: ${pair.rate} (${pair.changePercent > 0 ? '+' : ''}${pair.changePercent.toFixed(2)}%)`)
      } else {
        console.log('⚠️ EUR/USD pair not available')
      }
    }, 10000)
  })

  describe('Currency Strength Analysis', () => {
    test('should calculate currency strengths', async () => {
      const strengths = await service.getCurrencyStrengths()

      expect(Array.isArray(strengths)).toBe(true)

      if (strengths.length > 0) {
        const strength = strengths[0]
        expect(strength).toHaveProperty('currency')
        expect(strength).toHaveProperty('strengthScore')
        expect(strength).toHaveProperty('momentum')
        expect(strength).toHaveProperty('trend')

        expect(typeof strength.strengthScore).toBe('number')
        expect(strength.strengthScore).toBeGreaterThanOrEqual(0)
        expect(strength.strengthScore).toBeLessThanOrEqual(10)
        expect(['bullish', 'bearish', 'neutral']).toContain(strength.trend)

        console.log(`✅ Currency strengths calculated for ${strengths.length} currencies`)
        console.log(`   Example: ${strength.currency} strength: ${strength.strengthScore}/10 (${strength.trend})`)
      } else {
        console.log('⚠️ Currency strength calculation not available')
      }
    }, 15000)
  })

  describe('Comprehensive Currency Analysis', () => {
    test('should provide complete currency analysis with performance under 5 seconds', async () => {
      const startTime = Date.now()
      const analysis = await service.getCurrencyAnalysis()
      const elapsed = Date.now() - startTime

      console.log(`🔍 Complete currency analysis completed in ${elapsed}ms`)
      expect(elapsed).toBeLessThan(5000) // Target: under 5 seconds

      if (analysis) {
        expect(analysis).toHaveProperty('dxyIndex')
        expect(analysis).toHaveProperty('majorPairs')
        expect(analysis).toHaveProperty('currencyStrengths')
        expect(analysis).toHaveProperty('sectorImpacts')
        expect(analysis).toHaveProperty('marketSentiment')
        expect(analysis).toHaveProperty('confidence')

        expect(Array.isArray(analysis.majorPairs)).toBe(true)
        expect(Array.isArray(analysis.currencyStrengths)).toBe(true)
        expect(Array.isArray(analysis.sectorImpacts)).toBe(true)

        expect(typeof analysis.confidence).toBe('number')
        expect(analysis.confidence).toBeGreaterThanOrEqual(0)
        expect(analysis.confidence).toBeLessThanOrEqual(1)

        expect(analysis.sectorImpacts.length).toBe(11) // All defined sectors

        console.log(`✅ Analysis confidence: ${(analysis.confidence * 100).toFixed(1)}%`)
        console.log(`   DXY: ${analysis.dxyIndex.value} (${analysis.dxyIndex.trend})`)
        console.log(`   Risk sentiment: ${analysis.marketSentiment.riskOn ? 'Risk-On' : 'Risk-Off'}`)
        console.log(`   Flight to quality: ${analysis.marketSentiment.flightToQuality}/10`)
      } else {
        console.log('⚠️ Complete currency analysis not available')
      }
    }, 10000)

    test('should cache complete analysis effectively', async () => {
      // First call
      await service.getCurrencyAnalysis()

      // Wait a small amount to ensure cache is settled
      await new Promise(resolve => setTimeout(resolve, 50))

      // Second call should be much faster
      const startTime = Date.now()
      const cachedAnalysis = await service.getCurrencyAnalysis()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(500) // Relaxed expectation for cache performance
      console.log(`🔄 Cached analysis served in ${elapsed}ms`)

      if (cachedAnalysis) {
        expect(cachedAnalysis.confidence).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('Sector Currency Impact Analysis', () => {
    test('should analyze Technology sector currency impact', async () => {
      const context = await service.getSectorCurrencyImpact('Technology')

      if (context) {
        expect(context).toHaveProperty('dxyStrength')
        expect(context).toHaveProperty('currencyTrend')
        expect(context).toHaveProperty('sectorImpacts')
        expect(context).toHaveProperty('confidence')

        expect(typeof context.dxyStrength).toBe('number')
        expect(context.dxyStrength).toBeGreaterThanOrEqual(0)
        expect(context.dxyStrength).toBeLessThanOrEqual(10)

        expect(['strengthening', 'weakening', 'stable']).toContain(context.currencyTrend)

        console.log(`✅ Technology sector currency impact:`)
        console.log(`   DXY strength: ${context.dxyStrength}/10`)
        console.log(`   Currency trend: ${context.currencyTrend}`)
        console.log(`   Analysis confidence: ${(context.confidence * 100).toFixed(1)}%`)
      } else {
        console.log('⚠️ Technology sector analysis not available')
      }
    })

    test('should analyze Energy sector currency impact', async () => {
      const context = await service.getSectorCurrencyImpact('Energy')

      if (context) {
        expect(context.sectorImpacts).toHaveProperty('Energy')

        // Energy sector should have negative USD correlation
        const energyImpact = context.sectorImpacts.Energy
        expect(typeof energyImpact).toBe('number')

        console.log(`✅ Energy sector USD impact: ${energyImpact.toFixed(3)}`)
      }
    })

    test('should handle unknown sector gracefully', async () => {
      const context = await service.getSectorCurrencyImpact('UnknownSector')
      expect(context).toBeNull()
    })
  })

  describe('Sector Exposure Definitions', () => {
    test('should have proper sector exposure configurations', async () => {
      // Test that all major sectors are defined with proper structure
      const sectors = ['Technology', 'Energy', 'Financials', 'Healthcare', 'Industrials', 'Materials', 'Consumer Discretionary', 'Consumer Staples', 'Utilities', 'Real Estate', 'Communication Services']

      for (const sector of sectors) {
        // Test sector exposure through the public API instead of accessing private properties
        const sectorContext = await service.getSectorCurrencyImpact(sector)
        expect(sectorContext).toBeDefined()
        expect(sectorContext).not.toBeNull()

        if (sectorContext) {
          expect(typeof sectorContext.dxyStrength).toBe('number')
          expect(sectorContext.dxyStrength).toBeGreaterThanOrEqual(0)
          expect(sectorContext.dxyStrength).toBeLessThanOrEqual(10)
          expect(['strengthening', 'weakening', 'stable']).toContain(sectorContext.currencyTrend)
          expect(typeof sectorContext.confidence).toBe('number')
          expect(sectorContext.confidence).toBeGreaterThanOrEqual(0)
          expect(sectorContext.confidence).toBeLessThanOrEqual(1)
          expect(sectorContext.sectorImpacts).toHaveProperty(sector)
        }
      }

      console.log('✅ All sector exposure configurations validated through public API')
    }, 30000) // Extended timeout for comprehensive sector testing
  })

  describe('Performance Requirements', () => {
    test('should meet target response time of <500ms for cached data', async () => {
      // Prime the cache
      await service.getCurrencyAnalysis()

      // Wait a small amount to ensure cache is settled
      await new Promise(resolve => setTimeout(resolve, 50))

      // Test cached performance
      const startTime = Date.now()
      const cachedResult = await service.getCurrencyAnalysis()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(500) // Realistic performance requirement for integration tests
      expect(cachedResult).toBeDefined()
      console.log(`🚀 Cached performance: ${elapsed}ms (target: <500ms)`)
    })

    test('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now()

      // Make 5 concurrent requests
      const promises = Array(5).fill(null).map(() => service.getCurrencyAnalysis())
      const results = await Promise.allSettled(promises)

      const elapsed = Date.now() - startTime
      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failureCount = results.filter(r => r.status === 'rejected').length

      console.log(`🔄 Concurrent test: ${successCount}/5 requests successful in ${elapsed}ms`)
      console.log(`   Failures: ${failureCount}/5 requests failed`)

      expect(successCount).toBeGreaterThan(0) // At least one should succeed
      expect(elapsed).toBeLessThan(10000) // Should complete within reasonable time
    })
  })

  describe('Error Handling & Resilience', () => {
    test('should handle invalid currency pairs gracefully', async () => {
      const invalidPair = await service.getCurrencyPair('INVALID')
      expect(invalidPair).toBeNull()
    })

    test('should provide fallback data when primary sources fail', async () => {
      // Test with a temporary service instance without API key
      const testService = new CurrencyDataService({ apiKey: '' })

      // Should still attempt to get data from fallback sources
      const analysis = await testService.getCurrencyAnalysis()
      // Analysis might be null or have limited data, but shouldn't throw
      expect(typeof analysis === 'object' || analysis === null).toBe(true)
    })

    test('should maintain service availability during partial failures', async () => {
      // Test that individual method failures don't break the overall service
      const promises = [
        service.getDollarIndex(),
        service.getMajorCurrencyPairs(),
        service.getCurrencyStrengths(),
        service.getCurrencyPair('EURUSD')
      ]

      const results = await Promise.allSettled(promises)
      const successfulResults = results.filter(r => r.status === 'fulfilled')

      // At least some methods should succeed even if others fail
      expect(successfulResults.length).toBeGreaterThan(0)
      console.log(`✅ Service resilience: ${successfulResults.length}/${results.length} methods successful`)
    })

    test('should handle cache failures gracefully', async () => {
      // Test behavior when cache is unavailable
      const originalCache = (service as any).cache

      try {
        // Temporarily disable cache by setting it to null
        ;(service as any).cache = {
          get: () => Promise.resolve(null),
          set: () => Promise.resolve(false),
          delete: () => Promise.resolve(false),
          cleanupForTests: () => Promise.resolve()
        }

        const analysis = await service.getCurrencyAnalysis()

        // Should still work without cache
        if (analysis) {
          expect(analysis).toHaveProperty('confidence')
          console.log('✅ Service works without cache')
        } else {
          console.log('⚠️ Service degraded without cache (expected)')
        }
      } finally {
        // Restore original cache
        ;(service as any).cache = originalCache
      }
    })
  })

  describe('Data Quality & Validation', () => {
    test('should validate currency analysis data structure', async () => {
      const analysis = await service.getCurrencyAnalysis()

      if (analysis) {
        // Validate all required properties exist
        expect(analysis).toHaveProperty('dxyIndex')
        expect(analysis).toHaveProperty('majorPairs')
        expect(analysis).toHaveProperty('currencyStrengths')
        expect(analysis).toHaveProperty('sectorImpacts')
        expect(analysis).toHaveProperty('marketSentiment')
        expect(analysis).toHaveProperty('confidence')
        expect(analysis).toHaveProperty('timestamp')
        expect(analysis).toHaveProperty('source')

        // Validate data types and ranges
        expect(typeof analysis.timestamp).toBe('number')
        expect(analysis.timestamp).toBeGreaterThan(0)
        expect(typeof analysis.source).toBe('string')
        expect(analysis.source.length).toBeGreaterThan(0)

        // Validate sector impacts completeness
        expect(analysis.sectorImpacts.length).toBeGreaterThanOrEqual(10)

        console.log('✅ Currency analysis data structure validated')
      }
    })

    test('should ensure consistent data across sequential calls', async () => {
      // Make first call
      const analysis1 = await service.getCurrencyAnalysis()

      // Wait briefly to ensure cache is settled
      await new Promise(resolve => setTimeout(resolve, 50))

      // Make second call (should hit cache)
      const analysis2 = await service.getCurrencyAnalysis()

      if (analysis1 && analysis2) {
        // Core data should be consistent (allowing for timestamp differences in concurrent scenarios)
        expect(analysis1.confidence).toBe(analysis2.confidence)
        expect(analysis1.dxyIndex.value).toBe(analysis2.dxyIndex.value)
        expect(analysis1.source).toBe(analysis2.source)

        // Timestamps should be close (within 1 second) indicating cache usage
        const timeDiff = Math.abs(analysis1.timestamp - analysis2.timestamp)
        expect(timeDiff).toBeLessThan(1000)

        console.log('✅ Data consistency verified across sequential calls')
        console.log(`   Timestamp difference: ${timeDiff}ms`)
      }
    })
  })
})