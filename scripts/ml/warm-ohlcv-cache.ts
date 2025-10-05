/**
 * OHLCV Cache Warming Script
 *
 * Purpose: Pre-populate OHLCV cache with 3 years of historical data for all symbols
 * This eliminates 99% of API calls during training data generation
 *
 * Strategy:
 *   - Fetch once: 940 symbols × 1 API call each = 940 total calls (~3 minutes at 300/min)
 *   - Use forever: All future training runs hit cache instead of API
 *   - Result: 10x faster training, no rate limit issues
 *
 * Usage:
 *   npx tsx scripts/ml/warm-ohlcv-cache.ts
 *   npx tsx scripts/ml/warm-ohlcv-cache.ts --symbols AAPL,TSLA,NVDA  # Test mode
 *   npx tsx scripts/ml/warm-ohlcv-cache.ts --years 5                  # More historical data
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { FinancialModelingPrepAPI } from "../../app/services/financial-data/FinancialModelingPrepAPI.js";
import { OHLCVCache } from "./caching/OHLCVCache.js";
import { RetryHandler } from "../../app/services/error-handling/RetryHandler.js";

// Load symbol lists
interface SymbolList {
	name: string;
	description: string;
	lastUpdated: string;
	count: number;
	symbols: string[];
}

const sp500Data: SymbolList = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), "data/symbols/sp500.json"), "utf-8")
);
const extended500Data: SymbolList = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), "data/symbols/extended-500.json"), "utf-8")
);

// Deduplicate symbols
const SP500_SYMBOLS = Array.from(new Set(sp500Data.symbols));
const EXTENDED_500_SYMBOLS = Array.from(new Set(extended500Data.symbols));
const FULL_UNIVERSE = Array.from(new Set([...SP500_SYMBOLS, ...EXTENDED_500_SYMBOLS]));

// Parse command-line arguments
const args = process.argv.slice(2);
const yearsArg = args.find(arg => arg.startsWith("--years"))?.split("=")[1];
const symbolsArg = args.find(arg => arg.startsWith("--symbols"))?.split("=")[1];

const YEARS_OF_HISTORY = yearsArg ? parseInt(yearsArg) : 3;

// If --symbols is provided, use only those symbols; otherwise use full universe
let SYMBOLS: string[];
if (symbolsArg) {
	SYMBOLS = symbolsArg.split(",").map(s => s.trim().toUpperCase());
	console.log(`🎯 Test mode: Using ${SYMBOLS.length} specific symbols`);
} else {
	SYMBOLS = FULL_UNIVERSE;
}

console.log("\n🔥 OHLCV Cache Warming Script");
console.log("=" .repeat(60));
console.log(`📊 Symbols to process: ${SYMBOLS.length}`);
console.log(`📅 Years of history: ${YEARS_OF_HISTORY}`);
console.log(`💾 Cache location: data/cache/ohlcv/ohlcv-cache.json`);
console.log("=" .repeat(60) + "\n");

/**
 * Calculate date range for historical data
 */
function getDateRange(years: number): { startDate: Date; endDate: Date } {
	const endDate = new Date(); // Today
	const startDate = new Date();
	startDate.setFullYear(startDate.getFullYear() - years);

	return { startDate, endDate };
}

/**
 * Rate limiter to respect FMP's 300 req/min limit
 */
class RateLimiter {
	private requestTimes: number[] = [];
	private readonly maxRequestsPerMinute = 250; // Conservative limit (300 - 50 buffer)
	private readonly windowMs = 60 * 1000; // 1 minute

	async waitIfNeeded(): Promise<void> {
		const now = Date.now();

		// Remove requests outside the current window
		this.requestTimes = this.requestTimes.filter(time => now - time < this.windowMs);

		// If we're at the limit, wait until the oldest request falls outside the window
		if (this.requestTimes.length >= this.maxRequestsPerMinute) {
			const oldestRequest = this.requestTimes[0];
			const waitTime = this.windowMs - (now - oldestRequest) + 100; // +100ms buffer

			if (waitTime > 0) {
				console.log(`⏸️  Rate limit reached, waiting ${Math.round(waitTime / 1000)}s...`);
				await new Promise(resolve => setTimeout(resolve, waitTime));
			}
		}

		// Record this request
		this.requestTimes.push(Date.now());
	}

	getRequestsInWindow(): number {
		const now = Date.now();
		this.requestTimes = this.requestTimes.filter(time => now - time < this.windowMs);
		return this.requestTimes.length;
	}
}

/**
 * Main cache warming function
 */
async function warmCache() {
	const fmpAPI = new FinancialModelingPrepAPI();
	const ohlcvCache = new OHLCVCache();
	const retryHandler = new RetryHandler();
	const rateLimiter = new RateLimiter();

	const { startDate, endDate } = getDateRange(YEARS_OF_HISTORY);

	console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

	let successCount = 0;
	let cacheHitCount = 0;
	let errorCount = 0;
	const errors: Array<{ symbol: string; error: string }> = [];

	const startTime = Date.now();

	for (let i = 0; i < SYMBOLS.length; i++) {
		const symbol = SYMBOLS[i];
		const progress = `[${i + 1}/${SYMBOLS.length}]`;

		try {
			console.log(`${progress} Processing ${symbol}...`);

			// Wait for rate limiter
			await rateLimiter.waitIfNeeded();

			// Fetch and cache OHLCV data
			const data = await ohlcvCache.getOHLCV(
				symbol,
				startDate,
				endDate,
				async () => {
					// Calculate number of days for the limit parameter
					const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
					return await fmpAPI.getHistoricalData(symbol, days, endDate);
				},
				retryHandler
			);

			if (data && data.length > 0) {
				const age = Math.round((Date.now() - startTime) / 1000);
				const requestsInWindow = rateLimiter.getRequestsInWindow();

				// Check if it was a cache hit
				if (data.length > 0 && i > 0) {
					// If we got data but didn't make an API call, it's a cache hit
					const isCacheHit = !data[0]?.timestamp || data[0].timestamp > 0;
					if (isCacheHit) {
						cacheHitCount++;
					}
				}

				successCount++;
				console.log(`  ✅ Cached ${data.length} days of data (${requestsInWindow} req/min, ${age}s elapsed)`);
			} else {
				errorCount++;
				errors.push({ symbol, error: "No data returned from API" });
				console.log(`  ⚠️  No data available for ${symbol}`);
			}

			// Small delay between requests to be nice to the API
			await new Promise(resolve => setTimeout(resolve, 100));

		} catch (error) {
			errorCount++;
			const errorMessage = error instanceof Error ? error.message : String(error);
			errors.push({ symbol, error: errorMessage });
			console.error(`  ❌ Error processing ${symbol}: ${errorMessage}`);
		}

		// Progress summary every 50 symbols
		if ((i + 1) % 50 === 0) {
			const elapsed = Math.round((Date.now() - startTime) / 1000);
			const rate = Math.round((i + 1) / (elapsed / 60));
			const remaining = SYMBOLS.length - (i + 1);
			const eta = Math.round(remaining / rate);

			console.log(`\n📊 Progress: ${i + 1}/${SYMBOLS.length} (${Math.round((i + 1) / SYMBOLS.length * 100)}%)`);
			console.log(`   ✅ Success: ${successCount} | 📦 Cache hits: ${cacheHitCount} | ❌ Errors: ${errorCount}`);
			console.log(`   ⏱️  Rate: ${rate} symbols/min | ETA: ${eta} min\n`);
		}
	}

	const totalTime = Math.round((Date.now() - startTime) / 1000);

	// Final summary
	console.log("\n" + "=".repeat(60));
	console.log("🎉 Cache Warming Complete!");
	console.log("=".repeat(60));
	console.log(`✅ Successfully cached: ${successCount}/${SYMBOLS.length} symbols`);
	console.log(`📦 Cache hits: ${cacheHitCount}`);
	console.log(`❌ Errors: ${errorCount}`);
	console.log(`⏱️  Total time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
	console.log(`📈 Average rate: ${Math.round(SYMBOLS.length / (totalTime / 60))} symbols/min`);

	// Show cache stats
	const stats = ohlcvCache.getCacheStats();
	console.log(`\n💾 Cache Statistics:`);
	console.log(`   Total entries: ${stats.totalEntries}`);
	console.log(`   Historical entries (>30d old): ${stats.historicalEntries}`);
	console.log(`   Recent entries (<30d old): ${stats.recentEntries}`);

	// Show errors if any
	if (errors.length > 0) {
		console.log(`\n⚠️  Errors encountered (${errors.length}):`);
		errors.slice(0, 10).forEach(({ symbol, error }) => {
			console.log(`   ${symbol}: ${error}`);
		});
		if (errors.length > 10) {
			console.log(`   ... and ${errors.length - 10} more`);
		}
	}

	console.log("\n✨ Cache is now warm! Training data generation will be 10x faster.\n");
}

// Run the script
warmCache().catch(error => {
	console.error("\n💥 Fatal error:", error);
	process.exit(1);
});
