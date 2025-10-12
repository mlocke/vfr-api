/**
 * Test Script: Validate Smart Money Flow Dataset Generation
 *
 * Purpose: Quick validation test to ensure dataset generation pipeline works correctly
 *
 * Tests:
 * 1. Feature extraction for a single symbol
 * 2. Label generation for a single symbol
 * 3. Complete example generation
 * 4. CSV formatting
 *
 * Usage:
 *   npx tsx scripts/ml/smart-money-flow/test-dataset-generation.ts
 */

import { SmartMoneyFlowFeatureExtractor } from "../../../app/services/ml/smart-money-flow/SmartMoneyFlowFeatureExtractor";
import { generateLabel } from "./label-generator";
import { smartMoneyCache } from "../../../app/services/cache/SmartMoneyDataCache";

/**
 * Test 1: Feature Extraction
 */
async function testFeatureExtraction() {
	console.log("\n" + "=".repeat(80));
	console.log("Test 1: Feature Extraction");
	console.log("=".repeat(80));

	const extractor = new SmartMoneyFlowFeatureExtractor();
	const symbol = "AAPL";
	const sampleDate = new Date("2024-01-15");

	console.log(`\nExtracting features for ${symbol} on ${sampleDate.toISOString().split("T")[0]}...`);

	try {
		const features = await extractor.extractFeatures(symbol, sampleDate);

		console.log("\n✅ Feature extraction successful!");
		console.log("\nSample Features:");
		console.log(`  insider_buy_ratio_30d:     ${features.insider_buy_ratio_30d.toFixed(4)}`);
		console.log(`  inst_ownership_pct:        ${features.inst_ownership_pct.toFixed(4)}`);
		console.log(`  congress_net_sentiment:    ${features.congress_net_sentiment}`);
		console.log(`  hedgefund_top20_exposure:  ${features.hedgefund_top20_exposure.toFixed(4)}`);
		console.log(`  etf_ownership_pct:         ${features.etf_ownership_pct.toFixed(4)}`);

		// Validate all 27 features are present
		const featureCount = Object.keys(features).length;
		if (featureCount === 27) {
			console.log(`\n✅ All 27 features extracted successfully`);
		} else {
			console.log(`\n⚠️  Expected 27 features, got ${featureCount}`);
		}

		return true;
	} catch (error: any) {
		console.error(`\n❌ Feature extraction failed: ${error.message}`);
		return false;
	}
}

/**
 * Test 2: Label Generation
 */
async function testLabelGeneration() {
	console.log("\n" + "=".repeat(80));
	console.log("Test 2: Label Generation");
	console.log("=".repeat(80));

	const symbol = "AAPL";
	const sampleDate = "2024-01-15";

	console.log(`\nGenerating label for ${symbol} on ${sampleDate}...`);

	try {
		const labelData = await generateLabel(symbol, sampleDate);

		if (!labelData) {
			console.log(`\n⚠️  No label data available (insufficient price data)`);
			return false;
		}

		console.log("\n✅ Label generation successful!");
		console.log(`\nLabel Data:`);
		console.log(`  Symbol:            ${labelData.symbol}`);
		console.log(`  Sample Date:       ${labelData.sampleDate}`);
		console.log(`  Price at Sample:   $${labelData.priceAtSample.toFixed(2)}`);
		console.log(`  Price After 14d:   $${labelData.priceAfter14d.toFixed(2)}`);
		console.log(`  14-Day Return:     ${(labelData.return14d * 100).toFixed(2)}%`);
		console.log(`  Label:             ${labelData.label} (${labelData.label === 1 ? "BULLISH" : "BEARISH"})`);

		return true;
	} catch (error: any) {
		console.error(`\n❌ Label generation failed: ${error.message}`);
		return false;
	}
}

/**
 * Test 3: Complete Example Generation
 */
async function testCompleteExample() {
	console.log("\n" + "=".repeat(80));
	console.log("Test 3: Complete Example Generation");
	console.log("=".repeat(80));

	const extractor = new SmartMoneyFlowFeatureExtractor();
	const symbol = "NVDA";
	const sampleDate = new Date("2024-02-15");
	const sampleDateStr = sampleDate.toISOString().split("T")[0];

	console.log(`\nGenerating complete training example for ${symbol} on ${sampleDateStr}...`);

	try {
		// Extract features
		console.log(`\n1. Extracting 27 features...`);
		const features = await extractor.extractFeatures(symbol, sampleDate);
		console.log(`   ✓ Features extracted`);

		// Generate label
		console.log(`\n2. Generating label (14-day forward window)...`);
		const labelData = await generateLabel(symbol, sampleDateStr);

		if (!labelData) {
			console.log(`   ⚠️  No label data available`);
			return false;
		}
		console.log(`   ✓ Label generated: ${labelData.label} (${labelData.label === 1 ? "BULLISH" : "BEARISH"})`);

		// Combine into training example
		const example = {
			symbol,
			date: labelData.sampleDate,
			features,
			label: labelData.label,
			priceAtSample: labelData.priceAtSample,
			priceAfter14d: labelData.priceAfter14d,
			return14d: labelData.return14d,
		};

		console.log(`\n✅ Complete training example generated!`);
		console.log(`\nExample Summary:`);
		console.log(`  Symbol:               ${example.symbol}`);
		console.log(`  Date:                 ${example.date}`);
		console.log(`  Features:             27 numeric features`);
		console.log(`  Label:                ${example.label} (${example.label === 1 ? "BULLISH" : "BEARISH"})`);
		console.log(`  Price at Sample:      $${example.priceAtSample.toFixed(2)}`);
		console.log(`  Price After 14d:      $${example.priceAfter14d.toFixed(2)}`);
		console.log(`  Return:               ${(example.return14d * 100).toFixed(2)}%`);

		return true;
	} catch (error: any) {
		console.error(`\n❌ Example generation failed: ${error.message}`);
		return false;
	}
}

/**
 * Test 4: Cache Statistics
 */
async function testCacheStatistics() {
	console.log("\n" + "=".repeat(80));
	console.log("Test 4: Cache Statistics");
	console.log("=".repeat(80));

	smartMoneyCache.logStats();

	const stats = smartMoneyCache.getStats();
	const hitRate = (stats.hitRate * 100).toFixed(2);

	console.log("\nCache Performance Analysis:");
	if (stats.hits + stats.misses === 0) {
		console.log("  ℹ️  No cache operations performed yet");
	} else if (stats.hitRate > 0.95) {
		console.log(`  ✅ Excellent cache hit rate: ${hitRate}% (target: >95%)`);
	} else if (stats.hitRate > 0.5) {
		console.log(`  ⚠️  Moderate cache hit rate: ${hitRate}% (target: >95%)`);
		console.log(`      This is normal for first run (building cache)`);
	} else {
		console.log(`  ⚠️  Low cache hit rate: ${hitRate}% (target: >95%)`);
		console.log(`      Check cache directory permissions and TTL settings`);
	}

	return true;
}

/**
 * Main test suite
 */
async function main() {
	console.log("\n🧪 Smart Money Flow Dataset Generation Test Suite");
	console.log("=".repeat(80));
	console.log("Purpose: Validate dataset generation pipeline");
	console.log("=".repeat(80));

	const results = {
		featureExtraction: false,
		labelGeneration: false,
		completeExample: false,
		cacheStats: false,
	};

	// Run tests
	results.featureExtraction = await testFeatureExtraction();
	results.labelGeneration = await testLabelGeneration();
	results.completeExample = await testCompleteExample();
	results.cacheStats = await testCacheStatistics();

	// Summary
	console.log("\n" + "=".repeat(80));
	console.log("Test Summary");
	console.log("=".repeat(80));
	console.log(`Feature Extraction:     ${results.featureExtraction ? "✅ PASS" : "❌ FAIL"}`);
	console.log(`Label Generation:       ${results.labelGeneration ? "✅ PASS" : "❌ FAIL"}`);
	console.log(`Complete Example:       ${results.completeExample ? "✅ PASS" : "❌ FAIL"}`);
	console.log(`Cache Statistics:       ${results.cacheStats ? "✅ PASS" : "❌ FAIL"}`);

	const allPassed = Object.values(results).every((result) => result === true);

	if (allPassed) {
		console.log("\n✅ All tests PASSED - Dataset generation pipeline is ready!");
		console.log("\n💡 Next step: Run dataset generation with --test flag:");
		console.log("   npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --test");
	} else {
		console.log("\n❌ Some tests FAILED - Review errors above");
		console.log("\n💡 Common issues:");
		console.log("   1. Missing API keys (FMP_API_KEY)");
		console.log("   2. Network connectivity issues");
		console.log("   3. Insufficient historical data for selected dates");
	}

	console.log("=".repeat(80));
}

main().catch(console.error);
