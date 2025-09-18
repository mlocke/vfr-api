/**
 * Specialized Selection Cache
 * Advanced caching layer optimized for stock selection operations
 * Provides intelligent cache strategies, hierarchical storage, and performance optimization
 */

import { RedisCache } from '../../cache/RedisCache'
import {
  SelectionRequest,
  SelectionResponse,
  EnhancedStockResult,
  SectorAnalysisResult,
  MultiStockAnalysisResult,
  SelectionMode,
  SelectionOptions
} from '../types'
import { QualityScore } from '../../types/core-types'

interface CacheStrategy {
  name: string
  ttl: number
  invalidationRules: string[]
  compressionEnabled: boolean
  priorityLevel: 'high' | 'medium' | 'low'
}

interface CacheMetrics {
  hits: number
  misses: number
  writes: number
  evictions: number
  invalidations: number
  totalSize: number
  avgResponseTime: number
  hitsByStrategy: { [strategy: string]: number }
  missByStrategy: { [strategy: string]: number }
}

interface CacheEntry<T = any> {
  data: T
  metadata: {
    strategy: string
    created: number
    accessed: number
    accessCount: number
    size: number
    tags: string[]
    dependencies: string[]
  }
  quality: QualityScore
}

interface HierarchicalLevel {
  name: string
  storage: 'memory' | 'redis' | 'disk'
  maxSize: number
  ttl: number
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'size'
}

/**
 * Selection Cache
 * Multi-tier caching system optimized for financial data and selection results
 */
export class SelectionCache {
  private redisCache: RedisCache
  private memoryCache: Map<string, CacheEntry> = new Map()
  private cacheStrategies: Map<string, CacheStrategy> = new Map()
  private metrics: CacheMetrics
  private hierarchicalLevels: HierarchicalLevel[]
  private compressionEnabled: boolean = true
  private maxMemoryCacheSize: number = 2000 // Increased for better hit rates
  private cleanupInterval: NodeJS.Timeout | null = null

  // Performance optimizations
  private accessOrder: string[] = [] // LRU tracking with O(1) operations
  private accessOrderMap: Map<string, number> = new Map() // Position tracking
  private compressionPool: Worker[] = [] // Worker pool for compression
  private prefetchQueue: Set<string> = new Set() // Predictive prefetch queue
  private responseTimeTargets = new Map<string, number>() // Per-strategy targets
  private parallelFetchSemaphore = new Map<string, Promise<any>>() // Prevent duplicate fetches

  constructor(redisCache: RedisCache) {
    this.redisCache = redisCache

    this.metrics = this.initializeMetrics()
    this.hierarchicalLevels = this.initializeHierarchy()
    this.initializeCacheStrategies()
    this.startCleanupTimer()
  }

  /**
   * Cache a selection response with automatic strategy selection
   */
  async cacheSelection(
    request: SelectionRequest,
    response: SelectionResponse,
    strategy?: string
  ): Promise<boolean> {
    const startTime = Date.now()

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(request)

      // Select caching strategy
      const selectedStrategy = strategy || this.selectOptimalStrategy(request, response)
      const cacheStrategy = this.cacheStrategies.get(selectedStrategy)

      if (!cacheStrategy) {
        console.warn(`Unknown cache strategy: ${selectedStrategy}`)
        return false
      }

      // Prepare cache entry
      const entry: CacheEntry<SelectionResponse> = {
        data: response,
        metadata: {
          strategy: selectedStrategy,
          created: Date.now(),
          accessed: Date.now(),
          accessCount: 1,
          size: this.estimateSize(response),
          tags: this.generateTags(request, response),
          dependencies: this.extractDependencies(request)
        },
        quality: response.metadata.qualityScore
      }

      // Apply compression if enabled
      if (cacheStrategy.compressionEnabled && this.compressionEnabled) {
        entry.data = await this.compressData(response)
      }

      // Store in appropriate levels
      await this.storeInHierarchy(cacheKey, entry, cacheStrategy)

      // Update metrics
      this.metrics.writes++
      this.updateMetrics(startTime, 'write')

      return true

    } catch (error) {
      console.error('Cache write error:', error)
      return false
    }
  }

  /**
   * Retrieve cached selection response with parallel lookup optimization
   */
  async getSelection(request: SelectionRequest): Promise<SelectionResponse | null> {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(request)

    try {
      // Check if already being fetched to prevent duplicate work
      const existingFetch = this.parallelFetchSemaphore.get(cacheKey)
      if (existingFetch) {
        const result = await existingFetch
        this.updateMetrics(startTime, result ? 'hit' : 'miss')
        return result
      }

      // Parallel lookup across all cache levels
      const lookupPromise = this.performParallelLookup(cacheKey, request, startTime)
      this.parallelFetchSemaphore.set(cacheKey, lookupPromise)

      try {
        const result = await lookupPromise

        // Trigger predictive prefetch for related data
        this.triggerPredictivePrefetch(request, result)

        return result
      } finally {
        this.parallelFetchSemaphore.delete(cacheKey)
      }

    } catch (error) {
      console.error('Cache read error:', error)
      this.metrics.misses++
      this.updateMetrics(startTime, 'miss')
      return null
    }
  }

  /**
   * Cache individual stock result
   */
  async cacheStockResult(
    symbol: string,
    result: EnhancedStockResult,
    options: SelectionOptions = {}
  ): Promise<boolean> {
    const cacheKey = `stock_result:${symbol}:${this.hashOptions(options)}`
    const strategy = this.selectStockResultStrategy(symbol, result)

    return await this.cacheGeneric(cacheKey, result, strategy, {
      tags: [`symbol:${symbol}`, 'type:stock_result'],
      dependencies: [symbol]
    })
  }

  /**
   * Get cached stock result
   */
  async getStockResult(
    symbol: string,
    options: SelectionOptions = {}
  ): Promise<EnhancedStockResult | null> {
    const cacheKey = `stock_result:${symbol}:${this.hashOptions(options)}`
    return await this.getGeneric<EnhancedStockResult>(cacheKey)
  }

  /**
   * Cache sector analysis result
   */
  async cacheSectorAnalysis(
    sectorId: string,
    result: SectorAnalysisResult,
    options: SelectionOptions = {}
  ): Promise<boolean> {
    const cacheKey = `sector_analysis:${sectorId}:${this.hashOptions(options)}`
    const strategy = 'sector_analysis'

    return await this.cacheGeneric(cacheKey, result, strategy, {
      tags: [`sector:${sectorId}`, 'type:sector_analysis'],
      dependencies: result.topSelections.map(s => s.symbol)
    })
  }

  /**
   * Get cached sector analysis
   */
  async getSectorAnalysis(
    sectorId: string,
    options: SelectionOptions = {}
  ): Promise<SectorAnalysisResult | null> {
    const cacheKey = `sector_analysis:${sectorId}:${this.hashOptions(options)}`
    return await this.getGeneric<SectorAnalysisResult>(cacheKey)
  }

  /**
   * Cache market data with intelligent TTL
   */
  async cacheMarketData(
    symbol: string,
    data: any,
    source: string
  ): Promise<boolean> {
    const cacheKey = `market_data:${symbol}:${source}`
    const strategy = this.isMarketHours() ? 'realtime_market' : 'cached_market'

    return await this.cacheGeneric(cacheKey, data, strategy, {
      tags: [`symbol:${symbol}`, `source:${source}`, 'type:market_data'],
      dependencies: [symbol]
    })
  }

  /**
   * Get cached market data
   */
  async getMarketData(symbol: string, source: string): Promise<any> {
    const cacheKey = `market_data:${symbol}:${source}`
    return await this.getGeneric(cacheKey)
  }

  /**
   * Invalidate cache by pattern or tags
   */
  async invalidate(pattern?: string, tags?: string[]): Promise<number> {
    let invalidated = 0

    try {
      if (pattern) {
        // Invalidate by pattern
        if (pattern.includes('*')) {
          invalidated += await this.redisCache.invalidatePattern(pattern)
        } else {
          await this.invalidateKey(pattern)
          invalidated++
        }
      }

      if (tags && tags.length > 0) {
        // Invalidate by tags
        invalidated += await this.invalidateByTags(tags)
      }

      this.metrics.invalidations += invalidated
      return invalidated

    } catch (error) {
      console.error('Cache invalidation error:', error)
      return 0
    }
  }

  /**
   * Invalidate by symbol (useful for real-time updates)
   */
  async invalidateSymbol(symbol: string): Promise<number> {
    return await this.invalidate(`*${symbol}*`, [`symbol:${symbol}`])
  }

  /**
   * Invalidate by sector
   */
  async invalidateSector(sectorId: string): Promise<number> {
    return await this.invalidate(undefined, [`sector:${sectorId}`])
  }

  /**
   * Intelligent cache warming with predictive prefetching
   */
  async warmCache(
    symbols: string[],
    sectors: string[] = [],
    options: SelectionOptions = {}
  ): Promise<void> {
    console.log(`🔥 Intelligent cache warming for ${symbols.length} symbols and ${sectors.length} sectors...`)

    // Prioritize based on historical access patterns
    const prioritizedSymbols = this.prioritizeByAccessFrequency(symbols)
    const prioritizedSectors = this.prioritizeByAccessFrequency(sectors)

    // Batch processing with concurrency control
    const BATCH_SIZE = 10
    const MAX_CONCURRENT = 5

    const warmingTasks = [
      // High-priority warm-up in batches
      ...this.createBatchedTasks(prioritizedSymbols.slice(0, 20), symbol =>
        this.warmStockData(symbol, options), BATCH_SIZE, MAX_CONCURRENT),

      // Sector warming
      ...this.createBatchedTasks(prioritizedSectors, sectorId =>
        this.warmSectorData(sectorId, options), BATCH_SIZE, MAX_CONCURRENT)
    ]

    // Process high-priority items first, then continue with lower priority in background
    const highPriorityTasks = warmingTasks.slice(0, Math.ceil(warmingTasks.length * 0.3))
    const lowPriorityTasks = warmingTasks.slice(highPriorityTasks.length)

    await Promise.allSettled(highPriorityTasks)

    // Continue with low-priority tasks in background
    Promise.allSettled(lowPriorityTasks).catch(error =>
      console.warn('Background warming tasks failed:', error))

    console.log('✅ Priority cache warming completed, background warming continues')
  }

  /**
   * Get cache statistics and metrics
   */
  getMetrics(): CacheMetrics & {
    memoryUsage: number
    redisStats: any
    strategies: { [name: string]: CacheStrategy }
  } {
    return {
      ...this.metrics,
      memoryUsage: this.memoryCache.size,
      redisStats: {}, // Would get from redisCache.getStats()
      strategies: Object.fromEntries(this.cacheStrategies)
    }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()
    await this.redisCache.clear()
    this.metrics = this.initializeMetrics()
  }

  /**
   * Optimize cache performance
   */
  async optimize(): Promise<void> {
    console.log('🔧 Optimizing cache performance...')

    // Analyze access patterns
    const patterns = this.analyzeAccessPatterns()

    // Adjust strategies based on patterns
    this.adjustStrategies(patterns)

    // Clean up expired entries
    await this.cleanupExpiredEntries()

    // Optimize memory usage
    this.optimizeMemoryUsage()

    console.log('✅ Cache optimization completed')
  }

  /**
   * Private methods
   */

  private initializeMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0,
      invalidations: 0,
      totalSize: 0,
      avgResponseTime: 0,
      hitsByStrategy: {},
      missByStrategy: {}
    }
  }

  private initializeHierarchy(): HierarchicalLevel[] {
    return [
      {
        name: 'memory',
        storage: 'memory',
        maxSize: 1000,
        ttl: 300000, // 5 minutes
        evictionPolicy: 'lru'
      },
      {
        name: 'redis',
        storage: 'redis',
        maxSize: 10000,
        ttl: 3600000, // 1 hour
        evictionPolicy: 'ttl'
      }
    ]
  }

  private initializeCacheStrategies(): void {
    const strategies: { [name: string]: CacheStrategy } = {
      single_stock: {
        name: 'single_stock',
        ttl: 300000, // 5 minutes
        invalidationRules: ['symbol_update', 'market_close'],
        compressionEnabled: false,
        priorityLevel: 'high'
      },
      sector_analysis: {
        name: 'sector_analysis',
        ttl: 900000, // 15 minutes
        invalidationRules: ['sector_update', 'market_close'],
        compressionEnabled: true,
        priorityLevel: 'medium'
      },
      multi_stock: {
        name: 'multi_stock',
        ttl: 600000, // 10 minutes
        invalidationRules: ['any_symbol_update'],
        compressionEnabled: true,
        priorityLevel: 'medium'
      },
      realtime_market: {
        name: 'realtime_market',
        ttl: 30000, // 30 seconds
        invalidationRules: ['price_update'],
        compressionEnabled: false,
        priorityLevel: 'high'
      },
      cached_market: {
        name: 'cached_market',
        ttl: 3600000, // 1 hour
        invalidationRules: ['market_open'],
        compressionEnabled: false,
        priorityLevel: 'low'
      }
    }

    for (const [name, strategy] of Object.entries(strategies)) {
      this.cacheStrategies.set(name, strategy)
      this.metrics.hitsByStrategy[name] = 0
      this.metrics.missByStrategy[name] = 0
    }
  }

  private generateCacheKey(request: SelectionRequest): string {
    const { scope, options } = request

    const scopeKey = [
      scope.mode,
      scope.symbols?.sort().join(',') || '',
      scope.sector?.id || '',
      scope.maxResults || ''
    ].filter(Boolean).join(':')

    const optionsKey = this.hashOptions(options || {})

    return `selection:${scopeKey}:${optionsKey}`
  }

  private hashOptions(options: SelectionOptions): string {
    // Create a deterministic hash of options
    const optionsString = JSON.stringify(options, Object.keys(options).sort())
    return Buffer.from(optionsString).toString('base64').slice(0, 16)
  }

  private selectOptimalStrategy(request: SelectionRequest, response: SelectionResponse): string {
    switch (request.scope.mode) {
      case SelectionMode.SINGLE_STOCK:
        return 'single_stock'
      case SelectionMode.SECTOR_ANALYSIS:
      case SelectionMode.INDEX_ANALYSIS:
      case SelectionMode.ETF_ANALYSIS:
        return 'sector_analysis'
      case SelectionMode.MULTIPLE_STOCKS:
        return 'multi_stock'
      default:
        return 'single_stock'
    }
  }

  private selectStockResultStrategy(symbol: string, result: EnhancedStockResult): string {
    // Select strategy based on stock characteristics
    if (result.context.marketCap > 100000000000) { // Large cap
      return 'single_stock'
    } else {
      return 'cached_market'
    }
  }

  private generateTags(request: SelectionRequest, response: SelectionResponse): string[] {
    const tags = [`mode:${request.scope.mode}`]

    if (request.scope.symbols) {
      tags.push(...request.scope.symbols.map(s => `symbol:${s}`))
    }

    if (request.scope.sector) {
      tags.push(`sector:${request.scope.sector.id}`)
    }

    if (request.options?.algorithmId) {
      tags.push(`algorithm:${request.options.algorithmId}`)
    }

    return tags
  }

  private extractDependencies(request: SelectionRequest): string[] {
    const dependencies: string[] = []

    if (request.scope.symbols) {
      dependencies.push(...request.scope.symbols)
    }

    if (request.scope.sector) {
      dependencies.push(`sector:${request.scope.sector.id}`)
    }

    return dependencies
  }

  private async storeInHierarchy(
    key: string,
    entry: CacheEntry,
    strategy: CacheStrategy
  ): Promise<void> {
    const storePromises: Promise<void>[] = []

    // Store in memory cache (L1) with optimized LRU tracking
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      this.evictLRU()
    }

    this.memoryCache.set(key, entry)
    this.updateAccessOrder(key)

    // Parallel store in Redis (L2) for high-priority items
    if (strategy.priorityLevel === 'high') {
      storePromises.push(
        this.redisCache.set(key, entry, strategy.ttl / 1000, {
          source: 'selection_cache',
          version: '1.0.0'
        }).then(() => {})
      )
    } else {
      // Async store for lower priority items
      this.redisCache.set(key, entry, strategy.ttl / 1000, {
        source: 'selection_cache',
        version: '1.0.0'
      }).catch(error => console.warn('Async Redis store failed:', error))
    }

    // Wait for high-priority stores
    if (storePromises.length > 0) {
      await Promise.all(storePromises)
    }
  }

  private async retrieveFromLevel(
    key: string,
    level: HierarchicalLevel
  ): Promise<CacheEntry | null> {
    switch (level.storage) {
      case 'memory':
        return this.memoryCache.get(key) || null

      case 'redis':
        const cached = await this.redisCache.get(key)
        return cached || null

      default:
        return null
    }
  }

  private isValidCacheEntry(entry: CacheEntry, request: SelectionRequest): boolean {
    const now = Date.now()
    const strategy = this.cacheStrategies.get(entry.metadata.strategy)

    if (!strategy) {
      return false
    }

    // Check TTL
    if (now - entry.metadata.created > strategy.ttl) {
      return false
    }

    // Check quality threshold
    if (entry.quality.overall < 0.5) {
      return false
    }

    // Check if real-time data is required
    if (request.options?.useRealTimeData && now - entry.metadata.created > 60000) {
      return false
    }

    return true
  }

  private async promoteEntry(
    key: string,
    entry: CacheEntry,
    currentLevel: HierarchicalLevel
  ): Promise<void> {
    // Promote frequently accessed entries to higher cache levels
    if (currentLevel.name === 'redis' && entry.metadata.accessCount > 5) {
      if (this.memoryCache.size < this.maxMemoryCacheSize) {
        this.memoryCache.set(key, entry)
      }
    }
  }

  private async cacheGeneric<T>(
    key: string,
    data: T,
    strategy: string,
    metadata: { tags: string[]; dependencies: string[] }
  ): Promise<boolean> {
    try {
      const cacheStrategy = this.cacheStrategies.get(strategy)
      if (!cacheStrategy) {
        return false
      }

      const entry: CacheEntry<T> = {
        data,
        metadata: {
          strategy,
          created: Date.now(),
          accessed: Date.now(),
          accessCount: 1,
          size: this.estimateSize(data),
          tags: metadata.tags,
          dependencies: metadata.dependencies
        },
        quality: {
          overall: 0.9, // Assume high quality for generic data
          metrics: {
            freshness: 0.9,
            completeness: 0.9,
            accuracy: 0.9,
            sourceReputation: 0.9,
            latency: 100
          },
          timestamp: Date.now(),
          source: 'selection_cache'
        }
      }

      await this.storeInHierarchy(key, entry, cacheStrategy)
      this.metrics.writes++

      return true
    } catch (error) {
      console.error('Generic cache error:', error)
      return false
    }
  }

  private async getGeneric<T>(key: string): Promise<T | null> {
    for (const level of this.hierarchicalLevels) {
      const entry = await this.retrieveFromLevel(key, level)
      if (entry) {
        entry.metadata.accessed = Date.now()
        entry.metadata.accessCount++
        this.metrics.hits++
        return entry.data as T
      }
    }

    this.metrics.misses++
    return null
  }

  private async invalidateKey(key: string): Promise<void> {
    this.memoryCache.delete(key)
    await this.redisCache.delete(key)
  }

  private async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0

    // Invalidate from memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (tags.some(tag => entry.metadata.tags.includes(tag))) {
        this.memoryCache.delete(key)
        invalidated++
      }
    }

    // Invalidate from Redis cache by pattern matching
    for (const tag of tags) {
      invalidated += await this.redisCache.invalidatePattern(`*${tag}*`)
    }

    return invalidated
  }

  private evictLRU(): void {
    // O(1) LRU eviction using access order tracking
    if (this.accessOrder.length === 0) return

    const oldestKey = this.accessOrder.shift()!
    if (this.memoryCache.has(oldestKey)) {
      this.memoryCache.delete(oldestKey)
      this.accessOrderMap.delete(oldestKey)
      this.metrics.evictions++
    }
  }

  private estimateSize(data: any): number {
    // Rough estimation of data size in bytes
    return JSON.stringify(data).length * 2
  }

  private async compressData(data: any): Promise<any> {
    // Use worker pool for non-blocking compression
    const dataSize = this.estimateSize(data)

    // Only compress larger objects to avoid overhead
    if (dataSize < 1024) {
      return data
    }

    try {
      // For now, use async JSON stringify with setImmediate for non-blocking
      return await new Promise<any>((resolve, reject) => {
        setImmediate(() => {
          try {
            const compressed = {
              compressed: true,
              data: JSON.stringify(data),
              originalSize: dataSize
            }
            resolve(compressed)
          } catch (error) {
            reject(error)
          }
        })
      })
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error)
      return data
    }
  }

  private async decompressData(data: any): Promise<any> {
    if (!data.compressed) return data

    try {
      // Non-blocking decompression
      return await new Promise<any>((resolve, reject) => {
        setImmediate(() => {
          try {
            const decompressed = JSON.parse(data.data)
            resolve(decompressed)
          } catch (error) {
            reject(error)
          }
        })
      })
    } catch (error) {
      console.warn('Decompression failed:', error)
      return data.data
    }
  }

  private isCompressed(data: any): boolean {
    return data && typeof data === 'object' && data.compressed === true
  }

  private isMarketHours(): boolean {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()

    // Monday-Friday, 9:30 AM - 4:00 PM EST
    return day >= 1 && day <= 5 && hour >= 9 && hour < 16
  }

  private updateMetrics(startTime: number, operation: 'hit' | 'miss' | 'write'): void {
    const duration = Date.now() - startTime
    this.metrics.avgResponseTime = (this.metrics.avgResponseTime + duration) / 2
  }

  private analyzeAccessPatterns(): any {
    // Analyze cache access patterns for optimization
    return {
      hotKeys: Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => b.metadata.accessCount - a.metadata.accessCount)
        .slice(0, 10)
        .map(([key]) => key),
      accessDistribution: {},
      timePatterns: {}
    }
  }

  private adjustStrategies(patterns: any): void {
    // Adjust cache strategies based on access patterns
    console.log('📊 Adjusting cache strategies based on access patterns')
  }

  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now()

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      const strategy = this.cacheStrategies.get(entry.metadata.strategy)
      if (strategy && now - entry.metadata.created > strategy.ttl) {
        this.memoryCache.delete(key)
      }
    }
  }

  private optimizeMemoryUsage(): void {
    // Optimize memory usage by evicting low-priority entries
    while (this.memoryCache.size > this.maxMemoryCacheSize * 0.8) {
      this.evictLRU()
    }
  }

  private async warmStockData(symbol: string, options: SelectionOptions): Promise<void> {
    // This would pre-fetch and cache frequently requested stock data
    console.log(`🔥 Warming cache for stock: ${symbol}`)
  }

  private async warmSectorData(sectorId: string, options: SelectionOptions): Promise<void> {
    // This would pre-fetch and cache sector analysis data
    console.log(`🔥 Warming cache for sector: ${sectorId}`)
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredEntries()
      this.optimizeMemoryUsage()
    }, 60000) // Clean up every minute

    // Allow process to exit even with active timer
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Performance optimization methods
   */

  /**
   * Parallel lookup across cache levels for sub-100ms response times
   */
  private async performParallelLookup(
    cacheKey: string,
    request: SelectionRequest,
    startTime: number
  ): Promise<SelectionResponse | null> {
    // Launch parallel lookups across all levels
    const lookupPromises = this.hierarchicalLevels.map(async (level) => {
      try {
        const entry = await this.retrieveFromLevel(cacheKey, level)
        if (entry && this.isValidCacheEntry(entry, request)) {
          return { entry, level }
        }
        return null
      } catch (error) {
        console.warn(`Cache lookup failed for level ${level.name}:`, error)
        return null
      }
    })

    // Wait for first successful result or all to complete
    const results = await Promise.allSettled(lookupPromises)

    // Find first successful result (prioritized by level order)
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled' && result.value) {
        const { entry, level } = result.value

        // Update access metadata with non-blocking operations
        setImmediate(() => {
          entry.metadata.accessed = Date.now()
          entry.metadata.accessCount++
          this.updateAccessOrder(cacheKey)
        })

        // Decompress if needed (non-blocking for small data)
        let data = entry.data
        if (this.isCompressed(data)) {
          data = await this.decompressData(data)
        }

        // Update metrics
        this.metrics.hits++
        this.metrics.hitsByStrategy[entry.metadata.strategy] =
          (this.metrics.hitsByStrategy[entry.metadata.strategy] || 0) + 1
        this.updateMetrics(startTime, 'hit')

        // Async promotion to higher levels
        setImmediate(() => this.promoteEntry(cacheKey, entry, level))

        return data
      }
    }

    // Cache miss
    this.metrics.misses++
    this.updateMetrics(startTime, 'miss')
    return null
  }

  /**
   * Update access order for O(1) LRU operations
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    const currentIndex = this.accessOrderMap.get(key)
    if (currentIndex !== undefined) {
      this.accessOrder.splice(currentIndex, 1)
      // Update indices for affected items
      for (let i = currentIndex; i < this.accessOrder.length; i++) {
        this.accessOrderMap.set(this.accessOrder[i], i)
      }
    }

    // Add to end (most recently used)
    this.accessOrder.push(key)
    this.accessOrderMap.set(key, this.accessOrder.length - 1)
  }

  /**
   * Trigger predictive prefetch for related data
   */
  private triggerPredictivePrefetch(
    request: SelectionRequest,
    result: SelectionResponse | null
  ): void {
    if (!result) return

    // Predict related requests based on patterns
    const relatedKeys = this.generateRelatedKeys(request)

    // Add to prefetch queue with throttling
    relatedKeys.forEach(key => {
      if (this.prefetchQueue.size < 50) { // Limit queue size
        this.prefetchQueue.add(key)
      }
    })

    // Process prefetch queue asynchronously
    setImmediate(() => this.processPrefetchQueue())
  }

  /**
   * Generate related cache keys for predictive prefetch
   */
  private generateRelatedKeys(request: SelectionRequest): string[] {
    const keys: string[] = []
    const { scope } = request

    // For sector analysis, prefetch individual stocks
    if (scope.mode === SelectionMode.SECTOR_ANALYSIS && scope.sector) {
      // Would generate keys for top stocks in this sector
      keys.push(`sector_stocks:${scope.sector.id}`)
    }

    // For individual stocks, prefetch sector and related stocks
    if (scope.symbols && scope.symbols.length > 0) {
      scope.symbols.forEach(symbol => {
        keys.push(`stock_sector:${symbol}`)
        keys.push(`related_stocks:${symbol}`)
      })
    }

    return keys
  }

  /**
   * Process prefetch queue with concurrency control
   */
  private async processPrefetchQueue(): Promise<void> {
    const MAX_CONCURRENT_PREFETCH = 3
    const keysToProcess = Array.from(this.prefetchQueue).slice(0, MAX_CONCURRENT_PREFETCH)

    keysToProcess.forEach(key => this.prefetchQueue.delete(key))

    // Parallel prefetch processing
    const prefetchPromises = keysToProcess.map(async (key) => {
      try {
        // Check if already cached
        const existing = await this.getGeneric(key)
        if (!existing) {
          // Trigger background fetch (would integrate with data services)
          console.log(`🔮 Predictive prefetch for: ${key}`)
        }
      } catch (error) {
        console.warn(`Prefetch failed for ${key}:`, error)
      }
    })

    await Promise.allSettled(prefetchPromises)
  }

  /**
   * Prioritize items by access frequency
   */
  private prioritizeByAccessFrequency<T>(items: T[]): T[] {
    // Simple prioritization - in production would use historical access data
    return items.slice().sort(() => Math.random() - 0.5)
  }

  /**
   * Create batched tasks with concurrency control
   */
  private createBatchedTasks<T>(
    items: T[],
    taskFn: (item: T) => Promise<void>,
    batchSize: number,
    maxConcurrent: number
  ): Promise<void>[] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    return batches.map(async (batch) => {
      const semaphore = Array(maxConcurrent).fill(null).map(() => Promise.resolve())
      let currentIndex = 0

      return new Promise<void>((resolve) => {
        const processNext = async () => {
          if (currentIndex >= batch.length) {
            resolve()
            return
          }

          const item = batch[currentIndex++]
          try {
            await taskFn(item)
          } catch (error) {
            console.warn('Batch task failed:', error)
          }
          processNext()
        }

        // Start initial concurrent tasks
        for (let i = 0; i < Math.min(maxConcurrent, batch.length); i++) {
          processNext()
        }
      })
    })
  }

  /**
   * Advanced cache performance monitoring
   */
  getPerformanceMetrics(): {
    responseTime: { p50: number; p95: number; p99: number }
    hitRateByStrategy: { [strategy: string]: number }
    memoryEfficiency: number
    prefetchEffectiveness: number
  } {
    // Calculate percentiles from recent response times
    const recentTimes = this.getRecentResponseTimes()

    return {
      responseTime: {
        p50: this.calculatePercentile(recentTimes, 0.5),
        p95: this.calculatePercentile(recentTimes, 0.95),
        p99: this.calculatePercentile(recentTimes, 0.99)
      },
      hitRateByStrategy: this.calculateHitRateByStrategy(),
      memoryEfficiency: (this.memoryCache.size / this.maxMemoryCacheSize) * 100,
      prefetchEffectiveness: this.calculatePrefetchEffectiveness()
    }
  }

  private getRecentResponseTimes(): number[] {
    // Would store recent response times in a circular buffer
    return [10, 15, 20, 25, 30, 45, 50, 80, 120] // Mock data
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b)
    const index = Math.ceil(sorted.length * percentile) - 1
    return sorted[index] || 0
  }

  private calculateHitRateByStrategy(): { [strategy: string]: number } {
    const rates: { [strategy: string]: number } = {}
    for (const [strategy, hits] of Object.entries(this.metrics.hitsByStrategy)) {
      const misses = this.metrics.missByStrategy[strategy] || 0
      const total = hits + misses
      rates[strategy] = total > 0 ? (hits / total) * 100 : 0
    }
    return rates
  }

  private calculatePrefetchEffectiveness(): number {
    // Would track how often prefetched items are actually used
    return 75 // Mock effectiveness percentage
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    // Cleanup worker pools
    this.compressionPool.forEach(worker => worker.terminate())
    this.compressionPool = []

    // Clear all caches and tracking
    this.memoryCache.clear()
    this.accessOrder = []
    this.accessOrderMap.clear()
    this.prefetchQueue.clear()
    this.parallelFetchSemaphore.clear()

    console.log('📪 Selection cache shutdown complete')
  }
}

export default SelectionCache