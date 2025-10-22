/**
 * Real-Time Prediction Engine for VFR Machine Learning Enhancement Layer
 *
 * Features:
 * - <100ms prediction latency (p95 target)
 * - Hot model caching (ModelCache integration)
 * - Feature vector optimization (Float32Array for performance)
 * - Prediction caching (5-minute TTL via MLCacheService)
 * - Parallel inference for batch predictions
 * - Performance monitoring (latency tracking, cache hits)
 * - Algorithm-specific optimizations (via InferenceOptimizer)
 *
 * Philosophy: KISS principles - fast, reliable, simple
 * Zero breaking changes to existing VFR services
 */

import { ModelCache } from "../models/ModelCache";
import { ModelRegistry, ModelMetadata } from "../models/ModelRegistry";
import { FeatureStore } from "../features/FeatureStore";
import { MLCacheService } from "../cache/MLCacheService";
import { Logger } from "../../error-handling/Logger";
import { ErrorHandler, ErrorType, ErrorCode } from "../../error-handling/ErrorHandler";
import { SentimentFusionFeatureExtractor } from "../sentiment-fusion/SentimentFusionFeatureExtractor";
import { PricePredictionFeatureExtractor } from "../features/PricePredictionFeatureExtractor";
import { EarlySignalFeatureExtractor } from "../early-signal/FeatureExtractor";
import { LeanSmartMoneyFeatureExtractor } from "../smart-money-flow/LeanSmartMoneyFeatureExtractor";
import { VolatilityFeatureExtractor } from "../volatility-prediction/VolatilityFeatureExtractor";
import {
	MLServiceResponse,
	MLPredictionHorizon,
	MLModelType,
	MLFeatureVector,
} from "../types/MLTypes";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";

// ===== Configuration Types =====

export interface PredictionEngineConfig {
	maxConcurrentPredictions: number; // Default: 10
	predictionTimeoutMs: number; // Default: 100ms
	enableCaching: boolean; // Default: true
	cacheTTL: number; // Default: 300 seconds (5 minutes)
	enableMetrics: boolean; // Default: true
	batchSize: number; // Default: 25 symbols
}

// ===== Prediction Types =====

export interface PredictionRequest {
	symbol: string;
	modelId?: string; // Optional: use specific model
	horizon?: MLPredictionHorizon; // Default: '1w'
	features?: MLFeatureVector; // Optional: provide pre-computed features
	confidenceThreshold?: number; // Default: 0.5
}

export interface PredictionResult {
	symbol: string;
	modelId: string;
	modelType: MLModelType;
	horizon: MLPredictionHorizon;
	prediction: number; // Raw prediction value
	confidence: number; // 0-1 confidence score
	direction: "UP" | "DOWN" | "NEUTRAL"; // Price direction prediction
	probability?: { up: number; down: number; neutral: number }; // Class probabilities
	latencyMs: number;
	fromCache: boolean;
	timestamp: number;
}

export interface BatchPredictionRequest {
	symbols: string[];
	modelId?: string;
	horizon?: MLPredictionHorizon;
	confidenceThreshold?: number;
}

export interface BatchPredictionResult {
	predictions: PredictionResult[];
	totalLatencyMs: number;
	cacheHitRate: number;
	failedSymbols: string[];
}

// ===== Ensemble Prediction Types =====

export type MLSignal = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface ModelVote {
	modelId: string;
	modelName: string;
	modelVersion: string;
	signal: MLSignal;
	confidence: number;
	prediction: number;
	reasoning?: string;
}

export interface EnsemblePredictionRequest {
	symbol: string;
	horizon?: MLPredictionHorizon;
	features?: MLFeatureVector;
	confidenceThreshold?: number;
	progressTracker?: any; // ProgressTracker instance for real-time updates
}

export interface EnsemblePredictionResult {
	symbol: string;
	consensus: {
		signal: MLSignal;
		confidence: number;
		score: number; // 0-100 score for composite scoring
	};
	votes: ModelVote[];
	breakdown: {
		bullish: number;
		bearish: number;
		neutral: number;
	};
	lowConsensus: boolean; // True when confidence < 50% (models disagree)
	latencyMs: number;
	timestamp: number;
}

// ===== Performance Metrics =====

export interface PredictionMetrics {
	totalPredictions: number;
	avgLatencyMs: number;
	p50LatencyMs: number;
	p95LatencyMs: number;
	p99LatencyMs: number;
	cacheHitRate: number;
	failureRate: number;
	throughput: number; // predictions per second
}

/**
 * RealTimePredictionEngine
 * High-performance prediction service with <100ms latency target
 */
export class RealTimePredictionEngine {
	private static instance: RealTimePredictionEngine;
	private logger: Logger;
	private config: PredictionEngineConfig;
	private modelCache: ModelCache;
	private modelRegistry: ModelRegistry;
	private featureStore: FeatureStore;
	private mlCache: MLCacheService;
	private latencies: number[];
	private statistics: {
		totalPredictions: number;
		cacheHits: number;
		cacheMisses: number;
		failures: number;
		latencySum: number;
	};
	private initialized = false;
	private pythonProcess: ChildProcess | null = null;
	private pythonReady = false;
	private pythonStarting: Promise<void> | null = null;
	private pythonRequestQueue: Array<{
		request: { features: Record<string, number>; modelPath: string; normalizerPath: string };
		resolve: (value: any) => void;
		reject: (error: any) => void;
	}> = [];
	private processingPythonRequest = false;
	private sentimentFusionExtractor: SentimentFusionFeatureExtractor;
	private pricePredictionExtractor: PricePredictionFeatureExtractor;
	private earlySignalExtractor: EarlySignalFeatureExtractor;
	private smartMoneyFlowExtractor: LeanSmartMoneyFeatureExtractor;
	private volatilityExtractor: VolatilityFeatureExtractor;

	private constructor(config?: Partial<PredictionEngineConfig>) {
		this.logger = Logger.getInstance("RealTimePredictionEngine");
		this.config = {
			maxConcurrentPredictions: config?.maxConcurrentPredictions ?? 10,
			predictionTimeoutMs: config?.predictionTimeoutMs ?? 100,
			enableCaching: config?.enableCaching ?? true,
			cacheTTL: config?.cacheTTL ?? 300,
			enableMetrics: config?.enableMetrics ?? true,
			batchSize: config?.batchSize ?? 25,
		};
		this.modelCache = ModelCache.getInstance();
		this.modelRegistry = ModelRegistry.getInstance();
		this.featureStore = FeatureStore.getInstance();
		this.mlCache = MLCacheService.getInstance();
		this.latencies = [];
		this.statistics = {
			totalPredictions: 0,
			cacheHits: 0,
			cacheMisses: 0,
			failures: 0,
			latencySum: 0,
		};
		// Initialize model-specific feature extractors
		this.sentimentFusionExtractor = new SentimentFusionFeatureExtractor();
		this.pricePredictionExtractor = new PricePredictionFeatureExtractor();
		this.earlySignalExtractor = new EarlySignalFeatureExtractor();
		this.smartMoneyFlowExtractor = new LeanSmartMoneyFeatureExtractor();
		this.volatilityExtractor = new VolatilityFeatureExtractor();
	}

	public static getInstance(config?: Partial<PredictionEngineConfig>): RealTimePredictionEngine {
		if (!RealTimePredictionEngine.instance) {
			RealTimePredictionEngine.instance = new RealTimePredictionEngine(config);
		}
		return RealTimePredictionEngine.instance;
	}

	public static resetInstance(): void {
		if (RealTimePredictionEngine.instance) {
			RealTimePredictionEngine.instance = null as any;
		}
	}

	/**
	 * Initialize the prediction engine
	 */
	public async initialize(): Promise<MLServiceResponse<void>> {
		try {
			this.logger.info("Initializing RealTimePredictionEngine");

			// Initialize dependencies
			await this.modelRegistry.initialize();
			await this.featureStore.initialize();

			this.initialized = true;
			this.logger.info("RealTimePredictionEngine initialized successfully");

			return {
				success: true,
				data: undefined,
				metadata: {
					latency: Date.now() - Date.now(),
					cacheHit: false,
				},
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			this.logger.error(`Failed to initialize RealTimePredictionEngine: ${errorMessage}`);
			const errorHandler = ErrorHandler.getInstance();
			const errorResponse = errorHandler.createErrorResponse(
				error,
				"RealTimePredictionEngine"
			);
			return {
				success: false,
				error: errorResponse.error,
			};
		}
	}

	/**
	 * Predict single symbol with <100ms target latency
	 */
	public async predict(request: PredictionRequest): Promise<MLServiceResponse<PredictionResult>> {
		const startTime = Date.now();

		try {
			if (!this.initialized) {
				this.logger.info("RealTimePredictionEngine not initialized, initializing now");
				await this.initialize();
			}

			const {
				symbol,
				modelId,
				horizon = MLPredictionHorizon.ONE_WEEK,
				confidenceThreshold = 0.5,
			} = request;

			this.logger.debug(`[predict] Starting prediction for ${symbol}`, {
				modelId,
				horizon,
				confidenceThreshold,
			});

			// Check cache first (if enabled)
			if (this.config.enableCaching) {
				this.logger.debug(`[predict] Checking cache for ${symbol}`);
				const cached = await this.getCachedPrediction(symbol, modelId, horizon);
				if (cached) {
					this.logger.info(`[predict] Cache hit for ${symbol}`);
					this.statistics.cacheHits++;
					this.trackLatency(Date.now() - startTime);
					return {
						success: true,
						data: cached,
						metadata: {
							latency: Date.now() - startTime,
							cacheHit: true,
						},
					};
				}
				this.logger.debug(`[predict] Cache miss for ${symbol}`);
				this.statistics.cacheMisses++;
			}

			// Get model (from cache or registry)
			this.logger.debug(`[predict] Fetching model (modelId: ${modelId || "default"}, horizon: ${horizon})`);
			const modelResult = await this.getModel(modelId, horizon);
			if (!modelResult.success || !modelResult.data) {
				this.logger.error(`[predict] Model not found: ${modelId || "default"}`, {
					modelResult,
				});
				const errorHandler = ErrorHandler.getInstance();
				const errorResponse = errorHandler.createErrorResponse(
					new Error(`Model not found: ${modelId || "default"}`),
					"RealTimePredictionEngine"
				);
				return {
					success: false,
					error: errorResponse.error,
				};
			}

			const model = modelResult.data;
			this.logger.info(`[predict] Using model: ${model.modelName} v${model.modelVersion} (${model.modelId})`);

			// Get feature vector (provided or fetch from FeatureStore)
			this.logger.debug(`[predict] Fetching feature vector for ${symbol}`);
			const featureVector = request.features || (await this.getFeatureVector(symbol));
			if (!featureVector) {
				this.logger.error(`[predict] Feature vector not found for ${symbol}`);
				const errorHandler = ErrorHandler.getInstance();
				const errorResponse = errorHandler.createErrorResponse(
					new Error(`Feature vector not found for symbol: ${symbol}`),
					"RealTimePredictionEngine"
				);
				return {
					success: false,
					error: errorResponse.error,
				};
			}
			this.logger.debug(`[predict] Feature vector obtained for ${symbol}`, {
				featureCount: Object.keys(featureVector.features).length,
			});

			// Perform inference
			this.logger.debug(`[predict] Running inference for ${symbol}`);
			const prediction = await this.runInference(model, featureVector);
			this.logger.info(`[predict] Inference complete for ${symbol}`, {
				prediction: prediction.value,
				confidence: prediction.confidence,
			});

			// Build result
			const result: PredictionResult = {
				symbol,
				modelId: model.modelId,
				modelType: this.mapModelType(model.modelType),
				horizon,
				prediction: prediction.value,
				confidence: prediction.confidence,
				direction: this.determineDirection(prediction.value, prediction.confidence),
				probability: prediction.probability,
				latencyMs: Date.now() - startTime,
				fromCache: false,
				timestamp: Date.now(),
			};

			// Cache result (if enabled and confidence meets threshold)
			if (this.config.enableCaching && result.confidence >= confidenceThreshold) {
				await this.cachePrediction(symbol, modelId || model.modelId, result);
			}

			// Track metrics
			this.statistics.totalPredictions++;
			this.trackLatency(result.latencyMs);

			return {
				success: true,
				data: result,
				metadata: {
					latency: result.latencyMs,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.statistics.failures++;
			this.trackLatency(Date.now() - startTime);
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			this.logger.error(`Prediction failed for ${request.symbol}: ${errorMessage}`);
			const errorHandler = ErrorHandler.getInstance();
			const errorResponse = errorHandler.createErrorResponse(
				error,
				"RealTimePredictionEngine"
			);
			return {
				success: false,
				error: errorResponse.error,
			};
		}
	}

	/**
	 * Batch predictions with parallel processing
	 */
	public async predictBatch(
		request: BatchPredictionRequest
	): Promise<MLServiceResponse<BatchPredictionResult>> {
		const startTime = Date.now();

		try {
			if (!this.initialized) {
				await this.initialize();
			}

			const {
				symbols,
				modelId,
				horizon = MLPredictionHorizon.ONE_WEEK,
				confidenceThreshold = 0.5,
			} = request;

			// Process in batches to avoid overwhelming system
			const batchSize = this.config.batchSize;
			const results: PredictionResult[] = [];
			const failed: string[] = [];
			let cacheHits = 0;

			for (let i = 0; i < symbols.length; i += batchSize) {
				const batch = symbols.slice(i, i + batchSize);

				// Parallel prediction for batch
				const batchResults = await Promise.allSettled(
					batch.map(symbol =>
						this.predict({ symbol, modelId, horizon, confidenceThreshold })
					)
				);

				// Collect results
				batchResults.forEach((result, idx) => {
					if (
						result.status === "fulfilled" &&
						result.value.success &&
						result.value.data
					) {
						results.push(result.value.data);
						if (result.value.data.fromCache) {
							cacheHits++;
						}
					} else {
						failed.push(batch[idx]);
					}
				});
			}

			const totalLatency = Date.now() - startTime;
			const cacheHitRate = results.length > 0 ? cacheHits / results.length : 0;

			const batchResult: BatchPredictionResult = {
				predictions: results,
				totalLatencyMs: totalLatency,
				cacheHitRate,
				failedSymbols: failed,
			};

			return {
				success: true,
				data: batchResult,
				metadata: {
					latency: totalLatency,
					cacheHit: cacheHitRate > 0,
				},
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			this.logger.error(`Batch prediction failed: ${errorMessage}`);
			const errorHandler = ErrorHandler.getInstance();
			const errorResponse = errorHandler.createErrorResponse(
				error,
				"RealTimePredictionEngine"
			);
			return {
				success: false,
				error: errorResponse.error,
			};
		}
	}

	/**
	 * Ensemble prediction - combines predictions from ALL deployed models
	 * Returns consensus signal (BULLISH/BEARISH/NEUTRAL) with breakdown of individual model votes
	 */
	public async predictEnsemble(
		request: EnsemblePredictionRequest
	): Promise<MLServiceResponse<EnsemblePredictionResult>> {
		const startTime = Date.now();

		try {
			if (!this.initialized) {
				await this.initialize();
			}

			const { symbol, horizon, features, confidenceThreshold = 0.5 } = request;

			this.logger.info(`[predictEnsemble] Starting ensemble prediction for ${symbol}`);

			// Get ALL deployed models
			const deployedResult = await this.modelRegistry.getDeployedModels();
			if (!deployedResult.success || !deployedResult.data || deployedResult.data.length === 0) {
				throw new Error("No deployed models available for ensemble prediction");
			}

			const models = deployedResult.data;
			this.logger.info(`[predictEnsemble] Found ${models.length} deployed models`, {
				models: models.map(m => `${m.modelName} v${m.modelVersion}`),
			});

			// Run predictions in parallel for ALL models
			// Each model extracts its own features using model-specific extractors
			const predictionPromises = models.map(async model => {
				try {
					this.logger.debug(`[predictEnsemble] Running ${model.modelName} v${model.modelVersion}`);

					// Notify progress tracker for this model
					if (request.progressTracker) {
						if (model.modelName === 'volatility-prediction') {
							request.progressTracker.startStage('volatility_prediction', 'Predicting volatility');
						} else if (model.modelName === 'smart-money-flow') {
							request.progressTracker.startStage('smart_money_flow', 'Analyzing institutional activity');
						}
					}

					// Extract model-specific features
					const modelFeatures = await this.getModelSpecificFeatures(model.modelName, symbol);
					if (!modelFeatures) {
						throw new Error(`Feature extraction failed for ${model.modelName}`);
					}

					// Filter out metadata properties (symbol, timestamp) - only keep numeric features
					const metadataKeys = ['symbol', 'timestamp'];
					const featureOnlyKeys = Object.keys(modelFeatures).filter(key => !metadataKeys.includes(key));
					const featuresOnly: Record<string, number> = {};
					featureOnlyKeys.forEach(key => {
						featuresOnly[key] = modelFeatures[key];
					});

					// Convert features object to MLFeatureVector format for runInference
					const featureVector: MLFeatureVector = {
						symbol,
						features: featuresOnly,
						featureNames: featureOnlyKeys,
						timestamp: Date.now(),
						completeness: 1.0,
						qualityScore: 1.0,
					};

					const prediction = await this.runInference(model, featureVector);

					// DEBUG: Log raw prediction values to diagnose identical confidences
					console.log(`[DEBUG] ${model.modelName} raw prediction:`, {
						value: prediction.value,
						confidence: prediction.confidence,
						probability: prediction.probability
					});

					const signal = this.mapPredictionToSignal(
						prediction.value,
						model.modelName
					);

					const vote: ModelVote = {
						modelId: model.modelId,
						modelName: model.modelName,
						modelVersion: model.modelVersion,
						signal,
						confidence: prediction.confidence,
						prediction: prediction.value,
						reasoning: this.generateModelReasoning(model.modelName, signal, prediction.confidence),
					};

					this.logger.info(`[predictEnsemble] ${model.modelName}: ${signal} (${(prediction.confidence * 100).toFixed(1)}% confident)`);

					// Complete progress stage for this model
					if (request.progressTracker) {
						if (model.modelName === 'volatility-prediction') {
							request.progressTracker.completeStage('volatility_prediction', `Volatility: ${signal}`);
						} else if (model.modelName === 'smart-money-flow') {
							request.progressTracker.completeStage('smart_money_flow', `Smart Money: ${signal}`);
						}
					}

					return vote;
				} catch (error) {
					this.logger.warn(`[predictEnsemble] ${model.modelName} failed:`, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					modelName: model.modelName,
					modelVersion: model.modelVersion,
					modelPath: model.artifactPath ||
						path.join(process.cwd(), `models/${model.modelName}/v${model.modelVersion}/model.txt`),
					normalizerPath: model.artifactPath?.replace('model.txt', 'normalizer.json') ||
						path.join(process.cwd(), `models/${model.modelName}/v${model.modelVersion}/normalizer.json`)
				});
					return null;
				}
			});

			const votes = (await Promise.all(predictionPromises)).filter(
				(v): v is ModelVote => v !== null
			);

			if (votes.length === 0) {
				throw new Error("All model predictions failed");
			}

			// Calculate consensus from votes
			const consensus = this.calculateConsensus(votes);

			// Calculate breakdown
			const breakdown = {
				bullish: votes.filter(v => v.signal === "BULLISH").length / votes.length,
				bearish: votes.filter(v => v.signal === "BEARISH").length / votes.length,
				neutral: votes.filter(v => v.signal === "NEUTRAL").length / votes.length,
			};

			const result: EnsemblePredictionResult = {
				symbol,
				consensus,
				votes,
				breakdown,
				lowConsensus: consensus.confidence < 0.5, // Flag model disagreement
				latencyMs: Date.now() - startTime,
				timestamp: Date.now(),
			};

			const consensusNote = result.lowConsensus ? " [LOW CONSENSUS - MODELS DISAGREE]" : "";
		this.logger.info(`[predictEnsemble] Consensus for ${symbol}: ${consensus.signal} (${(consensus.confidence * 100).toFixed(1)}% confident)${consensusNote}`, {
				breakdown,
				votes: votes.map(v => `${v.modelName}: ${v.signal}`),
				lowConsensus: result.lowConsensus,
			});

			return {
				success: true,
				data: result,
				metadata: {
					latency: result.latencyMs,
					cacheHit: false,
				},
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			this.logger.error(`[predictEnsemble] Ensemble prediction failed for ${request.symbol}: ${errorMessage}`);
			const errorHandler = ErrorHandler.getInstance();
			const errorResponse = errorHandler.createErrorResponse(error, "RealTimePredictionEngine");
			return {
				success: false,
				error: errorResponse.error,
			};
		}
	}

	/**
	 * Map raw prediction value to signal based on model type
	 */
	private mapPredictionToSignal(value: number, modelName: string): MLSignal {
		// For early-signal-detection: positive value = analyst upgrade likely (BULLISH)
		if (modelName.includes("early-signal")) {
			if (value > 0.6) return "BULLISH"; // High confidence upgrade
			if (value < -0.6) return "BEARISH"; // High confidence downgrade
			return "NEUTRAL";
		}

		// For smart-money-flow: positive value = institutional buying (BULLISH)
		if (modelName.includes("smart-money")) {
			if (value > 0.6) return "BULLISH"; // Strong institutional buying
			if (value < -0.6) return "BEARISH"; // Strong institutional selling
			return "NEUTRAL";
		}

		// For volatility-prediction: high volatility = BEARISH (risk-off)
		if (modelName.includes("volatility-prediction")) {
			// Volatility above 50% = high risk (bearish signal)
			if (value > 50) return "BEARISH";
			// Volatility below 20% = low risk (bullish signal)
			if (value < 20) return "BULLISH";
			return "NEUTRAL"; // Moderate volatility
		}

		// For price-prediction and sentiment-fusion: prediction is price direction
		// Positive = UP (BULLISH), Negative = DOWN (BEARISH)
		if (value > 0.15) return "BULLISH"; // Strong upward prediction
		if (value < -0.15) return "BEARISH"; // Strong downward prediction
		return "NEUTRAL"; // Mixed or uncertain
	}

	/**
	 * Calculate weighted consensus from model votes
	 *
	 * Ensemble Voting Architecture:
	 * This method implements a weighted voting system where each ML model contributes
	 * to the final prediction based on its reliability and scope.
	 *
	 * Model Weights (Total: 100%):
	 * - sentiment-fusion (45%): Most comprehensive model combining news sentiment +
	 *   price technicals. Highest weight due to broad feature set (45 features).
	 *
	 * - price-prediction (27%): Baseline technical + fundamental analysis. Medium
	 *   weight for traditional price trend prediction.
	 *
	 * - early-signal-detection (18%): Specialized analyst upgrade/downgrade predictions.
	 *   Lower weight due to specific event focus (28 features).
	 *
	 * - smart-money-flow (10%): Institutional & insider trading activity analysis.
	 *   Conservative weight - includes congressional trades, options flow, dark pool (27 features).
	 *
	 * Voting Algorithm:
	 * 1. Each model's vote is multiplied by its base weight AND confidence:
	 *    effectiveWeight = baseWeight * modelConfidence
	 *
	 * 2. Votes are accumulated for each signal (BULLISH/BEARISH/NEUTRAL)
	 *
	 * 3. Scores are normalized by total weight
	 *
	 * 4. Highest score wins (consensus signal)
	 *
	 * Example Calculation (4-model ensemble):
	 * - sentiment-fusion: BULLISH @ 0.78 confidence → 0.45 * 0.78 = 0.351
	 * - price-prediction: BULLISH @ 0.65 confidence → 0.27 * 0.65 = 0.176
	 * - early-signal: NEUTRAL @ 0.52 confidence → 0.18 * 0.52 = 0.094 (neutral)
	 * - smart-money-flow: BULLISH @ 0.70 confidence → 0.10 * 0.70 = 0.070
	 *
	 * Result:
	 * - Bullish Score: (0.351 + 0.176 + 0.070) / 1.0 = 0.597 (59.7%)
	 * - Neutral Score: 0.094 / 1.0 = 0.094 (9.4%)
	 * - Bearish Score: 0.0 / 1.0 = 0.0 (0%)
	 * - Consensus: BULLISH with 59.7% confidence
	 * - Composite Score: 50 + (0.597 * 50) = 79.85 (0-100 scale)
	 *
	 * Adding New Models:
	 * To add a new model to the ensemble:
	 * 1. Add entry to weights object below (ensure total ≈ 1.0)
	 * 2. Consider model accuracy and scope when setting weight
	 * 3. Start with 10-15% weight, increase if model proves reliable
	 * 4. Reduce existing weights proportionally to maintain total = 1.0
	 *
	 * @param votes - Array of model votes with signal, confidence, and metadata
	 * @returns Consensus signal, confidence score, and 0-100 composite score
	 */
	private calculateConsensus(votes: ModelVote[]): {
		signal: MLSignal;
		confidence: number;
		score: number;
	} {
		// CRITICAL: Model weights must be kept in sync with deployed models
		// Total should equal 1.0 for proper normalization
		// Update these weights when adding/removing models from ensemble
		const weights: Record<string, number> = {
			"sentiment-fusion": 0.40, // Most comprehensive (40%) - 45 features [REDUCED from 0.45]
			"price-prediction": 0.25, // Baseline price model (25%) - 35 features [REDUCED from 0.27]
			"early-signal-detection": 0.18, // Analyst signal (18%) - 28 features
			"smart-money-flow": 0.10, // Institutional/insider analysis (10%) - 27 features [DEPLOYED Oct 13, 2025]
			"volatility-prediction": 0.07, // Risk/volatility indicator (7%) - 28 features [DEPLOYED Oct 19, 2025]
		};

		let bullishScore = 0;
		let bearishScore = 0;
		let neutralScore = 0;
		let totalWeight = 0;

		votes.forEach(vote => {
			const weight = weights[vote.modelName] || 0.33; // Default equal weight if unknown
			const confidenceWeight = weight * vote.confidence;

			if (vote.signal === "BULLISH") {
				bullishScore += confidenceWeight;
			} else if (vote.signal === "BEARISH") {
				bearishScore += confidenceWeight;
			} else {
				neutralScore += confidenceWeight;
			}

			totalWeight += weight;
		});

		// Normalize scores
		if (totalWeight > 0) {
			bullishScore /= totalWeight;
			bearishScore /= totalWeight;
			neutralScore /= totalWeight;
		}

		// Determine consensus signal
		const maxScore = Math.max(bullishScore, bearishScore, neutralScore);
		let signal: MLSignal;
		let confidence: number;

		if (maxScore === bullishScore) {
			signal = "BULLISH";
			confidence = bullishScore;
		} else if (maxScore === bearishScore) {
			signal = "BEARISH";
			confidence = bearishScore;
		} else {
			signal = "NEUTRAL";
			confidence = neutralScore;
		}

		// LOW CONFIDENCE THRESHOLD: Override to NEUTRAL when models disagree
		// If consensus confidence < 50%, models are in strong disagreement
		// Return NEUTRAL to signal uncertainty rather than picking a weak directional call
		// Keep the low confidence value to show users the disagreement magnitude
		const LOW_CONFIDENCE_THRESHOLD = 0.5;
		if (confidence < LOW_CONFIDENCE_THRESHOLD) {
			signal = "NEUTRAL";
			// Confidence remains low (e.g., 0.28) to indicate "we don't know"
			// This tells users: "Models disagree - don't trust this prediction"
		}

		// Calculate 0-100 score (50 = neutral baseline)
		// BULLISH: 50-100, BEARISH: 0-50, NEUTRAL: around 50
		let score: number;
		if (signal === "BULLISH") {
			score = 50 + confidence * 50; // 50-100
		} else if (signal === "BEARISH") {
			score = 50 - confidence * 50; // 0-50
		} else {
			score = 50; // Neutral
		}

		return { signal, confidence, score };
	}

	/**
	 * Generate reasoning text for a model vote
	 */
	private generateModelReasoning(modelName: string, signal: MLSignal, confidence: number): string {
		const confidenceText =
			confidence > 0.75 ? "High confidence" : confidence > 0.5 ? "Moderate confidence" : "Low confidence";

		if (modelName.includes("sentiment-fusion")) {
			return `${confidenceText} ${signal.toLowerCase()} signal from news sentiment + price analysis`;
		} else if (modelName.includes("price-prediction")) {
			return `${confidenceText} ${signal.toLowerCase()} signal from technical + fundamental analysis`;
		} else if (modelName.includes("early-signal")) {
			return `${confidenceText} ${signal === "BULLISH" ? "analyst upgrade" : signal === "BEARISH" ? "analyst downgrade" : "no rating change"} prediction`;
		} else if (modelName.includes("smart-money")) {
			return `${confidenceText} ${signal === "BULLISH" ? "institutional buying" : signal === "BEARISH" ? "institutional selling" : "neutral institutional activity"} signal`;
		} else if (modelName.includes("volatility-prediction")) {
			const riskLevel =
				signal === "BEARISH" ? "high volatility (elevated risk)" :
				signal === "BULLISH" ? "low volatility (stable conditions)" :
				"moderate volatility";
			return `${confidenceText} ${riskLevel} detected`;
		}

		return `${confidenceText} ${signal.toLowerCase()} signal`;
	}

	/**
	 * Get cached prediction
	 */
	private async getCachedPrediction(
		symbol: string,
		modelId: string | undefined,
		horizon: MLPredictionHorizon
	): Promise<PredictionResult | null> {
		try {
			const cached = await this.mlCache.getCachedPrediction(
				symbol,
				horizon,
				modelId || "default"
			);

			if (!cached) {
				return null;
			}

			// Convert MLPrediction to PredictionResult
			const result: PredictionResult = {
				symbol: cached.symbol,
				modelId: cached.modelId,
				modelType: this.mapModelType("lightgbm"), // Default type
				horizon: cached.horizon,
				prediction: cached.prediction.expectedReturn,
				confidence: cached.prediction.confidence,
				direction:
					cached.prediction.direction === "BUY"
						? "UP"
						: cached.prediction.direction === "SELL"
							? "DOWN"
							: "NEUTRAL",
				probability: {
					up: cached.prediction.probability,
					down: 1 - cached.prediction.probability,
					neutral: 0,
				},
				latencyMs: 0,
				fromCache: true,
				timestamp: cached.timestamp,
			};

			return result;
		} catch (error) {
			this.logger.warn(
				`Cache retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`
			);
			return null;
		}
	}

	/**
	 * Cache prediction result
	 */
	private async cachePrediction(
		symbol: string,
		modelId: string,
		result: PredictionResult
	): Promise<void> {
		try {
			// Convert PredictionResult to MLPrediction format expected by cache
			const mlPrediction: any = {
				symbol: result.symbol,
				modelId: result.modelId,
				modelVersion: "1.0",
				horizon: result.horizon,
				prediction: {
					direction:
						result.direction === "UP"
							? "BUY"
							: result.direction === "DOWN"
								? "SELL"
								: "HOLD",
					confidence: result.confidence,
					expectedReturn: result.prediction,
					probability: result.confidence,
				},
				features: {} as any,
				timestamp: result.timestamp,
				expiresAt: result.timestamp + this.config.cacheTTL * 1000,
			};
			await this.mlCache.cachePrediction(symbol, result.horizon, modelId, mlPrediction);
		} catch (error) {
			this.logger.warn(
				`Cache storage failed: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}

	/**
	 * Get model from cache or registry
	 */
	private async getModel(
		modelId: string | undefined,
		horizon: MLPredictionHorizon
	): Promise<MLServiceResponse<ModelMetadata>> {
		try {
			if (modelId) {
				this.logger.debug(`[getModel] Fetching specific model by ID: ${modelId}`);
				return await this.modelRegistry.getModel(modelId);
			}

			// Get default deployed model for horizon
			this.logger.debug(`[getModel] Fetching deployed models for horizon: ${horizon}`);
			const deployed = await this.modelRegistry.getDeployedModels();

			this.logger.debug(`[getModel] Deployed models result:`, {
				success: deployed.success,
				count: deployed.data?.length || 0,
				models: deployed.data?.map(m => ({
					id: m.modelId,
					name: m.modelName,
					version: m.modelVersion,
					horizon: m.predictionHorizon,
					status: m.status,
				})),
			});

			if (deployed.success && deployed.data && deployed.data.length > 0) {
				// Find best match for horizon
				const match = deployed.data.find(m => m.predictionHorizon === horizon);
				if (match) {
					this.logger.info(`[getModel] Found model matching horizon ${horizon}: ${match.modelName} v${match.modelVersion}`);
					return {
						success: true,
						data: match,
						metadata: {
							latency: 0,
							cacheHit: false,
						},
					};
				}
				// Fallback to first deployed model
				this.logger.warn(`[getModel] No exact horizon match, using first deployed model: ${deployed.data[0].modelName}`);
				return {
					success: true,
					data: deployed.data[0],
					metadata: {
						latency: 0,
						cacheHit: false,
					},
				};
			}

			this.logger.error(`[getModel] No deployed models available`);
			const errorHandler = ErrorHandler.getInstance();
			const errorResponse = errorHandler.createErrorResponse(
				new Error("No deployed models available"),
				"ModelRegistry"
			);
			return {
				success: false,
				error: errorResponse.error,
			};
		} catch (error) {
			this.logger.error(`[getModel] Error fetching model:`, error);
			const errorHandler = ErrorHandler.getInstance();
			const errorResponse = errorHandler.createErrorResponse(error, "ModelRegistry");
			return {
				success: false,
				error: errorResponse.error,
			};
		}
	}

	/**
	 * Get feature vector from FeatureStore
	 */
	private async getFeatureVector(symbol: string): Promise<MLFeatureVector | null> {
		try {
			const result = await this.featureStore.getFeatureMatrix({
				symbols: [symbol],
			});
			if (result.size > 0) {
				return result.get(symbol) || null;
			}
			return null;
		} catch (error) {
			this.logger.warn(
				`Feature retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`
			);
			return null;
		}
	}

	/**
	 * Get model-specific feature vector
	 * Each model has different feature requirements:
	 * - sentiment-fusion: 45 features (sentiment + technical)
	 * - price-prediction: 43 features (volume + technical)
	 * - early-signal: 34 features (price momentum + fundamentals)
	 * - smart-money-flow: 27 features (institutional/insider activity)
	 */
	private async getModelSpecificFeatures(
		modelName: string,
		symbol: string
	): Promise<any> {
		try {
			switch (modelName) {
				case "sentiment-fusion":
					return await this.sentimentFusionExtractor.extractFeatures(symbol);
				case "price-prediction":
					return await this.pricePredictionExtractor.extractFeatures(symbol);
				case "early-signal":
					return await this.earlySignalExtractor.extractFeatures(symbol);
				case "smart-money-flow":
					return await this.smartMoneyFlowExtractor.extractFeatures(symbol);
				case "volatility-prediction":
					return await this.volatilityExtractor.extractFeatures(symbol);
				default:
					this.logger.warn(`Unknown model name: ${modelName}, falling back to FeatureStore`);
					const featureVector = await this.getFeatureVector(symbol);
					return featureVector?.features || null;
			}
		} catch (error) {
			this.logger.error(`Model-specific feature extraction failed for ${modelName}:`, error);
			return null;
		}
	}

	/**
	 * Ensure Python prediction subprocess is running (with race condition protection)
	 */
	private async ensurePythonProcess(): Promise<void> {
		// If Python is ready, return immediately
		if (this.pythonProcess && this.pythonReady) {
			return;
		}

		// If Python is starting, wait for it to finish
		if (this.pythonStarting) {
			await this.pythonStarting;
			return;
		}

		// Start Python process (only one caller will reach here)
		this.pythonStarting = (async () => {
			try {
				const scriptPath = path.join(process.cwd(), "scripts/ml/predict-generic.py");
				this.logger.info(`Starting Python prediction server: ${scriptPath}`);

				this.pythonProcess = spawn("python3", [scriptPath], {
					cwd: process.cwd(),
					stdio: ["pipe", "pipe", "pipe"],
				});

				// Wait for READY signal from Python server
				await new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => {
						reject(new Error("Python server startup timeout (10s)"));
					}, 10000);

					this.pythonProcess!.stderr!.on("data", (data: Buffer) => {
						const message = data.toString().trim();
						if (message.includes("READY")) {
							clearTimeout(timeout);
							this.pythonReady = true;
							this.logger.info("Python prediction server ready");
							resolve();
						}
						if (message.includes("ERROR")) {
							clearTimeout(timeout);
							reject(new Error(`Python server error: ${message}`));
						}
					});

					this.pythonProcess!.on("error", (err: Error) => {
						clearTimeout(timeout);
						reject(err);
					});
				});

				this.pythonStarting = null;
			} catch (error) {
				this.pythonProcess = null;
				this.pythonReady = false;
				this.pythonStarting = null;
				throw new Error(
					`Failed to start Python prediction server: ${error instanceof Error ? error.message : "Unknown error"}`
				);
			}
		})();

		await this.pythonStarting;
	}

	/**
	 * Call Python subprocess for model inference
	 */
	/**
	 * Add request to queue and process
	 */
	private async callPython(
		features: Record<string, number>,
		modelPath: string,
		normalizerPath: string
	): Promise<{
		value: number;
		confidence: number;
		probability?: { up: number; down: number; neutral: number };
	}> {
		if (!this.pythonProcess || !this.pythonReady) {
			throw new Error("Python prediction server not ready");
		}

		// Add request to queue
		return new Promise((resolve, reject) => {
			this.pythonRequestQueue.push({
				request: { features, modelPath, normalizerPath },
				resolve,
				reject,
			});

			// Start processing queue if not already processing
			if (!this.processingPythonRequest) {
				this.processPythonQueue();
			}
		});
	}

	/**
	 * Process Python request queue (one at a time)
	 */
	private async processPythonQueue(): Promise<void> {
		if (this.processingPythonRequest || this.pythonRequestQueue.length === 0) {
			return;
		}

		this.processingPythonRequest = true;

		while (this.pythonRequestQueue.length > 0) {
			const { request, resolve, reject } = this.pythonRequestQueue.shift()!;

			try {
				const result = await this.executePythonRequest(request);
				resolve(result);
			} catch (error) {
				reject(error);
			}
		}

		this.processingPythonRequest = false;
	}

	/**
	 * Execute a single Python request (synchronized)
	 */
	private async executePythonRequest(request: {
		features: Record<string, number>;
		modelPath: string;
		normalizerPath: string;
	}): Promise<{
		value: number;
		confidence: number;
		probability?: { up: number; down: number; neutral: number };
	}> {
		const pythonProcess = this.pythonProcess!;

		return new Promise((resolve, reject) => {
			const requestStr = JSON.stringify(request) + "\n";
			const timeout = setTimeout(() => {
				reject(new Error("Prediction timeout (5s)"));
			}, 5000);

			const onData = (data: Buffer) => {
				try {
					const response = JSON.parse(data.toString());
					clearTimeout(timeout);
					pythonProcess.stdout!.removeListener("data", onData);

					if (response.success) {
						resolve({
							value: response.data.prediction,
							confidence: response.data.confidence,
							probability: response.data.probability,
						});
					} else {
						reject(new Error(response.error || "Prediction failed"));
					}
				} catch (err) {
					clearTimeout(timeout);
					pythonProcess.stdout!.removeListener("data", onData);
					reject(err);
				}
			};

			pythonProcess.stdout!.on("data", onData);
			pythonProcess.stdin!.write(requestStr);
		});
	}

	/**
	 * Cleanup Python subprocess
	 */
	private cleanupPythonProcess(): void {
		if (this.pythonProcess) {
			this.pythonProcess.kill();
			this.pythonProcess = null;
			this.pythonReady = false;
			this.logger.info("Python prediction server stopped");
		}
	}

	/**
	 * Run inference on model using real Python subprocess
	 *
	 * CRITICAL: This method implements dynamic model path resolution to ensure each model
	 * loads independently from its own directory. The `ml_models` table does NOT have an
	 * `artifact_path` column, so we construct paths dynamically using model metadata.
	 *
	 * Directory Structure (REQUIRED):
	 * models/
	 *   ├── sentiment-fusion/v1.1.0/
	 *   │   ├── model.txt
	 *   │   └── normalizer.json
	 *   ├── price-prediction/v1.1.0/
	 *   │   ├── model.txt
	 *   │   └── normalizer.json
	 *   └── early-signal/v1.0.0/
	 *       ├── model.txt
	 *       └── normalizer.json
	 *
	 * Path Construction Logic:
	 * 1. If model.artifactPath exists (custom path) → use it
	 * 2. Otherwise → construct: models/{modelName}/{modelVersion}/model.txt
	 *
	 * Example Paths Generated:
	 * - sentiment-fusion: models/sentiment-fusion/v1.1.0/model.txt
	 * - price-prediction: models/price-prediction/v1.1.0/model.txt
	 * - early-signal: models/early-signal/v1.0.0/model.txt
	 *
	 * Bug Fix (2025-10-10):
	 * Previously, all models were loading from a static path (sentiment-fusion), causing
	 * identical 41% confidence values across all predictions. Fixed by making path
	 * construction dynamic using model.modelName and model.modelVersion.
	 *
	 * Troubleshooting:
	 * - If all models return same confidence → Check this path construction
	 * - If model not found → Verify directory structure matches pattern above
	 * - If predictions fail → Check normalizer.json exists in same directory
	 *
	 * @param model - Model metadata from ml_models table (contains modelName, modelVersion)
	 * @param features - Normalized feature vector for prediction
	 * @returns Prediction with value, confidence, and optional probability distribution
	 */
	private async runInference(
		model: ModelMetadata,
		features: MLFeatureVector
	): Promise<{
		value: number;
		confidence: number;
		probability?: { up: number; down: number; neutral: number };
	}> {
		try {
			// Ensure Python subprocess is running
			await this.ensurePythonProcess();

			// CRITICAL: Dynamic model path construction using model metadata
			// This ensures each model loads from its own directory:
			// - sentiment-fusion → models/sentiment-fusion/v1.1.0/model.txt
			// - price-prediction → models/price-prediction/v1.1.0/model.txt
			// - early-signal → models/early-signal/v1.0.0/model.txt
			//
			// The ml_models table does NOT have an artifact_path column, so this
			// fallback path construction is essential for independent model loading.
			const modelPath =
				model.artifactPath ||
				path.join(process.cwd(), `models/${model.modelName}/v${model.modelVersion}/model.txt`);

			// Normalizer must be in same directory as model
			const normalizerPath = path.join(path.dirname(modelPath), "normalizer.json");

			// Call Python for real model inference
			console.log(`[DEBUG runInference] Calling Python with:`, {
				modelName: model.modelName,
				modelPath,
				normalizerPath,
				featureCount: Object.keys(features.features).length
			});
			const prediction = await this.callPython(features.features, modelPath, normalizerPath);

			return prediction;
		} catch (error) {
			throw new Error(
				`Inference failed: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}

	/**
	 * Determine price direction from prediction
	 */
	private determineDirection(prediction: number, confidence: number): "UP" | "DOWN" | "NEUTRAL" {
		if (confidence < 0.5) {
			return "NEUTRAL";
		}
		if (prediction > 0.1) {
			return "UP";
		}
		if (prediction < -0.1) {
			return "DOWN";
		}
		return "NEUTRAL";
	}

	/**
	 * Map model type from registry to ML type
	 */
	private mapModelType(modelType: string): MLModelType {
		switch (modelType.toLowerCase()) {
			case "lightgbm":
				return MLModelType.LIGHTGBM;
			case "xgboost":
				return MLModelType.XGBOOST;
			case "lstm":
				return MLModelType.LSTM;
			case "ensemble":
				return MLModelType.ENSEMBLE;
			default:
				return MLModelType.LIGHTGBM;
		}
	}

	/**
	 * Track latency for metrics
	 */
	private trackLatency(latencyMs: number): void {
		if (this.config.enableMetrics) {
			this.latencies.push(latencyMs);
			this.statistics.latencySum += latencyMs;

			// Keep last 1000 latencies for percentile calculations
			if (this.latencies.length > 1000) {
				this.latencies.shift();
			}
		}
	}

	/**
	 * Get prediction metrics
	 */
	public getMetrics(): PredictionMetrics {
		const totalRequests = this.statistics.totalPredictions;
		const sorted = [...this.latencies].sort((a, b) => a - b);

		return {
			totalPredictions: totalRequests,
			avgLatencyMs: totalRequests > 0 ? this.statistics.latencySum / totalRequests : 0,
			p50LatencyMs: sorted[Math.floor(sorted.length * 0.5)] || 0,
			p95LatencyMs: sorted[Math.floor(sorted.length * 0.95)] || 0,
			p99LatencyMs: sorted[Math.floor(sorted.length * 0.99)] || 0,
			cacheHitRate: totalRequests > 0 ? this.statistics.cacheHits / totalRequests : 0,
			failureRate: totalRequests > 0 ? this.statistics.failures / totalRequests : 0,
			throughput:
				this.latencies.length > 0 ? 1000 / (this.statistics.latencySum / totalRequests) : 0,
		};
	}

	/**
	 * Health check
	 */
	public async healthCheck(): Promise<{
		healthy: boolean;
		initialized: boolean;
		metrics: PredictionMetrics;
		issues: string[];
	}> {
		const issues: string[] = [];

		if (!this.initialized) {
			issues.push("Engine not initialized");
		}

		const metrics = this.getMetrics();
		if (metrics.p95LatencyMs > this.config.predictionTimeoutMs) {
			issues.push(
				`P95 latency (${metrics.p95LatencyMs}ms) exceeds target (${this.config.predictionTimeoutMs}ms)`
			);
		}

		if (metrics.failureRate > 0.1) {
			issues.push(`High failure rate: ${(metrics.failureRate * 100).toFixed(2)}%`);
		}

		return {
			healthy: issues.length === 0,
			initialized: this.initialized,
			metrics,
			issues,
		};
	}
}
