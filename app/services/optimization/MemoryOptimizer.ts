/**
 * Memory Optimizer for Stock Selection System
 * Implements garbage collection optimization, object pooling, and memory leak prevention
 * Targets sub-100ms response times through efficient memory management
 */

interface MemoryMetrics {
  heapUsed: number
  heapTotal: number
  external: number
  arrayBuffers: number
  rss: number
  utilization: number
}

interface ObjectPool<T> {
  acquire(): T
  release(obj: T): void
  size(): number
  clear(): void
}

/**
 * Generic Object Pool Implementation
 */
class GenericObjectPool<T> implements ObjectPool<T> {
  private pool: T[] = []
  private maxSize: number
  private factory: () => T
  private reset?: (obj: T) => void

  constructor(
    factory: () => T,
    maxSize: number = 100,
    reset?: (obj: T) => void
  ) {
    this.factory = factory
    this.maxSize = maxSize
    this.reset = reset

    // Pre-populate pool
    for (let i = 0; i < Math.min(10, maxSize); i++) {
      this.pool.push(factory())
    }
  }

  acquire(): T {
    const obj = this.pool.pop() || this.factory()
    return obj
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      if (this.reset) {
        this.reset(obj)
      }
      this.pool.push(obj)
    }
  }

  size(): number {
    return this.pool.length
  }

  clear(): void {
    this.pool.length = 0
  }
}

/**
 * Memory Optimizer with intelligent GC management
 */
export class MemoryOptimizer {
  private static instance: MemoryOptimizer
  private gcInterval: NodeJS.Timeout | null = null
  private memoryCheckInterval: NodeJS.Timeout | null = null
  private objectPools = new Map<string, ObjectPool<any>>()
  private memoryMetrics: MemoryMetrics[] = []
  private gcThreshold = 0.85 // 85% heap utilization
  private forceGcThreshold = 0.95 // 95% heap utilization
  private lastGcTime = 0
  private gcCooldown = 30000 // 30 seconds between forced GCs

  // Pre-configured object pools for common types
  private responsePool: ObjectPool<any>
  private requestPool: ObjectPool<any>
  private arrayPool: ObjectPool<any[]>
  private mapPool: ObjectPool<Map<string, any>>

  private constructor() {
    this.initializeObjectPools()
    this.startMemoryMonitoring()
  }

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer()
    }
    return MemoryOptimizer.instance
  }

  /**
   * Initialize commonly used object pools
   */
  private initializeObjectPools(): void {
    // Response object pool
    this.responsePool = new GenericObjectPool(
      () => ({
        success: false,
        data: null,
        timestamp: 0,
        metadata: {}
      }),
      50,
      (obj) => {
        obj.success = false
        obj.data = null
        obj.timestamp = 0
        obj.metadata = {}
      }
    )

    // Request object pool
    this.requestPool = new GenericObjectPool(
      () => ({
        id: '',
        timestamp: 0,
        data: null,
        options: {}
      }),
      30,
      (obj) => {
        obj.id = ''
        obj.timestamp = 0
        obj.data = null
        obj.options = {}
      }
    )

    // Array pool for reducing array allocations
    this.arrayPool = new GenericObjectPool(
      () => [],
      100,
      (arr) => arr.length = 0
    )

    // Map pool for temporary key-value storage
    this.mapPool = new GenericObjectPool(
      () => new Map<string, any>(),
      50,
      (map) => map.clear()
    )

    // Register pools
    this.objectPools.set('response', this.responsePool)
    this.objectPools.set('request', this.requestPool)
    this.objectPools.set('array', this.arrayPool)
    this.objectPools.set('map', this.mapPool)
  }

  /**
   * Get object from pool
   */
  acquire<T>(poolName: string): T {
    const pool = this.objectPools.get(poolName)
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`)
    }
    return pool.acquire()
  }

  /**
   * Return object to pool
   */
  release(poolName: string, obj: any): void {
    const pool = this.objectPools.get(poolName)
    if (pool) {
      pool.release(obj)
    }
  }

  /**
   * Create and register a custom object pool
   */
  createPool<T>(
    name: string,
    factory: () => T,
    maxSize: number = 50,
    reset?: (obj: T) => void
  ): ObjectPool<T> {
    const pool = new GenericObjectPool(factory, maxSize, reset)
    this.objectPools.set(name, pool)
    return pool
  }

  /**
   * Get current memory metrics
   */
  getMemoryMetrics(): MemoryMetrics {
    const mem = process.memoryUsage()
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers || 0,
      rss: mem.rss,
      utilization: (mem.heapUsed / mem.heapTotal) * 100
    }
  }

  /**
   * Get memory trend analysis
   */
  getMemoryTrend(): {
    trend: 'stable' | 'increasing' | 'decreasing'
    utilizationChange: number
    recommendation: string
  } {
    if (this.memoryMetrics.length < 2) {
      return {
        trend: 'stable',
        utilizationChange: 0,
        recommendation: 'Insufficient data for analysis'
      }
    }

    const current = this.memoryMetrics[this.memoryMetrics.length - 1]
    const previous = this.memoryMetrics[this.memoryMetrics.length - 2]
    const utilizationChange = current.utilization - previous.utilization

    let trend: 'stable' | 'increasing' | 'decreasing' = 'stable'
    if (utilizationChange > 5) {
      trend = 'increasing'
    } else if (utilizationChange < -5) {
      trend = 'decreasing'
    }

    let recommendation = 'Memory usage is stable'
    if (trend === 'increasing' && current.utilization > 80) {
      recommendation = 'Consider triggering garbage collection or optimizing memory usage'
    } else if (trend === 'decreasing') {
      recommendation = 'Memory optimization is working well'
    }

    return {
      trend,
      utilizationChange,
      recommendation
    }
  }

  /**
   * Optimize memory usage immediately
   */
  optimizeMemory(): Promise<void> {
    return new Promise((resolve) => {
      const startMetrics = this.getMemoryMetrics()

      // Clear object pools if they're getting large
      this.objectPools.forEach((pool, name) => {
        if (pool.size() > 50) {
          console.log(`🧹 Clearing large object pool: ${name}`)
          pool.clear()
        }
      })

      // Force garbage collection if available and threshold is met
      if (startMetrics.utilization > this.gcThreshold * 100) {
        this.forceGarbageCollection()
      }

      // Use setImmediate to allow GC to complete
      setImmediate(() => {
        const endMetrics = this.getMemoryMetrics()
        const saved = startMetrics.heapUsed - endMetrics.heapUsed

        if (saved > 0) {
          console.log(`🎯 Memory optimization freed ${(saved / 1024 / 1024).toFixed(2)}MB`)
        }

        resolve()
      })
    })
  }

  /**
   * Force garbage collection with throttling
   */
  forceGarbageCollection(): void {
    const now = Date.now()

    if (now - this.lastGcTime < this.gcCooldown) {
      console.log('⏳ GC cooldown in effect, skipping forced collection')
      return
    }

    if (global.gc) {
      const beforeGc = this.getMemoryMetrics()

      if (beforeGc.utilization > this.forceGcThreshold * 100) {
        console.log(`🗑️ Forcing garbage collection (utilization: ${beforeGc.utilization.toFixed(1)}%)`)

        const start = process.hrtime()
        global.gc()
        const [seconds, nanoseconds] = process.hrtime(start)
        const gcTime = (seconds * 1000) + (nanoseconds / 1000000)

        const afterGc = this.getMemoryMetrics()
        const freed = beforeGc.heapUsed - afterGc.heapUsed

        console.log(`✅ GC completed in ${gcTime.toFixed(2)}ms, freed ${(freed / 1024 / 1024).toFixed(2)}MB`)

        this.lastGcTime = now
      }
    } else {
      console.warn('⚠️ Garbage collection not available (use --expose-gc flag)')
    }
  }

  /**
   * Start continuous memory monitoring
   */
  private startMemoryMonitoring(): void {
    // Collect metrics every 10 seconds
    this.memoryCheckInterval = setInterval(() => {
      const metrics = this.getMemoryMetrics()
      this.memoryMetrics.push(metrics)

      // Keep only last 100 measurements (~16 minutes)
      if (this.memoryMetrics.length > 100) {
        this.memoryMetrics.shift()
      }

      // Auto-optimize if memory usage is high
      if (metrics.utilization > this.gcThreshold * 100) {
        console.log(`⚠️ High memory usage detected: ${metrics.utilization.toFixed(1)}%`)
        setImmediate(() => this.optimizeMemory())
      }

    }, 10000)

    // More aggressive optimization every 30 seconds
    this.gcInterval = setInterval(() => {
      const metrics = this.getMemoryMetrics()

      if (metrics.utilization > 70) {
        this.optimizeMemory()
      }

    }, 30000)

    console.log('🔍 Memory monitoring started')
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval)
      this.memoryCheckInterval = null
    }

    if (this.gcInterval) {
      clearInterval(this.gcInterval)
      this.gcInterval = null
    }

    console.log('📪 Memory monitoring stopped')
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): { [poolName: string]: number } {
    const stats: { [poolName: string]: number } = {}

    this.objectPools.forEach((pool, name) => {
      stats[name] = pool.size()
    })

    return stats
  }

  /**
   * Memory-efficient array operations
   */
  createArray<T>(): T[] {
    return this.arrayPool.acquire() as T[]
  }

  releaseArray<T>(arr: T[]): void {
    this.arrayPool.release(arr)
  }

  /**
   * Memory-efficient map operations
   */
  createMap<K extends string, V>(): Map<K, V> {
    return this.mapPool.acquire() as Map<K, V>
  }

  releaseMap<K extends string, V>(map: Map<K, V>): void {
    this.mapPool.release(map)
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.stopMonitoring()

    // Clear all pools
    this.objectPools.forEach((pool) => {
      pool.clear()
    })

    this.objectPools.clear()
    this.memoryMetrics.length = 0

    console.log('🧹 Memory optimizer cleanup completed')
  }
}

// Singleton instance
export const memoryOptimizer = MemoryOptimizer.getInstance()

// Helper functions for easy access
export const acquireObject = <T>(poolName: string): T => memoryOptimizer.acquire<T>(poolName)
export const releaseObject = (poolName: string, obj: any): void => memoryOptimizer.release(poolName, obj)
export const optimizeMemoryNow = (): Promise<void> => memoryOptimizer.optimizeMemory()
export const getMemoryStats = () => memoryOptimizer.getMemoryMetrics()

export default MemoryOptimizer