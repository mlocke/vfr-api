/**
 * Algorithm Integration Layer for Stock Selection Service
 * Provides interface between StockSelectionService and AlgorithmEngine
 */

import { AlgorithmEngine } from '../../algorithms/AlgorithmEngine'
import { AlgorithmConfigManager } from '../../algorithms/AlgorithmConfigManager'
import { MockConfigManager } from '../../algorithms/MockConfigManager'
import { FactorLibrary } from '../../algorithms/FactorLibrary'
import { AlgorithmCache } from '../../algorithms/AlgorithmCache'
import { DataFusionEngine } from '../../mcp/DataFusionEngine'
import {
  AlgorithmConfiguration,
  AlgorithmContext,
  SelectionResult,
  AlgorithmType,
  SelectionCriteria
} from '../../algorithms/types'
import {
  SelectionRequest,
  SelectionMode,
  AlgorithmIntegrationInterface,
  SelectionOptions
} from '../types'
import { SelectionConfigManager } from '../config/SelectionConfig'

/**
 * Algorithm integration and orchestration
 */
export class AlgorithmIntegration implements AlgorithmIntegrationInterface {
  private algorithmEngine: AlgorithmEngine
  private configManager: AlgorithmConfigManager
  private mockConfigManager: MockConfigManager
  private selectionConfig: SelectionConfigManager
  private factorLibrary: FactorLibrary
  private cache: AlgorithmCache

  constructor(
    dataFusion: DataFusionEngine,
    factorLibrary: FactorLibrary,
    cache: AlgorithmCache,
    selectionConfig: SelectionConfigManager
  ) {
    this.factorLibrary = factorLibrary
    this.cache = cache
    this.selectionConfig = selectionConfig
    this.configManager = new AlgorithmConfigManager(factorLibrary, cache)
    this.mockConfigManager = MockConfigManager.getInstance()
    this.algorithmEngine = new AlgorithmEngine(dataFusion, factorLibrary, cache)
  }

  /**
   * Execute analysis based on selection request
   */
  async executeAnalysis(request: SelectionRequest): Promise<SelectionResult> {
    const algorithmConfig = await this.buildAlgorithmConfiguration(request)
    const context = this.buildAlgorithmContext(request)

    try {
      const result = await this.algorithmEngine.executeAlgorithm(algorithmConfig, context)
      return this.enhanceSelectionResult(result, request)
    } catch (error) {
      console.error('Algorithm execution failed:', error)

      // Try fallback algorithm if available
      if (algorithmConfig.id !== this.selectionConfig.getConfig().fallbackAlgorithmId) {
        const fallbackConfig = await this.buildFallbackConfiguration(request)
        return await this.algorithmEngine.executeAlgorithm(fallbackConfig, context)
      }

      throw error
    }
  }

  /**
   * Build algorithm configuration from selection request
   */
  private async buildAlgorithmConfiguration(request: SelectionRequest): Promise<AlgorithmConfiguration> {
    const { scope, options } = request
    const serviceConfig = this.selectionConfig.getConfig()

    // Determine algorithm ID
    const algorithmId = options?.algorithmId ||
                       this.selectOptimalAlgorithm(scope.mode, options) ||
                       serviceConfig.defaultAlgorithmId

    // Get base algorithm configuration (try mock config manager first for development)
    let baseConfig = await this.mockConfigManager.getConfiguration(algorithmId)

    if (!baseConfig) {
      console.warn(`Algorithm ${algorithmId} not found in mock config, trying main config manager`)
      baseConfig = await this.configManager.getConfiguration(algorithmId)
    }

    if (!baseConfig) {
      console.warn(`Algorithm ${algorithmId} not found, using fallback`)
      baseConfig = await this.mockConfigManager.getConfiguration(serviceConfig.fallbackAlgorithmId)

      if (!baseConfig) {
        baseConfig = await this.configManager.getConfiguration(serviceConfig.fallbackAlgorithmId)
      }
    }

    if (!baseConfig) {
      throw new Error(`Neither primary nor fallback algorithm configurations found`)
    }

    // Customize configuration based on selection request
    const customizedConfig: AlgorithmConfiguration = {
      ...baseConfig,
      id: `${baseConfig.id}_${Date.now()}`, // Unique execution ID

      // Customize universe based on scope
      universe: this.buildUniverseConfig(scope, baseConfig.universe),

      // Adjust weights based on options
      weights: this.adjustWeights(baseConfig.weights, options),

      // Configure data fusion based on options
      dataFusion: {
        ...baseConfig.dataFusion,
        minQualityScore: options?.dataPreferences?.minQualityScore || baseConfig.dataFusion.minQualityScore,
        requiredSources: options?.dataPreferences?.sources || baseConfig.dataFusion.requiredSources,
        cacheTTL: options?.useRealTimeData ? 0 : baseConfig.dataFusion.cacheTTL
      },

      // Adjust selection criteria based on scope
      selectionCriteria: this.determineSelectionCriteria(scope.mode),

      // Configure selection parameters
      selection: {
        ...baseConfig.selection,
        topN: scope.maxResults || baseConfig.selection.topN
      }
    }

    return customizedConfig
  }

  /**
   * Build algorithm execution context
   */
  private buildAlgorithmContext(request: SelectionRequest): AlgorithmContext {
    const { scope, options } = request

    return {
      algorithmId: options?.algorithmId || this.selectionConfig.getConfig().defaultAlgorithmId,
      runId: request.requestId || `run_${Date.now()}`,
      startTime: Date.now(),

      marketData: {
        timestamp: Date.now(),
        marketOpen: this.isMarketOpen(),
        volatilityIndex: 0.15, // This would be fetched from real data
        sectorRotation: {} // This would be calculated from market data
      },

      dataStatus: this.buildDataStatus(options),

      // Current positions would be provided by portfolio management
      currentPositions: undefined
    }
  }

  /**
   * Build universe configuration based on scope
   */
  private buildUniverseConfig(scope: AnalysisScope, baseUniverse: any): any {
    const universeConfig = { ...baseUniverse }

    switch (scope.mode) {
      case SelectionMode.SINGLE_STOCK:
      case SelectionMode.MULTIPLE_STOCKS:
        if (scope.symbols && scope.symbols.length > 0) {
          // For specific symbols, override universe settings
          universeConfig.maxPositions = scope.symbols.length
          universeConfig.excludeSymbols = scope.excludeSymbols || []
          // Universe will be filtered to these symbols in the engine
        }
        break

      case SelectionMode.SECTOR_ANALYSIS:
      case SelectionMode.INDEX_ANALYSIS:
      case SelectionMode.ETF_ANALYSIS:
        if (scope.sector) {
          universeConfig.sectors = [scope.sector.id]
          universeConfig.maxPositions = scope.maxResults || baseUniverse.maxPositions
        }
        break
    }

    return universeConfig
  }

  /**
   * Adjust algorithm weights based on options
   */
  private adjustWeights(baseWeights: any[], options?: SelectionOptions): any[] {
    if (!options?.customWeights) {
      return baseWeights
    }

    return baseWeights.map(weight => {
      const customWeight = { ...weight }

      // Apply custom weight multipliers
      if (options.customWeights?.technical && this.isTechnicalFactor(weight.factor)) {
        customWeight.weight *= options.customWeights.technical
      }
      if (options.customWeights?.fundamental && this.isFundamentalFactor(weight.factor)) {
        customWeight.weight *= options.customWeights.fundamental
      }
      if (options.customWeights?.sentiment && this.isSentimentFactor(weight.factor)) {
        customWeight.weight *= options.customWeights.sentiment
      }
      if (options.customWeights?.momentum && this.isMomentumFactor(weight.factor)) {
        customWeight.weight *= options.customWeights.momentum
      }

      // Normalize weights to maintain total
      return customWeight
    })
  }

  /**
   * Determine optimal selection criteria based on mode
   */
  private determineSelectionCriteria(mode: SelectionMode): SelectionCriteria {
    switch (mode) {
      case SelectionMode.SINGLE_STOCK:
        return SelectionCriteria.SCORE_BASED
      case SelectionMode.SECTOR_ANALYSIS:
        return SelectionCriteria.RANK_BASED
      case SelectionMode.MULTIPLE_STOCKS:
        return SelectionCriteria.SCORE_BASED
      case SelectionMode.INDEX_ANALYSIS:
      case SelectionMode.ETF_ANALYSIS:
        return SelectionCriteria.QUANTILE_BASED
      default:
        return SelectionCriteria.SCORE_BASED
    }
  }

  /**
   * Select optimal algorithm based on mode and options
   */
  private selectOptimalAlgorithm(mode: SelectionMode, options?: SelectionOptions): string | null {
    // Logic to select best algorithm based on analysis type
    if (options?.riskTolerance === 'conservative') {
      return 'quality'
    }
    if (options?.riskTolerance === 'aggressive') {
      return 'momentum'
    }

    switch (mode) {
      case SelectionMode.SECTOR_ANALYSIS:
        return 'sector_rotation'
      case SelectionMode.MULTIPLE_STOCKS:
        return 'composite'
      default:
        return null // Use default
    }
  }

  /**
   * Build data status for context
   */
  private buildDataStatus(options?: SelectionOptions): any {
    const serviceConfig = this.selectionConfig.getConfig()
    const dataStatus: any = {}

    for (const source of Object.keys(serviceConfig.dataSources)) {
      dataStatus[source] = {
        available: true, // This would be checked in real implementation
        latency: serviceConfig.dataSources[source].timeout / 2, // Estimated
        lastUpdate: Date.now() - (options?.useRealTimeData ? 0 : 60000) // 1 min ago if not real-time
      }
    }

    return dataStatus
  }

  /**
   * Enhance selection result with additional context
   */
  private enhanceSelectionResult(result: SelectionResult, request: SelectionRequest): SelectionResult {
    // Add request-specific enhancements
    return {
      ...result,
      algorithmId: `${result.algorithmId}_enhanced`,
      // Additional metadata could be added here
    }
  }

  /**
   * Build fallback configuration
   */
  private async buildFallbackConfiguration(request: SelectionRequest): Promise<AlgorithmConfiguration> {
    const fallbackAlgorithmId = this.selectionConfig.getConfig().fallbackAlgorithmId
    const fallbackRequest = {
      ...request,
      options: {
        ...request.options,
        algorithmId: fallbackAlgorithmId
      }
    }

    return await this.buildAlgorithmConfiguration(fallbackRequest)
  }

  /**
   * Validate algorithm configuration
   */
  validateConfiguration(config: AlgorithmConfiguration): boolean {
    try {
      // Basic validation checks
      if (!config.id || !config.name || !config.type) {
        return false
      }

      if (!config.universe || !config.weights || !config.selection) {
        return false
      }

      if (config.weights.length === 0) {
        return false
      }

      // Validate weights sum to reasonable total
      const totalWeight = config.weights
        .filter(w => w.enabled)
        .reduce((sum, w) => sum + w.weight, 0)

      if (totalWeight <= 0) {
        return false
      }

      return true
    } catch (error) {
      console.error('Configuration validation error:', error)
      return false
    }
  }

  /**
   * Get list of available algorithms
   */
  getAvailableAlgorithms(): string[] {
    const mockConfigs = this.mockConfigManager.getAvailableConfigurations()
    const mainConfigs = this.configManager ? [] : [] // Main config manager returns empty for now
    return [...mockConfigs, ...mainConfigs]
  }

  /**
   * Utility methods for factor classification
   */
  private isTechnicalFactor(factor: string): boolean {
    const technicalFactors = ['rsi', 'macd', 'moving_average', 'bollinger_bands', 'momentum', 'volatility']
    return technicalFactors.some(tf => factor.toLowerCase().includes(tf))
  }

  private isFundamentalFactor(factor: string): boolean {
    const fundamentalFactors = ['pe_ratio', 'pb_ratio', 'debt_equity', 'roe', 'revenue_growth', 'earnings']
    return fundamentalFactors.some(ff => factor.toLowerCase().includes(ff))
  }

  private isSentimentFactor(factor: string): boolean {
    const sentimentFactors = ['sentiment', 'news', 'social', 'analyst']
    return sentimentFactors.some(sf => factor.toLowerCase().includes(sf))
  }

  private isMomentumFactor(factor: string): boolean {
    const momentumFactors = ['momentum', 'trend', 'breakout', 'relative_strength']
    return momentumFactors.some(mf => factor.toLowerCase().includes(mf))
  }

  /**
   * Check if market is currently open
   */
  private isMarketOpen(): boolean {
    const now = new Date()
    const day = now.getDay()
    const hour = now.getHours()

    // Simple market hours check (US market: Mon-Fri, 9:30-16:00 ET)
    // This would be more sophisticated in real implementation
    return day >= 1 && day <= 5 && hour >= 9 && hour < 16
  }

  /**
   * Get algorithm engine statistics
   */
  getEngineStats() {
    return this.algorithmEngine.getEngineStats()
  }

  /**
   * Cancel execution if needed
   */
  cancelExecution(executionId: string): boolean {
    return this.algorithmEngine.cancelExecution(executionId)
  }
}