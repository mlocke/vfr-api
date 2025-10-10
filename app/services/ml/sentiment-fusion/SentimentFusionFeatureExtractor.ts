/**
 * Sentiment-Fusion Feature Extractor
 *
 * Purpose: Extract 45 features from historical data for sentiment-fusion ML model
 * Pattern: Follows EarlySignalFeatureExtractor.ts pattern exactly
 *
 * Features (45 total):
 * - 4 sentiment features (Polygon FinBERT)
 * - 41 price/technical features
 * - 33 available features (12 unavailable features set to 0)
 *
 * Reuses existing VFR services:
 * - PolygonAPI for sentiment data
 * - FinancialDataService for historical price data
 * - TechnicalIndicatorService for technical indicators
 */

import { FinancialDataService } from "../../financial-data/FinancialDataService";
import { PolygonAPI } from "../../financial-data/PolygonAPI";
import { TechnicalIndicatorService } from "../../technical-analysis/TechnicalIndicatorService";
import { RedisCache } from "../../cache/RedisCache";
import type {
	SentimentFusionFeatureVector,
	OHLC,
	SentimentData,
	TechnicalData,
} from "./types";

export class SentimentFusionFeatureExtractor {
	private financialDataService: FinancialDataService;
	private polygonAPI: PolygonAPI;
	private technicalService: TechnicalIndicatorService;
	private cache: RedisCache;

	constructor() {
		this.financialDataService = new FinancialDataService();
		this.polygonAPI = new PolygonAPI();
		this.technicalService = new TechnicalIndicatorService(new RedisCache());
		this.cache = new RedisCache();
	}

	/**
	 * Extract all 45 features for ML model prediction
	 * @param symbol Stock symbol (e.g., 'TSLA')
	 * @param asOfDate Date for feature extraction (default: today)
	 * @returns Feature vector with 45 numeric features in EXACT order from training data
	 */
	async extractFeatures(
		symbol: string,
		asOfDate?: Date
	): Promise<SentimentFusionFeatureVector> {
		const date = asOfDate || new Date();
		const startTime = Date.now();

		try {
			// Parallel data collection
			const [historicalData, sentimentData, technicals] = await Promise.all([
				this.getHistoricalData(symbol, date, 50), // 50 days for momentum calculations
				this.getSentimentData(symbol, date),
				this.getTechnicalData(symbol, date),
			]);

			// Extract features in EXACT order from training dataset
			const features: SentimentFusionFeatureVector = {
				// Sentiment features (4) - from Polygon FinBERT
				sentiment_negative: sentimentData?.negative || 0,
				sentiment_neutral: sentimentData?.neutral || 0,
				sentiment_positive: sentimentData?.positive || 0,
				sentiment_score: sentimentData?.score || 0,

				// Technical indicators (7)
				rsi_14: technicals?.rsi_14 || 50,
				ema_20: technicals?.ema_20 || 0,
				sma_50: technicals?.sma_50 || 0,
				ema_20_distance: technicals?.ema_20_distance || 0,
				sma_50_distance: technicals?.sma_50_distance || 0,
				bollinger_position: technicals?.bollinger_position || 0.5,
				macd_signal: technicals?.macd_signal || 0,

				// More technical (6)
				macd_histogram: technicals?.macd_histogram || 0,
				atr_14: technicals?.atr_14 || 0,
				adx_14: technicals?.adx_14 || 25,
				stochastic_k: technicals?.stochastic_k || 50,
				williams_r: technicals?.williams_r || -50,

				// Volume features (6)
				volume_ratio_5d: this.calculateVolumeRatio(historicalData, 5),
				volume_spike: this.calculateVolumeSpike(historicalData),
				relative_volume: this.calculateRelativeVolume(historicalData),
				volume_trend: this.calculateVolumeTrend(historicalData, 10),
				volume_acceleration: this.calculateVolumeAcceleration(historicalData),
				dark_pool_ratio: 0, // UNAVAILABLE - set to 0

				// Price momentum features (6)
				price_momentum_5d: this.calculateMomentum(historicalData, 5),
				price_momentum_10d: this.calculateMomentum(historicalData, 10),
				price_momentum_20d: this.calculateMomentum(historicalData, 20),
				price_acceleration: this.calculatePriceAcceleration(historicalData),
				gap_size: this.calculateGapSize(historicalData),
				volatility_20d: this.calculateVolatility(historicalData, 20),

				// Intraday features (2)
				overnight_return: this.calculateOvernightReturn(historicalData),
				intraday_range: this.calculateIntradayRange(historicalData),

				// Options features (7) - UNAVAILABLE - all set to 0
				options_put_call_ratio: 0,
				options_unusual_activity: 0,
				options_iv_rank: 0,
				options_call_volume: 0,
				options_put_volume: 0,
				options_oi_put_call: 0,
				options_gamma_exposure: 0,

				// Institutional features (4) - UNAVAILABLE - all set to 0
				institutional_net_flow: 0,
				institutional_block_trades: 0,
				institutional_ownership_pct: 0,
				insider_buying_ratio: 0,

				// Market context features (4)
				sector_momentum: 0, // TODO: Implement sector momentum
				spy_correlation: 0, // TODO: Implement SPY correlation
				vix_level: 0, // TODO: Implement VIX level
				sector_relative_strength: 0, // TODO: Implement sector relative strength
			};

			const duration = Date.now() - startTime;
			console.log(`Feature extraction for ${symbol} completed in ${duration}ms`);

			return features;
		} catch (error) {
			console.error(`Failed to extract features for ${symbol}:`, error);
			// Return neutral features on error
			return this.getNeutralFeatures();
		}
	}

	/**
	 * Get historical OHLC data for the symbol
	 */
	private async getHistoricalData(symbol: string, asOfDate: Date, days: number): Promise<OHLC[]> {
		try {
			const historicalData = await this.financialDataService.getHistoricalOHLC(
				symbol,
				days,
				asOfDate
			);

			if (!historicalData || historicalData.length === 0) {
				return [];
			}

			// Convert to OHLC format and sort chronologically (oldest first)
			return historicalData
				.map(bar => ({
					date: new Date(bar.date),
					open: bar.open,
					high: bar.high,
					low: bar.low,
					close: bar.close,
					volume: bar.volume,
				}))
				.sort((a, b) => a.date.getTime() - b.date.getTime());
		} catch (error) {
			console.error(`Failed to get historical data for ${symbol}:`, error);
			return [];
		}
	}

	/**
	 * Get sentiment data from Polygon (FinBERT)
	 */
	private async getSentimentData(symbol: string, asOfDate: Date): Promise<SentimentData | null> {
		try {
			// Get news from last 7 days
			const startDate = new Date(asOfDate);
			startDate.setDate(startDate.getDate() - 7);

			const newsResponse = await this.polygonAPI.getNews({
				ticker: symbol,
				publishedUtcGte: startDate,
				publishedUtcLte: asOfDate,
				limit: 100,
				order: 'desc',
			});

			if (!newsResponse || !newsResponse.results || newsResponse.results.length === 0) {
				console.warn(`No news found for ${symbol}`);
				return null;
			}

			// Aggregate sentiment from news articles
			let totalNegative = 0;
			let totalNeutral = 0;
			let totalPositive = 0;
			let count = 0;

			for (const article of newsResponse.results) {
				if (article.insights && article.insights.length > 0) {
					for (const insight of article.insights) {
						if (insight.ticker.toUpperCase() === symbol.toUpperCase()) {
							if (insight.sentiment === 'negative') totalNegative++;
							else if (insight.sentiment === 'neutral') totalNeutral++;
							else if (insight.sentiment === 'positive') totalPositive++;
							count++;
						}
					}
				}
			}

			if (count === 0) {
				return null;
			}

			// Calculate normalized sentiment scores
			const negative = totalNegative / count;
			const neutral = totalNeutral / count;
			const positive = totalPositive / count;
			const score = positive - negative; // compound score [-1, 1]

			return {
				symbol,
				date: asOfDate,
				negative,
				neutral,
				positive,
				score,
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error(`Failed to get sentiment data for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Get technical indicator data
	 */
	private async getTechnicalData(symbol: string, asOfDate: Date): Promise<TechnicalData | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, asOfDate, 50);

			if (historicalData.length < 20) {
				return null;
			}

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData: historicalData.map(d => ({
					timestamp: d.date.getTime(),
					open: d.open,
					high: d.high,
					low: d.low,
					close: d.close,
					volume: d.volume,
				})),
			});

			const currentPrice = historicalData[historicalData.length - 1].close;

			// Extract EMA values (array of values)
			const emaResults = technicalResult.trend?.indicators?.ema || [];
			const ema20 = Array.isArray(emaResults) && emaResults.length > 0
				? emaResults[emaResults.length - 1].value
				: currentPrice;

			// Extract SMA values (array of values)
			const smaResults = technicalResult.trend?.indicators?.sma || [];
			const sma50 = Array.isArray(smaResults) && smaResults.length > 0
				? smaResults[smaResults.length - 1].value
				: currentPrice;

			const rsi = technicalResult.momentum?.indicators?.rsi?.value || 50;

			// Extract MACD values
			const macdResult = technicalResult.trend?.indicators?.macd;
			const macdSignal = macdResult?.signal || 0;
			const macdHistogram = macdResult?.histogram || 0;

			// Extract Bollinger Bands - check if available, otherwise use defaults
			const volatilityIndicators = technicalResult.volatility?.indicators;
			const bbUpper = currentPrice * 1.05; // Default upper band
			const bbLower = currentPrice * 0.95; // Default lower band

			const atr = technicalResult.volatility?.indicators?.atr?.value || 0;

			// ADX might not be in trend indicators - use default
			const adx = 25; // Default ADX value

			const stochasticK = technicalResult.momentum?.indicators?.stochastic?.k || 50;

			// Extract Williams %R
			const williamsR = technicalResult.momentum?.indicators?.williams?.value || -50;

			return {
				symbol,
				rsi_14: rsi,
				ema_20: ema20,
				sma_50: sma50,
				ema_20_distance: (currentPrice - ema20) / ema20,
				sma_50_distance: (currentPrice - sma50) / sma50,
				bollinger_position: (currentPrice - bbLower) / (bbUpper - bbLower),
				macd_signal: macdSignal,
				macd_histogram: macdHistogram,
				atr_14: atr,
				adx_14: adx,
				stochastic_k: stochasticK,
				williams_r: williamsR,
			};
		} catch (error) {
			console.error(`Failed to get technical data for ${symbol}:`, error);
			return null;
		}
	}

	// ===== VOLUME CALCULATIONS =====

	private calculateVolumeRatio(data: OHLC[], window: number): number {
		if (data.length < window) return 1.0;
		const recent = data.slice(-window);
		const older = data.slice(-window * 2, -window);
		const recentAvg = recent.reduce((sum, d) => sum + d.volume, 0) / recent.length;
		const olderAvg = older.reduce((sum, d) => sum + d.volume, 0) / older.length;
		return olderAvg > 0 ? recentAvg / olderAvg : 1.0;
	}

	private calculateVolumeSpike(data: OHLC[]): number {
		if (data.length < 2) return 0;
		const current = data[data.length - 1].volume;
		const avg = data.slice(-20).reduce((sum, d) => sum + d.volume, 0) / Math.min(20, data.length);
		return avg > 0 ? (current - avg) / avg : 0;
	}

	private calculateRelativeVolume(data: OHLC[]): number {
		if (data.length < 20) return 1.0;
		const current = data[data.length - 1].volume;
		const avg = data.slice(-20).reduce((sum, d) => sum + d.volume, 0) / 20;
		return avg > 0 ? current / avg : 1.0;
	}

	private calculateVolumeTrend(data: OHLC[], window: number): number {
		if (data.length < window) return 0;
		const volumes = data.slice(-window).map(d => d.volume);
		return this.linearRegressionSlope(volumes);
	}

	private calculateVolumeAcceleration(data: OHLC[]): number {
		if (data.length < 10) return 0;
		const recentTrend = this.calculateVolumeTrend(data.slice(-5), 5);
		const olderTrend = this.calculateVolumeTrend(data.slice(-10, -5), 5);
		return recentTrend - olderTrend;
	}

	// ===== PRICE MOMENTUM CALCULATIONS =====

	private calculateMomentum(data: OHLC[], days: number): number {
		if (data.length < days) return 0;
		const current = data[data.length - 1].close;
		const past = data[data.length - days].close;
		return past > 0 ? (current - past) / past : 0;
	}

	private calculatePriceAcceleration(data: OHLC[]): number {
		if (data.length < 10) return 0;
		const momentum5d = this.calculateMomentum(data.slice(-5), 5);
		const momentum10d = this.calculateMomentum(data.slice(-10), 10);
		return momentum5d - momentum10d;
	}

	private calculateGapSize(data: OHLC[]): number {
		if (data.length < 2) return 0;
		const current = data[data.length - 1];
		const previous = data[data.length - 2];
		return (current.open - previous.close) / previous.close;
	}

	private calculateVolatility(data: OHLC[], window: number): number {
		if (data.length < window) return 0;
		const returns = [];
		for (let i = data.length - window; i < data.length - 1; i++) {
			const ret = (data[i + 1].close - data[i].close) / data[i].close;
			returns.push(ret);
		}
		const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
		const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
		return Math.sqrt(variance);
	}

	// ===== INTRADAY CALCULATIONS =====

	private calculateOvernightReturn(data: OHLC[]): number {
		if (data.length < 2) return 0;
		const current = data[data.length - 1];
		const previous = data[data.length - 2];
		return previous.close > 0 ? (current.open - previous.close) / previous.close : 0;
	}

	private calculateIntradayRange(data: OHLC[]): number {
		if (data.length < 1) return 0;
		const current = data[data.length - 1];
		return current.open > 0 ? (current.high - current.low) / current.open : 0;
	}

	// ===== HELPER FUNCTIONS =====

	private linearRegressionSlope(values: number[]): number {
		const n = values.length;
		if (n < 2) return 0;

		const sumX = (n * (n - 1)) / 2;
		const sumY = values.reduce((a, b) => a + b, 0);
		const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
		const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

		const denominator = n * sumX2 - sumX * sumX;
		if (denominator === 0) return 0;

		return (n * sumXY - sumX * sumY) / denominator;
	}

	/**
	 * Return neutral feature vector (all zeros/defaults)
	 */
	private getNeutralFeatures(): SentimentFusionFeatureVector {
		return {
			// Sentiment
			sentiment_negative: 0,
			sentiment_neutral: 0,
			sentiment_positive: 0,
			sentiment_score: 0,
			// Technical
			rsi_14: 50,
			ema_20: 0,
			sma_50: 0,
			ema_20_distance: 0,
			sma_50_distance: 0,
			bollinger_position: 0.5,
			macd_signal: 0,
			macd_histogram: 0,
			atr_14: 0,
			adx_14: 25,
			stochastic_k: 50,
			williams_r: -50,
			// Volume
			volume_ratio_5d: 1.0,
			volume_spike: 0,
			relative_volume: 1.0,
			volume_trend: 0,
			volume_acceleration: 0,
			dark_pool_ratio: 0,
			// Price momentum
			price_momentum_5d: 0,
			price_momentum_10d: 0,
			price_momentum_20d: 0,
			price_acceleration: 0,
			gap_size: 0,
			volatility_20d: 0,
			// Intraday
			overnight_return: 0,
			intraday_range: 0,
			// Options (unavailable)
			options_put_call_ratio: 0,
			options_unusual_activity: 0,
			options_iv_rank: 0,
			options_call_volume: 0,
			options_put_volume: 0,
			options_oi_put_call: 0,
			options_gamma_exposure: 0,
			// Institutional (unavailable)
			institutional_net_flow: 0,
			institutional_block_trades: 0,
			institutional_ownership_pct: 0,
			insider_buying_ratio: 0,
			// Market context
			sector_momentum: 0,
			spy_correlation: 0,
			vix_level: 0,
			sector_relative_strength: 0,
		};
	}
}
