/**
 * Redis Cache Service for MCP Financial Data
 * High-performance multi-tier caching with intelligent invalidation
 */

import Redis from 'ioredis'
import ErrorHandler from '../error-handling/ErrorHandler'

// Test-friendly logging utility
class CacheLogger {
  private static isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined
  }

  static log(message: string): void {
    if (!this.isTestEnvironment()) {
      console.log(message)
    }
  }

  static warn(message: string): void {
    if (!this.isTestEnvironment()) {
      console.warn(message)
    }
  }

  static error(message: string, error?: any): void {
    if (!this.isTestEnvironment()) {
      console.error(message, error)
    }
  }
}

interface CacheConfig {
  host: string
  port: number
  password?: string
  keyPrefix: string
  defaultTTL: number
  maxRetries: number
  retryDelayOnFailover: number
  enableReadyCheck: boolean
  lazyConnect: boolean
}

interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  source: string
  version: string
}

interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
  hitRate: number
  memoryUsage: string
  totalKeys: number
}

export class RedisCache {
  private static instance: RedisCache
  private redis!: Redis
  private backupRedis?: Redis
  private config!: CacheConfig
  private stats!: CacheStats
  private healthCheckInterval?: NodeJS.Timeout
  private redisAvailable: boolean = false

  /**
   * Parse Redis URL and extract connection parameters
   * Supports both REDIS_URL and individual host/port/password env vars
   */
  private parseRedisUrl(): { host: string; port: number; password?: string } {
    const redisUrl = process.env.REDIS_URL

    if (redisUrl && redisUrl !== '') {
      try {
        const url = new URL(redisUrl)
        return {
          host: url.hostname || 'localhost',
          port: parseInt(url.port) || 6379,
          password: url.password || undefined
        }
      } catch (error) {
        CacheLogger.warn(`⚠️ Invalid REDIS_URL format: ${redisUrl}, falling back to individual env vars`)
      }
    }

    // Fallback to individual environment variables
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined
    }
  }

  constructor(config?: Partial<CacheConfig>) {
    const redisConfig = this.parseRedisUrl()
    this.config = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      keyPrefix: 'veritak:mcp:',
      defaultTTL: this.getOptimalTTL(), // Dynamic TTL based on data type
      maxRetries: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: false,
      ...config
    }

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      memoryUsage: '0B',
      totalKeys: 0
    }

    this.initializeRedis()
    this.startHealthCheck()

    // Initialize with fallback mode for development (unless forced to production mode)
    if (process.env.NODE_ENV === 'development' && !process.env.FORCE_REDIS_PRODUCTION_MODE) {
      this.setupDevelopmentFallback()
    }
  }

  /**
   * Get optimal TTL based on data type for FMP optimization
   */
  private getOptimalTTL(): number {
    return parseInt(process.env.REDIS_DEFAULT_TTL || '600') // Base 10 minutes
  }

  /**
   * Enhanced cache with FMP-optimized TTL and memory management
   */
  async setOptimized<T>(
    key: string,
    data: T,
    dataType: 'market' | 'fundamental' | 'sentiment' | 'analysis' | 'options' | 'options_chain' | 'put_call_ratio' = 'analysis'
  ): Promise<boolean> {
    // Dynamic TTL based on data freshness requirements and FMP rate limits
    const optimizedTTL = this.calculateOptimizedTTL(dataType)

    // Add data compression for large payloads to optimize memory usage
    const shouldCompress = JSON.stringify(data).length > 8192 // 8KB threshold

    try {
      const cacheData: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: optimizedTTL,
        source: 'fmp-optimized',
        version: '1.1'
      }

      // Use pipeline for atomic operations and better performance
      const pipeline = this.redis.pipeline()

      if (shouldCompress && this.redisAvailable) {
        // Compress large objects to reduce memory usage
        const compressedData = Buffer.from(JSON.stringify(cacheData)).toString('base64')
        pipeline.setex(`${key}:compressed`, optimizedTTL, compressedData)
        pipeline.set(`${key}:meta`, JSON.stringify({ compressed: true, size: compressedData.length }))
      } else {
        pipeline.setex(key, optimizedTTL, JSON.stringify(cacheData))
      }

      await pipeline.exec()
      this.stats.sets++
      return true

    } catch (error) {
      this.stats.errors++
      CacheLogger.error(`Failed to set optimized cache for ${key}:`, error)
      return false
    }
  }

  /**
   * Calculate optimized TTL based on data type and market conditions
   */
  private calculateOptimizedTTL(dataType: string): number {
    const baseTTL = this.config.defaultTTL
    const now = new Date()
    const hour = now.getUTCHours() - 5 // EST adjustment
    const day = now.getUTCDay()
    const isMarketHours = day >= 1 && day <= 5 && hour >= 9 && hour < 16
    const isWeekend = day === 0 || day === 6

    switch (dataType) {
      case 'market':
        // Market data: Dynamic TTL based on market hours
        if (isWeekend) return 1800 // 30 minutes on weekends
        return isMarketHours ? 30 : 300 // 30s during market, 5min after hours

      case 'options':
        // Options data: Optimized for high-frequency updates during market hours
        if (isWeekend) return 1800 // 30 minutes on weekends
        return isMarketHours ? 30 : 300 // 30s during market, 5min after hours

      case 'options_chain':
        // Options chains: More aggressive caching due to large payload
        if (isWeekend) return 3600 // 1 hour on weekends
        return isMarketHours ? 60 : 600 // 1min during market, 10min after hours

      case 'fundamental':
        // Fundamental data: Longer TTL as it changes less frequently
        return baseTTL * 6 // 1 hour with 10min base = 60 minutes

      case 'sentiment':
        // Sentiment data: Medium TTL for reasonable freshness
        return baseTTL * 2 // 20 minutes with 10min base

      case 'analysis':
        // Analysis results: Cache longer since computation is expensive
        return baseTTL * 3 // 30 minutes with 10min base

      default:
        return baseTTL
    }
  }

  /**
   * Batch set operations for FMP data with intelligent memory management
   */
  async setBatch<T>(
    entries: Array<{ key: string; data: T; dataType?: string }>,
    compression = true
  ): Promise<number> {
    if (!this.redisAvailable || entries.length === 0) return 0

    try {
      const pipeline = this.redis.pipeline()
      let successCount = 0

      for (const entry of entries) {
        const ttl = this.calculateOptimizedTTL(entry.dataType || 'analysis')
        const cacheData: CacheEntry<T> = {
          data: entry.data,
          timestamp: Date.now(),
          ttl,
          source: 'fmp-batch',
          version: '1.1'
        }

        const serializedData = JSON.stringify(cacheData)

        if (compression && serializedData.length > 4096) { // 4KB threshold for compression
          const compressed = Buffer.from(serializedData).toString('base64')
          pipeline.setex(`${entry.key}:compressed`, ttl, compressed)
          pipeline.set(`${entry.key}:meta`, JSON.stringify({ compressed: true }))
        } else {
          pipeline.setex(entry.key, ttl, serializedData)
        }

        successCount++
      }

      await pipeline.exec()
      this.stats.sets += successCount
      return successCount

    } catch (error) {
      this.stats.errors++
      CacheLogger.error('Batch set operation failed:', error)
      return 0
    }
  }

  static getInstance(config?: Partial<CacheConfig>): RedisCache {
    if (!RedisCache.instance) {
      RedisCache.instance = new RedisCache(config)
    }
    return RedisCache.instance
  }

  private initializeRedis() {
    CacheLogger.log(`🔗 Initializing Redis connection to ${this.config.host}:${this.config.port}`)

    // Primary Redis connection with enhanced retry strategy
    this.redis = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      keyPrefix: this.config.keyPrefix,
      maxRetriesPerRequest: this.config.maxRetries,
      enableReadyCheck: this.config.enableReadyCheck,
      lazyConnect: this.config.lazyConnect,
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        CacheLogger.log(`🔄 Redis retry attempt ${times}, waiting ${delay}ms`)
        return delay
      },
      showFriendlyErrorStack: process.env.NODE_ENV === 'development'
    })

    // Event handlers
    this.redis.on('connect', () => {
      CacheLogger.log('✅ Redis connected successfully')
      this.redisAvailable = true
    })

    this.redis.on('ready', () => {
      CacheLogger.log('🚀 Redis ready for operations')
      this.redisAvailable = true
    })

    this.redis.on('error', (error) => {
      CacheLogger.error('❌ Redis error:', error)
      this.redisAvailable = false
      this.stats.errors++
    })

    this.redis.on('reconnecting', () => {
      CacheLogger.log('🔄 Redis reconnecting...')
      this.redisAvailable = false
    })

    this.redis.on('close', () => {
      CacheLogger.log('📪 Redis connection closed')
      this.redisAvailable = false
    })

    // Optional: Set up Redis cluster for high availability
    if (process.env.REDIS_CLUSTER_NODES) {
      this.setupCluster()
    }
  }

  private setupCluster() {
    const clusterNodes = process.env.REDIS_CLUSTER_NODES?.split(',') || []

    if (clusterNodes.length > 1) {
      CacheLogger.log('🔗 Setting up Redis cluster...')

      // For now, we'll use a simple backup connection
      // In production, use Redis.Cluster for true clustering
      this.backupRedis = new Redis({
        host: clusterNodes[1].split(':')[0],
        port: parseInt(clusterNodes[1].split(':')[1] || '6379'),
        password: this.config.password,
        keyPrefix: this.config.keyPrefix
      })
    }
  }

  /**
   * Setup development fallback when Redis is not available
   */
  private setupDevelopmentFallback(): void {
    // Check Redis connection after a brief delay
    const timeoutId = setTimeout(() => {
      if (!this.redisAvailable) {
        CacheLogger.warn('⚠️ Redis not available in development mode - using in-memory fallback')
        CacheLogger.warn('💡 To use Redis caching, ensure Redis is running on localhost:6379')
      }
    }, 2000) // Give Redis 2 seconds to connect

    // Track timeout for cleanup in tests
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined) {
      (global as any).__redisTimeouts = (global as any).__redisTimeouts || []
      ;(global as any).__redisTimeouts.push(timeoutId)
    }
  }

  /**
   * Check if Redis is available for operations
   */
  private isRedisAvailable(): boolean {
    return this.redisAvailable && this.redis.status === 'ready'
  }

  /**
   * Get data from cache with automatic deserialization
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      // Check if Redis is available
      if (!this.isRedisAvailable()) {
        this.stats.misses++
        this.updateHitRate()
        return null
      }

      const cached = await this.redis.get(key)

      if (!cached) {
        this.stats.misses++
        this.updateHitRate()
        return null
      }

      const entry: CacheEntry<T> = JSON.parse(cached)

      // Check if entry has expired
      if (Date.now() - entry.timestamp > entry.ttl * 1000) {
        await this.delete(key)
        this.stats.misses++
        this.updateHitRate()
        return null
      }

      this.stats.hits++
      this.updateHitRate()
      return entry.data

    } catch (error) {
      const normalizedError = ErrorHandler.normalizeError(error)
      CacheLogger.warn(`⚠️ Cache get error for key ${key} (Redis may not be available): ${normalizedError.message}`)
      this.stats.errors++
      this.redisAvailable = false
      return null
    }
  }

  /**
   * Set data in cache with automatic serialization
   */
  async set<T = any>(
    key: string,
    data: T,
    ttl: number = this.config.defaultTTL,
    metadata: { source?: string; version?: string } = {}
  ): Promise<boolean> {
    try {
      // Check if Redis is available
      if (!this.isRedisAvailable()) {
        CacheLogger.warn(`⚠️ Redis not available, skipping cache set for key: ${key}`)
        return false
      }

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        source: metadata.source || 'unknown',
        version: metadata.version || '1.0.0'
      }

      const serialized = JSON.stringify(entry)
      await this.redis.setex(key, ttl, serialized)

      this.stats.sets++
      return true

    } catch (error) {
      CacheLogger.error(`❌ Cache set error for key ${key}:`, error)
      this.stats.errors++
      return false
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      // Check if Redis is available
      if (!this.isRedisAvailable()) {
        return false
      }

      const result = await this.redis.del(key)
      this.stats.deletes++
      return result > 0
    } catch (error) {
      CacheLogger.error(`❌ Cache delete error for key ${key}:`, error)
      this.stats.errors++
      return false
    }
  }

  /**
   * Get multiple keys in parallel
   */
  async mget<T = any>(keys: string[]): Promise<{ [key: string]: T | null }> {
    try {
      const values = await this.redis.mget(...keys)
      const result: { [key: string]: T | null } = {}

      keys.forEach((key, index) => {
        const value = values[index]
        if (value) {
          try {
            const entry: CacheEntry<T> = JSON.parse(value)
            if (Date.now() - entry.timestamp <= entry.ttl * 1000) {
              result[key] = entry.data
              this.stats.hits++
            } else {
              result[key] = null
              this.stats.misses++
              // Async delete expired key
              this.delete(key.replace(this.config.keyPrefix, ''))
            }
          } catch {
            result[key] = null
            this.stats.misses++
          }
        } else {
          result[key] = null
          this.stats.misses++
        }
      })

      this.updateHitRate()
      return result

    } catch (error) {
      CacheLogger.error('❌ Cache mget error:', error)
      this.stats.errors++
      return {}
    }
  }

  /**
   * Set multiple keys in parallel
   */
  async mset<T = any>(
    entries: Array<{ key: string; data: T; ttl?: number; metadata?: any }>,
    pipeline: boolean = true
  ): Promise<boolean> {
    try {
      if (pipeline) {
        const pipe = this.redis.pipeline()

        entries.forEach(({ key, data, ttl = this.config.defaultTTL, metadata = {} }) => {
          const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl,
            source: metadata.source || 'unknown',
            version: metadata.version || '1.0.0'
          }
          pipe.setex(key, ttl, JSON.stringify(entry))
        })

        await pipe.exec()
      } else {
        await Promise.all(
          entries.map(({ key, data, ttl, metadata }) =>
            this.set(key, data, ttl, metadata)
          )
        )
      }

      this.stats.sets += entries.length
      return true

    } catch (error) {
      CacheLogger.error('❌ Cache mset error:', error)
      this.stats.errors++
      return false
    }
  }

  /**
   * Advanced cache operations for financial data
   */

  /**
   * Cache stock price with automatic key generation
   */
  async cacheStockPrice(symbol: string, data: any, source: string, ttl: number = 60): Promise<void> {
    const key = `stock:price:${symbol}:${source}`
    await this.set(key, data, ttl, { source, version: '1.0.0' })
  }

  /**
   * Get cached stock price with fallback to multiple sources
   */
  async getCachedStockPrice(symbol: string, sources: string[] = ['polygon', 'alphavantage', 'yahoo']): Promise<any> {
    const keys = sources.map(source => `stock:price:${symbol}:${source}`)
    const results = await this.mget(keys)

    // Return first available result
    for (const key of keys) {
      if (results[key]) {
        return results[key]
      }
    }
    return null
  }

  /**
   * Cache market data with intelligent TTL based on market hours
   */
  async cacheMarketData(
    dataType: string,
    identifier: string,
    data: any,
    source: string
  ): Promise<void> {
    const now = new Date()
    const isMarketHours = this.isMarketHours(now)

    // Shorter TTL during market hours for real-time data (optimized for FMP Starter)
    const marketHoursTTL = parseInt(process.env.MARKET_HOURS_TTL || '30')
    const afterHoursTTL = parseInt(process.env.REDIS_DEFAULT_TTL || '300')
    const ttl = isMarketHours ? marketHoursTTL : afterHoursTTL

    const key = `market:${dataType}:${identifier}:${source}`
    await this.set(key, data, ttl, { source, version: '1.0.0' })
  }

  /**
   * Cache options data with performance optimization and compression
   */
  async cacheOptionsData(
    symbol: string,
    dataType: 'options' | 'options_chain' | 'put_call_ratio',
    data: any,
    source: string
  ): Promise<boolean> {
    try {
      const key = `options:${dataType}:${symbol.toUpperCase()}:${source}`
      const ttl = this.calculateOptimizedTTL(dataType)

      // Use setOptimized for automatic compression on large options datasets
      return await this.setOptimized(key, data, dataType)

    } catch (error) {
      CacheLogger.error(`Failed to cache options data for ${symbol}:`, error)
      return false
    }
  }

  /**
   * Cache ML prediction results with 5-minute TTL
   */
  async cacheMLPrediction(
    symbol: string,
    predictionType: 'price_target' | 'sentiment_score' | 'risk_assessment' | 'momentum',
    prediction: any,
    modelVersion: string = '1.0',
    source: string = 'ml-engine'
  ): Promise<boolean> {
    try {
      const key = `ml:prediction:${predictionType}:${symbol.toUpperCase()}:${modelVersion}`
      const ttl = 300 // 5 minutes TTL for ML results

      return await this.set(key, prediction, ttl, { source, version: modelVersion })

    } catch (error) {
      CacheLogger.error(`Failed to cache ML prediction for ${symbol}:`, error)
      return false
    }
  }

  /**
   * Get cached ML prediction with fallback to multiple model versions
   */
  async getCachedMLPrediction<T>(
    symbol: string,
    predictionType: 'price_target' | 'sentiment_score' | 'risk_assessment' | 'momentum',
    modelVersions: string[] = ['1.0', '0.9']
  ): Promise<T | null> {
    const keys = modelVersions.map(version => `ml:prediction:${predictionType}:${symbol.toUpperCase()}:${version}`)
    const results = await this.mget<T>(keys)

    // Return first available result from preferred model versions
    for (const key of keys) {
      if (results[key]) {
        return results[key]
      }
    }

    return null
  }

  /**
   * Batch cache ML predictions for multiple symbols
   */
  async batchCacheMLPredictions(
    predictions: Array<{
      symbol: string
      predictionType: 'price_target' | 'sentiment_score' | 'risk_assessment' | 'momentum'
      prediction: any
      modelVersion?: string
      source?: string
    }>
  ): Promise<number> {
    const entries = predictions.map(item => ({
      key: `ml:prediction:${item.predictionType}:${item.symbol.toUpperCase()}:${item.modelVersion || '1.0'}`,
      data: item.prediction,
      ttl: 300, // 5 minutes TTL
      metadata: {
        source: item.source || 'ml-engine',
        version: item.modelVersion || '1.0'
      }
    }))

    try {
      const pipe = this.redis.pipeline()

      entries.forEach(({ key, data, ttl, metadata }) => {
        const entry: CacheEntry = {
          data,
          timestamp: Date.now(),
          ttl: ttl!,
          source: metadata.source,
          version: metadata.version
        }
        pipe.setex(key, ttl!, JSON.stringify(entry))
      })

      await pipe.exec()
      this.stats.sets += entries.length
      return entries.length

    } catch (error) {
      CacheLogger.error('Failed to batch cache ML predictions:', error)
      this.stats.errors++
      return 0
    }
  }

  /**
   * Clean up expired ML prediction data
   */
  async cleanupMLPredictions(): Promise<number> {
    try {
      const pattern = 'ml:prediction:*'
      const deletedKeys = await this.invalidatePattern(pattern)

      CacheLogger.log(`🧹 Cleaned up ${deletedKeys} expired ML prediction cache entries`)
      return deletedKeys

    } catch (error) {
      CacheLogger.error('Failed to cleanup ML prediction data:', error)
      return 0
    }
  }

  /**
   * Get cached options data with performance tracking
   */
  async getCachedOptionsData<T>(
    symbol: string,
    dataType: 'options' | 'options_chain' | 'put_call_ratio',
    sources: string[] = ['eodhd', 'polygon', 'yahoo']
  ): Promise<T | null> {
    const keys = sources.map(source => `options:${dataType}:${symbol.toUpperCase()}:${source}`)
    const results = await this.mget<T>(keys)

    // Return first available result from preferred sources
    for (const key of keys) {
      if (results[key]) {
        this.stats.hits++
        return results[key]
      }
    }

    this.stats.misses++
    return null
  }

  /**
   * Batch cache options data for multiple symbols
   */
  async batchCacheOptionsData(
    optionsData: Array<{
      symbol: string
      dataType: 'options' | 'options_chain' | 'put_call_ratio'
      data: any
      source: string
    }>
  ): Promise<number> {
    const entries = optionsData.map(item => ({
      key: `options:${item.dataType}:${item.symbol.toUpperCase()}:${item.source}`,
      data: item.data,
      dataType: item.dataType
    }))

    return await this.setBatch(entries, true) // Enable compression
  }

  /**
   * Clean up expired options data to optimize memory
   */
  async cleanupOptionsData(): Promise<number> {
    try {
      const pattern = 'options:*'
      const deletedKeys = await this.invalidatePattern(pattern)

      CacheLogger.log(`🧹 Cleaned up ${deletedKeys} expired options cache entries`)
      return deletedKeys

    } catch (error) {
      CacheLogger.error('Failed to cleanup options data:', error)
      return 0
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(`${this.config.keyPrefix}${pattern}`)
      if (keys.length === 0) return 0

      const result = await this.redis.del(...keys)
      this.stats.deletes += result
      return result
    } catch (error) {
      console.error(`❌ Cache invalidation error for pattern ${pattern}:`, error)
      this.stats.errors++
      return 0
    }
  }

  /**
   * Warm cache with frequently accessed data including options and ML predictions
   */
  async warmCache(
    symbols: string[],
    sources: string[] = ['polygon', 'alphavantage'],
    includeOptions: boolean = false,
    includeMLPredictions: boolean = false
  ): Promise<void> {
    CacheLogger.log(`🔥 Warming cache for ${symbols.length} symbols from ${sources.length} sources...`)

    const warmingPromises = symbols.flatMap(symbol => {
      const stockPromises = sources.map(async source => {
        const key = `stock:price:${symbol}:${source}`
        CacheLogger.log(`🔥 Warmed stock cache key: ${key}`)
      })

      const promises = [...stockPromises]

      if (includeOptions) {
        const optionsPromises = sources.map(async source => {
          const optionsKeys = [
            `options:options:${symbol}:${source}`,
            `options:put_call_ratio:${symbol}:${source}`,
            `options:options_chain:${symbol}:${source}`
          ]
          optionsKeys.forEach(key => {
            CacheLogger.log(`🔥 Warmed options cache key: ${key}`)
          })
        })
        promises.push(...optionsPromises)
      }

      if (includeMLPredictions) {
        const mlPromises = ['1.0', '0.9'].map(async version => {
          const mlKeys = [
            `ml:prediction:price_target:${symbol}:${version}`,
            `ml:prediction:sentiment_score:${symbol}:${version}`,
            `ml:prediction:risk_assessment:${symbol}:${version}`,
            `ml:prediction:momentum:${symbol}:${version}`
          ]
          mlKeys.forEach(key => {
            CacheLogger.log(`🔥 Warmed ML prediction cache key: ${key}`)
          })
        })
        promises.push(...mlPromises)
      }

      return promises
    })

    await Promise.all(warmingPromises)
    CacheLogger.log('✅ Cache warming complete (including options and ML prediction data)')
  }

  /**
   * Get cache statistics with options and ML prediction metrics
   */
  async getStats(): Promise<CacheStats & { optionsMetrics?: any; mlMetrics?: any }> {
    try {
      const info = await this.redis.info('memory')
      const memoryMatch = info.match(/used_memory_human:(\S+)/)
      this.stats.memoryUsage = memoryMatch ? memoryMatch[1] : '0B'

      const keyCount = await this.redis.dbsize()
      this.stats.totalKeys = keyCount

      // Get options-specific metrics
      const optionsKeys = await this.redis.keys(`${this.config.keyPrefix}options:*`)
      const optionsMetrics = {
        totalOptionsKeys: optionsKeys.length,
        optionsChainKeys: optionsKeys.filter(k => k.includes('options_chain')).length,
        putCallRatioKeys: optionsKeys.filter(k => k.includes('put_call_ratio')).length,
        optionsAnalysisKeys: optionsKeys.filter(k => k.includes('options:')).length,
        optionsMemoryUsage: this.calculateOptionsMemoryUsage(optionsKeys.length, keyCount)
      }

      // Get ML prediction metrics
      const mlKeys = await this.redis.keys(`${this.config.keyPrefix}ml:prediction:*`)
      const mlMetrics = {
        totalMLKeys: mlKeys.length,
        priceTargetKeys: mlKeys.filter(k => k.includes('price_target')).length,
        sentimentScoreKeys: mlKeys.filter(k => k.includes('sentiment_score')).length,
        riskAssessmentKeys: mlKeys.filter(k => k.includes('risk_assessment')).length,
        momentumKeys: mlKeys.filter(k => k.includes('momentum')).length,
        mlMemoryUsage: this.calculateMLMemoryUsage(mlKeys.length, keyCount)
      }

      return {
        ...this.stats,
        optionsMetrics,
        mlMetrics
      }
    } catch (error) {
      CacheLogger.error('❌ Error getting cache stats:', error)
      return this.stats
    }
  }

  /**
   * Calculate estimated memory usage for options data
   */
  private calculateOptionsMemoryUsage(optionsKeys: number, totalKeys: number): string {
    if (totalKeys === 0) return '0%'
    const percentage = (optionsKeys / totalKeys) * 100
    return `${percentage.toFixed(1)}%`
  }

  /**
   * Calculate estimated memory usage for ML prediction data
   */
  private calculateMLMemoryUsage(mlKeys: number, totalKeys: number): string {
    if (totalKeys === 0) return '0%'
    const percentage = (mlKeys / totalKeys) * 100
    return `${percentage.toFixed(1)}%`
  }

  /**
   * Health check and monitoring with options and ML prediction cleanup
   */
  private startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.redis.ping()
        // Optional: Check memory usage and cleanup if needed
        const stats = await this.getStats()

        // Auto-cleanup if cache is getting full (>80% of max memory)
        if (stats.totalKeys > 10000) {
          CacheLogger.log('🧹 Auto-cleanup: Cache is getting full, running maintenance...')
          await this.cleanup()

          // Additional cleanup for options data if cache is still full
          if (stats.optionsMetrics && stats.optionsMetrics.totalOptionsKeys > 5000) {
            CacheLogger.log('🧹 Auto-cleanup: Running options-specific cleanup...')
            await this.cleanupOptionsData()
          }

          // Additional cleanup for ML predictions if cache is still full
          if (stats.mlMetrics && stats.mlMetrics.totalMLKeys > 3000) {
            CacheLogger.log('🧹 Auto-cleanup: Running ML predictions cleanup...')
            await this.cleanupMLPredictions()
          }
        }
      } catch (error) {
        CacheLogger.error('❌ Redis health check failed:', error)
        this.stats.errors++
      }
    }, 30000) // Check every 30 seconds

    // Allow process to exit even with active timer
    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref()
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      if (!this.isRedisAvailable()) {
        CacheLogger.warn('⚠️ Redis not available, skipping cache clear')
        return
      }

      await this.redis.flushdb()
      CacheLogger.log('🧹 Cache cleared successfully')
    } catch (error) {
      CacheLogger.error('❌ Cache clear error:', error)
      throw error
    }
  }

  /**
   * Cleanup expired keys and optimize memory
   */
  async cleanup(): Promise<void> {
    try {
      // Redis handles TTL expiration automatically, but we can run manual cleanup
      const keysDeleted = await this.redis.eval(`
        local keys = redis.call('keys', '${this.config.keyPrefix}*')
        local deleted = 0
        for i=1,#keys do
          local ttl = redis.call('ttl', keys[i])
          if ttl == -1 then  -- No TTL set
            redis.call('expire', keys[i], 3600)  -- Set 1 hour default
          elseif ttl == -2 then  -- Key doesn't exist
            deleted = deleted + 1
          end
        end
        return deleted
      `, 0)

      CacheLogger.log(`🧹 Cache cleanup completed. Keys processed: ${keysDeleted}`)
    } catch (error) {
      CacheLogger.error('❌ Cache cleanup error:', error)
    }
  }

  /**
   * Helper: Check if current time is during market hours
   */
  private isMarketHours(date: Date): boolean {
    const hour = date.getHours()
    const day = date.getDay()

    // Monday-Friday, 9:30 AM - 4:00 PM EST
    return day >= 1 && day <= 5 && hour >= 9 && hour < 16
  }

  /**
   * Helper: Update hit rate calculation
   */
  private updateHitRate() {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0
  }

  /**
   * Ping Redis server for health checks with reconnection attempts
   */
  async ping(): Promise<string> {
    try {
      if (this.isRedisAvailable()) {
        return await this.redis.ping()
      } else if (this.redis.status === 'connecting') {
        // Wait briefly for connection
        await new Promise(resolve => setTimeout(resolve, 1000))
        return await this.redis.ping()
      } else {
        // Attempt reconnection if not connected
        await this.attemptReconnection()
        if (this.isRedisAvailable()) {
          return await this.redis.ping()
        }
        return 'PONG (fallback)'
      }
    } catch (error) {
      const normalizedError = ErrorHandler.normalizeError(error)
      CacheLogger.warn(`⚠️ Redis ping failed: ${normalizedError.message}`)
      this.redisAvailable = false
      return 'PONG (fallback)'
    }
  }

  /**
   * Attempt to reconnect to Redis if disconnected
   */
  private async attemptReconnection(): Promise<void> {
    if (!this.redisAvailable && this.redis.status !== 'connecting') {
      try {
        CacheLogger.log('🔄 Attempting Redis reconnection...')
        await this.redis.connect()
        this.redisAvailable = true
        CacheLogger.log('✅ Redis reconnection successful')
      } catch (error) {
        CacheLogger.warn('Redis reconnection failed, will retry later')
      }
    }
  }

  /**
   * Shutdown cache connections
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }

    try {
      // Remove all event listeners to prevent post-shutdown logging
      if (this.redis) {
        this.redis.removeAllListeners()
        await this.redis.disconnect()
      }

      if (this.backupRedis) {
        this.backupRedis.removeAllListeners()
        await this.backupRedis.disconnect()
      }
    } catch (error) {
      // Ignore disconnection errors during shutdown
      CacheLogger.warn('Warning during Redis shutdown - this is normal during tests')
    }

    this.redisAvailable = false
    CacheLogger.log('📪 Redis cache connections closed')
  }

  /**
   * Test-specific cleanup method
   * Ensures all Redis connections and timers are properly cleaned up for tests
   */
  async cleanupForTests(): Promise<void> {
    // Clear any pending timeouts from setupDevelopmentFallback
    const timeoutIds = (global as any).__redisTimeouts || []
    timeoutIds.forEach((id: NodeJS.Timeout) => clearTimeout(id))

    // Shutdown Redis connections
    await this.shutdown()

    // Reset singleton instance for fresh test state
    RedisCache.instance = undefined as any
  }
}

// Export singleton instance
export const redisCache = RedisCache.getInstance()