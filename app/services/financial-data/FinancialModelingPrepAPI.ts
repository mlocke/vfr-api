/**
 * Direct Financial Modeling Prep API implementation
 * Follows the same patterns as AlphaVantageAPI for consistency
 */

import {
  StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse,
  FundamentalRatios, AnalystRatings, PriceTarget, RatingChange,
  FinancialStatement, BalanceSheet, CashFlowStatement, EconomicEvent,
  DividendData, StockSplit, ESGRating, TreasuryRate
} from './types'
import securityValidator from '../security/SecurityValidator'
import { BaseFinancialDataProvider } from './BaseFinancialDataProvider'
import { createApiErrorHandler, ErrorType, ErrorCode } from '../error-handling'

export class FinancialModelingPrepAPI extends BaseFinancialDataProvider implements FinancialDataProvider {
  name = 'Financial Modeling Prep'
  private errorHandler = createApiErrorHandler('financial-modeling-prep')

  constructor(apiKey?: string, timeout = 15000, throwErrors = false) {
    super({
      apiKey: apiKey || process.env.FMP_API_KEY || '',
      timeout,
      throwErrors,
      baseUrl: 'https://financialmodelingprep.com/stable'
    })
  }

  protected getSourceIdentifier(): string {
    return 'fmp'
  }

  /**
   * Get current stock price data
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      this.validateApiKey()
      const normalizedSymbol = this.normalizeSymbol(symbol)

      const response = await this.makeRequest(`/quote?symbol=${normalizedSymbol}`)

      if (!this.validateResponse(response, 'array')) {
        return null
      }

      const quote = response.data[0]

      // Enhanced FMP-specific validation
      const stockData = {
        symbol: normalizedSymbol,
        price: Number(this.parseNumeric(quote.price).toFixed(2)),
        change: Number(this.parseNumeric(quote.change).toFixed(2)),
        changePercent: Number(this.parseNumeric(quote.changesPercentage).toFixed(2)),
        volume: this.parseInt(quote.volume),
        timestamp: quote.timestamp ? new Date(quote.timestamp * 1000).getTime() : Date.now(),
        source: this.getSourceIdentifier()
      }

      const validation = this.validateFMPResponse(stockData, 'stock_price', normalizedSymbol)
      if (!validation.isValid) {
        this.errorHandler.logger.warn('FMP stock price validation failed', {
          symbol: normalizedSymbol,
          errors: validation.errors
        })
        return null
      }

      return stockData
    } catch (error) {
      return this.handleApiError(error, symbol, 'stock price', null)
    }
  }

  /**
   * Get company information
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      this.validateApiKey()
      const normalizedSymbol = this.normalizeSymbol(symbol)

      const response = await this.makeRequest(`/profile?symbol=${normalizedSymbol}`)

      if (!this.validateResponse(response, 'array')) {
        return null
      }

      const profile = response.data[0]

      return {
        symbol: normalizedSymbol,
        name: profile.companyName || '',
        description: profile.description || '',
        sector: profile.sector || '',
        marketCap: this.parseInt(profile.mktCap),
        employees: this.parseInt(profile.fullTimeEmployees),
        website: profile.website || ''
      }
    } catch (error) {
      return this.handleApiError(error, symbol, 'company info', null)
    }
  }

  /**
   * Get detailed market data
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('Financial Modeling Prep API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      // Use the historical price endpoint for OHLC data - 1 year of data (~252 trading days)
      const response = await this.makeRequest(`/historical-price-full?symbol=${symbol.toUpperCase()}&limit=365`)

      if (!response.success) {
        const error = new Error(response.error || 'Financial Modeling Prep API request failed')
        if (this.throwErrors) throw error
        return null
      }

      if (!response.data?.historical || !Array.isArray(response.data.historical) || response.data.historical.length === 0) {
        const error = new Error('Invalid historical data response from Financial Modeling Prep API')
        if (this.throwErrors) throw error
        return null
      }

      // Get the most recent trading day (first item in the historical array)
      const historical = response.data.historical[0]

      // Store full historical data for future use (365 days now cached)
      this.errorHandler.logger.info(`FMP: Fetched ${response.data.historical.length} days of historical data for ${symbol}`, {
        symbol,
        daysRetrieved: response.data.historical.length
      })

      return {
        symbol: symbol.toUpperCase(),
        open: parseFloat(historical.open || '0'),
        high: parseFloat(historical.high || '0'),
        low: parseFloat(historical.low || '0'),
        close: parseFloat(historical.close || '0'),
        volume: parseInt(historical.volume || '0'),
        timestamp: new Date(historical.date).getTime(),
        source: 'fmp'
      }
    } catch (error) {
      this.errorHandler.logger.logApiError(
        'GET',
        'market_data',
        error,
        undefined,
        { symbol }
      )
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Get historical data for a symbol (returns array of daily data)
   * @param symbol Stock symbol
   * @param limit Number of days to retrieve (default: 365)
   */
  async getHistoricalData(symbol: string, limit: number = 365): Promise<MarketData[]> {
    try {
      if (!this.apiKey) {
        const error = new Error('Financial Modeling Prep API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return []
      }

      const response = await this.makeRequest(`/historical-price-full?symbol=${symbol.toUpperCase()}&limit=${limit}`)

      if (!response.success) {
        const error = new Error(response.error || 'Financial Modeling Prep API request failed')
        if (this.throwErrors) throw error
        return []
      }

      if (!response.data?.historical || !Array.isArray(response.data.historical)) {
        const error = new Error('Invalid historical data response from Financial Modeling Prep API')
        if (this.throwErrors) throw error
        return []
      }

      // Convert all historical data to MarketData format
      return response.data.historical.map((historical: any) => ({
        symbol: symbol.toUpperCase(),
        open: parseFloat(historical.open || '0'),
        high: parseFloat(historical.high || '0'),
        low: parseFloat(historical.low || '0'),
        close: parseFloat(historical.close || '0'),
        volume: parseInt(historical.volume || '0'),
        timestamp: new Date(historical.date).getTime(),
        source: 'fmp'
      }))

    } catch (error) {
      this.errorHandler.logger.logApiError(
        'GET',
        'historical_data',
        error,
        undefined,
        { symbol, limit }
      )
      if (this.throwErrors) throw error
      return []
    }
  }

  /**
   * Health check for Financial Modeling Prep API
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.errorHandler.handleApiCall(
        () => this.executeHealthCheck(),
        {
          timeout: 5000,
          retries: 0,
          context: 'healthCheck'
        }
      )
    } catch (error) {
      this.errorHandler.logger.warn('Financial Modeling Prep health check failed', { error })
      return false
    }
  }

  private async executeHealthCheck(): Promise<boolean> {
    if (!this.apiKey) {
      this.errorHandler.logger.warn('Financial Modeling Prep API key not configured')
      return false
    }

    const response = await this.makeRequest('/quote?symbol=AAPL')

    if (!response.success) {
      this.errorHandler.logger.warn('Financial Modeling Prep health check failed', {
        error: response.error || 'Unknown error'
      })
      return false
    }

    // Check for success, no error message, and presence of expected data structure
    return response.success &&
           Array.isArray(response.data) &&
           response.data.length > 0 &&
           !!response.data[0]?.price
  }

  /**
   * Get fundamental ratios for a stock with comprehensive security validation
   */
  async getFundamentalRatios(symbol: string): Promise<FundamentalRatios | null> {
    try {
      // Validate symbol input first - return null for invalid symbols instead of throwing
      const symbolValidation = securityValidator.validateSymbol(symbol)
      if (!symbolValidation.isValid) {
        this.errorHandler.logger.warn(`Invalid symbol for fundamental ratios: ${symbol}`, {
          errors: symbolValidation.errors
        })
        return null
      }

      return await this.errorHandler.handleApiCall(
        () => this.executeGetFundamentalRatios(symbolValidation.sanitized!),
        {
          timeout: this.timeout,
          retries: 2,
          context: 'getFundamentalRatios'
        }
      )
    } catch (error) {
      if (this.throwErrors) throw error
      this.errorHandler.logger.warn(`Failed to get fundamental ratios for ${symbol}`, { error })
      return null
    }
  }

  private async executeGetFundamentalRatios(symbol: string): Promise<FundamentalRatios | null> {
    const sanitizedSymbol = symbol.toUpperCase()

    if (!this.apiKey) {
      throw new Error('Financial Modeling Prep API key not configured')
    }

      // Get both ratios and key metrics for comprehensive data
      const [ratiosResponse, metricsResponse] = await Promise.all([
        this.makeRequest(`/ratios-ttm?symbol=${sanitizedSymbol}`),
        this.makeRequest(`/key-metrics-ttm?symbol=${sanitizedSymbol}`)
      ])

      if (!ratiosResponse.success && !metricsResponse.success) {
        securityValidator.recordFailure(`fmp_fundamental_${sanitizedSymbol}`)
        const error = new Error('Failed to fetch fundamental data from FMP')
        const sanitizedError = securityValidator.sanitizeErrorMessage(error)
        console.error(sanitizedError)
        if (this.throwErrors) throw error
        return null
      }

    // Validate API response structures
    if (ratiosResponse.success) {
      const ratiosValidation = securityValidator.validateApiResponse(ratiosResponse.data, [])
      if (!ratiosValidation.isValid) {
        this.errorHandler.logger.warn('Invalid ratios response structure', {
          errors: ratiosValidation.errors,
          symbol: sanitizedSymbol
        })
      }
    }

    if (metricsResponse.success) {
      const metricsValidation = securityValidator.validateApiResponse(metricsResponse.data, [])
      if (!metricsValidation.isValid) {
        this.errorHandler.logger.warn('Invalid metrics response structure', {
          errors: metricsValidation.errors,
          symbol: sanitizedSymbol
        })
      }
    }

      // Extract ratios data with validation
      const ratiosData = ratiosResponse.success && Array.isArray(ratiosResponse.data) && ratiosResponse.data[0]
        ? ratiosResponse.data[0]
        : {}

      // Extract metrics data with validation
      const metricsData = metricsResponse.success && Array.isArray(metricsResponse.data) && metricsResponse.data[0]
        ? metricsResponse.data[0]
        : {}

      // Securely parse and validate numeric values
      const parseSecureNumeric = (value: any, fieldName: string, allowNegative: boolean = false): number | undefined => {
        if (value === null || value === undefined || value === '') {
          return undefined
        }

        const validation = securityValidator.validateNumeric(value, {
          allowNegative,
          allowZero: true,
          min: allowNegative ? undefined : 0,
          max: fieldName.includes('Margin') || fieldName === 'payoutRatio' ? 100 : undefined,
          decimalPlaces: 6
        })

        if (!validation.isValid) {
          this.errorHandler.logger.warn(`Invalid ${fieldName} value for ${sanitizedSymbol}`, {
            fieldName,
            value,
            errors: validation.errors
          })
          return undefined
        }

        return parseFloat(value)
      }

      const result: FundamentalRatios = {
        symbol: sanitizedSymbol,
        peRatio: parseSecureNumeric(metricsData.peRatioTTM, 'peRatio') ?? parseSecureNumeric(ratiosData.priceEarningsRatioTTM, 'peRatio'),
        pegRatio: parseSecureNumeric(metricsData.pegRatioTTM, 'pegRatio'),
        pbRatio: parseSecureNumeric(metricsData.priceToBookRatioTTM, 'pbRatio') ?? parseSecureNumeric(ratiosData.priceToBookRatioTTM, 'pbRatio'),
        priceToSales: parseSecureNumeric(metricsData.priceToSalesRatioTTM, 'priceToSales') ?? parseSecureNumeric(ratiosData.priceToSalesRatioTTM, 'priceToSales'),
        priceToFreeCashFlow: parseSecureNumeric(metricsData.priceToFreeCashFlowsRatioTTM, 'priceToFreeCashFlow') ?? parseSecureNumeric(ratiosData.priceToFreeCashFlowsRatioTTM, 'priceToFreeCashFlow'),
        debtToEquity: parseSecureNumeric(ratiosData.debtEquityRatioTTM, 'debtToEquity'),
        currentRatio: parseSecureNumeric(ratiosData.currentRatioTTM, 'currentRatio'),
        quickRatio: parseSecureNumeric(ratiosData.quickRatioTTM, 'quickRatio'),
        roe: parseSecureNumeric(ratiosData.returnOnEquityTTM, 'roe', true),
        roa: parseSecureNumeric(ratiosData.returnOnAssetsTTM, 'roa', true),
        grossProfitMargin: parseSecureNumeric(ratiosData.grossProfitMarginTTM, 'grossProfitMargin', true),
        operatingMargin: parseSecureNumeric(ratiosData.operatingProfitMarginTTM, 'operatingMargin', true),
        netProfitMargin: parseSecureNumeric(ratiosData.netProfitMarginTTM, 'netProfitMargin', true),
        dividendYield: parseSecureNumeric(metricsData.dividendYieldTTM, 'dividendYield') ?? parseSecureNumeric(ratiosData.dividendYieldTTM, 'dividendYield'),
        payoutRatio: parseSecureNumeric(ratiosData.payoutRatioTTM, 'payoutRatio'),
        timestamp: Date.now(),
        source: 'fmp',
        period: 'ttm'
      }

    return result
  }

  /**
   * Get stocks by sector using FMP's sector performance endpoint
   */
  async getStocksBySector(sector: string, limit = 20): Promise<StockData[]> {
    try {
      if (!this.apiKey) {
        console.warn('Financial Modeling Prep API key not configured')
        return []
      }

      // Use stock screener endpoint to filter by sector
      const response = await this.makeRequest(`/stock-screener?sector=${encodeURIComponent(sector)}&limit=${limit}`)

      if (!response.success || !response.data || !Array.isArray(response.data)) {
        return []
      }

      return response.data.map((stock: any) => ({
        symbol: stock.symbol || '',
        price: parseFloat(stock.price || '0'),
        change: parseFloat(stock.change || '0'),
        changePercent: parseFloat(stock.changesPercentage || '0'),
        volume: parseInt(stock.volume || '0'),
        timestamp: Date.now(),
        source: 'fmp'
      })).filter(stock => stock.symbol && stock.price > 0).slice(0, limit)
    } catch (error) {
      this.errorHandler.logger.logApiError(
        'GET',
        'sector_data',
        error,
        undefined,
        { sector }
      )
      return []
    }
  }

  /**
   * Get analyst ratings and consensus for a stock
   */
  async getAnalystRatings(symbol: string): Promise<AnalystRatings | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('Financial Modeling Prep API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const response = await this.makeRequest(`/upgrades-downgrades-consensus-bulk`)

      if (!response.success) {
        const error = new Error(response.error || 'Financial Modeling Prep API request failed')
        if (this.throwErrors) throw error
        return null
      }

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        const error = new Error('No analyst ratings data available from Financial Modeling Prep API')
        if (this.throwErrors) throw error
        return null
      }

      // Filter for the specific symbol since bulk endpoint returns all symbols
      const ratings = response.data.find((item: any) => item.symbol === symbol.toUpperCase())
      if (!ratings) {
        const error = new Error(`No analyst ratings found for symbol ${symbol}`)
        if (this.throwErrors) throw error
        return null
      }
      const strongBuy = parseInt(ratings.strongBuy || '0')
      const buy = parseInt(ratings.buy || '0')
      const hold = parseInt(ratings.hold || '0')
      const sell = parseInt(ratings.sell || '0')
      const strongSell = parseInt(ratings.strongSell || '0')
      const totalAnalysts = strongBuy + buy + hold + sell + strongSell

      // Calculate sentiment score (1-5 scale)
      let sentimentScore = 3 // neutral default
      if (totalAnalysts > 0) {
        const weightedScore = (strongBuy * 5 + buy * 4 + hold * 3 + sell * 2 + strongSell * 1) / totalAnalysts
        sentimentScore = Number(weightedScore.toFixed(1))
      }

      return {
        symbol: symbol.toUpperCase(),
        consensus: ratings.consensus || 'Hold',
        strongBuy,
        buy,
        hold,
        sell,
        strongSell,
        totalAnalysts,
        sentimentScore,
        timestamp: Date.now(),
        source: 'fmp'
      }
    } catch (error) {
      this.errorHandler.logger.logApiError(
        'GET',
        'analyst_ratings',
        error,
        undefined,
        { symbol }
      )
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Get price targets for a stock
   */
  async getPriceTargets(symbol: string): Promise<PriceTarget | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('Financial Modeling Prep API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const response = await this.makeRequest(`/price-target-consensus?symbol=${symbol.toUpperCase()}`)

      if (!response.success) {
        const error = new Error(response.error || 'Financial Modeling Prep API request failed')
        if (this.throwErrors) throw error
        return null
      }

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        const error = new Error('No price target data available from Financial Modeling Prep API')
        if (this.throwErrors) throw error
        return null
      }

      const target = response.data[0]

      // Get current price for upside calculation
      const currentStock = await this.getStockPrice(symbol)
      const currentPrice = currentStock?.price
      const upside = currentPrice && target.targetConsensus
        ? Number(((target.targetConsensus - currentPrice) / currentPrice * 100).toFixed(2))
        : undefined

      return {
        symbol: symbol.toUpperCase(),
        targetHigh: parseFloat(target.targetHigh || '0'),
        targetLow: parseFloat(target.targetLow || '0'),
        targetConsensus: parseFloat(target.targetConsensus || '0'),
        targetMedian: parseFloat(target.targetMedian || '0'),
        currentPrice,
        upside,
        timestamp: Date.now(),
        source: 'fmp'
      }
    } catch (error) {
      this.errorHandler.logger.logApiError(
        'GET',
        'price_targets',
        error,
        undefined,
        { symbol }
      )
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Enhanced batch processing for fundamental ratios with dynamic sizing
   * Optimized for FMP Starter (300 req/min) and Professional (600 req/min) plans
   */
  async getBatchFundamentalRatios(symbols: string[], options?: {
    planType?: 'basic' | 'starter' | 'professional';
    rateLimit?: number;
    priorityMode?: boolean;
  }): Promise<Map<string, FundamentalRatios>> {
    try {
      this.validateApiKey()

      const results = new Map<string, FundamentalRatios>()
      const normalizedSymbols = symbols.map(s => this.normalizeSymbol(s)).filter(Boolean)

      if (normalizedSymbols.length === 0) {
        return results
      }

      // Enhanced dynamic batch sizing based on plan capacity
      const planType = options?.planType || this.detectPlanType(options?.rateLimit)
      const dynamicBatchConfig = this.calculateOptimalBatchConfig(planType, normalizedSymbols.length, options?.priorityMode)

      // Process in optimized batches
      const batches: string[][] = []
      for (let i = 0; i < normalizedSymbols.length; i += dynamicBatchConfig.batchSize) {
        batches.push(normalizedSymbols.slice(i, i + dynamicBatchConfig.batchSize))
      }

      this.errorHandler.logger.info(`Enhanced batch processing for ${normalizedSymbols.length} symbols`, {
        planType,
        batchSize: dynamicBatchConfig.batchSize,
        totalBatches: batches.length,
        maxConcurrency: dynamicBatchConfig.maxConcurrentBatches,
        expectedDuration: `${dynamicBatchConfig.estimatedDurationSeconds}s`,
        utilizationTarget: `${dynamicBatchConfig.utilizationTarget}%`
      })

      // Enhanced batch processor with adaptive throttling
      const processBatch = async (symbolBatch: string[], batchIndex: number): Promise<{
        processed: number;
        successful: number;
        errors: number;
        duration: number;
      }> => {
        const batchStartTime = Date.now()
        let successful = 0
        let errors = 0

        try {
          // Adaptive concurrency within batch based on plan capacity
          const promises = symbolBatch.map(async (symbol, index) => {
            // Stagger requests within batch to optimize rate limit usage
            const delay = (index * dynamicBatchConfig.requestInterval) + (batchIndex * 50) // Additional batch offset
            if (delay > 0) {
              await new Promise(resolve => setTimeout(resolve, delay))
            }

            try {
              const ratios = await this.getFundamentalRatios(symbol)
              if (ratios) {
                results.set(symbol, ratios)
                successful++
                this.errorHandler.logger.debug(`✅ Ratios retrieved for ${symbol} (batch ${batchIndex + 1})`, {
                  batchProgress: `${successful}/${symbolBatch.length}`
                })
                return { symbol, success: true }
              }
              errors++
              return { symbol, success: false, reason: 'No data' }
            } catch (error) {
              errors++
              this.errorHandler.logger.warn(`❌ Failed to get ratios for ${symbol} (batch ${batchIndex + 1})`, { error })
              return { symbol, success: false, reason: 'API error' }
            }
          })

          await Promise.allSettled(promises)

          const batchDuration = Date.now() - batchStartTime
          this.errorHandler.logger.info(`Batch ${batchIndex + 1}/${batches.length} completed`, {
            symbols: symbolBatch.length,
            successful,
            errors,
            duration: `${batchDuration}ms`,
            successRate: `${((successful / symbolBatch.length) * 100).toFixed(1)}%`
          })

          return {
            processed: symbolBatch.length,
            successful,
            errors,
            duration: batchDuration
          }
        } catch (error) {
          this.errorHandler.logger.error(`Batch ${batchIndex + 1} processing error`, { error, batch: symbolBatch })
          return {
            processed: symbolBatch.length,
            successful: 0,
            errors: symbolBatch.length,
            duration: Date.now() - batchStartTime
          }
        }
      }

      // Execute batches with controlled concurrency and adaptive timing
      const batchResults: Awaited<ReturnType<typeof processBatch>>[] = []
      for (let i = 0; i < batches.length; i += dynamicBatchConfig.maxConcurrentBatches) {
        const concurrentBatches = batches.slice(i, i + dynamicBatchConfig.maxConcurrentBatches)

        const concurrentPromises = concurrentBatches.map((batch, index) =>
          processBatch(batch, i + index)
        )

        // Execute concurrent batches
        const concurrentResults = await Promise.allSettled(concurrentPromises)
        batchResults.push(...concurrentResults
          .filter(r => r.status === 'fulfilled')
          .map(r => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof processBatch>>>).value)
        )

        // Adaptive delay between batch groups based on performance and rate limits
        if (i + dynamicBatchConfig.maxConcurrentBatches < batches.length) {
          const averageBatchDuration = batchResults.reduce((sum, result) => sum + result.duration, 0) / batchResults.length
          const adaptiveDelay = Math.max(
            dynamicBatchConfig.batchInterval,
            Math.min(averageBatchDuration * 0.1, 1000) // Max 1 second delay
          )

          this.errorHandler.logger.debug(`Adaptive delay between batch groups: ${adaptiveDelay}ms`)
          await new Promise(resolve => setTimeout(resolve, adaptiveDelay))
        }
      }

      // Calculate final statistics
      const totalProcessed = batchResults.reduce((sum, result) => sum + result.processed, 0)
      const totalSuccessful = batchResults.reduce((sum, result) => sum + result.successful, 0)
      const totalErrors = batchResults.reduce((sum, result) => sum + result.errors, 0)
      const totalDuration = batchResults.reduce((sum, result) => sum + result.duration, 0)
      const averageRequestTime = totalDuration / Math.max(totalProcessed, 1)

      this.errorHandler.logger.info(`Enhanced batch processing completed`, {
        planType,
        requested: normalizedSymbols.length,
        processed: totalProcessed,
        successful: totalSuccessful,
        errors: totalErrors,
        successRate: `${((totalSuccessful / normalizedSymbols.length) * 100).toFixed(1)}%`,
        totalDuration: `${totalDuration}ms`,
        averageRequestTime: `${averageRequestTime.toFixed(1)}ms`,
        utilizationEfficiency: this.calculateUtilizationEfficiency(dynamicBatchConfig, batchResults)
      })

      return results
    } catch (error) {
      this.errorHandler.logger.error('Enhanced batch fundamental ratios failed', { error })
      if (this.throwErrors) throw error
      return new Map()
    }
  }

  /**
   * Get recent rating changes for a stock
   */
  async getRecentRatingChanges(symbol: string, limit = 10): Promise<RatingChange[]> {
    try {
      if (!this.apiKey) {
        const error = new Error('Financial Modeling Prep API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return []
      }

      const response = await this.makeRequest(`/price-target-latest-news?_symbol_=${symbol.toUpperCase()}&_limit_=${limit}`)

      if (!response.success) {
        const error = new Error(response.error || 'Financial Modeling Prep API request failed')
        if (this.throwErrors) throw error
        return []
      }

      if (!response.data || !Array.isArray(response.data)) {
        const error = new Error('No rating changes data available from Financial Modeling Prep API')
        if (this.throwErrors) throw error
        return []
      }

      return response.data.map((change: any) => ({
        symbol: symbol.toUpperCase(),
        publishedDate: change.publishedDate || '',
        analystName: change.analystName || '',
        analystCompany: change.analystCompany || '',
        action: this.determineRatingAction(change),
        priceTarget: change.priceTarget ? parseFloat(change.priceTarget) : undefined,
        priceWhenPosted: change.priceWhenPosted ? parseFloat(change.priceWhenPosted) : undefined,
        newsTitle: change.newsTitle || '',
        newsURL: change.newsURL || '',
        timestamp: change.publishedDate ? new Date(change.publishedDate).getTime() : Date.now(),
        source: 'fmp'
      }))
    } catch (error) {
      this.errorHandler.logger.logApiError(
        'GET',
        'rating_changes',
        error,
        undefined,
        { symbol }
      )
      if (this.throwErrors) throw error
      return []
    }
  }

  /**
   * Determine the type of rating action from news data
   */
  private determineRatingAction(change: any): 'upgrade' | 'downgrade' | 'initiate' | 'maintain' {
    const title = (change.newsTitle || '').toLowerCase()
    const analyst = (change.analystName || '').toLowerCase()

    if (title.includes('upgrade') || title.includes('raises') || title.includes('lifted')) {
      return 'upgrade'
    }
    if (title.includes('downgrade') || title.includes('lowers') || title.includes('cuts')) {
      return 'downgrade'
    }
    if (title.includes('initiate') || title.includes('coverage')) {
      return 'initiate'
    }
    if (title.includes('maintain') || title.includes('reaffirm')) {
      return 'maintain'
    }

    // Default based on target price vs current price if available
    if (change.priceTarget && change.priceWhenPosted) {
      const targetChange = (change.priceTarget - change.priceWhenPosted) / change.priceWhenPosted
      if (targetChange > 0.05) return 'upgrade'
      if (targetChange < -0.05) return 'downgrade'
    }

    return 'maintain'
  }

  /**
   * Enhanced FMP data quality validation
   */
  private validateFMPResponse(data: any, dataType: string, symbol: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!data) {
      errors.push('No data received from FMP API')
      return { isValid: false, errors }
    }

    switch (dataType) {
      case 'stock_price':
        if (!data.price || typeof data.price !== 'number' || data.price <= 0) {
          errors.push('Invalid or missing stock price')
        }
        if (!data.symbol || data.symbol.toUpperCase() !== symbol.toUpperCase()) {
          errors.push('Symbol mismatch in response')
        }
        break

      case 'fundamental_ratios':
        const requiredRatios = ['peRatio', 'pbRatio', 'roe', 'roa']
        const missingRatios = requiredRatios.filter(ratio =>
          data[ratio] === undefined || data[ratio] === null
        )
        if (missingRatios.length === requiredRatios.length) {
          errors.push('All critical fundamental ratios are missing')
        }

        // Validate ratio ranges
        if (data.peRatio && (data.peRatio < 0 || data.peRatio > 1000)) {
          errors.push(`PE ratio out of reasonable range: ${data.peRatio}`)
        }
        if (data.pbRatio && (data.pbRatio < 0 || data.pbRatio > 100)) {
          errors.push(`PB ratio out of reasonable range: ${data.pbRatio}`)
        }
        if (data.roe && (data.roe < -100 || data.roe > 100)) {
          errors.push(`ROE out of reasonable range: ${data.roe}%`)
        }
        break

      case 'company_info':
        if (!data.name || data.name.length === 0) {
          errors.push('Company name missing')
        }
        if (!data.sector || data.sector.length === 0) {
          errors.push('Company sector missing')
        }
        break

      case 'analyst_ratings':
        if (!data.totalAnalysts || data.totalAnalysts <= 0) {
          errors.push('Invalid analyst count')
        }
        const validRatings = ['strongBuy', 'buy', 'hold', 'sell', 'strongSell']
        const ratingSum = validRatings.reduce((sum, rating) => sum + (data[rating] || 0), 0)
        if (ratingSum !== data.totalAnalysts) {
          errors.push('Analyst rating counts do not match total')
        }
        break
    }

    // Common validations
    if (data.timestamp && (typeof data.timestamp !== 'number' || data.timestamp > Date.now() + 86400000)) {
      errors.push('Invalid timestamp in response')
    }

    return { isValid: errors.length === 0, errors }
  }

  /**
   * Detect FMP plan type based on rate limits or environment
   */
  private detectPlanType(rateLimit?: number): 'basic' | 'starter' | 'professional' {
    const envPlan = process.env.FMP_PLAN?.toLowerCase()
    if (envPlan === 'professional' || rateLimit && rateLimit >= 600) return 'professional'
    if (envPlan === 'starter' || rateLimit && rateLimit >= 300) return 'starter'
    return 'basic'
  }

  /**
   * Calculate optimal batch configuration based on plan type and request volume
   */
  private calculateOptimalBatchConfig(planType: 'basic' | 'starter' | 'professional', totalSymbols: number, priorityMode = false): {
    batchSize: number;
    maxConcurrentBatches: number;
    requestInterval: number;
    batchInterval: number;
    utilizationTarget: number;
    estimatedDurationSeconds: number;
  } {
    const planConfigs = {
      basic: {
        baseRateLimit: 10,
        baseBatchSize: 5,
        maxConcurrency: 2,
        utilizationTarget: 80
      },
      starter: {
        baseRateLimit: 300,
        baseBatchSize: 25,
        maxConcurrency: 5,
        utilizationTarget: 85
      },
      professional: {
        baseRateLimit: 600,
        baseBatchSize: 50,
        maxConcurrency: 8,
        utilizationTarget: 90
      }
    }

    const config = planConfigs[planType]

    // Adaptive batch sizing based on total volume
    const volumeMultiplier = totalSymbols < 10 ? 0.5 : totalSymbols > 100 ? 1.5 : 1
    const batchSize = Math.max(1, Math.floor(config.baseBatchSize * volumeMultiplier))

    // Priority mode adjustments for time-sensitive requests
    const priorityMultiplier = priorityMode ? 1.5 : 1
    const maxConcurrentBatches = Math.floor(config.maxConcurrency * priorityMultiplier)

    // Calculate request timing to maintain rate limits
    const targetRequestsPerSecond = (config.baseRateLimit * config.utilizationTarget / 100) / 60
    const requestInterval = Math.max(50, Math.floor(1000 / targetRequestsPerSecond))
    const batchInterval = Math.max(200, requestInterval * 2)

    // Estimate total duration
    const totalBatches = Math.ceil(totalSymbols / batchSize)
    const batchGroupCount = Math.ceil(totalBatches / maxConcurrentBatches)
    const estimatedDurationSeconds = Math.ceil(
      (batchGroupCount * batchInterval + totalSymbols * requestInterval) / 1000
    )

    return {
      batchSize,
      maxConcurrentBatches,
      requestInterval,
      batchInterval,
      utilizationTarget: config.utilizationTarget,
      estimatedDurationSeconds
    }
  }

  /**
   * Calculate utilization efficiency based on batch performance
   */
  private calculateUtilizationEfficiency(config: any, batchResults: any[]): string {
    if (batchResults.length === 0) return 'N/A'

    const totalRequests = batchResults.reduce((sum, result) => sum + result.processed, 0)
    const totalDuration = batchResults.reduce((sum, result) => sum + result.duration, 0)
    const averageDuration = totalDuration / batchResults.length

    // Calculate theoretical vs actual throughput
    const theoreticalRate = config.utilizationTarget / 100 * 300 / 60 // requests per second
    const actualRate = totalRequests / (averageDuration / 1000)
    const efficiency = Math.min((actualRate / theoreticalRate) * 100, 100)

    return `${efficiency.toFixed(1)}%`
  }

  /**
   * Get financial statements (Income Statement) for a symbol
   */
  async getIncomeStatement(symbol: string, period: 'annual' | 'quarterly' = 'annual', limit = 5): Promise<FinancialStatement[]> {
    try {
      this.validateApiKey()
      const normalizedSymbol = this.normalizeSymbol(symbol)

      const response = await this.makeRequest(`/income-statement/${normalizedSymbol}?period=${period}&limit=${limit}`)

      if (!this.validateResponse(response, 'array')) {
        return []
      }

      return response.data.map((statement: any) => ({
        symbol: normalizedSymbol,
        date: statement.date || '',
        period: statement.period || period,
        revenue: this.parseNumeric(statement.revenue),
        costOfRevenue: this.parseNumeric(statement.costOfRevenue),
        grossProfit: this.parseNumeric(statement.grossProfit),
        grossProfitRatio: this.parseNumeric(statement.grossProfitRatio),
        researchAndDevelopment: this.parseNumeric(statement.researchAndDevelopmentExpenses),
        generalAndAdministrativeExpenses: this.parseNumeric(statement.generalAndAdministrativeExpenses),
        sellingAndMarketingExpenses: this.parseNumeric(statement.sellingAndMarketingExpenses),
        sellingGeneralAndAdministrativeExpenses: this.parseNumeric(statement.sellingGeneralAndAdministrativeExpenses),
        operatingExpenses: this.parseNumeric(statement.operatingExpenses),
        operatingIncome: this.parseNumeric(statement.operatingIncome),
        operatingIncomeRatio: this.parseNumeric(statement.operatingIncomeRatio),
        totalOtherIncomeExpenses: this.parseNumeric(statement.totalOtherIncomeExpensesNet),
        incomeBeforeTax: this.parseNumeric(statement.incomeBeforeTax),
        incomeBeforeTaxRatio: this.parseNumeric(statement.incomeBeforeTaxRatio),
        incomeTaxExpense: this.parseNumeric(statement.incomeTaxExpense),
        netIncome: this.parseNumeric(statement.netIncome),
        netIncomeRatio: this.parseNumeric(statement.netIncomeRatio),
        eps: this.parseNumeric(statement.eps),
        epsdiluted: this.parseNumeric(statement.epsdiluted),
        weightedAverageShsOut: this.parseNumeric(statement.weightedAverageShsOut),
        weightedAverageShsOutDil: this.parseNumeric(statement.weightedAverageShsOutDil),
        timestamp: Date.now(),
        source: this.getSourceIdentifier()
      }))
    } catch (error) {
      return this.handleApiError(error, symbol, 'income statement', [])
    }
  }

  /**
   * Get balance sheet data for a symbol
   */
  async getBalanceSheet(symbol: string, period: 'annual' | 'quarterly' = 'annual', limit = 5): Promise<BalanceSheet[]> {
    try {
      this.validateApiKey()
      const normalizedSymbol = this.normalizeSymbol(symbol)

      const response = await this.makeRequest(`/balance-sheet-statement/${normalizedSymbol}?period=${period}&limit=${limit}`)

      if (!this.validateResponse(response, 'array')) {
        return []
      }

      return response.data.map((sheet: any) => ({
        symbol: normalizedSymbol,
        date: sheet.date || '',
        period: sheet.period || period,
        cashAndCashEquivalents: this.parseNumeric(sheet.cashAndCashEquivalents),
        shortTermInvestments: this.parseNumeric(sheet.shortTermInvestments),
        cashAndShortTermInvestments: this.parseNumeric(sheet.cashAndShortTermInvestments),
        netReceivables: this.parseNumeric(sheet.netReceivables),
        inventory: this.parseNumeric(sheet.inventory),
        otherCurrentAssets: this.parseNumeric(sheet.otherCurrentAssets),
        totalCurrentAssets: this.parseNumeric(sheet.totalCurrentAssets),
        propertyPlantEquipmentNet: this.parseNumeric(sheet.propertyPlantEquipmentNet),
        goodwill: this.parseNumeric(sheet.goodwill),
        intangibleAssets: this.parseNumeric(sheet.intangibleAssets),
        goodwillAndIntangibleAssets: this.parseNumeric(sheet.goodwillAndIntangibleAssets),
        longTermInvestments: this.parseNumeric(sheet.longTermInvestments),
        taxAssets: this.parseNumeric(sheet.taxAssets),
        otherNonCurrentAssets: this.parseNumeric(sheet.otherNonCurrentAssets),
        totalNonCurrentAssets: this.parseNumeric(sheet.totalNonCurrentAssets),
        totalAssets: this.parseNumeric(sheet.totalAssets),
        accountPayables: this.parseNumeric(sheet.accountPayables),
        shortTermDebt: this.parseNumeric(sheet.shortTermDebt),
        taxPayables: this.parseNumeric(sheet.taxPayables),
        deferredRevenue: this.parseNumeric(sheet.deferredRevenue),
        otherCurrentLiabilities: this.parseNumeric(sheet.otherCurrentLiabilities),
        totalCurrentLiabilities: this.parseNumeric(sheet.totalCurrentLiabilities),
        longTermDebt: this.parseNumeric(sheet.longTermDebt),
        deferredRevenueNonCurrent: this.parseNumeric(sheet.deferredRevenueNonCurrent),
        deferredTaxLiabilitiesNonCurrent: this.parseNumeric(sheet.deferredTaxLiabilitiesNonCurrent),
        otherNonCurrentLiabilities: this.parseNumeric(sheet.otherNonCurrentLiabilities),
        totalNonCurrentLiabilities: this.parseNumeric(sheet.totalNonCurrentLiabilities),
        totalLiabilities: this.parseNumeric(sheet.totalLiabilities),
        preferredStock: this.parseNumeric(sheet.preferredStock),
        commonStock: this.parseNumeric(sheet.commonStock),
        retainedEarnings: this.parseNumeric(sheet.retainedEarnings),
        accumulatedOtherComprehensiveIncomeLoss: this.parseNumeric(sheet.accumulatedOtherComprehensiveIncomeLoss),
        othertotalStockholdersEquity: this.parseNumeric(sheet.othertotalStockholdersEquity),
        totalStockholdersEquity: this.parseNumeric(sheet.totalStockholdersEquity),
        totalEquity: this.parseNumeric(sheet.totalEquity),
        totalLiabilitiesAndStockholdersEquity: this.parseNumeric(sheet.totalLiabilitiesAndStockholdersEquity),
        minorityInterest: this.parseNumeric(sheet.minorityInterest),
        totalLiabilitiesAndTotalEquity: this.parseNumeric(sheet.totalLiabilitiesAndTotalEquity),
        timestamp: Date.now(),
        source: this.getSourceIdentifier()
      }))
    } catch (error) {
      return this.handleApiError(error, symbol, 'balance sheet', [])
    }
  }

  /**
   * Get cash flow statement for a symbol
   */
  async getCashFlowStatement(symbol: string, period: 'annual' | 'quarterly' = 'annual', limit = 5): Promise<CashFlowStatement[]> {
    try {
      this.validateApiKey()
      const normalizedSymbol = this.normalizeSymbol(symbol)

      const response = await this.makeRequest(`/cash-flow-statement/${normalizedSymbol}?period=${period}&limit=${limit}`)

      if (!this.validateResponse(response, 'array')) {
        return []
      }

      return response.data.map((statement: any) => ({
        symbol: normalizedSymbol,
        date: statement.date || '',
        period: statement.period || period,
        netIncome: this.parseNumeric(statement.netIncome),
        depreciationAndAmortization: this.parseNumeric(statement.depreciationAndAmortization),
        deferredIncomeTax: this.parseNumeric(statement.deferredIncomeTax),
        stockBasedCompensation: this.parseNumeric(statement.stockBasedCompensation),
        changeInWorkingCapital: this.parseNumeric(statement.changeInWorkingCapital),
        accountsReceivables: this.parseNumeric(statement.accountsReceivables),
        inventory: this.parseNumeric(statement.inventory),
        accountsPayables: this.parseNumeric(statement.accountsPayables),
        otherWorkingCapital: this.parseNumeric(statement.otherWorkingCapital),
        otherNonCashItems: this.parseNumeric(statement.otherNonCashItems),
        netCashProvidedByOperatingActivities: this.parseNumeric(statement.netCashProvidedByOperatingActivities),
        investmentsInPropertyPlantAndEquipment: this.parseNumeric(statement.investmentsInPropertyPlantAndEquipment),
        acquisitionsNet: this.parseNumeric(statement.acquisitionsNet),
        purchasesOfInvestments: this.parseNumeric(statement.purchasesOfInvestments),
        salesMaturitiesOfInvestments: this.parseNumeric(statement.salesMaturitiesOfInvestments),
        otherInvestingActivites: this.parseNumeric(statement.otherInvestingActivites),
        netCashUsedForInvestingActivites: this.parseNumeric(statement.netCashUsedForInvestingActivites),
        debtRepayment: this.parseNumeric(statement.debtRepayment),
        commonStockIssued: this.parseNumeric(statement.commonStockIssued),
        commonStockRepurchased: this.parseNumeric(statement.commonStockRepurchased),
        dividendsPaid: this.parseNumeric(statement.dividendsPaid),
        otherFinancingActivites: this.parseNumeric(statement.otherFinancingActivites),
        netCashUsedProvidedByFinancingActivities: this.parseNumeric(statement.netCashUsedProvidedByFinancingActivities),
        effectOfForexChangesOnCash: this.parseNumeric(statement.effectOfForexChangesOnCash),
        netChangeInCash: this.parseNumeric(statement.netChangeInCash),
        cashAtEndOfPeriod: this.parseNumeric(statement.cashAtEndOfPeriod),
        cashAtBeginningOfPeriod: this.parseNumeric(statement.cashAtBeginningOfPeriod),
        operatingCashFlow: this.parseNumeric(statement.operatingCashFlow),
        capitalExpenditure: this.parseNumeric(statement.capitalExpenditure),
        freeCashFlow: this.parseNumeric(statement.freeCashFlow),
        timestamp: Date.now(),
        source: this.getSourceIdentifier()
      }))
    } catch (error) {
      return this.handleApiError(error, symbol, 'cash flow statement', [])
    }
  }

  /**
   * Get economic calendar events
   */
  async getEconomicCalendar(from?: string, to?: string): Promise<EconomicEvent[]> {
    try {
      this.validateApiKey()

      const today = new Date().toISOString().split('T')[0]
      const fromDate = from || today
      const toDate = to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days ahead

      const response = await this.makeRequest(`/economic_calendar?from=${fromDate}&to=${toDate}`)

      if (!this.validateResponse(response, 'array')) {
        return []
      }

      return response.data.map((event: any) => ({
        date: event.date || '',
        time: event.time || '',
        country: event.country || '',
        event: event.event || '',
        currency: event.currency || '',
        previous: event.previous !== null ? parseFloat(event.previous) : null,
        estimate: event.estimate !== null ? parseFloat(event.estimate) : null,
        actual: event.actual !== null ? parseFloat(event.actual) : null,
        change: event.change !== null ? parseFloat(event.change) : null,
        changePercentage: event.changePercentage !== null ? parseFloat(event.changePercentage) : null,
        impact: event.impact || 'Low',
        unit: event.unit || undefined,
        timestamp: Date.now(),
        source: this.getSourceIdentifier()
      }))
    } catch (error) {
      return this.handleApiError(error, 'economic calendar', 'economic calendar', [])
    }
  }

  /**
   * Get dividend data for a symbol
   */
  async getDividendData(symbol: string, from?: string, to?: string): Promise<DividendData[]> {
    try {
      this.validateApiKey()
      const normalizedSymbol = this.normalizeSymbol(symbol)

      let endpoint = `/historical-price-full/stock_dividend/${normalizedSymbol}`
      if (from && to) {
        endpoint += `?from=${from}&to=${to}`
      }

      const response = await this.makeRequest(endpoint)

      if (!response.success || !response.data?.historical) {
        return []
      }

      return response.data.historical.map((dividend: any) => ({
        symbol: normalizedSymbol,
        date: dividend.date || '',
        label: dividend.label || '',
        adjDividend: this.parseNumeric(dividend.adjDividend),
        dividend: this.parseNumeric(dividend.dividend),
        recordDate: dividend.recordDate || '',
        paymentDate: dividend.paymentDate || '',
        declarationDate: dividend.declarationDate || '',
        timestamp: Date.now(),
        source: this.getSourceIdentifier()
      }))
    } catch (error) {
      return this.handleApiError(error, symbol, 'dividend data', [])
    }
  }

  /**
   * Get stock split data for a symbol
   */
  async getStockSplitData(symbol: string, from?: string, to?: string): Promise<StockSplit[]> {
    try {
      this.validateApiKey()
      const normalizedSymbol = this.normalizeSymbol(symbol)

      let endpoint = `/historical-price-full/stock_split/${normalizedSymbol}`
      if (from && to) {
        endpoint += `?from=${from}&to=${to}`
      }

      const response = await this.makeRequest(endpoint)

      if (!response.success || !response.data?.historical) {
        return []
      }

      return response.data.historical.map((split: any) => ({
        symbol: normalizedSymbol,
        date: split.date || '',
        label: split.label || '',
        numerator: this.parseNumeric(split.numerator),
        denominator: this.parseNumeric(split.denominator),
        timestamp: Date.now(),
        source: this.getSourceIdentifier()
      }))
    } catch (error) {
      return this.handleApiError(error, symbol, 'stock split data', [])
    }
  }

  /**
   * Get ESG ratings for a symbol
   */
  async getESGRating(symbol: string): Promise<ESGRating | null> {
    try {
      this.validateApiKey()
      const normalizedSymbol = this.normalizeSymbol(symbol)

      const response = await this.makeRequest(`/esg-score?symbol=${normalizedSymbol}`)

      if (!this.validateResponse(response, 'array') || response.data.length === 0) {
        return null
      }

      const esg = response.data[0]
      return {
        symbol: normalizedSymbol,
        companyName: esg.companyName || '',
        environmentalScore: this.parseNumeric(esg.environmentalScore),
        socialScore: this.parseNumeric(esg.socialScore),
        governanceScore: this.parseNumeric(esg.governanceScore),
        ESGScore: this.parseNumeric(esg.ESGScore),
        environmentalGrade: esg.environmentalGrade || '',
        socialGrade: esg.socialGrade || '',
        governanceGrade: esg.governanceGrade || '',
        ESGGrade: esg.ESGGrade || '',
        timestamp: Date.now(),
        source: this.getSourceIdentifier()
      }
    } catch (error) {
      return this.handleApiError(error, symbol, 'ESG rating', null)
    }
  }

  /**
   * Get Treasury rates
   */
  async getTreasuryRates(from?: string, to?: string): Promise<TreasuryRate[]> {
    try {
      this.validateApiKey()

      let endpoint = '/treasury'
      if (from && to) {
        endpoint += `?from=${from}&to=${to}`
      }

      const response = await this.makeRequest(endpoint)

      if (!this.validateResponse(response, 'array')) {
        return []
      }

      return response.data.map((rate: any) => ({
        date: rate.date || '',
        month1: this.parseNumeric(rate.month1),
        month2: this.parseNumeric(rate.month2),
        month3: this.parseNumeric(rate.month3),
        month6: this.parseNumeric(rate.month6),
        year1: this.parseNumeric(rate.year1),
        year2: this.parseNumeric(rate.year2),
        year3: this.parseNumeric(rate.year3),
        year5: this.parseNumeric(rate.year5),
        year7: this.parseNumeric(rate.year7),
        year10: this.parseNumeric(rate.year10),
        year20: this.parseNumeric(rate.year20),
        year30: this.parseNumeric(rate.year30),
        timestamp: Date.now(),
        source: this.getSourceIdentifier()
      }))
    } catch (error) {
      return this.handleApiError(error, 'treasury rates', 'treasury rates', [])
    }
  }

  /**
   * Enhanced batch processing for stock prices with plan optimization
   */
  async getBatchPrices(symbols: string[], options?: {
    planType?: 'basic' | 'starter' | 'professional';
    priorityMode?: boolean;
  }): Promise<Map<string, StockData>> {
    try {
      this.validateApiKey()

      const results = new Map<string, StockData>()
      const normalizedSymbols = symbols.map(s => this.normalizeSymbol(s)).filter(Boolean)

      if (normalizedSymbols.length === 0) {
        return results
      }

      const planType = options?.planType || this.detectPlanType()
      const batchConfig = this.calculateOptimalBatchConfig(planType, normalizedSymbols.length, options?.priorityMode)

      // Use FMP bulk quote endpoint for efficient batch processing
      const endpoint = `/quote/${normalizedSymbols.join(',')}`

      this.errorHandler.logger.info(`Batch price request for ${normalizedSymbols.length} symbols`, {
        planType,
        endpoint,
        utilizationTarget: `${batchConfig.utilizationTarget}%`
      })

      const response = await this.makeRequest(endpoint)

      if (response.success && Array.isArray(response.data)) {
        response.data.forEach((quote: any) => {
          if (quote.symbol && quote.price !== undefined) {
            const stockData = {
              symbol: quote.symbol,
              price: Number(this.parseNumeric(quote.price).toFixed(2)),
              change: Number(this.parseNumeric(quote.change || 0).toFixed(2)),
              changePercent: Number(this.parseNumeric(quote.changesPercentage || 0).toFixed(2)),
              volume: this.parseInt(quote.volume || 0),
              timestamp: quote.timestamp ? new Date(quote.timestamp * 1000).getTime() : Date.now(),
              source: this.getSourceIdentifier()
            }

            results.set(quote.symbol, stockData)
          }
        })

        this.errorHandler.logger.info(`Batch prices completed`, {
          requested: normalizedSymbols.length,
          retrieved: results.size,
          successRate: `${((results.size / normalizedSymbols.length) * 100).toFixed(1)}%`
        })
      }

      return results
    } catch (error) {
      this.errorHandler.logger.error('Batch prices failed', { error, symbolCount: symbols.length })
      if (this.throwErrors) throw error
      return new Map()
    }
  }

  /**
   * Get comprehensive financial data bundle for a symbol
   * Combines multiple endpoints for complete financial overview
   */
  async getComprehensiveFinancialData(symbol: string, options?: {
    includeAnnual?: boolean;
    includeQuarterly?: boolean;
    includeDividends?: boolean;
    includeSplits?: boolean;
    includeESG?: boolean;
    limit?: number;
  }): Promise<{
    symbol: string;
    incomeStatement?: {
      annual: FinancialStatement[];
      quarterly: FinancialStatement[];
    };
    balanceSheet?: {
      annual: BalanceSheet[];
      quarterly: BalanceSheet[];
    };
    cashFlow?: {
      annual: CashFlowStatement[];
      quarterly: CashFlowStatement[];
    };
    dividends?: DividendData[];
    splits?: StockSplit[];
    esg?: ESGRating;
    timestamp: number;
  }> {
    try {
      this.validateApiKey()
      const normalizedSymbol = this.normalizeSymbol(symbol)
      const limit = options?.limit || 3

      const {
        includeAnnual = true,
        includeQuarterly = false,
        includeDividends = false,
        includeSplits = false,
        includeESG = false
      } = options || {}

      this.errorHandler.logger.info('Fetching comprehensive financial data', {
        symbol: normalizedSymbol,
        includeAnnual,
        includeQuarterly,
        includeDividends,
        includeSplits,
        includeESG,
        limit
      })

      // Execute parallel requests for better performance
      const promises: Promise<any>[] = []
      const requestTypes: string[] = []

      if (includeAnnual) {
        promises.push(this.getIncomeStatement(normalizedSymbol, 'annual', limit))
        requestTypes.push('incomeAnnual')
        promises.push(this.getBalanceSheet(normalizedSymbol, 'annual', limit))
        requestTypes.push('balanceAnnual')
        promises.push(this.getCashFlowStatement(normalizedSymbol, 'annual', limit))
        requestTypes.push('cashFlowAnnual')
      }

      if (includeQuarterly) {
        promises.push(this.getIncomeStatement(normalizedSymbol, 'quarterly', limit))
        requestTypes.push('incomeQuarterly')
        promises.push(this.getBalanceSheet(normalizedSymbol, 'quarterly', limit))
        requestTypes.push('balanceQuarterly')
        promises.push(this.getCashFlowStatement(normalizedSymbol, 'quarterly', limit))
        requestTypes.push('cashFlowQuarterly')
      }

      if (includeDividends) {
        promises.push(this.getDividendData(normalizedSymbol))
        requestTypes.push('dividends')
      }

      if (includeSplits) {
        promises.push(this.getStockSplitData(normalizedSymbol))
        requestTypes.push('splits')
      }

      if (includeESG) {
        promises.push(this.getESGRating(normalizedSymbol))
        requestTypes.push('esg')
      }

      // Execute all requests in parallel with timeout handling
      const results = await Promise.allSettled(promises)

      const successfulResults: Record<string, any> = {}
      const errors: string[] = []

      results.forEach((result, index) => {
        const requestType = requestTypes[index]
        if (result.status === 'fulfilled') {
          successfulResults[requestType] = result.value
        } else {
          errors.push(`${requestType}: ${result.reason}`)
          this.errorHandler.logger.warn(`Failed to fetch ${requestType} for ${normalizedSymbol}`, {
            error: result.reason
          })
        }
      })

      // Structure the comprehensive response
      const comprehensiveData: any = {
        symbol: normalizedSymbol,
        timestamp: Date.now()
      }

      if (includeAnnual || includeQuarterly) {
        if (successfulResults.incomeAnnual || successfulResults.incomeQuarterly) {
          comprehensiveData.incomeStatement = {
            annual: successfulResults.incomeAnnual || [],
            quarterly: successfulResults.incomeQuarterly || []
          }
        }

        if (successfulResults.balanceAnnual || successfulResults.balanceQuarterly) {
          comprehensiveData.balanceSheet = {
            annual: successfulResults.balanceAnnual || [],
            quarterly: successfulResults.balanceQuarterly || []
          }
        }

        if (successfulResults.cashFlowAnnual || successfulResults.cashFlowQuarterly) {
          comprehensiveData.cashFlow = {
            annual: successfulResults.cashFlowAnnual || [],
            quarterly: successfulResults.cashFlowQuarterly || []
          }
        }
      }

      if (includeDividends && successfulResults.dividends) {
        comprehensiveData.dividends = successfulResults.dividends
      }

      if (includeSplits && successfulResults.splits) {
        comprehensiveData.splits = successfulResults.splits
      }

      if (includeESG && successfulResults.esg) {
        comprehensiveData.esg = successfulResults.esg
      }

      // Log completion summary
      const totalRequests = promises.length
      const successfulRequests = totalRequests - errors.length
      const successRate = ((successfulRequests / totalRequests) * 100).toFixed(1)

      this.errorHandler.logger.info('Comprehensive financial data completed', {
        symbol: normalizedSymbol,
        totalRequests,
        successfulRequests,
        successRate: `${successRate}%`,
        errors: errors.length > 0 ? errors : undefined
      })

      return comprehensiveData
    } catch (error) {
      this.errorHandler.logger.error('Comprehensive financial data failed', {
        symbol,
        error
      })
      if (this.throwErrors) throw error
      return {
        symbol: this.normalizeSymbol(symbol),
        timestamp: Date.now()
      }
    }
  }

  /**
   * Enhanced error handling with FMP-specific error codes
   */
  private handleFMPError(error: any, context: string, symbol?: string): string {
    if (typeof error === 'string') {
      // Check for common FMP error patterns
      if (error.includes('API rate limit exceeded')) {
        this.errorHandler.logger.warn('FMP rate limit exceeded', { context, symbol })
        return 'Rate limit exceeded - please wait before retrying'
      }
      if (error.includes('Invalid API key')) {
        this.errorHandler.logger.error('Invalid FMP API key', { context })
        return 'API authentication failed'
      }
      if (error.includes('Symbol not found')) {
        this.errorHandler.logger.debug('Symbol not found in FMP', { context, symbol })
        return `Symbol ${symbol} not found`
      }
      if (error.includes('insufficient')) {
        this.errorHandler.logger.warn('Insufficient FMP plan permissions', { context, symbol })
        return 'API plan does not support this data type'
      }
    }

    return error instanceof Error ? error.message : 'Unknown FMP API error'
  }

  /**
   * Make HTTP request to Financial Modeling Prep API with enhanced error handling
   */
  private async makeRequest(endpoint: string): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const url = new URL(`${this.baseUrl}${endpoint}`)
      url.searchParams.append('apikey', this.apiKey)

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VFR-API/1.0'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Enhanced FMP error detection and handling
      if (data?.['Error Message']) {
        const errorMsg = this.handleFMPError(data['Error Message'], 'api_response')
        throw new Error(errorMsg)
      }

      if (data?.error) {
        const errorMsg = this.handleFMPError(data.error, 'api_response')
        throw new Error(errorMsg)
      }

      // Enhanced rate limit detection
      if (typeof data === 'string') {
        if (data.includes('limit') || data.includes('exceeded') || data.includes('quota')) {
          throw new Error('API rate limit exceeded')
        }
        if (data.includes('invalid') && data.includes('key')) {
          throw new Error('Invalid API key')
        }
        if (data.includes('not found') || data.includes('404')) {
          throw new Error('Symbol not found')
        }
      }

      // Check for empty or insufficient data responses
      if (Array.isArray(data) && data.length === 0) {
        this.errorHandler.logger.debug('FMP returned empty array response')
      }

      return {
        success: true,
        data,
        source: 'fmp',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'fmp',
        timestamp: Date.now()
      }
    }
  }
}