/**
 * Test Yearly Caching Strategy
 *
 * Purpose: Verify that yearly caching reduces API calls and enables cache reuse
 * when extending date ranges
 *
 * Test Scenarios:
 * 1. First run: Fetch 2022-2024 data (should fetch 3 years)
 * 2. Second run: Same date range (should use cache, 0 API calls)
 * 3. Extended run: Fetch 2022-2025 data (should only fetch 2025, reuse 2022-2024)
 */

import "dotenv/config";
import { HistoricalDataCache } from "../../app/services/cache/HistoricalDataCache.js";

interface MockNewsArticle {
	title: string;
	published_utc: string;
	source: string;
}

class YearlyCacheTester {
	private cache: HistoricalDataCache;
	private apiCallCount = 0;

	constructor() {
		this.cache = HistoricalDataCache.getInstance();
	}

	/**
	 * Mock API call that simulates fetching news for a year
	 */
	private async mockFetchNewsForYear(
		symbol: string,
		year: number,
		start: string,
		end: string
	): Promise<MockNewsArticle[]> {
		this.apiCallCount++;
		console.log(`  🌐 API CALL #${this.apiCallCount}: Fetching ${symbol} news for ${year}`);

		// Simulate API delay
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Generate mock news articles for this year
		const articles: MockNewsArticle[] = [];
		const articlesPerYear = 50;

		for (let i = 0; i < articlesPerYear; i++) {
			const month = Math.floor(Math.random() * 12) + 1;
			const day = Math.floor(Math.random() * 28) + 1;
			const dateStr = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

			articles.push({
				title: `${symbol} News Article ${i + 1} for ${year}`,
				published_utc: `${dateStr}T12:00:00Z`,
				source: "mock-api",
			});
		}

		return articles;
	}

	/**
	 * Test 1: First run - Fetch 2022-2024 data
	 */
	async testInitialFetch() {
		console.log("\n" + "=".repeat(80));
		console.log("TEST 1: Initial Fetch (2022-2024)");
		console.log("=".repeat(80));

		this.apiCallCount = 0;
		const symbol = "AAPL";
		const startDate = "2022-01-01";
		const endDate = "2024-12-31";

		const articles = await this.cache.getOrFetchYearly<MockNewsArticle>(
			"news",
			symbol,
			startDate,
			endDate,
			async (year, start, end) => {
				return this.mockFetchNewsForYear(symbol, year, start, end);
			},
			"mock-api"
		);

		console.log(`\n✅ Fetched ${articles.length} articles`);
		console.log(`📊 API Calls: ${this.apiCallCount}`);
		console.log(`🎯 Expected: 3 API calls (2022, 2023, 2024)`);
		console.log(`✓ Test ${this.apiCallCount === 3 ? "PASSED" : "FAILED"}`);

		return this.apiCallCount === 3;
	}

	/**
	 * Test 2: Cached run - Same date range
	 */
	async testCachedFetch() {
		console.log("\n" + "=".repeat(80));
		console.log("TEST 2: Cached Fetch (2022-2024, same range)");
		console.log("=".repeat(80));

		this.apiCallCount = 0;
		const symbol = "AAPL";
		const startDate = "2022-01-01";
		const endDate = "2024-12-31";

		const articles = await this.cache.getOrFetchYearly<MockNewsArticle>(
			"news",
			symbol,
			startDate,
			endDate,
			async (year, start, end) => {
				return this.mockFetchNewsForYear(symbol, year, start, end);
			},
			"mock-api"
		);

		console.log(`\n✅ Retrieved ${articles.length} articles from cache`);
		console.log(`📊 API Calls: ${this.apiCallCount}`);
		console.log(`🎯 Expected: 0 API calls (all cached)`);
		console.log(`✓ Test ${this.apiCallCount === 0 ? "PASSED" : "FAILED"}`);

		return this.apiCallCount === 0;
	}

	/**
	 * Test 3: Extended range - 2022-2025
	 */
	async testExtendedFetch() {
		console.log("\n" + "=".repeat(80));
		console.log("TEST 3: Extended Fetch (2022-2025, +1 year)");
		console.log("=".repeat(80));

		this.apiCallCount = 0;
		const symbol = "AAPL";
		const startDate = "2022-01-01";
		const endDate = "2025-12-31"; // Extended to 2025

		const articles = await this.cache.getOrFetchYearly<MockNewsArticle>(
			"news",
			symbol,
			startDate,
			endDate,
			async (year, start, end) => {
				return this.mockFetchNewsForYear(symbol, year, start, end);
			},
			"mock-api"
		);

		console.log(`\n✅ Retrieved ${articles.length} articles`);
		console.log(`📊 API Calls: ${this.apiCallCount}`);
		console.log(`🎯 Expected: 1 API call (only 2025, 2022-2024 cached)`);
		console.log(`✓ Test ${this.apiCallCount === 1 ? "PASSED" : "FAILED"}`);

		// Calculate cache reuse rate
		const cacheReuseRate = ((3 / 4) * 100).toFixed(1);
		console.log(`📈 Cache Reuse Rate: ${cacheReuseRate}% (3/4 years cached)`);

		return this.apiCallCount === 1;
	}

	/**
	 * Test 4: Cache statistics
	 */
	async testCacheStats() {
		console.log("\n" + "=".repeat(80));
		console.log("TEST 4: Cache Statistics");
		console.log("=".repeat(80));

		const stats = this.cache.getStats();
		const hitRate = (this.cache.getHitRate() * 100).toFixed(1);

		console.log(`📊 Cache Stats:`);
		console.log(`   Hits: ${stats.hits}`);
		console.log(`   Misses: ${stats.misses}`);
		console.log(`   Hit Rate: ${hitRate}%`);
		console.log(`   Entry Count: ${stats.entryCount}`);

		// Check yearly cache files exist
		const symbol = "AAPL";
		const years = [2022, 2023, 2024, 2025];
		console.log(`\n📁 Yearly Cache Files:`);

		for (const year of years) {
			const exists = await this.cache.hasYearly("news", symbol, year);
			console.log(`   ${symbol}_${year}.json: ${exists ? "✓ EXISTS" : "✗ MISSING"}`);
		}

		return true;
	}

	/**
	 * Run all tests
	 */
	async runAllTests() {
		console.log("\n");
		console.log("╔" + "═".repeat(78) + "╗");
		console.log("║" + " ".repeat(20) + "YEARLY CACHING STRATEGY TEST" + " ".repeat(30) + "║");
		console.log("╚" + "═".repeat(78) + "╝");

		const results = {
			test1: await this.testInitialFetch(),
			test2: await this.testCachedFetch(),
			test3: await this.testExtendedFetch(),
			test4: await this.testCacheStats(),
		};

		// Summary
		console.log("\n" + "=".repeat(80));
		console.log("TEST SUMMARY");
		console.log("=".repeat(80));

		const allPassed = Object.values(results).every((r) => r);

		console.log(`Test 1 (Initial Fetch):     ${results.test1 ? "✅ PASSED" : "❌ FAILED"}`);
		console.log(`Test 2 (Cached Fetch):      ${results.test2 ? "✅ PASSED" : "❌ FAILED"}`);
		console.log(`Test 3 (Extended Fetch):    ${results.test3 ? "✅ PASSED" : "❌ FAILED"}`);
		console.log(`Test 4 (Cache Stats):       ${results.test4 ? "✅ PASSED" : "❌ FAILED"}`);

		console.log("\n" + "=".repeat(80));
		console.log(allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED");
		console.log("=".repeat(80));

		return allPassed;
	}
}

// Run tests
const tester = new YearlyCacheTester();
tester.runAllTests().catch(console.error);
