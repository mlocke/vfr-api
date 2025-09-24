/**
 * Composite Score Debug API - Shows detailed composite score calculation
 * Reveals how individual factors contribute to the final BUY/SELL/HOLD score
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { FactorLibrary } from '../../../services/algorithms/FactorLibrary'
import { TechnicalIndicatorService } from '../../../services/technical-analysis/TechnicalIndicatorService'
import { FallbackDataService } from '../../../services/financial-data/FallbackDataService'
import { RedisCache } from '../../../services/cache/RedisCache'
import { financialDataService } from '../../../services/financial-data'
import { AlgorithmConfigManager } from '../../../services/algorithms/AlgorithmConfigManager'
import { AlgorithmCache } from '../../../services/algorithms/AlgorithmCache'

// Request validation schema
const CompositeDebugRequestSchema = z.object({
  symbol: z.string()
})

interface CompositeDebugResponse {
  success: boolean
  data?: {
    symbol: string
    timestamp: number
    algorithmConfig: {
      id: string
      name: string
      weights: Array<{
        factor: string
        weight: number
        enabled: boolean
      }>
    }
    factorScores: {
      [factorName: string]: number | null
    }
    compositeCalculation: {
      weightedContributions: Array<{
        factor: string
        score: number | null
        weight: number
        contribution: number
        enabled: boolean
      }>
      totalWeightedScore: number
      totalWeight: number
      finalScore: number
      scaledScore: number // Score * 100
      recommendation: 'BUY' | 'SELL' | 'HOLD'
      reasoning: string[]
    }
    comparison: {
      expectedScore: number
      actualAPIScore: number
      discrepancy: number
      possibleCause: string
    }
  }
  error?: string
}

/**
 * POST endpoint for detailed composite score debugging
 */
export async function POST(request: NextRequest): Promise<NextResponse<CompositeDebugResponse>> {
  try {
    const startTime = Date.now()

    // Parse and validate request
    const body = await request.json()
    const debugRequest = CompositeDebugRequestSchema.parse(body)

    console.log(`🔬 Composite Debug Request for ${debugRequest.symbol}`)

    // Initialize services
    const cache = new RedisCache()
    const fallbackDataService = new FallbackDataService()
    let technicalService: TechnicalIndicatorService | undefined

    try {
      technicalService = new TechnicalIndicatorService(cache)
    } catch (error) {
      console.warn('Technical service not available:', error)
    }

    const factorLibrary = new FactorLibrary(technicalService)

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
        configuration: 3600,
        stockScores: 300,
        marketData: 60,
        fundamentalData: 3600,
        selectionResults: 1800,
        universe: 14400,
        factors: 300
      },
      performance: {
        pipelineSize: 100,
        compressionThreshold: 1024,
        enableCompression: true
      }
    })

    const configManager = new AlgorithmConfigManager(factorLibrary, algorithmCache)

    // Step 1: Get algorithm configuration
    console.log(`📋 Getting algorithm configuration...`)
    const algorithmConfig = await configManager.getConfiguration('composite')
    if (!algorithmConfig) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get composite algorithm configuration'
      })
    }

    console.log(`Algorithm config:`, {
      id: algorithmConfig.id,
      name: algorithmConfig.name,
      weightsCount: algorithmConfig.weights?.length || 0
    })

    // Step 2: Get stock data
    console.log(`📊 Fetching stock data for ${debugRequest.symbol}...`)
    const stockData = await financialDataService.getStockPrice(debugRequest.symbol)
    if (!stockData) {
      return NextResponse.json({
        success: false,
        error: `No stock data found for symbol: ${debugRequest.symbol}`
      })
    }

    // Step 3: Get fundamental data
    console.log(`📈 Fetching fundamental data for ${debugRequest.symbol}...`)
    let fundamentalRatios = null
    let companyInfo = null

    try {
      fundamentalRatios = await financialDataService.getFundamentalRatios(debugRequest.symbol)
      companyInfo = await financialDataService.getCompanyInfo(debugRequest.symbol)
    } catch (error) {
      console.warn(`Error fetching fundamental data:`, error)
    }

    // Step 4: Prepare data points
    const marketDataPoint = {
      symbol: debugRequest.symbol,
      price: stockData.price || 0,
      volume: stockData.volume || 0,
      marketCap: companyInfo?.marketCap || stockData.marketCap || 0,
      sector: stockData.sector || 'Unknown',
      exchange: stockData.exchange || 'Unknown',
      timestamp: Date.now()
    }

    const fundamentalDataPoint = fundamentalRatios ? {
      symbol: debugRequest.symbol,
      peRatio: fundamentalRatios.peRatio,
      pbRatio: fundamentalRatios.pbRatio,
      debtToEquity: fundamentalRatios.debtToEquity,
      roe: fundamentalRatios.roe,
      revenueGrowth: fundamentalRatios.revenueGrowth,
      currentRatio: fundamentalRatios.currentRatio,
      operatingMargin: fundamentalRatios.operatingMargin,
      netProfitMargin: fundamentalRatios.netProfitMargin,
      grossProfitMargin: fundamentalRatios.grossProfitMargin,
      priceToSales: fundamentalRatios.priceToSales,
      evEbitda: fundamentalRatios.evToEbitda,
      interestCoverage: fundamentalRatios.interestCoverage,
      earningsGrowth: fundamentalRatios.earningsGrowth,
      dividendYield: fundamentalRatios.dividendYield,
      payoutRatio: fundamentalRatios.payoutRatio
    } : null

    // Step 5: Calculate each configured factor
    console.log(`🧮 Calculating factors according to algorithm configuration...`)
    const factorScores: { [factorName: string]: number | null } = {}
    const weightedContributions: Array<{
      factor: string
      score: number | null
      weight: number
      contribution: number
      enabled: boolean
    }> = []

    let totalWeightedScore = 0
    let totalWeight = 0

    for (const weightConfig of algorithmConfig.weights) {
      const { factor, weight, enabled } = weightConfig

      if (!enabled) {
        console.log(`Factor ${factor} is disabled, skipping`)
        weightedContributions.push({
          factor,
          score: null,
          weight,
          contribution: 0,
          enabled: false
        })
        continue
      }

      try {
        console.log(`Calculating factor: ${factor}`)
        const factorValue = await factorLibrary.calculateFactor(
          factor,
          debugRequest.symbol,
          marketDataPoint,
          fundamentalDataPoint
        )

        factorScores[factor] = factorValue

        if (factorValue !== null && !isNaN(factorValue)) {
          const contribution = factorValue * weight
          totalWeightedScore += contribution
          totalWeight += weight

          weightedContributions.push({
            factor,
            score: factorValue,
            weight,
            contribution,
            enabled: true
          })

          console.log(`✅ ${factor}: ${factorValue.toFixed(4)} × ${weight} = ${contribution.toFixed(4)}`)
        } else {
          weightedContributions.push({
            factor,
            score: factorValue,
            weight,
            contribution: 0,
            enabled: true
          })
          console.log(`⚠️ ${factor}: ${factorValue} (no contribution)`)
        }

      } catch (error) {
        factorScores[factor] = null
        weightedContributions.push({
          factor,
          score: null,
          weight,
          contribution: 0,
          enabled: true
        })
        console.log(`❌ ${factor}: ERROR - ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Step 6: Calculate final composite score
    const finalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0
    const scaledScore = Math.round(finalScore * 100)

    // Step 7: Determine recommendation
    let recommendation: 'BUY' | 'SELL' | 'HOLD'
    const reasoning: string[] = []

    if (scaledScore >= 70) {
      recommendation = 'BUY'
      reasoning.push(`Composite score ${scaledScore} >= 70 (BUY threshold)`)
    } else if (scaledScore <= 30) {
      recommendation = 'SELL'
      reasoning.push(`Composite score ${scaledScore} <= 30 (SELL threshold)`)
    } else {
      recommendation = 'HOLD'
      reasoning.push(`Composite score ${scaledScore} between 30-70 (HOLD range)`)
    }

    // Add factor-specific insights
    weightedContributions.forEach(contrib => {
      if (contrib.enabled && contrib.score !== null) {
        if (contrib.contribution > 0.1) {
          reasoning.push(`Strong positive contribution from ${contrib.factor} (${contrib.score.toFixed(3)})`)
        } else if (contrib.contribution < -0.1) {
          reasoning.push(`Strong negative contribution from ${contrib.factor} (${contrib.score.toFixed(3)})`)
        }
      }
    })

    // Step 8: Get actual API score for comparison
    let actualAPIScore = 0
    try {
      const apiResponse = await fetch('http://localhost:3000/api/stocks/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          config: { symbol: debugRequest.symbol },
          limit: 1
        })
      })

      if (apiResponse.ok) {
        const apiData = await apiResponse.json()
        actualAPIScore = apiData.data?.stocks?.[0]?.compositeScore || 0
      }
    } catch (error) {
      console.warn('Could not fetch actual API score for comparison:', error)
    }

    const discrepancy = Math.abs(scaledScore - actualAPIScore)
    let possibleCause = 'Scores match - calculation is consistent'

    if (discrepancy > 5) {
      if (actualAPIScore > scaledScore) {
        possibleCause = 'API using different algorithm or additional factors not in configuration'
      } else {
        possibleCause = 'API may be using cached or simplified scoring method'
      }
    }

    const executionTime = Date.now() - startTime
    console.log(`✅ Composite debug completed in ${executionTime}ms`)

    const response: CompositeDebugResponse = {
      success: true,
      data: {
        symbol: debugRequest.symbol,
        timestamp: Date.now(),
        algorithmConfig: {
          id: algorithmConfig.id,
          name: algorithmConfig.name,
          weights: algorithmConfig.weights.map(w => ({
            factor: w.factor,
            weight: w.weight,
            enabled: w.enabled
          }))
        },
        factorScores,
        compositeCalculation: {
          weightedContributions,
          totalWeightedScore,
          totalWeight,
          finalScore,
          scaledScore,
          recommendation,
          reasoning
        },
        comparison: {
          expectedScore: scaledScore,
          actualAPIScore,
          discrepancy,
          possibleCause
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Composite debug error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format: ' + error.issues.map((e: any) => e.message).join(', ')
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Composite debug failed'
    }, { status: 500 })
  }
}

/**
 * GET endpoint for algorithm configuration info
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Return available algorithm configurations
    return NextResponse.json({
      success: true,
      data: {
        availableAlgorithms: ['composite', 'quality', 'value', 'momentum'],
        scoringThresholds: {
          BUY: '>= 70',
          HOLD: '30-70',
          SELL: '<= 30'
        },
        compositeWeights: {
          quality_composite: 0.4,
          momentum_composite: 0.25,
          value_composite: 0.25,
          volatility_30d: 0.1
        }
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get algorithm configuration info'
    }, { status: 500 })
  }
}