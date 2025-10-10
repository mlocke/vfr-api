/**
 * Test FMP historical API to diagnose why dataset generation is failing
 */

import "dotenv/config";
import { FinancialModelingPrepAPI } from "../../../app/services/financial-data/FinancialModelingPrepAPI.js";

async function testHistoricalAPI() {
	const fmpAPI = new FinancialModelingPrepAPI();

	console.log("Testing FMP Historical Data API");
	console.log("=".repeat(80));

	// Test 1: Recent data (should work)
	console.log("\n📊 Test 1: Recent historical data (last 30 days)");
	const recentData = await fmpAPI.getHistoricalData("AAPL", 30);
	console.log(`Result: ${recentData.length} records returned`);
	if (recentData.length > 0) {
		console.log(`Sample: ${JSON.stringify(recentData[0], null, 2)}`);
	}

	// Test 2: Historical data with endDate (2023-01-15)
	console.log("\n📊 Test 2: Historical data ending 2023-01-15 (30 days)");
	const historicalDate = new Date("2023-01-15");
	const historicalData = await fmpAPI.getHistoricalData("AAPL", 30, historicalDate);
	console.log(`Result: ${historicalData.length} records returned`);
	if (historicalData.length > 0) {
		console.log(`First: ${JSON.stringify(historicalData[0], null, 2)}`);
		console.log(`Last: ${JSON.stringify(historicalData[historicalData.length - 1], null, 2)}`);
	} else {
		console.log("❌ NO DATA RETURNED - This is the problem!");
	}

	// Test 3: Direct API URL construction
	console.log("\n📊 Test 3: What URL would be constructed?");
	const testDate = new Date("2023-01-15");
	const startDate = new Date(testDate);
	startDate.setDate(startDate.getDate() - 30);
	const fromStr = startDate.toISOString().split("T")[0];
	const toStr = testDate.toISOString().split("T")[0];
	const url = `/historical-price-full/AAPL?from=${fromStr}&to=${toStr}`;
	console.log(`URL: ${url}`);
	console.log(`Full URL: https://financialmodelingprep.com/api/v3${url}&apikey=YOUR_KEY`);

	// Test 4: Try a different symbol
	console.log("\n📊 Test 4: Historical data for TSLA ending 2023-01-15");
	const tslaData = await fmpAPI.getHistoricalData("TSLA", 30, historicalDate);
	console.log(`Result: ${tslaData.length} records returned`);

	console.log("\n" + "=".repeat(80));
	console.log("Diagnosis:");
	if (recentData.length > 0 && historicalData.length === 0) {
		console.log("❌ ISSUE FOUND: FMP API returns recent data but NOT historical data with endDate");
		console.log("   This suggests either:");
		console.log("   1. FMP API subscription doesn't allow historical date ranges");
		console.log("   2. API parameter format is incorrect");
		console.log("   3. Rate limiting or quota issue");
	} else if (historicalData.length > 0) {
		console.log("✅ Historical API working correctly");
	} else {
		console.log("❌ Neither recent nor historical data returned - API key or connectivity issue");
	}
}

testHistoricalAPI().catch(console.error);
