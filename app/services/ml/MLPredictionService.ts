/**
 * ML Prediction Service - Simple Orchestration Layer
 * Coordinates FeatureEngineeringService and MLEnhancementStore for VFR score enhancement
 * Follows KISS principle with graceful fallback to pure VFR scoring
 */

import { FeatureEngineeringService, FeatureVector } from "./features/FeatureEngineeringService";
import ErrorHandler from "../error-handling/ErrorHandler";
import { RedisCache } from "../cache/RedisCache";

export interface MLEnhancementResult {
	enhancedScore: number;
	vfrWeight: number;
	mlWeight: number;
	mlContribution: number;
	confidence: number;
	fallbackUsed: boolean;
	processingTimeMs: number;
}

export interface MLFactors {
	technical?: Record<string, number>;
	fundamental?: Record<string, number>;
	sentiment?: Record<string, number>;
	macro?: Record<string, number>;
	options?: Record<string, number>;
}

/**
 * Simple orchestration service for ML-enhanced scoring
 * Main responsibility: Coordinate feature generation and ML enhancement
 */
export class MLPredictionService {
	private featureService: FeatureEngineeringService;
	private cache: RedisCache;
	private errorHandler: ErrorHandler;
	private mlEnhancementStore: any; // Will be injected when MLEnhancementStore is ready

	// Configuration constants
	private static readonly VFR_WEIGHT = 0.9; // 90% VFR
	private static readonly ML_WEIGHT = 0.1; // 10% ML
	private static readonly CACHE_TTL = 300; // 5 minutes
	private static readonly ML_TIMEOUT = 1000; // 1 second max for ML processing

	constructor(
		featureService?: FeatureEngineeringService,
		cache?: RedisCache,
		mlEnhancementStore?: any
	) {
		this.featureService = featureService || new FeatureEngineeringService();
		this.cache = cache || RedisCache.getInstance();
		this.errorHandler = ErrorHandler.getInstance();
		this.mlEnhancementStore = mlEnhancementStore;
	}

	/**
	 * Main orchestration method: Enhance VFR score with ML prediction
	 * Returns 90% VFR + 10% ML enhanced score with graceful fallback
	 */
	async enhanceVFRScore(
		ticker: string,
		baseScore: number,
		factors: MLFactors
	): Promise<MLEnhancementResult> {
		const startTime = performance.now();

		try {
			// Input validation
			if (!ticker || baseScore < 0 || baseScore > 100) {
				throw new Error("Invalid input parameters for ML enhancement");
			}

			// Check cache first
			const cachedResult = await this.getCachedEnhancement(ticker, baseScore);
			if (cachedResult) {
				return {
					...cachedResult,
					processingTimeMs: performance.now() - startTime,
				};
			}

			// Generate ML enhancement (with timeout protection)
			const mlContribution = await this.generateMLContribution(ticker, factors);

			// Calculate enhanced score (90% VFR + 10% ML)
			const enhancedScore = this.calculateEnhancedScore(baseScore, mlContribution);

			const result: MLEnhancementResult = {
				enhancedScore,
				vfrWeight: MLPredictionService.VFR_WEIGHT,
				mlWeight: MLPredictionService.ML_WEIGHT,
				mlContribution,
				confidence: this.calculateConfidence(mlContribution),
				fallbackUsed: false,
				processingTimeMs: performance.now() - startTime,
			};

			// Cache the result
			await this.cacheEnhancement(ticker, baseScore, result);

			return result;
		} catch (error) {
			// Graceful fallback to pure VFR score
			console.warn(`ML enhancement failed for ${ticker}, using VFR fallback:`, error);

			return this.createFallbackResult(baseScore, performance.now() - startTime);
		}
	}

	/**
	 * Generate ML contribution using feature engineering and ML store
	 * Returns a score contribution between -10 and +10 points
	 */
	private async generateMLContribution(ticker: string, factors: MLFactors): Promise<number> {
		try {
			// Generate features using existing VFR data sources
			const features = await this.generateFeatures(ticker);

			// If MLEnhancementStore is available, use it for prediction
			if (this.mlEnhancementStore) {
				return await this.getMLPrediction(features, factors);
			}

			// Fallback: Simple feature-based scoring
			return this.calculateSimpleMLScore(features, factors);
		} catch (error) {
			console.warn(`ML contribution generation failed for ${ticker}:`, error);
			return 0; // Neutral contribution on failure
		}
	}

	/**
	 * Generate features using FeatureEngineeringService
	 */
	private async generateFeatures(ticker: string): Promise<FeatureVector | null> {
		try {
			const features = await Promise.race([
				this.featureService.generateFeatures([ticker]),
				new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new Error("Feature generation timeout")),
						MLPredictionService.ML_TIMEOUT
					)
				),
			]);

			return features.get(ticker) || null;
		} catch (error) {
			console.warn(`Feature generation failed for ${ticker}:`, error);
			return null;
		}
	}

	/**
	 * Get ML prediction from MLEnhancementStore (when available)
	 */
	private async getMLPrediction(
		features: FeatureVector | null,
		factors: MLFactors
	): Promise<number> {
		if (!features || !this.mlEnhancementStore) {
			return 0;
		}

		try {
			// This will be implemented when MLEnhancementStore is ready
			// const prediction = await this.mlEnhancementStore.predict(features, factors)
			// return this.normalizeMLScore(prediction)

			// Placeholder: Return neutral score
			return 0;
		} catch (error) {
			console.warn("ML store prediction failed:", error);
			return 0;
		}
	}

	/**
	 * Simple feature-based ML scoring (fallback when ML store unavailable)
	 */
	private calculateSimpleMLScore(features: FeatureVector | null, factors: MLFactors): number {
		if (!features) return 0;

		try {
			let score = 0;
			let featureCount = 0;

			// Simple scoring based on feature patterns
			const featureData = features.features;

			// Technical momentum contribution
			if (featureData.momentum_5d !== undefined) {
				score += Math.max(-2, Math.min(2, featureData.momentum_5d * 20));
				featureCount++;
			}

			// Sentiment contribution
			if (featureData.combined_sentiment !== undefined) {
				score += (featureData.combined_sentiment - 0.5) * 4; // Scale to ±2
				featureCount++;
			}

			// VWAP signal contribution
			if (featureData.vwap_deviation !== undefined) {
				score += Math.max(-1, Math.min(1, featureData.vwap_deviation * 10));
				featureCount++;
			}

			// Return weighted average, capped at ±5 points
			const avgScore = featureCount > 0 ? score / featureCount : 0;
			return Math.max(-5, Math.min(5, avgScore));
		} catch (error) {
			console.warn("Simple ML scoring failed:", error);
			return 0;
		}
	}

	/**
	 * Calculate enhanced score: 90% VFR + 10% ML
	 */
	private calculateEnhancedScore(baseScore: number, mlContribution: number): number {
		const vfrComponent = baseScore * MLPredictionService.VFR_WEIGHT;
		const mlComponent = mlContribution * MLPredictionService.ML_WEIGHT;

		// Ensure result stays within bounds [0, 100]
		return Math.max(0, Math.min(100, vfrComponent + mlComponent));
	}

	/**
	 * Calculate confidence based on ML contribution magnitude
	 */
	private calculateConfidence(mlContribution: number): number {
		// Higher confidence for non-zero contributions
		const magnitude = Math.abs(mlContribution);
		return magnitude > 0 ? Math.min(0.8, 0.3 + magnitude / 10) : 0.1;
	}

	/**
	 * Create fallback result when ML enhancement fails
	 */
	private createFallbackResult(baseScore: number, processingTime: number): MLEnhancementResult {
		return {
			enhancedScore: baseScore, // Pure VFR score
			vfrWeight: 1.0, // 100% VFR when ML fails
			mlWeight: 0.0, // 0% ML
			mlContribution: 0,
			confidence: 0.1, // Low confidence for fallback
			fallbackUsed: true,
			processingTimeMs: processingTime,
		};
	}

	/**
	 * Cache enhancement result
	 */
	private async cacheEnhancement(
		ticker: string,
		baseScore: number,
		result: MLEnhancementResult
	): Promise<void> {
		try {
			const cacheKey = `ml:enhancement:${ticker}:${Math.floor(baseScore)}`;
			await this.cache.set(cacheKey, result, MLPredictionService.CACHE_TTL);
		} catch (error) {
			// Non-critical error - don't fail the request
			console.warn(`Failed to cache ML enhancement for ${ticker}:`, error);
		}
	}

	/**
	 * Get cached enhancement result
	 */
	private async getCachedEnhancement(
		ticker: string,
		baseScore: number
	): Promise<MLEnhancementResult | null> {
		try {
			const cacheKey = `ml:enhancement:${ticker}:${Math.floor(baseScore)}`;
			return await this.cache.get<MLEnhancementResult>(cacheKey);
		} catch (error) {
			console.warn(`Failed to get cached ML enhancement for ${ticker}:`, error);
			return null;
		}
	}

	/**
	 * Health check for ML prediction service
	 */
	async healthCheck(): Promise<{ status: string; components: Record<string, boolean> }> {
		const components = {
			featureService: true,
			cache: true,
			mlStore: !!this.mlEnhancementStore,
		};

		try {
			// Test feature service
			await this.featureService.generateFeatures(["AAPL"]);
		} catch (error) {
			components.featureService = false;
		}

		try {
			// Test cache
			await this.cache.get("health-check");
		} catch (error) {
			components.cache = false;
		}

		const allHealthy = Object.values(components).every(status => status);

		return {
			status: allHealthy ? "healthy" : "partial",
			components,
		};
	}

	/**
	 * Get service statistics
	 */
	getStats(): Record<string, any> {
		return {
			vfrWeight: MLPredictionService.VFR_WEIGHT,
			mlWeight: MLPredictionService.ML_WEIGHT,
			cacheTTL: MLPredictionService.CACHE_TTL,
			mlTimeout: MLPredictionService.ML_TIMEOUT,
			mlStoreAvailable: !!this.mlEnhancementStore,
		};
	}
}
