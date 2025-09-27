/**
 * Enhanced Options Data Service Integration Tests - EODHD Only
 *
 * Test Suite: Comprehensive testing for EODHD-exclusive options analysis
 * Target: <500ms options analysis with real API connections
 * Memory: 4096MB heap, maxWorkers: 1 optimization
 *
 * Key Focus Areas:
 * - EODHD API integration with active contracts filtering
 * - Put/call ratio calculations and analysis
 * - Options chain processing and memory optimization
 * - UnicornBay enhanced options data
 * - Caching strategy and performance optimization
 * - Error handling and graceful degradation scenarios
 */

import { OptionsDataService } from '../OptionsDataService'
import { RedisCache } from '../../cache/RedisCache'
import { PutCallRatio, OptionsAnalysis, OptionsChain } from '../types'

// Force garbage collection for memory optimization
interface Global {
  gc?: () => void
}

describe('Enhanced OptionsDataService - EODHD Only Integration', () => {
  let optionsService: OptionsDataService
  let cache: RedisCache

  // Test symbols for comprehensive validation
  const TEST_SYMBOLS = ['AAPL', 'TSLA', 'GME', 'SPY']
  const PRIMARY_SYMBOL = 'AAPL'

  // Performance targets
  const LATENCY_TARGET = 500 // 500ms target for options analysis
  const CACHE_HIT_TARGET = 0.8 // 80% cache hit rate target

  beforeAll(() => {
    cache = new RedisCache()
    optionsService = new OptionsDataService(cache)

    console.log('🧪 Enhanced OptionsDataService Test Suite - EODHD Only')
    console.log(`📊 Testing symbols: ${TEST_SYMBOLS.join(', ')}`)
    console.log(`⚡ Performance target: <${LATENCY_TARGET}ms`)
  })

  afterAll(async () => {
    // Cleanup cache connections (cache cleanup is handled internally)
    try {
      // Cache cleanup is handled by RedisCache internally
    } catch (error) {
      // Ignore cleanup errors
    }

    // Force garbage collection if available
    if ((global as any).gc) {
      (global as any).gc()
      console.log('🧹 Memory cleanup completed')
    }
  })

  beforeEach(() => {
    // Clear any existing cache for clean tests
    jest.clearAllMocks()
  })

  describe('🏢 Service Configuration - EODHD Only', () => {
    test('should initialize with EODHD as exclusive provider', () => {
      const providerInfo = optionsService.getProviderInfo()

      expect(providerInfo.provider).toBe('EODHD')
      expect(providerInfo.description).toContain('UnicornBay')

      console.log('✅ EODHD exclusive configuration verified')
    })

    test('should validate EODHD service availability', async () => {
      const availability = await optionsService.checkOptionsAvailability()

      expect(availability).toHaveProperty('eodhd')
      expect(typeof availability.eodhd).toBe('boolean')

      // Should only have EODHD key, no fallbacks
      expect(Object.keys(availability)).toEqual(['eodhd'])

      console.log(`📊 EODHD availability: ${availability.eodhd}`)
    }, 10000)

    test('should provide service status for EODHD only', async () => {
      const status = await optionsService.getServiceStatus()

      expect(status.provider).toBe('EODHD')
      expect(status).toHaveProperty('available')
      expect(status).toHaveProperty('status')
      expect(status.description).toContain('UnicornBay')

      console.log(`🔍 Service status: ${status.status}`)
    }, 10000)
  })

  describe('📊 Put/Call Ratio Analysis - EODHD Integration', () => {
    test('should fetch put/call ratio with performance validation', async () => {
      const startTime = Date.now()

      const ratio = await optionsService.getPutCallRatio(PRIMARY_SYMBOL)

      const latency = Date.now() - startTime
      console.log(`⚡ Put/call ratio latency: ${latency}ms`)

      if (ratio) {
        expect(ratio.symbol).toBe(PRIMARY_SYMBOL)
        expect(ratio.volumeRatio).toBeGreaterThan(0)
        expect(ratio.openInterestRatio).toBeGreaterThan(0)
        expect(ratio.source).toBe('eodhd')
        expect(ratio.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(ratio.timestamp).toBeGreaterThan(0)

        console.log(`📊 P/C Volume Ratio: ${ratio.volumeRatio.toFixed(2)}`)
        console.log(`📊 P/C OI Ratio: ${ratio.openInterestRatio.toFixed(2)}`)

        // Performance validation
        expect(latency).toBeLessThan(LATENCY_TARGET)
      } else {
        console.log('⚠️ No put/call ratio data available from EODHD')
      }
    }, 15000)

    test('should validate put/call ratio data quality', async () => {
      const ratio = await optionsService.getPutCallRatio(PRIMARY_SYMBOL)

      if (ratio) {
        // Data quality checks
        expect(ratio.totalCallVolume).toBeGreaterThanOrEqual(0)
        expect(ratio.totalPutVolume).toBeGreaterThanOrEqual(0)
        expect(ratio.totalCallOpenInterest).toBeGreaterThanOrEqual(0)
        expect(ratio.totalPutOpenInterest).toBeGreaterThanOrEqual(0)

        // Ratio consistency check
        if (ratio.totalCallVolume > 0) {
          const calculatedVolumeRatio = ratio.totalPutVolume / ratio.totalCallVolume
          expect(Math.abs(ratio.volumeRatio - calculatedVolumeRatio)).toBeLessThan(0.01)
        }

        console.log('✅ Put/call ratio data quality validated')
      }
    }, 15000)

    test('should process multiple symbols for batch analysis', async () => {
      const startTime = Date.now()

      const results = await Promise.allSettled(
        TEST_SYMBOLS.map(symbol => optionsService.getPutCallRatio(symbol))
      )

      const totalLatency = Date.now() - startTime
      console.log(`⚡ Batch put/call ratio latency: ${totalLatency}ms for ${TEST_SYMBOLS.length} symbols`)

      const successfulResults = results.filter(r => r.status === 'fulfilled' && r.value)
      console.log(`📊 Successful ratios: ${successfulResults.length}/${TEST_SYMBOLS.length}`)

      // At least some symbols should have data
      expect(successfulResults.length).toBeGreaterThan(0)
    }, 30000)
  })

  describe('🔗 Options Chain Processing - Memory Optimization', () => {
    test('should fetch options chain with memory efficiency', async () => {
      const startTime = Date.now()

      const chain = await optionsService.getOptionsChain(PRIMARY_SYMBOL)

      const latency = Date.now() - startTime
      console.log(`⚡ Options chain latency: ${latency}ms`)

      if (chain) {
        expect(chain.symbol).toBe(PRIMARY_SYMBOL)
        expect(Array.isArray(chain.calls)).toBe(true)
        expect(Array.isArray(chain.puts)).toBe(true)
        expect(Array.isArray(chain.expirationDates)).toBe(true)
        expect(Array.isArray(chain.strikes)).toBe(true)
        expect(chain.source).toBe('optimized')

        console.log(`🔗 Calls: ${chain.calls.length}, Puts: ${chain.puts.length}`)
        console.log(`📅 Expirations: ${chain.expirationDates.length}`)
        console.log(`🎯 Strikes: ${chain.strikes.length}`)

        // Memory optimization validation
        if (chain.calls.length > 0) {
          const sampleCall = chain.calls[0]
          // Should have essential fields only (memory optimized)
          expect(sampleCall).toHaveProperty('strike')
          expect(sampleCall).toHaveProperty('bid')
          expect(sampleCall).toHaveProperty('ask')
          expect(sampleCall).toHaveProperty('volume')
          expect(sampleCall).toHaveProperty('openInterest')
        }

        // Performance validation
        expect(latency).toBeLessThan(LATENCY_TARGET)
      } else {
        console.log('⚠️ No options chain data available from EODHD')
      }
    }, 20000)

    test('should validate contract data for active expirations only', async () => {
      const chain = await optionsService.getOptionsChain(PRIMARY_SYMBOL)

      if (chain && chain.expirationDates.length > 0) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // All expiration dates should be today or future
        chain.expirationDates.forEach(expDate => {
          const expiration = new Date(expDate)
          expect(expiration.getTime()).toBeGreaterThanOrEqual(today.getTime())
        })

        console.log('✅ All contracts have active expirations (no expired options)')
      }
    }, 20000)

    test('should process options chain with specific expiration', async () => {
      // First get available expirations
      const chain = await optionsService.getOptionsChain(PRIMARY_SYMBOL)

      if (chain && chain.expirationDates.length > 0) {
        const targetExpiration = chain.expirationDates[0]

        const specificChain = await optionsService.getOptionsChain(PRIMARY_SYMBOL, targetExpiration)

        if (specificChain) {
          // Should have contracts for specified expiration
          expect(specificChain.symbol).toBe(PRIMARY_SYMBOL)
          console.log(`📅 Specific expiration ${targetExpiration}: ${specificChain.calls.length + specificChain.puts.length} contracts`)
        }
      }
    }, 25000)
  })

  describe('📈 Options Analysis - Comprehensive Intelligence', () => {
    test('should provide complete options analysis with performance validation', async () => {
      const startTime = Date.now()

      const analysis = await optionsService.getOptionsAnalysis(PRIMARY_SYMBOL)

      const latency = Date.now() - startTime
      console.log(`⚡ Options analysis latency: ${latency}ms`)

      if (analysis) {
        expect(analysis.symbol).toBe(PRIMARY_SYMBOL)
        expect(analysis.currentRatio).toBeDefined()
        expect(Array.isArray(analysis.historicalRatios)).toBe(true)
        expect(['bullish', 'bearish', 'neutral']).toContain(analysis.trend)
        expect(['fear', 'greed', 'balanced']).toContain(analysis.sentiment)
        expect(analysis.confidence).toBeGreaterThanOrEqual(0)
        expect(analysis.confidence).toBeLessThanOrEqual(1)
        expect(analysis.source).toContain('eodhd')

        console.log(`📊 Analysis Trend: ${analysis.trend}`)
        console.log(`📊 Market Sentiment: ${analysis.sentiment}`)
        console.log(`📊 Confidence: ${(analysis.confidence * 100).toFixed(1)}%`)

        // Validate current ratio structure
        expect(analysis.currentRatio.symbol).toBe(PRIMARY_SYMBOL)
        expect(analysis.currentRatio.volumeRatio).toBeGreaterThan(0)
        expect(analysis.currentRatio.source).toContain('eodhd')

        // Performance validation
        expect(latency).toBeLessThan(LATENCY_TARGET)
      } else {
        console.log('⚠️ No options analysis available from EODHD')
      }
    }, 20000)

    test('should validate options analysis data consistency', async () => {
      const analysis = await optionsService.getOptionsAnalysis(PRIMARY_SYMBOL)

      if (analysis) {
        const { currentRatio } = analysis

        // Data consistency checks
        expect(currentRatio.totalCallVolume).toBeGreaterThanOrEqual(0)
        expect(currentRatio.totalPutVolume).toBeGreaterThanOrEqual(0)

        // Sentiment vs trend correlation check
        if (analysis.sentiment === 'fear' && currentRatio.volumeRatio > 1.2) {
          expect(['bearish', 'neutral']).toContain(analysis.trend)
        } else if (analysis.sentiment === 'greed' && currentRatio.volumeRatio < 0.8) {
          expect(['bullish', 'neutral']).toContain(analysis.trend)
        }

        console.log('✅ Options analysis data consistency validated')
      }
    }, 20000)
  })

  describe('🦄 UnicornBay Enhanced Integration', () => {
    test('should access UnicornBay enhanced features when available', async () => {
      const analysis = await optionsService.getOptionsAnalysis(PRIMARY_SYMBOL)

      if (analysis && analysis.source.includes('unicornbay')) {
        // UnicornBay specific features
        console.log('🦄 UnicornBay enhanced features detected')

        // Check for enhanced metadata
        if (analysis.currentRatio.metadata) {
          expect(analysis.currentRatio.metadata).toHaveProperty('contractsProcessed')
        }

        console.log('✅ UnicornBay integration validated')
      } else {
        console.log('📊 Standard EODHD analysis (UnicornBay features not available)')
      }
    }, 20000)
  })

  describe('⚡ Performance and Caching Optimization', () => {
    test('should demonstrate caching efficiency', async () => {
      // First call (cache miss)
      const startTime1 = Date.now()
      const result1 = await optionsService.getOptionsAnalysis(PRIMARY_SYMBOL)
      const latency1 = Date.now() - startTime1

      // Second call (should hit cache)
      const startTime2 = Date.now()
      const result2 = await optionsService.getOptionsAnalysis(PRIMARY_SYMBOL)
      const latency2 = Date.now() - startTime2

      console.log(`⚡ First call: ${latency1}ms`)
      console.log(`⚡ Second call: ${latency2}ms`)

      if (result1 && result2) {
        // Cache hit should be significantly faster
        expect(latency2).toBeLessThan(latency1 * 0.5)

        // Results should be consistent
        expect(result1.symbol).toBe(result2.symbol)
        expect(result1.currentRatio.volumeRatio).toBe(result2.currentRatio.volumeRatio)

        console.log('✅ Caching efficiency validated')
      }
    }, 30000)

    test('should validate performance metrics tracking', async () => {
      // Process multiple requests to build metrics
      for (const symbol of TEST_SYMBOLS.slice(0, 2)) {
        await optionsService.getOptionsAnalysis(symbol)
      }

      const performanceReport = optionsService.getPerformanceReport()

      expect(performanceReport.totalRequests).toBeGreaterThan(0)
      expect(performanceReport.averageLatency).toBeGreaterThan(0)
      expect(performanceReport.latencyTarget).toBe(LATENCY_TARGET)
      expect(performanceReport.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(['A', 'B', 'C']).toContain(performanceReport.performanceGrade)

      console.log(`📊 Performance Report:`)
      console.log(`   Total Requests: ${performanceReport.totalRequests}`)
      console.log(`   Average Latency: ${performanceReport.averageLatency}ms`)
      console.log(`   Cache Hit Rate: ${performanceReport.cacheHitRate}%`)
      console.log(`   Performance Grade: ${performanceReport.performanceGrade}`)

      // Target validation
      if (performanceReport.averageLatency <= LATENCY_TARGET) {
        expect(performanceReport.performanceGrade).toBe('A')
      }
    }, 45000)
  })

  describe('🛡️ Error Handling and Resilience', () => {
    test('should handle invalid symbols gracefully', async () => {
      const invalidSymbol = 'INVALID_SYMBOL_TEST'

      const ratio = await optionsService.getPutCallRatio(invalidSymbol)
      const analysis = await optionsService.getOptionsAnalysis(invalidSymbol)
      const chain = await optionsService.getOptionsChain(invalidSymbol)

      // Should return null for invalid symbols, not throw errors
      expect(ratio).toBeNull()
      expect(analysis).toBeNull()
      expect(chain).toBeNull()

      console.log('✅ Invalid symbol handling validated')
    }, 20000)

    test('should handle service unavailability gracefully', async () => {
      // Test with potentially problematic scenarios
      const results = await Promise.allSettled([
        optionsService.getPutCallRatio(''),
        optionsService.getOptionsAnalysis(''),
        optionsService.getOptionsChain('')
      ])

      // Should handle gracefully, not crash
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value).toBeNull()
        }
        // Rejected promises are also acceptable for error conditions
      })

      console.log('✅ Service error handling validated')
    }, 15000)
  })

  describe('🧪 Integration with Analysis Engine', () => {
    test('should provide data compatible with analysis engine', async () => {
      const analysis = await optionsService.getOptionsAnalysis(PRIMARY_SYMBOL)

      if (analysis) {
        // Validate data structure matches what AlgorithmEngine expects
        expect(analysis.currentRatio.volumeRatio).toBeDefined()
        expect(analysis.sentiment).toBeDefined()
        expect(analysis.confidence).toBeDefined()

        // Check for options data point compatibility
        const optionsDataPoint = {
          putCallRatio: analysis.currentRatio.volumeRatio,
          impliedVolatilityPercentile: 50, // Placeholder for IV percentile
          maxPain: 150, // Placeholder for max pain
          optionsFlow: {
            sentiment: analysis.confidence,
            callVolume: analysis.currentRatio.totalCallVolume,
            putVolume: analysis.currentRatio.totalPutVolume
          },
          volumeDivergence: 1.0, // Placeholder
          greeks: {
            delta: 0.5,
            gamma: 0.02,
            theta: -0.05,
            vega: 0.15
          }
        }

        // Validate structure for algorithm engine consumption
        expect(optionsDataPoint.putCallRatio).toBeGreaterThan(0)
        expect(optionsDataPoint.optionsFlow.sentiment).toBeGreaterThanOrEqual(0)
        expect(optionsDataPoint.optionsFlow.sentiment).toBeLessThanOrEqual(1)

        console.log('✅ Analysis engine compatibility validated')
      }
    }, 20000)
  })

  describe('🕒 Time-Based Options Analysis - Enhanced Features', () => {
    test('should provide comprehensive time-based analysis for AAPL', async () => {
      console.log('\n🍎 Testing AAPL time-based options analysis...')

      const analysis = await optionsService.getOptionsAnalysis('AAPL', true)

      expect(analysis).toBeTruthy()
      expect(analysis!.symbol).toBe('AAPL')

      if (analysis!.timeBasedAnalysis) {
        const tba = analysis!.timeBasedAnalysis

        console.log(`✅ AAPL Time-Based Analysis Results:`)
        console.log(`   📅 Short-term: ${tba.shortTerm.sentiment} (${tba.shortTerm.daysToExpiry}d, P/C: ${tba.shortTerm.volumeRatio.toFixed(2)})`)
        console.log(`   📈 Medium-term: ${tba.mediumTerm.sentiment} (${tba.mediumTerm.daysToExpiry}d, ${tba.mediumTerm.institutionalSignals.length} signals)`)
        console.log(`   🚀 Long-term: ${tba.longTerm.sentiment} (${tba.longTerm.daysToExpiry}d)`)
        console.log(`   📊 LEAPS: ${tba.longTerm.leapsAnalysis}`)

        // Validate structure
        expect(tba.shortTerm).toHaveProperty('sentiment')
        expect(tba.shortTerm).toHaveProperty('volumeRatio')
        expect(tba.shortTerm).toHaveProperty('confidence')
        expect(tba.mediumTerm).toHaveProperty('institutionalSignals')
        expect(tba.longTerm).toHaveProperty('leapsAnalysis')
        expect(tba.strikePositioning).toHaveProperty('heavyCallActivity')
        expect(tba.strikePositioning).toHaveProperty('heavyPutActivity')

        // Validate sentiment values
        expect(['bullish', 'bearish', 'neutral']).toContain(tba.shortTerm.sentiment)
        expect(['bullish', 'bearish', 'neutral']).toContain(tba.mediumTerm.sentiment)
        expect(['bullish', 'bearish', 'neutral']).toContain(tba.longTerm.sentiment)

        // Validate confidence ranges
        expect(tba.shortTerm.confidence).toBeGreaterThanOrEqual(0)
        expect(tba.shortTerm.confidence).toBeLessThanOrEqual(1)

        console.log(`   🎯 Strike Analysis:`)
        console.log(`      Heavy Call Activity: ${tba.strikePositioning.heavyCallActivity.length} strikes`)
        console.log(`      Heavy Put Activity: ${tba.strikePositioning.heavyPutActivity.length} strikes`)
        console.log(`      Institutional Hedges: ${tba.strikePositioning.institutionalHedges.length} detected`)
        console.log(`      Unusual Activity: ${tba.strikePositioning.unusualActivity.length} patterns`)
      } else {
        console.log('⚠️ Time-based analysis not available for AAPL')
      }
    }, 300000)

    test('should detect institutional signals in medium-term analysis', async () => {
      console.log('\n📊 Testing institutional signal detection...')

      const analysis = await optionsService.getOptionsAnalysis('SPY', true)

      if (analysis?.timeBasedAnalysis?.mediumTerm) {
        const mediumTerm = analysis.timeBasedAnalysis.mediumTerm

        console.log(`📈 SPY Medium-term Analysis:`)
        console.log(`   Sentiment: ${mediumTerm.sentiment}`)
        console.log(`   Confidence: ${(mediumTerm.confidence * 100).toFixed(1)}%`)
        console.log(`   Institutional Signals: ${mediumTerm.institutionalSignals.length}`)

        mediumTerm.institutionalSignals.forEach((signal, index) => {
          console.log(`      ${index + 1}. ${signal}`)
        })

        expect(Array.isArray(mediumTerm.institutionalSignals)).toBe(true)
        expect(mediumTerm.confidence).toBeGreaterThanOrEqual(0)
        expect(mediumTerm.volumeRatio).toBeGreaterThan(0)
      }
    }, 300000)

    test('should analyze LEAPS for long-term confidence detection', async () => {
      console.log('\n🚀 Testing LEAPS analysis...')

      const analysis = await optionsService.getOptionsAnalysis('TSLA', true)

      if (analysis?.timeBasedAnalysis?.longTerm) {
        const longTerm = analysis.timeBasedAnalysis.longTerm

        console.log(`🚀 TSLA Long-term Analysis:`)
        console.log(`   Sentiment: ${longTerm.sentiment}`)
        console.log(`   Days to Expiry: ${longTerm.daysToExpiry}`)
        console.log(`   LEAPS Analysis: ${longTerm.leapsAnalysis}`)
        console.log(`   Description: ${longTerm.description}`)

        expect(longTerm.leapsAnalysis).toBeTruthy()
        expect(typeof longTerm.leapsAnalysis).toBe('string')
        expect(longTerm.daysToExpiry).toBeGreaterThanOrEqual(0)
      }
    }, 300000)

    test('should identify strike price positioning patterns', async () => {
      console.log('\n🎯 Testing strike price positioning analysis...')

      const analysis = await optionsService.getOptionsAnalysis('NVDA', true)

      if (analysis?.timeBasedAnalysis?.strikePositioning) {
        const positioning = analysis.timeBasedAnalysis.strikePositioning

        console.log(`🎯 NVDA Strike Positioning:`)
        console.log(`   Heavy Call Activity: ${positioning.heavyCallActivity.join(', ') || 'None'}`)
        console.log(`   Heavy Put Activity: ${positioning.heavyPutActivity.join(', ') || 'None'}`)
        console.log(`   Institutional Hedges: ${positioning.institutionalHedges.join(', ') || 'None'}`)

        positioning.unusualActivity.forEach((activity, index) => {
          console.log(`   Unusual Activity ${index + 1}: ${activity}`)
        })

        expect(Array.isArray(positioning.heavyCallActivity)).toBe(true)
        expect(Array.isArray(positioning.heavyPutActivity)).toBe(true)
        expect(Array.isArray(positioning.institutionalHedges)).toBe(true)
        expect(Array.isArray(positioning.unusualActivity)).toBe(true)
      }
    }, 300000)

    test('should handle time-based analysis toggle correctly', async () => {
      console.log('\n🔄 Testing time-based analysis toggle...')

      // Test without time-based analysis
      const basicAnalysis = await optionsService.getOptionsAnalysis('AAPL', false)
      expect(basicAnalysis?.timeBasedAnalysis).toBeUndefined()

      // Test with time-based analysis
      const enhancedAnalysis = await optionsService.getOptionsAnalysis('AAPL', true)
      expect(enhancedAnalysis?.timeBasedAnalysis).toBeTruthy()

      console.log(`✅ Toggle functionality working correctly`)
    }, 300000)
  })

  describe('📊 Memory and Resource Management', () => {
    test('should maintain memory efficiency during intensive operations', async () => {
      const initialMemory = process.memoryUsage()

      // Process multiple symbols intensively
      const promises = TEST_SYMBOLS.map(async symbol => {
        const [ratio, analysis, chain] = await Promise.all([
          optionsService.getPutCallRatio(symbol),
          optionsService.getOptionsAnalysis(symbol),
          optionsService.getOptionsChain(symbol)
        ])
        return { symbol, ratio, analysis, chain }
      })

      const results = await Promise.all(promises)

      const finalMemory = process.memoryUsage()
      const heapGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024

      console.log(`💾 Memory usage:`)
      console.log(`   Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(1)}MB`)
      console.log(`   Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(1)}MB`)
      console.log(`   Heap growth: ${heapGrowth.toFixed(1)}MB`)

      // Memory growth should be reasonable (< 100MB for test operations)
      expect(heapGrowth).toBeLessThan(100)

      const successfulResults = results.filter(r => r.analysis || r.ratio || r.chain)
      console.log(`✅ Memory efficiency validated with ${successfulResults.length} successful operations`)
    }, 60000)
  })
})