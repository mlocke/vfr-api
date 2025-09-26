/**
 * TypeScript types for high-performance options analysis
 * Optimized for memory efficiency and fast processing
 */

export interface OptionsContract {
  symbol: string
  strike: number
  expiration: string
  type: 'call' | 'put'

  // Pricing data
  volume: number
  openInterest: number
  bid?: number
  ask?: number
  lastPrice?: number

  // Greeks data
  impliedVolatility?: number
  delta?: number
  gamma?: number
  theta?: number
  vega?: number
  rho?: number

  // Metadata
  timestamp: number
  source: string
}

export interface OptionsChain {
  symbol: string
  calls: OptionsContract[]
  puts: OptionsContract[]
  expirationDates: string[]
  strikes: number[]
  timestamp: number
  source: string

  // Compression metadata
  compressed?: boolean
  originalContractCount?: number
}

export interface PutCallRatio {
  symbol: string
  volumeRatio: number
  openInterestRatio: number
  totalPutVolume: number
  totalCallVolume: number
  totalPutOpenInterest: number
  totalCallOpenInterest: number
  liquidContractsOnly?: boolean
  timestamp: number
}

export interface VolatilityAnalysis {
  symbol: string
  averageImpliedVolatility: number
  impliedVolatilityRange: {
    min: number
    max: number
  }
  volatilitySkew: number
  impliedVolatilityPercentile: number
  contractsAnalyzed: number
  timestamp: number
}

export interface UnusualActivity {
  symbol: string
  volumeRatio: number
  maxSingleContractVolume: number
  largeTransactions: number
  totalLargeTransactionVolume: number
  institutionalSignals: string[]
  averageVolume: number
  contractsAnalyzed: number
  timestamp: number
}

export interface OptionsFlowSignals {
  symbol: string
  momentum: number          // 0-100 scale
  convexity: number         // 0-100 scale
  termStructure: number     // 0-100 scale
  composite: number         // Weighted combination
  timestamp: number
}

export interface PerformanceMetrics {
  operation: string
  duration: number          // Milliseconds
  memoryUsage: number       // Bytes
  cacheHit: boolean
  contractsProcessed: number
  timestamp: number
}

export interface OptionsAnalysisMetrics {
  symbol: string
  putCallRatio: PutCallRatio
  volatilityAnalysis: VolatilityAnalysis
  unusualActivity: UnusualActivity
  flowSignals: OptionsFlowSignals
  confidence: number        // 0-100 scale
  performance: PerformanceMetrics
  timestamp: number
  source: string
}

export interface EODHDOptionsData {
  symbol: string
  contractSymbol: string
  strike: number
  expiration: string
  contractType: 'call' | 'put'

  // Pricing data
  bid: number
  ask: number
  lastPrice: number
  volume: number
  openInterest: number

  // Volatility & Greeks
  impliedVolatility: number
  greeks: {
    delta: number
    gamma: number
    theta: number
    vega: number
    rho: number
  }

  // Metadata
  timestamp: number
  daysToExpiration: number
  moneyness: number
}

export interface OptionsSignals {
  flowSignal: number
  volatilitySignal: number
  skewSignal: number
  putCallSignal: number
  composite: number
}

export interface OptionsSentiment {
  symbol: string
  putCallSignal: number
  activitySignal: number
  composite: number
  confidence: number
  timestamp: number
  source: string
}

export interface OptionsHealthReport {
  eodhd: {
    healthy: boolean
    latency: number
    errorRate: number
  }
  polygon: {
    healthy: boolean
    latency: number
    errorRate: number
  }
  yahoo: {
    healthy: boolean
    latency: number
    errorRate: number
  }
  cache: {
    healthy: boolean
    hitRate: number
  }
  overall: {
    healthy: boolean
    confidence: number
  }
}

export interface HealthTestResult {
  success: boolean
  latency: number
  dataQuality?: number
  error?: string
}