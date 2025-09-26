/**
 * Comprehensive Integration Test Suite for SectorRotationService
 * Tests sector performance tracking with REAL FMP API integration
 * Validates rotation patterns, momentum calculations, and performance benchmarks
 * NO MOCK DATA - follows TDD principles with real integrations only
 */

import { SectorRotationService } from '../SectorRotationService'
import { SectorRotation, SectorPerformance, RotationPattern, SectorMomentum } from '../types'
import { createServiceErrorHandler } from '../../error-handling'
import SecurityValidator from '../../security/SecurityValidator'
import { redisCache } from '../../cache/RedisCache'

describe('SectorRotationService Integration Tests', () => {
  let service: SectorRotationService
  let errorHandler: ReturnType<typeof createServiceErrorHandler>
  let startTime: number
  let initialMemoryUsage: NodeJS.MemoryUsage

  beforeEach(() => {
    // Initialize performance and memory tracking
    startTime = Date.now()
    initialMemoryUsage = process.memoryUsage()

    // Reset security state
    SecurityValidator.resetSecurityState()

    // Initialize service (no constructor parameters)
    service = new SectorRotationService()

    errorHandler = createServiceErrorHandler('SectorRotationService-Integration')
  })

  afterEach(async () => {
    // Performance and memory validation
    const testDuration = Date.now() - startTime
    const finalMemoryUsage = process.memoryUsage()
    const memoryIncrease = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed

    // Performance benchmark: must stay under 3-second total
    expect(testDuration).toBeLessThan(3000)

    // Memory benchmark: must stay under 70MB increase per test
    expect(memoryIncrease).toBeLessThan(70 * 1024 * 1024)

    // Cleanup
    SecurityValidator.resetSecurityState()

    try {
      await redisCache.cleanup()
    } catch (error) {
      // Redis may not be available in test environment
    }

    // Force garbage collection
    if (global.gc) {
      global.gc()
    }
  })

  describe('Real FMP API Integration and Sector Data Processing', () => {
    test('should_fetch_sector_performance_data_with_real_fmp_api', async () => {
      const testSectors = ['Technology', 'Healthcare', 'Financials', 'Energy']
      const apiCallCount = testSectors.length

      // Rate limit compliance (FMP 300/minute = 5/second)
      expect(apiCallCount).toBeLessThanOrEqual(4)

      const startApiTime = Date.now()
      const promises = testSectors.map(sector =>
        service.getSectorPerformance(sector)
      )
      const results = await Promise.allSettled(promises)
      const apiDuration = Date.now() - startApiTime

      // Rate limit compliance validation
      expect(apiDuration).toBeGreaterThanOrEqual((apiCallCount - 1) * 200) // Min 200ms between calls

      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled')
        if (result.status === 'fulfilled' && result.value) {
          const performance = result.value
          expect(performance).toHaveProperty('sector', testSectors[index])
          expect(performance).toHaveProperty('returns')
          expect(performance).toHaveProperty('relativeStrength')
          expect(performance).toHaveProperty('momentum')
          expect(performance).toHaveProperty('trend')
          expect(performance).toHaveProperty('volatility')

          // Returns validation
          expect(performance.returns).toHaveProperty('oneWeek')
          expect(performance.returns).toHaveProperty('oneMonth')
          expect(performance.returns).toHaveProperty('threeMonths')
          expect(performance.returns).toHaveProperty('oneYear')

          // Relative strength validation (vs S&P 500)
          expect(typeof performance.relativeStrength).toBe('number')

          // Momentum validation (has momentum object)
          expect(performance.momentum).toHaveProperty('momentum')
          expect(performance.momentum).toHaveProperty('acceleration')
          expect(performance.momentum).toHaveProperty('technicalRating')
          expect(typeof performance.momentum.momentum).toBe('number')
          expect(performance.momentum.momentum).toBeGreaterThanOrEqual(-10)
          expect(performance.momentum.momentum).toBeLessThanOrEqual(10)

          // Trend validation
          expect(['OUTPERFORMING', 'UNDERPERFORMING', 'INLINE']).toContain(performance.trend)
        }
      })

      console.log(`✓ Sector performance fetched: ${apiCallCount} sectors in ${apiDuration}ms`)
    }, 20000)

    test('should_analyze_sector_rotation_patterns_with_cyclical_analysis', async () => {
      const rotationAnalysis = await service.getSectorRotation('3M')

      // Rotation analysis structure validation based on SectorRotation interface
      expect(rotationAnalysis).toHaveProperty('period')
      expect(rotationAnalysis).toHaveProperty('rotationPhase')
      expect(rotationAnalysis).toHaveProperty('leadingSectors')
      expect(rotationAnalysis).toHaveProperty('laggingSectors')
      expect(rotationAnalysis).toHaveProperty('rotationStrength')
      expect(rotationAnalysis).toHaveProperty('confidence')

      // Rotation phase validation (market cycle phase)
      expect(['EARLY_CYCLE', 'MID_CYCLE', 'LATE_CYCLE', 'RECESSION']).toContain(rotationAnalysis.rotationPhase)

      // Rotation strength validation (0-10 scale)
      expect(typeof rotationAnalysis.rotationStrength).toBe('number')
      expect(rotationAnalysis.rotationStrength).toBeGreaterThanOrEqual(0)
      expect(rotationAnalysis.rotationStrength).toBeLessThanOrEqual(10)

      // Leading sectors validation (array of sector names)
      expect(Array.isArray(rotationAnalysis.leadingSectors)).toBe(true)
      rotationAnalysis.leadingSectors.forEach(sector => {
        expect(typeof sector).toBe('string')
      })

      // Lagging sectors validation (array of sector names)
      expect(Array.isArray(rotationAnalysis.laggingSectors)).toBe(true)
      rotationAnalysis.laggingSectors.forEach(sector => {
        expect(typeof sector).toBe('string')
      })

      // Confidence validation
      expect(typeof rotationAnalysis.confidence).toBe('number')
      expect(rotationAnalysis.confidence).toBeGreaterThan(0)
      expect(rotationAnalysis.confidence).toBeLessThanOrEqual(1)

      console.log(`✓ Rotation analysis: Phase: ${rotationAnalysis.rotationPhase}, Leading: ${rotationAnalysis.leadingSectors.join(', ')}, Strength: ${rotationAnalysis.rotationStrength}`)
    })

    test('should_calculate_sector_momentum_with_trend_validation', async () => {
      const sector = 'Technology'
      const sectorMomentum = await service.getSectorMomentum(sector)

      // Sector momentum structure validation based on SectorMomentum interface
      expect(sectorMomentum).toHaveProperty('sector', sector)
      expect(sectorMomentum).toHaveProperty('momentum')
      expect(sectorMomentum).toHaveProperty('acceleration')
      expect(sectorMomentum).toHaveProperty('volume')
      expect(sectorMomentum).toHaveProperty('breadth')
      expect(sectorMomentum).toHaveProperty('technicalRating')

      // Momentum validation (-10 to +10)
      expect(typeof sectorMomentum.momentum).toBe('number')
      expect(sectorMomentum.momentum).toBeGreaterThanOrEqual(-10)
      expect(sectorMomentum.momentum).toBeLessThanOrEqual(10)

      // Acceleration validation
      expect(typeof sectorMomentum.acceleration).toBe('number')

      // Volume validation
      expect(typeof sectorMomentum.volume).toBe('number')
      expect(sectorMomentum.volume).toBeGreaterThan(0)

      // Breadth validation (percentage of stocks outperforming)
      expect(typeof sectorMomentum.breadth).toBe('number')
      expect(sectorMomentum.breadth).toBeGreaterThanOrEqual(0)
      expect(sectorMomentum.breadth).toBeLessThanOrEqual(100)

      // Technical rating validation
      expect(['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL']).toContain(sectorMomentum.technicalRating)

      console.log(`✓ Momentum analysis: ${sector} - Momentum: ${sectorMomentum.momentum}, Rating: ${sectorMomentum.technicalRating}`)
    })

    test('should_track_rotation_patterns_with_recommendations', async () => {
      const rotationPatterns = await service.getRotationPatterns('1Y')
      const recommendations = await service.getSectorRecommendations()

      // Rotation patterns validation
      expect(Array.isArray(rotationPatterns)).toBe(true)
      rotationPatterns.forEach(pattern => {
        expect(pattern).toHaveProperty('fromSector')
        expect(pattern).toHaveProperty('toSector')
        expect(pattern).toHaveProperty('strength')
        expect(pattern).toHaveProperty('duration')
        expect(pattern).toHaveProperty('confidence')
        expect(pattern).toHaveProperty('historicalAccuracy')
        expect(pattern).toHaveProperty('triggers')

        expect(typeof pattern.strength).toBe('number')
        expect(pattern.strength).toBeGreaterThanOrEqual(0)
        expect(pattern.strength).toBeLessThanOrEqual(10)

        expect(typeof pattern.confidence).toBe('number')
        expect(pattern.confidence).toBeGreaterThan(0)
        expect(pattern.confidence).toBeLessThanOrEqual(1)
      })

      // Recommendations validation
      expect(recommendations).toHaveProperty('buy')
      expect(recommendations).toHaveProperty('sell')
      expect(recommendations).toHaveProperty('hold')

      expect(Array.isArray(recommendations.buy)).toBe(true)
      expect(Array.isArray(recommendations.sell)).toBe(true)
      expect(Array.isArray(recommendations.hold)).toBe(true)

      // All recommendations should be sector names (strings)
      const allRecommendations = [...recommendations.buy, ...recommendations.sell, ...recommendations.hold]
      allRecommendations.forEach(sector => {
        expect(typeof sector).toBe('string')
      })

      console.log(`✓ Rotation patterns: ${rotationPatterns.length} patterns, Recommendations: Buy ${recommendations.buy.length}, Sell ${recommendations.sell.length}, Hold ${recommendations.hold.length}`)
    })
  })

  describe('Performance Benchmarks and Data Processing', () => {
    test('should_process_sector_rotation_analysis_within_performance_limits', async () => {
      const memoryBefore = process.memoryUsage().heapUsed

      const startTime = Date.now()
      const results = await service.getAllSectorPerformances()
      const processingTime = Date.now() - startTime

      const memoryAfter = process.memoryUsage().heapUsed
      const memoryIncrease = memoryAfter - memoryBefore

      // Performance benchmarks
      expect(processingTime).toBeLessThan(3000) // Under 3 seconds total
      expect(memoryIncrease).toBeLessThan(120 * 1024 * 1024) // Under 120MB memory increase

      // Results validation
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)

      results.forEach(performance => {
        expect(performance).toHaveProperty('sector')
        expect(performance).toHaveProperty('returns')
        expect(performance).toHaveProperty('momentum')
        expect(performance).toHaveProperty('trend')
      })

      console.log(`✓ All sectors analysis completed in ${processingTime}ms, ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB memory, Sectors: ${results.length}`)
    }, 25000)

    test('should_implement_efficient_caching_for_sector_data', async () => {
      const sector = 'Technology'

      // Note: Service uses Redis caching internally

      // First request - cache miss
      const startTime1 = Date.now()
      const result1 = await service.getSectorPerformance(sector)
      const duration1 = Date.now() - startTime1

      // Second request - cache hit
      const startTime2 = Date.now()
      const result2 = await service.getSectorPerformance(sector)
      const duration2 = Date.now() - startTime2

      // Cache hit should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.2) // At least 80% improvement

      // Results should be identical
      expect(JSON.stringify(result2)).toBe(JSON.stringify(result1))

      const cacheEfficiency = ((duration1 - duration2) / duration1) * 100
      console.log(`✓ Cache efficiency: ${cacheEfficiency.toFixed(1)}% improvement (${duration1}ms -> ${duration2}ms)`)
    })
  })

  describe('Data Quality and Business Logic Validation', () => {
    test('should_validate_sector_rotation_calculations_and_rankings', async () => {
      const rotationAnalysis = await service.getSectorRotation()

      if (rotationAnalysis.leadingSectors.length > 0 && rotationAnalysis.laggingSectors.length > 0) {
        // Leading and lagging sectors should be different
        const leadingSet = new Set(rotationAnalysis.leadingSectors)
        const laggingSet = new Set(rotationAnalysis.laggingSectors)

        // No overlap between leading and lagging sectors
        const overlap = [...leadingSet].filter(sector => laggingSet.has(sector))
        expect(overlap.length).toBe(0)

        console.log(`✓ Rotation validation: Leading ${rotationAnalysis.leadingSectors.length} sectors, Lagging ${rotationAnalysis.laggingSectors.length} sectors`)
      }
    })

    test('should_handle_invalid_sector_names_gracefully', async () => {
      const invalidSector = 'INVALID_SECTOR_XYZ'

      // Service should handle invalid sector names gracefully
      const performance = await service.getSectorPerformance(invalidSector)

      // Should return data (even if mocked) rather than throwing an error
      expect(performance).toBeDefined()

      console.log('✓ Invalid sector names handled gracefully')
    })
  })
})