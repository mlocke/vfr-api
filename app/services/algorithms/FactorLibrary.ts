/**
 * Factor Library for Dynamic Stock Selection Algorithms
 * Provides configurable factor calculations with caching and data quality integration
 */

import { FactorCalculator } from './types'
import { TechnicalIndicatorService } from '../technical-analysis/TechnicalIndicatorService'
import { TechnicalAnalysisResult, OHLCData } from '../technical-analysis/types'

interface MarketDataPoint {
  symbol: string
  price: number
  volume: number
  marketCap: number
  sector: string
  exchange: string
  timestamp: number
}

interface FundamentalDataPoint {
  symbol: string
  peRatio?: number
  pbRatio?: number
  debtToEquity?: number
  roe?: number
  revenueGrowth?: number
  [key: string]: any
}

interface TechnicalDataPoint {
  symbol: string
  rsi?: number
  macd?: { signal: number; histogram: number; macd: number }
  sma?: { [period: string]: number }
  volatility?: number
  [key: string]: any
}

interface HistoricalPrice {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export class FactorLibrary {
  private factorCache = new Map<string, { value: number; timestamp: number }>()
  private historicalDataCache = new Map<string, HistoricalPrice[]>()
  private technicalService?: TechnicalIndicatorService

  /**
   * Initialize with optional technical indicator service
   */
  constructor(technicalService?: TechnicalIndicatorService) {
    this.technicalService = technicalService
  }

  /**
   * Core factor calculation method
   */
  async calculateFactor(
    factorName: string,
    symbol: string,
    marketData: MarketDataPoint,
    fundamentalData?: FundamentalDataPoint,
    technicalData?: TechnicalDataPoint
  ): Promise<number | null> {
    // Check cache first
    const cacheKey = `${factorName}_${symbol}_${Math.floor(Date.now() / 60000)}` // 1-minute cache buckets
    const cached = this.factorCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 300000) { // 5-minute cache TTL
      return cached.value
    }

    let result: number | null = null

    try {
      switch (factorName) {
        // ==================== MOMENTUM FACTORS ====================
        case 'momentum_1m':
          result = await this.calculateMomentum(symbol, 21) // ~1 month
          break
        case 'momentum_3m':
          result = await this.calculateMomentum(symbol, 63) // ~3 months
          break
        case 'momentum_6m':
          result = await this.calculateMomentum(symbol, 126) // ~6 months
          break
        case 'momentum_12m':
          result = await this.calculateMomentum(symbol, 252) // ~12 months
          break

        // ==================== MEAN REVERSION FACTORS ====================
        case 'price_reversion_20d':
          result = await this.calculatePriceReversion(symbol, marketData, 20)
          break
        case 'price_reversion_50d':
          result = await this.calculatePriceReversion(symbol, marketData, 50)
          break
        case 'volume_reversion':
          result = await this.calculateVolumeReversion(symbol, marketData)
          break

        // ==================== VALUE FACTORS ====================
        case 'pe_ratio':
          result = this.calculatePEScore(fundamentalData?.peRatio)
          break
        case 'pb_ratio':
          result = this.calculatePBScore(fundamentalData?.pbRatio)
          break
        case 'ev_ebitda':
          result = this.calculateEVEBITDAScore(fundamentalData)
          break
        case 'price_to_sales':
          result = this.calculatePriceToSalesScore(fundamentalData, marketData)
          break

        // ==================== QUALITY FACTORS ====================
        case 'roe':
          result = this.calculateROEScore(fundamentalData?.roe)
          break
        case 'debt_equity':
          result = this.calculateDebtEquityScore(fundamentalData?.debtToEquity)
          break
        case 'current_ratio':
          result = this.calculateCurrentRatioScore(fundamentalData)
          break
        case 'interest_coverage':
          result = this.calculateInterestCoverageScore(fundamentalData)
          break

        // ==================== GROWTH FACTORS ====================
        case 'revenue_growth':
          result = this.calculateRevenueGrowthScore(fundamentalData?.revenueGrowth)
          break
        case 'earnings_growth':
          result = this.calculateEarningsGrowthScore(fundamentalData)
          break
        case 'revenue_acceleration':
          result = this.calculateRevenueAccelerationScore(fundamentalData)
          break

        // ==================== TECHNICAL FACTORS ====================
        case 'rsi_14d':
          result = this.calculateRSIScore(technicalData?.rsi)
          break
        case 'macd_signal':
          result = this.calculateMACDScore(technicalData?.macd)
          break
        case 'bollinger_position':
          result = await this.calculateBollingerPosition(symbol, marketData)
          break

        // ==================== ENHANCED TECHNICAL FACTORS ====================
        // Trend factors
        case 'sma_alignment':
          result = await this.calculateSMAAlignment(symbol)
          break
        case 'ema_trend':
          result = await this.calculateEMATrend(symbol)
          break
        case 'macd_histogram':
          result = await this.calculateMACDHistogram(symbol)
          break
        case 'bollinger_squeeze':
          result = await this.calculateBollingerSqueeze(symbol)
          break

        // Advanced momentum factors
        case 'stochastic_signal':
          result = await this.calculateStochasticSignal(symbol)
          break
        case 'williams_r':
          result = await this.calculateWilliamsR(symbol)
          break
        case 'roc_momentum':
          result = await this.calculateROCMomentum(symbol)
          break
        case 'momentum_convergence':
          result = await this.calculateMomentumConvergence(symbol)
          break

        // Volume factors
        case 'obv_trend':
          result = await this.calculateOBVTrend(symbol)
          break
        case 'vwap_position':
          result = await this.calculateVWAPPosition(symbol)
          break
        case 'volume_confirmation':
          result = await this.calculateVolumeConfirmation(symbol)
          break

        // Volatility factors
        case 'atr_volatility':
          result = await this.calculateATRVolatility(symbol)
          break
        case 'volatility_breakout':
          result = await this.calculateVolatilityBreakout(symbol)
          break

        // Pattern factors
        case 'candlestick_patterns':
          result = await this.calculateCandlestickPatterns(symbol)
          break
        case 'chart_patterns':
          result = await this.calculateChartPatterns(symbol)
          break
        case 'support_resistance':
          result = await this.calculateSupportResistance(symbol)
          break

        // Composite technical factors
        case 'technical_momentum_composite':
          result = await this.calculateTechnicalMomentumComposite(symbol)
          break
        case 'technical_trend_composite':
          result = await this.calculateTechnicalTrendComposite(symbol)
          break
        case 'technical_overall_score':
          result = await this.calculateTechnicalOverallScore(symbol)
          break

        // ==================== VOLATILITY FACTORS ====================
        case 'volatility_30d':
          result = await this.calculateVolatilityScore(symbol, 30)
          break
        case 'volatility_ratio':
          result = await this.calculateVolatilityRatio(symbol)
          break
        case 'beta':
          result = await this.calculateBetaScore(symbol)
          break

        // ==================== DIVIDEND FACTORS ====================
        case 'dividend_yield':
          result = this.calculateDividendYieldScore(fundamentalData)
          break
        case 'dividend_growth':
          result = this.calculateDividendGrowthScore(fundamentalData)
          break
        case 'payout_ratio':
          result = this.calculatePayoutRatioScore(fundamentalData)
          break

        // ==================== COMPOSITE FACTORS ====================
        case 'quality_composite':
          result = this.calculateQualityComposite(fundamentalData)
          break
        case 'momentum_composite':
          result = await this.calculateMomentumComposite(symbol, marketData, technicalData)
          break
        case 'value_composite':
          result = this.calculateValueComposite(fundamentalData, marketData)
          break

        default:
          console.warn(`Unknown factor: ${factorName}`)
          return null
      }

      // Cache result if valid
      if (result !== null && !isNaN(result)) {
        this.factorCache.set(cacheKey, { value: result, timestamp: Date.now() })
      }

      return result

    } catch (error) {
      console.error(`Error calculating factor ${factorName} for ${symbol}:`, error)
      return null
    }
  }

  // ==================== MOMENTUM CALCULATIONS ====================

  private async calculateMomentum(symbol: string, periods: number): Promise<number | null> {
    const historicalData = await this.getHistoricalData(symbol, periods + 1)
    if (!historicalData || historicalData.length < periods + 1) {
      return null
    }

    const currentPrice = historicalData[0].close
    const pastPrice = historicalData[periods].close

    if (pastPrice <= 0) return null

    const momentum = (currentPrice - pastPrice) / pastPrice

    // Normalize momentum to 0-1 scale (sigmoid transformation)
    return 1 / (1 + Math.exp(-momentum * 5))
  }

  private async calculatePriceReversion(
    symbol: string,
    marketData: MarketDataPoint,
    periods: number
  ): Promise<number | null> {
    const historicalData = await this.getHistoricalData(symbol, periods)
    if (!historicalData || historicalData.length < periods) {
      return null
    }

    // Calculate moving average
    const ma = historicalData.slice(0, periods)
      .reduce((sum, data) => sum + data.close, 0) / periods

    // Calculate how far current price is from MA (inverted for reversion)
    const deviation = (marketData.price - ma) / ma

    // Return higher score when price is below MA (reversion opportunity)
    return 1 / (1 + Math.exp(deviation * 5))
  }

  // ==================== ENHANCED TECHNICAL CALCULATIONS ====================

  /**
   * Calculate SMA alignment score - higher when shorter SMA > longer SMA
   */
  private async calculateSMAAlignment(symbol: string): Promise<number | null> {
    if (!this.technicalService) {
      console.warn('Technical service not available for SMA alignment calculation')
      return null
    }

    try {
      const historicalData = await this.getHistoricalData(symbol, 250)
      if (!historicalData || historicalData.length < 50) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const smaResults = technicalResult.trend.indicators.sma
      if (smaResults.length < 2) return 0.5

      // Find short and long SMAs
      const shortSMA = smaResults.find(s => s.period === 20)
      const longSMA = smaResults.find(s => s.period === 50)

      if (!shortSMA || !longSMA) return 0.5

      // Higher score when short SMA > long SMA (bullish alignment)
      const alignmentRatio = shortSMA.value / longSMA.value
      return Math.max(0, Math.min(1, (alignmentRatio - 0.95) / 0.1))

    } catch (error) {
      console.error(`Error calculating SMA alignment for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate EMA trend strength
   */
  private async calculateEMATrend(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 100)
      if (!historicalData || historicalData.length < 26) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      return technicalResult.trend.strength

    } catch (error) {
      console.error(`Error calculating EMA trend for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate MACD histogram strength
   */
  private async calculateMACDHistogram(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 100)
      if (!historicalData || historicalData.length < 26) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const macdResult = technicalResult.trend.indicators.macd

      // Normalize histogram value to 0-1 scale
      const normalizedHistogram = Math.max(0, Math.min(1, (macdResult.histogram + 1) / 2))
      return normalizedHistogram

    } catch (error) {
      console.error(`Error calculating MACD histogram for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate Bollinger Band squeeze (low volatility)
   */
  private async calculateBollingerSqueeze(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 100)
      if (!historicalData || historicalData.length < 20) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const bollinger = technicalResult.trend.indicators.bollinger
      const currentPrice = ohlcData[ohlcData.length - 1].close

      // Calculate band width as percentage of middle band
      const bandWidth = bollinger.width / bollinger.middle

      // Lower band width indicates squeeze (higher opportunity score)
      return Math.max(0, Math.min(1, 1 - (bandWidth * 20)))

    } catch (error) {
      console.error(`Error calculating Bollinger squeeze for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate Stochastic signal strength
   */
  private async calculateStochasticSignal(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 50)
      if (!historicalData || historicalData.length < 14) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const stochastic = technicalResult.momentum.indicators.stochastic

      // Calculate signal strength based on oversold/overbought conditions
      if (stochastic.signal === 'oversold') return 0.8
      if (stochastic.signal === 'overbought') return 0.2

      // Neutral zone scoring
      return 0.5

    } catch (error) {
      console.error(`Error calculating Stochastic signal for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate Williams %R signal
   */
  private async calculateWilliamsR(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 50)
      if (!historicalData || historicalData.length < 14) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const williams = technicalResult.momentum.indicators.williams

      // Convert Williams %R to 0-1 scale (inverted since Williams %R is negative)
      return Math.max(0, Math.min(1, (williams.value + 100) / 100))

    } catch (error) {
      console.error(`Error calculating Williams %R for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate ROC momentum strength
   */
  private async calculateROCMomentum(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 50)
      if (!historicalData || historicalData.length < 10) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const roc = technicalResult.momentum.indicators.roc

      // Normalize ROC to 0-1 scale (sigmoid transformation)
      return 1 / (1 + Math.exp(-roc.value / 5))

    } catch (error) {
      console.error(`Error calculating ROC momentum for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate momentum convergence across multiple indicators
   */
  private async calculateMomentumConvergence(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 100)
      if (!historicalData || historicalData.length < 26) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const momentum = technicalResult.momentum

      // Check for convergence in momentum signals
      let convergenceScore = 0
      let signals = 0

      // RSI signal
      if (momentum.indicators.rsi.signal !== 'neutral') {
        signals++
        convergenceScore += momentum.indicators.rsi.signal === 'oversold' ? 1 : 0
      }

      // Stochastic signal
      if (momentum.indicators.stochastic.signal !== 'neutral') {
        signals++
        convergenceScore += momentum.indicators.stochastic.signal === 'oversold' ? 1 : 0
      }

      // Williams %R signal
      if (momentum.indicators.williams.signal !== 'neutral') {
        signals++
        convergenceScore += momentum.indicators.williams.signal === 'oversold' ? 1 : 0
      }

      return signals > 0 ? convergenceScore / signals : 0.5

    } catch (error) {
      console.error(`Error calculating momentum convergence for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate OBV trend strength
   */
  private async calculateOBVTrend(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 50)
      if (!historicalData || historicalData.length < 20) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const obv = technicalResult.volume.indicators.obv

      // Convert trend to numeric score
      if (obv.trend === 'rising') return 0.8
      if (obv.trend === 'falling') return 0.2
      return 0.5

    } catch (error) {
      console.error(`Error calculating OBV trend for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate VWAP position score
   */
  private async calculateVWAPPosition(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 50)
      if (!historicalData || historicalData.length < 20) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const vwap = technicalResult.volume.indicators.vwap

      // Convert position to numeric score
      if (vwap.position === 'above') return 0.7
      if (vwap.position === 'below') return 0.3
      return 0.5

    } catch (error) {
      console.error(`Error calculating VWAP position for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate volume confirmation score
   */
  private async calculateVolumeConfirmation(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 50)
      if (!historicalData || historicalData.length < 20) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      return technicalResult.volume.confirmation ? 0.8 : 0.2

    } catch (error) {
      console.error(`Error calculating volume confirmation for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate ATR-based volatility score
   */
  private async calculateATRVolatility(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 50)
      if (!historicalData || historicalData.length < 14) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const atr = technicalResult.volatility.indicators.atr
      const currentPrice = ohlcData[ohlcData.length - 1].close

      // Calculate ATR as percentage of price
      const atrPercent = atr.value / currentPrice

      // Lower volatility gets higher score for quality strategies
      return Math.max(0, Math.min(1, 1 - (atrPercent * 10)))

    } catch (error) {
      console.error(`Error calculating ATR volatility for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate volatility breakout potential
   */
  private async calculateVolatilityBreakout(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 100)
      if (!historicalData || historicalData.length < 20) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      // Low volatility followed by volume increase suggests breakout potential
      const volatilityLevel = technicalResult.volatility.level
      const volumeTrend = technicalResult.volume.trend

      if (volatilityLevel === 'low' && volumeTrend === 'increasing') return 0.8
      if (volatilityLevel === 'medium' && volumeTrend === 'increasing') return 0.6
      return 0.3

    } catch (error) {
      console.error(`Error calculating volatility breakout for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate candlestick patterns score
   */
  private async calculateCandlestickPatterns(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 50)
      if (!historicalData || historicalData.length < 10) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const patterns = technicalResult.patterns.candlestick

      if (patterns.length === 0) return 0.5

      // Calculate average pattern strength, weighted by bullish/bearish direction
      let totalScore = 0
      patterns.forEach(pattern => {
        let score = pattern.strength
        if (pattern.direction === 'bullish') score *= 1.2
        if (pattern.direction === 'bearish') score *= 0.8
        totalScore += score
      })

      return Math.max(0, Math.min(1, totalScore / patterns.length))

    } catch (error) {
      console.error(`Error calculating candlestick patterns for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate chart patterns score
   */
  private async calculateChartPatterns(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 100)
      if (!historicalData || historicalData.length < 50) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      const patterns = technicalResult.patterns.chart

      if (patterns.length === 0) return 0.5

      // Calculate average pattern strength, weighted by bullish/bearish direction
      let totalScore = 0
      patterns.forEach(pattern => {
        let score = pattern.strength
        if (pattern.direction === 'bullish') score *= 1.2
        if (pattern.direction === 'bearish') score *= 0.8
        totalScore += score
      })

      return Math.max(0, Math.min(1, totalScore / patterns.length))

    } catch (error) {
      console.error(`Error calculating chart patterns for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate support/resistance levels score
   */
  private async calculateSupportResistance(symbol: string): Promise<number | null> {
    const historicalData = await this.getHistoricalData(symbol, 100)
    if (!historicalData || historicalData.length < 50) return null

    const prices = historicalData.map(h => h.close)
    const currentPrice = prices[0]

    // Find potential support/resistance levels
    const levels = this.findSupportResistanceLevels(prices)

    // Calculate proximity to key levels
    let score = 0.5

    levels.forEach(level => {
      const distance = Math.abs(currentPrice - level) / currentPrice
      if (distance < 0.02) { // Within 2% of S/R level
        score += 0.2
      }
    })

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Calculate composite technical momentum score
   */
  private async calculateTechnicalMomentumComposite(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const factors = await Promise.all([
        this.calculateStochasticSignal(symbol),
        this.calculateWilliamsR(symbol),
        this.calculateROCMomentum(symbol),
        this.calculateMomentumConvergence(symbol)
      ])

      const validFactors = factors.filter((f): f is number => f !== null)
      if (validFactors.length === 0) return null

      return validFactors.reduce((sum, f) => sum + f, 0) / validFactors.length

    } catch (error) {
      console.error(`Error calculating technical momentum composite for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate composite technical trend score
   */
  private async calculateTechnicalTrendComposite(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const factors = await Promise.all([
        this.calculateSMAAlignment(symbol),
        this.calculateEMATrend(symbol),
        this.calculateMACDHistogram(symbol),
        this.calculateBollingerSqueeze(symbol)
      ])

      const validFactors = factors.filter((f): f is number => f !== null)
      if (validFactors.length === 0) return null

      return validFactors.reduce((sum, f) => sum + f, 0) / validFactors.length

    } catch (error) {
      console.error(`Error calculating technical trend composite for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate overall technical analysis score
   */
  private async calculateTechnicalOverallScore(symbol: string): Promise<number | null> {
    if (!this.technicalService) return null

    try {
      const historicalData = await this.getHistoricalData(symbol, 250)
      if (!historicalData || historicalData.length < 50) return null

      const ohlcData: OHLCData[] = historicalData.map(h => ({
        timestamp: h.timestamp,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      }))

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      })

      // Return normalized score (0-1 scale from 0-100 scale)
      return technicalResult.score.total / 100

    } catch (error) {
      console.error(`Error calculating technical overall score for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Helper method to find support/resistance levels
   */
  private findSupportResistanceLevels(prices: number[]): number[] {
    const levels: number[] = []
    const window = 10

    for (let i = window; i < prices.length - window; i++) {
      const price = prices[i]
      let isSupport = true
      let isResistance = true

      // Check if this is a local minimum (support)
      for (let j = i - window; j <= i + window; j++) {
        if (prices[j] < price) {
          isSupport = false
          break
        }
      }

      // Check if this is a local maximum (resistance)
      for (let j = i - window; j <= i + window; j++) {
        if (prices[j] > price) {
          isResistance = false
          break
        }
      }

      if (isSupport || isResistance) {
        levels.push(price)
      }
    }

    return levels
  }

  private async calculateVolumeReversion(
    symbol: string,
    marketData: MarketDataPoint
  ): Promise<number | null> {
    const historicalData = await this.getHistoricalData(symbol, 20)
    if (!historicalData || historicalData.length < 20) {
      return null
    }

    const avgVolume = historicalData.reduce((sum, data) => sum + data.volume, 0) / historicalData.length

    if (avgVolume === 0) return null

    const volumeRatio = marketData.volume / avgVolume

    // Score based on volume deviation (higher volume = higher reversion potential)
    return Math.min(1, Math.max(0, (volumeRatio - 0.5) / 2))
  }

  // ==================== VALUE CALCULATIONS ====================

  private calculatePEScore(peRatio?: number): number | null {
    if (!peRatio || peRatio <= 0) return null

    // Lower P/E ratios get higher scores
    // Normalize around typical P/E ranges (5-30)
    const normalizedPE = Math.max(0, Math.min(30, peRatio))
    return 1 - (normalizedPE / 30)
  }

  private calculatePBScore(pbRatio?: number): number | null {
    if (!pbRatio || pbRatio <= 0) return null

    // Lower P/B ratios get higher scores
    // Normalize around typical P/B ranges (0.5-5)
    const normalizedPB = Math.max(0, Math.min(5, pbRatio))
    return 1 - (normalizedPB / 5)
  }

  private calculateEVEBITDAScore(fundamentalData?: FundamentalDataPoint): number | null {
    if (!fundamentalData?.evEbitda) return null

    const evEbitda = fundamentalData.evEbitda
    if (evEbitda <= 0) return null

    // Lower EV/EBITDA ratios get higher scores
    const normalizedRatio = Math.max(0, Math.min(20, evEbitda))
    return 1 - (normalizedRatio / 20)
  }

  private calculatePriceToSalesScore(
    fundamentalData?: FundamentalDataPoint,
    marketData?: MarketDataPoint
  ): number | null {
    if (!fundamentalData?.revenue || !marketData?.marketCap) return null
    if (fundamentalData.revenue <= 0) return null

    const priceToSales = marketData.marketCap / fundamentalData.revenue

    // Lower P/S ratios get higher scores
    const normalizedPS = Math.max(0, Math.min(10, priceToSales))
    return 1 - (normalizedPS / 10)
  }

  // ==================== QUALITY CALCULATIONS ====================

  private calculateROEScore(roe?: number): number | null {
    if (roe === undefined) return null

    // Higher ROE gets higher scores
    // Normalize around typical ROE ranges (-20% to 40%)
    const normalizedROE = Math.max(-0.2, Math.min(0.4, roe))
    return (normalizedROE + 0.2) / 0.6
  }

  private calculateDebtEquityScore(debtToEquity?: number): number | null {
    if (debtToEquity === undefined || debtToEquity < 0) return null

    // Lower debt-to-equity ratios get higher scores
    // Normalize around typical D/E ranges (0-3)
    const normalizedDE = Math.max(0, Math.min(3, debtToEquity))
    return 1 - (normalizedDE / 3)
  }

  private calculateCurrentRatioScore(fundamentalData?: FundamentalDataPoint): number | null {
    if (!fundamentalData?.currentRatio) return null

    const currentRatio = fundamentalData.currentRatio

    // Optimal current ratio is around 2-3
    if (currentRatio < 1) return 0 // Poor liquidity
    if (currentRatio > 5) return 0.3 // Too much cash, inefficient

    // Peak score around 2-3
    if (currentRatio >= 2 && currentRatio <= 3) return 1

    // Scale down for values outside optimal range
    if (currentRatio < 2) return currentRatio / 2
    return 1 - ((currentRatio - 3) / 2) * 0.7
  }

  private calculateInterestCoverageScore(fundamentalData?: FundamentalDataPoint): number | null {
    if (!fundamentalData?.interestCoverage) return null

    const coverage = fundamentalData.interestCoverage

    // Higher interest coverage is better
    if (coverage < 1) return 0 // Cannot cover interest
    if (coverage > 10) return 1 // Very safe

    return Math.min(1, coverage / 10)
  }

  // ==================== GROWTH CALCULATIONS ====================

  private calculateRevenueGrowthScore(revenueGrowth?: number): number | null {
    if (revenueGrowth === undefined) return null

    // Higher growth gets higher scores
    // Normalize around typical growth ranges (-20% to 50%)
    const normalizedGrowth = Math.max(-0.2, Math.min(0.5, revenueGrowth))
    return (normalizedGrowth + 0.2) / 0.7
  }

  private calculateEarningsGrowthScore(fundamentalData?: FundamentalDataPoint): number | null {
    if (!fundamentalData?.earningsGrowth) return null

    const earningsGrowth = fundamentalData.earningsGrowth

    // Handle negative earnings specially
    if (earningsGrowth < -1) return 0 // Major decline

    // Normalize around typical earnings growth (-100% to 100%)
    const normalizedGrowth = Math.max(-1, Math.min(1, earningsGrowth))
    return (normalizedGrowth + 1) / 2
  }

  private calculateRevenueAccelerationScore(fundamentalData?: FundamentalDataPoint): number | null {
    if (!fundamentalData?.revenueGrowthQoQ || !fundamentalData?.revenueGrowthYoY) return null

    const qoqGrowth = fundamentalData.revenueGrowthQoQ
    const yoyGrowth = fundamentalData.revenueGrowthYoY

    // Revenue acceleration = QoQ growth > YoY growth
    const acceleration = qoqGrowth - yoyGrowth

    // Normalize acceleration score
    return 1 / (1 + Math.exp(-acceleration * 10))
  }

  // ==================== TECHNICAL CALCULATIONS ====================

  private calculateRSIScore(rsi?: number): number | null {
    if (rsi === undefined) return null

    // RSI between 30-70 is considered neutral
    // Below 30 = oversold (good buy opportunity)
    // Above 70 = overbought (potential sell)

    if (rsi <= 30) return 1 // Oversold - high score
    if (rsi >= 70) return 0 // Overbought - low score

    // Linear scale in between
    return 1 - ((rsi - 30) / 40)
  }

  private calculateMACDScore(macd?: { signal: number; histogram: number; macd: number }): number | null {
    if (!macd) return null

    const { histogram, macd: macdLine, signal } = macd

    // MACD above signal line is bullish
    const signalCross = macdLine > signal ? 1 : 0

    // Positive histogram indicates strengthening momentum
    const momentumScore = histogram > 0 ? 1 : 0

    // Combined MACD score
    return (signalCross + momentumScore) / 2
  }

  private async calculateBollingerPosition(
    symbol: string,
    marketData: MarketDataPoint
  ): Promise<number | null> {
    const historicalData = await this.getHistoricalData(symbol, 20)
    if (!historicalData || historicalData.length < 20) {
      return null
    }

    // Calculate 20-day moving average
    const prices = historicalData.slice(0, 20).map(d => d.close)
    const ma = prices.reduce((sum, p) => sum + p, 0) / 20

    // Calculate standard deviation
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - ma, 2), 0) / 20
    const stdDev = Math.sqrt(variance)

    // Bollinger Bands
    const upperBand = ma + (2 * stdDev)
    const lowerBand = ma - (2 * stdDev)

    // Position within bands (0 = lower band, 0.5 = middle, 1 = upper band)
    const position = (marketData.price - lowerBand) / (upperBand - lowerBand)

    // Invert for mean reversion (lower position = higher score)
    return 1 - Math.max(0, Math.min(1, position))
  }

  // ==================== VOLATILITY CALCULATIONS ====================

  private async calculateVolatilityScore(symbol: string, periods: number): Promise<number | null> {
    const historicalData = await this.getHistoricalData(symbol, periods)
    if (!historicalData || historicalData.length < periods) {
      return null
    }

    // Calculate daily returns
    const returns: number[] = []
    for (let i = 0; i < periods - 1; i++) {
      const currentPrice = historicalData[i].close
      const previousPrice = historicalData[i + 1].close
      if (previousPrice > 0) {
        returns.push((currentPrice - previousPrice) / previousPrice)
      }
    }

    if (returns.length === 0) return null

    // Calculate volatility (standard deviation of returns)
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
    const volatility = Math.sqrt(variance) * Math.sqrt(252) // Annualized

    // Normalize volatility (typical range 0.1 to 1.0)
    const normalizedVol = Math.max(0, Math.min(1, volatility))

    // Lower volatility gets higher score for quality-focused strategies
    return 1 - normalizedVol
  }

  private async calculateVolatilityRatio(symbol: string): Promise<number | null> {
    const shortTermVol = await this.calculateVolatilityScore(symbol, 10)
    const longTermVol = await this.calculateVolatilityScore(symbol, 60)

    if (shortTermVol === null || longTermVol === null || longTermVol === 0) return null

    // Volatility ratio (short/long term)
    const volRatio = (1 - shortTermVol) / (1 - longTermVol)

    // Normalize around typical ratios
    return Math.max(0, Math.min(1, volRatio / 2))
  }

  private async calculateBetaScore(symbol: string): Promise<number | null> {
    // This would require market index data for comparison
    // Placeholder implementation
    return 0.5 // Market-neutral beta score
  }

  // ==================== DIVIDEND CALCULATIONS ====================

  private calculateDividendYieldScore(fundamentalData?: FundamentalDataPoint): number | null {
    if (!fundamentalData?.dividendYield) return null

    const dividendYield = fundamentalData.dividendYield

    // Higher dividend yield gets higher scores
    // Normalize around typical dividend yields (0-8%)
    const normalizedYield = Math.max(0, Math.min(0.08, dividendYield))
    return normalizedYield / 0.08
  }

  private calculateDividendGrowthScore(fundamentalData?: FundamentalDataPoint): number | null {
    if (!fundamentalData?.dividendGrowth) return null

    const dividendGrowth = fundamentalData.dividendGrowth

    // Higher dividend growth gets higher scores
    // Normalize around typical dividend growth (-10% to 20%)
    const normalizedGrowth = Math.max(-0.1, Math.min(0.2, dividendGrowth))
    return (normalizedGrowth + 0.1) / 0.3
  }

  private calculatePayoutRatioScore(fundamentalData?: FundamentalDataPoint): number | null {
    if (!fundamentalData?.payoutRatio) return null

    const payoutRatio = fundamentalData.payoutRatio

    // Optimal payout ratio is around 40-60%
    if (payoutRatio < 0 || payoutRatio > 1) return 0 // Invalid ratio

    // Peak score around 0.4-0.6
    if (payoutRatio >= 0.4 && payoutRatio <= 0.6) return 1

    // Scale down for values outside optimal range
    if (payoutRatio < 0.4) return payoutRatio / 0.4
    return 1 - ((payoutRatio - 0.6) / 0.4)
  }

  // ==================== COMPOSITE CALCULATIONS ====================

  private calculateQualityComposite(fundamentalData?: FundamentalDataPoint): number | null {
    const factors: (number | null)[] = [
      this.calculateROEScore(fundamentalData?.roe),
      this.calculateDebtEquityScore(fundamentalData?.debtToEquity),
      this.calculateCurrentRatioScore(fundamentalData),
      this.calculateInterestCoverageScore(fundamentalData)
    ]

    const validFactors = factors.filter((f): f is number => f !== null)
    if (validFactors.length === 0) return null

    return validFactors.reduce((sum, f) => sum + f, 0) / validFactors.length
  }

  private async calculateMomentumComposite(
    symbol: string,
    marketData: MarketDataPoint,
    technicalData?: TechnicalDataPoint
  ): Promise<number | null> {
    const factors: (number | null)[] = [
      await this.calculateMomentum(symbol, 21),
      await this.calculateMomentum(symbol, 63),
      this.calculateRSIScore(technicalData?.rsi),
      this.calculateMACDScore(technicalData?.macd)
    ]

    const validFactors = factors.filter((f): f is number => f !== null)
    if (validFactors.length === 0) return null

    return validFactors.reduce((sum, f) => sum + f, 0) / validFactors.length
  }

  private calculateValueComposite(
    fundamentalData?: FundamentalDataPoint,
    marketData?: MarketDataPoint
  ): number | null {
    const factors: (number | null)[] = [
      this.calculatePEScore(fundamentalData?.peRatio),
      this.calculatePBScore(fundamentalData?.pbRatio),
      this.calculateEVEBITDAScore(fundamentalData),
      this.calculatePriceToSalesScore(fundamentalData, marketData)
    ]

    const validFactors = factors.filter((f): f is number => f !== null)
    if (validFactors.length === 0) return null

    return validFactors.reduce((sum, f) => sum + f, 0) / validFactors.length
  }

  // ==================== UTILITY METHODS ====================

  private async getHistoricalData(symbol: string, periods: number): Promise<HistoricalPrice[] | null> {
    // Check cache first
    const cached = this.historicalDataCache.get(symbol)
    if (cached && cached.length >= periods) {
      return cached.slice(0, periods)
    }

    try {
      // Fetch historical data from your data source
      // This would integrate with your MCP sources or database
      const historicalData = await this.fetchHistoricalPrices(symbol, periods)

      if (historicalData && historicalData.length > 0) {
        this.historicalDataCache.set(symbol, historicalData)
        return historicalData
      }

      return null
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error)
      return null
    }
  }

  private async fetchHistoricalPrices(symbol: string, periods: number): Promise<HistoricalPrice[]> {
    // Placeholder for historical data fetching
    // This would integrate with your existing MCP sources
    return []
  }

  /**
   * Check if factor requires fundamental data
   */
  requiresFundamentalData(factorName: string): boolean {
    const fundamentalFactors = [
      'pe_ratio', 'pb_ratio', 'ev_ebitda', 'price_to_sales',
      'roe', 'debt_equity', 'current_ratio', 'interest_coverage',
      'revenue_growth', 'earnings_growth', 'revenue_acceleration',
      'dividend_yield', 'dividend_growth', 'payout_ratio',
      'quality_composite', 'value_composite'
    ]

    return fundamentalFactors.includes(factorName)
  }

  /**
   * Check if factor requires technical data
   */
  requiresTechnicalData(factorName: string): boolean {
    const technicalFactors = [
      'rsi_14d', 'macd_signal', 'bollinger_position',
      'momentum_composite',
      // Enhanced technical factors
      'sma_alignment', 'ema_trend', 'macd_histogram', 'bollinger_squeeze',
      'stochastic_signal', 'williams_r', 'roc_momentum', 'momentum_convergence',
      'obv_trend', 'vwap_position', 'volume_confirmation',
      'atr_volatility', 'volatility_breakout',
      'candlestick_patterns', 'chart_patterns', 'support_resistance',
      'technical_momentum_composite', 'technical_trend_composite', 'technical_overall_score'
    ]

    return technicalFactors.includes(factorName)
  }

  /**
   * Get all available factors
   */
  getAvailableFactors(): string[] {
    return [
      // Momentum
      'momentum_1m', 'momentum_3m', 'momentum_6m', 'momentum_12m',

      // Mean Reversion
      'price_reversion_20d', 'price_reversion_50d', 'volume_reversion',

      // Value
      'pe_ratio', 'pb_ratio', 'ev_ebitda', 'price_to_sales',

      // Quality
      'roe', 'debt_equity', 'current_ratio', 'interest_coverage',

      // Growth
      'revenue_growth', 'earnings_growth', 'revenue_acceleration',

      // Technical
      'rsi_14d', 'macd_signal', 'bollinger_position',

      // Enhanced Technical Factors
      'sma_alignment', 'ema_trend', 'macd_histogram', 'bollinger_squeeze',
      'stochastic_signal', 'williams_r', 'roc_momentum', 'momentum_convergence',
      'obv_trend', 'vwap_position', 'volume_confirmation',
      'atr_volatility', 'volatility_breakout',
      'candlestick_patterns', 'chart_patterns', 'support_resistance',

      // Volatility
      'volatility_30d', 'volatility_ratio', 'beta',

      // Dividend
      'dividend_yield', 'dividend_growth', 'payout_ratio',

      // Composite
      'quality_composite', 'momentum_composite', 'value_composite',

      // Technical Composite
      'technical_momentum_composite', 'technical_trend_composite', 'technical_overall_score'
    ]
  }

  /**
   * Clear cache for symbol or all
   */
  clearCache(symbol?: string) {
    if (symbol) {
      // Clear cache entries for specific symbol
      this.factorCache.forEach((_, key) => {
        if (key.includes(symbol)) {
          this.factorCache.delete(key)
        }
      })
      this.historicalDataCache.delete(symbol)
    } else {
      // Clear all cache
      this.factorCache.clear()
      this.historicalDataCache.clear()
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      factorCacheSize: this.factorCache.size,
      historicalCacheSize: this.historicalDataCache.size,
      totalMemoryUsage: this.estimateMemoryUsage()
    }
  }

  private estimateMemoryUsage(): string {
    let totalSize = 0

    // Estimate factor cache size
    totalSize += this.factorCache.size * 100 // Rough estimate per entry

    // Estimate historical data cache size
    this.historicalDataCache.forEach((data) => {
      totalSize += data.length * 50 // Rough estimate per price point
    })

    if (totalSize < 1024) return `${totalSize}B`
    if (totalSize < 1024 * 1024) return `${Math.round(totalSize / 1024)}KB`
    return `${Math.round(totalSize / (1024 * 1024))}MB`
  }
}