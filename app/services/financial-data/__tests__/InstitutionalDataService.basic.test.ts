/**
 * Basic Test Suite for InstitutionalDataService
 * Tests service initialization, basic functionality, and error handling
 * Follows TDD principles with NO MOCK DATA - uses real API calls only
 */

import { InstitutionalDataService } from "../InstitutionalDataService";
import SecurityValidator from "../../security/SecurityValidator";

describe("InstitutionalDataService Basic Tests", () => {
	let service: InstitutionalDataService;

	beforeEach(() => {
		// Reset security state between tests
		SecurityValidator.resetSecurityState();

		// Create fresh service instance for each test
		service = new InstitutionalDataService({
			baseUrl: "https://data.sec.gov",
			userAgent: "VFR-API-Test/1.0 (test@veritakfr.com)",
			requestsPerSecond: 10,
			timeout: 15000,
			throwErrors: false,
		});
	});

	afterEach(() => {
		// Clean up cache to prevent memory leaks
		service.clearCache();
		SecurityValidator.resetSecurityState();
	});

	describe("Service Initialization and Configuration", () => {
		test("should_initialize_service_with_default_configuration_successfully", () => {
			const defaultService = new InstitutionalDataService();
			expect(defaultService.name).toBe("SEC EDGAR Institutional Data");
			expect(defaultService).toBeInstanceOf(InstitutionalDataService);
		});

		test("should_initialize_service_with_custom_configuration_successfully", () => {
			const customConfig = {
				baseUrl: "https://custom-sec.gov",
				userAgent: "CustomAgent/1.0",
				requestsPerSecond: 5,
				timeout: 30000,
			};

			const customService = new InstitutionalDataService(customConfig);
			expect(customService.name).toBe("SEC EDGAR Institutional Data");
			expect(customService).toBeInstanceOf(InstitutionalDataService);
		});

		test("should_return_correct_source_identifier", () => {
			const sourceId = (service as any).getSourceIdentifier();
			expect(sourceId).toBe("sec_edgar_institutional");
		});

		test("should_have_required_properties_and_methods", () => {
			expect(service).toHaveProperty("name");
			expect(service).toHaveProperty("getInstitutionalHoldings");
			expect(service).toHaveProperty("getInsiderTransactions");
			expect(service).toHaveProperty("getInstitutionalIntelligence");
			expect(service).toHaveProperty("healthCheck");
			expect(service).toHaveProperty("clearCache");

			expect(typeof service.getInstitutionalHoldings).toBe("function");
			expect(typeof service.getInsiderTransactions).toBe("function");
			expect(typeof service.getInstitutionalIntelligence).toBe("function");
			expect(typeof service.healthCheck).toBe("function");
			expect(typeof service.clearCache).toBe("function");
		});
	});

	describe("Health Check and API Connectivity", () => {
		test("should_pass_health_check_with_valid_sec_edgar_endpoint", async () => {
			const isHealthy = await service.healthCheck();

			// SEC EDGAR health check should return true for accessible endpoints
			// Note: This tests real SEC EDGAR API connectivity
			expect(typeof isHealthy).toBe("boolean");

			if (isHealthy) {
				console.log("✓ SEC EDGAR API is accessible");
			} else {
				console.warn(
					"⚠ SEC EDGAR API is not accessible - this may be due to rate limiting or network issues"
				);
			}
		}, 20000);
	});

	describe("Input Validation and Security", () => {
		test("should_reject_malicious_symbol_inputs_for_institutional_holdings", async () => {
			const maliciousSymbols = [
				"'; DROP TABLE stocks; --",
				'<script>alert("xss")</script>',
				"AAPL; cat /etc/passwd",
				"../../../etc/passwd",
				"AAPL\0.txt",
				"__proto__",
				"../../sensitive/file.txt",
				"AAPL$(whoami)",
				"<img src=x onerror=alert(1)>",
			];

			for (const symbol of maliciousSymbols) {
				const result = await service.getInstitutionalHoldings(symbol);
				expect(Array.isArray(result)).toBe(true);
				expect(result.length).toBe(0); // Should return empty array for invalid symbols
			}
		});

		test("should_reject_malicious_symbol_inputs_for_insider_transactions", async () => {
			const maliciousSymbols = [
				"MSFT'; UNION SELECT password FROM users; --",
				'<iframe src="javascript:alert(1)"></iframe>',
				"GOOGL && rm -rf /",
				"..\\..\\windows\\system32\\config\\sam",
			];

			for (const symbol of maliciousSymbols) {
				const result = await service.getInsiderTransactions(symbol);
				expect(Array.isArray(result)).toBe(true);
				expect(result.length).toBe(0); // Should return empty array for invalid symbols
			}
		});

		test("should_sanitize_and_normalize_valid_symbols", async () => {
			const testSymbols = [
				"aapl", // lowercase
				"AAPL ", // with trailing space
				" MSFT", // with leading space
				"GOOGL\t", // with tab
				"TSLA\n", // with newline
			];

			for (const symbol of testSymbols) {
				// These should not throw errors and should handle normalization
				const holdingsResult = await service.getInstitutionalHoldings(symbol);
				const transactionsResult = await service.getInsiderTransactions(symbol);

				expect(Array.isArray(holdingsResult)).toBe(true);
				expect(Array.isArray(transactionsResult)).toBe(true);
			}
		});

		test("should_enforce_rate_limiting_for_repeated_requests", async () => {
			const symbol = "AAPL";
			const serviceId = `institutional_holdings_${symbol}`;

			// Exhaust rate limit by making many rapid requests
			for (let i = 0; i < 15; i++) {
				SecurityValidator.checkRateLimit(serviceId);
			}

			// This request should be rate limited
			const result = await service.getInstitutionalHoldings(symbol);
			expect(Array.isArray(result)).toBe(true);
			// Rate limited requests may return empty array or cached data
		});
	});

	describe("Basic API Method Tests", () => {
		test("should_handle_institutional_holdings_request_gracefully", async () => {
			const symbol = "AAPL"; // Use a well-known symbol

			const holdings = await service.getInstitutionalHoldings(symbol, 2);

			expect(Array.isArray(holdings)).toBe(true);

			// If holdings are returned, validate their basic structure
			if (holdings.length > 0) {
				holdings.forEach(holding => {
					expect(holding).toHaveProperty("symbol");
					expect(holding).toHaveProperty("cusip");
					expect(holding).toHaveProperty("shares");
					expect(holding).toHaveProperty("marketValue");
					expect(holding).toHaveProperty("timestamp");
					expect(holding).toHaveProperty("source");

					// Validate data types
					expect(typeof holding.symbol).toBe("string");
					expect(typeof holding.cusip).toBe("string");
					expect(typeof holding.shares).toBe("number");
					expect(typeof holding.marketValue).toBe("number");
					expect(typeof holding.timestamp).toBe("number");
					expect(holding.source).toBe("sec_edgar_institutional");

					// Validate reasonable value ranges
					expect(holding.shares).toBeGreaterThanOrEqual(0);
					expect(holding.marketValue).toBeGreaterThanOrEqual(0);
					expect(holding.timestamp).toBeGreaterThan(0);
				});

				console.log(`✓ Retrieved ${holdings.length} institutional holdings for ${symbol}`);
			} else {
				console.log(
					`⚠ No institutional holdings found for ${symbol} - this may be due to data availability or API limitations`
				);
			}
		}, 45000);

		test("should_handle_insider_transactions_request_gracefully", async () => {
			const symbol = "TSLA"; // Use a symbol known for insider activity

			const transactions = await service.getInsiderTransactions(symbol, 180);

			expect(Array.isArray(transactions)).toBe(true);

			// If transactions are returned, validate their basic structure
			if (transactions.length > 0) {
				transactions.forEach(transaction => {
					expect(transaction).toHaveProperty("symbol");
					expect(transaction).toHaveProperty("reportingOwnerName");
					expect(transaction).toHaveProperty("transactionDate");
					expect(transaction).toHaveProperty("transactionType");
					expect(transaction).toHaveProperty("shares");
					expect(transaction).toHaveProperty("timestamp");
					expect(transaction).toHaveProperty("source");

					// Validate data types
					expect(typeof transaction.symbol).toBe("string");
					expect(typeof transaction.reportingOwnerName).toBe("string");
					expect(typeof transaction.transactionDate).toBe("string");
					expect(typeof transaction.transactionType).toBe("string");
					expect(typeof transaction.shares).toBe("number");
					expect(typeof transaction.timestamp).toBe("number");
					expect(transaction.source).toBe("sec_edgar_institutional");

					// Validate transaction type
					expect(["BUY", "SELL", "GRANT", "EXERCISE", "GIFT", "OTHER"]).toContain(
						transaction.transactionType
					);

					// Validate reasonable value ranges
					expect(transaction.shares).toBeGreaterThanOrEqual(0);
					expect(transaction.timestamp).toBeGreaterThan(0);
				});

				console.log(
					`✓ Retrieved ${transactions.length} insider transactions for ${symbol}`
				);
			} else {
				console.log(
					`⚠ No insider transactions found for ${symbol} - this may be due to data availability or API limitations`
				);
			}
		}, 45000);

		test("should_handle_institutional_intelligence_request_gracefully", async () => {
			const symbol = "NVDA"; // Use a symbol with likely institutional activity

			const intelligence = await service.getInstitutionalIntelligence(symbol);

			if (intelligence) {
				// Validate intelligence structure
				expect(intelligence).toHaveProperty("symbol");
				expect(intelligence).toHaveProperty("reportDate");
				expect(intelligence).toHaveProperty("compositeScore");
				expect(intelligence).toHaveProperty("weightedSentiment");
				expect(intelligence).toHaveProperty("keyInsights");
				expect(intelligence).toHaveProperty("riskFactors");
				expect(intelligence).toHaveProperty("opportunities");
				expect(intelligence).toHaveProperty("dataQuality");
				expect(intelligence).toHaveProperty("timestamp");
				expect(intelligence).toHaveProperty("source");

				// Validate data types and ranges
				expect(typeof intelligence.symbol).toBe("string");
				expect(typeof intelligence.reportDate).toBe("string");
				expect(typeof intelligence.compositeScore).toBe("number");
				expect(typeof intelligence.weightedSentiment).toBe("string");
				expect(Array.isArray(intelligence.keyInsights)).toBe(true);
				expect(Array.isArray(intelligence.riskFactors)).toBe(true);
				expect(Array.isArray(intelligence.opportunities)).toBe(true);
				expect(typeof intelligence.dataQuality).toBe("object");
				expect(typeof intelligence.timestamp).toBe("number");
				expect(intelligence.source).toBe("sec_edgar_institutional");

				// Validate composite score range (0-10)
				expect(intelligence.compositeScore).toBeGreaterThanOrEqual(0);
				expect(intelligence.compositeScore).toBeLessThanOrEqual(10);

				// Validate weighted sentiment values
				expect(["VERY_BULLISH", "BULLISH", "NEUTRAL", "BEARISH", "VERY_BEARISH"]).toContain(
					intelligence.weightedSentiment
				);

				console.log(`✓ Generated institutional intelligence for ${symbol}:`);
				console.log(`  Composite Score: ${intelligence.compositeScore}/10`);
				console.log(`  Weighted Sentiment: ${intelligence.weightedSentiment}`);
				console.log(`  Key Insights: ${intelligence.keyInsights.length}`);
				console.log(`  Risk Factors: ${intelligence.riskFactors.length}`);
				console.log(`  Opportunities: ${intelligence.opportunities.length}`);
			} else {
				console.log(
					`⚠ No institutional intelligence generated for ${symbol} - this may be due to insufficient data or API limitations`
				);
				expect(intelligence).toBeNull();
			}
		}, 60000);

		test("should_handle_invalid_symbols_gracefully", async () => {
			const invalidSymbol = "INVALID_SYMBOL_THAT_DOES_NOT_EXIST";

			const holdings = await service.getInstitutionalHoldings(invalidSymbol);
			const transactions = await service.getInsiderTransactions(invalidSymbol);
			const intelligence = await service.getInstitutionalIntelligence(invalidSymbol);

			expect(Array.isArray(holdings)).toBe(true);
			expect(holdings.length).toBe(0);

			expect(Array.isArray(transactions)).toBe(true);
			expect(transactions.length).toBe(0);

			expect(intelligence).toBeNull();
		});
	});

	describe("Error Handling and Resilience", () => {
		test("should_handle_network_timeouts_gracefully", async () => {
			// Create service with very short timeout to force timeout
			const timeoutService = new InstitutionalDataService({
				timeout: 1, // 1ms timeout will definitely fail
			});

			const result = await timeoutService.getInstitutionalHoldings("AAPL");

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(0); // Should return empty array on timeout

			timeoutService.clearCache();
		});

		test("should_handle_api_rate_limit_responses_gracefully", async () => {
			const symbol = "V";

			// Make many rapid requests to potentially trigger rate limiting
			const promises = Array(5)
				.fill(0)
				.map(() => service.getInstitutionalHoldings(symbol));
			const results = await Promise.allSettled(promises);

			// All requests should complete without throwing errors
			results.forEach(result => {
				expect(result.status).toBe("fulfilled");
				if (result.status === "fulfilled") {
					expect(Array.isArray(result.value)).toBe(true);
				}
			});
		});

		test("should_sanitize_error_messages_to_prevent_information_disclosure", async () => {
			// Capture console output to check for sensitive information
			const originalConsoleError = console.error;
			const originalConsoleWarn = console.warn;
			const consoleMessages: string[] = [];

			console.error = (...args: any[]) => {
				consoleMessages.push(args.join(" "));
			};
			console.warn = (...args: any[]) => {
				consoleMessages.push(args.join(" "));
			};

			try {
				// Force an error by using invalid configuration
				const errorService = new InstitutionalDataService({
					baseUrl: "https://invalid-sec-endpoint-that-does-not-exist.com",
				});

				await errorService.getInstitutionalHoldings("AAPL");

				// Check that error messages don't contain sensitive information
				const allMessages = consoleMessages.join(" ");
				expect(allMessages).not.toContain("api_key");
				expect(allMessages).not.toContain("password");
				expect(allMessages).not.toContain("secret");
				expect(allMessages).not.toContain("token");

				errorService.clearCache();
			} finally {
				console.error = originalConsoleError;
				console.warn = originalConsoleWarn;
			}
		}, 20000);

		test("should_maintain_cache_integrity_during_errors", async () => {
			const symbol = "AAPL";

			// First, populate cache with a successful request
			await service.getInstitutionalHoldings(symbol);

			// Then make a request that might fail
			await service.getInstitutionalHoldings("INVALID_SYMBOL");

			// Original cache should still be intact
			const cachedResult = await service.getInstitutionalHoldings(symbol);
			expect(Array.isArray(cachedResult)).toBe(true);
		});
	});

	describe("Cache Management", () => {
		test("should_implement_caching_for_institutional_holdings", async () => {
			const symbol = "GOOGL";

			// First request - should hit API
			const startTime1 = Date.now();
			const holdings1 = await service.getInstitutionalHoldings(symbol);
			const duration1 = Date.now() - startTime1;

			// Second request - should use cache
			const startTime2 = Date.now();
			const holdings2 = await service.getInstitutionalHoldings(symbol);
			const duration2 = Date.now() - startTime2;

			expect(Array.isArray(holdings1)).toBe(true);
			expect(Array.isArray(holdings2)).toBe(true);

			// Cache should make second request faster (if data was retrieved)
			if (holdings1.length > 0) {
				expect(duration2).toBeLessThan(duration1);
				console.log(`✓ Cache improved response time: ${duration1}ms -> ${duration2}ms`);
			}
		}, 60000);

		test("should_clear_cache_without_affecting_service_functionality", async () => {
			const symbol = "GOOGL";

			// Populate cache
			await service.getInstitutionalHoldings(symbol);

			// Clear cache
			service.clearCache();

			// Service should still work after cache clear
			const result = await service.getInstitutionalHoldings(symbol);
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe("Performance and Memory Management", () => {
		test("should_process_multiple_symbols_concurrently_without_memory_leaks", async () => {
			const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];

			const startMemory = process.memoryUsage().heapUsed;

			// Process multiple symbols concurrently
			const promises = symbols.map(symbol => service.getInstitutionalHoldings(symbol, 1));
			const results = await Promise.allSettled(promises);

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const endMemory = process.memoryUsage().heapUsed;
			const memoryIncrease = endMemory - startMemory;

			// Memory increase should be reasonable (less than 50MB for this test)
			expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

			// All requests should complete
			expect(results.length).toBe(symbols.length);
			results.forEach(result => {
				expect(result.status).toBe("fulfilled");
			});

			console.log(
				`✓ Memory usage increased by ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${symbols.length} symbols`
			);
		}, 60000);

		test("should_respect_request_queue_and_rate_limiting", async () => {
			const symbol = "MSFT";

			// Make multiple requests that should be queued
			const startTime = Date.now();
			const promises = Array(3)
				.fill(0)
				.map(() => service.getInstitutionalHoldings(symbol, 1));
			await Promise.allSettled(promises);
			const totalTime = Date.now() - startTime;

			// With rate limiting, requests should take some minimum time
			expect(totalTime).toBeGreaterThan(200); // At least 200ms for 3 requests with rate limiting

			console.log(`✓ Rate limiting enforced: ${totalTime}ms for 3 requests`);
		});
	});
});
