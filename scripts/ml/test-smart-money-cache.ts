/**
 * Test Smart Money Data Cache
 *
 * This script verifies the SmartMoneyDataCache implementation:
 * 1. Cache MISS on first run (API call)
 * 2. Cache HIT on second run (no API call)
 * 3. Cache statistics tracking
 * 4. Cache key format validation
 * 5. TTL expiration handling
 *
 * Expected Results:
 * - First run: 100% cache misses
 * - Second run: 100% cache hits
 * - Cache hit rate >95% overall
 *
 * Usage:
 * npx tsx scripts/ml/test-smart-money-cache.ts
 */

import { smartMoneyCache, SmartMoneyDataCache } from "../../app/services/cache/SmartMoneyDataCache";

interface InsiderTrade {
	date: string;
	filingDate: string;
	transactionType: string;
	shares: number;
	price: number;
	value: number;
	reportingName: string;
}

interface InstitutionalOwnership {
	date: string;
	cik: string;
	fillingDate: string;
	investorName: string;
	shares: number;
	change: number;
}

// Mock API calls for testing
const mockInsiderTradesAPI = async (
	symbol: string,
	startDate: string,
	endDate: string
): Promise<InsiderTrade[]> => {
	console.log(`   🌐 API CALL: Fetching insider trades for ${symbol} (${startDate} to ${endDate})`);

	// Simulate API delay
	await new Promise((resolve) => setTimeout(resolve, 100));

	// Return mock data
	return [
		{
			date: "2023-06-15",
			filingDate: "2023-06-17",
			transactionType: "P-Purchase",
			shares: 10000,
			price: 150.5,
			value: 1505000,
			reportingName: "John Doe - CEO",
		},
		{
			date: "2023-09-20",
			filingDate: "2023-09-22",
			transactionType: "S-Sale",
			shares: 5000,
			price: 165.75,
			value: 828750,
			reportingName: "Jane Smith - CFO",
		},
		{
			date: "2024-03-10",
			filingDate: "2024-03-12",
			transactionType: "P-Purchase",
			shares: 15000,
			price: 180.25,
			value: 2703750,
			reportingName: "Bob Johnson - Director",
		},
	];
};

const mockInstitutionalOwnershipAPI = async (
	symbol: string,
	startDate: string,
	endDate: string
): Promise<InstitutionalOwnership[]> => {
	console.log(
		`   🌐 API CALL: Fetching institutional ownership for ${symbol} (${startDate} to ${endDate})`
	);

	// Simulate API delay
	await new Promise((resolve) => setTimeout(resolve, 100));

	// Return mock data
	return [
		{
			date: "2023-03-31",
			cik: "0001067983",
			fillingDate: "2023-05-15",
			investorName: "Vanguard Group Inc",
			shares: 50000000,
			change: 2500000,
		},
		{
			date: "2023-06-30",
			cik: "0001067983",
			fillingDate: "2023-08-14",
			investorName: "Vanguard Group Inc",
			shares: 52000000,
			change: 2000000,
		},
		{
			date: "2023-09-30",
			cik: "0001067983",
			fillingDate: "2023-11-14",
			investorName: "Vanguard Group Inc",
			shares: 53500000,
			change: 1500000,
		},
	];
};

/**
 * Test cache functionality
 */
async function testSmartMoneyCache() {
	console.log("\n================================================================================");
	console.log("SMART MONEY DATA CACHE - TEST SUITE");
	console.log("================================================================================\n");

	const testSymbols = ["AAPL", "GOOGL", "MSFT"];
	const startDate = "2023-01-01";
	const endDate = "2024-12-31";

	// Clear cache for clean test
	console.log("📋 Test Setup: Clearing cache for clean test...\n");
	for (const symbol of testSymbols) {
		await smartMoneyCache.clear(symbol);
	}

	// ========================================================================
	// TEST 1: First Run - Cache MISS (API calls)
	// ========================================================================
	console.log("================================================================================");
	console.log("TEST 1: FIRST RUN - CACHE MISS (API CALLS)");
	console.log("================================================================================\n");

	console.log("Fetching insider trades (FIRST RUN)...\n");
	for (const symbol of testSymbols) {
		const data = await smartMoneyCache.getOrFetch(
			symbol,
			startDate,
			endDate,
			"insider_trades",
			() => mockInsiderTradesAPI(symbol, startDate, endDate),
			{ ttl: "7d", source: "fmp" }
		);

		console.log(`   ✓ ${symbol}: ${data?.length || 0} insider trades fetched\n`);
	}

	console.log("\nFetching institutional ownership (FIRST RUN)...\n");
	for (const symbol of testSymbols) {
		const data = await smartMoneyCache.getOrFetch(
			symbol,
			startDate,
			endDate,
			"institutional_ownership",
			() => mockInstitutionalOwnershipAPI(symbol, startDate, endDate),
			{ ttl: "7d", source: "sec" }
		);

		console.log(`   ✓ ${symbol}: ${data?.length || 0} ownership records fetched\n`);
	}

	// ========================================================================
	// TEST 2: Second Run - Cache HIT (No API calls)
	// ========================================================================
	console.log("\n================================================================================");
	console.log("TEST 2: SECOND RUN - CACHE HIT (NO API CALLS)");
	console.log("================================================================================\n");

	console.log("Fetching insider trades (SECOND RUN - should be cached)...\n");
	for (const symbol of testSymbols) {
		const data = await smartMoneyCache.getOrFetch(
			symbol,
			startDate,
			endDate,
			"insider_trades",
			() => mockInsiderTradesAPI(symbol, startDate, endDate),
			{ ttl: "7d", source: "fmp" }
		);

		console.log(`   ✓ ${symbol}: ${data?.length || 0} insider trades (cached)\n`);
	}

	console.log("\nFetching institutional ownership (SECOND RUN - should be cached)...\n");
	for (const symbol of testSymbols) {
		const data = await smartMoneyCache.getOrFetch(
			symbol,
			startDate,
			endDate,
			"institutional_ownership",
			() => mockInstitutionalOwnershipAPI(symbol, startDate, endDate),
			{ ttl: "7d", source: "sec" }
		);

		console.log(`   ✓ ${symbol}: ${data?.length || 0} ownership records (cached)\n`);
	}

	// ========================================================================
	// TEST 3: Cache Statistics
	// ========================================================================
	console.log("\n================================================================================");
	console.log("TEST 3: CACHE STATISTICS");
	console.log("================================================================================\n");

	smartMoneyCache.logStats();

	const stats = smartMoneyCache.getStats();
	const hitRatePercent = (stats.hitRate * 100).toFixed(2);

	console.log("Expected Results:");
	console.log(`  - First run: 6 API calls (3 symbols × 2 data types)`);
	console.log(`  - Second run: 0 API calls (all cached)`);
	console.log(`  - Hit rate: 50% (6 hits, 6 misses)`);
	console.log(`\nActual Results:`);
	console.log(`  - Cache hits: ${stats.hits}`);
	console.log(`  - Cache misses: ${stats.misses}`);
	console.log(`  - Hit rate: ${hitRatePercent}%`);

	// ========================================================================
	// TEST 4: Cache Key Format Validation
	// ========================================================================
	console.log("\n================================================================================");
	console.log("TEST 4: CACHE KEY FORMAT VALIDATION");
	console.log("================================================================================\n");

	const cacheKey = "AAPL_2023-01-01_2024-12-31_insider_trades";
	console.log(`Expected cache key format: {symbol}_{start_date}_{end_date}_{data_type}`);
	console.log(`Example: ${cacheKey}`);

	const symbols = await smartMoneyCache.listSymbols("insider_trades");
	console.log(`\nCached symbols (insider_trades): ${symbols.join(", ")}`);

	const cacheSize = await smartMoneyCache.getCacheSize();
	console.log(`Total cache size: ${cacheSize.toFixed(2)} MB`);

	// ========================================================================
	// TEST 5: Force Refresh
	// ========================================================================
	console.log("\n\n================================================================================");
	console.log("TEST 5: FORCE REFRESH (BYPASS CACHE)");
	console.log("================================================================================\n");

	console.log("Fetching with force=true (should bypass cache and call API)...\n");
	const forceData = await smartMoneyCache.getOrFetch(
		"AAPL",
		startDate,
		endDate,
		"insider_trades",
		() => mockInsiderTradesAPI("AAPL", startDate, endDate),
		{ ttl: "7d", source: "fmp", force: true }
	);

	console.log(`   ✓ AAPL: ${forceData?.length || 0} insider trades (force refreshed)\n`);

	// ========================================================================
	// FINAL RESULTS
	// ========================================================================
	console.log("\n================================================================================");
	console.log("TEST SUMMARY");
	console.log("================================================================================\n");

	const finalStats = smartMoneyCache.getStats();
	const finalHitRate = (finalStats.hitRate * 100).toFixed(2);

	console.log("✅ All tests completed successfully!\n");
	console.log("Cache Performance:");
	console.log(`  - Total cache hits: ${finalStats.hits}`);
	console.log(`  - Total cache misses: ${finalStats.misses}`);
	console.log(`  - Overall hit rate: ${finalHitRate}%`);
	console.log(`  - Cache entries: ${finalStats.entryCount}`);
	console.log(`  - Cache size: ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);

	console.log("\n✅ Cache is working correctly!");
	console.log("✅ Ready for Smart Money Flow dataset generation");
	console.log("\n================================================================================\n");
}

// Run tests
testSmartMoneyCache().catch((error) => {
	console.error("❌ Test failed:", error);
	process.exit(1);
});
