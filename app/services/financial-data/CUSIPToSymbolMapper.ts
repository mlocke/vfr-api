/**
 * CUSIP to Symbol Mapper
 *
 * Maps CUSIP identifiers to ticker symbols using SEC company_tickers.json
 * Used for translating SEC 13F institutional holdings data (which uses CUSIP)
 * to ticker symbols needed by the application.
 *
 * CUSIP Format: 9-character identifier (8 chars + 1 check digit)
 * Example: 67066G104 → NVDA
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CompanyTicker {
	cik_str: number;
	ticker: string;
	title: string;
}

export class CUSIPToSymbolMapper {
	private static instance: CUSIPToSymbolMapper;
	private symbolToCompanyMap: Map<string, CompanyTicker> = new Map();
	private cusipToSymbolMap: Map<string, string> = new Map();
	private initialized = false;

	private constructor() {}

	static getInstance(): CUSIPToSymbolMapper {
		if (!CUSIPToSymbolMapper.instance) {
			CUSIPToSymbolMapper.instance = new CUSIPToSymbolMapper();
		}
		return CUSIPToSymbolMapper.instance;
	}

	/**
	 * Load and build CUSIP → symbol mapping
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		const tickersPath = path.join(process.cwd(), 'datasets', 'SEC', 'company_tickers.json');

		try {
			console.log(`[CUSIPMapper] Loading company tickers from ${tickersPath}...`);

			const data = JSON.parse(fs.readFileSync(tickersPath, 'utf-8'));

			// Build symbol → company map
			for (const company of Object.values(data) as CompanyTicker[]) {
				if (company.ticker) {
					this.symbolToCompanyMap.set(company.ticker.toUpperCase(), company);
				}
			}

			console.log(`[CUSIPMapper] Loaded ${this.symbolToCompanyMap.size} company mappings`);

			// Now we need to build CUSIP → symbol map by fetching CUSIPs from FMP
			// OR we can query the Parquet file to build the mapping
			await this.buildCUSIPMapping();

			this.initialized = true;
			console.log(`[CUSIPMapper] Initialized with ${this.cusipToSymbolMap.size} CUSIP mappings`);

		} catch (error) {
			console.error('[CUSIPMapper] Failed to initialize:', error);
			throw error;
		}
	}

	/**
	 * Build CUSIP → symbol mapping using FMP API or cache
	 */
	private async buildCUSIPMapping(): Promise<void> {
		// For now, we'll build the mapping on-demand as symbols are queried
		// This is more efficient than pre-loading all CUSIPs
		console.log('[CUSIPMapper] CUSIP mapping will be built on-demand');
	}

	/**
	 * Get ticker symbol from CUSIP
	 *
	 * Strategy:
	 * 1. Check cache first
	 * 2. Query FMP profile API (has CUSIP field)
	 * 3. Cache result
	 */
	async cusipToSymbol(cusip: string): Promise<string | null> {
		if (!this.initialized) {
			await this.initialize();
		}

		// Normalize CUSIP (uppercase, trim)
		const normalizedCUSIP = cusip.toUpperCase().trim();

		// Check cache
		if (this.cusipToSymbolMap.has(normalizedCUSIP)) {
			return this.cusipToSymbolMap.get(normalizedCUSIP)!;
		}

		// CUSIP not in cache - we can't reverse lookup without external API
		// For now, return null (will be handled by caller)
		return null;
	}

	/**
	 * Get CUSIP from ticker symbol using FMP API
	 * This is the reverse operation and requires an API call
	 */
	async symbolToCUSIP(symbol: string): Promise<string | null> {
		if (!this.initialized) {
			await this.initialize();
		}

		// We need to make an FMP API call to get CUSIP
		// The /v3/profile/{symbol} endpoint includes CUSIP
		const FMP_API_KEY = process.env.FMP_API_KEY;
		if (!FMP_API_KEY) {
			console.warn('[CUSIPMapper] FMP_API_KEY not set, cannot fetch CUSIP');
			return null;
		}

		try {
			const response = await fetch(
				`https://financialmodelingprep.com/api/v3/profile/${symbol.toUpperCase()}?apikey=${FMP_API_KEY}`
			);

			if (!response.ok) {
				return null;
			}

			const data = await response.json();
			if (Array.isArray(data) && data.length > 0) {
				const cusip = data[0].cusip;
				if (cusip) {
					// Cache the mapping
					this.cusipToSymbolMap.set(cusip, symbol.toUpperCase());
					console.log(`[CUSIPMapper] Cached ${cusip} → ${symbol}`);
					return cusip;
				}
			}

			return null;
		} catch (error) {
			console.error(`[CUSIPMapper] Error fetching CUSIP for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Add a manual CUSIP → symbol mapping
	 * Used when we know the mapping from other sources (like 13F NAMEOFISSUER)
	 */
	addMapping(cusip: string, symbol: string): void {
		const normalizedCUSIP = cusip.toUpperCase().trim();
		const normalizedSymbol = symbol.toUpperCase().trim();
		this.cusipToSymbolMap.set(normalizedCUSIP, normalizedSymbol);
	}

	/**
	 * Get all cached mappings
	 */
	getAllMappings(): Map<string, string> {
		return new Map(this.cusipToSymbolMap);
	}
}

// Export singleton instance
export const cusipMapper = CUSIPToSymbolMapper.getInstance();
