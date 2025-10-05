/**
 * Verify Macro Features Fix - Test multiple stocks to ensure consistency
 */

import { EarlySignalFeatureExtractor } from '../../app/services/ml/early-signal/FeatureExtractor';

async function verifyMacroFix() {
	console.log('🧪 Verifying Macro Features Fix Across Multiple Stocks\n');
	console.log('=' .repeat(80));

	const extractor = new EarlySignalFeatureExtractor();
	const testSymbols = ['TSLA', 'NVDA', 'MSFT'];

	for (const symbol of testSymbols) {
		console.log(`\n📊 Testing ${symbol}...\n`);

		try {
			const features = await extractor.extractFeatures(symbol);

			const macroFeatures = {
				fed_rate_change_30d: features.fed_rate_change_30d,
				unemployment_rate_change: features.unemployment_rate_change,
				cpi_inflation_rate: features.cpi_inflation_rate,
				gdp_growth_rate: features.gdp_growth_rate,
				treasury_yield_10y: features.treasury_yield_10y,
			};

			// Check if all are non-zero
			const allNonZero = Object.values(macroFeatures).every(v => v !== 0);

			if (allNonZero) {
				console.log(`✅ ${symbol}: All macro features are NON-ZERO`);
				Object.entries(macroFeatures).forEach(([key, value]) => {
					console.log(`   ${key.padEnd(30)}: ${value.toFixed(4)}`);
				});
			} else {
				console.log(`❌ ${symbol}: Some features are ZERO`);
				Object.entries(macroFeatures).forEach(([key, value]) => {
					const status = value === 0 ? '❌' : '✅';
					console.log(`   ${status} ${key.padEnd(30)}: ${value.toFixed(4)}`);
				});
			}
		} catch (error) {
			console.error(`❌ ${symbol}: Error during extraction:`, error.message);
		}
	}

	console.log('\n' + '=' .repeat(80));
	console.log('✅ Verification Complete\n');
}

// Run the verification
verifyMacroFix()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('❌ Verification failed:', error);
		process.exit(1);
	});
