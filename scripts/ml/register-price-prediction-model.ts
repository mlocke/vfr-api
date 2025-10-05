/**
 * Register Price Prediction Model v1.1.0
 *
 * Registers the trained LightGBM price prediction model in the ModelRegistry database
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

async function registerPricePredictionModel() {
	console.log("=== Price Prediction Model Registration ===\n");

	try {
		// Load metadata from trained model
		const metadataPath = path.join(process.cwd(), "models/price-prediction/v1.1.0/metadata.json");
		const metadataContent = fs.readFileSync(metadataPath, "utf-8");
		const metadata = JSON.parse(metadataContent);

		console.log("✓ Loaded model metadata from:", metadataPath);
		console.log(`  - Algorithm: ${metadata.algorithm}`);
		console.log(`  - Trained: ${metadata.trained_at}`);
		console.log(`  - Features: ${metadata.num_features}`);
		console.log(`  - Classes: ${metadata.num_classes} (${metadata.class_labels.join(", ")})`);
		console.log();

		// Extract metrics from metadata
		const testMetrics = metadata.metrics.classification_report;
		const overallAccuracy = metadata.metrics.accuracy;

		// Initialize ModelRegistry
		const registry = ModelRegistry.getInstance();
		await registry.initialize();
		console.log("✓ ModelRegistry initialized\n");

		// Convert feature importance from array to object
		const featureImportance: Record<string, number> = {};
		metadata.metrics.feature_importance.forEach((item: { feature: string; importance: number }) => {
			featureImportance[item.feature] = item.importance;
		});

		// Prepare registration input
		const weightedAvg = testMetrics["weighted avg"];

		const registrationInput = {
			modelName: "price-prediction",
			modelVersion: "1.1.0",
			modelType: ModelType.LIGHTGBM,
			objective: ModelObjective.DIRECTION_CLASSIFICATION,
			targetVariable: "price_direction",
			predictionHorizon: "7d", // 7-day price movement prediction
			validationScore: overallAccuracy, // Using test accuracy as validation score
			testScore: overallAccuracy, // 46% test accuracy
			tierRequirement: TierRequirement.PREMIUM,
			status: ModelStatus.VALIDATED,
			artifactPath: "models/price-prediction/v1.1.0",
			hyperparameters: metadata.hyperparameters,
			featureImportance: featureImportance,
			trainingMetrics: {
				validation: {
					accuracy: overallAccuracy,
					precision: weightedAvg.precision,
					recall: weightedAvg.recall,
					f1: weightedAvg["f1-score"],
				},
				test: {
					accuracy: overallAccuracy,
					precision: weightedAvg.precision,
					recall: weightedAvg.recall,
					f1: weightedAvg["f1-score"],
					classMetrics: {
						DOWN: testMetrics.DOWN,
						NEUTRAL: testMetrics.NEUTRAL,
						UP: testMetrics.UP,
					},
				},
				trainingExamples: 51240, // From split
				validationExamples: 10980,
				testExamples: 10980,
				totalExamples: 73200,
				trainedAt: metadata.trained_at,
			},
		};

		console.log("Registering model with the following details:");
		console.log("  - Model Name:", registrationInput.modelName);
		console.log("  - Version:", registrationInput.modelVersion);
		console.log("  - Type:", registrationInput.modelType);
		console.log("  - Objective:", registrationInput.objective);
		console.log("  - Target Variable:", registrationInput.targetVariable);
		console.log("  - Prediction Horizon:", registrationInput.predictionHorizon);
		console.log("  - Test Accuracy:", (registrationInput.testScore * 100).toFixed(2) + "%");
		console.log("  - Status:", registrationInput.status);
		console.log("  - Tier:", registrationInput.tierRequirement);
		console.log("  - Training Examples:", registrationInput.trainingMetrics.trainingExamples);
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
			console.log("Top 10 Most Important Features:");
			if (result.data?.featureImportance) {
				const sortedFeatures = Object.entries(result.data.featureImportance)
					.sort(([, a], [, b]) => (b as number) - (a as number))
					.slice(0, 10);
				sortedFeatures.forEach(([feature, importance], idx) => {
					console.log(`  ${idx + 1}. ${feature}: ${importance}`);
				});
			}
			console.log();
			console.log("Per-Class Performance:");
			console.log("  - DOWN: Precision", (testMetrics.DOWN.precision * 100).toFixed(1) + "%, Recall", (testMetrics.DOWN.recall * 100).toFixed(1) + "%");
			console.log("  - NEUTRAL: Precision", (testMetrics.NEUTRAL.precision * 100).toFixed(1) + "%, Recall", (testMetrics.NEUTRAL.recall * 100).toFixed(1) + "%");
			console.log("  - UP: Precision", (testMetrics.UP.precision * 100).toFixed(1) + "%, Recall", (testMetrics.UP.recall * 100).toFixed(1) + "%");
		} else {
			console.error("❌ Model registration failed!");
			console.error("Error:", result.error?.message);
			if (result.error?.message?.includes("already exists")) {
				console.log("\nNote: Model is already registered. Use updateModel() to modify it.");
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
registerPricePredictionModel();
