/**
 * Model Performance Tracker for VFR ML Ensemble System
 *
 * Tracks real-time model performance metrics for dynamic weight calculation
 * and ensemble optimization. Follows KISS principles with PostgreSQL persistence.
 *
 * Features:
 * - Real-time accuracy tracking per model
 * - Latency monitoring (p50, p95, p99 percentiles)
 * - Drift detection (feature drift, concept drift)
 * - Performance history with rolling windows
 * - Model reliability scores
 * - PostgreSQL integration for persistence
 *
 * Performance Target: <10ms for metric updates
 * Storage: PostgreSQL ml_model_performance table
 */

import { Pool } from "pg";
import { Logger } from "../../error-handling/Logger";
import { ErrorHandler, ErrorType, ErrorCode } from "../../error-handling/ErrorHandler";
import { MLServiceResponse } from "../types/MLTypes";

// ===== Performance Tracking Types =====

export interface ModelPredictionResult {
	modelId: string;
	symbol: string;
	prediction: number;
	confidence: number;
	actual?: number; // Available after validation period
	latencyMs: number;
	timestamp: number;
}

export interface ModelPerformanceMetrics {
	modelId: string;
	windowSize: number; // Number of predictions in window
	accuracy: number; // 0-1, percentage of correct predictions
	precision: number; // True positives / (true positives + false positives)
	recall: number; // True positives / (true positives + false negatives)
	sharpeRatio: number; // Risk-adjusted returns
	meanAbsoluteError: number; // Average prediction error
	latencyP50: number; // Median latency (ms)
	latencyP95: number; // 95th percentile latency (ms)
	latencyP99: number; // 99th percentile latency (ms)
	reliabilityScore: number; // 0-1, composite reliability metric
	featureDrift: number; // 0-1, feature distribution drift
	conceptDrift: number; // 0-1, concept/label drift
	lastUpdated: number;
}

export interface PerformanceWindow {
	modelId: string;
	predictions: ModelPredictionResult[];
	maxSize: number; // Rolling window size
	startTime: number;
	endTime: number;
}

export interface DriftMetrics {
	featureDrift: number; // Statistical distance from training distribution
	conceptDrift: number; // Change in prediction accuracy over time
	driftDetected: boolean;
	severity: "low" | "medium" | "high";
}

// ===== Configuration =====

export interface PerformanceTrackerConfig {
	rollingWindowSize: number; // Default: 1000 predictions
	driftThreshold: number; // Default: 0.15 (15% drift triggers alert)
	minPredictionsForMetrics: number; // Default: 50
	persistenceInterval: number; // Default: 60 seconds
	enableDriftDetection: boolean; // Default: true
}

/**
 * ModelPerformanceTracker
 * Singleton service for tracking and analyzing model performance
 */
export class ModelPerformanceTracker {
	private static instance: ModelPerformanceTracker;
	private pool: Pool;
	private logger: Logger;
	private errorHandler: ErrorHandler;
	private config: PerformanceTrackerConfig;
	private performanceWindows: Map<string, PerformanceWindow>;
	private latencyBuffers: Map<string, number[]>; // For percentile calculations
	private initialized = false;
	private persistenceTimer?: NodeJS.Timeout;

	private constructor(config?: Partial<PerformanceTrackerConfig>) {
		this.pool = new Pool({
			connectionString: process.env.DATABASE_URL,
			max: 20,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 5000,
			ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
		});

		this.logger = Logger.getInstance("ModelPerformanceTracker");
		this.errorHandler = ErrorHandler.getInstance();

		this.config = {
			rollingWindowSize: config?.rollingWindowSize ?? 1000,
			driftThreshold: config?.driftThreshold ?? 0.15,
			minPredictionsForMetrics: config?.minPredictionsForMetrics ?? 50,
			persistenceInterval: config?.persistenceInterval ?? 60000, // 60 seconds
			enableDriftDetection: config?.enableDriftDetection ?? true,
		};

		this.performanceWindows = new Map();
		this.latencyBuffers = new Map();

		// Handle pool errors
		this.pool.on("error", err => {
			this.logger.error("PostgreSQL pool error in ModelPerformanceTracker", { error: err });
			this.initialized = false;
		});
	}

	/**
	 * Get singleton instance
	 */
	public static getInstance(config?: Partial<PerformanceTrackerConfig>): ModelPerformanceTracker {
		if (!ModelPerformanceTracker.instance) {
			ModelPerformanceTracker.instance = new ModelPerformanceTracker(config);
		}
		return ModelPerformanceTracker.instance;
	}

	/**
	 * Reset singleton (for testing)
	 */
	public static resetInstance(): void {
		if (ModelPerformanceTracker.instance) {
			ModelPerformanceTracker.instance.cleanup();
			ModelPerformanceTracker.instance = null as any;
		}
	}

	/**
	 * Initialize the tracker
	 */
	public async initialize(): Promise<MLServiceResponse<void>> {
		try {
			this.logger.info("Initializing ModelPerformanceTracker");

			// Test database connection
			const client = await this.pool.connect();
			await client.query("SELECT 1");
			client.release();

			// Start periodic persistence
			this.startPeriodicPersistence();

			this.initialized = true;
			this.logger.info("ModelPerformanceTracker initialized successfully");

			return {
				success: true,
				data: undefined,
				metadata: {
					latency: 0,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Failed to initialize ModelPerformanceTracker", { error });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelPerformanceTracker.initialize"
			) as MLServiceResponse<void>;
		}
	}

	/**
	 * Record a prediction result for performance tracking
	 */
	public async recordPrediction(result: ModelPredictionResult): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			// Get or create performance window for this model
			let window = this.performanceWindows.get(result.modelId);
			if (!window) {
				window = {
					modelId: result.modelId,
					predictions: [],
					maxSize: this.config.rollingWindowSize,
					startTime: Date.now(),
					endTime: Date.now(),
				};
				this.performanceWindows.set(result.modelId, window);
			}

			// Add prediction to window
			window.predictions.push(result);
			window.endTime = Date.now();

			// Maintain rolling window size
			if (window.predictions.length > window.maxSize) {
				window.predictions.shift();
				window.startTime = window.predictions[0].timestamp;
			}

			// Record latency for percentile calculations
			let latencies = this.latencyBuffers.get(result.modelId);
			if (!latencies) {
				latencies = [];
				this.latencyBuffers.set(result.modelId, latencies);
			}
			latencies.push(result.latencyMs);

			// Keep latency buffer bounded (last 1000 measurements)
			if (latencies.length > 1000) {
				latencies.shift();
			}
		} catch (error) {
			this.logger.warn("Failed to record prediction", {
				error,
				modelId: result.modelId,
			});
		}
	}

	/**
	 * Get current performance metrics for a model
	 */
	public async getPerformanceMetrics(
		modelId: string
	): Promise<MLServiceResponse<ModelPerformanceMetrics>> {
		const startTime = Date.now();

		try {
			const window = this.performanceWindows.get(modelId);
			if (!window || window.predictions.length < this.config.minPredictionsForMetrics) {
				return {
					success: false,
					error: {
						type: ErrorType.DATA_QUALITY_ERROR,
						code: ErrorCode.INCOMPLETE_DATA,
						message: `Insufficient data for model ${modelId}. Need at least ${this.config.minPredictionsForMetrics} predictions.`,
						severity: this.errorHandler.createErrorResponse(
							new Error("Insufficient data"),
							"ModelPerformanceTracker.getPerformanceMetrics"
						).error.severity,
						timestamp: Date.now(),
						source: "ModelPerformanceTracker.getPerformanceMetrics",
						retryable: true,
					},
				};
			}

			// Calculate performance metrics
			const metrics = this.calculateMetrics(window);

			// Calculate drift metrics if enabled
			if (this.config.enableDriftDetection) {
				const drift = this.calculateDrift(window);
				metrics.featureDrift = drift.featureDrift;
				metrics.conceptDrift = drift.conceptDrift;
			}

			return {
				success: true,
				data: metrics,
				metadata: {
					latency: Date.now() - startTime,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Failed to get performance metrics", { error, modelId });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelPerformanceTracker.getPerformanceMetrics"
			) as MLServiceResponse<ModelPerformanceMetrics>;
		}
	}

	/**
	 * Get performance metrics for all tracked models
	 */
	public async getAllPerformanceMetrics(): Promise<
		MLServiceResponse<Map<string, ModelPerformanceMetrics>>
	> {
		const startTime = Date.now();

		try {
			const allMetrics = new Map<string, ModelPerformanceMetrics>();

			for (const [modelId, window] of this.performanceWindows.entries()) {
				if (window.predictions.length >= this.config.minPredictionsForMetrics) {
					const metrics = this.calculateMetrics(window);

					if (this.config.enableDriftDetection) {
						const drift = this.calculateDrift(window);
						metrics.featureDrift = drift.featureDrift;
						metrics.conceptDrift = drift.conceptDrift;
					}

					allMetrics.set(modelId, metrics);
				}
			}

			return {
				success: true,
				data: allMetrics,
				metadata: {
					latency: Date.now() - startTime,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Failed to get all performance metrics", { error });
			return this.errorHandler.createErrorResponse(
				error,
				"ModelPerformanceTracker.getAllPerformanceMetrics"
			) as MLServiceResponse<Map<string, ModelPerformanceMetrics>>;
		}
	}

	/**
	 * Calculate comprehensive performance metrics from prediction window
	 */
	private calculateMetrics(window: PerformanceWindow): ModelPerformanceMetrics {
		const predictions = window.predictions;

		// Filter predictions with actual values for accuracy calculations
		const validatedPredictions = predictions.filter(p => p.actual !== undefined);

		// Calculate accuracy metrics
		let accuracy = 0;
		let precision = 0;
		let recall = 0;
		let mae = 0;

		if (validatedPredictions.length > 0) {
			// Direction accuracy (for classification)
			const correctPredictions = validatedPredictions.filter(
				p => Math.sign(p.prediction) === Math.sign(p.actual!)
			);
			accuracy = correctPredictions.length / validatedPredictions.length;

			// Calculate MAE
			mae =
				validatedPredictions.reduce((sum, p) => sum + Math.abs(p.prediction - p.actual!), 0) /
				validatedPredictions.length;

			// Calculate precision and recall for positive predictions
			const truePositives = validatedPredictions.filter(
				p => p.prediction > 0 && p.actual! > 0
			).length;
			const falsePositives = validatedPredictions.filter(
				p => p.prediction > 0 && p.actual! <= 0
			).length;
			const falseNegatives = validatedPredictions.filter(
				p => p.prediction <= 0 && p.actual! > 0
			).length;

			precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
			recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
		}

		// Calculate Sharpe Ratio (simplified - assumes risk-free rate = 0)
		const returns = validatedPredictions.map(p => p.actual! - p.prediction);
		const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
		const stdDev =
			returns.length > 1
				? Math.sqrt(
						returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
							(returns.length - 1)
					)
				: 0;
		const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;

		// Calculate latency percentiles
		const latencies = this.latencyBuffers.get(window.modelId) || [];
		const sortedLatencies = [...latencies].sort((a, b) => a - b);
		const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
		const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
		const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;

		// Calculate reliability score (composite metric)
		const reliabilityScore = this.calculateReliabilityScore({
			accuracy,
			precision,
			recall,
			sharpeRatio,
			latencyP95: p95,
		});

		return {
			modelId: window.modelId,
			windowSize: predictions.length,
			accuracy,
			precision,
			recall,
			sharpeRatio,
			meanAbsoluteError: mae,
			latencyP50: p50,
			latencyP95: p95,
			latencyP99: p99,
			reliabilityScore,
			featureDrift: 0, // Calculated separately if drift detection enabled
			conceptDrift: 0, // Calculated separately if drift detection enabled
			lastUpdated: Date.now(),
		};
	}

	/**
	 * Calculate reliability score from performance metrics
	 */
	private calculateReliabilityScore(metrics: {
		accuracy: number;
		precision: number;
		recall: number;
		sharpeRatio: number;
		latencyP95: number;
	}): number {
		// Weighted combination of performance factors
		const accuracyWeight = 0.3;
		const precisionWeight = 0.2;
		const recallWeight = 0.2;
		const sharpeWeight = 0.2;
		const latencyWeight = 0.1;

		// Normalize Sharpe ratio (clamp to 0-1 range, assuming -1 to 2 typical range)
		const normalizedSharpe = Math.max(0, Math.min(1, (metrics.sharpeRatio + 1) / 3));

		// Penalize high latency (assuming 200ms target, 500ms max acceptable)
		const latencyScore = Math.max(0, 1 - metrics.latencyP95 / 500);

		const score =
			metrics.accuracy * accuracyWeight +
			metrics.precision * precisionWeight +
			metrics.recall * recallWeight +
			normalizedSharpe * sharpeWeight +
			latencyScore * latencyWeight;

		return Math.max(0, Math.min(1, score));
	}

	/**
	 * Calculate drift metrics for a model
	 */
	private calculateDrift(window: PerformanceWindow): DriftMetrics {
		// Simple drift detection based on recent vs. historical performance
		const predictions = window.predictions;
		if (predictions.length < 100) {
			return {
				featureDrift: 0,
				conceptDrift: 0,
				driftDetected: false,
				severity: "low",
			};
		}

		// Split into historical (first 70%) and recent (last 30%)
		const splitPoint = Math.floor(predictions.length * 0.7);
		const historical = predictions.slice(0, splitPoint).filter(p => p.actual !== undefined);
		const recent = predictions.slice(splitPoint).filter(p => p.actual !== undefined);

		if (historical.length < 30 || recent.length < 15) {
			return {
				featureDrift: 0,
				conceptDrift: 0,
				driftDetected: false,
				severity: "low",
			};
		}

		// Calculate concept drift (accuracy degradation)
		const historicalAccuracy =
			historical.filter(p => Math.sign(p.prediction) === Math.sign(p.actual!)).length /
			historical.length;
		const recentAccuracy =
			recent.filter(p => Math.sign(p.prediction) === Math.sign(p.actual!)).length / recent.length;

		const conceptDrift = Math.abs(historicalAccuracy - recentAccuracy);

		// Feature drift approximation (confidence distribution shift)
		const historicalAvgConfidence =
			historical.reduce((sum, p) => sum + p.confidence, 0) / historical.length;
		const recentAvgConfidence = recent.reduce((sum, p) => sum + p.confidence, 0) / recent.length;

		const featureDrift = Math.abs(historicalAvgConfidence - recentAvgConfidence);

		const driftDetected = conceptDrift > this.config.driftThreshold || featureDrift > this.config.driftThreshold;

		let severity: "low" | "medium" | "high" = "low";
		const maxDrift = Math.max(conceptDrift, featureDrift);
		if (maxDrift > this.config.driftThreshold * 2) {
			severity = "high";
		} else if (maxDrift > this.config.driftThreshold * 1.5) {
			severity = "medium";
		}

		return {
			featureDrift,
			conceptDrift,
			driftDetected,
			severity,
		};
	}

	/**
	 * Persist performance metrics to database
	 */
	public async persistMetrics(modelId: string): Promise<boolean> {
		try {
			const metricsResult = await this.getPerformanceMetrics(modelId);
			if (!metricsResult.success || !metricsResult.data) {
				return false;
			}

			const metrics = metricsResult.data;

			const query = `
        INSERT INTO ml_model_performance (
          model_id, window_size, accuracy, precision, recall,
          sharpe_ratio, mean_absolute_error, latency_p50, latency_p95, latency_p99,
          reliability_score, feature_drift, concept_drift, last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (model_id)
        DO UPDATE SET
          window_size = EXCLUDED.window_size,
          accuracy = EXCLUDED.accuracy,
          precision = EXCLUDED.precision,
          recall = EXCLUDED.recall,
          sharpe_ratio = EXCLUDED.sharpe_ratio,
          mean_absolute_error = EXCLUDED.mean_absolute_error,
          latency_p50 = EXCLUDED.latency_p50,
          latency_p95 = EXCLUDED.latency_p95,
          latency_p99 = EXCLUDED.latency_p99,
          reliability_score = EXCLUDED.reliability_score,
          feature_drift = EXCLUDED.feature_drift,
          concept_drift = EXCLUDED.concept_drift,
          last_updated = NOW()
      `;

			const params = [
				metrics.modelId,
				metrics.windowSize,
				metrics.accuracy,
				metrics.precision,
				metrics.recall,
				metrics.sharpeRatio,
				metrics.meanAbsoluteError,
				metrics.latencyP50,
				metrics.latencyP95,
				metrics.latencyP99,
				metrics.reliabilityScore,
				metrics.featureDrift,
				metrics.conceptDrift,
			];

			await this.pool.query(query, params);
			return true;
		} catch (error) {
			this.logger.warn("Failed to persist metrics", { error, modelId });
			return false;
		}
	}

	/**
	 * Load historical performance metrics from database
	 */
	public async loadMetrics(modelId: string): Promise<ModelPerformanceMetrics | null> {
		try {
			const query = `
        SELECT
          model_id, window_size, accuracy, precision, recall,
          sharpe_ratio, mean_absolute_error, latency_p50, latency_p95, latency_p99,
          reliability_score, feature_drift, concept_drift,
          EXTRACT(EPOCH FROM last_updated) * 1000 as last_updated
        FROM ml_model_performance
        WHERE model_id = $1
      `;

			const result = await this.pool.query(query, [modelId]);
			if (result.rows.length === 0) {
				return null;
			}

			const row = result.rows[0];
			return {
				modelId: row.model_id,
				windowSize: row.window_size,
				accuracy: row.accuracy,
				precision: row.precision,
				recall: row.recall,
				sharpeRatio: row.sharpe_ratio,
				meanAbsoluteError: row.mean_absolute_error,
				latencyP50: row.latency_p50,
				latencyP95: row.latency_p95,
				latencyP99: row.latency_p99,
				reliabilityScore: row.reliability_score,
				featureDrift: row.feature_drift,
				conceptDrift: row.concept_drift,
				lastUpdated: row.last_updated,
			};
		} catch (error) {
			this.logger.warn("Failed to load metrics", { error, modelId });
			return null;
		}
	}

	/**
	 * Start periodic persistence of metrics to database
	 */
	private startPeriodicPersistence(): void {
		this.persistenceTimer = setInterval(async () => {
			for (const modelId of this.performanceWindows.keys()) {
				await this.persistMetrics(modelId);
			}
		}, this.config.persistenceInterval);
	}

	/**
	 * Stop periodic persistence
	 */
	private stopPeriodicPersistence(): void {
		if (this.persistenceTimer) {
			clearInterval(this.persistenceTimer);
			this.persistenceTimer = undefined;
		}
	}

	/**
	 * Health check
	 */
	public async healthCheck(): Promise<boolean> {
		try {
			const client = await this.pool.connect();
			await client.query("SELECT 1");
			client.release();
			return true;
		} catch (error) {
			this.logger.error("Health check failed", { error });
			return false;
		}
	}

	/**
	 * Cleanup resources
	 */
	public cleanup(): void {
		this.stopPeriodicPersistence();
		this.performanceWindows.clear();
		this.latencyBuffers.clear();
		this.pool.end();
		this.initialized = false;
		this.logger.info("ModelPerformanceTracker cleanup completed");
	}
}

// Export singleton instance
export default ModelPerformanceTracker.getInstance();
