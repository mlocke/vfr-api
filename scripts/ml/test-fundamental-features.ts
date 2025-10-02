/**
 * Test Fundamental Features Implementation
 *
 * Purpose: Verify earnings surprise, revenue growth acceleration, and analyst coverage
 * features are working correctly with real FMP API data
 */

import * as dotenv from 'dotenv'
import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI'

// Load environment variables
dotenv.config()

async function testFundamentalFeatures() {
  console.log('=== Testing Fundamental Features ===\n')

  const fmpAPI = new FinancialModelingPrepAPI()
  const testSymbols = ['AAPL', 'NVDA', 'TSLA']
  const asOfDate = new Date('2024-12-01') // Test with recent date to ensure earnings data available

  for (const symbol of testSymbols) {
    console.log(`\n--- Testing ${symbol} ---`)

    try {
      // Test 1: Earnings Surprise
      console.log('\n1. Earnings Surprise:')
      const earnings = await fmpAPI.getEarningsSurprises(symbol, 4)
      
      if (earnings && earnings.length > 0) {
        const relevantEarnings = earnings
          .filter((e: any) => new Date(e.date) <= asOfDate)
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

        if (relevantEarnings.length > 0) {
          const mostRecent = relevantEarnings[0]
          const actual = mostRecent.actualEarningResult
          const estimated = mostRecent.estimatedEarning
          const surprise = estimated !== 0 ? ((actual - estimated) / Math.abs(estimated)) * 100 : 0

          console.log(`  Date: ${mostRecent.date}`)
          console.log(`  Actual: $${actual?.toFixed(4) || 'N/A'}`)
          console.log(`  Estimated: $${estimated?.toFixed(4) || 'N/A'}`)
          console.log(`  Surprise: ${surprise.toFixed(2)}%`)
        } else {
          console.log('  No earnings data before test date')
        }
      } else {
        console.log('  No earnings data available')
      }

      // Test 2: Revenue Growth Acceleration
      console.log('\n2. Revenue Growth Acceleration:')
      const incomeStatements = await fmpAPI.getIncomeStatement(symbol, 'quarterly', 8)

      if (incomeStatements && incomeStatements.length >= 4) {
        const relevantStatements = incomeStatements
          .filter((s: any) => new Date(s.date) <= asOfDate)
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

        if (relevantStatements.length >= 4) {
          const recentRevenue = relevantStatements[0].revenue
          const recentYearAgoRevenue = relevantStatements[3]?.revenue
          const recentGrowthRate = recentYearAgoRevenue !== 0 
            ? ((recentRevenue - recentYearAgoRevenue) / recentYearAgoRevenue) * 100 
            : 0

          console.log(`  Recent Quarter (${relevantStatements[0].date}): $${(recentRevenue / 1e9).toFixed(2)}B`)
          console.log(`  Year Ago Quarter (${relevantStatements[3].date}): $${(recentYearAgoRevenue / 1e9).toFixed(2)}B`)
          console.log(`  YoY Growth: ${recentGrowthRate.toFixed(2)}%`)

          if (relevantStatements.length >= 5) {
            const previousRevenue = relevantStatements[1].revenue
            const previousYearAgoRevenue = relevantStatements[4]?.revenue
            const previousGrowthRate = previousYearAgoRevenue !== 0
              ? ((previousRevenue - previousYearAgoRevenue) / previousYearAgoRevenue) * 100
              : 0
            const acceleration = recentGrowthRate - previousGrowthRate

            console.log(`  Previous YoY Growth: ${previousGrowthRate.toFixed(2)}%`)
            console.log(`  Acceleration: ${acceleration.toFixed(2)} percentage points`)
          }
        } else {
          console.log('  Insufficient historical data before test date')
        }
      } else {
        console.log('  No income statement data available')
      }

      // Test 3: Analyst Coverage
      console.log('\n3. Analyst Coverage:')
      const analystRatings = await fmpAPI.getAnalystRatings(symbol)

      if (analystRatings && analystRatings.totalAnalysts) {
        const totalAnalysts = analystRatings.totalAnalysts
        let coverageScore = 0
        if (totalAnalysts <= 5) coverageScore = 0
        else if (totalAnalysts <= 10) coverageScore = 5
        else if (totalAnalysts <= 20) coverageScore = 10
        else coverageScore = 15

        console.log(`  Total Analysts: ${totalAnalysts}`)
        console.log(`  Coverage Score: ${coverageScore}`)
        console.log(`  Consensus: ${analystRatings.consensus || 'N/A'}`)
        console.log(`  Breakdown: Buy=${analystRatings.buy || 0}, Hold=${analystRatings.hold || 0}, Sell=${analystRatings.sell || 0}`)
      } else {
        console.log('  No analyst coverage data available')
      }

      // Wait between symbols to respect rate limits
      if (testSymbols.indexOf(symbol) < testSymbols.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    } catch (error) {
      console.error(`  Error testing ${symbol}:`, error)
    }
  }

  console.log('\n=== Test Complete ===')
}

testFundamentalFeatures().catch(console.error)
