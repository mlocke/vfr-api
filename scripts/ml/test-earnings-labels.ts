/**
 * Test earnings data and label generation logic
 * Debug why all labels are 0
 */

import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI.js';

async function testEarningsLabels() {
  const fmp = new FinancialModelingPrepAPI();

  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];

  for (const symbol of symbols) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing ${symbol}`);
    console.log('='.repeat(80));

    const earnings = await fmp.getEarningsSurprises(symbol, 20);

    if (earnings.length === 0) {
      console.log(`❌ No earnings data for ${symbol}`);
      continue;
    }

    console.log(`✅ Got ${earnings.length} earnings records`);
    console.log(`\nSample earnings data (first 3):`);
    console.log(JSON.stringify(earnings.slice(0, 3), null, 2));

    console.log(`\n📊 Label calculation for first 10 earnings:`);
    let positiveCount = 0;
    let negativeCount = 0;
    let zeroCount = 0;

    earnings.slice(0, 10).forEach((e, i) => {
      const estimated = e.estimatedEarning;
      const actual = e.actualEarningResult;

      let label = 0;
      let surprisePercent = 0;

      if (estimated !== 0 && actual !== 0) {
        surprisePercent = ((actual - estimated) / Math.abs(estimated)) * 100;
        label = surprisePercent > 5 ? 1 : 0;
      }

      if (label === 1) positiveCount++;
      else if (label === 0 && (estimated === 0 || actual === 0)) zeroCount++;
      else negativeCount++;

      console.log(
        `  ${i + 1}. ${e.date} | ` +
        `Actual: ${actual?.toFixed(2) || 'N/A'} | ` +
        `Estimate: ${estimated?.toFixed(2) || 'N/A'} | ` +
        `Surprise: ${surprisePercent.toFixed(2)}% | ` +
        `Label: ${label}`
      );
    });

    console.log(`\n📈 Summary for ${symbol}:`);
    console.log(`  Positive labels (>5% beat): ${positiveCount}`);
    console.log(`  Negative/neutral labels: ${negativeCount}`);
    console.log(`  Zero earnings data: ${zeroCount}`);
    console.log(`  Positive %: ${((positiveCount / 10) * 100).toFixed(1)}%`);
  }
}

testEarningsLabels().catch(console.error);
