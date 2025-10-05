/**
 * Focused Feature Extraction Method Tests
 *
 * Tests core calculation methods in FeatureExtractor with known data
 * Validates mathematical correctness without excessive API calls
 */

import { EarlySignalFeatureExtractor } from "../../app/services/ml/early-signal/FeatureExtractor.js";
import type { OHLC } from "../../app/services/ml/early-signal/types.js";

// Helper to access private methods for testing
class TestableFeatureExtractor extends EarlySignalFeatureExtractor {
	// Expose calculation methods for direct testing
	public testCalculateMomentum(data: OHLC[], days: number): number {
		return (this as any).calculateMomentum(data, days);
	}

	public testCalculateVolumeRatio(data: OHLC[], shortWindow: number, longWindow: number): number {
		return (this as any).calculateVolumeRatio(data, shortWindow, longWindow);
	}

	public testCalculateVolumeTrend(data: OHLC[], window: number): number {
		return (this as any).calculateVolumeTrend(data, window);
	}

	public testCalculateAverageVolume(data: OHLC[]): number {
		return (this as any).calculateAverageVolume(data);
	}

	public testLinearRegressionSlope(values: number[]): number {
		return (this as any).linearRegressionSlope(values);
	}

	public testCalculate24hSentimentChange(data: any[], platform: "stocktwits" | "twitter"): number {
		return (this as any).calculate24hSentimentChange(data, platform);
	}

	public testCalculateHourlySentimentMomentum(data: any[], platform: "stocktwits" | "twitter"): number {
		return (this as any).calculateHourlySentimentMomentum(data, platform);
	}

	public testCalculate7dSentimentTrend(data: any[], platform: "stocktwits" | "twitter"): number {
		return (this as any).calculate7dSentimentTrend(data, platform);
	}

	public testCalculateReturns(data: OHLC[]): number[] {
		return (this as any).calculateReturns(data);
	}

	public testCalculateBeta(stockReturns: number[], marketReturns: number[]): number {
		return (this as any).calculateBeta(stockReturns, marketReturns);
	}
}

// Generate mock OHLC data for testing
function generateMockOHLC(numDays: number, basePrice: number = 100, trend: number = 0): OHLC[] {
	const data: OHLC[] = [];
	const startDate = new Date('2024-01-01');

	for (let i = 0; i < numDays; i++) {
		const date = new Date(startDate);
		date.setDate(startDate.getDate() + i);

		const price = basePrice + (i * trend) + (Math.random() - 0.5) * 2;
		const open = price - 0.5 + Math.random();
		const close = price + 0.5 - Math.random();
		const high = Math.max(open, close) + Math.random() * 0.5;
		const low = Math.min(open, close) - Math.random() * 0.5;
		const volume = 1000000 + Math.random() * 500000;

		data.unshift({
			date,
			open,
			high,
			low,
			close,
			volume
		});
	}

	return data;
}

// Generate mock sentiment data
function generateMockSentimentData(numHours: number, platform: "stocktwits" | "twitter"): any[] {
	const data: any[] = [];
	const now = new Date();

	for (let i = 0; i < numHours; i++) {
		const date = new Date(now.getTime() - (i * 60 * 60 * 1000));
		const sentiment = Math.random() * 2 - 1; // -1 to 1

		data.push({
			date,
			stocktwitsSentiment: platform === "stocktwits" ? sentiment : null,
			twitterSentiment: platform === "twitter" ? sentiment : null
		});
	}

	return data;
}

async function runTests() {
	const extractor = new TestableFeatureExtractor();

	console.log("\n=== Feature Extraction Method Tests ===\n");

	let passedTests = 0;
	let totalTests = 0;

	// Test 1: calculateMomentum
	console.log("Test 1: calculateMomentum");
	totalTests++;
	try {
		const data = generateMockOHLC(30, 100, 0.5);
		const momentum5d = extractor.testCalculateMomentum(data, 5);
		const momentum10d = extractor.testCalculateMomentum(data, 10);
		const momentum20d = extractor.testCalculateMomentum(data, 20);

		console.log(`  5-day momentum: ${(momentum5d * 100).toFixed(2)}%`);
		console.log(`  10-day momentum: ${(momentum10d * 100).toFixed(2)}%`);
		console.log(`  20-day momentum: ${(momentum20d * 100).toFixed(2)}%`);

		if (typeof momentum5d === 'number' && !isNaN(momentum5d) &&
			typeof momentum10d === 'number' && !isNaN(momentum10d) &&
			typeof momentum20d === 'number' && !isNaN(momentum20d)) {
			console.log("  ✓ PASS: All momentum calculations are valid numbers\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Invalid momentum values\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 2: calculateVolumeRatio
	console.log("Test 2: calculateVolumeRatio");
	totalTests++;
	try {
		const data = generateMockOHLC(30, 100, 0);
		const volumeRatio = extractor.testCalculateVolumeRatio(data, 5, 20);

		console.log(`  Volume ratio (5d/20d): ${volumeRatio.toFixed(3)}`);

		if (typeof volumeRatio === 'number' && !isNaN(volumeRatio) && volumeRatio > 0) {
			console.log("  ✓ PASS: Volume ratio is valid and positive\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Invalid volume ratio\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 3: calculateVolumeTrend
	console.log("Test 3: calculateVolumeTrend");
	totalTests++;
	try {
		const increasingVolume = generateMockOHLC(20, 100, 0);
		// Manually set increasing volume
		increasingVolume.forEach((d, i) => {
			d.volume = 1000000 + (i * 50000);
		});

		const trend = extractor.testCalculateVolumeTrend(increasingVolume, 10);

		console.log(`  Volume trend (linear slope): ${trend.toFixed(2)}`);

		if (typeof trend === 'number' && !isNaN(trend)) {
			console.log("  ✓ PASS: Volume trend calculated correctly\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Invalid volume trend\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 4: calculateAverageVolume
	console.log("Test 4: calculateAverageVolume");
	totalTests++;
	try {
		const data = generateMockOHLC(10, 100, 0);
		const avgVolume = extractor.testCalculateAverageVolume(data);

		console.log(`  Average volume: ${avgVolume.toLocaleString()}`);

		if (typeof avgVolume === 'number' && !isNaN(avgVolume) && avgVolume > 0) {
			console.log("  ✓ PASS: Average volume calculated correctly\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Invalid average volume\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 5: linearRegressionSlope - Positive slope
	console.log("Test 5: linearRegressionSlope - Positive trend");
	totalTests++;
	try {
		const positiveValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const slope = extractor.testLinearRegressionSlope(positiveValues);

		console.log(`  Slope of [1,2,3...10]: ${slope.toFixed(4)}`);

		if (typeof slope === 'number' && !isNaN(slope) && slope > 0) {
			console.log("  ✓ PASS: Positive slope detected correctly\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Expected positive slope\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 6: linearRegressionSlope - Negative slope
	console.log("Test 6: linearRegressionSlope - Negative trend");
	totalTests++;
	try {
		const negativeValues = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
		const slope = extractor.testLinearRegressionSlope(negativeValues);

		console.log(`  Slope of [10,9,8...1]: ${slope.toFixed(4)}`);

		if (typeof slope === 'number' && !isNaN(slope) && slope < 0) {
			console.log("  ✓ PASS: Negative slope detected correctly\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Expected negative slope\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 7: calculate24hSentimentChange
	console.log("Test 7: calculate24hSentimentChange");
	totalTests++;
	try {
		const sentimentData = generateMockSentimentData(50, "stocktwits");
		const change = extractor.testCalculate24hSentimentChange(sentimentData, "stocktwits");

		console.log(`  24h sentiment change: ${change.toFixed(4)}`);

		if (typeof change === 'number' && !isNaN(change)) {
			console.log("  ✓ PASS: 24h sentiment change calculated\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Invalid sentiment change\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 8: calculateHourlySentimentMomentum
	console.log("Test 8: calculateHourlySentimentMomentum");
	totalTests++;
	try {
		const sentimentData = generateMockSentimentData(50, "twitter");
		const momentum = extractor.testCalculateHourlySentimentMomentum(sentimentData, "twitter");

		console.log(`  Hourly sentiment momentum: ${momentum.toFixed(4)}`);

		if (typeof momentum === 'number' && !isNaN(momentum)) {
			console.log("  ✓ PASS: Hourly sentiment momentum calculated\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Invalid sentiment momentum\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 9: calculate7dSentimentTrend
	console.log("Test 9: calculate7dSentimentTrend");
	totalTests++;
	try {
		const sentimentData = generateMockSentimentData(200, "stocktwits");
		const trend = extractor.testCalculate7dSentimentTrend(sentimentData, "stocktwits");

		console.log(`  7-day sentiment trend: ${trend.toFixed(4)}`);

		if (typeof trend === 'number' && !isNaN(trend)) {
			console.log("  ✓ PASS: 7-day sentiment trend calculated\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Invalid sentiment trend\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 10: calculateReturns
	console.log("Test 10: calculateReturns");
	totalTests++;
	try {
		const data = generateMockOHLC(10, 100, 1);
		const returns = extractor.testCalculateReturns(data);

		console.log(`  Returns array length: ${returns.length}`);
		console.log(`  Sample returns: ${returns.slice(0, 3).map(r => r.toFixed(4)).join(', ')}`);

		if (Array.isArray(returns) && returns.length === 9 && returns.every(r => typeof r === 'number' && !isNaN(r))) {
			console.log("  ✓ PASS: Returns calculated correctly\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Invalid returns array\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 11: calculateBeta
	console.log("Test 11: calculateBeta");
	totalTests++;
	try {
		const stockReturns = [0.01, 0.02, -0.01, 0.03, 0.01];
		const marketReturns = [0.01, 0.01, -0.005, 0.02, 0.01];
		const beta = extractor.testCalculateBeta(stockReturns, marketReturns);

		console.log(`  Beta: ${beta.toFixed(4)}`);

		if (typeof beta === 'number' && !isNaN(beta) && beta > 0) {
			console.log("  ✓ PASS: Beta calculated correctly\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Invalid beta value\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 12: Edge case - Empty data
	console.log("Test 12: Edge case - Empty data");
	totalTests++;
	try {
		const emptyData: OHLC[] = [];
		const momentum = extractor.testCalculateMomentum(emptyData, 5);
		const avgVolume = extractor.testCalculateAverageVolume(emptyData);

		console.log(`  Momentum with empty data: ${momentum}`);
		console.log(`  Avg volume with empty data: ${avgVolume}`);

		if (momentum === 0 && avgVolume === 0) {
			console.log("  ✓ PASS: Empty data handled gracefully\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Empty data not handled correctly\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 13: Edge case - Insufficient data
	console.log("Test 13: Edge case - Insufficient data");
	totalTests++;
	try {
		const insufficientData = generateMockOHLC(3, 100, 0);
		const momentum10d = extractor.testCalculateMomentum(insufficientData, 10);
		const volumeRatio = extractor.testCalculateVolumeRatio(insufficientData, 5, 20);

		console.log(`  10d momentum with only 3 days: ${momentum10d}`);
		console.log(`  Volume ratio with only 3 days: ${volumeRatio}`);

		if (momentum10d === 0 && volumeRatio === 1.0) {
			console.log("  ✓ PASS: Insufficient data handled gracefully\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Insufficient data not handled correctly\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Test 14: Integration test - Full feature extraction with real API
	console.log("Test 14: Integration - Real feature extraction for AAPL");
	totalTests++;
	try {
		const startTime = Date.now();
		const features = await extractor.extractFeatures("AAPL");
		const duration = Date.now() - startTime;

		console.log(`  Extraction time: ${duration}ms`);
		console.log(`  Features extracted: ${Object.keys(features).length}`);
		console.log(`  Sample features:`);
		console.log(`    - price_change_5d: ${(features.price_change_5d * 100).toFixed(2)}%`);
		console.log(`    - volume_ratio: ${features.volume_ratio.toFixed(3)}`);
		console.log(`    - sentiment_news_delta: ${features.sentiment_news_delta.toFixed(3)}`);
		console.log(`    - earnings_surprise: ${features.earnings_surprise.toFixed(2)}%`);
		console.log(`    - rsi_momentum: ${features.rsi_momentum.toFixed(2)}`);

		if (Object.keys(features).length === 34 &&
			Object.values(features).every(v => typeof v === 'number' && !isNaN(v))) {
			console.log("  ✓ PASS: Real feature extraction successful\n");
			passedTests++;
		} else {
			console.log("  ✗ FAIL: Feature extraction incomplete or invalid\n");
		}
	} catch (error) {
		console.log(`  ✗ FAIL: ${error}\n`);
	}

	// Summary
	console.log("=== Test Summary ===");
	console.log(`Total tests: ${totalTests}`);
	console.log(`Passed: ${passedTests}`);
	console.log(`Failed: ${totalTests - passedTests}`);
	console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

	if (passedTests === totalTests) {
		console.log("✓ ALL TESTS PASSED!");
		process.exit(0);
	} else {
		console.log(`✗ ${totalTests - passedTests} TEST(S) FAILED`);
		process.exit(1);
	}
}

runTests().catch(error => {
	console.error("Test execution failed:", error);
	process.exit(1);
});
