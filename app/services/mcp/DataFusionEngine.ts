/**
 * Data Fusion Engine for MCP Multi-Source Integration
 * Intelligently combines data from multiple MCP sources with conflict resolution
 */

import {
  FusedMCPResponse,
  FusionOptions,
  FusionMetadata,
  ConflictResolutionStrategy,
  DataDiscrepancy,
  ValidationResult,
  QualityScore,
  FusionConfig,
  CustomResolutionFunction,
  UnifiedStockPrice,
  UnifiedCompanyInfo,
  UnifiedFinancialStatement
} from './types'
import { QualityScorer } from './QualityScorer'

interface SourceDataPoint<T = any> {
  source: string
  data: T
  quality: QualityScore
  timestamp: number
  latency: number
}

export class DataFusionEngine {
  private qualityScorer: QualityScorer
  private config: FusionConfig

  constructor(config?: Partial<FusionConfig>) {
    this.qualityScorer = new QualityScorer(config?.quality?.weights)

    // Default configuration
    this.config = {
      defaultStrategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
      rules: [],
      sources: [],
      validation: {
        enabled: true,
        thresholds: {
          price: 0.1,      // 0.1% variance
          volume: 5.0,     // 5% variance
          marketCap: 1.0,  // 1% variance
          default: 2.0     // 2% variance
        }
      },
      quality: {
        weights: {
          freshness: 0.3,
          completeness: 0.25,
          accuracy: 0.25,
          sourceReputation: 0.15,
          latency: 0.05
        },
        minAcceptable: 0.5
      },
      performance: {
        parallelRequests: true,
        maxConcurrent: 5,
        timeoutMs: 10000,
        cacheEnabled: true,
        cacheTTL: 60000 // 1 minute
      },
      ...config
    }
  }

  /**
   * Fuse data from multiple sources
   */
  async fuseData<T = any>(
    dataPoints: SourceDataPoint<T>[],
    options: FusionOptions = {}
  ): Promise<FusedMCPResponse<T>> {
    const startTime = Date.now()

    // Filter by minimum quality if specified
    const minQuality = options.minQualityScore ?? this.config.quality.minAcceptable
    const qualifiedPoints = dataPoints.filter(dp => dp.quality.overall >= minQuality)

    if (qualifiedPoints.length === 0) {
      return {
        success: false,
        error: 'No data sources meet minimum quality requirements',
        source: 'fusion',
        timestamp: Date.now()
      }
    }

    // If only one source, return it directly
    if (qualifiedPoints.length === 1) {
      return this.createResponse(qualifiedPoints[0], [], options)
    }

    // Perform validation if enabled
    let validationResult: ValidationResult | undefined
    if (options.validateData ?? this.config.validation.enabled) {
      validationResult = this.validateData(qualifiedPoints)

      // If consensus required and validation fails, return error
      if (options.requireConsensus && !validationResult.isValid) {
        return {
          success: false,
          error: 'Data sources do not meet consensus requirements',
          source: 'fusion',
          timestamp: Date.now(),
          fusion: {
            sources: qualifiedPoints.map(dp => dp.source),
            primarySource: '',
            qualityScore: this.calculateAverageQuality(qualifiedPoints),
            conflicts: validationResult.discrepancies.length,
            resolutionStrategy: options.strategy ?? this.config.defaultStrategy,
            validationResult,
            fusionTimestamp: Date.now()
          }
        }
      }
    }

    // Resolve conflicts and merge data
    const strategy = options.strategy ?? this.config.defaultStrategy
    const fusedData = this.resolveConflicts(qualifiedPoints, strategy, validationResult?.discrepancies)

    // Select primary source (highest quality)
    const primarySource = QualityScorer.selectBestSource(
      qualifiedPoints.map(dp => dp.quality)
    ) ?? qualifiedPoints[0].source

    // Create fusion metadata
    const fusionMetadata: FusionMetadata = {
      sources: qualifiedPoints.map(dp => dp.source),
      primarySource,
      qualityScore: this.calculateFusedQuality(qualifiedPoints, fusedData),
      conflicts: validationResult?.discrepancies.length ?? 0,
      resolutionStrategy: strategy,
      validationResult,
      fusionTimestamp: Date.now(),
      cacheTTL: options.cacheFusion ? this.config.performance.cacheTTL : undefined
    }

    return {
      success: true,
      data: fusedData,
      source: primarySource,
      timestamp: Date.now(),
      cached: false,
      fusion: options.includeMetadata !== false ? fusionMetadata : undefined
    }
  }

  /**
   * Validate data consistency across sources
   */
  private validateData<T>(dataPoints: SourceDataPoint<T>[]): ValidationResult {
    const discrepancies: DataDiscrepancy[] = []
    const fieldValues = new Map<string, Map<string, any>>()

    // Collect all field values from all sources
    dataPoints.forEach(dp => {
      const fields = this.extractFields(dp.data)
      fields.forEach(({ key, value }) => {
        if (!fieldValues.has(key)) {
          fieldValues.set(key, new Map())
        }
        fieldValues.get(key)!.set(dp.source, value)
      })
    })

    // Check for discrepancies
    fieldValues.forEach((sourceValues, field) => {
      const values = Array.from(sourceValues.values())
      const variance = this.calculateVariance(values, field)

      if (variance > this.getVarianceThreshold(field)) {
        const sources: { [source: string]: any } = {}
        sourceValues.forEach((value, source) => {
          sources[source] = value
        })

        discrepancies.push({
          field,
          sources,
          variance,
          resolution: {
            strategy: this.config.defaultStrategy,
            resolvedValue: null, // Will be filled during resolution
            reason: `Variance ${variance.toFixed(2)}% exceeds threshold`
          }
        })
      }
    })

    // Calculate confidence based on discrepancy count and severity
    const confidence = this.calculateValidationConfidence(discrepancies, dataPoints.length)

    return {
      isValid: discrepancies.length === 0,
      discrepancies,
      confidence
    }
  }

  /**
   * Resolve conflicts between data sources
   */
  private resolveConflicts<T>(
    dataPoints: SourceDataPoint<T>[],
    strategy: ConflictResolutionStrategy,
    discrepancies?: DataDiscrepancy[]
  ): T {
    switch (strategy) {
      case ConflictResolutionStrategy.HIGHEST_QUALITY:
        return this.resolveByHighestQuality(dataPoints)

      case ConflictResolutionStrategy.MOST_RECENT:
        return this.resolveByMostRecent(dataPoints)

      case ConflictResolutionStrategy.CONSENSUS:
        return this.resolveByConsensus(dataPoints)

      case ConflictResolutionStrategy.WEIGHTED_AVERAGE:
        return this.resolveByWeightedAverage(dataPoints)

      default:
        return this.resolveByHighestQuality(dataPoints)
    }
  }

  /**
   * Resolution strategy: Use highest quality source
   */
  private resolveByHighestQuality<T>(dataPoints: SourceDataPoint<T>[]): T {
    const sorted = [...dataPoints].sort((a, b) => b.quality.overall - a.quality.overall)
    return sorted[0].data
  }

  /**
   * Resolution strategy: Use most recent data
   */
  private resolveByMostRecent<T>(dataPoints: SourceDataPoint<T>[]): T {
    const sorted = [...dataPoints].sort((a, b) => b.timestamp - a.timestamp)
    return sorted[0].data
  }

  /**
   * Resolution strategy: Use consensus (majority vote)
   */
  private resolveByConsensus<T>(dataPoints: SourceDataPoint<T>[]): T {
    // For complex objects, this is challenging - we'll use field-by-field consensus
    const result: any = {}
    const fields = new Map<string, Map<any, number>>()

    // Count occurrences of each field value
    dataPoints.forEach(dp => {
      const extracted = this.extractFields(dp.data)
      extracted.forEach(({ key, value }) => {
        if (!fields.has(key)) {
          fields.set(key, new Map())
        }
        const fieldCounts = fields.get(key)!
        const count = fieldCounts.get(value) || 0
        fieldCounts.set(value, count + 1)
      })
    })

    // Select most common value for each field
    fields.forEach((valueCounts, field) => {
      let maxCount = 0
      let consensusValue: any

      valueCounts.forEach((count, value) => {
        if (count > maxCount) {
          maxCount = count
          consensusValue = value
        }
      })

      this.setNestedProperty(result, field, consensusValue)
    })

    return result as T
  }

  /**
   * Resolution strategy: Weighted average (for numeric fields)
   */
  private resolveByWeightedAverage<T>(dataPoints: SourceDataPoint<T>[]): T {
    const result: any = {}
    const fields = new Map<string, { values: number[], weights: number[] }>()

    // Collect numeric fields with quality weights
    dataPoints.forEach(dp => {
      const extracted = this.extractFields(dp.data)
      extracted.forEach(({ key, value }) => {
        if (typeof value === 'number') {
          if (!fields.has(key)) {
            fields.set(key, { values: [], weights: [] })
          }
          const field = fields.get(key)!
          field.values.push(value)
          field.weights.push(dp.quality.overall)
        } else {
          // For non-numeric fields, use highest quality
          if (!result[key] || dp.quality.overall > (result[key + '_quality'] || 0)) {
            this.setNestedProperty(result, key, value)
            result[key + '_quality'] = dp.quality.overall
          }
        }
      })
    })

    // Calculate weighted averages for numeric fields
    fields.forEach((data, field) => {
      const totalWeight = data.weights.reduce((sum, w) => sum + w, 0)
      if (totalWeight > 0) {
        const weightedSum = data.values.reduce((sum, val, i) =>
          sum + val * data.weights[i], 0
        )
        this.setNestedProperty(result, field, weightedSum / totalWeight)
      }
    })

    // Clean up quality markers
    Object.keys(result).forEach(key => {
      if (key.endsWith('_quality')) {
        delete result[key]
      }
    })

    return result as T
  }

  /**
   * Extract fields from data object
   */
  private extractFields(data: any, prefix = ''): Array<{ key: string, value: any }> {
    const fields: Array<{ key: string, value: any }> = []

    if (data === null || data === undefined) {
      return fields
    }

    if (typeof data !== 'object') {
      return [{ key: prefix || 'value', value: data }]
    }

    Object.keys(data).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key
      const value = data[key]

      if (value === null || value === undefined) {
        fields.push({ key: fullKey, value })
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Recursively extract nested fields
        fields.push(...this.extractFields(value, fullKey))
      } else {
        fields.push({ key: fullKey, value })
      }
    })

    return fields
  }

  /**
   * Set nested property in object
   */
  private setNestedProperty(obj: any, path: string, value: any) {
    const keys = path.split('.')
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }

    current[keys[keys.length - 1]] = value
  }

  /**
   * Calculate variance between values
   */
  private calculateVariance(values: any[], field: string): number {
    if (values.length <= 1) return 0

    // For numeric values, calculate percentage variance
    const numericValues = values.filter(v => typeof v === 'number')
    if (numericValues.length > 1) {
      const min = Math.min(...numericValues)
      const max = Math.max(...numericValues)
      const avg = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length

      if (avg === 0) return max === 0 ? 0 : 100
      return ((max - min) / Math.abs(avg)) * 100
    }

    // For non-numeric values, calculate uniqueness ratio
    const uniqueValues = new Set(values)
    return ((uniqueValues.size - 1) / values.length) * 100
  }

  /**
   * Get variance threshold for a field
   */
  private getVarianceThreshold(field: string): number {
    const thresholds = this.config.validation.thresholds

    // Check field-specific thresholds
    if (field.includes('price') || field.includes('close') || field.includes('open')) {
      return thresholds.price
    }
    if (field.includes('volume')) {
      return thresholds.volume
    }
    if (field.includes('marketCap')) {
      return thresholds.marketCap
    }

    return thresholds.default
  }

  /**
   * Calculate validation confidence
   */
  private calculateValidationConfidence(
    discrepancies: DataDiscrepancy[],
    sourceCount: number
  ): number {
    if (discrepancies.length === 0) return 1.0

    // Base confidence starts high
    let confidence = 0.9

    // Reduce confidence based on discrepancy count
    confidence -= discrepancies.length * 0.05

    // Reduce confidence based on average variance
    const avgVariance = discrepancies.reduce((sum, d) => sum + d.variance, 0) / discrepancies.length
    confidence -= Math.min(0.3, avgVariance / 100)

    // Boost confidence if many sources agree despite some discrepancies
    if (sourceCount > 2) {
      confidence += 0.1
    }

    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Calculate average quality across data points
   */
  private calculateAverageQuality(dataPoints: SourceDataPoint[]): QualityScore {
    const avgMetrics = {
      freshness: 0,
      completeness: 0,
      accuracy: 0,
      sourceReputation: 0,
      latency: 0
    }

    dataPoints.forEach(dp => {
      avgMetrics.freshness += dp.quality.metrics.freshness
      avgMetrics.completeness += dp.quality.metrics.completeness
      avgMetrics.accuracy += dp.quality.metrics.accuracy
      avgMetrics.sourceReputation += dp.quality.metrics.sourceReputation
      avgMetrics.latency += dp.quality.metrics.latency
    })

    const count = dataPoints.length
    Object.keys(avgMetrics).forEach(key => {
      avgMetrics[key as keyof typeof avgMetrics] /= count
    })

    const overall = dataPoints.reduce((sum, dp) => sum + dp.quality.overall, 0) / count

    return {
      overall,
      metrics: avgMetrics,
      timestamp: Date.now(),
      source: 'fusion'
    }
  }

  /**
   * Calculate quality score for fused data
   */
  private calculateFusedQuality<T>(
    dataPoints: SourceDataPoint<T>[],
    fusedData: T
  ): QualityScore {
    // Start with average quality
    const baseQuality = this.calculateAverageQuality(dataPoints)

    // Boost quality if multiple sources agree
    const agreementBonus = dataPoints.length > 2 ? 0.05 : 0
    baseQuality.overall = Math.min(1, baseQuality.overall + agreementBonus)

    // Adjust based on data completeness
    const completeness = this.qualityScorer['calculateCompleteness'](fusedData)
    baseQuality.metrics.completeness = completeness

    return baseQuality
  }

  /**
   * Create response from single data point
   */
  private createResponse<T>(
    dataPoint: SourceDataPoint<T>,
    otherPoints: SourceDataPoint<T>[],
    options: FusionOptions
  ): FusedMCPResponse<T> {
    const allPoints = [dataPoint, ...otherPoints]

    const fusionMetadata: FusionMetadata = {
      sources: [dataPoint.source],
      primarySource: dataPoint.source,
      qualityScore: dataPoint.quality,
      conflicts: 0,
      resolutionStrategy: options.strategy ?? this.config.defaultStrategy,
      fusionTimestamp: Date.now(),
      cacheTTL: options.cacheFusion ? this.config.performance.cacheTTL : undefined
    }

    return {
      success: true,
      data: dataPoint.data,
      source: dataPoint.source,
      timestamp: Date.now(),
      cached: false,
      fusion: options.includeMetadata !== false ? fusionMetadata : undefined
    }
  }

  /**
   * Get fusion statistics for monitoring
   */
  getStatistics() {
    return {
      qualityStats: this.qualityScorer.getStatistics(),
      config: {
        defaultStrategy: this.config.defaultStrategy,
        validationEnabled: this.config.validation.enabled,
        minQualityScore: this.config.quality.minAcceptable
      }
    }
  }
}