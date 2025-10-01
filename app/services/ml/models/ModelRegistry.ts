/**
 * Model Registry Service
 *
 * Manages ML model registration, versioning, deployment, and A/B testing
 * following VFR patterns with PostgreSQL integration.
 *
 * Features:
 * - Model registration with versioning (model_name + model_version uniqueness)
 * - Model artifact storage location tracking (S3 or file system paths)
 * - Model metadata management (hyperparameters, performance metrics)
 * - Model deployment tracking (training, validated, deployed, shadow, deprecated)
 * - A/B testing framework (champion-challenger pattern support)
 * - Model performance history tracking
 * - PostgreSQL integration with ml_models table
 *
 * Philosophy: KISS principles - simple, focused service extending VFR patterns
 */

import { Pool, PoolClient } from 'pg'
import { Logger } from '../../error-handling/Logger'
import { ErrorHandler, ErrorType, ErrorCode } from '../../error-handling/ErrorHandler'
import { MLServiceResponse } from '../types/MLTypes'

// ===== Model Registry Types =====

export enum ModelType {
  LINEAR_REGRESSION = 'linear_regression',
  LOGISTIC_REGRESSION = 'logistic_regression',
  RANDOM_FOREST = 'random_forest',
  XGBOOST = 'xgboost',
  LIGHTGBM = 'lightgbm',
  LSTM = 'lstm',
  TRANSFORMER = 'transformer',
  ENSEMBLE = 'ensemble'
}

export enum ModelObjective {
  PRICE_PREDICTION = 'price_prediction',
  DIRECTION_CLASSIFICATION = 'direction_classification',
  VOLATILITY_FORECAST = 'volatility_forecast',
  FACTOR_ENHANCEMENT = 'factor_enhancement'
}

export enum ModelStatus {
  TRAINING = 'training',
  VALIDATED = 'validated',
  DEPLOYED = 'deployed',
  SHADOW = 'shadow',
  DEPRECATED = 'deprecated'
}

export enum TierRequirement {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export interface ModelMetadata {
  modelId: string
  modelName: string
  modelVersion: string
  modelType: ModelType
  objective: ModelObjective
  targetVariable: string
  predictionHorizon: string
  validationScore?: number
  testScore?: number
  tierRequirement: TierRequirement
  status: ModelStatus
  artifactPath?: string
  hyperparameters?: Record<string, any>
  featureImportance?: Record<string, number>
  trainingMetrics?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface RegisterModelInput {
  modelName: string
  modelVersion: string
  modelType: ModelType
  objective: ModelObjective
  targetVariable: string
  predictionHorizon: string
  validationScore?: number
  testScore?: number
  tierRequirement?: TierRequirement
  status?: ModelStatus
  artifactPath?: string
  hyperparameters?: Record<string, any>
  featureImportance?: Record<string, number>
  trainingMetrics?: Record<string, any>
}

export interface UpdateModelInput {
  modelId: string
  validationScore?: number
  testScore?: number
  status?: ModelStatus
  artifactPath?: string
  hyperparameters?: Record<string, any>
  featureImportance?: Record<string, number>
  trainingMetrics?: Record<string, any>
}

export interface ModelListFilter {
  status?: ModelStatus
  modelType?: ModelType
  tierRequirement?: TierRequirement
  objective?: ModelObjective
  limit?: number
}

export interface ABTestConfig {
  championModelId: string
  challengerModelId: string
}

/**
 * Model Registry Service
 * Singleton service for ML model lifecycle management
 */
export class ModelRegistry {
  private static instance: ModelRegistry
  private pool: Pool
  private logger: Logger
  private errorHandler: ErrorHandler
  private initialized = false

  private constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })

    this.logger = Logger.getInstance('ModelRegistry')
    this.errorHandler = ErrorHandler.getInstance()

    // Handle pool errors
    this.pool.on('error', (err) => {
      this.logger.error('PostgreSQL pool error in ModelRegistry', { error: err })
      this.initialized = false
    })
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry()
    }
    return ModelRegistry.instance
  }

  /**
   * Initialize the service and verify database connectivity
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      const client = await this.pool.connect()
      await client.query('SELECT 1')
      client.release()

      this.initialized = true
      this.logger.info('ModelRegistry initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize ModelRegistry', { error })
      throw error
    }
  }

  /**
   * Register a new model in the registry
   */
  public async registerModel(
    input: RegisterModelInput
  ): Promise<MLServiceResponse<ModelMetadata>> {
    const startTime = Date.now()

    if (!this.initialized) {
      await this.initialize()
    }

    try {
      const query = `
        INSERT INTO ml_models (
          model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
      `

      const params = [
        input.modelName,
        input.modelVersion,
        input.modelType,
        input.objective,
        input.targetVariable,
        input.predictionHorizon,
        input.validationScore,
        input.testScore,
        input.tierRequirement || TierRequirement.PREMIUM,
        input.status || ModelStatus.TRAINING
      ]

      const result = await this.pool.query(query, params)
      const row = result.rows[0]

      const metadata: ModelMetadata = {
        modelId: row.model_id,
        modelName: row.model_name,
        modelVersion: row.model_version,
        modelType: row.model_type,
        objective: row.objective,
        targetVariable: row.target_variable,
        predictionHorizon: row.prediction_horizon,
        validationScore: row.validation_score,
        testScore: row.test_score,
        tierRequirement: row.tier_requirement,
        status: row.status,
        artifactPath: input.artifactPath,
        hyperparameters: input.hyperparameters,
        featureImportance: input.featureImportance,
        trainingMetrics: input.trainingMetrics,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }

      const latency = Date.now() - startTime
      this.logger.info(`Model registered: ${input.modelName} v${input.modelVersion}`, {
        modelId: metadata.modelId,
        latency
      })

      return {
        success: true,
        data: metadata,
        metadata: {
          latency,
          cacheHit: false
        }
      }
    } catch (error: any) {
      this.logger.error('Failed to register model', { error, input })

      // Check for unique constraint violation
      if (error.code === '23505') {
        return {
          success: false,
          error: {
            type: ErrorType.VALIDATION_ERROR,
            code: ErrorCode.INVALID_PARAMETERS,
            message: `Model ${input.modelName} v${input.modelVersion} already exists`,
            severity: this.errorHandler.createErrorResponse(
              error,
              'ModelRegistry.registerModel'
            ).error.severity,
            timestamp: Date.now(),
            source: 'ModelRegistry.registerModel',
            retryable: false
          }
        }
      }

      return this.errorHandler.createErrorResponse(
        error,
        'ModelRegistry.registerModel'
      ) as MLServiceResponse<ModelMetadata>
    }
  }

  /**
   * Update model metadata
   */
  public async updateModel(
    input: UpdateModelInput
  ): Promise<MLServiceResponse<ModelMetadata>> {
    const startTime = Date.now()

    if (!this.initialized) {
      await this.initialize()
    }

    try {
      // Build dynamic update query
      const updates: string[] = []
      const params: any[] = []
      let paramIndex = 1

      if (input.validationScore !== undefined) {
        updates.push(`validation_score = $${paramIndex}`)
        params.push(input.validationScore)
        paramIndex++
      }

      if (input.testScore !== undefined) {
        updates.push(`test_score = $${paramIndex}`)
        params.push(input.testScore)
        paramIndex++
      }

      if (input.status !== undefined) {
        updates.push(`status = $${paramIndex}`)
        params.push(input.status)
        paramIndex++
      }

      // Always update updated_at
      updates.push(`updated_at = NOW()`)

      if (updates.length === 1) {
        // Only updated_at would be updated
        return {
          success: false,
          error: {
            type: ErrorType.VALIDATION_ERROR,
            code: ErrorCode.INVALID_PARAMETERS,
            message: 'No fields to update',
            severity: this.errorHandler.createErrorResponse(
              new Error('No fields to update'),
              'ModelRegistry.updateModel'
            ).error.severity,
            timestamp: Date.now(),
            source: 'ModelRegistry.updateModel',
            retryable: false
          }
        }
      }

      params.push(input.modelId)

      const query = `
        UPDATE ml_models
        SET ${updates.join(', ')}
        WHERE model_id = $${paramIndex}
        RETURNING
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
      `

      const result = await this.pool.query(query, params)

      if (result.rows.length === 0) {
        return {
          success: false,
          error: {
            type: ErrorType.VALIDATION_ERROR,
            code: ErrorCode.INVALID_PARAMETERS,
            message: `Model not found: ${input.modelId}`,
            severity: this.errorHandler.createErrorResponse(
              new Error('Model not found'),
              'ModelRegistry.updateModel'
            ).error.severity,
            timestamp: Date.now(),
            source: 'ModelRegistry.updateModel',
            retryable: false
          }
        }
      }

      const row = result.rows[0]

      const metadata: ModelMetadata = {
        modelId: row.model_id,
        modelName: row.model_name,
        modelVersion: row.model_version,
        modelType: row.model_type,
        objective: row.objective,
        targetVariable: row.target_variable,
        predictionHorizon: row.prediction_horizon,
        validationScore: row.validation_score,
        testScore: row.test_score,
        tierRequirement: row.tier_requirement,
        status: row.status,
        artifactPath: input.artifactPath,
        hyperparameters: input.hyperparameters,
        featureImportance: input.featureImportance,
        trainingMetrics: input.trainingMetrics,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }

      const latency = Date.now() - startTime
      this.logger.info(`Model updated: ${metadata.modelName} v${metadata.modelVersion}`, {
        modelId: metadata.modelId,
        latency
      })

      return {
        success: true,
        data: metadata,
        metadata: {
          latency,
          cacheHit: false
        }
      }
    } catch (error) {
      this.logger.error('Failed to update model', { error, input })
      return this.errorHandler.createErrorResponse(
        error,
        'ModelRegistry.updateModel'
      ) as MLServiceResponse<ModelMetadata>
    }
  }

  /**
   * Get model by ID
   */
  public async getModel(modelId: string): Promise<MLServiceResponse<ModelMetadata>> {
    const startTime = Date.now()

    if (!this.initialized) {
      await this.initialize()
    }

    try {
      const query = `
        SELECT
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
        FROM ml_models
        WHERE model_id = $1
      `

      const result = await this.pool.query(query, [modelId])

      if (result.rows.length === 0) {
        return {
          success: false,
          error: {
            type: ErrorType.VALIDATION_ERROR,
            code: ErrorCode.INVALID_PARAMETERS,
            message: `Model not found: ${modelId}`,
            severity: this.errorHandler.createErrorResponse(
              new Error('Model not found'),
              'ModelRegistry.getModel'
            ).error.severity,
            timestamp: Date.now(),
            source: 'ModelRegistry.getModel',
            retryable: false
          }
        }
      }

      const row = result.rows[0]

      const metadata: ModelMetadata = {
        modelId: row.model_id,
        modelName: row.model_name,
        modelVersion: row.model_version,
        modelType: row.model_type,
        objective: row.objective,
        targetVariable: row.target_variable,
        predictionHorizon: row.prediction_horizon,
        validationScore: row.validation_score,
        testScore: row.test_score,
        tierRequirement: row.tier_requirement,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }

      const latency = Date.now() - startTime

      return {
        success: true,
        data: metadata,
        metadata: {
          latency,
          cacheHit: false
        }
      }
    } catch (error) {
      this.logger.error('Failed to get model', { error, modelId })
      return this.errorHandler.createErrorResponse(
        error,
        'ModelRegistry.getModel'
      ) as MLServiceResponse<ModelMetadata>
    }
  }

  /**
   * Get model by name and version
   */
  public async getModelByNameVersion(
    modelName: string,
    modelVersion: string
  ): Promise<MLServiceResponse<ModelMetadata>> {
    const startTime = Date.now()

    if (!this.initialized) {
      await this.initialize()
    }

    try {
      const query = `
        SELECT
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
        FROM ml_models
        WHERE model_name = $1 AND model_version = $2
      `

      const result = await this.pool.query(query, [modelName, modelVersion])

      if (result.rows.length === 0) {
        return {
          success: false,
          error: {
            type: ErrorType.VALIDATION_ERROR,
            code: ErrorCode.INVALID_PARAMETERS,
            message: `Model not found: ${modelName} v${modelVersion}`,
            severity: this.errorHandler.createErrorResponse(
              new Error('Model not found'),
              'ModelRegistry.getModelByNameVersion'
            ).error.severity,
            timestamp: Date.now(),
            source: 'ModelRegistry.getModelByNameVersion',
            retryable: false
          }
        }
      }

      const row = result.rows[0]

      const metadata: ModelMetadata = {
        modelId: row.model_id,
        modelName: row.model_name,
        modelVersion: row.model_version,
        modelType: row.model_type,
        objective: row.objective,
        targetVariable: row.target_variable,
        predictionHorizon: row.prediction_horizon,
        validationScore: row.validation_score,
        testScore: row.test_score,
        tierRequirement: row.tier_requirement,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }

      const latency = Date.now() - startTime

      return {
        success: true,
        data: metadata,
        metadata: {
          latency,
          cacheHit: false
        }
      }
    } catch (error) {
      this.logger.error('Failed to get model by name/version', {
        error,
        modelName,
        modelVersion
      })
      return this.errorHandler.createErrorResponse(
        error,
        'ModelRegistry.getModelByNameVersion'
      ) as MLServiceResponse<ModelMetadata>
    }
  }

  /**
   * List models with optional filters
   */
  public async listModels(
    filter?: ModelListFilter
  ): Promise<MLServiceResponse<ModelMetadata[]>> {
    const startTime = Date.now()

    if (!this.initialized) {
      await this.initialize()
    }

    try {
      let query = `
        SELECT
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
        FROM ml_models
        WHERE 1=1
      `

      const params: any[] = []
      let paramIndex = 1

      if (filter?.status) {
        query += ` AND status = $${paramIndex}`
        params.push(filter.status)
        paramIndex++
      }

      if (filter?.modelType) {
        query += ` AND model_type = $${paramIndex}`
        params.push(filter.modelType)
        paramIndex++
      }

      if (filter?.tierRequirement) {
        query += ` AND tier_requirement = $${paramIndex}`
        params.push(filter.tierRequirement)
        paramIndex++
      }

      if (filter?.objective) {
        query += ` AND objective = $${paramIndex}`
        params.push(filter.objective)
        paramIndex++
      }

      query += ` ORDER BY created_at DESC`

      if (filter?.limit) {
        query += ` LIMIT $${paramIndex}`
        params.push(filter.limit)
      }

      const result = await this.pool.query(query, params)

      const models: ModelMetadata[] = result.rows.map((row) => ({
        modelId: row.model_id,
        modelName: row.model_name,
        modelVersion: row.model_version,
        modelType: row.model_type,
        objective: row.objective,
        targetVariable: row.target_variable,
        predictionHorizon: row.prediction_horizon,
        validationScore: row.validation_score,
        testScore: row.test_score,
        tierRequirement: row.tier_requirement,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))

      const latency = Date.now() - startTime
      this.logger.debug(`Listed ${models.length} models`, { latency, filter })

      return {
        success: true,
        data: models,
        metadata: {
          latency,
          cacheHit: false
        }
      }
    } catch (error) {
      this.logger.error('Failed to list models', { error, filter })
      return this.errorHandler.createErrorResponse(
        error,
        'ModelRegistry.listModels'
      ) as MLServiceResponse<ModelMetadata[]>
    }
  }

  /**
   * Deploy model (set to deployed, demote previous champion to shadow)
   * Uses transaction to ensure atomicity
   */
  public async deployModel(modelId: string): Promise<MLServiceResponse<ModelMetadata>> {
    const startTime = Date.now()

    if (!this.initialized) {
      await this.initialize()
    }

    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')

      // Get the model to deploy
      const getModelQuery = `
        SELECT
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
        FROM ml_models
        WHERE model_id = $1
      `

      const modelResult = await client.query(getModelQuery, [modelId])

      if (modelResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return {
          success: false,
          error: {
            type: ErrorType.VALIDATION_ERROR,
            code: ErrorCode.INVALID_PARAMETERS,
            message: `Model not found: ${modelId}`,
            severity: this.errorHandler.createErrorResponse(
              new Error('Model not found'),
              'ModelRegistry.deployModel'
            ).error.severity,
            timestamp: Date.now(),
            source: 'ModelRegistry.deployModel',
            retryable: false
          }
        }
      }

      const model = modelResult.rows[0]

      // Demote current deployed model(s) to shadow for the same model_name
      const demoteQuery = `
        UPDATE ml_models
        SET status = $1, updated_at = NOW()
        WHERE model_name = $2
          AND status = $3
          AND model_id != $4
      `

      await client.query(demoteQuery, [
        ModelStatus.SHADOW,
        model.model_name,
        ModelStatus.DEPLOYED,
        modelId
      ])

      // Deploy the new model
      const deployQuery = `
        UPDATE ml_models
        SET status = $1, updated_at = NOW()
        WHERE model_id = $2
        RETURNING
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
      `

      const deployResult = await client.query(deployQuery, [ModelStatus.DEPLOYED, modelId])

      await client.query('COMMIT')

      const row = deployResult.rows[0]

      const metadata: ModelMetadata = {
        modelId: row.model_id,
        modelName: row.model_name,
        modelVersion: row.model_version,
        modelType: row.model_type,
        objective: row.objective,
        targetVariable: row.target_variable,
        predictionHorizon: row.prediction_horizon,
        validationScore: row.validation_score,
        testScore: row.test_score,
        tierRequirement: row.tier_requirement,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }

      const latency = Date.now() - startTime
      this.logger.info(`Model deployed: ${metadata.modelName} v${metadata.modelVersion}`, {
        modelId: metadata.modelId,
        latency
      })

      return {
        success: true,
        data: metadata,
        metadata: {
          latency,
          cacheHit: false
        }
      }
    } catch (error) {
      await client.query('ROLLBACK')
      this.logger.error('Failed to deploy model', { error, modelId })
      return this.errorHandler.createErrorResponse(
        error,
        'ModelRegistry.deployModel'
      ) as MLServiceResponse<ModelMetadata>
    } finally {
      client.release()
    }
  }

  /**
   * Deprecate model
   */
  public async deprecateModel(modelId: string): Promise<MLServiceResponse<ModelMetadata>> {
    const startTime = Date.now()

    if (!this.initialized) {
      await this.initialize()
    }

    try {
      const query = `
        UPDATE ml_models
        SET status = $1, updated_at = NOW()
        WHERE model_id = $2
        RETURNING
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
      `

      const result = await this.pool.query(query, [ModelStatus.DEPRECATED, modelId])

      if (result.rows.length === 0) {
        return {
          success: false,
          error: {
            type: ErrorType.VALIDATION_ERROR,
            code: ErrorCode.INVALID_PARAMETERS,
            message: `Model not found: ${modelId}`,
            severity: this.errorHandler.createErrorResponse(
              new Error('Model not found'),
              'ModelRegistry.deprecateModel'
            ).error.severity,
            timestamp: Date.now(),
            source: 'ModelRegistry.deprecateModel',
            retryable: false
          }
        }
      }

      const row = result.rows[0]

      const metadata: ModelMetadata = {
        modelId: row.model_id,
        modelName: row.model_name,
        modelVersion: row.model_version,
        modelType: row.model_type,
        objective: row.objective,
        targetVariable: row.target_variable,
        predictionHorizon: row.prediction_horizon,
        validationScore: row.validation_score,
        testScore: row.test_score,
        tierRequirement: row.tier_requirement,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }

      const latency = Date.now() - startTime
      this.logger.info(`Model deprecated: ${metadata.modelName} v${metadata.modelVersion}`, {
        modelId: metadata.modelId,
        latency
      })

      return {
        success: true,
        data: metadata,
        metadata: {
          latency,
          cacheHit: false
        }
      }
    } catch (error) {
      this.logger.error('Failed to deprecate model', { error, modelId })
      return this.errorHandler.createErrorResponse(
        error,
        'ModelRegistry.deprecateModel'
      ) as MLServiceResponse<ModelMetadata>
    }
  }

  /**
   * Get all currently deployed models
   */
  public async getDeployedModels(): Promise<MLServiceResponse<ModelMetadata[]>> {
    return this.listModels({ status: ModelStatus.DEPLOYED })
  }

  /**
   * Get version history for a model name
   */
  public async getModelHistory(
    modelName: string
  ): Promise<MLServiceResponse<ModelMetadata[]>> {
    const startTime = Date.now()

    if (!this.initialized) {
      await this.initialize()
    }

    try {
      const query = `
        SELECT
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
        FROM ml_models
        WHERE model_name = $1
        ORDER BY created_at DESC
      `

      const result = await this.pool.query(query, [modelName])

      const models: ModelMetadata[] = result.rows.map((row) => ({
        modelId: row.model_id,
        modelName: row.model_name,
        modelVersion: row.model_version,
        modelType: row.model_type,
        objective: row.objective,
        targetVariable: row.target_variable,
        predictionHorizon: row.prediction_horizon,
        validationScore: row.validation_score,
        testScore: row.test_score,
        tierRequirement: row.tier_requirement,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))

      const latency = Date.now() - startTime
      this.logger.debug(`Retrieved ${models.length} versions for model ${modelName}`, {
        latency
      })

      return {
        success: true,
        data: models,
        metadata: {
          latency,
          cacheHit: false
        }
      }
    } catch (error) {
      this.logger.error('Failed to get model history', { error, modelName })
      return this.errorHandler.createErrorResponse(
        error,
        'ModelRegistry.getModelHistory'
      ) as MLServiceResponse<ModelMetadata[]>
    }
  }

  /**
   * Enable A/B testing (set champion to deployed, challenger to shadow)
   */
  public async enableABTest(
    config: ABTestConfig
  ): Promise<MLServiceResponse<{ champion: ModelMetadata; challenger: ModelMetadata }>> {
    const startTime = Date.now()

    if (!this.initialized) {
      await this.initialize()
    }

    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')

      // Deploy champion
      const championQuery = `
        UPDATE ml_models
        SET status = $1, updated_at = NOW()
        WHERE model_id = $2
        RETURNING
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
      `

      const championResult = await client.query(championQuery, [
        ModelStatus.DEPLOYED,
        config.championModelId
      ])

      if (championResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return {
          success: false,
          error: {
            type: ErrorType.VALIDATION_ERROR,
            code: ErrorCode.INVALID_PARAMETERS,
            message: `Champion model not found: ${config.championModelId}`,
            severity: this.errorHandler.createErrorResponse(
              new Error('Champion model not found'),
              'ModelRegistry.enableABTest'
            ).error.severity,
            timestamp: Date.now(),
            source: 'ModelRegistry.enableABTest',
            retryable: false
          }
        }
      }

      // Set challenger to shadow
      const challengerQuery = `
        UPDATE ml_models
        SET status = $1, updated_at = NOW()
        WHERE model_id = $2
        RETURNING
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
      `

      const challengerResult = await client.query(challengerQuery, [
        ModelStatus.SHADOW,
        config.challengerModelId
      ])

      if (challengerResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return {
          success: false,
          error: {
            type: ErrorType.VALIDATION_ERROR,
            code: ErrorCode.INVALID_PARAMETERS,
            message: `Challenger model not found: ${config.challengerModelId}`,
            severity: this.errorHandler.createErrorResponse(
              new Error('Challenger model not found'),
              'ModelRegistry.enableABTest'
            ).error.severity,
            timestamp: Date.now(),
            source: 'ModelRegistry.enableABTest',
            retryable: false
          }
        }
      }

      await client.query('COMMIT')

      const championRow = championResult.rows[0]
      const challengerRow = challengerResult.rows[0]

      const champion: ModelMetadata = {
        modelId: championRow.model_id,
        modelName: championRow.model_name,
        modelVersion: championRow.model_version,
        modelType: championRow.model_type,
        objective: championRow.objective,
        targetVariable: championRow.target_variable,
        predictionHorizon: championRow.prediction_horizon,
        validationScore: championRow.validation_score,
        testScore: championRow.test_score,
        tierRequirement: championRow.tier_requirement,
        status: championRow.status,
        createdAt: championRow.created_at,
        updatedAt: championRow.updated_at
      }

      const challenger: ModelMetadata = {
        modelId: challengerRow.model_id,
        modelName: challengerRow.model_name,
        modelVersion: challengerRow.model_version,
        modelType: challengerRow.model_type,
        objective: challengerRow.objective,
        targetVariable: challengerRow.target_variable,
        predictionHorizon: challengerRow.prediction_horizon,
        validationScore: challengerRow.validation_score,
        testScore: challengerRow.test_score,
        tierRequirement: challengerRow.tier_requirement,
        status: challengerRow.status,
        createdAt: challengerRow.created_at,
        updatedAt: challengerRow.updated_at
      }

      const latency = Date.now() - startTime
      this.logger.info('A/B test enabled', {
        champion: `${champion.modelName} v${champion.modelVersion}`,
        challenger: `${challenger.modelName} v${challenger.modelVersion}`,
        latency
      })

      return {
        success: true,
        data: { champion, challenger },
        metadata: {
          latency,
          cacheHit: false
        }
      }
    } catch (error) {
      await client.query('ROLLBACK')
      this.logger.error('Failed to enable A/B test', { error, config })
      return this.errorHandler.createErrorResponse(
        error,
        'ModelRegistry.enableABTest'
      ) as MLServiceResponse<{ champion: ModelMetadata; challenger: ModelMetadata }>
    } finally {
      client.release()
    }
  }

  /**
   * Get models in A/B testing configuration (deployed + shadow pairs)
   */
  public async getABTestModels(): Promise<
    MLServiceResponse<Array<{ champion: ModelMetadata; challengers: ModelMetadata[] }>>
  > {
    const startTime = Date.now()

    if (!this.initialized) {
      await this.initialize()
    }

    try {
      // Get all deployed models
      const deployedQuery = `
        SELECT
          model_id, model_name, model_version, model_type, objective,
          target_variable, prediction_horizon, validation_score,
          test_score, tier_requirement, status, created_at, updated_at
        FROM ml_models
        WHERE status = $1
        ORDER BY model_name, created_at DESC
      `

      const deployedResult = await this.pool.query(deployedQuery, [ModelStatus.DEPLOYED])

      const abTests: Array<{ champion: ModelMetadata; challengers: ModelMetadata[] }> = []

      // For each deployed model, find shadow challengers with same model_name
      for (const deployedRow of deployedResult.rows) {
        const shadowQuery = `
          SELECT
            model_id, model_name, model_version, model_type, objective,
            target_variable, prediction_horizon, validation_score,
            test_score, tier_requirement, status, created_at, updated_at
          FROM ml_models
          WHERE model_name = $1 AND status = $2
          ORDER BY created_at DESC
        `

        const shadowResult = await this.pool.query(shadowQuery, [
          deployedRow.model_name,
          ModelStatus.SHADOW
        ])

        if (shadowResult.rows.length > 0) {
          const champion: ModelMetadata = {
            modelId: deployedRow.model_id,
            modelName: deployedRow.model_name,
            modelVersion: deployedRow.model_version,
            modelType: deployedRow.model_type,
            objective: deployedRow.objective,
            targetVariable: deployedRow.target_variable,
            predictionHorizon: deployedRow.prediction_horizon,
            validationScore: deployedRow.validation_score,
            testScore: deployedRow.test_score,
            tierRequirement: deployedRow.tier_requirement,
            status: deployedRow.status,
            createdAt: deployedRow.created_at,
            updatedAt: deployedRow.updated_at
          }

          const challengers: ModelMetadata[] = shadowResult.rows.map((row) => ({
            modelId: row.model_id,
            modelName: row.model_name,
            modelVersion: row.model_version,
            modelType: row.model_type,
            objective: row.objective,
            targetVariable: row.target_variable,
            predictionHorizon: row.prediction_horizon,
            validationScore: row.validation_score,
            testScore: row.test_score,
            tierRequirement: row.tier_requirement,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }))

          abTests.push({ champion, challengers })
        }
      }

      const latency = Date.now() - startTime
      this.logger.debug(`Retrieved ${abTests.length} A/B test configurations`, { latency })

      return {
        success: true,
        data: abTests,
        metadata: {
          latency,
          cacheHit: false
        }
      }
    } catch (error) {
      this.logger.error('Failed to get A/B test models', { error })
      return this.errorHandler.createErrorResponse(
        error,
        'ModelRegistry.getABTestModels'
      ) as MLServiceResponse<Array<{ champion: ModelMetadata; challengers: ModelMetadata[] }>>
    }
  }

  /**
   * Update performance metrics for a model
   */
  public async updatePerformanceMetrics(
    modelId: string,
    validationScore: number,
    testScore: number
  ): Promise<MLServiceResponse<ModelMetadata>> {
    return this.updateModel({
      modelId,
      validationScore,
      testScore
    })
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect()
      await client.query('SELECT 1 FROM ml_models LIMIT 1')
      client.release()
      return true
    } catch (error) {
      this.logger.error('ModelRegistry health check failed', { error })
      return false
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    try {
      await this.pool.end()
      this.initialized = false
      this.logger.info('ModelRegistry cleanup completed')
    } catch (error) {
      this.logger.error('ModelRegistry cleanup failed', { error })
    }
  }
}

// Export singleton instance
export default ModelRegistry.getInstance()
