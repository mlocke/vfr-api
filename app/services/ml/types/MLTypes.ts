/**
 * ML-specific type definitions for VFR Machine Learning Enhancement Layer
 * Following VFR patterns with comprehensive type safety
 */

import { ErrorType, ErrorCode, ErrorSeverity } from '../../error-handling/ErrorHandler'

// ===== Core ML Configuration Types =====

export enum MLModelType {
  LIGHTGBM = 'LIGHTGBM',
  XGBOOST = 'XGBOOST',
  LSTM = 'LSTM',
  ENSEMBLE = 'ENSEMBLE'
}

export enum MLPredictionHorizon {
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  ONE_DAY = '1d',
  ONE_WEEK = '1w',
  ONE_MONTH = '1m'
}

export enum MLModelStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TRAINING = 'TRAINING',
  DEPRECATED = 'DEPRECATED',
  FAILED = 'FAILED'
}

export enum MLFeatureType {
  TECHNICAL = 'TECHNICAL',
  FUNDAMENTAL = 'FUNDAMENTAL',
  SENTIMENT = 'SENTIMENT',
  MACRO = 'MACRO',
  ALTERNATIVE = 'ALTERNATIVE'
}

// ===== Model Configuration =====

export interface MLModelConfig {
  modelId: string
  modelType: MLModelType
  version: string
  status: MLModelStatus
  horizon: MLPredictionHorizon
  features: string[]
  hyperparameters: Record<string, any>
  performanceMetrics: MLModelPerformance
  createdAt: number
  updatedAt: number
  deployedAt?: number
}

export interface MLModelPerformance {
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  sharpeRatio: number
  validationAccuracy: number
  trainingLoss: number
  validationLoss: number
  lastUpdated: number
}

// ===== Feature Engineering Types =====

export interface MLFeature {
  featureId: string
  symbol: string
  featureType: MLFeatureType
  featureName: string
  value: number
  timestamp: number
  dataQuality: number
  source: string
}

export interface MLFeatureVector {
  symbol: string
  features: Record<string, number>
  featureNames: string[]
  timestamp: number
  completeness: number
  qualityScore: number
}

export interface MLFeatureDefinition {
  featureId: string
  featureName: string
  featureType: MLFeatureType
  description: string
  dataType: 'numeric' | 'categorical' | 'boolean'
  required: boolean
  defaultValue?: number
  validRange?: {
    min: number
    max: number
  }
  transformations?: string[]
}

// ===== Prediction Types =====

export interface MLPrediction {
  symbol: string
  modelId: string
  modelVersion: string
  horizon: MLPredictionHorizon
  prediction: {
    direction: 'BUY' | 'SELL' | 'HOLD'
    confidence: number
    expectedReturn: number
    probability: number
  }
  features: MLFeatureVector
  timestamp: number
  expiresAt: number
}

export interface MLEnsemblePrediction extends MLPrediction {
  modelPredictions: Array<{
    modelId: string
    modelType: MLModelType
    prediction: MLPrediction['prediction']
    weight: number
    confidence: number
  }>
  aggregationMethod: 'weighted' | 'voting' | 'stacking'
  consensusStrength: number
}

// ===== Enhancement Integration Types =====

export interface MLEnhancement {
  enhancementId: string
  symbol: string
  factorType: 'technical' | 'fundamental' | 'sentiment' | 'macro' | 'alternative'
  enhancementValue: number
  confidence: number
  timestamp: number
  mlContribution: number
  modelIds: string[]
}

export interface MLEnhancedScore {
  symbol: string
  baseScore: number
  mlEnhancement: number
  finalScore: number
  confidence: number
  breakdown: {
    technicalScore: number
    fundamentalScore: number
    sentimentScore: number
    macroScore: number
    alternativeScore: number
    mlScore: number
  }
  recommendations: {
    action: 'BUY' | 'SELL' | 'HOLD'
    strength: string
    confidence: number
    reasoning: string[]
  }
  timestamp: number
}

// ===== Service Response Types =====

export interface MLServiceResponse<T> {
  success: boolean
  data?: T
  error?: {
    type: ErrorType
    code: ErrorCode
    message: string
    severity: ErrorSeverity
    timestamp: number
    source: string
    retryable: boolean
  }
  metadata?: {
    latency: number
    cacheHit: boolean
    modelVersion?: string
    dataQuality?: number
  }
}

export interface MLPredictionResponse extends MLServiceResponse<MLPrediction> {
  fallbackUsed?: boolean
  modelsUsed: string[]
}

export interface MLFeatureResponse extends MLServiceResponse<MLFeatureVector> {
  featuresExtracted: number
  dataSources: string[]
}

// ===== Cache Types =====

export interface MLCacheConfig {
  predictionTTL: number // 5 minutes default
  featureTTL: number // 15 minutes default
  modelMetadataTTL: number // 1 hour default
  enhancementStatusTTL: number // 1 minute default
  enableCompression: boolean
}

export interface MLCacheEntry<T> {
  key: string
  value: T
  timestamp: number
  expiresAt: number
  hits: number
  size?: number
}

// ===== Performance Monitoring Types =====

export interface MLPerformanceMetrics {
  serviceId: string
  operation: string
  latency: number
  cacheHitRate: number
  predictionAccuracy?: number
  featureCompleteness?: number
  modelLoadTime?: number
  inferenceTime?: number
  timestamp: number
}

export interface MLHealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable'
  services: {
    predictionService: boolean
    featureService: boolean
    modelManager: boolean
    enhancementService: boolean
  }
  metrics: {
    avgLatency: number
    cacheHitRate: number
    errorRate: number
    activeModels: number
  }
  lastCheck: number
}

// ===== Training Types =====

export interface MLTrainingConfig {
  modelType: MLModelType
  horizon: MLPredictionHorizon
  features: string[]
  hyperparameters: Record<string, any>
  trainTestSplit: number
  validationSplit: number
  epochs?: number
  batchSize?: number
  learningRate?: number
}

export interface MLTrainingResult {
  modelId: string
  modelVersion: string
  trainingMetrics: MLModelPerformance
  validationMetrics: MLModelPerformance
  testMetrics: MLModelPerformance
  featureImportance: Record<string, number>
  trainingDuration: number
  timestamp: number
}

// ===== User Tier Types =====

export enum MLUserTier {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PREMIUM = 'PREMIUM',
  INSTITUTIONAL = 'INSTITUTIONAL'
}

export interface MLUserAccess {
  userId: string
  tier: MLUserTier
  features: {
    mlPredictions: boolean
    multiHorizon: boolean
    ensembleModels: boolean
    advancedFeatures: boolean
    customModels: boolean
  }
  limits: {
    dailyPredictions: number
    concurrentRequests: number
    historicalDataMonths: number
  }
  usage: {
    predictionsToday: number
    totalPredictions: number
    lastRequest: number
  }
}

// ===== Fallback Types =====

export interface MLFallbackConfig {
  enableFallback: boolean
  fallbackToClassic: boolean
  maxRetries: number
  retryDelay: number
  gracefulDegradation: boolean
}

export interface MLFallbackStatus {
  mlAvailable: boolean
  fallbackActive: boolean
  reason?: string
  fallbackSince?: number
  estimatedRecovery?: number
}

// ===== Error Types =====

export enum MLErrorType {
  MODEL_LOADING_ERROR = 'MODEL_LOADING_ERROR',
  FEATURE_EXTRACTION_ERROR = 'FEATURE_EXTRACTION_ERROR',
  PREDICTION_ERROR = 'PREDICTION_ERROR',
  DATA_QUALITY_ERROR = 'DATA_QUALITY_ERROR',
  INFERENCE_TIMEOUT = 'INFERENCE_TIMEOUT',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  INVALID_FEATURE_VECTOR = 'INVALID_FEATURE_VECTOR',
  ENSEMBLE_CONSENSUS_FAILURE = 'ENSEMBLE_CONSENSUS_FAILURE'
}

export interface MLError extends Error {
  type: MLErrorType
  modelId?: string
  symbol?: string
  featureId?: string
  retryable: boolean
  metadata?: Record<string, any>
}

// ===== Validation Types =====

export interface MLValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  qualityScore: number
  completeness: number
}

export interface MLFeatureValidation extends MLValidationResult {
  featureId: string
  featureName: string
  value: number
  expectedRange?: {
    min: number
    max: number
  }
  outlierScore?: number
}

// ===== Type Guards =====

export function isMLPrediction(obj: any): obj is MLPrediction {
  return (
    obj &&
    typeof obj === 'object' &&
    'symbol' in obj &&
    'modelId' in obj &&
    'prediction' in obj &&
    'direction' in obj.prediction
  )
}

export function isMLFeatureVector(obj: any): obj is MLFeatureVector {
  return (
    obj &&
    typeof obj === 'object' &&
    'symbol' in obj &&
    'features' in obj &&
    'featureNames' in obj &&
    Array.isArray(obj.featureNames)
  )
}

export function isMLServiceResponse<T>(obj: any): obj is MLServiceResponse<T> {
  return (
    obj &&
    typeof obj === 'object' &&
    'success' in obj &&
    typeof obj.success === 'boolean'
  )
}

// All types are already exported via their interface/type declarations above
