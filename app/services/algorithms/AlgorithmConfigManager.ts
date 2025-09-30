/**
 * Algorithm Configuration Management System
 * Handles CRUD operations, validation, versioning, and deployment of algorithm configurations
 */

import {
  AlgorithmConfiguration,
  AlgorithmType,
  SelectionCriteria,
  AlgorithmValidation,
  AlgorithmPerformance
} from './types'
import { FactorLibrary } from './FactorLibrary'
import { AlgorithmCache } from './AlgorithmCache'

interface ConfigTemplate {
  id: string
  name: string
  description: string
  type: AlgorithmType
  template: Partial<AlgorithmConfiguration>
  category: 'conservative' | 'balanced' | 'aggressive' | 'custom'
  riskLevel: 1 | 2 | 3 | 4 | 5
}

interface ValidationRule {
  field: string
  validator: (value: any, config: AlgorithmConfiguration) => boolean
  message: string
  severity: 'error' | 'warning'
}

interface ConfigHistory {
  configId: string
  version: number
  changes: Array<{
    field: string
    oldValue: any
    newValue: any
    timestamp: number
    userId: string
  }>
  deployedAt?: number
  rollbackAt?: number
}

export class AlgorithmConfigManager {
  private factorLibrary: FactorLibrary
  private cache: AlgorithmCache
  private validationRules: ValidationRule[]
  private templates: Map<string, ConfigTemplate> = new Map()

  constructor(factorLibrary: FactorLibrary, cache: AlgorithmCache) {
    this.factorLibrary = factorLibrary
    this.cache = cache
    this.validationRules = this.initializeValidationRules()
    this.initializeTemplates()
  }

  // ==================== CONFIGURATION CRUD OPERATIONS ====================

  /**
   * Create new algorithm configuration
   */
  async createConfiguration(
    config: Omit<AlgorithmConfiguration, 'id' | 'metadata'>,
    userId: string
  ): Promise<AlgorithmConfiguration> {
    // Generate unique ID
    const id = this.generateConfigId(config.name)

    // Add metadata
    const fullConfig: AlgorithmConfiguration = {
      ...config,
      id,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: userId,
        version: 1
      }
    }

    // Validate configuration
    const validation = await this.validateConfiguration(fullConfig)
    if (!validation.configValidation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.configValidation.errors.join(', ')}`)
    }

    // Store in database
    await this.storeConfiguration(fullConfig)

    // Cache configuration
    await this.cache.setConfiguration(id, fullConfig)

    console.log(`Created algorithm configuration: ${fullConfig.name} (${id})`)
    return fullConfig
  }

  /**
   * Get configuration by ID
   */
  async getConfiguration(configId: string): Promise<AlgorithmConfiguration | null> {
    // Try cache first
    const cached = await this.cache.getConfiguration(configId)
    if (cached) {
      return cached
    }

    // Fetch from database
    const config = await this.fetchConfiguration(configId)
    if (config) {
      await this.cache.setConfiguration(configId, config)
    }

    return config
  }

  /**
   * Update existing configuration
   */
  async updateConfiguration(
    configId: string,
    updates: Partial<AlgorithmConfiguration>,
    userId: string
  ): Promise<AlgorithmConfiguration> {
    const existingConfig = await this.getConfiguration(configId)
    if (!existingConfig) {
      throw new Error(`Configuration not found: ${configId}`)
    }

    // Create updated configuration
    const updatedConfig: AlgorithmConfiguration = {
      ...existingConfig,
      ...updates,
      id: configId, // Ensure ID doesn't change
      metadata: {
        ...existingConfig.metadata,
        updatedAt: Date.now(),
        version: existingConfig.metadata.version + 1
      }
    }

    // Validate updated configuration
    const validation = await this.validateConfiguration(updatedConfig)
    if (!validation.configValidation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.configValidation.errors.join(', ')}`)
    }

    // Track changes for history
    const changes = this.detectChanges(existingConfig, updatedConfig, userId)
    await this.recordConfigHistory(configId, changes)

    // Update in database
    await this.storeConfiguration(updatedConfig)

    // Update cache
    await this.cache.setConfiguration(configId, updatedConfig)

    console.log(`Updated algorithm configuration: ${updatedConfig.name} (${configId}) v${updatedConfig.metadata.version}`)
    return updatedConfig
  }

  /**
   * Delete configuration
   */
  async deleteConfiguration(configId: string, userId: string): Promise<void> {
    const config = await this.getConfiguration(configId)
    if (!config) {
      throw new Error(`Configuration not found: ${configId}`)
    }

    // Check if configuration is currently active
    if (await this.isConfigurationActive(configId)) {
      throw new Error('Cannot delete active configuration. Stop the algorithm first.')
    }

    // Soft delete - mark as deleted but keep for audit trail
    const deletedConfig = {
      ...config,
      enabled: false,
      metadata: {
        ...config.metadata,
        updatedAt: Date.now(),
        deletedAt: Date.now(),
        deletedBy: userId
      }
    }

    await this.storeConfiguration(deletedConfig)
    await this.cache.invalidateAlgorithm(configId)

    console.log(`Deleted algorithm configuration: ${config.name} (${configId})`)
  }

  /**
   * Clone existing configuration
   */
  async cloneConfiguration(
    sourceConfigId: string,
    newName: string,
    userId: string
  ): Promise<AlgorithmConfiguration> {
    const sourceConfig = await this.getConfiguration(sourceConfigId)
    if (!sourceConfig) {
      throw new Error(`Source configuration not found: ${sourceConfigId}`)
    }

    const clonedConfig = {
      ...sourceConfig,
      name: newName,
      enabled: false, // Start disabled by default
    }

    // Remove metadata fields that should be fresh
    delete (clonedConfig as any).id
    delete (clonedConfig as any).metadata

    return this.createConfiguration(clonedConfig, userId)
  }

  // ==================== TEMPLATE MANAGEMENT ====================

  /**
   * Get configuration templates
   */
  getTemplates(category?: string): ConfigTemplate[] {
    const templates = Array.from(this.templates.values())
    return category
      ? templates.filter(t => t.category === category)
      : templates
  }

  /**
   * Create configuration from template
   */
  async createFromTemplate(
    templateId: string,
    name: string,
    customizations: Partial<AlgorithmConfiguration>,
    userId: string
  ): Promise<AlgorithmConfiguration> {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const config = {
      name,
      description: `${name} - Based on ${template.name} template`,
      type: template.template.type,
      ...template.template,
      ...customizations
    }

    // Ensure required fields are present
    if (!config.type) {
      throw new Error('Algorithm type is required')
    }

    return this.createConfiguration(config as any, userId)
  }

  // ==================== VALIDATION SYSTEM ====================

  /**
   * Validate algorithm configuration
   */
  async validateConfiguration(config: AlgorithmConfiguration): Promise<AlgorithmValidation> {
    const errors: string[] = []
    const warnings: string[] = []

    // Run all validation rules
    for (const rule of this.validationRules) {
      try {
        const isValid = rule.validator(this.getFieldValue(config, rule.field), config)
        if (!isValid) {
          if (rule.severity === 'error') {
            errors.push(rule.message)
          } else {
            warnings.push(rule.message)
          }
        }
      } catch (error) {
        errors.push(`Validation error for ${rule.field}: ${error}`)
      }
    }

    // Additional custom validations
    await this.performCustomValidations(config, errors, warnings)

    const validation: AlgorithmValidation = {
      configValidation: {
        isValid: errors.length === 0,
        errors,
        warnings
      }
    }

    // Run backtest if validation passes and requested
    if (validation.configValidation.isValid && config.metadata.backtestedFrom && config.metadata.backtestedTo) {
      try {
        validation.backtest = await this.runBacktest(config)
      } catch (error) {
        warnings.push(`Backtest failed: ${error}`)
      }
    }

    return validation
  }

  /**
   * Validate factor configuration
   */
  private validateFactors(config: AlgorithmConfiguration): { errors: string[], warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    const availableFactors = this.factorLibrary.getAvailableFactors()

    // Check if all factors exist
    for (const weight of config.weights) {
      if (!availableFactors.includes(weight.factor)) {
        errors.push(`Unknown factor: ${weight.factor}`)
      }
    }

    // Check weight distribution
    const totalWeight = config.weights
      .filter(w => w.enabled)
      .reduce((sum, w) => sum + w.weight, 0)

    if (Math.abs(totalWeight - 1.0) > 0.01) {
      warnings.push(`Factor weights sum to ${totalWeight.toFixed(3)}, expected 1.000`)
    }

    // Check for duplicate factors
    const factorNames = config.weights.map(w => w.factor)
    const duplicates = factorNames.filter((name, index) => factorNames.indexOf(name) !== index)
    if (duplicates.length > 0) {
      errors.push(`Duplicate factors: ${duplicates.join(', ')}`)
    }

    return { errors, warnings }
  }

  // ==================== BACKTESTING INTEGRATION ====================

  /**
   * Run backtest for configuration
   */
  private async runBacktest(config: AlgorithmConfiguration): Promise<any> {
    // This would integrate with your backtesting system
    // For demonstration, return mock results
    const mockPerformance: AlgorithmPerformance = {
      algorithmId: config.id,
      period: {
        start: config.metadata.backtestedFrom!,
        end: config.metadata.backtestedTo!
      },
      returns: {
        total: 0.15, // 15% return
        annualized: 0.12,
        sharpe: 1.2,
        maxDrawdown: -0.08,
        volatility: 0.18
      },
      risk: {
        beta: 0.9,
        trackingError: 0.05,
        informationRatio: 0.8,
        var95: -0.03,
        expectedShortfall: -0.045
      },
      algorithmMetrics: {
        turnover: 0.3,
        averageHoldingPeriod: 45,
        winRate: 0.58,
        averageWin: 0.025,
        averageLoss: -0.018,
        dataQualityScore: 0.92
      },
      attribution: {
        momentum: { contribution: 0.08, weight: 0.4, performance: 0.2 },
        value: { contribution: 0.04, weight: 0.3, performance: 0.13 },
        quality: { contribution: 0.03, weight: 0.3, performance: 0.1 }
      }
    }

    return {
      startDate: config.metadata.backtestedFrom!,
      endDate: config.metadata.backtestedTo!,
      performance: mockPerformance,
      trades: [] // Would contain individual trade records
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): ValidationRule[] {
    return [
      {
        field: 'name',
        validator: (value) => typeof value === 'string' && value.length > 0 && value.length <= 100,
        message: 'Name must be a non-empty string with max 100 characters',
        severity: 'error'
      },
      {
        field: 'universe.maxPositions',
        validator: (value) => typeof value === 'number' && value > 0 && value <= 1000,
        message: 'Max positions must be between 1 and 1000',
        severity: 'error'
      },
      {
        field: 'selection.rebalanceFrequency',
        validator: (value) => typeof value === 'number' && value >= 30,
        message: 'Rebalance frequency must be at least 30 seconds',
        severity: 'error'
      },
      {
        field: 'risk.maxSinglePosition',
        validator: (value) => typeof value === 'number' && value > 0 && value <= 1,
        message: 'Max single position must be between 0 and 1',
        severity: 'error'
      },
      {
        field: 'risk.maxSectorWeight',
        validator: (value) => typeof value === 'number' && value > 0 && value <= 1,
        message: 'Max sector weight must be between 0 and 1',
        severity: 'error'
      },
      {
        field: 'dataFusion.minQualityScore',
        validator: (value) => typeof value === 'number' && value >= 0 && value <= 1,
        message: 'Min quality score must be between 0 and 1',
        severity: 'error'
      },
      {
        field: 'weights',
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one factor weight must be defined',
        severity: 'error'
      },
      {
        field: 'universe.maxPositions',
        validator: (value, config) => {
          const topN = config.selection.topN
          return !topN || value >= topN
        },
        message: 'Max positions should be >= topN selection parameter',
        severity: 'warning'
      }
    ]
  }

  /**
   * Perform additional custom validations
   */
  private async performCustomValidations(
    config: AlgorithmConfiguration,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    // Validate factors
    const factorValidation = this.validateFactors(config)
    errors.push(...factorValidation.errors)
    warnings.push(...factorValidation.warnings)

    // Check selection criteria compatibility
    if (config.selectionCriteria === SelectionCriteria.QUANTILE_BASED && !config.selection.quantile) {
      errors.push('Quantile value required for quantile-based selection')
    }

    if (config.selectionCriteria === SelectionCriteria.THRESHOLD_BASED && !config.selection.threshold) {
      errors.push('Threshold value required for threshold-based selection')
    }

    if (config.selectionCriteria === SelectionCriteria.SCORE_BASED && !config.selection.topN) {
      warnings.push('Consider setting topN for score-based selection')
    }

    // Validate data fusion settings
    if (config.dataFusion.requiredSources.length === 0) {
      warnings.push('No required data sources specified - algorithm may fail if no data is available')
    }

    // Check risk management settings
    if (config.risk.maxSectorWeight > 0.5) {
      warnings.push('High sector concentration risk with maxSectorWeight > 50%')
    }

    if (config.risk.maxSinglePosition > 0.2) {
      warnings.push('High single position risk with maxSinglePosition > 20%')
    }

    // Check rebalancing frequency vs min holding period
    if (config.selection.minHoldingPeriod &&
        config.selection.rebalanceFrequency < config.selection.minHoldingPeriod) {
      warnings.push('Rebalance frequency is shorter than minimum holding period')
    }
  }

  /**
   * Initialize configuration templates
   */
  private initializeTemplates(): void {
    const templates: ConfigTemplate[] = [
      {
        id: 'conservative_value',
        name: 'Conservative Value Strategy',
        description: 'Low-risk value investing approach',
        type: AlgorithmType.VALUE,
        category: 'conservative',
        riskLevel: 2,
        template: {
          type: AlgorithmType.VALUE,
          selectionCriteria: SelectionCriteria.SCORE_BASED,
          universe: {
            maxPositions: 30,
            marketCapMin: 1000000000 // $1B minimum
          },
          weights: [
            { factor: 'pe_ratio', weight: 0.3, enabled: true },
            { factor: 'pb_ratio', weight: 0.25, enabled: true },
            { factor: 'debt_equity', weight: 0.2, enabled: true },
            { factor: 'roe', weight: 0.15, enabled: true },
            { factor: 'dividend_yield', weight: 0.1, enabled: true }
          ],
          selection: {
            topN: 25,
            rebalanceFrequency: 2592000, // Monthly
            minHoldingPeriod: 1296000 // 2 weeks
          },
          risk: {
            maxSectorWeight: 0.3,
            maxSinglePosition: 0.08,
            maxTurnover: 0.5
          },
          dataFusion: {
            minQualityScore: 0.8,
            requiredSources: ['polygon', 'alpha_vantage'],
            conflictResolution: 'highest_quality',
            cacheTTL: 3600
          }
        }
      },
      {
        id: 'aggressive_momentum',
        name: 'Aggressive Momentum Strategy',
        description: 'High-growth momentum strategy',
        type: AlgorithmType.MOMENTUM,
        category: 'aggressive',
        riskLevel: 4,
        template: {
          type: AlgorithmType.MOMENTUM,
          selectionCriteria: SelectionCriteria.QUANTILE_BASED,
          universe: {
            maxPositions: 50,
            marketCapMin: 100000000 // $100M minimum
          },
          weights: [
            { factor: 'momentum_3m', weight: 0.35, enabled: true },
            { factor: 'momentum_1m', weight: 0.25, enabled: true },
            { factor: 'rsi_14d', weight: 0.2, enabled: true },
            { factor: 'revenue_growth', weight: 0.15, enabled: true },
            { factor: 'volatility_30d', weight: 0.05, enabled: true }
          ],
          selection: {
            quantile: 0.15,
            rebalanceFrequency: 86400, // Daily
            minHoldingPeriod: 259200 // 3 days
          },
          risk: {
            maxSectorWeight: 0.4,
            maxSinglePosition: 0.05,
            maxTurnover: 1.5
          },
          dataFusion: {
            minQualityScore: 0.7,
            requiredSources: ['polygon', 'alpha_vantage', 'yahoo_finance'],
            conflictResolution: 'highest_quality',
            cacheTTL: 300
          }
        }
      },
      {
        id: 'balanced_quality',
        name: 'Balanced Quality Strategy',
        description: 'Balanced approach focusing on quality companies',
        type: AlgorithmType.QUALITY,
        category: 'balanced',
        riskLevel: 3,
        template: {
          type: AlgorithmType.QUALITY,
          selectionCriteria: SelectionCriteria.SCORE_BASED,
          universe: {
            maxPositions: 40,
            marketCapMin: 500000000 // $500M minimum
          },
          weights: [
            // ✅ FIXED: Use ONLY composite factor - it already includes technical, fundamental, sentiment, etc.
            // Previous config had double-counting: composite (60%) + its components (110%) = 170% total
            // Composite factor internally weights: Technical 28%, Fundamental 28%, Macro 20%, Sentiment 18%, Alternative 6%
            { factor: 'composite', weight: 1.0, enabled: true }
          ],
          selection: {
            topN: 35,
            rebalanceFrequency: 604800, // Weekly
            minHoldingPeriod: 604800 // 1 week
          },
          risk: {
            maxSectorWeight: 0.35,
            maxSinglePosition: 0.06,
            maxTurnover: 0.8
          },
          dataFusion: {
            minQualityScore: 0.75,
            requiredSources: ['polygon', 'alpha_vantage'],
            conflictResolution: 'weighted_average',
            cacheTTL: 1800
          }
        }
      }
    ]

    templates.forEach(template => {
      this.templates.set(template.id, template)
    })
  }

  /**
   * Generate unique configuration ID
   */
  private generateConfigId(name: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 8)
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substr(0, 20)
    return `${cleanName}_${timestamp}_${random}`
  }

  /**
   * Get field value from object using dot notation
   */
  private getFieldValue(obj: any, field: string): any {
    return field.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Detect changes between configurations
   */
  private detectChanges(
    oldConfig: AlgorithmConfiguration,
    newConfig: AlgorithmConfiguration,
    userId: string
  ): ConfigHistory['changes'] {
    const changes: ConfigHistory['changes'] = []
    const timestamp = Date.now()

    // Compare top-level fields
    const fieldsToCompare = [
      'name', 'description', 'type', 'enabled', 'selectionCriteria',
      'universe', 'weights', 'selection', 'risk', 'dataFusion'
    ]

    fieldsToCompare.forEach(field => {
      const oldValue = (oldConfig as any)[field]
      const newValue = (newConfig as any)[field]

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field,
          oldValue,
          newValue,
          timestamp,
          userId
        })
      }
    })

    return changes
  }

  /**
   * Store configuration in database
   */
  private async storeConfiguration(config: AlgorithmConfiguration): Promise<void> {
    // Implementation would depend on your database
    // This is where you'd INSERT/UPDATE the algorithm_configurations table
    console.log(`Storing configuration ${config.id} in database`)
  }

  /**
   * Fetch configuration from database
   */
  private async fetchConfiguration(configId: string): Promise<AlgorithmConfiguration | null> {
    // Implementation would depend on your database
    // This is where you'd SELECT from algorithm_configurations table
    console.log(`Fetching configuration ${configId} from database`)

    // For development: return default configuration from templates if no DB configuration found
    if (configId === 'composite' || configId === 'default') {
      console.log('Creating default composite algorithm configuration WITH SINGLE COMPOSITE FACTOR')
      return this.createSingleCompositeConfiguration()
    }

    return null
  }

  /**
   * Create a default algorithm configuration for fallback purposes
   */
  private createDefaultConfiguration(): AlgorithmConfiguration {
    const template = this.templates.get('balanced_quality')
    if (!template) {
      throw new Error('Default template not found')
    }

    return {
      id: 'composite',
      name: 'Composite Analysis Algorithm',
      description: 'Default comprehensive analysis combining multiple factors',
      type: template.template.type!,
      enabled: true,
      selectionCriteria: template.template.selectionCriteria!,
      universe: template.template.universe!,
      weights: template.template.weights!,
      selection: template.template.selection!,
      risk: template.template.risk!,
      dataFusion: template.template.dataFusion!,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'system',
        version: 1
      }
    }
  }

  /**
   * Create a comprehensive composite factor configuration with individual technical factors
   */
  private createSingleCompositeConfiguration(): AlgorithmConfiguration {
    return {
      id: 'composite',
      name: 'Composite Analysis Algorithm',
      description: 'Comprehensive analysis with individual factor tracking for proper utilization reporting',
      type: 'quality' as any,
      enabled: true,
      selectionCriteria: 'score_based' as any,
      universe: {
        maxPositions: 40,
        marketCapMin: 500000000
      },
      weights: [
        // ✅ FIXED: Removed individual factors to prevent double-counting with composite
        // This is a "detailed breakdown" config that should use individual factors OR composite, not both
        // Using composite factor which internally calculates all sub-components
        { factor: 'composite', weight: 1.0, enabled: true }
      ],
      selection: {
        topN: 35,
        rebalanceFrequency: 604800,
        minHoldingPeriod: 604800
      },
      risk: {
        maxSectorWeight: 0.35,
        maxSinglePosition: 0.06,
        maxTurnover: 0.8
      },
      dataFusion: {
        minQualityScore: 0.75,
        requiredSources: ['polygon', 'alpha_vantage'],
        conflictResolution: 'weighted_average' as any,
        cacheTTL: 1800
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'system',
        version: 1
      }
    }
  }

  /**
   * Record configuration history
   */
  private async recordConfigHistory(configId: string, changes: ConfigHistory['changes']): Promise<void> {
    // Implementation would store changes in a history table
    console.log(`Recording ${changes.length} changes for configuration ${configId}`)
  }

  /**
   * Check if configuration is currently active
   */
  private async isConfigurationActive(configId: string): Promise<boolean> {
    // Check if the configuration is currently being used by the scheduler
    // Implementation would depend on your scheduler state management
    return false
  }

  // ==================== PUBLIC API METHODS ====================

  /**
   * List all configurations with filtering
   */
  async listConfigurations(filters?: {
    type?: AlgorithmType
    enabled?: boolean
    createdBy?: string
    search?: string
  }): Promise<AlgorithmConfiguration[]> {
    // Implementation would query database with filters
    return []
  }

  /**
   * Get configuration history
   */
  async getConfigurationHistory(configId: string): Promise<ConfigHistory[]> {
    // Implementation would query configuration history table
    return []
  }

  /**
   * Export configuration as JSON
   */
  async exportConfiguration(configId: string): Promise<string> {
    const config = await this.getConfiguration(configId)
    if (!config) {
      throw new Error(`Configuration not found: ${configId}`)
    }

    return JSON.stringify(config, null, 2)
  }

  /**
   * Import configuration from JSON
   */
  async importConfiguration(
    configJson: string,
    userId: string,
    overrideName?: string
  ): Promise<AlgorithmConfiguration> {
    const config = JSON.parse(configJson)

    // Remove metadata fields that should be regenerated
    delete config.id
    delete config.metadata

    if (overrideName) {
      config.name = overrideName
    }

    return this.createConfiguration(config, userId)
  }

  /**
   * Rollback to previous configuration version
   */
  async rollbackConfiguration(configId: string, targetVersion: number, userId: string): Promise<AlgorithmConfiguration> {
    // Implementation would fetch the target version from history and restore it
    throw new Error('Rollback functionality not implemented yet')
  }
}