/**
 * Authentication Middleware
 * Provides request authentication and authorization for protected endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { authService } from './AuthService'
import {
  User,
  UserSession,
  Permission,
  AuthenticationError,
  AuthorizationError
} from './types'

/**
 * Authenticated request interface
 */
export interface AuthenticatedRequest extends NextRequest {
  user: User
  session: UserSession
}

/**
 * Middleware configuration options
 */
export interface AuthMiddlewareOptions {
  requiredPermissions?: Permission[]
  requireAnyPermission?: boolean // true = OR logic, false = AND logic (default)
  allowApiKey?: boolean
  skipRateLimiting?: boolean
  customRateLimit?: {
    maxRequests: number
    windowMs: number
  }
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean
  user?: User
  session?: UserSession
  error?: {
    code: string
    message: string
    statusCode: number
  }
}

/**
 * API Key authentication for programmatic access
 */
class APIKeyAuthenticator {
  static async validateAPIKey(apiKey: string, clientInfo: {
    ipAddress: string
    userAgent: string
  }): Promise<{ user: User; permissions: Permission[] } | null> {
    try {
      // Extract key ID and secret from the API key
      const [keyId, secret] = apiKey.split('.')
      if (!keyId || !secret) {
        return null
      }

      // In a real implementation, this would:
      // 1. Hash the secret and compare with stored hash
      // 2. Check if key is active and not expired
      // 3. Verify IP whitelist if configured
      // 4. Update last used timestamp
      // 5. Get associated user and permissions

      // For demonstration purposes, return null
      return null

    } catch (error) {
      console.error('API key validation error:', error)
      return null
    }
  }
}

/**
 * Rate limiting for authenticated users
 */
class AuthenticatedRateLimiter {
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>()

  checkRateLimit(
    user: User,
    customLimit?: { maxRequests: number; windowMs: number }
  ): { allowed: boolean; retryAfter?: number } {
    const limit = customLimit || {
      maxRequests: user.subscription.limits.apiCallsPerHour,
      windowMs: 60 * 60 * 1000 // 1 hour
    }

    const key = `user:${user.id}`
    const now = Date.now()
    const userLimit = this.rateLimitMap.get(key)

    if (!userLimit || now > userLimit.resetTime) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + limit.windowMs
      })
      return { allowed: true }
    }

    if (userLimit.count >= limit.maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      }
    }

    userLimit.count++
    return { allowed: true }
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, limit] of Array.from(this.rateLimitMap.entries())) {
      if (now > limit.resetTime) {
        this.rateLimitMap.delete(key)
      }
    }
  }
}

const authenticatedRateLimiter = new AuthenticatedRateLimiter()

/**
 * Main authentication middleware function
 */
export async function authenticateRequest(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<AuthResult> {
  try {
    // Initialize auth service
    await authService.initialize()

    // Extract authentication credentials
    const authHeader = request.headers.get('authorization')
    const apiKeyHeader = request.headers.get('x-api-key')

    if (!authHeader && !apiKeyHeader) {
      return {
        success: false,
        error: {
          code: 'MISSING_AUTHENTICATION',
          message: 'Authentication required',
          statusCode: 401
        }
      }
    }

    let user: User
    let session: UserSession | undefined
    let permissions: Permission[]

    // JWT Token authentication
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      if (!token) {
        return {
          success: false,
          error: {
            code: 'INVALID_TOKEN_FORMAT',
            message: 'Invalid token format',
            statusCode: 401
          }
        }
      }

      try {
        const authResult = await authService.validateToken(token)
        user = authResult.user
        session = authResult.session
        permissions = user.permissions
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              statusCode: error.statusCode
            }
          }
        }
        throw error
      }
    }
    // API Key authentication
    else if (apiKeyHeader && options.allowApiKey) {
      const clientInfo = {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }

      const apiKeyResult = await APIKeyAuthenticator.validateAPIKey(apiKeyHeader, clientInfo)
      if (!apiKeyResult) {
        return {
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid API key',
            statusCode: 401
          }
        }
      }

      user = apiKeyResult.user
      permissions = apiKeyResult.permissions
    } else {
      return {
        success: false,
        error: {
          code: 'INVALID_AUTHENTICATION_METHOD',
          message: 'Invalid authentication method',
          statusCode: 401
        }
      }
    }

    // Check required permissions
    if (options.requiredPermissions && options.requiredPermissions.length > 0) {
      const hasPermissions = options.requireAnyPermission
        ? authService.hasAnyPermission(user, options.requiredPermissions)
        : authService.hasAllPermissions(user, options.requiredPermissions)

      if (!hasPermissions) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Insufficient permissions for this operation',
            statusCode: 403
          }
        }
      }
    }

    // Rate limiting for authenticated users
    if (!options.skipRateLimiting) {
      const rateLimitResult = authenticatedRateLimiter.checkRateLimit(
        user,
        options.customRateLimit
      )

      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded',
            statusCode: 429
          }
        }
      }
    }

    return {
      success: true,
      user,
      session
    }

  } catch (error) {
    console.error('Authentication middleware error:', error)
    return {
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed',
        statusCode: 500
      }
    }
  }
}

/**
 * Higher-order function to wrap API handlers with authentication
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, user: User, session: UserSession | undefined, ...args: T) => Promise<NextResponse>,
  options: AuthMiddlewareOptions = {}
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const authResult = await authenticateRequest(request, options)

    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error!.code,
          message: authResult.error!.message,
          timestamp: Date.now()
        },
        { status: authResult.error!.statusCode }
      )
    }

    // Add user and session to the request context
    return handler(request, authResult.user!, authResult.session, ...args)
  }
}

/**
 * Permission validation decorators
 */
export const requirePermissions = (permissions: Permission[], requireAll = true) => {
  return (options: AuthMiddlewareOptions = {}): AuthMiddlewareOptions => ({
    ...options,
    requiredPermissions: permissions,
    requireAnyPermission: !requireAll
  })
}

export const requireBasicAccess = requirePermissions([Permission.READ_BASIC_DATA])
export const requirePremiumAccess = requirePermissions([Permission.READ_PREMIUM_DATA])
export const requireRealTimeAccess = requirePermissions([Permission.READ_REAL_TIME_DATA])
export const requireAlgorithmAccess = requirePermissions([Permission.USE_ADVANCED_ALGORITHMS])
export const requireAdminAccess = requirePermissions([Permission.MANAGE_SYSTEM])

/**
 * Utility function to check permissions in handler
 */
export function checkPermission(user: User, permission: Permission): boolean {
  return authService.hasPermission(user, permission)
}

/**
 * Utility function to get user's subscription limits
 */
export function getUserLimits(user: User): {
  apiCallsPerHour: number
  maxConcurrentRequests: number
  dataRetentionDays: number
} {
  return user.subscription.limits
}

/**
 * Extract user context for logging and audit trails
 */
export function getUserContext(user: User, session?: UserSession): {
  userId: string
  email: string
  role: string
  sessionId?: string
  permissions: string[]
} {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    sessionId: session?.sessionId,
    permissions: user.permissions
  }
}

/**
 * Clean up expired rate limit entries
 */
setInterval(() => {
  authenticatedRateLimiter.cleanup()
}, 5 * 60 * 1000) // Every 5 minutes

/**
 * Export types for use in protected endpoints
 */