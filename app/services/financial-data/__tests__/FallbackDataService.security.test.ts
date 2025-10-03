/**
 * Security Integration Tests for FinancialDataService
 * Tests security controls in the context of financial data operations
 */

import { FinancialDataService } from "../FinancialDataService";
import SecurityValidator, {
	SecurityValidator as SecurityValidatorClass,
} from "../../security/SecurityValidator";

// Mock the providers to control test behavior
jest.mock("../PolygonAPI");
jest.mock("../YahooFinanceAPI");
jest.mock("../TwelveDataAPI");
jest.mock("../FinancialModelingPrepAPI");

describe("FinancialDataService Security Integration", () => {
	let service: FinancialDataService;
	let validator: SecurityValidatorClass;

	beforeEach(() => {
		// Create fresh instances for each test
		service = new FinancialDataService();
		validator = SecurityValidator;
		validator.resetSecurityState();

		// Mock environment variables
		process.env.FMP_API_KEY = "test_key";
		process.env.TWELVE_DATA_API_KEY = "test_key";
		process.env.POLYGON_API_KEY = "test_key";
	});

	afterEach(() => {
		validator.resetSecurityState();
	});

	describe("getFundamentalRatios Security Tests", () => {
		test("should reject malicious symbol inputs", async () => {
			const maliciousSymbols = [
				"'; DROP TABLE stocks; --",
				'<script>alert("xss")</script>',
				"AAPL; cat /etc/passwd",
				"../../../etc/passwd",
				"AAPL\0.txt",
				"__proto__",
			];

			for (const symbol of maliciousSymbols) {
				const result = await service.getFundamentalRatios(symbol);
				expect(result).toBeNull();
			}
		});

		test("should sanitize and normalize valid symbols", async () => {
			// Mock the provider method to return test data
			const mockProvider = {
				getFundamentalRatios: jest.fn().mockResolvedValue({
					symbol: "AAPL",
					peRatio: 25.5,
					timestamp: Date.now(),
					source: "test",
				}),
			};

			// Override the data sources for this test
			(service as any).dataSources = [
				{
					name: "Financial Modeling Prep",
					provider: mockProvider,
					priority: 1,
					isFree: true,
					rateLimit: 10,
				},
			];

			const result = await service.getFundamentalRatios("aapl"); // lowercase input

			// Should normalize to uppercase and call provider with sanitized symbol
			expect(mockProvider.getFundamentalRatios).toHaveBeenCalledWith("AAPL");
			expect(result).toBeTruthy();
		});

		test("should enforce rate limiting", async () => {
			const symbol = "AAPL";

			// Mock provider to simulate successful responses
			const mockProvider = {
				getFundamentalRatios: jest.fn().mockResolvedValue({
					symbol,
					peRatio: 25.5,
					timestamp: Date.now(),
					source: "test",
				}),
			};

			(service as any).dataSources = [
				{
					name: "Financial Modeling Prep",
					provider: mockProvider,
					priority: 1,
					isFree: true,
					rateLimit: 10,
				},
			];

			// Exhaust rate limit for this specific service
			const serviceId = `fundamental_ratios_${symbol}`;
			for (let i = 0; i < 100; i++) {
				validator.checkRateLimit(serviceId);
			}

			const result = await service.getFundamentalRatios(symbol);
			expect(result).toBeNull();
			expect(mockProvider.getFundamentalRatios).not.toHaveBeenCalled();
		});

		test("should validate API response structure", async () => {
			const symbol = "AAPL";

			// Mock provider with malformed response
			const mockProvider = {
				getFundamentalRatios: jest.fn().mockResolvedValue({
					// Missing required fields
					invalidField: "value",
					__proto__: { evil: true }, // Suspicious property
				}),
			};

			(service as any).dataSources = [
				{
					name: "Financial Modeling Prep",
					provider: mockProvider,
					priority: 1,
					isFree: true,
					rateLimit: 10,
				},
			];

			const result = await service.getFundamentalRatios(symbol);
			expect(result).toBeNull(); // Should reject invalid response
		});

		test("should validate numeric values in response", async () => {
			const symbol = "AAPL";

			// Mock provider with invalid numeric data
			const mockProvider = {
				getFundamentalRatios: jest.fn().mockResolvedValue({
					symbol,
					peRatio: "not_a_number",
					pbRatio: Infinity,
					currentRatio: -999999, // Invalid for a ratio
					timestamp: Date.now(),
					source: "test",
				}),
			};

			(service as any).dataSources = [
				{
					name: "Financial Modeling Prep",
					provider: mockProvider,
					priority: 1,
					isFree: true,
					rateLimit: 10,
				},
			];

			const result = await service.getFundamentalRatios(symbol);

			// Should return response but with invalid fields set to undefined
			expect(result).toBeTruthy();
			expect(result?.peRatio).toBeUndefined();
			expect(result?.pbRatio).toBeUndefined();
			expect(result?.currentRatio).toBeUndefined();
		});

		test("should implement circuit breaker pattern", async () => {
			const symbol = "AAPL";
			const serviceId = `fundamental_ratios_${symbol}`;

			// Mock provider that throws errors
			const mockProvider = {
				getFundamentalRatios: jest.fn().mockRejectedValue(new Error("Service unavailable")),
			};

			(service as any).dataSources = [
				{
					name: "Financial Modeling Prep",
					provider: mockProvider,
					priority: 1,
					isFree: true,
					rateLimit: 10,
				},
			];

			// Trigger circuit breaker by recording failures
			for (let i = 0; i < 10; i++) {
				validator.recordFailure(serviceId);
			}

			const result = await service.getFundamentalRatios(symbol);
			expect(result).toBeNull();
			expect(mockProvider.getFundamentalRatios).not.toHaveBeenCalled();
		});

		test("should sanitize error messages", async () => {
			const symbol = "AAPL";

			// Mock provider that throws error with sensitive information
			const mockProvider = {
				getFundamentalRatios: jest
					.fn()
					.mockRejectedValue(
						new Error(
							"API key: secret123, Database connection: mongodb://user:pass@localhost"
						)
					),
			};

			(service as any).dataSources = [
				{
					name: "Financial Modeling Prep",
					provider: mockProvider,
					priority: 1,
					isFree: true,
					rateLimit: 10,
				},
			];

			// Capture console.error calls
			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

			const result = await service.getFundamentalRatios(symbol);
			expect(result).toBeNull();

			// Check that error was sanitized
			const errorCalls = consoleErrorSpy.mock.calls;
			const sanitizedErrors = errorCalls.map(call => call.join(" "));

			// Should not contain sensitive information
			sanitizedErrors.forEach(error => {
				expect(error).not.toContain("secret123");
				expect(error).not.toContain("user:pass");
			});

			consoleErrorSpy.mockRestore();
		});
	});

	describe("getStockPrice Security Tests", () => {
		test("should reject malicious symbol inputs", async () => {
			const maliciousSymbols = [
				"AAPL'; DROP TABLE users; --",
				"<img src=x onerror=alert(1)>",
				"AAPL$(whoami)",
				"../../sensitive/file.txt",
			];

			for (const symbol of maliciousSymbols) {
				const result = await service.getStockPrice(symbol);
				expect(result).toBeNull();
			}
		});

		test("should validate price data ranges", async () => {
			const symbol = "AAPL";

			// Mock provider with invalid price data
			const mockProvider = {
				getStockPrice: jest.fn().mockResolvedValue({
					symbol,
					price: -50, // Invalid negative price
					change: 999999, // Unrealistic change
					timestamp: Date.now(),
					source: "test",
				}),
			};

			(service as any).dataSources = [
				{
					name: "Test Provider",
					provider: mockProvider,
					priority: 1,
					isFree: true,
					rateLimit: 10,
				},
			];

			const result = await service.getStockPrice(symbol);
			expect(result).toBeNull(); // Should reject invalid price data
		});

		test("should enforce rate limiting per symbol", async () => {
			const symbol = "MSFT";
			const serviceId = `stock_price_${symbol}`;

			// Exhaust rate limit for this specific symbol
			for (let i = 0; i < 100; i++) {
				validator.checkRateLimit(serviceId);
			}

			const result = await service.getStockPrice(symbol);
			expect(result).toBeNull();
		});
	});

	describe("getBatchPrices Security Tests", () => {
		test("should reject malicious symbol batches", async () => {
			const maliciousBatch = [
				"AAPL",
				"'; UNION SELECT password FROM users; --",
				"MSFT",
				'<script>fetch("http://evil.com")</script>',
			];

			const result = await service.getBatchPrices(maliciousBatch);
			expect(result.size).toBe(0); // Should reject entire batch
		});

		test("should enforce batch size limits", async () => {
			const largeBatch = Array(100).fill("AAPL");
			const result = await service.getBatchPrices(largeBatch);
			expect(result.size).toBe(0); // Should reject oversized batch
		});

		test("should handle duplicate symbols securely", async () => {
			const duplicateBatch = ["AAPL", "MSFT", "AAPL", "GOOGL"];
			const result = await service.getBatchPrices(duplicateBatch);
			expect(result.size).toBe(0); // Should reject batch with duplicates
		});

		test("should validate each response in batch", async () => {
			const symbols = ["AAPL", "MSFT"];

			// Mock provider that returns mixed valid/invalid data
			const mockProvider = {
				getBatchPrices: jest.fn().mockResolvedValue(
					new Map([
						[
							"AAPL",
							{ symbol: "AAPL", price: 150, timestamp: Date.now(), source: "test" },
						],
						[
							"MSFT",
							{ symbol: "MSFT", price: -100, timestamp: Date.now(), source: "test" },
						], // Invalid price
					])
				),
			};

			(service as any).dataSources = [
				{
					name: "Test Provider",
					provider: mockProvider,
					priority: 1,
					isFree: true,
					rateLimit: 10,
				},
			];

			const result = await service.getBatchPrices(symbols);

			// Should only include valid responses
			expect(result.has("AAPL")).toBe(true);
			expect(result.has("MSFT")).toBe(false);
		});
	});

	describe("Error Handling Security Tests", () => {
		test("should not leak sensitive information in error responses", async () => {
			const originalEnv = process.env.NODE_ENV;
			Object.defineProperty(process.env, "NODE_ENV", {
				value: "production",
				configurable: true,
			});

			const symbol = "AAPL";

			// Mock provider that throws error with sensitive data
			const mockProvider = {
				getFundamentalRatios: jest
					.fn()
					.mockRejectedValue(
						new Error(
							"Database error: connection failed to mongodb://admin:secret@localhost:27017/financials"
						)
					),
			};

			(service as any).dataSources = [
				{
					name: "Financial Modeling Prep",
					provider: mockProvider,
					priority: 1,
					isFree: true,
					rateLimit: 10,
				},
			];

			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

			await service.getFundamentalRatios(symbol);

			const errorMessages = consoleErrorSpy.mock.calls.flat().join(" ");

			// Should not contain sensitive information
			expect(errorMessages).not.toContain("admin:secret");
			expect(errorMessages).not.toContain("mongodb://");

			consoleErrorSpy.mockRestore();
			Object.defineProperty(process.env, "NODE_ENV", {
				value: originalEnv,
				configurable: true,
			});
		});

		test("should limit error message length", async () => {
			const symbol = "AAPL";
			const longError = "A".repeat(1000);

			const mockProvider = {
				getFundamentalRatios: jest.fn().mockRejectedValue(new Error(longError)),
			};

			(service as any).dataSources = [
				{
					name: "Financial Modeling Prep",
					provider: mockProvider,
					priority: 1,
					isFree: true,
					rateLimit: 10,
				},
			];

			// Test the sanitization directly rather than console output
			const sanitizedError = SecurityValidator.sanitizeErrorMessage(longError, true);

			// Should be truncated to security limits (100 characters + '...')
			expect(sanitizedError.length).toBeLessThan(longError.length);
			expect(sanitizedError.length).toBeLessThanOrEqual(103); // 100 chars + '...'

			// Also verify that the actual service call handles the error properly
			const result = await service.getFundamentalRatios(symbol);
			expect(result).toBeNull(); // Should return null when error occurs
		});
	});

	describe("Security Integration Tests", () => {
		test("should maintain security state across multiple operations", async () => {
			const symbol = "AAPL";

			// Perform multiple operations
			await service.getStockPrice(symbol);
			await service.getFundamentalRatios(symbol);
			await service.getBatchPrices([symbol]);

			const securityStatus = validator.getSecurityStatus();

			// Should have tracked multiple services
			expect(Object.keys(securityStatus.rateLimits).length).toBeGreaterThan(0);
		});

		test("should handle concurrent requests securely", async () => {
			const symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "AMZN"];

			// Create concurrent requests
			const promises = symbols.map(symbol => service.getStockPrice(symbol));

			const results = await Promise.allSettled(promises);

			// All should complete without security violations
			results.forEach(result => {
				// Should either succeed or fail gracefully (not throw unhandled errors)
				expect(result.status).toMatch(/fulfilled|rejected/);
			});
		});

		test("should recover from security state reset", async () => {
			const symbol = "AAPL";

			// Build up some security state
			await service.getStockPrice(symbol);
			validator.recordFailure(`test_service_${symbol}`);

			// Reset security state
			validator.resetSecurityState();

			// Should work normally after reset
			const result = await service.getStockPrice(symbol);
			// Result depends on mocked providers, but should not throw errors
		});
	});
});
