/**
 * Technical Analysis Types
 * Comprehensive type definitions for technical indicators and pattern recognition
 */

/**
 * Core data structures for technical analysis
 */
export interface OHLCData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PriceData {
  timestamp: number
  price: number
  volume: number
}

/**
 * Individual indicator result interfaces
 */
export interface SMAResult {
  value: number
  period: number
  timestamp: number
}

export interface EMAResult {
  value: number
  period: number
  timestamp: number
}

export interface RSIResult {
  value: number
  period: number
  timestamp: number
  signal: 'oversold' | 'overbought' | 'neutral'
}

export interface MACDResult {
  macd: number
  signal: number
  histogram: number
  timestamp: number
  crossover: 'bullish' | 'bearish' | 'none'
}

export interface BollingerBandsResult {
  upper: number
  middle: number
  lower: number
  position: number // 0-1 where 0=lower band, 1=upper band
  width: number
  timestamp: number
}

export interface StochasticResult {
  k: number
  d: number
  signal: 'oversold' | 'overbought' | 'neutral'
  timestamp: number
}

export interface WilliamsRResult {
  value: number
  signal: 'oversold' | 'overbought' | 'neutral'
  timestamp: number
}

export interface ROCResult {
  value: number
  period: number
  timestamp: number
}

export interface OBVResult {
  value: number
  trend: 'rising' | 'falling' | 'neutral'
  timestamp: number
}

export interface VWAPResult {
  value: number
  position: 'above' | 'below' | 'at'
  timestamp: number
}

export interface ATRResult {
  value: number
  period: number
  timestamp: number
}

/**
 * Advanced indicator results
 */
export interface ADXResult {
  adx: number
  plusDI: number
  minusDI: number
  trend: 'strong' | 'weak' | 'no_trend'
  direction: 'up' | 'down' | 'neutral'
  timestamp: number
}

export interface AroonResult {
  up: number
  down: number
  oscillator: number
  trend: 'up' | 'down' | 'neutral'
  timestamp: number
}

export interface PSARResult {
  value: number
  signal: 'bullish' | 'bearish'
  reversal: boolean
  timestamp: number
}

/**
 * Pattern recognition interfaces
 */
export interface CandlestickPattern {
  type: CandlestickPatternType
  direction: 'bullish' | 'bearish'
  strength: number // 0-1 confidence score
  timestamp: number
  description: string
}

export enum CandlestickPatternType {
  DOJI = 'doji',
  HAMMER = 'hammer',
  INVERTED_HAMMER = 'inverted_hammer',
  HANGING_MAN = 'hanging_man',
  SHOOTING_STAR = 'shooting_star',
  SPINNING_TOP = 'spinning_top',
  MARUBOZU = 'marubozu',
  ENGULFING = 'engulfing',
  MORNING_STAR = 'morning_star',
  EVENING_STAR = 'evening_star',
  THREE_WHITE_SOLDIERS = 'three_white_soldiers',
  THREE_BLACK_CROWS = 'three_black_crows',
  INSIDE_BAR = 'inside_bar',
  OUTSIDE_BAR = 'outside_bar',
  HARAMI = 'harami'
}

export interface ChartPattern {
  type: ChartPatternType
  direction: 'bullish' | 'bearish'
  strength: number
  startIndex: number
  endIndex: number
  priceTarget?: number
  stopLoss?: number
  timestamp: number
  description: string
}

export enum ChartPatternType {
  HEAD_AND_SHOULDERS = 'head_and_shoulders',
  INVERSE_HEAD_AND_SHOULDERS = 'inverse_head_and_shoulders',
  DOUBLE_TOP = 'double_top',
  DOUBLE_BOTTOM = 'double_bottom',
  TRIPLE_TOP = 'triple_top',
  TRIPLE_BOTTOM = 'triple_bottom',
  ASCENDING_TRIANGLE = 'ascending_triangle',
  DESCENDING_TRIANGLE = 'descending_triangle',
  SYMMETRICAL_TRIANGLE = 'symmetrical_triangle',
  FLAG = 'flag',
  PENNANT = 'pennant',
  RECTANGLE = 'rectangle',
  RISING_WEDGE = 'rising_wedge',
  FALLING_WEDGE = 'falling_wedge'
}

/**
 * Comprehensive technical analysis result
 */
export interface TechnicalAnalysisResult {
  symbol: string
  timestamp: number

  // Trend analysis
  trend: {
    direction: 'bullish' | 'bearish' | 'neutral'
    strength: number
    confidence: number
    indicators: {
      sma: SMAResult[]
      ema: EMAResult[]
      macd: MACDResult
      bollinger: BollingerBandsResult
    }
  }

  // Momentum analysis
  momentum: {
    signal: 'buy' | 'sell' | 'hold'
    strength: number
    indicators: {
      rsi: RSIResult
      stochastic: StochasticResult
      williams: WilliamsRResult
      roc: ROCResult
    }
  }

  // Volume analysis
  volume: {
    trend: 'increasing' | 'decreasing' | 'stable'
    confirmation: boolean
    indicators: {
      obv: OBVResult
      vwap: VWAPResult
    }
  }

  // Volatility analysis
  volatility: {
    level: 'high' | 'medium' | 'low'
    indicators: {
      atr: ATRResult
      bollingerWidth: number
    }
  }

  // Pattern recognition
  patterns: {
    candlestick: CandlestickPattern[]
    chart: ChartPattern[]
    confidence: number
  }

  // Options analysis (new integration)
  options?: {
    signals: OptionsSignalsResult
    available: boolean
    confidence: number
  }

  // Overall technical score
  score: {
    total: number // 0-100 scale
    breakdown: {
      trend: number
      momentum: number
      volume: number
      patterns: number
      options?: number // New options component
    }
  }

  // Performance metadata
  metadata: {
    calculationTime: number
    dataQuality: number
    periodsCovered: number
    lastUpdate: number
  }
}

/**
 * Technical indicator configuration interfaces
 */
export interface IndicatorConfig {
  enabled: boolean
  periods?: number[]
  customParams?: { [key: string]: any }
}

export interface TechnicalAnalysisConfig {
  // Core indicators
  sma: IndicatorConfig & { periods: number[] }
  ema: IndicatorConfig & { periods: number[] }
  rsi: IndicatorConfig & { period: number; overbought: number; oversold: number }
  macd: IndicatorConfig & { fastPeriod: number; slowPeriod: number; signalPeriod: number }
  bollinger: IndicatorConfig & { period: number; standardDeviations: number }

  // Momentum indicators
  stochastic: IndicatorConfig & { kPeriod: number; dPeriod: number }
  williams: IndicatorConfig & { period: number }
  roc: IndicatorConfig & { period: number }

  // Volume indicators
  obv: IndicatorConfig
  vwap: IndicatorConfig

  // Volatility indicators
  atr: IndicatorConfig & { period: number }

  // Advanced indicators
  adx: IndicatorConfig & { period: number }
  aroon: IndicatorConfig & { period: number }
  psar: IndicatorConfig & { acceleration: number; maximum: number }

  // Pattern recognition
  patterns: {
    candlestick: IndicatorConfig
    chart: IndicatorConfig
    minConfidence: number
  }

  // Performance settings
  performance: {
    maxPeriods: number
    cacheTTL: number
    parallelCalculation: boolean
  }
}

/**
 * Technical analysis input data interface
 */
export interface TechnicalAnalysisInput {
  symbol: string
  ohlcData: OHLCData[]
  config?: Partial<TechnicalAnalysisConfig>
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
}

/**
 * Streaming technical analysis for real-time updates
 */
export interface StreamingTechnicalData {
  symbol: string
  indicators: {
    [indicatorName: string]: any
  }
  patterns: {
    candlestick: CandlestickPattern[]
    chart: ChartPattern[]
  }
  timestamp: number
}

/**
 * Technical analysis cache interface
 */
export interface TechnicalAnalysisCache {
  get(symbol: string, config: TechnicalAnalysisConfig): Promise<TechnicalAnalysisResult | null>
  set(symbol: string, result: TechnicalAnalysisResult, ttl: number): Promise<void>
  invalidate(symbol: string): Promise<void>
  clear(): Promise<void>
}

/**
 * Performance tracking for technical analysis
 */
export interface TechnicalAnalysisPerformance {
  symbol: string
  calculationTimes: {
    [indicatorName: string]: number
  }
  totalTime: number
  cacheHits: number
  cacheMisses: number
  dataQuality: number
  timestamp: number
}

/**
 * Export all types for external use
 */
export type TechnicalIndicatorResult =
  | SMAResult
  | EMAResult
  | RSIResult
  | MACDResult
  | BollingerBandsResult
  | StochasticResult
  | WilliamsRResult
  | ROCResult
  | OBVResult
  | VWAPResult
  | ATRResult
  | ADXResult
  | AroonResult
  | PSARResult

export type Pattern = CandlestickPattern | ChartPattern

/**
 * Options-specific technical indicators
 */
export interface OptionsSignalsResult {
  putCallSignal: number // 0-100 scale
  impliedVolatilitySignal: number // 0-100 scale
  flowSignal: number // 0-100 scale
  greeksSignal: number // 0-100 scale
  composite: number // Weighted composite
  confidence: number // Data quality confidence
  timestamp: number
}

export interface OptionsIVRegime {
  level: 'LOW' | 'MEDIUM' | 'HIGH'
  percentile: number
  signal: 'BUY_VOLATILITY' | 'SELL_VOLATILITY' | 'NEUTRAL'
  trend: 'EXPANDING' | 'CONTRACTING' | 'STABLE'
}

export interface OptionsPCRatioSignal {
  ratio: number
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  strength: 'WEAK' | 'MODERATE' | 'STRONG'
  extremeLevel: boolean
}

export interface OptionsFlowTechnicalSignal {
  momentum: number
  convexity: number
  termStructure: number
  divergence: boolean
  institutionalSignals: string[]
}