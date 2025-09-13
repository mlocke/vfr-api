/**
 * Factor Library for Dynamic Stock Selection Algorithms
 * Provides configurable factor calculations with caching and data quality integration
 */

import { FactorCalculator } from './types'

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
      'momentum_composite'
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

      // Volatility
      'volatility_30d', 'volatility_ratio', 'beta',

      // Dividend
      'dividend_yield', 'dividend_growth', 'payout_ratio',

      // Composite
      'quality_composite', 'momentum_composite', 'value_composite'
    ]
  }

  /**
   * Clear cache for symbol or all
   */
  clearCache(symbol?: string) {
    if (symbol) {
      // Clear cache entries for specific symbol
      for (const [key] of this.factorCache.entries()) {
        if (key.includes(symbol)) {
          this.factorCache.delete(key)
        }
      }
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
    for (const data of this.historicalDataCache.values()) {
      totalSize += data.length * 50 // Rough estimate per price point
    }

    if (totalSize < 1024) return `${totalSize}B`
    if (totalSize < 1024 * 1024) return `${Math.round(totalSize / 1024)}KB`
    return `${Math.round(totalSize / (1024 * 1024))}MB`
  }
}