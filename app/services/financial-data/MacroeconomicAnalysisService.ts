/**
 * Macroeconomic Analysis Service
 * Connects economic data collection with stock analysis engine
 * Provides 20% weight in composite scoring as per roadmap
 */

import { FREDAPI } from './FREDAPI'
import { BLSAPI } from './BLSAPI'
import { EIAAPI } from './EIAAPI'
import { RedisCache } from '../cache/RedisCache'
import {
  MacroeconomicIndicators,
  EconomicCycleAnalysis,
  SectorEconomicImpact,
  MacroeconomicScore,
  StockMacroeconomicImpact,
  MacroeconomicAnalysisResponse,
  BulkMacroAnalysisResponse,
  MacroeconomicConfig,
  MacroeconomicCache
} from './types/macroeconomic-types'

export class MacroeconomicAnalysisService {
  private fredAPI: FREDAPI
  private blsAPI: BLSAPI
  private eiaAPI: EIAAPI
  private cache: RedisCache
  private config: MacroeconomicConfig

  // Sector sensitivity mappings based on economic research
  private readonly SECTOR_SENSITIVITIES = {
    'Technology': {
      interestRates: -0.7, // Tech sensitive to rates (high valuations)
      inflation: -0.3,
      gdpGrowth: 0.8,
      dollarStrength: -0.4
    },
    'Financials': {
      interestRates: 0.8, // Banks benefit from higher rates
      inflation: 0.2,
      gdpGrowth: 0.7,
      dollarStrength: 0.3
    },
    'Real Estate': {
      interestRates: -0.9, // REITs very sensitive to rates
      inflation: 0.1,
      gdpGrowth: 0.6,
      dollarStrength: -0.2
    },
    'Utilities': {
      interestRates: -0.6, // Utilities are rate-sensitive
      inflation: -0.4,
      gdpGrowth: 0.2,
      dollarStrength: 0.1
    },
    'Consumer Discretionary': {
      interestRates: -0.4,
      inflation: -0.6, // Consumers hurt by inflation
      gdpGrowth: 0.9,
      dollarStrength: -0.1
    },
    'Consumer Staples': {
      interestRates: -0.2,
      inflation: -0.2, // More defensive
      gdpGrowth: 0.3,
      dollarStrength: 0.1
    },
    'Healthcare': {
      interestRates: -0.3,
      inflation: -0.1,
      gdpGrowth: 0.4,
      dollarStrength: 0.2
    },
    'Energy': {
      interestRates: 0.1,
      inflation: 0.7, // Energy benefits from inflation
      gdpGrowth: 0.5,
      dollarStrength: -0.5 // Oil priced in USD
    },
    'Materials': {
      interestRates: -0.2,
      inflation: 0.6,
      gdpGrowth: 0.8,
      dollarStrength: -0.3
    },
    'Industrials': {
      interestRates: -0.3,
      inflation: -0.1,
      gdpGrowth: 0.8,
      dollarStrength: -0.2
    },
    'Communication Services': {
      interestRates: -0.5,
      inflation: -0.2,
      gdpGrowth: 0.6,
      dollarStrength: -0.1
    }
  }

  constructor(
    fredAPI: FREDAPI,
    blsAPI: BLSAPI,
    eiaAPI: EIAAPI,
    cache: RedisCache
  ) {
    this.fredAPI = fredAPI
    this.blsAPI = blsAPI
    this.eiaAPI = eiaAPI
    this.cache = cache
    this.config = this.createDefaultConfig()
  }

  /**
   * Main method: Analyze macroeconomic impact for a single stock
   */
  async analyzeStockMacroImpact(symbol: string, sector: string, baseScore: number): Promise<StockMacroeconomicImpact | null> {
    try {
      console.log(`🌍 Analyzing macro impact for ${symbol} (${sector})`)

      // Get current macroeconomic indicators
      const indicators = await this.getMacroeconomicIndicators()
      if (!indicators) {
        console.warn('Unable to get macroeconomic indicators')
        return null
      }

      // Analyze economic cycle
      const cycleAnalysis = await this.analyzeEconomicCycle(indicators)

      // Calculate sector-specific impact
      const sectorImpact = this.calculateSectorImpact(sector, indicators, cycleAnalysis)

      // Generate macroeconomic score
      const macroScore = this.calculateMacroeconomicScore(indicators, cycleAnalysis)

      // Calculate correlations (simplified for now, would use historical data in production)
      const correlationAnalysis = this.calculateStockCorrelations(symbol, sector, indicators)

      // Calculate adjusted score with 20% macro weight
      const macroWeight = 0.20 // 20% as per roadmap
      const adjustedScore = this.calculateAdjustedScore(baseScore, macroScore.overall, macroWeight)

      return {
        symbol,
        macroScore,
        sectorImpact,
        correlationAnalysis,
        adjustedScore,
        macroWeight
      }

    } catch (error) {
      console.error(`Macroeconomic analysis failed for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Bulk analysis for multiple stocks
   */
  async analyzeBulkMacroImpact(stocks: Array<{symbol: string, sector: string, baseScore: number}>): Promise<BulkMacroAnalysisResponse> {
    const startTime = Date.now()

    try {
      console.log(`🌍 Bulk macro analysis for ${stocks.length} stocks`)

      // Get shared macroeconomic data once
      const indicators = await this.getMacroeconomicIndicators()
      if (!indicators) {
        return {
          success: false,
          error: 'Unable to retrieve macroeconomic indicators',
          executionTime: Date.now() - startTime,
          timestamp: Date.now()
        }
      }

      const cycleAnalysis = await this.analyzeEconomicCycle(indicators)

      // Analyze each stock
      const stockImpacts: StockMacroeconomicImpact[] = []

      for (const stock of stocks) {
        try {
          const sectorImpact = this.calculateSectorImpact(stock.sector, indicators, cycleAnalysis)
          const macroScore = this.calculateMacroeconomicScore(indicators, cycleAnalysis)
          const correlationAnalysis = this.calculateStockCorrelations(stock.symbol, stock.sector, indicators)

          const macroWeight = 0.20
          const adjustedScore = this.calculateAdjustedScore(stock.baseScore, macroScore.overall, macroWeight)

          stockImpacts.push({
            symbol: stock.symbol,
            macroScore,
            sectorImpact,
            correlationAnalysis,
            adjustedScore,
            macroWeight
          })

        } catch (error) {
          console.warn(`Failed macro analysis for ${stock.symbol}:`, error)
          // Continue with other stocks
        }
      }

      return {
        success: true,
        data: {
          indicators,
          cycleAnalysis,
          stockImpacts
        },
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      }

    } catch (error) {
      console.error('Bulk macro analysis failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Get comprehensive macroeconomic indicators from multiple sources
   */
  async getMacroeconomicIndicators(): Promise<MacroeconomicIndicators | null> {
    try {
      // Check cache first
      const cacheKey = 'macro:indicators'
      const cached = await this.getCachedData(cacheKey)
      if (cached) {
        return cached
      }

      console.log('📊 Fetching fresh macroeconomic indicators...')

      // Fetch data from multiple sources in parallel
      const [
        gdpData,
        inflationData,
        employmentData,
        ratesData,
        moneySupplyData,
        exchangeData,
        commodityData
      ] = await Promise.allSettled([
        this.getGDPIndicators(),
        this.getInflationIndicators(),
        this.getEmploymentIndicators(),
        this.getInterestRateIndicators(),
        this.getMoneySupplyIndicators(),
        this.getExchangeRateIndicators(),
        this.getCommodityIndicators()
      ])

      const indicators: MacroeconomicIndicators = {
        gdp: gdpData.status === 'fulfilled' ? gdpData.value : this.getEmptyGDPData(),
        inflation: inflationData.status === 'fulfilled' ? inflationData.value : this.getEmptyInflationData(),
        employment: employmentData.status === 'fulfilled' ? employmentData.value : this.getEmptyEmploymentData(),
        interestRates: ratesData.status === 'fulfilled' ? ratesData.value : this.getEmptyRatesData(),
        moneySupply: moneySupplyData.status === 'fulfilled' ? moneySupplyData.value : this.getEmptyMoneySupplyData(),
        exchangeRates: exchangeData.status === 'fulfilled' ? exchangeData.value : this.getEmptyExchangeData(),
        commodities: commodityData.status === 'fulfilled' ? commodityData.value : this.getEmptyCommodityData()
      }

      // Cache for 15 minutes (macro data doesn't change frequently)
      await this.setCachedData(cacheKey, indicators, 15 * 60 * 1000)

      return indicators

    } catch (error) {
      console.error('Failed to get macroeconomic indicators:', error)
      return null
    }
  }

  /**
   * Analyze current economic cycle phase
   */
  private async analyzeEconomicCycle(indicators: MacroeconomicIndicators): Promise<EconomicCycleAnalysis> {
    try {
      // Simplified economic cycle analysis
      // In production, this would use more sophisticated models

      let cycleScore = 0
      const signals: string[] = []

      // GDP growth analysis
      if (indicators.gdp.growth !== null) {
        if (indicators.gdp.growth > 3) {
          cycleScore += 0.3
          signals.push('Strong GDP growth')
        } else if (indicators.gdp.growth < 0) {
          cycleScore -= 0.4
          signals.push('Negative GDP growth')
        }
      }

      // Unemployment analysis
      if (indicators.employment.unemploymentRate !== null) {
        if (indicators.employment.unemploymentRate < 4) {
          cycleScore += 0.2
          signals.push('Low unemployment')
        } else if (indicators.employment.unemploymentRate > 7) {
          cycleScore -= 0.3
          signals.push('High unemployment')
        }
      }

      // Yield curve analysis
      if (indicators.interestRates.isInverted) {
        cycleScore -= 0.4
        signals.push('Inverted yield curve')
      }

      // Inflation analysis
      if (indicators.inflation.cpi !== null) {
        if (indicators.inflation.cpi > 5) {
          cycleScore -= 0.2
          signals.push('High inflation')
        } else if (indicators.inflation.cpi < 1) {
          cycleScore -= 0.1
          signals.push('Low inflation risk')
        }
      }

      // Determine cycle phase
      let phase: 'expansion' | 'peak' | 'contraction' | 'trough' | 'unknown'
      if (cycleScore > 0.3) {
        phase = 'expansion'
      } else if (cycleScore > 0) {
        phase = 'peak'
      } else if (cycleScore > -0.3) {
        phase = 'contraction'
      } else {
        phase = 'trough'
      }

      return {
        cycle: {
          phase,
          confidence: Math.min(Math.abs(cycleScore), 1),
          timeInPhase: 6, // Simplified - would track actual time
          nextPhaseEstimate: 12 // Simplified estimate
        },
        indicators: {
          leading: {
            score: cycleScore,
            signals: signals.slice(0, 3)
          },
          coincident: {
            score: cycleScore * 0.8,
            signals: ['GDP growth', 'Employment levels']
          },
          lagging: {
            score: cycleScore * 0.6,
            signals: ['Unemployment rate', 'Inflation']
          }
        },
        riskFactors: {
          inflationRisk: indicators.inflation.cpi && indicators.inflation.cpi > 4 ? 0.7 : 0.3,
          recessionRisk: cycleScore < -0.2 ? 0.6 : 0.2,
          rateHikeRisk: indicators.inflation.cpi && indicators.inflation.cpi > 3 ? 0.8 : 0.3,
          marketVolatilityRisk: 0.4 // Would calculate from market data
        },
        timestamp: Date.now()
      }

    } catch (error) {
      console.error('Economic cycle analysis failed:', error)
      return this.getDefaultCycleAnalysis()
    }
  }

  /**
   * Calculate sector-specific economic impact
   */
  private calculateSectorImpact(sector: string, indicators: MacroeconomicIndicators, cycle: EconomicCycleAnalysis): SectorEconomicImpact {
    const sensitivity = this.SECTOR_SENSITIVITIES[sector as keyof typeof this.SECTOR_SENSITIVITIES] || this.SECTOR_SENSITIVITIES['Technology'] // Default to tech

    // Calculate current environment score based on sector sensitivities
    let environmentScore = 0.5 // Neutral base

    // Interest rate impact
    if (indicators.interestRates.fedFunds !== null) {
      const rateLevel = indicators.interestRates.fedFunds
      if (rateLevel > 4) {
        environmentScore += sensitivity.interestRates * -0.3 // High rates
      } else if (rateLevel < 2) {
        environmentScore += sensitivity.interestRates * 0.3 // Low rates
      }
    }

    // Inflation impact
    if (indicators.inflation.cpi !== null) {
      const inflationLevel = indicators.inflation.cpi
      if (inflationLevel > 4) {
        environmentScore += sensitivity.inflation * -0.2
      } else if (inflationLevel < 2) {
        environmentScore += sensitivity.inflation * 0.2
      }
    }

    // GDP growth impact
    if (indicators.gdp.growth !== null) {
      const gdpGrowth = indicators.gdp.growth
      if (gdpGrowth > 3) {
        environmentScore += sensitivity.gdpGrowth * 0.3
      } else if (gdpGrowth < 0) {
        environmentScore += sensitivity.gdpGrowth * -0.4
      }
    }

    // Dollar strength impact
    if (indicators.exchangeRates.dxy !== null) {
      // Simplified DXY impact (would need historical comparison)
      environmentScore += sensitivity.dollarStrength * 0.1
    }

    // Normalize environment score
    environmentScore = Math.max(0, Math.min(1, environmentScore))

    // Determine outlook
    let outlook: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative'
    if (environmentScore > 0.8) outlook = 'very_positive'
    else if (environmentScore > 0.6) outlook = 'positive'
    else if (environmentScore > 0.4) outlook = 'neutral'
    else if (environmentScore > 0.2) outlook = 'negative'
    else outlook = 'very_negative'

    return {
      sector,
      economicSensitivity: sensitivity,
      currentEnvironmentScore: environmentScore,
      outlook
    }
  }

  /**
   * Calculate comprehensive macroeconomic score
   */
  private calculateMacroeconomicScore(indicators: MacroeconomicIndicators, cycle: EconomicCycleAnalysis): MacroeconomicScore {
    const components = {
      growth: this.calculateGrowthScore(indicators),
      inflation: this.calculateInflationScore(indicators),
      monetary: this.calculateMonetaryScore(indicators),
      fiscal: 0.5, // Simplified - would include govt spending, deficit data
      external: this.calculateExternalScore(indicators)
    }

    // Weight the components according to config
    const overall =
      components.growth * this.config.weights.growth +
      components.inflation * this.config.weights.inflation +
      components.monetary * this.config.weights.monetary +
      components.fiscal * this.config.weights.fiscal +
      components.external * this.config.weights.external

    const reasoning: string[] = []
    const warnings: string[] = []
    const opportunities: string[] = []

    // Generate reasoning
    if (components.growth > 0.7) {
      reasoning.push('Strong economic growth supports market expansion')
      opportunities.push('GDP growth favors cyclical sectors')
    } else if (components.growth < 0.3) {
      reasoning.push('Weak economic growth poses headwinds')
      warnings.push('GDP concerns may pressure earnings')
    }

    if (components.inflation > 0.7) {
      reasoning.push('Low inflation provides favorable environment')
      opportunities.push('Stable prices support consumer spending')
    } else if (components.inflation < 0.3) {
      reasoning.push('High inflation creates uncertainty')
      warnings.push('Inflation may compress margins')
    }

    if (components.monetary > 0.7) {
      reasoning.push('Accommodative monetary policy supports valuations')
      opportunities.push('Low rates benefit growth stocks')
    } else if (components.monetary < 0.3) {
      reasoning.push('Tight monetary policy pressures valuations')
      warnings.push('Rising rates may impact high-multiple stocks')
    }

    if (cycle.riskFactors.recessionRisk > 0.5) {
      warnings.push('Elevated recession risk requires caution')
    }

    return {
      overall: Math.max(0, Math.min(1, overall)),
      components,
      confidence: Math.max(0.3, 1 - cycle.riskFactors.recessionRisk),
      reasoning,
      warnings,
      opportunities,
      timestamp: Date.now()
    }
  }

  /**
   * Calculate adjusted stock score with macroeconomic factors
   */
  private calculateAdjustedScore(baseScore: number, macroScore: number, macroWeight: number): number {
    // Weighted average: baseScore * (1 - macroWeight) + macroScore * macroWeight
    const adjustedScore = baseScore * (1 - macroWeight) + macroScore * macroWeight
    return Math.max(0, Math.min(1, adjustedScore))
  }

  // Data fetching methods for each indicator category

  private async getGDPIndicators() {
    const [gdp, realGdp, potentialGdp] = await Promise.allSettled([
      this.fredAPI.getStockPrice('GDP'),
      this.fredAPI.getStockPrice('GDPC1'),
      this.fredAPI.getStockPrice('GDPPOT')
    ])

    return {
      real: realGdp.status === 'fulfilled' && realGdp.value ? realGdp.value.price : null,
      nominal: gdp.status === 'fulfilled' && gdp.value ? gdp.value.price : null,
      potential: potentialGdp.status === 'fulfilled' && potentialGdp.value ? potentialGdp.value.price : null,
      growth: null, // Would calculate from historical data
      lastUpdated: Date.now()
    }
  }

  private async getInflationIndicators() {
    const [cpi, coreCpi] = await Promise.allSettled([
      this.fredAPI.getStockPrice('CPIAUCSL'),
      this.fredAPI.getStockPrice('CPILFESL')
    ])

    return {
      cpi: cpi.status === 'fulfilled' && cpi.value ? cpi.value.price : null,
      coreCpi: coreCpi.status === 'fulfilled' && coreCpi.value ? coreCpi.value.price : null,
      ppi: null, // Would get from BLS
      pce: null, // Would get PCE data
      expectedInflation: null, // Would calculate from TIPS spreads
      lastUpdated: Date.now()
    }
  }

  private async getEmploymentIndicators() {
    const [unemployment, participation, payrolls] = await Promise.allSettled([
      this.fredAPI.getStockPrice('UNRATE'),
      this.fredAPI.getStockPrice('CIVPART'),
      this.fredAPI.getStockPrice('PAYEMS')
    ])

    return {
      unemploymentRate: unemployment.status === 'fulfilled' && unemployment.value ? unemployment.value.price : null,
      participationRate: participation.status === 'fulfilled' && participation.value ? participation.value.price : null,
      nonfarmPayrolls: payrolls.status === 'fulfilled' && payrolls.value ? payrolls.value.price : null,
      unemploymentLevel: null,
      lastUpdated: Date.now()
    }
  }

  private async getInterestRateIndicators() {
    const treasuryData = await this.fredAPI.getTreasuryAnalysisData()

    return {
      fedFunds: treasuryData?.rates?.['3M'] || null,
      treasury3m: treasuryData?.rates?.['3M'] || null,
      treasury10y: treasuryData?.rates?.['10Y'] || null,
      treasury30y: treasuryData?.rates?.['30Y'] || null,
      yieldCurveSlope: treasuryData?.yieldCurve?.slope_10Y_2Y || null,
      isInverted: treasuryData?.yieldCurve?.isInverted || false,
      lastUpdated: Date.now()
    }
  }

  private async getMoneySupplyIndicators() {
    const [m1, m2] = await Promise.allSettled([
      this.fredAPI.getStockPrice('M1SL'),
      this.fredAPI.getStockPrice('M2SL')
    ])

    return {
      m1: m1.status === 'fulfilled' && m1.value ? m1.value.price : null,
      m2: m2.status === 'fulfilled' && m2.value ? m2.value.price : null,
      m1Growth: null, // Would calculate from historical data
      m2Growth: null, // Would calculate from historical data
      lastUpdated: Date.now()
    }
  }

  private async getExchangeRateIndicators() {
    // Add DXY support to FRED API call
    const [dxy, eur, jpy] = await Promise.allSettled([
      this.fredAPI.getStockPrice('DTWEXBGS'), // Trade weighted US dollar index
      this.fredAPI.getStockPrice('DEXUSEU'),
      this.fredAPI.getStockPrice('DEXJPUS')
    ])

    return {
      dxy: dxy.status === 'fulfilled' && dxy.value ? dxy.value.price : null,
      eurUsd: eur.status === 'fulfilled' && eur.value ? eur.value.price : null,
      usdJpy: jpy.status === 'fulfilled' && jpy.value ? jpy.value.price : null,
      usdCny: null, // Would get from additional source
      lastUpdated: Date.now()
    }
  }

  private async getCommodityIndicators() {
    // Note: EIA API methods would need to be implemented
    // For now, returning null values as placeholders
    return {
      oilWti: null, // Would call this.eiaAPI.getCrudeOilPrices() when method exists
      oilBrent: null, // Would call this.eiaAPI.getCrudeOilPrices() when method exists
      gold: null, // Would get from financial data provider
      naturalGas: null, // Would call this.eiaAPI.getNaturalGasPrices() when method exists
      lastUpdated: Date.now()
    }
  }

  // Score calculation helpers

  private calculateGrowthScore(indicators: MacroeconomicIndicators): number {
    let score = 0.5 // Neutral base

    if (indicators.gdp.growth !== null) {
      if (indicators.gdp.growth > 3) score = 0.8
      else if (indicators.gdp.growth > 2) score = 0.7
      else if (indicators.gdp.growth > 0) score = 0.6
      else score = 0.2
    }

    return score
  }

  private calculateInflationScore(indicators: MacroeconomicIndicators): number {
    let score = 0.5

    if (indicators.inflation.cpi !== null) {
      const cpi = indicators.inflation.cpi
      if (cpi < 2) score = 0.6 // Below target, but not deflationary
      else if (cpi < 3) score = 0.8 // Near target
      else if (cpi < 5) score = 0.4 // Elevated
      else score = 0.2 // High inflation
    }

    return score
  }

  private calculateMonetaryScore(indicators: MacroeconomicIndicators): number {
    let score = 0.5

    if (indicators.interestRates.fedFunds !== null) {
      const rate = indicators.interestRates.fedFunds
      if (rate < 2) score = 0.8 // Accommodative
      else if (rate < 4) score = 0.6 // Neutral
      else score = 0.3 // Restrictive
    }

    // Adjust for yield curve
    if (indicators.interestRates.isInverted) {
      score *= 0.7 // Penalty for inversion
    }

    return score
  }

  private calculateExternalScore(indicators: MacroeconomicIndicators): number {
    let score = 0.5

    // Dollar strength impact (simplified)
    if (indicators.exchangeRates.dxy !== null) {
      // Moderate dollar strength is generally positive
      score = 0.6
    }

    return score
  }

  private calculateStockCorrelations(symbol: string, sector: string, indicators: MacroeconomicIndicators) {
    // Simplified correlation calculation
    // In production, this would use historical correlation analysis
    const sectorSensitivity = this.SECTOR_SENSITIVITIES[sector as keyof typeof this.SECTOR_SENSITIVITIES] || this.SECTOR_SENSITIVITIES['Technology']

    return {
      gdpCorrelation: sectorSensitivity.gdpGrowth,
      inflationCorrelation: sectorSensitivity.inflation,
      rateCorrelation: sectorSensitivity.interestRates,
      dxyCorrelation: sectorSensitivity.dollarStrength
    }
  }

  // Cache management
  private async getCachedData(key: string): Promise<any> {
    try {
      return await this.cache.get(key)
    } catch (error) {
      console.warn('Cache get failed:', error)
      return null
    }
  }

  private async setCachedData(key: string, data: any, ttl: number): Promise<void> {
    try {
      await this.cache.set(key, data, ttl)
    } catch (error) {
      console.warn('Cache set failed:', error)
    }
  }

  // Default/empty data helpers
  private getEmptyGDPData() {
    return { real: null, nominal: null, potential: null, growth: null, lastUpdated: Date.now() }
  }

  private getEmptyInflationData() {
    return { cpi: null, coreCpi: null, ppi: null, pce: null, expectedInflation: null, lastUpdated: Date.now() }
  }

  private getEmptyEmploymentData() {
    return { unemploymentRate: null, participationRate: null, nonfarmPayrolls: null, unemploymentLevel: null, lastUpdated: Date.now() }
  }

  private getEmptyRatesData() {
    return { fedFunds: null, treasury3m: null, treasury10y: null, treasury30y: null, yieldCurveSlope: null, isInverted: false, lastUpdated: Date.now() }
  }

  private getEmptyMoneySupplyData() {
    return { m1: null, m2: null, m1Growth: null, m2Growth: null, lastUpdated: Date.now() }
  }

  private getEmptyExchangeData() {
    return { dxy: null, eurUsd: null, usdJpy: null, usdCny: null, lastUpdated: Date.now() }
  }

  private getEmptyCommodityData() {
    return { oilWti: null, oilBrent: null, gold: null, naturalGas: null, lastUpdated: Date.now() }
  }

  private getDefaultCycleAnalysis(): EconomicCycleAnalysis {
    return {
      cycle: {
        phase: 'unknown',
        confidence: 0,
        timeInPhase: 0,
        nextPhaseEstimate: 0
      },
      indicators: {
        leading: { score: 0, signals: [] },
        coincident: { score: 0, signals: [] },
        lagging: { score: 0, signals: [] }
      },
      riskFactors: {
        inflationRisk: 0.5,
        recessionRisk: 0.5,
        rateHikeRisk: 0.5,
        marketVolatilityRisk: 0.5
      },
      timestamp: Date.now()
    }
  }

  private createDefaultConfig(): MacroeconomicConfig {
    return {
      updateFrequency: 15 * 60 * 1000, // 15 minutes
      dataSources: {
        primary: [],
        fallback: []
      },
      weights: {
        growth: 0.3,      // 30% weight to growth
        inflation: 0.25,  // 25% weight to inflation
        monetary: 0.25,   // 25% weight to monetary policy
        fiscal: 0.1,      // 10% weight to fiscal policy
        external: 0.1     // 10% weight to external factors
      },
      thresholds: {
        recessionSignal: -0.3,
        inflationConcern: 4.0,
        rateVolatility: 0.5
      },
      cache: {
        ttl: 15 * 60 * 1000, // 15 minutes
        maxAge: 60 * 60 * 1000 // 1 hour
      }
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const [fredHealth, blsHealth, eiaHealth] = await Promise.allSettled([
        this.fredAPI.healthCheck(),
        this.blsAPI.healthCheck ? this.blsAPI.healthCheck() : Promise.resolve(true),
        this.eiaAPI.healthCheck ? this.eiaAPI.healthCheck() : Promise.resolve(true)
      ])

      const healthy = fredHealth.status === 'fulfilled' && fredHealth.value

      return {
        status: healthy ? 'healthy' : 'unhealthy',
        details: {
          fredAPI: fredHealth.status === 'fulfilled' ? fredHealth.value : false,
          blsAPI: blsHealth.status === 'fulfilled' ? blsHealth.value : false,
          eiaAPI: eiaHealth.status === 'fulfilled' ? eiaHealth.value : false,
          cache: this.cache ? true : false
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }
}

export default MacroeconomicAnalysisService