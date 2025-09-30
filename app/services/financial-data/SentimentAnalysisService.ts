/**
 * Sentiment Analysis Service
 * Connects news sentiment analysis with stock analysis engine
 * Provides 10% weight in composite scoring as per roadmap
 */

import YahooFinanceSentimentAPI from './providers/YahooFinanceSentimentAPI'
import RedditAPIEnhanced from './providers/RedditAPIEnhanced'
import { OptionsAnalysisService } from './OptionsAnalysisService'
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
  RedditSentimentData,
  OptionsSentimentData
} from './types/sentiment-types'

export class SentimentAnalysisService {
  private yahooSentimentAPI: YahooFinanceSentimentAPI
  private redditAPI: RedditAPIEnhanced | null
  private optionsAnalysisService: OptionsAnalysisService | null
  private cache: RedisCache
  private config: SentimentConfig
  private securityValidator: SecurityValidator

  constructor(
    cache: RedisCache,
    redditAPI?: RedditAPIEnhanced,
    optionsAnalysisService?: OptionsAnalysisService
  ) {
    this.yahooSentimentAPI = new YahooFinanceSentimentAPI()
    this.redditAPI = redditAPI || null
    this.optionsAnalysisService = optionsAnalysisService || null
    this.cache = cache
    this.config = this.createDefaultConfig()
    this.securityValidator = SecurityValidator.getInstance()

    // Initialize Reddit API Enhanced if credentials are available
    if (!this.redditAPI && process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
      try {
        this.redditAPI = new RedditAPIEnhanced()
        console.log('Reddit API Enhanced initialized for multi-subreddit sentiment analysis')
      } catch (error) {
        console.warn('Failed to initialize Reddit API Enhanced:', error)
      }
    }

    // Initialize Options Analysis Service if not provided
    if (!this.optionsAnalysisService) {
      try {
        this.optionsAnalysisService = new OptionsAnalysisService(cache)
        console.log('Options Analysis Service initialized for options sentiment analysis')
      } catch (error) {
        console.warn('Failed to initialize Options Analysis Service:', error)
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
  async getSentimentIndicators(symbol: string, analystData?: any): Promise<SentimentIndicators | null> {
    try {
      // Validate symbol first to prevent injection attacks
      const validation = this.securityValidator.validateSymbol(symbol)
      if (!validation.isValid) {
        console.warn(`Invalid symbol rejected: ${validation.errors.join(', ')}`)
        return null
      }

      // Use sanitized symbol
      const sanitizedSymbol = validation.sanitized || symbol

      // Check cache first (include analyst data in cache key if provided)
      const cacheKey = `sentiment:indicators:${sanitizedSymbol}:${analystData ? 'with-analyst' : 'no-analyst'}`
      const cached = await this.getCachedData(cacheKey)
      if (cached) {
        return cached
      }

      console.log('📊 Fetching fresh sentiment indicators...')

      // Fetch news sentiment
      const newsData = await this.getNewsSentiment(sanitizedSymbol)

      // Fetch Reddit sentiment using enhanced multi-subreddit analysis if available
      let redditData: RedditSentimentData | undefined
      if (this.redditAPI) {
        try {
          console.log('📱 Fetching multi-subreddit sentiment from Reddit Enhanced...')
          const redditResponse = await this.redditAPI.getEnhancedSentiment(sanitizedSymbol)

          // Check for validation errors (security failures)
          if (!redditResponse.success && redditResponse.error?.includes('Invalid symbol')) {
            // Symbol validation failed - likely injection attempt
            console.warn('Symbol validation failed - potential security issue')
            return null
          }

          if (redditResponse.success && redditResponse.data) {
            redditData = redditResponse.data
            console.log(`✅ Enhanced Reddit sentiment: ${redditData.sentiment.toFixed(2)} (${redditData.postCount} posts across ${redditResponse.data.subredditBreakdown?.length || 1} subreddits)`)

            // Filter out Reddit data with zero confidence (no posts found)
            if (redditData.confidence === 0) {
              console.log('📊 Reddit data has zero confidence, excluding from analysis')
              redditData = undefined
            }
          }
        } catch (error) {
          console.warn('Enhanced Reddit sentiment fetch failed:', error)
        }
      }

      // Fetch options sentiment using put/call ratio analysis
      let optionsData: OptionsSentimentData | undefined
      if (this.optionsAnalysisService) {
        try {
          console.log('📊 Fetching options sentiment from P/C ratio analysis...')
          const rawOptionsData = await this.getOptionsSentiment(sanitizedSymbol)

          if (rawOptionsData) {
            console.log(`✅ Options sentiment: ${rawOptionsData.sentiment.toFixed(2)} (P/C: ${rawOptionsData.putCallRatio.toFixed(2)}, ${rawOptionsData.sentimentSignal})`)

            // Filter out options data with zero confidence
            if (rawOptionsData.confidence === 0) {
              console.log('📊 Options data has zero confidence, excluding from analysis')
              optionsData = undefined
            } else {
              optionsData = rawOptionsData
            }
          }
        } catch (error) {
          console.warn('Options sentiment fetch failed:', error)
        }
      }

      // Check if we have any meaningful sentiment data
      if (!newsData && !redditData && !optionsData) {
        console.warn('No meaningful sentiment data available from any source')
        return null
      }

      // Calculate aggregated score with dynamic weighting
      const analystWeight = this.config.weights.analyst || 0
      const newsWeight = this.config.weights.news
      const redditWeight = this.config.weights.reddit
      const optionsWeight = this.config.weights.options

      let aggregatedScore = 0
      let totalWeight = 0
      let baseConfidence = 0

      // Add analyst sentiment if available (highest priority)
      if (analystData && analystData.sentimentScore !== undefined) {
        // Normalize analyst score from 1-5 scale to 0-1 scale
        const normalizedAnalystScore = (analystData.sentimentScore - 1) / 4
        aggregatedScore += normalizedAnalystScore * analystWeight
        totalWeight += analystWeight
        baseConfidence = analystData.totalAnalysts > 0 ? Math.min(0.9, 0.5 + (analystData.totalAnalysts / 100)) : 0.7
        console.log(`📊 Analyst sentiment: ${normalizedAnalystScore.toFixed(3)} (${analystData.sentimentScore}/5 from ${analystData.totalAnalysts} analysts, weight: ${(analystWeight * 100).toFixed(0)}%)`)
      }

      // Add news sentiment if available
      if (newsData) {
        aggregatedScore += this.normalizeToZeroOne(newsData.sentiment) * newsWeight
        totalWeight += newsWeight
        if (!analystData) {
          baseConfidence = newsData.confidence
        }
      }

      // Add Reddit sentiment if available
      if (redditData) {
        aggregatedScore += redditData.sentiment * redditWeight
        totalWeight += redditWeight

        // If no analyst or news data, use Reddit confidence as base
        if (!analystData && !newsData) {
          baseConfidence = redditData.confidence
        }
      }

      // Add options sentiment if available
      if (optionsData) {
        aggregatedScore += optionsData.sentiment * optionsWeight
        totalWeight += optionsWeight

        // If no analyst, news, or Reddit data, use options confidence as base
        if (!analystData && !newsData && !redditData) {
          baseConfidence = optionsData.confidence
        }
      }

      // Normalize by total weight
      aggregatedScore = totalWeight > 0 ? aggregatedScore / totalWeight : 0.5

      // Calculate confidence (higher with multiple sources)
      const sourceCount = [newsData, redditData, optionsData].filter(Boolean).length
      const multiSourceBonus = sourceCount > 1 ? (sourceCount - 1) * 0.05 : 0 // 5% bonus per additional source
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
        options: optionsData,
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
   * Get company sentiment for a stock symbol using Yahoo Finance
   */
  private async getNewsSentiment(symbol: string): Promise<NewsSentimentData | null> {
    try {
      return await this.yahooSentimentAPI.getNewsSentiment(symbol, '1d')
    } catch (error) {
      console.error(`Failed to get company sentiment for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get options sentiment using Put/Call ratio analysis
   */
  private async getOptionsSentiment(symbol: string): Promise<OptionsSentimentData | null> {
    try {
      if (!this.optionsAnalysisService) {
        return null
      }

      // Get P/C ratio data from options service
      const putCallData = await this.optionsAnalysisService.calculateUnicornBayPutCallSignals(symbol)
      if (!putCallData) {
        return null
      }

      // Get enhanced options analysis for additional context
      const optionsAnalysis = await this.optionsAnalysisService.analyzeOptionsData(symbol)

      // Convert P/C ratio to sentiment score (-1 to +1 scale, then normalized to 0-1)
      const sentiment = this.calculatePutCallSentiment(putCallData, optionsAnalysis)

      // Determine signal strength based on volume and unusual activity
      const signalStrength = this.determineOptionsSignalStrength(putCallData, optionsAnalysis)

      // Generate options-specific insights
      const insights = this.generateOptionsInsights(putCallData, optionsAnalysis, sentiment)

      const optionsSentiment: OptionsSentimentData = {
        symbol,
        sentiment,
        confidence: this.calculateOptionsConfidence(putCallData, optionsAnalysis),
        putCallRatio: putCallData.volumeRatio,
        openInterestRatio: putCallData.openInterestRatio,
        sentimentSignal: this.interpretPutCallSignal(putCallData.volumeRatio),
        signalStrength,
        unusualActivity: (optionsAnalysis?.unusualActivity?.largeTransactions ?? 0) > 0,
        institutionalFlow: this.determineInstitutionalFlow(putCallData, optionsAnalysis),
        volumeAnalysis: {
          totalVolume: putCallData.totalCallVolume + putCallData.totalPutVolume,
          callVolume: putCallData.totalCallVolume,
          putVolume: putCallData.totalPutVolume,
          largeTransactions: optionsAnalysis?.unusualActivity?.largeTransactions || 0
        },
        timeframe: '1d',
        lastUpdated: Date.now(),
        insights
      }

      return optionsSentiment

    } catch (error) {
      console.error(`Failed to get options sentiment for ${symbol}:`, error)
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
    let optionsScore = 0

    if (indicators.reddit) {
      redditScore = indicators.reddit.sentiment
      reasoning.push(`Reddit WSB sentiment: ${(redditScore * 100).toFixed(0)}% (${indicators.reddit.postCount} posts)`)

      if (redditScore > 0.7) {
        opportunities.push('Strong retail investor sentiment on WSB may drive momentum')
      } else if (redditScore < 0.3) {
        warnings.push('Negative retail sentiment on WSB could create selling pressure')
      }
    }

    if (indicators.options) {
      optionsScore = indicators.options.sentiment
      reasoning.push(`Options sentiment: ${(optionsScore * 100).toFixed(0)}% (P/C: ${indicators.options.putCallRatio.toFixed(2)}, ${indicators.options.sentimentSignal})`)

      if (indicators.options.putCallRatio > 1.2) {
        warnings.push('High put/call ratio suggests bearish institutional sentiment')
      } else if (indicators.options.putCallRatio < 0.8) {
        opportunities.push('Low put/call ratio indicates bullish options positioning')
      }

      if (indicators.options.unusualActivity) {
        if (indicators.options.institutionalFlow === 'INFLOW') {
          opportunities.push('Unusual institutional options inflow detected')
        } else if (indicators.options.institutionalFlow === 'OUTFLOW') {
          warnings.push('Institutional options outflow may signal distribution')
        }
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
        reddit: indicators.reddit ? redditScore : undefined,
        options: indicators.options ? optionsScore : undefined
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
          source: 'composite', // Yahoo Finance company data
          indicators: ['company_sentiment'],
          lastUpdated: Date.now(),
          quality: 0.8,
          latency: 2000
        }],
        fallback: []
      },
      weights: {
        analyst: 0.40, // 40% weight for analyst consensus (FMP) - highest priority professional opinion
        news: 0.30, // 30% weight for company sentiment (Yahoo Finance) - reduced from 55%
        reddit: 0.20, // 20% weight for Reddit WSB sentiment - reduced from 30%
        options: 0.10 // 10% weight for options sentiment (P/C ratio analysis) - reduced from 15%
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
   * Calculate sentiment score from P/C ratio data
   * P/C ratio interpretation: >1.2 bearish, <0.8 bullish, 0.8-1.2 neutral
   */
  private calculatePutCallSentiment(putCallData: any, optionsAnalysis: any): number {
    const pcRatio = putCallData.volumeRatio

    // Base sentiment from P/C ratio (inverted since high P/C = bearish)
    let baseSentiment = 0.5 // Neutral baseline

    if (pcRatio > 1.2) {
      // Bearish: Higher put volume relative to calls
      baseSentiment = Math.max(0, 0.5 - ((pcRatio - 1.2) * 0.25))
    } else if (pcRatio < 0.8) {
      // Bullish: Higher call volume relative to puts
      baseSentiment = Math.min(1, 0.5 + ((0.8 - pcRatio) * 0.625))
    }

    // Adjust for unusual activity (institutional signals)
    if (optionsAnalysis?.unusualActivity?.largeTransactions > 0) {
      const volumeRatio = optionsAnalysis.unusualActivity.volumeRatio
      if (volumeRatio > 2) {
        // High unusual activity amplifies the signal
        if (baseSentiment > 0.5) {
          baseSentiment = Math.min(1, baseSentiment + 0.1)
        } else {
          baseSentiment = Math.max(0, baseSentiment - 0.1)
        }
      }
    }

    return baseSentiment
  }

  /**
   * Interpret P/C ratio signal direction
   */
  private interpretPutCallSignal(pcRatio: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (pcRatio > 1.2) return 'BEARISH'
    if (pcRatio < 0.8) return 'BULLISH'
    return 'NEUTRAL'
  }

  /**
   * Determine options signal strength based on volume and activity
   */
  private determineOptionsSignalStrength(putCallData: any, optionsAnalysis: any): 'WEAK' | 'MODERATE' | 'STRONG' {
    const totalVolume = putCallData.totalCallVolume + putCallData.totalPutVolume
    const pcRatio = putCallData.volumeRatio
    const unusualActivity = optionsAnalysis?.unusualActivity?.largeTransactions || 0

    // Strong signal criteria
    if (totalVolume > 10000 && (pcRatio > 1.5 || pcRatio < 0.6) && unusualActivity > 0) {
      return 'STRONG'
    }

    // Moderate signal criteria
    if (totalVolume > 5000 && (pcRatio > 1.3 || pcRatio < 0.7)) {
      return 'MODERATE'
    }

    return 'WEAK'
  }

  /**
   * Calculate confidence for options sentiment
   */
  private calculateOptionsConfidence(putCallData: any, optionsAnalysis: any): number {
    let confidence = 0.3 // Base confidence

    const totalVolume = putCallData.totalCallVolume + putCallData.totalPutVolume

    // Volume-based confidence
    if (totalVolume > 20000) confidence += 0.3
    else if (totalVolume > 10000) confidence += 0.2
    else if (totalVolume > 5000) confidence += 0.1

    // P/C ratio extremes increase confidence
    const pcRatio = putCallData.volumeRatio
    if (pcRatio > 1.5 || pcRatio < 0.5) confidence += 0.2
    else if (pcRatio > 1.3 || pcRatio < 0.7) confidence += 0.1

    // Unusual activity boosts confidence
    if (optionsAnalysis?.unusualActivity?.largeTransactions > 0) {
      confidence += 0.2
    }

    return Math.min(1.0, confidence)
  }

  /**
   * Determine institutional flow direction
   */
  private determineInstitutionalFlow(putCallData: any, optionsAnalysis: any): 'INFLOW' | 'OUTFLOW' | 'NEUTRAL' {
    const totalVolume = putCallData.totalCallVolume + putCallData.totalPutVolume
    const largeTransactions = optionsAnalysis?.unusualActivity?.largeTransactions || 0

    if (largeTransactions === 0 || totalVolume < 5000) {
      return 'NEUTRAL'
    }

    const pcRatio = putCallData.volumeRatio

    // High call volume with large transactions = bullish inflow
    if (pcRatio < 0.8 && largeTransactions > 0) {
      return 'INFLOW'
    }

    // High put volume with large transactions = bearish outflow
    if (pcRatio > 1.2 && largeTransactions > 0) {
      return 'OUTFLOW'
    }

    return 'NEUTRAL'
  }

  /**
   * Generate options-specific insights
   */
  private generateOptionsInsights(putCallData: any, optionsAnalysis: any, sentiment: number): string[] {
    const insights: string[] = []
    const pcRatio = putCallData.volumeRatio
    const totalVolume = putCallData.totalCallVolume + putCallData.totalPutVolume

    // Volume insights
    if (totalVolume > 20000) {
      insights.push(`High options volume: ${totalVolume.toLocaleString()} contracts`)
    } else if (totalVolume > 10000) {
      insights.push(`Moderate options volume: ${totalVolume.toLocaleString()} contracts`)
    }

    // P/C ratio insights
    if (pcRatio > 1.5) {
      insights.push(`Very high put/call ratio (${pcRatio.toFixed(2)}) indicates strong bearish sentiment`)
    } else if (pcRatio > 1.2) {
      insights.push(`Elevated put/call ratio (${pcRatio.toFixed(2)}) suggests bearish positioning`)
    } else if (pcRatio < 0.5) {
      insights.push(`Very low put/call ratio (${pcRatio.toFixed(2)}) indicates strong bullish sentiment`)
    } else if (pcRatio < 0.8) {
      insights.push(`Low put/call ratio (${pcRatio.toFixed(2)}) suggests bullish positioning`)
    }

    // Unusual activity insights
    const largeTransactions = optionsAnalysis?.unusualActivity?.largeTransactions || 0
    if (largeTransactions > 0) {
      insights.push(`${largeTransactions} large block transaction${largeTransactions > 1 ? 's' : ''} detected`)
    }

    // Open interest insights
    if (putCallData.openInterestRatio !== putCallData.volumeRatio) {
      const oiDiff = Math.abs(putCallData.openInterestRatio - putCallData.volumeRatio)
      if (oiDiff > 0.3) {
        insights.push(`Divergence between volume and open interest P/C ratios suggests fresh positioning`)
      }
    }

    return insights
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const yahooSentimentHealth = await this.yahooSentimentAPI.healthCheck()
      const cacheHealth = await this.cache.ping() === 'PONG'

      let optionsHealth = false
      if (this.optionsAnalysisService) {
        try {
          const optionsHealthCheck = await this.optionsAnalysisService.healthCheckEnhanced()
          optionsHealth = optionsHealthCheck.available
        } catch (error) {
          console.warn('Options health check failed:', error)
        }
      }

      const healthy = yahooSentimentHealth && cacheHealth

      return {
        status: healthy ? 'healthy' : 'unhealthy',
        details: {
          yahooFinanceSentiment: yahooSentimentHealth,
          cache: cacheHealth,
          optionsAnalysis: optionsHealth
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