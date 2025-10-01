/**
 * Test FMP upgrades-downgrades-consensus endpoint
 */

import 'dotenv/config'
import axios from 'axios'

async function testUpgradesDowngrades() {
  const apiKey = process.env.FMP_API_KEY
  const symbol = 'TSLA'

  console.log('Testing FMP Upgrades/Downgrades Endpoints...\n')

  // Test v3 endpoint
  console.log('1. Testing v3/upgrades-downgrades:')
  try {
    const v3Url = `https://financialmodelingprep.com/api/v3/upgrades-downgrades?symbol=${symbol}&apikey=${apiKey}`
    const v3Response = await axios.get(v3Url)
    console.log(`   Status: ${v3Response.status}`)
    console.log(`   Data: ${JSON.stringify(v3Response.data).slice(0, 200)}`)
  } catch (error: any) {
    console.log(`   Error: ${error.message}`)
  }

  // Test v4 endpoint
  console.log('\n2. Testing v4/upgrades-downgrades-consensus:')
  try {
    const v4Url = `https://financialmodelingprep.com/api/v4/upgrades-downgrades-consensus?symbol=${symbol}&apikey=${apiKey}`
    const v4Response = await axios.get(v4Url)
    console.log(`   Status: ${v4Response.status}`)
    console.log(`   Data: ${JSON.stringify(v4Response.data).slice(0, 200)}`)
  } catch (error: any) {
    console.log(`   Error: ${error.message}`)
  }

  // Test price target news
  console.log('\n3. Testing v3/price-target-latest-news:')
  try {
    const newsUrl = `https://financialmodelingprep.com/api/v3/price-target-latest-news?symbol=${symbol}&limit=10&apikey=${apiKey}`
    const newsResponse = await axios.get(newsUrl)
    console.log(`   Status: ${newsResponse.status}`)
    console.log(`   Data: ${JSON.stringify(newsResponse.data).slice(0, 200)}`)
  } catch (error: any) {
    console.log(`   Error: ${error.message}`)
  }

  // Test analyst estimates
  console.log('\n4. Testing v3/analyst-estimates:')
  try {
    const estimatesUrl = `https://financialmodelingprep.com/api/v3/analyst-estimates/${symbol}?limit=30&apikey=${apiKey}`
    const estimatesResponse = await axios.get(estimatesUrl)
    console.log(`   Status: ${estimatesResponse.status}`)
    console.log(`   Data: ${JSON.stringify(estimatesResponse.data).slice(0, 200)}`)
  } catch (error: any) {
    console.log(`   Error: ${error.message}`)
  }

  // Test earnings surprises
  console.log('\n5. Testing v3/earnings-surprises:')
  try {
    const earningsUrl = `https://financialmodelingprep.com/api/v3/earnings-surprises/${symbol}?apikey=${apiKey}`
    const earningsResponse = await axios.get(earningsUrl)
    console.log(`   Status: ${earningsResponse.status}`)
    console.log(`   Count: ${earningsResponse.data?.length || 0} records`)
    if (earningsResponse.data?.length > 0) {
      console.log(`   Sample: ${JSON.stringify(earningsResponse.data[0])}`)
    }
  } catch (error: any) {
    console.log(`   Error: ${error.message}`)
  }
}

testUpgradesDowngrades().catch(console.error)
