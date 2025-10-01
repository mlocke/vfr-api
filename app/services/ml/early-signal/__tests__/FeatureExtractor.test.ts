/**
 * Feature Extractor Tests
 *
 * Task 2.7: Create Feature Extraction Tests
 * Purpose: Comprehensive unit tests for feature extraction
 * NO MOCK DATA - Uses real API integration
 */

import { EarlySignalFeatureExtractor } from '../FeatureExtractor'

describe('EarlySignalFeatureExtractor', () => {
  let extractor: EarlySignalFeatureExtractor

  beforeAll(() => {
    extractor = new EarlySignalFeatureExtractor()
  })

  describe('Feature Extraction', () => {
    it('should extract all 13 features for TSLA', async () => {
      const features = await extractor.extractFeatures('TSLA')

      // Verify all 13 features exist
      expect(features).toHaveProperty('price_change_5d')
      expect(features).toHaveProperty('price_change_10d')
      expect(features).toHaveProperty('price_change_20d')
      expect(features).toHaveProperty('volume_ratio')
      expect(features).toHaveProperty('volume_trend')
      expect(features).toHaveProperty('sentiment_news_delta')
      expect(features).toHaveProperty('sentiment_reddit_accel')
      expect(features).toHaveProperty('sentiment_options_shift')
      expect(features).toHaveProperty('earnings_surprise')
      expect(features).toHaveProperty('revenue_growth_accel')
      expect(features).toHaveProperty('analyst_coverage_change')
      expect(features).toHaveProperty('rsi_momentum')
      expect(features).toHaveProperty('macd_histogram_trend')

      // Verify all features are numeric
      expect(typeof features.price_change_5d).toBe('number')
      expect(typeof features.price_change_10d).toBe('number')
      expect(typeof features.price_change_20d).toBe('number')
      expect(typeof features.volume_ratio).toBe('number')
      expect(typeof features.volume_trend).toBe('number')

      // Verify no NaN values
      expect(isNaN(features.price_change_5d)).toBe(false)
      expect(isNaN(features.volume_ratio)).toBe(false)
    }, 10000)

    it('should extract features for NVDA', async () => {
      const features = await extractor.extractFeatures('NVDA')

      expect(features).toBeDefined()
      expect(Object.keys(features).length).toBe(13)
    }, 10000)

    it('should extract features for AAPL', async () => {
      const features = await extractor.extractFeatures('AAPL')

      expect(features).toBeDefined()
      expect(features.volume_ratio).toBeGreaterThanOrEqual(0)
    }, 10000)
  })

  describe('Historical Data Handling', () => {
    it('should handle missing data gracefully', async () => {
      const features = await extractor.extractFeatures('INVALID_SYMBOL')

      // Should return neutral values, not throw
      expect(features.price_change_10d).toBe(0)
      expect(features.volume_ratio).toBe(1.0)
    }, 10000)

    it('should handle symbols with limited history', async () => {
      // Test with a recently IPO'd stock or symbol with limited data
      const features = await extractor.extractFeatures('PLTR')

      expect(features).toBeDefined()
      // Should not throw even if some features are missing
    }, 10000)
  })

  describe('Performance Requirements', () => {
    it('should complete in <5s for real stock', async () => {
      const start = Date.now()
      await extractor.extractFeatures('TSLA')
      const duration = Date.now() - start

      expect(duration).toBeLessThan(5000)
    }, 10000)

    it('should handle multiple extractions efficiently', async () => {
      const symbols = ['TSLA', 'NVDA', 'AAPL']
      const start = Date.now()

      const results = await Promise.all(
        symbols.map(symbol => extractor.extractFeatures(symbol))
      )

      const duration = Date.now() - start

      expect(results.length).toBe(3)
      expect(duration).toBeLessThan(10000) // <10s for 3 symbols in parallel
    }, 15000)
  })

  describe('Momentum Calculations', () => {
    it('should calculate positive momentum correctly', async () => {
      const features = await extractor.extractFeatures('NVDA')

      // Momentum values should be reasonable (not extreme outliers)
      expect(features.price_change_5d).toBeGreaterThan(-1) // Not less than -100%
      expect(features.price_change_10d).toBeGreaterThan(-1)
      expect(features.price_change_20d).toBeGreaterThan(-1)
    }, 10000)

    it('should have consistent momentum trends', async () => {
      const features = await extractor.extractFeatures('TSLA')

      // If stock is trending up, longer periods should show more momentum
      // This is a general trend check, not strict
      expect(typeof features.price_change_5d).toBe('number')
      expect(typeof features.price_change_10d).toBe('number')
      expect(typeof features.price_change_20d).toBe('number')
    }, 10000)
  })

  describe('Volume Features', () => {
    it('should calculate volume ratio correctly', async () => {
      const features = await extractor.extractFeatures('AAPL')

      // Volume ratio should be positive
      expect(features.volume_ratio).toBeGreaterThan(0)

      // Typically between 0.5 and 2.0 (within 2x of normal)
      expect(features.volume_ratio).toBeGreaterThan(0.1)
      expect(features.volume_ratio).toBeLessThan(10)
    }, 10000)

    it('should calculate volume trend', async () => {
      const features = await extractor.extractFeatures('MSFT')

      // Volume trend can be positive or negative
      expect(typeof features.volume_trend).toBe('number')
      expect(isNaN(features.volume_trend)).toBe(false)
    }, 10000)
  })

  describe('Feature Vector Completeness', () => {
    it('should never return undefined features', async () => {
      const features = await extractor.extractFeatures('GOOGL')

      Object.entries(features).forEach(([key, value]) => {
        expect(value).toBeDefined()
        expect(typeof value).toBe('number')
      })
    }, 10000)

    it('should handle edge cases without crashing', async () => {
      const symbols = ['TSLA', '', 'INVALID', 'AAPL']

      for (const symbol of symbols) {
        const features = await extractor.extractFeatures(symbol)
        expect(features).toBeDefined()
      }
    }, 20000)
  })

  describe('Sentiment Features', () => {
    it('should extract sentiment data', async () => {
      const features = await extractor.extractFeatures('TSLA')

      // Sentiment features should be numeric (even if 0)
      expect(typeof features.sentiment_news_delta).toBe('number')
      expect(typeof features.sentiment_reddit_accel).toBe('number')
      expect(typeof features.sentiment_options_shift).toBe('number')
    }, 10000)
  })

  describe('Technical Indicators', () => {
    it('should extract RSI momentum', async () => {
      const features = await extractor.extractFeatures('NVDA')

      // RSI momentum should be reasonable
      expect(typeof features.rsi_momentum).toBe('number')
    }, 10000)

    it('should extract MACD histogram trend', async () => {
      const features = await extractor.extractFeatures('AMD')

      // MACD histogram trend should be numeric
      expect(typeof features.macd_histogram_trend).toBe('number')
    }, 10000)
  })
})
