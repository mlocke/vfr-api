#!/usr/bin/env node

/**
 * Test script to verify UnicornBay integration in admin API
 */

const { exec } = require("child_process");

async function testUnicornBayIntegration() {
	console.log("🦄 Testing UnicornBay integration...\n");

	// Test 1: Standard EODHD
	console.log("1. Testing standard EODHD endpoint...");
	try {
		const response = await fetch("http://localhost:3000/api/admin/test-data-sources", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				dataSourceIds: ["eodhd"],
				testType: "connection",
				timeout: 10000,
			}),
		});

		const data = await response.json();
		console.log("   ✅ Standard EODHD:", data.success ? "PASSED" : "FAILED");

		if (!data.success) {
			console.log("   ❌ Error:", data.error);
		}
	} catch (error) {
		console.log("   ❌ EODHD test failed:", error.message);
	}

	// Test 2: UnicornBay EODHD
	console.log("\n2. Testing UnicornBay EODHD endpoint...");
	try {
		const response = await fetch("http://localhost:3000/api/admin/test-data-sources", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				dataSourceIds: ["eodhd_unicornbay"],
				testType: "connection",
				timeout: 15000,
			}),
		});

		const data = await response.json();
		console.log("   🦄 UnicornBay EODHD:", data.success ? "PASSED" : "FAILED");

		if (data.results && data.results.length > 0) {
			const result = data.results[0];
			console.log(`   📊 Response time: ${result.responseTime}ms`);
			console.log(`   📈 Success: ${result.success}`);

			if (result.data) {
				console.log("   📋 Test data received");
			}
		}

		if (!data.success) {
			console.log("   ❌ Error:", data.error);
		}
	} catch (error) {
		console.log("   ❌ UnicornBay test failed:", error.message);
	}

	// Test 3: Comprehensive UnicornBay test
	console.log("\n3. Testing comprehensive UnicornBay features...");
	try {
		const response = await fetch("http://localhost:3000/api/admin/test-data-sources", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				dataSourceIds: ["eodhd_unicornbay"],
				testType: "comprehensive",
				timeout: 30000,
			}),
		});

		const data = await response.json();
		console.log("   🔬 Comprehensive test:", data.success ? "PASSED" : "FAILED");

		if (data.results && data.results.length > 0) {
			const result = data.results[0];
			console.log(`   ⏱️  Total time: ${result.responseTime}ms`);

			if (result.data && result.data.overallStatus) {
				const status = result.data.overallStatus;
				console.log(`   📊 Success rate: ${status.successRate}%`);
				console.log(
					`   ✅ Tests successful: ${status.testsSuccessful}/${status.testsCompleted}`
				);
				console.log(`   🦄 UnicornBay available: ${status.unicornBayAvailable}`);
				console.log(`   💡 Recommended usage: ${status.recommendedUsage}`);

				if (status.limitations) {
					console.log(`   ⚠️  Limitations: ${status.limitations}`);
				}
			}
		}
	} catch (error) {
		console.log("   ❌ Comprehensive test failed:", error.message);
	}

	// Test 4: Options service with UnicornBay integration
	console.log("\n4. Testing Options Data Service with UnicornBay...");
	try {
		const response = await fetch("http://localhost:3000/api/admin/test-data-sources", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				dataSourceIds: ["options"],
				testType: "comprehensive",
				timeout: 20000,
			}),
		});

		const data = await response.json();
		console.log("   📊 Options service test:", data.success ? "PASSED" : "FAILED");

		if (data.results && data.results.length > 0) {
			const result = data.results[0];

			if (result.data && result.data.unicornBayIntegration) {
				const integration = result.data.unicornBayIntegration;
				console.log("   🦄 UnicornBay integration detected:");
				console.log(
					`   📈 Performance grade: ${integration.performanceReport?.performanceGrade || "N/A"}`
				);
				console.log(
					`   ⚡ Average latency: ${integration.performanceReport?.averageLatency || "N/A"}ms`
				);
				console.log(
					`   💾 Cache hit rate: ${integration.performanceReport?.cacheHitRate || "N/A"}%`
				);

				if (integration.recommendations) {
					console.log(
						`   💡 Use UnicornBay: ${integration.recommendations.useUnicornBay}`
					);
				}
			}

			if (result.data.optionsChain) {
				const chain = result.data.optionsChain;
				console.log(`   📋 Options contracts: ${chain.contractCount}`);
				console.log(`   📞 Calls: ${chain.callsCount}`);
				console.log(`   📢 Puts: ${chain.putsCount}`);
			}
		}
	} catch (error) {
		console.log("   ❌ Options service test failed:", error.message);
	}

	console.log("\n🎉 UnicornBay integration test completed!");
}

// Check if server is running
async function checkServer() {
	try {
		const response = await fetch("http://localhost:3000/api/health");
		return response.ok;
	} catch (error) {
		return false;
	}
}

// Main execution
async function main() {
	console.log("🚀 Starting UnicornBay integration tests...\n");

	const serverRunning = await checkServer();

	if (!serverRunning) {
		console.log("❌ Server is not running on http://localhost:3000");
		console.log("   Please start the server with: npm run dev");
		process.exit(1);
	}

	console.log("✅ Server is running\n");

	await testUnicornBayIntegration();
}

if (require.main === module) {
	main().catch(console.error);
}
