/**
 * MacroeconomicAnalysisService.ts - Core orchestration service for macro data
 * Integrates FRED, BLS, EIA, and currency data for comprehensive economic analysis
 *
 * Performance Target: <800ms complete macro context collection
 * Parallel processing efficiency: >80%
 * Error resilience with graceful degradation
 */

import { FREDAPI } from './FREDAPI'
import { BLSAPI } from './BLSAPI'
import { EIAAPI } from './EIAAPI'
import { RedisCache } from '../cache/RedisCache'
import ErrorHandler from '../error-handling/ErrorHandler'

// Core interface as specified in requirements
export interface MacroeconomicContext {
  overallScore: number           // 0-10 composite score
  inflationEnvironment: string   // 'low', 'moderate', 'high', 'declining'
  monetaryPolicy: string         // 'accommodative', 'neutral', 'restrictive'
  economicCycle: string          // 'expansion', 'peak', 'contraction', 'trough'
  sectorImpacts: Record<string, number> // Sector-specific multipliers
  confidence: number             // 0-1 data quality confidence
  lastUpdate: string
  dataSourcesUsed: string[]      // Track which APIs provided data
}

// Enhanced interfaces for comprehensive analysis
export interface CurrencyAnalysis {
  dxyStrength: number
  usdTrend: 'strengthening' | 'weakening' | 'stable'
  globalImpact: number
  inflationPressure: number
  timestamp: number
}

export interface EnergyInflationPressure {
  oilPressure: number
  gasPressure: number
  energyInflationScore: number
  sectorImpacts: {
    transportation: number
    utilities: number
    manufacturing: number
    consumer: number
  }
  timestamp: number
}

export interface MacroTrendAnalysis {
  gdpMomentum: {
    direction: string
    strength: number
    confidence: number
  }
  inflationTrend: {
    current: number
    direction: string
    momentum: number
  }
  employmentTrend: {
    strength: number
    direction: string
    confidence: number
  }
  monetaryConditions: {
    stance: string
    tightness: number
    marketImpact: number
  }
}

export interface SectorMultipliers {
  technology: number
  healthcare: number
  financials: number
  energy: number
  utilities: number
  industrials: number
  materials: number
  consumerDiscretionary: number
  consumerStaples: number
  realEstate: number
  communication: number
}

export interface MacroRiskFactors {
  inflationRisk: {
    level: 'low' | 'moderate' | 'high'
    description: string
    probability: number
  }
  recessionRisk: {
    level: 'low' | 'moderate' | 'high'
    description: string
    probability: number
  }
  monetaryRisk: {
    level: 'low' | 'moderate' | 'high'
    description: string
    impact: string
  }
  energyRisk: {
    level: 'low' | 'moderate' | 'high'
    description: string
    sectorImpact: string[]
  }
}

export interface ComprehensiveMacroAnalysis extends MacroeconomicContext {
  trendAnalysis: MacroTrendAnalysis
  currencyAnalysis?: CurrencyAnalysis
  energyAnalysis?: EnergyInflationPressure
  riskFactors: MacroRiskFactors
  opportunities: string[]
  keyInsights: string[]
  performanceMetrics: {
    responseTime: number
    dataCompleteness: number
    parallelEfficiency: number
    cacheHitRate: number
  }
}

export class MacroeconomicAnalysisService {
  private fredAPI: FREDAPI
  private blsAPI: BLSAPI
  private eiaAPI: EIAAPI
  private cache: RedisCache
  private timeout: number
  private throwErrors: boolean

  // Sector impact weights for different economic conditions
  private readonly SECTOR_WEIGHTS = {
    technology: { inflation: -0.8, recession: -1.2, monetary: -0.9, energy: -0.3 },
    healthcare: { inflation: -0.2, recession: 0.1, monetary: -0.1, energy: -0.2 },
    financials: { inflation: 0.3, recession: -1.5, monetary: 1.2, energy: -0.1 },
    energy: { inflation: 0.9, recession: -0.4, monetary: 0.2, energy: 1.8 },
    utilities: { inflation: -0.3, recession: 0.3, monetary: -0.4, energy: 0.7 },
    industrials: { inflation: -0.5, recession: -1.1, monetary: -0.6, energy: -0.8 },
    materials: { inflation: 0.4, recession: -0.9, monetary: -0.3, energy: -0.5 },
    consumerDiscretionary: { inflation: -0.9, recession: -1.8, monetary: -0.7, energy: -1.1 },
    consumerStaples: { inflation: -0.1, recession: 0.2, monetary: 0.1, energy: -0.4 },
    realEstate: { inflation: -0.6, recession: -1.0, monetary: -1.3, energy: -0.2 },
    communication: { inflation: -0.4, recession: -0.6, monetary: -0.5, energy: -0.2 }
  }

  constructor(options?: {
    fredApiKey?: string
    blsApiKey?: string
    eiaApiKey?: string
    timeout?: number
    throwErrors?: boolean
  }) {
    const {
      fredApiKey,
      blsApiKey,
      eiaApiKey,
      timeout = 15000,
      throwErrors = false
    } = options || {}

    // Initialize data source APIs with dependency injection
    this.fredAPI = new FREDAPI(fredApiKey, timeout, throwErrors)
    this.blsAPI = new BLSAPI(blsApiKey, timeout, throwErrors)
    this.eiaAPI = new EIAAPI(eiaApiKey, timeout, throwErrors)
    this.cache = RedisCache.getInstance()
    this.timeout = timeout
    this.throwErrors = throwErrors

    console.log('🏭 MacroeconomicAnalysisService initialized with data source orchestration')
  }

  /**
   * Main orchestration method - gets comprehensive macro context
   * Performance target: <800ms with >80% parallel processing efficiency
   */
  async getMacroeconomicContext(): Promise<MacroeconomicContext | null> {
    const startTime = Date.now()

    try {
      // Check cache first (smart TTL strategy - 10min prod, 2min dev)
      const cacheKey = 'macro:comprehensive_context'
      const cacheTTL = process.env.NODE_ENV === 'production' ? 600 : 120

      const cached = await this.cache.get<MacroeconomicContext>(cacheKey)
      if (cached) {
        console.log(`📊 Returning cached macro context (${Date.now() - startTime}ms)`)
        return cached
      }

      console.log('🔍 Fetching fresh macroeconomic context with parallel processing...')

      // Parallel data collection using Promise.allSettled for maximum resilience
      const dataCollectionPromises = [
        this.fredAPI.getEconomicContext(),
        this.fredAPI.getInflationTrendAnalysis(),
        this.fredAPI.getMonetaryPolicyContext(),
        this.fredAPI.getEconomicCyclePosition(),
        this.blsAPI.calculateEmploymentStrengthScore(),
        this.blsAPI.analyzeUnemploymentTrend(6),
        this.eiaAPI.getQuickCommoditySnapshot()
      ]

      const results = await Promise.allSettled(dataCollectionPromises)
      const processingTime = Date.now() - startTime

      // Process results with graceful degradation
      const [
        economicContext,
        inflationTrend,
        monetaryContext,
        cyclePosition,
        employmentStrength,
        unemploymentTrend,
        commoditySnapshot
      ] = results

      // Calculate data availability and parallel efficiency
      const successfulSources = results.filter(r => r.status === 'fulfilled' && r.value).length
      const parallelEfficiency = (successfulSources / results.length) * 100
      const dataSourcesUsed: string[] = []

      // Collect data sources that provided data
      if (economicContext.status === 'fulfilled' && economicContext.value) dataSourcesUsed.push('FRED-Economic')
      if (inflationTrend.status === 'fulfilled' && inflationTrend.value) dataSourcesUsed.push('FRED-Inflation')
      if (monetaryContext.status === 'fulfilled' && monetaryContext.value) dataSourcesUsed.push('FRED-Monetary')
      if (cyclePosition.status === 'fulfilled' && cyclePosition.value) dataSourcesUsed.push('FRED-Cycle')
      if (employmentStrength.status === 'fulfilled' && employmentStrength.value) dataSourcesUsed.push('BLS-Employment')
      if (unemploymentTrend.status === 'fulfilled' && unemploymentTrend.value) dataSourcesUsed.push('BLS-Unemployment')
      if (commoditySnapshot.status === 'fulfilled' && commoditySnapshot.value) dataSourcesUsed.push('EIA-Energy')

      // Calculate composite macroeconomic score (0-10 scale)
      const overallScore = this.calculateCompositeScore({
        economicContext: economicContext.status === 'fulfilled' ? economicContext.value : null,
        inflationTrend: inflationTrend.status === 'fulfilled' ? inflationTrend.value : null,
        monetaryContext: monetaryContext.status === 'fulfilled' ? monetaryContext.value : null,
        cyclePosition: cyclePosition.status === 'fulfilled' ? cyclePosition.value : null,
        employmentStrength: employmentStrength.status === 'fulfilled' ? employmentStrength.value : null,
        unemploymentTrend: unemploymentTrend.status === 'fulfilled' ? unemploymentTrend.value : null,
        commoditySnapshot: commoditySnapshot.status === 'fulfilled' ? commoditySnapshot.value : null
      })

      // Determine inflation environment
      const inflationEnvironment = this.determineInflationEnvironment(
        inflationTrend.status === 'fulfilled' ? inflationTrend.value : null
      )

      // Determine monetary policy stance
      const monetaryPolicy = this.determineMonetaryPolicy(
        monetaryContext.status === 'fulfilled' ? monetaryContext.value : null
      )

      // Determine economic cycle position
      const economicCycle = this.determineEconomicCycle(
        cyclePosition.status === 'fulfilled' ? cyclePosition.value : null,
        employmentStrength.status === 'fulfilled' ? employmentStrength.value : null
      )

      // Calculate sector-specific impact multipliers
      const sectorImpacts = this.calculateSectorImpacts(
        overallScore,
        inflationTrend.status === 'fulfilled' ? inflationTrend.value : null,
        monetaryContext.status === 'fulfilled' ? monetaryContext.value : null,
        commoditySnapshot.status === 'fulfilled' ? commoditySnapshot.value : null
      )

      // Calculate confidence score based on data availability and freshness
      const confidence = this.calculateConfidenceScore(
        successfulSources,
        results.length,
        processingTime
      )

      const macroContext: MacroeconomicContext = {
        overallScore: Number(overallScore.toFixed(1)),
        inflationEnvironment,
        monetaryPolicy,
        economicCycle,
        sectorImpacts,
        confidence: Number(confidence.toFixed(2)),
        lastUpdate: new Date().toISOString(),
        dataSourcesUsed
      }

      // Cache with smart TTL strategy
      await this.cache.set(cacheKey, macroContext, cacheTTL, {
        source: 'macro-analysis',
        version: '1.0.0'
      })

      const totalTime = Date.now() - startTime
      console.log(`✅ Macro context generated in ${totalTime}ms with ${parallelEfficiency.toFixed(1)}% efficiency`)

      // Validate performance requirements
      if (totalTime > 800) {
        console.warn(`⚠️ Performance target missed: ${totalTime}ms > 800ms target`)
      }

      if (parallelEfficiency < 80) {
        console.warn(`⚠️ Parallel efficiency below target: ${parallelEfficiency.toFixed(1)}% < 80%`)
      }

      return macroContext

    } catch (error) {
      const responseTime = Date.now() - startTime
      console.error(`❌ Macro context generation failed (${responseTime}ms):`, error)

      if (this.throwErrors) {
        throw ErrorHandler.normalizeError(error)
      }

      return null
    }
  }

  /**
   * Get comprehensive macro analysis with enhanced features
   */
  async getComprehensiveMacroAnalysis(): Promise<ComprehensiveMacroAnalysis | null> {
    const startTime = Date.now()

    try {
      // Get base macro context
      const baseContext = await this.getMacroeconomicContext()
      if (!baseContext) {
        console.warn('❌ Failed to get base macro context')
        return null
      }

      // Enhanced parallel processing for additional analysis
      const enhancedAnalysisPromises = [
        this.analyzeMacroTrends(),
        this.analyzeCurrencyImpact(),
        this.analyzeEnergyInflationPressure(),
        this.assessMacroRisks(baseContext)
      ]

      const enhancedResults = await Promise.allSettled(enhancedAnalysisPromises)
      const processingTime = Date.now() - startTime

      const [
        trendAnalysis,
        currencyAnalysis,
        energyAnalysis,
        riskFactors
      ] = enhancedResults

      // Generate insights and opportunities
      const keyInsights = this.generateKeyInsights(baseContext, {
        trendAnalysis: trendAnalysis.status === 'fulfilled' ? trendAnalysis.value : null,
        currencyAnalysis: currencyAnalysis.status === 'fulfilled' ? currencyAnalysis.value : null,
        energyAnalysis: energyAnalysis.status === 'fulfilled' ? energyAnalysis.value : null
      })

      const opportunities = this.identifyOpportunities(baseContext, keyInsights)

      const comprehensiveAnalysis: ComprehensiveMacroAnalysis = {
        ...baseContext,
        trendAnalysis: trendAnalysis.status === 'fulfilled' ? trendAnalysis.value as MacroTrendAnalysis : this.getDefaultTrendAnalysis(),
        currencyAnalysis: currencyAnalysis.status === 'fulfilled' ? currencyAnalysis.value as CurrencyAnalysis : undefined,
        energyAnalysis: energyAnalysis.status === 'fulfilled' ? energyAnalysis.value as EnergyInflationPressure : undefined,
        riskFactors: riskFactors.status === 'fulfilled' ? riskFactors.value as MacroRiskFactors : this.getDefaultRiskFactors(),
        opportunities,
        keyInsights,
        performanceMetrics: {
          responseTime: processingTime,
          dataCompleteness: baseContext.confidence,
          parallelEfficiency: (enhancedResults.filter(r => r.status === 'fulfilled').length / enhancedResults.length) * 100,
          cacheHitRate: 0 // Would be calculated from cache stats
        }
      }

      const totalTime = Date.now() - startTime
      console.log(`✅ Comprehensive macro analysis completed in ${totalTime}ms`)

      return comprehensiveAnalysis

    } catch (error) {
      console.error('❌ Comprehensive macro analysis failed:', error)
      if (this.throwErrors) throw error
      return null
    }
  }

  /**
   * Calculate 0-10 scale composite macroeconomic score with weighted components
   */
  private calculateCompositeScore(data: {
    economicContext: any
    inflationTrend: any
    monetaryContext: any
    cyclePosition: any
    employmentStrength: any
    unemploymentTrend: any
    commoditySnapshot: any
  }): number {
    let score = 5.0 // Neutral baseline
    let totalWeight = 0

    // Economic cycle weight: 25%
    if (data.cyclePosition) {
      const cycleScore = data.cyclePosition.compositeScore / 10 // Normalize to 0-10
      score += cycleScore * 0.25
      totalWeight += 0.25
    }

    // Employment weight: 20%
    if (data.employmentStrength) {
      const employmentScore = data.employmentStrength.overallScore
      score += employmentScore * 0.20
      totalWeight += 0.20
    }

    // Inflation weight: 20%
    if (data.inflationTrend) {
      const inflationScore = this.scoreInflationTrend(data.inflationTrend)
      score += inflationScore * 0.20
      totalWeight += 0.20
    }

    // Monetary policy weight: 15%
    if (data.monetaryContext) {
      const monetaryScore = data.monetaryContext.equityValuationImpact.score / 10
      score += monetaryScore * 0.15
      totalWeight += 0.15
    }

    // Unemployment trend weight: 10%
    if (data.unemploymentTrend) {
      const unemploymentScore = data.unemploymentTrend.economicSignal === 'bullish' ? 8 :
                               data.unemploymentTrend.economicSignal === 'bearish' ? 3 : 5
      score += unemploymentScore * 0.10
      totalWeight += 0.10
    }

    // Energy/commodity weight: 10%
    if (data.commoditySnapshot) {
      const energyScore = this.scoreEnergyConditions(data.commoditySnapshot)
      score += energyScore * 0.10
      totalWeight += 0.10
    }

    // Normalize score if we don't have complete data
    if (totalWeight > 0 && totalWeight < 1.0) {
      score = (score - 5.0) / totalWeight + 5.0
    }

    return Math.max(0, Math.min(10, score))
  }

  /**
   * Score inflation trend on 0-10 scale (5 = optimal, lower/higher = worse)
   */
  private scoreInflationTrend(inflationTrend: any): number {
    if (!inflationTrend) return 5

    const targetInflation = 2.0
    const currentInflation = inflationTrend.cpiMomentum?.yearOverYear || 0
    const deviation = Math.abs(currentInflation - targetInflation)

    // Optimal range: 1.5% - 2.5%
    if (deviation <= 0.5) return 9 // Very good
    if (deviation <= 1.0) return 7 // Good
    if (deviation <= 2.0) return 5 // Acceptable
    if (deviation <= 3.0) return 3 // Concerning
    return 1 // Poor
  }

  /**
   * Score energy conditions based on price levels and volatility
   */
  private scoreEnergyConditions(commoditySnapshot: any): number {
    if (!commoditySnapshot) return 5

    let score = 5

    // WTI oil price assessment
    if (commoditySnapshot.wti) {
      const wtiPrice = commoditySnapshot.wti
      if (wtiPrice >= 60 && wtiPrice <= 80) score += 1 // Goldilocks range
      else if (wtiPrice >= 40 && wtiPrice <= 100) score += 0.5 // Acceptable
      else score -= 1 // Too high or too low
    }

    // Natural gas price assessment
    if (commoditySnapshot.natGas) {
      const gasPrice = commoditySnapshot.natGas
      if (gasPrice >= 2.5 && gasPrice <= 4.0) score += 0.5 // Reasonable range
      else if (gasPrice > 6.0) score -= 1 // Too expensive
    }

    return Math.max(0, Math.min(10, score))
  }

  /**
   * Determine inflation environment based on trends and levels
   */
  private determineInflationEnvironment(inflationTrend: any): string {
    if (!inflationTrend) return 'moderate'

    const currentCPI = inflationTrend.cpiMomentum?.yearOverYear || 0
    const trend = inflationTrend.outlook

    if (currentCPI < 1.5) return 'low'
    if (currentCPI >= 1.5 && currentCPI < 3.0) {
      return trend === 'falling' ? 'declining' : 'moderate'
    }
    if (currentCPI >= 3.0) {
      return trend === 'falling' ? 'declining' : 'high'
    }

    return 'moderate'
  }

  /**
   * Determine monetary policy stance
   */
  private determineMonetaryPolicy(monetaryContext: any): string {
    if (!monetaryContext) return 'neutral'

    const fedFundsRate = monetaryContext.federalFundsRate?.current || 5.0
    const stance = monetaryContext.policyStance

    if (stance?.includes('dovish') || fedFundsRate < 2.0) return 'accommodative'
    if (stance?.includes('hawkish') || fedFundsRate > 5.5) return 'restrictive'
    return 'neutral'
  }

  /**
   * Determine economic cycle position
   */
  private determineEconomicCycle(cyclePosition: any, employmentStrength: any): string {
    if (cyclePosition?.phase) return cyclePosition.phase

    // Fallback based on employment strength
    if (employmentStrength) {
      const score = employmentStrength.overallScore
      if (score >= 8.0) return 'expansion'
      if (score >= 6.0) return 'peak'
      if (score >= 4.0) return 'trough'
      return 'contraction'
    }

    return 'expansion' // Default optimistic
  }

  /**
   * Calculate sector-specific impact multipliers
   */
  private calculateSectorImpacts(
    overallScore: number,
    inflationTrend: any,
    monetaryContext: any,
    commoditySnapshot: any
  ): Record<string, number> {
    const impacts: Record<string, number> = {}

    // Base multiplier from overall macro score
    const baseMultiplier = (overallScore - 5) / 5 // -1 to +1 range

    // Economic condition factors
    const inflationFactor = this.getInflationFactor(inflationTrend)
    const monetaryFactor = this.getMonetaryFactor(monetaryContext)
    const energyFactor = this.getEnergyFactor(commoditySnapshot)
    const recessionFactor = overallScore < 4 ? -0.5 : 0

    // Calculate sector impacts using weights
    Object.entries(this.SECTOR_WEIGHTS).forEach(([sector, weights]) => {
      let sectorImpact = baseMultiplier

      sectorImpact += weights.inflation * inflationFactor
      sectorImpact += weights.monetary * monetaryFactor
      sectorImpact += weights.energy * energyFactor
      sectorImpact += weights.recession * recessionFactor

      // Normalize to reasonable range
      impacts[sector] = Math.max(-2.0, Math.min(2.0, sectorImpact))
    })

    return impacts
  }

  /**
   * Calculate confidence score based on data availability and quality
   */
  private calculateConfidenceScore(
    successfulSources: number,
    totalSources: number,
    processingTime: number
  ): number {
    let confidence = 0.5 // Base confidence

    // Data availability component (50% weight)
    const dataAvailability = successfulSources / totalSources
    confidence += dataAvailability * 0.5

    // Performance component (20% weight) - faster = more confident
    const performanceScore = Math.max(0, (800 - processingTime) / 800)
    confidence += performanceScore * 0.2

    // Data freshness component (30% weight) - assume fresh for now
    confidence += 0.3

    return Math.max(0, Math.min(1, confidence))
  }

  // Helper methods for factor calculations
  private getInflationFactor(inflationTrend: any): number {
    if (!inflationTrend) return 0
    const cpi = inflationTrend.cpiMomentum?.yearOverYear || 2.0
    return (cpi - 2.0) / 5.0 // Normalize around 2% target
  }

  private getMonetaryFactor(monetaryContext: any): number {
    if (!monetaryContext) return 0
    const fedRate = monetaryContext.federalFundsRate?.current || 5.0
    return (fedRate - 5.0) / 5.0 // Normalize around 5% neutral rate
  }

  private getEnergyFactor(commoditySnapshot: any): number {
    if (!commoditySnapshot?.wti) return 0
    const oilPrice = commoditySnapshot.wti
    return (oilPrice - 70) / 50 // Normalize around $70/barrel
  }

  // Enhanced analysis methods
  private async analyzeMacroTrends(): Promise<MacroTrendAnalysis | null> {
    try {
      // This would integrate multiple data sources for comprehensive trend analysis
      // For now, return a simplified structure
      return {
        gdpMomentum: {
          direction: 'stable',
          strength: 6.5,
          confidence: 0.8
        },
        inflationTrend: {
          current: 3.2,
          direction: 'declining',
          momentum: -0.5
        },
        employmentTrend: {
          strength: 7.8,
          direction: 'improving',
          confidence: 0.9
        },
        monetaryConditions: {
          stance: 'restrictive',
          tightness: 7.5,
          marketImpact: -0.6
        }
      }
    } catch (error) {
      console.error('Error analyzing macro trends:', error)
      return null
    }
  }

  private async analyzeCurrencyImpact(): Promise<CurrencyAnalysis | null> {
    try {
      // Get DXY data from EIA service (which uses fallback APIs)
      const dxyData = await this.eiaAPI.getDollarIndex()

      if (!dxyData) return null

      const dxyStrength = dxyData.rate
      const usdTrend = dxyData.changePercent > 0.5 ? 'strengthening' :
                       dxyData.changePercent < -0.5 ? 'weakening' : 'stable'

      return {
        dxyStrength,
        usdTrend,
        globalImpact: Math.abs(dxyData.changePercent) * 10,
        inflationPressure: dxyStrength > 105 ? 0.3 : -0.2,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Error analyzing currency impact:', error)
      return null
    }
  }

  private async analyzeEnergyInflationPressure(): Promise<EnergyInflationPressure | null> {
    try {
      const energyData = await this.eiaAPI.getEnergyInflationImpact()

      if (!energyData) return null

      return {
        oilPressure: energyData.oilInflationImpact,
        gasPressure: energyData.gasInflationImpact,
        energyInflationScore: (energyData.oilInflationImpact + energyData.gasInflationImpact) / 2,
        sectorImpacts: {
          transportation: energyData.transportationSectorImpact,
          utilities: energyData.oilInflationImpact * 0.6,
          manufacturing: energyData.oilInflationImpact * 0.8,
          consumer: energyData.consumerSectorImpact
        },
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Error analyzing energy inflation pressure:', error)
      return null
    }
  }

  private async assessMacroRisks(context: MacroeconomicContext): Promise<MacroRiskFactors> {
    const inflationRisk = this.assessInflationRisk(context)
    const recessionRisk = this.assessRecessionRisk(context)
    const monetaryRisk = this.assessMonetaryRisk(context)
    const energyRisk = this.assessEnergyRisk(context)

    return {
      inflationRisk,
      recessionRisk,
      monetaryRisk,
      energyRisk
    }
  }

  private assessInflationRisk(context: MacroeconomicContext): { level: 'low' | 'moderate' | 'high', description: string, probability: number } {
    const isHighInflation = context.inflationEnvironment === 'high'
    const isRising = context.inflationEnvironment === 'moderate'

    if (isHighInflation) {
      return {
        level: 'high',
        description: 'Persistent high inflation pressures consumer spending and corporate margins',
        probability: 0.75
      }
    }

    if (isRising) {
      return {
        level: 'moderate',
        description: 'Inflation trending above target may trigger aggressive Fed action',
        probability: 0.45
      }
    }

    return {
      level: 'low',
      description: 'Inflation near target with stable expectations',
      probability: 0.15
    }
  }

  private assessRecessionRisk(context: MacroeconomicContext): { level: 'low' | 'moderate' | 'high', description: string, probability: number } {
    const isContraction = context.economicCycle === 'contraction'
    const isPeak = context.economicCycle === 'peak'
    const lowScore = context.overallScore < 4

    if (isContraction || lowScore) {
      return {
        level: 'high',
        description: 'Economic indicators pointing toward recession within 12 months',
        probability: 0.65
      }
    }

    if (isPeak) {
      return {
        level: 'moderate',
        description: 'Economy at peak expansion phase with elevated recession risk',
        probability: 0.35
      }
    }

    return {
      level: 'low',
      description: 'Economic expansion continues with low recession probability',
      probability: 0.15
    }
  }

  private assessMonetaryRisk(context: MacroeconomicContext): { level: 'low' | 'moderate' | 'high', description: string, impact: string } {
    const isRestrictive = context.monetaryPolicy === 'restrictive'
    const isAccommodative = context.monetaryPolicy === 'accommodative'

    if (isRestrictive) {
      return {
        level: 'high',
        description: 'Restrictive monetary policy pressures valuations and growth',
        impact: 'Negative for growth stocks, positive for value and financials'
      }
    }

    if (isAccommodative) {
      return {
        level: 'moderate',
        description: 'Accommodative policy may fuel asset bubbles and inflation',
        impact: 'Positive for risk assets, negative for currency strength'
      }
    }

    return {
      level: 'low',
      description: 'Neutral monetary policy provides stable backdrop',
      impact: 'Balanced impact across asset classes'
    }
  }

  private assessEnergyRisk(context: MacroeconomicContext): { level: 'low' | 'moderate' | 'high', description: string, sectorImpact: string[] } {
    const energyMultiplier = context.sectorImpacts.energy || 0

    if (energyMultiplier > 1.0) {
      return {
        level: 'high',
        description: 'High energy prices create inflation pressure and consumer burden',
        sectorImpact: ['Transportation', 'Airlines', 'Consumer Discretionary']
      }
    }

    if (energyMultiplier > 0.5) {
      return {
        level: 'moderate',
        description: 'Elevated energy costs impact transportation and utilities',
        sectorImpact: ['Transportation', 'Utilities']
      }
    }

    return {
      level: 'low',
      description: 'Stable energy prices support economic growth',
      sectorImpact: []
    }
  }

  private generateKeyInsights(context: MacroeconomicContext, analysis: any): string[] {
    const insights: string[] = []

    // Score-based insights
    if (context.overallScore >= 8) {
      insights.push('Strong macroeconomic conditions support risk asset performance')
    } else if (context.overallScore <= 3) {
      insights.push('Weak macro environment suggests defensive positioning')
    }

    // Inflation insights
    if (context.inflationEnvironment === 'high') {
      insights.push('High inflation environment favors real assets and value stocks')
    } else if (context.inflationEnvironment === 'declining') {
      insights.push('Declining inflation supports growth stocks and long-duration assets')
    }

    // Monetary policy insights
    if (context.monetaryPolicy === 'restrictive') {
      insights.push('Restrictive monetary policy creates headwinds for speculative growth')
    } else if (context.monetaryPolicy === 'accommodative') {
      insights.push('Accommodative policy provides tailwinds for risk assets')
    }

    // Cycle insights
    if (context.economicCycle === 'expansion') {
      insights.push('Economic expansion phase favors cyclical and growth sectors')
    } else if (context.economicCycle === 'contraction') {
      insights.push('Economic contraction supports defensive and quality names')
    }

    return insights
  }

  private identifyOpportunities(context: MacroeconomicContext, insights: string[]): string[] {
    const opportunities: string[] = []

    // High-scoring sectors
    Object.entries(context.sectorImpacts).forEach(([sector, impact]) => {
      if (impact > 1.0) {
        opportunities.push(`${sector} sector positioned for outperformance`)
      }
    })

    // Macro regime opportunities
    if (context.inflationEnvironment === 'declining' && context.monetaryPolicy !== 'restrictive') {
      opportunities.push('Goldilocks scenario supports duration and growth assets')
    }

    if (context.economicCycle === 'trough' && context.overallScore > 4) {
      opportunities.push('Early cycle recovery favors cyclical value plays')
    }

    return opportunities
  }

  // Default fallback methods
  private getDefaultTrendAnalysis(): MacroTrendAnalysis {
    return {
      gdpMomentum: { direction: 'stable', strength: 5.0, confidence: 0.5 },
      inflationTrend: { current: 2.5, direction: 'stable', momentum: 0 },
      employmentTrend: { strength: 6.0, direction: 'stable', confidence: 0.6 },
      monetaryConditions: { stance: 'neutral', tightness: 5.0, marketImpact: 0 }
    }
  }

  private getDefaultRiskFactors(): MacroRiskFactors {
    return {
      inflationRisk: { level: 'moderate', description: 'Insufficient data for assessment', probability: 0.3 },
      recessionRisk: { level: 'moderate', description: 'Insufficient data for assessment', probability: 0.25 },
      monetaryRisk: { level: 'moderate', description: 'Insufficient data for assessment', impact: 'Neutral' },
      energyRisk: { level: 'moderate', description: 'Insufficient data for assessment', sectorImpact: [] }
    }
  }

  /**
   * Health check for all macro data sources
   */
  async healthCheck(): Promise<{
    isHealthy: boolean
    sources: Record<string, boolean>
    overallLatency: number
    errors: string[]
  }> {
    const startTime = Date.now()
    const sources: Record<string, boolean> = {}
    const errors: string[] = []

    try {
      // Parallel health checks
      const healthPromises = [
        this.fredAPI.healthCheck().then(result => ({ name: 'FRED', healthy: result })),
        this.blsAPI.healthCheck().then(result => ({ name: 'BLS', healthy: result })),
        this.eiaAPI.healthCheck().then(result => ({ name: 'EIA', healthy: result }))
      ]

      const results = await Promise.allSettled(healthPromises)

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          sources[result.value.name] = result.value.healthy
          if (!result.value.healthy) {
            errors.push(`${result.value.name} API health check failed`)
          }
        } else {
          const apiNames = ['FRED', 'BLS', 'EIA']
          sources[apiNames[index]] = false
          errors.push(`${apiNames[index]} health check error: ${result.reason}`)
        }
      })

      const healthySources = Object.values(sources).filter(Boolean).length
      const isHealthy = healthySources >= 2 // At least 2 out of 3 sources healthy

      return {
        isHealthy,
        sources,
        overallLatency: Date.now() - startTime,
        errors
      }
    } catch (error) {
      return {
        isHealthy: false,
        sources,
        overallLatency: Date.now() - startTime,
        errors: [`Health check failed: ${error}`]
      }
    }
  }

  /**
   * Analyze macroeconomic impact on a specific stock/sector
   */
  async analyzeStockMacroImpact(
    symbol: string,
    sector: string,
    currentPrice: number
  ): Promise<{
    score: number;
    impact: 'positive' | 'negative' | 'neutral';
    factors: string[];
    confidence: number;
    macroScore: number;
    sectorImpact: number;
    adjustedScore: number;
  }> {
    try {
      // Get current macro context
      const macroContext = await this.getMacroeconomicContext()

      if (!macroContext) {
        throw new Error('Unable to get macroeconomic context')
      }

      // Sector-specific impact mapping
      const sectorMultiplier = macroContext.sectorImpacts[sector] || 1.0

      // Calculate base impact score
      let impactScore = macroContext.overallScore * sectorMultiplier

      // Determine overall impact
      let impact: 'positive' | 'negative' | 'neutral' = 'neutral'
      if (impactScore > 6.5) impact = 'positive'
      else if (impactScore < 4.5) impact = 'negative'

      // Generate relevant factors
      const factors: string[] = []

      if (macroContext.inflationEnvironment === 'high') {
        factors.push('High inflation environment may pressure margins')
      }
      if (macroContext.monetaryPolicy === 'restrictive') {
        factors.push('Restrictive monetary policy may limit growth')
      }
      if (macroContext.economicCycle === 'expansion') {
        factors.push('Economic expansion supports growth')
      }

      const adjustedScore = Math.round(impactScore * 10) / 10

      return {
        score: adjustedScore,
        impact,
        factors,
        confidence: macroContext.confidence,
        macroScore: macroContext.overallScore,
        sectorImpact: sectorMultiplier,
        adjustedScore
      }

    } catch (error) {
      console.error('Error in analyzeStockMacroImpact:', error)
      return {
        score: 5.0,
        impact: 'neutral',
        factors: ['Macro analysis unavailable'],
        confidence: 0.1,
        macroScore: 5.0,
        sectorImpact: 1.0,
        adjustedScore: 5.0
      }
    }
  }
}