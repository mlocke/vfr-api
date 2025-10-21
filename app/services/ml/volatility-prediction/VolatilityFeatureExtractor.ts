/**
 * Volatility Feature Extractor
 *
 * Extracts 28 features for volatility prediction model v1.0.0:
 * - Volatility History (8 features)
 * - Price Action (8 features)
 * - Volume (5 features)
 * - Smart Money (5 features) - reused from LeanSmartMoneyFeatureExtractor
 * - Macro (3 features)
 *
 * Pattern: Follows LeanSmartMoneyFeatureExtractor.ts
 */

import type { VolatilityFeatures } from './types';
import { PolygonAPI } from '../../financial-data/PolygonAPI';
import { LeanSmartMoneyFeatureExtractor } from '../smart-money-flow/LeanSmartMoneyFeatureExtractor';

export class VolatilityFeatureExtractor {
	private polygonAPI: PolygonAPI;
	private smartMoneyExtractor: LeanSmartMoneyFeatureExtractor;

	constructor() {
		this.polygonAPI = new PolygonAPI();
		this.smartMoneyExtractor = new LeanSmartMoneyFeatureExtractor();
	}

	/**
	 * Extract all 28 volatility features for a symbol at a specific date
	 */
	async extractFeatures(
		symbol: string,
		asOfDate?: Date
	): Promise<VolatilityFeatures> {
		const startTime = Date.now();
		const targetDate = asOfDate || new Date();

		console.log(`[VolatilityExtractor] Extracting 28 features for ${symbol} as of ${targetDate.toISOString().split('T')[0]}`);

		// Calculate time windows
		const date7dAgo = new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
		const date14dAgo = new Date(targetDate.getTime() - 14 * 24 * 60 * 60 * 1000);
		const date21dAgo = new Date(targetDate.getTime() - 21 * 24 * 60 * 60 * 1000);
		const date30dAgo = new Date(targetDate.getTime() - 30 * 24 * 60 * 60 * 1000);
		const date50dAgo = new Date(targetDate.getTime() - 50 * 24 * 60 * 60 * 1000);
		const date90dAgo = new Date(targetDate.getTime() - 90 * 24 * 60 * 60 * 1000);

		// Fetch price/volume data from Polygon (need 90 days for all indicators)
		const ohlcvBars = await this.fetchOHLCVData(symbol, date90dAgo, targetDate);

		// Extract all feature groups
		const [
			volatilityFeatures,
			priceFeatures,
			volumeFeatures,
			macroFeatures
		] = await Promise.all([
			this.extractVolatilityHistory(ohlcvBars, date7dAgo, date14dAgo, date21dAgo, date30dAgo, date50dAgo),
			this.extractPriceAction(ohlcvBars, date21dAgo),
			this.extractVolumeFeatures(ohlcvBars, date21dAgo),
			this.extractMacroFeatures(symbol, targetDate)
		]);

		// Extract smart money features (reuse from LeanSmartMoneyFeatureExtractor)
		const smartMoneyFeatures = await this.extractSmartMoneyFeatures(symbol, targetDate);

		// Combine all 28 features
		const features: VolatilityFeatures = {
			...volatilityFeatures,
			...priceFeatures,
			...volumeFeatures,
			...smartMoneyFeatures,
			...macroFeatures,
			symbol,
			timestamp: targetDate.getTime()
		};

		const duration = Date.now() - startTime;
		console.log(`[VolatilityExtractor] Feature extraction for ${symbol} completed in ${duration}ms`);

		// Validate all 28 features are present
		this.validateFeatures(features, symbol);

		return features;
	}

	// ===== OHLCV DATA FETCHING =====

	private async fetchOHLCVData(
		symbol: string,
		startDate: Date,
		endDate: Date
	): Promise<any[]> {
		try {
			const bars = await this.polygonAPI.getAggregates(
				symbol,
				1,
				'day',
				startDate,
				endDate
			);

			if (!bars || bars.length === 0) {
				throw new Error(`No OHLCV data returned from Polygon for ${symbol}`);
			}

			// Ensure bars are sorted by timestamp
			return bars.sort((a, b) => a.timestamp - b.timestamp);
		} catch (error) {
			const err = error as Error;
			throw new Error(`OHLCV fetch failed for ${symbol}: ${err.message}`);
		}
	}

	// ===== VOLATILITY HISTORY FEATURES (8) =====

	private async extractVolatilityHistory(
		bars: any[],
		date7dAgo: Date,
		date14dAgo: Date,
		date21dAgo: Date,
		date30dAgo: Date,
		date50dAgo: Date
	): Promise<Pick<
		VolatilityFeatures,
		'atr_14' | 'atr_21' | 'atr_50' |
		'realized_vol_7d' | 'realized_vol_14d' | 'realized_vol_21d' | 'realized_vol_30d' |
		'parkinson_volatility'
	>> {
		if (bars.length < 50) {
			throw new Error(`Insufficient data for volatility features: need 50+ bars, got ${bars.length}`);
		}

		// ATR calculations (Average True Range)
		const atr_14 = this.calculateATR(bars, 14);
		const atr_21 = this.calculateATR(bars, 21);
		const atr_50 = this.calculateATR(bars, 50);

		// Realized volatility (annualized std dev of returns)
		const realized_vol_7d = this.calculateRealizedVol(bars, 7);
		const realized_vol_14d = this.calculateRealizedVol(bars, 14);
		const realized_vol_21d = this.calculateRealizedVol(bars, 21);
		const realized_vol_30d = this.calculateRealizedVol(bars, 30);

		// Parkinson volatility (high-low range based)
		const parkinson_volatility = this.calculateParkinsonVol(bars, 20);

		return {
			atr_14,
			atr_21,
			atr_50,
			realized_vol_7d,
			realized_vol_14d,
			realized_vol_21d,
			realized_vol_30d,
			parkinson_volatility
		};
	}

	private calculateATR(bars: any[], period: number): number {
		if (bars.length < period + 1) {
			throw new Error(`Insufficient bars for ATR(${period})`);
		}

		const trueRanges = [];
		for (let i = 1; i < bars.length; i++) {
			const high = bars[i].high;
			const low = bars[i].low;
			const prevClose = bars[i - 1].close;

			const highLow = high - low;
			const highClose = Math.abs(high - prevClose);
			const lowClose = Math.abs(low - prevClose);

			trueRanges.push(Math.max(highLow, highClose, lowClose));
		}

		// Average of last 'period' true ranges
		const recentTR = trueRanges.slice(-period);
		return recentTR.reduce((a, b) => a + b, 0) / recentTR.length;
	}

	private calculateRealizedVol(bars: any[], period: number): number {
		if (bars.length < period + 1) {
			throw new Error(`Insufficient bars for realized vol(${period})`);
		}

		const returns = [];
		for (let i = 1; i < bars.length; i++) {
			const logReturn = Math.log(bars[i].close / bars[i - 1].close);
			returns.push(logReturn);
		}

		// Std dev of last 'period' returns
		const recentReturns = returns.slice(-period);
		const mean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
		const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;
		const stdDev = Math.sqrt(variance);

		// Annualize (252 trading days)
		return stdDev * Math.sqrt(252) * 100; // Return as percentage
	}

	private calculateParkinsonVol(bars: any[], period: number): number {
		if (bars.length < period) {
			throw new Error(`Insufficient bars for Parkinson vol(${period})`);
		}

		const recentBars = bars.slice(-period);
		const logHLRatios = recentBars.map(bar => {
			const ratio = bar.high / bar.low;
			return Math.pow(Math.log(ratio), 2);
		});

		const avgLogHLRatio = logHLRatios.reduce((a, b) => a + b, 0) / logHLRatios.length;
		const parkinsonVar = avgLogHLRatio / (4 * Math.log(2));
		const parkinsonVol = Math.sqrt(parkinsonVar);

		// Annualize
		return parkinsonVol * Math.sqrt(252) * 100; // Return as percentage
	}

	// ===== PRICE ACTION FEATURES (8) =====

	private async extractPriceAction(
		bars: any[],
		date21dAgo: Date
	): Promise<Pick<
		VolatilityFeatures,
		'close_price' | 'high_low_range' | 'rsi_14' | 'macd' | 'macd_signal' |
		'bollinger_pct_b' | 'adx' | 'price_roc_21'
	>> {
		if (bars.length < 30) {
			throw new Error(`Insufficient data for price action features: need 30+ bars, got ${bars.length}`);
		}

		const latestBar = bars[bars.length - 1];

		return {
			close_price: latestBar.close,
			high_low_range: latestBar.high - latestBar.low,
			rsi_14: this.calculateRSI(bars, 14),
			...this.calculateMACD(bars, 12, 26, 9),
			bollinger_pct_b: this.calculateBollingerPctB(bars, 20, 2),
			adx: this.calculateADX(bars, 14),
			price_roc_21: this.calculatePriceROC(bars, 21)
		};
	}

	private calculateRSI(bars: any[], period: number): number {
		if (bars.length < period + 1) return 50; // Neutral

		const changes = [];
		for (let i = 1; i < bars.length; i++) {
			changes.push(bars[i].close - bars[i - 1].close);
		}

		const recentChanges = changes.slice(-period);
		const gains = recentChanges.filter(c => c > 0);
		const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c));

		const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
		const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

		if (avgLoss === 0) return 100;
		const rs = avgGain / avgLoss;
		return 100 - (100 / (1 + rs));
	}

	private calculateMACD(bars: any[], fast: number, slow: number, signal: number): { macd: number; macd_signal: number } {
		if (bars.length < slow + signal) {
			return { macd: 0, macd_signal: 0 };
		}

		const closes = bars.map(b => b.close);

		// EMA calculation
		const emaFast = this.calculateEMA(closes, fast);
		const emaSlow = this.calculateEMA(closes, slow);

		const macdLine = emaFast - emaSlow;

		// Signal line is EMA of MACD (simplified: just use current MACD)
		return {
			macd: macdLine,
			macd_signal: macdLine * 0.9 // Simplified signal approximation
		};
	}

	private calculateEMA(values: number[], period: number): number {
		if (values.length < period) return values[values.length - 1];

		const multiplier = 2 / (period + 1);
		let ema = values.slice(-period).reduce((a, b) => a + b, 0) / period;

		for (let i = values.length - period + 1; i < values.length; i++) {
			ema = (values[i] - ema) * multiplier + ema;
		}

		return ema;
	}

	private calculateBollingerPctB(bars: any[], period: number, stdDev: number): number {
		if (bars.length < period) return 0.5; // Neutral

		const recentCloses = bars.slice(-period).map(b => b.close);
		const sma = recentCloses.reduce((a, b) => a + b, 0) / period;
		const variance = recentCloses.reduce((sum, c) => sum + Math.pow(c - sma, 2), 0) / period;
		const sd = Math.sqrt(variance);

		const upperBand = sma + (stdDev * sd);
		const lowerBand = sma - (stdDev * sd);
		const currentPrice = bars[bars.length - 1].close;

		if (upperBand === lowerBand) return 0.5;
		return (currentPrice - lowerBand) / (upperBand - lowerBand);
	}

	private calculateADX(bars: any[], period: number): number {
		// Simplified ADX calculation (just return trend strength 0-100)
		if (bars.length < period + 1) return 20; // Default moderate trend

		// Directional movement
		let positiveDM = 0;
		let negativeDM = 0;

		for (let i = 1; i < bars.length; i++) {
			const highDiff = bars[i].high - bars[i - 1].high;
			const lowDiff = bars[i - 1].low - bars[i].low;

			if (highDiff > lowDiff && highDiff > 0) positiveDM += highDiff;
			if (lowDiff > highDiff && lowDiff > 0) negativeDM += lowDiff;
		}

		const totalMovement = positiveDM + negativeDM;
		if (totalMovement === 0) return 20;

		// ADX is a measure of trend strength (0-100)
		const dx = Math.abs(positiveDM - negativeDM) / totalMovement * 100;
		return Math.min(dx, 100);
	}

	private calculatePriceROC(bars: any[], period: number): number {
		if (bars.length < period + 1) return 0;

		const currentPrice = bars[bars.length - 1].close;
		const pastPrice = bars[bars.length - 1 - period].close;

		return ((currentPrice - pastPrice) / pastPrice) * 100;
	}

	// ===== VOLUME FEATURES (5) =====

	private async extractVolumeFeatures(
		bars: any[],
		date21dAgo: Date
	): Promise<Pick<
		VolatilityFeatures,
		'volume' | 'volume_roc' | 'volume_ma_ratio' | 'vwap_deviation' | 'dark_pool_volume'
	>> {
		if (bars.length < 21) {
			throw new Error(`Insufficient data for volume features: need 21+ bars, got ${bars.length}`);
		}

		const latestBar = bars[bars.length - 1];

		// Volume ROC
		const volume_roc = this.calculateVolumeROC(bars, 21);

		// Volume MA ratio (current volume / 20-day average)
		const recentVolumes = bars.slice(-20).map(b => b.volume);
		const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
		const volume_ma_ratio = avgVolume > 0 ? latestBar.volume / avgVolume : 1;

		// VWAP deviation (simplified: price - VWAP / VWAP)
		const vwap = this.calculateVWAP(bars.slice(-20));
		const vwap_deviation = vwap > 0 ? (latestBar.close - vwap) / vwap : 0;

		// Dark pool estimate (from LeanSmartMoneyFeatureExtractor pattern)
		const dark_pool_volume = avgVolume * 0.35; // Estimate ~35% dark pool

		return {
			volume: latestBar.volume,
			volume_roc,
			volume_ma_ratio,
			vwap_deviation,
			dark_pool_volume
		};
	}

	private calculateVolumeROC(bars: any[], period: number): number {
		if (bars.length < period + 1) return 0;

		const currentVolume = bars[bars.length - 1].volume;
		const pastVolume = bars[bars.length - 1 - period].volume;

		if (pastVolume === 0) return 0;
		return ((currentVolume - pastVolume) / pastVolume) * 100;
	}

	private calculateVWAP(bars: any[]): number {
		let cumTPV = 0; // Cumulative (Typical Price × Volume)
		let cumVolume = 0;

		for (const bar of bars) {
			const typicalPrice = (bar.high + bar.low + bar.close) / 3;
			cumTPV += typicalPrice * bar.volume;
			cumVolume += bar.volume;
		}

		return cumVolume > 0 ? cumTPV / cumVolume : 0;
	}

	// ===== SMART MONEY FEATURES (5) - Reuse from LeanSmartMoneyFeatureExtractor =====

	private async extractSmartMoneyFeatures(
		symbol: string,
		targetDate: Date
	): Promise<Pick<
		VolatilityFeatures,
		'insider_buy_sell_ratio' | 'institutional_volume_ratio' |
		'volume_concentration' | 'block_trade_ratio' | 'whale_activity_score'
	>> {
		try {
			// Reuse LeanSmartMoneyFeatureExtractor to get these features
			const smartMoneyFeatures = await this.smartMoneyExtractor.extractFeatures(symbol, targetDate);

			// Map from LeanSmartMoney naming to Volatility naming
			return {
				insider_buy_sell_ratio: smartMoneyFeatures.congress_net_sentiment, // Use congress sentiment as proxy
				institutional_volume_ratio: smartMoneyFeatures.institutional_volume_ratio,
				volume_concentration: smartMoneyFeatures.volume_concentration,
				block_trade_ratio: smartMoneyFeatures.large_block_call_pct, // Use options block trades as proxy
				whale_activity_score: smartMoneyFeatures.volume_trend_30d // Use volume trend as proxy for whale activity
			};
		} catch (error) {
			// If smart money features unavailable, use median fallback values from training
			console.warn(`Smart money features unavailable for ${symbol}, using fallback values`);
			return {
				insider_buy_sell_ratio: 0.1473,
				institutional_volume_ratio: 0.5099,
				volume_concentration: 2.3187,
				block_trade_ratio: 0.0333,
				whale_activity_score: 1.0
			};
		}
	}

	// ===== MACRO FEATURES (3) =====

	private async extractMacroFeatures(
		symbol: string,
		targetDate: Date
	): Promise<Pick<VolatilityFeatures, 'vix_level' | 'sector_volatility' | 'market_cap_log'>> {
		try {
			// Fetch VIX from Polygon (^VIX symbol)
			const vixDate7dAgo = new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
			const vixBars = await this.polygonAPI.getAggregates('^VIX', 1, 'day', vixDate7dAgo, targetDate);
			const vix_level = vixBars && vixBars.length > 0 ? vixBars[vixBars.length - 1].close : 15; // Default VIX

			// Fetch sector ETF (SPY) volatility
			const spyDate30dAgo = new Date(targetDate.getTime() - 30 * 24 * 60 * 60 * 1000);
			const spyBars = await this.polygonAPI.getAggregates('SPY', 1, 'day', spyDate30dAgo, targetDate);
			const sector_volatility = spyBars && spyBars.length >= 30
				? this.calculateRealizedVol(spyBars, 30)
				: 15; // Default sector vol

			// Market cap fallback (would need separate API call - using median from training)
			const market_cap_log = 11.0114; // Median from training data

			return {
				vix_level,
				sector_volatility,
				market_cap_log
			};
		} catch (error) {
			// Fallback to median values from training if macro data unavailable
			console.warn(`Macro features unavailable for ${symbol}, using fallback values`);
			return {
				vix_level: 15,
				sector_volatility: 15,
				market_cap_log: 11.0114
			};
		}
	}

	// ===== VALIDATION =====

	private validateFeatures(features: VolatilityFeatures, symbol: string): void {
		const featureNames = [
			'atr_14', 'atr_21', 'atr_50',
			'realized_vol_7d', 'realized_vol_14d', 'realized_vol_21d', 'realized_vol_30d',
			'parkinson_volatility',
			'close_price', 'high_low_range', 'rsi_14', 'macd', 'macd_signal',
			'bollinger_pct_b', 'adx', 'price_roc_21',
			'volume', 'volume_roc', 'volume_ma_ratio', 'vwap_deviation', 'dark_pool_volume',
			'insider_buy_sell_ratio', 'institutional_volume_ratio', 'volume_concentration',
			'block_trade_ratio', 'whale_activity_score',
			'vix_level', 'sector_volatility', 'market_cap_log'
		];

		const missingFeatures: string[] = [];
		const invalidFeatures: string[] = [];

		for (const name of featureNames) {
			const value = features[name as keyof VolatilityFeatures];

			if (value === undefined || value === null) {
				missingFeatures.push(name);
				continue;
			}

			if (typeof value === 'number' && (!isFinite(value) || isNaN(value))) {
				invalidFeatures.push(`${name}=${value}`);
			}
		}

		if (missingFeatures.length > 0 || invalidFeatures.length > 0) {
			const errors = [];
			if (missingFeatures.length > 0) {
				errors.push(`Missing: ${missingFeatures.join(', ')}`);
			}
			if (invalidFeatures.length > 0) {
				errors.push(`Invalid: ${invalidFeatures.join(', ')}`);
			}
			throw new Error(`Feature validation failed for ${symbol}: ${errors.join('; ')}`);
		}

		console.log(`[VolatilityExtractor] ✅ All 28 features validated for ${symbol}`);
	}
}
