/**
 * Model Manager Service - Model lifecycle management for VFR ML enhancement layer
 * Handles model registration, loading, caching, and deployment
 * Following VFR patterns with KISS principles
 */

import { Logger } from "../error-handling/Logger";
import { ErrorHandler, ErrorType, ErrorCode } from "../error-handling/ErrorHandler";
import {
	MLModelConfig,
	MLModelStatus,
	MLModelType,
	MLModelPerformance,
	MLPredictionHorizon,
	MLServiceResponse,
} from "./types/MLTypes";

export interface ModelManagerConfig {
	enableCache: boolean;
	maxCachedModels: number;
	modelLoadTimeout: number;
	enableVersioning: boolean;
}

export interface ModelArtifact {
	modelId: string;
	version: string;
	modelType: MLModelType;
	artifact: any; // Will contain actual model when implemented
	metadata: Record<string, any>;
	size: number;
	loadedAt: number;
}

export class ModelManager {
	private static instance: ModelManager;
	private logger: Logger;
	private errorHandler: ErrorHandler;
	private config: ModelManagerConfig;
	private modelRegistry: Map<string, MLModelConfig>;
	private cachedModels: Map<string, ModelArtifact>;
	private loadingModels: Map<string, Promise<ModelArtifact>>;

	private constructor(config?: Partial<ModelManagerConfig>) {
		this.logger = Logger.getInstance("ModelManager");
		this.errorHandler = ErrorHandler.getInstance();
		this.config = {
			enableCache: true,
			maxCachedModels: 5,
			modelLoadTimeout: 50, // <50ms target for cached models
			enableVersioning: true,
			...config,
		};
		this.modelRegistry = new Map();
		this.cachedModels = new Map();
		this.loadingModels = new Map();

		this.logger.info("ModelManager initialized", {
			config: this.config,
		});
	}

	public static getInstance(config?: Partial<ModelManagerConfig>): ModelManager {
		if (!ModelManager.instance) {
			ModelManager.instance = new ModelManager(config);
		}
		return ModelManager.instance;
	}

	/**
	 * Register a new model in the registry
	 */
	public async registerModel(
		modelConfig: Omit<MLModelConfig, "createdAt" | "updatedAt">
	): Promise<MLServiceResponse<MLModelConfig>> {
		try {
			this.logger.info("Registering model", {
				modelId: modelConfig.modelId,
				version: modelConfig.version,
				modelType: modelConfig.modelType,
			});

			// Validate model configuration
			const validation = this.validateModelConfig(modelConfig);
			if (!validation.isValid) {
				return {
					success: false,
					error: {
						type: ErrorType.VALIDATION_ERROR,
						code: ErrorCode.INVALID_PARAMETERS,
						message: `Invalid model configuration: ${validation.errors.join(", ")}`,
						severity: "MEDIUM" as any,
						timestamp: Date.now(),
						source: "ModelManager",
						retryable: false,
					},
				};
			}

			const fullConfig: MLModelConfig = {
				...modelConfig,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			// Check if model already exists
			const existingModel = this.modelRegistry.get(modelConfig.modelId);
			if (existingModel && this.config.enableVersioning) {
				// Version conflict check
				if (existingModel.version === modelConfig.version) {
					this.logger.warn("Model version already exists", {
						modelId: modelConfig.modelId,
						version: modelConfig.version,
					});
				}
			}

			this.modelRegistry.set(modelConfig.modelId, fullConfig);

			this.logger.info("Model registered successfully", {
				modelId: modelConfig.modelId,
				version: modelConfig.version,
			});

			return {
				success: true,
				data: fullConfig,
				metadata: {
					latency: 0,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Model registration failed", { error, modelConfig });
			const errorResponse = this.errorHandler.createErrorResponse(error, "ModelManager");

			return {
				success: false,
				error: errorResponse.error,
			};
		}
	}

	/**
	 * Load a model from storage
	 * Target: <50ms for cached models
	 */
	public async loadModel(
		modelId: string,
		requestId?: string
	): Promise<MLServiceResponse<ModelArtifact>> {
		const startTime = Date.now();

		try {
			// Check cache first
			const cachedModel = this.cachedModels.get(modelId);
			if (cachedModel) {
				const latency = Date.now() - startTime;
				this.logger.debug("Model loaded from cache", {
					modelId,
					latency,
					requestId,
				});

				return {
					success: true,
					data: cachedModel,
					metadata: {
						latency,
						cacheHit: true,
					},
				};
			}

			// Check if model is currently loading
			const loadingPromise = this.loadingModels.get(modelId);
			if (loadingPromise) {
				const artifact = await loadingPromise;
				return {
					success: true,
					data: artifact,
					metadata: {
						latency: Date.now() - startTime,
						cacheHit: false,
					},
				};
			}

			// Get model configuration
			const modelConfig = this.modelRegistry.get(modelId);
			if (!modelConfig) {
				return {
					success: false,
					error: {
						type: ErrorType.VALIDATION_ERROR,
						code: ErrorCode.INVALID_PARAMETERS,
						message: `Model not found: ${modelId}`,
						severity: "MEDIUM" as any,
						timestamp: Date.now(),
						source: "ModelManager",
						retryable: false,
					},
				};
			}

			// Start loading
			const loadPromise = this.loadModelArtifact(modelId, modelConfig);
			this.loadingModels.set(modelId, loadPromise);

			const artifact = await loadPromise;

			// Remove from loading set
			this.loadingModels.delete(modelId);

			// Cache the model
			this.cacheModel(artifact);

			const latency = Date.now() - startTime;
			this.logger.logPerformance("Model load", latency, requestId, {
				modelId,
				modelType: modelConfig.modelType,
			});

			return {
				success: true,
				data: artifact,
				metadata: {
					latency,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Model loading failed", { modelId, error, requestId });
			this.loadingModels.delete(modelId);

			const errorResponse = this.errorHandler.createErrorResponse(
				error,
				"ModelManager",
				requestId
			);

			return {
				success: false,
				error: errorResponse.error,
			};
		}
	}

	/**
	 * Get model configuration
	 */
	public getModelConfig(modelId: string): MLModelConfig | undefined {
		return this.modelRegistry.get(modelId);
	}

	/**
	 * List all registered models
	 */
	public listModels(filter?: {
		status?: MLModelStatus;
		modelType?: MLModelType;
		horizon?: MLPredictionHorizon;
	}): MLModelConfig[] {
		let models = Array.from(this.modelRegistry.values());

		if (filter) {
			if (filter.status) {
				models = models.filter(m => m.status === filter.status);
			}
			if (filter.modelType) {
				models = models.filter(m => m.modelType === filter.modelType);
			}
			if (filter.horizon) {
				models = models.filter(m => m.horizon === filter.horizon);
			}
		}

		return models;
	}

	/**
	 * Update model status
	 */
	public async updateModelStatus(
		modelId: string,
		status: MLModelStatus
	): Promise<MLServiceResponse<MLModelConfig>> {
		try {
			const model = this.modelRegistry.get(modelId);
			if (!model) {
				return {
					success: false,
					error: {
						type: ErrorType.VALIDATION_ERROR,
						code: ErrorCode.INVALID_PARAMETERS,
						message: `Model not found: ${modelId}`,
						severity: "MEDIUM" as any,
						timestamp: Date.now(),
						source: "ModelManager",
						retryable: false,
					},
				};
			}

			model.status = status;
			model.updatedAt = Date.now();

			if (status === MLModelStatus.DEPRECATED || status === MLModelStatus.INACTIVE) {
				// Remove from cache
				this.cachedModels.delete(modelId);
			}

			this.logger.info("Model status updated", { modelId, status });

			return {
				success: true,
				data: model,
				metadata: {
					latency: 0,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Model status update failed", { modelId, status, error });
			const errorResponse = this.errorHandler.createErrorResponse(error, "ModelManager");

			return {
				success: false,
				error: errorResponse.error,
			};
		}
	}

	/**
	 * Update model performance metrics
	 */
	public async updateModelPerformance(
		modelId: string,
		metrics: MLModelPerformance
	): Promise<MLServiceResponse<MLModelConfig>> {
		try {
			const model = this.modelRegistry.get(modelId);
			if (!model) {
				return {
					success: false,
					error: {
						type: ErrorType.VALIDATION_ERROR,
						code: ErrorCode.INVALID_PARAMETERS,
						message: `Model not found: ${modelId}`,
						severity: "MEDIUM" as any,
						timestamp: Date.now(),
						source: "ModelManager",
						retryable: false,
					},
				};
			}

			model.performanceMetrics = metrics;
			model.updatedAt = Date.now();

			this.logger.info("Model performance updated", { modelId, metrics });

			return {
				success: true,
				data: model,
				metadata: {
					latency: 0,
					cacheHit: false,
				},
			};
		} catch (error) {
			this.logger.error("Model performance update failed", { modelId, error });
			const errorResponse = this.errorHandler.createErrorResponse(error, "ModelManager");

			return {
				success: false,
				error: errorResponse.error,
			};
		}
	}

	/**
	 * Get active models for a specific horizon
	 */
	public getActiveModelsForHorizon(horizon: MLPredictionHorizon): MLModelConfig[] {
		return this.listModels({
			status: MLModelStatus.ACTIVE,
			horizon,
		});
	}

	/**
	 * Get cache statistics
	 */
	public getCacheStats(): {
		cachedModels: number;
		maxCachedModels: number;
		totalModels: number;
		cacheHitRate: number;
	} {
		return {
			cachedModels: this.cachedModels.size,
			maxCachedModels: this.config.maxCachedModels,
			totalModels: this.modelRegistry.size,
			cacheHitRate: 0, // Will be calculated from actual usage
		};
	}

	/**
	 * Clear model cache
	 */
	public clearCache(): void {
		this.cachedModels.clear();
		this.logger.info("Model cache cleared");
	}

	// Private helper methods

	private validateModelConfig(config: any): {
		isValid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		if (!config.modelId) {
			errors.push("modelId is required");
		}
		if (!config.modelType) {
			errors.push("modelType is required");
		}
		if (!config.version) {
			errors.push("version is required");
		}
		if (!config.horizon) {
			errors.push("horizon is required");
		}
		if (!config.features || !Array.isArray(config.features)) {
			errors.push("features must be an array");
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	private async loadModelArtifact(
		modelId: string,
		config: MLModelConfig
	): Promise<ModelArtifact> {
		// TODO: Implement actual model loading from storage
		// For now, return placeholder artifact
		this.logger.info("Loading model artifact", { modelId, config });

		const artifact: ModelArtifact = {
			modelId,
			version: config.version,
			modelType: config.modelType,
			artifact: {}, // Placeholder for actual model
			metadata: {
				features: config.features,
				hyperparameters: config.hyperparameters,
			},
			size: 0,
			loadedAt: Date.now(),
		};

		return artifact;
	}

	private cacheModel(artifact: ModelArtifact): void {
		if (!this.config.enableCache) {
			return;
		}

		// Implement LRU eviction if cache is full
		if (this.cachedModels.size >= this.config.maxCachedModels) {
			this.evictLRUModel();
		}

		this.cachedModels.set(artifact.modelId, artifact);
		this.logger.debug("Model cached", {
			modelId: artifact.modelId,
			cacheSize: this.cachedModels.size,
		});
	}

	private evictLRUModel(): void {
		// Find least recently loaded model
		let oldestModelId: string | null = null;
		let oldestLoadedAt = Infinity;

		this.cachedModels.forEach((artifact, modelId) => {
			if (artifact.loadedAt < oldestLoadedAt) {
				oldestModelId = modelId;
				oldestLoadedAt = artifact.loadedAt;
			}
		});

		if (oldestModelId) {
			this.cachedModels.delete(oldestModelId);
			this.logger.debug("Evicted LRU model", { modelId: oldestModelId });
		}
	}

	/**
	 * Reset manager state (for testing/maintenance)
	 */
	public reset(): void {
		this.modelRegistry.clear();
		this.cachedModels.clear();
		this.loadingModels.clear();
		this.logger.info("ModelManager reset");
	}
}

export default ModelManager;
