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
  private previousCloseCache: Map<string, number> = new Map()

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

      const upperSymbol = symbol.toUpperCase()

      // Try to get real-time snapshot data first
      const snapshotResponse = await this.makeRequest(
        `/v2/snapshot/locale/us/markets/stocks/tickers/${upperSymbol}?apikey=${this.apiKey}`
      )

      if (snapshotResponse.success && snapshotResponse.data?.ticker) {
        const ticker = snapshotResponse.data.ticker
        const price = ticker.day?.c || ticker.prevDay?.c || 0
        const previousClose = ticker.prevDay?.c || 0
        const change = price - previousClose
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

        // Cache the previous close for future use
        this.previousCloseCache.set(upperSymbol, previousClose)

        return {
          symbol: upperSymbol,
          price: Number(price.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          volume: ticker.day?.v || ticker.prevDay?.v || 0,
          timestamp: ticker.updated || Date.now(),
          source: 'polygon'
        }
      }

      // Fallback to previous day data if snapshot fails
      const prevResponse = await this.makeRequest(
        `/v2/aggs/ticker/${upperSymbol}/prev?adjusted=true&apikey=${this.apiKey}`
      )

      if (!prevResponse.success || !prevResponse.data?.results?.[0]) {
        return null
      }

      const result = prevResponse.data.results[0]
      const price = result.c || 0

      // Get cached previous close or use yesterday's open
      const previousClose = this.previousCloseCache.get(upperSymbol) || result.o || price
      const change = price - previousClose
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

      return {
        symbol: upperSymbol,
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
   * Get latest trade price (most real-time data available)
   */
  async getLatestTrade(symbol: string): Promise<StockData | null> {
    try {
      if (!this.apiKey) {
        return null
      }

      const upperSymbol = symbol.toUpperCase()

      // Get the latest trade
      const response = await this.makeRequest(
        `/v2/last/trade/${upperSymbol}?apikey=${this.apiKey}`
      )

      if (!response.success || !response.data?.results) {
        return this.getStockPrice(symbol) // Fallback to snapshot
      }

      const trade = response.data.results
      const price = trade.p || 0

      // Get previous close from cache or fetch it
      let previousClose = this.previousCloseCache.get(upperSymbol)
      if (!previousClose) {
        const prevData = await this.getStockPrice(symbol)
        previousClose = prevData ? prevData.price : price
      }

      const change = price - previousClose
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

      return {
        symbol: upperSymbol,
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: trade.s || 0, // Size of the trade
        timestamp: trade.t || Date.now(),
        source: 'polygon'
      }
    } catch (error) {
      // Fallback to snapshot data
      return this.getStockPrice(symbol)
    }
  }

  /**
   * Get batch stock prices (more efficient for multiple symbols)
   */
  async getBatchPrices(symbols: string[]): Promise<Map<string, StockData>> {
    const results = new Map<string, StockData>()

    try {
      if (!this.apiKey || symbols.length === 0) {
        return results
      }

      // Get all snapshots in one call
      const response = await this.makeRequest(
        `/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${symbols.join(',')}&apikey=${this.apiKey}`
      )

      if (response.success && response.data?.tickers) {
        for (const ticker of response.data.tickers) {
          const price = ticker.day?.c || ticker.prevDay?.c || 0
          const previousClose = ticker.prevDay?.c || 0
          const change = price - previousClose
          const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

          results.set(ticker.ticker, {
            symbol: ticker.ticker,
            price: Number(price.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            volume: ticker.day?.v || ticker.prevDay?.v || 0,
            timestamp: ticker.updated || Date.now(),
            source: 'polygon'
          })
        }
      }
    } catch (error) {
      console.error('Polygon batch price error:', error)
    }

    return results
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