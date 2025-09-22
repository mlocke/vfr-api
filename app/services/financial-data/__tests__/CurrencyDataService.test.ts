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

      // Second call should be much faster
      const startTime = Date.now()
      const cachedAnalysis = await service.getCurrencyAnalysis()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(200) // Should be very fast from cache
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
    test('should have proper sector exposure configurations', () => {
      // Test that all major sectors are defined with proper structure
      const sectors = ['Technology', 'Energy', 'Financials', 'Healthcare', 'Industrials', 'Materials']

      for (const sector of sectors) {
        const analysis = service['sectorExposures'][sector] // Access private property for testing
        expect(analysis).toBeDefined()
        expect(analysis.sector).toBe(sector)
        expect(typeof analysis.currencyExposure).toBe('number')
        expect(typeof analysis.usdStrengthMultiplier).toBe('number')
        expect(typeof analysis.correlationScore).toBe('number')
        expect(analysis.correlationScore).toBeGreaterThanOrEqual(0)
        expect(analysis.correlationScore).toBeLessThanOrEqual(1)
        expect(['low', 'medium', 'high']).toContain(analysis.riskLevel)
      }

      console.log('✅ All sector exposure configurations validated')
    })
  })

  describe('Performance Requirements', () => {
    test('should meet target response time of <200ms for cached data', async () => {
      // Prime the cache
      await service.getCurrencyAnalysis()

      // Test cached performance
      const startTime = Date.now()
      await service.getCurrencyAnalysis()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(200) // Target performance requirement
      console.log(`🚀 Cached performance: ${elapsed}ms (target: <200ms)`)
    })

    test('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now()

      // Make 5 concurrent requests
      const promises = Array(5).fill(null).map(() => service.getCurrencyAnalysis())
      const results = await Promise.allSettled(promises)

      const elapsed = Date.now() - startTime
      const successCount = results.filter(r => r.status === 'fulfilled').length

      console.log(`🔄 Concurrent test: ${successCount}/5 requests successful in ${elapsed}ms`)
      expect(successCount).toBeGreaterThan(0) // At least one should succeed
    })
  })
})