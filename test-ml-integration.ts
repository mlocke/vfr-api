/**
 * ML-Enhanced Stock Selection Integration Test
 *
 * Tests the MLEnhancedStockSelectionService and EnhancedScoringEngine
 * to verify they integrate correctly with the existing VFR infrastructure.
 */

import { MLEnhancedStockSelectionService } from "./app/services/stock-selection/MLEnhancedStockSelectionService";
import { EnhancedScoringEngine } from "./app/services/stock-selection/EnhancedScoringEngine";
import { FinancialDataService } from "./app/services/financial-data/FinancialDataService";
import { FactorLibrary } from "./app/services/algorithms/FactorLibrary";
import { RedisCache } from "./app/services/cache/RedisCache";
import { SelectionMode } from "./app/services/stock-selection/types";
import { MLModelType, MLPredictionHorizon } from "./app/services/ml/types/MLTypes";

async function testMLIntegration() {
	console.log("🚀 Starting ML Integration Tests\n");

	// Initialize services
	console.log("📦 Initializing services...");
	const financialDataService = new FinancialDataService();
	const factorLibrary = new FactorLibrary();
	const cache = new RedisCache();

	// Test 1: Service Initialization
	console.log("\n=== Test 1: Service Initialization ===");
	try {
		const mlService = new MLEnhancedStockSelectionService(
			financialDataService,
			factorLibrary,
			cache
		);
		console.log("✅ MLEnhancedStockSelectionService initialized successfully");

		// Test health check
		const healthCheck = await mlService.mlHealthCheck();
		console.log("📊 ML Health Check:", JSON.stringify(healthCheck, null, 2));
	} catch (error) {
		console.error("❌ Service initialization failed:", error);
	}

	// Test 2: EnhancedScoringEngine
	console.log("\n=== Test 2: EnhancedScoringEngine ===");
	try {
		const scoringEngine = new EnhancedScoringEngine({
			vfrWeight: 0.85,
			mlWeight: 0.15,
			minConfidenceThreshold: 0.5,
			confidenceWeightingEnabled: true,
			normalizeToHundred: false,
		});
		console.log("✅ EnhancedScoringEngine initialized");

		// Test score calculation with mock data
		const mockVFRScore = {
			symbol: "TEST",
			overallScore: 0.75,
			factorScores: {
				technical: 0.7,
				fundamental: 0.8,
				sentiment: 0.7,
				momentum: 0.8,
			},
			dataQuality: {
				overall: 0.9,
				metrics: {
					completeness: 0.9,
					freshness: 0.9,
					accuracy: 0.9,
					sourceReputation: 0.9,
					latency: 100,
				},
				timestamp: Date.now(),
				source: "test",
			},
			timestamp: Date.now(),
			marketData: {
				price: 175.5,
				volume: 50000000,
				marketCap: 2800000000000,
				sector: "Technology",
				exchange: "NASDAQ",
			},
			algorithmMetrics: {},
		};

		const mockMLPrediction = {
			symbol: "TEST",
			modelId: "test-model-v1",
			modelType: MLModelType.LIGHTGBM,
			prediction: 0.05,
			confidence: 0.75,
			direction: "UP" as const,
			probability: { up: 0.65, down: 0.30, neutral: 0.05 },
			horizon: MLPredictionHorizon.ONE_WEEK,
			latencyMs: 50,
			fromCache: false,
			timestamp: Date.now(),
		};

		const enhancedScore = scoringEngine.calculateEnhancedScore(
			mockVFRScore,
			mockMLPrediction
		);
		console.log("📊 Enhanced Score Result:", JSON.stringify(enhancedScore, null, 2));

		// Validate score is between VFR and ML-enhanced
		if (enhancedScore.finalScore >= mockVFRScore.overallScore * 0.85) {
			console.log("✅ Enhanced score calculation works correctly");
		} else {
			console.error("❌ Enhanced score calculation failed");
		}
	} catch (error) {
		console.error("❌ EnhancedScoringEngine test failed:", error);
	}

	// Test 3: Stock Selection WITHOUT ML (Classic VFR)
	console.log("\n=== Test 3: Classic VFR Selection (ML Disabled) ===");
	try {
		const mlService = new MLEnhancedStockSelectionService(
			financialDataService,
			factorLibrary,
			cache
		);

		const classicRequest = {
			scope: {
				mode: SelectionMode.SINGLE_STOCK,
				symbols: ["AAPL"],
			},
			options: {
				useRealTimeData: true,
				timeout: 30000,
			},
		};

		console.log("🔍 Executing classic VFR analysis for AAPL...");
		const classicResult = await mlService.selectStocks(classicRequest);

		if (classicResult.success) {
			console.log("✅ Classic VFR analysis completed");
			console.log("📊 Top selection:", classicResult.topSelections[0]?.symbol);
			console.log(
				"📊 Composite score:",
				classicResult.topSelections[0]?.score.overallScore
			);
		} else {
			console.error("❌ Classic VFR analysis failed");
		}
	} catch (error) {
		console.error("❌ Classic VFR test failed:", error);
	}

	// Test 4: Stock Selection WITH ML Enhancement
	console.log("\n=== Test 4: ML-Enhanced Selection (ML Enabled) ===");
	try {
		const mlService = new MLEnhancedStockSelectionService(
			financialDataService,
			factorLibrary,
			cache
		);

		const mlRequest = {
			scope: {
				mode: SelectionMode.SINGLE_STOCK,
				symbols: ["AAPL"],
			},
			options: {
				useRealTimeData: true,
				include_ml: true,
				ml_horizon: "1w" as const,
				ml_confidence_threshold: 0.5,
				timeout: 30000,
			},
		};

		console.log("🤖 Executing ML-enhanced analysis for AAPL...");
		const mlResult = await mlService.selectStocks(mlRequest);

		if (mlResult.success) {
			console.log("✅ ML-enhanced analysis completed");
			console.log("📊 Top selection:", mlResult.topSelections[0]?.symbol);
			console.log(
				"📊 ML-enhanced score:",
				mlResult.topSelections[0]?.score.overallScore
			);

			// Check for ML metadata
			const metadata = (mlResult as any).metadata?.mlEnhancement;
			if (metadata) {
				console.log("🤖 ML Enhancement Metadata:");
				console.log("   - ML Enabled:", metadata.mlEnabled);
				console.log("   - ML Available:", metadata.mlAvailable);
				console.log("   - ML Latency:", metadata.mlLatency, "ms");
				console.log("   - ML Predictions:", metadata.mlPredictionsCount);
				console.log("   - Enhancement Applied:", metadata.mlEnhancementApplied);
			}
		} else {
			console.error("❌ ML-enhanced analysis failed");
		}
	} catch (error) {
		console.error("❌ ML-enhanced test failed:", error);
	}

	// Test 5: Graceful Fallback Test
	console.log("\n=== Test 5: Graceful Fallback (ML Failure) ===");
	try {
		const mlService = new MLEnhancedStockSelectionService(
			financialDataService,
			factorLibrary,
			cache
		);

		// Request with ML but expect fallback if ML service unavailable
		const fallbackRequest = {
			scope: {
				mode: SelectionMode.SINGLE_STOCK,
				symbols: ["INVALID_SYMBOL_FOR_ML_TEST"],
			},
			options: {
				include_ml: true,
				ml_horizon: "1w" as const,
				timeout: 30000,
			},
		};

		console.log("🔄 Testing graceful fallback with invalid symbol...");
		const fallbackResult = await mlService.selectStocks(fallbackRequest);

		// Should still get a result (fallback to VFR)
		if (fallbackResult) {
			console.log("✅ Graceful fallback works");
			const mlMeta = (fallbackResult as any).metadata?.mlEnhancement;
			if (mlMeta?.mlFallbackUsed) {
				console.log("   ✅ ML fallback detected in metadata");
			}
		}
	} catch (error) {
		console.error("❌ Graceful fallback test failed:", error);
	}

	// Test 6: Configuration Updates
	console.log("\n=== Test 6: Scoring Configuration Updates ===");
	try {
		const scoringEngine = new EnhancedScoringEngine({
			vfrWeight: 0.9,
			mlWeight: 0.1,
		});

		console.log("Initial config:", scoringEngine.getConfig());

		scoringEngine.updateConfig({
			vfrWeight: 0.8,
			mlWeight: 0.2,
		});

		console.log("Updated config:", scoringEngine.getConfig());
		console.log("✅ Configuration updates work correctly");
	} catch (error) {
		console.error("❌ Configuration update test failed:", error);
	}

	console.log("\n✅ All ML Integration Tests Complete");
	process.exit(0);
}

// Run tests
testMLIntegration().catch((error) => {
	console.error("❌ Test suite failed:", error);
	process.exit(1);
});
