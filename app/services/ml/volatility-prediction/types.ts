/**
 * Type definitions for Volatility Prediction Model
 *
 * Purpose: Predict 21-day forward realized volatility for risk management
 * Model: LightGBM regression
 * Features: 29 (volatility history, price action, volume, smart money, macro)
 */

// === Prediction Output ===

export interface VolatilityPrediction {
	symbol: string;
	predicted_volatility: number;        // Annualized % (e.g., 32.5%)
	confidence_level: 'high' | 'medium' | 'low';
	risk_category: 'low' | 'moderate' | 'high' | 'extreme';
	prediction_horizon_days: number;     // 21 trading days
	timestamp: Date;
	feature_completeness?: number;       // 0-1 scale
	reasoning?: string;                  // Human-readable explanation
}

// === Feature Vector (29 features) ===

export interface VolatilityFeatures {
	// === Volatility History (8) ===
	atr_14: number;                     // Average True Range 14-day
	atr_21: number;                     // Average True Range 21-day
	atr_50: number;                     // Average True Range 50-day
	realized_vol_7d: number;            // 7-day realized volatility (annualized %)
	realized_vol_14d: number;           // 14-day realized volatility
	realized_vol_21d: number;           // 21-day realized volatility
	realized_vol_30d: number;           // 30-day realized volatility
	parkinson_volatility: number;       // Parkinson high-low volatility estimator

	// === Price Action (8) ===
	close_price: number;                // Current close price
	high_low_range: number;             // Daily high-low range
	rsi_14: number;                     // Relative Strength Index (0-100)
	macd: number;                       // MACD line
	macd_signal: number;                // MACD signal line
	bollinger_pct_b: number;            // Bollinger Band %B (position in bands)
	adx: number;                        // Average Directional Index (trend strength)
	price_roc_21: number;               // 21-day Price Rate of Change (%)

	// === Volume (5) ===
	volume: number;                     // Trading volume
	volume_roc: number;                 // Volume Rate of Change
	volume_ma_ratio: number;            // Volume / 20-day MA ratio
	vwap_deviation: number;             // Distance from VWAP
	dark_pool_volume: number;           // Dark pool volume estimate

	// === Smart Money (5) ===
	insider_buy_sell_ratio: number;     // 30-day insider buy/sell ratio
	institutional_volume_ratio: number; // Institutional volume as % of total
	volume_concentration: number;       // Block trade concentration
	block_trade_ratio: number;          // Ratio of block trades to total
	whale_activity_score: number;       // Large trader activity score

	// === Macro (3) ===
	vix_level: number;                  // VIX volatility index level
	sector_volatility: number;          // Sector ETF volatility (%)
	market_cap_log: number;             // Log10(market cap)

	// Metadata
	symbol: string;
	timestamp: number;
}

// === Service Configuration ===

export interface VolatilityPredictionConfig {
	modelPath: string;
	normalizerPath: string;
	cacheTTL: number;                   // Cache TTL in seconds (default: 300)
	enableCaching: boolean;
	confidenceThresholdLow: number;     // Skip predictions below this (default: 0.3)
	confidenceThresholdHigh: number;    // Skip predictions above this (default: 0.9)
}

// === Normalization Stats ===

export interface NormalizationStats {
	mean: Record<string, number>;
	std: Record<string, number>;
	feature_names: string[];
}

// === Risk Categories ===

export enum RiskCategory {
	LOW = 'low',           // < 20% annual volatility
	MODERATE = 'moderate', // 20-40% annual volatility
	HIGH = 'high',         // 40-70% annual volatility
	EXTREME = 'extreme'    // > 70% annual volatility
}

export enum ConfidenceLevel {
	HIGH = 'high',     // < 5% missing features
	MEDIUM = 'medium', // 5-15% missing features
	LOW = 'low'        // > 15% missing features
}

// === Feature Extraction Types ===

export interface PriceFeatures {
	close_price: number;
	high_low_range: number;
	rsi_14: number;
	macd: number;
	macd_signal: number;
	bollinger_pct_b: number;
	adx: number;
	price_roc_21: number;
}

export interface VolatilityHistoryFeatures {
	atr_14: number;
	atr_21: number;
	atr_50: number;
	realized_vol_7d: number;
	realized_vol_14d: number;
	realized_vol_21d: number;
	realized_vol_30d: number;
	parkinson_volatility: number;
}

export interface VolumeFeatures {
	volume: number;
	volume_roc: number;
	volume_ma_ratio: number;
	vwap_deviation: number;
	dark_pool_volume: number;
}

export interface SmartMoneyFeatures {
	insider_buy_sell_ratio: number;
	institutional_volume_ratio: number;
	volume_concentration: number;
	block_trade_ratio: number;
	whale_activity_score: number;
}

export interface MacroFeatures {
	vix_level: number;
	sector_volatility: number;
	market_cap_log: number;
}
