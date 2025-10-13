/**
 * Hybrid Smart Money Data Service
 *
 * ⚠️ CRITICAL: IMPLEMENTS HISTORICAL DATA CACHING PRINCIPLE
 * See /scripts/ml/CLAUDE.md for full caching strategy documentation
 *
 * Combines FREE SEC EDGAR data with Polygon.io proxy features
 * to create 27 smart money features without FMP API quota issues.
 *
 * Data Sources:
 * - SEC EDGAR: Insider trades (Form 4), Institutional ownership (13F) - 20 features
 * - Polygon.io: Volume analytics - 7 proxy features (NO MOCK DATA)
 *
 * Caching Strategy:
 * - Check cache FIRST before every API call
 * - Save to cache immediately after API response
 * - Target: >95% cache hit rate on second run
 *
 * Cost: FREE (SEC) + existing Polygon subscription
 */

import { InstitutionalDataService } from '../../financial-data/InstitutionalDataService';
import { PolygonAPI } from '../../financial-data/PolygonAPI';
import { OptionsDataService } from '../../financial-data/OptionsDataService';
import { SECEdgarAPI } from '../../financial-data/SECEdgarAPI';
import { FinancialModelingPrepAPI } from '../../financial-data/FinancialModelingPrepAPI';
import { cusipMapper } from '../../financial-data/CUSIPToSymbolMapper';
import { smartMoneyCache } from '../../cache/SmartMoneyDataCache';
import {
	InsiderTransaction,
	InstitutionalHolding,
	CongressionalTrade,
	ETFHolding,
} from './types';
import { spawn } from 'child_process';
import * as path from 'path';

export interface OptionsFlowData {
	unusualCallVolume30d: number;
	unusualPutVolume30d: number;
	putCallRatioTrend: number;
	volumeSpike7d: number;
}

export interface VolumeAnalytics {
	institutionalVolumeRatio: number;
	darkPoolVolume30d: number;
	volumeConcentration: number;
}

export class HybridSmartMoneyDataService {
	private institutionalService: InstitutionalDataService; // Kept for fallback only
	private polygonAPI: PolygonAPI;
	private optionsService: OptionsDataService;
	private secAPI: SECEdgarAPI; // REAL SEC EDGAR API - NO FMP, NO MOCK DATA
	private fmpAPI: FinancialModelingPrepAPI;

	constructor() {
		this.institutionalService = new InstitutionalDataService();
		this.polygonAPI = new PolygonAPI();
		this.optionsService = new OptionsDataService();
		this.secAPI = new SECEdgarAPI(); // REAL implementation with XML parsing
		this.fmpAPI = new FinancialModelingPrepAPI();
	}

	/**
	 * Get Insider Trading from SEC EDGAR (Form 4)
	 * FREE, no rate limits beyond 10 req/sec
	 *
	 * ⚠️ CRITICAL: Uses cache-first pattern to avoid redundant API calls
	 */
	async getInsiderTrading(
		symbol: string,
		startDate: string,
		endDate: string,
		limit = 500
	): Promise<InsiderTransaction[]> {
		// Use cache.getOrFetch pattern - checks cache FIRST, calls API on miss
		const cachedData = await smartMoneyCache.getOrFetch<InsiderTransaction[]>(
			symbol,
			startDate,
			endDate,
			'insider_trades',
			async () => {
				// REAL SEC EDGAR API - NO FMP, NO MOCK DATA
				const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
				const secTransactions = await this.secAPI.getForm4Transactions(symbol, days, new Date(endDate));

				// Map SEC EDGAR types to ML types
				return secTransactions
					.map(t => this.mapSECInsiderTransaction(t))
					.slice(0, limit);
			},
			{ ttl: '7d', source: 'sec-edgar' }
		);

		return cachedData || [];
	}

	/**
	 * Map SEC EDGAR InsiderTransaction to ML InsiderTransaction type
	 * SEC EDGAR API returns: reportingOwnerName, reportingOwnerTitle, transactionType (BUY/SELL/etc), shares, pricePerShare, sharesOwnedAfter, relationship[]
	 * ML types expect: reportingName, typeOfOwner, transactionType, securitiesTransacted, price, securitiesOwned
	 */
	private mapSECInsiderTransaction(secTx: any): InsiderTransaction {
		return {
			symbol: secTx.symbol,
			filingDate: secTx.filingDate || '',
			transactionDate: secTx.transactionDate || '',
			transactionType: this.convertSECTransactionType(secTx.transactionType),
			securitiesTransacted: secTx.shares || 0,
			price: secTx.pricePerShare || 0,
			securitiesOwned: secTx.sharesOwnedAfter || 0,
			typeOfOwner: secTx.reportingOwnerTitle || (secTx.relationship ? secTx.relationship.join(', ') : ''),
			reportingName: secTx.reportingOwnerName || '',
		};
	}

	/**
	 * Convert SEC EDGAR transaction type to ML transaction type codes
	 * SEC: BUY, SELL, EXERCISE, GRANT, GIFT, OTHER
	 * ML: P (purchase), S (sale), M (exercise), A (grant), G (gift)
	 */
	private convertSECTransactionType(secType: string): 'P' | 'S' | 'A' | 'M' | 'G' | 'D' {
		const typeMap: Record<string, 'P' | 'S' | 'A' | 'M' | 'G' | 'D'> = {
			'BUY': 'P',
			'SELL': 'S',
			'EXERCISE': 'M',
			'GRANT': 'A',
			'GIFT': 'G',
			'OTHER': 'D'
		};
		return typeMap[secType] || 'S';
	}

	/**
	 * Get Institutional Ownership from local Parquet file (SEC 13F filings)
	 * Uses pre-parsed SEC 13F data with CUSIP lookups
	 *
	 * Data Source: datasets/SEC/13F/*.zip → data/smart_money_features/institutional_features.parquet
	 * Coverage: 269,039 holdings, 7 quarters (2024-2025)
	 *
	 * ⚠️ CRITICAL: Uses cache-first pattern to avoid redundant disk I/O
	 */
	async getInstitutionalOwnership(
		symbol: string,
		limit = 500
	): Promise<InstitutionalHolding[]> {
		// Use current date for cache key (13F data doesn't change frequently)
		const endDate = new Date().toISOString().split('T')[0];
		const startDate = this.subtractDays(new Date(), 365); // 1 year of data

		// Use cache.getOrFetch pattern - checks cache FIRST, queries Parquet on miss
		const cachedData = await smartMoneyCache.getOrFetch<InstitutionalHolding[]>(
			symbol,
			startDate,
			endDate,
			'institutional_ownership',
			async () => {
				try {
					// Step 1: Get CUSIP for this symbol
					console.log(`[HybridSmartMoney] Looking up CUSIP for ${symbol}...`);
					const cusip = await cusipMapper.symbolToCUSIP(symbol);

					if (!cusip) {
						console.warn(`[HybridSmartMoney] No CUSIP found for ${symbol}, cannot query institutional data`);
						return [];
					}

					console.log(`[HybridSmartMoney] Found CUSIP ${cusip} for ${symbol}`);

					// Step 2: Query Parquet file by CUSIP
					const parquetPath = path.join(process.cwd(), 'data', 'smart_money_features', 'institutional_features.parquet');

					const query = `
						SELECT
							cusip,
							quarter_date,
							total_shares,
							total_value,
							num_institutions,
							share_change,
							value_change
						FROM read_parquet('${parquetPath}')
						WHERE cusip = '${cusip}'
						AND quarter_date >= '${startDate}'
						AND quarter_date <= '${endDate}'
						ORDER BY quarter_date DESC
						LIMIT ${limit}
					`;

					const results = await this.executeDuckDBQuery(query);

					if (!results || results.length === 0) {
						console.log(`[HybridSmartMoney] No institutional data found in Parquet for ${symbol} (CUSIP: ${cusip})`);
						return [];
					}

					console.log(`[HybridSmartMoney] Got ${results.length} quarters of institutional data from Parquet for ${symbol}`);

					// Step 3: Map Parquet results to InstitutionalHolding format
					// Note: Parquet has aggregated data (all institutions combined per quarter)
					return results.map(row => ({
						symbol,
						date: row.quarter_date,
						investorName: 'ALL INSTITUTIONS (AGGREGATED)',
						shares: row.total_shares || 0,
						change: row.share_change || 0,
						changePercent: row.total_shares > 0 && row.share_change
							? (row.share_change / (row.total_shares - row.share_change)) * 100
							: 0,
						marketValue: row.total_value || 0,
						putCallShare: row.share_change > 0 ? 'Add' : row.share_change < 0 ? 'Reduce' : 'New',
					}));

				} catch (error) {
					console.error(`[HybridSmartMoney] Error querying institutional data for ${symbol}:`, error);
					return [];
				}
			},
			{ ttl: '7d', source: 'parquet-13f' }
		);

		return cachedData || [];
	}

	/**
	 * Map SEC EDGAR 13F InstitutionalHolding to ML InstitutionalHolding type
	 * SEC EDGAR API returns: managerName, shares, marketValue, filingDate, cusip, securityName
	 * ML types expect: investorName, shares, marketValue, date, change, changePercent, putCallShare
	 */
	private mapSEC13FHolding(secHolding: any): InstitutionalHolding {
		return {
			symbol: secHolding.symbol,
			date: secHolding.filingDate || secHolding.reportDate || '',
			investorName: secHolding.managerName || '',
			shares: secHolding.shares || 0,
			change: secHolding.sharesChange || 0,
			changePercent: secHolding.sharesChangePercent || 0,
			marketValue: secHolding.marketValue || 0,
			putCallShare: secHolding.isNewPosition ? 'New' : secHolding.isClosedPosition ? 'SoldOut' : 'Add',
		};
	}

	/**
	 * Get Congressional Trades PROXY using Polygon Options Flow
	 *
	 * Rationale: Options activity often precedes smart money moves
	 * Large unusual options volume can indicate institutional positioning
	 */
	async getCongressionalTradesProxy(
		symbol: string,
		startDate: string,
		endDate: string
	): Promise<CongressionalTrade[]> {
		// Note: This returns PROXY data - not actual congressional trades
		// We use options flow patterns as a proxy for smart money sentiment

		const optionsFlow = await this.getOptionsFlowData(symbol, startDate, endDate);

		// Convert options flow metrics to congressional trade proxies
		// High call volume = "buy" signals
		// High put volume = "sell" signals
		const trades: CongressionalTrade[] = [];

		if (optionsFlow.unusualCallVolume30d > 0) {
			trades.push({
				symbol,
				transactionDate: endDate,
				transactionType: 'Purchase',
				amount: `Proxy from options flow`,
				representative: 'OPTIONS_FLOW_PROXY',
				chamber: 'Senate', // Placeholder
			});
		}

		if (optionsFlow.unusualPutVolume30d > 0) {
			trades.push({
				symbol,
				transactionDate: endDate,
				transactionType: 'Sale',
				amount: `Proxy from options flow`,
				representative: 'OPTIONS_FLOW_PROXY',
				chamber: 'House', // Placeholder
			});
		}

		return trades;
	}

	/**
	 * Get ETF Holdings PROXY using Polygon Volume Analytics
	 *
	 * Rationale: ETF flows drive volume patterns
	 * Dark pool volume and institutional block trades are proxies for ETF activity
	 */
	async getETFHoldingsProxy(symbol: string): Promise<ETFHolding[]> {
		// Note: This returns PROXY data - not actual ETF holdings
		// We use volume analytics as a proxy for ETF ownership/flows

		const volumeAnalytics = await this.getVolumeAnalytics(symbol);

		// Convert volume metrics to ETF holding proxies
		const holdings: ETFHolding[] = [];

		if (volumeAnalytics.darkPoolVolume30d > 0) {
			holdings.push({
				symbol,
				date: new Date().toISOString().split('T')[0],
				etfSymbol: 'VOLUME_PROXY',
				etfName: 'Dark Pool Volume Proxy',
				shares: volumeAnalytics.darkPoolVolume30d,
				weightPercentage: volumeAnalytics.volumeConcentration,
				marketValue: 0, // Not available
			});
		}

		return holdings;
	}

	/**
	 * Get Options Flow Data as proxy for congressional trading sentiment
	 * Uses EODHD options data via OptionsDataService
	 *
	 * ⚠️ CRITICAL: Uses cache-first pattern to avoid redundant API calls
	 */
	private async getOptionsFlowData(
		symbol: string,
		startDate: string,
		endDate: string
	): Promise<OptionsFlowData> {
		// Use cache.getOrFetch pattern - checks cache FIRST, calls API on miss
		const cachedData = await smartMoneyCache.getOrFetch<OptionsFlowData>(
			symbol,
			startDate,
			endDate,
			'options_flow',
			async () => {
				try {
					// Get put/call ratio from options service (only on cache miss)
					const putCallData = await this.optionsService.getPutCallRatio(symbol);

					if (!putCallData) {
						return this.getEmptyOptionsFlow();
					}

					// Calculate metrics from real options data
					const callVolume = putCallData.totalCallVolume || 0;
					const putVolume = putCallData.totalPutVolume || 0;
					const totalVolume = callVolume + putVolume;
					const putCallRatio = putCallData.volumeRatio || 0;

					// Unusual volume: compare to average
					const avgVolume = totalVolume / 30; // Rough 30-day average proxy
					const unusualCallVolume = callVolume > avgVolume * 2 ? callVolume : 0;
					const unusualPutVolume = putVolume > avgVolume * 2 ? putVolume : 0;

					// Put/Call ratio trend: >1 = bearish, <1 = bullish
					const putCallTrend = putCallRatio > 1 ? putCallRatio - 1 : -(1 - putCallRatio);

					// Volume spike: detect if total volume is unusual
					const volumeSpike = totalVolume > avgVolume * 2.5 ? 1 : 0;

					return {
						unusualCallVolume30d: unusualCallVolume,
						unusualPutVolume30d: unusualPutVolume,
						putCallRatioTrend: putCallTrend,
						volumeSpike7d: volumeSpike,
					};
				} catch (error) {
					console.warn(`Options flow data unavailable for ${symbol}:`, error);
					return this.getEmptyOptionsFlow();
				}
			},
			{ ttl: '7d', source: 'eodhd-options' }
		);

		return cachedData || this.getEmptyOptionsFlow();
	}

	private getEmptyOptionsFlow(): OptionsFlowData {
		return {
			unusualCallVolume30d: 0,
			unusualPutVolume30d: 0,
			putCallRatioTrend: 0,
			volumeSpike7d: 0,
		};
	}

	/**
	 * Get Volume Analytics from Polygon.io as proxy for ETF holdings/flows
	 * Uses real historical bar data to calculate institutional trading patterns
	 *
	 * ⚠️ CRITICAL: Uses cache-first pattern to avoid redundant API calls
	 */
	private async getVolumeAnalytics(symbol: string): Promise<VolumeAnalytics> {
		// Get 30 days of historical data
		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - 30);

		const endDateStr = endDate.toISOString().split('T')[0];
		const startDateStr = startDate.toISOString().split('T')[0];

		// Use cache.getOrFetch pattern - checks cache FIRST, calls API on miss
		const cachedData = await smartMoneyCache.getOrFetch<VolumeAnalytics>(
			symbol,
			startDateStr,
			endDateStr,
			'dark_pool_volume',
			async () => {
				try {
					// Get 30 days of historical data (only on cache miss)
					const bars = await this.polygonAPI.getAggregates(
						symbol,
						1,
						'day',
						startDate,
						endDate
					);

					if (!bars || bars.length === 0) {
						return this.getEmptyVolumeAnalytics();
					}

					// Calculate institutional volume ratio
					// Large blocks indicate institutional activity
					const totalVolume = bars.reduce((sum, bar) => sum + bar.volume, 0);
					const avgVolume = totalVolume / bars.length;

					// Institutional volume proxy: days with >2x average volume
					const highVolumeDays = bars.filter(bar => bar.volume > avgVolume * 2).length;
					const institutionalVolumeRatio = highVolumeDays / bars.length;

					// Dark pool volume estimate: VWAP deviation indicates off-exchange trading
					// When VWAP differs significantly from close, suggests dark pool activity
					const vwapDeviations = bars.filter(bar => {
						if (!bar.vwap) return false;
						const deviation = Math.abs((bar.close - bar.vwap) / bar.close);
						return deviation > 0.01; // >1% deviation
					});
					const darkPoolVolume30d = vwapDeviations.length / bars.length;

					// Volume concentration: % of volume in top 20% of trading days
					const sortedByVolume = [...bars].sort((a, b) => b.volume - a.volume);
					const top20Percent = Math.ceil(bars.length * 0.2);
					const top20Volume = sortedByVolume.slice(0, top20Percent)
						.reduce((sum, bar) => sum + bar.volume, 0);
					const volumeConcentration = top20Volume / totalVolume;

					return {
						institutionalVolumeRatio,
						darkPoolVolume30d,
						volumeConcentration,
					};
				} catch (error) {
					console.warn(`Volume analytics unavailable for ${symbol}:`, error);
					return this.getEmptyVolumeAnalytics();
				}
			},
			{ ttl: '7d', source: 'polygon' }
		);

		return cachedData || this.getEmptyVolumeAnalytics();
	}

	private getEmptyVolumeAnalytics(): VolumeAnalytics {
		return {
			institutionalVolumeRatio: 0,
			darkPoolVolume30d: 0,
			volumeConcentration: 0,
		};
	}

	/**
	 * Get all smart money data at once
	 * Optimized for parallel fetching
	 */
	async getAllSmartMoneyData(
		symbol: string,
		startDate?: string,
		endDate?: string
	): Promise<{
		insiderTrading: InsiderTransaction[];
		institutionalOwnership: InstitutionalHolding[];
		congressionalTrades: CongressionalTrade[]; // PROXY DATA
		etfHoldings: ETFHolding[]; // PROXY DATA
	}> {
		const end = endDate || new Date().toISOString().split('T')[0];
		const start = startDate || this.subtractDays(new Date(), 90);

		// Fetch all data sources in parallel
		const [insiderTrading, institutionalOwnership, congressionalTrades, etfHoldings] =
			await Promise.all([
				this.getInsiderTrading(symbol, start, end, 200),
				this.getInstitutionalOwnership(symbol, 200),
				this.getCongressionalTradesProxy(symbol, start, end),
				this.getETFHoldingsProxy(symbol),
			]);

		return {
			insiderTrading,
			institutionalOwnership,
			congressionalTrades,
			etfHoldings,
		};
	}

	private subtractDays(date: Date, days: number): string {
		const result = new Date(date);
		result.setDate(result.getDate() - days);
		return result.toISOString().split('T')[0];
	}

	/**
	 * Execute DuckDB query and return results as JSON
	 * Used for querying Parquet files
	 */
	private async executeDuckDBQuery(query: string): Promise<any[]> {
		return new Promise((resolve, reject) => {
			const duckdb = spawn('duckdb', ['-json']);
			let output = '';
			let error = '';

			duckdb.stdout.on('data', (data: Buffer) => {
				output += data.toString();
			});

			duckdb.stderr.on('data', (data: Buffer) => {
				error += data.toString();
			});

			duckdb.on('close', (code: number) => {
				if (code !== 0) {
					reject(new Error(`DuckDB error: ${error}`));
					return;
				}

				try {
					// DuckDB with -json flag returns a JSON array like: [{"col1":val1},{"col2":val2}]
					// Parse the entire output as JSON array
					const trimmedOutput = output.trim();
					if (!trimmedOutput) {
						resolve([]);
						return;
					}

					const results = JSON.parse(trimmedOutput);
					resolve(Array.isArray(results) ? results : [results]);
				} catch (parseError) {
					reject(new Error(`Failed to parse DuckDB output: ${parseError}. Output: ${output}`));
				}
			});

			// Write query and close stdin
			duckdb.stdin.write(query + '\n');
			duckdb.stdin.end();
		});
	}
}
