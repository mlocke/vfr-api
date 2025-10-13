/**
 * Register Smart Money Flow Model v3.0.0
 *
 * Registers the trained LightGBM smart money flow model in the ModelRegistry database
 * with all metadata, feature importance, and performance metrics.
 */

import {
	ModelRegistry,
	ModelType,
	ModelObjective,
	ModelStatus,
	TierRequirement,
} from "../../app/services/ml/models/ModelRegistry";
import * as fs from "fs";
import * as path from "path";

async function registerSmartMoneyFlowModel() {
	console.log("=== Smart Money Flow Model Registration ===\n");

	try {
		// Load metadata from trained model
		const metadataPath = path.join(process.cwd(), "app/services/ml/smart-money-flow/models/model_metadata.json");
		const metadataContent = fs.readFileSync(metadataPath, "utf-8");
		const metadata = JSON.parse(metadataContent);

		console.log("✓ Loaded model metadata from:", metadataPath);
		console.log(`  - Model Type: ${metadata.model_type}`);
		console.log(`  - Timestamp: ${metadata.timestamp}`);
		console.log(`  - Features: ${metadata.num_features}`);
		console.log(`  - Target: ${metadata.target}`);
		console.log();

		// Initialize ModelRegistry
		const registry = ModelRegistry.getInstance();
		await registry.initialize();
		console.log("✓ ModelRegistry initialized\n");

		// Convert feature columns to feature importance (equal weight for now since not in metadata)
		const featureImportance: Record<string, number> = {};
		const equalWeight = 1.0 / metadata.num_features;
		metadata.feature_cols.forEach((feature: string) => {
			featureImportance[feature] = equalWeight;
		});

		// Prepare registration input
		const registrationInput = {
			modelName: "smart-money-flow",
			modelVersion: "3.0.0",
			modelType: ModelType.LIGHTGBM,
			objective: ModelObjective.PRICE_PREDICTION, // Predicts 14-day returns
			targetVariable: metadata.target, // return_14d
			predictionHorizon: "14d", // 14-day return prediction
			validationScore: 1 - metadata.metrics.val.rmse, // Convert RMSE to score (lower is better)
			testScore: 1 - metadata.metrics.test.rmse, // 92.4% (1 - 0.0757 RMSE)
			tierRequirement: TierRequirement.PREMIUM,
			status: ModelStatus.VALIDATED, // Mark as validated, will deploy separately
			artifactPath: "app/services/ml/smart-money-flow/models",
			hyperparameters: {
				num_iterations: metadata.best_iteration,
				objective: "regression",
				metric: "rmse",
			},
			featureImportance: featureImportance,
			trainingMetrics: {
				validation: {
					rmse: metadata.metrics.val.rmse,
					mae: metadata.metrics.val.mae,
					r2: metadata.metrics.val.r2,
				},
				test: {
					rmse: metadata.metrics.test.rmse,
					mae: metadata.metrics.test.mae,
					r2: metadata.metrics.test.r2,
				},
				train: {
					rmse: metadata.metrics.train.rmse,
					mae: metadata.metrics.train.mae,
					r2: metadata.metrics.train.r2,
				},
				trainedAt: metadata.timestamp,
			},
		};

		console.log("Registering model with the following details:");
		console.log("  - Model Name:", registrationInput.modelName);
		console.log("  - Version:", registrationInput.modelVersion);
		console.log("  - Type:", registrationInput.modelType);
		console.log("  - Objective:", registrationInput.objective);
		console.log("  - Target Variable:", registrationInput.targetVariable);
		console.log("  - Prediction Horizon:", registrationInput.predictionHorizon);
		console.log("  - Test RMSE:", metadata.metrics.test.rmse.toFixed(4));
		console.log("  - Test R²:", (metadata.metrics.test.r2 * 100).toFixed(2) + "%");
		console.log("  - Status:", registrationInput.status);
		console.log("  - Tier:", registrationInput.tierRequirement);
		console.log();

		// Register the model
		const result = await registry.registerModel(registrationInput);

		if (result.success) {
			console.log("✅ Model registered successfully!\n");
			console.log("Model Details:");
			console.log("  - Model ID:", result.data?.modelId);
			console.log("  - Model Name:", result.data?.modelName);
			console.log("  - Version:", result.data?.modelVersion);
			console.log("  - Status:", result.data?.status);
			console.log("  - Created At:", result.data?.createdAt);
			console.log("  - Latency:", result.metadata?.latency + "ms");
			console.log();
			console.log("Feature Groups:");
			console.log("  - Congressional Trading: 4 features (buy/sell counts, sentiment, recent activity)");
			console.log("  - Institutional Activity: 3 features (volume ratio, concentration, dark pool)");
			console.log("  - Price/Volume Technicals: 3 features (momentum, trend, volatility)");
			console.log("  - Options Activity: 17 features (put/call ratios, premiums, OI, Greeks, IV)");
			console.log("  Total: 27 features");
			console.log();
			console.log("Performance Metrics:");
			console.log("  - Train RMSE:", metadata.metrics.train.rmse.toFixed(4));
			console.log("  - Val RMSE:", metadata.metrics.val.rmse.toFixed(4));
			console.log("  - Test RMSE:", metadata.metrics.test.rmse.toFixed(4));
			console.log("  - Test R²:", (metadata.metrics.test.r2 * 100).toFixed(2) + "%");
			console.log();
			console.log("Next Steps:");
			console.log("  1. Deploy the model:");
			console.log("     npx tsx scripts/ml/deploy-smart-money-flow-model.ts");
			console.log();
			console.log("  2. Enable the feature toggle in admin dashboard");
			console.log("     (Smart Money Flow is disabled by default)");
		} else {
			console.error("❌ Model registration failed!");
			console.error("Error:", result.error?.message);
			if (result.error?.message?.includes("already exists")) {
				console.log("\nNote: Model is already registered. Use updateModel() to modify it or deploy it.");
				console.log("\nTo deploy the model:");
				console.log("  npx tsx scripts/ml/deploy-smart-money-flow-model.ts");
			}
			process.exit(1);
		}
	} catch (error: any) {
		console.error("❌ Registration failed with error:", error.message);
		console.error(error);
		process.exit(1);
	}

	console.log("\n=== Registration Complete ===");
	process.exit(0);
}

// Run registration
registerSmartMoneyFlowModel();
