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
  reddit?: RedditSentimentData // Optional Reddit sentiment
  options?: OptionsSentimentData // Optional options sentiment
  aggregatedScore: number // 0-1 composite sentiment score
  confidence: number // Overall confidence in sentiment data
  lastUpdated: number
}

export interface SentimentScore {
  overall: number // 0-1 composite sentiment score
  components: {
    news: number // News sentiment component (0-1)
    reddit?: number // Reddit sentiment component (0-1, optional)
    options?: number // Options sentiment component (0-1, optional)
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
    news: number // Weight for news sentiment
    reddit: number // Weight for Reddit sentiment
    options: number // Weight for options sentiment
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
  source: 'yahoo_finance' | 'reddit' | 'alphavantage' | 'fmp' | 'composite'
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

// Yahoo Finance news-specific types (no API key required)

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
  yahooFinance: {
    enabled: boolean
    timeout: number
    maxArticles: number
    batchSize: number
    cacheTTL: number
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
    yahooFinanceSentiment: boolean
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

// Reddit API specific types
export interface RedditPost {
  id: string
  title: string
  selftext: string
  score: number
  upvote_ratio: number
  num_comments: number
  created_utc: number
  author: string
  url: string
  permalink: string
  flair_text: string | null
}

export interface RedditComment {
  id: string
  body: string
  score: number
  created_utc: number
  author: string
  permalink: string
}

export interface RedditSentimentData {
  symbol: string
  sentiment: number // 0-1 (negative to positive)
  confidence: number // 0-1 confidence in sentiment analysis
  postCount: number // Number of posts analyzed
  avgScore: number // Average Reddit score
  avgUpvoteRatio: number // Average upvote ratio
  totalComments: number // Total comments across posts
  timeframe: string // Time period analyzed (e.g., "24h", "7d")
  lastUpdated: number
  topPosts: Array<{
    title: string
    score: number
    comments: number
    url: string
  }>
}

export interface OptionsSentimentData {
  symbol: string
  sentiment: number // 0-1 (negative to positive)
  confidence: number // 0-1 confidence in sentiment analysis
  putCallRatio: number // Volume-based P/C ratio
  openInterestRatio: number // OI-based P/C ratio
  sentimentSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' // Interpreted signal
  signalStrength: 'WEAK' | 'MODERATE' | 'STRONG' // Signal confidence
  unusualActivity: boolean // Indicates unusual options activity
  institutionalFlow: 'INFLOW' | 'OUTFLOW' | 'NEUTRAL' // Large volume patterns
  volumeAnalysis: {
    totalVolume: number
    callVolume: number
    putVolume: number
    largeTransactions: number
  }
  timeframe: string // Time period analyzed
  lastUpdated: number
  insights: string[] // Specific options insights
}

export interface RedditAPIResponse {
  data: {
    children: Array<{
      data: RedditPost
    }>
  }
}

// Enhanced Reddit API Types for Multi-Subreddit Analysis
export interface SubredditConfig {
  name: string
  weight: number // 0-1, higher weight = more influence on final score
  analysisQuality: 'high' | 'medium' | 'low' // Quality of financial analysis
  postLimit: number // Number of posts to fetch per search
  enabled: boolean
}

export interface MultiSubredditSentimentData extends RedditSentimentData {
  subredditBreakdown: Array<{
    subreddit: string
    sentiment: number
    confidence: number
    postCount: number
    weight: number
    contributionScore: number // weighted contribution to final score
  }>
  weightedSentiment: number // Final weighted sentiment across all subreddits
  totalWeight: number // Sum of all active subreddit weights
  diversityScore: number // 0-1, how diverse sentiment is across subreddits
}

export interface SubredditAnalysisResult {
  subreddit: string
  success: boolean
  data?: RedditSentimentData
  error?: string
  responseTime: number
  weight: number
}

export interface EnhancedRedditConfig {
  subreddits: SubredditConfig[]
  parallelProcessing: {
    maxConcurrency: number
    timeoutPerRequest: number // milliseconds
    retryAttempts: number
  }
  rateLimiting: {
    requestsPerMinute: number
    burstLimit: number
    cooldownPeriod: number // milliseconds
  }
  analysis: {
    minimumPostsThreshold: number
    confidenceThreshold: number
    diversityWeighting: boolean
  }
  fallback: {
    enableSingleSubredditFallback: boolean
    fallbackSubreddit: string
  }
}