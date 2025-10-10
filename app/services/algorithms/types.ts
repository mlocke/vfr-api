/**
 * Type definitions for Dynamic Stock Selection Algorithms
 * Integrates with existing DataFusionEngine for multi-source data quality
 */

import { FusedMCPResponse, QualityScore } from "../types/core-types";

/**
 * Core algorithm types and interfaces
 */
export enum AlgorithmType {
	MOMENTUM = "momentum",
	MEAN_REVERSION = "mean_reversion",
	QUALITY = "quality",
	VALUE = "value",
	GROWTH = "growth",
	DIVIDEND = "dividend",
	VOLATILITY = "volatility",
	COMPOSITE = "composite",
	CUSTOM = "custom",
}

export enum SelectionCriteria {
	SCORE_BASED = "score_based",
	RANK_BASED = "rank_based",
	QUANTILE_BASED = "quantile_based",
	THRESHOLD_BASED = "threshold_based",
}

export interface AlgorithmWeight {
	factor: string;
	weight: number;
	enabled: boolean;
	dynamicAdjustment?: {
		enabled: boolean;
		minWeight: number;
		maxWeight: number;
		adjustmentPeriod: number; // seconds
	};
}

export interface AlgorithmConfiguration {
	id: string;
	name: string;
	description: string;
	type: AlgorithmType;
	enabled: boolean;
	selectionCriteria: SelectionCriteria;

	// Core parameters
	universe: {
		sectors?: string[];
		marketCapMin?: number;
		marketCapMax?: number;
		exchanges?: string[];
		excludeSymbols?: string[];
		maxPositions: number;
	};

	// Algorithm weights
	weights: AlgorithmWeight[];

	// Selection parameters
	selection: {
		topN?: number;
		threshold?: number;
		quantile?: number;
		rebalanceFrequency: number; // seconds
		minHoldingPeriod: number; // seconds
	};

	// Risk management
	risk: {
		maxSectorWeight: number;
		maxSinglePosition: number;
		maxTurnover: number;
		stopLoss?: number;
		takeProfit?: number;
	};

	// Data fusion settings
	dataFusion: {
		minQualityScore: number;
		requiredSources: string[];
		conflictResolution: "highest_quality" | "consensus" | "weighted_average";
		cacheTTL: number;
	};

	// Performance tracking
	metadata: {
		createdAt: number;
		updatedAt: number;
		createdBy: string;
		version: number;
		backtestedFrom?: number;
		backtestedTo?: number;
		liveFrom?: number;
	};
}

/**
 * Stock scoring and ranking interfaces
 */
export interface StockScore {
	symbol: string;
	overallScore: number;
	factorScores: { [factor: string]: number };
	dataQuality: QualityScore;
	timestamp: number;

	// Supporting data
	marketData: {
		price: number;
		volume: number;
		marketCap: number;
		sector: string;
		exchange: string;
	};

	// Algorithm-specific metrics
	algorithmMetrics: {
		[algorithmType: string]: {
			score: number;
			rank?: number;
			percentile?: number;
			zScore?: number;
		};
	};

	// Analyst data for recommendation upgrades
	analystData?: any;
}

export interface SelectionResult {
	algorithmId: string;
	timestamp: number;
	executionTime: number;

	// Selected stocks
	selections: {
		symbol: string;
		score: StockScore;
		weight: number;
		action:
			| "STRONG_BUY"
			| "BUY"
			| "MODERATE_BUY"
			| "HOLD"
			| "MODERATE_SELL"
			| "SELL"
			| "STRONG_SELL";
		confidence: number;
	}[];

	// Performance metrics
	metrics: {
		totalStocksEvaluated: number;
		averageDataQuality: number;
		cacheHitRate: number;
		dataFusionConflicts: number;
	};

	// Quality indicators
	quality: {
		dataCompleteness: number;
		sourceAgreement: number;
		freshness: number;
	};
}

/**
 * Real-time algorithm execution context
 */
export interface AlgorithmContext {
	algorithmId: string;
	runId: string;
	startTime: number;

	// ✅ CRITICAL FIX: Symbols to analyze
	symbols?: string[];
	scope?: {
		mode: any;
		symbols?: string[];
		sector?: any;
		maxResults?: number;
	};

	// Market context
	marketData: {
		timestamp: number;
		marketOpen: boolean;
		volatilityIndex: number;
		sectorRotation: { [sector: string]: number };
	};

	// Data availability
	dataStatus: {
		[source: string]: {
			available: boolean;
			latency: number;
			lastUpdate: number;
		};
	};

	// Current positions (for rebalancing)
	currentPositions?: {
		[symbol: string]: {
			weight: number;
			entryPrice: number;
			entryTime: number;
			unrealizedPnL: number;
		};
	};

	// Real-time progress tracking (optional)
	progressTracker?: any; // ProgressTracker from ../progress/ProgressTracker
}

/**
 * Algorithm execution interfaces
 */
export interface AlgorithmExecution {
	context: AlgorithmContext;
	config: AlgorithmConfiguration;
	result?: SelectionResult;
	error?: string;
	status: "pending" | "running" | "completed" | "failed" | "cancelled";
}

/**
 * Performance tracking and analytics
 */
export interface AlgorithmPerformance {
	algorithmId: string;
	period: {
		start: number;
		end: number;
	};

	// Return metrics
	returns: {
		total: number;
		annualized: number;
		sharpe: number;
		maxDrawdown: number;
		volatility: number;
	};

	// Risk metrics
	risk: {
		beta: number;
		trackingError: number;
		informationRatio: number;
		var95: number;
		expectedShortfall: number;
	};

	// Algorithm-specific metrics
	algorithmMetrics: {
		turnover: number;
		averageHoldingPeriod: number;
		winRate: number;
		averageWin: number;
		averageLoss: number;
		dataQualityScore: number;
	};

	// Attribution analysis
	attribution: {
		[factor: string]: {
			contribution: number;
			weight: number;
			performance: number;
		};
	};
}

/**
 * Database persistence interfaces
 */
export interface AlgorithmConfigurationDB extends Omit<AlgorithmConfiguration, "weights"> {
	weights: string; // JSON serialized
}

export interface StockScoreDB extends Omit<StockScore, "factorScores" | "algorithmMetrics"> {
	factorScores: string; // JSON serialized
	algorithmMetrics: string; // JSON serialized
}

export interface SelectionResultDB
	extends Omit<SelectionResult, "selections" | "metrics" | "quality"> {
	selections: string; // JSON serialized
	metrics: string; // JSON serialized
	quality: string; // JSON serialized
}

/**
 * Cache keys and Redis interfaces
 */
export interface AlgorithmCacheKeys {
	config: (algorithmId: string) => string;
	scores: (algorithmId: string, timestamp: number) => string;
	selections: (algorithmId: string, timestamp: number) => string;
	marketData: (symbol: string) => string;
	dataQuality: (source: string, symbol: string) => string;
	universe: (algorithmId: string) => string;
}

/**
 * Real-time streaming interfaces
 */
export interface AlgorithmStreamMessage {
	type: "score_update" | "selection_update" | "algorithm_start" | "algorithm_complete" | "error";
	algorithmId: string;
	timestamp: number;
	data: any;
}

/**
 * Factor calculation interfaces
 */
export interface FactorCalculator {
	name: string;
	calculate: (
		symbol: string,
		marketData: any,
		fundamentalData?: any,
		technicalData?: any
	) => Promise<number>;
	requiredData: {
		market: string[];
		fundamental?: string[];
		technical?: string[];
	};
	cacheEnabled: boolean;
	cacheTTL: number;
}

/**
 * Algorithm validation and testing
 */
export interface AlgorithmValidation {
	configValidation: {
		isValid: boolean;
		errors: string[];
		warnings: string[];
	};
	backtest?: {
		startDate: number;
		endDate: number;
		performance: AlgorithmPerformance;
		trades: Array<{
			symbol: string;
			action: "BUY" | "SELL";
			timestamp: number;
			price: number;
			quantity: number;
		}>;
	};
}
