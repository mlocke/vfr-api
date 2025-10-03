/**
 * ML Enhancement Types
 * Type definitions for ML enhancement database operations
 * Exported for reuse across ML services
 */

// Re-export the main types from MLEnhancementStore for convenience
export type { MLEnhancement, MLEnhancementUpdate } from "../database/MLEnhancementStore";

/**
 * Enhanced ML result with VFR integration
 */
export interface MLEnhancementResult {
	ticker: string;
	enhancementId: string;
	vfrFactorName: string;
	baseVfrValue: number;
	enhancedValue: number;
	enhancedCompositeValue: number;
	confidence: number;
	dataQuality: number;
	latencyMs: number;
	modelsUsed: string[];
	fallbackMode: boolean;
	timestamp: Date;
}

/**
 * ML Enhancement Configuration
 */
export interface MLEnhancementConfig {
	enhancementId: string;
	enhancementName: string;
	enhancementType:
		| "price_prediction"
		| "direction_classification"
		| "volatility_forecast"
		| "factor_enhancement"
		| "composite_enhancement";
	targetFactor?: "technical" | "fundamental" | "sentiment" | "macro" | "options" | "composite";
	predictionHorizon: "1h" | "4h" | "1d" | "1w" | "1m" | "3m";
	enhancementWeight: number;
	minConfidenceThreshold: number;
	isActive: boolean;
	tierRequirement: "free" | "premium" | "enterprise";
}

/**
 * ML Enhancement Request
 */
export interface MLEnhancementRequest {
	ticker: string;
	vfrFactorName: string;
	baseVfrValue: number;
	enhancementConfig: MLEnhancementConfig;
	requestTimestamp: Date;
}

/**
 * ML Enhancement Response
 */
export interface MLEnhancementResponse {
	success: boolean;
	result?: MLEnhancementResult;
	error?: string;
	fallbackReason?: string;
	processingTime: number;
}

/**
 * Batch ML Enhancement Request
 */
export interface BatchMLEnhancementRequest {
	tickers: string[];
	vfrFactorName: string;
	baseVfrValues: Record<string, number>;
	enhancementConfig: MLEnhancementConfig;
	requestTimestamp: Date;
}

/**
 * Batch ML Enhancement Response
 */
export interface BatchMLEnhancementResponse {
	success: boolean;
	results: Record<string, MLEnhancementResult>;
	errors: Record<string, string>;
	fallbacks: Record<string, string>;
	totalProcessingTime: number;
	successRate: number;
}
