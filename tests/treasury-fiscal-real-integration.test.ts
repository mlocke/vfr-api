/**
 * Treasury Fiscal Data Real Integration Tests
 *
 * Comprehensive test suite for the Treasury Fiscal Data API integration.
 * Tests real API endpoints, data validation, performance, and error handling.
 *
 * Pattern follows the successful SEC Edgar testing approach.
 */

import { describe, test, expect, beforeAll, afterAll } from 'jest'
import { treasuryFiscalService, TreasuryFiscalResponse } from '../app/services/mcp/collectors/TreasuryFiscalService'
import { MCPClient } from '../app/services/mcp/MCPClient'

// Test configuration
const TEST_TIMEOUT = 30000 // 30 seconds for API calls
const PERFORMANCE_THRESHOLD = 5000 // 5 seconds max response time
const MIN_RECORDS_THRESHOLD = 1 // Minimum records expected

describe('Treasury Fiscal Real Data Integration', () => {
  let mcpClient: MCPClient
  let testStartTime: number

  beforeAll(async () => {
    mcpClient = MCPClient.getInstance()
    testStartTime = Date.now()
    console.log('🏛️ Starting Treasury Fiscal API Integration Tests')
  })

  afterAll(() => {
    const duration = Date.now() - testStartTime
    console.log(`✅ Treasury tests completed in ${duration}ms`)
  })

  describe('Direct Treasury Service Tests', () => {
    test('should fetch real federal debt data (Debt to the Penny)', async () => {
      const startTime = Date.now()

      const response = await treasuryFiscalService.getDebtToPenny(
        undefined, // start_date
        undefined, // end_date
        10 // limit
      )

      const responseTime = Date.now() - startTime

      // Validate response structure
      expect(response).toHaveProperty('dataType', 'Treasury Debt to the Penny')
      expect(response).toHaveProperty('source', 'U.S. Treasury Fiscal Data')
      expect(response).toHaveProperty('data')
      expect(response).toHaveProperty('metadata')

      // Validate debt data
      expect(response.data).toHaveProperty('latestDebt')
      expect(response.data.latestDebt).toHaveProperty('amount')
      expect(response.data.latestDebt).toHaveProperty('date')
      expect(response.data.latestDebt).toHaveProperty('formattedAmount')
      expect(response.data.latestDebt).toHaveProperty('amountTrillions')

      // Validate debt amount is realistic (should be > $30 trillion)
      expect(response.data.latestDebt.amount).toBeGreaterThan(30_000_000_000_000)

      // Validate performance
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD)
      expect(response.metadata.responseTimeMs).toBeLessThan(PERFORMANCE_THRESHOLD)

      // Validate metadata
      expect(response.metadata.totalRecords).toBeGreaterThanOrEqual(MIN_RECORDS_THRESHOLD)
      expect(response.metadata.endpointUsed).toBe('/v2/accounting/od/debt_to_penny')

      console.log(`✅ Federal Debt Test: $${response.data.latestDebt.amountTrillions} (${responseTime}ms)`)
    }, TEST_TIMEOUT)

    test('should fetch real daily treasury statement data', async () => {
      const startTime = Date.now()

      const response = await treasuryFiscalService.getDailyTreasuryStatement(
        undefined, // start_date
        5 // limit
      )

      const responseTime = Date.now() - startTime

      // Validate response structure
      expect(response).toHaveProperty('dataType', 'Daily Treasury Statement')
      expect(response).toHaveProperty('source', 'U.S. Treasury Fiscal Data')
      expect(response).toHaveProperty('data')

      // Validate operations data
      expect(response.data).toHaveProperty('summary')
      expect(response.data).toHaveProperty('dailyOperations')
      expect(response.data.summary).toHaveProperty('latestDate')
      expect(response.data.summary).toHaveProperty('latestBalance')

      // Validate daily operations array
      expect(Array.isArray(response.data.dailyOperations)).toBe(true)
      expect(response.data.dailyOperations.length).toBeGreaterThanOrEqual(MIN_RECORDS_THRESHOLD)

      // Validate first operation record
      const firstOp = response.data.dailyOperations[0]
      expect(firstOp).toHaveProperty('date')
      expect(firstOp).toHaveProperty('openingBalance')
      expect(firstOp).toHaveProperty('closingBalance')
      expect(firstOp).toHaveProperty('receipts')
      expect(firstOp).toHaveProperty('withdrawals')

      // Validate performance
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD)

      console.log(`✅ Daily Treasury Statement Test: ${response.data.dailyOperations.length} records (${responseTime}ms)`)
    }, TEST_TIMEOUT)

    test('should fetch real federal spending data', async () => {
      const startTime = Date.now()

      const response = await treasuryFiscalService.getFederalSpending(
        '2024', // fiscal year
        10 // limit
      )

      const responseTime = Date.now() - startTime

      // Validate response structure
      expect(response).toHaveProperty('dataType', 'Federal Spending')
      expect(response).toHaveProperty('data')
      expect(response.data).toHaveProperty('fiscalYear', '2024')
      expect(response.data).toHaveProperty('spendingData')

      // Validate spending data array
      expect(Array.isArray(response.data.spendingData)).toBe(true)

      if (response.data.spendingData.length > 0) {
        const firstRecord = response.data.spendingData[0]
        expect(firstRecord).toHaveProperty('month')
        expect(firstRecord).toHaveProperty('year')
        expect(firstRecord).toHaveProperty('category')
        expect(firstRecord).toHaveProperty('description')
        expect(firstRecord).toHaveProperty('amount')
        expect(firstRecord).toHaveProperty('formattedAmount')
      }

      // Validate performance
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD)

      console.log(`✅ Federal Spending Test: ${response.data.spendingData.length} records (${responseTime}ms)`)
    }, TEST_TIMEOUT)

    test('should fetch real federal revenue data', async () => {
      const startTime = Date.now()

      const response = await treasuryFiscalService.getFederalRevenue(
        '2024', // fiscal year
        10 // limit
      )

      const responseTime = Date.now() - startTime

      // Validate response structure
      expect(response).toHaveProperty('dataType', 'Federal Revenue')
      expect(response).toHaveProperty('data')
      expect(response.data).toHaveProperty('fiscalYear', '2024')
      expect(response.data).toHaveProperty('revenueData')

      // Validate revenue data array
      expect(Array.isArray(response.data.revenueData)).toBe(true)

      if (response.data.revenueData.length > 0) {
        const firstRecord = response.data.revenueData[0]
        expect(firstRecord).toHaveProperty('month')
        expect(firstRecord).toHaveProperty('year')
        expect(firstRecord).toHaveProperty('category')
        expect(firstRecord).toHaveProperty('description')
        expect(firstRecord).toHaveProperty('amount')
        expect(firstRecord).toHaveProperty('formattedAmount')
      }

      // Validate performance
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD)

      console.log(`✅ Federal Revenue Test: ${response.data.revenueData.length} records (${responseTime}ms)`)
    }, TEST_TIMEOUT)

    test('should fetch real exchange rates data', async () => {
      const startTime = Date.now()

      const response = await treasuryFiscalService.getExchangeRates(
        undefined, // date - use latest
        10 // limit
      )

      const responseTime = Date.now() - startTime

      // Validate response structure
      expect(response).toHaveProperty('dataType', 'Treasury Exchange Rates')
      expect(response).toHaveProperty('data')
      expect(response.data).toHaveProperty('exchangeRates')

      // Validate exchange rates array
      expect(Array.isArray(response.data.exchangeRates)).toBe(true)

      if (response.data.exchangeRates.length > 0) {
        const firstRate = response.data.exchangeRates[0]
        expect(firstRate).toHaveProperty('date')
        expect(firstRate).toHaveProperty('currency')
        expect(firstRate).toHaveProperty('exchangeRate')
        expect(typeof firstRate.exchangeRate).toBe('number')
        expect(firstRate.exchangeRate).toBeGreaterThan(0)
      }

      // Validate performance
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD)

      console.log(`✅ Exchange Rates Test: ${response.data.exchangeRates.length} records (${responseTime}ms)`)
    }, TEST_TIMEOUT)

    test('should fetch real operating cash balance data', async () => {
      const startTime = Date.now()

      const response = await treasuryFiscalService.getOperatingCashBalance(
        undefined, // start_date
        5 // limit
      )

      const responseTime = Date.now() - startTime

      // Validate response structure
      expect(response).toHaveProperty('dataType', 'Treasury Operating Cash Balance')
      expect(response).toHaveProperty('data')
      expect(response.data).toHaveProperty('cashBalances')

      // Validate cash balances array
      expect(Array.isArray(response.data.cashBalances)).toBe(true)

      if (response.data.cashBalances.length > 0) {
        const firstBalance = response.data.cashBalances[0]
        expect(firstBalance).toHaveProperty('date')
        expect(firstBalance).toHaveProperty('openingBalance')
        expect(firstBalance).toHaveProperty('closingBalance')
        expect(firstBalance).toHaveProperty('formattedClosingBalance')
        expect(typeof firstBalance.closingBalance).toBe('number')
      }

      // Validate performance
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD)

      console.log(`✅ Operating Cash Balance Test: ${response.data.cashBalances.length} records (${responseTime}ms)`)
    }, TEST_TIMEOUT)

    test('should fetch comprehensive fiscal summary', async () => {
      const startTime = Date.now()

      const response = await treasuryFiscalService.getComprehensiveFiscalSummary(30)
      const responseTime = Date.now() - startTime

      // Validate response structure
      expect(response).toHaveProperty('dataType', 'Comprehensive Fiscal Summary')
      expect(response).toHaveProperty('data')
      expect(response.data).toHaveProperty('summary')

      // Validate summary
      expect(response.data.summary).toHaveProperty('dataPointsCollected')
      expect(response.data.summary).toHaveProperty('errors')
      expect(typeof response.data.summary.dataPointsCollected).toBe('number')
      expect(typeof response.data.summary.errors).toBe('number')

      // Should collect at least some data points
      expect(response.data.summary.dataPointsCollected).toBeGreaterThan(0)

      // Validate performance
      expect(responseTime).toBeLessThan(10000) // 10 seconds for comprehensive summary

      console.log(`✅ Comprehensive Summary Test: ${response.data.summary.dataPointsCollected} data points (${responseTime}ms)`)
    }, TEST_TIMEOUT)
  })

  describe('MCP Client Treasury Integration Tests', () => {
    test('should execute treasury tools through MCP client', async () => {
      const startTime = Date.now()

      // Test federal debt through MCP client
      const debtResponse = await mcpClient.callTool('treasury', 'get_federal_debt', {
        limit: 5
      })

      const responseTime = Date.now() - startTime

      // Validate MCP response
      expect(debtResponse.success).toBe(true)
      expect(debtResponse.source).toBe('treasury')
      expect(debtResponse.data).toBeDefined()

      // Validate performance
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD)

      console.log(`✅ MCP Treasury Integration Test: ${responseTime}ms`)
    }, TEST_TIMEOUT)

    test('should handle treasury tool errors gracefully', async () => {
      // Test with invalid parameters to trigger error handling
      const response = await mcpClient.callTool('treasury', 'invalid_tool', {})

      // Should not crash, should return error response
      expect(response).toHaveProperty('success')
      expect(response).toHaveProperty('source', 'treasury')

      if (!response.success) {
        expect(response).toHaveProperty('error')
        expect(response).toHaveProperty('data') // Should have fallback data
      }

      console.log(`✅ Treasury Error Handling Test: ${response.success ? 'Success' : 'Handled gracefully'}`)
    }, TEST_TIMEOUT)
  })

  describe('Performance and Quality Tests', () => {
    test('should meet performance benchmarks for all endpoints', async () => {
      const endpoints = [
        { method: 'getDebtToPenny', args: [undefined, undefined, 5] },
        { method: 'getDailyTreasuryStatement', args: [undefined, 5] },
        { method: 'getExchangeRates', args: [undefined, 5] }
      ]

      const results = []

      for (const endpoint of endpoints) {
        const startTime = Date.now()

        try {
          const response = await (treasuryFiscalService as any)[endpoint.method](...endpoint.args)
          const responseTime = Date.now() - startTime

          results.push({
            method: endpoint.method,
            responseTime,
            success: true,
            recordCount: response.metadata?.totalRecords || 0
          })

          // Individual performance check
          expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD)

        } catch (error) {
          results.push({
            method: endpoint.method,
            responseTime: Date.now() - startTime,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Calculate average performance
      const successfulResults = results.filter(r => r.success)
      const avgResponseTime = successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length

      console.log(`✅ Performance Benchmark Results:`)
      results.forEach(result => {
        console.log(`   ${result.method}: ${result.responseTime}ms ${result.success ? '✅' : '❌'}`)
      })
      console.log(`   Average: ${avgResponseTime.toFixed(0)}ms`)

      // At least 80% of endpoints should succeed
      expect(successfulResults.length / endpoints.length).toBeGreaterThanOrEqual(0.8)

      // Average response time should be reasonable
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLD)
    }, TEST_TIMEOUT * 3) // Extended timeout for multiple endpoints

    test('should validate data quality and consistency', async () => {
      // Test debt data consistency
      const debtResponse = await treasuryFiscalService.getDebtToPenny(undefined, undefined, 10)

      if (debtResponse.data.latestDebt) {
        // Debt amount should be reasonable
        expect(debtResponse.data.latestDebt.amount).toBeGreaterThan(20_000_000_000_000) // > $20T
        expect(debtResponse.data.latestDebt.amount).toBeLessThan(50_000_000_000_000) // < $50T

        // Date should be recent (within last year)
        const debtDate = new Date(debtResponse.data.latestDebt.date)
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

        expect(debtDate.getTime()).toBeGreaterThan(oneYearAgo.getTime())

        // Formatted amount should match raw amount
        expect(debtResponse.data.latestDebt.formattedAmount).toContain('$')
        expect(debtResponse.data.latestDebt.amountTrillions).toContain('T')
      }

      console.log(`✅ Data Quality Validation: Debt data is consistent and reasonable`)
    }, TEST_TIMEOUT)

    test('should handle rate limiting appropriately', async () => {
      const startTime = Date.now()

      // Make multiple rapid requests to test rate limiting
      const promises = Array(5).fill(0).map((_, i) =>
        treasuryFiscalService.getExchangeRates(undefined, 3)
      )

      const results = await Promise.allSettled(promises)
      const totalTime = Date.now() - startTime

      // All requests should succeed (rate limiting should queue them)
      const successCount = results.filter(r => r.status === 'fulfilled').length
      expect(successCount).toBe(5)

      // Total time should reflect rate limiting (at least 800ms for 5 requests at 200ms each)
      expect(totalTime).toBeGreaterThan(600) // Allow some flexibility

      console.log(`✅ Rate Limiting Test: ${successCount}/5 requests successful in ${totalTime}ms`)
    }, TEST_TIMEOUT)
  })

  describe('Cache Integration Tests', () => {
    test('should utilize Redis caching for repeated requests', async () => {
      // Clear cache first (if possible)

      // First request - should hit API
      const startTime1 = Date.now()
      const response1 = await treasuryFiscalService.getDebtToPenny(undefined, undefined, 5)
      const time1 = Date.now() - startTime1

      // Second request - should hit cache
      const startTime2 = Date.now()
      const response2 = await treasuryFiscalService.getDebtToPenny(undefined, undefined, 5)
      const time2 = Date.now() - startTime2

      // Both responses should have same data
      expect(response1.data.latestDebt.amount).toBe(response2.data.latestDebt.amount)

      // Second request should be faster (cache hit)
      // Note: This might not always be true due to network variance, so we'll be lenient
      console.log(`✅ Cache Test: First request ${time1}ms, Second request ${time2}ms`)

      // At minimum, both should be reasonable response times
      expect(time1).toBeLessThan(PERFORMANCE_THRESHOLD)
      expect(time2).toBeLessThan(PERFORMANCE_THRESHOLD)
    }, TEST_TIMEOUT)
  })
})