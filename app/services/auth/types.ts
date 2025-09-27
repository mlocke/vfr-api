/**
 * Authentication and Authorization Types
 * Financial-grade security types for user management and access control
 */

import { z } from 'zod'

/**
 * User roles with hierarchical permissions
 */
export enum UserRole {
  BASIC = 'basic',
  PREMIUM = 'premium',
  PROFESSIONAL = 'professional',
  INSTITUTIONAL = 'institutional',
  ADMINISTRATOR = 'administrator'
}

/**
 * Permission levels for fine-grained access control
 */
export enum Permission {
  // Data access permissions
  READ_BASIC_DATA = 'read:basic_data',
  READ_PREMIUM_DATA = 'read:premium_data',
  READ_REAL_TIME_DATA = 'read:real_time_data',
  READ_INSTITUTIONAL_DATA = 'read:institutional_data',

  // Algorithm permissions
  USE_BASIC_ALGORITHMS = 'use:basic_algorithms',
  USE_ADVANCED_ALGORITHMS = 'use:advanced_algorithms',
  CREATE_CUSTOM_ALGORITHMS = 'create:custom_algorithms',

  // API permissions
  API_STANDARD_RATE = 'api:standard_rate',
  API_PREMIUM_RATE = 'api:premium_rate',
  API_UNLIMITED_RATE = 'api:unlimited_rate',

  // Administrative permissions
  MANAGE_USERS = 'manage:users',
  MANAGE_SYSTEM = 'manage:system',
  VIEW_ANALYTICS = 'view:analytics'
}

/**
 * User authentication and profile data
 */
export interface User {
  id: string
  email: string
  role: UserRole
  permissions: Permission[]
  profile: {
    firstName: string
    lastName: string
    company?: string
    phoneNumber?: string
    timezone: string
    preferences: {
      dataRefreshRate: number
      defaultRiskTolerance: 'conservative' | 'moderate' | 'aggressive'
      notificationSettings: {
        email: boolean
        sms: boolean
        push: boolean
      }
    }
  }
  subscription: {
    tier: string
    status: 'active' | 'suspended' | 'cancelled'
    expiresAt: number
    features: string[]
    limits: {
      apiCallsPerHour: number
      maxConcurrentRequests: number
      dataRetentionDays: number
    }
  }
  security: {
    lastLoginAt: number
    lastLoginIP: string
    failedLoginAttempts: number
    lockoutUntil?: number
    twoFactorEnabled: boolean
    apiKeyHash?: string
    sessionTimeoutMinutes: number
  }
  metadata: {
    createdAt: number
    updatedAt: number
    emailVerified: boolean
    agreedToTermsAt: number
    lastActivityAt: number
  }
}

/**
 * JWT token payload structure
 */
export interface TokenPayload {
  sub: string // user ID
  email: string
  role: UserRole
  permissions: Permission[]
  sessionId: string
  iat: number
  exp: number
  jti: string // JWT ID for revocation
  aud: string // audience
  iss: string // issuer

  // Financial platform specific claims
  subscription: {
    tier: string
    limits: {
      apiCallsPerHour: number
      maxConcurrentRequests: number
    }
  }
  mlTier: string

  // Security context
  ipAddress: string
  userAgent: string
  deviceFingerprint?: string
}

/**
 * Authentication request/response schemas
 */
export const LoginRequestSchema = z.object({
  email: z.string().email().min(1).max(255),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().optional(),
  deviceFingerprint: z.string().optional(),
  captchaToken: z.string().optional()
})

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().optional(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    role: z.nativeEnum(UserRole),
    permissions: z.array(z.nativeEnum(Permission)),
    profile: z.object({
      firstName: z.string(),
      lastName: z.string(),
      company: z.string().optional()
    })
  }).optional(),
  requiresTwoFactor: z.boolean().optional(),
  error: z.string().optional(),
  message: z.string().optional()
})

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
  deviceFingerprint: z.string().optional()
})

export const TwoFactorRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(8),
  sessionToken: z.string()
})

export const PasswordResetRequestSchema = z.object({
  email: z.string().email()
})

export const PasswordResetConfirmSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128)
})

/**
 * Session management types
 */
export interface UserSession {
  sessionId: string
  userId: string
  deviceFingerprint?: string
  ipAddress: string
  userAgent: string
  createdAt: number
  lastActivityAt: number
  expiresAt: number
  isActive: boolean
  metadata: {
    loginMethod: 'password' | 'oauth' | 'api_key'
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'api'
    location?: {
      country: string
      region: string
      city: string
    }
  }
}

/**
 * API key management
 */
export interface APIKey {
  id: string
  userId: string
  name: string
  keyHash: string
  permissions: Permission[]
  rateLimit: {
    requestsPerHour: number
    requestsPerDay: number
  }
  restrictions: {
    ipWhitelist?: string[]
    allowedOrigins?: string[]
    environment: 'development' | 'staging' | 'production'
  }
  metadata: {
    createdAt: number
    lastUsedAt?: number
    expiresAt?: number
    isActive: boolean
  }
}

/**
 * Audit logging types
 */
export interface SecurityEvent {
  id: string
  userId?: string
  sessionId?: string
  eventType: 'login' | 'logout' | 'failed_login' | 'password_reset' | 'permission_change' | 'api_key_used' | 'suspicious_activity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  metadata: {
    ipAddress: string
    userAgent: string
    timestamp: number
    details: Record<string, any>
  }
  resolved: boolean
  resolvedAt?: number
  resolvedBy?: string
}

/**
 * Rate limiting types
 */
export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  skipSuccessfulRequests: boolean
  skipFailedRequests: boolean
  keyGenerator: (userId: string, ipAddress: string) => string
  onLimitReached: (userId: string, ipAddress: string) => void
}

export interface RateLimitInfo {
  userId?: string
  ipAddress: string
  requests: number
  windowStart: number
  resetTime: number
  limitExceeded: boolean
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  jwt: {
    secret: string
    accessTokenExpiryMinutes: number
    refreshTokenExpiryDays: number
    issuer: string
    audience: string
  }
  password: {
    minLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireNumbers: boolean
    requireSpecialChars: boolean
    preventCommonPasswords: boolean
  }
  session: {
    maxConcurrentSessions: number
    timeoutMinutes: number
    extendOnActivity: boolean
  }
  security: {
    maxFailedLogins: number
    lockoutDurationMinutes: number
    requireCaptchaAfterFailures: number
    enableDeviceFingerprinting: boolean
    enforceHttpsOnly: boolean
  }
  twoFactor: {
    enabled: boolean
    issuerName: string
    qrCodeSize: number
    window: number
  }
}

/**
 * Type exports for client use
 */
export type LoginRequest = z.infer<typeof LoginRequestSchema>
export type LoginResponse = z.infer<typeof LoginResponseSchema>
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>
export type TwoFactorRequest = z.infer<typeof TwoFactorRequestSchema>
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>

/**
 * Error types for authentication
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 403,
    public requiredPermissions?: Permission[]
  ) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public statusCode: number = 429
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}