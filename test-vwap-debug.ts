#!/usr/bin/env ts-node

import { PolygonAPI } from './app/services/financial-data/PolygonAPI'
import { VWAPService } from './app/services/financial-data/VWAPService'
import { RedisCache } from './app/services/cache/RedisCache'

async function testVWAP() {
  console.log('Testing VWAP implementation...')

  // Initialize services
  const polygonAPI = new PolygonAPI(process.env.POLYGON_API_KEY)
  const cache = new RedisCache({
    host: 'localhost',
    port: 6379,
    keyPrefix: 'debug:vwap:'
  })

  const vwapService = new VWAPService(polygonAPI, cache)

  try {
    // Test Polygon API health
    console.log('\n1. Testing Polygon API health...')
    const health = await polygonAPI.healthCheck()
    console.log('Polygon API health:', health)

    // Test basic stock data
    console.log('\n2. Testing basic stock data for AAPL...')
    const stockData = await polygonAPI.getStockPrice('AAPL')
    console.log('Stock data:', stockData)

    // Test VWAP calculation directly
    console.log('\n3. Testing VWAP calculation for AAPL...')
    const vwapData = await polygonAPI.getVWAP('AAPL')
    console.log('VWAP data:', vwapData)

    // Test VWAP analysis
    console.log('\n4. Testing VWAP analysis for AAPL...')
    const vwapAnalysis = await vwapService.getVWAPAnalysis('AAPL')
    console.log('VWAP analysis:', vwapAnalysis)

    console.log('\nVWAP test completed successfully!')

  } catch (error) {
    console.error('VWAP test failed:', error)
  }
}

// Run the test
testVWAP().catch(console.error)