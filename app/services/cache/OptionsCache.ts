/**
 * OptionsCache - High-Performance Caching for Options Data
 *
 * Optimizations:
 * - Market-hours aware TTL configuration
 * - Memory-efficient compression for large chains
 * - Cache warming strategies for popular symbols
 * - Hit ratio optimization targeting >85%
 */

import { RedisCache } from './RedisCache'
import { SimpleCache } from './SimpleCache'
import {
  OptionsChain,
  OptionsAnalysisMetrics,
  PutCallRatio,
  UnusualActivity,
  VolatilityAnalysis,
  OptionsFlowSignals
} from '../types/OptionsTypes'

export class OptionsCache {
  private readonly primaryCache: RedisCache
  private readonly fallbackCache: SimpleCache
  private readonly performanceTracker: PerformanceTracker

  // Cache key patterns for consistency
  private static readonly CACHE_KEYS = {
    OPTIONS_CHAIN: (symbol: string, expiration?: string) =>
      `options:chain:${symbol}${expiration ? `:${expiration}` : ''}`,
    OPTIONS_ANALYSIS: (symbol: string) => `options:analysis:${symbol}`,
    PUT_CALL_RATIO: (symbol: string) => `options:pcr:${symbol}`,
    UNUSUAL_ACTIVITY: (symbol: string) => `options:activity:${symbol}`,
    IV_SURFACE: (symbol: string) => `options:iv:${symbol}`,
    FLOW_SIGNALS: (symbol: string) => `options:flow:${symbol}`,
    PERFORMANCE_METRICS: (symbol: string) => `options:perf:${symbol}`
  }

  // Dynamic TTL configuration based on market conditions
  private static readonly TTL_CONFIG = {
    MARKET_HOURS: {
      CHAIN_DATA: 180,        // 3 minutes - options prices change rapidly
      ANALYSIS: 120,          // 2 minutes - calculated metrics
      PUT_CALL_RATIO: 60,     // 1 minute - high-frequency sentiment
      UNUSUAL_ACTIVITY: 90,   // 1.5 minutes - flow detection
      IV_SURFACE: 300,        // 5 minutes - volatility surface stability
      FLOW_SIGNALS: 60        // 1 minute - real-time signals
    },
    AFTER_HOURS: {
      CHAIN_DATA: 900,        // 15 minutes
      ANALYSIS: 600,          // 10 minutes
      PUT_CALL_RATIO: 300,    // 5 minutes
      UNUSUAL_ACTIVITY: 600,  // 10 minutes
      IV_SURFACE: 1800,       // 30 minutes
      FLOW_SIGNALS: 300       // 5 minutes
    }
  }

  // Popular symbols for cache warming
  private static readonly WARM_CACHE_SYMBOLS = [
    'SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'AMZN', 'GOOGL', 'MSFT'
  ]

  constructor() {
    this.primaryCache = new RedisCache()
    this.fallbackCache = new SimpleCache()
    this.performanceTracker = new PerformanceTracker()
  }

  /**
   * Cache options chain with intelligent compression
   */
  async cacheOptionsChain(symbol: string, data: OptionsChain, expiration?: string): Promise<void> {
    const key = OptionsCache.CACHE_KEYS.OPTIONS_CHAIN(symbol, expiration)
    const ttl = this.getTTL('CHAIN_DATA')

    try {
      // Compress large options chains for memory efficiency
      const optimizedData = this.shouldCompress(data) ? this.compressOptionsData(data) : data

      // Cache in both primary and fallback
      await Promise.allSettled([
        this.primaryCache.set(key, optimizedData, ttl),
        this.fallbackCache.set(key, optimizedData, ttl)
      ])

      // Store metadata for monitoring
      await this.cacheMetadata(key, {
        contractCount: data.calls.length + data.puts.length,
        compressed: optimizedData !== data,
        cacheTime: Date.now(),
        ttl
      })

      this.performanceTracker.recordCacheWrite(key, optimizedData)

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to cache options chain:', errorMessage)
      // Ensure fallback cache works even if primary fails
      await this.fallbackCache.set(key, data, ttl)
    }
  }

  /**
   * Retrieve options chain with fallback strategy
   */
  async getOptionsChain(symbol: string, expiration?: string): Promise<OptionsChain | null> {
    const key = OptionsCache.CACHE_KEYS.OPTIONS_CHAIN(symbol, expiration)

    try {
      // Try primary cache first
      let result = await this.primaryCache.get(key)
      if (result) {
        this.performanceTracker.recordCacheHit(key, 'primary')
        return this.decompressIfNeeded(result)
      }

      // Fallback to in-memory cache
      result = await this.fallbackCache.get(key)
      if (result) {
        this.performanceTracker.recordCacheHit(key, 'fallback')
        return this.decompressIfNeeded(result)
      }

      this.performanceTracker.recordCacheMiss(key)
      return null

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to retrieve options chain from cache:', errorMessage)
      this.performanceTracker.recordCacheError(key, error)
      return null
    }
  }

  /**
   * Cache complete options analysis
   */
  async cacheOptionsAnalysis(symbol: string, analysis: OptionsAnalysisMetrics): Promise<void> {
    const key = OptionsCache.CACHE_KEYS.OPTIONS_ANALYSIS(symbol)
    const ttl = this.getTTL('ANALYSIS')

    try {
      // Cache main analysis
      await this.primaryCache.set(key, analysis, ttl)

      // Cache individual components for partial retrieval
      await Promise.allSettled([
        this.cachePutCallRatio(symbol, analysis.putCallRatio),
        this.cacheUnusualActivity(symbol, analysis.unusualActivity),
        this.cacheVolatilityAnalysis(symbol, analysis.volatilityAnalysis),
        this.cacheFlowSignals(symbol, analysis.flowSignals)
      ])

      this.performanceTracker.recordCacheWrite(key, analysis)

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to cache options analysis:', errorMessage)
    }
  }

  /**
   * Retrieve options analysis with component fallback
   */
  async getOptionsAnalysis(symbol: string): Promise<OptionsAnalysisMetrics | null> {
    const key = OptionsCache.CACHE_KEYS.OPTIONS_ANALYSIS(symbol)

    try {
      // Try complete analysis first
      const result = await this.primaryCache.get(key)
      if (result) {
        this.performanceTracker.recordCacheHit(key, 'primary')
        return result
      }

      // Try to reconstruct from individual components
      const components = await this.getAnalysisComponents(symbol)
      if (this.hasAllComponents(components)) {
        const reconstructed = this.reconstructAnalysis(symbol, components)
        this.performanceTracker.recordCacheHit(key, 'reconstructed')
        return reconstructed
      }

      this.performanceTracker.recordCacheMiss(key)
      return null

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to retrieve options analysis from cache:', errorMessage)
      this.performanceTracker.recordCacheError(key, error)
      return null
    }
  }

  /**
   * Cache individual put/call ratio
   */
  async cachePutCallRatio(symbol: string, ratio: PutCallRatio): Promise<void> {
    const key = OptionsCache.CACHE_KEYS.PUT_CALL_RATIO(symbol)
    const ttl = this.getTTL('PUT_CALL_RATIO')

    await this.safeCache(key, ratio, ttl)
  }

  /**
   * Retrieve put/call ratio
   */
  async getPutCallRatio(symbol: string): Promise<PutCallRatio | null> {
    const key = OptionsCache.CACHE_KEYS.PUT_CALL_RATIO(symbol)
    return await this.safeGet(key)
  }

  /**
   * Cache unusual activity data
   */
  async cacheUnusualActivity(symbol: string, activity: UnusualActivity): Promise<void> {
    const key = OptionsCache.CACHE_KEYS.UNUSUAL_ACTIVITY(symbol)
    const ttl = this.getTTL('UNUSUAL_ACTIVITY')

    await this.safeCache(key, activity, ttl)
  }

  /**
   * Retrieve unusual activity data
   */
  async getUnusualActivity(symbol: string): Promise<UnusualActivity | null> {
    const key = OptionsCache.CACHE_KEYS.UNUSUAL_ACTIVITY(symbol)
    return await this.safeGet(key)
  }

  /**
   * Cache volatility analysis
   */
  async cacheVolatilityAnalysis(symbol: string, analysis: VolatilityAnalysis): Promise<void> {
    const key = OptionsCache.CACHE_KEYS.IV_SURFACE(symbol)
    const ttl = this.getTTL('IV_SURFACE')

    await this.safeCache(key, analysis, ttl)
  }

  /**
   * Retrieve volatility analysis
   */
  async getVolatilityAnalysis(symbol: string): Promise<VolatilityAnalysis | null> {
    const key = OptionsCache.CACHE_KEYS.IV_SURFACE(symbol)
    return await this.safeGet(key)
  }

  /**
   * Cache flow signals
   */
  async cacheFlowSignals(symbol: string, signals: OptionsFlowSignals): Promise<void> {
    const key = OptionsCache.CACHE_KEYS.FLOW_SIGNALS(symbol)
    const ttl = this.getTTL('FLOW_SIGNALS')

    await this.safeCache(key, signals, ttl)
  }

  /**
   * Retrieve flow signals
   */
  async getFlowSignals(symbol: string): Promise<OptionsFlowSignals | null> {
    const key = OptionsCache.CACHE_KEYS.FLOW_SIGNALS(symbol)
    return await this.safeGet(key)
  }

  /**
   * Invalidate all options cache for a symbol
   */
  async invalidateOptionsCache(symbol: string): Promise<void> {
    const patterns = [
      OptionsCache.CACHE_KEYS.OPTIONS_ANALYSIS(symbol),
      OptionsCache.CACHE_KEYS.PUT_CALL_RATIO(symbol),
      OptionsCache.CACHE_KEYS.UNUSUAL_ACTIVITY(symbol),
      OptionsCache.CACHE_KEYS.IV_SURFACE(symbol),
      OptionsCache.CACHE_KEYS.FLOW_SIGNALS(symbol),
      `${OptionsCache.CACHE_KEYS.OPTIONS_CHAIN(symbol)}*` // All expirations
    ]

    try {
      await Promise.allSettled([
        ...patterns.map(pattern => this.primaryCache.delete(pattern)),
        ...patterns.map(pattern => this.fallbackCache.delete(pattern))
      ])

      console.log(`🗑️ Invalidated options cache for ${symbol}`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to invalidate options cache:', errorMessage)
    }
  }

  /**
   * Warm cache for popular symbols during off-hours
   */
  async warmCache(dataProvider: (symbol: string) => Promise<OptionsAnalysisMetrics | null>): Promise<void> {
    if (this.isMarketHours()) {
      return // Don't warm cache during market hours
    }

    console.log('🔥 Warming options cache for popular symbols...')

    const warmingPromises = OptionsCache.WARM_CACHE_SYMBOLS.map(async (symbol) => {
      try {
        const analysis = await dataProvider(symbol)
        if (analysis) {
          await this.cacheOptionsAnalysis(symbol, analysis)
          console.log(`✅ Warmed cache for ${symbol}`)
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.warn(`❌ Failed to warm cache for ${symbol}:`, errorMessage)
      }
    })

    await Promise.allSettled(warmingPromises)
    console.log('🔥 Cache warming completed')
  }

  /**
   * Get cache performance metrics
   */
  getPerformanceMetrics(): CachePerformanceMetrics {
    const metrics = this.performanceTracker.getMetrics()
    const fallbackStats = this.fallbackCache.getStats()

    return {
      hitRatio: metrics.hits / (metrics.hits + metrics.misses) * 100,
      totalHits: metrics.hits,
      totalMisses: metrics.misses,
      totalErrors: metrics.errors,
      avgResponseTime: metrics.totalResponseTime / (metrics.hits + metrics.misses),
      memoryUsage: fallbackStats.memoryItems,
      cacheSize: metrics.totalWrites,
      timestamp: Date.now()
    }
  }

  /**
   * Private helper methods
   */

  private getTTL(type: keyof typeof OptionsCache.TTL_CONFIG.MARKET_HOURS): number {
    const isMarketHours = this.isMarketHours()
    const config = isMarketHours
      ? OptionsCache.TTL_CONFIG.MARKET_HOURS
      : OptionsCache.TTL_CONFIG.AFTER_HOURS

    return config[type] || 300
  }

  private isMarketHours(): boolean {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()

    // Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 16
  }

  private shouldCompress(data: OptionsChain): boolean {
    const totalContracts = data.calls.length + data.puts.length
    return totalContracts > 500 // Compress chains with >500 contracts
  }

  private compressOptionsData(data: OptionsChain): OptionsChain {
    // Remove zero-volume contracts
    const activeContracts = (contracts: any[]) =>
      contracts.filter(c => c.volume > 0 || c.openInterest >= 10)

    return {
      ...data,
      calls: activeContracts(data.calls),
      puts: activeContracts(data.puts),
      compressed: true,
      originalContractCount: data.calls.length + data.puts.length
    }
  }

  private decompressIfNeeded(data: any): any {
    // Data is already decompressed when retrieved from JSON
    return data
  }

  private async safeCache(key: string, data: any, ttl: number): Promise<void> {
    try {
      await this.primaryCache.set(key, data, ttl)
      this.performanceTracker.recordCacheWrite(key, data)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Failed to cache ${key}:`, errorMessage)
      // Try fallback cache
      await this.fallbackCache.set(key, data, ttl)
    }
  }

  private async safeGet(key: string): Promise<any> {
    try {
      let result = await this.primaryCache.get(key)
      if (result) {
        this.performanceTracker.recordCacheHit(key, 'primary')
        return result
      }

      result = await this.fallbackCache.get(key)
      if (result) {
        this.performanceTracker.recordCacheHit(key, 'fallback')
        return result
      }

      this.performanceTracker.recordCacheMiss(key)
      return null

    } catch (error: unknown) {
      this.performanceTracker.recordCacheError(key, error)
      return null
    }
  }

  private async cacheMetadata(key: string, metadata: any): Promise<void> {
    const metaKey = `${key}:meta`
    await this.safeCache(metaKey, metadata, this.getTTL('CHAIN_DATA'))
  }

  private async getAnalysisComponents(symbol: string): Promise<any> {
    const [putCallRatio, unusualActivity, volatilityAnalysis, flowSignals] = await Promise.allSettled([
      this.getPutCallRatio(symbol),
      this.getUnusualActivity(symbol),
      this.getVolatilityAnalysis(symbol),
      this.getFlowSignals(symbol)
    ])

    return {
      putCallRatio: putCallRatio.status === 'fulfilled' ? putCallRatio.value : null,
      unusualActivity: unusualActivity.status === 'fulfilled' ? unusualActivity.value : null,
      volatilityAnalysis: volatilityAnalysis.status === 'fulfilled' ? volatilityAnalysis.value : null,
      flowSignals: flowSignals.status === 'fulfilled' ? flowSignals.value : null
    }
  }

  private hasAllComponents(components: any): boolean {
    return components.putCallRatio &&
           components.unusualActivity &&
           components.volatilityAnalysis &&
           components.flowSignals
  }

  private reconstructAnalysis(symbol: string, components: any): OptionsAnalysisMetrics {
    return {
      symbol,
      putCallRatio: components.putCallRatio,
      unusualActivity: components.unusualActivity,
      volatilityAnalysis: components.volatilityAnalysis,
      flowSignals: components.flowSignals,
      confidence: 75, // Reduced confidence for reconstructed data
      performance: {
        operation: 'reconstructed',
        duration: 0,
        memoryUsage: 0,
        cacheHit: true,
        contractsProcessed: 0,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      source: 'cache-reconstructed'
    }
  }
}

/**
 * Performance tracking for cache operations
 */
class PerformanceTracker {
  private metrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    totalWrites: 0,
    totalResponseTime: 0,
    hitsBySource: { primary: 0, fallback: 0, reconstructed: 0 }
  }

  recordCacheHit(key: string, source: 'primary' | 'fallback' | 'reconstructed'): void {
    this.metrics.hits++
    this.metrics.hitsBySource[source]++
  }

  recordCacheMiss(key: string): void {
    this.metrics.misses++
  }

  recordCacheError(key: string, error: any): void {
    this.metrics.errors++
  }

  recordCacheWrite(key: string, data: any): void {
    this.metrics.totalWrites++
  }

  getMetrics(): any {
    return { ...this.metrics }
  }
}

interface CachePerformanceMetrics {
  hitRatio: number
  totalHits: number
  totalMisses: number
  totalErrors: number
  avgResponseTime: number
  memoryUsage: number
  cacheSize: number
  timestamp: number
}