/**
 * ModelValidator Tests
 *
 * Comprehensive test suite covering:
 * - Model configuration validation
 * - Performance metrics validation
 * - Model size validation
 * - Artifact integrity validation
 * - Feature compatibility validation
 * - Hyperparameter validation (all model types)
 * - Loading time validation
 * - Deployment validation (comprehensive)
 * - Custom threshold configuration
 *
 * Following VFR testing patterns with >80% coverage target
 */

import {
	ModelValidator,
	DEFAULT_VALIDATION_THRESHOLDS,
	HYPERPARAMETER_RANGES,
} from "../ModelValidator";
import {
	MLModelType,
	MLModelConfig,
	MLModelPerformance,
	MLModelStatus,
	MLPredictionHorizon,
} from "../../types/MLTypes";
import * as fs from "fs";
import * as crypto from "crypto";
import * as path from "path";
import * as os from "os";

describe("ModelValidator", () => {
	let validator: ModelValidator;
	let tempDir: string;

	beforeAll(() => {
		// Create temporary directory for test files
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "model-validator-test-"));
	});

	afterAll(() => {
		// Clean up temporary directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	beforeEach(() => {
		validator = new ModelValidator();
	});

	// ===== Test Data Helpers =====

	function createValidModelConfig(): MLModelConfig {
		return {
			modelId: "test-model-001",
			modelType: MLModelType.LIGHTGBM,
			version: "1.0.0",
			status: MLModelStatus.TRAINING,
			horizon: MLPredictionHorizon.ONE_DAY,
			features: ["rsi", "macd", "sma_20", "ema_50", "bollinger_upper", "bollinger_lower"],
			hyperparameters: {
				num_leaves: 31,
				learning_rate: 0.1,
				n_estimators: 100,
			},
			performanceMetrics: createValidPerformanceMetrics(),
			createdAt: Date.now() - 86400000, // 1 day ago
			updatedAt: Date.now(),
		};
	}

	function createValidPerformanceMetrics(): MLModelPerformance {
		return {
			accuracy: 0.75,
			precision: 0.7,
			recall: 0.72,
			f1Score: 0.71,
			sharpeRatio: 1.2,
			validationAccuracy: 0.73,
			trainingLoss: 0.25,
			validationLoss: 0.28,
			lastUpdated: Date.now(),
		};
	}

	function createValidHyperparameters(modelType: MLModelType): Record<string, any> {
		const defaults: Record<MLModelType, Record<string, any>> = {
			[MLModelType.LIGHTGBM]: {
				num_leaves: 31,
				learning_rate: 0.1,
				n_estimators: 100,
				max_depth: 10,
			},
			[MLModelType.XGBOOST]: {
				max_depth: 6,
				learning_rate: 0.1,
				n_estimators: 100,
				subsample: 0.8,
			},
			[MLModelType.LSTM]: {
				units: 128,
				layers: 2,
				dropout: 0.2,
				sequence_length: 30,
			},
			[MLModelType.ENSEMBLE]: {
				voting_type: "soft",
				model_count: 3,
				aggregation_method: "mean",
			},
		};
		return defaults[modelType];
	}

	function createTempFile(content: string, filename: string = "test-model.bin"): string {
		const filePath = path.join(tempDir, filename);
		fs.writeFileSync(filePath, content, "utf8");
		return filePath;
	}

	function calculateChecksum(filePath: string): string {
		const fileBuffer = fs.readFileSync(filePath);
		const hash = crypto.createHash("sha256");
		hash.update(fileBuffer);
		return hash.digest("hex");
	}

	// ===== Model Config Validation Tests =====

	describe("validateModelConfig", () => {
		it("should validate a valid model config successfully", () => {
			const config = createValidModelConfig();
			const result = validator.validateModelConfig(config);

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
			expect(result.validatedFields.length).toBeGreaterThan(0);
			expect(result.validatedFields).toContain("modelId");
			expect(result.validatedFields).toContain("version");
			expect(result.validatedFields).toContain("modelType");
			expect(result.validatedFields).toContain("features");
		});

		it("should reject config with missing modelId", () => {
			const config = createValidModelConfig();
			config.modelId = "";

			const result = validator.validateModelConfig(config);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Model ID"))).toBe(true);
		});

		it("should reject config with invalid modelId characters", () => {
			const config = createValidModelConfig();
			config.modelId = "invalid model@id!";

			const result = validator.validateModelConfig(config);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("alphanumeric"))).toBe(true);
		});

		it("should reject config with invalid model type", () => {
			const config = createValidModelConfig();
			config.modelType = "INVALID_TYPE" as MLModelType;

			const result = validator.validateModelConfig(config);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Invalid model type"))).toBe(true);
		});

		it("should reject config with empty version", () => {
			const config = createValidModelConfig();
			config.version = "";

			const result = validator.validateModelConfig(config);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("version"))).toBe(true);
		});

		it("should warn about non-semantic versioning", () => {
			const config = createValidModelConfig();
			config.version = "v1";

			const result = validator.validateModelConfig(config);

			expect(result.warnings.some(w => w.includes("semantic versioning"))).toBe(true);
		});

		it("should reject config with empty features array", () => {
			const config = createValidModelConfig();
			config.features = [];

			const result = validator.validateModelConfig(config);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Features array cannot be empty"))).toBe(
				true
			);
		});

		it("should warn about low feature count", () => {
			const config = createValidModelConfig();
			config.features = ["feature1", "feature2", "feature3"];

			const result = validator.validateModelConfig(config);

			expect(result.warnings.some(w => w.includes("Low feature count"))).toBe(true);
		});

		it("should reject config with invalid createdAt timestamp", () => {
			const config = createValidModelConfig();
			config.createdAt = 0;

			const result = validator.validateModelConfig(config);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("createdAt"))).toBe(true);
		});

		it("should reject config with updatedAt earlier than createdAt", () => {
			const config = createValidModelConfig();
			config.createdAt = Date.now();
			config.updatedAt = Date.now() - 86400000; // 1 day ago

			const result = validator.validateModelConfig(config);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("updatedAt cannot be earlier"))).toBe(true);
		});

		it("should reject config with deployedAt earlier than createdAt", () => {
			const config = createValidModelConfig();
			config.createdAt = Date.now();
			config.deployedAt = Date.now() - 86400000; // 1 day ago

			const result = validator.validateModelConfig(config);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("deployedAt cannot be earlier"))).toBe(true);
		});
	});

	// ===== Performance Metrics Validation Tests =====

	describe("validatePerformanceMetrics", () => {
		it("should validate metrics that meet all thresholds", () => {
			const metrics = createValidPerformanceMetrics();
			const result = validator.validatePerformanceMetrics(metrics, "test-model-001");

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
			expect(result.passedThresholds.accuracy).toBe(true);
			expect(result.passedThresholds.precision).toBe(true);
			expect(result.passedThresholds.recall).toBe(true);
			expect(result.passedThresholds.f1Score).toBe(true);
			expect(result.passedThresholds.sharpeRatio).toBe(true);
		});

		it("should reject metrics with low accuracy", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.accuracy = 0.5; // Below 0.60 threshold

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Accuracy"))).toBe(true);
			expect(result.passedThresholds.accuracy).toBe(false);
			expect(result.actualValues.accuracy).toBe(0.5);
		});

		it("should reject metrics with low precision", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.precision = 0.45; // Below 0.55 threshold

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Precision"))).toBe(true);
			expect(result.passedThresholds.precision).toBe(false);
		});

		it("should reject metrics with low recall", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.recall = 0.5; // Below 0.55 threshold

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Recall"))).toBe(true);
			expect(result.passedThresholds.recall).toBe(false);
		});

		it("should reject metrics with low F1 score", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.f1Score = 0.4; // Below 0.55 threshold

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("F1 Score"))).toBe(true);
			expect(result.passedThresholds.f1Score).toBe(false);
		});

		it("should reject metrics with low Sharpe ratio", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.sharpeRatio = 0.3; // Below 0.5 threshold

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Sharpe Ratio"))).toBe(true);
			expect(result.passedThresholds.sharpeRatio).toBe(false);
		});

		it("should detect overfitting with training >> validation accuracy", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.accuracy = 0.9;
			metrics.validationAccuracy = 0.65; // 25% gap - possible overfitting

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.warnings.some(w => w.includes("overfitting"))).toBe(true);
		});

		it("should warn about exceptionally high Sharpe ratio", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.sharpeRatio = 2.5;

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.warnings.some(w => w.includes("exceptionally high"))).toBe(true);
		});

		it("should reject negative training loss", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.trainingLoss = -0.1;

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Training loss cannot be negative"))).toBe(
				true
			);
		});

		it("should reject negative validation loss", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.validationLoss = -0.2;

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Validation loss cannot be negative"))).toBe(
				true
			);
		});

		it("should warn about validation loss significantly higher than training loss", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.trainingLoss = 0.1;
			metrics.validationLoss = 0.3; // 3x training loss

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.warnings.some(w => w.includes("significantly higher"))).toBe(true);
		});

		it("should warn when accuracy is only slightly above threshold", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.accuracy = 0.61; // Just above 0.60 threshold

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.warnings.some(w => w.includes("only slightly above"))).toBe(true);
		});

		it("should reject low validation accuracy", () => {
			const metrics = createValidPerformanceMetrics();
			metrics.validationAccuracy = 0.5; // Below 0.60 threshold

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Validation accuracy"))).toBe(true);
		});
	});

	// ===== Model Size Validation Tests =====

	describe("validateModelSize", () => {
		it("should validate small model (<1MB)", () => {
			const content = "x".repeat(500 * 1024); // 500KB
			const filePath = createTempFile(content, "small-model.bin");

			const result = validator.validateModelSize(filePath, "test-model-001");

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
			expect(result.actualSizeMB).toBeLessThan(1);
			expect(result.validatedFields).toContain("artifactExists");
			expect(result.validatedFields).toContain("sizeWithinLimit");
		});

		it("should validate medium model (~50MB)", () => {
			const content = "x".repeat(50 * 1024 * 1024); // 50MB
			const filePath = createTempFile(content, "medium-model.bin");

			const result = validator.validateModelSize(filePath, "test-model-002");

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
			expect(result.actualSizeMB).toBeGreaterThan(49);
			expect(result.actualSizeMB).toBeLessThan(51);
		});

		it("should validate large model at threshold (100MB)", () => {
			// Create a file that's exactly at the 100MB threshold
			const content = "x".repeat(100 * 1024 * 1024);
			const filePath = createTempFile(content, "large-model.bin");

			const result = validator.validateModelSize(filePath, "test-model-003");

			expect(result.isValid).toBe(true);
			expect(result.actualSizeMB).toBeGreaterThanOrEqual(99.9);
			expect(result.actualSizeMB).toBeLessThanOrEqual(100.1);
		});

		it("should reject oversized model (>100MB)", () => {
			const content = "x".repeat(150 * 1024 * 1024); // 150MB
			const filePath = createTempFile(content, "oversized-model.bin");

			const result = validator.validateModelSize(filePath, "test-model-004");

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("exceeds maximum"))).toBe(true);
			expect(result.actualSizeMB).toBeGreaterThan(100);
		});

		it("should warn about models approaching size limit", () => {
			const content = "x".repeat(85 * 1024 * 1024); // 85MB (>80% of 100MB)
			const filePath = createTempFile(content, "large-approaching-model.bin");

			const result = validator.validateModelSize(filePath, "test-model-005");

			expect(result.isValid).toBe(true);
			expect(result.warnings.some(w => w.includes("approaching maximum"))).toBe(true);
		});

		it("should warn about unusually small models", () => {
			const content = "x".repeat(50 * 1024); // 50KB
			const filePath = createTempFile(content, "tiny-model.bin");

			const result = validator.validateModelSize(filePath, "test-model-006");

			expect(result.isValid).toBe(true);
			expect(result.warnings.some(w => w.includes("unusually small"))).toBe(true);
		});

		it("should handle file not found", () => {
			const filePath = path.join(tempDir, "nonexistent-model.bin");

			const result = validator.validateModelSize(filePath, "test-model-007");

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("not found"))).toBe(true);
			expect(result.actualSizeMB).toBe(0);
		});
	});

	// ===== Artifact Integrity Validation Tests =====

	describe("validateArtifactIntegrity", () => {
		it("should validate artifact with correct checksum", () => {
			const content = "test model artifact content";
			const filePath = createTempFile(content, "valid-artifact.bin");
			const checksum = calculateChecksum(filePath);

			const result = validator.validateArtifactIntegrity(
				filePath,
				checksum,
				"test-model-001"
			);

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
			expect(result.validatedFields).toContain("artifactExists");
			expect(result.validatedFields).toContain("artifactReadable");
			expect(result.validatedFields).toContain("checksumCalculated");
			expect(result.validatedFields).toContain("checksumVerified");
		});

		it("should reject artifact with invalid checksum", () => {
			const content = "test model artifact content";
			const filePath = createTempFile(content, "invalid-checksum-artifact.bin");
			const wrongChecksum = "wrong_checksum_1234567890abcdef";

			const result = validator.validateArtifactIntegrity(
				filePath,
				wrongChecksum,
				"test-model-002"
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Checksum mismatch"))).toBe(true);
		});

		it("should warn when no checksum provided", () => {
			const content = "test model artifact content";
			const filePath = createTempFile(content, "no-checksum-artifact.bin");

			const result = validator.validateArtifactIntegrity(
				filePath,
				undefined,
				"test-model-003"
			);

			expect(result.warnings.some(w => w.includes("No expected checksum"))).toBe(true);
		});

		it("should handle file not found", () => {
			const filePath = path.join(tempDir, "nonexistent-artifact.bin");

			const result = validator.validateArtifactIntegrity(
				filePath,
				"some_checksum",
				"test-model-004"
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("not found"))).toBe(true);
		});

		it("should detect empty files", () => {
			const filePath = createTempFile("", "empty-artifact.bin");

			const result = validator.validateArtifactIntegrity(
				filePath,
				undefined,
				"test-model-005"
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("empty"))).toBe(true);
		});

		it("should verify file is readable", () => {
			const content = "test model artifact content";
			const filePath = createTempFile(content, "readable-artifact.bin");

			// Make file unreadable
			fs.chmodSync(filePath, 0o000);

			const result = validator.validateArtifactIntegrity(
				filePath,
				undefined,
				"test-model-006"
			);

			// Restore permissions for cleanup
			fs.chmodSync(filePath, 0o644);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("not readable"))).toBe(true);
		});
	});

	// ===== Feature Compatibility Validation Tests =====

	describe("validateFeatureCompatibility", () => {
		it("should validate exact feature match", () => {
			const modelFeatures = ["rsi", "macd", "sma_20", "ema_50", "bollinger_upper"];
			const providedFeatures = ["rsi", "macd", "sma_20", "ema_50", "bollinger_upper"];

			const result = validator.validateFeatureCompatibility(
				modelFeatures,
				providedFeatures,
				"test-model-001"
			);

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
			expect(result.missingFeatures.length).toBe(0);
			expect(result.extraFeatures.length).toBe(0);
			expect(result.compatibilityScore).toBe(1.0);
			expect(result.validatedFields).toContain("allRequiredFeaturesPresent");
			expect(result.validatedFields).toContain("featureCountMatch");
		});

		it("should detect missing required features", () => {
			const modelFeatures = ["rsi", "macd", "sma_20", "ema_50", "bollinger_upper"];
			const providedFeatures = ["rsi", "macd"]; // Missing 3 features

			const result = validator.validateFeatureCompatibility(
				modelFeatures,
				providedFeatures,
				"test-model-002"
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Missing"))).toBe(true);
			expect(result.missingFeatures.length).toBe(3);
			expect(result.missingFeatures).toContain("sma_20");
			expect(result.missingFeatures).toContain("ema_50");
			expect(result.missingFeatures).toContain("bollinger_upper");
			expect(result.compatibilityScore).toBe(0.4); // 2/5
		});

		it("should warn about extra features", () => {
			const modelFeatures = ["rsi", "macd", "sma_20"];
			const providedFeatures = ["rsi", "macd", "sma_20", "extra_feature1", "extra_feature2"];

			const result = validator.validateFeatureCompatibility(
				modelFeatures,
				providedFeatures,
				"test-model-003"
			);

			expect(result.isValid).toBe(true); // Extra features don't invalidate
			expect(result.warnings.some(w => w.includes("extra feature"))).toBe(true);
			expect(result.extraFeatures.length).toBe(2);
			expect(result.extraFeatures).toContain("extra_feature1");
			expect(result.extraFeatures).toContain("extra_feature2");
		});

		it("should calculate compatibility score correctly", () => {
			const modelFeatures = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10"];
			const providedFeatures = ["f1", "f2", "f3", "f4", "f5", "f6", "f7"]; // 7/10 = 0.7

			const result = validator.validateFeatureCompatibility(
				modelFeatures,
				providedFeatures,
				"test-model-004"
			);

			expect(result.compatibilityScore).toBe(0.7);
			expect(result.missingFeatures.length).toBe(3);
		});

		it("should warn about compatibility below 100% but above 90%", () => {
			const modelFeatures = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10"];
			const providedFeatures = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9"]; // 9/10 = 0.9

			const result = validator.validateFeatureCompatibility(
				modelFeatures,
				providedFeatures,
				"test-model-005"
			);

			expect(result.compatibilityScore).toBe(0.9);
			expect(result.warnings.some(w => w.includes("90.0%"))).toBe(true);
		});

		it("should handle empty feature lists", () => {
			const modelFeatures: string[] = [];
			const providedFeatures = ["feature1", "feature2"];

			const result = validator.validateFeatureCompatibility(
				modelFeatures,
				providedFeatures,
				"test-model-006"
			);

			expect(result.compatibilityScore).toBe(0);
			expect(result.extraFeatures.length).toBe(2);
		});

		it("should warn about feature count mismatch", () => {
			const modelFeatures = ["f1", "f2", "f3"];
			const providedFeatures = ["f1", "f2", "f3", "f4", "f5"]; // Same features but more provided

			const result = validator.validateFeatureCompatibility(
				modelFeatures,
				providedFeatures,
				"test-model-007"
			);

			expect(result.warnings.some(w => w.includes("Feature count mismatch"))).toBe(true);
		});
	});

	// ===== Hyperparameter Validation Tests =====

	describe("validateHyperparameters - LightGBM", () => {
		it("should validate valid LightGBM hyperparameters", () => {
			const hyperparams = createValidHyperparameters(MLModelType.LIGHTGBM);

			const result = validator.validateHyperparameters(
				MLModelType.LIGHTGBM,
				hyperparams,
				"lightgbm-model-001"
			);

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
			expect(result.validatedParams.length).toBeGreaterThan(0);
			expect(result.invalidParams.length).toBe(0);
		});

		it("should reject LightGBM num_leaves out of range (too high)", () => {
			const hyperparams = {
				num_leaves: 300, // Max is 256
				learning_rate: 0.1,
			};

			const result = validator.validateHyperparameters(
				MLModelType.LIGHTGBM,
				hyperparams,
				"lightgbm-model-002"
			);

			expect(result.isValid).toBe(false);
			expect(
				result.errors.some(e => e.includes("num_leaves") && e.includes("exceeds maximum"))
			).toBe(true);
			expect(result.invalidParams).toContain("num_leaves");
		});

		it("should reject LightGBM num_leaves out of range (too low)", () => {
			const hyperparams = {
				num_leaves: 1, // Min is 2
				learning_rate: 0.1,
			};

			const result = validator.validateHyperparameters(
				MLModelType.LIGHTGBM,
				hyperparams,
				"lightgbm-model-003"
			);

			expect(result.isValid).toBe(false);
			expect(
				result.errors.some(e => e.includes("num_leaves") && e.includes("below minimum"))
			).toBe(true);
		});

		it("should reject LightGBM invalid learning_rate", () => {
			const hyperparams = {
				num_leaves: 31,
				learning_rate: 0.5, // Max is 0.3
			};

			const result = validator.validateHyperparameters(
				MLModelType.LIGHTGBM,
				hyperparams,
				"lightgbm-model-004"
			);

			expect(result.isValid).toBe(false);
			expect(
				result.errors.some(
					e => e.includes("learning_rate") && e.includes("exceeds maximum")
				)
			).toBe(true);
		});

		it("should reject LightGBM invalid boosting_type", () => {
			const hyperparams = {
				num_leaves: 31,
				boosting_type: "invalid_type",
			};

			const result = validator.validateHyperparameters(
				MLModelType.LIGHTGBM,
				hyperparams,
				"lightgbm-model-005"
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("boosting_type"))).toBe(true);
		});
	});

	describe("validateHyperparameters - XGBoost", () => {
		it("should validate valid XGBoost hyperparameters", () => {
			const hyperparams = createValidHyperparameters(MLModelType.XGBOOST);

			const result = validator.validateHyperparameters(
				MLModelType.XGBOOST,
				hyperparams,
				"xgboost-model-001"
			);

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
			expect(result.validatedParams.length).toBeGreaterThan(0);
		});

		it("should reject XGBoost max_depth out of range", () => {
			const hyperparams = {
				max_depth: 60, // Max is 50
				learning_rate: 0.1,
			};

			const result = validator.validateHyperparameters(
				MLModelType.XGBOOST,
				hyperparams,
				"xgboost-model-002"
			);

			expect(result.isValid).toBe(false);
			expect(
				result.errors.some(e => e.includes("max_depth") && e.includes("exceeds maximum"))
			).toBe(true);
		});

		it("should reject XGBoost invalid booster type", () => {
			const hyperparams = {
				max_depth: 6,
				booster: "invalid_booster",
			};

			const result = validator.validateHyperparameters(
				MLModelType.XGBOOST,
				hyperparams,
				"xgboost-model-003"
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("booster"))).toBe(true);
		});
	});

	describe("validateHyperparameters - LSTM", () => {
		it("should validate valid LSTM hyperparameters", () => {
			const hyperparams = createValidHyperparameters(MLModelType.LSTM);

			const result = validator.validateHyperparameters(
				MLModelType.LSTM,
				hyperparams,
				"lstm-model-001"
			);

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
		});

		it("should reject LSTM dropout out of range", () => {
			const hyperparams = {
				units: 128,
				sequence_length: 30,
				dropout: 0.95, // Max is 0.9
			};

			const result = validator.validateHyperparameters(
				MLModelType.LSTM,
				hyperparams,
				"lstm-model-002"
			);

			expect(result.isValid).toBe(false);
			expect(
				result.errors.some(e => e.includes("dropout") && e.includes("exceeds maximum"))
			).toBe(true);
		});

		it("should reject LSTM missing required units parameter", () => {
			const hyperparams = {
				layers: 2,
				sequence_length: 30,
				// Missing required 'units'
			};

			const result = validator.validateHyperparameters(
				MLModelType.LSTM,
				hyperparams,
				"lstm-model-003"
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("units") && e.includes("missing"))).toBe(
				true
			);
			expect(result.invalidParams).toContain("units");
		});

		it("should reject LSTM missing required sequence_length parameter", () => {
			const hyperparams = {
				units: 128,
				layers: 2,
				// Missing required 'sequence_length'
			};

			const result = validator.validateHyperparameters(
				MLModelType.LSTM,
				hyperparams,
				"lstm-model-004"
			);

			expect(result.isValid).toBe(false);
			expect(
				result.errors.some(e => e.includes("sequence_length") && e.includes("missing"))
			).toBe(true);
		});

		it("should reject LSTM invalid activation function", () => {
			const hyperparams = {
				units: 128,
				sequence_length: 30,
				activation: "invalid_activation",
			};

			const result = validator.validateHyperparameters(
				MLModelType.LSTM,
				hyperparams,
				"lstm-model-005"
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("activation"))).toBe(true);
		});
	});

	describe("validateHyperparameters - Ensemble", () => {
		it("should validate valid Ensemble hyperparameters", () => {
			const hyperparams = createValidHyperparameters(MLModelType.ENSEMBLE);

			const result = validator.validateHyperparameters(
				MLModelType.ENSEMBLE,
				hyperparams,
				"ensemble-model-001"
			);

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
		});

		it("should reject Ensemble missing required model_count", () => {
			const hyperparams = {
				voting_type: "soft",
				aggregation_method: "mean",
				// Missing required 'model_count'
			};

			const result = validator.validateHyperparameters(
				MLModelType.ENSEMBLE,
				hyperparams,
				"ensemble-model-002"
			);

			expect(result.isValid).toBe(false);
			expect(
				result.errors.some(e => e.includes("model_count") && e.includes("missing"))
			).toBe(true);
		});

		it("should reject Ensemble invalid voting_type", () => {
			const hyperparams = {
				model_count: 3,
				voting_type: "invalid_voting",
			};

			const result = validator.validateHyperparameters(
				MLModelType.ENSEMBLE,
				hyperparams,
				"ensemble-model-003"
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("voting_type"))).toBe(true);
		});
	});

	describe("validateHyperparameters - Edge Cases", () => {
		it("should warn about unknown hyperparameters", () => {
			const hyperparams = {
				num_leaves: 31,
				unknown_param: "some_value",
			};

			const result = validator.validateHyperparameters(
				MLModelType.LIGHTGBM,
				hyperparams,
				"edge-case-model-001"
			);

			expect(result.warnings.some(w => w.includes("Unknown hyperparameter"))).toBe(true);
		});

		it("should reject wrong type for numeric parameter", () => {
			const hyperparams = {
				num_leaves: "31", // Should be number
			};

			const result = validator.validateHyperparameters(
				MLModelType.LIGHTGBM,
				hyperparams,
				"edge-case-model-002"
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("must be a number"))).toBe(true);
		});

		it("should reject wrong type for string parameter", () => {
			const hyperparams = {
				num_leaves: 31,
				boosting_type: 123, // Should be string
			};

			const result = validator.validateHyperparameters(
				MLModelType.LIGHTGBM,
				hyperparams,
				"edge-case-model-003"
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("must be a string"))).toBe(true);
		});
	});

	// ===== Loading Time Validation Tests =====

	describe("validateLoadingTime", () => {
		it("should validate fast loading (<50ms)", async () => {
			const fastLoad = async () => {
				await new Promise(resolve => setTimeout(resolve, 20)); // 20ms
			};

			const result = await validator.validateLoadingTime(fastLoad, "fast-model-001");

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
			expect(result.validatedFields).toContain("modelLoaded");
			expect(result.validatedFields).toContain("loadTimeWithinLimit");
		});

		it("should reject slow loading (>50ms)", async () => {
			const slowLoad = async () => {
				await new Promise(resolve => setTimeout(resolve, 100)); // 100ms
			};

			const result = await validator.validateLoadingTime(slowLoad, "slow-model-001");

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("exceeds maximum"))).toBe(true);
		});

		it("should warn about loading approaching limit", async () => {
			const approachingLimitLoad = async () => {
				await new Promise(resolve => setTimeout(resolve, 40)); // 40ms (>70% of 50ms)
			};

			const result = await validator.validateLoadingTime(
				approachingLimitLoad,
				"approaching-model-001"
			);

			expect(result.isValid).toBe(true);
			expect(result.warnings.some(w => w.includes("approaching maximum"))).toBe(true);
		});

		it("should handle load function errors", async () => {
			const errorLoad = async () => {
				throw new Error("Failed to load model");
			};

			const result = await validator.validateLoadingTime(errorLoad, "error-model-001");

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Failed to load model"))).toBe(true);
		});

		it("should validate instant loading (0ms)", async () => {
			const instantLoad = async () => {
				// Immediate return
			};

			const result = await validator.validateLoadingTime(instantLoad, "instant-model-001");

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
		});
	});

	// ===== Deployment Validation Tests =====

	describe("validateModelForDeployment", () => {
		it("should pass comprehensive validation with all checks passing", async () => {
			const config = createValidModelConfig();
			const content = "x".repeat(10 * 1024 * 1024); // 10MB
			const artifactPath = createTempFile(content, "deployment-model.bin");
			const checksum = calculateChecksum(artifactPath);
			const loadFunction = async () => {
				await new Promise(resolve => setTimeout(resolve, 10));
			};
			const providedFeatures = config.features;

			const result = await validator.validateModelForDeployment(
				config,
				artifactPath,
				loadFunction,
				providedFeatures,
				checksum
			);

			expect(result.isValid).toBe(true);
			expect(result.errors.length).toBe(0);
			expect(result.performanceCheck).toBe(true);
			expect(result.sizeCheck).toBe(true);
			expect(result.integrityCheck).toBe(true);
			expect(result.loadTimeCheck).toBe(true);
			expect(result.featureCompatibilityCheck).toBe(true);
		});

		it("should fail when performance check fails", async () => {
			const config = createValidModelConfig();
			config.performanceMetrics.accuracy = 0.4; // Below threshold
			const content = "x".repeat(10 * 1024 * 1024);
			const artifactPath = createTempFile(content, "deployment-perf-fail.bin");
			const loadFunction = async () => {};
			const providedFeatures = config.features;

			const result = await validator.validateModelForDeployment(
				config,
				artifactPath,
				loadFunction,
				providedFeatures
			);

			expect(result.isValid).toBe(false);
			expect(result.performanceCheck).toBe(false);
			expect(result.errors.some(e => e.includes("Accuracy"))).toBe(true);
		});

		it("should fail when size check fails", async () => {
			const config = createValidModelConfig();
			const content = "x".repeat(150 * 1024 * 1024); // 150MB - too large
			const artifactPath = createTempFile(content, "deployment-size-fail.bin");
			const loadFunction = async () => {};
			const providedFeatures = config.features;

			const result = await validator.validateModelForDeployment(
				config,
				artifactPath,
				loadFunction,
				providedFeatures
			);

			expect(result.isValid).toBe(false);
			expect(result.sizeCheck).toBe(false);
			expect(result.errors.some(e => e.includes("exceeds maximum"))).toBe(true);
		});

		it("should fail when integrity check fails", async () => {
			const config = createValidModelConfig();
			const content = "x".repeat(10 * 1024 * 1024);
			const artifactPath = createTempFile(content, "deployment-integrity-fail.bin");
			const wrongChecksum = "wrong_checksum_123";
			const loadFunction = async () => {};
			const providedFeatures = config.features;

			const result = await validator.validateModelForDeployment(
				config,
				artifactPath,
				loadFunction,
				providedFeatures,
				wrongChecksum
			);

			expect(result.isValid).toBe(false);
			expect(result.integrityCheck).toBe(false);
			expect(result.errors.some(e => e.includes("Checksum mismatch"))).toBe(true);
		});

		it("should fail when load time check fails", async () => {
			const config = createValidModelConfig();
			const content = "x".repeat(10 * 1024 * 1024);
			const artifactPath = createTempFile(content, "deployment-loadtime-fail.bin");
			const slowLoad = async () => {
				await new Promise(resolve => setTimeout(resolve, 100)); // Too slow
			};
			const providedFeatures = config.features;

			const result = await validator.validateModelForDeployment(
				config,
				artifactPath,
				slowLoad,
				providedFeatures
			);

			expect(result.isValid).toBe(false);
			expect(result.loadTimeCheck).toBe(false);
			expect(result.errors.some(e => e.includes("load time"))).toBe(true);
		});

		it("should fail when feature compatibility check fails", async () => {
			const config = createValidModelConfig();
			const content = "x".repeat(10 * 1024 * 1024);
			const artifactPath = createTempFile(content, "deployment-features-fail.bin");
			const loadFunction = async () => {};
			const providedFeatures = ["feature1", "feature2"]; // Missing most features

			const result = await validator.validateModelForDeployment(
				config,
				artifactPath,
				loadFunction,
				providedFeatures
			);

			expect(result.isValid).toBe(false);
			expect(result.featureCompatibilityCheck).toBe(false);
			expect(result.errors.some(e => e.includes("Missing"))).toBe(true);
		});

		it("should fail when hyperparameter check fails", async () => {
			const config = createValidModelConfig();
			config.hyperparameters = {
				num_leaves: 300, // Invalid - max is 256
			};
			const content = "x".repeat(10 * 1024 * 1024);
			const artifactPath = createTempFile(content, "deployment-hyperparam-fail.bin");
			const loadFunction = async () => {};
			const providedFeatures = config.features;

			const result = await validator.validateModelForDeployment(
				config,
				artifactPath,
				loadFunction,
				providedFeatures
			);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("num_leaves"))).toBe(true);
		});

		it("should report multiple failures when multiple checks fail", async () => {
			const config = createValidModelConfig();
			config.performanceMetrics.accuracy = 0.4; // Fail performance
			config.hyperparameters.num_leaves = 300; // Fail hyperparameters
			const content = "x".repeat(150 * 1024 * 1024); // Fail size
			const artifactPath = createTempFile(content, "deployment-multiple-fail.bin");
			const slowLoad = async () => {
				await new Promise(resolve => setTimeout(resolve, 100)); // Fail load time
			};
			const providedFeatures = ["feature1"]; // Fail feature compatibility

			const result = await validator.validateModelForDeployment(
				config,
				artifactPath,
				slowLoad,
				providedFeatures
			);

			expect(result.isValid).toBe(false);
			expect(result.performanceCheck).toBe(false);
			expect(result.sizeCheck).toBe(false);
			expect(result.loadTimeCheck).toBe(false);
			expect(result.featureCompatibilityCheck).toBe(false);
			expect(result.errors.length).toBeGreaterThan(3);
		});
	});

	// ===== Custom Threshold Tests =====

	describe("Custom Thresholds", () => {
		it("should allow updating validation thresholds", () => {
			const customThresholds = {
				minAccuracy: 0.7,
				minPrecision: 0.65,
				maxModelSizeMB: 50,
			};

			validator.updateThresholds(customThresholds);
			const thresholds = validator.getThresholds();

			expect(thresholds.minAccuracy).toBe(0.7);
			expect(thresholds.minPrecision).toBe(0.65);
			expect(thresholds.maxModelSizeMB).toBe(50);
			// Other thresholds should remain default
			expect(thresholds.minRecall).toBe(DEFAULT_VALIDATION_THRESHOLDS.minRecall);
		});

		it("should apply custom thresholds to validation", () => {
			validator.updateThresholds({ minAccuracy: 0.8 });

			const metrics = createValidPerformanceMetrics();
			metrics.accuracy = 0.75; // Would pass default (0.60) but fail custom (0.80)

			const result = validator.validatePerformanceMetrics(metrics);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("Accuracy"))).toBe(true);
		});

		it("should return current thresholds with getThresholds", () => {
			const thresholds = validator.getThresholds();

			expect(thresholds.minAccuracy).toBe(DEFAULT_VALIDATION_THRESHOLDS.minAccuracy);
			expect(thresholds.minPrecision).toBe(DEFAULT_VALIDATION_THRESHOLDS.minPrecision);
			expect(thresholds.minRecall).toBe(DEFAULT_VALIDATION_THRESHOLDS.minRecall);
			expect(thresholds.minF1Score).toBe(DEFAULT_VALIDATION_THRESHOLDS.minF1Score);
			expect(thresholds.minSharpeRatio).toBe(DEFAULT_VALIDATION_THRESHOLDS.minSharpeRatio);
			expect(thresholds.maxModelSizeMB).toBe(DEFAULT_VALIDATION_THRESHOLDS.maxModelSizeMB);
			expect(thresholds.maxLoadTimeMs).toBe(DEFAULT_VALIDATION_THRESHOLDS.maxLoadTimeMs);
		});

		it("should allow creating validator with custom thresholds", () => {
			const customValidator = new ModelValidator({
				minAccuracy: 0.85,
				maxModelSizeMB: 75,
			});

			const thresholds = customValidator.getThresholds();

			expect(thresholds.minAccuracy).toBe(0.85);
			expect(thresholds.maxModelSizeMB).toBe(75);
		});

		it("should apply custom size threshold to validation", () => {
			const customValidator = new ModelValidator({ maxModelSizeMB: 20 });

			const content = "x".repeat(30 * 1024 * 1024); // 30MB
			const filePath = createTempFile(content, "custom-threshold-model.bin");

			const result = customValidator.validateModelSize(filePath);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("exceeds maximum"))).toBe(true);
			expect(result.maxSizeMB).toBe(20);
		});

		it("should apply custom load time threshold to validation", async () => {
			const customValidator = new ModelValidator({ maxLoadTimeMs: 20 });

			const loadFunction = async () => {
				await new Promise(resolve => setTimeout(resolve, 30)); // 30ms
			};

			const result = await customValidator.validateLoadingTime(loadFunction);

			expect(result.isValid).toBe(false);
			expect(result.errors.some(e => e.includes("exceeds maximum"))).toBe(true);
		});
	});
});
