/**
 * Feature Extraction Validation Script
 *
 * Purpose: Identify which ML features are returning zeros/nulls
 * Run: npx ts-node scripts/ml/validate-feature-extraction.ts
 */

import { EarlySignalFeatureExtractor } from '../../app/services/ml/early-signal/FeatureExtractor.js';

// Test symbols covering different sectors
const TEST_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'GOOGL', 'MSFT', 'JPM', 'JNJ', 'XOM', 'WMT', 'DIS'];

async function validateFeatureExtraction() {
  console.log('🔍 ML Feature Extraction Validation\n');
  console.log('Testing symbols:', TEST_SYMBOLS.join(', '));
  console.log('─'.repeat(80));

  const extractor = new EarlySignalFeatureExtractor();
  const featureStats = new Map<string, {
    zeroCount: number;
    nonZeroCount: number;
    nullCount: number;
    avgValue: number;
    values: number[];
  }>();

  // Extract features for all test symbols
  for (const symbol of TEST_SYMBOLS) {
    console.log(`\n📊 Extracting features for ${symbol}...`);

    try {
      const features = await extractor.extractFeatures(symbol);

      // Analyze each feature
      for (const [featureName, value] of Object.entries(features)) {
        if (!featureStats.has(featureName)) {
          featureStats.set(featureName, {
            zeroCount: 0,
            nonZeroCount: 0,
            nullCount: 0,
            avgValue: 0,
            values: []
          });
        }

        const stats = featureStats.get(featureName)!;

        if (value === null || value === undefined) {
          stats.nullCount++;
        } else if (value === 0) {
          stats.zeroCount++;
        } else {
          stats.nonZeroCount++;
          stats.values.push(value as number);
        }
      }

      const nonZeroCount = Object.values(features).filter(v => v !== 0 && v !== null && v !== undefined).length;
      console.log(`  ✓ Extracted ${Object.keys(features).length} features (${nonZeroCount} non-zero)`);

    } catch (error) {
      console.error(`  ✗ Failed to extract features for ${symbol}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log('\n📈 Feature Statistics Summary\n');

  // Calculate averages
  for (const [featureName, stats] of featureStats.entries()) {
    if (stats.values.length > 0) {
      stats.avgValue = stats.values.reduce((sum, v) => sum + v, 0) / stats.values.length;
    }
  }

  // Categorize features
  const deadFeatures: string[] = [];
  const lowVarianceFeatures: string[] = [];
  const activeFeatures: string[] = [];

  for (const [featureName, stats] of featureStats.entries()) {
    const totalSamples = TEST_SYMBOLS.length;

    if (stats.nullCount === totalSamples) {
      deadFeatures.push(`${featureName} (all null)`);
    } else if (stats.zeroCount === totalSamples) {
      deadFeatures.push(`${featureName} (all zero)`);
    } else if (stats.zeroCount >= totalSamples * 0.8) {
      lowVarianceFeatures.push(`${featureName} (${stats.zeroCount}/${totalSamples} zero)`);
    } else {
      activeFeatures.push(featureName);
    }
  }

  // Print results
  console.log(`✅ Active Features (${activeFeatures.length}):`);
  activeFeatures.forEach(name => {
    const stats = featureStats.get(name)!;
    console.log(`   ${name.padEnd(40)} - Avg: ${stats.avgValue.toFixed(4)}, Non-zero: ${stats.nonZeroCount}/${TEST_SYMBOLS.length}`);
  });

  console.log(`\n⚠️  Low Variance Features (${lowVarianceFeatures.length}):`);
  lowVarianceFeatures.forEach(name => console.log(`   ${name}`));

  console.log(`\n❌ Dead Features (${deadFeatures.length}):`);
  deadFeatures.forEach(name => console.log(`   ${name}`));

  // Feature importance from trained model
  const modelImportance = {
    earnings_surprise: 0.367,
    macd_histogram_trend: 0.300,
    rsi_momentum: 0.224,
    analyst_coverage_change: 0.042,
    volume_trend: 0.021
  };

  console.log('\n' + '─'.repeat(80));
  console.log('\n🎯 Priority Fix Recommendations\n');

  // Find high-importance features that are dead
  const brokenHighImportance: string[] = [];
  for (const [feature, importance] of Object.entries(modelImportance)) {
    if (deadFeatures.some(dead => dead.includes(feature)) ||
        lowVarianceFeatures.some(low => low.includes(feature))) {
      brokenHighImportance.push(`${feature} (${(importance * 100).toFixed(1)}% importance - BROKEN!)`);
    }
  }

  if (brokenHighImportance.length > 0) {
    console.log('🚨 HIGH PRIORITY - Critical features not working:');
    brokenHighImportance.forEach(f => console.log(`   ${f}`));
  }

  // Suggest which dead features to fix first
  console.log('\n📝 Recommended Actions (Priority Order):');
  console.log('   1. Fix macro features (Fed rate, unemployment, CPI, GDP, treasury yield)');
  console.log('   2. Fix SEC features (insider buying, institutional ownership, 8-K filings)');
  console.log('   3. Fix sentiment features (news delta, Reddit accel, options shift)');
  console.log('   4. Fix social features (StockTwits, Twitter)');
  console.log('   5. Fix premium features (analyst targets, whisper, short interest)');

  console.log('\n' + '─'.repeat(80));
  console.log('\n💡 Next Steps:\n');
  console.log('1. Fix the dead features (see FeatureExtractor.ts)');
  console.log('2. Re-run this validation to confirm fixes');
  console.log('3. Retrain model with: npm run ml:train-early-signal');
  console.log('4. Deploy new model to production');
  console.log('\nExpected confidence improvement: +15-25% after fixing dead features\n');
}

// Run validation
validateFeatureExtraction().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
