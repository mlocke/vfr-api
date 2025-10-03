#!/usr/bin/env node

/**
 * Quick debug script to test FRED API directly
 */

const API_KEY = "e093a281de7f0d224ed51ad0842fc393"; // Convert to lowercase to test format
const INVALID_API_KEY = "E093a281de7f0d224ed51ad0842fc393"; // Original with uppercase
const BASE_URL = "https://api.stlouisfed.org/fred";

async function testFredAPI() {
	console.log("🏦 Testing FRED API directly...");

	try {
		// Test 1: Health check with category endpoint
		console.log("\n1. Testing health check (category endpoint)...");
		const categoryUrl = `${BASE_URL}/category?category_id=0&api_key=${API_KEY}&file_type=json`;
		console.log("URL:", categoryUrl);

		const categoryResponse = await fetch(categoryUrl);
		console.log("Status:", categoryResponse.status, categoryResponse.statusText);

		if (categoryResponse.ok) {
			const categoryData = await categoryResponse.json();
			console.log("Category data:", JSON.stringify(categoryData, null, 2));
		} else {
			const errorText = await categoryResponse.text();
			console.error("Error response:", errorText);
		}

		// Test 2: Get UNRATE series info
		console.log("\n2. Testing series info for UNRATE...");
		const seriesUrl = `${BASE_URL}/series?series_id=UNRATE&api_key=${API_KEY}&file_type=json`;
		console.log("URL:", seriesUrl);

		const seriesResponse = await fetch(seriesUrl);
		console.log("Status:", seriesResponse.status, seriesResponse.statusText);

		if (seriesResponse.ok) {
			const seriesData = await seriesResponse.json();
			console.log("Series data:", JSON.stringify(seriesData, null, 2));
		} else {
			const errorText = await seriesResponse.text();
			console.error("Error response:", errorText);
		}

		// Test 3: Get UNRATE observations
		console.log("\n3. Testing observations for UNRATE...");
		const observationsUrl = `${BASE_URL}/series/observations?series_id=UNRATE&api_key=${API_KEY}&file_type=json&limit=1&sort_order=desc`;
		console.log("URL:", observationsUrl);

		const obsResponse = await fetch(observationsUrl);
		console.log("Status:", obsResponse.status, obsResponse.statusText);

		if (obsResponse.ok) {
			const obsData = await obsResponse.json();
			console.log("Observations data:", JSON.stringify(obsData, null, 2));
		} else {
			const errorText = await obsResponse.text();
			console.error("Error response:", errorText);
		}
	} catch (error) {
		console.error("❌ Error testing FRED API:", error.message);
	}
}

testFredAPI();
