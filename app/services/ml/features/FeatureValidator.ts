/**
 * Feature Validation Service for VFR Machine Learning Enhancement Layer
 *
 * Features:
 * - Schema validation (type checking, required fields)
 * - Range checks (detect outliers and anomalies)
 * - Freshness checks (flag stale data)
 * - Completeness checks (minimum feature coverage)
 * - Data quality scoring
 * - Validation rule management
 *
 * Philosophy: Ensure feature data quality before ML model consumption
 * Prevents garbage-in-garbage-out scenarios
 */

import {
  MLFeature,
  MLFeatureVector,
  MLFeatureDefinition,
  MLFeatureType
} from '../types/MLTypes'
import { Logger } from '../../error-handling/Logger'

export interface ValidationRule {
  ruleId: string
  featureName: string
  ruleType: 'schema' | 'range' | 'freshness' | 'completeness' | 'custom'
  validator: (value: any, context?: any) => boolean
  errorMessage: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  qualityScore: number // 0-1
  timestamp: number
}

export interface ValidationError {
  featureName: string
  ruleId: string
  message: string
  actualValue: any
  expectedRange?: { min: number; max: number }
}

export interface ValidationWarning {
  featureName: string
  ruleId: string
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface FreshnessConfig {
  maxAge: number // milliseconds
  warningThreshold: number // milliseconds
  critical: boolean
}

export interface CompletenessConfig {
  minimumFeatures: number
  requiredFeatures: string[]
  minimumCoverage: number // 0-1 percentage
}

export interface RangeValidationConfig {
  featureName: string
  min: number
  max: number
  outlierThreshold: number // standard deviations
  allowNull: boolean
}

export class FeatureValidator {
  private static instance: FeatureValidator
  private logger: Logger
  private validationRules: Map<string, ValidationRule[]>
  private rangeConfigs: Map<string, RangeValidationConfig>
  private freshnessConfigs: Map<string, FreshnessConfig>

  private constructor() {
    this.logger = Logger.getInstance('FeatureValidator')
    this.validationRules = new Map()
    this.rangeConfigs = new Map()
    this.freshnessConfigs = new Map()
    this.initializeDefaultRules()
  }

  public static getInstance(): FeatureValidator {
    if (!FeatureValidator.instance) {
      FeatureValidator.instance = new FeatureValidator()
    }
    return FeatureValidator.instance
  }

  /**
   * Initialize default validation rules for common feature types
   */
  private initializeDefaultRules(): void {
    // Technical features
    this.addRangeConfig('rsi', { featureName: 'rsi', min: 0, max: 100, outlierThreshold: 3, allowNull: false })
    this.addRangeConfig('macd', { featureName: 'macd', min: -1000, max: 1000, outlierThreshold: 3, allowNull: false })
    this.addRangeConfig('sma_20', { featureName: 'sma_20', min: 0, max: 1000000, outlierThreshold: 4, allowNull: false })
    this.addRangeConfig('ema_50', { featureName: 'ema_50', min: 0, max: 1000000, outlierThreshold: 4, allowNull: false })
    this.addRangeConfig('bollinger_upper', { featureName: 'bollinger_upper', min: 0, max: 1000000, outlierThreshold: 4, allowNull: false })
    this.addRangeConfig('bollinger_lower', { featureName: 'bollinger_lower', min: 0, max: 1000000, outlierThreshold: 4, allowNull: false })
    this.addRangeConfig('stochastic_k', { featureName: 'stochastic_k', min: 0, max: 100, outlierThreshold: 3, allowNull: false })
    this.addRangeConfig('stochastic_d', { featureName: 'stochastic_d', min: 0, max: 100, outlierThreshold: 3, allowNull: false })
    this.addRangeConfig('atr', { featureName: 'atr', min: 0, max: 10000, outlierThreshold: 4, allowNull: false })
    this.addRangeConfig('obv', { featureName: 'obv', min: -1e12, max: 1e12, outlierThreshold: 5, allowNull: false })

    // Fundamental features
    this.addRangeConfig('pe_ratio', { featureName: 'pe_ratio', min: -100, max: 1000, outlierThreshold: 3, allowNull: true })
    this.addRangeConfig('pb_ratio', { featureName: 'pb_ratio', min: 0, max: 100, outlierThreshold: 3, allowNull: true })
    this.addRangeConfig('roe', { featureName: 'roe', min: -1, max: 5, outlierThreshold: 3, allowNull: true })
    this.addRangeConfig('roa', { featureName: 'roa', min: -1, max: 1, outlierThreshold: 3, allowNull: true })
    this.addRangeConfig('debt_equity', { featureName: 'debt_equity', min: 0, max: 10, outlierThreshold: 3, allowNull: true })
    this.addRangeConfig('current_ratio', { featureName: 'current_ratio', min: 0, max: 20, outlierThreshold: 3, allowNull: true })
    this.addRangeConfig('quick_ratio', { featureName: 'quick_ratio', min: 0, max: 20, outlierThreshold: 3, allowNull: true })
    this.addRangeConfig('dividend_yield', { featureName: 'dividend_yield', min: 0, max: 0.25, outlierThreshold: 3, allowNull: true })

    // Sentiment features
    this.addRangeConfig('sentiment_score', { featureName: 'sentiment_score', min: -1, max: 1, outlierThreshold: 3, allowNull: false })
    this.addRangeConfig('news_sentiment', { featureName: 'news_sentiment', min: -1, max: 1, outlierThreshold: 3, allowNull: true })
    this.addRangeConfig('reddit_sentiment', { featureName: 'reddit_sentiment', min: -1, max: 1, outlierThreshold: 3, allowNull: true })
    this.addRangeConfig('social_volume', { featureName: 'social_volume', min: 0, max: 1000000, outlierThreshold: 4, allowNull: true })

    // Freshness configs (default: 1 hour max age, 15 min warning)
    this.setFreshnessConfig('default', {
      maxAge: 3600000, // 1 hour
      warningThreshold: 900000, // 15 minutes
      critical: false
    })

    this.setFreshnessConfig('realtime', {
      maxAge: 300000, // 5 minutes
      warningThreshold: 60000, // 1 minute
      critical: true
    })
  }

  /**
   * Validate a single feature against all applicable rules
   */
  public validateFeature(
    feature: MLFeature,
    definition?: MLFeatureDefinition
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    let qualityScore = 1.0

    // Schema validation
    const schemaResult = this.validateSchema(feature, definition)
    if (!schemaResult.valid) {
      errors.push(...schemaResult.errors)
      qualityScore *= 0.5
    }

    // Range validation
    const rangeResult = this.validateRange(feature)
    if (!rangeResult.valid) {
      errors.push(...rangeResult.errors)
      warnings.push(...rangeResult.warnings)
      qualityScore *= 0.7
    }

    // Freshness validation
    const freshnessResult = this.validateFreshness(feature)
    if (!freshnessResult.valid) {
      if (freshnessResult.critical) {
        errors.push(...freshnessResult.errors)
        qualityScore *= 0.3
      } else {
        warnings.push(...freshnessResult.warnings)
        qualityScore *= 0.8
      }
    }

    // Data quality score adjustment
    qualityScore *= feature.dataQuality

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      qualityScore: Math.max(0, Math.min(1, qualityScore)),
      timestamp: Date.now()
    }
  }

  /**
   * Validate a feature vector for completeness and quality
   */
  public validateFeatureVector(
    vector: MLFeatureVector,
    config?: CompletenessConfig
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    let qualityScore = vector.qualityScore

    // Default completeness config
    const completenessConfig: CompletenessConfig = config || {
      minimumFeatures: 10,
      requiredFeatures: [],
      minimumCoverage: 0.7
    }

    // Completeness check
    const featureCount = Object.keys(vector.features).length
    if (featureCount < completenessConfig.minimumFeatures) {
      errors.push({
        featureName: 'vector',
        ruleId: 'min_features',
        message: `Insufficient features: ${featureCount} < ${completenessConfig.minimumFeatures}`,
        actualValue: featureCount
      })
      qualityScore *= 0.5
    }

    // Coverage check
    if (vector.completeness < completenessConfig.minimumCoverage) {
      warnings.push({
        featureName: 'vector',
        ruleId: 'min_coverage',
        message: `Low feature coverage: ${(vector.completeness * 100).toFixed(1)}%`,
        severity: 'medium'
      })
      qualityScore *= 0.8
    }

    // Required features check
    for (const requiredFeature of completenessConfig.requiredFeatures) {
      if (!(requiredFeature in vector.features)) {
        errors.push({
          featureName: requiredFeature,
          ruleId: 'required_feature',
          message: `Missing required feature: ${requiredFeature}`,
          actualValue: null
        })
        qualityScore *= 0.7
      }
    }

    // Validate freshness of the entire vector
    const now = Date.now()
    const age = now - vector.timestamp
    if (age > 3600000) { // 1 hour
      warnings.push({
        featureName: 'vector',
        ruleId: 'vector_freshness',
        message: `Feature vector is ${Math.round(age / 60000)} minutes old`,
        severity: age > 7200000 ? 'high' : 'medium'
      })
      qualityScore *= 0.85
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      qualityScore: Math.max(0, Math.min(1, qualityScore)),
      timestamp: Date.now()
    }
  }

  /**
   * Schema validation - verify data types and required fields
   */
  private validateSchema(
    feature: MLFeature,
    definition?: MLFeatureDefinition
  ): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = []

    // Basic required fields
    if (!feature.featureId) {
      errors.push({
        featureName: feature.featureName || 'unknown',
        ruleId: 'required_field',
        message: 'Missing featureId',
        actualValue: feature.featureId
      })
    }

    if (!feature.symbol) {
      errors.push({
        featureName: feature.featureName || 'unknown',
        ruleId: 'required_field',
        message: 'Missing symbol',
        actualValue: feature.symbol
      })
    }

    if (feature.value === null || feature.value === undefined) {
      errors.push({
        featureName: feature.featureName || 'unknown',
        ruleId: 'required_field',
        message: 'Missing value',
        actualValue: feature.value
      })
    }

    // Type validation
    if (typeof feature.value !== 'number') {
      errors.push({
        featureName: feature.featureName || 'unknown',
        ruleId: 'type_validation',
        message: `Invalid type: expected number, got ${typeof feature.value}`,
        actualValue: feature.value
      })
    }

    // Check for NaN or Infinity
    if (typeof feature.value === 'number' && (!isFinite(feature.value) || isNaN(feature.value))) {
      errors.push({
        featureName: feature.featureName || 'unknown',
        ruleId: 'numeric_validation',
        message: 'Value is NaN or Infinity',
        actualValue: feature.value
      })
    }

    // Data quality score validation
    if (feature.dataQuality < 0 || feature.dataQuality > 1) {
      errors.push({
        featureName: feature.featureName || 'unknown',
        ruleId: 'quality_range',
        message: 'Data quality score must be between 0 and 1',
        actualValue: feature.dataQuality
      })
    }

    // Definition-based validation
    if (definition) {
      if (definition.required && (feature.value === null || feature.value === undefined)) {
        errors.push({
          featureName: feature.featureName,
          ruleId: 'required_by_definition',
          message: `Required feature ${definition.featureName} is missing`,
          actualValue: feature.value
        })
      }

      // Data type validation
      if (definition.dataType === 'numeric' && typeof feature.value !== 'number') {
        errors.push({
          featureName: feature.featureName,
          ruleId: 'datatype_mismatch',
          message: `Expected numeric type, got ${typeof feature.value}`,
          actualValue: feature.value
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Range validation - detect outliers and invalid values
   */
  private validateRange(
    feature: MLFeature
  ): { valid: boolean; errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    const config = this.rangeConfigs.get(feature.featureName)
    if (!config) {
      // No range config for this feature - skip validation
      return { valid: true, errors, warnings }
    }

    // Null check
    if (feature.value === null || feature.value === undefined) {
      if (!config.allowNull) {
        errors.push({
          featureName: feature.featureName,
          ruleId: 'null_not_allowed',
          message: 'Null value not allowed for this feature',
          actualValue: feature.value
        })
      }
      return { valid: errors.length === 0, errors, warnings }
    }

    // Range check
    if (feature.value < config.min || feature.value > config.max) {
      errors.push({
        featureName: feature.featureName,
        ruleId: 'range_violation',
        message: `Value ${feature.value} outside valid range [${config.min}, ${config.max}]`,
        actualValue: feature.value,
        expectedRange: { min: config.min, max: config.max }
      })
    }

    // Outlier detection (simplified - in production, use statistical methods)
    const range = config.max - config.min
    const midpoint = (config.min + config.max) / 2
    const deviation = Math.abs(feature.value - midpoint)
    const normalizedDeviation = deviation / (range / 2)

    if (normalizedDeviation > config.outlierThreshold) {
      warnings.push({
        featureName: feature.featureName,
        ruleId: 'potential_outlier',
        message: `Value ${feature.value} may be an outlier (${normalizedDeviation.toFixed(2)} deviations)`,
        severity: normalizedDeviation > config.outlierThreshold * 1.5 ? 'high' : 'medium'
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Freshness validation - check data age
   */
  private validateFreshness(
    feature: MLFeature
  ): { valid: boolean; errors: ValidationError[]; warnings: ValidationWarning[]; critical: boolean } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    const now = Date.now()
    const age = now - feature.timestamp

    // Determine freshness config (check feature-specific, then default)
    const config = this.freshnessConfigs.get(feature.featureName) ||
                   this.freshnessConfigs.get('default')!

    if (age > config.maxAge) {
      const ageMinutes = Math.round(age / 60000)
      if (config.critical) {
        errors.push({
          featureName: feature.featureName,
          ruleId: 'stale_data',
          message: `Feature data is ${ageMinutes} minutes old (max: ${config.maxAge / 60000} min)`,
          actualValue: age
        })
      } else {
        warnings.push({
          featureName: feature.featureName,
          ruleId: 'stale_data',
          message: `Feature data is ${ageMinutes} minutes old`,
          severity: 'high'
        })
      }
    } else if (age > config.warningThreshold) {
      const ageMinutes = Math.round(age / 60000)
      warnings.push({
        featureName: feature.featureName,
        ruleId: 'aging_data',
        message: `Feature data is ${ageMinutes} minutes old`,
        severity: 'low'
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      critical: config.critical
    }
  }

  /**
   * Add a range validation configuration
   */
  public addRangeConfig(featureName: string, config: RangeValidationConfig): void {
    this.rangeConfigs.set(featureName, { ...config, featureName })
  }

  /**
   * Set freshness configuration for a feature or feature type
   */
  public setFreshnessConfig(featureNameOrType: string, config: FreshnessConfig): void {
    this.freshnessConfigs.set(featureNameOrType, config)
  }

  /**
   * Add a custom validation rule
   */
  public addValidationRule(rule: ValidationRule): void {
    if (!this.validationRules.has(rule.featureName)) {
      this.validationRules.set(rule.featureName, [])
    }
    this.validationRules.get(rule.featureName)!.push(rule)
  }

  /**
   * Batch validate multiple features
   */
  public validateBatch(
    features: MLFeature[],
    definitions?: Map<string, MLFeatureDefinition>
  ): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>()

    for (const feature of features) {
      const definition = definitions?.get(feature.featureName)
      const result = this.validateFeature(feature, definition)
      results.set(feature.featureName, result)
    }

    return results
  }

  /**
   * Get validation summary statistics
   */
  public getValidationSummary(results: Map<string, ValidationResult>): {
    totalFeatures: number
    validFeatures: number
    invalidFeatures: number
    averageQualityScore: number
    totalErrors: number
    totalWarnings: number
  } {
    let totalErrors = 0
    let totalWarnings = 0
    let qualityScoreSum = 0
    let validCount = 0

    for (const result of results.values()) {
      totalErrors += result.errors.length
      totalWarnings += result.warnings.length
      qualityScoreSum += result.qualityScore
      if (result.valid) {
        validCount++
      }
    }

    return {
      totalFeatures: results.size,
      validFeatures: validCount,
      invalidFeatures: results.size - validCount,
      averageQualityScore: results.size > 0 ? qualityScoreSum / results.size : 0,
      totalErrors,
      totalWarnings
    }
  }
}
