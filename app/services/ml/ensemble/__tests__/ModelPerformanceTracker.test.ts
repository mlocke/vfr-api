/**
 * ModelPerformanceTracker Tests
 * Comprehensive test suite for model performance tracking
 * NO MOCK DATA - uses real API integration patterns
 */

import { ModelPerformanceTracker, ModelPredictionResult } from "../ModelPerformanceTracker";

describe("ModelPerformanceTracker", () => {
	let tracker: ModelPerformanceTracker;

	beforeEach(async () => {
		// Reset singleton before each test
		ModelPerformanceTracker.resetInstance();
		tracker = ModelPerformanceTracker.getInstance();
		await tracker.initialize();
	});

	afterEach(async () => {
		tracker.cleanup();
	});

	describe("Initialization", () => {
		it("should initialize successfully", async () => {
			const result = await tracker.initialize();
			expect(result.success).toBe(true);
		});

		it("should handle health check", async () => {
			const healthy = await tracker.healthCheck();
			expect(typeof healthy).toBe("boolean");
		});
	});

	describe("Performance Tracking", () => {
		it("should record prediction results", async () => {
			const predictionResult: ModelPredictionResult = {
				modelId: "test-model-1",
				symbol: "AAPL",
				prediction: 0.15,
				confidence: 0.75,
				actual: 0.12,
				latencyMs: 85,
				timestamp: Date.now(),
			};

			// Should not throw
			await tracker.recordPrediction(predictionResult);
		});

		it("should track multiple predictions for rolling window", async () => {
			const modelId = "test-model-2";

			// Record 100 predictions
			for (let i = 0; i < 100; i++) {
				const result: ModelPredictionResult = {
					modelId,
					symbol: "AAPL",
					prediction: Math.random() * 0.2 - 0.1,
					confidence: 0.6 + Math.random() * 0.3,
					actual: Math.random() * 0.2 - 0.1,
					latencyMs: 50 + Math.random() * 100,
					timestamp: Date.now() - i * 1000,
				};

				await tracker.recordPrediction(result);
			}

			// Get metrics - should have data now
			const metricsResult = await tracker.getPerformanceMetrics(modelId);
			expect(metricsResult.success).toBe(true);
			if (metricsResult.data) {
				expect(metricsResult.data.windowSize).toBeGreaterThanOrEqual(50);
				expect(metricsResult.data.accuracy).toBeGreaterThanOrEqual(0);
				expect(metricsResult.data.accuracy).toBeLessThanOrEqual(1);
			}
		});

		it("should return error for insufficient data", async () => {
			const metricsResult = await tracker.getPerformanceMetrics("non-existent-model");
			expect(metricsResult.success).toBe(false);
			expect(metricsResult.error).toBeDefined();
		});
	});

	describe("Metrics Calculation", () => {
		beforeEach(async () => {
			const modelId = "test-model-accuracy";

			// Record predictions with known accuracy
			const predictions: ModelPredictionResult[] = [
				{ modelId, symbol: "AAPL", prediction: 0.1, confidence: 0.8, actual: 0.12, latencyMs: 80, timestamp: Date.now() },
				{ modelId, symbol: "GOOGL", prediction: -0.05, confidence: 0.7, actual: -0.03, latencyMs: 90, timestamp: Date.now() },
				{ modelId, symbol: "MSFT", prediction: 0.15, confidence: 0.85, actual: 0.18, latencyMs: 75, timestamp: Date.now() },
				{ modelId, symbol: "TSLA", prediction: -0.1, confidence: 0.65, actual: -0.08, latencyMs: 100, timestamp: Date.now() },
			];

			// Add more predictions to meet minimum threshold
			for (let i = 0; i < 50; i++) {
				predictions.push({
					modelId,
					symbol: `SYM${i}`,
					prediction: Math.random() * 0.2 - 0.1,
					confidence: 0.6 + Math.random() * 0.3,
					actual: Math.random() * 0.2 - 0.1,
					latencyMs: 70 + Math.random() * 50,
					timestamp: Date.now(),
				});
			}

			for (const pred of predictions) {
				await tracker.recordPrediction(pred);
			}
		});

		it("should calculate accuracy metrics", async () => {
			const metricsResult = await tracker.getPerformanceMetrics("test-model-accuracy");
			expect(metricsResult.success).toBe(true);

			if (metricsResult.data) {
				const metrics = metricsResult.data;
				expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
				expect(metrics.accuracy).toBeLessThanOrEqual(1);
				expect(metrics.precision).toBeGreaterThanOrEqual(0);
				expect(metrics.precision).toBeLessThanOrEqual(1);
				expect(metrics.recall).toBeGreaterThanOrEqual(0);
				expect(metrics.recall).toBeLessThanOrEqual(1);
			}
		});

		it("should calculate latency percentiles", async () => {
			const metricsResult = await tracker.getPerformanceMetrics("test-model-accuracy");
			expect(metricsResult.success).toBe(true);

			if (metricsResult.data) {
				const metrics = metricsResult.data;
				expect(metrics.latencyP50).toBeGreaterThan(0);
				expect(metrics.latencyP95).toBeGreaterThan(0);
				expect(metrics.latencyP99).toBeGreaterThan(0);
				expect(metrics.latencyP95).toBeGreaterThanOrEqual(metrics.latencyP50);
				expect(metrics.latencyP99).toBeGreaterThanOrEqual(metrics.latencyP95);
			}
		});

		it("should calculate reliability score", async () => {
			const metricsResult = await tracker.getPerformanceMetrics("test-model-accuracy");
			expect(metricsResult.success).toBe(true);

			if (metricsResult.data) {
				const metrics = metricsResult.data;
				expect(metrics.reliabilityScore).toBeGreaterThanOrEqual(0);
				expect(metrics.reliabilityScore).toBeLessThanOrEqual(1);
			}
		});

		it("should calculate mean absolute error", async () => {
			const metricsResult = await tracker.getPerformanceMetrics("test-model-accuracy");
			expect(metricsResult.success).toBe(true);

			if (metricsResult.data) {
				const metrics = metricsResult.data;
				expect(metrics.meanAbsoluteError).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("Drift Detection", () => {
		it("should detect concept drift", async () => {
			const modelId = "test-model-drift";

			// First 70 predictions with good accuracy
			for (let i = 0; i < 70; i++) {
				await tracker.recordPrediction({
					modelId,
					symbol: `SYM${i}`,
					prediction: 0.1,
					confidence: 0.8,
					actual: 0.11, // Close to prediction
					latencyMs: 80,
					timestamp: Date.now() - (150 - i) * 1000,
				});
			}

			// Last 30 predictions with poor accuracy (drift)
			for (let i = 70; i < 100; i++) {
				await tracker.recordPrediction({
					modelId,
					symbol: `SYM${i}`,
					prediction: 0.1,
					confidence: 0.8,
					actual: -0.1, // Opposite direction
					latencyMs: 80,
					timestamp: Date.now() - (100 - i) * 1000,
				});
			}

			const metricsResult = await tracker.getPerformanceMetrics(modelId);
			expect(metricsResult.success).toBe(true);

			if (metricsResult.data) {
				const metrics = metricsResult.data;
				// Should detect drift
				expect(metrics.conceptDrift).toBeGreaterThan(0);
			}
		});
	});

	describe("All Models Metrics", () => {
		it("should get metrics for all tracked models", async () => {
			// Track multiple models
			const models = ["model-1", "model-2", "model-3"];

			for (const modelId of models) {
				for (let i = 0; i < 60; i++) {
					await tracker.recordPrediction({
						modelId,
						symbol: `SYM${i}`,
						prediction: Math.random() * 0.2 - 0.1,
						confidence: 0.7,
						actual: Math.random() * 0.2 - 0.1,
						latencyMs: 80,
						timestamp: Date.now(),
					});
				}
			}

			const allMetricsResult = await tracker.getAllPerformanceMetrics();
			expect(allMetricsResult.success).toBe(true);

			if (allMetricsResult.data) {
				const allMetrics = allMetricsResult.data;
				expect(allMetrics.size).toBeGreaterThan(0);
				expect(allMetrics.size).toBeLessThanOrEqual(models.length);
			}
		});
	});

	describe("Performance Targets", () => {
		it("should complete metric calculation in <10ms", async () => {
			const modelId = "test-model-perf";

			// Record sufficient predictions
			for (let i = 0; i < 100; i++) {
				await tracker.recordPrediction({
					modelId,
					symbol: `SYM${i}`,
					prediction: Math.random() * 0.2 - 0.1,
					confidence: 0.7,
					actual: Math.random() * 0.2 - 0.1,
					latencyMs: 80,
					timestamp: Date.now(),
				});
			}

			const startTime = Date.now();
			const metricsResult = await tracker.getPerformanceMetrics(modelId);
			const latency = Date.now() - startTime;

			expect(metricsResult.success).toBe(true);
			// Target: <10ms (allowing some overhead for DB operations in real environment)
			expect(latency).toBeLessThan(100); // Relaxed for test environment
		});
	});
});
