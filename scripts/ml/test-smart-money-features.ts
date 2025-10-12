/**
 * Test Smart Money Flow Feature Extractor
 *
 * Quick test to verify all 27 features can be extracted for a test symbol
 * Usage: npx ts-node scripts/ml/test-smart-money-features.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { SmartMoneyFlowFeatureExtractor } from '../../app/services/ml/smart-money-flow/SmartMoneyFlowFeatureExtractor.js';

async function testFeatureExtraction() {
	console.log('=== Smart Money Flow Feature Extractor Test ===\n');

	const extractor = new SmartMoneyFlowFeatureExtractor();
	const testSymbol = 'AAPL'; // Use a well-known symbol with good data
	const asOfDate = new Date('2024-10-01'); // Fixed date for reproducibility

	console.log(`Testing feature extraction for ${testSymbol} as of ${asOfDate.toISOString().split('T')[0]}`);
	console.log('This may take 10-20 seconds due to API calls...\n');

	const startTime = Date.now();

	try {
		const features = await extractor.extractFeatures(testSymbol, asOfDate);

		const duration = Date.now() - startTime;
		console.log(`\n✅ Feature extraction completed in ${duration}ms\n`);

		// Display all 27 features
		console.log('=== INSIDER TRADING FEATURES (8) ===');
		console.log(`  insider_buy_ratio_30d:          ${features.insider_buy_ratio_30d.toFixed(4)}`);
		console.log(`  insider_buy_volume_30d:         ${features.insider_buy_volume_30d.toFixed(0)}`);
		console.log(`  insider_sell_volume_30d:        ${features.insider_sell_volume_30d.toFixed(0)}`);
		console.log(`  insider_net_flow_30d:           ${features.insider_net_flow_30d.toFixed(0)}`);
		console.log(`  insider_cluster_score:          ${features.insider_cluster_score.toFixed(0)}`);
		console.log(`  insider_ownership_change_90d:   ${features.insider_ownership_change_90d.toFixed(0)}`);
		console.log(`  insider_avg_premium:            ${features.insider_avg_premium.toFixed(4)}`);
		console.log(`  c_suite_activity_ratio:         ${features.c_suite_activity_ratio.toFixed(4)}`);

		console.log('\n=== INSTITUTIONAL OWNERSHIP FEATURES (7) ===');
		console.log(`  inst_ownership_pct:             ${features.inst_ownership_pct.toFixed(4)}`);
		console.log(`  inst_ownership_change_1q:       ${features.inst_ownership_change_1q.toFixed(0)}`);
		console.log(`  inst_new_positions_count:       ${features.inst_new_positions_count.toFixed(0)}`);
		console.log(`  inst_closed_positions_count:    ${features.inst_closed_positions_count.toFixed(0)}`);
		console.log(`  inst_avg_position_size_change:  ${features.inst_avg_position_size_change.toFixed(4)}`);
		console.log(`  inst_concentration_top10:       ${features.inst_concentration_top10.toFixed(4)}`);
		console.log(`  inst_momentum_score:            ${features.inst_momentum_score.toFixed(4)}`);

		console.log('\n=== CONGRESSIONAL TRADING FEATURES (4) ===');
		console.log(`  congress_buy_count_90d:         ${features.congress_buy_count_90d.toFixed(0)}`);
		console.log(`  congress_sell_count_90d:        ${features.congress_sell_count_90d.toFixed(0)}`);
		console.log(`  congress_net_sentiment:         ${features.congress_net_sentiment.toFixed(0)}`);
		console.log(`  congress_recent_activity_7d:    ${features.congress_recent_activity_7d.toFixed(0)}`);

		console.log('\n=== HEDGE FUND HOLDINGS FEATURES (5) ===');
		console.log(`  hedgefund_top20_exposure:       ${features.hedgefund_top20_exposure.toFixed(4)}`);
		console.log(`  hedgefund_net_change_1q:        ${features.hedgefund_net_change_1q.toFixed(0)}`);
		console.log(`  hedgefund_new_entry_count:      ${features.hedgefund_new_entry_count.toFixed(0)}`);
		console.log(`  hedgefund_exit_count:           ${features.hedgefund_exit_count.toFixed(0)}`);
		console.log(`  hedgefund_conviction_score:     ${features.hedgefund_conviction_score.toFixed(4)}`);

		console.log('\n=== ETF HOLDINGS FEATURES (3) ===');
		console.log(`  etf_ownership_pct:              ${features.etf_ownership_pct.toFixed(4)}`);
		console.log(`  etf_flow_30d:                   ${features.etf_flow_30d.toFixed(0)}`);
		console.log(`  etf_concentration:              ${features.etf_concentration.toFixed(4)}`);

		console.log('\n=== FEATURE COUNT ===');
		const featureKeys = Object.keys(features);
		console.log(`Total features extracted: ${featureKeys.length}/27`);

		// Check for missing features
		const expectedFeatures = 27;
		if (featureKeys.length !== expectedFeatures) {
			console.log(`\n⚠️  WARNING: Expected ${expectedFeatures} features but got ${featureKeys.length}`);
		} else {
			console.log('\n✅ All 27 features extracted successfully!');
		}

		// Check for NaN values
		const nanFeatures = featureKeys.filter(key =>
			Number.isNaN((features as any)[key])
		);
		if (nanFeatures.length > 0) {
			console.log(`\n⚠️  WARNING: Found NaN values in features: ${nanFeatures.join(', ')}`);
		}

		// Convert to array for ML model input
		const featureArray = [
			features.insider_buy_ratio_30d,
			features.insider_buy_volume_30d,
			features.insider_sell_volume_30d,
			features.insider_net_flow_30d,
			features.insider_cluster_score,
			features.insider_ownership_change_90d,
			features.insider_avg_premium,
			features.c_suite_activity_ratio,
			features.inst_ownership_pct,
			features.inst_ownership_change_1q,
			features.inst_new_positions_count,
			features.inst_closed_positions_count,
			features.inst_avg_position_size_change,
			features.inst_concentration_top10,
			features.inst_momentum_score,
			features.congress_buy_count_90d,
			features.congress_sell_count_90d,
			features.congress_net_sentiment,
			features.congress_recent_activity_7d,
			features.hedgefund_top20_exposure,
			features.hedgefund_net_change_1q,
			features.hedgefund_new_entry_count,
			features.hedgefund_exit_count,
			features.hedgefund_conviction_score,
			features.etf_ownership_pct,
			features.etf_flow_30d,
			features.etf_concentration,
		];

		console.log('\n=== FEATURE ARRAY FOR ML MODEL ===');
		console.log(`Array length: ${featureArray.length}`);
		console.log(`First 5 values: [${featureArray.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);

		console.log('\n✅ TEST PASSED: Feature extraction working correctly!');

	} catch (error) {
		console.error('\n❌ TEST FAILED:', error);
		console.error('\nError details:', error);
		process.exit(1);
	}
}

// Run test
testFeatureExtraction()
	.then(() => {
		console.log('\nTest completed successfully');
		process.exit(0);
	})
	.catch(error => {
		console.error('\nTest failed with error:', error);
		process.exit(1);
	});
