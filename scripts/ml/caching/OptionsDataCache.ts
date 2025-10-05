/**
 * Options Data Cache
 * Purpose: Cache options data (put/call ratios, price targets) with tiered TTL
 * Pattern: Follows AnalystRatingsCache implementation
 */
import * as fs from "fs";
import * as path from "path";
import type { RetryHandler } from "../../../app/services/error-handling/RetryHandler.js";

interface OptionsDataCacheEntry {
	symbol: string;
	dataType: string; // "price_targets" or "dividend_data"
	data: any;
	timestamp: number;
	version: string;
	isHistorical: boolean;
}

interface OptionsDataCacheData {
	[key: string]: OptionsDataCacheEntry; // key: "SYMBOL_TYPE"
}

export class OptionsDataCache {
	private cacheDir = path.join(process.cwd(), "data", "cache", "options-data");
	private cachePath = path.join(this.cacheDir, "options-data-cache.json");

	constructor() {
		if (!fs.existsSync(this.cacheDir)) {
			fs.mkdirSync(this.cacheDir, { recursive: true });
		}
	}

	/**
	 * Get price targets data with tiered TTL caching
	 */
	async getPriceTargets(
		symbol: string,
		fetchFn: () => Promise<any>,
		retryHandler: RetryHandler
	): Promise<any> {
		const cache = this.loadCache();
		const key = this.getCacheKey(symbol, "price_targets");
		const cached = cache[key];

		// Check cache validity with tiered TTL
		if (cached && this.isCacheValid(cached)) {
			const age = Math.round((Date.now() - cached.timestamp) / (24 * 60 * 60 * 1000));
			console.log(`  📦 Using cached price targets for ${symbol} (${age}d old, ${cached.isHistorical ? 'historical' : 'recent'})`);
			return cached.data;
		}

		// Fetch from API with retry logic
		console.log(`  🌐 Fetching price targets from API for ${symbol}`);
		const data = await retryHandler.withExponentialBackoff(
			fetchFn,
			5,
			1000
		);

		// Determine if data is historical (target update >30 days old)
		const isHistorical = this.isHistoricalPriceTargets(data);

		// Cache the data
		cache[key] = {
			symbol,
			dataType: "price_targets",
			data,
			timestamp: Date.now(),
			version: "v1.0.0",
			isHistorical
		};
		this.saveCache(cache);

		return data;
	}

	/**
	 * Get dividend data with tiered TTL caching
	 */
	async getDividendData(
		symbol: string,
		fetchFn: () => Promise<any>,
		retryHandler: RetryHandler
	): Promise<any> {
		const cache = this.loadCache();
		const key = this.getCacheKey(symbol, "dividend_data");
		const cached = cache[key];

		// Check cache validity with tiered TTL
		if (cached && this.isCacheValid(cached)) {
			const age = Math.round((Date.now() - cached.timestamp) / (24 * 60 * 60 * 1000));
			console.log(`  📦 Using cached dividend data for ${symbol} (${age}d old, ${cached.isHistorical ? 'historical' : 'recent'})`);
			return cached.data;
		}

		// Fetch from API with retry logic
		console.log(`  🌐 Fetching dividend data from API for ${symbol}`);
		const data = await retryHandler.withExponentialBackoff(
			fetchFn,
			5,
			1000
		);

		// Determine if data is historical (most recent dividend >30 days old)
		const isHistorical = this.isHistoricalDividendData(data);

		// Cache the data
		cache[key] = {
			symbol,
			dataType: "dividend_data",
			data,
			timestamp: Date.now(),
			version: "v1.0.0",
			isHistorical
		};
		this.saveCache(cache);

		return data;
	}

	private getCacheKey(symbol: string, dataType: string): string {
		return `${symbol}_${dataType}`;
	}

	private isCacheValid(cached: OptionsDataCacheEntry): boolean {
		const now = Date.now();
		const age = now - cached.timestamp;

		// Historical data (update >30 days old): 1 year TTL
		if (cached.isHistorical) {
			const oneYear = 365 * 24 * 60 * 60 * 1000;
			return age < oneYear;
		}

		// Recent data (update <30 days old): 7 day TTL
		const sevenDays = 7 * 24 * 60 * 60 * 1000;
		return age < sevenDays;
	}

	private isHistoricalPriceTargets(data: any): boolean {
		if (!data || !data.lastUpdated) {
			return false;
		}

		const updateDate = new Date(data.lastUpdated);
		const daysSinceUpdate = (Date.now() - updateDate.getTime()) / (24 * 60 * 60 * 1000);
		return daysSinceUpdate > 30;
	}

	private isHistoricalDividendData(data: any): boolean {
		if (!data || !Array.isArray(data) || data.length === 0) {
			return false;
		}

		// Check the most recent dividend date
		const mostRecentDate = new Date(data[0].date || data[0].paymentDate);
		const daysSinceDividend = (Date.now() - mostRecentDate.getTime()) / (24 * 60 * 60 * 1000);
		return daysSinceDividend > 30;
	}

	private loadCache(): OptionsDataCacheData {
		if (!fs.existsSync(this.cachePath)) {
			return {};
		}
		try {
			const data = fs.readFileSync(this.cachePath, "utf-8");
			return JSON.parse(data);
		} catch (error) {
			console.warn("Failed to load options data cache, starting fresh");
			return {};
		}
	}

	private saveCache(cache: OptionsDataCacheData): void {
		fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), "utf-8");
	}

	clearAll(): void {
		if (fs.existsSync(this.cachePath)) {
			fs.unlinkSync(this.cachePath);
			console.log("🗑️  Options data cache cleared");
		}
	}

	clearSymbol(symbol: string): void {
		const cache = this.loadCache();
		const keysToDelete = Object.keys(cache).filter(key => key.startsWith(`${symbol}_`));
		keysToDelete.forEach(key => delete cache[key]);
		this.saveCache(cache);
		console.log(`🗑️  Cleared options data cache for ${symbol} (${keysToDelete.length} entries)`);
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
