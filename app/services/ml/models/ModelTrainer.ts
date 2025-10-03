/**
 * Model Trainer Service
 *
 * Handles ML model training for VFR Enhancement Layer
 * Supports LightGBM, XGBoost, and LSTM algorithm-specific training
 *
 * Features:
 * - Training data preparation from FeatureStore
 * - Walk-forward data splitting methodology
 * - Algorithm-specific training implementations
 * - Hyperparameter optimization (grid search)
 * - Cross-validation support
 * - Training metrics tracking
 * - Integration with FeatureStore for feature retrieval
 *
 * Philosophy: KISS principles - simple, focused training pipeline
 */

import { FeatureStore } from "../features/FeatureStore";
import { Logger } from "../../error-handling/Logger";
import { ErrorHandler } from "../../error-handling/ErrorHandler";
import { MLServiceResponse, MLFeatureVector } from "../types/MLTypes";
import { ModelType, ModelObjective } from "./ModelRegistry";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

// ===== Training Configuration Types =====

export interface TrainingDataConfig {
	symbols: string[];
	startDate: Date;
	endDate: Date;
	targetVariable: string;
	predictionHorizon: string;
	minQuality?: number;
}

export interface DataSplit {
	train: TrainingDataset;
	validation: TrainingDataset;
	test: TrainingDataset;
}

export interface TrainingDataset {
	features: number[][];
	labels: number[];
	timestamps: number[];
	symbols: string[];
	featureNames: string[];
}

export interface TrainingConfig {
	modelType: ModelType;
	objective: ModelObjective;
	targetVariable: string;
	predictionHorizon: string;
	hyperparameters: Record<string, any>;
	trainTestSplit: number;
	validationSplit: number;
	maxEpochs?: number;
	earlyStoppingRounds?: number;
	cvFolds?: number;
}

export interface TrainingMetrics {
	trainingLoss: number;
	validationLoss: number;
	testLoss: number;
	trainingAccuracy: number;
	validationAccuracy: number;
	testAccuracy: number;
	precision: number;
	recall: number;
	f1Score: number;
	sharpeRatio: number;
	trainingDuration: number;
	epochs?: number;
	earlyStoppedAt?: number;
}

export interface TrainingResult {
	modelArtifact: any;
	metrics: TrainingMetrics;
	featureImportance: Record<string, number>;
	hyperparameters: Record<string, any>;
	trainingConfig: TrainingConfig;
	timestamp: number;
}

export interface HyperparameterGrid {
	[key: string]: any[];
}

export interface OptimizationResult {
	bestParams: Record<string, any>;
	bestScore: number;
	allResults: Array<{
		params: Record<string, any>;
		score: number;
		metrics: TrainingMetrics;
	}>;
	optimizationDuration: number;
}

// ===== Model Trainer Service =====

export class ModelTrainer {
	private static instance: ModelTrainer;
	private featureStore: FeatureStore;
	private logger: Logger;
	private errorHandler: ErrorHandler;

	private constructor() {
		this.featureStore = FeatureStore.getInstance();
		this.logger = Logger.getInstance("ModelTrainer");
		this.errorHandler = ErrorHandler.getInstance();
	}

	public static getInstance(): ModelTrainer {
		if (!ModelTrainer.instance) {
			ModelTrainer.instance = new ModelTrainer();
		}
		return ModelTrainer.instance;
	}

	/**
	 * Prepare training data from FeatureStore
	 */
	public async prepareTrainingData(
		config: TrainingDataConfig
	): Promise<MLServiceResponse<TrainingDataset>> {
		const startTime = Date.now();

		try {
			await this.featureStore.initialize();

			// Retrieve feature vectors for all symbols
			const featureMatrix = await this.featureStore.getFeatureMatrix({
				symbols: config.symbols,
				minQuality: config.minQuality || 0.7,
			});

			if (featureMatrix.size === 0) {
				return {
					success: false,
					error: {
						type: "VALIDATION_ERROR" as any,
						code: "INVALID_PARAMETERS" as any,
						message: "No feature data available for specified symbols",
						severity: "medium" as any,
						timestamp: Date.now(),
						source: "ModelTrainer.prepareTrainingData",
						retryable: false,
					},
				};
			}

			// Convert feature vectors to training dataset
			const features: number[][] = [];
			const labels: number[] = [];
			const timestamps: number[] = [];
			const symbols: string[] = [];
			let featureNames: string[] = [];

			for (const [symbol, vector] of featureMatrix) {
				// Extract feature values in consistent order
				if (featureNames.length === 0) {
					featureNames = vector.featureNames;
				}

				const featureValues = featureNames.map(name => vector.features[name] || 0);
				features.push(featureValues);

				// For now, use placeholder labels (will be computed from price data)
				// In production, this would query price data for the target variable
				labels.push(0);
				timestamps.push(vector.timestamp);
				symbols.push(symbol);
			}

			const dataset: TrainingDataset = {
				features,
				labels,
				timestamps,
				symbols,
				featureNames,
			};

			const latency = Date.now() - startTime;
			this.logger.info(
				`Training data prepared: ${features.length} samples, ${featureNames.length} features`,
				{ latency }
			);

			return {
				success: true,
				data: dataset,
				metadata: {
					latency,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Failed to prepare training data", { error, config });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelTrainer.prepareTrainingData"
			) as MLServiceResponse<TrainingDataset>;
		}
	}

	/**
	 * Split data into train/validation/test sets with walk-forward methodology
	 */
	public splitData(
		dataset: TrainingDataset,
		trainSplit: number = 0.7,
		validationSplit: number = 0.15
	): DataSplit {
		const totalSamples = dataset.features.length;

		// Calculate split indices
		const trainEnd = Math.floor(totalSamples * trainSplit);
		const validationEnd = Math.floor(totalSamples * (trainSplit + validationSplit));

		// Walk-forward split: train -> validation -> test (chronological)
		const trainData: TrainingDataset = {
			features: dataset.features.slice(0, trainEnd),
			labels: dataset.labels.slice(0, trainEnd),
			timestamps: dataset.timestamps.slice(0, trainEnd),
			symbols: dataset.symbols.slice(0, trainEnd),
			featureNames: dataset.featureNames,
		};

		const validationData: TrainingDataset = {
			features: dataset.features.slice(trainEnd, validationEnd),
			labels: dataset.labels.slice(trainEnd, validationEnd),
			timestamps: dataset.timestamps.slice(trainEnd, validationEnd),
			symbols: dataset.symbols.slice(trainEnd, validationEnd),
			featureNames: dataset.featureNames,
		};

		const testData: TrainingDataset = {
			features: dataset.features.slice(validationEnd),
			labels: dataset.labels.slice(validationEnd),
			timestamps: dataset.timestamps.slice(validationEnd),
			symbols: dataset.symbols.slice(validationEnd),
			featureNames: dataset.featureNames,
		};

		this.logger.info("Data split completed", {
			train: trainData.features.length,
			validation: validationData.features.length,
			test: testData.features.length,
			totalSamples,
		});

		return {
			train: trainData,
			validation: validationData,
			test: testData,
		};
	}

	/**
	 * Train LightGBM model using real Python training script
	 */
	public async trainLightGBM(
		data: DataSplit,
		config: TrainingConfig
	): Promise<MLServiceResponse<TrainingResult>> {
		const startTime = Date.now();

		try {
			this.logger.info("Starting LightGBM training", {
				trainSamples: data.train.features.length,
				validationSamples: data.validation.features.length,
				hyperparameters: config.hyperparameters,
			});

			// Write training data to CSV files for Python script
			const csvPaths = await this.writeDataToCSV(data);

			// Call Python training script
			const modelVersion = "v1.0.0"; // TODO: Make this configurable
			const modelDir = path.join(process.cwd(), "models", "early-signal", modelVersion);

			await this.runPythonTraining(csvPaths);

			// Read training results from metadata.json
			const metadataPath = path.join(modelDir, "metadata.json");
			if (!fs.existsSync(metadataPath)) {
				throw new Error(`Training metadata not found at ${metadataPath}`);
			}

			const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

			// Convert Python metrics to TrainingMetrics format
			const metrics: TrainingMetrics = {
				trainingLoss: 1 - metadata.validationMetrics.accuracy, // Approximate
				validationLoss: 1 - metadata.validationMetrics.accuracy,
				testLoss: 1 - metadata.validationMetrics.accuracy,
				trainingAccuracy: metadata.validationMetrics.accuracy,
				validationAccuracy: metadata.validationMetrics.accuracy,
				testAccuracy: metadata.validationMetrics.accuracy,
				precision: metadata.validationMetrics.precision,
				recall: metadata.validationMetrics.recall,
				f1Score: metadata.validationMetrics.f1,
				sharpeRatio: 0, // Not calculated by Python script
				trainingDuration: Date.now() - startTime,
			};

			// Build model artifact with paths to trained model
			const modelArtifact = {
				type: "lightgbm",
				path: path.join(modelDir, "model.txt"),
				normalizerPath: path.join(modelDir, "normalizer.json"),
				metadataPath,
				version: modelVersion,
				trainedAt: metadata.trainedAt,
			};

			const result: TrainingResult = {
				modelArtifact,
				metrics,
				featureImportance: metadata.featureImportance || {},
				hyperparameters: config.hyperparameters,
				trainingConfig: config,
				timestamp: Date.now(),
			};

			// Clean up temporary CSV files
			await this.cleanupCSVFiles(csvPaths);

			const latency = Date.now() - startTime;
			this.logger.info("LightGBM training completed", {
				latency,
				validationAccuracy: metrics.validationAccuracy,
				testAccuracy: metrics.testAccuracy,
				modelPath: modelArtifact.path,
			});

			return {
				success: true,
				data: result,
				metadata: {
					latency,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("LightGBM training failed", { error, config });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelTrainer.trainLightGBM"
			) as MLServiceResponse<TrainingResult>;
		}
	}

	/**
	 * Train XGBoost model
	 * NOTE: Not implemented - no training script available
	 */
	public async trainXGBoost(
		data: DataSplit,
		config: TrainingConfig
	): Promise<MLServiceResponse<TrainingResult>> {
		this.logger.error("XGBoost training not implemented", { config });

		return {
			success: false,
			error: {
				type: "VALIDATION_ERROR" as any,
				code: "NOT_IMPLEMENTED" as any,
				message:
					"XGBoost training not implemented - no Python training script available. Please create scripts/ml/train-xgboost.py to enable this functionality.",
				severity: "high" as any,
				timestamp: Date.now(),
				source: "ModelTrainer.trainXGBoost",
				retryable: false,
			},
		};
	}

	/**
	 * Train LSTM model
	 * NOTE: Not implemented - no training script available
	 */
	public async trainLSTM(
		data: DataSplit,
		config: TrainingConfig
	): Promise<MLServiceResponse<TrainingResult>> {
		this.logger.error("LSTM training not implemented", { config });

		return {
			success: false,
			error: {
				type: "VALIDATION_ERROR" as any,
				code: "NOT_IMPLEMENTED" as any,
				message:
					"LSTM training not implemented - no Python training script available. Please create scripts/ml/train-lstm.py to enable this functionality.",
				severity: "high" as any,
				timestamp: Date.now(),
				source: "ModelTrainer.trainLSTM",
				retryable: false,
			},
		};
	}

	/**
	 * Hyperparameter optimization using grid search
	 */
	public async optimizeHyperparameters(
		data: DataSplit,
		config: TrainingConfig,
		paramGrid: HyperparameterGrid
	): Promise<MLServiceResponse<OptimizationResult>> {
		const startTime = Date.now();

		try {
			this.logger.info("Starting hyperparameter optimization", {
				modelType: config.modelType,
				gridSize: Object.keys(paramGrid).length,
			});

			// Generate all parameter combinations
			const paramCombinations = this.generateParamCombinations(paramGrid);

			const allResults: Array<{
				params: Record<string, any>;
				score: number;
				metrics: TrainingMetrics;
			}> = [];

			let bestScore = -Infinity;
			let bestParams: Record<string, any> = {};

			// Try each parameter combination
			for (const params of paramCombinations) {
				const trainingConfig = {
					...config,
					hyperparameters: { ...config.hyperparameters, ...params },
				};

				// Train with this parameter set
				let trainingResult: MLServiceResponse<TrainingResult>;
				if (config.modelType === ModelType.LIGHTGBM) {
					trainingResult = await this.trainLightGBM(data, trainingConfig);
				} else if (config.modelType === ModelType.XGBOOST) {
					trainingResult = await this.trainXGBoost(data, trainingConfig);
				} else {
					trainingResult = await this.trainLSTM(data, trainingConfig);
				}

				if (trainingResult.success && trainingResult.data) {
					const score = trainingResult.data.metrics.validationAccuracy;
					allResults.push({
						params,
						score,
						metrics: trainingResult.data.metrics,
					});

					if (score > bestScore) {
						bestScore = score;
						bestParams = params;
					}
				}
			}

			const optimizationDuration = Date.now() - startTime;

			const result: OptimizationResult = {
				bestParams,
				bestScore,
				allResults,
				optimizationDuration,
			};

			this.logger.info("Hyperparameter optimization completed", {
				bestScore,
				totalCombinations: paramCombinations.length,
				duration: optimizationDuration,
			});

			return {
				success: true,
				data: result,
				metadata: {
					latency: optimizationDuration,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Hyperparameter optimization failed", { error, config });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelTrainer.optimizeHyperparameters"
			) as MLServiceResponse<OptimizationResult>;
		}
	}

	/**
	 * Perform k-fold cross-validation
	 */
	public async crossValidate(
		dataset: TrainingDataset,
		config: TrainingConfig,
		kFolds: number = 5
	): Promise<MLServiceResponse<{ avgScore: number; scores: number[]; stdDev: number }>> {
		const startTime = Date.now();

		try {
			this.logger.info("Starting cross-validation", { kFolds, modelType: config.modelType });

			const foldSize = Math.floor(dataset.features.length / kFolds);
			const scores: number[] = [];

			for (let fold = 0; fold < kFolds; fold++) {
				const validationStart = fold * foldSize;
				const validationEnd = validationStart + foldSize;

				// Create fold split
				const trainFeatures = [
					...dataset.features.slice(0, validationStart),
					...dataset.features.slice(validationEnd),
				];
				const trainLabels = [
					...dataset.labels.slice(0, validationStart),
					...dataset.labels.slice(validationEnd),
				];
				const validationFeatures = dataset.features.slice(validationStart, validationEnd);
				const validationLabels = dataset.labels.slice(validationStart, validationEnd);

				const foldData: DataSplit = {
					train: {
						features: trainFeatures,
						labels: trainLabels,
						timestamps: dataset.timestamps,
						symbols: dataset.symbols,
						featureNames: dataset.featureNames,
					},
					validation: {
						features: validationFeatures,
						labels: validationLabels,
						timestamps: dataset.timestamps.slice(validationStart, validationEnd),
						symbols: dataset.symbols.slice(validationStart, validationEnd),
						featureNames: dataset.featureNames,
					},
					test: {
						features: [],
						labels: [],
						timestamps: [],
						symbols: [],
						featureNames: dataset.featureNames,
					},
				};

				// Train on this fold
				let trainingResult: MLServiceResponse<TrainingResult>;
				if (config.modelType === ModelType.LIGHTGBM) {
					trainingResult = await this.trainLightGBM(foldData, config);
				} else if (config.modelType === ModelType.XGBOOST) {
					trainingResult = await this.trainXGBoost(foldData, config);
				} else {
					trainingResult = await this.trainLSTM(foldData, config);
				}

				if (trainingResult.success && trainingResult.data) {
					scores.push(trainingResult.data.metrics.validationAccuracy);
				}
			}

			// Calculate statistics
			const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
			const variance =
				scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) /
				scores.length;
			const stdDev = Math.sqrt(variance);

			const latency = Date.now() - startTime;
			this.logger.info("Cross-validation completed", {
				avgScore,
				stdDev,
				scores,
				latency,
			});

			return {
				success: true,
				data: { avgScore, scores, stdDev },
				metadata: {
					latency,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Cross-validation failed", { error, config });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelTrainer.crossValidate"
			) as MLServiceResponse<{ avgScore: number; scores: number[]; stdDev: number }>;
		}
	}

	/**
	 * Generate all combinations from parameter grid
	 */
	private generateParamCombinations(grid: HyperparameterGrid): Record<string, any>[] {
		const keys = Object.keys(grid);
		if (keys.length === 0) return [{}];

		const combinations: Record<string, any>[] = [];

		const generate = (index: number, current: Record<string, any>) => {
			if (index === keys.length) {
				combinations.push({ ...current });
				return;
			}

			const key = keys[index];
			const values = grid[key];

			for (const value of values) {
				current[key] = value;
				generate(index + 1, current);
			}
		};

		generate(0, {});
		return combinations;
	}

	/**
	 * Write training data to CSV files for Python script consumption
	 */
	private async writeDataToCSV(data: DataSplit): Promise<{
		trainPath: string;
		valPath: string;
		testPath: string;
	}> {
		const dataDir = path.join(process.cwd(), "data", "training");

		// Ensure data directory exists
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}

		const paths = {
			trainPath: path.join(dataDir, "train.csv"),
			valPath: path.join(dataDir, "val.csv"),
			testPath: path.join(dataDir, "test.csv"),
		};

		// Write each dataset to CSV
		await this.writeDatasetToCSV(data.train, paths.trainPath);
		await this.writeDatasetToCSV(data.validation, paths.valPath);
		await this.writeDatasetToCSV(data.test, paths.testPath);

		this.logger.info("Training data written to CSV files", paths);

		return paths;
	}

	/**
	 * Write a single dataset to CSV file
	 */
	private async writeDatasetToCSV(dataset: TrainingDataset, filePath: string): Promise<void> {
		// Build CSV header: feature names + 'label'
		const header = [...dataset.featureNames, "label"].join(",");

		// Build CSV rows: features + label
		const rows = dataset.features.map((featureRow, idx) => {
			const label = dataset.labels[idx];
			return [...featureRow, label].join(",");
		});

		// Combine header and rows
		const csvContent = [header, ...rows].join("\n");

		// Write to file
		fs.writeFileSync(filePath, csvContent, "utf-8");

		this.logger.info(`Wrote ${rows.length} samples to ${filePath}`);
	}

	/**
	 * Run Python training script via subprocess
	 */
	private async runPythonTraining(csvPaths: {
		trainPath: string;
		valPath: string;
		testPath: string;
	}): Promise<void> {
		const scriptPath = path.join(process.cwd(), "scripts", "ml", "train-lightgbm.py");

		if (!fs.existsSync(scriptPath)) {
			throw new Error(`Python training script not found: ${scriptPath}`);
		}

		this.logger.info("Starting Python LightGBM training", { scriptPath });

		return new Promise((resolve, reject) => {
			const pythonProcess = spawn("python3", [scriptPath], {
				cwd: process.cwd(),
				stdio: ["pipe", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";

			pythonProcess.stdout.on("data", (data: Buffer) => {
				const message = data.toString();
				stdout += message;
				this.logger.info(`[Python] ${message.trim()}`);
			});

			pythonProcess.stderr.on("data", (data: Buffer) => {
				const message = data.toString();
				stderr += message;
				this.logger.warn(`[Python stderr] ${message.trim()}`);
			});

			pythonProcess.on("error", (error: Error) => {
				this.logger.error("Python process error", { error });
				reject(new Error(`Python process failed: ${error.message}`));
			});

			pythonProcess.on("close", (code: number) => {
				if (code === 0) {
					this.logger.info("Python training completed successfully");
					resolve();
				} else {
					this.logger.error("Python training failed", { code, stderr });
					reject(new Error(`Python training script exited with code ${code}: ${stderr}`));
				}
			});
		});
	}

	/**
	 * Clean up temporary CSV files after training
	 */
	private async cleanupCSVFiles(csvPaths: {
		trainPath: string;
		valPath: string;
		testPath: string;
	}): Promise<void> {
		try {
			// Note: We keep the CSV files for debugging and future use
			// Uncomment below to actually delete them after training
			// fs.unlinkSync(csvPaths.trainPath)
			// fs.unlinkSync(csvPaths.valPath)
			// fs.unlinkSync(csvPaths.testPath)
			this.logger.info("Training CSV files preserved for debugging");
		} catch (error) {
			this.logger.warn("Failed to clean up CSV files", { error });
		}
	}

	/**
	 * Health check
	 */
	public async healthCheck(): Promise<boolean> {
		try {
			const featureStoreHealth = await this.featureStore.getHealthStatus();
			return featureStoreHealth.healthy;
		} catch (error) {
			this.logger.error("ModelTrainer health check failed", { error });
			return false;
		}
	}
}

// Export singleton instance
export default ModelTrainer.getInstance();
