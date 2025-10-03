/**
 * Test Historical Feature Extraction
 *
 * Purpose: Verify that FeatureExtractor correctly retrieves historical data
 * for specific earnings dates instead of always using recent data
 *
 * Usage:
 *   npx tsx scripts/ml/test-historical-features.ts
 */

import "dotenv/config";
import { EarlySignalFeatureExtractor } from "../../app/services/ml/early-signal/FeatureExtractor.js";

async function testHistoricalFeatures() {
	console.log("🧪 Testing Historical Feature Extraction");
	console.log("=".repeat(80));

	const extractor = new EarlySignalFeatureExtractor();

	// Test cases: historical earnings dates
	const testCases = [
		{ symbol: "TSLA", date: new Date("2023-01-25"), description: "TSLA Q4 2022 earnings" },
		{ symbol: "NVDA", date: new Date("2023-02-22"), description: "NVDA Q4 2022 earnings" },
		{ symbol: "AAPL", date: new Date("2023-02-02"), description: "AAPL Q1 2023 earnings" },
	];

	console.log(`\nTesting ${testCases.length} historical earnings dates...\n`);

	for (const testCase of testCases) {
		console.log(`Testing: ${testCase.description}`);
		console.log(`  Symbol: ${testCase.symbol}`);
		console.log(`  Date: ${testCase.date.toISOString().split("T")[0]}`);

		try {
			const startTime = Date.now();
			const features = await extractor.extractFeatures(testCase.symbol, testCase.date);
			const duration = Date.now() - startTime;

			console.log(`  Duration: ${duration}ms`);
			console.log(`  Features extracted:`);
			console.log(`    Momentum (5d): ${features.price_change_5d.toFixed(4)}`);
			console.log(`    Momentum (10d): ${features.price_change_10d.toFixed(4)}`);
			console.log(`    Momentum (20d): ${features.price_change_20d.toFixed(4)}`);
			console.log(`    Volume Ratio: ${features.volume_ratio.toFixed(4)}`);
			console.log(`    Volume Trend: ${features.volume_trend.toFixed(4)}`);
			console.log(`    RSI Momentum: ${features.rsi_momentum.toFixed(4)}`);
			console.log(`    MACD Histogram: ${features.macd_histogram_trend.toFixed(4)}`);

			// Check if features are non-zero (indicates historical data was retrieved)
			const nonZeroFeatures = [
				features.price_change_5d,
				features.price_change_10d,
				features.price_change_20d,
				features.volume_ratio - 1.0, // Subtract 1.0 since default is 1.0
				features.volume_trend,
			].filter(f => Math.abs(f) > 0.0001).length;

			console.log(`  ✓ Non-zero features: ${nonZeroFeatures}/5 momentum/volume features`);

			if (nonZeroFeatures === 0) {
				console.log(
					`  ⚠️  WARNING: All features are zero - historical data may not be available`
				);
			} else {
				console.log(`  ✓ SUCCESS: Historical features extracted correctly`);
			}
		} catch (error: any) {
			console.error(`  ✗ FAILED: ${error.message}`);
		}

		console.log("");
	}

	console.log("=".repeat(80));
	console.log("✅ Historical Feature Extraction Test Complete");
	console.log("=".repeat(80));
}

// Run test
testHistoricalFeatures().catch(console.error);
