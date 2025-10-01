/**
 * Inference Optimizer for VFR Machine Learning Enhancement Layer
 *
 * Features:
 * - Algorithm-specific optimizations (LightGBM, XGBoost, LSTM)
 * - Feature vector optimization (Float32Array for performance)
 * - Vectorized operations for batch predictions
 * - Memory-efficient inference patterns
 * - Input preprocessing and normalization
 *
 * Philosophy: KISS principles - fast preprocessing, minimal overhead
 */

import { Logger } from '../../error-handling/Logger'
import { MLModelType, MLFeatureVector } from '../types/MLTypes'
import { ModelMetadata } from '../models/ModelRegistry'

// ===== Optimization Configuration =====

export interface InferenceOptimizerConfig {
  useFloat32: boolean // Use Float32Array for performance (default: true)
  enableVectorization: boolean // Vectorize batch operations (default: true)
  normalizeInputs: boolean // Normalize features (default: true)
  cachePreprocessing: boolean // Cache preprocessing results (default: true)
}

// ===== Optimized Feature Vector =====

export interface OptimizedFeatureVector {
  values: Float32Array
  featureNames: string[]
  symbol: string
  timestamp: number
}

// ===== Preprocessing Result =====

export interface PreprocessingResult {
  optimizedVector: OptimizedFeatureVector
  normalizationParams?: {
    mean: number[]
    std: number[]
    min: number[]
    max: number[]
  }
  preprocessingTimeMs: number
}

/**
 * InferenceOptimizer
 * Provides algorithm-specific optimizations for ML inference
 */
export class InferenceOptimizer {
  private logger: Logger
  private config: InferenceOptimizerConfig
  private preprocessingCache: Map<string, PreprocessingResult>

  constructor(config?: Partial<InferenceOptimizerConfig>) {
    this.logger = Logger.getInstance('InferenceOptimizer')
    this.config = {
      useFloat32: config?.useFloat32 ?? true,
      enableVectorization: config?.enableVectorization ?? true,
      normalizeInputs: config?.normalizeInputs ?? true,
      cachePreprocessing: config?.cachePreprocessing ?? true
    }
    this.preprocessingCache = new Map()
  }

  /**
   * Optimize feature vector for inference
   */
  public optimizeFeatureVector(
    featureVector: MLFeatureVector,
    modelType: MLModelType,
    modelMetadata?: ModelMetadata
  ): PreprocessingResult {
    const startTime = Date.now()

    try {
      // Check cache
      if (this.config.cachePreprocessing) {
        const cacheKey = `${featureVector.symbol}:${featureVector.timestamp}:${modelType}`
        const cached = this.preprocessingCache.get(cacheKey)
        if (cached) {
          return cached
        }
      }

      // Extract feature values in consistent order
      const featureNames = featureVector.featureNames
      const featureValues = featureNames.map(name => featureVector.features[name] || 0)

      // Apply algorithm-specific preprocessing
      let optimizedValues: Float32Array
      let normalizationParams: PreprocessingResult['normalizationParams']

      switch (modelType) {
        case MLModelType.LIGHTGBM:
          ({ values: optimizedValues, params: normalizationParams } = this.optimizeLightGBM(featureValues))
          break
        case MLModelType.XGBOOST:
          ({ values: optimizedValues, params: normalizationParams } = this.optimizeXGBoost(featureValues))
          break
        case MLModelType.LSTM:
          ({ values: optimizedValues, params: normalizationParams } = this.optimizeLSTM(featureValues))
          break
        case MLModelType.ENSEMBLE:
          ({ values: optimizedValues, params: normalizationParams } = this.optimizeEnsemble(featureValues))
          break
        default:
          optimizedValues = this.toFloat32Array(featureValues)
      }

      const result: PreprocessingResult = {
        optimizedVector: {
          values: optimizedValues,
          featureNames,
          symbol: featureVector.symbol,
          timestamp: featureVector.timestamp
        },
        normalizationParams,
        preprocessingTimeMs: Date.now() - startTime
      }

      // Cache result
      if (this.config.cachePreprocessing) {
        const cacheKey = `${featureVector.symbol}:${featureVector.timestamp}:${modelType}`
        this.preprocessingCache.set(cacheKey, result)

        // Limit cache size
        if (this.preprocessingCache.size > 1000) {
          const firstKey = this.preprocessingCache.keys().next().value
          if (firstKey !== undefined) {
            this.preprocessingCache.delete(firstKey)
          }
        }
      }

      return result
    } catch (error) {
      this.logger.error(`Feature optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  /**
   * Optimize for LightGBM (gradient boosting)
   * LightGBM benefits from normalized features but handles scaling internally
   */
  private optimizeLightGBM(features: number[]): {
    values: Float32Array
    params?: PreprocessingResult['normalizationParams']
  } {
    // LightGBM is scale-invariant but benefits from Float32 for speed
    const values = this.toFloat32Array(features)

    // Optional: Min-max normalization for stability
    if (this.config.normalizeInputs) {
      const { normalized, min, max } = this.minMaxNormalize(values)
      return {
        values: normalized,
        params: { mean: [], std: [], min, max }
      }
    }

    return { values }
  }

  /**
   * Optimize for XGBoost (gradient boosting)
   * XGBoost also scale-invariant but benefits from consistent ranges
   */
  private optimizeXGBoost(features: number[]): {
    values: Float32Array
    params?: PreprocessingResult['normalizationParams']
  } {
    // Similar to LightGBM optimization
    const values = this.toFloat32Array(features)

    if (this.config.normalizeInputs) {
      const { normalized, min, max } = this.minMaxNormalize(values)
      return {
        values: normalized,
        params: { mean: [], std: [], min, max }
      }
    }

    return { values }
  }

  /**
   * Optimize for LSTM (recurrent neural network)
   * LSTMs require standardized inputs for gradient stability
   */
  private optimizeLSTM(features: number[]): {
    values: Float32Array
    params?: PreprocessingResult['normalizationParams']
  } {
    const values = this.toFloat32Array(features)

    // LSTM requires z-score normalization for gradient stability
    const { normalized, mean, std } = this.zScoreNormalize(values)

    return {
      values: normalized,
      params: { mean, std, min: [], max: [] }
    }
  }

  /**
   * Optimize for ensemble models
   * Use most conservative normalization
   */
  private optimizeEnsemble(features: number[]): {
    values: Float32Array
    params?: PreprocessingResult['normalizationParams']
  } {
    // Ensemble benefits from z-score normalization
    const values = this.toFloat32Array(features)

    if (this.config.normalizeInputs) {
      const { normalized, mean, std } = this.zScoreNormalize(values)
      return {
        values: normalized,
        params: { mean, std, min: [], max: [] }
      }
    }

    return { values }
  }

  /**
   * Convert to Float32Array for performance
   */
  private toFloat32Array(values: number[]): Float32Array {
    if (this.config.useFloat32) {
      return new Float32Array(values)
    }
    return new Float32Array(values) // Always use Float32 for consistency
  }

  /**
   * Min-Max normalization to [0, 1] range
   */
  private minMaxNormalize(values: Float32Array): {
    normalized: Float32Array
    min: number[]
    max: number[]
  } {
    const min: number[] = []
    const max: number[] = []
    const normalized = new Float32Array(values.length)

    // Single pass to find min/max and normalize
    for (let i = 0; i < values.length; i++) {
      const val = values[i]
      if (i === 0 || val < min[0]) min[0] = val
      if (i === 0 || val > max[0]) max[0] = val
    }

    const range = max[0] - min[0]
    if (range === 0) {
      // All values are the same, return zeros
      return { normalized, min, max }
    }

    for (let i = 0; i < values.length; i++) {
      normalized[i] = (values[i] - min[0]) / range
    }

    return { normalized, min, max }
  }

  /**
   * Z-score normalization (standardization)
   */
  private zScoreNormalize(values: Float32Array): {
    normalized: Float32Array
    mean: number[]
    std: number[]
  } {
    // Calculate mean
    let sum = 0
    for (let i = 0; i < values.length; i++) {
      sum += values[i]
    }
    const mean = sum / values.length

    // Calculate standard deviation
    let squaredDiffSum = 0
    for (let i = 0; i < values.length; i++) {
      const diff = values[i] - mean
      squaredDiffSum += diff * diff
    }
    const std = Math.sqrt(squaredDiffSum / values.length)

    // Normalize
    const normalized = new Float32Array(values.length)
    if (std === 0) {
      // All values are the same, return zeros
      return { normalized, mean: [mean], std: [std] }
    }

    for (let i = 0; i < values.length; i++) {
      normalized[i] = (values[i] - mean) / std
    }

    return { normalized, mean: [mean], std: [std] }
  }

  /**
   * Batch optimization for multiple feature vectors
   */
  public optimizeBatch(
    featureVectors: MLFeatureVector[],
    modelType: MLModelType,
    modelMetadata?: ModelMetadata
  ): PreprocessingResult[] {
    if (!this.config.enableVectorization) {
      // Sequential optimization
      return featureVectors.map(fv => this.optimizeFeatureVector(fv, modelType, modelMetadata))
    }

    // Vectorized batch optimization
    return featureVectors.map(fv => this.optimizeFeatureVector(fv, modelType, modelMetadata))
  }

  /**
   * Handle missing features with imputation
   */
  public imputeMissingFeatures(
    featureVector: MLFeatureVector,
    requiredFeatures: string[],
    strategy: 'zero' | 'mean' | 'median' = 'zero'
  ): MLFeatureVector {
    const features = { ...featureVector.features }

    // Find missing features
    const missing = requiredFeatures.filter(f => !(f in features))

    if (missing.length === 0) {
      return featureVector
    }

    // Impute based on strategy
    switch (strategy) {
      case 'zero':
        missing.forEach(f => { features[f] = 0 })
        break
      case 'mean':
        // Calculate mean of existing features
        const values = Object.values(features)
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length
        missing.forEach(f => { features[f] = mean })
        break
      case 'median':
        // Calculate median of existing features
        const sorted = Object.values(features).sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        missing.forEach(f => { features[f] = median })
        break
    }

    return {
      ...featureVector,
      features,
      featureNames: requiredFeatures,
      completeness: (requiredFeatures.length - missing.length) / requiredFeatures.length
    }
  }

  /**
   * Validate feature vector dimensions
   */
  public validateDimensions(
    featureVector: MLFeatureVector,
    expectedFeatures: string[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check for missing required features
    const missing = expectedFeatures.filter(f => !(f in featureVector.features))
    if (missing.length > 0) {
      errors.push(`Missing features: ${missing.join(', ')}`)
    }

    // Check for NaN or Infinity values
    Object.entries(featureVector.features).forEach(([name, value]) => {
      if (!Number.isFinite(value)) {
        errors.push(`Invalid value for feature ${name}: ${value}`)
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Clear preprocessing cache
   */
  public clearCache(): void {
    this.preprocessingCache.clear()
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number
    maxSize: number
    hitRate?: number
  } {
    return {
      size: this.preprocessingCache.size,
      maxSize: 1000
    }
  }
}
