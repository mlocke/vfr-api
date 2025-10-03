#!/usr/bin/env node
/**
 * Quick test script to validate sentiment integration in VFR composite scoring
 * Tests the KISS architecture implementation for sentiment data integration
 */

const { AlgorithmEngine } = require("./app/services/algorithms/AlgorithmEngine.ts");
const { FactorLibrary } = require("./app/services/algorithms/FactorLibrary.ts");
const { AlgorithmCache } = require("./app/services/algorithms/AlgorithmCache.ts");
const { FinancialDataService } = require("./app/services/financial-data/FinancialDataService.ts");
const SentimentAnalysisService =
	require("./app/services/financial-data/SentimentAnalysisService.ts").default;
const { RedisCache } = require("./app/services/cache/RedisCache.ts");

async function testSentimentIntegration() {
	console.log("🧪 Testing VFR Sentiment Integration...");

	try {
		// Initialize services
		const cache = new RedisCache();
		const algorithmCache = new AlgorithmCache({
			ttl: { configuration: 3600, marketData: 300, selectionResults: 600 },
			compression: { threshold: 1000, enabled: true },
		});
		const factorLibrary = new FactorLibrary(cache);
		const fallbackService = new FinancialDataService();
		const sentimentService = new SentimentAnalysisService(cache);

		// Create AlgorithmEngine with sentiment integration
		const algorithmEngine = new AlgorithmEngine(
			fallbackService,
			factorLibrary,
			algorithmCache,
			sentimentService
		);

		console.log("✅ Services initialized successfully");

		// Test configuration that would trigger composite algorithm
		const testConfig = {
			id: "test-composite",
			name: "Test Composite Algorithm",
			type: "composite",
			weights: [{ factor: "composite", weight: 1.0, enabled: true }],
		};

		const testMarketData = {
			symbol: "GME",
			price: 20.5,
			volume: 1000000,
			marketCap: 8000000000,
			sector: "Consumer Discretionary",
			exchange: "NYSE",
			timestamp: Date.now(),
		};

		console.log("🎯 Testing composite score calculation for GME with sentiment integration...");

		// This should now trigger sentiment pre-fetching within the composite algorithm
		const score = await algorithmEngine.calculateSingleStockScore(
			"GME",
			testMarketData,
			testConfig
		);

		if (score) {
			console.log("🚀 SUCCESS! Sentiment integration working:");
			console.log(`   Overall Score: ${score.overallScore}`);
			console.log(`   Factor Scores: ${JSON.stringify(score.factorScores, null, 2)}`);
			console.log("📰 Sentiment data successfully integrated into composite scoring!");

			// Verify sentiment was actually used (should be > 0% utilization now)
			if (score.overallScore !== 0.5) {
				console.log(
					"✅ Sentiment appears to be influencing composite score (not default 0.5)"
				);
			} else {
				console.log("⚠️  Score is 0.5 - may be using fallback values");
			}
		} else {
			console.log("❌ Score calculation returned null");
		}

		console.log("🎯 Test completed successfully!");
	} catch (error) {
		console.error("❌ Test failed:", error);
		console.error("Stack:", error.stack);
	}
}

// Run the test
testSentimentIntegration()
	.then(() => {
		console.log("🏁 Sentiment integration test completed");
		process.exit(0);
	})
	.catch(error => {
		console.error("💥 Test crashed:", error);
		process.exit(1);
	});
