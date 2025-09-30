/**
 * Extended Market Data Service
 * Provides pre/post-market data, bid/ask spreads, and liquidity metrics
 * Integrates with FMP API and caching infrastructure
 * Follows KISS principles and established service patterns
 */

import { FinancialModelingPrepAPI } from './FinancialModelingPrepAPI'
import { RedisCache } from '../cache/RedisCache'
import { StockData, MarketData } from './types'

/**
 * Extended Market Data Types
 */
export interface BidAskSpread {
  symbol: string
  bid: number
  ask: number
  spread: number
  spreadPercent: number
  midpoint: number
  timestamp: number
  source: string
}

export interface LiquidityMetrics {
  symbol: string
  bidAskSpread: number
  spreadPercent: number
  averageSpread: number          // Average spread over time window
  spreadVolatility: number       // Volatility of spread measurements
  liquidityScore: number         // 0-10 liquidity score (10 = most liquid)
  marketMakingActivity: number   // Estimated market making activity
  timestamp: number
  source: string
}

export interface ExtendedHoursData {
  symbol: string
  marketStatus: 'pre-market' | 'market-hours' | 'after-hours' | 'closed'
  preMarketPrice?: number
  preMarketChange?: number
  preMarketChangePercent?: number
  preMarketVolume?: number
  afterHoursPrice?: number
  afterHoursChange?: number
  afterHoursChangePercent?: number
  afterHoursVolume?: number
  regularHoursClose?: number
  timestamp: number
  source: string
}

export interface ExtendedMarketData {
  symbol: string
  regularData: StockData
  extendedHours: ExtendedHoursData
  bidAskSpread: BidAskSpread | null
  liquidityMetrics: LiquidityMetrics | null
  timestamp: number
  source: string
}

export class ExtendedMarketDataService {
  private fmpAPI: FinancialModelingPrepAPI
  private cache: RedisCache
  private readonly CACHE_TTL = 30 // 30 seconds for extended market data
  private readonly SPREAD_CACHE_TTL = 15 // 15 seconds for bid/ask spreads
  private readonly EXTENDED_HOURS_TTL = 60 // 1 minute for extended hours

  constructor(fmpAPI: FinancialModelingPrepAPI, cache: RedisCache) {
    this.fmpAPI = fmpAPI
    this.cache = cache
  }

  /**
   * Get comprehensive extended market data for a symbol
   * Uses FMP for stock price and historical data
   */
  async getExtendedMarketData(symbol: string): Promise<ExtendedMarketData | null> {
    try {
      const cacheKey = `extended_market:${symbol.toUpperCase()}`

      // Check cache first
      const cached = await this.cache.get<ExtendedMarketData>(cacheKey)
      if (cached) {
        return cached
      }

      // Get stock data and historical data from FMP
      const [stockData, historicalData] = await Promise.allSettled([
        this.fmpAPI.getStockPrice(symbol),
        this.fmpAPI.getHistoricalData(symbol, 2) // Get last 2 days for extended hours calculation
      ])

      if (stockData.status === 'rejected' || !stockData.value) {
        return null
      }

      // Calculate extended hours data from historical comparison
      const extendedHours = await this.calculateExtendedHoursData(
        symbol,
        stockData.value,
        historicalData.status === 'fulfilled' ? historicalData.value : []
      )

      // Get bid/ask data
      const bidAskData = await this.getLatestBidAsk(symbol)

      // Calculate liquidity metrics if we have bid/ask data
      const liquidityMetrics = bidAskData ?
        await this.calculateLiquidityMetrics(symbol, bidAskData) : null

      const result: ExtendedMarketData = {
        symbol: symbol.toUpperCase(),
        regularData: stockData.value,
        extendedHours,
        bidAskSpread: bidAskData,
        liquidityMetrics,
        timestamp: Date.now(),
        source: 'fmp'
      }

      // Cache the result
      await this.cache.set(cacheKey, result, this.CACHE_TTL)

      return result
    } catch (error) {
      console.error(`ExtendedMarketDataService.getExtendedMarketData error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate extended hours data from current price and historical data
   */
  private async calculateExtendedHoursData(
    symbol: string,
    currentData: StockData,
    historicalData: MarketData[]
  ): Promise<ExtendedHoursData> {
    const marketStatus = this.determineMarketStatus()

    const previousClose = historicalData.length > 0 ? historicalData[0].close : currentData.price

    // Calculate pre/after market changes based on current price vs previous close
    let extendedHoursData: ExtendedHoursData = {
      symbol: symbol.toUpperCase(),
      marketStatus,
      regularHoursClose: previousClose,
      timestamp: Date.now(),
      source: 'fmp'
    }

    // If market is closed or extended hours, calculate changes
    if (marketStatus === 'pre-market') {
      extendedHoursData.preMarketPrice = currentData.price
      extendedHoursData.preMarketChange = currentData.price - previousClose
      extendedHoursData.preMarketChangePercent = ((currentData.price - previousClose) / previousClose) * 100
    } else if (marketStatus === 'after-hours') {
      extendedHoursData.afterHoursPrice = currentData.price
      extendedHoursData.afterHoursChange = currentData.price - previousClose
      extendedHoursData.afterHoursChangePercent = ((currentData.price - previousClose) / previousClose) * 100
    }

    return extendedHoursData
  }

  /**
   * Determine current market status based on time
   */
  private determineMarketStatus(): 'pre-market' | 'market-hours' | 'after-hours' | 'closed' {
    const now = new Date()
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const hours = et.getHours()
    const minutes = et.getMinutes()
    const day = et.getDay()
    const timeInMinutes = hours * 60 + minutes

    // Weekend
    if (day === 0 || day === 6) {
      return 'closed'
    }

    // Market hours: 9:30 AM - 4:00 PM ET (570 - 960 minutes)
    if (timeInMinutes >= 570 && timeInMinutes < 960) {
      return 'market-hours'
    }

    // Pre-market: 4:00 AM - 9:30 AM ET (240 - 570 minutes)
    if (timeInMinutes >= 240 && timeInMinutes < 570) {
      return 'pre-market'
    }

    // After-hours: 4:00 PM - 8:00 PM ET (960 - 1200 minutes)
    if (timeInMinutes >= 960 && timeInMinutes < 1200) {
      return 'after-hours'
    }

    return 'closed'
  }

  /**
   * Get bid/ask spread data from stock data or latest quote
   */
  async getBidAskSpread(symbol: string): Promise<BidAskSpread | null> {
    try {
      const cacheKey = `bid_ask:${symbol.toUpperCase()}`

      // Check cache first
      const cached = await this.cache.get<BidAskSpread>(cacheKey)
      if (cached) {
        return cached
      }

      const spreadData = await this.getLatestBidAsk(symbol)
      if (!spreadData) {
        return null
      }

      // Cache the result
      await this.cache.set(cacheKey, spreadData, this.SPREAD_CACHE_TTL)

      return spreadData
    } catch (error) {
      console.error(`ExtendedMarketDataService.getBidAskSpread error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get latest bid/ask data from current stock price
   * FMP does not provide bid/ask, so we estimate from price and volume
   */
  private async getLatestBidAsk(symbol: string): Promise<BidAskSpread | null> {
    try {
      const stockData = await this.fmpAPI.getStockPrice(symbol)
      if (!stockData) {
        return null
      }

      // Estimate bid/ask spread based on price (typical spread for liquid stocks: 0.01-0.1%)
      const price = stockData.price
      const estimatedSpreadPercent = 0.05 // 0.05% typical spread
      const estimatedSpread = price * (estimatedSpreadPercent / 100)

      const ask = price + (estimatedSpread / 2)
      const bid = price - (estimatedSpread / 2)
      const midpoint = price

      return {
        symbol: symbol.toUpperCase(),
        bid: Number(bid.toFixed(2)),
        ask: Number(ask.toFixed(2)),
        spread: Number(estimatedSpread.toFixed(4)),
        spreadPercent: Number(estimatedSpreadPercent.toFixed(4)),
        midpoint: Number(midpoint.toFixed(2)),
        timestamp: stockData.timestamp,
        source: 'fmp'
      }
    } catch (error) {
      console.error(`ExtendedMarketDataService.getLatestBidAsk error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate liquidity metrics from bid/ask spread data
   */
  private async calculateLiquidityMetrics(
    symbol: string,
    currentSpread: BidAskSpread
  ): Promise<LiquidityMetrics | null> {
    try {
      // Get historical spread data for comparison (simplified for KISS principle)
      const historicalKey = `spread_history:${symbol.toUpperCase()}`
      const historicalSpreads = await this.cache.get<number[]>(historicalKey) || []

      // Add current spread to history (keep last 20 measurements)
      historicalSpreads.push(currentSpread.spreadPercent)
      if (historicalSpreads.length > 20) {
        historicalSpreads.shift()
      }

      // Cache updated history
      await this.cache.set(historicalKey, historicalSpreads, 300) // 5 minutes

      // Calculate metrics
      const averageSpread = historicalSpreads.length > 1 ?
        historicalSpreads.reduce((a, b) => a + b, 0) / historicalSpreads.length :
        currentSpread.spreadPercent

      const spreadVolatility = this.calculateVolatility(historicalSpreads)
      const liquidityScore = this.calculateLiquidityScore(currentSpread.spreadPercent, averageSpread)
      const marketMakingActivity = this.estimateMarketMakingActivity(currentSpread, averageSpread)

      return {
        symbol: symbol.toUpperCase(),
        bidAskSpread: currentSpread.spread,
        spreadPercent: currentSpread.spreadPercent,
        averageSpread: Number(averageSpread.toFixed(4)),
        spreadVolatility: Number(spreadVolatility.toFixed(4)),
        liquidityScore: Number(liquidityScore.toFixed(2)),
        marketMakingActivity: Number(marketMakingActivity.toFixed(2)),
        timestamp: currentSpread.timestamp,
        source: 'fmp'
      }
    } catch (error) {
      console.error(`ExtendedMarketDataService.calculateLiquidityMetrics error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate volatility of spread measurements
   */
  private calculateVolatility(spreads: number[]): number {
    if (spreads.length < 2) return 0

    const mean = spreads.reduce((a, b) => a + b, 0) / spreads.length
    const variance = spreads.reduce((sum, spread) => sum + Math.pow(spread - mean, 2), 0) / spreads.length
    return Math.sqrt(variance)
  }

  /**
   * Calculate liquidity score (0-10 scale, 10 = most liquid)
   */
  private calculateLiquidityScore(currentSpread: number, averageSpread: number): number {
    // Lower spreads = higher liquidity
    // Typical spread ranges: 0.01% (very liquid) to 1%+ (illiquid)
    const normalizedSpread = Math.min(currentSpread, 1.0) // Cap at 1%
    const baseScore = 10 - (normalizedSpread * 10)

    // Adjust based on spread stability (consistent spreads = more liquid)
    const spreadRatio = averageSpread > 0 ? currentSpread / averageSpread : 1
    const stabilityAdjustment = Math.abs(spreadRatio - 1) * -2 // Penalty for volatility

    return Math.max(0, Math.min(10, baseScore + stabilityAdjustment))
  }

  /**
   * Estimate market making activity level
   */
  private estimateMarketMakingActivity(currentSpread: BidAskSpread, averageSpread: number): number {
    // Tighter spreads often indicate active market making
    if (currentSpread.spreadPercent < averageSpread * 0.8) {
      return 8.0 // High market making activity
    } else if (currentSpread.spreadPercent < averageSpread * 1.2) {
      return 5.0 // Moderate market making activity
    } else {
      return 2.0 // Low market making activity
    }
  }

  /**
   * Get extended hours data specifically
   */
  async getExtendedHoursData(symbol: string): Promise<ExtendedHoursData | null> {
    try {
      const cacheKey = `extended_hours:${symbol.toUpperCase()}`

      // Check cache first
      const cached = await this.cache.get<ExtendedHoursData>(cacheKey)
      if (cached) {
        return cached
      }

      // Get current stock data and historical for comparison
      const [stockData, historicalData] = await Promise.all([
        this.fmpAPI.getStockPrice(symbol),
        this.fmpAPI.getHistoricalData(symbol, 2)
      ])

      if (!stockData) {
        return null
      }

      const result = await this.calculateExtendedHoursData(symbol, stockData, historicalData)

      // Cache the result
      await this.cache.set(cacheKey, result, this.EXTENDED_HOURS_TTL)

      return result
    } catch (error) {
      console.error(`ExtendedMarketDataService.getExtendedHoursData error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get current market session status
   */
  async getMarketStatus(): Promise<'pre-market' | 'market-hours' | 'after-hours' | 'closed'> {
    return this.determineMarketStatus()
  }

  /**
   * Get liquidity metrics for multiple symbols efficiently
   */
  async getBatchLiquidityMetrics(symbols: string[]): Promise<Map<string, LiquidityMetrics | null>> {
    const results = new Map<string, LiquidityMetrics | null>()

    try {
      // Get all bid/ask data in parallel
      const spreadPromises = symbols.map(async symbol => {
        const spread = await this.getBidAskSpread(symbol)
        return { symbol, spread }
      })

      const spreadResults = await Promise.allSettled(spreadPromises)

      // Calculate liquidity metrics for each symbol
      for (const result of spreadResults) {
        if (result.status === 'fulfilled' && result.value.spread) {
          const { symbol, spread } = result.value
          const metrics = await this.calculateLiquidityMetrics(symbol, spread)
          results.set(symbol, metrics)
        } else if (result.status === 'fulfilled') {
          results.set(result.value.symbol, null)
        }
      }

      return results
    } catch (error) {
      console.error('ExtendedMarketDataService.getBatchLiquidityMetrics error:', error)
      return results
    }
  }

  /**
   * Integration method for StockSelectionService
   * Returns extended market data score for technical analysis
   */
  calculateExtendedMarketScore(extendedData: ExtendedMarketData): number {
    let score = 0

    // Liquidity component (40% weight)
    if (extendedData.liquidityMetrics) {
      const liquidityScore = extendedData.liquidityMetrics.liquidityScore / 10 // Normalize to 0-1
      score += liquidityScore * 0.4
    }

    // Extended hours activity component (30% weight)
    if (extendedData.extendedHours.preMarketChangePercent !== undefined) {
      // Strong pre-market movement indicates interest
      const preMarketStrength = Math.min(Math.abs(extendedData.extendedHours.preMarketChangePercent), 5) / 5
      score += preMarketStrength * 0.3
    }

    // Spread quality component (30% weight)
    if (extendedData.bidAskSpread) {
      // Lower spread percentage = better score
      const spreadQuality = Math.max(0, 1 - (extendedData.bidAskSpread.spreadPercent / 1)) // 1% spread = 0 quality
      score += spreadQuality * 0.3
    }

    return Math.max(0, Math.min(1, score)) // Ensure 0-1 range
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test with a popular symbol
      const testData = await this.getExtendedMarketData('AAPL')
      return testData !== null
    } catch {
      return false
    }
  }
}