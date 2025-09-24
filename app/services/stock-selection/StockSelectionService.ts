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
import { financialDataService, StockData } from '../financial-data'
import { SectorOption } from '../../components/SectorDropdown'
import { AlgorithmIntegration } from './integration/AlgorithmIntegration'
import { SectorIntegration } from './integration/SectorIntegration'
import { QualityScore } from '../types/core-types'
import { FallbackDataService } from '../financial-data/FallbackDataService'
import { RedisCache } from '../cache/RedisCache'
import { FactorLibrary } from '../algorithms/FactorLibrary'
import { AlgorithmCache } from '../algorithms/AlgorithmCache'
import { SelectionResult, StockScore } from '../algorithms/types'
import { TechnicalIndicatorService } from '../technical-analysis/TechnicalIndicatorService'
import SecurityValidator from '../security/SecurityValidator'
import { MacroeconomicAnalysisService } from '../financial-data/MacroeconomicAnalysisService'
import SentimentAnalysisService from '../financial-data/SentimentAnalysisService'
import { VWAPService } from '../financial-data/VWAPService'
import ESGDataService from '../financial-data/ESGDataService'
import ShortInterestService from '../financial-data/ShortInterestService'
import { ExtendedMarketDataService } from '../financial-data/ExtendedMarketDataService'
import ErrorHandler from '../error-handling/ErrorHandler'

/**
 * Main Stock Selection Service
 */
export class StockSelectionService extends EventEmitter implements DataIntegrationInterface {
  private algorithmIntegration: AlgorithmIntegration
  private sectorIntegration: SectorIntegration
  private config: any
  private fallbackDataService: FallbackDataService
  private cache: RedisCache
  private stats: SelectionServiceStats
  private activeRequests: Map<string, AbortController> = new Map()
  private macroeconomicService?: MacroeconomicAnalysisService
  private sentimentService?: SentimentAnalysisService
  private vwapService?: VWAPService
  private esgService?: ESGDataService
  private shortInterestService?: ShortInterestService
  private extendedMarketService?: ExtendedMarketDataService
  private errorHandler: ErrorHandler

  constructor(
    fallbackDataService: FallbackDataService,
    factorLibrary: FactorLibrary,
    cache: RedisCache,
    technicalService?: TechnicalIndicatorService,
    macroeconomicService?: MacroeconomicAnalysisService,
    sentimentService?: SentimentAnalysisService,
    vwapService?: VWAPService,
    esgService?: ESGDataService,
    shortInterestService?: ShortInterestService,
    extendedMarketService?: ExtendedMarketDataService
  ) {
    super()

    this.fallbackDataService = fallbackDataService
    this.cache = cache
    this.config = this.createDefaultConfig()
    this.macroeconomicService = macroeconomicService
    this.sentimentService = sentimentService
    this.vwapService = vwapService
    this.esgService = esgService
    this.shortInterestService = shortInterestService
    this.extendedMarketService = extendedMarketService
    this.errorHandler = ErrorHandler.getInstance()

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

    // Initialize FactorLibrary with technical service if available
    if (technicalService) {
      // Create enhanced FactorLibrary with technical analysis
      const enhancedFactorLibrary = new FactorLibrary(technicalService)

      // Initialize integration layers with enhanced FactorLibrary
      this.algorithmIntegration = new AlgorithmIntegration(
        this.fallbackDataService,
        enhancedFactorLibrary,
        algorithmCache,
        this.config
      )
    } else {
      // Initialize integration layers with standard FactorLibrary
      this.algorithmIntegration = new AlgorithmIntegration(
        this.fallbackDataService,
        factorLibrary,
        algorithmCache,
        this.config
      )
    }

    this.sectorIntegration = new SectorIntegration(
      this.fallbackDataService,
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

    // Setup request tracking with automatic cleanup
    const abortController = new AbortController()
    this.activeRequests.set(requestId, abortController)

    // Auto-cleanup stale requests every 10 requests to prevent memory leaks
    if (this.activeRequests.size % 10 === 0) {
      this.cleanupStaleRequests()
    }

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

    // Get macroeconomic analysis if service is available
    let macroImpact = null
    let adjustedScore = stockScore
    if (this.macroeconomicService) {
      try {
        macroImpact = await this.macroeconomicService.analyzeStockMacroImpact(
          symbol,
          stockScore.marketData.sector,
          stockScore.overallScore
        )
        if (macroImpact) {
          // Update the stock score with macro-adjusted score
          adjustedScore = {
            ...stockScore,
            overallScore: macroImpact.adjustedScore
          }
        }
      } catch (error) {
        console.warn(`Macroeconomic analysis failed for ${symbol}:`, error)
      }
    }

    // Get sentiment analysis if service is available
    let sentimentImpact = null
    if (this.sentimentService) {
      try {
        sentimentImpact = await this.sentimentService.analyzeStockSentimentImpact(
          symbol,
          stockScore.marketData.sector,
          adjustedScore.overallScore // Use macro-adjusted score as base
        )
        if (sentimentImpact) {
          // Update the stock score with sentiment-adjusted score
          adjustedScore = {
            ...adjustedScore,
            overallScore: sentimentImpact.adjustedScore
          }
        }
      } catch (error) {
        console.warn(`Sentiment analysis failed for ${symbol}:`, error)
      }
    }

    // Get ESG analysis if service is available
    let esgImpact = null
    if (this.esgService) {
      try {
        esgImpact = await this.esgService.getESGImpactForStock(
          symbol,
          stockScore.marketData.sector,
          adjustedScore.overallScore // Use sentiment-adjusted score as base
        )
        if (esgImpact) {
          // Update the stock score with ESG-adjusted score
          adjustedScore = {
            ...adjustedScore,
            overallScore: esgImpact.adjustedScore
          }
        }
      } catch (error) {
        console.warn(`ESG analysis failed for ${symbol}:`, error)
      }
    }

    // Get Short Interest analysis if service is available
    let shortInterestImpact = null
    if (this.shortInterestService) {
      try {
        shortInterestImpact = await this.shortInterestService.getShortInterestImpactForStock(
          symbol,
          stockScore.marketData.sector,
          adjustedScore.overallScore // Use ESG-adjusted score as base
        )
        if (shortInterestImpact) {
          // Update the stock score with short interest adjusted score
          adjustedScore = {
            ...adjustedScore,
            overallScore: shortInterestImpact.adjustedScore
          }
        }
      } catch (error) {
        console.warn(`Short interest analysis failed for ${symbol}:`, error)
      }
    }

    return {
      symbol,
      score: adjustedScore,
      weight: algorithmResult.selections[0]?.weight || 1.0,
      action: algorithmResult.selections[0]?.action || 'HOLD',
      confidence: algorithmResult.selections[0]?.confidence || 0.5,

      context: {
        sector: stockScore.marketData.sector,
        marketCap: stockScore.marketData.marketCap,
        priceChange24h: additionalData.priceChange24h,
        volumeChange24h: additionalData.volumeChange24h,
        beta: additionalData.beta
      } as any,

      reasoning: {
        primaryFactors: this.extractPrimaryFactors(stockScore),
        warnings: this.identifyWarnings(stockScore, additionalData, macroImpact, sentimentImpact, esgImpact),
        opportunities: this.identifyOpportunities(stockScore, additionalData, macroImpact, sentimentImpact, esgImpact)
      } as any,

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
   * Data Integration Interface Implementation with streaming optimization
   */
  async fetchStockData(symbols: string[], options?: SelectionOptions): Promise<any> {
    // Use chunked processing for large symbol sets to reduce memory pressure
    const chunkSize = 20 // Process 20 symbols at a time
    const results: { [symbol: string]: any } = {}

    if (symbols.length <= chunkSize) {
      // Small batch - process all at once with Promise.allSettled
      const promises = symbols.map(symbol => this.fetchSingleStockData(symbol, options))
      const settledResults = await Promise.allSettled(promises)

      settledResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results[symbols[index]] = result.value
        } else {
          console.warn(`Failed to fetch data for ${symbols[index]}:`, result.reason)
          results[symbols[index]] = null
        }
      })
    } else {
      // Large batch - process in chunks to manage memory and API rate limits
      console.log(`Processing ${symbols.length} symbols in chunks of ${chunkSize}`)

      for (let i = 0; i < symbols.length; i += chunkSize) {
        const chunk = symbols.slice(i, i + chunkSize)
        const chunkPromises = chunk.map(symbol => this.fetchSingleStockData(symbol, options))
        const chunkResults = await Promise.allSettled(chunkPromises)

        chunkResults.forEach((result, chunkIndex) => {
          const symbol = chunk[chunkIndex]
          if (result.status === 'fulfilled') {
            results[symbol] = result.value
          } else {
            console.warn(`Failed to fetch data for ${symbol}:`, result.reason)
            results[symbol] = null
          }
        })

        // Brief pause between chunks to respect rate limits
        if (i + chunkSize < symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }

    return results
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
      const dataServiceHealthy = await this.fallbackDataService.healthCheck().catch(() => false)
      const cacheHealthy = await this.cache.ping() === 'PONG'

      const details = {
        dataService: dataServiceHealthy,
        cache: cacheHealthy,
        activeRequests: this.activeRequests.size,
        memoryUsage: this.getMemoryUsage(),
        stats: this.stats
      }

      const healthy = dataServiceHealthy && cacheHealthy

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
   * Get current memory usage for performance monitoring
   */
  private getMemoryUsage(): { used: string; total: string; activeRequests: number } {
    const memUsage = process.memoryUsage()
    return {
      used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      activeRequests: this.activeRequests.size
    }
  }

  /**
   * Performance monitoring method for tracking optimization impact
   */
  getPerformanceMetrics(): {
    cacheHitRate: number
    averageExecutionTime: number
    activeRequestsCount: number
    memoryUsage: ReturnType<StockSelectionService['getMemoryUsage']>
    successRate: number
  } {
    return {
      cacheHitRate: this.calculateCacheHitRate(),
      averageExecutionTime: this.stats.averageExecutionTime,
      activeRequestsCount: this.activeRequests.size,
      memoryUsage: this.getMemoryUsage(),
      successRate: this.stats.successRate
    }
  }

  /**
   * Cleanup stale requests to prevent memory leaks
   */
  private cleanupStaleRequests(): void {
    const now = Date.now()
    const staleThreshold = 5 * 60 * 1000 // 5 minutes

    for (const [requestId, controller] of this.activeRequests.entries()) {
      // Extract timestamp from requestId (format: req_timestamp_random)
      const timestampMatch = requestId.match(/req_(\d+)_/)
      if (timestampMatch) {
        const requestTime = parseInt(timestampMatch[1])
        if (now - requestTime > staleThreshold) {
          console.warn(`Cleaning up stale request: ${requestId}`, {
            requestId,
            age: now - requestTime,
            threshold: staleThreshold
          })
          controller.abort()
          this.activeRequests.delete(requestId)
        }
      }
    }
  }

  /**
   * Private utility methods with security validation
   */
  private validateRequest(request: SelectionRequest): void {
    if (!request.scope) {
      throw new Error('Request scope is required')
    }

    const config = this.config.getConfig()

    // Validate symbols if provided
    if (request.scope.symbols) {
      const batchValidation = SecurityValidator.validateSymbolBatch(
        request.scope.symbols,
        config.limits.maxSymbolsPerRequest
      )

      if (!batchValidation.isValid) {
        const sanitizedError = SecurityValidator.sanitizeErrorMessage(
          `Invalid symbols in request: ${batchValidation.errors.join(', ')}`
        )
        throw new Error(sanitizedError)
      }

      // Replace with sanitized symbols
      request.scope.symbols = JSON.parse(batchValidation.sanitized!)
    }

    if (this.activeRequests.size >= config.limits.maxConcurrentRequests) {
      throw new Error('Too many concurrent requests')
    }
  }

  private async fetchSingleStockData(symbol: string, options?: SelectionOptions): Promise<any> {
    try {
      const { sanitizedSymbol, serviceId } = this.validateAndPrepareSymbol(symbol)
      this.checkRateLimits(serviceId, sanitizedSymbol)

      const rawData = await this.fetchRawStockData(sanitizedSymbol)
      this.validateCoreData(rawData, serviceId, sanitizedSymbol)

      SecurityValidator.recordSuccess(serviceId)
      return this.transformStockData(rawData, sanitizedSymbol)
    } catch (error) {
      const sanitizedError = SecurityValidator.sanitizeErrorMessage(error)
      console.error(`Error fetching real data: ${sanitizedError}`)
      throw new Error(sanitizedError)
    }
  }

  /**
   * Validate symbol and prepare service identifiers
   */
  private validateAndPrepareSymbol(symbol: string): { sanitizedSymbol: string; serviceId: string } {
    const symbolValidation = SecurityValidator.validateSymbol(symbol)
    if (!symbolValidation.isValid) {
      const sanitizedError = SecurityValidator.sanitizeErrorMessage(
        `Invalid symbol for stock data fetch: ${symbolValidation.errors.join(', ')}`
      )
      throw new Error(sanitizedError)
    }

    const sanitizedSymbol = symbolValidation.sanitized!
    const serviceId = `stock_data_${sanitizedSymbol}`

    return { sanitizedSymbol, serviceId }
  }

  /**
   * Check rate limits for stock data requests
   */
  private checkRateLimits(serviceId: string, sanitizedSymbol: string): void {
    const rateLimitCheck = SecurityValidator.checkRateLimit(serviceId)
    if (!rateLimitCheck.allowed) {
      const resetTime = rateLimitCheck.resetTime ? new Date(rateLimitCheck.resetTime).toISOString() : 'unknown'
      throw new Error(`Rate limit exceeded for ${sanitizedSymbol}, reset at: ${resetTime}`)
    }
  }

  /**
   * Fetch all raw stock data in parallel
   */
  private async fetchRawStockData(sanitizedSymbol: string): Promise<any> {
    const dataPromises = [
      financialDataService.getStockPrice(sanitizedSymbol),
      financialDataService.getCompanyInfo(sanitizedSymbol),
      financialDataService.getMarketData(sanitizedSymbol),
      financialDataService.getFundamentalRatios?.(sanitizedSymbol) ?? Promise.resolve(null),
      financialDataService.getAnalystRatings?.(sanitizedSymbol) ?? Promise.resolve(null),
      financialDataService.getPriceTargets?.(sanitizedSymbol) ?? Promise.resolve(null),
      this.vwapService?.getVWAPAnalysis?.(sanitizedSymbol) ?? Promise.resolve(null),
      financialDataService.getExtendedHoursData?.(sanitizedSymbol) ?? Promise.resolve(null)
    ]

    const results = await Promise.allSettled(dataPromises)
    return this.extractDataFromResults(results, sanitizedSymbol)
  }

  /**
   * Extract fulfilled data values from Promise.allSettled results
   */
  private extractDataFromResults(results: PromiseSettledResult<any>[], sanitizedSymbol: string): any {
    const dataTypes = ['stockPrice', 'companyInfo', 'marketData', 'fundamentalRatios', 'analystRatings', 'priceTargets', 'vwapAnalysis', 'extendedHoursData']

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        const dataType = dataTypes[index]
        const sanitizedError = SecurityValidator.sanitizeErrorMessage(result.reason)
        console.warn(`Failed to fetch ${dataType} for ${sanitizedSymbol}: ${sanitizedError}`)
        return null
      }
    })
  }

  /**
   * Validate that core data requirements are met
   */
  private validateCoreData(rawData: any[], serviceId: string, sanitizedSymbol: string): void {
    const [stockPrice, companyInfo, marketData] = rawData

    if (!stockPrice || !companyInfo || !marketData) {
      SecurityValidator.recordFailure(serviceId)
      throw new Error(`Incomplete data for ${sanitizedSymbol}: missing core financial data`)
    }
  }

  /**
   * Transform raw data into standardized stock data format
   */
  private transformStockData(rawData: any[], sanitizedSymbol: string): any {
    const [stockPrice, companyInfo, marketData, fundamentalRatios, analystRatings, priceTargets, vwapAnalysis, extendedHoursData] = rawData

    return {
      symbol: stockPrice.symbol,
      price: stockPrice.price,
      volume: marketData.volume,
      marketCap: companyInfo.marketCap,
      sector: companyInfo.sector,
      ...this.calculatePriceChanges(stockPrice, marketData, companyInfo),
      beta: 1.0,
      analystData: this.formatAnalystData(analystRatings),
      priceTargets: this.formatPriceTargets(priceTargets),
      fundamentalRatios: fundamentalRatios ? this.validateFundamentalRatios(fundamentalRatios, sanitizedSymbol) : null,
      vwapAnalysis: vwapAnalysis || null,
      // Extended hours data integration
      preMarketPrice: extendedHoursData?.preMarketPrice,
      preMarketChange: extendedHoursData?.preMarketChange,
      preMarketChangePercent: extendedHoursData?.preMarketChangePercent,
      afterHoursPrice: extendedHoursData?.afterHoursPrice,
      afterHoursChange: extendedHoursData?.afterHoursChange,
      afterHoursChangePercent: extendedHoursData?.afterHoursChangePercent,
      marketStatus: extendedHoursData?.marketStatus || 'closed',
      sourceBreakdown: this.createSourceBreakdown(stockPrice, companyInfo, marketData, fundamentalRatios, analystRatings, priceTargets, vwapAnalysis, extendedHoursData),
      lastUpdated: Date.now()
    }
  }

  /**
   * Calculate price and volume changes
   */
  private calculatePriceChanges(stockPrice: any, marketData: any, companyInfo: any): { priceChange24h: number; volumeChange24h: number } {
    const priceChange24h = stockPrice.change || 0
    const volumeChange24h = marketData.volume && companyInfo.marketCap
      ? (marketData.volume / (companyInfo.marketCap / stockPrice.price * 0.02)) - 1
      : 0

    return { priceChange24h, volumeChange24h }
  }

  /**
   * Format analyst data for response
   */
  private formatAnalystData(analystRatings: any): any {
    if (!analystRatings) return null

    return {
      consensus: analystRatings.consensus,
      totalAnalysts: analystRatings.totalAnalysts,
      sentimentScore: analystRatings.sentimentScore,
      distribution: {
        strongBuy: analystRatings.strongBuy,
        buy: analystRatings.buy,
        hold: analystRatings.hold,
        sell: analystRatings.sell,
        strongSell: analystRatings.strongSell
      }
    }
  }

  /**
   * Format price targets for response
   */
  private formatPriceTargets(priceTargets: any): any {
    if (!priceTargets) return null

    return {
      consensus: priceTargets.targetConsensus,
      high: priceTargets.targetHigh,
      low: priceTargets.targetLow,
      upside: priceTargets.upside,
      currentPrice: priceTargets.currentPrice
    }
  }

  /**
   * Create source breakdown for data quality tracking
   */
  private createSourceBreakdown(stockPrice: any, companyInfo: any, marketData: any, fundamentalRatios: any, analystRatings: any, priceTargets: any, vwapAnalysis?: any, extendedHoursData?: any): any {
    return {
      stockPrice: stockPrice.source,
      companyInfo: companyInfo ? 'available' : 'missing',
      marketData: marketData.source,
      fundamentalRatios: fundamentalRatios?.source || 'unavailable',
      analystRatings: analystRatings?.source || 'unavailable',
      priceTargets: priceTargets?.source || 'unavailable',
      vwapAnalysis: vwapAnalysis ? 'available' : 'unavailable',
      extendedHoursData: extendedHoursData ? 'available' : 'unavailable'
    }
  }

  /**
   * Validate fundamental ratios data for security and data integrity
   */
  private validateFundamentalRatios(fundamentalRatios: any, symbol: string): any {
    if (!this.validateFundamentalRatiosStructure(fundamentalRatios, symbol)) {
      return null
    }

    return this.sanitizeFundamentalRatiosFields(fundamentalRatios, symbol)
  }

  /**
   * Validate fundamental ratios response structure
   */
  private validateFundamentalRatiosStructure(fundamentalRatios: any, symbol: string): boolean {
    if (!fundamentalRatios || typeof fundamentalRatios !== 'object') {
      return false
    }

    const responseValidation = SecurityValidator.validateApiResponse(fundamentalRatios, [
      'symbol', 'timestamp', 'source'
    ])

    if (!responseValidation.isValid) {
      console.warn(`Invalid fundamental ratios structure for ${symbol}: ${responseValidation.errors.join(', ')}`)
      return false
    }

    return true
  }

  /**
   * Sanitize and validate all fundamental ratio numeric fields
   */
  private sanitizeFundamentalRatiosFields(fundamentalRatios: any, symbol: string): any {
    const ratioFields = this.getFundamentalRatioFieldsConfig()
    const sanitizedRatios: any = {}

    ratioFields.forEach(({ field, allowNegative }) => {
      sanitizedRatios[field] = this.validateRatioField(
        fundamentalRatios[field],
        field,
        symbol,
        allowNegative
      )
    })

    sanitizedRatios.period = fundamentalRatios.period || 'ttm'
    return sanitizedRatios
  }

  /**
   * Get configuration for fundamental ratio fields
   */
  private getFundamentalRatioFieldsConfig(): Array<{ field: string; allowNegative: boolean }> {
    return [
      { field: 'peRatio', allowNegative: false },
      { field: 'pegRatio', allowNegative: false },
      { field: 'pbRatio', allowNegative: false },
      { field: 'priceToSales', allowNegative: false },
      { field: 'priceToFreeCashFlow', allowNegative: false },
      { field: 'debtToEquity', allowNegative: false },
      { field: 'currentRatio', allowNegative: false },
      { field: 'quickRatio', allowNegative: false },
      { field: 'roe', allowNegative: true },
      { field: 'roa', allowNegative: true },
      { field: 'grossProfitMargin', allowNegative: true },
      { field: 'operatingMargin', allowNegative: true },
      { field: 'netProfitMargin', allowNegative: true },
      { field: 'dividendYield', allowNegative: false },
      { field: 'payoutRatio', allowNegative: false }
    ]
  }

  /**
   * Validate and sanitize a single ratio field
   */
  private validateRatioField(
    value: any,
    fieldName: string,
    symbol: string,
    allowNegative: boolean = false
  ): number | undefined {
    if (value === null || value === undefined) {
      return undefined
    }

    const validation = SecurityValidator.validateNumeric(value, {
      allowNegative,
      allowZero: true,
      min: allowNegative ? undefined : 0,
      max: fieldName.includes('Margin') || fieldName === 'payoutRatio' ? 100 : undefined,
      decimalPlaces: 6
    })

    if (!validation.isValid) {
      console.warn(`Invalid ${fieldName} for ${symbol}: ${validation.errors.join(', ')}`)
      return undefined
    }

    return typeof value === 'number' ? value : parseFloat(value)
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

  private identifyWarnings(stockScore: StockScore, additionalData?: any, macroImpact?: any, sentimentImpact?: any, esgImpact?: any): string[] {
    const warnings = []

    if (stockScore.dataQuality.overall < 0.6) {
      warnings.push('Low data quality detected')
    }

    if (stockScore.marketData.volume < 100000) {
      warnings.push('Low trading volume')
    }

    // Analyst-based warnings
    if (additionalData?.analystData) {
      const { sentimentScore, totalAnalysts, distribution } = additionalData.analystData

      if (sentimentScore < 2.5 && totalAnalysts >= 3) {
        warnings.push('Analysts are bearish on this stock')
      }

      if (distribution.sell + distribution.strongSell > distribution.buy + distribution.strongBuy) {
        warnings.push('More sell recommendations than buy recommendations')
      }

      if (totalAnalysts < 3) {
        warnings.push('Limited analyst coverage - higher uncertainty')
      }
    }

    // Fundamental ratio warnings
    if (additionalData?.fundamentalRatios) {
      const ratios = additionalData.fundamentalRatios

      if (ratios.peRatio && ratios.peRatio > 40) {
        warnings.push('High P/E ratio suggests potential overvaluation')
      }

      if (ratios.debtToEquity && ratios.debtToEquity > 2.0) {
        warnings.push('High debt-to-equity ratio indicates financial risk')
      }

      if (ratios.currentRatio && ratios.currentRatio < 1.0) {
        warnings.push('Poor liquidity - current ratio below 1.0')
      }

      if (ratios.roe && ratios.roe < 0) {
        warnings.push('Negative return on equity indicates poor profitability')
      }

      if (ratios.grossProfitMargin && ratios.grossProfitMargin < 0.1) {
        warnings.push('Low gross profit margin suggests pricing pressure')
      }
    }

    // Price target warnings
    if (additionalData?.priceTargets?.upside && additionalData.priceTargets.upside < -15) {
      warnings.push('Stock trading significantly above analyst price targets')
    }

    // VWAP-based warnings
    if (additionalData?.vwapAnalysis) {
      const vwap = additionalData.vwapAnalysis

      if (vwap.signal === 'below' && vwap.strength === 'strong') {
        warnings.push(`Price significantly below VWAP (${vwap.deviationPercent.toFixed(1)}%) - potential downward pressure`)
      }

      if (vwap.signal === 'above' && vwap.strength === 'strong' && vwap.deviationPercent > 5) {
        warnings.push(`Price far above VWAP (${vwap.deviationPercent.toFixed(1)}%) - potential overextension`)
      }
    }

    // Macroeconomic warnings
    if (macroImpact?.macroScore?.warnings) {
      warnings.push(...macroImpact.macroScore.warnings)
    }

    if (macroImpact?.sectorImpact?.outlook === 'negative' || macroImpact?.sectorImpact?.outlook === 'very_negative') {
      warnings.push(`Unfavorable macroeconomic environment for ${macroImpact.sectorImpact.sector} sector`)
    }

    // Sentiment-based warnings
    if (sentimentImpact?.sentimentScore?.warnings) {
      warnings.push(...sentimentImpact.sentimentScore.warnings)
    }
    if (sentimentImpact?.sentimentScore?.overall < 0.3) {
      warnings.push('Negative news sentiment creates downward pressure')
    }

    // ESG-based warnings
    if (esgImpact?.factors) {
      const esgWarnings = esgImpact.factors.filter((factor: string) =>
        factor.toLowerCase().includes('risk') ||
        factor.toLowerCase().includes('controversies') ||
        factor.toLowerCase().includes('regulatory')
      )
      warnings.push(...esgWarnings)
    }
    if (esgImpact?.impact === 'negative') {
      warnings.push('Poor ESG practices may impact long-term sustainability and investor appeal')
    }

    return warnings
  }

  private identifyOpportunities(stockScore: StockScore, additionalData?: any, macroImpact?: any, sentimentImpact?: any, esgImpact?: any): string[] {
    const opportunities = []

    if (stockScore.overallScore > 0.8) {
      opportunities.push('Strong fundamental performance')
    }

    // Analyst-based opportunities
    if (additionalData?.analystData) {
      const { sentimentScore, totalAnalysts, distribution } = additionalData.analystData

      if (sentimentScore >= 4.0 && totalAnalysts >= 5) {
        opportunities.push('Strong analyst consensus with high conviction')
      }

      if (distribution.strongBuy > distribution.hold + distribution.sell + distribution.strongSell) {
        opportunities.push('Dominated by Strong Buy recommendations')
      }
    }

    // Price target opportunities
    if (additionalData?.priceTargets?.upside && additionalData.priceTargets.upside > 20) {
      opportunities.push(`Significant upside potential: ${additionalData.priceTargets.upside.toFixed(1)}%`)
    }

    // Fundamental ratio opportunities
    if (additionalData?.fundamentalRatios) {
      const ratios = additionalData.fundamentalRatios

      if (ratios.peRatio && ratios.pegRatio && ratios.pegRatio < 1.0 && ratios.peRatio < 20) {
        opportunities.push('Attractive PEG ratio suggests undervalued growth stock')
      }

      if (ratios.roe && ratios.roe > 0.15) {
        opportunities.push('Strong return on equity indicates efficient management')
      }

      if (ratios.currentRatio && ratios.currentRatio > 2.0 && ratios.quickRatio && ratios.quickRatio > 1.5) {
        opportunities.push('Strong liquidity position provides financial flexibility')
      }

      if (ratios.grossProfitMargin && ratios.grossProfitMargin > 0.4) {
        opportunities.push('High gross margin indicates strong pricing power')
      }

      if (ratios.dividendYield && ratios.dividendYield > 0.03 && ratios.payoutRatio && ratios.payoutRatio < 0.6) {
        opportunities.push('Attractive dividend yield with sustainable payout ratio')
      }
    }

    // VWAP-based opportunities
    if (additionalData?.vwapAnalysis) {
      const vwap = additionalData.vwapAnalysis

      if (vwap.signal === 'above' && vwap.strength === 'moderate' && vwap.deviationPercent > 1 && vwap.deviationPercent < 3) {
        opportunities.push(`Price above VWAP (${vwap.deviationPercent.toFixed(1)}%) suggests positive momentum`)
      }

      if (vwap.signal === 'below' && vwap.strength === 'moderate' && vwap.deviationPercent < -1 && vwap.deviationPercent > -3) {
        opportunities.push(`Price slightly below VWAP (${Math.abs(vwap.deviationPercent).toFixed(1)}%) may present entry opportunity`)
      }

      if (vwap.signal === 'at') {
        opportunities.push('Price at VWAP provides neutral entry point with balanced risk/reward')
      }
    }

    // Macroeconomic opportunities
    if (macroImpact?.macroScore?.opportunities) {
      opportunities.push(...macroImpact.macroScore.opportunities)
    }

    if (macroImpact?.sectorImpact?.outlook === 'positive' || macroImpact?.sectorImpact?.outlook === 'very_positive') {
      opportunities.push(`Favorable macroeconomic environment for ${macroImpact.sectorImpact.sector} sector`)
    }

    if (macroImpact?.adjustedScore > stockScore.overallScore) {
      const improvement = ((macroImpact.adjustedScore - stockScore.overallScore) * 100).toFixed(1)
      opportunities.push(`Macroeconomic tailwinds boost score by ${improvement}%`)
    }

    // Sentiment-based opportunities
    if (sentimentImpact?.sentimentScore?.opportunities) {
      opportunities.push(...sentimentImpact.sentimentScore.opportunities)
    }
    if (sentimentImpact?.sentimentScore?.overall > 0.7) {
      opportunities.push('Positive news sentiment supports upward momentum')
    }

    // ESG-based opportunities
    if (esgImpact?.factors) {
      const esgOpportunities = esgImpact.factors.filter((factor: string) =>
        factor.toLowerCase().includes('strong') ||
        factor.toLowerCase().includes('value') ||
        factor.toLowerCase().includes('performance')
      )
      opportunities.push(...esgOpportunities)
    }
    if (esgImpact?.impact === 'positive') {
      opportunities.push('Strong ESG practices attract sustainable investment and reduce regulatory risk')
    }

    return opportunities
  }

  private generateAnalystInsights(additionalData: any): string[] {
    const insights = []

    if (!additionalData?.analystData) {
      insights.push('No analyst coverage available')
      return insights
    }

    const { consensus, totalAnalysts, sentimentScore, distribution } = additionalData.analystData

    insights.push(`${totalAnalysts} analysts covering with ${consensus} consensus`)
    insights.push(`Sentiment score: ${sentimentScore}/5.0`)

    if (additionalData.priceTargets) {
      const { consensus: target, upside } = additionalData.priceTargets
      insights.push(`Price target: $${target} (${upside > 0 ? '+' : ''}${upside?.toFixed(1)}% upside)`)
    }

    // Distribution insights
    const buyPercent = ((distribution.strongBuy + distribution.buy) / totalAnalysts * 100).toFixed(0)
    insights.push(`${buyPercent}% of analysts recommend Buy or Strong Buy`)

    return insights
  }

  private generateMacroeconomicInsights(macroImpact: any): string[] {
    const insights: string[] = []

    if (!macroImpact) return insights

    // Economic cycle insights
    if (macroImpact.macroScore) {
      const macro = macroImpact.macroScore
      insights.push(`Economic environment score: ${(macro.overall * 100).toFixed(0)}/100`)

      if (macro.reasoning && macro.reasoning.length > 0) {
        insights.push(...macro.reasoning.slice(0, 2)) // Take top 2 reasons
      }
    }

    // Sector sensitivity insights
    if (macroImpact.sectorImpact) {
      const sector = macroImpact.sectorImpact
      insights.push(`${sector.sector} sector outlook: ${sector.outlook.replace('_', ' ')}`)

      // Add specific sensitivity insights
      const sensitivities = []
      if (Math.abs(sector.economicSensitivity.interestRates) > 0.5) {
        const direction = sector.economicSensitivity.interestRates > 0 ? 'benefits from' : 'hurt by'
        sensitivities.push(`${direction} interest rate changes`)
      }
      if (Math.abs(sector.economicSensitivity.inflation) > 0.5) {
        const direction = sector.economicSensitivity.inflation > 0 ? 'benefits from' : 'hurt by'
        sensitivities.push(`${direction} inflation`)
      }

      if (sensitivities.length > 0) {
        insights.push(`Sector ${sensitivities.join(' and ')}`)
      }
    }

    // Score adjustment insights
    if (macroImpact.adjustedScore && macroImpact.macroWeight) {
      const adjustment = macroImpact.adjustedScore - (macroImpact.adjustedScore / (1 - macroImpact.macroWeight + macroImpact.macroWeight))
      if (Math.abs(adjustment) > 0.05) {
        const direction = adjustment > 0 ? 'boosted' : 'reduced'
        insights.push(`Macro factors ${direction} score by ${(Math.abs(adjustment) * 100).toFixed(1)}%`)
      }
    }

    return insights
  }

  private generateSentimentInsights(sentimentImpact: any): string[] {
    const insights: string[] = []
    if (!sentimentImpact) return insights

    // Main sentiment insights
    if (sentimentImpact.sentimentScore) {
      const sentiment = sentimentImpact.sentimentScore
      insights.push(`News sentiment score: ${(sentiment.overall * 100).toFixed(0)}/100`)

      if (sentiment.reasoning && sentiment.reasoning.length > 0) {
        insights.push(...sentiment.reasoning.slice(0, 2)) // Take top 2 reasons
      }
    }

    // Sentiment insights from the sentiment analysis service
    if (sentimentImpact.insights && sentimentImpact.insights.length > 0) {
      insights.push(...sentimentImpact.insights.slice(0, 3)) // Take top 3 insights
    }

    // Score adjustment insights
    if (sentimentImpact.adjustedScore && sentimentImpact.sentimentWeight) {
      const baseScore = sentimentImpact.adjustedScore / (1 - sentimentImpact.sentimentWeight + sentimentImpact.sentimentWeight)
      const adjustment = sentimentImpact.adjustedScore - baseScore
      if (Math.abs(adjustment) > 0.02) {
        const direction = adjustment > 0 ? 'boosted' : 'reduced'
        insights.push(`Sentiment factors ${direction} score by ${(Math.abs(adjustment) * 100).toFixed(1)}%`)
      }
    }

    return insights
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
      console.error('Unhandled rejection in StockSelectionService', {
        reason,
        promise: promise.toString()
      })
    })
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
        // Use simple hash for better performance
        if (!options || Object.keys(options).length === 0) {
          return prefix
        }

        // Create deterministic hash without heavy JSON operations
        const keys = Object.keys(options).sort()
        const hash = keys.reduce((acc, key) => {
          const val = options[key]
          if (val !== undefined && val !== null) {
            acc += key + String(val)
          }
          return acc
        }, '')

        // Simple hash function for cache key
        let hashCode = 0
        for (let i = 0; i < hash.length; i++) {
          const char = hash.charCodeAt(i)
          hashCode = ((hashCode << 5) - hashCode) + char
          hashCode = hashCode & hashCode // Convert to 32-bit integer
        }

        return `${prefix}:${Math.abs(hashCode).toString(16)}`
      },
      getCacheTTL: (mode: SelectionMode) => {
        switch (mode) {
          case SelectionMode.SINGLE_STOCK:
            return 300000 // 5 minutes
          case SelectionMode.SECTOR_ANALYSIS:
            return 600000 // 10 minutes
          default:
            return 300000
        }
      },
      getDataSourceConfig: () => ({
        'polygon': { priority: 1, weight: 1.0, timeout: 5000 },
        'alphavantage': { priority: 2, weight: 0.8, timeout: 5000 }
      })
    }
  }
}

/**
 * Factory function to create StockSelectionService instance
 */
export async function createStockSelectionService(
  fallbackDataService: FallbackDataService,
  factorLibrary: FactorLibrary,
  cache: RedisCache,
  technicalService?: TechnicalIndicatorService,
  macroeconomicService?: MacroeconomicAnalysisService,
  sentimentService?: SentimentAnalysisService
): Promise<StockSelectionService> {
  const service = new StockSelectionService(fallbackDataService, factorLibrary, cache, technicalService, macroeconomicService, sentimentService)

  // Perform any async initialization here
  const health = await service.healthCheck()
  if (health.status === 'unhealthy') {
    console.warn('StockSelectionService initialized with unhealthy dependencies:', health.details)
  }

  return service
}

export default StockSelectionService