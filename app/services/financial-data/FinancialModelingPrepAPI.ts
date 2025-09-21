/**
 * Direct Financial Modeling Prep API implementation
 * Follows the same patterns as AlphaVantageAPI for consistency
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse, FundamentalRatios, AnalystRatings, PriceTarget, RatingChange } from './types'
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

      return {
        symbol: normalizedSymbol,
        price: Number(this.parseNumeric(quote.price).toFixed(2)),
        change: Number(this.parseNumeric(quote.change).toFixed(2)),
        changePercent: Number(this.parseNumeric(quote.changesPercentage).toFixed(2)),
        volume: this.parseInt(quote.volume),
        timestamp: quote.timestamp ? new Date(quote.timestamp * 1000).getTime() : Date.now(),
        source: this.getSourceIdentifier()
      }
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
      return await this.errorHandler.validateAndExecute(
        () => this.executeGetFundamentalRatios(symbol),
        [symbol],
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
   * Make HTTP request to Financial Modeling Prep API
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

      // Check for API error messages
      if (data?.['Error Message']) {
        throw new Error(data['Error Message'])
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      // Check for rate limit messages
      if (typeof data === 'string' && data.includes('limit')) {
        throw new Error('API rate limit exceeded')
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