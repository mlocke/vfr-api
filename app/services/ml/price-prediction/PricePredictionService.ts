/**
 * Price Prediction Service
 *
 * Purpose: Predict price movement direction (UP/DOWN/NEUTRAL) for stocks
 * Target: <100ms additional latency with caching
 *
 * Features:
 * - Predicts 1-week price movement direction
 * - Model loading with singleton pattern
 * - Feature extraction and normalization integration
 * - Confidence filtering (skip 0.35-0.65 low-confidence predictions)
 * - Human-readable reasoning generation
 * - Redis caching (5min TTL)
 *
 * Architecture: Mirrors EarlySignalService for consistency
 */

import { PricePredictionFeatureExtractor } from "../features/PricePredictionFeatureExtractor";
import { RedisCache } from "../../cache/RedisCache";
import * as fs from "fs";
import * as path from "path";

export interface PricePrediction {
	symbol: string;
	prediction: 'UP' | 'DOWN' | 'NEUTRAL';
	confidence: number;
	probabilities: {
		up: number;
		neutral: number;
		down: number;
	};
	reasoning: string[];
	topFeatures: Array<{
		name: string;
		value: number;
		importance: number;
	}>;
	timestamp: number;
	modelVersion: string;
}

export interface PricePredictionConfig {
	modelPath: string;
	normalizerParamsPath: string;
	cacheTTL: number; // seconds
	confidenceThresholdLow: number;
	confidenceThresholdHigh: number;
	enableCaching: boolean;
}

export class PricePredictionService {
	private static modelInstance: any = null;
	private static pythonProcess: any = null;
	private static modelVersion: string = "v1.1.0";
	private featureExtractor: PricePredictionFeatureExtractor;
	private cache: RedisCache;
	private config: PricePredictionConfig;
	private featureImportance: Record<string, number> = {};

	constructor(config?: Partial<PricePredictionConfig>) {
		this.featureExtractor = new PricePredictionFeatureExtractor();
		this.cache = new RedisCache();

		// Default configuration
		this.config = {
			modelPath: path.join(process.cwd(), "models", "price-prediction", "v1.1.0", "model.txt"),
			normalizerParamsPath: path.join(
				process.cwd(),
				"models",
				"price-prediction",
				"v1.1.0",
				"normalizer.json"
			),
			cacheTTL: 300, // 5 minutes
			confidenceThresholdLow: 0.35,
			confidenceThresholdHigh: 0.65,
			enableCaching: true,
			...config,
		};

		console.log("PricePredictionService initialized");
	}

	/**
	 * Predict price movement for a symbol
	 * @param symbol Stock symbol (e.g., 'TSLA')
	 * @param sector Stock sector for context
	 * @returns Prediction or null if confidence too low
	 */
	async predictPriceMovement(
		symbol: string,
		sector: string
	): Promise<PricePrediction | null> {
		const startTime = Date.now();

		try {
			// Check cache first
			const cacheKey = this.getCacheKey(symbol);
			if (this.config.enableCaching) {
				const cached = await this.cache.get(cacheKey);
				if (cached) {
					console.log(`[PricePrediction] Cache hit for ${symbol} (${Date.now() - startTime}ms)`);
					return JSON.parse(cached);
				}
			}

			// Load model if not already loaded
			if (!PricePredictionService.modelInstance) {
				await this.loadModel();
			}

			// Extract features
			const features = await this.featureExtractor.extractFeatures(symbol);

			// Load feature importance from metadata
			if (Object.keys(this.featureImportance).length === 0) {
				await this.loadFeatureImportance();
			}

			// Make prediction using Python subprocess
			const prediction = await this.predict(features);

			if (!prediction) {
				console.log(`[PricePrediction] Prediction failed for ${symbol}`);
				return null;
			}

			// Filter out low-confidence predictions (0.35-0.65 range)
			if (
				prediction.confidence > this.config.confidenceThresholdLow &&
				prediction.confidence < this.config.confidenceThresholdHigh
			) {
				console.log(
					`[PricePrediction] Skipping low-confidence prediction for ${symbol}: ${prediction.confidence.toFixed(2)}`
				);
				return null;
			}

			// Generate reasoning
			const reasoning = this.generateReasoning(prediction, features);

			// Get top features by importance
			const topFeatures = this.getTopFeatures(features, 5);

			const result: PricePrediction = {
				symbol,
				prediction: prediction.prediction,
				confidence: prediction.confidence,
				probabilities: prediction.probabilities,
				reasoning,
				topFeatures,
				timestamp: Date.now(),
				modelVersion: PricePredictionService.modelVersion,
			};

			// Cache result
			if (this.config.enableCaching) {
				await this.cache.set(cacheKey, JSON.stringify(result), this.config.cacheTTL);
			}

			const duration = Date.now() - startTime;
			console.log(`[PricePrediction] Prediction for ${symbol} completed in ${duration}ms`);

			return result;
		} catch (error) {
			console.error(`[PricePrediction] Failed to predict for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Load model from disk
	 */
	private async loadModel(): Promise<void> {
		const startTime = Date.now();

		try {
			if (!fs.existsSync(this.config.modelPath)) {
				throw new Error(`Model file not found: ${this.config.modelPath}`);
			}

			console.log(`[PricePrediction] Loading model from ${this.config.modelPath}`);

			// Start Python subprocess for predictions
			const { spawn } = require("child_process");
			const pythonScript = path.join(process.cwd(), "scripts", "ml", "predict-generic.py");

			PricePredictionService.pythonProcess = spawn("python3", [pythonScript]);

			// Wait for Python process to be ready
			await new Promise((resolve) => setTimeout(resolve, 1000));

			PricePredictionService.modelInstance = true; // Mark as loaded

			const duration = Date.now() - startTime;
			console.log(`[PricePrediction] Model loaded in ${duration}ms`);
		} catch (error) {
			console.error("[PricePrediction] Failed to load model:", error);
			throw error;
		}
	}

	/**
	 * Load feature importance from model metadata
	 */
	private async loadFeatureImportance(): Promise<void> {
		try {
			const metadataPath = path.join(
				process.cwd(),
				"models",
				"price-prediction",
				PricePredictionService.modelVersion,
				"metadata.json"
			);

			if (fs.existsSync(metadataPath)) {
				const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
				if (metadata.metrics?.feature_importance) {
					metadata.metrics.feature_importance.forEach((item: any) => {
						this.featureImportance[item.feature] = item.importance;
					});
				}
			}
		} catch (error) {
			console.error("[PricePrediction] Failed to load feature importance:", error);
		}
	}

	/**
	 * Make prediction using loaded model
	 */
	private async predict(features: any): Promise<{
		prediction: 'UP' | 'DOWN' | 'NEUTRAL';
		confidence: number;
		probabilities: { up: number; neutral: number; down: number };
	} | null> {
		try {
			// Convert features to array matching model training order
			const featureNames = [
				'volume_ratio_5d', 'volume_spike', 'volume_trend_10d', 'relative_volume',
				'volume_acceleration', 'dark_pool_ratio', 'rsi_14', 'macd_signal',
				'macd_histogram', 'bollinger_position', 'stochastic_k', 'adx_14',
				'atr_14', 'ema_20_distance', 'sma_50_distance', 'williams_r',
				'price_momentum_5d', 'price_momentum_10d', 'price_momentum_20d',
				'price_acceleration', 'gap_percent', 'intraday_volatility',
				'overnight_return', 'week_high_distance', 'put_call_ratio',
				'put_call_ratio_change', 'unusual_options_activity', 'options_iv_rank',
				'gamma_exposure', 'max_pain_distance', 'options_volume_ratio',
				'institutional_net_flow', 'block_trade_volume', 'insider_buying_ratio',
				'ownership_change_30d', 'news_sentiment_delta', 'social_momentum',
				'analyst_target_distance', 'earnings_surprise_impact', 'sector_momentum_5d',
				'spy_momentum_5d', 'vix_level', 'correlation_to_spy_20d'
			];

			const featureArray = featureNames.map(name => features[name] || 0);

			// Send request to Python subprocess
			const request = {
				features: featureArray,
				modelPath: this.config.modelPath,
				normalizerPath: this.config.normalizerParamsPath,
			};

			PricePredictionService.pythonProcess.stdin.write(JSON.stringify(request) + "\n");

			// Read response from Python subprocess
			const response = await new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error("Prediction timeout")), 5000);

				PricePredictionService.pythonProcess.stdout.once("data", (data: Buffer) => {
					clearTimeout(timeout);
					resolve(data.toString());
				});
			});

			const result = JSON.parse(response);

			// Map prediction class to direction
			const classMap: { [key: number]: 'DOWN' | 'NEUTRAL' | 'UP' } = {
				0: 'DOWN',
				1: 'NEUTRAL',
				2: 'UP'
			};

			return {
				prediction: classMap[result.prediction] || 'NEUTRAL',
				confidence: result.confidence,
				probabilities: {
					down: result.probabilities[0],
					neutral: result.probabilities[1],
					up: result.probabilities[2],
				}
			};
		} catch (error) {
			console.error("[PricePrediction] Prediction error:", error);
			return null;
		}
	}

	/**
	 * Generate human-readable reasoning
	 */
	private generateReasoning(
		prediction: { prediction: string; confidence: number; probabilities: any },
		features: any
	): string[] {
		const reasoning: string[] = [];

		// Main prediction
		reasoning.push(
			`Price expected to move ${prediction.prediction} with ${(prediction.confidence * 100).toFixed(0)}% confidence`
		);

		// Volume analysis
		if (features.volume_spike > 0.5) {
			reasoning.push("Unusual volume spike detected");
		}
		if (features.volume_trend_10d > 0.1) {
			reasoning.push("Rising volume trend supports momentum");
		}

		// Technical indicators
		if (features.rsi_14 > 70) {
			reasoning.push("RSI indicates overbought conditions");
		} else if (features.rsi_14 < 30) {
			reasoning.push("RSI indicates oversold conditions");
		}

		if (features.macd_signal > 0) {
			reasoning.push("MACD showing bullish signal");
		} else if (features.macd_signal < 0) {
			reasoning.push("MACD showing bearish signal");
		}

		// Price momentum
		if (features.price_momentum_20d > 0.1) {
			reasoning.push("Strong upward price momentum");
		} else if (features.price_momentum_20d < -0.1) {
			reasoning.push("Strong downward price momentum");
		}

		// Options flow
		if (features.put_call_ratio > 1.5) {
			reasoning.push("High put/call ratio suggests bearish sentiment");
		} else if (features.put_call_ratio < 0.5) {
			reasoning.push("Low put/call ratio suggests bullish sentiment");
		}

		// Institutional activity
		if (features.institutional_net_flow > 0.1) {
			reasoning.push("Strong institutional buying detected");
		} else if (features.institutional_net_flow < -0.1) {
			reasoning.push("Strong institutional selling detected");
		}

		return reasoning;
	}

	/**
	 * Get top features by importance
	 */
	private getTopFeatures(features: any, count: number): Array<{
		name: string;
		value: number;
		importance: number;
	}> {
		const featureList = Object.entries(features)
			.filter(([name]) => name !== 'symbol' && name !== 'timestamp')
			.map(([name, value]) => ({
				name,
				value: value as number,
				importance: this.featureImportance[name] || 0,
			}))
			.sort((a, b) => b.importance - a.importance)
			.slice(0, count);

		return featureList;
	}

	/**
	 * Generate cache key
	 */
	private getCacheKey(symbol: string): string {
		return `price_prediction:${symbol}`;
	}

	/**
	 * Clear cache for a symbol
	 */
	async clearCache(symbol: string): Promise<void> {
		const cacheKey = this.getCacheKey(symbol);
		await this.cache.delete(cacheKey);
	}

	/**
	 * Health check
	 */
	async healthCheck(): Promise<{ healthy: boolean; modelLoaded: boolean }> {
		return {
			healthy: PricePredictionService.modelInstance !== null,
			modelLoaded: PricePredictionService.modelInstance !== null,
		};
	}
}
