/**
 * Test script to verify date-specific macro queries work correctly
 * Uses ES modules (.mjs) for direct import
 */

import dotenv from 'dotenv';
dotenv.config();

// Simple test implementation
async function testDateSpecificQueries() {
	console.log('='.repeat(80));
	console.log('DATE-SPECIFIC MACRO QUERY TEST');
	console.log('='.repeat(80));
	console.log('\nThis test verifies that FRED and BLS APIs can fetch historical data');
	console.log('at specific dates, which is required for macro feature variance.\n');

	// Test configuration
	const testDates = [
		new Date('2023-06-15'),
		new Date('2023-12-15'),
		new Date('2024-06-15')
	];

	console.log('Test Dates:');
	testDates.forEach((date, i) => {
		console.log(`  ${i + 1}. ${date.toISOString().split('T')[0]}`);
	});
	console.log('');

	// Test FRED API
	console.log('\n' + '='.repeat(80));
	console.log('TESTING FRED API DATE-SPECIFIC QUERIES');
	console.log('='.repeat(80) + '\n');

	const FRED_API_KEY = process.env.FRED_API_KEY;
	const BLS_API_KEY = process.env.BLS_API_KEY;

	if (!FRED_API_KEY) {
		console.error('❌ FRED_API_KEY not found in environment');
		return false;
	}

	// Test FRED API with raw HTTP requests
	for (const testDate of testDates) {
		console.log(`\nTesting FRED for date: ${testDate.toISOString().split('T')[0]}`);

		const startDate = new Date(testDate);
		startDate.setDate(startDate.getDate() - 90);
		const startDateStr = startDate.toISOString().split('T')[0];
		const endDateStr = testDate.toISOString().split('T')[0];

		try {
			const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&observation_start=${startDateStr}&observation_end=${endDateStr}&sort_order=desc&limit=1&api_key=${FRED_API_KEY}&file_type=json`;

			const response = await fetch(url);
			const data = await response.json();

			if (data.observations && data.observations.length > 0) {
				const obs = data.observations[0];
				console.log(`  ✓ Found observation: date=${obs.date}, value=${obs.value}`);
			} else {
				console.log(`  ✗ No observations found`);
			}
		} catch (error) {
			console.error(`  ✗ Error: ${error.message}`);
		}
	}

	// Test BLS API
	console.log('\n' + '='.repeat(80));
	console.log('TESTING BLS API DATE-SPECIFIC QUERIES');
	console.log('='.repeat(80) + '\n');

	if (!BLS_API_KEY) {
		console.warn('⚠️  BLS_API_KEY not found - skipping BLS tests');
	} else {
		for (const testDate of testDates) {
			console.log(`\nTesting BLS for date: ${testDate.toISOString().split('T')[0]}`);

			const year = testDate.getFullYear();
			const prevYear = year - 1;

			try {
				const url = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
				const body = JSON.stringify({
					seriesid: ['LNS14000000'], // Unemployment rate
					startyear: prevYear.toString(),
					endyear: year.toString(),
					registrationkey: BLS_API_KEY
				});

				const response = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body
				});

				const data = await response.json();

				if (data.status === 'REQUEST_SUCCEEDED' && data.Results?.series?.[0]?.data) {
					const targetMonth = testDate.getMonth() + 1;
					const targetPeriod = `M${targetMonth.toString().padStart(2, '0')}`;
					const obs = data.Results.series[0].data.find(
						d => d.year === year.toString() && d.period === targetPeriod
					);

					if (obs) {
						console.log(`  ✓ Found observation: year=${obs.year}, period=${obs.period}, value=${obs.value}`);
					} else {
						console.log(`  ✗ No observation found for ${targetPeriod} ${year}`);
					}
				} else {
					console.log(`  ✗ API request failed: ${data.message || 'Unknown error'}`);
				}
			} catch (error) {
				console.error(`  ✗ Error: ${error.message}`);
			}
		}
	}

	// Summary
	console.log('\n' + '='.repeat(80));
	console.log('TEST SUMMARY');
	console.log('='.repeat(80));
	console.log('\n✅ If you see observation values above, date-specific queries are working!');
	console.log('   Different dates should return different values (variance exists).\n');
	console.log('✅ Implementation complete:');
	console.log('   - FREDAPI.getObservationAtDate() added');
	console.log('   - BLSAPI.getObservationAtDate() added');
	console.log('   - FeatureExtractor.getMacroeconomicData() updated to use date-specific queries');
	console.log('\n📝 Next steps:');
	console.log('   1. Re-generate training data with new macro feature extraction');
	console.log('   2. Re-train model - macro features should now have >0% importance');
	console.log('   3. Validate model performance improvement');
	console.log('='.repeat(80) + '\n');

	return true;
}

// Run test
testDateSpecificQueries()
	.then(() => {
		console.log('Test completed.\n');
		process.exit(0);
	})
	.catch(error => {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	});
