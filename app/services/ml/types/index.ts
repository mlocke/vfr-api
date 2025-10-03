/**
 * ML Enhancement Types - Modular addition to VFR platform
 * Defines types for ML prediction engine that enhances existing VFR analysis
 */

// User tier management for ML features
export type MLTier = "free" | "premium" | "enterprise";

// Prediction horizons
export type PredictionHorizon = "1h" | "4h" | "1d" | "1w" | "1m" | "3m";

// Enhancement types
export type EnhancementType =
	| "price_prediction"
	| "direction_classification"
	| "volatility_forecast"
	| "factor_enhancement"
	| "composite_enhancement";

// VFR factors that can be enhanced
export type VFRFactor =
	| "technical"
	| "fundamental"
	| "sentiment"
	| "macro"
	| "options"
	| "composite";

// Ensemble methods
export type EnsembleMethod = "weighted" | "voting" | "stacking" | "meta_learning";

// Model types
export type ModelType =
	| "linear_regression"
	| "logistic_regression"
	| "random_forest"
	| "xgboost"
	| "lightgbm"
	| "lstm"
	| "transformer"
	| "ensemble";

// Model status
export type ModelStatus = "training" | "validated" | "deployed" | "shadow" | "deprecated";

// Prediction types
export type PredictionType = "price_target" | "direction" | "volatility" | "probability";

// JWT Claims extension for ML
export interface MLJWTClaims {
	ml_tier: MLTier;
	ml_permissions: MLPermission[];
	rate_limits: {
		predictions_per_day: number;
		models_access: string[];
		batch_size_limit: number;
		max_symbols_per_request: number;
	};
}

export type MLPermission =
	| "predict:basic"
	| "predict:advanced"
	| "models:view"
	| "features:generate"
	| "backtest:run";

// ML Prediction Request
export interface MLPredictionRequest {
	symbols: string[];
	models?: string[];
	horizon?: PredictionHorizon;
	features?: string[];
	ensembleMethod?: EnsembleMethod;
	confidenceThreshold?: number;
	includeExplanation?: boolean;
}

// ML Prediction Response
export interface MLPredictionResponse {
	success: boolean;
	data: {
		predictions: StockPrediction[];
		metadata: PredictionMetadata;
		performance: PerformanceMetrics;
	};
	warnings?: string[];
	enhanced_with_ml: boolean;
	error?: APIError;
}

// Individual stock prediction
export interface StockPrediction {
	symbol: string;
	currentPrice: number;
	baseVFRScore?: number; // Original VFR score
	enhancedScore?: number; // Score with ML enhancement
	predictions: {
		[horizon: string]: {
			price: number;
			direction: "up" | "down" | "neutral";
			confidence: number;
			probability: number;
			expectedReturn: number;
			riskScore: number;
		};
	};
	modelContributions?: ModelContribution[];
	explanation?: PredictionExplanation;
}

// Model contribution tracking
export interface ModelContribution {
	modelId: string;
	modelName: string;
	weight: number;
	prediction: number;
	confidence: number;
}

// Prediction explanation
export interface PredictionExplanation {
	keyFactors: string[];
	positiveDrivers: string[];
	negativeDrivers: string[];
	riskFactors: string[];
	confidence: number;
}

// Metadata for predictions
export interface PredictionMetadata {
	analysisType: "vfr_classic" | "vfr_ml_enhanced";
	dataSourcesUsed: string[];
	analysisLatency: number;
	cacheHitRatio: number;
	fallbackMode: boolean;
	mlMetadata?: {
		modelsUsed: string[];
		featuresCount: number;
		mlLatency: number;
		ensembleMethod: string;
		mlConfidence: number;
	};
}

// Performance metrics
export interface PerformanceMetrics {
	totalLatency: number;
	featureExtractionMs: number;
	modelInferenceMs: number;
	ensembleCombinationMs: number;
	cacheHitRate: number;
}

// API Error structure
export interface APIError {
	code: string;
	message: string;
	details?: Record<string, any>;
	timestamp: number;
	fallbackAvailable?: boolean;
}

// ML Enhancement definition
export interface MLEnhancement {
	enhancementId: string;
	enhancementName: string;
	enhancementType: EnhancementType;
	targetFactor?: VFRFactor;
	predictionHorizon: PredictionHorizon;
	enhancementWeight: number; // Default 0.10 for 10% weight
	minConfidenceThreshold: number;
	tierRequirement: MLTier;
}

// Feature store entry
export interface FeatureStoreEntry {
	ticker: string;
	timestamp: Date;
	featureId: string;
	value: number;
	confidence: number;
	dataQuality: number;
	sourceProvider: string;
	validationStatus: "pending" | "valid" | "invalid" | "stale";
}

// ML Model definition
export interface MLModel {
	modelId: string;
	modelName: string;
	modelVersion: string;
	modelType: ModelType;
	objective: string;
	targetVariable: string;
	predictionHorizon: PredictionHorizon;
	validationScore: number;
	testScore: number;
	tierRequirement: MLTier;
	status: ModelStatus;
	createdAt: Date;
	updatedAt: Date;
}

// User ML Tier
export interface UserMLTier {
	userId: string;
	mlTier: MLTier;
	predictionsPerDay: number;
	maxSymbolsPerRequest: number;
	modelsAccess: string[];
	enhancementWeightOverride?: number;
	predictionsUsedToday: number;
	lastPredictionTimestamp?: Date;
	totalPredictionsLifetime: number;
	isActive: boolean;
}

// ML Performance tracking
export interface MLPerformanceMetric {
	metricDate: Date;
	totalPredictions: number;
	successfulPredictions: number;
	fallbackPredictions: number;
	avgLatencyMs: number;
	p95LatencyMs: number;
	avgConfidenceScore: number;
	cacheHitRatio: number;
	directionAccuracy?: number;
	meanAbsoluteError?: number;
	freeTierPredictions: number;
	premiumTierPredictions: number;
	enterpriseTierPredictions: number;
}

// Rate limit result
export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetTime: number;
	retryAfter?: number;
}

// Validation result
export interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

// ML Error types
export enum MLErrorCode {
	MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE",
	FEATURE_GENERATION_FAILED = "FEATURE_GENERATION_FAILED",
	PREDICTION_TIMEOUT = "PREDICTION_TIMEOUT",
	INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
	RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
	UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
	VALIDATION_ERROR = "VALIDATION_ERROR",
}

// ML Error class
export class MLError extends Error {
	constructor(
		public code: MLErrorCode,
		message: string,
		public details?: Record<string, any>
	) {
		super(message);
		this.name = "MLError";
	}
}

// Cache configuration for ML
export interface MLCacheConfig {
	predictions: {
		ttl: number; // 5 minutes default
		keyPrefix: string;
	};
	features: {
		ttl: number; // 15 minutes default
		keyPrefix: string;
	};
	models: {
		ttl: number; // 1 hour default
		keyPrefix: string;
	};
}

// Feature configuration
export interface FeatureConfig {
	technical?: boolean;
	fundamental?: boolean;
	sentiment?: boolean;
	macro?: boolean;
	options?: boolean;
	custom?: string[];
}

// Feature vector (from FeatureEngineeringService)
export interface FeatureVector {
	symbol: string;
	timestamp: number;
	features: Record<string, number>;
	metadata: {
		sources: string[];
		confidence: number;
		staleness: number;
		completeness: number;
	};
}

// Enhanced stock analysis (extends VFR analysis)
export interface EnhancedStockAnalysis {
	// Existing VFR fields
	symbol: string;
	currentPrice: number;
	compositeScore: number; // VFR classic score
	recommendation: "BUY" | "SELL" | "HOLD";
	confidence: number;
	factors: {
		technical: number;
		fundamental: number;
		macroeconomic: number;
		sentiment: number;
		extendedMarket: number;
	};

	// ML enhancement fields (optional, only when ML enabled)
	mlEnhancement?: {
		enhancedScore: number; // Score with ML (90% VFR + 10% ML)
		mlContribution: number; // ML's contribution to score
		mlPrediction?: {
			[horizon: string]: {
				priceTarget: number;
				direction: "up" | "down" | "neutral";
				confidence: number;
				expectedReturn: number;
				riskScore: number;
			};
		};
		modelMetadata?: {
			modelsUsed: string[];
			ensembleMethod: string;
			predictionLatency: number;
			fallbackMode: boolean;
		};
		explanation?: {
			keyFactors: string[];
			riskFactors: string[];
			supportingEvidence: string[];
		};
	};
}

// Fallback configuration
export interface FallbackConfig {
	useCache: boolean;
	usePreviousWindow: boolean;
	useDefaultValues: boolean;
	maxRetries: number;
	retryDelayMs: number;
}
