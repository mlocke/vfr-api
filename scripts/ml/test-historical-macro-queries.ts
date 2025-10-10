/**
 * Test Historical Macro Query Implementation
 *
 * Purpose: Verify that the new getObservationAtDate() methods return
 * different values for different dates, confirming variance exists.
 */

import 'dotenv/config';
import { EarlySignalFeatureExtractor } from '../../app/services/ml/early-signal/FeatureExtractor.js';

async function testHistoricalQueries() {
  console.log('========================================');
  console.log('Testing Historical Macro Queries');
  console.log('========================================\n');

  const featureExtractor = new EarlySignalFeatureExtractor();

  // Test with 3 different dates across 2023-2024
  const testDates = [
    new Date('2023-01-15'),
    new Date('2023-07-15'),
    new Date('2024-01-15')
  ];

  console.log('Fetching macro data for 3 different dates...\n');

  const results: any[] = [];

  for (const date of testDates) {
    try {
      // Access private method using type assertion
      const macroData = await (featureExtractor as any).getMacroeconomicData(date);

      results.push({
        date: date.toISOString().split('T')[0],
        ...macroData
      });

      console.log(`✓ ${date.toISOString().split('T')[0]}`);
      console.log(`  Fed Rate Change (30d): ${macroData.fedRateChange30d?.toFixed(4) || 'N/A'}`);
      console.log(`  Unemployment Change:   ${macroData.unemploymentRateChange?.toFixed(4) || 'N/A'}`);
      console.log(`  CPI Inflation Rate:    ${macroData.cpiInflationRate?.toFixed(4) || 'N/A'}`);
      console.log(`  GDP Growth Rate:       ${macroData.gdpGrowthRate?.toFixed(4) || 'N/A'}`);
      console.log(`  Treasury Yield 10Y:    ${macroData.treasuryYield10y?.toFixed(4) || 'N/A'}`);
      console.log('');
    } catch (error) {
      console.error(`✗ Error fetching data for ${date.toISOString().split('T')[0]}:`, error);
    }
  }

  // Calculate variance for each feature
  console.log('========================================');
  console.log('Variance Analysis');
  console.log('========================================\n');

  const features = [
    'fedRateChange30d',
    'unemploymentRateChange',
    'cpiInflationRate',
    'gdpGrowthRate',
    'treasuryYield10y'
  ];

  for (const feature of features) {
    const values = results.map(r => r[feature]).filter(v => v !== null && v !== undefined);

    if (values.length > 1) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);

      console.log(`${feature}:`);
      console.log(`  Min: ${minVal.toFixed(4)}`);
      console.log(`  Max: ${maxVal.toFixed(4)}`);
      console.log(`  Mean: ${mean.toFixed(4)}`);
      console.log(`  Std Dev: ${stdDev.toFixed(4)}`);
      console.log(`  Variance: ${variance > 0.0001 ? '✓ GOOD' : '✗ ZERO'}`);
      console.log('');
    } else {
      console.log(`${feature}: ✗ Insufficient data\n`);
    }
  }

  console.log('========================================');
  console.log('Conclusion');
  console.log('========================================');

  const hasVariance = features.every(feature => {
    const values = results.map(r => r[feature]).filter(v => v !== null && v !== undefined);
    if (values.length < 2) return false;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance > 0.0001;
  });

  if (hasVariance) {
    console.log('✓ SUCCESS: Historical queries return different values');
    console.log('✓ Macro features will have non-zero variance in training data');
    console.log('\nNext step: Run update-macro-features.ts to regenerate dataset');
  } else {
    console.log('✗ FAILURE: No variance detected - historical queries may not be working');
    console.log('✗ Need to debug the API implementation');
  }
  console.log('========================================\n');
}

testHistoricalQueries()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
