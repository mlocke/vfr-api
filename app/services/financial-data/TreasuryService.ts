/**
 * Treasury Service for collecting yield curve data
 * Leverages FRED API for Treasury rates with yield curve analysis
 */

import { FREDAPI } from './FREDAPI'

export interface TreasuryRates {
  timestamp: number
  rates: {
    '1M': number | null
    '3M': number | null
    '6M': number | null
    '1Y': number | null
    '2Y': number | null
    '5Y': number | null
    '10Y': number | null
    '20Y': number | null
    '30Y': number | null
  }
  spreads: {
    '2Y10Y': number | null      // 10Y - 2Y spread (recession indicator)
    '10Y30Y': number | null     // 10Y - 30Y spread (curve steepness)
    '3M10Y': number | null      // 3M - 10Y spread (short-term stress)
  }
  indicators: {
    isInverted: boolean         // True if 2Y > 10Y (recession signal)
    curveShape: 'steep' | 'flat' | 'inverted' | 'unknown'
    rateChangeDaily: {
      '2Y': number | null
      '10Y': number | null
      '30Y': number | null
    }
  }
  source: 'fred'
  dataQuality: number          // 0-1 confidence score
}

export interface TreasuryDataResponse {
  success: boolean
  data?: TreasuryRates
  error?: string
  collectionTime: number
}

export class TreasuryService {
  private fredAPI: FREDAPI
  private cache: Map<string, { data: TreasuryRates; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

  // FRED series IDs for Treasury rates
  private readonly TREASURY_SERIES = {
    '1M': 'DGS1MO',    // 1-Month Treasury Constant Maturity Rate
    '3M': 'DGS3MO',    // 3-Month Treasury Constant Maturity Rate
    '6M': 'DGS6MO',    // 6-Month Treasury Constant Maturity Rate
    '1Y': 'DGS1',      // 1-Year Treasury Constant Maturity Rate
    '2Y': 'DGS2',      // 2-Year Treasury Constant Maturity Rate
    '5Y': 'DGS5',      // 5-Year Treasury Constant Maturity Rate
    '10Y': 'DGS10',    // 10-Year Treasury Constant Maturity Rate
    '20Y': 'DGS20',    // 20-Year Treasury Constant Maturity Rate
    '30Y': 'DGS30'     // 30-Year Treasury Constant Maturity Rate
  }

  constructor() {
    this.fredAPI = new FREDAPI()
  }

  /**
   * Get current Treasury rates with yield curve analysis
   */
  async getTreasuryRates(): Promise<TreasuryDataResponse> {
    const startTime = Date.now()

    try {
      // Check cache first
      const cached = this.getCachedData()
      if (cached) {
        console.log('📊 Treasury rates served from cache')
        return {
          success: true,
          data: cached,
          collectionTime: Date.now() - startTime
        }
      }

      console.log('🔄 Fetching fresh Treasury rates from FRED API...')

      // Fetch all Treasury rates in parallel
      const ratePromises = Object.entries(this.TREASURY_SERIES).map(async ([duration, seriesId]) => {
        try {
          const data = await this.fredAPI.getStockPrice(seriesId)
          return { duration, rate: data?.price || null }
        } catch (error) {
          console.warn(`Failed to fetch ${duration} Treasury rate:`, error)
          return { duration, rate: null }
        }
      })

      const rateResults = await Promise.all(ratePromises)

      // Build rates object
      const rates: TreasuryRates['rates'] = {
        '1M': null, '3M': null, '6M': null, '1Y': null, '2Y': null,
        '5Y': null, '10Y': null, '20Y': null, '30Y': null
      }

      rateResults.forEach(({ duration, rate }) => {
        rates[duration as keyof typeof rates] = rate
      })

      // Calculate spreads and indicators
      const spreads = this.calculateSpreads(rates)
      const indicators = this.calculateIndicators(rates, spreads)

      // Calculate data quality score
      const dataQuality = this.calculateDataQuality(rates)

      const treasuryData: TreasuryRates = {
        timestamp: Date.now(),
        rates,
        spreads,
        indicators,
        source: 'fred',
        dataQuality
      }

      // Cache the result
      this.cacheData(treasuryData)

      console.log(`✅ Treasury rates collected successfully (${Date.now() - startTime}ms)`)
      console.log(`📊 Data quality: ${(dataQuality * 100).toFixed(1)}%`)
      console.log(`📈 2Y/10Y spread: ${spreads['2Y10Y']?.toFixed(2) || 'N/A'}% ${indicators.isInverted ? '(INVERTED)' : ''}`)

      return {
        success: true,
        data: treasuryData,
        collectionTime: Date.now() - startTime
      }

    } catch (error) {
      console.error('❌ Treasury rates collection failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        collectionTime: Date.now() - startTime
      }
    }
  }

  /**
   * Calculate yield curve spreads
   */
  private calculateSpreads(rates: TreasuryRates['rates']): TreasuryRates['spreads'] {
    const { '3M': rate3M, '2Y': rate2Y, '10Y': rate10Y, '30Y': rate30Y } = rates

    return {
      '2Y10Y': (rate10Y !== null && rate2Y !== null) ? Number((rate10Y - rate2Y).toFixed(2)) : null,
      '10Y30Y': (rate30Y !== null && rate10Y !== null) ? Number((rate30Y - rate10Y).toFixed(2)) : null,
      '3M10Y': (rate10Y !== null && rate3M !== null) ? Number((rate10Y - rate3M).toFixed(2)) : null
    }
  }

  /**
   * Calculate yield curve indicators and analysis
   */
  private calculateIndicators(
    rates: TreasuryRates['rates'],
    spreads: TreasuryRates['spreads']
  ): TreasuryRates['indicators'] {
    const { '2Y': rate2Y, '10Y': rate10Y } = rates
    const spread2Y10Y = spreads['2Y10Y']

    // Determine if curve is inverted
    const isInverted = spread2Y10Y !== null && spread2Y10Y < 0

    // Determine curve shape
    let curveShape: TreasuryRates['indicators']['curveShape'] = 'unknown'
    if (spread2Y10Y !== null) {
      if (spread2Y10Y < 0) {
        curveShape = 'inverted'
      } else if (spread2Y10Y < 0.5) {
        curveShape = 'flat'
      } else {
        curveShape = 'steep'
      }
    }

    // For MVP, rate change calculation is simplified (would need historical data)
    const rateChangeDaily = {
      '2Y': null, // Would need previous day's data
      '10Y': null,
      '30Y': null
    }

    return {
      isInverted,
      curveShape,
      rateChangeDaily
    }
  }

  /**
   * Calculate data quality score based on available rates
   */
  private calculateDataQuality(rates: TreasuryRates['rates']): number {
    const totalRates = Object.keys(rates).length
    const availableRates = Object.values(rates).filter(rate => rate !== null).length

    // Weight key rates more heavily (2Y, 10Y, 30Y are most important)
    const keyRates = ['2Y', '10Y', '30Y']
    const availableKeyRates = keyRates.filter(key => rates[key as keyof typeof rates] !== null).length

    // Base score from availability + bonus for key rates
    const baseScore = availableRates / totalRates
    const keyRateBonus = (availableKeyRates / keyRates.length) * 0.3

    return Math.min(1, baseScore + keyRateBonus)
  }

  /**
   * Get cached Treasury data if valid
   */
  private getCachedData(): TreasuryRates | null {
    const cached = this.cache.get('treasury_rates')
    if (!cached) return null

    const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL
    if (isExpired) {
      this.cache.delete('treasury_rates')
      return null
    }

    return cached.data
  }

  /**
   * Cache Treasury data
   */
  private cacheData(data: TreasuryRates): void {
    this.cache.set('treasury_rates', {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Get summary of current Treasury environment
   */
  async getTreasurySummary(): Promise<{
    environment: string
    riskLevel: 'low' | 'medium' | 'high'
    keyInsights: string[]
  }> {
    const response = await this.getTreasuryRates()

    if (!response.success || !response.data) {
      return {
        environment: 'Unknown',
        riskLevel: 'medium',
        keyInsights: ['Treasury data unavailable']
      }
    }

    const { rates, spreads, indicators } = response.data
    const insights: string[] = []

    // Analyze environment
    let environment = 'Normal'
    let riskLevel: 'low' | 'medium' | 'high' = 'medium'

    if (indicators.isInverted) {
      environment = 'Yield Curve Inverted'
      riskLevel = 'high'
      insights.push(`Yield curve inverted (${spreads['2Y10Y']?.toFixed(2)}% spread) - potential recession signal`)
    } else if (spreads['2Y10Y'] && spreads['2Y10Y'] < 0.5) {
      environment = 'Flattening Curve'
      riskLevel = 'medium'
      insights.push(`Yield curve flattening (${spreads['2Y10Y']?.toFixed(2)}% spread)`)
    } else {
      environment = 'Normal Curve'
      riskLevel = 'low'
    }

    // Add rate level insights
    if (rates['10Y']) {
      if (rates['10Y'] > 5) {
        insights.push(`High 10Y yield at ${rates['10Y'].toFixed(2)}% - restrictive monetary policy`)
      } else if (rates['10Y'] < 2) {
        insights.push(`Low 10Y yield at ${rates['10Y'].toFixed(2)}% - accommodative environment`)
      }
    }

    return { environment, riskLevel, keyInsights: insights }
  }

  /**
   * Health check for Treasury service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Quick test with 10Y Treasury rate
      const data = await this.fredAPI.getStockPrice('DGS10')
      return data !== null
    } catch {
      return false
    }
  }
}