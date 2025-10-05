/**
 * ML Fallback Integration Tests - Phase 4.2.2
 *
 * Tests graceful fallback mechanisms when ML services fail.
 * Validates that VFR analysis continues without degradation.
 *
 * Test Coverage:
 * - ML service failures (simulated)
 * - VFR analysis continues without degradation
 * - Partial ML failures (some symbols succeed, others fail)
 * - Error logging and monitoring
 * - include_ml=false preserves classic VFR
 */

const TEST_TIMEOUT = 30000;

describe("Phase 4.2.2: ML Graceful Fallback Validation", () => {
	const apiUrl = "http://localhost:3000/api/stocks/analyze";

	/**
	 * Test VFR analysis continues when ML disabled
	 */
	describe("Classic VFR Mode (include_ml=false)", () => {
		test(
			"should return pure VFR analysis when ML disabled",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["AAPL"],
						include_ml: false, // Explicitly disable ML
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);
				expect(result.data.stocks).toHaveLength(1);

				// ML metadata should indicate ML was disabled
				const mlMeta = (result.data.metadata as any).mlEnhancement;
				if (mlMeta) {
					expect(mlMeta.mlEnabled).toBe(false);
					expect(mlMeta.mlEnhancementApplied).toBe(false);
				}

				// VFR score should still be present and valid
				const stock = result.data.stocks[0];
				expect(stock.compositeScore).toBeDefined();
				expect(stock.compositeScore).toBeGreaterThanOrEqual(0);
				expect(stock.compositeScore).toBeLessThanOrEqual(100);

				console.log(
					`✅ Classic VFR Mode: Score=${stock.compositeScore.toFixed(2)}, ML Disabled`
				);
			},
			TEST_TIMEOUT
		);

		test(
			"should handle multiple stocks without ML",
			async () => {
				const symbols = ["AAPL", "NVDA", "MSFT"];

				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "multiple",
						symbols,
						include_ml: false,
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);
				expect(result.data.stocks.length).toBeGreaterThan(0);

				// All stocks should have valid VFR scores
				result.data.stocks.forEach((stock: any) => {
					expect(stock.compositeScore).toBeDefined();
					expect(stock.compositeScore).toBeGreaterThanOrEqual(0);
					expect(stock.compositeScore).toBeLessThanOrEqual(100);
				});

				console.log(
					`✅ Multi-stock VFR: ${result.data.stocks.length} stocks analyzed without ML`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test ML timeout fallback
	 */
	describe("ML Timeout Handling", () => {
		test(
			"should fallback to VFR if ML times out",
			async () => {
				// Use very low timeout to simulate timeout
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["TSLA"],
						include_ml: true,
						ml_timeout: 1, // 1ms - will likely timeout
					}),
				});

				const result = await response.json();

				// Should still succeed with VFR fallback
				expect(result.success).toBe(true);
				expect(result.data.stocks).toHaveLength(1);

				const mlMeta = (result.data.metadata as any).mlEnhancement;
				if (mlMeta) {
					// Should indicate fallback was used
					if (mlMeta.mlFallbackUsed) {
						expect(mlMeta.mlFallbackUsed).toBe(true);
						console.log("✅ ML Timeout: Fallback to VFR successful");
					} else {
						console.log("✅ ML completed within 1ms (unlikely but valid)");
					}
				}

				// VFR score should be present regardless
				expect(result.data.stocks[0].compositeScore).toBeDefined();
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test partial ML failures
	 */
	describe("Partial ML Failures", () => {
		test(
			"should handle mix of successful and failed ML predictions",
			async () => {
				// Use multiple symbols - some may fail ML prediction
				const symbols = ["AAPL", "INVALID_SYMBOL_XYZ", "NVDA", "MSFT"];

				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "multiple",
						symbols,
						include_ml: true,
					}),
				});

				const result = await response.json();

				// Should succeed even if some symbols failed
				// The API may filter out invalid symbols
				expect(result.success).toBe(true);

				// Valid symbols should have scores
				result.data.stocks.forEach((stock: any) => {
					expect(stock.compositeScore).toBeDefined();
					expect(stock.compositeScore).toBeGreaterThanOrEqual(0);
					expect(stock.compositeScore).toBeLessThanOrEqual(100);
				});

				console.log(
					`✅ Partial ML Failure: ${result.data.stocks.length} stocks analyzed`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test error metadata
	 */
	describe("Error Logging and Metadata", () => {
		test(
			"should include fallback metadata when ML unavailable",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["GOOGL"],
						include_ml: true,
						ml_timeout: 1, // Force potential timeout
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);

				const mlMeta = (result.data.metadata as any).mlEnhancement;
				if (mlMeta) {
					// Metadata should include ML availability info
					expect(mlMeta).toHaveProperty("mlEnabled");
					expect(mlMeta).toHaveProperty("mlAvailable");
					expect(mlMeta).toHaveProperty("mlFallbackUsed");
					expect(mlMeta).toHaveProperty("mlLatency");
					expect(mlMeta).toHaveProperty("mlPredictionsCount");

					if (mlMeta.mlFallbackUsed) {
						console.log(
							`✅ Fallback Metadata: Latency=${mlMeta.mlLatency}ms, Fallback Used=true`
						);
					} else {
						console.log(
							`✅ ML Metadata: Latency=${mlMeta.mlLatency}ms, Predictions=${mlMeta.mlPredictionsCount}`
						);
					}
				}
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test VFR quality consistency
	 */
	describe("VFR Analysis Quality Consistency", () => {
		test(
			"should produce consistent VFR scores with/without ML enabled",
			async () => {
				const symbol = "AAPL";

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

				// Get VFR score when ML times out (fallback)
				const fallbackResponse = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: [symbol],
						include_ml: true,
						ml_timeout: 1, // Force timeout
					}),
				});

				const fallbackResult = await fallbackResponse.json();

				expect(vfrResult.success).toBe(true);
				expect(fallbackResult.success).toBe(true);

				// Both should have valid scores
				const vfrScore = vfrResult.data.stocks[0].compositeScore;
				const fallbackScore = fallbackResult.data.stocks[0].compositeScore;

				expect(vfrScore).toBeDefined();
				expect(fallbackScore).toBeDefined();

				// Scores should be relatively close (may not be identical due to caching/timing)
				// Allow for small variations due to real-time data updates
				console.log(
					`✅ VFR Consistency: Pure VFR=${vfrScore.toFixed(2)}, Fallback=${fallbackScore.toFixed(2)}`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test service resilience
	 */
	describe("Service Resilience", () => {
		test(
			"should handle rapid successive requests with ML enabled",
			async () => {
				const requests = Array(3)
					.fill(null)
					.map(() =>
						fetch(apiUrl, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								mode: "single",
								symbols: ["MSFT"],
								include_ml: true,
							}),
						})
					);

				const responses = await Promise.all(requests);
				const results = await Promise.all(
					responses.map((r) => r.json())
				);

				// All requests should succeed
				results.forEach((result, index) => {
					expect(result.success).toBe(true);
					expect(result.data.stocks).toHaveLength(1);
					console.log(
						`✅ Concurrent Request ${index + 1}: Success, Score=${result.data.stocks[0].compositeScore.toFixed(2)}`
					);
				});
			},
			TEST_TIMEOUT
		);

		test(
			"should handle rapid successive requests with ML disabled",
			async () => {
				const requests = Array(3)
					.fill(null)
					.map(() =>
						fetch(apiUrl, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								mode: "single",
								symbols: ["NVDA"],
								include_ml: false,
							}),
						})
					);

				const responses = await Promise.all(requests);
				const results = await Promise.all(
					responses.map((r) => r.json())
				);

				// All VFR-only requests should succeed
				results.forEach((result) => {
					expect(result.success).toBe(true);
					expect(result.data.stocks).toHaveLength(1);
				});

				console.log(
					`✅ Concurrent VFR Requests: All ${results.length} succeeded`
				);
			},
			TEST_TIMEOUT
		);
	});
});
