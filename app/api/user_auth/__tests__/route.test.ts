/**
 * Authentication API Tests
 * Comprehensive test suite for the user authentication endpoint
 */

import { NextRequest } from 'next/server'
import { POST, GET } from '../route'
import { authService } from '../../../services/auth/AuthService'
import { UserRole, Permission } from '../../../services/auth/types'

// Mock dependencies
jest.mock('../../../services/auth/AuthService')
jest.mock('../../../services/cache/RedisCache')

const mockAuthService = authService as jest.Mocked<typeof authService>

/**
 * Helper function to create mock requests
 */
function createMockRequest(
  body: any,
  headers: Record<string, string> = {},
  url = 'https://example.com/api/user_auth'
): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '192.168.1.1',
      'user-agent': 'Test User Agent',
      ...headers
    },
    body: JSON.stringify(body)
  })
}

/**
 * Mock user data
 */
const mockUser = {
  id: 'user_123',
  email: 'test@example.com',
  role: UserRole.PREMIUM,
  permissions: [Permission.READ_BASIC_DATA, Permission.READ_PREMIUM_DATA],
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    company: 'Test Corp',
    phoneNumber: '+1234567890',
    timezone: 'America/New_York',
    preferences: {
      dataRefreshRate: 5000,
      defaultRiskTolerance: 'moderate' as const,
      notificationSettings: {
        email: true,
        sms: false,
        push: true
      }
    }
  },
  subscription: {
    tier: 'premium',
    status: 'active' as const,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    features: ['real_time_data', 'advanced_algorithms'],
    limits: {
      apiCallsPerHour: 1000,
      maxConcurrentRequests: 10,
      dataRetentionDays: 90
    }
  },
  security: {
    lastLoginAt: Date.now() - 1000,
    lastLoginIP: '192.168.1.1',
    failedLoginAttempts: 0,
    twoFactorEnabled: false,
    sessionTimeoutMinutes: 60
  },
  metadata: {
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    emailVerified: true,
    agreedToTermsAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    lastActivityAt: Date.now()
  }
}

const mockSession = {
  sessionId: 'session_123',
  userId: 'user_123',
  ipAddress: '192.168.1.1',
  userAgent: 'Test User Agent',
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 1000,
  isActive: true,
  metadata: {
    loginMethod: 'password' as const,
    deviceType: 'desktop' as const
  }
}

describe('POST /api/user_auth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthService.initialize.mockResolvedValue(undefined)
  })

  describe('Login Operation', () => {
    it('should successfully authenticate valid credentials', async () => {
      const loginRequest = {
        operation: 'login',
        email: 'test@example.com',
        password: 'SecurePassword123!',
        rememberMe: false
      }

      const mockResponse = {
        success: true,
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresIn: 900,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          permissions: mockUser.permissions,
          profile: {
            firstName: mockUser.profile.firstName,
            lastName: mockUser.profile.lastName,
            company: mockUser.profile.company
          }
        }
      }

      mockAuthService.authenticate.mockResolvedValue(mockResponse)

      const request = createMockRequest(loginRequest)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.accessToken).toBeDefined()
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('test@example.com')
      expect(mockAuthService.authenticate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'SecurePassword123!'
        }),
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Test User Agent'
        })
      )
    })

    it('should handle two-factor authentication requirement', async () => {
      const loginRequest = {
        operation: 'login',
        email: 'test@example.com',
        password: 'SecurePassword123!'
      }

      const mockResponse = {
        success: true,
        requiresTwoFactor: true,
        sessionToken: 'temp_session_token',
        message: 'Two-factor authentication required'
      }

      mockAuthService.authenticate.mockResolvedValue(mockResponse)

      const request = createMockRequest(loginRequest)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.requiresTwoFactor).toBe(true)
      expect(data.sessionToken).toBeDefined()
    })

    it('should reject invalid credentials', async () => {
      const loginRequest = {
        operation: 'login',
        email: 'test@example.com',
        password: 'wrongpassword'
      }

      mockAuthService.authenticate.mockRejectedValue(
        new Error('INVALID_CREDENTIALS')
      )

      const request = createMockRequest(loginRequest)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })

    it('should validate request format', async () => {
      const invalidRequest = {
        operation: 'login',
        email: 'invalid-email',
        password: '123' // Too short
      }

      const request = createMockRequest(invalidRequest)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('VALIDATION_ERROR')
    })
  })

  describe('Two-Factor Authentication', () => {
    it('should verify valid 2FA code', async () => {
      const twoFactorRequest = {
        operation: 'two_factor',
        email: 'test@example.com',
        code: '123456',
        sessionToken: 'temp_session_token'
      }

      const mockResponse = {
        success: true,
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresIn: 900,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          permissions: mockUser.permissions,
          profile: {
            firstName: mockUser.profile.firstName,
            lastName: mockUser.profile.lastName,
            company: mockUser.profile.company
          }
        }
      }

      mockAuthService.verifyTwoFactor.mockResolvedValue(mockResponse)

      const request = createMockRequest(twoFactorRequest)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.accessToken).toBeDefined()
    })

    it('should reject invalid 2FA code', async () => {
      const twoFactorRequest = {
        operation: 'two_factor',
        email: 'test@example.com',
        code: '000000',
        sessionToken: 'temp_session_token'
      }

      mockAuthService.verifyTwoFactor.mockRejectedValue(
        new Error('INVALID_2FA_CODE')
      )

      const request = createMockRequest(twoFactorRequest)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })
  })

  describe('Token Refresh', () => {
    it('should refresh valid token', async () => {
      const refreshRequest = {
        operation: 'refresh',
        refreshToken: 'valid_refresh_token',
        deviceFingerprint: 'device_123'
      }

      const mockResponse = {
        success: true,
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresIn: 900
      }

      mockAuthService.refreshToken.mockResolvedValue(mockResponse)

      const request = createMockRequest(refreshRequest)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.accessToken).toBe('new_access_token')
    })

    it('should reject expired refresh token', async () => {
      const refreshRequest = {
        operation: 'refresh',
        refreshToken: 'expired_token'
      }

      mockAuthService.refreshToken.mockRejectedValue(
        new Error('TOKEN_EXPIRED')
      )

      const request = createMockRequest(refreshRequest)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })
  })

  describe('Token Validation', () => {
    it('should validate valid token', async () => {
      const validateRequest = {
        operation: 'validate',
        accessToken: 'valid_access_token',
        requiredPermissions: [Permission.READ_BASIC_DATA]
      }

      mockAuthService.validateToken.mockResolvedValue({
        user: mockUser,
        session: mockSession
      })

      mockAuthService.hasAllPermissions.mockReturnValue(true)

      const request = createMockRequest(validateRequest)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.valid).toBe(true)
      expect(data.user).toBeDefined()
    })

    it('should reject insufficient permissions', async () => {
      const validateRequest = {
        operation: 'validate',
        accessToken: 'valid_access_token',
        requiredPermissions: [Permission.MANAGE_SYSTEM]
      }

      mockAuthService.validateToken.mockResolvedValue({
        user: mockUser,
        session: mockSession
      })

      mockAuthService.hasAllPermissions.mockReturnValue(false)

      const request = createMockRequest(validateRequest)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toBe('INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('Logout Operation', () => {
    it('should successfully logout user', async () => {
      const logoutRequest = {
        operation: 'logout',
        accessToken: 'valid_access_token',
        sessionId: 'session_123'
      }

      mockAuthService.validateToken.mockResolvedValue({
        user: mockUser,
        session: mockSession
      })

      mockAuthService.logout.mockResolvedValue(undefined)

      const request = createMockRequest(logoutRequest)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Successfully logged out')
      expect(mockAuthService.logout).toHaveBeenCalledWith('user_123', 'session_123')
    })
  })

  describe('Rate Limiting', () => {
    it('should apply rate limiting to repeated requests', async () => {
      const loginRequest = {
        operation: 'login',
        email: 'test@example.com',
        password: 'wrongpassword'
      }

      // Make multiple requests to trigger rate limiting
      const requests = Array(12).fill(null).map(() => createMockRequest(loginRequest))

      let responses: Response[] = []
      for (const req of requests) {
        const response = await POST(req)
        responses.push(response)
      }

      // Check that later requests are rate limited
      const lastResponse = responses[responses.length - 1]
      const lastData = await lastResponse.json()

      expect(lastResponse.status).toBe(429)
      expect(lastData.success).toBe(false)
      expect(lastData.error).toBe('RATE_LIMITED')
    })
  })

  describe('Security Headers', () => {
    it('should include security headers in response', async () => {
      const loginRequest = {
        operation: 'login',
        email: 'test@example.com',
        password: 'SecurePassword123!'
      }

      mockAuthService.authenticate.mockResolvedValue({
        success: true,
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 900,
        user: mockUser as any
      })

      const request = createMockRequest(loginRequest)
      const response = await POST(request)

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(response.headers.get('Cache-Control')).toContain('no-store')
    })
  })
})

describe('GET /api/user_auth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthService.initialize.mockResolvedValue(undefined)
  })

  it('should return health status', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.service).toBe('user_auth')
    expect(data.features).toBeDefined()
    expect(data.supportedOperations).toContain('login')
    expect(data.security).toBeDefined()
    expect(data.compliance.financialGrade).toBe(true)
  })

  it('should handle service unavailable', async () => {
    mockAuthService.initialize.mockRejectedValue(new Error('Service unavailable'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.success).toBe(false)
    expect(data.error).toBe('SERVICE_UNAVAILABLE')
  })
})

describe('Input Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthService.initialize.mockResolvedValue(undefined)
  })

  it('should reject non-JSON content type', async () => {
    const request = new NextRequest('https://example.com/api/user_auth', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain'
      },
      body: 'invalid'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('INVALID_CONTENT_TYPE')
  })

  it('should reject malformed JSON', async () => {
    const request = new NextRequest('https://example.com/api/user_auth', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: '{ invalid json'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('INVALID_JSON')
  })

  it('should reject invalid operation', async () => {
    const request = createMockRequest({
      operation: 'invalid_operation'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('INVALID_OPERATION')
  })
})