# Institutional Data Caching & Sentiment Integration

## Overview

This document outlines the comprehensive caching strategies, error handling patterns, and sentiment scoring integration for institutional and insider data in the VFR platform. The design ensures optimal performance while maintaining data freshness and system reliability.

## Caching Strategies

### 1. Multi-Tier Caching Architecture

```typescript
interface CacheStrategy {
  L1_MEMORY: InMemoryCache     // <5 minutes, frequently accessed data
  L2_REDIS: RedisCache         // Variable TTL, structured data
  L3_PERSISTENT: FileCache     // Long-term, large filing storage
}

class InstitutionalCacheManager {
  private memoryCache = new Map<string, CacheEntry>()
  private redisCache: RedisCache
  private fileCache?: PersistentFileCache

  constructor() {
    this.redisCache = RedisCache.getInstance()

    // Optional file cache for large 13F filings
    if (process.env.ENABLE_FILE_CACHE === 'true') {
      this.fileCache = new PersistentFileCache({
        directory: process.env.CACHE_DIRECTORY || '/tmp/vfr-cache',
        maxSize: '10GB',
        compression: true
      })
    }
  }

  // Intelligent cache retrieval with fallback
  async get<T>(key: string, type: CacheType): Promise<T | null> {
    // L1: Memory cache (fastest)
    const memoryResult = this.memoryCache.get(key)
    if (memoryResult && !this.isExpired(memoryResult)) {
      this.recordCacheHit('L1_MEMORY', key)
      return memoryResult.data as T
    }

    // L2: Redis cache (fast, persistent)
    const redisResult = await this.redisCache.get<T>(key)
    if (redisResult) {
      // Promote to L1 for hot data
      this.memoryCache.set(key, {
        data: redisResult,
        timestamp: Date.now(),
        ttl: this.getMemoryTTL(type)
      })
      this.recordCacheHit('L2_REDIS', key)
      return redisResult
    }

    // L3: File cache (for large filings)
    if (this.fileCache && type === 'LARGE_FILING') {
      const fileResult = await this.fileCache.get<T>(key)
      if (fileResult) {
        this.recordCacheHit('L3_FILE', key)
        return fileResult
      }
    }

    this.recordCacheMiss(key, type)
    return null
  }

  // Smart cache storage with appropriate tier selection
  async set<T>(key: string, data: T, type: CacheType, metadata?: CacheMetadata): Promise<void> {
    const size = this.estimateSize(data)
    const ttl = this.calculateOptimalTTL(type, metadata)

    // L1: Store small, frequently accessed data in memory
    if (size < this.MEMORY_CACHE_THRESHOLD && this.isHotData(key, metadata)) {
      this.memoryCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: Math.min(ttl, 300) // Max 5 minutes in memory
      })
    }

    // L2: Always store in Redis for persistence and sharing
    await this.redisCache.set(key, data, ttl, {
      source: metadata?.source || 'institutional',
      version: metadata?.version || '1.0.0',
      type,
      size
    })

    // L3: Store large filings in file cache
    if (this.fileCache && (size > this.LARGE_FILE_THRESHOLD || type === 'LARGE_FILING')) {
      await this.fileCache.set(key, data, ttl * 2) // Longer TTL for file cache
    }
  }
}
```

### 2. Dynamic TTL Calculation

```typescript
class DynamicTTLCalculator {
  calculateOptimalTTL(dataType: CacheType, metadata?: CacheMetadata): number {
    const baseTTLs = {
      'CIK_MAPPING': 24 * 3600,           // 24 hours (rarely changes)
      'INSTITUTIONAL_HOLDINGS': 6 * 3600,  // 6 hours (quarterly updates)
      'INSIDER_TRANSACTIONS': 2 * 3600,    // 2 hours (more frequent)
      'SENTIMENT_ANALYSIS': 4 * 3600,      // 4 hours (composite data)
      'FILING_METADATA': 12 * 3600,        // 12 hours (filing lists)
      'LARGE_FILING': 48 * 3600            // 48 hours (raw filing data)
    }

    let baseTTL = baseTTLs[dataType] || 3600

    // Dynamic adjustments based on context
    const adjustments = {
      dataQuality: this.getQualityMultiplier(metadata?.confidence),
      marketHours: this.getMarketHoursMultiplier(),
      dataVolume: this.getVolumeMultiplier(metadata?.recordCount),
      userActivity: this.getUserActivityMultiplier(dataType),
      systemLoad: this.getSystemLoadMultiplier()
    }

    // Apply adjustments
    const finalTTL = Object.values(adjustments).reduce(
      (ttl, multiplier) => ttl * multiplier,
      baseTTL
    )

    return Math.max(300, Math.min(86400, Math.floor(finalTTL))) // 5 min to 24 hours
  }

  private getQualityMultiplier(confidence?: number): number {
    if (!confidence) return 1.0

    // Higher quality data can be cached longer
    return 0.5 + (confidence * 1.5) // 0.5x to 2.0x multiplier
  }

  private getMarketHoursMultiplier(): number {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()

    // Shorter cache during market hours (more volatility)
    if (day >= 1 && day <= 5 && hour >= 9 && hour <= 16) {
      return 0.6 // 40% shorter TTL during market hours
    }

    return 1.0
  }

  private getVolumeMultiplier(recordCount?: number): number {
    if (!recordCount) return 1.0

    // More data = longer cache (expensive to regenerate)
    if (recordCount > 1000) return 1.5
    if (recordCount > 100) return 1.2
    return 1.0
  }
}
```

### 3. Cache Warming and Preloading

```typescript
class CacheWarmingService {
  private popularSymbols: string[] = []
  private warmingSchedule: Map<string, number> = new Map()

  constructor(private institutionalService: InstitutionalDataService) {
    this.loadPopularSymbols()
    this.scheduleWarmingTasks()
  }

  // Intelligent cache warming based on usage patterns
  async warmCriticalData(): Promise<void> {
    const warmingTasks = [
      this.warmCIKMappings(),
      this.warmPopularSymbolData(),
      this.warmRecentFilingMetadata(),
      this.warmMarketHoursData()
    ]

    const results = await Promise.allSettled(warmingTasks)

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.errorHandler.logger.warn(`Cache warming task ${index} failed`, {
          error: result.reason
        })
      }
    })
  }

  // Pre-warm data for market opening
  async warmMarketOpeningData(): Promise<void> {
    const preMarketSymbols = await this.getPreMarketActiveSymbols()

    const warmingPromises = preMarketSymbols.map(async (symbol) => {
      try {
        // Pre-fetch and cache institutional data
        const intelligence = await this.institutionalService.getInstitutionalIntelligence(symbol)

        this.errorHandler.logger.debug(`Pre-warmed institutional data for ${symbol}`, {
          dataAvailable: !!intelligence,
          cacheWarming: true
        })
      } catch (error) {
        this.errorHandler.logger.warn(`Pre-warming failed for ${symbol}`, { error })
      }
    })

    await Promise.allSettled(warmingPromises)
  }

  // Predictive cache warming based on user behavior
  async warmPredictiveData(userId: string, recentSymbols: string[]): Promise<void> {
    // Analyze user patterns and pre-fetch likely requests
    const predictedSymbols = await this.predictNextSymbols(userId, recentSymbols)

    // Background warming (don't block user requests)
    setImmediate(async () => {
      for (const symbol of predictedSymbols) {
        try {
          await this.institutionalService.getInstitutionalIntelligence(symbol)
        } catch (error) {
          // Silent failure for predictive warming
        }
      }
    })
  }

  private async warmCIKMappings(): Promise<void> {
    // Pre-load company ticker to CIK mappings
    const cacheKey = 'sec:company_tickers'
    const cached = await this.redisCache.get(cacheKey)

    if (!cached) {
      // Trigger CIK mapping load
      await this.institutionalService['getCompanyCik']('AAPL') // Trigger mapping load
    }
  }
}
```

## Error Handling Patterns

### 1. Hierarchical Error Handling

```typescript
enum InstitutionalErrorSeverity {
  LOW = 'LOW',           // Cache miss, retry later
  MEDIUM = 'MEDIUM',     // Partial data failure
  HIGH = 'HIGH',         // Service degradation
  CRITICAL = 'CRITICAL'  // Complete service failure
}

enum InstitutionalErrorCode {
  // Data Access Errors
  SEC_RATE_LIMIT = 'SEC_RATE_LIMIT',
  SEC_API_UNAVAILABLE = 'SEC_API_UNAVAILABLE',
  CIK_LOOKUP_FAILED = 'CIK_LOOKUP_FAILED',

  // Data Processing Errors
  FILING_PARSE_ERROR = 'FILING_PARSE_ERROR',
  INVALID_FILING_FORMAT = 'INVALID_FILING_FORMAT',
  DATA_VALIDATION_FAILED = 'DATA_VALIDATION_FAILED',

  // System Errors
  CACHE_UNAVAILABLE = 'CACHE_UNAVAILABLE',
  MEMORY_EXHAUSTED = 'MEMORY_EXHAUSTED',
  TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED',

  // Business Logic Errors
  NO_INSTITUTIONAL_DATA = 'NO_INSTITUTIONAL_DATA',
  INSUFFICIENT_DATA_QUALITY = 'INSUFFICIENT_DATA_QUALITY',
  STALE_DATA_WARNING = 'STALE_DATA_WARNING'
}

class InstitutionalErrorHandler {
  private circuitBreakers = new Map<string, CircuitBreaker>()
  private errorMetrics = new Map<string, ErrorMetrics>()

  async handleError(
    error: Error,
    context: ErrorContext,
    operation: string
  ): Promise<ErrorHandlingResult> {
    const errorInfo = this.categorizeError(error, context)

    // Record error metrics
    this.recordErrorMetrics(errorInfo, operation)

    // Determine handling strategy
    const strategy = this.getHandlingStrategy(errorInfo)

    switch (strategy.action) {
      case 'RETRY':
        return this.handleRetryableError(error, context, strategy)

      case 'FALLBACK':
        return this.handleFallbackError(error, context, strategy)

      case 'CIRCUIT_BREAK':
        return this.handleCircuitBreakerError(error, context, strategy)

      case 'ESCALATE':
        return this.handleCriticalError(error, context, strategy)

      default:
        return this.handleUnknownError(error, context)
    }
  }

  private categorizeError(error: Error, context: ErrorContext): CategorizedError {
    // SEC-specific error patterns
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return {
        code: InstitutionalErrorCode.SEC_RATE_LIMIT,
        severity: InstitutionalErrorSeverity.MEDIUM,
        retryable: true,
        retryAfter: 60000, // 1 minute
        category: 'RATE_LIMIT'
      }
    }

    if (error.message.includes('CIK') || error.message.includes('not found')) {
      return {
        code: InstitutionalErrorCode.CIK_LOOKUP_FAILED,
        severity: InstitutionalErrorSeverity.LOW,
        retryable: false,
        category: 'DATA_NOT_FOUND'
      }
    }

    if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      return {
        code: InstitutionalErrorCode.TIMEOUT_EXCEEDED,
        severity: InstitutionalErrorSeverity.MEDIUM,
        retryable: true,
        retryAfter: 5000,
        category: 'TIMEOUT'
      }
    }

    // Memory and parsing errors
    if (error.message.includes('memory') || error.message.includes('heap')) {
      return {
        code: InstitutionalErrorCode.MEMORY_EXHAUSTED,
        severity: InstitutionalErrorSeverity.HIGH,
        retryable: false,
        category: 'RESOURCE_EXHAUSTION'
      }
    }

    // Default categorization
    return {
      code: InstitutionalErrorCode.FILING_PARSE_ERROR,
      severity: InstitutionalErrorSeverity.MEDIUM,
      retryable: true,
      category: 'UNKNOWN'
    }
  }

  private async handleRetryableError(
    error: Error,
    context: ErrorContext,
    strategy: HandlingStrategy
  ): Promise<ErrorHandlingResult> {
    const retryConfig = {
      maxAttempts: strategy.maxRetries || 3,
      backoffMultiplier: 2,
      initialDelay: strategy.retryAfter || 1000,
      maxDelay: 30000
    }

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        // Wait before retry
        if (attempt > 1) {
          const delay = Math.min(
            retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 2),
            retryConfig.maxDelay
          )
          await this.delay(delay)
        }

        // Retry the operation
        const result = await context.operation()

        // Success - reset error metrics
        this.resetErrorMetrics(context.operationName)

        return {
          success: true,
          data: result,
          metadata: {
            attempt,
            recoveredFromError: true
          }
        }
      } catch (retryError) {
        this.errorHandler.logger.warn(`Retry attempt ${attempt} failed`, {
          originalError: error.message,
          retryError: retryError.message,
          operation: context.operationName
        })

        if (attempt === retryConfig.maxAttempts) {
          // All retries exhausted
          return {
            success: false,
            error: retryError,
            metadata: {
              attemptsExhausted: true,
              finalAttempt: attempt
            }
          }
        }
      }
    }

    throw new Error('Unexpected retry handler state')
  }
}
```

### 2. Circuit Breaker Implementation

```typescript
class InstitutionalCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0
  private nextAttemptTime = 0

  constructor(
    private readonly failureThreshold = 5,
    private readonly recoveryTimeout = 60000, // 1 minute
    private readonly monitoringWindow = 300000 // 5 minutes
  ) {}

  async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerOpenError(
          `Circuit breaker is OPEN for ${operationName}. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`
        )
      }
      this.state = 'HALF_OPEN'
    }

    try {
      const result = await operation()

      if (this.state === 'HALF_OPEN') {
        this.reset()
      }

      return result
    } catch (error) {
      this.recordFailure()

      if (this.shouldTrip()) {
        this.trip()
      }

      throw error
    }
  }

  private recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
  }

  private shouldTrip(): boolean {
    return this.failureCount >= this.failureThreshold
  }

  private trip(): void {
    this.state = 'OPEN'
    this.nextAttemptTime = Date.now() + this.recoveryTimeout

    this.errorHandler.logger.warn('Circuit breaker tripped', {
      failureCount: this.failureCount,
      nextAttemptTime: this.nextAttemptTime
    })
  }

  private reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.lastFailureTime = 0
    this.nextAttemptTime = 0
  }
}
```

## Sentiment Scoring Integration

### 1. Composite Scoring Algorithm

```typescript
interface SentimentWeights {
  institutional: number    // 70% of institutional component
  insider: number         // 30% of institutional component
  overall: number         // 10% of total composite score
}

class InstitutionalSentimentScorer {
  private readonly weights: SentimentWeights = {
    institutional: 0.7,
    insider: 0.3,
    overall: 0.1  // 10% weight in final composite as specified
  }

  /**
   * Calculate institutional sentiment score (0-10 scale)
   * Integrates with existing composite scoring algorithm
   */
  calculateInstitutionalScore(intelligence: InstitutionalIntelligence): ScoredSentiment {
    if (!intelligence) {
      return {
        score: 5.0,           // Neutral score
        confidence: 0.0,      // No confidence
        components: {
          institutional: 5.0,
          insider: 5.0
        },
        reasoning: ['No institutional data available']
      }
    }

    const institutionalScore = this.scoreInstitutionalSentiment(intelligence.institutionalSentiment)
    const insiderScore = this.scoreInsiderSentiment(intelligence.insiderSentiment)

    // Weighted combination of institutional and insider sentiment
    const compositeScore =
      (institutionalScore.score * this.weights.institutional) +
      (insiderScore.score * this.weights.insider)

    // Calculate confidence based on data quality and agreement
    const confidence = this.calculateConfidence(
      intelligence,
      institutionalScore,
      insiderScore
    )

    return {
      score: this.normalizeScore(compositeScore),
      confidence,
      components: {
        institutional: institutionalScore.score,
        insider: insiderScore.score
      },
      reasoning: [
        ...institutionalScore.reasoning,
        ...insiderScore.reasoning
      ],
      metadata: {
        dataQuality: intelligence.dataQuality,
        agreementLevel: this.calculateAgreement(institutionalScore.score, insiderScore.score)
      }
    }
  }

  private scoreInstitutionalSentiment(sentiment?: InstitutionalSentiment): ComponentScore {
    if (!sentiment) {
      return {
        score: 5.0,
        confidence: 0.0,
        reasoning: ['No institutional holdings data']
      }
    }

    const factors = {
      flowScore: this.scoreInstitutionalFlows(sentiment.quarterlyChange),
      ownershipLevel: this.scoreOwnershipLevel(sentiment.institutionalOwnership),
      topHolderActivity: this.scoreTopHolderActivity(sentiment.topHolders),
      diversification: this.scoreDiversification(sentiment.totalInstitutions, sentiment.totalValue)
    }

    const weightedScore =
      (factors.flowScore * 0.4) +          // 40% - most important
      (factors.ownershipLevel * 0.25) +    // 25% - ownership level
      (factors.topHolderActivity * 0.25) + // 25% - top holder changes
      (factors.diversification * 0.1)      // 10% - diversification

    const reasoning = this.generateInstitutionalReasoning(factors, sentiment)

    return {
      score: weightedScore,
      confidence: sentiment.confidence,
      reasoning
    }
  }

  private scoreInstitutionalFlows(quarterlyChange: InstitutionalSentiment['quarterlyChange']): number {
    // Score based on institutional money flows
    const {
      newPositions,
      closedPositions,
      increasedPositions,
      decreasedPositions,
      flowScore
    } = quarterlyChange

    // Base score from flow direction
    let score = 5.0 + (flowScore * 3.0) // Convert -1,1 to 2-8 scale

    // Adjust for activity level
    const totalActivity = newPositions + closedPositions + increasedPositions + decreasedPositions
    if (totalActivity > 50) {
      score += 0.5 // High activity increases conviction
    }

    // Adjust for position creation vs. increases
    const netNewPositions = newPositions - closedPositions
    const netIncreasedPositions = increasedPositions - decreasedPositions

    if (netNewPositions > 0 && netIncreasedPositions > 0) {
      score += 0.5 // Both new positions and increases = strong signal
    }

    return Math.max(1, Math.min(9, score))
  }

  private scoreInsiderSentiment(sentiment?: InsiderSentiment): ComponentScore {
    if (!sentiment) {
      return {
        score: 5.0,
        confidence: 0.0,
        reasoning: ['No insider trading data']
      }
    }

    const factors = {
      netActivity: this.scoreNetInsiderActivity(sentiment),
      recentActivity: this.scoreRecentInsiderActivity(sentiment.recentActivity),
      insiderTypes: this.scoreInsiderTypes(sentiment.insiderTypes),
      transactionSizing: this.scoreTransactionSizing(sentiment)
    }

    const weightedScore =
      (factors.netActivity * 0.4) +        // 40% - net buying/selling
      (factors.recentActivity * 0.3) +     // 30% - recent activity patterns
      (factors.insiderTypes * 0.2) +       // 20% - types of insiders
      (factors.transactionSizing * 0.1)    // 10% - transaction sizing

    const reasoning = this.generateInsiderReasoning(factors, sentiment)

    return {
      score: weightedScore,
      confidence: sentiment.confidence,
      reasoning
    }
  }

  private scoreNetInsiderActivity(sentiment: InsiderSentiment): number {
    const { netShares, netValue, buyTransactions, sellTransactions } = sentiment

    // Base score from net activity
    let score = 5.0

    if (netShares > 0 && netValue > 0) {
      // Net buying
      const buyRatio = buyTransactions / (buyTransactions + sellTransactions)
      score += (buyRatio - 0.5) * 6 // Convert 0.5-1.0 to 0-3 point increase
    } else if (netShares < 0 && netValue < 0) {
      // Net selling
      const sellRatio = sellTransactions / (buyTransactions + sellTransactions)
      score -= (sellRatio - 0.5) * 6 // Convert 0.5-1.0 to 0-3 point decrease
    }

    return Math.max(1, Math.min(9, score))
  }

  /**
   * Integration point with main composite scoring algorithm
   */
  integrateWithCompositeScore(
    technicalScore: number,
    fundamentalScore: number,
    institutionalScore: ScoredSentiment
  ): CompositeScore {
    // Main VFR composite algorithm with institutional integration
    const weights = {
      technical: 0.45,      // 45%
      fundamental: 0.45,    // 45%
      institutional: 0.10   // 10% as specified in requirements
    }

    const compositeScore =
      (technicalScore * weights.technical) +
      (fundamentalScore * weights.fundamental) +
      (institutionalScore.score * weights.institutional)

    // Adjust confidence based on institutional data availability
    const confidenceAdjustment = institutionalScore.confidence * 0.1 // Up to 10% confidence boost

    return {
      score: this.normalizeScore(compositeScore),
      confidence: Math.min(1.0, this.calculateBaseConfidence() + confidenceAdjustment),
      components: {
        technical: technicalScore,
        fundamental: fundamentalScore,
        institutional: institutionalScore.score
      },
      institutionalInsights: institutionalScore.reasoning,
      recommendation: this.getRecommendation(compositeScore),
      riskFactors: this.identifyRiskFactors(institutionalScore),
      opportunities: this.identifyOpportunities(institutionalScore)
    }
  }

  private getRecommendation(score: number): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
    if (score >= 8.0) return 'STRONG_BUY'
    if (score >= 6.5) return 'BUY'
    if (score >= 3.5) return 'HOLD'
    if (score >= 2.0) return 'SELL'
    return 'STRONG_SELL'
  }
}
```

### 2. Real-time Sentiment Updates

```typescript
class RealTimeSentimentProcessor {
  private sentimentCache = new Map<string, TimestampedSentiment>()
  private updateQueue: SentimentUpdate[] = []
  private isProcessing = false

  /**
   * Process real-time filing updates for sentiment scoring
   */
  async processFilingUpdate(filing: FilingNotification): Promise<void> {
    const affectedSymbols = await this.extractAffectedSymbols(filing)

    for (const symbol of affectedSymbols) {
      this.updateQueue.push({
        symbol,
        filingType: filing.formType,
        urgency: this.calculateUpdateUrgency(filing),
        timestamp: Date.now()
      })
    }

    if (!this.isProcessing) {
      setImmediate(() => this.processUpdateQueue())
    }
  }

  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      // Sort by urgency and age
      this.updateQueue.sort((a, b) =>
        (b.urgency * 1000) + (b.timestamp - a.timestamp)
      )

      // Process updates in batches
      const batchSize = 5
      while (this.updateQueue.length > 0) {
        const batch = this.updateQueue.splice(0, batchSize)
        await this.processSentimentBatch(batch)

        // Brief pause between batches to prevent overwhelming the system
        await this.delay(100)
      }
    } finally {
      this.isProcessing = false
    }
  }

  private async processSentimentBatch(updates: SentimentUpdate[]): Promise<void> {
    const processingPromises = updates.map(async (update) => {
      try {
        // Get fresh institutional intelligence
        const intelligence = await this.institutionalService.getInstitutionalIntelligence(update.symbol)

        if (intelligence) {
          // Calculate new sentiment score
          const sentimentScore = this.sentimentScorer.calculateInstitutionalScore(intelligence)

          // Update cache and notify subscribers
          await this.updateSentimentCache(update.symbol, sentimentScore)
          await this.notifySubscribers(update.symbol, sentimentScore)
        }
      } catch (error) {
        this.errorHandler.logger.warn(`Failed to update sentiment for ${update.symbol}`, { error })
      }
    })

    await Promise.allSettled(processingPromises)
  }

  private calculateUpdateUrgency(filing: FilingNotification): number {
    // Higher urgency for more impactful filings
    const urgencyFactors = {
      'Form 4': 0.8,      // High urgency for insider trading
      'Form 5': 0.6,      // Medium urgency for annual insider reports
      '13F-HR': 0.4,      // Lower urgency for quarterly institutional
      '13F-HR/A': 0.5     // Medium urgency for amendments
    }

    let baseUrgency = urgencyFactors[filing.formType] || 0.3

    // Increase urgency for large transactions or significant holders
    if (filing.metadata?.transactionValue > 10000000) { // >$10M
      baseUrgency += 0.2
    }

    if (filing.metadata?.isTopHolder) {
      baseUrgency += 0.3
    }

    return Math.min(1.0, baseUrgency)
  }
}
```

### 3. Sentiment-Based Alerts and Notifications

```typescript
class InstitutionalAlertManager {
  private alertThresholds = {
    SIGNIFICANT_FLOW_CHANGE: 0.8,    // 80% change in flow score
    MAJOR_HOLDER_EXIT: 0.1,          // Top 10 holder reduces position by >10%
    UNUSUAL_INSIDER_ACTIVITY: 3,     // >3 insider transactions in 30 days
    SENTIMENT_REVERSAL: 2.0          // >2 point sentiment change
  }

  async evaluateAlerts(
    symbol: string,
    newSentiment: ScoredSentiment,
    previousSentiment?: ScoredSentiment
  ): Promise<Alert[]> {
    const alerts: Alert[] = []

    if (previousSentiment) {
      // Check for significant sentiment changes
      const sentimentChange = Math.abs(newSentiment.score - previousSentiment.score)
      if (sentimentChange >= this.alertThresholds.SENTIMENT_REVERSAL) {
        alerts.push({
          type: 'SENTIMENT_REVERSAL',
          severity: sentimentChange >= 3.0 ? 'HIGH' : 'MEDIUM',
          symbol,
          title: `Significant Institutional Sentiment Change`,
          message: `Sentiment shifted from ${previousSentiment.score.toFixed(1)} to ${newSentiment.score.toFixed(1)}`,
          data: {
            previousScore: previousSentiment.score,
            newScore: newSentiment.score,
            change: sentimentChange,
            confidence: newSentiment.confidence
          },
          timestamp: Date.now()
        })
      }
    }

    // Check for unusual institutional activity
    const intelligence = await this.getLatestIntelligence(symbol)
    if (intelligence?.institutionalSentiment) {
      const flowScore = Math.abs(intelligence.institutionalSentiment.quarterlyChange.flowScore)
      if (flowScore >= this.alertThresholds.SIGNIFICANT_FLOW_CHANGE) {
        alerts.push({
          type: 'SIGNIFICANT_INSTITUTIONAL_FLOW',
          severity: 'HIGH',
          symbol,
          title: `Unusual Institutional Money Flow`,
          message: `Significant ${flowScore > 0 ? 'inflow' : 'outflow'} detected`,
          data: {
            flowScore: intelligence.institutionalSentiment.quarterlyChange.flowScore,
            netValueChange: intelligence.institutionalSentiment.quarterlyChange.netValueChange,
            institutionCount: intelligence.institutionalSentiment.totalInstitutions
          },
          timestamp: Date.now()
        })
      }
    }

    return alerts
  }

  async broadcastAlert(alert: Alert): Promise<void> {
    // Integration with notification system
    const notification = {
      id: `inst_${alert.symbol}_${Date.now()}`,
      type: 'INSTITUTIONAL_ALERT',
      payload: alert,
      targets: await this.getSubscribersForSymbol(alert.symbol),
      priority: this.mapSeverityToPriority(alert.severity)
    }

    await this.notificationService.broadcast(notification)
  }
}
```

## Summary

This comprehensive architecture provides:

1. **Advanced Caching**: Multi-tier caching with dynamic TTL and intelligent warming
2. **Robust Error Handling**: Circuit breakers, categorized errors, and graceful degradation
3. **Intelligent Sentiment Scoring**: 10% weighted integration with composite algorithm
4. **Real-time Updates**: Live processing of SEC filings for sentiment updates
5. **Alert System**: Automated detection and notification of significant changes

The design ensures optimal performance while maintaining data accuracy and system reliability, seamlessly integrating institutional sentiment into the existing VFR analysis platform.