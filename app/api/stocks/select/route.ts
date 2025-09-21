/**
 * Simplified Stock Selection API - KISS principles applied
 * Direct API implementation replacing MCP-based architecture
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { financialDataService, StockData, FundamentalRatios, AnalystRatings, PriceTarget } from '../../../services/financial-data'
import { TechnicalIndicatorService } from '../../../services/technical-analysis/TechnicalIndicatorService'
import { RedisCache } from '../../../services/cache/RedisCache'
import { OHLCData, TechnicalAnalysisResult } from '../../../services/technical-analysis/types'

// Request validation - supports both test format and production format
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

// Enhanced response format with comprehensive analysis
interface EnhancedStockData extends StockData {
  technicalAnalysis?: {
    score: number // 0-100 overall technical score
    trend: {
      direction: 'bullish' | 'bearish' | 'neutral'
      strength: number
      confidence: number
    }
    momentum: {
      signal: 'buy' | 'sell' | 'hold'
      strength: number
    }
    summary: string
  }
  fundamentals?: FundamentalRatios
  analystRating?: AnalystRatings
  priceTarget?: PriceTarget
  compositeScore?: number
  recommendation?: 'BUY' | 'SELL' | 'HOLD'
}

interface SimpleStockResponse {
  success: boolean
  data?: {
    stocks: EnhancedStockData[]
    metadata: {
      mode: string
      count: number
      timestamp: number
      sources: string[]
      technicalAnalysisEnabled?: boolean
      fundamentalDataEnabled?: boolean
      analystDataEnabled?: boolean
    }
  }
  error?: string
}

// Initialize technical analysis service (lazy initialization)
let technicalService: TechnicalIndicatorService | null = null

/**
 * Get or initialize technical analysis service
 */
function getTechnicalService(): TechnicalIndicatorService {
  if (!technicalService) {
    const cache = new RedisCache()
    technicalService = new TechnicalIndicatorService(cache)
  }
  return technicalService
}

/**
 * Convert HistoricalOHLC to OHLCData format
 */
function convertToOHLCData(historicalData: import('../../../services/financial-data').HistoricalOHLC[]): OHLCData[] {
  return historicalData.map(item => ({
    timestamp: item.timestamp,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volume
  }))
}

/**
 * Calculate composite score from technical, fundamental, and analyst data
 */
function calculateSimpleScore(stock: EnhancedStockData): number {
  let score = 50 // neutral start

  // Technical (if exists)
  if (stock.technicalAnalysis?.score) {
    score = stock.technicalAnalysis.score * 0.4
  }

  // Fundamentals boost/penalty
  if (stock.fundamentals) {
    if (stock.fundamentals.peRatio && stock.fundamentals.peRatio < 20) score += 10
    if (stock.fundamentals.roe && stock.fundamentals.roe > 0.15) score += 10
    if (stock.fundamentals.debtToEquity && stock.fundamentals.debtToEquity > 2) score -= 10
  }

  // Analyst boost
  if (stock.analystRating?.consensus === 'Strong Buy') score += 15
  else if (stock.analystRating?.consensus === 'Buy') score += 10
  else if (stock.analystRating?.consensus === 'Sell') score -= 10

  return Math.max(0, Math.min(100, score))
}

/**
 * Get recommendation based on composite score
 */
function getRecommendation(score: number): 'BUY' | 'SELL' | 'HOLD' {
  if (score >= 70) return 'BUY'
  if (score <= 30) return 'SELL'
  return 'HOLD'
}

/**
 * Enhance stock data with comprehensive analysis
 */
async function enhanceStockData(stocks: StockData[]): Promise<EnhancedStockData[]> {
  const technical = getTechnicalService()
  const enhancedStocks: EnhancedStockData[] = []

  // Process stocks in parallel with Promise.allSettled for resilience
  const analysisPromises = stocks.map(async (stock): Promise<EnhancedStockData> => {
    try {
      // Fetch all data types in parallel
      const [historicalResult, fundamentalsResult, analystResult, priceTargetResult] = await Promise.allSettled([
        financialDataService.getHistoricalOHLC(stock.symbol, 50),
        financialDataService.getFundamentalRatios(stock.symbol),
        financialDataService.getAnalystRatings(stock.symbol),
        financialDataService.getPriceTargets(stock.symbol)
      ])

      // Initialize enhanced stock with base data
      let enhancedStock: EnhancedStockData = { ...stock }

      // Add fundamental data
      if (fundamentalsResult.status === 'fulfilled' && fundamentalsResult.value) {
        enhancedStock.fundamentals = fundamentalsResult.value
      }

      // Add analyst data
      if (analystResult.status === 'fulfilled' && analystResult.value) {
        enhancedStock.analystRating = analystResult.value
      }

      // Add price target data
      if (priceTargetResult.status === 'fulfilled' && priceTargetResult.value) {
        enhancedStock.priceTarget = priceTargetResult.value
      }

      // Add technical analysis if historical data is sufficient
      if (historicalResult.status === 'fulfilled' && historicalResult.value.length >= 20) {
        // Convert to OHLCData format
        const ohlcData = convertToOHLCData(historicalResult.value)

        // Perform technical analysis
        const technicalResult = await technical.calculateAllIndicators({
          symbol: stock.symbol,
          ohlcData
        })

        // Generate summary based on analysis
        const summary = generateTechnicalSummary(technicalResult)

        enhancedStock.technicalAnalysis = {
          score: technicalResult.score.total,
          trend: {
            direction: technicalResult.trend.direction,
            strength: technicalResult.trend.strength,
            confidence: technicalResult.trend.confidence
          },
          momentum: {
            signal: technicalResult.momentum.signal,
            strength: technicalResult.momentum.strength
          },
          summary
        }
      } else {
        console.warn(`Insufficient historical data for ${stock.symbol}. Technical analysis disabled.`)
      }

      // Calculate composite score and recommendation
      const compositeScore = calculateSimpleScore(enhancedStock)
      enhancedStock.compositeScore = compositeScore
      enhancedStock.recommendation = getRecommendation(compositeScore)

      return enhancedStock
    } catch (error) {
      console.error(`Stock enhancement failed for ${stock.symbol}:`, error)
      return { ...stock }
    }
  })

  const results = await Promise.allSettled(analysisPromises)

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      enhancedStocks.push(result.value)
    }
  })

  return enhancedStocks
}

/**
 * Generate human-readable technical summary
 */
function generateTechnicalSummary(analysis: TechnicalAnalysisResult): string {
  const { score, trend, momentum } = analysis
  const scoreCategory = score.total >= 70 ? 'Strong' : score.total >= 50 ? 'Moderate' : 'Weak'

  return `${scoreCategory} technical outlook. Trend: ${trend.direction} (${Math.round(trend.strength * 100)}% strength). Momentum: ${momentum.signal}.`
}

/**
 * Main POST endpoint - simplified with technical analysis integration
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request
    const body = await request.json()
    const { mode, symbols, sector, limit, config } = RequestSchema.parse(body)

    let stocks: StockData[] = []
    const sources = new Set<string>()

    // Handle test format where symbol is in config
    const symbolToUse = config?.symbol || symbols?.[0]
    const preferredSources = config?.preferredDataSources || []

    // Determine preferred provider from data sources
    const preferredProvider = preferredSources.length > 0 ? preferredSources[0] : undefined

    // Handle different selection modes
    switch (mode) {
      case 'single':
        if (!symbolToUse) {
          return NextResponse.json({
            success: false,
            error: 'Symbol required for single mode (in symbols array or config.symbol)'
          }, { status: 400 })
        }

        // Check if preferred data sources are disabled (for testing data source toggle)
        if (preferredSources.length > 0) {
          const { dataSourceConfigManager } = await import('../../../services/admin/DataSourceConfigManager')
          for (const sourceId of preferredSources) {
            const isEnabled = dataSourceConfigManager.isDataSourceEnabled(sourceId)
            if (!isEnabled) {
              return NextResponse.json({
                success: false,
                error: `Preferred data source '${sourceId}' is currently disabled`,
                disabledSources: [sourceId]
              }, { status: 400 })
            }
          }
        }

        const stockData = await financialDataService.getStockPrice(symbolToUse, preferredProvider)
        if (stockData) {
          stocks = [stockData]
          sources.add(stockData.source)
        }
        break

      case 'sector':
        if (!sector) {
          return NextResponse.json({
            success: false,
            error: 'Sector required for sector mode'
          }, { status: 400 })
        }

        stocks = await financialDataService.getStocksBySector(sector, limit)
        stocks.forEach(stock => sources.add(stock.source))
        break

      case 'multiple':
        if (!symbols?.length) {
          return NextResponse.json({
            success: false,
            error: 'Symbols required for multiple mode'
          }, { status: 400 })
        }

        // Get multiple stocks in parallel
        stocks = await financialDataService.getMultipleStocks(symbols.slice(0, limit), preferredProvider)
        stocks.forEach(stock => sources.add(stock.source))
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid mode'
        }, { status: 400 })
    }

    // Enhance stocks with comprehensive analysis
    console.log(`🔬 Performing comprehensive analysis on ${stocks.length} stocks...`)
    const startTime = Date.now()

    const enhancedStocks = await enhanceStockData(stocks)
    const analysisTime = Date.now() - startTime

    console.log(`✅ Comprehensive analysis completed in ${analysisTime}ms`)

    // Return enhanced response
    const response: SimpleStockResponse = {
      success: true,
      data: {
        stocks: enhancedStocks,
        metadata: {
          mode,
          count: enhancedStocks.length,
          timestamp: Date.now(),
          sources: Array.from(sources),
          technicalAnalysisEnabled: true,
          fundamentalDataEnabled: true,
          analystDataEnabled: true
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Stock selection error:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof z.ZodError
        ? 'Invalid request format'
        : 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * GET endpoint for health check
 */
export async function GET(): Promise<NextResponse> {
  try {
    const health = await financialDataService.healthCheck()

    // Convert provider health to simple format
    const services: { [key: string]: boolean } = {}
    health.forEach((provider: { name: string; healthy: boolean }) => {
      services[provider.name.toLowerCase().replace(/\s+/g, '')] = provider.healthy
    })

    return NextResponse.json({
      success: true,
      data: {
        status: 'healthy',
        services,
        providers: health,
        timestamp: Date.now()
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Health check failed'
    }, { status: 500 })
  }
}