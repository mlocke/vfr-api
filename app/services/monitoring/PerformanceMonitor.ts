/**
 * Performance Monitor for Stock Selection System
 * Tracks response times, cache performance, memory usage, and system health
 * Provides real-time monitoring and alerting for performance targets
 */

import { EventEmitter } from 'events'

interface PerformanceMetrics {
  responseTime: {
    p50: number
    p95: number
    p99: number
    average: number
    samples: number[]
  }
  cachePerformance: {
    hitRate: number
    missRate: number
    averageLatency: number
    totalRequests: number
  }
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
    utilization: number
  }
  webSocketMetrics: {
    averageLatency: number
    messagesPerSecond: number
    connectionUptime: number
    reconnectCount: number
  }
  systemHealth: {
    cpuUsage: number
    gcPause: number
    eventLoopLag: number
  }
}

interface PerformanceThresholds {
  responseTime: {
    warning: number  // 80ms
    critical: number // 100ms
  }
  cacheHitRate: {
    warning: number  // 90%
    critical: number // 85%
  }
  memoryUsage: {
    warning: number  // 80%
    critical: number // 90%
  }
  websocketLatency: {
    warning: number  // 40ms
    critical: number // 50ms
  }
}

interface PerformanceAlert {
  type: 'warning' | 'critical'
  metric: string
  value: number
  threshold: number
  timestamp: number
  message: string
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics
  private thresholds: PerformanceThresholds
  private sampleBuffers: Map<string, number[]> = new Map()
  private alertHistory: PerformanceAlert[] = []
  private monitoringInterval: NodeJS.Timeout | null = null
  private gcObserver: any = null
  private eventLoopMonitor: NodeJS.Timeout | null = null
  private lastEventLoopCheck = process.hrtime()

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    super()

    this.thresholds = {
      responseTime: {
        warning: 80,
        critical: 100
      },
      cacheHitRate: {
        warning: 90,
        critical: 85
      },
      memoryUsage: {
        warning: 80,
        critical: 90
      },
      websocketLatency: {
        warning: 40,
        critical: 50
      },
      ...thresholds
    }

    this.metrics = this.initializeMetrics()
    this.setupMonitoring()
  }

  /**
   * Record API response time
   */
  recordResponseTime(duration: number, endpoint?: string): void {
    this.addSample('responseTime', duration)
    this.updateResponseTimeMetrics()

    // Check thresholds
    this.checkThreshold('responseTime', duration, this.thresholds.responseTime)
  }

  /**
   * Record cache operation
   */
  recordCacheOperation(hit: boolean, duration: number): void {
    const operation = hit ? 'hit' : 'miss'
    this.addSample(`cache_${operation}`, duration)
    this.updateCacheMetrics()

    // Calculate current hit rate
    const hitSamples = this.getSamples('cache_hit').length
    const missSamples = this.getSamples('cache_miss').length
    const totalRequests = hitSamples + missSamples

    if (totalRequests > 0) {
      const currentHitRate = (hitSamples / totalRequests) * 100
      this.checkThreshold('cacheHitRate', currentHitRate, this.thresholds.cacheHitRate, true)
    }
  }

  /**
   * Record WebSocket latency
   */
  recordWebSocketLatency(latency: number): void {
    this.addSample('websocketLatency', latency)
    this.updateWebSocketMetrics()

    // Check thresholds
    this.checkThreshold('websocketLatency', latency, this.thresholds.websocketLatency)
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    this.updateAllMetrics()
    return { ...this.metrics }
  }

  /**
   * Get performance summary for dashboard
   */
  getPerformanceSummary(): {
    status: 'healthy' | 'warning' | 'critical'
    responseTimeP95: number
    cacheHitRate: number
    memoryUtilization: number
    websocketLatency: number
    alerts: PerformanceAlert[]
  } {
    this.updateAllMetrics()

    const recentAlerts = this.alertHistory
      .filter(alert => Date.now() - alert.timestamp < 300000) // Last 5 minutes
      .slice(-10) // Last 10 alerts

    const status = this.determineOverallStatus(recentAlerts)

    return {
      status,
      responseTimeP95: this.metrics.responseTime.p95,
      cacheHitRate: this.metrics.cachePerformance.hitRate,
      memoryUtilization: this.metrics.memoryUsage.utilization,
      websocketLatency: this.metrics.webSocketMetrics.averageLatency,
      alerts: recentAlerts
    }
  }

  /**
   * Check if system is meeting performance targets
   */
  checkPerformanceTargets(): {
    responseTime: boolean    // < 100ms for cached, < 300ms for real-time
    websocketLatency: boolean // < 50ms
    cacheHitRate: boolean    // > 95%
    memoryEfficiency: boolean // < 80% utilization
  } {
    this.updateAllMetrics()

    return {
      responseTime: this.metrics.responseTime.p95 < this.thresholds.responseTime.critical,
      websocketLatency: this.metrics.webSocketMetrics.averageLatency < this.thresholds.websocketLatency.critical,
      cacheHitRate: this.metrics.cachePerformance.hitRate > this.thresholds.cacheHitRate.critical,
      memoryEfficiency: this.metrics.memoryUsage.utilization < this.thresholds.memoryUsage.critical
    }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    console.log('🔍 Starting performance monitoring...')

    // Main monitoring loop
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics()
      this.updateAllMetrics()
      this.emitMetricsUpdate()
    }, 5000) // Every 5 seconds

    // Event loop monitoring
    this.startEventLoopMonitoring()

    // GC monitoring if available
    this.startGCMonitoring()

    console.log('✅ Performance monitoring started')
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    if (this.eventLoopMonitor) {
      clearInterval(this.eventLoopMonitor)
      this.eventLoopMonitor = null
    }

    if (this.gcObserver) {
      this.gcObserver.disconnect()
      this.gcObserver = null
    }

    console.log('📪 Performance monitoring stopped')
  }

  /**
   * Private methods
   */

  private initializeMetrics(): PerformanceMetrics {
    return {
      responseTime: {
        p50: 0,
        p95: 0,
        p99: 0,
        average: 0,
        samples: []
      },
      cachePerformance: {
        hitRate: 0,
        missRate: 0,
        averageLatency: 0,
        totalRequests: 0
      },
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        utilization: 0
      },
      webSocketMetrics: {
        averageLatency: 0,
        messagesPerSecond: 0,
        connectionUptime: 0,
        reconnectCount: 0
      },
      systemHealth: {
        cpuUsage: 0,
        gcPause: 0,
        eventLoopLag: 0
      }
    }
  }

  private setupMonitoring(): void {
    // Initialize sample buffers
    this.sampleBuffers.set('responseTime', [])
    this.sampleBuffers.set('cache_hit', [])
    this.sampleBuffers.set('cache_miss', [])
    this.sampleBuffers.set('websocketLatency', [])
  }

  private addSample(metric: string, value: number): void {
    if (!this.sampleBuffers.has(metric)) {
      this.sampleBuffers.set(metric, [])
    }

    const samples = this.sampleBuffers.get(metric)!
    samples.push(value)

    // Keep only recent samples (sliding window)
    const maxSamples = metric === 'responseTime' ? 1000 : 500
    if (samples.length > maxSamples) {
      samples.splice(0, samples.length - maxSamples)
    }
  }

  private getSamples(metric: string): number[] {
    return this.sampleBuffers.get(metric) || []
  }

  private updateResponseTimeMetrics(): void {
    const samples = this.getSamples('responseTime')
    if (samples.length === 0) return

    const sorted = samples.slice().sort((a, b) => a - b)

    this.metrics.responseTime = {
      p50: this.calculatePercentile(sorted, 0.5),
      p95: this.calculatePercentile(sorted, 0.95),
      p99: this.calculatePercentile(sorted, 0.99),
      average: samples.reduce((a, b) => a + b, 0) / samples.length,
      samples: samples.slice(-100) // Keep last 100 for display
    }
  }

  private updateCacheMetrics(): void {
    const hitSamples = this.getSamples('cache_hit')
    const missSamples = this.getSamples('cache_miss')
    const totalRequests = hitSamples.length + missSamples.length

    if (totalRequests > 0) {
      const hitRate = (hitSamples.length / totalRequests) * 100
      const missRate = (missSamples.length / totalRequests) * 100

      const allLatencies = [...hitSamples, ...missSamples]
      const averageLatency = allLatencies.length > 0
        ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
        : 0

      this.metrics.cachePerformance = {
        hitRate,
        missRate,
        averageLatency,
        totalRequests
      }
    }
  }

  private updateWebSocketMetrics(): void {
    const samples = this.getSamples('websocketLatency')
    if (samples.length === 0) return

    const averageLatency = samples.reduce((a, b) => a + b, 0) / samples.length
    const messagesPerSecond = samples.length > 0 ? 1000 / averageLatency : 0

    this.metrics.webSocketMetrics = {
      ...this.metrics.webSocketMetrics,
      averageLatency,
      messagesPerSecond
    }
  }

  private updateAllMetrics(): void {
    this.updateResponseTimeMetrics()
    this.updateCacheMetrics()
    this.updateWebSocketMetrics()
    this.collectSystemMetrics()
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage()
    const utilization = (memUsage.heapUsed / memUsage.heapTotal) * 100

    this.metrics.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      utilization
    }

    // Check memory threshold
    this.checkThreshold('memoryUsage', utilization, this.thresholds.memoryUsage, true)
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0

    const index = Math.ceil(sortedValues.length * percentile) - 1
    return sortedValues[Math.max(0, index)]
  }

  private checkThreshold(
    metric: string,
    value: number,
    threshold: { warning: number; critical: number },
    inverse: boolean = false
  ): void {
    const isWarning = inverse
      ? value < threshold.warning
      : value > threshold.warning

    const isCritical = inverse
      ? value < threshold.critical
      : value > threshold.critical

    if (isCritical) {
      this.createAlert('critical', metric, value, threshold.critical)
    } else if (isWarning) {
      this.createAlert('warning', metric, value, threshold.warning)
    }
  }

  private createAlert(
    type: 'warning' | 'critical',
    metric: string,
    value: number,
    threshold: number
  ): void {
    const alert: PerformanceAlert = {
      type,
      metric,
      value,
      threshold,
      timestamp: Date.now(),
      message: `${metric} ${type}: ${value.toFixed(2)} (threshold: ${threshold})`
    }

    this.alertHistory.push(alert)

    // Keep only recent alerts
    if (this.alertHistory.length > 100) {
      this.alertHistory.splice(0, this.alertHistory.length - 100)
    }

    // Emit alert
    this.emit('alert', alert)

    console.warn(`⚠️ Performance Alert [${type.toUpperCase()}]: ${alert.message}`)
  }

  private determineOverallStatus(recentAlerts: PerformanceAlert[]): 'healthy' | 'warning' | 'critical' {
    const criticalAlerts = recentAlerts.filter(alert => alert.type === 'critical')
    const warningAlerts = recentAlerts.filter(alert => alert.type === 'warning')

    if (criticalAlerts.length > 0) {
      return 'critical'
    } else if (warningAlerts.length > 2) {
      return 'warning'
    } else {
      return 'healthy'
    }
  }

  private startEventLoopMonitoring(): void {
    this.eventLoopMonitor = setInterval(() => {
      const start = process.hrtime()
      setImmediate(() => {
        const delta = process.hrtime(start)
        const nanosecondDelta = delta[0] * 1e9 + delta[1]
        const millisecondDelta = nanosecondDelta / 1e6

        this.metrics.systemHealth.eventLoopLag = millisecondDelta

        // Alert on high event loop lag
        if (millisecondDelta > 10) {
          console.warn(`⚠️ High event loop lag detected: ${millisecondDelta.toFixed(2)}ms`)
        }
      })
    }, 1000)
  }

  private startGCMonitoring(): void {
    try {
      // Try to set up GC monitoring if performance hooks are available
      const { PerformanceObserver } = require('perf_hooks')

      this.gcObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        for (const entry of entries) {
          if (entry.entryType === 'gc') {
            this.metrics.systemHealth.gcPause = entry.duration

            // Alert on long GC pauses
            if (entry.duration > 50) {
              console.warn(`⚠️ Long GC pause detected: ${entry.duration.toFixed(2)}ms`)
            }
          }
        }
      })

      this.gcObserver.observe({ entryTypes: ['gc'] })
    } catch (error) {
      console.warn('GC monitoring not available:', error.message)
    }
  }

  private emitMetricsUpdate(): void {
    this.emit('metrics', this.getMetrics())
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Export for easy integration
export default PerformanceMonitor