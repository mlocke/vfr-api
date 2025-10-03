/**
 * Short Interest Data Types
 * Comprehensive type definitions for short interest and short squeeze analysis
 * Supporting Alternative Data component expansion from 5% to 7-8% weight
 */

// Core Short Interest Data Interface
export interface ShortInterestData {
	symbol: string;
	shortInterest: number; // Total number of shares sold short
	shortInterestRatio: number; // Short interest as percentage of shares outstanding
	daysTooCover: number; // Average daily volume / short interest
	shortInteresPriorMonth: number; // Previous month's short interest for comparison
	percentageChange: number; // Month-over-month change in short interest
	shortVolume?: number; // Daily short volume (if available)
	shortVolumeRatio?: number; // Short volume as percentage of total volume
	reportDate: string; // Date of short interest report
	settleDate: string; // Settlement date for the report
	timestamp: number;
}

// Short Interest Risk Assessment
export interface ShortInterestRiskFactors {
	squeezeRisk: {
		level: "low" | "moderate" | "high" | "extreme";
		probability: number; // 0-100 probability of squeeze
		catalysts: string[]; // Potential squeeze triggers
		timeframe: "days" | "weeks" | "months" | "unlikely";
		institutionalHolding: number; // Percentage held by institutions
		floatShorted: number; // Percentage of float that is shorted
		borrowCost: number; // Cost to borrow shares (annual rate)
	};
	liquidityRisk: {
		level: "high" | "moderate" | "low";
		bidAskSpread: number; // Current bid-ask spread
		averageDailyVolume: number;
		marketCap: number;
		institutionalOwnership: number;
		insiderOwnership: number;
		publicFloat: number;
	};
	momentum: {
		trend: "increasing" | "stable" | "decreasing";
		velocity: number; // Rate of change in short interest
		historicalPattern: "cyclical" | "trending" | "volatile" | "stable";
		priceCorrelation: number; // Correlation between short interest and price movements
		volumePattern: "normal" | "elevated" | "extreme";
	};
}

// Short Interest Analysis Insights
export interface ShortInterestInsights {
	opportunities: string[]; // Potential upside from short covering
	risks: string[]; // Risks from high short interest
	warnings: string[]; // Critical warnings about squeeze potential
	keyMetrics: string[]; // Important metrics to monitor
	marketSentiment: string[]; // What short interest indicates about sentiment
	technicalFactors: {
		supportLevels: number[]; // Price levels where shorts might cover
		resistanceLevels: number[]; // Price levels that might trigger more shorting
		volumeIndicators: string[]; // Volume-based insights
		priceAction: string[]; // Recent price action relative to short interest
	};
	institutionalView: {
		consensus: "bullish" | "bearish" | "neutral";
		majorHolders: string[]; // Large institutional positions
		recentChanges: string[]; // Recent institutional activity
		conflictIndicators: string[]; // Signs of institutional disagreement
	};
	historicalContext: {
		compared52Week: "high" | "average" | "low";
		seasonalPatterns: string[];
		eventDrivenChanges: string[];
		longTermTrend: "increasing" | "stable" | "decreasing";
	};
}

// Stock-specific Short Interest Impact
export interface StockShortInterestImpact {
	symbol: string;
	shortInterestData: ShortInterestData;
	riskFactors: ShortInterestRiskFactors;
	insights: ShortInterestInsights;
	adjustedScore: number; // Original stock score adjusted for short interest factors
	shortInterestWeight: number; // How much short interest influenced final score
	confidence: number; // 0-1 confidence in short interest data quality
	dataSource: string;
	lastUpdated: number;
	squeezeScenarios: {
		scenario: "mild" | "moderate" | "severe";
		priceTarget: number;
		probability: number;
		timeframe: string;
		triggerEvents: string[];
	}[];
}

// Bulk Short Interest Analysis Response
export interface BulkShortInterestAnalysisResponse {
	success: boolean;
	data?: {
		stockImpacts: StockShortInterestImpact[];
		averageShortRatio: number;
		highestShortInterest: string;
		highestSqueezeRisk: string;
		portfolioRisk: "low" | "moderate" | "high";
	};
	error?: string;
	executionTime: number;
	timestamp: number;
}

// Short Interest Configuration
export interface ShortInterestConfig {
	updateFrequency: number; // milliseconds
	dataSources: {
		primary: ShortInterestDataSource[];
		fallback: ShortInterestDataSource[];
	};
	defaults: {
		baselineShortRatio: number;
		industryAverages: Record<string, number>;
	};
	thresholds: {
		highShortInterest: number; // Threshold for "high" short interest
		extremeShortInterest: number; // Threshold for "extreme" short interest
		squeezeProbability: number; // Minimum probability for squeeze warning
		confidenceThreshold: number;
	};
	cache: {
		ttl: number; // Cache time-to-live
		maxAge: number; // Maximum cache age
	};
}

// Short Interest Data Sources
export interface ShortInterestDataSource {
	source: "polygon" | "finra" | "iex" | "yahoo" | "synthetic";
	indicators: string[];
	lastUpdated: number;
	quality: number; // 0-1 data quality score
	latency: number; // milliseconds
	frequency: "daily" | "weekly" | "bi-monthly" | "monthly";
}

// Short Interest Error Types
export enum ShortInterestErrorType {
	API_ERROR = "API_ERROR",
	DATA_PROCESSING_ERROR = "DATA_PROCESSING_ERROR",
	INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
	API_QUOTA_EXCEEDED = "API_QUOTA_EXCEEDED",
	SHORT_INTEREST_TIMEOUT = "SHORT_INTEREST_TIMEOUT",
	INVALID_SYMBOL = "INVALID_SYMBOL",
	STALE_DATA = "STALE_DATA",
}

// Short Interest Validation Result
export interface ShortInterestValidationResult {
	isValid: boolean;
	confidence: number;
	errors: string[];
	warnings: string[];
	dataQuality: number;
	completeness: number;
	recommendations: string[];
	dataAge: number; // Age of data in milliseconds
}

// Short Interest Health Check Interface
export interface ShortInterestHealthCheck {
	status: "healthy" | "degraded" | "unhealthy";
	details: {
		dataSource: boolean;
		cache: boolean;
		apiKey: boolean;
		processingLatency: number;
		dataFreshness: number;
		errorRate: number;
		fallbackMode: boolean;
		lastReportDate: string;
	};
	timestamp: number;
	recommendations: string[];
}

// Market-wide Short Interest Summary
export interface MarketShortInterestSummary {
	totalShortInterest: number;
	averageShortRatio: number;
	topShortedStocks: Array<{
		symbol: string;
		shortRatio: number;
		squeezeRisk: "low" | "moderate" | "high" | "extreme";
	}>;
	sectorBreakdown: Record<
		string,
		{
			averageShortRatio: number;
			stockCount: number;
			riskLevel: "low" | "moderate" | "high";
		}
	>;
	marketSentiment: "bullish" | "bearish" | "neutral";
	lastUpdated: number;
}

// Short Squeeze Detection Result
export interface ShortSqueezeDetection {
	symbol: string;
	squeezeAlert: boolean;
	riskLevel: "low" | "moderate" | "high" | "extreme";
	confidence: number;
	triggers: string[];
	priceTargets: {
		conservative: number;
		moderate: number;
		aggressive: number;
	};
	timeframe: string;
	monitoringPoints: string[];
	lastAnalyzed: number;
}
