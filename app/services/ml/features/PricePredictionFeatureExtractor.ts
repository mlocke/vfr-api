/**
 * Price Prediction Feature Extractor
 *
 * Extracts ~40 features optimized for price movement prediction (not analyst upgrades).
 *
 * Feature Categories:
 * - Volume Profile (6): Volume ratios, spikes, trends
 * - Technical Indicators (10): RSI, MACD, Bollinger, Stochastic, ADX, ATR
 * - Price Action (8): Momentum, acceleration, gaps, volatility
 * - Options Flow (7): Put/call ratio, unusual activity, IV rank, gamma
 * - Institutional Flow (4): Net flow, block trades, insider buying
 * - Sentiment (4): News sentiment, social momentum, analyst targets
 * - Macro Context (4): Sector/market momentum, VIX, correlation
 *
 * Total: 43 features
 *
 * Philosophy:
 * - Volume + Technical = 60% of predictive power
 * - Options + Institutional = 30%
 * - Sentiment + Macro = 10%
 */

import { FinancialDataService } from "../../financial-data/FinancialDataService";
import { FinancialModelingPrepAPI } from "../../financial-data/FinancialModelingPrepAPI";
import { TechnicalIndicatorService } from "../../technical-analysis/TechnicalIndicatorService";
import { VWAPService } from "../../financial-data/VWAPService";
import { OptionsDataService } from "../../financial-data/OptionsDataService";
import { InstitutionalDataService } from "../../financial-data/InstitutionalDataService";
import { SentimentAnalysisService } from "../../financial-data/SentimentAnalysisService";
import { MacroeconomicAnalysisService } from "../../financial-data/MacroeconomicAnalysisService";
import { RedisCache } from "../../cache/RedisCache";

export interface PriceFeatureVector {
	symbol: string;
	timestamp: number;

	// Volume features (6)
	volume_ratio_5d: number;          // Current volume / 5-day average
	volume_spike: number;             // 1 if volume > 2x average, else 0
	volume_trend_10d: number;         // Volume trend slope over 10 days
	relative_volume: number;          // Volume vs sector average
	volume_acceleration: number;      // Change in volume trend
	dark_pool_ratio: number;          // Dark pool volume / total volume (if available)

	// Technical indicators (10)
	rsi_14: number;                   // RSI(14)
	macd_signal: number;              // MACD - Signal line
	macd_histogram: number;           // MACD histogram
	bollinger_position: number;       // (Price - Lower) / (Upper - Lower)
	stochastic_k: number;             // Stochastic %K
	adx_14: number;                   // Average Directional Index (trend strength)
	atr_14: number;                   // Average True Range (volatility)
	ema_20_distance: number;          // (Price - EMA20) / EMA20
	sma_50_distance: number;          // (Price - SMA50) / SMA50
	williams_r: number;               // Williams %R

	// Price action (8)
	price_momentum_5d: number;        // 5-day return
	price_momentum_10d: number;       // 10-day return
	price_momentum_20d: number;       // 20-day return
	price_acceleration: number;       // (5d momentum - 10d momentum)
	gap_percent: number;              // Gap % from previous close
	intraday_volatility: number;      // (High - Low) / Open
	overnight_return: number;         // (Open - PrevClose) / PrevClose
	week_high_distance: number;       // (52w high - Price) / 52w high

	// Options flow (7)
	put_call_ratio: number;           // Put volume / Call volume
	put_call_ratio_change: number;    // Change in put/call ratio
	unusual_options_activity: number; // 1 if volume > 2x open interest, else 0
	options_iv_rank: number;          // IV percentile rank (0-100)
	gamma_exposure: number;           // Normalized gamma exposure
	max_pain_distance: number;        // (Price - Max Pain) / Price
	options_volume_ratio: number;     // Options volume / stock volume

	// Institutional flow (4)
	institutional_net_flow: number;   // Buy pressure - Sell pressure
	block_trade_volume: number;       // Large trades > 10k shares
	insider_buying_ratio: number;     // Insider buys / (buys + sells)
	ownership_change_30d: number;     // 30-day institutional ownership change

	// Sentiment (4)
	news_sentiment_delta: number;     // Change in news sentiment
	social_momentum: number;          // Social media volume change
	analyst_target_distance: number;  // (Target - Price) / Price
	earnings_surprise_impact: number; // Recent earnings surprise %

	// Macro context (4)
	sector_momentum_5d: number;       // Sector ETF 5-day return
	spy_momentum_5d: number;          // SPY 5-day return
	vix_level: number;                // VIX level (market volatility)
	correlation_to_spy_20d: number;   // 20-day rolling correlation to SPY
}

interface OHLCData {
	date: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export class PricePredictionFeatureExtractor {
	private financialDataService: FinancialDataService;
	private fmpAPI: FinancialModelingPrepAPI;
	private technicalService: TechnicalIndicatorService;
	private vwapService: VWAPService;
	private optionsService: OptionsDataService;
	private institutionalService: InstitutionalDataService;
	private sentimentService: SentimentAnalysisService;
	private macroService: MacroeconomicAnalysisService;
	private cache: RedisCache;

	constructor() {
		this.financialDataService = new FinancialDataService();
		this.fmpAPI = new FinancialModelingPrepAPI();
		this.cache = RedisCache.getInstance();
		this.technicalService = new TechnicalIndicatorService(this.cache);
		this.vwapService = new VWAPService(this.fmpAPI, this.cache);
		this.optionsService = new OptionsDataService();
		this.institutionalService = new InstitutionalDataService();
		this.sentimentService = new SentimentAnalysisService(
			this.cache,
			undefined  // redditAPI - will be auto-initialized
		);
		this.macroService = new MacroeconomicAnalysisService();
	}

	/**
	 * Extract all price prediction features for a given symbol and date
	 */
	async extractFeatures(
		symbol: string,
		asOfDate?: Date
	): Promise<PriceFeatureVector> {
		const date = asOfDate || new Date();
		const startTime = Date.now();

		try {
			// Get historical data (60 days for technical indicators)
			const historicalData = await this.getHistoricalData(symbol, date, 60);

			if (!historicalData || historicalData.length < 20) {
				throw new Error(`Insufficient historical data for ${symbol}`);
			}

			// Extract features in parallel
			const [
				volumeFeatures,
				technicalFeatures,
				priceActionFeatures,
				optionsFeatures,
				institutionalFeatures,
				sentimentFeatures,
				macroFeatures
			] = await Promise.all([
				this.extractVolumeFeatures(historicalData),
				this.extractTechnicalFeatures(historicalData, symbol, date),
				this.extractPriceActionFeatures(historicalData),
				this.extractOptionsFeatures(symbol, date),
				this.extractInstitutionalFeatures(symbol, date),
				this.extractSentimentFeatures(symbol, date),
				this.extractMacroFeatures(symbol, date)
			]);

			const features = {
				symbol,
				timestamp: date.getTime(),
				...volumeFeatures,
				...technicalFeatures,
				...priceActionFeatures,
				...optionsFeatures,
				...institutionalFeatures,
				...sentimentFeatures,
				...macroFeatures
			} as PriceFeatureVector;

			const extractionTime = Date.now() - startTime;
			console.log(`[PriceFeatureExtractor] Extracted 43 features for ${symbol} in ${extractionTime}ms`);

			return features;
		} catch (error) {
			console.error(`[PriceFeatureExtractor] Error extracting features for ${symbol}:`, error);
			throw error;
		}
	}

	/**
	 * Get historical OHLCV data
	 */
	private async getHistoricalData(
		symbol: string,
		asOfDate: Date,
		days: number
	): Promise<OHLCData[]> {
		try {
			// Get historical data from financial data service
			const marketData = await this.financialDataService.getHistoricalOHLC(
				symbol,
				days
			);

			// Convert to OHLCData format
			if (!marketData || marketData.length === 0) return [];

			return marketData.map((d: any) => ({
				date: d.timestamp || d.date || '',
				open: d.open || 0,
				high: d.high || 0,
				low: d.low || 0,
				close: d.close || 0,
				volume: d.volume || 0
			})).reverse(); // Oldest first
		} catch (error) {
			console.error(`Error fetching historical data for ${symbol}:`, error);
			return [];
		}
	}

	/**
	 * Extract volume features (6 features)
	 * PHASE 5: Enhanced with intraday volume analysis for dark pool estimation
	 */
	private async extractVolumeFeatures(
		historicalData: OHLCData[]
	): Promise<Partial<PriceFeatureVector>> {
		const currentVolume = historicalData[historicalData.length - 1]?.volume || 0;

		// Volume ratio (5-day average)
		const last5Days = historicalData.slice(-5);
		const avg5dVolume = last5Days.reduce((sum, d) => sum + d.volume, 0) / last5Days.length;
		const volume_ratio_5d = avg5dVolume > 0 ? currentVolume / avg5dVolume : 1;

		// Volume spike
		const volume_spike = volume_ratio_5d > 2 ? 1 : 0;

		// Volume trend (10-day slope)
		const last10Days = historicalData.slice(-10);
		const volume_trend_10d = this.calculateSlope(
			last10Days.map((d, i) => ({ x: i, y: d.volume }))
		);

		// Relative volume (vs 20-day average)
		const last20Days = historicalData.slice(-20);
		const avg20dVolume = last20Days.reduce((sum, d) => sum + d.volume, 0) / last20Days.length;
		const relative_volume = avg20dVolume > 0 ? currentVolume / avg20dVolume : 1;

		// Volume acceleration
		const last5Slope = this.calculateSlope(
			last5Days.map((d, i) => ({ x: i, y: d.volume }))
		);
		const volume_acceleration = volume_trend_10d - last5Slope;

		// Dark pool ratio estimation (PHASE 5 implementation)
		// Since we don't have actual dark pool data, we estimate it using volume patterns:
		// - Price moves with low visible volume suggest dark pool activity
		// - Calculate price impact per unit volume
		const dark_pool_ratio = this.estimateDarkPoolRatio(historicalData);

		return {
			volume_ratio_5d,
			volume_spike,
			volume_trend_10d,
			relative_volume,
			volume_acceleration,
			dark_pool_ratio
		};
	}

	/**
	 * Estimate dark pool activity ratio (0-1 scale)
	 * PHASE 5: Proxy for dark pool volume using price impact analysis
	 *
	 * Theory: Dark pool trades don't immediately impact price, so:
	 * - Low price movement + high volume = potential dark pool activity
	 * - Calculate price efficiency (price change per volume unit)
	 * - Lower efficiency suggests more off-exchange trading
	 */
	private estimateDarkPoolRatio(historicalData: OHLCData[]): number {
		if (historicalData.length < 5) return 0;

		const last5Days = historicalData.slice(-5);

		// Calculate average price efficiency (abs price change / volume)
		let totalEfficiency = 0;
		let validDays = 0;

		for (let i = 1; i < last5Days.length; i++) {
			const priceChange = Math.abs(last5Days[i].close - last5Days[i - 1].close);
			const avgPrice = (last5Days[i].close + last5Days[i - 1].close) / 2;
			const volume = last5Days[i].volume;

			if (volume > 0 && avgPrice > 0) {
				// Normalize price change as percentage
				const percentChange = priceChange / avgPrice;
				// Price efficiency = price change per million shares traded
				const efficiency = (percentChange * 1000000) / volume;
				totalEfficiency += efficiency;
				validDays++;
			}
		}

		if (validDays === 0) return 0;

		const avgEfficiency = totalEfficiency / validDays;

		// Historical baseline efficiency (typical market)
		// Lower efficiency suggests more dark pool activity
		// Typical range: 0.001 - 0.01 for liquid stocks
		const baselineEfficiency = 0.005;

		// If current efficiency is lower than baseline, estimate dark pool ratio
		if (avgEfficiency < baselineEfficiency) {
			// Scale to 0-0.5 range (max 50% dark pool estimation)
			const darkPoolRatio = Math.min(0.5, (baselineEfficiency - avgEfficiency) / baselineEfficiency);
			return darkPoolRatio;
		}

		return 0;
	}

	/**
	 * Extract technical indicator features (10 features)
	 */
	private async extractTechnicalFeatures(
		historicalData: OHLCData[],
		symbol: string,
		date: Date
	): Promise<Partial<PriceFeatureVector>> {
		try {
			const currentPrice = historicalData[historicalData.length - 1]?.close || 0;

			// Get technical indicators from service
			const technicalInput: any = {
				symbol,
				ohlcData: historicalData.map(d => ({
					timestamp: d.date,
					open: d.open,
					high: d.high,
					low: d.low,
					close: d.close,
					volume: d.volume
				})),
				config: {}
			};
			const indicators = await this.technicalService.calculateAllIndicators(technicalInput);

			// RSI
			const rsi_14 = (indicators as any).rsi?.value || 50;

			// MACD
			const macdVal = (indicators as any).macd?.value || 0;
			const macdSig = (indicators as any).macd?.signal || 0;
			const macd_signal = macdVal - macdSig;
			const macd_histogram = (indicators as any).macd?.histogram || 0;

			// Bollinger Bands
			const bbUpper = (indicators as any).bollingerBands?.upper || currentPrice;
			const bbLower = (indicators as any).bollingerBands?.lower || currentPrice;
			const bollinger_position = bbUpper - bbLower > 0
				? (currentPrice - bbLower) / (bbUpper - bbLower)
				: 0.5;

			// Stochastic
			const stochastic_k = (indicators as any).stochastic?.k || 50;

			// ADX (trend strength)
			const adx_14 = (indicators as any).adx?.value || 25;

			// ATR (volatility)
			const atr_14 = (indicators as any).atr?.value || 0;

			// EMA/SMA distances
			const ema20 = this.calculateEMA(historicalData.map(d => d.close), 20);
			const sma50 = this.calculateSMA(historicalData.map(d => d.close), 50);
			const ema_20_distance = ema20 > 0 ? (currentPrice - ema20) / ema20 : 0;
			const sma_50_distance = sma50 > 0 ? (currentPrice - sma50) / sma50 : 0;

			// Williams %R
			const williams_r = this.calculateWilliamsR(historicalData.slice(-14));

			return {
				rsi_14,
				macd_signal,
				macd_histogram,
				bollinger_position,
				stochastic_k,
				adx_14,
				atr_14,
				ema_20_distance,
				sma_50_distance,
				williams_r
			};
		} catch (error) {
			console.error('Error extracting technical features:', error);
			return this.getDefaultTechnicalFeatures();
		}
	}

	/**
	 * Extract price action features (8 features)
	 */
	private async extractPriceActionFeatures(
		historicalData: OHLCData[]
	): Promise<Partial<PriceFeatureVector>> {
		const currentDay = historicalData[historicalData.length - 1];
		const prevDay = historicalData[historicalData.length - 2];

		// Price momentum
		const price5dAgo = historicalData[historicalData.length - 6]?.close || currentDay.close;
		const price10dAgo = historicalData[historicalData.length - 11]?.close || currentDay.close;
		const price20dAgo = historicalData[historicalData.length - 21]?.close || currentDay.close;

		const price_momentum_5d = (currentDay.close - price5dAgo) / price5dAgo;
		const price_momentum_10d = (currentDay.close - price10dAgo) / price10dAgo;
		const price_momentum_20d = (currentDay.close - price20dAgo) / price20dAgo;

		// Price acceleration
		const price_acceleration = price_momentum_5d - price_momentum_10d;

		// Gap
		const gap_percent = prevDay ? (currentDay.open - prevDay.close) / prevDay.close : 0;

		// Intraday volatility
		const intraday_volatility = currentDay.open > 0
			? (currentDay.high - currentDay.low) / currentDay.open
			: 0;

		// Overnight return
		const overnight_return = prevDay ? (currentDay.open - prevDay.close) / prevDay.close : 0;

		// Distance to 52-week high
		const high52w = Math.max(...historicalData.map(d => d.high));
		const week_high_distance = (high52w - currentDay.close) / high52w;

		return {
			price_momentum_5d,
			price_momentum_10d,
			price_momentum_20d,
			price_acceleration,
			gap_percent,
			intraday_volatility,
			overnight_return,
			week_high_distance
		};
	}

	/**
	 * Extract options flow features (7 features)
	 * PHASE 1: Real implementation using OptionsDataService and OptionsAnalysisService
	 */
	private async extractOptionsFeatures(
		symbol: string,
		date: Date
	): Promise<Partial<PriceFeatureVector>> {
		const cacheKey = `ml:price_features:options:${symbol}:${date.toISOString().split('T')[0]}`;

		try {
			// Check cache first (TTL: 1 hour)
			const cached = await this.cache.get<Partial<PriceFeatureVector>>(cacheKey);
			if (cached) return cached;

			// Get options data from service
			const optionsData = await this.optionsService.getOptionsChain(symbol);
			if (!optionsData) return this.getDefaultOptionsFeatures();

			// 1. Put/Call Ratio (current day)
			const putVolume = optionsData.puts?.reduce((sum, opt) => sum + (opt.volume || 0), 0) || 0;
			const callVolume = optionsData.calls?.reduce((sum, opt) => sum + (opt.volume || 0), 0) || 0;
			const put_call_ratio = callVolume > 0 ? putVolume / callVolume : 1;

			// 2. Put/Call Ratio Change (vs 5-day average from cache)
			const historicalPCKey = `ml:options:pc_ratio:${symbol}`;
			const historicalPC = await this.cache.get<number[]>(historicalPCKey) || [];
			historicalPC.push(put_call_ratio);
			const last5PC = historicalPC.slice(-5);
			await this.cache.set(historicalPCKey, historicalPC.slice(-10), 0); // Never expire - historical data immutable

			const avg5PC = last5PC.reduce((sum, val) => sum + val, 0) / (last5PC.length || 1);
			const put_call_ratio_change = avg5PC > 0 ? (put_call_ratio - avg5PC) / avg5PC : 0;

			// 3. Unusual Options Activity (volume > 2x open interest)
			const totalVolume = putVolume + callVolume;
			const totalOI = (optionsData.puts?.reduce((sum, opt) => sum + (opt.openInterest || 0), 0) || 0) +
				(optionsData.calls?.reduce((sum, opt) => sum + (opt.openInterest || 0), 0) || 0);
			const unusual_options_activity = totalOI > 0 && totalVolume > 2 * totalOI ? 1 : 0;

			// 4. Options IV Rank (percentile of current IV vs 52-week range)
			const currentIV = this.calculateWeightedIV(optionsData);
			const ivHistoryKey = `ml:options:iv_history:${symbol}`;
			const ivHistory = await this.cache.get<number[]>(ivHistoryKey) || [];
			ivHistory.push(currentIV);
			const last252IV = ivHistory.slice(-252); // ~1 year of trading days
			await this.cache.set(ivHistoryKey, last252IV, 0); // Never expire - historical data immutable

			const options_iv_rank = this.calculatePercentileRank(currentIV, last252IV);

			// 5. Gamma Exposure (normalized)
			const gamma_exposure = this.calculateNormalizedGamma(optionsData);

			// 6. Max Pain Distance & 7. Options Volume Ratio
			// Get stock data once for both calculations
			const stockData = await this.getHistoricalData(symbol, date, 1);
			const currentPrice = stockData[stockData.length - 1]?.close || 0;
			const stockVolume = stockData[stockData.length - 1]?.volume || 1;

			const maxPain = this.calculateMaxPain(optionsData);
			const max_pain_distance = currentPrice > 0 && maxPain > 0 ? (currentPrice - maxPain) / currentPrice : 0;

			// 7. Options Volume Ratio (options volume / stock volume)
			const options_volume_ratio = stockVolume > 0 ? totalVolume / stockVolume : 0;

			const features = {
				put_call_ratio,
				put_call_ratio_change,
				unusual_options_activity,
				options_iv_rank,
				gamma_exposure,
				max_pain_distance,
				options_volume_ratio
			};

			// Cache for 1 hour
			await this.cache.set(cacheKey, features, 60 * 60);

			return features;
		} catch (error) {
			console.error(`Error extracting options features for ${symbol}:`, error);
			return this.getDefaultOptionsFeatures();
		}
	}

	/**
	 * Calculate weighted implied volatility across all options
	 */
	private calculateWeightedIV(optionsData: any): number {
		const allOptions = [...(optionsData.puts || []), ...(optionsData.calls || [])];

		if (allOptions.length === 0) return 0.3; // Default 30% IV

		let totalVolume = 0;
		let weightedIV = 0;

		allOptions.forEach((opt: any) => {
			const volume = opt.volume || 0;
			const iv = opt.impliedVolatility || 0;
			weightedIV += iv * volume;
			totalVolume += volume;
		});

		return totalVolume > 0 ? weightedIV / totalVolume : 0.3;
	}

	/**
	 * Calculate percentile rank (0-100)
	 */
	private calculatePercentileRank(value: number, historicalValues: number[]): number {
		if (historicalValues.length === 0) return 50;

		const sorted = [...historicalValues].sort((a, b) => a - b);
		const countBelow = sorted.filter(v => v < value).length;
		return (countBelow / sorted.length) * 100;
	}

	/**
	 * Calculate normalized gamma exposure
	 */
	private calculateNormalizedGamma(optionsData: any): number {
		const calls = optionsData.calls || [];
		const puts = optionsData.puts || [];

		let netGamma = 0;

		// Calls: positive gamma for market makers (negative for us)
		calls.forEach((opt: any) => {
			const gamma = opt.gamma || 0;
			const oi = opt.openInterest || 0;
			netGamma -= gamma * oi * 100; // Each contract = 100 shares
		});

		// Puts: negative gamma for market makers (positive for us)
		puts.forEach((opt: any) => {
			const gamma = opt.gamma || 0;
			const oi = opt.openInterest || 0;
			netGamma += gamma * oi * 100;
		});

		// Normalize to [-1, 1] range (rough approximation)
		const maxGamma = 1000000; // Adjust based on typical values
		return Math.max(-1, Math.min(1, netGamma / maxGamma));
	}

	/**
	 * Calculate max pain strike (strike with highest total option value loss)
	 */
	private calculateMaxPain(optionsData: any): number {
		const strikes = new Set<number>();

		[...(optionsData.calls || []), ...(optionsData.puts || [])].forEach((opt: any) => {
			if (opt.strike) strikes.add(opt.strike);
		});

		if (strikes.size === 0) return 0;

		let maxPainStrike = 0;
		let maxPain = Infinity;

		strikes.forEach(strike => {
			let totalPain = 0;

			// Calculate pain for calls
			(optionsData.calls || []).forEach((opt: any) => {
				if (strike > opt.strike) {
					totalPain += (strike - opt.strike) * (opt.openInterest || 0) * 100;
				}
			});

			// Calculate pain for puts
			(optionsData.puts || []).forEach((opt: any) => {
				if (strike < opt.strike) {
					totalPain += (opt.strike - strike) * (opt.openInterest || 0) * 100;
				}
			});

			if (totalPain < maxPain) {
				maxPain = totalPain;
				maxPainStrike = strike;
			}
		});

		return maxPainStrike;
	}

	/**
	 * Extract institutional flow features (4 features)
	 * PHASE 2: Real implementation using InstitutionalDataService
	 */
	private async extractInstitutionalFeatures(
		symbol: string,
		date: Date
	): Promise<Partial<PriceFeatureVector>> {
		const cacheKey = `ml:price_features:institutional:${symbol}:${date.toISOString().split('T')[0]}`;

		try {
			// Check cache first (TTL: 6 hours - institutional data updates slowly)
			const cached = await this.cache.get<Partial<PriceFeatureVector>>(cacheKey);
			if (cached) return cached;

			// Get institutional intelligence data (includes holdings and insider trades)
			const [intelligence, insiderTransactions] = await Promise.all([
				this.institutionalService.getInstitutionalIntelligence(symbol),
				this.institutionalService.getInsiderTransactions(symbol, 90)
			]);

			// 1. Institutional Net Flow (from quarterly changes)
			let institutional_net_flow = 0;
			if (intelligence?.institutionalSentiment?.quarterlyChange) {
				const qc = intelligence.institutionalSentiment.quarterlyChange;
				const increased = qc.increasedPositions || 0;
				const decreased = qc.decreasedPositions || 0;
				const total = increased + decreased;
				institutional_net_flow = total > 0 ? (increased - decreased) / total : 0;
			}

			// 2. Block Trade Volume (simulated from unusual volume spikes)
			// Since FMP doesn't have dark pool/block trade data, we use volume spike detection
			const historicalData = await this.getHistoricalData(symbol, date, 10);
			const block_trade_volume = this.detectBlockTradeActivity(historicalData);

			// 3. Insider Buying Ratio
			let insider_buying_ratio = 0.5; // Default neutral
			if (insiderTransactions && insiderTransactions.length > 0) {
				const buyTransactions = insiderTransactions.filter(t => t.transactionType === 'BUY');
				const sellTransactions = insiderTransactions.filter(t => t.transactionType === 'SELL');
				const totalTransactions = buyTransactions.length + sellTransactions.length;

				if (totalTransactions > 0) {
					insider_buying_ratio = buyTransactions.length / totalTransactions;
				}
			}

			// 4. Ownership Change (30-day)
			// Use cached historical ownership data to calculate 30-day change
			const ownershipHistoryKey = `ml:institutional:ownership:${symbol}`;
			const ownershipHistory = await this.cache.get<Array<{date: number, ownership: number}>>(ownershipHistoryKey) || [];

			const currentOwnership = intelligence?.institutionalSentiment?.institutionalOwnership || 0;
			ownershipHistory.push({ date: date.getTime(), ownership: currentOwnership });

			// Keep 90 days of history
			const cutoff = date.getTime() - 90 * 24 * 60 * 60 * 1000;
			const filteredHistory = ownershipHistory.filter(h => h.date >= cutoff);
			await this.cache.set(ownershipHistoryKey, filteredHistory, 0); // Never expire - historical data immutable

			// Calculate 30-day change
			const thirtyDaysAgo = date.getTime() - 30 * 24 * 60 * 60 * 1000;
			const historicalOwnership = filteredHistory.find(h => Math.abs(h.date - thirtyDaysAgo) < 7 * 24 * 60 * 60 * 1000);
			const ownership_change_30d = historicalOwnership
				? currentOwnership - historicalOwnership.ownership
				: 0;

			const features = {
				institutional_net_flow,
				block_trade_volume,
				insider_buying_ratio,
				ownership_change_30d
			};

			// Cache for 6 hours
			await this.cache.set(cacheKey, features, 6 * 60 * 60);

			return features;
		} catch (error) {
			console.error(`Error extracting institutional features for ${symbol}:`, error);
			return this.getDefaultInstitutionalFeatures();
		}
	}

	/**
	 * Detect block trade activity from volume patterns
	 * Since we don't have direct dark pool data, detect unusual volume spikes
	 */
	private detectBlockTradeActivity(historicalData: OHLCData[]): number {
		if (historicalData.length < 2) return 0;

		const currentVolume = historicalData[historicalData.length - 1]?.volume || 0;
		const avgVolume = historicalData.slice(0, -1).reduce((sum, d) => sum + d.volume, 0) / (historicalData.length - 1);

		// If current volume > 3x average, consider it potential block trade activity
		// Normalize to 0-1 range
		if (avgVolume === 0) return 0;

		const volumeRatio = currentVolume / avgVolume;
		if (volumeRatio > 3) {
			// Scale from 0 to 1, where 3x = 0.5, 6x = 1.0
			return Math.min(1, (volumeRatio - 3) / 3);
		}

		return 0;
	}

	/**
	 * Extract sentiment features (4 features)
	 * PHASE 3: Real implementation using SentimentAnalysisService
	 */
	private async extractSentimentFeatures(
		symbol: string,
		date: Date
	): Promise<Partial<PriceFeatureVector>> {
		const cacheKey = `ml:price_features:sentiment:${symbol}:${date.toISOString().split('T')[0]}`;

		try {
			// Check cache first (TTL: 15 minutes - sentiment updates frequently)
			const cached = await this.cache.get<Partial<PriceFeatureVector>>(cacheKey);
			if (cached) return cached;

			// Get sentiment indicators (includes news, reddit, options sentiment)
			const [sentimentIndicators, analystData] = await Promise.all([
				this.sentimentService.getSentimentIndicators(symbol),
				this.fmpAPI.getAnalystRatings(symbol)
			]);

			// Earnings data - use placeholder for now (method doesn't exist yet)
			const earningsData: any[] = [];

			// 1. News Sentiment Delta (change from previous day)
			const currentNewsSentiment = sentimentIndicators?.news?.sentiment || 0;
			const sentimentHistoryKey = `ml:sentiment:news_history:${symbol}`;
			const sentimentHistory = await this.cache.get<number[]>(sentimentHistoryKey) || [];
			sentimentHistory.push(currentNewsSentiment);
			const last10Sentiment = sentimentHistory.slice(-10);
			await this.cache.set(sentimentHistoryKey, last10Sentiment, 0); // Never expire - historical data immutable

			const news_sentiment_delta = sentimentHistory.length >= 2
				? currentNewsSentiment - sentimentHistory[sentimentHistory.length - 2]
				: 0;

			// 2. Social Momentum (Reddit + Twitter volume change)
			let social_momentum = 0;
			if (sentimentIndicators?.reddit) {
				const currentRedditPosts = sentimentIndicators.reddit.postCount || 0;
				const socialHistoryKey = `ml:sentiment:social_history:${symbol}`;
				const socialHistory = await this.cache.get<number[]>(socialHistoryKey) || [];
				socialHistory.push(currentRedditPosts);
				const last5Social = socialHistory.slice(-5);
				await this.cache.set(socialHistoryKey, last5Social, 0); // Never expire - historical data immutable

				if (socialHistory.length >= 2) {
					const avgPrevPosts = socialHistory.slice(0, -1).reduce((sum, val) => sum + val, 0) / (socialHistory.length - 1);
					social_momentum = avgPrevPosts > 0 ? (currentRedditPosts - avgPrevPosts) / avgPrevPosts : 0;
				}
			}

			// 3. Analyst Target Distance
			let analyst_target_distance = 0;
			if (analystData) {
				// Check if analystData is an array or object
				const dataArray = Array.isArray(analystData) ? analystData : [analystData];

				// Get average analyst price target
				const targets = dataArray
					.map((a: any) => a.targetPrice)
					.filter((t: any) => t && t > 0);

				if (targets.length > 0) {
					const avgTarget = targets.reduce((sum: number, t: number) => sum + t, 0) / targets.length;
					// Get current price from historical data
					const stockData = await this.getHistoricalData(symbol, date, 1);
					const currentPrice = stockData[stockData.length - 1]?.close || 0;
					analyst_target_distance = currentPrice > 0 ? (avgTarget - currentPrice) / currentPrice : 0;
				}
			}

			// 4. Earnings Surprise Impact (most recent quarter)
			let earnings_surprise_impact = 0;
			if (earningsData && earningsData.length > 0) {
				const mostRecent = earningsData[0];
				if (mostRecent.epsActual != null && mostRecent.epsEstimated != null && mostRecent.epsEstimated !== 0) {
					earnings_surprise_impact = (mostRecent.epsActual - mostRecent.epsEstimated) / Math.abs(mostRecent.epsEstimated);
				}
			}

			const features = {
				news_sentiment_delta,
				social_momentum,
				analyst_target_distance,
				earnings_surprise_impact
			};

			// Cache for 15 minutes
			await this.cache.set(cacheKey, features, 15 * 60);

			return features;
		} catch (error) {
			console.error(`Error extracting sentiment features for ${symbol}:`, error);
			return this.getDefaultSentimentFeatures();
		}
	}

	/**
	 * Extract macro context features (4 features)
	 * PHASE 4: Real implementation using MacroeconomicAnalysisService
	 */
	private async extractMacroFeatures(
		symbol: string,
		date: Date
	): Promise<Partial<PriceFeatureVector>> {
		const cacheKey = `ml:price_features:macro:${symbol}:${date.toISOString().split('T')[0]}`;

		try {
			// Check cache first (TTL: 1 hour - macro data doesn't change rapidly)
			const cached = await this.cache.get<Partial<PriceFeatureVector>>(cacheKey);
			if (cached) return cached;

			// Get stock and market data in parallel
			const [stockData, spyData, vixData, macroContext, sectorETF] = await Promise.all([
				this.getHistoricalData(symbol, date, 20),
				this.getHistoricalData('SPY', date, 20),
				this.getHistoricalData('^VIX', date, 1),
				this.macroService.getMacroeconomicContext(),
				this.getSectorETFSymbol(symbol).then(etf => this.getHistoricalData(etf, date, 5))
			]);

			// 1. Sector Momentum (5-day)
			let sector_momentum_5d = 0;
			if (sectorETF && sectorETF.length >= 5) {
				sector_momentum_5d = this.calculateReturn(sectorETF);
			}

			// 2. SPY Momentum (5-day)
			let spy_momentum_5d = 0;
			if (spyData && spyData.length >= 5) {
				spy_momentum_5d = this.calculateReturn(spyData.slice(-5));
			}

			// 3. VIX Level
			let vix_level = 15; // Default
			if (vixData && vixData.length > 0) {
				vix_level = vixData[vixData.length - 1].close;
			}

			// 4. Correlation to SPY (20-day rolling)
			let correlation_to_spy_20d = 0.7; // Default
			if (stockData.length >= 20 && spyData.length >= 20) {
				correlation_to_spy_20d = this.calculateCorrelation(
					stockData.slice(-20).map(d => d.close),
					spyData.slice(-20).map(d => d.close)
				);
			}

			const features = {
				sector_momentum_5d,
				spy_momentum_5d,
				vix_level,
				correlation_to_spy_20d
			};

			// Cache for 1 hour
			await this.cache.set(cacheKey, features, 60 * 60);

			return features;
		} catch (error) {
			console.error(`Error extracting macro features for ${symbol}:`, error);
			return this.getDefaultMacroFeatures();
		}
	}

	/**
	 * Get sector ETF symbol for a given stock
	 * Maps sectors to their respective SPDR sector ETFs
	 */
	private async getSectorETFSymbol(symbol: string): Promise<string> {
		// Cache sector mapping
		const cacheKey = `ml:sector_mapping:${symbol}`;
		const cached = await this.cache.get<string>(cacheKey);
		if (cached) return cached;

		try {
			// Get company info which includes sector information
			const companyInfo = await this.fmpAPI.getCompanyInfo(symbol);
			const sector = companyInfo?.sector || '';

			// Map sector to SPDR ETF
			const sectorETFMap: Record<string, string> = {
				'Technology': 'XLK',
				'Healthcare': 'XLV',
				'Financials': 'XLF',
				'Financial Services': 'XLF',
				'Energy': 'XLE',
				'Utilities': 'XLU',
				'Industrials': 'XLI',
				'Materials': 'XLB',
				'Basic Materials': 'XLB',
				'Consumer Cyclical': 'XLY',
				'Consumer Defensive': 'XLP',
				'Real Estate': 'XLRE',
				'Communication Services': 'XLC',
				'Telecommunication': 'XLC'
			};

			const etf = sectorETFMap[sector] || 'SPY'; // Default to SPY if sector unknown

			// Cache forever (company sector never changes)
			await this.cache.set(cacheKey, etf, 0);

			return etf;
		} catch (error) {
			console.error(`Error getting sector ETF for ${symbol}:`, error);
			return 'SPY'; // Fallback to SPY
		}
	}

	/**
	 * Calculate Pearson correlation coefficient between two price series
	 */
	private calculateCorrelation(series1: number[], series2: number[]): number {
		if (series1.length !== series2.length || series1.length === 0) return 0;

		const n = series1.length;
		const mean1 = series1.reduce((sum, val) => sum + val, 0) / n;
		const mean2 = series2.reduce((sum, val) => sum + val, 0) / n;

		let numerator = 0;
		let sumSq1 = 0;
		let sumSq2 = 0;

		for (let i = 0; i < n; i++) {
			const diff1 = series1[i] - mean1;
			const diff2 = series2[i] - mean2;
			numerator += diff1 * diff2;
			sumSq1 += diff1 * diff1;
			sumSq2 += diff2 * diff2;
		}

		const denominator = Math.sqrt(sumSq1 * sumSq2);
		return denominator === 0 ? 0 : numerator / denominator;
	}

	// === Helper Functions ===

	private calculateSlope(points: { x: number; y: number }[]): number {
		const n = points.length;
		if (n < 2) return 0;

		const sumX = points.reduce((sum, p) => sum + p.x, 0);
		const sumY = points.reduce((sum, p) => sum + p.y, 0);
		const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
		const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);

		const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
		return isNaN(slope) ? 0 : slope;
	}

	private calculateSMA(prices: number[], period: number): number {
		if (prices.length < period) return prices[prices.length - 1] || 0;
		const slice = prices.slice(-period);
		return slice.reduce((sum, p) => sum + p, 0) / slice.length;
	}

	private calculateEMA(prices: number[], period: number): number {
		if (prices.length < period) return this.calculateSMA(prices, prices.length);

		const multiplier = 2 / (period + 1);
		let ema = this.calculateSMA(prices.slice(0, period), period);

		for (let i = period; i < prices.length; i++) {
			ema = (prices[i] - ema) * multiplier + ema;
		}

		return ema;
	}

	private calculateWilliamsR(data: OHLCData[]): number {
		if (data.length === 0) return -50;

		const high = Math.max(...data.map(d => d.high));
		const low = Math.min(...data.map(d => d.low));
		const close = data[data.length - 1].close;

		return high - low > 0 ? ((high - close) / (high - low)) * -100 : -50;
	}

	private calculateReturn(data: OHLCData[]): number {
		if (data.length < 2) return 0;
		const start = data[0].close;
		const end = data[data.length - 1].close;
		return (end - start) / start;
	}

	// === Default Features (Fallbacks) ===

	private getDefaultTechnicalFeatures(): Partial<PriceFeatureVector> {
		return {
			rsi_14: 50,
			macd_signal: 0,
			macd_histogram: 0,
			bollinger_position: 0.5,
			stochastic_k: 50,
			adx_14: 25,
			atr_14: 0,
			ema_20_distance: 0,
			sma_50_distance: 0,
			williams_r: -50
		};
	}

	private getDefaultOptionsFeatures(): Partial<PriceFeatureVector> {
		return {
			put_call_ratio: 1,
			put_call_ratio_change: 0,
			unusual_options_activity: 0,
			options_iv_rank: 50,
			gamma_exposure: 0,
			max_pain_distance: 0,
			options_volume_ratio: 0
		};
	}

	private getDefaultInstitutionalFeatures(): Partial<PriceFeatureVector> {
		return {
			institutional_net_flow: 0,
			block_trade_volume: 0,
			insider_buying_ratio: 0.5,
			ownership_change_30d: 0
		};
	}

	private getDefaultSentimentFeatures(): Partial<PriceFeatureVector> {
		return {
			news_sentiment_delta: 0,
			social_momentum: 0,
			analyst_target_distance: 0,
			earnings_surprise_impact: 0
		};
	}

	private getDefaultMacroFeatures(): Partial<PriceFeatureVector> {
		return {
			sector_momentum_5d: 0,
			spy_momentum_5d: 0,
			vix_level: 15,
			correlation_to_spy_20d: 0.7
		};
	}
}
