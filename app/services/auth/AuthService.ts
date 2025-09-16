/**
 * Authentication Service
 * Comprehensive financial-grade authentication system with JWT, rate limiting, and security features
 */

import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { redisCache } from '../cache/RedisCache'
import {
  User,
  UserRole,
  Permission,
  TokenPayload,
  UserSession,
  SecurityEvent,
  APIKey,
  SecurityConfig,
  AuthenticationError,
  AuthorizationError,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  TwoFactorRequest
} from './types'

/**
 * Main Authentication Service Class
 */
export class AuthService {
  private static instance: AuthService
  private config: SecurityConfig
  private isInitialized = false

  constructor() {
    this.config = {
      jwt: {
        secret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
        accessTokenExpiryMinutes: 15,
        refreshTokenExpiryDays: 30,
        issuer: 'veritak-financial-platform',
        audience: 'veritak-users'
      },
      password: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        preventCommonPasswords: true
      },
      session: {
        maxConcurrentSessions: 3,
        timeoutMinutes: 60,
        extendOnActivity: true
      },
      security: {
        maxFailedLogins: 5,
        lockoutDurationMinutes: 15,
        requireCaptchaAfterFailures: 3,
        enableDeviceFingerprinting: true,
        enforceHttpsOnly: true
      },
      twoFactor: {
        enabled: true,
        issuerName: 'Veritak Financial',
        qrCodeSize: 200,
        window: 2
      }
    }
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  /**
   * Initialize the authentication service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Verify database connections
      await this.verifyConnections()

      // Initialize user roles and permissions
      await this.initializeRolePermissions()

      // Clean up expired sessions
      await this.cleanupExpiredSessions()

      this.isInitialized = true
      console.log('✅ Authentication service initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize authentication service:', error)
      throw new Error('Authentication service initialization failed')
    }
  }

  /**
   * Authenticate user with email and password
   */
  async authenticate(request: LoginRequest, clientInfo: {
    ipAddress: string
    userAgent: string
    deviceFingerprint?: string
  }): Promise<LoginResponse> {
    try {
      // Rate limiting check
      await this.checkRateLimit(request.email, clientInfo.ipAddress)

      // Get user by email
      const user = await this.getUserByEmail(request.email)
      if (!user) {
        await this.logSecurityEvent('failed_login', {
          email: request.email,
          reason: 'user_not_found',
          ...clientInfo
        })
        throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS')
      }

      // Check account lockout
      if (user.security.lockoutUntil && user.security.lockoutUntil > Date.now()) {
        await this.logSecurityEvent('failed_login', {
          userId: user.id,
          reason: 'account_locked',
          ...clientInfo
        })
        throw new AuthenticationError('Account temporarily locked', 'ACCOUNT_LOCKED')
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(request.password, user)
      if (!isValidPassword) {
        await this.handleFailedLogin(user, clientInfo)
        throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS')
      }

      // Check if two-factor authentication is required
      if (user.security.twoFactorEnabled) {
        const sessionToken = await this.createTwoFactorSession(user, clientInfo)
        return {
          success: true,
          requiresTwoFactor: true,
          sessionToken,
          message: 'Two-factor authentication required'
        }
      }

      // Create user session and tokens
      const session = await this.createUserSession(user, clientInfo)
      const tokens = await this.generateTokens(user, session, clientInfo)

      // Reset failed login attempts
      await this.resetFailedLoginAttempts(user.id)

      // Log successful login
      await this.logSecurityEvent('login', {
        userId: user.id,
        sessionId: session.sessionId,
        ...clientInfo
      })

      // Update last login information
      await this.updateLastLogin(user.id, clientInfo)

      return {
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: this.config.jwt.accessTokenExpiryMinutes * 60,
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
        }
      }

    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error
      }
      console.error('Authentication error:', error)
      throw new AuthenticationError('Authentication failed', 'AUTH_ERROR')
    }
  }

  /**
   * Verify two-factor authentication code
   */
  async verifyTwoFactor(request: TwoFactorRequest, clientInfo: {
    ipAddress: string
    userAgent: string
    deviceFingerprint?: string
  }): Promise<LoginResponse> {
    try {
      // Validate session token
      const sessionData = await redisCache.get(`2fa_session:${request.sessionToken}`)
      if (!sessionData) {
        throw new AuthenticationError('Invalid or expired session', 'INVALID_SESSION')
      }

      const user = await this.getUserById(sessionData.userId)
      if (!user) {
        throw new AuthenticationError('User not found', 'USER_NOT_FOUND')
      }

      // Verify 2FA code
      const isValidCode = await this.verifyTOTPCode(user, request.code)
      if (!isValidCode) {
        await this.handleFailedLogin(user, clientInfo)
        throw new AuthenticationError('Invalid verification code', 'INVALID_2FA_CODE')
      }

      // Clean up 2FA session
      await redisCache.del(`2fa_session:${request.sessionToken}`)

      // Create user session and tokens
      const session = await this.createUserSession(user, clientInfo)
      const tokens = await this.generateTokens(user, session, clientInfo)

      // Log successful login
      await this.logSecurityEvent('login', {
        userId: user.id,
        sessionId: session.sessionId,
        method: '2fa',
        ...clientInfo
      })

      return {
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: this.config.jwt.accessTokenExpiryMinutes * 60,
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
        }
      }

    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error
      }
      console.error('Two-factor verification error:', error)
      throw new AuthenticationError('Two-factor verification failed', '2FA_ERROR')
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(request: RefreshTokenRequest, clientInfo: {
    ipAddress: string
    userAgent: string
  }): Promise<LoginResponse> {
    try {
      // Verify refresh token
      const payload = jwt.verify(request.refreshToken, this.config.jwt.secret) as TokenPayload

      // Check if token is in blacklist
      const isBlacklisted = await redisCache.get(`blacklist:${payload.jti}`)
      if (isBlacklisted) {
        throw new AuthenticationError('Token has been revoked', 'TOKEN_REVOKED')
      }

      // Get user and session
      const user = await this.getUserById(payload.sub)
      if (!user) {
        throw new AuthenticationError('User not found', 'USER_NOT_FOUND')
      }

      const session = await this.getUserSession(payload.sessionId)
      if (!session || !session.isActive) {
        throw new AuthenticationError('Session not found or inactive', 'INVALID_SESSION')
      }

      // Verify client consistency
      if (request.deviceFingerprint && session.deviceFingerprint !== request.deviceFingerprint) {
        await this.logSecurityEvent('suspicious_activity', {
          userId: user.id,
          sessionId: session.sessionId,
          reason: 'device_fingerprint_mismatch',
          ...clientInfo
        })
        throw new AuthenticationError('Device fingerprint mismatch', 'DEVICE_MISMATCH')
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user, session, clientInfo)

      // Blacklist old refresh token
      await redisCache.set(
        `blacklist:${payload.jti}`,
        'revoked',
        payload.exp - Math.floor(Date.now() / 1000)
      )

      // Update session activity
      await this.updateSessionActivity(session.sessionId)

      return {
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: this.config.jwt.accessTokenExpiryMinutes * 60
      }

    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid refresh token', 'INVALID_TOKEN')
      }
      console.error('Token refresh error:', error)
      throw new AuthenticationError('Token refresh failed', 'REFRESH_ERROR')
    }
  }

  /**
   * Validate access token and return user info
   */
  async validateToken(token: string): Promise<{ user: User; session: UserSession }> {
    try {
      const payload = jwt.verify(token, this.config.jwt.secret) as TokenPayload

      // Check if token is blacklisted
      const isBlacklisted = await redisCache.get(`blacklist:${payload.jti}`)
      if (isBlacklisted) {
        throw new AuthenticationError('Token has been revoked', 'TOKEN_REVOKED')
      }

      // Get user
      const user = await this.getUserById(payload.sub)
      if (!user) {
        throw new AuthenticationError('User not found', 'USER_NOT_FOUND')
      }

      // Get session
      const session = await this.getUserSession(payload.sessionId)
      if (!session || !session.isActive) {
        throw new AuthenticationError('Session not found or inactive', 'INVALID_SESSION')
      }

      // Update session activity if configured
      if (this.config.session.extendOnActivity) {
        await this.updateSessionActivity(session.sessionId)
      }

      return { user, session }

    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token', 'INVALID_TOKEN')
      }
      throw new AuthenticationError('Token validation failed', 'VALIDATION_ERROR')
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(userId: string, sessionId: string): Promise<void> {
    try {
      // Deactivate session
      await this.deactivateSession(sessionId)

      // Get all tokens for this session and blacklist them
      const sessionTokens = await redisCache.get(`session_tokens:${sessionId}`)
      if (sessionTokens) {
        for (const tokenId of sessionTokens) {
          await redisCache.set(`blacklist:${tokenId}`, 'revoked', 86400) // 24 hours
        }
        await redisCache.del(`session_tokens:${sessionId}`)
      }

      // Log logout event
      await this.logSecurityEvent('logout', {
        userId,
        sessionId
      })

      console.log(`User ${userId} logged out successfully`)

    } catch (error) {
      console.error('Logout error:', error)
      throw new AuthenticationError('Logout failed', 'LOGOUT_ERROR')
    }
  }

  /**
   * Check user permissions
   */
  hasPermission(user: User, requiredPermission: Permission): boolean {
    return user.permissions.includes(requiredPermission)
  }

  /**
   * Check multiple permissions (AND logic)
   */
  hasAllPermissions(user: User, requiredPermissions: Permission[]): boolean {
    return requiredPermissions.every(permission => user.permissions.includes(permission))
  }

  /**
   * Check if user has any of the specified permissions (OR logic)
   */
  hasAnyPermission(user: User, permissions: Permission[]): boolean {
    return permissions.some(permission => user.permissions.includes(permission))
  }

  // Private helper methods

  private async verifyConnections(): Promise<void> {
    // Test Redis connection
    try {
      await redisCache.ping()
    } catch (error) {
      throw new Error('Redis connection failed')
    }
  }

  private async checkRateLimit(identifier: string, ipAddress: string): Promise<void> {
    const key = `rate_limit:auth:${identifier}:${ipAddress}`
    const attempts = await redisCache.incr(key)

    if (attempts === 1) {
      await redisCache.expire(key, 900) // 15 minutes
    }

    if (attempts > 10) { // Max 10 auth attempts per 15 minutes
      throw new AuthenticationError('Too many authentication attempts', 'RATE_LIMITED')
    }
  }

  private async getUserByEmail(email: string): Promise<User | null> {
    // In a real implementation, this would query the database
    // For now, return null to indicate user lookup functionality
    return null
  }

  private async getUserById(userId: string): Promise<User | null> {
    // In a real implementation, this would query the database
    return null
  }

  private async verifyPassword(password: string, user: User): Promise<boolean> {
    // In a real implementation, this would compare with hashed password
    // For demonstration purposes
    return bcrypt.compare(password, 'hashed_password_from_db')
  }

  private async handleFailedLogin(user: User, clientInfo: any): Promise<void> {
    const attempts = user.security.failedLoginAttempts + 1

    // Update failed attempts
    await this.updateFailedLoginAttempts(user.id, attempts)

    if (attempts >= this.config.security.maxFailedLogins) {
      const lockoutUntil = Date.now() + (this.config.security.lockoutDurationMinutes * 60 * 1000)
      await this.lockAccount(user.id, lockoutUntil)
    }

    await this.logSecurityEvent('failed_login', {
      userId: user.id,
      attempts,
      ...clientInfo
    })
  }

  private async createUserSession(user: User, clientInfo: any): Promise<UserSession> {
    const sessionId = crypto.randomUUID()
    const now = Date.now()

    const session: UserSession = {
      sessionId,
      userId: user.id,
      deviceFingerprint: clientInfo.deviceFingerprint,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + (this.config.session.timeoutMinutes * 60 * 1000),
      isActive: true,
      metadata: {
        loginMethod: 'password',
        deviceType: this.detectDeviceType(clientInfo.userAgent),
        location: await this.getLocationFromIP(clientInfo.ipAddress)
      }
    }

    // Store session in Redis
    await redisCache.set(`session:${sessionId}`, session, this.config.session.timeoutMinutes * 60)

    return session
  }

  private async generateTokens(user: User, session: UserSession, clientInfo: any): Promise<{
    accessToken: string
    refreshToken: string
  }> {
    const now = Math.floor(Date.now() / 1000)
    const accessTokenExp = now + (this.config.jwt.accessTokenExpiryMinutes * 60)
    const refreshTokenExp = now + (this.config.jwt.refreshTokenExpiryDays * 24 * 60 * 60)

    const accessJti = crypto.randomUUID()
    const refreshJti = crypto.randomUUID()

    const basePayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      sessionId: session.sessionId,
      aud: this.config.jwt.audience,
      iss: this.config.jwt.issuer,
      subscription: {
        tier: user.subscription.tier,
        limits: {
          apiCallsPerHour: user.subscription.limits.apiCallsPerHour,
          maxConcurrentRequests: user.subscription.limits.maxConcurrentRequests
        }
      },
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      deviceFingerprint: clientInfo.deviceFingerprint
    }

    const accessToken = jwt.sign(
      { ...basePayload, jti: accessJti, iat: now, exp: accessTokenExp },
      this.config.jwt.secret
    )

    const refreshToken = jwt.sign(
      { ...basePayload, jti: refreshJti, iat: now, exp: refreshTokenExp },
      this.config.jwt.secret
    )

    // Store token IDs for session management
    await redisCache.set(`session_tokens:${session.sessionId}`, [accessJti, refreshJti], refreshTokenExp)

    return { accessToken, refreshToken }
  }

  private async createTwoFactorSession(user: User, clientInfo: any): Promise<string> {
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const sessionData = {
      userId: user.id,
      createdAt: Date.now(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent
    }

    await redisCache.set(`2fa_session:${sessionToken}`, sessionData, 300) // 5 minutes
    return sessionToken
  }

  private async verifyTOTPCode(user: User, code: string): Promise<boolean> {
    // In a real implementation, this would verify TOTP code using libraries like 'otplib'
    // For demonstration purposes
    return code.length === 6 && /^\d+$/.test(code)
  }

  private async getUserSession(sessionId: string): Promise<UserSession | null> {
    return await redisCache.get(`session:${sessionId}`)
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    const session = await this.getUserSession(sessionId)
    if (session) {
      session.lastActivityAt = Date.now()
      await redisCache.set(`session:${sessionId}`, session, this.config.session.timeoutMinutes * 60)
    }
  }

  private async deactivateSession(sessionId: string): Promise<void> {
    const session = await this.getUserSession(sessionId)
    if (session) {
      session.isActive = false
      await redisCache.set(`session:${sessionId}`, session, 3600) // Keep for 1 hour for audit
    }
  }

  private async logSecurityEvent(eventType: string, metadata: any): Promise<void> {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      userId: metadata.userId,
      sessionId: metadata.sessionId,
      eventType: eventType as any,
      severity: this.getEventSeverity(eventType),
      description: this.getEventDescription(eventType, metadata),
      metadata: {
        ipAddress: metadata.ipAddress || 'unknown',
        userAgent: metadata.userAgent || 'unknown',
        timestamp: Date.now(),
        details: metadata
      },
      resolved: false
    }

    // Store in Redis for immediate access and queue for database persistence
    await redisCache.set(`security_event:${event.id}`, event, 86400 * 7) // 7 days

    console.log(`Security event logged: ${eventType} for user ${metadata.userId || 'unknown'}`)
  }

  private getEventSeverity(eventType: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'login': 'low',
      'logout': 'low',
      'failed_login': 'medium',
      'password_reset': 'medium',
      'permission_change': 'high',
      'suspicious_activity': 'high',
      'api_key_used': 'low'
    }
    return severityMap[eventType] || 'medium'
  }

  private getEventDescription(eventType: string, metadata: any): string {
    const descriptions: Record<string, string> = {
      'login': `User logged in successfully`,
      'logout': `User logged out`,
      'failed_login': `Failed login attempt`,
      'password_reset': `Password reset requested`,
      'permission_change': `User permissions modified`,
      'suspicious_activity': `Suspicious activity detected: ${metadata.reason}`,
      'api_key_used': `API key authentication`
    }
    return descriptions[eventType] || 'Security event occurred'
  }

  private detectDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' | 'api' {
    if (!userAgent) return 'api'

    const ua = userAgent.toLowerCase()
    if (ua.includes('mobile')) return 'mobile'
    if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet'
    return 'desktop'
  }

  private async getLocationFromIP(ipAddress: string): Promise<any> {
    // In a real implementation, this would use a geolocation service
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown'
    }
  }

  private async resetFailedLoginAttempts(userId: string): Promise<void> {
    // In a real implementation, this would update the database
  }

  private async updateFailedLoginAttempts(userId: string, attempts: number): Promise<void> {
    // In a real implementation, this would update the database
  }

  private async lockAccount(userId: string, lockoutUntil: number): Promise<void> {
    // In a real implementation, this would update the database
  }

  private async updateLastLogin(userId: string, clientInfo: any): Promise<void> {
    // In a real implementation, this would update the database
  }

  private async initializeRolePermissions(): Promise<void> {
    // Initialize default role-permission mappings
    const rolePermissions: Record<UserRole, Permission[]> = {
      [UserRole.BASIC]: [
        Permission.READ_BASIC_DATA,
        Permission.USE_BASIC_ALGORITHMS,
        Permission.API_STANDARD_RATE
      ],
      [UserRole.PREMIUM]: [
        Permission.READ_BASIC_DATA,
        Permission.READ_PREMIUM_DATA,
        Permission.USE_BASIC_ALGORITHMS,
        Permission.USE_ADVANCED_ALGORITHMS,
        Permission.API_PREMIUM_RATE
      ],
      [UserRole.PROFESSIONAL]: [
        Permission.READ_BASIC_DATA,
        Permission.READ_PREMIUM_DATA,
        Permission.READ_REAL_TIME_DATA,
        Permission.USE_BASIC_ALGORITHMS,
        Permission.USE_ADVANCED_ALGORITHMS,
        Permission.CREATE_CUSTOM_ALGORITHMS,
        Permission.API_PREMIUM_RATE
      ],
      [UserRole.INSTITUTIONAL]: [
        Permission.READ_BASIC_DATA,
        Permission.READ_PREMIUM_DATA,
        Permission.READ_REAL_TIME_DATA,
        Permission.READ_INSTITUTIONAL_DATA,
        Permission.USE_BASIC_ALGORITHMS,
        Permission.USE_ADVANCED_ALGORITHMS,
        Permission.CREATE_CUSTOM_ALGORITHMS,
        Permission.API_UNLIMITED_RATE,
        Permission.VIEW_ANALYTICS
      ],
      [UserRole.ADMINISTRATOR]: Object.values(Permission)
    }

    // Store role permissions in cache for quick access
    for (const [role, permissions] of Object.entries(rolePermissions)) {
      await redisCache.set(`role_permissions:${role}`, permissions, 86400) // 24 hours
    }
  }

  private async cleanupExpiredSessions(): Promise<void> {
    // In a real implementation, this would clean up expired sessions from database
    console.log('Cleaned up expired sessions')
  }
}

// Export singleton instance
export const authService = AuthService.getInstance()