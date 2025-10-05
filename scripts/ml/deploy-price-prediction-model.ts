/**
 * Deploy Price Prediction Model v1.1.0
 *
 * Sets the price prediction model status to DEPLOYED, making it available
 * for production use through RealTimePredictionEngine.
 */

import { ModelRegistry } from "../../app/services/ml/models/ModelRegistry";

async function deployPricePredictionModel() {
	console.log("=== Price Prediction Model Deployment ===\n");

	try {
		// Initialize ModelRegistry
		const registry = ModelRegistry.getInstance();
		await registry.initialize();
		console.log("✓ ModelRegistry initialized\n");

		// Get the price prediction model
		console.log("Searching for price-prediction v1.1.0...");
		const models = await registry.listModels({ limit: 100 });

		if (!models.success || !models.data) {
			console.error("❌ Failed to list models:", models.error?.message);
			process.exit(1);
		}

		const pricePredictionModel = models.data.find(
			(m) => m.modelName === "price-prediction" && m.modelVersion === "1.1.0"
		);

		if (!pricePredictionModel) {
			console.error("❌ Price prediction model v1.1.0 not found!");
			console.log("Available models:");
			models.data.forEach((m) => {
				console.log(`  - ${m.modelName} v${m.modelVersion} (${m.status})`);
			});
			process.exit(1);
		}

		console.log("✓ Found price-prediction v1.1.0");
		console.log(`  - Model ID: ${pricePredictionModel.modelId}`);
		console.log(`  - Current Status: ${pricePredictionModel.status}`);
		console.log(`  - Accuracy: ${(pricePredictionModel.testScore! * 100).toFixed(2)}%`);
		console.log();

		// Deploy the model
		if (pricePredictionModel.status === "deployed") {
			console.log("⚠️  Model is already deployed. No action needed.");
		} else {
			console.log("Deploying model...");
			const deployResult = await registry.deployModel(pricePredictionModel.modelId);

			if (deployResult.success) {
				console.log("✅ Model deployed successfully!\n");
				console.log("Model Details:");
				console.log("  - Model ID:", deployResult.data?.modelId);
				console.log("  - Model Name:", deployResult.data?.modelName);
				console.log("  - Version:", deployResult.data?.modelVersion);
				console.log("  - Status:", deployResult.data?.status);
				console.log("  - Prediction Horizon:", deployResult.data?.predictionHorizon);
				console.log("  - Target Variable:", deployResult.data?.targetVariable);
				console.log();
				console.log("The model is now available for production use!");
				console.log("RealTimePredictionEngine will use this model for 7-day price predictions.");
			} else {
				console.error("❌ Model deployment failed!");
				console.error("Error:", deployResult.error?.message);
				process.exit(1);
			}
		}
	} catch (error: any) {
		console.error("❌ Deployment failed with error:", error.message);
		console.error(error);
		process.exit(1);
	}

	console.log("\n=== Deployment Complete ===");
	process.exit(0);
}

// Run deployment
deployPricePredictionModel();
