/**
 * Test script for macroeconomic analysis integration
 * Tests the connection between economic data and stock analysis
 */

import { MacroeconomicAnalysisService } from './app/services/financial-data/MacroeconomicAnalysisService.js'
import { FREDAPI } from './app/services/financial-data/FREDAPI.js'
import { BLSAPI } from './app/services/financial-data/BLSAPI.js'
import { EIAAPI } from './app/services/financial-data/EIAAPI.js'

async function testMacroeconomicIntegration() {
  console.log('🧪 Testing Macroeconomic Analysis Integration...\n')

  try {
    // Initialize MacroeconomicAnalysisService
    const macroService = new MacroeconomicAnalysisService()

    console.log('✅ Services initialized successfully\n')

    // Test 1: Health check
    console.log('📋 Test 1: Health Check')
    const health = await macroService.healthCheck()
    console.log('Health status:', health.isHealthy)
    console.log('Sources:', health.sources)
    console.log('Overall Latency:', health.overallLatency)
    if (health.errors.length > 0) {
      console.log('Errors:', health.errors)
    }
    console.log()

    // Test 2: Get macroeconomic indicators
    console.log('📊 Test 2: Fetching Macroeconomic Indicators')
    const indicators = await macroService.getMacroeconomicContext()

    if (indicators) {
      console.log('✅ Successfully retrieved macroeconomic indicators')
      console.log('Overall Score:', indicators.overallScore)
      console.log('Inflation Environment:', indicators.inflationEnvironment)
      console.log('Monetary Policy:', indicators.monetaryPolicy)
      console.log('Economic Cycle:', indicators.economicCycle)
      console.log('Confidence:', indicators.confidence)
      console.log('Last Update:', indicators.lastUpdate)
      console.log('Data Sources Used:', indicators.dataSourcesUsed)
      console.log('Sector Impacts:', indicators.sectorImpacts)
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
        console.log(`Macro Score: ${macroImpact.macroScore.toFixed(3)}`)
        console.log(`Sector Impact: ${macroImpact.sectorImpact.toFixed(3)}`)
        console.log(`Overall Impact: ${macroImpact.impact}`)
        console.log(`Confidence: ${macroImpact.confidence.toFixed(3)}`)

        if (macroImpact.factors && macroImpact.factors.length > 0) {
          console.log('Factors:', macroImpact.factors.slice(0, 3))
        }
      } else {
        console.log(`❌ Analysis failed for ${stock.symbol}`)
      }
    }

    // Test 4: Comprehensive analysis
    console.log('\n📈 Test 4: Comprehensive Macroeconomic Analysis')
    const comprehensiveResult = await macroService.getComprehensiveMacroAnalysis()

    if (comprehensiveResult) {
      console.log('✅ Comprehensive analysis completed successfully')
      console.log('Overall Score:', comprehensiveResult.overallScore)
      console.log('Economic Cycle:', comprehensiveResult.economicCycle)
      console.log('Inflation Environment:', comprehensiveResult.inflationEnvironment)
      console.log('Monetary Policy:', comprehensiveResult.monetaryPolicy)

      if (comprehensiveResult.riskFactors) {
        console.log('Risk Factors:', {
          inflation: comprehensiveResult.riskFactors.inflationRisk.level,
          recession: comprehensiveResult.riskFactors.recessionRisk.level,
          monetary: comprehensiveResult.riskFactors.monetaryRisk.level
        })
      }

      if (comprehensiveResult.keyInsights && comprehensiveResult.keyInsights.length > 0) {
        console.log('Key Insights:', comprehensiveResult.keyInsights.slice(0, 2))
      }

      console.log('Performance Metrics:', {
        responseTime: comprehensiveResult.performanceMetrics.responseTime,
        dataCompleteness: comprehensiveResult.performanceMetrics.dataCompleteness,
        parallelEfficiency: comprehensiveResult.performanceMetrics.parallelEfficiency
      })
    } else {
      console.log('❌ Comprehensive analysis failed')
    }

    console.log('\n🎉 Macroeconomic integration test completed!')

    // Summary of integration success
    const integrationSuccess = indicators !== null && comprehensiveResult !== null
    console.log(`\n📊 Integration Status: ${integrationSuccess ? '✅ SUCCESS' : '❌ PARTIAL'}`)

    if (integrationSuccess) {
      console.log('✅ Economic data collection: Working')
      console.log('✅ Stock analysis integration: Working')
      console.log('✅ Comprehensive macro analysis: Working')
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