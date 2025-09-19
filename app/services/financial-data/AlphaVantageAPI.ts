/**
 * Direct Alpha Vantage API implementation
 * Replaces MCP-based Alpha Vantage data fetching with direct REST API calls
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types'

export class AlphaVantageAPI implements FinancialDataProvider {
  name = 'Alpha Vantage'
  private baseUrl = 'https://www.alphavantage.co/query'
  private apiKey: string
  private timeout: number

  constructor(apiKey?: string, timeout = 15000) {
    this.apiKey = apiKey || process.env.ALPHA_VANTAGE_API_KEY || ''
    this.timeout = timeout
  }

  /**
   * Get current stock price data
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      if (!this.apiKey) {
        console.warn('Alpha Vantage API key not configured')
        return null
      }

      const response = await this.makeRequest({
        function: 'GLOBAL_QUOTE',
        symbol: symbol.toUpperCase(),
        apikey: this.apiKey
      })

      if (!response.success || !response.data?.['Global Quote']) {
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
      return null
    }
  }

  /**
   * Get company information
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      if (!this.apiKey) {
        console.warn('Alpha Vantage API key not configured')
        return null
      }

      const response = await this.makeRequest({
        function: 'OVERVIEW',
        symbol: symbol.toUpperCase(),
        apikey: this.apiKey
      })

      if (!response.success || !response.data?.Symbol) {
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
      return null
    }
  }

  /**
   * Get detailed market data
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      if (!this.apiKey) {
        console.warn('Alpha Vantage API key not configured')
        return null
      }

      const response = await this.makeRequest({
        function: 'TIME_SERIES_DAILY',
        symbol: symbol.toUpperCase(),
        apikey: this.apiKey
      })

      if (!response.success || !response.data?.['Time Series (Daily)']) {
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
      return null
    }
  }

  /**
   * Health check for Alpha Vantage API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false
      }

      const response = await this.makeRequest({
        function: 'GLOBAL_QUOTE',
        symbol: 'AAPL',
        apikey: this.apiKey
      })

      // Check for success, no error message, and presence of expected data structure
      return response.success &&
             !response.data?.['Error Message'] &&
             !!response.data?.['Global Quote']
    } catch {
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
        throw new Error('API rate limit exceeded')
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