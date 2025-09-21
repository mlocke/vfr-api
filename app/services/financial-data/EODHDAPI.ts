/**
 * EODHD API implementation
 * Provides access to end-of-day historical data and real-time financial APIs
 * API Documentation: https://eodhd.com/financial-apis/
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse, OptionsContract, OptionsChain, PutCallRatio, OptionsAnalysis, FundamentalRatios } from './types'

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

interface EODHDOptionsContract {
  symbol: string
  contractName: string
  strike: number
  expiration: string
  type: 'call' | 'put'
  lastPrice: number
  bid: number
  ask: number
  volume: number
  openInterest: number
  impliedVolatility: number
  delta: number
  gamma: number
  theta: number
  vega: number
  change: number
  changePercent: number
  inTheMoney: boolean
  contractSize: number
  timestamp: number
}

interface EODHDOptionsData {
  symbol: string
  expiration: string
  calls: EODHDOptionsContract[]
  puts: EODHDOptionsContract[]
  timestamp: number
}

export class EODHDAPI implements FinancialDataProvider {
  public readonly name = 'EODHD API'
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
        marketCap: data.Highlights?.MarketCapitalization || 0,
        employees: data.General?.EmployeeCount || undefined,
        website: data.General?.WebURL || undefined
      }
    } catch (error) {
      console.error(`❌ EODHD API: Error fetching company info for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get fundamental ratios for a stock using EODHD fundamentals API
   * Provides comprehensive financial ratios and metrics
   */
  async getFundamentalRatios(symbol: string): Promise<FundamentalRatios | null> {
    try {
      console.log(`📊 EODHD API: Fetching fundamental ratios for ${symbol}`)

      if (!this.apiKey) {
        console.warn('⚠️ EODHD API: No API key provided for fundamental data')
        return null
      }

      const normalizedSymbol = symbol.toUpperCase()
      const url = `${this.baseUrl}/fundamentals/${normalizedSymbol}.US?api_token=${this.apiKey}&fmt=json`

      const response = await this.makeRequest(url)

      if (!response.success || !response.data) {
        console.warn(`⚠️ EODHD API: No fundamental data received for ${symbol}`)
        return null
      }

      const data = response.data as any

      // Extract ratios from EODHD fundamentals response
      const highlights = data.Highlights || {}
      const technicals = data.Technicals || {}
      const valuation = data.Valuation || {}
      const sharesStats = data.SharesStats || {}
      const ratios = data.Financials?.Balance_Sheet?.quarterly?.[0] || {}
      const incomeStatement = data.Financials?.Income_Statement?.quarterly?.[0] || {}

      // Helper function to safely parse numeric values
      const parseNumeric = (value: any): number | undefined => {
        if (value === null || value === undefined || value === '' || value === 'None' || value === 'N/A') {
          return undefined
        }
        const parsed = typeof value === 'string' ? parseFloat(value) : Number(value)
        return isNaN(parsed) ? undefined : parsed
      }

      // Map EODHD data to our standard FundamentalRatios format
      const result: FundamentalRatios = {
        symbol: normalizedSymbol,
        // Valuation ratios
        peRatio: parseNumeric(highlights.PERatio) ?? parseNumeric(valuation.TrailingPE),
        pegRatio: parseNumeric(highlights.PEGRatio),
        pbRatio: parseNumeric(highlights.PriceBookMRQ) ?? parseNumeric(valuation.PriceBookMRQ),
        priceToSales: parseNumeric(highlights.PriceSalesTTM) ?? parseNumeric(valuation.PriceSalesTTM),
        priceToFreeCashFlow: parseNumeric(valuation.PriceCashFlowMRQ),

        // Financial strength ratios
        debtToEquity: parseNumeric(highlights.DebtToEquity),
        currentRatio: parseNumeric(highlights.CurrentRatio),
        quickRatio: parseNumeric(highlights.QuickRatio),

        // Profitability ratios
        roe: parseNumeric(highlights.ReturnOnEquityTTM),
        roa: parseNumeric(highlights.ReturnOnAssetsTTM),
        grossProfitMargin: parseNumeric(highlights.GrossProfitMarginTTM),
        operatingMargin: parseNumeric(highlights.OperatingMarginTTM),
        netProfitMargin: parseNumeric(highlights.ProfitMarginTTM),

        // Dividend ratios
        dividendYield: parseNumeric(highlights.DividendYield),
        payoutRatio: parseNumeric(highlights.PayoutRatio),

        // Metadata
        timestamp: Date.now(),
        source: 'eodhd',
        period: 'ttm' // EODHD provides trailing twelve months data
      }

      // Log successful retrieval with data quality info
      const definedRatios = Object.values(result).filter(v => typeof v === 'number' && !isNaN(v)).length
      console.log(`✅ EODHD API: Retrieved ${definedRatios} fundamental ratios for ${symbol}`)

      return result
    } catch (error) {
      console.error(`❌ EODHD API: Error fetching fundamental ratios for ${symbol}:`, error)
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
        symbol: 'SPY',
        open: spyData.open || 0,
        high: spyData.high || 0,
        low: spyData.low || 0,
        close: spyData.close || 0,
        volume: spyData.volume || 0,
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

  private async makeRequest(url: string, retryCount: number = 0): Promise<ApiResponse<any>> {
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

  /**
   * Get put/call ratio for a symbol using EODHD options data
   * Requires EODHD options add-on subscription
   */
  async getPutCallRatio(symbol: string): Promise<PutCallRatio | null> {
    try {
      console.log(`📊 EODHD API: Fetching put/call ratio for ${symbol}`)

      if (!this.apiKey) {
        console.warn('⚠️ EODHD API: No API key for options data')
        return null
      }

      const normalizedSymbol = symbol.toUpperCase()
      const url = `${this.baseUrl}/options/${normalizedSymbol}.US?api_token=${this.apiKey}&fmt=json`

      const response = await this.makeRequest(url)

      if (!response.success || !response.data) {
        console.warn(`⚠️ EODHD API: No options data received for ${symbol}`)
        return null
      }

      const data = response.data as EODHDOptionsData

      if (!data.calls || !data.puts || data.calls.length === 0 || data.puts.length === 0) {
        console.warn(`⚠️ EODHD API: Incomplete options data for ${symbol}`)
        return null
      }

      // Calculate put/call ratios
      const totalCallVolume = data.calls.reduce((sum, call) => sum + (call.volume || 0), 0)
      const totalPutVolume = data.puts.reduce((sum, put) => sum + (put.volume || 0), 0)
      const totalCallOpenInterest = data.calls.reduce((sum, call) => sum + (call.openInterest || 0), 0)
      const totalPutOpenInterest = data.puts.reduce((sum, put) => sum + (put.openInterest || 0), 0)

      const volumeRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0
      const openInterestRatio = totalCallOpenInterest > 0 ? totalPutOpenInterest / totalCallOpenInterest : 0

      return {
        symbol: normalizedSymbol,
        volumeRatio,
        openInterestRatio,
        totalPutVolume,
        totalCallVolume,
        totalPutOpenInterest,
        totalCallOpenInterest,
        date: new Date().toISOString().split('T')[0],
        timestamp: data.timestamp || Date.now(),
        source: 'eodhd',
        metadata: {
          dataCompleteness: (totalCallVolume + totalPutVolume) > 0 ? 1.0 : 0.0,
          contractsProcessed: data.calls.length + data.puts.length,
          freeTierOptimized: false // EODHD options is a paid add-on
        }
      }
    } catch (error) {
      console.error(`❌ EODHD API: Error fetching put/call ratio for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get basic options analysis for free tier users
   * Uses aggregated options data to provide insights
   */
  async getOptionsAnalysisFreeTier(symbol: string): Promise<OptionsAnalysis | null> {
    try {
      console.log(`📈 EODHD API: Fetching options analysis for ${symbol}`)

      const putCallRatio = await this.getPutCallRatio(symbol)
      if (!putCallRatio) {
        return null
      }

      // Analyze sentiment based on put/call ratios
      let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral'
      let sentiment: 'fear' | 'greed' | 'balanced' = 'balanced'
      let confidence = 0.5
      let analysis = ''

      // Volume-based analysis
      if (putCallRatio.volumeRatio > 1.2) {
        trend = 'bearish'
        sentiment = 'fear'
        confidence = Math.min(0.8, 0.5 + (putCallRatio.volumeRatio - 1.2) * 0.3)
        analysis = `High put/call volume ratio (${putCallRatio.volumeRatio.toFixed(2)}) suggests bearish sentiment and potential fear in the market.`
      } else if (putCallRatio.volumeRatio < 0.8) {
        trend = 'bullish'
        sentiment = 'greed'
        confidence = Math.min(0.8, 0.5 + (0.8 - putCallRatio.volumeRatio) * 0.3)
        analysis = `Low put/call volume ratio (${putCallRatio.volumeRatio.toFixed(2)}) indicates bullish sentiment and market optimism.`
      } else {
        analysis = `Balanced put/call volume ratio (${putCallRatio.volumeRatio.toFixed(2)}) suggests neutral market sentiment.`
      }

      // Enhance analysis with open interest data
      if (putCallRatio.openInterestRatio !== putCallRatio.volumeRatio) {
        const oiDifference = Math.abs(putCallRatio.openInterestRatio - putCallRatio.volumeRatio)
        if (oiDifference > 0.3) {
          analysis += ` Open interest ratio (${putCallRatio.openInterestRatio.toFixed(2)}) differs significantly from volume ratio, indicating potential shift in positioning.`
          confidence = Math.max(0.3, confidence - 0.2)
        }
      }

      return {
        symbol,
        currentRatio: putCallRatio,
        historicalRatios: [putCallRatio], // Limited historical data for free tier
        trend,
        sentiment,
        confidence,
        analysis,
        timestamp: Date.now(),
        source: 'eodhd',
        freeTierLimited: false // EODHD options is a paid add-on
      }
    } catch (error) {
      console.error(`❌ EODHD API: Error fetching options analysis for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get options chain data for a symbol
   * Requires EODHD options add-on subscription
   */
  async getOptionsChain(symbol: string, expiration?: string): Promise<OptionsChain | null> {
    try {
      console.log(`🔗 EODHD API: Fetching options chain for ${symbol}${expiration ? ` expiring ${expiration}` : ''}`)

      if (!this.apiKey) {
        console.warn('⚠️ EODHD API: No API key for options data')
        return null
      }

      const normalizedSymbol = symbol.toUpperCase()
      let url = `${this.baseUrl}/options/${normalizedSymbol}.US?api_token=${this.apiKey}&fmt=json`

      if (expiration) {
        url += `&date=${expiration}`
      }

      const response = await this.makeRequest(url)

      if (!response.success || !response.data) {
        console.warn(`⚠️ EODHD API: No options chain data received for ${symbol}`)
        return null
      }

      const data = response.data as EODHDOptionsData

      if (!data.calls || !data.puts) {
        console.warn(`⚠️ EODHD API: Incomplete options chain data for ${symbol}`)
        return null
      }

      // Transform EODHD contracts to our standard format
      const transformContract = (contract: EODHDOptionsContract): OptionsContract => ({
        symbol: contract.symbol,
        strike: contract.strike,
        expiration: contract.expiration,
        type: contract.type,
        volume: contract.volume || 0,
        openInterest: contract.openInterest || 0,
        impliedVolatility: contract.impliedVolatility,
        delta: contract.delta,
        gamma: contract.gamma,
        theta: contract.theta,
        vega: contract.vega,
        bid: contract.bid,
        ask: contract.ask,
        lastPrice: contract.lastPrice,
        change: contract.change,
        changePercent: contract.changePercent,
        timestamp: contract.timestamp || Date.now(),
        source: 'eodhd'
      })

      const calls = data.calls.map(transformContract)
      const puts = data.puts.map(transformContract)

      // Extract unique expiration dates and strikes
      const expirationDates = Array.from(new Set([...calls, ...puts].map(c => c.expiration))).sort()
      const strikes = Array.from(new Set([...calls, ...puts].map(c => c.strike))).sort((a, b) => a - b)

      return {
        symbol: normalizedSymbol,
        calls,
        puts,
        expirationDates,
        strikes,
        timestamp: data.timestamp || Date.now(),
        source: 'eodhd'
      }
    } catch (error) {
      console.error(`❌ EODHD API: Error fetching options chain for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Check options data availability
   */
  async checkOptionsAvailability(): Promise<{ [key: string]: boolean }> {
    try {
      console.log('🔍 EODHD API: Checking options availability')

      if (!this.apiKey) {
        return {
          putCallRatio: false,
          optionsAnalysis: false,
          optionsChain: false,
          error: false
        }
      }

      // Test with SPY - most liquid options
      const testResult = await this.getPutCallRatio('SPY')
      const isAvailable = testResult !== null

      return {
        putCallRatio: isAvailable,
        optionsAnalysis: isAvailable,
        optionsChain: isAvailable,
        requiresSubscription: true,  // EODHD options data requires add-on subscription
        note: isAvailable
      }
    } catch (error) {
      console.error('❌ EODHD API: Error checking options availability:', error)
      return {
        putCallRatio: false,
        optionsAnalysis: false,
        optionsChain: false,
        error: false
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