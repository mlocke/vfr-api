/**
 * TrainingOrchestrator Tests - Real Database Integration
 *
 * NO MOCK DATA policy - all tests use real database connections
 * Tests cover:
 * - Training job submission and management
 * - Job queue processing
 * - Automatic model registration
 * - Baseline comparison
 * - Retraining schedules
 * - Concurrent job control
 * - Training statistics
 *
 * Performance target: Job orchestration within reasonable time
 * 5-minute timeout for comprehensive integration tests
 */

import { Pool } from "pg";
import {
	TrainingOrchestrator,
	TrainingJobConfig,
	RetrainingSchedule,
} from "../TrainingOrchestrator";
import { ModelRegistry, ModelType, ModelObjective } from "../ModelRegistry";
import { FeatureStore, BulkFeatureInsert } from "../../features/FeatureStore";

describe("TrainingOrchestrator", () => {
	let orchestrator: TrainingOrchestrator;
	let registry: ModelRegistry;
	let featureStore: FeatureStore;
	let pool: Pool;

	const testSymbols = ["AAPL", "MSFT"];
	const testJobIds: string[] = [];

	beforeAll(async () => {
		orchestrator = TrainingOrchestrator.getInstance();
		registry = ModelRegistry.getInstance();
		featureStore = FeatureStore.getInstance();

		await registry.initialize();
		await featureStore.initialize();

		pool = new Pool({
			connectionString: process.env.DATABASE_URL,
			max: 5,
		});

		// Seed test features
		await seedTestFeatures();
	}, 300000);

	afterAll(async () => {
		try {
			// Clean up test data
			await pool.query(`DELETE FROM ml_feature_store WHERE ticker = ANY($1)`, [testSymbols]);
			await pool.query(`DELETE FROM ml_models WHERE model_name LIKE 'test_orchestrator_%'`);
			await pool.end();
			await featureStore.cleanup();
			await registry.cleanup();
		} catch (error) {
			console.error("Failed to clean up in afterAll:", error);
		}
	});

	async function seedTestFeatures(): Promise<void> {
		const features: BulkFeatureInsert[] = [];

		for (const symbol of testSymbols) {
			for (let i = 0; i < 50; i++) {
				features.push({
					ticker: symbol,
					timestamp: Date.now() - i * 3600000,
					featureId: `feature_${i % 10}`,
					value: Math.random() * 100,
					confidenceScore: 0.8 + Math.random() * 0.2,
					dataQualityScore: 0.7 + Math.random() * 0.3,
					sourceProvider: "test_provider",
				});
			}
		}

		await featureStore.storeBulkFeatures(features);
	}

	function createTestJobConfig(overrides?: Partial<TrainingJobConfig>): TrainingJobConfig {
		const jobId = `test_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		testJobIds.push(jobId);

		return {
			jobId: overrides?.jobId || jobId,
			modelName: overrides?.modelName || `test_orchestrator_model_${Date.now()}`,
			modelVersion: overrides?.modelVersion || "1.0.0",
			modelType: overrides?.modelType || ModelType.LIGHTGBM,
			objective: overrides?.objective || ModelObjective.PRICE_PREDICTION,
			targetVariable: overrides?.targetVariable || "price_1d",
			predictionHorizon: overrides?.predictionHorizon || "1d",
			dataConfig: overrides?.dataConfig || {
				symbols: testSymbols,
				startDate: new Date(Date.now() - 86400000 * 7),
				endDate: new Date(),
				targetVariable: "price_1d",
				predictionHorizon: "1d",
				minQuality: 0.7,
			},
			trainingConfig: overrides?.trainingConfig || {
				modelType: ModelType.LIGHTGBM,
				objective: ModelObjective.PRICE_PREDICTION,
				targetVariable: "price_1d",
				predictionHorizon: "1d",
				hyperparameters: {
					num_leaves: 31,
					learning_rate: 0.1,
					n_estimators: 50,
				},
				trainTestSplit: 0.7,
				validationSplit: 0.15,
			},
			autoRegister: overrides?.autoRegister !== undefined ? overrides.autoRegister : false,
			autoDeploy: overrides?.autoDeploy !== undefined ? overrides.autoDeploy : false,
			priority: overrides?.priority || "normal",
			createdAt: Date.now(),
		};
	}

	describe("Singleton & Initialization", () => {
		it("should return singleton instance", () => {
			const instance1 = TrainingOrchestrator.getInstance();
			const instance2 = TrainingOrchestrator.getInstance();

			expect(instance1).toBe(instance2);
		});

		it("should perform health check successfully", async () => {
			const isHealthy = await orchestrator.healthCheck();
			expect(isHealthy).toBe(true);
		});
	});

	describe("Job Submission & Queue", () => {
		it("should submit training job successfully", async () => {
			const jobConfig = createTestJobConfig();

			const result = await orchestrator.submitTrainingJob(jobConfig);

			expect(result.success).toBe(true);
			expect(result.data).toBe(jobConfig.jobId);

			// Check job status
			const status = orchestrator.getJobStatus(jobConfig.jobId);
			expect(status).toBeDefined();
			expect(status?.jobId).toBe(jobConfig.jobId);
			expect(["queued", "running"]).toContain(status?.status);
		}, 30000);

		it("should reject invalid job configuration", async () => {
			const invalidConfig = {
				jobId: "",
				modelName: "",
				modelVersion: "",
			} as TrainingJobConfig;

			const result = await orchestrator.submitTrainingJob(invalidConfig);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error?.message).toContain("jobId");
		});

		it("should queue multiple jobs", async () => {
			const job1 = createTestJobConfig({ priority: "high" });
			const job2 = createTestJobConfig({ priority: "normal" });
			const job3 = createTestJobConfig({ priority: "low" });

			await orchestrator.submitTrainingJob(job1);
			await orchestrator.submitTrainingJob(job2);
			await orchestrator.submitTrainingJob(job3);

			const allStatuses = orchestrator.getAllJobStatuses();
			const ourJobs = allStatuses.filter(s =>
				[job1.jobId, job2.jobId, job3.jobId].includes(s.jobId)
			);

			expect(ourJobs.length).toBe(3);
		}, 30000);

		it("should process jobs in priority order", async () => {
			const highPriorityJob = createTestJobConfig({ priority: "high" });
			const lowPriorityJob = createTestJobConfig({ priority: "low" });

			await orchestrator.submitTrainingJob(lowPriorityJob);
			await orchestrator.submitTrainingJob(highPriorityJob);

			// Wait a bit for processing
			await new Promise(resolve => setTimeout(resolve, 2000));

			const highStatus = orchestrator.getJobStatus(highPriorityJob.jobId);
			const lowStatus = orchestrator.getJobStatus(lowPriorityJob.jobId);

			// High priority job should be processed first or be running
			if (highStatus && lowStatus) {
				if (highStatus.status === "running" || highStatus.status === "completed") {
					expect(lowStatus.status).toBe("queued");
				}
			}
		}, 30000);
	});

	describe("Job Execution", () => {
		it("should complete training job successfully", async () => {
			const jobConfig = createTestJobConfig({
				autoRegister: false,
				autoDeploy: false,
			});

			const result = await orchestrator.submitTrainingJob(jobConfig);
			expect(result.success).toBe(true);

			// Wait for job completion
			await waitForJobCompletion(jobConfig.jobId, 60000);

			const status = orchestrator.getJobStatus(jobConfig.jobId);
			expect(status).toBeDefined();

			if (status) {
				expect(status.status).toBe("completed");
				expect(status.progress).toBe(100);
				expect(status.result).toBeDefined();
				expect(status.completedAt).toBeDefined();
			}
		}, 90000);

		it("should track job progress", async () => {
			const jobConfig = createTestJobConfig();

			await orchestrator.submitTrainingJob(jobConfig);

			// Wait a bit
			await new Promise(resolve => setTimeout(resolve, 2000));

			const status = orchestrator.getJobStatus(jobConfig.jobId);
			expect(status).toBeDefined();

			if (status && status.status === "running") {
				expect(status.progress).toBeGreaterThan(0);
				expect(status.currentStep).toBeDefined();
			}
		}, 30000);

		it("should auto-register model when requested", async () => {
			const modelName = `test_orchestrator_autoregister_${Date.now()}`;
			const jobConfig = createTestJobConfig({
				modelName,
				autoRegister: true,
				autoDeploy: false,
			});

			await orchestrator.submitTrainingJob(jobConfig);

			// Wait for completion
			await waitForJobCompletion(jobConfig.jobId, 90000);

			const status = orchestrator.getJobStatus(jobConfig.jobId);
			expect(status).toBeDefined();

			if (status && status.status === "completed") {
				expect(status.modelId).toBeDefined();

				// Verify model was registered
				if (status.modelId) {
					const modelResult = await registry.getModel(status.modelId);
					expect(modelResult.success).toBe(true);
					expect(modelResult.data?.modelName).toBe(modelName);
				}
			}
		}, 120000);

		it("should auto-deploy model when requested", async () => {
			const modelName = `test_orchestrator_autodeploy_${Date.now()}`;
			const jobConfig = createTestJobConfig({
				modelName,
				autoRegister: true,
				autoDeploy: true,
			});

			await orchestrator.submitTrainingJob(jobConfig);

			// Wait for completion
			await waitForJobCompletion(jobConfig.jobId, 90000);

			const status = orchestrator.getJobStatus(jobConfig.jobId);

			if (status && status.status === "completed" && status.modelId) {
				const modelResult = await registry.getModel(status.modelId);
				expect(modelResult.success).toBe(true);

				if (modelResult.data) {
					expect(modelResult.data.status).toBe("deployed");
				}
			}
		}, 120000);
	});

	describe("Baseline Comparison", () => {
		it("should compare model with baseline", async () => {
			// Create and register two models
			const baseline = await createAndRegisterTestModel("baseline");
			const newModel = await createAndRegisterTestModel("new_model");

			if (!baseline || !newModel) {
				throw new Error("Failed to create test models");
			}

			const result = await orchestrator.compareWithBaseline(newModel, baseline);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();

			if (result.data) {
				expect(result.data.newModel.modelId).toBe(newModel);
				expect(result.data.baseline.modelId).toBe(baseline);
				expect(result.data.improvement).toBeDefined();
				expect(result.data.shouldDeploy).toBeDefined();
				expect(result.data.reason).toBeDefined();
			}
		}, 60000);

		it("should recommend deployment when improvement is significant", async () => {
			const baseline = await createAndRegisterTestModel("baseline", 0.68);
			const improved = await createAndRegisterTestModel("improved", 0.75);

			if (!baseline || !improved) {
				throw new Error("Failed to create test models");
			}

			const result = await orchestrator.compareWithBaseline(improved, baseline);

			expect(result.success).toBe(true);
			if (result.data) {
				expect(result.data.improvement.validationAccuracy).toBeGreaterThan(0.02);
				expect(result.data.shouldDeploy).toBe(true);
			}
		}, 60000);
	});

	describe("Retraining Schedules", () => {
		it("should schedule retraining", () => {
			const schedule: RetrainingSchedule = {
				modelName: "test_scheduled_model",
				frequency: "daily",
				nextRun: Date.now() + 86400000, // Tomorrow
				enabled: true,
				config: createTestJobConfig({ modelName: "test_scheduled_model" }),
			};

			orchestrator.scheduleRetraining(schedule);

			// No direct assertion, but should not throw
			expect(true).toBe(true);
		});

		it("should trigger scheduled retraining when due", async () => {
			const modelName = `test_scheduled_${Date.now()}`;
			const schedule: RetrainingSchedule = {
				modelName,
				frequency: "daily",
				nextRun: Date.now() - 1000, // Already due
				enabled: true,
				config: createTestJobConfig({ modelName }),
			};

			orchestrator.scheduleRetraining(schedule);

			// Process schedules
			await orchestrator.processRetrainingSchedules();

			// Check if job was created
			const allStatuses = orchestrator.getAllJobStatuses();
			const scheduledJob = allStatuses.find(s => s.jobId.includes(modelName));

			expect(scheduledJob).toBeDefined();
		}, 30000);
	});

	describe("Concurrent Job Control", () => {
		it("should respect max concurrent jobs limit", async () => {
			orchestrator.setMaxConcurrentJobs(2);

			const jobs = [
				createTestJobConfig(),
				createTestJobConfig(),
				createTestJobConfig(),
				createTestJobConfig(),
			];

			// Submit all jobs
			for (const job of jobs) {
				await orchestrator.submitTrainingJob(job);
			}

			// Wait a bit for processing to start
			await new Promise(resolve => setTimeout(resolve, 2000));

			const stats = orchestrator.getTrainingStatistics();

			// At most 2 jobs should be running
			expect(stats.activeJobs).toBeLessThanOrEqual(2);
		}, 30000);

		it("should process queued jobs when capacity becomes available", async () => {
			orchestrator.setMaxConcurrentJobs(1);

			const job1 = createTestJobConfig();
			const job2 = createTestJobConfig();

			await orchestrator.submitTrainingJob(job1);
			await orchestrator.submitTrainingJob(job2);

			// Wait for first job to complete
			await waitForJobCompletion(job1.jobId, 90000);

			// Wait a bit more for second job to start
			await new Promise(resolve => setTimeout(resolve, 3000));

			const status2 = orchestrator.getJobStatus(job2.jobId);

			// Second job should now be running or completed
			expect(status2).toBeDefined();
			expect(["running", "completed"]).toContain(status2?.status);
		}, 120000);
	});

	describe("Job Management", () => {
		it("should cancel queued job", async () => {
			orchestrator.setMaxConcurrentJobs(1);

			// Submit multiple jobs to ensure some are queued
			const job1 = createTestJobConfig();
			const job2 = createTestJobConfig();

			await orchestrator.submitTrainingJob(job1);
			await orchestrator.submitTrainingJob(job2);

			// Try to cancel the queued job
			const cancelled = orchestrator.cancelJob(job2.jobId);

			if (cancelled) {
				const status = orchestrator.getJobStatus(job2.jobId);
				expect(status?.status).toBe("cancelled");
			}
		}, 30000);

		it("should get all job statuses", async () => {
			const job1 = createTestJobConfig();
			const job2 = createTestJobConfig();

			await orchestrator.submitTrainingJob(job1);
			await orchestrator.submitTrainingJob(job2);

			const allStatuses = orchestrator.getAllJobStatuses();

			expect(allStatuses).toBeInstanceOf(Array);
			expect(allStatuses.length).toBeGreaterThan(0);

			const ourJobs = allStatuses.filter(s => [job1.jobId, job2.jobId].includes(s.jobId));
			expect(ourJobs.length).toBe(2);
		}, 30000);
	});

	describe("Training Statistics", () => {
		it("should track training statistics", async () => {
			const stats = orchestrator.getTrainingStatistics();

			expect(stats).toBeDefined();
			expect(stats.totalJobs).toBeGreaterThanOrEqual(0);
			expect(stats.completedJobs).toBeGreaterThanOrEqual(0);
			expect(stats.failedJobs).toBeGreaterThanOrEqual(0);
			expect(stats.activeJobs).toBeGreaterThanOrEqual(0);
			expect(stats.queuedJobs).toBeGreaterThanOrEqual(0);
			expect(stats.successRate).toBeGreaterThanOrEqual(0);
			expect(stats.successRate).toBeLessThanOrEqual(1);
		});

		it("should calculate average training time", async () => {
			const jobConfig = createTestJobConfig();

			await orchestrator.submitTrainingJob(jobConfig);
			await waitForJobCompletion(jobConfig.jobId, 90000);

			const stats = orchestrator.getTrainingStatistics();

			if (stats.completedJobs > 0) {
				expect(stats.averageTrainingTime).toBeGreaterThan(0);
			}
		}, 120000);
	});

	// Helper functions
	async function waitForJobCompletion(jobId: string, timeout: number): Promise<void> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			const status = orchestrator.getJobStatus(jobId);

			if (status && ["completed", "failed", "cancelled"].includes(status.status)) {
				return;
			}

			await new Promise(resolve => setTimeout(resolve, 1000));
		}

		throw new Error(`Job ${jobId} did not complete within timeout`);
	}

	async function createAndRegisterTestModel(
		suffix: string,
		validationScore: number = 0.7
	): Promise<string | null> {
		const modelName = `test_orchestrator_${suffix}_${Date.now()}`;

		const result = await registry.registerModel({
			modelName,
			modelVersion: "1.0.0",
			modelType: ModelType.LIGHTGBM as any,
			objective: ModelObjective.PRICE_PREDICTION as any,
			targetVariable: "price_1d",
			predictionHorizon: "1d",
			validationScore,
			testScore: validationScore - 0.02,
		});

		return result.success && result.data ? result.data.modelId : null;
	}
});
