/**
 * ML-Enhanced Stock Selection Service - Phase 4.1
 *
 * Extends StockSelectionService with optional ML enhancement layer.
 * Provides parallel execution of VFR analysis + ML predictions with graceful fallback.
 *
 * Key Features:
 * - Optional ML enhancement (via include_ml parameter)
 * - Parallel VFR + ML execution (<100ms ML overhead target)
 * - ML-enhanced composite scoring (90% VFR + 10% ML)
 * - Enhanced recommendation generation with ML insights
 * - Confidence scoring integration
 * - Risk assessment enhancement
 * - Graceful fallback to pure VFR on ML failure
 * - Zero breaking changes to existing StockSelectionService
 *
 * Philosophy: KISS - Keep It Simple, Stupid
 * - Extend, don't replace existing functionality
 * - ML is optional enhancement, not requirement
 * - Always fallback to VFR if ML unavailable
 */

import { StockSelectionService } from "./StockSelectionService";
import { SelectionRequest, SelectionResponse, EnhancedStockResult } from "./types";
import { EnhancedScoringEngine, EnhancedScoreResult } from "./EnhancedScoringEngine";
import { RealTimePredictionEngine, PredictionResult } from "../ml/prediction/RealTimePredictionEngine";
import { MLPredictionHorizon, MLFeatureVector } from "../ml/types/MLTypes";
import { Logger } from "../error-handling/Logger";
import { ErrorHandler } from "../error-handling/ErrorHandler";
import { FinancialDataService } from "../financial-data/FinancialDataService";
import { FactorLibrary } from "../algorithms/FactorLibrary";
import { RedisCache } from "../cache/RedisCache";
import { TechnicalIndicatorService } from "../technical-analysis/TechnicalIndicatorService";
import { MacroeconomicAnalysisService } from "../financial-data/MacroeconomicAnalysisService";
import SentimentAnalysisService from "../financial-data/SentimentAnalysisService";
import { VWAPService } from "../financial-data/VWAPService";
import ESGDataService from "../financial-data/ESGDataService";
import ShortInterestService from "../financial-data/ShortInterestService";
import { ExtendedMarketDataService } from "../financial-data/ExtendedMarketDataService";
import { InstitutionalDataService } from "../financial-data/InstitutionalDataService";
import { OptionsDataService } from "../financial-data/OptionsDataService";
import { MLPredictionService } from "../ml/prediction/MLPredictionService";
import { StockScore } from "../algorithms/types";
import { EarlySignalFeatureExtractor } from "../ml/early-signal/FeatureExtractor";
import { PredictionLogger } from "../ml/prediction/PredictionLogger";

// ===== ML Enhancement Options =====

export interface MLEnhancementOptions {
	include_ml?: boolean; // Enable ML enhancement (default: false)
	ml_horizon?: MLPredictionHorizon; // Prediction horizon (default: ONE_WEEK)
	ml_confidence_threshold?: number; // Minimum confidence (default: 0.5)
	ml_weight?: number; // ML weight in composite score (default: 0.15)
	ml_timeout?: number; // ML prediction timeout ms (default: 100ms)
}

// ===== ML Enhancement Metadata =====

export interface MLEnhancementMetadata {
	mlEnabled: boolean;
	mlAvailable: boolean;
	mlLatency: number;
	mlPredictionsCount: number;
	mlFallbackUsed: boolean;
	mlEnhancementApplied: boolean;
	mlAverageConfidence?: number;
}

/**
 * MLEnhancedStockSelectionService
 *
 * Extends StockSelectionService with ML prediction enhancement.
 * Maintains 100% backward compatibility with existing API.
 */
export class MLEnhancedStockSelectionService extends StockSelectionService {
	private mlPredictionEngine: RealTimePredictionEngine;
	private enhancedScoringEngine: EnhancedScoringEngine;
	private featureExtractor: EarlySignalFeatureExtractor;
	private predictionLogger: PredictionLogger;
	private mlLogger: Logger;
	private mlErrorHandler: ErrorHandler;

	constructor(
		financialDataService: FinancialDataService,
		factorLibrary: FactorLibrary,
		cache: RedisCache,
		technicalService?: TechnicalIndicatorService,
		macroeconomicService?: MacroeconomicAnalysisService,
		sentimentService?: SentimentAnalysisService,
		vwapService?: VWAPService,
		esgService?: ESGDataService,
		shortInterestService?: ShortInterestService,
		extendedMarketService?: ExtendedMarketDataService,
		institutionalService?: InstitutionalDataService,
		optionsService?: OptionsDataService,
		mlPredictionService?: MLPredictionService
	) {
		// Call parent constructor
		super(
			financialDataService,
			factorLibrary,
			cache,
			technicalService,
			macroeconomicService,
			sentimentService,
			vwapService,
			esgService,
			shortInterestService,
			extendedMarketService,
			institutionalService,
			optionsService,
			mlPredictionService
		);

		// Initialize ML components
		this.mlLogger = Logger.getInstance("MLEnhancedStockSelectionService");
		this.mlErrorHandler = ErrorHandler.getInstance();
		this.mlPredictionEngine = RealTimePredictionEngine.getInstance();
		this.featureExtractor = new EarlySignalFeatureExtractor();
		this.predictionLogger = PredictionLogger.getInstance();
		this.enhancedScoringEngine = new EnhancedScoringEngine({
			vfrWeight: 0.85, // 85% VFR
			mlWeight: 0.15, // 15% ML
			minConfidenceThreshold: 0.5,
			confidenceWeightingEnabled: true,
			normalizeToHundred: false, // Keep 0-1 scale for consistency
		});

		this.mlLogger.info("MLEnhancedStockSelectionService initialized with prediction logging");
	}

	/**
	 * Override selectStocks to add ML enhancement
	 *
	 * Executes classic VFR analysis, then optionally enhances with ML predictions.
	 * Falls back gracefully to pure VFR if ML fails or is disabled.
	 */
	async selectStocks(request: SelectionRequest): Promise<SelectionResponse> {
		const mlOptions = this.extractMLOptions(request);

		// If ML not enabled, use parent implementation
		if (!mlOptions.include_ml) {
			this.mlLogger.debug("ML enhancement disabled, using classic VFR analysis");
			return super.selectStocks(request);
		}

		const mlStartTime = Date.now();
		const mlMetadata: MLEnhancementMetadata = {
			mlEnabled: true,
			mlAvailable: false,
			mlLatency: 0,
			mlPredictionsCount: 0,
			mlFallbackUsed: false,
			mlEnhancementApplied: false,
		};

		try {
			this.mlLogger.info(
				`ML enhancement enabled for request: ${request.scope.symbols?.join(", ") || "sector analysis"}`
			);

			// Initialize ML prediction engine
			const initResult = await this.mlPredictionEngine.initialize();
			if (!initResult.success) {
				this.mlLogger.warn("ML prediction engine initialization failed, falling back to VFR");
				mlMetadata.mlFallbackUsed = true;
				return super.selectStocks(request);
			}

			mlMetadata.mlAvailable = true;

			// Execute classic VFR analysis (parent implementation)
			const vfrResponse = await super.selectStocks(request);

			if (!vfrResponse.success) {
				// VFR analysis failed, return error (don't try ML)
				return vfrResponse;
			}

			// Extract symbols from response
			const symbols = this.extractSymbolsFromResponse(vfrResponse);

			if (symbols.length === 0) {
				this.mlLogger.warn("No symbols to enhance with ML predictions");
				return vfrResponse;
			}

			// Fetch ML predictions in parallel with timeout
			const mlPredictions = await this.fetchMLPredictionsWithTimeout(
				symbols,
				mlOptions
			);

			mlMetadata.mlPredictionsCount = mlPredictions.size;
			mlMetadata.mlLatency = Date.now() - mlStartTime;

			// Check if we got any ML predictions
			if (mlPredictions.size === 0) {
				this.mlLogger.warn("No ML predictions received, returning pure VFR results");
				mlMetadata.mlFallbackUsed = true;
				return this.addMLMetadata(vfrResponse, mlMetadata);
			}

			// Enhance VFR results with ML predictions
			const enhancedResponse = this.enhanceResponseWithML(
				vfrResponse,
				mlPredictions,
				mlOptions
			);

			mlMetadata.mlEnhancementApplied = true;
			mlMetadata.mlAverageConfidence = this.calculateAverageConfidence(mlPredictions);

			this.mlLogger.info(
				`ML enhancement completed: ${mlPredictions.size} predictions, ${mlMetadata.mlLatency}ms latency`
			);

			return this.addMLMetadata(enhancedResponse, mlMetadata);
		} catch (error) {
			this.mlLogger.error(
				`ML enhancement failed: ${error instanceof Error ? error.message : "Unknown error"}`
			);
			mlMetadata.mlFallbackUsed = true;
			mlMetadata.mlLatency = Date.now() - mlStartTime;

			// Fallback to pure VFR
			const vfrResponse = await super.selectStocks(request);
			return this.addMLMetadata(vfrResponse, mlMetadata);
		}
	}

	/**
	 * Extract ML options from selection request
	 */
	private extractMLOptions(request: SelectionRequest): MLEnhancementOptions {
		const options = request.options as any;

		return {
			include_ml: options?.include_ml ?? false,
			ml_horizon: options?.ml_horizon ?? MLPredictionHorizon.ONE_WEEK,
			ml_confidence_threshold: options?.ml_confidence_threshold ?? 0.5,
			ml_weight: options?.ml_weight ?? 0.15,
			ml_timeout: options?.ml_timeout ?? 5000, // Increased from 100ms to 5000ms to allow Python server initialization
		};
	}

	/**
	 * Extract symbols from SelectionResponse
	 */
	private extractSymbolsFromResponse(response: SelectionResponse): string[] {
		const symbols: string[] = [];

		if (response.singleStock) {
			symbols.push(response.singleStock.symbol);
		}

		if (response.multiStockAnalysis?.results) {
			symbols.push(...response.multiStockAnalysis.results.map(r => r.symbol));
		}

		if (response.sectorAnalysis?.topSelections) {
			symbols.push(...response.sectorAnalysis.topSelections.map(r => r.symbol));
		}

		if (response.topSelections) {
			symbols.push(...response.topSelections.map(r => r.symbol));
		}

		// Deduplicate
		return [...new Set(symbols)];
	}

	/**
	 * Fetch ML predictions with timeout protection
	 */
	private async fetchMLPredictionsWithTimeout(
		symbols: string[],
		options: MLEnhancementOptions
	): Promise<Map<string, PredictionResult>> {
		const predictions = new Map<string, PredictionResult>();

		try {
			// Extract features for all symbols
			this.mlLogger.debug(`Extracting features for ${symbols.length} symbols`);
			const featureExtractionStart = Date.now();

			const featurePromises = symbols.map(async (symbol) => {
				try {
					const features = await this.featureExtractor.extractFeatures(symbol);
					return { symbol, features };
				} catch (error) {
					this.mlLogger.warn(`Feature extraction failed for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
					return null;
				}
			});

			const featureResults = await Promise.all(featurePromises);
			const featureExtractionTime = Date.now() - featureExtractionStart;
			this.mlLogger.debug(`Feature extraction completed in ${featureExtractionTime}ms`);

			// Convert to MLFeatureVector format and make predictions
			const predictionPromises = featureResults
				.filter((result): result is { symbol: string; features: any } => result !== null)
				.map(async ({ symbol, features }) => {
					try {
						// Convert FeatureVector to MLFeatureVector format
						const mlFeatureVector: MLFeatureVector = {
							symbol,
							features: features as Record<string, number>,
							featureNames: Object.keys(features),
							timestamp: Date.now(),
							completeness: 1.0,
							qualityScore: 1.0,
						};

						// Make prediction with features
						const result = await this.mlPredictionEngine.predict({
							symbol,
							horizon: options.ml_horizon,
							confidenceThreshold: options.ml_confidence_threshold,
							features: mlFeatureVector,
						});

						if (result.success && result.data) {
							return { symbol, prediction: result.data };
						}
						return null;
					} catch (error) {
						this.mlLogger.warn(`Prediction failed for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
						return null;
					}
				});

			const predictionResults = await Promise.race([
				Promise.all(predictionPromises),
				this.createTimeoutPromise(options.ml_timeout || 100),
			]);

			if (predictionResults && Array.isArray(predictionResults)) {
				for (const result of predictionResults) {
					if (result) {
						predictions.set(result.symbol, result.prediction);
					}
				}

				this.mlLogger.debug(`Fetched ${predictions.size}/${symbols.length} ML predictions`);
			} else {
				this.mlLogger.warn("ML prediction timeout");
			}
		} catch (error) {
			this.mlLogger.warn(
				`ML prediction fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}

		return predictions;
	}

	/**
	 * Create timeout promise
	 */
	private createTimeoutPromise(timeoutMs: number): Promise<never> {
		return new Promise((_, reject) => {
			setTimeout(() => reject(new Error(`ML prediction timeout (${timeoutMs}ms)`)), timeoutMs);
		});
	}

	/**
	 * Enhance VFR response with ML predictions
	 */
	private enhanceResponseWithML(
		vfrResponse: SelectionResponse,
		mlPredictions: Map<string, PredictionResult>,
		options: MLEnhancementOptions
	): SelectionResponse {
		// Update scoring engine weights if custom weight provided
		if (options.ml_weight && options.ml_weight !== 0.15) {
			this.enhancedScoringEngine.updateConfig({
				mlWeight: options.ml_weight,
				vfrWeight: 1.0 - options.ml_weight,
			});
		}

		// Enhance single stock result
		if (vfrResponse.singleStock) {
			vfrResponse.singleStock = this.enhanceSingleStockWithML(
				vfrResponse.singleStock,
				mlPredictions
			);
		}

		// Enhance multi-stock results
		if (vfrResponse.multiStockAnalysis?.results) {
			vfrResponse.multiStockAnalysis.results =
				vfrResponse.multiStockAnalysis.results.map(result =>
					this.enhanceSingleStockWithML(result, mlPredictions)
				);
		}

		// Enhance sector analysis results
		if (vfrResponse.sectorAnalysis?.topSelections) {
			vfrResponse.sectorAnalysis.topSelections =
				vfrResponse.sectorAnalysis.topSelections.map(result =>
					this.enhanceSingleStockWithML(result, mlPredictions)
				);
		}

		// Enhance top selections
		if (vfrResponse.topSelections) {
			vfrResponse.topSelections = vfrResponse.topSelections.map(result =>
				this.enhanceSingleStockWithML(result, mlPredictions)
			);
		}

		return vfrResponse;
	}

	/**
	 * Enhance single stock result with ML prediction
	 */
	private enhanceSingleStockWithML(
		stock: EnhancedStockResult,
		mlPredictions: Map<string, PredictionResult>
	): EnhancedStockResult {
		const mlPrediction = mlPredictions.get(stock.symbol);

		if (!mlPrediction) {
			// No ML prediction available, return unchanged
			return stock;
		}

		// Calculate enhanced score
		const enhancedScore = this.enhancedScoringEngine.calculateEnhancedScore(
			stock.score,
			mlPrediction
		);

		// Log prediction to database for outcome tracking (async, don't wait)
		this.logPredictionAsync(stock, mlPrediction, enhancedScore.finalScore);

		// Update stock score with ML-enhanced composite score
		const enhancedStockScore: StockScore = {
			...stock.score,
			overallScore: enhancedScore.finalScore,
			algorithmMetrics: {
				...stock.score.algorithmMetrics,
				ml_enhanced: {
					score: enhancedScore.finalScore,
					// Store ML enhancement details in metadata (not in standard algorithmMetrics structure)
				},
			},
		};

		// Update reasoning with ML insights
		const enhancedReasoning = {
			...stock.reasoning,
			primaryFactors: [
				...stock.reasoning.primaryFactors,
				...this.generateMLInsights(mlPrediction, enhancedScore),
			],
		};

		return {
			...stock,
			score: enhancedStockScore,
			reasoning: enhancedReasoning,
			confidence: Math.max(stock.confidence, mlPrediction.confidence), // Use higher confidence
			mlPrediction, // Attach ML prediction for serialization
		};
	}

	/**
	 * Log prediction to database (async, fire-and-forget)
	 */
	private logPredictionAsync(
		stock: EnhancedStockResult,
		prediction: PredictionResult,
		enhancedScore: number
	): void {
		// Get current price from stock context
		const currentPrice = stock.context?.currentPrice || 0;

		// Convert prediction to log entry
		const logEntry = this.predictionLogger.convertPredictionToLogEntry(
			stock.symbol,
			prediction,
			{
				currentPrice,
				baseVfrScore: stock.score.overallScore,
				enhancedScore,
				executionTimeMs: prediction.latency,
				cacheHit: false,
				tierUsed: 'free'
			}
		);

		// Log async (don't wait)
		this.predictionLogger.logPrediction(logEntry).catch(error => {
			this.mlLogger.warn(
				`Failed to log prediction for ${stock.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		});
	}

	/**
	 * Generate ML insights for reasoning
	 */
	private generateMLInsights(
		mlPrediction: PredictionResult,
		enhancedScore: EnhancedScoreResult
	): string[] {
		const insights: string[] = [];

		// ML direction insight
		if (mlPrediction.direction === "UP") {
			insights.push(
				`ML predicts upward movement (${(mlPrediction.confidence * 100).toFixed(0)}% confidence)`
			);
		} else if (mlPrediction.direction === "DOWN") {
			insights.push(
				`ML predicts downward movement (${(mlPrediction.confidence * 100).toFixed(0)}% confidence)`
			);
		}

		// Enhancement impact
		if (enhancedScore.enhancement > 0.05) {
			insights.push(
				`ML enhancement boosted score by ${(enhancedScore.enhancement * 100).toFixed(1)}%`
			);
		} else if (enhancedScore.enhancement < -0.05) {
			insights.push(
				`ML enhancement reduced score by ${(Math.abs(enhancedScore.enhancement) * 100).toFixed(1)}%`
			);
		}

		return insights;
	}

	/**
	 * Calculate average ML confidence
	 */
	private calculateAverageConfidence(predictions: Map<string, PredictionResult>): number {
		if (predictions.size === 0) return 0;

		let totalConfidence = 0;
		for (const prediction of predictions.values()) {
			totalConfidence += prediction.confidence;
		}

		return totalConfidence / predictions.size;
	}

	/**
	 * Add ML metadata to response
	 */
	private addMLMetadata(
		response: SelectionResponse,
		mlMetadata: MLEnhancementMetadata
	): SelectionResponse {
		// Add ML metadata to response (cast to any to avoid type error)
		// In production, extend SelectionResponse type to include mlEnhancement
		return {
			...response,
			metadata: {
				...response.metadata,
				mlEnhancement: mlMetadata,
			} as any,
		};
	}

	/**
	 * Health check for ML enhancement layer
	 */
	public async mlHealthCheck(): Promise<{
		healthy: boolean;
		mlEngineAvailable: boolean;
		scoringEngineAvailable: boolean;
		issues: string[];
	}> {
		const issues: string[] = [];

		// Check ML prediction engine
		const mlEngineHealth = await this.mlPredictionEngine.healthCheck();
		if (!mlEngineHealth.healthy) {
			issues.push("ML prediction engine unhealthy");
		}

		// Check scoring engine
		const scoringEngineAvailable = !!this.enhancedScoringEngine;
		if (!scoringEngineAvailable) {
			issues.push("Enhanced scoring engine not available");
		}

		return {
			healthy: issues.length === 0,
			mlEngineAvailable: mlEngineHealth.healthy,
			scoringEngineAvailable,
			issues,
		};
	}
}
