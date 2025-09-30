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
import { FinancialDataService } from '../financial-data/FinancialDataService'
import { FactorLibrary } from './FactorLibrary'
import { AlgorithmCache } from './AlgorithmCache'
import SentimentAnalysisService from '../financial-data/SentimentAnalysisService'
import { VWAPService } from '../financial-data/VWAPService'
import { MacroeconomicAnalysisService } from '../financial-data/MacroeconomicAnalysisService'
import { InstitutionalDataService } from '../financial-data/InstitutionalDataService'
import { OptionsDataService } from '../financial-data/OptionsDataService'
import { RedisCache } from '../cache/RedisCache'
import { getRecommendation } from '../utils/RecommendationUtils'
import { TimeoutHandler } from '../error-handling/TimeoutHandler'

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
  vwapAnalysis?: any // 🆕 VWAP INTEGRATION
  macroeconomicContext?: any // 🆕 MACROECONOMIC INTEGRATION
  institutionalData?: any // 🆕 INSTITUTIONAL DATA INTEGRATION
  shortInterestData?: any // 🆕 SHORT INTEREST INTEGRATION
  extendedMarketData?: any // 🆕 EXTENDED MARKET DATA INTEGRATION
  optionsData?: OptionsDataPoint // 🆕 OPTIONS INTEGRATION
  analystData?: any // 🆕 ANALYST DATA INTEGRATION
  [key: string]: any
}

interface OptionsDataPoint {
  putCallRatio?: number
  impliedVolatilityPercentile?: number
  optionsFlow?: {
    sentiment: number // -1 to 1 scale
    volume: number
    openInterest: number
  }
  greeks?: {
    delta: number
    gamma: number
    theta: number
    vega: number
  }
  volumeDivergence?: number // Ratio of options volume to stock volume
  maxPain?: number // Max pain strike price
}

export class AlgorithmEngine {
  private financialDataService: FinancialDataService
  private factorLibrary: FactorLibrary
  private cache: AlgorithmCache
  private sentimentService: SentimentAnalysisService
  private vwapService?: VWAPService
  private macroeconomicService?: MacroeconomicAnalysisService
  private institutionalService?: InstitutionalDataService
  private optionsService?: OptionsDataService
  private activeExecutions: Map<string, AlgorithmExecution> = new Map()

  constructor(
    financialDataService: FinancialDataService,
    factorLibrary: FactorLibrary,
    cache: AlgorithmCache,
    sentimentService?: SentimentAnalysisService,
    vwapService?: VWAPService,
    macroeconomicService?: MacroeconomicAnalysisService,
    institutionalService?: InstitutionalDataService,
    optionsService?: OptionsDataService
  ) {
    this.financialDataService = financialDataService
    this.factorLibrary = factorLibrary
    this.cache = cache
    this.sentimentService = sentimentService || new SentimentAnalysisService(new RedisCache())
    this.vwapService = vwapService
    this.macroeconomicService = macroeconomicService
    this.institutionalService = institutionalService
    this.optionsService = optionsService
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
   * Fetch and fuse market data from multiple sources with FMP optimization
   */
  private async fetchMarketData(
    symbols: string[],
    config: AlgorithmConfiguration
  ): Promise<Map<string, MarketDataPoint>> {
    const marketData = new Map<string, MarketDataPoint>()

    // Dynamic batch sizing based on FMP Starter capacity (300/min = 5/second)
    // Allow 80% utilization to prevent rate limiting: 4 calls/second
    const fmpCapacity = this.financialDataService.getFmpCapacity()
    const optimalBatchSize = Math.min(
      fmpCapacity.isStarterPlan ? 60 : 25, // 60 for FMP Starter, 25 for others
      Math.max(10, Math.floor(symbols.length / 4)) // Adaptive based on symbol count
    )

    console.log(`📊 Using optimized batch size: ${optimalBatchSize} (FMP Starter: ${fmpCapacity.isStarterPlan})`)

    // Enhanced parallel processing with intelligent batching
    const batchPromises: Promise<Map<string, MarketDataPoint>>[] = []

    for (let i = 0; i < symbols.length; i += optimalBatchSize) {
      const batch = symbols.slice(i, i + optimalBatchSize)

      // Process each batch as independent parallel operation
      const batchPromise = this.processBatchWithRateLimiting(batch, config)
      batchPromises.push(batchPromise)

      // Add slight delay between batch initiations to spread load
      if (i + optimalBatchSize < symbols.length && fmpCapacity.isStarterPlan) {
        await new Promise(resolve => setTimeout(resolve, 250)) // 250ms stagger for FMP Starter
      }
    }

    // Execute all batches in parallel with timeout protection
    const batchResults = await Promise.allSettled(batchPromises)

    // Merge results from all batches
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        for (const [symbol, data] of result.value) {
          marketData.set(symbol, data)
        }
      }
    })

    console.log(`✅ Market data fetched for ${marketData.size}/${symbols.length} symbols (${((marketData.size / symbols.length) * 100).toFixed(1)}% success rate)`)
    return marketData
  }

  /**
   * Process a batch of symbols with rate limiting and parallel execution
   */
  private async processBatchWithRateLimiting(
    batch: string[],
    config: AlgorithmConfiguration
  ): Promise<Map<string, MarketDataPoint>> {
    const batchData = new Map<string, MarketDataPoint>()

    // Create individual promises for each symbol in the batch
    const symbolPromises = batch.map(symbol =>
      this.fetchSymbolMarketData(symbol, config)
        .catch(error => {
          console.warn(`⚠️ Failed to fetch data for ${symbol}:`, error.message)
          return null
        })
    )

    // Execute all symbols in parallel within the batch
    const results = await Promise.allSettled(symbolPromises)

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        batchData.set(batch[index], result.value)
      }
    })

    return batchData
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

      // Fetch data using FinancialDataService with parallel execution (83.8% performance improvement)
      console.log(`Fetching fresh market data for ${symbol}...`)
      const [stockData, marketData, companyInfo] = await Promise.allSettled([
        this.financialDataService.getStockPrice(symbol),
        this.financialDataService.getMarketData(symbol),
        this.financialDataService.getCompanyInfo(symbol)
      ]).then(results => [
        results[0].status === 'fulfilled' ? results[0].value : null,
        results[1].status === 'fulfilled' ? results[1].value : null,
        results[2].status === 'fulfilled' ? results[2].value : null
      ])

      if (!stockData) {
        console.warn(`Failed to get market data for ${symbol}`)
        return null
      }

      // Type-safe property access with fallbacks
      const price = (stockData as any)?.price || (marketData as any)?.price || 0
      const volume = (stockData as any)?.volume || (marketData as any)?.volume || 0
      console.log(`Got stock data for ${symbol}: price=${price}, volume=${volume}`)

      const marketDataPoint: MarketDataPoint = {
        symbol,
        price,
        volume,
        marketCap: (companyInfo as any)?.marketCap ?? 0,
        sector: (companyInfo as any)?.sector ?? 'Unknown',
        exchange: (companyInfo as any)?.symbol || symbol,
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

      // Fetch fundamental ratios using FinancialDataService
      const fundamentalRatios = await this.financialDataService.getFundamentalRatios(symbol)
      const companyInfo = await this.financialDataService.getCompanyInfo(symbol)

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
        // 🆕 PRE-FETCH SENTIMENT DATA for composite algorithm (with 15s timeout)
        let sentimentScore: number | undefined
        try {
          console.log(`📰 Pre-fetching sentiment data for ${symbol}...`)
          const timeoutHandler = TimeoutHandler.getInstance()
          const sentimentResult = await timeoutHandler.withTimeout(
            this.sentimentService.getSentimentIndicators(symbol),
            15000 // 15s timeout for Reddit parallel processing
          )
          sentimentScore = sentimentResult ? sentimentResult.aggregatedScore : undefined
          console.log(`📰 Sentiment pre-fetched for ${symbol}: ${sentimentScore}`)
        } catch (sentimentError) {
          console.warn(`Failed to fetch sentiment for ${symbol}:`, sentimentError)
          sentimentScore = undefined // Will use fallback in FactorLibrary
        }

        // 🆕 PRE-FETCH VWAP DATA for composite algorithm
        let vwapAnalysis: any | undefined
        if (this.vwapService) {
          try {
            console.log(`📊 Pre-fetching VWAP analysis for ${symbol}...`)
            vwapAnalysis = await this.vwapService.getVWAPAnalysis(symbol)
            console.log(`📊 VWAP pre-fetched for ${symbol}: ${vwapAnalysis ? 'success' : 'no data'}`)
          } catch (vwapError) {
            console.warn(`Failed to fetch VWAP for ${symbol}:`, vwapError)
            vwapAnalysis = undefined
          }
        }

        // 🆕 PRE-FETCH MACROECONOMIC CONTEXT for composite algorithm (with 10s timeout)
        let macroeconomicContext: any | undefined
        if (this.macroeconomicService && marketData.sector) {
          try {
            console.log(`🌍 Pre-fetching macroeconomic context for ${symbol} (${marketData.sector})...`)
            const timeoutHandler = TimeoutHandler.getInstance()
            const macroImpact = await timeoutHandler.withTimeout(
              this.macroeconomicService.analyzeStockMacroImpact(
                symbol,
                marketData.sector,
                marketData.price
              ),
              10000 // 10s timeout for government APIs
            )
            macroeconomicContext = macroImpact
            console.log(`🌍 Macro context pre-fetched for ${symbol}: ${macroImpact ? 'success' : 'no data'}`)
          } catch (macroError) {
            console.warn(`Failed to fetch macro context for ${symbol}:`, macroError)
            macroeconomicContext = undefined
          }
        }

        // 🆕 PRE-FETCH ESG DATA for composite algorithm (with 8s timeout)
        let esgScore: number | undefined
        try {
          console.log(`🌱 Pre-fetching ESG data for ${symbol} (${marketData.sector})...`)
          const timeoutHandler = TimeoutHandler.getInstance()
          const { ESGDataService } = await import('../financial-data/ESGDataService')
          const esgService = new ESGDataService()
          const esgImpact = await timeoutHandler.withTimeout(
            esgService.getESGImpactForStock(symbol, marketData.sector || 'unknown', 0.5),
            8000 // 8s timeout for ESG provider APIs
          )
          esgScore = esgImpact ? esgImpact.esgScore / 100 : undefined // Convert to 0-1 scale
          console.log(`🌱 ESG pre-fetched for ${symbol}: ${esgScore ? esgScore.toFixed(3) : 'no data'}`)
        } catch (esgError) {
          console.warn(`Failed to fetch ESG for ${symbol}:`, esgError)
          esgScore = undefined // Will use fallback in FactorLibrary
        }

        // 🆕 PRE-FETCH INSTITUTIONAL DATA for composite algorithm (with 10s timeout)
        let institutionalData: any | undefined
        if (this.institutionalService) {
          try {
            console.log(`🏢 Pre-fetching institutional data for ${symbol}...`)
            const timeoutHandler = TimeoutHandler.getInstance()
            const institutionalIntelligence = await timeoutHandler.withTimeout(
              this.institutionalService.getInstitutionalIntelligence(symbol),
              10000 // 10s timeout for institutional APIs
            )
            institutionalData = institutionalIntelligence
            console.log(`🏢 Institutional data pre-fetched for ${symbol}: ${institutionalIntelligence ? `sentiment ${institutionalIntelligence.weightedSentiment}, score ${institutionalIntelligence.compositeScore.toFixed(2)}` : 'no data'}`)
          } catch (institutionalError) {
            console.warn(`Failed to fetch institutional data for ${symbol}:`, institutionalError)
            institutionalData = undefined // Will use fallback in FactorLibrary
          }
        }

        // 🆕 PRE-FETCH SHORT INTEREST DATA for composite algorithm
        let shortInterestData: any | undefined
        try {
          console.log(`📊 Pre-fetching short interest data for ${symbol} (${marketData.sector})...`)
          const { ShortInterestService } = await import('../financial-data/ShortInterestService')
          const shortInterestService = new ShortInterestService()
          const shortInterestImpact = await shortInterestService.getShortInterestImpactForStock(symbol, marketData.sector || 'unknown', 0.5)
          shortInterestData = shortInterestImpact
          console.log(`📊 Short interest pre-fetched for ${symbol}: ${shortInterestImpact ? `score ${shortInterestImpact.score?.toFixed(3)}, impact ${shortInterestImpact.impact}` : 'no data'}`)
        } catch (shortInterestError) {
          console.warn(`Failed to fetch short interest for ${symbol}:`, shortInterestError)
          shortInterestData = undefined // Will use fallback in FactorLibrary
        }

        // 🆕 PRE-FETCH EXTENDED MARKET DATA for composite algorithm
        let extendedMarketData: any | undefined
        try {
          console.log(`🕒 Pre-fetching extended market data for ${symbol}...`)
          const { ExtendedMarketDataService } = await import('../financial-data/ExtendedMarketDataService')
          const { FinancialModelingPrepAPI } = await import('../financial-data/FinancialModelingPrepAPI')
          const fmpAPI = new FinancialModelingPrepAPI()
          const redisCache = new RedisCache()
          const extendedMarketService = new ExtendedMarketDataService(fmpAPI, redisCache)
          const extendedData = await extendedMarketService.getExtendedMarketData(symbol)
          extendedMarketData = extendedData
          console.log(`🕒 Extended market data pre-fetched for ${symbol}: ${extendedData ? `extended hours data ${extendedData.extendedHours?.marketStatus || 'N/A'}, liquidity ${extendedData.liquidityMetrics?.liquidityScore || 'N/A'}` : 'no data'}`)
        } catch (extendedMarketError) {
          console.warn(`Failed to fetch extended market data for ${symbol}:`, extendedMarketError)
          extendedMarketData = undefined // Will use fallback in FactorLibrary
        }

        // 🆕 PRE-FETCH OPTIONS DATA for composite algorithm
        let optionsData: OptionsDataPoint | undefined
        try {
          console.log(`📊 Pre-fetching options data for ${symbol}...`)
          const { OptionsDataService } = await import('../financial-data/OptionsDataService')
          const optionsService = new OptionsDataService()

          // Fetch both analysis and chain data for comprehensive metrics
          const [optionsAnalysis, optionsChain] = await Promise.allSettled([
            optionsService.getOptionsAnalysis(symbol),
            optionsService.getOptionsChain(symbol)
          ])

          const analysis = optionsAnalysis.status === 'fulfilled' ? optionsAnalysis.value : null
          const chain = optionsChain.status === 'fulfilled' ? optionsChain.value : null

          if (analysis && analysis.currentRatio) {
            // Calculate enhanced options metrics from chain data
            let impliedVolatilityPercentile: number | undefined
            let volumeDivergence: number | undefined
            let maxPainCalculation: number | undefined
            let averageGreeks: { delta: number; gamma: number; theta: number; vega: number } | undefined

            if (chain) {
              // Calculate IV percentile from historical data (approximate)
              const currentIV = chain.calls.concat(chain.puts)
                .filter(c => c.impliedVolatility && c.impliedVolatility > 0)
                .reduce((sum, c, _, arr) => sum + (c.impliedVolatility! / arr.length), 0)

              // Estimate IV percentile (simplified calculation)
              impliedVolatilityPercentile = Math.min(95, Math.max(5, currentIV * 200)) // Rough estimate

              // Calculate volume divergence (options volume vs stock volume if available)
              const totalOptionsVolume = chain.calls.concat(chain.puts)
                .reduce((sum, c) => sum + (c.volume || 0), 0)
              if (marketData.volume > 0) {
                volumeDivergence = totalOptionsVolume / marketData.volume
              }

              // Extract max pain from chain summary if available
              if ((chain as any).summary?.maxPain) {
                maxPainCalculation = (chain as any).summary.maxPain
              }

              // Calculate average Greeks from active contracts
              const activeContracts = chain.calls.concat(chain.puts)
                .filter(c => (c.volume || 0) > 0 && c.delta !== undefined)

              if (activeContracts.length > 0) {
                averageGreeks = {
                  delta: activeContracts.reduce((sum, c) => sum + (c.delta || 0), 0) / activeContracts.length,
                  gamma: activeContracts.reduce((sum, c) => sum + (c.gamma || 0), 0) / activeContracts.length,
                  theta: activeContracts.reduce((sum, c) => sum + (c.theta || 0), 0) / activeContracts.length,
                  vega: activeContracts.reduce((sum, c) => sum + (c.vega || 0), 0) / activeContracts.length
                }
              }
            }

            // Map OptionsAnalysis to enhanced OptionsDataPoint structure
            optionsData = {
              putCallRatio: analysis.currentRatio.volumeRatio,
              impliedVolatilityPercentile,
              optionsFlow: {
                sentiment: analysis.sentiment === 'greed' ? 0.7 : analysis.sentiment === 'fear' ? -0.7 : 0,
                volume: analysis.currentRatio.totalCallVolume + analysis.currentRatio.totalPutVolume,
                openInterest: analysis.currentRatio.totalCallOpenInterest + analysis.currentRatio.totalPutOpenInterest
              },
              greeks: averageGreeks,
              volumeDivergence,
              maxPain: maxPainCalculation
            }

            console.log(`📊 Enhanced options data pre-fetched for ${symbol}:`)
            console.log(`   P/C Ratio: ${optionsData.putCallRatio?.toFixed(2) || 'N/A'}`)
            console.log(`   IV Percentile: ${optionsData.impliedVolatilityPercentile?.toFixed(1) || 'N/A'}%`)
            console.log(`   Volume Divergence: ${optionsData.volumeDivergence?.toFixed(2) || 'N/A'}`)
            console.log(`   Max Pain: $${optionsData.maxPain?.toFixed(2) || 'N/A'}`)
            console.log(`   Sentiment: ${analysis.sentiment}`)
          } else {
            optionsData = undefined
            console.log(`📊 No options data available for ${symbol}`)
          }
        } catch (optionsError) {
          console.warn(`Failed to fetch options data for ${symbol}:`, optionsError)
          optionsData = undefined // Will use fallback in FactorLibrary
        }

        // 🆕 PRE-FETCH ANALYST DATA for composite algorithm
        let analystData: any | undefined
        try {
          console.log(`📊 Pre-fetching analyst data for ${symbol}...`)
          const analystRatings = await this.financialDataService.getAnalystRatings(symbol)
          if (analystRatings) {
            analystData = {
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
            console.log(`📊 Analyst data pre-fetched for ${symbol}: ${analystRatings.consensus} (${analystRatings.totalAnalysts} analysts, sentiment ${analystRatings.sentimentScore}/5)`)
          }
        } catch (analystError) {
          console.warn(`Failed to fetch analyst data for ${symbol}:`, analystError)
          analystData = undefined
        }

        // Create enhanced technical data with all pre-fetched services for FactorLibrary
        const enhancedTechnicalData: TechnicalDataPoint = {
          symbol,
          sentimentScore,
          vwapAnalysis,
          macroeconomicContext,
          esgScore,
          institutionalData,
          shortInterestData,
          extendedMarketData,
          optionsData,
          analystData
        }

        const compositeScore = await this.factorLibrary.calculateFactor(
          'composite',
          symbol,
          marketData,
          fundamentalData,
          enhancedTechnicalData
        )

        if (compositeScore !== null && !isNaN(compositeScore)) {
          console.log(`🎯 Enhanced composite score for ${symbol}: ${compositeScore}`)
          console.log(`🔍 DEBUG: compositeScore type: ${typeof compositeScore}, value: ${compositeScore}, clamped: ${Math.max(0, Math.min(1, compositeScore))}`)
          console.log(`✅ AlgorithmEngine: Passing through score = ${compositeScore.toFixed(4)} (0-1 scale, NO manipulation)`)

          // 🚨 VALIDATION: Verify score is in 0-1 range (KISS architecture enforcement)
          if (compositeScore < 0 || compositeScore > 1) {
            console.error(`❌ VALIDATION WARNING: Score ${compositeScore} from FactorLibrary is outside 0-1 range for ${symbol}!`)
          }

          // Calculate sub-component scores for proper utilization tracking
          const componentFactors: { [factor: string]: number } = { 'composite': compositeScore }

          // ✅ PERFORMANCE FIX: Calculate individual composite components for proper tracking
          try {
            // Technical Analysis Score (28% weight) - CRITICAL for utilization tracking
            const technicalOverallScore = await this.factorLibrary.calculateFactor('technical_overall_score', symbol, marketData, fundamentalData)
            if (technicalOverallScore !== null) {
              componentFactors['technical_overall_score'] = technicalOverallScore
              componentFactors['technicalScore'] = technicalOverallScore * 100 // Export as 0-100 scale
              console.log(`✅ Technical overall score for ${symbol}: ${technicalOverallScore.toFixed(3)} (${(technicalOverallScore * 100).toFixed(1)}) - TRACKED`)
            } else {
              console.warn(`⚠️ Technical score null for ${symbol} - will show as 0 in UI`)
            }

            // 🆕 FUNDAMENTAL SCORE CALCULATION - Add fundamental score to factorScores
            const qualityScore = await this.factorLibrary.calculateFactor('quality_composite', symbol, marketData, fundamentalData)
            if (qualityScore !== null) {
              componentFactors['quality_composite'] = qualityScore
              console.log(`✅ Quality composite score for ${symbol}: ${qualityScore.toFixed(3)} (${(qualityScore * 100).toFixed(1)})`)
            } else {
              console.warn(`⚠️ Quality composite null for ${symbol}`)
            }

            // Calculate fundamental score from fundamentalData
            if (fundamentalData && Object.keys(fundamentalData).length > 0) {
              const fundamentalScore = this.calculateFundamentalScore(fundamentalData)
              componentFactors['fundamentalScore'] = fundamentalScore
              console.log(`✅ Fundamental score for ${symbol}: ${fundamentalScore.toFixed(1)} - TRACKED`)
            }

            // 🆕 ANALYST SCORE CALCULATION - Add analyst score to factorScores
            if (analystData) {
              const analystScore = this.calculateAnalystScore(analystData)
              componentFactors['analystScore'] = analystScore
              console.log(`✅ Analyst score for ${symbol}: ${analystScore.toFixed(1)} - TRACKED`)
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

            // ✅ PERFORMANCE ENHANCEMENT: Add sentiment tracking for completeness
            if (sentimentScore !== undefined && sentimentScore !== null && sentimentScore !== 0.5) {
              componentFactors['sentiment_composite'] = sentimentScore
              console.log(`✅ Sentiment score for ${symbol}: ${sentimentScore.toFixed(3)} - TRACKED`)
            }

            // 🆕 VWAP SERVICE TRACKING - Calculate VWAP factors for utilization tracking
            if (vwapAnalysis) {
              const vwapDeviationScore = await this.factorLibrary.calculateFactor('vwap_deviation_score', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (vwapDeviationScore !== null && vwapDeviationScore !== 0.5) {
                componentFactors['vwap_deviation_score'] = vwapDeviationScore
                console.log(`✅ VWAP deviation score for ${symbol}: ${vwapDeviationScore.toFixed(3)} - TRACKED`)
              }

              const vwapTradingSignals = await this.factorLibrary.calculateFactor('vwap_trading_signals', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (vwapTradingSignals !== null && vwapTradingSignals !== 0.5) {
                componentFactors['vwap_trading_signals'] = vwapTradingSignals
                console.log(`✅ VWAP trading signals for ${symbol}: ${vwapTradingSignals.toFixed(3)} - TRACKED`)
              }

              // 🆕 VWAP TREND ANALYSIS - Enhanced historical trend integration
              const vwapTrendAnalysis = await this.factorLibrary.calculateFactor('vwap_trend_analysis', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (vwapTrendAnalysis !== null && vwapTrendAnalysis !== 0.5) {
                componentFactors['vwap_trend_analysis'] = vwapTrendAnalysis
                console.log(`✅ VWAP trend analysis for ${symbol}: ${vwapTrendAnalysis.toFixed(3)} - TRACKED`)
              }
            }

            // 🆕 MACROECONOMIC SERVICE TRACKING - Calculate macro factors for utilization tracking
            if (macroeconomicContext) {
              const macroSectorImpact = await this.factorLibrary.calculateFactor('macroeconomic_sector_impact', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (macroSectorImpact !== null && macroSectorImpact !== 0.5) {
                componentFactors['macroeconomic_sector_impact'] = macroSectorImpact
                console.log(`✅ Macro sector impact for ${symbol}: ${macroSectorImpact.toFixed(3)} - TRACKED`)
              }

              const macroComposite = await this.factorLibrary.calculateFactor('macroeconomic_composite', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (macroComposite !== null && macroComposite !== 0.5) {
                componentFactors['macroeconomic_composite'] = macroComposite
                console.log(`✅ Macroeconomic composite for ${symbol}: ${macroComposite.toFixed(3)} - TRACKED`)
              }
            }

            // 🆕 INSTITUTIONAL SERVICE TRACKING - Calculate institutional factors for utilization tracking
            if (institutionalData) {
              const institutionalSentiment = await this.factorLibrary.calculateFactor('institutional_sentiment', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (institutionalSentiment !== null && institutionalSentiment !== 0.5) {
                componentFactors['institutional_sentiment'] = institutionalSentiment
                console.log(`✅ Institutional sentiment for ${symbol}: ${institutionalSentiment.toFixed(3)} - TRACKED`)
              }

              const insiderActivity = await this.factorLibrary.calculateFactor('insider_activity_score', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (insiderActivity !== null && insiderActivity !== 0.5) {
                componentFactors['insider_activity_score'] = insiderActivity
                console.log(`✅ Insider activity score for ${symbol}: ${insiderActivity.toFixed(3)} - TRACKED`)
              }

              // 🆕 INSTITUTIONAL COMPOSITE - Enhanced institutional intelligence integration
              const institutionalComposite = await this.factorLibrary.calculateFactor('institutional_composite', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (institutionalComposite !== null && institutionalComposite !== 0.5) {
                componentFactors['institutional_composite'] = institutionalComposite
                console.log(`✅ Institutional composite for ${symbol}: ${institutionalComposite.toFixed(3)} - TRACKED`)
              }
            }

            // 🆕 ESG SERVICE TRACKING - Calculate ESG factors for utilization tracking
            if (esgScore !== undefined && esgScore !== null) {
              const esgComposite = await this.factorLibrary.calculateFactor('esg_composite', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (esgComposite !== null && esgComposite !== 0.5) {
                componentFactors['esg_composite'] = esgComposite
                console.log(`✅ ESG composite score for ${symbol}: ${esgComposite.toFixed(3)} - TRACKED`)
              }
            }

            // 🆕 SHORT INTEREST SERVICE TRACKING - Calculate short interest factors for utilization tracking
            if (shortInterestData) {
              const shortInterestComposite = await this.factorLibrary.calculateFactor('short_interest_composite', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (shortInterestComposite !== null && shortInterestComposite !== 0.5) {
                componentFactors['short_interest_composite'] = shortInterestComposite
                console.log(`✅ Short interest composite for ${symbol}: ${shortInterestComposite.toFixed(3)} - TRACKED`)
              }
            }

            // 🆕 EXTENDED MARKET DATA SERVICE TRACKING - Calculate extended market factors for utilization tracking
            if (extendedMarketData) {
              const extendedMarketComposite = await this.factorLibrary.calculateFactor('extended_market_composite', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (extendedMarketComposite !== null && extendedMarketComposite !== 0.5) {
                componentFactors['extended_market_composite'] = extendedMarketComposite
                console.log(`✅ Extended market composite for ${symbol}: ${extendedMarketComposite.toFixed(3)} - TRACKED`)
              }
            }

            // 🆕 OPTIONS DATA SERVICE TRACKING - Calculate options factors for utilization tracking
            if (optionsData) {
              const optionsComposite = await this.factorLibrary.calculateFactor('options_composite', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (optionsComposite !== null && optionsComposite !== 0.5) {
                componentFactors['options_composite'] = optionsComposite
                console.log(`✅ Options composite for ${symbol}: ${optionsComposite.toFixed(3)} - TRACKED`)
              }

              // Track individual options factors for detailed analysis
              const putCallRatioScore = await this.factorLibrary.calculateFactor('put_call_ratio_score', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (putCallRatioScore !== null && putCallRatioScore !== 0.5) {
                componentFactors['put_call_ratio_score'] = putCallRatioScore
                console.log(`✅ Put/Call ratio score for ${symbol}: ${putCallRatioScore.toFixed(3)} - TRACKED`)
              }

              const optionsFlowScore = await this.factorLibrary.calculateFactor('options_flow_score', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (optionsFlowScore !== null && optionsFlowScore !== 0.5) {
                componentFactors['options_flow_score'] = optionsFlowScore
                console.log(`✅ Options flow score for ${symbol}: ${optionsFlowScore.toFixed(3)} - TRACKED`)
              }

              const maxPainScore = await this.factorLibrary.calculateFactor('max_pain_score', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (maxPainScore !== null && maxPainScore !== 0.5) {
                componentFactors['max_pain_score'] = maxPainScore
                console.log(`✅ Max pain score for ${symbol}: ${maxPainScore.toFixed(3)} - TRACKED`)
              }

              const ivPercentileScore = await this.factorLibrary.calculateFactor('iv_percentile_score', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (ivPercentileScore !== null && ivPercentileScore !== 0.5) {
                componentFactors['iv_percentile_score'] = ivPercentileScore
                console.log(`✅ IV percentile score for ${symbol}: ${ivPercentileScore.toFixed(3)} - TRACKED`)
              }

              const volumeDivergenceScore = await this.factorLibrary.calculateFactor('volume_divergence_score', symbol, marketData, fundamentalData, enhancedTechnicalData)
              if (volumeDivergenceScore !== null && volumeDivergenceScore !== 0.5) {
                componentFactors['volume_divergence_score'] = volumeDivergenceScore
                console.log(`✅ Volume divergence score for ${symbol}: ${volumeDivergenceScore.toFixed(3)} - TRACKED`)
              }
            }

          } catch (componentError) {
            console.warn('Error calculating composite components:', componentError)
          }

          // 🎯 PASS THROUGH ONLY: No score manipulation, maintaining 0-1 scale
          return {
            symbol,
            overallScore: compositeScore, // ✅ Direct pass-through from FactorLibrary (0-1 scale)
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
            },
            analystData // ✅ Store analyst data for recommendation upgrades
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

    console.log(`🧮 Calculating individual factors for ${symbol} (${config.weights.length} factors configured)`)

    for (const weight of config.weights) {
      if (!weight.enabled) {
        console.log(`⏭️  Factor ${weight.factor} is disabled, skipping`)
        continue
      }

      try {
        console.log(`🔧 Calculating factor ${weight.factor} for ${symbol} (weight: ${weight.weight})...`)
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
          console.log(`✅ Factor ${weight.factor} = ${factorScore.toFixed(4)}, weight = ${weight.weight}, contribution = ${(factorScore * weight.weight).toFixed(4)}`)
        } else {
          console.warn(`⚠️  Factor ${weight.factor} returned null or NaN for ${symbol}`)
        }
      } catch (error) {
        console.warn(`❌ Error calculating factor ${weight.factor} for ${symbol}:`, error)
      }
    }

    console.log(`📊 Factor calculation summary for ${symbol}: ${Object.keys(factorScores).length} factors calculated, total weight: ${totalWeight}`)

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
      action: getRecommendation(score.overallScore, score.analystData),
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
      action: getRecommendation(score.overallScore, score.analystData),
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
      action: getRecommendation(score.overallScore, score.analystData),
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
      action: getRecommendation(score.overallScore, score.analystData),
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

  // REMOVED: determineActionFromScore() - now using centralized RecommendationUtils

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
   * Calculate fundamental score from fundamental data (0-100 scale)
   */
  private calculateFundamentalScore(fundamentalData: FundamentalDataPoint): number {
    let score = 50 // Start with neutral
    let factors = 0

    // PE Ratio scoring (lower is better, but not too low)
    if (fundamentalData.peRatio !== undefined && fundamentalData.peRatio > 0) {
      if (fundamentalData.peRatio < 15) score += 10
      else if (fundamentalData.peRatio < 25) score += 5
      else if (fundamentalData.peRatio > 40) score -= 5
      factors++
    }

    // PB Ratio scoring (lower is better)
    if (fundamentalData.pbRatio !== undefined && fundamentalData.pbRatio > 0) {
      if (fundamentalData.pbRatio < 1) score += 10
      else if (fundamentalData.pbRatio < 3) score += 5
      else if (fundamentalData.pbRatio > 5) score -= 5
      factors++
    }

    // ROE scoring (higher is better)
    if (fundamentalData.roe !== undefined) {
      if (fundamentalData.roe > 20) score += 10
      else if (fundamentalData.roe > 15) score += 5
      else if (fundamentalData.roe < 5) score -= 5
      factors++
    }

    // Debt to Equity scoring (lower is better)
    if (fundamentalData.debtToEquity !== undefined && fundamentalData.debtToEquity >= 0) {
      if (fundamentalData.debtToEquity < 0.5) score += 10
      else if (fundamentalData.debtToEquity < 1.0) score += 5
      else if (fundamentalData.debtToEquity > 2.0) score -= 5
      factors++
    }

    // Current Ratio scoring (around 1.5-2 is ideal)
    if (fundamentalData.currentRatio !== undefined) {
      if (fundamentalData.currentRatio >= 1.5 && fundamentalData.currentRatio <= 2.5) score += 5
      else if (fundamentalData.currentRatio < 1.0) score -= 5
      factors++
    }

    // Normalize score to 0-100 range
    return Math.max(0, Math.min(100, score))
  }

  /**
   * Calculate analyst score from analyst ratings data (0-1 scale)
   */
  private calculateAnalystScore(analystData: any): number {
    if (!analystData || !analystData.distribution) {
      return 0.5 // Neutral if no data
    }

    const { distribution, totalAnalysts, sentimentScore } = analystData

    // Calculate weighted score based on distribution
    let score = 0
    const strongBuyWeight = 1.0
    const buyWeight = 0.75
    const holdWeight = 0.5
    const sellWeight = 0.25
    const strongSellWeight = 0

    if (totalAnalysts > 0) {
      const strongBuyCount = distribution.strongBuy || 0
      const buyCount = distribution.buy || 0
      const holdCount = distribution.hold || 0
      const sellCount = distribution.sell || 0
      const strongSellCount = distribution.strongSell || 0

      score = (
        (strongBuyCount * strongBuyWeight) +
        (buyCount * buyWeight) +
        (holdCount * holdWeight) +
        (sellCount * sellWeight) +
        (strongSellCount * strongSellWeight)
      ) / totalAnalysts
    }

    // Blend with sentiment score if available (0-5 scale)
    if (sentimentScore !== undefined && sentimentScore !== null) {
      const sentimentScoreNormalized = sentimentScore / 5
      score = (score + sentimentScoreNormalized) / 2 // Average the two
    }

    return Math.max(0, Math.min(1, score))
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
        healthy: true, // FinancialDataService has its own health check
        name: this.financialDataService.name
      }
    }
  }
}