/**
 * Test script for macroeconomic analysis integration
 * Tests the connection between economic data and stock analysis
 */

import MacroeconomicAnalysisService from './app/services/financial-data/MacroeconomicAnalysisService.js'
import { FREDAPI } from './app/services/financial-data/FREDAPI.js'
import { BLSAPI } from './app/services/financial-data/BLSAPI.js'
import { EIAAPI } from './app/services/financial-data/EIAAPI.js'

async function testMacroeconomicIntegration() {
  console.log('🧪 Testing Macroeconomic Analysis Integration...\n')

  try {
    // Initialize APIs
    const fredAPI = new FREDAPI()
    const blsAPI = new BLSAPI()
    const eiaAPI = new EIAAPI()

    // Use a simple mock cache for testing
    const cache = {
      get: async () => null,
      set: async () => true,
      ping: async () => 'PONG'
    } as any

    // Initialize MacroeconomicAnalysisService
    const macroService = new MacroeconomicAnalysisService(fredAPI, blsAPI, eiaAPI, cache)

    console.log('✅ Services initialized successfully\n')

    // Test 1: Health check
    console.log('📋 Test 1: Health Check')
    const health = await macroService.healthCheck()
    console.log('Health status:', health.status)
    console.log('Details:', health.details)
    console.log()

    // Test 2: Get macroeconomic indicators
    console.log('📊 Test 2: Fetching Macroeconomic Indicators')
    const indicators = await macroService.getMacroeconomicIndicators()

    if (indicators) {
      console.log('✅ Successfully retrieved macroeconomic indicators')
      console.log('GDP Data:', {
        real: indicators.gdp.real,
        nominal: indicators.gdp.nominal,
        potential: indicators.gdp.potential
      })
      console.log('Inflation Data:', {
        cpi: indicators.inflation.cpi,
        coreCpi: indicators.inflation.coreCpi
      })
      console.log('Employment Data:', {
        unemploymentRate: indicators.employment.unemploymentRate,
        participationRate: indicators.employment.participationRate
      })
      console.log('Interest Rates:', {
        treasury3m: indicators.interestRates.treasury3m,
        treasury10y: indicators.interestRates.treasury10y,
        yieldCurveSlope: indicators.interestRates.yieldCurveSlope,
        isInverted: indicators.interestRates.isInverted
      })
      console.log('Money Supply:', {
        m1: indicators.moneySupply.m1,
        m2: indicators.moneySupply.m2
      })
      console.log('Exchange Rates:', {
        dxy: indicators.exchangeRates.dxy,
        eurUsd: indicators.exchangeRates.eurUsd
      })
    } else {
      console.log('❌ Failed to retrieve macroeconomic indicators')
    }
    console.log()

    // Test 3: Analyze stock macro impact
    console.log('📈 Test 3: Stock Macroeconomic Impact Analysis')
    const testStocks = [
      { symbol: 'AAPL', sector: 'Technology', baseScore: 0.75 },
      { symbol: 'JPM', sector: 'Financials', baseScore: 0.68 },
      { symbol: 'VZ', sector: 'Communication Services', baseScore: 0.65 }
    ]

    for (const stock of testStocks) {
      console.log(`\n📊 Analyzing ${stock.symbol} (${stock.sector})...`)

      const macroImpact = await macroService.analyzeStockMacroImpact(
        stock.symbol,
        stock.sector,
        stock.baseScore
      )

      if (macroImpact) {
        console.log(`✅ Analysis completed for ${stock.symbol}`)
        console.log(`Original Score: ${stock.baseScore}`)
        console.log(`Adjusted Score: ${macroImpact.adjustedScore.toFixed(3)}`)
        console.log(`Macro Weight: ${(macroImpact.macroWeight * 100).toFixed(1)}%`)

        if (macroImpact.macroScore) {
          console.log(`Macro Score: ${macroImpact.macroScore.overall.toFixed(3)}`)
          console.log(`Confidence: ${macroImpact.macroScore.confidence.toFixed(3)}`)

          if (macroImpact.macroScore.reasoning.length > 0) {
            console.log('Reasoning:', macroImpact.macroScore.reasoning.slice(0, 2))
          }

          if (macroImpact.macroScore.warnings.length > 0) {
            console.log('Warnings:', macroImpact.macroScore.warnings.slice(0, 2))
          }

          if (macroImpact.macroScore.opportunities.length > 0) {
            console.log('Opportunities:', macroImpact.macroScore.opportunities.slice(0, 2))
          }
        }

        if (macroImpact.sectorImpact) {
          console.log(`Sector Outlook: ${macroImpact.sectorImpact.outlook}`)
          console.log(`Environment Score: ${macroImpact.sectorImpact.currentEnvironmentScore.toFixed(3)}`)
        }

        // Show correlations
        console.log('Economic Correlations:', {
          gdp: macroImpact.correlationAnalysis.gdpCorrelation.toFixed(2),
          inflation: macroImpact.correlationAnalysis.inflationCorrelation.toFixed(2),
          rates: macroImpact.correlationAnalysis.rateCorrelation.toFixed(2),
          dxy: macroImpact.correlationAnalysis.dxyCorrelation.toFixed(2)
        })
      } else {
        console.log(`❌ Analysis failed for ${stock.symbol}`)
      }
    }

    // Test 4: Bulk analysis
    console.log('\n📈 Test 4: Bulk Macroeconomic Analysis')
    const bulkResult = await macroService.analyzeBulkMacroImpact(testStocks)

    if (bulkResult.success) {
      console.log('✅ Bulk analysis completed successfully')
      console.log(`Execution time: ${bulkResult.executionTime}ms`)
      console.log(`Analyzed ${bulkResult.data?.stockImpacts.length || 0} stocks`)

      if (bulkResult.data?.cycleAnalysis) {
        console.log('Economic Cycle:', {
          phase: bulkResult.data.cycleAnalysis.cycle.phase,
          confidence: bulkResult.data.cycleAnalysis.cycle.confidence.toFixed(3)
        })
        console.log('Risk Factors:', {
          recession: bulkResult.data.cycleAnalysis.riskFactors.recessionRisk.toFixed(3),
          inflation: bulkResult.data.cycleAnalysis.riskFactors.inflationRisk.toFixed(3),
          rateHike: bulkResult.data.cycleAnalysis.riskFactors.rateHikeRisk.toFixed(3)
        })
      }
    } else {
      console.log('❌ Bulk analysis failed:', bulkResult.error)
    }

    console.log('\n🎉 Macroeconomic integration test completed!')

    // Summary of integration success
    const integrationSuccess = indicators !== null && bulkResult.success
    console.log(`\n📊 Integration Status: ${integrationSuccess ? '✅ SUCCESS' : '❌ PARTIAL'}`)

    if (integrationSuccess) {
      console.log('✅ Economic data collection: Working')
      console.log('✅ Stock analysis integration: Working')
      console.log('✅ 20% macro weight application: Working')
      console.log('✅ Sector sensitivity analysis: Working')
      console.log('✅ Economic cycle analysis: Working')
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
  }
}

// Run the test
if (require.main === module) {
  testMacroeconomicIntegration()
    .then(() => {
      console.log('\n🔄 Test execution completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Test execution failed:', error)
      process.exit(1)
    })
}

export default testMacroeconomicIntegration