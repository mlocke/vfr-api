/**
 * Factor Library for Dynamic Stock Selection Algorithms
 * Refactored to use domain-specific factor modules
 * Provides configurable factor calculations with caching and data quality integration
 */

import { FactorCalculator } from "./types";
import { TechnicalIndicatorService } from "../technical-analysis/TechnicalIndicatorService";
import { TwelveDataAPI } from "../financial-data/TwelveDataAPI";
import { RedisCache } from "../cache/RedisCache";
import { VWAPService } from "../financial-data/VWAPService";
import { ESGDataService } from "../financial-data/ESGDataService";
import { ShortInterestService } from "../financial-data/ShortInterestService";
import { ExtendedMarketDataService } from "../financial-data/ExtendedMarketDataService";

// Import domain-specific factor modules
import { TechnicalFactors } from "./factors/TechnicalFactors";
import { FundamentalFactors } from "./factors/FundamentalFactors";
import { MarketFactors } from "./factors/MarketFactors";

interface MarketDataPoint {
	symbol: string;
	price: number;
	volume: number;
	marketCap: number;
	sector: string;
	exchange: string;
	timestamp: number;
}

interface FundamentalDataPoint {
	symbol: string;
	peRatio?: number;
	pbRatio?: number;
	debtToEquity?: number;
	roe?: number;
	revenueGrowth?: number;
	currentRatio?: number;
	operatingMargin?: number;
	netProfitMargin?: number;
	grossProfitMargin?: number;
	priceToSales?: number;
	evEbitda?: number;
	evToEbitda?: number;
	interestCoverage?: number;
	earningsGrowth?: number;
	dividendYield?: number;
	payoutRatio?: number;
	revenueGrowthQoQ?: number;
	revenueGrowthYoY?: number;
	revenue?: number;
	[key: string]: any;
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
	optionsData?: OptionsDataPoint;
	[key: string]: any;
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

export class FactorLibrary {
	private factorCache = new Map<string, { value: number; timestamp: number }>();
	private historicalDataCache = new Map<string, HistoricalPrice[]>();
	private technicalService: TechnicalIndicatorService;
	private twelveDataAPI: TwelveDataAPI;
	private cache: RedisCache;
	private vwapService?: VWAPService;
	private esgService?: ESGDataService;
	private shortInterestService?: ShortInterestService;
	private extendedMarketService?: ExtendedMarketDataService;

	// Domain-specific factor modules
	private technicalFactors: TechnicalFactors;
	private fundamentalFactors: FundamentalFactors;
	private marketFactors: MarketFactors;

	constructor(
		cache?: RedisCache,
		technicalService?: TechnicalIndicatorService,
		vwapService?: VWAPService,
		esgService?: ESGDataService,
		shortInterestService?: ShortInterestService,
		extendedMarketService?: ExtendedMarketDataService
	) {
		this.cache = cache || new RedisCache();
		this.technicalService = technicalService || new TechnicalIndicatorService(this.cache);
		this.twelveDataAPI = new TwelveDataAPI();
		this.vwapService = vwapService;
		this.esgService = esgService || new ESGDataService();
		this.shortInterestService = shortInterestService;
		this.extendedMarketService = extendedMarketService;

		// Initialize domain-specific factor modules
		this.technicalFactors = new TechnicalFactors(
			this.technicalService,
			this.cache,
			this.historicalDataCache
		);

		this.fundamentalFactors = new FundamentalFactors(this.cache);

		this.marketFactors = new MarketFactors(
			this.cache,
			this.historicalDataCache,
			this.vwapService,
			this.esgService,
			this.shortInterestService,
			this.extendedMarketService
		);
	}

	async calculateFactor(
		factorName: string,
		symbol: string,
		marketData: MarketDataPoint,
		fundamentalData?: FundamentalDataPoint,
		technicalData?: TechnicalDataPoint
	): Promise<number | null> {
		const cacheKey = `${factorName}_${symbol}_${Math.floor(Date.now() / 60000)}`;
		const cached = this.factorCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < 300000) {
			return cached.value;
		}

		let result: number | null = null;
		const startTime = Date.now();

		try {
			console.log(`Starting calculation of factor ${factorName} for ${symbol}`);

			switch (factorName) {
				case "momentum_1m":
					result = await this.technicalFactors.calculateMomentum(symbol, 21);
					break;
				case "momentum_3m":
					result = await this.technicalFactors.calculateMomentum(symbol, 63);
					break;
				case "momentum_6m":
					result = await this.technicalFactors.calculateMomentum(symbol, 126);
					break;
				case "momentum_12m":
					result = await this.technicalFactors.calculateMomentum(symbol, 252);
					break;
				case "price_reversion_20d":
					result = await this.technicalFactors.calculatePriceReversion(symbol, marketData, 20);
					break;
				case "price_reversion_50d":
					result = await this.technicalFactors.calculatePriceReversion(symbol, marketData, 50);
					break;
				case "volume_reversion":
					result = await this.marketFactors.calculateVolumeReversion(symbol, marketData);
					break;
				case "pe_ratio":
					result = this.fundamentalFactors.calculatePEScore(fundamentalData?.peRatio, marketData?.sector);
					break;
				case "pb_ratio":
					result = this.fundamentalFactors.calculatePBScore(fundamentalData?.pbRatio, marketData?.sector);
					break;
				case "ev_ebitda":
					result = this.fundamentalFactors.calculateEVEBITDAScore(fundamentalData, marketData?.sector);
					break;
				case "price_to_sales":
					result = this.fundamentalFactors.calculatePriceToSalesScore(fundamentalData, marketData);
					break;
				case "peg_ratio":
					result = this.fundamentalFactors.calculatePEGScore(fundamentalData, marketData?.sector);
					break;
				case "roe":
					result = this.fundamentalFactors.calculateROEScore(fundamentalData?.roe);
					break;
				case "debt_equity":
					result = this.fundamentalFactors.calculateDebtToEquityScore(fundamentalData?.debtToEquity);
					break;
				case "current_ratio":
					result = this.fundamentalFactors.calculateCurrentRatioScore(fundamentalData);
					break;
				case "interest_coverage":
					result = this.fundamentalFactors.calculateInterestCoverageScore(fundamentalData);
					break;
				case "revenue_growth":
					result = this.fundamentalFactors.calculateRevenueGrowthScore(fundamentalData?.revenueGrowth);
					break;
				case "earnings_growth":
					result = this.fundamentalFactors.calculateEarningsGrowthScore(fundamentalData);
					break;
				case "revenue_acceleration":
					result = this.fundamentalFactors.calculateRevenueAccelerationScore(fundamentalData);
					break;
				case "rsi_14d":
					result = this.technicalFactors.calculateRSIScore(technicalData?.rsi);
					break;
				case "macd_signal":
					result = this.technicalFactors.calculateMACDScore(technicalData?.macd);
					break;
				case "bollinger_position":
					result = await this.technicalFactors.calculateBollingerPosition(symbol, marketData);
					break;
				case "sma_alignment":
					result = await this.technicalFactors.calculateSMAAlignment(symbol);
					break;
				case "ema_trend":
					result = await this.technicalFactors.calculateEMATrend(symbol);
					break;
				case "macd_histogram":
					result = await this.technicalFactors.calculateMACDHistogram(symbol);
					break;
				case "bollinger_squeeze":
					result = await this.technicalFactors.calculateBollingerSqueeze(symbol);
					break;
				case "stochastic_signal":
					result = await this.technicalFactors.calculateStochasticSignal(symbol);
					break;
				case "williams_r":
					result = await this.technicalFactors.calculateWilliamsR(symbol);
					break;
				case "roc_momentum":
					result = await this.technicalFactors.calculateROCMomentum(symbol);
					break;
				case "momentum_convergence":
					result = await this.technicalFactors.calculateMomentumConvergence(symbol);
					break;
				case "obv_trend":
					result = await this.technicalFactors.calculateOBVTrend(symbol);
					break;
				case "vwap_position":
					result = await this.technicalFactors.calculateVWAPPosition(symbol);
					break;
				case "volume_confirmation":
					result = await this.technicalFactors.calculateVolumeConfirmation(symbol);
					break;
				case "atr_volatility":
					result = await this.technicalFactors.calculateATRVolatility(symbol);
					break;
				case "volatility_breakout":
					result = await this.technicalFactors.calculateVolatilityBreakout(symbol);
					break;
				case "candlestick_patterns":
					result = await this.technicalFactors.calculateCandlestickPatterns(symbol);
					break;
				case "chart_patterns":
					result = await this.technicalFactors.calculateChartPatterns(symbol);
					break;
				case "support_resistance":
					result = await this.technicalFactors.calculateSupportResistance(symbol);
					break;
				case "technical_momentum_composite":
					result = await this.technicalFactors.calculateTechnicalMomentumComposite(symbol);
					break;
				case "technical_trend_composite":
					result = await this.technicalFactors.calculateTechnicalTrendComposite(symbol);
					break;
				case "technical_overall_score":
					result = await this.technicalFactors.calculateTechnicalOverallScore(symbol);
					break;
				case "technical_overall_score_with_options":
					result = await this.technicalFactors.calculateTechnicalOverallScoreWithOptions(
						symbol,
						technicalData?.optionsData
					);
					break;
				case "options_composite":
					result = this.technicalFactors.calculateOptionsScore(technicalData?.optionsData);
					break;
				case "put_call_ratio_score":
					result = technicalData?.optionsData?.putCallRatio
						? this.technicalFactors.calculatePutCallRatioScore(technicalData.optionsData.putCallRatio)
						: null;
					break;
				case "iv_percentile_score":
					result = technicalData?.optionsData?.impliedVolatilityPercentile
						? this.technicalFactors.calculateIVPercentileScore(
								technicalData.optionsData.impliedVolatilityPercentile
							)
						: null;
					break;
				case "options_flow_score":
					result = technicalData?.optionsData?.optionsFlow
						? this.technicalFactors.calculateOptionsFlowScore(technicalData.optionsData.optionsFlow)
						: null;
					break;
				case "greeks_score":
					result = technicalData?.optionsData?.greeks
						? this.technicalFactors.calculateGreeksScore(technicalData.optionsData.greeks)
						: null;
					break;
				case "volume_divergence_score":
					result = technicalData?.optionsData?.volumeDivergence
						? this.technicalFactors.calculateVolumeDivergenceScore(
								technicalData.optionsData.volumeDivergence
							)
						: null;
					break;
				case "vwap_deviation_score":
					result = this.marketFactors.calculateVWAPDeviationScore(technicalData?.vwapAnalysis);
					break;
				case "vwap_trading_signals":
					result = this.marketFactors.calculateVWAPTradingSignals(technicalData?.vwapAnalysis);
					break;
				case "vwap_trend_analysis":
					result = await this.marketFactors.calculateVWAPTrendScore(
						symbol,
						technicalData?.vwapAnalysis
					);
					break;
				case "macroeconomic_sector_impact":
					result = this.marketFactors.calculateMacroeconomicSectorImpact(
						technicalData?.macroeconomicContext,
						marketData?.sector
					);
					break;
				case "macroeconomic_composite":
					result = this.marketFactors.calculateMacroeconomicComposite(
						technicalData?.macroeconomicContext
					);
					break;
				case "volatility_30d":
					result = await this.technicalFactors.calculateVolatilityScore(symbol, 30);
					break;
				case "volatility_ratio":
					result = await this.technicalFactors.calculateVolatilityRatio(symbol);
					break;
				case "beta":
					result = await this.technicalFactors.calculateBetaScore(symbol);
					break;
				case "dividend_yield":
					result = this.fundamentalFactors.calculateDividendYieldScore(fundamentalData);
					break;
				case "dividend_growth":
					result = this.fundamentalFactors.calculateDividendGrowthScore(fundamentalData);
					break;
				case "payout_ratio":
					result = this.fundamentalFactors.calculatePayoutRatioScore(fundamentalData);
					break;
				case "esg_composite":
					result = await this.marketFactors.calculateESGComposite(symbol, marketData.sector);
					break;
				case "esg_environmental":
					result = await this.marketFactors.calculateESGFactor(symbol, marketData.sector, "environmental");
					break;
				case "esg_social":
					result = await this.marketFactors.calculateESGFactor(symbol, marketData.sector, "social");
					break;
				case "esg_governance":
					result = await this.marketFactors.calculateESGFactor(symbol, marketData.sector, "governance");
					break;
				case "short_interest_composite":
					result = await this.marketFactors.calculateShortInterestComposite(symbol, technicalData);
					break;
				case "short_squeeze_potential":
					result = await this.marketFactors.calculateShortSqueezePotential(symbol);
					break;
				case "extended_market_composite":
					result = await this.marketFactors.calculateExtendedMarketComposite(symbol, technicalData);
					break;
				case "liquidity_score":
					result = await this.marketFactors.calculateLiquidityScore(symbol);
					break;
				case "bid_ask_efficiency":
					result = await this.marketFactors.calculateBidAskEfficiency(symbol);
					break;
				case "composite":
					const sentimentScore = (technicalData as any)?.sentimentScore;
					const esgScore = (technicalData as any)?.esgScore;
					const macroeconomicContext = (technicalData as any)?.macroeconomicContext;
					const shortInterestData = (technicalData as any)?.shortInterestData;
					const extendedMarketData = (technicalData as any)?.extendedMarketData;
					result = await this.calculateMainComposite(
						symbol,
						marketData,
						fundamentalData,
						technicalData,
						sentimentScore,
						esgScore,
						macroeconomicContext,
						shortInterestData,
						extendedMarketData
					);
					break;
				case "quality_composite":
					result = this.fundamentalFactors.calculateQualityComposite(fundamentalData);
					break;
				case "momentum_composite":
					result = await this.calculateMomentumComposite(symbol, marketData, technicalData);
					break;
				case "value_composite":
					result = this.fundamentalFactors.calculateValueComposite(fundamentalData, marketData);
					break;
				default:
					console.warn(`Unknown factor: ${factorName}`);
					return null;
			}

			const calculationTime = Date.now() - startTime;

			if (result !== null && !isNaN(result)) {
				this.factorCache.set(cacheKey, { value: result, timestamp: Date.now() });
				console.log(
					`✅ Factor ${factorName} for ${symbol}: ${result.toFixed(4)} (calculated in ${calculationTime}ms)`
				);
			} else {
				console.warn(
					`⚠️ Factor ${factorName} for ${symbol}: returned null/NaN (${calculationTime}ms)`
				);
			}

			return result;
		} catch (error) {
			const calculationTime = Date.now() - startTime;
			console.error(
				`❌ Error calculating factor ${factorName} for ${symbol} (${calculationTime}ms):`,
				{
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				}
			);
			return null;
		}
	}

	private async calculateMomentumComposite(
		symbol: string,
		marketData: MarketDataPoint,
		technicalData?: TechnicalDataPoint
	): Promise<number | null> {
		console.log(`Calculating momentum composite for ${symbol}`);

		const factors: { name: string; value: number | null; weight: number }[] = [
			{
				name: "1-month momentum",
				value: await this.technicalFactors.calculateMomentum(symbol, 21),
				weight: 0.25,
			},
			{
				name: "3-month momentum",
				value: await this.technicalFactors.calculateMomentum(symbol, 63),
				weight: 0.3,
			},
			{
				name: "6-month momentum",
				value: await this.technicalFactors.calculateMomentum(symbol, 126),
				weight: 0.25,
			},
			{ name: "RSI", value: this.technicalFactors.calculateRSIScore(technicalData?.rsi), weight: 0.1 },
			{ name: "MACD", value: this.technicalFactors.calculateMACDScore(technicalData?.macd), weight: 0.1 },
		];

		let totalWeightedScore = 0;
		let totalWeight = 0;

		for (const factor of factors) {
			if (factor.value !== null && !isNaN(factor.value)) {
				totalWeightedScore += factor.value * factor.weight;
				totalWeight += factor.weight;
				console.log(
					`Momentum factor ${factor.name}: ${factor.value.toFixed(3)} (weight: ${factor.weight})`
				);
			} else {
				console.log(`Momentum factor ${factor.name}: No data available`);
			}
		}

		if (totalWeight === 0) {
			console.warn(`No valid momentum factors found for ${symbol}`);
			return null;
		}

		const momentumScore = totalWeightedScore / totalWeight;
		console.log(
			`Momentum composite score for ${symbol}: ${momentumScore.toFixed(3)} (based on ${totalWeight.toFixed(2)} total weight)`
		);

		return Math.max(0, Math.min(1, momentumScore));
	}

	private adjustWeightsForMarketCap(marketCap: number): {
		fundamentalMultiplier: number;
		technicalMultiplier: number;
	} {
		const MEGA_CAP = 200_000_000_000;
		const LARGE_CAP = 10_000_000_000;
		const MID_CAP = 2_000_000_000;

		if (marketCap >= MEGA_CAP) {
			return {
				fundamentalMultiplier: 1.2,
				technicalMultiplier: 0.85,
			};
		} else if (marketCap >= LARGE_CAP) {
			return {
				fundamentalMultiplier: 1.1,
				technicalMultiplier: 0.92,
			};
		} else if (marketCap >= MID_CAP) {
			return {
				fundamentalMultiplier: 1.0,
				technicalMultiplier: 1.0,
			};
		} else {
			return {
				fundamentalMultiplier: 0.9,
				technicalMultiplier: 1.1,
			};
		}
	}

	private async calculateMainComposite(
		symbol: string,
		marketData: MarketDataPoint,
		fundamentalData?: FundamentalDataPoint,
		technicalData?: TechnicalDataPoint,
		sentimentScore?: number,
		esgScore?: number,
		macroeconomicContext?: any,
		shortInterestData?: any,
		extendedMarketData?: any
	): Promise<number> {
		console.log(
			`🎯 Calculating MAIN composite score for ${symbol} with ALL required components`
		);

		let totalScore = 0;
		let totalWeight = 0;
		const factorContributions: string[] = [];

		const marketCap =
			marketData?.marketCap && marketData.marketCap > 1_000_000
				? marketData.marketCap
				: 5_000_000_000;
		const { fundamentalMultiplier, technicalMultiplier } =
			this.adjustWeightsForMarketCap(marketCap);

		const baseTechnicalWeight = 0.28;
		const baseFundamentalWeight = 0.28;
		const technicalWeight = baseTechnicalWeight * technicalMultiplier;
		const fundamentalWeight = baseFundamentalWeight * fundamentalMultiplier;

		const baseWeightsSum = technicalWeight + fundamentalWeight + 0.2 + 0.18 + 0.06;
		const normalizationFactor = 1.0 / baseWeightsSum;
		const adjustedTechnicalWeight = technicalWeight * normalizationFactor;
		const adjustedFundamentalWeight = fundamentalWeight * normalizationFactor;
		const adjustedMacroWeight = 0.2 * normalizationFactor;
		const adjustedSentimentWeight = 0.18 * normalizationFactor;
		const adjustedAlternativeWeight = 0.06 * normalizationFactor;

		console.log(
			`📊 PHASE 2 CALIBRATION: Adjusted weights for ${symbol} ($${(marketCap / 1e9).toFixed(1)}B market cap):`
		);
		console.log(
			`   Technical: ${(adjustedTechnicalWeight * 100).toFixed(1)}% (base 28.0%, multiplier ${technicalMultiplier.toFixed(2)})`
		);
		console.log(
			`   Fundamental: ${(adjustedFundamentalWeight * 100).toFixed(1)}% (base 28.0%, multiplier ${fundamentalMultiplier.toFixed(2)})`
		);

		const technicalScore = await this.technicalFactors.calculateTechnicalOverallScore(symbol);
		if (technicalScore !== null) {
			console.log(
				`Technical Analysis: ${technicalScore.toFixed(3)} (weight: ${(adjustedTechnicalWeight * 100).toFixed(1)}%) ⚡`
			);
			totalScore += technicalScore * adjustedTechnicalWeight;
			totalWeight += adjustedTechnicalWeight;
			factorContributions.push("technicalAnalysis", "technical_overall_score");
		} else {
			console.log("Technical Analysis: No data (fallback to neutral 0.5)");
			totalScore += 0.5 * adjustedTechnicalWeight;
			totalWeight += adjustedTechnicalWeight;
		}

		const fundamentalScore = this.fundamentalFactors.calculateQualityComposite(fundamentalData);
		if (fundamentalScore !== null) {
			console.log(
				`Fundamental Analysis: ${fundamentalScore.toFixed(3)} (weight: ${(adjustedFundamentalWeight * 100).toFixed(1)}%) 💎`
			);
			totalScore += fundamentalScore * adjustedFundamentalWeight;
			totalWeight += adjustedFundamentalWeight;
			factorContributions.push("fundamentalData", "quality_composite");
		} else {
			console.log("Fundamental Analysis: No data (fallback to neutral 0.5)");
			totalScore += 0.5 * adjustedFundamentalWeight;
			totalWeight += adjustedFundamentalWeight;
		}

		const macroScore = this.marketFactors.calculateMacroeconomicComposite(macroeconomicContext);
		if (macroScore !== null) {
			console.log(
				`🌍 Macroeconomic Analysis: ${macroScore.toFixed(3)} (weight: ${(adjustedMacroWeight * 100).toFixed(1)}%)`
			);
			totalScore += macroScore * adjustedMacroWeight;
			totalWeight += adjustedMacroWeight;
			factorContributions.push("macroeconomicAnalysis", "macroeconomic_composite");
		} else {
			console.log("🌍 Macroeconomic Analysis: No data (fallback to neutral 0.5)");
			totalScore += 0.5 * adjustedMacroWeight;
			totalWeight += adjustedMacroWeight;
		}

		if (sentimentScore !== undefined && sentimentScore !== null) {
			console.log(
				`📰 Sentiment Analysis: ${sentimentScore.toFixed(3)} (weight: ${(adjustedSentimentWeight * 100).toFixed(1)}%)`
			);
			totalScore += sentimentScore * adjustedSentimentWeight;
			totalWeight += adjustedSentimentWeight;
			factorContributions.push("sentimentAnalysis");
		} else {
			console.log("📰 Sentiment Analysis: No data (fallback to neutral 0.5)");
			totalScore += 0.5 * adjustedSentimentWeight;
			totalWeight += adjustedSentimentWeight;
		}

		let alternativeScore = 0.5;
		let alternativeWeight = 0;

		if (esgScore !== undefined && esgScore !== null) {
			alternativeScore = esgScore;
			alternativeWeight += 0.4;
		}

		const shortInterestScore = shortInterestData?.score;
		if (shortInterestScore !== undefined && shortInterestScore !== null) {
			alternativeScore = (alternativeScore * alternativeWeight + shortInterestScore * 0.3) / (alternativeWeight + 0.3);
			alternativeWeight += 0.3;
		}

		const liquidityScore = extendedMarketData?.liquidityMetrics?.liquidityScore;
		if (liquidityScore !== undefined && liquidityScore !== null) {
			const normalizedLiquidity = liquidityScore / 10;
			alternativeScore = (alternativeScore * alternativeWeight + normalizedLiquidity * 0.3) / (alternativeWeight + 0.3);
			alternativeWeight += 0.3;
		}

		if (alternativeWeight > 0) {
			console.log(
				`🔬 Alternative Data: ${alternativeScore.toFixed(3)} (weight: ${(adjustedAlternativeWeight * 100).toFixed(1)}%)`
			);
		} else {
			console.log("🔬 Alternative Data: No data (fallback to neutral 0.5)");
		}
		totalScore += alternativeScore * adjustedAlternativeWeight;
		totalWeight += adjustedAlternativeWeight;

		const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0.5;
		console.log(`🎯 Final Composite Score for ${symbol}: ${finalScore.toFixed(3)}`);

		return Math.max(0, Math.min(1, finalScore));
	}

	requiresFundamentalData(factorName: string): boolean {
		const fundamentalFactors = [
			"pe_ratio",
			"pb_ratio",
			"ev_ebitda",
			"price_to_sales",
			"roe",
			"debt_equity",
			"current_ratio",
			"interest_coverage",
			"revenue_growth",
			"earnings_growth",
			"revenue_acceleration",
			"dividend_yield",
			"dividend_growth",
			"payout_ratio",
			"quality_composite",
			"value_composite",
			"composite",
		];

		return fundamentalFactors.includes(factorName);
	}

	requiresTechnicalData(factorName: string): boolean {
		const technicalFactors = [
			"rsi_14d",
			"macd_signal",
			"bollinger_position",
			"momentum_composite",
			"sma_alignment",
			"ema_trend",
			"macd_histogram",
			"bollinger_squeeze",
			"stochastic_signal",
			"williams_r",
			"roc_momentum",
			"momentum_convergence",
			"obv_trend",
			"vwap_position",
			"volume_confirmation",
			"atr_volatility",
			"volatility_breakout",
			"candlestick_patterns",
			"chart_patterns",
			"support_resistance",
			"technical_momentum_composite",
			"technical_trend_composite",
			"technical_overall_score",
		];

		return technicalFactors.includes(factorName);
	}

	getAvailableFactors(): string[] {
		return [
			"momentum_1m",
			"momentum_3m",
			"momentum_6m",
			"momentum_12m",
			"price_reversion_20d",
			"price_reversion_50d",
			"volume_reversion",
			"pe_ratio",
			"pb_ratio",
			"ev_ebitda",
			"price_to_sales",
			"roe",
			"debt_equity",
			"current_ratio",
			"interest_coverage",
			"revenue_growth",
			"earnings_growth",
			"revenue_acceleration",
			"rsi_14d",
			"macd_signal",
			"bollinger_position",
			"sma_alignment",
			"ema_trend",
			"macd_histogram",
			"bollinger_squeeze",
			"stochastic_signal",
			"williams_r",
			"roc_momentum",
			"momentum_convergence",
			"obv_trend",
			"vwap_position",
			"volume_confirmation",
			"atr_volatility",
			"volatility_breakout",
			"candlestick_patterns",
			"chart_patterns",
			"support_resistance",
			"vwap_deviation_score",
			"vwap_trading_signals",
			"macroeconomic_sector_impact",
			"macroeconomic_composite",
			"volatility_30d",
			"volatility_ratio",
			"beta",
			"dividend_yield",
			"dividend_growth",
			"payout_ratio",
			"composite",
			"quality_composite",
			"momentum_composite",
			"value_composite",
			"technical_momentum_composite",
			"technical_trend_composite",
			"technical_overall_score",
		];
	}

	clearCache(symbol?: string) {
		if (symbol) {
			this.factorCache.forEach((_, key) => {
				if (key.includes(symbol)) {
					this.factorCache.delete(key);
				}
			});
			this.historicalDataCache.delete(symbol);
		} else {
			this.factorCache.clear();
			this.historicalDataCache.clear();
		}
	}

	getCacheStats() {
		return {
			factorCacheSize: this.factorCache.size,
			historicalCacheSize: this.historicalDataCache.size,
			totalMemoryUsage: this.estimateMemoryUsage(),
		};
	}

	private estimateMemoryUsage(): string {
		let totalSize = 0;

		totalSize += this.factorCache.size * 100;

		this.historicalDataCache.forEach(data => {
			totalSize += data.length * 50;
		});

		if (totalSize < 1024) return `${totalSize}B`;
		if (totalSize < 1024 * 1024) return `${Math.round(totalSize / 1024)}KB`;
		return `${Math.round(totalSize / (1024 * 1024))}MB`;
	}
}
