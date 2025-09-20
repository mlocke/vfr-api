/**
 * EODHD API implementation
 * Provides access to end-of-day historical data and real-time financial APIs
 * API Documentation: https://eodhd.com/financial-apis/
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types.js'

interface EODHDQuote {
  code: string
  timestamp: number
  gmtoffset: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  previousClose: number
  change: number
  change_p: number
}

interface EODHDProfile {
  code: string
  name: string
  exchange: string
  country: string
  currency: string
  type: string
  isin: string
}

export class EODHDAPI implements FinancialDataProvider {
  private apiKey: string
  private baseUrl = 'https://eodhd.com/api'
  private timeout: number
  private retryAttempts: number
  private retryDelay: number

  constructor(apiKey?: string, timeout: number = 8000, debugMode: boolean = false) {
    this.apiKey = apiKey || process.env.EODHD_API_KEY || ''
    this.timeout = timeout
    this.retryAttempts = 3
    this.retryDelay = 1000

    if (!this.apiKey) {
      console.warn('⚠️ EODHD API: No API key provided. Some requests may fail.')
    }

    if (debugMode) {
      console.log('🔧 EODHD API initialized:', {
        hasApiKey: !!this.apiKey,
        timeout: this.timeout,
        baseUrl: this.baseUrl
      })
    }
  }

  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      console.log(`📈 EODHD API: Fetching stock price for ${symbol}`)

      const normalizedSymbol = symbol.toUpperCase()
      const url = `${this.baseUrl}/real-time/${normalizedSymbol}.US?api_token=${this.apiKey}&fmt=json`

      const response = await this.makeRequest(url)

      if (!response.success || !response.data) {
        console.warn(`⚠️ EODHD API: No data received for ${symbol}`)
        return null
      }

      const data = response.data as EODHDQuote

      return {
        symbol: normalizedSymbol,
        price: data.close || 0,
        change: data.change || 0,
        changePercent: data.change_p || 0,
        volume: data.volume || 0,
        timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
        source: 'eodhd'
      }
    } catch (error) {
      console.error(`❌ EODHD API: Error fetching stock price for ${symbol}:`, error)
      return null
    }
  }

  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      console.log(`🏢 EODHD API: Fetching company info for ${symbol}`)

      const normalizedSymbol = symbol.toUpperCase()
      const url = `${this.baseUrl}/fundamentals/${normalizedSymbol}.US?api_token=${this.apiKey}&fmt=json`

      const response = await this.makeRequest(url)

      if (!response.success || !response.data) {
        console.warn(`⚠️ EODHD API: No company info received for ${symbol}`)
        return null
      }

      const data = response.data as any

      return {
        symbol: normalizedSymbol,
        name: data.General?.Name || symbol,
        description: data.General?.Description || '',
        sector: data.General?.Sector || '',
        industry: data.General?.Industry || '',
        exchange: data.General?.Exchange || '',
        marketCap: data.Highlights?.MarketCapitalization || 0,
        peRatio: data.Valuation?.PeRatio || 0,
        source: 'eodhd'
      }
    } catch (error) {
      console.error(`❌ EODHD API: Error fetching company info for ${symbol}:`, error)
      return null
    }
  }

  async getMarketData(): Promise<MarketData | null> {
    try {
      console.log('📊 EODHD API: Fetching market data')

      // Get major indices data
      const spyUrl = `${this.baseUrl}/real-time/SPY.US?api_token=${this.apiKey}&fmt=json`
      const response = await this.makeRequest(spyUrl)

      if (!response.success || !response.data) {
        console.warn('⚠️ EODHD API: No market data received')
        return null
      }

      const spyData = response.data as EODHDQuote

      return {
        indices: [
          {
            symbol: 'SPY',
            name: 'SPDR S&P 500 ETF',
            price: spyData.close || 0,
            change: spyData.change || 0,
            changePercent: spyData.change_p || 0
          }
        ],
        timestamp: Date.now(),
        source: 'eodhd'
      }
    } catch (error) {
      console.error('❌ EODHD API: Error fetching market data:', error)
      return null
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      console.log('🔍 EODHD API: Performing health check')

      if (!this.apiKey) {
        console.warn('⚠️ EODHD API: Health check failed - no API key')
        return false
      }

      const url = `${this.baseUrl}/real-time/AAPL.US?api_token=${this.apiKey}&fmt=json`
      const response = await this.makeRequest(url)

      const isHealthy = response.success && !!response.data
      console.log(`${isHealthy ? '✅' : '❌'} EODHD API: Health check ${isHealthy ? 'passed' : 'failed'}`)

      return isHealthy
    } catch (error) {
      console.error('❌ EODHD API: Health check failed:', error)
      return false
    }
  }

  private async makeRequest(url: string, retryCount: number = 0): Promise<ApiResponse> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
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
        source: 'eodhd',
        timestamp: Date.now()
      }
    } catch (error) {
      console.error(`❌ EODHD API: Request failed (attempt ${retryCount + 1}):`, error)

      if (retryCount < this.retryAttempts) {
        console.log(`🔄 EODHD API: Retrying in ${this.retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, this.retryDelay))
        return this.makeRequest(url, retryCount + 1)
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'eodhd',
        timestamp: Date.now()
      }
    }
  }

  getName(): string {
    return 'EODHD API'
  }

  getSource(): string {
    return 'eodhd'
  }
}