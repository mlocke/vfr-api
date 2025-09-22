/**
 * MarketSentimentService.ts - Real-time market sentiment aggregation
 * Leverages existing free APIs (FRED, MarketIndices, Yahoo) for sentiment scoring
 * No additional paid APIs required
 */

import { MarketIndicesService, MarketIndicesData } from './MarketIndicesService'
import { FREDAPI } from './FREDAPI'
import { RedisCache } from '../cache/RedisCache'
import ErrorHandler from '../error-handling/ErrorHandler'

export interface SentimentScore {
  value: number           // 0-100 (0=extreme fear, 50=neutral, 100=extreme greed)
  level: 'extreme-fear' | 'fear' | 'neutral' | 'greed' | 'extreme-greed'
  trend: 'rising' | 'falling' | 'stable'
  confidence: number      // 0-1 based on data quality
}

export interface SectorSentiment {
  symbol: string
  name: string
  sentiment: SentimentScore
  performance: {
    day: number
    week: number
    month: number
  }
  volume: {
    current: number
    average: number
    ratio: number
  }
  timestamp: number
}

export interface MarketSentimentData {
  overall: SentimentScore
  vixLevel: {
    current: number
    trend: 'rising' | 'falling' | 'stable'
    interpretation: string
  }
  sectors: SectorSentiment[]
  economicIndicators: {
    yieldCurve: SentimentScore
    dollarStrength: SentimentScore
    commodities: SentimentScore
  }
  socialSentiment: {
    trending: string[]      // Trending tickers from free sources
    sentiment: 'bullish' | 'bearish' | 'neutral'
  }
  lastUpdate: string
  dataQuality: number
}

export class MarketSentimentService {
  private marketIndicesService: MarketIndicesService
  private fredAPI: FREDAPI
  private cache: RedisCache
  private cacheTTL = 60000 // 1 minute cache

  constructor() {
    this.marketIndicesService = new MarketIndicesService()
    this.fredAPI = new FREDAPI()
    this.cache = new RedisCache()
  }

  /**
   * Get comprehensive market sentiment analysis
   */
  async getMarketSentiment(): Promise<MarketSentimentData> {
    const cacheKey = 'market-sentiment-data'

    try {
      // Check cache first
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      // Gather data in parallel for performance
      const [marketData, economicData] = await Promise.allSettled([
        this.gatherMarketData(),
        this.gatherEconomicData()
      ])

      const sentiment = await this.calculateOverallSentiment(marketData, economicData)

      // Cache the results
      await this.cache.set(cacheKey, JSON.stringify(sentiment), this.cacheTTL)

      return sentiment

    } catch (error) {
      console.error('MarketSentimentService.getMarketSentiment error:', error)
      throw new Error('Failed to retrieve market sentiment data')
    }
  }

  /**
   * Gather market indices and sector data
   */
  private async gatherMarketData(): Promise<MarketIndicesData> {
    return await this.marketIndicesService.getAllIndices()
  }

  /**
   * Gather economic indicators from FRED
   */
  private async gatherEconomicData(): Promise<any> {
    const indicators = await Promise.allSettled([
      // VIX fear/greed proxy (use treasury rates as proxy)
      this.fredAPI.getTreasuryRates(),
      // 10Y-2Y yield curve (recession indicator)
      this.fredAPI.getTreasuryAnalysisData(),
      // Economic indicators from search
      this.fredAPI.searchSeries('GDP', 5),
      // Employment data
      this.fredAPI.searchSeries('unemployment', 5)
    ])

    return {
      vix: indicators[0].status === 'fulfilled' ? indicators[0].value : null,
      yieldCurve: indicators[1].status === 'fulfilled' ? indicators[1].value : null,
      dollarIndex: indicators[2].status === 'fulfilled' ? indicators[2].value : null,
      creditSpreads: indicators[3].status === 'fulfilled' ? indicators[3].value : null
    }
  }

  /**
   * Calculate overall market sentiment from multiple data sources
   */
  private async calculateOverallSentiment(
    marketDataResult: PromiseSettledResult<MarketIndicesData>,
    economicDataResult: PromiseSettledResult<any>
  ): Promise<MarketSentimentData> {

    const marketData = marketDataResult.status === 'fulfilled' ? marketDataResult.value : null
    const economicData = economicDataResult.status === 'fulfilled' ? economicDataResult.value : null

    // Calculate VIX-based sentiment (primary indicator)
    const vixSentiment = this.calculateVIXSentiment(marketData?.vix)

    // Calculate sector rotation sentiment
    const sectorSentiments = this.calculateSectorSentiments(marketData)

    // Calculate economic indicator sentiment
    const economicSentiment = this.calculateEconomicSentiment(economicData)

    // Weight and combine all sentiments
    const overallScore = this.combinesentiments([
      { weight: 0.4, sentiment: vixSentiment },
      { weight: 0.3, sentiment: this.averageSectorSentiment(sectorSentiments) },
      { weight: 0.3, sentiment: economicSentiment }
    ])

    return {
      overall: overallScore,
      vixLevel: {
        current: marketData?.vix?.value || 0,
        trend: this.calculateTrend(marketData?.vix?.change || 0),
        interpretation: this.interpretVIX(marketData?.vix?.value || 0)
      },
      sectors: sectorSentiments,
      economicIndicators: {
        yieldCurve: this.calculateYieldCurveSentiment(economicData?.yieldCurve),
        dollarStrength: this.calculateDollarSentiment(economicData?.dollarIndex),
        commodities: this.calculateCommoditySentiment(marketData)
      },
      socialSentiment: {
        trending: this.extractTrendingSymbols(marketData),
        sentiment: this.interpretOverallSentiment(overallScore.value)
      },
      lastUpdate: new Date().toISOString(),
      dataQuality: this.calculateDataQuality(marketData, economicData)
    }
  }

  /**
   * Calculate VIX-based sentiment score
   */
  private calculateVIXSentiment(vixData: any): SentimentScore {
    if (!vixData?.value) {
      return { value: 50, level: 'neutral', trend: 'stable', confidence: 0 }
    }

    const vix = vixData.value
    let sentimentValue: number

    // VIX interpretation (inverted - high VIX = low sentiment)
    if (vix >= 30) sentimentValue = 10       // Extreme fear
    else if (vix >= 25) sentimentValue = 25  // Fear
    else if (vix >= 20) sentimentValue = 40  // Cautious
    else if (vix >= 15) sentimentValue = 60  // Optimistic
    else if (vix >= 12) sentimentValue = 75  // Confident
    else sentimentValue = 90                 // Potentially complacent

    return {
      value: sentimentValue,
      level: this.getSentimentLevel(sentimentValue),
      trend: this.calculateTrend(vixData.change || 0),
      confidence: 0.9 // VIX is highly reliable
    }
  }

  /**
   * Calculate sentiment for each sector
   */
  private calculateSectorSentiments(marketData: MarketIndicesData | null): SectorSentiment[] {
    if (!marketData?.sectors) return []

    const sectors = [
      { key: 'xlk', name: 'Technology', symbol: 'XLK' },
      { key: 'xlf', name: 'Financials', symbol: 'XLF' },
      { key: 'xle', name: 'Energy', symbol: 'XLE' },
      { key: 'xlv', name: 'Healthcare', symbol: 'XLV' },
      { key: 'xli', name: 'Industrials', symbol: 'XLI' }
    ]

    return sectors.map(sector => {
      const sectorData = marketData.sectors[sector.key as keyof typeof marketData.sectors]

      if (!sectorData) {
        return this.createDefaultSectorSentiment(sector.symbol, sector.name)
      }

      const changePercent = sectorData.changePercent || 0
      const sentimentValue = this.performanceToSentiment(changePercent)

      return {
        symbol: sector.symbol,
        name: sector.name,
        sentiment: {
          value: sentimentValue,
          level: this.getSentimentLevel(sentimentValue),
          trend: this.calculateTrend(changePercent),
          confidence: 0.8
        },
        performance: {
          day: changePercent,
          week: changePercent * 3.5, // Estimate
          month: changePercent * 15   // Estimate
        },
        volume: {
          current: 1000000, // Default values - could be enhanced with real volume data
          average: 800000,
          ratio: 1.25
        },
        timestamp: Date.now()
      }
    })
  }

  /**
   * Helper methods for sentiment calculation
   */
  private calculateEconomicSentiment(economicData: any): SentimentScore {
    let score = 50 // Start neutral
    let confidence = 0.3

    // Yield curve inversion check
    if (economicData?.yieldCurve?.data?.length > 0) {
      const latestYield = economicData.yieldCurve.data[0].value
      if (latestYield < 0) score -= 20 // Inverted curve is bearish
      confidence += 0.2
    }

    // Credit spreads analysis
    if (economicData?.creditSpreads?.data?.length > 0) {
      const spreads = economicData.creditSpreads.data[0].value
      if (spreads > 500) score -= 15 // High spreads are bearish
      else if (spreads < 300) score += 10 // Low spreads are bullish
      confidence += 0.2
    }

    return {
      value: Math.max(0, Math.min(100, score)),
      level: this.getSentimentLevel(score),
      trend: 'stable',
      confidence: Math.min(1, confidence)
    }
  }

  private getSentimentLevel(value: number): SentimentScore['level'] {
    if (value <= 20) return 'extreme-fear'
    if (value <= 40) return 'fear'
    if (value <= 60) return 'neutral'
    if (value <= 80) return 'greed'
    return 'extreme-greed'
  }

  private calculateTrend(change: number): 'rising' | 'falling' | 'stable' {
    if (Math.abs(change) < 0.5) return 'stable'
    return change > 0 ? 'rising' : 'falling'
  }

  private interpretVIX(vix: number): string {
    if (vix >= 30) return 'Extreme fear - Major market stress'
    if (vix >= 25) return 'High fear - Elevated uncertainty'
    if (vix >= 20) return 'Moderate fear - Some concern'
    if (vix >= 15) return 'Low fear - Normal volatility'
    if (vix >= 12) return 'Very low fear - Calm markets'
    return 'Extremely low fear - Potential complacency'
  }

  private performanceToSentiment(changePercent: number): number {
    // Convert performance to 0-100 sentiment scale
    const clampedChange = Math.max(-10, Math.min(10, changePercent))
    return 50 + (clampedChange * 5) // Each 1% = 5 sentiment points
  }

  private combinesentiments(weightedSentiments: Array<{weight: number, sentiment: SentimentScore}>): SentimentScore {
    let totalValue = 0
    let totalWeight = 0
    let totalConfidence = 0

    weightedSentiments.forEach(({ weight, sentiment }) => {
      totalValue += weight * sentiment.value
      totalWeight += weight
      totalConfidence += weight * sentiment.confidence
    })

    const finalValue = totalWeight > 0 ? totalValue / totalWeight : 50
    const finalConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0

    return {
      value: Math.round(finalValue),
      level: this.getSentimentLevel(finalValue),
      trend: 'stable', // Could be enhanced with trend analysis
      confidence: finalConfidence
    }
  }

  private averageSectorSentiment(sectors: SectorSentiment[]): SentimentScore {
    if (sectors.length === 0) {
      return { value: 50, level: 'neutral', trend: 'stable', confidence: 0 }
    }

    const avgValue = sectors.reduce((sum, s) => sum + s.sentiment.value, 0) / sectors.length
    const avgConfidence = sectors.reduce((sum, s) => sum + s.sentiment.confidence, 0) / sectors.length

    return {
      value: Math.round(avgValue),
      level: this.getSentimentLevel(avgValue),
      trend: 'stable',
      confidence: avgConfidence
    }
  }

  private calculateYieldCurveSentiment(yieldData: any): SentimentScore {
    if (!yieldData?.data?.length) {
      return { value: 50, level: 'neutral', trend: 'stable', confidence: 0 }
    }

    const latestValue = yieldData.data[0].value
    const sentimentValue = latestValue < 0 ? 25 : (latestValue > 2 ? 75 : 50)

    return {
      value: sentimentValue,
      level: this.getSentimentLevel(sentimentValue),
      trend: 'stable',
      confidence: 0.8
    }
  }

  private calculateDollarSentiment(dollarData: any): SentimentScore {
    // Strong dollar can be mixed for sentiment
    const defaultSentiment = { value: 50, level: 'neutral' as const, trend: 'stable' as const, confidence: 0.5 }
    return defaultSentiment
  }

  private calculateCommoditySentiment(marketData: MarketIndicesData | null): SentimentScore {
    // Could be enhanced with commodity ETF data
    return { value: 50, level: 'neutral', trend: 'stable', confidence: 0.3 }
  }

  private extractTrendingSymbols(marketData: MarketIndicesData | null): string[] {
    if (!marketData) return ['SPY', 'QQQ', 'VIX']

    // Extract symbols with significant moves
    const trending = []
    if (marketData.vix && Math.abs(marketData.vix.changePercent) > 5) trending.push('VIX')
    if (marketData.spy && Math.abs(marketData.spy.changePercent) > 2) trending.push('SPY')
    if (marketData.qqq && Math.abs(marketData.qqq.changePercent) > 2) trending.push('QQQ')

    return trending.length > 0 ? trending : ['SPY', 'QQQ', 'VIX']
  }

  private interpretOverallSentiment(value: number): 'bullish' | 'bearish' | 'neutral' {
    if (value > 60) return 'bullish'
    if (value < 40) return 'bearish'
    return 'neutral'
  }

  private calculateDataQuality(marketData: MarketIndicesData | null, economicData: any): number {
    let quality = 0
    let totalSources = 0

    // Market data quality
    if (marketData) {
      quality += marketData.dataQuality || 0.5
      totalSources++
    }

    // Economic data quality
    if (economicData) {
      const economicQuality = Object.values(economicData).filter(d => d !== null).length / 4
      quality += economicQuality
      totalSources++
    }

    return totalSources > 0 ? quality / totalSources : 0.3
  }

  private createDefaultSectorSentiment(symbol: string, name: string): SectorSentiment {
    return {
      symbol,
      name,
      sentiment: { value: 50, level: 'neutral', trend: 'stable', confidence: 0 },
      performance: { day: 0, week: 0, month: 0 },
      volume: { current: 0, average: 0, ratio: 1 },
      timestamp: Date.now()
    }
  }
}