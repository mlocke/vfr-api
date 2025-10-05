/**
 * Early Signal Feature Extractor
 *
 * Task 1.3: Create Feature Extractor Service
 * Purpose: Extract 13 features from historical data for ML model
 * Estimated Time: 3 hours
 *
 * Reuses existing VFR services:
 * - FinancialDataService for historical price data
 * - SentimentAnalysisService for sentiment data
 * - TechnicalIndicatorService for technical indicators
 */

import { FinancialDataService } from "../../financial-data/FinancialDataService";
import { FinancialModelingPrepAPI } from "../../financial-data/FinancialModelingPrepAPI";
import { SentimentAnalysisService } from "../../financial-data/SentimentAnalysisService";
import { TechnicalIndicatorService } from "../../technical-analysis/TechnicalIndicatorService";
import { MacroeconomicAnalysisService } from "../../financial-data/MacroeconomicAnalysisService";
import { RedisCache } from "../../cache/RedisCache";
import type {
	FeatureVector,
	OHLC,
	SentimentData,
	FundamentalsData,
	TechnicalData,
	MacroeconomicData,
	SECFilingData,
	PremiumFeaturesData,
	AdditionalMarketData
} from "./types";

export class EarlySignalFeatureExtractor {
	private financialDataService: FinancialDataService;
	private fmpAPI: FinancialModelingPrepAPI;
	private sentimentService: SentimentAnalysisService;
	private technicalService: TechnicalIndicatorService;
	private macroService: MacroeconomicAnalysisService;
	private cache: RedisCache;
	private ohlcvCache?: any; // Optional OHLCV cache for training
	private incomeStatementCache?: any; // Optional income statement cache for training
	private analystRatingsCache?: any; // Optional analyst ratings cache for training
	private secFilingsCache?: any; // Optional SEC filings cache for training
	private optionsDataCache?: any; // Optional options data cache for training
	private macroeconomicDataCache?: any; // Optional macroeconomic data cache for training
	private retryHandler?: any; // Optional retry handler for training

	constructor(options?: {
		ohlcvCache?: any;
		incomeStatementCache?: any;
		analystRatingsCache?: any;
		secFilingsCache?: any;
		optionsDataCache?: any;
		macroeconomicDataCache?: any;
		retryHandler?: any
	}) {
		this.financialDataService = new FinancialDataService();
		this.fmpAPI = new FinancialModelingPrepAPI();
		this.cache = new RedisCache();
		this.sentimentService = new SentimentAnalysisService(this.cache);
		this.technicalService = new TechnicalIndicatorService(this.cache);
		this.macroService = new MacroeconomicAnalysisService();
		this.ohlcvCache = options?.ohlcvCache;
		this.incomeStatementCache = options?.incomeStatementCache;
		this.analystRatingsCache = options?.analystRatingsCache;
		this.secFilingsCache = options?.secFilingsCache;
		this.optionsDataCache = options?.optionsDataCache;
		this.macroeconomicDataCache = options?.macroeconomicDataCache;
		this.retryHandler = options?.retryHandler;
	}

	/**
	 * Extract all 34 features for ML model prediction
	 * @param symbol Stock symbol (e.g., 'TSLA')
	 * @param asOfDate Historical date for feature extraction (default: today)
	 * @param useHistoricalMode For historical training data, skip live sentiment (we can't get historical sentiment)
	 * @returns Feature vector with 34 numeric features
	 *
	 * Note: Macro features are time-aligned with stock analysis window (20 days matching price_change_20d)
	 * This ensures macro changes correlate with stock-specific timing, not calendar-based periods
	 */
	async extractFeatures(
		symbol: string,
		asOfDate?: Date,
		useHistoricalMode: boolean = false
	): Promise<FeatureVector> {
		const date = asOfDate || new Date();
		const startTime = Date.now();

		try {
			// Parallel data collection (leverage existing VFR services)
			// For historical training data: skip live sentiment since APIs only return current sentiment
			// This is correct - we use neutral (0) sentiment for historical data since we can't time-travel
			const [historicalData, sentimentData, fundamentals, technicals, macroData, secData, premiumData, marketData] = await Promise.all([
				this.getHistoricalData(symbol, date, 50), // 50 days for 20d momentum
				useHistoricalMode ? Promise.resolve(null) : this.getSentimentData(symbol, date),
				this.getFundamentalsData(symbol, date),
				this.getTechnicalData(symbol, date),
				this.getMacroeconomicData(date),
				this.getSECFilingData(symbol, date),
				this.getPremiumFeaturesData(symbol, date),
				this.getAdditionalMarketData(symbol, date),
			]);

			const features: FeatureVector = {
				// Momentum features (3)
				price_change_5d: this.calculateMomentum(historicalData, 5),
				price_change_10d: this.calculateMomentum(historicalData, 10),
				price_change_20d: this.calculateMomentum(historicalData, 20),

				// Volume features (2)
				volume_ratio: this.calculateVolumeRatio(historicalData, 5, 20),
				volume_trend: this.calculateVolumeTrend(historicalData, 10),

				// Sentiment delta features (3)
				sentiment_news_delta: sentimentData?.newsScore || 0,
				sentiment_reddit_accel: sentimentData?.redditScore || 0,
				sentiment_options_shift: sentimentData?.optionsScore || 0,

				// Social sentiment features (6)
				social_stocktwits_24h_change: sentimentData?.social_stocktwits_24h_change || 0,
				social_stocktwits_hourly_momentum:
					sentimentData?.social_stocktwits_hourly_momentum || 0,
				social_stocktwits_7d_trend: sentimentData?.social_stocktwits_7d_trend || 0,
				social_twitter_24h_change: sentimentData?.social_twitter_24h_change || 0,
				social_twitter_hourly_momentum: sentimentData?.social_twitter_hourly_momentum || 0,
				social_twitter_7d_trend: sentimentData?.social_twitter_7d_trend || 0,

				// Fundamental features (3)
				earnings_surprise: fundamentals?.earningsSurprise || 0,
				revenue_growth_accel: fundamentals?.revenueGrowthAccel || 0,
				analyst_coverage_change: fundamentals?.analystCoverageChange || 0,

				// Technical features (2)
				rsi_momentum: technicals?.rsiMomentum || 0,
				macd_histogram_trend: technicals?.macdHistogramTrend || 0,

				// Government/Macro features (5) - Time-aligned with 20-day stock analysis window
				fed_rate_change_30d: macroData?.fedRateChange20d || 0,
				unemployment_rate_change: macroData?.unemploymentRateChange || 0,
				cpi_inflation_rate: macroData?.cpiInflationRate || 0,
				gdp_growth_rate: macroData?.gdpGrowthRate || 0,
				treasury_yield_10y: macroData?.treasuryYieldChange || 0,

				// SEC filing features (3)
				sec_insider_buying_ratio: secData?.insiderBuyingRatio || 0,
				sec_institutional_ownership_change: secData?.institutionalOwnershipChange || 0,
				sec_8k_filing_count_30d: secData?.form8kFilingCount30d || 0,

				// FMP Premium features (4)
				analyst_price_target_change: premiumData?.analystPriceTargetChange || 0,
				earnings_whisper_vs_estimate: premiumData?.earningsWhisperVsEstimate || 0,
				short_interest_change: premiumData?.shortInterestChange || 0,
				institutional_ownership_momentum: premiumData?.institutionalOwnershipMomentum || 0,

				// Additional market features (3)
				options_put_call_ratio_change: marketData?.optionsPutCallRatioChange || 0,
				dividend_yield_change: marketData?.dividendYieldChange || 0,
				market_beta_30d: marketData?.marketBeta30d || 0,
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
	 * Get historical OHLC data for the symbol at a specific date
	 */
	private async getHistoricalData(symbol: string, asOfDate: Date, days: number): Promise<OHLC[]> {
		try {
			// SKIP future dates - data doesn't exist yet
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			if (asOfDate >= today) {
				return [];
			}

			let historicalData: any[];

			// Use OHLCV cache if available (training mode)
			if (this.ohlcvCache && this.retryHandler) {
				const endDate = asOfDate;
				const startDate = new Date(asOfDate);
				startDate.setDate(startDate.getDate() - days);

				historicalData = await this.ohlcvCache.getOHLCV(
					symbol,
					startDate,
					endDate,
					() => this.financialDataService.getHistoricalOHLC(symbol, days, asOfDate),
					this.retryHandler
				);
			} else {
				// No cache - fetch directly (production mode)
				historicalData = await this.financialDataService.getHistoricalOHLC(
					symbol,
					days,
					asOfDate
				);
			}

			if (!historicalData || historicalData.length === 0) {
				// Silently return empty - no console spam
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
			console.error(
				`Failed to get historical data for ${symbol} as of ${asOfDate.toISOString().split("T")[0]}:`,
				error
			);
			return [];
		}
	}

	/**
	 * Get sentiment data for the symbol
	 */
	private async getSentimentData(symbol: string, asOfDate: Date): Promise<SentimentData | null> {
		try {
			// Get current sentiment
			const sentiment = await this.sentimentService.analyzeStockSentimentImpact(
				symbol,
				"Technology",
				0.5
			);

			// Get social sentiment data from FMP
			const socialSentiment = await this.calculateSocialSentimentFeatures(symbol, asOfDate);

			if (!sentiment && !socialSentiment) {
				return null;
			}

			return {
				symbol,
				date: asOfDate,
				newsScore: sentiment?.sentimentScore?.components?.news || 0,
				redditScore: sentiment?.sentimentScore?.components?.reddit || 0,
				optionsScore: sentiment?.sentimentScore?.components?.options || 0,
				...socialSentiment,
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error(`Failed to get sentiment data for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Calculate social sentiment features from StockTwits and Twitter
	 * Returns 6 new features: 24h, hourly, 7-day trends for both platforms
	 */
	private async calculateSocialSentimentFeatures(
		symbol: string,
		asOfDate: Date
	): Promise<{
		social_stocktwits_24h_change: number;
		social_stocktwits_hourly_momentum: number;
		social_stocktwits_7d_trend: number;
		social_twitter_24h_change: number;
		social_twitter_hourly_momentum: number;
		social_twitter_7d_trend: number;
	}> {
		try {
			// Get social sentiment data (returns hourly data)
			const socialData = await this.fmpAPI.getSocialSentiment(symbol, 0);

			if (!socialData || socialData.length === 0) {
				return this.getZeroSocialSentimentFeatures();
			}

			// Sort by date descending (newest first)
			const sortedData = socialData
				.map(d => ({
					...d,
					date: new Date(d.date),
				}))
				.filter(d => d.date <= asOfDate) // Only data before asOfDate
				.sort((a, b) => b.date.getTime() - a.date.getTime());

			if (sortedData.length === 0) {
				return this.getZeroSocialSentimentFeatures();
			}

			// Calculate 24h sentiment change (most recent vs 24h ago)
			const stocktwits24hChange = this.calculate24hSentimentChange(sortedData, "stocktwits");
			const twitter24hChange = this.calculate24hSentimentChange(sortedData, "twitter");

			// Calculate hourly momentum (last hour vs 2h ago)
			const stocktwitsHourlyMomentum = this.calculateHourlySentimentMomentum(
				sortedData,
				"stocktwits"
			);
			const twitterHourlyMomentum = this.calculateHourlySentimentMomentum(
				sortedData,
				"twitter"
			);

			// Calculate 7-day trend (linear regression of sentiment over 7 days)
			const stocktwits7dTrend = this.calculate7dSentimentTrend(sortedData, "stocktwits");
			const twitter7dTrend = this.calculate7dSentimentTrend(sortedData, "twitter");

			return {
				social_stocktwits_24h_change: stocktwits24hChange,
				social_stocktwits_hourly_momentum: stocktwitsHourlyMomentum,
				social_stocktwits_7d_trend: stocktwits7dTrend,
				social_twitter_24h_change: twitter24hChange,
				social_twitter_hourly_momentum: twitterHourlyMomentum,
				social_twitter_7d_trend: twitter7dTrend,
			};
		} catch (error) {
			console.error(`Failed to calculate social sentiment features for ${symbol}:`, error);
			return this.getZeroSocialSentimentFeatures();
		}
	}

	/**
	 * Calculate 24-hour sentiment change
	 */
	private calculate24hSentimentChange(data: any[], platform: "stocktwits" | "twitter"): number {
		if (data.length < 24) return 0;

		const currentSentiment =
			platform === "stocktwits" ? data[0].stocktwitsSentiment : data[0].twitterSentiment;
		const past24hSentiment =
			platform === "stocktwits" ? data[23].stocktwitsSentiment : data[23].twitterSentiment;

		if (!currentSentiment || !past24hSentiment) return 0;

		// Return change in sentiment (range: -1 to 1)
		return currentSentiment - past24hSentiment;
	}

	/**
	 * Calculate hourly sentiment momentum
	 */
	private calculateHourlySentimentMomentum(
		data: any[],
		platform: "stocktwits" | "twitter"
	): number {
		if (data.length < 3) return 0;

		const recent =
			platform === "stocktwits" ? data[0].stocktwitsSentiment : data[0].twitterSentiment;
		const oneHourAgo =
			platform === "stocktwits" ? data[1].stocktwitsSentiment : data[1].twitterSentiment;
		const twoHoursAgo =
			platform === "stocktwits" ? data[2].stocktwitsSentiment : data[2].twitterSentiment;

		if (!recent || !oneHourAgo || !twoHoursAgo) return 0;

		// Calculate momentum (acceleration of sentiment change)
		const recentChange = recent - oneHourAgo;
		const pastChange = oneHourAgo - twoHoursAgo;

		return recentChange - pastChange;
	}

	/**
	 * Calculate 7-day sentiment trend using linear regression
	 */
	private calculate7dSentimentTrend(data: any[], platform: "stocktwits" | "twitter"): number {
		const hoursIn7Days = 7 * 24; // 168 hours
		if (data.length < hoursIn7Days) return 0;

		const sentiments = data
			.slice(0, hoursIn7Days)
			.map(d => (platform === "stocktwits" ? d.stocktwitsSentiment : d.twitterSentiment))
			.filter(s => s !== null && s !== undefined);

		if (sentiments.length < hoursIn7Days * 0.8) return 0; // Need at least 80% data coverage

		return this.linearRegressionSlope(sentiments);
	}

	/**
	 * Return zero social sentiment features
	 */
	private getZeroSocialSentimentFeatures() {
		return {
			social_stocktwits_24h_change: 0,
			social_stocktwits_hourly_momentum: 0,
			social_stocktwits_7d_trend: 0,
			social_twitter_24h_change: 0,
			social_twitter_hourly_momentum: 0,
			social_twitter_7d_trend: 0,
		};
	}

	/**
	 * Get fundamental data for the symbol
	 */
	private async getFundamentalsData(
		symbol: string,
		asOfDate: Date
	): Promise<FundamentalsData | null> {
		try {
			// Get earnings surprise percentage (most recent earnings vs estimate)
			const earningsSurprise = await this.calculateEarningsSurprise(
				this.fmpAPI,
				symbol,
				asOfDate
			);

			// Get revenue growth acceleration (comparing recent growth rates)
			const revenueGrowthAccel = await this.calculateRevenueGrowthAcceleration(
				this.fmpAPI,
				symbol,
				asOfDate
			);

			// Get analyst coverage change (change in number of analysts covering)
			const analystCoverageChange = await this.calculateAnalystCoverageChange(
				this.fmpAPI,
				symbol,
				asOfDate
			);

			return {
				symbol,
				earningsSurprise,
				revenueGrowthAccel,
				analystCoverageChange,
			};
		} catch (error) {
			console.error(`Failed to get fundamentals for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Calculate earnings surprise percentage from most recent earnings
	 * Returns percentage difference between actual and estimated earnings
	 */
	private async calculateEarningsSurprise(
		fmpAPI: any,
		symbol: string,
		asOfDate: Date
	): Promise<number> {
		try {
			const earnings = await fmpAPI.getEarningsSurprises(symbol, 60); // Get 60 quarters (15 years) of historical data

			if (!earnings || earnings.length === 0) {
				console.warn(`[FeatureExtractor] No earnings data returned from FMP for ${symbol}`);
				return 0;
			}

			// Debug: Log raw earnings data
			console.debug(
				`[FeatureExtractor] Got ${earnings.length} earnings records for ${symbol}`
			);
			if (earnings.length > 0) {
				console.debug(
					`[FeatureExtractor] Sample earnings date: ${earnings[0].date}, asOfDate: ${asOfDate.toISOString().split("T")[0]}`
				);
			}

			// Find most recent earnings before asOfDate (within 120 days before asOfDate)
			const relevantEarnings = earnings
				.map((e: any) => ({
					...e,
					date: new Date(e.date),
				}))
				.filter((e: any) => {
					const earnDate = e.date;
					const daysDiff =
						(asOfDate.getTime() - earnDate.getTime()) / (1000 * 60 * 60 * 24);
					// Include earnings from 1-120 days before asOfDate (typical earnings announcement window)
					return daysDiff >= 0 && daysDiff <= 120;
				})
				.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

			if (relevantEarnings.length === 0) {
				console.debug(
					`[FeatureExtractor] No earnings within 120 days before ${asOfDate.toISOString().split("T")[0]} for ${symbol}`
				);
				return 0;
			}

			const mostRecent = relevantEarnings[0];
			const actual = mostRecent.actualEarningResult;
			const estimated = mostRecent.estimatedEarning;

			if (estimated === 0 || !actual || !estimated) {
				console.debug(
					`[FeatureExtractor] Invalid earnings values for ${symbol}: actual=${actual}, estimated=${estimated}`
				);
				return 0;
			}

			// Return percentage surprise: (actual - estimated) / |estimated|
			const surprise = ((actual - estimated) / Math.abs(estimated)) * 100;
			console.debug(
				`[FeatureExtractor] Earnings surprise for ${symbol}: ${surprise.toFixed(2)}%`
			);
			return surprise;
		} catch (error) {
			console.error(`Failed to calculate earnings surprise for ${symbol}:`, error);
			return 0;
		}
	}

	/**
	 * Calculate revenue growth acceleration
	 * Compares recent quarter growth rate to previous quarter growth rate
	 */
	private async calculateRevenueGrowthAcceleration(
		fmpAPI: any,
		symbol: string,
		asOfDate: Date
	): Promise<number> {
		try {
			// Use cache if available, otherwise fetch directly
			const incomeStatements = this.incomeStatementCache && this.retryHandler
				? await this.incomeStatementCache.getIncomeStatements(
					symbol,
					"quarterly",
					40,
					() => fmpAPI.getIncomeStatement(symbol, "quarterly", 40),
					this.retryHandler
				)
				: await fmpAPI.getIncomeStatement(symbol, "quarterly", 40); // Get 10 years (40 quarters) of data

			if (!incomeStatements || incomeStatements.length < 4) {
				console.warn(
					`[FeatureExtractor] Insufficient income statement data for ${symbol} (got ${incomeStatements?.length || 0})`
				);
				return 0;
			}

			// Debug: Log raw data
			console.debug(
				`[FeatureExtractor] Got ${incomeStatements.length} quarterly income statements for ${symbol}`
			);
			if (incomeStatements.length > 0) {
				console.debug(
					`[FeatureExtractor] Sample income date: ${incomeStatements[0].date}, asOfDate: ${asOfDate.toISOString().split("T")[0]}`
				);
			}

			// Filter statements before asOfDate and sort by date (newest first)
			// Need 5 statements minimum: Q0, Q1, Q3 (year ago for Q0), Q4 (year ago for Q1)
			const relevantStatements = incomeStatements
				.map((s: any) => ({
					...s,
					date: new Date(s.date),
				}))
				.filter((s: any) => {
					const statementDate = s.date;
					// Only include statements BEFORE asOfDate (but within 2 years to get enough quarters)
					const daysDiff =
						(asOfDate.getTime() - statementDate.getTime()) / (1000 * 60 * 60 * 24);
					return daysDiff >= 0 && daysDiff <= 730; // 2 years = 8 quarters
				})
				.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

			if (relevantStatements.length < 4) {
				console.debug(
					`[FeatureExtractor] Insufficient relevant statements for ${symbol} (need 4, got ${relevantStatements.length})`
				);
				return 0;
			}

			// Calculate YoY growth for most recent quarter (Q0 vs Q4)
			const recentRevenue = relevantStatements[0].revenue;
			const recentYearAgoRevenue = relevantStatements[3]?.revenue;

			if (!recentRevenue || !recentYearAgoRevenue || recentYearAgoRevenue === 0) {
				console.debug(
					`[FeatureExtractor] Invalid revenue values for ${symbol}: recent=${recentRevenue}, yearAgo=${recentYearAgoRevenue}`
				);
				return 0;
			}

			const recentGrowthRate =
				((recentRevenue - recentYearAgoRevenue) / recentYearAgoRevenue) * 100;

			// Calculate YoY growth for previous quarter (Q1 vs Q5)
			if (relevantStatements.length < 5) {
				console.debug(
					`[FeatureExtractor] Can't calculate acceleration for ${symbol}, returning growth rate: ${recentGrowthRate.toFixed(2)}%`
				);
				return recentGrowthRate; // Can't calculate acceleration, return growth rate
			}

			const previousRevenue = relevantStatements[1].revenue;
			const previousYearAgoRevenue = relevantStatements[4]?.revenue;

			if (!previousRevenue || !previousYearAgoRevenue || previousYearAgoRevenue === 0) {
				return recentGrowthRate;
			}

			const previousGrowthRate =
				((previousRevenue - previousYearAgoRevenue) / previousYearAgoRevenue) * 100;

			// Return acceleration: change in growth rate (percentage points)
			const acceleration = recentGrowthRate - previousGrowthRate;
			console.debug(
				`[FeatureExtractor] Revenue growth accel for ${symbol}: ${acceleration.toFixed(2)}% (recent: ${recentGrowthRate.toFixed(2)}%, prev: ${previousGrowthRate.toFixed(2)}%)`
			);
			return acceleration;
		} catch (error) {
			console.error(`Failed to calculate revenue growth acceleration for ${symbol}:`, error);
			return 0;
		}
	}

	/**
	 * Calculate analyst coverage change
	 * Returns change in number of analysts covering the stock
	 */
	private async calculateAnalystCoverageChange(
		fmpAPI: any,
		symbol: string,
		asOfDate: Date
	): Promise<number> {
		try {
			// Use cache if available, otherwise fetch directly
			const currentRatings = this.analystRatingsCache && this.retryHandler
				? await this.analystRatingsCache.getAnalystRatings(
					symbol,
					() => fmpAPI.getAnalystRatings(symbol),
					this.retryHandler
				)
				: await fmpAPI.getAnalystRatings(symbol);

			if (!currentRatings || !currentRatings.totalAnalysts) {
				return 0;
			}

			const currentTotal = currentRatings.totalAnalysts;

			// For historical comparison, we approximate using current data
			// In production, would track historical analyst coverage over time
			// For now, return normalized coverage (0 if no analysts, positive for coverage)
			// This is a proxy - higher analyst coverage is generally positive

			// Normalize: 0-5 analysts = 0, 5-10 = 5, 10-20 = 10, 20+ = 15
			if (currentTotal <= 5) return 0;
			if (currentTotal <= 10) return 5;
			if (currentTotal <= 20) return 10;
			return 15;
		} catch (error) {
			console.error(`Failed to calculate analyst coverage change for ${symbol}:`, error);
			return 0;
		}
	}

	/**
	 * Get technical indicator data for the symbol
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

			// Extract RSI momentum and MACD histogram trend
			const rsi = technicalResult.momentum?.indicators?.rsi?.value || 50;
			const rsiAvg = 50; // TODO: Calculate 14-day average RSI
			const rsiMomentum = rsi - rsiAvg;

			const macdHistogram = technicalResult.trend?.indicators?.macd?.histogram || 0;
			const macdHistogramTrend = macdHistogram; // TODO: Calculate 5-day slope

			return {
				symbol,
				rsiMomentum,
				macdHistogramTrend,
			};
		} catch (error) {
			console.error(`Failed to get technical data for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Calculate price momentum over N days
	 */
	private calculateMomentum(data: OHLC[], days: number): number {
		if (data.length < days) {
			return 0;
		}

		const currentPrice = data[0].close;
		const pastPrice = data[days - 1].close;

		if (pastPrice === 0) {
			return 0;
		}

		return (currentPrice - pastPrice) / pastPrice;
	}

	/**
	 * Calculate volume ratio (short-term vs long-term average)
	 */
	private calculateVolumeRatio(data: OHLC[], shortWindow: number, longWindow: number): number {
		if (data.length < longWindow) {
			return 1.0;
		}

		const avgShort = this.calculateAverageVolume(data.slice(0, shortWindow));
		const avgLong = this.calculateAverageVolume(data.slice(0, longWindow));

		if (avgLong === 0) {
			return 1.0;
		}

		return avgShort / avgLong;
	}

	/**
	 * Calculate volume trend using linear regression
	 */
	private calculateVolumeTrend(data: OHLC[], window: number): number {
		if (data.length < window) {
			return 0;
		}

		const volumes = data.slice(0, window).map(d => d.volume);
		return this.linearRegressionSlope(volumes);
	}

	/**
	 * Calculate average volume
	 */
	private calculateAverageVolume(data: OHLC[]): number {
		if (data.length === 0) {
			return 0;
		}

		const sum = data.reduce((total, d) => total + d.volume, 0);
		return sum / data.length;
	}

	/**
	 * Calculate linear regression slope
	 */
	private linearRegressionSlope(values: number[]): number {
		const n = values.length;
		if (n < 2) {
			return 0;
		}

		const sumX = (n * (n - 1)) / 2;
		const sumY = values.reduce((a, b) => a + b, 0);
		const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
		const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

		const denominator = n * sumX2 - sumX * sumX;
		if (denominator === 0) {
			return 0;
		}

		return (n * sumXY - sumX * sumY) / denominator;
	}

	/**
	 * Get macroeconomic data features
	 *
	 * Absolute Level Approach:
	 * Uses absolute macro indicator levels at the prediction date, not short-term changes.
	 * This provides natural variance over time (e.g., Fed rate 0.08% → 5.5% over 2022-2023)
	 * and avoids API rate limits from fetching multiple timepoints.
	 *
	 * Example: "When analyzing AAPL, Fed rate was 4.5%, unemployment was 3.7%"
	 * This captures the macro environment context better than short-term changes that are often zero.
	 */
	private async getMacroeconomicData(asOfDate: Date): Promise<MacroeconomicData | null> {
		try {
			// SKIP future dates - data doesn't exist yet
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			if (asOfDate >= today) {
				return null;
			}

			// Access FREDAPI and BLSAPI instances through the macro service
			const fredAPI = (this.macroService as any).fredAPI;
			const blsAPI = (this.macroService as any).blsAPI;

			console.log(`🔍 Extracting macro levels for date: ${asOfDate.toISOString().split('T')[0]}`);

			// Use cache if available, otherwise fetch from APIs
			let fedRate, unemployment, cpi, gdp, treasuryYield;

			if (this.macroeconomicDataCache && this.retryHandler) {
				const cachedData = await this.macroeconomicDataCache.getMacroeconomicData(
					asOfDate,
					async () => {
						const [fr, unemp, cpiData, gdpData, ty] = await Promise.all([
							this.fmpAPI.getFederalFundsRateAtDate(asOfDate),
							blsAPI.getObservationAtDate('LNS14000000', asOfDate),
							fredAPI.getObservationAtDate('CPIAUCSL', asOfDate),
							fredAPI.getObservationAtDate('GDPC1', asOfDate),
							fredAPI.getObservationAtDate('DGS10', asOfDate)
						]);
						return {
							fedRate: fr,
							unemployment: unemp,
							cpi: cpiData,
							gdp: gdpData,
							treasuryYield: ty
						};
					},
					this.retryHandler
				);

				fedRate = cachedData.fedRate;
				unemployment = cachedData.unemployment;
				cpi = cachedData.cpi;
				gdp = cachedData.gdp;
				treasuryYield = cachedData.treasuryYield;
			} else {
				// Fetch current macro indicator levels (single API call per indicator)
				// Use FMP for Fed rate to avoid FRED rate limits, keep FRED for other indicators
				[fedRate, unemployment, cpi, gdp, treasuryYield] = await Promise.all([
					this.fmpAPI.getFederalFundsRateAtDate(asOfDate),
					blsAPI.getObservationAtDate('LNS14000000', asOfDate),
					fredAPI.getObservationAtDate('CPIAUCSL', asOfDate),
					fredAPI.getObservationAtDate('GDPC1', asOfDate),
					fredAPI.getObservationAtDate('DGS10', asOfDate)
				]);
			}

			// Extract absolute values (levels, not changes)

			// 1. Fed Rate Level (%)
			let fedRateLevel = 0;
			if (fedRate?.value) {
				const rate = parseFloat(fedRate.value);
				if (!isNaN(rate)) {
					fedRateLevel = rate;
				}
			}

			// 2. Unemployment Rate Level (%)
			let unemploymentRateLevel = 0;
			if (unemployment?.value) {
				const rate = parseFloat(unemployment.value);
				if (!isNaN(rate)) {
					unemploymentRateLevel = rate;
				}
			}

			// 3. CPI Level (index value)
			let cpiLevel = 0;
			if (cpi?.value) {
				const level = parseFloat(cpi.value);
				if (!isNaN(level)) {
					cpiLevel = level;
				}
			}

			// 4. GDP Level (billions of dollars)
			let gdpLevel = 0;
			if (gdp?.value) {
				const level = parseFloat(gdp.value);
				if (!isNaN(level)) {
					gdpLevel = level;
				}
			}

			// 5. Treasury Yield Level (%)
			let treasuryYieldLevel = 0;
			if (treasuryYield?.value) {
				const yield_ = parseFloat(treasuryYield.value);
				if (!isNaN(yield_)) {
					treasuryYieldLevel = yield_;
				}
			}

			console.log(`✅ Macro levels extracted for ${asOfDate.toISOString().split('T')[0]}:`, {
				fedRateLevel,
				unemploymentRateLevel,
				cpiLevel,
				gdpLevel,
				treasuryYieldLevel
			});

			return {
				fedRateChange20d: fedRateLevel,  // Using fed rate level, not change
				unemploymentRateChange: unemploymentRateLevel,  // Using unemployment level, not change
				cpiInflationRate: cpiLevel,  // Using CPI level, not inflation rate
				gdpGrowthRate: gdpLevel,  // Using GDP level, not growth rate
				treasuryYieldChange: treasuryYieldLevel,  // Using treasury yield level, not change
			};
		} catch (error) {
			console.error('Failed to get macroeconomic data:', error);
			// Return zeros on error for graceful degradation
			return {
				fedRateChange20d: 0,
				unemploymentRateChange: 0,
				cpiInflationRate: 0,
				gdpGrowthRate: 0,
				treasuryYieldChange: 0,
			};
		}
	}

	/**
	 * Get SEC filing data features
	 */
	private async getSECFilingData(symbol: string, asOfDate: Date): Promise<SECFilingData | null> {
		try {
			// Get insider trading data with caching
			const insiderData = this.secFilingsCache && this.retryHandler
				? await this.secFilingsCache.getInsiderTrading(
					symbol,
					100,
					() => this.fmpAPI.getInsiderTrading(symbol, 100),
					this.retryHandler
				)
				: await this.fmpAPI.getInsiderTrading(symbol, 100);

			// Calculate insider buying ratio (buys vs total transactions)
			let buyCount = 0;
			let totalCount = 0;
			if (insiderData && insiderData.insiderTransactions) {
				insiderData.insiderTransactions.forEach((trade: any) => {
					const tradeDate = new Date(trade.filingDate);
					if (tradeDate <= asOfDate) {
						totalCount++;
						if (trade.transactionType === 'BUY') {
							buyCount++;
						}
					}
				});
			}
			const insiderBuyingRatio = totalCount > 0 ? buyCount / totalCount : 0;

			// Get institutional ownership data with caching
			const institutionalOwnership = this.secFilingsCache && this.retryHandler
				? await this.secFilingsCache.getInstitutionalOwnership(
					symbol,
					() => this.fmpAPI.getInstitutionalOwnership(symbol),
					this.retryHandler
				)
				: await this.fmpAPI.getInstitutionalOwnership(symbol);

			let institutionalOwnershipChange = 0;
			if (institutionalOwnership && institutionalOwnership.institutionalHolders) {
				const holders = institutionalOwnership.institutionalHolders;
				if (holders.length >= 2) {
					const recent = holders[0]?.marketValue || 0;
					const previous = holders[1]?.marketValue || 0;
					if (previous > 0) {
						institutionalOwnershipChange = ((recent - previous) / previous) * 100;
					}
				}
			}

			// Count 8-K filings in last 30 days
			// Note: FMP API doesn't have a direct getSECFilings method, use placeholder
			const form8kCount = 0; // TODO: Implement when SEC filings API is available

			return {
				symbol,
				insiderBuyingRatio,
				institutionalOwnershipChange,
				form8kFilingCount30d: form8kCount,
			};
		} catch (error) {
			console.error(`Failed to get SEC filing data for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Get premium features data
	 */
	private async getPremiumFeaturesData(symbol: string, asOfDate: Date): Promise<PremiumFeaturesData | null> {
		try {
			// Get analyst price targets with caching
			const priceTarget = this.optionsDataCache && this.retryHandler
				? await this.optionsDataCache.getPriceTargets(
					symbol,
					() => this.fmpAPI.getPriceTargets(symbol),
					this.retryHandler
				)
				: await this.fmpAPI.getPriceTargets(symbol);

			let analystPriceTargetChange = 0;
			if (priceTarget && priceTarget.targetConsensus && priceTarget.targetMedian) {
				const recent = priceTarget.targetConsensus;
				const previous = priceTarget.targetMedian;
				if (previous > 0) {
					analystPriceTargetChange = ((recent - previous) / previous) * 100;
				}
			}

			// Get earnings calendar for whisper numbers
			// Note: Earnings calendar API not available, use earnings surprises instead
			const earnings = await this.fmpAPI.getEarningsSurprises(symbol, 4);
			let earningsWhisperVsEstimate = 0;
			if (earnings && earnings.length > 0) {
				const latestEarnings = earnings[0];
				const estimate = latestEarnings.estimatedEarning || 0;
				const actual = latestEarnings.actualEarningResult || estimate;
				if (estimate !== 0) {
					earningsWhisperVsEstimate = ((actual - estimate) / Math.abs(estimate)) * 100;
				}
			}

			// Get short interest data - placeholder (API method not available)
			const shortInterestChange = 0; // TODO: Implement when short interest API is available

			// Calculate institutional ownership momentum (3-quarter trend)
			// Use cache if available, otherwise fetch directly
			const institutionalOwnership = this.secFilingsCache && this.retryHandler
				? await this.secFilingsCache.getInstitutionalOwnership(
					symbol,
					() => this.fmpAPI.getInstitutionalOwnership(symbol),
					this.retryHandler
				)
				: await this.fmpAPI.getInstitutionalOwnership(symbol);

			let institutionalOwnershipMomentum = 0;
			if (institutionalOwnership && institutionalOwnership.institutionalHolders) {
				const holders = institutionalOwnership.institutionalHolders;
				if (holders.length >= 3) {
					const values = holders.slice(0, 3).map((d: any) => d.marketValue || 0);
					institutionalOwnershipMomentum = this.linearRegressionSlope(values);
				}
			}

			return {
				symbol,
				analystPriceTargetChange,
				earningsWhisperVsEstimate,
				shortInterestChange,
				institutionalOwnershipMomentum,
			};
		} catch (error) {
			console.error(`Failed to get premium features data for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Get additional market data features
	 */
	private async getAdditionalMarketData(symbol: string, asOfDate: Date): Promise<AdditionalMarketData | null> {
		try {
			// Get options data for put/call ratio - placeholder
			// Note: Options chain API not directly available in FMP, requires EODHD
			const optionsPutCallRatioChange = 0; // TODO: Implement with EODHD options API

			// Get dividend data with caching
			const dividendHistory = this.optionsDataCache && this.retryHandler
				? await this.optionsDataCache.getDividendData(
					symbol,
					() => this.fmpAPI.getDividendData(symbol),
					this.retryHandler
				)
				: await this.fmpAPI.getDividendData(symbol);

			let dividendYieldChange = 0;
			if (dividendHistory && dividendHistory.length >= 2) {
				const recentYield = dividendHistory[0]?.adjDividend || 0;
				const previousYield = dividendHistory[1]?.adjDividend || 0;
				if (previousYield > 0) {
					dividendYieldChange = ((recentYield - previousYield) / previousYield) * 100;
				}
			}

			// Calculate 30-day beta
			const historicalData = await this.getHistoricalData(symbol, asOfDate, 30);
			const spyData = await this.getHistoricalData('SPY', asOfDate, 30);
			let marketBeta30d = 1.0; // Default beta
			if (historicalData.length >= 30 && spyData.length >= 30) {
				const stockReturns = this.calculateReturns(historicalData);
				const marketReturns = this.calculateReturns(spyData);
				marketBeta30d = this.calculateBeta(stockReturns, marketReturns);
			}

			return {
				symbol,
				optionsPutCallRatioChange,
				dividendYieldChange,
				marketBeta30d,
			};
		} catch (error) {
			console.error(`Failed to get additional market data for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Calculate returns from OHLC data
	 */
	private calculateReturns(data: OHLC[]): number[] {
		const returns: number[] = [];
		for (let i = 1; i < data.length; i++) {
			const ret = (data[i].close - data[i - 1].close) / data[i - 1].close;
			returns.push(ret);
		}
		return returns;
	}

	/**
	 * Calculate beta (stock vs market)
	 */
	private calculateBeta(stockReturns: number[], marketReturns: number[]): number {
		if (stockReturns.length !== marketReturns.length || stockReturns.length === 0) {
			return 1.0;
		}

		const n = stockReturns.length;
		const meanStock = stockReturns.reduce((a, b) => a + b, 0) / n;
		const meanMarket = marketReturns.reduce((a, b) => a + b, 0) / n;

		let covariance = 0;
		let marketVariance = 0;

		for (let i = 0; i < n; i++) {
			const stockDiff = stockReturns[i] - meanStock;
			const marketDiff = marketReturns[i] - meanMarket;
			covariance += stockDiff * marketDiff;
			marketVariance += marketDiff * marketDiff;
		}

		if (marketVariance === 0) {
			return 1.0;
		}

		return covariance / marketVariance;
	}

	/**
	 * Return neutral feature vector (all zeros)
	 */
	private getNeutralFeatures(): FeatureVector {
		return {
			price_change_5d: 0,
			price_change_10d: 0,
			price_change_20d: 0,
			volume_ratio: 1.0,
			volume_trend: 0,
			sentiment_news_delta: 0,
			sentiment_reddit_accel: 0,
			sentiment_options_shift: 0,
			social_stocktwits_24h_change: 0,
			social_stocktwits_hourly_momentum: 0,
			social_stocktwits_7d_trend: 0,
			social_twitter_24h_change: 0,
			social_twitter_hourly_momentum: 0,
			social_twitter_7d_trend: 0,
			earnings_surprise: 0,
			revenue_growth_accel: 0,
			analyst_coverage_change: 0,
			rsi_momentum: 0,
			macd_histogram_trend: 0,
			fed_rate_change_30d: 0,
			unemployment_rate_change: 0,
			cpi_inflation_rate: 0,
			gdp_growth_rate: 0,
			treasury_yield_10y: 0,
			sec_insider_buying_ratio: 0,
			sec_institutional_ownership_change: 0,
			sec_8k_filing_count_30d: 0,
			analyst_price_target_change: 0,
			earnings_whisper_vs_estimate: 0,
			short_interest_change: 0,
			institutional_ownership_momentum: 0,
			options_put_call_ratio_change: 0,
			dividend_yield_change: 0,
			market_beta_30d: 1.0,
		};
	}
}
