/**
 * Sentiment-Fusion Service
 *
 * Purpose: Integrate ML predictions for 3-day price direction into stock selection
 * Pattern: Follows EarlySignalService.ts pattern exactly
 * Target: <100ms additional latency with caching
 *
 * Features:
 * - Predicts price direction (UP/NEUTRAL/DOWN) 3 days ahead
 * - Model loading with singleton pattern
 * - Feature extraction and normalization integration
 * - Confidence filtering (skip 0.35-0.65 low-confidence predictions)
 * - Human-readable reasoning generation
 * - Redis caching (5min TTL)
 * - Multiclass prediction support (3 classes)
 */

import { SentimentFusionFeatureExtractor } from "./SentimentFusionFeatureExtractor";
import { RedisCache } from "../../cache/RedisCache";
import type { PricePrediction, SentimentFusionFeatureVector } from "./types";
import * as fs from "fs";
import * as path from "path";

export interface SentimentFusionConfig {
	modelPath: string;
	normalizerParamsPath: string;
	normalizerPath: string; // Alias for normalizerParamsPath (used by Python script)
	cacheTTL: number; // seconds
	confidenceThresholdLow: number; // Skip predictions below this
	confidenceThresholdHigh: number; // Skip predictions above this
	enableCaching: boolean;
}

export class SentimentFusionService {
	private static modelInstance: any = null;
	private static pythonProcess: any = null;
	private static modelVersion: string = "v1.1.0";
	private featureExtractor: SentimentFusionFeatureExtractor;
	private cache: RedisCache;
	private config: SentimentFusionConfig;
	private featureImportance: Record<string, number> = {};

	constructor(config?: Partial<SentimentFusionConfig>) {
		this.featureExtractor = new SentimentFusionFeatureExtractor();
		this.cache = new RedisCache();

		// Default configuration
		const normalizerPath = path.join(
			process.cwd(),
			"models",
			"sentiment-fusion",
			"v1.1.0",
			"normalizer.json"
		);

		this.config = {
			modelPath: path.join(process.cwd(), "models", "sentiment-fusion", "v1.1.0", "model.txt"),
			normalizerParamsPath: normalizerPath,
			normalizerPath: normalizerPath, // Alias for Python script
			cacheTTL: 300, // 5 minutes
			confidenceThresholdLow: 0.35,
			confidenceThresholdHigh: 0.65,
			enableCaching: true,
			...config,
		};

		console.log("SentimentFusionService initialized");
	}

	/**
	 * Predict price direction for a symbol
	 * @param symbol Stock symbol (e.g., 'TSLA')
	 * @returns Prediction or null if confidence too low
	 */
	async predict(symbol: string): Promise<PricePrediction | null> {
		const startTime = Date.now();

		try {
			// Check cache first
			const cacheKey = this.getCacheKey(symbol);
			if (this.config.enableCaching) {
				const cached = await this.cache.get(cacheKey);
				if (cached) {
					console.log(`Cache hit for ${symbol} (${Date.now() - startTime}ms)`);
					return JSON.parse(cached);
				}
			}

			// Load model if not already loaded
			if (!SentimentFusionService.modelInstance) {
				await this.loadModel();
			}

			// Extract features (Python script handles normalization)
			const features = await this.featureExtractor.extractFeatures(symbol);

			// Convert FeatureVector to ordered array for Python (45 features)
			const featureArray = this.featuresToArray(features);

			// Make prediction with raw features (Python normalizes them)
			const predictionResponse = await this.predictWithModel(featureArray);

			// Parse 3-class response: {prediction: 0|1|2, probabilities: [down, neutral, up]}
			const { prediction, probabilities } = predictionResponse;

			// Map prediction to direction: 0=DOWN, 1=NEUTRAL, 2=UP
			const directions = ['DOWN', 'NEUTRAL', 'UP'] as const;
			const direction = directions[prediction];

			// Get confidence as max probability
			const confidence = Math.max(...probabilities);

			// Filter low-confidence predictions (35-65% range is too uncertain)
			if (confidence < this.config.confidenceThresholdHigh) {
				console.log(
					`Low confidence prediction for ${symbol}: ${(confidence * 100).toFixed(1)}%`
				);
				return null;
			}

			// Generate human-readable reasoning
			const reasoning = this.generateReasoning(features, direction, confidence);

			// Build prediction result
			const result: PricePrediction = {
				direction,
				confidence,
				probabilities: {
					DOWN: probabilities[0],
					NEUTRAL: probabilities[1],
					UP: probabilities[2],
				},
				horizon: "3_days",
				reasoning,
				feature_importance: this.featureImportance,
				prediction_timestamp: Date.now(),
				model_version: SentimentFusionService.modelVersion,
			};

			// Cache the result
			if (this.config.enableCaching) {
				await this.cache.set(cacheKey, JSON.stringify(result), this.config.cacheTTL);
			}

			const latencyMs = Date.now() - startTime;
			console.log(`Prediction completed for ${symbol} (${latencyMs}ms)`);

			return result;
		} catch (error) {
			console.error(`Failed to predict price direction for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Convert feature vector to ordered array matching training data
	 */
	private featuresToArray(features: SentimentFusionFeatureVector): number[] {
		return [
			// Sentiment (4)
			features.sentiment_negative,
			features.sentiment_neutral,
			features.sentiment_positive,
			features.sentiment_score,
			// Technical (7)
			features.rsi_14,
			features.ema_20,
			features.sma_50,
			features.ema_20_distance,
			features.sma_50_distance,
			features.bollinger_position,
			features.macd_signal,
			// More technical (6)
			features.macd_histogram,
			features.atr_14,
			features.adx_14,
			features.stochastic_k,
			features.williams_r,
			// Volume (6)
			features.volume_ratio_5d,
			features.volume_spike,
			features.relative_volume,
			features.volume_trend,
			features.volume_acceleration,
			features.dark_pool_ratio,
			// Price momentum (6)
			features.price_momentum_5d,
			features.price_momentum_10d,
			features.price_momentum_20d,
			features.price_acceleration,
			features.gap_size,
			features.volatility_20d,
			// Intraday (2)
			features.overnight_return,
			features.intraday_range,
			// Options (7) - unavailable
			features.options_put_call_ratio,
			features.options_unusual_activity,
			features.options_iv_rank,
			features.options_call_volume,
			features.options_put_volume,
			features.options_oi_put_call,
			features.options_gamma_exposure,
			// Institutional (4) - unavailable
			features.institutional_net_flow,
			features.institutional_block_trades,
			features.institutional_ownership_pct,
			features.insider_buying_ratio,
			// Market context (4)
			features.sector_momentum,
			features.spy_correlation,
			features.vix_level,
			features.sector_relative_strength,
		];
	}

	/**
	 * Load ML model and normalizer parameters
	 */
	private async loadModel(): Promise<void> {
		try {
			console.log("Loading sentiment-fusion ML model and normalizer...");

			// Load feature importance from trained model metadata
			const metadataPath = path.join(
				process.cwd(),
				"models/sentiment-fusion/v1.1.0/metadata.json"
			);
			if (fs.existsSync(metadataPath)) {
				const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

				// Convert top_features array to feature_importance object
				if (metadata.top_features && Array.isArray(metadata.top_features)) {
					this.featureImportance = {};
					for (const item of metadata.top_features) {
						this.featureImportance[item.feature] = item.importance;
					}
				}

				console.log(`✅ Feature importance loaded from trained model`);
			}

			// Spawn persistent Python process with trained model
			const { spawn } = await import("child_process");

			const scriptPath = path.join(process.cwd(), "scripts/ml/predict-generic.py");
			console.log(
				`🐍 Starting Python prediction server with real LightGBM model: ${scriptPath}`
			);

			SentimentFusionService.pythonProcess = spawn("python3", [scriptPath], {
				cwd: process.cwd(),
				stdio: ["pipe", "pipe", "pipe"],
			});

			// Wait for READY signal from Python server
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error("Python server startup timeout (10s)")),
					10000
				);

				SentimentFusionService.pythonProcess.stderr.on("data", (data: Buffer) => {
					const message = data.toString().trim();
					if (message.includes("READY")) {
						clearTimeout(timeout);
						console.log(`✅ Python prediction server ready`);
						resolve();
					}
					if (message.includes("ERROR")) {
						clearTimeout(timeout);
						reject(new Error(`Python server error: ${message}`));
					}
				});

				SentimentFusionService.pythonProcess.on("error", (err: Error) => {
					clearTimeout(timeout);
					reject(err);
				});
			});

			// Create prediction wrapper for async communication with Python
			SentimentFusionService.modelInstance = {
				predict: async (featuresArray: number[]): Promise<{ prediction: number; probabilities: number[] }> => {
					return new Promise((resolve, reject) => {
						// Convert array to object using feature names from normalizer
						const featureNames = require(this.config.normalizerPath).feature_names;
						const features: Record<string, number> = {};
						featuresArray.forEach((value, index) => {
							features[featureNames[index]] = value;
						});

						const request = JSON.stringify({
							features,
							modelPath: this.config.modelPath,
							normalizerPath: this.config.normalizerPath,
						}) + "\n";

						const timeout = setTimeout(
							() => reject(new Error("Prediction timeout")),
							5000
						);

						const onData = (data: Buffer) => {
							try {
								const response = JSON.parse(data.toString());
								clearTimeout(timeout);
								SentimentFusionService.pythonProcess.stdout.removeListener(
									"data",
									onData
								);

								if (response.success) {
									console.log(
										`🎯 Real model prediction: class ${response.data.prediction}, confidence: ${(Math.max(...response.data.probabilities) * 100).toFixed(1)}%`
									);
									resolve({
										prediction: response.data.prediction,
										probabilities: response.data.probabilities,
									});
								} else {
									reject(new Error(response.error || "Prediction failed"));
								}
							} catch (err) {
								clearTimeout(timeout);
								reject(err);
							}
						};

						SentimentFusionService.pythonProcess.stdout.on("data", onData);
						SentimentFusionService.pythonProcess.stdin.write(request);
					});
				},
			};

			console.log(
				`✅ Real LightGBM model loaded successfully (version ${SentimentFusionService.modelVersion}, 53.8% accuracy)`
			);
		} catch (error) {
			console.error("Failed to load model:", error);
			throw new Error(
				`Model loading failed: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}

	/**
	 * Make prediction using loaded model
	 */
	private async predictWithModel(
		features: number[]
	): Promise<{ prediction: number; probabilities: number[] }> {
		if (!SentimentFusionService.modelInstance) {
			throw new Error("Model not loaded");
		}

		try {
			const result = await SentimentFusionService.modelInstance.predict(features);
			return result;
		} catch (error) {
			console.error("Prediction failed:", error);
			throw error;
		}
	}

	/**
	 * Generate human-readable reasoning from features
	 */
	private generateReasoning(
		features: SentimentFusionFeatureVector,
		direction: 'UP' | 'NEUTRAL' | 'DOWN',
		confidence: number
	): string[] {
		const reasoning: string[] = [];

		// Add overall signal
		reasoning.push(
			`Predicting ${direction} movement with ${(confidence * 100).toFixed(1)}% confidence`
		);

		// Analyze sentiment
		if (features.sentiment_score > 0.1) {
			reasoning.push(`Positive sentiment detected (score: ${features.sentiment_score.toFixed(2)})`);
		} else if (features.sentiment_score < -0.1) {
			reasoning.push(`Negative sentiment detected (score: ${features.sentiment_score.toFixed(2)})`);
		}

		// Analyze price momentum
		if (Math.abs(features.price_momentum_20d) > 0.05) {
			const direction_text = features.price_momentum_20d > 0 ? 'upward' : 'downward';
			reasoning.push(`Strong ${direction_text} 20-day momentum (${(features.price_momentum_20d * 100).toFixed(1)}%)`);
		}

		// Analyze RSI
		if (features.rsi_14 > 70) {
			reasoning.push(`RSI indicates overbought conditions (${features.rsi_14.toFixed(1)})`);
		} else if (features.rsi_14 < 30) {
			reasoning.push(`RSI indicates oversold conditions (${features.rsi_14.toFixed(1)})`);
		}

		// Analyze volume
		if (features.volume_spike > 0.5) {
			reasoning.push(`Unusual volume spike detected (+${(features.volume_spike * 100).toFixed(0)}%)`);
		}

		// Analyze volatility
		if (features.volatility_20d > 0.03) {
			reasoning.push(`Elevated volatility (${(features.volatility_20d * 100).toFixed(1)}%)`);
		}

		return reasoning.length > 1
			? reasoning
			: ["Prediction based on comprehensive technical and sentiment analysis"];
	}

	/**
	 * Get cache key for symbol
	 */
	private getCacheKey(symbol: string): string {
		const dateKey = new Date().toISOString().split("T")[0]; // Daily granularity
		return `sentiment_fusion:${symbol}:${dateKey}:${SentimentFusionService.modelVersion}`;
	}

	/**
	 * Clear cache for a symbol (for testing/manual refresh)
	 */
	async clearCache(symbol?: string): Promise<void> {
		if (symbol) {
			const cacheKey = this.getCacheKey(symbol);
			await this.cache.delete(cacheKey);
			console.log(`Cache cleared for ${symbol}`);
		}
	}

	/**
	 * Get service health status
	 */
	async getHealthStatus(): Promise<{
		modelLoaded: boolean;
		cacheConnected: boolean;
		modelVersion: string;
	}> {
		return {
			modelLoaded: SentimentFusionService.modelInstance !== null,
			cacheConnected: await this.cache
				.ping()
				.then(() => true)
				.catch(() => false),
			modelVersion: SentimentFusionService.modelVersion,
		};
	}
}
