/**
 * ESG Data Types
 * Comprehensive type definitions for Environmental, Social, and Governance data
 * Supporting 5% alternative data weight in composite scoring
 */

// Core ESG Score Interface
export interface ESGScore {
	environmental: number; // 0-100 score for environmental factors
	social: number; // 0-100 score for social factors
	governance: number; // 0-100 score for governance factors
	overall: number; // 0-100 composite ESG score
	grade: "A" | "B" | "C" | "D" | "F"; // Letter grade representation
	percentile: number; // 0-100 percentile ranking against peers
	timestamp: number;
}

// ESG Risk Assessment
export interface ESGRiskFactors {
	controversies: {
		level: "low" | "moderate" | "high" | "severe";
		count: number;
		categories: string[];
		description: string;
		impact: "minimal" | "moderate" | "significant" | "severe";
	};
	carbonFootprint: {
		intensity: number; // CO2 emissions per revenue (tons/million USD)
		scope1: number; // Direct emissions
		scope2: number; // Indirect emissions from electricity
		scope3?: number; // Other indirect emissions
		trend: "improving" | "stable" | "worsening";
		industryComparison: "above_average" | "average" | "below_average";
		targetSet: boolean; // Has company set carbon reduction targets
	};
	governance: {
		boardDiversity: number; // 0-100 score for board diversity
		boardIndependence: number; // Percentage of independent directors
		executiveCompensation: "reasonable" | "concerning" | "excessive";
		transparency: number; // 0-100 score for disclosure quality
		auditQuality: number; // 0-100 score for audit practices
		shareholderRights: number; // 0-100 score for shareholder protection
	};
	social: {
		workplaceSafety: number; // 0-100 safety score
		laborPractices: number; // 0-100 labor relations score
		communityImpact: number; // 0-100 community engagement score
		dataPrivacy: number; // 0-100 data protection score (for tech companies)
		productSafety: number; // 0-100 product safety score
	};
}

// ESG Analysis Insights
export interface ESGInsights {
	strengths: string[];
	weaknesses: string[];
	opportunities: string[];
	warnings: string[];
	keyTrends: string[];
	industryComparison: {
		rank: number;
		totalCompanies: number;
		percentile: number;
		peerGroup: string[];
		industryAverage: number;
	};
	regulatoryRisks: {
		level: "low" | "moderate" | "high";
		description: string;
		impactedRegions: string[];
	};
	stakeholderSentiment: {
		investors: "positive" | "neutral" | "negative";
		customers: "positive" | "neutral" | "negative";
		employees: "positive" | "neutral" | "negative";
		communities: "positive" | "neutral" | "negative";
	};
}

// Stock-specific ESG Impact
export interface StockESGImpact {
	symbol: string;
	esgScore: ESGScore;
	riskFactors: ESGRiskFactors;
	insights: ESGInsights;
	adjustedScore: number; // Original stock score adjusted for ESG factors
	esgWeight: number; // How much ESG factors influenced final score (0.05)
	confidence: number; // 0-1 confidence in ESG data quality
	dataSource: string;
	lastUpdated: number;
	materialityFactors: {
		factor: string;
		relevance: "high" | "medium" | "low";
		impact: number; // -1 to 1
	}[];
}

// Bulk ESG Analysis Response
export interface BulkESGAnalysisResponse {
	success: boolean;
	data?: {
		stockImpacts: StockESGImpact[];
		averageESGScore: number;
		highestESGStock: string;
		lowestESGStock: string;
	};
	error?: string;
	executionTime: number;
	timestamp: number;
}

// ESG Configuration
export interface ESGConfig {
	updateFrequency: number; // milliseconds
	dataSources: {
		primary: ESGDataSource[];
		fallback: ESGDataSource[];
	};
	defaults: {
		baselineESGScore: number;
		industryAverages: Record<string, number>;
	};
	thresholds: {
		confidenceThreshold: number;
		controversyImpact: number;
	};
	cache: {
		ttl: number;
		maxAge: number;
	};
}

// ESG Data Sources
export interface ESGDataSource {
	source: "sustainalytics" | "msci" | "refinitiv" | "bloomberg" | "synthetic";
	indicators: string[];
	lastUpdated: number;
	quality: number; // 0-1 data quality score
	latency: number; // milliseconds
}

// ESG Error Types
export enum ESGErrorType {
	API_ERROR = "API_ERROR",
	DATA_PROCESSING_ERROR = "DATA_PROCESSING_ERROR",
	INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
	API_QUOTA_EXCEEDED = "API_QUOTA_EXCEEDED",
	ESG_TIMEOUT = "ESG_TIMEOUT",
	INVALID_SYMBOL = "INVALID_SYMBOL",
}

// ESG Validation Result
export interface ESGValidationResult {
	isValid: boolean;
	confidence: number;
	errors: string[];
	warnings: string[];
	dataQuality: number;
	completeness: number;
	recommendations: string[];
}

// ESG Health Check Interface
export interface ESGHealthCheck {
	status: "healthy" | "degraded" | "unhealthy";
	details: {
		dataSource: boolean;
		cache: boolean;
		apiKey: boolean;
		processingLatency: number;
		dataFreshness: number;
		errorRate: number;
		fallbackMode: boolean;
	};
	timestamp: number;
	recommendations: string[];
}

// All interfaces are already exported above
