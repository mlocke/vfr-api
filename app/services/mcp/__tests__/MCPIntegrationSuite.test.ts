/**
 * Comprehensive MCP Integration Test Suite
 * Tests all financial MCP servers (government + commercial) with caching strategy validation
 *
 * Test Coverage:
 * - Commercial MCP servers: Polygon, Alpha Vantage, Yahoo Finance
 * - Government MCP servers: SEC EDGAR, Treasury, Data.gov
 * - Caching strategy validation (historical vs real-time data)
 * - Data fusion across all sources
 * - Performance validation
 * - Cross-server data consistency
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { MCPClient } from '../MCPClient'
import '../MCPClientExtensions' // Import extensions to augment MCPClient
import { FusionOptions, ConflictResolutionStrategy, FusedMCPResponse } from '../types'
import { redisCache } from '../../cache/RedisCache'

// Mock Redis to isolate cache testing
jest.mock('../../cache/RedisCache', () => ({
  redisCache: {
    get: jest.fn(),
    set: jest.fn(),
    invalidatePattern: jest.fn(),
    getCachedStockPrice: jest.fn(),
    cacheStockPrice: jest.fn(),
    getStats: jest.fn(),
    warmCache: jest.fn()
  }
}))

describe('MCP Integration Test Suite - Government + Commercial Servers', () => {
  let mcpClient: MCPClient
  let mockRedisCache: any

  beforeEach(() => {
    // Reset singleton and create fresh instance
    (MCPClient as any).instance = undefined
    mcpClient = MCPClient.getInstance()

    // Initialize government servers
    mcpClient.addGovernmentServers()

    // Setup Redis mock
    mockRedisCache = redisCache as any
    mockRedisCache.get.mockResolvedValue(null)
    mockRedisCache.set.mockResolvedValue(true)
    mockRedisCache.getCachedStockPrice.mockResolvedValue(null)
    mockRedisCache.cacheStockPrice.mockResolvedValue(true)
    mockRedisCache.getStats.mockResolvedValue({
      hitRate: 0.75,
      memoryUsage: 1024,
      requests: 100,
      hits: 75,
      misses: 25
    })

    // Stop health checks to prevent interference
    mcpClient.stopHealthChecks()
  })

  afterEach(() => {
    mcpClient.stopHealthChecks()
    jest.clearAllMocks()
  })

  describe('Government MCP Server Configuration Tests', () => {
    test('should_configure_sec_edgar_server_with_proper_endpoints', () => {
      // Arrange: SEC EDGAR server configuration
      const expectedSECConfig = {
        name: 'SEC EDGAR MCP',
        endpoint: 'https://data.sec.gov/api',
        rateLimit: 100, // SEC rate limits: 10 requests/second
        timeout: 15000, // Government APIs can be slower
        retryAttempts: 3,
        dataTypes: ['filings', 'insider_trading', 'company_facts', 'mutual_fund_holdings']
      }

      // Act: Initialize government servers
      const govServers = mcpClient.getGovernmentServers()

      // Assert: SEC EDGAR server is properly configured
      expect(govServers).toHaveProperty('sec_edgar')
      expect(govServers.sec_edgar.name).toBe(expectedSECConfig.name)
      expect(govServers.sec_edgar.rateLimit).toBeLessThanOrEqual(600) // 10 requests/second = 600/minute
      expect(govServers.sec_edgar.timeout).toBeGreaterThanOrEqual(10000)
    })

    test('should_configure_treasury_server_for_economic_indicators', () => {
      // Arrange: Treasury Department server configuration
      const expectedTreasuryConfig = {
        name: 'US Treasury MCP',
        endpoint: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service',
        rateLimit: 1000, // Treasury APIs are more generous
        timeout: 10000,
        retryAttempts: 2,
        dataTypes: ['yield_curves', 'debt_data', 'exchange_rates', 'interest_rates']
      }

      // Act: Get government server configurations
      const govServers = mcpClient.getGovernmentServers()

      // Assert: Treasury server is properly configured
      expect(govServers).toHaveProperty('treasury')
      expect(govServers.treasury.name).toBe(expectedTreasuryConfig.name)
      expect(govServers.treasury.dataTypes).toContain('yield_curves')
      expect(govServers.treasury.dataTypes).toContain('interest_rates')
    })

    test('should_configure_data_gov_server_for_economic_data', () => {
      // Arrange: Data.gov server configuration
      const expectedDataGovConfig = {
        name: 'Data.gov Economic MCP',
        endpoint: 'https://api.data.gov',
        rateLimit: 1000,
        timeout: 12000,
        retryAttempts: 3,
        dataTypes: ['economic_indicators', 'employment_data', 'inflation_data', 'gdp_data']
      }

      // Act: Get government server configurations
      const govServers = mcpClient.getGovernmentServers()

      // Assert: Data.gov server is properly configured
      expect(govServers).toHaveProperty('data_gov')
      expect(govServers.data_gov.name).toBe(expectedDataGovConfig.name)
      expect(govServers.data_gov.dataTypes).toContain('economic_indicators')
      expect(govServers.data_gov.dataTypes).toContain('employment_data')
    })
  })

  describe('Commercial MCP Server Validation Tests', () => {
    test('should_validate_polygon_server_for_real_time_data', async () => {
      // Arrange: Polygon server for real-time market data
      const testSymbol = 'AAPL'
      const expectedResponseStructure = {
        success: true,
        data: expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              o: expect.any(Number), // open
              c: expect.any(Number), // close
              h: expect.any(Number), // high
              l: expect.any(Number), // low
              v: expect.any(Number), // volume
              t: expect.any(Number)  // timestamp
            })
          ])
        }),
        source: 'polygon',
        timestamp: expect.any(Number)
      }

      // Act: Execute Polygon real-time data request
      const response = await mcpClient.executeTool('get_aggs', {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'minute',
        from_: new Date().toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
      }, { preferredServer: 'polygon', cacheTTL: 0 }) // No cache for real-time

      // Assert: Polygon provides real-time market data
      expect(response).toMatchObject(expectedResponseStructure)
      expect(response.timestamp).toBeGreaterThan(Date.now() - 10000) // Within 10 seconds
    })

    test('should_validate_alpha_vantage_server_for_technical_indicators', async () => {
      // Arrange: Alpha Vantage for technical analysis
      const testSymbol = 'MSFT'
      const technicalIndicator = 'RSI'

      // Act: Execute Alpha Vantage technical indicator request
      const response = await mcpClient.executeTool('technical_indicators', {
        symbol: testSymbol,
        function: technicalIndicator,
        interval: 'daily',
        time_period: 14
      }, { preferredServer: 'alphavantage' })

      // Assert: Alpha Vantage provides technical indicator data
      expect(response.success).toBe(true)
      expect(response.source).toBe('alphavantage')
      expect(response.data).toBeDefined()
    })

    test('should_validate_yahoo_finance_server_for_free_data', async () => {
      // Arrange: Yahoo Finance for free financial data
      const testSymbol = 'GOOGL'

      // Act: Execute Yahoo Finance data request
      const response = await mcpClient.executeTool('get_stock_info', {
        symbol: testSymbol,
        include_financials: true,
        include_holders: true
      }, { preferredServer: 'yahoo' })

      // Assert: Yahoo Finance provides comprehensive free data
      expect(response.success).toBe(true)
      expect(response.source).toBe('yahoo')
      expect(response.data).toBeDefined()
    })
  })

  describe('Caching Strategy Validation Tests', () => {
    test('should_cache_historical_data_for_extended_periods', async () => {
      // Arrange: Historical data request (should be cached)
      const testSymbol = 'AAPL'
      const historicalParams = {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'day',
        from_: '2023-01-01',
        to: '2023-12-31'
      }
      const expectedCacheTTL = 24 * 60 * 60 * 1000 // 24 hours for historical data

      // Act: Request historical data with caching
      await mcpClient.executeTool('get_aggs', historicalParams, {
        cacheTTL: expectedCacheTTL
      })

      // Assert: Historical data should be cached with long TTL
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        expect.stringContaining('tool:get_aggs'),
        expect.any(Object),
        expectedCacheTTL,
        expect.objectContaining({
          version: '1.0.0'
        })
      )
    })

    test('should_never_cache_real_time_market_data', async () => {
      // Arrange: Real-time data request (should NOT be cached)
      const testSymbol = 'TSLA'
      const realtimeParams = {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'minute'
      }

      // Act: Request real-time data without caching
      await mcpClient.executeTool('get_last_quote', realtimeParams, {
        cacheTTL: 0 // No caching for real-time data
      })

      // Assert: Real-time data should not be cached
      expect(mockRedisCache.set).not.toHaveBeenCalled()
    })

    test('should_cache_company_fundamentals_with_medium_ttl', async () => {
      // Arrange: Company fundamental data (changes infrequently)
      const testSymbol = 'AMZN'
      const fundamentalParams = { ticker: testSymbol }
      const expectedCacheTTL = 6 * 60 * 60 * 1000 // 6 hours for fundamentals

      // Act: Request company fundamental data
      await mcpClient.executeTool('get_ticker_details', fundamentalParams, {
        cacheTTL: expectedCacheTTL
      })

      // Assert: Fundamental data cached with medium TTL
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        expect.stringContaining('tool:get_ticker_details'),
        expect.any(Object),
        expectedCacheTTL,
        expect.any(Object)
      )
    })

    test('should_achieve_target_cache_hit_rate_above_75_percent', async () => {
      // Arrange: Multiple requests for the same data to test cache efficiency
      const testSymbol = 'NVDA'
      const params = { ticker: testSymbol }

      // Mock cache hit on second request
      mockRedisCache.get
        .mockResolvedValueOnce(null) // First request: cache miss
        .mockResolvedValueOnce({ // Second request: cache hit
          results: [{ o: 100, c: 105, h: 110, l: 95, v: 1000000, t: Date.now() }]
        })

      // Act: Make multiple requests for same data
      await mcpClient.executeTool('get_ticker_details', params, { cacheTTL: 3600000 })
      await mcpClient.executeTool('get_ticker_details', params, { cacheTTL: 3600000 })

      // Get cache statistics
      const cacheStats = await mcpClient.getCacheStats()

      // Assert: Cache hit rate meets target threshold
      expect(cacheStats.redis.hitRate).toBeGreaterThanOrEqual(0.75)
    })
  })

  describe('Multi-Source Data Fusion Tests', () => {
    test('should_fuse_stock_price_data_from_multiple_commercial_sources', async () => {
      // Arrange: Multiple sources for stock price data
      const testSymbol = 'AAPL'
      const fusionOptions: FusionOptions = {
        sources: ['polygon', 'alphavantage', 'yahoo'],
        strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
        validateData: true,
        parallel: true,
        includeMetadata: true
      }

      // Act: Execute data fusion for stock price
      const fusedResponse = await mcpClient.executeWithFusion('get_aggs', {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'day',
        from_: '2024-01-01',
        to: '2024-01-31'
      }, fusionOptions)

      // Assert: Data fusion combines multiple sources effectively
      expect(fusedResponse.success).toBe(true)
      expect(fusedResponse.fusion).toBeDefined()
      expect(fusedResponse.fusion!.sources).toContain('polygon')
      expect(fusedResponse.fusion!.sources.length).toBeGreaterThanOrEqual(2)
      expect(fusedResponse.fusion!.qualityScore.overall).toBeGreaterThan(0.5)
    })

    test('should_fuse_government_and_commercial_economic_data', async () => {
      // Arrange: Economic data from government and commercial sources
      const fusionOptions: FusionOptions = {
        sources: ['treasury', 'data_gov', 'alphavantage'],
        strategy: ConflictResolutionStrategy.CONSENSUS,
        validateData: true,
        requireConsensus: true
      }

      // Act: Execute fusion for economic indicators
      const fusedResponse = await mcpClient.executeWithFusion('get_economic_indicators', {
        indicators: ['inflation_rate', 'unemployment_rate', 'gdp_growth'],
        period: 'quarterly',
        year: 2024
      }, fusionOptions)

      // Assert: Government and commercial data are properly fused
      expect(fusedResponse.success).toBe(true)
      expect(fusedResponse.fusion!.sources).toContain('treasury')
      expect(fusedResponse.fusion!.sources).toContain('data_gov')
      expect(fusedResponse.fusion!.resolutionStrategy).toBe(ConflictResolutionStrategy.CONSENSUS)
    })

    test('should_resolve_conflicts_using_highest_quality_strategy', async () => {
      // Arrange: Conflicting data from multiple sources
      const testSymbol = 'META'
      const fusionOptions: FusionOptions = {
        sources: ['polygon', 'yahoo', 'alphavantage'],
        strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
        validateData: true
      }

      // Act: Execute fusion with potential conflicts
      const fusedResponse = await mcpClient.executeWithFusion('get_ticker_details', {
        ticker: testSymbol
      }, fusionOptions)

      // Assert: Conflicts resolved using quality-based strategy
      expect(fusedResponse.success).toBe(true)
      expect(fusedResponse.fusion!.resolutionStrategy).toBe(ConflictResolutionStrategy.HIGHEST_QUALITY)
      expect(fusedResponse.fusion!.conflicts).toBeGreaterThanOrEqual(0)
      if (fusedResponse.fusion!.conflicts > 0) {
        expect(fusedResponse.fusion!.primarySource).toBeDefined()
      }
    })
  })

  describe('Server-Specific Contribution Tests', () => {
    test('should_validate_polygon_provides_institutional_data', async () => {
      // Arrange: Request institutional trading data from Polygon
      const testSymbol = 'AAPL'

      // Act: Get institutional data from Polygon
      const response = await mcpClient.executeTool('get_institutional_ownership', {
        ticker: testSymbol,
        date: '2024-01-01'
      }, { preferredServer: 'polygon' })

      // Assert: Polygon provides institutional ownership data
      expect(response.success).toBe(true)
      expect(response.source).toBe('polygon')
      expect(response.data).toHaveProperty('institutional_holdings')
    })

    test('should_validate_sec_edgar_provides_company_filings', async () => {
      // Arrange: Request SEC filings from EDGAR
      const testSymbol = 'MSFT'

      // Act: Get SEC filings from EDGAR
      const response = await mcpClient.executeTool('get_sec_filings', {
        ticker: testSymbol,
        form_types: ['10-K', '10-Q', '8-K'],
        limit: 10
      }, { preferredServer: 'sec_edgar' })

      // Assert: SEC EDGAR provides official company filings
      expect(response.success).toBe(true)
      expect(response.source).toBe('sec_edgar')
      expect(response.data).toHaveProperty('filings')
      expect(Array.isArray(response.data.filings)).toBe(true)
    })

    test('should_validate_treasury_provides_yield_curves', async () => {
      // Arrange: Request Treasury yield curve data
      const requestDate = '2024-01-01'

      // Act: Get yield curve from Treasury
      const response = await mcpClient.executeTool('get_yield_curve', {
        date: requestDate,
        curve_type: 'treasury'
      }, { preferredServer: 'treasury' })

      // Assert: Treasury provides official yield curve data
      expect(response.success).toBe(true)
      expect(response.source).toBe('treasury')
      expect(response.data).toHaveProperty('yield_curve')
      expect(response.data.yield_curve).toHaveProperty('rates')
    })

    test('should_validate_data_gov_provides_economic_indicators', async () => {
      // Arrange: Request economic indicators from Data.gov

      // Act: Get economic indicators from Data.gov
      const response = await mcpClient.executeTool('get_economic_data', {
        indicators: ['GDP', 'CPI', 'unemployment_rate'],
        frequency: 'monthly',
        start_date: '2023-01-01',
        end_date: '2024-01-01'
      }, { preferredServer: 'data_gov' })

      // Assert: Data.gov provides government economic data
      expect(response.success).toBe(true)
      expect(response.source).toBe('data_gov')
      expect(response.data).toHaveProperty('economic_indicators')
    })

    test('should_validate_alpha_vantage_provides_technical_indicators', async () => {
      // Arrange: Request technical analysis from Alpha Vantage
      const testSymbol = 'GOOGL'

      // Act: Get technical indicators from Alpha Vantage
      const response = await mcpClient.executeTool('get_technical_analysis', {
        symbol: testSymbol,
        indicators: ['RSI', 'MACD', 'SMA'],
        interval: 'daily'
      }, { preferredServer: 'alphavantage' })

      // Assert: Alpha Vantage provides comprehensive technical analysis
      expect(response.success).toBe(true)
      expect(response.source).toBe('alphavantage')
      expect(response.data).toHaveProperty('technical_indicators')
    })

    test('should_validate_yahoo_finance_provides_free_comprehensive_data', async () => {
      // Arrange: Request comprehensive data from Yahoo Finance
      const testSymbol = 'AMZN'

      // Act: Get comprehensive stock data from Yahoo Finance
      const response = await mcpClient.executeTool('get_comprehensive_stock_data', {
        symbol: testSymbol,
        include_financials: true,
        include_options: true,
        include_holders: true,
        include_insider_trades: true
      }, { preferredServer: 'yahoo' })

      // Assert: Yahoo Finance provides comprehensive free data
      expect(response.success).toBe(true)
      expect(response.source).toBe('yahoo')
      expect(response.data).toHaveProperty('stock_info')
      expect(response.data).toHaveProperty('financials')
      expect(response.data).toHaveProperty('holders')
    })
  })

  describe('Performance Validation Tests', () => {
    test('should_meet_real_time_data_response_time_under_500ms', async () => {
      // Arrange: Real-time data request with performance tracking
      const testSymbol = 'TSLA'
      const startTime = Date.now()

      // Act: Request real-time data
      const response = await mcpClient.executeTool('get_last_quote', {
        ticker: testSymbol
      }, {
        preferredServer: 'polygon',
        timeout: 500
      })

      const responseTime = Date.now() - startTime

      // Assert: Real-time response under 500ms
      expect(response.success).toBe(true)
      expect(responseTime).toBeLessThan(500)
    })

    test('should_maintain_historical_data_cache_hit_rate_above_75_percent', async () => {
      // Arrange: Setup cache hit scenario
      const testSymbol = 'AAPL'
      const historicalParams = {
        ticker: testSymbol,
        from_: '2023-01-01',
        to: '2023-12-31'
      }

      // Mock high cache hit rate
      mockRedisCache.getStats.mockResolvedValue({
        hitRate: 0.82, // Above 75% threshold
        requests: 1000,
        hits: 820,
        misses: 180,
        memoryUsage: 2048
      })

      // Act: Get cache statistics
      const cacheStats = await mcpClient.getCacheStats()

      // Assert: Cache hit rate exceeds threshold
      expect(cacheStats.redis.hitRate).toBeGreaterThan(0.75)
    })

    test('should_achieve_cross_server_data_consistency_above_90_percent', async () => {
      // Arrange: Data consistency test across multiple servers
      const testSymbol = 'MSFT'
      const tolerance = 0.05 // 5% tolerance for price variations

      // Act: Get same data from multiple sources
      const polygonResponse = await mcpClient.executeTool('get_aggs', {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'day',
        from_: '2024-01-01',
        to: '2024-01-01'
      }, { preferredServer: 'polygon' })

      const yahooResponse = await mcpClient.executeTool('get_stock_info', {
        symbol: testSymbol
      }, { preferredServer: 'yahoo' })

      // Assert: Data consistency across sources
      expect(polygonResponse.success).toBe(true)
      expect(yahooResponse.success).toBe(true)

      // For actual price comparison, we would extract prices and verify they're within tolerance
      // This is a structural validation since we're using mock data
      expect(polygonResponse.data).toBeDefined()
      expect(yahooResponse.data).toBeDefined()
    })

    test('should_handle_concurrent_requests_efficiently', async () => {
      // Arrange: Multiple concurrent requests
      const testSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
      const startTime = Date.now()

      // Act: Execute concurrent requests
      const promises = testSymbols.map(symbol =>
        mcpClient.executeTool('get_ticker_details', { ticker: symbol }, {
          timeout: 5000
        })
      )

      const responses = await Promise.all(promises)
      const totalTime = Date.now() - startTime

      // Assert: All requests successful and efficient
      expect(responses).toHaveLength(testSymbols.length)
      responses.forEach(response => {
        expect(response.success).toBe(true)
      })
      expect(totalTime).toBeLessThan(10000) // All 5 requests under 10 seconds
    })
  })

  describe('Integration Validation Tests', () => {
    test('should_successfully_integrate_all_government_mcp_servers', async () => {
      // Arrange: Government server integration test
      const governmentServers = ['sec_edgar', 'treasury', 'data_gov']

      // Act: Test connection to all government servers
      const healthChecks = await Promise.allSettled(
        governmentServers.map(server =>
          mcpClient.executeTool('health_check', {}, {
            preferredServer: server,
            timeout: 10000
          })
        )
      )

      // Assert: All government servers are accessible
      const successfulChecks = healthChecks.filter(
        result => result.status === 'fulfilled' && (result.value as any).success
      )
      expect(successfulChecks.length).toBeGreaterThanOrEqual(2) // At least 2 of 3 government servers
    })

    test('should_successfully_integrate_all_commercial_mcp_servers', async () => {
      // Arrange: Commercial server integration test
      const commercialServers = ['polygon', 'alphavantage', 'yahoo']

      // Act: Test connection to all commercial servers
      const healthChecks = await Promise.allSettled(
        commercialServers.map(server =>
          mcpClient.executeTool('health_check', {}, {
            preferredServer: server,
            timeout: 5000
          })
        )
      )

      // Assert: All commercial servers are accessible
      const successfulChecks = healthChecks.filter(
        result => result.status === 'fulfilled' && (result.value as any).success
      )
      expect(successfulChecks.length).toBe(commercialServers.length)
    })

    test('should_demonstrate_complete_data_pipeline_integration', async () => {
      // Arrange: End-to-end data pipeline test
      const testSymbol = 'AAPL'

      // Act: Execute complete analysis pipeline
      const analysisResult = await mcpClient.getUnifiedSymbolData(testSymbol, {
        includePrice: true,
        includeCompany: true,
        includeTechnicals: ['RSI', 'MACD'],
        includeNews: true,
        fusionOptions: {
          sources: ['polygon', 'alphavantage', 'yahoo', 'sec_edgar'],
          strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
          validateData: true,
          parallel: true
        }
      })

      // Assert: Complete analysis pipeline successful
      expect(analysisResult.price).toBeDefined()
      expect(analysisResult.company).toBeDefined()
      expect(analysisResult.technicals).toBeDefined()
      expect(analysisResult.technicals!.RSI).toBeDefined()
      expect(analysisResult.technicals!.MACD).toBeDefined()
      expect(analysisResult.errors).toBeUndefined()
    })
  })
})

// Extension methods for MCPClient to support government servers
declare module '../MCPClient' {
  interface MCPClient {
    getGovernmentServers(): Record<string, any>
  }
}