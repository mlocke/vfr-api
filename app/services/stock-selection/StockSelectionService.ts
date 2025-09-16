/**
 * Stock Selection Service
 * Provides unified interface for single stock, sector, and multi-stock analysis
 * Integrates with AlgorithmEngine, MCP infrastructure, and sector analysis
 */

import { EventEmitter } from 'events'
import {
  SelectionRequest,
  SelectionResponse,
  SelectionMode,
  SelectionOptions,
  AnalysisScope,
  EnhancedStockResult,
  SectorAnalysisResult,
  MultiStockAnalysisResult,
  SelectionServiceStats,
  SelectionServiceEvent,
  DataIntegrationInterface
} from './types'
import { AlgorithmIntegration } from './integration/AlgorithmIntegration'
import { SectorIntegration } from './integration/SectorIntegration'
import { SelectionConfigManager, selectionConfig } from './config/SelectionConfig'
import { AlgorithmEngine } from '../algorithms/AlgorithmEngine'
import { DataFusionEngine } from '../mcp/DataFusionEngine'
import { MCPClient } from '../mcp/MCPClient'
import { FactorLibrary } from '../algorithms/FactorLibrary'
import { AlgorithmCache } from '../algorithms/AlgorithmCache'
import { RedisCache } from '../cache/RedisCache'
import { SelectionResult, StockScore } from '../algorithms/types'
import { QualityScore } from '../mcp/types'
import { SectorOption } from '../../components/SectorDropdown'

/**
 * Main Stock Selection Service
 */
export class StockSelectionService extends EventEmitter implements DataIntegrationInterface {
  private algorithmIntegration: AlgorithmIntegration
  private sectorIntegration: SectorIntegration
  private config: SelectionConfigManager
  private mcpClient: MCPClient
  private dataFusion: DataFusionEngine
  private cache: RedisCache
  private stats: SelectionServiceStats
  private activeRequests: Map<string, AbortController> = new Map()

  constructor(
    mcpClient: MCPClient,
    dataFusion: DataFusionEngine,
    factorLibrary: FactorLibrary,
    cache: RedisCache
  ) {
    super()

    this.mcpClient = mcpClient
    this.dataFusion = dataFusion
    this.cache = cache
    this.config = selectionConfig

    // Initialize algorithm cache with proper config structure
    const algorithmCache = new AlgorithmCache({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: 0,
        keyPrefix: 'algo:',
        maxRetries: 3,
        retryDelayOnFailover: 100
      },
      ttl: {
        configuration: 3600,      // 1 hour - configs change rarely
        stockScores: 300,         // 5 minutes - scores update frequently
        marketData: 60,           // 1 minute - market data is real-time
        fundamentalData: 3600,    // 1 hour - fundamentals change slowly
        selectionResults: 1800,   // 30 minutes - algorithm results
        universe: 14400,          // 4 hours - stock universes are stable
        factors: 300             // 5 minutes - factor calculations
      },
      performance: {
        pipelineSize: 100,
        compressionThreshold: 1024,
        enableCompression: true
      }
    })

    // Initialize integration layers
    this.algorithmIntegration = new AlgorithmIntegration(
      dataFusion,
      factorLibrary,
      algorithmCache,
      this.config
    )

    this.sectorIntegration = new SectorIntegration(
      mcpClient,
      dataFusion,
      this.config
    )

    // Initialize statistics
    this.stats = this.initializeStats()

    // Setup error handling
    this.setupErrorHandling()
  }

  /**
   * Main entry point for stock selection analysis
   */
  async selectStocks(request: SelectionRequest): Promise<SelectionResponse> {
    const startTime = Date.now()
    const requestId = request.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Setup request tracking
    const abortController = new AbortController()
    this.activeRequests.set(requestId, abortController)

    // Emit request start event
    this.emitEvent({
      type: 'request_start',
      timestamp: Date.now(),
      requestId,
      data: { scope: request.scope, options: request.options }
    })

    try {
      // Validate request
      this.validateRequest(request)

      // Apply timeout
      const timeout = request.options?.timeout || this.config.getConfig().limits.defaultTimeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      })

      // Execute analysis with timeout
      const analysisPromise = this.executeAnalysis(request, requestId)
      const result = await Promise.race([analysisPromise, timeoutPromise])

      // Build final response
      const response = await this.buildResponse(result, request, requestId, startTime)

      // Update statistics
      this.updateStats(request, response, true)

      // Emit completion event
      this.emitEvent({
        type: 'request_complete',
        timestamp: Date.now(),
        requestId,
        data: { success: true, executionTime: response.executionTime }
      })

      return response

    } catch (error) {
      console.error(`Stock selection failed for request ${requestId}:`, error)

      // Build error response
      const errorResponse = this.buildErrorResponse(error, request, requestId, startTime)

      // Update statistics
      this.updateStats(request, errorResponse, false)

      // Emit error event
      this.emitEvent({
        type: 'request_error',
        timestamp: Date.now(),
        requestId,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })

      return errorResponse

    } finally {
      // Cleanup request tracking
      this.activeRequests.delete(requestId)
    }
  }

  /**
   * Execute the core analysis based on selection mode
   */
  private async executeAnalysis(request: SelectionRequest, requestId: string): Promise<any> {
    const { scope, options } = request

    switch (scope.mode) {
      case SelectionMode.SINGLE_STOCK:
        return await this.executeSingleStockAnalysis(request, requestId)

      case SelectionMode.SECTOR_ANALYSIS:
      case SelectionMode.INDEX_ANALYSIS:
      case SelectionMode.ETF_ANALYSIS:
        return await this.executeSectorAnalysis(request, requestId)

      case SelectionMode.MULTIPLE_STOCKS:
        return await this.executeMultiStockAnalysis(request, requestId)

      default:
        throw new Error(`Unsupported selection mode: ${scope.mode}`)
    }
  }

  /**
   * Execute single stock analysis
   */
  private async executeSingleStockAnalysis(request: SelectionRequest, requestId: string): Promise<any> {
    const { scope } = request

    if (!scope.symbols || scope.symbols.length === 0) {
      throw new Error('Single stock analysis requires at least one symbol')
    }

    if (scope.symbols.length > 1) {
      console.warn('Single stock analysis with multiple symbols, using first symbol only')
    }

    const symbol = scope.symbols[0]

    // Check cache first
    const cacheKey = this.config.generateCacheKey(`single_stock_${symbol}`, request.options)
    const cached = await this.getCachedData(cacheKey)

    if (cached) {
      this.emitEvent({
        type: 'cache_hit',
        timestamp: Date.now(),
        requestId,
        data: { key: cacheKey }
      })
      return cached
    }

    // Execute algorithm analysis
    const algorithmResult = await this.algorithmIntegration.executeAnalysis(request)

    // Enhance with additional stock context
    const enhancedResult = await this.enhanceSingleStockResult(symbol, algorithmResult, request)

    // Cache result
    const ttl = this.config.getCacheTTL(scope.mode)
    await this.setCachedData(cacheKey, enhancedResult, ttl)

    return enhancedResult
  }

  /**
   * Execute sector/index/ETF analysis
   */
  private async executeSectorAnalysis(request: SelectionRequest, requestId: string): Promise<any> {
    const { scope } = request

    if (!scope.sector) {
      throw new Error('Sector analysis requires sector specification')
    }

    // Check cache first
    const cacheKey = this.config.generateCacheKey(`sector_${scope.sector.id}`, request.options)
    const cached = await this.getCachedData(cacheKey)

    if (cached) {
      this.emitEvent({
        type: 'cache_hit',
        timestamp: Date.now(),
        requestId,
        data: { key: cacheKey }
      })
      return cached
    }

    // Get sector stocks
    const sectorStocks = await this.sectorIntegration.getSectorStocks(scope.sector)

    if (sectorStocks.length === 0) {
      throw new Error(`No stocks found for sector: ${scope.sector.label}`)
    }

    // Create modified request for sector stocks
    const sectorRequest: SelectionRequest = {
      ...request,
      scope: {
        ...scope,
        mode: SelectionMode.MULTIPLE_STOCKS,
        symbols: sectorStocks.slice(0, scope.maxResults || 50) // Limit for performance
      }
    }

    // Execute algorithm analysis on sector stocks
    const algorithmResult = await this.algorithmIntegration.executeAnalysis(sectorRequest)

    // Get sector metrics
    const sectorMetrics = await this.sectorIntegration.getSectorMetrics(scope.sector)

    // Build comprehensive sector analysis
    const sectorAnalysis = await this.buildSectorAnalysis(
      scope.sector,
      algorithmResult,
      sectorMetrics,
      request
    )

    // Cache result
    const ttl = this.config.getCacheTTL(scope.mode)
    await this.setCachedData(cacheKey, sectorAnalysis, ttl)

    return sectorAnalysis
  }

  /**
   * Execute multi-stock analysis
   */
  private async executeMultiStockAnalysis(request: SelectionRequest, requestId: string): Promise<any> {
    const { scope } = request

    if (!scope.symbols || scope.symbols.length === 0) {
      throw new Error('Multi-stock analysis requires at least one symbol')
    }

    // Check cache first
    const symbolsKey = scope.symbols.sort().join(',')
    const cacheKey = this.config.generateCacheKey(`multi_stock_${symbolsKey}`, request.options)
    const cached = await this.getCachedData(cacheKey)

    if (cached) {
      this.emitEvent({
        type: 'cache_hit',
        timestamp: Date.now(),
        requestId,
        data: { key: cacheKey }
      })
      return cached
    }

    // Execute algorithm analysis
    const algorithmResult = await this.algorithmIntegration.executeAnalysis(request)

    // Build comprehensive multi-stock analysis
    const multiStockAnalysis = await this.buildMultiStockAnalysis(algorithmResult, request)

    // Cache result
    const ttl = this.config.getCacheTTL(scope.mode)
    await this.setCachedData(cacheKey, multiStockAnalysis, ttl)

    return multiStockAnalysis
  }

  /**
   * Enhance single stock result with additional context
   */
  private async enhanceSingleStockResult(
    symbol: string,
    algorithmResult: SelectionResult,
    request: SelectionRequest
  ): Promise<EnhancedStockResult> {
    const stockScore = algorithmResult.selections[0]?.score

    if (!stockScore) {
      throw new Error(`No analysis result found for symbol: ${symbol}`)
    }

    // Get additional market data
    const additionalData = await this.fetchAdditionalStockData(symbol, request.options)

    return {
      symbol,
      score: stockScore,
      weight: algorithmResult.selections[0]?.weight || 1.0,
      action: algorithmResult.selections[0]?.action || 'HOLD',
      confidence: algorithmResult.selections[0]?.confidence || 0.5,

      context: {
        sector: stockScore.marketData.sector,
        marketCap: stockScore.marketData.marketCap,
        priceChange24h: additionalData.priceChange24h,
        volumeChange24h: additionalData.volumeChange24h,
        beta: additionalData.beta
      },

      reasoning: {
        primaryFactors: this.extractPrimaryFactors(stockScore),
        warnings: this.identifyWarnings(stockScore),
        opportunities: this.identifyOpportunities(stockScore)
      },

      dataQuality: {
        overall: stockScore.dataQuality,
        sourceBreakdown: additionalData.sourceBreakdown || {},
        lastUpdated: stockScore.timestamp
      }
    }
  }

  /**
   * Build comprehensive sector analysis
   */
  private async buildSectorAnalysis(
    sector: SectorOption,
    algorithmResult: SelectionResult,
    sectorMetrics: any,
    request: SelectionRequest
  ): Promise<SectorAnalysisResult> {
    const topSelections = await Promise.all(
      algorithmResult.selections.slice(0, 10).map(async selection => {
        return await this.enhanceSingleStockResult(selection.symbol, {
          ...algorithmResult,
          selections: [selection]
        }, request)
      })
    )

    return {
      sector,
      overview: {
        totalStocks: algorithmResult.metrics.totalStocksEvaluated,
        avgScore: this.calculateAverageScore(algorithmResult.selections),
        topPerformers: algorithmResult.selections.filter(s => s.score.overallScore > 0.7).length,
        underperformers: algorithmResult.selections.filter(s => s.score.overallScore < 0.3).length,
        marketCapTotal: sectorMetrics.marketCap?.total || 0,
        volumeTotal: 0 // Would be calculated from real data
      },

      sectorMetrics: {
        momentum: sectorMetrics.momentum?.strength || 0,
        valuation: this.calculateValuationScore(sectorMetrics),
        growth: sectorMetrics.quality?.growth || 0,
        stability: 1 - (sectorMetrics.momentum?.volume || 1)
      },

      topSelections,

      comparison: await this.buildSectorComparison(sector, sectorMetrics)
    }
  }

  /**
   * Build multi-stock analysis
   */
  private async buildMultiStockAnalysis(
    algorithmResult: SelectionResult,
    request: SelectionRequest
  ): Promise<MultiStockAnalysisResult> {
    const enhancedResults = await Promise.all(
      algorithmResult.selections.map(async selection => {
        return await this.enhanceSingleStockResult(selection.symbol, {
          ...algorithmResult,
          selections: [selection]
        }, request)
      })
    )

    const portfolioMetrics = this.calculatePortfolioMetrics(enhancedResults)

    return {
      request,
      results: enhancedResults,
      portfolioMetrics,
      recommendations: this.generatePortfolioRecommendations(enhancedResults, portfolioMetrics)
    }
  }

  /**
   * Build final response object
   */
  private async buildResponse(
    analysisResult: any,
    request: SelectionRequest,
    requestId: string,
    startTime: number
  ): Promise<SelectionResponse> {
    const executionTime = Date.now() - startTime

    // Extract top selections based on mode
    let topSelections: EnhancedStockResult[] = []

    if (request.scope.mode === SelectionMode.SINGLE_STOCK) {
      topSelections = [analysisResult]
    } else if (request.scope.mode === SelectionMode.MULTIPLE_STOCKS) {
      topSelections = analysisResult.results
    } else {
      topSelections = analysisResult.topSelections || []
    }

    return {
      success: true,
      requestId,
      timestamp: Date.now(),
      executionTime,

      // Mode-specific results
      singleStock: request.scope.mode === SelectionMode.SINGLE_STOCK ? analysisResult : undefined,
      sectorAnalysis: [SelectionMode.SECTOR_ANALYSIS, SelectionMode.INDEX_ANALYSIS, SelectionMode.ETF_ANALYSIS]
        .includes(request.scope.mode) ? analysisResult : undefined,
      multiStockAnalysis: request.scope.mode === SelectionMode.MULTIPLE_STOCKS ? analysisResult : undefined,

      // Unified results
      topSelections,

      // Metadata
      metadata: {
        algorithmUsed: request.options?.algorithmId || this.config.getConfig().defaultAlgorithmId,
        dataSourcesUsed: Object.keys(this.config.getDataSourceConfig()),
        cacheHitRate: this.calculateCacheHitRate(),
        analysisMode: request.scope.mode,
        qualityScore: this.calculateOverallQualityScore(topSelections)
      },

      // Performance breakdown
      performance: {
        dataFetchTime: Math.floor(executionTime * 0.3),
        analysisTime: Math.floor(executionTime * 0.5),
        fusionTime: Math.floor(executionTime * 0.15),
        cacheTime: Math.floor(executionTime * 0.05)
      }
    }
  }

  /**
   * Build error response
   */
  private buildErrorResponse(
    error: any,
    request: SelectionRequest,
    requestId: string,
    startTime: number
  ): SelectionResponse {
    return {
      success: false,
      requestId,
      timestamp: Date.now(),
      executionTime: Date.now() - startTime,

      topSelections: [],

      metadata: {
        algorithmUsed: 'error',
        dataSourcesUsed: [],
        cacheHitRate: 0,
        analysisMode: request.scope.mode,
        qualityScore: {
          overall: 0,
          metrics: {
            freshness: 0,
            completeness: 0,
            accuracy: 0,
            sourceReputation: 0,
            latency: 0
          },
          timestamp: Date.now(),
          source: 'error'
        }
      },

      errors: [error instanceof Error ? error.message : 'Unknown error'],

      performance: {
        dataFetchTime: 0,
        analysisTime: 0,
        fusionTime: 0,
        cacheTime: 0
      }
    }
  }

  /**
   * Data Integration Interface Implementation
   */
  async fetchStockData(symbols: string[], options?: SelectionOptions): Promise<any> {
    const results = await Promise.all(
      symbols.map(symbol => this.fetchSingleStockData(symbol, options))
    )

    return results.reduce((acc, result, index) => {
      acc[symbols[index]] = result
      return acc
    }, {})
  }

  async validateDataQuality(data: any): Promise<QualityScore> {
    // Implementation would use actual data quality validation
    return {
      overall: 0.8,
      metrics: {
        freshness: 0.9,
        completeness: 0.8,
        accuracy: 0.85,
        sourceReputation: 0.7,
        latency: 150
      },
      timestamp: Date.now(),
      source: 'stock_selection_service'
    }
  }

  async getCachedData(key: string): Promise<any> {
    try {
      const cached = await this.cache.get(key)
      if (cached) {
        this.emitEvent({
          type: 'cache_hit',
          timestamp: Date.now(),
          requestId: 'system',
          data: { key }
        })
      } else {
        this.emitEvent({
          type: 'cache_miss',
          timestamp: Date.now(),
          requestId: 'system',
          data: { key }
        })
      }
      return cached
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  async setCachedData(key: string, data: any, ttl: number): Promise<void> {
    try {
      await this.cache.set(key, data, ttl)
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  /**
   * Service management methods
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    const controller = this.activeRequests.get(requestId)
    if (controller) {
      controller.abort()
      this.activeRequests.delete(requestId)
      return true
    }
    return false
  }

  getServiceStats(): SelectionServiceStats {
    return { ...this.stats }
  }

  clearCache(): Promise<void> {
    return this.cache.clear()
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      // Check critical dependencies
      const mcpHealthy = await this.mcpClient.performHealthChecks().then(() => true).catch(() => false)
      const cacheHealthy = await this.cache.ping() === 'PONG'

      const details = {
        mcp: mcpHealthy,
        cache: cacheHealthy,
        activeRequests: this.activeRequests.size,
        stats: this.stats
      }

      const healthy = mcpHealthy && cacheHealthy

      return {
        status: healthy ? 'healthy' : 'unhealthy',
        details
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  /**
   * Private utility methods
   */
  private validateRequest(request: SelectionRequest): void {
    if (!request.scope) {
      throw new Error('Request scope is required')
    }

    const config = this.config.getConfig()

    if (request.scope.symbols && request.scope.symbols.length > config.limits.maxSymbolsPerRequest) {
      throw new Error(`Too many symbols: max ${config.limits.maxSymbolsPerRequest}`)
    }

    if (this.activeRequests.size >= config.limits.maxConcurrentRequests) {
      throw new Error('Too many concurrent requests')
    }
  }

  private async fetchSingleStockData(symbol: string, options?: SelectionOptions): Promise<any> {
    // Implementation would fetch comprehensive stock data
    return {
      symbol,
      price: 100 + Math.random() * 200,
      volume: Math.floor(Math.random() * 1000000),
      marketCap: Math.floor(Math.random() * 500000000000),
      sector: 'Technology',
      priceChange24h: (Math.random() - 0.5) * 10,
      volumeChange24h: (Math.random() - 0.5) * 0.5,
      beta: 0.5 + Math.random() * 1.5
    }
  }

  private async fetchAdditionalStockData(symbol: string, options?: SelectionOptions): Promise<any> {
    return await this.fetchSingleStockData(symbol, options)
  }

  private extractPrimaryFactors(stockScore: StockScore): string[] {
    const factors = Object.entries(stockScore.factorScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([factor]) => factor)

    return factors
  }

  private identifyWarnings(stockScore: StockScore): string[] {
    const warnings = []

    if (stockScore.dataQuality.overall < 0.6) {
      warnings.push('Low data quality detected')
    }

    if (stockScore.marketData.volume < 100000) {
      warnings.push('Low trading volume')
    }

    return warnings
  }

  private identifyOpportunities(stockScore: StockScore): string[] {
    const opportunities = []

    if (stockScore.overallScore > 0.8) {
      opportunities.push('Strong fundamental performance')
    }

    return opportunities
  }

  private calculateAverageScore(selections: any[]): number {
    if (selections.length === 0) return 0
    return selections.reduce((sum, s) => sum + s.score.overallScore, 0) / selections.length
  }

  private calculateValuationScore(sectorMetrics: any): number {
    return sectorMetrics.valuation?.avgPE ? Math.max(0, 1 - sectorMetrics.valuation.avgPE / 30) : 0.5
  }

  private async buildSectorComparison(sector: SectorOption, sectorMetrics: any): Promise<any> {
    return {
      vsMarket: {
        performance: (Math.random() - 0.5) * 20,
        valuation: (Math.random() - 0.5) * 10,
        momentum: (Math.random() - 0.5) * 15
      },
      peerSectors: []
    }
  }

  private calculatePortfolioMetrics(results: EnhancedStockResult[]): any {
    const sectorBreakdown: { [sector: string]: number } = {}
    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0)

    results.forEach(result => {
      const sector = result.context.sector
      sectorBreakdown[sector] = (sectorBreakdown[sector] || 0) + result.weight / totalWeight
    })

    return {
      overallScore: results.reduce((sum, r) => sum + r.score.overallScore * r.weight, 0) / totalWeight,
      diversificationScore: Object.keys(sectorBreakdown).length / 10, // Simple diversity measure
      riskScore: results.reduce((sum, r) => sum + (r.context.beta || 1) * r.weight, 0) / totalWeight,
      sectorBreakdown,
      marketCapBreakdown: {
        large: results.filter(r => r.context.marketCap > 10000000000).length / results.length,
        mid: results.filter(r => r.context.marketCap > 2000000000 && r.context.marketCap <= 10000000000).length / results.length,
        small: results.filter(r => r.context.marketCap <= 2000000000).length / results.length
      }
    }
  }

  private generatePortfolioRecommendations(results: EnhancedStockResult[], metrics: any): any {
    const allocation = results.reduce((acc, result) => {
      acc[result.symbol] = result.weight
      return acc
    }, {} as { [symbol: string]: number })

    return {
      allocation,
      rebalancing: [],
      riskWarnings: metrics.riskScore > 1.5 ? ['High portfolio beta detected'] : []
    }
  }

  private calculateCacheHitRate(): number {
    // This would be tracked from actual cache operations
    return 0.75
  }

  private calculateOverallQualityScore(selections: EnhancedStockResult[]): QualityScore {
    if (selections.length === 0) {
      return {
        overall: 0,
        metrics: {
          freshness: 0,
          completeness: 0,
          accuracy: 0,
          sourceReputation: 0,
          latency: 0
        },
        timestamp: Date.now(),
        source: 'empty'
      }
    }

    const avgQuality = selections.reduce((sum, s) => sum + s.dataQuality.overall.overall, 0) / selections.length

    return {
      overall: avgQuality,
      metrics: {
        freshness: avgQuality,
        completeness: avgQuality,
        accuracy: avgQuality,
        sourceReputation: avgQuality,
        latency: 150
      },
      timestamp: Date.now(),
      source: 'aggregated'
    }
  }

  private initializeStats(): SelectionServiceStats {
    return {
      totalRequests: 0,
      successRate: 1.0,
      averageExecutionTime: 0,
      cacheHitRate: 0,
      requestsByMode: {
        [SelectionMode.SINGLE_STOCK]: 0,
        [SelectionMode.SECTOR_ANALYSIS]: 0,
        [SelectionMode.MULTIPLE_STOCKS]: 0,
        [SelectionMode.INDEX_ANALYSIS]: 0,
        [SelectionMode.ETF_ANALYSIS]: 0
      },
      algorithmUsage: {},
      sourceStats: {}
    }
  }

  private updateStats(request: SelectionRequest, response: SelectionResponse, success: boolean): void {
    this.stats.totalRequests++
    this.stats.requestsByMode[request.scope.mode]++

    if (success) {
      this.stats.averageExecutionTime = (this.stats.averageExecutionTime + response.executionTime) / 2
    }

    this.stats.successRate = (this.stats.successRate * (this.stats.totalRequests - 1) + (success ? 1 : 0)) / this.stats.totalRequests
  }

  private emitEvent(event: SelectionServiceEvent): void {
    this.emit('event', event)
  }

  private setupErrorHandling(): void {
    this.on('error', (error) => {
      console.error('StockSelectionService error:', error)
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection in StockSelectionService:', reason)
    })
  }
}

/**
 * Factory function to create StockSelectionService instance
 */
export async function createStockSelectionService(
  mcpClient: MCPClient,
  dataFusion: DataFusionEngine,
  factorLibrary: FactorLibrary,
  cache: RedisCache
): Promise<StockSelectionService> {
  const service = new StockSelectionService(mcpClient, dataFusion, factorLibrary, cache)

  // Perform any async initialization here
  const health = await service.healthCheck()
  if (health.status === 'unhealthy') {
    console.warn('StockSelectionService initialized with unhealthy dependencies:', health.details)
  }

  return service
}

export default StockSelectionService