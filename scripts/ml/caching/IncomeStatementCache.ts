/**
 * Income Statement Data Cache
 * Purpose: Cache income statement data with tiered TTL (1 year for historical, 7 days for recent)
 * Pattern: Follows OHLCVCache implementation
 */
import * as fs from "fs";
import * as path from "path";
import type { RetryHandler } from "../../../app/services/error-handling/RetryHandler.js";

interface IncomeStatementCacheEntry {
	symbol: string;
	data: any[];
	timestamp: number;
	version: string;
	isHistorical: boolean;
	period: string;
	limit: number;
}

interface IncomeStatementCacheData {
	[key: string]: IncomeStatementCacheEntry; // key: "SYMBOL_PERIOD_LIMIT"
}

export class IncomeStatementCache {
	private cacheDir = path.join(process.cwd(), "data", "cache", "income-statements");
	private cachePath = path.join(this.cacheDir, "income-statement-cache.json");

	constructor() {
		if (!fs.existsSync(this.cacheDir)) {
			fs.mkdirSync(this.cacheDir, { recursive: true });
		}
	}

	/**
	 * Get income statement data with tiered TTL caching
	 */
	async getIncomeStatements(
		symbol: string,
		period: string,
		limit: number,
		fetchFn: () => Promise<any[]>,
		retryHandler: RetryHandler
	): Promise<any[]> {
		const cache = this.loadCache();
		const key = this.getCacheKey(symbol, period, limit);
		const cached = cache[key];

		// Check cache validity with tiered TTL
		if (cached && this.isCacheValid(cached)) {
			const age = Math.round((Date.now() - cached.timestamp) / (24 * 60 * 60 * 1000));
			console.log(`  📦 Using cached income statements for ${symbol} (${age}d old, ${cached.isHistorical ? 'historical' : 'recent'})`);
			return cached.data;
		}

		// Fetch from API with retry logic
		console.log(`  🌐 Fetching income statements from API for ${symbol} (${period}, limit: ${limit})`);
		const data = await retryHandler.withExponentialBackoff(
			fetchFn,
			5,
			1000
		) as any[];

		// Determine if data is historical (most recent quarter >30 days old)
		const isHistorical = this.isHistoricalData(data);

		// Cache the data
		cache[key] = {
			symbol,
			data,
			timestamp: Date.now(),
			version: "v1.0.0",
			isHistorical,
			period,
			limit
		};
		this.saveCache(cache);

		return data;
	}

	private getCacheKey(symbol: string, period: string, limit: number): string {
		return `${symbol}_${period}_${limit}`;
	}

	private isCacheValid(cached: IncomeStatementCacheEntry): boolean {
		const now = Date.now();
		const age = now - cached.timestamp;

		// Historical data (most recent quarter >30 days old): 1 year TTL
		if (cached.isHistorical) {
			const oneYear = 365 * 24 * 60 * 60 * 1000;
			return age < oneYear;
		}

		// Recent data (most recent quarter <30 days old): 7 day TTL
		const sevenDays = 7 * 24 * 60 * 60 * 1000;
		return age < sevenDays;
	}

	private isHistoricalData(data: any[]): boolean {
		if (!data || data.length === 0) {
			return false;
		}

		// Check the most recent quarter date
		const mostRecentQuarter = data[0];
		if (!mostRecentQuarter || !mostRecentQuarter.date) {
			return false;
		}

		const quarterDate = new Date(mostRecentQuarter.date);
		const daysSinceQuarter = (Date.now() - quarterDate.getTime()) / (24 * 60 * 60 * 1000);
		return daysSinceQuarter > 30;
	}

	private loadCache(): IncomeStatementCacheData {
		if (!fs.existsSync(this.cachePath)) {
			return {};
		}
		try {
			const data = fs.readFileSync(this.cachePath, "utf-8");
			return JSON.parse(data);
		} catch (error) {
			console.warn("Failed to load income statement cache, starting fresh");
			return {};
		}
	}

	private saveCache(cache: IncomeStatementCacheData): void {
		fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), "utf-8");
	}

	clearAll(): void {
		if (fs.existsSync(this.cachePath)) {
			fs.unlinkSync(this.cachePath);
			console.log("🗑️  Income statement cache cleared");
		}
	}

	clearSymbol(symbol: string): void {
		const cache = this.loadCache();
		const keysToDelete = Object.keys(cache).filter(key => key.startsWith(`${symbol}_`));
		keysToDelete.forEach(key => delete cache[key]);
		this.saveCache(cache);
		console.log(`🗑️  Cleared income statement cache for ${symbol} (${keysToDelete.length} entries)`);
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
