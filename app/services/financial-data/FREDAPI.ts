/**
 * FRED (Federal Reserve Economic Data) API implementation
 * Provides access to 800,000+ economic time series from the Federal Reserve Bank of St. Louis
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types.js'

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

export class FREDAPI implements FinancialDataProvider {
  name = 'FRED API'
  private baseUrl = 'https://api.stlouisfed.org/fred/'
  private apiKey: string
  private timeout: number
  private throwErrors: boolean

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

    // Money Supply
    'M1SL': 'M1 Money Stock',
    'M2SL': 'M2 Money Stock',

    // Housing
    'HOUST': 'Housing Starts: Total: New Privately Owned Housing Units Started',
    'CSUSHPISA': 'S&P/Case-Shiller U.S. National Home Price Index',

    // Industrial
    'INDPRO': 'Industrial Production Index',
    'CAPACITY': 'Capacity Utilization: Total Industry'
  }

  constructor(apiKey?: string, timeout = 15000, throwErrors = false) {
    this.apiKey = apiKey || process.env.FRED_API_KEY || ''
    this.timeout = timeout
    this.throwErrors = throwErrors

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