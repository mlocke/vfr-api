/**
 * Admin API - ML Performance Metrics
 * Provides detailed performance monitoring and analytics for ML services
 * Supports real-time metrics, historical data, and performance benchmarks
 */

import { NextRequest, NextResponse } from 'next/server'
import { mlMonitoringService } from '../../../services/admin/MLMonitoringService'
import { dataSourceConfigManager } from '../../../services/admin/DataSourceConfigManager'
import ErrorHandler from '../../../services/error-handling/ErrorHandler'

const errorHandler = ErrorHandler.getInstance()

/**
 * GET /api/admin/ml-performance
 * Retrieve comprehensive ML performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Validate admin access
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || 'dev-admin-token'

    const hasAccess = await dataSourceConfigManager.validateAdminAccess(token)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '1h'
    const serviceId = searchParams.get('serviceId')
    const includeHistory = searchParams.get('includeHistory') === 'true'

    // Get current performance metrics
    const performanceMetrics = await mlMonitoringService.getMLPerformanceMetrics()

    // Filter by service if specified
    let filteredMetrics = performanceMetrics
    if (serviceId) {
      filteredMetrics = performanceMetrics.filter(m => m.serviceId === serviceId)
    }

    // Get current ML services status
    const mlServices = await mlMonitoringService.getAllMLServices()

    // Calculate system-wide performance statistics
    const systemStats = {
      totalServices: mlServices.length,
      healthyServices: mlServices.filter(s => s.status === 'healthy').length,
      enabledServices: mlServices.filter(s => s.enabled).length,
      avgResponseTime: filteredMetrics.reduce((sum, m) => sum + m.metrics.averageLatency, 0) / (filteredMetrics.length || 1),
      totalRequests: filteredMetrics.reduce((sum, m) => sum + m.metrics.requestsPerMinute, 0),
      systemErrorRate: filteredMetrics.reduce((sum, m) => sum + m.metrics.errorRate, 0) / (filteredMetrics.length || 1),
      overallCacheHitRate: filteredMetrics.reduce((sum, m) => sum + m.metrics.cacheHitRate, 0) / (filteredMetrics.length || 1)
    }

    // Generate performance insights
    const insights = generatePerformanceInsights(filteredMetrics, mlServices)

    // Performance alerts
    const alerts = generatePerformanceAlerts(filteredMetrics, mlServices)

    return NextResponse.json({
      success: true,
      metrics: filteredMetrics,
      systemStats,
      insights,
      alerts,
      timeRange,
      includeHistory,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('❌ ML performance metrics retrieval failed:', error)

    const sanitizedError = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to retrieve ML performance metrics',
        details: sanitizedError,
        timestamp: Date.now()
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/ml-performance
 * Run performance benchmarks or collect specific metrics
 */
export async function POST(request: NextRequest) {
  try {
    // Validate admin access
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || 'dev-admin-token'

    const hasAccess = await dataSourceConfigManager.validateAdminAccess(token)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, config } = body

    switch (action) {
      case 'run_benchmark':
        // Run comprehensive performance benchmark
        const benchmarkResults = await runMLPerformanceBenchmark(config)

        return NextResponse.json({
          success: true,
          action: 'run_benchmark',
          results: benchmarkResults,
          timestamp: Date.now()
        })

      case 'stress_test_all':
        // Run stress test on all enabled ML services
        const enabledServices = mlMonitoringService.getEnabledMLServices()
        const stressResults = await Promise.allSettled(
          enabledServices.map(serviceId =>
            mlMonitoringService.testMLService(serviceId, 'stress')
          )
        )

        const processedStressResults = stressResults.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value
          } else {
            return {
              serviceId: enabledServices[index],
              success: false,
              error: result.reason?.message || 'Stress test failed',
              timestamp: Date.now(),
              testType: 'stress'
            }
          }
        })

        return NextResponse.json({
          success: true,
          action: 'stress_test_all',
          results: processedStressResults,
          summary: {
            totalServices: processedStressResults.length,
            passedStress: processedStressResults.filter(r => r.success).length,
            failedStress: processedStressResults.filter(r => !r.success).length
          },
          timestamp: Date.now()
        })

      case 'collect_metrics':
        // Collect fresh metrics from all services
        const freshMetrics = await mlMonitoringService.getMLPerformanceMetrics()
        const mlServices = await mlMonitoringService.getAllMLServices()

        return NextResponse.json({
          success: true,
          action: 'collect_metrics',
          metrics: freshMetrics,
          services: mlServices,
          timestamp: Date.now()
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ ML performance action failed:', error)

    const sanitizedError = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to execute ML performance action',
        details: sanitizedError,
        timestamp: Date.now()
      },
      { status: 500 }
    )
  }
}

/**
 * Run comprehensive ML performance benchmark
 */
async function runMLPerformanceBenchmark(config: any = {}) {
  const enabledServices = mlMonitoringService.getEnabledMLServices()
  const iterations = config.iterations || 10
  const concurrency = config.concurrency || 3

  const results = {
    summary: {
      totalServices: enabledServices.length,
      totalIterations: iterations * enabledServices.length,
      startTime: Date.now(),
      endTime: 0
    },
    serviceResults: [] as any[],
    systemPerformance: {
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      throughput: 0,
      errorRate: 0
    }
  }

  try {
    // Run performance tests for each service
    for (const serviceId of enabledServices) {
      const serviceStart = Date.now()
      const responseTimes: number[] = []
      let successCount = 0

      // Run multiple iterations for each service
      for (let i = 0; i < iterations; i++) {
        try {
          const testResult = await mlMonitoringService.testMLService(serviceId, 'performance')
          if (testResult.success) {
            responseTimes.push(testResult.responseTime)
            successCount++
          }
        } catch (error) {
          // Track error
        }

        // Delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Calculate service-specific metrics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      const sortedTimes = responseTimes.sort((a, b) => a - b)
      const p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0
      const p99ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0

      results.serviceResults.push({
        serviceId,
        iterations,
        successCount,
        successRate: successCount / iterations,
        avgResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        totalTime: Date.now() - serviceStart,
        throughput: successCount / ((Date.now() - serviceStart) / 1000) // requests per second
      })
    }

    results.summary.endTime = Date.now()

    // Calculate system-wide performance metrics
    const allResponseTimes = results.serviceResults.flatMap(sr => [sr.avgResponseTime])
    results.systemPerformance.avgResponseTime = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
    results.systemPerformance.p95ResponseTime = results.serviceResults.reduce((max, sr) => Math.max(max, sr.p95ResponseTime), 0)
    results.systemPerformance.p99ResponseTime = results.serviceResults.reduce((max, sr) => Math.max(max, sr.p99ResponseTime), 0)
    results.systemPerformance.throughput = results.serviceResults.reduce((sum, sr) => sum + sr.throughput, 0)
    results.systemPerformance.errorRate = 1 - (results.serviceResults.reduce((sum, sr) => sum + sr.successRate, 0) / results.serviceResults.length)

    return results

  } catch (error) {
    results.summary.endTime = Date.now()
    throw error
  }
}

/**
 * Generate performance insights based on metrics
 */
function generatePerformanceInsights(metrics: any[], services: any[]) {
  const insights = []

  // Response time analysis
  const avgResponseTimes = metrics.map(m => m.metrics.averageLatency).filter(t => t > 0)
  if (avgResponseTimes.length > 0) {
    const maxResponseTime = Math.max(...avgResponseTimes)
    const avgResponseTime = avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length

    if (maxResponseTime > 2000) {
      insights.push({
        type: 'warning',
        category: 'performance',
        message: `High response time detected: ${maxResponseTime.toFixed(0)}ms`,
        recommendation: 'Consider optimizing slow services or increasing cache TTL'
      })
    }

    if (avgResponseTime < 500) {
      insights.push({
        type: 'success',
        category: 'performance',
        message: `Excellent average response time: ${avgResponseTime.toFixed(0)}ms`,
        recommendation: 'System is performing well'
      })
    }
  }

  // Cache hit rate analysis
  const cacheMetrics = metrics.filter(m => m.metrics.cacheHitRate > 0)
  if (cacheMetrics.length > 0) {
    const avgCacheHitRate = cacheMetrics.reduce((sum, m) => sum + m.metrics.cacheHitRate, 0) / cacheMetrics.length

    if (avgCacheHitRate < 0.6) {
      insights.push({
        type: 'warning',
        category: 'caching',
        message: `Low cache hit rate: ${(avgCacheHitRate * 100).toFixed(1)}%`,
        recommendation: 'Review cache TTL settings or cache invalidation strategy'
      })
    } else if (avgCacheHitRate > 0.85) {
      insights.push({
        type: 'success',
        category: 'caching',
        message: `Excellent cache hit rate: ${(avgCacheHitRate * 100).toFixed(1)}%`,
        recommendation: 'Cache is working efficiently'
      })
    }
  }

  // Service health analysis
  const healthyServices = services.filter(s => s.status === 'healthy' && s.enabled)
  const totalEnabledServices = services.filter(s => s.enabled)

  if (healthyServices.length < totalEnabledServices.length) {
    insights.push({
      type: 'error',
      category: 'availability',
      message: `${totalEnabledServices.length - healthyServices.length} services are not healthy`,
      recommendation: 'Check service logs and dependencies'
    })
  } else if (healthyServices.length === totalEnabledServices.length && totalEnabledServices.length > 0) {
    insights.push({
      type: 'success',
      category: 'availability',
      message: 'All enabled ML services are healthy',
      recommendation: 'System is operating normally'
    })
  }

  return insights
}

/**
 * Generate performance alerts based on thresholds
 */
function generatePerformanceAlerts(metrics: any[], services: any[]) {
  const alerts: Array<{
    severity: 'critical' | 'warning';
    serviceId: string;
    type: string;
    message: string;
    threshold?: number;
    value?: number;
    status?: string;
  }> = []

  // Critical performance alerts
  metrics.forEach(metric => {
    if (metric.metrics.averageLatency > 3000) {
      alerts.push({
        severity: 'critical',
        serviceId: metric.serviceId,
        type: 'high_latency',
        message: `Critical latency: ${metric.metrics.averageLatency.toFixed(0)}ms`,
        threshold: 3000,
        value: metric.metrics.averageLatency
      })
    }

    if (metric.metrics.errorRate > 0.1) {
      alerts.push({
        severity: 'critical',
        serviceId: metric.serviceId,
        type: 'high_error_rate',
        message: `High error rate: ${(metric.metrics.errorRate * 100).toFixed(1)}%`,
        threshold: 0.1,
        value: metric.metrics.errorRate
      })
    }
  })

  // Service availability alerts
  services.forEach(service => {
    if (service.enabled && service.status !== 'healthy') {
      alerts.push({
        severity: service.status === 'offline' ? 'critical' : 'warning',
        serviceId: service.id,
        type: 'service_unavailable',
        message: `Service ${service.name} is ${service.status}`,
        status: service.status
      })
    }
  })

  return alerts
}