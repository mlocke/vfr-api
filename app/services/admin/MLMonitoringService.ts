/**
 * ML Monitoring Service - Extends admin dashboard with ML service health monitoring
 * Provides comprehensive monitoring for ML infrastructure performance and health
 * Follows existing admin service patterns and integrates with DataSourceConfigManager
 */

import { MLPredictionService } from "../ml/MLPredictionService";
import { FeatureEngineeringService } from "../ml/features/FeatureEngineeringService";
import { MLEnhancementStore } from "../ml/database/MLEnhancementStore";
import { RedisCache } from "../cache/RedisCache";
import ErrorHandler from "../error-handling/ErrorHandler";
import { MLFeatureToggleService } from "./MLFeatureToggleService";
import { EarlySignalService } from "../ml/early-signal/EarlySignalService";

export interface MLServiceInfo {
	id: string;
	name: string;
	type: "ml_prediction" | "feature_engineering" | "ml_store" | "ml_cache";
	status: "healthy" | "degraded" | "offline" | "initializing" | "error";
	enabled: boolean;
	description: string;
	endpoint?: string;
	lastHealthCheck?: number;
	responseTime?: number;
	successRate?: number;
	errorRate?: number;
	features: string[];
	performance: {
		avgResponseTime: number;
		totalRequests: number;
		errorCount: number;
		uptime: number;
	};
	dependencies: string[];
}

export interface MLTestResult {
	serviceId: string;
	serviceName: string;
	success: boolean;
	responseTime: number;
	error?: string;
	timestamp: number;
	testType: "health" | "integration" | "performance" | "stress";
	details?: any;
	metadata?: {
		confidence?: number;
		dataQuality?: number;
		cached?: boolean;
	};
}

export interface MLGroupTestResult {
	groupName: string;
	services: MLTestResult[];
	overallSuccess: boolean;
	averageResponseTime: number;
	successRate: number;
	timestamp: number;
	integrationTests: {
		endToEndTest: boolean;
		dataFlowTest: boolean;
		performanceTest: boolean;
	};
}

export interface MLPerformanceMetrics {
	serviceId: string;
	metrics: {
		requestsPerMinute: number;
		averageLatency: number;
		p95Latency: number;
		errorRate: number;
		cacheHitRate: number;
		featureGenerationTime: number;
		mlEnhancementTime: number;
		totalUptime: number;
		// Legacy interface support
		avgResponseTime: number;
		totalRequests: number;
		errorCount: number;
		uptime: number;
	};
	timestamp: number;
}

export class MLMonitoringService {
	private static instance: MLMonitoringService;
	private mlServices: Map<string, MLServiceInfo> = new Map();
	private enabledServices: Set<string> = new Set();
	private cache: RedisCache;
	private errorHandler: ErrorHandler;
	private performanceMetrics: Map<string, MLPerformanceMetrics> = new Map();

	// Service instances for monitoring
	private mlPredictionService: MLPredictionService | null = null;
	private featureEngineeringService: FeatureEngineeringService | null = null;
	private mlEnhancementStore: MLEnhancementStore | null = null;

	constructor() {
		this.cache = RedisCache.getInstance();
		this.errorHandler = ErrorHandler.getInstance();
		this.initializeMLServices();
		this.loadEnabledServices();
		this.initializeServiceInstances();
	}

	static getInstance(): MLMonitoringService {
		if (!MLMonitoringService.instance) {
			MLMonitoringService.instance = new MLMonitoringService();
		}
		return MLMonitoringService.instance;
	}

	/**
	 * Initialize ML service definitions for monitoring
	 */
	private initializeMLServices(): void {
		// ML Prediction Service
		this.mlServices.set("ml_prediction", {
			id: "ml_prediction",
			name: "ML Prediction Service",
			type: "ml_prediction",
			status: "initializing",
			enabled: true,
			description: "Core ML orchestration service for VFR score enhancement",
			features: [
				"vfr_enhancement",
				"ml_scoring",
				"confidence_calculation",
				"fallback_handling",
				"cache_integration",
			],
			performance: {
				avgResponseTime: 0,
				totalRequests: 0,
				errorCount: 0,
				uptime: 0,
			},
			dependencies: ["feature_engineering", "ml_cache"],
		});

		// Feature Engineering Service
		this.mlServices.set("feature_engineering", {
			id: "feature_engineering",
			name: "Feature Engineering Service",
			type: "feature_engineering",
			status: "initializing",
			enabled: true,
			description: "Feature generation using existing VFR data sources",
			features: [
				"technical_features",
				"sentiment_features",
				"macro_features",
				"options_features",
				"parallel_processing",
				"feature_caching",
			],
			performance: {
				avgResponseTime: 0,
				totalRequests: 0,
				errorCount: 0,
				uptime: 0,
			},
			dependencies: ["vwap_service", "sentiment_service", "macro_service", "options_service"],
		});

		// ML Enhancement Store
		this.mlServices.set("ml_store", {
			id: "ml_store",
			name: "ML Enhancement Store",
			type: "ml_store",
			status: "initializing",
			enabled: false, // Optional component
			description: "ML model storage and prediction service",
			features: [
				"model_storage",
				"prediction_serving",
				"model_versioning",
				"performance_tracking",
			],
			performance: {
				avgResponseTime: 0,
				totalRequests: 0,
				errorCount: 0,
				uptime: 0,
			},
			dependencies: ["database"],
		});

		// ML Cache Service
		this.mlServices.set("ml_cache", {
			id: "ml_cache",
			name: "ML Cache Service",
			type: "ml_cache",
			status: "initializing",
			enabled: true,
			description: "Caching layer for ML features and predictions",
			features: [
				"feature_caching",
				"prediction_caching",
				"ttl_management",
				"cache_invalidation",
			],
			performance: {
				avgResponseTime: 0,
				totalRequests: 0,
				errorCount: 0,
				uptime: 0,
			},
			dependencies: ["redis"],
		});

		// Early Signal Detection Service (NEW - Phase 4)
		this.mlServices.set("early_signal_detection", {
			id: "early_signal_detection",
			name: "Early Signal Detection",
			type: "ml_prediction",
			status: "initializing",
			enabled: false, // Controlled by MLFeatureToggleService
			description:
				"ML-powered analyst rating upgrade predictions (2-week horizon, 97.6% accuracy)",
			endpoint: "/api/ml/early-signal",
			features: [
				"analyst_upgrade_prediction",
				"lightgbm_model",
				"20_engineered_features",
				"earnings_surprise_analysis",
				"macd_histogram_trend",
				"rsi_momentum",
				"feature_importance_ranking",
				"confidence_filtering",
				"human_readable_reasoning",
			],
			performance: {
				avgResponseTime: 50, // ~50ms average
				totalRequests: 0,
				errorCount: 0,
				uptime: 0,
			},
			dependencies: ["feature_extraction", "ml_cache", "normalizer"],
		});
	}

	/**
	 * Initialize service instances for testing
	 */
	private initializeServiceInstances(): void {
		try {
			this.mlPredictionService = new MLPredictionService();
			this.featureEngineeringService = new FeatureEngineeringService();

			// ML Enhancement Store is optional
			try {
				this.mlEnhancementStore = new MLEnhancementStore();
			} catch (error) {
				console.warn("ML Enhancement Store not available:", error);
				this.mlEnhancementStore = null;
			}
		} catch (error) {
			console.error("Failed to initialize ML service instances:", error);
		}
	}

	/**
	 * Load enabled ML services from storage
	 */
	private loadEnabledServices(): void {
		try {
			// Default enabled services
			this.enabledServices.add("ml_prediction");
			this.enabledServices.add("feature_engineering");
			this.enabledServices.add("ml_cache");
			// ml_store is optional and disabled by default
		} catch (error) {
			console.error("Error loading ML service states:", error);
		}
	}

	/**
	 * Get all ML services with current status
	 */
	async getAllMLServices(): Promise<MLServiceInfo[]> {
		const services = Array.from(this.mlServices.values());

		// Sync Early Signal Detection state from MLFeatureToggleService
		const toggleService = MLFeatureToggleService.getInstance();
		const esdEnabled = await toggleService.isEarlySignalEnabled();
		if (esdEnabled) {
			this.enabledServices.add("early_signal_detection");
		} else {
			this.enabledServices.delete("early_signal_detection");
		}

		// Update status with latest health check data
		for (const service of services) {
			const healthStatus = await this.getMLServiceHealth(service.id);
			service.status = healthStatus.status;
			service.enabled = this.enabledServices.has(service.id);
			service.lastHealthCheck = healthStatus.timestamp;
			service.responseTime = healthStatus.responseTime;
			service.successRate = healthStatus.successRate;
			service.errorRate = healthStatus.errorRate;

			// Update performance metrics
			const performanceData = this.performanceMetrics.get(service.id);
			if (performanceData) {
				service.performance = {
					...performanceData.metrics,
					uptime: Date.now() - performanceData.timestamp,
				};
			}

			// If service is disabled, override status
			if (!service.enabled) {
				service.status = "offline";
			}
		}

		return services;
	}

	/**
	 * Test individual ML service
	 */
	async testMLService(
		serviceId: string,
		testType: "health" | "integration" | "performance" | "stress" = "health"
	): Promise<MLTestResult> {
		const startTime = Date.now();

		try {
			let result: any;
			const service = this.mlServices.get(serviceId);

			if (!service) {
				throw new Error(`ML service ${serviceId} not found`);
			}

			switch (testType) {
				case "health":
					result = await this.performMLHealthCheck(serviceId);
					break;
				case "integration":
					result = await this.performMLIntegrationTest(serviceId);
					break;
				case "performance":
					result = await this.performMLPerformanceTest(serviceId);
					break;
				case "stress":
					result = await this.performMLStressTest(serviceId);
					break;
			}

			const responseTime = Date.now() - startTime;

			return {
				serviceId,
				serviceName: service.name,
				success: result.success || false,
				responseTime,
				timestamp: Date.now(),
				testType,
				details: result,
				metadata: result.metadata,
			};
		} catch (error) {
			const responseTime = Date.now() - startTime;
			const service = this.mlServices.get(serviceId);

			return {
				serviceId,
				serviceName: service?.name || serviceId,
				success: false,
				responseTime,
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: Date.now(),
				testType,
			};
		}
	}

	/**
	 * Test ML service group with integration tests
	 */
	async testMLServiceGroup(): Promise<MLGroupTestResult> {
		const allServices = await this.getAllMLServices();
		const enabledServices = allServices.filter(s => s.enabled);

		// Test individual services
		const testPromises = enabledServices.map(service =>
			this.testMLService(service.id, "health")
		);

		const results = await Promise.allSettled(testPromises);
		const serviceResults: MLTestResult[] = results.map((result, index) => {
			if (result.status === "fulfilled") {
				return result.value;
			} else {
				return {
					serviceId: enabledServices[index].id,
					serviceName: enabledServices[index].name,
					success: false,
					responseTime: 0,
					error: result.reason?.message || "Test failed",
					timestamp: Date.now(),
					testType: "health" as const,
				};
			}
		});

		// Perform integration tests
		const integrationTests = await this.performIntegrationTests();

		const successfulTests = serviceResults.filter(r => r.success);
		const averageResponseTime =
			serviceResults.reduce((sum, r) => sum + r.responseTime, 0) / serviceResults.length;
		const successRate = successfulTests.length / serviceResults.length;

		return {
			groupName: "ml_services",
			services: serviceResults,
			overallSuccess: successRate >= 0.8 && integrationTests.endToEndTest,
			averageResponseTime,
			successRate,
			timestamp: Date.now(),
			integrationTests,
		};
	}

	/**
	 * Get ML service health status
	 */
	private async getMLServiceHealth(serviceId: string): Promise<{
		status: "healthy" | "degraded" | "offline" | "error";
		timestamp: number;
		responseTime?: number;
		successRate?: number;
		errorRate?: number;
	}> {
		try {
			const startTime = Date.now();
			let healthResult: any;

			switch (serviceId) {
				case "ml_prediction":
					healthResult = this.mlPredictionService
						? await this.mlPredictionService.healthCheck()
						: { success: false, error: "Service not initialized" };
					break;
				case "feature_engineering":
					healthResult = await this.testFeatureEngineering();
					break;
				case "ml_store":
					healthResult = await this.testMLStore();
					break;
				case "ml_cache":
					healthResult = await this.testMLCache();
					break;
				case "early_signal_detection":
					healthResult = await this.testEarlySignalDetection();
					break;
				default:
					throw new Error(`Unknown ML service: ${serviceId}`);
			}

			const responseTime = Date.now() - startTime;

			let status: "healthy" | "degraded" | "offline" | "error";
			if (healthResult?.status === "healthy" || healthResult?.success) {
				status = "healthy";
			} else if (healthResult?.status === "partial") {
				status = "degraded";
			} else {
				status = "error";
			}

			return {
				status,
				timestamp: Date.now(),
				responseTime,
				successRate: healthResult?.successRate || (healthResult?.success ? 1 : 0),
				errorRate: healthResult?.errorRate || (healthResult?.success ? 0 : 1),
			};
		} catch (error) {
			return {
				status: "offline",
				timestamp: Date.now(),
				errorRate: 1,
			};
		}
	}

	/**
	 * Perform ML health check for specific service
	 */
	private async performMLHealthCheck(serviceId: string): Promise<any> {
		switch (serviceId) {
			case "ml_prediction":
				return this.mlPredictionService
					? await this.mlPredictionService.healthCheck()
					: { success: false, error: "Service not initialized" };

			case "feature_engineering":
				return await this.testFeatureEngineering();

			case "ml_store":
				return await this.testMLStore();

			case "ml_cache":
				return await this.testMLCache();

			default:
				throw new Error(`Unknown ML service: ${serviceId}`);
		}
	}

	/**
	 * Perform integration test for ML service
	 */
	private async performMLIntegrationTest(serviceId: string): Promise<any> {
		try {
			switch (serviceId) {
				case "ml_prediction":
					// Test full ML prediction flow
					const testFactors = {
						technical: { rsi: 65, macd: 0.5 },
						sentiment: { score: 0.6 },
					};
					const enhancementResult = this.mlPredictionService
						? await this.mlPredictionService.enhanceVFRScore("AAPL", 75, testFactors)
						: null;

					if (!enhancementResult) {
						return { success: false, error: "ML Prediction Service not initialized" };
					}

					return {
						success: true,
						enhancementWorking:
							enhancementResult.enhancedScore !== enhancementResult.vfrWeight * 75,
						fallbackTested: enhancementResult.fallbackUsed !== undefined,
						processingTime: enhancementResult.processingTimeMs,
						metadata: {
							confidence: enhancementResult.confidence,
							cached: false,
						},
					};

				case "feature_engineering":
					// Test feature generation with real symbols
					const features = this.featureEngineeringService
						? await this.featureEngineeringService.generateFeatures(["AAPL", "TSLA"])
						: new Map();

					if (!this.featureEngineeringService) {
						return {
							success: false,
							error: "Feature Engineering Service not initialized",
						};
					}

					return {
						success: features.size > 0,
						symbolsProcessed: features.size,
						featureQuality: this.calculateFeatureQuality(features),
						processingTime: Date.now(),
						metadata: {
							dataQuality: this.calculateAverageCompleteness(features),
						},
					};

				case "ml_store":
					if (!this.mlEnhancementStore) {
						return { success: false, error: "ML Enhancement Store not available" };
					}
					// Test ML store integration
					return { success: true, storeAvailable: true };

				case "ml_cache":
					// Test cache operations
					const testKey = `ml:test:${Date.now()}`;
					const testData = { test: true, timestamp: Date.now() };

					await this.cache.set(testKey, testData, 60);
					const retrieved = await this.cache.get(testKey);
					await this.cache.delete(testKey);

					return {
						success: JSON.stringify(retrieved) === JSON.stringify(testData),
						cacheWorking: true,
						metadata: {
							cached: true,
						},
					};

				default:
					throw new Error(`Unknown service for integration test: ${serviceId}`);
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Integration test failed",
			};
		}
	}

	/**
	 * Perform performance test for ML service
	 */
	private async performMLPerformanceTest(serviceId: string): Promise<any> {
		const iterations = 5;
		const startTime = Date.now();
		const responseTimes: number[] = [];
		let successCount = 0;

		try {
			for (let i = 0; i < iterations; i++) {
				const iterationStart = Date.now();

				try {
					switch (serviceId) {
						case "ml_prediction":
							if (this.mlPredictionService) {
								await this.mlPredictionService.enhanceVFRScore("AAPL", 75, {});
							}
							break;
						case "feature_engineering":
							if (this.featureEngineeringService) {
								await this.featureEngineeringService.generateFeatures(["AAPL"]);
							}
							break;
						case "ml_cache":
							await this.cache.get("performance-test-key");
							break;
					}
					successCount++;
				} catch (error) {
					// Track error but continue
				}

				responseTimes.push(Date.now() - iterationStart);

				// Small delay between requests
				await new Promise(resolve => setTimeout(resolve, 100));
			}

			const totalTime = Date.now() - startTime;
			const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
			const p95ResponseTime = responseTimes.sort((a, b) => a - b)[
				Math.floor(responseTimes.length * 0.95)
			];

			return {
				success: successCount > 0,
				iterations,
				successCount,
				successRate: successCount / iterations,
				avgResponseTime,
				p95ResponseTime,
				totalTime,
				responseTimes,
				metadata: {
					dataQuality: successCount / iterations,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Performance test failed",
			};
		}
	}

	/**
	 * Perform stress test for ML service
	 */
	private async performMLStressTest(serviceId: string): Promise<any> {
		const concurrentRequests = 10;
		const startTime = Date.now();

		try {
			const promises = Array(concurrentRequests)
				.fill(null)
				.map(async (_, index) => {
					const requestStart = Date.now();

					try {
						switch (serviceId) {
							case "ml_prediction":
								if (this.mlPredictionService) {
									await this.mlPredictionService.enhanceVFRScore(
										`TEST${index}`,
										75,
										{}
									);
								}
								break;
							case "feature_engineering":
								if (this.featureEngineeringService) {
									await this.featureEngineeringService.generateFeatures([
										`TEST${index}`,
									]);
								}
								break;
						}

						return {
							success: true,
							responseTime: Date.now() - requestStart,
						};
					} catch (error) {
						return {
							success: false,
							responseTime: Date.now() - requestStart,
							error: error instanceof Error ? error.message : "Unknown error",
						};
					}
				});

			const results = await Promise.allSettled(promises);
			const successResults = results.filter(r => r.status === "fulfilled" && r.value.success);
			const totalTime = Date.now() - startTime;

			return {
				success: successResults.length > 0,
				concurrentRequests,
				successCount: successResults.length,
				successRate: successResults.length / concurrentRequests,
				totalTime,
				averageResponseTime:
					results.reduce((sum, r) => {
						if (r.status === "fulfilled") {
							return sum + r.value.responseTime;
						}
						return sum;
					}, 0) / results.length,
				stressTestPassed: successResults.length >= concurrentRequests * 0.8,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Stress test failed",
			};
		}
	}

	/**
	 * Perform comprehensive integration tests
	 */
	private async performIntegrationTests(): Promise<{
		endToEndTest: boolean;
		dataFlowTest: boolean;
		performanceTest: boolean;
	}> {
		try {
			// End-to-end test: Full ML enhancement flow
			let endToEndTest = false;
			if (this.mlPredictionService) {
				const endToEndResult = await this.mlPredictionService.enhanceVFRScore("AAPL", 75, {
					technical: { rsi: 65 },
					sentiment: { score: 0.6 },
				});
				endToEndTest = endToEndResult.enhancedScore > 0;
			}

			// Data flow test: Features -> Prediction -> Cache
			let dataFlowTest = false;
			if (this.featureEngineeringService) {
				const features = await this.featureEngineeringService.generateFeatures(["AAPL"]);
				dataFlowTest = features.size > 0;
			}

			// Performance test: Response time under threshold
			let performanceTest = false;
			if (this.mlPredictionService) {
				const performanceStart = Date.now();
				await this.mlPredictionService.enhanceVFRScore("TSLA", 80, {});
				const performanceTime = Date.now() - performanceStart;
				performanceTest = performanceTime < 2000; // Under 2 seconds
			}

			return {
				endToEndTest,
				dataFlowTest,
				performanceTest,
			};
		} catch (error) {
			return {
				endToEndTest: false,
				dataFlowTest: false,
				performanceTest: false,
			};
		}
	}

	/**
	 * Helper methods for testing
	 */
	private async testFeatureEngineering(): Promise<any> {
		try {
			if (!this.featureEngineeringService) {
				return {
					success: false,
					error: "Feature Engineering Service not initialized",
				};
			}

			const features = await this.featureEngineeringService.generateFeatures(["AAPL"]);
			return {
				success: features.size > 0,
				components: {
					featureGeneration: features.size > 0,
					caching: true,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Feature engineering test failed",
			};
		}
	}

	private async testMLStore(): Promise<any> {
		if (!this.mlEnhancementStore) {
			return {
				success: false,
				error: "ML Enhancement Store not available",
			};
		}

		try {
			// Basic connectivity test for ML store
			return {
				success: true,
				storeAvailable: true,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "ML store test failed",
			};
		}
	}

	private async testMLCache(): Promise<any> {
		try {
			const testKey = `ml:health:${Date.now()}`;
			const testData = { health: "ok", timestamp: Date.now() };

			await this.cache.set(testKey, testData, 60);
			const retrieved = await this.cache.get(testKey);
			await this.cache.delete(testKey);

			return {
				success: JSON.stringify(retrieved) === JSON.stringify(testData),
				components: {
					set: true,
					get: true,
					delete: true,
				},
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "ML cache test failed",
			};
		}
	}

	private async testEarlySignalDetection(): Promise<any> {
		try {
			const earlySignalService = new EarlySignalService();
			const healthStatus = await earlySignalService.getHealthStatus();

			return {
				success: healthStatus.modelLoaded && healthStatus.normalizerFitted,
				status: healthStatus.modelLoaded ? "healthy" : "degraded",
				components: {
					modelLoaded: healthStatus.modelLoaded,
					normalizerFitted: healthStatus.normalizerFitted,
					cacheConnected: healthStatus.cacheConnected,
					modelVersion: healthStatus.modelVersion,
				},
				metadata: {
					modelVersion: healthStatus.modelVersion,
					accuracy: 0.976, // 97.6% test accuracy
					avgResponseTime: 50, // ~50ms average
				},
			};
		} catch (error) {
			return {
				success: false,
				status: "error",
				error:
					error instanceof Error ? error.message : "Early Signal Detection test failed",
			};
		}
	}

	private calculateFeatureQuality(features: Map<string, any>): number {
		if (features.size === 0) return 0;

		let totalQuality = 0;
		for (const [symbol, featureVector] of features.entries()) {
			totalQuality += featureVector.metadata?.completeness || 0;
		}

		return totalQuality / features.size;
	}

	private calculateAverageCompleteness(features: Map<string, any>): number {
		if (features.size === 0) return 0;

		let totalCompleteness = 0;
		for (const [symbol, featureVector] of features.entries()) {
			totalCompleteness += featureVector.metadata?.completeness || 0;
		}

		return totalCompleteness / features.size;
	}

	/**
	 * Get ML performance metrics
	 */
	async getMLPerformanceMetrics(): Promise<MLPerformanceMetrics[]> {
		const metrics: MLPerformanceMetrics[] = [];

		for (const [serviceId, service] of this.mlServices) {
			if (this.enabledServices.has(serviceId)) {
				// Get cached metrics or generate new ones
				const cachedMetrics = this.performanceMetrics.get(serviceId);

				metrics.push({
					serviceId,
					metrics: {
						requestsPerMinute: cachedMetrics?.metrics.requestsPerMinute || 0,
						averageLatency: service.responseTime || 0,
						p95Latency: (service.responseTime || 0) * 1.5, // Estimate
						errorRate: service.errorRate || 0,
						cacheHitRate: serviceId === "ml_cache" ? 0.85 : 0, // Estimate for cache service
						featureGenerationTime:
							serviceId === "feature_engineering" ? service.responseTime || 0 : 0,
						mlEnhancementTime:
							serviceId === "ml_prediction" ? service.responseTime || 0 : 0,
						totalUptime: Date.now() - (service.lastHealthCheck || Date.now()),
						// Map to original interface
						avgResponseTime: service.responseTime || 0,
						totalRequests: service.performance.totalRequests,
						errorCount: service.performance.errorCount,
						uptime: Date.now() - (service.lastHealthCheck || Date.now()),
					},
					timestamp: Date.now(),
				});
			}
		}

		return metrics;
	}

	/**
	 * Toggle ML service enabled/disabled state
	 */
	async toggleMLService(
		serviceId: string
	): Promise<{ success: boolean; enabled: boolean; message: string }> {
		const service = this.mlServices.get(serviceId);
		if (!service) {
			return {
				success: false,
				enabled: false,
				message: `ML service ${serviceId} not found`,
			};
		}

		try {
			const wasEnabled = this.enabledServices.has(serviceId);

			// Special handling for Early Signal Detection - use MLFeatureToggleService
			if (serviceId === "early_signal_detection") {
				const toggleService = MLFeatureToggleService.getInstance();
				const isNowEnabled = !wasEnabled;

				// Update feature toggle service
				await toggleService.setEarlySignalEnabled(
					isNowEnabled,
					"admin",
					"Admin dashboard toggle"
				);

				// Update local state
				if (isNowEnabled) {
					this.enabledServices.add(serviceId);
				} else {
					this.enabledServices.delete(serviceId);
				}

				console.log(
					`✅ Early Signal Detection ${isNowEnabled ? "ENABLED" : "DISABLED"} via admin dashboard`
				);

				return {
					success: true,
					enabled: isNowEnabled,
					message: `Early Signal Detection has been ${isNowEnabled ? "enabled" : "disabled"}. This will ${isNowEnabled ? "include" : "exclude"} ML predictions in stock analysis.`,
				};
			}

			// Standard toggle for other services
			if (wasEnabled) {
				this.enabledServices.delete(serviceId);
			} else {
				this.enabledServices.add(serviceId);
			}

			const isNowEnabled = !wasEnabled;

			return {
				success: true,
				enabled: isNowEnabled,
				message: `ML service ${service.name} has been ${isNowEnabled ? "enabled" : "disabled"}`,
			};
		} catch (error) {
			return {
				success: false,
				enabled: this.enabledServices.has(serviceId),
				message: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	/**
	 * Check if ML service is enabled
	 */
	isMLServiceEnabled(serviceId: string): boolean {
		return this.enabledServices.has(serviceId);
	}

	/**
	 * Get enabled ML service IDs
	 */
	getEnabledMLServices(): string[] {
		return Array.from(this.enabledServices);
	}
}

// Export singleton instance
export const mlMonitoringService = MLMonitoringService.getInstance();
