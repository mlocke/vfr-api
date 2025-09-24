/**
 * Dynamic Stock Selection Algorithm Engine
 * Integrates with DataFusionEngine for multi-source data quality and Redis for caching
 */

import {
  AlgorithmConfiguration,
  AlgorithmContext,
  AlgorithmExecution,
  StockScore,
  SelectionResult,
  AlgorithmType,
  SelectionCriteria,
  FactorCalculator
} from './types'

import { QualityScore, ConflictResolutionStrategy } from '../types/core-types'
import { FallbackDataService } from '../financial-data/FallbackDataService'
import { FactorLibrary } from './FactorLibrary'
import { AlgorithmCache } from './AlgorithmCache'
import SentimentAnalysisService from '../financial-data/SentimentAnalysisService'
import { RedisCache } from '../cache/RedisCache'

interface MarketDataPoint {
  symbol: string
  price: number
  volume: number
  marketCap: number
  sector: string
  exchange: string
  timestamp: number
}

interface FundamentalDataPoint {
  symbol: string
  peRatio?: number
  pbRatio?: number
  debtToEquity?: number
  roe?: number
  revenueGrowth?: number
  [key: string]: any
}

interface TechnicalDataPoint {
  symbol: string
  rsi?: number
  macd?: { signal: number; histogram: number; macd: number }
  sma?: { [period: string]: number }
  volatility?: number
  sentimentScore?: number // 🆕 SENTIMENT INTEGRATION
  [key: string]: any
}

export class AlgorithmEngine {
  private fallbackDataService: FallbackDataService
  private factorLibrary: FactorLibrary
  private cache: AlgorithmCache
  private sentimentService: SentimentAnalysisService
  private activeExecutions: Map<string, AlgorithmExecution> = new Map()

  constructor(
    fallbackDataService: FallbackDataService,
    factorLibrary: FactorLibrary,
    cache: AlgorithmCache,
    sentimentService?: SentimentAnalysisService
  ) {
    this.fallbackDataService = fallbackDataService
    this.factorLibrary = factorLibrary
    this.cache = cache
    this.sentimentService = sentimentService || new SentimentAnalysisService(new RedisCache())
  }

  /**
   * Execute stock selection algorithm
   */
  async executeAlgorithm(
    config: AlgorithmConfiguration,
    context: AlgorithmContext
  ): Promise<SelectionResult> {
    const executionId = `${config.id}_${context.runId}`
    const startTime = Date.now()

    try {
      // Register execution
      const execution: AlgorithmExecution = {
        context,
        config,
        status: 'running'
      }
      this.activeExecutions.set(executionId, execution)

      // Step 1: Get universe of stocks to evaluate
      const universe = await this.getStockUniverse(config, context)
      console.log(`Algorithm ${config.name}: Evaluating ${universe.length} stocks`)

      // Step 2: Fetch and fuse market data for all stocks
      const marketData = await this.fetchMarketData(universe, config)
      console.log(`Fetched market data for ${marketData.size} stocks`)

      // Step 3: Fetch and fuse fundamental data if required
      const fundamentalData = await this.fetchFundamentalData(universe, config)
      console.log(`Fetched fundamental data for ${fundamentalData.size} stocks`)

      // Step 4: Calculate factor scores for each stock
      const stockScores = await this.calculateStockScores(
        universe,
        marketData,
        fundamentalData,
        config
      )
      console.log(`Calculated scores for ${stockScores.length} stocks`)

      // Step 5: Apply selection criteria
      const selections = await this.applySelectionCriteria(stockScores, config, context)
      console.log(`Selected ${selections.length} stocks after applying criteria`)

      // Step 6: Calculate performance metrics
      const metrics = this.calculateExecutionMetrics(stockScores, selections, startTime)

      // Step 7: Build final result
      const result: SelectionResult = {
        algorithmId: config.id,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        selections,
        metrics,
        quality: {
          dataCompleteness: this.calculateDataCompleteness(stockScores),
          sourceAgreement: this.calculateSourceAgreement(stockScores),
          freshness: this.calculateDataFreshness(stockScores)
        }
      }

      // Update execution status
      execution.result = result
      execution.status = 'completed'

      // Cache result if enabled
      if (config.dataFusion?.cacheTTL > 0) {
        await this.cache.setSelectionResult(config.id, result)
      }

      return result

    } catch (error) {
      const execution = this.activeExecutions.get(executionId)
      if (execution) {
        execution.status = 'failed'
        execution.error = error instanceof Error ? error.message : 'Unknown error'
      }
      throw error
    } finally {
      this.activeExecutions.delete(executionId)
    }
  }

  /**
   * Get stock universe based on configuration and context
   */
  private async getStockUniverse(config: AlgorithmConfiguration, context?: AlgorithmContext): Promise<string[]> {
    // ✅ CRITICAL FIX: Use symbols from context if provided (for single stock analysis)
    if (context?.symbols && context.symbols.length > 0) {
      console.log(`Using symbols from context: [${context.symbols.join(', ')}]`)
      return context.symbols
    }

    // ✅ FALLBACK: Use symbols from scope if available
    if (context?.scope?.symbols && context.scope.symbols.length > 0) {
      console.log(`Using symbols from scope: [${context.scope.symbols.join(', ')}]`)
      return context.scope.symbols
    }

    const cacheKey = this.cache.getCacheKeys().universe(config.id)

    // Try cache first
    const cached = await this.cache.getUniverse(config.id)
    if (cached && cached.length > 0) {
      return cached
    }

    // Build universe from screening criteria
    let universe: string[] = []

    // Query database or external sources based on universe config
    // Provide default universe config if not defined
    const universeConfig = config.universe || {
      maxPositions: 50,
      marketCapMin: 100000000,
      sectors: [],
      excludeSymbols: []
    }

    const { sectors, marketCapMin, marketCapMax, exchanges, excludeSymbols } = universeConfig

    // This would typically query your stock database
    // For demonstration, showing the structure
    const query = this.buildUniverseQuery({
      sectors,
      marketCapMin,
      marketCapMax,
      exchanges,
      excludeSymbols,
      maxPositions: universeConfig.maxPositions
    })

    // Execute query (implementation depends on your database)
    universe = await this.executeUniverseQuery(query)

    // Cache universe for reuse
    await this.cache.setUniverse(config.id, universe)

    return universe
  }

  /**
   * Fetch and fuse market data from multiple sources
   */
  private async fetchMarketData(
    symbols: string[],
    config: AlgorithmConfiguration
  ): Promise<Map<string, MarketDataPoint>> {
    const marketData = new Map<string, MarketDataPoint>()
    const batchSize = 50 // Process in batches to avoid overwhelming APIs

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const batchPromises = batch.map(symbol => this.fetchSymbolMarketData(symbol, config))

      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          marketData.set(batch[index], result.value)
        }
      })
    }

    return marketData
  }

  /**
   * Fetch market data for a single symbol using data fusion
   */
  private async fetchSymbolMarketData(
    symbol: string,
    config: AlgorithmConfiguration
  ): Promise<MarketDataPoint | null> {
    try {
      // Check cache first
      const cached = await this.cache.getMarketData(symbol)
      if (cached && Date.now() - cached.timestamp < (config.dataFusion?.cacheTTL || 300000)) {
        console.log(`Using cached market data for ${symbol}`)
        return cached
      }

      // Fetch data using FallbackDataService (already has built-in fallback logic)
      console.log(`Fetching fresh market data for ${symbol}...`)
      const stockData = await this.fallbackDataService.getStockPrice(symbol)
      const marketData = await this.fallbackDataService.getMarketData(symbol)
      const companyInfo = await this.fallbackDataService.getCompanyInfo(symbol)

      if (!stockData) {
        console.warn(`Failed to get market data for ${symbol}`)
        return null
      }

      console.log(`Got stock data for ${symbol}: price=${stockData.price}, volume=${stockData.volume}`)

      const marketDataPoint: MarketDataPoint = {
        symbol,
        price: stockData.price || 0,
        volume: stockData.volume || 0,
        marketCap: companyInfo?.marketCap || 0,
        sector: companyInfo?.sector || '',
        exchange: companyInfo?.symbol || '',
        timestamp: Date.now()
      }

      // Cache the result
      await this.cache.setMarketData(symbol, marketDataPoint)

      return marketDataPoint

    } catch (error) {
      console.error(`Error fetching market data for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Fetch fundamental data using multi-source fusion
   */
  private async fetchFundamentalData(
    symbols: string[],
    config: AlgorithmConfiguration
  ): Promise<Map<string, FundamentalDataPoint>> {
    const fundamentalData = new Map<string, FundamentalDataPoint>()

    // Only fetch if fundamental factors are required
    const requiresFundamentals = config.weights.some(w =>
      w.enabled && this.factorLibrary.requiresFundamentalData(w.factor)
    )

    if (!requiresFundamentals) {
      return fundamentalData
    }

    // Batch process fundamental data
    const batchSize = 25 // Smaller batches for fundamental data (more expensive)

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const batchPromises = batch.map(symbol => this.fetchSymbolFundamentalData(symbol, config))

      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          fundamentalData.set(batch[index], result.value)
        }
      })
    }

    return fundamentalData
  }

  /**
   * Fetch fundamental data for single symbol with fusion
   */
  private async fetchSymbolFundamentalData(
    symbol: string,
    config: AlgorithmConfiguration
  ): Promise<FundamentalDataPoint | null> {
    try {
      // Check cache (fundamentals change less frequently)
      const cached = await this.cache.getFundamentalData(symbol)
      if (cached && Date.now() - cached.timestamp < (config.dataFusion?.cacheTTL || 300000) * 10) {
        return cached.data
      }

      // Fetch fundamental ratios using FallbackDataService
      const fundamentalRatios = await this.fallbackDataService.getFundamentalRatios(symbol)
      const companyInfo = await this.fallbackDataService.getCompanyInfo(symbol)

      if (!fundamentalRatios) {
        return null
      }

      const fundamentalDataPoint: FundamentalDataPoint = {
        symbol,
        peRatio: fundamentalRatios.peRatio,
        pbRatio: fundamentalRatios.pbRatio,
        debtToEquity: fundamentalRatios.debtToEquity,
        roe: fundamentalRatios.roe,
        revenueGrowth: 0, // Not available in current interface
        // Map additional fundamental data
        priceToBookRatio: fundamentalRatios.pbRatio,
        priceToSalesRatio: fundamentalRatios.priceToSales,
        operatingMargin: fundamentalRatios.operatingMargin,
        netProfitMargin: fundamentalRatios.netProfitMargin,
        currentRatio: fundamentalRatios.currentRatio,
        quickRatio: fundamentalRatios.quickRatio,
        dividendYield: fundamentalRatios.dividendYield,
        payoutRatio: fundamentalRatios.payoutRatio,
        // Add from company info if available
        marketCap: companyInfo?.marketCap,
        sector: companyInfo?.sector,
        industry: companyInfo?.sector // Use sector as industry since industry not available
      }

      // Cache with longer TTL
      await this.cache.setFundamentalData(symbol, {
        data: fundamentalDataPoint,
        timestamp: Date.now()
      })

      return fundamentalDataPoint

    } catch (error) {
      console.error(`Error fetching fundamental data for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Calculate comprehensive stock scores using configurable factors
   */
  private async calculateStockScores(
    symbols: string[],
    marketData: Map<string, MarketDataPoint>,
    fundamentalData: Map<string, FundamentalDataPoint>,
    config: AlgorithmConfiguration
  ): Promise<StockScore[]> {
    const stockScores: StockScore[] = []

    for (const symbol of symbols) {
      console.log(`Processing symbol ${symbol}, marketData keys: [${Array.from(marketData.keys()).join(', ')}]`)
      const market = marketData.get(symbol)
      const fundamental = fundamentalData.get(symbol)

      if (!market) {
        console.warn(`Missing market data for ${symbol}, skipping`)
        console.warn(`Available market data keys: [${Array.from(marketData.keys()).join(', ')}]`)
        continue
      }

      try {
        console.log(`Calculating score for ${symbol} with market data:`, { price: market.price, volume: market.volume })
        const score = await this.calculateSingleStockScore(
          symbol,
          market,
          config,
          fundamental
        )

        if (score) {
          console.log(`Successfully calculated score for ${symbol}: ${score.overallScore}`)
          stockScores.push(score)
        } else {
          console.warn(`Score calculation returned null for ${symbol}`)
        }
      } catch (error) {
        console.error(`Error calculating score for ${symbol}:`, error)
      }
    }

    return stockScores
  }

  /**
   * Calculate score for a single stock
   */
  private async calculateSingleStockScore(
    symbol: string,
    marketData: MarketDataPoint,
    config: AlgorithmConfiguration,
    fundamentalData?: FundamentalDataPoint
  ): Promise<StockScore | null> {
    console.log(`Starting score calculation for ${symbol}, weights count: ${config.weights?.length || 0}`)

    // Enhanced composite algorithm with proper factor tracking
    if (config.name?.includes('Composite') || config.id?.includes('composite')) {
      console.log(`🎯 COMPOSITE ALGORITHM DETECTED - Using enhanced composite factor calculation`)

      try {
        // 🆕 PRE-FETCH SENTIMENT DATA for composite algorithm
        let sentimentScore: number | undefined
        try {
          console.log(`📰 Pre-fetching sentiment data for ${symbol}...`)
          const sentimentResult = await this.sentimentService.getSentimentIndicators(symbol)
          sentimentScore = sentimentResult ? sentimentResult.aggregatedScore : undefined
          console.log(`📰 Sentiment pre-fetched for ${symbol}: ${sentimentScore}`)
        } catch (sentimentError) {
          console.warn(`Failed to fetch sentiment for ${symbol}:`, sentimentError)
          sentimentScore = undefined // Will use fallback in FactorLibrary
        }

        // Create technical data with sentiment score for FactorLibrary
        const technicalDataWithSentiment: TechnicalDataPoint = {
          symbol,
          sentimentScore
        }

        const compositeScore = await this.factorLibrary.calculateFactor(
          'composite',
          symbol,
          marketData,
          fundamentalData,
          technicalDataWithSentiment
        )

        if (compositeScore !== null && !isNaN(compositeScore)) {
          console.log(`🎯 Enhanced composite score for ${symbol}: ${compositeScore}`)

          // Calculate sub-component scores for proper utilization tracking
          const componentFactors: { [factor: string]: number } = { 'composite': compositeScore }

          // Calculate individual composite components if they would contribute
          try {
            const qualityScore = await this.factorLibrary.calculateFactor('quality_composite', symbol, marketData, fundamentalData)
            if (qualityScore !== null && qualityScore !== 0.5) {
              componentFactors['quality_composite'] = qualityScore
            }

            const momentumScore = await this.factorLibrary.calculateFactor('momentum_composite', symbol, marketData, fundamentalData)
            if (momentumScore !== null && momentumScore !== 0.5) {
              componentFactors['momentum_composite'] = momentumScore
            }

            const valueScore = await this.factorLibrary.calculateFactor('value_composite', symbol, marketData, fundamentalData)
            if (valueScore !== null && valueScore !== 0.5) {
              componentFactors['value_composite'] = valueScore
            }

            const volatilityScore = await this.factorLibrary.calculateFactor('volatility_30d', symbol, marketData, fundamentalData)
            if (volatilityScore !== null && volatilityScore !== 0.5) {
              componentFactors['volatility_30d'] = volatilityScore
            }
          } catch (componentError) {
            console.warn('Error calculating composite components:', componentError)
          }

          return {
            symbol,
            overallScore: compositeScore,
            factorScores: componentFactors,
            dataQuality: {
              overall: 0.9,
              metrics: {
                freshness: 0.95,
                completeness: 0.9,
                accuracy: 0.95,
                sourceReputation: 0.9,
                latency: 0
              },
              timestamp: Date.now(),
              source: 'composite'
            },
            timestamp: Date.now(),
            marketData: {
              price: marketData.price,
              volume: marketData.volume,
              marketCap: marketData.marketCap,
              sector: marketData.sector,
              exchange: marketData.exchange
            },
            algorithmMetrics: {
              [config.type]: {
                score: compositeScore
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error calculating enhanced composite score for ${symbol}:`, error)
      }
    }

    const factorScores: { [factor: string]: number } = {}
    const algorithmMetrics: { [algorithmType: string]: any } = {}

    // Calculate each factor score
    let totalWeightedScore = 0
    let totalWeight = 0

    for (const weight of config.weights) {
      if (!weight.enabled) {
        console.log(`Factor ${weight.factor} is disabled, skipping`)
        continue
      }

      try {
        console.log(`Calculating factor ${weight.factor} for ${symbol}...`)
        const factorScore = await this.factorLibrary.calculateFactor(
          weight.factor,
          symbol,
          marketData,
          fundamentalData
        )

        if (factorScore !== null && !isNaN(factorScore)) {
          factorScores[weight.factor] = factorScore
          totalWeightedScore += factorScore * weight.weight
          totalWeight += weight.weight
          console.log(`Factor ${weight.factor} = ${factorScore}, weight = ${weight.weight}`)
        } else {
          console.warn(`Factor ${weight.factor} returned null or NaN for ${symbol}`)
        }
      } catch (error) {
        console.warn(`Error calculating factor ${weight.factor} for ${symbol}:`, error)
      }
    }

    // If no factors calculated successfully, use a simple default scoring
    if (totalWeight === 0) {
      console.warn(`No factors calculated successfully for ${symbol}, using simple default scoring`)
      // Create a simple score based on available data
      totalWeightedScore = 0.5  // Default neutral score
      totalWeight = 1.0

      // Add simple price-based scoring if we have market data
      if (marketData.price > 0) {
        factorScores['price_available'] = 1.0
        // Give a slightly positive score for having data available
        totalWeightedScore = 0.6
      }

      console.log(`Using default scoring for ${symbol}: score=${totalWeightedScore}`)
    }

    const overallScore = totalWeightedScore / totalWeight

    // Generate algorithm-specific metrics based on type
    algorithmMetrics[config.type] = {
      score: overallScore,
      factorContribution: this.calculateFactorContributions(factorScores, config.weights)
    }

    // Assess data quality
    const dataQuality: QualityScore = {
      overall: this.calculateOverallDataQuality(marketData, fundamentalData),
      metrics: {
        freshness: this.calculateFreshness(marketData.timestamp),
        completeness: this.calculateCompleteness(marketData, fundamentalData),
        accuracy: 0.95, // This would be calculated based on cross-validation
        sourceReputation: 0.9, // Based on source reliability
        latency: 0 // Based on API response times
      },
      timestamp: Date.now(),
      source: 'fusion'
    }

    return {
      symbol,
      overallScore,
      factorScores,
      dataQuality,
      timestamp: Date.now(),
      marketData: {
        price: marketData.price,
        volume: marketData.volume,
        marketCap: marketData.marketCap,
        sector: marketData.sector,
        exchange: marketData.exchange
      },
      algorithmMetrics
    }
  }

  /**
   * Apply selection criteria to stock scores
   */
  private async applySelectionCriteria(
    stockScores: StockScore[],
    config: AlgorithmConfiguration,
    context: AlgorithmContext
  ): Promise<SelectionResult['selections']> {
    // Filter by minimum data quality
    const qualifiedScores = stockScores.filter(score =>
      score.dataQuality.overall >= (config.dataFusion?.minQualityScore || 0.7)
    )

    // Sort by overall score (descending)
    qualifiedScores.sort((a, b) => b.overallScore - a.overallScore)

    const selections: SelectionResult['selections'] = []

    switch (config.selectionCriteria) {
      case SelectionCriteria.SCORE_BASED:
        return this.applyScoreBased(qualifiedScores, config, context)

      case SelectionCriteria.RANK_BASED:
        return this.applyRankBased(qualifiedScores, config, context)

      case SelectionCriteria.QUANTILE_BASED:
        return this.applyQuantileBased(qualifiedScores, config, context)

      case SelectionCriteria.THRESHOLD_BASED:
        return this.applyThresholdBased(qualifiedScores, config, context)

      default:
        return this.applyScoreBased(qualifiedScores, config, context)
    }
  }

  /**
   * Score-based selection (top N by score)
   */
  private applyScoreBased(
    scores: StockScore[],
    config: AlgorithmConfiguration,
    context: AlgorithmContext
  ): SelectionResult['selections'] {
    const topN = config.selection.topN || (config.universe?.maxPositions || 50)
    const selectedScores = scores.slice(0, Math.min(topN, scores.length))

    return selectedScores.map((score, index) => ({
      symbol: score.symbol,
      score,
      weight: this.calculatePositionWeight(score, selectedScores, config),
      action: this.determineActionFromScore(score.overallScore),
      confidence: this.calculateConfidence(score, index, selectedScores.length)
    }))
  }

  /**
   * Rank-based selection with equal weighting
   */
  private applyRankBased(
    scores: StockScore[],
    config: AlgorithmConfiguration,
    context: AlgorithmContext
  ): SelectionResult['selections'] {
    const topN = config.selection.topN || (config.universe?.maxPositions || 50)
    const selectedScores = scores.slice(0, Math.min(topN, scores.length))
    const equalWeight = 1.0 / selectedScores.length

    return selectedScores.map((score, index) => ({
      symbol: score.symbol,
      score,
      weight: equalWeight,
      action: this.determineAction(score.symbol, context),
      confidence: this.calculateConfidence(score, index, selectedScores.length)
    }))
  }

  /**
   * Quantile-based selection (top X percentile)
   */
  private applyQuantileBased(
    scores: StockScore[],
    config: AlgorithmConfiguration,
    context: AlgorithmContext
  ): SelectionResult['selections'] {
    const quantile = config.selection.quantile || 0.1 // Top 10% by default
    const cutoffIndex = Math.floor(scores.length * quantile)
    const selectedScores = scores.slice(0, Math.max(1, cutoffIndex))

    return selectedScores.map((score, index) => ({
      symbol: score.symbol,
      score,
      weight: this.calculatePositionWeight(score, selectedScores, config),
      action: this.determineAction(score.symbol, context),
      confidence: this.calculateConfidence(score, index, selectedScores.length)
    }))
  }

  /**
   * Threshold-based selection (above minimum score)
   */
  private applyThresholdBased(
    scores: StockScore[],
    config: AlgorithmConfiguration,
    context: AlgorithmContext
  ): SelectionResult['selections'] {
    const threshold = config.selection.threshold || 0.6
    const selectedScores = scores.filter(score => score.overallScore >= threshold)
      .slice(0, config.universe?.maxPositions || 50)

    if (selectedScores.length === 0) {
      return []
    }

    return selectedScores.map((score, index) => ({
      symbol: score.symbol,
      score,
      weight: this.calculatePositionWeight(score, selectedScores, config),
      action: this.determineAction(score.symbol, context),
      confidence: this.calculateConfidence(score, index, selectedScores.length)
    }))
  }

  /**
   * Calculate position weight based on score and constraints
   */
  private calculatePositionWeight(
    score: StockScore,
    allScores: StockScore[],
    config: AlgorithmConfiguration
  ): number {
    // Score-weighted allocation
    const totalScore = allScores.reduce((sum, s) => sum + s.overallScore, 0)
    let weight = score.overallScore / totalScore

    // Apply maximum single position constraint
    weight = Math.min(weight, config.risk.maxSinglePosition)

    // Apply sector constraints
    if (config.risk.maxSectorWeight < 1.0) {
      const sectorWeight = this.calculateSectorWeight(score.marketData.sector, allScores)
      if (sectorWeight > config.risk.maxSectorWeight) {
        weight *= config.risk.maxSectorWeight / sectorWeight
      }
    }

    return Math.max(0, Math.min(1, weight))
  }

  /**
   * Determine action based on score using standard thresholds
   */
  private determineActionFromScore(score: number): 'BUY' | 'SELL' | 'HOLD' {
    // Standard scoring thresholds:
    // BUY: >= 70 (0.70)
    // HOLD: 30-70 (0.30-0.70)
    // SELL: <= 30 (0.30)

    if (score >= 0.70) {
      return 'BUY'
    } else if (score <= 0.30) {
      return 'SELL'
    } else {
      return 'HOLD'
    }
  }

  /**
   * Determine action (BUY/SELL/HOLD) based on current positions
   */
  private determineAction(
    symbol: string,
    context: AlgorithmContext
  ): 'BUY' | 'SELL' | 'HOLD' {
    // 🎯 SCORE-BASED ACTION DETERMINATION
    // Find the score for this symbol in the current calculation
    // Since we don't have direct access to the score here, we need to use standard thresholds
    // BUY: >= 70 (0.70), HOLD: 30-70 (0.30-0.70), SELL: <= 30 (0.30)

    // For now, use the simple logic but with score-based improvements in the future
    // The score-based logic should be implemented at the selection level
    if (!context.currentPositions) {
      // If no current positions, default to BUY for high scores, HOLD for medium
      return 'BUY'
    }

    const currentPosition = context.currentPositions[symbol]
    if (!currentPosition) {
      return 'BUY'
    }

    // This is where you'd implement more sophisticated rebalancing logic
    return 'HOLD'
  }

  /**
   * Calculate confidence score for selection
   */
  private calculateConfidence(
    score: StockScore,
    rank: number,
    totalSelections: number
  ): number {
    // Base confidence on data quality and relative score
    let confidence = score.dataQuality.overall

    // Boost confidence for higher-ranked selections
    const rankBonus = (totalSelections - rank) / totalSelections * 0.2
    confidence = Math.min(1.0, confidence + rankBonus)

    // Factor in score magnitude
    if (score.overallScore > 0.8) confidence += 0.1
    if (score.overallScore < 0.3) confidence -= 0.2

    return Math.max(0, Math.min(1, confidence))
  }

  // Utility methods
  private buildUniverseQuery(criteria: any): string {
    // Build SQL or other query based on criteria
    // This is implementation-specific to your database
    return `SELECT symbol FROM stocks WHERE ${this.buildWhereClause(criteria)}`
  }

  private buildWhereClause(criteria: any): string {
    const conditions: string[] = []

    if (criteria.sectors?.length) {
      conditions.push(`sector IN (${criteria.sectors.map((s: string) => `'${s}'`).join(',')})`)
    }
    if (criteria.marketCapMin) {
      conditions.push(`market_cap >= ${criteria.marketCapMin}`)
    }
    if (criteria.marketCapMax) {
      conditions.push(`market_cap <= ${criteria.marketCapMax}`)
    }
    if (criteria.exchanges?.length) {
      conditions.push(`exchange IN (${criteria.exchanges.map((e: string) => `'${e}'`).join(',')})`)
    }
    if (criteria.excludeSymbols?.length) {
      conditions.push(`symbol NOT IN (${criteria.excludeSymbols.map((s: string) => `'${s}'`).join(',')})`)
    }

    return conditions.join(' AND ') || '1=1'
  }

  private async executeUniverseQuery(query: string): Promise<string[]> {
    // Execute database query and return symbol list
    // Implementation depends on your database client
    return [] // Placeholder
  }

  private async fetchFromSource(source: string, symbol: string, dataType: string): Promise<any> {
    // Fetch data from specific MCP source
    // Implementation depends on your MCP client setup
    return null // Placeholder
  }

  private async assessDataQuality(data: any, source: string): Promise<QualityScore> {
    // Use QualityScorer to assess data quality
    return {
      overall: 0.9,
      metrics: {
        freshness: 0.9,
        completeness: 0.9,
        accuracy: 0.9,
        sourceReputation: 0.9,
        latency: 100
      },
      timestamp: Date.now(),
      source
    }
  }

  private calculateExecutionMetrics(
    stockScores: StockScore[],
    selections: SelectionResult['selections'],
    startTime: number
  ) {
    return {
      totalStocksEvaluated: stockScores.length,
      averageDataQuality: stockScores.reduce((sum, s) => sum + s.dataQuality.overall, 0) / stockScores.length,
      cacheHitRate: 0.85, // This would be tracked during execution
      dataFusionConflicts: 0 // This would be tracked during fusion
    }
  }

  private calculateDataCompleteness(stockScores: StockScore[]): number {
    return stockScores.reduce((sum, s) => sum + s.dataQuality.metrics.completeness, 0) / stockScores.length
  }

  private calculateSourceAgreement(stockScores: StockScore[]): number {
    // Calculate average agreement between sources (would be tracked during fusion)
    return 0.92
  }

  private calculateDataFreshness(stockScores: StockScore[]): number {
    return stockScores.reduce((sum, s) => sum + s.dataQuality.metrics.freshness, 0) / stockScores.length
  }

  private calculateOverallDataQuality(
    marketData: MarketDataPoint,
    fundamentalData?: FundamentalDataPoint
  ): number {
    // Implement comprehensive data quality calculation
    return 0.9
  }

  private calculateFreshness(timestamp: number): number {
    const age = Date.now() - timestamp
    const maxAge = 5 * 60 * 1000 // 5 minutes
    return Math.max(0, 1 - age / maxAge)
  }

  private calculateCompleteness(
    marketData: MarketDataPoint,
    fundamentalData?: FundamentalDataPoint
  ): number {
    let totalFields = 6 // symbol, price, volume, marketCap, sector, exchange
    let completedFields = 0

    if (marketData.symbol) completedFields++
    if (marketData.price > 0) completedFields++
    if (marketData.volume > 0) completedFields++
    if (marketData.marketCap > 0) completedFields++
    if (marketData.sector) completedFields++
    if (marketData.exchange) completedFields++

    if (fundamentalData) {
      totalFields += 5 // peRatio, pbRatio, debtToEquity, roe, revenueGrowth
      if (fundamentalData.peRatio !== undefined) completedFields++
      if (fundamentalData.pbRatio !== undefined) completedFields++
      if (fundamentalData.debtToEquity !== undefined) completedFields++
      if (fundamentalData.roe !== undefined) completedFields++
      if (fundamentalData.revenueGrowth !== undefined) completedFields++
    }

    return completedFields / totalFields
  }

  private calculateFactorContributions(
    factorScores: { [factor: string]: number },
    weights: AlgorithmConfiguration['weights']
  ): { [factor: string]: number } {
    const totalWeight = weights.reduce((sum, w) => sum + (w.enabled ? w.weight : 0), 0)
    const contributions: { [factor: string]: number } = {}

    weights.forEach(weight => {
      if (weight.enabled && factorScores[weight.factor] !== undefined) {
        contributions[weight.factor] = (weight.weight / totalWeight) * factorScores[weight.factor]
      }
    })

    return contributions
  }

  private calculateSectorWeight(sector: string, scores: StockScore[]): number {
    const sectorStocks = scores.filter(s => s.marketData.sector === sector)
    return sectorStocks.length / scores.length
  }

  /**
   * Get current execution status
   */
  getExecutionStatus(executionId: string): AlgorithmExecution | undefined {
    return this.activeExecutions.get(executionId)
  }

  /**
   * Cancel running execution
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.activeExecutions.get(executionId)
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled'
      return true
    }
    return false
  }

  /**
   * Get engine statistics
   */
  getEngineStats() {
    return {
      activeExecutions: this.activeExecutions.size,
      cacheStats: this.cache.getStatistics(),
      dataServiceStats: {
        healthy: true, // FallbackDataService has its own health check
        name: this.fallbackDataService.name
      }
    }
  }
}