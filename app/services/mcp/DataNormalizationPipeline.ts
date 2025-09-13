/**
 * Data Normalization Pipeline for MCP Financial Intelligence Platform
 * Orchestrates the complete data normalization process with validation, quality metrics, and lineage tracking
 */

import {
  UnifiedStockPrice,
  UnifiedCompanyInfo,
  UnifiedFinancialStatement,
  UnifiedTechnicalIndicator,
  UnifiedNewsItem,
  QualityScore,
  ValidationResult,
  DataDiscrepancy,
  ConflictResolutionStrategy,
  FusionOptions
} from './types'
import { DataTransformationLayer } from './DataTransformationLayer'
import { QualityScorer } from './QualityScorer'
import { DataValidationEngine } from './DataValidationEngine'
import { DataQualityMonitor } from './DataQualityMonitor'
import { DataLineageTracker } from './DataLineageTracker'

export interface NormalizationResult<T> {
  success: boolean
  data?: T
  validationResult: ValidationResult
  qualityScore: QualityScore
  lineageInfo: DataLineageInfo
  processingTime: number
  errors?: string[]
  warnings?: string[]
}

export interface DataLineageInfo {
  sourceId: string
  transformations: TransformationStep[]
  validationSteps: ValidationStep[]
  qualityChecks: QualityCheck[]
  timestamp: number
  processingLatency: number
}

export interface TransformationStep {
  step: string
  inputSchema: string
  outputSchema: string
  timestamp: number
  duration: number
  metadata?: Record<string, any>
}

export interface ValidationStep {
  rule: string
  passed: boolean
  severity: 'error' | 'warning' | 'info'
  message: string
  timestamp: number
}

export interface QualityCheck {
  metric: string
  score: number
  threshold: number
  passed: boolean
  timestamp: number
}

export interface NormalizationConfig {
  enableValidation: boolean
  enableQualityChecking: boolean
  enableLineageTracking: boolean
  validationThresholds: ValidationThresholds
  qualityThresholds: QualityThresholds
  transformationOptions: TransformationOptions
}

export interface ValidationThresholds {
  stockPrice: {
    priceVariance: number // Max % variance allowed
    volumeVariance: number
    timestampTolerance: number // Max age in ms
    requiredFields: string[]
  }
  companyInfo: {
    requiredFields: string[]
    marketCapVariance: number
    nameMatchThreshold: number
  }
  financialStatement: {
    revenueVariance: number
    requiredFields: string[]
    periodValidation: boolean
  }
  technicalIndicator: {
    valueVariance: number
    timestampTolerance: number
    requiredFields: string[]
  }
  newsItem: {
    requiredFields: string[]
    sentimentVariance: number
    timestampTolerance: number
  }
}

export interface QualityThresholds {
  overall: number // Minimum overall quality score
  freshness: number
  completeness: number
  accuracy: number
  sourceReputation: number
  latency: number // Max acceptable latency in ms
}

export interface TransformationOptions {
  preserveRawData: boolean
  enableFieldMapping: boolean
  enableUnitConversion: boolean
  enableFormatStandardization: boolean
  enableErrorRecovery: boolean
}

export class DataNormalizationPipeline {
  private static instance: DataNormalizationPipeline
  private qualityScorer: QualityScorer
  private validationEngine: DataValidationEngine
  private qualityMonitor: DataQualityMonitor
  private lineageTracker: DataLineageTracker
  private config: NormalizationConfig

  constructor(config?: Partial<NormalizationConfig>) {
    this.config = this.mergeWithDefaults(config)
    this.qualityScorer = new QualityScorer()
    this.validationEngine = new DataValidationEngine(this.config.validationThresholds)
    this.qualityMonitor = new DataQualityMonitor(this.config.qualityThresholds)
    this.lineageTracker = new DataLineageTracker()
  }

  static getInstance(config?: Partial<NormalizationConfig>): DataNormalizationPipeline {
    if (!DataNormalizationPipeline.instance) {
      DataNormalizationPipeline.instance = new DataNormalizationPipeline(config)
    }
    return DataNormalizationPipeline.instance
  }

  /**
   * Normalize stock price data from any MCP source
   */
  async normalizeStockPrice(
    rawData: any,
    source: string,
    symbol: string,
    options: Partial<FusionOptions> = {}
  ): Promise<NormalizationResult<UnifiedStockPrice>> {
    const startTime = Date.now()
    const lineageId = this.lineageTracker.startTracking(source, 'stock_price', { symbol })

    try {
      // Step 1: Initial quality assessment
      const initialQuality = this.qualityScorer.calculateQualityScore(
        source,
        rawData,
        Date.now(),
        0
      )

      this.lineageTracker.addQualityCheck(lineageId, {
        metric: 'initial_quality',
        score: initialQuality.overall,
        threshold: this.config.qualityThresholds.overall,
        passed: initialQuality.overall >= this.config.qualityThresholds.overall,
        timestamp: Date.now()
      })

      // Step 2: Data transformation
      const transformStart = Date.now()
      const transformedData = DataTransformationLayer.transformStockPrice(
        rawData,
        source,
        symbol,
        initialQuality
      )

      this.lineageTracker.addTransformation(lineageId, {
        step: 'price_transformation',
        inputSchema: 'raw_mcp_data',
        outputSchema: 'UnifiedStockPrice',
        timestamp: transformStart,
        duration: Date.now() - transformStart,
        metadata: { source, symbol }
      })

      // Step 3: Data validation
      let validationResult: ValidationResult = { isValid: true, discrepancies: [], confidence: 1.0 }
      if (this.config.enableValidation) {
        const validationStart = Date.now()
        validationResult = await this.validationEngine.validateStockPrice(transformedData)

        this.lineageTracker.addValidation(lineageId, {
          rule: 'stock_price_validation',
          passed: validationResult.isValid,
          severity: validationResult.isValid ? 'info' : 'error',
          message: validationResult.isValid ? 'Validation passed' : `${validationResult.discrepancies.length} discrepancies found`,
          timestamp: validationStart
        })
      }

      // Step 4: Quality scoring of transformed data
      const finalQuality = this.qualityScorer.calculateQualityScore(
        source,
        transformedData,
        transformedData.timestamp,
        Date.now() - startTime
      )

      // Step 5: Quality monitoring
      if (this.config.enableQualityChecking) {
        this.qualityMonitor.recordQualityMetrics('stock_price', source, finalQuality)
      }

      // Step 6: Finalize lineage tracking
      const lineageInfo = this.lineageTracker.finalizeTracking(lineageId, {
        success: validationResult.isValid,
        processingTime: Date.now() - startTime
      })

      return {
        success: validationResult.isValid,
        data: validationResult.isValid ? transformedData : undefined,
        validationResult,
        qualityScore: finalQuality,
        lineageInfo,
        processingTime: Date.now() - startTime,
        warnings: validationResult.discrepancies.length > 0
          ? [`${validationResult.discrepancies.length} validation discrepancies detected`]
          : undefined
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown normalization error'

      this.lineageTracker.addValidation(lineageId, {
        rule: 'normalization_error',
        passed: false,
        severity: 'error',
        message: errorMessage,
        timestamp: Date.now()
      })

      const lineageInfo = this.lineageTracker.finalizeTracking(lineageId, {
        success: false,
        processingTime: Date.now() - startTime
      })

      return {
        success: false,
        validationResult: { isValid: false, discrepancies: [], confidence: 0 },
        qualityScore: {
          overall: 0,
          metrics: {
            freshness: 0,
            completeness: 0,
            accuracy: 0,
            sourceReputation: 0,
            latency: Date.now() - startTime
          },
          timestamp: Date.now(),
          source
        },
        lineageInfo,
        processingTime: Date.now() - startTime,
        errors: [errorMessage]
      }
    }
  }

  /**
   * Normalize company information data
   */
  async normalizeCompanyInfo(
    rawData: any,
    source: string,
    symbol: string,
    options: Partial<FusionOptions> = {}
  ): Promise<NormalizationResult<UnifiedCompanyInfo>> {
    const startTime = Date.now()
    const lineageId = this.lineageTracker.startTracking(source, 'company_info', { symbol })

    try {
      const initialQuality = this.qualityScorer.calculateQualityScore(source, rawData, Date.now(), 0)

      const transformStart = Date.now()
      const transformedData = DataTransformationLayer.transformCompanyInfo(
        rawData,
        source,
        symbol,
        initialQuality
      )

      this.lineageTracker.addTransformation(lineageId, {
        step: 'company_transformation',
        inputSchema: 'raw_mcp_data',
        outputSchema: 'UnifiedCompanyInfo',
        timestamp: transformStart,
        duration: Date.now() - transformStart,
        metadata: { source, symbol }
      })

      let validationResult: ValidationResult = { isValid: true, discrepancies: [], confidence: 1.0 }
      if (this.config.enableValidation) {
        validationResult = await this.validationEngine.validateCompanyInfo(transformedData)
      }

      const finalQuality = this.qualityScorer.calculateQualityScore(
        source,
        transformedData,
        Date.now(),
        Date.now() - startTime
      )

      if (this.config.enableQualityChecking) {
        this.qualityMonitor.recordQualityMetrics('company_info', source, finalQuality)
      }

      const lineageInfo = this.lineageTracker.finalizeTracking(lineageId, {
        success: validationResult.isValid,
        processingTime: Date.now() - startTime
      })

      return {
        success: validationResult.isValid,
        data: validationResult.isValid ? transformedData : undefined,
        validationResult,
        qualityScore: finalQuality,
        lineageInfo,
        processingTime: Date.now() - startTime
      }

    } catch (error) {
      return this.createErrorResult<UnifiedCompanyInfo>(error, source, lineageId, startTime)
    }
  }

  /**
   * Normalize technical indicator data
   */
  async normalizeTechnicalIndicator(
    rawData: any,
    source: string,
    symbol: string,
    indicator: string,
    options: Partial<FusionOptions> = {}
  ): Promise<NormalizationResult<UnifiedTechnicalIndicator>> {
    const startTime = Date.now()
    const lineageId = this.lineageTracker.startTracking(source, 'technical_indicator', { symbol, indicator })

    try {
      const initialQuality = this.qualityScorer.calculateQualityScore(source, rawData, Date.now(), 0)

      const transformStart = Date.now()
      const transformedData = DataTransformationLayer.transformTechnicalIndicator(
        rawData,
        source,
        symbol,
        indicator,
        initialQuality
      )

      this.lineageTracker.addTransformation(lineageId, {
        step: 'technical_transformation',
        inputSchema: 'raw_mcp_data',
        outputSchema: 'UnifiedTechnicalIndicator',
        timestamp: transformStart,
        duration: Date.now() - transformStart,
        metadata: { source, symbol, indicator }
      })

      let validationResult: ValidationResult = { isValid: true, discrepancies: [], confidence: 1.0 }
      if (this.config.enableValidation) {
        validationResult = await this.validationEngine.validateTechnicalIndicator(transformedData)
      }

      const finalQuality = this.qualityScorer.calculateQualityScore(
        source,
        transformedData,
        transformedData.timestamp,
        Date.now() - startTime
      )

      if (this.config.enableQualityChecking) {
        this.qualityMonitor.recordQualityMetrics('technical_indicator', source, finalQuality)
      }

      const lineageInfo = this.lineageTracker.finalizeTracking(lineageId, {
        success: validationResult.isValid,
        processingTime: Date.now() - startTime
      })

      return {
        success: validationResult.isValid,
        data: validationResult.isValid ? transformedData : undefined,
        validationResult,
        qualityScore: finalQuality,
        lineageInfo,
        processingTime: Date.now() - startTime
      }

    } catch (error) {
      return this.createErrorResult<UnifiedTechnicalIndicator>(error, source, lineageId, startTime)
    }
  }

  /**
   * Normalize financial statement data
   */
  async normalizeFinancialStatement(
    rawData: any,
    source: string,
    symbol: string,
    options: Partial<FusionOptions> = {}
  ): Promise<NormalizationResult<UnifiedFinancialStatement>> {
    const startTime = Date.now()
    const lineageId = this.lineageTracker.startTracking(source, 'financial_statement', { symbol })

    try {
      const initialQuality = this.qualityScorer.calculateQualityScore(source, rawData, Date.now(), 0)

      const transformStart = Date.now()
      const transformedData = DataTransformationLayer.transformFinancialStatement(
        rawData,
        source,
        symbol,
        initialQuality
      )

      this.lineageTracker.addTransformation(lineageId, {
        step: 'financial_statement_transformation',
        inputSchema: 'raw_mcp_data',
        outputSchema: 'UnifiedFinancialStatement',
        timestamp: transformStart,
        duration: Date.now() - transformStart,
        metadata: { source, symbol }
      })

      let validationResult: ValidationResult = { isValid: true, discrepancies: [], confidence: 1.0 }
      if (this.config.enableValidation) {
        validationResult = await this.validationEngine.validateFinancialStatement(transformedData)
      }

      const finalQuality = this.qualityScorer.calculateQualityScore(
        source,
        transformedData,
        Date.now(),
        Date.now() - startTime
      )

      if (this.config.enableQualityChecking) {
        this.qualityMonitor.recordQualityMetrics('financial_statement', source, finalQuality)
      }

      const lineageInfo = this.lineageTracker.finalizeTracking(lineageId, {
        success: validationResult.isValid,
        processingTime: Date.now() - startTime
      })

      return {
        success: validationResult.isValid,
        data: validationResult.isValid ? transformedData : undefined,
        validationResult,
        qualityScore: finalQuality,
        lineageInfo,
        processingTime: Date.now() - startTime
      }

    } catch (error) {
      return this.createErrorResult<UnifiedFinancialStatement>(error, source, lineageId, startTime)
    }
  }

  /**
   * Normalize news data
   */
  async normalizeNews(
    rawData: any,
    source: string,
    options: Partial<FusionOptions> = {}
  ): Promise<NormalizationResult<UnifiedNewsItem[]>> {
    const startTime = Date.now()
    const lineageId = this.lineageTracker.startTracking(source, 'news', {})

    try {
      const initialQuality = this.qualityScorer.calculateQualityScore(source, rawData, Date.now(), 0)

      const transformStart = Date.now()
      const transformedData = DataTransformationLayer.transformNews(
        rawData,
        source,
        initialQuality
      )

      this.lineageTracker.addTransformation(lineageId, {
        step: 'news_transformation',
        inputSchema: 'raw_mcp_data',
        outputSchema: 'UnifiedNewsItem[]',
        timestamp: transformStart,
        duration: Date.now() - transformStart,
        metadata: { source, itemCount: transformedData.length }
      })

      let validationResult: ValidationResult = { isValid: true, discrepancies: [], confidence: 1.0 }
      if (this.config.enableValidation) {
        validationResult = await this.validationEngine.validateNews(transformedData)
      }

      const finalQuality = this.qualityScorer.calculateQualityScore(
        source,
        transformedData,
        Date.now(),
        Date.now() - startTime
      )

      if (this.config.enableQualityChecking) {
        this.qualityMonitor.recordQualityMetrics('news', source, finalQuality)
      }

      const lineageInfo = this.lineageTracker.finalizeTracking(lineageId, {
        success: validationResult.isValid,
        processingTime: Date.now() - startTime
      })

      return {
        success: validationResult.isValid,
        data: validationResult.isValid ? transformedData : undefined,
        validationResult,
        qualityScore: finalQuality,
        lineageInfo,
        processingTime: Date.now() - startTime
      }

    } catch (error) {
      return this.createErrorResult<UnifiedNewsItem[]>(error, source, lineageId, startTime)
    }
  }

  /**
   * Batch normalize multiple data types for comprehensive symbol analysis
   */
  async batchNormalize(
    requests: Array<{
      type: 'stock_price' | 'company_info' | 'financial_statement' | 'technical_indicator' | 'news'
      rawData: any
      source: string
      symbol?: string
      indicator?: string
    }>,
    options: Partial<FusionOptions> = {}
  ): Promise<{
    results: NormalizationResult<any>[]
    summary: {
      totalProcessed: number
      successful: number
      failed: number
      avgProcessingTime: number
      avgQualityScore: number
    }
  }> {
    const startTime = Date.now()
    const results: NormalizationResult<any>[] = []

    // Process all requests in parallel for optimal performance
    const promises = requests.map(async (request) => {
      switch (request.type) {
        case 'stock_price':
          return this.normalizeStockPrice(request.rawData, request.source, request.symbol!, options)
        case 'company_info':
          return this.normalizeCompanyInfo(request.rawData, request.source, request.symbol!, options)
        case 'financial_statement':
          return this.normalizeFinancialStatement(request.rawData, request.source, request.symbol!, options)
        case 'technical_indicator':
          return this.normalizeTechnicalIndicator(
            request.rawData,
            request.source,
            request.symbol!,
            request.indicator!,
            options
          )
        case 'news':
          return this.normalizeNews(request.rawData, request.source, options)
        default:
          throw new Error(`Unsupported normalization type: ${request.type}`)
      }
    })

    const batchResults = await Promise.allSettled(promises)

    // Process results and calculate summary
    let successCount = 0
    let totalProcessingTime = 0
    let totalQualityScore = 0

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
        if (result.value.success) {
          successCount++
          totalQualityScore += result.value.qualityScore.overall
        }
        totalProcessingTime += result.value.processingTime
      } else {
        // Create error result for failed promise
        results.push({
          success: false,
          validationResult: { isValid: false, discrepancies: [], confidence: 0 },
          qualityScore: { overall: 0, metrics: { freshness: 0, completeness: 0, accuracy: 0, sourceReputation: 0, latency: 0 }, timestamp: Date.now(), source: requests[index].source },
          lineageInfo: { sourceId: requests[index].source, transformations: [], validationSteps: [], qualityChecks: [], timestamp: Date.now(), processingLatency: 0 },
          processingTime: 0,
          errors: [result.reason?.message || 'Batch processing failed']
        })
      }
    })

    return {
      results,
      summary: {
        totalProcessed: requests.length,
        successful: successCount,
        failed: requests.length - successCount,
        avgProcessingTime: totalProcessingTime / requests.length,
        avgQualityScore: successCount > 0 ? totalQualityScore / successCount : 0
      }
    }
  }

  /**
   * Get pipeline performance statistics
   */
  getStatistics() {
    return {
      pipeline: {
        totalNormalizations: this.lineageTracker.getTotalOperations(),
        avgProcessingTime: this.lineageTracker.getAverageProcessingTime(),
        successRate: this.lineageTracker.getSuccessRate()
      },
      validation: this.validationEngine.getStatistics(),
      quality: this.qualityMonitor.getStatistics(),
      lineage: this.lineageTracker.getStatistics()
    }
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(newConfig: Partial<NormalizationConfig>) {
    this.config = this.mergeWithDefaults(newConfig)
    this.validationEngine.updateThresholds(this.config.validationThresholds)
    this.qualityMonitor.updateThresholds(this.config.qualityThresholds)
  }

  /**
   * Reset pipeline state and statistics
   */
  reset() {
    this.validationEngine.reset()
    this.qualityMonitor.reset()
    this.lineageTracker.reset()
  }

  /**
   * Helper method to create error results
   */
  private createErrorResult<T>(
    error: any,
    source: string,
    lineageId: string,
    startTime: number
  ): NormalizationResult<T> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown normalization error'

    this.lineageTracker.addValidation(lineageId, {
      rule: 'normalization_error',
      passed: false,
      severity: 'error',
      message: errorMessage,
      timestamp: Date.now()
    })

    const lineageInfo = this.lineageTracker.finalizeTracking(lineageId, {
      success: false,
      processingTime: Date.now() - startTime
    })

    return {
      success: false,
      validationResult: { isValid: false, discrepancies: [], confidence: 0 },
      qualityScore: {
        overall: 0,
        metrics: {
          freshness: 0,
          completeness: 0,
          accuracy: 0,
          sourceReputation: 0,
          latency: Date.now() - startTime
        },
        timestamp: Date.now(),
        source
      },
      lineageInfo,
      processingTime: Date.now() - startTime,
      errors: [errorMessage]
    }
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(config?: Partial<NormalizationConfig>): NormalizationConfig {
    const defaults: NormalizationConfig = {
      enableValidation: true,
      enableQualityChecking: true,
      enableLineageTracking: true,
      validationThresholds: {
        stockPrice: {
          priceVariance: 0.05, // 5% max variance
          volumeVariance: 0.20, // 20% max variance
          timestampTolerance: 300000, // 5 minutes
          requiredFields: ['symbol', 'close', 'timestamp']
        },
        companyInfo: {
          requiredFields: ['symbol', 'name'],
          marketCapVariance: 0.10, // 10% variance
          nameMatchThreshold: 0.8
        },
        financialStatement: {
          revenueVariance: 0.05,
          requiredFields: ['symbol', 'period', 'fiscalYear'],
          periodValidation: true
        },
        technicalIndicator: {
          valueVariance: 0.10,
          timestampTolerance: 300000,
          requiredFields: ['symbol', 'indicator', 'value']
        },
        newsItem: {
          requiredFields: ['title', 'url', 'publishedAt'],
          sentimentVariance: 0.3,
          timestampTolerance: 86400000 // 24 hours
        }
      },
      qualityThresholds: {
        overall: 0.7, // 70% minimum quality
        freshness: 0.8,
        completeness: 0.9,
        accuracy: 0.8,
        sourceReputation: 0.6,
        latency: 5000 // 5 seconds max
      },
      transformationOptions: {
        preserveRawData: false,
        enableFieldMapping: true,
        enableUnitConversion: true,
        enableFormatStandardization: true,
        enableErrorRecovery: true
      }
    }

    return { ...defaults, ...config }
  }
}

export const dataNormalizationPipeline = DataNormalizationPipeline.getInstance()