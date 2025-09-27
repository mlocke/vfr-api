/**
 * High-Performance Options Data Service
 * Optimized for VFR's <3 second analysis target with <500ms options latency
 * Features: memory-efficient processing, selective field extraction, optimized caching
 */

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
  timeBasedAnalysis?: TimeBasedOptionsAnalysis
}

interface TimeBasedOptionsAnalysis {
  shortTerm: {
    daysToExpiry: number
    sentiment: 'bullish' | 'bearish' | 'neutral'
    volumeRatio: number
    impliedVolatility: number
    confidence: number
    description: string
  }
  mediumTerm: {
    daysToExpiry: number
    sentiment: 'bullish' | 'bearish' | 'neutral'
    volumeRatio: number
    impliedVolatility: number
    confidence: number
    institutionalSignals: string[]
    description: string
  }
  longTerm: {
    daysToExpiry: number
    sentiment: 'bullish' | 'bearish' | 'neutral'
    volumeRatio: number
    impliedVolatility: number
    confidence: number
    leapsAnalysis: string
    description: string
  }
  strikePositioning: {
    heavyCallActivity: number[]
    heavyPutActivity: number[]
    institutionalHedges: number[]
    unusualActivity: string[]
  }
}

export class OptionsDataService {
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

  constructor(cache?: RedisCache) {
    this.eodhdAPI = new EODHDAPI()
    this.cache = cache || new RedisCache()
  }

  /**
   * EODHD is the only provider for options data
   */
  getProviderInfo() {
    return {
      provider: 'EODHD',
      description: 'Exclusive options data provider with UnicornBay integration'
    }
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

      // EODHD ONLY - No fallback mechanisms for options data
      const result = await this.eodhdAPI.getPutCallRatio(symbol)

      if (result) {
        // Cache the result
        await this.cacheOptionsData(cacheKey, result, ttl)
        const latency = Date.now() - startTime
        console.log(`📊 EODHD Put/call ratio for ${symbol}: ${latency}ms`)
        return result
      }

      console.log(`⚠️ EODHD: No put/call ratio data available for ${symbol}`)
      return null

    } catch (error) {
      console.error('OptionsDataService.getPutCallRatio error:', error)
      return null
    }
  }

  /**
   * Get enhanced options analysis with time-based sentiment detection
   * Includes short-term (1-30 days), medium-term (1-3 months), and long-term (6+ months) analysis
   */
  async getOptionsAnalysis(symbol: string, includeTimeBasedAnalysis: boolean = true): Promise<OptionsAnalysis | null> {
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

      // EODHD ONLY - NO FALLBACKS for options analysis
      let analysis = await this.getOptimizedEODHDAnalysis(symbol)

      if (analysis && includeTimeBasedAnalysis) {
        // Get options chain for time-based analysis
        const optionsChain = await this.getOptionsChain(symbol)
        if (optionsChain) {
          const timeBasedAnalysis = this.generateTimeBasedAnalysis(optionsChain)
          analysis.timeBasedAnalysis = timeBasedAnalysis
        }
      }

      if (analysis) {
        // Cache with compression for large datasets
        await this.cacheOptionsData(cacheKey, analysis, ttl)

        const totalLatency = Date.now() - startTime
        this.updatePerformanceMetrics(totalLatency)

        console.log(`📊 EODHD Enhanced options analysis for ${symbol}: ${totalLatency}ms (target: ${this.LATENCY_TARGET}ms)`)
        return analysis
      }

      console.log(`⚠️ EODHD: No options analysis data available for ${symbol}`)
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

      // MULTI-SOURCE FALLBACK - Try EODHD first, then Yahoo Finance, then Polygon
      let rawChain = await this.eodhdAPI.getOptionsChain(symbol, expiration)

      // If EODHD fails, try Yahoo Finance fallback
      if (!rawChain) {
        console.log(`⚡ EODHD options chain failed for ${symbol}, trying Yahoo Finance fallback...`)
        try {
          const { YahooFinanceAPI } = await import('./YahooFinanceAPI')
          const yahooAPI = new YahooFinanceAPI()
          rawChain = await yahooAPI.getOptionsChain(symbol, expiration)
          if (rawChain) {
            console.log(`✅ Yahoo Finance options chain successful for ${symbol}`)
          }
        } catch (yahooError) {
          console.warn(`Yahoo Finance options chain failed for ${symbol}:`, yahooError instanceof Error ? yahooError.message : 'Unknown error')
        }
      }

      // If Yahoo Finance also fails, try Polygon as final fallback
      if (!rawChain) {
        console.log(`⚡ Yahoo Finance options chain failed for ${symbol}, trying Polygon fallback...`)
        try {
          const { PolygonAPI } = await import('./PolygonAPI')
          const polygonAPI = new PolygonAPI()
          rawChain = await polygonAPI.getOptionsChain(symbol, expiration)
          if (rawChain) {
            console.log(`✅ Polygon options chain successful for ${symbol}`)
          }
        } catch (polygonError) {
          console.warn(`Polygon options chain failed for ${symbol}:`, polygonError instanceof Error ? polygonError.message : 'Unknown error')
        }
      }

      if (rawChain) {
        // Apply memory optimization and field extraction
        const optimizedChain = this.optimizeOptionsChain(rawChain)

        // Cache optimized result
        await this.cacheOptionsData(cacheKey, optimizedChain, ttl)

        const processingTime = Date.now() - startTime
        console.log(`🔗 EODHD Optimized options chain for ${symbol}: ${processingTime}ms`)

        return optimizedChain
      }

      console.log(`⚠️ EODHD: No options chain data available for ${symbol}`)
      return null

    } catch (error) {
      console.error('OptionsDataService.getOptionsChain error:', error)
      return null
    }
  }


  /**
   * Check if any options data source is available
   */
  async checkOptionsAvailability(): Promise<{ [key: string]: boolean }> {
    const availability: { [key: string]: boolean } = {
      eodhd: false
    }

    // Test EODHD ONLY (requires options add-on subscription)
    try {
      const eodhdAvailability = await this.eodhdAPI.checkOptionsAvailability()
      availability.eodhd = (typeof eodhdAvailability.putCallRatio === 'boolean') ? eodhdAvailability.putCallRatio : false
      console.log(`📊 EODHD Options availability: ${availability.eodhd}`)
    } catch (error) {
      availability.eodhd = false
      console.log(`❌ EODHD Options check failed:`, error)
    }

    return availability
  }

  /**
   * Get EODHD service status
   */
  async getServiceStatus() {
    const availability = await this.checkOptionsAvailability()
    return {
      provider: 'EODHD',
      available: availability.eodhd,
      status: availability.eodhd ? 'active' : 'unavailable',
      description: 'Exclusive options data provider with UnicornBay integration'
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION METHODS
   */

  /**
   * Get optimized EODHD analysis with UnicornBay integration
   */
  private async getOptimizedEODHDAnalysis(symbol: string): Promise<OptionsAnalysis | null> {
    try {
      console.log(`🦄 EODHD: Fetching UnicornBay options analysis for ${symbol}`)

      // First try UnicornBay enhanced options chain
      const optionsChain = await this.eodhdAPI.getUnicornBayOptionsChain(symbol)
      if (optionsChain && optionsChain.calls.length > 0 && optionsChain.puts.length > 0) {
        console.log(`✅ EODHD UnicornBay: Retrieved ${optionsChain.calls.length} calls, ${optionsChain.puts.length} puts for ${symbol}`)

        // Get enhanced put/call ratio from UnicornBay
        const putCallRatio = await this.eodhdAPI.getUnicornBayPutCallRatio(symbol)

        // Process UnicornBay data into OptionsAnalysis format
        return this.processUnicornBayAnalysis(symbol, optionsChain, putCallRatio)
      }

      // Fallback to standard EODHD if UnicornBay not available
      console.log(`⚠️ EODHD: UnicornBay data unavailable for ${symbol}, falling back to standard API`)
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
   * Process UnicornBay enhanced options data into OptionsAnalysis format
   */
  private processUnicornBayAnalysis(symbol: string, optionsChain: OptionsChain, putCallRatio: PutCallRatio | null): OptionsAnalysis {
    const startTime = Date.now()

    try {
      // Calculate comprehensive metrics from UnicornBay data
      const { calls, puts } = optionsChain

      // Calculate volume metrics
      const totalCallVolume = calls.reduce((sum, contract) => sum + (contract.volume || 0), 0)
      const totalPutVolume = puts.reduce((sum, contract) => sum + (contract.volume || 0), 0)
      const totalCallOpenInterest = calls.reduce((sum, contract) => sum + (contract.openInterest || 0), 0)
      const totalPutOpenInterest = puts.reduce((sum, contract) => sum + (contract.openInterest || 0), 0)

      // Calculate volume ratio (put/call)
      const volumeRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 1

      // Calculate average implied volatility
      const callIVs = calls.filter(c => c.impliedVolatility && c.impliedVolatility > 0).map(c => c.impliedVolatility!)
      const putIVs = puts.filter(p => p.impliedVolatility && p.impliedVolatility > 0).map(p => p.impliedVolatility!)
      const avgCallIV = callIVs.length > 0 ? callIVs.reduce((sum, iv) => sum + iv, 0) / callIVs.length : 0
      const avgPutIV = putIVs.length > 0 ? putIVs.reduce((sum, iv) => sum + iv, 0) / putIVs.length : 0

      // Determine sentiment based on P/C ratio and volume
      let sentiment: 'fear' | 'greed' | 'neutral' = 'neutral'
      if (volumeRatio > 1.2) {
        sentiment = 'fear' // High put volume suggests fear
      } else if (volumeRatio < 0.8) {
        sentiment = 'greed' // High call volume suggests greed
      }

      // Calculate confidence based on data quality
      const dataQuality = Math.min(
        (totalCallVolume + totalPutVolume) / 10000, // Volume factor
        (calls.length + puts.length) / 100, // Chain depth factor
        1
      )
      const confidence = Math.max(0.5, dataQuality)

      const analysis: OptionsAnalysis = {
        symbol: symbol.toUpperCase(),
        currentRatio: {
          symbol: symbol.toUpperCase(),
          volumeRatio,
          openInterestRatio: totalCallOpenInterest > 0 ? totalPutOpenInterest / totalCallOpenInterest : 1,
          totalCallVolume,
          totalPutVolume,
          totalCallOpenInterest,
          totalPutOpenInterest,
          date: new Date().toISOString().split('T')[0],
          timestamp: Date.now(),
          source: 'eodhd-unicornbay'
        },
        historicalRatios: [],
        trend: volumeRatio > 1.2 ? 'bearish' : volumeRatio < 0.8 ? 'bullish' : 'neutral',
        sentiment: sentiment === 'neutral' ? 'balanced' : sentiment,
        confidence,
        analysis: `P/C Ratio: ${volumeRatio.toFixed(2)}, Avg Call IV: ${avgCallIV.toFixed(2)}%, Avg Put IV: ${avgPutIV.toFixed(2)}%, Max Pain: $${this.calculateMaxPain(optionsChain) || 'N/A'}`,
        timestamp: Date.now(),
        source: 'eodhd-unicornbay'
      }

      console.log(`🦄 UnicornBay analysis processed for ${symbol}: P/C ${volumeRatio.toFixed(2)}, Sentiment: ${sentiment}, Confidence: ${confidence.toFixed(2)}`)
      return analysis

    } catch (error) {
      console.error(`Error processing UnicornBay analysis for ${symbol}:`, error)
      // Return basic analysis with available data
      return {
        symbol: symbol.toUpperCase(),
        currentRatio: putCallRatio || {
          symbol: symbol.toUpperCase(),
          volumeRatio: 1,
          openInterestRatio: 1,
          totalCallVolume: 0,
          totalPutVolume: 0,
          totalCallOpenInterest: 0,
          totalPutOpenInterest: 0,
          date: new Date().toISOString().split('T')[0],
          timestamp: Date.now(),
          source: 'eodhd-unicornbay-fallback'
        },
        historicalRatios: [],
        trend: 'neutral',
        sentiment: 'balanced',
        confidence: 0.3,
        analysis: 'Limited options data available - using fallback analysis',
        timestamp: Date.now(),
        source: 'eodhd-unicornbay-fallback'
      }
    }
  }

  /**
   * Calculate max pain point from options chain
   */
  private calculateMaxPain(optionsChain: OptionsChain): number | null {
    try {
      const { calls, puts } = optionsChain
      if (calls.length === 0 && puts.length === 0) return null

      // Get all unique strikes
      const strikes = new Set<number>()
      calls.forEach(c => strikes.add(c.strike))
      puts.forEach(p => strikes.add(p.strike))

      let minPain = Infinity
      let maxPainStrike = 0

      // Calculate pain for each strike
      for (const strike of strikes) {
        let totalPain = 0

        // Calculate call pain (calls expire worthless below strike)
        calls.forEach(call => {
          if (call.strike > strike) {
            totalPain += (call.openInterest || 0) * (call.strike - strike)
          }
        })

        // Calculate put pain (puts expire worthless above strike)
        puts.forEach(put => {
          if (put.strike < strike) {
            totalPain += (put.openInterest || 0) * (strike - put.strike)
          }
        })

        if (totalPain < minPain) {
          minPain = totalPain
          maxPainStrike = strike
        }
      }

      return maxPainStrike
    } catch (error) {
      console.warn('Error calculating max pain:', error)
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
      maxPain: this.calculateMaxPainFromContracts(contracts),
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
   * Calculate max pain point efficiently from optimized contracts
   */
  private calculateMaxPainFromContracts(contracts: OptimizedOptionsContract[]): number {
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
   * Generate comprehensive time-based options analysis
   * Leverages expiration timing to detect institutional sentiment and positioning
   */
  private generateTimeBasedAnalysis(optionsChain: OptionsChain): TimeBasedOptionsAnalysis {
    const now = new Date()
    const contractsByTimeframe = this.categorizeContractsByTimeframe(optionsChain, now)

    return {
      shortTerm: this.analyzeShortTermOptions(contractsByTimeframe.shortTerm),
      mediumTerm: this.analyzeMediumTermOptions(contractsByTimeframe.mediumTerm),
      longTerm: this.analyzeLongTermOptions(contractsByTimeframe.longTerm),
      strikePositioning: this.analyzeStrikePositioning(optionsChain)
    }
  }

  /**
   * Categorize options contracts by time to expiration
   */
  private categorizeContractsByTimeframe(optionsChain: OptionsChain, now: Date) {
    const shortTerm: any[] = []
    const mediumTerm: any[] = []
    const longTerm: any[] = []

    const allContracts = [...optionsChain.calls, ...optionsChain.puts]

    allContracts.forEach(contract => {
      const expiryDate = new Date(contract.expiration)
      const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      if (daysToExpiry <= 30) {
        shortTerm.push({...contract, daysToExpiry})
      } else if (daysToExpiry <= 90) {
        mediumTerm.push({...contract, daysToExpiry})
      } else {
        longTerm.push({...contract, daysToExpiry})
      }
    })

    return { shortTerm, mediumTerm, longTerm }
  }

  /**
   * Analyze short-term options (1-30 days) for immediate sentiment and volatility
   */
  private analyzeShortTermOptions(contracts: any[]) {
    if (contracts.length === 0) {
      return {
        daysToExpiry: 0,
        sentiment: 'neutral' as const,
        volumeRatio: 1,
        impliedVolatility: 0,
        confidence: 0,
        description: 'No short-term options data available'
      }
    }

    const calls = contracts.filter(c => c.type === 'call')
    const puts = contracts.filter(c => c.type === 'put')

    const callVolume = calls.reduce((sum, c) => sum + (c.volume || 0), 0)
    const putVolume = puts.reduce((sum, c) => sum + (c.volume || 0), 0)
    const volumeRatio = callVolume > 0 ? putVolume / callVolume : 1

    const avgIV = this.calculateAvgIV(contracts)
    const avgDaysToExpiry = contracts.reduce((sum, c) => sum + c.daysToExpiry, 0) / contracts.length

    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral'
    if (volumeRatio > 1.2) sentiment = 'bearish'
    else if (volumeRatio < 0.8) sentiment = 'bullish'

    const confidence = Math.min((callVolume + putVolume) / 1000, 1)

    return {
      daysToExpiry: Math.round(avgDaysToExpiry),
      sentiment,
      volumeRatio,
      impliedVolatility: avgIV,
      confidence,
      description: `Short-term ${sentiment} sentiment with ${avgIV.toFixed(1)}% IV, P/C ratio: ${volumeRatio.toFixed(2)}`
    }
  }

  /**
   * Analyze medium-term options (1-3 months) for sustained sentiment and institutional positioning
   */
  private analyzeMediumTermOptions(contracts: any[]) {
    if (contracts.length === 0) {
      return {
        daysToExpiry: 0,
        sentiment: 'neutral' as const,
        volumeRatio: 1,
        impliedVolatility: 0,
        confidence: 0,
        institutionalSignals: [],
        description: 'No medium-term options data available'
      }
    }

    const calls = contracts.filter(c => c.type === 'call')
    const puts = contracts.filter(c => c.type === 'put')

    const callVolume = calls.reduce((sum, c) => sum + (c.volume || 0), 0)
    const putVolume = puts.reduce((sum, c) => sum + (c.volume || 0), 0)
    const volumeRatio = callVolume > 0 ? putVolume / callVolume : 1

    const avgIV = this.calculateAvgIV(contracts)
    const avgDaysToExpiry = contracts.reduce((sum, c) => sum + c.daysToExpiry, 0) / contracts.length

    // Detect institutional signals
    const institutionalSignals = this.detectInstitutionalSignals(contracts)

    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral'
    if (volumeRatio > 1.1) sentiment = 'bearish'
    else if (volumeRatio < 0.9) sentiment = 'bullish'

    const confidence = Math.min((callVolume + putVolume) / 5000, 1)

    return {
      daysToExpiry: Math.round(avgDaysToExpiry),
      sentiment,
      volumeRatio,
      impliedVolatility: avgIV,
      confidence,
      institutionalSignals,
      description: `Medium-term ${sentiment} outlook with institutional ${institutionalSignals.length} signals detected`
    }
  }

  /**
   * Analyze long-term options (6+ months) including LEAPS for strategic positioning
   */
  private analyzeLongTermOptions(contracts: any[]) {
    if (contracts.length === 0) {
      return {
        daysToExpiry: 0,
        sentiment: 'neutral' as const,
        volumeRatio: 1,
        impliedVolatility: 0,
        confidence: 0,
        leapsAnalysis: 'No LEAPS data available',
        description: 'No long-term options data available'
      }
    }

    const calls = contracts.filter(c => c.type === 'call')
    const puts = contracts.filter(c => c.type === 'put')

    const callVolume = calls.reduce((sum, c) => sum + (c.volume || 0), 0)
    const putVolume = puts.reduce((sum, c) => sum + (c.volume || 0), 0)
    const volumeRatio = callVolume > 0 ? putVolume / callVolume : 1

    const avgIV = this.calculateAvgIV(contracts)
    const avgDaysToExpiry = contracts.reduce((sum, c) => sum + c.daysToExpiry, 0) / contracts.length

    // LEAPS analysis (options with 1+ year to expiration)
    const leaps = contracts.filter(c => c.daysToExpiry >= 365)
    const leapsAnalysis = this.generateLeapsAnalysis(leaps)

    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral'
    if (volumeRatio > 1.05) sentiment = 'bearish'
    else if (volumeRatio < 0.95) sentiment = 'bullish'

    const confidence = Math.min((callVolume + putVolume) / 10000, 1)

    return {
      daysToExpiry: Math.round(avgDaysToExpiry),
      sentiment,
      volumeRatio,
      impliedVolatility: avgIV,
      confidence,
      leapsAnalysis,
      description: `Long-term ${sentiment} confidence with ${leaps.length} LEAPS contracts indicating strategic positioning`
    }
  }

  /**
   * Generate LEAPS analysis for long-term investor confidence
   */
  private generateLeapsAnalysis(leaps: any[]): string {
    if (leaps.length === 0) {
      return 'No LEAPS available - limited long-term positioning data'
    }

    const calls = leaps.filter(c => c.type === 'call')
    const puts = leaps.filter(c => c.type === 'put')

    const callOI = calls.reduce((sum, c) => sum + (c.openInterest || 0), 0)
    const putOI = puts.reduce((sum, c) => sum + (c.openInterest || 0), 0)

    const totalOI = callOI + putOI
    if (totalOI === 0) return 'LEAPS present but no significant open interest'

    const sentiment = callOI > putOI ? 'bullish' : 'bearish'
    const confidence = callOI > putOI ? (callOI / totalOI) : (putOI / totalOI)

    return `${leaps.length} LEAPS with ${totalOI.toLocaleString()} total OI showing ${sentiment} long-term confidence (${(confidence * 100).toFixed(1)}%)`
  }

  /**
   * Detect institutional signals based on volume and open interest patterns
   */
  private detectInstitutionalSignals(contracts: any[]): string[] {
    const signals: string[] = []

    // Large open interest concentrations
    const highOIContracts = contracts.filter(c => (c.openInterest || 0) > 1000)
    if (highOIContracts.length > 0) {
      signals.push(`${highOIContracts.length} contracts with >1K open interest`)
    }

    // Unusual volume spikes
    const highVolumeContracts = contracts.filter(c => (c.volume || 0) > 500)
    if (highVolumeContracts.length > 0) {
      signals.push(`${highVolumeContracts.length} contracts with unusual volume`)
    }

    // Strike clustering (potential support/resistance)
    const strikeGroups = this.groupContractsByStrike(contracts)
    const clusteredStrikes = Object.keys(strikeGroups).filter(strike => strikeGroups[strike].length >= 4)
    if (clusteredStrikes.length > 0) {
      signals.push(`Strike clustering at ${clusteredStrikes.length} levels suggests institutional positioning`)
    }

    return signals
  }

  /**
   * Analyze strike price positioning for institutional hedging patterns
   */
  private analyzeStrikePositioning(optionsChain: OptionsChain) {
    const allContracts = [...optionsChain.calls, ...optionsChain.puts]

    // Find strikes with heavy call activity
    const callsByStrike = this.groupContractsByStrike(optionsChain.calls)
    const heavyCallActivity = Object.keys(callsByStrike)
      .filter(strike => {
        const contracts = callsByStrike[strike]
        const totalOI = contracts.reduce((sum, c) => sum + (c.openInterest || 0), 0)
        return totalOI > 2000
      })
      .map(Number)
      .sort((a, b) => a - b)

    // Find strikes with heavy put activity
    const putsByStrike = this.groupContractsByStrike(optionsChain.puts)
    const heavyPutActivity = Object.keys(putsByStrike)
      .filter(strike => {
        const contracts = putsByStrike[strike]
        const totalOI = contracts.reduce((sum, c) => sum + (c.openInterest || 0), 0)
        return totalOI > 2000
      })
      .map(Number)
      .sort((a, b) => a - b)

    // Detect potential institutional hedges (balanced call/put activity)
    const institutionalHedges = this.detectInstitutionalHedges(callsByStrike, putsByStrike)

    // Find unusual activity patterns
    const unusualActivity = this.detectUnusualActivity(allContracts)

    return {
      heavyCallActivity,
      heavyPutActivity,
      institutionalHedges,
      unusualActivity
    }
  }

  /**
   * Group contracts by strike price
   */
  private groupContractsByStrike(contracts: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {}

    contracts.forEach(contract => {
      const strike = contract.strike.toString()
      if (!groups[strike]) {
        groups[strike] = []
      }
      groups[strike].push(contract)
    })

    return groups
  }

  /**
   * Detect institutional hedging patterns
   */
  private detectInstitutionalHedges(callsByStrike: Record<string, any[]>, putsByStrike: Record<string, any[]>): number[] {
    const hedges: number[] = []

    // Find strikes with both significant call and put open interest
    Object.keys(callsByStrike).forEach(strike => {
      if (putsByStrike[strike]) {
        const callOI = callsByStrike[strike].reduce((sum, c) => sum + (c.openInterest || 0), 0)
        const putOI = putsByStrike[strike].reduce((sum, c) => sum + (c.openInterest || 0), 0)

        // Balanced activity suggests hedging
        if (callOI > 1000 && putOI > 1000 && Math.abs(callOI - putOI) / Math.max(callOI, putOI) < 0.3) {
          hedges.push(Number(strike))
        }
      }
    })

    return hedges.sort((a, b) => a - b)
  }

  /**
   * Detect unusual activity patterns
   */
  private detectUnusualActivity(contracts: any[]): string[] {
    const activity: string[] = []

    // High volume-to-OI ratio suggests fresh positioning
    const unusualVolumeContracts = contracts.filter(c => {
      const volume = c.volume || 0
      const oi = c.openInterest || 1
      return volume > 100 && (volume / oi) > 0.5
    })

    if (unusualVolumeContracts.length > 0) {
      activity.push(`${unusualVolumeContracts.length} contracts with unusual volume/OI ratios indicating fresh positioning`)
    }

    // Large single-contract positions
    const largePositions = contracts.filter(c => (c.openInterest || 0) > 5000)
    if (largePositions.length > 0) {
      activity.push(`${largePositions.length} large institutional positions (>5K OI) detected`)
    }

    return activity
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