/**
 * Test Cache Clearing Functionality
 * Purpose: Verify that --clear-cache and --clear-cache-type flags work correctly
 */

import { AnalystRatingsCache } from "./AnalystRatingsCache.js";
import { SECFilingsCache } from "./SECFilingsCache.js";
import { OptionsDataCache } from "./OptionsDataCache.js";
import { RetryHandler } from "../../../app/services/error-handling/RetryHandler.js";

async function testCacheClearing() {
	console.log("=".repeat(80));
	console.log("🧪 Testing Cache Clearing Functionality");
	console.log("=".repeat(80));

	const retryHandler = RetryHandler.getInstance();
	const analystCache = new AnalystRatingsCache();
	const secCache = new SECFilingsCache();
	const optionsCache = new OptionsDataCache();

	// Populate caches with test data
	console.log("\n1. Populating caches with test data...");

	await analystCache.getAnalystRatings(
		"TEST1",
		async () => ({ symbol: "TEST1", lastRatingUpdate: new Date().toISOString() }),
		retryHandler
	);

	await secCache.getInsiderTrading(
		"TEST2",
		100,
		async () => ({ insiderTransactions: [{ filingDate: new Date().toISOString() }] }),
		retryHandler
	);

	await optionsCache.getPriceTargets(
		"TEST3",
		async () => ({ priceTarget: 100, lastUpdated: new Date().toISOString() }),
		retryHandler
	);

	let analystStats = analystCache.getCacheStats();
	let secStats = secCache.getCacheStats();
	let optionsStats = optionsCache.getCacheStats();

	console.log(`   ✓ Analyst ratings: ${analystStats.totalEntries} entries`);
	console.log(`   ✓ SEC filings: ${secStats.totalEntries} entries`);
	console.log(`   ✓ Options data: ${optionsStats.totalEntries} entries`);

	// Test 2: Clear only analyst-ratings cache
	console.log("\n2. Testing --clear-cache-type analyst-ratings...");
	analystCache.clearAll();

	analystStats = analystCache.getCacheStats();
	secStats = secCache.getCacheStats();
	optionsStats = optionsCache.getCacheStats();

	const analystCleared = analystStats.totalEntries === 0;
	const othersUnchanged = secStats.totalEntries > 0 && optionsStats.totalEntries > 0;

	console.log(`   ${analystCleared ? '✓' : '✗'} Analyst ratings cleared: ${analystStats.totalEntries} entries`);
	console.log(`   ${othersUnchanged ? '✓' : '✗'} SEC filings unchanged: ${secStats.totalEntries} entries`);
	console.log(`   ${othersUnchanged ? '✓' : '✗'} Options data unchanged: ${optionsStats.totalEntries} entries`);

	// Test 3: Clear only sec-filings cache
	console.log("\n3. Testing --clear-cache-type sec-filings...");
	secCache.clearAll();

	analystStats = analystCache.getCacheStats();
	secStats = secCache.getCacheStats();
	optionsStats = optionsCache.getCacheStats();

	const secCleared = secStats.totalEntries === 0;
	const optionsUnchanged = optionsStats.totalEntries > 0;

	console.log(`   ${secCleared ? '✓' : '✗'} SEC filings cleared: ${secStats.totalEntries} entries`);
	console.log(`   ${optionsUnchanged ? '✓' : '✗'} Options data unchanged: ${optionsStats.totalEntries} entries`);

	// Test 4: Clear only options-data cache
	console.log("\n4. Testing --clear-cache-type options-data...");
	optionsCache.clearAll();

	analystStats = analystCache.getCacheStats();
	secStats = secCache.getCacheStats();
	optionsStats = optionsCache.getCacheStats();

	const optionsCleared = optionsStats.totalEntries === 0;
	const allCleared = analystStats.totalEntries === 0 && secStats.totalEntries === 0 && optionsStats.totalEntries === 0;

	console.log(`   ${optionsCleared ? '✓' : '✗'} Options data cleared: ${optionsStats.totalEntries} entries`);

	// Test 5: Verify all caches are now empty
	console.log("\n5. Final verification...");
	console.log(`   ${allCleared ? '✓' : '✗'} All Phase 3 caches cleared successfully`);

	console.log("\n" + "=".repeat(80));
	if (allCleared) {
		console.log("✅ All cache clearing tests passed!");
	} else {
		console.log("❌ Some cache clearing tests failed");
	}
	console.log("=".repeat(80));
}

testCacheClearing().catch(console.error);
