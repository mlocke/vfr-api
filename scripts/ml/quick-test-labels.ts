/**
 * Quick test to validate label generation fix
 * Tests that we properly filter future earnings and generate correct labels
 */

import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI.js';

async function quickTestLabels() {
  const fmp = new FinancialModelingPrepAPI();
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];

  let totalEarnings = 0;
  let futureEarnings = 0;
  let validEarnings = 0;
  let positiveLabels = 0;
  let negativeLabels = 0;

  console.log('🔍 Quick Label Generation Test');
  console.log('='.repeat(80));

  for (const symbol of symbols) {
    const earnings = await fmp.getEarningsSurprises(symbol, 20);

    console.log(`\n${symbol}: ${earnings.length} earnings records`);

    for (const e of earnings) {
      totalEarnings++;
      const earningsDate = new Date(e.date);
      const actual = e.actualEarningResult;
      const estimated = e.estimatedEarning;

      // Apply filtering logic from generate-training-data.ts
      if (actual === 0 || estimated === 0) {
        futureEarnings++;
        continue; // Skip future earnings
      }

      if (earningsDate > new Date()) {
        futureEarnings++;
        continue; // Skip future dates
      }

      // This earnings passes filters - calculate label
      validEarnings++;
      const surprisePercent = ((actual - estimated) / Math.abs(estimated)) * 100;
      const label = surprisePercent > 10 ? 1 : 0; // Updated threshold to 10%

      if (label === 1) positiveLabels++;
      else negativeLabels++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 Results:');
  console.log(`  Total earnings fetched: ${totalEarnings}`);
  console.log(`  Future/invalid earnings filtered: ${futureEarnings} (${((futureEarnings/totalEarnings)*100).toFixed(1)}%)`);
  console.log(`  Valid historical earnings: ${validEarnings} (${((validEarnings/totalEarnings)*100).toFixed(1)}%)`);
  console.log(`  Positive labels (>5% beat): ${positiveLabels} (${((positiveLabels/validEarnings)*100).toFixed(1)}%)`);
  console.log(`  Negative labels (≤5% or miss): ${negativeLabels} (${((negativeLabels/validEarnings)*100).toFixed(1)}%)`);

  console.log('\n✅ Success Criteria:');
  console.log(`  ${validEarnings > 0 ? '✓' : '✗'} Has valid earnings data`);
  console.log(`  ${futureEarnings > 0 ? '✓' : '✗'} Correctly filters future earnings`);
  const posPercent = (positiveLabels/validEarnings)*100;
  console.log(`  ${posPercent >= 10 && posPercent <= 50 ? '✓' : '✗'} Label balance ${posPercent.toFixed(1)}% (target: 10-50%)`);
}

quickTestLabels().catch(console.error);
