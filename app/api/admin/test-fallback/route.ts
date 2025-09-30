/**
 * Admin API - Test Fallback Data Service
 * POST /api/admin/test-fallback
 * Tests the free data source fallback chain
 */

import { NextRequest, NextResponse } from 'next/server'
import { FinancialDataService } from '../../../services/financial-data/FinancialDataService'

interface FallbackTestRequest {
  symbols?: string[]
  testType?: 'single' | 'batch' | 'status' | 'stress'
  timeout?: number
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Admin API: Testing fallback data service...')

    const body: FallbackTestRequest = await request.json()
    const {
      symbols = ['AAPL', 'GOOGL', 'MSFT'],
      testType = 'single',
      timeout = 10000
    } = body

    const fallbackService = new FinancialDataService()
    const startTime = Date.now()
    const results: any = {}

    // Test based on type
    switch (testType) {
      case 'single':
        console.log(`🔍 Testing single stock: ${symbols[0]}`)
        const singleData = await fallbackService.getStockPrice(symbols[0])
        results.singleStock = {
          symbol: symbols[0],
          success: !!singleData,
          data: singleData,
          responseTime: Date.now() - startTime
        }
        break

      case 'batch':
        console.log(`🔍 Testing batch stocks: ${symbols.join(', ')}`)
        const batchData = await fallbackService.getBatchPrices(symbols)
        results.batchStocks = {
          requested: symbols,
          received: Array.from(batchData.keys()),
          success: batchData.size > 0,
          data: Object.fromEntries(batchData),
          successRate: (batchData.size / symbols.length) * 100,
          responseTime: Date.now() - startTime
        }
        break

      case 'status':
        console.log('📊 Getting source status')
        const sourceStatus = fallbackService.getSourceStatus()
        results.sourceStatus = {
          sources: sourceStatus,
          availableCount: sourceStatus.filter(s => s.available).length,
          totalCount: sourceStatus.length
        }
        break

      case 'stress':
        console.log('💪 Running stress test (multiple requests)')
        const stressResults = []
        for (let i = 0; i < 5; i++) {
          const testSymbol = symbols[i % symbols.length]
          const testStart = Date.now()
          const testData = await fallbackService.getStockPrice(testSymbol)
          stressResults.push({
            attempt: i + 1,
            symbol: testSymbol,
            success: !!testData,
            responseTime: Date.now() - testStart,
            source: testData?.source
          })
        }
        results.stressTest = {
          attempts: stressResults,
          successRate: (stressResults.filter(r => r.success).length / stressResults.length) * 100,
          avgResponseTime: stressResults.reduce((acc, r) => acc + r.responseTime, 0) / stressResults.length
        }
        break

      default:
        throw new Error(`Unknown test type: ${testType}`)
    }

    // Add overall metrics
    results.metadata = {
      testType,
      totalResponseTime: Date.now() - startTime,
      timestamp: Date.now(),
      sourceStatus: fallbackService.getSourceStatus()
    }

    // Health check
    const isHealthy = await fallbackService.healthCheck()
    results.healthCheck = {
      healthy: isHealthy,
      message: isHealthy ? 'At least one data source is available' : 'All data sources are unavailable'
    }

    console.log(`✅ Fallback test completed in ${Date.now() - startTime}ms`)

    return NextResponse.json({
      success: true,
      testType,
      results,
      summary: {
        totalTime: Date.now() - startTime,
        healthy: isHealthy,
        timestamp: Date.now()
      }
    })

  } catch (error) {
    console.error('❌ Fallback test failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { status: 500 })
  }
}