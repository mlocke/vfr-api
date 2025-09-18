/**
 * Unified Financial Data Service
 * Orchestrates multiple financial data providers with fallback logic
 * Replaces the complex MCP architecture with simple, direct API calls
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider } from './types'
import { PolygonAPI } from './PolygonAPI'
import { AlphaVantageAPI } from './AlphaVantageAPI'
import { YahooFinanceAPI } from './YahooFinanceAPI'

interface ProviderHealth {
  name: string
  healthy: boolean
  responseTime?: number
}

export class FinancialDataService {
  private providers: FinancialDataProvider[]
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.providers = [
      new PolygonAPI(),
      new AlphaVantageAPI(),
      new YahooFinanceAPI()
    ]
  }

  /**
   * Get stock price with automatic fallback between providers
   */
  async getStockPrice(symbol: string, preferredProvider?: string): Promise<StockData | null> {
    const cacheKey = `stock_${symbol.toUpperCase()}`

    // Check cache first
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    // Try preferred provider first
    if (preferredProvider) {
      const provider = this.providers.find(p => p.name.toLowerCase().includes(preferredProvider.toLowerCase()))
      if (provider) {
        const result = await provider.getStockPrice(symbol)
        if (result) {
          this.setCache(cacheKey, result)
          return result
        }
      }
    }

    // Try all providers in order until one succeeds
    for (const provider of this.providers) {
      try {
        const result = await provider.getStockPrice(symbol)
        if (result) {
          this.setCache(cacheKey, result)
          return result
        }
      } catch (error) {
        console.warn(`Provider ${provider.name} failed for ${symbol}:`, error)
        continue
      }
    }

    return null
  }

  /**
   * Get company information with fallback
   */
  async getCompanyInfo(symbol: string, preferredProvider?: string): Promise<CompanyInfo | null> {
    const cacheKey = `company_${symbol.toUpperCase()}`

    // Check cache first
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    // Try preferred provider first
    if (preferredProvider) {
      const provider = this.providers.find(p => p.name.toLowerCase().includes(preferredProvider.toLowerCase()))
      if (provider) {
        const result = await provider.getCompanyInfo(symbol)
        if (result) {
          this.setCache(cacheKey, result)
          return result
        }
      }
    }

    // Try all providers in order
    for (const provider of this.providers) {
      try {
        const result = await provider.getCompanyInfo(symbol)
        if (result) {
          this.setCache(cacheKey, result)
          return result
        }
      } catch (error) {
        console.warn(`Provider ${provider.name} failed for company info ${symbol}:`, error)
        continue
      }
    }

    return null
  }

  /**
   * Get market data with fallback
   */
  async getMarketData(symbol: string, preferredProvider?: string): Promise<MarketData | null> {
    const cacheKey = `market_${symbol.toUpperCase()}`

    // Check cache first
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    // Try preferred provider first
    if (preferredProvider) {
      const provider = this.providers.find(p => p.name.toLowerCase().includes(preferredProvider.toLowerCase()))
      if (provider) {
        const result = await provider.getMarketData(symbol)
        if (result) {
          this.setCache(cacheKey, result)
          return result
        }
      }
    }

    // Try all providers in order
    for (const provider of this.providers) {
      try {
        const result = await provider.getMarketData(symbol)
        if (result) {
          this.setCache(cacheKey, result)
          return result
        }
      } catch (error) {
        console.warn(`Provider ${provider.name} failed for market data ${symbol}:`, error)
        continue
      }
    }

    return null
  }

  /**
   * Get multiple stocks in parallel
   */
  async getMultipleStocks(symbols: string[], preferredProvider?: string): Promise<StockData[]> {
    const promises = symbols.map(symbol => this.getStockPrice(symbol, preferredProvider))
    const results = await Promise.all(promises)
    return results.filter(Boolean) as StockData[]
  }

  /**
   * Get stocks by sector (simplified implementation)
   */
  async getStocksBySector(sector: string, limit = 20): Promise<StockData[]> {
    // For now, use a predefined mapping of sectors to common stocks
    // In a production system, this would come from a comprehensive database
    const sectorStocks = this.getSectorStockMapping(sector)

    if (sectorStocks.length === 0) {
      return []
    }

    const symbolsToFetch = sectorStocks.slice(0, limit)
    return this.getMultipleStocks(symbolsToFetch)
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<ProviderHealth[]> {
    const healthPromises = this.providers.map(async (provider) => {
      const startTime = Date.now()
      try {
        const healthy = await provider.healthCheck()
        const responseTime = Date.now() - startTime
        return {
          name: provider.name,
          healthy,
          responseTime
        }
      } catch (error) {
        return {
          name: provider.name,
          healthy: false,
          responseTime: Date.now() - startTime
        }
      }
    })

    return Promise.all(healthPromises)
  }

  /**
   * Get provider status
   */
  getProviderNames(): string[] {
    return this.providers.map(p => p.name)
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get data from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) {
      return null
    }

    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key)
      return null
    }

    return cached.data as T
  }

  /**
   * Set data in cache
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Get predefined sector to stock mapping
   * In production, this would come from a comprehensive database
   */
  private getSectorStockMapping(sector: string): string[] {
    const sectorMap: Record<string, string[]> = {
      'technology': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'ADBE', 'CRM'],
      'healthcare': ['JNJ', 'UNH', 'PFE', 'ABBV', 'TMO', 'ABT', 'LLY', 'BMY', 'MRK', 'AMGN'],
      'financial': ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'BRK.B', 'V', 'MA'],
      'energy': ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'PXD', 'KMI', 'OKE', 'WMB', 'VLO'],
      'consumer': ['PG', 'KO', 'PEP', 'WMT', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT', 'LOW'],
      'industrial': ['BA', 'CAT', 'GE', 'MMM', 'HON', 'UPS', 'RTX', 'LMT', 'DE', 'FDX'],
      'utilities': ['NEE', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'XEL', 'SRE', 'PEG', 'ED'],
      'materials': ['LIN', 'APD', 'SHW', 'FCX', 'NEM', 'DOW', 'DD', 'PPG', 'ECL', 'IFF'],
      'realestate': ['PLD', 'AMT', 'CCI', 'EQIX', 'PSA', 'WELL', 'DLR', 'O', 'SBAC', 'AVB'],
      'communication': ['GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'VZ', 'T', 'CHTR', 'TMUS', 'FOXA']
    }

    const normalizedSector = sector.toLowerCase().replace(/\s+/g, '')
    return sectorMap[normalizedSector] || []
  }
}

// Singleton instance
export const financialDataService = new FinancialDataService()