/**
 * Protected Stock Selection API Example
 * Demonstrates how to integrate authentication middleware with existing endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  withAuth,
  requirePremiumAccess,
  requireRealTimeAccess,
  getUserContext,
  getUserLimits,
  checkPermission
} from '../../../services/auth/AuthMiddleware'
import {
  User,
  UserSession,
  Permission
} from '../../../services/auth/types'
import {
  SelectionRequestSchema,
  SelectionResponse,
  SelectionMode
} from '../../../services/stock-selection/types'
import { StockSelectionService, createStockSelectionService } from '../../../services/stock-selection/StockSelectionService'

/**
 * Enhanced request validation with user-specific limits
 */
function validateUserRequest(
  request: any,
  user: User,
  userLimits: { apiCallsPerHour: number; maxConcurrentRequests: number }
): { valid: boolean; message?: string } {
  // Check if user has permission for real-time data
  if (request.options?.useRealTimeData && !checkPermission(user, Permission.READ_REAL_TIME_DATA)) {
    return {
      valid: false,
      message: 'Real-time data access requires premium subscription'
    }
  }

  // Check if user has permission for advanced algorithms
  if (request.options?.algorithmId &&
      request.options.algorithmId.includes('advanced') &&
      !checkPermission(user, Permission.USE_ADVANCED_ALGORITHMS)) {
    return {
      valid: false,
      message: 'Advanced algorithms require professional subscription'
    }
  }

  // Limit concurrent analysis scope based on subscription
  const maxSymbols = user.role === 'basic' ? 5 :
                    user.role === 'premium' ? 20 :
                    user.role === 'professional' ? 50 : 100

  if (request.scope.symbols && request.scope.symbols.length > maxSymbols) {
    return {
      valid: false,
      message: `Your subscription allows analysis of up to ${maxSymbols} symbols`
    }
  }

  // Limit result size based on subscription
  const maxResults = user.role === 'basic' ? 10 :
                    user.role === 'premium' ? 25 :
                    user.role === 'professional' ? 50 : 100

  if (request.scope.maxResults && request.scope.maxResults > maxResults) {
    return {
      valid: false,
      message: `Your subscription allows up to ${maxResults} results`
    }
  }

  return { valid: true }
}

/**
 * Enhanced audit logging for financial compliance
 */
async function logStockSelectionRequest(
  user: User,
  session: UserSession | undefined,
  request: any,
  response: SelectionResponse,
  processingTime: number
): Promise<void> {
  const auditLog = {
    eventType: 'stock_selection_request',
    userId: user.id,
    sessionId: session?.sessionId,
    timestamp: Date.now(),
    request: {
      mode: request.scope.mode,
      symbolCount: request.scope.symbols?.length || 0,
      sector: request.scope.sector?.id,
      useRealTimeData: request.options?.useRealTimeData || false,
      algorithmId: request.options?.algorithmId
    },
    response: {
      selectionCount: response.topSelections.length,
      algorithmUsed: response.metadata.algorithmUsed,
      dataQualityScore: response.metadata.qualityScore.overall,
      cacheHitRate: response.metadata.cacheHitRate
    },
    performance: {
      processingTime,
      dataFetchTime: response.performance.dataFetchTime,
      analysisTime: response.performance.analysisTime
    },
    compliance: {
      dataSourcesUsed: response.metadata.dataSourcesUsed,
      freshness: response.metadata.qualityScore.metrics.freshness,
      sourceReputation: response.metadata.qualityScore.metrics.sourceReputation
    }
  }

  // In a real implementation, this would store in an audit database
  console.log('📊 Stock selection audit log:', JSON.stringify(auditLog, null, 2))
}

/**
 * Protected stock selection handler
 */
async function protectedStockSelectionHandler(
  request: NextRequest,
  user: User,
  session: UserSession | undefined
): Promise<NextResponse> {
  const startTime = Date.now()
  const userContext = getUserContext(user, session)
  const userLimits = getUserLimits(user)

  console.log(`📊 Protected stock selection request from user ${userContext.userId} (${userContext.role})`)

  try {
    // Parse and validate request
    const requestBody = await request.json()
    const validationResult = SelectionRequestSchema.safeParse(requestBody)

    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format',
        message: 'Request validation failed',
        details: validationResult.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        })),
        userContext
      }, { status: 400 })
    }

    const selectionRequest = validationResult.data

    // User-specific request validation
    const userValidation = validateUserRequest(selectionRequest, user, userLimits)
    if (!userValidation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Subscription limit exceeded',
        message: userValidation.message,
        userContext,
        subscriptionInfo: {
          currentTier: user.subscription.tier,
          limits: userLimits,
          upgradeRequired: true
        }
      }, { status: 403 })
    }

    // Add user context to request for tracking
    const enhancedRequest = {
      ...selectionRequest,
      userId: user.id,
      userRole: user.role,
      subscriptionTier: user.subscription.tier
    }

    // Create service instance (in practice, this would be cached/pooled)
    const stockSelectionService = await createStockSelectionService(
      // MCP client, data fusion, factor library, cache instances would be passed here
    )

    // Execute stock selection with user context
    const result: SelectionResponse = await stockSelectionService.selectStocks(enhancedRequest)

    const processingTime = Date.now() - startTime

    // Log for compliance and audit
    await logStockSelectionRequest(user, session, selectionRequest, result, processingTime)

    // Enhanced response with user context
    const enhancedResponse = {
      ...result,
      userContext: {
        userId: user.id,
        subscriptionTier: user.subscription.tier,
        remainingApiCalls: userLimits.apiCallsPerHour, // Would be calculated from usage
        dataAccessLevel: user.permissions.includes(Permission.READ_REAL_TIME_DATA) ? 'real_time' :
                        user.permissions.includes(Permission.READ_PREMIUM_DATA) ? 'premium' : 'basic'
      },
      compliance: {
        auditTrailId: `audit_${Date.now()}_${user.id}`,
        dataClassification: 'financial_analysis',
        retentionPeriod: user.subscription.limits.dataRetentionDays
      }
    }

    const response = NextResponse.json(enhancedResponse)
    response.headers.set('X-User-ID', user.id)
    response.headers.set('X-Subscription-Tier', user.subscription.tier)
    response.headers.set('X-Processing-Time', `${processingTime}ms`)
    response.headers.set('X-Data-Access-Level', enhancedResponse.userContext.dataAccessLevel)

    return response

  } catch (error) {
    const processingTime = Date.now() - startTime

    console.error(`❌ Protected stock selection failed for user ${userContext.userId}:`, error)

    // Log error for audit
    const errorLog = {
      eventType: 'stock_selection_error',
      userId: user.id,
      sessionId: session?.sessionId,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime
    }
    console.log('📊 Stock selection error log:', JSON.stringify(errorLog, null, 2))

    return NextResponse.json({
      success: false,
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      userContext,
      requestId: `req_${Date.now()}_${user.id}`
    }, { status: 500 })
  }
}

/**
 * Example: Basic protection (requires READ_BASIC_DATA permission)
 */
export const basicProtectedHandler = withAuth(
  protectedStockSelectionHandler,
  requireBasicAccess()
)

/**
 * Example: Premium protection (requires READ_PREMIUM_DATA permission)
 */
export const premiumProtectedHandler = withAuth(
  protectedStockSelectionHandler,
  requirePremiumAccess()
)

/**
 * Example: Real-time protection (requires READ_REAL_TIME_DATA permission)
 */
export const realTimeProtectedHandler = withAuth(
  protectedStockSelectionHandler,
  requireRealTimeAccess()
)

/**
 * Example: Custom protection with multiple requirements
 */
export const advancedProtectedHandler = withAuth(
  protectedStockSelectionHandler,
  {
    requiredPermissions: [
      Permission.READ_PREMIUM_DATA,
      Permission.USE_ADVANCED_ALGORITHMS
    ],
    allowApiKey: true,
    customRateLimit: {
      maxRequests: 100,
      windowMs: 60 * 60 * 1000 // 1 hour
    }
  }
)

/**
 * Example usage in route.ts:
 *
 * // Replace the existing POST handler with:
 * export const POST = premiumProtectedHandler
 *
 * // Or use different protection levels for different endpoints:
 * export async function POST(request: NextRequest) {
 *   const { searchParams } = new URL(request.url)
 *   const tier = searchParams.get('tier') || 'basic'
 *
 *   switch (tier) {
 *     case 'basic':
 *       return basicProtectedHandler(request)
 *     case 'premium':
 *       return premiumProtectedHandler(request)
 *     case 'realtime':
 *       return realTimeProtectedHandler(request)
 *     case 'advanced':
 *       return advancedProtectedHandler(request)
 *     default:
 *       return basicProtectedHandler(request)
 *   }
 * }
 */

/**
 * Additional utility: Permission-based feature flags
 */
export function getFeatureFlags(user: User): {
  realTimeData: boolean
  advancedAlgorithms: boolean
  customAlgorithms: boolean
  bulkAnalysis: boolean
  apiAccess: boolean
} {
  return {
    realTimeData: checkPermission(user, Permission.READ_REAL_TIME_DATA),
    advancedAlgorithms: checkPermission(user, Permission.USE_ADVANCED_ALGORITHMS),
    customAlgorithms: checkPermission(user, Permission.CREATE_CUSTOM_ALGORITHMS),
    bulkAnalysis: user.role !== 'basic',
    apiAccess: checkPermission(user, Permission.API_PREMIUM_RATE) ||
              checkPermission(user, Permission.API_UNLIMITED_RATE)
  }
}