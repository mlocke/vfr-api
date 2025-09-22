#!/usr/bin/env node

/**
 * RedditAPIEnhanced Performance Test
 * Demonstrates optimizations for 5-subreddit analysis
 */

const { RedditAPIEnhanced } = require('./app/services/financial-data/providers/RedditAPIEnhanced.ts');

// Full 5-subreddit configuration for performance testing
const fullConfig = {
  subreddits: [
    { name: 'wallstreetbets', weight: 0.25, analysisQuality: 'medium', postLimit: 20, enabled: true },
    { name: 'investing', weight: 0.30, analysisQuality: 'high', postLimit: 15, enabled: true },
    { name: 'SecurityAnalysis', weight: 0.25, analysisQuality: 'high', postLimit: 10, enabled: true },
    { name: 'ValueInvesting', weight: 0.15, analysisQuality: 'high', postLimit: 10, enabled: true },
    { name: 'stocks', weight: 0.05, analysisQuality: 'medium', postLimit: 15, enabled: true }
  ],
  parallelProcessing: {
    maxConcurrency: 5, // All subreddits in parallel
    timeoutPerRequest: 12000, // Optimized timeout
    retryAttempts: 1 // Fast failure
  },
  rateLimiting: {
    requestsPerMinute: 55, // Near Reddit's limit
    burstLimit: 15, // Higher burst for parallel
    cooldownPeriod: 1000 // Reduced cooldown
  }
};

async function performanceTest() {
  console.log('🚀 RedditAPIEnhanced Performance Test - Optimized Configuration');
  console.log('📊 Testing 5-subreddit parallel processing...\n');

  const reddit = new RedditAPIEnhanced(
    process.env.REDDIT_CLIENT_ID,
    process.env.REDDIT_CLIENT_SECRET,
    'VFR-Performance-Test/1.0',
    12000,
    false,
    fullConfig
  );

  const testSymbols = ['AAPL', 'TSLA', 'NVDA'];

  for (const symbol of testSymbols) {
    console.log(`\n🔍 Testing ${symbol}...`);
    const startTime = Date.now();

    try {
      const result = await reddit.getEnhancedSentiment(symbol);
      const responseTime = Date.now() - startTime;

      if (result.success && result.data) {
        const data = result.data;
        console.log(`✅ ${symbol} Analysis Complete:`);
        console.log(`   ⏱️  Response Time: ${responseTime}ms`);
        console.log(`   📈 Weighted Sentiment: ${data.weightedSentiment.toFixed(3)}`);
        console.log(`   🎯 Confidence: ${data.confidence.toFixed(3)}`);
        console.log(`   📊 Total Posts: ${data.postCount}`);
        console.log(`   🔀 Diversity Score: ${data.diversityScore.toFixed(3)}`);
        console.log(`   🌐 Subreddits: ${data.subredditBreakdown.length}`);

        // Performance assessment
        if (responseTime < 2500) {
          console.log(`   🟢 Performance: EXCELLENT (Target: <2.5s)`);
        } else if (responseTime < 5000) {
          console.log(`   🟡 Performance: GOOD (Target: <2.5s)`);
        } else {
          console.log(`   🔴 Performance: NEEDS IMPROVEMENT`);
        }

        // Show subreddit breakdown
        data.subredditBreakdown.forEach(sub => {
          const contribution = ((sub.contributionScore / data.weightedSentiment) * 100);
          console.log(`   • r/${sub.subreddit}: ${sub.sentiment.toFixed(3)} (${sub.postCount} posts, ${contribution.toFixed(1)}% contribution)`);
        });
      } else {
        console.log(`❌ ${symbol} Analysis Failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`💥 ${symbol} Test Error:`, error.message);
    }

    // Rate limiting between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n📊 Performance Test Summary:');
  console.log('✅ Optimizations Applied:');
  console.log('   • Token bucket rate limiting (55 req/min)');
  console.log('   • Parallel processing (5 concurrent subreddits)');
  console.log('   • Single-pass data aggregation');
  console.log('   • Cached weight validation');
  console.log('   • Optimized sentiment calculation');
  console.log('   • Request caching (5-minute TTL)');
  console.log('   • Reduced timeouts and fast failure');
}

if (require.main === module) {
  performanceTest().catch(console.error);
}

module.exports = { performanceTest };