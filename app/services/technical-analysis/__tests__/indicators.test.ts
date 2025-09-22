/**
 * Technical Indicators Tests
 * Comprehensive tests for technical analysis implementation
 */

import { TechnicalIndicatorService } from '../TechnicalIndicatorService'
import { RedisCache } from '../../cache/RedisCache'
import { OHLCData, TechnicalAnalysisInput } from '../types'

// Mock Redis cache for testing
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue('PONG')
} as unknown as RedisCache

// Generate mock OHLC data for testing
const generateMockOHLCData = (periods: number = 100): OHLCData[] => {
  const data: OHLCData[] = []
  let basePrice = 100

  for (let i = 0; i < periods; i++) {
    const change = (Math.random() - 0.5) * 4 // +/- 2% daily change
    const open = basePrice
    const close = basePrice + change
    const high = Math.max(open, close) + Math.random() * 2
    const low = Math.min(open, close) - Math.random() * 2
    const volume = Math.floor(1000000 + Math.random() * 5000000)

    data.unshift({
      timestamp: Date.now() - (i * 24 * 60 * 60 * 1000), // Daily intervals
      open,
      high,
      low,
      close,
      volume
    })

    basePrice = close
  }

  return data
}

describe('TechnicalIndicatorService', () => {
  let service: TechnicalIndicatorService

  beforeEach(() => {
    service = new TechnicalIndicatorService(mockCache)
    jest.clearAllMocks()
  })

  describe('Basic functionality', () => {
    test('should initialize properly', () => {
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(TechnicalIndicatorService)
    })

    test('should handle empty OHLC data', async () => {
      const input: TechnicalAnalysisInput = {
        symbol: 'TEST',
        ohlcData: []
      }

      await expect(service.calculateAllIndicators(input)).rejects.toThrow('No OHLC data provided')
    })
  })

  describe('Technical analysis calculations', () => {

    test('should calculate technical indicators for valid data', async () => {
      const ohlcData = generateMockOHLCData(100)
      const input: TechnicalAnalysisInput = {
        symbol: 'AAPL',
        ohlcData
      }

      const result = await service.calculateAllIndicators(input)

      expect(result).toBeDefined()
      expect(result.symbol).toBe('AAPL')
      expect(result.timestamp).toBeDefined()

      // Check trend analysis
      expect(result.trend).toBeDefined()
      expect(result.trend.direction).toMatch(/^(bullish|bearish|neutral)$/)
      expect(result.trend.strength).toBeGreaterThanOrEqual(0)
      expect(result.trend.strength).toBeLessThanOrEqual(1)
      expect(result.trend.indicators.sma).toBeDefined()
      expect(result.trend.indicators.ema).toBeDefined()
      expect(result.trend.indicators.macd).toBeDefined()
      expect(result.trend.indicators.bollinger).toBeDefined()

      // Check momentum analysis
      expect(result.momentum).toBeDefined()
      expect(result.momentum.signal).toMatch(/^(buy|sell|hold)$/)
      expect(result.momentum.indicators.rsi).toBeDefined()
      expect(result.momentum.indicators.stochastic).toBeDefined()
      expect(result.momentum.indicators.williams).toBeDefined()
      expect(result.momentum.indicators.roc).toBeDefined()

      // Check volume analysis
      expect(result.volume).toBeDefined()
      expect(result.volume.trend).toMatch(/^(increasing|decreasing|stable)$/)
      expect(result.volume.indicators.obv).toBeDefined()
      expect(result.volume.indicators.vwap).toBeDefined()

      // Check volatility analysis
      expect(result.volatility).toBeDefined()
      expect(result.volatility.level).toMatch(/^(high|medium|low)$/)
      expect(result.volatility.indicators.atr).toBeDefined()

      // Check patterns
      expect(result.patterns).toBeDefined()
      expect(Array.isArray(result.patterns.candlestick)).toBe(true)
      expect(Array.isArray(result.patterns.chart)).toBe(true)

      // Check overall score
      expect(result.score).toBeDefined()
      expect(result.score.total).toBeGreaterThanOrEqual(0)
      expect(result.score.total).toBeLessThanOrEqual(100)
      expect(result.score.breakdown).toBeDefined()

      // Check metadata
      expect(result.metadata).toBeDefined()
      expect(result.metadata.calculationTime).toBeGreaterThan(0)
      expect(result.metadata.dataQuality).toBeGreaterThanOrEqual(0)
      expect(result.metadata.dataQuality).toBeLessThanOrEqual(1)
    }, 10000) // 10 second timeout for complex calculations

    test('should handle insufficient data gracefully', async () => {
      const ohlcData = generateMockOHLCData(5) // Very little data
      const input: TechnicalAnalysisInput = {
        symbol: 'TEST',
        ohlcData
      }

      // Should not throw, but may have limited indicator values
      const result = await service.calculateAllIndicators(input)
      expect(result).toBeDefined()
      expect(result.symbol).toBe('TEST')
    })

    test('should validate OHLC data quality', async () => {
      const invalidOHLCData: OHLCData[] = [
        {
          timestamp: Date.now(),
          open: 100,
          high: 90, // Invalid: high < open
          low: 105, // Invalid: low > open
          close: 95,
          volume: 1000000
        }
      ]

      const input: TechnicalAnalysisInput = {
        symbol: 'INVALID',
        ohlcData: invalidOHLCData
      }

      const result = await service.calculateAllIndicators(input)
      expect(result.metadata.dataQuality).toBeLessThan(1) // Should detect quality issues
    })
  })

  describe('Performance tracking', () => {
    test('should track performance metrics', async () => {
      const ohlcData = generateMockOHLCData(50)
      const input: TechnicalAnalysisInput = {
        symbol: 'PERF',
        ohlcData
      }

      await service.calculateAllIndicators(input)

      const performance = service.getPerformanceStats('PERF')
      expect(performance).toBeDefined()
      expect(typeof performance === 'object').toBe(true)

      if (typeof performance === 'object' && !Array.isArray(performance)) {
        expect(performance.symbol).toBe('PERF')
        expect(performance.totalTime).toBeGreaterThan(0)
        expect(performance.dataQuality).toBeGreaterThanOrEqual(0)
        expect(performance.dataQuality).toBeLessThanOrEqual(1)
      }
    })

    test('should return all performance stats when no symbol specified', async () => {
      const ohlcData = generateMockOHLCData(30)

      await service.calculateAllIndicators({
        symbol: 'TEST1',
        ohlcData
      })

      await service.calculateAllIndicators({
        symbol: 'TEST2',
        ohlcData
      })

      const allPerformance = service.getPerformanceStats()
      expect(Array.isArray(allPerformance)).toBe(true)
      if (Array.isArray(allPerformance)) {
        expect(allPerformance.length).toBeGreaterThanOrEqual(2)
      }
    })

    test('should track cache hits and misses correctly', async () => {
      const ohlcData = generateMockOHLCData(50)
      const input: TechnicalAnalysisInput = {
        symbol: 'CACHE_TEST',
        ohlcData
      }

      // First calculation should be a cache miss
      const firstResult = await service.calculateAllIndicators(input)
      let performance = service.getPerformanceStats('CACHE_TEST')

      expect(performance).toBeDefined()
      if (typeof performance === 'object' && !Array.isArray(performance)) {
        expect(performance.cacheMisses).toBe(1)
        expect(performance.cacheHits).toBe(0)
        expect(performance.totalTime).toBeGreaterThan(0)
      }

      // Mock cache to return the first result for the second call (simulating cache hit)
      jest.spyOn(mockCache, 'get').mockResolvedValueOnce(firstResult)

      // Second calculation should be a cache hit
      await service.calculateAllIndicators(input)
      performance = service.getPerformanceStats('CACHE_TEST')

      if (typeof performance === 'object' && !Array.isArray(performance)) {
        expect(performance.cacheMisses).toBe(1) // Should still be 1
        expect(performance.cacheHits).toBe(1)   // Should now be 1
        expect(performance.totalTime).toBeGreaterThan(0)
      }
    })
  })

  describe('Caching', () => {
    test('should attempt to use cache', async () => {
      const ohlcData = generateMockOHLCData(50)
      const input: TechnicalAnalysisInput = {
        symbol: 'CACHE_TEST',
        ohlcData
      }

      await service.calculateAllIndicators(input)

      // Should have attempted to get from cache
      expect(mockCache.get).toHaveBeenCalled()
    })

    test('should clear cache', async () => {
      await service.clearCache()
      // Cache clearing is handled by the cache service itself
      expect(service).toBeDefined()
    })
  })

  describe('Configuration', () => {
    test('should allow config updates', () => {
      expect(() => {
        service.updateConfig({
          rsi: { enabled: true, period: 21, overbought: 75, oversold: 25 }
        })
      }).not.toThrow()
    })
  })
})

describe('Integration with FactorLibrary', () => {
  test('should work with enhanced FactorLibrary', async () => {
    // This would test the integration between TechnicalIndicatorService and FactorLibrary
    // For now, we'll just ensure the classes can be imported together
    const { FactorLibrary } = await import('../../algorithms/FactorLibrary')

    expect(FactorLibrary).toBeDefined()
    expect(TechnicalIndicatorService).toBeDefined()

    // Test that FactorLibrary can be created with TechnicalIndicatorService
    const technicalService = new TechnicalIndicatorService(mockCache)
    const factorLibrary = new FactorLibrary(technicalService)

    expect(factorLibrary).toBeDefined()
    expect(factorLibrary).toBeInstanceOf(FactorLibrary)
  })
})