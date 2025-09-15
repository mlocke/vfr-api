/**
 * Redis-based Caching System for Dynamic Stock Selection Algorithms
 * Optimized for high-frequency updates and financial data patterns
 */

import Redis from 'ioredis'
import {
  AlgorithmConfiguration,
  StockScore,
  SelectionResult,
  AlgorithmCacheKeys
} from './types'

interface MarketDataPoint {
  symbol: string
  price: number
  volume: number
  marketCap: number
  sector: string
  exchange: string
  timestamp: number
}

interface CacheStatistics {
  hitCount: number
  missCount: number
  totalOperations: number
  hitRate: number
  memoryUsage: string
  activeConnections: number
  keyCount: number
}

interface CacheConfig {
  redis: {
    host: string
    port: number
    password?: string
    db: number
    keyPrefix: string
    maxRetries: number
    retryDelayOnFailover: number
  }
  ttl: {
    configuration: number    // 1 hour - configs change rarely
    stockScores: number     // 5 minutes - scores update frequently
    marketData: number      // 1 minute - market data is real-time
    fundamentalData: number // 1 hour - fundamentals change slowly
    selectionResults: number // 30 minutes - algorithm results
    universe: number        // 4 hours - stock universes are stable
    factors: number         // 5 minutes - factor calculations
  }
  performance: {
    pipelineSize: number    // Batch operations for performance
    compressionThreshold: number // Compress large payloads
    enableCompression: boolean
  }
}

export class AlgorithmCache {
  private redis: Redis
  private config: CacheConfig
  private statistics = {
    hitCount: 0,
    missCount: 0,
    totalOperations: 0
  }

  constructor(config: CacheConfig) {
    this.config = config
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      keyPrefix: config.redis.keyPrefix,
      maxRetriesPerRequest: config.redis.maxRetries,
      lazyConnect: true,
      enableAutoPipelining: true
    })

    this.setupRedisEventHandlers()
  }

  /**
   * Get cache keys helper for consistent key generation
   */
  getCacheKeys(): AlgorithmCacheKeys {
    return {
      config: (algorithmId: string) => `algorithm:config:${algorithmId}`,
      scores: (algorithmId: string, timestamp: number) =>
        `algorithm:scores:${algorithmId}:${Math.floor(timestamp / 60000)}`, // 1-minute buckets
      selections: (algorithmId: string, timestamp: number) =>
        `algorithm:selections:${algorithmId}:${Math.floor(timestamp / 300000)}`, // 5-minute buckets
      marketData: (symbol: string) => `market:${symbol}`,
      dataQuality: (source: string, symbol: string) => `quality:${source}:${symbol}`
    }
  }

  // ==================== ALGORITHM CONFIGURATION CACHING ====================

  /**
   * Cache algorithm configuration
   */
  async setConfiguration(algorithmId: string, config: AlgorithmConfiguration): Promise<void> {
    const key = this.getCacheKeys().config(algorithmId)
    const value = this.serialize(config)

    await this.redis.setex(key, this.config.ttl.configuration, value)
    this.incrementHitCount()
  }

  /**
   * Get cached algorithm configuration
   */
  async getConfiguration(algorithmId: string): Promise<AlgorithmConfiguration | null> {
    const key = this.getCacheKeys().config(algorithmId)
    const value = await this.redis.get(key)

    if (value) {
      this.incrementHitCount()
      return this.deserialize<AlgorithmConfiguration>(value)
    }

    this.incrementMissCount()
    return null
  }

  // ==================== STOCK SCORES CACHING ====================

  /**
   * Cache stock scores with time-based bucketing
   */
  async setStockScores(algorithmId: string, scores: StockScore[]): Promise<void> {
    if (scores.length === 0) return

    const timestamp = scores[0].timestamp
    const key = this.getCacheKeys().scores(algorithmId, timestamp)

    // Use Redis pipeline for batch operations
    const pipeline = this.redis.pipeline()

    // Store scores as hash for efficient individual retrieval
    const scoresHash: { [symbol: string]: string } = {}
    scores.forEach(score => {
      scoresHash[score.symbol] = this.serialize(score)
    })

    pipeline.hmset(`${key}:hash`, scoresHash)
    pipeline.expire(`${key}:hash`, this.config.ttl.stockScores)

    // Store metadata
    const metadata = {
      count: scores.length,
      timestamp,
      averageQuality: scores.reduce((sum, s) => sum + s.dataQuality.overall, 0) / scores.length,
      sectors: Array.from(new Set(scores.map(s => s.marketData.sector)))
    }

    pipeline.setex(`${key}:meta`, this.config.ttl.stockScores, this.serialize(metadata))

    await pipeline.exec()
    this.incrementHitCount()
  }

  /**
   * Get cached stock scores
   */
  async getStockScores(algorithmId: string, timestamp?: number): Promise<StockScore[] | null> {
    const ts = timestamp || Date.now()
    const key = this.getCacheKeys().scores(algorithmId, ts)

    const scoresData = await this.redis.hgetall(`${key}:hash`)

    if (Object.keys(scoresData).length === 0) {
      this.incrementMissCount()
      return null
    }

    this.incrementHitCount()
    return Object.values(scoresData).map(data => this.deserialize<StockScore>(data))
  }

  /**
   * Get single stock score from cache
   */
  async getStockScore(algorithmId: string, symbol: string, timestamp?: number): Promise<StockScore | null> {
    const ts = timestamp || Date.now()
    const key = this.getCacheKeys().scores(algorithmId, ts)

    const scoreData = await this.redis.hget(`${key}:hash`, symbol)

    if (scoreData) {
      this.incrementHitCount()
      return this.deserialize<StockScore>(scoreData)
    }

    this.incrementMissCount()
    return null
  }

  // ==================== MARKET DATA CACHING ====================

  /**
   * Cache market data for symbol
   */
  async setMarketData(symbol: string, data: MarketDataPoint): Promise<void> {
    const key = this.getCacheKeys().marketData(symbol)
    const value = this.serialize(data)

    // Use shorter TTL for real-time market data
    await this.redis.setex(key, this.config.ttl.marketData, value)
    this.incrementHitCount()
  }

  /**
   * Get cached market data
   */
  async getMarketData(symbol: string): Promise<MarketDataPoint | null> {
    const key = this.getCacheKeys().marketData(symbol)
    const value = await this.redis.get(key)

    if (value) {
      this.incrementHitCount()
      return this.deserialize<MarketDataPoint>(value)
    }

    this.incrementMissCount()
    return null
  }

  /**
   * Batch get market data for multiple symbols
   */
  async getMarketDataBatch(symbols: string[]): Promise<Map<string, MarketDataPoint>> {
    const pipeline = this.redis.pipeline()
    const keys = symbols.map(symbol => this.getCacheKeys().marketData(symbol))

    keys.forEach(key => pipeline.get(key))

    const results = await pipeline.exec()
    const marketDataMap = new Map<string, MarketDataPoint>()

    if (results) {
      results.forEach((result, index) => {
        if (result && result[1]) {
          const data = this.deserialize<MarketDataPoint>(result[1] as string)
          marketDataMap.set(symbols[index], data)
          this.incrementHitCount()
        } else {
          this.incrementMissCount()
        }
      })
    }

    return marketDataMap
  }

  // ==================== FUNDAMENTAL DATA CACHING ====================

  /**
   * Cache fundamental data (longer TTL)
   */
  async setFundamentalData(symbol: string, data: { data: any; timestamp: number }): Promise<void> {
    const key = `fundamental:${symbol}`
    const value = this.serialize(data)

    await this.redis.setex(key, this.config.ttl.fundamentalData, value)
    this.incrementHitCount()
  }

  /**
   * Get cached fundamental data
   */
  async getFundamentalData(symbol: string): Promise<{ data: any; timestamp: number } | null> {
    const key = `fundamental:${symbol}`
    const value = await this.redis.get(key)

    if (value) {
      this.incrementHitCount()
      return this.deserialize<{ data: any; timestamp: number }>(value)
    }

    this.incrementMissCount()
    return null
  }

  // ==================== SELECTION RESULTS CACHING ====================

  /**
   * Cache selection results
   */
  async setSelectionResult(algorithmId: string, result: SelectionResult): Promise<void> {
    const key = this.getCacheKeys().selections(algorithmId, result.timestamp)
    const value = this.serialize(result)

    // Store both the full result and a summary for quick access
    const pipeline = this.redis.pipeline()

    pipeline.setex(key, this.config.ttl.selectionResults, value)

    // Store summary for quick lookups
    const summary = {
      algorithmId,
      timestamp: result.timestamp,
      selectionCount: result.selections.length,
      executionTime: result.executionTime,
      averageDataQuality: result.metrics.averageDataQuality
    }

    pipeline.setex(`${key}:summary`, this.config.ttl.selectionResults, this.serialize(summary))

    // Add to recent results list (for algorithm performance tracking)
    pipeline.lpush(`algorithm:recent:${algorithmId}`, key)
    pipeline.ltrim(`algorithm:recent:${algorithmId}`, 0, 99) // Keep last 100 results
    pipeline.expire(`algorithm:recent:${algorithmId}`, this.config.ttl.selectionResults * 2)

    await pipeline.exec()
    this.incrementHitCount()
  }

  /**
   * Get cached selection result
   */
  async getSelectionResult(algorithmId: string, timestamp?: number): Promise<SelectionResult | null> {
    const ts = timestamp || Date.now()
    const key = this.getCacheKeys().selections(algorithmId, ts)
    const value = await this.redis.get(key)

    if (value) {
      this.incrementHitCount()
      return this.deserialize<SelectionResult>(value)
    }

    this.incrementMissCount()
    return null
  }

  /**
   * Get recent selection results for algorithm
   */
  async getRecentSelectionResults(algorithmId: string, limit: number = 10): Promise<SelectionResult[]> {
    const recentKeys = await this.redis.lrange(`algorithm:recent:${algorithmId}`, 0, limit - 1)

    if (recentKeys.length === 0) {
      this.incrementMissCount()
      return []
    }

    const pipeline = this.redis.pipeline()
    recentKeys.forEach(key => pipeline.get(key))

    const results = await pipeline.exec()
    const selectionResults: SelectionResult[] = []

    if (results) {
      results.forEach(result => {
        if (result && result[1]) {
          selectionResults.push(this.deserialize<SelectionResult>(result[1] as string))
          this.incrementHitCount()
        } else {
          this.incrementMissCount()
        }
      })
    }

    return selectionResults
  }

  // ==================== UNIVERSE CACHING ====================

  /**
   * Cache stock universe for algorithm
   */
  async setUniverse(algorithmId: string, symbols: string[]): Promise<void> {
    const key = `universe:${algorithmId}`

    // Store as set for efficient membership testing
    const pipeline = this.redis.pipeline()
    pipeline.del(key) // Clear existing
    if (symbols.length > 0) {
      pipeline.sadd(key, ...symbols)
    }
    pipeline.expire(key, this.config.ttl.universe)

    // Also store as list with metadata
    const metadata = {
      symbols,
      count: symbols.length,
      sectors: await this.getUniqueSectors(symbols),
      timestamp: Date.now()
    }
    pipeline.setex(`${key}:meta`, this.config.ttl.universe, this.serialize(metadata))

    await pipeline.exec()
    this.incrementHitCount()
  }

  /**
   * Get cached stock universe
   */
  async getUniverse(algorithmId: string): Promise<string[]> {
    const key = `universe:${algorithmId}`
    const symbols = await this.redis.smembers(key)

    if (symbols.length > 0) {
      this.incrementHitCount()
      return symbols
    }

    this.incrementMissCount()
    return []
  }

  /**
   * Check if symbol is in cached universe
   */
  async isInUniverse(algorithmId: string, symbol: string): Promise<boolean> {
    const key = `universe:${algorithmId}`
    const exists = await this.redis.sismember(key, symbol)

    if (exists) {
      this.incrementHitCount()
    } else {
      this.incrementMissCount()
    }

    return exists === 1
  }

  // ==================== FACTOR CALCULATIONS CACHING ====================

  /**
   * Cache factor calculation result
   */
  async setFactorValue(
    factorName: string,
    symbol: string,
    value: number,
    metadata?: any
  ): Promise<void> {
    const key = `factor:${factorName}:${symbol}`
    const data = { value, metadata, timestamp: Date.now() }

    await this.redis.setex(key, this.config.ttl.factors, this.serialize(data))
    this.incrementHitCount()
  }

  /**
   * Get cached factor value
   */
  async getFactorValue(factorName: string, symbol: string): Promise<{ value: number; metadata?: any; timestamp: number } | null> {
    const key = `factor:${factorName}:${symbol}`
    const data = await this.redis.get(key)

    if (data) {
      this.incrementHitCount()
      return this.deserialize<{ value: number; metadata?: any; timestamp: number }>(data)
    }

    this.incrementMissCount()
    return null
  }

  // ==================== DATA QUALITY CACHING ====================

  /**
   * Cache data quality assessment
   */
  async setDataQuality(source: string, symbol: string, quality: any): Promise<void> {
    const key = this.getCacheKeys().dataQuality(source, symbol)
    const data = { quality, timestamp: Date.now() }

    await this.redis.setex(key, this.config.ttl.marketData, this.serialize(data))
    this.incrementHitCount()
  }

  /**
   * Get cached data quality
   */
  async getDataQuality(source: string, symbol: string): Promise<any | null> {
    const key = this.getCacheKeys().dataQuality(source, symbol)
    const data = await this.redis.get(key)

    if (data) {
      this.incrementHitCount()
      const parsed = this.deserialize<{ quality: any; timestamp: number }>(data)
      return parsed.quality
    }

    this.incrementMissCount()
    return null
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Invalidate cache for algorithm
   */
  async invalidateAlgorithm(algorithmId: string): Promise<void> {
    const pattern = `*${algorithmId}*`
    const keys = await this.redis.keys(pattern)

    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }

  /**
   * Invalidate cache for symbol
   */
  async invalidateSymbol(symbol: string): Promise<void> {
    const patterns = [
      `market:${symbol}`,
      `fundamental:${symbol}`,
      `factor:*:${symbol}`,
      `quality:*:${symbol}`
    ]

    const pipeline = this.redis.pipeline()
    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        pipeline.del(...keys)
      }
    }

    await pipeline.exec()
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredEntries(): Promise<number> {
    // Redis handles expiration automatically, but we can clean up any stale data
    const patterns = [
      'algorithm:scores:*',
      'algorithm:selections:*',
      'market:*',
      'factor:*'
    ]

    let deletedCount = 0
    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern)
      const pipeline = this.redis.pipeline()

      for (const key of keys) {
        const ttl = await this.redis.ttl(key)
        if (ttl === -1) { // No expiration set
          pipeline.del(key)
          deletedCount++
        }
      }

      await pipeline.exec()
    }

    return deletedCount
  }

  // ==================== PERFORMANCE MONITORING ====================

  /**
   * Get cache statistics
   */
  async getStatistics(): Promise<CacheStatistics> {
    const info = await this.redis.info('memory')
    const dbSize = await this.redis.dbsize()

    const memoryMatch = info.match(/used_memory_human:(.+)/)
    const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown'

    const totalOps = this.statistics.hitCount + this.statistics.missCount
    const hitRate = totalOps > 0 ? this.statistics.hitCount / totalOps : 0

    return {
      hitCount: this.statistics.hitCount,
      missCount: this.statistics.missCount,
      totalOperations: totalOps,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage,
      activeConnections: 1, // Single connection for now
      keyCount: dbSize
    }
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.statistics = {
      hitCount: 0,
      missCount: 0,
      totalOperations: 0
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; error?: string }> {
    const start = Date.now()

    try {
      await this.redis.ping()
      const latency = Date.now() - start

      return {
        status: 'healthy',
        latency
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ==================== UTILITY METHODS ====================

  private serialize(data: any): string {
    const jsonString = JSON.stringify(data)

    // Compress large payloads if enabled
    if (this.config.performance.enableCompression &&
        jsonString.length > this.config.performance.compressionThreshold) {
      // Implement compression here (e.g., using zlib)
      // For now, just return JSON string
      return jsonString
    }

    return jsonString
  }

  private deserialize<T>(data: string): T {
    try {
      return JSON.parse(data) as T
    } catch (error) {
      console.error('Error deserializing cache data:', error)
      throw new Error('Cache deserialization failed')
    }
  }

  private incrementHitCount(): void {
    this.statistics.hitCount++
    this.statistics.totalOperations++
  }

  private incrementMissCount(): void {
    this.statistics.missCount++
    this.statistics.totalOperations++
  }

  private setupRedisEventHandlers(): void {
    this.redis.on('connect', () => {
      console.log('Redis connected')
    })

    this.redis.on('error', (error) => {
      console.error('Redis error:', error)
    })

    this.redis.on('close', () => {
      console.log('Redis connection closed')
    })

    this.redis.on('reconnecting', () => {
      console.log('Redis reconnecting...')
    })
  }

  private async getUniqueSectors(symbols: string[]): Promise<string[]> {
    // This would query your database or cache to get sectors for symbols
    // Placeholder implementation
    return ['Technology', 'Healthcare', 'Finance', 'Energy']
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit()
  }
}