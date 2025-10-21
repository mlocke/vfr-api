/**
 * Volatility Prediction Service
 *
 * Purpose: Predict 21-day forward realized volatility for risk management
 * Pattern: Follows SmartMoneyFlowService.ts singleton pattern
 * Target: <100ms prediction latency with caching
 *
 * Features:
 * - Predicts annualized volatility percentage (e.g., 32.5% = moderate risk)
 * - Model loading with singleton pattern
 * - Feature extraction and normalization
 * - Confidence assessment based on feature completeness
 * - Risk categorization (low/moderate/high/extreme)
 * - Redis caching (5min TTL)
 */

import type {
	VolatilityPrediction,
	VolatilityPredictionConfig,
	NormalizationStats,
	VolatilityFeatures
} from "./types";
import { RiskCategory, ConfidenceLevel } from "./types";
import { RedisCache } from "../../cache/RedisCache";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

export class VolatilityPredictionService {
	private static instance: VolatilityPredictionService;
	private static modelInstance: any = null;
	private static modelVersion: string = "v1.0.0";
	private cache: RedisCache;
	private config: VolatilityPredictionConfig;
	private normalizer: NormalizationStats | null = null;

	private constructor(config?: Partial<VolatilityPredictionConfig>) {
		this.cache = new RedisCache();

		// Default configuration
		const modelVersion = "v1.0.0";
		const modelPath = path.join(
			process.cwd(),
			"models",
			"volatility-prediction",
			modelVersion,
			"model.txt"
		);
		const normalizerPath = path.join(
			process.cwd(),
			"models",
			"volatility-prediction",
			modelVersion,
			"normalizer.json"
		);

		this.config = {
			modelPath,
			normalizerPath,
			cacheTTL: 300, // 5 minutes
			enableCaching: true,
			confidenceThresholdLow: 0.3,
			confidenceThresholdHigh: 0.9,
			...config,
		};

		console.log(`VolatilityPredictionService initialized with model ${modelVersion}`);
	}

	static getInstance(config?: Partial<VolatilityPredictionConfig>): VolatilityPredictionService {
		if (!VolatilityPredictionService.instance) {
			VolatilityPredictionService.instance = new VolatilityPredictionService(config);
		}
		return VolatilityPredictionService.instance;
	}

	/**
	 * Predict volatility for a symbol
	 * @param symbol Stock symbol (e.g., 'TSLA')
	 * @param features Optional pre-computed features
	 * @returns Prediction or null if confidence too low/high
	 */
	async predict(
		symbol: string,
		features?: VolatilityFeatures
	): Promise<VolatilityPrediction | null> {
		const startTime = Date.now();

		try {
			// Check cache first
			const cacheKey = this.getCacheKey(symbol);
			if (this.config.enableCaching) {
				const cached = await this.cache.get(cacheKey);
				if (cached) {
					console.log(`Volatility cache hit for ${symbol} (${Date.now() - startTime}ms)`);
					return JSON.parse(cached);
				}
			}

			// Load model if not already loaded
			if (!VolatilityPredictionService.modelInstance) {
				await this.loadModel();
			}

			// Extract features if not provided
			if (!features) {
				// TODO: Implement feature extraction
				// For now, throw error - features must be provided
				throw new Error("Feature extraction not yet implemented - features must be provided");
			}

			// Validate and assess feature completeness
			const { validatedFeatures, completeness } = this.validateFeatures(features, symbol);

			// Convert features to array for Python model
			const featureArray = this.featuresToArray(validatedFeatures);

			// Make prediction via Python subprocess
			const predictionResponse = await this.predictWithModel(featureArray);

			// Extract prediction value
			const { prediction: predictedVolatility, confidence } = predictionResponse;

			// Assess confidence level based on feature completeness
			const confidenceLevel = this.assessConfidenceLevel(completeness);

			// Filter predictions with very low or very high confidence (uncertain)
			if (confidence < this.config.confidenceThresholdLow || confidence > this.config.confidenceThresholdHigh) {
				console.log(
					`Uncertain volatility prediction for ${symbol}: ${(confidence * 100).toFixed(1)}% (skipping)`
				);
				return null;
			}

			// Categorize risk
			const riskCategory = this.categorizeRisk(predictedVolatility);

			// Generate reasoning
			const reasoning = this.generateReasoning(validatedFeatures, predictedVolatility, riskCategory);

			// Build prediction result
			const result: VolatilityPrediction = {
				symbol,
				predicted_volatility: Math.round(predictedVolatility * 100) / 100, // Round to 2 decimals
				confidence_level: confidenceLevel,
				risk_category: riskCategory,
				prediction_horizon_days: 21,
				timestamp: new Date(),
				feature_completeness: completeness,
				reasoning,
			};

			// Cache the result
			if (this.config.enableCaching) {
				await this.cache.set(cacheKey, JSON.stringify(result), this.config.cacheTTL);
			}

			const latencyMs = Date.now() - startTime;
			console.log(
				`Volatility prediction completed for ${symbol}: ${predictedVolatility.toFixed(2)}% (${latencyMs}ms)`
			);

			return result;
		} catch (error) {
			console.error(`Failed to predict volatility for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Batch prediction for multiple symbols
	 */
	async batchPredict(
		symbols: string[],
		featuresMap?: Map<string, VolatilityFeatures>
	): Promise<VolatilityPrediction[]> {
		const predictions = await Promise.all(
			symbols.map(symbol => {
				const features = featuresMap?.get(symbol);
				return this.predict(symbol, features);
			})
		);

		return predictions.filter((p): p is VolatilityPrediction => p !== null);
	}

	/**
	 * Load the LightGBM model and normalizer
	 */
	private async loadModel(): Promise<void> {
		try {
			console.log(`Loading Volatility Prediction model from ${this.config.modelPath}`);

			// Verify model file exists
			if (!fs.existsSync(this.config.modelPath)) {
				throw new Error(`Model file not found: ${this.config.modelPath}`);
			}

			// Verify normalizer exists
			if (!fs.existsSync(this.config.normalizerPath)) {
				throw new Error(`Normalizer file not found: ${this.config.normalizerPath}`);
			}

			// Load normalizer
			this.normalizer = JSON.parse(fs.readFileSync(this.config.normalizerPath, "utf-8"));

			// Mark as loaded (actual loading happens in Python subprocess)
			VolatilityPredictionService.modelInstance = { loaded: true };

			console.log(
				`✅ Volatility Prediction model v${VolatilityPredictionService.modelVersion} loaded successfully`
			);
		} catch (error) {
			console.error("Failed to load Volatility Prediction model:", error);
			throw error;
		}
	}

	/**
	 * Validate features and fill missing values
	 */
	private validateFeatures(
		features: VolatilityFeatures,
		symbol: string
	): { validatedFeatures: VolatilityFeatures; completeness: number } {
		if (!this.normalizer) {
			throw new Error("Normalizer not loaded");
		}

		const featureNames = this.normalizer.feature_names;
		let missingCount = 0;

		// Check each feature
		const validatedFeatures = { ...features };
		for (const name of featureNames) {
			const value = (validatedFeatures as any)[name];

			// Check if missing or NaN
			if (value === undefined || value === null || isNaN(value)) {
				missingCount++;
				// Use training mean as fallback
				(validatedFeatures as any)[name] = this.normalizer.mean[name] || 0;
			}
		}

		const completeness = 1 - missingCount / featureNames.length;

		if (completeness < 0.7) {
			console.warn(
				`Low feature completeness for ${symbol}: ${(completeness * 100).toFixed(1)}%`
			);
		}

		return { validatedFeatures, completeness };
	}

	/**
	 * Convert feature object to ordered array matching model training order
	 */
	private featuresToArray(features: VolatilityFeatures): number[] {
		// Order must match training data column order (28 features)
		return [
			// Volatility History (8)
			features.atr_14,
			features.atr_21,
			features.atr_50,
			features.realized_vol_7d,
			features.realized_vol_14d,
			features.realized_vol_21d,
			features.realized_vol_30d,
			features.parkinson_volatility,

			// Price Action (8)
			features.close_price,
			features.high_low_range,
			features.rsi_14,
			features.macd,
			features.macd_signal,
			features.bollinger_pct_b,
			features.adx,
			features.price_roc_21,

			// Volume (5)
			features.volume,
			features.volume_roc,
			features.volume_ma_ratio,
			features.vwap_deviation,
			features.dark_pool_volume,

			// Smart Money (4) - whale_activity_score not in training data
			features.insider_buy_sell_ratio,
			features.institutional_volume_ratio,
			features.volume_concentration,
			features.block_trade_ratio,

			// Macro (3)
			features.vix_level,
			features.sector_volatility,
			features.market_cap_log,
		];
	}

	/**
	 * Make prediction using Python subprocess
	 */
	private async predictWithModel(features: number[]): Promise<{ prediction: number; confidence: number }> {
		return new Promise((resolve, reject) => {
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
				console.log(`[VolatilityPrediction] Python process exited with code ${code}`);
				console.log(`[VolatilityPrediction] stdout: ${stdout.substring(0, 200)}`);
				console.log(`[VolatilityPrediction] stderr: ${stderr.substring(0, 200)}`);

				if (code !== 0) {
					reject(new Error(`Python process exited with code ${code}. stderr: ${stderr}`));
					return;
				}

				try {
					const result = JSON.parse(stdout);
					resolve(result);
				} catch (error) {
					reject(new Error(`Failed to parse Python output: ${stdout.substring(0, 200)}`));
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
	 * Categorize volatility into risk levels
	 */
	private categorizeRisk(volatility: number): RiskCategory {
		if (volatility < 20) return RiskCategory.LOW;
		if (volatility < 40) return RiskCategory.MODERATE;
		if (volatility < 70) return RiskCategory.HIGH;
		return RiskCategory.EXTREME;
	}

	/**
	 * Assess confidence level based on feature completeness
	 */
	private assessConfidenceLevel(completeness: number): ConfidenceLevel {
		if (completeness >= 0.95) return ConfidenceLevel.HIGH;
		if (completeness >= 0.85) return ConfidenceLevel.MEDIUM;
		return ConfidenceLevel.LOW;
	}

	/**
	 * Generate human-readable reasoning
	 */
	private generateReasoning(
		features: VolatilityFeatures,
		predictedVol: number,
		riskCategory: RiskCategory
	): string {
		const reasons: string[] = [];

		// Historical volatility signals
		const avgRealizedVol = (features.realized_vol_7d + features.realized_vol_14d + features.realized_vol_21d) / 3;
		if (avgRealizedVol > predictedVol * 1.2) {
			reasons.push("Recent volatility declining");
		} else if (avgRealizedVol < predictedVol * 0.8) {
			reasons.push("Recent volatility increasing");
		}

		// Price action signals
		if (features.rsi_14 > 70 || features.rsi_14 < 30) {
			reasons.push("Extreme RSI levels suggest potential reversal");
		}

		if (features.adx > 25) {
			reasons.push("Strong trend detected (high ADX)");
		}

		// Volume signals
		if (features.volume_roc > 50) {
			reasons.push("Volume surge detected");
		}

		// Macro context
		if (features.vix_level > 25) {
			reasons.push("Elevated market fear (VIX > 25)");
		}

		if (reasons.length === 0) {
			reasons.push(`Normal volatility environment for ${riskCategory} risk stocks`);
		}

		return `Predicted ${predictedVol.toFixed(1)}% volatility (${riskCategory} risk): ${reasons.join("; ")}`;
	}

	/**
	 * Generate cache key for a symbol
	 */
	private getCacheKey(symbol: string): string {
		return `volatility_prediction:${symbol}`;
	}

	/**
	 * Clear cache for a symbol (useful for testing)
	 */
	async clearCache(symbol?: string): Promise<void> {
		if (symbol) {
			await this.cache.delete(this.getCacheKey(symbol));
		} else {
			console.warn("Clearing all volatility predictions from cache");
			// Would need pattern-based deletion
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

			const modelLoaded = VolatilityPredictionService.modelInstance !== null;

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
