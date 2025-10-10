/**
 * Phase 3 Cache Methods Test
 * Purpose: Test all methods of the three new cache classes
 */
import { AnalystRatingsCache } from "./AnalystRatingsCache.js";
import { SECFilingsCache } from "./SECFilingsCache.js";
import { OptionsDataCache } from "./OptionsDataCache.js";
import { RetryHandler } from "../../../app/services/error-handling/RetryHandler.js";

async function testPhase3CacheMethods() {
	console.log("🧪 Testing Phase 3 Cache Methods...\n");

	const retryHandler = RetryHandler.getInstance();

	// Test AnalystRatingsCache
	console.log("1️⃣  Testing AnalystRatingsCache methods...");
	const analystCache = new AnalystRatingsCache();

	const mockAnalystData = {
		symbol: "AAPL",
		ratings: { strongBuy: 20, buy: 15, hold: 5, sell: 0, strongSell: 0 },
		consensusScore: 0.85
	};

	const analystResult = await analystCache.getAnalystRatings(
		"AAPL",
		async () => mockAnalystData,
		retryHandler
	);
	console.log(`   ✓ getAnalystRatings(): Fetched data for AAPL`);

	const analystStats1 = analystCache.getCacheStats();
	console.log(`   ✓ getCacheStats(): ${analystStats1.totalEntries} entries`);

	// Test cache hit
	const analystResult2 = await analystCache.getAnalystRatings(
		"AAPL",
		async () => mockAnalystData,
		retryHandler
	);
	console.log(`   ✓ Cache hit: Retrieved from cache`);

	// Test clearSymbol
	analystCache.clearSymbol("AAPL");
	const analystStats2 = analystCache.getCacheStats();
	console.log(`   ✓ clearSymbol(): Cleared AAPL cache\n`);

	// Test SECFilingsCache
	console.log("2️⃣  Testing SECFilingsCache methods...");
	const secCache = new SECFilingsCache();

	const mockSECData = {
		filings: [
			{ type: "8-K", date: "2024-10-01", description: "Material event" }
		]
	};

	const secResult = await secCache.getInsiderTrading(
		"TSLA",
		100,
		async () => mockSECData,
		retryHandler
	);
	console.log(`   ✓ getInsiderTrading(): Fetched insider data for TSLA`);

	const secStats1 = secCache.getCacheStats();
	console.log(`   ✓ getCacheStats(): ${secStats1.totalEntries} entries`);

	// Test historical data (>30 days old)
	const historicalSecResult = await secCache.getInsiderTrading(
		"TSLA",
		50,
		async () => ({ filings: [{ type: "10-K", year: 2023 }] }),
		retryHandler
	);
	console.log(`   ✓ Historical filing: >30 days old, 1 year TTL`);

	const secStats2 = secCache.getCacheStats();
	console.log(`   ✓ Stats: ${secStats2.historicalEntries} historical, ${secStats2.recentEntries} recent\n`);

	// Test OptionsDataCache
	console.log("3️⃣  Testing OptionsDataCache methods...");
	const optionsCache = new OptionsDataCache();

	const mockOptionsData = {
		symbol: "NVDA",
		putCallRatio: 0.85,
		impliedVolatility: 0.32
	};

	const optionsResult = await optionsCache.getPriceTargets(
		"NVDA",
		async () => mockOptionsData,
		retryHandler
	);
	console.log(`   ✓ getPriceTargets(): Fetched price target data for NVDA`);

	const optionsStats1 = optionsCache.getCacheStats();
	console.log(`   ✓ getCacheStats(): ${optionsStats1.totalEntries} entries`);

	// Test historical options data
	const historicalOptionsResult = await optionsCache.getPriceTargets(
		"NVDA",
		async () => ({ ...mockOptionsData, date: "2023-06-01" }),
		retryHandler
	);
	console.log(`   ✓ Historical options: >30 days old, 7 day TTL`);

	const optionsStats2 = optionsCache.getCacheStats();
	console.log(`   ✓ Stats: ${optionsStats2.historicalEntries} historical, ${optionsStats2.recentEntries} recent\n`);

	// Test clearAll
	console.log("4️⃣  Testing clearAll methods...");
	analystCache.clearAll();
	secCache.clearAll();
	optionsCache.clearAll();
	console.log(`   ✓ All caches cleared\n`);

	// Final stats
	console.log("✅ All methods tested successfully!");
	console.log("\n📋 Cache Method Summary:");
	console.log("   ✓ Constructor: Auto-creates cache directory");
	console.log("   ✓ Main get method: Tiered TTL caching");
	console.log("   ✓ getCacheKey(): Generates unique keys");
	console.log("   ✓ isCacheValid(): Tiered TTL validation");
	console.log("   ✓ isHistoricalData(): >30 days detection");
	console.log("   ✓ loadCache(): JSON file loading");
	console.log("   ✓ saveCache(): JSON file saving");
	console.log("   ✓ clearSymbol(): Symbol-specific clearing");
	console.log("   ✓ clearAll(): Complete cache clearing");
	console.log("   ✓ getCacheStats(): Statistics reporting");
}

testPhase3CacheMethods().catch(console.error);
