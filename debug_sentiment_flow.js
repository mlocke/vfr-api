/**
 * Debug script to trace GME sentiment flow from Reddit API to final scoring
 */

const {
	SentimentAnalysisService,
} = require("./app/services/financial-data/SentimentAnalysisService");
const { RedisCache } = require("./app/services/cache/RedisCache");

async function debugGMESentimentFlow() {
	console.log("🔍 Debugging GME sentiment flow...");

	try {
		// Initialize services
		const cache = new RedisCache();
		const sentimentService = new SentimentAnalysisService(cache);

		// Test GME sentiment analysis
		console.log("\n📊 Step 1: Getting GME sentiment indicators...");
		const indicators = await sentimentService.getSentimentIndicators("GME");

		if (indicators) {
			console.log("✅ GME Sentiment Indicators:", {
				aggregatedScore: indicators.aggregatedScore,
				confidence: indicators.confidence,
				newsScore: indicators.news?.sentiment,
				redditScore: indicators.reddit?.sentiment,
				redditPostCount: indicators.reddit?.postCount,
				lastUpdated: new Date(indicators.lastUpdated).toISOString(),
			});
		} else {
			console.log("❌ No sentiment indicators found for GME");
			return;
		}

		// Test sentiment impact calculation
		console.log("\n📈 Step 2: Calculating GME sentiment impact...");
		const baseScore = 0.75; // Example base score
		const sentimentImpact = await sentimentService.analyzeStockSentimentImpact(
			"GME",
			"Technology",
			baseScore
		);

		if (sentimentImpact) {
			console.log("✅ GME Sentiment Impact:", {
				symbol: sentimentImpact.symbol,
				baseScore: baseScore,
				sentimentScore: sentimentImpact.sentimentScore.overall,
				adjustedScore: sentimentImpact.adjustedScore,
				sentimentWeight: sentimentImpact.sentimentWeight,
				adjustment: sentimentImpact.adjustedScore - baseScore,
				adjustmentPercent:
					((sentimentImpact.adjustedScore - baseScore) * 100).toFixed(2) + "%",
			});

			console.log("\n🧠 Sentiment Score Components:");
			console.log("- News:", sentimentImpact.sentimentScore.components.news);
			console.log("- Reddit:", sentimentImpact.sentimentScore.components.reddit);
			console.log("- Overall:", sentimentImpact.sentimentScore.overall);
			console.log("- Confidence:", sentimentImpact.sentimentScore.confidence);

			console.log("\n💡 Insights:");
			sentimentImpact.insights.forEach((insight, i) => {
				console.log(`${i + 1}. ${insight}`);
			});
		} else {
			console.log("❌ No sentiment impact calculated for GME");
		}

		console.log("\n🔍 Analysis complete!");
	} catch (error) {
		console.error("❌ Error debugging sentiment flow:", error);
	} finally {
		process.exit(0);
	}
}

// Run the debug script
debugGMESentimentFlow();
