/**
 * Performance Testing Utilities
 * Shared utilities for measuring and monitoring performance across tests
 */

export interface PerformanceMetrics {
  startTime: number
  endTime: number
  duration: number
  memoryUsage: {
    before: NodeJS.MemoryUsage
    after: NodeJS.MemoryUsage
    delta: Partial<NodeJS.MemoryUsage>
  }
}

export interface CacheMetrics {
  hits: number
  misses: number
  hitRate: number
  totalRequests: number
}

export interface PerformanceBenchmark {
  name: string
  targetMs: number
  actualMs: number
  passed: boolean
  memoryUsageMB: number
}

export interface PerformanceReport {
  testSuite: string
  timestamp: number
  overallPassed: boolean
  benchmarks: PerformanceBenchmark[]
  summary: {
    avgResponseTime: number
    maxResponseTime: number
    memoryEfficiency: number
    cachePerformance: CacheMetrics
  }
}

/**
 * Start performance monitoring for a test
 */
export function startPerformanceMonitoring(): PerformanceMetrics {
  const memoryBefore = process.memoryUsage()
  return {
    startTime: Date.now(),
    endTime: 0,
    duration: 0,
    memoryUsage: {
      before: memoryBefore,
      after: memoryBefore,
      delta: {}
    }
  }
}

/**
 * End performance monitoring and calculate metrics
 */
export function endPerformanceMonitoring(metrics: PerformanceMetrics): PerformanceMetrics {
  const memoryAfter = process.memoryUsage()
  metrics.endTime = Date.now()
  metrics.duration = metrics.endTime - metrics.startTime
  metrics.memoryUsage.after = memoryAfter
  metrics.memoryUsage.delta = {
    rss: memoryAfter.rss - metrics.memoryUsage.before.rss,
    heapUsed: memoryAfter.heapUsed - metrics.memoryUsage.before.heapUsed,
    heapTotal: memoryAfter.heapTotal - metrics.memoryUsage.before.heapTotal,
    external: memoryAfter.external - metrics.memoryUsage.before.external
  }
  return metrics
}

/**
 * Create a cache metrics tracker
 */
export function createCacheMetricsTracker(): CacheMetrics {
  return {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalRequests: 0
  }
}

/**
 * Update cache metrics with a hit or miss
 */
export function updateCacheMetrics(metrics: CacheMetrics, isHit: boolean): void {
  if (isHit) {
    metrics.hits++
  } else {
    metrics.misses++
  }
  metrics.totalRequests = metrics.hits + metrics.misses
  metrics.hitRate = metrics.totalRequests > 0 ? metrics.hits / metrics.totalRequests : 0
}

/**
 * Format memory usage for logging
 */
export function formatMemoryUsage(bytes: number): string {
  const mb = bytes / 1024 / 1024
  return `${Math.round(mb * 100) / 100}MB`
}

/**
 * Format duration for logging
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  } else {
    return `${Math.round(ms / 1000 * 10) / 10}s`
  }
}

/**
 * Create a performance benchmark
 */
export function createBenchmark(
  name: string,
  targetMs: number,
  actualMs: number,
  memoryUsageBytes: number = 0
): PerformanceBenchmark {
  return {
    name,
    targetMs,
    actualMs,
    passed: actualMs <= targetMs,
    memoryUsageMB: memoryUsageBytes / 1024 / 1024
  }
}

/**
 * Generate a performance report
 */
export function generatePerformanceReport(
  testSuite: string,
  benchmarks: PerformanceBenchmark[],
  cacheMetrics: CacheMetrics
): PerformanceReport {
  const responseTimes = benchmarks.map(b => b.actualMs)
  const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
  const maxResponseTime = Math.max(...responseTimes)
  const overallPassed = benchmarks.every(b => b.passed)

  const totalMemoryUsage = benchmarks.reduce((sum, b) => sum + b.memoryUsageMB, 0)
  const memoryEfficiency = totalMemoryUsage / benchmarks.length

  return {
    testSuite,
    timestamp: Date.now(),
    overallPassed,
    benchmarks,
    summary: {
      avgResponseTime,
      maxResponseTime,
      memoryEfficiency,
      cachePerformance: cacheMetrics
    }
  }
}

/**
 * Log performance report in a readable format
 */
export function logPerformanceReport(report: PerformanceReport): void {
  console.log('\n' + '='.repeat(60))
  console.log(`🎯 PERFORMANCE REPORT: ${report.testSuite}`)
  console.log('='.repeat(60))

  console.log(`📊 Overall Status: ${report.overallPassed ? '✅ PASSED' : '❌ FAILED'}`)
  console.log(`⏱️ Average Response Time: ${formatDuration(report.summary.avgResponseTime)}`)
  console.log(`⏱️ Max Response Time: ${formatDuration(report.summary.maxResponseTime)}`)
  console.log(`🧠 Memory Efficiency: ${formatMemoryUsage(report.summary.memoryEfficiency * 1024 * 1024)}`)

  console.log(`\n📈 Cache Performance:`)
  console.log(`   Hit Rate: ${Math.round(report.summary.cachePerformance.hitRate * 100)}%`)
  console.log(`   Hits: ${report.summary.cachePerformance.hits}`)
  console.log(`   Misses: ${report.summary.cachePerformance.misses}`)

  console.log('\n🎯 Individual Benchmarks:')
  report.benchmarks.forEach(benchmark => {
    const status = benchmark.passed ? '✅' : '❌'
    const timeComparison = `${formatDuration(benchmark.actualMs)} (target: ${formatDuration(benchmark.targetMs)})`
    console.log(`   ${status} ${benchmark.name}: ${timeComparison}`)
  })

  console.log('='.repeat(60) + '\n')
}

/**
 * Wait for garbage collection to complete
 */
export async function waitForGarbageCollection(timeoutMs: number = 1000): Promise<void> {
  if (global.gc) {
    global.gc()
    await new Promise(resolve => setTimeout(resolve, Math.min(timeoutMs, 1000)))
  }
}

/**
 * Monitor memory usage over time
 */
export class MemoryMonitor {
  private samples: Array<{ timestamp: number; memory: NodeJS.MemoryUsage }> = []
  private monitoring: boolean = false
  private intervalId?: NodeJS.Timeout

  start(intervalMs: number = 1000): void {
    if (this.monitoring) {
      return
    }

    this.monitoring = true
    this.samples = []

    this.intervalId = setInterval(() => {
      this.samples.push({
        timestamp: Date.now(),
        memory: process.memoryUsage()
      })
    }, intervalMs)
  }

  stop(): void {
    if (!this.monitoring) {
      return
    }

    this.monitoring = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
  }

  getReport(): {
    duration: number
    samples: number
    memoryGrowth: number
    peakMemory: number
    avgMemory: number
  } {
    if (this.samples.length < 2) {
      return {
        duration: 0,
        samples: this.samples.length,
        memoryGrowth: 0,
        peakMemory: 0,
        avgMemory: 0
      }
    }

    const firstSample = this.samples[0]
    const lastSample = this.samples[this.samples.length - 1]
    const duration = lastSample.timestamp - firstSample.timestamp

    const heapUsages = this.samples.map(s => s.memory.heapUsed)
    const memoryGrowth = lastSample.memory.heapUsed - firstSample.memory.heapUsed
    const peakMemory = Math.max(...heapUsages)
    const avgMemory = heapUsages.reduce((sum, heap) => sum + heap, 0) / heapUsages.length

    return {
      duration,
      samples: this.samples.length,
      memoryGrowth,
      peakMemory,
      avgMemory
    }
  }
}

/**
 * Performance test decorator for automatic metrics collection
 */
export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  benchmarkName: string,
  targetMs: number
): (...args: Parameters<T>) => Promise<{ result: Awaited<ReturnType<T>>; benchmark: PerformanceBenchmark }> {
  return async (...args: Parameters<T>) => {
    const metrics = startPerformanceMonitoring()

    try {
      const result = await fn(...args)
      const finalMetrics = endPerformanceMonitoring(metrics)

      const benchmark = createBenchmark(
        benchmarkName,
        targetMs,
        finalMetrics.duration,
        finalMetrics.memoryUsage.delta.heapUsed || 0
      )

      return { result, benchmark }
    } catch (error) {
      const finalMetrics = endPerformanceMonitoring(metrics)

      const benchmark = createBenchmark(
        benchmarkName,
        targetMs,
        finalMetrics.duration,
        finalMetrics.memoryUsage.delta.heapUsed || 0
      )

      throw { error, benchmark }
    }
  }
}

/**
 * Stress test utility for testing performance under load
 */
export async function stressTest<T>(
  testFunction: () => Promise<T>,
  concurrency: number,
  iterations: number,
  timeoutMs: number = 30000
): Promise<{
  totalDuration: number
  avgDuration: number
  successRate: number
  errors: Array<{ iteration: number; error: any }>
  memoryUsage: PerformanceMetrics['memoryUsage']
}> {
  const metrics = startPerformanceMonitoring()
  const errors: Array<{ iteration: number; error: any }> = []

  const batches: Promise<any>[][] = []
  for (let i = 0; i < iterations; i += concurrency) {
    const batchSize = Math.min(concurrency, iterations - i)
    const batch = Array(batchSize).fill(null).map((_, j) =>
      testFunction().catch(error => {
        errors.push({ iteration: i + j, error })
        return null
      })
    )
    batches.push(batch)
  }

  // Process batches sequentially to control concurrency
  for (const batch of batches) {
    await Promise.all(batch)
  }

  const finalMetrics = endPerformanceMonitoring(metrics)
  const successRate = (iterations - errors.length) / iterations

  return {
    totalDuration: finalMetrics.duration,
    avgDuration: finalMetrics.duration / iterations,
    successRate,
    errors,
    memoryUsage: finalMetrics.memoryUsage
  }
}