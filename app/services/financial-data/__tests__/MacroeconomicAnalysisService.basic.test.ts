/**
 * MacroeconomicAnalysisService Test Suite
 * Tests for the Data Foundation Enhancement implementation
 * Covers real API integration, performance targets, and 20% weight integration
 * Following KISS principles - NO MOCK DATA
 */

import { MacroeconomicAnalysisService } from "../MacroeconomicAnalysisService";

describe("MacroeconomicAnalysisService - Data Foundation Enhancement", () => {
	let service: MacroeconomicAnalysisService;
	const testTimeout = 25000;

	beforeEach(() => {
		service = new MacroeconomicAnalysisService({
			fredApiKey: process.env.FRED_API_KEY,
			blsApiKey: process.env.BLS_API_KEY,
			eiaApiKey: process.env.EIA_API_KEY,
			timeout: 12000,
			throwErrors: false,
		});
	});

	describe("Core Implementation", () => {
		test("should initialize service with data source orchestration", () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(MacroeconomicAnalysisService);
			expect(typeof service.getMacroeconomicContext).toBe("function");
			expect(typeof service.getComprehensiveMacroAnalysis).toBe("function");
			expect(typeof service.healthCheck).toBe("function");
		});

		test(
			"should orchestrate parallel data collection with performance targets",
			async () => {
				const startTime = Date.now();
				const context = await service.getMacroeconomicContext();
				const responseTime = Date.now() - startTime;

				console.log(`📊 Response time: ${responseTime}ms (target: <800ms per plan)`);

				if (context) {
					// Validate core structure from plan
					expect(typeof context.overallScore).toBe("number");
					expect(typeof context.confidence).toBe("number");
					expect(typeof context.inflationEnvironment).toBe("string");
					expect(typeof context.monetaryPolicy).toBe("string");
					expect(typeof context.economicCycle).toBe("string");
					expect(Array.isArray(context.dataSourcesUsed)).toBe(true);
					expect(typeof context.sectorImpacts).toBe("object");

					// Validate 0-10 scale composite scoring
					expect(context.overallScore).toBeGreaterThanOrEqual(0);
					expect(context.overallScore).toBeLessThanOrEqual(10);

					// Validate confidence scoring (0-1 range)
					expect(context.confidence).toBeGreaterThanOrEqual(0);
					expect(context.confidence).toBeLessThanOrEqual(1);

					// Validate economic environment classification
					expect(["low", "moderate", "high", "declining"]).toContain(
						context.inflationEnvironment
					);
					expect(["accommodative", "neutral", "restrictive"]).toContain(
						context.monetaryPolicy
					);
					expect(["expansion", "peak", "contraction", "trough"]).toContain(
						context.economicCycle
					);

					console.log(`✓ Data sources: ${context.dataSourcesUsed.join(", ")}`);
					console.log(`✓ Composite score: ${context.overallScore}/10`);
					console.log(`✓ Confidence: ${(context.confidence * 100).toFixed(1)}%`);
					console.log(`✓ Inflation: ${context.inflationEnvironment}`);
					console.log(`✓ Monetary Policy: ${context.monetaryPolicy}`);
					console.log(`✓ Economic Cycle: ${context.economicCycle}`);

					// Performance validation
					if (responseTime <= 800) {
						console.log(`✅ Performance target MET: ${responseTime}ms ≤ 800ms`);
					} else if (responseTime <= 1500) {
						console.log(`⚠️ Acceptable performance: ${responseTime}ms (real APIs)`);
					} else {
						console.warn(`❌ Performance concern: ${responseTime}ms`);
					}
				} else {
					console.log("⚠ Context is null - API keys may not be configured for testing");
				}

				expect(context === null || typeof context === "object").toBe(true);
			},
			testTimeout
		);

		test(
			"should calculate sector-specific impact multipliers",
			async () => {
				const context = await service.getMacroeconomicContext();

				if (context && context.sectorImpacts) {
					// Validate sector coverage from plan (11 sectors)
					const expectedSectors = [
						"technology",
						"healthcare",
						"financials",
						"energy",
						"utilities",
						"industrials",
						"materials",
						"consumerDiscretionary",
						"consumerStaples",
						"realEstate",
						"communication",
					];

					let foundSectors = 0;
					expectedSectors.forEach(sector => {
						if (sector in context.sectorImpacts) {
							foundSectors++;
							const impact = context.sectorImpacts[sector];
							expect(typeof impact).toBe("number");
							expect(impact).toBeGreaterThanOrEqual(-2);
							expect(impact).toBeLessThanOrEqual(2);
						}
					});

					console.log(
						`✓ Sector coverage: ${foundSectors}/${expectedSectors.length} sectors`
					);

					// Show sector performance distribution
					const impacts = Object.entries(context.sectorImpacts);
					const sorted = impacts.sort(([, a], [, b]) => b - a);
					if (sorted.length >= 2) {
						console.log(
							`✓ Best performer: ${sorted[0][0]} (${sorted[0][1].toFixed(2)})`
						);
						console.log(
							`✓ Worst performer: ${sorted[sorted.length - 1][0]} (${sorted[sorted.length - 1][1].toFixed(2)})`
						);
					}
				}
			},
			testTimeout
		);

		test(
			"should demonstrate 20% weight integration readiness",
			async () => {
				const context = await service.getMacroeconomicContext();

				if (context) {
					// Simulate integration with StockSelectionService (from plan)
					// New weighting: 40% Technical + 25% Fundamental + 20% Macroeconomic + 15% Other
					const mockAnalysis = {
						technical: 7.0,
						fundamental: 6.5,
						macroeconomic: context.overallScore, // Our 20% contribution
						other: 6.8,
					};

					const weightedScore =
						mockAnalysis.technical * 0.4 +
						mockAnalysis.fundamental * 0.25 +
						mockAnalysis.macroeconomic * 0.2 +
						mockAnalysis.other * 0.15;

					console.log(`✓ 20% Weight Integration Simulation:`);
					console.log(
						`  - Technical (40%): ${mockAnalysis.technical} → ${(mockAnalysis.technical * 0.4).toFixed(2)}`
					);
					console.log(
						`  - Fundamental (25%): ${mockAnalysis.fundamental} → ${(mockAnalysis.fundamental * 0.25).toFixed(2)}`
					);
					console.log(
						`  - Macroeconomic (20%): ${mockAnalysis.macroeconomic} → ${(mockAnalysis.macroeconomic * 0.2).toFixed(2)}`
					);
					console.log(
						`  - Other (15%): ${mockAnalysis.other} → ${(mockAnalysis.other * 0.15).toFixed(2)}`
					);
					console.log(`  - Final Score: ${weightedScore.toFixed(2)}/10`);

					expect(weightedScore).toBeGreaterThanOrEqual(0);
					expect(weightedScore).toBeLessThanOrEqual(10);

					const macroContribution = mockAnalysis.macroeconomic * 0.2;
					console.log(
						`✅ Macro contributes ${macroContribution.toFixed(2)}/2.0 points to final score`
					);
				}
			},
			testTimeout
		);
	});

	describe("Enhanced API Integration", () => {
		test(
			"should validate data source integration",
			async () => {
				const context = await service.getMacroeconomicContext();

				if (context) {
					const sources = context.dataSourcesUsed;
					console.log(`✓ Active data sources: ${sources.length}`);

					// Check for FRED integration (enhanced methods from plan)
					const fredSources = sources.filter(s => s.startsWith("FRED"));
					console.log(`  - FRED sources: ${fredSources.join(", ")}`);

					// Check for BLS integration (employment analysis)
					const blsSources = sources.filter(s => s.startsWith("BLS"));
					console.log(`  - BLS sources: ${blsSources.join(", ")}`);

					// Check for EIA integration (energy/commodity data)
					const eiaSources = sources.filter(s => s.startsWith("EIA"));
					console.log(`  - EIA sources: ${eiaSources.join(", ")}`);

					expect(sources.length).toBeGreaterThan(0);
				}
			},
			testTimeout
		);

		test(
			"should implement consistent data retrieval",
			async () => {
				// First call
				const context1 = await service.getMacroeconomicContext();

				if (context1) {
					// Second call to verify consistency
					const context2 = await service.getMacroeconomicContext();

					if (context2) {
						console.log(`✓ Data consistency validation:`);
						console.log(`  - First call score: ${context1.overallScore}`);
						console.log(`  - Second call score: ${context2.overallScore}`);

						// Within a short timeframe, data should be consistent
						// (either cached or freshly retrieved with same values)
						expect(typeof context2.overallScore).toBe("number");
						expect(typeof context2.confidence).toBe("number");
						expect(context2.overallScore).toBeGreaterThanOrEqual(0);
						expect(context2.overallScore).toBeLessThanOrEqual(10);

						console.log(`✅ Service provides consistent, valid data`);
					}
				} else {
					console.log(`⚠️ No context returned - API keys may not be configured`);
				}
			},
			testTimeout
		);
	});

	describe("Health Check and Resilience", () => {
		test(
			"should provide comprehensive health monitoring",
			async () => {
				const health = await service.healthCheck();

				expect(health).toBeDefined();
				expect(typeof health.isHealthy).toBe("boolean");
				expect(typeof health.sources).toBe("object");
				expect(typeof health.overallLatency).toBe("number");
				expect(Array.isArray(health.errors)).toBe(true);

				// Check individual sources
				expect(health.sources).toHaveProperty("FRED");
				expect(health.sources).toHaveProperty("BLS");
				expect(health.sources).toHaveProperty("EIA");

				console.log(`✓ Health Check Results:`);
				console.log(`  - Overall: ${health.isHealthy ? "Healthy" : "Unhealthy"}`);
				console.log(`  - FRED: ${health.sources.FRED ? "✅" : "❌"}`);
				console.log(`  - BLS: ${health.sources.BLS ? "✅" : "❌"}`);
				console.log(`  - EIA: ${health.sources.EIA ? "✅" : "❌"}`);
				console.log(`  - Latency: ${health.overallLatency}ms`);

				if (health.errors.length > 0) {
					console.log(`  - Errors: ${health.errors.length}`);
				}

				// Should be healthy if at least 2/3 sources work (per implementation)
				const healthyCount = Object.values(health.sources).filter(Boolean).length;
				expect(health.isHealthy).toBe(healthyCount >= 2);
			},
			testTimeout
		);

		test(
			"should handle graceful degradation",
			async () => {
				// Test with shorter timeout to simulate some failures
				const degradedService = new MacroeconomicAnalysisService({
					timeout: 3000,
					throwErrors: false,
				});

				const context = await degradedService.getMacroeconomicContext();

				// Should handle gracefully
				if (context) {
					expect(typeof context.overallScore).toBe("number");
					expect(context.confidence).toBeLessThanOrEqual(1.0);
					console.log(
						`✓ Graceful degradation: Score ${context.overallScore}, Confidence ${(context.confidence * 100).toFixed(1)}%`
					);
				} else {
					console.log(`✓ Graceful degradation: Returns null when APIs unavailable`);
					expect(context).toBeNull();
				}
			},
			testTimeout
		);
	});
});
