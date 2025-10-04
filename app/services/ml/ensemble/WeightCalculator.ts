/**
 * Dynamic Weight Calculator for VFR ML Ensemble System
 *
 * Calculates optimal model weights based on recent performance metrics
 * for ensemble predictions. Supports multiple weighting strategies.
 *
 * Features:
 * - Performance-based weighting (accuracy, Sharpe ratio, reliability)
 * - Recency-weighted (exponential decay for older predictions)
 * - Confidence-weighted (trust high-confidence predictions more)
 * - Equal weights (baseline strategy)
 * - Weight normalization (ensures weights sum to 1.0)
 * - Weight bounds (min/max constraints per model)
 *
 * Performance Target: <5ms for weight calculation
 * Philosophy: KISS - simple, fast, effective
 */

import { Logger } from "../../error-handling/Logger";
import { ErrorHandler } from "../../error-handling/ErrorHandler";
import { ModelPerformanceTracker, ModelPerformanceMetrics } from "./ModelPerformanceTracker";
import { MLServiceResponse } from "../types/MLTypes";

// ===== Weight Calculation Types =====

export enum WeightingStrategy {
	EQUAL = "EQUAL", // Equal weights for all models
	PERFORMANCE = "PERFORMANCE", // Based on accuracy/reliability
	RECENCY = "RECENCY", // Exponential decay based on time
	CONFIDENCE = "CONFIDENCE", // Based on prediction confidence
	SHARPE = "SHARPE", // Based on Sharpe ratio (risk-adjusted)
	HYBRID = "HYBRID", // Combination of performance + recency + confidence
}

export interface ModelWeight {
	modelId: string;
	weight: number; // 0-1, normalized
	rawScore: number; // Pre-normalization score
	strategy: WeightingStrategy;
	confidence: number; // Confidence in this weight assignment
	metadata: {
		accuracy?: number;
		reliabilityScore?: number;
		sharpeRatio?: number;
		recencyFactor?: number;
		avgConfidence?: number;
	};
}

export interface WeightCalculationRequest {
	modelIds: string[];
	strategy: WeightingStrategy;
	confidenceScores?: Map<string, number>; // Optional confidence per model
	minWeight?: number; // Minimum weight per model (default: 0.05)
	maxWeight?: number; // Maximum weight per model (default: 0.6)
}

export interface WeightCalculationResult {
	weights: Map<string, ModelWeight>;
	strategy: WeightingStrategy;
	timestamp: number;
	totalWeight: number; // Should always be 1.0 after normalization
	diversityScore: number; // Measure of weight distribution (0-1)
}

// ===== Configuration =====

export interface WeightCalculatorConfig {
	defaultStrategy: WeightingStrategy;
	minWeight: number; // Minimum weight per model (default: 0.05)
	maxWeight: number; // Maximum weight per model (default: 0.6)
	recencyDecayFactor: number; // Exponential decay rate (default: 0.95)
	hybridWeights: {
		performance: number; // Default: 0.5
		recency: number; // Default: 0.3
		confidence: number; // Default: 0.2
	};
	minMetricsForWeighting: number; // Minimum predictions needed (default: 30)
}

/**
 * WeightCalculator
 * Calculates dynamic model weights for ensemble predictions
 */
export class WeightCalculator {
	private static instance: WeightCalculator;
	private logger: Logger;
	private errorHandler: ErrorHandler;
	private config: WeightCalculatorConfig;
	private performanceTracker: ModelPerformanceTracker;
	private initialized = false;

	private constructor(config?: Partial<WeightCalculatorConfig>) {
		this.logger = Logger.getInstance("WeightCalculator");
		this.errorHandler = ErrorHandler.getInstance();

		this.config = {
			defaultStrategy: config?.defaultStrategy ?? WeightingStrategy.HYBRID,
			minWeight: config?.minWeight ?? 0.05,
			maxWeight: config?.maxWeight ?? 0.6,
			recencyDecayFactor: config?.recencyDecayFactor ?? 0.95,
			hybridWeights: {
				performance: config?.hybridWeights?.performance ?? 0.5,
				recency: config?.hybridWeights?.recency ?? 0.3,
				confidence: config?.hybridWeights?.confidence ?? 0.2,
			},
			minMetricsForWeighting: config?.minMetricsForWeighting ?? 30,
		};

		this.performanceTracker = ModelPerformanceTracker.getInstance();
	}

	/**
	 * Get singleton instance
	 */
	public static getInstance(config?: Partial<WeightCalculatorConfig>): WeightCalculator {
		if (!WeightCalculator.instance) {
			WeightCalculator.instance = new WeightCalculator(config);
		}
		return WeightCalculator.instance;
	}

	/**
	 * Reset singleton (for testing)
	 */
	public static resetInstance(): void {
		if (WeightCalculator.instance) {
			WeightCalculator.instance = null as any;
		}
	}

	/**
	 * Initialize the weight calculator
	 */
	public async initialize(): Promise<MLServiceResponse<void>> {
		try {
			this.logger.info("Initializing WeightCalculator");

			// Ensure performance tracker is initialized
			await this.performanceTracker.initialize();

			this.initialized = true;
			this.logger.info("WeightCalculator initialized successfully");

			return {
				success: true,
				data: undefined,
				metadata: {
					latency: 0,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Failed to initialize WeightCalculator", { error });
			return this.errorHandler.createErrorResponse(
				error,
				"WeightCalculator.initialize"
			) as MLServiceResponse<void>;
		}
	}

	/**
	 * Calculate model weights based on requested strategy
	 */
	public async calculateWeights(
		request: WeightCalculationRequest
	): Promise<MLServiceResponse<WeightCalculationResult>> {
		const startTime = Date.now();

		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const {
				modelIds,
				strategy,
				confidenceScores,
				minWeight = this.config.minWeight,
				maxWeight = this.config.maxWeight,
			} = request;

			if (modelIds.length === 0) {
				return {
					success: false,
					error: {
						type: this.errorHandler.createErrorResponse(
							new Error("No models provided"),
							"WeightCalculator.calculateWeights"
						).error.type,
						code: this.errorHandler.createErrorResponse(
							new Error("No models provided"),
							"WeightCalculator.calculateWeights"
						).error.code,
						message: "No models provided for weight calculation",
						severity: this.errorHandler.createErrorResponse(
							new Error("No models provided"),
							"WeightCalculator.calculateWeights"
						).error.severity,
						timestamp: Date.now(),
						source: "WeightCalculator.calculateWeights",
						retryable: false,
					},
				};
			}

			// Get performance metrics for all models
			const metricsResult = await this.performanceTracker.getAllPerformanceMetrics();
			const allMetrics = metricsResult.success ? metricsResult.data! : new Map();

			// Calculate weights based on strategy
			let weights: Map<string, ModelWeight>;

			switch (strategy) {
				case WeightingStrategy.EQUAL:
					weights = this.calculateEqualWeights(modelIds);
					break;

				case WeightingStrategy.PERFORMANCE:
					weights = this.calculatePerformanceWeights(modelIds, allMetrics);
					break;

				case WeightingStrategy.RECENCY:
					weights = this.calculateRecencyWeights(modelIds, allMetrics);
					break;

				case WeightingStrategy.CONFIDENCE:
					weights = this.calculateConfidenceWeights(modelIds, confidenceScores);
					break;

				case WeightingStrategy.SHARPE:
					weights = this.calculateSharpeWeights(modelIds, allMetrics);
					break;

				case WeightingStrategy.HYBRID:
					weights = this.calculateHybridWeights(modelIds, allMetrics, confidenceScores);
					break;

				default:
					weights = this.calculateEqualWeights(modelIds);
			}

			// Apply weight bounds
			weights = this.applyWeightBounds(weights, minWeight, maxWeight);

			// Normalize weights to sum to 1.0
			weights = this.normalizeWeights(weights);

			// Calculate diversity score
			const diversityScore = this.calculateDiversityScore(weights);

			// Verify total weight
			const totalWeight = Array.from(weights.values()).reduce((sum, w) => sum + w.weight, 0);

			const result: WeightCalculationResult = {
				weights,
				strategy,
				timestamp: Date.now(),
				totalWeight,
				diversityScore,
			};

			const latency = Date.now() - startTime;
			this.logger.debug("Calculated weights", {
				strategy,
				modelCount: modelIds.length,
				diversityScore,
				latency,
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
			this.logger.error("Failed to calculate weights", { error, request });
			return this.errorHandler.createErrorResponse(
				error,
				"WeightCalculator.calculateWeights"
			) as MLServiceResponse<WeightCalculationResult>;
		}
	}

	/**
	 * Calculate equal weights (baseline strategy)
	 */
	private calculateEqualWeights(modelIds: string[]): Map<string, ModelWeight> {
		const weights = new Map<string, ModelWeight>();
		const equalWeight = 1.0 / modelIds.length;

		for (const modelId of modelIds) {
			weights.set(modelId, {
				modelId,
				weight: equalWeight,
				rawScore: 1.0,
				strategy: WeightingStrategy.EQUAL,
				confidence: 1.0,
				metadata: {},
			});
		}

		return weights;
	}

	/**
	 * Calculate performance-based weights (accuracy + reliability)
	 */
	private calculatePerformanceWeights(
		modelIds: string[],
		allMetrics: Map<string, ModelPerformanceMetrics>
	): Map<string, ModelWeight> {
		const weights = new Map<string, ModelWeight>();

		for (const modelId of modelIds) {
			const metrics = allMetrics.get(modelId);

			if (!metrics || metrics.windowSize < this.config.minMetricsForWeighting) {
				// Insufficient data - use low weight
				weights.set(modelId, {
					modelId,
					weight: 0.1,
					rawScore: 0.1,
					strategy: WeightingStrategy.PERFORMANCE,
					confidence: 0.3,
					metadata: {},
				});
				continue;
			}

			// Performance score = weighted combination of accuracy and reliability
			const performanceScore = metrics.accuracy * 0.5 + metrics.reliabilityScore * 0.5;

			weights.set(modelId, {
				modelId,
				weight: performanceScore, // Will be normalized later
				rawScore: performanceScore,
				strategy: WeightingStrategy.PERFORMANCE,
				confidence: Math.min(1.0, metrics.windowSize / 200), // More data = more confidence
				metadata: {
					accuracy: metrics.accuracy,
					reliabilityScore: metrics.reliabilityScore,
				},
			});
		}

		return weights;
	}

	/**
	 * Calculate recency-weighted weights (exponential decay)
	 */
	private calculateRecencyWeights(
		modelIds: string[],
		allMetrics: Map<string, ModelPerformanceMetrics>
	): Map<string, ModelWeight> {
		const weights = new Map<string, ModelWeight>();
		const now = Date.now();
		const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

		for (const modelId of modelIds) {
			const metrics = allMetrics.get(modelId);

			if (!metrics) {
				weights.set(modelId, {
					modelId,
					weight: 0.1,
					rawScore: 0.1,
					strategy: WeightingStrategy.RECENCY,
					confidence: 0.3,
					metadata: {},
				});
				continue;
			}

			// Calculate recency factor using exponential decay
			const age = now - metrics.lastUpdated;
			const normalizedAge = Math.min(1.0, age / maxAge);
			const recencyFactor = Math.pow(this.config.recencyDecayFactor, normalizedAge * 100);

			// Combine with performance
			const score = recencyFactor * metrics.reliabilityScore;

			weights.set(modelId, {
				modelId,
				weight: score,
				rawScore: score,
				strategy: WeightingStrategy.RECENCY,
				confidence: recencyFactor,
				metadata: {
					recencyFactor,
					reliabilityScore: metrics.reliabilityScore,
				},
			});
		}

		return weights;
	}

	/**
	 * Calculate confidence-based weights
	 */
	private calculateConfidenceWeights(
		modelIds: string[],
		confidenceScores?: Map<string, number>
	): Map<string, ModelWeight> {
		const weights = new Map<string, ModelWeight>();

		if (!confidenceScores || confidenceScores.size === 0) {
			// Fall back to equal weights if no confidence scores provided
			return this.calculateEqualWeights(modelIds);
		}

		for (const modelId of modelIds) {
			const confidence = confidenceScores.get(modelId) || 0.5;

			weights.set(modelId, {
				modelId,
				weight: confidence,
				rawScore: confidence,
				strategy: WeightingStrategy.CONFIDENCE,
				confidence,
				metadata: {
					avgConfidence: confidence,
				},
			});
		}

		return weights;
	}

	/**
	 * Calculate Sharpe ratio-based weights (risk-adjusted performance)
	 */
	private calculateSharpeWeights(
		modelIds: string[],
		allMetrics: Map<string, ModelPerformanceMetrics>
	): Map<string, ModelWeight> {
		const weights = new Map<string, ModelWeight>();

		for (const modelId of modelIds) {
			const metrics = allMetrics.get(modelId);

			if (!metrics || metrics.windowSize < this.config.minMetricsForWeighting) {
				weights.set(modelId, {
					modelId,
					weight: 0.1,
					rawScore: 0.1,
					strategy: WeightingStrategy.SHARPE,
					confidence: 0.3,
					metadata: {},
				});
				continue;
			}

			// Normalize Sharpe ratio to 0-1 range (assuming -1 to 2 typical range)
			const normalizedSharpe = Math.max(0, Math.min(1, (metrics.sharpeRatio + 1) / 3));

			weights.set(modelId, {
				modelId,
				weight: normalizedSharpe,
				rawScore: normalizedSharpe,
				strategy: WeightingStrategy.SHARPE,
				confidence: Math.min(1.0, metrics.windowSize / 200),
				metadata: {
					sharpeRatio: metrics.sharpeRatio,
				},
			});
		}

		return weights;
	}

	/**
	 * Calculate hybrid weights (combination of strategies)
	 */
	private calculateHybridWeights(
		modelIds: string[],
		allMetrics: Map<string, ModelPerformanceMetrics>,
		confidenceScores?: Map<string, number>
	): Map<string, ModelWeight> {
		const weights = new Map<string, ModelWeight>();

		// Get component weights
		const performanceWeights = this.calculatePerformanceWeights(modelIds, allMetrics);
		const recencyWeights = this.calculateRecencyWeights(modelIds, allMetrics);
		const confidenceWeights = this.calculateConfidenceWeights(modelIds, confidenceScores);

		// Combine using configured hybrid weights
		for (const modelId of modelIds) {
			const perfWeight = performanceWeights.get(modelId)!;
			const recWeight = recencyWeights.get(modelId)!;
			const confWeight = confidenceWeights.get(modelId)!;

			const hybridScore =
				perfWeight.weight * this.config.hybridWeights.performance +
				recWeight.weight * this.config.hybridWeights.recency +
				confWeight.weight * this.config.hybridWeights.confidence;

			const metrics = allMetrics.get(modelId);

			weights.set(modelId, {
				modelId,
				weight: hybridScore,
				rawScore: hybridScore,
				strategy: WeightingStrategy.HYBRID,
				confidence: (perfWeight.confidence + recWeight.confidence + confWeight.confidence) / 3,
				metadata: {
					accuracy: metrics?.accuracy,
					reliabilityScore: metrics?.reliabilityScore,
					recencyFactor: recWeight.metadata.recencyFactor,
					avgConfidence: confWeight.metadata.avgConfidence,
				},
			});
		}

		return weights;
	}

	/**
	 * Apply minimum and maximum weight bounds
	 */
	private applyWeightBounds(
		weights: Map<string, ModelWeight>,
		minWeight: number,
		maxWeight: number
	): Map<string, ModelWeight> {
		const boundedWeights = new Map<string, ModelWeight>();

		for (const [modelId, weight] of weights.entries()) {
			const boundedWeight = Math.max(minWeight, Math.min(maxWeight, weight.weight));

			boundedWeights.set(modelId, {
				...weight,
				weight: boundedWeight,
			});
		}

		return boundedWeights;
	}

	/**
	 * Normalize weights to sum to 1.0
	 */
	private normalizeWeights(weights: Map<string, ModelWeight>): Map<string, ModelWeight> {
		const totalWeight = Array.from(weights.values()).reduce((sum, w) => sum + w.weight, 0);

		if (totalWeight === 0) {
			// All weights are zero - fall back to equal weights
			const equalWeight = 1.0 / weights.size;
			const normalizedWeights = new Map<string, ModelWeight>();

			for (const [modelId, weight] of weights.entries()) {
				normalizedWeights.set(modelId, {
					...weight,
					weight: equalWeight,
				});
			}

			return normalizedWeights;
		}

		// Normalize to sum to 1.0
		const normalizedWeights = new Map<string, ModelWeight>();

		for (const [modelId, weight] of weights.entries()) {
			normalizedWeights.set(modelId, {
				...weight,
				weight: weight.weight / totalWeight,
			});
		}

		return normalizedWeights;
	}

	/**
	 * Calculate diversity score (how evenly distributed are the weights)
	 * Returns 0-1 where 1 is perfectly equal distribution
	 */
	private calculateDiversityScore(weights: Map<string, ModelWeight>): number {
		const n = weights.size;
		if (n <= 1) return 1.0;

		// Calculate entropy-based diversity
		const weightValues = Array.from(weights.values()).map(w => w.weight);
		const entropy = weightValues.reduce((sum, w) => {
			if (w > 0) {
				return sum - w * Math.log2(w);
			}
			return sum;
		}, 0);

		// Normalize by max entropy (log2(n))
		const maxEntropy = Math.log2(n);
		return maxEntropy > 0 ? entropy / maxEntropy : 0;
	}

	/**
	 * Health check
	 */
	public async healthCheck(): Promise<boolean> {
		return this.initialized && (await this.performanceTracker.healthCheck());
	}
}

// Export singleton instance
export default WeightCalculator.getInstance();
