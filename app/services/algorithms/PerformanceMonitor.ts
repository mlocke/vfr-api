/**
 * Performance Monitoring and Optimization System
 * Tracks algorithm performance, resource usage, and system health for financial trading systems
 */

import { EventEmitter } from 'events'
import {
  AlgorithmConfiguration,
  SelectionResult,
  AlgorithmPerformance,
  StockScore
} from './types'

interface SystemMetrics {
  timestamp: number

  // CPU and Memory
  cpuUsage: number        // Percentage
  memoryUsage: number     // MB
  memoryLimit: number     // MB

  // Database Performance
  dbConnections: number
  dbConnectionsActive: number
  dbQueryLatency: number  // ms
  dbQueryCount: number

  // Cache Performance
  cacheHitRate: number    // Percentage
  cacheMemoryUsage: number // MB
  cacheKeyCount: number

  // Network and API
  apiLatency: number      // ms
  apiRequestCount: number
  apiErrorRate: number    // Percentage

  // Algorithm Execution
  algorithmExecutions: number
  averageExecutionTime: number // ms
  concurrentExecutions: number

  // Data Quality
  averageDataQuality: number   // 0-1
  dataSourceFailures: number
  fusionConflicts: number
}

interface PerformanceAlert {
  id: string
  timestamp: number
  severity: 'info' | 'warning' | 'error' | 'critical'
  category: 'performance' | 'system' | 'data_quality' | 'algorithm'
  title: string
  description: string
  metric: string
  currentValue: number
  threshold: number
  algorithmId?: string
  recommendations?: string[]
  acknowledged: boolean
}

interface PerformanceThresholds {
  // System thresholds
  cpuUsageWarning: number      // 70%
  cpuUsageCritical: number     // 90%
  memoryUsageWarning: number   // 80%
  memoryUsageCritical: number  // 95%

  // Database thresholds
  dbLatencyWarning: number     // 500ms
  dbLatencyCritical: number    // 2000ms
  dbConnectionWarning: number  // 80% of max

  // Cache thresholds
  cacheHitRateWarning: number  // 80%
  cacheHitRateCritical: number // 60%

  // Algorithm thresholds
  executionTimeWarning: number  // 10s
  executionTimeCritical: number // 30s
  dataQualityWarning: number    // 0.7
  dataQualityCritical: number   // 0.5

  // API thresholds
  apiLatencyWarning: number     // 1000ms
  apiLatencyCritical: number    // 5000ms
  apiErrorRateWarning: number   // 5%
  apiErrorRateCritical: number  // 15%
}

interface OptimizationRecommendation {
  id: string
  timestamp: number
  category: 'caching' | 'database' | 'algorithm' | 'system' | 'data'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  impact: string
  effort: 'low' | 'medium' | 'high'
  implementationSteps: string[]
  estimatedImprovement: {
    metric: string
    expectedChange: string
  }
  affectedAlgorithms?: string[]
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: SystemMetrics[] = []
  private alerts: PerformanceAlert[] = []
  private recommendations: OptimizationRecommendation[] = []
  private thresholds: PerformanceThresholds
  private monitoringInterval: NodeJS.Timeout | null = null
  private algorithmPerformance = new Map<string, AlgorithmPerformance[]>()

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    super()

    this.thresholds = {
      cpuUsageWarning: 70,
      cpuUsageCritical: 90,
      memoryUsageWarning: 80,
      memoryUsageCritical: 95,
      dbLatencyWarning: 500,
      dbLatencyCritical: 2000,
      dbConnectionWarning: 80,
      cacheHitRateWarning: 80,
      cacheHitRateCritical: 60,
      executionTimeWarning: 10000,
      executionTimeCritical: 30000,
      dataQualityWarning: 0.7,
      dataQualityCritical: 0.5,
      apiLatencyWarning: 1000,
      apiLatencyCritical: 5000,
      apiErrorRateWarning: 5,
      apiErrorRateCritical: 15,
      ...thresholds
    }
  }

  // ==================== MONITORING LIFECYCLE ====================

  /**
   * Start performance monitoring
   */
  start(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      console.warn('Performance monitoring already running')
      return
    }

    console.log('Starting performance monitoring...')

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics()
        this.analyzePerformance()
        this.generateRecommendations()
      } catch (error) {
        console.error('Error in performance monitoring cycle:', error)
        this.emit('error', error)
      }
    }, intervalMs)

    this.emit('started')
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      console.log('Performance monitoring stopped')
      this.emit('stopped')
    }
  }

  // ==================== METRICS COLLECTION ====================

  /**
   * Collect system and algorithm metrics
   */
  private async collectMetrics(): Promise<void> {
    const timestamp = Date.now()

    const metrics: SystemMetrics = {
      timestamp,
      cpuUsage: await this.getCpuUsage(),
      memoryUsage: await this.getMemoryUsage(),
      memoryLimit: await this.getMemoryLimit(),
      dbConnections: await this.getDbConnections(),
      dbConnectionsActive: await this.getActiveDbConnections(),
      dbQueryLatency: await this.getDbQueryLatency(),
      dbQueryCount: await this.getDbQueryCount(),
      cacheHitRate: await this.getCacheHitRate(),
      cacheMemoryUsage: await this.getCacheMemoryUsage(),
      cacheKeyCount: await this.getCacheKeyCount(),
      apiLatency: await this.getApiLatency(),
      apiRequestCount: await this.getApiRequestCount(),
      apiErrorRate: await this.getApiErrorRate(),
      algorithmExecutions: await this.getAlgorithmExecutions(),
      averageExecutionTime: await this.getAverageExecutionTime(),
      concurrentExecutions: await this.getConcurrentExecutions(),
      averageDataQuality: await this.getAverageDataQuality(),
      dataSourceFailures: await this.getDataSourceFailures(),
      fusionConflicts: await this.getFusionConflicts()
    }

    this.metrics.push(metrics)

    // Keep only last 24 hours of metrics (assuming 30s intervals = 2880 data points)
    if (this.metrics.length > 2880) {
      this.metrics = this.metrics.slice(-2880)
    }

    this.emit('metricsCollected', metrics)
  }

  // ==================== PERFORMANCE ANALYSIS ====================

  /**
   * Analyze current performance and generate alerts
   */
  private analyzePerformance(): void {
    if (this.metrics.length === 0) return

    const latest = this.metrics[this.metrics.length - 1]
    const previous = this.metrics.length > 1 ? this.metrics[this.metrics.length - 2] : null

    // Check system performance thresholds
    this.checkThreshold('cpuUsage', 'CPU Usage', latest.cpuUsage, '%', 'system')
    this.checkThreshold('memoryUsage', 'Memory Usage', (latest.memoryUsage / latest.memoryLimit) * 100, '%', 'system')

    // Check database performance
    this.checkThreshold('dbLatency', 'Database Latency', latest.dbQueryLatency, 'ms', 'performance')

    // Check cache performance
    this.checkThreshold('cacheHitRate', 'Cache Hit Rate', latest.cacheHitRate, '%', 'performance')

    // Check algorithm execution performance
    this.checkThreshold('executionTime', 'Execution Time', latest.averageExecutionTime, 'ms', 'algorithm')
    this.checkThreshold('dataQuality', 'Data Quality', latest.averageDataQuality, '', 'data_quality')

    // Check API performance
    this.checkThreshold('apiLatency', 'API Latency', latest.apiLatency, 'ms', 'performance')
    this.checkThreshold('apiErrorRate', 'API Error Rate', latest.apiErrorRate, '%', 'system')

    // Check for performance degradation trends
    if (previous) {
      this.checkPerformanceTrends(latest, previous)
    }
  }

  /**
   * Check individual metric against thresholds
   */
  private checkThreshold(
    metric: string,
    displayName: string,
    value: number,
    unit: string,
    category: PerformanceAlert['category']
  ): void {
    const thresholdKey = metric as keyof PerformanceThresholds
    const warningThreshold = this.thresholds[`${thresholdKey}Warning` as keyof PerformanceThresholds]
    const criticalThreshold = this.thresholds[`${thresholdKey}Critical` as keyof PerformanceThresholds]

    let severity: PerformanceAlert['severity'] | null = null
    let threshold = 0

    // Handle inverted thresholds (where lower is better)
    const invertedMetrics = ['cacheHitRate', 'dataQuality']
    const isInverted = invertedMetrics.includes(metric)

    if (criticalThreshold !== undefined) {
      if (isInverted ? value <= criticalThreshold : value >= criticalThreshold) {
        severity = 'critical'
        threshold = criticalThreshold
      }
    }

    if (!severity && warningThreshold !== undefined) {
      if (isInverted ? value <= warningThreshold : value >= warningThreshold) {
        severity = 'warning'
        threshold = warningThreshold
      }
    }

    if (severity) {
      this.createAlert({
        severity,
        category,
        title: `${displayName} ${severity === 'critical' ? 'Critical' : 'Warning'}`,
        description: `${displayName} is ${value}${unit}, which ${isInverted ? 'is below' : 'exceeds'} the ${severity} threshold of ${threshold}${unit}`,
        metric,
        currentValue: value,
        threshold
      })
    }
  }

  /**
   * Check for performance degradation trends
   */
  private checkPerformanceTrends(current: SystemMetrics, previous: SystemMetrics): void {
    const timeDiff = current.timestamp - previous.timestamp
    if (timeDiff === 0) return

    // Check for significant increases in execution time
    const executionTimeIncrease = (current.averageExecutionTime - previous.averageExecutionTime) / previous.averageExecutionTime
    if (executionTimeIncrease > 0.2) { // 20% increase
      this.createAlert({
        severity: 'warning',
        category: 'performance',
        title: 'Execution Time Degradation',
        description: `Average execution time increased by ${(executionTimeIncrease * 100).toFixed(1)}% from ${previous.averageExecutionTime}ms to ${current.averageExecutionTime}ms`,
        metric: 'executionTimeIncrease',
        currentValue: current.averageExecutionTime,
        threshold: previous.averageExecutionTime * 1.2
      })
    }

    // Check for significant decrease in data quality
    const dataQualityDecrease = previous.averageDataQuality - current.averageDataQuality
    if (dataQualityDecrease > 0.1) { // 10% decrease
      this.createAlert({
        severity: 'warning',
        category: 'data_quality',
        title: 'Data Quality Degradation',
        description: `Average data quality decreased by ${(dataQualityDecrease * 100).toFixed(1)}% from ${previous.averageDataQuality.toFixed(3)} to ${current.averageDataQuality.toFixed(3)}`,
        metric: 'dataQualityDecrease',
        currentValue: current.averageDataQuality,
        threshold: previous.averageDataQuality - 0.1
      })
    }

    // Check for increasing API errors
    const apiErrorIncrease = current.apiErrorRate - previous.apiErrorRate
    if (apiErrorIncrease > 2) { // 2% increase in error rate
      this.createAlert({
        severity: 'warning',
        category: 'system',
        title: 'API Error Rate Increase',
        description: `API error rate increased by ${apiErrorIncrease.toFixed(1)}% from ${previous.apiErrorRate.toFixed(1)}% to ${current.apiErrorRate.toFixed(1)}%`,
        metric: 'apiErrorIncrease',
        currentValue: current.apiErrorRate,
        threshold: previous.apiErrorRate + 2
      })
    }
  }

  // ==================== ALERT MANAGEMENT ====================

  /**
   * Create new performance alert
   */
  private createAlert(alert: Omit<PerformanceAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    // Check if similar alert already exists (avoid spam)
    const existingAlert = this.alerts.find(a =>
      !a.acknowledged &&
      a.metric === alert.metric &&
      a.severity === alert.severity &&
      Date.now() - a.timestamp < 300000 // 5 minutes
    )

    if (existingAlert) {
      return // Don't create duplicate alert
    }

    const newAlert: PerformanceAlert = {
      id: this.generateAlertId(),
      timestamp: Date.now(),
      acknowledged: false,
      recommendations: this.generateAlertRecommendations(alert.metric, alert.currentValue),
      ...alert
    }

    this.alerts.push(newAlert)

    // Emit alert event
    this.emit('alert', newAlert)

    console.warn(`Performance Alert: ${newAlert.title} - ${newAlert.description}`)
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true
      this.emit('alertAcknowledged', alert)
      return true
    }
    return false
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(a => !a.acknowledged)
  }

  // ==================== OPTIMIZATION RECOMMENDATIONS ====================

  /**
   * Generate performance optimization recommendations
   */
  private generateRecommendations(): void {
    if (this.metrics.length < 10) return // Need at least 10 data points

    const recentMetrics = this.metrics.slice(-10)
    const averageMetrics = this.calculateAverageMetrics(recentMetrics)

    // Generate recommendations based on performance patterns
    this.checkCacheOptimization(averageMetrics)
    this.checkDatabaseOptimization(averageMetrics)
    this.checkAlgorithmOptimization(averageMetrics)
    this.checkSystemOptimization(averageMetrics)
  }

  /**
   * Check for cache optimization opportunities
   */
  private checkCacheOptimization(metrics: SystemMetrics): void {
    if (metrics.cacheHitRate < 85) {
      this.addRecommendation({
        category: 'caching',
        priority: 'high',
        title: 'Improve Cache Hit Rate',
        description: `Cache hit rate is ${metrics.cacheHitRate.toFixed(1)}%, which is below optimal levels. This can significantly impact performance.`,
        impact: 'Could reduce API calls by 20-40% and improve response times by 2-5x',
        effort: 'medium',
        implementationSteps: [
          'Analyze cache miss patterns to identify frequently requested but uncached data',
          'Increase TTL for stable data like fundamental metrics',
          'Implement cache warming for popular stocks and factors',
          'Add cache layers for expensive calculations like technical indicators',
          'Consider increasing cache memory allocation if hit rate doesn\'t improve'
        ],
        estimatedImprovement: {
          metric: 'Cache Hit Rate',
          expectedChange: '+10-15%'
        }
      })
    }

    if (metrics.cacheMemoryUsage > 1000) { // > 1GB
      this.addRecommendation({
        category: 'caching',
        priority: 'medium',
        title: 'Optimize Cache Memory Usage',
        description: `Cache is using ${metrics.cacheMemoryUsage}MB of memory. Consider optimization to reduce memory footprint.`,
        impact: 'Could reduce memory usage by 20-30% without affecting performance',
        effort: 'low',
        implementationSteps: [
          'Implement data compression for large cached objects',
          'Remove unused cache keys and implement automatic cleanup',
          'Optimize serialization format for cached data',
          'Implement cache eviction policies for least-used data'
        ],
        estimatedImprovement: {
          metric: 'Cache Memory Usage',
          expectedChange: '-200-400MB'
        }
      })
    }
  }

  /**
   * Check for database optimization opportunities
   */
  private checkDatabaseOptimization(metrics: SystemMetrics): void {
    if (metrics.dbQueryLatency > 200) {
      this.addRecommendation({
        category: 'database',
        priority: 'high',
        title: 'Optimize Database Query Performance',
        description: `Average database query latency is ${metrics.dbQueryLatency}ms, which is impacting algorithm execution speed.`,
        impact: 'Could reduce algorithm execution time by 30-50%',
        effort: 'high',
        implementationSteps: [
          'Analyze slow query logs to identify bottlenecks',
          'Add missing indexes on frequently queried columns',
          'Optimize JOIN operations in stock scoring queries',
          'Implement query result caching for expensive analytical queries',
          'Consider database partitioning for large historical data tables',
          'Use materialized views for common aggregations'
        ],
        estimatedImprovement: {
          metric: 'Database Latency',
          expectedChange: '-50-150ms'
        }
      })
    }

    if (metrics.dbConnectionsActive / metrics.dbConnections > 0.8) {
      this.addRecommendation({
        category: 'database',
        priority: 'medium',
        title: 'Optimize Database Connection Pool',
        description: `Database connection utilization is ${((metrics.dbConnectionsActive / metrics.dbConnections) * 100).toFixed(1)}%, indicating potential connection bottlenecks.`,
        impact: 'Could improve concurrent algorithm execution capacity',
        effort: 'low',
        implementationSteps: [
          'Increase database connection pool size',
          'Implement connection pooling optimizations',
          'Add connection monitoring and alerting',
          'Optimize connection lifecycle management'
        ],
        estimatedImprovement: {
          metric: 'Database Connection Utilization',
          expectedChange: '-20-30%'
        }
      })
    }
  }

  /**
   * Check for algorithm optimization opportunities
   */
  private checkAlgorithmOptimization(metrics: SystemMetrics): void {
    if (metrics.averageExecutionTime > 5000) { // > 5 seconds
      this.addRecommendation({
        category: 'algorithm',
        priority: 'high',
        title: 'Optimize Algorithm Execution Performance',
        description: `Average algorithm execution time is ${(metrics.averageExecutionTime / 1000).toFixed(1)}s, which may cause scheduling delays.`,
        impact: 'Could enable more frequent rebalancing and reduce latency',
        effort: 'high',
        implementationSteps: [
          'Profile algorithm execution to identify bottlenecks',
          'Implement parallel processing for independent calculations',
          'Optimize factor calculation algorithms',
          'Add incremental processing for unchanged data',
          'Pre-compute expensive metrics during off-peak hours',
          'Implement algorithm result streaming to start processing early selections'
        ],
        estimatedImprovement: {
          metric: 'Execution Time',
          expectedChange: '-2-4 seconds'
        }
      })
    }

    if (metrics.averageDataQuality < 0.8) {
      this.addRecommendation({
        category: 'data',
        priority: 'high',
        title: 'Improve Data Quality',
        description: `Average data quality score is ${metrics.averageDataQuality.toFixed(3)}, which may affect algorithm reliability.`,
        impact: 'Could improve algorithm accuracy and reduce selection errors',
        effort: 'medium',
        implementationSteps: [
          'Investigate data source reliability issues',
          'Implement additional data validation rules',
          'Add backup data sources for critical metrics',
          'Improve data fusion conflict resolution strategies',
          'Implement data quality monitoring and alerting'
        ],
        estimatedImprovement: {
          metric: 'Data Quality Score',
          expectedChange: '+0.05-0.15'
        }
      })
    }
  }

  /**
   * Check for system optimization opportunities
   */
  private checkSystemOptimization(metrics: SystemMetrics): void {
    if (metrics.cpuUsage > 60) {
      this.addRecommendation({
        category: 'system',
        priority: 'medium',
        title: 'Optimize CPU Usage',
        description: `Average CPU usage is ${metrics.cpuUsage.toFixed(1)}%, indicating high system load.`,
        impact: 'Could improve overall system responsiveness and stability',
        effort: 'medium',
        implementationSteps: [
          'Profile CPU-intensive operations',
          'Implement algorithm execution scheduling to distribute load',
          'Optimize mathematical calculations in factor library',
          'Consider upgrading to higher-performance hardware',
          'Implement CPU usage monitoring and throttling'
        ],
        estimatedImprovement: {
          metric: 'CPU Usage',
          expectedChange: '-15-25%'
        }
      })
    }

    if (metrics.apiErrorRate > 3) {
      this.addRecommendation({
        category: 'system',
        priority: 'high',
        title: 'Reduce API Error Rate',
        description: `API error rate is ${metrics.apiErrorRate.toFixed(1)}%, which may cause data quality issues.`,
        impact: 'Could improve data reliability and reduce algorithm failures',
        effort: 'medium',
        implementationSteps: [
          'Implement exponential backoff for failed API requests',
          'Add circuit breaker pattern for unreliable APIs',
          'Implement API health monitoring and failover',
          'Add request retry logic with jitter',
          'Monitor and alert on API rate limits'
        ],
        estimatedImprovement: {
          metric: 'API Error Rate',
          expectedChange: '-2-4%'
        }
      })
    }
  }

  /**
   * Add optimization recommendation
   */
  private addRecommendation(rec: Omit<OptimizationRecommendation, 'id' | 'timestamp'>): void {
    // Check if similar recommendation already exists
    const existing = this.recommendations.find(r =>
      r.title === rec.title && r.category === rec.category
    )

    if (existing) {
      return // Don't duplicate recommendations
    }

    const recommendation: OptimizationRecommendation = {
      id: this.generateRecommendationId(),
      timestamp: Date.now(),
      ...rec
    }

    this.recommendations.push(recommendation)
    this.emit('recommendation', recommendation)
  }

  // ==================== ALGORITHM PERFORMANCE TRACKING ====================

  /**
   * Track algorithm execution result
   */
  trackAlgorithmExecution(
    algorithmId: string,
    config: AlgorithmConfiguration,
    result: SelectionResult
  ): void {
    // Calculate performance metrics
    const performance = this.calculateAlgorithmPerformance(algorithmId, config, result)

    // Store performance data
    if (!this.algorithmPerformance.has(algorithmId)) {
      this.algorithmPerformance.set(algorithmId, [])
    }

    const performances = this.algorithmPerformance.get(algorithmId)!
    performances.push(performance)

    // Keep only last 100 performance records per algorithm
    if (performances.length > 100) {
      performances.splice(0, performances.length - 100)
    }

    this.emit('algorithmPerformance', { algorithmId, performance })
  }

  /**
   * Calculate algorithm performance metrics
   */
  private calculateAlgorithmPerformance(
    algorithmId: string,
    config: AlgorithmConfiguration,
    result: SelectionResult
  ): AlgorithmPerformance {
    const now = Date.now()
    const period = {
      start: now,
      end: now
    }

    // Calculate basic performance metrics
    const performance: AlgorithmPerformance = {
      algorithmId,
      period,
      returns: {
        total: 0, // Would be calculated from actual portfolio returns
        annualized: 0,
        sharpe: 0,
        maxDrawdown: 0,
        volatility: 0
      },
      risk: {
        beta: 0,
        trackingError: 0,
        informationRatio: 0,
        var95: 0,
        expectedShortfall: 0
      },
      algorithmMetrics: {
        turnover: this.calculateTurnover(result),
        averageHoldingPeriod: config.selection.minHoldingPeriod || 0,
        winRate: 0, // Would be calculated from actual trades
        averageWin: 0,
        averageLoss: 0,
        dataQualityScore: result.quality.dataCompleteness
      },
      attribution: this.calculateFactorAttribution(result)
    }

    return performance
  }

  /**
   * Calculate portfolio turnover from selection result
   */
  private calculateTurnover(result: SelectionResult): number {
    // This would compare current selections to previous selections
    // For demonstration, return a mock turnover value
    return 0.3 // 30% turnover
  }

  /**
   * Calculate factor attribution from selection result
   */
  private calculateFactorAttribution(result: SelectionResult): { [factor: string]: any } {
    const attribution: { [factor: string]: any } = {}

    // This would calculate how much each factor contributed to performance
    // For demonstration, return mock attribution
    attribution.momentum = { contribution: 0.02, weight: 0.4, performance: 0.05 }
    attribution.value = { contribution: 0.015, weight: 0.3, performance: 0.05 }
    attribution.quality = { contribution: 0.01, weight: 0.3, performance: 0.033 }

    return attribution
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Calculate average metrics from array
   */
  private calculateAverageMetrics(metrics: SystemMetrics[]): SystemMetrics {
    if (metrics.length === 0) {
      throw new Error('Cannot calculate average of empty metrics array')
    }

    const avg: Partial<SystemMetrics> = {}
    const keys = Object.keys(metrics[0]) as (keyof SystemMetrics)[]

    keys.forEach(key => {
      if (key === 'timestamp') {
        avg[key] = metrics[metrics.length - 1].timestamp // Use latest timestamp
      } else {
        const values = metrics.map(m => m[key] as number)
        avg[key] = values.reduce((sum, val) => sum + val, 0) / values.length
      }
    })

    return avg as SystemMetrics
  }

  /**
   * Generate recommendation recommendations for alerts
   */
  private generateAlertRecommendations(metric: string, currentValue: number): string[] {
    const recommendations: string[] = []

    switch (metric) {
      case 'cpuUsage':
        recommendations.push(
          'Consider scaling horizontally or upgrading CPU',
          'Review algorithm scheduling to distribute load',
          'Profile CPU-intensive operations for optimization'
        )
        break

      case 'memoryUsage':
        recommendations.push(
          'Review memory usage patterns and optimize data structures',
          'Implement memory cleanup for unused objects',
          'Consider increasing available memory or implementing memory pools'
        )
        break

      case 'cacheHitRate':
        recommendations.push(
          'Analyze cache miss patterns and optimize caching strategy',
          'Increase cache TTL for stable data',
          'Implement cache warming for frequently accessed data'
        )
        break

      case 'executionTime':
        recommendations.push(
          'Profile algorithm execution to identify bottlenecks',
          'Implement parallel processing where possible',
          'Optimize database queries and data fetching'
        )
        break

      case 'dataQuality':
        recommendations.push(
          'Investigate data source reliability issues',
          'Implement additional data validation',
          'Add backup data sources for critical metrics'
        )
        break

      default:
        recommendations.push('Monitor this metric closely and investigate root causes')
    }

    return recommendations
  }

  /**
   * Generate unique IDs
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
  }

  private generateRecommendationId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
  }

  // ==================== METRIC COLLECTION METHODS ====================
  // These would integrate with your actual system monitoring tools

  private async getCpuUsage(): Promise<number> {
    // Implementation would use system monitoring tools
    return 45 + Math.random() * 20 // Mock value
  }

  private async getMemoryUsage(): Promise<number> {
    // Implementation would check actual memory usage
    return 1024 + Math.random() * 512 // Mock value in MB
  }

  private async getMemoryLimit(): Promise<number> {
    return 4096 // 4GB limit
  }

  private async getDbConnections(): Promise<number> {
    return 20 // Pool size
  }

  private async getActiveDbConnections(): Promise<number> {
    return 8 + Math.floor(Math.random() * 8) // Mock active connections
  }

  private async getDbQueryLatency(): Promise<number> {
    return 150 + Math.random() * 100 // Mock latency
  }

  private async getDbQueryCount(): Promise<number> {
    return 100 + Math.floor(Math.random() * 50) // Mock query count
  }

  private async getCacheHitRate(): Promise<number> {
    return 85 + Math.random() * 10 // Mock hit rate
  }

  private async getCacheMemoryUsage(): Promise<number> {
    return 512 + Math.random() * 256 // Mock memory usage
  }

  private async getCacheKeyCount(): Promise<number> {
    return 10000 + Math.floor(Math.random() * 5000) // Mock key count
  }

  private async getApiLatency(): Promise<number> {
    return 200 + Math.random() * 300 // Mock API latency
  }

  private async getApiRequestCount(): Promise<number> {
    return 50 + Math.floor(Math.random() * 30) // Mock request count
  }

  private async getApiErrorRate(): Promise<number> {
    return 2 + Math.random() * 3 // Mock error rate
  }

  private async getAlgorithmExecutions(): Promise<number> {
    return 5 + Math.floor(Math.random() * 5) // Mock execution count
  }

  private async getAverageExecutionTime(): Promise<number> {
    return 3000 + Math.random() * 2000 // Mock execution time
  }

  private async getConcurrentExecutions(): Promise<number> {
    return Math.floor(Math.random() * 3) // Mock concurrent executions
  }

  private async getAverageDataQuality(): Promise<number> {
    return 0.85 + Math.random() * 0.1 // Mock data quality
  }

  private async getDataSourceFailures(): Promise<number> {
    return Math.floor(Math.random() * 2) // Mock failures
  }

  private async getFusionConflicts(): Promise<number> {
    return Math.floor(Math.random() * 5) // Mock conflicts
  }

  // ==================== PUBLIC API METHODS ====================

  /**
   * Get current system metrics
   */
  getCurrentMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000)
    return this.metrics.filter(m => m.timestamp >= cutoffTime)
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): PerformanceAlert[] {
    return [...this.alerts]
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(category?: string): OptimizationRecommendation[] {
    return category
      ? this.recommendations.filter(r => r.category === category)
      : [...this.recommendations]
  }

  /**
   * Get algorithm performance history
   */
  getAlgorithmPerformance(algorithmId: string): AlgorithmPerformance[] {
    return this.algorithmPerformance.get(algorithmId) || []
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): {
    status: 'healthy' | 'warning' | 'critical'
    activeAlerts: number
    criticalAlerts: number
    recommendations: number
    uptime: number
  } {
    const activeAlerts = this.getActiveAlerts()
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical')

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (criticalAlerts.length > 0) {
      status = 'critical'
    } else if (activeAlerts.length > 0) {
      status = 'warning'
    }

    return {
      status,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      recommendations: this.recommendations.length,
      uptime: this.monitoringInterval ? Date.now() - (this.metrics[0]?.timestamp || Date.now()) : 0
    }
  }
}