/**
 * MLEnhancementOrchestrator Tests
 *
 * Tests for the ML Enhancement Orchestrator that coordinates
 * parallel enhancement integration across all ML feature integrators.
 *
 * NO MOCK DATA policy - uses real integrator connections
 * Performance target: <500ms for complete enhancement pipeline
 */

import { MLEnhancementOrchestrator } from "../MLEnhancementOrchestrator";
import type {
	EnhancementRequest,
	BatchEnhancementRequest,
	EnhancementResult,
} from "../MLEnhancementOrchestrator";

describe("MLEnhancementOrchestrator", () => {
	let orchestrator: MLEnhancementOrchestrator;

	beforeAll(() => {
		orchestrator = MLEnhancementOrchestrator.getInstance();
	});

	describe("Configuration", () => {
		it("should initialize with default configuration", () => {
			const config = orchestrator.getConfig();

			expect(config.enableParallelExecution).toBe(true);
			expect(config.targetLatency).toBe(500);
			expect(config.enableGracefulDegradation).toBe(true);
			expect(config.fallbackToClassic).toBe(true);
			expect(config.maxRetries).toBe(2);
			expect(config.timeout).toBe(5000);
			expect(config.enableCache).toBe(true);
			expect(config.cacheTTL).toBe(900); // 15 minutes
		});

		it("should allow configuration updates", () => {
			orchestrator.updateConfig({
				targetLatency: 300,
				enableCache: false,
			});

			const config = orchestrator.getConfig();
			expect(config.targetLatency).toBe(300);
			expect(config.enableCache).toBe(false);

			// Reset to defaults
			orchestrator.updateConfig({
				targetLatency: 500,
				enableCache: true,
			});
		});

		it("should use singleton pattern", () => {
			const instance1 = MLEnhancementOrchestrator.getInstance();
			const instance2 = MLEnhancementOrchestrator.getInstance();

			expect(instance1).toBe(instance2);
		});
	});

	describe("Single Symbol Enhancement", () => {
		const testSymbol = "AAPL";

		it("should enhance a single symbol successfully", async () => {
			const request: EnhancementRequest = {
				symbol: testSymbol,
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
			};

			const result = await orchestrator.enhanceSymbol(request);

			expect(result).toBeDefined();
			expect(result.symbol).toBe(testSymbol);
			expect(result.success).toBe(true);
			expect(result.totalLatency).toBeGreaterThan(0);
		}, 30000); // 30s timeout for real integrator calls

		it("should include all enhancement categories", async () => {
			const request: EnhancementRequest = {
				symbol: testSymbol,
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
			};

			const result = await orchestrator.enhanceSymbol(request);

			expect(result.technical).toBeDefined();
			expect(result.fundamental).toBeDefined();
			expect(result.sentiment).toBeDefined();
		}, 30000);

		it("should have valid technical enhancement", async () => {
			const request: EnhancementRequest = {
				symbol: testSymbol,
				enableTechnical: true,
				enableFundamental: false,
				enableSentiment: false,
			};

			const result = await orchestrator.enhanceSymbol(request);

			expect(result.technical).toBeDefined();
			if (result.technical?.success) {
				expect(result.technical.features).toBeDefined();
				expect(result.technical.confidence).toBeGreaterThanOrEqual(0);
				expect(result.technical.confidence).toBeLessThanOrEqual(1);
				expect(result.technical.latency).toBeGreaterThan(0);
			}
		}, 15000);

		it("should have valid fundamental enhancement", async () => {
			const request: EnhancementRequest = {
				symbol: testSymbol,
				enableTechnical: false,
				enableFundamental: true,
				enableSentiment: false,
			};

			const result = await orchestrator.enhanceSymbol(request);

			expect(result.fundamental).toBeDefined();
			if (result.fundamental?.success) {
				expect(result.fundamental.features).toBeDefined();
				expect(result.fundamental.confidence).toBeGreaterThanOrEqual(0);
				expect(result.fundamental.confidence).toBeLessThanOrEqual(1);
				expect(result.fundamental.latency).toBeGreaterThan(0);
			}
		}, 15000);

		it("should have valid sentiment enhancement", async () => {
			const request: EnhancementRequest = {
				symbol: testSymbol,
				enableTechnical: false,
				enableFundamental: false,
				enableSentiment: true,
			};

			const result = await orchestrator.enhanceSymbol(request);

			expect(result.sentiment).toBeDefined();
			if (result.sentiment?.success) {
				expect(result.sentiment.features).toBeDefined();
				expect(result.sentiment.confidence).toBeGreaterThanOrEqual(0);
				expect(result.sentiment.confidence).toBeLessThanOrEqual(1);
				expect(result.sentiment.latency).toBeGreaterThan(0);
			}
		}, 20000);

		it("should calculate aggregated score", async () => {
			const request: EnhancementRequest = {
				symbol: testSymbol,
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
			};

			const result = await orchestrator.enhanceSymbol(request);

			if (result.success) {
				expect(result.aggregatedScore).toBeDefined();
				expect(result.aggregatedScore).toBeGreaterThanOrEqual(0);
				expect(result.aggregatedScore).toBeLessThanOrEqual(1);
				expect(result.overallConfidence).toBeDefined();
				expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
				expect(result.overallConfidence).toBeLessThanOrEqual(1);
			}
		}, 30000);

		it("should track latency for each enhancement", async () => {
			const request: EnhancementRequest = {
				symbol: testSymbol,
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
			};

			const result = await orchestrator.enhanceSymbol(request);

			if (result.technical) {
				expect(result.technical.latency).toBeGreaterThan(0);
			}

			if (result.fundamental) {
				expect(result.fundamental.latency).toBeGreaterThan(0);
			}

			if (result.sentiment) {
				expect(result.sentiment.latency).toBeGreaterThan(0);
			}

			expect(result.totalLatency).toBeGreaterThan(0);
		}, 30000);

		it("should warn if latency exceeds target", async () => {
			// Temporarily set very low target
			orchestrator.updateConfig({ targetLatency: 100 });

			const request: EnhancementRequest = {
				symbol: testSymbol,
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
			};

			const result = await orchestrator.enhanceSymbol(request);

			// Should have warning about latency
			expect(result.warnings.length).toBeGreaterThan(0);

			// Reset config
			orchestrator.updateConfig({ targetLatency: 500 });
		}, 30000);
	});

	describe("Batch Symbol Enhancement", () => {
		const testSymbols = ["AAPL", "GOOGL", "MSFT"];

		it("should enhance multiple symbols in batch", async () => {
			const request: BatchEnhancementRequest = {
				symbols: testSymbols,
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
				parallelization: 2,
			};

			const results = await orchestrator.enhanceSymbols(request);

			expect(results).toBeDefined();
			expect(results.length).toBe(testSymbols.length);
			expect(results.every(r => r.symbol)).toBe(true);
		}, 60000); // 60s timeout for batch

		it("should return results for all symbols", async () => {
			const request: BatchEnhancementRequest = {
				symbols: testSymbols,
				enableTechnical: true,
				enableFundamental: false,
				enableSentiment: false,
				parallelization: 3,
			};

			const results = await orchestrator.enhanceSymbols(request);

			// Verify all symbols processed
			const processedSymbols = results.map(r => r.symbol).sort();
			const expectedSymbols = [...testSymbols].sort();

			expect(processedSymbols).toEqual(expectedSymbols);
		}, 45000);

		it("should respect parallelization limit", async () => {
			const request: BatchEnhancementRequest = {
				symbols: testSymbols,
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
				parallelization: 1, // Process one at a time
			};

			const startTime = Date.now();
			const results = await orchestrator.enhanceSymbols(request);
			const totalTime = Date.now() - startTime;

			expect(results.length).toBe(testSymbols.length);
			// Should take longer with parallelization=1
			expect(totalTime).toBeGreaterThan(1000);
		}, 90000);

		it("should track success rate in batch", async () => {
			const request: BatchEnhancementRequest = {
				symbols: testSymbols,
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
			};

			const results = await orchestrator.enhanceSymbols(request);

			const successCount = results.filter(r => r.success).length;
			const failureCount = results.filter(r => !r.success).length;

			expect(successCount + failureCount).toBe(testSymbols.length);
			// Most should succeed with valid symbols
			expect(successCount).toBeGreaterThan(0);
		}, 60000);
	});

	describe("Graceful Degradation", () => {
		it("should handle partial enhancement failure", async () => {
			const request: EnhancementRequest = {
				symbol: "INVALID_SYMBOL_XYZ",
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
			};

			const result = await orchestrator.enhanceSymbol(request);

			// Should still return a result
			expect(result).toBeDefined();
			expect(result.symbol).toBe("INVALID_SYMBOL_XYZ");

			// May have failures
			if (!result.success) {
				expect(result.errors.length).toBeGreaterThan(0);
			}
		}, 30000);

		it("should use fallback when all enhancements fail", async () => {
			const request: EnhancementRequest = {
				symbol: "COMPLETELY_INVALID",
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
			};

			const result = await orchestrator.enhanceSymbol(request);

			expect(result).toBeDefined();
			// Should indicate fallback was used
			expect(result.fallbackUsed || !result.success).toBe(true);
		}, 30000);

		it("should continue batch processing despite individual failures", async () => {
			const request: BatchEnhancementRequest = {
				symbols: ["AAPL", "INVALID_XYZ", "GOOGL"],
				enableTechnical: true,
				enableFundamental: false,
				enableSentiment: false,
			};

			const results = await orchestrator.enhanceSymbols(request);

			// Should return results for all symbols
			expect(results.length).toBe(3);

			// At least some should succeed (AAPL, GOOGL)
			const successCount = results.filter(r => r.success).length;
			expect(successCount).toBeGreaterThan(0);
		}, 45000);
	});

	describe("Caching", () => {
		const testSymbol = "AAPL";

		it("should cache enhancement results", async () => {
			// Enable caching
			orchestrator.updateConfig({ enableCache: true });

			const request: EnhancementRequest = {
				symbol: testSymbol,
				enableTechnical: true,
				enableFundamental: false,
				enableSentiment: false,
			};

			// First call - should hit integrators
			const result1 = await orchestrator.enhanceSymbol(request);
			const latency1 = result1.totalLatency;

			// Second call - should hit cache
			const result2 = await orchestrator.enhanceSymbol(request);
			const latency2 = result2.totalLatency;

			// Cached call should be faster
			expect(latency2).toBeLessThanOrEqual(latency1);
		}, 30000);

		it("should bypass cache when disabled", async () => {
			// Disable caching
			orchestrator.updateConfig({ enableCache: false });

			const request: EnhancementRequest = {
				symbol: testSymbol,
				enableTechnical: true,
				enableFundamental: false,
				enableSentiment: false,
			};

			const result = await orchestrator.enhanceSymbol(request);

			expect(result).toBeDefined();
			expect(result.totalLatency).toBeGreaterThan(0);

			// Re-enable caching
			orchestrator.updateConfig({ enableCache: true });
		}, 15000);
	});

	describe("Health Status", () => {
		it("should return health status", async () => {
			const health = await orchestrator.getHealthStatus();

			expect(health).toBeDefined();
			expect(health.status).toMatch(/^(healthy|degraded|unavailable)$/);
			expect(health.integrators).toBeDefined();
			expect(health.integrators.technical).toBeDefined();
			expect(health.integrators.fundamental).toBeDefined();
			expect(health.integrators.sentiment).toBeDefined();
			expect(health.degradation).toBeDefined();
			expect(health.performance).toBeDefined();
		});

		it("should have valid performance metrics", async () => {
			const health = await orchestrator.getHealthStatus();

			expect(health.performance.avgLatency).toBeGreaterThan(0);
			expect(health.performance.successRate).toBeGreaterThanOrEqual(0);
			expect(health.performance.successRate).toBeLessThanOrEqual(1);
		});

		it("should reset degradation status", () => {
			orchestrator.resetDegradation();

			// Should not throw and should reset internal state
			expect(() => orchestrator.resetDegradation()).not.toThrow();
		});
	});

	describe("Performance", () => {
		it("should complete single enhancement in reasonable time", async () => {
			const request: EnhancementRequest = {
				symbol: "AAPL",
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
			};

			const startTime = Date.now();
			const result = await orchestrator.enhanceSymbol(request);
			const totalTime = Date.now() - startTime;

			// Should complete in reasonable time (allowing for real API calls)
			expect(totalTime).toBeLessThan(30000); // 30 seconds max
			expect(result.totalLatency).toBeLessThan(30000);
		}, 35000);

		it("should parallelize enhancements efficiently", async () => {
			const request: EnhancementRequest = {
				symbol: "MSFT",
				enableTechnical: true,
				enableFundamental: true,
				enableSentiment: true,
			};

			const result = await orchestrator.enhanceSymbol(request);

			// Total latency should be less than sum of individual latencies
			// (due to parallel execution)
			if (result.technical && result.fundamental && result.sentiment) {
				const sequentialTime =
					result.technical.latency +
					result.fundamental.latency +
					result.sentiment.latency;

				// Parallel should be faster than sequential
				expect(result.totalLatency).toBeLessThan(sequentialTime);
			}
		}, 30000);
	});
});
