/**
 * Data Quality Monitor for MCP Financial Intelligence Platform
 * Tracks and monitors data quality metrics across all MCP sources
 */

import {
  QualityScore,
  DataQualityMetrics
} from './types'
import { QualityThresholds } from './DataNormalizationPipeline'

export interface QualityAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  source: string
  dataType: string
  metric: string
  currentValue: number
  threshold: number
  timestamp: number
  resolved: boolean
}

export interface QualityTrend {
  metric: string
  source: string
  dataType: string
  values: Array<{ timestamp: number; value: number }>
  trend: 'improving' | 'declining' | 'stable'
  changePercent: number
}

export interface QualityReport {
  summary: {
    overallScore: number
    totalDataPoints: number
    alertCount: number
    trendsAnalyzed: number
  }
  sourceBreakdown: Record<string, {
    averageQuality: number
    dataPointCount: number
    alertCount: number
    trends: Record<string, 'improving' | 'declining' | 'stable'>
  }>
  dataTypeBreakdown: Record<string, {
    averageQuality: number
    sourceCount: number
    alertCount: number
    commonIssues: string[]
  }>
  alerts: QualityAlert[]
  trends: QualityTrend[]
  recommendations: string[]
}

export interface QualityStatistics {
  totalRecords: number
  averageQualityScore: number
  qualityDistribution: {
    excellent: number  // > 0.9
    good: number      // 0.7 - 0.9
    fair: number      // 0.5 - 0.7
    poor: number      // < 0.5
  }
  sourcePerformance: Record<string, {
    averageScore: number
    recordCount: number
    lastUpdated: number
  }>
  dataTypePerformance: Record<string, {
    averageScore: number
    recordCount: number
    commonIssues: string[]
  }>
  alertSummary: {
    critical: number
    warning: number
    info: number
    resolved: number
  }
}

export class DataQualityMonitor {
  private thresholds: QualityThresholds
  private qualityHistory: Map<string, QualityScore[]> = new Map()
  private alerts: Map<string, QualityAlert> = new Map()
  private statistics: QualityStatistics
  private readonly maxHistorySize = 1000 // Keep last 1000 quality scores per source/type
  private readonly trendWindowSize = 50 // Analyze trends over last 50 data points

  constructor(thresholds: QualityThresholds) {
    this.thresholds = thresholds
    this.statistics = this.initializeStatistics()
  }

  /**
   * Record quality metrics for a data source and type
   */
  recordQualityMetrics(
    dataType: string,
    source: string,
    qualityScore: QualityScore
  ): void {
    const key = `${source}:${dataType}`

    // Add to history
    if (!this.qualityHistory.has(key)) {
      this.qualityHistory.set(key, [])
    }

    const history = this.qualityHistory.get(key)!
    history.push(qualityScore)

    // Maintain history size limit
    if (history.length > this.maxHistorySize) {
      history.shift()
    }

    // Update statistics
    this.updateStatistics(dataType, source, qualityScore)

    // Check for quality alerts
    this.checkQualityAlerts(dataType, source, qualityScore)

    // Update trends
    this.updateTrends(dataType, source)
  }

  /**
   * Generate comprehensive quality report
   */
  generateQualityReport(): QualityReport {
    const alerts = Array.from(this.alerts.values())
    const activeAlerts = alerts.filter(alert => !alert.resolved)
    const trends = this.analyzeTrends()

    // Calculate source breakdown
    const sourceBreakdown: Record<string, any> = {}
    for (const [source, stats] of Object.entries(this.statistics.sourcePerformance)) {
      const sourceAlerts = activeAlerts.filter(alert => alert.source === source)
      const sourceTrends: Record<string, 'improving' | 'declining' | 'stable'> = {}

      trends
        .filter(trend => trend.source === source)
        .forEach(trend => {
          sourceTrends[trend.metric] = trend.trend
        })

      sourceBreakdown[source] = {
        averageQuality: stats.averageScore,
        dataPointCount: stats.recordCount,
        alertCount: sourceAlerts.length,
        trends: sourceTrends
      }
    }

    // Calculate data type breakdown
    const dataTypeBreakdown: Record<string, any> = {}
    for (const [dataType, stats] of Object.entries(this.statistics.dataTypePerformance)) {
      const typeAlerts = activeAlerts.filter(alert => alert.dataType === dataType)
      const sourceCount = Object.keys(this.statistics.sourcePerformance)
        .filter(source => this.qualityHistory.has(`${source}:${dataType}`)).length

      dataTypeBreakdown[dataType] = {
        averageQuality: stats.averageScore,
        sourceCount,
        alertCount: typeAlerts.length,
        commonIssues: stats.commonIssues
      }
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(activeAlerts, trends)

    return {
      summary: {
        overallScore: this.statistics.averageQualityScore,
        totalDataPoints: this.statistics.totalRecords,
        alertCount: activeAlerts.length,
        trendsAnalyzed: trends.length
      },
      sourceBreakdown,
      dataTypeBreakdown,
      alerts: activeAlerts,
      trends,
      recommendations
    }
  }

  /**
   * Get quality statistics
   */
  getStatistics(): QualityStatistics {
    return { ...this.statistics }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): QualityAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved)
  }

  /**
   * Get quality trends for a specific source and data type
   */
  getQualityTrends(source: string, dataType: string): QualityTrend[] {
    return this.analyzeTrends().filter(
      trend => trend.source === source && trend.dataType === dataType
    )
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.resolved = true
      return true
    }
    return false
  }

  /**
   * Update quality thresholds
   */
  updateThresholds(newThresholds: QualityThresholds): void {
    this.thresholds = { ...this.thresholds, ...newThresholds }

    // Re-evaluate existing alerts with new thresholds
    this.reevaluateAlerts()
  }

  /**
   * Reset monitor state
   */
  reset(): void {
    this.qualityHistory.clear()
    this.alerts.clear()
    this.statistics = this.initializeStatistics()
  }

  /**
   * Get quality score for a specific source and data type
   */
  getAverageQualityScore(source: string, dataType?: string): number {
    if (dataType) {
      const key = `${source}:${dataType}`
      const history = this.qualityHistory.get(key)
      if (!history || history.length === 0) return 0

      return history.reduce((sum, score) => sum + score.overall, 0) / history.length
    }

    // Get average across all data types for the source
    const relevantKeys = Array.from(this.qualityHistory.keys())
      .filter(key => key.startsWith(`${source}:`))

    if (relevantKeys.length === 0) return 0

    let totalScore = 0
    let totalCount = 0

    relevantKeys.forEach(key => {
      const history = this.qualityHistory.get(key)!
      totalScore += history.reduce((sum, score) => sum + score.overall, 0)
      totalCount += history.length
    })

    return totalCount > 0 ? totalScore / totalCount : 0
  }

  /**
   * Initialize statistics object
   */
  private initializeStatistics(): QualityStatistics {
    return {
      totalRecords: 0,
      averageQualityScore: 0,
      qualityDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0
      },
      sourcePerformance: {},
      dataTypePerformance: {},
      alertSummary: {
        critical: 0,
        warning: 0,
        info: 0,
        resolved: 0
      }
    }
  }

  /**
   * Update statistics with new quality score
   */
  private updateStatistics(
    dataType: string,
    source: string,
    qualityScore: QualityScore
  ): void {
    this.statistics.totalRecords++

    // Update average quality score
    this.statistics.averageQualityScore =
      (this.statistics.averageQualityScore * (this.statistics.totalRecords - 1) + qualityScore.overall) /
      this.statistics.totalRecords

    // Update quality distribution
    if (qualityScore.overall > 0.9) {
      this.statistics.qualityDistribution.excellent++
    } else if (qualityScore.overall > 0.7) {
      this.statistics.qualityDistribution.good++
    } else if (qualityScore.overall > 0.5) {
      this.statistics.qualityDistribution.fair++
    } else {
      this.statistics.qualityDistribution.poor++
    }

    // Update source performance
    if (!this.statistics.sourcePerformance[source]) {
      this.statistics.sourcePerformance[source] = {
        averageScore: 0,
        recordCount: 0,
        lastUpdated: 0
      }
    }

    const sourceStats = this.statistics.sourcePerformance[source]
    sourceStats.averageScore =
      (sourceStats.averageScore * sourceStats.recordCount + qualityScore.overall) /
      (sourceStats.recordCount + 1)
    sourceStats.recordCount++
    sourceStats.lastUpdated = Date.now()

    // Update data type performance
    if (!this.statistics.dataTypePerformance[dataType]) {
      this.statistics.dataTypePerformance[dataType] = {
        averageScore: 0,
        recordCount: 0,
        commonIssues: []
      }
    }

    const typeStats = this.statistics.dataTypePerformance[dataType]
    typeStats.averageScore =
      (typeStats.averageScore * typeStats.recordCount + qualityScore.overall) /
      (typeStats.recordCount + 1)
    typeStats.recordCount++
  }

  /**
   * Check for quality alerts
   */
  private checkQualityAlerts(
    dataType: string,
    source: string,
    qualityScore: QualityScore
  ): void {
    const alerts: Omit<QualityAlert, 'id' | 'timestamp' | 'resolved'>[] = []

    // Overall quality alert
    if (qualityScore.overall < this.thresholds.overall) {
      alerts.push({
        severity: qualityScore.overall < 0.3 ? 'critical' : 'warning',
        message: `Overall quality score (${qualityScore.overall.toFixed(3)}) below threshold (${this.thresholds.overall})`,
        source,
        dataType,
        metric: 'overall',
        currentValue: qualityScore.overall,
        threshold: this.thresholds.overall
      })
    }

    // Individual metric alerts
    const metrics = qualityScore.metrics
    const metricChecks = [
      { name: 'freshness', value: metrics.freshness, threshold: this.thresholds.freshness },
      { name: 'completeness', value: metrics.completeness, threshold: this.thresholds.completeness },
      { name: 'accuracy', value: metrics.accuracy, threshold: this.thresholds.accuracy },
      { name: 'sourceReputation', value: metrics.sourceReputation, threshold: this.thresholds.sourceReputation },
      { name: 'latency', value: metrics.latency, threshold: this.thresholds.latency, inverse: true }
    ]

    metricChecks.forEach(check => {
      const belowThreshold = check.inverse
        ? check.value > check.threshold
        : check.value < check.threshold

      if (belowThreshold) {
        const severity = (check.inverse ? check.value > check.threshold * 2 : check.value < check.threshold * 0.5)
          ? 'critical' : 'warning'

        alerts.push({
          severity,
          message: `${check.name} metric (${check.value.toFixed(3)}) ${check.inverse ? 'exceeds' : 'below'} threshold (${check.threshold})`,
          source,
          dataType,
          metric: check.name,
          currentValue: check.value,
          threshold: check.threshold
        })
      }
    })

    // Create alert objects
    alerts.forEach(alertData => {
      const alertId = `${alertData.source}:${alertData.dataType}:${alertData.metric}:${Date.now()}`

      const alert: QualityAlert = {
        id: alertId,
        timestamp: Date.now(),
        resolved: false,
        ...alertData
      }

      this.alerts.set(alertId, alert)
      this.statistics.alertSummary[alertData.severity as keyof typeof this.statistics.alertSummary]++
    })
  }

  /**
   * Analyze trends in quality data
   */
  private analyzeTrends(): QualityTrend[] {
    const trends: QualityTrend[] = []

    for (const [key, history] of Array.from(this.qualityHistory.entries())) {
      if (history.length < this.trendWindowSize) continue

      const [source, dataType] = key.split(':')
      const recentHistory = history.slice(-this.trendWindowSize)

      // Analyze overall quality trend
      const overallTrend = this.calculateTrend(
        recentHistory.map(score => ({ timestamp: score.timestamp, value: score.overall }))
      )

      if (overallTrend) {
        trends.push({
          metric: 'overall',
          source,
          dataType,
          values: overallTrend.values,
          trend: overallTrend.trend,
          changePercent: overallTrend.changePercent
        })
      }

      // Analyze individual metric trends
      const metricNames = ['freshness', 'completeness', 'accuracy', 'sourceReputation', 'latency']
      metricNames.forEach(metricName => {
        const metricTrend = this.calculateTrend(
          recentHistory.map(score => ({
            timestamp: score.timestamp,
            value: score.metrics[metricName as keyof DataQualityMetrics] as number
          }))
        )

        if (metricTrend) {
          trends.push({
            metric: metricName,
            source,
            dataType,
            values: metricTrend.values,
            trend: metricTrend.trend,
            changePercent: metricTrend.changePercent
          })
        }
      })
    }

    return trends
  }

  /**
   * Calculate trend for a series of values
   */
  private calculateTrend(
    values: Array<{ timestamp: number; value: number }>
  ): { values: Array<{ timestamp: number; value: number }>; trend: 'improving' | 'declining' | 'stable'; changePercent: number } | null {
    if (values.length < 10) return null

    // Sort by timestamp
    values.sort((a, b) => a.timestamp - b.timestamp)

    // Calculate linear regression
    const n = values.length
    const sumX = values.reduce((sum, v, i) => sum + i, 0)
    const sumY = values.reduce((sum, v) => sum + v.value, 0)
    const sumXY = values.reduce((sum, v, i) => sum + i * v.value, 0)
    const sumXX = values.reduce((sum, v, i) => sum + i * i, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)

    // Determine trend direction
    const firstValue = values[0].value
    const lastValue = values[values.length - 1].value
    const changePercent = ((lastValue - firstValue) / firstValue) * 100

    let trend: 'improving' | 'declining' | 'stable'
    if (Math.abs(changePercent) < 5) {
      trend = 'stable'
    } else if (slope > 0) {
      trend = 'improving'
    } else {
      trend = 'declining'
    }

    return {
      values,
      trend,
      changePercent: Math.abs(changePercent)
    }
  }

  /**
   * Update trends for a source/dataType combination
   */
  private updateTrends(dataType: string, source: string): void {
    // This method can be extended to trigger real-time trend analysis
    // For now, trends are calculated on-demand in analyzeTrends()
  }

  /**
   * Generate recommendations based on alerts and trends
   */
  private generateRecommendations(alerts: QualityAlert[], trends: QualityTrend[]): string[] {
    const recommendations: string[] = []

    // Source-based recommendations
    const sourceAlerts = alerts.reduce((acc, alert) => {
      if (!acc[alert.source]) acc[alert.source] = []
      acc[alert.source].push(alert)
      return acc
    }, {} as Record<string, QualityAlert[]>)

    Object.entries(sourceAlerts).forEach(([source, sourceAlerts]) => {
      const criticalAlerts = sourceAlerts.filter(a => a.severity === 'critical')
      if (criticalAlerts.length > 3) {
        recommendations.push(`Consider investigating ${source} data source - ${criticalAlerts.length} critical quality issues detected`)
      }

      const latencyAlerts = sourceAlerts.filter(a => a.metric === 'latency')
      if (latencyAlerts.length > 0) {
        recommendations.push(`Optimize ${source} connection or caching strategy to improve response times`)
      }
    })

    // Trend-based recommendations
    const decliningTrends = trends.filter(t => t.trend === 'declining' && t.changePercent > 10)
    decliningTrends.forEach(trend => {
      recommendations.push(`${trend.source} ${trend.dataType} ${trend.metric} quality declining (${trend.changePercent.toFixed(1)}%) - investigate data source`)
    })

    // Data type recommendations
    const dataTypeIssues = alerts.reduce((acc, alert) => {
      if (!acc[alert.dataType]) acc[alert.dataType] = 0
      acc[alert.dataType]++
      return acc
    }, {} as Record<string, number>)

    Object.entries(dataTypeIssues).forEach(([dataType, count]) => {
      if (count > 5) {
        recommendations.push(`Consider reviewing ${dataType} validation rules - ${count} quality alerts detected`)
      }
    })

    return recommendations
  }

  /**
   * Re-evaluate alerts with new thresholds
   */
  private reevaluateAlerts(): void {
    // Clear existing alerts and recalculate
    this.alerts.clear()
    this.statistics.alertSummary = { critical: 0, warning: 0, info: 0, resolved: 0 }

    // Re-run alert checks for recent quality scores
    for (const [key, history] of Array.from(this.qualityHistory.entries())) {
      const [source, dataType] = key.split(':')
      const recentScores = history.slice(-10) // Check last 10 scores

      recentScores.forEach(score => {
        this.checkQualityAlerts(dataType, source, score)
      })
    }
  }
}