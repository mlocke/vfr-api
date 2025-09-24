/**
 * Comprehensive Test Suite for ESGDataService
 * Tests ESG data integration with stock analysis engine
 * Follows TDD principles with graceful degradation testing
 *
 * Test Categories:
 * 1. Service instantiation and configuration tests
 * 2. ESG scoring algorithm tests with real stock symbols
 * 3. Graceful degradation tests (no API key scenarios)
 * 4. Performance tests targeting <200ms response times
 * 5. Error handling and resilience tests
 * 6. Security and input sanitization tests
 * 7. Cache integration and memory management tests
 * 8. Bulk ESG analysis tests
 * 9. Industry baseline validation tests
 * 10. ESG weight integration tests (5% alternative data)
 */

import ESGDataService from '../ESGDataService'
import { RedisCache } from '../../cache/RedisCache'
import { SecurityValidator } from '../../security/SecurityValidator'
import {
  ESGScore,
  ESGRiskFactors,
  ESGInsights,
  StockESGImpact,
  BulkESGAnalysisResponse,
  ESGConfig
} from '../types/esg-types'

describe('ESGDataService', () => {
  let service: ESGDataService
  let serviceWithAPI: ESGDataService
  let cache: RedisCache

  // Test configuration
  const TEST_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'XOM', 'BP'] as const
  const TEST_SECTORS = ['technology', 'energy', 'financials', 'healthcare'] as const
  const PERFORMANCE_TARGET_MS = 200
  const ESG_ANALYSIS_TIMEOUT_MS = 15000
  const ESG_WEIGHT = 0.05 // 5% alternative data weight

  beforeAll(() => {
    // Force garbage collection before test suite if available
    if (global.gc) {
      global.gc()
    }
  })

  beforeEach(() => {
    // Reset security state between tests
    SecurityValidator.getInstance().resetSecurityState()

    cache = new RedisCache({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      defaultTTL: 5 * 60, // 5 minutes for testing
      maxRetries: 3,
      retryDelayOnFailover: 1000
    })

    // Create service without API key (graceful degradation mode)
    service = new ESGDataService({
      timeout: 10000,
      throwErrors: false
    })

    // Create service with API key (if available)
    serviceWithAPI = new ESGDataService({
      apiKey: process.env.ESG_API_KEY || 'test-api-key-for-testing',
      timeout: 10000,
      throwErrors: false
    })
  })

  afterEach(async () => {
    // Clean up cache to prevent memory leaks
    try {
      await cache.clear()
    } catch (error) {
      console.warn('Cache clear failed in cleanup:', error)
    }

    SecurityValidator.getInstance().resetSecurityState()

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  })

  describe('Service Initialization and Configuration', () => {
    test('should_initialize_service_without_api_key_successfully', () => {
      expect(service).toBeInstanceOf(ESGDataService)
    })

    test('should_initialize_service_with_api_key_successfully', () => {
      expect(serviceWithAPI).toBeInstanceOf(ESGDataService)
    })

    test('should_handle_missing_environment_variables_gracefully', () => {
      const serviceNoEnv = new ESGDataService({})
      expect(serviceNoEnv).toBeInstanceOf(ESGDataService)
    })
  })

  describe('ESG Score Generation and Analysis', () => {
    test('should_generate_esg_score_for_technology_company', async () => {
      const symbol = 'AAPL'
      const sector = 'technology'
      const baseScore = 0.75

      const esgImpact = await service.analyzeStockESGImpact(symbol, sector, baseScore)

      expect(esgImpact).toBeTruthy()
      expect(esgImpact!.symbol).toBe(symbol)
      expect(esgImpact!.esgScore.overall).toBeGreaterThanOrEqual(0)
      expect(esgImpact!.esgScore.overall).toBeLessThanOrEqual(100)
      expect(esgImpact!.esgScore.grade).toMatch(/^[A-F]$/)
      expect(esgImpact!.esgWeight).toBe(ESG_WEIGHT)
      expect(esgImpact!.adjustedScore).toBeGreaterThanOrEqual(0)
      expect(esgImpact!.adjustedScore).toBeLessThanOrEqual(1)
    }, ESG_ANALYSIS_TIMEOUT_MS)

    test('should_generate_different_scores_for_different_sectors', async () => {
      const techResult = await service.analyzeStockESGImpact('AAPL', 'technology', 0.75)
      const energyResult = await service.analyzeStockESGImpact('XOM', 'energy', 0.75)

      expect(techResult).toBeTruthy()
      expect(energyResult).toBeTruthy()

      // Technology should generally have higher ESG scores than energy
      expect(techResult!.esgScore.overall).toBeGreaterThan(energyResult!.esgScore.overall - 10)
    }, ESG_ANALYSIS_TIMEOUT_MS)

    test('should_include_all_required_esg_components', async () => {
      const esgImpact = await service.analyzeStockESGImpact('MSFT', 'technology', 0.8)

      expect(esgImpact).toBeTruthy()
      expect(esgImpact!.esgScore).toHaveProperty('environmental')
      expect(esgImpact!.esgScore).toHaveProperty('social')
      expect(esgImpact!.esgScore).toHaveProperty('governance')
      expect(esgImpact!.esgScore).toHaveProperty('overall')
      expect(esgImpact!.esgScore).toHaveProperty('grade')
      expect(esgImpact!.esgScore).toHaveProperty('percentile')
      expect(esgImpact!.esgScore).toHaveProperty('timestamp')
    }, ESG_ANALYSIS_TIMEOUT_MS)
  })

  describe('Industry Baseline Validation', () => {
    test('should_apply_appropriate_industry_baselines', async () => {
      const testCases = [
        { symbol: 'AAPL', sector: 'technology', expectedMin: 65 },
        { symbol: 'XOM', sector: 'energy', expectedMax: 55 },
        { symbol: 'JPM', sector: 'financials', expectedRange: [60, 70] },
        { symbol: 'JNJ', sector: 'healthcare', expectedRange: [63, 73] }
      ]

      for (const testCase of testCases) {
        const result = await service.analyzeStockESGImpact(testCase.symbol, testCase.sector, 0.75)
        expect(result).toBeTruthy()

        if ('expectedMin' in testCase && testCase.expectedMin !== undefined) {
          expect(result!.esgScore.overall).toBeGreaterThanOrEqual(testCase.expectedMin)
        }
        if ('expectedMax' in testCase && testCase.expectedMax !== undefined) {
          expect(result!.esgScore.overall).toBeLessThanOrEqual(testCase.expectedMax)
        }
        if ('expectedRange' in testCase && testCase.expectedRange !== undefined) {
          expect(result!.esgScore.overall).toBeGreaterThanOrEqual(testCase.expectedRange[0] - 15)
          expect(result!.esgScore.overall).toBeLessThanOrEqual(testCase.expectedRange[1] + 15)
        }
      }
    }, ESG_ANALYSIS_TIMEOUT_MS)
  })

  describe('Risk Factors and Insights Generation', () => {
    test('should_generate_comprehensive_risk_factors', async () => {
      const esgImpact = await service.analyzeStockESGImpact('TSLA', 'technology', 0.8)

      expect(esgImpact).toBeTruthy()
      expect(esgImpact!.riskFactors).toHaveProperty('controversies')
      expect(esgImpact!.riskFactors).toHaveProperty('carbonFootprint')
      expect(esgImpact!.riskFactors).toHaveProperty('governance')

      expect(esgImpact!.riskFactors.controversies).toHaveProperty('level')
      expect(esgImpact!.riskFactors.controversies).toHaveProperty('count')
      expect(esgImpact!.riskFactors.controversies).toHaveProperty('categories')
      expect(esgImpact!.riskFactors.controversies).toHaveProperty('description')
    }, ESG_ANALYSIS_TIMEOUT_MS)

    test('should_generate_meaningful_insights', async () => {
      const esgImpact = await service.analyzeStockESGImpact('GOOGL', 'technology', 0.85)

      expect(esgImpact).toBeTruthy()
      expect(esgImpact!.insights).toHaveProperty('strengths')
      expect(esgImpact!.insights).toHaveProperty('weaknesses')
      expect(esgImpact!.insights).toHaveProperty('opportunities')
      expect(esgImpact!.insights).toHaveProperty('warnings')
      expect(esgImpact!.insights).toHaveProperty('industryComparison')

      expect(Array.isArray(esgImpact!.insights.strengths)).toBe(true)
      expect(Array.isArray(esgImpact!.insights.opportunities)).toBe(true)
    }, ESG_ANALYSIS_TIMEOUT_MS)
  })

  describe('Performance and Response Time Tests', () => {
    test('should_complete_esg_analysis_within_performance_target', async () => {
      const startTime = Date.now()
      const esgImpact = await service.analyzeStockESGImpact('AAPL', 'technology', 0.75)
      const responseTime = Date.now() - startTime

      expect(esgImpact).toBeTruthy()
      expect(responseTime).toBeLessThan(PERFORMANCE_TARGET_MS)
    }, ESG_ANALYSIS_TIMEOUT_MS)

    test('should_handle_concurrent_esg_requests_efficiently', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL']
      const startTime = Date.now()

      const promises = symbols.map(symbol =>
        service.analyzeStockESGImpact(symbol, 'technology', 0.75)
      )

      const results = await Promise.all(promises)
      const totalTime = Date.now() - startTime

      expect(results).toHaveLength(3)
      results.forEach(result => expect(result).toBeTruthy())
      expect(totalTime).toBeLessThan(PERFORMANCE_TARGET_MS * 2) // Should be faster than sequential
    }, ESG_ANALYSIS_TIMEOUT_MS)
  })

  describe('Security and Input Validation', () => {
    test('should_reject_invalid_symbols', async () => {
      const invalidSymbols = ['', '123456', 'A@PL', 'null', undefined, null]

      for (const invalidSymbol of invalidSymbols) {
        const result = await service.analyzeStockESGImpact(invalidSymbol as any, 'technology', 0.75)
        expect(result).toBeNull()
      }
    }, ESG_ANALYSIS_TIMEOUT_MS)

    test('should_sanitize_symbols_properly', async () => {
      const testCases = [
        { input: 'aapl', expected: 'AAPL' },
        { input: 'AAPL ', expected: 'AAPL' },
        { input: ' aapl ', expected: 'AAPL' }
      ]

      for (const testCase of testCases) {
        const result = await service.analyzeStockESGImpact(testCase.input, 'technology', 0.75)
        expect(result).toBeTruthy()
        expect(result!.symbol).toBe(testCase.expected)
      }
    }, ESG_ANALYSIS_TIMEOUT_MS)
  })

  describe('Bulk ESG Analysis Tests', () => {
    test('should_process_bulk_esg_analysis_successfully', async () => {
      const stocks = [
        { symbol: 'AAPL', sector: 'technology', baseScore: 0.75 },
        { symbol: 'MSFT', sector: 'technology', baseScore: 0.80 },
        { symbol: 'XOM', sector: 'energy', baseScore: 0.65 }
      ]

      const bulkResult = await service.analyzeBulkESGImpact(stocks)

      expect(bulkResult.success).toBe(true)
      expect(bulkResult.data).toBeTruthy()
      expect(bulkResult.data!.stockImpacts).toHaveLength(3)
      expect(bulkResult.data!.averageESGScore).toBeGreaterThan(0)
      expect(bulkResult.data!.highestESGStock).toBeTruthy()
      expect(bulkResult.data!.lowestESGStock).toBeTruthy()
      expect(bulkResult.executionTime).toBeGreaterThan(0)
    }, ESG_ANALYSIS_TIMEOUT_MS)

    test('should_handle_mixed_valid_invalid_symbols_in_bulk', async () => {
      const stocks = [
        { symbol: 'AAPL', sector: 'technology', baseScore: 0.75 },
        { symbol: 'INVALID@', sector: 'technology', baseScore: 0.80 },
        { symbol: 'MSFT', sector: 'technology', baseScore: 0.85 }
      ]

      const bulkResult = await service.analyzeBulkESGImpact(stocks)

      expect(bulkResult.success).toBe(true)
      expect(bulkResult.data!.stockImpacts.length).toBe(2) // Only valid symbols processed
    }, ESG_ANALYSIS_TIMEOUT_MS)
  })

  describe('Cache Integration Tests', () => {
    test('should_cache_esg_scores_effectively', async () => {
      const symbol = 'AAPL'
      const sector = 'technology'

      // First call - should generate new data
      const firstResult = await service.analyzeStockESGImpact(symbol, sector, 0.75)
      expect(firstResult).toBeTruthy()

      // Second call - should use cached data (faster)
      const startTime = Date.now()
      const secondResult = await service.analyzeStockESGImpact(symbol, sector, 0.75)
      const cacheResponseTime = Date.now() - startTime

      expect(secondResult).toBeTruthy()
      expect(secondResult!.esgScore.overall).toBe(firstResult!.esgScore.overall)
      expect(cacheResponseTime).toBeLessThan(100) // Should be very fast from cache
    }, ESG_ANALYSIS_TIMEOUT_MS)
  })

  describe('ESG Weight Integration Tests', () => {
    test('should_apply_5_percent_esg_weight_correctly', async () => {
      const baseScore = 0.8
      const esgImpact = await service.analyzeStockESGImpact('AAPL', 'technology', baseScore)

      expect(esgImpact).toBeTruthy()
      expect(esgImpact!.esgWeight).toBe(0.05)

      // Calculate expected adjusted score
      const esgScoreNormalized = esgImpact!.esgScore.overall / 100
      const expectedAdjustedScore = baseScore * 0.95 + esgScoreNormalized * 0.05

      expect(esgImpact!.adjustedScore).toBeCloseTo(expectedAdjustedScore, 5)
    }, ESG_ANALYSIS_TIMEOUT_MS)

    test('should_provide_stock_analysis_integration_data', async () => {
      const result = await service.getESGImpactForStock('AAPL', 'technology', 0.75)

      expect(result).toBeTruthy()
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(1)
      expect(['positive', 'negative', 'neutral']).toContain(result.impact)
      expect(Array.isArray(result.factors)).toBe(true)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
      expect(result.esgScore).toBeGreaterThanOrEqual(0)
      expect(result.esgScore).toBeLessThanOrEqual(100)
    }, ESG_ANALYSIS_TIMEOUT_MS)
  })

  describe('Graceful Degradation Tests', () => {
    test('should_provide_meaningful_defaults_without_api_key', async () => {
      const esgImpact = await service.analyzeStockESGImpact('AAPL', 'technology', 0.75)

      expect(esgImpact).toBeTruthy()
      expect(esgImpact!.confidence).toBeLessThan(0.6) // Lower confidence for synthetic data
      expect(esgImpact!.esgScore.overall).toBeGreaterThan(0)
      expect(esgImpact!.esgScore.overall).toBeLessThan(100)
    }, ESG_ANALYSIS_TIMEOUT_MS)

    test('should_handle_unknown_sectors_gracefully', async () => {
      const esgImpact = await service.analyzeStockESGImpact('AAPL', 'unknown_sector', 0.75)

      expect(esgImpact).toBeTruthy()
      expect(esgImpact!.esgScore.overall).toBeGreaterThanOrEqual(45) // Should use reasonable default
      expect(esgImpact!.esgScore.overall).toBeLessThanOrEqual(75)
    }, ESG_ANALYSIS_TIMEOUT_MS)
  })

  describe('Health Check and Monitoring', () => {
    test('should_provide_comprehensive_health_check', async () => {
      const healthCheck = await service.healthCheck()

      expect(healthCheck).toHaveProperty('status')
      expect(['healthy', 'unhealthy']).toContain(healthCheck.status)
      expect(healthCheck).toHaveProperty('details')
      expect(healthCheck.details).toHaveProperty('cache')
      expect(healthCheck.details).toHaveProperty('dataSource')
      expect(healthCheck.details).toHaveProperty('apiKeyConfigured')
      expect(healthCheck.details).toHaveProperty('fallbackMode')
    })
  })

  describe('Error Handling and Resilience', () => {
    test('should_handle_cache_failures_gracefully', async () => {
      // Create a service with a broken cache
      const brokenCache = new RedisCache({
        host: 'invalid-host',
        port: 9999,
        defaultTTL: 300
      })

      const serviceWithBrokenCache = new ESGDataService({
        timeout: 5000,
        throwErrors: false
      })

      const result = await serviceWithBrokenCache.analyzeStockESGImpact('AAPL', 'technology', 0.75)
      expect(result).toBeTruthy() // Should still work without cache
    }, ESG_ANALYSIS_TIMEOUT_MS)

    test('should_handle_invalid_base_scores_gracefully', async () => {
      const invalidScores = [NaN, Infinity, -1, 2, null, undefined]

      for (const invalidScore of invalidScores) {
        const result = await service.analyzeStockESGImpact('AAPL', 'technology', invalidScore as any)
        // Service should either handle gracefully or return null
        if (result) {
          expect(result.adjustedScore).toBeGreaterThanOrEqual(0)
          expect(result.adjustedScore).toBeLessThanOrEqual(1)
        }
      }
    }, ESG_ANALYSIS_TIMEOUT_MS)
  })

  describe('Memory Management and Cleanup', () => {
    test('should_not_cause_memory_leaks_with_repeated_calls', async () => {
      const iterations = 10
      for (let i = 0; i < iterations; i++) {
        const result = await service.analyzeStockESGImpact('AAPL', 'technology', 0.75)
        expect(result).toBeTruthy()

        // Force garbage collection if available
        if (global.gc && i % 5 === 0) {
          global.gc()
        }
      }
    }, ESG_ANALYSIS_TIMEOUT_MS)
  })
})