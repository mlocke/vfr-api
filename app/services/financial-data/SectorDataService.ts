/**
 * Sector Data Service
 * Provides real sector performance data using sector ETFs
 */

import { AlphaVantageAPI } from './AlphaVantageAPI'
import { YahooFinanceAPI } from './YahooFinanceAPI'
import { FinancialModelingPrepAPI } from './FinancialModelingPrepAPI'

export interface SectorData {
  symbol: string
  name: string
  performance: number
  volume: number
  marketCap: number
  momentum: 'strong-up' | 'up' | 'neutral' | 'down' | 'strong-down'
  price: number
  change: number
  changePercent: number
  dataStatus?: 'live' | 'rate-limited' | 'api-error' | 'fallback'
  apiSource?: string
  errors?: string[]
}

export interface SectorDataResponse {
  sectors: SectorData[]
  timestamp: string
  dataQuality: 'real' | 'simulated'
  source: string
  apiStatus: {
    alphaVantage: boolean
    yahooFinance: boolean
    fmp: boolean
  }
  errors?: string[]
}

export class SectorDataService {
  private alphaVantage: AlphaVantageAPI
  private yahooFinance: YahooFinanceAPI
  private fmp: FinancialModelingPrepAPI

  // Map sector ETF symbols to human-readable names
  private sectorETFs = [
    { symbol: 'XLK', name: 'Technology' },
    { symbol: 'XLF', name: 'Financials' },
    { symbol: 'XLV', name: 'Healthcare' },
    { symbol: 'XLE', name: 'Energy' },
    { symbol: 'XLI', name: 'Industrials' },
    { symbol: 'XLC', name: 'Communication' },
    { symbol: 'XLY', name: 'Consumer Discr.' },
    { symbol: 'XLP', name: 'Consumer Staples' }
  ]

  constructor() {
    this.alphaVantage = new AlphaVantageAPI()
    this.yahooFinance = new YahooFinanceAPI()
    this.fmp = new FinancialModelingPrepAPI()
  }

  /**
   * Get real sector performance data using ETF prices
   */
  async getSectorData(): Promise<SectorDataResponse> {
    const sectors: SectorData[] = []
    const errors: string[] = []

    // Check API health first
    const apiStatus = await this.healthCheck()

    // Use Promise.allSettled for parallel processing
    const results = await Promise.allSettled(
      this.sectorETFs.map(async (sector) => {
        return this.getSectorDataForETF(sector.symbol, sector.name)
      })
    )

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        sectors.push(result.value)
      } else {
        const sector = this.sectorETFs[index]
        errors.push(`Failed to fetch data for ${sector.name} (${sector.symbol})`)
        console.warn(`Failed to fetch sector data for ${sector.symbol}:`,
          result.status === 'rejected' ? result.reason : 'No data returned')
      }
    })

    // If we have no real data, return error
    if (sectors.length === 0) {
      throw new Error(`Failed to fetch any sector data. Errors: ${errors.join(', ')}`)
    }

    return {
      sectors: sectors.sort((a, b) => b.performance - a.performance), // Sort by performance
      timestamp: new Date().toISOString(),
      dataQuality: 'real',
      source: 'Multiple APIs (Alpha Vantage, Yahoo Finance, FMP)',
      apiStatus: {
        alphaVantage: apiStatus['alphaVantage'] ?? false,
        yahooFinance: apiStatus['yahooFinance'] ?? false,
        fmp: apiStatus['fmp'] ?? false
      },
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * Get data for a single sector ETF with fallback logic
   */
  private async getSectorDataForETF(symbol: string, name: string): Promise<SectorData | null> {
    const errors: string[] = []

    // Try Alpha Vantage first
    try {
      const stockData = await this.alphaVantage.getStockPrice(symbol)
      const marketData = await this.alphaVantage.getMarketData(symbol)

      if (stockData && marketData) {
        // Verify data quality - check for valid change calculations
        const calculatedChange = stockData.price - (stockData.price - stockData.change)
        const calculatedChangePercent = stockData.change && stockData.price ?
          ((stockData.change / (stockData.price - stockData.change)) * 100) : 0

        // Use the API's calculated values if they seem valid, otherwise recalculate
        let finalChange = stockData.change
        let finalChangePercent = stockData.changePercent

        // Fix invalid calculations where change equals price (indicating missing previous close)
        if (Math.abs(stockData.change - stockData.price) < 0.01) {
          // This indicates the change calculation is wrong
          const yesterdaysPrice = marketData.close // Use yesterday's close from market data
          if (yesterdaysPrice && yesterdaysPrice !== stockData.price) {
            finalChange = Number((stockData.price - yesterdaysPrice).toFixed(2))
            finalChangePercent = Number(((finalChange / yesterdaysPrice) * 100).toFixed(2))
          } else {
            // If we can't get yesterday's data, mark as rate limited
            errors.push('Alpha Vantage: Missing historical data for change calculation')
            finalChange = 0
            finalChangePercent = 0
          }
        }

        return {
          symbol,
          name,
          performance: finalChangePercent,
          volume: stockData.volume,
          marketCap: this.estimateETFMarketCap(symbol),
          momentum: this.getMomentum(finalChangePercent),
          price: stockData.price,
          change: finalChange,
          changePercent: finalChangePercent,
          dataStatus: errors.length > 0 ? 'rate-limited' : 'live',
          apiSource: 'Alpha Vantage',
          errors: errors.length > 0 ? errors : undefined
        }
      } else {
        errors.push('Alpha Vantage: No data returned')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Alpha Vantage: ${errorMsg}`)
      console.warn(`Alpha Vantage failed for ${symbol}:`, error)
    }

    // Fallback to Yahoo Finance
    try {
      const yahooData = await this.yahooFinance.getStockPrice(symbol)
      if (yahooData) {
        // Check if Yahoo Finance data is valid (change should not equal price)
        if (Math.abs(yahooData.change - yahooData.price) < 0.01 || yahooData.changePercent === 0) {
          errors.push('Yahoo Finance: Invalid change calculation detected (likely rate limited)')
        } else {
          // Yahoo Finance has valid data
          return {
            symbol,
            name,
            performance: yahooData.changePercent,
            volume: yahooData.volume,
            marketCap: this.estimateETFMarketCap(symbol),
            momentum: this.getMomentum(yahooData.changePercent),
            price: yahooData.price,
            change: yahooData.change,
            changePercent: yahooData.changePercent,
            dataStatus: 'live',
            apiSource: 'Yahoo Finance',
            errors: [...errors, 'Fallback to Yahoo Finance']
          }
        }
      } else {
        errors.push('Yahoo Finance: No data returned')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Yahoo Finance: ${errorMsg}`)
      console.warn(`Yahoo Finance failed for ${symbol}:`, error)
    }

    // Fallback to FMP
    try {
      const fmpData = await this.fmp.getStockPrice(symbol)
      if (fmpData) {
        return {
          symbol,
          name,
          performance: fmpData.changePercent,
          volume: fmpData.volume,
          marketCap: this.estimateETFMarketCap(symbol),
          momentum: this.getMomentum(fmpData.changePercent),
          price: fmpData.price,
          change: fmpData.change,
          changePercent: fmpData.changePercent,
          dataStatus: 'fallback',
          apiSource: 'Financial Modeling Prep',
          errors: [...errors, 'Fallback to FMP']
        }
      } else {
        errors.push('FMP: No data returned')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`FMP: ${errorMsg}`)
      console.warn(`FMP failed for ${symbol}:`, error)
    }

    // If all APIs failed, return null - no mock data allowed
    console.error(`All APIs failed for sector ${symbol} (${name}). Errors:`, errors)
    return null
  }

  /**
   * Estimate market cap for sector ETFs (approximate values)
   */
  private estimateETFMarketCap(symbol: string): number {
    const marketCaps: { [key: string]: number } = {
      'XLK': 65000000000,   // Technology SPDR
      'XLF': 42000000000,   // Financial SPDR
      'XLV': 32000000000,   // Healthcare SPDR
      'XLE': 14000000000,   // Energy SPDR
      'XLI': 18000000000,   // Industrial SPDR
      'XLC': 12000000000,   // Communication SPDR
      'XLY': 16000000000,   // Consumer Discretionary SPDR
      'XLP': 15000000000    // Consumer Staples SPDR
    }

    return marketCaps[symbol] || 10000000000 // Default 10B
  }


  /**
   * Calculate momentum based on performance
   */
  private getMomentum(performance: number): 'strong-up' | 'up' | 'neutral' | 'down' | 'strong-down' {
    if (performance >= 2) return 'strong-up'
    if (performance >= 0.5) return 'up'
    if (performance >= -0.5) return 'neutral'
    if (performance >= -2) return 'down'
    return 'strong-down'
  }

  /**
   * Health check for sector data services
   */
  async healthCheck(): Promise<{ [key: string]: boolean }> {
    const checks = await Promise.allSettled([
      this.alphaVantage.healthCheck(),
      this.yahooFinance.healthCheck(),
      this.fmp.healthCheck()
    ])

    return {
      alphaVantage: checks[0].status === 'fulfilled' ? checks[0].value : false,
      yahooFinance: checks[1].status === 'fulfilled' ? checks[1].value : false,
      fmp: checks[2].status === 'fulfilled' ? checks[2].value : false
    }
  }
}