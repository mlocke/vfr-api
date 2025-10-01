/**
 * Enhancement layer interfaces for VFR ML integration
 * Defines how ML enhancements integrate with existing VFR analysis
 */

import {
  MLPrediction,
  MLFeatureVector,
  MLEnhancement,
  MLEnhancedScore,
  MLPredictionHorizon,
  MLUserTier
} from './MLTypes'

// ===== Stock Selection Enhancement =====

export interface EnhancedStockSelectionRequest {
  symbols: string[]
  sector?: string
  includeML: boolean
  mlModels?: string[]
  mlHorizon?: MLPredictionHorizon
  mlConfidenceThreshold?: number
  userTier?: MLUserTier
}

export interface EnhancedStockSelectionResponse {
  success: boolean
  results: EnhancedStockResult[]
  mlEnabled: boolean
  mlFallbackUsed: boolean
  metadata: {
    timestamp: number
    processingTime: number
    classicAnalysisTime: number
    mlEnhancementTime: number
    cacheHitRate: number
  }
  error?: string
}

export interface EnhancedStockResult {
  symbol: string
  // Classic VFR scores (preserved)
  classicScore: {
    totalScore: number
    recommendation: 'BUY' | 'SELL' | 'HOLD'
    confidence: number
    technicalScore: number
    fundamentalScore: number
    sentimentScore: number
    macroScore: number
    alternativeScore: number
  }
  // ML enhancement (optional)
  mlEnhancement?: {
    mlScore: number
    prediction: MLPrediction
    confidence: number
    expectedReturn: number
    modelContribution: number
  }
  // Final combined score
  finalScore: number
  finalRecommendation: 'BUY' | 'SELL' | 'HOLD'
  finalConfidence: number
  // Supporting data
  reasoning: string[]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  timestamp: number
}

// ===== Factor Enhancement Integration =====

export interface FactorEnhancement {
  factorType: 'technical' | 'fundamental' | 'sentiment' | 'macro' | 'alternative'
  classicValue: number
  mlEnhancementValue: number
  enhancedValue: number
  confidence: number
  mlContribution: number
  dataQuality: number
}

export interface EnhancedFactorScores {
  symbol: string
  factors: {
    technical: FactorEnhancement
    fundamental: FactorEnhancement
    sentiment: FactorEnhancement
    macro: FactorEnhancement
    alternative: FactorEnhancement
  }
  mlWeight: number
  classicWeight: number
  timestamp: number
}

// ===== Feature Integration Interfaces =====

export interface TechnicalFeatureIntegration {
  symbol: string
  // Classic technical analysis (unchanged)
  classicTechnical: {
    vwap: number
    indicators: Record<string, number>
    score: number
  }
  // ML-enhanced features
  mlFeatures?: {
    momentum: {
      oneDay: number
      fiveDay: number
      twentyDay: number
    }
    volatility: {
      realized: number
      zScore: number
    }
    meanReversion: {
      priceZScore: number
      volumeZScore: number
    }
  }
  timestamp: number
}

export interface FundamentalFeatureIntegration {
  symbol: string
  // Classic fundamental analysis (unchanged)
  classicFundamental: {
    ratios: Record<string, number>
    score: number
  }
  // ML-enhanced features
  mlFeatures?: {
    valuationMetrics: {
      peRatio: number
      pbRatio: number
      normalizedPE: number
    }
    profitabilityMetrics: {
      roe: number
      margins: number
      growthRate: number
    }
    financialHealthMetrics: {
      debtToEquity: number
      currentRatio: number
      qualityScore: number
    }
  }
  timestamp: number
}

export interface SentimentFeatureIntegration {
  symbol: string
  // Classic sentiment analysis (unchanged)
  classicSentiment: {
    analystConsensus: number
    newsScore: number
    redditScore: number
    score: number
  }
  // ML-enhanced features
  mlFeatures?: {
    sentimentEmbedding?: number[]
    sentimentMomentum: number
    consensusStrength: number
  }
  timestamp: number
}

// ===== Enhancement Orchestration =====

export interface EnhancementOrchestrationConfig {
  enableParallelExecution: boolean
  targetLatency: number // <500ms default
  enableGracefulDegradation: boolean
  fallbackToClassic: boolean
  maxRetries: number
  timeout: number
}

export interface EnhancementOrchestrationResult {
  symbol: string
  enhancements: {
    technical?: MLEnhancement
    fundamental?: MLEnhancement
    sentiment?: MLEnhancement
    macro?: MLEnhancement
    alternative?: MLEnhancement
  }
  aggregatedScore: MLEnhancedScore
  latency: number
  success: boolean
  fallbackUsed: boolean
  errors: string[]
  warnings: string[]
  timestamp: number
}

// ===== Scoring Engine Integration =====

export interface ScoringEngineConfig {
  // Classic VFR weights (preserved)
  classicWeights: {
    technical: number // 40%
    fundamental: number // 25%
    sentiment: number // 10%
    macro: number // 20%
    alternative: number // 5%
  }
  // ML enhancement weight (configurable)
  mlWeight: number // 10-15% default
  // Confidence weighting
  useConfidenceWeighting: boolean
  minConfidenceThreshold: number
}

export interface EnhancedScoringResult {
  symbol: string
  // Score breakdown
  scores: {
    classicComposite: number
    mlEnhancement: number
    finalComposite: number
  }
  // Weighted contributions
  contributions: {
    technical: number
    fundamental: number
    sentiment: number
    macro: number
    alternative: number
    ml: number
  }
  // Normalized 0-100
  normalizedScore: number
  recommendation: 'BUY' | 'SELL' | 'HOLD'
  recommendationStrength: string
  confidence: number
  timestamp: number
}

// ===== Graceful Degradation =====

export interface GracefulDegradationConfig {
  enableFallback: boolean
  fallbackStrategy: 'classic' | 'cached' | 'partial'
  maxDegradationTime: number
  alertOnDegradation: boolean
}

export interface DegradationStatus {
  isDegraded: boolean
  degradationType: 'none' | 'partial' | 'complete'
  affectedServices: string[]
  fallbackActive: boolean
  fallbackStrategy: string
  degradationStarted?: number
  estimatedRecovery?: number
}

// ===== Performance Monitoring =====

export interface EnhancementPerformanceMetrics {
  operation: string
  totalLatency: number
  breakdown: {
    classicAnalysis: number
    featureExtraction: number
    mlInference: number
    scoreAggregation: number
    caching: number
  }
  cacheHitRate: number
  mlContribution: number
  success: boolean
  timestamp: number
}

// ===== API Integration =====

export interface MLEnhancedAPIRequest {
  // Standard VFR parameters (preserved)
  symbols: string[]
  sector?: string
  // ML-specific parameters (optional)
  includeML?: boolean
  mlModels?: string[]
  mlHorizon?: MLPredictionHorizon
  mlConfidenceThreshold?: number
  // Authentication
  userId?: string
  userTier?: MLUserTier
}

export interface MLEnhancedAPIResponse {
  success: boolean
  data?: EnhancedStockResult[]
  mlEnabled: boolean
  mlFallbackUsed: boolean
  metadata: {
    timestamp: number
    processingTime: number
    cacheHitRate: number
    modelsUsed: string[]
    dataQuality: number
  }
  error?: {
    message: string
    code: string
    retryable: boolean
  }
}

// ===== Health Check Integration =====

export interface MLHealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unavailable'
  mlServices: {
    predictionService: {
      available: boolean
      latency: number
      errorRate: number
    }
    featureService: {
      available: boolean
      latency: number
      completeness: number
    }
    modelManager: {
      available: boolean
      activeModels: number
      cachedModels: number
    }
    enhancementService: {
      available: boolean
      latency: number
      successRate: number
    }
  }
  fallbackStatus: DegradationStatus
  timestamp: number
}

// ===== Admin Monitoring =====

export interface MLAdminMonitoringData {
  models: {
    total: number
    active: number
    training: number
    deprecated: number
  }
  predictions: {
    todayCount: number
    successRate: number
    avgLatency: number
    avgConfidence: number
  }
  features: {
    totalFeatures: number
    avgCompleteness: number
    avgQuality: number
    cacheHitRate: number
  }
  performance: {
    avgEnhancementLatency: number
    cacheHitRate: number
    fallbackRate: number
    errorRate: number
  }
  timestamp: number
}

// All types are already exported via their interface/type declarations above
