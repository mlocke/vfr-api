/**
 * Real-Time Progress Tracker for Stock Analysis
 * Tracks progress across multiple data fetching operations and broadcasts updates via SSE
 */

export interface ProgressUpdate {
	stage: string;
	message: string;
	progress: number; // 0-100
	timestamp: number;
	duration?: number; // Time spent on this stage (ms)
	metadata?: Record<string, any>;
}

export type ProgressCallback = (update: ProgressUpdate) => void;

export interface AnalysisStage {
	id: string;
	name: string;
	weight: number; // Percentage of total analysis time
	status: "pending" | "in_progress" | "completed" | "failed";
	startTime?: number;
	endTime?: number;
	message?: string;
}

export class ProgressTracker {
	private stages: Map<string, AnalysisStage> = new Map();
	private callbacks: Set<ProgressCallback> = new Set();
	private currentStage: string | null = null;
	private totalProgress: number = 0;
	private startTime: number;
	private parallelMode: boolean = false; // Track if we're running parallel operations
	private activeStages: Set<string> = new Set(); // Track multiple concurrent stages

	constructor() {
		this.startTime = Date.now();
		this.initializeStages();
	}

	/**
	 * Enable parallel mode - allows multiple stages to run concurrently
	 */
	enableParallelMode() {
		this.parallelMode = true;
	}

	/**
	 * Disable parallel mode - reverts to sequential stage tracking
	 */
	disableParallelMode() {
		this.parallelMode = false;
		this.activeStages.clear();
	}

	/**
	 * Initialize analysis stages with realistic time weights based on actual performance
	 */
	private initializeStages() {
		const stages: AnalysisStage[] = [
			{ id: "init", name: "Initializing analysis", weight: 2, status: "pending" },
			{ id: "market_data", name: "Fetching market data", weight: 5, status: "pending" },
			{
				id: "technical",
				name: "Analyzing technical indicators",
				weight: 8,
				status: "pending",
			},
			{ id: "fundamentals", name: "Gathering fundamental data", weight: 10, status: "pending" },
			{ id: "analyst", name: "Collecting analyst ratings", weight: 5, status: "pending" },
			{ id: "sentiment", name: "Analyzing market sentiment", weight: 12, status: "pending" },
			{ id: "vwap", name: "Calculating VWAP analysis", weight: 5, status: "pending" },
			{ id: "macro", name: "Evaluating macroeconomic factors", weight: 8, status: "pending" },
			{ id: "esg", name: "Assessing ESG metrics", weight: 7, status: "pending" },
			{
				id: "short_interest",
				name: "Checking short interest data",
				weight: 5,
				status: "pending",
			},
			{ id: "extended_hours", name: "Getting extended hours data", weight: 5, status: "pending" },
			{ id: "options", name: "Analyzing options data", weight: 20, status: "pending" }, // Longest operation
			{ id: "smart_money_flow", name: "Analyzing institutional activity", weight: 8, status: "pending" },
			{ id: "volatility_prediction", name: "Predicting volatility", weight: 4, status: "pending" },
			{ id: "ml_prediction", name: "Running ML predictions", weight: 5, status: "pending" },
			{ id: "composite", name: "Calculating composite scores", weight: 3, status: "pending" },
		];

		stages.forEach(stage => this.stages.set(stage.id, stage));
	}

	/**
	 * Register a callback for progress updates
	 */
	onProgress(callback: ProgressCallback): () => void {
		this.callbacks.add(callback);
		return () => this.callbacks.delete(callback);
	}

	/**
	 * Start a specific analysis stage
	 */
	startStage(stageId: string, customMessage?: string) {
		const stage = this.stages.get(stageId);
		if (!stage) {
			console.warn(`Unknown stage: ${stageId}`);
			return;
		}

		// In sequential mode, complete previous stage if exists
		// In parallel mode, allow multiple stages to run concurrently
		if (!this.parallelMode && this.currentStage) {
			this.completeStage(this.currentStage);
		}

		stage.status = "in_progress";
		stage.startTime = Date.now();
		stage.message = customMessage;

		if (this.parallelMode) {
			this.activeStages.add(stageId);
		} else {
			this.currentStage = stageId;
		}

		this.broadcastUpdate({
			stage: stageId,
			message: customMessage || stage.name,
			progress: this.calculateProgress(),
			timestamp: Date.now(),
		});
	}

	/**
	 * Complete a specific stage
	 */
	completeStage(stageId: string, customMessage?: string) {
		const stage = this.stages.get(stageId);
		if (!stage) return;

		stage.status = "completed";
		stage.endTime = Date.now();
		const duration = stage.startTime ? stage.endTime - stage.startTime : 0;

		this.broadcastUpdate({
			stage: stageId,
			message: customMessage || `${stage.name} completed`,
			progress: this.calculateProgress(),
			timestamp: Date.now(),
			duration,
		});

		// Clear from tracking
		if (this.parallelMode) {
			this.activeStages.delete(stageId);
		} else if (this.currentStage === stageId) {
			this.currentStage = null;
		}
	}

	/**
	 * Mark stage as failed
	 */
	failStage(stageId: string, error: string) {
		const stage = this.stages.get(stageId);
		if (!stage) return;

		stage.status = "failed";
		stage.endTime = Date.now();

		this.broadcastUpdate({
			stage: stageId,
			message: `${stage.name} failed: ${error}`,
			progress: this.calculateProgress(),
			timestamp: Date.now(),
			metadata: { error },
		});
	}

	/**
	 * Update current stage with progress message
	 */
	updateStage(stageId: string, message: string, metadata?: Record<string, any>) {
		const stage = this.stages.get(stageId);
		if (!stage || stage.status !== "in_progress") return;

		this.broadcastUpdate({
			stage: stageId,
			message,
			progress: this.calculateProgress(),
			timestamp: Date.now(),
			metadata,
		});
	}

	/**
	 * Calculate overall progress percentage based on completed stages
	 */
	private calculateProgress(): number {
		let completedWeight = 0;
		let inProgressWeight = 0;
		let totalWeight = 0;

		this.stages.forEach(stage => {
			totalWeight += stage.weight;
			if (stage.status === "completed") {
				completedWeight += stage.weight;
			} else if (stage.status === "in_progress") {
				// Count in-progress as 50% complete
				inProgressWeight += stage.weight * 0.5;
			}
		});

		const progress = ((completedWeight + inProgressWeight) / totalWeight) * 100;
		this.totalProgress = Math.min(99, Math.round(progress)); // Cap at 99% until fully done
		return this.totalProgress;
	}

	/**
	 * Mark analysis as complete
	 */
	complete() {
		this.totalProgress = 100;
		this.broadcastUpdate({
			stage: "complete",
			message: "Analysis complete",
			progress: 100,
			timestamp: Date.now(),
			duration: Date.now() - this.startTime,
		});
	}

	/**
	 * Broadcast update to all registered callbacks
	 */
	private broadcastUpdate(update: ProgressUpdate) {
		this.callbacks.forEach(callback => {
			try {
				callback(update);
			} catch (error) {
				console.error("Error in progress callback:", error);
			}
		});
	}

	/**
	 * Get current progress state
	 */
	getState() {
		return {
			progress: this.totalProgress,
			currentStage: this.currentStage,
			stages: Array.from(this.stages.values()),
			elapsedTime: Date.now() - this.startTime,
		};
	}

	/**
	 * Get estimated time remaining (ms)
	 */
	getEstimatedTimeRemaining(): number {
		const elapsed = Date.now() - this.startTime;
		if (this.totalProgress === 0) return 60000; // Default 60s estimate

		const estimatedTotal = (elapsed / this.totalProgress) * 100;
		return Math.max(0, estimatedTotal - elapsed);
	}
}
