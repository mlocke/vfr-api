/**
 * Market Factors Module
 * Contains all market-related calculations including ESG, VWAP, short interest, and liquidity
 */

import { RedisCache } from "../../cache/RedisCache";
import { VWAPService } from "../../financial-data/VWAPService";
import { ESGDataService } from "../../financial-data/ESGDataService";
import { ShortInterestService } from "../../financial-data/ShortInterestService";
import { ExtendedMarketDataService } from "../../financial-data/ExtendedMarketDataService";
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

interface TechnicalDataPoint {
	symbol: string;
	rsi?: number;
	macd?: { signal: number; histogram: number; macd: number };
	sma?: { [period: string]: number };
	volatility?: number;
	sentimentScore?: number;
	vwapAnalysis?: any;
	macroeconomicContext?: any;
	institutionalData?: any;
	shortInterestData?: any;
	extendedMarketData?: any;
	optionsData?: any;
	[key: string]: any;
}

interface HistoricalPrice {
	timestamp: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
}

export class MarketFactors {
	private cache: RedisCache;
	private vwapService?: VWAPService;
	private esgService?: ESGDataService;
	private shortInterestService?: ShortInterestService;
	private extendedMarketService?: ExtendedMarketDataService;
	private twelveDataAPI: TwelveDataAPI;
	private historicalDataCache = new Map<string, HistoricalPrice[]>();

	constructor(
		cache: RedisCache,
		historicalDataCache: Map<string, HistoricalPrice[]>,
		vwapService?: VWAPService,
		esgService?: ESGDataService,
		shortInterestService?: ShortInterestService,
		extendedMarketService?: ExtendedMarketDataService
	) {
		this.cache = cache;
		this.historicalDataCache = historicalDataCache;
		this.vwapService = vwapService;
		this.esgService = esgService || new ESGDataService();
		this.shortInterestService = shortInterestService;
		this.extendedMarketService = extendedMarketService;
		this.twelveDataAPI = new TwelveDataAPI();
	}

	// ==================== VOLUME CALCULATIONS ====================

	async calculateVolumeReversion(
		symbol: string,
		marketData: MarketDataPoint
	): Promise<number | null> {
		const historicalData = await this.getHistoricalData(symbol, 20);
		if (!historicalData || historicalData.length < 20) {
			return null;
		}

		const avgVolume =
			historicalData.reduce((sum, data) => sum + data.volume, 0) / historicalData.length;

		if (avgVolume === 0) return null;

		const volumeRatio = marketData.volume / avgVolume;

		// Score based on volume deviation (higher volume = higher reversion potential)
		return Math.min(1, Math.max(0, (volumeRatio - 0.5) / 2));
	}

	// ==================== VWAP CALCULATIONS ====================

	calculateVWAPDeviationScore(vwapAnalysis?: any): number | null {
		console.log("📊 Calculating VWAP deviation score from pre-fetched data...");

		if (!vwapAnalysis) {
			console.warn("📊 No VWAP analysis data provided - using fallback");
			return null;
		}

		try {
			const deviationPercent = Math.abs(vwapAnalysis.deviationPercent);

			if (deviationPercent > 3.0) return 0.9;
			if (deviationPercent > 1.5) return 0.7;
			if (deviationPercent > 0.5) return 0.5;
			return 0.3;
		} catch (error) {
			console.error("📊 Error calculating VWAP deviation score:", error);
			return null;
		}
	}

	calculateVWAPTradingSignals(vwapAnalysis?: any): number | null {
		console.log("📊 Calculating VWAP trading signals from pre-fetched data...");

		if (!vwapAnalysis) {
			console.warn("📊 No VWAP analysis data provided - using fallback");
			return null;
		}

		try {
			const { signal, strength } = vwapAnalysis;

			let score = 0.5;

			if (signal === "above") {
				score = 0.7;
			} else if (signal === "below") {
				score = 0.3;
			}

			const strengthMultiplier =
				strength === "strong" ? 1.2 : strength === "moderate" ? 1.0 : 0.8;

			score *= strengthMultiplier;

			console.log(
				`📊 VWAP trading signal: ${signal} with ${strength} strength = ${score.toFixed(3)}`
			);
			return Math.max(0, Math.min(1, score));
		} catch (error) {
			console.error("📊 Error calculating VWAP trading signals:", error);
			return null;
		}
	}

	async calculateVWAPTrendScore(
		symbol: string,
		vwapAnalysis?: any
	): Promise<number | null> {
		console.log("📊 Calculating VWAP trend score with historical analysis...");

		if (!this.vwapService) {
			console.warn("📊 VWAPService not available - skipping trend analysis");
			return null;
		}

		try {
			const trendInsights = await this.vwapService.getVWAPTrendInsights(symbol);

			if (!trendInsights) {
				console.warn(`📊 No VWAP trend insights available for ${symbol} - using fallback`);
				return this.calculateVWAPTradingSignals(vwapAnalysis);
			}

			let trendScore = trendInsights.trendScore;
			const normalizedTrendScore = (trendScore + 1) / 2;

			const confidenceWeight = trendInsights.currentTrend.confidence;
			const weightedScore =
				normalizedTrendScore * confidenceWeight + 0.5 * (1 - confidenceWeight);

			if (trendInsights.trendConvergence === "bullish") {
				return Math.min(weightedScore + 0.1, 1.0);
			} else if (trendInsights.trendConvergence === "bearish") {
				return Math.max(weightedScore - 0.1, 0.0);
			}

			console.log(
				`📊 VWAP trend analysis for ${symbol}: trend=${trendScore.toFixed(3)}, confidence=${confidenceWeight.toFixed(3)}, final=${weightedScore.toFixed(3)}`
			);
			return weightedScore;
		} catch (error) {
			console.error(`📊 Error calculating VWAP trend score for ${symbol}:`, error);
			return this.calculateVWAPTradingSignals(vwapAnalysis);
		}
	}

	// ==================== ESG CALCULATIONS ====================

	async calculateESGComposite(symbol: string, sector: string): Promise<number> {
		try {
			if (!this.esgService) {
				console.warn("ESG service not available for composite calculation");
				return 0.6;
			}

			const esgImpact = await this.esgService.getESGImpactForStock(symbol, sector, 0.5);
			if (esgImpact && esgImpact.esgScore > 0) {
				return esgImpact.esgScore / 100;
			}

			return 0.6;
		} catch (error) {
			console.warn(`ESG composite calculation failed for ${symbol}:`, error);
			return 0.6;
		}
	}

	async calculateESGFactor(
		symbol: string,
		sector: string,
		factor: "environmental" | "social" | "governance"
	): Promise<number> {
		try {
			if (!this.esgService) {
				console.warn(`ESG service not available for ${factor} factor`);
				return 0.6;
			}

			const esgScore = await this.esgService.getESGScore(symbol, sector);
			if (esgScore) {
				switch (factor) {
					case "environmental":
						return esgScore.environmental / 100;
					case "social":
						return esgScore.social / 100;
					case "governance":
						return esgScore.governance / 100;
					default:
						return 0.6;
				}
			}

			return 0.6;
		} catch (error) {
			console.warn(`ESG ${factor} factor calculation failed for ${symbol}:`, error);
			return 0.6;
		}
	}

	// ==================== MACROECONOMIC CALCULATIONS ====================

	calculateMacroeconomicSectorImpact(macroContext?: any, sector?: string): number | null {
		console.log("🌍 Calculating macroeconomic sector impact from pre-fetched data...");

		if (!macroContext || !sector) {
			console.warn("🌍 No macroeconomic context or sector provided - using fallback");
			return null;
		}

		try {
			const { sectorImpact, impact } = macroContext;

			let score = 0.5;

			if (impact === "positive") {
				score = 0.8;
			} else if (impact === "negative") {
				score = 0.2;
			}

			if (sectorImpact && typeof sectorImpact === "number") {
				score = (score + sectorImpact) / 2;
			}

			console.log(`🌍 Macro sector impact for ${sector}: ${impact} = ${score.toFixed(3)}`);
			return Math.max(0, Math.min(1, score));
		} catch (error) {
			console.error("🌍 Error calculating macroeconomic sector impact:", error);
			return null;
		}
	}

	calculateMacroeconomicComposite(macroContext?: any): number | null {
		console.log("🌍 Calculating macroeconomic composite from pre-fetched data...");

		if (!macroContext) {
			console.warn("🌍 No macroeconomic context provided - using fallback");
			return null;
		}

		try {
			const { macroScore, adjustedScore, confidence } = macroContext;

			let score = (adjustedScore || macroScore || 5.0) / 10;

			if (confidence && confidence < 0.7) {
				score = (score + 0.5) / 2;
			}

			console.log(
				`🌍 Macroeconomic composite score: ${score.toFixed(3)} (confidence: ${confidence || "unknown"})`
			);
			return Math.max(0, Math.min(1, score));
		} catch (error) {
			console.error("🌍 Error calculating macroeconomic composite:", error);
			return null;
		}
	}

	// ==================== SHORT INTEREST CALCULATIONS ====================

	async calculateShortInterestComposite(
		symbol: string,
		technicalData?: TechnicalDataPoint
	): Promise<number> {
		try {
			if (technicalData?.shortInterestData) {
				const shortInterestImpact = technicalData.shortInterestData;
				console.log(
					`📊 Using pre-fetched short interest data for ${symbol}: score ${shortInterestImpact.score}`
				);
				return shortInterestImpact.score || 0.5;
			}

			if (!this.shortInterestService) {
				console.warn("Short Interest service not available");
				return 0.5;
			}

			const shortInterestData = await this.shortInterestService.getShortInterestData(
				symbol,
				"unknown"
			);
			if (shortInterestData && shortInterestData.shortInterestRatio > 0) {
				const normalizedRatio = Math.min(25, shortInterestData.shortInterestRatio) / 25;
				return normalizedRatio;
			}

			return 0.5;
		} catch (error) {
			console.warn(`Short Interest composite calculation failed for ${symbol}:`, error);
			return 0.5;
		}
	}

	async calculateShortSqueezePotential(symbol: string): Promise<number> {
		try {
			if (!this.shortInterestService) {
				console.warn("Short Interest service not available for squeeze potential");
				return 0.5;
			}

			const shortInterestData = await this.shortInterestService.getShortInterestData(
				symbol,
				"unknown"
			);
			if (shortInterestData) {
				let squeezeScore = 0;

				if (shortInterestData.shortInterestRatio > 15) squeezeScore += 0.5;
				else if (shortInterestData.shortInterestRatio > 5) squeezeScore += 0.3;
				else squeezeScore += 0.1;

				if (shortInterestData.daysTooCover > 7) {
					squeezeScore += 0.3;
				} else if (shortInterestData.daysTooCover > 3) {
					squeezeScore += 0.15;
				}

				if (shortInterestData.percentageChange > 10) {
					squeezeScore += 0.2;
				} else if (shortInterestData.percentageChange > 0) {
					squeezeScore += 0.1;
				}

				return Math.min(1.0, squeezeScore);
			}

			return 0.5;
		} catch (error) {
			console.warn(`Short squeeze potential calculation failed for ${symbol}:`, error);
			return 0.5;
		}
	}

	// ==================== EXTENDED MARKET DATA CALCULATIONS ====================

	async calculateExtendedMarketComposite(
		symbol: string,
		technicalData?: TechnicalDataPoint
	): Promise<number> {
		try {
			if (technicalData?.extendedMarketData) {
				const extendedData = technicalData.extendedMarketData;
				console.log(
					`💹 Using pre-fetched extended market data for ${symbol}: status ${extendedData.extendedHours?.marketStatus || "N/A"}`
				);

				let compositeScore = 0.5;

				if (extendedData.extendedHours?.marketStatus) {
					const statusScore =
						extendedData.extendedHours.marketStatus === "market-hours" ? 0.8 : 0.6;
					compositeScore += (statusScore - 0.5) * 0.3;
				}

				if (extendedData.liquidityMetrics?.liquidityScore > 0) {
					const liquidityScore = extendedData.liquidityMetrics.liquidityScore / 10;
					compositeScore += (liquidityScore - 0.5) * 0.4;
				}

				if (extendedData.bidAskSpread?.spreadPercent > 0) {
					const efficiencyScore = Math.max(
						0,
						1 - extendedData.bidAskSpread.spreadPercent / 5
					);
					compositeScore += (efficiencyScore - 0.5) * 0.3;
				}

				return Math.max(0.2, Math.min(1, compositeScore));
			}

			if (!this.extendedMarketService) {
				console.warn("Extended Market Data service not available");
				return 0.5;
			}

			const [liquidityMetrics, bidAskSpread] = await Promise.all([
				this.extendedMarketService
					.getBatchLiquidityMetrics([symbol])
					.then(map => map.get(symbol)),
				this.extendedMarketService.getBidAskSpread(symbol),
			]);

			let compositeScore = 0.0;

			if (liquidityMetrics && liquidityMetrics.liquidityScore > 0) {
				compositeScore += (liquidityMetrics.liquidityScore / 10) * 0.6;
			} else {
				compositeScore += 0.5 * 0.6;
			}

			if (bidAskSpread && bidAskSpread.spreadPercent > 0) {
				const efficiencyScore = Math.max(0, 1 - bidAskSpread.spreadPercent / 5);
				compositeScore += efficiencyScore * 0.4;
			} else {
				compositeScore += 0.5 * 0.4;
			}

			return Math.max(0, Math.min(1, compositeScore));
		} catch (error) {
			console.warn(`Extended Market Data composite calculation failed for ${symbol}:`, error);
			return 0.5;
		}
	}

	async calculateLiquidityScore(symbol: string): Promise<number> {
		try {
			if (!this.extendedMarketService) {
				console.warn("Extended Market Data service not available for liquidity score");
				return 0.5;
			}

			const liquidityMap = await this.extendedMarketService.getBatchLiquidityMetrics([
				symbol,
			]);
			const liquidityMetrics = liquidityMap.get(symbol);

			if (liquidityMetrics && liquidityMetrics.liquidityScore > 0) {
				return liquidityMetrics.liquidityScore / 10;
			}

			return 0.5;
		} catch (error) {
			console.warn(`Liquidity score calculation failed for ${symbol}:`, error);
			return 0.5;
		}
	}

	async calculateBidAskEfficiency(symbol: string): Promise<number> {
		try {
			if (!this.extendedMarketService) {
				console.warn("Extended Market Data service not available for bid-ask efficiency");
				return 0.5;
			}

			const bidAskSpread = await this.extendedMarketService.getBidAskSpread(symbol);
			if (bidAskSpread && bidAskSpread.spreadPercent > 0) {
				const spreadPercent = bidAskSpread.spreadPercent;

				if (spreadPercent <= 0.05) return 0.9;
				if (spreadPercent <= 0.5) return 0.7;
				if (spreadPercent <= 2.0) return 0.5;
				return 0.3;
			}

			return 0.5;
		} catch (error) {
			console.warn(`Bid-ask efficiency calculation failed for ${symbol}:`, error);
			return 0.5;
		}
	}

	// ==================== HELPER METHODS ====================

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
