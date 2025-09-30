/**
 * Bureau of Labor Statistics (BLS) API implementation
 * Provides access to U.S. labor market and economic data including employment, inflation, and wage statistics
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types.js'
import ErrorHandler from '../error-handling/ErrorHandler'
import { RedisCache } from '../cache/RedisCache'

interface BLSDataPoint {
  year: string
  period: string
  periodName: string
  value: string
  footnotes: Array<{ code: string, text: string }>
  latest?: string
}

interface BLSSeries {
  seriesID: string
  data: BLSDataPoint[]
}

interface BLSResponse {
  status: string
  responseTime: number
  message: string[]
  Results: {
    series: BLSSeries[]
  }
}

interface BLSSeriesInfo {
  seriesID: string
  title: string
  units: string
  frequency: string
  beginYear: string
  endYear: string
  catalog: {
    series_title: string
    series_id: string
    seasonality: string
    survey_name: string
    measure_data_type: string
    commerce_industry: string
    data_type: string
    text: string
  }
}

// Employment analysis interfaces
interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  strength: number // 0-10 scale
  slope: number // rate of change
  volatility: number // standard deviation
  confidence: number // 0-100 scale
  monthsAnalyzed: number
}

interface UnemploymentTrendResult {
  currentRate: number
  trend: TrendAnalysis
  historicalAverage: number
  historicalMin: number
  historicalMax: number
  isAtExtreme: boolean
  economicSignal: 'bullish' | 'bearish' | 'neutral'
  timestamp: number
}

interface PayrollMomentumResult {
  currentValue: number
  momentum: TrendAnalysis
  averageMonthlyChange: number
  consecutiveGrowthMonths: number
  isAccelerating: boolean
  economicSignal: 'strong' | 'moderate' | 'weak' | 'declining'
  timestamp: number
}

interface EmploymentStrengthScore {
  overallScore: number // 0-10 scale
  unemploymentScore: number
  payrollScore: number
  participationScore: number
  components: {
    unemployment: { value: number, score: number, weight: number }
    payrolls: { value: number, score: number, weight: number }
    participation: { value: number, score: number, weight: number }
  }
  interpretation: string
  timestamp: number
}

interface JobMarketHealthScore {
  overallHealth: number // 0-10 scale
  unemploymentHealth: number
  jobOpeningsHealth: number
  quitRateHealth: number
  components: {
    unemployment: { value: number, score: number, trend: string }
    jobOpenings: { value: number, score: number, trend: string }
    quitRate: { value: number, score: number, trend: string }
  }
  marketCondition: 'tight' | 'balanced' | 'loose' | 'distressed'
  timestamp: number
}

interface WageGrowthAnalysis {
  currentGrowthRate: number
  trend: TrendAnalysis
  inflationAdjustedGrowth: number
  realWageGrowth: boolean
  purchasingPowerTrend: 'improving' | 'declining' | 'stable'
  consumptionImpact: 'positive' | 'negative' | 'neutral'
  timestamp: number
}

interface ConsumerSpendingPower {
  spendingPowerIndex: number // 0-100 scale
  realWageGrowth: number
  unemploymentImpact: number
  confidenceLevel: number
  sectorImpacts: {
    discretionary: { impact: number, outlook: string }
    staples: { impact: number, outlook: string }
    services: { impact: number, outlook: string }
  }
  timestamp: number
}

interface CompositeEmploymentHealth {
  compositeScore: number // 0-100 scale
  employmentStrength: number
  jobMarketHealth: number
  wageGrowthHealth: number
  consumerImpact: number
  overallTrend: 'strengthening' | 'weakening' | 'stable' | 'mixed'
  economicPhase: 'expansion' | 'peak' | 'contraction' | 'trough' | 'recovery'
  riskFactors: string[]
  opportunities: string[]
  timestamp: number
}

export class BLSAPI implements FinancialDataProvider {
  name = 'Bureau of Labor Statistics API'
  private baseUrl = 'https://api.bls.gov/publicAPI/v2'
  private apiKey: string
  private timeout: number
  private throwErrors: boolean
  private userAgent: string
  private cache: RedisCache

  // Key BLS economic indicators for financial analysis
  private readonly POPULAR_SERIES: Record<string, string> = {
    // === TIER 1: Core Economic Indicators ===
    // Employment & Unemployment
    'LNS14000000': 'Unemployment Rate (Seasonally Adjusted)',
    'CES0000000001': 'Total Nonfarm Payrolls',
    'LNS12300000': 'Labor Force Participation Rate',

    // Inflation & Consumer Prices
    'CUUR0000SA0': 'Consumer Price Index (All Items)',
    'CUUR0000SA0L1E': 'Core CPI (All Items Less Food and Energy)',
    'CUUR0000SEHE': 'CPI Energy',

    // === TIER 2: Market Sentiment Indicators ===
    // Labor Market Dynamics
    'JTS000000000000000JOL': 'Job Openings Rate (Total Nonfarm)',
    'JTS000000000000000QUR': 'Quit Rate (Total Nonfarm)',
    'CES0500000003': 'Average Hourly Earnings (Total Private)',

    // Sector-Specific Employment
    'CES6056132001': 'Professional and Business Services Employment',
    'CES4142000001': 'Retail Trade Employment',
    'CES3000000001': 'Manufacturing Employment',

    // === LEGACY SERIES (Previously Configured) ===
    // Employment & Unemployment
    'LNS13327709': 'Alternative Unemployment Rate (U-6)',
    'LNU04000000': 'Unemployment Rate (Not Seasonally Adjusted)',
    'LNS12000000': 'Labor Force Participation Rate (Legacy)',
    'JTS1000JOL': 'Job Openings: Total Nonfarm (Legacy)',

    // Inflation & Consumer Prices
    'CUSR0000SA0': 'Consumer Price Index - All Urban Consumers (Seasonally Adjusted)',
    'CUUR0000SETB01': 'CPI-U: Gasoline (All Types)',
    'CUUR0000SAH1': 'CPI-U: Shelter',

    // Producer Prices
    'WPUFD49207': 'Producer Price Index: Final Demand',
    'WPUFD49104': 'PPI: Final Demand Less Food and Energy',

    // Wages & Earnings
    'CES0500000008': 'Average Weekly Hours: Total Private',
    'CIS2020000000000I': 'Employment Cost Index: Total Compensation',

    // Productivity
    'PRS85006092': 'Nonfarm Business Sector: Labor Productivity',
    'PRS85006112': 'Nonfarm Business Sector: Unit Labor Costs'
  }

  constructor(apiKey?: string, timeout = 15000, throwErrors = false) {
    this.apiKey = apiKey || process.env.BLS_API_KEY || ''
    this.timeout = timeout
    this.throwErrors = throwErrors
    this.userAgent = process.env.BLS_USER_AGENT || 'VFR-API/1.0 BLS Collector'
    this.cache = RedisCache.getInstance()

    if (this.apiKey && !this.isValidApiKeyFormat(this.apiKey)) {
      console.warn('BLS API key format appears invalid. Expected a UUID-like string.')
      if (this.throwErrors) throw new Error('Invalid BLS API key format')
    }
  }

  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      const seriesId = symbol.toUpperCase()

      if (!this.POPULAR_SERIES[seriesId]) {
        console.warn(`BLS series ${seriesId} not found in popular series`)
        if (this.throwErrors) throw new Error(`Unknown BLS series: ${seriesId}`)
        return null
      }

      const latestData = await this.getLatestObservation(seriesId)
      if (!latestData) return null

      const value = parseFloat(latestData.value)
      if (isNaN(value)) return null

      return {
        symbol: seriesId,
        price: Number(value.toFixed(2)),
        change: 0, // Economic data doesn't have traditional change
        changePercent: 0,
        volume: 0, // Not applicable to economic data
        timestamp: this.parseDate(latestData.year, latestData.period).getTime(),
        source: 'bls'
      }
    } catch (error) {
      console.error('BLS getStockPrice error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      const seriesId = symbol.toUpperCase()
      const seriesTitle = this.POPULAR_SERIES[seriesId]

      if (!seriesTitle) {
        console.warn(`BLS series ${seriesId} not found`)
        if (this.throwErrors) throw new Error(`Unknown BLS series: ${seriesId}`)
        return null
      }

      return {
        symbol: seriesId,
        name: seriesTitle,
        description: `Bureau of Labor Statistics economic indicator: ${seriesTitle}`,
        sector: 'Economic Data',
        marketCap: 0, // Not applicable
        employees: 0  // Not applicable
      }
    } catch (error) {
      console.error('BLS getCompanyInfo error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      const seriesId = symbol.toUpperCase()
      const latestData = await this.getLatestObservation(seriesId)

      if (!latestData) return null

      const value = parseFloat(latestData.value)
      if (isNaN(value)) return null

      return {
        symbol: seriesId,
        open: value,
        high: value,
        low: value,
        close: value,
        volume: 0, // Not applicable to economic data
        timestamp: this.parseDate(latestData.year, latestData.period).getTime(),
        source: 'bls'
      }
    } catch (error) {
      console.error('BLS getMarketData error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testSeriesId = 'UNRATE' // Unemployment rate - always available
      const response = await this.makeRequest('/timeseries/data/', {
        seriesid: [testSeriesId],
        startyear: new Date().getFullYear().toString(),
        endyear: new Date().getFullYear().toString()
      })

      return response.success && response.data?.status === 'REQUEST_SUCCEEDED'
    } catch (error) {
      console.error('BLS health check failed:', error)
      return false
    }
  }

  async getLatestObservation(seriesId: string): Promise<BLSDataPoint | null> {
    if (!this.apiKey) {
      const error = new Error('BLS API key not configured')
      console.warn(error.message)
      if (this.throwErrors) throw error
      return null
    }

    try {
      const currentYear = new Date().getFullYear()
      const response = await this.makeRequest('/timeseries/data/', {
        seriesid: [seriesId],
        startyear: (currentYear - 1).toString(),
        endyear: currentYear.toString(),
        registrationkey: this.apiKey
      })

      if (!response.success || !response.data?.Results?.series?.[0]?.data) {
        return null
      }

      const series = response.data.Results.series[0]
      const latestDataPoint = series.data[0] // BLS returns data in descending order

      return latestDataPoint
    } catch (error) {
      console.error(`BLS getLatestObservation error for ${seriesId}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  async getSeriesData(seriesId: string, startYear?: number, endYear?: number): Promise<BLSDataPoint[]> {
    if (!this.apiKey) {
      const error = new Error('BLS API key not configured')
      console.warn(error.message)
      if (this.throwErrors) throw error
      return []
    }

    try {
      const currentYear = new Date().getFullYear()
      const start = startYear || currentYear - 5
      const end = endYear || currentYear

      const response = await this.makeRequest('/timeseries/data/', {
        seriesid: [seriesId],
        startyear: start.toString(),
        endyear: end.toString(),
        registrationkey: this.apiKey
      })

      if (!response.success || !response.data?.Results?.series?.[0]?.data) {
        return []
      }

      return response.data.Results.series[0].data
    } catch (error) {
      console.error(`BLS getSeriesData error for ${seriesId}:`, error)
      if (this.throwErrors) throw error
      return []
    }
  }

  getPopularIndicators(): Array<{symbol: string, name: string}> {
    return Object.entries(this.POPULAR_SERIES).map(([symbol, name]) => ({
      symbol,
      name
    }))
  }

  /**
   * Get Tier 1 core economic indicators for individual investor decision-making
   * These are the most critical indicators for BUY/SELL/HOLD decisions
   */
  getTier1Indicators(): Array<{symbol: string, name: string, category: string}> {
    const tier1Series = {
      // Employment & Unemployment
      'LNS14000000': { name: 'Unemployment Rate (Seasonally Adjusted)', category: 'Employment' },
      'CES0000000001': { name: 'Total Nonfarm Payrolls', category: 'Employment' },
      'LNS12300000': { name: 'Labor Force Participation Rate', category: 'Employment' },

      // Inflation & Consumer Prices
      'CUUR0000SA0': { name: 'Consumer Price Index (All Items)', category: 'Inflation' },
      'CUUR0000SA0L1E': { name: 'Core CPI (All Items Less Food and Energy)', category: 'Inflation' },
      'CUUR0000SEHE': { name: 'CPI Energy', category: 'Inflation' }
    }

    return Object.entries(tier1Series).map(([symbol, info]) => ({
      symbol,
      name: info.name,
      category: info.category
    }))
  }

  /**
   * Get Tier 2 market sentiment indicators for advanced analysis
   * These provide deeper insight into market conditions and sentiment
   */
  getTier2Indicators(): Array<{symbol: string, name: string, category: string}> {
    const tier2Series = {
      // Labor Market Dynamics
      'JTS000000000000000JOL': { name: 'Job Openings Rate (Total Nonfarm)', category: 'Labor Dynamics' },
      'JTS000000000000000QUR': { name: 'Quit Rate (Total Nonfarm)', category: 'Labor Dynamics' },
      'CES0500000003': { name: 'Average Hourly Earnings (Total Private)', category: 'Wages' },

      // Sector-Specific Employment
      'CES6056132001': { name: 'Professional and Business Services Employment', category: 'Sector Employment' },
      'CES4142000001': { name: 'Retail Trade Employment', category: 'Sector Employment' },
      'CES3000000001': { name: 'Manufacturing Employment', category: 'Sector Employment' }
    }

    return Object.entries(tier2Series).map(([symbol, info]) => ({
      symbol,
      name: info.name,
      category: info.category
    }))
  }

  /**
   * Get all indicators organized by tier
   */
  getIndicatorsByTier(): {
    tier1: Array<{symbol: string, name: string, category: string}>,
    tier2: Array<{symbol: string, name: string, category: string}>
  } {
    return {
      tier1: this.getTier1Indicators(),
      tier2: this.getTier2Indicators()
    }
  }

  async getMultipleSeries(seriesIds: string[], startYear?: number, endYear?: number): Promise<Map<string, BLSDataPoint[]>> {
    if (!this.apiKey) {
      const error = new Error('BLS API key not configured')
      console.warn(error.message)
      if (this.throwErrors) throw error
      return new Map()
    }

    try {
      const currentYear = new Date().getFullYear()
      const start = startYear || currentYear - 2
      const end = endYear || currentYear

      // BLS allows up to 50 series per request for registered users
      const batchSize = 50
      const results = new Map<string, BLSDataPoint[]>()

      for (let i = 0; i < seriesIds.length; i += batchSize) {
        const batch = seriesIds.slice(i, i + batchSize)

        const response = await this.makeRequest('/timeseries/data/', {
          seriesid: batch,
          startyear: start.toString(),
          endyear: end.toString(),
          registrationkey: this.apiKey
        })

        if (response.success && response.data?.Results?.series) {
          response.data.Results.series.forEach((series: BLSSeries) => {
            results.set(series.seriesID, series.data)
          })
        }

        // Rate limiting - small delay between batches
        if (i + batchSize < seriesIds.length) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      return results
    } catch (error) {
      console.error('BLS getMultipleSeries error:', error)
      if (this.throwErrors) throw error
      return new Map()
    }
  }

  private async makeRequest(endpoint: string, params: Record<string, any>): Promise<ApiResponse<BLSResponse>> {
    // Generate cache key from endpoint and params
    const cacheKey = `bls:${endpoint}:${JSON.stringify(params)}`
    const cacheTTL = 43200 // 12 hours - BLS data typically updates daily

    // Check cache first
    try {
      const cached = await this.cache.get<any>(cacheKey)
      if (cached) {
        const seriesIds = Array.isArray(params.seriesid) ? params.seriesid.join(',') : 'unknown'
        console.log(`📦 BLS cache HIT for ${seriesIds} (TTL: ${cacheTTL}s)`)
        return {
          success: true,
          data: cached,
          source: 'bls',
          timestamp: Date.now(),
          cached: true
        }
      }
    } catch (cacheError) {
      console.warn('Redis cache read error (continuing with API call):', cacheError)
    }

    const seriesIds = Array.isArray(params.seriesid) ? params.seriesid.join(',') : 'unknown'
    console.log(`🔄 BLS cache MISS for ${seriesIds} - fetching from API`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const url = `${this.baseUrl}${endpoint}`

      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': this.userAgent
        },
        body: JSON.stringify(params)
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`BLS API HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status === 'REQUEST_NOT_PROCESSED') {
        throw new Error(`BLS API Error: ${data.message?.join(', ') || 'Request not processed'}`)
      }

      // Cache the successful response
      try {
        await this.cache.set(cacheKey, data, cacheTTL, {
          source: 'bls',
          version: '1.0.0'
        })
        console.log(`💾 Cached BLS data for ${seriesIds} (TTL: ${cacheTTL}s)`)
      } catch (cacheError) {
        console.warn('Failed to cache BLS response:', cacheError)
      }

      return {
        success: true,
        data,
        source: 'bls',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      const normalizedError = ErrorHandler.normalizeError(error)

      if (normalizedError.isError && (error as Error).name === 'AbortError') {
        throw new Error(`BLS API request timeout after ${this.timeout}ms`)
      }

      return {
        success: false,
        error: normalizedError.message,
        source: 'bls',
        timestamp: Date.now()
      }
    }
  }

  private isValidApiKeyFormat(apiKey: string): boolean {
    // BLS API keys are typically UUID-like strings or longer alphanumeric
    return /^[a-zA-Z0-9]{8,}(-[a-zA-Z0-9]{4,})*$/.test(apiKey)
  }

  private parseDate(year: string, period: string): Date {
    const yearNum = parseInt(year)

    // Handle different period formats
    if (period.startsWith('M')) {
      // Monthly data: M01, M02, etc.
      const month = parseInt(period.substring(1)) - 1 // JavaScript months are 0-indexed
      return new Date(yearNum, month, 1)
    } else if (period.startsWith('Q')) {
      // Quarterly data: Q01, Q02, etc.
      const quarter = parseInt(period.substring(1))
      const month = (quarter - 1) * 3
      return new Date(yearNum, month, 1)
    } else if (period === 'A01') {
      // Annual data
      return new Date(yearNum, 0, 1)
    } else {
      // Default to beginning of year
      return new Date(yearNum, 0, 1)
    }
  }

  // ============================================================================
  // EMPLOYMENT TREND ANALYSIS METHODS
  // ============================================================================

  /**
   * Analyze unemployment rate trends with sophisticated statistical analysis
   * Critical for determining labor market direction and economic health
   */
  async analyzeUnemploymentTrend(monthsToAnalyze: number = 12): Promise<UnemploymentTrendResult | null> {
    if (!this.apiKey) {
      console.warn('BLS API key required for unemployment trend analysis')
      return null
    }

    try {
      const startTime = Date.now()
      const seriesId = 'LNS14000000' // Unemployment Rate (Seasonally Adjusted)
      const currentYear = new Date().getFullYear()

      // Get 24 months of data to ensure we have enough for trend analysis
      const data = await this.getSeriesData(seriesId, currentYear - 2, currentYear)

      if (data.length < 6) {
        console.warn('Insufficient unemployment data for trend analysis')
        return null
      }

      // Sort data chronologically (newest first from BLS)
      const sortedData = data.sort((a, b) => {
        const dateA = this.parseDate(a.year, a.period)
        const dateB = this.parseDate(b.year, b.period)
        return dateB.getTime() - dateA.getTime()
      })

      // Take only the months we want to analyze
      const analysisData = sortedData.slice(0, monthsToAnalyze)
      const values = analysisData.map(d => parseFloat(d.value)).filter(v => !isNaN(v))

      if (values.length < 6) {
        console.warn('Insufficient valid unemployment values for analysis')
        return null
      }

      const currentRate = values[0]
      const trend = this.calculateTrendAnalysis(values)

      // Calculate historical statistics
      const historicalAverage = values.reduce((sum, val) => sum + val, 0) / values.length
      const historicalMin = Math.min(...values)
      const historicalMax = Math.max(...values)

      // Determine if at extreme levels (top/bottom 10% of range)
      const range = historicalMax - historicalMin
      const isAtExtreme = currentRate <= (historicalMin + range * 0.1) ||
                         currentRate >= (historicalMax - range * 0.1)

      // Economic signal based on trend and current level
      let economicSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral'
      if (trend.direction === 'decreasing' && trend.strength >= 6) {
        economicSignal = 'bullish' // Falling unemployment is good for economy
      } else if (trend.direction === 'increasing' && trend.strength >= 6) {
        economicSignal = 'bearish' // Rising unemployment is concerning
      }

      const elapsedTime = Date.now() - startTime
      console.log(`Unemployment trend analysis completed in ${elapsedTime}ms`)

      return {
        currentRate,
        trend,
        historicalAverage: Number(historicalAverage.toFixed(2)),
        historicalMin,
        historicalMax,
        isAtExtreme,
        economicSignal,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Unemployment trend analysis error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Analyze non-farm payroll momentum for employment growth trends
   * Key indicator for economic expansion/contraction cycles
   */
  async analyzePayrollMomentum(monthsToAnalyze: number = 12): Promise<PayrollMomentumResult | null> {
    if (!this.apiKey) {
      console.warn('BLS API key required for payroll momentum analysis')
      return null
    }

    try {
      const startTime = Date.now()
      const seriesId = 'CES0000000001' // Total Nonfarm Payrolls
      const currentYear = new Date().getFullYear()

      const data = await this.getSeriesData(seriesId, currentYear - 2, currentYear)

      if (data.length < 6) {
        console.warn('Insufficient payroll data for momentum analysis')
        return null
      }

      // Sort chronologically (newest first)
      const sortedData = data.sort((a, b) => {
        const dateA = this.parseDate(a.year, a.period)
        const dateB = this.parseDate(b.year, b.period)
        return dateB.getTime() - dateA.getTime()
      })

      const analysisData = sortedData.slice(0, monthsToAnalyze + 1) // +1 for change calculation
      const values = analysisData.map(d => parseFloat(d.value)).filter(v => !isNaN(v))

      if (values.length < 6) {
        console.warn('Insufficient valid payroll values for analysis')
        return null
      }

      // Calculate month-over-month changes
      const monthlyChanges = []
      for (let i = 0; i < values.length - 1; i++) {
        monthlyChanges.push(values[i] - values[i + 1]) // Since values[0] is most recent
      }

      const currentValue = values[0]
      const momentum = this.calculateTrendAnalysis(monthlyChanges)
      const averageMonthlyChange = monthlyChanges.reduce((sum, val) => sum + val, 0) / monthlyChanges.length

      // Count consecutive growth months
      let consecutiveGrowthMonths = 0
      for (const change of monthlyChanges) {
        if (change > 0) {
          consecutiveGrowthMonths++
        } else {
          break
        }
      }

      // Determine if payroll growth is accelerating
      const recentChanges = monthlyChanges.slice(0, 3) // Last 3 months
      const olderChanges = monthlyChanges.slice(3, 6) // Previous 3 months
      const recentAvg = recentChanges.reduce((sum, val) => sum + val, 0) / recentChanges.length
      const olderAvg = olderChanges.reduce((sum, val) => sum + val, 0) / olderChanges.length
      const isAccelerating = recentAvg > olderAvg && recentAvg > 0

      // Economic signal based on momentum
      let economicSignal: 'strong' | 'moderate' | 'weak' | 'declining' = 'moderate'
      if (averageMonthlyChange >= 200 && momentum.strength >= 7) {
        economicSignal = 'strong'
      } else if (averageMonthlyChange >= 100 && momentum.strength >= 5) {
        economicSignal = 'moderate'
      } else if (averageMonthlyChange > 0) {
        economicSignal = 'weak'
      } else {
        economicSignal = 'declining'
      }

      const elapsedTime = Date.now() - startTime
      console.log(`Payroll momentum analysis completed in ${elapsedTime}ms`)

      return {
        currentValue,
        momentum,
        averageMonthlyChange: Number(averageMonthlyChange.toFixed(0)),
        consecutiveGrowthMonths,
        isAccelerating,
        economicSignal,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Payroll momentum analysis error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Calculate comprehensive trend analysis for time series data
   * Returns direction, strength, slope, volatility, and confidence metrics
   */
  private calculateTrendAnalysis(values: number[]): TrendAnalysis {
    if (values.length < 3) {
      return {
        direction: 'stable',
        strength: 0,
        slope: 0,
        volatility: 0,
        confidence: 0,
        monthsAnalyzed: values.length
      }
    }

    const n = values.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = values

    // Calculate linear regression slope (trend)
    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = y.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0)
    const sumXX = x.reduce((sum, val) => sum + val * val, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Calculate R-squared for trend strength
    const yMean = sumY / n
    const totalSumSquares = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0)
    const residualSumSquares = y.reduce((sum, val, i) => {
      const predicted = slope * x[i] + intercept
      return sum + Math.pow(val - predicted, 2)
    }, 0)

    const rSquared = 1 - (residualSumSquares / totalSumSquares)
    const strength = Math.max(0, Math.min(10, rSquared * 10))

    // Calculate volatility (standard deviation)
    const variance = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0) / n
    const volatility = Math.sqrt(variance)

    // Determine trend direction
    let direction: 'increasing' | 'decreasing' | 'stable' | 'volatile' = 'stable'
    if (Math.abs(slope) < 0.01) {
      direction = 'stable'
    } else if (volatility > Math.abs(slope * 10)) {
      direction = 'volatile'
    } else if (slope > 0) {
      direction = 'increasing'
    } else {
      direction = 'decreasing'
    }

    // Calculate confidence based on data quality and trend consistency
    const confidence = Math.min(100, Math.max(0, (rSquared * 70) + (n >= 12 ? 30 : (n / 12) * 30)))

    return {
      direction,
      strength: Number(strength.toFixed(1)),
      slope: Number(slope.toFixed(4)),
      volatility: Number(volatility.toFixed(2)),
      confidence: Number(confidence.toFixed(0)),
      monthsAnalyzed: n
    }
  }

  /**
   * Calculate comprehensive employment strength score (0-10 scale)
   * Combines unemployment rate, payroll growth, and labor force participation
   */
  async calculateEmploymentStrengthScore(): Promise<EmploymentStrengthScore | null> {
    if (!this.apiKey) {
      console.warn('BLS API key required for employment strength scoring')
      return null
    }

    try {
      const startTime = Date.now()

      // Get latest data for key employment indicators
      const seriesIds = [
        'LNS14000000', // Unemployment Rate (Seasonally Adjusted)
        'CES0000000001', // Total Nonfarm Payrolls
        'LNS12300000' // Labor Force Participation Rate
      ]

      const latestData = new Map<string, BLSDataPoint>()

      // Fetch latest observations for all series
      for (const seriesId of seriesIds) {
        const data = await this.getLatestObservation(seriesId)
        if (data) {
          latestData.set(seriesId, data)
        }
      }

      if (latestData.size < 3) {
        console.warn('Insufficient data for employment strength scoring')
        return null
      }

      // Extract current values
      const unemployment = parseFloat(latestData.get('LNS14000000')?.value || '0')
      const payrolls = parseFloat(latestData.get('CES0000000001')?.value || '0')
      const participation = parseFloat(latestData.get('LNS12300000')?.value || '0')

      // Get historical data for payroll momentum
      const payrollTrend = await this.analyzePayrollMomentum(6)

      // Calculate component scores
      const unemploymentScore = this.scoreUnemploymentRate(unemployment)
      const payrollScore = this.scorePayrollGrowth(payrollTrend?.averageMonthlyChange || 0)
      const participationScore = this.scoreLaborParticipation(participation)

      // Weight the components (unemployment is most important)
      const weights = {
        unemployment: 0.5,
        payrolls: 0.3,
        participation: 0.2
      }

      const overallScore = (
        unemploymentScore * weights.unemployment +
        payrollScore * weights.payrolls +
        participationScore * weights.participation
      )

      // Generate interpretation
      let interpretation = ''
      if (overallScore >= 8.5) {
        interpretation = 'Exceptionally strong employment conditions with robust job growth and low unemployment'
      } else if (overallScore >= 7.0) {
        interpretation = 'Strong employment environment supporting economic expansion'
      } else if (overallScore >= 5.5) {
        interpretation = 'Moderate employment conditions with mixed signals'
      } else if (overallScore >= 3.0) {
        interpretation = 'Weak employment environment with concerning trends'
      } else {
        interpretation = 'Poor employment conditions indicating economic stress'
      }

      const elapsedTime = Date.now() - startTime
      console.log(`Employment strength scoring completed in ${elapsedTime}ms`)

      return {
        overallScore: Number(overallScore.toFixed(1)),
        unemploymentScore: Number(unemploymentScore.toFixed(1)),
        payrollScore: Number(payrollScore.toFixed(1)),
        participationScore: Number(participationScore.toFixed(1)),
        components: {
          unemployment: {
            value: unemployment,
            score: Number(unemploymentScore.toFixed(1)),
            weight: weights.unemployment
          },
          payrolls: {
            value: payrolls,
            score: Number(payrollScore.toFixed(1)),
            weight: weights.payrolls
          },
          participation: {
            value: participation,
            score: Number(participationScore.toFixed(1)),
            weight: weights.participation
          }
        },
        interpretation,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Employment strength scoring error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Score unemployment rate on 0-10 scale (lower unemployment = higher score)
   */
  private scoreUnemploymentRate(rate: number): number {
    // Historical context: Normal range 3.5% - 6.5%, crisis levels >8%
    if (rate <= 3.0) return 10.0 // Extremely low unemployment
    if (rate <= 3.5) return 9.5  // Very low unemployment
    if (rate <= 4.0) return 9.0  // Low unemployment
    if (rate <= 4.5) return 8.0  // Below average unemployment
    if (rate <= 5.0) return 7.0  // Average unemployment
    if (rate <= 5.5) return 6.0  // Slightly elevated
    if (rate <= 6.0) return 5.0  // Elevated unemployment
    if (rate <= 7.0) return 4.0  // High unemployment
    if (rate <= 8.0) return 2.5  // Very high unemployment
    if (rate <= 10.0) return 1.0 // Crisis level unemployment
    return 0.0 // Severe crisis
  }

  /**
   * Score payroll growth on 0-10 scale based on monthly job creation
   */
  private scorePayrollGrowth(monthlyChange: number): number {
    // Thousands of jobs created per month
    if (monthlyChange >= 300) return 10.0 // Exceptional growth
    if (monthlyChange >= 250) return 9.0  // Very strong growth
    if (monthlyChange >= 200) return 8.0  // Strong growth
    if (monthlyChange >= 150) return 7.0  // Good growth
    if (monthlyChange >= 100) return 6.0  // Moderate growth
    if (monthlyChange >= 50) return 5.0   // Slow growth
    if (monthlyChange >= 0) return 4.0    // Stagnant
    if (monthlyChange >= -50) return 3.0  // Declining
    if (monthlyChange >= -100) return 2.0 // Rapid decline
    if (monthlyChange >= -200) return 1.0 // Severe decline
    return 0.0 // Crisis-level job losses
  }

  /**
   * Score labor force participation on 0-10 scale
   */
  private scoreLaborParticipation(rate: number): number {
    // Historical context: Pre-COVID peak ~67%, normal range 62-67%
    if (rate >= 67.0) return 10.0 // Peak participation
    if (rate >= 66.0) return 9.0  // Very high participation
    if (rate >= 65.0) return 8.0  // High participation
    if (rate >= 64.0) return 7.0  // Above average
    if (rate >= 63.0) return 6.0  // Average participation
    if (rate >= 62.0) return 5.0  // Below average
    if (rate >= 61.0) return 4.0  // Low participation
    if (rate >= 60.0) return 3.0  // Very low participation
    if (rate >= 58.0) return 2.0  // Extremely low
    return 1.0 // Crisis-level low participation
  }

  /**
   * Calculate comprehensive job market health score combining multiple indicators
   * Integrates unemployment, job openings, and quit rates for market condition assessment
   */
  async calculateJobMarketHealthScore(): Promise<JobMarketHealthScore | null> {
    if (!this.apiKey) {
      console.warn('BLS API key required for job market health scoring')
      return null
    }

    try {
      const startTime = Date.now()

      // Key job market health indicators
      const seriesIds = [
        'LNS14000000', // Unemployment Rate (Seasonally Adjusted)
        'JTS000000000000000JOL', // Job Openings Rate (Total Nonfarm)
        'JTS000000000000000QUR'  // Quit Rate (Total Nonfarm)
      ]

      const latestData = new Map<string, BLSDataPoint>()

      // Fetch latest observations
      for (const seriesId of seriesIds) {
        const data = await this.getLatestObservation(seriesId)
        if (data) {
          latestData.set(seriesId, data)
        }
      }

      if (latestData.size < 3) {
        console.warn('Insufficient data for job market health scoring')
        return null
      }

      // Extract current values
      const unemployment = parseFloat(latestData.get('LNS14000000')?.value || '0')
      const jobOpeningsRate = parseFloat(latestData.get('JTS000000000000000JOL')?.value || '0')
      const quitRate = parseFloat(latestData.get('JTS000000000000000QUR')?.value || '0')

      // Get trend analysis for each component
      const unemploymentTrend = await this.analyzeUnemploymentTrend(6)
      const jobOpeningsTrend = await this.getSimpleTrend('JTS000000000000000JOL', 6)
      const quitRateTrend = await this.getSimpleTrend('JTS000000000000000QUR', 6)

      // Calculate component health scores
      const unemploymentHealth = this.scoreUnemploymentForHealth(unemployment, unemploymentTrend?.trend.direction)
      const jobOpeningsHealth = this.scoreJobOpenings(jobOpeningsRate, jobOpeningsTrend?.direction)
      const quitRateHealth = this.scoreQuitRate(quitRate, quitRateTrend?.direction)

      // Overall health is weighted average
      const overallHealth = (unemploymentHealth * 0.4 + jobOpeningsHealth * 0.35 + quitRateHealth * 0.25)

      // Determine market condition
      let marketCondition: 'tight' | 'balanced' | 'loose' | 'distressed' = 'balanced'
      if (overallHealth >= 8.0 && jobOpeningsRate >= 6.0 && quitRate >= 2.5) {
        marketCondition = 'tight' // Very tight labor market
      } else if (overallHealth >= 6.0) {
        marketCondition = 'balanced' // Healthy balance
      } else if (overallHealth >= 4.0) {
        marketCondition = 'loose' // Softening conditions
      } else {
        marketCondition = 'distressed' // Poor conditions
      }

      const elapsedTime = Date.now() - startTime
      console.log(`Job market health scoring completed in ${elapsedTime}ms`)

      return {
        overallHealth: Number(overallHealth.toFixed(1)),
        unemploymentHealth: Number(unemploymentHealth.toFixed(1)),
        jobOpeningsHealth: Number(jobOpeningsHealth.toFixed(1)),
        quitRateHealth: Number(quitRateHealth.toFixed(1)),
        components: {
          unemployment: {
            value: unemployment,
            score: Number(unemploymentHealth.toFixed(1)),
            trend: unemploymentTrend?.trend.direction || 'unknown'
          },
          jobOpenings: {
            value: jobOpeningsRate,
            score: Number(jobOpeningsHealth.toFixed(1)),
            trend: jobOpeningsTrend?.direction || 'unknown'
          },
          quitRate: {
            value: quitRate,
            score: Number(quitRateHealth.toFixed(1)),
            trend: quitRateTrend?.direction || 'unknown'
          }
        },
        marketCondition,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Job market health scoring error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Get simple trend direction for a series
   */
  private async getSimpleTrend(seriesId: string, months: number): Promise<{direction: string, strength: number} | null> {
    try {
      const currentYear = new Date().getFullYear()
      const data = await this.getSeriesData(seriesId, currentYear - 1, currentYear)

      if (data.length < 3) return null

      const sortedData = data.sort((a, b) => {
        const dateA = this.parseDate(a.year, a.period)
        const dateB = this.parseDate(b.year, b.period)
        return dateB.getTime() - dateA.getTime()
      })

      const values = sortedData.slice(0, months).map(d => parseFloat(d.value)).filter(v => !isNaN(v))
      if (values.length < 3) return null

      const trend = this.calculateTrendAnalysis(values)
      return {
        direction: trend.direction,
        strength: trend.strength
      }
    } catch (error) {
      console.warn(`Error getting trend for ${seriesId}:`, error)
      return null
    }
  }

  /**
   * Score unemployment for health assessment (considers trend)
   */
  private scoreUnemploymentForHealth(rate: number, trend?: string): number {
    let baseScore = this.scoreUnemploymentRate(rate)

    // Adjust based on trend
    if (trend === 'decreasing') {
      baseScore = Math.min(10, baseScore + 1.0) // Improving trend bonus
    } else if (trend === 'increasing') {
      baseScore = Math.max(0, baseScore - 1.5) // Worsening trend penalty
    }

    return baseScore
  }

  /**
   * Score job openings rate on 0-10 scale
   */
  private scoreJobOpenings(rate: number, trend?: string): number {
    // Job openings rate as percentage of total employment
    let baseScore = 0
    if (rate >= 7.0) baseScore = 10.0      // Very high job availability
    else if (rate >= 6.0) baseScore = 9.0  // High job availability
    else if (rate >= 5.0) baseScore = 8.0  // Good job availability
    else if (rate >= 4.0) baseScore = 7.0  // Moderate job availability
    else if (rate >= 3.5) baseScore = 6.0  // Below average availability
    else if (rate >= 3.0) baseScore = 5.0  // Low job availability
    else if (rate >= 2.5) baseScore = 4.0  // Poor job availability
    else if (rate >= 2.0) baseScore = 3.0  // Very poor availability
    else if (rate >= 1.5) baseScore = 2.0  // Extremely poor
    else baseScore = 1.0                   // Crisis level

    // Trend adjustment
    if (trend === 'increasing') {
      baseScore = Math.min(10, baseScore + 0.5)
    } else if (trend === 'decreasing') {
      baseScore = Math.max(0, baseScore - 0.5)
    }

    return baseScore
  }

  /**
   * Score quit rate on 0-10 scale (optimal range indicates confidence)
   */
  private scoreQuitRate(rate: number, trend?: string): number {
    // Quit rate indicates worker confidence - too low or too high is bad
    let baseScore = 0
    if (rate >= 2.8 && rate <= 3.2) baseScore = 10.0  // Optimal confidence range
    else if (rate >= 2.5 && rate <= 3.5) baseScore = 9.0   // Very good range
    else if (rate >= 2.2 && rate <= 3.8) baseScore = 8.0   // Good range
    else if (rate >= 2.0 && rate <= 4.0) baseScore = 7.0   // Acceptable range
    else if (rate >= 1.8 && rate <= 4.2) baseScore = 6.0   // Suboptimal
    else if (rate >= 1.5 && rate <= 4.5) baseScore = 5.0   // Poor
    else if (rate >= 1.2 && rate <= 5.0) baseScore = 4.0   // Very poor
    else if (rate >= 1.0 && rate <= 5.5) baseScore = 3.0   // Extremely poor
    else if (rate >= 0.8 && rate <= 6.0) baseScore = 2.0   // Crisis indicators
    else baseScore = 1.0                                   // Severe crisis

    // Trend matters less for quit rate, but still factor it in
    if (trend === 'stable') {
      baseScore = Math.min(10, baseScore + 0.2)
    }

    return baseScore
  }

  // ============================================================================
  // WAGE GROWTH AND CONSUMER IMPACT ANALYSIS
  // ============================================================================

  /**
   * Analyze wage growth trends and correlation with inflation
   * Critical for consumer spending power and economic sustainability
   */
  async analyzeWageGrowth(monthsToAnalyze: number = 12): Promise<WageGrowthAnalysis | null> {
    if (!this.apiKey) {
      console.warn('BLS API key required for wage growth analysis')
      return null
    }

    try {
      const startTime = Date.now()

      // Get wage and inflation data
      const wageSeriesId = 'CES0500000003' // Average Hourly Earnings (Total Private)
      const inflationSeriesId = 'CUUR0000SA0' // Consumer Price Index (All Items)

      const currentYear = new Date().getFullYear()

      // Get both wage and inflation data
      const [wageData, inflationData] = await Promise.all([
        this.getSeriesData(wageSeriesId, currentYear - 2, currentYear),
        this.getSeriesData(inflationSeriesId, currentYear - 2, currentYear)
      ])

      if (wageData.length < 6 || inflationData.length < 6) {
        console.warn('Insufficient data for wage growth analysis')
        return null
      }

      // Sort data chronologically (newest first)
      const sortedWageData = wageData.sort((a, b) => {
        const dateA = this.parseDate(a.year, a.period)
        const dateB = this.parseDate(b.year, b.period)
        return dateB.getTime() - dateA.getTime()
      }).slice(0, monthsToAnalyze + 1) // +1 for growth calculation

      const sortedInflationData = inflationData.sort((a, b) => {
        const dateA = this.parseDate(a.year, a.period)
        const dateB = this.parseDate(b.year, b.period)
        return dateB.getTime() - dateA.getTime()
      }).slice(0, monthsToAnalyze + 1)

      // Calculate year-over-year wage growth
      const wageGrowthRates = this.calculateYoYGrowthRates(sortedWageData)
      const inflationRates = this.calculateYoYGrowthRates(sortedInflationData)

      if (wageGrowthRates.length < 3 || inflationRates.length < 3) {
        console.warn('Insufficient growth rate data')
        return null
      }

      const currentGrowthRate = wageGrowthRates[0]
      const currentInflationRate = inflationRates[0]

      // Calculate real wage growth (wage growth - inflation)
      const inflationAdjustedGrowth = currentGrowthRate - currentInflationRate
      const realWageGrowth = inflationAdjustedGrowth > 0

      // Analyze wage growth trend
      const trend = this.calculateTrendAnalysis(wageGrowthRates)

      // Determine purchasing power trend
      let purchasingPowerTrend: 'improving' | 'declining' | 'stable' = 'stable'
      if (inflationAdjustedGrowth >= 1.0) {
        purchasingPowerTrend = 'improving'
      } else if (inflationAdjustedGrowth <= -1.0) {
        purchasingPowerTrend = 'declining'
      }

      // Assess consumption impact
      let consumptionImpact: 'positive' | 'negative' | 'neutral' = 'neutral'
      if (realWageGrowth && currentGrowthRate >= 3.0) {
        consumptionImpact = 'positive'
      } else if (!realWageGrowth && inflationAdjustedGrowth <= -2.0) {
        consumptionImpact = 'negative'
      }

      const elapsedTime = Date.now() - startTime
      console.log(`Wage growth analysis completed in ${elapsedTime}ms`)

      return {
        currentGrowthRate: Number(currentGrowthRate.toFixed(2)),
        trend,
        inflationAdjustedGrowth: Number(inflationAdjustedGrowth.toFixed(2)),
        realWageGrowth,
        purchasingPowerTrend,
        consumptionImpact,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Wage growth analysis error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Calculate consumer spending power index combining multiple factors
   */
  async calculateConsumerSpendingPower(): Promise<ConsumerSpendingPower | null> {
    if (!this.apiKey) {
      console.warn('BLS API key required for consumer spending power calculation')
      return null
    }

    try {
      const startTime = Date.now()

      // Get comprehensive employment and wage data
      const [
        wageGrowthAnalysis,
        unemploymentTrend,
        employmentStrength
      ] = await Promise.all([
        this.analyzeWageGrowth(6),
        this.analyzeUnemploymentTrend(6),
        this.calculateEmploymentStrengthScore()
      ])

      if (!wageGrowthAnalysis || !unemploymentTrend || !employmentStrength) {
        console.warn('Insufficient data for spending power calculation')
        return null
      }

      // Calculate spending power components
      const realWageComponent = this.scoreRealWageGrowth(wageGrowthAnalysis.inflationAdjustedGrowth)
      const employmentComponent = this.scoreEmploymentForSpending(unemploymentTrend.currentRate)
      const confidenceComponent = this.scoreConsumerConfidence(
        wageGrowthAnalysis.realWageGrowth,
        unemploymentTrend.trend.direction === 'decreasing'
      )

      // Weighted spending power index (0-100 scale)
      const spendingPowerIndex = (
        realWageComponent * 0.4 +
        employmentComponent * 0.35 +
        confidenceComponent * 0.25
      ) * 10 // Scale to 0-100

      // Calculate sector impacts
      const sectorImpacts = this.calculateSectorImpacts(spendingPowerIndex, wageGrowthAnalysis)

      const elapsedTime = Date.now() - startTime
      console.log(`Consumer spending power calculation completed in ${elapsedTime}ms`)

      return {
        spendingPowerIndex: Number(spendingPowerIndex.toFixed(1)),
        realWageGrowth: wageGrowthAnalysis.inflationAdjustedGrowth,
        unemploymentImpact: Number(employmentComponent.toFixed(1)),
        confidenceLevel: Number(confidenceComponent.toFixed(1)),
        sectorImpacts,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Consumer spending power calculation error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Calculate comprehensive composite employment health score
   */
  async calculateCompositeEmploymentHealth(): Promise<CompositeEmploymentHealth | null> {
    if (!this.apiKey) {
      console.warn('BLS API key required for composite employment health')
      return null
    }

    try {
      const startTime = Date.now()

      // Get all component analyses
      const [
        employmentStrength,
        jobMarketHealth,
        wageGrowthAnalysis,
        consumerSpendingPower
      ] = await Promise.all([
        this.calculateEmploymentStrengthScore(),
        this.calculateJobMarketHealthScore(),
        this.analyzeWageGrowth(12),
        this.calculateConsumerSpendingPower()
      ])

      if (!employmentStrength || !jobMarketHealth || !wageGrowthAnalysis || !consumerSpendingPower) {
        console.warn('Insufficient data for composite employment health')
        return null
      }

      // Normalize all scores to 0-100 scale
      const employmentScore = employmentStrength.overallScore * 10
      const healthScore = jobMarketHealth.overallHealth * 10
      const wageScore = this.scoreWageHealthComponent(wageGrowthAnalysis) * 10
      const consumerScore = consumerSpendingPower.spendingPowerIndex

      // Calculate weighted composite score
      const compositeScore = (
        employmentScore * 0.3 +
        healthScore * 0.25 +
        wageScore * 0.25 +
        consumerScore * 0.2
      )

      // Determine overall trend
      const trends = [
        employmentStrength.interpretation.includes('strong') ? 1 :
        employmentStrength.interpretation.includes('weak') ? -1 : 0,
        jobMarketHealth.marketCondition === 'tight' ? 1 :
        jobMarketHealth.marketCondition === 'distressed' ? -1 : 0,
        wageGrowthAnalysis.consumptionImpact === 'positive' ? 1 :
        wageGrowthAnalysis.consumptionImpact === 'negative' ? -1 : 0
      ]

      const trendSum = trends.reduce((sum, trend) => sum + trend, 0)
      let overallTrend: 'strengthening' | 'weakening' | 'stable' | 'mixed' = 'stable'

      if (trendSum >= 2) overallTrend = 'strengthening'
      else if (trendSum <= -2) overallTrend = 'weakening'
      else if (trendSum === 0) overallTrend = 'stable'
      else overallTrend = 'mixed'

      // Determine economic phase
      const economicPhase = this.determineEconomicPhase(compositeScore, overallTrend, jobMarketHealth)

      // Identify risk factors and opportunities
      const { riskFactors, opportunities } = this.identifyRisksAndOpportunities(
        employmentStrength,
        jobMarketHealth,
        wageGrowthAnalysis,
        consumerSpendingPower
      )

      const elapsedTime = Date.now() - startTime
      console.log(`Composite employment health calculation completed in ${elapsedTime}ms`)

      return {
        compositeScore: Number(compositeScore.toFixed(1)),
        employmentStrength: Number(employmentScore.toFixed(1)),
        jobMarketHealth: Number(healthScore.toFixed(1)),
        wageGrowthHealth: Number(wageScore.toFixed(1)),
        consumerImpact: Number(consumerScore.toFixed(1)),
        overallTrend,
        economicPhase,
        riskFactors,
        opportunities,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Composite employment health calculation error:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  // ============================================================================
  // HELPER METHODS FOR ANALYSIS
  // ============================================================================

  /**
   * Calculate year-over-year growth rates for time series data
   */
  private calculateYoYGrowthRates(data: BLSDataPoint[]): number[] {
    const growthRates = []

    for (let i = 0; i < data.length - 12; i++) { // Need 12 months for YoY
      const current = parseFloat(data[i].value)
      const yearAgo = parseFloat(data[i + 12].value)

      if (!isNaN(current) && !isNaN(yearAgo) && yearAgo !== 0) {
        const growthRate = ((current - yearAgo) / yearAgo) * 100
        growthRates.push(growthRate)
      }
    }

    return growthRates
  }

  /**
   * Score real wage growth component
   */
  private scoreRealWageGrowth(realGrowth: number): number {
    if (realGrowth >= 3.0) return 10.0
    if (realGrowth >= 2.0) return 9.0
    if (realGrowth >= 1.0) return 8.0
    if (realGrowth >= 0.5) return 7.0
    if (realGrowth >= 0.0) return 6.0
    if (realGrowth >= -0.5) return 5.0
    if (realGrowth >= -1.0) return 4.0
    if (realGrowth >= -2.0) return 3.0
    if (realGrowth >= -3.0) return 2.0
    return 1.0
  }

  /**
   * Score employment component for spending power
   */
  private scoreEmploymentForSpending(unemploymentRate: number): number {
    // Similar to unemployment scoring but focused on spending impact
    return this.scoreUnemploymentRate(unemploymentRate)
  }

  /**
   * Score consumer confidence based on employment trends
   */
  private scoreConsumerConfidence(realWageGrowth: boolean, unemploymentImproving: boolean): number {
    let score = 5.0 // Base neutral confidence

    if (realWageGrowth) score += 2.5
    if (unemploymentImproving) score += 2.5

    return Math.min(10.0, score)
  }

  /**
   * Calculate sector-specific impacts
   */
  private calculateSectorImpacts(spendingPowerIndex: number, wageAnalysis: WageGrowthAnalysis) {
    const baseImpact = (spendingPowerIndex - 50) / 10 // Scale from -5 to +5

    return {
      discretionary: {
        impact: Number((baseImpact * 1.5).toFixed(1)), // More sensitive to spending power
        outlook: baseImpact > 1 ? 'positive' : baseImpact < -1 ? 'negative' : 'neutral'
      },
      staples: {
        impact: Number((baseImpact * 0.5).toFixed(1)), // Less sensitive
        outlook: baseImpact > 2 ? 'positive' : baseImpact < -2 ? 'negative' : 'stable'
      },
      services: {
        impact: Number((baseImpact * 1.2).toFixed(1)), // Moderately sensitive
        outlook: baseImpact > 1.5 ? 'positive' : baseImpact < -1.5 ? 'negative' : 'neutral'
      }
    }
  }

  /**
   * Score wage health component for composite scoring
   */
  private scoreWageHealthComponent(wageAnalysis: WageGrowthAnalysis): number {
    let score = 5.0

    // Real wage growth is most important
    if (wageAnalysis.realWageGrowth) score += 2.0

    // Current growth rate matters
    if (wageAnalysis.currentGrowthRate >= 4.0) score += 1.5
    else if (wageAnalysis.currentGrowthRate >= 3.0) score += 1.0
    else if (wageAnalysis.currentGrowthRate < 2.0) score -= 1.0

    // Trend direction
    if (wageAnalysis.trend.direction === 'increasing') score += 1.0
    else if (wageAnalysis.trend.direction === 'decreasing') score -= 1.0

    // Purchasing power trend
    if (wageAnalysis.purchasingPowerTrend === 'improving') score += 1.5
    else if (wageAnalysis.purchasingPowerTrend === 'declining') score -= 1.5

    return Math.max(0, Math.min(10, score))
  }

  /**
   * Determine economic phase based on composite indicators
   */
  private determineEconomicPhase(
    compositeScore: number,
    trend: string,
    jobMarketHealth: JobMarketHealthScore
  ): 'expansion' | 'peak' | 'contraction' | 'trough' | 'recovery' {

    if (compositeScore >= 80 && trend === 'strengthening') return 'expansion'
    if (compositeScore >= 85 && trend === 'stable') return 'peak'
    if (compositeScore >= 75 && trend === 'weakening') return 'peak'
    if (compositeScore < 60 && trend === 'weakening') return 'contraction'
    if (compositeScore < 40) return 'trough'
    if (compositeScore >= 50 && trend === 'strengthening') return 'recovery'

    return 'expansion' // Default
  }

  /**
   * Identify key risks and opportunities
   */
  private identifyRisksAndOpportunities(
    employmentStrength: EmploymentStrengthScore,
    jobMarketHealth: JobMarketHealthScore,
    wageGrowth: WageGrowthAnalysis,
    spendingPower: ConsumerSpendingPower
  ) {
    const riskFactors: string[] = []
    const opportunities: string[] = []

    // Employment risks
    if (employmentStrength.overallScore < 5.0) {
      riskFactors.push('Weak employment conditions threaten consumer spending')
    }
    if (jobMarketHealth.marketCondition === 'distressed') {
      riskFactors.push('Distressed job market indicates economic stress')
    }

    // Wage growth risks
    if (!wageGrowth.realWageGrowth) {
      riskFactors.push('Wages not keeping pace with inflation erodes purchasing power')
    }
    if (wageGrowth.consumptionImpact === 'negative') {
      riskFactors.push('Declining real wages will pressure consumer discretionary spending')
    }

    // Employment opportunities
    if (employmentStrength.overallScore >= 8.0) {
      opportunities.push('Strong employment supports robust consumer spending growth')
    }
    if (jobMarketHealth.marketCondition === 'tight') {
      opportunities.push('Tight labor market drives wage growth and consumer confidence')
    }

    // Wage opportunities
    if (wageGrowth.realWageGrowth && wageGrowth.currentGrowthRate >= 4.0) {
      opportunities.push('Strong real wage growth boosts consumer purchasing power')
    }
    if (spendingPower.spendingPowerIndex >= 75) {
      opportunities.push('High consumer spending power benefits discretionary sectors')
    }

    return { riskFactors, opportunities }
  }
}