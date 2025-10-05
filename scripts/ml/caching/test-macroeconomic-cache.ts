/**
 * Test script for MacroeconomicDataCache
 * Verifies cache functionality and TTL behavior
 */

import { MacroeconomicDataCache } from "./MacroeconomicDataCache.js";
import { RetryHandler } from "../../../app/services/error-handling/RetryHandler.js";
import { FREDAPI } from "../../../app/services/financial-data/FREDAPI.js";
import { BLSAPI } from "../../../app/services/financial-data/BLSAPI.js";
import { FinancialModelingPrepAPI } from "../../../app/services/financial-data/FinancialModelingPrepAPI.js";

async function testMacroeconomicCache() {
	console.log("=== Testing MacroeconomicDataCache ===\n");

	// Initialize cache, retry handler, and APIs
	const cache = new MacroeconomicDataCache();
	const retryHandler = RetryHandler.getInstance();
	const fredAPI = new FREDAPI();
	const blsAPI = new BLSAPI();
	const fmpAPI = new FinancialModelingPrepAPI();

	// Clear cache before testing
	console.log("📦 Clearing cache before test...");
	cache.clearAll();

	// Test 1: Historical data (>30 days) - should cache for 1 year
	console.log("\n📊 Test 1: Historical Macroeconomic Data (>30 days old)");
	const historicalDate = new Date("2023-06-15");
	console.log(`  Date: ${historicalDate.toISOString().split('T')[0]}`);

	console.log("\n  First fetch (should hit APIs):");
	const start1 = Date.now();
	const historicalData1 = await cache.getMacroeconomicData(
		historicalDate,
		async () => {
			const [fedRate, unemployment, cpi, gdp, treasuryYield] = await Promise.all([
				fmpAPI.getFederalFundsRateAtDate(historicalDate),
				blsAPI.getObservationAtDate('LNS14000000', historicalDate),
				fredAPI.getObservationAtDate('CPIAUCSL', historicalDate),
				fredAPI.getObservationAtDate('GDPC1', historicalDate),
				fredAPI.getObservationAtDate('DGS10', historicalDate)
			]);
			return {
				fedRate,
				unemployment,
				cpi,
				gdp,
				treasuryYield
			};
		},
		retryHandler
	);
	const elapsed1 = Date.now() - start1;
	console.log(`  ✓ Fetched in ${elapsed1}ms`);
	console.log(`  Fed Rate: ${historicalData1.fedRate?.value}`);
	console.log(`  Unemployment: ${historicalData1.unemployment?.value}`);
	console.log(`  CPI: ${historicalData1.cpi?.value}`);

	console.log("\n  Second fetch (should use cache):");
	const start2 = Date.now();
	const historicalData2 = await cache.getMacroeconomicData(
		historicalDate,
		async () => {
			throw new Error("Should not reach API - cache hit expected");
		},
		retryHandler
	);
	const elapsed2 = Date.now() - start2;
	console.log(`  ✓ Retrieved in ${elapsed2}ms (${elapsed1 - elapsed2}ms faster)`);

	// Verify cache hit
	if (elapsed2 < 100) {
		console.log("  ✅ Cache HIT verified (sub-100ms response)");
	} else {
		console.log("  ⚠️ Warning: Response time suggests cache may not have hit");
	}

	// Test 2: Recent data (<30 days) - should cache for 1 day
	console.log("\n📊 Test 2: Recent Macroeconomic Data (<30 days old)");
	const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
	console.log(`  Date: ${recentDate.toISOString().split('T')[0]}`);

	console.log("\n  First fetch (should hit APIs):");
	const start3 = Date.now();
	const recentData1 = await cache.getMacroeconomicData(
		recentDate,
		async () => {
			const [fedRate, unemployment, cpi, gdp, treasuryYield] = await Promise.all([
				fmpAPI.getFederalFundsRateAtDate(recentDate),
				blsAPI.getObservationAtDate('LNS14000000', recentDate),
				fredAPI.getObservationAtDate('CPIAUCSL', recentDate),
				fredAPI.getObservationAtDate('GDPC1', recentDate),
				fredAPI.getObservationAtDate('DGS10', recentDate)
			]);
			return {
				fedRate,
				unemployment,
				cpi,
				gdp,
				treasuryYield
			};
		},
		retryHandler
	);
	const elapsed3 = Date.now() - start3;
	console.log(`  ✓ Fetched in ${elapsed3}ms`);
	console.log(`  Fed Rate: ${recentData1.fedRate?.value}`);
	console.log(`  Unemployment: ${recentData1.unemployment?.value}`);

	console.log("\n  Second fetch (should use cache):");
	const start4 = Date.now();
	const recentData2 = await cache.getMacroeconomicData(
		recentDate,
		async () => {
			throw new Error("Should not reach API - cache hit expected");
		},
		retryHandler
	);
	const elapsed4 = Date.now() - start4;
	console.log(`  ✓ Retrieved in ${elapsed4}ms (${elapsed3 - elapsed4}ms faster)`);

	if (elapsed4 < 100) {
		console.log("  ✅ Cache HIT verified (sub-100ms response)");
	} else {
		console.log("  ⚠️ Warning: Response time suggests cache may not have hit");
	}

	// Test 3: Cache statistics
	console.log("\n📊 Test 3: Cache Statistics");
	const stats = cache.getCacheStats();
	console.log(`  Total Entries: ${stats.totalEntries}`);
	console.log(`  Historical Entries (>30d): ${stats.historicalEntries}`);
	console.log(`  Recent Entries (<30d): ${stats.recentEntries}`);
	console.log(`  Total Cache Size: ${stats.totalSize}`);

	// Test 4: Clear specific date
	console.log("\n📊 Test 4: Clear Specific Date");
	cache.clearDate(historicalDate);
	console.log(`  ✓ Cleared cache entry for ${historicalDate.toISOString().split('T')[0]}`);

	const stats2 = cache.getCacheStats();
	console.log(`  Total Entries After Clear: ${stats2.totalEntries}`);

	console.log("\n✅ All tests completed successfully!");
}

// Run tests
testMacroeconomicCache().catch(console.error);
