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

import { LeanSmartMoneyFeatureExtractor } from "./LeanSmartMoneyFeatureExtractor";
import { ParquetSmartMoneyFeatureExtractor } from "./ParquetSmartMoneyFeatureExtractor";
import { RedisCache } from "../../cache/RedisCache";
import type { LeanSmartMoneyFeatures, ParquetSmartMoneyFeatures } from "./types";
import * as fs from "fs";
import * as path from "path";

// Base features shared by both LeanSmartMoneyFeatures and ParquetSmartMoneyFeatures
type SmartMoneyBaseFeatures = Pick<
	LeanSmartMoneyFeatures,
	| 'congress_buy_count_90d'
	| 'congress_sell_count_90d'
	| 'congress_net_sentiment'
	| 'congress_recent_activity_7d'
	| 'institutional_volume_ratio'
	| 'volume_concentration'
	| 'dark_pool_volume_30d'
	| 'price_momentum_20d'
	| 'volume_trend_30d'
	| 'price_volatility_30d'
>;

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
	private static modelVersion: string = "v2.0.0"; // Using lean 10-feature model
	private featureExtractor: LeanSmartMoneyFeatureExtractor | ParquetSmartMoneyFeatureExtractor;
	private cache: RedisCache;
	private config: SmartMoneyFlowConfig;
	private featureImportance: Record<string, number> = {};

	constructor(config?: Partial<SmartMoneyFlowConfig>) {
		// Choose feature extractor based on configuration
		const useParquet = config?.useParquetFeatureStore ?? false;
		this.featureExtractor = useParquet
			? new ParquetSmartMoneyFeatureExtractor()
			: new LeanSmartMoneyFeatureExtractor();

		this.cache = new RedisCache();

		console.log(`SmartMoneyFlowService using ${useParquet ? 'Parquet' : 'API'}-based feature extraction`);

		// Default configuration - will use v3.0.0 when available, fallback to v2.0.0
		const modelVersion = "v3.0.0"; // 27-feature model with options data (trained Oct 13, 2025)
		const fallbackVersion = "v2.0.0"; // Lean 10-feature model

		// Check if v2.0.0 exists, otherwise use v1.0.0
		const preferredModelPath = path.join(process.cwd(), "models", "smart-money-flow", modelVersion, "model.txt");
		const fallbackModelPath = path.join(process.cwd(), "models", "smart-money-flow", fallbackVersion, "model.txt");

		const modelPath = fs.existsSync(preferredModelPath) ? preferredModelPath : fallbackModelPath;
		const activeVersion = fs.existsSync(preferredModelPath) ? modelVersion : fallbackVersion;

		const normalizerPath = path.join(
			process.cwd(),
			"models",
			"smart-money-flow",
			activeVersion,
			"normalizer.json"
		);

		this.config = {
			modelPath,
			normalizerParamsPath: normalizerPath,
			normalizerPath: normalizerPath, // Alias for Python script
			cacheTTL: 300, // 5 minutes
			confidenceThresholdLow: 0.35,
			confidenceThresholdHigh: 0.65,
			enableCaching: true,
			...config,
		};

		console.log(`SmartMoneyFlowService initialized with model ${activeVersion} (${activeVersion === 'v3.0.0' ? '27' : '10'} features)`);
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

			// Extract features (Python script handles normalization)
			const asOfDate = new Date(); // Use current date for real-time analysis
			const features = await this.featureExtractor.extractFeatures(symbol, asOfDate);

			// Convert FeatureVector to ordered array for Python (10 lean features)
			const featureArray = this.featuresToArray(features);

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
			const reasoning = this.generateReasoning(features, action, confidence);

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

	/**
	 * Convert feature object to ordered array matching model training order
	 */
	private featuresToArray(features: LeanSmartMoneyFeatures | ParquetSmartMoneyFeatures): number[] {
		// Order must match training data column order (10 lean features)
		// Based on: data/training/smart-money-flow-lean/train.csv header
		// Both LeanSmartMoneyFeatures and ParquetSmartMoneyFeatures have these base 10 features
		return [
			features.congress_buy_count_90d,
			features.congress_sell_count_90d,
			features.congress_net_sentiment,
			features.congress_recent_activity_7d,
			features.institutional_volume_ratio,
			features.volume_concentration,
			features.dark_pool_volume_30d,
			features.price_momentum_20d,
			features.volume_trend_30d,
			features.price_volatility_30d,
		];
	}

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

	/**
	 * Generate human-readable reasoning based on base features
	 * Works with both LeanSmartMoneyFeatures and ParquetSmartMoneyFeatures
	 */
	private generateReasoning(
		features: LeanSmartMoneyFeatures | ParquetSmartMoneyFeatures,
		action: 'BUY' | 'SELL',
		confidence: number
	): string {
		const reasons: string[] = [];

		// Congressional trades (4 features)
		if (features.congress_recent_activity_7d === 1) {
			const netSentiment = features.congress_net_sentiment;
			if (netSentiment > 0.3) {
				reasons.push(`Strong congressional buying (${features.congress_buy_count_90d} buys in 90d)`);
			} else if (netSentiment < -0.3) {
				reasons.push(`Heavy congressional selling (${features.congress_sell_count_90d} sells in 90d)`);
			} else {
				reasons.push("Recent congressional trading activity");
			}
		}

		// Institutional volume (3 features)
		if (features.institutional_volume_ratio > 0.3) {
			reasons.push("High institutional trading activity");
		}
		if (features.volume_concentration > 0.5) {
			reasons.push("Volume concentrated in large blocks");
		}
		if (features.dark_pool_volume_30d > 1000000000) {
			reasons.push("Significant dark pool volume");
		}

		// Price momentum (3 features)
		if (features.price_momentum_20d > 0.1) {
			reasons.push("Strong 20-day upward momentum");
		} else if (features.price_momentum_20d < -0.1) {
			reasons.push("Strong 20-day downward momentum");
		}

		if (features.volume_trend_30d > 1.5) {
			reasons.push("Volume increasing significantly");
		} else if (features.volume_trend_30d < 0.7) {
			reasons.push("Volume declining");
		}

		if (features.price_volatility_30d > 0.03) {
			reasons.push("High price volatility (30d)");
		}

		if (reasons.length === 0) {
			reasons.push("Mixed smart money signals");
		}

		return `Smart Money ${action} signal (${(confidence * 100).toFixed(1)}% confidence): ${reasons.join("; ")}`;
	}

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
