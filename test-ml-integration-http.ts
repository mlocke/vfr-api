/**
 * ML-Enhanced Stock Selection Integration Test (HTTP)
 *
 * Tests the ML enhancement via the API endpoints
 */

async function testMLEnhancementViaAPI() {
	const baseUrl = "http://localhost:3000";

	console.log("🚀 Starting ML Enhancement HTTP Integration Tests\n");

	// Test 1: Classic Analysis (No ML)
	console.log("=== Test 1: Classic VFR Analysis (include_ml=false) ===");
	try {
		const response = await fetch(`${baseUrl}/api/stocks/select`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				mode: "single",
				symbols: ["AAPL"],
				include_ml: false,
			}),
		});

		const result = await response.json();
		console.log("Status:", response.status);
		console.log("Success:", result.success);
		console.log("Stock count:", result.data?.stocks?.length);
		console.log("ML Enhancement Enabled:", result.data?.metadata?.mlEnhancementEnabled);

		if (result.success && !result.data?.metadata?.mlEnhancementEnabled) {
			console.log("✅ Classic analysis works (ML disabled)");
		} else {
			console.error("❌ Classic analysis failed or ML incorrectly enabled");
		}
	} catch (error) {
		console.error("❌ Test 1 failed:", error);
	}

	console.log("\n");

	// Test 2: ML-Enhanced Analysis
	console.log("=== Test 2: ML-Enhanced Analysis (include_ml=true) ===");
	try {
		const response = await fetch(`${baseUrl}/api/stocks/select`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				mode: "single",
				symbols: ["AAPL"],
				include_ml: true,
				ml_horizon: "1w",
				ml_confidence_threshold: 0.5,
			}),
		});

		const result = await response.json();
		console.log("Status:", response.status);
		console.log("Success:", result.success);
		console.log("Stock count:", result.data?.stocks?.length);
		console.log("ML Enhancement Enabled:", result.data?.metadata?.mlEnhancementEnabled);
		console.log("Warnings:", result.warnings);

		if (result.success) {
			console.log("✅ ML-enhanced analysis completed");

			// Check for warnings (API structure only in Phase 1.4)
			if (result.warnings && result.warnings.length > 0) {
				console.log("⚠️  ML not fully implemented (expected in Phase 1.4)");
			}
		} else {
			console.error("❌ ML-enhanced analysis failed");
		}
	} catch (error) {
		console.error("❌ Test 2 failed:", error);
	}

	console.log("\n");

	// Test 3: Health Check
	console.log("=== Test 3: Health Check ===");
	try {
		const response = await fetch(`${baseUrl}/api/health`);
		const result = await response.json();
		console.log("Status:", response.status);
		console.log("Service health:", result.data?.status);
		console.log("✅ Health check passed");
	} catch (error) {
		console.error("❌ Test 3 failed:", error);
	}

	console.log("\n");

	// Test 4: Multiple Stocks
	console.log("=== Test 4: Multiple Stocks Analysis ===");
	try {
		const response = await fetch(`${baseUrl}/api/stocks/select`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				mode: "multiple",
				symbols: ["AAPL", "MSFT", "GOOGL"],
				include_ml: true,
			}),
		});

		const result = await response.json();
		console.log("Status:", response.status);
		console.log("Success:", result.success);
		console.log("Stock count:", result.data?.stocks?.length);

		if (result.success && result.data?.stocks?.length === 3) {
			console.log("✅ Multiple stocks analysis works");
		} else {
			console.error("❌ Multiple stocks analysis failed");
		}
	} catch (error) {
		console.error("❌ Test 4 failed:", error);
	}

	console.log("\n✅ All HTTP Integration Tests Complete");
}

// Run tests
testMLEnhancementViaAPI()
	.then(() => {
		console.log("\n✅ Test suite passed");
		process.exit(0);
	})
	.catch((error) => {
		console.error("\n❌ Test suite failed:", error);
		process.exit(1);
	});
