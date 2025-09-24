/**
 * Fallback Data Service for Free Price/Volume Data
 * Implements a chain of free data sources with automatic failover
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse, AnalystRatings, PriceTarget, RatingChange, FundamentalRatios, InstitutionalIntelligence, InstitutionalHolding, InsiderTransaction } from './types'
import { PolygonAPI } from './PolygonAPI'
import { AlphaVantageAPI } from './AlphaVantageAPI'
import { YahooFinanceAPI } from './YahooFinanceAPI'
import { TwelveDataAPI } from './TwelveDataAPI'
import { FinancialModelingPrepAPI } from './FinancialModelingPrepAPI'
import { InstitutionalDataService } from './InstitutionalDataService'
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

export class FallbackDataService implements FinancialDataProvider {
  name = 'Fallback Data Service'
  private dataSources: DataSourceConfig[] = []
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map()
  private dailyCounts: Map<string, { count: number; date: string }> = new Map()
  private errorHandler = createServiceErrorHandler('FallbackDataService')
  private institutionalDataService: InstitutionalDataService

  constructor() {
    this.institutionalDataService = new InstitutionalDataService()
    this.initializeDataSources()
  }

  private initializeDataSources(): void {
    // Priority order for FREE data sources
    // Note: Some have API keys but offer free tiers

    // 1. Yahoo Finance - Completely free, no API key needed
    this.dataSources.push({
      name: 'Yahoo Finance',
      provider: new YahooFinanceAPI(),
      priority: 1,
      isFree: true,
      rateLimit: 60 // Unofficial, be conservative
    })

    // 2. Alpha Vantage - Free tier: 25 requests/day, 5/minute
    if (process.env.ALPHA_VANTAGE_API_KEY) {
      this.dataSources.push({
        name: 'Alpha Vantage',
        provider: new AlphaVantageAPI(),
        priority: 2,
        isFree: true,
        rateLimit: 5,
        dailyLimit: 25
      })
    }

    // 3. Twelve Data - Free tier: 800 requests/day, 8/minute
    if (process.env.TWELVE_DATA_API_KEY) {
      this.dataSources.push({
        name: 'Twelve Data',
        provider: new TwelveDataAPI(),
        priority: 3,
        isFree: true,
        rateLimit: 8,
        dailyLimit: 800
      })
    }

    // 4. FMP - Free tier: 250 requests/day
    if (process.env.FMP_API_KEY) {
      this.dataSources.push({
        name: 'Financial Modeling Prep',
        provider: new FinancialModelingPrepAPI(),
        priority: 4,
        isFree: true,
        rateLimit: 10,
        dailyLimit: 250
      })
    }

    // 5. Polygon - Free tier: 5 requests/minute (limited but reliable)
    if (process.env.POLYGON_API_KEY) {
      this.dataSources.push({
        name: 'Polygon',
        provider: new PolygonAPI(),
        priority: 5,
        isFree: true,
        rateLimit: 5,
        dailyLimit: 50000 // Monthly limit, ~1600/day
      })
    }

    // Sort by priority
    this.dataSources.sort((a, b) => a.priority - b.priority)

    this.errorHandler.logger.info(`Fallback Data Service initialized with ${this.dataSources.length} free sources`, {
      sources: this.dataSources.map(ds => ({
        priority: ds.priority,
        name: ds.name,
        rateLimit: ds.rateLimit,
        dailyLimit: ds.dailyLimit
      }))
    })
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

    for (const source of this.dataSources) {
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
          return {
            ...data,
            source: source.name.toLowerCase().replace(/\s+/g, '_')
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
    for (const source of this.dataSources) {
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
          return data
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
    for (const source of this.dataSources) {
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
          return data
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
   * Get current source availability status
   */
  getSourceStatus(): Array<{
    name: string
    available: boolean
    rateLimit: { current: number; limit: number }
    dailyLimit?: { current: number; limit: number }
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
        } : undefined
      }
    })
  }

  /**
   * Get stocks by sector (limited support in free APIs)
   */
  async getStocksBySector(sector: string, limit?: number): Promise<StockData[]> {
    // Yahoo Finance is best for this as it's free
    const yahooSource = this.dataSources.find(s => s.name === 'Yahoo Finance')
    if (yahooSource && this.canMakeRequest(yahooSource)) {
      try {
        const stocks = await yahooSource.provider.getStocksBySector?.(sector, limit)
        if (stocks && stocks.length > 0) {
          this.recordRequest(yahooSource)
          return stocks
        }
      } catch (error) {
        console.error('Yahoo sector fetch failed:', error)
      }
    }

    // Fallback to other sources
    for (const source of this.dataSources) {
      if (!this.canMakeRequest(source) || source.name === 'Yahoo Finance') continue

      try {
        const stocks = await source.provider.getStocksBySector?.(sector, limit)
        if (stocks && stocks.length > 0) {
          this.recordRequest(source)
          return stocks
        }
      } catch {
        // Continue to next source
      }
    }

    return []
  }

  /**
   * Get analyst ratings with fallback (FMP primary, limited TwelveData backup)
   */
  async getAnalystRatings(symbol: string): Promise<AnalystRatings | null> {
    // Prioritize sources that support analyst ratings
    const analystSources = this.dataSources.filter(source =>
      ['Financial Modeling Prep', 'Twelve Data'].includes(source.name)
    )

    for (const source of analystSources) {
      if (!this.canMakeRequest(source)) continue

      try {
        if (source.provider.getAnalystRatings) {
          const data = await source.provider.getAnalystRatings(symbol)
          if (data) {
            this.recordRequest(source)
            console.log(`📊 Analyst ratings from ${source.name} for ${symbol}: ${data.consensus} (${data.totalAnalysts} analysts)`)
            return data
          }
        }
      } catch (error) {
        console.error(`${source.name} analyst ratings failed:`, error)
      }
    }

    console.warn(`⚠️ No analyst ratings available for ${symbol}`)
    return null
  }

  /**
   * Get price targets with fallback (FMP primary, limited TwelveData backup)
   */
  async getPriceTargets(symbol: string): Promise<PriceTarget | null> {
    // Prioritize sources that support price targets
    const targetSources = this.dataSources.filter(source =>
      ['Financial Modeling Prep', 'Twelve Data'].includes(source.name)
    )

    for (const source of targetSources) {
      if (!this.canMakeRequest(source)) continue

      try {
        if (source.provider.getPriceTargets) {
          const data = await source.provider.getPriceTargets(symbol)
          if (data) {
            this.recordRequest(source)
            console.log(`🎯 Price targets from ${source.name} for ${symbol}: $${data.targetConsensus} (${data.upside?.toFixed(1) || 'N/A'}% upside)`)
            return data
          }
        }
      } catch (error) {
        console.error(`${source.name} price targets failed:`, error)
      }
    }

    console.warn(`⚠️ No price targets available for ${symbol}`)
    return null
  }

  /**
   * Get recent rating changes with fallback (FMP primary, limited TwelveData backup)
   */
  async getRecentRatingChanges(symbol: string, limit = 10): Promise<RatingChange[]> {
    // Prioritize sources that support rating changes
    const changeSources = this.dataSources.filter(source =>
      ['Financial Modeling Prep', 'Twelve Data'].includes(source.name)
    )

    for (const source of changeSources) {
      if (!this.canMakeRequest(source)) continue

      try {
        if (source.provider.getRecentRatingChanges) {
          const data = await source.provider.getRecentRatingChanges(symbol, limit)
          if (data && data.length > 0) {
            this.recordRequest(source)
            console.log(`📈 Rating changes from ${source.name} for ${symbol}: ${data.length} recent changes`)
            return data
          }
        }
      } catch (error) {
        console.error(`${source.name} rating changes failed:`, error)
      }
    }

    console.warn(`⚠️ No rating changes available for ${symbol}`)
    return []
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

      // Check rate limiting before execution
      const serviceId = `fundamental_ratios_${symbolValidation.sanitized}`
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

      return await this.errorHandler.handleApiCall(
        () => this.executeGetFundamentalRatios(symbolValidation.sanitized!),
        {
          timeout: 30000,
          retries: 2,
          context: 'getFundamentalRatios'
        }
      )
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
                  decimalPlaces: 4
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
}