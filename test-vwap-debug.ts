#!/usr/bin/env ts-node

// Note: PolygonAPI has been removed and replaced with FinancialModelingPrepAPI
import { FinancialModelingPrepAPI } from "./app/services/financial-data/FinancialModelingPrepAPI";
import { VWAPService } from "./app/services/financial-data/VWAPService";
import { RedisCache } from "./app/services/cache/RedisCache";

async function testVWAP() {
	console.log("Testing VWAP implementation with FMP API...");

	// Initialize services
	const fmpAPI = new FinancialModelingPrepAPI();
	const cache = new RedisCache({
		host: "localhost",
		port: 6379,
		keyPrefix: "debug:vwap:",
	});

	const vwapService = new VWAPService(fmpAPI, cache);

	try {
		// Test FMP API health
		console.log("\n1. Testing FMP API health...");
		const health = await fmpAPI.healthCheck();
		console.log("FMP API health:", health);

		// Test basic stock data
		console.log("\n2. Testing basic stock data for AAPL...");
		const stockData = await fmpAPI.getStockPrice("AAPL");
		console.log("Stock data:", stockData);

		// Test VWAP analysis (FMP API doesn't have direct getVWAP, VWAP is calculated by VWAPService)
		console.log("\n3. Testing VWAP analysis for AAPL...");
		const vwapAnalysis = await vwapService.getVWAPAnalysis("AAPL");
		console.log("VWAP analysis:", vwapAnalysis);

		console.log("\nVWAP test completed successfully!");
	} catch (error) {
		console.error("VWAP test failed:", error);
	}
}

// Run the test
testVWAP().catch(console.error);
