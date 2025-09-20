/**
 * Treasury API implementation using FRED for treasury rates
 * Provides access to U.S. Treasury yield data via Federal Reserve Economic Data
 * Documentation: https://fred.stlouisfed.org/docs/api/fred/
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types'
import { FREDAPI } from './FREDAPI'

export class TreasuryAPI implements FinancialDataProvider {
  name = 'Treasury API (via FRED)'
  private fredAPI: FREDAPI
  private timeout: number

  constructor(timeout = 8000) {
    this.timeout = timeout
    this.fredAPI = new FREDAPI()
  }

  /**
   * Get treasury yield data by symbol (10Y, 2Y, etc.)
   * Returns treasury rate as StockData format for compatibility
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      // Map common symbols to FRED series
      const fredSymbol = this.mapSymbolToFREDSeries(symbol)
      if (!fredSymbol) {
        console.warn(`Unknown treasury symbol: ${symbol}`)
        return null
      }

      // Get the rate from FRED
      const stockData = await this.fredAPI.getStockPrice(fredSymbol)
      if (!stockData) {
        return null
      }

      // Return with treasury-specific formatting
      return {
        symbol: symbol.toUpperCase(),
        price: stockData.price, // This is the yield percentage
        change: stockData.change,
        changePercent: stockData.changePercent,
        volume: 0, // Not applicable for treasury rates
        timestamp: stockData.timestamp,
        source: 'treasury-fred'
      }
    } catch (error) {
      console.error(`Treasury API error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Map common treasury symbols to FRED series IDs
   */
  private mapSymbolToFREDSeries(symbol: string): string | null {
    const mapping: {[key: string]: string} = {
      '3M': 'DGS3MO',
      '6M': 'DGS6MO',
      '1Y': 'DGS1',
      '2Y': 'DGS2',
      '5Y': 'DGS5',
      '10Y': 'DGS10',
      '20Y': 'DGS20',
      '30Y': 'DGS30',
      // Also support FRED series IDs directly
      'DGS3MO': 'DGS3MO',
      'DGS6MO': 'DGS6MO',
      'DGS1': 'DGS1',
      'DGS2': 'DGS2',
      'DGS5': 'DGS5',
      'DGS10': 'DGS10',
      'DGS20': 'DGS20',
      'DGS30': 'DGS30'
    }

    return mapping[symbol.toUpperCase()] || null
  }

  /**
   * Get all treasury rates for Tier 1 analysis
   */
  async getTreasuryRates(): Promise<{[key: string]: number} | null> {
    try {
      return await this.fredAPI.getTreasuryRates()
    } catch (error) {
      console.error('Treasury rates error:', error)
      return null
    }
  }

  /**
   * Get enhanced treasury analysis data for the analysis engine
   */
  async getTreasuryAnalysisData(): Promise<any> {
    try {
      return await this.fredAPI.getTreasuryAnalysisData()
    } catch (error) {
      console.error('Treasury analysis data error:', error)
      return null
    }
  }

  /**
   * Get company information - Treasury doesn't provide company data
   * Returns U.S. government fiscal information
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      const debtData = await this.getLatestDebtData()
      if (!debtData) {
        return null
      }

      return {
        symbol: 'US_GOVT',
        name: 'United States Government',
        description: 'U.S. Federal Government Fiscal Data',
        sector: 'Government',
        marketCap: parseFloat(debtData.tot_pub_debt_out_amt),
        employees: 0,
        website: 'https://fiscaldata.treasury.gov'
      }
    } catch (error) {
      console.error(`Treasury company info error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get market data - Treasury doesn't provide market data
   * Returns Treasury financial metrics
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      const debtData = await this.getLatestDebtData()
      if (!debtData) {
        return null
      }

      const debtAmount = parseFloat(debtData.tot_pub_debt_out_amt)

      return {
        symbol: 'US_DEBT',
        open: debtAmount,
        high: debtAmount,
        low: debtAmount,
        close: debtAmount,
        volume: 0,
        timestamp: Date.now(),
        source: 'treasury'
      }
    } catch (error) {
      console.error(`Treasury market data error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Health check for Treasury API (via FRED)
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test by getting 10Y treasury rate
      const rate = await this.getStockPrice('10Y')
      return rate !== null && rate.price > 0
    } catch (error) {
      console.log('Treasury API health check failed:', error)
      return false
    }
  }

  /**
   * Get latest debt to the penny data
   */
  async getLatestDebtData(): Promise<any> {
    try {
      const response = await this.makeRequest('/v2/accounting/od/debt_to_penny?sort=-record_date&limit=1')
      return response.success && response.data?.data?.length > 0 ? response.data.data[0] : null
    } catch (error) {
      console.error('Treasury debt data error:', error)
      return null
    }
  }

  /**
   * Get daily Treasury statement data
   */
  async getDailyTreasuryStatement(): Promise<any> {
    try {
      const response = await this.makeRequest('/v1/accounting/dts/dts_table_1?sort=-record_date&limit=10')
      return response.success ? response.data : null
    } catch (error) {
      console.error('Treasury daily statement error:', error)
      return null
    }
  }

  /**
   * Get Treasury operating cash balance
   */
  async getOperatingCashBalance(): Promise<any> {
    try {
      const response = await this.makeRequest('/v1/accounting/dts/operating_cash_balance?sort=-record_date&limit=1')
      return response.success && response.data?.data?.length > 0 ? response.data.data[0] : null
    } catch (error) {
      console.error('Treasury cash balance error:', error)
      return null
    }
  }

  /**
   * Make HTTP request to Treasury API
   */
  private async makeRequest(endpoint: string): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': this.userAgent
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
        source: 'treasury',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'treasury',
        timestamp: Date.now()
      }
    }
  }
}