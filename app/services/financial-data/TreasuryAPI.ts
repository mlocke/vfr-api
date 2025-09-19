/**
 * Direct Treasury Fiscal Data API implementation
 * Provides access to U.S. government fiscal and debt data
 * Documentation: https://fiscaldata.treasury.gov/api-documentation/
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types'

export class TreasuryAPI implements FinancialDataProvider {
  name = 'Treasury API'
  private baseUrl = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'
  private timeout: number
  private userAgent: string

  constructor(timeout = 8000) {
    this.timeout = timeout
    this.userAgent = process.env.TREASURY_USER_AGENT || 'VFR-API/1.0 (contact@veritak.com)'
  }

  /**
   * Get stock price data - Treasury doesn't provide stock prices
   * Returns Treasury debt data as financial metric
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      // Treasury API doesn't provide stock prices
      // We'll return debt data as a financial indicator
      const debtData = await this.getLatestDebtData()
      if (!debtData) {
        return null
      }

      // Convert debt amount to a meaningful number (in trillions)
      const debtInTrillions = parseFloat(debtData.tot_pub_debt_out_amt) / 1000000000000

      return {
        symbol: 'US_DEBT',
        price: debtInTrillions,
        change: 0,
        changePercent: 0,
        volume: 0,
        timestamp: Date.now(),
        source: 'treasury'
      }
    } catch (error) {
      console.error(`Treasury API error for ${symbol}:`, error)
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
   * Health check for Treasury API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/accounting/od/debt_to_penny?limit=1`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(this.timeout)
      })

      return response.ok
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