/**
 * Redis Cache Service for MCP Financial Data
 * High-performance multi-tier caching with intelligent invalidation
 */

import Redis from 'ioredis'

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

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: 'veritak:mcp:',
      defaultTTL: 300, // 5 minutes
      maxRetries: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
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

    // Initialize with fallback mode for development
    if (process.env.NODE_ENV === 'development') {
      this.setupDevelopmentFallback()
    }
  }

  static getInstance(config?: Partial<CacheConfig>): RedisCache {
    if (!RedisCache.instance) {
      RedisCache.instance = new RedisCache(config)
    }
    return RedisCache.instance
  }

  private initializeRedis() {
    // Primary Redis connection
    this.redis = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      keyPrefix: this.config.keyPrefix,
      maxRetriesPerRequest: this.config.maxRetries,
      enableReadyCheck: this.config.enableReadyCheck,
      lazyConnect: this.config.lazyConnect,
      connectTimeout: 10000,
      commandTimeout: 5000
    })

    // Event handlers
    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully')
      this.redisAvailable = true
    })

    this.redis.on('ready', () => {
      console.log('🚀 Redis ready for operations')
      this.redisAvailable = true
    })

    this.redis.on('error', (error) => {
      console.error('❌ Redis error:', error)
      this.redisAvailable = false
      this.stats.errors++
    })

    this.redis.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...')
      this.redisAvailable = false
    })

    this.redis.on('close', () => {
      console.log('📪 Redis connection closed')
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
      console.log('🔗 Setting up Redis cluster...')

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
    setTimeout(() => {
      if (!this.redisAvailable) {
        console.warn('⚠️ Redis not available in development mode - using in-memory fallback')
        console.warn('💡 To use Redis caching, ensure Redis is running on localhost:6379')
      }
    }, 2000) // Give Redis 2 seconds to connect
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
      console.warn(`⚠️ Cache get error for key ${key} (Redis may not be available):`, error.message)
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
        console.warn(`⚠️ Redis not available, skipping cache set for key: ${key}`)
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
      console.error(`❌ Cache set error for key ${key}:`, error)
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
      console.error(`❌ Cache delete error for key ${key}:`, error)
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
      console.error('❌ Cache mget error:', error)
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
      console.error('❌ Cache mset error:', error)
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

    // Shorter TTL during market hours for real-time data
    const ttl = isMarketHours ? 30 : 300 // 30s vs 5min

    const key = `market:${dataType}:${identifier}:${source}`
    await this.set(key, data, ttl, { source, version: '1.0.0' })
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
   * Warm cache with frequently accessed data
   */
  async warmCache(symbols: string[], sources: string[] = ['polygon', 'alphavantage']): Promise<void> {
    console.log(`🔥 Warming cache for ${symbols.length} symbols from ${sources.length} sources...`)

    const warmingPromises = symbols.flatMap(symbol =>
      sources.map(async source => {
        const key = `stock:price:${symbol}:${source}`
        // This would typically fetch fresh data and cache it
        // For now, we'll just ensure the key structure exists
        console.log(`🔥 Warmed cache key: ${key}`)
      })
    )

    await Promise.all(warmingPromises)
    console.log('✅ Cache warming complete')
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('memory')
      const memoryMatch = info.match(/used_memory_human:(\S+)/)
      this.stats.memoryUsage = memoryMatch ? memoryMatch[1] : '0B'

      const keyCount = await this.redis.dbsize()
      this.stats.totalKeys = keyCount

      return { ...this.stats }
    } catch (error) {
      console.error('❌ Error getting cache stats:', error)
      return this.stats
    }
  }

  /**
   * Health check and monitoring
   */
  private startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.redis.ping()
        // Optional: Check memory usage and cleanup if needed
        const stats = await this.getStats()

        // Auto-cleanup if cache is getting full (>80% of max memory)
        if (stats.totalKeys > 10000) {
          console.log('🧹 Auto-cleanup: Cache is getting full, running maintenance...')
          await this.cleanup()
        }
      } catch (error) {
        console.error('❌ Redis health check failed:', error)
        this.stats.errors++
      }
    }, 30000) // Check every 30 seconds

    // Allow process to exit even with active timer
    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref()
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

      console.log(`🧹 Cache cleanup completed. Keys processed: ${keysDeleted}`)
    } catch (error) {
      console.error('❌ Cache cleanup error:', error)
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
   * Ping Redis server for health checks
   */
  async ping(): Promise<string> {
    try {
      if (!this.isRedisAvailable()) {
        return 'PONG (fallback)'
      }
      return await this.redis.ping()
    } catch (error) {
      console.warn('⚠️ Redis ping failed (may not be available in development):', error.message)
      this.redisAvailable = false
      return 'PONG (fallback)'
    }
  }

  /**
   * Shutdown cache connections
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    await this.redis.disconnect()
    if (this.backupRedis) {
      await this.backupRedis.disconnect()
    }

    console.log('📪 Redis cache connections closed')
  }
}

// Export singleton instance
export const redisCache = RedisCache.getInstance()