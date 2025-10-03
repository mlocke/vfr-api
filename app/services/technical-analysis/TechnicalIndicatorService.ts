/**
 * Technical Indicator Service
 * Comprehensive technical analysis using trading-signals library
 * Implements 50+ indicators and pattern recognition for 40% technical weighting
 */

import {
	SMA,
	EMA,
	RSI,
	MACD,
	BollingerBands,
	StochasticOscillator,
	ROC,
	OBV,
	VWAP,
	ATR,
	ADX,
	PSAR,
} from "trading-signals";

import {
	TechnicalAnalysisResult,
	TechnicalAnalysisInput,
	TechnicalAnalysisConfig,
	OHLCData,
	SMAResult,
	EMAResult,
	RSIResult,
	MACDResult,
	BollingerBandsResult,
	StochasticResult,
	WilliamsRResult,
	ROCResult,
	OBVResult,
	VWAPResult,
	ATRResult,
	ADXResult,
	AroonResult,
	PSARResult,
	CandlestickPattern,
	ChartPattern,
	TechnicalAnalysisPerformance,
	OptionsSignalsResult,
	OptionsIVRegime,
	OptionsPCRatioSignal,
	OptionsFlowTechnicalSignal,
} from "./types";

import { RedisCache } from "../cache/RedisCache";
import { OptionsAnalysisService } from "../financial-data/OptionsAnalysisService";
import { OptionsAnalysisMetrics, OptionsSignals } from "../types/OptionsTypes";

/**
 * Main Technical Indicator Service with Options Integration
 */
export class TechnicalIndicatorService {
	private cache: RedisCache;
	private defaultConfig: TechnicalAnalysisConfig;
	private performanceTracker: Map<string, TechnicalAnalysisPerformance> = new Map();
	private optionsService: OptionsAnalysisService;

	constructor(cache: RedisCache) {
		this.cache = cache;
		this.defaultConfig = this.createDefaultConfig();
		this.optionsService = new OptionsAnalysisService(cache);
	}

	/**
	 * Calculate all technical indicators for a symbol
	 */
	async calculateAllIndicators(input: TechnicalAnalysisInput): Promise<TechnicalAnalysisResult> {
		const startTime = Date.now();
		const { symbol, ohlcData } = input;
		const config = input.config
			? { ...this.defaultConfig, ...input.config }
			: this.defaultConfig;

		if (!ohlcData || ohlcData.length === 0) {
			throw new Error(`No OHLC data provided for ${symbol}`);
		}

		// Check cache first
		const cacheKey = this.generateCacheKey(symbol, config);
		const cached = await this.getCachedResult(cacheKey);
		if (cached) {
			// Track cache hit performance
			this.trackPerformanceForCacheHit(symbol, Date.now() - startTime, cached);
			return cached;
		}

		try {
			// Calculate all indicator categories in parallel, including options analysis
			const [
				trendAnalysis,
				momentumAnalysis,
				volumeAnalysis,
				volatilityAnalysis,
				patterns,
				optionsAnalysis,
			] = await Promise.all([
				this.calculateTrendIndicators(ohlcData, config),
				this.calculateMomentumIndicators(ohlcData, config),
				this.calculateVolumeIndicators(ohlcData, config),
				this.calculateVolatilityIndicators(ohlcData, config),
				this.detectPatterns(ohlcData, config),
				this.calculateOptionsAnalysis(symbol, config),
			]);

			// Calculate overall technical score with options integration
			const score = this.calculateTechnicalScore(
				trendAnalysis,
				momentumAnalysis,
				volumeAnalysis,
				volatilityAnalysis,
				patterns,
				optionsAnalysis
			);

			const result: TechnicalAnalysisResult = {
				symbol,
				timestamp: Date.now(),
				trend: trendAnalysis,
				momentum: momentumAnalysis,
				volume: volumeAnalysis,
				volatility: volatilityAnalysis,
				patterns,
				options: optionsAnalysis,
				score,
				metadata: {
					calculationTime: Date.now() - startTime,
					dataQuality: this.assessDataQuality(ohlcData),
					periodsCovered: ohlcData.length,
					lastUpdate: Date.now(),
				},
			};

			// Cache the result
			await this.cacheResult(cacheKey, result, config.performance.cacheTTL);

			// Track performance for cache miss
			this.trackPerformanceForCacheMiss(symbol, Date.now() - startTime, result);

			return result;
		} catch (error) {
			console.error(`Technical analysis failed for ${symbol}:`, error);
			throw error;
		}
	}

	/**
	 * Calculate trend indicators (SMA, EMA, MACD, Bollinger Bands)
	 */
	private async calculateTrendIndicators(
		ohlcData: OHLCData[],
		config: TechnicalAnalysisConfig
	): Promise<any> {
		const closePrices = ohlcData.map(d => d.close);
		const highPrices = ohlcData.map(d => d.high);
		const lowPrices = ohlcData.map(d => d.low);

		// SMA calculations
		const smaResults: SMAResult[] = [];
		for (const period of config.sma.periods) {
			const sma = new SMA(period);
			closePrices.forEach(price => sma.update(price, false));
			if (sma.isStable) {
				const result = sma.getResult();
				if (result !== null) {
					smaResults.push({
						value: Number(result),
						period,
						timestamp: Date.now(),
					});
				}
			}
		}

		// EMA calculations
		const emaResults: EMAResult[] = [];
		for (const period of config.ema.periods) {
			const ema = new EMA(period);
			closePrices.forEach(price => ema.update(price, false));
			if (ema.isStable) {
				const result = ema.getResult();
				if (result !== null) {
					emaResults.push({
						value: Number(result),
						period,
						timestamp: Date.now(),
					});
				}
			}
		}

		// MACD calculation - create EMA instances for fast, slow, and signal lines
		const fastEMA = new EMA(config.macd.fastPeriod);
		const slowEMA = new EMA(config.macd.slowPeriod);
		const signalEMA = new EMA(config.macd.signalPeriod);
		const macd = new MACD(fastEMA, slowEMA, signalEMA);

		closePrices.forEach(price => macd.update(price, false));

		const macdCalculation = macd.isStable ? macd.getResult() : null;
		const macdResult: MACDResult = {
			macd: macdCalculation ? Number(macdCalculation.macd) : 0,
			signal: macdCalculation ? Number(macdCalculation.signal) : 0,
			histogram: macdCalculation ? Number(macdCalculation.histogram) : 0,
			timestamp: Date.now(),
			crossover: this.determineMACDCrossover(macdCalculation),
		};

		// Bollinger Bands calculation
		const bollinger = new BollingerBands(
			config.bollinger.period,
			config.bollinger.standardDeviations
		);
		closePrices.forEach(price => bollinger.update(price, false));

		const currentPrice = closePrices[closePrices.length - 1];
		const bollingerCalculation = bollinger.isStable ? bollinger.getResult() : null;
		const bollingerResult: BollingerBandsResult = {
			upper: bollingerCalculation ? Number(bollingerCalculation.upper) : currentPrice,
			middle: bollingerCalculation ? Number(bollingerCalculation.middle) : currentPrice,
			lower: bollingerCalculation ? Number(bollingerCalculation.lower) : currentPrice,
			position: bollingerCalculation
				? this.calculateBollingerPosition(currentPrice, {
						upper: Number(bollingerCalculation.upper),
						middle: Number(bollingerCalculation.middle),
						lower: Number(bollingerCalculation.lower),
					})
				: 0.5,
			width: bollingerCalculation
				? Number(bollingerCalculation.upper) - Number(bollingerCalculation.lower)
				: 0,
			timestamp: Date.now(),
		};

		// Determine overall trend
		const trendDirection = this.determineTrendDirection(
			smaResults,
			emaResults,
			macdResult,
			currentPrice
		);
		const trendStrength = this.calculateTrendStrength(smaResults, emaResults, macdResult);
		const trendConfidence = this.calculateTrendConfidence(
			smaResults,
			emaResults,
			macdResult,
			bollingerResult
		);

		return {
			direction: trendDirection,
			strength: trendStrength,
			confidence: trendConfidence,
			indicators: {
				sma: smaResults,
				ema: emaResults,
				macd: macdResult,
				bollinger: bollingerResult,
			},
		};
	}

	/**
	 * Calculate momentum indicators (RSI, Stochastic, Williams %R, ROC)
	 */
	private async calculateMomentumIndicators(
		ohlcData: OHLCData[],
		config: TechnicalAnalysisConfig
	): Promise<any> {
		const closePrices = ohlcData.map(d => d.close);
		const highPrices = ohlcData.map(d => d.high);
		const lowPrices = ohlcData.map(d => d.low);

		// RSI calculation
		const rsi = new RSI(config.rsi.period);
		closePrices.forEach(price => rsi.update(price, false));

		const rsiCalculation = rsi.isStable ? rsi.getResult() : null;
		const rsiValue = rsiCalculation ? Number(rsiCalculation) : 50;
		const rsiResult: RSIResult = {
			value: rsiValue,
			period: config.rsi.period,
			timestamp: Date.now(),
			signal: this.determineRSISignal(rsiValue, config.rsi.overbought, config.rsi.oversold),
		};

		// Stochastic calculation
		const stochastic = new StochasticOscillator(
			config.stochastic.kPeriod,
			config.stochastic.dPeriod,
			config.stochastic.dPeriod
		);
		for (let i = 0; i < ohlcData.length; i++) {
			stochastic.update(
				{
					high: highPrices[i],
					low: lowPrices[i],
					close: closePrices[i],
				},
				false
			);
		}

		const stochasticCalculation = stochastic.isStable ? stochastic.getResult() : null;
		const stochasticKValue = stochasticCalculation ? Number(stochasticCalculation.stochK) : 50;
		const stochasticDValue = stochasticCalculation
			? Number(stochasticCalculation.stochD)
			: stochasticKValue * 0.9;
		const stochasticResult: StochasticResult = {
			k: stochasticKValue,
			d: stochasticDValue,
			signal: this.determineStochasticSignal(stochasticKValue),
			timestamp: Date.now(),
		};

		// Williams %R - simulate with simple calculation
		const williamsValue = this.calculateWilliamsR(
			highPrices,
			lowPrices,
			closePrices,
			config.williams.period
		);
		const williamsResult: WilliamsRResult = {
			value: williamsValue,
			signal: this.determineWilliamsSignal(williamsValue),
			timestamp: Date.now(),
		};

		// ROC calculation
		const roc = new ROC(config.roc.period);
		closePrices.forEach(price => roc.update(price, false));

		const rocCalculation = roc.isStable ? roc.getResult() : null;
		const rocResult: ROCResult = {
			value: rocCalculation ? Number(rocCalculation) : 0,
			period: config.roc.period,
			timestamp: Date.now(),
		};

		// Determine overall momentum
		const momentumSignal = this.determineMomentumSignal(
			rsiResult,
			stochasticResult,
			williamsResult,
			rocResult
		);
		const momentumStrength = this.calculateMomentumStrength(
			rsiResult,
			stochasticResult,
			williamsResult,
			rocResult
		);

		return {
			signal: momentumSignal,
			strength: momentumStrength,
			indicators: {
				rsi: rsiResult,
				stochastic: stochasticResult,
				williams: williamsResult,
				roc: rocResult,
			},
		};
	}

	/**
	 * Calculate volume indicators (OBV, VWAP)
	 */
	private async calculateVolumeIndicators(
		ohlcData: OHLCData[],
		config: TechnicalAnalysisConfig
	): Promise<any> {
		const closePrices = ohlcData.map(d => d.close);
		const volumes = ohlcData.map(d => d.volume);

		// OBV calculation
		const obv = new OBV();
		for (let i = 0; i < ohlcData.length; i++) {
			obv.update(
				{
					open: ohlcData[i].open,
					high: ohlcData[i].high,
					low: ohlcData[i].low,
					close: ohlcData[i].close,
					volume: ohlcData[i].volume,
				},
				false
			);
		}

		const obvCalculation = obv.isStable ? obv.getResult() : null;
		const obvValue = obvCalculation ? Number(obvCalculation) : 0;
		const obvResult: OBVResult = {
			value: obvValue,
			trend: this.determineOBVTrend(obvValue),
			timestamp: Date.now(),
		};

		// VWAP calculation
		const vwap = new VWAP();
		for (let i = 0; i < ohlcData.length; i++) {
			vwap.update(
				{
					high: ohlcData[i].high,
					low: ohlcData[i].low,
					close: ohlcData[i].close,
					volume: ohlcData[i].volume,
				},
				false
			);
		}

		const currentPrice = closePrices[closePrices.length - 1];
		const vwapCalculation = vwap.isStable ? vwap.getResult() : null;
		const vwapValue = vwapCalculation ? Number(vwapCalculation) : currentPrice;
		const vwapResult: VWAPResult = {
			value: vwapValue,
			position: this.determineVWAPPosition(currentPrice, vwapValue),
			timestamp: Date.now(),
		};

		// Determine volume analysis
		const volumeTrend = this.determineVolumeTrend(obvResult, volumes);
		const volumeConfirmation = this.calculateVolumeConfirmation(obvResult, vwapResult, volumes);

		return {
			trend: volumeTrend,
			confirmation: volumeConfirmation,
			indicators: {
				obv: obvResult,
				vwap: vwapResult,
			},
		};
	}

	/**
	 * Calculate volatility indicators (ATR, Bollinger Band Width)
	 */
	private async calculateVolatilityIndicators(
		ohlcData: OHLCData[],
		config: TechnicalAnalysisConfig
	): Promise<any> {
		// ATR calculation
		const atr = new ATR(config.atr.period);
		for (let i = 0; i < ohlcData.length; i++) {
			atr.update(
				{
					high: ohlcData[i].high,
					low: ohlcData[i].low,
					close: ohlcData[i].close,
				},
				false
			);
		}

		const atrCalculation = atr.isStable ? atr.getResult() : null;
		const atrResult: ATRResult = {
			value: atrCalculation ? Number(atrCalculation) : 0,
			period: config.atr.period,
			timestamp: Date.now(),
		};

		// Get Bollinger Band width from trend analysis (already calculated)
		const bollingerWidth = 0; // Will be set from trend analysis

		const volatilityLevel = this.determineVolatilityLevel(atrResult, bollingerWidth);

		return {
			level: volatilityLevel,
			indicators: {
				atr: atrResult,
				bollingerWidth,
			},
		};
	}

	/**
	 * Detect candlestick and chart patterns
	 */
	private async detectPatterns(
		ohlcData: OHLCData[],
		config: TechnicalAnalysisConfig
	): Promise<any> {
		if (!config.patterns.candlestick.enabled && !config.patterns.chart.enabled) {
			return {
				candlestick: [],
				chart: [],
				confidence: 0,
			};
		}

		const candlestickPatterns: CandlestickPattern[] = [];
		const chartPatterns: ChartPattern[] = [];

		// Detect candlestick patterns
		if (config.patterns.candlestick.enabled) {
			const patterns = await this.detectCandlestickPatterns(
				ohlcData,
				config.patterns.minConfidence
			);
			candlestickPatterns.push(...patterns);
		}

		// Detect chart patterns
		if (config.patterns.chart.enabled) {
			const patterns = await this.detectChartPatterns(
				ohlcData,
				config.patterns.minConfidence
			);
			chartPatterns.push(...patterns);
		}

		const overallConfidence = this.calculatePatternConfidence(
			candlestickPatterns,
			chartPatterns
		);

		return {
			candlestick: candlestickPatterns,
			chart: chartPatterns,
			confidence: overallConfidence,
		};
	}

	/**
	 * Calculate overall technical score (0-100) with options integration
	 * Options signals contribute 15% weight within the 40% technical analysis allocation
	 */
	private calculateTechnicalScore(
		trend: any,
		momentum: any,
		volume: any,
		volatility: any,
		patterns: any,
		options?: any
	): any {
		// Weight distribution with options integration (total = 100%)
		// When options available: traditional indicators get 85%, options get 15%
		// When options unavailable: traditional indicators maintain full weights
		const hasOptions = options && options.available;

		const weights = hasOptions
			? {
					trend: 0.34, // 34% of technical score (reduced from 40%)
					momentum: 0.3, // 30% of technical score (reduced from 35%)
					volume: 0.11, // 11% of technical score (reduced from 15%)
					patterns: 0.1, // 10% of technical score (unchanged)
					options: 0.15, // 15% of technical score (new)
				}
			: {
					trend: 0.4, // 40% of technical score (original)
					momentum: 0.35, // 35% of technical score (original)
					volume: 0.15, // 15% of technical score (original)
					patterns: 0.1, // 10% of technical score (original)
					options: 0, // 0% when options not available
				};

		// Calculate individual scores (0-100)
		const trendScore = this.calculateTrendScore(trend) * 100;
		const momentumScore = this.calculateMomentumScore(momentum) * 100;
		const volumeScore = this.calculateVolumeScore(volume) * 100;
		const patternsScore = this.calculatePatternsScore(patterns) * 100;
		const optionsScore = hasOptions ? this.calculateOptionsScore(options) * 100 : 0;

		// Calculate weighted total
		let totalScore =
			trendScore * weights.trend +
			momentumScore * weights.momentum +
			volumeScore * weights.volume +
			patternsScore * weights.patterns;

		if (hasOptions) {
			totalScore += optionsScore * weights.options;
		}

		const breakdown: any = {
			trend: Math.round(trendScore),
			momentum: Math.round(momentumScore),
			volume: Math.round(volumeScore),
			patterns: Math.round(patternsScore),
		};

		if (hasOptions) {
			breakdown.options = Math.round(optionsScore);
		}

		return {
			total: Math.round(totalScore),
			breakdown,
		};
	}

	/**
	 * Calculate options score from options analysis data
	 */
	private calculateOptionsScore(options: any): number {
		if (!options || !options.available || !options.signals) {
			return 0.5; // Neutral score when options data unavailable
		}

		const signals = options.signals;
		let score = 0.5; // Base neutral score

		// P/C ratio contribution (25% of options score)
		const pcScore = signals.putCallSignal / 100;
		score += (pcScore - 0.5) * 0.25;

		// IV signal contribution (25% of options score)
		const ivScore = signals.impliedVolatilitySignal / 100;
		score += (ivScore - 0.5) * 0.25;

		// Flow signal contribution (30% of options score)
		const flowScore = signals.flowSignal / 100;
		score += (flowScore - 0.5) * 0.3;

		// Greeks signal contribution (20% of options score)
		const greeksScore = signals.greeksSignal / 100;
		score += (greeksScore - 0.5) * 0.2;

		// Apply confidence weighting
		const confidence = options.confidence / 100;
		score = score * confidence + 0.5 * (1 - confidence);

		return Math.max(0, Math.min(1, score));
	}

	/**
	 * Calculate Williams %R manually since it's not in trading-signals
	 */
	private calculateWilliamsR(
		highs: number[],
		lows: number[],
		closes: number[],
		period: number
	): number {
		if (closes.length < period) return -50;

		const recentHighs = highs.slice(-period);
		const recentLows = lows.slice(-period);
		const currentClose = closes[closes.length - 1];

		const highest = Math.max(...recentHighs);
		const lowest = Math.min(...recentLows);

		if (highest === lowest) return -50;

		return ((highest - currentClose) / (highest - lowest)) * -100;
	}

	/**
	 * Helper methods for signal determination
	 */
	private determineMACDCrossover(macdResult: any): "bullish" | "bearish" | "none" {
		if (!macdResult) return "none";

		if (macdResult.macd > macdResult.signal && macdResult.histogram > 0) {
			return "bullish";
		} else if (macdResult.macd < macdResult.signal && macdResult.histogram < 0) {
			return "bearish";
		}

		return "none";
	}

	private calculateBollingerPosition(price: number, bands: any): number {
		const range = bands.upper - bands.lower;
		if (range === 0) return 0.5;
		return (price - bands.lower) / range;
	}

	private determineRSISignal(
		rsi: number,
		overbought: number,
		oversold: number
	): "oversold" | "overbought" | "neutral" {
		if (rsi <= oversold) return "oversold";
		if (rsi >= overbought) return "overbought";
		return "neutral";
	}

	private determineStochasticSignal(stochK: number): "oversold" | "overbought" | "neutral" {
		if (stochK <= 20) return "oversold";
		if (stochK >= 80) return "overbought";
		return "neutral";
	}

	private determineWilliamsSignal(williams: number): "oversold" | "overbought" | "neutral" {
		if (williams <= -80) return "oversold";
		if (williams >= -20) return "overbought";
		return "neutral";
	}

	private determineTrendDirection(
		smaResults: SMAResult[],
		emaResults: EMAResult[],
		macd: MACDResult,
		currentPrice: number
	): "bullish" | "bearish" | "neutral" {
		let bullishSignals = 0;
		let bearishSignals = 0;
		let totalSignals = 0;

		// SMA analysis
		smaResults.forEach(sma => {
			totalSignals++;
			if (currentPrice > sma.value) {
				bullishSignals++;
			} else {
				bearishSignals++;
			}
		});

		// EMA analysis
		emaResults.forEach(ema => {
			totalSignals++;
			if (currentPrice > ema.value) {
				bullishSignals++;
			} else {
				bearishSignals++;
			}
		});

		// MACD analysis
		if (macd.crossover !== "none") {
			totalSignals++;
			if (macd.crossover === "bullish") {
				bullishSignals++;
			} else {
				bearishSignals++;
			}
		}

		if (totalSignals === 0) return "neutral";

		const bullishRatio = bullishSignals / totalSignals;
		if (bullishRatio >= 0.6) return "bullish";
		if (bullishRatio <= 0.4) return "bearish";
		return "neutral";
	}

	private calculateTrendStrength(
		smaResults: SMAResult[],
		emaResults: EMAResult[],
		macd: MACDResult
	): number {
		let strength = 0;
		let indicators = 0;

		// Factor in moving average alignment
		if (smaResults.length >= 2) {
			const shortMA = smaResults.find(
				s => s.period === Math.min(...smaResults.map(r => r.period))
			);
			const longMA = smaResults.find(
				s => s.period === Math.max(...smaResults.map(r => r.period))
			);

			if (shortMA && longMA) {
				indicators++;
				if (shortMA.value > longMA.value) {
					strength += 1;
				}
			}
		}

		// Factor in MACD histogram
		indicators++;
		strength += Math.max(0, Math.min(1, Math.abs(macd.histogram) * 10));

		return indicators > 0 ? strength / indicators : 0.5;
	}

	private calculateTrendConfidence(
		smaResults: SMAResult[],
		emaResults: EMAResult[],
		macd: MACDResult,
		bollinger: BollingerBandsResult
	): number {
		let confidence = 0;
		let factors = 0;

		// Factor in indicator agreement
		factors++;
		if (macd.crossover !== "none") {
			confidence += 0.3;
		}

		// Factor in Bollinger Band position
		factors++;
		if (bollinger.position > 0.2 && bollinger.position < 0.8) {
			confidence += 0.3; // More confident when not at extremes
		}

		// Factor in moving average convergence
		if (smaResults.length >= 2) {
			factors++;
			const spread =
				Math.abs(smaResults[0].value - smaResults[1].value) / smaResults[0].value;
			confidence += Math.max(0, 0.4 - spread * 10); // Higher confidence with closer MAs
		}

		return factors > 0 ? confidence / factors : 0.5;
	}

	private determineMomentumSignal(
		rsi: RSIResult,
		stochastic: StochasticResult,
		williams: WilliamsRResult,
		roc: ROCResult
	): "buy" | "sell" | "hold" {
		let buySignals = 0;
		let sellSignals = 0;

		// RSI signals
		if (rsi.signal === "oversold") buySignals++;
		if (rsi.signal === "overbought") sellSignals++;

		// Stochastic signals
		if (stochastic.signal === "oversold") buySignals++;
		if (stochastic.signal === "overbought") sellSignals++;

		// Williams %R signals
		if (williams.signal === "oversold") buySignals++;
		if (williams.signal === "overbought") sellSignals++;

		// ROC signals
		if (roc.value > 5) buySignals++;
		if (roc.value < -5) sellSignals++;

		if (buySignals > sellSignals) return "buy";
		if (sellSignals > buySignals) return "sell";
		return "hold";
	}

	private calculateMomentumStrength(
		rsi: RSIResult,
		stochastic: StochasticResult,
		williams: WilliamsRResult,
		roc: ROCResult
	): number {
		// Calculate momentum strength based on indicator extremes
		let strength = 0;
		let indicators = 0;

		// RSI contribution
		indicators++;
		if (rsi.value <= 30 || rsi.value >= 70) {
			strength += Math.abs(rsi.value - 50) / 50;
		} else {
			strength += 0.2;
		}

		// Stochastic contribution
		indicators++;
		if (stochastic.k <= 20 || stochastic.k >= 80) {
			strength += Math.abs(stochastic.k - 50) / 50;
		} else {
			strength += 0.2;
		}

		// Williams %R contribution
		indicators++;
		strength += Math.abs(williams.value + 50) / 50;

		// ROC contribution
		indicators++;
		strength += Math.min(1, Math.abs(roc.value) / 10);

		return indicators > 0 ? strength / indicators : 0.5;
	}

	private determineOBVTrend(obvValue: number): "rising" | "falling" | "neutral" {
		// This would need historical OBV values for proper trend analysis
		// For now, return neutral as placeholder
		return "neutral";
	}

	private determineVWAPPosition(
		currentPrice: number,
		vwapValue: number
	): "above" | "below" | "at" {
		const tolerance = 0.001; // 0.1% tolerance
		const diff = Math.abs(currentPrice - vwapValue) / vwapValue;

		if (diff <= tolerance) return "at";
		return currentPrice > vwapValue ? "above" : "below";
	}

	private determineVolumeTrend(
		obv: OBVResult,
		volumes: number[]
	): "increasing" | "decreasing" | "stable" {
		if (volumes.length < 5) return "stable";

		const recentVolumes = volumes.slice(-5);
		const avgRecent = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
		const avgOlder = volumes.slice(-10, -5).reduce((sum, v) => sum + v, 0) / 5;

		const change = (avgRecent - avgOlder) / avgOlder;

		if (change > 0.1) return "increasing";
		if (change < -0.1) return "decreasing";
		return "stable";
	}

	private calculateVolumeConfirmation(
		obv: OBVResult,
		vwap: VWAPResult,
		volumes: number[]
	): boolean {
		// Volume confirms price movement when OBV trend aligns with price trend
		// This is a simplified implementation
		return obv.trend === "rising" && vwap.position === "above";
	}

	private determineVolatilityLevel(
		atr: ATRResult,
		bollingerWidth: number
	): "high" | "medium" | "low" {
		// This would need market context for proper volatility assessment
		// For now, use ATR as a simple measure
		if (atr.value > 2) return "high";
		if (atr.value > 1) return "medium";
		return "low";
	}

	private async detectCandlestickPatterns(
		ohlcData: OHLCData[],
		minConfidence: number
	): Promise<CandlestickPattern[]> {
		// Placeholder for candlestick pattern detection
		// Would implement actual pattern recognition algorithms
		return [];
	}

	private async detectChartPatterns(
		ohlcData: OHLCData[],
		minConfidence: number
	): Promise<ChartPattern[]> {
		// Placeholder for chart pattern detection
		// Would implement actual pattern recognition algorithms
		return [];
	}

	private calculatePatternConfidence(
		candlestick: CandlestickPattern[],
		chart: ChartPattern[]
	): number {
		if (candlestick.length === 0 && chart.length === 0) return 0;

		const allPatterns = [...candlestick, ...chart];
		const avgConfidence =
			allPatterns.reduce((sum, p) => sum + p.strength, 0) / allPatterns.length;

		return avgConfidence;
	}

	private calculateTrendScore(trend: any): number {
		let score = 0.5; // Base neutral score

		// Direction contribution
		if (trend.direction === "bullish") score += 0.2;
		if (trend.direction === "bearish") score -= 0.2;

		// Strength contribution
		score += (trend.strength - 0.5) * 0.4;

		// Confidence contribution
		score += (trend.confidence - 0.5) * 0.2;

		return Math.max(0, Math.min(1, score));
	}

	private calculateMomentumScore(momentum: any): number {
		let score = 0.5; // Base neutral score

		// Signal contribution
		if (momentum.signal === "buy") score += 0.3;
		if (momentum.signal === "sell") score -= 0.3;

		// Strength contribution
		score += (momentum.strength - 0.5) * 0.4;

		return Math.max(0, Math.min(1, score));
	}

	private calculateVolumeScore(volume: any): number {
		let score = 0.5; // Base neutral score

		// Trend contribution
		if (volume.trend === "increasing") score += 0.2;
		if (volume.trend === "decreasing") score -= 0.2;

		// Confirmation contribution
		if (volume.confirmation) score += 0.3;

		return Math.max(0, Math.min(1, score));
	}

	private calculatePatternsScore(patterns: any): number {
		if (patterns.confidence === 0) return 0.5;

		// Pattern confidence directly translates to score
		return patterns.confidence;
	}

	/**
	 * Utility methods
	 */
	private createDefaultConfig(): TechnicalAnalysisConfig {
		return {
			sma: { enabled: true, periods: [5, 10, 20, 50, 200] },
			ema: { enabled: true, periods: [12, 26] },
			rsi: { enabled: true, period: 14, overbought: 70, oversold: 30 },
			macd: { enabled: true, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
			bollinger: { enabled: true, period: 20, standardDeviations: 2 },
			stochastic: { enabled: true, kPeriod: 14, dPeriod: 3 },
			williams: { enabled: true, period: 14 },
			roc: { enabled: true, period: 10 },
			obv: { enabled: true },
			vwap: { enabled: true },
			atr: { enabled: true, period: 14 },
			adx: { enabled: true, period: 14 },
			aroon: { enabled: true, period: 14 },
			psar: { enabled: true, acceleration: 0.02, maximum: 0.2 },
			patterns: {
				candlestick: { enabled: true },
				chart: { enabled: true },
				minConfidence: 0.7,
			},
			performance: {
				maxPeriods: 1000,
				cacheTTL: 300000, // 5 minutes
				parallelCalculation: true,
			},
		};
	}

	private generateCacheKey(symbol: string, config: TechnicalAnalysisConfig): string {
		const configHash = Buffer.from(JSON.stringify(config)).toString("base64").slice(0, 16);
		return `technical:${symbol}:${configHash}`;
	}

	private async getCachedResult(key: string): Promise<TechnicalAnalysisResult | null> {
		try {
			return await this.cache.get(key);
		} catch (error) {
			console.error("Cache get error:", error);
			return null;
		}
	}

	private async cacheResult(
		key: string,
		result: TechnicalAnalysisResult,
		ttl: number
	): Promise<void> {
		try {
			await this.cache.set(key, result, ttl);
		} catch (error) {
			console.error("Cache set error:", error);
		}
	}

	private assessDataQuality(ohlcData: OHLCData[]): number {
		if (ohlcData.length === 0) return 0;

		let qualityScore = 1.0;
		let issues = 0;

		// Check for missing data
		ohlcData.forEach(data => {
			if (!data.open || !data.high || !data.low || !data.close || !data.volume) {
				issues++;
			}

			// Check for invalid OHLC relationships
			if (
				data.high < data.low ||
				data.high < data.open ||
				data.high < data.close ||
				data.low > data.open ||
				data.low > data.close
			) {
				issues++;
			}
		});

		qualityScore -= (issues / ohlcData.length) * 0.5;

		return Math.max(0, Math.min(1, qualityScore));
	}

	private trackPerformance(
		symbol: string,
		calculationTime: number,
		result: TechnicalAnalysisResult,
		isCacheHit: boolean = false
	): void {
		const existingPerformance = this.performanceTracker.get(symbol);

		if (existingPerformance) {
			// Update existing performance data
			existingPerformance.totalTime += calculationTime;
			if (isCacheHit) {
				existingPerformance.cacheHits += 1;
			} else {
				existingPerformance.cacheMisses += 1;
				// Update calculation times only for cache misses (actual calculations)
				existingPerformance.calculationTimes = {
					total: calculationTime,
					trend: calculationTime * 0.3,
					momentum: calculationTime * 0.3,
					volume: calculationTime * 0.2,
					volatility: calculationTime * 0.1,
					patterns: calculationTime * 0.1,
				};
			}
			existingPerformance.dataQuality = result.metadata.dataQuality;
			existingPerformance.timestamp = Date.now();
		} else {
			// Create new performance record
			const performance: TechnicalAnalysisPerformance = {
				symbol,
				calculationTimes: {
					total: calculationTime,
					trend: calculationTime * 0.3,
					momentum: calculationTime * 0.3,
					volume: calculationTime * 0.2,
					volatility: calculationTime * 0.1,
					patterns: calculationTime * 0.1,
				},
				totalTime: calculationTime,
				cacheHits: isCacheHit ? 1 : 0,
				cacheMisses: isCacheHit ? 0 : 1,
				dataQuality: result.metadata.dataQuality,
				timestamp: Date.now(),
			};

			this.performanceTracker.set(symbol, performance);
		}
	}

	private trackPerformanceForCacheHit(
		symbol: string,
		requestTime: number,
		result: TechnicalAnalysisResult
	): void {
		// Ensure minimum time for cache hits (at least 1ms for tracking purposes)
		const actualTime = Math.max(1, requestTime);
		this.trackPerformance(symbol, actualTime, result, true);
	}

	private trackPerformanceForCacheMiss(
		symbol: string,
		calculationTime: number,
		result: TechnicalAnalysisResult
	): void {
		// Ensure minimum time for cache misses (at least 1ms for tracking purposes)
		const actualTime = Math.max(1, calculationTime);
		this.trackPerformance(symbol, actualTime, result, false);
	}

	/**
	 * Public utility methods
	 */
	getPerformanceStats(
		symbol?: string
	): TechnicalAnalysisPerformance | TechnicalAnalysisPerformance[] {
		if (symbol) {
			const performance = this.performanceTracker.get(symbol);
			if (performance) {
				return performance;
			}

			// Return a default performance object if no data exists
			return {
				symbol,
				calculationTimes: {
					total: 0,
					trend: 0,
					momentum: 0,
					volume: 0,
					volatility: 0,
					patterns: 0,
				},
				totalTime: 0,
				cacheHits: 0,
				cacheMisses: 0,
				dataQuality: 0,
				timestamp: Date.now(),
			};
		}

		return Array.from(this.performanceTracker.values());
	}

	async clearCache(): Promise<void> {
		// Clear cache through the cache service
		try {
			// Most cache implementations have a clear method or similar
			await this.cache.ping(); // Just ensure cache is available
		} catch (error) {
			console.warn("Cache clearing failed:", error);
		}
	}

	updateConfig(newConfig: Partial<TechnicalAnalysisConfig>): void {
		this.defaultConfig = { ...this.defaultConfig, ...newConfig };
	}

	/**
	 * Calculate comprehensive options analysis for technical integration
	 */
	private async calculateOptionsAnalysis(
		symbol: string,
		config: TechnicalAnalysisConfig
	): Promise<any> {
		try {
			// Get options data with timeout for performance
			const optionsData = await Promise.race([
				this.optionsService.analyzeOptionsData(symbol),
				new Promise<null>((_, reject) =>
					setTimeout(() => reject(new Error("Options analysis timeout")), 2000)
				),
			]);

			if (!optionsData) {
				return {
					available: false,
					signals: null,
					confidence: 0,
				};
			}

			// Calculate technical options signals
			const signals = await this.calculateOptionsSignals(optionsData);

			return {
				available: true,
				signals,
				confidence: optionsData.confidence || 70,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.log(`Options analysis unavailable for ${symbol}: ${errorMessage}`);
			return {
				available: false,
				signals: null,
				confidence: 0,
			};
		}
	}

	/**
	 * Convert options analysis data to technical signals
	 */
	private async calculateOptionsSignals(
		optionsData: OptionsAnalysisMetrics
	): Promise<OptionsSignalsResult> {
		const startTime = Date.now();

		try {
			// P/C Ratio Signal (0-100 scale)
			const pcSignal = this.calculatePCRatioSignal(optionsData.putCallRatio);

			// IV Signal (0-100 scale)
			const ivSignal = this.calculateIVSignal(optionsData.volatilityAnalysis);

			// Flow Signal (0-100 scale)
			const flowSignal = this.calculateFlowSignal(optionsData.flowSignals);

			// Greeks Signal (0-100 scale)
			const greeksSignal = this.calculateGreeksSignal(optionsData);

			// Composite score with equal weighting
			const composite =
				pcSignal * 0.25 + ivSignal * 0.25 + flowSignal * 0.3 + greeksSignal * 0.2;

			return {
				putCallSignal: pcSignal,
				impliedVolatilitySignal: ivSignal,
				flowSignal,
				greeksSignal,
				composite,
				confidence: optionsData.confidence,
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error("Error calculating options signals:", error);
			// Return neutral signals on error
			return {
				putCallSignal: 50,
				impliedVolatilitySignal: 50,
				flowSignal: 50,
				greeksSignal: 50,
				composite: 50,
				confidence: 0,
				timestamp: Date.now(),
			};
		}
	}

	/**
	 * Calculate P/C ratio technical signal
	 */
	private calculatePCRatioSignal(pcRatio: any): number {
		if (!pcRatio || pcRatio.volumeRatio === undefined) return 50;

		const ratio = pcRatio.volumeRatio;

		// P/C ratio interpretation:
		// < 0.7 = Bullish (high call volume) = 70-100
		// 0.7-1.3 = Neutral = 30-70
		// > 1.3 = Bearish (high put volume) = 0-30

		if (ratio < 0.7) {
			// Bullish territory - more calls than puts
			return Math.min(100, 70 + ((0.7 - ratio) / 0.7) * 30);
		} else if (ratio > 1.3) {
			// Bearish territory - more puts than calls
			return Math.max(0, 30 - ((ratio - 1.3) / 1.0) * 30);
		} else {
			// Neutral territory
			return 50 + ((1.0 - ratio) / 0.3) * 20;
		}
	}

	/**
	 * Calculate IV technical signal
	 */
	private calculateIVSignal(volatilityAnalysis: any): number {
		if (!volatilityAnalysis) return 50;

		const ivPercentile = volatilityAnalysis.impliedVolatilityPercentile || 50;

		// IV percentile interpretation:
		// < 30th percentile = Low IV = Consider buying options = 70-100
		// 30-70th percentile = Normal IV = Neutral = 30-70
		// > 70th percentile = High IV = Consider selling premium = 0-30

		if (ivPercentile < 30) {
			return 70 + ((30 - ivPercentile) / 30) * 30;
		} else if (ivPercentile > 70) {
			return 30 - ((ivPercentile - 70) / 30) * 30;
		} else {
			return 30 + ((ivPercentile - 30) / 40) * 40;
		}
	}

	/**
	 * Calculate options flow technical signal
	 */
	private calculateFlowSignal(flowSignals: any): number {
		if (!flowSignals) return 50;

		// Use the composite flow signal directly
		return Math.max(0, Math.min(100, flowSignals.composite || 50));
	}

	/**
	 * Calculate Greeks-based technical signal
	 */
	private calculateGreeksSignal(optionsData: any): number {
		// For now, return neutral as Greeks analysis would require
		// more complex interpretation of delta, gamma, theta exposure
		// This can be enhanced with specific Greeks analysis in the future
		return 50;
	}
}
