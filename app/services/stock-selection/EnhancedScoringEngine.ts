/**
 * Enhanced Scoring Engine - Phase 4.1 ML Enhancement
 *
 * Combines traditional VFR 5-factor scoring (85% weight) with ML predictions (15% weight)
 * to produce ML-enhanced composite scores while preserving existing VFR methodology.
 *
 * Architecture:
 * - VFR Score (85%): Existing 5-factor technical/fundamental/sentiment/momentum scoring
 * - ML Score (15%): ML prediction contribution with confidence weighting
 * - Final Score: Normalized 0-100 range with quality tracking
 *
 * Performance:
 * - <10ms scoring overhead per stock
 * - Graceful degradation to pure VFR on ML failure
 * - Confidence-weighted ML contribution (low confidence = lower weight)
 */

import { StockScore } from "../algorithms/types";
import { Logger } from "../error-handling/Logger";
import { ErrorHandler } from "../error-handling/ErrorHandler";
import { PredictionResult } from "../ml/prediction/RealTimePredictionEngine";

// ===== Configuration =====

export interface EnhancedScoringConfig {
	vfrWeight: number; // Default: 0.85 (85% VFR)
	mlWeight: number; // Default: 0.15 (15% ML)
	minConfidenceThreshold: number; // Default: 0.5 (50% minimum confidence)
	confidenceWeightingEnabled: boolean; // Default: true
	normalizeToHundred: boolean; // Default: true (0-100 scale)
}

export interface EnhancedScoreResult {
	symbol: string;
	baseScore: number; // Original VFR score (0-1 scale)
	mlScore: number; // ML contribution score (0-1 scale)
	mlConfidence: number; // ML prediction confidence (0-1)
	finalScore: number; // Weighted composite score (0-1 or 0-100)
	enhancement: number; // ML enhancement value (can be positive or negative)
	weights: {
		vfr: number; // Actual VFR weight used
		ml: number; // Actual ML weight used (adjusted by confidence)
	};
	timestamp: number;
}

/**
 * EnhancedScoringEngine
 *
 * Combines VFR factor scores with ML predictions to produce enhanced composite scores.
 * Follows KISS principles with simple weighted averaging and confidence adjustments.
 */
export class EnhancedScoringEngine {
	private logger: Logger;
	private errorHandler: ErrorHandler;
	private config: EnhancedScoringConfig;

	constructor(config?: Partial<EnhancedScoringConfig>) {
		this.logger = Logger.getInstance("EnhancedScoringEngine");
		this.errorHandler = ErrorHandler.getInstance();
		this.config = {
			vfrWeight: config?.vfrWeight ?? 0.85,
			mlWeight: config?.mlWeight ?? 0.15,
			minConfidenceThreshold: config?.minConfidenceThreshold ?? 0.5,
			confidenceWeightingEnabled: config?.confidenceWeightingEnabled ?? true,
			normalizeToHundred: config?.normalizeToHundred ?? true,
		};

		// Validate weights sum to 1.0
		const totalWeight = this.config.vfrWeight + this.config.mlWeight;
		if (Math.abs(totalWeight - 1.0) > 0.001) {
			this.logger.warn(
				`Scoring weights do not sum to 1.0: VFR=${this.config.vfrWeight}, ML=${this.config.mlWeight}`
			);
		}
	}

	/**
	 * Calculate enhanced score combining VFR and ML predictions
	 *
	 * @param vfrScore - Original VFR StockScore from FactorLibrary
	 * @param mlPrediction - ML prediction from RealTimePredictionEngine
	 * @returns EnhancedScoreResult with weighted composite score
	 */
	public calculateEnhancedScore(
		vfrScore: StockScore,
		mlPrediction?: PredictionResult
	): EnhancedScoreResult {
		const startTime = Date.now();

		try {
			// Extract base VFR score (0-1 range)
			const baseScore = vfrScore.overallScore;

			// Calculate ML contribution
			const { mlScore, mlConfidence, adjustedMLWeight } = this.calculateMLContribution(
				mlPrediction
			);

			// Calculate actual weights (adjusted by confidence if enabled)
			const actualVFRWeight = this.config.vfrWeight + (this.config.mlWeight - adjustedMLWeight);
			const actualMLWeight = adjustedMLWeight;

			// Weighted composite score
			const compositeScore = baseScore * actualVFRWeight + mlScore * actualMLWeight;

			// Normalize to 0-100 if configured
			const finalScore = this.config.normalizeToHundred
				? compositeScore * 100
				: compositeScore;

			// Calculate enhancement (how much ML changed the score)
			const enhancement = mlScore * actualMLWeight;

			const result: EnhancedScoreResult = {
				symbol: vfrScore.symbol,
				baseScore,
				mlScore,
				mlConfidence,
				finalScore,
				enhancement,
				weights: {
					vfr: actualVFRWeight,
					ml: actualMLWeight,
				},
				timestamp: Date.now(),
			};

			const latency = Date.now() - startTime;
			if (latency > 10) {
				this.logger.warn(
					`Enhanced scoring for ${vfrScore.symbol} took ${latency}ms (target: <10ms)`
				);
			}

			return result;
		} catch (error) {
			this.logger.error(
				`Enhanced scoring failed for ${vfrScore.symbol}: ${error instanceof Error ? error.message : "Unknown error"}`
			);
			// Fallback: return pure VFR score
			return this.createFallbackScore(vfrScore);
		}
	}

	/**
	 * Calculate ML contribution with confidence weighting
	 */
	private calculateMLContribution(mlPrediction?: PredictionResult): {
		mlScore: number;
		mlConfidence: number;
		adjustedMLWeight: number;
	} {
		// No ML prediction available - use neutral score
		if (!mlPrediction) {
			return {
				mlScore: 0.5, // Neutral ML score
				mlConfidence: 0.0,
				adjustedMLWeight: 0.0, // No ML weight
			};
		}

		const { prediction, confidence, direction } = mlPrediction;

		// Check minimum confidence threshold
		if (confidence < this.config.minConfidenceThreshold) {
			this.logger.debug(
				`ML confidence ${confidence} below threshold ${this.config.minConfidenceThreshold}, using reduced weight`
			);
		}

		// Convert ML prediction (-1 to +1 scale) to score (0-1 scale)
		// Prediction is expected return, normalize to 0-1 range
		// Positive prediction -> higher score, negative -> lower score
		let mlScore = 0.5; // Neutral baseline

		if (direction === "UP") {
			// Bullish prediction - boost score
			// Scale prediction (0 to +inf) to score contribution (0.5 to 1.0)
			mlScore = 0.5 + Math.min(Math.abs(prediction) * 0.5, 0.5);
		} else if (direction === "DOWN") {
			// Bearish prediction - reduce score
			// Scale prediction (-inf to 0) to score contribution (0.0 to 0.5)
			mlScore = 0.5 - Math.min(Math.abs(prediction) * 0.5, 0.5);
		} else {
			// NEUTRAL - keep neutral score
			mlScore = 0.5;
		}

		// Apply confidence weighting to ML weight if enabled
		let adjustedMLWeight = this.config.mlWeight;
		if (this.config.confidenceWeightingEnabled) {
			// Scale ML weight by confidence
			// High confidence (0.9) -> full ML weight (0.15)
			// Low confidence (0.5) -> reduced ML weight (0.075)
			adjustedMLWeight = this.config.mlWeight * confidence;
		}

		return {
			mlScore,
			mlConfidence: confidence,
			adjustedMLWeight,
		};
	}

	/**
	 * Create fallback score when ML enhancement fails
	 */
	private createFallbackScore(vfrScore: StockScore): EnhancedScoreResult {
		const baseScore = vfrScore.overallScore;
		const finalScore = this.config.normalizeToHundred ? baseScore * 100 : baseScore;

		return {
			symbol: vfrScore.symbol,
			baseScore,
			mlScore: 0.5, // Neutral
			mlConfidence: 0.0,
			finalScore,
			enhancement: 0.0,
			weights: {
				vfr: 1.0, // Pure VFR
				ml: 0.0,
			},
			timestamp: Date.now(),
		};
	}

	/**
	 * Batch enhance multiple scores
	 */
	public calculateBatchEnhancedScores(
		vfrScores: StockScore[],
		mlPredictions: Map<string, PredictionResult>
	): EnhancedScoreResult[] {
		return vfrScores.map(vfrScore => {
			const mlPrediction = mlPredictions.get(vfrScore.symbol);
			return this.calculateEnhancedScore(vfrScore, mlPrediction);
		});
	}

	/**
	 * Get current configuration
	 */
	public getConfig(): EnhancedScoringConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	public updateConfig(updates: Partial<EnhancedScoringConfig>): void {
		this.config = {
			...this.config,
			...updates,
		};

		// Re-validate weights
		const totalWeight = this.config.vfrWeight + this.config.mlWeight;
		if (Math.abs(totalWeight - 1.0) > 0.001) {
			this.logger.warn(
				`Updated weights do not sum to 1.0: VFR=${this.config.vfrWeight}, ML=${this.config.mlWeight}`
			);
		}
	}
}
