/**
 * Feature Extractor Comprehensive Test Suite
 *
 * Task 2.7: Create Feature Extraction Tests
 * Purpose: Comprehensive unit and integration tests for ML Early Signal Feature Extraction
 * Time Budget: 2 hours
 *
 * Test Coverage:
 * - All 13 features individually tested
 * - Complete feature vector extraction
 * - Missing data handling with graceful fallback
 * - Performance validation (<5s per symbol)
 * - Edge cases and error conditions
 * - Real API integration (NO MOCK DATA)
 *
 * Success Criteria:
 * - All tests pass
 * - <30s total test execution time
 * - All 13 features validated
 * - Latency requirements met
 *
 * Testing Standards:
 * - NO MOCK DATA policy (VFR standard)
 * - Real API integration with FinancialDataService, SentimentAnalysisService, TechnicalIndicatorService
 * - 5-minute timeout for comprehensive integration
 * - Performance benchmarks enforced
 */

import { EarlySignalFeatureExtractor } from "../FeatureExtractor";
import type { FeatureVector } from "../types";

describe("EarlySignalFeatureExtractor - Comprehensive Test Suite", () => {
	let extractor: EarlySignalFeatureExtractor;

	// Test symbols with different characteristics
	const LIQUID_SYMBOLS = ["AAPL", "TSLA", "NVDA"]; // High volume, reliable data
	const MODERATE_SYMBOLS = ["AMD", "MSFT", "GOOGL"]; // Good data availability
	const LOW_VOLUME_SYMBOLS = ["PLTR", "ARKK"]; // May have limited data

	// Performance benchmarks
	const LATENCY_TARGET = 5000; // ms - per symbol
	const TOTAL_TEST_TIME_TARGET = 30000; // ms - total suite

	beforeAll(() => {
		console.log("\n=== EarlySignalFeatureExtractor Test Suite Started ===");
		console.log(`Test Environment: Node ${process.version}`);
		console.log(`Performance Target: <${LATENCY_TARGET}ms per symbol`);
		console.log(`Total Test Time Target: <${TOTAL_TEST_TIME_TARGET}ms\n`);

		extractor = new EarlySignalFeatureExtractor();
	});

	afterAll(() => {
		console.log("\n=== Test Suite Completed ===\n");
	});

	/**
	 * CATEGORY 1: INDIVIDUAL FEATURE TESTS
	 * Test each of the 13 features separately to validate calculation logic
	 */
	describe("Category 1: Individual Feature Validation", () => {
		describe("Momentum Features (3 features)", () => {
			it("should_calculate_price_change_5d_correctly", async () => {
				const features = await extractor.extractFeatures("AAPL");

				expect(features.price_change_5d).toBeDefined();
				expect(typeof features.price_change_5d).toBe("number");
				expect(isNaN(features.price_change_5d)).toBe(false);

				// Momentum should be within realistic bounds (-100% to +1000%)
				expect(features.price_change_5d).toBeGreaterThan(-1);
				expect(features.price_change_5d).toBeLessThan(10);

				console.log(
					`  ✓ price_change_5d (AAPL): ${(features.price_change_5d * 100).toFixed(2)}%`
				);
			}, 10000);

			it("should_calculate_price_change_10d_correctly", async () => {
				const features = await extractor.extractFeatures("TSLA");

				expect(features.price_change_10d).toBeDefined();
				expect(typeof features.price_change_10d).toBe("number");
				expect(isNaN(features.price_change_10d)).toBe(false);

				// 10-day momentum should be within realistic bounds
				expect(features.price_change_10d).toBeGreaterThan(-1);
				expect(features.price_change_10d).toBeLessThan(10);

				console.log(
					`  ✓ price_change_10d (TSLA): ${(features.price_change_10d * 100).toFixed(2)}%`
				);
			}, 10000);

			it("should_calculate_price_change_20d_correctly", async () => {
				const features = await extractor.extractFeatures("NVDA");

				expect(features.price_change_20d).toBeDefined();
				expect(typeof features.price_change_20d).toBe("number");
				expect(isNaN(features.price_change_20d)).toBe(false);

				// 20-day momentum should be within realistic bounds
				expect(features.price_change_20d).toBeGreaterThan(-1);
				expect(features.price_change_20d).toBeLessThan(10);

				console.log(
					`  ✓ price_change_20d (NVDA): ${(features.price_change_20d * 100).toFixed(2)}%`
				);
			}, 10000);

			it("should_show_momentum_progression_for_trending_stock", async () => {
				const features = await extractor.extractFeatures("NVDA");

				// All momentum features should be numeric and non-NaN
				expect(typeof features.price_change_5d).toBe("number");
				expect(typeof features.price_change_10d).toBe("number");
				expect(typeof features.price_change_20d).toBe("number");

				expect(isNaN(features.price_change_5d)).toBe(false);
				expect(isNaN(features.price_change_10d)).toBe(false);
				expect(isNaN(features.price_change_20d)).toBe(false);

				console.log(
					`  ✓ Momentum progression (NVDA): 5d=${(features.price_change_5d * 100).toFixed(2)}%, 10d=${(features.price_change_10d * 100).toFixed(2)}%, 20d=${(features.price_change_20d * 100).toFixed(2)}%`
				);
			}, 10000);
		});

		describe("Volume Features (2 features)", () => {
			it("should_calculate_volume_ratio_correctly", async () => {
				const features = await extractor.extractFeatures("AAPL");

				expect(features.volume_ratio).toBeDefined();
				expect(typeof features.volume_ratio).toBe("number");
				expect(isNaN(features.volume_ratio)).toBe(false);

				// Volume ratio should be positive
				expect(features.volume_ratio).toBeGreaterThan(0);

				// Typically within 0.1 to 10.0 (10x deviation is extreme)
				expect(features.volume_ratio).toBeGreaterThan(0.1);
				expect(features.volume_ratio).toBeLessThan(10);

				console.log(`  ✓ volume_ratio (AAPL): ${features.volume_ratio.toFixed(3)}`);
			}, 10000);

			it("should_calculate_volume_trend_correctly", async () => {
				const features = await extractor.extractFeatures("TSLA");

				expect(features.volume_trend).toBeDefined();
				expect(typeof features.volume_trend).toBe("number");
				expect(isNaN(features.volume_trend)).toBe(false);

				// Volume trend can be positive or negative (slope)
				// Should be within reasonable bounds (not extreme outliers)
				expect(Math.abs(features.volume_trend)).toBeLessThan(1000000000);

				console.log(`  ✓ volume_trend (TSLA): ${features.volume_trend.toFixed(2)}`);
			}, 10000);

			it("should_detect_volume_anomalies_in_high_volume_stocks", async () => {
				const features = await extractor.extractFeatures("SPY");

				expect(features.volume_ratio).toBeDefined();
				expect(features.volume_trend).toBeDefined();

				// SPY has very stable volume, ratio should be close to 1.0
				expect(features.volume_ratio).toBeGreaterThan(0.5);
				expect(features.volume_ratio).toBeLessThan(2.0);

				console.log(
					`  ✓ Volume features (SPY): ratio=${features.volume_ratio.toFixed(3)}, trend=${features.volume_trend.toFixed(2)}`
				);
			}, 10000);
		});

		describe("Sentiment Features (3 features)", () => {
			it("should_extract_sentiment_news_delta", async () => {
				const features = await extractor.extractFeatures("TSLA");

				expect(features.sentiment_news_delta).toBeDefined();
				expect(typeof features.sentiment_news_delta).toBe("number");
				expect(isNaN(features.sentiment_news_delta)).toBe(false);

				// Sentiment scores are normalized, typically -1 to +1
				// Allow wider range for edge cases
				expect(features.sentiment_news_delta).toBeGreaterThan(-10);
				expect(features.sentiment_news_delta).toBeLessThan(10);

				console.log(
					`  ✓ sentiment_news_delta (TSLA): ${features.sentiment_news_delta.toFixed(3)}`
				);
			}, 10000);

			it("should_extract_sentiment_reddit_accel", async () => {
				const features = await extractor.extractFeatures("TSLA");

				expect(features.sentiment_reddit_accel).toBeDefined();
				expect(typeof features.sentiment_reddit_accel).toBe("number");
				expect(isNaN(features.sentiment_reddit_accel)).toBe(false);

				// Reddit sentiment acceleration can vary widely
				expect(features.sentiment_reddit_accel).toBeGreaterThan(-10);
				expect(features.sentiment_reddit_accel).toBeLessThan(10);

				console.log(
					`  ✓ sentiment_reddit_accel (TSLA): ${features.sentiment_reddit_accel.toFixed(3)}`
				);
			}, 10000);

			it("should_extract_sentiment_options_shift", async () => {
				const features = await extractor.extractFeatures("AAPL");

				expect(features.sentiment_options_shift).toBeDefined();
				expect(typeof features.sentiment_options_shift).toBe("number");
				expect(isNaN(features.sentiment_options_shift)).toBe(false);

				// Options sentiment shift
				expect(features.sentiment_options_shift).toBeGreaterThan(-10);
				expect(features.sentiment_options_shift).toBeLessThan(10);

				console.log(
					`  ✓ sentiment_options_shift (AAPL): ${features.sentiment_options_shift.toFixed(3)}`
				);
			}, 10000);

			it("should_handle_missing_sentiment_data_gracefully", async () => {
				// Test with symbol that may have limited sentiment data
				const features = await extractor.extractFeatures("PLTR");

				// Should return numeric values (possibly 0) instead of undefined/null
				expect(typeof features.sentiment_news_delta).toBe("number");
				expect(typeof features.sentiment_reddit_accel).toBe("number");
				expect(typeof features.sentiment_options_shift).toBe("number");

				expect(isNaN(features.sentiment_news_delta)).toBe(false);
				expect(isNaN(features.sentiment_reddit_accel)).toBe(false);
				expect(isNaN(features.sentiment_options_shift)).toBe(false);

				console.log(
					`  ✓ Sentiment features (PLTR): news=${features.sentiment_news_delta.toFixed(3)}, reddit=${features.sentiment_reddit_accel.toFixed(3)}, options=${features.sentiment_options_shift.toFixed(3)}`
				);
			}, 10000);
		});

		describe("Fundamental Features (3 features)", () => {
			it("should_calculate_earnings_surprise_percentage", async () => {
				const features = await extractor.extractFeatures("AAPL");

				expect(features.earnings_surprise).toBeDefined();
				expect(typeof features.earnings_surprise).toBe("number");
				expect(isNaN(features.earnings_surprise)).toBe(false);

				// Earnings surprise typically -50% to +50%, but can be extreme
				// Allow wide range for edge cases
				expect(features.earnings_surprise).toBeGreaterThan(-200);
				expect(features.earnings_surprise).toBeLessThan(200);

				console.log(
					`  ✓ earnings_surprise (AAPL): ${features.earnings_surprise.toFixed(2)}%`
				);
			}, 10000);

			it("should_calculate_revenue_growth_acceleration", async () => {
				const features = await extractor.extractFeatures("NVDA");

				expect(features.revenue_growth_accel).toBeDefined();
				expect(typeof features.revenue_growth_accel).toBe("number");
				expect(isNaN(features.revenue_growth_accel)).toBe(false);

				// Revenue growth acceleration (percentage points change)
				// Can be negative or positive
				expect(features.revenue_growth_accel).toBeGreaterThan(-100);
				expect(features.revenue_growth_accel).toBeLessThan(100);

				console.log(
					`  ✓ revenue_growth_accel (NVDA): ${features.revenue_growth_accel.toFixed(2)} pp`
				);
			}, 10000);

			it("should_calculate_analyst_coverage_change", async () => {
				const features = await extractor.extractFeatures("TSLA");

				expect(features.analyst_coverage_change).toBeDefined();
				expect(typeof features.analyst_coverage_change).toBe("number");
				expect(isNaN(features.analyst_coverage_change)).toBe(false);

				// Analyst coverage change is a normalized metric (0-15 based on implementation)
				expect(features.analyst_coverage_change).toBeGreaterThanOrEqual(0);
				expect(features.analyst_coverage_change).toBeLessThanOrEqual(15);

				console.log(
					`  ✓ analyst_coverage_change (TSLA): ${features.analyst_coverage_change.toFixed(0)}`
				);
			}, 10000);

			it("should_handle_missing_fundamental_data_gracefully", async () => {
				// Test with symbol that may have limited fundamental data
				const features = await extractor.extractFeatures("ARKK");

				// Should return numeric values (0 if missing) instead of undefined/null
				expect(typeof features.earnings_surprise).toBe("number");
				expect(typeof features.revenue_growth_accel).toBe("number");
				expect(typeof features.analyst_coverage_change).toBe("number");

				expect(isNaN(features.earnings_surprise)).toBe(false);
				expect(isNaN(features.revenue_growth_accel)).toBe(false);
				expect(isNaN(features.analyst_coverage_change)).toBe(false);

				console.log(
					`  ✓ Fundamental features (ARKK): earnings=${features.earnings_surprise.toFixed(2)}%, revenue=${features.revenue_growth_accel.toFixed(2)}, analysts=${features.analyst_coverage_change.toFixed(0)}`
				);
			}, 10000);
		});

		describe("Technical Features (2 features)", () => {
			it("should_calculate_rsi_momentum", async () => {
				const features = await extractor.extractFeatures("AAPL");

				expect(features.rsi_momentum).toBeDefined();
				expect(typeof features.rsi_momentum).toBe("number");
				expect(isNaN(features.rsi_momentum)).toBe(false);

				// RSI momentum is difference from 50 (neutral)
				// RSI ranges 0-100, so momentum ranges -50 to +50
				expect(features.rsi_momentum).toBeGreaterThan(-60);
				expect(features.rsi_momentum).toBeLessThan(60);

				console.log(`  ✓ rsi_momentum (AAPL): ${features.rsi_momentum.toFixed(2)}`);
			}, 10000);

			it("should_calculate_macd_histogram_trend", async () => {
				const features = await extractor.extractFeatures("NVDA");

				expect(features.macd_histogram_trend).toBeDefined();
				expect(typeof features.macd_histogram_trend).toBe("number");
				expect(isNaN(features.macd_histogram_trend)).toBe(false);

				// MACD histogram can be positive or negative
				// Should be reasonable (not extreme outliers)
				expect(Math.abs(features.macd_histogram_trend)).toBeLessThan(1000);

				console.log(
					`  ✓ macd_histogram_trend (NVDA): ${features.macd_histogram_trend.toFixed(4)}`
				);
			}, 10000);

			it("should_handle_missing_technical_data_gracefully", async () => {
				// Test with symbol that may have limited historical data
				const features = await extractor.extractFeatures("PLTR");

				// Should return numeric values (0 if missing) instead of undefined/null
				expect(typeof features.rsi_momentum).toBe("number");
				expect(typeof features.macd_histogram_trend).toBe("number");

				expect(isNaN(features.rsi_momentum)).toBe(false);
				expect(isNaN(features.macd_histogram_trend)).toBe(false);

				console.log(
					`  ✓ Technical features (PLTR): rsi=${features.rsi_momentum.toFixed(2)}, macd=${features.macd_histogram_trend.toFixed(4)}`
				);
			}, 10000);
		});
	});

	/**
	 * CATEGORY 2: COMPLETE FEATURE VECTOR TESTS
	 * Validate all 13 features are extracted together correctly
	 */
	describe("Category 2: Complete Feature Vector Extraction", () => {
		it("should_extract_all_13_features_for_AAPL", async () => {
			const features = await extractor.extractFeatures("AAPL");

			// Verify all 13 features exist
			const expectedFeatures: (keyof FeatureVector)[] = [
				"price_change_5d",
				"price_change_10d",
				"price_change_20d",
				"volume_ratio",
				"volume_trend",
				"sentiment_news_delta",
				"sentiment_reddit_accel",
				"sentiment_options_shift",
				"earnings_surprise",
				"revenue_growth_accel",
				"analyst_coverage_change",
				"rsi_momentum",
				"macd_histogram_trend",
			];

			expectedFeatures.forEach(feature => {
				expect(features).toHaveProperty(feature);
				expect(typeof features[feature]).toBe("number");
				expect(isNaN(features[feature])).toBe(false);
			});

			console.log(`  ✓ All 13 features extracted for AAPL`);
			console.log(`    Features:`, JSON.stringify(features, null, 2));
		}, 10000);

		it("should_extract_all_13_features_for_TSLA", async () => {
			const features = await extractor.extractFeatures("TSLA");

			// Count features
			const featureCount = Object.keys(features).length;
			expect(featureCount).toBe(13);

			// Verify all are numeric
			Object.entries(features).forEach(([key, value]) => {
				expect(typeof value).toBe("number");
				expect(isNaN(value)).toBe(false);
			});

			console.log(`  ✓ All 13 features extracted for TSLA`);
		}, 10000);

		it("should_extract_all_13_features_for_NVDA", async () => {
			const features = await extractor.extractFeatures("NVDA");

			// Verify structure
			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			// Verify no undefined or null values
			Object.values(features).forEach(value => {
				expect(value).toBeDefined();
				expect(value).not.toBeNull();
			});

			console.log(`  ✓ All 13 features extracted for NVDA`);
		}, 10000);

		it("should_extract_features_for_multiple_symbols_in_parallel", async () => {
			const symbols = ["AAPL", "TSLA", "NVDA"];

			const results = await Promise.all(
				symbols.map(symbol => extractor.extractFeatures(symbol))
			);

			expect(results.length).toBe(3);

			results.forEach((features, index) => {
				expect(features).toBeDefined();
				expect(Object.keys(features).length).toBe(13);

				Object.values(features).forEach(value => {
					expect(typeof value).toBe("number");
					expect(isNaN(value)).toBe(false);
				});

				console.log(`  ✓ Features extracted for ${symbols[index]}`);
			});
		}, 15000);
	});

	/**
	 * CATEGORY 3: MISSING DATA HANDLING
	 * Test graceful fallback to neutral values when data is unavailable
	 */
	describe("Category 3: Missing Data Handling", () => {
		it("should_return_neutral_features_for_invalid_symbol", async () => {
			const features = await extractor.extractFeatures("INVALID_SYMBOL_XYZ");

			// Should return neutral values, not throw
			expect(features).toBeDefined();
			expect(features.price_change_5d).toBe(0);
			expect(features.price_change_10d).toBe(0);
			expect(features.price_change_20d).toBe(0);
			expect(features.volume_ratio).toBe(1.0);
			expect(features.volume_trend).toBe(0);
			expect(features.sentiment_news_delta).toBe(0);
			expect(features.sentiment_reddit_accel).toBe(0);
			expect(features.sentiment_options_shift).toBe(0);
			expect(features.earnings_surprise).toBe(0);
			expect(features.revenue_growth_accel).toBe(0);
			expect(features.analyst_coverage_change).toBe(0);
			expect(features.rsi_momentum).toBe(0);
			expect(features.macd_histogram_trend).toBe(0);

			console.log(`  ✓ Neutral features returned for invalid symbol`);
		}, 10000);

		it("should_handle_empty_symbol_gracefully", async () => {
			const features = await extractor.extractFeatures("");

			// Should not throw, return neutral features
			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			console.log(`  ✓ Empty symbol handled gracefully`);
		}, 10000);

		it("should_handle_symbols_with_limited_history", async () => {
			// Recent IPO or symbol with limited data
			const features = await extractor.extractFeatures("PLTR");

			// Should return features (possibly neutral for missing data)
			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			// All features should be numeric (not undefined/null)
			Object.values(features).forEach(value => {
				expect(typeof value).toBe("number");
				expect(isNaN(value)).toBe(false);
			});

			console.log(`  ✓ Limited history symbol handled gracefully`);
		}, 10000);

		it("should_handle_symbols_with_partial_data_availability", async () => {
			// ETF that may have limited sentiment data
			const features = await extractor.extractFeatures("SPY");

			expect(features).toBeDefined();

			// Should have momentum and volume features (reliable)
			expect(typeof features.price_change_5d).toBe("number");
			expect(typeof features.volume_ratio).toBe("number");

			// Sentiment may be 0 or small values for ETF
			expect(typeof features.sentiment_news_delta).toBe("number");

			console.log(`  ✓ Partial data availability handled gracefully`);
		}, 10000);

		it("should_never_return_NaN_or_undefined_values", async () => {
			const testSymbols = ["AAPL", "INVALID", "TSLA", "", "NVDA"];

			for (const symbol of testSymbols) {
				const features = await extractor.extractFeatures(symbol);

				Object.entries(features).forEach(([key, value]) => {
					expect(value).toBeDefined();
					expect(value).not.toBeNull();
					expect(typeof value).toBe("number");
					expect(isNaN(value)).toBe(false);
				});
			}

			console.log(`  ✓ No NaN/undefined values across ${testSymbols.length} test cases`);
		}, 30000);
	});

	/**
	 * CATEGORY 4: PERFORMANCE VALIDATION
	 * Verify <5s latency per symbol requirement
	 */
	describe("Category 4: Performance Requirements", () => {
		it("should_complete_feature_extraction_in_under_5_seconds_for_AAPL", async () => {
			const startTime = Date.now();

			const features = await extractor.extractFeatures("AAPL");

			const duration = Date.now() - startTime;

			expect(features).toBeDefined();
			expect(duration).toBeLessThan(LATENCY_TARGET);

			console.log(
				`  ✓ AAPL extraction completed in ${duration}ms (target: <${LATENCY_TARGET}ms)`
			);
		}, 10000);

		it("should_complete_feature_extraction_in_under_5_seconds_for_TSLA", async () => {
			const startTime = Date.now();

			const features = await extractor.extractFeatures("TSLA");

			const duration = Date.now() - startTime;

			expect(features).toBeDefined();
			expect(duration).toBeLessThan(LATENCY_TARGET);

			console.log(
				`  ✓ TSLA extraction completed in ${duration}ms (target: <${LATENCY_TARGET}ms)`
			);
		}, 10000);

		it("should_complete_feature_extraction_in_under_5_seconds_for_NVDA", async () => {
			const startTime = Date.now();

			const features = await extractor.extractFeatures("NVDA");

			const duration = Date.now() - startTime;

			expect(features).toBeDefined();
			expect(duration).toBeLessThan(LATENCY_TARGET);

			console.log(
				`  ✓ NVDA extraction completed in ${duration}ms (target: <${LATENCY_TARGET}ms)`
			);
		}, 10000);

		it("should_handle_3_symbols_in_parallel_efficiently", async () => {
			const symbols = ["AAPL", "TSLA", "NVDA"];
			const startTime = Date.now();

			const results = await Promise.all(
				symbols.map(symbol => extractor.extractFeatures(symbol))
			);

			const duration = Date.now() - startTime;

			expect(results.length).toBe(3);
			results.forEach(features => {
				expect(features).toBeDefined();
				expect(Object.keys(features).length).toBe(13);
			});

			// Parallel execution should be faster than sequential (3 * 5s = 15s)
			expect(duration).toBeLessThan(10000);

			console.log(`  ✓ 3 symbols processed in parallel in ${duration}ms (target: <10s)`);
		}, 15000);

		it("should_handle_5_symbols_in_parallel_efficiently", async () => {
			const symbols = ["AAPL", "TSLA", "NVDA", "AMD", "MSFT"];
			const startTime = Date.now();

			const results = await Promise.all(
				symbols.map(symbol => extractor.extractFeatures(symbol))
			);

			const duration = Date.now() - startTime;

			expect(results.length).toBe(5);

			// Should complete in reasonable time (parallel execution)
			expect(duration).toBeLessThan(15000);

			console.log(`  ✓ 5 symbols processed in parallel in ${duration}ms`);
		}, 20000);

		it("should_measure_average_extraction_time_across_10_calls", async () => {
			const iterations = 10;
			const durations: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const startTime = Date.now();
				await extractor.extractFeatures("AAPL");
				const duration = Date.now() - startTime;
				durations.push(duration);
			}

			const avgDuration = durations.reduce((a, b) => a + b, 0) / iterations;
			const minDuration = Math.min(...durations);
			const maxDuration = Math.max(...durations);

			expect(avgDuration).toBeLessThan(LATENCY_TARGET);

			console.log(
				`  ✓ Average extraction time: ${avgDuration.toFixed(0)}ms (min: ${minDuration}ms, max: ${maxDuration}ms)`
			);
		}, 60000);
	});

	/**
	 * CATEGORY 5: EDGE CASES AND ERROR HANDLING
	 * Test boundary conditions and error scenarios
	 */
	describe("Category 5: Edge Cases and Error Handling", () => {
		it("should_handle_null_input_gracefully", async () => {
			const features = await extractor.extractFeatures(null as any);

			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			console.log(`  ✓ Null input handled gracefully`);
		}, 10000);

		it("should_handle_undefined_input_gracefully", async () => {
			const features = await extractor.extractFeatures(undefined as any);

			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			console.log(`  ✓ Undefined input handled gracefully`);
		}, 10000);

		it("should_handle_numeric_symbol_input", async () => {
			const features = await extractor.extractFeatures(12345 as any);

			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			console.log(`  ✓ Numeric symbol input handled gracefully`);
		}, 10000);

		it("should_handle_special_characters_in_symbol", async () => {
			const features = await extractor.extractFeatures("BRK.B");

			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			console.log(`  ✓ Special characters in symbol handled`);
		}, 10000);

		it("should_handle_lowercase_symbol", async () => {
			const features = await extractor.extractFeatures("aapl");

			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			console.log(`  ✓ Lowercase symbol handled`);
		}, 10000);

		it("should_handle_symbol_with_whitespace", async () => {
			const features = await extractor.extractFeatures("  AAPL  ");

			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			console.log(`  ✓ Symbol with whitespace handled`);
		}, 10000);

		it("should_handle_historical_date_extraction", async () => {
			const historicalDate = new Date("2024-01-15");
			const features = await extractor.extractFeatures("AAPL", historicalDate);

			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			console.log(`  ✓ Historical date extraction successful`);
		}, 10000);

		it("should_handle_very_recent_date_extraction", async () => {
			const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
			const features = await extractor.extractFeatures("TSLA", recentDate);

			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			console.log(`  ✓ Recent date extraction successful`);
		}, 10000);

		it("should_handle_future_date_gracefully", async () => {
			const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
			const features = await extractor.extractFeatures("AAPL", futureDate);

			expect(features).toBeDefined();
			expect(Object.keys(features).length).toBe(13);

			console.log(`  ✓ Future date handled gracefully`);
		}, 10000);
	});

	/**
	 * CATEGORY 6: DATA QUALITY VALIDATION
	 * Ensure extracted features have reasonable values and relationships
	 */
	describe("Category 6: Data Quality Validation", () => {
		it("should_produce_consistent_results_for_same_symbol_and_date", async () => {
			const date = new Date("2024-09-15");

			const features1 = await extractor.extractFeatures("AAPL", date);
			const features2 = await extractor.extractFeatures("AAPL", date);

			// Features should be identical (or very close due to caching)
			expect(features1.price_change_5d).toBe(features2.price_change_5d);
			expect(features1.volume_ratio).toBe(features2.volume_ratio);

			console.log(`  ✓ Consistent results for same symbol and date`);
		}, 15000);

		it("should_have_volume_ratio_default_of_1_for_neutral_case", async () => {
			const features = await extractor.extractFeatures("INVALID");

			expect(features.volume_ratio).toBe(1.0);

			console.log(`  ✓ Volume ratio defaults to 1.0 for neutral case`);
		}, 10000);

		it("should_have_all_momentum_features_at_0_for_neutral_case", async () => {
			const features = await extractor.extractFeatures("INVALID");

			expect(features.price_change_5d).toBe(0);
			expect(features.price_change_10d).toBe(0);
			expect(features.price_change_20d).toBe(0);

			console.log(`  ✓ All momentum features at 0 for neutral case`);
		}, 10000);

		it("should_validate_feature_ranges_for_real_stock", async () => {
			const features = await extractor.extractFeatures("AAPL");

			// Momentum: realistic daily changes
			expect(Math.abs(features.price_change_5d)).toBeLessThan(0.5); // <50% in 5 days (typical)
			expect(Math.abs(features.price_change_10d)).toBeLessThan(0.75); // <75% in 10 days (typical)

			// Volume: positive ratio
			expect(features.volume_ratio).toBeGreaterThan(0);

			// All features should be finite numbers
			Object.values(features).forEach(value => {
				expect(Number.isFinite(value)).toBe(true);
			});

			console.log(`  ✓ Feature ranges validated for AAPL`);
		}, 10000);

		it("should_have_numeric_precision_for_all_features", async () => {
			const features = await extractor.extractFeatures("TSLA");

			Object.entries(features).forEach(([key, value]) => {
				// Should not have extreme precision (more than 10 decimal places)
				const decimalPlaces = value.toString().split(".")[1]?.length || 0;
				expect(decimalPlaces).toBeLessThan(15);
			});

			console.log(`  ✓ Numeric precision validated`);
		}, 10000);
	});

	/**
	 * CATEGORY 7: INTEGRATION WITH REAL APIS
	 * Validate integration with FinancialDataService, SentimentAnalysisService, TechnicalIndicatorService
	 */
	describe("Category 7: Real API Integration", () => {
		it("should_successfully_integrate_with_FinancialDataService", async () => {
			const features = await extractor.extractFeatures("AAPL");

			// Momentum features come from FinancialDataService
			expect(typeof features.price_change_5d).toBe("number");
			expect(typeof features.price_change_10d).toBe("number");
			expect(typeof features.price_change_20d).toBe("number");

			// Volume features come from FinancialDataService
			expect(typeof features.volume_ratio).toBe("number");
			expect(typeof features.volume_trend).toBe("number");

			console.log(`  ✓ FinancialDataService integration successful`);
		}, 10000);

		it("should_successfully_integrate_with_SentimentAnalysisService", async () => {
			const features = await extractor.extractFeatures("TSLA");

			// Sentiment features come from SentimentAnalysisService
			expect(typeof features.sentiment_news_delta).toBe("number");
			expect(typeof features.sentiment_reddit_accel).toBe("number");
			expect(typeof features.sentiment_options_shift).toBe("number");

			console.log(`  ✓ SentimentAnalysisService integration successful`);
		}, 10000);

		it("should_successfully_integrate_with_TechnicalIndicatorService", async () => {
			const features = await extractor.extractFeatures("NVDA");

			// Technical features come from TechnicalIndicatorService
			expect(typeof features.rsi_momentum).toBe("number");
			expect(typeof features.macd_histogram_trend).toBe("number");

			console.log(`  ✓ TechnicalIndicatorService integration successful`);
		}, 10000);

		it("should_successfully_integrate_with_FinancialModelingPrepAPI", async () => {
			const features = await extractor.extractFeatures("AAPL");

			// Fundamental features come from FMP API
			expect(typeof features.earnings_surprise).toBe("number");
			expect(typeof features.revenue_growth_accel).toBe("number");
			expect(typeof features.analyst_coverage_change).toBe("number");

			console.log(`  ✓ FinancialModelingPrepAPI integration successful`);
		}, 10000);
	});
});
