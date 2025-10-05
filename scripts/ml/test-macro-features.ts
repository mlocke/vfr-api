/**
 * Test Macro Features - Validate that macro features return real numeric values
 *
 * This script tests the fixed getMacroeconomicData() method in FeatureExtractor
 * to ensure it's fetching real data from FREDAPI and BLSAPI instead of using
 * static mappings.
 */

import { EarlySignalFeatureExtractor } from '../../app/services/ml/early-signal/FeatureExtractor';

async function testMacroFeatures() {
	console.log('🧪 Testing Macro Feature Extraction\n');
	console.log('=' .repeat(80));

	const extractor = new EarlySignalFeatureExtractor();

	// Test with a common stock symbol
	const symbol = 'AAPL';
	const asOfDate = new Date();

	console.log(`\nExtracting features for ${symbol} as of ${asOfDate.toISOString()}\n`);

	try {
		const startTime = Date.now();
		const features = await extractor.extractFeatures(symbol, asOfDate);
		const elapsedTime = Date.now() - startTime;

		console.log('✅ Feature extraction completed in', elapsedTime, 'ms\n');
		console.log('=' .repeat(80));
		console.log('MACRO FEATURES (Government Data):');
		console.log('=' .repeat(80));

		const macroFeatures = {
			fed_rate_change_30d: features.fed_rate_change_30d,
			unemployment_rate_change: features.unemployment_rate_change,
			cpi_inflation_rate: features.cpi_inflation_rate,
			gdp_growth_rate: features.gdp_growth_rate,
			treasury_yield_10y: features.treasury_yield_10y,
		};

		// Display each macro feature with status
		Object.entries(macroFeatures).forEach(([key, value]) => {
			const status = value === 0 ? '❌ ZERO' : '✅ NON-ZERO';
			const valueStr = typeof value === 'number' ? value.toFixed(4) : 'null';
			console.log(`${status} | ${key.padEnd(30)} | ${valueStr}`);
		});

		console.log('\n' + '=' .repeat(80));

		// Check if all features are non-zero
		const zeroFeatures = Object.entries(macroFeatures)
			.filter(([_, value]) => value === 0)
			.map(([key]) => key);

		if (zeroFeatures.length === 0) {
			console.log('🎉 SUCCESS! All macro features are returning non-zero values!\n');
		} else {
			console.log(`⚠️  WARNING: ${zeroFeatures.length} features are still returning zero:\n`);
			zeroFeatures.forEach(feature => console.log(`   - ${feature}`));
			console.log('\nThis may be due to:');
			console.log('   1. Missing API keys (FRED_API_KEY, BLS_API_KEY)');
			console.log('   2. API rate limits or temporary failures');
			console.log('   3. Missing data for the requested time period\n');
		}

		// Show expected ranges for validation
		console.log('=' .repeat(80));
		console.log('EXPECTED RANGES (for validation):');
		console.log('=' .repeat(80));
		console.log('fed_rate_change_30d:       -0.5 to 0.5  (percentage points)');
		console.log('unemployment_rate_change:  -0.5 to 0.5  (percentage points)');
		console.log('cpi_inflation_rate:         1.0 to 8.0  (YoY percentage)');
		console.log('gdp_growth_rate:           -2.0 to 5.0  (quarterly %)');
		console.log('treasury_yield_10y:         2.0 to 6.0  (percentage)');
		console.log('=' .repeat(80));

		// Display a few other features for context
		console.log('\nOTHER FEATURES (for context):');
		console.log('=' .repeat(80));
		console.log('price_change_5d:           ', features.price_change_5d.toFixed(4));
		console.log('volume_ratio:              ', features.volume_ratio.toFixed(4));
		console.log('rsi_momentum:              ', features.rsi_momentum.toFixed(4));
		console.log('earnings_surprise:         ', features.earnings_surprise.toFixed(4));
		console.log('=' .repeat(80));

	} catch (error) {
		console.error('❌ ERROR during feature extraction:');
		console.error(error);
		process.exit(1);
	}
}

// Run the test
testMacroFeatures()
	.then(() => {
		console.log('\n✅ Test completed successfully');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	});
