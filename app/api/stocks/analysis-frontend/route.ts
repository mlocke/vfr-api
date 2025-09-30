/**
 * Frontend Analysis API Endpoint
 * Integrates with existing StockSelectionService for comprehensive analysis
 * Outputs results to JSON files for user viewing
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
import { FinancialModelingPrepAPI } from '../../../services/financial-data/FinancialModelingPrepAPI'
import { SecurityValidator } from '../../../services/security/SecurityValidator'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { AnalysisErrorLogger } from '../../../services/error-handling/AnalysisErrorLogger'

// Frontend request validation schema
const FrontendAnalysisRequestSchema = z.object({
  mode: z.enum(['single', 'sector', 'multiple']),
  sector: z.object({
    id: z.string(),
    label: z.string(),
    category: z.enum(['sector', 'index', 'etf'])
  }).optional(),
  symbols: z.array(z.string()).optional(),
  options: z.object({
    useRealTimeData: z.boolean().default(true),
    includeSentiment: z.boolean().default(true),
    includeNews: z.boolean().default(true),
    timeout: z.number().default(30000)
  }).optional()
}).refine((data) => {
  // Validate that we have either sector or symbols based on mode
  if (data.mode === 'sector' && !data.sector) {
    return false
  }
  if ((data.mode === 'single' || data.mode === 'multiple') && (!data.symbols || data.symbols.length === 0)) {
    return false
  }
  return true
}, {
  message: "Request must include sector for 'sector' mode or symbols for 'single'/'multiple' modes"
})

// Response interface
interface FrontendAnalysisResponse {
  success: boolean
  data?: {
    analysisId: string
    filePath: string
    resultsCount: number
    processingTime: number
    metadata: {
      mode: string
      timestamp: number
      dataSourcesUsed: string[]
      analysisInputServices: Record<string, any>
    }
  }
  error?: string
}

// Initialize services (singleton pattern with connection pooling for optimal performance)
let stockSelectionService: StockSelectionService | null = null
let serviceInitializationPromise: Promise<StockSelectionService> | null = null

/**
 * Get or initialize the comprehensive StockSelectionService with connection pooling
 */
async function getStockSelectionService(): Promise<StockSelectionService> {
  if (stockSelectionService) {
    return stockSelectionService
  }

  // Prevent concurrent initialization attempts
  if (serviceInitializationPromise) {
    return serviceInitializationPromise
  }

  serviceInitializationPromise = initializeStockSelectionService()
  stockSelectionService = await serviceInitializationPromise
  serviceInitializationPromise = null
  return stockSelectionService
}

async function initializeStockSelectionService(): Promise<StockSelectionService> {

  try {
    // Initialize core dependencies with shared connection pooling
    const cache = new RedisCache() // Instantiate with default config
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
      if (process.env.FMP_API_KEY) {
        const fmpAPI = new FinancialModelingPrepAPI(process.env.FMP_API_KEY)
        vwapService = new VWAPService(fmpAPI, cache)
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
        polygonApiKey: process.env.FMP_API_KEY
      })
    } catch (error) {
      console.warn('Short interest service not available:', error)
    }

    let extendedMarketService: ExtendedMarketDataService | undefined
    try {
      if (process.env.FMP_API_KEY) {
        const fmpAPI = new FinancialModelingPrepAPI(process.env.FMP_API_KEY)
        extendedMarketService = new ExtendedMarketDataService(fmpAPI, cache)
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
      optionsService
    )

    console.log('✅ Frontend StockSelectionService initialized')
    return stockSelectionService

  } catch (error) {
    console.error('Failed to initialize StockSelectionService:', error)
    throw new Error('Service initialization failed')
  }
}

/**
 * Convert frontend request to SelectionRequest format
 */
function convertToSelectionRequest(validatedRequest: any): SelectionRequest {
  const { mode, symbols, sector, options = {} } = validatedRequest

  let selectionMode: SelectionMode
  let scope: AnalysisScope

  switch (mode) {
    case 'single':
      selectionMode = SelectionMode.SINGLE_STOCK
      scope = {
        mode: selectionMode,
        symbols: symbols,
        maxResults: 1
      }
      break

    case 'sector':
      selectionMode = SelectionMode.SECTOR_ANALYSIS
      scope = {
        mode: selectionMode,
        sector: {
          id: sector.id,
          label: sector.label,
          description: `${sector.label} sector analysis`,
          category: sector.category
        },
        maxResults: 20
      }
      break

    case 'multiple':
      selectionMode = SelectionMode.MULTIPLE_STOCKS
      scope = {
        mode: selectionMode,
        symbols: symbols,
        maxResults: Math.min(symbols.length, 10)
      }
      break

    default:
      throw new Error(`Unsupported mode: ${mode}`)
  }

  return {
    scope,
    options: {
      algorithmId: 'composite',
      useRealTimeData: options.useRealTimeData ?? true,
      includeSentiment: options.includeSentiment ?? true,
      includeNews: options.includeNews ?? true,
      riskTolerance: 'moderate',
      timeout: options.timeout || 30000
    },
    requestId: `frontend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Generate unique analysis ID and filename
 */
function generateAnalysisId(): string {
  const timestamp = Date.now()
  const hash = crypto.createHash('md5')
    .update(`${timestamp}-frontend-${Math.random()}`)
    .digest('hex')
    .substring(0, 6)
  return `frontend_${timestamp}_${hash}`
}

function generateFileName(mode: string, timestamp: number): string {
  const hash = crypto.createHash('md5')
    .update(`${timestamp}-${mode}-${Math.random()}`)
    .digest('hex')
    .substring(0, 6)
  return `analysis-${timestamp}-${mode}-${hash}.json`
}

/**
 * Write analysis results to JSON file with enhanced error details
 */
async function writeAnalysisResults(
  analysisResult: any,
  metadata: any,
  validatedRequest: any
): Promise<string> {
  try {
    const timestamp = Date.now()
    const analysisId = generateAnalysisId()
    const fileName = generateFileName(validatedRequest.mode, timestamp)

    // Ensure results directory exists
    const resultsDir = path.join(process.cwd(), 'public/analysis-results')
    await fs.mkdir(resultsDir, { recursive: true })

    // Extract error logger and summary from metadata
    const errorLogger = metadata.errorLogger
    const errorSummary = metadata.errorSummary

    // Prepare file content with enhanced error details
    const fileContent = {
      metadata: {
        analysisId,
        timestamp,
        requestId: analysisResult.requestId,
        mode: validatedRequest.mode,
        processingTime: metadata.processingTime,
        dataSourcesUsed: analysisResult.metadata?.dataSourcesUsed || [],
        serviceHealth: {
          totalServices: analysisResult.metadata?.analysisInputServices ?
            Object.keys(analysisResult.metadata.analysisInputServices).length : 0,
          activeServices: analysisResult.metadata?.analysisInputServices ?
            Object.values(analysisResult.metadata.analysisInputServices).filter((s: any) => s.enabled).length : 0,
          degradedServices: analysisResult.metadata?.analysisInputServices ?
            Object.entries(analysisResult.metadata.analysisInputServices)
              .filter(([_, service]: [string, any]) => service.enabled && (service.errors?.length > 0))
              .map(([name]) => name) : []
        },
        errorAnalysis: errorSummary ? {
          totalErrors: errorSummary.totalErrors,
          errorsByType: errorSummary.errorsByType,
          errorsBySeverity: errorSummary.errorsBySeverity,
          retryableErrors: errorSummary.retryableErrors,
          criticalErrors: errorSummary.criticalErrors.length,
          rateLimitErrors: errorSummary.rateLimitErrors.length,
          serviceUnavailableErrors: errorSummary.serviceUnavailableErrors.length
        } : null
      },
      input: {
        sector: validatedRequest.sector,
        symbols: validatedRequest.symbols,
        options: validatedRequest.options
      },
      results: {
        success: analysisResult.success,
        topSelections: analysisResult.topSelections || [],
        analysisInputServices: analysisResult.metadata?.analysisInputServices || {}
      },
      errors: analysisResult.errors || [],
      detailedErrors: errorLogger ? {
        summary: errorSummary,
        categorizedErrors: errorLogger.getAllErrors().map((error: any) => ({
          type: error.errorType,
          severity: error.severity,
          reason: error.reason,
          symbol: error.symbol,
          service: error.service,
          retryable: error.retryable,
          timestamp: error.timestamp,
          originalError: error.originalError
        })),
        rateLimitIssues: errorLogger.getErrorsFor(undefined, undefined).filter((e: any) => e.errorType === 'RATE_LIMIT'),
        serviceIssues: errorLogger.getErrorsFor(undefined, undefined).filter((e: any) => e.errorType === 'API_UNAVAILABLE'),
        criticalIssues: errorLogger.getErrorsFor(undefined, undefined).filter((e: any) => e.severity === 'CRITICAL')
      } : null
    }

    // Write to temporary file first, then rename (atomic operation)
    const filePath = path.join(resultsDir, fileName)
    const tempFilePath = `${filePath}.tmp`

    await fs.writeFile(tempFilePath, JSON.stringify(fileContent, null, 2))
    await fs.rename(tempFilePath, filePath)

    // Update latest symlink
    const latestSymlink = path.join(resultsDir, 'latest-analysis.json')
    try {
      try {
        await fs.access(latestSymlink)
        await fs.unlink(latestSymlink)
      } catch (error) {
        // Symlink doesn't exist, that's fine
      }
      await fs.symlink(fileName, latestSymlink)
    } catch (symlinkError) {
      console.warn('Failed to update latest symlink:', symlinkError)
    }

    console.log(`✅ Analysis results written to: ${fileName}`)
    return fileName

  } catch (error) {
    console.error('Failed to write analysis results:', error)
    throw new Error('Failed to save analysis results')
  }
}

/**
 * Validate symbols using SecurityValidator
 */
function validateSymbols(symbols: string[]): string[] {
  const validator = SecurityValidator.getInstance()
  return symbols.map(symbol => {
    const validation = validator.validateSymbol(symbol)
    if (!validation.isValid) {
      throw new Error(`Invalid symbol: ${symbol}`)
    }
    return validation.sanitized || symbol
  })
}

/**
 * POST handler - Execute analysis and save to JSON file
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🚀 Starting frontend analysis request...')
    const startTime = Date.now()

    // Parse and validate request
    const body = await request.json()
    const validatedRequest = FrontendAnalysisRequestSchema.parse(body)

    // Security validation
    if (validatedRequest.symbols) {
      try {
        validatedRequest.symbols = validateSymbols(validatedRequest.symbols)
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Invalid symbols provided'
        }, { status: 400 })
      }
    }

    // Get the comprehensive service
    const service = await getStockSelectionService()

    // Convert to SelectionRequest format
    const selectionRequest = convertToSelectionRequest(validatedRequest)

    console.log('📊 Executing frontend analysis:', {
      mode: selectionRequest.scope.mode,
      symbols: selectionRequest.scope.symbols,
      sector: selectionRequest.scope.sector?.label,
      requestId: selectionRequest.requestId
    })

    // Initialize error logger for detailed error tracking
    const errorLogger = new AnalysisErrorLogger()

    // Execute comprehensive analysis
    const analysisResult = await service.selectStocks(selectionRequest)
    const processingTime = Date.now() - startTime

    // Process and categorize any errors that occurred during analysis
    if (analysisResult.errors && analysisResult.errors.length > 0) {
      analysisResult.errors.forEach((error: string) => {
        // Extract service and symbol information from error message if possible
        const symbolMatch = error.match(/for ([A-Z]{1,5})/i)
        const serviceMatch = error.match(/(Polygon|FMP|TwelveData|News|Reddit|FRED|BLS|EIA)/i)

        const symbol = symbolMatch ? symbolMatch[1] : undefined
        const service = serviceMatch ? serviceMatch[1] : undefined

        errorLogger.logError(error, symbol, service, selectionRequest.requestId)
      })
    }

    // Log additional service-level errors from analysisInputServices
    if (analysisResult.metadata?.analysisInputServices) {
      Object.entries(analysisResult.metadata.analysisInputServices).forEach(([serviceName, serviceData]: [string, any]) => {
        if (serviceData.errors && serviceData.errors.length > 0) {
          serviceData.errors.forEach((error: string) => {
            errorLogger.logError(error, undefined, serviceName, selectionRequest.requestId)
          })
        }
      })
    }

    // Generate error summary for logging
    const errorSummary = errorLogger.getErrorSummary()

    if (errorSummary.totalErrors > 0) {
      console.warn(`⚠️ Analysis completed with ${errorSummary.totalErrors} issues:`, {
        rateLimitErrors: errorSummary.rateLimitErrors.length,
        serviceUnavailableErrors: errorSummary.serviceUnavailableErrors.length,
        criticalErrors: errorSummary.criticalErrors.length,
        retryableIssues: errorSummary.retryableErrors
      })
    }

    console.log(`✅ Frontend analysis completed in ${processingTime}ms`, {
      success: analysisResult.success,
      topSelections: analysisResult.topSelections.length,
      errorSummary: errorSummary.totalErrors > 0 ? {
        total: errorSummary.totalErrors,
        byType: errorSummary.errorsByType,
        bySeverity: errorSummary.errorsBySeverity
      } : 'No errors'
    })

    // Write results to JSON file
    const fileName = await writeAnalysisResults(
      analysisResult,
      { processingTime, errorLogger, errorSummary },
      validatedRequest
    )

    // Return success response
    const response: FrontendAnalysisResponse = {
      success: true,
      data: {
        analysisId: generateAnalysisId(),
        filePath: fileName,
        resultsCount: analysisResult.topSelections.length,
        processingTime,
        metadata: {
          mode: validatedRequest.mode,
          timestamp: Date.now(),
          dataSourcesUsed: analysisResult.metadata?.dataSourcesUsed || [],
          analysisInputServices: analysisResult.metadata?.analysisInputServices || {}
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Frontend analysis error:', error)

    // Return appropriate status codes for different error types
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format: ' + error.issues.map((e: any) => e.message).join(', ')
      }, { status: 400 })
    }

    if (error instanceof Error) {
      if (error.message.includes('Service initialization failed')) {
        return NextResponse.json({
          success: false,
          error: 'Analysis service is currently unavailable'
        }, { status: 503 })
      }

      if (error.message.includes('Invalid symbol')) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 400 })
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Analysis failed. Please try again.'
    }, { status: 500 })
  }
}

/**
 * GET handler - Health check for frontend integration
 */
export async function GET(): Promise<NextResponse> {
  try {
    const service = await getStockSelectionService()

    // Check file system write permissions
    const resultsDir = path.join(process.cwd(), 'public/analysis-results')
    await fs.mkdir(resultsDir, { recursive: true })

    const testFile = path.join(resultsDir, '.health-check')
    await fs.writeFile(testFile, 'test')
    await fs.unlink(testFile)

    return NextResponse.json({
      success: true,
      status: 'healthy',
      timestamp: Date.now(),
      services: {
        stockSelection: 'available',
        fileSystem: 'writable'
      }
    })
  } catch (error) {
    console.error('Frontend analysis health check failed:', error)
    return NextResponse.json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Health check failed'
    }, { status: 503 })
  }
}

// Configure Next.js route to allow longer execution time for deep analysis
export const maxDuration = 60 // 60 seconds for complex financial analysis