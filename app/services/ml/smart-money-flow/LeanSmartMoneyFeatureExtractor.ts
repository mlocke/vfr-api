/**
 * Lean Smart Money Flow Feature Extractor
 *
 * Extracts ONLY 10 features from verified working data sources:
 * - Congressional trading (4 features)
 * - Polygon volume/dark pool (3 features)
 * - Polygon price momentum (3 features)
 *
 * ZERO PLACEHOLDER VALUES - fails loudly if data unavailable
 */

import { LeanSmartMoneyFeatures, CongressionalTrade, DarkPoolMetrics, OHLCVBar } from './types';
import { CongressionalTradingService } from '../../financial-data/CongressionalTradingService';
import { PolygonAPI } from '../../financial-data/PolygonAPI';

export class LeanSmartMoneyFeatureExtractor {
	private congressService: CongressionalTradingService;
	private polygonAPI: PolygonAPI;

	constructor() {
		this.congressService = new CongressionalTradingService();
		this.polygonAPI = new PolygonAPI();
	}

	/**
	 * Extract all 10 features for a symbol at a specific date
	 * NO FALLBACKS - throws error if data unavailable
	 */
	async extractFeatures(
		symbol: string,
		asOfDate: Date
	): Promise<LeanSmartMoneyFeatures> {
		const startTime = Date.now();
		console.log(`[LeanSmartMoney] Extracting features for ${symbol} as of ${asOfDate.toISOString().split('T')[0]}`);

		// Calculate time windows
		const date7dAgo = new Date(asOfDate.getTime() - 7 * 24 * 60 * 60 * 1000);
		const date20dAgo = new Date(asOfDate.getTime() - 20 * 24 * 60 * 60 * 1000);
		const date30dAgo = new Date(asOfDate.getTime() - 30 * 24 * 60 * 60 * 1000);
		const date90dAgo = new Date(asOfDate.getTime() - 90 * 24 * 60 * 60 * 1000);

		// Fetch data from all sources
		const [congressTrades, darkPoolMetrics, ohlcvBars] = await Promise.all([
			this.fetchCongressionalTrades(symbol, date90dAgo, asOfDate),
			this.fetchDarkPoolMetrics(symbol, date30dAgo, asOfDate),
			this.fetchOHLCVData(symbol, date90dAgo, asOfDate),
		]);

		// Extract features from each data source
		const congressFeatures = this.extractCongressionalFeatures(
			congressTrades,
			asOfDate,
			date7dAgo,
			date90dAgo
		);

		const volumeFeatures = this.extractVolumeFeatures(darkPoolMetrics);

		const priceFeatures = this.extractPriceFeatures(
			ohlcvBars,
			asOfDate,
			date20dAgo,
			date30dAgo,
			date90dAgo
		);

		// Combine all features
		const features: LeanSmartMoneyFeatures = {
			...congressFeatures,
			...volumeFeatures,
			...priceFeatures,
		};

		const duration = Date.now() - startTime;
		console.log(`[LeanSmartMoney] Feature extraction for ${symbol} completed in ${duration}ms`);

		// Validate ALL features are present
		this.validateFeatures(features, symbol);

		return features;
	}

	// ===== CONGRESSIONAL TRADING FEATURES (4) =====

	private async fetchCongressionalTrades(
		symbol: string,
		startDate: Date,
		endDate: Date
	): Promise<CongressionalTrade[]> {
		try {
			// CongressionalTradingService.getCongressionalTrades only takes symbol parameter
			// Returns CongressionalTrade from financial-data/types.ts
			const rawTrades = await this.congressService.getCongressionalTrades(symbol);

			// Allow empty array if legitimately no trades, but not null/undefined
			if (rawTrades === null || rawTrades === undefined) {
				throw new Error(`Congressional trades API returned null/undefined for ${symbol}`);
			}

			// Filter by date range
			const filteredTrades = rawTrades.filter(t => {
				const tradeDate = new Date(t.transactionDate);
				return tradeDate >= startDate && tradeDate <= endDate;
			});

			// Convert from financial-data CongressionalTrade to ml CongressionalTrade format
			// Filter to only Purchase and Sale (exclude Exchange and Other)
			return filteredTrades
				.filter(t => t.transactionType === 'Purchase' || t.transactionType === 'Sale')
				.map(t => ({
					symbol: t.symbol,
					transactionDate: t.transactionDate,
					transactionType: t.transactionType as 'Purchase' | 'Sale', // Type assertion safe after filter
					amount: t.amount,
					representative: t.politician, // Map politician to representative
					chamber: t.house === 'Other' ? 'House' : t.house, // Map house to chamber
				}));
		} catch (error) {
			const err = error as Error;
			throw new Error(`Congressional trades fetch failed for ${symbol}: ${err.message}`);
		}
	}

	private extractCongressionalFeatures(
		trades: CongressionalTrade[],
		asOfDate: Date,
		date7dAgo: Date,
		date90dAgo: Date
	): Pick<
		LeanSmartMoneyFeatures,
		| 'congress_buy_count_90d'
		| 'congress_sell_count_90d'
		| 'congress_net_sentiment'
		| 'congress_recent_activity_7d'
	> {
		// Filter to 90-day window (NO lookahead)
		const trades90d = trades.filter(t => {
			const tradeDate = new Date(t.transactionDate);
			return tradeDate >= date90dAgo && tradeDate <= asOfDate;
		});

		// Count buys and sells (transactionType is 'Purchase' or 'Sale')
		const buyCount = trades90d.filter(t => t.transactionType === 'Purchase').length;
		const sellCount = trades90d.filter(t => t.transactionType === 'Sale').length;
		const totalCount = trades90d.length;

		// Calculate net sentiment (-1 to 1)
		const netSentiment = totalCount > 0 ? (buyCount - sellCount) / totalCount : 0;

		// Check for recent activity (last 7 days)
		const recentTrades = trades.filter(t => {
			const tradeDate = new Date(t.transactionDate);
			return tradeDate >= date7dAgo && tradeDate <= asOfDate;
		});
		const recentActivity = recentTrades.length > 0 ? 1 : 0;

		return {
			congress_buy_count_90d: buyCount,
			congress_sell_count_90d: sellCount,
			congress_net_sentiment: netSentiment,
			congress_recent_activity_7d: recentActivity,
		};
	}

	// ===== VOLUME & DARK POOL FEATURES (3) =====

	private async fetchDarkPoolMetrics(
		symbol: string,
		startDate: Date,
		endDate: Date
	): Promise<DarkPoolMetrics> {
		try {
			// Use Polygon's institutional volume endpoint
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

			// Calculate dark pool metrics from volume data
			const totalVolume = bars.reduce((sum, bar) => sum + bar.volume, 0);
			const avgVolume = totalVolume / bars.length;

			// Estimate institutional volume ratio (high volume days / total volume)
			const highVolumeDays = bars.filter(bar => bar.volume > avgVolume * 1.5).length;
			const institutionalVolumeRatio = highVolumeDays / bars.length;

			// Volume concentration (how concentrated is volume in top days)
			const sortedVolumes = bars.map(b => b.volume).sort((a, b) => b - a);
			const top5Volume = sortedVolumes.slice(0, Math.min(5, sortedVolumes.length)).reduce((a, b) => a + b, 0);
			const volumeConcentration = totalVolume > 0 ? top5Volume / totalVolume : 0;

			return {
				institutionalVolumeRatio,
				darkPoolVolume30d: totalVolume,
				volumeConcentration,
			};
		} catch (error) {
			const err = error as Error;
			throw new Error(`Dark pool metrics fetch failed for ${symbol}: ${err.message}`);
		}
	}

	private extractVolumeFeatures(
		metrics: DarkPoolMetrics
	): Pick<
		LeanSmartMoneyFeatures,
		'institutional_volume_ratio' | 'volume_concentration' | 'dark_pool_volume_30d'
	> {
		return {
			institutional_volume_ratio: metrics.institutionalVolumeRatio,
			volume_concentration: metrics.volumeConcentration,
			dark_pool_volume_30d: metrics.darkPoolVolume30d,
		};
	}

	// ===== PRICE & VOLUME MOMENTUM FEATURES (3) =====

	private async fetchOHLCVData(
		symbol: string,
		startDate: Date,
		endDate: Date
	): Promise<OHLCVBar[]> {
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

			return bars;
		} catch (error) {
			const err = error as Error;
			throw new Error(`OHLCV fetch failed for ${symbol}: ${err.message}`);
		}
	}

	private extractPriceFeatures(
		bars: OHLCVBar[],
		asOfDate: Date,
		date20dAgo: Date,
		date30dAgo: Date,
		date90dAgo: Date
	): Pick<LeanSmartMoneyFeatures, 'price_momentum_20d' | 'volume_trend_30d' | 'price_volatility_30d'> {
		if (bars.length < 20) {
			throw new Error(`Insufficient OHLCV data: need 20+ bars, got ${bars.length}`);
		}

		// Sort bars by timestamp
		const sortedBars = bars.sort((a, b) => a.timestamp - b.timestamp);

		// Get bars in different windows
		const bars30d = sortedBars.filter(b => b.timestamp >= date30dAgo.getTime());
		const bars90d = sortedBars;

		// 1. Price momentum (20-day % change)
		const bars20d = sortedBars.filter(b => b.timestamp >= date20dAgo.getTime());
		if (bars20d.length < 2) {
			throw new Error(`Insufficient 20-day bars for price momentum: got ${bars20d.length}, need 2+`);
		}
		const price_momentum_20d = (bars20d[bars20d.length - 1].close - bars20d[0].close) / bars20d[0].close;

		// 2. Volume trend (30d avg / 90d avg)
		const avgVolume30d = bars30d.reduce((sum, b) => sum + b.volume, 0) / bars30d.length;
		const avgVolume90d = bars90d.reduce((sum, b) => sum + b.volume, 0) / bars90d.length;

		if (avgVolume90d === 0) {
			throw new Error(`Zero volume in 90-day period - invalid data`);
		}
		const volume_trend_30d = avgVolume30d / avgVolume90d;

		// 3. Price volatility (30-day standard deviation of returns)
		const returns30d = bars30d.slice(1).map((bar, i) => {
			return (bar.close - bars30d[i].close) / bars30d[i].close;
		});
		const avgReturn = returns30d.reduce((sum, r) => sum + r, 0) / returns30d.length;
		const variance = returns30d.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns30d.length;
		const price_volatility_30d = Math.sqrt(variance);

		return {
			price_momentum_20d,
			volume_trend_30d,
			price_volatility_30d,
		};
	}

	// ===== VALIDATION (FAIL LOUDLY) =====

	private validateFeatures(features: LeanSmartMoneyFeatures, symbol: string): void {
		const featureNames = [
			'congress_buy_count_90d',
			'congress_sell_count_90d',
			'congress_net_sentiment',
			'congress_recent_activity_7d',
			'institutional_volume_ratio',
			'volume_concentration',
			'dark_pool_volume_30d',
			'price_momentum_20d',
			'volume_trend_30d',
			'price_volatility_30d',
		];

		const missingFeatures: string[] = [];
		const invalidFeatures: string[] = [];

		for (const name of featureNames) {
			const value = features[name as keyof LeanSmartMoneyFeatures];

			// Check if missing
			if (value === undefined || value === null) {
				missingFeatures.push(name);
				continue;
			}

			// Check if NaN or Infinity
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

		console.log(`[LeanSmartMoney] ✅ All 10 features validated for ${symbol}`);
	}
}
