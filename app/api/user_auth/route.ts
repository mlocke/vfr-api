/**
 * User Authentication API Endpoint
 * Financial-grade authentication system with comprehensive security measures
 * Supports login, logout, token refresh, and two-factor authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authService } from '../../services/auth/AuthService'
import {
  LoginRequestSchema,
  RefreshTokenRequestSchema,
  TwoFactorRequestSchema,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  UserRole,
  Permission
} from '../../services/auth/types'

/**
 * Enhanced rate limiting for authentication endpoints
 */
class AuthRateLimiter {
  private rateLimitMap = new Map<string, { count: number; resetTime: number; lockoutCount: number }>()
  private readonly AUTH_RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
  private readonly AUTH_MAX_ATTEMPTS = 10
  private readonly LOCKOUT_THRESHOLD = 5
  private readonly LOCKOUT_DURATION = 60 * 60 * 1000 // 1 hour

  checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number; lockout?: boolean } {
    const now = Date.now()
    const limit = this.rateLimitMap.get(identifier)

    if (!limit || now > limit.resetTime) {
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.AUTH_RATE_LIMIT_WINDOW,
        lockoutCount: limit?.lockoutCount || 0
      })
      return { allowed: true }
    }

    // Check for repeated violations (progressive lockout)
    if (limit.lockoutCount >= this.LOCKOUT_THRESHOLD) {
      const lockoutEnd = limit.resetTime + this.LOCKOUT_DURATION
      if (now < lockoutEnd) {
        return {
          allowed: false,
          retryAfter: Math.ceil((lockoutEnd - now) / 1000),
          lockout: true
        }
      } else {
        // Reset after lockout period
        this.rateLimitMap.set(identifier, {
          count: 1,
          resetTime: now + this.AUTH_RATE_LIMIT_WINDOW,
          lockoutCount: 0
        })
        return { allowed: true }
      }
    }

    if (limit.count >= this.AUTH_MAX_ATTEMPTS) {
      limit.lockoutCount += 1
      return {
        allowed: false,
        retryAfter: Math.ceil((limit.resetTime - now) / 1000)
      }
    }

    limit.count++
    return { allowed: true }
  }

  cleanup(): void {
    const now = Date.now()
    for (const [identifier, limit] of Array.from(this.rateLimitMap.entries())) {
      if (now > limit.resetTime + this.LOCKOUT_DURATION) {
        this.rateLimitMap.delete(identifier)
      }
    }
  }
}

const authRateLimiter = new AuthRateLimiter()

/**
 * Security headers and response utilities
 */
class SecurityResponseHandler {
  static addSecurityHeaders(response: NextResponse): NextResponse {
    // Security headers for financial applications
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

    // Prevent caching of authentication responses
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    // Custom headers for audit trail
    response.headers.set('X-Auth-Endpoint', 'user_auth')
    response.headers.set('X-Security-Level', 'financial-grade')

    return response
  }

  static createErrorResponse(
    error: AuthenticationError | AuthorizationError | RateLimitError | Error,
    requestId: string
  ): NextResponse {
    let status = 500
    let errorResponse: any = {
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      requestId,
      timestamp: Date.now()
    }

    if (error instanceof AuthenticationError) {
      status = error.statusCode
      errorResponse = {
        success: false,
        error: error.code,
        message: error.message,
        requestId,
        timestamp: Date.now(),
        details: error.details
      }
    } else if (error instanceof AuthorizationError) {
      status = error.statusCode
      errorResponse = {
        success: false,
        error: error.code,
        message: error.message,
        requestId,
        timestamp: Date.now(),
        requiredPermissions: error.requiredPermissions
      }
    } else if (error instanceof RateLimitError) {
      status = error.statusCode
      errorResponse = {
        success: false,
        error: 'RATE_LIMITED',
        message: error.message,
        requestId,
        timestamp: Date.now(),
        retryAfter: error.retryAfter
      }
    }

    const response = NextResponse.json(errorResponse, { status })
    return this.addSecurityHeaders(response)
  }

  static createSuccessResponse(data: any, requestId: string): NextResponse {
    const response = NextResponse.json({
      ...data,
      requestId,
      timestamp: Date.now()
    })
    return this.addSecurityHeaders(response)
  }
}

/**
 * Client information extraction utilities
 */
function extractClientInfo(request: NextRequest): {
  ipAddress: string
  userAgent: string
  deviceFingerprint?: string
} {
  // Extract real IP address (handle proxy headers)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip') // Cloudflare

  const ipAddress = cfConnectingIp ||
                   (forwardedFor?.split(',')[0]?.trim()) ||
                   realIp ||
                   'unknown'

  const userAgent = request.headers.get('user-agent') || 'unknown'
  const deviceFingerprint = request.headers.get('x-device-fingerprint') || undefined

  return { ipAddress, userAgent, deviceFingerprint }
}

/**
 * Request validation middleware
 */
function validateAuthRequest(request: NextRequest): void {
  // Enforce HTTPS in production
  if (process.env.NODE_ENV === 'production' && !request.url.startsWith('https://')) {
    throw new AuthenticationError('HTTPS required', 'INSECURE_CONNECTION', 426)
  }

  // Check for required headers
  const contentType = request.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    throw new AuthenticationError('Invalid content type', 'INVALID_CONTENT_TYPE', 400)
  }
}

/**
 * Generate unique request ID for audit trails
 */
function generateRequestId(): string {
  return `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * POST /api/user_auth
 * Main authentication endpoint supporting multiple operations
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId()
  const startTime = Date.now()

  try {
    // Initialize auth service
    await authService.initialize()

    // Validate request structure
    validateAuthRequest(request)

    // Extract client information
    const clientInfo = extractClientInfo(request)

    // Rate limiting check
    const rateLimitResult = authRateLimiter.checkRateLimit(
      `${clientInfo.ipAddress}:${clientInfo.userAgent.slice(0, 50)}`
    )

    if (!rateLimitResult.allowed) {
      if (rateLimitResult.lockout) {
        throw new RateLimitError(
          'Account temporarily locked due to repeated violations',
          rateLimitResult.retryAfter!
        )
      }
      throw new RateLimitError(
        'Too many authentication attempts. Please try again later.',
        rateLimitResult.retryAfter!
      )
    }

    // Parse request body
    let requestBody: any
    try {
      requestBody = await request.json()
    } catch (error) {
      throw new AuthenticationError('Invalid JSON in request body', 'INVALID_JSON', 400)
    }

    // Determine operation type
    const operation = requestBody.operation || 'login'

    console.log(`🔐 Processing auth request ${requestId}: ${operation} from ${clientInfo.ipAddress}`)

    let result: any

    switch (operation) {
      case 'login':
        result = await handleLogin(requestBody, clientInfo, requestId)
        break

      case 'two_factor':
        result = await handleTwoFactor(requestBody, clientInfo, requestId)
        break

      case 'refresh':
        result = await handleRefresh(requestBody, clientInfo, requestId)
        break

      case 'logout':
        result = await handleLogout(requestBody, requestId)
        break

      case 'validate':
        result = await handleValidate(requestBody, requestId)
        break

      default:
        throw new AuthenticationError('Invalid operation', 'INVALID_OPERATION', 400)
    }

    const processingTime = Date.now() - startTime

    console.log(`✅ Auth request ${requestId} completed in ${processingTime}ms`)

    const response = SecurityResponseHandler.createSuccessResponse(result, requestId)
    response.headers.set('X-Processing-Time', `${processingTime}ms`)
    response.headers.set('X-Operation', operation)

    return response

  } catch (error) {
    const processingTime = Date.now() - startTime

    console.error(`❌ Auth request ${requestId} failed in ${processingTime}ms:`, error)

    const response = SecurityResponseHandler.createErrorResponse(error as any, requestId)
    response.headers.set('X-Processing-Time', `${processingTime}ms`)

    return response
  }
}

/**
 * Handle user login
 */
async function handleLogin(requestBody: any, clientInfo: any, requestId: string) {
  const validationResult = LoginRequestSchema.safeParse(requestBody)
  if (!validationResult.success) {
    throw new AuthenticationError(
      'Invalid login request format',
      'VALIDATION_ERROR',
      400,
      {
        errors: validationResult.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      }
    )
  }

  return await authService.authenticate(validationResult.data, clientInfo)
}

/**
 * Handle two-factor authentication
 */
async function handleTwoFactor(requestBody: any, clientInfo: any, requestId: string) {
  const validationResult = TwoFactorRequestSchema.safeParse(requestBody)
  if (!validationResult.success) {
    throw new AuthenticationError(
      'Invalid two-factor request format',
      'VALIDATION_ERROR',
      400,
      {
        errors: validationResult.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      }
    )
  }

  return await authService.verifyTwoFactor(validationResult.data, clientInfo)
}

/**
 * Handle token refresh
 */
async function handleRefresh(requestBody: any, clientInfo: any, requestId: string) {
  const validationResult = RefreshTokenRequestSchema.safeParse(requestBody)
  if (!validationResult.success) {
    throw new AuthenticationError(
      'Invalid refresh token request format',
      'VALIDATION_ERROR',
      400,
      {
        errors: validationResult.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      }
    )
  }

  return await authService.refreshToken(validationResult.data, {
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent
  })
}

/**
 * Handle user logout
 */
async function handleLogout(requestBody: any, requestId: string) {
  const LogoutRequestSchema = z.object({
    accessToken: z.string(),
    sessionId: z.string().optional()
  })

  const validationResult = LogoutRequestSchema.safeParse(requestBody)
  if (!validationResult.success) {
    throw new AuthenticationError(
      'Invalid logout request format',
      'VALIDATION_ERROR',
      400
    )
  }

  // Validate token to get user and session info
  const { user, session } = await authService.validateToken(validationResult.data.accessToken)

  // Perform logout
  await authService.logout(user.id, session.sessionId)

  return {
    success: true,
    message: 'Successfully logged out'
  }
}

/**
 * Handle token validation
 */
async function handleValidate(requestBody: any, requestId: string) {
  const ValidateRequestSchema = z.object({
    accessToken: z.string(),
    requiredPermissions: z.array(z.nativeEnum(Permission)).optional()
  })

  const validationResult = ValidateRequestSchema.safeParse(requestBody)
  if (!validationResult.success) {
    throw new AuthenticationError(
      'Invalid validation request format',
      'VALIDATION_ERROR',
      400
    )
  }

  const { user, session } = await authService.validateToken(validationResult.data.accessToken)

  // Check required permissions if specified
  if (validationResult.data.requiredPermissions) {
    const hasPermissions = authService.hasAllPermissions(user, validationResult.data.requiredPermissions)
    if (!hasPermissions) {
      throw new AuthorizationError(
        'Insufficient permissions',
        'INSUFFICIENT_PERMISSIONS',
        403,
        validationResult.data.requiredPermissions
      )
    }
  }

  return {
    success: true,
    valid: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      profile: {
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        company: user.profile.company
      }
    },
    session: {
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt
    }
  }
}

/**
 * GET /api/user_auth
 * Health check and service status
 */
export async function GET(): Promise<NextResponse> {
  const requestId = generateRequestId()
  const startTime = Date.now()

  try {
    await authService.initialize()

    const healthInfo = {
      status: 'healthy',
      service: 'user_auth',
      version: '1.0.0',
      timestamp: Date.now(),
      uptime: process.uptime(),
      features: {
        jwt: true,
        twoFactor: true,
        rateLimiting: true,
        sessionManagement: true,
        auditLogging: true,
        deviceFingerprinting: true
      },
      supportedOperations: [
        'login',
        'two_factor',
        'refresh',
        'logout',
        'validate'
      ],
      security: {
        httpSecurityHeaders: true,
        rateLimiting: {
          window: '15 minutes',
          maxAttempts: 10,
          lockoutThreshold: 5,
          lockoutDuration: '1 hour'
        },
        tokenSecurity: {
          accessTokenExpiry: '15 minutes',
          refreshTokenExpiry: '30 days',
          tokenRevocation: true
        }
      },
      compliance: {
        financialGrade: true,
        auditTrail: true,
        dataEncryption: true,
        sessionSecurity: true
      }
    }

    const processingTime = Date.now() - startTime

    const response = SecurityResponseHandler.createSuccessResponse(healthInfo, requestId)
    response.headers.set('X-Processing-Time', `${processingTime}ms`)
    response.headers.set('X-Health-Check', 'true')

    return response

  } catch (error) {
    console.error('Auth service health check failed:', error)

    const errorInfo = {
      status: 'unhealthy',
      service: 'user_auth',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }

    const response = SecurityResponseHandler.createErrorResponse(
      new AuthenticationError('Service unhealthy', 'SERVICE_UNAVAILABLE', 503),
      requestId
    )

    return response
  }
}

/**
 * Clean up expired rate limit entries periodically
 */
setInterval(() => {
  authRateLimiter.cleanup()
}, 15 * 60 * 1000) // Every 15 minutes

/**
 * Graceful shutdown handling
 */
process.on('SIGTERM', () => {
  console.log('🛑 Auth service graceful shutdown initiated...')
})

process.on('SIGINT', () => {
  console.log('🛑 Auth service interrupted, shutting down...')
  process.exit(0)
})