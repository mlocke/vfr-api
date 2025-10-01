/**
 * Fallback Data Service for Free Price/Volume Data
 * Implements a chain of free data sources with automatic failover
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse, AnalystRatings, PriceTarget, RatingChange, FundamentalRatios, InstitutionalIntelligence, InstitutionalHolding, InsiderTransaction } from './types'
import { FinancialModelingPrepAPI } from './FinancialModelingPrepAPI'
import { EODHDAPI } from './EODHDAPI'
import { InstitutionalDataService } from './InstitutionalDataService'
import { FMPCacheManager } from './FMPCacheManager'
import SecurityValidator from '../security/SecurityValidator'
import { createServiceErrorHandler, ErrorType, ErrorCode } from '../error-handling'

interface DataSourceConfig {
  name: string
  provider: FinancialDataProvider
  priority: number
  isFree: boolean
  rateLimit: number // requests per minute
  dailyLimit?: number // daily request limit
}

export class FinancialDataService implements FinancialDataProvider {
  name = 'Financial Data Service'
  private dataSources: DataSourceConfig[] = []
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map()
  private dailyCounts: Map<string, { count: number; date: string }> = new Map()
  private sourcesUsedInSession: Set<string> = new Set() // 🆕 Track actual sources used
  private fmpRequestQueue: Array<{ resolve: Function; reject: Function; timestamp: number }> = []
  private fmpProcessingQueue = false
  private errorHandler = createServiceErrorHandler('FinancialDataService')
  private institutionalDataService: InstitutionalDataService
  private fmpCacheManager: FMPCacheManager

  constructor() {
    this.institutionalDataService = new InstitutionalDataService()
    this.fmpCacheManager = new FMPCacheManager()
    this.initializeDataSources()
  }

  private initializeDataSources(): void {
    // Authorized APIs only: FMP (Primary) and EODHD (Fallback)
    // Priority order: FMP → EODHD

    // 1. FMP - Primary data source (Priority 1)
    if (process.env.FMP_API_KEY) {
      this.dataSources.push({
        name: 'Financial Modeling Prep',
        provider: new FinancialModelingPrepAPI(),
        priority: 1,
        isFree: false,
        rateLimit: 300, // 300 requests/minute
        dailyLimit: undefined // No daily limit on paid plans
      })

      this.errorHandler.logger.info('FMP initialized as primary data source', {
        rateLimit: '300/minute',
        priority: 1
      })
    }

    // 2. EODHD - NOT USED FOR FUNDAMENTALS/MARKET DATA (Options-only subscription)
    // EODHD is used exclusively by OptionsDataService for options chain data
    // Fundamental and market data fallback removed due to subscription tier limitations

    // Sort by priority
    this.dataSources.sort((a, b) => a.priority - b.priority)

    this.errorHandler.logger.info(`Financial Data Service initialized with ${this.dataSources.length} authorized sources`, {
      sources: this.dataSources.map(ds => ({
        priority: ds.priority,
        name: ds.name,
        rateLimit: ds.rateLimit
      }))
    })
  }

  /**
   * Get FMP source configuration if available
   */
  private getFMPSource(): DataSourceConfig | null {
    return this.dataSources.find(source => source.name === 'Financial Modeling Prep') || null
  }

  /**
   * Enhanced FMP rate limit management with burst capacity optimization
   * Supports 300 req/min (5 req/sec) with intelligent burst handling
   */
  private canMakeFMPRequest(): boolean {
    const fmpSource = this.getFMPSource()
    if (!fmpSource) return false

    const now = Date.now()
    const windowSize = 60000 // 1 minute window
    const maxRequests = fmpSource.rateLimit // 300 for starter plan

    // Enhanced burst capacity for FMP Starter (allow short bursts up to 10 req/sec)
    const burstWindow = 10000 // 10 second burst window
    const maxBurstRequests = Math.min(Math.floor(maxRequests / 6), 50) // Max 50 requests per 10s burst

    // Get current window requests
    const rateInfo = this.requestCounts.get(fmpSource.name) || { count: 0, resetTime: now + windowSize }
    const burstKey = `${fmpSource.name}_burst`
    const burstInfo = this.requestCounts.get(burstKey) || { count: 0, resetTime: now + burstWindow }

    // Reset windows if expired
    if (now >= rateInfo.resetTime) {
      rateInfo.count = 0
      rateInfo.resetTime = now + windowSize
      this.requestCounts.set(fmpSource.name, rateInfo)
    }

    if (now >= burstInfo.resetTime) {
      burstInfo.count = 0
      burstInfo.resetTime = now + burstWindow
      this.requestCounts.set(burstKey, burstInfo)
    }

    // Check both minute-level and burst-level limits
    const safetyMargin = Math.floor(maxRequests * 0.95) // 95% of 300 = 285 requests/min
    const burstSafetyMargin = Math.floor(maxBurstRequests * 0.9) // 90% of burst capacity

    const minuteLimitOk = rateInfo.count < safetyMargin
    const burstLimitOk = burstInfo.count < burstSafetyMargin
    const canMakeRequest = minuteLimitOk && burstLimitOk

    if (!canMakeRequest) {
      const limitType = !minuteLimitOk ? 'minute' : 'burst'
      const currentCount = !minuteLimitOk ? rateInfo.count : burstInfo.count
      const limitValue = !minuteLimitOk ? safetyMargin : burstSafetyMargin
      const resetTime = !minuteLimitOk ? rateInfo.resetTime : burstInfo.resetTime

      this.errorHandler.logger.debug(`FMP ${limitType} limit approached: ${currentCount}/${limitValue}`, {
        limitType,
        remaining: limitValue - currentCount,
        resetInSeconds: Math.ceil((resetTime - now) / 1000),
        minuteUsage: `${rateInfo.count}/${safetyMargin}`,
        burstUsage: `${burstInfo.count}/${burstSafetyMargin}`
      })
    }

    return canMakeRequest
  }

  /**
   * Enhanced FMP request queue processing with adaptive throttling
   * Optimized for 300/min capacity with intelligent burst management
   */
  private async processFMPQueue(): Promise<void> {
    if (this.fmpProcessingQueue || this.fmpRequestQueue.length === 0) return

    this.fmpProcessingQueue = true
    const fmpSource = this.getFMPSource()

    if (!fmpSource) {
      this.fmpProcessingQueue = false
      return
    }

    // Adaptive concurrency based on FMP plan capacity
    const planCapacity = fmpSource.rateLimit
    const maxConcurrent = Math.min(
      planCapacity >= 300 ? 8 : 5, // Higher concurrency for Starter+ plans
      Math.ceil(this.fmpRequestQueue.length / 4) // Scale with queue size
    )

    // Dynamic delay calculation for optimal throughput
    const baseDelay = planCapacity >= 300 ? 250 : 400 // Faster for Starter plans
    const delayBetweenRequests = Math.max(baseDelay, 60000 / planCapacity * 1.1) // 10% buffer

    this.errorHandler.logger.debug(`Processing FMP queue`, {
      queueLength: this.fmpRequestQueue.length,
      maxConcurrent,
      delayMs: delayBetweenRequests,
      planCapacity: `${planCapacity}/min`
    })

    let processedCount = 0
    while (this.fmpRequestQueue.length > 0 && this.canMakeFMPRequest()) {
      const batchSize = Math.min(maxConcurrent, this.fmpRequestQueue.length)
      const batch = this.fmpRequestQueue.splice(0, batchSize)

      // Process batch with intelligent staggering
      const promises = batch.map((request, index) =>
        new Promise(resolve =>
          setTimeout(() => {
            // Update both minute and burst counters
            this.recordFMPRequest(fmpSource)
            request.resolve()
            resolve(void 0)
            processedCount++
          }, index * (delayBetweenRequests / batchSize))
        )
      )

      await Promise.all(promises)

      // Adaptive pause between batches based on remaining capacity
      if (this.fmpRequestQueue.length > 0) {
        const remainingCapacity = this.getFMPRemainingCapacity()
        const adaptiveDelay = remainingCapacity > 0.5 ? delayBetweenRequests * 0.5 : delayBetweenRequests
        await new Promise(resolve => setTimeout(resolve, adaptiveDelay))
      }
    }

    this.errorHandler.logger.info(`FMP queue processing completed`, {
      requestsProcessed: processedCount,
      remainingInQueue: this.fmpRequestQueue.length,
      utilizationRate: this.getFMPUtilizationRate()
    })

    this.fmpProcessingQueue = false
  }

  /**
   * Check if we can make a request to a specific data source
   */
  private canMakeRequest(source: DataSourceConfig): boolean {
    const now = Date.now()
    const today = new Date().toDateString()

    // Check rate limit (per minute)
    const rateInfo = this.requestCounts.get(source.name) || { count: 0, resetTime: now + 60000 }
    if (now > rateInfo.resetTime) {
      rateInfo.count = 0
      rateInfo.resetTime = now + 60000
    }
    if (rateInfo.count >= source.rateLimit) {
      console.log(`⚠️ Rate limit reached for ${source.name}: ${rateInfo.count}/${source.rateLimit} per minute`)
      return false
    }

    // Check daily limit if applicable
    if (source.dailyLimit) {
      const dailyInfo = this.dailyCounts.get(source.name) || { count: 0, date: today }
      if (dailyInfo.date !== today) {
        dailyInfo.count = 0
        dailyInfo.date = today
      }
      if (dailyInfo.count >= source.dailyLimit) {
        console.log(`⚠️ Daily limit reached for ${source.name}: ${dailyInfo.count}/${source.dailyLimit}`)
        return false
      }
    }

    return true
  }

  /**
   * Record a request for rate limiting
   */
  private recordRequest(source: DataSourceConfig): void {
    const now = Date.now()
    const today = new Date().toDateString()

    // Update rate limit counter
    const rateInfo = this.requestCounts.get(source.name) || { count: 0, resetTime: now + 60000 }
    rateInfo.count++
    this.requestCounts.set(source.name, rateInfo)

    // Update daily counter if applicable
    if (source.dailyLimit) {
      const dailyInfo = this.dailyCounts.get(source.name) || { count: 0, date: today }
      if (dailyInfo.date !== today) {
        dailyInfo.count = 1
        dailyInfo.date = today
      } else {
        dailyInfo.count++
      }
      this.dailyCounts.set(source.name, dailyInfo)
    }
  }

  /**
   * Enhanced FMP-specific request recording with burst tracking
   */
  private recordFMPRequest(source: DataSourceConfig): void {
    const now = Date.now()
    const today = new Date().toDateString()

    // Record minute-level usage
    const rateInfo = this.requestCounts.get(source.name) || { count: 0, resetTime: now + 60000 }
    rateInfo.count++
    this.requestCounts.set(source.name, rateInfo)

    // Record burst-level usage (10-second window)
    const burstKey = `${source.name}_burst`
    const burstInfo = this.requestCounts.get(burstKey) || { count: 0, resetTime: now + 10000 }
    burstInfo.count++
    this.requestCounts.set(burstKey, burstInfo)

    // Update daily counter if applicable
    if (source.dailyLimit) {
      const dailyInfo = this.dailyCounts.get(source.name) || { count: 0, date: today }
      if (dailyInfo.date !== today) {
        dailyInfo.count = 1
        dailyInfo.date = today
      } else {
        dailyInfo.count++
      }
      this.dailyCounts.set(source.name, dailyInfo)
    }
  }

  /**
   * Get FMP remaining capacity as percentage (0-1)
   */
  private getFMPRemainingCapacity(): number {
    const fmpSource = this.getFMPSource()
    if (!fmpSource) return 0

    const rateInfo = this.requestCounts.get(fmpSource.name) || { count: 0, resetTime: 0 }
    const safetyMargin = Math.floor(fmpSource.rateLimit * 0.95)
    return Math.max(0, (safetyMargin - rateInfo.count) / safetyMargin)
  }

  /**
   * Get FMP utilization rate as percentage string
   */
  private getFMPUtilizationRate(): string {
    const fmpSource = this.getFMPSource()
    if (!fmpSource) return '0%'

    const rateInfo = this.requestCounts.get(fmpSource.name) || { count: 0, resetTime: 0 }
    const utilizationRate = (rateInfo.count / fmpSource.rateLimit) * 100
    return `${utilizationRate.toFixed(1)}%`
  }

  /**
   * Get list of data sources actually used in this session
   */
  getSourcesUsed(): string[] {
    return Array.from(this.sourcesUsedInSession)
  }

  /**
   * Reset sources used tracking (useful for new analysis sessions)
   */
  resetSourcesUsed(): void {
    this.sourcesUsedInSession.clear()
  }

  /**
   * Get stock price with automatic fallback and security controls
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    // Early validation check to return null for invalid symbols
    const symbolValidation = SecurityValidator.validateSymbol(symbol)
    if (!symbolValidation.isValid) {
      this.errorHandler.logger.warn(`Invalid symbol for stock price: ${symbol}`, {
        errors: symbolValidation.errors
      })
      return null
    }

    // Check rate limiting before execution
    const serviceId = `stock_price_${symbolValidation.sanitized}`
    const rateLimitCheck = SecurityValidator.checkRateLimit(serviceId)
    if (!rateLimitCheck.allowed) {
      this.errorHandler.logger.warn(`Rate limit exceeded for stock price: ${symbol}`)
      return null
    }

    // Check circuit breaker
    const circuitCheck = SecurityValidator.checkCircuitBreaker(serviceId)
    if (!circuitCheck.allowed) {
      this.errorHandler.logger.warn(`Circuit breaker open for stock price: ${symbol}`)
      return null
    }

    return this.errorHandler.validateAndExecute(
      () => this.executeGetStockPrice(symbolValidation.sanitized!),
      [symbolValidation.sanitized!],
      {
        timeout: 30000,
        retries: 2,
        context: 'getStockPrice'
      }
    ).catch(error => {
      this.errorHandler.logger.warn(`Failed to get stock price for ${symbol}`, { error })
      return null
    })
  }

  private async executeGetStockPrice(symbol: string): Promise<StockData | null> {
    const sanitizedSymbol = symbol.toUpperCase()
    const errors: string[] = []

    // Use dynamic source selection for optimal performance
    const optimalSources = this.getOptimalDataSource('stock_price')
    const sourcesToTry = optimalSources.length > 0 ? optimalSources : this.dataSources

    for (const source of sourcesToTry) {
      // Check rate limits
      if (!this.canMakeRequest(source)) {
        errors.push(`${source.name}: Rate limited`)
        continue
      }

      try {
        this.errorHandler.logger.debug(`Trying ${source.name} for ${sanitizedSymbol}`)

        const startTime = Date.now()
        const data = await this.errorHandler.handleApiCall(
          () => source.provider.getStockPrice(sanitizedSymbol),
          {
            timeout: 15000,
            retries: 1,
            context: `${source.name}_getStockPrice`
          }
        )

        if (data) {
          // Validate response structure
          const responseValidation = SecurityValidator.validateApiResponse(data, [
            'symbol', 'price', 'timestamp', 'source'
          ])

          if (!responseValidation.isValid) {
            this.errorHandler.logger.warn(`Invalid stock price response from ${source.name}`, {
              errors: responseValidation.errors,
              symbol: sanitizedSymbol
            })
            continue
          }

          // Validate numeric values
          const priceValidation = SecurityValidator.validateNumeric(data.price, {
            min: 0,
            max: 100000,
            decimalPlaces: 4
          })

          if (!priceValidation.isValid) {
            this.errorHandler.logger.warn(`Invalid price value for ${sanitizedSymbol}`, {
              errors: priceValidation.errors,
              price: data.price
            })
            continue
          }

          this.recordRequest(source)
          const responseTime = Date.now() - startTime
          this.errorHandler.logger.logPerformance(
            `${source.name}_getStockPrice`,
            responseTime,
            undefined,
            { symbol: sanitizedSymbol, source: source.name }
          )

          this.errorHandler.errorHandler.recordSuccess(`stock_price_${sanitizedSymbol}`)
          // Add metadata about which source was used
          const sourceId = source.name.toLowerCase().replace(/\s+/g, '_')
          this.sourcesUsedInSession.add(sourceId) // 🆕 Track source usage
          return {
            ...data,
            source: sourceId
          }
        } else {
          errors.push(`${source.name}: No data returned`)
        }
      } catch (error) {
        const sanitizedError = SecurityValidator.sanitizeErrorMessage(error, true)
        errors.push(`${source.name}: ${sanitizedError}`)
        this.errorHandler.logger.logApiError(
          'GET',
          'stock_price',
          error,
          undefined,
          { symbol: sanitizedSymbol, source: source.name }
        )
      }
    }

    // All sources failed
    this.errorHandler.errorHandler.recordFailure(`stock_price_${sanitizedSymbol}`)
    this.errorHandler.logger.error(`All data sources failed for ${sanitizedSymbol}`, {
      errors,
      symbolSanitized: sanitizedSymbol,
      sourcesAttempted: this.dataSources.length
    })
    return null
  }

  /**
   * Get company info with fallback
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    return this.errorHandler.validateAndExecute(
      () => this.executeGetCompanyInfo(symbol),
      [symbol],
      {
        timeout: 20000,
        retries: 1,
        context: 'getCompanyInfo'
      }
    ).catch(error => {
      this.errorHandler.logger.warn(`Failed to get company info for ${symbol}`, { error })
      return null
    })
  }

  private async executeGetCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    // Use dynamic source selection
    const optimalSources = this.getOptimalDataSource('company_info')
    const sourcesToTry = optimalSources.length > 0 ? optimalSources : this.dataSources

    for (const source of sourcesToTry) {
      if (!this.canMakeRequest(source)) continue

      try {
        const data = await this.errorHandler.handleApiCall(
          () => source.provider.getCompanyInfo(symbol),
          {
            timeout: 15000,
            retries: 1,
            context: `${source.name}_getCompanyInfo`
          }
        )
        if (data) {
          this.recordRequest(source)
          // 🔧 FIX: Override source field to track actual source used
          const sourceId = source.name.toLowerCase().replace(/\s+/g, '_')
          this.sourcesUsedInSession.add(sourceId)
          return {
            ...data,
            source: sourceId
          }
        }
      } catch (error) {
        this.errorHandler.logger.logApiError(
          'GET',
          'company_info',
          error,
          undefined,
          { symbol, source: source.name }
        )
      }
    }
    return null
  }

  /**
   * Get market data with fallback
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    return this.errorHandler.validateAndExecute(
      () => this.executeGetMarketData(symbol),
      [symbol],
      {
        timeout: 20000,
        retries: 1,
        context: 'getMarketData'
      }
    ).catch(error => {
      this.errorHandler.logger.warn(`Failed to get market data for ${symbol}`, { error })
      return null
    })
  }

  private async executeGetMarketData(symbol: string): Promise<MarketData | null> {
    // Use dynamic source selection
    const optimalSources = this.getOptimalDataSource('market_data')
    const sourcesToTry = optimalSources.length > 0 ? optimalSources : this.dataSources

    for (const source of sourcesToTry) {
      if (!this.canMakeRequest(source)) continue

      try {
        const data = await this.errorHandler.handleApiCall(
          () => source.provider.getMarketData(symbol),
          {
            timeout: 15000,
            retries: 1,
            context: `${source.name}_getMarketData`
          }
        )
        if (data) {
          this.recordRequest(source)
          // 🔧 FIX: Override source field to track actual source used
          const sourceId = source.name.toLowerCase().replace(/\s+/g, '_')
          this.sourcesUsedInSession.add(sourceId)
          return {
            ...data,
            source: sourceId
          }
        }
      } catch (error) {
        this.errorHandler.logger.logApiError(
          'GET',
          'market_data',
          error,
          undefined,
          { symbol, source: source.name }
        )
      }
    }
    return null
  }

  /**
   * Batch get stock prices with security controls and parallel optimization
   */
  async getBatchPrices(symbols: string[]): Promise<Map<string, StockData>> {
    // Validate batch request
    const batchValidation = SecurityValidator.validateSymbolBatch(symbols, 50)
    if (!batchValidation.isValid) {
      const sanitizedError = SecurityValidator.sanitizeErrorMessage(
        `Invalid batch request: ${batchValidation.errors.join(', ')}`
      )
      console.warn(sanitizedError)
      return new Map()
    }

    const sanitizedSymbols = JSON.parse(batchValidation.sanitized!) as string[]
    const serviceId = `batch_prices_${sanitizedSymbols.length}`
    const results = new Map<string, StockData>()

    // Check rate limiting for batch operation
    const rateLimitCheck = SecurityValidator.checkRateLimit(serviceId)
    if (!rateLimitCheck.allowed) {
      const resetTime = rateLimitCheck.resetTime ? new Date(rateLimitCheck.resetTime).toISOString() : 'unknown'
      console.warn(`Rate limit exceeded for batch prices, reset at: ${resetTime}`)
      return new Map()
    }

    // Get available sources with batch capabilities
    const batchSources = this.dataSources.filter(source =>
      this.canMakeRequest(source) &&
      'getBatchPrices' in source.provider &&
      typeof (source.provider as any).getBatchPrices === 'function'
    )

    // Try batch sources in parallel for fastest response
    if (batchSources.length > 0) {
      const batchPromises = batchSources.map(async (source) => {
        try {
          console.log(`🔄 Trying batch fetch from ${source.name} for ${sanitizedSymbols.length} symbols...`)
          const batchData = await (source.provider as any).getBatchPrices(sanitizedSymbols)

          if (batchData.size > 0) {
            this.recordRequest(source)
            console.log(`✅ ${source.name} batch fetch returned ${batchData.size} symbols`)
            return { data: batchData, source }
          }
          return null
        } catch (error) {
          const sanitizedError = SecurityValidator.sanitizeErrorMessage(error)
          console.error(`${source.name} batch fetch failed:`, sanitizedError)
          return null
        }
      })

      // Use Promise.allSettled to get best available data
      const batchResults = await Promise.allSettled(batchPromises)

      // Merge successful batch results (prioritize by data source priority)
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value?.data) {
          const { data: batchData, source } = result.value
          batchData.forEach((data: StockData, symbol: string) => {
            if (!results.has(symbol)) { // Don't overwrite higher priority data
              // Validate each stock data item
              const validation = SecurityValidator.validateApiResponse(data, [
                'symbol', 'price', 'timestamp'
              ])

              if (validation.isValid) {
                // Also validate the price value
                const priceValidation = SecurityValidator.validateNumeric(data.price, {
                  min: 0,
                  max: 100000,
                  decimalPlaces: 4
                })

                if (priceValidation.isValid) {
                  results.set(symbol, {
                    ...data,
                    source: source.name.toLowerCase().replace(/\s+/g, '_')
                  })
                }
              }
            }
          })
        }
      }
    }

    // Parallel fallback for missing symbols using individual requests
    const missingSymbols = sanitizedSymbols.filter(s => !results.has(s))
    if (missingSymbols.length > 0 && missingSymbols.length <= 10) { // Limit parallel individual requests
      const individualPromises = missingSymbols.map(async (symbol) => {
        const data = await this.getStockPrice(symbol)
        return data ? { symbol, data } : null
      })

      const individualResults = await Promise.allSettled(individualPromises)
      individualResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          results.set(result.value.symbol, result.value.data)
        }
      })
    } else if (missingSymbols.length > 10) {
      // Sequential fallback for large batches to avoid overwhelming APIs
      for (const symbol of missingSymbols) {
        const data = await this.getStockPrice(symbol)
        if (data) {
          results.set(symbol, data)
        }
      }
    }

    SecurityValidator.recordSuccess(serviceId)
    return results
  }

  /**
   * Health check - returns true if at least one source is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.errorHandler.handleApiCall(
        () => this.executeHealthCheck(),
        {
          timeout: 10000,
          retries: 0,
          context: 'healthCheck'
        }
      )
    } catch (error) {
      this.errorHandler.logger.warn('Health check failed', { error })
      return false
    }
  }

  private async executeHealthCheck(): Promise<boolean> {
    const healthChecks = this.dataSources.map(async (source) => {
      try {
        const isHealthy = await this.errorHandler.timeoutHandler.withTimeout(
          source.provider.healthCheck(),
          5000
        )
        return isHealthy && this.canMakeRequest(source)
      } catch {
        return false
      }
    })

    const results = await Promise.allSettled(healthChecks)
    return results.some(result => result.status === 'fulfilled' && result.value === true)
  }

  /**
   * Dynamic data source switching based on real-time capacity
   */
  private getOptimalDataSource(dataType: 'stock_price' | 'fundamental_ratios' | 'company_info' | 'market_data'): DataSourceConfig[] {
    const now = Date.now()
    const today = new Date().toDateString()

    // Get all sources that support the data type
    const candidateSources = this.dataSources.filter(source => {
      // Check if source supports the requested data type
      const supportsDataType = this.sourceSupportsDataType(source, dataType)
      return supportsDataType && this.canMakeRequest(source)
    })

    if (candidateSources.length === 0) {
      this.errorHandler.logger.warn(`No available sources for ${dataType}`)
      return []
    }

    // Score sources based on capacity, reliability, and current usage
    const scoredSources = candidateSources.map(source => {
      // INVERTED: Lower priority numbers get higher base scores (priority 1 = highest priority)
      let score = (10 - source.priority) * 10 // Base priority score (priority 1 = 90 points, priority 5 = 50 points)

      // Capacity scoring - higher capacity gets better score
      const rateInfo = this.requestCounts.get(source.name) || { count: 0, resetTime: now }
      const capacityUtilization = rateInfo.count / source.rateLimit
      const capacityScore = Math.max(0, (1 - capacityUtilization) * 20) // 0-20 points

      // Daily limit scoring if applicable
      let dailyScore = 10 // Default for unlimited
      if (source.dailyLimit) {
        const dailyInfo = this.dailyCounts.get(source.name) || { count: 0, date: today }
        const dailyUtilization = dailyInfo.count / source.dailyLimit
        dailyScore = Math.max(0, (1 - dailyUtilization) * 10) // 0-10 points
      }

      // FMP Starter Plan bonus scoring
      const isFMPStarter = source.name === 'Financial Modeling Prep' && source.rateLimit >= 300
      const starterBonus = isFMPStarter ? 25 : 0 // Extra points for starter plan (increased to ensure FMP priority)

      score += capacityScore + dailyScore + starterBonus

      return { source, score, capacityUtilization, dailyUtilization: source.dailyLimit ? (this.dailyCounts.get(source.name)?.count || 0) / source.dailyLimit : 0 }
    })

    // Sort by score (higher is better) and return sources
    const sortedSources = scoredSources
      .sort((a, b) => b.score - a.score)
      .map(item => item.source)

    // Log the selection for debugging
    this.errorHandler.logger.debug(`Optimal source selection for ${dataType}`, {
      selectedSources: sortedSources.map(s => ({
        name: s.name,
        priority: s.priority,
        rateLimit: s.rateLimit,
        currentUsage: this.requestCounts.get(s.name)?.count || 0
      })).slice(0, 3), // Show top 3
      totalAvailable: sortedSources.length
    })

    return sortedSources
  }

  /**
   * Check if a data source supports a specific data type
   */
  private sourceSupportsDataType(source: DataSourceConfig, dataType: string): boolean {
    const supportMap: Record<string, string[]> = {
      'Financial Modeling Prep': ['stock_price', 'company_info', 'fundamental_ratios', 'market_data', 'analyst_ratings', 'price_targets'],
      'EODHD API': ['stock_price', 'company_info', 'fundamental_ratios', 'market_data', 'options_data']
    }

    return supportMap[source.name]?.includes(dataType) || false
  }

  /**
   * Get current source availability status with enhanced metrics
   */
  getSourceStatus(): Array<{
    name: string
    available: boolean
    rateLimit: { current: number; limit: number }
    dailyLimit?: { current: number; limit: number }
    healthScore: number
    recommendedFor: string[]
  }> {
    const now = Date.now()
    const today = new Date().toDateString()

    return this.dataSources.map(source => {
      const rateInfo = this.requestCounts.get(source.name) || { count: 0, resetTime: now }
      const dailyInfo = source.dailyLimit
        ? this.dailyCounts.get(source.name) || { count: 0, date: today }
        : undefined

      // Reset counters if needed
      if (now > rateInfo.resetTime) {
        rateInfo.count = 0
      }
      if (dailyInfo && dailyInfo.date !== today) {
        dailyInfo.count = 0
      }

      // Calculate health score (0-100)
      const rateUtilization = rateInfo.count / source.rateLimit
      const dailyUtilization = source.dailyLimit ? (dailyInfo?.count || 0) / source.dailyLimit : 0
      const avgUtilization = (rateUtilization + dailyUtilization) / 2
      const healthScore = Math.round(Math.max(0, (1 - avgUtilization) * 100))

      // Determine what this source is recommended for based on capacity and capabilities
      const recommendedFor: string[] = []
      if (source.name === 'Financial Modeling Prep') {
        recommendedFor.push('Primary data source', 'Fundamental data', 'Batch processing', 'Analyst ratings')
      } else if (source.name === 'EODHD API') {
        recommendedFor.push('Fallback data source', 'Options data', 'Market data', 'EOD pricing')
      }

      return {
        name: source.name,
        available: this.canMakeRequest(source),
        rateLimit: {
          current: rateInfo.count,
          limit: source.rateLimit
        },
        dailyLimit: source.dailyLimit ? {
          current: dailyInfo?.count || 0,
          limit: source.dailyLimit
        } : undefined,
        healthScore,
        recommendedFor
      }
    })
  }

  /**
   * Get stocks by sector
   */
  async getStocksBySector(sector: string, limit?: number): Promise<StockData[]> {
    // Try available sources in priority order
    for (const source of this.dataSources) {
      if (!this.canMakeRequest(source)) continue

      try {
        const stocks = await source.provider.getStocksBySector?.(sector, limit)
        if (stocks && stocks.length > 0) {
          this.recordRequest(source)
          return stocks
        }
      } catch (error) {
        this.errorHandler.logger.warn(`${source.name} sector fetch failed`, { error, sector })
        continue
      }
    }

    return []
  }

  /**
   * Get analyst ratings with fallback (FMP only)
   */
  async getAnalystRatings(symbol: string): Promise<AnalystRatings | null> {
    // Only FMP supports analyst ratings
    const fmpSource = this.dataSources.find(source => source.name === 'Financial Modeling Prep')

    if (!fmpSource || !this.canMakeRequest(fmpSource)) {
      this.errorHandler.logger.warn(`FMP not available for analyst ratings: ${symbol}`)
      return null
    }

    try {
      if (fmpSource.provider.getAnalystRatings) {
        const data = await fmpSource.provider.getAnalystRatings(symbol)
        if (data) {
          this.recordRequest(fmpSource)
          this.errorHandler.logger.info(`Analyst ratings from FMP for ${symbol}`, {
            consensus: data.consensus,
            totalAnalysts: data.totalAnalysts
          })
          return data
        }
      }
    } catch (error) {
      this.errorHandler.logger.error(`FMP analyst ratings failed for ${symbol}`, { error })
    }

    return null
  }

  /**
   * Get price targets (FMP only)
   */
  async getPriceTargets(symbol: string): Promise<PriceTarget | null> {
    const fmpSource = this.dataSources.find(source => source.name === 'Financial Modeling Prep')

    if (!fmpSource || !this.canMakeRequest(fmpSource)) {
      this.errorHandler.logger.warn(`FMP not available for price targets: ${symbol}`)
      return null
    }

    try {
      if (fmpSource.provider.getPriceTargets) {
        const data = await fmpSource.provider.getPriceTargets(symbol)
        if (data) {
          this.recordRequest(fmpSource)
          this.errorHandler.logger.info(`Price targets from FMP for ${symbol}`, {
            targetConsensus: data.targetConsensus,
            upside: data.upside
          })
          return data
        }
      }
    } catch (error) {
      this.errorHandler.logger.error(`FMP price targets failed for ${symbol}`, { error })
    }

    return null
  }

  /**
   * Get recent rating changes (FMP only)
   */
  async getRecentRatingChanges(symbol: string, limit = 10): Promise<RatingChange[]> {
    const fmpSource = this.dataSources.find(source => source.name === 'Financial Modeling Prep')

    if (!fmpSource || !this.canMakeRequest(fmpSource)) {
      this.errorHandler.logger.warn(`FMP not available for rating changes: ${symbol}`)
      return []
    }

    try {
      if (fmpSource.provider.getRecentRatingChanges) {
        const data = await fmpSource.provider.getRecentRatingChanges(symbol, limit)
        if (data && data.length > 0) {
          this.recordRequest(fmpSource)
          this.errorHandler.logger.info(`Rating changes from FMP for ${symbol}`, {
            count: data.length
          })
          return data
        }
      }
    } catch (error) {
      this.errorHandler.logger.error(`FMP rating changes failed for ${symbol}`, { error })
    }

    return []
  }

  /**
   * Batch get fundamental ratios for multiple symbols with FMP optimization
   */
  async getBatchFundamentalRatios(symbols: string[]): Promise<Map<string, FundamentalRatios>> {
    try {
      const results = new Map<string, FundamentalRatios>()

      // Validate batch request
      const batchValidation = SecurityValidator.validateSymbolBatch(symbols, 100)
      if (!batchValidation.isValid) {
        this.errorHandler.logger.warn('Invalid batch fundamental ratios request', {
          errors: batchValidation.errors
        })
        return results
      }

      const sanitizedSymbols = JSON.parse(batchValidation.sanitized!) as string[]

      // Check cache for existing data first
      const cacheKeys = sanitizedSymbols.map(symbol =>
        this.fmpCacheManager.generateKey(symbol, 'fundamental_ratios')
      )
      const cachedResults = this.fmpCacheManager.getBatch<FundamentalRatios>(cacheKeys, 'fundamental_ratios')

      // Map cached results by symbol
      cacheKeys.forEach((key, index) => {
        const cachedData = cachedResults.get(key)
        if (cachedData) {
          results.set(sanitizedSymbols[index], cachedData)
        }
      })

      // Get remaining symbols that need fetching
      const symbolsToFetch = sanitizedSymbols.filter(symbol => !results.has(symbol))

      if (symbolsToFetch.length === 0) {
        this.errorHandler.logger.info(`All batch fundamental ratios served from cache`, {
          totalSymbols: sanitizedSymbols.length,
          cacheHitRate: '100%'
        })
        return results
      }

      this.errorHandler.logger.info(`Batch cache performance`, {
        totalRequested: sanitizedSymbols.length,
        servedFromCache: results.size,
        needFetching: symbolsToFetch.length,
        cacheHitRate: `${((results.size / sanitizedSymbols.length) * 100).toFixed(1)}%`
      })

      // Get FMP capacity and optimize batch processing
      const fmpCapacity = this.getFmpCapacity()
      const fmpSource = this.getFMPSource()

      if (fmpSource && this.canMakeFMPRequest() && (fmpCapacity.isStarterPlan || fmpCapacity.isProfessionalPlan)) {
        this.errorHandler.logger.info(`Using enhanced FMP batch processing for ${symbolsToFetch.length} symbols`, {
          planType: fmpCapacity.isProfessionalPlan ? 'professional' : 'starter',
          rateLimit: `${fmpCapacity.rateLimit}/min`,
          optimalBatchSize: fmpCapacity.optimalBatchSize,
          burstCapacity: fmpCapacity.burstCapacity,
          batchOptimized: true
        })

        const fmpAPI = fmpSource.provider as FinancialModelingPrepAPI
        if (typeof fmpAPI.getBatchFundamentalRatios === 'function') {
          const fmpResults = await fmpAPI.getBatchFundamentalRatios(symbolsToFetch)

          // Record successful batch operation and cache results
          if (fmpResults.size > 0) {
            this.recordRequest(fmpSource)

            // Cache the new results
            const cacheEntries = Array.from(fmpResults.entries()).map(([symbol, data]) => ({
              key: this.fmpCacheManager.generateKey(symbol, 'fundamental_ratios'),
              data,
              dataType: 'fundamental_ratios'
            }))
            this.fmpCacheManager.setBatch(cacheEntries)

            // Merge with cached results
            fmpResults.forEach((data, symbol) => {
              results.set(symbol, data)
            })

            this.errorHandler.logger.info(`FMP batch completed with caching`, {
              fetchedNew: fmpResults.size,
              servedFromCache: results.size - fmpResults.size,
              totalReturned: results.size
            })

            return results
          }
        }
      }

      // Fallback to individual requests with controlled concurrency
      this.errorHandler.logger.info('Using fallback individual processing for fundamental ratios', {
        symbolCount: sanitizedSymbols.length,
        reason: !fmpSource ? 'No FMP source' : 'FMP unavailable or rate limited'
      })

      const maxConcurrent = 5
      const promises = sanitizedSymbols.map(symbol =>
        this.getFundamentalRatios(symbol).then(ratios =>
          ratios ? { symbol, ratios } : null
        ).catch(() => null)
      )

      // Process with concurrency control
      const batchPromises: Promise<{ symbol: string; ratios: FundamentalRatios } | null>[][] = []
      for (let i = 0; i < promises.length; i += maxConcurrent) {
        batchPromises.push(promises.slice(i, i + maxConcurrent))
      }

      for (const batch of batchPromises) {
        const batchResults = await Promise.allSettled(batch)
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            results.set(result.value.symbol, result.value.ratios)
          }
        })

        // Brief delay between batches
        if (results.size < sanitizedSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      return results
    } catch (error) {
      this.errorHandler.logger.error('Batch fundamental ratios failed', { error })
      return new Map()
    }
  }

  /**
   * Get fundamental ratios with comprehensive security controls
   */
  async getFundamentalRatios(symbol: string): Promise<FundamentalRatios | null> {
    try {
      // Validate symbol input first - return null for invalid symbols instead of throwing
      const symbolValidation = SecurityValidator.validateSymbol(symbol)
      if (!symbolValidation.isValid) {
        this.errorHandler.logger.warn(`Invalid symbol for fundamental ratios: ${symbol}`, {
          errors: symbolValidation.errors
        })
        return null
      }

      const sanitizedSymbol = symbolValidation.sanitized!

      // Check FMP cache first for enhanced efficiency
      const cacheKey = this.fmpCacheManager.generateKey(sanitizedSymbol, 'fundamental_ratios')
      const cachedData = this.fmpCacheManager.get<FundamentalRatios>(cacheKey, 'fundamental_ratios')

      if (cachedData) {
        this.errorHandler.logger.debug(`Cache hit for fundamental ratios: ${sanitizedSymbol}`)
        return cachedData
      }

      // Check rate limiting before execution
      const serviceId = `fundamental_ratios_${sanitizedSymbol}`
      const rateLimitCheck = SecurityValidator.checkRateLimit(serviceId)
      if (!rateLimitCheck.allowed) {
        this.errorHandler.logger.warn(`Rate limit exceeded for fundamental ratios: ${symbol}`)
        return null
      }

      // Check circuit breaker
      const circuitCheck = SecurityValidator.checkCircuitBreaker(serviceId)
      if (!circuitCheck.allowed) {
        this.errorHandler.logger.warn(`Circuit breaker open for fundamental ratios: ${symbol}`)
        return null
      }

      const result = await this.errorHandler.handleApiCall(
        () => this.executeGetFundamentalRatios(sanitizedSymbol),
        {
          timeout: 30000,
          retries: 2,
          context: 'getFundamentalRatios'
        }
      )

      // Cache successful results
      if (result) {
        this.fmpCacheManager.set(cacheKey, result, 'fundamental_ratios')
        this.errorHandler.logger.debug(`Cached fundamental ratios for ${sanitizedSymbol}`)
      }

      return result
    } catch (error) {
      this.errorHandler.logger.warn(`Failed to get fundamental ratios for ${symbol}`, { error })
      return null
    }
  }

  private async executeGetFundamentalRatios(symbol: string): Promise<FundamentalRatios | null> {
    const sanitizedSymbol = symbol.toUpperCase()

    // Get available sources that support fundamental ratios
    // Yahoo Finance now provides fundamental data via yfinance Python library
    const fundamentalSources = this.dataSources.filter(source =>
      ['Financial Modeling Prep', 'EODHD API', 'Yahoo Finance'].includes(source.name) &&
      this.canMakeRequest(source) &&
      source.provider.getFundamentalRatios
    )

    if (fundamentalSources.length === 0) {
      this.errorHandler.errorHandler.recordFailure(`fundamental_ratios_${sanitizedSymbol}`)
      this.errorHandler.logger.warn(`No available fundamental ratio sources for ${sanitizedSymbol}`)
      return null
    }

    try {
      // Try all available sources in parallel for fastest response
      const promises = fundamentalSources.map(async (source) => {
        try {
          const data = await this.errorHandler.handleApiCall(
            () => source.provider.getFundamentalRatios!(sanitizedSymbol),
            {
              timeout: 20000,
              retries: 1,
              context: `${source.name}_getFundamentalRatios`
            }
          )

          if (data) {
            // Validate API response structure
            const responseValidation = SecurityValidator.validateApiResponse(data, [
              'symbol', 'timestamp', 'source'
            ])

            if (!responseValidation.isValid) {
              this.errorHandler.logger.warn(`Invalid fundamental ratios response structure from ${source.name}`, {
                errors: responseValidation.errors,
                symbol: sanitizedSymbol
              })
              return null
            }

            // Validate numeric fields to prevent data corruption
            const numericFields = ['peRatio', 'pegRatio', 'pbRatio', 'priceToSales', 'priceToFreeCashFlow',
                                 'debtToEquity', 'currentRatio', 'quickRatio', 'roe', 'roa',
                                 'grossProfitMargin', 'operatingMargin', 'netProfitMargin',
                                 'dividendYield', 'payoutRatio']

            for (const field of numericFields) {
              const value = data[field as keyof FundamentalRatios]
              if (value !== undefined && value !== null) {
                const validation = SecurityValidator.validateNumeric(value, {
                  allowNegative: ['roe', 'roa', 'grossProfitMargin', 'operatingMargin', 'netProfitMargin'].includes(field),
                  allowZero: true,
                  min: field.includes('Ratio') ? 0 : undefined,
                  max: field.includes('Margin') || field === 'payoutRatio' ? 100 : undefined,
                  decimalPlaces: 10 // 🔧 FIX: Increased from 4 to 10 to accept more precise fundamental ratios
                })

                if (!validation.isValid) {
                  this.errorHandler.logger.warn(`Invalid ${field} value for ${sanitizedSymbol}`, {
                    field,
                    value,
                    errors: validation.errors
                  });
                  // Set to undefined rather than rejecting entire response
                  (data as any)[field] = undefined;
                }
              }
            }

            this.recordRequest(source)
            this.errorHandler.logger.info(`Fundamental ratios from ${source.name} for ${sanitizedSymbol}`, {
              peRatio: data.peRatio?.toFixed(2) || 'N/A',
              pbRatio: data.pbRatio?.toFixed(2) || 'N/A',
              source: source.name
            })
            return { data, source: source.name }
          }
          return null
        } catch (error) {
          const sanitizedError = SecurityValidator.sanitizeErrorMessage(error, true)
          this.errorHandler.logger.logApiError(
            'GET',
            'fundamental_ratios',
            sanitizedError,
            undefined,
            { symbol: sanitizedSymbol, source: source.name }
          )
          return null
        }
      })

      // Use Promise.allSettled to wait for all attempts
      const results = await Promise.allSettled(promises)

      // Return first successful result
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.data) {
          this.errorHandler.errorHandler.recordSuccess(`fundamental_ratios_${sanitizedSymbol}`)
          return result.value.data
        }
      }

      // All sources failed
      this.errorHandler.errorHandler.recordFailure(`fundamental_ratios_${sanitizedSymbol}`)
      this.errorHandler.logger.warn(`No fundamental ratios available for ${sanitizedSymbol}`, {
        sourcesAttempted: fundamentalSources.length,
        symbol: sanitizedSymbol
      })
      return null

    } catch (error) {
      this.errorHandler.errorHandler.recordFailure(`fundamental_ratios_${sanitizedSymbol}`)
      this.errorHandler.logger.error(`Fundamental ratios service error for ${sanitizedSymbol}`, {
        error,
        symbol: sanitizedSymbol
      })
      return null
    }
  }

  /**
   * Get institutional intelligence for a symbol
   * Combines 13F holdings and Form 4 insider trading data
   */
  async getInstitutionalIntelligence(symbol: string): Promise<InstitutionalIntelligence | null> {
    return this.errorHandler.validateAndExecute(
      () => this.institutionalDataService.getInstitutionalIntelligence(symbol),
      [symbol],
      {
        timeout: 45000,
        retries: 1,
        context: 'getInstitutionalIntelligence'
      }
    ).catch(error => {
      this.errorHandler.logger.warn(`Failed to get institutional intelligence for ${symbol}`, { error })
      return null
    })
  }

  /**
   * Get institutional holdings (13F filings) for a symbol
   */
  async getInstitutionalHoldings(symbol: string, quarters = 4): Promise<InstitutionalHolding[]> {
    return this.errorHandler.validateAndExecute(
      () => this.institutionalDataService.getInstitutionalHoldings(symbol, quarters),
      [symbol],
      {
        timeout: 30000,
        retries: 1,
        context: 'getInstitutionalHoldings'
      }
    ).catch(error => {
      this.errorHandler.logger.warn(`Failed to get institutional holdings for ${symbol}`, { error })
      return []
    })
  }

  /**
   * Get insider transactions (Form 4 filings) for a symbol
   */
  async getInsiderTransactions(symbol: string, days = 180): Promise<InsiderTransaction[]> {
    return this.errorHandler.validateAndExecute(
      () => this.institutionalDataService.getInsiderTransactions(symbol, days),
      [symbol],
      {
        timeout: 30000,
        retries: 1,
        context: 'getInsiderTransactions'
      }
    ).catch(error => {
      this.errorHandler.logger.warn(`Failed to get insider transactions for ${symbol}`, { error })
      return []
    })
  }

  /**
   * Get institutional sentiment for a symbol (via institutional intelligence)
   */
  async getInstitutionalSentiment(symbol: string) {
    try {
      const intelligence = await this.getInstitutionalIntelligence(symbol)
      return intelligence?.institutionalSentiment || null
    } catch (error) {
      this.errorHandler.logger.warn(`Failed to get institutional sentiment for ${symbol}`, { error })
      return null
    }
  }

  /**
   * Get insider sentiment for a symbol (via institutional intelligence)
   */
  async getInsiderSentiment(symbol: string) {
    try {
      const intelligence = await this.getInstitutionalIntelligence(symbol)
      return intelligence?.insiderSentiment || null
    } catch (error) {
      this.errorHandler.logger.warn(`Failed to get insider sentiment for ${symbol}`, { error })
      return null
    }
  }

  /**
   * Enhanced FMP capacity information with detailed plan detection
   */
  getFmpCapacity(): {
    isStarterPlan: boolean;
    isProfessionalPlan: boolean;
    isBasicPlan: boolean;
    rateLimit: number;
    dailyLimit?: number;
    optimalBatchSize: number;
    burstCapacity: number;
    priority: number;
  } {
    const fmpSource = this.getFMPSource()

    if (!fmpSource) {
      return {
        isStarterPlan: false,
        isProfessionalPlan: false,
        isBasicPlan: true,
        rateLimit: 10,
        dailyLimit: 250,
        optimalBatchSize: 5,
        burstCapacity: 10,
        priority: 4
      }
    }

    const isProfessionalPlan = fmpSource.rateLimit >= 600
    const isStarterPlan = fmpSource.rateLimit >= 300 && !isProfessionalPlan
    const isBasicPlan = fmpSource.rateLimit < 300

    // Calculate optimal batch size based on plan capacity
    let optimalBatchSize = 5 // Basic plan default
    if (isProfessionalPlan) {
      optimalBatchSize = Math.min(100, Math.floor(fmpSource.rateLimit / 6)) // ~100 requests/batch
    } else if (isStarterPlan) {
      optimalBatchSize = Math.min(60, Math.floor(fmpSource.rateLimit / 5)) // ~60 requests/batch
    }

    // Calculate burst capacity (short-term burst allowance)
    const burstCapacity = Math.min(Math.floor(fmpSource.rateLimit / 6), 100)

    return {
      isStarterPlan,
      isProfessionalPlan,
      isBasicPlan,
      rateLimit: fmpSource.rateLimit,
      dailyLimit: fmpSource.dailyLimit,
      optimalBatchSize,
      burstCapacity,
      priority: fmpSource.priority
    }
  }

  /**
   * Get comprehensive FMP performance metrics
   */
  getFmpPerformanceMetrics(): {
    currentUtilization: number;
    remainingCapacity: number;
    burstUtilization: number;
    recommendedAction: string;
    nextResetTime: number;
  } {
    const fmpSource = this.getFMPSource()
    if (!fmpSource) {
      return {
        currentUtilization: 0,
        remainingCapacity: 0,
        burstUtilization: 0,
        recommendedAction: 'FMP not available',
        nextResetTime: 0
      }
    }

    const now = Date.now()
    const rateInfo = this.requestCounts.get(fmpSource.name) || { count: 0, resetTime: now + 60000 }
    const burstInfo = this.requestCounts.get(`${fmpSource.name}_burst`) || { count: 0, resetTime: now + 10000 }

    const currentUtilization = (rateInfo.count / fmpSource.rateLimit) * 100
    const remainingCapacity = Math.max(0, (fmpSource.rateLimit - rateInfo.count) / fmpSource.rateLimit) * 100
    const burstUtilization = (burstInfo.count / Math.min(50, Math.floor(fmpSource.rateLimit / 6))) * 100

    let recommendedAction = 'Normal operation'
    if (currentUtilization > 90) {
      recommendedAction = 'Rate limit critical - use fallback sources'
    } else if (currentUtilization > 80) {
      recommendedAction = 'High utilization - reduce batch sizes'
    } else if (currentUtilization < 50) {
      recommendedAction = 'Low utilization - can increase batch sizes'
    }

    return {
      currentUtilization: Number(currentUtilization.toFixed(1)),
      remainingCapacity: Number(remainingCapacity.toFixed(1)),
      burstUtilization: Number(burstUtilization.toFixed(1)),
      recommendedAction,
      nextResetTime: rateInfo.resetTime
    }
  }

  /**
   * Get comprehensive FMP cache statistics
   */
  getFmpCacheStats() {
    const stats = this.fmpCacheManager.getStats()

    return {
      ...stats,
      efficiency: {
        cacheHitRate: `${stats.hitRate.toFixed(1)}%`,
        memoryUtilization: `${((stats.memoryUsage / (100 * 1024 * 1024)) * 100).toFixed(1)}%`,
        recommendations: this.getCacheRecommendations(stats)
      }
    }
  }

  /**
   * Clear FMP cache for specific data types
   */
  clearFmpCache(dataType?: string): number {
    if (dataType) {
      return this.fmpCacheManager.clearByDataType(dataType)
    }

    // Clear all FMP cache
    const allDataTypes = ['stock_price', 'fundamental_ratios', 'company_info', 'analyst_ratings', 'price_targets']
    let totalCleared = 0

    allDataTypes.forEach(type => {
      totalCleared += this.fmpCacheManager.clearByDataType(type)
    })

    return totalCleared
  }

  /**
   * Get cache optimization recommendations
   */
  private getCacheRecommendations(stats: any): string[] {
    const recommendations: string[] = []

    if (stats.hitRate < 60) {
      recommendations.push('Consider increasing cache TTL for better efficiency')
    }

    if (stats.memoryUsage > 80 * 1024 * 1024) { // 80MB
      recommendations.push('Cache memory usage is high - consider reducing TTL or cache size')
    }

    if (stats.totalEntries > 8000) {
      recommendations.push('High cache entry count - monitor for memory pressure')
    }

    if (stats.hitRate > 90) {
      recommendations.push('Excellent cache performance - consider expanding cache coverage')
    }

    return recommendations
  }

  /**
   * Get historical OHLC data from FMP with optional date range
   * @param symbol Stock symbol
   * @param days Number of days to retrieve
   * @param endDate Optional end date (default: today)
   */
  async getHistoricalOHLC(symbol: string, days = 50, endDate?: Date): Promise<import('./types').HistoricalOHLC[]> {
    const fmpSource = this.getFMPSource()
    if (!fmpSource) {
      this.errorHandler.logger.warn('No FMP data source available for historical OHLC', { symbol })
      return []
    }

    try {
      const historicalData = await (fmpSource.provider as any).getHistoricalData(symbol, days, endDate)

      if (!historicalData || historicalData.length === 0) {
        return []
      }

      // Convert MarketData to HistoricalOHLC format
      return historicalData.map((bar: any) => ({
        symbol: bar.symbol || symbol,
        date: new Date(bar.timestamp).toISOString(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        source: bar.source || 'fmp'
      }))
    } catch (error) {
      this.errorHandler.logger.error('Failed to fetch historical OHLC data', {
        symbol,
        days,
        endDate: endDate?.toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return []
    }
  }

  /**
   * ⚠️ STUB METHOD - Batch stock fetching
   * For now, calls getStockPrice for each symbol sequentially
   */
  async getMultipleStocks(symbols: string[]): Promise<import('./types').StockData[]> {
    const results: import('./types').StockData[] = []
    for (const symbol of symbols) {
      const stock = await this.getStockPrice(symbol)
      if (stock) {
        results.push(stock)
      }
    }
    return results
  }

  /**
   * ⚠️ STUB METHOD - Provider names (returns FMP/EODHD)
   */
  getProviderNames(): string[] {
    return ['FMP', 'EODHD']
  }

  /**
   * ⚠️ WRAPPER METHOD - Get provider health in old format
   * Converts getSourceStatus() output to ProviderHealth format for backward compatibility
   */
  async getProviderHealth(): Promise<Array<{ name: string; healthy: boolean; responseTime?: number }>> {
    const sourceStatus = this.getSourceStatus()
    return sourceStatus.map(source => ({
      name: source.name,
      healthy: source.available && source.healthScore > 50,
      responseTime: undefined // Not tracked by real implementation
    }))
  }

  /**
   * ⚠️ ALIAS METHOD - Maps to clearFmpCache for backward compatibility
   */
  clearCache(dataType?: string): number {
    return this.clearFmpCache(dataType)
  }

  /**
   * ⚠️ STUB METHOD - Extended hours data should be fetched via ExtendedMarketDataService
   * This stub exists for backward compatibility only
   */
  async getExtendedHoursData(symbol: string): Promise<{
    preMarketPrice?: number
    preMarketChange?: number
    preMarketChangePercent?: number
    afterHoursPrice?: number
    afterHoursChange?: number
    afterHoursChangePercent?: number
    marketStatus: 'pre-market' | 'market-hours' | 'after-hours' | 'closed'
  } | null> {
    console.warn(`⚠️ getExtendedHoursData should use ExtendedMarketDataService, not FinancialDataService`)
    return null
  }
}
// Singleton instance - ensures shared cache and rate limiting across the application
export const financialDataService = new FinancialDataService()
