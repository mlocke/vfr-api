/**
 * InferenceOptimizer Test Suite
 *
 * Tests algorithm-specific optimizations and feature preprocessing
 */

import { InferenceOptimizer } from "../InferenceOptimizer";
import { MLModelType, MLFeatureVector, MLFeatureType } from "../../types/MLTypes";

describe("InferenceOptimizer", () => {
	let optimizer: InferenceOptimizer;

	beforeEach(() => {
		optimizer = new InferenceOptimizer({
			useFloat32: true,
			enableVectorization: true,
			normalizeInputs: true,
			cachePreprocessing: true,
		});
	});

	describe("Initialization", () => {
		test("should initialize with default config", () => {
			const defaultOptimizer = new InferenceOptimizer();
			expect(defaultOptimizer).toBeDefined();
		});

		test("should initialize with custom config", () => {
			const customOptimizer = new InferenceOptimizer({
				useFloat32: false,
				enableVectorization: false,
				normalizeInputs: false,
				cachePreprocessing: false,
			});
			expect(customOptimizer).toBeDefined();
		});
	});

	describe("Feature Vector Optimization", () => {
		const createTestFeatureVector = (): MLFeatureVector => ({
			symbol: "AAPL",
			features: {
				rsi_14: 65.5,
				sma_50: 175.2,
				volume_ratio: 1.3,
				price_change: 2.5,
				volatility: 0.25,
			},
			featureNames: ["rsi_14", "sma_50", "volume_ratio", "price_change", "volatility"],
			timestamp: Date.now(),
			completeness: 1.0,
			qualityScore: 0.95,
		});

		test("should optimize for LightGBM", () => {
			const featureVector = createTestFeatureVector();

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.LIGHTGBM);

			expect(result).toBeDefined();
			expect(result.optimizedVector).toBeDefined();
			expect(result.optimizedVector.values).toBeInstanceOf(Float32Array);
			expect(result.optimizedVector.values.length).toBe(featureVector.featureNames.length);
			expect(result.preprocessingTimeMs).toBeGreaterThanOrEqual(0);
		});

		test("should optimize for XGBoost", () => {
			const featureVector = createTestFeatureVector();

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.XGBOOST);

			expect(result).toBeDefined();
			expect(result.optimizedVector.values).toBeInstanceOf(Float32Array);
			expect(result.normalizationParams).toBeDefined();
		});

		test("should optimize for LSTM", () => {
			const featureVector = createTestFeatureVector();

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.LSTM);

			expect(result).toBeDefined();
			expect(result.optimizedVector.values).toBeInstanceOf(Float32Array);
			expect(result.normalizationParams).toBeDefined();
			expect(result.normalizationParams?.mean).toBeDefined();
			expect(result.normalizationParams?.std).toBeDefined();
		});

		test("should optimize for Ensemble", () => {
			const featureVector = createTestFeatureVector();

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.ENSEMBLE);

			expect(result).toBeDefined();
			expect(result.optimizedVector.values).toBeInstanceOf(Float32Array);
		});

		test("should preserve feature order", () => {
			const featureVector = createTestFeatureVector();

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.LIGHTGBM);

			expect(result.optimizedVector.featureNames).toEqual(featureVector.featureNames);
			expect(result.optimizedVector.symbol).toBe(featureVector.symbol);
		});

		test("should use Float32Array for performance", () => {
			const featureVector = createTestFeatureVector();

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.LIGHTGBM);

			expect(result.optimizedVector.values).toBeInstanceOf(Float32Array);
		});
	});

	describe("Normalization", () => {
		const createFeatureVector = (values: number[]): MLFeatureVector => ({
			symbol: "TEST",
			features: Object.fromEntries(values.map((v, i) => [`feature_${i}`, v])),
			featureNames: values.map((_, i) => `feature_${i}`),
			timestamp: Date.now(),
			completeness: 1.0,
			qualityScore: 0.95,
		});

		test("should normalize values to [0, 1] range for LightGBM", () => {
			const featureVector = createFeatureVector([10, 20, 30, 40, 50]);

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.LIGHTGBM);

			const values = Array.from(result.optimizedVector.values);

			// Check all values are in [0, 1] range
			values.forEach(v => {
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThanOrEqual(1);
			});

			// Min value should be ~0
			expect(Math.min(...values)).toBeCloseTo(0, 5);

			// Max value should be ~1
			expect(Math.max(...values)).toBeCloseTo(1, 5);
		});

		test("should standardize values for LSTM", () => {
			const featureVector = createFeatureVector([10, 20, 30, 40, 50]);

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.LSTM);

			const values = Array.from(result.optimizedVector.values);

			// Calculate mean and std
			const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
			const variance =
				values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
			const std = Math.sqrt(variance);

			// Mean should be close to 0
			expect(mean).toBeCloseTo(0, 5);

			// Std should be close to 1
			expect(std).toBeCloseTo(1, 5);
		});

		test("should handle uniform values gracefully", () => {
			const featureVector = createFeatureVector([5, 5, 5, 5, 5]);

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.LIGHTGBM);

			// Should not throw error
			expect(result).toBeDefined();
			expect(result.optimizedVector.values).toBeDefined();
		});

		test("should handle negative values", () => {
			const featureVector = createFeatureVector([-10, -5, 0, 5, 10]);

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.XGBOOST);

			expect(result).toBeDefined();
			expect(result.optimizedVector.values).toBeDefined();
		});
	});

	describe("Batch Optimization", () => {
		const createBatchFeatureVectors = (count: number): MLFeatureVector[] => {
			return Array.from({ length: count }, (_, i) => ({
				symbol: `STOCK${i}`,
				features: {
					rsi: 50 + i,
					sma: 100 + i * 10,
					volume: 1000000 + i * 100000,
				},
				featureNames: ["rsi", "sma", "volume"],
				timestamp: Date.now(),
				completeness: 1.0,
				qualityScore: 0.9,
			}));
		};

		test("should optimize batch of feature vectors", () => {
			const batch = createBatchFeatureVectors(10);

			const results = optimizer.optimizeBatch(batch, MLModelType.LIGHTGBM);

			expect(results).toHaveLength(10);
			results.forEach(result => {
				expect(result.optimizedVector.values).toBeInstanceOf(Float32Array);
				expect(result.preprocessingTimeMs).toBeGreaterThanOrEqual(0);
			});
		});

		test("should handle empty batch", () => {
			const results = optimizer.optimizeBatch([], MLModelType.LIGHTGBM);
			expect(results).toHaveLength(0);
		});

		test("should handle large batches efficiently", () => {
			const batch = createBatchFeatureVectors(100);
			const startTime = Date.now();

			const results = optimizer.optimizeBatch(batch, MLModelType.XGBOOST);

			const totalTime = Date.now() - startTime;

			expect(results).toHaveLength(100);
			expect(totalTime).toBeLessThan(5000); // Should complete in <5 seconds
		});
	});

	describe("Missing Feature Imputation", () => {
		test("should impute missing features with zero strategy", () => {
			const featureVector: MLFeatureVector = {
				symbol: "TEST",
				features: { feature1: 10, feature2: 20 },
				featureNames: ["feature1", "feature2"],
				timestamp: Date.now(),
				completeness: 0.67,
				qualityScore: 0.8,
			};

			const required = ["feature1", "feature2", "feature3"];

			const result = optimizer.imputeMissingFeatures(featureVector, required, "zero");

			expect(result.features.feature3).toBe(0);
			expect(result.featureNames).toEqual(required);
		});

		test("should impute missing features with mean strategy", () => {
			const featureVector: MLFeatureVector = {
				symbol: "TEST",
				features: { feature1: 10, feature2: 20 },
				featureNames: ["feature1", "feature2"],
				timestamp: Date.now(),
				completeness: 0.67,
				qualityScore: 0.8,
			};

			const required = ["feature1", "feature2", "feature3"];

			const result = optimizer.imputeMissingFeatures(featureVector, required, "mean");

			expect(result.features.feature3).toBe(15); // Mean of 10 and 20
			expect(result.featureNames).toEqual(required);
		});

		test("should impute missing features with median strategy", () => {
			const featureVector: MLFeatureVector = {
				symbol: "TEST",
				features: { feature1: 10, feature2: 30, feature3: 20 },
				featureNames: ["feature1", "feature2", "feature3"],
				timestamp: Date.now(),
				completeness: 0.75,
				qualityScore: 0.8,
			};

			const required = ["feature1", "feature2", "feature3", "feature4"];

			const result = optimizer.imputeMissingFeatures(featureVector, required, "median");

			expect(result.features.feature4).toBe(20); // Median of [10, 20, 30]
			expect(result.featureNames).toEqual(required);
		});

		test("should handle no missing features", () => {
			const featureVector: MLFeatureVector = {
				symbol: "TEST",
				features: { feature1: 10, feature2: 20, feature3: 30 },
				featureNames: ["feature1", "feature2", "feature3"],
				timestamp: Date.now(),
				completeness: 1.0,
				qualityScore: 0.95,
			};

			const required = ["feature1", "feature2", "feature3"];

			const result = optimizer.imputeMissingFeatures(featureVector, required, "zero");

			expect(result.features).toEqual(featureVector.features);
		});
	});

	describe("Feature Validation", () => {
		test("should validate correct feature vector", () => {
			const featureVector: MLFeatureVector = {
				symbol: "TEST",
				features: { feature1: 10, feature2: 20, feature3: 30 },
				featureNames: ["feature1", "feature2", "feature3"],
				timestamp: Date.now(),
				completeness: 1.0,
				qualityScore: 0.95,
			};

			const expected = ["feature1", "feature2", "feature3"];

			const validation = optimizer.validateDimensions(featureVector, expected);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toHaveLength(0);
		});

		test("should detect missing features", () => {
			const featureVector: MLFeatureVector = {
				symbol: "TEST",
				features: { feature1: 10, feature2: 20 },
				featureNames: ["feature1", "feature2"],
				timestamp: Date.now(),
				completeness: 0.67,
				qualityScore: 0.8,
			};

			const expected = ["feature1", "feature2", "feature3"];

			const validation = optimizer.validateDimensions(featureVector, expected);

			expect(validation.valid).toBe(false);
			expect(validation.errors.some(e => e.includes("Missing features"))).toBe(true);
		});

		test("should detect NaN values", () => {
			const featureVector: MLFeatureVector = {
				symbol: "TEST",
				features: { feature1: 10, feature2: NaN, feature3: 30 },
				featureNames: ["feature1", "feature2", "feature3"],
				timestamp: Date.now(),
				completeness: 1.0,
				qualityScore: 0.67,
			};

			const expected = ["feature1", "feature2", "feature3"];

			const validation = optimizer.validateDimensions(featureVector, expected);

			expect(validation.valid).toBe(false);
			expect(validation.errors.some(e => e.includes("Invalid value"))).toBe(true);
		});

		test("should detect Infinity values", () => {
			const featureVector: MLFeatureVector = {
				symbol: "TEST",
				features: { feature1: 10, feature2: Infinity, feature3: 30 },
				featureNames: ["feature1", "feature2", "feature3"],
				timestamp: Date.now(),
				completeness: 1.0,
				qualityScore: 0.67,
			};

			const expected = ["feature1", "feature2", "feature3"];

			const validation = optimizer.validateDimensions(featureVector, expected);

			expect(validation.valid).toBe(false);
			expect(validation.errors.some(e => e.includes("Invalid value"))).toBe(true);
		});
	});

	describe("Caching", () => {
		test("should cache preprocessing results", () => {
			const featureVector: MLFeatureVector = {
				symbol: "CACHE_TEST",
				features: { feature1: 10, feature2: 20 },
				featureNames: ["feature1", "feature2"],
				timestamp: 1000000,
				completeness: 1.0,
				qualityScore: 0.95,
			};

			// First optimization
			const result1 = optimizer.optimizeFeatureVector(featureVector, MLModelType.LIGHTGBM);

			// Second optimization (should use cache)
			const result2 = optimizer.optimizeFeatureVector(featureVector, MLModelType.LIGHTGBM);

			// Results should be identical
			expect(result1.optimizedVector.values).toEqual(result2.optimizedVector.values);
		});

		test("should clear cache", () => {
			const featureVector: MLFeatureVector = {
				symbol: "CACHE_TEST",
				features: { feature1: 10, feature2: 20 },
				featureNames: ["feature1", "feature2"],
				timestamp: Date.now(),
				completeness: 1.0,
				qualityScore: 0.95,
			};

			optimizer.optimizeFeatureVector(featureVector, MLModelType.LIGHTGBM);

			const stats1 = optimizer.getCacheStats();
			expect(stats1.size).toBeGreaterThan(0);

			optimizer.clearCache();

			const stats2 = optimizer.getCacheStats();
			expect(stats2.size).toBe(0);
		});

		test("should provide cache statistics", () => {
			const stats = optimizer.getCacheStats();

			expect(stats).toBeDefined();
			expect(stats.size).toBeGreaterThanOrEqual(0);
			expect(stats.maxSize).toBe(1000);
		});

		test("should limit cache size", () => {
			// Fill cache beyond limit
			for (let i = 0; i < 1100; i++) {
				const featureVector: MLFeatureVector = {
					symbol: `STOCK${i}`,
					features: { feature1: i },
					featureNames: ["feature1"],
					timestamp: i,
					completeness: 1.0,
					qualityScore: 0.95,
				};

				optimizer.optimizeFeatureVector(featureVector, MLModelType.LIGHTGBM);
			}

			const stats = optimizer.getCacheStats();
			expect(stats.size).toBeLessThanOrEqual(1000);
		});
	});

	describe("Performance", () => {
		test("should optimize features in <10ms for small vectors", () => {
			const featureVector: MLFeatureVector = {
				symbol: "PERF_TEST",
				features: Object.fromEntries(
					Array.from({ length: 50 }, (_, i) => [`feature_${i}`, Math.random() * 100])
				),
				featureNames: Array.from({ length: 50 }, (_, i) => `feature_${i}`),
				timestamp: Date.now(),
				completeness: 1.0,
				qualityScore: 0.95,
			};

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.LIGHTGBM);

			expect(result.preprocessingTimeMs).toBeLessThan(10);
		});

		test("should handle large feature vectors efficiently", () => {
			const featureVector: MLFeatureVector = {
				symbol: "LARGE_TEST",
				features: Object.fromEntries(
					Array.from({ length: 500 }, (_, i) => [`feature_${i}`, Math.random() * 100])
				),
				featureNames: Array.from({ length: 500 }, (_, i) => `feature_${i}`),
				timestamp: Date.now(),
				completeness: 1.0,
				qualityScore: 0.95,
			};

			const result = optimizer.optimizeFeatureVector(featureVector, MLModelType.XGBOOST);

			expect(result.preprocessingTimeMs).toBeLessThan(100);
		});
	});
});
