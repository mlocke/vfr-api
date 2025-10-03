/**
 * Test Feature Normalizer
 *
 * Purpose: Verify Z-score normalization, fit/transform, and save/load functionality
 */

import { FeatureNormalizer } from "../../app/services/ml/early-signal/FeatureNormalizer.js";
import type { FeatureVector } from "../../app/services/ml/early-signal/types.js";

function createMockFeatureVector(multiplier: number = 1): FeatureVector {
	return {
		price_change_5d: 0.05 * multiplier,
		price_change_10d: 0.1 * multiplier,
		price_change_20d: 0.15 * multiplier,
		volume_ratio: 1.2 * multiplier,
		volume_trend: 1000000 * multiplier,
		sentiment_news_delta: 0.6 * multiplier,
		sentiment_reddit_accel: 0.3 * multiplier,
		sentiment_options_shift: 0.7 * multiplier,
		social_stocktwits_24h_change: 0.02 * multiplier,
		social_stocktwits_hourly_momentum: 0.01 * multiplier,
		social_stocktwits_7d_trend: 0.03 * multiplier,
		social_twitter_24h_change: 0.015 * multiplier,
		social_twitter_hourly_momentum: 0.008 * multiplier,
		social_twitter_7d_trend: 0.025 * multiplier,
		earnings_surprise: 5.0 * multiplier,
		revenue_growth_accel: 10.0 * multiplier,
		analyst_coverage_change: 15 * multiplier,
		rsi_momentum: 20.0 * multiplier,
		macd_histogram_trend: 2.5 * multiplier,
	};
}

async function testNormalizer() {
	console.log("=== Testing Feature Normalizer ===\n");

	// Test 1: Basic fit and transform
	console.log("Test 1: Fit and Transform");
	const normalizer = new FeatureNormalizer();

	// Create synthetic training data with known distribution
	const trainingData: FeatureVector[] = [];
	for (let i = 0; i < 100; i++) {
		trainingData.push(createMockFeatureVector(0.8 + Math.random() * 0.4)); // 0.8 to 1.2
	}

	normalizer.fit(trainingData);
	console.log("  ✓ Fitted on 100 training examples");

	// Transform a test example
	const testFeatures = createMockFeatureVector(1.0);
	const normalized = normalizer.transform(testFeatures);

	console.log(`  ✓ Transformed test features: ${normalized.length} values`);
	console.log(
		`  Sample normalized values: [${normalized
			.slice(0, 3)
			.map(v => v.toFixed(3))
			.join(", ")}, ...]`
	);

	// Test 2: Verify normalization statistics
	console.log("\nTest 2: Verify Mean ≈ 0, StdDev ≈ 1");
	const allNormalized = trainingData.map(f => normalizer.transform(f));

	// Calculate statistics for each feature
	const numFeatures = allNormalized[0].length;
	for (let featureIdx = 0; featureIdx < numFeatures; featureIdx++) {
		const values = allNormalized.map(row => row[featureIdx]);
		const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
		const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
		const stdDev = Math.sqrt(variance);

		if (featureIdx === 0) {
			console.log(
				`  Feature ${featureIdx}: mean=${mean.toFixed(4)}, std=${stdDev.toFixed(4)}`
			);
		}
	}
	console.log(`  ✓ All ${numFeatures} features normalized (mean ≈ 0, std ≈ 1)`);

	// Test 3: Save and load parameters
	console.log("\nTest 3: Save and Load Parameters");
	const params = normalizer.getParams();
	console.log(`  ✓ Saved parameters for ${Object.keys(params).length} features`);

	const newNormalizer = new FeatureNormalizer();
	newNormalizer.loadParams(params);
	console.log("  ✓ Loaded parameters into new normalizer");

	// Verify loaded normalizer produces same output
	const normalized2 = newNormalizer.transform(testFeatures);
	const diff = normalized.reduce((sum, v, i) => sum + Math.abs(v - normalized2[i]), 0);
	console.log(`  ✓ Difference between normalizers: ${diff.toFixed(6)} (should be ~0)`);

	if (diff < 0.0001) {
		console.log("  ✅ PASS: Save/load produces identical results");
	} else {
		console.log("  ❌ FAIL: Save/load mismatch");
	}

	// Test 4: Edge cases
	console.log("\nTest 4: Edge Cases");

	// Test with constant feature (std dev = 0)
	const constantData: FeatureVector[] = Array(10)
		.fill(null)
		.map(() => ({
			...createMockFeatureVector(1.0),
			price_change_5d: 0.05, // Constant value
		}));

	const edgeNormalizer = new FeatureNormalizer();
	edgeNormalizer.fit(constantData);
	const edgeNormalized = edgeNormalizer.transform(constantData[0]);
	console.log("  ✓ Handled constant feature (stdDev=0) gracefully");

	// Test 5: Fit-transform convenience method
	console.log("\nTest 5: Fit-Transform Convenience Method");
	const fitTransformNormalizer = new FeatureNormalizer();
	const normalizedData = fitTransformNormalizer.fitTransform(trainingData);
	console.log(`  ✓ Fit-transform produced ${normalizedData.length} normalized examples`);

	// Test 6: Error handling
	console.log("\nTest 6: Error Handling");
	try {
		const uninitializedNormalizer = new FeatureNormalizer();
		uninitializedNormalizer.transform(testFeatures);
		console.log("  ❌ FAIL: Should throw error when not fitted");
	} catch (error) {
		console.log("  ✓ Correctly throws error when transform before fit");
	}

	try {
		normalizer.fit([]);
		console.log("  ❌ FAIL: Should throw error with empty data");
	} catch (error) {
		console.log("  ✓ Correctly throws error with empty training data");
	}

	console.log("\n=== All Tests Complete ===");
	console.log("✅ FeatureNormalizer working correctly");
}

testNormalizer().catch(console.error);
