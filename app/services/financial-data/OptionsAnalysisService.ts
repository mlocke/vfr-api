/**
 * OptionsAnalysisService - High-Performance Options Data Analysis
 *
 * Performance Targets:
 * - analyzeOptionsData(): <400ms total
 * - Individual methods: <100ms each
 * - Memory usage: <2MB for typical options chain
 * - Cache hit ratio: >85% during market hours
 *
 * Optimizations:
 * - Memory-efficient processing with streaming algorithms
 * - Parallel analysis using Promise.allSettled
 * - Selective data extraction for large chains
 * - Optimized mathematical operations
 * - Multi-tier caching strategy
 */

import { EODHDAPI } from './EODHDAPI'
import { RedisCache } from '../cache/RedisCache'
import { SecurityValidator } from '../security/SecurityValidator'
import ErrorHandler from '../error-handling/ErrorHandler'
import {
  OptionsChain,
  OptionsContract,
  OptionsAnalysisMetrics,
  PutCallRatio,
  UnusualActivity,
  VolatilityAnalysis,
  OptionsFlowSignals,
  PerformanceMetrics
} from '../types/OptionsTypes'
import { StockData } from './types'

export class OptionsAnalysisService {
  private readonly eodhdAPI: EODHDAPI
  private readonly cache: RedisCache
  private readonly errorHandler: typeof ErrorHandler

  // Performance configuration
  private readonly PERFORMANCE_CONFIG = {
    MAX_CONTRACTS_MEMORY: 1000,     // Max contracts to process in memory
    BATCH_SIZE: 100,                // Batch processing size
    COMPRESSION_THRESHOLD: 500,     // When to compress options chains
    PARALLEL_TIMEOUT: 5000,         // 5s timeout for parallel operations
    LIQUIDITY_FILTER_MIN: 10        // Minimum volume for liquidity filtering
  }

  // Cache TTL configuration optimized for market hours
  private readonly CACHE_CONFIG = {
    MARKET_HOURS: {
      ANALYSIS: 180,        // 3 minutes - high-frequency updates
      PUT_CALL_RATIO: 120,  // 2 minutes - rapid sentiment changes
      FLOW_SIGNALS: 60,     // 1 minute - real-time flow detection
      IV_ANALYSIS: 300      // 5 minutes - volatility surface stability
    },
    AFTER_HOURS: {
      ANALYSIS: 900,        // 15 minutes
      PUT_CALL_RATIO: 600,  // 10 minutes
      FLOW_SIGNALS: 300,    // 5 minutes
      IV_ANALYSIS: 1800     // 30 minutes
    }
  }

  constructor(cache: RedisCache) {
    this.eodhdAPI = new EODHDAPI()
    this.cache = cache
    this.errorHandler = ErrorHandler
  }

  /**
   * Main analysis method with <400ms performance target
   * Uses parallel processing and memory optimization
   */
  async analyzeOptionsData(symbol: string): Promise<OptionsAnalysisMetrics | null> {
    const performanceTracker = this.createPerformanceTracker('analyzeOptionsData')

    try {
      // Input validation
      const validation = SecurityValidator.getInstance().validateSymbol(symbol)
      if (!validation.isValid) {
        throw new Error(`Invalid symbol: ${validation.errors.join(', ')}`)
      }

      const normalizedSymbol = validation.sanitized!

      // Check cache first with smart key strategy
      const cacheKey = this.getCacheKey('analysis', normalizedSymbol)
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        performanceTracker.addMetric('cacheHit', true)
        return cached
      }

      // Get optimized options chain
      const optionsChain = await this.getOptimizedOptionsChain(normalizedSymbol)
      if (!optionsChain || this.isChainEmpty(optionsChain)) {
        return null
      }

      performanceTracker.addMetric('contractsLoaded', optionsChain.calls.length + optionsChain.puts.length)

      // Parallel analysis execution for maximum performance
      const analysisPromises = [
        this.calculatePutCallRatioOptimized(optionsChain),
        this.calculateVolatilityAnalysisOptimized(optionsChain),
        this.detectUnusualActivityOptimized(optionsChain),
        this.calculateOptionsFlowSignals(optionsChain)
      ]

      const results = await Promise.allSettled(analysisPromises)

      // Extract results with error handling
      const [pcRatio, volatilityAnalysis, unusualActivity, flowSignals] = results.map(
        (result, index) => {
          if (result.status === 'fulfilled') {
            return result.value
          } else {
            console.warn(`Options analysis component ${index} failed:`, result.reason)
            return this.getDefaultComponentValue(index)
          }
        }
      )

      const metrics: OptionsAnalysisMetrics = {
        symbol: normalizedSymbol,
        putCallRatio: pcRatio,
        volatilityAnalysis,
        unusualActivity,
        flowSignals,
        timestamp: Date.now(),
        performance: performanceTracker.getMetrics(),
        confidence: this.calculateConfidence(pcRatio, volatilityAnalysis, unusualActivity),
        source: 'eodhd'
      }

      // Cache with optimized TTL using RedisCache
      const ttl = this.getOptimalTTL('ANALYSIS')
      await this.cache.cacheOptionsData(normalizedSymbol, 'options', metrics, 'eodhd')

      performanceTracker.complete()
      return metrics

    } catch (error) {
      performanceTracker.addError(error)
      console.error('OptionsAnalysisService.analyzeOptionsData error:', SecurityValidator.getInstance().sanitizeErrorMessage(error))
      return null
    }
  }

  /**
   * Optimized P/C ratio calculation with liquidity filtering
   * Target: <100ms execution time
   */
  private async calculatePutCallRatioOptimized(optionsChain: OptionsChain): Promise<PutCallRatio> {
    const performanceTracker = this.createPerformanceTracker('putCallRatio')

    try {
      // Filter for liquid contracts only to reduce processing load
      const liquidCalls = optionsChain.calls.filter(c =>
        c.volume >= this.PERFORMANCE_CONFIG.LIQUIDITY_FILTER_MIN ||
        c.openInterest >= this.PERFORMANCE_CONFIG.LIQUIDITY_FILTER_MIN
      )

      const liquidPuts = optionsChain.puts.filter(p =>
        p.volume >= this.PERFORMANCE_CONFIG.LIQUIDITY_FILTER_MIN ||
        p.openInterest >= this.PERFORMANCE_CONFIG.LIQUIDITY_FILTER_MIN
      )

      // Optimized aggregation using reduce for single-pass calculation
      const callStats = liquidCalls.reduce((acc, contract) => ({
        totalVolume: acc.totalVolume + contract.volume,
        totalOI: acc.totalOI + contract.openInterest,
        count: acc.count + 1
      }), { totalVolume: 0, totalOI: 0, count: 0 })

      const putStats = liquidPuts.reduce((acc, contract) => ({
        totalVolume: acc.totalVolume + contract.volume,
        totalOI: acc.totalOI + contract.openInterest,
        count: acc.count + 1
      }), { totalVolume: 0, totalOI: 0, count: 0 })

      const ratio: PutCallRatio = {
        symbol: optionsChain.symbol,
        volumeRatio: callStats.totalVolume > 0 ? putStats.totalVolume / callStats.totalVolume : 0,
        openInterestRatio: callStats.totalOI > 0 ? putStats.totalOI / callStats.totalOI : 0,
        totalPutVolume: putStats.totalVolume,
        totalCallVolume: callStats.totalVolume,
        totalPutOpenInterest: putStats.totalOI,
        totalCallOpenInterest: callStats.totalOI,
        liquidContractsOnly: true,
        timestamp: Date.now()
      }

      performanceTracker.complete()
      return ratio

    } catch (error) {
      performanceTracker.addError(error)
      throw error
    }
  }

  /**
   * Memory-efficient volatility analysis with streaming calculations
   * Target: <100ms execution time
   */
  private async calculateVolatilityAnalysisOptimized(optionsChain: OptionsChain): Promise<VolatilityAnalysis> {
    const performanceTracker = this.createPerformanceTracker('volatilityAnalysis')

    try {
      // Process contracts in batches to manage memory
      const allContracts = [...optionsChain.calls, ...optionsChain.puts]
      const batchSize = this.PERFORMANCE_CONFIG.BATCH_SIZE

      let ivSum = 0
      let ivCount = 0
      let minIV = Infinity
      let maxIV = -Infinity
      const ivByStrike: Map<number, number[]> = new Map()

      // Streaming processing to minimize memory footprint
      for (let i = 0; i < allContracts.length; i += batchSize) {
        const batch = allContracts.slice(i, i + batchSize)

        for (const contract of batch) {
          if (contract.impliedVolatility && contract.impliedVolatility > 0) {
            ivSum += contract.impliedVolatility
            ivCount++
            minIV = Math.min(minIV, contract.impliedVolatility)
            maxIV = Math.max(maxIV, contract.impliedVolatility)

            // Track IV by strike for skew calculation
            if (!ivByStrike.has(contract.strike)) {
              ivByStrike.set(contract.strike, [])
            }
            ivByStrike.get(contract.strike)!.push(contract.impliedVolatility)
          }
        }

        // Force garbage collection for large datasets
        if (i > 0 && i % (batchSize * 5) === 0 && global.gc) {
          global.gc()
        }
      }

      const avgIV = ivCount > 0 ? ivSum / ivCount : 0
      const ivRange = maxIV - minIV

      // Calculate volatility skew using optimized linear regression
      const skew = this.calculateVolatilitySkewOptimized(ivByStrike)

      const analysis: VolatilityAnalysis = {
        symbol: optionsChain.symbol,
        averageImpliedVolatility: avgIV,
        impliedVolatilityRange: { min: minIV, max: maxIV },
        volatilitySkew: skew,
        impliedVolatilityPercentile: this.calculateIVPercentile(avgIV, minIV, maxIV),
        contractsAnalyzed: ivCount,
        timestamp: Date.now()
      }

      performanceTracker.complete()
      return analysis

    } catch (error) {
      performanceTracker.addError(error)
      throw error
    }
  }

  /**
   * Optimized unusual activity detection with selective data extraction
   * Target: <100ms execution time
   */
  private async detectUnusualActivityOptimized(optionsChain: OptionsChain): Promise<UnusualActivity> {
    const performanceTracker = this.createPerformanceTracker('unusualActivity')

    try {
      const allContracts = [...optionsChain.calls, ...optionsChain.puts]

      // Pre-filter for high-volume contracts to reduce processing load
      const highVolumeContracts = allContracts.filter(c => c.volume >= 100)

      // Calculate volume statistics using optimized single-pass algorithm
      const volumeStats = highVolumeContracts.reduce((stats, contract) => {
        stats.totalVolume += contract.volume
        stats.maxVolume = Math.max(stats.maxVolume, contract.volume)
        stats.contractCount++

        // Track large transactions (>1000 volume)
        if (contract.volume >= 1000) {
          stats.largeTransactions++
          stats.largeTransactionVolume += contract.volume
        }

        return stats
      }, {
        totalVolume: 0,
        maxVolume: 0,
        contractCount: 0,
        largeTransactions: 0,
        largeTransactionVolume: 0
      })

      const avgVolume = volumeStats.contractCount > 0 ? volumeStats.totalVolume / volumeStats.contractCount : 0
      const volumeRatio = avgVolume > 0 ? volumeStats.maxVolume / avgVolume : 0

      // Detect institutional signals using optimized pattern matching
      const institutionalSignals = this.detectInstitutionalSignalsOptimized(highVolumeContracts)

      const activity: UnusualActivity = {
        symbol: optionsChain.symbol,
        volumeRatio,
        maxSingleContractVolume: volumeStats.maxVolume,
        largeTransactions: volumeStats.largeTransactions,
        totalLargeTransactionVolume: volumeStats.largeTransactionVolume,
        institutionalSignals,
        averageVolume: avgVolume,
        contractsAnalyzed: volumeStats.contractCount,
        timestamp: Date.now()
      }

      performanceTracker.complete()
      return activity

    } catch (error) {
      performanceTracker.addError(error)
      throw error
    }
  }

  /**
   * Optimized options flow signals calculation
   * Target: <100ms execution time
   */
  private async calculateOptionsFlowSignals(optionsChain: OptionsChain): Promise<OptionsFlowSignals> {
    const performanceTracker = this.createPerformanceTracker('flowSignals')

    try {
      // Parallel calculation of flow components
      const [momentumSignal, convexitySignal, termStructureSignal] = await Promise.allSettled([
        this.calculateMomentumSignalOptimized(optionsChain),
        this.calculateConvexitySignalOptimized(optionsChain),
        this.calculateTermStructureSignalOptimized(optionsChain)
      ])

      const signals: OptionsFlowSignals = {
        symbol: optionsChain.symbol,
        momentum: momentumSignal.status === 'fulfilled' ? momentumSignal.value : 50,
        convexity: convexitySignal.status === 'fulfilled' ? convexitySignal.value : 50,
        termStructure: termStructureSignal.status === 'fulfilled' ? termStructureSignal.value : 50,
        composite: 0, // Will be calculated below
        timestamp: Date.now()
      }

      // Calculate composite signal with optimized weighting
      signals.composite = (
        signals.momentum * 0.4 +
        signals.convexity * 0.35 +
        signals.termStructure * 0.25
      )

      performanceTracker.complete()
      return signals

    } catch (error) {
      performanceTracker.addError(error)
      throw error
    }
  }

  /**
   * Enhanced UnicornBay Put/Call ratio with advanced metrics
   * Leverages 40+ fields per contract for superior analysis
   */
  async calculateUnicornBayPutCallSignals(symbol: string): Promise<PutCallRatio | null> {
    try {
      const cacheKey = `unicorn_pc_ratio:${symbol}`
      const cached = await this.cache.getCachedOptionsData<PutCallRatio>(symbol, 'put_call_ratio')
      if (cached) return cached

      const ratio = await this.eodhdAPI.getUnicornBayPutCallRatio(symbol)
      if (!ratio) return null

      // Cache with high-frequency TTL for real-time sentiment
      await this.cache.cacheOptionsData(symbol, 'put_call_ratio', ratio, 'eodhd-unicornbay')

      return ratio
    } catch (error) {
      console.warn(`UnicornBay P/C ratio failed for ${symbol}:`, SecurityValidator.getInstance().sanitizeErrorMessage(error))
      return null
    }
  }

  /**
   * Advanced Greeks risk analysis using UnicornBay enhanced data
   * Provides portfolio-level Greeks aggregation and risk metrics
   */
  async calculateGreeksRiskAnalysis(symbol: string): Promise<any | null> {
    try {
      const cacheKey = `greeks_analysis:${symbol}`
      const cached = await this.cache.get(cacheKey)
      if (cached) return cached

      const greeksData = await this.eodhdAPI.getUnicornBayGreeksAnalysis(symbol)
      if (!greeksData) return null

      // Enhanced risk assessment
      const riskAnalysis = {
        ...greeksData,
        riskAssessment: this.assessPortfolioRisk(greeksData.portfolioGreeks, greeksData.riskMetrics),
        riskScore: this.calculateRiskScore(greeksData.portfolioGreeks, greeksData.riskMetrics),
        recommendations: this.generateGreeksRecommendations(greeksData)
      }

      // Cache with medium TTL for Greeks stability
      await this.cache.set(cacheKey, riskAnalysis, 300)

      return riskAnalysis
    } catch (error) {
      console.warn(`Greeks analysis failed for ${symbol}:`, SecurityValidator.getInstance().sanitizeErrorMessage(error))
      return null
    }
  }

  /**
   * IV Surface analysis for volatility regime detection
   * Provides term structure and skew analysis
   */
  async calculateIVSurfaceAnalysis(symbol: string): Promise<any | null> {
    try {
      const cacheKey = `iv_surface:${symbol}`
      const cached = await this.cache.get(cacheKey)
      if (cached) return cached

      const ivSurface = await this.eodhdAPI.getUnicornBayIVSurface(symbol)
      if (!ivSurface) return null

      // Enhanced IV analysis
      const analysis = {
        ...ivSurface,
        volatilityRegime: this.determineVolatilityRegime(ivSurface.marketMetrics),
        tradingSignals: this.generateVolatilitySignals(ivSurface.marketMetrics),
        riskWarnings: this.assessVolatilityRisks(ivSurface.marketMetrics)
      }

      // Cache with longer TTL for IV surface stability
      await this.cache.set(cacheKey, analysis, 600)

      return analysis
    } catch (error) {
      console.warn(`IV Surface analysis failed for ${symbol}:`, SecurityValidator.getInstance().sanitizeErrorMessage(error))
      return null
    }
  }

  /**
   * Options flow analysis for institutional sentiment
   * Detects smart money activity and unusual flow patterns
   */
  async calculateOptionsFlowAnalysis(symbols: string[]): Promise<any[] | null> {
    try {
      // Validate batch size
      if (symbols.length > 20) {
        throw new Error('Maximum 20 symbols allowed for options flow analysis')
      }

      const flowData = await this.eodhdAPI.getUnicornBayOptionsFlow(symbols)
      if (!flowData) return null

      // Enhanced flow analysis with sentiment scoring
      const enhancedFlow = flowData.map(flow => ({
        ...flow,
        sentimentScore: this.calculateFlowSentimentScore(flow.flowMetrics),
        signalStrength: this.assessFlowSignalStrength(flow.flowMetrics),
        marketImpact: this.estimateMarketImpact(flow.flowMetrics)
      }))

      return enhancedFlow
    } catch (error) {
      console.warn(`Options flow analysis failed:`, SecurityValidator.getInstance().sanitizeErrorMessage(error))
      return null
    }
  }

  /**
   * Comprehensive options analysis with all UnicornBay features
   * Target: <500ms execution time
   */
  async analyzeOptionsDataEnhanced(symbol: string): Promise<any | null> {
    const startTime = performance.now()

    try {
      // Input validation
      const validation = SecurityValidator.getInstance().validateSymbol(symbol)
      if (!validation.isValid) {
        throw new Error(`Invalid symbol: ${validation.errors.join(', ')}`)
      }

      const normalizedSymbol = validation.sanitized!

      // Parallel execution of all enhanced analyses
      const [
        putCallSignals,
        greeksAnalysis,
        ivSurfaceAnalysis,
        optionsFlow
      ] = await Promise.allSettled([
        this.calculateUnicornBayPutCallSignals(normalizedSymbol),
        this.calculateGreeksRiskAnalysis(normalizedSymbol),
        this.calculateIVSurfaceAnalysis(normalizedSymbol),
        this.calculateOptionsFlowAnalysis([normalizedSymbol])
      ])

      const result = {
        symbol: normalizedSymbol,
        putCallSignals: putCallSignals.status === 'fulfilled' ? putCallSignals.value : null,
        greeksAnalysis: greeksAnalysis.status === 'fulfilled' ? greeksAnalysis.value : null,
        ivSurfaceAnalysis: ivSurfaceAnalysis.status === 'fulfilled' ? ivSurfaceAnalysis.value : null,
        optionsFlow: optionsFlow.status === 'fulfilled' ? optionsFlow.value?.[0] : null,
        insights: this.generateEnhancedInsights(
          putCallSignals.status === 'fulfilled' ? putCallSignals.value : null,
          greeksAnalysis.status === 'fulfilled' ? greeksAnalysis.value : null,
          ivSurfaceAnalysis.status === 'fulfilled' ? ivSurfaceAnalysis.value : null,
          optionsFlow.status === 'fulfilled' ? optionsFlow.value?.[0] : null
        ),
        performance: {
          executionTime: performance.now() - startTime,
          dataQuality: this.assessDataQuality([putCallSignals, greeksAnalysis, ivSurfaceAnalysis, optionsFlow])
        },
        timestamp: Date.now(),
        source: 'eodhd-unicornbay-enhanced'
      }

      // Cache comprehensive result
      await this.cache.set(`enhanced_analysis:${normalizedSymbol}`, result, 300)

      console.log(`✅ Enhanced options analysis complete for ${normalizedSymbol} in ${(performance.now() - startTime).toFixed(0)}ms`)
      return result

    } catch (error) {
      const sanitizedError = SecurityValidator.getInstance().sanitizeErrorMessage(error)
      console.error(`❌ Enhanced options analysis failed for ${symbol}:`, sanitizedError)
      return null
    }
  }

  /**
   * Helper methods for enhanced analysis
   */
  private assessPortfolioRisk(portfolioGreeks: any, riskMetrics: any): 'LOW' | 'MEDIUM' | 'HIGH' {
    const riskFactors = [
      riskMetrics.pinRisk > 0.3,
      riskMetrics.gammaSqueezeRisk > 0.5,
      riskMetrics.volatilityRisk === 'HIGH',
      Math.abs(portfolioGreeks.totalTheta) > 5000
    ].filter(Boolean).length

    if (riskFactors >= 3) return 'HIGH'
    if (riskFactors >= 2) return 'MEDIUM'
    return 'LOW'
  }

  private calculateRiskScore(portfolioGreeks: any, riskMetrics: any): number {
    // Normalized risk score 0-10 (0=lowest risk, 10=highest risk)
    const factors = [
      Math.min(10, riskMetrics.pinRisk * 10),
      Math.min(10, riskMetrics.gammaSqueezeRisk * 10),
      riskMetrics.volatilityRisk === 'HIGH' ? 8 : riskMetrics.volatilityRisk === 'MEDIUM' ? 5 : 2,
      Math.min(10, Math.abs(portfolioGreeks.totalTheta) / 1000)
    ]

    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length
  }

  private generateGreeksRecommendations(greeksData: any): string[] {
    const recommendations: string[] = []
    const portfolio = greeksData.portfolioGreeks
    const risk = greeksData.riskMetrics

    if (Math.abs(portfolio.totalDelta) > 100) {
      recommendations.push(`High delta exposure: Consider hedging ${Math.abs(portfolio.totalDelta).toFixed(0)} delta`)
    }

    if (portfolio.totalTheta < -1000) {
      recommendations.push(`Significant time decay: ${Math.abs(portfolio.totalTheta).toFixed(0)}/day theta exposure`)
    }

    if (risk.gammaSqueezeRisk > 0.5) {
      recommendations.push('Elevated gamma squeeze risk: Monitor for rapid price movements')
    }

    if (risk.pinRisk > 0.3) {
      recommendations.push('Options pin risk present: Price may gravitate toward strike levels')
    }

    return recommendations
  }

  private determineVolatilityRegime(marketMetrics: any): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (marketMetrics.atmIV < 0.15) return 'LOW'
    if (marketMetrics.atmIV > 0.35) return 'HIGH'
    return 'MEDIUM'
  }

  private generateVolatilitySignals(marketMetrics: any): string[] {
    const signals: string[] = []

    if (marketMetrics.ivRank < 30) {
      signals.push('Low IV rank: Consider buying volatility')
    } else if (marketMetrics.ivRank > 70) {
      signals.push('High IV rank: Consider selling volatility')
    }

    if (marketMetrics.termStructure === 'INVERTED') {
      signals.push('Inverted term structure: Near-term volatility elevated')
    }

    if (marketMetrics.skewDirection === 'PUT') {
      signals.push('Put skew present: Downside protection premium')
    }

    return signals
  }

  private assessVolatilityRisks(marketMetrics: any): string[] {
    const risks: string[] = []

    if (marketMetrics.atmIV > 0.40) {
      risks.push('Very high volatility: Elevated option premiums')
    }

    if (marketMetrics.termStructure === 'INVERTED') {
      risks.push('Term structure inversion: Potential volatility event expected')
    }

    return risks
  }

  private calculateFlowSentimentScore(flowMetrics: any): number {
    // Sentiment score from -10 to +10
    let score = 0

    // Flow ratio impact
    if (flowMetrics.flowRatio > 1.5) score += 3
    else if (flowMetrics.flowRatio > 1.2) score += 1
    else if (flowMetrics.flowRatio < 0.7) score -= 3
    else if (flowMetrics.flowRatio < 0.8) score -= 1

    // Unusual activity boost
    if (flowMetrics.unusualActivity) {
      score = flowMetrics.institutionalSentiment === 'BULLISH' ? score + 2 : score - 2
    }

    return Math.max(-10, Math.min(10, score))
  }

  private assessFlowSignalStrength(flowMetrics: any): 'WEAK' | 'MODERATE' | 'STRONG' {
    const strength = Math.abs(flowMetrics.flowRatio - 1)
    if (strength > 0.5 && flowMetrics.unusualActivity) return 'STRONG'
    if (strength > 0.3) return 'MODERATE'
    return 'WEAK'
  }

  private estimateMarketImpact(flowMetrics: any): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (flowMetrics.unusualActivity && Math.abs(flowMetrics.netFlow) > 1000000) return 'HIGH'
    if (Math.abs(flowMetrics.netFlow) > 500000) return 'MEDIUM'
    return 'LOW'
  }

  private generateEnhancedInsights(putCallSignals: any, greeksAnalysis: any, ivSurfaceAnalysis: any, optionsFlow: any): any {
    const insights = {
      primarySignal: 'HOLD' as 'BUY' | 'SELL' | 'HOLD',
      signalStrength: 5,
      keyObservations: [] as string[],
      riskWarnings: [] as string[],
      tradingOpportunities: [] as string[]
    }

    // Analyze put/call signals
    if (putCallSignals) {
      if (putCallSignals.volumeRatio > 1.3) {
        insights.keyObservations.push(`High put volume: P/C ratio ${putCallSignals.volumeRatio.toFixed(2)}`)
        insights.primarySignal = 'SELL'
        insights.signalStrength = 7
      } else if (putCallSignals.volumeRatio < 0.7) {
        insights.keyObservations.push(`High call volume: P/C ratio ${putCallSignals.volumeRatio.toFixed(2)}`)
        insights.primarySignal = 'BUY'
        insights.signalStrength = 7
      }
    }

    // Analyze IV surface
    if (ivSurfaceAnalysis) {
      if (ivSurfaceAnalysis.volatilityRegime === 'HIGH') {
        insights.riskWarnings.push('High volatility environment increases option costs')
        insights.tradingOpportunities.push('Consider selling premium strategies')
      } else if (ivSurfaceAnalysis.volatilityRegime === 'LOW') {
        insights.tradingOpportunities.push('Low volatility: Consider buying options before expansion')
      }
    }

    // Analyze options flow
    if (optionsFlow) {
      if (optionsFlow.flowMetrics.unusualActivity) {
        insights.keyObservations.push('Unusual options activity detected')
        if (optionsFlow.marketImpact === 'HIGH') {
          insights.riskWarnings.push('High-impact institutional flow may drive price movement')
        }
      }
    }

    // Analyze Greeks
    if (greeksAnalysis) {
      if (greeksAnalysis.riskScore > 7) {
        insights.riskWarnings.push('High Greeks-based risk detected')
      }
      insights.riskWarnings.push(...(greeksAnalysis.recommendations || []))
    }

    return insights
  }

  private assessDataQuality(results: any[]): number {
    const successfulResults = results.filter(r => r.status === 'fulfilled' && r.value).length
    return (successfulResults / results.length) * 100
  }

  /**
   * Health check for UnicornBay enhanced features
   */
  async healthCheckEnhanced(): Promise<{ available: boolean; features: string[]; errors?: string[] }> {
    try {
      const availability = await this.eodhdAPI.checkOptionsAvailability()
      const features: string[] = []
      const errors: string[] = []

      if (availability.putCallRatio) features.push('Put/Call Ratios')
      if (availability.optionsChain) features.push('Options Chains')
      if (availability.unicornBayEnhanced) features.push('UnicornBay Enhanced Data')
      if (availability.unicornBayGreeks) features.push('Advanced Greeks Analysis')
      if (availability.unicornBayIVSurface) features.push('IV Surface Analysis')
      if (availability.unicornBayOptionsFlow) features.push('Options Flow Analysis')

      if (availability.error) {
        errors.push(availability.errorMessage as string || 'Unknown error')
      }

      return {
        available: features.length > 0,
        features,
        errors: errors.length > 0 ? errors : undefined
      }
    } catch (error) {
      return {
        available: false,
        features: [],
        errors: [SecurityValidator.getInstance().sanitizeErrorMessage(error)]
      }
    }
  }

  /**
   * Memory-efficient options chain retrieval with compression
   */
  private async getOptimizedOptionsChain(symbol: string): Promise<OptionsChain | null> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey('chain', symbol)
      const cached = await this.cache.getCachedOptionsData<OptionsChain>(symbol, 'options_chain')
      if (cached) return cached

      // Fetch from API with timeout - try UnicornBay enhanced first
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.PERFORMANCE_CONFIG.PARALLEL_TIMEOUT)

      try {
        // Try UnicornBay enhanced options chain first for better data quality
        let chain = await this.eodhdAPI.getUnicornBayOptionsChain(symbol)

        // Fallback to standard options chain if UnicornBay fails
        if (!chain) {
          console.log(`🔄 UnicornBay unavailable for ${symbol}, falling back to standard options`)
          chain = await this.eodhdAPI.getOptionsChain(symbol)
        }

        clearTimeout(timeout)

        if (!chain) return null

        // Compress large chains to reduce memory usage
        const optimizedChain = this.compressOptionsChain(chain)

        // Cache with RedisCache optimized TTL
        await this.cache.cacheOptionsData(symbol, 'options_chain', optimizedChain, 'eodhd')

        return optimizedChain

      } catch (error) {
        clearTimeout(timeout)
        throw error
      }

    } catch (error) {
      const sanitizedError = SecurityValidator.getInstance().sanitizeErrorMessage(error)
      console.warn(`Failed to get options chain for ${symbol}:`, sanitizedError)
      return null
    }
  }

  /**
   * Compress options chain for memory efficiency
   * Removes low-volume contracts and redundant data
   */
  private compressOptionsChain(chain: OptionsChain): OptionsChain {
    const totalContracts = chain.calls.length + chain.puts.length

    if (totalContracts <= this.PERFORMANCE_CONFIG.COMPRESSION_THRESHOLD) {
      return chain // No compression needed
    }

    // Filter for liquid contracts only
    const liquidCalls = chain.calls.filter(c =>
      c.volume > 0 || c.openInterest >= this.PERFORMANCE_CONFIG.LIQUIDITY_FILTER_MIN
    )

    const liquidPuts = chain.puts.filter(p =>
      p.volume > 0 || p.openInterest >= this.PERFORMANCE_CONFIG.LIQUIDITY_FILTER_MIN
    )

    // Keep only essential fields for memory optimization
    const compressContract = (contract: OptionsContract): OptionsContract => ({
      symbol: contract.symbol,
      strike: contract.strike,
      expiration: contract.expiration,
      type: contract.type,
      volume: contract.volume,
      openInterest: contract.openInterest,
      impliedVolatility: contract.impliedVolatility,
      delta: contract.delta,
      bid: contract.bid,
      ask: contract.ask,
      lastPrice: contract.lastPrice,
      timestamp: contract.timestamp,
      source: contract.source
    })

    return {
      ...chain,
      calls: liquidCalls.map(compressContract),
      puts: liquidPuts.map(compressContract),
      compressed: true,
      originalContractCount: totalContracts
    }
  }

  /**
   * Optimized volatility skew calculation using linear regression
   */
  private calculateVolatilitySkewOptimized(ivByStrike: Map<number, number[]>): number {
    const dataPoints: Array<[number, number]> = []

    // Calculate average IV for each strike
    for (const [strike, ivs] of Array.from(ivByStrike.entries())) {
      const avgIV = ivs.reduce((sum, iv) => sum + iv, 0) / ivs.length
      dataPoints.push([strike, avgIV])
    }

    if (dataPoints.length < 3) return 0

    // Fast linear regression for skew calculation
    const n = dataPoints.length
    const sumX = dataPoints.reduce((sum, [x]) => sum + x, 0)
    const sumY = dataPoints.reduce((sum, [, y]) => sum + y, 0)
    const sumXY = dataPoints.reduce((sum, [x, y]) => sum + x * y, 0)
    const sumX2 = dataPoints.reduce((sum, [x]) => sum + x * x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    // Return skew as percentage (slope * 100)
    return slope * 100
  }

  /**
   * Fast institutional signals detection
   */
  private detectInstitutionalSignalsOptimized(contracts: OptionsContract[]): string[] {
    const signals: string[] = []

    // Block trade detection (volume > 1000)
    const blockTrades = contracts.filter(c => c.volume >= 1000).length
    if (blockTrades > 0) {
      signals.push(`${blockTrades} large block trade${blockTrades > 1 ? 's' : ''} detected`)
    }

    // Unusual volume patterns
    const totalVolume = contracts.reduce((sum, c) => sum + c.volume, 0)
    const avgVolume = totalVolume / contracts.length
    const highVolumeContracts = contracts.filter(c => c.volume > avgVolume * 3).length

    if (highVolumeContracts > contracts.length * 0.1) {
      signals.push('Elevated volume activity above normal patterns')
    }

    return signals
  }

  /**
   * Optimized momentum signal calculation
   */
  private async calculateMomentumSignalOptimized(optionsChain: OptionsChain): Promise<number> {
    // Simple momentum based on volume-weighted P/C ratio
    const calls = optionsChain.calls
    const puts = optionsChain.puts

    const callMomentum = calls.reduce((sum, c) => sum + c.volume, 0)
    const putMomentum = puts.reduce((sum, p) => sum + p.volume, 0)

    const totalMomentum = callMomentum + putMomentum
    if (totalMomentum === 0) return 50

    // Convert to 0-100 scale where >50 is bullish momentum
    return Math.min(100, Math.max(0, (callMomentum / totalMomentum) * 100))
  }

  /**
   * Optimized convexity signal calculation
   */
  private async calculateConvexitySignalOptimized(optionsChain: OptionsChain): Promise<number> {
    // Simple convexity based on gamma-weighted positions
    const allContracts = [...optionsChain.calls, ...optionsChain.puts]
    const gammaWeightedPositions = allContracts.reduce((sum, c) => {
      if (c.gamma && c.volume > 0) {
        return sum + (c.gamma * c.volume)
      }
      return sum
    }, 0)

    // Normalize to 0-100 scale
    return Math.min(100, Math.max(0, 50 + (gammaWeightedPositions * 10)))
  }

  /**
   * Optimized term structure signal calculation
   */
  private async calculateTermStructureSignalOptimized(optionsChain: OptionsChain): Promise<number> {
    // Group contracts by expiration and calculate IV term structure
    const expirationGroups: Map<string, OptionsContract[]> = new Map()

    for (const contract of [...optionsChain.calls, ...optionsChain.puts]) {
      if (!expirationGroups.has(contract.expiration)) {
        expirationGroups.set(contract.expiration, [])
      }
      expirationGroups.get(contract.expiration)!.push(contract)
    }

    if (expirationGroups.size < 2) return 50

    // Calculate average IV for each expiration
    const expirationIVs: Array<[string, number]> = []
    for (const [expiration, contracts] of Array.from(expirationGroups.entries())) {
      const avgIV = contracts.reduce((sum, c) => sum + (c.impliedVolatility || 0), 0) / contracts.length
      expirationIVs.push([expiration, avgIV])
    }

    // Sort by expiration date and check for contango/backwardation
    expirationIVs.sort(([a], [b]) => a.localeCompare(b))

    let signal = 50 // Neutral baseline
    for (let i = 1; i < expirationIVs.length; i++) {
      const [, currentIV] = expirationIVs[i]
      const [, previousIV] = expirationIVs[i - 1]

      if (currentIV > previousIV) {
        signal += 5 // Backwardation (bullish)
      } else {
        signal -= 5 // Contango (bearish)
      }
    }

    return Math.min(100, Math.max(0, signal))
  }

  /**
   * Smart cache key generation
   */
  private getCacheKey(type: string, symbol: string): string {
    const hour = new Date().getHours()
    const isMarketHours = hour >= 9 && hour <= 16
    const timeSegment = isMarketHours ? Math.floor(Date.now() / (5 * 60 * 1000)) : Math.floor(Date.now() / (15 * 60 * 1000))

    return `options:${type}:${symbol}:${timeSegment}`
  }

  /**
   * Dynamic TTL calculation based on market hours
   */
  private getOptimalTTL(type: 'ANALYSIS' | 'PUT_CALL_RATIO' | 'FLOW_SIGNALS' | 'IV_ANALYSIS'): number {
    const hour = new Date().getHours()
    const isMarketHours = hour >= 9 && hour <= 16

    const config = isMarketHours ? this.CACHE_CONFIG.MARKET_HOURS : this.CACHE_CONFIG.AFTER_HOURS
    return config[type] || 300
  }

  /**
   * Calculate IV percentile efficiently
   */
  private calculateIVPercentile(current: number, min: number, max: number): number {
    if (max <= min) return 50
    return ((current - min) / (max - min)) * 100
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(pcRatio: PutCallRatio, volatility: VolatilityAnalysis, activity: UnusualActivity): number {
    let confidence = 50 // Base confidence

    // Data completeness factors
    if (pcRatio.totalCallVolume > 0 && pcRatio.totalPutVolume > 0) confidence += 15
    if (volatility.contractsAnalyzed >= 50) confidence += 15
    if (activity.contractsAnalyzed >= 20) confidence += 10

    // Data freshness (within last 5 minutes)
    const dataAge = Date.now() - Math.min(pcRatio.timestamp, volatility.timestamp, activity.timestamp)
    if (dataAge < 5 * 60 * 1000) confidence += 10

    return Math.min(100, Math.max(0, confidence))
  }

  /**
   * Performance tracking utilities
   */
  private createPerformanceTracker(operation: string): PerformanceTracker {
    return new PerformanceTracker(operation)
  }

  /**
   * Default values for failed components
   */
  private getDefaultComponentValue(index: number): any {
    const defaults = [
      // PutCallRatio default
      {
        symbol: '',
        volumeRatio: 1.0,
        openInterestRatio: 1.0,
        totalPutVolume: 0,
        totalCallVolume: 0,
        totalPutOpenInterest: 0,
        totalCallOpenInterest: 0,
        timestamp: Date.now()
      },
      // VolatilityAnalysis default
      {
        symbol: '',
        averageImpliedVolatility: 0.25,
        impliedVolatilityRange: { min: 0.15, max: 0.35 },
        volatilitySkew: 0,
        impliedVolatilityPercentile: 50,
        contractsAnalyzed: 0,
        timestamp: Date.now()
      },
      // UnusualActivity default
      {
        symbol: '',
        volumeRatio: 1.0,
        maxSingleContractVolume: 0,
        largeTransactions: 0,
        totalLargeTransactionVolume: 0,
        institutionalSignals: [],
        averageVolume: 0,
        contractsAnalyzed: 0,
        timestamp: Date.now()
      },
      // OptionsFlowSignals default
      {
        symbol: '',
        momentum: 50,
        convexity: 50,
        termStructure: 50,
        composite: 50,
        timestamp: Date.now()
      }
    ]

    return defaults[index] || {}
  }

  /**
   * Check if options chain is empty or invalid
   */
  private isChainEmpty(chain: OptionsChain): boolean {
    return !chain || (chain.calls.length === 0 && chain.puts.length === 0)
  }
}

/**
 * Performance tracking class for monitoring method execution
 */
class PerformanceTracker {
  private startTime: number
  private metrics: Map<string, any> = new Map()
  private operation: string

  constructor(operation: string) {
    this.operation = operation
    this.startTime = performance.now()
  }

  addMetric(key: string, value: any): void {
    this.metrics.set(key, value)
  }

  addError(error: any): void {
    this.metrics.set('error', error.message)
    this.metrics.set('errorTime', performance.now() - this.startTime)
  }

  complete(): void {
    const endTime = performance.now()
    const duration = endTime - this.startTime

    this.metrics.set('duration', duration)
    this.metrics.set('operation', this.operation)

    // Log performance warnings
    if (duration > 100) {
      console.warn(`⚠️ ${this.operation} took ${duration.toFixed(0)}ms (target: <100ms)`)
    }
  }

  getMetrics(): PerformanceMetrics {
    return {
      operation: this.operation,
      duration: this.metrics.get('duration') || 0,
      memoryUsage: process.memoryUsage().heapUsed,
      cacheHit: this.metrics.get('cacheHit') || false,
      contractsProcessed: this.metrics.get('contractsLoaded') || 0,
      timestamp: Date.now()
    }
  }
}

export default OptionsAnalysisService