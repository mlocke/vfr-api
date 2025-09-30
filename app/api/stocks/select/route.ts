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
import { SentimentAnalysisService } from '../../../services/financial-data/SentimentAnalysisService'
import { StockSentimentImpact } from '../../../services/financial-data/types/sentiment-types'
import { MacroeconomicAnalysisService } from '../../../services/financial-data/MacroeconomicAnalysisService'
import { FREDAPI } from '../../../services/financial-data/FREDAPI'
import { BLSAPI } from '../../../services/financial-data/BLSAPI'
import { EIAAPI } from '../../../services/financial-data/EIAAPI'
import { StockMacroeconomicImpact } from '../../../services/financial-data/types/macroeconomic-types'
import ESGDataService from '../../../services/financial-data/ESGDataService'
import ShortInterestService from '../../../services/financial-data/ShortInterestService'
import { ExtendedMarketDataService } from '../../../services/financial-data/ExtendedMarketDataService'
import { PolygonAPI } from '../../../services/financial-data/PolygonAPI'
import { getRecommendation } from '../../../services/utils/RecommendationUtils'

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
  sentimentAnalysis?: {
    score: number // 0-100 overall sentiment score
    impact: 'positive' | 'negative' | 'neutral'
    confidence: number
    newsVolume: number
    adjustedScore: number
    summary: string
  }
  macroeconomicAnalysis?: {
    score: number // 0-100 overall macro score
    cyclephase: string
    sectorImpact: string
    adjustedScore: number
    economicRisk: number
    summary: string
  }
  esgAnalysis?: {
    score: number // 0-100 overall ESG score
    impact: 'positive' | 'negative' | 'neutral'
    factors: string[]
    confidence: number
    adjustedScore: number
    summary: string
  }
  shortInterestAnalysis?: {
    score: number // 0-100 overall short interest score
    impact: 'positive' | 'negative' | 'neutral'
    factors: string[]
    confidence: number
    shortInterestRatio: number
    adjustedScore: number
    summary: string
  }
  fundamentals?: FundamentalRatios
  analystRating?: AnalystRatings
  priceTarget?: PriceTarget
  compositeScore?: number
  recommendation?: 'STRONG_BUY' | 'BUY' | 'MODERATE_BUY' | 'HOLD' | 'MODERATE_SELL' | 'SELL' | 'STRONG_SELL' // 7-tier only
  sector?: string
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
      sentimentAnalysisEnabled?: boolean
      macroeconomicAnalysisEnabled?: boolean
      esgAnalysisEnabled?: boolean
      shortInterestAnalysisEnabled?: boolean
      extendedMarketDataEnabled?: boolean
    }
  }
  error?: string
}

// Optimized Service Factory with API Key Validation and Singleton Management
interface ServiceConfig {
  enabled: boolean
  hasRequiredKeys: boolean
  instance: any
  error?: string
}

class OptimizedServiceFactory {
  private static sharedCache: RedisCache | null = null
  private static services: Map<string, ServiceConfig> = new Map()

  /**
   * Get shared cache instance for memory efficiency
   */
  private static getSharedCache(): RedisCache {
    if (!this.sharedCache) {
      this.sharedCache = new RedisCache()
    }
    return this.sharedCache
  }

  /**
   * Pre-validate API keys for fast startup failure detection
   */
  private static validateServiceApiKeys(): Map<string, boolean> {
    const keyValidation = new Map<string, boolean>()

    // Technical Service - always enabled (no API keys required)
    keyValidation.set('technical', true)

    // Sentiment Service - requires NewsAPI key
    keyValidation.set('sentiment', !!process.env.NEWSAPI_KEY)

    // Macroeconomic Service - requires at least one API key (FRED/BLS/EIA)
    keyValidation.set('macroeconomic', !!(
      process.env.FRED_API_KEY ||
      process.env.BLS_API_KEY ||
      process.env.EIA_API_KEY
    ))

    // ESG Service - requires ESG or FMP API key
    keyValidation.set('esg', !!(
      process.env.ESG_API_KEY ||
      process.env.FINANCIAL_MODELING_PREP_API_KEY
    ))

    // Short Interest Service - requires FINRA or Polygon API key
    keyValidation.set('shortInterest', !!(
      process.env.FINRA_API_KEY ||
      process.env.POLYGON_API_KEY
    ))

    // Extended Market Service - requires Polygon API key
    keyValidation.set('extendedMarket', !!process.env.POLYGON_API_KEY)

    return keyValidation
  }

  /**
   * Initialize service with proper error handling and memory optimization
   */
  private static initializeService(serviceType: string): ServiceConfig {
    const cache = this.getSharedCache()
    const keyValidation = this.validateServiceApiKeys()
    const hasKeys = keyValidation.get(serviceType) || false

    if (!hasKeys) {
      return {
        enabled: false,
        hasRequiredKeys: false,
        instance: null,
        error: `Missing required API keys for ${serviceType} service`
      }
    }

    try {
      let instance = null

      switch (serviceType) {
        case 'technical':
          instance = new TechnicalIndicatorService(cache)
          break

        case 'sentiment':
          // Yahoo Finance sentiment doesn't need API key
          instance = new SentimentAnalysisService(cache)
          break

        case 'macroeconomic':
          instance = new MacroeconomicAnalysisService({
            fredApiKey: process.env.FRED_API_KEY,
            blsApiKey: process.env.BLS_API_KEY,
            eiaApiKey: process.env.EIA_API_KEY
          })
          break

        case 'esg':
          instance = new ESGDataService({
            apiKey: process.env.ESG_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY!
          })
          break

        case 'shortInterest':
          instance = new ShortInterestService({
            finraApiKey: process.env.FINRA_API_KEY,
            polygonApiKey: process.env.POLYGON_API_KEY
          })
          break

        case 'extendedMarket':
          const polygonAPI = new PolygonAPI(process.env.POLYGON_API_KEY!)
          instance = new ExtendedMarketDataService(polygonAPI, cache)
          break

        default:
          throw new Error(`Unknown service type: ${serviceType}`)
      }

      return {
        enabled: true,
        hasRequiredKeys: true,
        instance,
        error: undefined
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.warn(`Failed to initialize ${serviceType} service:`, errorMessage)

      return {
        enabled: false,
        hasRequiredKeys: true,
        instance: null,
        error: errorMessage
      }
    }
  }

  /**
   * Get service with lazy initialization and caching
   */
  static getService<T>(serviceType: string): T | null {
    if (!this.services.has(serviceType)) {
      const config = this.initializeService(serviceType)
      this.services.set(serviceType, config)
    }

    const config = this.services.get(serviceType)!
    return config.enabled ? config.instance : null
  }

  /**
   * Get service availability without initializing
   */
  static isServiceAvailable(serviceType: string): boolean {
    const keyValidation = this.validateServiceApiKeys()
    return keyValidation.get(serviceType) || false
  }

  /**
   * Get all service statuses for metadata
   */
  static getServiceStatuses(): Record<string, boolean> {
    const keyValidation = this.validateServiceApiKeys()
    const statuses: Record<string, boolean> = {}

    keyValidation.forEach((hasKeys, serviceType) => {
      statuses[serviceType] = hasKeys
    })

    return statuses
  }

  /**
   * Memory cleanup for testing/development
   */
  static cleanup(): void {
    this.services.clear()
    this.sharedCache = null
  }
}

/**
 * Optimized service getters with fast startup and error handling
 */
function getTechnicalService(): TechnicalIndicatorService {
  return OptimizedServiceFactory.getService<TechnicalIndicatorService>('technical')!
}

function getSentimentService(): SentimentAnalysisService | null {
  return OptimizedServiceFactory.getService<SentimentAnalysisService>('sentiment')
}

function getMacroService(): MacroeconomicAnalysisService | null {
  return OptimizedServiceFactory.getService<MacroeconomicAnalysisService>('macroeconomic')
}

function getESGService(): ESGDataService | null {
  return OptimizedServiceFactory.getService<ESGDataService>('esg')
}

function getShortInterestService(): ShortInterestService | null {
  return OptimizedServiceFactory.getService<ShortInterestService>('shortInterest')
}

function getExtendedMarketService(): ExtendedMarketDataService | null {
  return OptimizedServiceFactory.getService<ExtendedMarketDataService>('extendedMarket')
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
 * Calculate composite score with rebalanced weights:
 * Technical 35%, Fundamental 25%, Macro 20%, Sentiment 10%, Extended Market 5%, Alternative Data 5% (ESG 3% + Short Interest 2%)
 */
function calculateSimpleScore(stock: EnhancedStockData): number {
  let score = 0 // Start from 0 for proper weighted calculation
  let totalWeight = 0

  // Technical analysis (35% weight - reduced from 40%)
  if (stock.technicalAnalysis?.score) {
    score += stock.technicalAnalysis.score * 0.35
    totalWeight += 0.35
  }

  // Fundamental analysis (25% weight) - convert fundamentals to score
  if (stock.fundamentals) {
    let fundamentalScore = 50 // neutral baseline

    // P/E ratio scoring (0-100 scale)
    if (stock.fundamentals.peRatio) {
      if (stock.fundamentals.peRatio < 15) fundamentalScore += 20
      else if (stock.fundamentals.peRatio < 25) fundamentalScore += 10
      else if (stock.fundamentals.peRatio > 40) fundamentalScore -= 15
    }

    // ROE scoring
    if (stock.fundamentals.roe) {
      if (stock.fundamentals.roe > 0.20) fundamentalScore += 15
      else if (stock.fundamentals.roe > 0.15) fundamentalScore += 10
      else if (stock.fundamentals.roe < 0.05) fundamentalScore -= 10
    }

    // Debt-to-equity scoring
    if (stock.fundamentals.debtToEquity) {
      if (stock.fundamentals.debtToEquity < 0.3) fundamentalScore += 10
      else if (stock.fundamentals.debtToEquity > 2) fundamentalScore -= 15
    }

    fundamentalScore = Math.max(0, Math.min(100, fundamentalScore))
    score += fundamentalScore * 0.25
    totalWeight += 0.25
  }

  // Macroeconomic analysis (20% weight)
  if (stock.macroeconomicAnalysis?.score) {
    score += stock.macroeconomicAnalysis.score * 0.20
    totalWeight += 0.20
  }

  // Sentiment analysis (10% weight)
  if (stock.sentimentAnalysis?.adjustedScore) {
    score += stock.sentimentAnalysis.adjustedScore * 0.10
    totalWeight += 0.10
  }

  // Extended Market Data (5% weight) - liquidity and extended hours activity
  let extendedMarketScore = 50 // neutral default
  if (stock.preMarketChangePercent !== undefined || stock.afterHoursChangePercent !== undefined) {
    // Calculate score based on extended hours movement
    if (stock.preMarketChangePercent !== undefined) {
      extendedMarketScore += stock.preMarketChangePercent > 0 ? 10 : -10
    }
    if (stock.afterHoursChangePercent !== undefined) {
      extendedMarketScore += stock.afterHoursChangePercent > 0 ? 10 : -10
    }
    // Factor in bid/ask spread for liquidity
    if (stock.bid && stock.ask) {
      const spread = ((stock.ask - stock.bid) / stock.ask) * 100
      if (spread < 0.1) extendedMarketScore += 10 // Very liquid
      else if (spread < 0.5) extendedMarketScore += 5 // Liquid
      else if (spread > 1) extendedMarketScore -= 5 // Less liquid
    }
    extendedMarketScore = Math.max(0, Math.min(100, extendedMarketScore))
    score += extendedMarketScore * 0.05
    totalWeight += 0.05
  }

  // Alternative Data: ESG analysis (3% weight - reduced from 5%)
  if (stock.esgAnalysis?.score) {
    score += stock.esgAnalysis.score * 0.03
    totalWeight += 0.03
  }

  // Alternative Data: Short Interest analysis (2% weight - reduced from 2.5%)
  if (stock.shortInterestAnalysis?.score) {
    score += stock.shortInterestAnalysis.score * 0.02
    totalWeight += 0.02
  }

  // Normalize by actual weights used (in case some components are missing)
  if (totalWeight > 0) {
    score = score / totalWeight * 100
  } else {
    score = 50 // Default neutral score if no components available
  }

  return Math.max(0, Math.min(100, score))
}

// REMOVED: getRecommendation() - now using centralized RecommendationUtils

/**
 * Enhance stock data with comprehensive analysis
 */
async function enhanceStockData(stocks: StockData[]): Promise<EnhancedStockData[]> {
  const technical = getTechnicalService()
  const sentiment = getSentimentService()
  const macro = getMacroService()
  const esg = getESGService()
  const shortInterest = getShortInterestService()
  const extendedMarket = getExtendedMarketService()
  const enhancedStocks: EnhancedStockData[] = []

  // Process stocks in parallel with Promise.allSettled for resilience
  const analysisPromises = stocks.map(async (stock): Promise<EnhancedStockData> => {
    try {
      // Fetch all data types in parallel
      const [historicalResult, fundamentalsResult, analystResult, priceTargetResult, companyInfoResult] = await Promise.allSettled([
        financialDataService.getHistoricalOHLC(stock.symbol, 50),
        financialDataService.getFundamentalRatios(stock.symbol),
        financialDataService.getAnalystRatings(stock.symbol),
        financialDataService.getPriceTargets(stock.symbol),
        financialDataService.getCompanyInfo(stock.symbol)
      ])

      // Initialize enhanced stock with base data
      let enhancedStock: EnhancedStockData = { ...stock }

      // Add company info and sector data
      if (companyInfoResult.status === 'fulfilled' && companyInfoResult.value) {
        enhancedStock.sector = companyInfoResult.value.sector || 'Unknown'
      }

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

      // Add sentiment analysis if service is available
      if (sentiment && enhancedStock.sector) {
        try {
          const sentimentImpact = await sentiment.analyzeStockSentimentImpact(
            stock.symbol,
            enhancedStock.sector,
            enhancedStock.price || 50 // base score for sentiment analysis
          )

          if (sentimentImpact) {
            enhancedStock.sentimentAnalysis = {
              score: sentimentImpact.sentimentScore.overall,
              impact: sentimentImpact.sentimentScore.overall >= 60 ? 'positive' :
                     sentimentImpact.sentimentScore.overall <= 40 ? 'negative' : 'neutral',
              confidence: sentimentImpact.sentimentScore.confidence || 0.5,
              newsVolume: 0, // Will be enhanced in future iterations
              adjustedScore: sentimentImpact.adjustedScore,
              summary: `${sentimentImpact.sentimentScore.overall >= 60 ? 'Positive' :
                         sentimentImpact.sentimentScore.overall <= 40 ? 'Negative' : 'Neutral'} sentiment with ${(sentimentImpact.sentimentScore.confidence || 0.5).toFixed(1)}% confidence`
            }
          }
        } catch (error) {
          console.warn(`Sentiment analysis failed for ${stock.symbol}:`, error)
        }
      }

      // Add macroeconomic analysis if service is available and sector is known
      if (macro && enhancedStock.sector) {
        try {
          const macroImpact = await macro.analyzeStockMacroImpact(
            stock.symbol,
            enhancedStock.sector,
            enhancedStock.price || 50 // base score for macro analysis
          )

          if (macroImpact) {
            enhancedStock.macroeconomicAnalysis = {
              score: macroImpact.macroScore,
              cyclephase: 'expansion', // Will be enhanced when cycle analysis is available
              sectorImpact: 'neutral', // Simplified for now - using neutral default
              adjustedScore: macroImpact.adjustedScore,
              economicRisk: macroImpact.confidence,
              summary: `Economic outlook: ${macroImpact.impact} with ${Math.round(macroImpact.confidence * 100)}% confidence`
            }
          }
        } catch (error) {
          console.warn(`Macroeconomic analysis failed for ${stock.symbol}:`, error)
        }
      }

      // Add ESG analysis if service is available and sector is known
      if (esg && enhancedStock.sector) {
        try {
          const esgImpact = await esg.getESGImpactForStock(
            stock.symbol,
            enhancedStock.sector,
            enhancedStock.price || 50 // base score for ESG analysis
          )

          if (esgImpact) {
            enhancedStock.esgAnalysis = {
              score: esgImpact.esgScore,
              impact: esgImpact.impact,
              factors: esgImpact.factors,
              confidence: esgImpact.confidence,
              adjustedScore: esgImpact.adjustedScore,
              summary: `ESG ${esgImpact.impact} impact with ${Math.round(esgImpact.confidence * 100)}% confidence`
            }
          }
        } catch (error) {
          console.warn(`ESG analysis failed for ${stock.symbol}:`, error)
        }
      }

      // Add Short Interest analysis if service is available and sector is known
      // Service now returns null when no API keys available - NO MOCK DATA
      if (shortInterest && enhancedStock.sector) {
        try {
          const shortImpact = await shortInterest.getShortInterestImpactForStock(
            stock.symbol,
            enhancedStock.sector,
            enhancedStock.price || 50 // base score for short interest analysis
          )

          // Only add analysis if real data is available
          if (shortImpact && shortImpact.confidence > 0) {
            enhancedStock.shortInterestAnalysis = {
              score: shortImpact.score,
              impact: shortImpact.impact,
              factors: shortImpact.factors,
              confidence: shortImpact.confidence,
              shortInterestRatio: shortImpact.shortInterestScore,
              adjustedScore: shortImpact.adjustedScore,
              summary: shortImpact.shortInterestScore > 0 ?
                `Short interest ${shortImpact.impact} impact (${shortImpact.shortInterestScore}% ratio) with ${Math.round(shortImpact.confidence * 100)}% confidence` :
                'Short interest data unavailable - no API keys configured'
            }
          } else {
            // Log when short interest is unavailable but don't include it in analysis
            console.log(`Short interest data unavailable for ${stock.symbol} - no API keys or data not found`)
          }
        } catch (error) {
          console.warn(`Short interest analysis failed for ${stock.symbol}:`, error)
        }
      }

      // Add extended market data analysis if service is available
      if (extendedMarket) {
        try {
          const extendedData = await extendedMarket.getExtendedMarketData(stock.symbol)

          if (extendedData) {
            // Calculate extended market score and add to enhanced data
            const extendedScore = extendedMarket.calculateExtendedMarketScore(extendedData)

            // Add extended market fields to stock data
            if (extendedData.extendedHours) {
              enhancedStock.preMarketPrice = extendedData.extendedHours.preMarketPrice
              enhancedStock.preMarketChange = extendedData.extendedHours.preMarketChange
              enhancedStock.preMarketChangePercent = extendedData.extendedHours.preMarketChangePercent
              enhancedStock.afterHoursPrice = extendedData.extendedHours.afterHoursPrice
              enhancedStock.afterHoursChange = extendedData.extendedHours.afterHoursChange
              enhancedStock.afterHoursChangePercent = extendedData.extendedHours.afterHoursChangePercent
            }

            // Add bid/ask if available
            if (extendedData.bidAskSpread) {
              enhancedStock.bid = extendedData.bidAskSpread.bid
              enhancedStock.ask = extendedData.bidAskSpread.ask
            }
          }
        } catch (error) {
          console.warn(`Extended market analysis failed for ${stock.symbol}:`, error)
        }
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

      // Pass analyst data for recommendation upgrades
      const analystData = enhancedStock.analystRating ? {
        totalAnalysts: enhancedStock.analystRating.totalAnalysts,
        sentimentScore: enhancedStock.analystRating.sentimentScore,
        distribution: {
          strongBuy: enhancedStock.analystRating.strongBuy,
          buy: enhancedStock.analystRating.buy,
          hold: enhancedStock.analystRating.hold,
          sell: enhancedStock.analystRating.sell,
          strongSell: enhancedStock.analystRating.strongSell
        }
      } : undefined

      enhancedStock.recommendation = getRecommendation(compositeScore, analystData)

      return enhancedStock
    } catch (error) {
      console.error(`Stock enhancement failed for ${stock.symbol}:`, error)
      // Only return the stock if it has a valid symbol
      if (stock && stock.symbol) {
        return { ...stock }
      }
      // Return null for invalid stocks - will be filtered out
      return null as any
    }
  })

  const results = await Promise.allSettled(analysisPromises)

  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value && result.value.symbol) {
      // Only include stocks that have valid data
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

    // Return enhanced response - set timestamp after all processing is complete
    const response: SimpleStockResponse = {
      success: true,
      data: {
        stocks: enhancedStocks,
        metadata: {
          mode,
          count: enhancedStocks.length,
          timestamp: Date.now(), // Set timestamp after processing
          sources: Array.from(sources),
          technicalAnalysisEnabled: true,
          fundamentalDataEnabled: true,
          analystDataEnabled: true,
          sentimentAnalysisEnabled: OptimizedServiceFactory.isServiceAvailable('sentiment'),
          macroeconomicAnalysisEnabled: OptimizedServiceFactory.isServiceAvailable('macroeconomic'),
          esgAnalysisEnabled: OptimizedServiceFactory.isServiceAvailable('esg'),
          shortInterestAnalysisEnabled: OptimizedServiceFactory.isServiceAvailable('shortInterest'),
          extendedMarketDataEnabled: OptimizedServiceFactory.isServiceAvailable('extendedMarket')
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Stock selection error:', error)

    // Return appropriate status codes for different error types
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
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