/**
 * Early Signal Feature Extractor
 *
 * Task 1.3: Create Feature Extractor Service
 * Purpose: Extract 13 features from historical data for ML model
 * Estimated Time: 3 hours
 *
 * Reuses existing VFR services:
 * - FinancialDataService for historical price data
 * - SentimentAnalysisService for sentiment data
 * - TechnicalIndicatorService for technical indicators
 */

import { FinancialDataService } from '../../financial-data/FinancialDataService'
import { SentimentAnalysisService } from '../../financial-data/SentimentAnalysisService'
import { TechnicalIndicatorService } from '../../technical-analysis/TechnicalIndicatorService'
import { RedisCache } from '../../cache/RedisCache'
import type { FeatureVector, OHLC, SentimentData, FundamentalsData, TechnicalData } from './types'

export class EarlySignalFeatureExtractor {
  private financialDataService: FinancialDataService
  private sentimentService: SentimentAnalysisService
  private technicalService: TechnicalIndicatorService
  private cache: RedisCache

  constructor() {
    this.financialDataService = new FinancialDataService()
    this.cache = new RedisCache()
    this.sentimentService = new SentimentAnalysisService(this.cache)
    this.technicalService = new TechnicalIndicatorService(this.cache)
  }

  /**
   * Extract all 13 features for ML model prediction
   * @param symbol Stock symbol (e.g., 'TSLA')
   * @param asOfDate Historical date for feature extraction (default: today)
   * @returns Feature vector with 13 numeric features
   */
  async extractFeatures(symbol: string, asOfDate?: Date): Promise<FeatureVector> {
    const date = asOfDate || new Date()
    const startTime = Date.now()

    try {
      // Parallel data collection (leverage existing VFR services)
      const [historicalData, sentimentData, fundamentals, technicals] = await Promise.all([
        this.getHistoricalData(symbol, date, 50), // 50 days for 20d momentum
        this.getSentimentData(symbol, date),
        this.getFundamentalsData(symbol, date),
        this.getTechnicalData(symbol, date)
      ])

      const features: FeatureVector = {
        // Momentum features (3)
        price_change_5d: this.calculateMomentum(historicalData, 5),
        price_change_10d: this.calculateMomentum(historicalData, 10),
        price_change_20d: this.calculateMomentum(historicalData, 20),

        // Volume features (2)
        volume_ratio: this.calculateVolumeRatio(historicalData, 5, 20),
        volume_trend: this.calculateVolumeTrend(historicalData, 10),

        // Sentiment delta features (3)
        sentiment_news_delta: sentimentData?.newsScore || 0,
        sentiment_reddit_accel: sentimentData?.redditScore || 0,
        sentiment_options_shift: sentimentData?.optionsScore || 0,

        // Fundamental features (3)
        earnings_surprise: fundamentals?.earningsSurprise || 0,
        revenue_growth_accel: fundamentals?.revenueGrowthAccel || 0,
        analyst_coverage_change: fundamentals?.analystCoverageChange || 0,

        // Technical features (2)
        rsi_momentum: technicals?.rsiMomentum || 0,
        macd_histogram_trend: technicals?.macdHistogramTrend || 0
      }

      const duration = Date.now() - startTime
      console.log(`Feature extraction for ${symbol} completed in ${duration}ms`)

      return features
    } catch (error) {
      console.error(`Failed to extract features for ${symbol}:`, error)
      // Return neutral features on error
      return this.getNeutralFeatures()
    }
  }

  /**
   * Get historical OHLC data for the symbol at a specific date
   */
  private async getHistoricalData(symbol: string, asOfDate: Date, days: number): Promise<OHLC[]> {
    try {
      const historicalData = await this.financialDataService.getHistoricalOHLC(symbol, days, asOfDate)

      if (!historicalData || historicalData.length === 0) {
        console.warn(`No historical data available for ${symbol} as of ${asOfDate.toISOString().split('T')[0]}`)
        return []
      }

      // Convert to OHLC format and sort chronologically (oldest first)
      return historicalData
        .map(bar => ({
          date: new Date(bar.date),
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime())
    } catch (error) {
      console.error(`Failed to get historical data for ${symbol} as of ${asOfDate.toISOString().split('T')[0]}:`, error)
      return []
    }
  }

  /**
   * Get sentiment data for the symbol
   */
  private async getSentimentData(symbol: string, asOfDate: Date): Promise<SentimentData | null> {
    try {
      // Get current sentiment
      const sentiment = await this.sentimentService.analyzeStockSentimentImpact(symbol, 'Technology', 0.5)

      if (!sentiment) {
        return null
      }

      return {
        symbol,
        date: asOfDate,
        newsScore: sentiment.sentimentScore?.components?.news || 0,
        redditScore: sentiment.sentimentScore?.components?.reddit || 0,
        optionsScore: sentiment.sentimentScore?.components?.options || 0,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error(`Failed to get sentiment data for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get fundamental data for the symbol
   */
  private async getFundamentalsData(symbol: string, asOfDate: Date): Promise<FundamentalsData | null> {
    try {
      const companyInfo = await this.financialDataService.getCompanyInfo(symbol)

      if (!companyInfo) {
        return null
      }

      // Extract fundamental metrics
      return {
        symbol,
        earningsSurprise: null, // TODO: Extract from earnings data
        revenueGrowthAccel: null, // TODO: Calculate from financial statements
        analystCoverageChange: null // TODO: Track analyst coverage changes
      }
    } catch (error) {
      console.error(`Failed to get fundamentals for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get technical indicator data for the symbol
   */
  private async getTechnicalData(symbol: string, asOfDate: Date): Promise<TechnicalData | null> {
    try {
      const historicalData = await this.getHistoricalData(symbol, asOfDate, 50)

      if (historicalData.length < 20) {
        return null
      }

      const technicalResult = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData: historicalData.map(d => ({
          timestamp: d.date.getTime(),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume
        }))
      })

      // Extract RSI momentum and MACD histogram trend
      const rsi = technicalResult.momentum?.indicators?.rsi?.value || 50
      const rsiAvg = 50 // TODO: Calculate 14-day average RSI
      const rsiMomentum = rsi - rsiAvg

      const macdHistogram = technicalResult.trend?.indicators?.macd?.histogram || 0
      const macdHistogramTrend = macdHistogram // TODO: Calculate 5-day slope

      return {
        symbol,
        rsiMomentum,
        macdHistogramTrend
      }
    } catch (error) {
      console.error(`Failed to get technical data for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate price momentum over N days
   */
  private calculateMomentum(data: OHLC[], days: number): number {
    if (data.length < days) {
      return 0
    }

    const currentPrice = data[0].close
    const pastPrice = data[days - 1].close

    if (pastPrice === 0) {
      return 0
    }

    return (currentPrice - pastPrice) / pastPrice
  }

  /**
   * Calculate volume ratio (short-term vs long-term average)
   */
  private calculateVolumeRatio(data: OHLC[], shortWindow: number, longWindow: number): number {
    if (data.length < longWindow) {
      return 1.0
    }

    const avgShort = this.calculateAverageVolume(data.slice(0, shortWindow))
    const avgLong = this.calculateAverageVolume(data.slice(0, longWindow))

    if (avgLong === 0) {
      return 1.0
    }

    return avgShort / avgLong
  }

  /**
   * Calculate volume trend using linear regression
   */
  private calculateVolumeTrend(data: OHLC[], window: number): number {
    if (data.length < window) {
      return 0
    }

    const volumes = data.slice(0, window).map(d => d.volume)
    return this.linearRegressionSlope(volumes)
  }

  /**
   * Calculate average volume
   */
  private calculateAverageVolume(data: OHLC[]): number {
    if (data.length === 0) {
      return 0
    }

    const sum = data.reduce((total, d) => total + d.volume, 0)
    return sum / data.length
  }

  /**
   * Calculate linear regression slope
   */
  private linearRegressionSlope(values: number[]): number {
    const n = values.length
    if (n < 2) {
      return 0
    }

    const sumX = (n * (n - 1)) / 2
    const sumY = values.reduce((a, b) => a + b, 0)
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6

    const denominator = n * sumX2 - sumX * sumX
    if (denominator === 0) {
      return 0
    }

    return (n * sumXY - sumX * sumY) / denominator
  }

  /**
   * Return neutral feature vector (all zeros)
   */
  private getNeutralFeatures(): FeatureVector {
    return {
      price_change_5d: 0,
      price_change_10d: 0,
      price_change_20d: 0,
      volume_ratio: 1.0,
      volume_trend: 0,
      sentiment_news_delta: 0,
      sentiment_reddit_accel: 0,
      sentiment_options_shift: 0,
      earnings_surprise: 0,
      revenue_growth_accel: 0,
      analyst_coverage_change: 0,
      rsi_momentum: 0,
      macd_histogram_trend: 0
    }
  }
}
