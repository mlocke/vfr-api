/**
 * Direct Data.gov and Government APIs implementation
 * Provides access to U.S. government economic and financial datasets
 * Documentation: https://api.data.gov/docs/
 *
 * Integrates multiple government data sources:
 * - Data.gov catalog API (metadata)
 * - Census Bureau Economic Data
 * - Bureau of Labor Statistics (BLS)
 * - Bureau of Economic Analysis (BEA)
 */

import { StockData, CompanyInfo, MarketData, FinancialDataProvider, ApiResponse } from './types'

export class DataGovAPI implements FinancialDataProvider {
  name = 'Data.gov API'
  private baseUrl = 'https://api.gsa.gov/technology/datagov/v3'
  private censusUrl = 'https://api.census.gov/data'
  private blsUrl = 'https://api.bls.gov/publicAPI/v2'
  private beaUrl = 'https://apps.bea.gov/api/data'
  private apiKey: string
  private timeout: number
  private userAgent: string

  constructor(apiKey?: string, timeout = 8000) {
    this.apiKey = apiKey || process.env.DATA_GOV_API_KEY || process.env.BLS_API_KEY || 'DEMO_KEY'
    this.timeout = timeout
    this.userAgent = process.env.DATA_GOV_USER_AGENT || 'VFR-API/1.0 (contact@veritak.com)'
  }

  /**
   * Get economic indicators as stock-like data
   * Returns unemployment rate as a financial metric
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      // For economic indicators, map symbols to BLS data
      let seriesId: string
      let metricName: string

      switch (symbol.toUpperCase()) {
        case 'UNEMPLOYMENT':
        case 'UNEMP':
          seriesId = 'LNS14000000' // Unemployment Rate
          metricName = 'Unemployment Rate'
          break
        case 'INFLATION':
        case 'CPI':
          seriesId = 'CUUR0000SA0' // Consumer Price Index
          metricName = 'CPI All Items'
          break
        case 'GDP':
          // Will use BEA API for GDP
          return this.getGDPData()
        default:
          // Try to find dataset by symbol in Data.gov catalog
          return this.searchDatasetBySymbol(symbol)
      }

      const data = await this.getBLSData(seriesId)
      if (!data || !data.Results?.series?.[0]?.data?.[0]) {
        return null
      }

      const latestData = data.Results.series[0].data[0]
      const value = parseFloat(latestData.value)

      return {
        symbol: symbol.toUpperCase(),
        price: value,
        change: 0, // Would need historical data to calculate
        changePercent: 0,
        volume: 0,
        timestamp: Date.now(),
        source: 'data.gov'
      }
    } catch (error) {
      console.error(`Data.gov API error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get economic entity information
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    try {
      // For government data, return economic indicator information
      const datasets = await this.searchDatasets(symbol, 'economic financial')

      if (!datasets || datasets.length === 0) {
        return null
      }

      const dataset = datasets[0]
      return {
        symbol: symbol.toUpperCase(),
        name: dataset.title || 'Economic Indicator',
        description: dataset.notes || 'Government economic data',
        sector: 'Government Data',
        marketCap: 0,
        employees: 0,
        website: dataset.url || 'https://data.gov'
      }
    } catch (error) {
      console.error(`Data.gov company info error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get economic time series data as market data
   */
  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      const stockData = await this.getStockPrice(symbol)
      if (!stockData) {
        return null
      }

      return {
        symbol: stockData.symbol,
        open: stockData.price,
        high: stockData.price,
        low: stockData.price,
        close: stockData.price,
        volume: 0,
        timestamp: stockData.timestamp,
        source: 'data.gov'
      }
    } catch (error) {
      console.error(`Data.gov market data error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Health check for Data.gov API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/action/status_show`, {
        headers: {
          'X-API-Key': this.apiKey,
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(this.timeout)
      })

      return response.ok
    } catch (error) {
      console.log('Data.gov API health check failed:', error)
      return false
    }
  }

  /**
   * Search for datasets in Data.gov catalog
   */
  async searchDatasets(query: string, tags?: string): Promise<any[]> {
    try {
      let url = `${this.baseUrl}/action/package_search?q=${encodeURIComponent(query)}`
      if (tags) {
        url += `&fq=tags:${encodeURIComponent(tags)}`
      }

      const response = await this.makeRequest(url)
      return response.success && response.data?.result?.results ? response.data.result.results : []
    } catch (error) {
      console.error('Data.gov search error:', error)
      return []
    }
  }

  /**
   * Get BLS (Bureau of Labor Statistics) data
   */
  async getBLSData(seriesId: string): Promise<any> {
    try {
      const currentYear = new Date().getFullYear()
      const startYear = currentYear - 1

      const blsApiKey = process.env.BLS_API_KEY || this.apiKey
      const requestData = {
        seriesid: [seriesId],
        startyear: startYear.toString(),
        endyear: currentYear.toString(),
        registrationkey: blsApiKey !== 'DEMO_KEY' ? blsApiKey : undefined
      }

      const response = await fetch(`${this.blsUrl}/timeseries/data/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent
        },
        body: JSON.stringify(requestData),
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('BLS API error:', error)
      return null
    }
  }

  /**
   * Get GDP data from Bureau of Economic Analysis
   */
  async getGDPData(): Promise<StockData | null> {
    try {
      // BEA requires registration, use demo for now
      const response = await this.makeRequest(
        `${this.beaUrl}?method=GetData&datasetname=NIPA&TableName=T10101&Frequency=Q&Year=X&ResultFormat=json&UserID=DEMO_KEY`
      )

      if (!response.success || !response.data?.BEAAPI?.Results?.Data) {
        return null
      }

      const data = response.data.BEAAPI.Results.Data
      const latestGDP = data[data.length - 1]

      if (!latestGDP?.DataValue) {
        return null
      }

      return {
        symbol: 'GDP',
        price: parseFloat(latestGDP.DataValue.replace(',', '')),
        change: 0,
        changePercent: 0,
        volume: 0,
        timestamp: Date.now(),
        source: 'data.gov'
      }
    } catch (error) {
      console.error('BEA GDP error:', error)
      return null
    }
  }

  /**
   * Search for a specific dataset by symbol
   */
  async searchDatasetBySymbol(symbol: string): Promise<StockData | null> {
    try {
      const datasets = await this.searchDatasets(symbol)
      if (!datasets || datasets.length === 0) {
        return null
      }

      // For demo purposes, return a placeholder based on dataset metadata
      const dataset = datasets[0]
      return {
        symbol: symbol.toUpperCase(),
        price: Math.random() * 100, // Placeholder - would need to fetch actual data
        change: 0,
        changePercent: 0,
        volume: 0,
        timestamp: Date.now(),
        source: 'data.gov'
      }
    } catch (error) {
      console.error('Dataset search error:', error)
      return null
    }
  }

  /**
   * Get economic indicators list
   */
  async getEconomicIndicators(): Promise<any[]> {
    try {
      const indicators = await this.searchDatasets('economic indicators', 'economics')
      return indicators.slice(0, 10) // Return top 10 economic datasets
    } catch (error) {
      console.error('Economic indicators error:', error)
      return []
    }
  }

  /**
   * Get Census Bureau economic data
   */
  async getCensusEconomicData(dataset: string = '2022/acs/acs1'): Promise<any> {
    try {
      // Example: Get state-level economic data
      const response = await this.makeRequest(
        `${this.censusUrl}/${dataset}?get=NAME,B08301_001E,B08301_010E&for=state:*`
      )

      return response.success ? response.data : null
    } catch (error) {
      console.error('Census economic data error:', error)
      return null
    }
  }

  /**
   * Make HTTP request to Data.gov APIs
   */
  private async makeRequest(url: string, options: RequestInit = {}): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': this.userAgent,
          'X-API-Key': this.apiKey,
          ...options.headers
        },
        ...options
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      return {
        success: true,
        data,
        source: 'data.gov',
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'data.gov',
        timestamp: Date.now()
      }
    }
  }
}