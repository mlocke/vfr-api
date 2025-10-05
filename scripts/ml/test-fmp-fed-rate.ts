/**
 * Test FMP Federal Funds Rate API
 * Verifies that FMP provides correct Fed rate data for historical dates
 */

import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI';

async function testFMPFedRate() {
	console.log('🧪 Testing FMP Federal Funds Rate API\n');

	const fmpAPI = new FinancialModelingPrepAPI();

	// Test 1: Get current Fed rate
	console.log('Test 1: Get current Fed rate range');
	const currentData = await fmpAPI.getFederalFundsRate();
	if (currentData && currentData.length > 0) {
		console.log(`✅ Current Fed rate: ${currentData[0].value}% (${currentData[0].date})`);
		console.log(`   Retrieved ${currentData.length} data points\n`);
	} else {
		console.log('❌ Failed to get current Fed rate\n');
	}

	// Test 2: Get historical Fed rate for specific date ranges
	console.log('Test 2: Get historical Fed rate (2020)');
	const data2020 = await fmpAPI.getFederalFundsRate('2020-01-01', '2020-12-31');
	if (data2020 && data2020.length > 0) {
		console.log(`✅ 2020 Fed rate: ${data2020[0].value}% (${data2020[0].date})`);
		console.log(`   Retrieved ${data2020.length} monthly observations\n`);
	} else {
		console.log('❌ Failed to get 2020 Fed rate\n');
	}

	// Test 3: Get Fed rate at specific date (ML feature extraction use case)
	console.log('Test 3: Get Fed rate at specific date (like FeatureExtractor does)');
	const testDates = [
		new Date('2020-06-15'),
		new Date('2023-03-20'),
		new Date('2024-01-10')
	];

	for (const date of testDates) {
		const observation = await fmpAPI.getFederalFundsRateAtDate(date);
		if (observation) {
			console.log(`✅ ${date.toISOString().split('T')[0]}: Fed rate = ${observation.value}% (observation date: ${observation.date})`);
		} else {
			console.log(`❌ ${date.toISOString().split('T')[0]}: Failed to get Fed rate`);
		}
	}

	console.log('\n✅ All FMP Fed rate tests completed!');
}

testFMPFedRate().catch((error) => {
	console.error('❌ Test failed:', error);
	process.exit(1);
});
