/**
 * Analyst Ratings Data Cache
 * Purpose: Cache analyst ratings data with tiered TTL (1 year for historical, 7 days for recent)
 * Pattern: Follows IncomeStatementCache implementation
 */
import * as fs from "fs";
import * as path from "path";
import type { RetryHandler } from "../../../app/services/error-handling/RetryHandler.js";

interface AnalystRatingsCacheEntry {
	symbol: string;
	data: any;
	timestamp: number;
	version: string;
	isHistorical: boolean;
}

interface AnalystRatingsCacheData {
	[key: string]: AnalystRatingsCacheEntry; // key: "SYMBOL"
}

export class AnalystRatingsCache {
	private cacheDir = path.join(process.cwd(), "data", "cache", "analyst-ratings");
	private cachePath = path.join(this.cacheDir, "analyst-ratings-cache.json");

	constructor() {
		if (!fs.existsSync(this.cacheDir)) {
			fs.mkdirSync(this.cacheDir, { recursive: true });
		}
	}

	/**
	 * Get analyst ratings data with tiered TTL caching
	 */
	async getAnalystRatings(
		symbol: string,
		fetchFn: () => Promise<any>,
		retryHandler: RetryHandler
	): Promise<any> {
		const cache = this.loadCache();
		const key = symbol;
		const cached = cache[key];

		// Check cache validity with tiered TTL
		if (cached && this.isCacheValid(cached)) {
			const age = Math.round((Date.now() - cached.timestamp) / (24 * 60 * 60 * 1000));
			console.log(`  📦 Using cached analyst ratings for ${symbol} (${age}d old, ${cached.isHistorical ? 'historical' : 'recent'})`);
			return cached.data;
		}

		// Fetch from API with retry logic
		console.log(`  🌐 Fetching analyst ratings from API for ${symbol}`);
		const data = await retryHandler.withExponentialBackoff(
			fetchFn,
			5,
			1000
		);

		// Determine if data is historical (rating update >30 days old)
		const isHistorical = this.isHistoricalData(data);

		// Cache the data
		cache[key] = {
			symbol,
			data,
			timestamp: Date.now(),
			version: "v1.0.0",
			isHistorical
		};
		this.saveCache(cache);

		return data;
	}

	private isCacheValid(cached: AnalystRatingsCacheEntry): boolean {
		const now = Date.now();
		const age = now - cached.timestamp;

		// Historical data (rating update >30 days old): 1 year TTL
		if (cached.isHistorical) {
			const oneYear = 365 * 24 * 60 * 60 * 1000;
			return age < oneYear;
		}

		// Recent data (rating update <30 days old): 7 day TTL
		const sevenDays = 7 * 24 * 60 * 60 * 1000;
		return age < sevenDays;
	}

	private isHistoricalData(data: any): boolean {
		if (!data || !data.lastRatingUpdate) {
			return false;
		}

		// Check the most recent rating update date
		const updateDate = new Date(data.lastRatingUpdate);
		const daysSinceUpdate = (Date.now() - updateDate.getTime()) / (24 * 60 * 60 * 1000);
		return daysSinceUpdate > 30;
	}

	private loadCache(): AnalystRatingsCacheData {
		if (!fs.existsSync(this.cachePath)) {
			return {};
		}
		try {
			const data = fs.readFileSync(this.cachePath, "utf-8");
			return JSON.parse(data);
		} catch (error) {
			console.warn("Failed to load analyst ratings cache, starting fresh");
			return {};
		}
	}

	private saveCache(cache: AnalystRatingsCacheData): void {
		fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), "utf-8");
	}

	clearAll(): void {
		if (fs.existsSync(this.cachePath)) {
			fs.unlinkSync(this.cachePath);
			console.log("🗑️  Analyst ratings cache cleared");
		}
	}

	clearSymbol(symbol: string): void {
		const cache = this.loadCache();
		delete cache[symbol];
		this.saveCache(cache);
		console.log(`🗑️  Cleared analyst ratings cache for ${symbol}`);
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
