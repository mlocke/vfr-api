/**
 * Type definitions for MCP Data Fusion System
 * Provides unified data models and interfaces for multi-source data fusion
 */

/**
 * Data quality metrics for scoring
 */
export interface DataQualityMetrics {
  freshness: number // 0-1 score based on data timestamp
  completeness: number // 0-1 score based on fields present
  accuracy: number // 0-1 score based on cross-validation
  sourceReputation: number // 0-1 score based on historical performance
  latency: number // Response time in milliseconds
}

/**
 * Quality score with detailed breakdown
 */
export interface QualityScore {
  overall: number // Weighted average of all metrics (0-1)
  metrics: DataQualityMetrics
  timestamp: number
  source: string
}

/**
 * Conflict resolution strategies
 */
export enum ConflictResolutionStrategy {
  HIGHEST_QUALITY = 'highest_quality', // Use data from highest quality source
  MOST_RECENT = 'most_recent', // Use most recently updated data
  CONSENSUS = 'consensus', // Use majority vote from sources
  WEIGHTED_AVERAGE = 'weighted_average', // Average weighted by quality scores
  CUSTOM = 'custom' // User-defined resolution function
}

/**
 * Data validation result
 */
export interface ValidationResult {
  isValid: boolean
  discrepancies: DataDiscrepancy[]
  confidence: number // 0-1 confidence in validation
}

/**
 * Data discrepancy between sources
 */
export interface DataDiscrepancy {
  field: string
  sources: {
    [source: string]: any
  }
  variance: number // Percentage variance between values
  resolution: {
    strategy: ConflictResolutionStrategy
    resolvedValue: any
    reason: string
  }
}

/**
 * Fusion metadata for responses
 */
export interface FusionMetadata {
  sources: string[] // Sources that contributed data
  primarySource: string // Main source used
  qualityScore: QualityScore
  conflicts: number // Number of conflicts resolved
  resolutionStrategy: ConflictResolutionStrategy
  validationResult?: ValidationResult
  fusionTimestamp: number
  cacheTTL?: number
}

/**
 * Enhanced MCP response with fusion support
 */
export interface FusedMCPResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  source: string // Primary source
  timestamp: number
  cached?: boolean
  fusion?: FusionMetadata
}

/**
 * Options for fusion requests
 */
export interface FusionOptions {
  sources?: string[] // Specific sources to use (default: all applicable)
  strategy?: ConflictResolutionStrategy // Resolution strategy (default: highest_quality)
  validateData?: boolean // Enable cross-validation (default: true)
  requireConsensus?: boolean // Require majority agreement (default: false)
  minQualityScore?: number // Minimum acceptable quality (0-1, default: 0.5)
  timeout?: number // Max time for fusion operation (ms)
  parallel?: boolean // Fetch from sources in parallel (default: true)
  cacheFusion?: boolean // Cache the fused result (default: true)
  includeMetadata?: boolean // Include detailed fusion metadata (default: true)
}

/**
 * Source configuration for fusion
 */
export interface FusionSourceConfig {
  id: string
  priority: number // 1-10, higher is preferred
  weight: number // Weight for averaging (0-1)
  costPerRequest?: number // Cost in cents
  capabilities: string[] // Tool names this source supports
  qualityModifier?: number // Modifier for quality scores (-1 to 1)
  maxRetries?: number
  timeout?: number
}

/**
 * Unified data models for common financial data types
 */

export interface UnifiedStockPrice {
  symbol: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
  adjustedClose?: number
  dividends?: number
  splits?: number
  source: string
  quality: QualityScore
}

export interface UnifiedCompanyInfo {
  symbol: string
  name: string
  exchange: string
  marketCap?: number
  sector?: string
  industry?: string
  description?: string
  website?: string
  employees?: number
  headquarters?: string
  foundedYear?: number
  source: string
  quality: QualityScore
}

export interface UnifiedFinancialStatement {
  symbol: string
  period: 'annual' | 'quarterly'
  fiscalYear: number
  fiscalQuarter?: number
  revenue?: number
  netIncome?: number
  eps?: number
  totalAssets?: number
  totalLiabilities?: number
  totalEquity?: number
  operatingCashFlow?: number
  freeCashFlow?: number
  source: string
  quality: QualityScore
}

export interface UnifiedTechnicalIndicator {
  symbol: string
  indicator: string // RSI, MACD, SMA, etc.
  timestamp: number
  value: number | { [key: string]: number } // Single value or multiple (MACD)
  parameters?: { [key: string]: any } // Indicator parameters
  source: string
  quality: QualityScore
}

export interface UnifiedNewsItem {
  id: string
  title: string
  description: string
  url: string
  publishedAt: number
  source: string
  symbols: string[]
  sentiment?: {
    score: number // -1 to 1
    label: 'positive' | 'negative' | 'neutral'
  }
  quality: QualityScore
}

/**
 * Treasury Fiscal Data Types
 * For U.S. Treasury government fiscal data integration
 */

export interface UnifiedTreasuryDebt {
  amount: number
  date: string
  formattedAmount: string
  amountTrillions: string
  source: string
  quality: QualityScore
}

export interface UnifiedTreasuryOperations {
  date: string
  openingBalance: number
  closingBalance: number
  receipts: number
  withdrawals: number
  netChange: number
  source: string
  quality: QualityScore
}

export interface UnifiedTreasurySpending {
  fiscalYear: string
  month: string
  category: string
  description: string
  amount: number
  formattedAmount: string
  source: string
  quality: QualityScore
}

export interface UnifiedTreasuryRevenue {
  fiscalYear: string
  month: string
  category: string
  description: string
  amount: number
  formattedAmount: string
  source: string
  quality: QualityScore
}

export interface UnifiedTreasuryExchangeRate {
  date: string
  currency: string
  exchangeRate: number
  source: string
  quality: QualityScore
}

export interface UnifiedYieldCurve {
  date: string
  rates: {
    '1_month'?: number
    '3_month'?: number
    '6_month'?: number
    '1_year'?: number
    '2_year'?: number
    '5_year'?: number
    '10_year'?: number
    '30_year'?: number
  }
  curveShape?: 'normal' | 'inverted' | 'flat' | 'humped'
  recessionIndicator?: boolean
  source: string
  quality: QualityScore
}

export interface UnifiedFiscalIndicators {
  date: string
  federalDebt: UnifiedTreasuryDebt
  yieldCurve?: UnifiedYieldCurve
  cashBalance?: number
  debtToGDPRatio?: number
  interestExpense?: number
  source: string
  quality: QualityScore
}

/**
 * Fusion engine state and statistics
 */
export interface FusionEngineStats {
  totalRequests: number
  fusedRequests: number
  conflictsResolved: number
  averageQualityScore: number
  sourcesUsed: {
    [source: string]: {
      requests: number
      successRate: number
      averageQuality: number
      averageLatency: number
    }
  }
  cacheHitRate: number
  validationSuccessRate: number
}

/**
 * Custom resolution function type
 */
export type CustomResolutionFunction<T = any> = (
  dataPoints: Array<{ source: string; data: T; quality: QualityScore }>,
  context?: any
) => T

/**
 * Fusion rule configuration
 */
export interface FusionRule {
  dataType: string // 'price', 'volume', 'fundamentals', etc.
  field?: string // Specific field within data type
  strategy: ConflictResolutionStrategy
  customResolver?: CustomResolutionFunction
  validationThreshold?: number // Max acceptable variance
  requiredSources?: string[] // Sources that must agree
  excludedSources?: string[] // Sources to ignore
}

/**
 * Fusion configuration
 */
export interface FusionConfig {
  defaultStrategy: ConflictResolutionStrategy
  rules: FusionRule[]
  sources: FusionSourceConfig[]
  validation: {
    enabled: boolean
    thresholds: {
      price: number // Max % variance
      volume: number // Max % variance
      marketCap: number // Max % variance
      default: number // Default max % variance
    }
  }
  quality: {
    weights: {
      freshness: number
      completeness: number
      accuracy: number
      sourceReputation: number
      latency: number
    }
    minAcceptable: number // Minimum quality score to use data
  }
  performance: {
    parallelRequests: boolean
    maxConcurrent: number
    timeoutMs: number
    cacheEnabled: boolean
    cacheTTL: number
  }
}