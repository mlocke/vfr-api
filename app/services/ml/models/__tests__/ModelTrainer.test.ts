/**
 * ModelTrainer Tests - Real Database Integration
 *
 * NO MOCK DATA policy - all tests use real database connections
 * Tests cover:
 * - Training data preparation from FeatureStore
 * - Data splitting with walk-forward methodology
 * - LightGBM training
 * - XGBoost training
 * - LSTM training
 * - Hyperparameter optimization
 * - Cross-validation
 *
 * Performance target: Training completion in reasonable time
 * 5-minute timeout for comprehensive integration tests
 */

import { Pool } from "pg";
import {
	ModelTrainer,
	TrainingDataConfig,
	TrainingConfig,
	DataSplit,
	HyperparameterGrid,
} from "../ModelTrainer";
import { FeatureStore, BulkFeatureInsert } from "../../features/FeatureStore";
import { ModelType, ModelObjective } from "../ModelRegistry";

describe("ModelTrainer", () => {
	let trainer: ModelTrainer;
	let featureStore: FeatureStore;
	let pool: Pool;

	const testSymbols = ["AAPL", "MSFT", "GOOGL"];

	beforeAll(async () => {
		trainer = ModelTrainer.getInstance();
		featureStore = FeatureStore.getInstance();

		await featureStore.initialize();

		pool = new Pool({
			connectionString: process.env.DATABASE_URL,
			max: 5,
		});

		// Seed test features
		await seedTestFeatures();
	}, 300000);

	afterAll(async () => {
		try {
			// Clean up test data
			await pool.query(`DELETE FROM ml_feature_store WHERE ticker = ANY($1)`, [testSymbols]);
			await pool.end();
			await featureStore.cleanup();
		} catch (error) {
			console.error("Failed to clean up in afterAll:", error);
		}
	});

	// Seed test features for training
	async function seedTestFeatures(): Promise<void> {
		const features: BulkFeatureInsert[] = [];

		for (const symbol of testSymbols) {
			for (let i = 0; i < 50; i++) {
				features.push({
					ticker: symbol,
					timestamp: Date.now() - i * 3600000, // 1 hour intervals
					featureId: `feature_${i % 10}`,
					value: Math.random() * 100,
					confidenceScore: 0.8 + Math.random() * 0.2,
					dataQualityScore: 0.7 + Math.random() * 0.3,
					sourceProvider: "test_provider",
				});
			}
		}

		await featureStore.storeBulkFeatures(features);
	}

	describe("Singleton & Initialization", () => {
		it("should return singleton instance", () => {
			const instance1 = ModelTrainer.getInstance();
			const instance2 = ModelTrainer.getInstance();

			expect(instance1).toBe(instance2);
		});

		it("should perform health check successfully", async () => {
			const isHealthy = await trainer.healthCheck();
			expect(isHealthy).toBe(true);
		});
	});

	describe("Training Data Preparation", () => {
		it("should prepare training data from FeatureStore", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7), // 7 days ago
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
				minQuality: 0.7,
			};

			const result = await trainer.prepareTrainingData(config);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();

			if (result.data) {
				expect(result.data.features).toBeInstanceOf(Array);
				expect(result.data.labels).toBeInstanceOf(Array);
				expect(result.data.timestamps).toBeInstanceOf(Array);
				expect(result.data.symbols).toBeInstanceOf(Array);
				expect(result.data.featureNames).toBeInstanceOf(Array);

				expect(result.data.features.length).toBeGreaterThan(0);
				expect(result.data.features.length).toBe(result.data.labels.length);
			}
		}, 30000);

		it("should handle empty symbol list gracefully", async () => {
			const config: TrainingDataConfig = {
				symbols: [],
				startDate: new Date(Date.now() - 86400000),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const result = await trainer.prepareTrainingData(config);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe("Data Splitting", () => {
		it("should split data with walk-forward methodology", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
				minQuality: 0.7,
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.success).toBe(true);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const split = trainer.splitData(dataResult.data, 0.7, 0.15);

				expect(split.train).toBeDefined();
				expect(split.validation).toBeDefined();
				expect(split.test).toBeDefined();

				expect(split.train.features.length).toBeGreaterThan(0);
				expect(split.validation.features.length).toBeGreaterThan(0);
				expect(split.test.features.length).toBeGreaterThan(0);

				// Verify split proportions
				const totalSamples = dataResult.data.features.length;
				const trainRatio = split.train.features.length / totalSamples;
				const validationRatio = split.validation.features.length / totalSamples;

				expect(trainRatio).toBeCloseTo(0.7, 1);
				expect(validationRatio).toBeCloseTo(0.15, 1);
			}
		}, 30000);

		it("should maintain feature consistency across splits", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const split = trainer.splitData(dataResult.data);

				expect(split.train.featureNames).toEqual(split.validation.featureNames);
				expect(split.train.featureNames).toEqual(split.test.featureNames);
			}
		}, 30000);
	});

	describe("LightGBM Training", () => {
		it("should train LightGBM model successfully", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const split = trainer.splitData(dataResult.data);

				const trainingConfig: TrainingConfig = {
					modelType: ModelType.LIGHTGBM,
					objective: ModelObjective.PRICE_PREDICTION,
					targetVariable: "price_1d",
					predictionHorizon: "1d",
					hyperparameters: {
						num_leaves: 31,
						learning_rate: 0.1,
						n_estimators: 100,
					},
					trainTestSplit: 0.7,
					validationSplit: 0.15,
				};

				const result = await trainer.trainLightGBM(split, trainingConfig);

				expect(result.success).toBe(true);
				expect(result.data).toBeDefined();

				if (result.data) {
					expect(result.data.modelArtifact).toBeDefined();
					expect(result.data.metrics).toBeDefined();
					expect(result.data.metrics.validationAccuracy).toBeGreaterThan(0.6);
					expect(result.data.metrics.validationAccuracy).toBeLessThanOrEqual(1);
					expect(result.data.featureImportance).toBeDefined();
					expect(result.data.hyperparameters).toEqual(trainingConfig.hyperparameters);
				}
			}
		}, 30000);

		it("should achieve >70% validation accuracy", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const split = trainer.splitData(dataResult.data);

				const trainingConfig: TrainingConfig = {
					modelType: ModelType.LIGHTGBM,
					objective: ModelObjective.PRICE_PREDICTION,
					targetVariable: "price_1d",
					predictionHorizon: "1d",
					hyperparameters: {
						num_leaves: 50,
						learning_rate: 0.05,
						n_estimators: 150,
					},
					trainTestSplit: 0.7,
					validationSplit: 0.15,
				};

				const result = await trainer.trainLightGBM(split, trainingConfig);

				expect(result.success).toBe(true);
				if (result.data) {
					expect(result.data.metrics.validationAccuracy).toBeGreaterThanOrEqual(0.7);
				}
			}
		}, 30000);
	});

	describe("XGBoost Training", () => {
		it("should train XGBoost model successfully", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const split = trainer.splitData(dataResult.data);

				const trainingConfig: TrainingConfig = {
					modelType: ModelType.XGBOOST,
					objective: ModelObjective.DIRECTION_CLASSIFICATION,
					targetVariable: "direction_1d",
					predictionHorizon: "1d",
					hyperparameters: {
						max_depth: 6,
						learning_rate: 0.1,
						n_estimators: 100,
					},
					trainTestSplit: 0.7,
					validationSplit: 0.15,
				};

				const result = await trainer.trainXGBoost(split, trainingConfig);

				expect(result.success).toBe(true);
				expect(result.data).toBeDefined();

				if (result.data) {
					expect(result.data.modelArtifact).toBeDefined();
					expect(result.data.metrics).toBeDefined();
					expect(result.data.metrics.validationAccuracy).toBeGreaterThan(0.6);
					expect(result.data.featureImportance).toBeDefined();
				}
			}
		}, 30000);
	});

	describe("LSTM Training", () => {
		it("should train LSTM model successfully", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const split = trainer.splitData(dataResult.data);

				const trainingConfig: TrainingConfig = {
					modelType: ModelType.LSTM,
					objective: ModelObjective.PRICE_PREDICTION,
					targetVariable: "price_1d",
					predictionHorizon: "1d",
					hyperparameters: {
						units: 64,
						layers: 2,
						dropout: 0.2,
					},
					trainTestSplit: 0.7,
					validationSplit: 0.15,
					maxEpochs: 50,
				};

				const result = await trainer.trainLSTM(split, trainingConfig);

				expect(result.success).toBe(true);
				expect(result.data).toBeDefined();

				if (result.data) {
					expect(result.data.modelArtifact).toBeDefined();
					expect(result.data.metrics).toBeDefined();
					expect(result.data.metrics.validationAccuracy).toBeGreaterThan(0.6);
					expect(result.data.metrics.epochs).toBeDefined();
					expect(result.data.metrics.epochs).toBeLessThanOrEqual(50);
				}
			}
		}, 30000);

		it("should support early stopping", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const split = trainer.splitData(dataResult.data);

				const trainingConfig: TrainingConfig = {
					modelType: ModelType.LSTM,
					objective: ModelObjective.PRICE_PREDICTION,
					targetVariable: "price_1d",
					predictionHorizon: "1d",
					hyperparameters: {
						units: 32,
						layers: 1,
					},
					trainTestSplit: 0.7,
					validationSplit: 0.15,
					maxEpochs: 100,
					earlyStoppingRounds: 10,
				};

				const result = await trainer.trainLSTM(split, trainingConfig);

				expect(result.success).toBe(true);
				if (result.data) {
					// Early stopping may trigger
					if (result.data.metrics.earlyStoppedAt) {
						expect(result.data.metrics.earlyStoppedAt).toBeLessThan(100);
					}
				}
			}
		}, 30000);
	});

	describe("Hyperparameter Optimization", () => {
		it("should optimize hyperparameters using grid search", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols.slice(0, 2), // Use fewer symbols for speed
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const split = trainer.splitData(dataResult.data);

				const trainingConfig: TrainingConfig = {
					modelType: ModelType.LIGHTGBM,
					objective: ModelObjective.PRICE_PREDICTION,
					targetVariable: "price_1d",
					predictionHorizon: "1d",
					hyperparameters: {
						num_leaves: 31,
					},
					trainTestSplit: 0.7,
					validationSplit: 0.15,
				};

				const paramGrid: HyperparameterGrid = {
					learning_rate: [0.05, 0.1],
					n_estimators: [50, 100],
				};

				const result = await trainer.optimizeHyperparameters(
					split,
					trainingConfig,
					paramGrid
				);

				expect(result.success).toBe(true);
				expect(result.data).toBeDefined();

				if (result.data) {
					expect(result.data.bestParams).toBeDefined();
					expect(result.data.bestScore).toBeGreaterThan(0);
					expect(result.data.allResults).toBeInstanceOf(Array);
					expect(result.data.allResults.length).toBe(4); // 2 x 2 grid
				}
			}
		}, 60000);

		it("should find best parameters from grid", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols.slice(0, 2),
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const split = trainer.splitData(dataResult.data);

				const trainingConfig: TrainingConfig = {
					modelType: ModelType.XGBOOST,
					objective: ModelObjective.PRICE_PREDICTION,
					targetVariable: "price_1d",
					predictionHorizon: "1d",
					hyperparameters: {},
					trainTestSplit: 0.7,
					validationSplit: 0.15,
				};

				const paramGrid: HyperparameterGrid = {
					max_depth: [3, 6],
					learning_rate: [0.1],
				};

				const result = await trainer.optimizeHyperparameters(
					split,
					trainingConfig,
					paramGrid
				);

				expect(result.success).toBe(true);
				if (result.data) {
					expect(result.data.bestParams).toHaveProperty("max_depth");
					expect(result.data.bestParams).toHaveProperty("learning_rate");
				}
			}
		}, 60000);
	});

	describe("Cross-Validation", () => {
		it("should perform k-fold cross-validation", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const trainingConfig: TrainingConfig = {
					modelType: ModelType.LIGHTGBM,
					objective: ModelObjective.PRICE_PREDICTION,
					targetVariable: "price_1d",
					predictionHorizon: "1d",
					hyperparameters: {
						num_leaves: 31,
						learning_rate: 0.1,
						n_estimators: 50,
					},
					trainTestSplit: 0.7,
					validationSplit: 0.15,
					cvFolds: 3,
				};

				const result = await trainer.crossValidate(dataResult.data, trainingConfig, 3);

				expect(result.success).toBe(true);
				expect(result.data).toBeDefined();

				if (result.data) {
					expect(result.data.avgScore).toBeGreaterThan(0);
					expect(result.data.scores).toHaveLength(3);
					expect(result.data.stdDev).toBeGreaterThanOrEqual(0);
				}
			}
		}, 60000);

		it("should calculate cross-validation statistics correctly", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const trainingConfig: TrainingConfig = {
					modelType: ModelType.XGBOOST,
					objective: ModelObjective.PRICE_PREDICTION,
					targetVariable: "price_1d",
					predictionHorizon: "1d",
					hyperparameters: {
						max_depth: 5,
						learning_rate: 0.1,
						n_estimators: 50,
					},
					trainTestSplit: 0.7,
					validationSplit: 0.15,
				};

				const result = await trainer.crossValidate(dataResult.data, trainingConfig, 5);

				expect(result.success).toBe(true);
				if (result.data) {
					const { avgScore, scores, stdDev } = result.data;

					// Verify average calculation
					const calculatedAvg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
					expect(avgScore).toBeCloseTo(calculatedAvg, 5);

					// Verify scores are reasonable
					scores.forEach(score => {
						expect(score).toBeGreaterThan(0);
						expect(score).toBeLessThanOrEqual(1);
					});

					expect(stdDev).toBeGreaterThanOrEqual(0);
				}
			}
		}, 90000);
	});

	describe("Performance & Integration", () => {
		it("should complete training within reasonable time", async () => {
			const startTime = Date.now();

			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
			};

			const dataResult = await trainer.prepareTrainingData(config);
			expect(dataResult.data).toBeDefined();

			if (dataResult.data) {
				const split = trainer.splitData(dataResult.data);

				const trainingConfig: TrainingConfig = {
					modelType: ModelType.LIGHTGBM,
					objective: ModelObjective.PRICE_PREDICTION,
					targetVariable: "price_1d",
					predictionHorizon: "1d",
					hyperparameters: {
						num_leaves: 31,
						learning_rate: 0.1,
						n_estimators: 100,
					},
					trainTestSplit: 0.7,
					validationSplit: 0.15,
				};

				await trainer.trainLightGBM(split, trainingConfig);

				const duration = Date.now() - startTime;
				expect(duration).toBeLessThan(30000); // Should complete in 30 seconds
			}
		}, 30000);

		it("should integrate with FeatureStore successfully", async () => {
			const config: TrainingDataConfig = {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
				minQuality: 0.7,
			};

			const result = await trainer.prepareTrainingData(config);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();

			if (result.data) {
				expect(result.data.symbols).toEqual(expect.arrayContaining(testSymbols));
			}
		}, 30000);
	});
});
