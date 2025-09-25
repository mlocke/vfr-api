/**
 * Algorithm Integration Layer for Stock Selection Service
 * Provides interface between StockSelectionService and AlgorithmEngine
 */

import { AlgorithmEngine } from '../../algorithms/AlgorithmEngine'
import { AlgorithmConfigManager } from '../../algorithms/AlgorithmConfigManager'
import { FactorLibrary } from '../../algorithms/FactorLibrary'
import { AlgorithmCache } from '../../algorithms/AlgorithmCache'
import { FallbackDataService } from '../../financial-data/FallbackDataService'
import SentimentAnalysisService from '../../financial-data/SentimentAnalysisService'
import { VWAPService } from '../../financial-data/VWAPService'
import { MacroeconomicAnalysisService } from '../../financial-data/MacroeconomicAnalysisService'
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
  SelectionOptions,
  AnalysisScope
} from '../types'
// Note: SelectionConfigManager replaced with inline config

/**
 * Algorithm integration and orchestration
 */
export class AlgorithmIntegration implements AlgorithmIntegrationInterface {
  private algorithmEngine: AlgorithmEngine
  private configManager: AlgorithmConfigManager
  private selectionConfig: any
  private factorLibrary: FactorLibrary
  private cache: AlgorithmCache

  constructor(
    fallbackDataService: FallbackDataService,
    factorLibrary: FactorLibrary,
    cache: AlgorithmCache,
    selectionConfig?: any,
    sentimentService?: SentimentAnalysisService,
    vwapService?: VWAPService,
    macroeconomicService?: MacroeconomicAnalysisService
  ) {
    this.factorLibrary = factorLibrary
    this.cache = cache
    this.selectionConfig = selectionConfig || this.createDefaultConfig()
    this.configManager = new AlgorithmConfigManager(factorLibrary, cache)
    // Pass all services to AlgorithmEngine for enhanced service integration
    this.algorithmEngine = new AlgorithmEngine(fallbackDataService, factorLibrary, cache, sentimentService, vwapService, macroeconomicService)
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

    // Get base algorithm configuration
    let baseConfig = await this.configManager.getConfiguration(algorithmId)

    if (!baseConfig) {
      console.warn(`Algorithm ${algorithmId} not found, using fallback`)
      baseConfig = await this.configManager.getConfiguration(serviceConfig.fallbackAlgorithmId)
    }

    if (!baseConfig) {
      throw new Error(`Neither primary nor fallback algorithm configurations found`)
    }

    // Customize configuration based on selection request
    console.log('🔧 Building customized config for:', algorithmId)
    console.log('📋 Base config keys:', Object.keys(baseConfig))
    console.log('🌌 Base universe:', baseConfig.universe)

    let universeConfig
    try {
      universeConfig = this.buildUniverseConfig(scope, baseConfig.universe)
      console.log('✅ Universe config built successfully:', universeConfig)
    } catch (error) {
      console.error('❌ Failed to build universe config:', error)
      console.error('🔍 Error details:', error instanceof Error ? error.message : String(error))
      throw error
    }

    const customizedConfig: AlgorithmConfiguration = {
      ...baseConfig,
      id: `${baseConfig.id}_${Date.now()}`, // Unique execution ID

      // Customize universe based on scope
      universe: universeConfig,

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

      // ✅ CRITICAL FIX: Add symbols to context so algorithm knows what to analyze
      symbols: scope.symbols || [],
      scope: {
        mode: scope.mode,
        symbols: scope.symbols,
        sector: scope.sector,
        maxResults: scope.maxResults
      },

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
    // Provide default universe config if baseUniverse is undefined
    const defaultUniverse = {
      maxPositions: 50,
      marketCapMin: 100000000,
      sectors: [],
      excludeSymbols: []
    }

    const universeConfig = { ...(baseUniverse || defaultUniverse) }

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

    // Get data sources from either dataSources property or getDataSourceConfig method
    let dataSources: any = null
    if (serviceConfig.dataSources) {
      dataSources = serviceConfig.dataSources
    } else if (serviceConfig.getDataSourceConfig && typeof serviceConfig.getDataSourceConfig === 'function') {
      dataSources = serviceConfig.getDataSourceConfig()
    }

    // Handle case where no data sources are available
    if (!dataSources || typeof dataSources !== 'object') {
      console.warn('No data sources available in service config, using default')
      dataSources = {
        'polygon': { priority: 1, weight: 1.0, timeout: 5000 },
        'alphavantage': { priority: 2, weight: 0.8, timeout: 5000 }
      }
    }

    for (const source of Object.keys(dataSources)) {
      dataStatus[source] = {
        available: true, // This would be checked in real implementation
        latency: dataSources[source].timeout / 2, // Estimated
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
    // Return default algorithms as we can't make this async per interface
    return ['momentum', 'value', 'quality', 'balanced']
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

  private createDefaultConfig(): any {
    return {
      getConfig: () => ({
        defaultAlgorithmId: 'composite',
        fallbackAlgorithmId: 'quality',
        limits: {
          maxSymbolsPerRequest: 50,
          maxConcurrentRequests: 10,
          defaultTimeout: 30000,
          maxTimeout: 60000
        }
      }),
      generateCacheKey: (prefix: string, options: any) => {
        const optionsStr = JSON.stringify(options || {})
        return `${prefix}:${Buffer.from(optionsStr).toString('base64').slice(0, 16)}`
      },
      getCacheTTL: (mode: any) => 300000, // 5 minutes default
      getDataSourceConfig: () => ({
        'polygon': { priority: 1, weight: 1.0, timeout: 5000 },
        'alphavantage': { priority: 2, weight: 0.8, timeout: 5000 }
      })
    }
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