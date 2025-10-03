/**
 * Data transformation utilities for Stock Analysis Dialog
 * Bridges the gap between DetailedStockResult and component-specific interfaces
 */

import type { DialogStockData, DialogStockScore } from "../types/dialog-types";

// Define the main modal's data structure
interface DetailedStockResult {
	symbol: string;
	score: {
		symbol: string;
		overallScore: number;
		factorScores: {
			composite: number;
			technical_overall_score: number;
			quality_composite: number;
			momentum_composite: number;
			value_composite: number;
			volatility_30d: number;
			sentiment_composite: number;
			vwap_deviation_score: number;
			vwap_trading_signals: number;
			macroeconomic_sector_impact: number;
			macroeconomic_composite: number;
		};
		dataQuality: {
			overall: number;
			metrics: {
				freshness: number;
				completeness: number;
				accuracy: number;
				sourceReputation: number;
				latency: number;
			};
			timestamp: number;
			source: string;
		};
		timestamp: number;
		marketData: {
			price: number;
			volume: number;
			marketCap: number;
			sector: string;
			exchange: string;
		};
		algorithmMetrics: {
			quality: {
				score: number;
			};
		};
	};
	weight: number;
	action: "BUY" | "SELL" | "HOLD";
	confidence: number;
	context: {
		sector: string;
		marketCap: number;
		priceChange24h?: number;
		volumeChange24h?: number;
		beta?: number;
	};
	reasoning: {
		primaryFactors: string[];
		warnings?: string[];
		opportunities?: string[];
	};
	dataQuality: {
		overall: {
			overall: number;
			metrics: {
				freshness: number;
				completeness: number;
				accuracy: number;
				sourceReputation: number;
				latency: number;
			};
			timestamp: number;
			source: string;
		};
		sourceBreakdown?: {
			stockPrice?: string;
			companyInfo?: string;
			marketData?: string;
			fundamentalRatios?: string;
			analystRatings?: string;
			priceTargets?: string;
			vwapAnalysis?: string;
			extendedHoursData?: string;
		};
		lastUpdated: number;
	};
}

/**
 * Transform DetailedStockResult to DialogStockData format
 */
export const transformToDialogStockData = (stockData: DetailedStockResult): DialogStockData => {
	return {
		symbol: stockData.symbol,
		score: {
			overall: stockData.score.overallScore,
			technical: stockData.score.factorScores.technical_overall_score,
			fundamental: stockData.score.factorScores.quality_composite,
			sentiment: stockData.score.factorScores.sentiment_composite,
			macro: stockData.score.factorScores.macroeconomic_composite,
			alternative: stockData.score.factorScores.volatility_30d, // Using volatility as alternative data proxy
		},
		weight: stockData.weight,
		action: stockData.action,
		confidence: stockData.confidence,
		context: stockData.context,
		reasoning: stockData.reasoning,
		dataQuality: stockData.dataQuality,
		sentimentBreakdown: {
			newsScore: stockData.score.factorScores.sentiment_composite * 0.6, // Approximate news component
			redditScore: stockData.score.factorScores.sentiment_composite * 0.3, // Approximate reddit component
			analystScore: stockData.score.factorScores.sentiment_composite * 0.1, // Approximate analyst component
		},
	};
};

/**
 * Transform score data for ScoreVisualization component
 */
export const transformToScoreVisualizationProps = (stockData: DetailedStockResult) => {
	return {
		scores: {
			overall: stockData.score.overallScore,
			technical: stockData.score.factorScores.technical_overall_score,
			fundamental: stockData.score.factorScores.quality_composite,
			sentiment: stockData.score.factorScores.sentiment_composite,
			macro: stockData.score.factorScores.macroeconomic_composite,
			alternative: stockData.score.factorScores.volatility_30d,
		},
		symbol: stockData.symbol,
	};
};

/**
 * Transform data for RisksOpportunities component
 */
export const transformToRisksOpportunitiesProps = (stockData: DetailedStockResult) => {
	return {
		risks: stockData.reasoning.warnings || [
			"Market volatility may impact performance",
			"Sector-specific regulatory risks",
			"General economic headwinds",
		],
		opportunities: stockData.reasoning.opportunities || [
			"Strong fundamental metrics indicate growth potential",
			"Technical indicators show positive momentum",
			"Market sentiment trending favorably",
		],
	};
};

/**
 * Transform data for DialogFooter component
 */
export const transformToDialogFooterProps = (
	stockData: DetailedStockResult,
	onAction?: (action: "BUY" | "SELL" | "HOLD", symbol: string) => void,
	onClose?: () => void
) => {
	return {
		lastUpdated: stockData.dataQuality.lastUpdated,
		onAction: onAction
			? (action: "BUY" | "SELL" | "HOLD") => onAction(action, stockData.symbol)
			: undefined,
		symbol: stockData.symbol,
		recommendation: stockData.action,
		onClose: onClose || (() => {}),
	};
};

/**
 * Safe data accessor with fallbacks
 */
export const safeGetProperty = <T>(obj: any, path: string[], fallback: T): T => {
	try {
		return path.reduce((current, key) => current?.[key], obj) ?? fallback;
	} catch {
		return fallback;
	}
};

/**
 * Validate data structure before component rendering
 */
export const validateStockData = (stockData: any): stockData is DetailedStockResult => {
	if (!stockData || typeof stockData !== "object") {
		console.warn("StockData validation failed: Invalid or missing data object");
		return false;
	}

	const requiredFields = [
		"symbol",
		"score.overallScore",
		"score.factorScores",
		"action",
		"confidence",
		"context.sector",
		"reasoning.primaryFactors",
	];

	for (const field of requiredFields) {
		if (safeGetProperty(stockData, field.split("."), null) === null) {
			console.warn(`StockData validation failed: Missing required field "${field}"`);
			return false;
		}
	}

	return true;
};

/**
 * Create fallback data structure for failed loads
 */
export const createFallbackStockData = (symbol: string): DetailedStockResult => {
	const timestamp = Date.now();

	return {
		symbol,
		score: {
			symbol,
			overallScore: 0.5,
			factorScores: {
				composite: 0.5,
				technical_overall_score: 0.5,
				quality_composite: 0.5,
				momentum_composite: 0.5,
				value_composite: 0.5,
				volatility_30d: 0.5,
				sentiment_composite: 0.5,
				vwap_deviation_score: 0.5,
				vwap_trading_signals: 0.5,
				macroeconomic_sector_impact: 0.5,
				macroeconomic_composite: 0.5,
			},
			dataQuality: {
				overall: 0.3,
				metrics: {
					freshness: 0.3,
					completeness: 0.3,
					accuracy: 0.3,
					sourceReputation: 0.3,
					latency: 0.3,
				},
				timestamp,
				source: "fallback",
			},
			timestamp,
			marketData: {
				price: 0,
				volume: 0,
				marketCap: 0,
				sector: "Unknown",
				exchange: "Unknown",
			},
			algorithmMetrics: {
				quality: {
					score: 0.3,
				},
			},
		},
		weight: 1,
		action: "HOLD" as const,
		confidence: 0.3,
		context: {
			sector: "Unknown",
			marketCap: 0,
		},
		reasoning: {
			primaryFactors: ["Data loading in progress", "Analysis pending"],
			warnings: ["Limited data available"],
			opportunities: ["Full analysis available after data load"],
		},
		dataQuality: {
			overall: {
				overall: 0.3,
				metrics: {
					freshness: 0.3,
					completeness: 0.3,
					accuracy: 0.3,
					sourceReputation: 0.3,
					latency: 0.3,
				},
				timestamp,
				source: "fallback",
			},
			lastUpdated: timestamp,
		},
	};
};
