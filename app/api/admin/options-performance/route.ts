/**
 * Options Performance Monitoring API
 * Provides real-time performance metrics and benchmarking
 */

import { NextRequest, NextResponse } from 'next/server'
import { OptionsAnalysisService } from '../../../services/financial-data/OptionsAnalysisService'
import { OptionsCache } from '../../../services/cache/OptionsCache'
import { RedisCache } from '../../../services/cache/RedisCache'

// Type guard for Error objects
function isError(error: unknown): error is Error {
  return error instanceof Error
}

// Helper function to get error message safely
function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message
  }
  return String(error)
}

// Type definitions for better type safety
interface BenchmarkResult {
  symbol: string
  duration: number
  success: boolean
  confidence: number
  contractsProcessed: number
}

interface StressTestRequest {
  requestIndex: number
  duration: number
  success: boolean
  error: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const testType = searchParams.get('test') || 'performance'
    const symbol = searchParams.get('symbol') || 'AAPL'

    const cache = new RedisCache()
    const optionsService = new OptionsAnalysisService(cache)
    const optionsCache = new OptionsCache()

    switch (testType) {
      case 'performance':
        return await performPerformanceTest(optionsService, symbol)

      case 'memory':
        return await performMemoryTest(optionsService, symbol)

      case 'cache':
        return await performCacheTest(optionsCache, symbol)

      case 'benchmark':
        return await performBenchmarkTest(optionsService)

      case 'stress':
        return await performStressTest(optionsService)

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid test type. Available: performance, memory, cache, benchmark, stress'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Options performance test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Performance test failed',
      details: getErrorMessage(error)
    }, { status: 500 })
  }
}

/**
 * Performance test with detailed timing metrics
 */
async function performPerformanceTest(optionsService: OptionsAnalysisService, symbol: string) {
  const results = {
    testType: 'performance',
    symbol,
    targets: {
      totalAnalysis: 400,
      individualMethods: 100
    },
    results: {},
    summary: {}
  }

  try {
    // Test total analysis performance
    const totalStartTime = performance.now()
    const analysisResult = await optionsService.analyzeOptionsData(symbol)
    const totalEndTime = performance.now()

    const totalDuration = totalEndTime - totalStartTime

    results.results = {
      totalAnalysisDuration: totalDuration,
      analysisSuccess: analysisResult !== null,
      meetsTarget: totalDuration < 400,
      performance: analysisResult?.performance || null
    }

    // Performance summary
    results.summary = {
      status: totalDuration < 400 ? 'PASS' : 'FAIL',
      efficiency: ((400 - totalDuration) / 400 * 100).toFixed(1) + '%',
      targetMet: totalDuration < 400,
      recommendations: generatePerformanceRecommendations(totalDuration)
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: Date.now()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Performance test failed',
      details: getErrorMessage(error)
    }, { status: 500 })
  }
}

/**
 * Memory usage test with heap monitoring
 */
async function performMemoryTest(optionsService: OptionsAnalysisService, symbol: string) {
  const results = {
    testType: 'memory',
    symbol,
    target: 2 * 1024 * 1024, // 2MB in bytes
    results: {}
  }

  try {
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }

    const initialMemory = process.memoryUsage()

    // Perform analysis
    const analysisResult = await optionsService.analyzeOptionsData(symbol)

    const finalMemory = process.memoryUsage()
    const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed
    const memoryMB = memoryDelta / (1024 * 1024)

    results.results = {
      initialHeapUsed: initialMemory.heapUsed,
      finalHeapUsed: finalMemory.heapUsed,
      memoryDelta: memoryDelta,
      memoryDeltaMB: memoryMB,
      targetMB: 2,
      meetsTarget: memoryDelta < results.target,
      efficiency: memoryMB < 2 ? 'Excellent' : memoryMB < 4 ? 'Good' : 'Needs Optimization'
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: Date.now()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Memory test failed',
      details: getErrorMessage(error)
    }, { status: 500 })
  }
}

/**
 * Cache performance test
 */
async function performCacheTest(optionsCache: OptionsCache, symbol: string) {
  const results = {
    testType: 'cache',
    symbol,
    target: 85, // 85% hit ratio
    results: {}
  }

  try {
    // Get initial cache metrics
    const initialMetrics = optionsCache.getPerformanceMetrics()

    // Perform multiple requests to test caching
    const testSymbols = [symbol, symbol, symbol, 'TSLA', 'TSLA'] // Intentional duplicates
    const cacheTestResults = []

    for (const testSymbol of testSymbols) {
      const startTime = performance.now()
      const result = await optionsCache.getOptionsAnalysis(testSymbol)
      const endTime = performance.now()

      cacheTestResults.push({
        symbol: testSymbol,
        duration: endTime - startTime,
        hit: result !== null
      })
    }

    const finalMetrics = optionsCache.getPerformanceMetrics()

    results.results = {
      initialMetrics,
      finalMetrics,
      testRequests: cacheTestResults.length,
      cacheHits: cacheTestResults.filter(r => r.hit).length,
      hitRatio: finalMetrics.hitRatio,
      meetsTarget: finalMetrics.hitRatio >= 85,
      avgResponseTime: finalMetrics.avgResponseTime,
      memoryUsage: finalMetrics.memoryUsage
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: Date.now()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Cache test failed',
      details: getErrorMessage(error)
    }, { status: 500 })
  }
}

/**
 * Comprehensive benchmark test
 */
async function performBenchmarkTest(optionsService: OptionsAnalysisService) {
  const testSymbols = ['AAPL', 'TSLA', 'SPY', 'QQQ', 'NVDA']
  const results: {
    testType: string
    symbols: string[]
    results: BenchmarkResult[]
    summary: Record<string, any>
  } = {
    testType: 'benchmark',
    symbols: testSymbols,
    results: [],
    summary: {}
  }

  try {
    const benchmarkResults: BenchmarkResult[] = []

    for (const symbol of testSymbols) {
      const startTime = performance.now()
      const analysisResult = await optionsService.analyzeOptionsData(symbol)
      const endTime = performance.now()

      benchmarkResults.push({
        symbol,
        duration: endTime - startTime,
        success: analysisResult !== null,
        confidence: analysisResult?.confidence || 0,
        contractsProcessed: analysisResult?.performance?.contractsProcessed || 0
      })
    }

    const avgDuration = benchmarkResults.reduce((sum, r) => sum + r.duration, 0) / benchmarkResults.length
    const successRate = benchmarkResults.filter(r => r.success).length / benchmarkResults.length * 100

    results.results = benchmarkResults
    results.summary = {
      averageDuration: avgDuration,
      successRate: successRate,
      meetsPerformanceTarget: avgDuration < 400,
      totalSymbolsTested: testSymbols.length,
      fastest: Math.min(...benchmarkResults.map(r => r.duration)),
      slowest: Math.max(...benchmarkResults.map(r => r.duration))
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: Date.now()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Benchmark test failed',
      details: getErrorMessage(error)
    }, { status: 500 })
  }
}

/**
 * Stress test with concurrent requests
 */
async function performStressTest(optionsService: OptionsAnalysisService) {
  const concurrentRequests = 10
  const testSymbol = 'AAPL'

  const results = {
    testType: 'stress',
    concurrentRequests,
    symbol: testSymbol,
    results: {}
  }

  try {
    const startTime = performance.now()

    // Create concurrent requests
    const promises = Array(concurrentRequests).fill(null).map(async (_, index): Promise<StressTestRequest> => {
      const requestStartTime = performance.now()
      try {
        const result = await optionsService.analyzeOptionsData(testSymbol)
        const requestEndTime = performance.now()

        return {
          requestIndex: index,
          duration: requestEndTime - requestStartTime,
          success: result !== null,
          error: null
        }
      } catch (error) {
        const requestEndTime = performance.now()
        return {
          requestIndex: index,
          duration: requestEndTime - requestStartTime,
          success: false,
          error: getErrorMessage(error)
        }
      }
    })

    const requestResults = await Promise.allSettled(promises)
    const endTime = performance.now()

    const successfulRequests = requestResults
      .filter((r): r is PromiseFulfilledResult<StressTestRequest> =>
        r.status === 'fulfilled' && r.value.success
      )
      .map(r => r.value)

    const failedRequests = requestResults.filter(r =>
      r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    )

    results.results = {
      totalDuration: endTime - startTime,
      concurrentRequests,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      successRate: (successfulRequests.length / concurrentRequests) * 100,
      averageRequestDuration: successfulRequests.reduce((sum, r) => sum + r.duration, 0) / successfulRequests.length,
      maxRequestDuration: Math.max(...successfulRequests.map(r => r.duration)),
      minRequestDuration: Math.min(...successfulRequests.map(r => r.duration)),
      throughput: concurrentRequests / ((endTime - startTime) / 1000), // requests per second
      meetsPerformanceTarget: successfulRequests.every(r => r.duration < 400)
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: Date.now()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Stress test failed',
      details: getErrorMessage(error)
    }, { status: 500 })
  }
}

/**
 * Generate performance recommendations based on results
 */
function generatePerformanceRecommendations(duration: number): string[] {
  const recommendations = []

  if (duration > 400) {
    recommendations.push('Consider enabling compression for large options chains')
    recommendations.push('Verify cache configuration and hit rates')
    recommendations.push('Check API response times from EODHD')
  }

  if (duration > 300) {
    recommendations.push('Monitor memory usage during large chain processing')
    recommendations.push('Consider increasing cache TTL for popular symbols')
  }

  if (duration > 200) {
    recommendations.push('Review parallel processing implementation')
    recommendations.push('Optimize mathematical calculations if needed')
  }

  if (duration < 100) {
    recommendations.push('Excellent performance! Consider increasing analysis depth')
  }

  return recommendations
}