#!/usr/bin/env node

/**
 * Test Service Utilization Tracking for VWAP and Macroeconomic services
 * Tests that new tracking integration works correctly
 */

const axios = require("axios");

const API_BASE = "http://localhost:3000";
const TEST_SYMBOL = "AAPL"; // Good test stock with active data

async function testServiceUtilization() {
	console.log("🧪 Testing Service Utilization Tracking for VWAP and Macroeconomic Services\n");

	try {
		console.log(`📡 Making request to admin analysis endpoint for ${TEST_SYMBOL}...`);

		const response = await axios.post(`${API_BASE}/api/admin/analysis`, {
			mode: "single",
			config: {
				symbol: TEST_SYMBOL,
				preferredDataSources: ["polygon", "alpha-vantage"],
			},
		});

		if (response.data.success) {
			console.log("✅ Request successful!");
			const metadata = response.data.data.metadata;
			const analysisServices = metadata.analysisInputServices;

			console.log("\n📊 Service Utilization Results:");
			console.log("=".repeat(50));

			// Check VWAP service tracking
			if (analysisServices.vwapAnalysis) {
				const vwapService = analysisServices.vwapAnalysis;
				console.log(`🎯 VWAP Analysis:`);
				console.log(`   Status: ${vwapService.status}`);
				console.log(`   Enabled: ${vwapService.enabled}`);
				console.log(`   Utilization: ${vwapService.utilizationInResults}`);
				console.log(`   Description: ${vwapService.description}`);

				// Verify VWAP components
				if (vwapService.components) {
					console.log(`   Components:`);
					Object.entries(vwapService.components).forEach(([key, value]) => {
						console.log(`     ${key}: ${JSON.stringify(value)}`);
					});
				}
			}

			console.log("");

			// Check Macroeconomic service tracking
			if (analysisServices.macroeconomicAnalysis) {
				const macroService = analysisServices.macroeconomicAnalysis;
				console.log(`🌍 Macroeconomic Analysis:`);
				console.log(`   Status: ${macroService.status}`);
				console.log(`   Enabled: ${macroService.enabled}`);
				console.log(`   Utilization: ${macroService.utilizationInResults}`);
				console.log(`   Weight: ${macroService.weightInCompositeScore}`);
				console.log(`   Description: ${macroService.description}`);

				// Verify Macro components
				if (macroService.components) {
					console.log(`   Components:`);
					Object.entries(macroService.components).forEach(([key, value]) => {
						console.log(`     ${key}: ${JSON.stringify(value)}`);
					});
				}
			}

			console.log("");

			// Check stock analysis results for factor tracking
			const stockData = response.data.data.stocks[0];
			if (stockData && stockData.factorScores) {
				console.log("🔍 Factor Score Analysis:");
				console.log("=".repeat(30));

				const factors = stockData.factorScores;

				// Check for VWAP factors
				const vwapFactors = Object.keys(factors).filter(
					key =>
						key.includes("vwap") ||
						key === "vwap_deviation_score" ||
						key === "vwap_trading_signals"
				);

				if (vwapFactors.length > 0) {
					console.log(`✅ VWAP Factors Found: ${vwapFactors.join(", ")}`);
					vwapFactors.forEach(factor => {
						console.log(`   ${factor}: ${factors[factor].toFixed(4)}`);
					});
				} else {
					console.log("⚠️ No VWAP factors found in results");
				}

				// Check for Macroeconomic factors
				const macroFactors = Object.keys(factors).filter(
					key =>
						key.includes("macro") ||
						key === "macroeconomic_sector_impact" ||
						key === "macroeconomic_composite"
				);

				if (macroFactors.length > 0) {
					console.log(`✅ Macro Factors Found: ${macroFactors.join(", ")}`);
					macroFactors.forEach(factor => {
						console.log(`   ${factor}: ${factors[factor].toFixed(4)}`);
					});
				} else {
					console.log("⚠️ No Macroeconomic factors found in results");
				}

				console.log(`\n📈 Total Factor Count: ${Object.keys(factors).length}`);
				console.log(`   Composite Score: ${stockData.compositeScore.toFixed(4)}`);
				console.log(`   Recommendation: ${stockData.recommendation}`);
			}

			// Overall assessment
			console.log("\n🎯 Service Integration Assessment:");
			console.log("=".repeat(40));

			const vwapUtilization = analysisServices.vwapAnalysis?.utilizationInResults || "0%";
			const macroUtilization =
				analysisServices.macroeconomicAnalysis?.utilizationInResults || "0%";

			console.log(`VWAP Service Utilization: ${vwapUtilization}`);
			console.log(`Macro Service Utilization: ${macroUtilization}`);

			if (vwapUtilization !== "0%" || macroUtilization !== "0%") {
				console.log("✅ SUCCESS: Service utilization tracking is working!");
			} else {
				console.log(
					"⚠️ WARNING: Services not being utilized - check API keys and service availability"
				);
			}
		} else {
			console.error("❌ API request failed:", response.data.error);
			process.exit(1);
		}
	} catch (error) {
		console.error("❌ Test failed with error:", error.message);
		if (error.response) {
			console.error("Response data:", error.response.data);
		}
		process.exit(1);
	}
}

// Run the test
testServiceUtilization().then(() => {
	console.log("\n✅ Service Utilization Test Complete");
	process.exit(0);
});
