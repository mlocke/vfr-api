/**
 * Sentiment Analysis Service
 * Connects news sentiment analysis with stock analysis engine
 * Provides 10% weight in composite scoring as per roadmap
 */

import NewsAPI from './providers/NewsAPI'
import RedditAPI from './providers/RedditAPI'
import { RedisCache } from '../cache/RedisCache'
import { SecurityValidator } from '../security/SecurityValidator'
import {
  SentimentIndicators,
  SentimentScore,
  StockSentimentImpact,
  SentimentAnalysisResponse,
  BulkSentimentAnalysisResponse,
  SentimentConfig,
  SentimentCache,
  NewsSentimentData,
  RedditSentimentData
} from './types/sentiment-types'

export class SentimentAnalysisService {
  private newsAPI: NewsAPI
  private redditAPI: RedditAPI | null
  private cache: RedisCache
  private config: SentimentConfig
  private securityValidator: SecurityValidator

  constructor(
    newsAPI: NewsAPI,
    cache: RedisCache,
    redditAPI?: RedditAPI
  ) {
    this.newsAPI = newsAPI
    this.redditAPI = redditAPI || null
    this.cache = cache
    this.config = this.createDefaultConfig()
    this.securityValidator = new SecurityValidator()

    // Initialize Reddit API if credentials are available
    if (!this.redditAPI && process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
      try {
        this.redditAPI = new RedditAPI()
        console.log('Reddit API initialized for WSB sentiment analysis')
      } catch (error) {
        console.warn('Failed to initialize Reddit API:', error)
      }
    }
  }

  /**
   * Main method: Analyze sentiment impact for a single stock
   */
  async analyzeStockSentimentImpact(symbol: string, sector: string, baseScore: number): Promise<StockSentimentImpact | null> {
    try {
      // Validate symbol first to prevent injection attacks
      const validation = this.securityValidator.validateSymbol(symbol)
      if (!validation.isValid) {
        console.warn(`Invalid symbol rejected: ${validation.errors.join(', ')}`)
        return null
      }

      // Use sanitized symbol
      const sanitizedSymbol = validation.sanitized || symbol
      console.log(`📰 Analyzing sentiment impact for ${sanitizedSymbol} (${sector})`)

      // Get current sentiment indicators
      const indicators = await this.getSentimentIndicators(sanitizedSymbol)
      if (!indicators) {
        console.warn('Unable to get sentiment indicators')
        return null
      }

      // Generate sentiment score
      const sentimentScore = this.calculateSentimentScore(indicators)

      // Calculate adjusted score with 10% sentiment weight
      const sentimentWeight = 0.10 // 10% as per roadmap
      const adjustedScore = this.calculateAdjustedScore(baseScore, sentimentScore.overall, sentimentWeight)

      // Generate insights
      const insights = this.generateSentimentInsights(sentimentScore, indicators)

      return {
        symbol,
        sentimentScore,
        adjustedScore,
        sentimentWeight,
        insights
      }

    } catch (error) {
      console.error(`Sentiment analysis failed for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Bulk analysis for multiple stocks
   */
  async analyzeBulkSentimentImpact(stocks: Array<{symbol: string, sector: string, baseScore: number}>): Promise<BulkSentimentAnalysisResponse> {
    const startTime = Date.now()

    try {
      console.log(`📰 Bulk sentiment analysis for ${stocks.length} stocks`)

      const stockImpacts: StockSentimentImpact[] = []

      // Process each stock individually
      for (const stock of stocks) {
        try {
          const sentimentImpact = await this.analyzeStockSentimentImpact(
            stock.symbol,
            stock.sector,
            stock.baseScore
          )

          if (sentimentImpact) {
            stockImpacts.push(sentimentImpact)
          }

        } catch (error) {
          console.warn(`Failed sentiment analysis for ${stock.symbol}:`, error)
          // Continue with other stocks
        }
      }

      // Get general sentiment indicators for metadata
      const generalIndicators = stockImpacts.length > 0
        ? await this.getSentimentIndicators(stocks[0].symbol)
        : null

      return {
        success: true,
        data: {
          indicators: generalIndicators || this.getEmptySentimentIndicators(),
          stockImpacts
        },
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      }

    } catch (error) {
      console.error('Bulk sentiment analysis failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Get comprehensive sentiment indicators for a stock
   */
  async getSentimentIndicators(symbol: string): Promise<SentimentIndicators | null> {
    try {
      // Validate symbol first to prevent injection attacks
      const validation = this.securityValidator.validateSymbol(symbol)
      if (!validation.isValid) {
        console.warn(`Invalid symbol rejected: ${validation.errors.join(', ')}`)
        return null
      }

      // Use sanitized symbol
      const sanitizedSymbol = validation.sanitized || symbol

      // Check cache first
      const cacheKey = `sentiment:indicators:${sanitizedSymbol}`
      const cached = await this.getCachedData(cacheKey)
      if (cached) {
        return cached
      }

      console.log('📊 Fetching fresh sentiment indicators...')

      // Fetch news sentiment
      const newsData = await this.getNewsSentiment(sanitizedSymbol)

      // Fetch Reddit sentiment if available
      let redditData: RedditSentimentData | undefined
      if (this.redditAPI) {
        try {
          console.log('📱 Fetching WSB sentiment from Reddit...')
          const redditResponse = await this.redditAPI.getWSBSentiment(sanitizedSymbol)

          // Check for validation errors (security failures)
          if (!redditResponse.success && redditResponse.error?.includes('Invalid symbol')) {
            // Symbol validation failed - likely injection attempt
            console.warn('Symbol validation failed - potential security issue')
            return null
          }

          if (redditResponse.success && redditResponse.data) {
            redditData = redditResponse.data
            console.log(`✅ Reddit sentiment: ${redditData.sentiment.toFixed(2)} (${redditData.postCount} posts)`)

            // Filter out Reddit data with zero confidence (no posts found)
            if (redditData.confidence === 0) {
              console.log('📊 Reddit data has zero confidence, excluding from analysis')
              redditData = undefined
            }
          }
        } catch (error) {
          console.warn('Reddit sentiment fetch failed:', error)
        }
      }

      // Check if we have any meaningful sentiment data
      if (!newsData && !redditData) {
        console.warn('No meaningful sentiment data available from any source')
        return null
      }

      // Calculate aggregated score with dynamic weighting
      const newsWeight = this.config.weights.news
      const redditWeight = this.config.weights.reddit

      let aggregatedScore = 0
      let totalWeight = 0
      let baseConfidence = 0

      // Add news sentiment if available
      if (newsData) {
        aggregatedScore += this.normalizeToZeroOne(newsData.sentiment) * newsWeight
        totalWeight += newsWeight
        baseConfidence = newsData.confidence
      }

      // Add Reddit sentiment if available
      if (redditData) {
        aggregatedScore += redditData.sentiment * redditWeight
        totalWeight += redditWeight

        // If no news data, use Reddit confidence as base
        if (!newsData) {
          baseConfidence = redditData.confidence
        }
      }

      // Normalize by total weight
      aggregatedScore = totalWeight > 0 ? aggregatedScore / totalWeight : 0.5

      // Calculate confidence (higher with multiple sources)
      const multiSourceBonus = (newsData && redditData) ? 0.1 : 0 // 10% bonus for having both sources
      const confidence = Math.min(baseConfidence + multiSourceBonus, 1.0)

      // Create fallback news data if needed (for Reddit-only sentiment)
      const finalNewsData = newsData || {
        symbol,
        sentiment: 0, // Neutral sentiment when no news available
        confidence: 0.1,
        articleCount: 0,
        sources: [],
        keyTopics: [],
        timeframe: '1d',
        lastUpdated: Date.now()
      }

      const indicators: SentimentIndicators = {
        news: finalNewsData,
        reddit: redditData,
        aggregatedScore,
        confidence,
        lastUpdated: Date.now()
      }

      // Cache for 15 minutes (same as macro service)
      await this.setCachedData(cacheKey, indicators, 15 * 60 * 1000)

      return indicators

    } catch (error) {
      console.error('Failed to get sentiment indicators:', error)
      return null
    }
  }

  /**
   * Get news sentiment for a stock symbol
   */
  private async getNewsSentiment(symbol: string): Promise<NewsSentimentData | null> {
    try {
      return await this.newsAPI.getNewsSentiment(symbol, '1d')
    } catch (error) {
      console.error(`Failed to get news sentiment for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate comprehensive sentiment score
   */
  private calculateSentimentScore(indicators: SentimentIndicators): SentimentScore {
    const reasoning: string[] = []
    const warnings: string[] = []
    const opportunities: string[] = []

    // Calculate weighted sentiment from multiple sources
    const newsScore = this.normalizeToZeroOne(indicators.news.sentiment)
    let redditScore = 0

    if (indicators.reddit) {
      redditScore = indicators.reddit.sentiment
      reasoning.push(`Reddit WSB sentiment: ${(redditScore * 100).toFixed(0)}% (${indicators.reddit.postCount} posts)`)

      if (redditScore > 0.7) {
        opportunities.push('Strong retail investor sentiment on WSB may drive momentum')
      } else if (redditScore < 0.3) {
        warnings.push('Negative retail sentiment on WSB could create selling pressure')
      }
    }

    // Use aggregated score calculated in getSentimentIndicators
    const overall = indicators.aggregatedScore

    // Generate reasoning based on sentiment
    if (newsScore > 0.7) {
      reasoning.push('Strong positive news sentiment supports bullish outlook')
      opportunities.push('Positive media coverage may attract investor interest')
    } else if (newsScore > 0.6) {
      reasoning.push('Moderately positive news sentiment')
    } else if (newsScore < 0.3) {
      reasoning.push('Negative news sentiment creates headwinds')
      warnings.push('Negative media coverage may pressure stock price')
    } else if (newsScore < 0.4) {
      reasoning.push('Moderately negative news sentiment')
      warnings.push('Mixed news sentiment suggests uncertainty')
    } else {
      reasoning.push('Neutral news sentiment')
    }

    // Confidence-based insights
    if (indicators.news.confidence < 0.5) {
      warnings.push('Low confidence in sentiment analysis due to limited news coverage')
    } else if (indicators.news.confidence > 0.8) {
      reasoning.push('High confidence sentiment analysis based on substantial news coverage')
    }

    // Article volume insights
    if (indicators.news.articleCount > 50) {
      reasoning.push('High news volume indicates significant market attention')
    } else if (indicators.news.articleCount < 5) {
      warnings.push('Limited news coverage may indicate low market interest')
    }

    return {
      overall: Math.max(0, Math.min(1, overall)),
      components: {
        news: newsScore,
        reddit: indicators.reddit ? redditScore : undefined
      },
      confidence: indicators.confidence,
      reasoning,
      warnings,
      opportunities,
      timestamp: Date.now()
    }
  }

  /**
   * Calculate adjusted stock score with sentiment factors
   */
  private calculateAdjustedScore(baseScore: number, sentimentScore: number, sentimentWeight: number): number {
    // Weighted average: baseScore * (1 - sentimentWeight) + sentimentScore * sentimentWeight
    const adjustedScore = baseScore * (1 - sentimentWeight) + sentimentScore * sentimentWeight
    return Math.max(0, Math.min(1, adjustedScore))
  }

  /**
   * Generate sentiment insights for stock analysis
   */
  private generateSentimentInsights(sentimentScore: SentimentScore, indicators: SentimentIndicators): string[] {
    const insights: string[] = []

    // Overall sentiment insights
    const sentimentLevel = this.getSentimentLevel(sentimentScore.overall)
    insights.push(`News sentiment: ${sentimentLevel} (${(sentimentScore.overall * 100).toFixed(0)}/100)`)

    // Confidence insights
    const confidenceLevel = sentimentScore.confidence > 0.8 ? 'high' :
                           sentimentScore.confidence > 0.5 ? 'moderate' : 'low'
    insights.push(`Sentiment confidence: ${confidenceLevel} (${(sentimentScore.confidence * 100).toFixed(0)}%)`)

    // News volume insights
    const articleCount = indicators.news.articleCount
    if (articleCount > 50) {
      insights.push(`High news volume (${articleCount} articles) indicates strong market attention`)
    } else if (articleCount > 20) {
      insights.push(`Moderate news coverage (${articleCount} articles)`)
    } else if (articleCount > 0) {
      insights.push(`Limited news coverage (${articleCount} articles)`)
    }

    // Source diversity insights
    const sourceCount = indicators.news.sources.length
    if (sourceCount > 10) {
      insights.push(`Sentiment from diverse news sources (${sourceCount} outlets)`)
    } else if (sourceCount > 5) {
      insights.push(`Sentiment from multiple news sources (${sourceCount} outlets)`)
    }

    // Key topics insights
    if (indicators.news.keyTopics.length > 0) {
      const topTopics = indicators.news.keyTopics.slice(0, 3).join(', ')
      insights.push(`Key topics: ${topTopics}`)
    }

    return insights
  }

  /**
   * Get sentiment level description
   */
  private getSentimentLevel(score: number): string {
    if (score >= 0.8) return 'very positive'
    if (score >= 0.6) return 'positive'
    if (score >= 0.4) return 'neutral'
    if (score >= 0.2) return 'negative'
    return 'very negative'
  }

  /**
   * Normalize sentiment from -1,1 scale to 0,1 scale
   */
  private normalizeToZeroOne(sentiment: number): number {
    return (sentiment + 1) / 2
  }

  /**
   * Get empty sentiment indicators for fallback
   */
  private getEmptySentimentIndicators(): SentimentIndicators {
    return {
      news: {
        symbol: 'UNKNOWN',
        sentiment: 0,
        confidence: 0,
        articleCount: 0,
        sources: [],
        keyTopics: [],
        timeframe: '1d',
        lastUpdated: Date.now()
      },
      aggregatedScore: 0.5,
      confidence: 0,
      lastUpdated: Date.now()
    }
  }

  /**
   * Cache management
   */
  private async getCachedData(key: string): Promise<any> {
    try {
      return await this.cache.get(key)
    } catch (error) {
      console.warn('Cache get failed:', error)
      return null
    }
  }

  private async setCachedData(key: string, data: any, ttl: number): Promise<void> {
    try {
      await this.cache.set(key, data, ttl)
    } catch (error) {
      console.warn('Cache set failed:', error)
    }
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(): SentimentConfig {
    return {
      updateFrequency: 15 * 60 * 1000, // 15 minutes
      dataSources: {
        primary: [{
          source: 'newsapi',
          indicators: ['news_sentiment'],
          lastUpdated: Date.now(),
          quality: 0.8,
          latency: 1000
        }],
        fallback: []
      },
      weights: {
        news: 0.7, // 70% weight for news sentiment
        reddit: 0.3 // 30% weight for Reddit WSB sentiment
      },
      thresholds: {
        confidenceThreshold: 0.3,
        sentimentVolatility: 0.5
      },
      cache: {
        ttl: 15 * 60 * 1000, // 15 minutes
        maxAge: 60 * 60 * 1000 // 1 hour
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const newsAPIHealth = await this.newsAPI.healthCheck()
      const cacheHealth = await this.cache.ping() === 'PONG'

      const healthy = newsAPIHealth && cacheHealth

      return {
        status: healthy ? 'healthy' : 'unhealthy',
        details: {
          newsAPI: newsAPIHealth,
          cache: cacheHealth
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }
}

export default SentimentAnalysisService