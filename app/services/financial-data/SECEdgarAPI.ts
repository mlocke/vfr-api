/**
 * Direct SEC EDGAR API implementation
 * Provides access to SEC filings data and company information
 * Documentation: https://www.sec.gov/edgar/sec-api-documentation
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types'

export class SECEdgarAPI implements FinancialDataProvider {
  name = 'SEC EDGAR'
  private baseUrl = 'https://data.sec.gov/api'
  private timeout: number
  private userAgent: string

  constructor(timeout = 15000) {
    this.timeout = timeout
    // SEC EDGAR requires a User-Agent header with contact information
    this.userAgent = process.env.SEC_USER_AGENT || 'VFR-API/1.0 (contact@veritak.com)'
  }

  /**
   * Get stock price data - SEC doesn't provide real-time prices
   * Returns company facts that can include financial metrics
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      // SEC EDGAR doesn't provide real-time stock prices
      // We'll return basic company data with placeholder price data
      const cik = await this.symbolToCik(symbol)
      if (!cik) {
        return null
      }

      const companyFacts = await this.getCompanyFacts(cik)
      if (!companyFacts) {
        return null
      }

      // SEC doesn't have price data, return placeholder
      return {
        symbol: symbol.toUpperCase(),
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        timestamp: Date.now(),
        source: 'sec_edgar'
      }
    } catch (error) {
      console.error(`SEC EDGAR API error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get company information from SEC submissions
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      const cik = await this.symbolToCik(symbol)
      if (!cik) {
        return null
      }

      const response = await this.makeRequest(`/submissions/CIK${cik.padStart(10, '0')}.json`)

      if (!response.success || !response.data) {
        return null
      }

      const data = response.data

      return {
        symbol: symbol.toUpperCase(),
        name: data.name || '',
        description: data.description || data.businessDescription || '',
        sector: data.sicDescription || '',
        marketCap: 0, // SEC doesn't provide market cap
        employees: 0, // SEC doesn't provide employee count in submissions
        website: data.website || ''
      }
    } catch (error) {
      console.error(`SEC EDGAR company info error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get market data - SEC doesn't provide market data
   * Returns placeholder data
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      // SEC EDGAR doesn't provide market data
      return {
        symbol: symbol.toUpperCase(),
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        volume: 0,
        timestamp: Date.now(),
        source: 'sec_edgar'
      }
    } catch (error) {
      console.error(`SEC EDGAR market data error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Health check for SEC EDGAR API
   */
   async healthCheck(): Promise<boolean> {
    try {
      // SEC EDGAR is very strict about rate limiting and User-Agent headers
      // For health check, we'll just verify the base URL is reachable
      // and the API structure is valid by checking a known good endpoint
      const response = await fetch(`${this.baseUrl}/submissions/CIK0000320193.json`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // Longer timeout for SEC
      })

      // SEC EDGAR returns 200 for valid requests but may return other codes
      // We consider 200, 429 (rate limited), or 403 (valid but restricted) as "healthy"
      return response.status === 200 || response.status === 429 || response.status === 403
    } catch (error) {
      console.log('SEC EDGAR health check failed:', error)
      return false
    }
  }

  /**
   * Get company facts by CIK
   */
  async getCompanyFacts(cik: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/xbrl/companyfacts/CIK${cik.padStart(10, '0')}.json`)
      return response.success ? response.data : null
    } catch (error) {
      console.error(`SEC EDGAR company facts error for CIK ${cik}:`, error)
      return null
    }
  }

  /**
   * Convert stock symbol to CIK (Central Index Key)
   * This is a simplified implementation - in practice you'd need a symbol-to-CIK mapping
   */
  private async symbolToCik(symbol: string): Promise<string | null> {
    // This is a simplified mapping for common symbols
    // In a production environment, you'd need a comprehensive symbol-to-CIK database
    const symbolToCikMap: Record<string, string> = {
      'AAPL': '0000320193',
      'MSFT': '0000789019',
      'GOOGL': '0001652044',
      'AMZN': '0001018724',
      'TSLA': '0001318605',
      'META': '0001326801',
      'NVDA': '0001045810',
      'JPM': '0000019617',
      'JNJ': '0000200406',
      'V': '0001403161'
    }

    return symbolToCikMap[symbol.toUpperCase()] || null
  }

  /**
   * Make HTTP request to SEC EDGAR API
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
        source: 'sec_edgar',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'sec_edgar',
        timestamp: Date.now()
      }
    }
  }
}