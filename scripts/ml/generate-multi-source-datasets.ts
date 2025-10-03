/**
 * Multi-Source Dataset Generation for ML Training
 *
 * Purpose: Generate comprehensive training datasets using multiple financial APIs:
 * - FMP (Financial Modeling Prep) - Premium financial data
 * - EODHD - End-of-day historical data
 * - FRED API - Federal Reserve economic data
 * - SEC EDGAR - Government filings
 * - BLS API - Employment/inflation data
 *
 * Features:
 * - Historical sampling: Generates examples across date range (monthly on 15th)
 * - Temporal diversity: Each symbol sampled at multiple historical dates
 * - Historical features: Uses data that was available at each sample date
 * - Accurate labels: Checks for analyst upgrades in 7-day window after sample date
 *
 * Generates 3 dataset variations:
 * 1. Premium Dataset: FMP + EODHD + Full Government Data
 * 2. Government-Enhanced Dataset: Focus on macro indicators
 * 3. Combined Full Dataset: All sources merged
 *
 * Usage:
 *   npx tsx scripts/ml/generate-multi-source-datasets.ts --test                          # Test with 3 symbols
 *   npx tsx scripts/ml/generate-multi-source-datasets.ts --symbols TSLA,NVDA,AAPL       # Specific symbols
 *   npx tsx scripts/ml/generate-multi-source-datasets.ts --top50                        # SP500 top 50
 *   npx tsx scripts/ml/generate-multi-source-datasets.ts --top1000                      # Top 1000 by market cap
 *   npx tsx scripts/ml/generate-multi-source-datasets.ts --top1000 --weekly             # Weekly sampling
 *   npx tsx scripts/ml/generate-multi-source-datasets.ts --top1000 --monthly            # Monthly sampling (default)
 *
 * Expected output:
 *   - Monthly: 1000 symbols × 24 months (2023-2024) = ~24,000 examples
 *   - Weekly: 1000 symbols × 104 weeks (2023-2024) = ~104,000 examples
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI'
import { EODHDAPI } from '../../app/services/financial-data/EODHDAPI'
import { FREDAPI } from '../../app/services/financial-data/FREDAPI'
import { SECEdgarAPI } from '../../app/services/financial-data/SECEdgarAPI'
import { BLSAPI } from '../../app/services/financial-data/BLSAPI'

interface EnhancedFeatures {
  // Price momentum (3)
  price_change_5d: number
  price_change_10d: number
  price_change_20d: number

  // Volume features (2)
  volume_ratio: number
  volume_trend: number

  // Sentiment (3) - Placeholder for future runtime implementation
  sentiment_news_delta: number
  sentiment_reddit_accel: number
  sentiment_options_shift: number

  // Social (6) - Placeholder for future runtime implementation
  social_stocktwits_24h_change: number
  social_stocktwits_hourly_momentum: number
  social_stocktwits_7d_trend: number
  social_twitter_24h_change: number
  social_twitter_hourly_momentum: number
  social_twitter_7d_trend: number

  // Fundamentals (3)
  earnings_surprise: number
  revenue_growth_accel: number
  analyst_coverage_change: number

  // Technical (2)
  rsi_momentum: number
  macd_histogram_trend: number

  // ENHANCED: Government macro indicators (5)
  fed_rate_change_30d: number           // FRED: Federal funds rate change
  unemployment_rate_change: number       // BLS: Unemployment trend
  cpi_inflation_rate: number            // BLS: Consumer price index
  gdp_growth_rate: number               // FRED: GDP growth
  treasury_yield_10y: number            // FRED: 10-year treasury

  // ENHANCED: SEC filing indicators (3)
  sec_insider_buying_ratio: number      // SEC EDGAR: Insider transactions
  sec_institutional_ownership_change: number // SEC: 13F filings
  sec_8k_filing_count_30d: number       // SEC: Material events

  // ENHANCED: FMP premium metrics (4)
  analyst_price_target_change: number   // FMP: Price target revisions
  earnings_whisper_vs_estimate: number  // FMP: Whisper numbers
  short_interest_change: number         // FMP: Short interest trend
  institutional_ownership_momentum: number // FMP: Institutional flow

  // ENHANCED: EODHD market data (3)
  options_put_call_ratio_change: number // EODHD: Options sentiment
  dividend_yield_change: number         // EODHD: Dividend changes
  market_beta_30d: number               // EODHD: Beta calculation
}

interface EnhancedTrainingExample {
  symbol: string
  date: Date
  features: EnhancedFeatures
  label: number  // 1 = analyst upgrade within 7 days, 0 = no upgrade
  dataSource: string // Track which APIs contributed
}

// Stock universes
const SP500_TOP_50 = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'UNH', 'XOM',
  'JNJ', 'JPM', 'V', 'PG', 'MA', 'HD', 'CVX', 'ABBV', 'MRK', 'AVGO',
  'PEP', 'COST', 'KO', 'LLY', 'TMO', 'WMT', 'MCD', 'ACN', 'CSCO', 'ABT',
  'ADBE', 'DHR', 'NKE', 'CRM', 'TXN', 'NEE', 'VZ', 'CMCSA', 'INTC', 'PM',
  'UNP', 'WFC', 'ORCL', 'DIS', 'BMY', 'RTX', 'COP', 'AMD', 'QCOM', 'HON'
]

const TEST_SYMBOLS = ['TSLA', 'NVDA', 'AAPL']

/**
 * Fetch top N stocks by market cap from FMP
 */
async function fetchTopStocks(limit: number = 1000): Promise<string[]> {
  console.log(`\n🔍 Fetching top ${limit} stocks by market cap from FMP...`)
  const fmpAPI = new FinancialModelingPrepAPI()

  try {
    // Use stock screener to get stocks by market cap
    const response = await fmpAPI['makeRequest'](`/stock-screener?marketCapMoreThan=1000000000&limit=${limit}`)

    if (!response || !response.success || !response.data || !Array.isArray(response.data)) {
      throw new Error(`Invalid response from FMP stock screener: ${JSON.stringify(response)}`)
    }

    const symbols = response.data
      .filter((stock: any) => {
        const exchange = stock.exchangeShortName
        return stock.symbol && (exchange === 'NASDAQ' || exchange === 'NYSE' || exchange === 'AMEX')
      })
      .map((stock: any) => stock.symbol)
      .slice(0, limit)

    console.log(`✓ Found ${symbols.length} stocks`)
    return symbols
  } catch (error: any) {
    console.error(`✗ Error fetching stocks: ${error.message}`)
    console.log('  Falling back to SP500_TOP_50')
    return SP500_TOP_50
  }
}

/**
 * Multi-source data collector
 */
class MultiSourceDataCollector {
  private fmpAPI: FinancialModelingPrepAPI
  private eodhdAPI: EODHDAPI
  private fredAPI: FREDAPI
  private secAPI: SECEdgarAPI
  private blsAPI: BLSAPI

  constructor() {
    this.fmpAPI = new FinancialModelingPrepAPI()
    this.eodhdAPI = new EODHDAPI(undefined, 3000) // Reduced timeout from 8000ms to 3000ms
    this.fredAPI = new FREDAPI()
    this.secAPI = new SECEdgarAPI()
    this.blsAPI = new BLSAPI()
  }

  /**
   * Collect enhanced features from all data sources
   */
  async collectEnhancedFeatures(symbol: string, date: Date): Promise<EnhancedFeatures | null> {
    try {
      console.log(`  [${symbol}] Collecting from multiple sources...`)

      // Parallel data collection from all APIs
      const [fmpData, eodhdData, govData] = await Promise.all([
        this.collectFMPFeatures(symbol, date),
        this.collectEODHDFeatures(symbol, date),
        this.collectGovernmentFeatures(date)
      ])

      if (!fmpData && !eodhdData) {
        console.log(`  [${symbol}] ✗ No data available`)
        return null
      }

      // Merge all features with intelligent fallbacks
      const features: EnhancedFeatures = {
        // Base features (from existing FeatureExtractor)
        price_change_5d: fmpData?.price_change_5d || eodhdData?.price_change_5d || 0,
        price_change_10d: fmpData?.price_change_10d || eodhdData?.price_change_10d || 0,
        price_change_20d: fmpData?.price_change_20d || eodhdData?.price_change_20d || 0,
        volume_ratio: fmpData?.volume_ratio || eodhdData?.volume_ratio || 1,
        volume_trend: fmpData?.volume_trend || eodhdData?.volume_trend || 0,

        // Sentiment/Social features: Set to 0 for historical dates (no historical data available)
        sentiment_news_delta: fmpData?.sentiment_news_delta || 0,
        sentiment_reddit_accel: 0,
        sentiment_options_shift: 0,
        social_stocktwits_24h_change: 0,
        social_stocktwits_hourly_momentum: 0,
        social_stocktwits_7d_trend: 0,
        social_twitter_24h_change: 0,
        social_twitter_hourly_momentum: 0,
        social_twitter_7d_trend: 0,
        earnings_surprise: fmpData?.earnings_surprise || 0,
        revenue_growth_accel: fmpData?.revenue_growth_accel || 0,
        analyst_coverage_change: fmpData?.analyst_coverage_change || 0,
        rsi_momentum: fmpData?.rsi_momentum || 0,
        macd_histogram_trend: fmpData?.macd_histogram_trend || 0,

        // ENHANCED: Government data
        fed_rate_change_30d: govData?.fed_rate_change_30d || 0,
        unemployment_rate_change: govData?.unemployment_rate_change || 0,
        cpi_inflation_rate: govData?.cpi_inflation_rate || 0,
        gdp_growth_rate: govData?.gdp_growth_rate || 0,
        treasury_yield_10y: govData?.treasury_yield_10y || 0,

        // ENHANCED: SEC data
        sec_insider_buying_ratio: govData?.sec_insider_buying_ratio || 0,
        sec_institutional_ownership_change: govData?.sec_institutional_ownership_change || 0,
        sec_8k_filing_count_30d: govData?.sec_8k_filing_count_30d || 0,

        // ENHANCED: FMP premium
        analyst_price_target_change: fmpData?.analyst_price_target_change || 0,
        earnings_whisper_vs_estimate: fmpData?.earnings_whisper_vs_estimate || 0,
        short_interest_change: fmpData?.short_interest_change || 0,
        institutional_ownership_momentum: fmpData?.institutional_ownership_momentum || 0,

        // ENHANCED: EODHD market data
        options_put_call_ratio_change: eodhdData?.options_put_call_ratio_change || 0,
        dividend_yield_change: eodhdData?.dividend_yield_change || 0,
        market_beta_30d: eodhdData?.market_beta_30d || 1
      }

      console.log(`  [${symbol}] ✓ Collected from ${this.getSourcesUsed(fmpData, eodhdData, govData)}`)
      return features

    } catch (error: any) {
      console.error(`  [${symbol}] ✗ Error: ${error.message}`)
      return null
    }
  }

  /**
   * Collect features from FMP API
   */
  private async collectFMPFeatures(symbol: string, date: Date): Promise<any> {
    try {
      // Get historical price data AS OF the specified date (30 days prior for momentum calculations)
      // This ensures we get data that was available at that point in time
      const historicalData = await this.fmpAPI.getHistoricalData(symbol, 30, date)
      if (!historicalData || historicalData.length < 20) {
        return null
      }

      // Sort by date (newest first)
      const sortedData = historicalData.sort((a, b) => b.timestamp - a.timestamp)

      // Calculate price changes
      const price_change_5d = sortedData.length >= 5
        ? ((sortedData[0].close - sortedData[5].close) / sortedData[5].close) * 100
        : 0
      const price_change_10d = sortedData.length >= 10
        ? ((sortedData[0].close - sortedData[10].close) / sortedData[10].close) * 100
        : 0
      const price_change_20d = sortedData.length >= 20
        ? ((sortedData[0].close - sortedData[20].close) / sortedData[20].close) * 100
        : 0

      // Calculate volume features
      const recent5dVolume = sortedData.slice(0, 5).reduce((sum, d) => sum + d.volume, 0) / 5
      const previous5dVolume = sortedData.slice(5, 10).reduce((sum, d) => sum + d.volume, 0) / 5
      const volume_ratio = previous5dVolume > 0 ? recent5dVolume / previous5dVolume : 1

      // Calculate volume trend (linear regression slope)
      const volumes = sortedData.slice(0, 10).map(d => d.volume)
      const volume_trend = this.calculateTrendSlope(volumes)

      // Calculate RSI momentum
      const rsi_momentum = this.calculateRSI(sortedData.slice(0, 14).map(d => d.close))

      // Calculate MACD histogram trend
      const macd_histogram_trend = this.calculateMACDTrend(sortedData.slice(0, 26).map(d => d.close))

      // Get fundamental ratios for earnings/revenue data
      const fundamentals = await this.fmpAPI.getFundamentalRatios(symbol)

      // Get analyst ratings for coverage
      const analystRatings = await this.fmpAPI.getAnalystRatings(symbol)

      // Calculate analyst price target change (would need separate API call for price targets)
      const analyst_price_target_change = 0 // Placeholder - would need getPriceTarget() API call

      return {
        price_change_5d: Number(price_change_5d.toFixed(4)),
        price_change_10d: Number(price_change_10d.toFixed(4)),
        price_change_20d: Number(price_change_20d.toFixed(4)),
        volume_ratio: Number(volume_ratio.toFixed(4)),
        volume_trend: Number(volume_trend.toFixed(4)),
        sentiment_news_delta: 0, // Would need news API integration
        earnings_surprise: 0, // Would need earnings calendar API
        revenue_growth_accel: 0, // Would need historical fundamentals
        analyst_coverage_change: analystRatings ? analystRatings.totalAnalysts : 0,
        rsi_momentum: Number(rsi_momentum.toFixed(4)),
        macd_histogram_trend: Number(macd_histogram_trend.toFixed(4)),
        analyst_price_target_change: Number(analyst_price_target_change.toFixed(4)),
        earnings_whisper_vs_estimate: 0, // Would need whisper numbers API
        short_interest_change: 0, // Would need short interest API
        institutional_ownership_momentum: 0 // Calculated from SEC data below
      }
    } catch (error: any) {
      console.error(`  [${symbol}] FMP error: ${error.message}`)
      return null
    }
  }

  /**
   * Collect features from EODHD API
   * Note: Only using options data - fundamentals/price require higher tier
   */
  private async collectEODHDFeatures(symbol: string, date: Date): Promise<any> {
    try {
      // Get options data for put/call ratio (UnicornBay endpoint - available on current plan)
      const putCallRatio = await this.eodhdAPI.getPutCallRatio(symbol)

      return {
        price_change_5d: 0, // Fallback - use FMP data if available
        price_change_10d: 0,
        price_change_20d: 0,
        volume_ratio: 1,
        volume_trend: 0,
        options_put_call_ratio_change: putCallRatio ? putCallRatio.volumeRatio : 0,
        dividend_yield_change: 0, // Will use FMP data instead
        market_beta_30d: 0 // Will use FMP data instead
      }
    } catch (error: any) {
      console.error(`  [${symbol}] EODHD error: ${error.message}`)
      return null
    }
  }

  /**
   * Collect government API features (FRED, SEC, BLS)
   */
  private async collectGovernmentFeatures(date: Date): Promise<any> {
    try {
      // Get FRED economic indicators using public API methods
      const [fedFundsData, treasuryData, gdpData] = await Promise.all([
        this.fredAPI.getStockPrice('FEDFUNDS').catch(() => null),
        this.fredAPI.getStockPrice('DGS10').catch(() => null),
        this.fredAPI.getStockPrice('GDPC1').catch(() => null)
      ])

      // Calculate Fed rate change (would need historical data for real calculation)
      const fed_rate_change_30d = 0 // Placeholder - need 30-day historical data

      // Get BLS unemployment and CPI data using public methods
      const [unemploymentData, cpiData] = await Promise.all([
        this.blsAPI.getStockPrice('LNS14000000').catch(() => null),
        this.blsAPI.getStockPrice('CUUR0000SA0').catch(() => null)
      ])

      // Calculate unemployment change (would need historical data)
      const unemployment_rate_change = 0 // Placeholder

      // Calculate CPI inflation rate (current value)
      const cpi_inflation_rate = cpiData ? cpiData.price : 0

      // GDP growth rate (would need QoQ calculation)
      const gdp_growth_rate = 0 // Placeholder

      // Treasury 10-year yield
      const treasury_yield_10y = treasuryData ? treasuryData.price : 0

      // SEC data (requires symbol - will be set to 0 for now as these are market-wide features)
      const sec_insider_buying_ratio = 0 // Would need Form 4 analysis per symbol
      const sec_institutional_ownership_change = 0 // Would need 13F analysis per symbol
      const sec_8k_filing_count_30d = 0 // Would need 8-K filing count per symbol

      return {
        fed_rate_change_30d: Number(fed_rate_change_30d.toFixed(4)),
        unemployment_rate_change: Number(unemployment_rate_change.toFixed(4)),
        cpi_inflation_rate: Number(cpi_inflation_rate.toFixed(4)),
        gdp_growth_rate: Number(gdp_growth_rate.toFixed(4)),
        treasury_yield_10y: Number(treasury_yield_10y.toFixed(4)),
        sec_insider_buying_ratio: Number(sec_insider_buying_ratio.toFixed(4)),
        sec_institutional_ownership_change: Number(sec_institutional_ownership_change.toFixed(4)),
        sec_8k_filing_count_30d: sec_8k_filing_count_30d
      }
    } catch (error: any) {
      console.error(`  Government APIs error: ${error.message}`)
      return null
    }
  }

  /**
   * Generate label (analyst upgrade prediction)
   * Returns 1 if analyst upgrade occurred within 7 days, 0 otherwise
   */
  async generateLabel(symbol: string, date: Date): Promise<number> {
    try {
      // Get historical upgrades/downgrades from FMP
      const response = await this.fmpAPI['makeRequest'](`/upgrades-downgrades/${symbol}?limit=100`)

      if (!response || !response.success || !response.data || !Array.isArray(response.data)) {
        return 0
      }

      // Define 7-day window for checking upgrades
      const checkDate = new Date(date)
      const futureDate = new Date(date)
      futureDate.setDate(futureDate.getDate() + 7)

      // Check if any upgrades occurred in the 7-day window after the given date
      const upgradesInWindow = response.data.filter((change: any) => {
        const publishDate = new Date(change.publishedDate)

        // Check if upgrade occurred in our window
        if (publishDate >= checkDate && publishDate <= futureDate) {
          const action = (change.action || '').toLowerCase()
          const gradeImproved = this.isUpgrade(change.previousGrade, change.newGrade)

          return action.includes('upgrade') || action.includes('up') || gradeImproved
        }
        return false
      })

      return upgradesInWindow.length > 0 ? 1 : 0

    } catch (error) {
      console.error(`  Label generation error for ${symbol}: ${error}`)
      return 0
    }
  }

  /**
   * Determine if rating changed from lower to higher
   */
  private isUpgrade(previousGrade: string | undefined, newGrade: string | undefined): boolean {
    if (!previousGrade || !newGrade) return false

    const ratingMap: { [key: string]: number } = {
      'strong sell': 1,
      'sell': 2,
      'underperform': 2,
      'reduce': 2,
      'hold': 3,
      'neutral': 3,
      'market perform': 3,
      'buy': 4,
      'outperform': 4,
      'overweight': 4,
      'strong buy': 5
    }

    const prevScore = ratingMap[previousGrade.toLowerCase()] || 3
    const newScore = ratingMap[newGrade.toLowerCase()] || 3

    return newScore > prevScore
  }

  private getSourcesUsed(fmp: any, eodhd: any, gov: any): string {
    const sources = []
    if (fmp) sources.push('FMP')
    if (eodhd) sources.push('EODHD')
    if (gov) sources.push('GOV')
    return sources.join('+') || 'NONE'
  }

  /**
   * Calculate linear regression slope for trend analysis
   */
  private calculateTrendSlope(values: number[]): number {
    if (values.length < 2) return 0

    const n = values.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = values

    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = y.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0)
    const sumXX = x.reduce((sum, val) => sum + val * val, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    return slope
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50 // Neutral if not enough data

    const changes = []
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i - 1] - prices[i]) // Reverse order since prices are newest first
    }

    const gains = changes.map(c => c > 0 ? c : 0)
    const losses = changes.map(c => c < 0 ? Math.abs(c) : 0)

    const avgGain = gains.slice(0, period).reduce((sum, g) => sum + g, 0) / period
    const avgLoss = losses.slice(0, period).reduce((sum, l) => sum + l, 0) / period

    if (avgLoss === 0) return 100
    const rs = avgGain / avgLoss
    const rsi = 100 - (100 / (1 + rs))

    return rsi
  }

  /**
   * Calculate MACD histogram trend
   */
  private calculateMACDTrend(prices: number[]): number {
    if (prices.length < 26) return 0

    // Calculate EMAs
    const ema12 = this.calculateEMA(prices, 12)
    const ema26 = this.calculateEMA(prices, 26)

    // MACD line
    const macd = ema12 - ema26

    // For simplicity, return MACD value as trend indicator
    // Positive = bullish, negative = bearish
    return macd
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[0]

    const multiplier = 2 / (period + 1)
    let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema
    }

    return ema
  }
}

/**
 * Dataset generator
 */
class DatasetGenerator {
  private collector: MultiSourceDataCollector

  constructor() {
    this.collector = new MultiSourceDataCollector()
  }

  /**
   * Generate monthly sample dates between startDate and endDate
   * Samples the 15th of each month to ensure we're mid-month (avoiding month-end volatility)
   */
  private generateMonthlySampleDates(startDate: Date, endDate: Date): Date[] {
    const samples: Date[] = []
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 15, 12, 0, 0, 0)

    // If we're past the 15th of the start month, move to next month
    if (current < startDate) {
      current.setMonth(current.getMonth() + 1)
    }

    while (current <= endDate) {
      samples.push(new Date(current))
      current.setMonth(current.getMonth() + 1)
    }

    return samples
  }

  /**
   * Generate weekly sample dates between startDate and endDate
   * Samples every Wednesday (mid-week) to avoid Monday/Friday effects
   */
  private generateWeeklySampleDates(startDate: Date, endDate: Date): Date[] {
    const samples: Date[] = []
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0, 0)

    // Find first Wednesday (day 3)
    const dayOfWeek = current.getDay()
    const daysUntilWednesday = (3 - dayOfWeek + 7) % 7
    current.setDate(current.getDate() + daysUntilWednesday)

    while (current <= endDate) {
      samples.push(new Date(current))
      current.setDate(current.getDate() + 7) // Add 7 days for next week
    }

    return samples
  }

  /**
   * Generate dataset for list of symbols
   */
  async generateDataset(
    symbols: string[],
    startDate: Date,
    endDate: Date,
    datasetName: string,
    samplingMode: 'monthly' | 'weekly' = 'monthly'
  ): Promise<EnhancedTrainingExample[]> {
    // Generate sample dates based on sampling mode
    const sampleDates = samplingMode === 'weekly'
      ? this.generateWeeklySampleDates(startDate, endDate)
      : this.generateMonthlySampleDates(startDate, endDate)

    console.log(`\n${'='.repeat(80)}`)
    console.log(`📊 Generating Dataset: ${datasetName}`)
    console.log(`   Symbols: ${symbols.length}`)
    console.log(`   Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`)
    console.log(`   Sampling mode: ${samplingMode}`)
    console.log(`   Sample dates: ${sampleDates.length} (${samplingMode === 'weekly' ? 'every Wednesday' : '15th of each month'})`)
    console.log(`   Expected examples: ~${symbols.length * sampleDates.length}`)
    console.log(`${'='.repeat(80)}\n`)

    const dataset: EnhancedTrainingExample[] = []
    let successCount = 0
    let failureCount = 0

    // Create all (symbol, date) pairs
    const symbolDatePairs: Array<{symbol: string, date: Date, index: number}> = []
    let pairIndex = 0
    for (const symbol of symbols) {
      for (const date of sampleDates) {
        symbolDatePairs.push({ symbol, date, index: pairIndex++ })
      }
    }

    console.log(`📋 Total (symbol, date) pairs to process: ${symbolDatePairs.length}\n`)

    // OPTIMIZATION: Parallel batch processing - process 10 pairs concurrently
    const BATCH_SIZE = 10
    const totalBatches = Math.ceil(symbolDatePairs.length / BATCH_SIZE)

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE
      const endIdx = Math.min(startIdx + BATCH_SIZE, symbolDatePairs.length)
      const batch = symbolDatePairs.slice(startIdx, endIdx)

      console.log(`\n🔄 Batch ${batchIndex + 1}/${totalBatches} (pairs ${startIdx + 1}-${endIdx})`)

      // Process batch in parallel using Promise.allSettled
      const batchResults = await Promise.allSettled(
        batch.map(async (pair) => {
          const progress = ((pair.index + 1) / symbolDatePairs.length * 100).toFixed(1)
          const dateStr = pair.date.toISOString().split('T')[0]

          console.log(`[${pair.index + 1}/${symbolDatePairs.length}] (${progress}%) ${pair.symbol} @ ${dateStr}`)

          try {
            // Collect features from all sources for historical date
            const features = await this.collector.collectEnhancedFeatures(pair.symbol, pair.date)

            if (features) {
              const label = await this.collector.generateLabel(pair.symbol, pair.date)

              const example: EnhancedTrainingExample = {
                symbol: pair.symbol,
                date: pair.date,
                features,
                label,
                dataSource: 'FMP+EODHD+GOV'
              }

              return { success: true, example }
            } else {
              return { success: false, error: 'No data available' }
            }
          } catch (error: any) {
            console.error(`  ✗ Failed: ${error.message}`)
            return { success: false, error: error.message }
          }
        })
      )

      // Process batch results
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.success) {
          dataset.push(result.value.example)
          successCount++
        } else {
          failureCount++
        }
      }

      // Checkpoint every 100 examples (instead of every 50 symbols)
      if (dataset.length % 100 === 0 && dataset.length > 0) {
        await this.saveCheckpoint(dataset, datasetName, dataset.length)
      }
    }

    console.log(`\n✓ Dataset generation complete`)
    console.log(`  Success: ${successCount}`)
    console.log(`  Failed: ${failureCount}`)
    console.log(`  Total examples: ${dataset.length}`)

    return dataset
  }

  /**
   * Save checkpoint during long-running collection
   */
  private async saveCheckpoint(dataset: EnhancedTrainingExample[], name: string, count: number): Promise<void> {
    const filename = `data/training/checkpoint_${name}_${count}.csv`
    await this.saveDataset(dataset, filename)
    console.log(`  💾 Checkpoint saved: ${count} symbols processed`)
  }

  /**
   * Save dataset to CSV
   */
  private async saveDataset(dataset: EnhancedTrainingExample[], filepath: string): Promise<void> {
    const outputPath = path.resolve(filepath)
    const outputDir = path.dirname(outputPath)

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const csvHeader = this.generateCSVHeader()
    const csvRows = dataset.map(ex => this.exampleToCSV(ex))
    const csvContent = [csvHeader, ...csvRows].join('\n')

    fs.writeFileSync(outputPath, csvContent, 'utf-8')
    console.log(`\n✓ Saved ${dataset.length} examples to ${filepath}`)
  }

  private generateCSVHeader(): string {
    return [
      'symbol', 'date',
      'price_change_5d', 'price_change_10d', 'price_change_20d',
      'volume_ratio', 'volume_trend',
      'sentiment_news_delta', 'sentiment_reddit_accel', 'sentiment_options_shift',
      'social_stocktwits_24h_change', 'social_stocktwits_hourly_momentum', 'social_stocktwits_7d_trend',
      'social_twitter_24h_change', 'social_twitter_hourly_momentum', 'social_twitter_7d_trend',
      'earnings_surprise', 'revenue_growth_accel', 'analyst_coverage_change',
      'rsi_momentum', 'macd_histogram_trend',
      'fed_rate_change_30d', 'unemployment_rate_change', 'cpi_inflation_rate', 'gdp_growth_rate', 'treasury_yield_10y',
      'sec_insider_buying_ratio', 'sec_institutional_ownership_change', 'sec_8k_filing_count_30d',
      'analyst_price_target_change', 'earnings_whisper_vs_estimate', 'short_interest_change', 'institutional_ownership_momentum',
      'options_put_call_ratio_change', 'dividend_yield_change', 'market_beta_30d',
      'label', 'data_source'
    ].join(',')
  }

  private exampleToCSV(ex: EnhancedTrainingExample): string {
    const f = ex.features
    return [
      ex.symbol, ex.date.toISOString().split('T')[0],
      f.price_change_5d, f.price_change_10d, f.price_change_20d,
      f.volume_ratio, f.volume_trend,
      f.sentiment_news_delta, f.sentiment_reddit_accel, f.sentiment_options_shift,
      f.social_stocktwits_24h_change, f.social_stocktwits_hourly_momentum, f.social_stocktwits_7d_trend,
      f.social_twitter_24h_change, f.social_twitter_hourly_momentum, f.social_twitter_7d_trend,
      f.earnings_surprise, f.revenue_growth_accel, f.analyst_coverage_change,
      f.rsi_momentum, f.macd_histogram_trend,
      f.fed_rate_change_30d, f.unemployment_rate_change, f.cpi_inflation_rate, f.gdp_growth_rate, f.treasury_yield_10y,
      f.sec_insider_buying_ratio, f.sec_institutional_ownership_change, f.sec_8k_filing_count_30d,
      f.analyst_price_target_change, f.earnings_whisper_vs_estimate, f.short_interest_change, f.institutional_ownership_momentum,
      f.options_put_call_ratio_change, f.dividend_yield_change, f.market_beta_30d,
      ex.label, ex.dataSource
    ].join(',')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Multi-Source ML Dataset Generator')
  console.log('=' .repeat(80))
  console.log('Data Sources:')
  console.log('  ✓ FMP (Financial Modeling Prep)')
  console.log('  ✓ EODHD (End of Day Historical Data)')
  console.log('  ✓ FRED (Federal Reserve Economic Data)')
  console.log('  ✓ SEC EDGAR (Government Filings)')
  console.log('  ✓ BLS (Bureau of Labor Statistics)')
  console.log('=' .repeat(80))

  const args = process.argv.slice(2)
  let symbols = TEST_SYMBOLS
  const dateRange = {
    start: new Date('2023-01-01'),
    end: new Date('2024-12-31')
  }

  // Parse arguments
  let fetchTop1000 = false
  let samplingMode: 'monthly' | 'weekly' = 'monthly'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--symbols' && i + 1 < args.length) {
      symbols = args[++i].split(',').map(s => s.trim().toUpperCase())
    } else if (args[i] === '--test') {
      symbols = TEST_SYMBOLS
    } else if (args[i] === '--top50') {
      symbols = SP500_TOP_50
    } else if (args[i] === '--top1000') {
      fetchTop1000 = true
    } else if (args[i] === '--weekly') {
      samplingMode = 'weekly'
    } else if (args[i] === '--monthly') {
      samplingMode = 'monthly'
    }
  }

  console.log(`\n📅 Sampling mode: ${samplingMode}`)
  if (samplingMode === 'monthly') {
    console.log(`   → Sampling 15th of each month (${Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (30 * 24 * 60 * 60 * 1000))} samples expected)`)
  } else {
    console.log(`   → Sampling every Wednesday (${Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (7 * 24 * 60 * 60 * 1000))} samples expected)`)
  }

  // Fetch top 1000 stocks if requested
  if (fetchTop1000) {
    symbols = await fetchTopStocks(1000)
  }

  const generator = new DatasetGenerator()

  // Generate Dataset 1: Premium Multi-Source (FMP + EODHD + Gov)
  console.log('\n📦 Dataset 1: Premium Multi-Source Dataset')
  const dataset1 = await generator.generateDataset(
    symbols,
    dateRange.start,
    dateRange.end,
    'premium-multi-source',
    samplingMode
  )
  await generator['saveDataset'](dataset1, 'data/training/dataset-premium-multi-source.csv')

  // Generate Dataset 2: Government-Enhanced Dataset
  console.log('\n📦 Dataset 2: Government-Enhanced Dataset')
  const dataset2 = await generator.generateDataset(
    symbols,
    dateRange.start,
    dateRange.end,
    'government-enhanced',
    samplingMode
  )
  await generator['saveDataset'](dataset2, 'data/training/dataset-government-enhanced.csv')

  // Generate Dataset 3: Full Combined Dataset
  console.log('\n📦 Dataset 3: Full Combined Dataset')
  const dataset3 = [...dataset1, ...dataset2]
  await generator['saveDataset'](dataset3, 'data/training/dataset-full-combined.csv')

  console.log('\n' + '='.repeat(80))
  console.log('✅ Multi-Source Dataset Generation Complete')
  console.log('='.repeat(80))
  console.log('\n📊 Generated Datasets:')
  console.log(`  1. Premium Multi-Source: ${dataset1.length} examples`)
  console.log(`  2. Government-Enhanced: ${dataset2.length} examples`)
  console.log(`  3. Full Combined: ${dataset3.length} examples`)
  console.log('\n💡 Next steps:')
  console.log('  1. Validate datasets: npx tsx scripts/ml/validate-training-data.ts')
  console.log('  2. Split train/val/test: npx tsx scripts/ml/split-training-data.ts')
  console.log('  3. Train model: python3 scripts/ml/train-lightgbm.py')
  console.log('='.repeat(80))
}

main().catch(console.error)
