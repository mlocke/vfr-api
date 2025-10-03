/**
 * ML Enhancement Service - Integration layer for VFR ML enhancement
 * Coordinates ML predictions with existing VFR stock selection service
 * Following VFR patterns with graceful fallback to classic analysis
 */

import { Logger } from "../error-handling/Logger";
import { ErrorHandler } from "../error-handling/ErrorHandler";
import { MLPredictionService } from "./MLPredictionService";
import { FeatureEngineeringService } from "./features/FeatureEngineeringService";
import ModelManager from "./ModelManager";
import {
	MLPredictionHorizon,
	MLServiceResponse,
	MLHealthStatus,
	MLUserTier,
} from "./types/MLTypes";
import {
	EnhancedStockSelectionRequest,
	EnhancedStockSelectionResponse,
	EnhancedStockResult,
	EnhancementOrchestrationConfig,
	EnhancementOrchestrationResult,
	GracefulDegradationConfig,
	DegradationStatus,
} from "./types/EnhancementTypes";

export interface MLEnhancementServiceConfig {
	enableML: boolean;
	mlWeight: number; // 10-15% default
	classicWeight: number; // 85-90% default
	targetLatency: number; // <500ms
	enableGracefulDegradation: boolean;
	fallbackToClassic: boolean;
	maxRetries: number;
}

export class MLEnhancementService {
	private static instance: MLEnhancementService;
	private logger: Logger;
	private errorHandler: ErrorHandler;
	private predictionService: MLPredictionService;
	private featureService: FeatureEngineeringService;
	private modelManager: ModelManager;
	private config: MLEnhancementServiceConfig;
	private degradationStatus: DegradationStatus;

	private constructor(config?: Partial<MLEnhancementServiceConfig>) {
		this.logger = Logger.getInstance("MLEnhancementService");
		this.errorHandler = ErrorHandler.getInstance();
		this.predictionService = new MLPredictionService();
		this.featureService = new FeatureEngineeringService();
		this.modelManager = ModelManager.getInstance();

		this.config = {
			enableML: true,
			mlWeight: 0.1, // 10% ML contribution
			classicWeight: 0.9, // 90% classic VFR
			targetLatency: 500, // <500ms for ML enhancement
			enableGracefulDegradation: true,
			fallbackToClassic: true,
			maxRetries: 2,
			...config,
		};

		this.degradationStatus = {
			isDegraded: false,
			degradationType: "none",
			affectedServices: [],
			fallbackActive: false,
			fallbackStrategy: "none",
		};

		this.logger.info("MLEnhancementService initialized", {
			config: this.config,
		});
	}

	public static getInstance(config?: Partial<MLEnhancementServiceConfig>): MLEnhancementService {
		if (!MLEnhancementService.instance) {
			MLEnhancementService.instance = new MLEnhancementService(config);
		}
		return MLEnhancementService.instance;
	}

	/**
	 * Enhance stock selection with ML predictions
	 * Integrates with existing VFR stock selection service
	 */
	public async enhanceStockSelection(
		request: EnhancedStockSelectionRequest,
		classicResults: any[], // Results from classic VFR analysis
		requestId?: string
	): Promise<EnhancedStockSelectionResponse> {
		const startTime = Date.now();

		try {
			// If ML is disabled or not requested, return classic results
			if (!this.config.enableML || !request.includeML) {
				return this.createClassicOnlyResponse(classicResults, startTime);
			}

			// Check degradation status
			if (this.degradationStatus.isDegraded && this.config.fallbackToClassic) {
				this.logger.warn("ML degraded, using classic fallback", {
					degradationType: this.degradationStatus.degradationType,
					requestId,
				});
				return this.createClassicOnlyResponse(classicResults, startTime);
			}

			this.logger.info("Enhancing stock selection with ML", {
				symbols: request.symbols,
				mlModels: request.mlModels,
				requestId,
			});

			// Enhance each stock result with ML
			const enhancedResults = await Promise.all(
				classicResults.map(classicResult =>
					this.enhanceSingleStock(
						classicResult,
						request.mlModels || [],
						request.mlHorizon || MLPredictionHorizon.ONE_DAY,
						request.mlConfidenceThreshold || 0.5,
						requestId
					)
				)
			);

			const classicTime = Date.now() - startTime;
			const mlTime = Date.now() - startTime - classicTime;
			const totalTime = Date.now() - startTime;

			this.logger.logPerformance("Enhanced stock selection", totalTime, requestId, {
				symbolCount: request.symbols.length,
				classicTime,
				mlTime,
				mlEnabled: true,
			});

			return {
				success: true,
				results: enhancedResults,
				mlEnabled: true,
				mlFallbackUsed: false,
				metadata: {
					timestamp: Date.now(),
					processingTime: totalTime,
					classicAnalysisTime: classicTime,
					mlEnhancementTime: mlTime,
					cacheHitRate: 0, // TODO: Calculate from actual cache usage
				},
			};
		} catch (error) {
			this.logger.error("ML enhancement failed", { error, requestId });

			// Graceful fallback to classic results
			if (this.config.fallbackToClassic) {
				this.activateDegradation("complete", ["MLEnhancementService"], "classic");
				return this.createClassicOnlyResponse(classicResults, startTime, error);
			}

			return {
				success: false,
				results: [],
				mlEnabled: false,
				mlFallbackUsed: true,
				metadata: {
					timestamp: Date.now(),
					processingTime: Date.now() - startTime,
					classicAnalysisTime: Date.now() - startTime,
					mlEnhancementTime: 0,
					cacheHitRate: 0,
				},
				error: error instanceof Error ? error.message : "ML enhancement failed",
			};
		}
	}

	/**
	 * Enhance a single stock with ML predictions
	 */
	private async enhanceSingleStock(
		classicResult: any,
		modelIds: string[],
		horizon: MLPredictionHorizon,
		confidenceThreshold: number,
		requestId?: string
	): Promise<EnhancedStockResult> {
		try {
			const symbol = classicResult.symbol;

			// Get ML prediction using enhanceVFRScore method
			const mlResult = await this.predictionService.enhanceVFRScore(
				symbol,
				classicResult.totalScore || 0,
				{
					technical: { score: classicResult.technicalScore || 0 },
					fundamental: { score: classicResult.fundamentalScore || 0 },
					sentiment: { score: classicResult.sentimentScore || 0 },
					macro: { score: classicResult.macroScore || 0 },
				}
			);

			// If prediction failed, return classic result without ML
			if (mlResult.fallbackUsed || mlResult.mlContribution === 0) {
				return this.convertToEnhancedResult(classicResult, null);
			}

			// Create prediction object from ML result
			const prediction: any = {
				symbol,
				modelId: "ml-prediction-service",
				modelVersion: "1.0.0",
				horizon: horizon,
				prediction: {
					direction:
						mlResult.mlContribution > 0
							? ("BUY" as const)
							: mlResult.mlContribution < 0
								? ("SELL" as const)
								: ("HOLD" as const),
					confidence: mlResult.confidence,
					expectedReturn: mlResult.mlContribution,
					probability: mlResult.confidence,
				},
				features: {
					symbol,
					features: {},
					featureNames: [],
					timestamp: Date.now(),
					completeness: 1.0,
					qualityScore: mlResult.confidence,
				},
				timestamp: Date.now(),
				expiresAt: Date.now() + 300000, // 5 minutes
			};

			// Check confidence threshold
			if (prediction.prediction.confidence < confidenceThreshold) {
				this.logger.debug("ML prediction below confidence threshold", {
					symbol,
					confidence: prediction.prediction.confidence,
					threshold: confidenceThreshold,
				});
				return this.convertToEnhancedResult(classicResult, null);
			}

			// Calculate ML contribution
			const mlScore = this.calculateMLScore(prediction);
			const mlContribution = mlScore * this.config.mlWeight;

			// Combine classic and ML scores
			const classicScore = classicResult.totalScore || 0;
			const classicContribution = classicScore * this.config.classicWeight;
			const finalScore = classicContribution + mlContribution;

			// Determine final recommendation
			const finalRecommendation = this.determineRecommendation(finalScore);
			const finalConfidence = this.calculateCombinedConfidence(
				classicResult.confidence || 0.5,
				prediction.prediction.confidence
			);

			return {
				symbol,
				classicScore: {
					totalScore: classicScore,
					recommendation: classicResult.recommendation || "HOLD",
					confidence: classicResult.confidence || 0.5,
					technicalScore: classicResult.technicalScore || 0,
					fundamentalScore: classicResult.fundamentalScore || 0,
					sentimentScore: classicResult.sentimentScore || 0,
					macroScore: classicResult.macroScore || 0,
					alternativeScore: classicResult.alternativeScore || 0,
				},
				mlEnhancement: {
					mlScore,
					prediction,
					confidence: prediction.prediction.confidence,
					expectedReturn: prediction.prediction.expectedReturn,
					modelContribution: mlContribution,
				},
				finalScore,
				finalRecommendation,
				finalConfidence,
				reasoning: this.generateReasoning(classicResult, prediction),
				riskLevel: this.calculateRiskLevel(finalScore, finalConfidence),
				timestamp: Date.now(),
			};
		} catch (error) {
			this.logger.error("Single stock enhancement failed", {
				symbol: classicResult.symbol,
				error,
			});
			return this.convertToEnhancedResult(classicResult, null);
		}
	}

	/**
	 * Get service health status
	 */
	public async getHealthStatus(): Promise<MLHealthStatus> {
		try {
			const predictionHealth = await this.predictionService.healthCheck();

			return {
				status: this.degradationStatus.isDegraded ? "degraded" : "healthy",
				services: {
					predictionService: predictionHealth.components.featureService || false,
					featureService: predictionHealth.components.featureService || false,
					modelManager: predictionHealth.components.mlStore || false,
					enhancementService: !this.degradationStatus.isDegraded,
				},
				metrics: {
					avgLatency: 0, // TODO: Calculate from actual metrics
					cacheHitRate: 0, // TODO: Calculate from actual metrics
					errorRate: 0, // TODO: Calculate from actual metrics
					activeModels: this.modelManager.listModels({ status: "ACTIVE" as any }).length,
				},
				lastCheck: Date.now(),
			};
		} catch (error) {
			this.logger.error("Health check failed", { error });
			return {
				status: "unavailable",
				services: {
					predictionService: false,
					featureService: false,
					modelManager: false,
					enhancementService: false,
				},
				metrics: {
					avgLatency: 0,
					cacheHitRate: 0,
					errorRate: 1,
					activeModels: 0,
				},
				lastCheck: Date.now(),
			};
		}
	}

	/**
	 * Get degradation status
	 */
	public getDegradationStatus(): DegradationStatus {
		return { ...this.degradationStatus };
	}

	/**
	 * Update configuration
	 */
	public updateConfig(newConfig: Partial<MLEnhancementServiceConfig>): void {
		this.config = { ...this.config, ...newConfig };
		this.logger.info("Configuration updated", { config: this.config });
	}

	// Private helper methods

	private createClassicOnlyResponse(
		classicResults: any[],
		startTime: number,
		error?: any
	): EnhancedStockSelectionResponse {
		const enhancedResults = classicResults.map(result =>
			this.convertToEnhancedResult(result, null)
		);

		return {
			success: true,
			results: enhancedResults,
			mlEnabled: false,
			mlFallbackUsed: !!error,
			metadata: {
				timestamp: Date.now(),
				processingTime: Date.now() - startTime,
				classicAnalysisTime: Date.now() - startTime,
				mlEnhancementTime: 0,
				cacheHitRate: 0,
			},
			error: error ? (error instanceof Error ? error.message : "ML unavailable") : undefined,
		};
	}

	private convertToEnhancedResult(classicResult: any, mlPrediction: any): EnhancedStockResult {
		const score = classicResult.totalScore || 0;

		return {
			symbol: classicResult.symbol,
			classicScore: {
				totalScore: score,
				recommendation: classicResult.recommendation || "HOLD",
				confidence: classicResult.confidence || 0.5,
				technicalScore: classicResult.technicalScore || 0,
				fundamentalScore: classicResult.fundamentalScore || 0,
				sentimentScore: classicResult.sentimentScore || 0,
				macroScore: classicResult.macroScore || 0,
				alternativeScore: classicResult.alternativeScore || 0,
			},
			mlEnhancement: mlPrediction
				? {
						mlScore: 0,
						prediction: mlPrediction,
						confidence: mlPrediction.prediction.confidence,
						expectedReturn: mlPrediction.prediction.expectedReturn,
						modelContribution: 0,
					}
				: undefined,
			finalScore: score,
			finalRecommendation: classicResult.recommendation || "HOLD",
			finalConfidence: classicResult.confidence || 0.5,
			reasoning: classicResult.reasoning || [],
			riskLevel: this.calculateRiskLevel(score, classicResult.confidence || 0.5),
			timestamp: Date.now(),
		};
	}

	private calculateMLScore(prediction: any): number {
		// Convert prediction to 0-100 score
		// Placeholder logic - will be refined with actual models
		const direction = prediction.prediction.direction;
		const confidence = prediction.prediction.confidence;

		if (direction === "BUY") {
			return 50 + 50 * confidence;
		} else if (direction === "SELL") {
			return 50 - 50 * confidence;
		}
		return 50; // HOLD
	}

	private determineRecommendation(score: number): "BUY" | "SELL" | "HOLD" {
		if (score >= 70) return "BUY";
		if (score <= 30) return "SELL";
		return "HOLD";
	}

	private calculateCombinedConfidence(classicConfidence: number, mlConfidence: number): number {
		// Weighted average of confidences
		return classicConfidence * this.config.classicWeight + mlConfidence * this.config.mlWeight;
	}

	private calculateRiskLevel(score: number, confidence: number): "LOW" | "MEDIUM" | "HIGH" {
		if (confidence > 0.7) return "LOW";
		if (confidence > 0.4) return "MEDIUM";
		return "HIGH";
	}

	private generateReasoning(classicResult: any, prediction: any): string[] {
		const reasoning: string[] = [];

		// Add classic reasoning
		if (classicResult.reasoning && Array.isArray(classicResult.reasoning)) {
			reasoning.push(...classicResult.reasoning);
		}

		// Add ML reasoning
		if (prediction) {
			reasoning.push(
				`ML prediction: ${prediction.prediction.direction} with ${(prediction.prediction.confidence * 100).toFixed(1)}% confidence`
			);
			if (prediction.prediction.expectedReturn !== 0) {
				reasoning.push(
					`Expected return: ${(prediction.prediction.expectedReturn * 100).toFixed(2)}%`
				);
			}
		}

		return reasoning;
	}

	private activateDegradation(
		type: "none" | "partial" | "complete",
		services: string[],
		strategy: string
	): void {
		this.degradationStatus = {
			isDegraded: type !== "none",
			degradationType: type,
			affectedServices: services,
			fallbackActive: type !== "none",
			fallbackStrategy: strategy,
			degradationStarted: type !== "none" ? Date.now() : undefined,
			estimatedRecovery: type !== "none" ? Date.now() + 300000 : undefined, // 5 minutes
		};

		this.logger.warn("Degradation status changed", this.degradationStatus);
	}

	/**
	 * Reset service state (for testing/maintenance)
	 */
	public reset(): void {
		this.degradationStatus = {
			isDegraded: false,
			degradationType: "none",
			affectedServices: [],
			fallbackActive: false,
			fallbackStrategy: "none",
		};
		this.logger.info("Service reset");
	}
}

export default MLEnhancementService;
