/**
 * Test script for updated Polygon API with change calculation and polling
 */

import { PolygonAPI } from './app/services/financial-data/PolygonAPI.js'
import { PollingManager } from './app/services/financial-data/PollingManager.js'

async function testPolygonUpdates() {
  console.log('Testing Polygon API Updates...\n')

  const polygonAPI = new PolygonAPI()

  // Test 1: Get stock price with change calculation
  console.log('1. Testing getStockPrice with change calculation:')
  const appleData = await polygonAPI.getStockPrice('AAPL')
  if (appleData) {
    console.log('✅ AAPL Data:')
    console.log(`  Price: $${appleData.price}`)
    console.log(`  Change: $${appleData.change}`)
    console.log(`  Change %: ${appleData.changePercent}%`)
    console.log(`  Volume: ${appleData.volume.toLocaleString()}`)
    console.log(`  Source: ${appleData.source}`)
  } else {
    console.log('❌ Failed to fetch AAPL data')
  }

  // Test 2: Get latest trade
  console.log('\n2. Testing getLatestTrade:')
  const latestTrade = await polygonAPI.getLatestTrade('GOOGL')
  if (latestTrade) {
    console.log('✅ GOOGL Latest Trade:')
    console.log(`  Price: $${latestTrade.price}`)
    console.log(`  Change: $${latestTrade.change}`)
    console.log(`  Change %: ${latestTrade.changePercent}%`)
  } else {
    console.log('⚠️  Latest trade not available, using snapshot data')
  }

  // Test 3: Batch prices
  console.log('\n3. Testing getBatchPrices:')
  const batchPrices = await polygonAPI.getBatchPrices(['AAPL', 'GOOGL', 'MSFT'])
  if (batchPrices.size > 0) {
    console.log('✅ Batch Prices:')
    batchPrices.forEach((data, symbol) => {
      console.log(`  ${symbol}: $${data.price} (${data.change > 0 ? '+' : ''}${data.changePercent}%)`)
    })
  } else {
    console.log('❌ Failed to fetch batch prices')
  }

  // Test 4: Polling Manager
  console.log('\n4. Testing Polling Manager:')
  const pollingManager = new PollingManager(polygonAPI, {
    marketHoursInterval: 5000,  // 5 seconds for testing
    afterHoursInterval: 10000   // 10 seconds for testing
  })

  const marketStatus = pollingManager.getMarketStatus()
  console.log(`  Market Period: ${marketStatus.period}`)
  console.log(`  Market Open: ${marketStatus.isMarketOpen}`)
  console.log(`  Next Poll Interval: ${marketStatus.nextInterval / 1000}s`)

  // Start polling for AAPL (will poll once then stop for this test)
  console.log('\n5. Starting single poll test for AAPL...')
  let pollCount = 0
  pollingManager.startPolling('AAPL', (data) => {
    pollCount++
    if (data) {
      console.log(`  Poll #${pollCount}: AAPL = $${data.price} (${data.change > 0 ? '+' : ''}${data.changePercent}%)`)
    }
    if (pollCount >= 2) {
      pollingManager.stopPolling('AAPL')
      console.log('  Polling stopped after 2 polls')
    }
  })

  // Wait for polls to complete
  await new Promise(resolve => setTimeout(resolve, 15000))

  console.log('\n✅ All tests completed!')
}

// Run the test
testPolygonUpdates().catch(console.error)