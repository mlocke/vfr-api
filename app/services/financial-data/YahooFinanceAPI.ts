/**
 * Direct Yahoo Finance API implementation
 * Replaces MCP-based Yahoo Finance data fetching with direct REST API calls
 * Note: Using unofficial Yahoo Finance API endpoints
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse, OptionsContract, OptionsChain, PutCallRatio, OptionsAnalysis } from './types'

export class YahooFinanceAPI implements FinancialDataProvider {
  name = 'Yahoo Finance'
  private baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart'
  private timeout: number

  constructor(timeout = 10000) {
    this.timeout = timeout
  }

  /**
   * Get current stock price data
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      const response = await this.makeRequest(`${symbol.toUpperCase()}?interval=1d&range=2d`)

      if (!response.success || !response.data?.chart?.result?.[0]) {
        return null
      }

      const result = response.data.chart.result[0]
      const meta = result.meta
      const quotes = result.indicators?.quote?.[0]

      if (!meta || !quotes) {
        return null
      }

      const currentPrice = meta.regularMarketPrice || meta.previousClose || 0
      const previousClose = meta.previousClose || 0
      const change = currentPrice - previousClose
      const changePercent = previousClose ? (change / previousClose) * 100 : 0

      return {
        symbol: symbol.toUpperCase(),
        price: Number(currentPrice.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: meta.regularMarketVolume || 0,
        timestamp: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
        source: 'yahoo'
      }
    } catch (error) {
      console.error(`Yahoo Finance API error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get company information
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      // Yahoo Finance doesn't provide comprehensive company info in chart API
      // This would require additional endpoints or alternative data sources
      console.warn('Yahoo Finance company info requires additional API endpoints')
      return null
    } catch (error) {
      console.error(`Yahoo Finance company info error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get detailed market data
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      const response = await this.makeRequest(`${symbol.toUpperCase()}?interval=1d&range=2d`)

      if (!response.success || !response.data?.chart?.result?.[0]) {
        return null
      }

      const result = response.data.chart.result[0]
      const quotes = result.indicators?.quote?.[0]
      const timestamps = result.timestamp

      if (!quotes || !timestamps || timestamps.length === 0) {
        return null
      }

      // Get the latest trading day data
      const latestIndex = timestamps.length - 1
      const latestTimestamp = timestamps[latestIndex] * 1000

      return {
        symbol: symbol.toUpperCase(),
        open: quotes.open?.[latestIndex] || 0,
        high: quotes.high?.[latestIndex] || 0,
        low: quotes.low?.[latestIndex] || 0,
        close: quotes.close?.[latestIndex] || 0,
        volume: quotes.volume?.[latestIndex] || 0,
        timestamp: latestTimestamp,
        source: 'yahoo'
      }
    } catch (error) {
      console.error(`Yahoo Finance market data error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Health check for Yahoo Finance API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest('AAPL?interval=1d&range=1d')
      return response.success
    } catch {
      return false
    }
  }

  /**
   * Get stocks by sector (not directly supported by Yahoo Finance chart API)
   */
  async getStocksBySector(sector: string, limit = 20): Promise<StockData[]> {
    try {
      // Yahoo Finance chart API doesn't provide sector-based stock listing
      // This would require sector-to-symbol mapping or alternative endpoints
      console.warn('Yahoo Finance sector search not implemented - use alternative method')
      return []
    } catch (error) {
      console.error(`Yahoo Finance sector data error for ${sector}:`, error)
      return []
    }
  }

  /**
   * Get put/call ratio using Yahoo Finance options data
   * WARNING: Uses unofficial Yahoo Finance API - may break at any time
   *
   * This is a fallback option when premium APIs are not available
   * Reliability concerns: Rate limiting, authentication changes, API structure changes
   */
  async getPutCallRatio(symbol: string): Promise<PutCallRatio | null> {
    try {
      console.warn('⚠️ Using unofficial Yahoo Finance options API - unreliable')

      // Try to get options chain data
      const optionsChain = await this.getOptionsChain(symbol)
      if (!optionsChain) {
        console.warn('📊 Could not retrieve options chain for put/call ratio calculation')
        return null
      }

      // Calculate put/call ratios from options chain data
      const totalCallVolume = optionsChain.calls.reduce((sum, contract) => sum + (contract.volume || 0), 0)
      const totalPutVolume = optionsChain.puts.reduce((sum, contract) => sum + (contract.volume || 0), 0)
      const totalCallOI = optionsChain.calls.reduce((sum, contract) => sum + (contract.openInterest || 0), 0)
      const totalPutOI = optionsChain.puts.reduce((sum, contract) => sum + (contract.openInterest || 0), 0)

      if (totalCallVolume === 0 && totalPutVolume === 0) {
        console.warn('📊 No volume data available for put/call ratio')
        return null
      }

      const volumeRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0
      const openInterestRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0

      return {
        symbol: symbol.toUpperCase(),
        volumeRatio,
        openInterestRatio,
        totalPutVolume,
        totalCallVolume,
        totalPutOpenInterest: totalPutOI,
        totalCallOpenInterest: totalCallOI,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        source: 'yahoo',
        metadata: {
          freeTierOptimized: true,
          dataCompleteness: 0.7, // Lower reliability due to unofficial API
          contractsProcessed: optionsChain.calls.length + optionsChain.puts.length
        }
      }
    } catch (error) {
      console.error(`Yahoo Finance put/call ratio error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get basic options analysis using Yahoo Finance data
   * WARNING: Uses unofficial Yahoo Finance API - may break at any time
   *
   * Provides limited options analysis compared to premium services
   */
  async getOptionsAnalysisFreeTier(symbol: string): Promise<OptionsAnalysis | null> {
    try {
      console.warn('⚠️ Using unofficial Yahoo Finance for options analysis - limited features')

      const putCallRatio = await this.getPutCallRatio(symbol)
      if (!putCallRatio) {
        return null
      }

      // Simple sentiment analysis based on put/call ratio
      let sentiment: 'fear' | 'greed' | 'balanced' = 'balanced'
      let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral'
      let confidence = 0.4 // Lower confidence due to limited data

      if (putCallRatio.volumeRatio > 1.2) {
        sentiment = 'fear'
        trend = 'bearish'
        confidence = 0.6
      } else if (putCallRatio.volumeRatio < 0.8) {
        sentiment = 'greed'
        trend = 'bullish'
        confidence = 0.6
      }

      const analysis = `Put/Call Volume Ratio: ${putCallRatio.volumeRatio.toFixed(2)} | ` +
                      `OI Ratio: ${putCallRatio.openInterestRatio.toFixed(2)} | ` +
                      `Sentiment: ${sentiment.toUpperCase()} | ` +
                      `Note: Limited analysis from free Yahoo Finance data`

      return {
        symbol: symbol.toUpperCase(),
        currentRatio: putCallRatio,
        historicalRatios: [], // Not available through free API
        trend,
        sentiment,
        confidence,
        analysis,
        timestamp: Date.now(),
        source: 'yahoo',
        freeTierLimited: true
      }
    } catch (error) {
      console.error(`Yahoo Finance options analysis error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get options chain using Yahoo Finance options API
   * WARNING: Uses unofficial Yahoo Finance API - highly unreliable
   *
   * API structure: https://query1.finance.yahoo.com/v7/finance/options/SYMBOL
   * Known issues: Rate limiting, authentication requirements, structural changes
   */
  async getOptionsChain(symbol: string, expiration?: string): Promise<OptionsChain | null> {
    try {
      console.warn('⚠️ Attempting Yahoo Finance options chain - unofficial API')

      const optionsUrl = `https://query1.finance.yahoo.com/v7/finance/options/${symbol.toUpperCase()}`
      const response = await this.makeOptionsRequest(optionsUrl)

      if (!response.success || !response.data?.optionChain?.result?.[0]) {
        console.warn('🔗 Yahoo Finance options chain request failed')
        return null
      }

      const optionData = response.data.optionChain.result[0]
      const options = optionData.options?.[0]

      if (!options || (!options.calls && !options.puts)) {
        console.warn('🔗 No options data found in Yahoo Finance response')
        return null
      }

      const calls: OptionsContract[] = (options.calls || []).map((call: any) => ({
        symbol: call.contractSymbol || '',
        strike: call.strike || 0,
        expiration: new Date(call.expiration * 1000).toISOString(),
        type: 'call' as const,
        volume: call.volume || 0,
        openInterest: call.openInterest || 0,
        impliedVolatility: call.impliedVolatility,
        delta: undefined, // Not available in Yahoo Finance
        gamma: undefined,
        theta: undefined,
        vega: undefined,
        bid: call.bid,
        ask: call.ask,
        lastPrice: call.lastPrice,
        change: call.change,
        changePercent: call.percentChange,
        timestamp: Date.now(),
        source: 'yahoo'
      }))

      const puts: OptionsContract[] = (options.puts || []).map((put: any) => ({
        symbol: put.contractSymbol || '',
        strike: put.strike || 0,
        expiration: new Date(put.expiration * 1000).toISOString(),
        type: 'put' as const,
        volume: put.volume || 0,
        openInterest: put.openInterest || 0,
        impliedVolatility: put.impliedVolatility,
        delta: undefined, // Not available in Yahoo Finance
        gamma: undefined,
        theta: undefined,
        vega: undefined,
        bid: put.bid,
        ask: put.ask,
        lastPrice: put.lastPrice,
        change: put.change,
        changePercent: put.percentChange,
        timestamp: Date.now(),
        source: 'yahoo'
      }))

      const expirationDates = optionData.expirationDates?.map((exp: number) =>
        new Date(exp * 1000).toISOString()
      ) || []

      const strikes = optionData.strikes || []

      return {
        symbol: symbol.toUpperCase(),
        calls,
        puts,
        expirationDates,
        strikes,
        timestamp: Date.now(),
        source: 'yahoo'
      }
    } catch (error) {
      console.error(`Yahoo Finance options chain error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Check if Yahoo Finance options features are available
   * Note: Availability is unpredictable due to unofficial API status
   */
  async checkOptionsAvailability(): Promise<{ [key: string]: boolean | string }> {
    try {
      // Test with a common stock symbol
      const testChain = await this.getOptionsChain('SPY')
      const isAvailable = testChain !== null

      return {
        putCallRatio: isAvailable,
        optionsAnalysis: isAvailable,
        optionsChain: isAvailable,
        unofficial: true,
        unreliable: true,
        message: isAvailable
          ? 'Yahoo Finance unofficial API currently working'
          : 'Yahoo Finance unofficial API not responding'
      }
    } catch (error) {
      return {
        putCallRatio: false,
        optionsAnalysis: false,
        optionsChain: false,
        unofficial: true,
        unreliable: true,
        message: 'Yahoo Finance unofficial API error: ' + (error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  /**
   * Make HTTP request to Yahoo Finance options API
   * Includes special handling for options endpoints
   */
  private async makeOptionsRequest(url: string): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://finance.yahoo.com/',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site'
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
        source: 'yahoo',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'yahoo',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Make HTTP request to Yahoo Finance API
   */
  private async makeRequest(endpoint: string): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; VFR-API/1.0)'
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
        source: 'yahoo',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'yahoo',
        timestamp: Date.now()
      }
    }
  }
}