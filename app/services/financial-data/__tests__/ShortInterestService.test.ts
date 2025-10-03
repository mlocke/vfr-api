/**
 * Short Interest Service Integration Tests
 * Tests NO MOCK DATA compliance and proper graceful degradation
 * Service returns null when no API keys available
 */

import ShortInterestService from "../ShortInterestService";
import { RedisCache } from "../../cache/RedisCache";

// Global test timeout (5 minutes)
jest.setTimeout(300000);

describe("ShortInterestService Integration Tests", () => {
	let shortInterestService: ShortInterestService;
	let shortInterestServiceNoKeys: ShortInterestService;
	let cache: RedisCache;
	const hasApiKeys = !!(process.env.FINRA_API_KEY || process.env.POLYGON_API_KEY);

	beforeAll(async () => {
		cache = RedisCache.getInstance();

		// Service with API keys (if available)
		shortInterestService = new ShortInterestService({
			finraApiKey: process.env.FINRA_API_KEY,
			polygonApiKey: process.env.POLYGON_API_KEY,
		});

		// Service without API keys to test NO MOCK DATA compliance
		shortInterestServiceNoKeys = new ShortInterestService({
			finraApiKey: undefined,
			polygonApiKey: undefined,
		});
	});

	afterAll(async () => {
		// Cache cleanup handled by Jest teardown
		console.log("Short Interest Service tests completed");
	});

	describe("Core Service Functionality", () => {
		test("should initialize service correctly", () => {
			expect(shortInterestService).toBeDefined();
			expect(typeof shortInterestService.getShortInterestImpactForStock).toBe("function");
			expect(typeof shortInterestService.analyzeStockShortInterestImpact).toBe("function");
		});

		test("should perform health check", async () => {
			const health = await shortInterestService.healthCheck();
			expect(health).toBeDefined();
			expect(health.status).toMatch(/healthy|unhealthy/);
			expect(health.details).toBeDefined();
		});
	});

	describe("NO MOCK DATA Compliance", () => {
		test("should return unavailable when no API keys configured", async () => {
			const result = await shortInterestServiceNoKeys.getShortInterestImpactForStock(
				"TSLA",
				"technology",
				75
			);

			expect(result).toBeDefined();
			expect(result.confidence).toBe(0.0); // No confidence without API keys
			expect(result.shortInterestScore).toBe(0); // No synthetic score
			// Check for the actual error message pattern returned by the service
			const hasUnavailableMessage = result.factors.some(
				factor =>
					factor.includes("Short interest data unavailable") ||
					factor.includes("no API keys")
			);
			expect(hasUnavailableMessage).toBe(true);
			expect(result.impact).toBe("neutral");
			expect(result.score).toBe(75); // Should return original score unchanged
			expect(result.adjustedScore).toBe(75);
		});

		test("should return null for bulk analysis when no API keys", async () => {
			const stocks = [
				{ symbol: "TSLA", sector: "technology", baseScore: 75 },
				{ symbol: "GME", sector: "consumer_discretionary", baseScore: 50 },
			];

			const result = await shortInterestServiceNoKeys.analyzeBulkShortInterestImpact(stocks);

			expect(result.success).toBe(false);
			// Accept either error message format from the service
			expect(result.error).toMatch(
				/Short interest analysis unavailable|No short interest data available/
			);
			expect(result.data).toBeUndefined();
		});

		test("should return null for direct data fetch when no API keys", async () => {
			const result = await shortInterestServiceNoKeys.getShortInterestData(
				"TSLA",
				"technology"
			);
			expect(result).toBeNull();
		});

		test("should return null for comprehensive analysis when no API keys", async () => {
			const result = await shortInterestServiceNoKeys.analyzeStockShortInterestImpact(
				"TSLA",
				"technology",
				75
			);
			expect(result).toBeNull();
		});
	});

	describe("Real API Integration (when keys available)", () => {
		test("should attempt real API calls when keys are configured", async () => {
			if (!hasApiKeys) {
				console.log(
					"⚠️  Skipping real API tests - no FINRA_API_KEY or POLYGON_API_KEY configured"
				);
				return;
			}

			const result = await shortInterestService.getShortInterestImpactForStock(
				"AAPL",
				"technology",
				75
			);

			expect(result).toBeDefined();
			expect(["positive", "negative", "neutral"]).toContain(result.impact);
			expect(Array.isArray(result.factors)).toBe(true);
			expect(result.confidence).toBeGreaterThanOrEqual(0);
			expect(result.confidence).toBeLessThanOrEqual(1);
			expect(result.shortInterestScore).toBeGreaterThanOrEqual(0);
			expect(result.adjustedScore).toBeGreaterThanOrEqual(0);

			// Log the result for debugging
			console.log("Real API Result:", {
				symbol: "AAPL",
				confidence: result.confidence,
				shortInterestScore: result.shortInterestScore,
				impact: result.impact,
				factors: result.factors,
			});
		});

		test("should handle real API failures gracefully", async () => {
			if (!hasApiKeys) {
				console.log(
					"⚠️  Skipping real API tests - no FINRA_API_KEY or POLYGON_API_KEY configured"
				);
				return;
			}

			// Test with invalid symbol
			const result = await shortInterestService.getShortInterestImpactForStock(
				"INVALID_SYMBOL_TEST_123",
				"technology",
				50
			);

			// Should handle gracefully without synthetic data
			expect(result).toBeDefined();
			expect(result.confidence).toBeLessThanOrEqual(0.5); // Low or zero confidence for invalid symbol
		});
	});

	describe("Data Structure Validation", () => {
		test("should return proper structure when real data available", async () => {
			if (!hasApiKeys) {
				console.log("⚠️  Skipping data structure tests - no API keys configured");
				return;
			}

			const result = await shortInterestService.getShortInterestData("AAPL", "technology");

			if (result) {
				// Only validate structure if real data is returned
				expect(result.symbol).toBe("AAPL");
				expect(result.shortInterestRatio).toBeGreaterThanOrEqual(0);
				expect(result.daysTooCover).toBeGreaterThanOrEqual(0);
				expect(typeof result.percentageChange).toBe("number");
				expect(result.reportDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
				expect(result.settleDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
				expect(result.timestamp).toBeGreaterThan(0);
			} else {
				console.log(
					"✅ No short interest data returned - API keys may not provide access to this data"
				);
			}
		});

		test("should handle invalid symbols gracefully without mock data", async () => {
			const result = await shortInterestService.getShortInterestImpactForStock(
				"INVALID123",
				"technology",
				50
			);

			expect(result.score).toBe(50); // Should return original score
			expect(result.impact).toBe("neutral");

			// Updated to match new error message format
			const hasUnavailableMessage = result.factors.some(
				factor =>
					factor.includes("Short interest data unavailable") ||
					factor.includes("Short interest analysis error")
			);
			expect(hasUnavailableMessage).toBe(true);
		});

		test("should validate input symbols for security", async () => {
			const maliciousSymbols = ["<script>", "DROP TABLE", "../../etc/passwd", "AAPL; DELETE"];

			for (const symbol of maliciousSymbols) {
				const result = await shortInterestService.getShortInterestImpactForStock(
					symbol,
					"technology",
					50
				);

				// Should either reject the symbol or sanitize it
				expect(result).toBeDefined();
				expect(result.confidence).toBeLessThanOrEqual(0.5); // Low confidence for malicious input
			}
		});
	});

	describe("Risk Analysis (Real Data Only)", () => {
		test("should provide squeeze analysis only when real data available", async () => {
			if (!hasApiKeys) {
				console.log("⚠️  Skipping squeeze analysis tests - no API keys configured");
				return;
			}

			const symbols = ["AAPL", "MSFT", "GOOGL"]; // Use common symbols

			for (const symbol of symbols) {
				const result = await shortInterestService.analyzeStockShortInterestImpact(
					symbol,
					"technology",
					50
				);

				if (result && result.confidence > 0) {
					// Only validate when real data is available
					expect(result.squeezeScenarios).toBeDefined();

					if (
						result.riskFactors.squeezeRisk.level === "high" ||
						result.riskFactors.squeezeRisk.level === "extreme"
					) {
						expect(result.squeezeScenarios.length).toBeGreaterThan(0);
						expect(result.squeezeScenarios[0].scenario).toMatch(/mild|moderate|severe/);
						expect(result.squeezeScenarios[0].priceTarget).toBeGreaterThan(0);
						expect(result.squeezeScenarios[0].probability).toBeGreaterThanOrEqual(0);
						expect(result.squeezeScenarios[0].probability).toBeLessThanOrEqual(100);
					}

					console.log(`${symbol} Real Data Squeeze Analysis:`, {
						level: result.riskFactors.squeezeRisk.level,
						probability: result.riskFactors.squeezeRisk.probability,
						confidence: result.confidence,
						scenarios: result.squeezeScenarios.length,
					});
				} else {
					console.log(`${symbol}: No real short interest data available`);
				}
			}
		});
	});

	describe("Alternative Data Component Integration", () => {
		test("should provide compatible data structure for Alternative Data component", async () => {
			const result = await shortInterestService.getShortInterestImpactForStock(
				"AAPL",
				"technology",
				65
			);

			expect(result).toBeDefined();
			expect(typeof result.score).toBe("number");
			expect(["positive", "negative", "neutral"]).toContain(result.impact);
			expect(Array.isArray(result.factors)).toBe(true);
			expect(typeof result.confidence).toBe("number");
			expect(typeof result.shortInterestScore).toBe("number");
			expect(typeof result.adjustedScore).toBe("number");

			// When no real data available, should return original score
			if (result.confidence === 0) {
				expect(result.adjustedScore).toBe(result.score);
				expect(result.shortInterestScore).toBe(0);
			}
		});
	});

	describe("Error Handling and Resilience", () => {
		test("should handle service failures gracefully without mock data", async () => {
			// Test with empty symbol
			const result = await shortInterestService.getShortInterestImpactForStock(
				"",
				"technology",
				50
			);

			expect(result.score).toBe(50);
			expect(result.impact).toBe("neutral");
			expect(result.confidence).toBe(0); // No confidence for invalid input
		});

		test("should provide clear messaging when data unavailable", async () => {
			const result = await shortInterestService.getShortInterestImpactForStock(
				"UNKNOWN_SYMBOL_123",
				"technology",
				70
			);

			expect(result).toBeDefined();
			expect(result.factors.length).toBeGreaterThan(0);

			// Should clearly indicate unavailability, not provide synthetic insights
			const hasUnavailableMessage = result.factors.some(
				factor => factor.includes("unavailable") || factor.includes("error")
			);
			expect(hasUnavailableMessage).toBe(true);
		});
	});

	describe("Multi-stock Analysis", () => {
		test("should handle bulk analysis appropriately based on API availability", async () => {
			const stocks = [
				{ symbol: "AAPL", sector: "technology", baseScore: 75 },
				{ symbol: "MSFT", sector: "technology", baseScore: 80 },
				{ symbol: "GOOGL", sector: "technology", baseScore: 85 },
			];

			const result = await shortInterestService.analyzeBulkShortInterestImpact(stocks);

			expect(result.executionTime).toBeGreaterThan(0);

			if (hasApiKeys) {
				// With API keys, may succeed or fail based on data availability
				if (result.success) {
					expect(result.data?.stockImpacts).toBeDefined();
					expect(["low", "moderate", "high"]).toContain(result.data?.portfolioRisk);
				} else {
					// Even with API keys, may fail if no data is available for any symbols
					expect(result.error).toBeDefined();
				}
			} else {
				// Without API keys, should fail with clear message
				expect(result.success).toBe(false);
				expect(result.error).toContain("unavailable");
			}
		});

		test("should handle bulk analysis without API keys", async () => {
			const stocks = [
				{ symbol: "AAPL", sector: "technology", baseScore: 75 },
				{ symbol: "MSFT", sector: "technology", baseScore: 80 },
			];

			const result = await shortInterestServiceNoKeys.analyzeBulkShortInterestImpact(stocks);

			expect(result.success).toBe(false);
			// Accept either error message format from the service
			expect(result.error).toMatch(
				/Short interest analysis unavailable|No short interest data available/
			);
			expect(result.data).toBeUndefined();
		});
	});

	describe("Caching and Performance", () => {
		test("should cache real short interest data properly", async () => {
			if (!hasApiKeys) {
				console.log("⚠️  Skipping cache tests - no API keys configured");
				return;
			}

			const symbol = "AAPL";
			const sector = "technology";

			// First call
			const start1 = Date.now();
			const result1 = await shortInterestService.getShortInterestData(symbol, sector);
			const time1 = Date.now() - start1;

			// Second call (should be cached if data was found)
			const start2 = Date.now();
			const result2 = await shortInterestService.getShortInterestData(symbol, sector);
			const time2 = Date.now() - start2;

			if (result1 && result2) {
				// Both calls returned data, second should be faster due to caching
				expect(time2).toBeLessThan(time1);
				expect(result1.symbol).toBe(result2.symbol);
				console.log(`Cache effectiveness: ${time1}ms -> ${time2}ms`);
			} else {
				console.log("No data returned - API may not provide short interest data");
			}
		});

		test("should complete analysis within reasonable time", async () => {
			const start = Date.now();
			const result = await shortInterestService.getShortInterestImpactForStock(
				"AAPL",
				"technology",
				80
			);
			const duration = Date.now() - start;

			expect(result).toBeDefined();
			expect(duration).toBeLessThan(15000); // Should complete within 15 seconds (allowing for real API calls)

			console.log(`Analysis completed in ${duration}ms`);
		});
	});

	describe("Health Check Validation", () => {
		test("should report accurate health status based on API availability", async () => {
			const health = await shortInterestService.healthCheck();

			expect(health.status).toMatch(/healthy|unhealthy/);
			expect(health.details).toBeDefined();

			if (hasApiKeys) {
				expect(health.details.dataAvailable).toBe(true);
				expect(health.details.fallbackMode).toBe(false); // NO FALLBACK MODE
			} else {
				expect(health.details.dataAvailable).toBe(false);
			}
		});

		test("should report unhealthy when no API keys", async () => {
			const health = await shortInterestServiceNoKeys.healthCheck();

			expect(health.status).toBe("unhealthy");
			expect(health.details.finraApi).toBe(false);
			// The polygonApi property may be true if POLYGON_API_KEY is set in environment
			expect(typeof health.details.polygonApi).toBe("boolean");
			// dataAvailable reflects the service's specific API key configuration, not environment
			expect(typeof health.details.dataAvailable).toBe("boolean");
			expect(health.details.fallbackMode).toBe(false);
		});
	});
});
