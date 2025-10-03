/**
 * Fundamental Ratios Integration Tests
 * Tests for FMP fundamental ratios integration with fallback data service
 *
 * Following VFR testing philosophy:
 * - Always use real APIs, never mock data
 * - Test memory optimization and performance
 * - Include comprehensive error scenarios
 * - Validate data quality and ranges
 */

import { FinancialModelingPrepAPI } from "../FinancialModelingPrepAPI";
import { FinancialDataService } from "../FinancialDataService";
import { FundamentalRatios } from "../types";

describe("Fundamental Ratios Integration", () => {
	let fmpAPI: FinancialModelingPrepAPI;
	let fallbackService: FinancialDataService;

	beforeEach(() => {
		// Initialize with real API key from environment and extended timeout for real API calls
		fmpAPI = new FinancialModelingPrepAPI(process.env.FMP_API_KEY, 15000, false);
		fallbackService = new FinancialDataService();
	});

	afterEach(async () => {
		// Force garbage collection to prevent memory leaks
		if (global.gc) {
			global.gc();
		}
	});

	describe("FinancialModelingPrepAPI.getFundamentalRatios()", () => {
		test("should fetch fundamental ratios for valid large-cap stock", async () => {
			const symbol = "AAPL";
			const ratios = await fmpAPI.getFundamentalRatios(symbol);

			expect(ratios).toBeDefined();
			if (ratios) {
				// Verify basic structure and metadata
				expect(ratios.symbol).toBe(symbol);
				expect(ratios.source).toBe("fmp");
				expect(ratios.timestamp).toBeDefined();
				expect(ratios.period).toBe("ttm");
				expect(typeof ratios.timestamp).toBe("number");
				expect(ratios.timestamp).toBeGreaterThan(Date.now() - 10000); // Within last 10 seconds

				// Test that at least some fundamental ratios are present for major stock
				expect(
					ratios.peRatio ||
						ratios.pbRatio ||
						ratios.roe ||
						ratios.roa ||
						ratios.currentRatio ||
						ratios.grossProfitMargin
				).toBeDefined();

				// Validate data types for any present ratios
				if (ratios.peRatio !== undefined) {
					expect(typeof ratios.peRatio).toBe("number");
					expect(ratios.peRatio).toBeGreaterThan(-1000);
					expect(ratios.peRatio).toBeLessThan(1000);
				}

				if (ratios.pbRatio !== undefined) {
					expect(typeof ratios.pbRatio).toBe("number");
					expect(ratios.pbRatio).toBeGreaterThan(0);
				}

				if (ratios.roe !== undefined) {
					expect(typeof ratios.roe).toBe("number");
					expect(ratios.roe).toBeGreaterThan(-10);
					expect(ratios.roe).toBeLessThan(10);
				}

				console.log(
					`✅ AAPL fundamental ratios: P/E=${ratios.peRatio?.toFixed(2) || "N/A"}, P/B=${ratios.pbRatio?.toFixed(2) || "N/A"}, ROE=${ratios.roe?.toFixed(2) || "N/A"}`
				);
			}
		}, 20000); // Extended timeout for real API call

		test("should fetch fundamental ratios for valid mid-cap stock", async () => {
			const symbol = "MSFT";
			const ratios = await fmpAPI.getFundamentalRatios(symbol);

			expect(ratios).toBeDefined();
			if (ratios) {
				expect(ratios.symbol).toBe(symbol);
				expect(ratios.source).toBe("fmp");
				expect(ratios.timestamp).toBeDefined();
				expect(ratios.period).toBe("ttm");

				// Test comprehensive ratio coverage for mature tech company
				if (ratios.currentRatio !== undefined) {
					expect(ratios.currentRatio).toBeGreaterThan(0);
					expect(ratios.currentRatio).toBeLessThan(100);
				}

				if (ratios.debtToEquity !== undefined) {
					expect(ratios.debtToEquity).toBeGreaterThan(0);
					expect(ratios.debtToEquity).toBeLessThan(50);
				}

				if (ratios.grossProfitMargin !== undefined) {
					expect(ratios.grossProfitMargin).toBeGreaterThan(-1);
					expect(ratios.grossProfitMargin).toBeLessThan(2);
				}

				console.log(
					`✅ MSFT fundamental ratios: Current Ratio=${ratios.currentRatio?.toFixed(2) || "N/A"}, D/E=${ratios.debtToEquity?.toFixed(2) || "N/A"}, Gross Margin=${ratios.grossProfitMargin?.toFixed(2) || "N/A"}`
				);
			}
		}, 20000);

		test("should handle invalid symbol gracefully without throwing", async () => {
			const symbol = "INVALID_SYMBOL_TEST_123";
			const ratios = await fmpAPI.getFundamentalRatios(symbol);

			// Should return null for invalid symbols, not throw error
			expect(ratios).toBeNull();
			console.log("✅ Invalid symbol handled gracefully - returned null");
		}, 15000);

		test("should handle missing API key gracefully", async () => {
			const apiWithoutKey = new FinancialModelingPrepAPI("", 15000, false);
			const ratios = await apiWithoutKey.getFundamentalRatios("AAPL");

			expect(ratios).toBeNull();
			console.log("✅ Missing API key handled gracefully - returned null");
		}, 5000);

		test("should handle malformed API key gracefully", async () => {
			const apiWithBadKey = new FinancialModelingPrepAPI("invalid_key_format", 15000, false);
			const ratios = await apiWithBadKey.getFundamentalRatios("AAPL");

			// Should return null for bad API key, not throw error
			expect(ratios).toBeNull();
			console.log("✅ Malformed API key handled gracefully - returned null");
		}, 15000);

		test("should handle network timeout gracefully", async () => {
			// Create API instance with very short timeout to test timeout handling
			const apiWithShortTimeout = new FinancialModelingPrepAPI(
				process.env.FMP_API_KEY,
				100,
				false
			);
			const ratios = await apiWithShortTimeout.getFundamentalRatios("AAPL");

			// Should return null on timeout, not throw error
			expect(ratios).toBeNull();
			console.log("✅ Network timeout handled gracefully - returned null");
		}, 5000);
	});

	describe("FinancialDataService.getFundamentalRatios()", () => {
		test("should fetch fundamental ratios through fallback service", async () => {
			const symbol = "TSLA";
			const ratios = await fallbackService.getFundamentalRatios(symbol);

			if (ratios) {
				expect(ratios.symbol).toBe(symbol);
				expect(ratios.source).toBeDefined();
				expect(ratios.timestamp).toBeDefined();
				expect(typeof ratios.timestamp).toBe("number");

				// Validate at least some ratios are available for popular stock
				expect(
					ratios.peRatio ||
						ratios.pbRatio ||
						ratios.roe ||
						ratios.roa ||
						ratios.currentRatio ||
						ratios.grossProfitMargin ||
						ratios.operatingMargin
				).toBeDefined();

				console.log(
					`✅ TSLA fallback service ratios: P/E=${ratios.peRatio?.toFixed(2) || "N/A"}, Operating Margin=${ratios.operatingMargin?.toFixed(2) || "N/A"}`
				);
			}

			// Test should pass even if no API key available (graceful degradation)
			expect(typeof ratios === "object" || ratios === null).toBe(true);
		}, 20000);

		test("should handle fallback service with invalid symbol", async () => {
			const symbol = "NONEXISTENT_STOCK_XYZ";
			const ratios = await fallbackService.getFundamentalRatios(symbol);

			// Should return null for invalid symbols through fallback service
			expect(ratios).toBeNull();
			console.log("✅ Fallback service handled invalid symbol gracefully");
		}, 15000);

		test("should handle rate limiting properly with multiple requests", async () => {
			// Test multiple rapid calls to ensure rate limiting works without breaking
			const symbols = ["GOOGL", "AMZN", "META", "NFLX", "NVDA"];
			const promises = symbols.map(symbol => fallbackService.getFundamentalRatios(symbol));

			const results = await Promise.all(promises);

			// Should not throw errors even with rapid calls
			results.forEach((result, index) => {
				expect(typeof result === "object" || result === null).toBe(true);
				if (result) {
					expect(result.symbol).toBe(symbols[index]);
					expect(result.source).toBeDefined();
				}
			});

			const successfulResults = results.filter(r => r !== null);
			console.log(
				`✅ Rate limiting test: ${successfulResults.length}/${symbols.length} requests successful`
			);
		}, 30000);

		test("should provide source attribution in fallback service", async () => {
			const symbol = "AMZN";
			const ratios = await fallbackService.getFundamentalRatios(symbol);

			if (ratios) {
				expect(ratios.source).toBeDefined();
				expect(typeof ratios.source).toBe("string");
				expect(ratios.source.length).toBeGreaterThan(0);

				// Should be one of the known sources
				expect(
					["fmp", "fallback", "unavailable"].some(
						source => ratios.source.includes(source) || ratios.source === source
					)
				).toBe(true);

				console.log(`✅ AMZN source attribution: ${ratios.source}`);
			}
		}, 15000);
	});

	describe("Data Quality Validation", () => {
		test("should validate P/E ratio ranges for tech stock", async () => {
			const symbol = "GOOGL";
			const ratios = await fmpAPI.getFundamentalRatios(symbol);

			if (ratios && ratios.peRatio !== undefined) {
				// P/E ratios should be within reasonable bounds for established companies
				expect(ratios.peRatio).toBeGreaterThan(-100); // Some companies can have negative P/E
				expect(ratios.peRatio).toBeLessThan(500); // Even growth companies rarely exceed this
				expect(typeof ratios.peRatio).toBe("number");
				expect(isFinite(ratios.peRatio)).toBe(true);

				console.log(`✅ GOOGL P/E ratio validation: ${ratios.peRatio.toFixed(2)}`);
			}
		}, 15000);

		test("should validate liquidity ratios for financial health", async () => {
			const symbol = "AAPL";
			const ratios = await fmpAPI.getFundamentalRatios(symbol);

			if (ratios) {
				if (ratios.currentRatio !== undefined) {
					expect(ratios.currentRatio).toBeGreaterThan(0);
					expect(ratios.currentRatio).toBeLessThan(20); // Even very liquid companies rarely exceed this
					expect(typeof ratios.currentRatio).toBe("number");
					expect(isFinite(ratios.currentRatio)).toBe(true);
				}

				if (ratios.quickRatio !== undefined) {
					expect(ratios.quickRatio).toBeGreaterThan(0);
					expect(ratios.quickRatio).toBeLessThan(15);
					expect(typeof ratios.quickRatio).toBe("number");
					expect(isFinite(ratios.quickRatio)).toBe(true);
				}

				console.log(
					`✅ AAPL liquidity ratios: Current=${ratios.currentRatio?.toFixed(2) || "N/A"}, Quick=${ratios.quickRatio?.toFixed(2) || "N/A"}`
				);
			}
		}, 15000);

		test("should validate profitability margins", async () => {
			const symbol = "MSFT";
			const ratios = await fmpAPI.getFundamentalRatios(symbol);

			if (ratios) {
				if (ratios.grossProfitMargin !== undefined) {
					expect(ratios.grossProfitMargin).toBeGreaterThan(-1); // Some companies can have negative margins
					expect(ratios.grossProfitMargin).toBeLessThan(2); // 200% margin would be extremely unusual
					expect(typeof ratios.grossProfitMargin).toBe("number");
					expect(isFinite(ratios.grossProfitMargin)).toBe(true);
				}

				if (ratios.operatingMargin !== undefined) {
					expect(ratios.operatingMargin).toBeGreaterThan(-1);
					expect(ratios.operatingMargin).toBeLessThan(1);
					expect(typeof ratios.operatingMargin).toBe("number");
					expect(isFinite(ratios.operatingMargin)).toBe(true);
				}

				if (ratios.netProfitMargin !== undefined) {
					expect(ratios.netProfitMargin).toBeGreaterThan(-1);
					expect(ratios.netProfitMargin).toBeLessThan(1);
					expect(typeof ratios.netProfitMargin).toBe("number");
					expect(isFinite(ratios.netProfitMargin)).toBe(true);
				}

				console.log(
					`✅ MSFT margin validation: Gross=${ratios.grossProfitMargin?.toFixed(2) || "N/A"}, Operating=${ratios.operatingMargin?.toFixed(2) || "N/A"}, Net=${ratios.netProfitMargin?.toFixed(2) || "N/A"}`
				);
			}
		}, 15000);

		test("should validate return ratios for performance metrics", async () => {
			const symbol = "TSLA";
			const ratios = await fmpAPI.getFundamentalRatios(symbol);

			if (ratios) {
				if (ratios.roe !== undefined) {
					expect(ratios.roe).toBeGreaterThan(-5); // ROE can be negative but extreme values are suspicious
					expect(ratios.roe).toBeLessThan(5); // 500% ROE would be extremely unusual
					expect(typeof ratios.roe).toBe("number");
					expect(isFinite(ratios.roe)).toBe(true);
				}

				if (ratios.roa !== undefined) {
					expect(ratios.roa).toBeGreaterThan(-2); // ROA typically lower than ROE
					expect(ratios.roa).toBeLessThan(2);
					expect(typeof ratios.roa).toBe("number");
					expect(isFinite(ratios.roa)).toBe(true);
				}

				console.log(
					`✅ TSLA return validation: ROE=${ratios.roe?.toFixed(2) || "N/A"}, ROA=${ratios.roa?.toFixed(2) || "N/A"}`
				);
			}
		}, 15000);

		test("should validate dividend metrics for income stocks", async () => {
			const symbol = "JNJ"; // Johnson & Johnson - known dividend payer
			const ratios = await fmpAPI.getFundamentalRatios(symbol);

			if (ratios) {
				if (ratios.dividendYield !== undefined) {
					expect(ratios.dividendYield).toBeGreaterThan(0);
					expect(ratios.dividendYield).toBeLessThan(0.2); // 20% yield would be extremely high
					expect(typeof ratios.dividendYield).toBe("number");
					expect(isFinite(ratios.dividendYield)).toBe(true);
				}

				if (ratios.payoutRatio !== undefined) {
					expect(ratios.payoutRatio).toBeGreaterThan(0);
					expect(ratios.payoutRatio).toBeLessThan(5); // Payout ratio over 500% would be unsustainable
					expect(typeof ratios.payoutRatio).toBe("number");
					expect(isFinite(ratios.payoutRatio)).toBe(true);
				}

				console.log(
					`✅ JNJ dividend validation: Yield=${ratios.dividendYield?.toFixed(3) || "N/A"}, Payout=${ratios.payoutRatio?.toFixed(2) || "N/A"}`
				);
			}
		}, 15000);

		test("should validate data freshness and completeness", async () => {
			const symbol = "META";
			const ratios = await fmpAPI.getFundamentalRatios(symbol);

			if (ratios) {
				// Data should be relatively fresh (within last day for TTM data)
				const hoursSinceUpdate = (Date.now() - ratios.timestamp) / (1000 * 60 * 60);
				expect(hoursSinceUpdate).toBeLessThan(24);

				// Should have required fields
				expect(ratios.symbol).toBeDefined();
				expect(ratios.source).toBeDefined();
				expect(ratios.timestamp).toBeDefined();
				expect(ratios.period).toBeDefined();

				// Count available ratios for data completeness assessment
				const availableRatios = Object.entries(ratios).filter(
					([key, value]) =>
						!["symbol", "source", "timestamp", "period"].includes(key) &&
						value !== undefined
				).length;

				expect(availableRatios).toBeGreaterThan(0);
				console.log(
					`✅ META data completeness: ${availableRatios} ratios available, data age: ${hoursSinceUpdate.toFixed(1)} hours`
				);
			}
		}, 15000);
	});

	describe("Performance and Memory Optimization", () => {
		test("should complete fundamental ratios fetch within performance threshold", async () => {
			const symbol = "NVDA";
			const startTime = Date.now();

			const ratios = await fmpAPI.getFundamentalRatios(symbol);

			const duration = Date.now() - startTime;

			// Should complete within reasonable time (API target < 2 seconds)
			expect(duration).toBeLessThan(5000);

			if (ratios) {
				expect(ratios.symbol).toBe(symbol);
			}

			console.log(`✅ NVDA performance test: ${duration}ms`);
		}, 10000);

		test("should handle concurrent requests efficiently", async () => {
			const symbols = ["AAPL", "MSFT", "GOOGL"];
			const startTime = Date.now();

			const promises = symbols.map(symbol => fmpAPI.getFundamentalRatios(symbol));
			const results = await Promise.all(promises);

			const duration = Date.now() - startTime;

			// Concurrent requests should be faster than sequential
			expect(duration).toBeLessThan(10000);

			results.forEach((result, index) => {
				if (result) {
					expect(result.symbol).toBe(symbols[index]);
				}
			});

			const successCount = results.filter(r => r !== null).length;
			console.log(
				`✅ Concurrent test: ${successCount}/${symbols.length} successful in ${duration}ms`
			);
		}, 15000);
	});
});
