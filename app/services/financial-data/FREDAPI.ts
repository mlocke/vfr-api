/**
 * FRED (Federal Reserve Economic Data) API implementation
 * Provides access to 800,000+ economic time series from the Federal Reserve Bank of St. Louis
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types.js'
import { RedisCache } from '../cache/RedisCache'

interface FREDObservation {
  realtime_start: string
  realtime_end: string
  date: string
  value: string
}

interface FREDSeries {
  id: string
  realtime_start: string
  realtime_end: string
  title: string
  observation_start: string
  observation_end: string
  frequency: string
  frequency_short: string
  units: string
  units_short: string
  seasonal_adjustment: string
  seasonal_adjustment_short: string
  last_updated: string
  popularity: number
  notes?: string
}

interface FREDObservationsResponse {
  realtime_start: string
  realtime_end: string
  observation_start: string
  observation_end: string
  units: string
  output_type: number
  file_type: string
  order_by: string
  sort_order: string
  count: number
  offset: number
  limit: number
  observations: FREDObservation[]
}

interface FREDSeriesResponse {
  realtime_start: string
  realtime_end: string
  seriess: FREDSeries[]
}

// New interfaces for enhanced economic data analysis
export interface EconomicIndicator {
  series: string
  value: number
  date: string
  change?: number
  changePercent?: number
  momentum?: 'rising' | 'falling' | 'stable'
}

export interface EconomicContext {
  gdp: EconomicIndicator
  cpi: EconomicIndicator
  ppi: EconomicIndicator
  m1MoneySupply: EconomicIndicator
  m2MoneySupply: EconomicIndicator
  federalFundsRate: EconomicIndicator
  unemploymentRate: EconomicIndicator
  yieldCurve: {
    slope10Y2Y: number
    slope10Y3M: number
    isInverted: boolean
    shape: 'normal' | 'flat' | 'inverted' | 'steep'
  }
  lastUpdated: string
  dataCompleteness: number
  responseTimeMs: number
}

export interface CyclePosition {
  phase: 'expansion' | 'peak' | 'contraction' | 'trough' | 'recovery'
  confidence: number
  gdpMomentum: {
    current: number
    trend: 'accelerating' | 'decelerating' | 'stable'
    vsHistorical: 'above' | 'below' | 'normal'
  }
  yieldCurveSignal: {
    recessionProbability: number
    daysInverted: number
    historicalAccuracy: number
  }
  compositeScore: number
  keyIndicators: string[]
  riskFactors: string[]
  lastUpdated: string
}

export interface InflationTrend {
  currentCPI: number
  currentPPI: number
  cpiMomentum: {
    monthOverMonth: number
    yearOverYear: number
    trend: 'accelerating' | 'decelerating' | 'stable'
  }
  ppiMomentum: {
    monthOverMonth: number
    yearOverYear: number
    trend: 'accelerating' | 'decelerating' | 'stable'
  }
  environment: 'low' | 'moderate' | 'high' | 'declining'
  pressureScore: number
  fedTarget: number
  deviation: number
  outlook: 'rising' | 'falling' | 'stable'
  confidence: number
  lastUpdated: string
}

export interface MonetaryContext {
  federalFundsRate: {
    current: number
    target: { min: number; max: number }
    trend: 'tightening' | 'easing' | 'neutral'
    nextMeetingProbability: { raise: number; hold: number; cut: number }
  }
  moneySupply: {
    m1Growth: { current: number; yearOverYear: number; trend: 'expanding' | 'contracting' | 'stable' }
    m2Growth: { current: number; yearOverYear: number; trend: 'expanding' | 'contracting' | 'stable' }
    velocityM2: number
  }
  liquidityConditions: 'abundant' | 'adequate' | 'tight' | 'very_tight'
  equityValuationImpact: {
    score: number
    sentiment: 'supportive' | 'neutral' | 'headwind'
    reasoning: string[]
  }
  policyStance: 'very_dovish' | 'dovish' | 'neutral' | 'hawkish' | 'very_hawkish'
  marketPerformanceCorrelation: number
  lastUpdated: string
}

export class FREDAPI implements FinancialDataProvider {
  name = 'FRED API'
  private baseUrl = 'https://api.stlouisfed.org/fred/'
  private apiKey: string
  private timeout: number
  private throwErrors: boolean
  private cache: RedisCache

  // Enhanced economic indicators for bulk collection
  private readonly ECONOMIC_INDICATORS = {
    // Core Economic Growth
    'GDP': 'Gross Domestic Product',
    'GDPC1': 'Real Gross Domestic Product',
    'GDPPOT': 'Real Potential Gross Domestic Product',
    'GDPC1_PCT_CHANGE': 'Real GDP Quarter-over-Quarter Change',

    // Inflation Indicators
    'CPIAUCSL': 'Consumer Price Index for All Urban Consumers: All Items',
    'CPILFESL': 'Consumer Price Index for All Urban Consumers: All Items Less Food and Energy',
    'PPIACO': 'Producer Price Index by Commodity: All Commodities',
    'PPIFIS': 'Producer Price Index by Commodity: Final Demand',
    'PCEPI': 'Personal Consumption Expenditures: Chain-type Price Index',

    // Money Supply & Monetary Policy
    'M1SL': 'M1 Money Stock',
    'M2SL': 'M2 Money Stock',
    'M2V': 'Velocity of M2 Money Stock',
    'FEDFUNDS': 'Federal Funds Effective Rate',
    'DFEDTARU': 'Federal Funds Target Rate - Upper Limit',
    'DFEDTARL': 'Federal Funds Target Rate - Lower Limit',

    // Labor Market
    'UNRATE': 'Unemployment Rate',
    'CIVPART': 'Labor Force Participation Rate',
    'PAYEMS': 'All Employees, Total Nonfarm',
    'UNEMPLOY': 'Unemployment Level',
    'NFCI': 'Chicago Fed National Financial Conditions Index',

    // Treasury Rates (Yield Curve)
    'DGS3MO': '3-Month Treasury Constant Maturity Rate',
    'DGS6MO': '6-Month Treasury Constant Maturity Rate',
    'DGS1': '1-Year Treasury Constant Maturity Rate',
    'DGS2': '2-Year Treasury Constant Maturity Rate',
    'DGS5': '5-Year Treasury Constant Maturity Rate',
    'DGS10': '10-Year Treasury Constant Maturity Rate',
    'DGS20': '20-Year Treasury Constant Maturity Rate',
    'DGS30': '30-Year Treasury Constant Maturity Rate',
    'T10Y2Y': '10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity',
    'T10Y3M': '10-Year Treasury Constant Maturity Minus 3-Month Treasury Constant Maturity'
  }

  // Popular economic indicators
  private readonly POPULAR_SERIES = {
    // GDP and Growth
    'GDP': 'Gross Domestic Product',
    'GDPC1': 'Real Gross Domestic Product',
    'GDPPOT': 'Real Potential Gross Domestic Product',

    // Employment
    'UNRATE': 'Unemployment Rate',
    'CIVPART': 'Labor Force Participation Rate',
    'PAYEMS': 'All Employees, Total Nonfarm',
    'UNEMPLOY': 'Unemployment Level',

    // Inflation
    'CPIAUCSL': 'Consumer Price Index for All Urban Consumers: All Items',
    'CPILFESL': 'Consumer Price Index for All Urban Consumers: All Items Less Food and Energy',
    'PCEPI': 'Personal Consumption Expenditures: Chain-type Price Index',

    // Interest Rates
    'FEDFUNDS': 'Federal Funds Effective Rate',
    'DGS3MO': '3-Month Treasury Constant Maturity Rate',
    'DGS10': '10-Year Treasury Constant Maturity Rate',
    'DGS30': '30-Year Treasury Constant Maturity Rate',

    // Exchange Rates
    'DEXUSEU': 'U.S. / Euro Foreign Exchange Rate',
    'DEXJPUS': 'Japan / U.S. Foreign Exchange Rate',
    'DEXCHUS': 'China / U.S. Foreign Exchange Rate',

    // Money Supply (keeping for backward compatibility)
    'M1SL': 'M1 Money Stock',
    'M2SL': 'M2 Money Stock',
    'M2V': 'Velocity of M2 Money Stock',

    // Housing
    'HOUST': 'Housing Starts: Total: New Privately Owned Housing Units Started',
    'CSUSHPISA': 'S&P/Case-Shiller U.S. National Home Price Index',

    // Industrial
    'INDPRO': 'Industrial Production Index',
    'CAPACITY': 'Capacity Utilization: Total Industry',

    // Financial Conditions
    'NFCI': 'Chicago Fed National Financial Conditions Index',
    'ANFCI': 'Chicago Fed National Financial Conditions Index (Adjusted)',

    // Yield Curve Spreads
    'T10Y2Y': '10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity',
    'T10Y3M': '10-Year Treasury Constant Maturity Minus 3-Month Treasury Constant Maturity'
  }

  constructor(apiKey?: string, timeout = 15000, throwErrors = false) {
    this.apiKey = apiKey || process.env.FRED_API_KEY || ''
    this.timeout = timeout
    this.throwErrors = throwErrors
    this.cache = RedisCache.getInstance()

    // Validate API key format if provided
    if (this.apiKey && !this.isValidApiKeyFormat(this.apiKey)) {
      console.warn('FRED API key format is invalid. Key must be a 32-character lowercase alphanumeric string.')
      if (this.throwErrors) {
        throw new Error('FRED API key format is invalid. Key must be a 32-character lowercase alphanumeric string.')
      }
    }
  }

  /**
   * Validate FRED API key format
   * FRED requires a 32-character lowercase alphanumeric string
   */
  private isValidApiKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false
    // FRED API key must be exactly 32 characters, lowercase alphanumeric
    const fredKeyPattern = /^[a-z0-9]{32}$/
    return fredKeyPattern.test(apiKey)
  }

  /**
   * Get current economic data for a series (adapts to StockData interface)
   * For FRED, we treat series as "symbols" and return economic data
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('FRED API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      if (!this.isValidApiKeyFormat(this.apiKey)) {
        const error = new Error('FRED API key format is invalid. Key must be a 32-character lowercase alphanumeric string.')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      // Get latest observation for the series
      const observation = await this.getLatestObservation(symbol.toUpperCase())
      if (!observation) {
        const error = new Error(`No data found for FRED series: ${symbol}`)
        if (this.throwErrors) throw error
        return null
      }

      const value = parseFloat(observation.value)
      if (isNaN(value)) {
        const error = new Error(`Invalid data value for FRED series: ${symbol}`)
        if (this.throwErrors) throw error
        return null
      }

      // For economic data, we don't have traditional "change" so we'll set to 0
      // In a real implementation, you might calculate change from previous period
      return {
        symbol: symbol.toUpperCase(),
        price: Number(value.toFixed(2)),
        change: 0, // Economic data doesn't have traditional "change"
        changePercent: 0, // Would need historical data to calculate
        volume: 0, // Not applicable for economic data
        timestamp: new Date(observation.date).getTime(),
        source: 'fred'
      }
    } catch (error) {
      console.error(`FRED API error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Get series information (adapts to CompanyInfo interface)
   * For FRED, we return series metadata as "company info"
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('FRED API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      if (!this.isValidApiKeyFormat(this.apiKey)) {
        const error = new Error('FRED API key format is invalid. Key must be a 32-character lowercase alphanumeric string.')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const seriesInfo = await this.getSeriesInfo(symbol.toUpperCase())
      if (!seriesInfo) {
        const error = new Error(`Series not found: ${symbol}`)
        if (this.throwErrors) throw error
        return null
      }

      return {
        symbol: symbol.toUpperCase(),
        name: seriesInfo.title || this.POPULAR_SERIES[symbol.toUpperCase() as keyof typeof this.POPULAR_SERIES] || symbol,
        description: seriesInfo.notes || `FRED economic data series: ${seriesInfo.title}`,
        sector: 'Economic Data',
        marketCap: 0, // Not applicable for economic data
        employees: 0 // Not applicable for economic data
      }
    } catch (error) {
      console.error(`FRED series info error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Get market data (adapts to MarketData interface)
   * For FRED, we return latest observation data
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('FRED API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      if (!this.isValidApiKeyFormat(this.apiKey)) {
        const error = new Error('FRED API key format is invalid. Key must be a 32-character lowercase alphanumeric string.')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const observation = await this.getLatestObservation(symbol.toUpperCase())
      if (!observation) {
        const error = new Error(`No market data found for FRED series: ${symbol}`)
        if (this.throwErrors) throw error
        return null
      }

      const value = parseFloat(observation.value)
      if (isNaN(value)) {
        const error = new Error(`Invalid market data value for FRED series: ${symbol}`)
        if (this.throwErrors) throw error
        return null
      }

      // For economic data, we use the value as all OHLC values since there's no intraday trading
      return {
        symbol: symbol.toUpperCase(),
        open: Number(value.toFixed(2)),
        high: Number(value.toFixed(2)),
        low: Number(value.toFixed(2)),
        close: Number(value.toFixed(2)),
        volume: 0, // Not applicable for economic data
        timestamp: new Date(observation.date).getTime(),
        source: 'fred'
      }
    } catch (error) {
      console.error(`FRED market data error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Health check for FRED API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        console.warn('FRED API key not configured')
        return false
      }

      if (!this.isValidApiKeyFormat(this.apiKey)) {
        console.warn('FRED API key format is invalid. Key must be a 32-character lowercase alphanumeric string.')
        return false
      }

      // Test with a simple category request (category 0 is root)
      const response = await this.makeRequest('category', {
        category_id: '0'
      })

      return response.success && !!response.data?.categories
    } catch (error) {
      console.error('FRED health check failed:', error instanceof Error ? error.message : error)
      return false
    }
  }

  /**
   * Get latest observation for a FRED series
   */
  private async getLatestObservation(seriesId: string): Promise<FREDObservation | null> {
    try {
      console.log(`🔍 Getting latest observation for ${seriesId}...`)
      const response = await this.makeRequest('series/observations', {
        series_id: seriesId,
        limit: '1',
        sort_order: 'desc'
      })

      console.log(`📊 Response for ${seriesId}:`, {
        success: response.success,
        hasData: !!response.data,
        hasObservations: !!response.data?.observations,
        observationsLength: response.data?.observations?.length,
        error: response.error
      })

      if (!response.success) {
        console.error(`❌ Request failed for ${seriesId}:`, response.error)
        return null
      }

      if (!response.data?.observations?.length) {
        console.warn(`⚠️ No observations found for ${seriesId}`)
        return null
      }

      const observations = response.data.observations as FREDObservation[]
      console.log(`✅ Found observation for ${seriesId}:`, observations[0])
      return observations[0]
    } catch (error) {
      console.error(`Failed to get latest observation for ${seriesId}:`, error)
      return null
    }
  }

  /**
   * Get series information
   */
  private async getSeriesInfo(seriesId: string): Promise<FREDSeries | null> {
    try {
      const response = await this.makeRequest('series', {
        series_id: seriesId
      })

      if (!response.success || !response.data?.seriess?.length) {
        return null
      }

      const series = response.data.seriess as FREDSeries[]
      return series[0]
    } catch (error) {
      console.error(`Failed to get series info for ${seriesId}:`, error)
      return null
    }
  }

  /**
   * Search for FRED series
   */
  async searchSeries(searchText: string, limit = 50): Promise<FREDSeries[]> {
    try {
      if (!this.apiKey) {
        console.warn('FRED API key not configured')
        return []
      }

      if (!this.isValidApiKeyFormat(this.apiKey)) {
        console.warn('FRED API key format is invalid. Key must be a 32-character lowercase alphanumeric string.')
        return []
      }

      const response = await this.makeRequest('series/search', {
        search_text: searchText,
        limit: limit.toString(),
        sort_order: 'search_rank'
      })

      if (!response.success || !response.data?.seriess) {
        return []
      }

      return response.data.seriess as FREDSeries[]
    } catch (error) {
      console.error(`FRED series search error for "${searchText}":`, error)
      return []
    }
  }

  /**
   * Get treasury rates with analysis data for Tier 1 analysis
   */
  async getTreasuryRates(): Promise<{[key: string]: number} | null> {
    try {
      if (!this.apiKey) {
        console.warn('FRED API key not configured')
        return null
      }

      // Treasury rate series from FRED
      const treasurySeries = {
        '3M': 'DGS3MO',
        '6M': 'DGS6MO',
        '1Y': 'DGS1',
        '2Y': 'DGS2',
        '5Y': 'DGS5',
        '10Y': 'DGS10',
        '20Y': 'DGS20',
        '30Y': 'DGS30'
      }

      const rates: {[key: string]: number} = {}

      // Get all treasury rates in parallel
      const promises = Object.entries(treasurySeries).map(async ([period, seriesId]) => {
        try {
          const observation = await this.getLatestObservation(seriesId)
          if (observation && observation.value !== '.') {
            rates[period] = parseFloat(observation.value)
          }
        } catch (error) {
          console.warn(`Failed to get ${period} treasury rate:`, error)
        }
      })

      await Promise.all(promises)

      console.log('📊 Treasury rates collected:', rates)
      return Object.keys(rates).length > 0 ? rates : null
    } catch (error) {
      console.error('FRED treasury rates error:', error)
      return null
    }
  }

  /**
   * Get enhanced treasury analysis data including changes and yield curve
   */
  async getTreasuryAnalysisData(): Promise<any> {
    try {
      if (!this.apiKey) {
        console.warn('FRED API key not configured')
        return null
      }

      // Key treasury series for analysis
      const keySeries = {
        '3M': 'DGS3MO',
        '2Y': 'DGS2',
        '10Y': 'DGS10',
        '30Y': 'DGS30'
      }

      const analysisData: any = {
        rates: {},
        changes: {},
        yieldCurve: {},
        context: {}
      }

      // Get current and previous day data for each series
      for (const [period, seriesId] of Object.entries(keySeries)) {
        try {
          const observations = await this.getRecentObservations(seriesId, 5) // Get last 5 days
          if (observations && observations.length >= 2) {
            const current = parseFloat(observations[0].value)
            const previous = parseFloat(observations[1].value)

            if (!isNaN(current) && !isNaN(previous)) {
              analysisData.rates[period] = current
              analysisData.changes[period] = current - previous // Basis point change
            }
          }
        } catch (error) {
          console.warn(`Failed to get analysis data for ${period}:`, error)
        }
      }

      // Calculate yield curve slopes
      if (analysisData.rates['10Y'] && analysisData.rates['2Y']) {
        analysisData.yieldCurve.slope_10Y_2Y = analysisData.rates['10Y'] - analysisData.rates['2Y']
        analysisData.yieldCurve.isInverted = analysisData.yieldCurve.slope_10Y_2Y < 0
      }

      if (analysisData.rates['10Y'] && analysisData.rates['3M']) {
        analysisData.yieldCurve.slope_10Y_3M = analysisData.rates['10Y'] - analysisData.rates['3M']
      }

      if (analysisData.rates['30Y'] && analysisData.rates['10Y']) {
        analysisData.yieldCurve.slope_30Y_10Y = analysisData.rates['30Y'] - analysisData.rates['10Y']
      }

      // Analyze rate momentum
      const totalChanges = Object.values(analysisData.changes).filter(c => typeof c === 'number')
      if (totalChanges.length > 0) {
        const avgChange = totalChanges.reduce((sum: number, change: any) => sum + change, 0) / totalChanges.length

        if (avgChange > 0.02) {
          analysisData.context.momentum = 'rising'
        } else if (avgChange < -0.02) {
          analysisData.context.momentum = 'falling'
        } else {
          analysisData.context.momentum = 'stable'
        }

        analysisData.context.avgDailyChange = Math.round(avgChange * 100) / 100 // Round to 2 decimals
      }

      // Classify yield curve shape
      if (analysisData.yieldCurve.slope_10Y_2Y !== undefined) {
        if (analysisData.yieldCurve.slope_10Y_2Y < 0) {
          analysisData.yieldCurve.shape = 'inverted'
        } else if (analysisData.yieldCurve.slope_10Y_2Y < 0.5) {
          analysisData.yieldCurve.shape = 'flat'
        } else if (analysisData.yieldCurve.slope_10Y_2Y > 2.0) {
          analysisData.yieldCurve.shape = 'steep'
        } else {
          analysisData.yieldCurve.shape = 'normal'
        }
      }

      analysisData.context.lastUpdate = new Date().toISOString()
      console.log('📈 Treasury analysis data:', analysisData)

      return analysisData

    } catch (error) {
      console.error('FRED treasury analysis error:', error)
      return null
    }
  }

  /**
   * Get recent observations for a series (for trend analysis)
   */
  private async getRecentObservations(seriesId: string, limit: number = 5): Promise<FREDObservation[] | null> {
    try {
      const response = await this.makeRequest('series/observations', {
        series_id: seriesId,
        limit: limit.toString(),
        sort_order: 'desc'
      })

      if (!response.success || !response.data?.observations) {
        return null
      }

      // Filter out missing values (marked as '.')
      const validObservations = response.data.observations.filter((obs: FREDObservation) => obs.value !== '.')
      return validObservations.length > 0 ? validObservations : null
    } catch (error) {
      console.error(`Failed to get recent observations for ${seriesId}:`, error)
      return null
    }
  }

  /**
   * Get popular economic indicators
   */
  getPopularIndicators(): Array<{symbol: string, name: string}> {
    return Object.entries(this.POPULAR_SERIES).map(([symbol, name]) => ({
      symbol,
      name
    }))
  }

  /**
   * Get stocks by sector (not applicable for FRED - returns empty array)
   */
  async getStocksBySector(sector: string, limit = 20): Promise<StockData[]> {
    console.warn('FRED does not support sector-based stock queries')
    return []
  }

  // ===== ENHANCED ECONOMIC DATA METHODS =====

  /**
   * Bulk data collection method - fetches key economic indicators in parallel
   * Target response time: <200ms with caching (4-hour TTL)
   */
  async getEconomicContext(): Promise<EconomicContext | null> {
    const startTime = Date.now()

    try {
      if (!this.apiKey || !this.isValidApiKeyFormat(this.apiKey)) {
        console.warn('FRED API key not configured or invalid')
        return null
      }

      // Check cache first (4-hour TTL)
      const cacheKey = 'fred:economic_context'
      const cached = await this.cache.get<EconomicContext>(cacheKey)
      if (cached) {
        console.log('📊 Returning cached economic context')
        return cached
      }

      console.log('🔍 Fetching fresh economic context from FRED API...')

      // Core indicators for economic context
      const coreIndicators = {
        gdp: 'GDPC1',              // Real GDP
        cpi: 'CPIAUCSL',           // Consumer Price Index
        ppi: 'PPIACO',             // Producer Price Index
        m1MoneySupply: 'M1SL',     // M1 Money Supply
        m2MoneySupply: 'M2SL',     // M2 Money Supply
        federalFundsRate: 'FEDFUNDS', // Federal Funds Rate
        unemploymentRate: 'UNRATE',   // Unemployment Rate
        treasuryRate2Y: 'DGS2',    // 2-Year Treasury
        treasuryRate10Y: 'DGS10',  // 10-Year Treasury
        treasuryRate3M: 'DGS3MO'   // 3-Month Treasury
      }

      // Fetch all indicators in parallel for performance
      const promises = Object.entries(coreIndicators).map(async ([key, seriesId]) => {
        try {
          const observations = await this.getRecentObservations(seriesId, 3)
          return { key, observations, seriesId }
        } catch (error) {
          console.warn(`Failed to fetch ${key} (${seriesId}):`, error)
          return { key, observations: null, seriesId }
        }
      })

      const results = await Promise.allSettled(promises)
      const responseTime = Date.now() - startTime

      // Process results into economic context
      const context: any = {
        lastUpdated: new Date().toISOString(),
        dataCompleteness: 0,
        responseTimeMs: responseTime
      }

      let successfulFetches = 0
      const totalIndicators = Object.keys(coreIndicators).length

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.observations) {
          const { key, observations } = result.value
          successfulFetches++

          const current = observations[0]
          const previous = observations[1]
          const value = parseFloat(current.value)

          if (!isNaN(value)) {
            const indicator: EconomicIndicator = {
              series: result.value.seriesId,
              value: Number(value.toFixed(4)),
              date: current.date,
              change: previous ? Number((value - parseFloat(previous.value)).toFixed(4)) : undefined,
              changePercent: previous && parseFloat(previous.value) !== 0 ?
                Number(((value - parseFloat(previous.value)) / parseFloat(previous.value) * 100).toFixed(2)) : undefined
            }

            // Add momentum analysis
            if (indicator.changePercent !== undefined) {
              if (Math.abs(indicator.changePercent) < 0.1) {
                indicator.momentum = 'stable'
              } else if (indicator.changePercent > 0) {
                indicator.momentum = 'rising'
              } else {
                indicator.momentum = 'falling'
              }
            }

            context[key] = indicator
          }
        }
      }

      context.dataCompleteness = Number((successfulFetches / totalIndicators).toFixed(2))

      // Calculate yield curve analysis
      if (context.treasuryRate10Y && context.treasuryRate2Y && context.treasuryRate3M) {
        const slope10Y2Y = context.treasuryRate10Y.value - context.treasuryRate2Y.value
        const slope10Y3M = context.treasuryRate10Y.value - context.treasuryRate3M.value

        context.yieldCurve = {
          slope10Y2Y: Number(slope10Y2Y.toFixed(4)),
          slope10Y3M: Number(slope10Y3M.toFixed(4)),
          isInverted: slope10Y2Y < 0,
          shape: slope10Y2Y < 0 ? 'inverted' :
                 slope10Y2Y < 0.5 ? 'flat' :
                 slope10Y2Y > 2.0 ? 'steep' : 'normal'
        }
      }

      // Remove temporary treasury rate fields
      delete context.treasuryRate2Y
      delete context.treasuryRate10Y
      delete context.treasuryRate3M

      // Cache for 4 hours (14400 seconds)
      await this.cache.set(cacheKey, context, 14400, {
        source: 'fred',
        version: '1.0.0'
      })

      console.log(`✅ Economic context fetched in ${responseTime}ms with ${(context.dataCompleteness * 100).toFixed(1)}% completeness`)
      return context as EconomicContext

    } catch (error) {
      const responseTime = Date.now() - startTime
      console.error(`FRED economic context error (${responseTime}ms):`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Economic cycle correlation analysis with recession probability
   * Uses GDP momentum, yield curve, and employment data
   */
  async getEconomicCyclePosition(): Promise<CyclePosition | null> {
    try {
      if (!this.apiKey || !this.isValidApiKeyFormat(this.apiKey)) {
        console.warn('FRED API key not configured or invalid')
        return null
      }

      // Check cache first (2-hour TTL)
      const cacheKey = 'fred:economic_cycle_position'
      const cached = await this.cache.get<CyclePosition>(cacheKey)
      if (cached) {
        console.log('📊 Returning cached economic cycle position')
        return cached
      }

      console.log('🔍 Analyzing economic cycle position...')

      // Get key cycle indicators with historical data
      const gdpData = await this.getRecentObservations('GDPC1', 8) // 2 years quarterly
      const yieldSpread = await this.getRecentObservations('T10Y2Y', 20) // 20 observations
      const unemploymentData = await this.getRecentObservations('UNRATE', 12) // 12 months
      const nfciData = await this.getRecentObservations('NFCI', 12) // Financial conditions

      if (!gdpData || !yieldSpread || !unemploymentData) {
        console.warn('Insufficient data for economic cycle analysis')
        return null
      }

      // GDP Momentum Analysis
      const currentGDP = parseFloat(gdpData[0].value)
      const previousGDP = parseFloat(gdpData[1].value)
      const gdpGrowth = ((currentGDP - previousGDP) / previousGDP) * 100

      // Historical GDP growth average (rough estimate)
      const historicalGDPs = gdpData.slice(0, 6).map(obs => parseFloat(obs.value))
      const avgGrowth = historicalGDPs.reduce((sum, val, i) => {
        if (i === 0) return sum
        return sum + ((val - historicalGDPs[i-1]) / historicalGDPs[i-1]) * 100
      }, 0) / (historicalGDPs.length - 1)

      // Yield Curve Analysis
      const currentSpread = parseFloat(yieldSpread[0].value)
      const daysInverted = yieldSpread.filter(obs => parseFloat(obs.value) < 0).length
      const recessionProbability = Math.max(0, Math.min(100,
        (daysInverted / yieldSpread.length) * 100 + (currentSpread < 0 ? 30 : 0)
      ))

      // Composite Economic Score
      let compositeScore = 50 // Neutral baseline

      // GDP contribution
      if (gdpGrowth > avgGrowth * 1.2) compositeScore += 20
      else if (gdpGrowth > avgGrowth) compositeScore += 10
      else if (gdpGrowth < 0) compositeScore -= 30
      else if (gdpGrowth < avgGrowth * 0.5) compositeScore -= 20

      // Yield curve contribution
      if (currentSpread < -0.5) compositeScore -= 25
      else if (currentSpread < 0) compositeScore -= 15
      else if (currentSpread > 2) compositeScore += 15

      // Unemployment trend
      const currentUnemployment = parseFloat(unemploymentData[0].value)
      const previousUnemployment = parseFloat(unemploymentData[3].value) // 3 months ago
      if (currentUnemployment < previousUnemployment) compositeScore += 10
      else if (currentUnemployment > previousUnemployment * 1.1) compositeScore -= 15

      // Determine cycle phase
      let phase: CyclePosition['phase']
      if (compositeScore >= 75) phase = 'expansion'
      else if (compositeScore >= 60) phase = 'peak'
      else if (compositeScore >= 40) phase = 'recovery'
      else if (compositeScore >= 25) phase = 'trough'
      else phase = 'contraction'

      const cyclePosition: CyclePosition = {
        phase,
        confidence: Math.min(95, Math.max(60, compositeScore)),
        gdpMomentum: {
          current: Number(gdpGrowth.toFixed(2)),
          trend: gdpGrowth > avgGrowth * 1.1 ? 'accelerating' :
                 gdpGrowth < avgGrowth * 0.9 ? 'decelerating' : 'stable',
          vsHistorical: gdpGrowth > avgGrowth * 1.2 ? 'above' :
                       gdpGrowth < avgGrowth * 0.8 ? 'below' : 'normal'
        },
        yieldCurveSignal: {
          recessionProbability: Number(recessionProbability.toFixed(1)),
          daysInverted,
          historicalAccuracy: 78.5 // Based on historical yield curve recession prediction accuracy
        },
        compositeScore: Number(compositeScore.toFixed(1)),
        keyIndicators: [
          `GDP Growth: ${gdpGrowth.toFixed(2)}% (vs ${avgGrowth.toFixed(2)}% avg)`,
          `Yield Spread: ${currentSpread.toFixed(2)}%`,
          `Unemployment: ${currentUnemployment.toFixed(1)}%`
        ],
        riskFactors: [],
        lastUpdated: new Date().toISOString()
      }

      // Add risk factors based on conditions
      if (currentSpread < 0) {
        cyclePosition.riskFactors.push('Inverted yield curve signals recession risk')
      }
      if (gdpGrowth < 0.5) {
        cyclePosition.riskFactors.push('Weak GDP growth indicates economic slowdown')
      }
      if (currentUnemployment > previousUnemployment * 1.05) {
        cyclePosition.riskFactors.push('Rising unemployment suggests labor market weakening')
      }

      // Cache for 2 hours
      await this.cache.set(cacheKey, cyclePosition, 7200, {
        source: 'fred',
        version: '1.0.0'
      })

      console.log(`✅ Economic cycle analysis complete: ${phase} phase with ${cyclePosition.confidence}% confidence`)
      return cyclePosition

    } catch (error) {
      console.error('FRED economic cycle analysis error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Inflation trend analysis with CPI/PPI momentum and environment classification
   */
  async getInflationTrendAnalysis(): Promise<InflationTrend | null> {
    try {
      if (!this.apiKey || !this.isValidApiKeyFormat(this.apiKey)) {
        console.warn('FRED API key not configured or invalid')
        return null
      }

      // Check cache first (1-hour TTL)
      const cacheKey = 'fred:inflation_trend'
      const cached = await this.cache.get<InflationTrend>(cacheKey)
      if (cached) {
        console.log('📊 Returning cached inflation trend analysis')
        return cached
      }

      console.log('🔍 Analyzing inflation trends...')

      // Get inflation data with sufficient history for trend analysis
      const cpiData = await this.getRecentObservations('CPIAUCSL', 25) // 24+ months
      const ppiData = await this.getRecentObservations('PPIACO', 25)
      const fedFundsData = await this.getRecentObservations('FEDFUNDS', 5)

      if (!cpiData || !ppiData || cpiData.length < 13 || ppiData.length < 13) {
        console.warn('Insufficient inflation data for trend analysis')
        return null
      }

      const currentCPI = parseFloat(cpiData[0].value)
      const currentPPI = parseFloat(ppiData[0].value)
      const currentFedRate = fedFundsData ? parseFloat(fedFundsData[0].value) : 5.25 // Default Fed target

      // Calculate momentum (MoM and YoY)
      const cpiMoM = ((currentCPI - parseFloat(cpiData[1].value)) / parseFloat(cpiData[1].value)) * 100
      const cpiYoY = ((currentCPI - parseFloat(cpiData[12].value)) / parseFloat(cpiData[12].value)) * 100

      const ppiMoM = ((currentPPI - parseFloat(ppiData[1].value)) / parseFloat(ppiData[1].value)) * 100
      const ppiYoY = ((currentPPI - parseFloat(ppiData[12].value)) / parseFloat(ppiData[12].value)) * 100

      // Determine trends
      const cpiTrend = Math.abs(cpiMoM) < 0.1 ? 'stable' :
                      cpiMoM > cpiYoY / 12 ? 'accelerating' : 'decelerating'
      const ppiTrend = Math.abs(ppiMoM) < 0.1 ? 'stable' :
                      ppiMoM > ppiYoY / 12 ? 'accelerating' : 'decelerating'

      // Classify inflation environment
      let environment: InflationTrend['environment']
      if (cpiYoY < 1.5) environment = 'low'
      else if (cpiYoY < 3.0) environment = 'moderate'
      else if (cpiYoY >= 3.0 && cpiTrend === 'decelerating') environment = 'declining'
      else environment = 'high'

      // Calculate pressure score (0-100)
      const pressureScore = Math.min(100, Math.max(0,
        (cpiYoY / 6 * 50) + (ppiYoY / 8 * 30) + (cpiTrend === 'accelerating' ? 20 : 0)
      ))

      const fedTarget = 2.0 // Fed's inflation target
      const deviation = cpiYoY - fedTarget

      // Determine outlook
      let outlook: InflationTrend['outlook']
      if (cpiTrend === 'accelerating' && ppiTrend === 'accelerating') outlook = 'rising'
      else if (cpiTrend === 'decelerating' && ppiTrend === 'decelerating') outlook = 'falling'
      else outlook = 'stable'

      const inflationTrend: InflationTrend = {
        currentCPI: Number(currentCPI.toFixed(1)),
        currentPPI: Number(currentPPI.toFixed(1)),
        cpiMomentum: {
          monthOverMonth: Number((cpiMoM * 12).toFixed(2)), // Annualized
          yearOverYear: Number(cpiYoY.toFixed(2)),
          trend: cpiTrend
        },
        ppiMomentum: {
          monthOverMonth: Number((ppiMoM * 12).toFixed(2)), // Annualized
          yearOverYear: Number(ppiYoY.toFixed(2)),
          trend: ppiTrend
        },
        environment,
        pressureScore: Number(pressureScore.toFixed(1)),
        fedTarget,
        deviation: Number(deviation.toFixed(2)),
        outlook,
        confidence: Math.min(95, Math.max(70, 100 - Math.abs(deviation) * 10)),
        lastUpdated: new Date().toISOString()
      }

      // Cache for 1 hour
      await this.cache.set(cacheKey, inflationTrend, 3600, {
        source: 'fred',
        version: '1.0.0'
      })

      console.log(`✅ Inflation analysis complete: ${environment} environment, ${outlook} outlook`)
      return inflationTrend

    } catch (error) {
      console.error('FRED inflation trend analysis error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Monetary policy context with M1/M2 analysis and equity valuation impact
   */
  async getMonetaryPolicyContext(): Promise<MonetaryContext | null> {
    try {
      if (!this.apiKey || !this.isValidApiKeyFormat(this.apiKey)) {
        console.warn('FRED API key not configured or invalid')
        return null
      }

      // Check cache first (2-hour TTL)
      const cacheKey = 'fred:monetary_policy_context'
      const cached = await this.cache.get<MonetaryContext>(cacheKey)
      if (cached) {
        console.log('📊 Returning cached monetary policy context')
        return cached
      }

      console.log('🔍 Analyzing monetary policy context...')

      // Get monetary policy indicators
      const [fedFundsData, m1Data, m2Data, m2VelocityData] = await Promise.all([
        this.getRecentObservations('FEDFUNDS', 12),
        this.getRecentObservations('M1SL', 25),
        this.getRecentObservations('M2SL', 25),
        this.getRecentObservations('M2V', 20)
      ])

      if (!fedFundsData || !m1Data || !m2Data) {
        console.warn('Insufficient monetary policy data')
        return null
      }

      const currentFedRate = parseFloat(fedFundsData[0].value)
      const currentM1 = parseFloat(m1Data[0].value)
      const currentM2 = parseFloat(m2Data[0].value)
      const currentM2Velocity = m2VelocityData ? parseFloat(m2VelocityData[0].value) : 1.1

      // Calculate growth rates
      const m1YoY = ((currentM1 - parseFloat(m1Data[12].value)) / parseFloat(m1Data[12].value)) * 100
      const m2YoY = ((currentM2 - parseFloat(m2Data[12].value)) / parseFloat(m2Data[12].value)) * 100

      const m1QoQ = ((currentM1 - parseFloat(m1Data[3].value)) / parseFloat(m1Data[3].value)) * 100 * 4 // Annualized
      const m2QoQ = ((currentM2 - parseFloat(m2Data[3].value)) / parseFloat(m2Data[3].value)) * 100 * 4

      // Determine trends
      const m1Trend = Math.abs(m1QoQ) < 2 ? 'stable' : m1QoQ > 0 ? 'expanding' : 'contracting'
      const m2Trend = Math.abs(m2QoQ) < 2 ? 'stable' : m2QoQ > 0 ? 'expanding' : 'contracting'

      // Fed policy stance analysis
      const fedTrend = currentFedRate > parseFloat(fedFundsData[3].value) + 0.1 ? 'tightening' :
                      currentFedRate < parseFloat(fedFundsData[3].value) - 0.1 ? 'easing' : 'neutral'

      // Liquidity conditions
      let liquidityConditions: MonetaryContext['liquidityConditions']
      if (m2YoY > 8 && currentFedRate < 2) liquidityConditions = 'abundant'
      else if (m2YoY > 4 && currentFedRate < 4) liquidityConditions = 'adequate'
      else if (m2YoY < 2 || currentFedRate > 5) liquidityConditions = 'tight'
      else liquidityConditions = 'very_tight'

      // Policy stance classification
      let policyStance: MonetaryContext['policyStance']
      if (currentFedRate < 1 && m2YoY > 10) policyStance = 'very_dovish'
      else if (currentFedRate < 3 && fedTrend === 'easing') policyStance = 'dovish'
      else if (currentFedRate > 5 && fedTrend === 'tightening') policyStance = 'hawkish'
      else if (currentFedRate > 7) policyStance = 'very_hawkish'
      else policyStance = 'neutral'

      // Equity valuation impact analysis
      let equityScore = 50 // Neutral
      if (currentFedRate < 2) equityScore += 25
      else if (currentFedRate > 5) equityScore -= 25

      if (m2YoY > 8) equityScore += 15
      else if (m2YoY < 2) equityScore -= 15

      if (currentM2Velocity < 1.0) equityScore += 10 // Low velocity = more supportive

      const equitySentiment = equityScore > 70 ? 'supportive' :
                             equityScore < 30 ? 'headwind' : 'neutral'

      const reasoning = []
      if (currentFedRate < 3) reasoning.push('Low interest rates support equity valuations')
      if (m2YoY > 6) reasoning.push('Money supply growth provides market liquidity')
      if (currentFedRate > 5) reasoning.push('High rates increase discount rates for equity valuations')
      if (liquidityConditions === 'tight') reasoning.push('Tight liquidity conditions pressure risk assets')

      const monetaryContext: MonetaryContext = {
        federalFundsRate: {
          current: Number(currentFedRate.toFixed(2)),
          target: { min: Math.max(0, currentFedRate - 0.25), max: currentFedRate + 0.25 },
          trend: fedTrend,
          nextMeetingProbability: { // Simplified model
            raise: fedTrend === 'tightening' ? 65 : 25,
            hold: 45,
            cut: fedTrend === 'easing' ? 55 : 15
          }
        },
        moneySupply: {
          m1Growth: {
            current: Number(m1QoQ.toFixed(2)),
            yearOverYear: Number(m1YoY.toFixed(2)),
            trend: m1Trend
          },
          m2Growth: {
            current: Number(m2QoQ.toFixed(2)),
            yearOverYear: Number(m2YoY.toFixed(2)),
            trend: m2Trend
          },
          velocityM2: Number(currentM2Velocity.toFixed(3))
        },
        liquidityConditions,
        equityValuationImpact: {
          score: Number(equityScore.toFixed(1)),
          sentiment: equitySentiment,
          reasoning
        },
        policyStance,
        marketPerformanceCorrelation: Number((0.85 - Math.abs(currentFedRate - 3) * 0.1).toFixed(2)), // Simplified correlation
        lastUpdated: new Date().toISOString()
      }

      // Cache for 2 hours
      await this.cache.set(cacheKey, monetaryContext, 7200, {
        source: 'fred',
        version: '1.0.0'
      })

      console.log(`✅ Monetary policy analysis complete: ${policyStance} stance, ${liquidityConditions} liquidity`)
      return monetaryContext

    } catch (error) {
      console.error('FRED monetary policy context error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Make HTTP request to FRED API
   */
  private async makeRequest(endpoint: string, params: Record<string, string>): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const url = new URL(endpoint, this.baseUrl)

      // FRED API requires series_id to be the first parameter for some endpoints
      // Add series_id first if it exists
      if (params.series_id) {
        url.searchParams.append('series_id', params.series_id)
      }

      // Add API key and file type
      url.searchParams.append('api_key', this.apiKey)
      url.searchParams.append('file_type', 'json')

      // Add remaining parameters (excluding series_id since we already added it)
      Object.entries(params).forEach(([key, value]) => {
        if (key !== 'series_id') {
          url.searchParams.append(key, value)
        }
      })

      console.log(`🌐 FRED API URL: ${url.toString()}`)

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VFR-API/1.0 FRED Collector'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Check for FRED API error messages and provide helpful context
      if (data.error_message) {
        let errorMessage = data.error_message

        // Provide more helpful error messages for common issues
        if (data.error_message.includes('api_key is not a 32 character alpha-numeric lower-case string')) {
          errorMessage = 'FRED API key is invalid. The key must be exactly 32 characters long and contain only lowercase letters and numbers. Please check your FRED_API_KEY environment variable.'
        } else if (data.error_message.includes('Bad Request')) {
          errorMessage = `FRED API request failed: ${data.error_message}. Please check your API key and request parameters.`
        }

        throw new Error(errorMessage)
      }

      return {
        success: true,
        data,
        source: 'fred',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'fred',
        timestamp: Date.now()
      }
    }
  }
}