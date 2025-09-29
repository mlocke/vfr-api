/**
 * Test script to debug MarketIndicesService provider fallback
 * Run with: node test-market-indices.js
 */

require('dotenv').config({ path: '.env' })

async function testMarketIndices() {
  console.log('🔍 Testing Market Indices Service...\n')

  // Check environment variables
  console.log('📋 Environment Variables:')
  console.log(`FMP_API_KEY: ${process.env.FMP_API_KEY ? '✅ Set (' + process.env.FMP_API_KEY.substring(0, 10) + '...)' : '❌ Not set'}`)
  console.log(`POLYGON_API_KEY: ${process.env.POLYGON_API_KEY ? '✅ Set' : '❌ Not set'}`)
  console.log(`TWELVE_DATA_API_KEY: ${process.env.TWELVE_DATA_API_KEY ? '✅ Set' : '❌ Not set'}\n`)

  // Import services
  const { MarketIndicesService } = await import('./app/services/financial-data/MarketIndicesService.ts')

  const service = new MarketIndicesService()

  console.log('🔄 Testing sector ETF data retrieval...\n')

  // Test a few sector ETFs
  const testSymbols = ['XLK', 'XLF', 'XLE']

  for (const symbol of testSymbols) {
    console.log(`Testing ${symbol}...`)
    const data = await service['getIndexData'](symbol, `${symbol} Test`)

    if (data) {
      console.log(`✅ ${symbol}:`, {
        value: data.value,
        change: data.change,
        changePercent: data.changePercent,
        source: data.source
      })
    } else {
      console.log(`❌ ${symbol}: No data retrieved`)
    }
    console.log('')
  }

  console.log('🔍 Testing getAllIndices()...\n')
  const allData = await service.getAllIndices()

  console.log('📊 Sector Data:')
  Object.entries(allData.sectors).forEach(([key, value]) => {
    if (value) {
      console.log(`  ${key.toUpperCase()}: ${value.changePercent}% (source: ${value.source})`)
    } else {
      console.log(`  ${key.toUpperCase()}: ❌ No data`)
    }
  })

  console.log(`\n📈 Data Quality: ${(allData.dataQuality * 100).toFixed(0)}%`)
  console.log(`⏱️  Timestamp: ${new Date(allData.timestamp).toLocaleString()}`)
}

testMarketIndices().catch(console.error)