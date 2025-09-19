/**
 * Bureau of Labor Statistics (BLS) API implementation
 * Provides access to U.S. labor market and economic data including employment, inflation, and wage statistics
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types.js'

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

export class BLSAPI implements FinancialDataProvider {
  name = 'Bureau of Labor Statistics API'
  private baseUrl = 'https://api.bls.gov/publicAPI/v2'
  private apiKey: string
  private timeout: number
  private throwErrors: boolean
  private userAgent: string

  // Key BLS economic indicators for financial analysis
  private readonly POPULAR_SERIES: Record<string, string> = {
    // Employment & Unemployment
    'LNS14000000': 'Unemployment Rate (Seasonally Adjusted)',
    'LNS13327709': 'Alternative Unemployment Rate (U-6)',
    'LNU04000000': 'Unemployment Rate (Not Seasonally Adjusted)',
    'CES0000000001': 'All Employees, Total Nonfarm',
    'LNS12000000': 'Labor Force Participation Rate',
    'LNS12300000': 'Employment-Population Ratio',
    'JTS1000JOL': 'Job Openings: Total Nonfarm',

    // Inflation & Consumer Prices
    'CUUR0000SA0': 'Consumer Price Index - All Urban Consumers (CPI-U)',
    'CUSR0000SA0': 'Consumer Price Index - All Urban Consumers (Seasonally Adjusted)',
    'CUUR0000SA0L1E': 'CPI-U: All Items Less Food and Energy',
    'CUUR0000SETB01': 'CPI-U: Gasoline (All Types)',
    'CUUR0000SAH1': 'CPI-U: Shelter',

    // Producer Prices
    'WPUFD49207': 'Producer Price Index: Final Demand',
    'WPUFD49104': 'PPI: Final Demand Less Food and Energy',

    // Wages & Earnings
    'CES0500000003': 'Average Hourly Earnings: Total Private',
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

      return {
        success: true,
        data,
        source: 'bls',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error.name === 'AbortError') {
        throw new Error(`BLS API request timeout after ${this.timeout}ms`)
      }

      return {
        success: false,
        error: error.message,
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
}