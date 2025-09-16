#!/usr/bin/env node

/**
 * Direct Treasury API Test Script
 *
 * Tests Treasury Fiscal Data API endpoints directly to validate
 * endpoint URLs and response formats.
 */

async function testTreasuryAPI() {
  console.log('🏛️ Testing Treasury Fiscal Data API Direct Access')
  console.log('Base URL: https://api.fiscaldata.treasury.gov/services/api/fiscal_service')

  const baseUrl = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'

  // Test endpoints from Treasury documentation
  const endpoints = [
    {
      name: 'Debt to the Penny',
      path: '/v2/accounting/od/debt_to_penny',
      params: '?sort=-record_date&page[size]=5'
    },
    {
      name: 'Daily Treasury Statement',
      path: '/v1/accounting/dts/dts_table_1',
      params: '?sort=-record_date&page[size]=5'
    },
    {
      name: 'Exchange Rates',
      path: '/v1/accounting/od/rates_of_exchange',
      params: '?sort=-record_date&page[size]=5'
    },
    {
      name: 'Operating Cash Balance',
      path: '/v1/accounting/dts/operating_cash_balance',
      params: '?sort=-record_date&page[size]=5'
    }
  ]

  for (const endpoint of endpoints) {
    console.log(`\n📊 Testing: ${endpoint.name}`)
    console.log(`URL: ${baseUrl}${endpoint.path}${endpoint.params}`)

    try {
      const startTime = Date.now()
      const response = await fetch(`${baseUrl}${endpoint.path}${endpoint.params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Treasury-API-Test-Script'
        }
      })

      const responseTime = Date.now() - startTime

      console.log(`Status: ${response.status} ${response.statusText}`)
      console.log(`Response Time: ${responseTime}ms`)

      if (response.ok) {
        const data = await response.json()
        console.log(`✅ Success: ${data.data?.length || 0} records`)

        if (data.data && data.data.length > 0) {
          console.log('Sample fields:', Object.keys(data.data[0]).slice(0, 5).join(', '))
        }

        if (data.meta) {
          console.log(`Total records: ${data.meta.total_count}`)
        }
      } else {
        const errorText = await response.text()
        console.log(`❌ Error: ${errorText.slice(0, 200)}...`)
      }

    } catch (error) {
      console.log(`❌ Network Error: ${error.message}`)
    }
  }

  // Test the main datasets endpoint to see what's available
  console.log(`\n📋 Testing: Available Datasets`)
  try {
    const response = await fetch(`${baseUrl}/v2/datasets`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Treasury-API-Test-Script'
      }
    })

    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Found ${data.data?.length || 0} available datasets`)

      if (data.data && data.data.length > 0) {
        console.log('Available datasets:')
        data.data.slice(0, 10).forEach((dataset, i) => {
          console.log(`  ${i+1}. ${dataset.name} (${dataset.table_name})`)
        })
      }
    } else {
      console.log(`❌ Datasets endpoint error: ${response.status}`)
    }
  } catch (error) {
    console.log(`❌ Datasets network error: ${error.message}`)
  }

  console.log('\n🏁 Treasury API Direct Test Complete')
}

// Run the test
testTreasuryAPI().catch(console.error)