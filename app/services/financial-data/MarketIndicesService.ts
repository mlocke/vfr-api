/**
 * Market Indices Service - Tier 1 Data Collection
 * Tracks VIX, SPY, QQQ, DIA and other major indices
 * HIGH PRIORITY implementation for market context
 */

import { FinancialDataProvider } from './types'
import { PolygonAPI } from './PolygonAPI'
import { TwelveDataAPI } from './TwelveDataAPI'
import { YahooFinanceAPI } from './YahooFinanceAPI'
import { FinancialModelingPrepAPI } from './FinancialModelingPrepAPI'

export interface MarketIndex {
  symbol: string
  name: string
  value: number
  change: number
  changePercent: number
  timestamp: number
  source: string
}

export interface MarketIndicesData {
  vix: MarketIndex | null
  spy: MarketIndex | null
  qqq: MarketIndex | null
  dia: MarketIndex | null
  iwm: MarketIndex | null  // Russell 2000
  sectors: {
    xlf: MarketIndex | null  // Financials
    xlk: MarketIndex | null  // Technology
    xle: MarketIndex | null  // Energy
    xlv: MarketIndex | null  // Healthcare
    xli: MarketIndex | null  // Industrials
    xlc: MarketIndex | null  // Communication
    xlu: MarketIndex | null  // Utilities
    xlre: MarketIndex | null // Real Estate
    xlb: MarketIndex | null  // Materials
    xlp: MarketIndex | null  // Consumer Staples
    xly: MarketIndex | null  // Consumer Discretionary
  }
  international: {
    efa: MarketIndex | null  // Developed Markets
    eem: MarketIndex | null  // Emerging Markets
  }
  timestamp: number
  dataQuality: number  // 0-1 score based on successful retrievals
}

export class MarketIndicesService {
  private providers: Map<string, FinancialDataProvider> = new Map()
  private cache: Map<string, { data: MarketIndex, timestamp: number }> = new Map()
  private cacheTTL = 3600000  // 1 hour cache for indices (was 60000)

  // Core indices to track
  private readonly CORE_INDICES = [
    { symbol: 'VIX', name: 'Volatility Index' },
    { symbol: 'SPY', name: 'S&P 500 ETF' },
    { symbol: 'QQQ', name: 'NASDAQ 100 ETF' },
    { symbol: 'DIA', name: 'Dow Jones ETF' },
    { symbol: 'IWM', name: 'Russell 2000 ETF' }
  ]

  // Sector ETFs for rotation analysis
  private readonly SECTOR_ETFS = [
    { symbol: 'XLF', name: 'Financial Sector' },
    { symbol: 'XLK', name: 'Technology Sector' },
    { symbol: 'XLE', name: 'Energy Sector' },
    { symbol: 'XLV', name: 'Healthcare Sector' },
    { symbol: 'XLI', name: 'Industrial Sector' },
    { symbol: 'XLC', name: 'Communication Sector' },
    { symbol: 'XLU', name: 'Utilities Sector' },
    { symbol: 'XLRE', name: 'Real Estate Sector' },
    { symbol: 'XLB', name: 'Materials Sector' },
    { symbol: 'XLP', name: 'Consumer Staples' },
    { symbol: 'XLY', name: 'Consumer Discretionary' }
  ]

  // International indices
  private readonly INTERNATIONAL_INDICES = [
    { symbol: 'EFA', name: 'Developed Markets' },
    { symbol: 'EEM', name: 'Emerging Markets' }
  ]

  constructor() {
    this.initializeProviders()
  }

  private initializeProviders() {
    // ✅ OPTIMIZED: Priority order for index data to avoid 429 rate limits
    // FMP (300/min) → TwelveData (8/min) → Yahoo (unlimited) → Polygon (5/min)
    if (process.env.FMP_API_KEY) {
      this.providers.set('fmp', new FinancialModelingPrepAPI())
    }
    if (process.env.TWELVE_DATA_API_KEY) {
      this.providers.set('twelvedata', new TwelveDataAPI())
    }
    if (process.env.POLYGON_API_KEY) {
      this.providers.set('polygon', new PolygonAPI())
    }
    // Yahoo as fallback (no key required)
    this.providers.set('yahoo', new YahooFinanceAPI())
  }

  /**
   * Get data for a single index with fallback
   */
  private async getIndexData(symbol: string, name: string): Promise<MarketIndex | null> {
    // Check cache first
    const cached = this.cache.get(symbol)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data
    }

    // Special handling for VIX - use Yahoo Finance first since TwelveData doesn't support it
    // Priority order optimized for rate limits: FMP (300/min) → TwelveData (8/min) → Yahoo → Polygon (5/min)
    let providerOrder = ['fmp', 'twelvedata', 'yahoo', 'polygon']
    let querySymbol = symbol
    if (symbol === 'VIX') {
      providerOrder = ['yahoo', 'fmp', 'polygon'] // Skip TwelveData for VIX
      querySymbol = '^VIX' // Yahoo Finance uses ^VIX for VIX index
    }

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName)
      if (!provider) continue

      try {
        const stockData = await provider.getStockPrice(querySymbol)

        if (stockData) {
          const indexData: MarketIndex = {
            symbol: symbol,
            name: name,
            value: stockData.price,
            change: stockData.change,
            changePercent: stockData.changePercent,
            timestamp: stockData.timestamp,
            source: providerName
          }

          // Validate that we got real data
          if (indexData.changePercent === 0 && indexData.change === 0 && indexData.value === 0) {
            console.warn(`MarketIndicesService: ${symbol} from ${providerName} returned all zeros, trying next provider`)
            continue
          }

          // Cache successful result
          this.cache.set(symbol, { data: indexData, timestamp: Date.now() })
          return indexData
        }
      } catch (error) {
        console.warn(`Failed to get ${symbol} from ${providerName}:`, error)
        continue
      }
    }

    console.error(`MarketIndicesService: Failed to get index data for ${symbol} from all providers`)
    return null
  }

  /**
   * Get all market indices data
   */
  async getAllIndices(): Promise<MarketIndicesData> {
    const startTime = Date.now()

    // Fetch all indices in parallel for speed
    const promises = [
      // Core indices
      ...this.CORE_INDICES.map(idx => this.getIndexData(idx.symbol, idx.name)),
      // Sector ETFs
      ...this.SECTOR_ETFS.map(idx => this.getIndexData(idx.symbol, idx.name)),
      // International
      ...this.INTERNATIONAL_INDICES.map(idx => this.getIndexData(idx.symbol, idx.name))
    ]

    const results = await Promise.all(promises)

    // Map results to structured output
    const data: MarketIndicesData = {
      vix: results[0],
      spy: results[1],
      qqq: results[2],
      dia: results[3],
      iwm: results[4],
      sectors: {
        xlf: results[5],
        xlk: results[6],
        xle: results[7],
        xlv: results[8],
        xli: results[9],
        xlc: results[10],
        xlu: results[11],
        xlre: results[12],
        xlb: results[13],
        xlp: results[14],
        xly: results[15]
      },
      international: {
        efa: results[16],
        eem: results[17]
      },
      timestamp: Date.now(),
      dataQuality: this.calculateDataQuality(results)
    }

    console.log(`Market indices collected in ${Date.now() - startTime}ms`)
    return data
  }

  /**
   * Get VIX specifically (most important volatility indicator)
   */
  async getVIX(): Promise<MarketIndex | null> {
    return this.getIndexData('VIX', 'Volatility Index')
  }

  /**
   * Get major indices only (SPY, QQQ, DIA)
   */
  async getMajorIndices(): Promise<{
    spy: MarketIndex | null
    qqq: MarketIndex | null
    dia: MarketIndex | null
  }> {
    const [spy, qqq, dia] = await Promise.all([
      this.getIndexData('SPY', 'S&P 500 ETF'),
      this.getIndexData('QQQ', 'NASDAQ 100 ETF'),
      this.getIndexData('DIA', 'Dow Jones ETF')
    ])

    return { spy, qqq, dia }
  }

  /**
   * Get sector rotation indicators
   */
  async getSectorRotation(): Promise<{
    sectors: MarketIndicesData['sectors']
    leaders: string[]
    laggards: string[]
  }> {
    const sectorPromises = this.SECTOR_ETFS.map(idx =>
      this.getIndexData(idx.symbol, idx.name)
    )

    const sectorResults = await Promise.all(sectorPromises)

    const sectors: MarketIndicesData['sectors'] = {
      xlf: sectorResults[0],
      xlk: sectorResults[1],
      xle: sectorResults[2],
      xlv: sectorResults[3],
      xli: sectorResults[4],
      xlc: sectorResults[5],
      xlu: sectorResults[6],
      xlre: sectorResults[7],
      xlb: sectorResults[8],
      xlp: sectorResults[9],
      xly: sectorResults[10]
    }

    // Identify leaders and laggards
    const sectorPerformance = Object.entries(sectors)
      .filter(([_, data]) => data !== null)
      .map(([symbol, data]) => ({
        symbol,
        changePercent: data!.changePercent
      }))
      .sort((a, b) => b.changePercent - a.changePercent)

    const leaders = sectorPerformance.slice(0, 3).map(s => s.symbol.toUpperCase())
    const laggards = sectorPerformance.slice(-3).map(s => s.symbol.toUpperCase())

    return { sectors, leaders, laggards }
  }

  /**
   * Analyze market conditions based on indices
   */
  async analyzeMarketConditions(): Promise<{
    vixLevel: 'low' | 'normal' | 'elevated' | 'high'
    marketTrend: 'bullish' | 'neutral' | 'bearish'
    sectorRotation: string[]
    riskLevel: number  // 0-10 scale
  }> {
    const [vix, major, sectors] = await Promise.all([
      this.getVIX(),
      this.getMajorIndices(),
      this.getSectorRotation()
    ])

    // VIX level analysis
    let vixLevel: 'low' | 'normal' | 'elevated' | 'high' = 'normal'
    let riskLevel = 5

    if (vix) {
      if (vix.value < 12) {
        vixLevel = 'low'
        riskLevel = 2
      } else if (vix.value < 20) {
        vixLevel = 'normal'
        riskLevel = 4
      } else if (vix.value < 30) {
        vixLevel = 'elevated'
        riskLevel = 7
      } else {
        vixLevel = 'high'
        riskLevel = 9
      }
    }

    // Market trend analysis
    let marketTrend: 'bullish' | 'neutral' | 'bearish' = 'neutral'
    const avgChange = [major.spy, major.qqq, major.dia]
      .filter(idx => idx !== null)
      .reduce((sum, idx) => sum + idx!.changePercent, 0) / 3

    if (avgChange > 0.5) marketTrend = 'bullish'
    else if (avgChange < -0.5) marketTrend = 'bearish'

    return {
      vixLevel,
      marketTrend,
      sectorRotation: sectors.leaders,
      riskLevel
    }
  }

  /**
   * Calculate data quality score
   */
  private calculateDataQuality(results: (MarketIndex | null)[]): number {
    const successCount = results.filter(r => r !== null).length
    return Number((successCount / results.length).toFixed(2))
  }

  /**
   * Health check for service
   */
  async healthCheck(): Promise<{
    healthy: boolean
    providers: string[]
    cacheSize: number
  }> {
    const availableProviders = Array.from(this.providers.keys())

    return {
      healthy: availableProviders.length > 0,
      providers: availableProviders,
      cacheSize: this.cache.size
    }
  }
}