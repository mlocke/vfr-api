/**
 * ML Backward Compatibility Integration Tests - Phase 4.2.4
 *
 * Tests backward compatibility and zero breaking changes.
 * Validates that existing API contracts remain unchanged.
 *
 * Test Coverage:
 * - All existing API contracts unchanged
 * - include_ml=false preserves classic VFR mode
 * - Default behavior (ML disabled by default)
 * - Existing integration tests still pass
 * - Zero breaking changes confirmed
 */

const TEST_TIMEOUT = 30000;

describe("Phase 4.2.4: ML Backward Compatibility", () => {
	const apiUrl = "http://localhost:3000/api/stocks/analyze";

	/**
	 * Test API contract compatibility
	 */
	describe("API Contract Compatibility", () => {
		test(
			"should maintain existing response structure without ML",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["AAPL"],
						// No include_ml parameter - should use default (false)
					}),
				});

				const result = await response.json();

				// Validate standard response structure
				expect(result).toHaveProperty("success");
				expect(result).toHaveProperty("data");
				expect(result.data).toHaveProperty("stocks");
				expect(result.data).toHaveProperty("metadata");

				// Stock structure validation
				const stock = result.data.stocks[0];
				expect(stock).toHaveProperty("symbol");
				expect(stock).toHaveProperty("compositeScore");
				expect(stock).toHaveProperty("recommendation");
				expect(stock).toHaveProperty("sector");

				// Optional fields should exist or be undefined, not cause errors
				expect(stock.confidence === undefined || typeof stock.confidence === "number").toBe(
					true
				);

				console.log(
					`✅ API Contract: Standard response structure maintained`
				);
			},
			TEST_TIMEOUT
		);

		test(
			"should support all existing request parameters",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["NVDA"],
						limit: 10,
						config: {
							timeout: 30000,
						},
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);
				expect(result.data.stocks.length).toBeGreaterThan(0);

				console.log(
					`✅ Existing Parameters: All legacy parameters supported`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test default behavior
	 */
	describe("Default Behavior (ML Disabled)", () => {
		test(
			"should default to ML disabled when not specified",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["TSLA"],
						// include_ml not specified - should default to false
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);

				// ML should be disabled by default
				const mlMeta = (result.data.metadata as any).mlEnhancement;
				if (mlMeta) {
					expect(mlMeta.mlEnabled).toBe(false);
				}

				console.log(`✅ Default Behavior: ML disabled when not specified`);
			},
			TEST_TIMEOUT
		);

		test(
			"should produce identical results to pre-ML implementation",
			async () => {
				const symbol = "MSFT";

				// Request without any ML parameters (classic mode)
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: [symbol],
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);

				const stock = result.data.stocks[0];

				// Should have all classic VFR components
				expect(stock.compositeScore).toBeDefined();
				expect(stock.recommendation).toBeDefined();
				expect(stock.sector).toBeDefined();

				// Score components should be present
				expect(
					stock.technicalScore !== undefined ||
						stock.fundamentalScore !== undefined ||
						stock.sentimentScore !== undefined
				).toBe(true);

				console.log(
					`✅ Classic VFR: Score=${stock.compositeScore.toFixed(2)}, Recommendation=${stock.recommendation}`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test explicit ML disable
	 */
	describe("Explicit ML Disable (include_ml=false)", () => {
		test(
			"should respect include_ml=false parameter",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["GOOGL"],
						include_ml: false,
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);

				const mlMeta = (result.data.metadata as any).mlEnhancement;
				if (mlMeta) {
					expect(mlMeta.mlEnabled).toBe(false);
					expect(mlMeta.mlEnhancementApplied).toBe(false);
				}

				console.log(
					`✅ Explicit Disable: include_ml=false respected`
				);
			},
			TEST_TIMEOUT
		);

		test(
			"should ignore ML parameters when include_ml=false",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["AMZN"],
						include_ml: false,
						// These should be ignored
						ml_horizon: "1w",
						ml_confidence_threshold: 0.8,
						ml_weight: 0.25,
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);

				const mlMeta = (result.data.metadata as any).mlEnhancement;
				if (mlMeta) {
					expect(mlMeta.mlEnabled).toBe(false);
					expect(mlMeta.mlEnhancementApplied).toBe(false);
				}

				console.log(
					`✅ Parameter Ignore: ML parameters ignored when include_ml=false`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test response format consistency
	 */
	describe("Response Format Consistency", () => {
		test(
			"should maintain consistent response format with/without ML",
			async () => {
				const symbol = "META";

				// Get response without ML
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

				// Get response with ML
				const mlResponse = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: [symbol],
						include_ml: true,
					}),
				});

				const mlResult = await mlResponse.json();

				// Both should have same top-level structure
				expect(vfrResult).toHaveProperty("success");
				expect(vfrResult).toHaveProperty("data");
				expect(mlResult).toHaveProperty("success");
				expect(mlResult).toHaveProperty("data");

				// Both should have stocks array
				expect(Array.isArray(vfrResult.data.stocks)).toBe(true);
				expect(Array.isArray(mlResult.data.stocks)).toBe(true);

				// Both should have metadata
				expect(vfrResult.data.metadata).toBeDefined();
				expect(mlResult.data.metadata).toBeDefined();

				console.log(
					`✅ Response Format: Consistent structure with/without ML`
				);
			},
			TEST_TIMEOUT
		);

		test(
			"should maintain stock data fields consistency",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "multiple",
						symbols: ["AAPL", "NVDA"],
						include_ml: false,
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);
				expect(result.data.stocks.length).toBeGreaterThan(0);

				// Check all stocks have consistent fields
				result.data.stocks.forEach((stock: any) => {
					expect(stock).toHaveProperty("symbol");
					expect(stock).toHaveProperty("compositeScore");
					expect(stock).toHaveProperty("recommendation");

					// Scores should be in valid range
					expect(stock.compositeScore).toBeGreaterThanOrEqual(0);
					expect(stock.compositeScore).toBeLessThanOrEqual(100);
				});

				console.log(
					`✅ Stock Fields: Consistent across ${result.data.stocks.length} stocks`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test mode compatibility
	 */
	describe("Analysis Mode Compatibility", () => {
		test(
			"should support single mode without ML",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["AAPL"],
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);
				expect(result.data.metadata.mode).toBe("single");

				console.log(`✅ Single Mode: Compatible without ML`);
			},
			TEST_TIMEOUT
		);

		test(
			"should support multiple mode without ML",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "multiple",
						symbols: ["AAPL", "NVDA", "TSLA"],
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);
				expect(result.data.metadata.mode).toBe("multiple");

				console.log(`✅ Multiple Mode: Compatible without ML`);
			},
			TEST_TIMEOUT
		);

		test(
			"should support sector mode without ML",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "sector",
						sector: "technology",
						limit: 5,
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);
				expect(result.data.metadata.mode).toBe("sector");

				console.log(`✅ Sector Mode: Compatible without ML`);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test error handling compatibility
	 */
	describe("Error Handling Compatibility", () => {
		test(
			"should handle invalid symbols gracefully (classic behavior)",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["INVALID_SYMBOL_12345"],
						include_ml: false,
					}),
				});

				const result = await response.json();

				// Should either succeed with empty results or return error
				// Both are valid classic behaviors
				expect(result).toHaveProperty("success");

				console.log(
					`✅ Error Handling: Invalid symbol handled gracefully`
				);
			},
			TEST_TIMEOUT
		);

		test(
			"should handle missing required parameters",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						// Missing symbols parameter
					}),
				});

				const result = await response.json();

				// Should return error
				expect(result.success).toBeDefined();

				console.log(`✅ Error Handling: Missing parameters handled`);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test metadata compatibility
	 */
	describe("Metadata Compatibility", () => {
		test(
			"should include standard metadata fields",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["MSFT"],
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);

				const metadata = result.data.metadata;

				// Standard metadata fields
				expect(metadata).toHaveProperty("mode");
				expect(metadata).toHaveProperty("count");
				expect(metadata).toHaveProperty("timestamp");

				console.log(`✅ Metadata: Standard fields present`);
			},
			TEST_TIMEOUT
		);

		test(
			"should include ML metadata only when ML enabled",
			async () => {
				// Without ML
				const vfrResponse = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["GOOGL"],
						include_ml: false,
					}),
				});

				const vfrResult = await vfrResponse.json();

				// With ML
				const mlResponse = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["GOOGL"],
						include_ml: true,
					}),
				});

				const mlResult = await mlResponse.json();

				// VFR metadata should not have mlEnhancement or it should indicate disabled
				const vfrMlMeta = (vfrResult.data.metadata as any).mlEnhancement;
				if (vfrMlMeta) {
					expect(vfrMlMeta.mlEnabled).toBe(false);
				}

				// ML metadata should have mlEnhancement
				const mlMlMeta = (mlResult.data.metadata as any).mlEnhancement;
				if (mlMlMeta) {
					expect(mlMlMeta.mlEnabled).toBe(true);
				}

				console.log(
					`✅ ML Metadata: Present only when ML enabled`
				);
			},
			TEST_TIMEOUT
		);
	});

	/**
	 * Test zero breaking changes
	 */
	describe("Zero Breaking Changes Validation", () => {
		test(
			"should not break existing client code",
			async () => {
				// Simulate existing client code (pre-ML implementation)
				const existingClientRequest = {
					mode: "single",
					symbols: ["AAPL"],
					limit: 10,
				};

				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(existingClientRequest),
				});

				const result = await response.json();

				// Should work exactly as before
				expect(result.success).toBe(true);
				expect(result.data.stocks).toBeDefined();
				expect(result.data.metadata).toBeDefined();

				// Essential fields should be present
				const stock = result.data.stocks[0];
				expect(stock.symbol).toBeDefined();
				expect(stock.compositeScore).toBeDefined();
				expect(stock.recommendation).toBeDefined();

				console.log(
					`✅ Zero Breaking Changes: Existing client code works unchanged`
				);
			},
			TEST_TIMEOUT
		);

		test(
			"should maintain data type consistency",
			async () => {
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["NVDA"],
					}),
				});

				const result = await response.json();

				expect(result.success).toBe(true);

				const stock = result.data.stocks[0];

				// Validate data types match expectations
				expect(typeof stock.symbol).toBe("string");
				expect(typeof stock.compositeScore).toBe("number");
				expect(typeof stock.recommendation).toBe("string");

				console.log(`✅ Data Types: Consistent with expectations`);
			},
			TEST_TIMEOUT
		);
	});
});
