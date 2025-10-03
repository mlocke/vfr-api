/**
 * Feature Normalizer for ML Early Signal Detection
 *
 * Task 2.6: Feature Normalizer
 * Purpose: Z-score normalization for ML features
 * Estimated Time: 2 hours
 *
 * Implements standard Z-score normalization:
 * - Fit: Calculate mean and std dev from training data
 * - Transform: Apply (value - mean) / stdDev
 * - Persist: Save/load normalization parameters
 */

import type { FeatureVector } from "./types";

export interface NormalizationParams {
	[featureName: string]: {
		mean: number;
		stdDev: number;
	};
}

export class FeatureNormalizer {
	private featureMeans = new Map<string, number>();
	private featureStdDevs = new Map<string, number>();
	private featureNames: string[] = [];

	/**
	 * Fit the normalizer to training data
	 * Calculates mean and standard deviation for each feature
	 */
	fit(trainingData: FeatureVector[]): void {
		if (!trainingData || trainingData.length === 0) {
			throw new Error("Cannot fit normalizer with empty training data");
		}

		// Get feature names from first example
		this.featureNames = Object.keys(trainingData[0]);

		// Calculate mean and std dev for each feature
		for (const featureName of this.featureNames) {
			const values = trainingData.map(example => example[featureName as keyof FeatureVector]);

			// Calculate mean
			const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

			// Calculate standard deviation
			const variance =
				values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
			const stdDev = Math.sqrt(variance);

			// Store parameters (avoid division by zero)
			this.featureMeans.set(featureName, mean);
			this.featureStdDevs.set(featureName, stdDev === 0 ? 1 : stdDev);
		}

		console.log(
			`FeatureNormalizer fitted on ${trainingData.length} examples with ${this.featureNames.length} features`
		);
	}

	/**
	 * Transform features using fitted parameters
	 * Returns normalized feature array (same order as feature names)
	 */
	transform(features: FeatureVector): number[] {
		if (this.featureNames.length === 0) {
			throw new Error("Normalizer must be fitted before transforming");
		}

		return this.featureNames.map(featureName => {
			const value = features[featureName as keyof FeatureVector];
			const mean = this.featureMeans.get(featureName) || 0;
			const stdDev = this.featureStdDevs.get(featureName) || 1;

			// Z-score normalization: (value - mean) / stdDev
			return (value - mean) / stdDev;
		});
	}

	/**
	 * Fit and transform in one step (for convenience)
	 */
	fitTransform(trainingData: FeatureVector[]): number[][] {
		this.fit(trainingData);
		return trainingData.map(features => this.transform(features));
	}

	/**
	 * Get normalization parameters for persistence
	 */
	getParams(): NormalizationParams {
		const params: NormalizationParams = {};

		for (const featureName of this.featureNames) {
			params[featureName] = {
				mean: this.featureMeans.get(featureName) || 0,
				stdDev: this.featureStdDevs.get(featureName) || 1,
			};
		}

		return params;
	}

	/**
	 * Load normalization parameters from persistence
	 */
	loadParams(params: NormalizationParams): void {
		this.featureNames = Object.keys(params);
		this.featureMeans.clear();
		this.featureStdDevs.clear();

		for (const [featureName, { mean, stdDev }] of Object.entries(params)) {
			this.featureMeans.set(featureName, mean);
			this.featureStdDevs.set(featureName, stdDev);
		}

		console.log(`FeatureNormalizer loaded parameters for ${this.featureNames.length} features`);
	}

	/**
	 * Get statistics about normalized features
	 */
	getStats(): Record<string, { mean: number; stdDev: number; min?: number; max?: number }> {
		const stats: Record<string, { mean: number; stdDev: number }> = {};

		for (const featureName of this.featureNames) {
			stats[featureName] = {
				mean: this.featureMeans.get(featureName) || 0,
				stdDev: this.featureStdDevs.get(featureName) || 1,
			};
		}

		return stats;
	}

	/**
	 * Check if normalizer is fitted
	 */
	isFitted(): boolean {
		return this.featureNames.length > 0;
	}
}
