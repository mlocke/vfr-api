/**
 * Type Definitions for ML Early Signal Detection
 *
 * Task 1.4: Create Type Definitions
 * Estimated Time: 30 minutes
 * Purpose: TypeScript interfaces for ML data structures
 */

export interface FeatureVector {
	// Momentum features (3)
	price_change_5d: number;
	price_change_10d: number;
	price_change_20d: number;

	// Volume features (2)
	volume_ratio: number;
	volume_trend: number;

	// Sentiment delta features (3)
	sentiment_news_delta: number;
	sentiment_reddit_accel: number;
	sentiment_options_shift: number;

	// Social sentiment features (6)
	social_stocktwits_24h_change: number;
	social_stocktwits_hourly_momentum: number;
	social_stocktwits_7d_trend: number;
	social_twitter_24h_change: number;
	social_twitter_hourly_momentum: number;
	social_twitter_7d_trend: number;

	// Fundamental features (3)
	earnings_surprise: number;
	revenue_growth_accel: number;
	analyst_coverage_change: number;

	// Technical features (2)
	rsi_momentum: number;
	macd_histogram_trend: number;

	// Government/Macro features (5)
	fed_rate_change_30d: number;
	unemployment_rate_change: number;
	cpi_inflation_rate: number;
	gdp_growth_rate: number;
	treasury_yield_10y: number;

	// SEC filing features (3)
	sec_insider_buying_ratio: number;
	sec_institutional_ownership_change: number;
	sec_8k_filing_count_30d: number;

	// FMP Premium features (4)
	analyst_price_target_change: number;
	earnings_whisper_vs_estimate: number;
	short_interest_change: number;
	institutional_ownership_momentum: number;

	// Additional market features (3)
	options_put_call_ratio_change: number;
	dividend_yield_change: number;
	market_beta_30d: number;
}

export interface TrainingExample {
	symbol: string;
	date: Date;
	features: FeatureVector;
	label: number; // 0 or 1 (no upgrade / upgrade)
}

export interface EarlySignalPrediction {
	upgrade_likely: boolean;
	downgrade_likely: boolean;
	confidence: number; // 0.0-1.0
	horizon: "2_weeks";
	reasoning: string[];
	feature_importance: Record<string, number>;
	prediction_timestamp: number;
	model_version: string;
}

export interface AnalystRatings {
	symbol: string;
	date: Date;
	strongBuy: number;
	buy: number;
	hold: number;
	sell: number;
	strongSell: number;
	totalAnalysts: number;
	consensus?: string;
	sentimentScore?: number;
}

/**
 * Historical OHLC price data
 */
export interface OHLC {
	date: Date;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

/**
 * Sentiment data aggregated across sources
 */
export interface SentimentData {
	symbol: string;
	date: Date;
	newsScore: number;
	redditScore: number;
	optionsScore: number;
	social_stocktwits_24h_change?: number;
	social_stocktwits_hourly_momentum?: number;
	social_stocktwits_7d_trend?: number;
	social_twitter_24h_change?: number;
	social_twitter_hourly_momentum?: number;
	social_twitter_7d_trend?: number;
	timestamp: number;
}

/**
 * Fundamental data for feature extraction
 */
export interface FundamentalsData {
	symbol: string;
	earningsSurprise: number | null;
	revenueGrowthAccel: number | null;
	analystCoverageChange: number | null;
}

/**
 * Technical indicator data
 */
export interface TechnicalData {
	symbol: string;
	rsiMomentum: number | null;
	macdHistogramTrend: number | null;
}

/**
 * Macroeconomic data for feature extraction
 * Time-aligned with 20-day stock analysis window (matching price_change_20d)
 */
export interface MacroeconomicData {
	fedRateChange20d: number | null;
	unemploymentRateChange: number | null;
	cpiInflationRate: number | null;
	gdpGrowthRate: number | null;
	treasuryYieldChange: number | null;
}

/**
 * SEC filing data
 */
export interface SECFilingData {
	symbol: string;
	insiderBuyingRatio: number | null;
	institutionalOwnershipChange: number | null;
	form8kFilingCount30d: number | null;
}

/**
 * Premium features data
 */
export interface PremiumFeaturesData {
	symbol: string;
	analystPriceTargetChange: number | null;
	earningsWhisperVsEstimate: number | null;
	shortInterestChange: number | null;
	institutionalOwnershipMomentum: number | null;
}

/**
 * Additional market data
 */
export interface AdditionalMarketData {
	symbol: string;
	optionsPutCallRatioChange: number | null;
	dividendYieldChange: number | null;
	marketBeta30d: number | null;
}
