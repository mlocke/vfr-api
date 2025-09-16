#!/usr/bin/env ts-node
/**
 * Treasury Fiscal Data Direct API Test
 *
 * Direct test of Treasury Fiscal Data API functionality for validation
 * and performance analysis. Tests all endpoints with real data and generates
 * comprehensive test reports.
 *
 * Pattern follows the successful SEC Edgar direct test approach.
 *
 * Usage: npx ts-node scripts/test-treasury-direct.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { treasuryFiscalService, TreasuryFiscalResponse } from '../app/services/mcp/collectors/TreasuryFiscalService.js'

// Test configuration
const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'test-output')
const TEST_DATE = new Date().toISOString().split('T')[0] // YYYY-MM-DD
const TEST_ID = `treasury-direct-test-${Date.now()}`

interface TestResult {
  endpoint: string
  method: string
  params: Record<string, any>
  success: boolean
  responseTime: number
  dataPoints: number
  error?: string
  sampleData?: any
}

interface TestSummary {
  testId: string
  timestamp: string
  duration: number
  endpoints: {
    total: number
    successful: number
    failed: number
  }
  performance: {
    averageResponseTime: number
    fastestEndpoint: { name: string; time: number }
    slowestEndpoint: { name: string; time: number }
  }
  dataQuality: {
    totalDataPoints: number
    validationResults: string[]
  }
  results: TestResult[]
}

class TreasuryDirectTest {
  private startTime: number
  private results: TestResult[] = []
  private validationMessages: string[] = []

  constructor() {
    this.startTime = Date.now()
    console.log('🏛️ Treasury Fiscal Data Direct API Test')
    console.log('=====================================')
    console.log(`Test ID: ${TEST_ID}`)
    console.log(`Date: ${TEST_DATE}`)
    console.log('')
  }

  private log(message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const timestamp = new Date().toTimeString().slice(0, 8)
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }
    console.log(`[${timestamp}] ${icons[level]} ${message}`)
  }

  private async testEndpoint(
    name: string,
    method: keyof typeof treasuryFiscalService,
    params: any[] = []
  ): Promise<TestResult> {
    this.log(`Testing ${name}...`)

    const startTime = Date.now()

    try {
      const response = await (treasuryFiscalService[method] as Function)(...params)
      const responseTime = Date.now() - startTime

      // Extract sample data for validation
      let sampleData = null
      let dataPoints = 0

      if (response && response.data) {
        // Count data points based on endpoint
        if (response.data.records) {
          dataPoints = response.data.records.length
        } else if (response.data.dailyOperations) {
          dataPoints = response.data.dailyOperations.length
        } else if (response.data.spendingData) {
          dataPoints = response.data.spendingData.length
        } else if (response.data.revenueData) {
          dataPoints = response.data.revenueData.length
        } else if (response.data.exchangeRates) {
          dataPoints = response.data.exchangeRates.length
        } else if (response.data.cashBalances) {
          dataPoints = response.data.cashBalances.length
        } else {
          dataPoints = 1
        }

        // Extract sample for validation
        sampleData = {
          dataType: response.dataType,
          source: response.source,
          metadata: response.metadata,
          dataSample: this.getSampleData(response.data)
        }

        this.validateResponse(name, response, responseTime)
      }

      const result: TestResult = {
        endpoint: name,
        method: method as string,
        params: params.length > 0 ? { args: params } : {},
        success: true,
        responseTime,
        dataPoints,
        sampleData
      }

      this.log(`✅ ${name}: ${dataPoints} data points in ${responseTime}ms`, 'success')
      return result

    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      const result: TestResult = {
        endpoint: name,
        method: method as string,
        params: params.length > 0 ? { args: params } : {},
        success: false,
        responseTime,
        dataPoints: 0,
        error: errorMessage
      }

      this.log(`❌ ${name}: Failed in ${responseTime}ms - ${errorMessage}`, 'error')
      return result
    }
  }

  private getSampleData(data: any): any {
    // Return a small sample of the data for validation
    if (data.latestDebt) {
      return { latestDebt: data.latestDebt }
    } else if (data.summary) {
      return { summary: data.summary }
    } else if (data.spendingData && data.spendingData.length > 0) {
      return { firstSpendingRecord: data.spendingData[0] }
    } else if (data.revenueData && data.revenueData.length > 0) {
      return { firstRevenueRecord: data.revenueData[0] }
    } else if (data.exchangeRates && data.exchangeRates.length > 0) {
      return { firstExchangeRate: data.exchangeRates[0] }
    } else if (data.dailyOperations && data.dailyOperations.length > 0) {
      return { firstDailyOperation: data.dailyOperations[0] }
    } else if (data.cashBalances && data.cashBalances.length > 0) {
      return { firstCashBalance: data.cashBalances[0] }
    }
    return data
  }

  private validateResponse(name: string, response: TreasuryFiscalResponse, responseTime: number): void {
    // Response time validation
    if (responseTime > 5000) {
      this.validationMessages.push(`⚠️ ${name}: Slow response time (${responseTime}ms)`)
    } else if (responseTime < 1000) {
      this.validationMessages.push(`✅ ${name}: Fast response time (${responseTime}ms)`)
    }

    // Data structure validation
    if (!response.dataType || !response.source) {
      this.validationMessages.push(`❌ ${name}: Missing required response fields`)
    } else {
      this.validationMessages.push(`✅ ${name}: Valid response structure`)
    }

    // Treasury-specific validation
    if (name.includes('Debt') && response.data.latestDebt) {
      const debt = response.data.latestDebt.amount
      if (debt > 20_000_000_000_000 && debt < 50_000_000_000_000) {
        this.validationMessages.push(`✅ ${name}: Reasonable debt amount ($${debt.toExponential(2)})`)
      } else {
        this.validationMessages.push(`⚠️ ${name}: Unusual debt amount ($${debt.toExponential(2)})`)
      }
    }

    // Date validation
    if (response.data.latestDebt?.date) {
      const dataDate = new Date(response.data.latestDebt.date)
      const monthsOld = (Date.now() - dataDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (monthsOld < 12) {
        this.validationMessages.push(`✅ ${name}: Recent data (${monthsOld.toFixed(1)} months old)`)
      } else {
        this.validationMessages.push(`⚠️ ${name}: Old data (${monthsOld.toFixed(1)} months old)`)
      }
    }
  }

  async runAllTests(): Promise<void> {
    this.log('Starting comprehensive Treasury API tests...')

    // Test all endpoints
    const tests = [
      {
        name: 'Federal Debt (Debt to the Penny)',
        method: 'getDebtToPenny' as const,
        params: [undefined, undefined, 10]
      },
      {
        name: 'Daily Treasury Statement',
        method: 'getDailyTreasuryStatement' as const,
        params: [undefined, 10]
      },
      {
        name: 'Federal Spending',
        method: 'getFederalSpending' as const,
        params: ['2024', 15]
      },
      {
        name: 'Federal Revenue',
        method: 'getFederalRevenue' as const,
        params: ['2024', 15]
      },
      {
        name: 'Exchange Rates',
        method: 'getExchangeRates' as const,
        params: [undefined, 10]
      },
      {
        name: 'Operating Cash Balance',
        method: 'getOperatingCashBalance' as const,
        params: [undefined, 10]
      },
      {
        name: 'Comprehensive Fiscal Summary',
        method: 'getComprehensiveFiscalSummary' as const,
        params: [30]
      }
    ]

    // Run tests sequentially to respect rate limits
    for (const test of tests) {
      const result = await this.testEndpoint(test.name, test.method, test.params)
      this.results.push(result)

      // Add delay between requests to respect rate limiting
      await new Promise(resolve => setTimeout(resolve, 250)) // 250ms delay
    }

    this.log('All tests completed. Generating summary...')
  }

  generateSummary(): TestSummary {
    const duration = Date.now() - this.startTime
    const successful = this.results.filter(r => r.success)
    const failed = this.results.filter(r => !r.success)

    const responseTimes = successful.map(r => r.responseTime)
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b) / responseTimes.length
      : 0

    let fastestEndpoint = { name: 'None', time: Infinity }
    let slowestEndpoint = { name: 'None', time: 0 }

    if (successful.length > 0) {
      const fastest = successful.reduce((min, r) => r.responseTime < min.responseTime ? r : min)
      const slowest = successful.reduce((max, r) => r.responseTime > max.responseTime ? r : max)

      fastestEndpoint = { name: fastest.endpoint, time: fastest.responseTime }
      slowestEndpoint = { name: slowest.endpoint, time: slowest.responseTime }
    }

    const totalDataPoints = this.results.reduce((sum, r) => sum + r.dataPoints, 0)

    return {
      testId: TEST_ID,
      timestamp: new Date().toISOString(),
      duration,
      endpoints: {
        total: this.results.length,
        successful: successful.length,
        failed: failed.length
      },
      performance: {
        averageResponseTime,
        fastestEndpoint,
        slowestEndpoint
      },
      dataQuality: {
        totalDataPoints,
        validationResults: this.validationMessages
      },
      results: this.results
    }
  }

  async saveResults(summary: TestSummary): Promise<void> {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    }

    // Save JSON results
    const jsonPath = path.join(OUTPUT_DIR, `${TEST_ID}.json`)
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2))

    // Generate and save markdown report
    const markdownReport = this.generateMarkdownReport(summary)
    const mdPath = path.join(OUTPUT_DIR, `${TEST_ID}-report.md`)
    fs.writeFileSync(mdPath, markdownReport)

    this.log(`Results saved to:`)
    this.log(`  JSON: ${jsonPath}`)
    this.log(`  Report: ${mdPath}`)
  }

  generateMarkdownReport(summary: TestSummary): string {
    const { endpoints, performance, dataQuality } = summary

    const successRatePercent = (endpoints.successful / endpoints.total) * 100
    const successRate = successRatePercent.toFixed(1)

    return `# Treasury Fiscal Data API Direct Test Report

## Test Overview
- **Test ID**: ${summary.testId}
- **Timestamp**: ${summary.timestamp}
- **Duration**: ${(summary.duration / 1000).toFixed(2)} seconds

## Summary Statistics
- **Total Endpoints Tested**: ${endpoints.total}
- **Successful**: ${endpoints.successful} (${successRate}%)
- **Failed**: ${endpoints.failed}
- **Total Data Points Collected**: ${dataQuality.totalDataPoints}

## Performance Metrics
- **Average Response Time**: ${performance.averageResponseTime.toFixed(0)}ms
- **Fastest Endpoint**: ${performance.fastestEndpoint.name} (${performance.fastestEndpoint.time}ms)
- **Slowest Endpoint**: ${performance.slowestEndpoint.name} (${performance.slowestEndpoint.time}ms)

## Endpoint Results

${summary.results.map(result => `### ${result.endpoint}
- **Status**: ${result.success ? '✅ Success' : '❌ Failed'}
- **Response Time**: ${result.responseTime}ms
- **Data Points**: ${result.dataPoints}
${result.error ? `- **Error**: ${result.error}` : ''}
${result.sampleData ? `- **Sample Data**: \`${result.sampleData.dataType}\`` : ''}
`).join('\n')}

## Data Quality Validation

${dataQuality.validationResults.map(msg => `- ${msg}`).join('\n')}

## API Performance Analysis

The Treasury Fiscal Data API demonstrates ${successRatePercent >= 80 ? 'excellent' : successRatePercent >= 60 ? 'good' : 'concerning'} reliability with ${successRate}% success rate.

${performance.averageResponseTime < 2000
  ? '**Performance**: Excellent - Average response time under 2 seconds'
  : performance.averageResponseTime < 5000
  ? '**Performance**: Good - Average response time under 5 seconds'
  : '**Performance**: Needs improvement - Response times over 5 seconds'
}

## Recommendations

${summary.endpoints.failed > 0 ? `
### Failed Endpoints
${summary.results.filter(r => !r.success).map(r => `- **${r.endpoint}**: ${r.error}`).join('\n')}

These failures should be investigated and retry logic implemented.
` : '✅ All endpoints functioning correctly - no immediate action required.'}

${performance.averageResponseTime > 3000 ? `
### Performance Optimization
Consider implementing:
- Connection pooling for HTTP requests
- Request batching where applicable
- Enhanced caching strategies
` : ''}

---
*Report generated on ${new Date().toISOString()}*
*Test completed in ${(summary.duration / 1000).toFixed(2)} seconds*`
  }

  printSummary(summary: TestSummary): void {
    console.log('\n🏛️ Treasury Fiscal Data API Test Summary')
    console.log('=========================================')
    console.log(`Test Duration: ${(summary.duration / 1000).toFixed(2)} seconds`)
    console.log(`Success Rate: ${summary.endpoints.successful}/${summary.endpoints.total} (${((summary.endpoints.successful / summary.endpoints.total) * 100).toFixed(1)}%)`)
    console.log(`Average Response Time: ${summary.performance.averageResponseTime.toFixed(0)}ms`)
    console.log(`Total Data Points: ${summary.dataQuality.totalDataPoints}`)
    console.log('')

    if (summary.endpoints.failed > 0) {
      console.log('❌ Failed Endpoints:')
      summary.results.filter(r => !r.success).forEach(result => {
        console.log(`  - ${result.endpoint}: ${result.error}`)
      })
      console.log('')
    }

    console.log('✅ Performance Highlights:')
    console.log(`  - Fastest: ${summary.performance.fastestEndpoint.name} (${summary.performance.fastestEndpoint.time}ms)`)
    console.log(`  - Slowest: ${summary.performance.slowestEndpoint.name} (${summary.performance.slowestEndpoint.time}ms)`)
    console.log('')

    console.log('📊 Data Quality:')
    const validationSuccess = summary.dataQuality.validationResults.filter(r => r.includes('✅')).length
    const validationTotal = summary.dataQuality.validationResults.length
    console.log(`  - Validation Score: ${validationSuccess}/${validationTotal} (${((validationSuccess / validationTotal) * 100).toFixed(1)}%)`)
    console.log('')

    console.log(`Test ID: ${summary.testId}`)
    console.log('Results saved to docs/test-output/')
  }
}

// Main execution
async function main() {
  const tester = new TreasuryDirectTest()

  try {
    await tester.runAllTests()
    const summary = tester.generateSummary()
    await tester.saveResults(summary)
    tester.printSummary(summary)

    // Exit with appropriate code
    process.exit(summary.endpoints.failed > 0 ? 1 : 0)

  } catch (error) {
    console.error('❌ Test execution failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { TreasuryDirectTest }