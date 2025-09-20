#!/usr/bin/env node
/**
 * Test script for Fallback Data Service
 * Tests free data source failover functionality
 */

import { FallbackDataService } from './app/services/financial-data/FallbackDataService.js'

async function testFallbackService() {
  console.log('🧪 Testing Fallback Data Service with FREE sources only\n')

  const fallbackService = new FallbackDataService()

  // Test 1: Single stock price with fallback
  console.log('1️⃣ Testing single stock price (AAPL):')
  console.log('─'.repeat(50))
  const appleData = await fallbackService.getStockPrice('AAPL')
  if (appleData) {
    console.log('✅ Data retrieved:')
    console.log(`  Symbol: ${appleData.symbol}`)
    console.log(`  Price: $${appleData.price}`)
    console.log(`  Change: $${appleData.change} (${appleData.changePercent}%)`)
    console.log(`  Volume: ${appleData.volume?.toLocaleString() || 'N/A'}`)
    console.log(`  Source: ${appleData.source}`)
  } else {
    console.log('❌ Failed to get AAPL data')
  }

  // Test 2: Multiple symbols with batch fallback
  console.log('\n2️⃣ Testing batch prices (AAPL, GOOGL, MSFT):')
  console.log('─'.repeat(50))
  const symbols = ['AAPL', 'GOOGL', 'MSFT']
  const batchData = await fallbackService.getBatchPrices(symbols)

  if (batchData.size > 0) {
    console.log(`✅ Retrieved ${batchData.size}/${symbols.length} symbols:`)
    batchData.forEach((data, symbol) => {
      console.log(`  ${symbol}: $${data.price} (${data.change >= 0 ? '+' : ''}${data.changePercent}%) via ${data.source}`)
    })
  } else {
    console.log('❌ Failed to get batch data')
  }

  // Test 3: Source availability status
  console.log('\n3️⃣ Data Source Availability:')
  console.log('─'.repeat(50))
  const status = fallbackService.getSourceStatus()
  status.forEach(source => {
    const icon = source.available ? '✅' : '⚠️'
    console.log(`${icon} ${source.name}:`)
    console.log(`   Rate: ${source.rateLimit.current}/${source.rateLimit.limit} req/min`)
    if (source.dailyLimit) {
      console.log(`   Daily: ${source.dailyLimit.current}/${source.dailyLimit.limit} req/day`)
    }
  })

  // Test 4: Simulate primary source failure
  console.log('\n4️⃣ Testing failover (intentionally invalid symbol):')
  console.log('─'.repeat(50))
  const invalidData = await fallbackService.getStockPrice('INVALID_SYMBOL_XYZ')
  if (!invalidData) {
    console.log('✅ Correctly failed for invalid symbol (all sources tried)')
  } else {
    console.log('⚠️ Unexpected: Got data for invalid symbol')
  }

  // Test 5: Company info with fallback
  console.log('\n5️⃣ Testing company info (TSLA):')
  console.log('─'.repeat(50))
  const companyInfo = await fallbackService.getCompanyInfo('TSLA')
  if (companyInfo) {
    console.log('✅ Company info retrieved:')
    console.log(`  Name: ${companyInfo.name}`)
    console.log(`  Sector: ${companyInfo.sector || 'N/A'}`)
    console.log(`  Market Cap: ${companyInfo.marketCap ? `$${(companyInfo.marketCap/1e9).toFixed(2)}B` : 'N/A'}`)
  } else {
    console.log('⚠️ No company info available')
  }

  // Test 6: Health check
  console.log('\n6️⃣ Testing health check:')
  console.log('─'.repeat(50))
  const isHealthy = await fallbackService.healthCheck()
  console.log(isHealthy ? '✅ At least one data source is healthy' : '❌ All data sources are down')

  console.log('\n' + '='.repeat(50))
  console.log('🎉 Fallback service test complete!')
  console.log('='.repeat(50))

  // Summary
  console.log('\n📊 FREE Data Sources Priority:')
  console.log('1. Yahoo Finance - Unlimited, no API key')
  console.log('2. Alpha Vantage - 25/day, 5/min')
  console.log('3. Twelve Data - 800/day, 8/min')
  console.log('4. FMP - 250/day')
  console.log('5. Polygon - 5/min (backup)')
}

// Run the test
testFallbackService().catch(console.error)