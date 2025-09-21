#!/usr/bin/env node

/**
 * Test the updated FRED API implementation
 */

// Load environment variables
require('dotenv').config()

// Also manually set for testing
process.env.FRED_API_KEY = 'e093a281de7f0d224ed51ad0842fc393'

// Import the FRED API class
const { FREDAPI } = require('./app/services/financial-data/FREDAPI.ts')

async function testFREDAPI() {
  console.log('🏦 Testing FRED API implementation...')

  try {
    // Test 1: Initialize with valid API key
    console.log('\n1. Testing initialization with valid API key...')
    const fredAPI = new FREDAPI(undefined, 10000, true)
    console.log('✅ FRED API initialized successfully')

    // Test 2: Health check
    console.log('\n2. Testing health check...')
    const healthResult = await fredAPI.healthCheck()
    console.log('Health check result:', healthResult)

    // Test 3: Get stock price (unemployment rate)
    console.log('\n3. Testing getStockPrice with UNRATE...')
    const stockData = await fredAPI.getStockPrice('UNRATE')
    console.log('Stock data result:', JSON.stringify(stockData, null, 2))

    // Test 4: Get company info (series info)
    console.log('\n4. Testing getCompanyInfo with UNRATE...')
    const companyInfo = await fredAPI.getCompanyInfo('UNRATE')
    console.log('Company info result:', JSON.stringify(companyInfo, null, 2))

    // Test 5: Get market data
    console.log('\n5. Testing getMarketData with UNRATE...')
    const marketData = await fredAPI.getMarketData('UNRATE')
    console.log('Market data result:', JSON.stringify(marketData, null, 2))

    // Test 6: Test with invalid API key format
    console.log('\n6. Testing with invalid API key format...')
    const invalidFredAPI = new FREDAPI('INVALID_KEY_FORMAT', 10000, false)
    const invalidHealthResult = await invalidFredAPI.healthCheck()
    console.log('Invalid health check result:', invalidHealthResult)

    // Test 7: Test popular indicators
    console.log('\n7. Testing popular indicators...')
    const popularIndicators = fredAPI.getPopularIndicators()
    console.log('Popular indicators count:', popularIndicators.length)
    console.log('First 5 indicators:', popularIndicators.slice(0, 5))

    console.log('\n✅ All FRED API tests completed!')

  } catch (error) {
    console.error('❌ Error testing FRED API:', error.message)
  }
}

testFREDAPI()