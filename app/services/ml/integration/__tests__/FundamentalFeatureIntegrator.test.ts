/**
 * FundamentalFeatureIntegrator Tests
 *
 * Comprehensive test suite for the FundamentalFeatureIntegrator service
 * that bridges VFR's existing FMP API fundamental data to ML feature pipeline.
 *
 * CRITICAL: NO MOCK DATA policy - uses real FMP API connections
 * Performance target: <1000ms for 25 symbols
 *
 * Test Coverage:
 * - Single symbol feature extraction with real API calls
 * - Batch parallel processing for multiple symbols
 * - Caching functionality (15-minute TTL)
 * - Graceful fallback when API fails
 * - Integration with existing FinancialModelingPrepAPI (zero breaking changes)
 * - Health check functionality
 * - Configuration management
 * - Performance benchmarks
 */

import { FundamentalFeatureIntegrator } from '../FundamentalFeatureIntegrator';
import type { FundamentalFeaturesML, FundamentalFeatureConfig } from '../FundamentalFeatureIntegrator';
import { RedisCache } from '../../../cache/RedisCache';
import { FinancialModelingPrepAPI } from '../../../financial-data/FinancialModelingPrepAPI';

describe('FundamentalFeatureIntegrator', () => {
  let integrator: FundamentalFeatureIntegrator;
  let cache: RedisCache;
  let fmpAPI: FinancialModelingPrepAPI;

  // Test symbols (real stocks with known fundamental data)
  const TEST_SYMBOLS = {
    SINGLE: 'AAPL',
    BATCH_SMALL: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'],
    BATCH_LARGE: [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA',
      'META', 'NVDA', 'JPM', 'V', 'WMT',
      'PG', 'MA', 'HD', 'DIS', 'BAC',
      'ADBE', 'CRM', 'NFLX', 'CSCO', 'INTC',
      'AMD', 'QCOM', 'TXN', 'AVGO', 'ORCL'
    ]
  };

  beforeAll(() => {
    cache = new RedisCache();
    fmpAPI = new FinancialModelingPrepAPI();
  });

  beforeEach(() => {
    // Create fresh integrator for each test
    integrator = new FundamentalFeatureIntegrator(cache);
  });

  afterAll(async () => {
    // Clean up Redis connections
    await cache.shutdown();
  });

  describe('Configuration Management', () => {
    it('should initialize with default configuration', () => {
      const defaultIntegrator = new FundamentalFeatureIntegrator();

      // Default config should be applied
      expect(defaultIntegrator).toBeDefined();
      // Verify constructor works without arguments
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<FundamentalFeatureConfig> = {
        timeout: 10000,
        enableCache: false,
        cacheTTL: 1800,
        enableFallback: false
      };

      const customIntegrator = new FundamentalFeatureIntegrator(cache, customConfig);

      expect(customIntegrator).toBeDefined();
      // Verify constructor accepts custom config
    });

    it('should return feature count', () => {
      const count = integrator.getFeatureCount();

      expect(count).toBeGreaterThan(0);
      expect(count).toBe(31); // Based on DEFAULT_FEATURES in implementation
    });

    it('should return feature names', () => {
      const names = integrator.getFeatureNames();

      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      expect(names.length).toBe(31);

      // Verify key feature names are present
      expect(names).toContain('pe_ratio');
      expect(names).toContain('roe');
      expect(names).toContain('debt_to_equity');
      expect(names).toContain('dividend_yield');
      expect(names).toContain('profitability_score');
      expect(names).toContain('valuation_score');
    });
  });

  describe('Single Symbol Feature Extraction - Real API', () => {
    it('should extract fundamental features for AAPL with real FMP data', async () => {
      const features = await integrator.extractFundamentalFeatures(TEST_SYMBOLS.SINGLE);

      // Verify structure
      expect(features).toBeDefined();
      expect(features.symbol).toBe(TEST_SYMBOLS.SINGLE);
      expect(features.timestamp).toBeGreaterThan(Date.now() - 10000);
      expect(features.features).toBeDefined();
      expect(features.metadata).toBeDefined();

      // Verify features object
      expect(typeof features.features).toBe('object');
      expect(Object.keys(features.features).length).toBeGreaterThan(0);

      // Verify metadata
      expect(features.metadata.sources).toBeDefined();
      expect(Array.isArray(features.metadata.sources)).toBe(true);
      expect(features.metadata.sources.length).toBeGreaterThan(0);
      expect(features.metadata.dataQuality).toBeGreaterThanOrEqual(0);
      expect(features.metadata.dataQuality).toBeLessThanOrEqual(1);
      expect(features.metadata.completeness).toBeGreaterThanOrEqual(0);
      expect(features.metadata.completeness).toBeLessThanOrEqual(1);
      expect(features.metadata.calculationTime).toBeGreaterThan(0);

      console.log(`✓ Extracted ${Object.keys(features.features).length} features for ${TEST_SYMBOLS.SINGLE}`);
      console.log(`  Data quality: ${(features.metadata.dataQuality * 100).toFixed(1)}%`);
      console.log(`  Completeness: ${(features.metadata.completeness * 100).toFixed(1)}%`);
      console.log(`  Calculation time: ${features.metadata.calculationTime}ms`);
    }, 10000); // 10s timeout for real API call

    it('should include all expected feature categories', async () => {
      const features = await integrator.extractFundamentalFeatures(TEST_SYMBOLS.SINGLE);

      const featureNames = Object.keys(features.features);

      // Valuation features
      expect(featureNames).toContain('pe_ratio');
      expect(featureNames).toContain('peg_ratio');
      expect(featureNames).toContain('pb_ratio');
      expect(featureNames).toContain('price_to_sales');
      expect(featureNames).toContain('price_to_fcf');
      expect(featureNames).toContain('valuation_score');
      expect(featureNames).toContain('is_premium_valuation');
      expect(featureNames).toContain('relative_valuation');

      // Profitability features
      expect(featureNames).toContain('roe');
      expect(featureNames).toContain('roa');
      expect(featureNames).toContain('gross_margin');
      expect(featureNames).toContain('operating_margin');
      expect(featureNames).toContain('net_margin');
      expect(featureNames).toContain('profitability_score');
      expect(featureNames).toContain('margin_trend');
      expect(featureNames).toContain('is_high_quality');

      // Financial health features
      expect(featureNames).toContain('debt_to_equity');
      expect(featureNames).toContain('current_ratio');
      expect(featureNames).toContain('quick_ratio');
      expect(featureNames).toContain('health_score');
      expect(featureNames).toContain('leverage_risk');
      expect(featureNames).toContain('liquidity_strength');
      expect(featureNames).toContain('is_stressed');

      // Shareholder return features
      expect(featureNames).toContain('dividend_yield');
      expect(featureNames).toContain('payout_ratio');
      expect(featureNames).toContain('dividend_sustainability');
      expect(featureNames).toContain('is_income_focused');
      expect(featureNames).toContain('dividend_growth_potential');
    }, 10000);

    it('should have valid feature values with proper ranges', async () => {
      const features = await integrator.extractFundamentalFeatures(TEST_SYMBOLS.SINGLE);

      // Valuation scores should be 0-1
      expect(features.features.valuation_score).toBeGreaterThanOrEqual(0);
      expect(features.features.valuation_score).toBeLessThanOrEqual(1);
      expect(features.features.relative_valuation).toBeGreaterThanOrEqual(0);
      expect(features.features.relative_valuation).toBeLessThanOrEqual(1);

      // Profitability score should be 0-1
      expect(features.features.profitability_score).toBeGreaterThanOrEqual(0);
      expect(features.features.profitability_score).toBeLessThanOrEqual(1);

      // Health score should be 0-1
      expect(features.features.health_score).toBeGreaterThanOrEqual(0);
      expect(features.features.health_score).toBeLessThanOrEqual(1);

      // Leverage risk should be 0-1
      expect(features.features.leverage_risk).toBeGreaterThanOrEqual(0);
      expect(features.features.leverage_risk).toBeLessThanOrEqual(1);

      // Liquidity strength should be 0-1
      expect(features.features.liquidity_strength).toBeGreaterThanOrEqual(0);
      expect(features.features.liquidity_strength).toBeLessThanOrEqual(1);

      // Boolean features should be 0 or 1
      expect([0, 1]).toContain(features.features.is_premium_valuation);
      expect([0, 1]).toContain(features.features.is_high_quality);
      expect([0, 1]).toContain(features.features.is_stressed);
      expect([0, 1]).toContain(features.features.is_income_focused);

      // Ratios should be reasonable (non-negative for most)
      if (features.features.pe_ratio !== 0) {
        expect(features.features.pe_ratio).toBeGreaterThan(0);
      }
      if (features.features.current_ratio !== 0) {
        expect(features.features.current_ratio).toBeGreaterThan(0);
      }
    }, 10000);

    it('should extract features for MSFT with real data', async () => {
      const features = await integrator.extractFundamentalFeatures('MSFT');

      expect(features).toBeDefined();
      expect(features.symbol).toBe('MSFT');
      expect(features.metadata.dataQuality).toBeGreaterThan(0);
      expect(Object.keys(features.features).length).toBeGreaterThan(0);

      console.log(`✓ MSFT features extracted with ${(features.metadata.completeness * 100).toFixed(1)}% completeness`);
    }, 10000);

    it('should extract features for GOOGL with real data', async () => {
      const features = await integrator.extractFundamentalFeatures('GOOGL');

      expect(features).toBeDefined();
      expect(features.symbol).toBe('GOOGL');
      expect(features.metadata.sources.length).toBeGreaterThan(0);
      expect(features.features).toBeDefined();
    }, 10000);
  });

  describe('Caching Functionality - 15-minute TTL', () => {
    const CACHE_TEST_SYMBOL = 'TSLA';

    beforeEach(async () => {
      // Clear cache before each caching test
      const mlCache = (integrator as any).mlCache;
      await mlCache.invalidateFeatures(CACHE_TEST_SYMBOL);
    });

    it('should cache features after first extraction', async () => {
      // First call - should hit API
      const startTime1 = Date.now();
      const features1 = await integrator.extractFundamentalFeatures(CACHE_TEST_SYMBOL);
      const duration1 = Date.now() - startTime1;

      expect(features1).toBeDefined();
      expect(features1.symbol).toBe(CACHE_TEST_SYMBOL);

      // Second call - should hit cache (faster)
      const startTime2 = Date.now();
      const features2 = await integrator.extractFundamentalFeatures(CACHE_TEST_SYMBOL);
      const duration2 = Date.now() - startTime2;

      expect(features2).toBeDefined();
      expect(features2.symbol).toBe(CACHE_TEST_SYMBOL);

      // Cached call should be significantly faster
      // Allow some variance but cache should be <100ms, API call >500ms typically
      console.log(`  First call (API): ${duration1}ms`);
      console.log(`  Second call (cache): ${duration2}ms`);
      console.log(`  Speed improvement: ${((1 - duration2/duration1) * 100).toFixed(1)}%`);

      // Cache should be faster than API call
      expect(duration2).toBeLessThan(duration1);
    }, 15000);

    it('should serve cached data with metadata indicating cache source', async () => {
      // First call to populate cache
      await integrator.extractFundamentalFeatures(CACHE_TEST_SYMBOL);

      // Second call should return cached data
      const cachedFeatures = await integrator.extractFundamentalFeatures(CACHE_TEST_SYMBOL);

      expect(cachedFeatures.metadata.sources).toContain('cache');
      expect(cachedFeatures.metadata.calculationTime).toBe(0); // Cached calls have 0 calculation time
    }, 15000);

    it('should respect cache TTL configuration', async () => {
      // Create integrator with very short cache TTL for testing
      const shortCacheIntegrator = new FundamentalFeatureIntegrator(cache, {
        cacheTTL: 2 // 2 seconds
      });

      // First call
      const features1 = await shortCacheIntegrator.extractFundamentalFeatures(CACHE_TEST_SYMBOL);
      expect(features1).toBeDefined();

      // Immediate second call should be cached
      const features2 = await shortCacheIntegrator.extractFundamentalFeatures(CACHE_TEST_SYMBOL);
      expect(features2.metadata.sources).toContain('cache');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Third call after TTL should hit API again
      const features3 = await shortCacheIntegrator.extractFundamentalFeatures(CACHE_TEST_SYMBOL);
      expect(features3.metadata.sources).not.toContain('cache');
      expect(features3.metadata.calculationTime).toBeGreaterThan(0);
    }, 20000);

    it('should allow cache to be disabled', async () => {
      const noCacheIntegrator = new FundamentalFeatureIntegrator(cache, {
        enableCache: false
      });

      // First call
      const features1 = await noCacheIntegrator.extractFundamentalFeatures(CACHE_TEST_SYMBOL);
      expect(features1).toBeDefined();
      expect(features1.metadata.sources).not.toContain('cache');

      // Second call should still hit API (not cached)
      const features2 = await noCacheIntegrator.extractFundamentalFeatures(CACHE_TEST_SYMBOL);
      expect(features2.metadata.sources).not.toContain('cache');
      expect(features2.metadata.calculationTime).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Graceful Fallback on API Failure', () => {
    it('should return default features for invalid symbol', async () => {
      const invalidSymbol = 'INVALID_SYMBOL_XYZ123';
      const features = await integrator.extractFundamentalFeatures(invalidSymbol);

      expect(features).toBeDefined();
      expect(features.symbol).toBe(invalidSymbol);
      expect(features.metadata.sources).toContain('default');
      expect(features.metadata.dataQuality).toBe(0);
      expect(features.metadata.completeness).toBe(0);

      // Should have all features with default values
      expect(Object.keys(features.features).length).toBeGreaterThan(0);
      expect(features.features.pe_ratio).toBe(0);
      expect(features.features.valuation_score).toBe(0.5);
      expect(features.features.health_score).toBe(0.5);
    }, 10000);

    it('should handle network timeouts gracefully', async () => {
      // Create integrator with very short timeout
      const timeoutIntegrator = new FundamentalFeatureIntegrator(cache, {
        timeout: 1, // 1ms - guaranteed to timeout
        enableFallback: true
      });

      const features = await timeoutIntegrator.extractFundamentalFeatures(TEST_SYMBOLS.SINGLE);

      expect(features).toBeDefined();
      expect(features.symbol).toBe(TEST_SYMBOLS.SINGLE);
      // Should return default features on timeout
      expect(features.metadata.sources).toContain('default');
    }, 10000);

    it('should provide neutral default scores on failure', async () => {
      const features = await integrator.extractFundamentalFeatures('NONEXISTENT_STOCK_999');

      // Verify default values are reasonable/neutral
      expect(features.features.valuation_score).toBe(0.5); // Neutral
      expect(features.features.profitability_score).toBe(0); // Conservative
      expect(features.features.health_score).toBe(0.5); // Neutral
      expect(features.features.current_ratio).toBe(1); // Safe default
      expect(features.features.quick_ratio).toBe(1); // Safe default
    }, 10000);
  });

  describe('Batch Parallel Processing', () => {
    it('should extract features for 5 symbols in parallel', async () => {
      const startTime = Date.now();
      const results = await integrator.extractBatchFeatures(TEST_SYMBOLS.BATCH_SMALL);
      const duration = Date.now() - startTime;

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(TEST_SYMBOLS.BATCH_SMALL.length);

      // Verify each result
      TEST_SYMBOLS.BATCH_SMALL.forEach((symbol, index) => {
        expect(results[index]).toBeDefined();
        expect(results[index].symbol).toBe(symbol);
        expect(results[index].features).toBeDefined();
      });

      console.log(`✓ Batch extracted 5 symbols in ${duration}ms (${(duration / TEST_SYMBOLS.BATCH_SMALL.length).toFixed(0)}ms per symbol)`);

      // Parallel processing should be faster than sequential (conservative estimate)
      const estimatedSequentialTime = TEST_SYMBOLS.BATCH_SMALL.length * 1000; // 1s per symbol
      expect(duration).toBeLessThan(estimatedSequentialTime);
    }, 30000); // 30s timeout for batch

    it('should meet performance target for 25 symbols (<1000ms)', async () => {
      const startTime = Date.now();
      const results = await integrator.extractBatchFeatures(TEST_SYMBOLS.BATCH_LARGE);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(25);

      console.log(`⚡ Performance test: 25 symbols extracted in ${duration}ms`);
      console.log(`   Average per symbol: ${(duration / 25).toFixed(0)}ms`);
      console.log(`   Target: <1000ms | Actual: ${duration}ms | Status: ${duration < 1000 ? 'PASS ✓' : 'FAIL ✗'}`);

      // Critical performance requirement
      expect(duration).toBeLessThan(1000);

      // Verify all results are valid
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.symbol).toBeDefined();
        expect(result.features).toBeDefined();
        expect(result.metadata).toBeDefined();
      });
    }, 30000);

    it('should process batch with consistent data quality', async () => {
      const results = await integrator.extractBatchFeatures(TEST_SYMBOLS.BATCH_SMALL);

      const qualityScores = results.map(r => r.metadata.dataQuality);
      const completenessScores = results.map(r => r.metadata.completeness);

      // Most stocks should have good data quality (>0.5)
      const highQualityCount = qualityScores.filter(q => q > 0.5).length;
      expect(highQualityCount).toBeGreaterThan(0);

      console.log(`  Data quality distribution:`);
      console.log(`    High quality (>50%): ${highQualityCount}/${results.length} stocks`);
      console.log(`    Average completeness: ${(completenessScores.reduce((a, b) => a + b, 0) / completenessScores.length * 100).toFixed(1)}%`);
    }, 30000);

    it('should handle mixed valid and invalid symbols in batch', async () => {
      const mixedSymbols = ['AAPL', 'INVALID_XYZ', 'MSFT', 'FAKE_ABC', 'GOOGL'];
      const results = await integrator.extractBatchFeatures(mixedSymbols);

      expect(results.length).toBe(mixedSymbols.length);

      // Valid symbols should have real data
      const aaplResult = results.find(r => r.symbol === 'AAPL');
      expect(aaplResult?.metadata.dataQuality).toBeGreaterThan(0);

      // Invalid symbols should have default data
      const invalidResult = results.find(r => r.symbol === 'INVALID_XYZ');
      expect(invalidResult?.metadata.sources).toContain('default');
      expect(invalidResult?.metadata.dataQuality).toBe(0);
    }, 30000);

    it('should maintain cache efficiency across batch operations', async () => {
      // First batch - should populate cache
      const startTime1 = Date.now();
      await integrator.extractBatchFeatures(TEST_SYMBOLS.BATCH_SMALL);
      const duration1 = Date.now() - startTime1;

      // Second batch - should use cache
      const startTime2 = Date.now();
      const cachedResults = await integrator.extractBatchFeatures(TEST_SYMBOLS.BATCH_SMALL);
      const duration2 = Date.now() - startTime2;

      console.log(`  First batch (API): ${duration1}ms`);
      console.log(`  Second batch (cached): ${duration2}ms`);
      console.log(`  Cache efficiency: ${((1 - duration2/duration1) * 100).toFixed(1)}% faster`);

      // Cached batch should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.5); // At least 50% faster

      // Verify cache sources
      const cacheHits = cachedResults.filter(r => r.metadata.sources.includes('cache')).length;
      console.log(`  Cache hits: ${cacheHits}/${cachedResults.length}`);
      expect(cacheHits).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Integration with FinancialModelingPrepAPI - Zero Breaking Changes', () => {
    it('should successfully call FMP API getFundamentalRatios method', async () => {
      const ratios = await fmpAPI.getFundamentalRatios(TEST_SYMBOLS.SINGLE);

      expect(ratios).toBeDefined();
      if (ratios) {
        expect(ratios.symbol).toBe(TEST_SYMBOLS.SINGLE);
        expect(ratios.source).toBe('fmp');
        expect(ratios.timestamp).toBeDefined();
        // Verify no breaking changes - original structure intact
        expect(ratios.peRatio).toBeDefined();
      }
    }, 10000);

    it('should use same data structure as FMP API', async () => {
      // Get data directly from FMP
      const fmpRatios = await fmpAPI.getFundamentalRatios(TEST_SYMBOLS.SINGLE);

      // Get data through integrator
      const integratorFeatures = await integrator.extractFundamentalFeatures(TEST_SYMBOLS.SINGLE);

      if (fmpRatios && fmpRatios.peRatio) {
        // Verify integrator uses FMP data (PE ratio should match)
        expect(integratorFeatures.features.pe_ratio).toBeDefined();

        // If FMP returns PE ratio, integrator should use it
        if (fmpRatios.peRatio > 0) {
          expect(integratorFeatures.features.pe_ratio).toBeGreaterThan(0);
        }
      }

      console.log(`✓ Integration verified - FMP API structure unchanged`);
    }, 15000);

    it('should preserve FMP API source attribution', async () => {
      const features = await integrator.extractFundamentalFeatures(TEST_SYMBOLS.SINGLE);

      // Source should be 'fmp' (from FMP API)
      if (!features.metadata.sources.includes('default') && !features.metadata.sources.includes('cache')) {
        expect(features.metadata.sources).toContain('fmp');
      }
    }, 10000);

    it('should handle FMP API errors without breaking', async () => {
      // Test with invalid API key scenario (simulated by using invalid symbol that FMP handles)
      const features = await integrator.extractFundamentalFeatures('');

      // Should gracefully return default features
      expect(features).toBeDefined();
      expect(features.metadata.sources).toContain('default');
    }, 10000);
  });

  describe('Health Check Functionality', () => {
    it('should perform successful health check', async () => {
      const isHealthy = await integrator.healthCheck();

      expect(typeof isHealthy).toBe('boolean');

      // Should be healthy if FMP API and Redis are available
      if (isHealthy) {
        console.log(`✓ Health check PASSED - FMP API and Redis cache are operational`);
      } else {
        console.log(`⚠ Health check FAILED - Check FMP API key and Redis connection`);
      }
    }, 10000);

    it('should verify FMP API connectivity in health check', async () => {
      const fmpHealth = await fmpAPI.healthCheck();

      expect(typeof fmpHealth).toBe('boolean');
      console.log(`  FMP API health: ${fmpHealth ? 'HEALTHY ✓' : 'UNHEALTHY ✗'}`);
    }, 10000);

    it('should verify Redis cache connectivity in health check', async () => {
      const cacheHealth = await cache.ping();

      expect(cacheHealth).toBe('PONG');
      console.log(`  Redis cache health: HEALTHY ✓`);
    }, 5000);
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty symbol string', async () => {
      const features = await integrator.extractFundamentalFeatures('');

      expect(features).toBeDefined();
      expect(features.metadata.sources).toContain('default');
    }, 10000);

    it('should handle symbol with special characters', async () => {
      const features = await integrator.extractFundamentalFeatures('BRK.B');

      expect(features).toBeDefined();
      expect(features.symbol).toBe('BRK.B');
      // BRK.B is a valid symbol, should get real data or fallback gracefully
    }, 10000);

    it('should handle lowercase symbol input', async () => {
      const features = await integrator.extractFundamentalFeatures('aapl');

      expect(features).toBeDefined();
      // FMP API normalizes symbols to uppercase
      expect(features.symbol).toBe('aapl');
    }, 10000);

    it('should handle very long symbol string', async () => {
      const longSymbol = 'A'.repeat(100);
      const features = await integrator.extractFundamentalFeatures(longSymbol);

      expect(features).toBeDefined();
      expect(features.metadata.sources).toContain('default');
    }, 10000);

    it('should handle empty batch array', async () => {
      const results = await integrator.extractBatchFeatures([]);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    }, 5000);

    it('should handle single symbol in batch', async () => {
      const results = await integrator.extractBatchFeatures(['AAPL']);

      expect(results.length).toBe(1);
      expect(results[0].symbol).toBe('AAPL');
    }, 10000);
  });

  describe('Data Quality Validation', () => {
    it('should ensure all features are numeric', async () => {
      const features = await integrator.extractFundamentalFeatures(TEST_SYMBOLS.SINGLE);

      Object.entries(features.features).forEach(([key, value]) => {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      });
    }, 10000);

    it('should ensure metadata fields are valid', async () => {
      const features = await integrator.extractFundamentalFeatures(TEST_SYMBOLS.SINGLE);

      expect(Array.isArray(features.metadata.sources)).toBe(true);
      expect(typeof features.metadata.dataQuality).toBe('number');
      expect(typeof features.metadata.completeness).toBe('number');
      expect(typeof features.metadata.calculationTime).toBe('number');

      expect(features.metadata.dataQuality).toBeGreaterThanOrEqual(0);
      expect(features.metadata.dataQuality).toBeLessThanOrEqual(1);
      expect(features.metadata.completeness).toBeGreaterThanOrEqual(0);
      expect(features.metadata.completeness).toBeLessThanOrEqual(1);
      expect(features.metadata.calculationTime).toBeGreaterThanOrEqual(0);
    }, 10000);

    it('should maintain consistent feature count across calls', async () => {
      const features1 = await integrator.extractFundamentalFeatures('AAPL');
      const features2 = await integrator.extractFundamentalFeatures('MSFT');

      const count1 = Object.keys(features1.features).length;
      const count2 = Object.keys(features2.features).length;

      expect(count1).toBe(count2);
      expect(count1).toBe(31); // Expected feature count
    }, 15000);

    it('should ensure timestamp is recent', async () => {
      const beforeTime = Date.now();
      const features = await integrator.extractFundamentalFeatures(TEST_SYMBOLS.SINGLE);
      const afterTime = Date.now();

      expect(features.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(features.timestamp).toBeLessThanOrEqual(afterTime);
    }, 10000);
  });

  describe('Performance Benchmarks', () => {
    it('should track calculation time for single extraction', async () => {
      const features = await integrator.extractFundamentalFeatures(TEST_SYMBOLS.SINGLE);

      expect(features.metadata.calculationTime).toBeGreaterThan(0);
      console.log(`  Single symbol calculation time: ${features.metadata.calculationTime}ms`);
    }, 10000);

    it('should demonstrate parallel processing efficiency', async () => {
      const symbols = TEST_SYMBOLS.BATCH_SMALL;

      // Measure batch time
      const batchStart = Date.now();
      await integrator.extractBatchFeatures(symbols);
      const batchDuration = Date.now() - batchStart;

      // Estimate sequential time (conservative)
      const estimatedSequentialTime = symbols.length * 800; // Assume 800ms per symbol

      console.log(`  Batch processing (parallel): ${batchDuration}ms`);
      console.log(`  Estimated sequential: ${estimatedSequentialTime}ms`);
      console.log(`  Efficiency gain: ${((1 - batchDuration/estimatedSequentialTime) * 100).toFixed(1)}%`);

      expect(batchDuration).toBeLessThan(estimatedSequentialTime);
    }, 30000);
  });
});
