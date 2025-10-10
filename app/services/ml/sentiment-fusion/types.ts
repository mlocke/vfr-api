/**
 * Type Definitions for ML Sentiment-Fusion Price Prediction
 *
 * Purpose: TypeScript interfaces for sentiment-fusion ML data structures
 * Model: LightGBM multiclass classifier (UP/NEUTRAL/DOWN)
 * Version: v1.1.0
 * Features: 45 (4 sentiment + 41 price/technical) - EXACT ORDER FROM TRAINING DATA
 */

export interface SentimentFusionFeatureVector {
	// Sentiment features (4) - from Polygon FinBERT
	sentiment_negative: number;
	sentiment_neutral: number;
	sentiment_positive: number;
	sentiment_score: number; // compound score

	// Technical indicators (7)
	rsi_14: number;
	ema_20: number;
	sma_50: number;
	ema_20_distance: number;
	sma_50_distance: number;
	bollinger_position: number;
	macd_signal: number;

	// More technical (6)
	macd_histogram: number;
	atr_14: number;
	adx_14: number;
	stochastic_k: number;
	williams_r: number;

	// Volume features (6)
	volume_ratio_5d: number;
	volume_spike: number;
	relative_volume: number;
	volume_trend: number;
	volume_acceleration: number;
	dark_pool_ratio: number; // UNAVAILABLE - set to 0

	// Price momentum features (6)
	price_momentum_5d: number;
	price_momentum_10d: number;
	price_momentum_20d: number;
	price_acceleration: number;
	gap_size: number;
	volatility_20d: number;

	// Intraday features (2)
	overnight_return: number;
	intraday_range: number;

	// Options features (7) - UNAVAILABLE - all set to 0
	options_put_call_ratio: number;
	options_unusual_activity: number;
	options_iv_rank: number;
	options_call_volume: number;
	options_put_volume: number;
	options_oi_put_call: number;
	options_gamma_exposure: number;

	// Institutional features (4) - UNAVAILABLE - all set to 0
	institutional_net_flow: number;
	institutional_block_trades: number;
	institutional_ownership_pct: number;
	insider_buying_ratio: number;

	// Market context features (4)
	sector_momentum: number;
	spy_correlation: number;
	vix_level: number;
	sector_relative_strength: number;
}

export interface PricePrediction {
	direction: 'UP' | 'NEUTRAL' | 'DOWN';
	confidence: number; // 0.0-1.0
	probabilities: {
		DOWN: number;
		NEUTRAL: number;
		UP: number;
	};
	horizon: '3_days';
	reasoning: string[];
	feature_importance: Record<string, number>;
	prediction_timestamp: number;
	model_version: string;
}

export interface TrainingExample {
	symbol: string;
	date: Date;
	features: SentimentFusionFeatureVector;
	label: 'UP' | 'NEUTRAL' | 'DOWN';
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
 * FinBERT Sentiment data from Polygon
 */
export interface SentimentData {
	symbol: string;
	date: Date;
	negative: number;
	neutral: number;
	positive: number;
	score: number; // compound sentiment score
	timestamp: number;
}

/**
 * Technical indicator data
 */
export interface TechnicalData {
	symbol: string;
	rsi_14: number | null;
	ema_20: number | null;
	sma_50: number | null;
	ema_20_distance: number | null;
	sma_50_distance: number | null;
	bollinger_position: number | null;
	macd_signal: number | null;
	macd_histogram: number | null;
	atr_14: number | null;
	adx_14: number | null;
	stochastic_k: number | null;
	williams_r: number | null;
}
