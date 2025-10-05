/**
 * Phase 1+2 Cache Performance Test
 * Tests OHLCV and Income Statement caching performance
 */

import { OHLCVCache } from "./caching/OHLCVCache.js";
import { IncomeStatementCache } from "./caching/IncomeStatementCache.js";
import { EarlySignalFeatureExtractor } from "../../app/services/ml/early-signal/FeatureExtractor.js";
import { RetryHandler } from "../../app/services/error-handling/RetryHandler.js";

// Test symbols (reduced to 3 for faster testing)
const TEST_SYMBOLS = ["AAPL", "GOOGL", "MSFT"];
const TEST_DATE = new Date("2024-06-15");

interface TestMetrics {
	symbol: string;
	duration: number;
	ohlcvCached: boolean;
	incomeCached: boolean;
}

async function runFeatureExtraction(
	extractor: EarlySignalFeatureExtractor,
	symbol: string
): Promise<TestMetrics> {
	const startTime = Date.now();

	// Capture console logs to detect cache hits
	const logs: string[] = [];
	const originalLog = console.log;
	console.log = (...args: any[]) => {
		const message = args.join(" ");
		logs.push(message);
		originalLog(...args);
	};

	try {
		await extractor.extractFeatures(symbol, TEST_DATE, true);

		const duration = Date.now() - startTime;

		// Detect cache hits from logs
		const ohlcvCached = logs.some(log => log.includes("📦 Using cached OHLCV"));
		const incomeCached = logs.some(log => log.includes("📦 Using cached income statements"));

		return {
			symbol,
			duration,
			ohlcvCached,
			incomeCached
		};
	} finally {
		console.log = originalLog;
	}
}

async function main() {
	console.log("=== Phase 1+2 Cache Performance Test ===\n");

	// Initialize caches
	const ohlcvCache = new OHLCVCache();
	const incomeStatementCache = new IncomeStatementCache();
	const retryHandler = RetryHandler.getInstance();

	console.log("Step 1: Clear all caches for baseline test");
	ohlcvCache.clearAll();
	incomeStatementCache.clearAll();
	console.log("✓ All caches cleared\n");

	// Initialize feature extractor with caching
	const featureExtractor = new EarlySignalFeatureExtractor({
		ohlcvCache: ohlcvCache,
		incomeStatementCache: incomeStatementCache,
		retryHandler: retryHandler
	});

	// Test 1: Cold cache (baseline)
	console.log("Step 2: Cold Cache Test (Baseline - All API Calls)");
	console.log("━".repeat(60));
	const coldMetrics: TestMetrics[] = [];
	const coldStartTime = Date.now();

	for (const symbol of TEST_SYMBOLS) {
		console.log(`\nTesting ${symbol}...`);
		const metrics = await runFeatureExtraction(featureExtractor, symbol);
		coldMetrics.push(metrics);
		console.log(`  Duration: ${metrics.duration}ms`);
	}

	const coldTotalTime = Date.now() - coldStartTime;
	console.log(`\n✓ Cold cache test complete: ${coldTotalTime}ms total\n`);

	// Show cache file creation
	console.log("Step 3: Cache Files Created");
	console.log("━".repeat(60));
	console.log(`OHLCV Cache: data/cache/ohlcv/ohlcv-cache.json`);
	console.log(`Income Statement Cache: data/cache/income-statements/income-statement-cache.json\n`);

	// Test 2: Warm cache
	console.log("Step 4: Warm Cache Test (Using Cached Data)");
	console.log("━".repeat(60));
	const warmMetrics: TestMetrics[] = [];
	const warmStartTime = Date.now();

	for (const symbol of TEST_SYMBOLS) {
		console.log(`\nTesting ${symbol}...`);
		const metrics = await runFeatureExtraction(featureExtractor, symbol);
		warmMetrics.push(metrics);
		console.log(`  Duration: ${metrics.duration}ms`);
		console.log(`  Cache Hits: OHLCV=${metrics.ohlcvCached ? '✓' : '✗'}, Income=${metrics.incomeCached ? '✓' : '✗'}`);
	}

	const warmTotalTime = Date.now() - warmStartTime;
	console.log(`\n✓ Warm cache test complete: ${warmTotalTime}ms total\n`);

	// Performance Analysis
	console.log("Step 5: Performance Analysis");
	console.log("━".repeat(60));

	const avgColdTime = coldMetrics.reduce((sum, m) => sum + m.duration, 0) / coldMetrics.length;
	const avgWarmTime = warmMetrics.reduce((sum, m) => sum + m.duration, 0) / warmMetrics.length;
	const speedup = ((avgColdTime - avgWarmTime) / avgColdTime * 100).toFixed(1);

	console.log(`\n📊 Performance Metrics:`);
	console.log(`  Cold Cache (Baseline):`);
	console.log(`    - Total Time: ${coldTotalTime}ms`);
	console.log(`    - Avg per Symbol: ${avgColdTime.toFixed(0)}ms`);
	console.log(`    - Cache Hits: 0%`);

	console.log(`\n  Warm Cache (Optimized):`);
	console.log(`    - Total Time: ${warmTotalTime}ms`);
	console.log(`    - Avg per Symbol: ${avgWarmTime.toFixed(0)}ms`);

	const ohlcvHitRate = (warmMetrics.filter(m => m.ohlcvCached).length / warmMetrics.length * 100).toFixed(0);
	const incomeHitRate = (warmMetrics.filter(m => m.incomeCached).length / warmMetrics.length * 100).toFixed(0);

	console.log(`    - OHLCV Cache Hit Rate: ${ohlcvHitRate}%`);
	console.log(`    - Income Cache Hit Rate: ${incomeHitRate}%`);

	console.log(`\n  Performance Improvement:`);
	console.log(`    - Speed Increase: ${speedup}% faster`);
	console.log(`    - Time Saved: ${coldTotalTime - warmTotalTime}ms (${((coldTotalTime - warmTotalTime) / 1000).toFixed(1)}s)`);

	// Extrapolate to full dataset
	const fullSymbolCount = 479; // S&P 500 symbols
	const estimatedColdFull = (avgColdTime * fullSymbolCount / 1000 / 60).toFixed(0);
	const estimatedWarmFull = (avgWarmTime * fullSymbolCount / 1000 / 60).toFixed(0);

	console.log(`\n  Extrapolated to Full Dataset (${fullSymbolCount} symbols):`);
	console.log(`    - Without Cache: ~${estimatedColdFull} minutes`);
	console.log(`    - With Cache: ~${estimatedWarmFull} minutes`);
	console.log(`    - Time Saved: ~${(Number(estimatedColdFull) - Number(estimatedWarmFull))} minutes`);

	console.log(`\n✅ Phase 1+2 Cache Performance Test Complete`);
	console.log(`   Target: 60-65% cache hit rate`);
	console.log(`   Actual: OHLCV ${ohlcvHitRate}%, Income ${incomeHitRate}%`);
}

main().catch(console.error);
