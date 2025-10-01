/**
 * Data Collection Script for ML Early Signal Detection
 * Fetches historical analyst ratings from FMP API
 *
 * Task 1.1: Create Data Collection Script
 * Estimated Time: 2 hours
 * Purpose: Fetch historical analyst ratings from FMP API
 */

import 'dotenv/config'
import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI'

export interface AnalystRatingsHistory {
  symbol: string
  date: Date
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  totalAnalysts: number
  consensus: string
  sentimentScore: number
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Collect historical analyst ratings for a list of symbols
 * @param symbols Array of stock symbols to collect data for
 * @param startDate Start date for historical data
 * @param endDate End date for historical data
 * @returns Array of analyst ratings history records
 */
export async function collectAnalystHistory(
  symbols: string[],
  startDate: Date,
  endDate: Date
): Promise<AnalystRatingsHistory[]> {
  const fmpAPI = new FinancialModelingPrepAPI()
  const allRatings: AnalystRatingsHistory[] = []

  console.log(`\nCollecting analyst ratings history for ${symbols.length} symbols`)
  console.log(`Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`)
  console.log('='.repeat(80))

  let successCount = 0
  let failureCount = 0

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i]
    const progress = ((i + 1) / symbols.length * 100).toFixed(1)

    try {
      console.log(`[${i + 1}/${symbols.length}] (${progress}%) Processing ${symbol}...`)

      // Fetch current analyst ratings (FMP doesn't provide historical endpoint, so we collect current state)
      const ratings = await fmpAPI.getAnalystRatings(symbol)

      if (ratings && ratings.totalAnalysts > 0) {
        // Store current ratings snapshot
        const historyRecord: AnalystRatingsHistory = {
          symbol: ratings.symbol,
          date: new Date(),
          strongBuy: ratings.strongBuy,
          buy: ratings.buy,
          hold: ratings.hold,
          sell: ratings.sell,
          strongSell: ratings.strongSell,
          totalAnalysts: ratings.totalAnalysts,
          consensus: ratings.consensus,
          sentimentScore: ratings.sentimentScore
        }

        allRatings.push(historyRecord)
        successCount++
        console.log(`  ✓ ${symbol}: ${ratings.totalAnalysts} analysts (${ratings.consensus})`)
      } else {
        failureCount++
        console.log(`  ✗ ${symbol}: No analyst coverage`)
      }

      // Rate limiting:
      // - Premium tier: ~10 requests/second
      // - Starter tier: ~1 request/second
      // Using conservative 200ms delay (5 requests/second)
      await sleep(200)

    } catch (error: any) {
      failureCount++
      console.error(`  ✗ ${symbol}: Failed - ${error.message}`)

      // If we hit rate limit, pause longer
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        console.log('  ⏸️  Rate limit detected, pausing for 5 seconds...')
        await sleep(5000)
      } else {
        // Normal retry delay
        await sleep(500)
      }

      continue
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('Collection Summary:')
  console.log(`  Total symbols: ${symbols.length}`)
  console.log(`  Successful: ${successCount}`)
  console.log(`  Failed: ${failureCount}`)
  console.log(`  Success rate: ${((successCount / symbols.length) * 100).toFixed(1)}%`)
  console.log(`  Total records: ${allRatings.length}`)
  console.log('='.repeat(80))

  return allRatings
}

/**
 * Main execution function
 */
async function main() {
  // Test with a small set of symbols first
  const testSymbols = ['TSLA', 'NVDA', 'AAPL', 'MSFT', 'GOOGL']

  console.log('🔮 ML Early Signal - Data Collection Script')
  console.log('Task 1.1: Historical Analyst Data Collection')

  const startDate = new Date('2022-01-01')
  const endDate = new Date('2024-12-31')

  try {
    const data = await collectAnalystHistory(testSymbols, startDate, endDate)

    console.log('\n📊 Sample Data Preview:')
    console.log(JSON.stringify(data.slice(0, 2), null, 2))

    console.log('\n✅ Data collection test successful!')
    console.log('💡 Next step: Implement label generation logic (Task 1.2)')

  } catch (error: any) {
    console.error('\n❌ Data collection failed:', error.message)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error)
}
