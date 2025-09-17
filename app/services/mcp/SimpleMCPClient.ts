/**
 * Simplified MCP Client - Direct approach following KISS principles
 * Replaces the complex data pipeline with simple, direct client calls
 */

import { mcpClient } from './MCPClient'

export interface SimpleStockData {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: number
  source: string
}

export interface SimpleCompanyInfo {
  symbol: string
  name: string
  description: string
  sector: string
  marketCap: number
  employees: number
}

export class SimpleMCPClient {
  /**
   * Get stock price data directly from MCP sources
   */
  static async getStockPrice(symbol: string): Promise<SimpleStockData | null> {
    try {
      // Try Polygon first (most reliable)
      const polygonData = await mcpClient.getStockData('polygon', symbol)
      if (polygonData?.success && polygonData.data) {
        return this.formatStockData(polygonData.data, symbol, 'polygon')
      }

      // Fallback to Alpha Vantage
      const alphaData = await mcpClient.getStockData('alphavantage', symbol)
      if (alphaData?.success && alphaData.data) {
        return this.formatStockData(alphaData.data, symbol, 'alphavantage')
      }

      return null
    } catch (error) {
      console.error(`Failed to get stock price for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get company information
   */
  static async getCompanyInfo(symbol: string): Promise<SimpleCompanyInfo | null> {
    try {
      const data = await mcpClient.getCompanyInfo('polygon', symbol)
      if (data?.success && data.data) {
        return this.formatCompanyInfo(data.data, symbol)
      }
      return null
    } catch (error) {
      console.error(`Failed to get company info for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get multiple stocks by sector
   */
  static async getStocksBySector(sector: string, limit = 20): Promise<SimpleStockData[]> {
    try {
      const data = await mcpClient.getSectorData('polygon', sector)
      if (data?.success && data.data) {
        return data.data
          .slice(0, limit)
          .map((item: any) => this.formatStockData(item, item.symbol || item.ticker, 'polygon'))
          .filter(Boolean)
      }
      return []
    } catch (error) {
      console.error(`Failed to get sector data for ${sector}:`, error)
      return []
    }
  }

  /**
   * Format stock data from any source into unified format
   */
  private static formatStockData(data: any, symbol: string, source: string): SimpleStockData {
    // Handle different data formats from various sources
    const price = data.c || data.close || data.price || data.regularMarketPrice || 0
    const previousClose = data.pc || data.previousClose || data.previous_close || price
    const change = price - previousClose
    const changePercent = previousClose ? (change / previousClose) * 100 : 0

    return {
      symbol: symbol.toUpperCase(),
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      volume: data.v || data.volume || data.regularMarketVolume || 0,
      timestamp: data.t || data.timestamp || Date.now(),
      source
    }
  }

  /**
   * Format company info into unified format
   */
  private static formatCompanyInfo(data: any, symbol: string): SimpleCompanyInfo {
    return {
      symbol: symbol.toUpperCase(),
      name: data.name || data.companyName || '',
      description: data.description || data.longBusinessSummary || '',
      sector: data.sector || data.gicsSector || '',
      marketCap: data.market_cap || data.marketCap || 0,
      employees: data.total_employees || data.fullTimeEmployees || 0
    }
  }

  /**
   * Simple health check for MCP services
   */
  static async healthCheck(): Promise<{ [key: string]: boolean }> {
    const services = ['polygon', 'alphavantage']
    const results: { [key: string]: boolean } = {}

    for (const service of services) {
      try {
        const result = await mcpClient.testConnection(service)
        results[service] = result?.success || false
      } catch {
        results[service] = false
      }
    }

    return results
  }
}