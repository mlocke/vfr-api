/**
 * Test different threshold values to find optimal label balance
 */

import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI.js';

async function testLabelThresholds() {
  const fmp = new FinancialModelingPrepAPI();
  // More diverse set: tech, finance, industrial, healthcare, consumer
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'JPM', 'BAC', 'GE', 'CAT', 'JNJ', 'PFE', 'WMT'];

  let validEarnings: Array<{actual: number, estimated: number}> = [];

  console.log('🔍 Testing Label Thresholds');
  console.log('='.repeat(80));

  for (const symbol of symbols) {
    const earnings = await fmp.getEarningsSurprises(symbol, 20);

    for (const e of earnings) {
      const earningsDate = new Date(e.date);
      const actual = e.actualEarningResult;
      const estimated = e.estimatedEarning;

      // Filter out future/invalid earnings
      if (actual === 0 || estimated === 0 || earningsDate > new Date()) {
        continue;
      }

      validEarnings.push({actual, estimated});
    }
  }

  console.log(`\n✅ Collected ${validEarnings.length} valid earnings from ${symbols.length} stocks\n`);

  // Test different thresholds
  const thresholds = [3, 4, 5, 6, 7, 8, 10];

  console.log('Threshold | Positive % | Negative % | Status');
  console.log('-'.repeat(60));

  for (const threshold of thresholds) {
    let positive = 0;
    let negative = 0;

    for (const e of validEarnings) {
      const surprisePercent = ((e.actual - e.estimated) / Math.abs(e.estimated)) * 100;
      if (surprisePercent > threshold) {
        positive++;
      } else {
        negative++;
      }
    }

    const posPercent = (positive / validEarnings.length) * 100;
    const negPercent = (negative / validEarnings.length) * 100;
    const status = posPercent >= 20 && posPercent <= 40 ? '✓ OPTIMAL' :
                   posPercent >= 10 && posPercent <= 50 ? '✓ Good' : '⚠️';

    console.log(`${threshold}%       | ${posPercent.toFixed(1)}%      | ${negPercent.toFixed(1)}%      | ${status}`);
  }

  console.log('\n💡 Recommendation:');
  console.log('   For 20-40% positive labels (optimal balance), use threshold of 6-8%');
  console.log('   Current: 5% (giving ~40-50% positive for diverse stocks)');
}

testLabelThresholds().catch(console.error);
