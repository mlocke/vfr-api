/**
 * SEC Filings Data Cache
 * Purpose: Cache SEC filings data (insider trades, institutional ownership) with tiered TTL
 * Pattern: Follows IncomeStatementCache implementation
 */
import * as fs from "fs";
import * as path from "path";
import type { RetryHandler } from "../../../app/services/error-handling/RetryHandler.js";

interface SECFilingsCacheEntry {
	symbol: string;
	dataType: string; // "insider_trading" or "institutional_ownership"
	data: any;
	timestamp: number;
	version: string;
	isHistorical: boolean;
	limit?: number;
}

interface SECFilingsCacheData {
	[key: string]: SECFilingsCacheEntry; // key: "SYMBOL_TYPE_LIMIT"
}

export class SECFilingsCache {
	private cacheDir = path.join(process.cwd(), "data", "cache", "sec-filings");
	private cachePath = path.join(this.cacheDir, "sec-filings-cache.json");

	constructor() {
		if (!fs.existsSync(this.cacheDir)) {
			fs.mkdirSync(this.cacheDir, { recursive: true });
		}
	}

	/**
	 * Get insider trading data with tiered TTL caching
	 */
	async getInsiderTrading(
		symbol: string,
		limit: number,
		fetchFn: () => Promise<any>,
		retryHandler: RetryHandler
	): Promise<any> {
		const cache = this.loadCache();
		const key = this.getCacheKey(symbol, "insider_trading", limit);
		const cached = cache[key];

		// Check cache validity with tiered TTL
		if (cached && this.isCacheValid(cached)) {
			const age = Math.round((Date.now() - cached.timestamp) / (24 * 60 * 60 * 1000));
			console.log(`  📦 Using cached insider trading for ${symbol} (${age}d old, ${cached.isHistorical ? 'historical' : 'recent'})`);
			return cached.data;
		}

		// Fetch from API with retry logic
		console.log(`  🌐 Fetching insider trading from API for ${symbol} (limit: ${limit})`);
		const data = await retryHandler.withExponentialBackoff(
			fetchFn,
			5,
			1000
		);

		// Determine if data is historical (most recent transaction >30 days old)
		const isHistorical = this.isHistoricalInsiderData(data);

		// Cache the data
		cache[key] = {
			symbol,
			dataType: "insider_trading",
			data,
			timestamp: Date.now(),
			version: "v1.0.0",
			isHistorical,
			limit
		};
		this.saveCache(cache);

		return data;
	}

	/**
	 * Get institutional ownership data with tiered TTL caching
	 */
	async getInstitutionalOwnership(
		symbol: string,
		fetchFn: () => Promise<any>,
		retryHandler: RetryHandler
	): Promise<any> {
		const cache = this.loadCache();
		const key = this.getCacheKey(symbol, "institutional_ownership");
		const cached = cache[key];

		// Check cache validity with tiered TTL
		if (cached && this.isCacheValid(cached)) {
			const age = Math.round((Date.now() - cached.timestamp) / (24 * 60 * 60 * 1000));
			console.log(`  📦 Using cached institutional ownership for ${symbol} (${age}d old, ${cached.isHistorical ? 'historical' : 'recent'})`);
			return cached.data;
		}

		// Fetch from API with retry logic
		console.log(`  🌐 Fetching institutional ownership from API for ${symbol}`);
		const data = await retryHandler.withExponentialBackoff(
			fetchFn,
			5,
			1000
		);

		// Determine if data is historical (most recent filing >30 days old)
		const isHistorical = this.isHistoricalInstitutionalData(data);

		// Cache the data
		cache[key] = {
			symbol,
			dataType: "institutional_ownership",
			data,
			timestamp: Date.now(),
			version: "v1.0.0",
			isHistorical
		};
		this.saveCache(cache);

		return data;
	}

	private getCacheKey(symbol: string, dataType: string, limit?: number): string {
		return limit ? `${symbol}_${dataType}_${limit}` : `${symbol}_${dataType}`;
	}

	private isCacheValid(cached: SECFilingsCacheEntry): boolean {
		const now = Date.now();
		const age = now - cached.timestamp;

		// Historical data (filing >30 days old): 1 year TTL
		if (cached.isHistorical) {
			const oneYear = 365 * 24 * 60 * 60 * 1000;
			return age < oneYear;
		}

		// Recent data (filing <30 days old): 7 day TTL
		const sevenDays = 7 * 24 * 60 * 60 * 1000;
		return age < sevenDays;
	}

	private isHistoricalInsiderData(data: any): boolean {
		if (!data || !data.insiderTransactions || data.insiderTransactions.length === 0) {
			return false;
		}

		// Check the most recent transaction date
		const transactions = data.insiderTransactions;
		const mostRecentDate = new Date(transactions[0].filingDate);
		const daysSinceTransaction = (Date.now() - mostRecentDate.getTime()) / (24 * 60 * 60 * 1000);
		return daysSinceTransaction > 30;
	}

	private isHistoricalInstitutionalData(data: any): boolean {
		if (!data || !data.institutionalHolders || data.institutionalHolders.length === 0) {
			return false;
		}

		// Check the most recent filing date
		const holders = data.institutionalHolders;
		const mostRecentDate = new Date(holders[0].reportedDate || holders[0].dateReported);
		const daysSinceFiling = (Date.now() - mostRecentDate.getTime()) / (24 * 60 * 60 * 1000);
		return daysSinceFiling > 30;
	}

	private loadCache(): SECFilingsCacheData {
		if (!fs.existsSync(this.cachePath)) {
			return {};
		}
		try {
			const data = fs.readFileSync(this.cachePath, "utf-8");
			return JSON.parse(data);
		} catch (error) {
			console.warn("Failed to load SEC filings cache, starting fresh");
			return {};
		}
	}

	private saveCache(cache: SECFilingsCacheData): void {
		fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), "utf-8");
	}

	clearAll(): void {
		if (fs.existsSync(this.cachePath)) {
			fs.unlinkSync(this.cachePath);
			console.log("🗑️  SEC filings cache cleared");
		}
	}

	clearSymbol(symbol: string): void {
		const cache = this.loadCache();
		const keysToDelete = Object.keys(cache).filter(key => key.startsWith(`${symbol}_`));
		keysToDelete.forEach(key => delete cache[key]);
		this.saveCache(cache);
		console.log(`🗑️  Cleared SEC filings cache for ${symbol} (${keysToDelete.length} entries)`);
	}

	getCacheStats(): { totalEntries: number; historicalEntries: number; recentEntries: number } {
		const cache = this.loadCache();
		const entries = Object.values(cache);
		return {
			totalEntries: entries.length,
			historicalEntries: entries.filter(e => e.isHistorical).length,
			recentEntries: entries.filter(e => !e.isHistorical).length
		};
	}
}
