/**
 * Direct Polygon.io API implementation
 * Replaces MCP-based Polygon data fetching with direct REST API calls
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types'

export class PolygonAPI implements FinancialDataProvider {
  name = 'Polygon.io'
  private baseUrl = 'https://api.polygon.io'
  private apiKey: string
  private timeout: number

  constructor(apiKey?: string, timeout = 10000) {
    this.apiKey = apiKey || process.env.POLYGON_API_KEY || ''
    this.timeout = timeout
  }

  /**
   * Get current stock price data
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      if (!this.apiKey) {
        console.warn('Polygon API key not configured')
        return null
      }

      // Get previous close data
      const response = await this.makeRequest(
        `/v2/aggs/ticker/${symbol.toUpperCase()}/prev?adjusted=true&apikey=${this.apiKey}`
      )

      if (!response.success || !response.data?.results?.[0]) {
        return null
      }

      const result = response.data.results[0]

      // Calculate change from previous day
      const price = result.c || 0
      const previousClose = result.c || 0 // Previous close is the close price for prev day
      const change = 0 // No intraday change available from this endpoint
      const changePercent = 0

      return {
        symbol: symbol.toUpperCase(),
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: result.v || 0,
        timestamp: result.t || Date.now(),
        source: 'polygon'
      }
    } catch (error) {
      console.error(`Polygon API error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get company information
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      if (!this.apiKey) {
        console.warn('Polygon API key not configured')
        return null
      }

      const response = await this.makeRequest(
        `/v3/reference/tickers/${symbol.toUpperCase()}?apikey=${this.apiKey}`
      )

      if (!response.success || !response.data?.results) {
        return null
      }

      const result = response.data.results

      return {
        symbol: symbol.toUpperCase(),
        name: result.name || '',
        description: result.description || '',
        sector: result.sector || '',
        marketCap: result.market_cap || 0,
        employees: result.total_employees || 0,
        website: result.homepage_url || ''
      }
    } catch (error) {
      console.error(`Polygon company info error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get detailed market data
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      if (!this.apiKey) {
        console.warn('Polygon API key not configured')
        return null
      }

      const response = await this.makeRequest(
        `/v2/aggs/ticker/${symbol.toUpperCase()}/prev?adjusted=true&apikey=${this.apiKey}`
      )

      if (!response.success || !response.data?.results?.[0]) {
        return null
      }

      const result = response.data.results[0]

      return {
        symbol: symbol.toUpperCase(),
        open: result.o || 0,
        high: result.h || 0,
        low: result.l || 0,
        close: result.c || 0,
        volume: result.v || 0,
        timestamp: result.t || Date.now(),
        source: 'polygon'
      }
    } catch (error) {
      console.error(`Polygon market data error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Health check for Polygon API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false
      }

      const response = await this.makeRequest(
        `/v3/reference/tickers?limit=1&apikey=${this.apiKey}`
      )

      return response.success
    } catch {
      return false
    }
  }

  /**
   * Get stocks by sector (simplified implementation)
   */
  async getStocksBySector(sector: string, limit = 20): Promise<StockData[]> {
    try {
      if (!this.apiKey) {
        console.warn('Polygon API key not configured')
        return []
      }

      // Note: Polygon doesn't have a direct sector endpoint in the same way
      // This is a simplified implementation that would need sector-to-symbol mapping
      const response = await this.makeRequest(
        `/v3/reference/tickers?sector=${encodeURIComponent(sector)}&limit=${limit}&apikey=${this.apiKey}`
      )

      if (!response.success || !response.data?.results) {
        return []
      }

      // Get stock prices for each symbol found
      const symbols = response.data.results.map((item: any) => item.ticker).slice(0, limit)
      const stockPromises = symbols.map((symbol: string) => this.getStockPrice(symbol))
      const stocks = await Promise.all(stockPromises)

      return stocks.filter(Boolean) as StockData[]
    } catch (error) {
      console.error(`Polygon sector data error for ${sector}:`, error)
      return []
    }
  }

  /**
   * Make HTTP request to Polygon API
   */
  private async makeRequest(endpoint: string): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
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

      return {
        success: true,
        data,
        source: 'polygon',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'polygon',
        timestamp: Date.now()
      }
    }
  }
}