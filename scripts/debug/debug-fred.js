#!/usr/bin/env node

/**
 * Detailed debug of FRED API issue
 */

// Load environment variables
require("dotenv").config();

const API_KEY = process.env.FRED_API_KEY || "e093a281de7f0d224ed51ad0842fc393";
const BASE_URL = "https://api.stlouisfed.org/fred";

async function debugFRED() {
	console.log("🔍 Debugging FRED API...");
	console.log("API Key:", API_KEY);
	console.log("API Key length:", API_KEY ? API_KEY.length : "undefined");
	console.log("API Key format check:", /^[a-z0-9]{32}$/.test(API_KEY));

	// Test direct API call
	console.log("\n1. Testing direct API health check...");
	try {
		const categoryUrl = `${BASE_URL}/category?category_id=0&api_key=${API_KEY}&file_type=json`;
		const response = await fetch(categoryUrl);
		console.log("Response status:", response.status);
		console.log("Response ok:", response.ok);

		const data = await response.json();
		console.log("Response data:", JSON.stringify(data, null, 2));
	} catch (error) {
		console.error("Direct API call failed:", error.message);
	}

	// Test observation call
	console.log("\n2. Testing direct observations call...");
	try {
		const obsUrl = `${BASE_URL}/series/observations?series_id=UNRATE&api_key=${API_KEY}&file_type=json&limit=1&sort_order=desc`;
		const response = await fetch(obsUrl);
		console.log("Response status:", response.status);
		console.log("Response ok:", response.ok);

		const data = await response.json();
		console.log("Response data:", JSON.stringify(data, null, 2));
	} catch (error) {
		console.error("Direct observations call failed:", error.message);
	}

	// Now test the FRED API class
	console.log("\n3. Testing FRED API class...");
	try {
		// Use dynamic import for ES modules
		const { FREDAPI } = await import("./app/services/financial-data/FREDAPI.ts");

		console.log("Creating FRED API instance...");
		const fredAPI = new FREDAPI(API_KEY, 10000, true);

		console.log("Testing health check...");
		const healthResult = await fredAPI.healthCheck();
		console.log("Health check result:", healthResult);

		if (!healthResult) {
			console.log("Health check failed - investigating...");

			// Test individual method
			try {
				console.log("Testing getLatestObservation directly...");
				// We can't access private methods, so let's test getStockPrice with more debugging
				const result = await fredAPI.getStockPrice("UNRATE");
				console.log("getStockPrice result:", result);
			} catch (methodError) {
				console.error("Method error:", methodError.message);
				console.error("Stack:", methodError.stack);
			}
		}
	} catch (error) {
		console.error("FRED API class error:", error.message);
		console.error("Stack:", error.stack);
	}
}

debugFRED();
