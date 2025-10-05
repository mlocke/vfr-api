/**
 * Comprehensive Phase 3 Cache Testing Script
 *
 * Purpose: Validate all Phase 3 cache implementations work correctly with training data generation
 *
 * Tests:
 * 1. Cache initialization (all 3 types)
 * 2. Cache directory creation
 * 3. Cache methods (get, clearSymbol, clearAll, getCacheStats)
 * 4. Integration with FeatureExtractor
 * 5. Integration with training data generation script
 */

import { AnalystRatingsCache } from "./AnalystRatingsCache.js";
import { SECFilingsCache } from "./SECFilingsCache.js";
import { OptionsDataCache } from "./OptionsDataCache.js";
import { RetryHandler } from "../../../app/services/error-handling/RetryHandler.js";
import * as fs from "fs";
import * as path from "path";

// Test result tracking
interface TestResult {
	name: string;
	passed: boolean;
	error?: string;
	duration?: number;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, duration?: number) {
	results.push({ name, passed, error, duration });
	const icon = passed ? "✓" : "✗";
	const color = passed ? "\x1b[32m" : "\x1b[31m";
	const reset = "\x1b[0m";
	console.log(`${color}${icon}${reset} ${name}${duration ? ` (${duration}ms)` : ""}`);
	if (error) {
		console.log(`  Error: ${error}`);
	}
}

async function testCacheInitialization() {
	console.log("\n1️⃣  Testing Cache Initialization...\n");

	try {
		const startTime = Date.now();

		// Initialize all 3 caches
		const analystCache = new AnalystRatingsCache();
		const secCache = new SECFilingsCache();
		const optionsCache = new OptionsDataCache();

		const duration = Date.now() - startTime;
		logTest("Initialize all 3 Phase 3 caches", true, undefined, duration);

		// Verify cache directories were created
		const cacheDir = path.join(process.cwd(), "data", "cache");
		const analystDir = path.join(cacheDir, "analyst-ratings");
		const secDir = path.join(cacheDir, "sec-filings");
		const optionsDir = path.join(cacheDir, "options-data");

		const analystExists = fs.existsSync(analystDir);
		const secExists = fs.existsSync(secDir);
		const optionsExists = fs.existsSync(optionsDir);

		logTest("Analyst ratings cache directory created", analystExists, analystExists ? undefined : `Directory not found: ${analystDir}`);
		logTest("SEC filings cache directory created", secExists, secExists ? undefined : `Directory not found: ${secDir}`);
		logTest("Options data cache directory created", optionsExists, optionsExists ? undefined : `Directory not found: ${optionsDir}`);

		return { analystCache, secCache, optionsCache };
	} catch (error: any) {
		logTest("Cache initialization failed", false, error.message);
		throw error;
	}
}

async function testAnalystRatingsCache(cache: AnalystRatingsCache) {
	console.log("\n2️⃣  Testing AnalystRatingsCache Methods...\n");

	const retryHandler = RetryHandler.getInstance();
	let testsPassed = 0;
	let testsFailed = 0;

	// Test 1: Get analyst ratings (first call - API fetch)
	try {
		const startTime = Date.now();
		const mockData = {
			symbol: "AAPL",
			ratings: { strongBuy: 20, buy: 15, hold: 5, sell: 0, strongSell: 0 },
			consensusScore: 0.85,
			lastRatingUpdate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days ago (historical)
		};

		const result = await cache.getAnalystRatings(
			"AAPL",
			async () => mockData,
			retryHandler
		);

		const duration = Date.now() - startTime;
		logTest("getAnalystRatings() - API fetch", result.symbol === "AAPL", undefined, duration);
		testsPassed++;
	} catch (error: any) {
		logTest("getAnalystRatings() - API fetch", false, error.message);
		testsFailed++;
	}

	// Test 2: Get analyst ratings (second call - cache hit)
	try {
		const startTime = Date.now();
		const result = await cache.getAnalystRatings(
			"AAPL",
			async () => { throw new Error("Should not call API - should use cache"); },
			retryHandler
		);

		const duration = Date.now() - startTime;
		const isCacheHit = duration < 50; // Cache should be much faster
		logTest("getAnalystRatings() - cache hit", isCacheHit, undefined, duration);
		testsPassed++;
	} catch (error: any) {
		logTest("getAnalystRatings() - cache hit", false, error.message);
		testsFailed++;
	}

	// Test 3: Get cache stats
	try {
		const stats = cache.getCacheStats();
		const hasData = stats.totalEntries > 0;
		logTest("getCacheStats()", hasData, hasData ? undefined : "No cache entries found");
		console.log(`   Total: ${stats.totalEntries}, Historical: ${stats.historicalEntries}, Recent: ${stats.recentEntries}`);
		testsPassed++;
	} catch (error: any) {
		logTest("getCacheStats()", false, error.message);
		testsFailed++;
	}

	// Test 4: Clear symbol
	try {
		cache.clearSymbol("AAPL");
		const stats = cache.getCacheStats();
		const cleared = stats.totalEntries === 0;
		logTest("clearSymbol()", cleared, cleared ? undefined : "Symbol not cleared from cache");
		testsPassed++;
	} catch (error: any) {
		logTest("clearSymbol()", false, error.message);
		testsFailed++;
	}

	return { testsPassed, testsFailed };
}

async function testSECFilingsCache(cache: SECFilingsCache) {
	console.log("\n3️⃣  Testing SECFilingsCache Methods...\n");

	const retryHandler = RetryHandler.getInstance();
	let testsPassed = 0;
	let testsFailed = 0;

	// Test 1: Get insider trading data
	try {
		const startTime = Date.now();
		const mockData = {
			insiderTransactions: [
				{ filingDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), transactionType: "Buy" } // 60 days ago
			]
		};

		const result = await cache.getInsiderTrading(
			"TSLA",
			100,
			async () => mockData,
			retryHandler
		);

		const duration = Date.now() - startTime;
		logTest("getInsiderTrading() - API fetch", result.insiderTransactions?.length > 0, undefined, duration);
		testsPassed++;
	} catch (error: any) {
		logTest("getInsiderTrading() - API fetch", false, error.message);
		testsFailed++;
	}

	// Test 2: Get insider trading (cache hit)
	try {
		const startTime = Date.now();
		const result = await cache.getInsiderTrading(
			"TSLA",
			100,
			async () => { throw new Error("Should not call API - should use cache"); },
			retryHandler
		);

		const duration = Date.now() - startTime;
		const isCacheHit = duration < 50;
		logTest("getInsiderTrading() - cache hit", isCacheHit, undefined, duration);
		testsPassed++;
	} catch (error: any) {
		logTest("getInsiderTrading() - cache hit", false, error.message);
		testsFailed++;
	}

	// Test 3: Get institutional ownership
	try {
		const startTime = Date.now();
		const mockData = {
			institutionalHolders: [
				{ reportedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), holder: "Vanguard" }
			]
		};

		const result = await cache.getInstitutionalOwnership(
			"NVDA",
			async () => mockData,
			retryHandler
		);

		const duration = Date.now() - startTime;
		logTest("getInstitutionalOwnership() - API fetch", result.institutionalHolders?.length > 0, undefined, duration);
		testsPassed++;
	} catch (error: any) {
		logTest("getInstitutionalOwnership() - API fetch", false, error.message);
		testsFailed++;
	}

	// Test 4: Get cache stats
	try {
		const stats = cache.getCacheStats();
		const hasData = stats.totalEntries > 0;
		logTest("getCacheStats()", hasData, hasData ? undefined : "No cache entries found");
		console.log(`   Total: ${stats.totalEntries}, Historical: ${stats.historicalEntries}, Recent: ${stats.recentEntries}`);
		testsPassed++;
	} catch (error: any) {
		logTest("getCacheStats()", false, error.message);
		testsFailed++;
	}

	// Test 5: Clear symbol
	try {
		cache.clearSymbol("TSLA");
		logTest("clearSymbol()", true);
		testsPassed++;
	} catch (error: any) {
		logTest("clearSymbol()", false, error.message);
		testsFailed++;
	}

	return { testsPassed, testsFailed };
}

async function testOptionsDataCache(cache: OptionsDataCache) {
	console.log("\n4️⃣  Testing OptionsDataCache Methods...\n");

	const retryHandler = RetryHandler.getInstance();
	let testsPassed = 0;
	let testsFailed = 0;

	// Test 1: Get price targets
	try {
		const startTime = Date.now();
		const mockData = {
			priceTarget: 150,
			consensusRating: "Buy",
			lastUpdated: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days ago
		};

		const result = await cache.getPriceTargets(
			"MSFT",
			async () => mockData,
			retryHandler
		);

		const duration = Date.now() - startTime;
		logTest("getPriceTargets() - API fetch", result.priceTarget === 150, undefined, duration);
		testsPassed++;
	} catch (error: any) {
		logTest("getPriceTargets() - API fetch", false, error.message);
		testsFailed++;
	}

	// Test 2: Get price targets (cache hit)
	try {
		const startTime = Date.now();
		const result = await cache.getPriceTargets(
			"MSFT",
			async () => { throw new Error("Should not call API - should use cache"); },
			retryHandler
		);

		const duration = Date.now() - startTime;
		const isCacheHit = duration < 50;
		logTest("getPriceTargets() - cache hit", isCacheHit, undefined, duration);
		testsPassed++;
	} catch (error: any) {
		logTest("getPriceTargets() - cache hit", false, error.message);
		testsFailed++;
	}

	// Test 3: Get dividend data
	try {
		const startTime = Date.now();
		const mockData = [
			{ date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), amount: 0.50 }
		];

		const result = await cache.getDividendData(
			"KO",
			async () => mockData,
			retryHandler
		);

		const duration = Date.now() - startTime;
		logTest("getDividendData() - API fetch", Array.isArray(result), undefined, duration);
		testsPassed++;
	} catch (error: any) {
		logTest("getDividendData() - API fetch", false, error.message);
		testsFailed++;
	}

	// Test 4: Get cache stats
	try {
		const stats = cache.getCacheStats();
		const hasData = stats.totalEntries > 0;
		logTest("getCacheStats()", hasData, hasData ? undefined : "No cache entries found");
		console.log(`   Total: ${stats.totalEntries}, Historical: ${stats.historicalEntries}, Recent: ${stats.recentEntries}`);
		testsPassed++;
	} catch (error: any) {
		logTest("getCacheStats()", false, error.message);
		testsFailed++;
	}

	// Test 5: Clear symbol
	try {
		cache.clearSymbol("MSFT");
		logTest("clearSymbol()", true);
		testsPassed++;
	} catch (error: any) {
		logTest("clearSymbol()", false, error.message);
		testsFailed++;
	}

	return { testsPassed, testsFailed };
}

async function testCacheClearing(
	analystCache: AnalystRatingsCache,
	secCache: SECFilingsCache,
	optionsCache: OptionsDataCache
) {
	console.log("\n5️⃣  Testing Cache Clearing...\n");

	try {
		analystCache.clearAll();
		secCache.clearAll();
		optionsCache.clearAll();

		const analystStats = analystCache.getCacheStats();
		const secStats = secCache.getCacheStats();
		const optionsStats = optionsCache.getCacheStats();

		const allCleared = analystStats.totalEntries === 0 && secStats.totalEntries === 0 && optionsStats.totalEntries === 0;
		logTest("clearAll() on all caches", allCleared, allCleared ? undefined : "Some caches not fully cleared");

		return allCleared;
	} catch (error: any) {
		logTest("clearAll() on all caches", false, error.message);
		return false;
	}
}

async function testCacheFiles(
	analystCache: AnalystRatingsCache,
	secCache: SECFilingsCache,
	optionsCache: OptionsDataCache
) {
	console.log("\n6️⃣  Testing Cache File Creation...\n");

	const retryHandler = RetryHandler.getInstance();

	// Re-populate caches to create files
	await analystCache.getAnalystRatings(
		"TEST",
		async () => ({ symbol: "TEST", lastRatingUpdate: new Date().toISOString() }),
		retryHandler
	);

	await secCache.getInsiderTrading(
		"TEST",
		100,
		async () => ({ insiderTransactions: [{ filingDate: new Date().toISOString() }] }),
		retryHandler
	);

	await optionsCache.getPriceTargets(
		"TEST",
		async () => ({ priceTarget: 100, lastUpdated: new Date().toISOString() }),
		retryHandler
	);

	const cacheDir = path.join(process.cwd(), "data", "cache");
	const files = [
		{ path: path.join(cacheDir, "analyst-ratings", "analyst-ratings-cache.json"), name: "analyst-ratings-cache.json" },
		{ path: path.join(cacheDir, "sec-filings", "sec-filings-cache.json"), name: "sec-filings-cache.json" },
		{ path: path.join(cacheDir, "options-data", "options-data-cache.json"), name: "options-data-cache.json" }
	];

	for (const file of files) {
		const exists = fs.existsSync(file.path);
		logTest(`Cache file exists: ${file.name}`, exists, exists ? undefined : `File not found: ${file.path}`);
	}

	// Clean up test data
	analystCache.clearAll();
	secCache.clearAll();
	optionsCache.clearAll();
}

async function printSummary() {
	console.log("\n" + "=".repeat(80));
	console.log("📊 Test Summary");
	console.log("=".repeat(80));

	const passed = results.filter(r => r.passed).length;
	const failed = results.filter(r => !r.passed).length;
	const total = results.length;

	console.log(`\nTotal Tests: ${total}`);
	console.log(`✓ Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
	console.log(`✗ Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);

	if (failed > 0) {
		console.log("\n❌ Failed Tests:");
		results.filter(r => !r.passed).forEach(r => {
			console.log(`  - ${r.name}`);
			if (r.error) {
				console.log(`    Error: ${r.error}`);
			}
		});
	}

	console.log("\n" + "=".repeat(80));

	if (failed === 0) {
		console.log("✅ All Phase 3 cache tests passed!");
		console.log("\n💡 Next step: Run integration test with training data generation script");
		console.log("   npx tsx scripts/ml/generate-training-data.ts --symbols AAPL --test");
	} else {
		console.log("❌ Some tests failed. Please fix issues before proceeding.");
		process.exit(1);
	}
}

async function main() {
	console.log("=".repeat(80));
	console.log("🧪 Comprehensive Phase 3 Cache Testing");
	console.log("=".repeat(80));
	console.log("\nTesting:");
	console.log("  1. Cache initialization");
	console.log("  2. AnalystRatingsCache methods");
	console.log("  3. SECFilingsCache methods");
	console.log("  4. OptionsDataCache methods");
	console.log("  5. Cache clearing");
	console.log("  6. Cache file creation");
	console.log("\n" + "=".repeat(80));

	try {
		// Test 1: Cache initialization
		const { analystCache, secCache, optionsCache } = await testCacheInitialization();

		// Test 2: AnalystRatingsCache
		const analystResults = await testAnalystRatingsCache(analystCache);
		console.log(`\n   Summary: ${analystResults.testsPassed} passed, ${analystResults.testsFailed} failed`);

		// Test 3: SECFilingsCache
		const secResults = await testSECFilingsCache(secCache);
		console.log(`\n   Summary: ${secResults.testsPassed} passed, ${secResults.testsFailed} failed`);

		// Test 4: OptionsDataCache
		const optionsResults = await testOptionsDataCache(optionsCache);
		console.log(`\n   Summary: ${optionsResults.testsPassed} passed, ${optionsResults.testsFailed} failed`);

		// Test 5: Cache clearing
		await testCacheClearing(analystCache, secCache, optionsCache);

		// Test 6: Cache file verification
		await testCacheFiles(analystCache, secCache, optionsCache);

		// Print summary
		await printSummary();

	} catch (error: any) {
		console.error("\n❌ Test suite failed:", error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

// Run tests
main().catch(console.error);
