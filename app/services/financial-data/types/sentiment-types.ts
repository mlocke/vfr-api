/**
 * Sentiment Analysis Types
 * Types for connecting news sentiment and market sentiment with stock analysis
 */

export interface NewsSentimentData {
  symbol: string
  sentiment: number // -1 to 1 (negative to positive)
  confidence: number // 0-1 confidence in sentiment analysis
  articleCount: number // Number of articles analyzed
  sources: string[] // News sources included
  keyTopics: string[] // Main topics mentioned
  timeframe: string // Time period analyzed (e.g., "24h", "7d")
  lastUpdated: number
}

export interface SentimentIndicators {
  news: NewsSentimentData
  aggregatedScore: number // 0-1 composite sentiment score
  confidence: number // Overall confidence in sentiment data
  lastUpdated: number
}

export interface SentimentScore {
  overall: number // 0-1 composite sentiment score
  components: {
    news: number // News sentiment component (0-1)
  }
  confidence: number // 0-1 confidence in the score
  reasoning: string[]
  warnings: string[]
  opportunities: string[]
  timestamp: number
}

export interface StockSentimentImpact {
  symbol: string
  sentimentScore: SentimentScore
  adjustedScore: number // Original stock score adjusted for sentiment
  sentimentWeight: number // How much sentiment factors influenced the final score (0.10)
  insights: string[]
}

export interface SentimentAnalysisResponse {
  success: boolean
  data?: {
    indicators: SentimentIndicators
    stockImpact?: StockSentimentImpact
  }
  error?: string
  timestamp: number
  source: string
}

export interface BulkSentimentAnalysisResponse {
  success: boolean
  data?: {
    indicators: SentimentIndicators
    stockImpacts: StockSentimentImpact[]
  }
  error?: string
  executionTime: number
  timestamp: number
}

export interface SentimentConfig {
  updateFrequency: number // milliseconds
  dataSources: {
    primary: SentimentDataSource[]
    fallback: SentimentDataSource[]
  }
  weights: {
    news: number // Weight for news sentiment (1.0 for now, expandable)
  }
  thresholds: {
    confidenceThreshold: number
    sentimentVolatility: number
  }
  cache: {
    ttl: number
    maxAge: number
  }
}

export interface SentimentDataSource {
  source: 'newsapi' | 'alphavantage' | 'fmp' | 'composite'
  indicators: string[]
  lastUpdated: number
  quality: number // 0-1 data quality score
  latency: number // milliseconds
}

export interface SentimentCache {
  indicators: SentimentIndicators
  lastUpdated: number
  ttl: number // time to live in milliseconds
}

// News API specific types
export interface NewsAPIResponse {
  status: string
  totalResults: number
  articles: NewsArticle[]
}

export interface NewsArticle {
  source: {
    id: string | null
    name: string
  }
  author: string | null
  title: string
  description: string | null
  url: string
  urlToImage: string | null
  publishedAt: string
  content: string | null
}

export interface ProcessedNewsArticle {
  title: string
  description: string | null
  publishedAt: string
  source: string
  sentiment: number // -1 to 1
  confidence: number // 0-1
  relevanceScore: number // 0-1 how relevant to the stock
}

// Sentiment analysis configuration
export interface SentimentAnalysisConfig {
  newsAPI: {
    enabled: boolean
    apiKey: string
    timeout: number
    maxArticles: number
    languages: string[]
    sortBy: 'relevancy' | 'popularity' | 'publishedAt'
  }
  processing: {
    sentimentThreshold: number // Minimum confidence for sentiment
    relevanceThreshold: number // Minimum relevance for inclusion
    timeWindow: string // How far back to look for news (e.g., "1d", "7d")
  }
  fallback: {
    enabled: boolean
    sources: string[]
  }
}

// Error types for sentiment analysis
export enum SentimentErrorType {
  NEWS_API_ERROR = 'NEWS_API_ERROR',
  SENTIMENT_PROCESSING_ERROR = 'SENTIMENT_PROCESSING_ERROR',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  SENTIMENT_TIMEOUT = 'SENTIMENT_TIMEOUT'
}

export interface SentimentValidationResult {
  isValid: boolean
  confidence: number
  errors: string[]
  warnings: string[]
  dataQuality: number
}

// Real-time sentiment update types
export interface SentimentUpdate {
  symbol: string
  sentiment: SentimentScore
  timestamp: number
  source: string
}

export interface SentimentSubscription {
  symbols: string[]
  callback: (update: SentimentUpdate) => void
  options?: {
    minConfidence?: number
    includeReasons?: boolean
  }
}

// Sentiment trends and historical data
export interface SentimentTrend {
  symbol: string
  timeframe: string
  data: Array<{
    timestamp: number
    sentiment: number
    confidence: number
    volume: number // Number of news articles
  }>
}

export interface SentimentComparison {
  symbol: string
  currentSentiment: number
  previousSentiment: number
  change: number
  changePercent: number
  trend: 'improving' | 'declining' | 'stable'
}

// Health check and monitoring
export interface SentimentHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  details: {
    newsAPI: boolean
    cache: boolean
    processingLatency: number
    dataFreshness: number
    errorRate: number
  }
  timestamp: number
}

// Performance metrics
export interface SentimentPerformanceMetrics {
  averageLatency: number
  cacheHitRate: number
  apiSuccessRate: number
  sentimentAccuracy: number
  dataFreshness: number
  timestamp: number
}