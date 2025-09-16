/**
 * Treasury Fiscal Data Comprehensive Integration Tests
 *
 * Complete test suite for Treasury Fiscal Data API following SEC Edgar patterns.
 * Tests API connectivity, data validation, performance, error handling, and
 * integration with stock analysis using AAPL as the test case.
 */

import { treasuryFiscalService } from '../app/services/mcp/collectors/TreasuryFiscalService'
import { mcpClient } from '../app/services/mcp/MCPClient'

// Test configuration matching SEC Edgar patterns
const API_TIMEOUT = 30000 // 30 seconds for API calls
const PERFORMANCE_THRESHOLD = 5000 // 5 seconds max response time
const MIN_RECORDS_THRESHOLD = 1 // Minimum records expected

describe('Treasury Fiscal Data Comprehensive Integration Tests', () => {
  beforeAll(() => {
    console.log('🏛️ Starting Treasury Fiscal Data Integration Tests')
    console.log('📊 Testing against live Treasury Fiscal Data API')
  })

  describe('Real Treasury API Data Tests', () => {
    it('should fetch real federal debt data (Debt to the Penny)', async () => {
      const response = await treasuryFiscalService.getDebtToPenny(undefined, undefined, 10)

      expect(response.dataType).toBe('Treasury Debt to the Penny')
      expect(response.source).toBe('U.S. Treasury Fiscal Data')
      expect(response.data).toHaveProperty('latestDebt')
      expect(response.metadata.endpointUsed).toBe('/v2/accounting/od/debt_to_penny')

      // Validate debt amount is realistic
      expect(response.data.latestDebt.amount).toBeGreaterThan(30_000_000_000_000) // > $30T
      expect(response.data.latestDebt.amount).toBeLessThan(50_000_000_000_000) // < $50T

      // Validate data freshness (within last year)
      const debtDate = new Date(response.data.latestDebt.date)
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      expect(debtDate.getTime()).toBeGreaterThan(oneYearAgo.getTime())

      // Validate formatting
      expect(response.data.latestDebt.formattedAmount).toContain('$')
      expect(response.data.latestDebt.amountTrillions).toContain('T')

      console.log('✅ Federal Debt:', {
        amount: response.data.latestDebt.amountTrillions,
        date: response.data.latestDebt.date,
        responseTime: `${response.metadata.responseTimeMs}ms`
      })
    }, API_TIMEOUT)

    it('should fetch real exchange rates data', async () => {
      const response = await treasuryFiscalService.getExchangeRates(undefined, 10)

      expect(response.dataType).toBe('Treasury Exchange Rates')
      expect(response.data).toHaveProperty('exchangeRates')
      expect(Array.isArray(response.data.exchangeRates)).toBe(true)
      expect(response.data.exchangeRates.length).toBeGreaterThanOrEqual(MIN_RECORDS_THRESHOLD)

      if (response.data.exchangeRates.length > 0) {
        const firstRate = response.data.exchangeRates[0]
        expect(firstRate).toHaveProperty('date')
        expect(firstRate).toHaveProperty('currency')
        expect(firstRate).toHaveProperty('exchangeRate')
        expect(typeof firstRate.exchangeRate).toBe('number')
        expect(firstRate.exchangeRate).toBeGreaterThan(0)
      }

      console.log('✅ Exchange Rates:', {
        count: response.data.exchangeRates.length,
        sampleCurrencies: response.data.exchangeRates.slice(0, 3).map(r => r.currency),
        responseTime: `${response.metadata.responseTimeMs}ms`
      })
    }, API_TIMEOUT)

    it('should fetch real operating cash balance data', async () => {
      const response = await treasuryFiscalService.getOperatingCashBalance(undefined, 10)

      expect(response.dataType).toBe('Treasury Operating Cash Balance')
      expect(response.data).toHaveProperty('cashBalances')
      expect(Array.isArray(response.data.cashBalances)).toBe(true)

      if (response.data.cashBalances.length > 0) {
        const firstBalance = response.data.cashBalances[0]
        expect(firstBalance).toHaveProperty('date')
        expect(firstBalance).toHaveProperty('closingBalance')
        expect(typeof firstBalance.closingBalance).toBe('number')
      }

      console.log('✅ Operating Cash Balance:', {
        records: response.data.cashBalances.length,
        responseTime: `${response.metadata.responseTimeMs}ms`
      })
    }, API_TIMEOUT)

    it('should fetch federal revenue data', async () => {
      const response = await treasuryFiscalService.getFederalRevenue('2024', 10)

      expect(response.dataType).toBe('Federal Revenue')
      expect(response.data).toHaveProperty('fiscalYear', '2024')
      expect(response.data).toHaveProperty('revenueData')
      expect(Array.isArray(response.data.revenueData)).toBe(true)

      if (response.data.revenueData.length > 0) {
        const firstRecord = response.data.revenueData[0]
        expect(firstRecord).toHaveProperty('date')
        expect(firstRecord).toHaveProperty('classification')
        expect(firstRecord).toHaveProperty('grossReceipts')
        expect(firstRecord).toHaveProperty('formattedAmount')
      }

      console.log('✅ Federal Revenue 2024:', {
        records: response.data.revenueData.length,
        responseTime: `${response.metadata.responseTimeMs}ms`
      })
    }, API_TIMEOUT)

    it('should fetch federal spending data', async () => {
      const response = await treasuryFiscalService.getFederalSpending('2024', 10)

      expect(response.dataType).toBe('Federal Spending')
      expect(response.data).toHaveProperty('fiscalYear', '2024')
      expect(response.data).toHaveProperty('spendingData')
      expect(Array.isArray(response.data.spendingData)).toBe(true)

      if (response.data.spendingData.length > 0) {
        const firstRecord = response.data.spendingData[0]
        expect(firstRecord).toHaveProperty('date')
        expect(firstRecord).toHaveProperty('classification')
        expect(firstRecord).toHaveProperty('grossOutlays')
        expect(firstRecord).toHaveProperty('formattedAmount')
      }

      console.log('✅ Federal Spending 2024:', {
        records: response.data.spendingData.length,
        responseTime: `${response.metadata.responseTimeMs}ms`
      })
    }, API_TIMEOUT)

    it('should handle comprehensive fiscal summary', async () => {
      const response = await treasuryFiscalService.getComprehensiveFiscalSummary(30)

      expect(response.dataType).toBe('Comprehensive Fiscal Summary')
      expect(response.data).toHaveProperty('summary')
      expect(response.data.summary).toHaveProperty('dataPointsCollected')
      expect(response.data.summary).toHaveProperty('errors')

      // Should collect multiple data points
      expect(response.data.summary.dataPointsCollected).toBeGreaterThan(1)

      console.log('✅ Comprehensive Summary:', {
        dataPoints: response.data.summary.dataPointsCollected,
        errors: response.data.summary.errors,
        responseTime: `${response.metadata.responseTimeMs}ms`
      })
    }, API_TIMEOUT)
  })

  describe('MCP Client Integration Tests', () => {
    it('should execute treasury tools through MCP client', async () => {
      const debtResponse = await mcpClient.executeTool('get_federal_debt', { limit: 5 })

      expect(debtResponse.success).toBe(true)
      expect(debtResponse.source).toBe('treasury')
      expect(debtResponse.data).toBeDefined()

      console.log('✅ MCP Treasury Integration successful')
    }, API_TIMEOUT)

    it('should handle invalid treasury tools gracefully', async () => {
      const response = await mcpClient.executeTool('invalid_treasury_tool', {})

      // Should not crash and should return structured response
      expect(response).toHaveProperty('success')
      expect(response).toHaveProperty('source')

      console.log('✅ Treasury error handling validated')
    }, API_TIMEOUT)
  })

  describe('Performance and Quality Tests', () => {
    it('should meet performance benchmarks', async () => {
      const startTime = Date.now()

      // Test key endpoints
      const [debtData, exchangeData, cashData] = await Promise.all([
        treasuryFiscalService.getDebtToPenny(undefined, undefined, 3),
        treasuryFiscalService.getExchangeRates(undefined, 3),
        treasuryFiscalService.getOperatingCashBalance(undefined, 3)
      ])

      const totalTime = Date.now() - startTime

      // All should succeed
      expect(debtData.data.latestDebt.amount).toBeGreaterThan(30_000_000_000_000)
      expect(exchangeData.data.exchangeRates.length).toBeGreaterThan(0)
      expect(cashData.data.cashBalances.length).toBeGreaterThan(0)

      // Performance validation
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLD)
      expect(debtData.metadata.responseTimeMs).toBeLessThan(PERFORMANCE_THRESHOLD)
      expect(exchangeData.metadata.responseTimeMs).toBeLessThan(PERFORMANCE_THRESHOLD)
      expect(cashData.metadata.responseTimeMs).toBeLessThan(PERFORMANCE_THRESHOLD)

      console.log('✅ Performance benchmarks:', {
        totalTime: `${totalTime}ms`,
        debtTime: `${debtData.metadata.responseTimeMs}ms`,
        exchangeTime: `${exchangeData.metadata.responseTimeMs}ms`,
        cashTime: `${cashData.metadata.responseTimeMs}ms`
      })
    }, API_TIMEOUT)

    it('should handle rate limiting appropriately', async () => {
      const startTime = Date.now()

      // Make rapid requests to test rate limiting
      const promises = Array(3).fill(0).map(() =>
        treasuryFiscalService.getExchangeRates(undefined, 2)
      )

      const results = await Promise.allSettled(promises)
      const totalTime = Date.now() - startTime
      const successCount = results.filter(r => r.status === 'fulfilled').length

      expect(successCount).toBe(3) // All should succeed
      expect(totalTime).toBeGreaterThan(400) // Should take at least 400ms due to rate limiting

      console.log('✅ Rate limiting test:', {
        successCount,
        totalTime: `${totalTime}ms`
      })
    }, API_TIMEOUT)

    it('should validate data quality', async () => {
      const debtResponse = await treasuryFiscalService.getDebtToPenny(undefined, undefined, 5)

      // Data completeness validation
      expect(debtResponse.data.latestDebt.amount).toBeDefined()
      expect(debtResponse.data.latestDebt.date).toBeDefined()
      expect(debtResponse.data.latestDebt.formattedAmount).toBeDefined()

      // Data consistency validation
      const rawAmount = debtResponse.data.latestDebt.amount
      const trillionsStr = debtResponse.data.latestDebt.amountTrillions
      const expectedTrillions = (rawAmount / 1_000_000_000_000).toFixed(2)
      expect(trillionsStr).toContain(expectedTrillions.split('.')[0]) // At least the whole number part

      console.log('✅ Data quality validation passed')
    }, API_TIMEOUT)
  })

  describe('Integration with Stock Analysis (AAPL Example)', () => {
    it('should provide Treasury context for Apple (AAPL) stock analysis', async () => {
      console.log('📊 Creating Treasury context for AAPL stock analysis...')

      // Get Treasury data that would be relevant for stock analysis
      const [federalDebt, exchangeRates, cashBalance] = await Promise.all([
        treasuryFiscalService.getDebtToPenny(undefined, undefined, 5),
        treasuryFiscalService.getExchangeRates(undefined, 10),
        treasuryFiscalService.getOperatingCashBalance(undefined, 5)
      ])

      // Create contextual analysis for AAPL
      const aaplTreasuryContext = {
        ticker: 'AAPL',
        analysisTimestamp: new Date().toISOString(),
        macroeconomicFactors: {
          federalDebt: {
            amount: federalDebt.data.latestDebt.amount,
            formatted: federalDebt.data.latestDebt.formattedAmount,
            date: federalDebt.data.latestDebt.date,
            impactLevel: federalDebt.data.latestDebt.amount > 35_000_000_000_000 ? 'high' : 'moderate'
          },
          currencyRisks: exchangeRates.data.exchangeRates.slice(0, 5).map(rate => ({
            currency: rate.currency,
            exchangeRate: rate.exchangeRate,
            impactToAAPL: rate.currency === 'Euro' || rate.currency === 'Chinese Yuan' ? 'high' : 'moderate'
          })),
          fiscalPolicy: {
            governmentCashPosition: cashBalance.data.cashBalances[0]?.closingBalance || 0,
            fiscalStress: cashBalance.data.cashBalances[0]?.closingBalance < 100_000_000_000 ? 'high' : 'low'
          }
        },
        investmentImplications: {
          riskAssessment: federalDebt.data.latestDebt.amount > 35_000_000_000_000 ? 'elevated_fiscal_risk' : 'normal',
          sectorFocus: 'Technology stocks like AAPL may be affected by fiscal policy and currency fluctuations',
          recommendations: [
            'Monitor federal debt trends',
            'Watch exchange rates for international revenue impact',
            'Consider fiscal policy effects on corporate tax rates'
          ]
        }
      }

      // Validate the contextual analysis structure
      expect(aaplTreasuryContext.ticker).toBe('AAPL')
      expect(aaplTreasuryContext.macroeconomicFactors.federalDebt.amount).toBeGreaterThan(30_000_000_000_000)
      expect(aaplTreasuryContext.macroeconomicFactors.currencyRisks.length).toBeGreaterThan(0)
      expect(aaplTreasuryContext.investmentImplications.riskAssessment).toBeDefined()

      console.log('✅ AAPL Treasury Context Analysis:', {
        federalDebt: aaplTreasuryContext.macroeconomicFactors.federalDebt.formatted,
        impactLevel: aaplTreasuryContext.macroeconomicFactors.federalDebt.impactLevel,
        currenciesTracked: aaplTreasuryContext.macroeconomicFactors.currencyRisks.length,
        riskAssessment: aaplTreasuryContext.investmentImplications.riskAssessment,
        recommendations: aaplTreasuryContext.investmentImplications.recommendations.length
      })
    }, API_TIMEOUT)

    it('should integrate Treasury data with stock selection workflow for AAPL', async () => {
      console.log('🔄 Testing Treasury integration with stock selection workflow...')

      // Simulate how Treasury data would be used in stock selection for AAPL
      const fiscalSummary = await treasuryFiscalService.getComprehensiveFiscalSummary(15)

      const stockSelectionContext = {
        targetStock: 'AAPL',
        fiscalEnvironment: {
          dataQuality: fiscalSummary.data.summary.dataPointsCollected >= 3 ? 'high' : 'limited',
          fiscalStability: fiscalSummary.data.summary.errors === 0 ? 'stable' : 'uncertain',
          debtLevel: fiscalSummary.data.federalDebt?.latestDebt?.amount || 0
        },
        selectionAdjustments: {
          riskTolerance: fiscalSummary.data.federalDebt?.latestDebt?.amount > 35_000_000_000_000 ? 'conservative' : 'moderate',
          sectorWeighting: 'favor_technology_with_strong_international_presence',
          timeHorizon: 'Consider fiscal policy impacts on 1-3 year outlook',
          specificToAAPL: {
            internationalRevenue: 'Monitor currency impacts from Treasury exchange rates',
            corporateTax: 'Watch for fiscal policy changes affecting tech sector',
            cashPosition: 'Apple strong cash position relative to government fiscal stress'
          }
        },
        integrationQuality: {
          dataFreshness: fiscalSummary.data.federalDebt?.latestDebt?.date,
          responseTime: fiscalSummary.metadata.responseTimeMs,
          reliability: fiscalSummary.data.summary.errors === 0 ? 'high' : 'medium'
        }
      }

      // Validate integration quality
      expect(stockSelectionContext.targetStock).toBe('AAPL')
      expect(stockSelectionContext.fiscalEnvironment.dataQuality).toBeDefined()
      expect(stockSelectionContext.selectionAdjustments.riskTolerance).toBeDefined()
      expect(stockSelectionContext.integrationQuality.reliability).toBeDefined()

      // Performance validation
      expect(fiscalSummary.metadata.responseTimeMs).toBeLessThan(PERFORMANCE_THRESHOLD)

      console.log('✅ AAPL Stock Selection Integration:', {
        dataQuality: stockSelectionContext.fiscalEnvironment.dataQuality,
        riskTolerance: stockSelectionContext.selectionAdjustments.riskTolerance,
        responseTime: `${stockSelectionContext.integrationQuality.responseTime}ms`,
        reliability: stockSelectionContext.integrationQuality.reliability
      })
    }, API_TIMEOUT)
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid date ranges gracefully', async () => {
      // Test with future date (should return empty or handle gracefully)
      const futureDate = '2030-01-01'
      const response = await treasuryFiscalService.getDebtToPenny(futureDate, undefined, 5)

      // Should not crash and should return valid structure
      expect(response).toHaveProperty('dataType')
      expect(response).toHaveProperty('source')
      expect(response).toHaveProperty('data')

      console.log('✅ Future date handling validated')
    }, API_TIMEOUT)

    it('should handle large limit requests appropriately', async () => {
      // Test with large limit to see how API handles it
      const response = await treasuryFiscalService.getExchangeRates(undefined, 100)

      expect(response.data.exchangeRates).toBeDefined()
      expect(Array.isArray(response.data.exchangeRates)).toBe(true)
      expect(response.metadata.responseTimeMs).toBeLessThan(PERFORMANCE_THRESHOLD)

      console.log('✅ Large limit request handling validated')
    }, API_TIMEOUT)
  })

  afterAll(() => {
    console.log('🏁 Treasury Fiscal Data Integration Tests Completed')
    console.log('📊 All tests validate real Treasury Fiscal Data API integration')
    console.log('🍎 AAPL stock analysis context integration validated')
  })
})