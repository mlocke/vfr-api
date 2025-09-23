/**
 * Type definitions for Stock Selection Service
 * Provides flexible interfaces for single stock, sector, and multi-stock analysis
 */

import { SectorOption } from '../../components/SectorDropdown'
import { AlgorithmConfiguration, SelectionResult, StockScore } from '../algorithms/types'
import { QualityScore } from '../types/core-types'

/**
 * Selection mode types
 */
export enum SelectionMode {
  SINGLE_STOCK = 'single_stock',
  SECTOR_ANALYSIS = 'sector_analysis',
  MULTIPLE_STOCKS = 'multiple_stocks',
  INDEX_ANALYSIS = 'index_analysis',
  ETF_ANALYSIS = 'etf_analysis'
}

/**
 * Analysis scope and preferences
 */
export interface AnalysisScope {
  mode: SelectionMode
  symbols?: string[] // For single/multiple stock analysis
  sector?: SectorOption // For sector/index/ETF analysis
  excludeSymbols?: string[] // Symbols to exclude from analysis
  maxResults?: number // Limit results for large sets
  timeframe?: {
    start?: number // Unix timestamp
    end?: number // Unix timestamp
    period?: 'day' | 'week' | 'month' | 'quarter' | 'year'
  }
}

/**
 * Selection options and preferences
 */
export interface SelectionOptions {
  algorithmId?: string // Specific algorithm to use
  useRealTimeData?: boolean // Prefer real-time over cached data
  includeSentiment?: boolean // Include sentiment analysis
  includeNews?: boolean // Include news impact analysis
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive'

  // Data preferences
  dataPreferences?: {
    sources?: string[] // Preferred data sources
    minQualityScore?: number // Minimum data quality threshold
    maxLatency?: number // Maximum acceptable data age (ms)
  }

  // Analysis customization
  customWeights?: {
    technical?: number // Weight for technical analysis (0-1)
    fundamental?: number // Weight for fundamental analysis (0-1)
    sentiment?: number // Weight for sentiment analysis (0-1)
    momentum?: number // Weight for momentum factors (0-1)
  }

  // Performance constraints
  timeout?: number // Maximum analysis time (ms)
  parallel?: boolean // Enable parallel processing
}

/**
 * Selection request combining scope and options
 */
export interface SelectionRequest {
  scope: AnalysisScope
  options?: SelectionOptions
  requestId?: string // For tracking/caching
  userId?: string // For personalization
}

/**
 * Enhanced stock result with additional context
 */
export interface EnhancedStockResult {
  symbol: string
  score: StockScore
  weight: number
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number

  // Additional context
  context: {
    sector: string
    marketCap: number
    priceChange24h?: number
    volumeChange24h?: number
    beta?: number
    // Extended hours data
    preMarketPrice?: number
    preMarketChange?: number
    preMarketChangePercent?: number
    afterHoursPrice?: number
    afterHoursChange?: number
    afterHoursChangePercent?: number
    marketStatus?: 'pre-market' | 'market-hours' | 'after-hours' | 'closed'
  }

  // Reasoning and factors
  reasoning: {
    primaryFactors: string[] // Key factors driving the selection
    warnings?: string[] // Risk factors or concerns
    opportunities?: string[] // Potential upside factors
  }

  // Data quality indicators
  dataQuality: {
    overall: QualityScore
    sourceBreakdown: {
      [source: string]: QualityScore
    }
    lastUpdated: number
  }
}

/**
 * Sector analysis results
 */
export interface SectorAnalysisResult {
  sector: SectorOption
  overview: {
    totalStocks: number
    avgScore: number
    topPerformers: number
    underperformers: number
    marketCapTotal: number
    volumeTotal: number
  }

  // Sector-wide metrics
  sectorMetrics: {
    momentum: number // Sector momentum score
    valuation: number // Relative valuation score
    growth: number // Growth prospects score
    stability: number // Volatility/stability score
  }

  // Top selections from sector
  topSelections: EnhancedStockResult[]

  // Sector comparison data
  comparison?: {
    vsMarket: {
      performance: number // Relative performance vs market
      valuation: number // Relative valuation vs market
      momentum: number // Relative momentum vs market
    }
    peerSectors: {
      sector: string
      relativeScore: number
    }[]
  }
}

/**
 * Multi-stock analysis results
 */
export interface MultiStockAnalysisResult {
  request: SelectionRequest
  results: EnhancedStockResult[]

  // Portfolio-level metrics
  portfolioMetrics: {
    overallScore: number
    diversificationScore: number
    riskScore: number
    correlationMatrix?: { [symbol: string]: { [symbol: string]: number } }
    sectorBreakdown: { [sector: string]: number }
    marketCapBreakdown: {
      large: number
      mid: number
      small: number
    }
  }

  // Recommendations
  recommendations: {
    allocation: { [symbol: string]: number } // Suggested portfolio weights
    rebalancing?: {
      action: 'add' | 'reduce' | 'hold'
      symbol: string
      targetWeight: number
      currentWeight?: number
    }[]
    riskWarnings?: string[]
  }
}

/**
 * Comprehensive selection result
 */
export interface SelectionResponse {
  success: boolean
  requestId: string
  timestamp: number
  executionTime: number

  // Core results based on selection mode
  singleStock?: EnhancedStockResult
  sectorAnalysis?: SectorAnalysisResult
  multiStockAnalysis?: MultiStockAnalysisResult

  // Unified results for any mode
  topSelections: EnhancedStockResult[]

  // Execution metadata
  metadata: {
    algorithmUsed: string
    dataSourcesUsed: string[]
    cacheHitRate: number
    analysisMode: SelectionMode
    qualityScore: QualityScore
  }

  // Error handling
  warnings?: string[]
  errors?: string[]

  // Performance tracking
  performance: {
    dataFetchTime: number
    analysisTime: number
    fusionTime: number
    cacheTime: number
  }
}

/**
 * Configuration for the selection service
 */
export interface SelectionServiceConfig {
  // Default algorithm settings
  defaultAlgorithmId: string
  fallbackAlgorithmId: string

  // Data source priorities
  dataSources: {
    [source: string]: {
      priority: number
      weight: number
      timeout: number
    }
  }

  // Cache settings
  cache: {
    enabled: boolean
    ttl: {
      singleStock: number
      sectorAnalysis: number
      multiStock: number
    }
    keyStrategy: 'simple' | 'detailed'
  }

  // Performance limits
  limits: {
    maxSymbolsPerRequest: number
    maxConcurrentRequests: number
    defaultTimeout: number
    maxTimeout: number
  }

  // Quality thresholds
  quality: {
    minDataQuality: number
    minSourceAgreement: number
    maxDataAge: number
  }
}

/**
 * Service state and statistics
 */
export interface SelectionServiceStats {
  totalRequests: number
  successRate: number
  averageExecutionTime: number
  cacheHitRate: number

  // Request breakdown
  requestsByMode: {
    [mode in SelectionMode]: number
  }

  // Algorithm usage
  algorithmUsage: {
    [algorithmId: string]: {
      requests: number
      successRate: number
      avgExecutionTime: number
    }
  }

  // Data source statistics
  sourceStats: {
    [source: string]: {
      requests: number
      successRate: number
      avgLatency: number
      avgQuality: number
    }
  }
}

/**
 * Event types for monitoring and logging
 */
export interface SelectionServiceEvent {
  type: 'request_start' | 'request_complete' | 'request_error' | 'cache_hit' | 'cache_miss' | 'algorithm_switch'
  timestamp: number
  requestId: string
  data: any
}

/**
 * Integration interfaces for external systems
 */
export interface AlgorithmIntegrationInterface {
  executeAnalysis: (request: SelectionRequest) => Promise<SelectionResult>
  validateConfiguration: (config: AlgorithmConfiguration) => boolean
  getAvailableAlgorithms: () => string[]
}

export interface SectorIntegrationInterface {
  getSectorStocks: (sector: SectorOption) => Promise<string[]>
  getSectorMetrics: (sector: SectorOption) => Promise<any>
  compareSectors: (sectors: SectorOption[]) => Promise<any>
}

export interface DataIntegrationInterface {
  fetchStockData: (symbols: string[], options: SelectionOptions) => Promise<any>
  validateDataQuality: (data: any) => Promise<QualityScore>
  getCachedData: (key: string) => Promise<any>
  setCachedData: (key: string, data: any, ttl: number) => Promise<void>
}