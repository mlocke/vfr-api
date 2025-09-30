/**
 * VWAP Analysis Service
 * Provides Volume Weighted Average Price calculations and analysis
 * Uses FMP API for historical data and calculates VWAP internally
 */

import { FinancialModelingPrepAPI } from './FinancialModelingPrepAPI'
import { VWAPData, VWAPAnalysis, StockData, HistoricalVWAP, VWAPTrendAnalysis, VWAPTrendInsights } from './types'
import { RedisCache } from '../cache/RedisCache'

export class VWAPService {
  private fmpAPI: FinancialModelingPrepAPI
  private cache: RedisCache
  private readonly CACHE_TTL = 60 // 1 minute for VWAP data

  constructor(fmpAPI: FinancialModelingPrepAPI, cache: RedisCache) {
    this.fmpAPI = fmpAPI
    this.cache = cache
  }

  /**
   * Get comprehensive VWAP analysis for a symbol
   * Calculates VWAP from FMP historical data
   */
  async getVWAPAnalysis(symbol: string): Promise<VWAPAnalysis | null> {
    try {
      const cacheKey = `vwap_analysis:${symbol.toUpperCase()}`

      // Check cache first
      const cached = await this.cache.get<VWAPAnalysis>(cacheKey)
      if (cached) {
        return cached
      }

      // Get current price and calculate VWAP from historical data
      const [stockData, historicalData] = await Promise.all([
        this.fmpAPI.getStockPrice(symbol),
        this.fmpAPI.getHistoricalData(symbol, 1) // Get today's data for VWAP calculation
      ])

      if (!stockData || !historicalData || historicalData.length === 0) {
        return null
      }

      const currentPrice = stockData.price
      const todayData = historicalData[0]

      // Calculate VWAP using typical price (H+L+C)/3
      const vwap = (todayData.high + todayData.low + todayData.close) / 3

      const deviation = currentPrice - vwap
      const deviationPercent = (deviation / vwap) * 100

      const analysis: VWAPAnalysis = {
        symbol: symbol.toUpperCase(),
        currentPrice,
        vwap: Number(vwap.toFixed(2)),
        deviation: Number(deviation.toFixed(2)),
        deviationPercent: Number(deviationPercent.toFixed(2)),
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
   * Uses calculated VWAP from FMP historical data
   */
  async getMultiTimeframeVWAP(symbol: string): Promise<{
    minute: VWAPData | null,
    hour: VWAPData | null,
    day: VWAPData | null
  }> {
    // FMP provides daily data, so we calculate daily VWAP
    const dayAnalysis = await this.getVWAPAnalysis(symbol)

    const dayData: VWAPData | null = dayAnalysis ? {
      symbol: dayAnalysis.symbol,
      vwap: dayAnalysis.vwap,
      volume: 0, // Volume not used in analysis
      timestamp: dayAnalysis.timestamp,
      timespan: 'day',
      source: 'fmp'
    } : null

    return {
      minute: null, // Intraday not available with FMP basic plan
      hour: null,   // Intraday not available with FMP basic plan
      day: dayData
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

  /**
   * Get historical VWAP data for trend analysis
   */
  async getHistoricalVWAP(symbol: string, days: number = 30): Promise<HistoricalVWAP[]> {
    try {
      const cacheKey = `historical_vwap:${symbol.toUpperCase()}:${days}`

      // Check cache first (longer TTL for historical data)
      const cached = await this.cache.get<HistoricalVWAP[]>(cacheKey)
      if (cached) {
        return cached
      }

      const upperSymbol = symbol.toUpperCase()

      // Use FMP for historical data (has working getHistoricalData method)
      const historicalMarketData = await this.fmpAPI.getHistoricalData(upperSymbol, days)

      if (!historicalMarketData || historicalMarketData.length === 0) {
        return []
      }

      const historicalData: HistoricalVWAP[] = []

      for (const marketData of historicalMarketData) {
        if (marketData.volume && marketData.volume > 0) {
          // Calculate VWAP using typical price (approximation for daily data)
          const typicalPrice = (marketData.high + marketData.low + marketData.close) / 3
          const vwap = typicalPrice // For daily data, typical price approximates VWAP
          const currentPrice = marketData.close
          const deviation = currentPrice - vwap
          const deviationPercent = (deviation / vwap) * 100

          historicalData.push({
            symbol: upperSymbol,
            date: new Date(marketData.timestamp).toISOString().split('T')[0],
            vwap: Number(vwap.toFixed(2)),
            currentPrice: Number(currentPrice.toFixed(2)),
            deviation: Number(deviation.toFixed(2)),
            deviationPercent: Number(deviationPercent.toFixed(2)),
            volume: marketData.volume,
            timestamp: marketData.timestamp
          })
        }
      }

      // Sort by timestamp ascending (oldest first)
      historicalData.sort((a, b) => a.timestamp - b.timestamp)

      // Cache for 4 hours (historical data changes less frequently)
      await this.cache.set(cacheKey, historicalData, 240)

      return historicalData
    } catch (error) {
      console.error(`VWAPService.getHistoricalVWAP error for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Analyze VWAP trend over specified timeframe
   */
  async analyzeVWAPTrend(symbol: string, timeframe: '1D' | '5D' | '1M' | '3M'): Promise<VWAPTrendAnalysis | null> {
    try {
      const days = this.getTimeframeDays(timeframe)
      const historicalData = await this.getHistoricalVWAP(symbol, days)

      if (historicalData.length < 3) {
        return null // Need at least 3 data points for trend analysis
      }

      const trendDirection = this.calculateTrendDirection(historicalData)
      const trendStrength = this.calculateTrendStrength(historicalData, trendDirection)
      const trendScore = this.calculateTrendScore(trendDirection, trendStrength)
      const averageDeviation = this.calculateAverageDeviation(historicalData)
      const volatility = this.calculateVolatility(historicalData)
      const momentum = this.calculateMomentum(historicalData)
      const confidence = this.calculateTrendConfidence(historicalData, trendDirection, trendStrength)

      return {
        symbol: symbol.toUpperCase(),
        timeframe,
        trendDirection,
        trendStrength,
        trendScore,
        averageDeviation,
        volatility,
        momentum,
        historicalData,
        confidence,
        timestamp: Date.now(),
        source: 'vwap-service'
      }
    } catch (error) {
      console.error(`VWAPService.analyzeVWAPTrend error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get comprehensive VWAP trend insights across multiple timeframes
   */
  async getVWAPTrendInsights(symbol: string): Promise<VWAPTrendInsights | null> {
    try {
      const cacheKey = `vwap_trend_insights:${symbol.toUpperCase()}`

      // Check cache first
      const cached = await this.cache.get<VWAPTrendInsights>(cacheKey)
      if (cached) {
        return cached
      }

      // Get multi-timeframe analysis
      const [oneDay, fiveDay, oneMonth] = await Promise.allSettled([
        this.analyzeVWAPTrend(symbol, '1D'),
        this.analyzeVWAPTrend(symbol, '5D'),
        this.analyzeVWAPTrend(symbol, '1M')
      ])

      const oneDayTrend = oneDay.status === 'fulfilled' ? oneDay.value : null
      const fiveDayTrend = fiveDay.status === 'fulfilled' ? fiveDay.value : null
      const oneMonthTrend = oneMonth.status === 'fulfilled' ? oneMonth.value : null

      // Use the most reliable trend (5-day) as current trend, fallback to others
      const currentTrend = fiveDayTrend || oneMonthTrend || oneDayTrend
      if (!currentTrend) {
        return null
      }

      const trendConvergence = this.determineTrendConvergence(oneDayTrend, fiveDayTrend, oneMonthTrend)
      const trendScore = this.calculateCombinedTrendScore(oneDayTrend, fiveDayTrend, oneMonthTrend)
      const keyInsights = this.generateTrendInsights(oneDayTrend, fiveDayTrend, oneMonthTrend, trendConvergence)
      const tradingSignals = this.generateTradingSignals(oneDayTrend, fiveDayTrend, oneMonthTrend)

      const insights: VWAPTrendInsights = {
        symbol: symbol.toUpperCase(),
        currentTrend,
        multiTimeframeTrends: {
          oneDay: oneDayTrend,
          fiveDay: fiveDayTrend,
          oneMonth: oneMonthTrend
        },
        trendConvergence,
        trendScore,
        keyInsights,
        tradingSignals,
        timestamp: Date.now()
      }

      // Cache for 30 minutes
      await this.cache.set(cacheKey, insights, 30)

      return insights
    } catch (error) {
      console.error(`VWAPService.getVWAPTrendInsights error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate VWAP trend score for integration with AlgorithmEngine
   * Returns a score between -1 and 1 based on multi-timeframe VWAP trends
   */
  async calculateVWAPTrendScore(symbol: string): Promise<number | null> {
    try {
      const insights = await this.getVWAPTrendInsights(symbol)
      if (!insights) return null

      return insights.trendScore
    } catch (error) {
      console.error(`VWAPService.calculateVWAPTrendScore error for ${symbol}:`, error)
      return null
    }
  }

  // Private helper methods for trend analysis

  private getTimeframeDays(timeframe: '1D' | '5D' | '1M' | '3M'): number {
    switch (timeframe) {
      case '1D': return 2 // Get 2 days to calculate 1-day trend
      case '5D': return 7 // Get 7 days to account for weekends
      case '1M': return 30
      case '3M': return 90
      default: return 30
    }
  }

  private calculateTrendDirection(data: HistoricalVWAP[]): 'uptrend' | 'downtrend' | 'sideways' {
    if (data.length < 3) return 'sideways'

    // Calculate linear regression slope of VWAP deviation percentages
    const x = data.map((_, i) => i)
    const y = data.map(d => d.deviationPercent)

    const n = data.length
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    if (Math.abs(slope) < 0.1) return 'sideways'
    return slope > 0 ? 'uptrend' : 'downtrend'
  }

  private calculateTrendStrength(data: HistoricalVWAP[], direction: 'uptrend' | 'downtrend' | 'sideways'): 'weak' | 'moderate' | 'strong' {
    if (direction === 'sideways') return 'weak'

    const deviations = data.map(d => Math.abs(d.deviationPercent))
    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length

    if (avgDeviation < 0.5) return 'weak'
    if (avgDeviation < 2.0) return 'moderate'
    return 'strong'
  }

  private calculateTrendScore(direction: 'uptrend' | 'downtrend' | 'sideways', strength: 'weak' | 'moderate' | 'strong'): number {
    const directionMultiplier = direction === 'uptrend' ? 1 : direction === 'downtrend' ? -1 : 0
    const strengthValue = strength === 'strong' ? 1.0 : strength === 'moderate' ? 0.6 : 0.3

    return directionMultiplier * strengthValue
  }

  private calculateAverageDeviation(data: HistoricalVWAP[]): number {
    const deviations = data.map(d => Math.abs(d.deviationPercent))
    return deviations.reduce((a, b) => a + b, 0) / deviations.length
  }

  private calculateVolatility(data: HistoricalVWAP[]): number {
    const deviations = data.map(d => d.deviationPercent)
    const mean = deviations.reduce((a, b) => a + b, 0) / deviations.length
    const variance = deviations.reduce((sum, dev) => sum + Math.pow(dev - mean, 2), 0) / deviations.length
    return Math.sqrt(variance)
  }

  private calculateMomentum(data: HistoricalVWAP[]): number {
    if (data.length < 3) return 0

    // Calculate momentum as rate of change in recent vs earlier periods
    const recent = data.slice(-Math.floor(data.length / 3))
    const earlier = data.slice(0, Math.floor(data.length / 3))

    const recentAvg = recent.reduce((sum, d) => sum + d.deviationPercent, 0) / recent.length
    const earlierAvg = earlier.reduce((sum, d) => sum + d.deviationPercent, 0) / earlier.length

    return recentAvg - earlierAvg
  }

  private calculateTrendConfidence(data: HistoricalVWAP[], direction: 'uptrend' | 'downtrend' | 'sideways', strength: 'weak' | 'moderate' | 'strong'): number {
    let confidence = 0.5 // Base confidence

    // Increase confidence with more data points
    confidence += Math.min(data.length / 30, 0.3)

    // Increase confidence for stronger trends
    if (strength === 'strong') confidence += 0.2
    else if (strength === 'moderate') confidence += 0.1

    // Decrease confidence for sideways trends
    if (direction === 'sideways') confidence -= 0.2

    return Math.max(0, Math.min(1, confidence))
  }

  private determineTrendConvergence(
    oneDay: VWAPTrendAnalysis | null,
    fiveDay: VWAPTrendAnalysis | null,
    oneMonth: VWAPTrendAnalysis | null
  ): 'bullish' | 'bearish' | 'mixed' | 'neutral' {
    const trends = [oneDay, fiveDay, oneMonth].filter(t => t !== null)
    if (trends.length === 0) return 'neutral'

    const uptrends = trends.filter(t => t!.trendDirection === 'uptrend').length
    const downtrends = trends.filter(t => t!.trendDirection === 'downtrend').length

    if (uptrends === trends.length) return 'bullish'
    if (downtrends === trends.length) return 'bearish'
    if (uptrends > downtrends) return 'bullish'
    if (downtrends > uptrends) return 'bearish'
    return 'mixed'
  }

  private calculateCombinedTrendScore(
    oneDay: VWAPTrendAnalysis | null,
    fiveDay: VWAPTrendAnalysis | null,
    oneMonth: VWAPTrendAnalysis | null
  ): number {
    const trends = [
      { trend: oneDay, weight: 0.2 },
      { trend: fiveDay, weight: 0.5 },
      { trend: oneMonth, weight: 0.3 }
    ].filter(t => t.trend !== null)

    if (trends.length === 0) return 0

    const weightedSum = trends.reduce((sum, { trend, weight }) =>
      sum + (trend!.trendScore * weight), 0)
    const totalWeight = trends.reduce((sum, { weight }) => sum + weight, 0)

    return weightedSum / totalWeight
  }

  private generateTrendInsights(
    oneDay: VWAPTrendAnalysis | null,
    fiveDay: VWAPTrendAnalysis | null,
    oneMonth: VWAPTrendAnalysis | null,
    convergence: 'bullish' | 'bearish' | 'mixed' | 'neutral'
  ): string[] {
    const insights: string[] = []

    if (fiveDay) {
      insights.push(`5-day VWAP trend shows ${fiveDay.trendDirection} with ${fiveDay.trendStrength} strength`)
    }

    if (convergence === 'bullish') {
      insights.push('Multiple timeframes show bullish VWAP convergence')
    } else if (convergence === 'bearish') {
      insights.push('Multiple timeframes show bearish VWAP convergence')
    } else if (convergence === 'mixed') {
      insights.push('Mixed signals across different VWAP timeframes')
    }

    if (oneMonth && Math.abs(oneMonth.momentum) > 1.0) {
      insights.push(`Strong momentum detected in monthly VWAP trend (${oneMonth.momentum.toFixed(2)}%)`)
    }

    return insights
  }

  private generateTradingSignals(
    oneDay: VWAPTrendAnalysis | null,
    fiveDay: VWAPTrendAnalysis | null,
    oneMonth: VWAPTrendAnalysis | null
  ): Array<{ signal: 'BUY' | 'SELL' | 'HOLD', timeframe: string, reasoning: string, confidence: number }> {
    const signals: Array<{ signal: 'BUY' | 'SELL' | 'HOLD', timeframe: string, reasoning: string, confidence: number }> = []

    if (fiveDay) {
      let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
      let reasoning = ''

      if (fiveDay.trendDirection === 'uptrend' && fiveDay.trendStrength !== 'weak') {
        signal = 'BUY'
        reasoning = `Strong 5-day uptrend with ${fiveDay.trendStrength} strength`
      } else if (fiveDay.trendDirection === 'downtrend' && fiveDay.trendStrength !== 'weak') {
        signal = 'SELL'
        reasoning = `Strong 5-day downtrend with ${fiveDay.trendStrength} strength`
      } else {
        reasoning = 'No clear trend signal'
      }

      signals.push({
        signal,
        timeframe: '5D',
        reasoning,
        confidence: fiveDay.confidence
      })
    }

    if (oneMonth && fiveDay) {
      const convergence = oneMonth.trendDirection === fiveDay.trendDirection
      if (convergence && oneMonth.trendDirection === 'uptrend') {
        signals.push({
          signal: 'BUY',
          timeframe: 'Multi-timeframe',
          reasoning: 'Strong convergence of 5-day and monthly uptrends',
          confidence: Math.min(oneMonth.confidence, fiveDay.confidence)
        })
      } else if (convergence && oneMonth.trendDirection === 'downtrend') {
        signals.push({
          signal: 'SELL',
          timeframe: 'Multi-timeframe',
          reasoning: 'Strong convergence of 5-day and monthly downtrends',
          confidence: Math.min(oneMonth.confidence, fiveDay.confidence)
        })
      }
    }

    return signals
  }
}