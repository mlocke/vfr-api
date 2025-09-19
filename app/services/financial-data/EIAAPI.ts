/**
 * Energy Information Administration (EIA) API implementation
 * Provides access to U.S. energy data including crude oil, natural gas, electricity, and renewable energy statistics
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types.js'

interface EIADataPoint {
  period: string
  value: number | null
  duoarea?: string
  'area-name'?: string
  product?: string
  'product-name'?: string
  process?: string
  'process-name'?: string
  series?: string
  'series-description'?: string
  units?: string
}

interface EIAResponse {
  response: {
    total: number
    dateFormat: string
    frequency: string
    data: EIADataPoint[]
    description: string
    id: string
  }
  request: {
    command: string
    params: any
    route: string
  }
  apiVersion: string
}

export class EIAAPI implements FinancialDataProvider {
  name = 'Energy Information Administration API'
  private baseUrl = 'https://api.eia.gov/v2'
  private apiKey: string
  private timeout: number
  private throwErrors: boolean

  // Key EIA energy indicators for financial analysis
  private readonly POPULAR_SERIES: Record<string, string> = {
    // === TIER 1: Core Energy Indicators ===
    // Crude Oil
    'PET.RWTC.D': 'Cushing, OK WTI Spot Price FOB (Dollars per Barrel)',
    'PET.RBRTE.D': 'Europe Brent Spot Price FOB (Dollars per Barrel)',
    'PET.WCRSTUS1.W': 'U.S. Crude Oil Inventories (Thousand Barrels)',
    'PET.WCRFPUS2.W': 'U.S. Crude Oil Production (Thousand Barrels per Day)',

    // Natural Gas
    'NG.RNGWHHD.D': 'Henry Hub Natural Gas Spot Price (Dollars per Million Btu)',
    'NG.NW2_EPG0_SWO_R48_BCF.W': 'U.S. Natural Gas in Underground Storage (Billion Cubic Feet)',
    'NG.N9070US2.M': 'U.S. Natural Gas Marketed Production (Million Cubic Feet)',

    // Gasoline
    'PET.EMM_EPMR_PTE_NUS_DPG.W': 'U.S. Regular Gasoline Retail Price (Dollars per Gallon)',
    'PET.WGFUPUS2.W': 'U.S. Gasoline Production (Thousand Barrels per Day)',
    'PET.WGTSTUS1.W': 'U.S. Gasoline Inventories (Thousand Barrels)',

    // === TIER 2: Market Sentiment Indicators ===
    // Electricity
    'ELEC.GEN.ALL-US-99.M': 'U.S. Total Electricity Generation (Thousand Megawatthours)',
    'ELEC.PRICE.US-ALL.M': 'U.S. Average Electricity Price (Cents per Kilowatthour)',
    'ELEC.GEN.COW-US-99.M': 'U.S. Coal Electricity Generation (Thousand Megawatthours)',
    'ELEC.GEN.NG-US-99.M': 'U.S. Natural Gas Electricity Generation (Thousand Megawatthours)',

    // Renewables
    'ELEC.GEN.WND-US-99.M': 'U.S. Wind Electricity Generation (Thousand Megawatthours)',
    'ELEC.GEN.SUN-US-99.M': 'U.S. Solar Electricity Generation (Thousand Megawatthours)',
    'ELEC.GEN.HYC-US-99.M': 'U.S. Hydroelectric Generation (Thousand Megawatthours)',

    // Refined Products
    'PET.WDIUPUS2.W': 'U.S. Distillate Fuel Oil Production (Thousand Barrels per Day)',
    'PET.WKJUPUS2.W': 'U.S. Kerosene-Type Jet Fuel Production (Thousand Barrels per Day)',

    // === TIER 3: Global & Trade Indicators ===
    // Imports/Exports
    'PET.MCRIMUS2.M': 'U.S. Crude Oil Imports (Thousand Barrels per Day)',
    'PET.MCREXUS2.M': 'U.S. Crude Oil Exports (Thousand Barrels per Day)',
    'NG.N9103US2.M': 'U.S. Natural Gas Imports (Million Cubic Feet)',
    'NG.N9130US2.M': 'U.S. Natural Gas Exports (Million Cubic Feet)',

    // Coal
    'COAL.CONS_TOT.US-99.M': 'U.S. Total Coal Consumption (Thousand Short Tons)',
    'COAL.PROD_TOT.US-99.M': 'U.S. Total Coal Production (Thousand Short Tons)'
  }

  constructor(apiKey?: string, timeout = 15000, throwErrors = false) {
    this.apiKey = apiKey || process.env.EIA_API_KEY || ''
    this.timeout = timeout
    this.throwErrors = throwErrors

    if (this.apiKey && !this.isValidApiKeyFormat(this.apiKey)) {
      console.warn('EIA API key format appears invalid. Expected a 40-character alphanumeric string.')
      if (this.throwErrors) throw new Error('Invalid EIA API key format')
    }
  }

  /**
   * Validate EIA API key format
   * EIA requires a 40-character alphanumeric string
   */
  private isValidApiKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false
    // EIA API key is typically 40 characters, alphanumeric
    const eiaKeyPattern = /^[a-zA-Z0-9]{40}$/
    return eiaKeyPattern.test(apiKey)
  }

  /**
   * Get current energy data for a series (adapts to StockData interface)
   * For EIA, we treat series as "symbols" and return energy data
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('EIA API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      if (!this.isValidApiKeyFormat(this.apiKey)) {
        const error = new Error('EIA API key format is invalid. Key must be a 40-character alphanumeric string.')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const seriesId = symbol.toUpperCase()
      if (!this.POPULAR_SERIES[seriesId]) {
        console.warn(`EIA series ${seriesId} not found in popular series`)
        if (this.throwErrors) throw new Error(`Unknown EIA series: ${seriesId}`)
        return null
      }

      const latestData = await this.getLatestObservation(seriesId)
      if (!latestData) return null

      const value = latestData.value
      if (value === null || isNaN(value)) return null

      return {
        symbol: seriesId,
        price: Number(value.toFixed(2)),
        change: 0, // Energy data doesn't have traditional change - would need historical data
        changePercent: 0,
        volume: 0, // Not applicable to energy data
        timestamp: new Date(latestData.period).getTime(),
        source: 'eia'
      }
    } catch (error) {
      console.error(`EIA API error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Get series information (adapts to CompanyInfo interface)
   * For EIA, we return series metadata as "company info"
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      const seriesId = symbol.toUpperCase()
      const seriesTitle = this.POPULAR_SERIES[seriesId]

      if (!seriesTitle) {
        console.warn(`EIA series ${seriesId} not found`)
        if (this.throwErrors) throw new Error(`Unknown EIA series: ${seriesId}`)
        return null
      }

      return {
        symbol: seriesId,
        name: seriesTitle,
        description: `Energy Information Administration data series: ${seriesTitle}`,
        sector: 'Energy Data',
        marketCap: 0, // Not applicable
        employees: 0  // Not applicable
      }
    } catch (error) {
      console.error(`EIA series info error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Get market data (adapts to MarketData interface)
   * For EIA, we return latest observation data
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      if (!this.apiKey) {
        const error = new Error('EIA API key not configured')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      if (!this.isValidApiKeyFormat(this.apiKey)) {
        const error = new Error('EIA API key format is invalid. Key must be a 40-character alphanumeric string.')
        console.warn(error.message)
        if (this.throwErrors) throw error
        return null
      }

      const seriesId = symbol.toUpperCase()
      const latestData = await this.getLatestObservation(seriesId)
      if (!latestData) return null

      const value = latestData.value
      if (value === null || isNaN(value)) return null

      // For energy data, we use the value as all OHLC values since there's no intraday trading
      return {
        symbol: seriesId,
        open: Number(value.toFixed(2)),
        high: Number(value.toFixed(2)),
        low: Number(value.toFixed(2)),
        close: Number(value.toFixed(2)),
        volume: 0, // Not applicable to energy data
        timestamp: new Date(latestData.period).getTime(),
        source: 'eia'
      }
    } catch (error) {
      console.error(`EIA market data error for ${symbol}:`, error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Health check for EIA API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        console.warn('EIA API key not configured')
        return false
      }

      if (!this.isValidApiKeyFormat(this.apiKey)) {
        console.warn('EIA API key format is invalid. Key must be a 40-character alphanumeric string.')
        return false
      }

      // Test with WTI crude oil price - always available
      const response = await this.makeRequest('seriesid/PET.RWTC.D', {
        'length': '1'
      })

      return response.success && !!response.data?.response?.data?.[0]
    } catch (error) {
      console.error('EIA health check failed:', error instanceof Error ? error.message : error)
      return false
    }
  }

  /**
   * Get latest observation for an EIA series
   */
  async getLatestObservation(seriesId: string): Promise<EIADataPoint | null> {
    try {
      console.log(`🔍 Getting latest observation for ${seriesId}...`)
      const response = await this.makeRequest(`seriesid/${seriesId}`, {
        'length': '1'
      })

      console.log(`📊 Response for ${seriesId}:`, {
        success: response.success,
        hasData: !!response.data,
        hasResponse: !!response.data?.response,
        dataLength: response.data?.response?.data?.length,
        error: response.error
      })

      if (!response.success) {
        console.error(`❌ Request failed for ${seriesId}:`, response.error)
        return null
      }

      if (!response.data?.response?.data?.length) {
        console.warn(`⚠️ No data found for ${seriesId}`)
        return null
      }

      const dataPoint = response.data.response.data[0]
      console.log(`✅ Found observation for ${seriesId}:`, dataPoint)
      return dataPoint
    } catch (error) {
      console.error(`Failed to get latest observation for ${seriesId}:`, error)
      return null
    }
  }

  /**
   * Get popular energy indicators
   */
  getPopularIndicators(): Array<{symbol: string, name: string}> {
    return Object.entries(this.POPULAR_SERIES).map(([symbol, name]) => ({
      symbol,
      name
    }))
  }

  /**
   * Get Tier 1 core energy indicators for individual investor decision-making
   */
  getTier1Indicators(): Array<{symbol: string, name: string, category: string}> {
    const tier1Series = {
      // Crude Oil
      'PET.RWTC.D': { name: 'Cushing, OK WTI Spot Price FOB', category: 'Crude Oil' },
      'PET.RBRTE.D': { name: 'Europe Brent Spot Price FOB', category: 'Crude Oil' },
      'PET.WCRSTUS1.W': { name: 'U.S. Crude Oil Inventories', category: 'Crude Oil' },

      // Natural Gas
      'NG.RNGWHHD.D': { name: 'Henry Hub Natural Gas Spot Price', category: 'Natural Gas' },
      'NG.NW2_EPG0_SWO_R48_BCF.W': { name: 'U.S. Natural Gas in Underground Storage', category: 'Natural Gas' },

      // Gasoline
      'PET.EMM_EPMR_PTE_NUS_DPG.W': { name: 'U.S. Regular Gasoline Retail Price', category: 'Gasoline' }
    }

    return Object.entries(tier1Series).map(([symbol, info]) => ({
      symbol,
      name: info.name,
      category: info.category
    }))
  }

  /**
   * Get Tier 2 market sentiment indicators for advanced analysis
   */
  getTier2Indicators(): Array<{symbol: string, name: string, category: string}> {
    const tier2Series = {
      // Electricity
      'ELEC.GEN.ALL-US-99.M': { name: 'U.S. Total Electricity Generation', category: 'Electricity' },
      'ELEC.PRICE.US-ALL.M': { name: 'U.S. Average Electricity Price', category: 'Electricity' },

      // Renewables
      'ELEC.GEN.WND-US-99.M': { name: 'U.S. Wind Electricity Generation', category: 'Renewables' },
      'ELEC.GEN.SUN-US-99.M': { name: 'U.S. Solar Electricity Generation', category: 'Renewables' },

      // Refined Products
      'PET.WDIUPUS2.W': { name: 'U.S. Distillate Fuel Oil Production', category: 'Refined Products' },
      'PET.WKJUPUS2.W': { name: 'U.S. Kerosene-Type Jet Fuel Production', category: 'Refined Products' }
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

  /**
   * Get historical data for a series
   */
  async getSeriesData(seriesId: string, length = 100): Promise<EIADataPoint[]> {
    if (!this.apiKey) {
      const error = new Error('EIA API key not configured')
      console.warn(error.message)
      if (this.throwErrors) throw error
      return []
    }

    try {
      const response = await this.makeRequest(`seriesid/${seriesId}`, {
        'length': length.toString()
      })

      if (!response.success || !response.data?.response?.data) {
        return []
      }

      return response.data.response.data
    } catch (error) {
      console.error(`EIA getSeriesData error for ${seriesId}:`, error)
      if (this.throwErrors) throw error
      return []
    }
  }

  /**
   * Make HTTP request to EIA API
   */
  private async makeRequest(endpoint: string, params: Record<string, string>): Promise<ApiResponse<EIAResponse>> {
    try {
      // Construct URL more explicitly to avoid issues
      const fullUrl = `${this.baseUrl}/${endpoint}`
      const url = new URL(fullUrl)

      // Add API key
      url.searchParams.append('api_key', this.apiKey)

      // Add other parameters
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })

      console.log(`🌐 EIA API URL: ${url.toString()}`)

      // Simplified fetch without AbortController to test HTTP 500 issue
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VFR-API/1.0 (contact@veritak.com)',
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Check for EIA API error messages
      if (data.error) {
        let errorMessage = data.error

        // Provide more helpful error messages for common issues
        if (data.error.includes('invalid api_key')) {
          errorMessage = 'EIA API key is invalid. Please check your EIA_API_KEY environment variable.'
        } else if (data.error.includes('series not found')) {
          errorMessage = `EIA series not found. Please check the series ID.`
        }

        throw new Error(errorMessage)
      }

      return {
        success: true,
        data,
        source: 'eia',
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'eia',
        timestamp: Date.now()
      }
    }
  }
}