/**
 * Test ESD End-to-End Flow through API
 */

import { MLEnhancedStockSelectionService } from "../../app/services/stock-selection/MLEnhancedStockSelectionService.js";
import { FinancialDataService } from "../../app/services/financial-data/FinancialDataService.js";
import { FactorLibrary } from "../../app/services/algorithms/FactorLibrary.js";
import { RedisCache } from "../../app/services/cache/RedisCache.js";
import { SelectionMode } from "../../app/services/stock-selection/types.js";

async function testAPIFlow() {
	console.log("🔬 Testing ESD End-to-End API Flow\n");

	const testSymbol = "NVDA";

	const cache = new RedisCache();
	const financialDataService = new FinancialDataService();
	const factorLibrary = new FactorLibrary();

	const stockService = new MLEnhancedStockSelectionService(
		financialDataService,
		factorLibrary,
		cache
	);

	console.log(`Executing stock selection for ${testSymbol} with includeEarlySignal=true...\n`);

	const startTime = Date.now();

	try {
		const result = await stockService.selectStocks({
			scope: {
				mode: SelectionMode.SINGLE_STOCK,
				symbols: [testSymbol],
				maxResults: 1,
			},
			options: {
				algorithmId: "composite",
				useRealTimeData: true,
				includeEarlySignal: true, // 🔑 CRITICAL FLAG
				timeout: 60000,
			},
			requestId: `esd_test_${Date.now()}`,
		});

		const latency = Date.now() - startTime;

		console.log(`✅ Stock selection completed (${latency}ms)\n`);

		if (result.singleStock) {
			console.log(`Symbol: ${result.singleStock.symbol}`);
			console.log(`Action: ${result.singleStock.action}`);
			console.log(`Confidence: ${(result.singleStock.confidence * 100).toFixed(1)}%\n`);

			// 🎯 THE CRITICAL CHECK
			if (result.singleStock.early_signal) {
				console.log("✅ ✅ ✅ EARLY SIGNAL PRESENT IN RESPONSE!\n");
				console.log(`   Upgrade Likely: ${result.singleStock.early_signal.upgrade_likely}`);
				console.log(
					`   Downgrade Likely: ${result.singleStock.early_signal.downgrade_likely}`
				);
				console.log(
					`   Confidence: ${(result.singleStock.early_signal.confidence * 100).toFixed(1)}%`
				);
				console.log(`   Horizon: ${result.singleStock.early_signal.horizon}`);
				console.log(`   Model Version: ${result.singleStock.early_signal.model_version}`);
				console.log(`   Reasoning:`);
				result.singleStock.early_signal.reasoning.forEach((r, i) =>
					console.log(`     ${i + 1}. ${r}`)
				);

				console.log("\n🎉 SUCCESS - ESD is working end-to-end!");
				process.exit(0);
			} else {
				console.log("❌ EARLY SIGNAL MISSING FROM RESPONSE!");
				console.log("This should not happen - check StockSelectionService logs above");
				process.exit(1);
			}
		} else {
			console.log("⚠️ No singleStock result returned");
			process.exit(1);
		}
	} catch (error) {
		console.error(`❌ FAILED:`, error);
		process.exit(1);
	}
}

testAPIFlow();
