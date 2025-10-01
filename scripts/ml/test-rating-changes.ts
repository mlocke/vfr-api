/**
 * Quick test script to verify FMP rating changes API works
 */

import 'dotenv/config'
import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI.js'

async function testRatingChanges() {
  console.log('Testing FMP Rating Changes API...\n')

  const fmpAPI = new FinancialModelingPrepAPI()
  const testSymbols = ['TSLA', 'AAPL', 'NVDA']

  for (const symbol of testSymbols) {
    console.log(`\n${symbol}:`)
    console.log('='.repeat(50))

    try {
      const changes = await fmpAPI.getRecentRatingChanges(symbol, 100)

      if (!changes || changes.length === 0) {
        console.log(`No rating changes found`)
        continue
      }

      console.log(`Found ${changes.length} rating changes`)

      // Filter last 2 years
      const twoYearsAgo = new Date()
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

      const recentChanges = changes.filter(c => new Date(c.publishedDate) >= twoYearsAgo)
      console.log(`  ${recentChanges.length} in last 2 years`)

      // Count by action
      const upgrades = recentChanges.filter(c => c.action === 'upgrade').length
      const downgrades = recentChanges.filter(c => c.action === 'downgrade').length
      const initiates = recentChanges.filter(c => c.action === 'initiate').length
      const maintains = recentChanges.filter(c => c.action === 'maintain').length

      console.log(`  Upgrades: ${upgrades}`)
      console.log(`  Downgrades: ${downgrades}`)
      console.log(`  Initiates: ${initiates}`)
      console.log(`  Maintains: ${maintains}`)

      // Show first 3
      console.log(`\n  Recent changes:`)
      recentChanges.slice(0, 3).forEach((change, idx) => {
        console.log(`    ${idx + 1}. ${change.publishedDate} - ${change.action} by ${change.analystCompany}`)
      })

    } catch (error: any) {
      console.error(`Error: ${error.message}`)
    }
  }
}

testRatingChanges().catch(console.error)
