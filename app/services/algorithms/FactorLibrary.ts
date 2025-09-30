/**
 * Factor Library for Dynamic Stock Selection Algorithms
 * Provides configurable factor calculations with caching and data quality integration
 */

import { FactorCalculator } from './types'
import { TechnicalIndicatorService } from '../technical-analysis/TechnicalIndicatorService'
import { TechnicalAnalysisResult, OHLCData } from '../technical-analysis/types'
import { TwelveDataAPI } from '../financial-data/TwelveDataAPI'
import { HistoricalOHLC } from '../financial-data/types'
import { RedisCache } from '../cache/RedisCache'
import { VWAPService } from '../financial-data/VWAPService'
import { ESGDataService } from '../financial-data/ESGDataService'
import { ShortInterestService } from '../financial-data/ShortInterestService'
import { ExtendedMarketDataService } from '../financial-data/ExtendedMarketDataService'
import { getSectorBenchmarks, calculatePercentileScore } from './SectorBenchmarks'

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
  currentRatio?: number
  operatingMargin?: number
  netProfitMargin?: number
  grossProfitMargin?: number
  priceToSales?: number
  evEbitda?: number
  evToEbitda?: number
  interestCoverage?: number
  earningsGrowth?: number
  dividendYield?: number
  payoutRatio?: number
  revenueGrowthQoQ?: number
  revenueGrowthYoY?: number
  revenue?: number
  [key: string]: any
}

interface TechnicalDataPoint {
  symbol: string
  rsi?: number
  macd?: { signal: number; histogram: number; macd: number }
  sma?: { [period: string]: number }
  volatility?: number
  sentimentScore?: number // 🆕 SENTIMENT INTEGRATION
  vwapAnalysis?: any // 🆕 VWAP INTEGRATION
  macroeconomicContext?: any // 🆕 MACROECONOMIC INTEGRATION
  institutionalData?: any // 🆕 INSTITUTIONAL DATA INTEGRATION
  shortInterestData?: any // 🆕 SHORT INTEREST INTEGRATION
  extendedMarketData?: any // 🆕 EXTENDED MARKET DATA INTEGRATION
  optionsData?: OptionsDataPoint // 🆕 OPTIONS INTEGRATION
  [key: string]: any
}

interface OptionsDataPoint {
  putCallRatio?: number
  impliedVolatilityPercentile?: number
  optionsFlow?: {
    sentiment: number // -1 to 1 scale
    volume: number
    openInterest: number
  }
  greeks?: {
    delta: number
    gamma: number
    theta: number
    vega: number
  }
  volumeDivergence?: number // Ratio of options volume to stock volume
  maxPain?: number // Max pain strike price
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
  private technicalService: TechnicalIndicatorService
  private twelveDataAPI: TwelveDataAPI
  private cache: RedisCache
  private vwapService?: VWAPService
  private esgService?: ESGDataService
  private shortInterestService?: ShortInterestService
  private extendedMarketService?: ExtendedMarketDataService

  /**
   * Initialize with cache and create TechnicalIndicatorService
   */
  constructor(
    cache?: RedisCache,
    technicalService?: TechnicalIndicatorService,
    vwapService?: VWAPService,
    esgService?: ESGDataService,
    shortInterestService?: ShortInterestService,
    extendedMarketService?: ExtendedMarketDataService
  ) {
    // Initialize cache - create new instance if not provided
    this.cache = cache || new RedisCache()

    // Initialize technical service - always available for technical weighting
    this.technicalService = technicalService || new TechnicalIndicatorService(this.cache)

    this.twelveDataAPI = new TwelveDataAPI()
    this.vwapService = vwapService
    this.esgService = esgService || new ESGDataService()
    this.shortInterestService = shortInterestService
    this.extendedMarketService = extendedMarketService
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
    const startTime = Date.now()

    try {
      console.log(`Starting calculation of factor ${factorName} for ${symbol}`)

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
          result = this.calculatePEScore(fundamentalData?.peRatio, marketData?.sector)
          break
        case 'pb_ratio':
          result = this.calculatePBScore(fundamentalData?.pbRatio, marketData?.sector)
          break
        case 'ev_ebitda':
          result = this.calculateEVEBITDAScore(fundamentalData, marketData?.sector)
          break
        case 'price_to_sales':
          result = this.calculatePriceToSalesScore(fundamentalData, marketData)
          break
        case 'peg_ratio':
          result = this.calculatePEGScore(fundamentalData, marketData?.sector)
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
        case 'technical_overall_score_with_options':
          result = await this.calculateTechnicalOverallScoreWithOptions(symbol, technicalData?.optionsData)
          break

        // ==================== OPTIONS INTELLIGENCE FACTORS ====================
        case 'options_composite':
          result = this.calculateOptionsScore(technicalData?.optionsData)
          break
        case 'put_call_ratio_score':
          result = technicalData?.optionsData?.putCallRatio ? this.calculatePutCallRatioScore(technicalData.optionsData.putCallRatio) : null
          break
        case 'iv_percentile_score':
          result = technicalData?.optionsData?.impliedVolatilityPercentile ? this.calculateIVPercentileScore(technicalData.optionsData.impliedVolatilityPercentile) : null
          break
        case 'options_flow_score':
          result = technicalData?.optionsData?.optionsFlow ? this.calculateOptionsFlowScore(technicalData.optionsData.optionsFlow) : null
          break
        case 'greeks_score':
          result = technicalData?.optionsData?.greeks ? this.calculateGreeksScore(technicalData.optionsData.greeks) : null
          break
        case 'volume_divergence_score':
          result = technicalData?.optionsData?.volumeDivergence ? this.calculateVolumeDivergenceScore(technicalData.optionsData.volumeDivergence) : null
          break
        case 'max_pain_score':
          result = technicalData?.optionsData?.maxPain ? this.calculateMaxPainScore(technicalData.optionsData.maxPain, marketData.price) : null
          break

        // ==================== ENHANCED SERVICE INTEGRATION FACTORS ====================
        case 'vwap_deviation_score':
          result = this.calculateVWAPDeviationScore(technicalData?.vwapAnalysis)
          break
        case 'vwap_trading_signals':
          result = this.calculateVWAPTradingSignals(technicalData?.vwapAnalysis)
          break

        case 'vwap_trend_analysis':
          result = await this.calculateVWAPTrendScore(symbol, technicalData?.vwapAnalysis)
          break
        case 'macroeconomic_sector_impact':
          result = this.calculateMacroeconomicSectorImpact(technicalData?.macroeconomicContext, marketData?.sector)
          break
        case 'macroeconomic_composite':
          result = this.calculateMacroeconomicComposite(technicalData?.macroeconomicContext)
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

        // ==================== ESG FACTORS ====================
        case 'esg_composite':
          result = await this.calculateESGComposite(symbol, marketData.sector)
          break
        case 'esg_environmental':
          result = await this.calculateESGFactor(symbol, marketData.sector, 'environmental')
          break
        case 'esg_social':
          result = await this.calculateESGFactor(symbol, marketData.sector, 'social')
          break
        case 'esg_governance':
          result = await this.calculateESGFactor(symbol, marketData.sector, 'governance')
          break

        // ==================== SHORT INTEREST FACTORS ====================
        case 'short_interest_composite':
          result = await this.calculateShortInterestComposite(symbol, technicalData)
          break
        case 'short_squeeze_potential':
          result = await this.calculateShortSqueezePotential(symbol)
          break

        // ==================== EXTENDED MARKET DATA FACTORS ====================
        case 'extended_market_composite':
          result = await this.calculateExtendedMarketComposite(symbol, technicalData)
          break
        case 'liquidity_score':
          result = await this.calculateLiquidityScore(symbol)
          break
        case 'bid_ask_efficiency':
          result = await this.calculateBidAskEfficiency(symbol)
          break

        // ==================== COMPOSITE FACTORS ====================
        case 'composite':
          // MAIN COMPOSITE ALGORITHM - matches debug algorithm exactly
          // Extract sentiment score, ESG score, macroeconomic context, short interest, and extended market data from technicalData if available (passed by AlgorithmEngine)
          const sentimentScore = (technicalData as any)?.sentimentScore
          const esgScore = (technicalData as any)?.esgScore
          const macroeconomicContext = (technicalData as any)?.macroeconomicContext
          const shortInterestData = (technicalData as any)?.shortInterestData
          const extendedMarketData = (technicalData as any)?.extendedMarketData
          result = await this.calculateMainComposite(symbol, marketData, fundamentalData, technicalData, sentimentScore, esgScore, macroeconomicContext, shortInterestData, extendedMarketData)
          break
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

      const calculationTime = Date.now() - startTime

      // Cache result if valid
      if (result !== null && !isNaN(result)) {
        this.factorCache.set(cacheKey, { value: result, timestamp: Date.now() })
        console.log(`✅ Factor ${factorName} for ${symbol}: ${result.toFixed(4)} (calculated in ${calculationTime}ms)`)
      } else {
        console.warn(`⚠️ Factor ${factorName} for ${symbol}: returned null/NaN (${calculationTime}ms)`)
      }

      return result

    } catch (error) {
      const calculationTime = Date.now() - startTime
      console.error(`❌ Error calculating factor ${factorName} for ${symbol} (${calculationTime}ms):`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
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

    try {
      console.log(`🔍 Attempting to calculate technical overall score for ${symbol}`)

      // Try to get historical data with fallback to shorter periods
      let historicalData = await this.getHistoricalData(symbol, 250)
      if (!historicalData || historicalData.length < 50) {
        console.log(`⚠️ Insufficient long-term data for ${symbol} (${historicalData?.length || 0} points), trying shorter period`)
        historicalData = await this.getHistoricalData(symbol, 100)
      }

      if (!historicalData || historicalData.length < 20) {
        console.log(`❌ Insufficient historical data for technical analysis of ${symbol}: ${historicalData?.length || 0} points`)
        return null
      }

      console.log(`✅ Using ${historicalData.length} data points for technical analysis of ${symbol}`)

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

      console.log(`📊 Technical analysis result for ${symbol}: ${technicalResult.score.total}/100`)

      // Return normalized score (0-1 scale from 0-100 scale)
      return technicalResult.score.total / 100

    } catch (error) {
      console.error(`❌ Error calculating technical overall score for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate enhanced technical analysis score with options integration
   * 85% traditional technical analysis + 15% options intelligence
   */
  private async calculateTechnicalOverallScoreWithOptions(symbol: string, optionsData?: OptionsDataPoint): Promise<number | null> {

    try {
      console.log(`🔍 Calculating enhanced technical score with options integration for ${symbol}`)

      // Calculate traditional technical analysis (85% weight)
      const traditionalTechnicalScore = await this.calculateTechnicalOverallScore(symbol)
      if (traditionalTechnicalScore === null) {
        console.log(`❌ Failed to calculate traditional technical score for ${symbol}`)
        return null
      }

      // Calculate options score (15% weight)
      const optionsScore = this.calculateOptionsScore(optionsData)
      if (optionsScore === null) {
        console.log(`⚠️ No options data for ${symbol}, using traditional technical score only`)
        return traditionalTechnicalScore
      }

      // Combine scores with institutional-grade weighting
      const enhancedTechnicalScore = (traditionalTechnicalScore * 0.85) + (optionsScore * 0.15)

      console.log(`🎯 Enhanced Technical Analysis for ${symbol}:`)
      console.log(`   Traditional Technical: ${traditionalTechnicalScore.toFixed(3)} (85% weight)`)
      console.log(`   Options Intelligence: ${optionsScore.toFixed(3)} (15% weight)`)
      console.log(`   Combined Score: ${enhancedTechnicalScore.toFixed(3)}`)

      return Math.max(0, Math.min(1, enhancedTechnicalScore))

    } catch (error) {
      console.error(`❌ Error calculating enhanced technical score for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate comprehensive options analysis score (0-1 scale)
   * Integrates 6 key options intelligence factors for institutional-grade analysis
   * Components: P/C Ratio (25%), IV Percentile (20%), Options Flow (20%), Max Pain (15%), Greeks (10%), Volume Divergence (10%)
   */
  private calculateOptionsScore(optionsData?: OptionsDataPoint): number | null {
    if (!optionsData) {
      console.log('⚠️ No options data available - using neutral score')
      return 0.5 // Neutral score when no options data
    }

    console.log('📊 Calculating options intelligence score...')

    let totalScore = 0
    let totalWeight = 0

    // 1. PUT/CALL RATIO SIGNALS (30% of options score)
    if (optionsData.putCallRatio !== undefined) {
      const pcRatioScore = this.calculatePutCallRatioScore(optionsData.putCallRatio)
      totalScore += pcRatioScore * 0.30
      totalWeight += 0.30
      console.log(`   P/C Ratio: ${optionsData.putCallRatio.toFixed(2)} → Score: ${pcRatioScore.toFixed(3)} (30% weight)`)
    }

    // 2. IMPLIED VOLATILITY PERCENTILE SIGNALS (25% of options score)
    if (optionsData.impliedVolatilityPercentile !== undefined) {
      const ivPercentileScore = this.calculateIVPercentileScore(optionsData.impliedVolatilityPercentile)
      totalScore += ivPercentileScore * 0.25
      totalWeight += 0.25
      console.log(`   IV Percentile: ${optionsData.impliedVolatilityPercentile.toFixed(1)}% → Score: ${ivPercentileScore.toFixed(3)} (25% weight)`)
    }

    // 3. OPTIONS FLOW SENTIMENT (20% of options score)
    if (optionsData.optionsFlow) {
      const flowScore = this.calculateOptionsFlowScore(optionsData.optionsFlow)
      totalScore += flowScore * 0.20
      totalWeight += 0.20
      console.log(`   Options Flow: ${optionsData.optionsFlow.sentiment.toFixed(2)} → Score: ${flowScore.toFixed(3)} (20% weight)`)
    }

    // 4. MAX PAIN ANALYSIS (15% of options score) - Market maker positioning
    if (optionsData.maxPain !== undefined) {
      // Need current stock price for max pain comparison - using a default placeholder
      const maxPainScore = 0.5 // Will be enhanced when price context is available
      totalScore += maxPainScore * 0.15
      totalWeight += 0.15
      console.log(`   Max Pain: $${optionsData.maxPain.toFixed(2)} → Score: ${maxPainScore.toFixed(3)} (15% weight)`)
    }

    // 5. GREEKS RISK INDICATORS (10% of options score)
    if (optionsData.greeks) {
      const greeksScore = this.calculateGreeksScore(optionsData.greeks)
      totalScore += greeksScore * 0.10
      totalWeight += 0.10
      console.log(`   Greeks Analysis → Score: ${greeksScore.toFixed(3)} (10% weight)`)
    }

    // 6. VOLUME DIVERGENCE (10% of options score)
    if (optionsData.volumeDivergence !== undefined) {
      const volumeDivergenceScore = this.calculateVolumeDivergenceScore(optionsData.volumeDivergence)
      totalScore += volumeDivergenceScore * 0.10
      totalWeight += 0.10
      console.log(`   Volume Divergence: ${optionsData.volumeDivergence.toFixed(2)} → Score: ${volumeDivergenceScore.toFixed(3)} (10% weight)`)
    }

    if (totalWeight === 0) {
      console.log('⚠️ No valid options factors found - using neutral score')
      return 0.5
    }

    const finalOptionsScore = totalScore / totalWeight
    console.log(`✅ Options Intelligence Score: ${finalOptionsScore.toFixed(3)} (${(totalWeight * 100).toFixed(0)}% data coverage)`)

    return Math.max(0, Math.min(1, finalOptionsScore))
  }

  /**
   * Calculate Put/Call ratio scoring (0-1 scale)
   * Lower P/C ratios are generally more bullish
   */
  private calculatePutCallRatioScore(putCallRatio: number): number {
    // Typical P/C ratio ranges: 0.5-1.5
    // Below 0.7: Very bullish (score: 0.8-1.0)
    // 0.7-1.0: Bullish (score: 0.6-0.8)
    // 1.0-1.3: Neutral (score: 0.4-0.6)
    // Above 1.3: Bearish (score: 0.0-0.4)

    if (putCallRatio <= 0.7) {
      return 0.8 + (0.7 - putCallRatio) * 0.4 // Very bullish territory
    } else if (putCallRatio <= 1.0) {
      return 0.6 + (1.0 - putCallRatio) * 0.67 // Bullish territory
    } else if (putCallRatio <= 1.3) {
      return 0.4 + (1.3 - putCallRatio) * 0.67 // Neutral territory
    } else {
      return Math.max(0, 0.4 - (putCallRatio - 1.3) * 0.3) // Bearish territory
    }
  }

  /**
   * Calculate Implied Volatility percentile scoring (0-1 scale)
   * Higher IV percentiles can indicate oversold conditions or upcoming catalysts
   */
  private calculateIVPercentileScore(ivPercentile: number): number {
    // IV Percentile ranges: 0-100
    // 0-20: Low volatility, potential breakout (score: 0.6-0.7)
    // 20-40: Normal volatility (score: 0.5-0.6)
    // 40-60: Elevated volatility (score: 0.4-0.5)
    // 60-80: High volatility (score: 0.3-0.4)
    // 80-100: Extreme volatility, mean reversion likely (score: 0.2-0.3)

    if (ivPercentile <= 20) {
      return 0.6 + ivPercentile * 0.005 // Low vol breakout potential
    } else if (ivPercentile <= 40) {
      return 0.5 + (ivPercentile - 20) * 0.005 // Normal conditions
    } else if (ivPercentile <= 60) {
      return 0.4 + (60 - ivPercentile) * 0.005 // Elevated vol
    } else if (ivPercentile <= 80) {
      return 0.3 + (80 - ivPercentile) * 0.005 // High vol
    } else {
      return 0.2 + (100 - ivPercentile) * 0.005 // Extreme vol
    }
  }

  /**
   * Calculate options flow sentiment scoring (0-1 scale)
   */
  private calculateOptionsFlowScore(optionsFlow: { sentiment: number; volume: number; openInterest: number }): number {
    // Sentiment ranges from -1 (very bearish) to +1 (very bullish)
    // Transform to 0-1 scale with volume/open interest weighting

    const baseSentimentScore = (optionsFlow.sentiment + 1) / 2 // Convert -1,1 to 0,1

    // Volume and open interest provide confidence weighting
    // Higher volume/OI = more reliable sentiment signal
    const volumeWeight = Math.min(1, optionsFlow.volume / 1000000) // Normalize by 1M volume
    const oiWeight = Math.min(1, optionsFlow.openInterest / 100000) // Normalize by 100K OI
    const confidenceWeight = (volumeWeight + oiWeight) / 2

    // Weight the sentiment by confidence, but don't go below 0.3 or above 0.7 for low confidence
    if (confidenceWeight < 0.2) {
      return 0.4 + baseSentimentScore * 0.2 // Low confidence: narrow range around neutral
    } else {
      return baseSentimentScore * confidenceWeight + (1 - confidenceWeight) * 0.5
    }
  }

  /**
   * Calculate Greeks-based risk scoring (0-1 scale)
   */
  private calculateGreeksScore(greeks: { delta: number; gamma: number; theta: number; vega: number }): number {
    let score = 0.5 // Start neutral

    // Delta analysis: Higher absolute delta indicates more directional exposure
    const deltaScore = Math.abs(greeks.delta) // 0-1 scale naturally

    // Gamma analysis: Higher gamma indicates more convexity (risk/reward)
    const gammaScore = Math.min(1, Math.abs(greeks.gamma) * 100) // Scale gamma appropriately

    // Theta analysis: Time decay impact (negative theta is typical)
    const thetaScore = Math.max(0, Math.min(1, (-greeks.theta + 0.1) / 0.2)) // Normalize theta

    // Vega analysis: Volatility sensitivity
    const vegaScore = Math.min(1, Math.abs(greeks.vega) / 0.5) // Scale vega

    // Weighted combination of greeks
    score = (deltaScore * 0.4 + gammaScore * 0.3 + thetaScore * 0.2 + vegaScore * 0.1)

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Calculate volume divergence scoring (0-1 scale)
   */
  private calculateVolumeDivergenceScore(volumeDivergence: number): number {
    // Volume divergence: ratio of options volume to stock volume
    // Higher ratios indicate more options activity relative to stock trading
    // Typical ranges: 0.1-2.0

    if (volumeDivergence <= 0.3) {
      return 0.3 // Low options activity
    } else if (volumeDivergence <= 0.7) {
      return 0.4 + volumeDivergence * 0.29 // Normal activity
    } else if (volumeDivergence <= 1.5) {
      return 0.6 + (volumeDivergence - 0.7) * 0.25 // High activity
    } else {
      return Math.min(1, 0.8 + (volumeDivergence - 1.5) * 0.4) // Very high activity
    }
  }

  /**
   * Calculate max pain analysis scoring (0-1 scale)
   * Max pain represents the strike price where market makers lose the least money
   */
  private calculateMaxPainScore(maxPain: number, currentPrice: number): number {
    if (maxPain <= 0 || currentPrice <= 0) {
      return 0.5 // Neutral if invalid data
    }

    // Calculate percentage difference between current price and max pain
    const percentDifference = Math.abs(currentPrice - maxPain) / currentPrice

    // Max pain analysis:
    // - Price at max pain: Neutral to slightly bearish (0.4-0.5)
    // - Price 5-10% above max pain: Bullish pressure (0.6-0.7)
    // - Price 5-10% below max pain: Support levels (0.6-0.7)
    // - Price >15% from max pain: Strong directional bias (0.7-0.8)

    if (percentDifference <= 0.02) {
      // Very close to max pain (within 2%)
      return 0.45 // Slight bearish bias as MM will defend this level
    } else if (percentDifference <= 0.05) {
      // Within 5% of max pain
      return currentPrice > maxPain ? 0.6 : 0.55 // Slight bullish if above, neutral if below
    } else if (percentDifference <= 0.10) {
      // 5-10% from max pain
      return currentPrice > maxPain ? 0.65 : 0.6 // Bullish pressure or support
    } else if (percentDifference <= 0.15) {
      // 10-15% from max pain
      return currentPrice > maxPain ? 0.7 : 0.65 // Strong momentum away from pain
    } else {
      // >15% from max pain
      return Math.min(0.8, 0.7 + (percentDifference - 0.15) * 2) // Very strong directional bias
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

  /**
   * Calculate P/E ratio score with sector-relative benchmarking
   * Uses sector-specific quartiles instead of generic normalization
   *
   * @param peRatio - P/E ratio value
   * @param sector - Company sector for benchmark selection
   * @returns Score from 0 to 1 (higher = more attractive valuation)
   */
  private calculatePEScore(peRatio?: number, sector?: string): number | null {
    if (!peRatio || peRatio <= 0) return null

    // Get sector-specific benchmarks
    const benchmarks = getSectorBenchmarks(sector)

    // Calculate percentile-based score using sector benchmarks
    return calculatePercentileScore(peRatio, benchmarks.peRatio)
  }

  /**
   * Calculate P/B ratio score with sector-relative benchmarking
   *
   * @param pbRatio - P/B ratio value
   * @param sector - Company sector for benchmark selection
   * @returns Score from 0 to 1 (higher = more attractive valuation)
   */
  private calculatePBScore(pbRatio?: number, sector?: string): number | null {
    if (!pbRatio || pbRatio <= 0) return null

    // Get sector-specific benchmarks
    const benchmarks = getSectorBenchmarks(sector)

    // Calculate percentile-based score using sector benchmarks
    return calculatePercentileScore(pbRatio, benchmarks.pbRatio)
  }

  /**
   * Calculate EV/EBITDA score with sector-relative benchmarking
   *
   * @param fundamentalData - Fundamental data containing EV/EBITDA
   * @param sector - Company sector for benchmark selection
   * @returns Score from 0 to 1 (higher = more attractive valuation)
   */
  private calculateEVEBITDAScore(fundamentalData?: FundamentalDataPoint, sector?: string): number | null {
    // Check multiple possible property names for EV/EBITDA
    const evEbitda = fundamentalData?.evEbitda || fundamentalData?.evToEbitda

    if (!evEbitda || evEbitda <= 0) return null

    // Get sector-specific benchmarks
    const benchmarks = getSectorBenchmarks(sector)

    // Calculate percentile-based score using sector benchmarks
    return calculatePercentileScore(evEbitda, benchmarks.evEbitda)
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

  /**
   * Calculate PEG ratio score - growth-adjusted valuation
   * PEG = P/E / EPS Growth Rate (%)
   * Lower PEG = better value relative to growth
   *
   * @param fundamentalData - Fundamental data containing P/E and growth metrics
   * @param sector - Company sector for benchmark selection
   * @returns Score from 0 to 1 (higher = better value relative to growth)
   */
  private calculatePEGScore(fundamentalData?: FundamentalDataPoint, sector?: string): number | null {
    const peRatio = fundamentalData?.peRatio
    const earningsGrowth = fundamentalData?.earningsGrowth ||
                          fundamentalData?.revenueGrowth // Fallback to revenue growth

    if (!peRatio || peRatio <= 0 || !earningsGrowth || earningsGrowth <= 0) {
      return null // Cannot calculate PEG without positive P/E and growth
    }

    // Calculate PEG ratio
    // Note: earningsGrowth should already be in decimal form (e.g., 0.25 for 25%)
    // If it's a percentage (e.g., 25), convert to decimal
    const growthRate = earningsGrowth > 1 ? earningsGrowth / 100 : earningsGrowth
    const pegRatio = peRatio / (growthRate * 100) // Convert to percentage for standard PEG calculation

    // Get sector-specific PEG benchmarks
    const benchmarks = getSectorBenchmarks(sector)
    const pegBenchmarks = benchmarks.pegRatio

    // Scoring logic:
    // PEG < 1.0 = Undervalued relative to growth (score 0.90-1.0)
    // PEG 1.0-2.0 = Fairly valued (score 0.60-0.90)
    // PEG > 2.0 = Overvalued relative to growth (score 0.0-0.60)

    if (pegRatio < 0.5) {
      return 1.0 // Exceptional value
    } else if (pegRatio < 1.0) {
      // Linear interpolation 0.5-1.0 PEG → 1.0-0.90 score
      return 1.0 - ((pegRatio - 0.5) * 0.20)
    } else if (pegRatio <= pegBenchmarks.p25) {
      // p25 is "good" PEG for sector
      const range = pegBenchmarks.p25 - 1.0
      const position = (pegRatio - 1.0) / range
      return 0.90 - (position * 0.15) // 0.90 → 0.75
    } else if (pegRatio <= pegBenchmarks.median) {
      const range = pegBenchmarks.median - pegBenchmarks.p25
      const position = (pegRatio - pegBenchmarks.p25) / range
      return 0.75 - (position * 0.15) // 0.75 → 0.60
    } else if (pegRatio <= pegBenchmarks.p75) {
      const range = pegBenchmarks.p75 - pegBenchmarks.median
      const position = (pegRatio - pegBenchmarks.median) / range
      return 0.60 - (position * 0.30) // 0.60 → 0.30
    } else {
      // Beyond p75 - steep penalty
      const excessRatio = Math.min(2.0, (pegRatio - pegBenchmarks.p75) / pegBenchmarks.p75)
      return Math.max(0, 0.30 - (excessRatio * 0.30))
    }
  }

  // ==================== QUALITY CALCULATIONS ====================

  private calculateROEScore(roe?: number): number | null {
    if (roe === undefined || !isFinite(roe)) return null

    // Higher ROE gets higher scores
    // ROE above 15% is excellent, above 20% is exceptional
    // Normalize around typical ROE ranges (-50% to 50%)
    const normalizedROE = Math.max(-0.5, Math.min(0.5, roe))
    const score = Math.max(0, Math.min(1, (normalizedROE + 0.5) / 1.0))

    return score
  }

  private calculateDebtEquityScore(debtToEquity?: number): number | null {
    if (debtToEquity === undefined || debtToEquity < 0 || !isFinite(debtToEquity)) return null

    // Lower debt-to-equity ratios get higher scores
    // D/E under 0.3 is excellent, under 0.6 is good, over 2.0 is concerning
    // Normalize around typical D/E ranges (0-5)
    const normalizedDE = Math.max(0, Math.min(5, debtToEquity))
    const score = Math.max(0, Math.min(1, 1 - (normalizedDE / 5)))

    return score
  }

  private calculateCurrentRatioScore(fundamentalData?: FundamentalDataPoint): number | null {
    if (!fundamentalData?.currentRatio || !isFinite(fundamentalData.currentRatio)) return null

    const currentRatio = fundamentalData.currentRatio

    // Current ratio scoring with more realistic ranges
    if (currentRatio < 0.5) return 0 // Very poor liquidity
    if (currentRatio < 1) return 0.2 // Poor liquidity but not zero
    if (currentRatio > 10) return 0.3 // Excessive cash, inefficient

    // Optimal current ratio is around 1.5-4
    if (currentRatio >= 1.5 && currentRatio <= 4) {
      // Peak score in optimal range
      return Math.min(1, 0.8 + (Math.min(currentRatio, 2.5) - 1.5) * 0.2)
    }

    // Scale for values outside optimal range
    if (currentRatio < 1.5) {
      return Math.max(0.2, currentRatio / 1.5 * 0.8)
    }

    // currentRatio > 4
    return Math.max(0.3, 1 - ((currentRatio - 4) / 6) * 0.7)
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
    console.log(`Calculating ${periods}-day volatility for ${symbol}`)

    const historicalData = await this.getHistoricalData(symbol, periods)
    if (!historicalData || historicalData.length < periods) {
      console.warn(`Insufficient historical data for ${symbol}: got ${historicalData?.length || 0}, needed ${periods}`)
      return null
    }

    // Calculate daily returns
    const returns: number[] = []
    for (let i = 0; i < Math.min(periods - 1, historicalData.length - 1); i++) {
      const currentPrice = historicalData[i].close
      const previousPrice = historicalData[i + 1].close

      if (previousPrice > 0 && currentPrice > 0) {
        const dailyReturn = (currentPrice - previousPrice) / previousPrice
        returns.push(dailyReturn)
      }
    }

    if (returns.length === 0) {
      console.warn(`No valid returns calculated for ${symbol}`)
      return null
    }

    console.log(`Calculated ${returns.length} daily returns for ${symbol}`)

    // Calculate volatility (standard deviation of returns)
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
    const dailyVolatility = Math.sqrt(variance)

    // Annualized volatility (assuming 252 trading days per year)
    const annualizedVolatility = dailyVolatility * Math.sqrt(252)

    console.log(`${symbol} volatility stats:`, {
      periods: returns.length,
      dailyVol: dailyVolatility.toFixed(4),
      annualizedVol: annualizedVolatility.toFixed(4),
      meanReturn: meanReturn.toFixed(4)
    })

    // Normalize volatility for scoring
    // Typical stock volatility ranges from 0.1 (10%) to 1.0 (100%) annualized
    // Lower volatility = higher score (for quality/stability focused strategies)
    const normalizedVol = Math.max(0, Math.min(1, annualizedVolatility))
    const volatilityScore = 1 - normalizedVol

    console.log(`${symbol} volatility score: ${volatilityScore.toFixed(3)} (lower volatility = higher score)`)

    return Math.max(0, Math.min(1, volatilityScore))
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

  private calculateOperatingMarginScore(operatingMargin?: number): number | null {
    if (operatingMargin === undefined) return null

    // Higher operating margin is better
    // Normalize around typical operating margin ranges (0% to 30%)
    const normalizedMargin = Math.max(0, Math.min(0.3, operatingMargin))
    return normalizedMargin / 0.3
  }

  private calculateNetMarginScore(netMargin?: number): number | null {
    if (netMargin === undefined) return null

    // Higher net profit margin is better
    // Normalize around typical net margin ranges (0% to 25%)
    const normalizedMargin = Math.max(0, Math.min(0.25, netMargin))
    return normalizedMargin / 0.25
  }

  private calculatePriceToSalesDirectScore(priceToSalesRatio?: number): number | null {
    if (priceToSalesRatio === undefined || priceToSalesRatio <= 0 || !isFinite(priceToSalesRatio)) return null

    // Lower P/S ratios get higher scores
    // Normalize around typical P/S ranges (0.1-15)
    // Values under 2 are generally considered good value
    const normalizedPS = Math.max(0.1, Math.min(15, priceToSalesRatio))
    const score = Math.max(0, Math.min(1, 1 - ((normalizedPS - 0.1) / 14.9)))

    return score
  }

  // ==================== COMPOSITE CALCULATIONS ====================

  private calculateQualityComposite(fundamentalData?: FundamentalDataPoint): number | null {
    if (!fundamentalData) {
      console.warn('No fundamental data available for quality composite calculation')
      return null
    }

    console.log(`Calculating quality composite for data:`, {
      roe: fundamentalData.roe,
      debtToEquity: fundamentalData.debtToEquity,
      currentRatio: fundamentalData.currentRatio,
      operatingMargin: fundamentalData.operatingMargin,
      netProfitMargin: fundamentalData.netProfitMargin,
      grossProfitMargin: fundamentalData.grossProfitMargin
    })

    const factors: { name: string; value: number | null; weight: number }[] = [
      // ROE - Return on Equity (most important quality metric)
      { name: 'ROE', value: this.calculateROEScore(fundamentalData.roe), weight: 0.30 },

      // Debt management - critical for quality assessment
      { name: 'Debt/Equity', value: this.calculateDebtEquityScore(fundamentalData.debtToEquity), weight: 0.25 },

      // Liquidity and financial health
      { name: 'Current Ratio', value: this.calculateCurrentRatioScore(fundamentalData), weight: 0.20 },

      // Profitability margins - use both operating and gross margins with fallback
      { name: 'Operating Margin', value: this.calculateOperatingMarginScore(fundamentalData.operatingMargin), weight: 0.15 },
      { name: 'Gross Profit Margin', value: this.calculateOperatingMarginScore(fundamentalData.grossProfitMargin), weight: 0.10 }
    ]

    let totalWeightedScore = 0
    let totalWeight = 0
    let validFactors = 0

    factors.forEach(factor => {
      if (factor.value !== null && !isNaN(factor.value) && isFinite(factor.value)) {
        totalWeightedScore += factor.value * factor.weight
        totalWeight += factor.weight
        validFactors++
        console.log(`Quality factor ${factor.name}: ${factor.value.toFixed(3)} (weight: ${factor.weight})`)
      } else {
        console.log(`Quality factor ${factor.name}: No valid data (${factor.value})`)
      }
    })

    // Require at least 2 valid factors for quality assessment
    if (validFactors < 2) {
      console.warn(`Insufficient quality factors: only ${validFactors} valid factors found`)
      return null
    }

    const qualityScore = totalWeightedScore / totalWeight
    console.log(`Quality composite score: ${qualityScore.toFixed(3)} (based on ${validFactors} factors, ${totalWeight.toFixed(2)} total weight)`)

    return Math.max(0, Math.min(1, qualityScore))
  }

  private async calculateMomentumComposite(
    symbol: string,
    marketData: MarketDataPoint,
    technicalData?: TechnicalDataPoint
  ): Promise<number | null> {
    console.log(`Calculating momentum composite for ${symbol}`)

    const factors: { name: string; value: number | null; weight: number }[] = [
      // Short-term momentum (3 weeks)
      { name: '1-month momentum', value: await this.calculateMomentum(symbol, 21), weight: 0.25 },

      // Medium-term momentum (3 months)
      { name: '3-month momentum', value: await this.calculateMomentum(symbol, 63), weight: 0.30 },

      // Long-term momentum (6 months)
      { name: '6-month momentum', value: await this.calculateMomentum(symbol, 126), weight: 0.25 },

      // Technical momentum indicators
      { name: 'RSI', value: this.calculateRSIScore(technicalData?.rsi), weight: 0.10 },
      { name: 'MACD', value: this.calculateMACDScore(technicalData?.macd), weight: 0.10 }
    ]

    let totalWeightedScore = 0
    let totalWeight = 0

    for (const factor of factors) {
      if (factor.value !== null && !isNaN(factor.value)) {
        totalWeightedScore += factor.value * factor.weight
        totalWeight += factor.weight
        console.log(`Momentum factor ${factor.name}: ${factor.value.toFixed(3)} (weight: ${factor.weight})`)
      } else {
        console.log(`Momentum factor ${factor.name}: No data available`)
      }
    }

    if (totalWeight === 0) {
      console.warn(`No valid momentum factors found for ${symbol}`)
      return null
    }

    const momentumScore = totalWeightedScore / totalWeight
    console.log(`Momentum composite score for ${symbol}: ${momentumScore.toFixed(3)} (based on ${totalWeight.toFixed(2)} total weight)`)

    return Math.max(0, Math.min(1, momentumScore))
  }

  private calculateValueComposite(
    fundamentalData?: FundamentalDataPoint,
    marketData?: MarketDataPoint
  ): number | null {
    if (!fundamentalData) {
      console.warn('No fundamental data available for value composite calculation')
      return null
    }

    console.log(`Calculating value composite for data:`, {
      peRatio: fundamentalData.peRatio,
      pbRatio: fundamentalData.pbRatio,
      priceToSales: fundamentalData.priceToSales,
      evEbitda: fundamentalData.evEbitda,
      marketCap: marketData?.marketCap
    })

    const factors: { name: string; value: number | null; weight: number }[] = [
      // P/E Ratio - Most important valuation metric
      { name: 'P/E Ratio', value: this.calculatePEScore(fundamentalData.peRatio), weight: 0.35 },

      // P/B Ratio - Book value based valuation
      { name: 'P/B Ratio', value: this.calculatePBScore(fundamentalData.pbRatio), weight: 0.25 },

      // Price-to-Sales - Revenue based valuation (use correct property name)
      { name: 'P/S Ratio', value: this.calculatePriceToSalesDirectScore(fundamentalData.priceToSales), weight: 0.25 },

      // EV/EBITDA - Enterprise value metric
      { name: 'EV/EBITDA', value: this.calculateEVEBITDAScore(fundamentalData), weight: 0.15 }
    ]

    let totalWeightedScore = 0
    let totalWeight = 0
    let validFactors = 0

    factors.forEach(factor => {
      if (factor.value !== null && !isNaN(factor.value) && isFinite(factor.value)) {
        totalWeightedScore += factor.value * factor.weight
        totalWeight += factor.weight
        validFactors++
        console.log(`Value factor ${factor.name}: ${factor.value.toFixed(3)} (weight: ${factor.weight})`)
      } else {
        console.log(`Value factor ${factor.name}: No valid data (${factor.value})`)
      }
    })

    // Require at least 2 valid factors for value assessment
    if (validFactors < 2) {
      console.warn(`Insufficient value factors: only ${validFactors} valid factors found`)
      return null
    }

    const valueScore = totalWeightedScore / totalWeight
    console.log(`Value composite score: ${valueScore.toFixed(3)} (based on ${validFactors} factors, ${totalWeight.toFixed(2)} total weight)`)

    return Math.max(0, Math.min(1, valueScore))
  }

  /**
   * PHASE 1 CALIBRATION: Adjust factor weights based on market capitalization
   * Large caps benefit from fundamental analysis, small caps from technical momentum
   *
   * @param marketCap - Market capitalization in USD
   * @returns Adjustment multipliers for fundamental and technical weights
   */
  private adjustWeightsForMarketCap(marketCap: number): {
    fundamentalMultiplier: number
    technicalMultiplier: number
  } {
    // Market cap thresholds
    const MEGA_CAP = 200_000_000_000    // $200B+
    const LARGE_CAP = 10_000_000_000    // $10B+
    const MID_CAP = 2_000_000_000       // $2B+

    if (marketCap >= MEGA_CAP) {
      // Mega caps (AAPL, MSFT, GOOGL): Fundamentals matter more, technical less important
      // Fundamental: 35% → 42% (+20%) | Technical: 30% → 25.5% (-15%)
      return {
        fundamentalMultiplier: 1.20, // +20%
        technicalMultiplier: 0.85    // -15%
      }
    } else if (marketCap >= LARGE_CAP) {
      // Large caps: Moderate fundamental preference
      // Fundamental: 35% → 38.5% (+10%) | Technical: 30% → 27.6% (-8%)
      return {
        fundamentalMultiplier: 1.10, // +10%
        technicalMultiplier: 0.92    // -8%
      }
    } else if (marketCap >= MID_CAP) {
      // Mid caps: Balanced - no adjustments
      return {
        fundamentalMultiplier: 1.00,
        technicalMultiplier: 1.00
      }
    } else {
      // Small caps: Technical momentum matters more
      // Fundamental: 35% → 31.5% (-10%) | Technical: 30% → 33.0% (+10%)
      return {
        fundamentalMultiplier: 0.90, // -10%
        technicalMultiplier: 1.10    // +10%
      }
    }
  }

  /**
   * Main composite algorithm with real factor calculations and proper utilization tracking
   * Returns calculated score based on actual data analysis
   * INCLUDES ALL REQUIRED COMPONENTS with mathematically sound weight allocation totaling 100%
   */
  private async calculateMainComposite(
    symbol: string,
    marketData: MarketDataPoint,
    fundamentalData?: FundamentalDataPoint,
    technicalData?: TechnicalDataPoint,
    sentimentScore?: number,
    esgScore?: number,
    macroeconomicContext?: any,
    shortInterestData?: any,
    extendedMarketData?: any
  ): Promise<number> {
    console.log(`🎯 Calculating MAIN composite score for ${symbol} with ALL required components`)

    let totalScore = 0
    let totalWeight = 0
    const factorContributions: string[] = []

    // ==================== PHASE 2 CALIBRATION: ANALYST-ALIGNED WEIGHT ALLOCATION (Total: 100%) ====================
    // Rebalanced weights to align with analyst consensus for growth stocks with elevated valuations
    // Technical: 30.0% → 28.0% (-2.0pp) | Fundamental: 35.0% → 28.0% (-7.0pp)
    // Sentiment: 10.0% → 18.0% (+8.0pp) | Macroeconomic: 20.0% → 20.0% (unchanged)
    // Alternative: 5.0% → 6.0% (+1.0pp) - Increased options weight for tech stocks

    // Market-cap-aware weight adjustments
    // Validate: reject 0 or invalid market caps, use mid-cap as default
    const marketCap = marketData?.marketCap && marketData.marketCap > 1_000_000
      ? marketData.marketCap
      : 5_000_000_000 // Default to $5B mid-cap if missing
    const { fundamentalMultiplier, technicalMultiplier } = this.adjustWeightsForMarketCap(marketCap)

    // Calculate adjusted weights with new base allocations
    const baseTechnicalWeight = 0.280
    const baseFundamentalWeight = 0.280
    const technicalWeight = baseTechnicalWeight * technicalMultiplier
    const fundamentalWeight = baseFundamentalWeight * fundamentalMultiplier

    // Normalize to maintain 100% total (adjust remaining weights proportionally)
    const baseWeightsSum = technicalWeight + fundamentalWeight + 0.200 + 0.180 + 0.060 // Include macro, sentiment, alternative
    const normalizationFactor = 1.000 / baseWeightsSum
    const adjustedTechnicalWeight = technicalWeight * normalizationFactor
    const adjustedFundamentalWeight = fundamentalWeight * normalizationFactor
    const adjustedMacroWeight = 0.200 * normalizationFactor
    const adjustedSentimentWeight = 0.180 * normalizationFactor
    const adjustedAlternativeWeight = 0.060 * normalizationFactor

    console.log(`📊 PHASE 2 CALIBRATION: Adjusted weights for ${symbol} ($${(marketCap / 1e9).toFixed(1)}B market cap):`)
    console.log(`   Technical: ${(adjustedTechnicalWeight * 100).toFixed(1)}% (base 28.0%, multiplier ${technicalMultiplier.toFixed(2)})`)
    console.log(`   Fundamental: ${(adjustedFundamentalWeight * 100).toFixed(1)}% (base 28.0%, multiplier ${fundamentalMultiplier.toFixed(2)})`)

    // Technical Analysis composite - Apply adjusted weight
    const technicalScore = await this.calculateTechnicalOverallScore(symbol)
    if (technicalScore !== null) {
      console.log(`Technical Analysis: ${technicalScore.toFixed(3)} (weight: ${(adjustedTechnicalWeight * 100).toFixed(1)}%) ⚡`)
      totalScore += technicalScore * adjustedTechnicalWeight
      totalWeight += adjustedTechnicalWeight
      factorContributions.push('technicalAnalysis', 'technical_overall_score')
    } else {
      console.log('Technical Analysis: No data (fallback to neutral 0.5)')
      totalScore += 0.5 * adjustedTechnicalWeight
      totalWeight += adjustedTechnicalWeight
    }

    // Fundamental Analysis composite - Apply adjusted weight
    const fundamentalScore = this.calculateQualityComposite(fundamentalData)
    if (fundamentalScore !== null) {
      console.log(`Fundamental Analysis: ${fundamentalScore.toFixed(3)} (weight: ${(adjustedFundamentalWeight * 100).toFixed(1)}%) 💎`)
      totalScore += fundamentalScore * adjustedFundamentalWeight
      totalWeight += adjustedFundamentalWeight
      factorContributions.push('fundamentalData', 'quality_composite')
    } else {
      console.log('Fundamental Analysis: No data (fallback to neutral 0.5)')
      totalScore += 0.5 * adjustedFundamentalWeight
      totalWeight += adjustedFundamentalWeight
    }

    // 🆕 MACROECONOMIC ANALYSIS (weight: 20.0%) - Apply normalized weight
    const macroScore = this.calculateMacroeconomicComposite(macroeconomicContext)
    if (macroScore !== null) {
      console.log(`🌍 Macroeconomic Analysis: ${macroScore.toFixed(3)} (weight: ${(adjustedMacroWeight * 100).toFixed(1)}%)`)
      totalScore += macroScore * adjustedMacroWeight
      totalWeight += adjustedMacroWeight
      factorContributions.push('macroeconomicAnalysis', 'macroeconomic_composite')
    } else {
      console.log('🌍 Macroeconomic Analysis: No data (fallback to neutral 0.5)')
      totalScore += 0.5 * adjustedMacroWeight
      totalWeight += adjustedMacroWeight
    }

    // 🆕 SENTIMENT ANALYSIS (weight: 10.0%) - Apply normalized weight
    if (sentimentScore !== undefined && sentimentScore !== null) {
      console.log(`📰 Sentiment Analysis: ${sentimentScore.toFixed(3)} (weight: ${(adjustedSentimentWeight * 100).toFixed(1)}%)`)
      totalScore += sentimentScore * adjustedSentimentWeight
      totalWeight += adjustedSentimentWeight
      factorContributions.push('sentimentAnalysis', 'sentiment_composite')
    } else {
      console.log('📰 Sentiment Analysis: No data (fallback to neutral 0.5)')
      totalScore += 0.5 * adjustedSentimentWeight
      totalWeight += adjustedSentimentWeight
    }

    // Alternative Data composite (weight: 6.0%) - Combined ESG, options, short interest, extended market
    // Options Analysis (2.5% of 6% alternative - increased for tech stocks)
    const optionsScore = this.calculateOptionsScore(technicalData?.optionsData)
    if (optionsScore !== null && technicalData?.optionsData) {
      console.log(`📊 Options Analysis: ${optionsScore.toFixed(3)} (weight: 2.5%)`)
      totalScore += optionsScore * 0.025
      totalWeight += 0.025
      factorContributions.push('optionsAnalysis', 'options_composite')
    } else {
      console.log('📊 Options Analysis: No data (fallback to neutral 0.5)')
      totalScore += 0.5 * 0.025
      totalWeight += 0.025
    }

    // ESG Analysis (1.5% of 6% alternative - unchanged)
    if (esgScore !== undefined && esgScore !== null) {
      console.log(`🌱 ESG Analysis: ${esgScore.toFixed(3)} (weight: 1.5%)`)
      totalScore += esgScore * 0.015
      totalWeight += 0.015
      factorContributions.push('esgAnalysis', 'esg_composite')
    } else {
      console.log('🌱 ESG Analysis: No data (fallback to neutral 0.6 - industry baseline)')
      totalScore += 0.6 * 0.015
      totalWeight += 0.015
    }

    // Short Interest Analysis (1.5% of 6% alternative - increased)
    const shortInterestScore = await this.calculateShortInterestComposite(symbol)
    if (shortInterestScore !== null) {
      console.log(`📊 Short Interest Analysis: ${shortInterestScore.toFixed(3)} (weight: 1.5%)`)
      totalScore += shortInterestScore * 0.015
      totalWeight += 0.015
      factorContributions.push('shortInterestAnalysis', 'short_interest_composite')
    } else {
      console.log('📊 Short Interest Analysis: No data (fallback to neutral 0.5)')
      totalScore += 0.5 * 0.015
      totalWeight += 0.015
    }

    // Extended Market Data Analysis (0.5% of 6% alternative - unchanged)
    const extendedMarketScore = await this.calculateExtendedMarketComposite(symbol)
    if (extendedMarketScore !== null) {
      console.log(`💹 Extended Market Data: ${extendedMarketScore.toFixed(3)} (weight: 0.5%)`)
      totalScore += extendedMarketScore * 0.005
      totalWeight += 0.005
      factorContributions.push('extendedMarketData', 'extended_market_composite')
    } else {
      console.log('💹 Extended Market Data: No data (fallback to neutral 0.5)')
      totalScore += 0.5 * 0.005
      totalWeight += 0.005
    }

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0.5

    console.log(`🎯 PHASE 2 CALIBRATION - Main composite calculation for ${symbol}:`)
    console.log(`   Final weighted score: ${finalScore.toFixed(4)}`)
    console.log(`   🔍 DEBUG totalScore: ${totalScore.toFixed(4)}, totalWeight: ${totalWeight.toFixed(4)}`)
    console.log(`   Weight Allocation: Technical(28.0%) + Fundamental(28.0%) + Macroeconomic(20.0%) + Sentiment(18.0%) + Alternative(6.0% = Options 2.5% + ESG 1.5% + Short Interest 1.5% + Extended Market 0.5%) = 100.0%`)
    console.log(`   ✅ WEIGHT VERIFICATION: Total weights = ${totalWeight.toFixed(3)} (target: 1.000)`)
    console.log(`   Contributing factors: [${factorContributions.join(', ')}]`)

    // Store factor contributions for utilization tracking with performance optimization
    this.factorCache.set(`${symbol}_composite_factors`, {
      value: finalScore,
      timestamp: Date.now(),
      factors: factorContributions
    } as any)

    // ✅ PERFORMANCE FIX: Also cache individual technical and options scores for direct tracking
    if (technicalScore !== null) {
      this.factorCache.set(`technical_overall_score_${symbol}_${Math.floor(Date.now() / 60000)}`, {
        value: technicalScore,
        timestamp: Date.now()
      })
    }

    if (optionsScore !== null) {
      this.factorCache.set(`options_composite_${symbol}_${Math.floor(Date.now() / 60000)}`, {
        value: optionsScore,
        timestamp: Date.now()
      })
    }

    const clampedScore = Math.max(0, Math.min(1, finalScore))
    console.log(`   🔍 DEBUG: Returning clamped score: ${clampedScore.toFixed(4)} (original: ${finalScore.toFixed(4)})`)
    console.log(`✅ FactorLibrary: Composite score = ${clampedScore.toFixed(4)} (0-1 scale) for ${symbol}`)

    // 🚨 VALIDATION: Ensure score is in 0-1 range (KISS architecture enforcement)
    if (clampedScore < 0 || clampedScore > 1 || isNaN(clampedScore)) {
      console.error(`❌ VALIDATION FAILED: Score ${clampedScore} is outside 0-1 range for ${symbol}!`)
      throw new Error(`FactorLibrary returned invalid score: ${clampedScore} (must be 0-1)`)
    }

    return clampedScore
  }

  // ==================== ESG FACTOR CALCULATIONS ====================

  /**
   * Calculate ESG composite score combining E, S, G factors
   */
  private async calculateESGComposite(symbol: string, sector: string): Promise<number> {
    try {
      if (!this.esgService) {
        console.warn('ESG service not available for composite calculation')
        return 0.6 // Industry baseline
      }

      const esgImpact = await this.esgService.getESGImpactForStock(symbol, sector, 0.5)
      if (esgImpact && esgImpact.esgScore > 0) {
        // Convert ESG score (0-100) to factor score (0-1)
        return esgImpact.esgScore / 100
      }

      return 0.6 // Industry baseline fallback
    } catch (error) {
      console.warn(`ESG composite calculation failed for ${symbol}:`, error)
      return 0.6 // Industry baseline fallback
    }
  }

  /**
   * Calculate individual ESG factor (Environmental, Social, or Governance)
   */
  private async calculateESGFactor(symbol: string, sector: string, factor: 'environmental' | 'social' | 'governance'): Promise<number> {
    try {
      if (!this.esgService) {
        console.warn(`ESG service not available for ${factor} factor`)
        return 0.6 // Industry baseline
      }

      const esgScore = await this.esgService.getESGScore(symbol, sector)
      if (esgScore) {
        switch (factor) {
          case 'environmental':
            return esgScore.environmental / 100
          case 'social':
            return esgScore.social / 100
          case 'governance':
            return esgScore.governance / 100
          default:
            return 0.6
        }
      }

      return 0.6 // Industry baseline fallback
    } catch (error) {
      console.warn(`ESG ${factor} factor calculation failed for ${symbol}:`, error)
      return 0.6 // Industry baseline fallback
    }
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
    try {
      console.log(`Fetching ${periods} days of historical data for ${symbol}`)

      // Get historical OHLC data from TwelveDataAPI
      const historicalData = await this.twelveDataAPI.getHistoricalOHLC(symbol, periods)

      if (!historicalData || historicalData.length === 0) {
        console.warn(`No historical data available for ${symbol}`)
        return []
      }

      // Convert HistoricalOHLC to our HistoricalPrice format
      const convertedData: HistoricalPrice[] = historicalData.map(ohlc => ({
        timestamp: ohlc.timestamp,
        open: ohlc.open,
        high: ohlc.high,
        low: ohlc.low,
        close: ohlc.close,
        volume: ohlc.volume
      }))

      // Sort by timestamp descending (most recent first) for momentum calculations
      convertedData.sort((a, b) => b.timestamp - a.timestamp)

      console.log(`Successfully fetched ${convertedData.length} historical price points for ${symbol}`)
      return convertedData

    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error)
      return []
    }
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

      // Enhanced Service Integration Factors
      'vwap_deviation_score', 'vwap_trading_signals',
      'macroeconomic_sector_impact', 'macroeconomic_composite',

      // Volatility
      'volatility_30d', 'volatility_ratio', 'beta',

      // Dividend
      'dividend_yield', 'dividend_growth', 'payout_ratio',

      // Composite
      'composite', 'quality_composite', 'momentum_composite', 'value_composite',

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

  // ==================== ENHANCED SERVICE INTEGRATION CALCULATIONS ====================

  /**
   * Calculate VWAP deviation score using pre-fetched VWAPService data
   * This replaces the old calculateVWAPPosition method with direct service integration
   */
  private calculateVWAPDeviationScore(vwapAnalysis?: any): number | null {
    console.log('📊 Calculating VWAP deviation score from pre-fetched data...')

    if (!vwapAnalysis) {
      console.warn('📊 No VWAP analysis data provided - using fallback')
      return null
    }

    try {
      const deviationPercent = Math.abs(vwapAnalysis.deviationPercent)

      // Convert VWAP deviation to 0-1 score
      // Higher deviation = more trading opportunity (higher score)
      if (deviationPercent > 3.0) return 0.9 // Strong deviation
      if (deviationPercent > 1.5) return 0.7 // Moderate deviation
      if (deviationPercent > 0.5) return 0.5 // Mild deviation
      return 0.3 // Close to VWAP

    } catch (error) {
      console.error('📊 Error calculating VWAP deviation score:', error)
      return null
    }
  }

  /**
   * Calculate VWAP trading signals score using pre-fetched VWAPService data
   */
  private calculateVWAPTradingSignals(vwapAnalysis?: any): number | null {
    console.log('📊 Calculating VWAP trading signals from pre-fetched data...')

    if (!vwapAnalysis) {
      console.warn('📊 No VWAP analysis data provided - using fallback')
      return null
    }

    try {
      const { signal, strength } = vwapAnalysis

      let score = 0.5 // Neutral baseline

      // Signal direction scoring
      if (signal === 'above') {
        score = 0.7 // Price above VWAP is generally bullish
      } else if (signal === 'below') {
        score = 0.3 // Price below VWAP is generally bearish
      }

      // Strength adjustment
      const strengthMultiplier =
        strength === 'strong' ? 1.2 :
        strength === 'moderate' ? 1.0 : 0.8

      score *= strengthMultiplier

      console.log(`📊 VWAP trading signal: ${signal} with ${strength} strength = ${score.toFixed(3)}`)
      return Math.max(0, Math.min(1, score))

    } catch (error) {
      console.error('📊 Error calculating VWAP trading signals:', error)
      return null
    }
  }

  /**
   * Calculate VWAP trend score using historical trend analysis
   * Integrates multi-timeframe VWAP trends into scoring system
   */
  private async calculateVWAPTrendScore(symbol: string, vwapAnalysis?: any): Promise<number | null> {
    console.log('📊 Calculating VWAP trend score with historical analysis...')

    if (!this.vwapService) {
      console.warn('📊 VWAPService not available - skipping trend analysis')
      return null
    }

    try {
      // Get historical VWAP trend insights
      const trendInsights = await this.vwapService.getVWAPTrendInsights(symbol)

      if (!trendInsights) {
        console.warn(`📊 No VWAP trend insights available for ${symbol} - using fallback`)
        return this.calculateVWAPTradingSignals(vwapAnalysis) // Fallback to current analysis
      }

      // Base score from multi-timeframe trend analysis
      let trendScore = trendInsights.trendScore

      // Normalize trend score from [-1, 1] to [0, 1] for consistency
      const normalizedTrendScore = (trendScore + 1) / 2

      // Weight the trend score based on confidence
      const confidenceWeight = trendInsights.currentTrend.confidence
      const weightedScore = (normalizedTrendScore * confidenceWeight) + (0.5 * (1 - confidenceWeight))

      // Apply convergence bonus/penalty
      if (trendInsights.trendConvergence === 'bullish') {
        return Math.min(weightedScore + 0.1, 1.0)
      } else if (trendInsights.trendConvergence === 'bearish') {
        return Math.max(weightedScore - 0.1, 0.0)
      }

      console.log(`📊 VWAP trend analysis for ${symbol}: trend=${trendScore.toFixed(3)}, confidence=${confidenceWeight.toFixed(3)}, final=${weightedScore.toFixed(3)}`)
      return weightedScore

    } catch (error) {
      console.error(`📊 Error calculating VWAP trend score for ${symbol}:`, error)
      // Fallback to current VWAP analysis if trend analysis fails
      return this.calculateVWAPTradingSignals(vwapAnalysis)
    }
  }

  /**
   * Calculate macroeconomic sector impact using pre-fetched MacroeconomicAnalysisService data
   */
  private calculateMacroeconomicSectorImpact(macroContext?: any, sector?: string): number | null {
    console.log('🌍 Calculating macroeconomic sector impact from pre-fetched data...')

    if (!macroContext || !sector) {
      console.warn('🌍 No macroeconomic context or sector provided - using fallback')
      return null
    }

    try {
      const { sectorImpact, impact } = macroContext

      // Use the macro impact score directly
      let score = 0.5 // Neutral baseline

      if (impact === 'positive') {
        score = 0.8
      } else if (impact === 'negative') {
        score = 0.2
      }

      // Apply sector-specific adjustment if available
      if (sectorImpact && typeof sectorImpact === 'number') {
        score = (score + sectorImpact) / 2
      }

      console.log(`🌍 Macro sector impact for ${sector}: ${impact} = ${score.toFixed(3)}`)
      return Math.max(0, Math.min(1, score))

    } catch (error) {
      console.error('🌍 Error calculating macroeconomic sector impact:', error)
      return null
    }
  }

  /**
   * Calculate macroeconomic composite score using pre-fetched MacroeconomicAnalysisService data
   */
  private calculateMacroeconomicComposite(macroContext?: any): number | null {
    console.log('🌍 Calculating macroeconomic composite from pre-fetched data...')

    if (!macroContext) {
      console.warn('🌍 No macroeconomic context provided - using fallback')
      return null
    }

    try {
      const { macroScore, adjustedScore, confidence } = macroContext

      // BUG FIX: Both adjustedScore and macroScore are on 0-10 scale from MacroeconomicAnalysisService
      // Always normalize to 0-1 scale before use
      let score = (adjustedScore || macroScore || 5.0) / 10

      // Apply confidence weighting
      if (confidence && confidence < 0.7) {
        score = (score + 0.5) / 2 // Blend with neutral when confidence is low
      }

      console.log(`🌍 Macroeconomic composite score: ${score.toFixed(3)} (confidence: ${confidence || 'unknown'})`)
      return Math.max(0, Math.min(1, score))

    } catch (error) {
      console.error('🌍 Error calculating macroeconomic composite:', error)
      return null
    }
  }

  // ==================== SHORT INTEREST CALCULATIONS ====================

  /**
   * Calculate Short Interest composite score
   */
  private async calculateShortInterestComposite(symbol: string, technicalData?: TechnicalDataPoint): Promise<number> {
    try {
      // 🆕 USE PRE-FETCHED DATA FIRST - Check if short interest data was pre-fetched
      if (technicalData?.shortInterestData) {
        const shortInterestImpact = technicalData.shortInterestData
        console.log(`📊 Using pre-fetched short interest data for ${symbol}: score ${shortInterestImpact.score}`)
        return shortInterestImpact.score || 0.5
      }

      // Fallback to service if no pre-fetched data
      if (!this.shortInterestService) {
        console.warn('Short Interest service not available')
        return 0.5 // Neutral fallback
      }

      // Use default sector since we may not have sector data in all contexts
      const shortInterestData = await this.shortInterestService.getShortInterestData(symbol, 'unknown')
      if (shortInterestData && shortInterestData.shortInterestRatio > 0) {
        // Convert short interest ratio to score (higher ratio = higher squeeze potential = higher score)
        // Typical short interest ratios: 1-5% = low, 5-15% = medium, 15%+ = high squeeze potential
        const normalizedRatio = Math.min(25, shortInterestData.shortInterestRatio) / 25
        return normalizedRatio
      }

      return 0.5 // Neutral fallback
    } catch (error) {
      console.warn(`Short Interest composite calculation failed for ${symbol}:`, error)
      return 0.5 // Neutral fallback
    }
  }

  /**
   * Calculate Short Squeeze potential score
   */
  private async calculateShortSqueezePotential(symbol: string): Promise<number> {
    try {
      if (!this.shortInterestService) {
        console.warn('Short Interest service not available for squeeze potential')
        return 0.5 // Neutral fallback
      }

      const shortInterestData = await this.shortInterestService.getShortInterestData(symbol, 'unknown')
      if (shortInterestData) {
        // Score based on multiple factors: short interest ratio, days to cover
        let squeezeScore = 0

        // Short interest ratio component (50% weight)
        if (shortInterestData.shortInterestRatio > 15) squeezeScore += 0.5
        else if (shortInterestData.shortInterestRatio > 5) squeezeScore += 0.3
        else squeezeScore += 0.1

        // Days to cover component (30% weight) - higher days to cover = higher squeeze potential
        if (shortInterestData.daysTooCover > 7) {
          squeezeScore += 0.3
        } else if (shortInterestData.daysTooCover > 3) {
          squeezeScore += 0.15
        }

        // Month-over-month change component (20% weight)
        if (shortInterestData.percentageChange > 10) {
          squeezeScore += 0.2 // Increasing short interest
        } else if (shortInterestData.percentageChange > 0) {
          squeezeScore += 0.1
        }

        return Math.min(1.0, squeezeScore)
      }

      return 0.5 // Neutral fallback
    } catch (error) {
      console.warn(`Short squeeze potential calculation failed for ${symbol}:`, error)
      return 0.5 // Neutral fallback
    }
  }

  // ==================== EXTENDED MARKET DATA CALCULATIONS ====================

  /**
   * Calculate Extended Market Data composite score
   */
  private async calculateExtendedMarketComposite(symbol: string, technicalData?: TechnicalDataPoint): Promise<number> {
    try {
      // 🆕 USE PRE-FETCHED DATA FIRST - Check if extended market data was pre-fetched
      if (technicalData?.extendedMarketData) {
        const extendedData = technicalData.extendedMarketData
        console.log(`💹 Using pre-fetched extended market data for ${symbol}: status ${extendedData.extendedHours?.marketStatus || 'N/A'}`)

        // Calculate score based on available extended market data
        let compositeScore = 0.5 // Base score

        // Market status scoring (30% weight)
        if (extendedData.extendedHours?.marketStatus) {
          const statusScore = extendedData.extendedHours.marketStatus === 'market-hours' ? 0.8 : 0.6
          compositeScore += (statusScore - 0.5) * 0.3
        }

        // Liquidity metrics scoring (40% weight)
        if (extendedData.liquidityMetrics?.liquidityScore > 0) {
          const liquidityScore = extendedData.liquidityMetrics.liquidityScore / 10
          compositeScore += (liquidityScore - 0.5) * 0.4
        }

        // Bid-ask spread scoring (30% weight)
        if (extendedData.bidAskSpread?.spreadPercent > 0) {
          const efficiencyScore = Math.max(0, 1 - (extendedData.bidAskSpread.spreadPercent / 5))
          compositeScore += (efficiencyScore - 0.5) * 0.3
        }

        return Math.max(0.2, Math.min(1, compositeScore))
      }

      // Fallback to service if no pre-fetched data
      if (!this.extendedMarketService) {
        console.warn('Extended Market Data service not available')
        return 0.5 // Neutral fallback
      }

      const [liquidityMetrics, bidAskSpread] = await Promise.all([
        // Use batch method for single symbol
        this.extendedMarketService.getBatchLiquidityMetrics([symbol]).then(map => map.get(symbol)),
        this.extendedMarketService.getBidAskSpread(symbol)
      ])

      let compositeScore = 0.0 // Start with 0 and build up

      // Liquidity score component (60% weight)
      if (liquidityMetrics && liquidityMetrics.liquidityScore > 0) {
        compositeScore += (liquidityMetrics.liquidityScore / 10) * 0.6
      } else {
        compositeScore += 0.5 * 0.6 // Neutral contribution
      }

      // Bid-ask efficiency component (40% weight)
      if (bidAskSpread && bidAskSpread.spreadPercent > 0) {
        // Lower spread percentage = better efficiency = higher score
        const efficiencyScore = Math.max(0, 1 - (bidAskSpread.spreadPercent / 5)) // Normalize 0-5% spread to 0-1 score
        compositeScore += efficiencyScore * 0.4
      } else {
        compositeScore += 0.5 * 0.4 // Neutral contribution
      }

      return Math.max(0, Math.min(1, compositeScore))
    } catch (error) {
      console.warn(`Extended Market Data composite calculation failed for ${symbol}:`, error)
      return 0.5 // Neutral fallback
    }
  }

  /**
   * Calculate liquidity score
   */
  private async calculateLiquidityScore(symbol: string): Promise<number> {
    try {
      if (!this.extendedMarketService) {
        console.warn('Extended Market Data service not available for liquidity score')
        return 0.5 // Neutral fallback
      }

      const liquidityMap = await this.extendedMarketService.getBatchLiquidityMetrics([symbol])
      const liquidityMetrics = liquidityMap.get(symbol)

      if (liquidityMetrics && liquidityMetrics.liquidityScore > 0) {
        // Convert 0-10 scale to 0-1 scale
        return liquidityMetrics.liquidityScore / 10
      }

      return 0.5 // Neutral fallback
    } catch (error) {
      console.warn(`Liquidity score calculation failed for ${symbol}:`, error)
      return 0.5 // Neutral fallback
    }
  }

  /**
   * Calculate bid-ask efficiency score
   */
  private async calculateBidAskEfficiency(symbol: string): Promise<number> {
    try {
      if (!this.extendedMarketService) {
        console.warn('Extended Market Data service not available for bid-ask efficiency')
        return 0.5 // Neutral fallback
      }

      const bidAskSpread = await this.extendedMarketService.getBidAskSpread(symbol)
      if (bidAskSpread && bidAskSpread.spreadPercent > 0) {
        // Lower spread percentage = better efficiency = higher score
        // Typical spreads: 0.01-0.05% = excellent, 0.05-0.5% = good, 0.5-2% = fair, >2% = poor
        const spreadPercent = bidAskSpread.spreadPercent

        if (spreadPercent <= 0.05) return 0.9 // Excellent efficiency
        if (spreadPercent <= 0.5) return 0.7   // Good efficiency
        if (spreadPercent <= 2.0) return 0.5   // Fair efficiency
        return 0.3 // Poor efficiency
      }

      return 0.5 // Neutral fallback
    } catch (error) {
      console.warn(`Bid-ask efficiency calculation failed for ${symbol}:`, error)
      return 0.5 // Neutral fallback
    }
  }
}