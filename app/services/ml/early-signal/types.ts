/**
 * Type Definitions for ML Early Signal Detection
 *
 * Task 1.4: Create Type Definitions
 * Estimated Time: 30 minutes
 * Purpose: TypeScript interfaces for ML data structures
 */

export interface FeatureVector {
  // Momentum features (3)
  price_change_5d: number
  price_change_10d: number
  price_change_20d: number

  // Volume features (2)
  volume_ratio: number
  volume_trend: number

  // Sentiment delta features (3)
  sentiment_news_delta: number
  sentiment_reddit_accel: number
  sentiment_options_shift: number

  // Social sentiment features (6)
  social_stocktwits_24h_change: number
  social_stocktwits_hourly_momentum: number
  social_stocktwits_7d_trend: number
  social_twitter_24h_change: number
  social_twitter_hourly_momentum: number
  social_twitter_7d_trend: number

  // Fundamental features (3)
  earnings_surprise: number
  revenue_growth_accel: number
  analyst_coverage_change: number

  // Technical features (2)
  rsi_momentum: number
  macd_histogram_trend: number
}

export interface TrainingExample {
  symbol: string
  date: Date
  features: FeatureVector
  label: number // 0 or 1 (no upgrade / upgrade)
}

export interface EarlySignalPrediction {
  upgrade_likely: boolean
  downgrade_likely: boolean
  confidence: number // 0.0-1.0
  horizon: '2_weeks'
  reasoning: string[]
  feature_importance: Record<string, number>
  prediction_timestamp: number
  model_version: string
}

export interface AnalystRatings {
  symbol: string
  date: Date
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  totalAnalysts: number
  consensus?: string
  sentimentScore?: number
}

/**
 * Historical OHLC price data
 */
export interface OHLC {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Sentiment data aggregated across sources
 */
export interface SentimentData {
  symbol: string
  date: Date
  newsScore: number
  redditScore: number
  optionsScore: number
  social_stocktwits_24h_change?: number
  social_stocktwits_hourly_momentum?: number
  social_stocktwits_7d_trend?: number
  social_twitter_24h_change?: number
  social_twitter_hourly_momentum?: number
  social_twitter_7d_trend?: number
  timestamp: number
}

/**
 * Fundamental data for feature extraction
 */
export interface FundamentalsData {
  symbol: string
  earningsSurprise: number | null
  revenueGrowthAccel: number | null
  analystCoverageChange: number | null
}

/**
 * Technical indicator data
 */
export interface TechnicalData {
  symbol: string
  rsiMomentum: number | null
  macdHistogramTrend: number | null
}
