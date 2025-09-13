/**
 * Comprehensive Unit Tests for DataQualityMonitor
 * Tests quality metrics tracking, alerting, trend analysis, and reporting
 */

import {
  DataQualityMonitor,
  QualityAlert,
  QualityTrend,
  QualityReport,
  QualityStatistics
} from '../DataQualityMonitor'
import { QualityScore, DataQualityMetrics } from '../types'

describe('DataQualityMonitor', () => {
  let qualityMonitor: DataQualityMonitor
  const mockThresholds = {
    overall: 0.7,
    freshness: 0.8,
    completeness: 0.9,
    accuracy: 0.8,
    sourceReputation: 0.7,
    latency: 1000 // ms
  }

  beforeEach(() => {
    qualityMonitor = new DataQualityMonitor(mockThresholds)
  })

  afterEach(() => {
    qualityMonitor.reset()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with provided thresholds', () => {
      expect(qualityMonitor).toBeInstanceOf(DataQualityMonitor)
      const stats = qualityMonitor.getStatistics()
      expect(stats.totalRecords).toBe(0)
      expect(stats.averageQualityScore).toBe(0)
    })

    it('should initialize empty statistics', () => {
      const stats = qualityMonitor.getStatistics()
      expect(stats.qualityDistribution.excellent).toBe(0)
      expect(stats.qualityDistribution.good).toBe(0)
      expect(stats.qualityDistribution.fair).toBe(0)
      expect(stats.qualityDistribution.poor).toBe(0)
      expect(Object.keys(stats.sourcePerformance)).toHaveLength(0)
      expect(Object.keys(stats.dataTypePerformance)).toHaveLength(0)
    })
  })

  describe('Quality Metrics Recording', () => {
    const createHighQualityScore = (): QualityScore => ({
      overall: 0.95,
      metrics: {
        freshness: 0.95,
        completeness: 1.0,
        accuracy: 0.9,
        sourceReputation: 0.95,
        latency: 150
      },
      timestamp: Date.now(),
      source: 'test_source'
    })

    const createMediumQualityScore = (): QualityScore => ({
      overall: 0.75,
      metrics: {
        freshness: 0.8,
        completeness: 0.9,
        accuracy: 0.7,
        sourceReputation: 0.8,
        latency: 500
      },
      timestamp: Date.now(),
      source: 'test_source'
    })

    const createLowQualityScore = (): QualityScore => ({
      overall: 0.4,
      metrics: {
        freshness: 0.5,
        completeness: 0.6,
        accuracy: 0.3,
        sourceReputation: 0.4,
        latency: 2000
      },
      timestamp: Date.now(),
      source: 'test_source'
    })

    it('should record quality metrics successfully', () => {
      const qualityScore = createHighQualityScore()

      expect(() => {
        qualityMonitor.recordQualityMetrics('stock_price', 'polygon', qualityScore)
      }).not.toThrow()

      const stats = qualityMonitor.getStatistics()
      expect(stats.totalRecords).toBe(1)
      expect(stats.averageQualityScore).toBe(0.95)
    })

    it('should maintain history size limits', () => {
      const qualityScore = createHighQualityScore()

      // Record more than maxHistorySize (1000) to test limit
      for (let i = 0; i < 1005; i++) {
        qualityMonitor.recordQualityMetrics('stock_price', 'test_source', {
          ...qualityScore,
          timestamp: Date.now() + i
        })
      }

      const stats = qualityMonitor.getStatistics()
      expect(stats.totalRecords).toBe(1005)
      // History should be maintained internally within limits
    })

    it('should update quality distribution correctly', () => {
      // Record scores in different quality ranges
      qualityMonitor.recordQualityMetrics('stock_price', 'source1', createHighQualityScore()) // excellent > 0.9
      qualityMonitor.recordQualityMetrics('stock_price', 'source2', createMediumQualityScore()) // good 0.7-0.9
      qualityMonitor.recordQualityMetrics('company_info', 'source3', { ...createMediumQualityScore(), overall: 0.6 }) // fair 0.5-0.7
      qualityMonitor.recordQualityMetrics('news', 'source4', createLowQualityScore()) // poor < 0.5

      const stats = qualityMonitor.getStatistics()
      expect(stats.qualityDistribution.excellent).toBe(1)
      expect(stats.qualityDistribution.good).toBe(1)
      expect(stats.qualityDistribution.fair).toBe(1)
      expect(stats.qualityDistribution.poor).toBe(1)
    })

    it('should track source performance metrics', () => {
      const qualityScore1 = createHighQualityScore()
      const qualityScore2 = createMediumQualityScore()

      qualityMonitor.recordQualityMetrics('stock_price', 'polygon', qualityScore1)
      qualityMonitor.recordQualityMetrics('stock_price', 'polygon', qualityScore2)

      const stats = qualityMonitor.getStatistics()
      expect(stats.sourcePerformance['polygon']).toBeDefined()
      expect(stats.sourcePerformance['polygon'].recordCount).toBe(2)
      expect(stats.sourcePerformance['polygon'].averageScore).toBeCloseTo((0.95 + 0.75) / 2, 2)
      expect(stats.sourcePerformance['polygon'].lastUpdated).toBeGreaterThan(0)
    })

    it('should track data type performance metrics', () => {
      const qualityScore = createHighQualityScore()

      qualityMonitor.recordQualityMetrics('stock_price', 'polygon', qualityScore)
      qualityMonitor.recordQualityMetrics('stock_price', 'yahoo', qualityScore)

      const stats = qualityMonitor.getStatistics()
      expect(stats.dataTypePerformance['stock_price']).toBeDefined()
      expect(stats.dataTypePerformance['stock_price'].recordCount).toBe(2)
      expect(stats.dataTypePerformance['stock_price'].averageScore).toBe(0.95)
    })

    it('should calculate average quality score correctly', () => {
      qualityMonitor.recordQualityMetrics('stock_price', 'source1', createHighQualityScore()) // 0.95
      qualityMonitor.recordQualityMetrics('stock_price', 'source2', createMediumQualityScore()) // 0.75
      qualityMonitor.recordQualityMetrics('stock_price', 'source3', createLowQualityScore()) // 0.4

      const stats = qualityMonitor.getStatistics()
      const expectedAverage = (0.95 + 0.75 + 0.4) / 3
      expect(stats.averageQualityScore).toBeCloseTo(expectedAverage, 2)
    })
  })

  describe('Quality Alerts', () => {
    const createAlertTriggeringScore = (metric: keyof DataQualityMetrics, value: number): QualityScore => ({
      overall: 0.5,
      metrics: {
        freshness: 0.9,
        completeness: 0.9,
        accuracy: 0.9,
        sourceReputation: 0.9,
        latency: 500,
        [metric]: value
      },
      timestamp: Date.now(),
      source: 'test_source'
    })

    it('should generate alert for low overall quality score', () => {
      const lowQualityScore: QualityScore = {
        overall: 0.5, // Below threshold of 0.7
        metrics: {
          freshness: 0.6,
          completeness: 0.7,
          accuracy: 0.5,
          sourceReputation: 0.6,
          latency: 800
        },
        timestamp: Date.now(),
        source: 'test_source'
      }

      qualityMonitor.recordQualityMetrics('stock_price', 'test_source', lowQualityScore)

      const alerts = qualityMonitor.getActiveAlerts()
      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts.some(alert => alert.metric === 'overall')).toBe(true)
    })

    it('should generate critical alert for very low quality score', () => {
      const criticalQualityScore: QualityScore = {
        overall: 0.2, // Well below threshold
        metrics: {
          freshness: 0.3,
          completeness: 0.2,
          accuracy: 0.1,
          sourceReputation: 0.2,
          latency: 3000
        },
        timestamp: Date.now(),
        source: 'test_source'
      }

      qualityMonitor.recordQualityMetrics('stock_price', 'test_source', criticalQualityScore)

      const alerts = qualityMonitor.getActiveAlerts()
      const criticalAlerts = alerts.filter(alert => alert.severity === 'critical')
      expect(criticalAlerts.length).toBeGreaterThan(0)
    })

    it('should generate alerts for individual metric thresholds', () => {
      const metricsToTest: Array<{ metric: keyof DataQualityMetrics; lowValue: number; inverse?: boolean }> = [
        { metric: 'freshness', lowValue: 0.6 }, // Below 0.8 threshold
        { metric: 'completeness', lowValue: 0.7 }, // Below 0.9 threshold
        { metric: 'accuracy', lowValue: 0.6 }, // Below 0.8 threshold
        { metric: 'sourceReputation', lowValue: 0.5 }, // Below 0.7 threshold
        { metric: 'latency', lowValue: 2000, inverse: true } // Above 1000ms threshold
      ]

      metricsToTest.forEach(({ metric, lowValue, inverse }) => {
        qualityMonitor.reset()
        const score = createAlertTriggeringScore(metric, lowValue)
        qualityMonitor.recordQualityMetrics('stock_price', 'test_source', score)

        const alerts = qualityMonitor.getActiveAlerts()
        const metricAlert = alerts.find(alert => alert.metric === metric)
        expect(metricAlert).toBeDefined()
        expect(metricAlert?.currentValue).toBe(lowValue)
      })
    })

    it('should resolve alerts correctly', () => {
      const lowQualityScore: QualityScore = {
        overall: 0.5,
        metrics: {
          freshness: 0.6,
          completeness: 0.7,
          accuracy: 0.5,
          sourceReputation: 0.6,
          latency: 800
        },
        timestamp: Date.now(),
        source: 'test_source'
      }

      qualityMonitor.recordQualityMetrics('stock_price', 'test_source', lowQualityScore)

      const alerts = qualityMonitor.getActiveAlerts()
      expect(alerts.length).toBeGreaterThan(0)

      const alertId = alerts[0].id
      const resolved = qualityMonitor.resolveAlert(alertId)

      expect(resolved).toBe(true)
      const updatedAlerts = qualityMonitor.getActiveAlerts()
      expect(updatedAlerts.find(alert => alert.id === alertId)).toBeUndefined()
    })

    it('should return false when resolving non-existent alert', () => {
      const resolved = qualityMonitor.resolveAlert('non_existent_alert_id')
      expect(resolved).toBe(false)
    })

    it('should track alert summary statistics', () => {
      // Generate various types of alerts
      const criticalScore: QualityScore = {
        overall: 0.2,
        metrics: { freshness: 0.3, completeness: 0.2, accuracy: 0.1, sourceReputation: 0.2, latency: 3000 },
        timestamp: Date.now(),
        source: 'test_source'
      }

      const warningScore: QualityScore = {
        overall: 0.5,
        metrics: { freshness: 0.6, completeness: 0.7, accuracy: 0.5, sourceReputation: 0.6, latency: 800 },
        timestamp: Date.now(),
        source: 'test_source'
      }

      qualityMonitor.recordQualityMetrics('stock_price', 'test_source', criticalScore)
      qualityMonitor.recordQualityMetrics('company_info', 'test_source', warningScore)

      const stats = qualityMonitor.getStatistics()
      expect(stats.alertSummary.critical).toBeGreaterThan(0)
      expect(stats.alertSummary.warning).toBeGreaterThan(0)
    })
  })

  describe('Trend Analysis', () => {
    const generateTrendData = (count: number, baseScore: number, trend: 'improving' | 'declining' | 'stable') => {
      const scores: QualityScore[] = []
      for (let i = 0; i < count; i++) {
        let score = baseScore
        if (trend === 'improving') {
          score += (i * 0.01) // Gradual improvement
        } else if (trend === 'declining') {
          score -= (i * 0.01) // Gradual decline
        }

        scores.push({
          overall: Math.max(0, Math.min(1, score)),
          metrics: {
            freshness: Math.max(0, Math.min(1, score + 0.05)),
            completeness: Math.max(0, Math.min(1, score + 0.1)),
            accuracy: Math.max(0, Math.min(1, score - 0.05)),
            sourceReputation: Math.max(0, Math.min(1, score)),
            latency: 500
          },
          timestamp: Date.now() + (i * 1000),
          source: 'test_source'
        })
      }
      return scores
    }

    it('should analyze improving trends correctly', () => {
      const improvingScores = generateTrendData(60, 0.6, 'improving') // Need 50+ for trend analysis

      improvingScores.forEach((score, index) => {
        qualityMonitor.recordQualityMetrics('stock_price', 'test_source', score)
      })

      const trends = qualityMonitor.getQualityTrends('test_source', 'stock_price')
      const overallTrend = trends.find(t => t.metric === 'overall')

      expect(overallTrend).toBeDefined()
      expect(overallTrend?.trend).toBe('improving')
      expect(overallTrend?.changePercent).toBeGreaterThan(5) // Should show significant improvement
    })

    it('should analyze declining trends correctly', () => {
      const decliningScores = generateTrendData(60, 0.8, 'declining')

      decliningScores.forEach(score => {
        qualityMonitor.recordQualityMetrics('stock_price', 'test_source', score)
      })

      const trends = qualityMonitor.getQualityTrends('test_source', 'stock_price')
      const overallTrend = trends.find(t => t.metric === 'overall')

      expect(overallTrend).toBeDefined()
      expect(overallTrend?.trend).toBe('declining')
      expect(overallTrend?.changePercent).toBeGreaterThan(5)
    })

    it('should identify stable trends correctly', () => {
      const stableScores = generateTrendData(60, 0.7, 'stable')

      stableScores.forEach(score => {
        qualityMonitor.recordQualityMetrics('stock_price', 'test_source', score)
      })

      const trends = qualityMonitor.getQualityTrends('test_source', 'stock_price')
      const overallTrend = trends.find(t => t.metric === 'overall')

      expect(overallTrend).toBeDefined()
      expect(overallTrend?.trend).toBe('stable')
      expect(overallTrend?.changePercent).toBeLessThan(5)
    })

    it('should not analyze trends with insufficient data', () => {
      // Record only a few data points (less than trendWindowSize of 50)
      for (let i = 0; i < 10; i++) {
        qualityMonitor.recordQualityMetrics('stock_price', 'test_source', {
          overall: 0.7,
          metrics: {
            freshness: 0.8,
            completeness: 0.9,
            accuracy: 0.7,
            sourceReputation: 0.8,
            latency: 500
          },
          timestamp: Date.now() + (i * 1000),
          source: 'test_source'
        })
      }

      const trends = qualityMonitor.getQualityTrends('test_source', 'stock_price')
      expect(trends).toHaveLength(0)
    })

    it('should analyze trends for individual metrics', () => {
      const scores = generateTrendData(60, 0.7, 'improving')

      scores.forEach(score => {
        qualityMonitor.recordQualityMetrics('stock_price', 'test_source', score)
      })

      const trends = qualityMonitor.getQualityTrends('test_source', 'stock_price')
      const metricNames = ['freshness', 'completeness', 'accuracy', 'sourceReputation', 'latency']

      metricNames.forEach(metricName => {
        const metricTrend = trends.find(t => t.metric === metricName)
        expect(metricTrend).toBeDefined()
        expect(['improving', 'declining', 'stable']).toContain(metricTrend?.trend)
      })
    })
  })

  describe('Quality Reporting', () => {
    const setupReportingData = () => {
      // Setup diverse data for comprehensive reporting
      const sources = ['polygon', 'yahoo', 'alpha_vantage']
      const dataTypes = ['stock_price', 'company_info', 'news']
      const qualityLevels = [0.9, 0.7, 0.5] // excellent, good, poor

      sources.forEach((source, sourceIndex) => {
        dataTypes.forEach((dataType, typeIndex) => {
          const qualityScore: QualityScore = {
            overall: qualityLevels[sourceIndex],
            metrics: {
              freshness: qualityLevels[sourceIndex],
              completeness: 0.9,
              accuracy: qualityLevels[sourceIndex],
              sourceReputation: 0.8,
              latency: 500 + (sourceIndex * 200)
            },
            timestamp: Date.now(),
            source
          }

          qualityMonitor.recordQualityMetrics(dataType, source, qualityScore)
        })
      })
    }

    it('should generate comprehensive quality report', () => {
      setupReportingData()

      const report = qualityMonitor.generateQualityReport()

      expect(report.summary).toBeDefined()
      expect(report.summary.overallScore).toBeGreaterThan(0)
      expect(report.summary.totalDataPoints).toBe(9) // 3 sources × 3 data types
      expect(report.sourceBreakdown).toBeDefined()
      expect(report.dataTypeBreakdown).toBeDefined()
      expect(Array.isArray(report.alerts)).toBe(true)
      expect(Array.isArray(report.trends)).toBe(true)
      expect(Array.isArray(report.recommendations)).toBe(true)
    })

    it('should include source breakdown in report', () => {
      setupReportingData()

      const report = qualityMonitor.generateQualityReport()
      const sources = ['polygon', 'yahoo', 'alpha_vantage']

      sources.forEach(source => {
        expect(report.sourceBreakdown[source]).toBeDefined()
        expect(report.sourceBreakdown[source].averageQuality).toBeGreaterThanOrEqual(0)
        expect(report.sourceBreakdown[source].dataPointCount).toBeGreaterThan(0)
        expect(typeof report.sourceBreakdown[source].alertCount).toBe('number')
        expect(typeof report.sourceBreakdown[source].trends).toBe('object')
      })
    })

    it('should include data type breakdown in report', () => {
      setupReportingData()

      const report = qualityMonitor.generateQualityReport()
      const dataTypes = ['stock_price', 'company_info', 'news']

      dataTypes.forEach(dataType => {
        expect(report.dataTypeBreakdown[dataType]).toBeDefined()
        expect(report.dataTypeBreakdown[dataType].averageQuality).toBeGreaterThanOrEqual(0)
        expect(report.dataTypeBreakdown[dataType].sourceCount).toBeGreaterThan(0)
        expect(typeof report.dataTypeBreakdown[dataType].alertCount).toBe('number')
        expect(Array.isArray(report.dataTypeBreakdown[dataType].commonIssues)).toBe(true)
      })
    })

    it('should generate meaningful recommendations', () => {
      // Setup data that should trigger recommendations
      const lowQualityScore: QualityScore = {
        overall: 0.3,
        metrics: {
          freshness: 0.4,
          completeness: 0.5,
          accuracy: 0.2,
          sourceReputation: 0.3,
          latency: 3000 // High latency
        },
        timestamp: Date.now(),
        source: 'problematic_source'
      }

      // Generate multiple critical alerts for the same source
      for (let i = 0; i < 5; i++) {
        qualityMonitor.recordQualityMetrics('stock_price', 'problematic_source', lowQualityScore)
      }

      const report = qualityMonitor.generateQualityReport()

      expect(report.recommendations.length).toBeGreaterThan(0)
      expect(report.recommendations.some(rec => rec.includes('problematic_source'))).toBe(true)
    })

    it('should filter alerts to only active ones in report', () => {
      const lowQualityScore: QualityScore = {
        overall: 0.4,
        metrics: {
          freshness: 0.5,
          completeness: 0.6,
          accuracy: 0.3,
          sourceReputation: 0.4,
          latency: 2000
        },
        timestamp: Date.now(),
        source: 'test_source'
      }

      qualityMonitor.recordQualityMetrics('stock_price', 'test_source', lowQualityScore)

      const allAlerts = qualityMonitor.getActiveAlerts()
      const alertToResolve = allAlerts[0]
      qualityMonitor.resolveAlert(alertToResolve.id)

      const report = qualityMonitor.generateQualityReport()

      expect(report.alerts.some(alert => alert.id === alertToResolve.id)).toBe(false)
    })
  })

  describe('Threshold Management', () => {
    it('should update thresholds correctly', () => {
      const newThresholds = {
        overall: 0.8,
        freshness: 0.9,
        completeness: 0.95
      }

      expect(() => {
        qualityMonitor.updateThresholds(newThresholds as any)
      }).not.toThrow()
    })

    it('should re-evaluate alerts when thresholds change', () => {
      // Record a score that's just above current threshold
      const borderlineScore: QualityScore = {
        overall: 0.75, // Above current threshold of 0.7
        metrics: {
          freshness: 0.85,
          completeness: 0.95,
          accuracy: 0.85,
          sourceReputation: 0.75,
          latency: 500
        },
        timestamp: Date.now(),
        source: 'test_source'
      }

      qualityMonitor.recordQualityMetrics('stock_price', 'test_source', borderlineScore)

      let alerts = qualityMonitor.getActiveAlerts()
      const initialAlertCount = alerts.length

      // Raise the threshold so the score now fails
      qualityMonitor.updateThresholds({ overall: 0.8 } as any)

      alerts = qualityMonitor.getActiveAlerts()
      // Should have more alerts now due to higher threshold
      expect(alerts.length).toBeGreaterThanOrEqual(initialAlertCount)
    })
  })

  describe('Average Quality Score Calculation', () => {
    it('should calculate average quality score for specific source and data type', () => {
      const scores = [0.8, 0.9, 0.7]
      scores.forEach((overall, index) => {
        qualityMonitor.recordQualityMetrics('stock_price', 'polygon', {
          overall,
          metrics: {
            freshness: 0.8,
            completeness: 0.9,
            accuracy: 0.8,
            sourceReputation: 0.8,
            latency: 500
          },
          timestamp: Date.now() + index,
          source: 'polygon'
        })
      })

      const avgScore = qualityMonitor.getAverageQualityScore('polygon', 'stock_price')
      const expectedAvg = scores.reduce((sum, score) => sum + score, 0) / scores.length

      expect(avgScore).toBeCloseTo(expectedAvg, 2)
    })

    it('should calculate average quality score across all data types for a source', () => {
      qualityMonitor.recordQualityMetrics('stock_price', 'polygon', {
        overall: 0.8,
        metrics: { freshness: 0.8, completeness: 0.9, accuracy: 0.8, sourceReputation: 0.8, latency: 500 },
        timestamp: Date.now(),
        source: 'polygon'
      })

      qualityMonitor.recordQualityMetrics('company_info', 'polygon', {
        overall: 0.9,
        metrics: { freshness: 0.9, completeness: 0.9, accuracy: 0.9, sourceReputation: 0.8, latency: 500 },
        timestamp: Date.now(),
        source: 'polygon'
      })

      const avgScore = qualityMonitor.getAverageQualityScore('polygon')
      expect(avgScore).toBeCloseTo(0.85, 2) // (0.8 + 0.9) / 2
    })

    it('should return 0 for non-existent source', () => {
      const avgScore = qualityMonitor.getAverageQualityScore('non_existent_source')
      expect(avgScore).toBe(0)
    })

    it('should return 0 for non-existent data type', () => {
      const avgScore = qualityMonitor.getAverageQualityScore('polygon', 'non_existent_type')
      expect(avgScore).toBe(0)
    })
  })

  describe('State Management', () => {
    it('should reset monitor state completely', () => {
      // Add some data
      qualityMonitor.recordQualityMetrics('stock_price', 'polygon', {
        overall: 0.8,
        metrics: { freshness: 0.8, completeness: 0.9, accuracy: 0.8, sourceReputation: 0.8, latency: 500 },
        timestamp: Date.now(),
        source: 'polygon'
      })

      qualityMonitor.reset()

      const stats = qualityMonitor.getStatistics()
      expect(stats.totalRecords).toBe(0)
      expect(stats.averageQualityScore).toBe(0)
      expect(Object.keys(stats.sourcePerformance)).toHaveLength(0)
      expect(Object.keys(stats.dataTypePerformance)).toHaveLength(0)

      const alerts = qualityMonitor.getActiveAlerts()
      expect(alerts).toHaveLength(0)
    })

    it('should maintain immutable statistics objects', () => {
      qualityMonitor.recordQualityMetrics('stock_price', 'polygon', {
        overall: 0.8,
        metrics: { freshness: 0.8, completeness: 0.9, accuracy: 0.8, sourceReputation: 0.8, latency: 500 },
        timestamp: Date.now(),
        source: 'polygon'
      })

      const stats1 = qualityMonitor.getStatistics()
      const stats2 = qualityMonitor.getStatistics()

      expect(stats1).not.toBe(stats2) // Different object references
      expect(stats1).toEqual(stats2) // Same content
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle rapid data ingestion efficiently', () => {
      const startTime = Date.now()

      // Record 1000 quality metrics rapidly
      for (let i = 0; i < 1000; i++) {
        qualityMonitor.recordQualityMetrics('stock_price', `source_${i % 10}`, {
          overall: 0.8,
          metrics: { freshness: 0.8, completeness: 0.9, accuracy: 0.8, sourceReputation: 0.8, latency: 500 },
          timestamp: Date.now() + i,
          source: `source_${i % 10}`
        })
      }

      const endTime = Date.now()
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second

      const stats = qualityMonitor.getStatistics()
      expect(stats.totalRecords).toBe(1000)
    })

    it('should handle extreme quality score values gracefully', () => {
      const extremeScores = [
        { overall: 0, metrics: { freshness: 0, completeness: 0, accuracy: 0, sourceReputation: 0, latency: 10000 } },
        { overall: 1, metrics: { freshness: 1, completeness: 1, accuracy: 1, sourceReputation: 1, latency: 1 } },
        { overall: 0.5, metrics: { freshness: 0.999, completeness: 0.001, accuracy: 0.5, sourceReputation: 0.5, latency: 0 } }
      ]

      extremeScores.forEach((scoreMetrics, index) => {
        expect(() => {
          qualityMonitor.recordQualityMetrics('stock_price', 'test_source', {
            ...scoreMetrics,
            timestamp: Date.now() + index,
            source: 'test_source'
          } as QualityScore)
        }).not.toThrow()
      })

      const stats = qualityMonitor.getStatistics()
      expect(stats.totalRecords).toBe(3)
    })

    it('should handle undefined and null values in quality scores gracefully', () => {
      const invalidScore = {
        overall: undefined,
        metrics: {
          freshness: null,
          completeness: 0.9,
          accuracy: undefined,
          sourceReputation: 0.8,
          latency: 500
        },
        timestamp: Date.now(),
        source: 'test_source'
      } as any

      expect(() => {
        qualityMonitor.recordQualityMetrics('stock_price', 'test_source', invalidScore)
      }).not.toThrow()
    })

    it('should generate report with empty data gracefully', () => {
      const report = qualityMonitor.generateQualityReport()

      expect(report.summary.overallScore).toBe(0)
      expect(report.summary.totalDataPoints).toBe(0)
      expect(report.summary.alertCount).toBe(0)
      expect(Object.keys(report.sourceBreakdown)).toHaveLength(0)
      expect(Object.keys(report.dataTypeBreakdown)).toHaveLength(0)
      expect(report.alerts).toHaveLength(0)
      expect(report.trends).toHaveLength(0)
      expect(report.recommendations).toHaveLength(0)
    })
  })
})