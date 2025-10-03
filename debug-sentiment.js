/**
 * Debug script for Sentiment Analysis Service
 * Tests actual sentiment data collection and identifies utilization issues
 */

const {
	SentimentAnalysisService,
} = require("./app/services/financial-data/SentimentAnalysisService.ts");
const { RedisCache } = require("./app/services/cache/RedisCache.ts");

async function debugSentimentService() {
	console.log("🔍 DEBUGGING SENTIMENT ANALYSIS SERVICE");
	console.log("=====================================");

	try {
		// Initialize service components
		const cache = new RedisCache();
		const sentimentService = new SentimentAnalysisService(cache);

		// Test symbols
		const testSymbols = ["GME", "AAPL", "TSLA"];

		console.log(`\n📊 Testing sentiment collection for symbols: ${testSymbols.join(", ")}`);

		for (const symbol of testSymbols) {
			console.log(`\n🎯 Testing ${symbol}:`);
			console.log("================");

			// Test individual service components
			try {
				// Test health check
				console.log("1. Health Check:");
				const healthCheck = await sentimentService.healthCheck();
				console.log("   Health status:", healthCheck.status);
				console.log("   Health details:", JSON.stringify(healthCheck.details, null, 2));

				// Test sentiment indicators
				console.log("2. Sentiment Indicators:");
				const indicators = await sentimentService.getSentimentIndicators(symbol);
				if (indicators) {
					console.log("   ✅ Successfully retrieved sentiment indicators");
					console.log("   Aggregated Score:", indicators.aggregatedScore);
					console.log("   Confidence:", indicators.confidence);
					console.log("   News Sentiment:", indicators.news?.sentiment || "N/A");
					console.log("   Reddit Sentiment:", indicators.reddit?.sentiment || "N/A");
					console.log("   Article Count:", indicators.news?.articleCount || 0);
					console.log("   Reddit Post Count:", indicators.reddit?.postCount || 0);
				} else {
					console.log("   ❌ Failed to retrieve sentiment indicators");
				}

				// Test sentiment impact calculation
				console.log("3. Sentiment Impact Analysis:");
				const impact = await sentimentService.analyzeStockSentimentImpact(
					symbol,
					"Technology",
					0.75
				);
				if (impact) {
					console.log("   ✅ Successfully calculated sentiment impact");
					console.log("   Base Score:", 0.75);
					console.log("   Adjusted Score:", impact.adjustedScore);
					console.log("   Sentiment Weight:", impact.sentimentWeight);
					console.log("   Overall Sentiment Score:", impact.sentimentScore.overall);
					console.log("   Confidence:", impact.sentimentScore.confidence);
					console.log("   Insights:", impact.insights?.slice(0, 3) || []);
				} else {
					console.log("   ❌ Failed to calculate sentiment impact");
				}
			} catch (error) {
				console.error(`❌ Error testing ${symbol}:`, error.message);
			}

			console.log(`\n${"=".repeat(50)}`);
		}

		// Test environment variables
		console.log("\n🔧 Environment Configuration:");
		console.log("================");
		console.log("REDDIT_CLIENT_ID:", process.env.REDDIT_CLIENT_ID ? "✅ Set" : "❌ Missing");
		console.log(
			"REDDIT_CLIENT_SECRET:",
			process.env.REDDIT_CLIENT_SECRET ? "✅ Set" : "❌ Missing"
		);
		console.log(
			"NEWSAPI_KEY:",
			process.env.NEWSAPI_KEY
				? process.env.NEWSAPI_KEY === "your_news_api_key_here"
					? "❌ Placeholder"
					: "✅ Set"
				: "❌ Missing"
		);
	} catch (error) {
		console.error("❌ Critical error in sentiment service debug:", error);
	}
}

// Execute debug
debugSentimentService()
	.then(() => {
		console.log("\n🎯 Debug complete!");
		process.exit(0);
	})
	.catch(error => {
		console.error("❌ Debug script failed:", error);
		process.exit(1);
	});
