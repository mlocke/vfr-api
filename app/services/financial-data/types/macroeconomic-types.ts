/**
 * Macroeconomic Analysis Types
 * Types for connecting economic data with stock analysis
 */

export interface MacroeconomicIndicators {
	// GDP indicators
	gdp: {
		real: number | null;
		nominal: number | null;
		potential: number | null;
		growth: number | null;
		lastUpdated: number;
	};

	// Inflation indicators
	inflation: {
		cpi: number | null;
		coreCpi: number | null;
		ppi: number | null;
		pce: number | null;
		expectedInflation: number | null;
		lastUpdated: number;
	};

	// Employment indicators
	employment: {
		unemploymentRate: number | null;
		participationRate: number | null;
		nonfarmPayrolls: number | null;
		unemploymentLevel: number | null;
		lastUpdated: number;
	};

	// Interest rates
	interestRates: {
		fedFunds: number | null;
		treasury3m: number | null;
		treasury10y: number | null;
		treasury30y: number | null;
		yieldCurveSlope: number | null;
		isInverted: boolean;
		lastUpdated: number;
	};

	// Money supply
	moneySupply: {
		m1: number | null;
		m2: number | null;
		m1Growth: number | null;
		m2Growth: number | null;
		lastUpdated: number;
	};

	// Exchange rates and DXY
	exchangeRates: {
		dxy: number | null; // Dollar Index
		eurUsd: number | null;
		usdJpy: number | null;
		usdCny: number | null;
		lastUpdated: number;
	};

	// Commodity indicators
	commodities: {
		oilWti: number | null;
		oilBrent: number | null;
		gold: number | null;
		naturalGas: number | null;
		lastUpdated: number;
	};
}

export interface EconomicCycleAnalysis {
	cycle: {
		phase: "expansion" | "peak" | "contraction" | "trough" | "unknown";
		confidence: number; // 0-1
		timeInPhase: number; // months
		nextPhaseEstimate: number; // months
	};

	indicators: {
		leading: {
			score: number; // -1 to 1 (negative = recession signal)
			signals: string[];
		};
		coincident: {
			score: number;
			signals: string[];
		};
		lagging: {
			score: number;
			signals: string[];
		};
	};

	riskFactors: {
		inflationRisk: number; // 0-1
		recessionRisk: number; // 0-1
		rateHikeRisk: number; // 0-1
		marketVolatilityRisk: number; // 0-1
	};

	timestamp: number;
}

export interface SectorEconomicImpact {
	sector: string;
	economicSensitivity: {
		interestRates: number; // -1 to 1 (how sector reacts to rate changes)
		inflation: number; // -1 to 1 (how sector reacts to inflation)
		gdpGrowth: number; // -1 to 1 (how sector reacts to GDP growth)
		dollarStrength: number; // -1 to 1 (how sector reacts to USD strength)
	};
	currentEnvironmentScore: number; // 0-1 (how favorable current environment is)
	outlook: "very_positive" | "positive" | "neutral" | "negative" | "very_negative";
}

export interface MacroeconomicScore {
	overall: number; // 0-1 composite macroeconomic score
	components: {
		growth: number; // GDP growth score
		inflation: number; // Inflation environment score
		monetary: number; // Interest rate environment score
		fiscal: number; // Government policy environment score
		external: number; // Global/currency environment score
	};
	confidence: number; // 0-1 confidence in the score
	reasoning: string[];
	warnings: string[];
	opportunities: string[];
	timestamp: number;
}

export interface StockMacroeconomicImpact {
	symbol: string;
	macroScore: MacroeconomicScore;
	sectorImpact: SectorEconomicImpact;
	correlationAnalysis: {
		gdpCorrelation: number;
		inflationCorrelation: number;
		rateCorrelation: number;
		dxyCorrelation: number;
	};
	adjustedScore: number; // Original stock score adjusted for macro environment
	macroWeight: number; // How much macro factors influenced the final score
}

export interface MacroeconomicDataSource {
	source: "fred" | "bls" | "eia" | "treasury" | "composite";
	indicators: string[];
	lastUpdated: number;
	quality: number; // 0-1 data quality score
	latency: number; // milliseconds
}

export interface MacroeconomicCache {
	indicators: MacroeconomicIndicators;
	cycleAnalysis: EconomicCycleAnalysis;
	sectorImpacts: SectorEconomicImpact[];
	lastUpdated: number;
	ttl: number; // time to live in milliseconds
}

// Configuration types
export interface MacroeconomicConfig {
	updateFrequency: number; // milliseconds
	dataSources: {
		primary: MacroeconomicDataSource[];
		fallback: MacroeconomicDataSource[];
	};
	weights: {
		growth: number;
		inflation: number;
		monetary: number;
		fiscal: number;
		external: number;
	};
	thresholds: {
		recessionSignal: number;
		inflationConcern: number;
		rateVolatility: number;
	};
	cache: {
		ttl: number;
		maxAge: number;
	};
}

// API Response types
export interface MacroeconomicAnalysisResponse {
	success: boolean;
	data?: {
		indicators: MacroeconomicIndicators;
		cycleAnalysis: EconomicCycleAnalysis;
		stockImpact?: StockMacroeconomicImpact;
	};
	error?: string;
	timestamp: number;
	source: string;
}

export interface BulkMacroAnalysisResponse {
	success: boolean;
	data?: {
		indicators: MacroeconomicIndicators;
		cycleAnalysis: EconomicCycleAnalysis;
		stockImpacts: StockMacroeconomicImpact[];
	};
	error?: string;
	executionTime: number;
	timestamp: number;
}
