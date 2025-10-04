/**
 * Ensemble Service for VFR ML Enhancement Layer
 *
 * Orchestrates ensemble predictions using multiple models with dynamic weighting.
 * Integrates RealTimePredictionEngine for parallel model predictions.
 *
 * Features:
 * - Parallel model predictions (5 models in <200ms target)
 * - Three ensemble methods:
 *   1. Weighted ensemble (dynamic weights from WeightCalculator)
 *   2. Voting ensemble (majority vote for classification)
 *   3. Stacking ensemble (meta-learner placeholder for Phase 5)
 * - Confidence calculation across models
 * - Consensus strength metric
 * - Fallback to single best model on failure
 * - Redis caching (5-minute TTL via MLCacheService)
 * - Performance monitoring via ModelPerformanceTracker
 *
 * Performance Target: <200ms for 5-model ensemble
 * Philosophy: KISS - simple, reliable ensemble orchestration
 */

import { RealTimePredictionEngine, PredictionRequest, PredictionResult } from "../prediction/RealTimePredictionEngine";
import { ModelRegistry, ModelMetadata } from "../models/ModelRegistry";
import { ModelPerformanceTracker, ModelPredictionResult } from "./ModelPerformanceTracker";
import { WeightCalculator, WeightingStrategy, WeightCalculationRequest } from "./WeightCalculator";
import { MLCacheService } from "../cache/MLCacheService";
import { Logger } from "../../error-handling/Logger";
import { ErrorHandler, ErrorType, ErrorCode } from "../../error-handling/ErrorHandler";
import { MLServiceResponse, MLEnsemblePrediction, MLPredictionHorizon, MLModelType } from "../types/MLTypes";

// ===== Ensemble Types =====

export enum EnsembleMethod {
	WEIGHTED = "weighted", // Weighted average based on model performance
	VOTING = "voting", // Majority vote (classification)
	STACKING = "stacking", // Meta-learner (Phase 5)
}

export interface EnsemblePredictionRequest {
	symbol: string;
	modelIds?: string[]; // Optional: specific models to use
	horizon?: MLPredictionHorizon; // Default: ONE_WEEK
	method?: EnsembleMethod; // Default: WEIGHTED
	weightStrategy?: WeightingStrategy; // Default: HYBRID
	confidenceThreshold?: number; // Default: 0.5
	minModelsRequired?: number; // Default: 3 (minimum models for ensemble)
}

export interface EnsemblePredictionResult {
	ensemble: MLEnsemblePrediction;
	individualPredictions: PredictionResult[];
	consensusStrength: number; // 0-1, how much models agree
	diversityScore: number; // 0-1, weight distribution
	latencyMs: number;
	modelsUsed: number;
	modelsFailed: number;
	fromCache: boolean;
}

export interface ConsensusMetrics {
	consensusStrength: number; // Agreement between models
	predictionVariance: number; // Variance in predictions
	confidenceVariance: number; // Variance in confidence scores
	directionAgreement: number; // Percentage agreeing on direction
}

// ===== Configuration =====

export interface EnsembleServiceConfig {
	defaultMethod: EnsembleMethod;
	defaultWeightStrategy: WeightingStrategy;
	maxConcurrentPredictions: number; // Default: 10
	predictionTimeout: number; // Default: 150ms per model
	minModelsForEnsemble: number; // Default: 3
	cacheEnabled: boolean; // Default: true
	cacheTTL: number; // Default: 300 seconds (5 minutes)
	fallbackToSingleModel: boolean; // Default: true
}

/**
 * EnsembleService
 * Main orchestrator for ensemble ML predictions
 */
export class EnsembleService {
	private static instance: EnsembleService;
	private logger: Logger;
	private errorHandler: ErrorHandler;
	private config: EnsembleServiceConfig;
	private predictionEngine: RealTimePredictionEngine;
	private modelRegistry: ModelRegistry;
	private performanceTracker: ModelPerformanceTracker;
	private weightCalculator: WeightCalculator;
	private mlCache: MLCacheService;
	private initialized = false;

	private constructor(config?: Partial<EnsembleServiceConfig>) {
		this.logger = Logger.getInstance("EnsembleService");
		this.errorHandler = ErrorHandler.getInstance();

		this.config = {
			defaultMethod: config?.defaultMethod ?? EnsembleMethod.WEIGHTED,
			defaultWeightStrategy: config?.defaultWeightStrategy ?? WeightingStrategy.HYBRID,
			maxConcurrentPredictions: config?.maxConcurrentPredictions ?? 10,
			predictionTimeout: config?.predictionTimeout ?? 150,
			minModelsForEnsemble: config?.minModelsForEnsemble ?? 3,
			cacheEnabled: config?.cacheEnabled ?? true,
			cacheTTL: config?.cacheTTL ?? 300,
			fallbackToSingleModel: config?.fallbackToSingleModel ?? true,
		};

		this.predictionEngine = RealTimePredictionEngine.getInstance({
			predictionTimeoutMs: this.config.predictionTimeout,
		});
		this.modelRegistry = ModelRegistry.getInstance();
		this.performanceTracker = ModelPerformanceTracker.getInstance();
		this.weightCalculator = WeightCalculator.getInstance();
		this.mlCache = MLCacheService.getInstance();
	}

	/**
	 * Get singleton instance
	 */
	public static getInstance(config?: Partial<EnsembleServiceConfig>): EnsembleService {
		if (!EnsembleService.instance) {
			EnsembleService.instance = new EnsembleService(config);
		}
		return EnsembleService.instance;
	}

	/**
	 * Reset singleton (for testing)
	 */
	public static resetInstance(): void {
		if (EnsembleService.instance) {
			EnsembleService.instance = null as any;
		}
	}

	/**
	 * Initialize ensemble service
	 */
	public async initialize(): Promise<MLServiceResponse<void>> {
		try {
			this.logger.info("Initializing EnsembleService");

			// Initialize dependencies
			await this.predictionEngine.initialize();
			await this.modelRegistry.initialize();
			await this.performanceTracker.initialize();
			await this.weightCalculator.initialize();

			this.initialized = true;
			this.logger.info("EnsembleService initialized successfully");

			return {
				success: true,
				data: undefined,
				metadata: {
					latency: 0,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Failed to initialize EnsembleService", { error });
			return this.errorHandler.createErrorResponse(
				error,
				"EnsembleService.initialize"
			) as MLServiceResponse<void>;
		}
	}

	/**
	 * Generate ensemble prediction for a symbol
	 */
	public async predictEnsemble(
		request: EnsemblePredictionRequest
	): Promise<MLServiceResponse<EnsemblePredictionResult>> {
		const startTime = Date.now();

		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const {
				symbol,
				modelIds,
				horizon = MLPredictionHorizon.ONE_WEEK,
				method = this.config.defaultMethod,
				weightStrategy = this.config.defaultWeightStrategy,
				confidenceThreshold = 0.5,
				minModelsRequired = this.config.minModelsForEnsemble,
			} = request;

			// Check cache first
			if (this.config.cacheEnabled) {
				const cached = await this.getCachedEnsemble(symbol, horizon, method, weightStrategy);
				if (cached) {
					const latency = Date.now() - startTime;
					this.logger.debug("Ensemble prediction cache hit", {
						symbol,
						method,
						latency,
					});

					return {
						success: true,
						data: {
							...cached,
							latencyMs: latency,
							fromCache: true,
						},
						metadata: {
							latency,
							cacheHit: true,
						},
					};
				}
			}

			// Get models to use
			const modelsToUse = await this.selectModels(modelIds, horizon);
			if (modelsToUse.length < minModelsRequired) {
				// Fallback to single best model if enabled
				if (this.config.fallbackToSingleModel && modelsToUse.length > 0) {
					return await this.fallbackToSingleModel(symbol, modelsToUse[0], horizon, startTime);
				}

				return {
					success: false,
					error: {
						type: ErrorType.DATA_QUALITY_ERROR,
						code: ErrorCode.INCOMPLETE_DATA,
						message: `Insufficient models available. Need at least ${minModelsRequired}, found ${modelsToUse.length}`,
						severity: this.errorHandler.createErrorResponse(
							new Error("Insufficient models"),
							"EnsembleService.predictEnsemble"
						).error.severity,
						timestamp: Date.now(),
						source: "EnsembleService.predictEnsemble",
						retryable: true,
					},
				};
			}

			// Get parallel predictions from all models
			const predictionResults = await this.getPredictionsParallel(
				symbol,
				modelsToUse,
				horizon,
				confidenceThreshold
			);

			// Check if we have minimum required predictions
			const successfulPredictions = predictionResults.filter(r => r !== null) as PredictionResult[];
			if (successfulPredictions.length < minModelsRequired) {
				// Fallback to single best model if enabled
				if (this.config.fallbackToSingleModel && successfulPredictions.length > 0) {
					return await this.fallbackToSingleModel(
						symbol,
						successfulPredictions[0].modelId,
						horizon,
						startTime
					);
				}

				return {
					success: false,
					error: {
						type: ErrorType.INTERNAL_ERROR,
						code: ErrorCode.SERVICE_UNAVAILABLE,
						message: `Insufficient successful predictions. Got ${successfulPredictions.length}, need ${minModelsRequired}`,
						severity: this.errorHandler.createErrorResponse(
							new Error("Prediction failures"),
							"EnsembleService.predictEnsemble"
						).error.severity,
						timestamp: Date.now(),
						source: "EnsembleService.predictEnsemble",
						retryable: true,
					},
				};
			}

			// Generate ensemble prediction based on method
			const ensembleResult = await this.combinePredictions(
				symbol,
				successfulPredictions,
				method,
				weightStrategy,
				horizon
			);

			// Track performance for all models
			await this.trackModelPerformance(successfulPredictions);

			// Cache the result
			if (this.config.cacheEnabled) {
				await this.cacheEnsemble(symbol, horizon, method, weightStrategy, ensembleResult);
			}

			const latency = Date.now() - startTime;
			this.logger.info("Ensemble prediction completed", {
				symbol,
				method,
				modelsUsed: successfulPredictions.length,
				modelsFailed: modelsToUse.length - successfulPredictions.length,
				consensusStrength: ensembleResult.consensusStrength,
				latency,
			});

			return {
				success: true,
				data: {
					...ensembleResult,
					latencyMs: latency,
					fromCache: false,
				},
				metadata: {
					latency,
					cacheHit: false,
				},
			};
		} catch (error) {
			const latency = Date.now() - startTime;
			this.logger.error("Ensemble prediction failed", { error, request, latency });
			return this.errorHandler.createErrorResponse(
				error,
				"EnsembleService.predictEnsemble"
			) as MLServiceResponse<EnsemblePredictionResult>;
		}
	}

	/**
	 * Select models to use for ensemble
	 */
	private async selectModels(
		modelIds: string[] | undefined,
		horizon: MLPredictionHorizon
	): Promise<string[]> {
		if (modelIds && modelIds.length > 0) {
			return modelIds;
		}

		// Get all deployed models
		const deployedResult = await this.modelRegistry.getDeployedModels();
		if (!deployedResult.success || !deployedResult.data) {
			return [];
		}

		// Filter by horizon and return model IDs
		return deployedResult.data
			.filter(m => m.predictionHorizon === horizon)
			.map(m => m.modelId);
	}

	/**
	 * Get predictions from multiple models in parallel
	 */
	private async getPredictionsParallel(
		symbol: string,
		modelIds: string[],
		horizon: MLPredictionHorizon,
		confidenceThreshold: number
	): Promise<(PredictionResult | null)[]> {
		const predictionPromises = modelIds.map(async modelId => {
			try {
				const request: PredictionRequest = {
					symbol,
					modelId,
					horizon,
					confidenceThreshold,
				};

				const result = await this.predictionEngine.predict(request);

				if (result.success && result.data) {
					return result.data;
				}

				return null;
			} catch (error) {
				this.logger.warn("Model prediction failed", {
					error,
					modelId,
					symbol,
				});
				return null;
			}
		});

		// Wait for all predictions with timeout
		const results = await Promise.allSettled(predictionPromises);

		return results.map(result => {
			if (result.status === "fulfilled") {
				return result.value;
			}
			return null;
		});
	}

	/**
	 * Combine predictions using specified ensemble method
	 */
	private async combinePredictions(
		symbol: string,
		predictions: PredictionResult[],
		method: EnsembleMethod,
		weightStrategy: WeightingStrategy,
		horizon: MLPredictionHorizon
	): Promise<Omit<EnsemblePredictionResult, "latencyMs" | "fromCache">> {
		let ensemblePrediction: MLEnsemblePrediction;

		switch (method) {
			case EnsembleMethod.WEIGHTED:
				ensemblePrediction = await this.weightedEnsemble(
					symbol,
					predictions,
					weightStrategy,
					horizon
				);
				break;

			case EnsembleMethod.VOTING:
				ensemblePrediction = await this.votingEnsemble(symbol, predictions, horizon);
				break;

			case EnsembleMethod.STACKING:
				// Placeholder for Phase 5 - fall back to weighted for now
				this.logger.info("Stacking not yet implemented, falling back to weighted ensemble");
				ensemblePrediction = await this.weightedEnsemble(
					symbol,
					predictions,
					weightStrategy,
					horizon
				);
				break;

			default:
				ensemblePrediction = await this.weightedEnsemble(
					symbol,
					predictions,
					weightStrategy,
					horizon
				);
		}

		// Calculate consensus metrics
		const consensus = this.calculateConsensus(predictions);

		return {
			ensemble: ensemblePrediction,
			individualPredictions: predictions,
			consensusStrength: consensus.consensusStrength,
			diversityScore: consensus.directionAgreement,
			modelsUsed: predictions.length,
			modelsFailed: 0,
		};
	}

	/**
	 * Weighted ensemble prediction
	 */
	private async weightedEnsemble(
		symbol: string,
		predictions: PredictionResult[],
		weightStrategy: WeightingStrategy,
		horizon: MLPredictionHorizon
	): Promise<MLEnsemblePrediction> {
		// Calculate model weights
		const modelIds = predictions.map(p => p.modelId);
		const confidenceScores = new Map(predictions.map(p => [p.modelId, p.confidence]));

		const weightRequest: WeightCalculationRequest = {
			modelIds,
			strategy: weightStrategy,
			confidenceScores,
		};

		const weightResult = await this.weightCalculator.calculateWeights(weightRequest);
		if (!weightResult.success || !weightResult.data) {
			throw new Error("Failed to calculate model weights");
		}

		const weights = weightResult.data.weights;

		// Calculate weighted average prediction
		let weightedPrediction = 0;
		let weightedConfidence = 0;
		const modelPredictions: MLEnsemblePrediction["modelPredictions"] = [];

		for (const pred of predictions) {
			const weight = weights.get(pred.modelId);
			if (!weight) continue;

			weightedPrediction += pred.prediction * weight.weight;
			weightedConfidence += pred.confidence * weight.weight;

			modelPredictions.push({
				modelId: pred.modelId,
				modelType: pred.modelType,
				prediction: {
					direction: pred.direction === "UP" ? "BUY" : pred.direction === "DOWN" ? "SELL" : "HOLD",
					confidence: pred.confidence,
					expectedReturn: pred.prediction,
					probability: pred.confidence,
				},
				weight: weight.weight,
				confidence: pred.confidence,
			});
		}

		// Determine ensemble direction
		const direction = weightedPrediction > 0.1 ? "BUY" : weightedPrediction < -0.1 ? "SELL" : "HOLD";

		return {
			symbol,
			modelId: "ensemble_weighted",
			modelVersion: "1.0.0",
			horizon,
			prediction: {
				direction,
				confidence: weightedConfidence,
				expectedReturn: weightedPrediction,
				probability: weightedConfidence,
			},
			features: { symbol, features: {}, featureNames: [], timestamp: Date.now(), completeness: 1.0, qualityScore: 1.0 },
			timestamp: Date.now(),
			expiresAt: Date.now() + this.config.cacheTTL * 1000,
			modelPredictions,
			aggregationMethod: "weighted",
			consensusStrength: this.calculateConsensus(predictions).consensusStrength,
		};
	}

	/**
	 * Voting ensemble prediction (majority vote)
	 */
	private async votingEnsemble(
		symbol: string,
		predictions: PredictionResult[],
		horizon: MLPredictionHorizon
	): Promise<MLEnsemblePrediction> {
		// Count votes for each direction
		const votes = { UP: 0, DOWN: 0, NEUTRAL: 0 };
		const modelPredictions: MLEnsemblePrediction["modelPredictions"] = [];

		for (const pred of predictions) {
			votes[pred.direction]++;

			modelPredictions.push({
				modelId: pred.modelId,
				modelType: pred.modelType,
				prediction: {
					direction: pred.direction === "UP" ? "BUY" : pred.direction === "DOWN" ? "SELL" : "HOLD",
					confidence: pred.confidence,
					expectedReturn: pred.prediction,
					probability: pred.confidence,
				},
				weight: 1.0 / predictions.length, // Equal weight for voting
				confidence: pred.confidence,
			});
		}

		// Determine majority direction
		const maxVotes = Math.max(votes.UP, votes.DOWN, votes.NEUTRAL);
		let majorityDirection: "BUY" | "SELL" | "HOLD" = "HOLD";

		if (votes.UP === maxVotes) majorityDirection = "BUY";
		else if (votes.DOWN === maxVotes) majorityDirection = "SELL";
		else majorityDirection = "HOLD";

		// Calculate confidence based on vote strength
		const voteConfidence = maxVotes / predictions.length;

		// Average prediction value
		const avgPrediction =
			predictions.reduce((sum, p) => sum + p.prediction, 0) / predictions.length;

		return {
			symbol,
			modelId: "ensemble_voting",
			modelVersion: "1.0.0",
			horizon,
			prediction: {
				direction: majorityDirection,
				confidence: voteConfidence,
				expectedReturn: avgPrediction,
				probability: voteConfidence,
			},
			features: { symbol, features: {}, featureNames: [], timestamp: Date.now(), completeness: 1.0, qualityScore: 1.0 },
			timestamp: Date.now(),
			expiresAt: Date.now() + this.config.cacheTTL * 1000,
			modelPredictions,
			aggregationMethod: "voting",
			consensusStrength: voteConfidence,
		};
	}

	/**
	 * Calculate consensus metrics across predictions
	 */
	private calculateConsensus(predictions: PredictionResult[]): ConsensusMetrics {
		if (predictions.length === 0) {
			return {
				consensusStrength: 0,
				predictionVariance: 0,
				confidenceVariance: 0,
				directionAgreement: 0,
			};
		}

		// Calculate prediction variance
		const predValues = predictions.map(p => p.prediction);
		const predMean = predValues.reduce((a, b) => a + b, 0) / predValues.length;
		const predVariance =
			predValues.reduce((sum, val) => sum + Math.pow(val - predMean, 2), 0) / predValues.length;

		// Calculate confidence variance
		const confValues = predictions.map(p => p.confidence);
		const confMean = confValues.reduce((a, b) => a + b, 0) / confValues.length;
		const confVariance =
			confValues.reduce((sum, val) => sum + Math.pow(val - confMean, 2), 0) / confValues.length;

		// Calculate direction agreement
		const directions = predictions.map(p => p.direction);
		const directionCounts = { UP: 0, DOWN: 0, NEUTRAL: 0 };
		directions.forEach(dir => directionCounts[dir]++);
		const maxDirectionCount = Math.max(
			directionCounts.UP,
			directionCounts.DOWN,
			directionCounts.NEUTRAL
		);
		const directionAgreement = maxDirectionCount / predictions.length;

		// Consensus strength: inverse of variance + direction agreement
		const normalizedPredVar = Math.min(1, predVariance);
		const consensusStrength = (1 - normalizedPredVar) * 0.5 + directionAgreement * 0.5;

		return {
			consensusStrength,
			predictionVariance: predVariance,
			confidenceVariance: confVariance,
			directionAgreement,
		};
	}

	/**
	 * Track performance for all model predictions
	 */
	private async trackModelPerformance(predictions: PredictionResult[]): Promise<void> {
		for (const pred of predictions) {
			const perfResult: ModelPredictionResult = {
				modelId: pred.modelId,
				symbol: pred.symbol,
				prediction: pred.prediction,
				confidence: pred.confidence,
				latencyMs: pred.latencyMs,
				timestamp: pred.timestamp,
			};

			await this.performanceTracker.recordPrediction(perfResult);
		}
	}

	/**
	 * Fallback to single best model
	 */
	private async fallbackToSingleModel(
		symbol: string,
		modelId: string,
		horizon: MLPredictionHorizon,
		startTime: number
	): Promise<MLServiceResponse<EnsemblePredictionResult>> {
		this.logger.info("Falling back to single model", { symbol, modelId });

		const predResult = await this.predictionEngine.predict({
			symbol,
			modelId,
			horizon,
		});

		if (!predResult.success || !predResult.data) {
			return {
				success: false,
				error: predResult.error!,
			};
		}

		const pred = predResult.data;
		const latency = Date.now() - startTime;

		// Convert to ensemble format
		const ensemble: MLEnsemblePrediction = {
			symbol,
			modelId: pred.modelId,
			modelVersion: "1.0.0",
			horizon,
			prediction: {
				direction: pred.direction === "UP" ? "BUY" : pred.direction === "DOWN" ? "SELL" : "HOLD",
				confidence: pred.confidence,
				expectedReturn: pred.prediction,
				probability: pred.confidence,
			},
			features: { symbol, features: {}, featureNames: [], timestamp: Date.now(), completeness: 1.0, qualityScore: 1.0 },
			timestamp: pred.timestamp,
			expiresAt: pred.timestamp + this.config.cacheTTL * 1000,
			modelPredictions: [
				{
					modelId: pred.modelId,
					modelType: pred.modelType,
					prediction: {
						direction: pred.direction === "UP" ? "BUY" : pred.direction === "DOWN" ? "SELL" : "HOLD",
						confidence: pred.confidence,
						expectedReturn: pred.prediction,
						probability: pred.confidence,
					},
					weight: 1.0,
					confidence: pred.confidence,
				},
			],
			aggregationMethod: "weighted",
			consensusStrength: 1.0,
		};

		return {
			success: true,
			data: {
				ensemble,
				individualPredictions: [pred],
				consensusStrength: 1.0,
				diversityScore: 0,
				latencyMs: latency,
				modelsUsed: 1,
				modelsFailed: 0,
				fromCache: pred.fromCache,
			},
			metadata: {
				latency,
				cacheHit: pred.fromCache,
			},
		};
	}

	/**
	 * Get cached ensemble prediction
	 */
	private async getCachedEnsemble(
		symbol: string,
		horizon: MLPredictionHorizon,
		method: EnsembleMethod,
		weightStrategy: WeightingStrategy
	): Promise<Omit<EnsemblePredictionResult, "latencyMs" | "fromCache"> | null> {
		try {
			const cacheKey = `ensemble_${method}_${weightStrategy}`;
			const cached = await this.mlCache.getCachedPrediction(symbol, horizon, cacheKey);

			if (cached && "modelPredictions" in cached) {
				// It's an ensemble prediction - safely cast
				const ensembleCached = cached as any;
				return {
					ensemble: ensembleCached as MLEnsemblePrediction,
					individualPredictions: [],
					consensusStrength: ensembleCached.consensusStrength || 0,
					diversityScore: 0,
					modelsUsed: ensembleCached.modelPredictions?.length || 0,
					modelsFailed: 0,
				};
			}

			return null;
		} catch (error) {
			this.logger.warn("Cache retrieval failed", { error, symbol });
			return null;
		}
	}

	/**
	 * Cache ensemble prediction
	 */
	private async cacheEnsemble(
		symbol: string,
		horizon: MLPredictionHorizon,
		method: EnsembleMethod,
		weightStrategy: WeightingStrategy,
		result: Omit<EnsemblePredictionResult, "latencyMs" | "fromCache">
	): Promise<void> {
		try {
			const cacheKey = `ensemble_${method}_${weightStrategy}`;
			await this.mlCache.cachePrediction(symbol, horizon, cacheKey, result.ensemble);
		} catch (error) {
			this.logger.warn("Cache storage failed", { error, symbol });
		}
	}

	/**
	 * Health check
	 */
	public async healthCheck(): Promise<{
		healthy: boolean;
		initialized: boolean;
		dependencies: {
			predictionEngine: boolean;
			modelRegistry: boolean;
			performanceTracker: boolean;
			weightCalculator: boolean;
		};
	}> {
		const deps = {
			predictionEngine: (await this.predictionEngine.healthCheck()).healthy,
			modelRegistry: await this.modelRegistry.healthCheck(),
			performanceTracker: await this.performanceTracker.healthCheck(),
			weightCalculator: await this.weightCalculator.healthCheck(),
		};

		const healthy = Object.values(deps).every(d => d === true);

		return {
			healthy,
			initialized: this.initialized,
			dependencies: deps,
		};
	}
}

// Export singleton instance
export default EnsembleService.getInstance();
