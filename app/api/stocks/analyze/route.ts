/**
 * Comprehensive Stock Analysis API - Admin Dashboard Integration
 * Uses StockSelectionService for full analysisInputServices metadata
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StockSelectionService } from '../../../services/stock-selection/StockSelectionService'
import { SelectionRequest, SelectionMode, AnalysisScope } from '../../../services/stock-selection/types'
import { FallbackDataService } from '../../../services/financial-data/FallbackDataService'
import { FactorLibrary } from '../../../services/algorithms/FactorLibrary'
import { RedisCache } from '../../../services/cache/RedisCache'
import { TechnicalIndicatorService } from '../../../services/technical-analysis/TechnicalIndicatorService'
import { MacroeconomicAnalysisService } from '../../../services/financial-data/MacroeconomicAnalysisService'
import SentimentAnalysisService from '../../../services/financial-data/SentimentAnalysisService'
import { VWAPService } from '../../../services/financial-data/VWAPService'
import ESGDataService from '../../../services/financial-data/ESGDataService'
import ShortInterestService from '../../../services/financial-data/ShortInterestService'
import { ExtendedMarketDataService } from '../../../services/financial-data/ExtendedMarketDataService'
import { OptionsDataService } from '../../../services/financial-data/OptionsDataService'
import { PolygonAPI } from '../../../services/financial-data/PolygonAPI'
import { MLPredictionService } from '../../../services/ml/prediction/MLPredictionService'
import { FeatureEngineeringService } from '../../../services/ml/features/FeatureEngineeringService'

// Request validation - supports admin dashboard test format
const RequestSchema = z.object({
  mode: z.enum(['single', 'sector', 'multiple']),
  symbols: z.array(z.string()).optional(),
  sector: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
  config: z.object({
    symbol: z.string().optional(),
    preferredDataSources: z.array(z.string()).optional(),
    timeout: z.number().optional()
  }).optional()
})

// Initialize services (lazy initialization for optimal performance)
let stockSelectionService: StockSelectionService | null = null

/**
 * Get or initialize the comprehensive StockSelectionService
 */
async function getStockSelectionService(): Promise<StockSelectionService> {
  if (stockSelectionService) {
    return stockSelectionService
  }

  try {
    // Initialize core dependencies
    const cache = new RedisCache()
    const fallbackDataService = new FallbackDataService()
    const factorLibrary = new FactorLibrary()

    // Initialize optional services
    let technicalService: TechnicalIndicatorService | undefined
    try {
      technicalService = new TechnicalIndicatorService(cache)
    } catch (error) {
      console.warn('Technical analysis service not available:', error)
    }

    let macroeconomicService: MacroeconomicAnalysisService | undefined
    try {
      macroeconomicService = new MacroeconomicAnalysisService({
        fredApiKey: process.env.FRED_API_KEY,
        blsApiKey: process.env.BLS_API_KEY,
        eiaApiKey: process.env.EIA_API_KEY
      })
    } catch (error) {
      console.warn('Macroeconomic service not available:', error)
    }

    let sentimentService: SentimentAnalysisService | undefined
    try {
      // Yahoo Finance sentiment doesn't need API key
      sentimentService = new SentimentAnalysisService(cache)
    } catch (error) {
      console.warn('Sentiment analysis service not available:', error)
    }

    let vwapService: VWAPService | undefined
    try {
      if (process.env.POLYGON_API_KEY) {
        const polygonAPI = new PolygonAPI(process.env.POLYGON_API_KEY)
        vwapService = new VWAPService(polygonAPI, cache)
      }
    } catch (error) {
      console.warn('VWAP service not available:', error)
    }

    let esgService: ESGDataService | undefined
    try {
      esgService = new ESGDataService({
        apiKey: process.env.ESG_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY
      })
    } catch (error) {
      console.warn('ESG service not available:', error)
    }

    let shortInterestService: ShortInterestService | undefined
    try {
      shortInterestService = new ShortInterestService({
        finraApiKey: process.env.FINRA_API_KEY,
        polygonApiKey: process.env.POLYGON_API_KEY
      })
    } catch (error) {
      console.warn('Short interest service not available:', error)
    }

    let extendedMarketService: ExtendedMarketDataService | undefined
    try {
      if (process.env.POLYGON_API_KEY) {
        const polygonAPI = new PolygonAPI(process.env.POLYGON_API_KEY)
        extendedMarketService = new ExtendedMarketDataService(polygonAPI, cache)
      }
    } catch (error) {
      console.warn('Extended market service not available:', error)
    }

    let optionsService: OptionsDataService | undefined
    try {
      optionsService = new OptionsDataService(cache)
    } catch (error) {
      console.warn('Options service not available:', error)
    }

    let mlPredictionService: MLPredictionService | undefined
    try {
      mlPredictionService = new MLPredictionService()
    } catch (error) {
      console.warn('ML prediction service not available:', error)
    }

    // Create the comprehensive service
    stockSelectionService = new StockSelectionService(
      fallbackDataService,
      factorLibrary,
      cache,
      technicalService,
      macroeconomicService,
      sentimentService,
      vwapService,
      esgService,
      shortInterestService,
      extendedMarketService,
      undefined, // institutionalService
      optionsService,
      mlPredictionService
    )

    console.log('✅ Comprehensive StockSelectionService initialized with full analysisInputServices')
    return stockSelectionService

  } catch (error) {
    console.error('Failed to initialize StockSelectionService:', error)
    throw new Error('Service initialization failed')
  }
}

/**
 * Convert admin dashboard request format to SelectionRequest
 */
function convertToSelectionRequest(body: any): SelectionRequest {
  const { mode, symbols, sector, limit, config } = body

  // Handle test format where symbol is in config
  const symbolToUse = config?.symbol || symbols?.[0]
  const actualSymbols = symbolToUse ? [symbolToUse] : symbols

  let selectionMode: SelectionMode
  let scope: AnalysisScope

  switch (mode) {
    case 'single':
      selectionMode = SelectionMode.SINGLE_STOCK
      scope = {
        mode: selectionMode,
        symbols: actualSymbols,
        maxResults: 1
      }
      break

    case 'sector':
      selectionMode = SelectionMode.SECTOR_ANALYSIS
      scope = {
        mode: selectionMode,
        sector: {
          id: sector || 'technology',
          label: sector || 'Technology',
          description: `${sector || 'Technology'} sector analysis`,
          category: 'sector' as const
        },
        maxResults: limit
      }
      break

    case 'multiple':
      selectionMode = SelectionMode.MULTIPLE_STOCKS
      scope = {
        mode: selectionMode,
        symbols: symbols,
        maxResults: limit
      }
      break

    default:
      throw new Error(`Unsupported mode: ${mode}`)
  }

  return {
    scope,
    options: {
      algorithmId: 'composite',
      useRealTimeData: true,
      includeSentiment: true,
      includeNews: true,
      riskTolerance: 'moderate',
      timeout: config?.timeout || 30000
    },
    requestId: `admin_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Convert SelectionResponse to admin dashboard format
 */
function convertToAdminResponse(response: any): any {
  const stocks = response.topSelections?.map((selection: any) => {
    // Extract factor scores from the factorScores object
    const factorScores = selection.score?.factorScores || {}
    console.log(`🔍 DEBUG factorScores for ${selection.symbol}:`, JSON.stringify(factorScores, null, 2))
    console.log(`🔍 DEBUG overallScore:`, selection.score?.overallScore)

    // Extract scores with proper fallback logic matching actual factor names in AlgorithmEngine
    // Technical: technical_overall_score or technicalScore (0-100 scale)
    const technicalScore = factorScores.technicalScore ||
                          (factorScores.technical_overall_score ? factorScores.technical_overall_score * 100 : 0) ||
                          factorScores.technical_composite ||
                          factorScores.technical || 0

    // Fundamental: fundamentalScore (0-100 scale) or quality_composite/value_composite
    const fundamentalScore = factorScores.fundamentalScore ||
                            factorScores.fundamental_composite ||
                            factorScores.fundamental ||
                            factorScores.fundamentalData || 0

    // Macroeconomic: macroeconomic_composite (0-1 scale, convert to 0-100)
    const macroeconomicScore = (factorScores.macroeconomic_composite ? factorScores.macroeconomic_composite * 100 : 0) ||
                              factorScores.macroeconomic || 0

    // Sentiment: sentiment_composite (0-1 scale, convert to 0-100)
    const sentimentScore = (factorScores.sentiment_composite ? factorScores.sentiment_composite * 100 : 0) ||
                          factorScores.sentiment || 0

    // ESG: esg_composite (0-1 scale, convert to 0-100)
    const esgScore = (factorScores.esg_composite ? factorScores.esg_composite * 100 : 0) ||
                    factorScores.esg || 0

    // Analyst: analystScore (0-100 scale)
    const analystScore = factorScores.analystScore ||
                        factorScores.analyst_composite ||
                        factorScores.analyst ||
                        factorScores.analysts || 0

    // 🎯 DISPLAY FORMATTING ONLY: Convert 0-1 scale to 0-100 for frontend display
    const overallScoreRaw = selection.score?.overallScore || 0
    const compositeScoreDisplay = overallScoreRaw * 100

    // 🚨 VALIDATION: Verify score is in expected 0-1 range before display formatting
    if (overallScoreRaw < 0 || overallScoreRaw > 1) {
      console.error(`❌ API VALIDATION FAILED: overallScore ${overallScoreRaw} is outside 0-1 range for ${selection.symbol}!`)
    }

    console.log(`✅ API /stocks/analyze: Display score = ${compositeScoreDisplay.toFixed(2)} (formatted from ${overallScoreRaw.toFixed(4)})`)

    return {
      symbol: selection.symbol,
      price: selection.score?.marketData?.price || 0,
      compositeScore: compositeScoreDisplay,
      recommendation: selection.action || 'HOLD',
      sector: selection.context?.sector || 'Unknown',
      confidence: selection.confidence ? Math.round(selection.confidence * 100) : undefined,
      // Score breakdowns from factorScores object (0-100 scale)
      technicalScore,
      fundamentalScore,
      macroeconomicScore,
      sentimentScore,
      esgScore,
      analystScore,
      // Additional details
      marketCap: selection.context?.marketCap,
      priceChange: selection.score?.marketData?.priceChange,
      priceChangePercent: selection.score?.marketData?.priceChangePercent,
      reasoning: selection.reasoning,
      rationale: selection.rationale,
      strengths: selection.strengths,
      risks: selection.risks,
      insights: selection.insights
    }
  }) || []

  return {
    success: response.success,
    data: {
      stocks,
      metadata: {
        mode: response.metadata?.analysisMode || 'single',
        count: stocks.length,
        timestamp: response.timestamp || Date.now(),
        sources: response.metadata?.dataSourcesUsed || ['comprehensive'],
        technicalAnalysisEnabled: true,
        fundamentalDataEnabled: true,
        analystDataEnabled: true,
        sentimentAnalysisEnabled: !!response.metadata?.analysisInputServices?.sentimentAnalysis?.enabled,
        macroeconomicAnalysisEnabled: !!response.metadata?.analysisInputServices?.macroeconomicAnalysis?.enabled,
        esgAnalysisEnabled: !!response.metadata?.analysisInputServices?.esgAnalysis?.enabled,
        shortInterestAnalysisEnabled: !!response.metadata?.analysisInputServices?.shortInterestAnalysis?.enabled,
        extendedMarketDataEnabled: !!response.metadata?.analysisInputServices?.extendedMarketData?.enabled,
        // CRITICAL: Include the full analysisInputServices metadata
        analysisInputServices: response.metadata?.analysisInputServices || {}
      }
    },
    error: response.errors?.join(', ') || undefined
  }
}

/**
 * Main POST endpoint - comprehensive analysis with full StockSelectionService
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🔬 Starting comprehensive analysis via StockSelectionService...')

    // Parse and validate request
    const body = await request.json()
    const validatedRequest = RequestSchema.parse(body)

    // Get the comprehensive service
    const service = await getStockSelectionService()

    // Convert to SelectionRequest format
    const selectionRequest = convertToSelectionRequest(validatedRequest)

    console.log('📊 Executing comprehensive stock analysis:', {
      mode: selectionRequest.scope.mode,
      symbols: selectionRequest.scope.symbols,
      sector: selectionRequest.scope.sector?.label,
      requestId: selectionRequest.requestId
    })

    // Execute comprehensive analysis
    const startTime = Date.now()
    const analysisResult = await service.selectStocks(selectionRequest)
    const analysisTime = Date.now() - startTime

    console.log(`✅ Comprehensive analysis completed in ${analysisTime}ms`, {
      success: analysisResult.success,
      topSelections: analysisResult.topSelections.length,
      analysisInputServices: Object.keys(analysisResult.metadata?.analysisInputServices || {}).length
    })

    // Convert to admin dashboard format
    const adminResponse = convertToAdminResponse(analysisResult)

    return NextResponse.json(adminResponse)

  } catch (error) {
    console.error('Comprehensive analysis error:', error)

    // Return appropriate status codes for different error types
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format: ' + error.issues.map((e: any) => e.message).join(', ')
      }, { status: 400 })
    }

    if (error instanceof Error && error.message.includes('Symbol required')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Comprehensive analysis failed'
    }, { status: 500 })
  }
}

/**
 * GET endpoint for health check
 */
export async function GET(): Promise<NextResponse> {
  try {
    const service = await getStockSelectionService()
    const health = await service.healthCheck()

    return NextResponse.json({
      success: true,
      data: {
        status: health.status,
        services: health.details,
        timestamp: Date.now()
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Comprehensive analysis service health check failed'
    }, { status: 500 })
  }
}