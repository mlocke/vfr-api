/**
 * Sentiment Analysis Service
 * Connects news sentiment analysis with stock analysis engine
 * Provides 10% weight in composite scoring as per roadmap
 */

import NewsAPI from './providers/NewsAPI'
import { RedisCache } from '../cache/RedisCache'
import {
  SentimentIndicators,
  SentimentScore,
  StockSentimentImpact,
  SentimentAnalysisResponse,
  BulkSentimentAnalysisResponse,
  SentimentConfig,
  SentimentCache,
  NewsSentimentData
} from './types/sentiment-types'

export class SentimentAnalysisService {
  private newsAPI: NewsAPI
  private cache: RedisCache
  private config: SentimentConfig

  constructor(
    newsAPI: NewsAPI,
    cache: RedisCache
  ) {
    this.newsAPI = newsAPI
    this.cache = cache
    this.config = this.createDefaultConfig()
  }

  /**
   * Main method: Analyze sentiment impact for a single stock
   */
  async analyzeStockSentimentImpact(symbol: string, sector: string, baseScore: number): Promise<StockSentimentImpact | null> {
    try {
      console.log(`📰 Analyzing sentiment impact for ${symbol} (${sector})`)

      // Get current sentiment indicators
      const indicators = await this.getSentimentIndicators(symbol)
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
      // Check cache first
      const cacheKey = `sentiment:indicators:${symbol}`
      const cached = await this.getCachedData(cacheKey)
      if (cached) {
        return cached
      }

      console.log('📊 Fetching fresh sentiment indicators...')

      // Fetch news sentiment
      const newsData = await this.getNewsSentiment(symbol)

      if (!newsData) {
        console.warn('No sentiment data available')
        return null
      }

      const indicators: SentimentIndicators = {
        news: newsData,
        aggregatedScore: this.normalizeToZeroOne(newsData.sentiment),
        confidence: newsData.confidence,
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

    // For now, sentiment is based only on news (can expand later)
    const newsScore = this.normalizeToZeroOne(indicators.news.sentiment)
    const overall = newsScore

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
        news: newsScore
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
        news: 1.0 // 100% news for now, expandable to other sources
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