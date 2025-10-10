/**
 * Historical Data Cache - File-based permanent cache for immutable historical data
 *
 * IMPORTANT: Historical data NEVER changes. Once cached, it's stored forever.
 * This eliminates redundant API calls during training dataset generation.
 *
 * Cache Strategy:
 * - Training Mode: Check cache first → API call if miss → Store forever
 * - Production Mode: Redis cache (15-min or 24h TTL depending on data type)
 */

import * as fs from "fs/promises";
import * as path from "path";
import { createApiErrorHandler } from "../error-handling";

export type CacheDataType = "news" | "analyst" | "macro" | "ohlcv" | "options";

export interface CacheEntry<T = any> {
	symbol: string;
	date: string; // YYYY-MM-DD format
	dataType: CacheDataType;
	data: T;
	cachedAt: number;
	source: string;
}

export interface YearlyCacheEntry<T = any> {
	symbol: string;
	year: number;
	dataType: CacheDataType;
	data: T[];
	cachedAt: number;
	source: string;
	startDate: string; // YYYY-MM-DD
	endDate: string; // YYYY-MM-DD
}

export interface CacheStats {
	hits: number;
	misses: number;
	size: number; // Total cache size in bytes
	entryCount: number;
}

/**
 * File-based cache for historical financial data
 * Uses simple JSON files organized by data type, symbol, and date
 */
export class HistoricalDataCache {
	private static instance: HistoricalDataCache;
	private errorHandler = createApiErrorHandler("historical-cache");
	private baseDir: string;
	private stats: CacheStats = {
		hits: 0,
		misses: 0,
		size: 0,
		entryCount: 0,
	};

	private constructor(baseDir?: string) {
		this.baseDir = baseDir || path.join(process.cwd(), "data", "cache", "historical");
		this.ensureCacheDirectories();
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(baseDir?: string): HistoricalDataCache {
		if (!HistoricalDataCache.instance) {
			HistoricalDataCache.instance = new HistoricalDataCache(baseDir);
		}
		return HistoricalDataCache.instance;
	}

	/**
	 * Ensure cache directory structure exists
	 */
	private async ensureCacheDirectories(): Promise<void> {
		const dataTypes: CacheDataType[] = ["news", "analyst", "macro", "ohlcv", "options"];

		try {
			// Create base directory
			await fs.mkdir(this.baseDir, { recursive: true });

			// Create subdirectories for each data type
			for (const dataType of dataTypes) {
				const typeDir = path.join(this.baseDir, dataType);
				await fs.mkdir(typeDir, { recursive: true });

				// Create yearly subdirectory
				const yearlyDir = path.join(this.baseDir, dataType, "yearly");
				await fs.mkdir(yearlyDir, { recursive: true });
			}

			this.errorHandler.logger.debug("Historical cache directories initialized", {
				baseDir: this.baseDir,
			});
		} catch (error) {
			this.errorHandler.logger.error("Failed to create cache directories", error);
		}
	}

	/**
	 * Generate cache file path
	 */
	private getCacheFilePath(dataType: CacheDataType, symbol: string, date: string): string {
		// Sanitize symbol (remove special characters)
		const sanitizedSymbol = symbol.replace(/[^a-zA-Z0-9]/g, "_");
		const fileName = `${sanitizedSymbol}_${date}.json`;
		return path.join(this.baseDir, dataType, fileName);
	}

	/**
	 * Check if data exists in cache
	 */
	async has(dataType: CacheDataType, symbol: string, date: string): Promise<boolean> {
		try {
			const filePath = this.getCacheFilePath(dataType, symbol, date);
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get data from cache
	 *
	 * @returns Cached data or null if not found
	 */
	async get<T = any>(
		dataType: CacheDataType,
		symbol: string,
		date: string
	): Promise<T | null> {
		try {
			const filePath = this.getCacheFilePath(dataType, symbol, date);
			const fileContent = await fs.readFile(filePath, "utf-8");
			const entry: CacheEntry<T> = JSON.parse(fileContent);

			this.stats.hits++;

			this.errorHandler.logger.debug("Historical cache HIT", {
				dataType,
				symbol,
				date,
				source: entry.source,
			});

			return entry.data;
		} catch (error) {
			this.stats.misses++;

			this.errorHandler.logger.debug("Historical cache MISS", {
				dataType,
				symbol,
				date,
			});

			return null;
		}
	}

	/**
	 * Store data in cache permanently
	 *
	 * @param dataType Type of data being cached
	 * @param symbol Stock symbol
	 * @param date Date in YYYY-MM-DD format
	 * @param data Data to cache
	 * @param source Data source identifier (e.g., "polygon", "fmp")
	 */
	async set<T = any>(
		dataType: CacheDataType,
		symbol: string,
		date: string,
		data: T,
		source: string
	): Promise<void> {
		try {
			const filePath = this.getCacheFilePath(dataType, symbol, date);

			const entry: CacheEntry<T> = {
				symbol,
				date,
				dataType,
				data,
				cachedAt: Date.now(),
				source,
			};

			const content = JSON.stringify(entry, null, 2);
			await fs.writeFile(filePath, content, "utf-8");

			this.stats.entryCount++;
			this.stats.size += content.length;

			this.errorHandler.logger.debug("Historical cache SET", {
				dataType,
				symbol,
				date,
				source,
				sizeKB: (content.length / 1024).toFixed(2),
			});
		} catch (error) {
			this.errorHandler.logger.error("Failed to write to historical cache", {
				error,
				dataType,
				symbol,
				date,
			});
		}
	}

	/**
	 * Get data with fallback to API call
	 * Cache-first pattern: Check cache → Call API if miss → Store result
	 *
	 * @param dataType Type of data
	 * @param symbol Stock symbol
	 * @param date Date in YYYY-MM-DD format
	 * @param apiCall Function to call API if cache miss
	 * @param source Source identifier for cache entry
	 * @returns Cached or freshly fetched data
	 */
	async getOrFetch<T = any>(
		dataType: CacheDataType,
		symbol: string,
		date: string,
		apiCall: () => Promise<T | null>,
		source: string
	): Promise<T | null> {
		// Check cache first
		const cached = await this.get<T>(dataType, symbol, date);
		if (cached !== null) {
			return cached;
		}

		// Cache miss - call API
		this.errorHandler.logger.info(`Historical cache MISS: ${symbol} - calling ${source} API`, {
			dataType,
			symbol,
			date,
		});

		const data = await apiCall();

		// Store in cache if successful
		if (data !== null && data !== undefined) {
			await this.set(dataType, symbol, date, data, source);
		}

		return data;
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats {
		return { ...this.stats };
	}

	/**
	 * Get cache hit rate
	 */
	getHitRate(): number {
		const total = this.stats.hits + this.stats.misses;
		return total > 0 ? this.stats.hits / total : 0;
	}

	/**
	 * Clear cache for a specific data type (use with caution!)
	 */
	async clear(dataType: CacheDataType): Promise<void> {
		try {
			const typeDir = path.join(this.baseDir, dataType);
			await fs.rm(typeDir, { recursive: true, force: true });
			await fs.mkdir(typeDir, { recursive: true });

			this.errorHandler.logger.warn("Historical cache cleared", { dataType });
		} catch (error) {
			this.errorHandler.logger.error("Failed to clear cache", { error, dataType });
		}
	}

	/**
	 * List all cached symbols for a data type
	 */
	async listSymbols(dataType: CacheDataType): Promise<string[]> {
		try {
			const typeDir = path.join(this.baseDir, dataType);
			const files = await fs.readdir(typeDir);

			const symbols = new Set<string>();
			files.forEach((file) => {
				const symbol = file.split("_")[0];
				symbols.add(symbol);
			});

			return Array.from(symbols).sort();
		} catch (error) {
			this.errorHandler.logger.error("Failed to list symbols", { error, dataType });
			return [];
		}
	}

	/**
	 * Get cache size in MB
	 */
	async getCacheSize(): Promise<number> {
		try {
			let totalSize = 0;

			const dataTypes: CacheDataType[] = ["news", "analyst", "macro", "ohlcv", "options"];

			for (const dataType of dataTypes) {
				const typeDir = path.join(this.baseDir, dataType);
				try {
					const files = await fs.readdir(typeDir);
					for (const file of files) {
						const filePath = path.join(typeDir, file);
						const stats = await fs.stat(filePath);
						totalSize += stats.size;
					}
				} catch {
					// Directory might not exist yet
					continue;
				}
			}

			return totalSize / (1024 * 1024); // Convert to MB
		} catch (error) {
			this.errorHandler.logger.error("Failed to calculate cache size", error);
			return 0;
		}
	}

	// ========================================================================
	// YEARLY CACHING METHODS
	// ========================================================================

	/**
	 * Generate yearly cache file path
	 */
	private getYearlyCacheFilePath(dataType: CacheDataType, symbol: string, year: number): string {
		const sanitizedSymbol = symbol.replace(/[^a-zA-Z0-9]/g, "_");
		const fileName = `${sanitizedSymbol}_${year}.json`;
		return path.join(this.baseDir, dataType, "yearly", fileName);
	}

	/**
	 * Get yearly data from cache
	 */
	async getYearly<T = any>(
		dataType: CacheDataType,
		symbol: string,
		year: number
	): Promise<T[] | null> {
		try {
			const filePath = this.getYearlyCacheFilePath(dataType, symbol, year);
			const fileContent = await fs.readFile(filePath, "utf-8");
			const entry: YearlyCacheEntry<T> = JSON.parse(fileContent);

			this.stats.hits++;

			this.errorHandler.logger.debug("Yearly cache HIT", {
				dataType,
				symbol,
				year,
				source: entry.source,
				itemCount: entry.data.length,
			});

			return entry.data;
		} catch (error) {
			this.stats.misses++;

			this.errorHandler.logger.debug("Yearly cache MISS", {
				dataType,
				symbol,
				year,
			});

			return null;
		}
	}

	/**
	 * Store yearly data in cache
	 */
	async setYearly<T = any>(
		dataType: CacheDataType,
		symbol: string,
		year: number,
		data: T[],
		source: string
	): Promise<void> {
		try {
			const filePath = this.getYearlyCacheFilePath(dataType, symbol, year);

			const entry: YearlyCacheEntry<T> = {
				symbol,
				year,
				dataType,
				data,
				cachedAt: Date.now(),
				source,
				startDate: `${year}-01-01`,
				endDate: `${year}-12-31`,
			};

			const content = JSON.stringify(entry, null, 2);
			await fs.writeFile(filePath, content, "utf-8");

			this.stats.entryCount++;
			this.stats.size += content.length;

			this.errorHandler.logger.debug("Yearly cache SET", {
				dataType,
				symbol,
				year,
				source,
				itemCount: data.length,
				sizeKB: (content.length / 1024).toFixed(2),
			});
		} catch (error) {
			this.errorHandler.logger.error("Failed to write yearly cache", {
				error,
				dataType,
				symbol,
				year,
			});
		}
	}

	/**
	 * Get data across multiple years with fallback to API
	 * Yearly cache-first pattern: Check each year's cache → Fetch missing years
	 *
	 * @param dataType Type of data
	 * @param symbol Stock symbol
	 * @param startDate Start date in YYYY-MM-DD format
	 * @param endDate End date in YYYY-MM-DD format
	 * @param apiCallPerYear Function to call API for each missing year (year, start, end) => Promise<T[]>
	 * @param source Source identifier for cache entry
	 * @returns Combined data from all years
	 */
	async getOrFetchYearly<T = any>(
		dataType: CacheDataType,
		symbol: string,
		startDate: string,
		endDate: string,
		apiCallPerYear: (year: number, start: string, end: string) => Promise<T[] | null>,
		source: string
	): Promise<T[]> {
		const startYear = parseInt(startDate.split("-")[0]);
		const endYear = parseInt(endDate.split("-")[0]);

		const allData: T[] = [];

		for (let year = startYear; year <= endYear; year++) {
			// Check yearly cache first
			const cachedYearData = await this.getYearly<T>(dataType, symbol, year);

			if (cachedYearData !== null) {
				// Filter data by actual date range
				const filtered = this.filterDataByDateRange(
					cachedYearData,
					startDate,
					endDate,
					year
				);
				allData.push(...filtered);
			} else {
				// Cache miss - fetch this year from API
				this.errorHandler.logger.info(
					`Yearly cache MISS: ${symbol} ${year} - calling ${source} API`,
					{
						dataType,
						symbol,
						year,
					}
				);

				const yearStart = year === startYear ? startDate : `${year}-01-01`;
				const yearEnd = year === endYear ? endDate : `${year}-12-31`;

				const yearData = await apiCallPerYear(year, yearStart, yearEnd);

				if (yearData && yearData.length > 0) {
					// Store full year in cache (even if we only need partial)
					await this.setYearly(dataType, symbol, year, yearData, source);
					allData.push(...yearData);
				}
			}
		}

		return allData;
	}

	/**
	 * Filter array data by date range
	 * Assumes data items have a 'date' or 'published_utc' or 'timestamp' field
	 */
	private filterDataByDateRange<T = any>(
		data: T[],
		startDate: string,
		endDate: string,
		year: number
	): T[] {
		const start = new Date(startDate);
		const end = new Date(endDate);

		return data.filter((item: any) => {
			// Try different date field names
			const dateStr =
				item.date || item.published_utc || (item.timestamp && new Date(item.timestamp).toISOString());

			if (!dateStr) {
				// If no date field, assume it's within the year
				return true;
			}

			const itemDate = new Date(dateStr);
			return itemDate >= start && itemDate <= end;
		});
	}

	/**
	 * Check if yearly cache exists for a specific year
	 */
	async hasYearly(dataType: CacheDataType, symbol: string, year: number): Promise<boolean> {
		try {
			const filePath = this.getYearlyCacheFilePath(dataType, symbol, year);
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}
}

// Singleton export
export const historicalCache = HistoricalDataCache.getInstance();
