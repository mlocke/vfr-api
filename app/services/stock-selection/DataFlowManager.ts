/**
 * Data Flow Manager for Stock Selection
 * Manages data enrichment, processing, and transformation pipelines
 * Coordinates between MCP sources, algorithms, and real-time data streams
 */

import { EventEmitter } from 'events'
import {
  SelectionRequest,
  SelectionOptions,
  EnhancedStockResult,
  DataIntegrationInterface
} from './types'
import { MockDataFusionEngine as DataFusionEngine, MockDataNormalizationPipeline as DataNormalizationPipeline, MockQualityScorer as QualityScorer, MockMCPClient as MCPClient, QualityScore, FusionResult } from '../types/core-types'
import { RedisCache } from '../cache/RedisCache'
import { StockScore } from '../algorithms/types'

interface DataFlowConfig {
  enableParallelProcessing: boolean
  maxConcurrentStreams: number
  dataRetentionPeriod: number
  qualityThresholds: {
    minAccuracy: number
    minFreshness: number
    minCompleteness: number
  }
  enrichmentSources: string[]
  priorityWeights: {
    [source: string]: number
  }
}

interface DataFlowMetrics {
  totalFlows: number
  activeFlows: number
  avgProcessingTime: number
  enrichmentRate: number
  qualityImprovement: number
  cacheEfficiency: number
}

interface DataEnrichmentResult {
  symbol: string
  enrichedData: any
  qualityScore: QualityScore
  sources: string[]
  processingTime: number
  cacheHit: boolean
}

interface ProcessingPipeline {
  id: string
  symbols: string[]
  startTime: number
  stages: {
    name: string
    status: 'pending' | 'processing' | 'complete' | 'error'
    startTime?: number
    endTime?: number
    error?: string
  }[]
  abortController: AbortController
}

/**
 * Data Flow Manager
 * Orchestrates data collection, enrichment, and processing for stock selection
 */
export class DataFlowManager extends EventEmitter implements DataIntegrationInterface {
  private config: DataFlowConfig
  private dataFusion: DataFusionEngine
  private normalizationPipeline: DataNormalizationPipeline
  private qualityScorer: QualityScorer
  private mcpClient: MCPClient
  private cache: RedisCache
  private metrics: DataFlowMetrics
  private activePipelines: Map<string, ProcessingPipeline> = new Map()
  private enrichmentCache: Map<string, DataEnrichmentResult> = new Map()

  constructor(
    dataFusion: DataFusionEngine,
    mcpClient: MCPClient,
    cache: RedisCache,
    config?: Partial<DataFlowConfig>
  ) {
    super()

    this.dataFusion = dataFusion
    this.mcpClient = mcpClient
    this.cache = cache
    this.normalizationPipeline = new DataNormalizationPipeline()
    this.qualityScorer = new QualityScorer()

    this.config = {
      enableParallelProcessing: true,
      maxConcurrentStreams: 10,
      dataRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      qualityThresholds: {
        minAccuracy: 0.7,
        minFreshness: 0.8,
        minCompleteness: 0.6
      },
      enrichmentSources: ['polygon', 'alphavantage', 'yahoo', 'news_sentiment'],
      priorityWeights: {
        'polygon': 1.0,
        'alphavantage': 0.8,
        'yahoo': 0.6,
        'news_sentiment': 0.4
      },
      ...config
    }

    this.metrics = this.initializeMetrics()
    this.setupCleanupInterval()
  }

  /**
   * Main entry point for data enrichment pipeline
   */
  async enrichStockData(
    symbols: string[],
    options: SelectionOptions = {}
  ): Promise<DataEnrichmentResult[]> {
    const pipelineId = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()

    // Create processing pipeline
    const pipeline = this.createProcessingPipeline(pipelineId, symbols)
    this.activePipelines.set(pipelineId, pipeline)

    try {
      this.emit('pipeline_start', { pipelineId, symbols, options })

      // Stage 1: Data Collection
      await this.updatePipelineStage(pipeline, 'data_collection', 'processing')
      const rawData = await this.collectRawData(symbols, options, pipeline.abortController.signal)
      await this.updatePipelineStage(pipeline, 'data_collection', 'complete')

      // Stage 2: Data Normalization
      await this.updatePipelineStage(pipeline, 'normalization', 'processing')
      const normalizedData = await this.normalizeData(rawData, pipeline.abortController.signal)
      await this.updatePipelineStage(pipeline, 'normalization', 'complete')

      // Stage 3: Quality Assessment
      await this.updatePipelineStage(pipeline, 'quality_assessment', 'processing')
      const qualityScores = await this.assessDataQuality(normalizedData)
      await this.updatePipelineStage(pipeline, 'quality_assessment', 'complete')

      // Stage 4: Data Fusion
      await this.updatePipelineStage(pipeline, 'data_fusion', 'processing')
      const fusedData = await this.fuseData(normalizedData, qualityScores, pipeline.abortController.signal)
      await this.updatePipelineStage(pipeline, 'data_fusion', 'complete')

      // Stage 5: Enrichment
      await this.updatePipelineStage(pipeline, 'enrichment', 'processing')
      const enrichedResults = await this.performEnrichment(symbols, fusedData, options)
      await this.updatePipelineStage(pipeline, 'enrichment', 'complete')

      // Stage 6: Caching
      await this.updatePipelineStage(pipeline, 'caching', 'processing')
      await this.cacheEnrichedData(enrichedResults, options)
      await this.updatePipelineStage(pipeline, 'caching', 'complete')

      // Update metrics
      this.updateMetrics(pipelineId, startTime, enrichedResults.length, true)

      this.emit('pipeline_complete', {
        pipelineId,
        symbols,
        results: enrichedResults.length,
        processingTime: Date.now() - startTime
      })

      return enrichedResults

    } catch (error) {
      console.error(`Data flow pipeline ${pipelineId} failed:`, error)
      await this.updatePipelineStage(pipeline, 'error', 'error', error.message)

      this.updateMetrics(pipelineId, startTime, 0, false)

      this.emit('pipeline_error', { pipelineId, symbols, error: error.message })

      throw error
    } finally {
      this.activePipelines.delete(pipelineId)
    }
  }

  /**
   * Collect raw data from multiple sources
   */
  private async collectRawData(
    symbols: string[],
    options: SelectionOptions,
    signal: AbortSignal
  ): Promise<{ [symbol: string]: { [source: string]: any } }> {
    const rawData: { [symbol: string]: { [source: string]: any } } = {}
    const sources = options.dataPreferences?.sources || this.config.enrichmentSources

    if (this.config.enableParallelProcessing) {
      // Parallel collection with concurrency control
      const chunks = this.chunkArray(symbols, this.config.maxConcurrentStreams)

      for (const chunk of chunks) {
        if (signal.aborted) throw new Error('Collection aborted')

        const chunkPromises = chunk.map(async symbol => {
          rawData[symbol] = {}

          const sourcePromises = sources.map(async source => {
            try {
              const data = await this.fetchFromSource(symbol, source, options)
              if (data) {
                rawData[symbol][source] = data
              }
            } catch (error) {
              console.warn(`Failed to fetch ${symbol} from ${source}:`, error.message)
            }
          })

          await Promise.allSettled(sourcePromises)
        })

        await Promise.all(chunkPromises)
      }
    } else {
      // Sequential collection
      for (const symbol of symbols) {
        if (signal.aborted) throw new Error('Collection aborted')

        rawData[symbol] = {}

        for (const source of sources) {
          try {
            const data = await this.fetchFromSource(symbol, source, options)
            if (data) {
              rawData[symbol][source] = data
            }
          } catch (error) {
            console.warn(`Failed to fetch ${symbol} from ${source}:`, error.message)
          }
        }
      }
    }

    return rawData
  }

  /**
   * Fetch data from a specific source
   */
  private async fetchFromSource(
    symbol: string,
    source: string,
    options: SelectionOptions
  ): Promise<any> {
    // Check cache first unless real-time is requested
    if (!options.useRealTimeData) {
      const cacheKey = `raw_data:${symbol}:${source}`
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    let data = null

    switch (source) {
      case 'polygon':
        data = await this.fetchPolygonData(symbol)
        break
      case 'alphavantage':
        data = await this.fetchAlphaVantageData(symbol)
        break
      case 'yahoo':
        data = await this.fetchYahooData(symbol)
        break
      case 'news_sentiment':
        data = await this.fetchNewsSentiment(symbol)
        break
      default:
        console.warn(`Unknown data source: ${source}`)
    }

    // Cache successful fetches
    if (data) {
      const cacheKey = `raw_data:${symbol}:${source}`
      const ttl = options.useRealTimeData ? 60 : 300 // 1min vs 5min
      await this.cache.set(cacheKey, data, ttl, { source, version: '1.0.0' })
    }

    return data
  }

  /**
   * Fetch data from Polygon.io
   */
  private async fetchPolygonData(symbol: string): Promise<any> {
    try {
      // Get current stock data
      const [quote, details, snapshot] = await Promise.allSettled([
        this.mcpClient.executeTool('get_last_quote', { ticker: symbol }),
        this.mcpClient.executeTool('get_ticker_details', { ticker: symbol }),
        this.mcpClient.executeTool('get_snapshot_ticker', {
          market_type: 'stocks',
          ticker: symbol
        })
      ])

      return {
        quote: quote.status === 'fulfilled' ? quote.value.data : null,
        details: details.status === 'fulfilled' ? details.value.data : null,
        snapshot: snapshot.status === 'fulfilled' ? snapshot.value.data : null,
        timestamp: Date.now(),
        source: 'polygon'
      }
    } catch (error) {
      console.error(`Polygon fetch error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Fetch data from Alpha Vantage (placeholder)
   */
  private async fetchAlphaVantageData(symbol: string): Promise<any> {
    // This would implement actual Alpha Vantage API calls
    return {
      price: 100 + Math.random() * 200,
      volume: Math.floor(Math.random() * 1000000),
      timestamp: Date.now(),
      source: 'alphavantage'
    }
  }

  /**
   * Fetch data from Yahoo Finance (placeholder)
   */
  private async fetchYahooData(symbol: string): Promise<any> {
    // This would implement actual Yahoo Finance API calls
    return {
      price: 100 + Math.random() * 200,
      marketCap: Math.floor(Math.random() * 500000000000),
      timestamp: Date.now(),
      source: 'yahoo'
    }
  }

  /**
   * Fetch news sentiment data
   */
  private async fetchNewsSentiment(symbol: string): Promise<any> {
    try {
      // This would integrate with news sentiment analysis
      return {
        sentiment: Math.random() * 2 - 1, // -1 to 1
        confidence: Math.random(),
        articles: Math.floor(Math.random() * 50),
        timestamp: Date.now(),
        source: 'news_sentiment'
      }
    } catch (error) {
      console.error(`News sentiment fetch error for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Normalize data from different sources
   */
  private async normalizeData(
    rawData: { [symbol: string]: { [source: string]: any } },
    signal: AbortSignal
  ): Promise<{ [symbol: string]: any }> {
    const normalizedData: { [symbol: string]: any } = {}

    for (const [symbol, sourceData] of Object.entries(rawData)) {
      if (signal.aborted) throw new Error('Normalization aborted')

      try {
        normalizedData[symbol] = await this.normalizationPipeline.processStockData(
          symbol,
          sourceData
        )
      } catch (error) {
        console.error(`Normalization error for ${symbol}:`, error)
        normalizedData[symbol] = null
      }
    }

    return normalizedData
  }

  /**
   * Assess data quality for each symbol
   */
  private async assessDataQuality(
    normalizedData: { [symbol: string]: any }
  ): Promise<{ [symbol: string]: QualityScore }> {
    const qualityScores: { [symbol: string]: QualityScore } = {}

    for (const [symbol, data] of Object.entries(normalizedData)) {
      if (data) {
        qualityScores[symbol] = await this.qualityScorer.scoreStockData(data)
      } else {
        qualityScores[symbol] = {
          overall: 0,
          metrics: {
            freshness: 0,
            completeness: 0,
            accuracy: 0,
            sourceReputation: 0,
            latency: 999999
          },
          timestamp: Date.now(),
          source: 'quality_scorer'
        }
      }
    }

    return qualityScores
  }

  /**
   * Fuse data from multiple sources
   */
  private async fuseData(
    normalizedData: { [symbol: string]: any },
    qualityScores: { [symbol: string]: QualityScore },
    signal: AbortSignal
  ): Promise<{ [symbol: string]: FusionResult }> {
    const fusedData: { [symbol: string]: FusionResult } = {}

    for (const [symbol, data] of Object.entries(normalizedData)) {
      if (signal.aborted) throw new Error('Fusion aborted')

      if (data && qualityScores[symbol]) {
        try {
          fusedData[symbol] = await this.dataFusion.fuseStockData([data], {
            qualityWeights: true,
            temporalAlignment: true,
            outlierDetection: true
          })
        } catch (error) {
          console.error(`Data fusion error for ${symbol}:`, error)
        }
      }
    }

    return fusedData
  }

  /**
   * Perform final enrichment with additional context
   */
  private async performEnrichment(
    symbols: string[],
    fusedData: { [symbol: string]: FusionResult },
    options: SelectionOptions
  ): Promise<DataEnrichmentResult[]> {
    const results: DataEnrichmentResult[] = []

    for (const symbol of symbols) {
      const startTime = Date.now()
      const fusion = fusedData[symbol]

      if (!fusion) {
        results.push({
          symbol,
          enrichedData: null,
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
            source: 'enrichment_failed'
          },
          sources: [],
          processingTime: Date.now() - startTime,
          cacheHit: false
        })
        continue
      }

      // Add enrichment layers
      const enrichedData = {
        ...fusion.fusedData,
        enrichments: {
          technicalIndicators: await this.calculateTechnicalIndicators(symbol, fusion.fusedData),
          marketContext: await this.getMarketContext(symbol),
          sectorContext: await this.getSectorContext(symbol),
          riskMetrics: await this.calculateRiskMetrics(symbol, fusion.fusedData)
        }
      }

      results.push({
        symbol,
        enrichedData,
        qualityScore: fusion.qualityScore,
        sources: fusion.sources || [],
        processingTime: Date.now() - startTime,
        cacheHit: false
      })
    }

    return results
  }

  /**
   * Cache enriched data
   */
  private async cacheEnrichedData(
    results: DataEnrichmentResult[],
    options: SelectionOptions
  ): Promise<void> {
    const cachePromises = results.map(async result => {
      const cacheKey = `enriched_data:${result.symbol}`
      const ttl = options.useRealTimeData ? 60 : 300 // 1min vs 5min

      await this.cache.set(cacheKey, result, ttl, {
        source: 'data_flow_manager',
        version: '1.0.0'
      })
    })

    await Promise.allSettled(cachePromises)
  }

  /**
   * DataIntegrationInterface Implementation
   */
  async fetchStockData(symbols: string[], options: SelectionOptions = {}): Promise<any> {
    const results = await this.enrichStockData(symbols, options)

    return results.reduce((acc, result) => {
      acc[result.symbol] = result.enrichedData
      return acc
    }, {})
  }

  async validateDataQuality(data: any): Promise<QualityScore> {
    return await this.qualityScorer.scoreStockData(data)
  }

  async getCachedData(key: string): Promise<any> {
    return await this.cache.get(key)
  }

  async setCachedData(key: string, data: any, ttl: number): Promise<void> {
    await this.cache.set(key, data, ttl)
  }

  /**
   * Management and utility methods
   */
  getMetrics(): DataFlowMetrics {
    return { ...this.metrics }
  }

  getActivePipelines(): string[] {
    return Array.from(this.activePipelines.keys())
  }

  async cancelPipeline(pipelineId: string): Promise<boolean> {
    const pipeline = this.activePipelines.get(pipelineId)
    if (pipeline) {
      pipeline.abortController.abort()
      this.activePipelines.delete(pipelineId)
      return true
    }
    return false
  }

  async clearEnrichmentCache(): Promise<void> {
    this.enrichmentCache.clear()
    await this.cache.invalidatePattern('enriched_data:*')
  }

  /**
   * Private utility methods
   */
  private createProcessingPipeline(id: string, symbols: string[]): ProcessingPipeline {
    return {
      id,
      symbols,
      startTime: Date.now(),
      stages: [
        { name: 'data_collection', status: 'pending' },
        { name: 'normalization', status: 'pending' },
        { name: 'quality_assessment', status: 'pending' },
        { name: 'data_fusion', status: 'pending' },
        { name: 'enrichment', status: 'pending' },
        { name: 'caching', status: 'pending' }
      ],
      abortController: new AbortController()
    }
  }

  private async updatePipelineStage(
    pipeline: ProcessingPipeline,
    stageName: string,
    status: 'pending' | 'processing' | 'complete' | 'error',
    error?: string
  ): Promise<void> {
    const stage = pipeline.stages.find(s => s.name === stageName)
    if (stage) {
      stage.status = status
      if (status === 'processing') {
        stage.startTime = Date.now()
      } else if (status === 'complete' || status === 'error') {
        stage.endTime = Date.now()
        if (error) {
          stage.error = error
        }
      }

      this.emit('pipeline_stage_update', {
        pipelineId: pipeline.id,
        stage: stageName,
        status,
        error
      })
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  private initializeMetrics(): DataFlowMetrics {
    return {
      totalFlows: 0,
      activeFlows: 0,
      avgProcessingTime: 0,
      enrichmentRate: 0,
      qualityImprovement: 0,
      cacheEfficiency: 0
    }
  }

  private updateMetrics(
    pipelineId: string,
    startTime: number,
    resultsCount: number,
    success: boolean
  ): void {
    this.metrics.totalFlows++
    this.metrics.avgProcessingTime = (
      this.metrics.avgProcessingTime + (Date.now() - startTime)
    ) / 2

    if (success) {
      this.metrics.enrichmentRate = (
        this.metrics.enrichmentRate * (this.metrics.totalFlows - 1) +
        (resultsCount > 0 ? 1 : 0)
      ) / this.metrics.totalFlows
    }
  }

  private setupCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredPipelines()
      this.cleanupEnrichmentCache()
    }, 60000) // Cleanup every minute
  }

  private cleanupExpiredPipelines(): void {
    const now = Date.now()
    const maxAge = 30 * 60 * 1000 // 30 minutes

    for (const [id, pipeline] of this.activePipelines.entries()) {
      if (now - pipeline.startTime > maxAge) {
        pipeline.abortController.abort()
        this.activePipelines.delete(id)
        console.log(`Cleaned up expired pipeline: ${id}`)
      }
    }
  }

  private cleanupEnrichmentCache(): void {
    const now = Date.now()

    for (const [key, result] of this.enrichmentCache.entries()) {
      if (now - result.processingTime > this.config.dataRetentionPeriod) {
        this.enrichmentCache.delete(key)
      }
    }
  }

  // Placeholder methods for enrichment calculations
  private async calculateTechnicalIndicators(symbol: string, data: any): Promise<any> {
    return {
      rsi: 50 + Math.random() * 50,
      macd: Math.random() * 2 - 1,
      sma20: data.price * (0.95 + Math.random() * 0.1),
      bollinger: {
        upper: data.price * 1.02,
        lower: data.price * 0.98
      }
    }
  }

  private async getMarketContext(symbol: string): Promise<any> {
    return {
      marketTrend: Math.random() > 0.5 ? 'bullish' : 'bearish',
      vixLevel: 20 + Math.random() * 30,
      sectorPerformance: Math.random() * 20 - 10
    }
  }

  private async getSectorContext(symbol: string): Promise<any> {
    return {
      sectorMomentum: Math.random() * 2 - 1,
      relativePE: 15 + Math.random() * 10,
      sectorRotation: Math.random() > 0.7 ? 'inflow' : 'outflow'
    }
  }

  private async calculateRiskMetrics(symbol: string, data: any): Promise<any> {
    return {
      beta: 0.5 + Math.random() * 1.5,
      volatility: Math.random() * 0.5,
      sharpeRatio: Math.random() * 2,
      maxDrawdown: Math.random() * 0.3
    }
  }
}

export default DataFlowManager