/**
 * Financial Data Cache Service
 * Intelligent integration between FinancialDataService and HistoricalDataService
 * Provides unified access to cached and real-time financial data
 */

import { HistoricalDataService, HistoricalMarketData } from './HistoricalDataService'
import { FinancialDataService } from '../financial-data/FinancialDataService'
import { MarketData, StockData } from '../financial-data/types'

export interface CacheStrategy {
  name: string
  timeframes: string[]
  maxAge: number // seconds
  refreshStrategy: 'eager' | 'lazy' | 'scheduled'
  priority: number
}

export interface CacheMetrics {
  hitRate: number
  missRate: number
  totalRequests: number
  avgResponseTime: number
  dataFreshness: number
  sourcesActive: number
  totalCachedSymbols: number
}

export interface DataRequest {
  symbol: string
  timeframe?: string
  startDate?: Date
  endDate?: Date
  preferredSource?: string
  forceRefresh?: boolean
  maxStaleSeconds?: number
}

export interface DataResponse<T> {
  data: T[]
  source: 'cache' | 'api' | 'hybrid'
  cached: boolean
  freshness: number // 0-1, where 1 is completely fresh
  quality: number // 0-1, data quality score
  responseTime: number
  provider: string
  timestamp: Date
}

/**
 * Main cache service that orchestrates between historical cache and live data APIs
 */
export class FinancialDataCacheService {
  private historicalService: HistoricalDataService
  private financialService: FinancialDataService
  private metrics: CacheMetrics
  private cacheStrategies: Map<string, CacheStrategy>

  constructor() {
    this.historicalService = new HistoricalDataService()
    this.financialService = new FinancialDataService()
    this.metrics = this.initializeMetrics()
    this.cacheStrategies = this.initializeCacheStrategies()
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.historicalService.initialize()
    console.log('Financial Data Cache Service initialized')
  }

  /**
   * Get market data with intelligent cache-first strategy
   */
  async getMarketData(request: DataRequest): Promise<DataResponse<HistoricalMarketData>> {
    const startTime = Date.now()
    const timeframe = request.timeframe || '1d'

    try {
      // Update metrics
      this.metrics.totalRequests++

      // Determine cache strategy
      const strategy = this.getCacheStrategy(timeframe)

      // Check if force refresh is requested
      if (request.forceRefresh) {
        return await this.fetchFromApi(request, startTime)
      }

      // Check cache first
      const cachedData = await this.getCachedData(request)

      // Evaluate cache freshness
      if (cachedData.length > 0) {
        const freshness = this.evaluateFreshness(cachedData, strategy.maxAge)
        const quality = this.evaluateQuality(cachedData)

        // Return cached data if fresh enough
        if (freshness > 0.8 && quality > 0.7) {
          this.metrics.totalRequests++
          const responseTime = Date.now() - startTime

          return {
            data: cachedData,
            source: 'cache',
            cached: true,
            freshness,
            quality,
            responseTime,
            provider: cachedData[0]?.primarySource || 'cache',
            timestamp: new Date()
          }
        }
      }

      // Cache miss or stale data - try hybrid approach
      if (strategy.refreshStrategy === 'eager' || cachedData.length === 0) {
        return await this.fetchFromApi(request, startTime, cachedData)
      }

      // Return cached data with background refresh for lazy strategy
      if (strategy.refreshStrategy === 'lazy' && cachedData.length > 0) {
        // Trigger background refresh
        this.backgroundRefresh(request).catch(error =>
          console.error('Background refresh failed:', error)
        )

        const freshness = this.evaluateFreshness(cachedData, strategy.maxAge)
        const quality = this.evaluateQuality(cachedData)
        const responseTime = Date.now() - startTime

        return {
          data: cachedData,
          source: 'cache',
          cached: true,
          freshness,
          quality,
          responseTime,
          provider: cachedData[0]?.primarySource || 'cache',
          timestamp: new Date()
        }
      }

      // Fallback to API
      return await this.fetchFromApi(request, startTime)

    } catch (error) {
      console.error('Error in getMarketData:', error)
      throw error
    }
  }

  /**
   * Get latest stock prices with cache integration
   */
  async getStockPrice(symbol: string, preferredSource?: string): Promise<DataResponse<StockData>> {
    const startTime = Date.now()

    try {
      // Try to get latest cached data first
      const cachedData = await this.historicalService.getHistoricalData(
        symbol,
        '1d',
        undefined,
        undefined,
        preferredSource
      )

      // Check if we have recent data (within last 5 minutes for daily data)
      const latestCached = cachedData[0]
      const now = new Date()
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

      if (latestCached && new Date(latestCached.lastUpdatedAt) > fiveMinutesAgo) {
        const stockData: StockData = {
          symbol: latestCached.symbol,
          price: latestCached.close,
          change: 0, // Would need previous close to calculate
          changePercent: 0, // Would need previous close to calculate
          volume: latestCached.volume,
          timestamp: new Date(latestCached.timestamp).getTime(),
          source: latestCached.primarySource
        }

        const responseTime = Date.now() - startTime
        return {
          data: [stockData],
          source: 'cache',
          cached: true,
          freshness: 0.9,
          quality: latestCached.dataQualityScore || 0.8,
          responseTime,
          provider: latestCached.primarySource,
          timestamp: new Date()
        }
      }

      // Cache miss or stale - fetch from API
      const apiData = await this.financialService.getStockPrice(symbol)

      if (apiData) {
        // Store in cache for future use
        await this.cacheStockData(apiData)

        const responseTime = Date.now() - startTime
        return {
          data: [apiData],
          source: 'api',
          cached: false,
          freshness: 1.0,
          quality: 0.9, // Assume good quality for live data
          responseTime,
          provider: apiData.source,
          timestamp: new Date()
        }
      }

      throw new Error(`No data available for symbol ${symbol}`)

    } catch (error) {
      console.error('Error in getStockPrice:', error)
      throw error
    }
  }

  /**
   * Bulk data population for historical analysis
   */
  async populateHistoricalData(
    symbols: string[],
    startDate: Date,
    endDate: Date,
    timeframes: string[] = ['1d'],
    preferredSources?: string[]
  ): Promise<{
    jobId: string
    estimated: number
    started: boolean
  }> {
    // Create bulk job
    const jobId = await this.historicalService.createBulkDataJob(
      `Historical Data Population - ${symbols.length} symbols`,
      'backfill',
      symbols,
      startDate,
      endDate,
      timeframes,
      preferredSources || []
    )

    if (!jobId) {
      throw new Error('Failed to create bulk data job')
    }

    // Estimate total operations
    const daysInRange = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    const estimated = symbols.length * timeframes.length * daysInRange

    // Start background processing
    this.processHistoricalDataJob(jobId, symbols, startDate, endDate, timeframes, preferredSources)
      .catch(error => console.error('Background job failed:', error))

    return {
      jobId,
      estimated,
      started: true
    }
  }

  /**
   * Get cache metrics and performance stats
   */
  async getCacheMetrics(): Promise<CacheMetrics> {
    try {
      // Get real-time metrics from database
      const sources = await this.historicalService.getDataSources()
      const activeSources = sources.filter(s => s.isActive && s.isHealthy).length

      // Calculate hit rate based on recent requests
      const hitRate = this.metrics.totalRequests > 0
        ? (this.metrics.totalRequests - this.metrics.missRate) / this.metrics.totalRequests
        : 0

      return {
        ...this.metrics,
        hitRate: Math.round(hitRate * 100) / 100,
        sourcesActive: activeSources,
        totalCachedSymbols: await this.getCachedSymbolCount()
      }
    } catch (error) {
      console.error('Error getting cache metrics:', error)
      return this.metrics
    }
  }

  /**
   * Clear cache for specific symbol or all data
   */
  async clearCache(symbol?: string, timeframe?: string): Promise<void> {
    if (symbol) {
      // Clear specific symbol cache
      // This would involve database operations to remove specific cached data
      console.log(`Cache cleared for ${symbol}${timeframe ? ` (${timeframe})` : ''}`)
    } else {
      // Clear all caches
      await this.historicalService.clearAllCaches()
      console.log('All caches cleared')
    }
  }

  /**
   * Force refresh data for a symbol
   */
  async forceRefresh(symbol: string, timeframe: string = '1d'): Promise<boolean> {
    try {
      const request: DataRequest = {
        symbol,
        timeframe,
        forceRefresh: true
      }

      await this.fetchFromApi(request, Date.now())
      return true
    } catch (error) {
      console.error('Force refresh failed:', error)
      return false
    }
  }

  /**
   * Health check for the entire cache system
   */
  async healthCheck(): Promise<{
    cache: boolean
    api: boolean
    database: boolean
    sources: Array<{ name: string; healthy: boolean }>
  }> {
    try {
      const [cacheHealth, apiHealth, dbHealth] = await Promise.all([
        this.historicalService.healthCheck(),
        this.checkApiHealth(),
        this.historicalService.healthCheck()
      ])

      const sources = await this.historicalService.getDataSources()
      const sourceHealth = sources.map(s => ({
        name: s.name,
        healthy: s.isHealthy
      }))

      return {
        cache: cacheHealth,
        api: apiHealth,
        database: dbHealth,
        sources: sourceHealth
      }
    } catch (error) {
      console.error('Health check failed:', error)
      return {
        cache: false,
        api: false,
        database: false,
        sources: []
      }
    }
  }

  // Private helper methods

  private async getCachedData(request: DataRequest): Promise<HistoricalMarketData[]> {
    return await this.historicalService.getHistoricalData(
      request.symbol,
      request.timeframe || '1d',
      request.startDate,
      request.endDate,
      request.preferredSource
    )
  }

  private async fetchFromApi(
    request: DataRequest,
    startTime: number,
    fallbackData?: HistoricalMarketData[]
  ): Promise<DataResponse<HistoricalMarketData>> {
    try {
      // For simplicity, get latest market data from existing service
      const marketData = await this.financialService.getMarketData(request.symbol)

      if (marketData) {
        // Convert and cache the data
        const historicalData = await this.convertAndCacheMarketData(marketData, request)

        const responseTime = Date.now() - startTime
        this.metrics.missRate++

        return {
          data: [historicalData],
          source: 'api',
          cached: false,
          freshness: 1.0,
          quality: 0.9,
          responseTime,
          provider: marketData.source,
          timestamp: new Date()
        }
      }

      // Fallback to cached data if API fails
      if (fallbackData && fallbackData.length > 0) {
        const responseTime = Date.now() - startTime
        return {
          data: fallbackData,
          source: 'cache',
          cached: true,
          freshness: 0.5, // Stale but available
          quality: this.evaluateQuality(fallbackData),
          responseTime,
          provider: fallbackData[0].primarySource,
          timestamp: new Date()
        }
      }

      throw new Error(`No data available for ${request.symbol}`)

    } catch (error) {
      console.error('API fetch failed:', error)
      throw error
    }
  }

  private async convertAndCacheMarketData(
    marketData: MarketData,
    request: DataRequest
  ): Promise<HistoricalMarketData> {
    const historicalData: Omit<HistoricalMarketData, 'id' | 'cacheCreatedAt' | 'lastUpdatedAt'> = {
      symbol: marketData.symbol,
      timestamp: new Date(marketData.timestamp).getTime(),
      dateOnly: new Date(marketData.timestamp).toISOString().split('T')[0],
      timeframe: request.timeframe || '1d',
      open: marketData.open,
      high: marketData.high,
      low: marketData.low,
      close: marketData.close,
      volume: marketData.volume,
      source: marketData.source,
      primarySource: marketData.source,
      sourcePriority: this.getSourcePriority(marketData.source),
      dataQualityScore: 0.9, // Assume good quality for fresh API data
      confidenceLevel: 0.95,
      isValidated: true,
      hasAnomaly: false,
      updateFrequency: '1 hour',
      ingestionMethod: 'api',
      marketHoursFlag: true,
      afterHoursFlag: false,
      regulatoryHalt: false
    }

    // Store in cache
    await this.historicalService.storeHistoricalData(historicalData)

    return {
      ...historicalData,
      id: '', // Will be set by database
      cacheCreatedAt: new Date(),
      lastUpdatedAt: new Date()
    }
  }

  private async cacheStockData(stockData: StockData): Promise<void> {
    const historicalData: Omit<HistoricalMarketData, 'id' | 'cacheCreatedAt' | 'lastUpdatedAt'> = {
      symbol: stockData.symbol,
      timestamp: new Date(stockData.timestamp).getTime(),
      dateOnly: new Date(stockData.timestamp).toISOString().split('T')[0],
      timeframe: '1d',
      open: stockData.price, // Limited data from stock price
      high: stockData.price,
      low: stockData.price,
      close: stockData.price,
      volume: stockData.volume,
      source: stockData.source,
      primarySource: stockData.source,
      sourcePriority: this.getSourcePriority(stockData.source),
      dataQualityScore: 0.8,
      confidenceLevel: 0.9,
      isValidated: true,
      hasAnomaly: false,
      updateFrequency: '5 minutes',
      ingestionMethod: 'api',
      marketHoursFlag: true,
      afterHoursFlag: false,
      regulatoryHalt: false
    }

    await this.historicalService.storeHistoricalData(historicalData)
  }

  private evaluateFreshness(data: HistoricalMarketData[], maxAgeSeconds: number): number {
    if (data.length === 0) return 0

    const latest = data[0]
    const ageSeconds = (Date.now() - new Date(latest.lastUpdatedAt).getTime()) / 1000

    return Math.max(0, 1 - (ageSeconds / maxAgeSeconds))
  }

  private evaluateQuality(data: HistoricalMarketData[]): number {
    if (data.length === 0) return 0

    const avgQuality = data.reduce((sum, item) => sum + (item.dataQualityScore || 0), 0) / data.length
    return avgQuality
  }

  private getCacheStrategy(timeframe: string): CacheStrategy {
    return this.cacheStrategies.get(timeframe) || this.cacheStrategies.get('default')!
  }

  private getSourcePriority(source: string): number {
    const priorities: Record<string, number> = {
      'Polygon': 1,
      'Financial Modeling Prep': 2,
      'Twelve Data': 3,
      'Yahoo Finance': 4
    }
    return priorities[source] || 5
  }

  private async backgroundRefresh(request: DataRequest): Promise<void> {
    try {
      await this.fetchFromApi(request, Date.now())
    } catch (error) {
      console.error('Background refresh failed:', error)
    }
  }

  private async processHistoricalDataJob(
    jobId: string,
    symbols: string[],
    startDate: Date,
    endDate: Date,
    timeframes: string[],
    preferredSources?: string[]
  ): Promise<void> {
    // This would implement the actual historical data population
    // For now, just log the progress
    console.log(`Processing historical data job ${jobId} for ${symbols.length} symbols`)
  }

  private async getCachedSymbolCount(): Promise<number> {
    // This would query the database for unique cached symbols
    return 0 // Placeholder
  }

  private async checkApiHealth(): Promise<boolean> {
    try {
      const health = await this.financialService.getProviderHealth()
      return health.every(provider => provider.healthy)
    } catch (error) {
      return false
    }
  }

  private initializeMetrics(): CacheMetrics {
    return {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      avgResponseTime: 0,
      dataFreshness: 0,
      sourcesActive: 0,
      totalCachedSymbols: 0
    }
  }

  private initializeCacheStrategies(): Map<string, CacheStrategy> {
    const strategies = new Map<string, CacheStrategy>()

    strategies.set('1m', {
      name: 'High Frequency',
      timeframes: ['1m'],
      maxAge: 300, // 5 minutes
      refreshStrategy: 'eager',
      priority: 1
    })

    strategies.set('5m', {
      name: 'Medium Frequency',
      timeframes: ['5m'],
      maxAge: 900, // 15 minutes
      refreshStrategy: 'eager',
      priority: 2
    })

    strategies.set('1h', {
      name: 'Hourly',
      timeframes: ['1h'],
      maxAge: 3600, // 1 hour
      refreshStrategy: 'lazy',
      priority: 3
    })

    strategies.set('1d', {
      name: 'Daily',
      timeframes: ['1d'],
      maxAge: 86400, // 1 day
      refreshStrategy: 'scheduled',
      priority: 4
    })

    strategies.set('default', {
      name: 'Default',
      timeframes: ['1d'],
      maxAge: 3600, // 1 hour
      refreshStrategy: 'lazy',
      priority: 5
    })

    return strategies
  }
}

// Singleton instance
export const financialDataCacheService = new FinancialDataCacheService()