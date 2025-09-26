/**
 * Test script for integrated options sentiment analysis
 */

const { SentimentAnalysisService } = require('./app/services/financial-data/SentimentAnalysisService.ts')
const { OptionsAnalysisService } = require('./app/services/financial-data/OptionsAnalysisService.ts')
const { RedisCache } = require('./app/services/cache/RedisCache.ts')

async function testOptionsSentimentIntegration() {
  console.log('🧪 Testing Options Sentiment Integration...\n')

  try {
    // Initialize services
    const cache = new RedisCache()
    const optionsService = new OptionsAnalysisService(cache)
    const sentimentService = new SentimentAnalysisService(cache, undefined, optionsService)

    // Test with a popular stock
    const testSymbol = 'AAPL'
    console.log(`📊 Testing options sentiment for ${testSymbol}...`)

    // Get sentiment indicators with options integration
    const indicators = await sentimentService.getSentimentIndicators(testSymbol)

    if (indicators) {
      console.log('\n✅ Sentiment Indicators Retrieved:')
      console.log(`- Aggregated Score: ${(indicators.aggregatedScore * 100).toFixed(1)}%`)
      console.log(`- Confidence: ${(indicators.confidence * 100).toFixed(1)}%`)

      if (indicators.news) {
        console.log(`- News Sentiment: ${(indicators.news.sentiment * 100).toFixed(1)}% (${indicators.news.articleCount} articles)`)
      }

      if (indicators.reddit) {
        console.log(`- Reddit Sentiment: ${(indicators.reddit.sentiment * 100).toFixed(1)}% (${indicators.reddit.postCount} posts)`)
      }

      if (indicators.options) {
        console.log(`- Options Sentiment: ${(indicators.options.sentiment * 100).toFixed(1)}%`)
        console.log(`  - P/C Ratio: ${indicators.options.putCallRatio.toFixed(2)} (${indicators.options.sentimentSignal})`)
        console.log(`  - Signal Strength: ${indicators.options.signalStrength}`)
        console.log(`  - Institutional Flow: ${indicators.options.institutionalFlow}`)
        console.log(`  - Unusual Activity: ${indicators.options.unusualActivity ? 'YES' : 'NO'}`)
        console.log(`  - Total Volume: ${indicators.options.volumeAnalysis.totalVolume.toLocaleString()}`)

        if (indicators.options.insights.length > 0) {
          console.log('  - Key Insights:')
          indicators.options.insights.forEach(insight => {
            console.log(`    • ${insight}`)
          })
        }
      }

      // Test stock sentiment impact calculation
      console.log('\n📈 Testing Stock Sentiment Impact...')
      const baseScore = 0.75 // Sample base score
      const sentimentImpact = await sentimentService.analyzeStockSentimentImpact(testSymbol, 'Technology', baseScore)

      if (sentimentImpact) {
        console.log(`- Base Score: ${(baseScore * 100).toFixed(1)}%`)
        console.log(`- Adjusted Score: ${(sentimentImpact.adjustedScore * 100).toFixed(1)}%`)
        console.log(`- Sentiment Weight: ${(sentimentImpact.sentimentWeight * 100).toFixed(1)}%`)
        console.log(`- Overall Sentiment: ${(sentimentImpact.sentimentScore.overall * 100).toFixed(1)}%`)

        if (sentimentImpact.sentimentScore.components.options) {
          console.log(`- Options Component: ${(sentimentImpact.sentimentScore.components.options * 100).toFixed(1)}%`)
        }

        console.log('- Key Insights:')
        sentimentImpact.insights.forEach(insight => {
          console.log(`  • ${insight}`)
        })
      }

    } else {
      console.log('❌ No sentiment indicators retrieved')
    }

    // Test health check
    console.log('\n🔍 Testing Health Check...')
    const health = await sentimentService.healthCheck()
    console.log(`- Status: ${health.status.toUpperCase()}`)
    console.log(`- Yahoo Finance Sentiment: ${health.details.yahooFinanceSentiment ? '✅' : '❌'}`)
    console.log(`- Cache: ${health.details.cache ? '✅' : '❌'}`)
    console.log(`- Options Analysis: ${health.details.optionsAnalysis ? '✅' : '❌'}`)

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testOptionsSentimentIntegration()
  .then(() => {
    console.log('\n🎉 Options sentiment integration test completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Test failed with error:', error)
    process.exit(1)
  })