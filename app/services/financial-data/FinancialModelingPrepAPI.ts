/**
 * Direct Financial Modeling Prep API implementation
 * Follows the same patterns as AlphaVantageAPI for consistency
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse, FundamentalRatios } from './types'

export class FinancialModelingPrepAPI implements FinancialDataProvider {
  name = 'Financial Modeling Prep'
  private baseUrl = 'https://financialmodelingprep.com/stable'
  private apiKey: string
  private timeout: number
  private throwErrors: boolean

  constructor(apiKey?: string, timeout = 15000, throwErrors = false) {
    this.apiKey = apiKey || process.env.FMP_API_KEY || ''
    this.timeout = timeout
    this.throwErrors = throwErrors
  }

  /**
   * Get current stock price data
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('Financial Modeling Prep API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const response = await this.makeRequest(`/quote?symbol=${symbol.toUpperCase()}`)

      if (!response.success) {
        const error = new Error(response.error || 'Financial Modeling Prep API request failed')
        if (this.throwErrors) throw error
        return null
      }

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        const error = new Error('Invalid response format from Financial Modeling Prep API')
        if (this.throwErrors) throw error
        return null
      }

      const quote = response.data[0]
      const price = parseFloat(quote.price || '0')
      const change = parseFloat(quote.change || '0')
      const changePercent = parseFloat(quote.changesPercentage || '0')

      return {
        symbol: symbol.toUpperCase(),
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: parseInt(quote.volume || '0'),
        timestamp: quote.timestamp ? new Date(quote.timestamp * 1000).getTime() : Date.now(),
        source: 'fmp'
      }
    } catch (error) {
      console.error(`Financial Modeling Prep API error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Get company information
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('Financial Modeling Prep API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const response = await this.makeRequest(`/profile?symbol=${symbol.toUpperCase()}`)

      if (!response.success) {
        const error = new Error(response.error || 'Financial Modeling Prep API request failed')
        if (this.throwErrors) throw error
        return null
      }

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        const error = new Error('Invalid company data response from Financial Modeling Prep API')
        if (this.throwErrors) throw error
        return null
      }

      const profile = response.data[0]

      return {
        symbol: symbol.toUpperCase(),
        name: profile.companyName || '',
        description: profile.description || '',
        sector: profile.sector || '',
        marketCap: parseInt(profile.mktCap || '0'),
        employees: parseInt(profile.fullTimeEmployees || '0'),
        website: profile.website || ''
      }
    } catch (error) {
      console.error(`Financial Modeling Prep company info error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
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
      console.log(`📊 FMP: Fetched ${response.data.historical.length} days of historical data for ${symbol}`)

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
      console.error(`Financial Modeling Prep market data error for ${symbol}:`, error)
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
      console.error(`Financial Modeling Prep historical data error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return []
    }
  }

  /**
   * Health check for Financial Modeling Prep API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        console.warn('Financial Modeling Prep API key not configured')
        return false
      }

      const response = await this.makeRequest('/quote?symbol=AAPL')

      if (!response.success) {
        console.warn('Financial Modeling Prep health check failed:', response.error || 'Unknown error')
        return false
      }

      // Check for success, no error message, and presence of expected data structure
      return response.success &&
             Array.isArray(response.data) &&
             response.data.length > 0 &&
             !!response.data[0]?.price
    } catch (error) {
      console.error('Financial Modeling Prep health check failed:', error instanceof Error ? error.message : error)
      return false
    }
  }

  /**
   * Get fundamental ratios for a stock
   */
  async getFundamentalRatios(symbol: string): Promise<FundamentalRatios | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('Financial Modeling Prep API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      // Get both ratios and key metrics for comprehensive data
      const [ratiosResponse, metricsResponse] = await Promise.all([
        this.makeRequest(`/ratios-ttm?symbol=${symbol.toUpperCase()}`),
        this.makeRequest(`/key-metrics-ttm?symbol=${symbol.toUpperCase()}`)
      ])

      if (!ratiosResponse.success && !metricsResponse.success) {
        const error = new Error('Failed to fetch fundamental data from FMP')
        if (this.throwErrors) throw error
        return null
      }

      // Extract ratios data
      const ratiosData = ratiosResponse.success && Array.isArray(ratiosResponse.data) && ratiosResponse.data[0]
        ? ratiosResponse.data[0]
        : {}

      // Extract metrics data
      const metricsData = metricsResponse.success && Array.isArray(metricsResponse.data) && metricsResponse.data[0]
        ? metricsResponse.data[0]
        : {}

      return {
        symbol: symbol.toUpperCase(),
        peRatio: parseFloat(metricsData.peRatioTTM) || parseFloat(ratiosData.priceEarningsRatioTTM) || undefined,
        pegRatio: parseFloat(metricsData.pegRatioTTM) || undefined,
        pbRatio: parseFloat(metricsData.priceToBookRatioTTM) || parseFloat(ratiosData.priceToBookRatioTTM) || undefined,
        priceToSales: parseFloat(metricsData.priceToSalesRatioTTM) || parseFloat(ratiosData.priceToSalesRatioTTM) || undefined,
        priceToFreeCashFlow: parseFloat(metricsData.priceToFreeCashFlowsRatioTTM) || parseFloat(ratiosData.priceToFreeCashFlowsRatioTTM) || undefined,
        debtToEquity: parseFloat(ratiosData.debtEquityRatioTTM) || undefined,
        currentRatio: parseFloat(ratiosData.currentRatioTTM) || undefined,
        quickRatio: parseFloat(ratiosData.quickRatioTTM) || undefined,
        roe: parseFloat(ratiosData.returnOnEquityTTM) || undefined,
        roa: parseFloat(ratiosData.returnOnAssetsTTM) || undefined,
        grossProfitMargin: parseFloat(ratiosData.grossProfitMarginTTM) || undefined,
        operatingMargin: parseFloat(ratiosData.operatingProfitMarginTTM) || undefined,
        netProfitMargin: parseFloat(ratiosData.netProfitMarginTTM) || undefined,
        dividendYield: parseFloat(metricsData.dividendYieldTTM) || parseFloat(ratiosData.dividendYieldTTM) || undefined,
        payoutRatio: parseFloat(ratiosData.payoutRatioTTM) || undefined,
        timestamp: Date.now(),
        source: 'fmp',
        period: 'ttm'
      }
    } catch (error) {
      console.error(`Financial Modeling Prep fundamental ratios error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
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
      console.error(`Financial Modeling Prep sector data error for ${sector}:`, error)
      return []
    }
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