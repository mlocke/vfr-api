/**
 * TwelveData API implementation
 * Provides access to real-time and historical financial market data
 * API Documentation: https://twelvedata.com/docs
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse, AnalystRatings, PriceTarget, RatingChange } from './types.js'

interface TwelveDataPrice {
  price: string
}

interface TwelveDataQuote {
  symbol: string
  name: string
  exchange: string
  mic_code: string
  currency: string
  datetime: string
  timestamp: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  previous_close: string
  change: string
  percent_change: string
  average_volume: string
  is_market_open: boolean
  fifty_two_week?: {
    low: string
    high: string
    low_change: string
    high_change: string
    low_change_percent: string
    high_change_percent: string
    range: string
  }
}

interface TwelveDataProfile {
  symbol: string
  name: string
  exchange: string
  mic_code: string
  sector: string
  industry: string
  employees: number
  website: string
  description: string
  type: string
  ceo: string
  address: string
  address2: string
  city: string
  zip: string
  state: string
  country: string
  phone: string
}

interface TwelveDataTimeSeries {
  meta: {
    symbol: string
    interval: string
    currency: string
    exchange_timezone: string
    exchange: string
    mic_code: string
    type: string
  }
  values: Array<{
    datetime: string
    open: string
    high: string
    low: string
    close: string
    volume: string
  }>
  status: string
}

export class TwelveDataAPI implements FinancialDataProvider {
  name = 'TwelveData API'
  private baseUrl = 'https://api.twelvedata.com'
  private apiKey: string
  private timeout: number
  private throwErrors: boolean

  constructor(apiKey?: string, timeout = 10000, throwErrors = false) {
    this.apiKey = apiKey || process.env.TWELVE_DATA_API_KEY || ''
    this.timeout = timeout
    this.throwErrors = throwErrors

    if (this.apiKey && !this.isValidApiKeyFormat(this.apiKey)) {
      console.warn('TwelveData API key format appears invalid. Expected a 32-character alphanumeric string.')
      if (this.throwErrors) throw new Error('Invalid TwelveData API key format')
    }
  }

  /**
   * Validate TwelveData API key format
   * TwelveData typically uses 32-character alphanumeric strings
   */
  private isValidApiKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false
    // TwelveData API key is typically 32 characters, alphanumeric
    const twelveDataKeyPattern = /^[a-zA-Z0-9]{32}$/
    return twelveDataKeyPattern.test(apiKey)
  }

  /**
   * Get current stock price
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('TwelveData API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      // First try the simple price endpoint
      const priceResponse = await this.makeRequest('price', {
        symbol: symbol.toUpperCase(),
        apikey: this.apiKey
      })

      if (priceResponse.success && priceResponse.data?.price) {
        const priceData = priceResponse.data as TwelveDataPrice
        const price = parseFloat(priceData.price)

        if (!isNaN(price)) {
          return {
            symbol: symbol.toUpperCase(),
            price: Number(price.toFixed(2)),
            change: 0, // Simple price endpoint doesn't provide change
            changePercent: 0,
            volume: 0,
            timestamp: Date.now(),
            source: 'twelvedata'
          }
        }
      }

      // Fallback to quote endpoint for more detailed data
      const quoteResponse = await this.makeRequest('quote', {
        symbol: symbol.toUpperCase(),
        apikey: this.apiKey
      })

      if (!quoteResponse.success || !quoteResponse.data) {
        return null
      }

      const quote = quoteResponse.data as TwelveDataQuote

      // Validate required fields
      if (!quote.close) {
        console.warn(`TwelveData: Missing price data for ${symbol}`)
        return null
      }

      const price = parseFloat(quote.close)
      const change = quote.change ? parseFloat(quote.change) : 0
      const changePercent = quote.percent_change ? parseFloat(quote.percent_change) : 0
      const volume = quote.volume ? parseInt(quote.volume) : 0

      if (isNaN(price)) {
        console.warn(`TwelveData: Invalid price data for ${symbol}`)
        return null
      }

      return {
        symbol: symbol.toUpperCase(),
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume,
        timestamp: quote.timestamp ? quote.timestamp * 1000 : Date.now(),
        source: 'twelvedata'
      }
    } catch (error) {
      console.error(`TwelveData API error for ${symbol}:`, error)
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
        const error = new Error('TwelveData API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const response = await this.makeRequest('profile', {
        symbol: symbol.toUpperCase(),
        apikey: this.apiKey
      })

      if (!response.success || !response.data) {
        return null
      }

      const profile = response.data as TwelveDataProfile

      return {
        symbol: symbol.toUpperCase(),
        name: profile.name || symbol.toUpperCase(),
        description: profile.description || `Company profile for ${symbol.toUpperCase()}`,
        sector: profile.sector || 'Unknown',
        marketCap: 0, // TwelveData doesn't provide market cap in profile endpoint
        employees: profile.employees || 0
      }
    } catch (error) {
      console.error(`TwelveData company info error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Get market data (OHLCV)
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('TwelveData API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const response = await this.makeRequest('quote', {
        symbol: symbol.toUpperCase(),
        apikey: this.apiKey
      })

      if (!response.success || !response.data) {
        return null
      }

      const quote = response.data as TwelveDataQuote

      // Validate required fields
      if (!quote.open || !quote.high || !quote.low || !quote.close) {
        console.warn(`TwelveData: Missing OHLC data for ${symbol}`)
        return null
      }

      const open = parseFloat(quote.open)
      const high = parseFloat(quote.high)
      const low = parseFloat(quote.low)
      const close = parseFloat(quote.close)
      const volume = quote.volume ? parseInt(quote.volume) : 0

      if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
        console.warn(`TwelveData: Invalid OHLC data for ${symbol}`)
        return null
      }

      return {
        symbol: symbol.toUpperCase(),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume,
        timestamp: quote.timestamp * 1000, // Convert to milliseconds
        source: 'twelvedata'
      }
    } catch (error) {
      console.error(`TwelveData market data error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Health check for TwelveData API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        console.warn('TwelveData API key not configured')
        return false
      }

      // Test with a simple price request for AAPL
      const response = await this.makeRequest('price', {
        symbol: 'AAPL',
        apikey: this.apiKey
      })

      return response.success && !!response.data?.price
    } catch (error) {
      console.error('TwelveData health check failed:', error instanceof Error ? error.message : error)
      return false
    }
  }

  /**
   * Get time series data
   */
  async getTimeSeries(symbol: string, interval = '1day', outputsize = 30): Promise<any[]> {
    try {
      if (!this.apiKey) {
        const error = new Error('TwelveData API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return []
      }

      const response = await this.makeRequest('time_series', {
        symbol: symbol.toUpperCase(),
        interval,
        outputsize: outputsize.toString(),
        apikey: this.apiKey
      })

      if (!response.success || !response.data?.values) {
        return []
      }

      const timeSeries = response.data as TwelveDataTimeSeries
      return timeSeries.values || []
    } catch (error) {
      console.error(`TwelveData time series error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return []
    }
  }

  /**
   * Get historical OHLC data for technical analysis
   */
  async getHistoricalOHLC(symbol: string, days = 50): Promise<import('./types').HistoricalOHLC[]> {
    try {
      if (!this.apiKey) {
        const error = new Error('TwelveData API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return []
      }

      // Get time series data with daily interval
      const response = await this.makeRequest('time_series', {
        symbol: symbol.toUpperCase(),
        interval: '1day',
        outputsize: Math.min(days, 100).toString(), // TwelveData free tier limits
        apikey: this.apiKey
      })

      if (!response.success || !response.data?.values) {
        console.warn(`TwelveData: No historical data for ${symbol}`)
        return []
      }

      const timeSeries = response.data as TwelveDataTimeSeries
      const values = timeSeries.values || []

      // Convert TwelveData format to our OHLC format
      const ohlcData = values.map((item: any) => ({
        timestamp: new Date(item.datetime).getTime(),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseInt(item.volume) || 0,
        date: item.datetime
      })).filter(item =>
        !isNaN(item.open) && !isNaN(item.high) &&
        !isNaN(item.low) && !isNaN(item.close)
      )

      // Sort by timestamp (oldest first) for technical analysis
      ohlcData.sort((a, b) => a.timestamp - b.timestamp)

      console.log(`TwelveData: Retrieved ${ohlcData.length} OHLC records for ${symbol}`)
      return ohlcData

    } catch (error) {
      console.error(`TwelveData historical OHLC error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return []
    }
  }

  /**
   * Get analyst ratings (limited support - TwelveData doesn't have comprehensive analyst data)
   */
  async getAnalystRatings(symbol: string): Promise<AnalystRatings | null> {
    console.warn(`TwelveData: Analyst ratings not supported for ${symbol}. Use Financial Modeling Prep as primary source.`)
    return null
  }

  /**
   * Get price targets (limited support - TwelveData doesn't have comprehensive price target data)
   */
  async getPriceTargets(symbol: string): Promise<PriceTarget | null> {
    console.warn(`TwelveData: Price targets not supported for ${symbol}. Use Financial Modeling Prep as primary source.`)
    return null
  }

  /**
   * Get recent rating changes (not supported by TwelveData)
   */
  async getRecentRatingChanges(symbol: string, limit = 10): Promise<RatingChange[]> {
    console.warn(`TwelveData: Rating changes not supported for ${symbol}. Use Financial Modeling Prep as primary source.`)
    return []
  }

  /**
   * Make HTTP request to TwelveData API
   */
  private async makeRequest(endpoint: string, params: Record<string, string>): Promise<ApiResponse<any>> {
    try {
      // Construct URL - TwelveData API format: https://api.twelvedata.com/price?symbol=AAPL&apikey=your_api_key
      const fullUrl = `${this.baseUrl}/${endpoint}`
      const url = new URL(fullUrl)

      // Add parameters
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })

      console.log(`🌐 TwelveData API URL: ${url.toString()}`)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VFR-API/1.0 (contact@veritak.com)'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Check for TwelveData API error messages
      if (data.code && data.message) {
        let errorMessage = data.message

        // Provide more helpful error messages for common issues
        if (data.code === 400) {
          errorMessage = 'TwelveData API: Bad request. Check your parameters.'
        } else if (data.code === 401) {
          errorMessage = 'TwelveData API key is invalid. Please check your TWELVE_DATA_API_KEY environment variable.'
        } else if (data.code === 429) {
          errorMessage = 'TwelveData API rate limit exceeded. Please try again later.'
        }

        throw new Error(errorMessage)
      }

      return {
        success: true,
        data,
        source: 'twelvedata',
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'twelvedata',
        timestamp: Date.now()
      }
    }
  }
}