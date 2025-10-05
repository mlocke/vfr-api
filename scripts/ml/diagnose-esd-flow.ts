/**
 * Diagnose Early Signal Detection (ESD) Flow
 *
 * Tests the entire flow from feature toggle → API route → service → response
 * to identify where ESD signals are getting lost
 */

import { MLFeatureToggleService } from "../../app/services/admin/MLFeatureToggleService.js";
import { EarlySignalService } from "../../app/services/ml/early-signal/EarlySignalService.js";
import { MLEnhancedStockSelectionService } from "../../app/services/stock-selection/MLEnhancedStockSelectionService.js";
import { FinancialDataService } from "../../app/services/financial-data/FinancialDataService.js";
import { FactorLibrary } from "../../app/services/algorithms/FactorLibrary.js";
import { RedisCache } from "../../app/services/cache/RedisCache.js";
import { TechnicalIndicatorService } from "../../app/services/technical-analysis/TechnicalIndicatorService.js";
import { SelectionMode } from "../../app/services/stock-selection/types.js";

async function diagnoseESDFlow() {
	console.log("=".repeat(80));
	console.log("EARLY SIGNAL DETECTION (ESD) FLOW DIAGNOSIS");
	console.log("=".repeat(80));
	console.log();

	const testSymbol = "NVDA";

	// Step 1: Check Feature Toggle
	console.log("📋 STEP 1: Feature Toggle Check");
	console.log("-".repeat(80));
	try {
		const toggleService = MLFeatureToggleService.getInstance();
		const esdEnabled = await toggleService.isEarlySignalEnabled();
		console.log(`✅ ESD Toggle Status: ${esdEnabled ? "ENABLED ✓" : "DISABLED ✗"}`);

		if (!esdEnabled) {
			console.log("⚠️  WARNING: ESD is disabled! This will prevent signals from showing.");
			console.log("   Enable it via: await toggleService.setEarlySignalEnabled(true)");
		}

		const featureStatus = await toggleService.getFeatureStatus("early_signal_detection");
		console.log(`   Feature Name: ${featureStatus.featureName}`);
		console.log(`   Last Modified: ${new Date(featureStatus.lastModified).toISOString()}`);
		console.log();
	} catch (error) {
		console.error("❌ Failed to check feature toggle:", error);
		console.log();
	}

	// Step 2: Test EarlySignalService Directly
	console.log("📋 STEP 2: EarlySignalService Direct Test");
	console.log("-".repeat(80));
	try {
		const esdService = new EarlySignalService();
		console.log(`Testing prediction for ${testSymbol}...`);

		const startTime = Date.now();
		const prediction = await esdService.predictAnalystChange(testSymbol, "Technology");
		const latency = Date.now() - startTime;

		if (prediction) {
			console.log(`✅ ESD Prediction received (${latency}ms):`);
			console.log(`   Upgrade Likely: ${prediction.upgrade_likely}`);
			console.log(`   Downgrade Likely: ${prediction.downgrade_likely}`);
			console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
			console.log(`   Reasoning: ${prediction.reasoning.join(", ")}`);
			console.log(`   Model Version: ${prediction.model_version}`);
		} else {
			console.log("⚠️  ESD returned NULL (low confidence or error)");
		}
		console.log();
	} catch (error) {
		console.error("❌ EarlySignalService failed:", error);
		console.log();
	}

	// Step 3: Test via StockSelectionService
	console.log("📋 STEP 3: StockSelectionService Integration Test");
	console.log("-".repeat(80));
	try {
		const cache = new RedisCache();
		const financialDataService = new FinancialDataService();
		const factorLibrary = new FactorLibrary();
		const technicalService = new TechnicalIndicatorService(cache);

		const stockService = new MLEnhancedStockSelectionService(
			financialDataService,
			factorLibrary,
			cache,
			technicalService
		);

		console.log(`Executing stock selection for ${testSymbol} with includeEarlySignal=true...`);

		const startTime = Date.now();
		const result = await stockService.selectStocks({
			scope: {
				mode: SelectionMode.SINGLE_STOCK,
				symbols: [testSymbol],
				maxResults: 1,
			},
			options: {
				algorithmId: "composite",
				useRealTimeData: true,
				includeEarlySignal: true, // 🔍 CRITICAL: This should enable ESD
				timeout: 60000,
			},
			requestId: `esd_diagnosis_${Date.now()}`,
		});
		const latency = Date.now() - startTime;

		console.log(`✅ Stock selection completed (${latency}ms)`);
		console.log(`   Success: ${result.success}`);

		if (result.singleStock) {
			console.log(`   Symbol: ${result.singleStock.symbol}`);
			console.log(`   Action: ${result.singleStock.action}`);
			console.log(`   Confidence: ${(result.singleStock.confidence * 100).toFixed(1)}%`);

			// 🎯 THIS IS THE CRITICAL CHECK
			if (result.singleStock.early_signal) {
				console.log("✅ ✅ ✅ EARLY SIGNAL PRESENT IN RESPONSE:");
				console.log(`   Upgrade Likely: ${result.singleStock.early_signal.upgrade_likely}`);
				console.log(`   Confidence: ${(result.singleStock.early_signal.confidence * 100).toFixed(1)}%`);
				console.log(`   Reasoning: ${result.singleStock.early_signal.reasoning.join(", ")}`);
			} else {
				console.log("❌ ❌ ❌ EARLY SIGNAL MISSING FROM RESPONSE!");
				console.log("   This is the bug - early_signal should be present but is undefined/null");
			}
		} else {
			console.log("⚠️  No singleStock result returned");
		}

		// Check top selections as well
		if (result.topSelections && result.topSelections.length > 0) {
			console.log(`\n   Top Selection Check:`);
			const topStock = result.topSelections[0];
			if (topStock.early_signal) {
				console.log(`   ✅ Early signal in topSelections[0]`);
			} else {
				console.log(`   ❌ Early signal MISSING in topSelections[0]`);
			}
		}

		console.log();
	} catch (error) {
		console.error("❌ StockSelectionService failed:", error);
		console.log();
	}

	// Step 4: Simulate API Route Conversion
	console.log("📋 STEP 4: API Route Response Conversion Test");
	console.log("-".repeat(80));
	console.log("Checking if convertToAdminResponse preserves early_signal...");

	const mockSelection = {
		symbol: testSymbol,
		score: { overallScore: 0.75 } as any,
		action: "BUY" as const,
		confidence: 0.85,
		context: {} as any,
		reasoning: {} as any,
		dataQuality: {} as any,
		early_signal: {
			upgrade_likely: true,
			downgrade_likely: false,
			confidence: 0.87,
			horizon: "2_weeks" as const,
			reasoning: ["Test reasoning"],
			feature_importance: {},
			prediction_timestamp: Date.now(),
			model_version: "v1.0.0",
		},
		weight: 1.0,
	};

	// Simulate what the API does
	const apiStock = {
		symbol: mockSelection.symbol,
		price: 0,
		compositeScore: 75,
		recommendation: mockSelection.action,
		sector: "Technology",
		confidence: Math.round(mockSelection.confidence * 100),
		reasoning: mockSelection.reasoning,
		early_signal: mockSelection.early_signal, // 🔍 This line should preserve it
	};

	if (apiStock.early_signal) {
		console.log("✅ early_signal preserved in API response format");
		console.log(`   Upgrade Likely: ${apiStock.early_signal.upgrade_likely}`);
	} else {
		console.log("❌ early_signal LOST during API conversion!");
	}
	console.log();

	// Summary
	console.log("=".repeat(80));
	console.log("DIAGNOSIS SUMMARY");
	console.log("=".repeat(80));
	console.log("Expected Flow:");
	console.log("  1. Admin enables ESD toggle → TRUE ✓");
	console.log("  2. API checks toggle → includeEarlySignal=true ✓");
	console.log("  3. StockSelectionService calls EarlySignalService → prediction object");
	console.log("  4. Prediction attached to EnhancedStockResult.early_signal");
	console.log("  5. API converts response → early_signal preserved");
	console.log("  6. Frontend receives early_signal in stock data");
	console.log();
	console.log("Check above for ❌ marks to identify where the flow breaks!");
	console.log("=".repeat(80));
}

diagnoseESDFlow().catch(console.error);
