/**
 * Direct Yahoo Finance API implementation
 * Replaces MCP-based Yahoo Finance data fetching with direct REST API calls
 * Note: Using unofficial Yahoo Finance API endpoints
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types'

export class YahooFinanceAPI implements FinancialDataProvider {
  name = 'Yahoo Finance'
  private baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart'
  private timeout: number

  constructor(timeout = 10000) {
    this.timeout = timeout
  }

  /**
   * Get current stock price data
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      const response = await this.makeRequest(`${symbol.toUpperCase()}?interval=1d&range=2d`)

      if (!response.success || !response.data?.chart?.result?.[0]) {
        return null
      }

      const result = response.data.chart.result[0]
      const meta = result.meta
      const quotes = result.indicators?.quote?.[0]

      if (!meta || !quotes) {
        return null
      }

      const currentPrice = meta.regularMarketPrice || meta.previousClose || 0
      const previousClose = meta.previousClose || 0
      const change = currentPrice - previousClose
      const changePercent = previousClose ? (change / previousClose) * 100 : 0

      return {
        symbol: symbol.toUpperCase(),
        price: Number(currentPrice.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: meta.regularMarketVolume || 0,
        timestamp: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
        source: 'yahoo'
      }
    } catch (error) {
      console.error(`Yahoo Finance API error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get company information
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      // Yahoo Finance doesn't provide comprehensive company info in chart API
      // This would require additional endpoints or alternative data sources
      console.warn('Yahoo Finance company info requires additional API endpoints')
      return null
    } catch (error) {
      console.error(`Yahoo Finance company info error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get detailed market data
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      const response = await this.makeRequest(`${symbol.toUpperCase()}?interval=1d&range=2d`)

      if (!response.success || !response.data?.chart?.result?.[0]) {
        return null
      }

      const result = response.data.chart.result[0]
      const quotes = result.indicators?.quote?.[0]
      const timestamps = result.timestamp

      if (!quotes || !timestamps || timestamps.length === 0) {
        return null
      }

      // Get the latest trading day data
      const latestIndex = timestamps.length - 1
      const latestTimestamp = timestamps[latestIndex] * 1000

      return {
        symbol: symbol.toUpperCase(),
        open: quotes.open?.[latestIndex] || 0,
        high: quotes.high?.[latestIndex] || 0,
        low: quotes.low?.[latestIndex] || 0,
        close: quotes.close?.[latestIndex] || 0,
        volume: quotes.volume?.[latestIndex] || 0,
        timestamp: latestTimestamp,
        source: 'yahoo'
      }
    } catch (error) {
      console.error(`Yahoo Finance market data error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Health check for Yahoo Finance API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest('AAPL?interval=1d&range=1d')
      return response.success
    } catch {
      return false
    }
  }

  /**
   * Get stocks by sector (not directly supported by Yahoo Finance chart API)
   */
  async getStocksBySector(sector: string, limit = 20): Promise<StockData[]> {
    try {
      // Yahoo Finance chart API doesn't provide sector-based stock listing
      // This would require sector-to-symbol mapping or alternative endpoints
      console.warn('Yahoo Finance sector search not implemented - use alternative method')
      return []
    } catch (error) {
      console.error(`Yahoo Finance sector data error for ${sector}:`, error)
      return []
    }
  }

  /**
   * Make HTTP request to Yahoo Finance API
   */
  private async makeRequest(endpoint: string): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; VFR-API/1.0)'
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
        source: 'yahoo',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'yahoo',
        timestamp: Date.now()
      }
    }
  }
}