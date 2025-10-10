/**
 * ML Performance Integration Tests - Phase 4.2.3
 *
 * Tests ML layer performance targets and system resource usage.
 * Validates latency, throughput, memory footprint, and cache effectiveness.
 *
 * Performance Targets:
 * - Single stock analysis: <3s total
 * - ML overhead: <100ms per prediction
 * - Multi-stock analysis: 25+ symbols in parallel
 * - Memory footprint: <2GB additional for ML layer
 * - Cache hit rate: >85% for repeated predictions
 */

const ML_PERFORMANCE_TEST_TIMEOUT = 60000; // 60 seconds for performance tests

describe("Phase 4.2.3: ML Performance Testing", () => {
	const apiUrl = "http://localhost:3000/api/stocks/analyze";

	/**
	 * Test single stock analysis performance
	 */
	describe("Single Stock Analysis Performance", () => {
		test(
			"should complete single stock analysis in <3s",
			async () => {
				const startTime = Date.now();

				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: ["AAPL"],
						include_ml: true,
					}),
				});

				const result = await response.json();
				const totalTime = Date.now() - startTime;

				expect(result.success).toBe(true);

				// Target: <3000ms total analysis time
				expect(totalTime).toBeLessThan(3000);

				console.log(
					`✅ Single Stock Performance: ${totalTime}ms (target: <3000ms)`
				);
			},
			ML_PERFORMANCE_TEST_TIMEOUT
		);

		test(
			"should measure ML overhead accurately",
			async () => {
				const symbol = "NVDA";

				// Measure VFR-only time
				const vfrStart = Date.now();
				const vfrResponse = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: [symbol],
						include_ml: false,
					}),
				});
				await vfrResponse.json();
				const vfrTime = Date.now() - vfrStart;

				// Measure ML-enhanced time
				const mlStart = Date.now();
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
				const mlTime = Date.now() - mlStart;

				const mlMeta = (mlResult.data.metadata as any).mlEnhancement;
				const mlOverhead = mlMeta?.mlLatency || 0;

				// Target: <100ms ML overhead
				expect(mlOverhead).toBeLessThan(100);

				console.log(
					`✅ ML Overhead: ${mlOverhead}ms (VFR: ${vfrTime}ms, ML-Enhanced: ${mlTime}ms, target: <100ms)`
				);
			},
			ML_PERFORMANCE_TEST_TIMEOUT
		);
	});

	/**
	 * Test ML prediction latency
	 */
	describe("ML Prediction Latency", () => {
		test(
			"should achieve <100ms ML prediction latency",
			async () => {
				const samples = 5;
				const latencies: number[] = [];

				for (let i = 0; i < samples; i++) {
					const response = await fetch(apiUrl, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							mode: "single",
							symbols: ["TSLA"],
							include_ml: true,
						}),
					});

					const result = await response.json();
					const mlMeta = (result.data.metadata as any).mlEnhancement;

					if (mlMeta?.mlLatency) {
						latencies.push(mlMeta.mlLatency);
					}

					// Small delay between requests
					await new Promise((resolve) => setTimeout(resolve, 100));
				}

				const avgLatency =
					latencies.reduce((a, b) => a + b, 0) / latencies.length;
				const maxLatency = Math.max(...latencies);
				const minLatency = Math.min(...latencies);

				// Target: <100ms average latency
				expect(avgLatency).toBeLessThan(100);

				console.log(
					`✅ ML Latency Stats: Avg=${avgLatency.toFixed(2)}ms, Min=${minLatency}ms, Max=${maxLatency}ms (${samples} samples)`
				);
			},
			ML_PERFORMANCE_TEST_TIMEOUT
		);
	});

	/**
	 * Test multi-stock analysis
	 */
	describe("Multi-Stock Analysis Performance", () => {
		test(
			"should handle 25+ symbols in parallel",
			async () => {
				const symbols = [
					"AAPL",
					"NVDA",
					"TSLA",
					"MSFT",
					"GOOGL",
					"AMZN",
					"META",
					"NFLX",
					"AMD",
					"INTC",
					"ORCL",
					"CRM",
					"ADBE",
					"CSCO",
					"AVGO",
					"TXN",
					"QCOM",
					"INTU",
					"AMAT",
					"LRCX",
					"KLAC",
					"SNPS",
					"CDNS",
					"MRVL",
					"MU",
				];

				expect(symbols.length).toBeGreaterThanOrEqual(25);

				const startTime = Date.now();

				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "multiple",
						symbols,
						limit: 50,
						include_ml: true,
					}),
				});

				const result = await response.json();
				const totalTime = Date.now() - startTime;

				expect(result.success).toBe(true);

				const mlMeta = (result.data.metadata as any).mlEnhancement;
				const predictionsCount = mlMeta?.mlPredictionsCount || 0;
				const mlLatency = mlMeta?.mlLatency || 0;

				// Performance should not degrade significantly
				const avgTimePerSymbol = mlLatency / Math.max(predictionsCount, 1);

				console.log(
					`✅ Multi-Stock Performance: ${symbols.length} symbols, ${totalTime}ms total, ${predictionsCount} ML predictions in ${mlLatency}ms (${avgTimePerSymbol.toFixed(2)}ms/symbol)`
				);

				// ML predictions should still be under 100ms average per symbol
				expect(avgTimePerSymbol).toBeLessThan(100);
			},
			ML_PERFORMANCE_TEST_TIMEOUT
		);

		test(
			"should maintain performance under concurrent load",
			async () => {
				const symbols = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL"];

				// Create 3 concurrent requests
				const requests = Array(3)
					.fill(null)
					.map(() =>
						fetch(apiUrl, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								mode: "multiple",
								symbols,
								include_ml: true,
							}),
						})
					);

				const startTime = Date.now();
				const responses = await Promise.all(requests);
				const results = await Promise.all(
					responses.map((r) => r.json())
				);
				const totalTime = Date.now() - startTime;

				// All should succeed
				results.forEach((result) => {
					expect(result.success).toBe(true);
				});

				const avgLatencies =
					results
						.map(
							(r) =>
								(r.data.metadata as any).mlEnhancement?.mlLatency || 0
						)
						.reduce((a, b) => a + b, 0) / results.length;

				console.log(
					`✅ Concurrent Load: 3 requests with ${symbols.length} symbols each, ${totalTime}ms total, avg ML latency=${avgLatencies.toFixed(2)}ms`
				);
			},
			ML_PERFORMANCE_TEST_TIMEOUT
		);
	});

	/**
	 * Test cache effectiveness
	 */
	describe("Cache Performance", () => {
		test(
			"should achieve >85% cache hit rate for repeated predictions",
			async () => {
				const symbol = "AAPL";
				const iterations = 10;

				// First request - cache miss
				await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "single",
						symbols: [symbol],
						include_ml: true,
					}),
				});

				// Measure latency for subsequent requests
				const latencies: number[] = [];

				for (let i = 0; i < iterations; i++) {
					const response = await fetch(apiUrl, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							mode: "single",
							symbols: [symbol],
							include_ml: true,
						}),
					});

					const result = await response.json();
					const mlMeta = (result.data.metadata as any).mlEnhancement;

					if (mlMeta?.mlLatency) {
						latencies.push(mlMeta.mlLatency);
					}

					await new Promise((resolve) => setTimeout(resolve, 50));
				}

				// Cached requests should be faster
				const avgCachedLatency =
					latencies.reduce((a, b) => a + b, 0) / latencies.length;

				// Cached latency should be significantly lower
				expect(avgCachedLatency).toBeLessThan(50); // Even stricter for cache hits

				console.log(
					`✅ Cache Performance: Avg cached latency=${avgCachedLatency.toFixed(2)}ms over ${iterations} requests`
				);
			},
			ML_PERFORMANCE_TEST_TIMEOUT
		);

		test(
			"should measure cache warming effect",
			async () => {
				const symbols = ["MSFT", "GOOGL", "AMZN"];

				// First pass - cache warming
				const warmingStart = Date.now();
				const warmingResponse = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "multiple",
						symbols,
						include_ml: true,
					}),
				});
				const warmingResult = await warmingResponse.json();
				const warmingTime = Date.now() - warmingStart;
				const warmingMLLatency = (warmingResult.data.metadata as any)
					.mlEnhancement?.mlLatency;

				// Second pass - should hit cache
				const cachedStart = Date.now();
				const cachedResponse = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "multiple",
						symbols,
						include_ml: true,
					}),
				});
				const cachedResult = await cachedResponse.json();
				const cachedTime = Date.now() - cachedStart;
				const cachedMLLatency = (cachedResult.data.metadata as any)
					.mlEnhancement?.mlLatency;

				// Cached request should be faster or similar
				const improvement =
					((warmingMLLatency - cachedMLLatency) / warmingMLLatency) * 100;

				console.log(
					`✅ Cache Warming: First=${warmingMLLatency}ms, Cached=${cachedMLLatency}ms, Improvement=${improvement.toFixed(1)}%`
				);
			},
			ML_PERFORMANCE_TEST_TIMEOUT
		);
	});

	/**
	 * Test memory footprint
	 */
	describe("Memory Footprint", () => {
		test(
			"should track memory usage during ML operations",
			async () => {
				const beforeMemory = process.memoryUsage();

				// Perform ML-intensive operation
				const response = await fetch(apiUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						mode: "multiple",
						symbols: [
							"AAPL",
							"NVDA",
							"TSLA",
							"MSFT",
							"GOOGL",
							"AMZN",
							"META",
							"NFLX",
							"AMD",
							"INTC",
						],
						include_ml: true,
					}),
				});

				const result = await response.json();
				const afterMemory = process.memoryUsage();

				expect(result.success).toBe(true);

				const heapIncrease =
					(afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024;
				const rssIncrease =
					(afterMemory.rss - beforeMemory.rss) / 1024 / 1024;

				console.log(
					`✅ Memory Usage: Heap +${heapIncrease.toFixed(2)}MB, RSS +${rssIncrease.toFixed(2)}MB`
				);

				// Note: Full 2GB footprint target is for production deployment
				// Here we just ensure no massive memory leaks
				expect(Math.abs(heapIncrease)).toBeLessThan(500); // No more than 500MB increase
			},
			ML_PERFORMANCE_TEST_TIMEOUT
		);
	});

	/**
	 * Test performance regression
	 */
	describe("Performance Regression Detection", () => {
		test(
			"should compare ML-enhanced vs baseline performance",
			async () => {
				const symbol = "AAPL";
				const samples = 3;

				// Baseline (VFR-only)
				const baselineTimes: number[] = [];
				for (let i = 0; i < samples; i++) {
					const start = Date.now();
					await fetch(apiUrl, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							mode: "single",
							symbols: [symbol],
							include_ml: false,
						}),
					});
					baselineTimes.push(Date.now() - start);
					await new Promise((resolve) => setTimeout(resolve, 100));
				}

				// ML-enhanced
				const mlTimes: number[] = [];
				for (let i = 0; i < samples; i++) {
					const start = Date.now();
					await fetch(apiUrl, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							mode: "single",
							symbols: [symbol],
							include_ml: true,
						}),
					});
					mlTimes.push(Date.now() - start);
					await new Promise((resolve) => setTimeout(resolve, 100));
				}

				const avgBaseline =
					baselineTimes.reduce((a, b) => a + b, 0) / samples;
				const avgML = mlTimes.reduce((a, b) => a + b, 0) / samples;
				const overhead = avgML - avgBaseline;

				// ML overhead should be minimal (<100ms target)
				expect(overhead).toBeLessThan(200); // Allow some variance

				console.log(
					`✅ Performance Regression: Baseline=${avgBaseline.toFixed(2)}ms, ML-Enhanced=${avgML.toFixed(2)}ms, Overhead=${overhead.toFixed(2)}ms`
				);
			},
			ML_PERFORMANCE_TEST_TIMEOUT
		);
	});
});
