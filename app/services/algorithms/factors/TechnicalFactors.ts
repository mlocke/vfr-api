/**
 * Technical Factors Module
 * Contains all technical indicator calculations for the Factor Library
 */

import { TechnicalIndicatorService } from "../../technical-analysis/TechnicalIndicatorService";
import { OHLCData } from "../../technical-analysis/types";
import { RedisCache } from "../../cache/RedisCache";
import { TwelveDataAPI } from "../../financial-data/TwelveDataAPI";

interface MarketDataPoint {
	symbol: string;
	price: number;
	volume: number;
	marketCap: number;
	sector: string;
	exchange: string;
	timestamp: number;
}

interface OptionsDataPoint {
	putCallRatio?: number;
	impliedVolatilityPercentile?: number;
	optionsFlow?: {
		sentiment: number;
		volume: number;
		openInterest: number;
	};
	greeks?: {
		delta: number;
		gamma: number;
		theta: number;
		vega: number;
	};
	volumeDivergence?: number;
	maxPain?: number;
}

interface HistoricalPrice {
	timestamp: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export class TechnicalFactors {
	private technicalService: TechnicalIndicatorService;
	private cache: RedisCache;
	private twelveDataAPI: TwelveDataAPI;
	private historicalDataCache = new Map<string, HistoricalPrice[]>();

	constructor(
		technicalService: TechnicalIndicatorService,
		cache: RedisCache,
		historicalDataCache: Map<string, HistoricalPrice[]>
	) {
		this.technicalService = technicalService;
		this.cache = cache;
		this.twelveDataAPI = new TwelveDataAPI();
		this.historicalDataCache = historicalDataCache;
	}

	async calculateMomentum(symbol: string, periods: number): Promise<number | null> {
		const historicalData = await this.getHistoricalData(symbol, periods + 1);
		if (!historicalData || historicalData.length < periods + 1) {
			return null;
		}

		const currentPrice = historicalData[0].close;
		const pastPrice = historicalData[periods].close;

		if (pastPrice <= 0) return null;

		const momentum = (currentPrice - pastPrice) / pastPrice;

		// Normalize momentum to 0-1 scale (sigmoid transformation)
		return 1 / (1 + Math.exp(-momentum * 5));
	}

	async calculatePriceReversion(
		symbol: string,
		marketData: MarketDataPoint,
		periods: number
	): Promise<number | null> {
		const historicalData = await this.getHistoricalData(symbol, periods);
		if (!historicalData || historicalData.length < periods) {
			return null;
		}

		// Calculate moving average
		const ma =
			historicalData.slice(0, periods).reduce((sum, data) => sum + data.close, 0) / periods;

		// Calculate how far current price is from MA (inverted for reversion)
		const deviation = (marketData.price - ma) / ma;

		// Return higher score when price is below MA (reversion opportunity)
		return 1 / (1 + Math.exp(deviation * 5));
	}

	async calculateSMAAlignment(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 250);
			if (!historicalData || historicalData.length < 50) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const smaResults = technicalResult.trend.indicators.sma;
			if (smaResults.length < 2) return 0.5;

			// Find short and long SMAs
			const shortSMA = smaResults.find(s => s.period === 20);
			const longSMA = smaResults.find(s => s.period === 50);

			if (!shortSMA || !longSMA) return 0.5;

			// Higher score when short SMA > long SMA (bullish alignment)
			const alignmentRatio = shortSMA.value / longSMA.value;
			return Math.max(0, Math.min(1, (alignmentRatio - 0.95) / 0.1));
		} catch (error) {
			console.error(`Error calculating SMA alignment for ${symbol}:`, error);
			return null;
		}
	}

	async calculateEMATrend(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 100);
			if (!historicalData || historicalData.length < 26) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			return technicalResult.trend.strength;
		} catch (error) {
			console.error(`Error calculating EMA trend for ${symbol}:`, error);
			return null;
		}
	}

	async calculateMACDHistogram(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 100);
			if (!historicalData || historicalData.length < 26) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const macdResult = technicalResult.trend.indicators.macd;

			// Normalize histogram value to 0-1 scale
			const normalizedHistogram = Math.max(0, Math.min(1, (macdResult.histogram + 1) / 2));
			return normalizedHistogram;
		} catch (error) {
			console.error(`Error calculating MACD histogram for ${symbol}:`, error);
			return null;
		}
	}

	async calculateBollingerSqueeze(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 100);
			if (!historicalData || historicalData.length < 20) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const bollinger = technicalResult.trend.indicators.bollinger;

			// Calculate band width as percentage of middle band
			const bandWidth = bollinger.width / bollinger.middle;

			// Lower band width indicates squeeze (higher opportunity score)
			return Math.max(0, Math.min(1, 1 - bandWidth * 20));
		} catch (error) {
			console.error(`Error calculating Bollinger squeeze for ${symbol}:`, error);
			return null;
		}
	}

	async calculateStochasticSignal(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 50);
			if (!historicalData || historicalData.length < 14) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const stochastic = technicalResult.momentum.indicators.stochastic;

			// Calculate signal strength based on oversold/overbought conditions
			if (stochastic.signal === "oversold") return 0.8;
			if (stochastic.signal === "overbought") return 0.2;

			// Neutral zone scoring
			return 0.5;
		} catch (error) {
			console.error(`Error calculating Stochastic signal for ${symbol}:`, error);
			return null;
		}
	}

	async calculateWilliamsR(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 50);
			if (!historicalData || historicalData.length < 14) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const williams = technicalResult.momentum.indicators.williams;

			// Convert Williams %R to 0-1 scale (inverted since Williams %R is negative)
			return Math.max(0, Math.min(1, (williams.value + 100) / 100));
		} catch (error) {
			console.error(`Error calculating Williams %R for ${symbol}:`, error);
			return null;
		}
	}

	async calculateROCMomentum(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 50);
			if (!historicalData || historicalData.length < 10) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const roc = technicalResult.momentum.indicators.roc;

			// Normalize ROC to 0-1 scale (sigmoid transformation)
			return 1 / (1 + Math.exp(-roc.value / 5));
		} catch (error) {
			console.error(`Error calculating ROC momentum for ${symbol}:`, error);
			return null;
		}
	}

	async calculateMomentumConvergence(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 100);
			if (!historicalData || historicalData.length < 26) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const momentum = technicalResult.momentum;

			// Check for convergence in momentum signals
			let convergenceScore = 0;
			let signals = 0;

			// RSI signal
			if (momentum.indicators.rsi.signal !== "neutral") {
				signals++;
				convergenceScore += momentum.indicators.rsi.signal === "oversold" ? 1 : 0;
			}

			// Stochastic signal
			if (momentum.indicators.stochastic.signal !== "neutral") {
				signals++;
				convergenceScore += momentum.indicators.stochastic.signal === "oversold" ? 1 : 0;
			}

			// Williams %R signal
			if (momentum.indicators.williams.signal !== "neutral") {
				signals++;
				convergenceScore += momentum.indicators.williams.signal === "oversold" ? 1 : 0;
			}

			return signals > 0 ? convergenceScore / signals : 0.5;
		} catch (error) {
			console.error(`Error calculating momentum convergence for ${symbol}:`, error);
			return null;
		}
	}

	async calculateOBVTrend(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 50);
			if (!historicalData || historicalData.length < 20) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const obv = technicalResult.volume.indicators.obv;

			// Convert trend to numeric score
			if (obv.trend === "rising") return 0.8;
			if (obv.trend === "falling") return 0.2;
			return 0.5;
		} catch (error) {
			console.error(`Error calculating OBV trend for ${symbol}:`, error);
			return null;
		}
	}

	async calculateVWAPPosition(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 50);
			if (!historicalData || historicalData.length < 20) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const vwap = technicalResult.volume.indicators.vwap;

			// Convert position to numeric score
			if (vwap.position === "above") return 0.7;
			if (vwap.position === "below") return 0.3;
			return 0.5;
		} catch (error) {
			console.error(`Error calculating VWAP position for ${symbol}:`, error);
			return null;
		}
	}

	async calculateVolumeConfirmation(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 50);
			if (!historicalData || historicalData.length < 20) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			return technicalResult.volume.confirmation ? 0.8 : 0.2;
		} catch (error) {
			console.error(`Error calculating volume confirmation for ${symbol}:`, error);
			return null;
		}
	}

	async calculateATRVolatility(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 50);
			if (!historicalData || historicalData.length < 14) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const atr = technicalResult.volatility.indicators.atr;
			const currentPrice = ohlcData[ohlcData.length - 1].close;

			// Calculate ATR as percentage of price
			const atrPercent = atr.value / currentPrice;

			// Lower volatility gets higher score for quality strategies
			return Math.max(0, Math.min(1, 1 - atrPercent * 10));
		} catch (error) {
			console.error(`Error calculating ATR volatility for ${symbol}:`, error);
			return null;
		}
	}

	async calculateVolatilityBreakout(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 100);
			if (!historicalData || historicalData.length < 20) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			// Low volatility followed by volume increase suggests breakout potential
			const volatilityLevel = technicalResult.volatility.level;
			const volumeTrend = technicalResult.volume.trend;

			if (volatilityLevel === "low" && volumeTrend === "increasing") return 0.8;
			if (volatilityLevel === "medium" && volumeTrend === "increasing") return 0.6;
			return 0.3;
		} catch (error) {
			console.error(`Error calculating volatility breakout for ${symbol}:`, error);
			return null;
		}
	}

	async calculateCandlestickPatterns(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 50);
			if (!historicalData || historicalData.length < 10) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const patterns = technicalResult.patterns.candlestick;

			if (patterns.length === 0) return 0.5;

			// Calculate average pattern strength, weighted by bullish/bearish direction
			let totalScore = 0;
			patterns.forEach(pattern => {
				let score = pattern.strength;
				if (pattern.direction === "bullish") score *= 1.2;
				if (pattern.direction === "bearish") score *= 0.8;
				totalScore += score;
			});

			return Math.max(0, Math.min(1, totalScore / patterns.length));
		} catch (error) {
			console.error(`Error calculating candlestick patterns for ${symbol}:`, error);
			return null;
		}
	}

	async calculateChartPatterns(symbol: string): Promise<number | null> {
		try {
			const historicalData = await this.getHistoricalData(symbol, 100);
			if (!historicalData || historicalData.length < 50) return null;

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			const patterns = technicalResult.patterns.chart;

			if (patterns.length === 0) return 0.5;

			// Calculate average pattern strength, weighted by bullish/bearish direction
			let totalScore = 0;
			patterns.forEach(pattern => {
				let score = pattern.strength;
				if (pattern.direction === "bullish") score *= 1.2;
				if (pattern.direction === "bearish") score *= 0.8;
				totalScore += score;
			});

			return Math.max(0, Math.min(1, totalScore / patterns.length));
		} catch (error) {
			console.error(`Error calculating chart patterns for ${symbol}:`, error);
			return null;
		}
	}

	async calculateSupportResistance(symbol: string): Promise<number | null> {
		const historicalData = await this.getHistoricalData(symbol, 100);
		if (!historicalData || historicalData.length < 50) return null;

		const prices = historicalData.map(h => h.close);
		const currentPrice = prices[0];

		// Find potential support/resistance levels
		const levels = this.findSupportResistanceLevels(prices);

		// Calculate proximity to key levels
		let score = 0.5;

		levels.forEach(level => {
			const distance = Math.abs(currentPrice - level) / currentPrice;
			if (distance < 0.02) {
				// Within 2% of S/R level
				score += 0.2;
			}
		});

		return Math.max(0, Math.min(1, score));
	}

	async calculateTechnicalMomentumComposite(symbol: string): Promise<number | null> {
		try {
			const factors = await Promise.all([
				this.calculateStochasticSignal(symbol),
				this.calculateWilliamsR(symbol),
				this.calculateROCMomentum(symbol),
				this.calculateMomentumConvergence(symbol),
			]);

			const validFactors = factors.filter((f): f is number => f !== null);
			if (validFactors.length === 0) return null;

			return validFactors.reduce((sum, f) => sum + f, 0) / validFactors.length;
		} catch (error) {
			console.error(`Error calculating technical momentum composite for ${symbol}:`, error);
			return null;
		}
	}

	async calculateTechnicalTrendComposite(symbol: string): Promise<number | null> {
		try {
			const factors = await Promise.all([
				this.calculateSMAAlignment(symbol),
				this.calculateEMATrend(symbol),
				this.calculateMACDHistogram(symbol),
				this.calculateBollingerSqueeze(symbol),
			]);

			const validFactors = factors.filter((f): f is number => f !== null);
			if (validFactors.length === 0) return null;

			return validFactors.reduce((sum, f) => sum + f, 0) / validFactors.length;
		} catch (error) {
			console.error(`Error calculating technical trend composite for ${symbol}:`, error);
			return null;
		}
	}

	async calculateTechnicalOverallScore(symbol: string): Promise<number | null> {
		try {
			console.log(`🔍 Attempting to calculate technical overall score for ${symbol}`);

			// Try to get historical data with fallback to shorter periods
			let historicalData = await this.getHistoricalData(symbol, 250);
			if (!historicalData || historicalData.length < 50) {
				console.log(
					`⚠️ Insufficient long-term data for ${symbol} (${historicalData?.length || 0} points), trying shorter period`
				);
				historicalData = await this.getHistoricalData(symbol, 100);
			}

			if (!historicalData || historicalData.length < 20) {
				console.log(
					`❌ Insufficient historical data for technical analysis of ${symbol}: ${historicalData?.length || 0} points`
				);
				return null;
			}

			console.log(
				`✅ Using ${historicalData.length} data points for technical analysis of ${symbol}`
			);

			const ohlcData: OHLCData[] = historicalData.map(h => ({
				timestamp: h.timestamp,
				open: h.open,
				high: h.high,
				low: h.low,
				close: h.close,
				volume: h.volume,
			}));

			const technicalResult = await this.technicalService.calculateAllIndicators({
				symbol,
				ohlcData,
			});

			console.log(
				`📊 Technical analysis result for ${symbol}: ${technicalResult.score.total}/100`
			);

			// Return normalized score (0-1 scale from 0-100 scale)
			return technicalResult.score.total / 100;
		} catch (error) {
			console.error(`❌ Error calculating technical overall score for ${symbol}:`, error);
			return null;
		}
	}

	async calculateTechnicalOverallScoreWithOptions(
		symbol: string,
		optionsData?: OptionsDataPoint
	): Promise<number | null> {
		try {
			console.log(
				`🔍 Calculating enhanced technical score with options integration for ${symbol}`
			);

			// Calculate traditional technical analysis (85% weight)
			const traditionalTechnicalScore = await this.calculateTechnicalOverallScore(symbol);
			if (traditionalTechnicalScore === null) {
				console.log(`❌ Failed to calculate traditional technical score for ${symbol}`);
				return null;
			}

			// Calculate options score (15% weight)
			const optionsScore = this.calculateOptionsScore(optionsData);
			if (optionsScore === null) {
				console.log(
					`⚠️ No options data for ${symbol}, using traditional technical score only`
				);
				return traditionalTechnicalScore;
			}

			// Combine scores with institutional-grade weighting
			const enhancedTechnicalScore = traditionalTechnicalScore * 0.85 + optionsScore * 0.15;

			console.log(`🎯 Enhanced Technical Analysis for ${symbol}:`);
			console.log(
				`   Traditional Technical: ${traditionalTechnicalScore.toFixed(3)} (85% weight)`
			);
			console.log(`   Options Intelligence: ${optionsScore.toFixed(3)} (15% weight)`);
			console.log(`   Combined Score: ${enhancedTechnicalScore.toFixed(3)}`);

			return Math.max(0, Math.min(1, enhancedTechnicalScore));
		} catch (error) {
			console.error(`❌ Error calculating enhanced technical score for ${symbol}:`, error);
			return null;
		}
	}

	calculateOptionsScore(optionsData?: OptionsDataPoint): number | null {
		if (!optionsData) {
			console.log("⚠️ No options data available - using neutral score");
			return 0.5;
		}

		console.log("📊 Calculating options intelligence score...");

		let totalScore = 0;
		let totalWeight = 0;

		// 1. PUT/CALL RATIO SIGNALS (30% of options score)
		if (optionsData.putCallRatio !== undefined) {
			const pcRatioScore = this.calculatePutCallRatioScore(optionsData.putCallRatio);
			totalScore += pcRatioScore * 0.3;
			totalWeight += 0.3;
			console.log(
				`   P/C Ratio: ${optionsData.putCallRatio.toFixed(2)} → Score: ${pcRatioScore.toFixed(3)} (30% weight)`
			);
		}

		// 2. IMPLIED VOLATILITY PERCENTILE SIGNALS (25% of options score)
		if (optionsData.impliedVolatilityPercentile !== undefined) {
			const ivPercentileScore = this.calculateIVPercentileScore(
				optionsData.impliedVolatilityPercentile
			);
			totalScore += ivPercentileScore * 0.25;
			totalWeight += 0.25;
			console.log(
				`   IV Percentile: ${optionsData.impliedVolatilityPercentile.toFixed(1)}% → Score: ${ivPercentileScore.toFixed(3)} (25% weight)`
			);
		}

		// 3. OPTIONS FLOW SENTIMENT (20% of options score)
		if (optionsData.optionsFlow) {
			const flowScore = this.calculateOptionsFlowScore(optionsData.optionsFlow);
			totalScore += flowScore * 0.2;
			totalWeight += 0.2;
			console.log(
				`   Options Flow: ${optionsData.optionsFlow.sentiment.toFixed(2)} → Score: ${flowScore.toFixed(3)} (20% weight)`
			);
		}

		// 4. MAX PAIN ANALYSIS (15% of options score)
		if (optionsData.maxPain !== undefined) {
			const maxPainScore = 0.5;
			totalScore += maxPainScore * 0.15;
			totalWeight += 0.15;
			console.log(
				`   Max Pain: $${optionsData.maxPain.toFixed(2)} → Score: ${maxPainScore.toFixed(3)} (15% weight)`
			);
		}

		// 5. GREEKS RISK INDICATORS (10% of options score)
		if (optionsData.greeks) {
			const greeksScore = this.calculateGreeksScore(optionsData.greeks);
			totalScore += greeksScore * 0.1;
			totalWeight += 0.1;
			console.log(`   Greeks Analysis → Score: ${greeksScore.toFixed(3)} (10% weight)`);
		}

		// 6. VOLUME DIVERGENCE (10% of options score)
		if (optionsData.volumeDivergence !== undefined) {
			const volumeDivergenceScore = this.calculateVolumeDivergenceScore(
				optionsData.volumeDivergence
			);
			totalScore += volumeDivergenceScore * 0.1;
			totalWeight += 0.1;
			console.log(
				`   Volume Divergence: ${optionsData.volumeDivergence.toFixed(2)} → Score: ${volumeDivergenceScore.toFixed(3)} (10% weight)`
			);
		}

		if (totalWeight === 0) {
			console.log("⚠️ No valid options factors found - using neutral score");
			return 0.5;
		}

		const finalOptionsScore = totalScore / totalWeight;
		console.log(
			`✅ Options Intelligence Score: ${finalOptionsScore.toFixed(3)} (${(totalWeight * 100).toFixed(0)}% data coverage)`
		);

		return Math.max(0, Math.min(1, finalOptionsScore));
	}

	calculatePutCallRatioScore(putCallRatio: number): number {
		if (putCallRatio <= 0.7) {
			return 0.8 + (0.7 - putCallRatio) * 0.4;
		} else if (putCallRatio <= 1.0) {
			return 0.6 + (1.0 - putCallRatio) * 0.67;
		} else if (putCallRatio <= 1.3) {
			return 0.4 + (1.3 - putCallRatio) * 0.67;
		} else {
			return Math.max(0, 0.4 - (putCallRatio - 1.3) * 0.3);
		}
	}

	calculateIVPercentileScore(ivPercentile: number): number {
		if (ivPercentile <= 20) {
			return 0.6 + ivPercentile * 0.005;
		} else if (ivPercentile <= 40) {
			return 0.5 + (ivPercentile - 20) * 0.005;
		} else if (ivPercentile <= 60) {
			return 0.4 + (60 - ivPercentile) * 0.005;
		} else if (ivPercentile <= 80) {
			return 0.3 + (80 - ivPercentile) * 0.005;
		} else {
			return 0.2 + (100 - ivPercentile) * 0.005;
		}
	}

	calculateOptionsFlowScore(optionsFlow: {
		sentiment: number;
		volume: number;
		openInterest: number;
	}): number {
		const baseSentimentScore = (optionsFlow.sentiment + 1) / 2;
		const volumeWeight = Math.min(1, optionsFlow.volume / 1000000);
		const oiWeight = Math.min(1, optionsFlow.openInterest / 100000);
		const confidenceWeight = (volumeWeight + oiWeight) / 2;

		if (confidenceWeight < 0.2) {
			return 0.4 + baseSentimentScore * 0.2;
		} else {
			return baseSentimentScore * confidenceWeight + (1 - confidenceWeight) * 0.5;
		}
	}

	calculateGreeksScore(greeks: {
		delta: number;
		gamma: number;
		theta: number;
		vega: number;
	}): number {
		const deltaScore = Math.abs(greeks.delta);
		const gammaScore = Math.min(1, Math.abs(greeks.gamma) * 100);
		const thetaScore = Math.max(0, Math.min(1, (-greeks.theta + 0.1) / 0.2));
		const vegaScore = Math.min(1, Math.abs(greeks.vega) / 0.5);

		const score = deltaScore * 0.4 + gammaScore * 0.3 + thetaScore * 0.2 + vegaScore * 0.1;
		return Math.max(0, Math.min(1, score));
	}

	calculateVolumeDivergenceScore(volumeDivergence: number): number {
		if (volumeDivergence <= 0.3) {
			return 0.3;
		} else if (volumeDivergence <= 0.7) {
			return 0.4 + volumeDivergence * 0.29;
		} else if (volumeDivergence <= 1.5) {
			return 0.6 + (volumeDivergence - 0.7) * 0.25;
		} else {
			return Math.min(1, 0.8 + (volumeDivergence - 1.5) * 0.4);
		}
	}

	async calculateBollingerPosition(
		symbol: string,
		marketData: MarketDataPoint
	): Promise<number | null> {
		const historicalData = await this.getHistoricalData(symbol, 20);
		if (!historicalData || historicalData.length < 20) {
			return null;
		}

		const prices = historicalData.slice(0, 20).map(d => d.close);
		const ma = prices.reduce((sum, p) => sum + p, 0) / 20;

		const variance = prices.reduce((sum, p) => sum + Math.pow(p - ma, 2), 0) / 20;
		const stdDev = Math.sqrt(variance);

		const upperBand = ma + 2 * stdDev;
		const lowerBand = ma - 2 * stdDev;

		const position = (marketData.price - lowerBand) / (upperBand - lowerBand);
		return 1 - Math.max(0, Math.min(1, position));
	}

	async calculateVolatilityScore(symbol: string, periods: number): Promise<number | null> {
		console.log(`Calculating ${periods}-day volatility for ${symbol}`);

		const historicalData = await this.getHistoricalData(symbol, periods);
		if (!historicalData || historicalData.length < periods) {
			console.warn(
				`Insufficient historical data for ${symbol}: got ${historicalData?.length || 0}, needed ${periods}`
			);
			return null;
		}

		const returns: number[] = [];
		for (let i = 0; i < Math.min(periods - 1, historicalData.length - 1); i++) {
			const currentPrice = historicalData[i].close;
			const previousPrice = historicalData[i + 1].close;

			if (previousPrice > 0 && currentPrice > 0) {
				const dailyReturn = (currentPrice - previousPrice) / previousPrice;
				returns.push(dailyReturn);
			}
		}

		if (returns.length === 0) {
			console.warn(`No valid returns calculated for ${symbol}`);
			return null;
		}

		console.log(`Calculated ${returns.length} daily returns for ${symbol}`);

		const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
		const variance =
			returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
		const dailyVolatility = Math.sqrt(variance);
		const annualizedVolatility = dailyVolatility * Math.sqrt(252);

		console.log(`${symbol} volatility stats:`, {
			periods: returns.length,
			dailyVol: dailyVolatility.toFixed(4),
			annualizedVol: annualizedVolatility.toFixed(4),
			meanReturn: meanReturn.toFixed(4),
		});

		const normalizedVol = Math.max(0, Math.min(1, annualizedVolatility));
		const volatilityScore = 1 - normalizedVol;

		console.log(
			`${symbol} volatility score: ${volatilityScore.toFixed(3)} (lower volatility = higher score)`
		);

		return Math.max(0, Math.min(1, volatilityScore));
	}

	async calculateVolatilityRatio(symbol: string): Promise<number | null> {
		const shortTermVol = await this.calculateVolatilityScore(symbol, 10);
		const longTermVol = await this.calculateVolatilityScore(symbol, 60);

		if (shortTermVol === null || longTermVol === null || longTermVol === 0) return null;

		const volRatio = (1 - shortTermVol) / (1 - longTermVol);
		return Math.max(0, Math.min(1, volRatio / 2));
	}

	async calculateBetaScore(symbol: string): Promise<number | null> {
		return 0.5;
	}

	calculateRSIScore(rsi?: number): number | null {
		if (rsi === undefined) return null;

		if (rsi <= 30) return 1;
		if (rsi >= 70) return 0;

		return 1 - (rsi - 30) / 40;
	}

	calculateMACDScore(macd?: {
		signal: number;
		histogram: number;
		macd: number;
	}): number | null {
		if (!macd) return null;

		const { histogram, macd: macdLine, signal } = macd;

		const signalCross = macdLine > signal ? 1 : 0;
		const momentumScore = histogram > 0 ? 1 : 0;

		return (signalCross + momentumScore) / 2;
	}

	// Helper methods
	private findSupportResistanceLevels(prices: number[]): number[] {
		const levels: number[] = [];
		const window = 10;

		for (let i = window; i < prices.length - window; i++) {
			const price = prices[i];
			let isSupport = true;
			let isResistance = true;

			for (let j = i - window; j <= i + window; j++) {
				if (prices[j] < price) {
					isSupport = false;
					break;
				}
			}

			for (let j = i - window; j <= i + window; j++) {
				if (prices[j] > price) {
					isResistance = false;
					break;
				}
			}

			if (isSupport || isResistance) {
				levels.push(price);
			}
		}

		return levels;
	}

	private async getHistoricalData(
		symbol: string,
		periods: number
	): Promise<HistoricalPrice[] | null> {
		const cached = this.historicalDataCache.get(symbol);
		if (cached && cached.length >= periods) {
			return cached.slice(0, periods);
		}

		try {
			const historicalData = await this.fetchHistoricalPrices(symbol, periods);

			if (historicalData && historicalData.length > 0) {
				this.historicalDataCache.set(symbol, historicalData);
				return historicalData;
			}

			return null;
		} catch (error) {
			console.error(`Error fetching historical data for ${symbol}:`, error);
			return null;
		}
	}

	private async fetchHistoricalPrices(
		symbol: string,
		periods: number
	): Promise<HistoricalPrice[]> {
		try {
			console.log(`Fetching ${periods} days of historical data for ${symbol}`);

			const historicalData = await this.twelveDataAPI.getHistoricalOHLC(symbol, periods);

			if (!historicalData || historicalData.length === 0) {
				console.warn(`No historical data available for ${symbol}`);
				return [];
			}

			const convertedData: HistoricalPrice[] = historicalData.map(ohlc => ({
				timestamp: ohlc.timestamp,
				open: ohlc.open,
				high: ohlc.high,
				low: ohlc.low,
				close: ohlc.close,
				volume: ohlc.volume,
			}));

			convertedData.sort((a, b) => b.timestamp - a.timestamp);

			console.log(
				`Successfully fetched ${convertedData.length} historical price points for ${symbol}`
			);
			return convertedData;
		} catch (error) {
			console.error(`Error fetching historical data for ${symbol}:`, error);
			return [];
		}
	}
}
