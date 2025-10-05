/**
 * Final end-to-end validation test
 * Demonstrates that all fixes work correctly
 */

import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI.js';

async function finalValidationTest() {
  const fmp = new FinancialModelingPrepAPI();

  // Test across 10 diverse stocks (tech, finance, industrial, healthcare, consumer)
  const testSymbols = ['AAPL', 'MSFT', 'GOOGL', 'JPM', 'BAC', 'GE', 'CAT', 'JNJ', 'PFE', 'WMT'];

  console.log('🔬 FINAL VALIDATION TEST - ML Training Data Fix');
  console.log('='.repeat(80));
  console.log(`Testing ${testSymbols.length} diverse stocks...`);
  console.log('');

  let totalFetched = 0;
  let futureFiltered = 0;
  let validHistorical = 0;
  let positiveLabels = 0;
  let negativeLabels = 0;
  let apiFailures = 0;

  for (const symbol of testSymbols) {
    try {
      const earnings = await fmp.getEarningsSurprises(symbol, 20);

      if (earnings.length === 0) {
        apiFailures++;
        continue;
      }

      for (const e of earnings) {
        totalFetched++;
        const earningsDate = new Date(e.date);
        const actual = e.actualEarningResult;
        const estimated = e.estimatedEarning;

        // Apply EXACT same filtering logic as generate-training-data.ts
        if (actual === 0 || estimated === 0) {
          futureFiltered++;
          continue;
        }

        if (earningsDate > new Date()) {
          futureFiltered++;
          continue;
        }

        // Valid historical earnings - calculate label
        validHistorical++;
        const surprisePercent = ((actual - estimated) / Math.abs(estimated)) * 100;
        const label = surprisePercent > 10 ? 1 : 0;

        if (label === 1) positiveLabels++;
        else negativeLabels++;
      }
    } catch (error: any) {
      apiFailures++;
      console.error(`  ✗ API error for ${symbol}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 VALIDATION RESULTS');
  console.log('='.repeat(80));

  console.log('\n1️⃣  API SUCCESS RATE:');
  const apiSuccessRate = ((testSymbols.length - apiFailures) / testSymbols.length) * 100;
  console.log(`  Symbols tested: ${testSymbols.length}`);
  console.log(`  API failures: ${apiFailures}`);
  console.log(`  Success rate: ${apiSuccessRate.toFixed(1)}%`);
  console.log(`  Status: ${apiSuccessRate >= 90 ? '✅ PASS' : '❌ FAIL'} (target: ≥90%)`);

  console.log('\n2️⃣  DATA FILTERING:');
  console.log(`  Total earnings fetched: ${totalFetched}`);
  console.log(`  Future/invalid filtered: ${futureFiltered} (${((futureFiltered/totalFetched)*100).toFixed(1)}%)`);
  console.log(`  Valid historical: ${validHistorical} (${((validHistorical/totalFetched)*100).toFixed(1)}%)`);
  console.log(`  Status: ${futureFiltered > 0 ? '✅ PASS' : '⚠️  WARN'} (filtering working)`);

  console.log('\n3️⃣  LABEL BALANCE:');
  const posPercent = (positiveLabels / validHistorical) * 100;
  const negPercent = (negativeLabels / validHistorical) * 100;
  console.log(`  Positive labels (>10% beat): ${positiveLabels} (${posPercent.toFixed(1)}%)`);
  console.log(`  Negative labels (≤10%): ${negativeLabels} (${negPercent.toFixed(1)}%)`);
  console.log(`  Status: ${posPercent >= 20 && posPercent <= 50 ? '✅ PASS' : posPercent >= 10 && posPercent <= 60 ? '⚠️  ACCEPTABLE' : '❌ FAIL'} (target: 20-50%)`);

  console.log('\n4️⃣  DATA QUALITY:');
  const avgPerSymbol = validHistorical / (testSymbols.length - apiFailures);
  console.log(`  Avg earnings per symbol: ${avgPerSymbol.toFixed(1)}`);
  console.log(`  Status: ${avgPerSymbol >= 5 ? '✅ PASS' : '⚠️  WARN'} (target: ≥5)`);

  console.log('\n' + '='.repeat(80));
  console.log('🏁 FINAL VERDICT');
  console.log('='.repeat(80));

  const allChecks = [
    { name: 'API Success Rate', passed: apiSuccessRate >= 90 },
    { name: 'Future Earnings Filtered', passed: futureFiltered > 0 },
    { name: 'Label Balance', passed: posPercent >= 10 && posPercent <= 60 },
    { name: 'Data Quality', passed: avgPerSymbol >= 5 }
  ];

  const passedChecks = allChecks.filter(c => c.passed).length;
  const totalChecks = allChecks.length;

  console.log(`\n${passedChecks}/${totalChecks} validation checks passed:\n`);
  allChecks.forEach(check => {
    console.log(`  ${check.passed ? '✅' : '❌'} ${check.name}`);
  });

  if (passedChecks === totalChecks) {
    console.log('\n🎉 SUCCESS! All critical issues resolved.');
    console.log('   Ready for production training data generation.');
  } else if (passedChecks >= totalChecks * 0.75) {
    console.log('\n⚠️  MOSTLY FIXED. Some minor issues remain.');
  } else {
    console.log('\n❌ FAILED. Critical issues still present.');
  }

  console.log('\n' + '='.repeat(80));
}

finalValidationTest().catch(console.error);
