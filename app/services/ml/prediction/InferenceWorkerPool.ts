/**
 * Inference Worker Pool for VFR Machine Learning Enhancement Layer
 *
 * Features:
 * - Worker pool for CPU-intensive inference operations
 * - Load balancing across workers
 * - Queue management with priority support
 * - Graceful worker failure handling
 * - Performance monitoring (throughput, latency)
 *
 * Philosophy: KISS principles - simple worker pool, efficient task distribution
 * Note: Uses Promise-based worker pattern (Node.js worker_threads not needed for Phase 3.3)
 */

import { Logger } from "../../error-handling/Logger";
import { MLModelType, MLFeatureVector } from "../types/MLTypes";
import { OptimizedFeatureVector } from "./InferenceOptimizer";

// ===== Worker Pool Configuration =====

export interface WorkerPoolConfig {
	maxWorkers: number; // Default: 4
	maxQueueSize: number; // Default: 100
	taskTimeoutMs: number; // Default: 5000ms
	enablePriority: boolean; // Default: true
	enableMetrics: boolean; // Default: true
}

// ===== Inference Task =====

export interface InferenceTask {
	taskId: string;
	modelId: string;
	modelType: MLModelType;
	featureVector: OptimizedFeatureVector;
	priority: "high" | "normal" | "low";
	timeoutMs?: number;
	callback: (result: InferenceResult) => void;
}

// ===== Inference Result =====

export interface InferenceResult {
	taskId: string;
	success: boolean;
	prediction?: {
		value: number;
		confidence: number;
		probability?: { up: number; down: number; neutral: number };
	};
	error?: string;
	latencyMs: number;
	workerId?: number;
}

// ===== Worker Status =====

interface WorkerStatus {
	workerId: number;
	busy: boolean;
	tasksCompleted: number;
	currentTask?: string;
	lastActiveTime: number;
}

// ===== Pool Statistics =====

export interface PoolStatistics {
	totalWorkers: number;
	activeWorkers: number;
	queuedTasks: number;
	completedTasks: number;
	failedTasks: number;
	avgLatencyMs: number;
	throughput: number; // tasks per second
}

/**
 * InferenceWorkerPool
 * Manages worker pool for parallel inference operations
 */
export class InferenceWorkerPool {
	private logger: Logger;
	private config: WorkerPoolConfig;
	private workers: WorkerStatus[];
	private taskQueue: InferenceTask[];
	private statistics: {
		completedTasks: number;
		failedTasks: number;
		totalLatency: number;
	};
	private initialized = false;

	constructor(config?: Partial<WorkerPoolConfig>) {
		this.logger = Logger.getInstance("InferenceWorkerPool");
		this.config = {
			maxWorkers: config?.maxWorkers ?? 4,
			maxQueueSize: config?.maxQueueSize ?? 100,
			taskTimeoutMs: config?.taskTimeoutMs ?? 5000,
			enablePriority: config?.enablePriority ?? true,
			enableMetrics: config?.enableMetrics ?? true,
		};
		this.workers = [];
		this.taskQueue = [];
		this.statistics = {
			completedTasks: 0,
			failedTasks: 0,
			totalLatency: 0,
		};
	}

	/**
	 * Initialize worker pool
	 */
	public async initialize(): Promise<void> {
		try {
			this.logger.info(`Initializing worker pool with ${this.config.maxWorkers} workers`);

			// Initialize worker status tracking
			for (let i = 0; i < this.config.maxWorkers; i++) {
				this.workers.push({
					workerId: i,
					busy: false,
					tasksCompleted: 0,
					lastActiveTime: Date.now(),
				});
			}

			this.initialized = true;
			this.logger.info("Worker pool initialized successfully");
		} catch (error) {
			this.logger.error(
				`Worker pool initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
			);
			throw error;
		}
	}

	/**
	 * Submit inference task to pool
	 */
	public async submitTask(task: InferenceTask): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		// Check queue capacity
		if (this.taskQueue.length >= this.config.maxQueueSize) {
			throw new Error(`Task queue full (max: ${this.config.maxQueueSize})`);
		}

		// Add to queue
		this.taskQueue.push(task);

		// Sort by priority if enabled
		if (this.config.enablePriority) {
			this.sortQueueByPriority();
		}

		// Process queue
		await this.processQueue();
	}

	/**
	 * Process task queue
	 */
	private async processQueue(): Promise<void> {
		// Find available worker
		const worker = this.workers.find(w => !w.busy);
		if (!worker) {
			// All workers busy, tasks will be processed when workers become available
			return;
		}

		// Get next task
		const task = this.taskQueue.shift();
		if (!task) {
			return;
		}

		// Assign task to worker
		await this.executeTask(worker, task);

		// Continue processing if more tasks and workers available
		if (this.taskQueue.length > 0) {
			await this.processQueue();
		}
	}

	/**
	 * Execute task on worker
	 */
	private async executeTask(worker: WorkerStatus, task: InferenceTask): Promise<void> {
		const startTime = Date.now();
		worker.busy = true;
		worker.currentTask = task.taskId;
		worker.lastActiveTime = Date.now();

		try {
			// Run inference (simulated for Phase 3.3 - actual model inference to be implemented)
			const prediction = await this.runInference(task);

			const latency = Date.now() - startTime;

			// Build result
			const result: InferenceResult = {
				taskId: task.taskId,
				success: true,
				prediction,
				latencyMs: latency,
				workerId: worker.workerId,
			};

			// Update statistics
			this.statistics.completedTasks++;
			this.statistics.totalLatency += latency;
			worker.tasksCompleted++;

			// Invoke callback
			task.callback(result);
		} catch (error) {
			const latency = Date.now() - startTime;
			this.statistics.failedTasks++;

			const result: InferenceResult = {
				taskId: task.taskId,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				latencyMs: latency,
				workerId: worker.workerId,
			};

			task.callback(result);
		} finally {
			// Mark worker as available
			worker.busy = false;
			worker.currentTask = undefined;
			worker.lastActiveTime = Date.now();

			// Continue processing queue
			await this.processQueue();
		}
	}

	/**
	 * Run inference (placeholder implementation)
	 * Actual model inference logic to be implemented with model artifacts
	 */
	private async runInference(task: InferenceTask): Promise<{
		value: number;
		confidence: number;
		probability?: { up: number; down: number; neutral: number };
	}> {
		// Simulate inference delay
		await this.sleep(10 + Math.random() * 20); // 10-30ms

		// Extract feature statistics
		const features = task.featureVector.values;
		const mean = this.calculateMean(features);
		const std = this.calculateStd(features, mean);

		// Simple prediction logic based on feature statistics
		const prediction = Math.tanh(mean / 100); // Normalize to [-1, 1]
		const confidence = Math.min(0.9, Math.max(0.5, 1 - std / 100));

		return {
			value: prediction,
			confidence,
			probability: {
				up: prediction > 0 ? 0.5 + prediction * 0.3 : 0.5 - Math.abs(prediction) * 0.3,
				down: prediction < 0 ? 0.5 + Math.abs(prediction) * 0.3 : 0.5 - prediction * 0.3,
				neutral: 1 - Math.abs(prediction) * 0.6,
			},
		};
	}

	/**
	 * Sort queue by priority
	 */
	private sortQueueByPriority(): void {
		const priorityOrder = { high: 0, normal: 1, low: 2 };
		this.taskQueue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
	}

	/**
	 * Calculate mean of Float32Array
	 */
	private calculateMean(values: Float32Array): number {
		let sum = 0;
		for (let i = 0; i < values.length; i++) {
			sum += values[i];
		}
		return sum / values.length;
	}

	/**
	 * Calculate standard deviation
	 */
	private calculateStd(values: Float32Array, mean: number): number {
		let squaredDiffSum = 0;
		for (let i = 0; i < values.length; i++) {
			const diff = values[i] - mean;
			squaredDiffSum += diff * diff;
		}
		return Math.sqrt(squaredDiffSum / values.length);
	}

	/**
	 * Sleep utility
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Get pool statistics
	 */
	public getStatistics(): PoolStatistics {
		const activeWorkers = this.workers.filter(w => w.busy).length;
		const completedTasks = this.statistics.completedTasks;
		const avgLatency = completedTasks > 0 ? this.statistics.totalLatency / completedTasks : 0;

		return {
			totalWorkers: this.workers.length,
			activeWorkers,
			queuedTasks: this.taskQueue.length,
			completedTasks,
			failedTasks: this.statistics.failedTasks,
			avgLatencyMs: avgLatency,
			throughput: avgLatency > 0 ? 1000 / avgLatency : 0,
		};
	}

	/**
	 * Get worker status
	 */
	public getWorkerStatus(): WorkerStatus[] {
		return [...this.workers];
	}

	/**
	 * Health check
	 */
	public healthCheck(): {
		healthy: boolean;
		initialized: boolean;
		statistics: PoolStatistics;
		issues: string[];
	} {
		const issues: string[] = [];

		if (!this.initialized) {
			issues.push("Worker pool not initialized");
		}

		const stats = this.getStatistics();

		if (stats.queuedTasks >= this.config.maxQueueSize * 0.9) {
			issues.push(`Queue nearly full: ${stats.queuedTasks}/${this.config.maxQueueSize}`);
		}

		const failureRate =
			stats.completedTasks > 0
				? stats.failedTasks / (stats.completedTasks + stats.failedTasks)
				: 0;

		if (failureRate > 0.1) {
			issues.push(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);
		}

		return {
			healthy: issues.length === 0,
			initialized: this.initialized,
			statistics: stats,
			issues,
		};
	}

	/**
	 * Shutdown worker pool
	 */
	public async shutdown(): Promise<void> {
		this.logger.info("Shutting down worker pool");

		// Wait for active tasks to complete (with timeout)
		const shutdownTimeout = 10000; // 10 seconds
		const startTime = Date.now();

		while (this.workers.some(w => w.busy) && Date.now() - startTime < shutdownTimeout) {
			await this.sleep(100);
		}

		// Clear queue
		this.taskQueue = [];

		// Reset workers
		this.workers = [];
		this.initialized = false;

		this.logger.info("Worker pool shutdown complete");
	}

	/**
	 * Clear task queue
	 */
	public clearQueue(): void {
		this.taskQueue = [];
	}

	/**
	 * Get queue size
	 */
	public getQueueSize(): number {
		return this.taskQueue.length;
	}
}
