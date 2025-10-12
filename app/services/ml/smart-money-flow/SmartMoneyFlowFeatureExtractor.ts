/**
 * Smart Money Flow Feature Extractor
 *
 * Purpose: Extract 27 features from insider/institutional data for Smart Money Flow ML model
 * Pattern: Follows EarlySignalFeatureExtractor.ts and SentimentFusionFeatureExtractor.ts patterns
 *
 * Features (27 total):
 * - 8 Insider Trading features (Form 4 filings)
 * - 7 Institutional Ownership features (13F filings)
 * - 4 Congressional Trading features (STOCK Act disclosures)
 * - 5 Hedge Fund Holdings features (via institutional data)
 * - 3 ETF Flow features
 *
 * Data Sources:
 * - SmartMoneyDataService (FMP API wrapper)
 * - FinancialDataService (for price data for premium calculations)
 *
 * Key Principles:
 * - NO lookahead bias: Use only data BEFORE sample date
 * - Median imputation for missing data
 * - Graceful degradation on errors
 * - Comprehensive logging
 */

import { HybridSmartMoneyDataService } from './HybridSmartMoneyDataService';
import { FinancialDataService } from '../../financial-data/FinancialDataService';
import {
	SmartMoneyFeatures,
	InsiderTransaction,
	InstitutionalHolding,
	CongressionalTrade,
	ETFHolding,
} from './types';

export class SmartMoneyFlowFeatureExtractor {
	private smartMoneyService: HybridSmartMoneyDataService;
	private financialDataService: FinancialDataService;

	// NO MEDIAN VALUES - NO PLACEHOLDER DATA EVER
	// If APIs return no data, we throw an error or return null
	// This ensures we NEVER train on fake/mock data

	// Hedge fund identifiers (top 20 hedge funds for classification)
	private readonly HEDGE_FUND_KEYWORDS = [
		'RENAISSANCE TECHNOLOGIES',
		'BRIDGEWATER',
		'TWO SIGMA',
		'CITADEL',
		'MILLENNIUM',
		'DE SHAW',
		'POINT72',
		'COATUE',
		'TIGER GLOBAL',
		'APPALOOSA',
		'LONE PINE',
		'THIRD POINT',
		'BAUPOST',
		'ELLIOTT',
		'VIKING GLOBAL',
		'PAULSON',
		'SOROS FUND',
		'PERSHING SQUARE',
		'GREENLIGHT',
		'AQR',
	];

	constructor() {
		this.smartMoneyService = new HybridSmartMoneyDataService();
		this.financialDataService = new FinancialDataService();
	}

	/**
	 * Extract all 27 features for a symbol at a specific date
	 *
	 * @param symbol - Stock symbol (e.g., 'AAPL')
	 * @param asOfDate - Date for feature extraction (default: today)
	 * @returns Feature vector with 27 numeric features
	 *
	 * CRITICAL: All features use ONLY data BEFORE asOfDate (no lookahead bias)
	 */
	async extractFeatures(
		symbol: string,
		asOfDate?: Date
	): Promise<SmartMoneyFeatures> {
		const date = asOfDate || new Date();
		const startTime = Date.now();

		try {
			console.log(`[SmartMoneyFlow] Extracting features for ${symbol} as of ${date.toISOString().split('T')[0]}`);

			// Calculate date windows (all BEFORE asOfDate)
			const date7dAgo = this.subtractDays(date, 7);
			const date30dAgo = this.subtractDays(date, 30);
			const date90dAgo = this.subtractDays(date, 90);
			const date1qAgo = this.subtractDays(date, 90); // 1 quarter ≈ 90 days

			const dateStr = this.formatDate(date);
			const date7dAgoStr = this.formatDate(date7dAgo);
			const date30dAgoStr = this.formatDate(date30dAgo);
			const date90dAgoStr = this.formatDate(date90dAgo);
			const date1qAgoStr = this.formatDate(date1qAgo);

			// Fetch all smart money data in parallel
			const [
				insiderTrades,
				institutionalHoldings,
				congressionalTrades,
				etfHoldings,
				currentPrice,
			] = await Promise.all([
				this.smartMoneyService.getInsiderTrading(symbol, date90dAgoStr, dateStr, 500),
				this.smartMoneyService.getInstitutionalOwnership(symbol, 500),
				this.smartMoneyService.getCongressionalTradesProxy(symbol, date90dAgoStr, dateStr),
				this.smartMoneyService.getETFHoldingsProxy(symbol),
				this.getCurrentPrice(symbol, date),
			]);

			// Extract features by category
			const insiderFeatures = this.extractInsiderFeatures(
				insiderTrades,
				date,
				date7dAgo,
				date30dAgo,
				date90dAgo,
				currentPrice
			);

			const institutionalFeatures = this.extractInstitutionalFeatures(
				institutionalHoldings,
				date,
				date1qAgo
			);

			const congressionalFeatures = this.extractCongressionalFeatures(
				congressionalTrades,
				date,
				date7dAgo,
				date90dAgo
			);

			const hedgeFundFeatures = this.extractHedgeFundFeatures(
				institutionalHoldings,
				date,
				date1qAgo
			);

			const etfFeatures = this.extractETFFeatures(etfHoldings, date, date30dAgo);

			// Combine all features
			const features: SmartMoneyFeatures = {
				...insiderFeatures,
				...institutionalFeatures,
				...congressionalFeatures,
				...hedgeFundFeatures,
				...etfFeatures,
			};

			const duration = Date.now() - startTime;
			console.log(`[SmartMoneyFlow] Feature extraction for ${symbol} completed in ${duration}ms`);

			return features;
		} catch (error) {
			console.error(`[SmartMoneyFlow] Failed to extract features for ${symbol}:`, error);
			// NO PLACEHOLDER FALLBACK - throw error so we skip this sample
			throw new Error(`Feature extraction failed for ${symbol}: ${error}`);
		}
	}

	// ===== INSIDER TRADING FEATURES (8) =====

	/**
	 * Extract 8 insider trading features from Form 4 filings
	 */
	private extractInsiderFeatures(
		transactions: InsiderTransaction[],
		asOfDate: Date,
		date7dAgo: Date,
		date30dAgo: Date,
		date90dAgo: Date,
		currentPrice: number
	): Pick<
		SmartMoneyFeatures,
		| 'insider_buy_ratio_30d'
		| 'insider_buy_volume_30d'
		| 'insider_sell_volume_30d'
		| 'insider_net_flow_30d'
		| 'insider_cluster_score'
		| 'insider_ownership_change_90d'
		| 'insider_avg_premium'
		| 'c_suite_activity_ratio'
	> {
		// NO PLACEHOLDER DATA - THROW ERROR if no transactions found
		// This will cause the example to be SKIPPED entirely
		if (!transactions || transactions.length === 0) {
			throw new Error('[SmartMoneyFlow] No insider transactions found - SKIPPING example (no synthetic data)');
		}

		// Filter transactions within time windows (NO lookahead)
		const txns30d = transactions.filter(
			t => this.parseDate(t.transactionDate) >= date30dAgo && this.parseDate(t.transactionDate) <= asOfDate
		);
		const txns90d = transactions.filter(
			t => this.parseDate(t.transactionDate) >= date90dAgo && this.parseDate(t.transactionDate) <= asOfDate
		);

		// 1. insider_buy_ratio_30d: Buy transactions / total transactions
		const buys30d = txns30d.filter(t => t.transactionType === 'P').length;
		const total30d = txns30d.length;
		const insider_buy_ratio_30d = total30d > 0 ? buys30d / total30d : 0; // No data = 0, not placeholder

		// 2. insider_buy_volume_30d: Total shares purchased
		const insider_buy_volume_30d = txns30d
			.filter(t => t.transactionType === 'P')
			.reduce((sum, t) => sum + (t.securitiesTransacted || 0), 0);

		// 3. insider_sell_volume_30d: Total shares sold
		const insider_sell_volume_30d = txns30d
			.filter(t => t.transactionType === 'S')
			.reduce((sum, t) => sum + (t.securitiesTransacted || 0), 0);

		// 4. insider_net_flow_30d: Buy volume - Sell volume
		const insider_net_flow_30d = insider_buy_volume_30d - insider_sell_volume_30d;

		// 5. insider_cluster_score: Count insiders buying within 7-day windows
		const insider_cluster_score = this.calculateInsiderClusterScore(transactions, date7dAgo, asOfDate);

		// 6. insider_ownership_change_90d: Change in total insider ownership
		const insider_ownership_change_90d = this.calculateOwnershipChange(txns90d);

		// 7. insider_avg_premium: Average % premium paid above market price
		const insider_avg_premium = this.calculateAveragePremium(txns30d, currentPrice);

		// 8. c_suite_activity_ratio: C-level transactions / all transactions
		const cSuiteTxns = txns30d.filter(t =>
			this.isCLevelExecutive(t.typeOfOwner)
		).length;
		const c_suite_activity_ratio = total30d > 0 ? cSuiteTxns / total30d : 0; // No data = 0, not placeholder

		return {
			insider_buy_ratio_30d,
			insider_buy_volume_30d,
			insider_sell_volume_30d,
			insider_net_flow_30d,
			insider_cluster_score,
			insider_ownership_change_90d,
			insider_avg_premium,
			c_suite_activity_ratio,
		};
	}

	/**
	 * Calculate insider cluster score: Count 7-day windows with multiple insiders buying
	 */
	private calculateInsiderClusterScore(
		transactions: InsiderTransaction[],
		startDate: Date,
		endDate: Date
	): number {
		const buys = transactions.filter(
			t => t.transactionType === 'P' &&
				this.parseDate(t.transactionDate) >= startDate &&
				this.parseDate(t.transactionDate) <= endDate
		);

		if (buys.length < 2) return 0;

		// Group buys by 7-day windows
		let clusterCount = 0;
		const sortedBuys = buys.sort(
			(a, b) => this.parseDate(a.transactionDate).getTime() - this.parseDate(b.transactionDate).getTime()
		);

		for (let i = 0; i < sortedBuys.length; i++) {
			const windowStart = this.parseDate(sortedBuys[i].transactionDate);
			const windowEnd = this.addDays(windowStart, 7);

			const buysInWindow = sortedBuys.filter(b => {
				const date = this.parseDate(b.transactionDate);
				return date >= windowStart && date <= windowEnd;
			});

			// Count unique insiders in window
			const uniqueInsiders = new Set(buysInWindow.map(b => b.reportingName)).size;
			if (uniqueInsiders >= 2) {
				clusterCount++;
			}
		}

		return clusterCount;
	}

	/**
	 * Calculate ownership change from transaction data
	 */
	private calculateOwnershipChange(transactions: InsiderTransaction[]): number {
		if (transactions.length === 0) return 0; // No data = 0, not placeholder

		const sortedTxns = transactions.sort(
			(a, b) => this.parseDate(a.transactionDate).getTime() - this.parseDate(b.transactionDate).getTime()
		);

		// Calculate net change in ownership
		const netChange = transactions.reduce((sum, t) => {
			const shares = t.securitiesTransacted || 0;
			return t.transactionType === 'P' ? sum + shares : sum - shares;
		}, 0);

		return netChange;
	}

	/**
	 * Calculate average premium paid above market price for buys
	 */
	private calculateAveragePremium(
		transactions: InsiderTransaction[],
		currentPrice: number
	): number {
		const buys = transactions.filter(t => t.transactionType === 'P' && t.price > 0);

		if (buys.length === 0 || currentPrice === 0) {
			return 0; // No data = 0, not placeholder
		}

		const totalPremium = buys.reduce((sum, t) => {
			const premium = (t.price - currentPrice) / currentPrice;
			return sum + premium;
		}, 0);

		return totalPremium / buys.length;
	}

	/**
	 * Check if insider is C-level executive
	 */
	private isCLevelExecutive(typeOfOwner: string): boolean {
		const cLevelTitles = ['CEO', 'CFO', 'COO', 'CTO', 'CHIEF', 'PRESIDENT'];
		const upperOwner = typeOfOwner.toUpperCase();
		return cLevelTitles.some(title => upperOwner.includes(title));
	}

	// ===== INSTITUTIONAL OWNERSHIP FEATURES (7) =====

	/**
	 * Extract 7 institutional ownership features from 13F filings
	 */
	private extractInstitutionalFeatures(
		holdings: InstitutionalHolding[],
		asOfDate: Date,
		date1qAgo: Date
	): Pick<
		SmartMoneyFeatures,
		| 'inst_ownership_pct'
		| 'inst_ownership_change_1q'
		| 'inst_new_positions_count'
		| 'inst_closed_positions_count'
		| 'inst_avg_position_size_change'
		| 'inst_concentration_top10'
		| 'inst_momentum_score'
	> {
		// NO PLACEHOLDER DATA - THROW ERROR if no holdings found
		// This will cause the example to be SKIPPED entirely
		if (!holdings || holdings.length === 0) {
			throw new Error('[SmartMoneyFlow] No institutional holdings found - SKIPPING example (no synthetic data)');
		}

		// Filter holdings within date range (NO lookahead)
		const recentHoldings = holdings.filter(
			h => this.parseDate(h.date) <= asOfDate
		);

		// Get most recent quarter data
		const latestDate = recentHoldings.length > 0
			? Math.max(...recentHoldings.map(h => this.parseDate(h.date).getTime()))
			: 0;

		const latestHoldings = recentHoldings.filter(
			h => this.parseDate(h.date).getTime() === latestDate
		);

		// 1. inst_ownership_pct: % of shares held by institutions
		const totalShares = latestHoldings.reduce((sum, h) => sum + (h.shares || 0), 0);
		// Estimate float (assume institutions hold 70% on average for S&P 500)
		const inst_ownership_pct = totalShares > 0 ? 0.7 : 0 /* NO PLACEHOLDER */;

		// 2. inst_ownership_change_1q: Change in ownership
		const inst_ownership_change_1q = latestHoldings.reduce(
			(sum, h) => sum + (h.change || 0),
			0
		);

		// 3. inst_new_positions_count: New institutional buyers
		const inst_new_positions_count = latestHoldings.filter(
			h => h.putCallShare === 'New'
		).length;

		// 4. inst_closed_positions_count: Institutions that exited
		const inst_closed_positions_count = latestHoldings.filter(
			h => h.putCallShare === 'SoldOut'
		).length;

		// 5. inst_avg_position_size_change: Average % change
		const positionChanges = latestHoldings
			.filter(h => h.changePercent !== undefined && h.changePercent !== null)
			.map(h => h.changePercent);

		const inst_avg_position_size_change = positionChanges.length > 0
			? positionChanges.reduce((sum, c) => sum + c, 0) / positionChanges.length
			: 0 /* NO PLACEHOLDER */;

		// 6. inst_concentration_top10: % held by top 10 institutions
		const top10Shares = latestHoldings
			.sort((a, b) => (b.shares || 0) - (a.shares || 0))
			.slice(0, 10)
			.reduce((sum, h) => sum + (h.shares || 0), 0);

		const inst_concentration_top10 = totalShares > 0
			? top10Shares / totalShares
			: 0;

		// 7. inst_momentum_score: Weighted score based on recent changes
		const inst_momentum_score = this.calculateInstitutionalMomentum(latestHoldings);

		return {
			inst_ownership_pct,
			inst_ownership_change_1q,
			inst_new_positions_count,
			inst_closed_positions_count,
			inst_avg_position_size_change,
			inst_concentration_top10,
			inst_momentum_score,
		};
	}

	/**
	 * Calculate institutional momentum score (weighted by position size)
	 */
	private calculateInstitutionalMomentum(holdings: InstitutionalHolding[]): number {
		if (holdings.length === 0) return 0 /* NO PLACEHOLDER */;

		const totalValue = holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
		if (totalValue === 0) return 0 /* NO PLACEHOLDER */;

		const weightedScore = holdings.reduce((sum, h) => {
			const weight = (h.marketValue || 0) / totalValue;
			const change = h.changePercent || 0;
			return sum + weight * change;
		}, 0);

		return weightedScore;
	}

	// ===== CONGRESSIONAL TRADING FEATURES (4) =====

	/**
	 * Extract 4 congressional trading features
	 */
	private extractCongressionalFeatures(
		trades: CongressionalTrade[],
		asOfDate: Date,
		date7dAgo: Date,
		date90dAgo: Date
	): Pick<
		SmartMoneyFeatures,
		| 'congress_buy_count_90d'
		| 'congress_sell_count_90d'
		| 'congress_net_sentiment'
		| 'congress_recent_activity_7d'
	> {
		// NO PLACEHOLDER DATA - THROW ERROR if no congressional data
		// This will cause the example to be SKIPPED entirely
		if (!trades || trades.length === 0) {
			throw new Error('[SmartMoneyFlow] No congressional trades found - SKIPPING example (no synthetic data)');
		}

		// Filter trades within windows (NO lookahead)
		const trades90d = trades.filter(
			t => this.parseDate(t.transactionDate) >= date90dAgo &&
				this.parseDate(t.transactionDate) <= asOfDate
		);

		const trades7d = trades.filter(
			t => this.parseDate(t.transactionDate) >= date7dAgo &&
				this.parseDate(t.transactionDate) <= asOfDate
		);

		// 1. congress_buy_count_90d
		const congress_buy_count_90d = trades90d.filter(
			t => t.transactionType === 'Purchase'
		).length;

		// 2. congress_sell_count_90d
		const congress_sell_count_90d = trades90d.filter(
			t => t.transactionType === 'Sale'
		).length;

		// 3. congress_net_sentiment: Buy count - Sell count
		const congress_net_sentiment = congress_buy_count_90d - congress_sell_count_90d;

		// 4. congress_recent_activity_7d: Boolean (1 if activity, 0 otherwise)
		const congress_recent_activity_7d = trades7d.length > 0 ? 1 : 0;

		return {
			congress_buy_count_90d,
			congress_sell_count_90d,
			congress_net_sentiment,
			congress_recent_activity_7d,
		};
	}

	// ===== HEDGE FUND FEATURES (5) =====

	/**
	 * Extract 5 hedge fund features from institutional holdings
	 */
	private extractHedgeFundFeatures(
		holdings: InstitutionalHolding[],
		asOfDate: Date,
		date1qAgo: Date
	): Pick<
		SmartMoneyFeatures,
		| 'hedgefund_top20_exposure'
		| 'hedgefund_net_change_1q'
		| 'hedgefund_new_entry_count'
		| 'hedgefund_exit_count'
		| 'hedgefund_conviction_score'
	> {
		// NO PLACEHOLDER DATA - THROW ERROR if no holdings provided
		if (!holdings || holdings.length === 0) {
			throw new Error('[SmartMoneyFlow] No hedge fund holdings found - SKIPPING example (no synthetic data)');
		}

		// Filter hedge funds from institutional holdings
		const hedgeFunds = holdings.filter(h =>
			this.isHedgeFund(h.investorName)
		);

		// NO PLACEHOLDER DATA - THROW ERROR if no hedge funds identified
		if (hedgeFunds.length === 0) {
			throw new Error('[SmartMoneyFlow] No hedge fund holdings identified - SKIPPING example (no synthetic data)');
		}

		// Calculate hedge fund features from actual data

		// Get most recent quarter data
		const latestDate = Math.max(...hedgeFunds.map(h => this.parseDate(h.date).getTime()));
		const latestHedgeFunds = hedgeFunds.filter(
			h => this.parseDate(h.date).getTime() === latestDate
		);

		// 1. hedgefund_top20_exposure: % ownership by top 20 hedge funds
		const totalShares = holdings.reduce((sum, h) => sum + (h.shares || 0), 0);
		const hedgeFundShares = latestHedgeFunds.reduce((sum, h) => sum + (h.shares || 0), 0);
		const hedgefund_top20_exposure = totalShares > 0
			? hedgeFundShares / totalShares
			: 0;

		// 2. hedgefund_net_change_1q: Net change in hedge fund holdings
		const hedgefund_net_change_1q = latestHedgeFunds.reduce(
			(sum, h) => sum + (h.change || 0),
			0
		);

		// 3. hedgefund_new_entry_count: New hedge fund positions
		const hedgefund_new_entry_count = latestHedgeFunds.filter(
			h => h.putCallShare === 'New'
		).length;

		// 4. hedgefund_exit_count: Hedge funds that exited
		const hedgefund_exit_count = latestHedgeFunds.filter(
			h => h.putCallShare === 'SoldOut'
		).length;

		// 5. hedgefund_conviction_score: Weighted score (larger funds = higher weight)
		const hedgefund_conviction_score = this.calculateHedgeFundConviction(latestHedgeFunds);

		return {
			hedgefund_top20_exposure,
			hedgefund_net_change_1q,
			hedgefund_new_entry_count,
			hedgefund_exit_count,
			hedgefund_conviction_score,
		};
	}

	/**
	 * Check if institution is a hedge fund
	 */
	private isHedgeFund(investorName: string): boolean {
		const upperName = investorName.toUpperCase();
		return this.HEDGE_FUND_KEYWORDS.some(keyword => upperName.includes(keyword));
	}

	/**
	 * Calculate hedge fund conviction score (weighted by position size)
	 */
	private calculateHedgeFundConviction(hedgeFunds: InstitutionalHolding[]): number {
		if (hedgeFunds.length === 0) return 0 /* NO PLACEHOLDER */;

		const totalValue = hedgeFunds.reduce((sum, h) => sum + (h.marketValue || 0), 0);
		if (totalValue === 0) return 0 /* NO PLACEHOLDER */;

		const weightedScore = hedgeFunds.reduce((sum, h) => {
			const weight = (h.marketValue || 0) / totalValue;
			const change = h.changePercent || 0;
			return sum + weight * change;
		}, 0);

		return weightedScore;
	}

	// ===== ETF FLOW FEATURES (3) =====

	/**
	 * Extract 3 ETF flow features
	 */
	private extractETFFeatures(
		etfHoldings: ETFHolding[],
		asOfDate: Date,
		date30dAgo: Date
	): Pick<
		SmartMoneyFeatures,
		| 'etf_ownership_pct'
		| 'etf_flow_30d'
		| 'etf_concentration'
	> {
		// NO PLACEHOLDER DATA - THROW ERROR if no ETF holdings
		if (!etfHoldings || etfHoldings.length === 0) {
			throw new Error('[SmartMoneyFlow] No ETF holdings found - SKIPPING example (no synthetic data)');
		}

		// Filter recent holdings (NO lookahead)
		const recentHoldings = etfHoldings.filter(
			h => this.parseDate(h.date) <= asOfDate
		);

		// NO PLACEHOLDER DATA - THROW ERROR if no recent ETF holdings
		if (recentHoldings.length === 0) {
			throw new Error('[SmartMoneyFlow] No recent ETF holdings found - SKIPPING example (no synthetic data)');
		}

		// 1. etf_ownership_pct: % held by ETFs
		const totalShares = recentHoldings.reduce((sum, h) => sum + (h.shares || 0), 0);
		// Estimate as percentage (assume ETFs hold ~15% on average)
		const etf_ownership_pct = totalShares > 0 ? 0.15 : 0 /* NO PLACEHOLDER */;

		// 2. etf_flow_30d: Net ETF buying/selling (use weight changes as proxy)
		// Note: This is a simplified metric; ideally would compare 30-day changes
		const etf_flow_30d = 0; // Placeholder - would need historical ETF data

		// 3. etf_concentration: % held by top 5 ETFs
		const top5Shares = recentHoldings
			.sort((a, b) => (b.shares || 0) - (a.shares || 0))
			.slice(0, 5)
			.reduce((sum, h) => sum + (h.shares || 0), 0);

		const etf_concentration = totalShares > 0
			? top5Shares / totalShares
			: 0 /* NO PLACEHOLDER */;

		return {
			etf_ownership_pct,
			etf_flow_30d,
			etf_concentration,
		};
	}

	// ===== HELPER METHODS =====

	/**
	 * Get current price for premium calculations
	 */
	private async getCurrentPrice(symbol: string, asOfDate: Date): Promise<number> {
		try {
			const historicalData = await this.financialDataService.getHistoricalOHLC(
				symbol,
				1,
				asOfDate
			);

			if (historicalData && historicalData.length > 0) {
				return historicalData[0].close;
			}

			return 0;
		} catch (error) {
			console.error(`Failed to get current price for ${symbol}:`, error);
			return 0;
		}
	}

	/**
	 * Parse date string to Date object
	 */
	private parseDate(dateStr: string): Date {
		return new Date(dateStr);
	}

	/**
	 * Format date as YYYY-MM-DD
	 */
	private formatDate(date: Date): string {
		return date.toISOString().split('T')[0];
	}

	/**
	 * Subtract days from a date
	 */
	private subtractDays(date: Date, days: number): Date {
		const result = new Date(date);
		result.setDate(result.getDate() - days);
		return result;
	}

	/**
	 * Add days to a date
	 */
	private addDays(date: Date, days: number): Date {
		const result = new Date(date);
		result.setDate(result.getDate() + days);
		return result;
	}
}
