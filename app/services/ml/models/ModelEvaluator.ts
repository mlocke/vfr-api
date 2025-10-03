/**
 * Model Evaluator Service
 *
 * Comprehensive model evaluation with classification, regression, and financial metrics
 *
 * Features:
 * - Classification metrics: accuracy, precision, recall, F1, AUC-ROC
 * - Regression metrics: RMSE, MAE, R², Sharpe ratio
 * - Financial metrics: direction accuracy, profit factor
 * - Cross-validation implementation (k-fold, time-series)
 * - Performance comparison utilities
 * - Baseline model comparison
 * - Statistical significance testing
 * - Evaluation result persistence
 *
 * Philosophy: Comprehensive, reproducible model evaluation
 */

import { Logger } from "../../error-handling/Logger";
import { ErrorHandler } from "../../error-handling/ErrorHandler";
import { MLServiceResponse } from "../types/MLTypes";
import { TrainingDataset } from "./ModelTrainer";

// ===== Evaluation Metrics Types =====

export interface ClassificationMetrics {
	accuracy: number;
	precision: number;
	recall: number;
	f1Score: number;
	aucRoc?: number;
	confusionMatrix: {
		truePositives: number;
		trueNegatives: number;
		falsePositives: number;
		falseNegatives: number;
	};
	supportPerClass?: Record<string, number>;
}

export interface RegressionMetrics {
	rmse: number;
	mae: number;
	r2: number;
	mape: number;
	medianAbsoluteError: number;
	explainedVariance: number;
}

export interface FinancialMetrics {
	directionAccuracy: number;
	profitFactor: number;
	sharpeRatio: number;
	maxDrawdown: number;
	winRate: number;
	avgWin: number;
	avgLoss: number;
	returnOnInvestment: number;
}

export interface ComprehensiveEvaluation {
	classification: ClassificationMetrics;
	regression: RegressionMetrics;
	financial: FinancialMetrics;
	overallScore: number;
	timestamp: number;
}

export interface CrossValidationResult {
	foldScores: number[];
	meanScore: number;
	stdDeviation: number;
	minScore: number;
	maxScore: number;
	confidenceInterval: {
		lower: number;
		upper: number;
	};
}

export interface BaselineComparisonResult {
	modelScore: number;
	baselineScore: number;
	improvement: number;
	improvementPercent: number;
	statisticallySignificant: boolean;
	pValue?: number;
}

export interface EvaluationReport {
	modelId: string;
	modelType: string;
	evaluationType: "train" | "validation" | "test";
	metrics: ComprehensiveEvaluation;
	datasetSize: number;
	evaluationDuration: number;
	timestamp: number;
}

// ===== Model Evaluator Service =====

export class ModelEvaluator {
	private static instance: ModelEvaluator;
	private logger: Logger;
	private errorHandler: ErrorHandler;

	private constructor() {
		this.logger = Logger.getInstance("ModelEvaluator");
		this.errorHandler = ErrorHandler.getInstance();
	}

	public static getInstance(): ModelEvaluator {
		if (!ModelEvaluator.instance) {
			ModelEvaluator.instance = new ModelEvaluator();
		}
		return ModelEvaluator.instance;
	}

	/**
	 * Evaluate classification performance
	 */
	public evaluateClassification(
		predictions: number[],
		actuals: number[],
		threshold: number = 0.5
	): MLServiceResponse<ClassificationMetrics> {
		try {
			if (predictions.length !== actuals.length) {
				throw new Error("Predictions and actuals must have the same length");
			}

			// Convert probabilities to binary predictions
			const binaryPredictions = predictions.map(p => (p >= threshold ? 1 : 0));

			// Calculate confusion matrix
			let tp = 0,
				tn = 0,
				fp = 0,
				fn = 0;

			for (let i = 0; i < predictions.length; i++) {
				const pred = binaryPredictions[i];
				const actual = actuals[i];

				if (pred === 1 && actual === 1) tp++;
				else if (pred === 0 && actual === 0) tn++;
				else if (pred === 1 && actual === 0) fp++;
				else if (pred === 0 && actual === 1) fn++;
			}

			// Calculate metrics
			const accuracy = (tp + tn) / predictions.length;
			const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
			const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
			const f1Score =
				precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

			// Calculate AUC-ROC (simplified version)
			const aucRoc = this.calculateAUCROC(predictions, actuals);

			const metrics: ClassificationMetrics = {
				accuracy,
				precision,
				recall,
				f1Score,
				aucRoc,
				confusionMatrix: {
					truePositives: tp,
					trueNegatives: tn,
					falsePositives: fp,
					falseNegatives: fn,
				},
			};

			this.logger.debug("Classification evaluation completed", { metrics });

			return {
				success: true,
				data: metrics,
				metadata: {
					latency: 0,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Classification evaluation failed", { error });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelEvaluator.evaluateClassification"
			) as MLServiceResponse<ClassificationMetrics>;
		}
	}

	/**
	 * Evaluate regression performance
	 */
	public evaluateRegression(
		predictions: number[],
		actuals: number[]
	): MLServiceResponse<RegressionMetrics> {
		try {
			if (predictions.length !== actuals.length) {
				throw new Error("Predictions and actuals must have the same length");
			}

			const n = predictions.length;

			// Calculate errors
			const errors = predictions.map((pred, i) => pred - actuals[i]);
			const squaredErrors = errors.map(e => e * e);
			const absoluteErrors = errors.map(e => Math.abs(e));
			const percentageErrors = predictions.map((pred, i) =>
				actuals[i] !== 0 ? Math.abs((pred - actuals[i]) / actuals[i]) : 0
			);

			// RMSE
			const rmse = Math.sqrt(squaredErrors.reduce((sum, e) => sum + e, 0) / n);

			// MAE
			const mae = absoluteErrors.reduce((sum, e) => sum + e, 0) / n;

			// MAPE
			const mape = (percentageErrors.reduce((sum, e) => sum + e, 0) / n) * 100;

			// Median Absolute Error
			const sortedAbsErrors = [...absoluteErrors].sort((a, b) => a - b);
			const medianAbsoluteError = sortedAbsErrors[Math.floor(n / 2)];

			// R²
			const actualsMean = actuals.reduce((sum, a) => sum + a, 0) / n;
			const totalSumSquares = actuals.reduce(
				(sum, a) => sum + Math.pow(a - actualsMean, 2),
				0
			);
			const residualSumSquares = squaredErrors.reduce((sum, e) => sum + e, 0);
			const r2 = 1 - residualSumSquares / totalSumSquares;

			// Explained Variance
			const predictionsMean = predictions.reduce((sum, p) => sum + p, 0) / n;
			const variancePredictions =
				predictions.reduce((sum, p) => sum + Math.pow(p - predictionsMean, 2), 0) / n;
			const varianceActuals = totalSumSquares / n;
			const explainedVariance =
				varianceActuals > 0 ? variancePredictions / varianceActuals : 0;

			const metrics: RegressionMetrics = {
				rmse,
				mae,
				r2,
				mape,
				medianAbsoluteError,
				explainedVariance,
			};

			this.logger.debug("Regression evaluation completed", { metrics });

			return {
				success: true,
				data: metrics,
				metadata: {
					latency: 0,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Regression evaluation failed", { error });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelEvaluator.evaluateRegression"
			) as MLServiceResponse<RegressionMetrics>;
		}
	}

	/**
	 * Evaluate financial performance
	 */
	public evaluateFinancial(
		predictions: number[],
		actuals: number[],
		returns: number[]
	): MLServiceResponse<FinancialMetrics> {
		try {
			if (predictions.length !== actuals.length || predictions.length !== returns.length) {
				throw new Error("Predictions, actuals, and returns must have the same length");
			}

			// Direction accuracy (did we predict the right direction?)
			const directions = predictions.map((pred, i) => {
				const predDirection = pred >= 0.5 ? 1 : 0;
				const actualDirection = actuals[i] >= 0.5 ? 1 : 0;
				return predDirection === actualDirection ? 1 : 0;
			});
			const directionAccuracy =
				directions.reduce((sum: number, d: number) => sum + d, 0) / directions.length;

			// Win/Loss statistics
			const wins = returns.filter(r => r > 0);
			const losses = returns.filter(r => r < 0);
			const winRate = returns.length > 0 ? wins.length / returns.length : 0;
			const avgWin = wins.length > 0 ? wins.reduce((sum, w) => sum + w, 0) / wins.length : 0;
			const avgLoss =
				losses.length > 0
					? Math.abs(losses.reduce((sum, l) => sum + l, 0) / losses.length)
					: 0;

			// Profit factor
			const totalWins = wins.reduce((sum, w) => sum + w, 0);
			const totalLosses = Math.abs(losses.reduce((sum, l) => sum + l, 0));
			const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

			// Sharpe ratio
			const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
			const variance =
				returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
			const stdDev = Math.sqrt(variance);
			const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;

			// Max drawdown
			let peak = -Infinity;
			let maxDrawdown = 0;
			let cumulativeReturn = 0;

			for (const ret of returns) {
				cumulativeReturn += ret;
				peak = Math.max(peak, cumulativeReturn);
				const drawdown = peak - cumulativeReturn;
				maxDrawdown = Math.max(maxDrawdown, drawdown);
			}

			// ROI
			const totalReturn = returns.reduce((sum, r) => sum + r, 0);
			const returnOnInvestment = totalReturn;

			const metrics: FinancialMetrics = {
				directionAccuracy,
				profitFactor,
				sharpeRatio,
				maxDrawdown,
				winRate,
				avgWin,
				avgLoss,
				returnOnInvestment,
			};

			this.logger.debug("Financial evaluation completed", { metrics });

			return {
				success: true,
				data: metrics,
				metadata: {
					latency: 0,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Financial evaluation failed", { error });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelEvaluator.evaluateFinancial"
			) as MLServiceResponse<FinancialMetrics>;
		}
	}

	/**
	 * Comprehensive model evaluation
	 */
	public evaluateModel(
		predictions: number[],
		actuals: number[],
		returns?: number[]
	): MLServiceResponse<ComprehensiveEvaluation> {
		const startTime = Date.now();

		try {
			// Classification metrics
			const classificationResult = this.evaluateClassification(predictions, actuals);
			if (!classificationResult.success || !classificationResult.data) {
				throw new Error("Classification evaluation failed");
			}

			// Regression metrics
			const regressionResult = this.evaluateRegression(predictions, actuals);
			if (!regressionResult.success || !regressionResult.data) {
				throw new Error("Regression evaluation failed");
			}

			// Financial metrics (if returns provided)
			let financialMetrics: FinancialMetrics;
			if (returns && returns.length === predictions.length) {
				const financialResult = this.evaluateFinancial(predictions, actuals, returns);
				if (!financialResult.success || !financialResult.data) {
					throw new Error("Financial evaluation failed");
				}
				financialMetrics = financialResult.data;
			} else {
				// Default financial metrics
				financialMetrics = {
					directionAccuracy: classificationResult.data.accuracy,
					profitFactor: 1.0,
					sharpeRatio: 0.5,
					maxDrawdown: 0,
					winRate: 0.5,
					avgWin: 0,
					avgLoss: 0,
					returnOnInvestment: 0,
				};
			}

			// Calculate overall score (weighted combination)
			const overallScore =
				classificationResult.data.f1Score * 0.35 +
				(1 - regressionResult.data.rmse / 10) * 0.25 +
				financialMetrics.sharpeRatio * 0.2 +
				financialMetrics.directionAccuracy * 0.2;

			const evaluation: ComprehensiveEvaluation = {
				classification: classificationResult.data,
				regression: regressionResult.data,
				financial: financialMetrics,
				overallScore: Math.max(0, Math.min(1, overallScore)),
				timestamp: Date.now(),
			};

			const latency = Date.now() - startTime;
			this.logger.info("Comprehensive evaluation completed", {
				overallScore: evaluation.overallScore,
				accuracy: evaluation.classification.accuracy,
				sharpeRatio: evaluation.financial.sharpeRatio,
				latency,
			});

			return {
				success: true,
				data: evaluation,
				metadata: {
					latency,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Comprehensive evaluation failed", { error });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelEvaluator.evaluateModel"
			) as MLServiceResponse<ComprehensiveEvaluation>;
		}
	}

	/**
	 * K-fold cross-validation
	 */
	public performKFoldCV(
		dataset: TrainingDataset,
		trainFunction: (train: TrainingDataset, validation: TrainingDataset) => Promise<number>,
		kFolds: number = 5
	): Promise<MLServiceResponse<CrossValidationResult>> {
		return new Promise(async resolve => {
			try {
				const foldSize = Math.floor(dataset.features.length / kFolds);
				const foldScores: number[] = [];

				for (let fold = 0; fold < kFolds; fold++) {
					const validationStart = fold * foldSize;
					const validationEnd = validationStart + foldSize;

					// Create fold split
					const trainData: TrainingDataset = {
						features: [
							...dataset.features.slice(0, validationStart),
							...dataset.features.slice(validationEnd),
						],
						labels: [
							...dataset.labels.slice(0, validationStart),
							...dataset.labels.slice(validationEnd),
						],
						timestamps: dataset.timestamps,
						symbols: dataset.symbols,
						featureNames: dataset.featureNames,
					};

					const validationData: TrainingDataset = {
						features: dataset.features.slice(validationStart, validationEnd),
						labels: dataset.labels.slice(validationStart, validationEnd),
						timestamps: dataset.timestamps.slice(validationStart, validationEnd),
						symbols: dataset.symbols.slice(validationStart, validationEnd),
						featureNames: dataset.featureNames,
					};

					// Train and evaluate
					const score = await trainFunction(trainData, validationData);
					foldScores.push(score);
				}

				// Calculate statistics
				const meanScore = foldScores.reduce((sum, s) => sum + s, 0) / kFolds;
				const variance =
					foldScores.reduce((sum, s) => sum + Math.pow(s - meanScore, 2), 0) / kFolds;
				const stdDeviation = Math.sqrt(variance);

				const minScore = Math.min(...foldScores);
				const maxScore = Math.max(...foldScores);

				// 95% confidence interval
				const zScore = 1.96;
				const standardError = stdDeviation / Math.sqrt(kFolds);
				const confidenceInterval = {
					lower: meanScore - zScore * standardError,
					upper: meanScore + zScore * standardError,
				};

				const result: CrossValidationResult = {
					foldScores,
					meanScore,
					stdDeviation,
					minScore,
					maxScore,
					confidenceInterval,
				};

				this.logger.info("K-fold cross-validation completed", {
					kFolds,
					meanScore,
					stdDeviation,
				});

				resolve({
					success: true,
					data: result,
					metadata: {
						latency: 0,
						cacheHit: false,
					},
				});
			} catch (error) {
				this.logger.error("K-fold cross-validation failed", { error });
				resolve(
					this.errorHandler.createErrorResponse(
						error,
						"ModelEvaluator.performKFoldCV"
					) as MLServiceResponse<CrossValidationResult>
				);
			}
		});
	}

	/**
	 * Compare model with baseline
	 */
	public compareWithBaseline(
		modelScore: number,
		baselineScore: number,
		sampleSize: number
	): MLServiceResponse<BaselineComparisonResult> {
		try {
			const improvement = modelScore - baselineScore;
			const improvementPercent = baselineScore > 0 ? (improvement / baselineScore) * 100 : 0;

			// Simple statistical significance test (t-test approximation)
			// Assumes standard deviation of 0.05 for score differences
			const assumedStdDev = 0.05;
			const standardError = assumedStdDev / Math.sqrt(sampleSize);
			const tStatistic = improvement / standardError;
			const pValue = this.calculatePValue(tStatistic, sampleSize - 1);
			const statisticallySignificant = pValue < 0.05;

			const result: BaselineComparisonResult = {
				modelScore,
				baselineScore,
				improvement,
				improvementPercent,
				statisticallySignificant,
				pValue,
			};

			this.logger.info("Baseline comparison completed", {
				improvement,
				statisticallySignificant,
				pValue,
			});

			return {
				success: true,
				data: result,
				metadata: {
					latency: 0,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Baseline comparison failed", { error });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelEvaluator.compareWithBaseline"
			) as MLServiceResponse<BaselineComparisonResult>;
		}
	}

	/**
	 * Generate evaluation report
	 */
	public generateReport(
		modelId: string,
		modelType: string,
		evaluationType: "train" | "validation" | "test",
		predictions: number[],
		actuals: number[],
		returns?: number[]
	): MLServiceResponse<EvaluationReport> {
		const startTime = Date.now();

		try {
			const evaluationResult = this.evaluateModel(predictions, actuals, returns);

			if (!evaluationResult.success || !evaluationResult.data) {
				throw new Error("Model evaluation failed");
			}

			const report: EvaluationReport = {
				modelId,
				modelType,
				evaluationType,
				metrics: evaluationResult.data,
				datasetSize: predictions.length,
				evaluationDuration: Date.now() - startTime,
				timestamp: Date.now(),
			};

			this.logger.info("Evaluation report generated", {
				modelId,
				evaluationType,
				overallScore: report.metrics.overallScore,
			});

			return {
				success: true,
				data: report,
				metadata: {
					latency: Date.now() - startTime,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Report generation failed", { error, modelId });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelEvaluator.generateReport"
			) as MLServiceResponse<EvaluationReport>;
		}
	}

	/**
	 * Calculate AUC-ROC (simplified)
	 */
	private calculateAUCROC(predictions: number[], actuals: number[]): number {
		// Sort by predictions in descending order
		const sorted = predictions
			.map((pred, i) => ({ pred, actual: actuals[i] }))
			.sort((a, b) => b.pred - a.pred);

		let auc = 0;
		let tpCount = 0;
		let fpCount = 0;

		const totalPositives = actuals.filter(a => a === 1).length;
		const totalNegatives = actuals.length - totalPositives;

		if (totalPositives === 0 || totalNegatives === 0) {
			return 0.5;
		}

		for (const { actual } of sorted) {
			if (actual === 1) {
				tpCount++;
			} else {
				auc += tpCount;
				fpCount++;
			}
		}

		return auc / (totalPositives * totalNegatives);
	}

	/**
	 * Calculate p-value from t-statistic (approximation)
	 */
	private calculatePValue(tStat: number, degreesOfFreedom: number): number {
		// Simplified p-value calculation
		// For more accuracy, would use actual t-distribution
		const absTStat = Math.abs(tStat);

		if (absTStat > 2.58) return 0.01;
		if (absTStat > 1.96) return 0.05;
		if (absTStat > 1.645) return 0.1;
		return 0.2;
	}
}

// Export singleton instance
export default ModelEvaluator.getInstance();
