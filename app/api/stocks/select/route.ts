/**
 * Unified Stock Selection API Endpoint
 * Supports all selection types: single stock, sector analysis, multiple stocks
 * Integrates with StockSelectionService and provides comprehensive error handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  SelectionRequest,
  SelectionResponse,
  SelectionMode,
  SelectionOptions,
  AnalysisScope
} from '../../../services/stock-selection/types'
import { StockSelectionService, createStockSelectionService } from '../../../services/stock-selection/StockSelectionService'
import { DataFlowManager } from '../../../services/stock-selection/DataFlowManager'
import { mcpClient } from '../../../services/mcp/MCPClient'
import { DataFusionEngine } from '../../../services/mcp/DataFusionEngine'
import { FactorLibrary } from '../../../services/algorithms/FactorLibrary'
import { redisCache } from '../../../services/cache/RedisCache'

// Request validation schemas
const SectorSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.string().optional()
})

const TimeframeSchema = z.object({
  start: z.number().optional(),
  end: z.number().optional(),
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional()
})

const AnalysisScopeSchema = z.object({
  mode: z.nativeEnum(SelectionMode),
  symbols: z.array(z.string()).optional(),
  sector: SectorSchema.optional(),
  excludeSymbols: z.array(z.string()).optional(),
  maxResults: z.number().min(1).max(100).optional(),
  timeframe: TimeframeSchema.optional()
})

const CustomWeightsSchema = z.object({
  technical: z.number().min(0).max(1).optional(),
  fundamental: z.number().min(0).max(1).optional(),
  sentiment: z.number().min(0).max(1).optional(),
  momentum: z.number().min(0).max(1).optional()
})

const DataPreferencesSchema = z.object({
  sources: z.array(z.string()).optional(),
  minQualityScore: z.number().min(0).max(1).optional(),
  maxLatency: z.number().min(0).optional()
})

const SelectionOptionsSchema = z.object({
  algorithmId: z.string().optional(),
  useRealTimeData: z.boolean().optional(),
  includeSentiment: z.boolean().optional(),
  includeNews: z.boolean().optional(),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  dataPreferences: DataPreferencesSchema.optional(),
  customWeights: CustomWeightsSchema.optional(),
  timeout: z.number().min(1000).max(300000).optional(), // 1s to 5min
  parallel: z.boolean().optional()
})

const SelectionRequestSchema = z.object({
  scope: AnalysisScopeSchema,
  options: SelectionOptionsSchema.optional(),
  requestId: z.string().optional(),
  userId: z.string().optional()
})

// Service instances (connection pooling)
class ServicePool {
  private static instance: ServicePool
  private stockSelectionService: StockSelectionService | null = null
  private dataFlowManager: DataFlowManager | null = null
  private isInitializing = false
  private initPromise: Promise<void> | null = null

  static getInstance(): ServicePool {
    if (!ServicePool.instance) {
      ServicePool.instance = new ServicePool()
    }
    return ServicePool.instance
  }

  async getServices(): Promise<{ stockSelectionService: StockSelectionService; dataFlowManager: DataFlowManager }> {
    if (this.stockSelectionService && this.dataFlowManager) {
      return { stockSelectionService: this.stockSelectionService, dataFlowManager: this.dataFlowManager }
    }

    if (this.isInitializing && this.initPromise) {
      await this.initPromise
      return { stockSelectionService: this.stockSelectionService!, dataFlowManager: this.dataFlowManager! }
    }

    this.isInitializing = true
    this.initPromise = this.initializeServices()
    await this.initPromise
    this.isInitializing = false

    return { stockSelectionService: this.stockSelectionService!, dataFlowManager: this.dataFlowManager! }
  }

  private async initializeServices(): Promise<void> {
    try {
      console.log('🔧 Initializing Stock Selection Service Pool...')

      const dataFusion = new DataFusionEngine(mcpClient, redisCache)
      const factorLibrary = new FactorLibrary()

      this.dataFlowManager = new DataFlowManager(dataFusion, mcpClient, redisCache)
      this.stockSelectionService = await createStockSelectionService(
        mcpClient,
        dataFusion,
        factorLibrary,
        redisCache
      )

      console.log('✅ Stock Selection Service Pool initialized')
    } catch (error) {
      console.error('❌ Failed to initialize Service Pool:', error)
      this.isInitializing = false
      throw new Error('Service pool initialization failed')
    }
  }
}

const servicePool = ServicePool.getInstance()

// Enhanced request tracking with pooling
class RequestTracker {
  private activeRequests = new Map<string, { timestamp: number; abortController: AbortController; priority: number }>()
  private requestQueue: Array<{ requestId: string; resolve: Function; reject: Function; priority: number }> = []
  private maxConcurrentRequests = 10
  private processingRequests = 0

  addRequest(requestId: string, priority: number = 1): Promise<void> {
    const abortController = new AbortController()
    this.activeRequests.set(requestId, { timestamp: Date.now(), abortController, priority })

    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestId, resolve, reject, priority })
      this.processQueue()
    })
  }

  private processQueue(): void {
    if (this.processingRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
      return
    }

    // Sort by priority (higher priority first)
    this.requestQueue.sort((a, b) => b.priority - a.priority)

    const next = this.requestQueue.shift()
    if (next) {
      this.processingRequests++
      next.resolve()
    }
  }

  completeRequest(requestId: string): void {
    this.activeRequests.delete(requestId)
    this.processingRequests--
    this.processQueue() // Process next in queue
  }

  getActiveRequest(requestId: string) {
    return this.activeRequests.get(requestId)
  }

  cleanup(): void {
    const now = Date.now()
    const maxAge = 5 * 60 * 1000 // 5 minutes

    for (const [requestId, { timestamp, abortController }] of this.activeRequests.entries()) {
      if (now - timestamp > maxAge) {
        abortController.abort()
        this.activeRequests.delete(requestId)
      }
    }
  }
}

const requestTracker = new RequestTracker()

// Enhanced rate limiting with burst capacity
class RateLimiter {
  private rateLimitMap = new Map<string, { count: number; resetTime: number; burst: number }>()
  private readonly RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 30
  private readonly BURST_CAPACITY = 10

  checkRateLimit(identifier: string, priority: number = 1): boolean {
    const now = Date.now()
    const limit = this.rateLimitMap.get(identifier)

    if (!limit || now > limit.resetTime) {
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
        burst: priority > 1 ? 1 : 0
      })
      return true
    }

    // Allow burst for high-priority requests
    if (priority > 1 && limit.burst < this.BURST_CAPACITY) {
      limit.burst++
      return true
    }

    if (limit.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      return false
    }

    limit.count++
    return true
  }
}

const rateLimiter = new RateLimiter()

/**
 * Response streaming for large datasets
 */
class ResponseStreamer {
  static createStreamingResponse(data: any): ReadableStream {
    return new ReadableStream({
      start(controller) {
        // Stream response in chunks to reduce perceived latency
        const chunks = this.chunkData(data)
        let index = 0

        const pump = () => {
          if (index < chunks.length) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(chunks[index]) + '\n'))
            index++
            setTimeout(pump, 1) // Minimal delay to avoid blocking
          } else {
            controller.close()
          }
        }

        pump()
      }
    })
  }

  private static chunkData(data: any): any[] {
    // For stock selection responses, stream results as they become available
    if (data.topSelections && Array.isArray(data.topSelections)) {
      return [
        { type: 'metadata', data: { ...data, topSelections: undefined } },
        ...data.topSelections.map((selection: any, index: number) => ({
          type: 'selection',
          index,
          data: selection
        })),
        { type: 'complete' }
      ]
    }

    return [data]
  }
}

/**
 * Performance optimization utilities
 */
class PerformanceOptimizer {
  static optimizeRequestPriority(request: SelectionRequest): number {
    // Determine request priority based on characteristics
    let priority = 1

    // High priority for single stock queries (typically faster)
    if (request.scope.mode === SelectionMode.SINGLE_STOCK) {
      priority += 2
    }

    // High priority for real-time data requests
    if (request.options?.useRealTimeData) {
      priority += 1
    }

    // Lower priority for large multi-stock requests
    if (request.scope.symbols && request.scope.symbols.length > 10) {
      priority -= 1
    }

    return Math.max(1, priority)
  }

  static shouldUseStreaming(request: SelectionRequest): boolean {
    // Use streaming for requests likely to have large responses
    return (
      request.scope.mode === SelectionMode.SECTOR_ANALYSIS ||
      (request.scope.symbols && request.scope.symbols.length > 5) ||
      request.scope.maxResults && request.scope.maxResults > 10
    )
  }
}

/**
 * Performance-optimized request processing
 */
async function processOptimizedRequest(
  selectionRequest: SelectionRequest,
  requestId: string,
  startTime: number
): Promise<SelectionResponse> {
  const { stockSelectionService } = await servicePool.getServices()

  // Add request to tracking queue
  const priority = PerformanceOptimizer.optimizeRequestPriority(selectionRequest)
  await requestTracker.addRequest(requestId, priority)

  try {
    // Check for cached response first (fastest path)
    const cacheKey = generateCacheKey(selectionRequest)
    const cached = await redisCache.get(cacheKey)
    if (cached) {
      console.log(`⚡ Cache hit for request ${requestId} in ${Date.now() - startTime}ms`)
      return cached
    }

    // Execute with timeout and performance monitoring
    const timeout = selectionRequest.options?.timeout || 30000 // Reduced default timeout
    const result = await Promise.race([
      stockSelectionService.selectStocks({
        ...selectionRequest,
        requestId
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      })
    ])

    // Cache successful results asynchronously
    setImmediate(() => {
      redisCache.set(cacheKey, result, 300).catch(error =>
        console.warn('Async cache store failed:', error)
      )
    })

    return result
  } finally {
    requestTracker.completeRequest(requestId)
  }
}

/**
 * Generate cache key for request
 */
function generateCacheKey(request: SelectionRequest): string {
  const keyParts = [
    request.scope.mode,
    request.scope.symbols?.sort().join(',') || '',
    request.scope.sector?.id || '',
    request.scope.maxResults || '10',
    JSON.stringify(request.options || {})
  ]
  return `selection:${keyParts.join(':')}:v2`
}

/**
 * Extract client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Use IP address as primary identifier
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwardedFor?.split(',')[0] || realIp || 'unknown'

  // Also consider user agent for additional uniqueness
  const userAgent = request.headers.get('user-agent') || ''

  return `${ip}:${userAgent.slice(0, 50)}`
}

/**
 * Memory management and cleanup
 */
class MemoryManager {
  private static instance: MemoryManager
  private cleanupInterval: NodeJS.Timeout | null = null
  private gcThreshold = 100 * 1024 * 1024 // 100MB

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup()
    }, 30000) // Every 30 seconds
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  private performCleanup(): void {
    // Clean up expired requests
    requestTracker.cleanup()

    // Force garbage collection if memory usage is high
    const memUsage = process.memoryUsage()
    if (memUsage.heapUsed > this.gcThreshold && global.gc) {
      console.log('🧹 Triggering garbage collection due to high memory usage')
      global.gc()
    }

    // Log memory stats periodically
    if (Math.random() < 0.1) { // 10% chance
      console.log(`📊 Memory usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`)
    }
  }
}

const memoryManager = MemoryManager.getInstance()
memoryManager.startCleanup()

/**
 * POST /api/stocks/select
 * Main endpoint for stock selection requests
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  let requestId: string | undefined

  try {
    // Enhanced rate limiting with priority
    const clientId = getClientIdentifier(request)
    const priority = Math.random() > 0.9 ? 2 : 1 // 10% high priority

    if (!rateLimiter.checkRateLimit(clientId, priority)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: 60
        },
        { status: 429 }
      )
    }

    // Parse request body
    let requestBody: any
    try {
      requestBody = await request.json()
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON'
        },
        { status: 400 }
      )
    }

    // Validate request structure
    const validationResult = SelectionRequestSchema.safeParse(requestBody)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format',
          message: 'Request validation failed',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const selectionRequest: SelectionRequest = validationResult.data
    requestId = selectionRequest.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Validate scope-specific requirements
    const scopeValidation = validateAnalysisScope(selectionRequest.scope)
    if (!scopeValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid analysis scope',
          message: scopeValidation.message
        },
        { status: 400 }
      )
    }

    console.log(`📊 Processing optimized selection request ${requestId}:`, {
      mode: selectionRequest.scope.mode,
      symbols: selectionRequest.scope.symbols?.length || 0,
      sector: selectionRequest.scope.sector?.label,
      priority,
      streaming: PerformanceOptimizer.shouldUseStreaming(selectionRequest)
    })

    // Execute optimized processing
    const result: SelectionResponse = await processOptimizedRequest(
      selectionRequest,
      requestId,
      startTime
    )

    const processingTime = Date.now() - startTime

    // Determine response strategy
    const useStreaming = PerformanceOptimizer.shouldUseStreaming(selectionRequest) && processingTime > 1000

    if (useStreaming) {
      // Streaming response for large datasets
      const stream = ResponseStreamer.createStreamingResponse(result)
      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'X-Request-ID': requestId,
          'X-Processing-Time': `${processingTime}ms`,
          'X-Streaming': 'true',
          'Cache-Control': 'no-cache'
        }
      })
    } else {
      // Standard JSON response for fast queries
      const response = NextResponse.json(result)
      response.headers.set('X-Request-ID', requestId)
      response.headers.set('X-Processing-Time', `${processingTime}ms`)
      response.headers.set('X-Streaming', 'false')
      response.headers.set('Cache-Control', 'public, max-age=300') // 5min cache for successful responses

      console.log(`✅ Selection request ${requestId} completed in ${processingTime}ms`)
      return response
    }

    // Error handling is now managed within processOptimizedRequest

  } catch (error) {
    console.error(`❌ Stock selection API error (${requestId}):`, error)

    // Error cleanup is handled by RequestTracker

    // Determine error type and status
    let status = 500
    let errorMessage = 'Internal server error'
    let errorDetails = error instanceof Error ? error.message : 'Unknown error'

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        status = 408
        errorMessage = 'Request timeout'
      } else if (error.message.includes('Rate limit')) {
        status = 429
        errorMessage = 'Rate limit exceeded'
      } else if (error.message.includes('validation') || error.message.includes('Invalid')) {
        status = 400
        errorMessage = 'Bad request'
      } else if (error.message.includes('Service initialization')) {
        status = 503
        errorMessage = 'Service unavailable'
      }
    }

    const errorResponse = {
      success: false,
      requestId: requestId || 'unknown',
      timestamp: Date.now(),
      executionTime: Date.now() - startTime,
      error: errorMessage,
      message: errorDetails,
      topSelections: [],
      metadata: {
        algorithmUsed: 'error',
        dataSourcesUsed: [],
        cacheHitRate: 0,
        analysisMode: 'error' as any,
        qualityScore: {
          overall: 0,
          metrics: {
            freshness: 0,
            completeness: 0,
            accuracy: 0,
            sourceReputation: 0,
            latency: 0
          },
          timestamp: Date.now(),
          source: 'error'
        }
      },
      performance: {
        dataFetchTime: 0,
        analysisTime: 0,
        fusionTime: 0,
        cacheTime: 0
      }
    }

    const response = NextResponse.json(errorResponse, { status })

    if (requestId) {
      response.headers.set('X-Request-ID', requestId)
    }
    response.headers.set('X-Processing-Time', `${Date.now() - startTime}ms`)

    return response
  }
}

/**
 * GET /api/stocks/select
 * Health check and service status
 */
export async function GET(): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    const { stockSelectionService } = await servicePool.getServices()

    const health = await stockSelectionService.healthCheck()
    const stats = stockSelectionService.getServiceStats()
    const memUsage = process.memoryUsage()

    const response = NextResponse.json({
      status: health.status,
      timestamp: Date.now(),
      version: '2.0.0', // Updated version
      uptime: process.uptime(),
      performance: {
        responseTime: Date.now() - startTime,
        memoryUsage: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          utilization: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
        },
        optimization: {
          connectionPooling: true,
          requestQueuing: true,
          responseStreaming: true,
          predictiveCaching: true
        }
      },
      stats: {
        totalRequests: stats.totalRequests,
        successRate: stats.successRate,
        averageExecutionTime: stats.averageExecutionTime,
        cacheHitRate: stats.cacheHitRate
      },
      supportedModes: Object.values(SelectionMode),
      rateLimits: {
        window: 60000,
        maxRequests: 30,
        burstCapacity: 10
      },
      health: health.details
    })

    // Add performance headers
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
    response.headers.set('X-Performance-Optimized', 'true')

    return response

  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      },
      { status: 503 }
    )
  }
}

/**
 * DELETE /api/stocks/select
 * Cancel active request
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing requestId parameter',
          responseTime: Date.now() - startTime
        },
        { status: 400 }
      )
    }

    const activeRequest = requestTracker.getActiveRequest(requestId)
    if (!activeRequest) {
      return NextResponse.json(
        {
          success: false,
          error: 'Request not found or already completed',
          responseTime: Date.now() - startTime
        },
        { status: 404 }
      )
    }

    // Cancel the request
    activeRequest.abortController.abort()
    requestTracker.completeRequest(requestId)

    // Also try to cancel via service if available
    try {
      const { stockSelectionService } = await servicePool.getServices()
      await stockSelectionService.cancelRequest(requestId)
    } catch (error) {
      console.warn('Service cancellation failed:', error)
    }

    const response = NextResponse.json({
      success: true,
      message: 'Request cancelled successfully',
      requestId,
      responseTime: Date.now() - startTime
    })

    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
    return response

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

/**
 * Validate analysis scope requirements
 */
function validateAnalysisScope(scope: AnalysisScope): { valid: boolean; message?: string } {
  switch (scope.mode) {
    case SelectionMode.SINGLE_STOCK:
      if (!scope.symbols || scope.symbols.length === 0) {
        return { valid: false, message: 'Single stock analysis requires at least one symbol' }
      }
      if (scope.symbols.length > 1) {
        return { valid: false, message: 'Single stock analysis accepts only one symbol' }
      }
      break

    case SelectionMode.MULTIPLE_STOCKS:
      if (!scope.symbols || scope.symbols.length === 0) {
        return { valid: false, message: 'Multi-stock analysis requires at least one symbol' }
      }
      if (scope.symbols.length > 50) {
        return { valid: false, message: 'Multi-stock analysis limited to 50 symbols maximum' }
      }
      break

    case SelectionMode.SECTOR_ANALYSIS:
    case SelectionMode.INDEX_ANALYSIS:
    case SelectionMode.ETF_ANALYSIS:
      if (!scope.sector) {
        return { valid: false, message: `${scope.mode} requires sector specification` }
      }
      break

    default:
      return { valid: false, message: `Unsupported analysis mode: ${scope.mode}` }
  }

  // Additional validations
  if (scope.symbols && scope.symbols.some(symbol => !symbol || symbol.trim().length === 0)) {
    return { valid: false, message: 'All symbols must be non-empty strings' }
  }

  if (scope.maxResults && scope.maxResults > 100) {
    return { valid: false, message: 'Maximum results limited to 100' }
  }

  return { valid: true }
}

// Enhanced cleanup and monitoring
setInterval(() => {
  requestTracker.cleanup()
}, 2 * 60 * 1000) // Every 2 minutes for better responsiveness

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 Graceful shutdown initiated...')
  memoryManager.stopCleanup()
  console.log('✅ Cleanup completed')
})

process.on('SIGINT', () => {
  console.log('🛑 Process interrupted, shutting down...')
  memoryManager.stopCleanup()
  process.exit(0)
})