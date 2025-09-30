/**
 * Test script for stock analysis - captures VFR output for weight tuning
 */

async function testStockAnalysis(symbol) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🧪 TESTING: ${symbol}`)
  console.log(`${'='.repeat(80)}\n`)

  const startTime = Date.now()

  try {
    const response = await fetch(`http://localhost:3000/api/stocks/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'single',
        config: {
          symbol: symbol
        },
        limit: 1
      })
    })

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`)
      const text = await response.text()
      console.error('Response:', text)
      return null
    }

    const data = await response.json()
    const duration = Date.now() - startTime

    console.log(`\n📊 VFR ANALYSIS RESULTS FOR ${symbol}`)
    console.log(`${'='.repeat(80)}`)
    console.log(`⏱️  Analysis Duration: ${duration}ms`)
    console.log(`\n🎯 OVERALL SCORE: ${data.score?.overallScore?.toFixed(4) || 'N/A'}`)
    console.log(`📈 RECOMMENDATION: ${data.recommendation || 'N/A'}`)
    console.log(`💰 CONFIDENCE: ${data.confidence || 'N/A'}`)

    if (data.score) {
      console.log(`\n📊 COMPONENT SCORES:`)
      console.log(`   Technical: ${data.score.technicalScore?.toFixed(4) || 'N/A'}`)
      console.log(`   Fundamental: ${data.score.fundamentalScore?.toFixed(4) || 'N/A'}`)
      console.log(`   Sentiment: ${data.score.sentimentScore?.toFixed(4) || 'N/A'}`)
      console.log(`   Momentum: ${data.score.momentumScore?.toFixed(4) || 'N/A'}`)
      console.log(`   Value: ${data.score.valueScore?.toFixed(4) || 'N/A'}`)
      console.log(`   Quality: ${data.score.qualityScore?.toFixed(4) || 'N/A'}`)
    }

    if (data.score?.factorScores) {
      console.log(`\n🔍 FACTOR SCORES (sample):`)
      const factors = Object.entries(data.score.factorScores).slice(0, 10)
      factors.forEach(([factor, score]) => {
        console.log(`   ${factor}: ${typeof score === 'number' ? score.toFixed(4) : score}`)
      })
      if (Object.keys(data.score.factorScores).length > 10) {
        console.log(`   ... and ${Object.keys(data.score.factorScores).length - 10} more factors`)
      }
    }

    if (data.analystData) {
      console.log(`\n👔 ANALYST DATA:`)
      console.log(`   Consensus: ${data.analystData.consensus || 'N/A'}`)
      console.log(`   Sentiment Score: ${data.analystData.sentimentScore?.toFixed(2) || 'N/A'}`)
      console.log(`   Total Analysts: ${data.analystData.totalAnalysts || 'N/A'}`)
      if (data.analystData.distribution) {
        console.log(`   Distribution:`)
        console.log(`     Strong Buy: ${data.analystData.distribution.strongBuy || 0}`)
        console.log(`     Buy: ${data.analystData.distribution.buy || 0}`)
        console.log(`     Hold: ${data.analystData.distribution.hold || 0}`)
        console.log(`     Sell: ${data.analystData.distribution.sell || 0}`)
        console.log(`     Strong Sell: ${data.analystData.distribution.strongSell || 0}`)
      }
    }

    console.log(`\n${'='.repeat(80)}\n`)

    return data

  } catch (error) {
    console.error(`\n❌ ERROR testing ${symbol}:`, error.message)
    console.error(error.stack)
    return null
  }
}

// Test the stock from command line argument or default to NVDA
const symbol = process.argv[2] || 'NVDA'

testStockAnalysis(symbol)
  .then(data => {
    if (data) {
      console.log(`✅ Test completed for ${symbol}`)
      process.exit(0)
    } else {
      console.error(`❌ Test failed for ${symbol}`)
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
