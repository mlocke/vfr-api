/**
 * Model Validation Service for VFR Machine Learning Enhancement Layer
 *
 * Features:
 * - Performance threshold validation (accuracy, precision, recall, Sharpe ratio)
 * - Model size constraint checks (prevent models >100MB in memory)
 * - Model artifact integrity verification (checksum validation)
 * - Model loading time validation (<50ms target)
 * - Feature compatibility validation (ensure model expects correct features)
 * - Hyperparameter validation (sensible ranges for model types)
 *
 * Philosophy: Ensure model quality and compatibility before deployment
 * Prevents performance degradation and production failures
 */

import { MLModelType, MLModelConfig, MLModelPerformance, MLModelStatus } from "../types/MLTypes";
import { Logger } from "../../error-handling/Logger";
import * as crypto from "crypto";
import * as fs from "fs";

// ===== Validation Result Types =====

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
	validatedFields: string[];
	timestamp: number;
}

export interface ModelPerformanceValidation extends ValidationResult {
	metricsChecked: string[];
	passedThresholds: Record<string, boolean>;
	actualValues: Record<string, number>;
	thresholds: Record<string, number>;
}

export interface ModelDeploymentValidation extends ValidationResult {
	performanceCheck: boolean;
	sizeCheck: boolean;
	integrityCheck: boolean;
	loadTimeCheck: boolean;
	featureCompatibilityCheck: boolean;
}

export interface ModelSizeValidation extends ValidationResult {
	actualSizeMB: number;
	maxSizeMB: number;
	artifactPath?: string;
}

export interface FeatureCompatibilityValidation extends ValidationResult {
	expectedFeatures: string[];
	providedFeatures: string[];
	missingFeatures: string[];
	extraFeatures: string[];
	compatibilityScore: number;
}

export interface HyperparameterValidation extends ValidationResult {
	modelType: MLModelType;
	validatedParams: string[];
	invalidParams: string[];
	parameterDetails: Record<
		string,
		{
			valid: boolean;
			value: any;
			expectedRange?: string;
			message?: string;
		}
	>;
}

// ===== Validation Configuration =====

export const DEFAULT_VALIDATION_THRESHOLDS = {
	minAccuracy: 0.6, // 60% minimum accuracy
	minPrecision: 0.55,
	minRecall: 0.55,
	minF1Score: 0.55,
	minSharpeRatio: 0.5,
	maxModelSizeMB: 100, // 100MB max
	maxLoadTimeMs: 50, // 50ms max load time
	minValidationScore: 0.6,
	minTestScore: 0.58,
} as const;

export interface ValidationThresholds {
	minAccuracy: number;
	minPrecision: number;
	minRecall: number;
	minF1Score: number;
	minSharpeRatio: number;
	maxModelSizeMB: number;
	maxLoadTimeMs: number;
	minValidationScore: number;
	minTestScore: number;
}

// ===== Hyperparameter Ranges by Model Type =====

export interface HyperparameterRange {
	min?: number;
	max?: number;
	allowedValues?: any[];
	type: "number" | "string" | "boolean" | "array" | "object";
	required?: boolean;
	default?: any;
}

export const HYPERPARAMETER_RANGES: Record<MLModelType, Record<string, HyperparameterRange>> = {
	[MLModelType.LIGHTGBM]: {
		num_leaves: { min: 2, max: 256, type: "number", required: false, default: 31 },
		learning_rate: { min: 0.001, max: 0.3, type: "number", required: false, default: 0.1 },
		n_estimators: { min: 10, max: 10000, type: "number", required: false, default: 100 },
		max_depth: { min: -1, max: 50, type: "number", required: false, default: -1 },
		min_child_samples: { min: 1, max: 1000, type: "number", required: false, default: 20 },
		subsample: { min: 0.1, max: 1.0, type: "number", required: false, default: 1.0 },
		colsample_bytree: { min: 0.1, max: 1.0, type: "number", required: false, default: 1.0 },
		reg_alpha: { min: 0, max: 100, type: "number", required: false, default: 0 },
		reg_lambda: { min: 0, max: 100, type: "number", required: false, default: 0 },
		boosting_type: {
			allowedValues: ["gbdt", "dart", "goss", "rf"],
			type: "string",
			required: false,
			default: "gbdt",
		},
	},
	[MLModelType.XGBOOST]: {
		max_depth: { min: 1, max: 50, type: "number", required: false, default: 6 },
		learning_rate: { min: 0.001, max: 0.3, type: "number", required: false, default: 0.1 },
		n_estimators: { min: 10, max: 10000, type: "number", required: false, default: 100 },
		subsample: { min: 0.1, max: 1.0, type: "number", required: false, default: 1.0 },
		colsample_bytree: { min: 0.1, max: 1.0, type: "number", required: false, default: 1.0 },
		min_child_weight: { min: 0, max: 100, type: "number", required: false, default: 1 },
		gamma: { min: 0, max: 100, type: "number", required: false, default: 0 },
		reg_alpha: { min: 0, max: 100, type: "number", required: false, default: 0 },
		reg_lambda: { min: 0, max: 100, type: "number", required: false, default: 1 },
		booster: {
			allowedValues: ["gbtree", "gblinear", "dart"],
			type: "string",
			required: false,
			default: "gbtree",
		},
	},
	[MLModelType.LSTM]: {
		units: { min: 1, max: 1024, type: "number", required: true },
		layers: { min: 1, max: 10, type: "number", required: false, default: 2 },
		dropout: { min: 0, max: 0.9, type: "number", required: false, default: 0.2 },
		recurrent_dropout: { min: 0, max: 0.9, type: "number", required: false, default: 0.2 },
		learning_rate: { min: 0.0001, max: 0.1, type: "number", required: false, default: 0.001 },
		batch_size: { min: 1, max: 512, type: "number", required: false, default: 32 },
		epochs: { min: 1, max: 1000, type: "number", required: false, default: 100 },
		sequence_length: { min: 1, max: 500, type: "number", required: true },
		activation: {
			allowedValues: ["relu", "tanh", "sigmoid", "linear"],
			type: "string",
			required: false,
			default: "tanh",
		},
	},
	[MLModelType.ENSEMBLE]: {
		voting_type: {
			allowedValues: ["hard", "soft", "weighted"],
			type: "string",
			required: false,
			default: "soft",
		},
		model_count: { min: 2, max: 10, type: "number", required: true },
		weights: { type: "array", required: false },
		aggregation_method: {
			allowedValues: ["mean", "median", "weighted_average"],
			type: "string",
			required: false,
			default: "mean",
		},
	},
};

// ===== Model Validator Service =====

export class ModelValidator {
	private logger: Logger;
	private thresholds: ValidationThresholds;

	constructor(customThresholds?: Partial<ValidationThresholds>) {
		this.logger = Logger.getInstance("ModelValidator");
		this.thresholds = { ...DEFAULT_VALIDATION_THRESHOLDS, ...customThresholds };
	}

	/**
	 * Validate model configuration before registration
	 */
	public validateModelConfig(config: MLModelConfig): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		const validatedFields: string[] = [];

		// Validate modelId
		if (!config.modelId || config.modelId.trim() === "") {
			errors.push("Model ID is required and cannot be empty");
		} else if (!/^[a-zA-Z0-9_-]+$/.test(config.modelId)) {
			errors.push(
				"Model ID must contain only alphanumeric characters, underscores, and hyphens"
			);
		} else {
			validatedFields.push("modelId");
		}

		// Validate version
		if (!config.version || config.version.trim() === "") {
			errors.push("Model version is required");
		} else if (!/^\d+\.\d+\.\d+$/.test(config.version)) {
			warnings.push("Model version does not follow semantic versioning (x.y.z)");
			validatedFields.push("version");
		} else {
			validatedFields.push("version");
		}

		// Validate modelType
		if (!Object.values(MLModelType).includes(config.modelType)) {
			errors.push(`Invalid model type: ${config.modelType}`);
		} else {
			validatedFields.push("modelType");
		}

		// Validate features array
		if (!config.features || !Array.isArray(config.features)) {
			errors.push("Features array is required");
		} else if (config.features.length === 0) {
			errors.push("Features array cannot be empty");
		} else if (config.features.length < 5) {
			warnings.push(
				`Low feature count: ${config.features.length} features (consider adding more features for better model performance)`
			);
			validatedFields.push("features");
		} else {
			validatedFields.push("features");
		}

		// Validate timestamps
		if (!config.createdAt || config.createdAt <= 0) {
			errors.push("Invalid createdAt timestamp");
		} else {
			validatedFields.push("createdAt");
		}

		if (!config.updatedAt || config.updatedAt <= 0) {
			errors.push("Invalid updatedAt timestamp");
		} else if (config.updatedAt < config.createdAt) {
			errors.push("updatedAt cannot be earlier than createdAt");
		} else {
			validatedFields.push("updatedAt");
		}

		// Validate deployedAt if present
		if (config.deployedAt !== undefined) {
			if (config.deployedAt <= 0) {
				errors.push("Invalid deployedAt timestamp");
			} else if (config.deployedAt < config.createdAt) {
				errors.push("deployedAt cannot be earlier than createdAt");
			} else {
				validatedFields.push("deployedAt");
			}
		}

		// Log validation results
		if (errors.length > 0) {
			this.logger.warn(`Model config validation failed for ${config.modelId}`, {
				errors,
				warnings,
				validatedFields,
			});
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			validatedFields,
			timestamp: Date.now(),
		};
	}

	/**
	 * Check if performance metrics meet minimum thresholds
	 */
	public validatePerformanceMetrics(
		performance: MLModelPerformance,
		modelId?: string
	): ModelPerformanceValidation {
		const errors: string[] = [];
		const warnings: string[] = [];
		const validatedFields: string[] = [];
		const metricsChecked: string[] = [];
		const passedThresholds: Record<string, boolean> = {};
		const actualValues: Record<string, number> = {};
		const thresholds: Record<string, number> = {};

		// Accuracy check
		metricsChecked.push("accuracy");
		actualValues.accuracy = performance.accuracy;
		thresholds.accuracy = this.thresholds.minAccuracy;
		if (performance.accuracy < this.thresholds.minAccuracy) {
			errors.push(
				`Accuracy ${(performance.accuracy * 100).toFixed(2)}% is below minimum threshold ${(this.thresholds.minAccuracy * 100).toFixed(2)}%`
			);
			passedThresholds.accuracy = false;
		} else {
			validatedFields.push("accuracy");
			passedThresholds.accuracy = true;
			if (performance.accuracy < this.thresholds.minAccuracy + 0.05) {
				warnings.push(
					`Accuracy ${(performance.accuracy * 100).toFixed(2)}% is only slightly above minimum threshold`
				);
			}
		}

		// Precision check
		metricsChecked.push("precision");
		actualValues.precision = performance.precision;
		thresholds.precision = this.thresholds.minPrecision;
		if (performance.precision < this.thresholds.minPrecision) {
			errors.push(
				`Precision ${(performance.precision * 100).toFixed(2)}% is below minimum threshold ${(this.thresholds.minPrecision * 100).toFixed(2)}%`
			);
			passedThresholds.precision = false;
		} else {
			validatedFields.push("precision");
			passedThresholds.precision = true;
		}

		// Recall check
		metricsChecked.push("recall");
		actualValues.recall = performance.recall;
		thresholds.recall = this.thresholds.minRecall;
		if (performance.recall < this.thresholds.minRecall) {
			errors.push(
				`Recall ${(performance.recall * 100).toFixed(2)}% is below minimum threshold ${(this.thresholds.minRecall * 100).toFixed(2)}%`
			);
			passedThresholds.recall = false;
		} else {
			validatedFields.push("recall");
			passedThresholds.recall = true;
		}

		// F1 Score check
		metricsChecked.push("f1Score");
		actualValues.f1Score = performance.f1Score;
		thresholds.f1Score = this.thresholds.minF1Score;
		if (performance.f1Score < this.thresholds.minF1Score) {
			errors.push(
				`F1 Score ${(performance.f1Score * 100).toFixed(2)}% is below minimum threshold ${(this.thresholds.minF1Score * 100).toFixed(2)}%`
			);
			passedThresholds.f1Score = false;
		} else {
			validatedFields.push("f1Score");
			passedThresholds.f1Score = true;
		}

		// Sharpe Ratio check
		metricsChecked.push("sharpeRatio");
		actualValues.sharpeRatio = performance.sharpeRatio;
		thresholds.sharpeRatio = this.thresholds.minSharpeRatio;
		if (performance.sharpeRatio < this.thresholds.minSharpeRatio) {
			errors.push(
				`Sharpe Ratio ${performance.sharpeRatio.toFixed(2)} is below minimum threshold ${this.thresholds.minSharpeRatio.toFixed(2)}`
			);
			passedThresholds.sharpeRatio = false;
		} else {
			validatedFields.push("sharpeRatio");
			passedThresholds.sharpeRatio = true;
			if (performance.sharpeRatio > 2.0) {
				warnings.push(
					`Sharpe Ratio ${performance.sharpeRatio.toFixed(2)} is exceptionally high - verify this is not overfitting`
				);
			}
		}

		// Validation accuracy check
		metricsChecked.push("validationAccuracy");
		actualValues.validationAccuracy = performance.validationAccuracy;
		thresholds.validationAccuracy = this.thresholds.minValidationScore;
		if (performance.validationAccuracy < this.thresholds.minValidationScore) {
			errors.push(
				`Validation accuracy ${(performance.validationAccuracy * 100).toFixed(2)}% is below minimum threshold ${(this.thresholds.minValidationScore * 100).toFixed(2)}%`
			);
			passedThresholds.validationAccuracy = false;
		} else {
			validatedFields.push("validationAccuracy");
			passedThresholds.validationAccuracy = true;
		}

		// Overfitting detection
		const accuracyGap = performance.accuracy - performance.validationAccuracy;
		if (accuracyGap > 0.15) {
			warnings.push(
				`Significant gap between training (${(performance.accuracy * 100).toFixed(2)}%) and validation (${(performance.validationAccuracy * 100).toFixed(2)}%) accuracy - possible overfitting`
			);
		}

		// Loss validation
		if (performance.trainingLoss < 0) {
			errors.push("Training loss cannot be negative");
		}
		if (performance.validationLoss < 0) {
			errors.push("Validation loss cannot be negative");
		}
		if (performance.validationLoss > performance.trainingLoss * 2) {
			warnings.push(
				"Validation loss is significantly higher than training loss - possible overfitting or data distribution mismatch"
			);
		}

		// Log validation results
		if (errors.length > 0) {
			this.logger.warn(
				`Performance metrics validation failed${modelId ? ` for ${modelId}` : ""}`,
				{
					errors,
					warnings,
					actualValues,
					thresholds,
				}
			);
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			validatedFields,
			timestamp: Date.now(),
			metricsChecked,
			passedThresholds,
			actualValues,
			thresholds,
		};
	}

	/**
	 * Check artifact size constraints
	 */
	public validateModelSize(artifactPath: string, modelId?: string): ModelSizeValidation {
		const errors: string[] = [];
		const warnings: string[] = [];
		const validatedFields: string[] = [];

		try {
			// Check if file exists
			if (!fs.existsSync(artifactPath)) {
				errors.push(`Model artifact not found at path: ${artifactPath}`);
				return {
					isValid: false,
					errors,
					warnings,
					validatedFields,
					timestamp: Date.now(),
					actualSizeMB: 0,
					maxSizeMB: this.thresholds.maxModelSizeMB,
					artifactPath,
				};
			}

			validatedFields.push("artifactExists");

			// Get file size
			const stats = fs.statSync(artifactPath);
			const sizeMB = stats.size / (1024 * 1024);

			// Size validation
			if (sizeMB > this.thresholds.maxModelSizeMB) {
				errors.push(
					`Model size ${sizeMB.toFixed(2)}MB exceeds maximum allowed size of ${this.thresholds.maxModelSizeMB}MB`
				);
			} else {
				validatedFields.push("sizeWithinLimit");

				// Warning for large models
				if (sizeMB > this.thresholds.maxModelSizeMB * 0.8) {
					warnings.push(
						`Model size ${sizeMB.toFixed(2)}MB is approaching maximum limit of ${this.thresholds.maxModelSizeMB}MB`
					);
				}
			}

			// Warning for very small models
			if (sizeMB < 0.1) {
				warnings.push(
					`Model size ${sizeMB.toFixed(2)}MB is unusually small - verify model was saved correctly`
				);
			}

			return {
				isValid: errors.length === 0,
				errors,
				warnings,
				validatedFields,
				timestamp: Date.now(),
				actualSizeMB: sizeMB,
				maxSizeMB: this.thresholds.maxModelSizeMB,
				artifactPath,
			};
		} catch (error) {
			this.logger.error(`Error validating model size for ${artifactPath}`, { error });
			errors.push(
				`Failed to validate model size: ${error instanceof Error ? error.message : "Unknown error"}`
			);

			return {
				isValid: false,
				errors,
				warnings,
				validatedFields,
				timestamp: Date.now(),
				actualSizeMB: 0,
				maxSizeMB: this.thresholds.maxModelSizeMB,
				artifactPath,
			};
		}
	}

	/**
	 * Verify model artifact integrity using checksums
	 */
	public validateArtifactIntegrity(
		artifactPath: string,
		expectedChecksum?: string,
		modelId?: string
	): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		const validatedFields: string[] = [];

		try {
			// Check if file exists
			if (!fs.existsSync(artifactPath)) {
				errors.push(`Model artifact not found at path: ${artifactPath}`);
				return {
					isValid: false,
					errors,
					warnings,
					validatedFields,
					timestamp: Date.now(),
				};
			}

			validatedFields.push("artifactExists");

			// Check if file is readable
			try {
				fs.accessSync(artifactPath, fs.constants.R_OK);
				validatedFields.push("artifactReadable");
			} catch {
				errors.push(`Model artifact is not readable: ${artifactPath}`);
				return {
					isValid: false,
					errors,
					warnings,
					validatedFields,
					timestamp: Date.now(),
				};
			}

			// Calculate checksum
			const fileBuffer = fs.readFileSync(artifactPath);
			const hash = crypto.createHash("sha256");
			hash.update(fileBuffer);
			const actualChecksum = hash.digest("hex");

			validatedFields.push("checksumCalculated");

			// Verify checksum if provided
			if (expectedChecksum) {
				if (actualChecksum !== expectedChecksum) {
					errors.push(
						`Checksum mismatch - Expected: ${expectedChecksum.substring(0, 16)}..., Actual: ${actualChecksum.substring(0, 16)}...`
					);
				} else {
					validatedFields.push("checksumVerified");
				}
			} else {
				warnings.push("No expected checksum provided - integrity verification skipped");
			}

			// Check for empty files
			if (fileBuffer.length === 0) {
				errors.push("Model artifact is empty");
			}

			if (errors.length > 0) {
				this.logger.warn(
					`Artifact integrity validation failed${modelId ? ` for ${modelId}` : ""}`,
					{
						artifactPath,
						errors,
						warnings,
					}
				);
			}

			return {
				isValid: errors.length === 0,
				errors,
				warnings,
				validatedFields,
				timestamp: Date.now(),
			};
		} catch (error) {
			this.logger.error(`Error validating artifact integrity for ${artifactPath}`, { error });
			errors.push(
				`Failed to validate artifact integrity: ${error instanceof Error ? error.message : "Unknown error"}`
			);

			return {
				isValid: false,
				errors,
				warnings,
				validatedFields,
				timestamp: Date.now(),
			};
		}
	}

	/**
	 * Measure and validate model load performance
	 */
	public validateLoadingTime(
		loadFunction: () => Promise<any>,
		modelId?: string
	): Promise<ValidationResult> {
		return new Promise(async resolve => {
			const errors: string[] = [];
			const warnings: string[] = [];
			const validatedFields: string[] = [];

			try {
				const startTime = Date.now();
				await loadFunction();
				const loadTime = Date.now() - startTime;

				validatedFields.push("modelLoaded");

				// Load time validation
				if (loadTime > this.thresholds.maxLoadTimeMs) {
					errors.push(
						`Model load time ${loadTime}ms exceeds maximum allowed time of ${this.thresholds.maxLoadTimeMs}ms`
					);
				} else {
					validatedFields.push("loadTimeWithinLimit");

					// Warning for slow loads
					if (loadTime > this.thresholds.maxLoadTimeMs * 0.7) {
						warnings.push(
							`Model load time ${loadTime}ms is approaching maximum limit of ${this.thresholds.maxLoadTimeMs}ms`
						);
					}
				}

				if (errors.length > 0) {
					this.logger.warn(
						`Load time validation failed${modelId ? ` for ${modelId}` : ""}`,
						{
							loadTime,
							threshold: this.thresholds.maxLoadTimeMs,
							errors,
						}
					);
				}

				resolve({
					isValid: errors.length === 0,
					errors,
					warnings,
					validatedFields,
					timestamp: Date.now(),
				});
			} catch (error) {
				this.logger.error(
					`Error during model loading validation${modelId ? ` for ${modelId}` : ""}`,
					{ error }
				);
				errors.push(
					`Failed to load model: ${error instanceof Error ? error.message : "Unknown error"}`
				);

				resolve({
					isValid: false,
					errors,
					warnings,
					validatedFields,
					timestamp: Date.now(),
				});
			}
		});
	}

	/**
	 * Ensure feature names and counts match expectations
	 */
	public validateFeatureCompatibility(
		modelFeatures: string[],
		providedFeatures: string[],
		modelId?: string
	): FeatureCompatibilityValidation {
		const errors: string[] = [];
		const warnings: string[] = [];
		const validatedFields: string[] = [];

		// Find missing and extra features
		const missingFeatures = modelFeatures.filter(f => !providedFeatures.includes(f));
		const extraFeatures = providedFeatures.filter(f => !modelFeatures.includes(f));

		// Critical errors for missing features
		if (missingFeatures.length > 0) {
			errors.push(
				`Missing ${missingFeatures.length} required feature(s): ${missingFeatures.slice(0, 5).join(", ")}${missingFeatures.length > 5 ? "..." : ""}`
			);
		} else {
			validatedFields.push("allRequiredFeaturesPresent");
		}

		// Warnings for extra features
		if (extraFeatures.length > 0) {
			warnings.push(
				`${extraFeatures.length} extra feature(s) provided that model doesn't expect: ${extraFeatures.slice(0, 5).join(", ")}${extraFeatures.length > 5 ? "..." : ""}`
			);
		}

		// Feature count check
		if (modelFeatures.length !== providedFeatures.length && missingFeatures.length === 0) {
			warnings.push(
				`Feature count mismatch - Model expects ${modelFeatures.length}, provided ${providedFeatures.length}`
			);
		} else if (missingFeatures.length === 0 && extraFeatures.length === 0) {
			validatedFields.push("featureCountMatch");
		}

		// Calculate compatibility score
		const totalExpectedFeatures = modelFeatures.length;
		const matchingFeatures = totalExpectedFeatures - missingFeatures.length;
		const compatibilityScore =
			totalExpectedFeatures > 0 ? matchingFeatures / totalExpectedFeatures : 0;

		if (compatibilityScore < 1.0 && compatibilityScore >= 0.9) {
			warnings.push(
				`Feature compatibility is ${(compatibilityScore * 100).toFixed(1)}% - some features missing`
			);
		}

		if (errors.length > 0) {
			this.logger.warn(
				`Feature compatibility validation failed${modelId ? ` for ${modelId}` : ""}`,
				{
					errors,
					warnings,
					missingFeatures: missingFeatures.slice(0, 10),
					extraFeatures: extraFeatures.slice(0, 10),
					compatibilityScore,
				}
			);
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			validatedFields,
			timestamp: Date.now(),
			expectedFeatures: modelFeatures,
			providedFeatures,
			missingFeatures,
			extraFeatures,
			compatibilityScore,
		};
	}

	/**
	 * Validate hyperparameter ranges by model type
	 */
	public validateHyperparameters(
		modelType: MLModelType,
		hyperparameters: Record<string, any>,
		modelId?: string
	): HyperparameterValidation {
		const errors: string[] = [];
		const warnings: string[] = [];
		const validatedFields: string[] = [];
		const validatedParams: string[] = [];
		const invalidParams: string[] = [];
		const parameterDetails: Record<
			string,
			{
				valid: boolean;
				value: any;
				expectedRange?: string;
				message?: string;
			}
		> = {};

		const ranges = HYPERPARAMETER_RANGES[modelType];

		if (!ranges) {
			warnings.push(
				`No hyperparameter validation rules defined for model type: ${modelType}`
			);
			return {
				isValid: true,
				errors,
				warnings,
				validatedFields,
				timestamp: Date.now(),
				modelType,
				validatedParams,
				invalidParams,
				parameterDetails,
			};
		}

		// Validate each hyperparameter
		for (const [paramName, value] of Object.entries(hyperparameters)) {
			const range = ranges[paramName];

			if (!range) {
				warnings.push(`Unknown hyperparameter for ${modelType}: ${paramName}`);
				parameterDetails[paramName] = {
					valid: true,
					value,
					message: "No validation rules defined",
				};
				continue;
			}

			let isValid = true;
			const detail: (typeof parameterDetails)[string] = {
				valid: true,
				value,
			};

			// Type validation
			if (range.type === "number" && typeof value !== "number") {
				errors.push(`${paramName} must be a number, got ${typeof value}`);
				isValid = false;
				detail.message = `Expected type: number, got: ${typeof value}`;
			} else if (range.type === "string" && typeof value !== "string") {
				errors.push(`${paramName} must be a string, got ${typeof value}`);
				isValid = false;
				detail.message = `Expected type: string, got: ${typeof value}`;
			} else if (range.type === "boolean" && typeof value !== "boolean") {
				errors.push(`${paramName} must be a boolean, got ${typeof value}`);
				isValid = false;
				detail.message = `Expected type: boolean, got: ${typeof value}`;
			} else if (range.type === "array" && !Array.isArray(value)) {
				errors.push(`${paramName} must be an array, got ${typeof value}`);
				isValid = false;
				detail.message = `Expected type: array, got: ${typeof value}`;
			}

			// Range validation for numbers
			if (range.type === "number" && typeof value === "number") {
				if (range.min !== undefined && value < range.min) {
					errors.push(`${paramName} value ${value} is below minimum ${range.min}`);
					isValid = false;
					detail.expectedRange = `[${range.min}, ${range.max ?? "inf"}]`;
				}
				if (range.max !== undefined && value > range.max) {
					errors.push(`${paramName} value ${value} exceeds maximum ${range.max}`);
					isValid = false;
					detail.expectedRange = `[${range.min ?? "-inf"}, ${range.max}]`;
				}
				if (isValid && range.min !== undefined && range.max !== undefined) {
					detail.expectedRange = `[${range.min}, ${range.max}]`;
				}
			}

			// Allowed values validation
			if (range.allowedValues && !range.allowedValues.includes(value)) {
				errors.push(
					`${paramName} value '${value}' is not in allowed values: ${range.allowedValues.join(", ")}`
				);
				isValid = false;
				detail.expectedRange = `Allowed: [${range.allowedValues.join(", ")}]`;
			}

			detail.valid = isValid;
			parameterDetails[paramName] = detail;

			if (isValid) {
				validatedParams.push(paramName);
				validatedFields.push(paramName);
			} else {
				invalidParams.push(paramName);
			}
		}

		// Check for missing required parameters
		for (const [paramName, range] of Object.entries(ranges)) {
			if (range.required && !(paramName in hyperparameters)) {
				errors.push(`Required hyperparameter '${paramName}' is missing`);
				invalidParams.push(paramName);
				parameterDetails[paramName] = {
					valid: false,
					value: undefined,
					message: "Required parameter missing",
				};
			}
		}

		if (errors.length > 0) {
			this.logger.warn(
				`Hyperparameter validation failed for ${modelType}${modelId ? ` (${modelId})` : ""}`,
				{
					errors,
					warnings,
					invalidParams,
					validatedParams: validatedParams.length,
				}
			);
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			validatedFields,
			timestamp: Date.now(),
			modelType,
			validatedParams,
			invalidParams,
			parameterDetails,
		};
	}

	/**
	 * Comprehensive pre-deployment validation
	 */
	public async validateModelForDeployment(
		config: MLModelConfig,
		artifactPath: string,
		loadFunction: () => Promise<any>,
		providedFeatures: string[],
		expectedChecksum?: string
	): Promise<ModelDeploymentValidation> {
		const errors: string[] = [];
		const warnings: string[] = [];
		const validatedFields: string[] = [];

		// 1. Config validation
		const configResult = this.validateModelConfig(config);
		errors.push(...configResult.errors);
		warnings.push(...configResult.warnings);
		validatedFields.push(...configResult.validatedFields);

		// 2. Performance validation
		const performanceResult = this.validatePerformanceMetrics(
			config.performanceMetrics,
			config.modelId
		);
		const performanceCheck = performanceResult.isValid;
		errors.push(...performanceResult.errors);
		warnings.push(...performanceResult.warnings);
		validatedFields.push(...performanceResult.validatedFields);

		// 3. Size validation
		const sizeResult = this.validateModelSize(artifactPath, config.modelId);
		const sizeCheck = sizeResult.isValid;
		errors.push(...sizeResult.errors);
		warnings.push(...sizeResult.warnings);
		validatedFields.push(...sizeResult.validatedFields);

		// 4. Integrity validation
		const integrityResult = this.validateArtifactIntegrity(
			artifactPath,
			expectedChecksum,
			config.modelId
		);
		const integrityCheck = integrityResult.isValid;
		errors.push(...integrityResult.errors);
		warnings.push(...integrityResult.warnings);
		validatedFields.push(...integrityResult.validatedFields);

		// 5. Load time validation
		const loadTimeResult = await this.validateLoadingTime(loadFunction, config.modelId);
		const loadTimeCheck = loadTimeResult.isValid;
		errors.push(...loadTimeResult.errors);
		warnings.push(...loadTimeResult.warnings);
		validatedFields.push(...loadTimeResult.validatedFields);

		// 6. Feature compatibility validation
		const featureResult = this.validateFeatureCompatibility(
			config.features,
			providedFeatures,
			config.modelId
		);
		const featureCompatibilityCheck = featureResult.isValid;
		errors.push(...featureResult.errors);
		warnings.push(...featureResult.warnings);
		validatedFields.push(...featureResult.validatedFields);

		// 7. Hyperparameter validation
		const hyperparamResult = this.validateHyperparameters(
			config.modelType,
			config.hyperparameters,
			config.modelId
		);
		errors.push(...hyperparamResult.errors);
		warnings.push(...hyperparamResult.warnings);
		validatedFields.push(...hyperparamResult.validatedFields);

		const isValid = errors.length === 0;

		if (!isValid) {
			this.logger.error(`Deployment validation failed for model ${config.modelId}`, {
				totalErrors: errors.length,
				totalWarnings: warnings.length,
				performanceCheck,
				sizeCheck,
				integrityCheck,
				loadTimeCheck,
				featureCompatibilityCheck,
			});
		} else if (warnings.length > 0) {
			this.logger.warn(
				`Deployment validation passed with warnings for model ${config.modelId}`,
				{
					totalWarnings: warnings.length,
					warnings: warnings.slice(0, 5),
				}
			);
		} else {
			this.logger.info(`Deployment validation successful for model ${config.modelId}`, {
				validatedFields: validatedFields.length,
			});
		}

		return {
			isValid,
			errors,
			warnings,
			validatedFields,
			timestamp: Date.now(),
			performanceCheck,
			sizeCheck,
			integrityCheck,
			loadTimeCheck,
			featureCompatibilityCheck,
		};
	}

	/**
	 * Update validation thresholds
	 */
	public updateThresholds(newThresholds: Partial<ValidationThresholds>): void {
		this.thresholds = { ...this.thresholds, ...newThresholds };
		this.logger.info("Model validation thresholds updated", { thresholds: this.thresholds });
	}

	/**
	 * Get current validation thresholds
	 */
	public getThresholds(): ValidationThresholds {
		return { ...this.thresholds };
	}
}

// Factory function for creating validator instances
export const createModelValidator = (
	customThresholds?: Partial<ValidationThresholds>
): ModelValidator => {
	return new ModelValidator(customThresholds);
};

// Export default validator instance
export default ModelValidator;
