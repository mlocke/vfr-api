/**
 * Debug Monitor for Market Intelligence Backend
 * Run this to see real-time data flow when analyzing stocks
 */

const http = require("http");

console.log("🔍 Market Intelligence Debug Monitor\n");
console.log("This will show you exactly what happens when you analyze stocks.\n");
console.log("Steps to debug:");
console.log("1. Keep this running in one terminal");
console.log("2. Open http://localhost:3000/stock-intelligence in browser");
console.log("3. Enter a stock ticker (e.g., AAPL)");
console.log('4. Click "Run Deep Analysis"');
console.log("5. Watch the data flow here!\n");
console.log("=".repeat(80));

// Test direct API call
async function testDirectAPICall() {
	console.log("\n📡 Testing Direct API Call to /api/stocks/select...\n");

	const requestData = {
		scope: {
			mode: "single_stock", // Use lowercase enum value
			symbols: ["AAPL"],
			maxResults: 5,
		},
		options: {
			useRealTimeData: true,
			includeSentiment: true,
			includeNews: true,
			timeout: 30000,
		},
		requestId: `debug_${Date.now()}`,
	};

	console.log("📤 Request being sent:");
	console.log(JSON.stringify(requestData, null, 2));
	console.log("\n" + "-".repeat(80) + "\n");

	try {
		const response = await fetch("http://localhost:3000/api/stocks/select", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestData),
		});

		console.log("📥 Response received:");
		console.log(`Status: ${response.status}`);
		console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
		console.log("\n" + "-".repeat(80) + "\n");

		if (response.ok) {
			const data = await response.json();

			console.log("✅ Success! Here's what the backend returned:\n");

			// Display key information
			if (data.metadata) {
				console.log("🎯 Metadata:");
				console.log(`  - Algorithm Used: ${data.metadata.algorithmUsed}`);
				console.log(
					`  - Data Sources: ${data.metadata.dataSourcesUsed?.join(", ") || "None"}`
				);
				console.log(`  - Analysis Mode: ${data.metadata.analysisMode}`);
				console.log(
					`  - Cache Hit Rate: ${(data.metadata.cacheHitRate * 100).toFixed(1)}%`
				);

				if (data.metadata.qualityScore) {
					console.log(
						`  - Quality Score: ${(data.metadata.qualityScore.overall * 100).toFixed(1)}%`
					);
				}
			}

			if (data.topSelections && data.topSelections.length > 0) {
				console.log("\n📊 Top Stock Selections:");
				data.topSelections.forEach((stock, index) => {
					console.log(`\n  ${index + 1}. ${stock.symbol}`);
					console.log(`     Score: ${(stock.score * 100).toFixed(2)}%`);
					console.log(`     Action: ${stock.recommendation?.action || "N/A"}`);
					console.log(`     Confidence: ${stock.recommendation?.confidence || "N/A"}`);

					if (stock.analysis?.reasoning) {
						console.log(
							`     Reasoning: ${stock.analysis.reasoning.substring(0, 100)}...`
						);
					}

					if (stock.fundamentals) {
						console.log(`     P/E Ratio: ${stock.fundamentals.peRatio || "N/A"}`);
						console.log(
							`     Market Cap: $${(stock.fundamentals.marketCap / 1e9).toFixed(2)}B`
						);
					}
				});
			}

			if (data.performance) {
				console.log("\n⏱️ Performance Metrics:");
				console.log(`  - Data Fetch: ${data.performance.dataFetchTime}ms`);
				console.log(`  - Analysis: ${data.performance.analysisTime}ms`);
				console.log(`  - Total: ${data.executionTime}ms`);
			}

			// Save full response for inspection
			const fs = require("fs").promises;
			const debugFile = `./docs/test-output/debug-response-${Date.now()}.json`;
			await fs.mkdir("./docs/test-output", { recursive: true });
			await fs.writeFile(debugFile, JSON.stringify(data, null, 2));
			console.log(`\n💾 Full response saved to: ${debugFile}`);
		} else {
			const errorData = await response.json();
			console.log("❌ Error Response:");
			console.log(JSON.stringify(errorData, null, 2));
		}
	} catch (error) {
		console.error("❌ Request failed:", error.message);
		console.log("\nPossible issues:");
		console.log("1. Is the dev server running? (npm run dev)");
		console.log("2. Is port 3000 available?");
		console.log("3. Check if MCP services are configured");
	}
}

// Monitor WebSocket connections (if available)
function monitorWebSocket() {
	console.log("\n🔌 Attempting to monitor WebSocket for real-time updates...\n");

	try {
		const WebSocket = require("ws");
		const ws = new WebSocket("ws://localhost:3000/api/ws/stocks");

		ws.on("open", () => {
			console.log("✅ WebSocket connected - monitoring real-time updates");

			// Subscribe to stock updates
			ws.send(
				JSON.stringify({
					type: "subscribe",
					symbols: ["AAPL", "MSFT", "GOOGL"],
				})
			);
		});

		ws.on("message", data => {
			const message = JSON.parse(data);
			console.log("📨 Real-time update:", message);
		});

		ws.on("error", error => {
			console.log("⚠️ WebSocket not available (this is normal if not implemented)");
		});
	} catch (error) {
		console.log("ℹ️ WebSocket monitoring not available");
	}
}

// Check service health
async function checkServiceHealth() {
	console.log("\n🏥 Checking Service Health...\n");

	try {
		const response = await fetch("http://localhost:3000/api/stocks/select");
		const health = await response.json();

		console.log("Service Status:", health.status);
		console.log("Supported Modes:", health.supportedModes?.join(", "));
		console.log("Rate Limits:", health.rateLimits);

		if (health.stats) {
			console.log("\n📈 Service Statistics:");
			console.log(`  - Total Requests: ${health.stats.totalRequests}`);
			console.log(`  - Success Rate: ${(health.stats.successRate * 100).toFixed(1)}%`);
			console.log(`  - Avg Execution Time: ${health.stats.averageExecutionTime}ms`);
			console.log(`  - Cache Hit Rate: ${(health.stats.cacheHitRate * 100).toFixed(1)}%`);
		}
	} catch (error) {
		console.log("⚠️ Could not fetch service health");
	}
}

// Main execution
async function main() {
	// Check health first
	await checkServiceHealth();

	// Test API call
	await testDirectAPICall();

	// Monitor WebSocket
	monitorWebSocket();

	console.log("\n" + "=".repeat(80));
	console.log("Debug monitor is running. Try the UI now to see live data flow!");
	console.log("Press Ctrl+C to exit.\n");
}

main().catch(console.error);

// Keep process alive
process.stdin.resume();
