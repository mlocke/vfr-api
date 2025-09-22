/**
 * NewsAPI Provider for Financial News Sentiment Analysis
 * Integrates with NewsAPI.org for real-time financial news sentiment
 */

import { FinancialDataProvider, ApiResponse } from '../types.js'
import {
  NewsAPIResponse,
  NewsArticle,
  ProcessedNewsArticle,
  NewsSentimentData,
  SentimentAnalysisConfig,
  SentimentErrorType
} from '../types/sentiment-types'

export class NewsAPI implements FinancialDataProvider {
  name = 'NewsAPI'
  private baseUrl = 'https://newsapi.org/v2/'
  private apiKey: string
  private timeout: number
  private throwErrors: boolean
  private config: SentimentAnalysisConfig['newsAPI']

  constructor(apiKey?: string, timeout = 15000, throwErrors = false) {
    this.apiKey = apiKey !== undefined ? apiKey : (process.env.NEWSAPI_KEY || '')
    this.timeout = timeout
    this.throwErrors = throwErrors

    this.config = {
      enabled: true,
      apiKey: this.apiKey,
      timeout: this.timeout,
      maxArticles: 100,
      languages: ['en'],
      sortBy: 'relevancy'
    }

    if (this.apiKey && !this.isValidApiKeyFormat(this.apiKey)) {
      console.warn('NewsAPI key format appears invalid. Key should be a 32-character alphanumeric string.')
      if (this.throwErrors) {
        throw new Error('NewsAPI key format is invalid.')
      }
    }
  }

  /**
   * Validate NewsAPI key format
   */
  private isValidApiKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false
    return /^[a-f0-9]{32}$/i.test(apiKey)
  }

  /**
   * Get financial news sentiment for a stock symbol
   */
  async getNewsSentiment(symbol: string, timeframe = '1d'): Promise<NewsSentimentData | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('NewsAPI key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      if (!this.isValidApiKeyFormat(this.apiKey)) {
        const error = new Error('NewsAPI key format is invalid')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      console.log(`📰 Fetching news sentiment for ${symbol}...`)

      // Calculate date range based on timeframe
      const dateRange = this.calculateDateRange(timeframe)

      // Fetch news articles
      const articles = await this.fetchNewsArticles(symbol, dateRange)
      if (!articles || articles.length === 0) {
        console.warn(`No news articles found for ${symbol}`)
        return null
      }

      console.log(`📊 Analyzing sentiment for ${articles.length} articles about ${symbol}`)

      // Process articles for sentiment
      const processedArticles = await this.processArticlesForSentiment(articles, symbol)

      if (processedArticles.length === 0) {
        console.warn(`No relevant articles found for sentiment analysis of ${symbol}`)
        return null
      }

      // Calculate sentiment score
      const sentimentData = this.calculateSentimentScore(processedArticles, symbol, timeframe)

      console.log(`✅ News sentiment calculated for ${symbol}: ${sentimentData.sentiment.toFixed(3)} (confidence: ${sentimentData.confidence.toFixed(3)})`)

      return sentimentData

    } catch (error) {
      console.error(`NewsAPI error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Calculate date range for news query
   */
  private calculateDateRange(timeframe: string): { from: string; to: string } {
    const now = new Date()
    const from = new Date(now)

    switch (timeframe) {
      case '1d':
        from.setDate(now.getDate() - 1)
        break
      case '7d':
        from.setDate(now.getDate() - 7)
        break
      case '30d':
        from.setDate(now.getDate() - 30)
        break
      default:
        from.setDate(now.getDate() - 1) // Default to 1 day
    }

    return {
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    }
  }

  /**
   * Fetch news articles from NewsAPI
   */
  private async fetchNewsArticles(symbol: string, dateRange: { from: string; to: string }): Promise<NewsArticle[]> {
    const query = this.buildNewsQuery(symbol)

    const response = await this.makeRequest('everything', {
      q: query,
      from: dateRange.from,
      to: dateRange.to,
      language: 'en',
      sortBy: this.config.sortBy,
      pageSize: this.config.maxArticles.toString()
    })

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch news articles')
    }

    const newsResponse = response.data as NewsAPIResponse
    return newsResponse.articles || []
  }

  /**
   * Build optimized search query for financial news
   */
  private buildNewsQuery(symbol: string): string {
    // Enhanced query to capture financial news about the stock
    const queries = [
      `"${symbol}"`,
      `"${symbol} stock"`,
      `"${symbol} earnings"`,
      `"${symbol} price"`,
      `"${symbol} market"`
    ]

    // Add common financial terms
    const financialTerms = [
      'earnings', 'revenue', 'profit', 'loss', 'guidance',
      'analyst', 'upgrade', 'downgrade', 'target price',
      'buy', 'sell', 'hold', 'recommendation'
    ]

    return `(${queries.join(' OR ')}) AND (${financialTerms.join(' OR ')})`
  }

  /**
   * Process articles for sentiment analysis
   */
  private async processArticlesForSentiment(articles: NewsArticle[], symbol: string): Promise<ProcessedNewsArticle[]> {
    const processed: ProcessedNewsArticle[] = []

    for (const article of articles) {
      if (!article.title || !article.description) continue

      const relevanceScore = this.calculateRelevanceScore(article, symbol)

      // Only include articles with sufficient relevance
      if (relevanceScore < 0.3) continue

      const sentiment = this.analyzeSentiment(article.title, article.description)

      processed.push({
        title: article.title,
        description: article.description,
        publishedAt: article.publishedAt,
        source: article.source.name,
        sentiment: sentiment.sentiment,
        confidence: sentiment.confidence,
        relevanceScore
      })
    }

    return processed
  }

  /**
   * Calculate relevance score for an article
   */
  private calculateRelevanceScore(article: NewsArticle, symbol: string): number {
    let score = 0
    const title = article.title?.toLowerCase() || ''
    const description = article.description?.toLowerCase() || ''
    const symbolLower = symbol.toLowerCase()

    // Direct symbol mentions
    if (title.includes(symbolLower)) score += 0.4
    if (description.includes(symbolLower)) score += 0.3

    // Financial keywords
    const financialKeywords = [
      'earnings', 'revenue', 'profit', 'loss', 'stock', 'shares',
      'analyst', 'upgrade', 'downgrade', 'target', 'price',
      'buy', 'sell', 'hold', 'recommendation', 'guidance'
    ]

    financialKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 0.1
      if (description.includes(keyword)) score += 0.05
    })

    return Math.min(score, 1.0) // Cap at 1.0
  }

  /**
   * Analyze sentiment of article text
   * Simplified sentiment analysis - in production, would use ML model
   */
  private analyzeSentiment(title: string, description: string): { sentiment: number; confidence: number } {
    const text = `${title} ${description}`.toLowerCase()

    // Positive indicators
    const positiveWords = [
      'beat', 'beats', 'exceeds', 'strong', 'growth', 'positive', 'bullish',
      'upgrade', 'buy', 'overweight', 'outperform', 'raised', 'increase',
      'profit', 'revenue', 'earnings', 'gains', 'up', 'higher', 'record'
    ]

    // Negative indicators
    const negativeWords = [
      'miss', 'misses', 'weak', 'decline', 'negative', 'bearish',
      'downgrade', 'sell', 'underweight', 'underperform', 'lowered', 'cut',
      'loss', 'losses', 'down', 'lower', 'poor', 'disappointing'
    ]

    let positiveScore = 0
    let negativeScore = 0

    positiveWords.forEach(word => {
      const matches = (text.match(new RegExp(word, 'g')) || []).length
      positiveScore += matches
    })

    negativeWords.forEach(word => {
      const matches = (text.match(new RegExp(word, 'g')) || []).length
      negativeScore += matches
    })

    const totalWords = positiveScore + negativeScore
    if (totalWords === 0) {
      return { sentiment: 0, confidence: 0.1 } // Neutral with low confidence
    }

    // Calculate sentiment (-1 to 1)
    const sentiment = (positiveScore - negativeScore) / Math.max(totalWords, 1)

    // Calculate confidence (0 to 1)
    const confidence = Math.min(totalWords / 10, 0.9) // More words = higher confidence, cap at 0.9

    return {
      sentiment: Math.max(-1, Math.min(1, sentiment)),
      confidence: Math.max(0.1, confidence)
    }
  }

  /**
   * Calculate overall sentiment score from processed articles
   */
  private calculateSentimentScore(articles: ProcessedNewsArticle[], symbol: string, timeframe: string): NewsSentimentData {
    if (articles.length === 0) {
      return {
        symbol,
        sentiment: 0,
        confidence: 0,
        articleCount: 0,
        sources: [],
        keyTopics: [],
        timeframe,
        lastUpdated: Date.now()
      }
    }

    // Weight articles by relevance and confidence
    let weightedSentiment = 0
    let totalWeight = 0
    const sources = new Set<string>()
    const topics = new Set<string>()

    articles.forEach(article => {
      const weight = article.relevanceScore * article.confidence
      weightedSentiment += article.sentiment * weight
      totalWeight += weight
      sources.add(article.source)

      // Extract key topics (simplified)
      if (article.title) {
        const words = article.title.toLowerCase().split(' ')
        words.forEach(word => {
          if (word.length > 4 && !['stock', 'shares', 'company'].includes(word)) {
            topics.add(word)
          }
        })
      }
    })

    const averageSentiment = totalWeight > 0 ? weightedSentiment / totalWeight : 0
    const averageConfidence = articles.reduce((sum, a) => sum + a.confidence, 0) / articles.length

    return {
      symbol,
      sentiment: Math.max(-1, Math.min(1, averageSentiment)),
      confidence: Math.max(0, Math.min(1, averageConfidence)),
      articleCount: articles.length,
      sources: Array.from(sources).slice(0, 10), // Limit to top 10 sources
      keyTopics: Array.from(topics).slice(0, 10), // Limit to top 10 topics
      timeframe,
      lastUpdated: Date.now()
    }
  }

  /**
   * Health check for NewsAPI
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        console.warn('NewsAPI key not configured')
        return false
      }

      if (!this.isValidApiKeyFormat(this.apiKey)) {
        console.warn('NewsAPI key format is invalid')
        return false
      }

      // Test with a simple sources request
      const response = await this.makeRequest('sources', {
        language: 'en',
        country: 'us'
      })

      return response.success
    } catch (error) {
      console.error('NewsAPI health check failed:', error instanceof Error ? error.message : error)
      return false
    }
  }

  /**
   * Make HTTP request to NewsAPI
   */
  private async makeRequest(endpoint: string, params: Record<string, string>): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const url = new URL(endpoint, this.baseUrl)

      // Add API key
      url.searchParams.append('apiKey', this.apiKey)

      // Add parameters
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })

      console.log(`🌐 NewsAPI URL: ${url.toString().replace(this.apiKey, '[API_KEY]')}`)

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VFR-API/1.0 News Sentiment Analyzer'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Check for NewsAPI error messages
      if (data.status === 'error') {
        let errorMessage = data.message || 'Unknown NewsAPI error'

        // Provide more helpful error messages
        if (data.code === 'apiKeyInvalid') {
          errorMessage = 'NewsAPI key is invalid. Please check your NEWSAPI_KEY environment variable.'
        } else if (data.code === 'rateLimited') {
          errorMessage = 'NewsAPI rate limit exceeded. Please upgrade your plan or wait.'
        } else if (data.code === 'parametersIncompatible') {
          errorMessage = 'NewsAPI request parameters are incompatible.'
        }

        throw new Error(errorMessage)
      }

      return {
        success: true,
        data,
        source: 'newsapi',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'newsapi',
        timestamp: Date.now()
      }
    }
  }

  // Required FinancialDataProvider methods (not applicable for news sentiment)
  async getStockPrice(): Promise<any> {
    throw new Error('getStockPrice not implemented for NewsAPI - use getNewsSentiment instead')
  }

  async getCompanyInfo(): Promise<any> {
    throw new Error('getCompanyInfo not implemented for NewsAPI - use getNewsSentiment instead')
  }

  async getMarketData(): Promise<any> {
    throw new Error('getMarketData not implemented for NewsAPI - use getNewsSentiment instead')
  }

  async getStocksBySector(): Promise<any[]> {
    throw new Error('getStocksBySector not implemented for NewsAPI')
  }
}

export default NewsAPI