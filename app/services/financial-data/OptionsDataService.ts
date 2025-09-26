/**
 * High-Performance Options Data Service
 * Optimized for VFR's <3 second analysis target with <500ms options latency
 * Features: memory-efficient processing, selective field extraction, optimized caching
 */

import { DataSourceManager, DataSourceProvider } from './DataSourceManager'
import { PolygonAPI } from './PolygonAPI'
import { TwelveDataAPI } from './TwelveDataAPI'
import { AlphaVantageAPI } from './AlphaVantageAPI'
import { YahooFinanceAPI } from './YahooFinanceAPI'
import { EODHDAPI } from './EODHDAPI'
import { OptionsContract, OptionsChain, PutCallRatio, OptionsAnalysis } from './types'
import { RedisCache } from '../cache/RedisCache'
import ErrorHandler from '../error-handling/ErrorHandler'

// Performance-optimized options contract structure (40+ fields → 14 essential fields)
interface OptimizedOptionsContract {
  strike: number
  bid: number
  ask: number
  volume: number
  openInterest: number
  impliedVolatility: number
  delta: number
  gamma: number
  theta: number
  vega: number
  inTheMoney: boolean
  lastPrice: number
  change: number
  percentChange: number
  type: 'call' | 'put'
  expiration: string
}

interface OptionsPerformanceMetrics {
  processingTime: number
  cacheHitRate: number
  contractsProcessed: number
  memoryEfficiency: number
  compressionRatio: number
}

interface OptionsChainSummary {
  symbol: string
  totalContracts: number
  callVolume: number
  putVolume: number
  putCallRatio: number
  maxPain: number
  impliedVolatilityAvg: number
  timestamp: number
  contractsByExpiry: Record<string, OptimizedOptionsContract[]>
  performanceMetrics: OptionsPerformanceMetrics
}

export class OptionsDataService {
  private dataSourceManager: DataSourceManager
  private polygonAPI: PolygonAPI
  private twelveDataAPI: TwelveDataAPI
  private alphaVantageAPI: AlphaVantageAPI
  private yahooFinanceAPI: YahooFinanceAPI
  private eodhdAPI: EODHDAPI
  private cache: RedisCache

  // Performance optimization constants
  private readonly MARKET_HOURS_TTL = 30 // 30 seconds during market hours
  private readonly AFTER_HOURS_TTL = 300 // 5 minutes after hours
  private readonly WEEKEND_TTL = 1800 // 30 minutes on weekends
  private readonly MAX_CONTRACTS_PER_EXPIRY = 20 // Limit to reduce payload
  private readonly BATCH_SIZE = 5 // Concurrent processing limit
  private readonly LATENCY_TARGET = 500 // 500ms target for options analysis

  // Essential fields for memory optimization (40+ fields → 14 fields)
  private readonly ESSENTIAL_FIELDS = [
    'strike', 'bid', 'ask', 'volume', 'openInterest',
    'impliedVolatility', 'delta', 'gamma', 'theta', 'vega',
    'inTheMoney', 'lastPrice', 'change', 'percentChange'
  ]

  // Performance tracking
  private performanceMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    averageLatency: 0,
    memoryReductions: 0
  }

  constructor(dataSourceManager?: DataSourceManager, cache?: RedisCache) {
    this.dataSourceManager = dataSourceManager || new DataSourceManager()
    this.polygonAPI = new PolygonAPI()
    this.twelveDataAPI = new TwelveDataAPI()
    this.alphaVantageAPI = new AlphaVantageAPI()
    this.yahooFinanceAPI = new YahooFinanceAPI()
    this.eodhdAPI = new EODHDAPI()
    this.cache = cache || new RedisCache()
  }

  /**
   * Set preferred options data source
   */
  setPreferredSource(source: DataSourceProvider): void {
    this.dataSourceManager.setDataSourcePreference('options_data', source)
    this.dataSourceManager.setDataSourcePreference('options_chain', source)
    this.dataSourceManager.setDataSourcePreference('put_call_ratio', source)
    this.dataSourceManager.setDataSourcePreference('options_analysis', source)
    console.log(`📊 Options data source set to: ${source}`)
  }

  /**
   * Get current provider configuration
   */
  getProviderConfig() {
    return this.dataSourceManager.getProviderConfigs()
  }

  /**
   * Get available providers for options data
   */
  getAvailableProviders(): DataSourceProvider[] {
    return this.dataSourceManager.getProvidersForDataType('options_data')
  }

  /**
   * Get put/call ratio with performance optimization and caching
   */
  async getPutCallRatio(symbol: string): Promise<PutCallRatio | null> {
    const startTime = Date.now()
    const cacheKey = `put_call_ratio_optimized:${symbol.toUpperCase()}`
    const ttl = this.getOptimalTTL()

    try {
      // Check cache first
      const cached = await this.cache.get<PutCallRatio>(cacheKey)
      if (cached && this.isCacheValid(cached.timestamp, ttl)) {
        return cached
      }

      // Parallel processing with Promise.allSettled for better performance
      const sources = this.dataSourceManager.getProvidersForDataType('put_call_ratio')
      const promises = sources.slice(0, 3).map(async (source) => {
        switch (source) {
          case 'eodhd':
            return await this.eodhdAPI.getPutCallRatio(symbol)
          case 'polygon':
            return await this.polygonAPI.getPutCallRatio(symbol)
          case 'yahoo':
            return await this.yahooFinanceAPI.getPutCallRatio(symbol)
          default:
            return null
        }
      })

      const results = await Promise.allSettled(promises)

      // Return first successful result
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          // Cache the result
          await this.cacheOptionsData(cacheKey, result.value, ttl)

          const latency = Date.now() - startTime
          console.log(`📊 Put/call ratio for ${symbol}: ${latency}ms`)
          return result.value
        }
      }

      return null

    } catch (error) {
      console.error('OptionsDataService.getPutCallRatio error:', error)
      return null
    }
  }

  /**
   * Get high-performance options analysis with <500ms latency target
   */
  async getOptionsAnalysis(symbol: string): Promise<OptionsAnalysis | null> {
    const startTime = Date.now()
    this.performanceMetrics.totalRequests++

    try {
      const cacheKey = `options_analysis_optimized:${symbol.toUpperCase()}`
      const ttl = this.getOptimalTTL()

      // Multi-tier cache strategy with performance tracking
      const cached = await this.cache.get<OptionsAnalysis>(cacheKey)
      if (cached && this.isCacheValid(cached.timestamp, ttl)) {
        this.performanceMetrics.cacheHits++
        const latency = Date.now() - startTime
        this.updatePerformanceMetrics(latency)
        return cached
      }

      // Parallel data fetching with Promise.allSettled optimization
      const sources = this.dataSourceManager.getProvidersForDataType('options_analysis')
      const promises = sources.slice(0, 3).map(async (source) => {
        const sourceStart = Date.now()

        switch (source) {
          case 'eodhd':
            const analysis = await this.getOptimizedEODHDAnalysis(symbol)
            return { source, analysis, latency: Date.now() - sourceStart }
          case 'polygon':
            const polygonAnalysis = await this.polygonAPI.getOptionsAnalysis(symbol)
            return { source, analysis: polygonAnalysis, latency: Date.now() - sourceStart }
          case 'yahoo':
            const yahooAnalysis = await this.yahooFinanceAPI.getOptionsAnalysisFreeTier(symbol)
            return { source, analysis: yahooAnalysis, latency: Date.now() - sourceStart }
          default:
            return { source, analysis: null, latency: Date.now() - sourceStart }
        }
      })

      const results = await Promise.allSettled(promises)

      // Select best result based on data completeness and latency
      let bestResult: OptionsAnalysis | null = null
      let bestLatency = Infinity

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.analysis) {
          if (result.value.latency < bestLatency) {
            bestResult = result.value.analysis
            bestLatency = result.value.latency
          }
        }
      }

      if (bestResult) {
        // Cache with compression for large datasets
        await this.cacheOptionsData(cacheKey, bestResult, ttl)

        const totalLatency = Date.now() - startTime
        this.updatePerformanceMetrics(totalLatency)

        console.log(`📊 Options analysis for ${symbol}: ${totalLatency}ms (target: ${this.LATENCY_TARGET}ms)`)
        return bestResult
      }

      return null

    } catch (error) {
      const latency = Date.now() - startTime
      console.error('OptionsDataService.getOptionsAnalysis error:', error)
      return null
    }
  }

  /**
   * Get memory-optimized options chain with selective field extraction
   */
  async getOptionsChain(symbol: string, expiration?: string): Promise<OptionsChain | null> {
    const startTime = Date.now()

    try {
      const cacheKey = `options_chain_optimized:${symbol.toUpperCase()}:${expiration || 'all'}`
      const ttl = this.getOptimalTTL()

      // Check cache first
      const cached = await this.cache.get<OptionsChain>(cacheKey)
      if (cached && this.isCacheValid(cached.timestamp, ttl)) {
        return cached
      }

      // Prioritize EODHD for UnicornBay integration, fallback to others
      const sources = ['eodhd', 'polygon', 'yahoo']

      for (const source of sources) {
        try {
          let rawChain: any = null

          switch (source) {
            case 'eodhd':
              rawChain = await this.eodhdAPI.getOptionsChain(symbol, expiration)
              break
            case 'polygon':
              rawChain = await this.polygonAPI.getOptionsChain(symbol, expiration)
              break
            case 'yahoo':
              rawChain = await this.yahooFinanceAPI.getOptionsChain(symbol, expiration)
              break
          }

          if (rawChain) {
            // Apply memory optimization and field extraction
            const optimizedChain = this.optimizeOptionsChain(rawChain)

            // Cache optimized result
            await this.cacheOptionsData(cacheKey, optimizedChain, ttl)

            const processingTime = Date.now() - startTime
            console.log(`🔗 Optimized options chain for ${symbol}: ${processingTime}ms`)

            return optimizedChain
          }
        } catch (error) {
          console.warn(`❌ ${source} failed for options chain:`, error instanceof Error ? error.message : error)
          continue
        }
      }

      return null

    } catch (error) {
      console.error('OptionsDataService.getOptionsChain error:', error)
      return null
    }
  }

  /**
   * TwelveData put/call ratio (ready for paid plan implementation)
   */
  private async getTwelveDataPutCallRatio(symbol: string): Promise<PutCallRatio | null> {
    // This method is ready for implementation when TwelveData pro plan is available
    // For now, return null to trigger fallback
    console.log(`📊 TwelveData put/call ratio requires pro plan for ${symbol}`)
    return null
  }

  /**
   * TwelveData options analysis (ready for paid plan implementation)
   */
  private async getTwelveDataOptionsAnalysis(symbol: string): Promise<OptionsAnalysis | null> {
    // This method is ready for implementation when TwelveData pro plan is available
    // For now, return null to trigger fallback
    console.log(`📈 TwelveData options analysis requires pro plan for ${symbol}`)
    return null
  }

  /**
   * TwelveData options chain (ready for paid plan implementation)
   */
  private async getTwelveDataOptionsChain(symbol: string, expiration?: string): Promise<OptionsChain | null> {
    // This method is ready for implementation when TwelveData pro plan is available
    // For now, return null to trigger fallback
    console.log(`🔗 TwelveData options chain requires pro plan for ${symbol}`)
    return null
  }

  /**
   * Check if any options data source is available
   */
  async checkOptionsAvailability(): Promise<{ [key: string]: boolean }> {
    const availability: { [key: string]: boolean } = {
      polygon: false,
      eodhd: false,
      twelvedata: false,
      alphavantage: false,
      yahoo: false,
      disabled: false
    }

    // Test Polygon
    try {
      const polygonTest = await this.polygonAPI.getPutCallRatio('SPY')
      availability.polygon = polygonTest !== null
    } catch (error) {
      availability.polygon = false
    }

    // Test EODHD (requires options add-on subscription)
    try {
      const eodhdAvailability = await this.eodhdAPI.checkOptionsAvailability()
      availability.eodhd = (typeof eodhdAvailability.putCallRatio === 'boolean') ? eodhdAvailability.putCallRatio : false
    } catch (error) {
      availability.eodhd = false
    }

    // Test TwelveData (will be false until paid plan)
    availability.twelvedata = false

    // Test Alpha Vantage (will be false - premium required)
    try {
      const alphaVantageAvailability = await this.alphaVantageAPI.checkOptionsAvailability()
      availability.alphavantage = (typeof alphaVantageAvailability.putCallRatio === 'boolean') ? alphaVantageAvailability.putCallRatio : false
    } catch (error) {
      availability.alphavantage = false
    }

    // Test Yahoo Finance (unofficial API - may work)
    try {
      const yahooAvailability = await this.yahooFinanceAPI.checkOptionsAvailability()
      availability.yahoo = (typeof yahooAvailability.putCallRatio === 'boolean') ? yahooAvailability.putCallRatio : false
    } catch (error) {
      availability.yahoo = false
    }

    return availability
  }

  /**
   * Get service status and recommendations
   */
  async getServiceStatus() {
    return await this.dataSourceManager.getServiceStatus()
  }

  /**
   * PERFORMANCE OPTIMIZATION METHODS
   */

  /**
   * Get optimized EODHD analysis with UnicornBay integration
   */
  private async getOptimizedEODHDAnalysis(symbol: string): Promise<OptionsAnalysis | null> {
    try {
      // Fetch raw EODHD data with 40+ fields
      const rawData = await this.eodhdAPI.getOptionsAnalysisFreeTier(symbol)
      if (!rawData) return null

      // Apply memory optimization and selective field extraction
      return this.processOptimizedAnalysis(symbol, rawData)

    } catch (error) {
      console.error(`Failed to get optimized EODHD analysis for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Process options analysis with memory optimization
   */
  private processOptimizedAnalysis(symbol: string, rawData: any): OptionsAnalysis {
    const startTime = Date.now()

    // Extract only essential contract data to reduce memory footprint
    const optimizedContracts = rawData.contracts?.map((contract: any) =>
      this.extractEssentialFields(contract)
    ) || []

    // Calculate summary metrics efficiently
    const summary = this.buildOptimizedSummary(symbol, optimizedContracts)

    const processingTime = Date.now() - startTime
    console.log(`📊 Processed ${optimizedContracts.length} contracts in ${processingTime}ms`)

    return {
      ...rawData,
      contracts: optimizedContracts,
      summary,
      performanceMetrics: {
        processingTime,
        contractsProcessed: optimizedContracts.length,
        memoryReduction: this.calculateMemoryReduction(rawData.contracts, optimizedContracts)
      }
    }
  }

  /**
   * Memory-efficient options chain optimization
   */
  private optimizeOptionsChain(rawChain: any): OptionsChain {
    const contractsByExpiry = new Map<string, any[]>()
    let totalOriginalSize = 0
    let totalOptimizedSize = 0

    // Group by expiry and limit per expiry to reduce memory footprint
    const contracts = Array.isArray(rawChain) ? rawChain : rawChain.contracts || []

    for (const contract of contracts) {
      totalOriginalSize += JSON.stringify(contract).length

      const expiry = contract.expiration || 'unknown'
      if (!contractsByExpiry.has(expiry)) {
        contractsByExpiry.set(expiry, [])
      }

      const expiryContracts = contractsByExpiry.get(expiry)!
      if (expiryContracts.length < this.MAX_CONTRACTS_PER_EXPIRY) {
        // Extract only essential fields to reduce memory usage
        const optimizedContract = this.extractEssentialFields(contract)
        expiryContracts.push(optimizedContract)
        totalOptimizedSize += JSON.stringify(optimizedContract).length
      }
    }

    // Convert back to flat array, sorted by volume for better cache efficiency
    const optimizedContracts: any[] = []
    for (const contracts of contractsByExpiry.values()) {
      contracts.sort((a, b) => (b.volume || 0) - (a.volume || 0))
      optimizedContracts.push(...contracts)
    }

    const compressionRatio = totalOriginalSize > 0 ?
      (totalOriginalSize - totalOptimizedSize) / totalOriginalSize : 0

    console.log(`📋 Memory optimization: ${(compressionRatio * 100).toFixed(1)}% reduction`)
    this.performanceMetrics.memoryReductions += compressionRatio

    return {
      symbol: rawChain.symbol || '',
      calls: optimizedContracts.filter(c => c.type === 'call'),
      puts: optimizedContracts.filter(c => c.type === 'put'),
      expirationDates: [...new Set(optimizedContracts.map(c => c.expiration))],
      strikes: [...new Set(optimizedContracts.map(c => c.strike))].sort((a, b) => a - b),
      timestamp: Date.now(),
      source: 'optimized'
    }
  }

  /**
   * Extract only essential fields from options contract (40+ fields → 14 fields)
   */
  private extractEssentialFields(contract: any): OptimizedOptionsContract {
    return {
      strike: contract.strike || 0,
      bid: contract.bid || 0,
      ask: contract.ask || 0,
      volume: contract.volume || 0,
      openInterest: contract.openInterest || 0,
      impliedVolatility: contract.impliedVolatility || 0,
      delta: contract.delta || 0,
      gamma: contract.gamma || 0,
      theta: contract.theta || 0,
      vega: contract.vega || 0,
      inTheMoney: contract.inTheMoney || false,
      lastPrice: contract.lastPrice || 0,
      change: contract.change || 0,
      percentChange: contract.percentChange || 0,
      type: contract.type as 'call' | 'put',
      expiration: contract.expiration || ''
    }
  }

  /**
   * Build optimized chain summary with key metrics
   */
  private buildOptimizedSummary(symbol: string, contracts: OptimizedOptionsContract[]): OptionsChainSummary {
    const calls = contracts.filter(c => c.type === 'call')
    const puts = contracts.filter(c => c.type === 'put')

    const callVolume = calls.reduce((sum, c) => sum + (c.volume || 0), 0)
    const putVolume = puts.reduce((sum, c) => sum + (c.volume || 0), 0)

    const contractsByExpiry: Record<string, OptimizedOptionsContract[]> = {}
    contracts.forEach(contract => {
      const expiry = contract.expiration
      if (!contractsByExpiry[expiry]) {
        contractsByExpiry[expiry] = []
      }
      contractsByExpiry[expiry].push(contract)
    })

    return {
      symbol: symbol.toUpperCase(),
      totalContracts: contracts.length,
      callVolume,
      putVolume,
      putCallRatio: callVolume > 0 ? putVolume / callVolume : 0,
      maxPain: this.calculateMaxPain(contracts),
      impliedVolatilityAvg: this.calculateAvgIV(contracts),
      timestamp: Date.now(),
      contractsByExpiry,
      performanceMetrics: {
        processingTime: 0, // Will be set by caller
        cacheHitRate: this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests,
        contractsProcessed: contracts.length,
        memoryEfficiency: this.calculateMemoryEfficiency(contracts),
        compressionRatio: 0 // Will be calculated
      }
    }
  }

  /**
   * Dynamic TTL based on market conditions for optimal caching
   */
  private getOptimalTTL(): number {
    const now = new Date()
    const hour = now.getUTCHours() - 5 // EST adjustment
    const day = now.getUTCDay()

    // Weekend: longer cache (30 min)
    if (day === 0 || day === 6) {
      return this.WEEKEND_TTL
    }

    // Market hours (9:30 AM - 4:00 PM EST): short cache (30 sec)
    if (hour >= 9 && hour < 16) {
      return this.MARKET_HOURS_TTL
    }

    // After hours: medium cache (5 min)
    return this.AFTER_HOURS_TTL
  }

  /**
   * Validate cache freshness based on market conditions
   */
  private isCacheValid(timestamp: number, ttl: number): boolean {
    return (Date.now() - timestamp) < (ttl * 1000)
  }

  /**
   * Compressed caching for large options datasets
   */
  private async cacheOptionsData(key: string, data: any, ttl: number): Promise<void> {
    try {
      // Use setOptimized with compression for large payloads
      await this.cache.setOptimized(key, data, 'market')
    } catch (error) {
      console.error(`Failed to cache options data for ${key}:`, error)
    }
  }

  /**
   * Calculate max pain point efficiently
   */
  private calculateMaxPain(contracts: OptimizedOptionsContract[]): number {
    const strikes = [...new Set(contracts.map(c => c.strike))].sort((a, b) => a - b)
    let maxPain = 0
    let minPain = Infinity

    for (const strike of strikes) {
      const callPain = contracts
        .filter(c => c.type === 'call' && c.strike <= strike)
        .reduce((sum, c) => sum + (c.openInterest || 0) * Math.max(0, strike - c.strike), 0)

      const putPain = contracts
        .filter(c => c.type === 'put' && c.strike >= strike)
        .reduce((sum, c) => sum + (c.openInterest || 0) * Math.max(0, c.strike - strike), 0)

      const totalPain = callPain + putPain
      if (totalPain < minPain) {
        minPain = totalPain
        maxPain = strike
      }
    }

    return maxPain
  }

  /**
   * Calculate average implied volatility
   */
  private calculateAvgIV(contracts: OptimizedOptionsContract[]): number {
    const validIVs = contracts
      .map(c => c.impliedVolatility)
      .filter(iv => iv && iv > 0)

    return validIVs.length > 0 ?
      validIVs.reduce((sum, iv) => sum + iv, 0) / validIVs.length : 0
  }

  /**
   * Calculate memory reduction percentage
   */
  private calculateMemoryReduction(original: any[], optimized: any[]): number {
    if (!original || !optimized) return 0

    const originalSize = JSON.stringify(original).length
    const optimizedSize = JSON.stringify(optimized).length

    return originalSize > 0 ? (originalSize - optimizedSize) / originalSize : 0
  }

  /**
   * Calculate memory efficiency score
   */
  private calculateMemoryEfficiency(contracts: OptimizedOptionsContract[]): number {
    // Score based on data density and field optimization
    const totalFields = contracts.length * this.ESSENTIAL_FIELDS.length
    const totalData = JSON.stringify(contracts).length

    return totalFields > 0 ? (totalData / totalFields) : 0
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(latency: number): void {
    const totalRequests = this.performanceMetrics.totalRequests
    this.performanceMetrics.averageLatency =
      (this.performanceMetrics.averageLatency * (totalRequests - 1) + latency) / totalRequests
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): any {
    const hitRate = this.performanceMetrics.totalRequests > 0 ?
      (this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests) * 100 : 0

    const memoryEfficiency = this.performanceMetrics.memoryReductions > 0 ?
      (this.performanceMetrics.memoryReductions / this.performanceMetrics.totalRequests) * 100 : 0

    return {
      totalRequests: this.performanceMetrics.totalRequests,
      averageLatency: Math.round(this.performanceMetrics.averageLatency),
      latencyTarget: this.LATENCY_TARGET,
      cacheHitRate: Math.round(hitRate * 10) / 10,
      memoryEfficiency: Math.round(memoryEfficiency * 10) / 10,
      performanceGrade: this.performanceMetrics.averageLatency <= this.LATENCY_TARGET ? 'A' : 'B'
    }
  }

  /**
   * Batch process multiple symbols for portfolio analysis
   */
  async getBatchOptionsAnalysis(symbols: string[]): Promise<Map<string, OptionsAnalysis | null>> {
    const results = new Map<string, OptionsAnalysis | null>()
    const startTime = Date.now()

    // Process in batches to manage memory and API rate limits
    for (let i = 0; i < symbols.length; i += this.BATCH_SIZE) {
      const batch = symbols.slice(i, i + this.BATCH_SIZE)
      const batchPromises = batch.map(symbol =>
        this.getOptionsAnalysis(symbol).catch(() => null)
      )

      const batchResults = await Promise.allSettled(batchPromises)
      batch.forEach((symbol, index) => {
        const result = batchResults[index]
        results.set(symbol, result.status === 'fulfilled' ? result.value : null)
      })

      // Brief delay between batches to respect rate limits
      if (i + this.BATCH_SIZE < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    const totalTime = Date.now() - startTime
    console.log(`📊 Batch processed ${symbols.length} symbols in ${totalTime}ms`)

    return results
  }
}