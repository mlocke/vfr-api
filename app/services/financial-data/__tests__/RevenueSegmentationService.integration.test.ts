/**
 * Comprehensive Integration Test Suite for RevenueSegmentationService
 * Tests geographic and product revenue analysis with REAL FMP API integration
 * Validates segmentation accuracy, performance benchmarks, and weight contribution
 * NO MOCK DATA - follows TDD principles with real integrations only
 */

import { RevenueSegmentationService } from '../RevenueSegmentationService'
import { RevenueSegmentation, GeographicRevenue, ProductRevenue, SegmentAnalysis } from '../types'
import { createServiceErrorHandler } from '../../error-handling'
import SecurityValidator from '../../security/SecurityValidator'
import { redisCache } from '../../cache/RedisCache'
import { FinancialModelingPrepAPI } from '../FinancialModelingPrepAPI'

describe('RevenueSegmentationService Integration Tests', () => {
  let service: RevenueSegmentationService
  let errorHandler: ReturnType<typeof createServiceErrorHandler>
  let fmpApi: FinancialModelingPrepAPI
  let startTime: number
  let initialMemoryUsage: NodeJS.MemoryUsage

  beforeEach(() => {
    // Initialize performance and memory tracking
    startTime = Date.now()
    initialMemoryUsage = process.memoryUsage()

    // Reset security state
    SecurityValidator.resetSecurityState()

    // Initialize service (no constructor parameters)
    service = new RevenueSegmentationService()

    errorHandler = createServiceErrorHandler('RevenueSegmentationService-Integration')
  })

  afterEach(async () => {
    // Performance and memory validation
    const testDuration = Date.now() - startTime
    const finalMemoryUsage = process.memoryUsage()
    const memoryIncrease = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed

    // Performance benchmark: must stay under 3-second total
    expect(testDuration).toBeLessThan(3000)

    // Memory benchmark: must stay under 60MB increase per test
    expect(memoryIncrease).toBeLessThan(60 * 1024 * 1024)

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

  describe('Real FMP API Integration and Revenue Data Processing', () => {
    test('should_fetch_revenue_segmentation_data_with_real_fmp_api', async () => {
      const testSymbols = ['AAPL', 'MSFT', 'GOOGL', 'JNJ'] // Companies with known segmentation data
      const apiCallCount = testSymbols.length

      // Rate limit compliance (FMP 300/minute = 5/second)
      expect(apiCallCount).toBeLessThanOrEqual(4)

      const startApiTime = Date.now()
      const promises = testSymbols.map(symbol =>
        service.getRevenueSegmentation(symbol)
      )
      const results = await Promise.allSettled(promises)
      const apiDuration = Date.now() - startApiTime

      // Rate limit compliance validation
      expect(apiDuration).toBeGreaterThanOrEqual((apiCallCount - 1) * 200) // Min 200ms between calls

      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled')
        if (result.status === 'fulfilled' && result.value) {
          const segmentation = result.value
          expect(segmentation).toHaveProperty('symbol', testSymbols[index])
          expect(segmentation).toHaveProperty('totalRevenue')
          expect(segmentation).toHaveProperty('segments')
          expect(segmentation).toHaveProperty('diversificationScore')

          // Total revenue validation
          expect(typeof segmentation.totalRevenue).toBe('number')
          expect(segmentation.totalRevenue).toBeGreaterThan(0)

          // Segments validation
          expect(Array.isArray(segmentation.geographicSegments)).toBe(true)
          expect(Array.isArray(segmentation.productSegments)).toBe(true)

          if (segmentation.geographicSegments.length > 0) {
            segmentation.geographicSegments.forEach(segment => {
              expect(segment).toHaveProperty('region')
              expect(segment).toHaveProperty('revenue')
              expect(segment).toHaveProperty('percentage')
              expect(segment).toHaveProperty('growthRate')

              expect(typeof segment.revenue).toBe('number')
              expect(segment.revenue).toBeGreaterThan(0)
              expect(typeof segment.percentage).toBe('number')
              expect(segment.percentage).toBeGreaterThan(0)
              expect(segment.percentage).toBeLessThanOrEqual(100)
            })
          }

          // Diversification score validation (0-10 scale)
          expect(typeof segmentation.diversificationScore).toBe('number')
          expect(segmentation.diversificationScore).toBeGreaterThanOrEqual(0)
          expect(segmentation.diversificationScore).toBeLessThanOrEqual(10)
        }
      })

      console.log(`✓ Revenue segmentation fetched: ${apiCallCount} symbols in ${apiDuration}ms`)
    }, 20000)

    test('should_analyze_geographic_revenue_distribution_with_growth_metrics', async () => {
      const symbol = 'AAPL' // Apple has strong geographic segmentation
      const geoAnalysis = await service.getGeographicRevenue(symbol)

      if (geoAnalysis) {
        // Geographic analysis structure validation
        expect(geoAnalysis).toHaveProperty('symbol', symbol)
        expect(geoAnalysis).toHaveProperty('regions')
        expect(geoAnalysis).toHaveProperty('domesticPercentage')
        expect(geoAnalysis).toHaveProperty('internationalPercentage')
        expect(geoAnalysis).toHaveProperty('diversificationRisk')
        expect(geoAnalysis).toHaveProperty('growthOpportunities')

        // Regions validation
        expect(Array.isArray(geoAnalysis.regions)).toBe(true)
        if (geoAnalysis.regions.length > 0) {
          let totalPercentage = 0

          geoAnalysis.regions.forEach(region => {
            expect(region).toHaveProperty('region')
            expect(region).toHaveProperty('revenue')
            expect(region).toHaveProperty('percentage')
            expect(region).toHaveProperty('yearOverYearGrowth')
            expect(region).toHaveProperty('marketPotential')

            expect(typeof region.revenue).toBe('number')
            expect(region.revenue).toBeGreaterThan(0)
            expect(typeof region.percentage).toBe('number')
            expect(region.percentage).toBeGreaterThan(0)
            expect(region.percentage).toBeLessThanOrEqual(100)

            totalPercentage += region.percentage

            // Market potential validation (0-10 scale)
            expect(typeof region.marketPotential).toBe('number')
            expect(region.marketPotential).toBeGreaterThanOrEqual(0)
            expect(region.marketPotential).toBeLessThanOrEqual(10)
          })

          // Total percentages should sum to approximately 100%
          expect(Math.abs(totalPercentage - 100)).toBeLessThan(5) // 5% tolerance
        }

        // Domestic/international split validation
        expect(typeof geoAnalysis.domesticPercentage).toBe('number')
        expect(typeof geoAnalysis.internationalPercentage).toBe('number')
        expect(geoAnalysis.domesticPercentage).toBeGreaterThanOrEqual(0)
        expect(geoAnalysis.internationalPercentage).toBeGreaterThanOrEqual(0)
        expect(Math.abs((geoAnalysis.domesticPercentage + geoAnalysis.internationalPercentage) - 100)).toBeLessThan(1)

        // Diversification risk validation (0-10 scale, higher = more risk)
        expect(typeof geoAnalysis.diversificationRisk).toBe('number')
        expect(geoAnalysis.diversificationRisk).toBeGreaterThanOrEqual(0)
        expect(geoAnalysis.diversificationRisk).toBeLessThanOrEqual(10)

        console.log(`✓ Geographic analysis: ${symbol} - ${geoAnalysis.regions.length} regions, Domestic: ${geoAnalysis.domesticPercentage}%, Risk: ${geoAnalysis.diversificationRisk}`)
      }
    })

    test('should_analyze_product_revenue_segments_with_competitive_analysis', async () => {
      const symbol = 'MSFT' // Microsoft has clear product segmentation
      const productAnalysis = await service.getProductRevenue(symbol)

      if (productAnalysis) {
        // Product analysis structure validation
        expect(productAnalysis).toHaveProperty('symbol', symbol)
        expect(productAnalysis).toHaveProperty('productLines')
        expect(productAnalysis).toHaveProperty('coreBusinessPercentage')
        expect(productAnalysis).toHaveProperty('emergingBusinessPercentage')
        expect(productAnalysis).toHaveProperty('productDiversification')
        expect(productAnalysis).toHaveProperty('competitivePosition')

        // Product lines validation
        expect(Array.isArray(productAnalysis.productLines)).toBe(true)
        if (productAnalysis.productLines.length > 0) {
          let totalRevenue = 0

          productAnalysis.productLines.forEach(product => {
            expect(product).toHaveProperty('name')
            expect(product).toHaveProperty('revenue')
            expect(product).toHaveProperty('percentage')
            expect(product).toHaveProperty('growthRate')
            expect(product).toHaveProperty('profitMargin')
            expect(product).toHaveProperty('maturityStage')
            expect(product).toHaveProperty('competitiveStrength')

            expect(typeof product.revenue).toBe('number')
            expect(product.revenue).toBeGreaterThan(0)
            expect(typeof product.percentage).toBe('number')
            expect(product.percentage).toBeGreaterThan(0)
            expect(product.percentage).toBeLessThanOrEqual(100)

            totalRevenue += product.revenue

            // Growth rate validation (can be negative)
            expect(typeof product.growthRate).toBe('number')

            // Profit margin validation (0-100%)
            expect(typeof product.profitMargin).toBe('number')
            expect(product.profitMargin).toBeGreaterThanOrEqual(0)
            expect(product.profitMargin).toBeLessThanOrEqual(100)

            // Maturity stage validation
            expect(['EMERGING', 'GROWTH', 'MATURE', 'DECLINING']).toContain(product.maturityStage)

            // Competitive strength validation (0-10 scale)
            expect(typeof product.competitiveStrength).toBe('number')
            expect(product.competitiveStrength).toBeGreaterThanOrEqual(0)
            expect(product.competitiveStrength).toBeLessThanOrEqual(10)
          })

          expect(totalRevenue).toBeGreaterThan(0)
        }

        // Core vs emerging business validation
        expect(typeof productAnalysis.coreBusinessPercentage).toBe('number')
        expect(typeof productAnalysis.emergingBusinessPercentage).toBe('number')
        expect(productAnalysis.coreBusinessPercentage).toBeGreaterThanOrEqual(0)
        expect(productAnalysis.emergingBusinessPercentage).toBeGreaterThanOrEqual(0)
        expect(productAnalysis.coreBusinessPercentage + productAnalysis.emergingBusinessPercentage).toBeLessThanOrEqual(100)

        // Product diversification score validation (0-10 scale)
        expect(typeof productAnalysis.productDiversification).toBe('number')
        expect(productAnalysis.productDiversification).toBeGreaterThanOrEqual(0)
        expect(productAnalysis.productDiversification).toBeLessThanOrEqual(10)

        console.log(`✓ Product analysis: ${symbol} - ${productAnalysis.productLines.length} products, Core: ${productAnalysis.coreBusinessPercentage}%, Diversification: ${productAnalysis.productDiversification}`)
      }
    })

    test('should_calculate_segment_analysis_with_weight_contribution', async () => {
      const symbol = 'JNJ' // J&J has diverse segments
      const segmentAnalysis = await service.getSegmentAnalysis(symbol)

      if (segmentAnalysis) {
        // Segment analysis structure validation
        expect(segmentAnalysis).toHaveProperty('symbol', symbol)
        expect(segmentAnalysis).toHaveProperty('overallDiversificationScore')
        expect(segmentAnalysis).toHaveProperty('riskScore')
        expect(segmentAnalysis).toHaveProperty('growthPotential')
        expect(segmentAnalysis).toHaveProperty('competitiveAdvantage')
        expect(segmentAnalysis).toHaveProperty('weightContribution')

        // Overall diversification score validation (0-10 scale)
        expect(typeof segmentAnalysis.overallDiversificationScore).toBe('number')
        expect(segmentAnalysis.overallDiversificationScore).toBeGreaterThanOrEqual(0)
        expect(segmentAnalysis.overallDiversificationScore).toBeLessThanOrEqual(10)

        // Risk score validation (0-10 scale, higher = more risk)
        expect(typeof segmentAnalysis.riskScore).toBe('number')
        expect(segmentAnalysis.riskScore).toBeGreaterThanOrEqual(0)
        expect(segmentAnalysis.riskScore).toBeLessThanOrEqual(10)

        // Growth potential validation (0-10 scale)
        expect(typeof segmentAnalysis.growthPotential).toBe('number')
        expect(segmentAnalysis.growthPotential).toBeGreaterThanOrEqual(0)
        expect(segmentAnalysis.growthPotential).toBeLessThanOrEqual(10)

        // Competitive advantage validation (0-10 scale)
        expect(typeof segmentAnalysis.competitiveAdvantage).toBe('number')
        expect(segmentAnalysis.competitiveAdvantage).toBeGreaterThanOrEqual(0)
        expect(segmentAnalysis.competitiveAdvantage).toBeLessThanOrEqual(10)

        // Weight contribution validation (revenue segmentation typically 3-7% weight)
        expect(typeof segmentAnalysis.weightContribution).toBe('number')
        expect(segmentAnalysis.weightContribution).toBeGreaterThanOrEqual(0)
        expect(segmentAnalysis.weightContribution).toBeLessThanOrEqual(0.07) // Max 7% weight

        // Risk/diversification inverse relationship validation
        if (segmentAnalysis.overallDiversificationScore > 7) {
          expect(segmentAnalysis.riskScore).toBeLessThan(5) // High diversification should mean lower risk
        }

        console.log(`✓ Segment analysis: ${symbol} - Diversification: ${segmentAnalysis.overallDiversificationScore}, Risk: ${segmentAnalysis.riskScore}, Weight: ${(segmentAnalysis.weightContribution * 100).toFixed(1)}%`)
      }
    })
  })

  describe('Performance Benchmarks and Memory Management', () => {
    test('should_process_revenue_segmentation_batch_within_performance_limits', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'JNJ', 'PG', 'KO']
      const memoryBefore = process.memoryUsage().heapUsed

      const startTime = Date.now()
      const results = await service.getRevenueSegmentationBatch(symbols)
      const processingTime = Date.now() - startTime

      const memoryAfter = process.memoryUsage().heapUsed
      const memoryIncrease = memoryAfter - memoryBefore

      // Performance benchmarks
      expect(processingTime).toBeLessThan(3000) // Under 3 seconds total
      expect(memoryIncrease).toBeLessThan(120 * 1024 * 1024) // Under 120MB memory increase

      // Results validation
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeLessThanOrEqual(symbols.length)

      results.forEach(result => {
        expect(result).toHaveProperty('symbol')
        expect(symbols).toContain(result.symbol)
        expect(result).toHaveProperty('segmentation')
        if (result.segmentation) {
          expect(result.segmentation).toHaveProperty('segmentAnalysis')
          expect(result.segmentation.segmentAnalysis.diversificationScore).toBeGreaterThanOrEqual(0)
          expect(result.segmentation.segmentAnalysis.diversificationScore).toBeLessThanOrEqual(10)

          expect(typeof result.segmentation.totalRevenue).toBe('number')
          expect(result.segmentation.totalRevenue).toBeGreaterThan(0)

          expect(Array.isArray(result.segmentation.geographicSegments)).toBe(true)
          expect(Array.isArray(result.segmentation.productSegments)).toBe(true)
        }
      })

      console.log(`✓ Batch processing: ${results.length} symbols in ${processingTime}ms, ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB memory`)
    }, 25000)

    test('should_implement_efficient_caching_for_complex_revenue_calculations', async () => {
      const symbol = 'GOOGL'

      // Clear cache for clean test
      service.clearCache()

      // First request - cache miss (complex calculations)
      const startTime1 = Date.now()
      const result1 = await service.getSegmentAnalysis(symbol)
      const duration1 = Date.now() - startTime1

      if (result1) {
        // Second request - cache hit
        const startTime2 = Date.now()
        const result2 = await service.getSegmentAnalysis(symbol)
        const duration2 = Date.now() - startTime2

        // Cache hit should be significantly faster
        expect(duration2).toBeLessThan(duration1 * 0.15) // At least 85% improvement

        // Results should be identical
        expect(JSON.stringify(result2)).toBe(JSON.stringify(result1))

        const cacheEfficiency = ((duration1 - duration2) / duration1) * 100
        console.log(`✓ Cache efficiency: ${cacheEfficiency.toFixed(1)}% improvement (${duration1}ms -> ${duration2}ms)`)
      }

      // Get cache statistics
      const cacheStats = service.getCacheStatistics?.()
      if (cacheStats) {
        expect(cacheStats.hitRatio).toBeGreaterThan(0.3) // At least 30% hit ratio
        console.log(`✓ Cache hit ratio: ${(cacheStats.hitRatio * 100).toFixed(1)}%`)
      }
    })

    test('should_handle_large_revenue_datasets_efficiently', async () => {
      const symbol = 'BRK.A' // Berkshire Hathaway has many segments
      const memoryBefore = process.memoryUsage()

      const startTime = Date.now()
      const segmentation = await service.getRevenueSegmentation(symbol)
      const processingTime = Date.now() - startTime

      const memoryAfter = process.memoryUsage()
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed

      // Performance validation for large datasets
      expect(processingTime).toBeLessThan(2500) // Should handle large data efficiently
      expect(memoryIncrease).toBeLessThan(80 * 1024 * 1024) // Under 80MB for large dataset

      if (segmentation && segmentation.segments.length > 10) {
        // Large segment count should not degrade performance significantly
        expect(segmentation.diversificationScore).toBeGreaterThan(5) // Should be well diversified

        console.log(`✓ Large dataset handled: ${segmentation.segments.length} segments in ${processingTime}ms, ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
      }
    }, 15000)
  })

  describe('Data Quality and Business Logic Validation', () => {
    test('should_validate_revenue_segment_calculations_and_percentages', async () => {
      const symbol = 'PG' // P&G has clear product segments
      const segmentation = await service.getRevenueSegmentation(symbol)

      if (segmentation && segmentation.segments.length > 0) {
        let calculatedTotal = 0
        let totalPercentage = 0

        segmentation.segments.forEach(segment => {
          // Individual segment validation
          expect(segment.revenue).toBeGreaterThan(0)
          expect(segment.percentage).toBeGreaterThan(0)
          expect(segment.percentage).toBeLessThan(100) // No single segment should be 100%

          // Percentage calculation validation
          const expectedPercentage = (segment.revenue / segmentation.totalRevenue) * 100
          const percentageTolerance = 2 // 2% tolerance for rounding
          expect(Math.abs(segment.percentage - expectedPercentage)).toBeLessThan(percentageTolerance)

          calculatedTotal += segment.revenue
          totalPercentage += segment.percentage
        })

        // Total calculations validation
        const revenueTolerance = segmentation.totalRevenue * 0.05 // 5% tolerance
        expect(Math.abs(calculatedTotal - segmentation.totalRevenue)).toBeLessThan(revenueTolerance)

        // Percentage totals should sum to approximately 100%
        expect(Math.abs(totalPercentage - 100)).toBeLessThan(3) // 3% tolerance

        console.log(`✓ Revenue calculations validated: ${symbol} - ${segmentation.segments.length} segments, Total: $${(segmentation.totalRevenue / 1000000).toFixed(0)}M`)
      }
    })

    test('should_calculate_accurate_diversification_scores_based_on_distribution', async () => {
      const symbol = 'KO' // Coca-Cola - geographic diversification
      const geoAnalysis = await service.getGeographicRevenue(symbol)

      if (geoAnalysis) {
        const { diversificationRisk, regions } = geoAnalysis

        // Calculate expected diversification based on distribution
        if (regions.length > 0) {
          // Herfindahl index calculation for diversification
          let herfindahlIndex = 0
          regions.forEach(region => {
            const share = region.percentage / 100
            herfindahlIndex += share * share
          })

          // Diversification score should be inversely related to Herfindahl index
          // Perfect diversification (all equal) would have low Herfindahl, high diversification score
          // High concentration would have high Herfindahl, high diversification risk

          if (herfindahlIndex > 0.5) { // Highly concentrated
            expect(diversificationRisk).toBeGreaterThan(6) // High risk
          }

          if (herfindahlIndex < 0.2) { // Well diversified
            expect(diversificationRisk).toBeLessThan(4) // Low risk
          }

          console.log(`✓ Diversification scoring: ${symbol} - Herfindahl: ${herfindahlIndex.toFixed(3)}, Risk: ${diversificationRisk}`)
        }
      }
    })

    test('should_identify_growth_opportunities_and_market_potential_accurately', async () => {
      const symbol = 'TSLA' // Tesla - emerging markets opportunity
      const geoAnalysis = await service.getGeographicRevenue(symbol)

      if (geoAnalysis && geoAnalysis.growthOpportunities) {
        expect(Array.isArray(geoAnalysis.growthOpportunities)).toBe(true)

        geoAnalysis.growthOpportunities.forEach(opportunity => {
          expect(opportunity).toHaveProperty('region')
          expect(opportunity).toHaveProperty('currentShare')
          expect(opportunity).toHaveProperty('potentialShare')
          expect(opportunity).toHaveProperty('growthPotential')
          expect(opportunity).toHaveProperty('marketSize')
          expect(opportunity).toHaveProperty('timeframe')

          // Current share should be less than potential share for true opportunities
          expect(opportunity.potentialShare).toBeGreaterThan(opportunity.currentShare)

          // Growth potential validation (0-10 scale)
          expect(opportunity.growthPotential).toBeGreaterThanOrEqual(0)
          expect(opportunity.growthPotential).toBeLessThanOrEqual(10)

          // Market size should be positive
          expect(opportunity.marketSize).toBeGreaterThan(0)

          // Timeframe validation
          expect(['SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM']).toContain(opportunity.timeframe)
        })

        console.log(`✓ Growth opportunities: ${symbol} - ${geoAnalysis.growthOpportunities.length} identified`)
      }
    })

    test('should_calculate_appropriate_weight_contribution_based_on_segment_quality', async () => {
      const symbol = 'JNJ'
      const segmentAnalysis = await service.getSegmentAnalysis(symbol)

      if (segmentAnalysis && segmentAnalysis.weightContribution > 0) {
        const { overallDiversificationScore, riskScore, weightContribution } = segmentAnalysis

        // Weight should be higher for well-diversified, low-risk companies
        if (overallDiversificationScore > 7 && riskScore < 3) {
          expect(weightContribution).toBeGreaterThan(0.05) // At least 5%
        }

        // Weight should be lower for poorly diversified or high-risk companies
        if (overallDiversificationScore < 3 || riskScore > 7) {
          expect(weightContribution).toBeLessThan(0.03) // Less than 3%
        }

        // Weight calculation validation
        const expectedWeight = ((overallDiversificationScore * 0.6) + ((10 - riskScore) * 0.4)) / 10 * 0.07 // Max 7%
        const weightTolerance = 0.02 // 2% tolerance

        expect(Math.abs(weightContribution - expectedWeight)).toBeLessThan(weightTolerance)

        console.log(`✓ Weight calculation: ${symbol} - Diversification: ${overallDiversificationScore}, Risk: ${riskScore}, Weight: ${(weightContribution * 100).toFixed(2)}%`)
      }
    })
  })

  describe('Error Handling and Data Validation', () => {
    test('should_handle_companies_without_segment_data_gracefully', async () => {
      const symbol = 'INVALID_SYMBOL_XYZ'

      const segmentation = await service.getRevenueSegmentation(symbol)
      const geoAnalysis = await service.getGeographicRevenue(symbol)
      const productAnalysis = await service.getProductRevenue(symbol)

      expect(segmentation).toBe(null)
      expect(geoAnalysis).toBe(null)
      expect(productAnalysis).toBe(null)

      console.log('✓ Invalid symbols handled gracefully')
    })

    test('should_validate_segment_data_consistency_and_detect_anomalies', async () => {
      const symbol = 'WMT'
      const segmentation = await service.getRevenueSegmentation(symbol)

      if (segmentation && segmentation.segments.length > 0) {
        // Detect anomalous percentage values
        segmentation.segments.forEach(segment => {
          expect(segment.percentage).toBeGreaterThan(0.1) // At least 0.1%
          expect(segment.percentage).toBeLessThan(95) // No segment should be >95%

          // Detect anomalous revenue values
          expect(segment.revenue).toBeGreaterThan(1000) // At least $1k (very low threshold)
          expect(segment.revenue).toBeLessThan(segmentation.totalRevenue * 1.1) // No segment larger than total

          // Growth rate sanity check
          if (segment.growthRate !== undefined) {
            expect(segment.growthRate).toBeGreaterThan(-90) // Not more than -90% decline
            expect(segment.growthRate).toBeLessThan(500) // Not more than 500% growth
          }
        })

        console.log('✓ Data consistency validation passed')
      }
    })

    test('should_implement_fallback_for_incomplete_segment_data', async () => {
      const symbol = 'AAPL'

      // Test with limited data availability
      const limitedService = new RevenueSegmentationService(fmpApi, {
        enableGeographicAnalysis: false, // Disable geographic analysis
        enableProductAnalysis: true,
        maxSegments: 3 // Limit segments
      })

      const analysis = await limitedService.getSegmentAnalysis(symbol)

      if (analysis) {
        // Should still provide meaningful analysis with limited data
        expect(analysis).toHaveProperty('overallDiversificationScore')
        expect(analysis).toHaveProperty('riskScore')

        // Scores should reflect data limitations
        expect(analysis.dataQuality).toBeDefined()
        expect(analysis.dataQuality.dataCompleteness).toBeLessThan(1.0) // Not complete data

        console.log(`✓ Fallback handling: limited data analysis completed with ${(analysis.dataQuality.dataCompleteness * 100).toFixed(0)}% completeness`)
      }
    })
  })

  describe('Integration with Analysis Engine', () => {
    test('should_provide_formatted_data_for_algorithm_engine_integration', async () => {
      const symbol = 'PG'
      const segmentAnalysis = await service.getSegmentAnalysis(symbol)

      if (segmentAnalysis) {
        // Should provide data in format expected by AlgorithmEngine
        expect(segmentAnalysis).toHaveProperty('symbol')
        expect(segmentAnalysis).toHaveProperty('timestamp')
        expect(segmentAnalysis).toHaveProperty('source', 'revenue_segmentation')
        expect(segmentAnalysis).toHaveProperty('overallDiversificationScore')
        expect(segmentAnalysis).toHaveProperty('weightContribution')
        expect(segmentAnalysis).toHaveProperty('dataQuality')

        // Data quality indicators
        expect(segmentAnalysis.dataQuality).toHaveProperty('dataAvailable', true)
        expect(segmentAnalysis.dataQuality).toHaveProperty('lastUpdated')
        expect(segmentAnalysis.dataQuality).toHaveProperty('confidence')

        // Score should be normalized to 0-10 scale
        expect(segmentAnalysis.overallDiversificationScore).toBeGreaterThanOrEqual(0)
        expect(segmentAnalysis.overallDiversificationScore).toBeLessThanOrEqual(10)

        // Timestamp should be recent
        expect(segmentAnalysis.timestamp).toBeGreaterThan(Date.now() - 300000) // Within 5 minutes

        console.log(`✓ Algorithm integration format validated: ${symbol}`)
      }
    })

    test('should_contribute_appropriate_weight_to_composite_scoring', async () => {
      const symbols = ['AAPL', 'MSFT', 'JNJ']

      for (const symbol of symbols) {
        const analysis = await service.getSegmentAnalysis(symbol)

        if (analysis && analysis.weightContribution > 0) {
          // Weight contribution should be reasonable for revenue segmentation factor
          expect(analysis.weightContribution).toBeGreaterThan(0.01) // At least 1%
          expect(analysis.weightContribution).toBeLessThan(0.08) // Max 8%

          // Should provide breakdown for transparency
          if (analysis.contributionBreakdown) {
            expect(analysis.contributionBreakdown).toHaveProperty('diversificationComponent')
            expect(analysis.contributionBreakdown).toHaveProperty('riskComponent')
            expect(analysis.contributionBreakdown).toHaveProperty('qualityComponent')

            const totalComponents =
              analysis.contributionBreakdown.diversificationComponent +
              analysis.contributionBreakdown.riskComponent +
              analysis.contributionBreakdown.qualityComponent

            // Components should sum to total weight
            const componentTolerance = 0.005 // 0.5% tolerance
            expect(Math.abs(totalComponents - analysis.weightContribution)).toBeLessThan(componentTolerance)
          }

          console.log(`✓ Weight contribution validated: ${symbol} - ${(analysis.weightContribution * 100).toFixed(2)}%`)
        }
      }
    })
  })
})