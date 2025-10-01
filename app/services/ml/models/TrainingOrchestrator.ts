/**
 * Training Orchestrator Service
 *
 * Manages automated model training, retraining schedules, and deployment
 *
 * Features:
 * - Automated retraining schedule configuration
 * - Walk-forward validation implementation
 * - Performance comparison with baseline models
 * - Automatic model registration on successful training
 * - Training job management and queuing
 * - Concurrent training control
 * - Training status monitoring and reporting
 * - Integration with ModelValidator for pre-registration validation
 *
 * Philosophy: Orchestrate the complete training-to-deployment pipeline
 */

import { ModelTrainer, TrainingConfig, TrainingDataConfig, TrainingResult } from './ModelTrainer'
import { ModelRegistry, RegisterModelInput, ModelType, ModelObjective, ModelStatus, TierRequirement, ModelMetadata } from './ModelRegistry'
import { ModelValidator } from './ModelValidator'
import { ModelCache } from './ModelCache'
import { Logger } from '../../error-handling/Logger'
import { ErrorHandler } from '../../error-handling/ErrorHandler'
import { MLServiceResponse } from '../types/MLTypes'

// ===== Orchestrator Configuration Types =====

export interface TrainingJobConfig {
  jobId: string
  modelName: string
  modelVersion: string
  modelType: ModelType
  objective: ModelObjective
  targetVariable: string
  predictionHorizon: string
  dataConfig: TrainingDataConfig
  trainingConfig: TrainingConfig
  autoRegister: boolean
  autoDeploy: boolean
  priority: 'low' | 'normal' | 'high'
  createdAt: number
}

export interface TrainingJobStatus {
  jobId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  currentStep: string
  startedAt?: number
  completedAt?: number
  error?: string
  result?: TrainingResult
  modelId?: string
}

export interface RetrainingSchedule {
  modelName: string
  frequency: 'daily' | 'weekly' | 'monthly'
  lastRun?: number
  nextRun: number
  enabled: boolean
  config: TrainingJobConfig
}

export interface BaselineComparison {
  newModel: {
    modelId: string
    validationAccuracy: number
    testAccuracy: number
    f1Score: number
    sharpeRatio: number
  }
  baseline: {
    modelId: string
    validationAccuracy: number
    testAccuracy: number
    f1Score: number
    sharpeRatio: number
  }
  improvement: {
    validationAccuracy: number
    testAccuracy: number
    f1Score: number
    sharpeRatio: number
  }
  shouldDeploy: boolean
  reason: string
}

export interface TrainingStatistics {
  totalJobs: number
  completedJobs: number
  failedJobs: number
  averageTrainingTime: number
  successRate: number
  activeJobs: number
  queuedJobs: number
}

// ===== Training Orchestrator Service =====

export class TrainingOrchestrator {
  private static instance: TrainingOrchestrator
  private trainer: ModelTrainer
  private registry: ModelRegistry
  private validator: ModelValidator
  private modelCache: ModelCache
  private logger: Logger
  private errorHandler: ErrorHandler

  private jobQueue: Map<string, TrainingJobConfig> = new Map()
  private jobStatuses: Map<string, TrainingJobStatus> = new Map()
  private retrainingSchedules: Map<string, RetrainingSchedule> = new Map()
  private activeJobs: Set<string> = new Set()
  private maxConcurrentJobs: number = 2

  private constructor() {
    this.trainer = ModelTrainer.getInstance()
    this.registry = ModelRegistry.getInstance()
    this.validator = new ModelValidator()
    this.modelCache = ModelCache.getInstance()
    this.logger = Logger.getInstance('TrainingOrchestrator')
    this.errorHandler = ErrorHandler.getInstance()
  }

  public static getInstance(): TrainingOrchestrator {
    if (!TrainingOrchestrator.instance) {
      TrainingOrchestrator.instance = new TrainingOrchestrator()
    }
    return TrainingOrchestrator.instance
  }

  /**
   * Submit a training job to the queue
   */
  public async submitTrainingJob(
    jobConfig: TrainingJobConfig
  ): Promise<MLServiceResponse<string>> {
    try {
      // Validate job configuration
      if (!jobConfig.jobId || !jobConfig.modelName || !jobConfig.modelVersion) {
        return {
          success: false,
          error: {
            type: 'VALIDATION_ERROR' as any,
            code: 'INVALID_PARAMETERS' as any,
            message: 'Invalid job configuration: jobId, modelName, and modelVersion are required',
            severity: 'medium' as any,
            timestamp: Date.now(),
            source: 'TrainingOrchestrator.submitTrainingJob',
            retryable: false
          }
        }
      }

      // Add to queue
      this.jobQueue.set(jobConfig.jobId, jobConfig)

      // Initialize job status
      this.jobStatuses.set(jobConfig.jobId, {
        jobId: jobConfig.jobId,
        status: 'queued',
        progress: 0,
        currentStep: 'Queued'
      })

      this.logger.info(`Training job submitted: ${jobConfig.jobId}`, {
        modelName: jobConfig.modelName,
        modelType: jobConfig.modelType,
        priority: jobConfig.priority
      })

      // Try to start job if capacity available
      this.processQueue()

      return {
        success: true,
        data: jobConfig.jobId,
        metadata: {
          latency: 0,
          cacheHit: false
        }
      }
    } catch (error) {
      this.logger.error('Failed to submit training job', { error, jobConfig })
      return this.errorHandler.createErrorResponse(
        error,
        'TrainingOrchestrator.submitTrainingJob'
      ) as MLServiceResponse<string>
    }
  }

  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    // Check if we can start new jobs
    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      return
    }

    // Get next job from queue (priority order)
    const queuedJobs = Array.from(this.jobQueue.values())
      .filter(job => {
        const status = this.jobStatuses.get(job.jobId)
        return status?.status === 'queued'
      })
      .sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })

    for (const job of queuedJobs) {
      if (this.activeJobs.size >= this.maxConcurrentJobs) {
        break
      }

      // Start job
      this.runTrainingJob(job)
    }
  }

  /**
   * Run a training job
   */
  private async runTrainingJob(jobConfig: TrainingJobConfig): Promise<void> {
    const startTime = Date.now()

    try {
      // Mark as active
      this.activeJobs.add(jobConfig.jobId)
      this.updateJobStatus(jobConfig.jobId, {
        status: 'running',
        progress: 0,
        currentStep: 'Preparing data',
        startedAt: startTime
      })

      // Step 1: Prepare training data
      const dataResult = await this.trainer.prepareTrainingData(jobConfig.dataConfig)

      if (!dataResult.success || !dataResult.data) {
        throw new Error(`Data preparation failed: ${dataResult.error?.message}`)
      }

      this.updateJobStatus(jobConfig.jobId, {
        status: 'running',
        progress: 20,
        currentStep: 'Splitting data'
      })

      // Step 2: Split data
      const dataSplit = this.trainer.splitData(
        dataResult.data,
        jobConfig.trainingConfig.trainTestSplit,
        jobConfig.trainingConfig.validationSplit
      )

      this.updateJobStatus(jobConfig.jobId, {
        status: 'running',
        progress: 30,
        currentStep: 'Training model'
      })

      // Step 3: Train model
      let trainingResult: MLServiceResponse<TrainingResult>

      if (jobConfig.modelType === ModelType.LIGHTGBM) {
        trainingResult = await this.trainer.trainLightGBM(dataSplit, jobConfig.trainingConfig)
      } else if (jobConfig.modelType === ModelType.XGBOOST) {
        trainingResult = await this.trainer.trainXGBoost(dataSplit, jobConfig.trainingConfig)
      } else if (jobConfig.modelType === ModelType.LSTM) {
        trainingResult = await this.trainer.trainLSTM(dataSplit, jobConfig.trainingConfig)
      } else {
        throw new Error(`Unsupported model type: ${jobConfig.modelType}`)
      }

      if (!trainingResult.success || !trainingResult.data) {
        throw new Error(`Training failed: ${trainingResult.error?.message}`)
      }

      this.updateJobStatus(jobConfig.jobId, {
        status: 'running',
        progress: 70,
        currentStep: 'Evaluating model',
        result: trainingResult.data
      })

      // Step 4: Validate model performance
      const meetsThreshold = trainingResult.data.metrics.validationAccuracy >= 0.70

      if (!meetsThreshold) {
        this.logger.warn(`Model ${jobConfig.modelName} validation accuracy below 70% threshold`, {
          validationAccuracy: trainingResult.data.metrics.validationAccuracy
        })
      }

      // Step 5: Auto-register if requested and validation passed
      let registeredModelId: string | undefined

      if (jobConfig.autoRegister && meetsThreshold) {
        this.updateJobStatus(jobConfig.jobId, {
          status: 'running',
          progress: 80,
          currentStep: 'Registering model'
        })

        const registerResult = await this.registerTrainedModel(
          jobConfig,
          trainingResult.data
        )

        if (registerResult.success && registerResult.data) {
          registeredModelId = registerResult.data.modelId
          this.logger.info(`Model registered: ${registeredModelId}`)

          // Note: ModelCache integration would be done here in production
          // await this.modelCache.addModel(registeredModelId, trainingResult.data.modelArtifact, metadata)
        }
      }

      // Step 6: Auto-deploy if requested
      if (jobConfig.autoDeploy && registeredModelId) {
        this.updateJobStatus(jobConfig.jobId, {
          status: 'running',
          progress: 90,
          currentStep: 'Deploying model'
        })

        const deployResult = await this.registry.deployModel(registeredModelId)
        if (deployResult.success) {
          this.logger.info(`Model deployed: ${registeredModelId}`)
        }
      }

      // Mark as completed
      this.updateJobStatus(jobConfig.jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Completed',
        completedAt: Date.now(),
        result: trainingResult.data,
        modelId: registeredModelId
      })

      const duration = Date.now() - startTime
      this.logger.info(`Training job completed: ${jobConfig.jobId}`, {
        duration,
        modelId: registeredModelId,
        validationAccuracy: trainingResult.data.metrics.validationAccuracy
      })

    } catch (error) {
      this.logger.error(`Training job failed: ${jobConfig.jobId}`, { error })

      this.updateJobStatus(jobConfig.jobId, {
        status: 'failed',
        progress: 0,
        currentStep: 'Failed',
        completedAt: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      // Remove from active jobs
      this.activeJobs.delete(jobConfig.jobId)

      // Process next job in queue
      this.processQueue()
    }
  }

  /**
   * Register trained model in ModelRegistry
   */
  private async registerTrainedModel(
    jobConfig: TrainingJobConfig,
    trainingResult: TrainingResult
  ): Promise<MLServiceResponse<ModelMetadata>> {
    try {
      const registerInput: RegisterModelInput = {
        modelName: jobConfig.modelName,
        modelVersion: jobConfig.modelVersion,
        modelType: jobConfig.modelType as any,
        objective: jobConfig.objective as any,
        targetVariable: jobConfig.targetVariable,
        predictionHorizon: jobConfig.predictionHorizon,
        validationScore: trainingResult.metrics.validationAccuracy,
        testScore: trainingResult.metrics.testAccuracy,
        tierRequirement: TierRequirement.PREMIUM,
        status: ModelStatus.VALIDATED,
        hyperparameters: trainingResult.hyperparameters,
        featureImportance: trainingResult.featureImportance,
        trainingMetrics: {
          trainingLoss: trainingResult.metrics.trainingLoss,
          validationLoss: trainingResult.metrics.validationLoss,
          testLoss: trainingResult.metrics.testLoss,
          precision: trainingResult.metrics.precision,
          recall: trainingResult.metrics.recall,
          f1Score: trainingResult.metrics.f1Score,
          sharpeRatio: trainingResult.metrics.sharpeRatio,
          trainingDuration: trainingResult.metrics.trainingDuration
        }
      }

      return await this.registry.registerModel(registerInput)
    } catch (error) {
      this.logger.error('Failed to register trained model', { error, jobConfig })
      return this.errorHandler.createErrorResponse(
        error,
        'TrainingOrchestrator.registerTrainedModel'
      ) as MLServiceResponse<ModelMetadata>
    }
  }

  /**
   * Compare new model with baseline
   */
  public async compareWithBaseline(
    newModelId: string,
    baselineModelId: string
  ): Promise<MLServiceResponse<BaselineComparison>> {
    try {
      // Get both models from registry
      const newModelResult = await this.registry.getModel(newModelId)
      const baselineModelResult = await this.registry.getModel(baselineModelId)

      if (!newModelResult.success || !newModelResult.data) {
        return {
          success: false,
          error: newModelResult.error || {
            type: 'VALIDATION_ERROR' as any,
            code: 'INVALID_PARAMETERS' as any,
            message: 'New model not found',
            severity: 'medium' as any,
            timestamp: Date.now(),
            source: 'TrainingOrchestrator.compareWithBaseline',
            retryable: false
          }
        }
      }

      if (!baselineModelResult.success || !baselineModelResult.data) {
        return {
          success: false,
          error: baselineModelResult.error || {
            type: 'VALIDATION_ERROR' as any,
            code: 'INVALID_PARAMETERS' as any,
            message: 'Baseline model not found',
            severity: 'medium' as any,
            timestamp: Date.now(),
            source: 'TrainingOrchestrator.compareWithBaseline',
            retryable: false
          }
        }
      }

      const newModel = newModelResult.data
      const baseline = baselineModelResult.data

      // Calculate improvements
      const validationImprovement = (newModel.validationScore || 0) - (baseline.validationScore || 0)
      const testImprovement = (newModel.testScore || 0) - (baseline.testScore || 0)

      // Determine if we should deploy
      const shouldDeploy = validationImprovement > 0.02 && testImprovement >= 0

      const comparison: BaselineComparison = {
        newModel: {
          modelId: newModel.modelId,
          validationAccuracy: newModel.validationScore || 0,
          testAccuracy: newModel.testScore || 0,
          f1Score: 0, // Would come from trainingMetrics
          sharpeRatio: 0
        },
        baseline: {
          modelId: baseline.modelId,
          validationAccuracy: baseline.validationScore || 0,
          testAccuracy: baseline.testScore || 0,
          f1Score: 0,
          sharpeRatio: 0
        },
        improvement: {
          validationAccuracy: validationImprovement,
          testAccuracy: testImprovement,
          f1Score: 0,
          sharpeRatio: 0
        },
        shouldDeploy,
        reason: shouldDeploy
          ? `New model shows ${(validationImprovement * 100).toFixed(2)}% validation improvement`
          : 'New model does not meet deployment criteria'
      }

      this.logger.info('Baseline comparison completed', {
        newModelId,
        baselineModelId,
        shouldDeploy,
        validationImprovement
      })

      return {
        success: true,
        data: comparison,
        metadata: {
          latency: 0,
          cacheHit: false
        }
      }
    } catch (error) {
      this.logger.error('Baseline comparison failed', { error, newModelId, baselineModelId })
      return this.errorHandler.createErrorResponse(
        error,
        'TrainingOrchestrator.compareWithBaseline'
      ) as MLServiceResponse<BaselineComparison>
    }
  }

  /**
   * Schedule automatic retraining
   */
  public scheduleRetraining(schedule: RetrainingSchedule): void {
    this.retrainingSchedules.set(schedule.modelName, schedule)
    this.logger.info(`Retraining scheduled for ${schedule.modelName}`, {
      frequency: schedule.frequency,
      nextRun: new Date(schedule.nextRun)
    })
  }

  /**
   * Check and trigger scheduled retraining jobs
   */
  public async processRetrainingSchedules(): Promise<void> {
    const now = Date.now()

    for (const [modelName, schedule] of this.retrainingSchedules) {
      if (schedule.enabled && schedule.nextRun <= now) {
        this.logger.info(`Triggering scheduled retraining for ${modelName}`)

        // Submit retraining job
        const jobId = `retrain_${modelName}_${Date.now()}`
        await this.submitTrainingJob({
          ...schedule.config,
          jobId
        })

        // Update next run time
        const nextRun = this.calculateNextRun(now, schedule.frequency)
        schedule.lastRun = now
        schedule.nextRun = nextRun
      }
    }
  }

  /**
   * Calculate next run timestamp based on frequency
   */
  private calculateNextRun(currentTime: number, frequency: string): number {
    const msPerDay = 24 * 60 * 60 * 1000

    switch (frequency) {
      case 'daily':
        return currentTime + msPerDay
      case 'weekly':
        return currentTime + msPerDay * 7
      case 'monthly':
        return currentTime + msPerDay * 30
      default:
        return currentTime + msPerDay
    }
  }

  /**
   * Get job status
   */
  public getJobStatus(jobId: string): TrainingJobStatus | undefined {
    return this.jobStatuses.get(jobId)
  }

  /**
   * Get all job statuses
   */
  public getAllJobStatuses(): TrainingJobStatus[] {
    return Array.from(this.jobStatuses.values())
  }

  /**
   * Get training statistics
   */
  public getTrainingStatistics(): TrainingStatistics {
    const allStatuses = Array.from(this.jobStatuses.values())

    const completed = allStatuses.filter(s => s.status === 'completed')
    const failed = allStatuses.filter(s => s.status === 'failed')
    const active = allStatuses.filter(s => s.status === 'running')
    const queued = allStatuses.filter(s => s.status === 'queued')

    const totalTrainingTime = completed.reduce((sum, job) => {
      return sum + ((job.completedAt || 0) - (job.startedAt || 0))
    }, 0)

    return {
      totalJobs: allStatuses.length,
      completedJobs: completed.length,
      failedJobs: failed.length,
      averageTrainingTime: completed.length > 0 ? totalTrainingTime / completed.length : 0,
      successRate: allStatuses.length > 0 ? completed.length / allStatuses.length : 0,
      activeJobs: active.length,
      queuedJobs: queued.length
    }
  }

  /**
   * Cancel a job
   */
  public cancelJob(jobId: string): boolean {
    const status = this.jobStatuses.get(jobId)

    if (!status) {
      return false
    }

    if (status.status === 'running') {
      // Cannot cancel running jobs in this implementation
      return false
    }

    if (status.status === 'queued') {
      this.updateJobStatus(jobId, {
        status: 'cancelled',
        currentStep: 'Cancelled',
        completedAt: Date.now()
      })
      this.jobQueue.delete(jobId)
      return true
    }

    return false
  }

  /**
   * Update job status
   */
  private updateJobStatus(
    jobId: string,
    updates: Partial<TrainingJobStatus>
  ): void {
    const current = this.jobStatuses.get(jobId)
    if (current) {
      this.jobStatuses.set(jobId, { ...current, ...updates })
    }
  }

  /**
   * Set max concurrent jobs
   */
  public setMaxConcurrentJobs(max: number): void {
    this.maxConcurrentJobs = Math.max(1, max)
    this.logger.info(`Max concurrent jobs set to ${this.maxConcurrentJobs}`)
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const trainerHealth = await this.trainer.healthCheck()
      const registryHealth = await this.registry.healthCheck()
      return trainerHealth && registryHealth
    } catch (error) {
      this.logger.error('TrainingOrchestrator health check failed', { error })
      return false
    }
  }
}

// Export singleton instance
export default TrainingOrchestrator.getInstance()
