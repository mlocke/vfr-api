/**
 * Fallback Data Service for Free Price/Volume Data
 * Implements a chain of free data sources with automatic failover
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types'
import { PolygonAPI } from './PolygonAPI'
import { AlphaVantageAPI } from './AlphaVantageAPI'
import { YahooFinanceAPI } from './YahooFinanceAPI'
import { TwelveDataAPI } from './TwelveDataAPI'
import { FinancialModelingPrepAPI } from './FinancialModelingPrepAPI'

interface DataSourceConfig {
  name: string
  provider: FinancialDataProvider
  priority: number
  isFree: boolean
  rateLimit: number // requests per minute
  dailyLimit?: number // daily request limit
}

export class FallbackDataService implements FinancialDataProvider {
  name = 'Fallback Data Service'
  private dataSources: DataSourceConfig[] = []
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map()
  private dailyCounts: Map<string, { count: number; date: string }> = new Map()

  constructor() {
    this.initializeDataSources()
  }

  private initializeDataSources(): void {
    // Priority order for FREE data sources
    // Note: Some have API keys but offer free tiers

    // 1. Yahoo Finance - Completely free, no API key needed
    this.dataSources.push({
      name: 'Yahoo Finance',
      provider: new YahooFinanceAPI(),
      priority: 1,
      isFree: true,
      rateLimit: 60 // Unofficial, be conservative
    })

    // 2. Alpha Vantage - Free tier: 25 requests/day, 5/minute
    if (process.env.ALPHA_VANTAGE_API_KEY) {
      this.dataSources.push({
        name: 'Alpha Vantage',
        provider: new AlphaVantageAPI(),
        priority: 2,
        isFree: true,
        rateLimit: 5,
        dailyLimit: 25
      })
    }

    // 3. Twelve Data - Free tier: 800 requests/day, 8/minute
    if (process.env.TWELVE_DATA_API_KEY) {
      this.dataSources.push({
        name: 'Twelve Data',
        provider: new TwelveDataAPI(),
        priority: 3,
        isFree: true,
        rateLimit: 8,
        dailyLimit: 800
      })
    }

    // 4. FMP - Free tier: 250 requests/day
    if (process.env.FMP_API_KEY) {
      this.dataSources.push({
        name: 'Financial Modeling Prep',
        provider: new FinancialModelingPrepAPI(),
        priority: 4,
        isFree: true,
        rateLimit: 10,
        dailyLimit: 250
      })
    }

    // 5. Polygon - Free tier: 5 requests/minute (limited but reliable)
    if (process.env.POLYGON_API_KEY) {
      this.dataSources.push({
        name: 'Polygon',
        provider: new PolygonAPI(),
        priority: 5,
        isFree: true,
        rateLimit: 5,
        dailyLimit: 50000 // Monthly limit, ~1600/day
      })
    }

    // Sort by priority
    this.dataSources.sort((a, b) => a.priority - b.priority)

    console.log(`📊 Fallback Data Service initialized with ${this.dataSources.length} free sources:`)
    this.dataSources.forEach(ds => {
      console.log(`  ${ds.priority}. ${ds.name} (${ds.rateLimit} req/min${ds.dailyLimit ? `, ${ds.dailyLimit}/day` : ''})`)
    })
  }

  /**
   * Check if we can make a request to a specific data source
   */
  private canMakeRequest(source: DataSourceConfig): boolean {
    const now = Date.now()
    const today = new Date().toDateString()

    // Check rate limit (per minute)
    const rateInfo = this.requestCounts.get(source.name) || { count: 0, resetTime: now + 60000 }
    if (now > rateInfo.resetTime) {
      rateInfo.count = 0
      rateInfo.resetTime = now + 60000
    }
    if (rateInfo.count >= source.rateLimit) {
      console.log(`⚠️ Rate limit reached for ${source.name}: ${rateInfo.count}/${source.rateLimit} per minute`)
      return false
    }

    // Check daily limit if applicable
    if (source.dailyLimit) {
      const dailyInfo = this.dailyCounts.get(source.name) || { count: 0, date: today }
      if (dailyInfo.date !== today) {
        dailyInfo.count = 0
        dailyInfo.date = today
      }
      if (dailyInfo.count >= source.dailyLimit) {
        console.log(`⚠️ Daily limit reached for ${source.name}: ${dailyInfo.count}/${source.dailyLimit}`)
        return false
      }
    }

    return true
  }

  /**
   * Record a request for rate limiting
   */
  private recordRequest(source: DataSourceConfig): void {
    const now = Date.now()
    const today = new Date().toDateString()

    // Update rate limit counter
    const rateInfo = this.requestCounts.get(source.name) || { count: 0, resetTime: now + 60000 }
    rateInfo.count++
    this.requestCounts.set(source.name, rateInfo)

    // Update daily counter if applicable
    if (source.dailyLimit) {
      const dailyInfo = this.dailyCounts.get(source.name) || { count: 0, date: today }
      if (dailyInfo.date !== today) {
        dailyInfo.count = 1
        dailyInfo.date = today
      } else {
        dailyInfo.count++
      }
      this.dailyCounts.set(source.name, dailyInfo)
    }
  }

  /**
   * Get stock price with automatic fallback
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    const errors: string[] = []

    for (const source of this.dataSources) {
      // Check rate limits
      if (!this.canMakeRequest(source)) {
        errors.push(`${source.name}: Rate limited`)
        continue
      }

      try {
        console.log(`🔄 Trying ${source.name} for ${symbol}...`)

        const startTime = Date.now()
        const data = await source.provider.getStockPrice(symbol)
        const responseTime = Date.now() - startTime

        if (data) {
          this.recordRequest(source)
          console.log(`✅ ${source.name} succeeded for ${symbol} (${responseTime}ms)`)

          // Add metadata about which source was used
          return {
            ...data,
            source: source.name.toLowerCase().replace(/\s+/g, '_')
          }
        } else {
          errors.push(`${source.name}: No data returned`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${source.name}: ${errorMsg}`)
        console.error(`❌ ${source.name} failed:`, errorMsg)
      }
    }

    // All sources failed
    console.error(`❌ All data sources failed for ${symbol}:`, errors)
    return null
  }

  /**
   * Get company info with fallback
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    for (const source of this.dataSources) {
      if (!this.canMakeRequest(source)) continue

      try {
        const data = await source.provider.getCompanyInfo(symbol)
        if (data) {
          this.recordRequest(source)
          return data
        }
      } catch (error) {
        console.error(`${source.name} company info failed:`, error)
      }
    }
    return null
  }

  /**
   * Get market data with fallback
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    for (const source of this.dataSources) {
      if (!this.canMakeRequest(source)) continue

      try {
        const data = await source.provider.getMarketData(symbol)
        if (data) {
          this.recordRequest(source)
          return data
        }
      } catch (error) {
        console.error(`${source.name} market data failed:`, error)
      }
    }
    return null
  }

  /**
   * Batch get stock prices with optimal source selection
   */
  async getBatchPrices(symbols: string[]): Promise<Map<string, StockData>> {
    const results = new Map<string, StockData>()

    // Try to use sources with batch capabilities first
    for (const source of this.dataSources) {
      if (!this.canMakeRequest(source)) continue

      // Check if provider has batch method
      if ('getBatchPrices' in source.provider && typeof source.provider.getBatchPrices === 'function') {
        try {
          console.log(`🔄 Trying batch fetch from ${source.name} for ${symbols.length} symbols...`)
          const batchData = await source.provider.getBatchPrices(symbols)

          if (batchData.size > 0) {
            this.recordRequest(source)
            batchData.forEach((data, symbol) => {
              results.set(symbol, {
                ...data,
                source: source.name.toLowerCase().replace(/\s+/g, '_')
              })
            })

            // If we got all symbols, return
            if (results.size === symbols.length) {
              console.log(`✅ ${source.name} batch fetch complete`)
              return results
            }
          }
        } catch (error) {
          console.error(`${source.name} batch fetch failed:`, error)
        }
      }
    }

    // Fallback to individual requests for missing symbols
    const missingSymbols = symbols.filter(s => !results.has(s))
    for (const symbol of missingSymbols) {
      const data = await this.getStockPrice(symbol)
      if (data) {
        results.set(symbol, data)
      }
    }

    return results
  }

  /**
   * Health check - returns true if at least one source is available
   */
  async healthCheck(): Promise<boolean> {
    for (const source of this.dataSources) {
      try {
        const isHealthy = await source.provider.healthCheck()
        if (isHealthy && this.canMakeRequest(source)) {
          return true
        }
      } catch {
        // Continue to next source
      }
    }
    return false
  }

  /**
   * Get current source availability status
   */
  getSourceStatus(): Array<{
    name: string
    available: boolean
    rateLimit: { current: number; limit: number }
    dailyLimit?: { current: number; limit: number }
  }> {
    const now = Date.now()
    const today = new Date().toDateString()

    return this.dataSources.map(source => {
      const rateInfo = this.requestCounts.get(source.name) || { count: 0, resetTime: now }
      const dailyInfo = source.dailyLimit
        ? this.dailyCounts.get(source.name) || { count: 0, date: today }
        : undefined

      // Reset counters if needed
      if (now > rateInfo.resetTime) {
        rateInfo.count = 0
      }
      if (dailyInfo && dailyInfo.date !== today) {
        dailyInfo.count = 0
      }

      return {
        name: source.name,
        available: this.canMakeRequest(source),
        rateLimit: {
          current: rateInfo.count,
          limit: source.rateLimit
        },
        dailyLimit: source.dailyLimit ? {
          current: dailyInfo?.count || 0,
          limit: source.dailyLimit
        } : undefined
      }
    })
  }

  /**
   * Get stocks by sector (limited support in free APIs)
   */
  async getStocksBySector(sector: string, limit?: number): Promise<StockData[]> {
    // Yahoo Finance is best for this as it's free
    const yahooSource = this.dataSources.find(s => s.name === 'Yahoo Finance')
    if (yahooSource && this.canMakeRequest(yahooSource)) {
      try {
        const stocks = await yahooSource.provider.getStocksBySector(sector, limit)
        if (stocks.length > 0) {
          this.recordRequest(yahooSource)
          return stocks
        }
      } catch (error) {
        console.error('Yahoo sector fetch failed:', error)
      }
    }

    // Fallback to other sources
    for (const source of this.dataSources) {
      if (!this.canMakeRequest(source) || source.name === 'Yahoo Finance') continue

      try {
        const stocks = await source.provider.getStocksBySector(sector, limit)
        if (stocks.length > 0) {
          this.recordRequest(source)
          return stocks
        }
      } catch {
        // Continue to next source
      }
    }

    return []
  }
}