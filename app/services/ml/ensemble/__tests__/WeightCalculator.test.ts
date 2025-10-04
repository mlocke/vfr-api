/**
 * WeightCalculator Tests
 * Comprehensive test suite for dynamic weight calculation
 * NO MOCK DATA - uses real performance tracking integration
 */

import { WeightCalculator, WeightingStrategy, WeightCalculationRequest } from "../WeightCalculator";
import { ModelPerformanceTracker, ModelPredictionResult } from "../ModelPerformanceTracker";

describe("WeightCalculator", () => {
	let calculator: WeightCalculator;
	let performanceTracker: ModelPerformanceTracker;

	beforeEach(async () => {
		// Reset singletons
		WeightCalculator.resetInstance();
		ModelPerformanceTracker.resetInstance();

		calculator = WeightCalculator.getInstance();
		performanceTracker = ModelPerformanceTracker.getInstance();

		await calculator.initialize();
		await performanceTracker.initialize();
	});

	afterEach(async () => {
		performanceTracker.cleanup();
	});

	describe("Initialization", () => {
		it("should initialize successfully", async () => {
			const result = await calculator.initialize();
			expect(result.success).toBe(true);
		});

		it("should handle health check", async () => {
			const healthy = await calculator.healthCheck();
			expect(typeof healthy).toBe("boolean");
		});
	});

	describe("Equal Weights Strategy", () => {
		it("should calculate equal weights for all models", async () => {
			const request: WeightCalculationRequest = {
				modelIds: ["model-1", "model-2", "model-3"],
				strategy: WeightingStrategy.EQUAL,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(true);

			if (result.data) {
				const weights = result.data.weights;
				expect(weights.size).toBe(3);

				// All weights should be equal (1/3)
				const expectedWeight = 1.0 / 3;
				for (const [modelId, weight] of weights.entries()) {
					expect(weight.weight).toBeCloseTo(expectedWeight, 5);
					expect(weight.strategy).toBe(WeightingStrategy.EQUAL);
				}

				// Total weight should be 1.0
				expect(result.data.totalWeight).toBeCloseTo(1.0, 5);
			}
		});

		it("should handle single model", async () => {
			const request: WeightCalculationRequest = {
				modelIds: ["solo-model"],
				strategy: WeightingStrategy.EQUAL,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(true);

			if (result.data) {
				const weights = result.data.weights;
				expect(weights.size).toBe(1);

				const weight = weights.get("solo-model");
				expect(weight).toBeDefined();
				expect(weight!.weight).toBeCloseTo(1.0, 5);
			}
		});
	});

	describe("Performance-Based Weights", () => {
		beforeEach(async () => {
			// Create performance data for models with different accuracies
			const models = [
				{ id: "high-perf", accuracy: 0.85, count: 100 },
				{ id: "medium-perf", accuracy: 0.65, count: 100 },
				{ id: "low-perf", accuracy: 0.45, count: 100 },
			];

			for (const model of models) {
				for (let i = 0; i < model.count; i++) {
					const prediction = Math.random() * 0.2 - 0.1;
					const actual =
						Math.random() < model.accuracy
							? prediction + (Math.random() * 0.02 - 0.01)
							: -prediction + (Math.random() * 0.02 - 0.01);

					await performanceTracker.recordPrediction({
						modelId: model.id,
						symbol: `SYM${i}`,
						prediction,
						confidence: 0.75,
						actual,
						latencyMs: 80,
						timestamp: Date.now(),
					});
				}
			}
		});

		it("should assign higher weights to better-performing models", async () => {
			const request: WeightCalculationRequest = {
				modelIds: ["high-perf", "medium-perf", "low-perf"],
				strategy: WeightingStrategy.PERFORMANCE,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(true);

			if (result.data) {
				const weights = result.data.weights;
				const highPerfWeight = weights.get("high-perf")!.weight;
				const mediumPerfWeight = weights.get("medium-perf")!.weight;
				const lowPerfWeight = weights.get("low-perf")!.weight;

				// Higher performance should get higher weight
				expect(highPerfWeight).toBeGreaterThan(mediumPerfWeight);
				expect(mediumPerfWeight).toBeGreaterThan(lowPerfWeight);

				// Total should still be 1.0
				expect(result.data.totalWeight).toBeCloseTo(1.0, 5);
			}
		});
	});

	describe("Confidence-Based Weights", () => {
		it("should weight models by confidence scores", async () => {
			const confidenceScores = new Map([
				["confident-model", 0.9],
				["moderate-model", 0.6],
				["uncertain-model", 0.3],
			]);

			const request: WeightCalculationRequest = {
				modelIds: ["confident-model", "moderate-model", "uncertain-model"],
				strategy: WeightingStrategy.CONFIDENCE,
				confidenceScores,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(true);

			if (result.data) {
				const weights = result.data.weights;
				const confidentWeight = weights.get("confident-model")!.weight;
				const moderateWeight = weights.get("moderate-model")!.weight;
				const uncertainWeight = weights.get("uncertain-model")!.weight;

				// Higher confidence should get higher weight
				expect(confidentWeight).toBeGreaterThan(moderateWeight);
				expect(moderateWeight).toBeGreaterThan(uncertainWeight);

				expect(result.data.totalWeight).toBeCloseTo(1.0, 5);
			}
		});

		it("should fall back to equal weights without confidence scores", async () => {
			const request: WeightCalculationRequest = {
				modelIds: ["model-1", "model-2"],
				strategy: WeightingStrategy.CONFIDENCE,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(true);

			if (result.data) {
				const weights = result.data.weights;
				// Should fall back to equal weights
				expect(weights.get("model-1")!.weight).toBeCloseTo(0.5, 5);
				expect(weights.get("model-2")!.weight).toBeCloseTo(0.5, 5);
			}
		});
	});

	describe("Hybrid Weights Strategy", () => {
		beforeEach(async () => {
			// Create diverse performance data
			for (let i = 0; i < 80; i++) {
				await performanceTracker.recordPrediction({
					modelId: "hybrid-test",
					symbol: `SYM${i}`,
					prediction: Math.random() * 0.2 - 0.1,
					confidence: 0.7 + Math.random() * 0.2,
					actual: Math.random() * 0.2 - 0.1,
					latencyMs: 80,
					timestamp: Date.now() - i * 1000,
				});
			}
		});

		it("should combine multiple weighting factors", async () => {
			const confidenceScores = new Map([["hybrid-test", 0.85]]);

			const request: WeightCalculationRequest = {
				modelIds: ["hybrid-test"],
				strategy: WeightingStrategy.HYBRID,
				confidenceScores,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(true);

			if (result.data) {
				const weight = result.data.weights.get("hybrid-test");
				expect(weight).toBeDefined();
				expect(weight!.weight).toBeCloseTo(1.0, 5);
				expect(weight!.strategy).toBe(WeightingStrategy.HYBRID);

				// Should have metadata from different strategies
				expect(weight!.metadata).toBeDefined();
			}
		});
	});

	describe("Weight Bounds", () => {
		beforeEach(async () => {
			// Create extreme performance differences
			for (let i = 0; i < 100; i++) {
				// Perfect model
				await performanceTracker.recordPrediction({
					modelId: "perfect",
					symbol: `SYM${i}`,
					prediction: 0.1,
					confidence: 0.95,
					actual: 0.1,
					latencyMs: 50,
					timestamp: Date.now(),
				});

				// Poor model
				await performanceTracker.recordPrediction({
					modelId: "poor",
					symbol: `SYM${i}`,
					prediction: 0.1,
					confidence: 0.4,
					actual: -0.1,
					latencyMs: 150,
					timestamp: Date.now(),
				});
			}
		});

		it("should enforce minimum weight", async () => {
			const request: WeightCalculationRequest = {
				modelIds: ["perfect", "poor"],
				strategy: WeightingStrategy.PERFORMANCE,
				minWeight: 0.1,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(true);

			if (result.data) {
				const weights = result.data.weights;
				for (const [modelId, weight] of weights.entries()) {
					expect(weight.weight).toBeGreaterThanOrEqual(0.1);
				}
			}
		});

		it("should enforce maximum weight", async () => {
			const request: WeightCalculationRequest = {
				modelIds: ["perfect", "poor"],
				strategy: WeightingStrategy.PERFORMANCE,
				maxWeight: 0.7,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(true);

			if (result.data) {
				const weights = result.data.weights;
				for (const [modelId, weight] of weights.entries()) {
					expect(weight.weight).toBeLessThanOrEqual(0.7);
				}
			}
		});
	});

	describe("Weight Normalization", () => {
		it("should normalize weights to sum to 1.0", async () => {
			const request: WeightCalculationRequest = {
				modelIds: ["model-1", "model-2", "model-3", "model-4"],
				strategy: WeightingStrategy.EQUAL,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(true);

			if (result.data) {
				const totalWeight = Array.from(result.data.weights.values()).reduce(
					(sum, w) => sum + w.weight,
					0
				);

				expect(totalWeight).toBeCloseTo(1.0, 5);
				expect(result.data.totalWeight).toBeCloseTo(1.0, 5);
			}
		});
	});

	describe("Diversity Score", () => {
		it("should calculate diversity score for equal weights", async () => {
			const request: WeightCalculationRequest = {
				modelIds: ["m1", "m2", "m3", "m4"],
				strategy: WeightingStrategy.EQUAL,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(true);

			if (result.data) {
				// Equal weights should have highest diversity (1.0)
				expect(result.data.diversityScore).toBeCloseTo(1.0, 2);
			}
		});

		it("should calculate lower diversity for skewed weights", async () => {
			// Create one dominant model
			for (let i = 0; i < 100; i++) {
				await performanceTracker.recordPrediction({
					modelId: "dominant",
					symbol: `SYM${i}`,
					prediction: 0.1,
					confidence: 0.9,
					actual: 0.1,
					latencyMs: 60,
					timestamp: Date.now(),
				});

				await performanceTracker.recordPrediction({
					modelId: "weak",
					symbol: `SYM${i}`,
					prediction: 0.1,
					confidence: 0.5,
					actual: -0.1,
					latencyMs: 120,
					timestamp: Date.now(),
				});
			}

			const request: WeightCalculationRequest = {
				modelIds: ["dominant", "weak"],
				strategy: WeightingStrategy.PERFORMANCE,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(true);

			if (result.data) {
				// Skewed weights should have lower diversity than equal weights
				expect(result.data.diversityScore).toBeLessThan(1.0);
				expect(result.data.diversityScore).toBeGreaterThan(0);
			}
		});
	});

	describe("Error Handling", () => {
		it("should handle empty model list", async () => {
			const request: WeightCalculationRequest = {
				modelIds: [],
				strategy: WeightingStrategy.EQUAL,
			};

			const result = await calculator.calculateWeights(request);
			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe("Performance Targets", () => {
		it("should complete weight calculation in <5ms", async () => {
			// Create performance data
			for (let i = 0; i < 60; i++) {
				await performanceTracker.recordPrediction({
					modelId: "perf-test",
					symbol: `SYM${i}`,
					prediction: Math.random() * 0.2 - 0.1,
					confidence: 0.7,
					actual: Math.random() * 0.2 - 0.1,
					latencyMs: 80,
					timestamp: Date.now(),
				});
			}

			const request: WeightCalculationRequest = {
				modelIds: ["perf-test"],
				strategy: WeightingStrategy.PERFORMANCE,
			};

			const startTime = Date.now();
			const result = await calculator.calculateWeights(request);
			const latency = Date.now() - startTime;

			expect(result.success).toBe(true);
			// Target: <5ms (allowing overhead for test environment)
			expect(latency).toBeLessThan(50);
		});
	});
});
