/**
 * Macroeconomic Data Cache
 * Purpose: Cache historical macroeconomic data (Fed rate, unemployment, CPI, GDP, Treasury yields)
 * Pattern: Follows OHLCVCache implementation with tiered TTL based on data age
 *
 * Caches 5 macroeconomic indicators fetched from FRED, BLS, and FMP APIs:
 * - Federal Funds Rate (FMP)
 * - Unemployment Rate (BLS)
 * - CPI (FRED)
 * - GDP (FRED)
 * - 10Y Treasury Yield (FRED)
 *
 * TTL Strategy:
 * - Historical data (>30 days): 1 year (data never changes)
 * - Recent data (<30 days): 1 day (may get revised)
 */

import * as fs from "fs";
import * as path from "path";
import type { RetryHandler } from "../../../app/services/error-handling/RetryHandler.js";

interface MacroDataPoint {
	value: string | number;
	date?: string;
}

interface MacroeconomicDataCacheEntry {
	date: string;
	data: {
		fedRate: MacroDataPoint | null;
		unemployment: MacroDataPoint | null;
		cpi: MacroDataPoint | null;
		gdp: MacroDataPoint | null;
		treasuryYield: MacroDataPoint | null;
	};
	timestamp: number;
	version: string;
	isHistorical: boolean;
}

interface MacroeconomicDataCacheMap {
	[key: string]: MacroeconomicDataCacheEntry; // key: "YYYY-MM" (monthly)
}

export class MacroeconomicDataCache {
	private cacheDir = path.join(process.cwd(), "data", "cache", "macroeconomic");
	private cachePath = path.join(this.cacheDir, "macroeconomic-cache.json");

	constructor() {
		if (!fs.existsSync(this.cacheDir)) {
			fs.mkdirSync(this.cacheDir, { recursive: true });
		}
	}

	/**
	 * Get macroeconomic data with tiered TTL caching
	 * @param asOfDate Date for which to get macroeconomic data
	 * @param fetchFn Function to fetch data from APIs
	 * @param retryHandler Retry handler for API calls
	 */
	async getMacroeconomicData(
		asOfDate: Date,
		fetchFn: () => Promise<{
			fedRate: MacroDataPoint | null;
			unemployment: MacroDataPoint | null;
			cpi: MacroDataPoint | null;
			gdp: MacroDataPoint | null;
			treasuryYield: MacroDataPoint | null;
		}>,
		retryHandler: RetryHandler
	): Promise<{
		fedRate: MacroDataPoint | null;
		unemployment: MacroDataPoint | null;
		cpi: MacroDataPoint | null;
		gdp: MacroDataPoint | null;
		treasuryYield: MacroDataPoint | null;
	}> {
		const cache = this.loadCache();
		const key = this.getCacheKey(asOfDate);
		const cached = cache[key];

		// Check cache validity with tiered TTL
		if (cached && this.isCacheValid(cached)) {
			const age = Math.round((Date.now() - cached.timestamp) / (24 * 60 * 60 * 1000));
			console.log(`  📦 Using cached macroeconomic data for ${key} (${age}d old, ${cached.isHistorical ? 'historical' : 'recent'})`);
			return cached.data;
		}

		// Fetch from APIs with retry logic
		console.log(`  🌐 Fetching macroeconomic data from APIs for ${key}`);
		const data = await retryHandler.withExponentialBackoff(
			fetchFn,
			5,
			1000
		);

		// Determine if data is historical (>30 days old)
		const isHistorical = this.isHistoricalData(asOfDate);

		// Cache the data
		cache[key] = {
			date: key,
			data,
			timestamp: Date.now(),
			version: "v1.0.0",
			isHistorical
		};
		this.saveCache(cache);

		return data;
	}

	/**
	 * Generate cache key from date
	 * KISS FIX: Use YYYY-MM (month) instead of YYYY-MM-DD (day)
	 * Reason: CPI, unemployment, GDP are monthly/quarterly data
	 * This reduces cache misses from ~4,500 to ~24 (one per month)
	 */
	private getCacheKey(asOfDate: Date): string {
		const year = asOfDate.getFullYear();
		const month = String(asOfDate.getMonth() + 1).padStart(2, '0');
		return `${year}-${month}`; // YYYY-MM (monthly key)
	}

	/**
	 * Check if cached data is still valid based on tiered TTL
	 */
	private isCacheValid(cached: MacroeconomicDataCacheEntry): boolean {
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

	/**
	 * Determine if data is historical (>30 days old)
	 */
	private isHistoricalData(asOfDate: Date): boolean {
		const daysSinceDate = (Date.now() - asOfDate.getTime()) / (24 * 60 * 60 * 1000);
		return daysSinceDate > 30;
	}

	/**
	 * Load cache from disk
	 */
	private loadCache(): MacroeconomicDataCacheMap {
		if (!fs.existsSync(this.cachePath)) {
			return {};
		}
		try {
			const data = fs.readFileSync(this.cachePath, "utf-8");
			return JSON.parse(data);
		} catch (error) {
			console.warn("Failed to load macroeconomic cache, starting fresh");
			return {};
		}
	}

	/**
	 * Save cache to disk
	 */
	private saveCache(cache: MacroeconomicDataCacheMap): void {
		fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), "utf-8");
	}

	/**
	 * Clear specific date from cache
	 */
	clearDate(asOfDate: Date): void {
		const cache = this.loadCache();
		const key = this.getCacheKey(asOfDate);
		if (cache[key]) {
			delete cache[key];
			this.saveCache(cache);
			console.log(`  🗑️  Cleared macroeconomic cache entry for ${key}`);
		}
	}

	/**
	 * Clear all macroeconomic cache
	 */
	clearAll(): void {
		if (fs.existsSync(this.cachePath)) {
			fs.unlinkSync(this.cachePath);
			console.log("  🗑️  Cleared all macroeconomic cache");
		}
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): { totalEntries: number; historicalEntries: number; recentEntries: number; totalSize: string } {
		const cache = this.loadCache();
		const entries = Object.values(cache);
		const historicalEntries = entries.filter(e => e.isHistorical).length;
		const recentEntries = entries.filter(e => !e.isHistorical).length;

		let totalSize = "0 KB";
		if (fs.existsSync(this.cachePath)) {
			const stats = fs.statSync(this.cachePath);
			totalSize = `${(stats.size / 1024).toFixed(2)} KB`;
		}

		return {
			totalEntries: entries.length,
			historicalEntries,
			recentEntries,
			totalSize
		};
	}
}
