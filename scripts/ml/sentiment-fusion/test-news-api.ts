/**
 * Direct test of FMP news API
 */

import { FinancialModelingPrepAPI } from "../../../app/services/financial-data/FinancialModelingPrepAPI";

async function testNewsAPI() {
	console.log("🧪 Testing FMP News API\n");

	const fmpAPI = new FinancialModelingPrepAPI();

	const symbols = ["AAPL", "TSLA"];

	for (const symbol of symbols) {
		console.log(`\n📰 Testing ${symbol}...`);
		try {
			const news = await fmpAPI.getStockNews(symbol, 5);

			if (!news || news.length === 0) {
				console.log(`   ⚠️  No news found for ${symbol}`);
				continue;
			}

			console.log(`   ✅ Found ${news.length} articles`);
			console.log(`\n   Latest article:`);
			console.log(`   Title: ${news[0].title}`);
			console.log(`   Date: ${news[0].publishedDate}`);
			console.log(`   Site: ${news[0].site}`);
			console.log(`   Text: ${news[0].text.substring(0, 150)}...`);
		} catch (error) {
			console.error(`   ❌ Failed for ${symbol}:`, error);
		}
	}

	console.log("\n✅ Test complete");
}

testNewsAPI().catch(console.error);
