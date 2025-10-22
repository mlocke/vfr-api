/**
 * Smart Money Flow Service
 *
 * Purpose: Integrate ML predictions for institutional/insider activity into stock selection
 * Pattern: Follows SentimentFusionService.ts pattern
 * Target: <100ms additional latency with caching
 *
 * Features:
 * - Predicts institutional buying/selling activity based on smart money flows
 * - Model loading with singleton pattern
 * - Feature extraction and normalization integration
 * - Confidence filtering (skip 0.35-0.65 low-confidence predictions)
 * - Human-readable reasoning generation
 * - Redis caching (5min TTL)
 * - Binary classification (BUY/SELL)
 */

import { AdaptiveFeatureExtractor } from "../features/AdaptiveFeatureExtractor";
import { RedisCache } from "../../cache/RedisCache";
import * as fs from "fs";
import * as path from "path";

// Removed hardcoded feature types - now using adaptive extraction

export interface SmartMoneyPrediction {
	action: 'BUY' | 'SELL';
	confidence: number;
	probability: number; // Probability of the predicted action
	reasoning: string;
	feature_importance: Record<string, number>;
	prediction_timestamp: number;
	model_version: string;
}

export interface SmartMoneyFlowConfig {
	modelPath: string;
	normalizerParamsPath: string;
	normalizerPath: string; // Alias for normalizerParamsPath (used by Python script)
	cacheTTL: number; // seconds
	confidenceThresholdLow: number; // Skip predictions below this
	confidenceThresholdHigh: number; // Skip predictions above this
	enableCaching: boolean;
	useParquetFeatureStore?: boolean; // Use Parquet-based feature extraction (96% faster)
}

export class SmartMoneyFlowService {
	private static modelInstance: any = null;
	private static pythonProcess: any = null;
	private static modelVersion: string = "v2.0.0";
	private featureExtractor: AdaptiveFeatureExtractor;
	private cache: RedisCache;
	private config: SmartMoneyFlowConfig;
	private featureImportance: Record<string, number> = {};
	private modelDir: string = "";

	constructor(config?: Partial<SmartMoneyFlowConfig>) {
		// Use adaptive feature extractor
		this.featureExtractor = new AdaptiveFeatureExtractor();
		this.cache = new RedisCache();

		console.log(`SmartMoneyFlowService using AdaptiveFeatureExtractor`);

		// Find the best available model version
		const availableVersions = ['v2.0.0', 'v1.0.0'];
		let activeVersion = 'v2.0.0';
		let modelPath = '';

		for (const version of availableVersions) {
			const testPath = path.join(process.cwd(), "models", "smart-money-flow", version, "model.txt");
			if (fs.existsSync(testPath)) {
				activeVersion = version;
				modelPath = testPath;
				break;
			}
		}

		if (!modelPath) {
			throw new Error("No smart-money-flow model found in models/smart-money-flow/");
		}

		this.modelDir = path.dirname(modelPath);
		const normalizerPath = path.join(this.modelDir, "normalizer.json");

		this.config = {
			modelPath,
			normalizerParamsPath: normalizerPath,
			normalizerPath: normalizerPath,
			cacheTTL: 300,
			confidenceThresholdLow: 0.35,
			confidenceThresholdHigh: 0.65,
			enableCaching: true,
			...config,
		};

		SmartMoneyFlowService.modelVersion = activeVersion;

		// Log feature count from metadata
		const requiredFeatures = this.featureExtractor.getRequiredFeatures(this.modelDir);
		console.log(
			`SmartMoneyFlowService initialized with model ${activeVersion} (${requiredFeatures.length} features)`
		);
	}

	/**
	 * Predict smart money activity for a symbol
	 * @param symbol Stock symbol (e.g., 'TSLA')
	 * @returns Prediction or null if confidence too low
	 */
	async predict(symbol: string): Promise<SmartMoneyPrediction | null> {
		const startTime = Date.now();

		try {
			// Check cache first
			const cacheKey = this.getCacheKey(symbol);
			if (this.config.enableCaching) {
				const cached = await this.cache.get(cacheKey);
				if (cached) {
					console.log(`Smart Money cache hit for ${symbol} (${Date.now() - startTime}ms)`);
					return JSON.parse(cached);
				}
			}

			// Load model if not already loaded
			if (!SmartMoneyFlowService.modelInstance) {
				await this.loadModel();
			}

			// Extract features adaptively based on model metadata
			const asOfDate = new Date();
			const featureArray = await this.featureExtractor.extractFeaturesForModel(
				this.modelDir,
				symbol,
				asOfDate
			);

			// Make prediction with raw features (Python normalizes them)
			const predictionResponse = await this.predictWithModel(featureArray);

			// Parse binary response: {prediction: 0|1, confidence: number}
			const { prediction, confidence } = predictionResponse;

			// Map prediction to action: 0=SELL, 1=BUY
			const action = prediction === 1 ? 'BUY' : 'SELL';

			// Filter predictions in the "uncertain" confidence range (35-65%)
			// Keep strong predictions: either low confidence (<35%) or high confidence (>65%)
			if (confidence >= this.config.confidenceThresholdLow && confidence <= this.config.confidenceThresholdHigh) {
				console.log(
					`Uncertain confidence smart money prediction for ${symbol}: ${(confidence * 100).toFixed(1)}% (skipping)`
				);
				return null;
			}

			// Generate human-readable reasoning
			const reasoning = `Smart Money ${action} signal (${(confidence * 100).toFixed(1)}% confidence) based on ${featureArray.length} features`;

			// Build prediction result
			const result: SmartMoneyPrediction = {
				action,
				confidence,
				probability: confidence,
				reasoning,
				feature_importance: this.featureImportance,
				prediction_timestamp: Date.now(),
				model_version: SmartMoneyFlowService.modelVersion,
			};

			// Cache the result
			if (this.config.enableCaching) {
				await this.cache.set(cacheKey, JSON.stringify(result), this.config.cacheTTL);
			}

			const latencyMs = Date.now() - startTime;
			console.log(`Smart Money prediction completed for ${symbol} (${latencyMs}ms)`);

			return result;
		} catch (error) {
			console.error(`Failed to predict smart money activity for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Load the LightGBM model
	 */
	private async loadModel(): Promise<void> {
		try {
			console.log(`Loading Smart Money Flow model from ${this.config.modelPath}`);

			// Verify model file exists
			if (!fs.existsSync(this.config.modelPath)) {
				throw new Error(`Model file not found: ${this.config.modelPath}`);
			}

			// Verify normalizer exists
			if (!fs.existsSync(this.config.normalizerPath)) {
				throw new Error(`Normalizer file not found: ${this.config.normalizerPath}`);
			}

			// Load feature importance from metadata
			const metadataPath = path.join(
				path.dirname(this.config.modelPath),
				"metadata.json"
			);
			if (fs.existsSync(metadataPath)) {
				const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
				if (metadata.feature_importance) {
					this.featureImportance = metadata.feature_importance.reduce(
						(acc: Record<string, number>, item: any) => {
							acc[item.feature] = item.importance;
							return acc;
						},
						{}
					);
				}
			}

			// Mark as loaded (actual loading happens in Python subprocess)
			SmartMoneyFlowService.modelInstance = { loaded: true };

			console.log(
				`✅ Smart Money Flow model v${SmartMoneyFlowService.modelVersion} loaded successfully`
			);
		} catch (error) {
			console.error("Failed to load Smart Money Flow model:", error);
			throw error;
		}
	}

	// Removed featuresToArray - now using adaptive extraction

	/**
	 * Make prediction using Python subprocess
	 */
	private async predictWithModel(features: number[]): Promise<{ prediction: number; confidence: number }> {
		return new Promise((resolve, reject) => {
			const { spawn } = require("child_process");

			const pythonScript = path.join(process.cwd(), "scripts", "ml", "predict-cli.py");
			const pythonProcess = spawn("python3", [
				pythonScript,
				"--features",
				JSON.stringify(features),
				"--model-path",
				this.config.modelPath,
				"--normalizer-path",
				this.config.normalizerPath,
			]);

			let stdout = "";
			let stderr = "";

			pythonProcess.stdout.on("data", (data: Buffer) => {
				stdout += data.toString();
			});

			pythonProcess.stderr.on("data", (data: Buffer) => {
				stderr += data.toString();
			});

			pythonProcess.on("close", (code: number) => {
				if (code !== 0) {
					reject(new Error(`Python process failed: ${stderr}`));
					return;
				}

				try {
					const result = JSON.parse(stdout);
					resolve(result);
				} catch (error) {
					reject(new Error(`Failed to parse Python output: ${stdout}`));
				}
			});

			// Timeout after 5 seconds
			setTimeout(() => {
				pythonProcess.kill();
				reject(new Error("Python prediction timeout"));
			}, 5000);
		});
	}

	// Removed generateReasoning - now using simple generic reasoning

	/**
	 * Generate cache key for a symbol
	 */
	private getCacheKey(symbol: string): string {
		return `smart_money_flow:prediction:${symbol}`;
	}

	/**
	 * Clear cache for a symbol (useful for testing)
	 */
	async clearCache(symbol?: string): Promise<void> {
		if (symbol) {
			await this.cache.delete(this.getCacheKey(symbol));
		} else {
			// Clear all smart money predictions
			console.warn("Clearing all smart money flow predictions from cache");
		}
	}

	/**
	 * Health check
	 */
	async healthCheck(): Promise<{
		status: "healthy" | "degraded" | "unhealthy";
		modelLoaded: boolean;
		cacheConnected: boolean;
	}> {
		try {
			const cacheConnected = await this.cache
				.ping()
				.then(() => true)
				.catch(() => false);

			const modelLoaded = SmartMoneyFlowService.modelInstance !== null;

			return {
				status: modelLoaded && cacheConnected ? "healthy" : "degraded",
				modelLoaded,
				cacheConnected,
			};
		} catch (error) {
			return {
				status: "unhealthy",
				modelLoaded: false,
				cacheConnected: false,
			};
		}
	}
}
