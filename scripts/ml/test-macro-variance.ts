/**
 * Test script to verify macro feature variance across different dates
 * This script fetches macro data for 3 different dates and verifies that values are different
 *
 * Purpose: Fix macro feature variance issue where all historical training examples
 * were getting the same macro values (zero variance = 0% model importance)
 */

import { FREDAPI } from '../../app/services/financial-data/FREDAPI.js';
import { BLSAPI } from '../../app/services/financial-data/BLSAPI.js';

async function testMacroVariance() {
	console.log('='.repeat(80));
	console.log('MACRO FEATURE VARIANCE TEST');
	console.log('='.repeat(80));

	const fredAPI = new FREDAPI();
	const blsAPI = new BLSAPI();

	// Test dates spanning different economic conditions
	const testDates = [
		new Date('2023-03-15'), // March 2023 - during Fed rate hikes
		new Date('2023-09-15'), // September 2023 - peak inflation period
		new Date('2024-03-15'), // March 2024 - inflation cooling
	];

	console.log('\nTest Dates:');
	testDates.forEach((date, i) => {
		console.log(`  ${i + 1}. ${date.toISOString().split('T')[0]}`);
	});
	console.log('');

	const results: Array<{
		date: string;
		fedRateCurrent: number | null;
		fedRate30DaysAgo: number | null;
		fedRateChange: number;
		unemploymentCurrent: number | null;
		unemploymentPrevious: number | null;
		unemploymentChange: number;
		cpiCurrent: number | null;
		cpiYearAgo: number | null;
		cpiInflationRate: number;
		treasuryYield10y: number | null;
	}> = [];

	// Fetch macro data for each test date
	for (const testDate of testDates) {
		console.log(`\n${'='.repeat(80)}`);
		console.log(`Fetching macro data for: ${testDate.toISOString().split('T')[0]}`);
		console.log(`${'='.repeat(80)}\n`);

		// Calculate comparison dates
		const date30DaysAgo = new Date(testDate);
		date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

		const datePreviousMonth = new Date(testDate);
		datePreviousMonth.setMonth(datePreviousMonth.getMonth() - 1);

		const dateYearAgo = new Date(testDate);
		dateYearAgo.setFullYear(dateYearAgo.getFullYear() - 1);

		// Fetch all data in parallel
		const [
			fedRateCurrent,
			fedRate30DaysAgo,
			unemploymentCurrent,
			unemploymentPrevious,
			cpiCurrent,
			cpiYearAgo,
			treasuryYield10y
		] = await Promise.all([
			fredAPI.getObservationAtDate('FEDFUNDS', testDate),
			fredAPI.getObservationAtDate('FEDFUNDS', date30DaysAgo),
			blsAPI.getObservationAtDate('LNS14000000', testDate),
			blsAPI.getObservationAtDate('LNS14000000', datePreviousMonth),
			fredAPI.getObservationAtDate('CPIAUCSL', testDate),
			fredAPI.getObservationAtDate('CPIAUCSL', dateYearAgo),
			fredAPI.getObservationAtDate('DGS10', testDate)
		]);

		// Parse values
		const fedCurrentValue = fedRateCurrent?.value ? parseFloat(fedRateCurrent.value) : null;
		const fed30DaysAgoValue = fedRate30DaysAgo?.value ? parseFloat(fedRate30DaysAgo.value) : null;
		const fedRateChange = (fedCurrentValue !== null && fed30DaysAgoValue !== null)
			? fedCurrentValue - fed30DaysAgoValue
			: 0;

		const unemploymentCurrentValue = unemploymentCurrent?.value ? parseFloat(unemploymentCurrent.value) : null;
		const unemploymentPreviousValue = unemploymentPrevious?.value ? parseFloat(unemploymentPrevious.value) : null;
		const unemploymentChange = (unemploymentCurrentValue !== null && unemploymentPreviousValue !== null)
			? unemploymentCurrentValue - unemploymentPreviousValue
			: 0;

		const cpiCurrentValue = cpiCurrent?.value ? parseFloat(cpiCurrent.value) : null;
		const cpiYearAgoValue = cpiYearAgo?.value ? parseFloat(cpiYearAgo.value) : null;
		const cpiInflationRate = (cpiCurrentValue !== null && cpiYearAgoValue !== null && cpiYearAgoValue !== 0)
			? ((cpiCurrentValue - cpiYearAgoValue) / cpiYearAgoValue) * 100
			: 0;

		const treasuryYield10yValue = treasuryYield10y?.value ? parseFloat(treasuryYield10y.value) : null;

		// Store results
		results.push({
			date: testDate.toISOString().split('T')[0],
			fedRateCurrent: fedCurrentValue,
			fedRate30DaysAgo: fed30DaysAgoValue,
			fedRateChange,
			unemploymentCurrent: unemploymentCurrentValue,
			unemploymentPrevious: unemploymentPreviousValue,
			unemploymentChange,
			cpiCurrent: cpiCurrentValue,
			cpiYearAgo: cpiYearAgoValue,
			cpiInflationRate,
			treasuryYield10y: treasuryYield10yValue
		});

		// Print results for this date
		console.log(`\nFederal Funds Rate:`);
		console.log(`  Current (${testDate.toISOString().split('T')[0]}): ${fedCurrentValue?.toFixed(2) ?? 'N/A'}%`);
		console.log(`  30 Days Ago (${date30DaysAgo.toISOString().split('T')[0]}): ${fed30DaysAgoValue?.toFixed(2) ?? 'N/A'}%`);
		console.log(`  Change (30d): ${fedRateChange.toFixed(2)}%`);

		console.log(`\nUnemployment Rate:`);
		console.log(`  Current (${testDate.toISOString().split('T')[0]}): ${unemploymentCurrentValue?.toFixed(1) ?? 'N/A'}%`);
		console.log(`  Previous Month (${datePreviousMonth.toISOString().split('T')[0]}): ${unemploymentPreviousValue?.toFixed(1) ?? 'N/A'}%`);
		console.log(`  Change (MoM): ${unemploymentChange.toFixed(2)}%`);

		console.log(`\nCPI Inflation:`);
		console.log(`  Current CPI (${testDate.toISOString().split('T')[0]}): ${cpiCurrentValue?.toFixed(2) ?? 'N/A'}`);
		console.log(`  Year Ago CPI (${dateYearAgo.toISOString().split('T')[0]}): ${cpiYearAgoValue?.toFixed(2) ?? 'N/A'}`);
		console.log(`  YoY Inflation Rate: ${cpiInflationRate.toFixed(2)}%`);

		console.log(`\n10-Year Treasury Yield:`);
		console.log(`  Current (${testDate.toISOString().split('T')[0]}): ${treasuryYield10yValue?.toFixed(2) ?? 'N/A'}%`);
	}

	// Print summary comparison
	console.log('\n\n' + '='.repeat(80));
	console.log('VARIANCE ANALYSIS SUMMARY');
	console.log('='.repeat(80) + '\n');

	console.log('Date Comparisons:');
	console.log('-'.repeat(80));
	console.log('Feature                  | Date 1      | Date 2      | Date 3      | Variance');
	console.log('-'.repeat(80));

	// Fed Rate Change
	const fedRateChanges = results.map(r => r.fedRateChange);
	console.log(`Fed Rate Change (30d)    | ${fedRateChanges[0].toFixed(3).padStart(10)} | ${fedRateChanges[1].toFixed(3).padStart(10)} | ${fedRateChanges[2].toFixed(3).padStart(10)} | ${hasVariance(fedRateChanges) ? 'YES ✓' : 'NO ✗'}`);

	// Unemployment Change
	const unemploymentChanges = results.map(r => r.unemploymentChange);
	console.log(`Unemployment Change      | ${unemploymentChanges[0].toFixed(3).padStart(10)} | ${unemploymentChanges[1].toFixed(3).padStart(10)} | ${unemploymentChanges[2].toFixed(3).padStart(10)} | ${hasVariance(unemploymentChanges) ? 'YES ✓' : 'NO ✗'}`);

	// CPI Inflation Rate
	const cpiRates = results.map(r => r.cpiInflationRate);
	console.log(`CPI Inflation Rate (YoY) | ${cpiRates[0].toFixed(3).padStart(10)} | ${cpiRates[1].toFixed(3).padStart(10)} | ${cpiRates[2].toFixed(3).padStart(10)} | ${hasVariance(cpiRates) ? 'YES ✓' : 'NO ✗'}`);

	// Treasury Yield 10Y
	const treasuryYields = results.map(r => r.treasuryYield10y ?? 0);
	console.log(`Treasury Yield 10Y       | ${treasuryYields[0].toFixed(3).padStart(10)} | ${treasuryYields[1].toFixed(3).padStart(10)} | ${treasuryYields[2].toFixed(3).padStart(10)} | ${hasVariance(treasuryYields) ? 'YES ✓' : 'NO ✗'}`);
	console.log('-'.repeat(80));

	// Calculate and display variance statistics
	console.log('\nVariance Statistics:');
	console.log(`  Fed Rate Change: σ² = ${calculateVariance(fedRateChanges).toFixed(6)}`);
	console.log(`  Unemployment Change: σ² = ${calculateVariance(unemploymentChanges).toFixed(6)}`);
	console.log(`  CPI Inflation Rate: σ² = ${calculateVariance(cpiRates).toFixed(6)}`);
	console.log(`  Treasury Yield 10Y: σ² = ${calculateVariance(treasuryYields).toFixed(6)}`);

	// Final verdict
	console.log('\n' + '='.repeat(80));
	const allHaveVariance = hasVariance(fedRateChanges) &&
	                        hasVariance(unemploymentChanges) &&
	                        hasVariance(cpiRates) &&
	                        hasVariance(treasuryYields);

	if (allHaveVariance) {
		console.log('✅ SUCCESS: All macro features show variance across different dates!');
		console.log('   Model can now learn from macro features in training data.');
	} else {
		console.log('❌ FAILURE: Some macro features still have zero variance.');
		console.log('   These features will have 0% importance in the ML model.');
	}
	console.log('='.repeat(80) + '\n');
}

/**
 * Check if an array of values has variance (not all the same)
 */
function hasVariance(values: number[]): boolean {
	const variance = calculateVariance(values);
	return variance > 0.0001; // Allow for small floating point differences
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(values: number[]): number {
	if (values.length === 0) return 0;

	const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
	const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
	const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

	return variance;
}

// Run the test
testMacroVariance()
	.then(() => {
		console.log('\nTest completed successfully.');
		process.exit(0);
	})
	.catch(error => {
		console.error('\n❌ Test failed with error:', error);
		process.exit(1);
	});
