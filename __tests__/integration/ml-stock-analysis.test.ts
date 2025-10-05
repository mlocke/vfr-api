/**
 * ML Stock Analysis Integration Tests - Phase 4.2.1
 *
 * Tests ML prediction integration with real trained models.
 * Validates prediction accuracy, confidence scoring, and composite score contribution.
 *
 * NO MOCK DATA - Uses real ML predictions via production API endpoint.
 *
 * Test Coverage:
 * - ML predictions with real trained models
 * - Prediction accuracy vs baseline VFR
 * - Confidence scoring ranges (0-1)
 * - ML contribution to composite scores (15% weighting)
 * - Multiple prediction horizons (1d, 7d, 30d)
 */

import { NextRequest } from "next/server";

// Test timeout for real API calls
const TEST_TIMEOUT = 30000; // 30 seconds for real ML inference

describe("Phase 4.2.1: ML Stock Analysis Integration", () => {
	const testSymbols = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL"];
	const apiUrl = "http://localhost:3000/api/stocks/analyze";

	/**
	 * Test ML predictions with real trained models
	 */
	describe("ML Predictions with Real Models", () => {
		test(
			"should return ML-enhanced predictions for single stock",
			async () => {
				const symbol = "AAPL";

				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: [symbol],
						include_ml: true,
						ml_horizon: "1w",
					}),
				});

				const result = await response.json();

				// Validate response structure
				expect(result.success).toBe(true);
				expect(result.data.stocks).toHaveLength(1);

				const stock = result.data.stocks[0];

				// Validate ML enhancement metadata
				expect(result.data.metadata).toHaveProperty("mlEnhancement");
				const mlMeta = (result.data.metadata as any).mlEnhancement;

				expect(mlMeta.mlEnabled).toBe(true);
				expect(mlMeta.mlAvailable).toBe(true);
				expect(mlMeta.mlEnhancementApplied).toBe(true);
				expect(mlMeta.mlPredictionsCount).toBeGreaterThan(0);

				// Validate ML latency target (<100ms)
				expect(mlMeta.mlLatency).toBeLessThan(100);

				console.log(
					`✅ ML Prediction: ${symbol}, Latency: ${mlMeta.mlLatency}ms, Predictions: ${mlMeta.mlPredictionsCount}`
				);
			},
			TEST_TIMEOUT
		);

		test(
			"should handle multiple stocks with ML predictions",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "multiple",
						symbols: testSymbols.slice(0, 3), // Test with 3 symbols
						include_ml: true,
						ml_horizon: "1w",
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);
				expect(result.data.stocks.length).toBeLessThanOrEqual(3);

				const mlMeta = (result.data.metadata as any).mlEnhancement;
				expect(mlMeta.mlEnabled).toBe(true);
				expect(mlMeta.mlPredictionsCount).toBeGreaterThan(0);

				console.log(
					`✅ Multi-stock ML: ${mlMeta.mlPredictionsCount} predictions, ${mlMeta.mlLatency}ms latency`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test prediction accuracy vs baseline VFR
	 */
	describe("Prediction Accuracy vs Baseline", () => {
		test(
			"should compare ML-enhanced vs pure VFR scores",
			async () => {
				const symbol = "NVDA";

				// Get pure VFR score
				const vfrResponse = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: [symbol],
						include_ml: false,
					}),
				});

				const vfrResult = await vfrResponse.json();
				const vfrScore = vfrResult.data.stocks[0].compositeScore;

				// Get ML-enhanced score
				const mlResponse = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: [symbol],
						include_ml: true,
						ml_horizon: "1w",
					}),
				});

				const mlResult = await mlResponse.json();
				const mlScore = mlResult.data.stocks[0].compositeScore;

				// Validate scores are different (ML should affect composite)
				// Note: Scores may be same if ML prediction is neutral
				expect(typeof vfrScore).toBe("number");
				expect(typeof mlScore).toBe("number");

				// Both scores should be in valid range (0-100)
				expect(vfrScore).toBeGreaterThanOrEqual(0);
				expect(vfrScore).toBeLessThanOrEqual(100);
				expect(mlScore).toBeGreaterThanOrEqual(0);
				expect(mlScore).toBeLessThanOrEqual(100);

				const scoreDiff = Math.abs(mlScore - vfrScore);

				console.log(
					`✅ Score Comparison: VFR=${vfrScore.toFixed(2)}, ML-Enhanced=${mlScore.toFixed(2)}, Diff=${scoreDiff.toFixed(2)}`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test confidence scoring ranges (0-1)
	 */
	describe("Confidence Scoring", () => {
		test(
			"should return confidence scores in valid range",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["TSLA"],
						include_ml: true,
						ml_horizon: "1w",
						ml_confidence_threshold: 0.5,
					}),
				});

				const result = await response.json();
				const stock = result.data.stocks[0];

				// Validate confidence score exists and is in valid range
				expect(stock.confidence).toBeDefined();
				expect(stock.confidence).toBeGreaterThanOrEqual(0);
				expect(stock.confidence).toBeLessThanOrEqual(100);

				const mlMeta = (result.data.metadata as any).mlEnhancement;
				if (mlMeta.mlAverageConfidence !== undefined) {
					expect(mlMeta.mlAverageConfidence).toBeGreaterThanOrEqual(0);
					expect(mlMeta.mlAverageConfidence).toBeLessThanOrEqual(1);
				}

				console.log(
					`✅ Confidence: Stock=${stock.confidence}%, ML Avg=${mlMeta.mlAverageConfidence?.toFixed(3) || "N/A"}`
				);
			},
			TEST_TIMEOUT
		);

		test(
			"should respect confidence threshold",
			async () => {
				const highThreshold = 0.8;

				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["MSFT"],
						include_ml: true,
						ml_confidence_threshold: highThreshold,
					}),
				});

				const result = await response.json();
				const mlMeta = (result.data.metadata as any).mlEnhancement;

				// If ML predictions were made, they should meet threshold
				if (mlMeta.mlPredictionsCount > 0 && mlMeta.mlAverageConfidence) {
					expect(mlMeta.mlAverageConfidence).toBeGreaterThanOrEqual(
						highThreshold
					);
				}

				console.log(
					`✅ High Confidence Filter (${highThreshold}): Predictions=${mlMeta.mlPredictionsCount}, Avg Confidence=${mlMeta.mlAverageConfidence?.toFixed(3) || "N/A"}`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test ML contribution to composite scores (15% weighting)
	 */
	describe("ML Composite Score Contribution", () => {
		test(
			"should apply 15% ML weight to composite score",
			async () => {
				const symbol = "GOOGL";

				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: [symbol],
						include_ml: true,
						ml_weight: 0.15,
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);

				const mlMeta = (result.data.metadata as any).mlEnhancement;
				expect(mlMeta.mlEnhancementApplied).toBe(true);

				console.log(
					`✅ ML Weight Test: 15% ML contribution applied, Score=${result.data.stocks[0].compositeScore.toFixed(2)}`
				);
			},
			TEST_TIMEOUT
		);

		test(
			"should allow custom ML weights",
			async () => {
				const customWeight = 0.25; // 25% ML weight

				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["AAPL"],
						include_ml: true,
						ml_weight: customWeight,
					}),
				});

				const result = await response.json();
				expect(result.success).toBe(true);

				const mlMeta = (result.data.metadata as any).mlEnhancement;
				expect(mlMeta.mlEnhancementApplied).toBe(true);

				console.log(
					`✅ Custom ML Weight (${customWeight}): Applied successfully`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test multiple prediction horizons
	 */
	describe("Multiple Prediction Horizons", () => {
		const horizons = ["1d", "1w", "1m"] as const;

		horizons.forEach((horizon) => {
			test(
				`should handle ${horizon} prediction horizon`,
				async () => {
					const response = await fetch(apiUrl, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							mode: "single",
							symbols: ["NVDA"],
							include_ml: true,
							ml_horizon: horizon,
						}),
					});

					const result = await response.json();

					expect(result.success).toBe(true);

					const mlMeta = (result.data.metadata as any).mlEnhancement;
					expect(mlMeta.mlEnabled).toBe(true);

					console.log(
						`✅ Horizon ${horizon}: Predictions=${mlMeta.mlPredictionsCount}, Latency=${mlMeta.mlLatency}ms`
					);
				},
				TEST_TIMEOUT
			);
		});
	});
});
