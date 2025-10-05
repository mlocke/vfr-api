/**
 * Test Fed Rate extraction for specific dates
 */
import 'dotenv/config';
import { EarlySignalFeatureExtractor } from '../../app/services/ml/early-signal/FeatureExtractor.js';

async function testFedRate() {
  const extractor = new EarlySignalFeatureExtractor();

  // Test specific dates that showed 0
  const testDates = [
    new Date('2022-01-27'),
    new Date('2022-02-02'),
    new Date('2022-04-28'),
    new Date('2022-07-28')
  ];

  console.log('Testing Fed Rate extraction for specific dates:\n');

  for (const date of testDates) {
    const macroData = await (extractor as any).getMacroeconomicData(date);
    const dateStr = date.toISOString().split('T')[0];
    console.log(`${dateStr}:`);
    console.log(`  Fed Rate Change (30d): ${macroData.fedRateChange30d}`);
    console.log(`  Raw values should be logged above...`);
    console.log('');
  }
}

testFedRate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
