/**
 * ModelManager Unit Tests
 * Tests model registration, loading, caching, and lifecycle management
 * Following VFR NO MOCK DATA policy - uses real service instances
 */

import ModelManager from "../ModelManager";
import {
	MLModelType,
	MLModelStatus,
	MLPredictionHorizon,
	MLModelPerformance,
} from "../types/MLTypes";

describe("ModelManager", () => {
	let modelManager: ModelManager;

	beforeEach(() => {
		// Get fresh instance for each test
		modelManager = ModelManager.getInstance();
		modelManager.reset();
	});

	afterEach(() => {
		modelManager.reset();
	});

	describe("Model Registration", () => {
		test("should register a new model successfully", async () => {
			const modelConfig = {
				modelId: "test-model-1",
				modelType: MLModelType.LIGHTGBM,
				version: "1.0.0",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: ["momentum_5d", "vwap_deviation", "sentiment"],
				hyperparameters: {
					learningRate: 0.01,
					maxDepth: 5,
				},
				performanceMetrics: {
					accuracy: 0.65,
					precision: 0.68,
					recall: 0.62,
					f1Score: 0.65,
					sharpeRatio: 1.2,
					validationAccuracy: 0.63,
					trainingLoss: 0.35,
					validationLoss: 0.38,
					lastUpdated: Date.now(),
				},
			};

			const result = await modelManager.registerModel(modelConfig);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data?.modelId).toBe("test-model-1");
			expect(result.data?.createdAt).toBeDefined();
			expect(result.data?.updatedAt).toBeDefined();
		});

		test("should reject invalid model configuration", async () => {
			const invalidConfig = {
				modelId: "",
				modelType: MLModelType.LIGHTGBM,
				version: "",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: [],
				hyperparameters: {},
				performanceMetrics: {} as MLModelPerformance,
			};

			const result = await modelManager.registerModel(invalidConfig);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error?.message).toContain("Invalid model configuration");
		});

		test("should handle model version conflicts", async () => {
			const modelConfig = {
				modelId: "test-model-version",
				modelType: MLModelType.XGBOOST,
				version: "1.0.0",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: ["feature1"],
				hyperparameters: {},
				performanceMetrics: {
					accuracy: 0.6,
					precision: 0.6,
					recall: 0.6,
					f1Score: 0.6,
					sharpeRatio: 1.0,
					validationAccuracy: 0.6,
					trainingLoss: 0.4,
					validationLoss: 0.4,
					lastUpdated: Date.now(),
				},
			};

			// Register first time
			const result1 = await modelManager.registerModel(modelConfig);
			expect(result1.success).toBe(true);

			// Register same version again
			const result2 = await modelManager.registerModel(modelConfig);
			expect(result2.success).toBe(true); // Should succeed but log warning
		});
	});

	describe("Model Loading", () => {
		test("should load a registered model", async () => {
			// First register a model
			const modelConfig = {
				modelId: "loadable-model",
				modelType: MLModelType.LIGHTGBM,
				version: "1.0.0",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: ["feature1", "feature2"],
				hyperparameters: {},
				performanceMetrics: {
					accuracy: 0.7,
					precision: 0.7,
					recall: 0.7,
					f1Score: 0.7,
					sharpeRatio: 1.3,
					validationAccuracy: 0.68,
					trainingLoss: 0.3,
					validationLoss: 0.32,
					lastUpdated: Date.now(),
				},
			};

			await modelManager.registerModel(modelConfig);

			// Load the model
			const loadResult = await modelManager.loadModel("loadable-model");

			expect(loadResult.success).toBe(true);
			expect(loadResult.data).toBeDefined();
			expect(loadResult.data?.modelId).toBe("loadable-model");
			expect(loadResult.data?.modelType).toBe(MLModelType.LIGHTGBM);
			expect(loadResult.metadata?.cacheHit).toBe(false);
		});

		test("should cache loaded models", async () => {
			// Register and load a model
			const modelConfig = {
				modelId: "cacheable-model",
				modelType: MLModelType.LIGHTGBM,
				version: "1.0.0",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: ["feature1"],
				hyperparameters: {},
				performanceMetrics: {
					accuracy: 0.65,
					precision: 0.65,
					recall: 0.65,
					f1Score: 0.65,
					sharpeRatio: 1.1,
					validationAccuracy: 0.63,
					trainingLoss: 0.35,
					validationLoss: 0.37,
					lastUpdated: Date.now(),
				},
			};

			await modelManager.registerModel(modelConfig);
			await modelManager.loadModel("cacheable-model");

			// Load again - should hit cache
			const secondLoad = await modelManager.loadModel("cacheable-model");

			expect(secondLoad.success).toBe(true);
			expect(secondLoad.metadata?.cacheHit).toBe(true);
			expect(secondLoad.metadata?.latency).toBeLessThan(50); // <50ms for cached models
		});

		test("should handle loading non-existent model", async () => {
			const loadResult = await modelManager.loadModel("non-existent-model");

			expect(loadResult.success).toBe(false);
			expect(loadResult.error).toBeDefined();
			expect(loadResult.error?.message).toContain("Model not found");
		});
	});

	describe("Model Status Management", () => {
		test("should update model status", async () => {
			// Register a model
			const modelConfig = {
				modelId: "status-test-model",
				modelType: MLModelType.LIGHTGBM,
				version: "1.0.0",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: ["feature1"],
				hyperparameters: {},
				performanceMetrics: {
					accuracy: 0.6,
					precision: 0.6,
					recall: 0.6,
					f1Score: 0.6,
					sharpeRatio: 1.0,
					validationAccuracy: 0.6,
					trainingLoss: 0.4,
					validationLoss: 0.4,
					lastUpdated: Date.now(),
				},
			};

			await modelManager.registerModel(modelConfig);

			// Update status to DEPRECATED
			const updateResult = await modelManager.updateModelStatus(
				"status-test-model",
				MLModelStatus.DEPRECATED
			);

			expect(updateResult.success).toBe(true);
			expect(updateResult.data?.status).toBe(MLModelStatus.DEPRECATED);
			expect(updateResult.data?.updatedAt).toBeGreaterThan(
				modelConfig.performanceMetrics.lastUpdated
			);
		});

		test("should remove deprecated models from cache", async () => {
			// Register and load a model
			const modelConfig = {
				modelId: "deprecated-cache-model",
				modelType: MLModelType.LIGHTGBM,
				version: "1.0.0",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: ["feature1"],
				hyperparameters: {},
				performanceMetrics: {
					accuracy: 0.6,
					precision: 0.6,
					recall: 0.6,
					f1Score: 0.6,
					sharpeRatio: 1.0,
					validationAccuracy: 0.6,
					trainingLoss: 0.4,
					validationLoss: 0.4,
					lastUpdated: Date.now(),
				},
			};

			await modelManager.registerModel(modelConfig);
			await modelManager.loadModel("deprecated-cache-model");

			// Deprecate the model
			await modelManager.updateModelStatus(
				"deprecated-cache-model",
				MLModelStatus.DEPRECATED
			);

			// Load again - should not be in cache
			const reloadResult = await modelManager.loadModel("deprecated-cache-model");
			expect(reloadResult.success).toBe(true);
			expect(reloadResult.metadata?.cacheHit).toBe(false);
		});
	});

	describe("Model Listing and Filtering", () => {
		test("should list all models", async () => {
			// Register multiple models
			const models = [
				{
					modelId: "model-1",
					modelType: MLModelType.LIGHTGBM,
					version: "1.0.0",
					status: MLModelStatus.ACTIVE,
					horizon: MLPredictionHorizon.ONE_DAY,
					features: ["f1"],
					hyperparameters: {},
					performanceMetrics: {} as MLModelPerformance,
				},
				{
					modelId: "model-2",
					modelType: MLModelType.XGBOOST,
					version: "1.0.0",
					status: MLModelStatus.ACTIVE,
					horizon: MLPredictionHorizon.ONE_WEEK,
					features: ["f1"],
					hyperparameters: {},
					performanceMetrics: {} as MLModelPerformance,
				},
			];

			for (const model of models) {
				await modelManager.registerModel(model);
			}

			const allModels = modelManager.listModels();
			expect(allModels.length).toBe(2);
		});

		test("should filter models by status", async () => {
			const activeModel = {
				modelId: "active-model",
				modelType: MLModelType.LIGHTGBM,
				version: "1.0.0",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: ["f1"],
				hyperparameters: {},
				performanceMetrics: {} as MLModelPerformance,
			};

			const inactiveModel = {
				modelId: "inactive-model",
				modelType: MLModelType.XGBOOST,
				version: "1.0.0",
				status: MLModelStatus.INACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: ["f1"],
				hyperparameters: {},
				performanceMetrics: {} as MLModelPerformance,
			};

			await modelManager.registerModel(activeModel);
			await modelManager.registerModel(inactiveModel);

			const activeModels = modelManager.listModels({ status: MLModelStatus.ACTIVE });
			expect(activeModels.length).toBe(1);
			expect(activeModels[0].modelId).toBe("active-model");
		});

		test("should get active models for specific horizon", async () => {
			const oneDayModel = {
				modelId: "1day-model",
				modelType: MLModelType.LIGHTGBM,
				version: "1.0.0",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: ["f1"],
				hyperparameters: {},
				performanceMetrics: {} as MLModelPerformance,
			};

			const oneWeekModel = {
				modelId: "1week-model",
				modelType: MLModelType.XGBOOST,
				version: "1.0.0",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_WEEK,
				features: ["f1"],
				hyperparameters: {},
				performanceMetrics: {} as MLModelPerformance,
			};

			await modelManager.registerModel(oneDayModel);
			await modelManager.registerModel(oneWeekModel);

			const oneDayModels = modelManager.getActiveModelsForHorizon(
				MLPredictionHorizon.ONE_DAY
			);
			expect(oneDayModels.length).toBe(1);
			expect(oneDayModels[0].modelId).toBe("1day-model");
		});
	});

	describe("Cache Management", () => {
		test("should provide cache statistics", () => {
			const stats = modelManager.getCacheStats();

			expect(stats).toHaveProperty("cachedModels");
			expect(stats).toHaveProperty("maxCachedModels");
			expect(stats).toHaveProperty("totalModels");
			expect(stats).toHaveProperty("cacheHitRate");
		});

		test("should clear cache when requested", async () => {
			// Register and load a model
			const modelConfig = {
				modelId: "clear-cache-model",
				modelType: MLModelType.LIGHTGBM,
				version: "1.0.0",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: ["f1"],
				hyperparameters: {},
				performanceMetrics: {} as MLModelPerformance,
			};

			await modelManager.registerModel(modelConfig);
			await modelManager.loadModel("clear-cache-model");

			// Clear cache
			modelManager.clearCache();

			// Load again - should not hit cache
			const reloadResult = await modelManager.loadModel("clear-cache-model");
			expect(reloadResult.metadata?.cacheHit).toBe(false);
		});
	});

	describe("Performance Metrics Update", () => {
		test("should update model performance metrics", async () => {
			// Register a model
			const modelConfig = {
				modelId: "perf-update-model",
				modelType: MLModelType.LIGHTGBM,
				version: "1.0.0",
				status: MLModelStatus.ACTIVE,
				horizon: MLPredictionHorizon.ONE_DAY,
				features: ["f1"],
				hyperparameters: {},
				performanceMetrics: {
					accuracy: 0.6,
					precision: 0.6,
					recall: 0.6,
					f1Score: 0.6,
					sharpeRatio: 1.0,
					validationAccuracy: 0.6,
					trainingLoss: 0.4,
					validationLoss: 0.4,
					lastUpdated: Date.now(),
				},
			};

			await modelManager.registerModel(modelConfig);

			// Update performance metrics
			const newMetrics: MLModelPerformance = {
				accuracy: 0.75,
				precision: 0.77,
				recall: 0.73,
				f1Score: 0.75,
				sharpeRatio: 1.5,
				validationAccuracy: 0.73,
				trainingLoss: 0.25,
				validationLoss: 0.27,
				lastUpdated: Date.now(),
			};

			const updateResult = await modelManager.updateModelPerformance(
				"perf-update-model",
				newMetrics
			);

			expect(updateResult.success).toBe(true);
			expect(updateResult.data?.performanceMetrics.accuracy).toBe(0.75);
			expect(updateResult.data?.performanceMetrics.sharpeRatio).toBe(1.5);
		});
	});
});
