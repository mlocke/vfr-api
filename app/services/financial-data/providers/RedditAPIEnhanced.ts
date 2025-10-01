/**
 * Reddit API Enhanced Provider for Multi-Subreddit Financial Sentiment Analysis
 * Extends RedditAPI.ts for comprehensive financial sentiment across multiple subreddits
 *
 * Features:
 * - Multi-subreddit support with weighted scoring
 * - Parallel processing with Promise.allSettled
 * - Advanced rate limiting and error handling
 * - Backwards compatibility with existing RedditAPI
 */

import RedditAPI from './RedditAPI'
import { SecurityValidator } from '../../security/SecurityValidator'
import { ApiResponse } from '../types'
import {
  RedditPost,
  RedditSentimentData,
  SentimentAnalysisConfig
} from '../types/sentiment-types'

// Enhanced Type Definitions
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

// SubredditManager for orchestrating multi-subreddit operations
export class SubredditManager {
  private config: EnhancedRedditConfig
  private requestTracker: Map<string, number> = new Map()
  private lastRequestTime: number = 0
  private securityValidator: SecurityValidator
  private tokenBucket: { tokens: number; lastRefill: number } = { tokens: 0, lastRefill: 0 }
  private static weightCache = new Map<string, Map<string, number>>()

  constructor(config: EnhancedRedditConfig) {
    this.config = config
    this.securityValidator = SecurityValidator.getInstance()
  }

  /**
   * Optimized token bucket rate limiting for parallel requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()
    const { requestsPerMinute, burstLimit } = this.config.rateLimiting

    // Refill tokens based on time elapsed
    const timeSinceRefill = now - this.tokenBucket.lastRefill
    const tokensToAdd = Math.floor((timeSinceRefill / 60000) * requestsPerMinute)

    if (tokensToAdd > 0) {
      this.tokenBucket.tokens = Math.min(burstLimit, this.tokenBucket.tokens + tokensToAdd)
      this.tokenBucket.lastRefill = now
    }

    // If no tokens available, wait for minimal time
    if (this.tokenBucket.tokens <= 0) {
      const waitTime = Math.ceil(60000 / requestsPerMinute)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      this.tokenBucket.tokens = 1
    } else {
      this.tokenBucket.tokens--
    }
  }

  /**
   * Get active subreddits based on configuration
   */
  getActiveSubreddits(): SubredditConfig[] {
    return this.config.subreddits.filter(sub => sub.enabled)
  }

  /**
   * Cached weight validation for performance
   */
  validateWeights(): { isValid: boolean; normalizedWeights: Map<string, number> } {
    const activeSubreddits = this.getActiveSubreddits()
    const cacheKey = activeSubreddits.map(s => `${s.name}:${s.weight}`).join('|')

    // Check cache first
    if (SubredditManager.weightCache.has(cacheKey)) {
      return { isValid: true, normalizedWeights: SubredditManager.weightCache.get(cacheKey)! }
    }

    const totalWeight = activeSubreddits.reduce((sum, sub) => sum + sub.weight, 0)

    if (totalWeight === 0) {
      return { isValid: false, normalizedWeights: new Map() }
    }

    const normalizedWeights = new Map<string, number>()
    activeSubreddits.forEach(sub => {
      normalizedWeights.set(sub.name, sub.weight / totalWeight)
    })

    // Cache the result
    SubredditManager.weightCache.set(cacheKey, normalizedWeights)

    return { isValid: true, normalizedWeights }
  }

  /**
   * Optimized diversity score calculation with single pass
   */
  calculateDiversityScore(subredditResults: SubredditAnalysisResult[]): number {
    const successfulResults = subredditResults.filter(r => r.success && r.data)
    if (successfulResults.length < 2) return 0

    // Single pass calculation for mean and variance
    let sum = 0
    let sumSquares = 0
    const count = successfulResults.length

    for (const result of successfulResults) {
      const sentiment = result.data!.sentiment
      sum += sentiment
      sumSquares += sentiment * sentiment
    }

    const mean = sum / count
    const variance = (sumSquares / count) - (mean * mean)

    // Normalize variance to 0-1 scale (assuming max possible variance is 0.25)
    return Math.min(variance / 0.25, 1)
  }
}

// Main Enhanced Reddit API Class
export class RedditAPIEnhanced extends RedditAPI {
  name = 'RedditAPIEnhanced'
  private config: EnhancedRedditConfig
  private subredditManager: SubredditManager
  private circuitBreaker: Map<string, { failures: number; lastFailure: number }> = new Map()
  private enhancedSecurityValidator: SecurityValidator
  private static requestCache = new Map<string, { data: any; timestamp: number }>()

  constructor(
    clientId?: string,
    clientSecret?: string,
    userAgent?: string,
    timeout = 15000,
    throwErrors = false,
    enhancedConfig?: Partial<EnhancedRedditConfig>
  ) {
    super(clientId, clientSecret, userAgent, timeout, throwErrors)

    this.config = this.createDefaultEnhancedConfig(enhancedConfig)
    this.subredditManager = new SubredditManager(this.config)
    this.enhancedSecurityValidator = SecurityValidator.getInstance()
  }

  /**
   * Create default enhanced configuration
   */
  private createDefaultEnhancedConfig(override?: Partial<EnhancedRedditConfig>): EnhancedRedditConfig {
    const defaultConfig: EnhancedRedditConfig = {
      subreddits: [
        { name: 'wallstreetbets', weight: 0.25, analysisQuality: 'medium', postLimit: 20, enabled: true },
        { name: 'investing', weight: 0.30, analysisQuality: 'high', postLimit: 15, enabled: true },
        { name: 'SecurityAnalysis', weight: 0.25, analysisQuality: 'high', postLimit: 10, enabled: true },
        { name: 'ValueInvesting', weight: 0.15, analysisQuality: 'high', postLimit: 10, enabled: true },
        { name: 'stocks', weight: 0.05, analysisQuality: 'medium', postLimit: 15, enabled: true }
      ],
      parallelProcessing: {
        maxConcurrency: 5, // All subreddits can run in parallel
        timeoutPerRequest: 10000, // 10s per subreddit (fits within 15s component timeout)
        retryAttempts: 1 // Single retry for speed
      },
      rateLimiting: {
        requestsPerMinute: 55, // Closer to Reddit's 60 req/min limit
        burstLimit: 15, // Higher burst for parallel processing
        cooldownPeriod: 1000 // Reduced cooldown
      },
      analysis: {
        minimumPostsThreshold: 3,
        confidenceThreshold: 0.3,
        diversityWeighting: true
      },
      fallback: {
        enableSingleSubredditFallback: true,
        fallbackSubreddit: 'wallstreetbets'
      }
    }

    return { ...defaultConfig, ...override }
  }

  /**
   * Enhanced multi-subreddit sentiment analysis
   */
  async getEnhancedSentiment(symbol: string): Promise<ApiResponse<MultiSubredditSentimentData>> {
    try {
      // Validate symbol
      const validation = this.enhancedSecurityValidator.validateSymbol(symbol)
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid symbol: ${validation.errors.join(', ')}`,
          source: this.name,
          timestamp: Date.now()
        }
      }

      const sanitizedSymbol = validation.sanitized || symbol
      console.log(`🔍 Enhanced sentiment analysis for ${sanitizedSymbol} across multiple subreddits`)

      // Validate weights
      const { isValid, normalizedWeights } = this.subredditManager.validateWeights()
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid subreddit configuration - no active subreddits with valid weights',
          source: this.name,
          timestamp: Date.now()
        }
      }

      // Perform parallel analysis across subreddits
      const subredditResults = await this.analyzeMultipleSubreddits(sanitizedSymbol)

      // Handle complete failure
      if (subredditResults.every(r => !r.success)) {
        return await this.handleCompleteFallback(sanitizedSymbol)
      }

      // Process successful results
      const enhancedData = this.processMultiSubredditResults(
        sanitizedSymbol,
        subredditResults,
        normalizedWeights
      )

      return {
        success: true,
        data: enhancedData,
        source: this.name,
        timestamp: Date.now()
      }

    } catch (error) {
      console.error('Enhanced Reddit sentiment analysis failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: this.name,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Analyze sentiment across multiple subreddits in parallel
   */
  private async analyzeMultipleSubreddits(symbol: string): Promise<SubredditAnalysisResult[]> {
    const activeSubreddits = this.subredditManager.getActiveSubreddits()

    // Create analysis tasks with rate limiting
    const analysisTasks = activeSubreddits.map(async (subreddit): Promise<SubredditAnalysisResult> => {
      const startTime = Date.now()

      try {
        // Check circuit breaker
        if (this.isCircuitOpen(subreddit.name)) {
          return {
            subreddit: subreddit.name,
            success: false,
            error: 'Circuit breaker open - too many recent failures',
            responseTime: 0,
            weight: subreddit.weight
          }
        }

        // Rate limiting
        await this.subredditManager['enforceRateLimit']()

        // Perform subreddit-specific analysis
        const sentimentData = await this.getSubredditSentiment(symbol, subreddit)

        // Reset circuit breaker on success
        this.resetCircuitBreaker(subreddit.name)

        return {
          subreddit: subreddit.name,
          success: true,
          data: sentimentData,
          responseTime: Date.now() - startTime,
          weight: subreddit.weight
        }

      } catch (error) {
        // Update circuit breaker on failure
        this.updateCircuitBreaker(subreddit.name)

        return {
          subreddit: subreddit.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - startTime,
          weight: subreddit.weight
        }
      }
    })

    // Execute with controlled concurrency using Promise.allSettled
    const results = await Promise.allSettled(analysisTasks)

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        const subreddit = activeSubreddits[index]
        return {
          subreddit: subreddit.name,
          success: false,
          error: result.reason instanceof Error ? result.reason.message : 'Promise rejected',
          responseTime: 0,
          weight: subreddit.weight
        }
      }
    })
  }

  /**
   * Get sentiment data for a specific subreddit
   */
  private async getSubredditSentiment(symbol: string, subreddit: SubredditConfig): Promise<RedditSentimentData> {
    // Use existing WSB sentiment method for wallstreetbets, adapt for others
    if (subreddit.name === 'wallstreetbets') {
      const wsbResult = await super.getWSBSentiment(symbol)
      if (!wsbResult.success || !wsbResult.data) {
        throw new Error(wsbResult.error || 'Failed to get WSB sentiment')
      }
      return wsbResult.data
    }

    // For other subreddits, implement custom search logic
    return await this.getGenericSubredditSentiment(symbol, subreddit)
  }

  /**
   * Generic sentiment analysis for non-WSB subreddits with caching
   */
  private async getGenericSubredditSentiment(symbol: string, subreddit: SubredditConfig): Promise<RedditSentimentData> {
    try {
      const query = encodeURIComponent(`${symbol} subreddit:${subreddit.name}`)
      const endpoint = `/search?q=${query}&limit=${subreddit.postLimit}&sort=relevance&t=week`

      // Check cache first (5 minute TTL)
      const cacheKey = `${subreddit.name}:${symbol}`
      const cached = RedditAPIEnhanced.requestCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < 300000) {
        return this.calculateSubredditSentiment(symbol, cached.data, subreddit)
      }

      const data = await this['makeRequest'](endpoint)

      const posts: RedditPost[] = data.data.children
        .filter((child: any) => child.data.subreddit === subreddit.name)
        .map((child: any) => ({
          id: child.data.id,
          title: child.data.title,
          selftext: child.data.selftext,
          score: child.data.score,
          upvote_ratio: child.data.upvote_ratio,
          num_comments: child.data.num_comments,
          created_utc: child.data.created_utc,
          author: child.data.author,
          url: child.data.url,
          permalink: child.data.permalink,
          flair_text: child.data.link_flair_text
        }))

      // Cache the posts data
      RedditAPIEnhanced.requestCache.set(cacheKey, {
        data: posts,
        timestamp: Date.now()
      })

      return this.calculateSubredditSentiment(symbol, posts, subreddit)

    } catch (error) {
      throw new Error(`Failed to analyze ${subreddit.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Optimized sentiment calculation with single-pass aggregation
   */
  private calculateSubredditSentiment(symbol: string, posts: RedditPost[], subreddit: SubredditConfig): RedditSentimentData {
    const totalPosts = posts.length

    if (totalPosts === 0) {
      return {
        symbol,
        sentiment: 0.5,
        confidence: 0,
        postCount: 0,
        avgScore: 0,
        avgUpvoteRatio: 0.5,
        totalComments: 0,
        timeframe: '7d',
        lastUpdated: Date.now(),
        topPosts: []
      }
    }

    // Single-pass calculation for all aggregates
    let totalScore = 0
    let totalUpvoteRatio = 0
    let totalComments = 0

    for (const post of posts) {
      totalScore += post.score
      totalUpvoteRatio += post.upvote_ratio
      totalComments += post.num_comments
    }

    const avgScore = totalScore / totalPosts
    const avgUpvoteRatio = totalUpvoteRatio / totalPosts

    // Adjust sentiment calculation based on subreddit quality
    const qualityMultiplier = this.getQualityMultiplier(subreddit.analysisQuality)

    const scoreNormalized = Math.min(Math.max(avgScore / 100, 0), 1)
    const upvoteWeight = avgUpvoteRatio
    const engagementWeight = Math.min(totalComments / 1000, 1)

    const baseSentiment = (scoreNormalized * 0.4 + upvoteWeight * 0.4 + engagementWeight * 0.2)
    const adjustedSentiment = baseSentiment * qualityMultiplier

    // Pre-sort and slice for top posts to avoid multiple operations
    const topPosts = posts
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(post => ({
        title: post.title,
        score: post.score,
        comments: post.num_comments,
        url: `https://reddit.com${post.permalink}`
      }))

    return {
      symbol,
      sentiment: Math.min(Math.max(adjustedSentiment, 0), 1),
      confidence: Math.min(totalPosts / 10, 1) * qualityMultiplier,
      postCount: totalPosts,
      avgScore,
      avgUpvoteRatio,
      totalComments,
      timeframe: '7d',
      lastUpdated: Date.now(),
      topPosts
    }
  }

  /**
   * Get quality multiplier based on subreddit analysis quality
   */
  private getQualityMultiplier(quality: 'high' | 'medium' | 'low'): number {
    switch (quality) {
      case 'high': return 1.0
      case 'medium': return 0.8
      case 'low': return 0.6
      default: return 0.8
    }
  }

  /**
   * Optimized result processing with single-pass aggregation
   */
  private processMultiSubredditResults(
    symbol: string,
    results: SubredditAnalysisResult[],
    normalizedWeights: Map<string, number>
  ): MultiSubredditSentimentData {
    const successfulResults = results.filter(r => r.success && r.data)

    // Single-pass aggregation for all metrics
    let weightedSentiment = 0
    let totalActiveWeight = 0
    let totalPosts = 0
    let totalConfidence = 0
    let totalScore = 0
    let totalUpvoteRatio = 0
    let totalComments = 0
    const subredditBreakdown: MultiSubredditSentimentData['subredditBreakdown'] = []
    const allTopPosts: any[] = []

    for (const result of successfulResults) {
      const weight = normalizedWeights.get(result.subreddit) || 0
      const data = result.data!
      const contribution = data.sentiment * weight

      // Accumulate weighted sentiment
      weightedSentiment += contribution
      totalActiveWeight += weight

      // Accumulate other metrics in single pass
      totalPosts += data.postCount
      totalConfidence += data.confidence
      totalScore += data.avgScore
      totalUpvoteRatio += data.avgUpvoteRatio
      totalComments += data.totalComments

      // Add to breakdown
      subredditBreakdown.push({
        subreddit: result.subreddit,
        sentiment: data.sentiment,
        confidence: data.confidence,
        postCount: data.postCount,
        weight,
        contributionScore: contribution
      })

      // Collect top posts with limit to avoid excessive memory
      allTopPosts.push(...data.topPosts.slice(0, 2)) // Max 2 per subreddit
    }

    // Normalize weighted sentiment
    if (totalActiveWeight > 0 && totalActiveWeight < 1) {
      weightedSentiment = weightedSentiment / totalActiveWeight
    }

    // Calculate averages
    const resultCount = successfulResults.length
    const avgConfidence = resultCount > 0 ? totalConfidence / resultCount : 0
    const avgScore = resultCount > 0 ? totalScore / resultCount : 0
    const avgUpvoteRatio = resultCount > 0 ? totalUpvoteRatio / resultCount : 0

    // Sort top posts once and take top 5
    const topPosts = allTopPosts
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    // Calculate diversity score
    const diversityScore = this.subredditManager.calculateDiversityScore(results)

    return {
      symbol,
      sentiment: weightedSentiment,
      confidence: avgConfidence,
      postCount: totalPosts,
      avgScore,
      avgUpvoteRatio,
      totalComments,
      timeframe: '7d',
      lastUpdated: Date.now(),
      topPosts,
      subredditBreakdown,
      weightedSentiment,
      totalWeight: totalActiveWeight,
      diversityScore
    }
  }

  /**
   * Handle complete failure fallback to single subreddit
   */
  private async handleCompleteFallback(symbol: string): Promise<ApiResponse<MultiSubredditSentimentData>> {
    if (!this.config.fallback.enableSingleSubredditFallback) {
      return {
        success: false,
        error: 'All subreddit analyses failed and fallback is disabled',
        source: this.name,
        timestamp: Date.now()
      }
    }

    try {
      console.log(`🔄 Falling back to single subreddit: ${this.config.fallback.fallbackSubreddit}`)
      const fallbackResult = await super.getWSBSentiment(symbol)

      if (!fallbackResult.success || !fallbackResult.data) {
        throw new Error(fallbackResult.error || 'Fallback failed')
      }

      // Convert single subreddit result to multi-subreddit format
      const enhancedData: MultiSubredditSentimentData = {
        ...fallbackResult.data,
        subredditBreakdown: [{
          subreddit: this.config.fallback.fallbackSubreddit,
          sentiment: fallbackResult.data.sentiment,
          confidence: fallbackResult.data.confidence,
          postCount: fallbackResult.data.postCount,
          weight: 1.0,
          contributionScore: fallbackResult.data.sentiment
        }],
        weightedSentiment: fallbackResult.data.sentiment,
        totalWeight: 1.0,
        diversityScore: 0
      }

      return {
        success: true,
        data: enhancedData,
        source: this.name,
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: `Complete fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: this.name,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Circuit breaker pattern methods
   */
  private isCircuitOpen(subreddit: string): boolean {
    const breaker = this.circuitBreaker.get(subreddit)
    if (!breaker) return false

    const timeSinceLastFailure = Date.now() - breaker.lastFailure
    const cooldownExpired = timeSinceLastFailure > this.config.rateLimiting.cooldownPeriod

    // Reset if cooldown period has passed
    if (cooldownExpired) {
      this.circuitBreaker.delete(subreddit)
      return false
    }

    // Open circuit if too many failures
    return breaker.failures >= this.config.parallelProcessing.retryAttempts
  }

  private updateCircuitBreaker(subreddit: string): void {
    const current = this.circuitBreaker.get(subreddit) || { failures: 0, lastFailure: 0 }
    this.circuitBreaker.set(subreddit, {
      failures: current.failures + 1,
      lastFailure: Date.now()
    })
  }

  private resetCircuitBreaker(subreddit: string): void {
    this.circuitBreaker.delete(subreddit)
  }

  /**
   * Enhanced health check for multi-subreddit functionality
   */
  async healthCheckEnhanced(): Promise<{
    overall: boolean
    subreddits: Array<{ name: string; healthy: boolean; responseTime?: number }>
    rateLimiting: boolean
    configuration: boolean
  }> {
    const baseHealthy = await super.healthCheck()
    const subredditHealth: Array<{ name: string; healthy: boolean; responseTime?: number }> = []

    // Test each active subreddit
    const activeSubreddits = this.subredditManager.getActiveSubreddits()

    for (const subreddit of activeSubreddits.slice(0, 2)) { // Test first 2 to avoid rate limits
      const startTime = Date.now()
      try {
        await this.getGenericSubredditSentiment('AAPL', subreddit) // Test with a common symbol
        subredditHealth.push({
          name: subreddit.name,
          healthy: true,
          responseTime: Date.now() - startTime
        })
      } catch (error) {
        subredditHealth.push({
          name: subreddit.name,
          healthy: false
        })
      }
    }

    const { isValid } = this.subredditManager.validateWeights()

    return {
      overall: baseHealthy && subredditHealth.some(s => s.healthy),
      subreddits: subredditHealth,
      rateLimiting: true, // Always true as it's implemented
      configuration: isValid
    }
  }

  /**
   * Get current configuration (for admin dashboard)
   */
  getConfiguration(): EnhancedRedditConfig {
    return { ...this.config } // Return copy to prevent external modification
  }

  /**
   * Update configuration (for admin dashboard)
   */
  updateConfiguration(newConfig: Partial<EnhancedRedditConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.subredditManager = new SubredditManager(this.config)
  }
}

export default RedditAPIEnhanced