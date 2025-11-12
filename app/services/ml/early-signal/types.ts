/**
 * Type Definitions for ML Early Signal Detection v2.0
 *
 * Purpose: TypeScript interfaces for ML data structures
 * Model Version: v2.0.0 - "Macro + Fundamental Catalyst" Model
 * Feature Count: 22 (reduced from 34 in v1.x)
 *
 * Design Philosophy: ZERO overlap with other ML models
 * - No technical indicators (used by Price Prediction, Volatility)
 * - No price/volume momentum (used by Price Prediction, Sentiment Fusion)
 * - Focus: Macroeconomic levels, social media, fundamental catalysts, SEC activity
 */

export interface FeatureVector {
	// Macroeconomic LEVELS (5) - Absolute values, not changes
	// Using levels ensures natural variance over time (e.g., Fed rate 0.08% → 5.5%)
	fed_rate_level: number;             // Federal Funds Rate level (%)
	unemployment_rate_level: number;    // Unemployment rate level (%)
	cpi_level: number;                  // Consumer Price Index level (index value)
	gdp_level: number;                  // GDP level (billions USD)
	treasury_yield_10y_level: number;   // 10-Year Treasury yield level (%)

	// Social Media Momentum (6) - StockTwits & Twitter metrics
	stocktwits_24h_change: number;           // 24h sentiment change
	stocktwits_hourly_momentum: number;      // Hourly momentum (acceleration)
	stocktwits_7d_trend: number;             // 7-day trend (linear regression slope)
	twitter_24h_change: number;              // 24h sentiment change
	twitter_hourly_momentum: number;         // Hourly momentum (acceleration)
	twitter_7d_trend: number;                // 7-day trend (linear regression slope)

	// Fundamental Catalysts (8) - Earnings, analyst activity, market metrics
	earnings_surprise_pct: number;           // Earnings surprise percentage
	revenue_growth_accel: number;            // Revenue growth acceleration (QoQ)
	analyst_coverage_change: number;         // Change in analyst coverage
	analyst_price_target_change_pct: number; // Analyst price target change %
	earnings_whisper_vs_estimate: number;    // Whisper number vs estimate
	short_interest_change: number;           // Short interest change
	dividend_yield_change: number;           // Dividend yield change (YoY)
	market_beta_30d: number;                 // 30-day beta vs SPY

	// SEC/Regulatory Activity (3) - Filing and ownership changes
	sec_8k_filing_count_30d: number;         // Count of 8-K filings in 30 days
	insider_buying_ratio: number;            // Insider buy ratio (buys / total)
	institutional_ownership_change: number;  // Institutional ownership change (QoQ)
}

export interface TrainingExample {
	symbol: string;
	date: Date;
	features: FeatureVector;
	label: number; // 0 or 1 (no upgrade / upgrade)
}

export interface EarlySignalPrediction {
	predicted_class: "UP" | "NEUTRAL" | "DOWN"; // 3-class prediction
	upgrade_likely: boolean;                     // Derived from predicted_class === "UP"
	downgrade_likely: boolean;                   // Derived from predicted_class === "DOWN"
	confidence: number;                          // 0.0-1.0
	class_probabilities: [number, number, number]; // [DOWN, NEUTRAL, UP] probabilities
	horizon: "2_weeks";
	reasoning: string[];
	feature_importance: Record<string, number>;
	prediction_timestamp: number;
	model_version: string; // "v2.0.0"
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
 * Macroeconomic data for feature extraction (v2.0)
 * Uses ABSOLUTE LEVELS instead of changes/rates to ensure natural variance
 */
export interface MacroeconomicData {
	fedRateLevel: number | null;           // Federal Funds Rate level (%)
	unemploymentRateLevel: number | null;  // Unemployment rate level (%)
	cpiLevel: number | null;               // CPI index level
	gdpLevel: number | null;               // GDP level (billions USD)
	treasuryYieldLevel: number | null;     // 10Y Treasury yield level (%)
}

/**
 * Social media momentum data (v2.0)
 * Captures StockTwits and Twitter sentiment trends
 */
export interface SocialMediaMomentum {
	stocktwits_24h_change: number | null;
	stocktwits_hourly_momentum: number | null;
	stocktwits_7d_trend: number | null;
	twitter_24h_change: number | null;
	twitter_hourly_momentum: number | null;
	twitter_7d_trend: number | null;
}

/**
 * Fundamental catalyst data (v2.0)
 * Earnings, analyst activity, and market metrics
 */
export interface FundamentalCatalysts {
	earningsSurprise: number | null;
	revenueGrowthAccel: number | null;
	analystCoverageChange: number | null;
	analystPriceTargetChange: number | null;
	earningsWhisperVsEstimate: number | null;
	shortInterestChange: number | null;
	dividendYieldChange: number | null;
	marketBeta30d: number | null;
}

/**
 * SEC/Regulatory activity data (v2.0)
 * Filings and ownership changes
 */
export interface SECActivity {
	sec8kFilingCount: number | null;
	insiderBuyingRatio: number | null;
	institutionalOwnershipChange: number | null;
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
