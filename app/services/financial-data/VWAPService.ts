/**
 * VWAP Analysis Service
 * Provides Volume Weighted Average Price calculations and analysis
 * Integrates with PolygonAPI for real-time VWAP data
 */

import { PolygonAPI } from './PolygonAPI'
import { VWAPData, VWAPAnalysis, StockData } from './types'
import { RedisCache } from '../cache/RedisCache'

export class VWAPService {
  private polygonAPI: PolygonAPI
  private cache: RedisCache
  private readonly CACHE_TTL = 60 // 1 minute for VWAP data

  constructor(polygonAPI: PolygonAPI, cache: RedisCache) {
    this.polygonAPI = polygonAPI
    this.cache = cache
  }

  /**
   * Get comprehensive VWAP analysis for a symbol
   */
  async getVWAPAnalysis(symbol: string): Promise<VWAPAnalysis | null> {
    try {
      const cacheKey = `vwap_analysis:${symbol.toUpperCase()}`

      // Check cache first
      const cached = await this.cache.get<VWAPAnalysis>(cacheKey)
      if (cached) {
        return cached
      }

      // Get current price and VWAP data
      const [stockData, vwapData] = await Promise.allSettled([
        this.polygonAPI.getStockPrice(symbol),
        this.polygonAPI.getVWAP(symbol)
      ])

      if (stockData.status === 'rejected' || vwapData.status === 'rejected' ||
          !stockData.value || !vwapData.value) {
        return null
      }

      const currentPrice = stockData.value.price
      const vwap = vwapData.value.vwap
      const deviation = currentPrice - vwap
      const deviationPercent = (deviation / vwap) * 100

      const analysis: VWAPAnalysis = {
        symbol: symbol.toUpperCase(),
        currentPrice,
        vwap,
        deviation,
        deviationPercent,
        signal: this.determineSignal(deviationPercent),
        strength: this.determineStrength(Math.abs(deviationPercent)),
        timestamp: Date.now()
      }

      // Cache the result
      await this.cache.set(cacheKey, analysis, this.CACHE_TTL)

      return analysis
    } catch (error) {
      console.error(`VWAPService.getVWAPAnalysis error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Determine VWAP signal based on price deviation
   */
  private determineSignal(deviationPercent: number): 'above' | 'below' | 'at' {
    if (Math.abs(deviationPercent) < 0.1) return 'at'
    return deviationPercent > 0 ? 'above' : 'below'
  }

  /**
   * Determine signal strength based on deviation magnitude
   */
  private determineStrength(absDeviationPercent: number): 'weak' | 'moderate' | 'strong' {
    if (absDeviationPercent < 0.5) return 'weak'
    if (absDeviationPercent < 2.0) return 'moderate'
    return 'strong'
  }

  /**
   * Get multiple timeframe VWAP data
   */
  async getMultiTimeframeVWAP(symbol: string): Promise<{
    minute: VWAPData | null,
    hour: VWAPData | null,
    day: VWAPData | null
  }> {
    const [minute, hour, day] = await Promise.allSettled([
      this.polygonAPI.getVWAP(symbol, 'minute'),
      this.polygonAPI.getVWAP(symbol, 'hour'),
      this.polygonAPI.getVWAP(symbol, 'day')
    ])

    return {
      minute: minute.status === 'fulfilled' ? minute.value : null,
      hour: hour.status === 'fulfilled' ? hour.value : null,
      day: day.status === 'fulfilled' ? day.value : null
    }
  }

  /**
   * Calculate VWAP-based technical score
   * Returns a score between -1 and 1 for integration into technical analysis
   */
  calculateVWAPScore(vwapAnalysis: VWAPAnalysis): number {
    let score = 0

    if (vwapAnalysis.signal === 'above') {
      // Price above VWAP is generally bullish
      score = vwapAnalysis.strength === 'strong' ? 1.0 :
              vwapAnalysis.strength === 'moderate' ? 0.6 : 0.3
    } else if (vwapAnalysis.signal === 'below') {
      // Price below VWAP is generally bearish
      score = vwapAnalysis.strength === 'strong' ? -1.0 :
              vwapAnalysis.strength === 'moderate' ? -0.6 : -0.3
    }

    return score
  }

  /**
   * Get VWAP deviation percentage for quick reference
   */
  async getVWAPDeviation(symbol: string): Promise<number | null> {
    try {
      const analysis = await this.getVWAPAnalysis(symbol)
      return analysis ? analysis.deviationPercent : null
    } catch (error) {
      console.error(`VWAPService.getVWAPDeviation error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Check if current price is significantly above/below VWAP
   */
  async isVWAPSignificant(symbol: string, threshold: number = 1.0): Promise<{
    isSignificant: boolean,
    direction: 'above' | 'below' | 'neutral',
    magnitude: number
  } | null> {
    try {
      const analysis = await this.getVWAPAnalysis(symbol)
      if (!analysis) return null

      const isSignificant = Math.abs(analysis.deviationPercent) >= threshold
      const direction = analysis.deviationPercent > threshold ? 'above' :
                       analysis.deviationPercent < -threshold ? 'below' : 'neutral'

      return {
        isSignificant,
        direction,
        magnitude: Math.abs(analysis.deviationPercent)
      }
    } catch (error) {
      console.error(`VWAPService.isVWAPSignificant error for ${symbol}:`, error)
      return null
    }
  }
}