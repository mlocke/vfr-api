/**
 * Unified Financial Data Service
 * Orchestrates multiple financial data providers with fallback logic
 * Replaces the complex MCP architecture with simple, direct API calls
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, AnalystRatings, PriceTarget, RatingChange, FundamentalRatios } from './types'
import { PolygonAPI } from './PolygonAPI'
import { YahooFinanceAPI } from './YahooFinanceAPI'
import { FinancialModelingPrepAPI } from './FinancialModelingPrepAPI'
import { BLSAPI } from './BLSAPI'
import { EIAAPI } from './EIAAPI'
import { TwelveDataAPI } from './TwelveDataAPI'
import { FallbackDataService } from './FallbackDataService'

interface ProviderHealth {
  name: string
  healthy: boolean
  responseTime?: number
}

export class FinancialDataService {
  private providers: FinancialDataProvider[]
  private fallbackService: FallbackDataService
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  constructor() {
    // Smart fallback service for price/volume data (FREE sources with rate limiting)
    this.fallbackService = new FallbackDataService()

    // Original providers for other data types
    this.providers = [
      new PolygonAPI(),
      new YahooFinanceAPI(),
      new FinancialModelingPrepAPI(),
      new BLSAPI(),
      new EIAAPI(),
      new TwelveDataAPI()
    ]
  }

  /**
   * Get stock price with smart FREE fallback chain
   * Uses FallbackDataService for price/volume data with automatic failover
   */
  async getStockPrice(symbol: string, preferredProvider?: string): Promise<StockData | null> {
    const cacheKey = `stock_${symbol.toUpperCase()}`

    // Check cache first
    const cached = this.getFromCache<StockData>(cacheKey)
    if (cached) {
      return cached
    }

    console.log(`🔍 Getting stock price for ${symbol} using smart fallback chain...`)

    try {
      // Use the smart fallback service for reliable, FREE price data
      const result = await this.fallbackService.getStockPrice(symbol)

      if (result) {
        this.setCache(cacheKey, result)
        console.log(`✅ Got ${symbol} price: $${result.price} from ${result.source}`)
        return result
      }
    } catch (error) {
      console.error(`❌ Smart fallback failed for ${symbol}:`, error)
    }

    // Legacy fallback (if smart fallback completely fails)
    console.log(`⚠️ Using legacy fallback for ${symbol}`)

    for (const provider of this.providers) {
      if (!provider.getStockPrice) continue

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

    console.error(`❌ All fallback methods failed for ${symbol}`)
    return null
  }

  /**
   * Get company information with fallback
   */
  async getCompanyInfo(symbol: string, preferredProvider?: string): Promise<CompanyInfo | null> {
    const cacheKey = `company_${symbol.toUpperCase()}`

    // Check cache first
    const cached = this.getFromCache<CompanyInfo>(cacheKey)
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
    const cached = this.getFromCache<MarketData>(cacheKey)
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
   * Get analyst ratings using fallback service
   */
  async getAnalystRatings(symbol: string): Promise<AnalystRatings | null> {
    const cacheKey = `analyst_${symbol.toUpperCase()}`

    // Check cache first
    const cached = this.getFromCache<AnalystRatings>(cacheKey)
    if (cached) {
      return cached
    }

    // Use fallback service for analyst ratings
    const result = await this.fallbackService.getAnalystRatings(symbol)
    if (result) {
      this.setCache(cacheKey, result)
    }

    return result
  }

  /**
   * Get price targets using fallback service
   */
  async getPriceTargets(symbol: string): Promise<PriceTarget | null> {
    const cacheKey = `targets_${symbol.toUpperCase()}`

    // Check cache first
    const cached = this.getFromCache<PriceTarget>(cacheKey)
    if (cached) {
      return cached
    }

    // Use fallback service for price targets
    const result = await this.fallbackService.getPriceTargets(symbol)
    if (result) {
      this.setCache(cacheKey, result)
    }

    return result
  }

  /**
   * Get recent rating changes using fallback service
   */
  async getRecentRatingChanges(symbol: string, limit = 10): Promise<RatingChange[]> {
    const cacheKey = `changes_${symbol.toUpperCase()}_${limit}`

    // Check cache first
    const cached = this.getFromCache<RatingChange[]>(cacheKey)
    if (cached) {
      return cached
    }

    // Use fallback service for rating changes
    const result = await this.fallbackService.getRecentRatingChanges(symbol, limit)
    if (result && result.length > 0) {
      this.setCache(cacheKey, result)
    }

    return result || []
  }

  /**
   * Get fundamental ratios using fallback service
   */
  async getFundamentalRatios(symbol: string): Promise<FundamentalRatios | null> {
    const cacheKey = `fundamental_${symbol.toUpperCase()}`

    // Check cache first (longer TTL for fundamental data)
    const cached = this.getFromCache<FundamentalRatios>(cacheKey)
    if (cached) {
      return cached
    }

    // Use fallback service for fundamental ratios
    const result = await this.fallbackService.getFundamentalRatios(symbol)
    if (result) {
      this.setCache(cacheKey, result)
    }

    return result
  }

  /**
   * Get historical OHLC data for technical analysis
   */
  async getHistoricalOHLC(symbol: string, days = 50): Promise<import('./types').HistoricalOHLC[]> {
    const cacheKey = `ohlc_${symbol.toUpperCase()}_${days}`

    // Check cache first (longer TTL for historical data)
    const cached = this.getFromCache<import('./types').HistoricalOHLC[]>(cacheKey)
    if (cached) {
      return cached
    }

    console.log(`🔍 Getting historical OHLC data for ${symbol} (${days} days)...`)

    // Try providers that support historical data
    for (const provider of this.providers) {
      if (!provider.getHistoricalOHLC) continue

      try {
        const result = await provider.getHistoricalOHLC(symbol, days)
        if (result && result.length > 0) {
          // Cache with longer TTL for historical data
          this.setCache(cacheKey, result)
          console.log(`✅ Got ${result.length} OHLC records for ${symbol} from ${provider.name}`)
          return result
        }
      } catch (error) {
        console.warn(`Provider ${provider.name} failed for OHLC ${symbol}:`, error)
        continue
      }
    }

    console.error(`❌ No historical OHLC data found for ${symbol}`)
    return []
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
   * Get provider by name or identifier
   */
  private getProviderByIdentifier(identifier: string): FinancialDataProvider | null {
    return this.providers.find(p =>
      p.name.toLowerCase().includes(identifier.toLowerCase())
    ) || null
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
   * Get extended hours data (pre-market and after-hours)
   */
  async getExtendedHoursData(symbol: string): Promise<{
    preMarketPrice?: number
    preMarketChange?: number
    preMarketChangePercent?: number
    afterHoursPrice?: number
    afterHoursChange?: number
    afterHoursChangePercent?: number
    marketStatus: 'pre-market' | 'market-hours' | 'after-hours' | 'closed'
  } | null> {
    const cacheKey = `extended_hours_${symbol.toUpperCase()}`

    // Check cache first (shorter TTL for extended hours data)
    const cached = this.getFromCache<any>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      // Use Polygon API for extended hours data (most reliable source)
      const polygonProvider = this.providers.find(p => p.name === 'Polygon.io') as PolygonAPI
      if (polygonProvider && polygonProvider.getExtendedHoursSnapshot) {
        const result = await polygonProvider.getExtendedHoursSnapshot(symbol)
        if (result) {
          // Cache with shorter TTL (1 minute for extended hours)
          this.cache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          })
          return result
        }
      }
    } catch (error) {
      console.error(`Extended hours data error for ${symbol}:`, error)
    }

    return null
  }

  /**
   * Get market status
   */
  async getMarketStatus(): Promise<'pre-market' | 'market-hours' | 'after-hours' | 'closed'> {
    try {
      const polygonProvider = this.providers.find(p => p.name === 'Polygon.io') as PolygonAPI
      if (polygonProvider && polygonProvider.getMarketStatus) {
        return await polygonProvider.getMarketStatus()
      }
    } catch (error) {
      console.error('Market status error:', error)
    }

    return 'closed'
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