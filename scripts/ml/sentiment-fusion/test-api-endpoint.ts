/**
 * Test Sentiment Fusion API Endpoint
 */

async function testSentimentFusionAPI() {
	const baseURL = "http://localhost:3000";

	console.log("🧪 Testing Sentiment Fusion API Endpoint\n");
	console.log("=" .repeat(80));

	// Test 1: Health check (GET)
	console.log("\n📋 Test 1: Health Check (GET /api/stocks/sentiment-fusion)\n");
	try {
		const healthResponse = await fetch(`${baseURL}/api/stocks/sentiment-fusion`);
		const healthData = await healthResponse.json();
		console.log("Status:", healthResponse.status);
		console.log("Response:", JSON.stringify(healthData, null, 2));
	} catch (error) {
		console.error("❌ Health check failed:", error);
	}

	// Test 2: Valid prediction request
	console.log("\n📊 Test 2: Valid Prediction (POST AAPL)\n");
	try {
		const predictionResponse = await fetch(
			`${baseURL}/api/stocks/sentiment-fusion`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					symbol: "AAPL",
					sector: "Technology",
				}),
			}
		);

		const predictionData = await predictionResponse.json();
		console.log("Status:", predictionResponse.status);
		console.log("Response:", JSON.stringify(predictionData, null, 2));
	} catch (error) {
		console.error("❌ Prediction failed:", error);
	}

	// Test 3: Invalid request (missing symbol)
	console.log("\n❌ Test 3: Invalid Request (missing symbol)\n");
	try {
		const invalidResponse = await fetch(
			`${baseURL}/api/stocks/sentiment-fusion`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sector: "Technology",
				}),
			}
		);

		const invalidData = await invalidResponse.json();
		console.log("Status:", invalidResponse.status);
		console.log("Response:", JSON.stringify(invalidData, null, 2));
	} catch (error) {
		console.error("❌ Invalid request test failed:", error);
	}

	// Test 4: Another stock (TSLA)
	console.log("\n📊 Test 4: Different Stock (POST TSLA)\n");
	try {
		const tslaResponse = await fetch(`${baseURL}/api/stocks/sentiment-fusion`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				symbol: "TSLA",
				sector: "Consumer Cyclical",
			}),
		});

		const tslaData = await tslaResponse.json();
		console.log("Status:", tslaResponse.status);
		console.log("Response:", JSON.stringify(tslaData, null, 2));
	} catch (error) {
		console.error("❌ TSLA prediction failed:", error);
	}

	console.log("\n" + "=".repeat(80));
	console.log("✅ API Endpoint Tests Complete\n");
}

// Run tests
testSentimentFusionAPI().catch((error) => {
	console.error("❌ Test suite failed:", error);
	process.exit(1);
});
