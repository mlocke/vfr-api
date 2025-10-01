/**
 * FeatureValidator Tests
 *
 * Tests cover:
 * - Schema validation (type checking, required fields)
 * - Range validation (outlier detection)
 * - Freshness validation (data age checks)
 * - Completeness validation (feature coverage)
 * - Quality scoring
 * - Batch validation
 */

import { FeatureValidator } from '../FeatureValidator'
import { MLFeature, MLFeatureVector, MLFeatureType } from '../../types/MLTypes'

describe('FeatureValidator', () => {
  let validator: FeatureValidator

  beforeAll(() => {
    validator = FeatureValidator.getInstance()
  })

  describe('Schema Validation', () => {
    it('should validate a valid feature successfully', () => {
      const feature: MLFeature = {
        featureId: 'test-001',
        symbol: 'AAPL',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 65.5,
        timestamp: Date.now(),
        dataQuality: 0.95,
        source: 'TechnicalIndicatorService'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
      expect(result.qualityScore).toBeGreaterThan(0.9)
    })

    it('should reject feature with missing required fields', () => {
      const feature = {
        featureName: 'rsi',
        value: 65.5
      } as MLFeature

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.message.includes('featureId'))).toBe(true)
    })

    it('should reject feature with invalid data type', () => {
      const feature: MLFeature = {
        featureId: 'test-002',
        symbol: 'GOOGL',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 'invalid' as any, // Invalid: should be number
        timestamp: Date.now(),
        dataQuality: 0.9,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.ruleId === 'type_validation')).toBe(true)
    })

    it('should reject feature with NaN value', () => {
      const feature: MLFeature = {
        featureId: 'test-003',
        symbol: 'MSFT',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: NaN,
        timestamp: Date.now(),
        dataQuality: 0.9,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.ruleId === 'numeric_validation')).toBe(true)
    })

    it('should reject feature with Infinity value', () => {
      const feature: MLFeature = {
        featureId: 'test-004',
        symbol: 'TSLA',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: Infinity,
        timestamp: Date.now(),
        dataQuality: 0.9,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.ruleId === 'numeric_validation')).toBe(true)
    })

    it('should reject feature with invalid data quality score', () => {
      const feature: MLFeature = {
        featureId: 'test-005',
        symbol: 'NVDA',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 50,
        timestamp: Date.now(),
        dataQuality: 1.5, // Invalid: must be 0-1
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.ruleId === 'quality_range')).toBe(true)
    })
  })

  describe('Range Validation', () => {
    it('should validate RSI within valid range (0-100)', () => {
      const feature: MLFeature = {
        featureId: 'test-006',
        symbol: 'AAPL',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 65,
        timestamp: Date.now(),
        dataQuality: 0.95,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should reject RSI outside valid range', () => {
      const feature: MLFeature = {
        featureId: 'test-007',
        symbol: 'GOOGL',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 150, // Invalid: RSI max is 100
        timestamp: Date.now(),
        dataQuality: 0.9,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.ruleId === 'range_violation')).toBe(true)
    })

    it('should detect potential outliers', () => {
      const feature: MLFeature = {
        featureId: 'test-008',
        symbol: 'MSFT',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 5, // Very low RSI - potential outlier
        timestamp: Date.now(),
        dataQuality: 0.9,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      // Should be valid but with warnings
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.ruleId === 'potential_outlier')).toBe(true)
    })

    it('should validate P/E ratio with allowNull=true', () => {
      const feature: MLFeature = {
        featureId: 'test-009',
        symbol: 'TSLA',
        featureType: MLFeatureType.FUNDAMENTAL,
        featureName: 'pe_ratio',
        value: null as any,
        timestamp: Date.now(),
        dataQuality: 0.8,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      // P/E ratio allows null, so should not have null-related errors
      expect(result.errors.every(e => e.ruleId !== 'null_not_allowed')).toBe(true)
    })

    it('should validate sentiment score in range [-1, 1]', () => {
      const feature: MLFeature = {
        featureId: 'test-010',
        symbol: 'NVDA',
        featureType: MLFeatureType.SENTIMENT,
        featureName: 'sentiment_score',
        value: 0.75,
        timestamp: Date.now(),
        dataQuality: 0.9,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should reject sentiment score outside [-1, 1]', () => {
      const feature: MLFeature = {
        featureId: 'test-011',
        symbol: 'AMD',
        featureType: MLFeatureType.SENTIMENT,
        featureName: 'sentiment_score',
        value: 1.5, // Invalid: max is 1
        timestamp: Date.now(),
        dataQuality: 0.9,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.ruleId === 'range_violation')).toBe(true)
    })
  })

  describe('Freshness Validation', () => {
    it('should validate fresh data (< 15 minutes old)', () => {
      const feature: MLFeature = {
        featureId: 'test-012',
        symbol: 'AAPL',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 65,
        timestamp: Date.now() - 600000, // 10 minutes ago
        dataQuality: 0.95,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(true)
      expect(result.warnings.every(w => w.ruleId !== 'stale_data')).toBe(true)
    })

    it('should warn about aging data (15-60 minutes old)', () => {
      const feature: MLFeature = {
        featureId: 'test-013',
        symbol: 'GOOGL',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 65,
        timestamp: Date.now() - 1800000, // 30 minutes ago
        dataQuality: 0.95,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.ruleId === 'aging_data')).toBe(true)
    })

    it('should warn about stale data (> 1 hour old)', () => {
      const feature: MLFeature = {
        featureId: 'test-014',
        symbol: 'MSFT',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 65,
        timestamp: Date.now() - 7200000, // 2 hours ago
        dataQuality: 0.95,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      // Default config: stale but not critical
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.ruleId === 'stale_data')).toBe(true)
    })

    it('should handle critical freshness violations', () => {
      // Set critical freshness config for realtime features
      validator.setFreshnessConfig('test_realtime_feature', {
        maxAge: 300000, // 5 minutes
        warningThreshold: 60000, // 1 minute
        critical: true
      })

      const feature: MLFeature = {
        featureId: 'test-015',
        symbol: 'TSLA',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'test_realtime_feature',
        value: 100,
        timestamp: Date.now() - 600000, // 10 minutes ago (exceeds max)
        dataQuality: 0.95,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.ruleId === 'stale_data')).toBe(true)
    })
  })

  describe('Feature Vector Validation', () => {
    it('should validate a complete feature vector', () => {
      const vector: MLFeatureVector = {
        symbol: 'AAPL',
        features: {
          rsi: 65,
          macd: 2.5,
          sma_20: 175.5,
          ema_50: 172.3,
          bollinger_upper: 180,
          bollinger_lower: 170,
          atr: 3.2,
          obv: 1000000,
          pe_ratio: 28.5,
          dividend_yield: 0.015
        },
        featureNames: ['rsi', 'macd', 'sma_20', 'ema_50', 'bollinger_upper', 'bollinger_lower', 'atr', 'obv', 'pe_ratio', 'dividend_yield'],
        timestamp: Date.now(),
        completeness: 0.95,
        qualityScore: 0.92
      }

      const result = validator.validateFeatureVector(vector)

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
      expect(result.qualityScore).toBeGreaterThan(0.9)
    })

    it('should reject vector with insufficient features', () => {
      const vector: MLFeatureVector = {
        symbol: 'GOOGL',
        features: {
          rsi: 65,
          macd: 2.5
        },
        featureNames: ['rsi', 'macd'],
        timestamp: Date.now(),
        completeness: 0.2,
        qualityScore: 0.9
      }

      const result = validator.validateFeatureVector(vector, {
        minimumFeatures: 10,
        requiredFeatures: [],
        minimumCoverage: 0.7
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.ruleId === 'min_features')).toBe(true)
    })

    it('should warn about low feature coverage', () => {
      const vector: MLFeatureVector = {
        symbol: 'MSFT',
        features: {
          rsi: 65,
          macd: 2.5,
          sma_20: 175.5,
          ema_50: 172.3,
          bollinger_upper: 180
        },
        featureNames: ['rsi', 'macd', 'sma_20', 'ema_50', 'bollinger_upper'],
        timestamp: Date.now(),
        completeness: 0.5, // Low coverage
        qualityScore: 0.9
      }

      const result = validator.validateFeatureVector(vector, {
        minimumFeatures: 5,
        requiredFeatures: [],
        minimumCoverage: 0.7
      })

      expect(result.warnings.some(w => w.ruleId === 'min_coverage')).toBe(true)
    })

    it('should detect missing required features', () => {
      const vector: MLFeatureVector = {
        symbol: 'TSLA',
        features: {
          rsi: 65,
          macd: 2.5
        },
        featureNames: ['rsi', 'macd'],
        timestamp: Date.now(),
        completeness: 0.8,
        qualityScore: 0.9
      }

      const result = validator.validateFeatureVector(vector, {
        minimumFeatures: 2,
        requiredFeatures: ['rsi', 'sma_20', 'pe_ratio'], // sma_20 and pe_ratio are missing
        minimumCoverage: 0.5
      })

      expect(result.valid).toBe(false)
      expect(result.errors.filter(e => e.ruleId === 'required_feature').length).toBe(2)
    })

    it('should warn about stale feature vector', () => {
      const vector: MLFeatureVector = {
        symbol: 'NVDA',
        features: {
          rsi: 65,
          macd: 2.5,
          sma_20: 175.5
        },
        featureNames: ['rsi', 'macd', 'sma_20'],
        timestamp: Date.now() - 7200000, // 2 hours old
        completeness: 0.8,
        qualityScore: 0.9
      }

      const result = validator.validateFeatureVector(vector)

      expect(result.warnings.some(w => w.ruleId === 'vector_freshness')).toBe(true)
    })
  })

  describe('Batch Validation', () => {
    it('should validate multiple features in batch', () => {
      const features: MLFeature[] = [
        {
          featureId: 'test-016',
          symbol: 'AAPL',
          featureType: MLFeatureType.TECHNICAL,
          featureName: 'rsi',
          value: 65,
          timestamp: Date.now(),
          dataQuality: 0.95,
          source: 'Test'
        },
        {
          featureId: 'test-017',
          symbol: 'AAPL',
          featureType: MLFeatureType.TECHNICAL,
          featureName: 'macd',
          value: 2.5,
          timestamp: Date.now(),
          dataQuality: 0.9,
          source: 'Test'
        },
        {
          featureId: 'test-018',
          symbol: 'AAPL',
          featureType: MLFeatureType.FUNDAMENTAL,
          featureName: 'pe_ratio',
          value: 28.5,
          timestamp: Date.now(),
          dataQuality: 0.85,
          source: 'Test'
        }
      ]

      const results = validator.validateBatch(features)

      expect(results.size).toBe(3)
      expect(Array.from(results.values()).every(r => r.valid)).toBe(true)
    })

    it('should get validation summary for batch', () => {
      const features: MLFeature[] = [
        {
          featureId: 'test-019',
          symbol: 'GOOGL',
          featureType: MLFeatureType.TECHNICAL,
          featureName: 'rsi',
          value: 65,
          timestamp: Date.now(),
          dataQuality: 0.95,
          source: 'Test'
        },
        {
          featureId: 'test-020',
          symbol: 'GOOGL',
          featureType: MLFeatureType.TECHNICAL,
          featureName: 'rsi',
          value: 150, // Invalid
          timestamp: Date.now(),
          dataQuality: 0.9,
          source: 'Test'
        }
      ]

      const results = validator.validateBatch(features)
      const summary = validator.getValidationSummary(results)

      expect(summary.totalFeatures).toBe(2)
      expect(summary.validFeatures).toBe(1)
      expect(summary.invalidFeatures).toBe(1)
      expect(summary.averageQualityScore).toBeGreaterThan(0)
      expect(summary.totalErrors).toBeGreaterThan(0)
    })
  })

  describe('Custom Validation Rules', () => {
    it('should support adding custom range configurations', () => {
      validator.addRangeConfig('custom_feature', {
        featureName: 'custom_feature',
        min: 0,
        max: 100,
        outlierThreshold: 2,
        allowNull: false
      })

      const feature: MLFeature = {
        featureId: 'test-021',
        symbol: 'AMD',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'custom_feature',
        value: 50,
        timestamp: Date.now(),
        dataQuality: 0.9,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)
      expect(result.valid).toBe(true)
    })

    it('should support custom freshness configurations', () => {
      validator.setFreshnessConfig('custom_fresh_feature', {
        maxAge: 60000, // 1 minute
        warningThreshold: 30000, // 30 seconds
        critical: true
      })

      const feature: MLFeature = {
        featureId: 'test-022',
        symbol: 'INTC',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'custom_fresh_feature',
        value: 100,
        timestamp: Date.now() - 120000, // 2 minutes old
        dataQuality: 0.9,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.ruleId === 'stale_data')).toBe(true)
    })
  })

  describe('Quality Score Calculations', () => {
    it('should calculate quality score based on validation results', () => {
      const feature: MLFeature = {
        featureId: 'test-023',
        symbol: 'ORCL',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 65,
        timestamp: Date.now(),
        dataQuality: 0.95,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.qualityScore).toBeCloseTo(0.95, 1)
    })

    it('should reduce quality score for warnings', () => {
      const feature: MLFeature = {
        featureId: 'test-024',
        symbol: 'CRM',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 5, // Outlier warning
        timestamp: Date.now() - 1800000, // Aging warning (30 min)
        dataQuality: 0.95,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.qualityScore).toBeLessThan(0.95) // Reduced due to warnings
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should significantly reduce quality score for errors', () => {
      const feature: MLFeature = {
        featureId: 'test-025',
        symbol: 'ADBE',
        featureType: MLFeatureType.TECHNICAL,
        featureName: 'rsi',
        value: 150, // Range violation
        timestamp: Date.now(),
        dataQuality: 0.95,
        source: 'Test'
      }

      const result = validator.validateFeature(feature)

      expect(result.valid).toBe(false)
      expect(result.qualityScore).toBeLessThan(0.7) // Significant reduction
    })
  })
})
