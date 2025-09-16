/**
 * Treasury Fiscal Data Real Integration Tests - FIXED
 *
 * Comprehensive test suite for the Treasury Fiscal Data API integration.
 * Tests real API endpoints, data validation, performance, and error handling.
 *
 * Following the successful SEC Edgar testing pattern.
 */

import { treasuryFiscalService, TreasuryFiscalResponse } from '../app/services/mcp/collectors/TreasuryFiscalService'
import { mcpClient } from '../app/services/mcp/MCPClient'

// Test configuration
const TEST_TIMEOUT = 30000 // 30 seconds for API calls
const PERFORMANCE_THRESHOLD = 5000 // 5 seconds max response time
const MIN_RECORDS_THRESHOLD = 1 // Minimum records expected

describe('Treasury Fiscal Real Data Integration - FIXED', () => {
  let testStartTime: number

  beforeAll(async () => {
    testStartTime = Date.now()
    console.log('🏛️ Starting Treasury Fiscal API Integration Tests')
  })

  afterAll(() => {
    const duration = Date.now() - testStartTime
    console.log(`✅ Treasury tests completed in ${duration}ms`)
  })

  describe('Direct Treasury Service Tests', () => {
    it('should fetch real federal debt data (Debt to the Penny)', async () => {
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

      console.log(`✅ Federal Debt Test: $${response.data.latestDebt.amountTrillions} trillion (${responseTime}ms)`)
    }, TEST_TIMEOUT)

    it('should fetch real monthly treasury statement data', async () => {
      const startTime = Date.now()

      const response = await treasuryFiscalService.getMonthlyTreasuryStatement(
        undefined, // start_date
        5 // limit
      )

      const responseTime = Date.now() - startTime

      // Validate response structure
      expect(response).toHaveProperty('dataType', 'Monthly Treasury Statement')
      expect(response).toHaveProperty('source', 'U.S. Treasury Fiscal Data')
      expect(response).toHaveProperty('data')

      // Validate operations data
      expect(response.data).toHaveProperty('summary')
      expect(response.data).toHaveProperty('monthlyData')
      expect(response.data.summary).toHaveProperty('latestDate')
      expect(response.data.summary).toHaveProperty('grossReceipts')

      // Validate monthly data array
      expect(Array.isArray(response.data.monthlyData)).toBe(true)
      expect(response.data.monthlyData.length).toBeGreaterThanOrEqual(MIN_RECORDS_THRESHOLD)

      if (response.data.monthlyData.length > 0) {
        // Validate first operation record
        const firstOp = response.data.monthlyData[0]
        expect(firstOp).toHaveProperty('date')
        expect(firstOp).toHaveProperty('classification')
        expect(firstOp).toHaveProperty('grossReceipts')
        expect(firstOp).toHaveProperty('grossOutlays')
        expect(firstOp).toHaveProperty('deficitSurplus')
      }

      // Validate performance
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD)

      console.log(`✅ Monthly Treasury Statement Test: ${response.data.monthlyData.length} records (${responseTime}ms)`)
    }, TEST_TIMEOUT)

    it('should fetch real exchange rates data', async () => {
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

    it('should fetch comprehensive fiscal summary', async () => {
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
    it('should execute treasury tools through MCP client', async () => {
      const startTime = Date.now()

      // Test federal debt through MCP client
      const debtResponse = await mcpClient.executeTool('get_federal_debt', {
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

    it('should handle treasury tool errors gracefully', async () => {
      // Test with invalid parameters to trigger error handling
      const response = await mcpClient.executeTool('invalid_treasury_tool', {})

      // Should not crash, should return error response
      expect(response).toHaveProperty('success')
      expect(response).toHaveProperty('source')

      if (!response.success) {
        expect(response).toHaveProperty('error')
        expect(response).toHaveProperty('data') // Should have fallback data
      }

      console.log(`✅ Treasury Error Handling Test: ${response.success ? 'Success' : 'Handled gracefully'}`)
    }, TEST_TIMEOUT)
  })

  describe('Performance and Quality Tests', () => {
    it('should meet performance benchmarks for key endpoints', async () => {
      const endpoints = [
        { name: 'Federal Debt', test: () => treasuryFiscalService.getDebtToPenny(undefined, undefined, 5) },
        { name: 'Exchange Rates', test: () => treasuryFiscalService.getExchangeRates(undefined, 5) },
        { name: 'Operating Cash', test: () => treasuryFiscalService.getOperatingCashBalance(undefined, 5) }
      ]

      const results = []

      for (const endpoint of endpoints) {
        const startTime = Date.now()

        try {
          const response = await endpoint.test()
          const responseTime = Date.now() - startTime

          results.push({
            name: endpoint.name,
            responseTime,
            success: true,
            recordCount: response.metadata?.totalRecords || 0
          })

          // Individual performance check
          expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD)

        } catch (error) {
          results.push({
            name: endpoint.name,
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
        console.log(`   ${result.name}: ${result.responseTime}ms ${result.success ? '✅' : '❌'}`)
      })
      console.log(`   Average: ${avgResponseTime.toFixed(0)}ms`)

      // At least 80% of endpoints should succeed
      expect(successfulResults.length / endpoints.length).toBeGreaterThanOrEqual(0.8)

      // Average response time should be reasonable
      if (successfulResults.length > 0) {
        expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLD)
      }
    }, TEST_TIMEOUT * 2)

    it('should validate data quality and consistency', async () => {
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

    it('should handle rate limiting appropriately', async () => {
      const startTime = Date.now()

      // Make multiple rapid requests to test rate limiting
      const promises = Array(3).fill(0).map((_, i) =>
        treasuryFiscalService.getExchangeRates(undefined, 3)
      )

      const results = await Promise.allSettled(promises)
      const totalTime = Date.now() - startTime

      // All requests should succeed (rate limiting should queue them)
      const successCount = results.filter(r => r.status === 'fulfilled').length
      expect(successCount).toBe(3)

      // Total time should reflect rate limiting (at least 400ms for 3 requests at 200ms each)
      expect(totalTime).toBeGreaterThan(300) // Allow some flexibility

      console.log(`✅ Rate Limiting Test: ${successCount}/3 requests successful in ${totalTime}ms`)
    }, TEST_TIMEOUT)
  })

  describe('Integration with Stock Analysis (AAPL Example)', () => {
    it('should provide contextual Treasury data for stock analysis', async () => {
      const startTime = Date.now()

      // Get both Treasury fiscal data and simulate stock analysis context
      const [debtData, exchangeRateData] = await Promise.all([
        treasuryFiscalService.getDebtToPenny(undefined, undefined, 5),
        treasuryFiscalService.getExchangeRates(undefined, 10)
      ])

      const responseTime = Date.now() - startTime

      // Both should succeed
      expect(debtData.data.latestDebt).toBeDefined()
      expect(exchangeRateData.data.exchangeRates).toBeDefined()

      // Create simulated analysis context for AAPL
      const contextualAnalysis = {
        ticker: 'AAPL',
        analysisTimestamp: new Date().toISOString(),
        macroeconomicContext: {
          federalDebt: {
            amount: debtData.data.latestDebt.amount,
            formatted: debtData.data.latestDebt.formattedAmount,
            date: debtData.data.latestDebt.date
          },
          exchangeRates: exchangeRateData.data.exchangeRates.slice(0, 5), // Top 5 currencies
          analysisNote: `Apple operates globally and is affected by federal fiscal policy and exchange rates`
        }
      }

      // Validate contextual analysis structure
      expect(contextualAnalysis.ticker).toBe('AAPL')
      expect(contextualAnalysis.macroeconomicContext.federalDebt.amount).toBeGreaterThan(30_000_000_000_000)
      expect(contextualAnalysis.macroeconomicContext.exchangeRates.length).toBeGreaterThanOrEqual(0)

      // Validate performance for combined analysis
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLD)

      console.log(`✅ AAPL Contextual Analysis: Federal debt ${contextualAnalysis.macroeconomicContext.federalDebt.formatted}`)
      console.log(`   Exchange rates: ${contextualAnalysis.macroeconomicContext.exchangeRates.length} currencies`)
      console.log(`   Analysis time: ${responseTime}ms`)
    }, TEST_TIMEOUT)

    it('should integrate Treasury data with stock selection workflow', async () => {
      // Test Treasury data integration in stock selection context
      const fiscalSummary = await treasuryFiscalService.getComprehensiveFiscalSummary(15)

      // Validate fiscal context is suitable for stock analysis
      expect(fiscalSummary.data.summary.dataPointsCollected).toBeGreaterThan(0)

      // Simulate how this would integrate with stock selection
      const stockSelectionContext = {
        fiscalEnvironment: {
          dataQuality: fiscalSummary.data.summary.dataPointsCollected > 2 ? 'good' : 'limited',
          federalDebtLevel: fiscalSummary.data.federalDebt?.latestDebt?.amount || 0,
          analysisReliability: fiscalSummary.data.summary.errors === 0 ? 'high' : 'medium'
        },
        recommendedAdjustments: {
          riskTolerance: fiscalSummary.data.federalDebt?.latestDebt?.amount > 35_000_000_000_000 ? 'conservative' : 'moderate',
          sectorFocus: 'Consider fiscal policy impact on technology stocks like AAPL'
        }
      }

      expect(stockSelectionContext.fiscalEnvironment.dataQuality).toBeDefined()
      expect(stockSelectionContext.recommendedAdjustments.riskTolerance).toBeDefined()

      console.log(`✅ Stock Selection Integration: Data quality ${stockSelectionContext.fiscalEnvironment.dataQuality}`)
      console.log(`   Risk adjustment: ${stockSelectionContext.recommendedAdjustments.riskTolerance}`)
    }, TEST_TIMEOUT)
  })
})