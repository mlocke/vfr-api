/**
 * Deploy Smart Money Flow Model v3.0.0
 *
 * Deploys the smart-money-flow model to production (sets status to DEPLOYED)
 * This will make the model available for the ML ensemble predictEnsemble() calls
 */

import { ModelRegistry, ModelStatus } from "../../app/services/ml/models/ModelRegistry";

async function deploySmartMoneyFlowModel() {
	console.log("=== Deploy Smart Money Flow Model ===\n");

	try {
		// Initialize ModelRegistry
		const registry = ModelRegistry.getInstance();
		await registry.initialize();
		console.log("✓ ModelRegistry initialized\n");

		// Get the smart-money-flow v3.0.0 model
		console.log("Looking up smart-money-flow v3.0.0...");
		const modelResult = await registry.getModelByNameVersion("smart-money-flow", "3.0.0");

		if (!modelResult.success) {
			console.error("❌ Model not found!");
			console.error("Error:", modelResult.error?.message);
			console.log("\nMake sure to register the model first:");
			console.log("  npx tsx scripts/ml/register-smart-money-flow-model.ts");
			process.exit(1);
		}

		const model = modelResult.data!;
		console.log("✓ Found model:", model.modelName, "v" + model.modelVersion);
		console.log("  - Current Status:", model.status);
		console.log("  - Model ID:", model.modelId);
		console.log();

		// Deploy the model
		console.log("Deploying model...");
		const deployResult = await registry.deployModel(model.modelId);

		if (!deployResult.success) {
			console.error("❌ Deployment failed!");
			console.error("Error:", deployResult.error?.message);
			process.exit(1);
		}

		console.log("✅ Model deployed successfully!\n");
		console.log("Deployment Details:");
		console.log("  - Model Name:", deployResult.data?.modelName);
		console.log("  - Version:", deployResult.data?.modelVersion);
		console.log("  - Status:", deployResult.data?.status);
		console.log("  - Updated At:", deployResult.data?.updatedAt);
		console.log("  - Latency:", deployResult.metadata?.latency + "ms");
		console.log();

		// Verify deployment by checking deployed models
		console.log("Verifying ensemble configuration...");
		const deployedModels = await registry.getDeployedModels();

		if (deployedModels.success && deployedModels.data) {
			console.log("\n✓ Active Ensemble Models:");
			deployedModels.data.forEach((m, idx) => {
				console.log(`  ${idx + 1}. ${m.modelName} v${m.modelVersion} (${m.status})`);
			});
			console.log(`\n  Total: ${deployedModels.data.length} models in ensemble`);
		}

		console.log("\n📊 Ensemble Weights:");
		console.log("  - sentiment-fusion:     45% (most comprehensive)");
		console.log("  - price-prediction:     27% (baseline technicals)");
		console.log("  - early-signal:         18% (analyst upgrades)");
		console.log("  - smart-money-flow:     10% (institutional activity) ✨ NEW");
		console.log();

		console.log("⚠️  IMPORTANT: Feature Toggle Status");
		console.log("Smart Money Flow is currently DISABLED by default.");
		console.log("To enable it, go to Admin Dashboard → ML Feature Toggles → Smart Money Flow");
		console.log();

		console.log("🎯 Testing the Ensemble");
		console.log("Once enabled, test with:");
		console.log("  curl -X POST http://localhost:3000/api/stocks/analyze \\");
		console.log("    -H 'Content-Type: application/json' \\");
		console.log("    -d '{");
		console.log('      "mode": "single",');
		console.log('      "symbol": "AAPL",');
		console.log('      "include_ml": true');
		console.log("    }'");
		console.log();

		console.log("The ensemble will now use all 4 models (45% + 27% + 18% + 10% = 100%)");

	} catch (error: any) {
		console.error("❌ Deployment failed with error:", error.message);
		console.error(error);
		process.exit(1);
	}

	console.log("\n=== Deployment Complete ===");
	process.exit(0);
}

// Run deployment
deploySmartMoneyFlowModel();
