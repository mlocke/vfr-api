/**
 * Direct Alpha Vantage API implementation
 * Replaces MCP-based Alpha Vantage data fetching with direct REST API calls
 *
 * OPTIONS DATA LIMITATION NOTICE:
 * ==============================
 *
 * Alpha Vantage options data is NOT available on the free tier:
 * - Free tier: 25 requests/day, includes stocks, forex, crypto, fundamentals
 * - Options data: Requires premium subscription ($75/month+)
 * - Available endpoints (premium only):
 *   • HISTORICAL_OPTIONS: Full historical options chain (15+ years)
 *   • REALTIME_OPTIONS: Real-time options trending data
 *   • Includes Greeks, implied volatility, JSON/CSV formats
 *
 * Current implementation status:
 * - getPutCallRatio(): Returns null, logs premium requirement
 * - getOptionsAnalysisFreeTier(): Returns null, shows premium structure
 * - getOptionsChain(): Returns null, documents premium API format
 * - checkOptionsAvailability(): Returns false for all options features
 *
 * Alternative free options sources:
 * - Yahoo Finance unofficial API (implemented in YahooFinanceAPI.ts)
 * - Polygon.io (free tier has limited options, 403 errors common)
 * - TwelveData (requires paid plan for options)
 *
 * Future upgrade path:
 * When Alpha Vantage premium is subscribed, methods are ready for implementation
 * with proper endpoint structures documented in each method.
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse, OptionsContract, OptionsChain, PutCallRatio, OptionsAnalysis } from './types'

export class AlphaVantageAPI implements FinancialDataProvider {
  name = 'Alpha Vantage'
  private baseUrl = 'https://www.alphavantage.co/query'
  private apiKey: string
  private timeout: number
  private throwErrors: boolean

  constructor(apiKey?: string, timeout = 15000, throwErrors = false) {
    this.apiKey = apiKey || process.env.ALPHA_VANTAGE_API_KEY || ''
    this.timeout = timeout
    this.throwErrors = throwErrors
  }

  /**
   * Get current stock price data
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('Alpha Vantage API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const response = await this.makeRequest({
        function: 'GLOBAL_QUOTE',
        symbol: symbol.toUpperCase(),
        apikey: this.apiKey
      })

      if (!response.success) {
        const error = new Error(response.error || 'Alpha Vantage API request failed')
        if (this.throwErrors) throw error
        return null
      }

      if (!response.data?.['Global Quote']) {
        const error = new Error('Invalid response format from Alpha Vantage API')
        if (this.throwErrors) throw error
        return null
      }

      const quote = response.data['Global Quote']
      const price = parseFloat(quote['05. price'] || '0')
      const change = parseFloat(quote['09. change'] || '0')
      const changePercent = parseFloat(quote['10. change percent']?.replace('%', '') || '0')

      return {
        symbol: symbol.toUpperCase(),
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: parseInt(quote['06. volume'] || '0'),
        timestamp: new Date(quote['07. latest trading day']).getTime() || Date.now(),
        source: 'alphavantage'
      }
    } catch (error) {
      console.error(`Alpha Vantage API error for ${symbol}:`, error)
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
        const error = new Error('Alpha Vantage API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const response = await this.makeRequest({
        function: 'OVERVIEW',
        symbol: symbol.toUpperCase(),
        apikey: this.apiKey
      })

      if (!response.success) {
        const error = new Error(response.error || 'Alpha Vantage API request failed')
        if (this.throwErrors) throw error
        return null
      }

      if (!response.data?.Symbol) {
        const error = new Error('Invalid company data response from Alpha Vantage API')
        if (this.throwErrors) throw error
        return null
      }

      const overview = response.data

      return {
        symbol: symbol.toUpperCase(),
        name: overview.Name || '',
        description: overview.Description || '',
        sector: overview.Sector || '',
        marketCap: parseInt(overview.MarketCapitalization || '0'),
        employees: parseInt(overview.FullTimeEmployees || '0')
      }
    } catch (error) {
      console.error(`Alpha Vantage company info error for ${symbol}:`, error)
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
        const error = new Error('Alpha Vantage API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const response = await this.makeRequest({
        function: 'TIME_SERIES_DAILY',
        symbol: symbol.toUpperCase(),
        apikey: this.apiKey
      })

      if (!response.success) {
        const error = new Error(response.error || 'Alpha Vantage API request failed')
        if (this.throwErrors) throw error
        return null
      }

      if (!response.data?.['Time Series (Daily)']) {
        const error = new Error('Invalid time series data response from Alpha Vantage API')
        if (this.throwErrors) throw error
        return null
      }

      const timeSeries = response.data['Time Series (Daily)']
      const latestDate = Object.keys(timeSeries)[0]
      const latestData = timeSeries[latestDate]

      return {
        symbol: symbol.toUpperCase(),
        open: parseFloat(latestData['1. open'] || '0'),
        high: parseFloat(latestData['2. high'] || '0'),
        low: parseFloat(latestData['3. low'] || '0'),
        close: parseFloat(latestData['4. close'] || '0'),
        volume: parseInt(latestData['5. volume'] || '0'),
        timestamp: new Date(latestDate).getTime(),
        source: 'alphavantage'
      }
    } catch (error) {
      console.error(`Alpha Vantage market data error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Health check for Alpha Vantage API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        console.warn('Alpha Vantage API key not configured')
        return false
      }

      const response = await this.makeRequest({
        function: 'GLOBAL_QUOTE',
        symbol: 'AAPL',
        apikey: this.apiKey
      })

      // Check for rate limit error first
      if (response.success && response.data?.['Information']) {
        const info = response.data['Information']
        if (info.includes('rate limit')) {
          console.warn('Alpha Vantage API rate limit exceeded:', info)
          throw new Error('Alpha Vantage API rate limit exceeded (25 requests/day)')
        }
      }

      // Check for success, no error message, and presence of expected data structure
      return response.success &&
             !response.data?.['Error Message'] &&
             !!response.data?.['Global Quote']
    } catch (error) {
      console.error('Alpha Vantage health check failed:', error instanceof Error ? error.message : error)
      return false
    }
  }

  /**
   * Get stocks by sector using Alpha Vantage's sector performance endpoint
   */
  async getStocksBySector(sector: string, limit = 20): Promise<StockData[]> {
    try {
      if (!this.apiKey) {
        console.warn('Alpha Vantage API key not configured')
        return []
      }

      // Alpha Vantage doesn't have a direct stocks-by-sector endpoint
      // This would require additional logic to map sectors to known symbols
      // For now, return empty array and rely on other providers
      console.warn('Alpha Vantage sector search not implemented - use alternative method')
      return []
    } catch (error) {
      console.error(`Alpha Vantage sector data error for ${sector}:`, error)
      return []
    }
  }

  /**
   * Get put/call ratio - NOT AVAILABLE on Alpha Vantage free tier
   *
   * Alpha Vantage options data requires premium subscription:
   * - Realtime Options Trending (Premium)
   * - Historical Options Trending (Premium)
   *
   * Free tier limitation: Options data is not included in the 25 requests/day free plan
   * Alternative: Consider Yahoo Finance unofficial API or upgrade to premium plan
   */
  async getPutCallRatio(symbol: string): Promise<PutCallRatio | null> {
    console.warn('🚫 Alpha Vantage options data requires premium subscription')
    console.warn('📊 Free tier limitation: Put/call ratio not available')
    console.warn('💡 Consider upgrading to Alpha Vantage premium or using alternative sources')

    if (this.throwErrors) {
      throw new Error('Alpha Vantage options data requires premium subscription')
    }

    return null
  }

  /**
   * Get options analysis - NOT AVAILABLE on Alpha Vantage free tier
   *
   * Alpha Vantage provides advanced options analytics only in premium plans:
   * - Full historical options chain (15+ years)
   * - Options implied volatility and Greeks
   * - Real-time options trending data
   *
   * This method serves as a placeholder for future premium implementation
   */
  async getOptionsAnalysisFreeTier(symbol: string): Promise<OptionsAnalysis | null> {
    console.warn('🚫 Alpha Vantage options analysis requires premium subscription')
    console.warn('📈 Free tier limitation: Advanced options analytics not available')
    console.warn('🔧 Method ready for premium implementation when subscription is upgraded')

    // For documentation purposes, show what the premium implementation would look like:
    if (process.env.NODE_ENV === 'development') {
      console.info('💡 Premium implementation would use these endpoints:')
      console.info('   - Historical Options Trending: function=HISTORICAL_OPTIONS')
      console.info('   - Realtime Options Trending: function=REALTIME_OPTIONS')
      console.info('   - Parameters: symbol, date, require_greeks, contract')
    }

    if (this.throwErrors) {
      throw new Error('Alpha Vantage options analysis requires premium subscription')
    }

    return null
  }

  /**
   * Get options chain - NOT AVAILABLE on Alpha Vantage free tier
   *
   * Premium features that would be available with subscription:
   * - Complete options chain for any symbol
   * - Historical options data (15+ years)
   * - Greeks and implied volatility
   * - JSON and CSV output formats
   *
   * Implementation ready for premium upgrade
   */
  async getOptionsChain(symbol: string, expiration?: string): Promise<OptionsChain | null> {
    console.warn('🚫 Alpha Vantage options chain requires premium subscription')
    console.warn('🔗 Free tier limitation: Options chain data not available')
    console.warn('⏰ Premium would provide historical and realtime options chains')

    // Document the premium API structure for future implementation:
    if (process.env.NODE_ENV === 'development') {
      console.info('💡 Premium API structure:')
      console.info('   - Endpoint: HISTORICAL_OPTIONS or REALTIME_OPTIONS')
      console.info('   - Required: symbol parameter')
      console.info('   - Optional: date, require_greeks, contract')
      console.info('   - Output: Complete options chain with strikes and expirations')
    }

    if (this.throwErrors) {
      throw new Error('Alpha Vantage options chain requires premium subscription')
    }

    return null
  }

  /**
   * Check if Alpha Vantage options features are available
   *
   * Returns availability status for options endpoints
   * All options features require premium subscription
   */
  async checkOptionsAvailability(): Promise<{ [key: string]: boolean | string }> {
    return {
      putCallRatio: false,
      optionsAnalysis: false,
      optionsChain: false,
      premiumRequired: true,
      freeTierLimited: true,
      message: 'Alpha Vantage options data requires premium subscription'
    }
  }

  /**
   * Make HTTP request to Alpha Vantage API
   */
  private async makeRequest(params: Record<string, string>): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const url = new URL(this.baseUrl)
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })

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
      if (data['Error Message']) {
        throw new Error(data['Error Message'])
      }

      if (data['Note']) {
        throw new Error('Alpha Vantage API rate limit exceeded')
      }

      // Check for rate limit information message
      if (data['Information'] && data['Information'].includes('rate limit')) {
        throw new Error('Alpha Vantage API rate limit exceeded (25 requests/day)')
      }

      return {
        success: true,
        data,
        source: 'alphavantage',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'alphavantage',
        timestamp: Date.now()
      }
    }
  }
}