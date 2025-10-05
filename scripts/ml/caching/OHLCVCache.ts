/**
 * OHLCV Historical Data Cache
 * Purpose: Cache historical price data with tiered TTL (1 year for historical, 1 day for recent)
 * Pattern: Follows EarningsDataCache implementation
 */
import * as fs from "fs";
import * as path from "path";
import type { RetryHandler } from "../../../app/services/error-handling/RetryHandler.js";

interface OHLCVCacheEntry {
	symbol: string;
	data: any[];
	timestamp: number;
	version: string;
	isHistorical: boolean;
	startDate: string;
	endDate: string;
}

interface OHLCVCacheData {
	[key: string]: OHLCVCacheEntry; // key: "SYMBOL_STARTDATE_ENDDATE"
}

export class OHLCVCache {
	private cacheDir = path.join(process.cwd(), "data", "cache", "ohlcv");
	private cachePath = path.join(this.cacheDir, "ohlcv-cache.json");

	constructor() {
		if (!fs.existsSync(this.cacheDir)) {
			fs.mkdirSync(this.cacheDir, { recursive: true });
		}
	}

	/**
	 * Get OHLCV data with tiered TTL caching
	 */
	async getOHLCV(
		symbol: string,
		startDate: Date,
		endDate: Date,
		fetchFn: () => Promise<any[]>,
		retryHandler: RetryHandler
	): Promise<any[]> {
		const cache = this.loadCache();
		const key = this.getCacheKey(symbol, startDate, endDate);
		const cached = cache[key];

		// Check cache validity with tiered TTL
		if (cached && this.isCacheValid(cached)) {
			const age = Math.round((Date.now() - cached.timestamp) / (24 * 60 * 60 * 1000));
			console.log(`  📦 Using cached OHLCV for ${symbol} (${age}d old, ${cached.isHistorical ? 'historical' : 'recent'})`);
			return cached.data;
		}

		// Fetch from API with retry logic
		console.log(`  🌐 Fetching OHLCV from API for ${symbol} (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);
		const data = await retryHandler.withExponentialBackoff(
			fetchFn,
			5,
			1000
		) as any[];

		// Determine if data is historical (>30 days old)
		const isHistorical = this.isHistoricalData(endDate);

		// Cache the data
		cache[key] = {
			symbol,
			data,
			timestamp: Date.now(),
			version: "v1.0.0",
			isHistorical,
			startDate: startDate.toISOString().split('T')[0],
			endDate: endDate.toISOString().split('T')[0]
		};
		this.saveCache(cache);

		return data;
	}

	private getCacheKey(symbol: string, startDate: Date, endDate: Date): string {
		const start = startDate.toISOString().split('T')[0];
		const end = endDate.toISOString().split('T')[0];
		return `${symbol}_${start}_${end}`;
	}

	private isCacheValid(cached: OHLCVCacheEntry): boolean {
		const now = Date.now();
		const age = now - cached.timestamp;

		// Historical data (>30 days old): 1 year TTL
		if (cached.isHistorical) {
			const oneYear = 365 * 24 * 60 * 60 * 1000;
			return age < oneYear;
		}

		// Recent data (<30 days old): 1 day TTL
		const oneDay = 24 * 60 * 60 * 1000;
		return age < oneDay;
	}

	private isHistoricalData(endDate: Date): boolean {
		const daysSinceEndDate = (Date.now() - endDate.getTime()) / (24 * 60 * 60 * 1000);
		return daysSinceEndDate > 30;
	}

	private loadCache(): OHLCVCacheData {
		if (!fs.existsSync(this.cachePath)) {
			return {};
		}
		try {
			const data = fs.readFileSync(this.cachePath, "utf-8");
			return JSON.parse(data);
		} catch (error) {
			console.warn("Failed to load OHLCV cache, starting fresh");
			return {};
		}
	}

	private saveCache(cache: OHLCVCacheData): void {
		fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), "utf-8");
	}

	clearAll(): void {
		if (fs.existsSync(this.cachePath)) {
			fs.unlinkSync(this.cachePath);
			console.log("🗑️  OHLCV cache cleared");
		}
	}

	clearSymbol(symbol: string): void {
		const cache = this.loadCache();
		const keysToDelete = Object.keys(cache).filter(key => key.startsWith(`${symbol}_`));
		keysToDelete.forEach(key => delete cache[key]);
		this.saveCache(cache);
		console.log(`🗑️  Cleared OHLCV cache for ${symbol} (${keysToDelete.length} entries)`);
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
