/**
 * Direct Polygon.io API implementation
 * Replaces MCP-based Polygon data fetching with direct REST API calls
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse, OptionsContract, OptionsChain, PutCallRatio, OptionsAnalysis } from './types'

export class PolygonAPI implements FinancialDataProvider {
  name = 'Polygon.io'
  private baseUrl = 'https://api.polygon.io'
  private apiKey: string
  private timeout: number
  private previousCloseCache: Map<string, number> = new Map()
  private requestQueue: Array<{ timestamp: number; endpoint: string }> = []
  private readonly FREE_TIER_RATE_LIMIT = 5 // requests per minute
  private readonly RATE_LIMIT_WINDOW = 60000 // 1 minute in milliseconds

  constructor(apiKey?: string, timeout = 10000) {
    this.apiKey = apiKey || process.env.POLYGON_API_KEY || ''
    this.timeout = timeout
  }

  /**
   * Get current stock price data
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      if (!this.apiKey) {
        console.warn('Polygon API key not configured')
        return null
      }

      const upperSymbol = symbol.toUpperCase()

      // Try to get real-time snapshot data first
      const snapshotResponse = await this.makeRequest(
        `/v2/snapshot/locale/us/markets/stocks/tickers/${upperSymbol}?apikey=${this.apiKey}`
      )

      if (snapshotResponse.success && snapshotResponse.data?.ticker) {
        const ticker = snapshotResponse.data.ticker
        const price = ticker.day?.c || ticker.prevDay?.c || 0
        const previousClose = ticker.prevDay?.c || 0
        const change = price - previousClose
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

        // Cache the previous close for future use
        this.previousCloseCache.set(upperSymbol, previousClose)

        return {
          symbol: upperSymbol,
          price: Number(price.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          volume: ticker.day?.v || ticker.prevDay?.v || 0,
          timestamp: ticker.updated || Date.now(),
          source: 'polygon'
        }
      }

      // Fallback to previous day data if snapshot fails
      const prevResponse = await this.makeRequest(
        `/v2/aggs/ticker/${upperSymbol}/prev?adjusted=true&apikey=${this.apiKey}`
      )

      if (!prevResponse.success || !prevResponse.data?.results?.[0]) {
        return null
      }

      const result = prevResponse.data.results[0]
      const price = result.c || 0

      // Get cached previous close or use yesterday's open
      const previousClose = this.previousCloseCache.get(upperSymbol) || result.o || price
      const change = price - previousClose
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

      return {
        symbol: upperSymbol,
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: result.v || 0,
        timestamp: result.t || Date.now(),
        source: 'polygon'
      }
    } catch (error) {
      console.error(`Polygon API error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get company information
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      if (!this.apiKey) {
        console.warn('Polygon API key not configured')
        return null
      }

      const response = await this.makeRequest(
        `/v3/reference/tickers/${symbol.toUpperCase()}?apikey=${this.apiKey}`
      )

      if (!response.success || !response.data?.results) {
        return null
      }

      const result = response.data.results

      return {
        symbol: symbol.toUpperCase(),
        name: result.name || '',
        description: result.description || '',
        sector: result.sector || '',
        marketCap: result.market_cap || 0,
        employees: result.total_employees || 0,
        website: result.homepage_url || ''
      }
    } catch (error) {
      console.error(`Polygon company info error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get detailed market data
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      if (!this.apiKey) {
        console.warn('Polygon API key not configured')
        return null
      }

      const response = await this.makeRequest(
        `/v2/aggs/ticker/${symbol.toUpperCase()}/prev?adjusted=true&apikey=${this.apiKey}`
      )

      if (!response.success || !response.data?.results?.[0]) {
        return null
      }

      const result = response.data.results[0]

      return {
        symbol: symbol.toUpperCase(),
        open: result.o || 0,
        high: result.h || 0,
        low: result.l || 0,
        close: result.c || 0,
        volume: result.v || 0,
        timestamp: result.t || Date.now(),
        source: 'polygon'
      }
    } catch (error) {
      console.error(`Polygon market data error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get latest trade price (most real-time data available)
   */
  async getLatestTrade(symbol: string): Promise<StockData | null> {
    try {
      if (!this.apiKey) {
        return null
      }

      const upperSymbol = symbol.toUpperCase()

      // Get the latest trade
      const response = await this.makeRequest(
        `/v2/last/trade/${upperSymbol}?apikey=${this.apiKey}`
      )

      if (!response.success || !response.data?.results) {
        return this.getStockPrice(symbol) // Fallback to snapshot
      }

      const trade = response.data.results
      const price = trade.p || 0

      // Get previous close from cache or fetch it
      let previousClose = this.previousCloseCache.get(upperSymbol)
      if (!previousClose) {
        const prevData = await this.getStockPrice(symbol)
        previousClose = prevData ? prevData.price : price
      }

      const safePreviousClose = previousClose || price
      const change = price - safePreviousClose
      const changePercent = safePreviousClose > 0 ? (change / safePreviousClose) * 100 : 0

      return {
        symbol: upperSymbol,
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: trade.s || 0, // Size of the trade
        timestamp: trade.t || Date.now(),
        source: 'polygon'
      }
    } catch (error) {
      // Fallback to snapshot data
      return this.getStockPrice(symbol)
    }
  }

  /**
   * Get batch stock prices (more efficient for multiple symbols)
   */
  async getBatchPrices(symbols: string[]): Promise<Map<string, StockData>> {
    const results = new Map<string, StockData>()

    try {
      if (!this.apiKey || symbols.length === 0) {
        return results
      }

      // Get all snapshots in one call
      const response = await this.makeRequest(
        `/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${symbols.join(',')}&apikey=${this.apiKey}`
      )

      if (response.success && response.data?.tickers) {
        for (const ticker of response.data.tickers) {
          const price = ticker.day?.c || ticker.prevDay?.c || 0
          const previousClose = ticker.prevDay?.c || 0
          const change = price - previousClose
          const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

          results.set(ticker.ticker, {
            symbol: ticker.ticker,
            price: Number(price.toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2)),
            volume: ticker.day?.v || ticker.prevDay?.v || 0,
            timestamp: ticker.updated || Date.now(),
            source: 'polygon'
          })
        }
      }
    } catch (error) {
      console.error('Polygon batch price error:', error)
    }

    return results
  }

  /**
   * Health check for Polygon API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false
      }

      const response = await this.makeRequest(
        `/v3/reference/tickers?limit=1&apikey=${this.apiKey}`
      )

      return response.success
    } catch {
      return false
    }
  }

  /**
   * Get stocks by sector (simplified implementation)
   */
  async getStocksBySector(sector: string, limit = 20): Promise<StockData[]> {
    try {
      if (!this.apiKey) {
        console.warn('Polygon API key not configured')
        return []
      }

      // Note: Polygon doesn't have a direct sector endpoint in the same way
      // This is a simplified implementation that would need sector-to-symbol mapping
      const response = await this.makeRequest(
        `/v3/reference/tickers?sector=${encodeURIComponent(sector)}&limit=${limit}&apikey=${this.apiKey}`
      )

      if (!response.success || !response.data?.results) {
        return []
      }

      // Get stock prices for each symbol found
      const symbols = response.data.results.map((item: any) => item.ticker).slice(0, limit)
      const stockPromises = symbols.map((symbol: string) => this.getStockPrice(symbol))
      const stocks = await Promise.all(stockPromises)

      return stocks.filter(Boolean) as StockData[]
    } catch (error) {
      console.error(`Polygon sector data error for ${sector}:`, error)
      return []
    }
  }

  /**
   * Check and enforce free tier rate limiting (5 requests per minute)
   */
  private checkRateLimit(endpoint: string): void {
    const now = Date.now()

    // Remove requests older than 1 minute
    this.requestQueue = this.requestQueue.filter(req =>
      now - req.timestamp < this.RATE_LIMIT_WINDOW
    )

    // Check if we're at the rate limit
    if (this.requestQueue.length >= this.FREE_TIER_RATE_LIMIT) {
      const oldestRequest = this.requestQueue[0]
      const waitTime = this.RATE_LIMIT_WINDOW - (now - oldestRequest.timestamp)
      throw new Error(`Rate limit exceeded. Polygon free tier allows ${this.FREE_TIER_RATE_LIMIT} requests per minute. Please wait ${Math.ceil(waitTime / 1000)} seconds.`)
    }

    // Add current request to queue
    this.requestQueue.push({ timestamp: now, endpoint })
  }

  /**
   * Get options chain for a symbol (optimized for free tier)
   */
  async getOptionsChain(symbol: string, expiration?: string): Promise<OptionsChain | null> {
    try {
      if (!this.apiKey) {
        console.warn('Polygon API key not configured')
        return null
      }

      const upperSymbol = symbol.toUpperCase()
      let endpoint = `/v3/reference/options/contracts?underlying_ticker=${upperSymbol}&limit=250&apikey=${this.apiKey}`

      if (expiration) {
        endpoint += `&expiration_date=${expiration}`
      }

      // Check rate limiting before making request
      this.checkRateLimit(endpoint)

      const response = await this.makeRequest(endpoint)

      if (!response.success || !response.data?.results) {
        return null
      }

      const contracts = response.data.results
      const calls: OptionsContract[] = []
      const puts: OptionsContract[] = []
      const expirationDates = new Set<string>()
      const strikes = new Set<number>()

      for (const contract of contracts) {
        const optionContract: OptionsContract = {
          symbol: contract.ticker,
          strike: contract.strike_price,
          expiration: contract.expiration_date,
          type: contract.contract_type === 'call' ? 'call' : 'put',
          volume: 0, // Will be populated from snapshot
          openInterest: 0, // Will be populated from snapshot
          timestamp: Date.now(),
          source: 'polygon'
        }

        expirationDates.add(contract.expiration_date)
        strikes.add(contract.strike_price)

        if (contract.contract_type === 'call') {
          calls.push(optionContract)
        } else {
          puts.push(optionContract)
        }
      }

      // Get snapshot data for volume and open interest (with rate limiting)
      this.checkRateLimit(`/v3/snapshot/options/${upperSymbol}`)
      const snapshotResponse = await this.makeRequest(
        `/v3/snapshot/options/${upperSymbol}?limit=100&apikey=${this.apiKey}`
      )

      if (snapshotResponse.success && snapshotResponse.data?.results) {
        const snapshots = snapshotResponse.data.results
        const snapshotMap = new Map(snapshots.map((s: any) => [s.underlying_ticker?.ticker || s.details?.ticker, s]))

        // Update contracts with snapshot data
        for (const call of calls) {
          const snapshot = snapshotMap.get(call.symbol)
          if (snapshot && typeof snapshot === 'object' && snapshot !== null) {
            const snapshotObj = snapshot as any
            call.volume = snapshotObj.day?.volume || 0
            call.openInterest = snapshotObj.open_interest || 0
            call.impliedVolatility = snapshotObj.implied_volatility
            call.bid = snapshotObj.details?.bid
            call.ask = snapshotObj.details?.ask
            call.lastPrice = snapshotObj.day?.last_price
            call.change = snapshotObj.day?.change
            call.changePercent = snapshotObj.day?.change_percent
          }
        }

        for (const put of puts) {
          const snapshot = snapshotMap.get(put.symbol)
          if (snapshot && typeof snapshot === 'object' && snapshot !== null) {
            const snapshotObj = snapshot as any
            put.volume = snapshotObj.day?.volume || 0
            put.openInterest = snapshotObj.open_interest || 0
            put.impliedVolatility = snapshotObj.implied_volatility
            put.bid = snapshotObj.details?.bid
            put.ask = snapshotObj.details?.ask
            put.lastPrice = snapshotObj.day?.last_price
            put.change = snapshotObj.day?.change
            put.changePercent = snapshotObj.day?.change_percent
          }
        }
      }

      return {
        symbol: upperSymbol,
        calls,
        puts,
        expirationDates: Array.from(expirationDates).sort(),
        strikes: Array.from(strikes).sort((a, b) => a - b),
        timestamp: Date.now(),
        source: 'polygon'
      }
    } catch (error) {
      console.error(`Polygon options chain error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate put/call ratio for a symbol (optimized for free tier)
   */
  async getPutCallRatio(symbol: string): Promise<PutCallRatio | null> {
    try {
      if (!this.apiKey) {
        console.warn('Polygon API key not configured', { apiKey: this.apiKey })
        return null
      }

      const upperSymbol = symbol.toUpperCase()

      // Check rate limiting before making request
      this.checkRateLimit(`/v3/snapshot/options/${upperSymbol}`)

      // Get options snapshot for the symbol (reduced limit for free tier)
      const response = await this.makeRequest(
        `/v3/snapshot/options/${upperSymbol}?limit=250&apikey=${this.apiKey}`
      )

      if (!response.success) {
        // Handle specific free tier errors
        if (response.error?.includes('UNAUTHORIZED') || response.error?.includes('403')) {
          console.warn(`Polygon free tier may not support this endpoint: ${response.error}`)
          return null
        }
        throw new Error(response.error || 'Failed to fetch options data')
      }

      if (!response.data?.results || response.data.results.length === 0) {
        console.warn(`No options data available for ${upperSymbol}. This may be due to free tier limitations.`)
        return null
      }

      let totalPutVolume = 0
      let totalCallVolume = 0
      let totalPutOpenInterest = 0
      let totalCallOpenInterest = 0
      let processedContracts = 0

      for (const option of response.data.results) {
        const optionObj = option as any
        const contractType = optionObj.details?.contract_type ||
                           (optionObj.underlying_ticker?.ticker?.includes('P') ? 'put' : 'call')
        const volume = optionObj.day?.volume || 0
        const openInterest = optionObj.open_interest || 0

        if (contractType === 'put') {
          totalPutVolume += volume
          totalPutOpenInterest += openInterest
        } else {
          totalCallVolume += volume
          totalCallOpenInterest += openInterest
        }
        processedContracts++
      }

      // Add metadata about data completeness for free tier
      const dataCompleteness = Math.min(processedContracts / 100, 1) // Expect at least 100 contracts for good data

      const volumeRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0
      const openInterestRatio = totalCallOpenInterest > 0 ? totalPutOpenInterest / totalCallOpenInterest : 0

      return {
        symbol: upperSymbol,
        volumeRatio,
        openInterestRatio,
        totalPutVolume,
        totalCallVolume,
        totalPutOpenInterest,
        totalCallOpenInterest,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        source: 'polygon',
        metadata: {
          dataCompleteness,
          contractsProcessed: processedContracts,
          freeTierOptimized: true,
          rateLimitStatus: this.getRateLimitStatus()
        }
      }
    } catch (error) {
      console.error(`Polygon put/call ratio error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get historical put/call ratios
   */
  async getHistoricalPutCallRatios(symbol: string, days: number = 30): Promise<PutCallRatio[]> {
    try {
      if (!this.apiKey) {
        console.warn('Polygon API key not configured')
        return []
      }

      const upperSymbol = symbol.toUpperCase()
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const ratios: PutCallRatio[] = []

      // For now, we'll return just the current ratio
      // Polygon doesn't have a direct historical P/C ratio endpoint
      // In production, you'd want to store daily ratios in a database
      const currentRatio = await this.getPutCallRatio(symbol)
      if (currentRatio) {
        ratios.push(currentRatio)
      }

      return ratios
    } catch (error) {
      console.error(`Polygon historical P/C ratio error for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Get simplified options analysis optimized for free tier
   */
  async getOptionsAnalysisFreeTier(symbol: string): Promise<OptionsAnalysis | null> {
    try {
      const currentRatio = await this.getPutCallRatio(symbol)
      if (!currentRatio) {
        console.warn(`No options data available for ${symbol}. Free tier may have limited options coverage.`)
        return null
      }

      // For free tier, provide analysis based on current ratio only
      const analysis = this.analyzeOptionsData(currentRatio)

      return {
        symbol: symbol.toUpperCase(),
        currentRatio,
        historicalRatios: [], // Limited for free tier
        ...analysis,
        timestamp: Date.now(),
        source: 'polygon',
        freeTierLimited: true
      }
    } catch (error) {
      console.error(`Polygon options analysis error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Analyze options data for sentiment (shared logic)
   */
  private analyzeOptionsData(ratio: PutCallRatio): {
    trend: 'bullish' | 'bearish' | 'neutral'
    sentiment: 'fear' | 'greed' | 'balanced'
    confidence: number
    analysis: string
  } {
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral'
    let sentiment: 'fear' | 'greed' | 'balanced' = 'balanced'
    let confidence = 0.5

    // P/C ratio interpretation:
    // < 0.7 = Bullish (more calls than puts)
    // 0.7 - 1.3 = Neutral
    // > 1.3 = Bearish (more puts than calls)
    if (ratio.volumeRatio < 0.7) {
      trend = 'bullish'
      sentiment = 'greed'
      confidence = Math.min(0.9, 0.5 + (0.7 - ratio.volumeRatio))
    } else if (ratio.volumeRatio > 1.3) {
      trend = 'bearish'
      sentiment = 'fear'
      confidence = Math.min(0.9, 0.5 + (ratio.volumeRatio - 1.3) * 0.3)
    } else {
      trend = 'neutral'
      sentiment = 'balanced'
      confidence = 0.6
    }

    let analysis = `Put/Call Volume Ratio: ${ratio.volumeRatio.toFixed(2)} | `
    analysis += `Put/Call OI Ratio: ${ratio.openInterestRatio.toFixed(2)} | `
    analysis += `Total Put Volume: ${ratio.totalPutVolume.toLocaleString()} | `
    analysis += `Total Call Volume: ${ratio.totalCallVolume.toLocaleString()} | `

    if (trend === 'bullish') {
      analysis += 'Options flow indicates bullish sentiment with higher call activity.'
    } else if (trend === 'bearish') {
      analysis += 'Options flow indicates bearish sentiment with higher put activity.'
    } else {
      analysis += 'Options flow is relatively balanced between puts and calls.'
    }

    return { trend, sentiment, confidence, analysis }
  }

  /**
   * Get options analysis with put/call ratios and sentiment (full version)
   */
  async getOptionsAnalysis(symbol: string): Promise<OptionsAnalysis | null> {
    try {
      const currentRatio = await this.getPutCallRatio(symbol)
      if (!currentRatio) {
        return null
      }

      const historicalRatios = await this.getHistoricalPutCallRatios(symbol, 5)
      const analysis = this.analyzeOptionsData(currentRatio)

      return {
        symbol: symbol.toUpperCase(),
        currentRatio,
        historicalRatios,
        ...analysis,
        timestamp: Date.now(),
        source: 'polygon'
      }
    } catch (error) {
      console.error(`Polygon options analysis error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get rate limit status for monitoring
   */
  getRateLimitStatus(): {
    requestsInLastMinute: number
    remainingRequests: number
    resetTime: number
  } {
    const now = Date.now()

    // Clean old requests
    this.requestQueue = this.requestQueue.filter(req =>
      now - req.timestamp < this.RATE_LIMIT_WINDOW
    )

    const requestsInLastMinute = this.requestQueue.length
    const remainingRequests = Math.max(0, this.FREE_TIER_RATE_LIMIT - requestsInLastMinute)
    const oldestRequest = this.requestQueue[0]
    const resetTime = oldestRequest ? oldestRequest.timestamp + this.RATE_LIMIT_WINDOW : now

    return {
      requestsInLastMinute,
      remainingRequests,
      resetTime
    }
  }

  /**
   * Make HTTP request to Polygon API
   */
  private async makeRequest(endpoint: string): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
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
        source: 'polygon',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'polygon',
        timestamp: Date.now()
      }
    }
  }
}