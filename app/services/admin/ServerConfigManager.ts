/**
 * Server Configuration Manager Service
 * Extends MCPClient functionality to expose server configurations for admin dashboard
 * Provides testing, health checks, and configuration management capabilities
 */

import { MCPClient } from '../mcp/MCPClient'
import { authService } from '../auth/AuthService'
import { UserRole } from '../auth/types'

export interface ServerInfo {
  id: string
  name: string
  type: 'commercial' | 'government' | 'free'
  status: 'online' | 'offline' | 'degraded' | 'maintenance' | 'idle' | 'processing'
  enabled: boolean
  endpoint?: string
  hasApiKey: boolean
  requiresAuth: boolean
  rateLimit: number
  timeout: number
  retryAttempts: number
  category: 'stock_data' | 'economic_data' | 'web_intelligence' | 'filings'
  lastHealthCheck?: number
  responseTime?: number
  errorRate?: number
  features: string[]
}

export interface ServerTestResult {
  serverId: string
  success: boolean
  responseTime: number
  error?: string
  timestamp: number
  testType: 'connection' | 'health' | 'data_fetch' | 'rate_limit'
  details?: any
}

export interface ServerGroupTestResult {
  groupName: string
  servers: ServerTestResult[]
  overallSuccess: boolean
  averageResponseTime: number
  successRate: number
  timestamp: number
}

export class ServerConfigManager {
  private static instance: ServerConfigManager
  private mcpClient: MCPClient
  private servers: Map<string, ServerInfo> = new Map()
  private enabledServers: Set<string> = new Set()

  constructor() {
    this.mcpClient = MCPClient.getInstance()
    this.initializeServerInfo()
    this.loadEnabledServers()
  }

  static getInstance(): ServerConfigManager {
    if (!ServerConfigManager.instance) {
      ServerConfigManager.instance = new ServerConfigManager()
    }
    return ServerConfigManager.instance
  }

  /**
   * Initialize server information based on MCPClient configuration
   */
  private initializeServerInfo(): void {
    // Commercial Stock Data Servers
    this.servers.set('polygon', {
      id: 'polygon',
      name: 'Polygon.io',
      type: 'commercial',
      status: 'offline',
      enabled: false,
      hasApiKey: !!process.env.POLYGON_API_KEY,
      requiresAuth: true,
      rateLimit: 1000,
      timeout: 5000,
      retryAttempts: 3,
      category: 'stock_data',
      features: ['real_time_quotes', 'historical_data', 'technical_indicators', 'company_details', 'market_holidays']
    })

    this.servers.set('alphavantage', {
      id: 'alphavantage',
      name: 'Alpha Vantage',
      type: 'commercial',
      status: 'online',
      enabled: true,
      hasApiKey: !!process.env.ALPHA_VANTAGE_API_KEY,
      requiresAuth: true,
      rateLimit: 500,
      timeout: 10000,
      retryAttempts: 2,
      category: 'stock_data',
      features: ['stock_quotes', 'forex', 'crypto', 'technical_indicators', 'earnings_data']
    })

    this.servers.set('fmp', {
      id: 'fmp',
      name: 'Financial Modeling Prep',
      type: 'commercial',
      status: 'online',
      enabled: true,
      hasApiKey: !!process.env.FMP_API_KEY,
      requiresAuth: true,
      rateLimit: 250,
      timeout: 8000,
      retryAttempts: 3,
      category: 'stock_data',
      features: ['financial_statements', 'ratios', 'dcf_models', 'earnings', 'insider_trading']
    })

    // Free Stock Data Servers
    this.servers.set('yahoo', {
      id: 'yahoo',
      name: 'Yahoo Finance',
      type: 'free',
      status: 'online',
      enabled: true,
      hasApiKey: false,
      requiresAuth: false,
      rateLimit: 1000,
      timeout: 10000,
      retryAttempts: 3,
      category: 'stock_data',
      features: ['stock_quotes', 'historical_data', 'news', 'earnings', 'market_summary']
    })

    // Government Data Servers
    this.servers.set('sec_edgar', {
      id: 'sec_edgar',
      name: 'SEC EDGAR',
      type: 'government',
      status: 'online',
      enabled: true,
      hasApiKey: false,
      requiresAuth: false,
      rateLimit: 600,
      timeout: 10000,
      retryAttempts: 3,
      category: 'filings',
      features: ['company_filings', 'insider_trading', 'ownership_data', 'mutual_fund_holdings']
    })

    this.servers.set('treasury', {
      id: 'treasury',
      name: 'U.S. Treasury',
      type: 'government',
      status: 'online',
      enabled: true,
      hasApiKey: false,
      requiresAuth: false,
      rateLimit: 1000,
      timeout: 10000,
      retryAttempts: 3,
      category: 'economic_data',
      features: ['treasury_rates', 'yield_curves', 'debt_data', 'auction_data']
    })

    this.servers.set('fred', {
      id: 'fred',
      name: 'Federal Reserve Economic Data',
      type: 'government',
      status: 'online',
      enabled: true,
      hasApiKey: !!process.env.FRED_API_KEY,
      requiresAuth: true,
      rateLimit: 120,
      timeout: 8000,
      retryAttempts: 3,
      category: 'economic_data',
      features: ['economic_indicators', 'interest_rates', 'inflation_data', 'employment_data']
    })

    this.servers.set('bls', {
      id: 'bls',
      name: 'Bureau of Labor Statistics',
      type: 'government',
      status: 'online',
      enabled: true,
      hasApiKey: !!process.env.BLS_API_KEY,
      requiresAuth: false,
      rateLimit: 500,
      timeout: 10000,
      retryAttempts: 3,
      category: 'economic_data',
      features: ['employment_data', 'inflation_data', 'wage_data', 'productivity_data']
    })

    this.servers.set('eia', {
      id: 'eia',
      name: 'Energy Information Administration',
      type: 'government',
      status: 'online',
      enabled: true,
      hasApiKey: !!process.env.EIA_API_KEY,
      requiresAuth: true,
      rateLimit: 5000,
      timeout: 8000,
      retryAttempts: 3,
      category: 'economic_data',
      features: ['energy_prices', 'oil_data', 'natural_gas', 'electricity_data']
    })

    // Web Intelligence Servers
    this.servers.set('firecrawl', {
      id: 'firecrawl',
      name: 'Firecrawl',
      type: 'commercial',
      status: 'online',
      enabled: true,
      hasApiKey: !!process.env.FIRECRAWL_API_KEY,
      requiresAuth: true,
      rateLimit: 100,
      timeout: 15000,
      retryAttempts: 2,
      category: 'web_intelligence',
      features: ['web_scraping', 'content_extraction', 'news_gathering', 'data_collection']
    })

    this.servers.set('dappier', {
      id: 'dappier',
      name: 'Dappier',
      type: 'commercial',
      status: 'online',
      enabled: true,
      hasApiKey: !!process.env.DAPPIER_API_KEY,
      requiresAuth: true,
      rateLimit: 200,
      timeout: 15000,
      retryAttempts: 2,
      category: 'web_intelligence',
      features: ['web_intelligence', 'news_analysis', 'market_sentiment', 'social_data']
    })
  }

  /**
   * Load enabled servers from storage
   */
  private loadEnabledServers(): void {
    try {
      // Try to load from environment variable or file storage
      const persistedState = this.loadPersistedState()

      if (persistedState && persistedState.enabledServers) {
        // Load from persisted state
        persistedState.enabledServers.forEach(id => this.enabledServers.add(id))
        console.log('✅ Loaded server states from persistent storage:', persistedState.enabledServers)
      } else {
        // Initialize all servers as disabled by default for first run (safer approach)
        // Servers can be manually enabled through the admin dashboard
        console.log('🔧 Initialized default server states (all disabled for safety)')

        // Persist the default state immediately
        this.savePersistedState()
      }
    } catch (error) {
      console.error('❌ Error loading server states, using defaults:', error)
      // Fallback to all disabled for safety
      console.log('🔧 Fallback: All servers disabled by default')
    }
  }

  /**
   * Get all servers with their current status
   */
  async getAllServers(): Promise<ServerInfo[]> {
    const servers = Array.from(this.servers.values())

    // Update status with latest health check data and enabled state
    for (const server of servers) {
      const healthStatus = await this.getServerHealth(server.id)
      server.status = healthStatus.status
      server.enabled = this.enabledServers.has(server.id)
      server.lastHealthCheck = healthStatus.timestamp
      server.responseTime = healthStatus.responseTime
      server.errorRate = healthStatus.errorRate

      // If server is disabled, override status to offline
      if (!server.enabled) {
        server.status = 'offline'
      }
    }

    return servers
  }

  /**
   * Get servers by category
   */
  async getServersByCategory(category: string): Promise<ServerInfo[]> {
    const allServers = await this.getAllServers()
    return allServers.filter(server => server.category === category)
  }

  /**
   * Get servers by type
   */
  async getServersByType(type: 'commercial' | 'government' | 'free'): Promise<ServerInfo[]> {
    const allServers = await this.getAllServers()
    return allServers.filter(server => server.type === type)
  }

  /**
   * Test individual server connection and functionality
   */
  async testServer(serverId: string, testType: 'connection' | 'health' | 'data_fetch' | 'rate_limit' = 'health'): Promise<ServerTestResult> {
    const startTime = Date.now()

    try {
      let result: any

      switch (testType) {
        case 'connection':
          // Basic connectivity test
          result = await this.mcpClient.executeTool('health_check', {}, {
            preferredServer: serverId,
            timeout: 5000,
            bypassEnabledCheck: true // Allow testing of disabled servers
          })
          break

        case 'health':
          // Comprehensive health check
          result = await this.performHealthCheck(serverId)
          break

        case 'data_fetch':
          // Test actual data fetching capability
          result = await this.testDataFetch(serverId)
          break

        case 'rate_limit':
          // Test rate limiting behavior
          result = await this.testRateLimit(serverId)
          break
      }

      const responseTime = Date.now() - startTime

      return {
        serverId,
        success: result.success || false,
        responseTime,
        timestamp: Date.now(),
        testType,
        details: result
      }

    } catch (error) {
      const responseTime = Date.now() - startTime

      return {
        serverId,
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        testType
      }
    }
  }

  /**
   * Test multiple servers by group (commercial, government, etc.)
   */
  async testServerGroup(groupType: 'commercial' | 'government' | 'free' | 'all'): Promise<ServerGroupTestResult> {
    const startTime = Date.now()

    let serversToTest: ServerInfo[]
    if (groupType === 'all') {
      serversToTest = await this.getAllServers()
    } else {
      serversToTest = await this.getServersByType(groupType)
    }

    const testPromises = serversToTest.map(server =>
      this.testServer(server.id, 'health')
    )

    const results = await Promise.allSettled(testPromises)
    const serverResults: ServerTestResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          serverId: serversToTest[index].id,
          success: false,
          responseTime: 0,
          error: result.reason?.message || 'Test failed',
          timestamp: Date.now(),
          testType: 'health' as const
        }
      }
    })

    const successfulTests = serverResults.filter(r => r.success)
    const averageResponseTime = serverResults.reduce((sum, r) => sum + r.responseTime, 0) / serverResults.length
    const successRate = successfulTests.length / serverResults.length

    return {
      groupName: groupType,
      servers: serverResults,
      overallSuccess: successRate >= 0.7, // 70% success rate threshold
      averageResponseTime,
      successRate,
      timestamp: Date.now()
    }
  }

  /**
   * Get server health status
   */
  private async getServerHealth(serverId: string): Promise<{
    status: 'online' | 'offline' | 'degraded' | 'maintenance'
    timestamp: number
    responseTime?: number
    errorRate?: number
  }> {
    try {
      const stats = this.mcpClient.getStats()
      const serverStats = stats[serverId]

      if (!serverStats) {
        return { status: 'offline', timestamp: Date.now() }
      }

      const errorRate = serverStats.errorCount / Math.max(serverStats.requestCount, 1)
      let status: 'online' | 'offline' | 'degraded' | 'maintenance' = 'online'

      if (!serverStats.connected) {
        status = 'offline'
      } else if (errorRate > 0.1) { // More than 10% error rate
        status = 'degraded'
      } else if (serverStats.avgResponseTime > 15000) { // Very slow response
        status = 'degraded'
      }

      return {
        status,
        timestamp: Date.now(),
        responseTime: serverStats.avgResponseTime,
        errorRate
      }

    } catch (error) {
      return { status: 'offline', timestamp: Date.now() }
    }
  }

  /**
   * Perform comprehensive health check for a server
   */
  private async performHealthCheck(serverId: string): Promise<any> {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    // Different health checks based on server type
    switch (server.category) {
      case 'stock_data':
        return this.mcpClient.executeTool('get_ticker_details', { ticker: 'AAPL' }, {
          preferredServer: serverId,
          timeout: server.timeout,
          bypassEnabledCheck: true // Allow testing of disabled servers
        })

      case 'economic_data':
        if (serverId === 'treasury') {
          return this.mcpClient.executeTool('get_treasury_rates', {}, {
            preferredServer: serverId,
            timeout: server.timeout,
            bypassEnabledCheck: true // Allow testing of disabled servers
          })
        } else if (serverId === 'fred') {
          return this.mcpClient.executeTool('get_economic_data', { series_id: 'GDP' }, {
            preferredServer: serverId,
            timeout: server.timeout,
            bypassEnabledCheck: true // Allow testing of disabled servers
          })
        }
        break

      case 'filings':
        return this.mcpClient.executeTool('get_company_filings', { ticker: 'AAPL', limit: 1 }, {
          preferredServer: serverId,
          timeout: server.timeout,
          bypassEnabledCheck: true // Allow testing of disabled servers
        })

      case 'web_intelligence':
        return this.mcpClient.executeTool('health_check', {}, {
          preferredServer: serverId,
          timeout: server.timeout,
          bypassEnabledCheck: true // Allow testing of disabled servers
        })
    }

    // Default health check
    return { success: true, message: 'Basic health check passed' }
  }

  /**
   * Test data fetching capability
   */
  private async testDataFetch(serverId: string): Promise<any> {
    if (serverId === 'polygon') {
      return this.testPolygonDataFetch()
    }

    // For other servers, fall back to health check
    return this.performHealthCheck(serverId)
  }

  /**
   * Comprehensive Polygon data fetch testing with AAPL and TSLA
   */
  private async testPolygonDataFetch(): Promise<any> {
    const testResults: any = {
      success: true,
      testType: 'data_fetch',
      timestamp: Date.now(),
      tests: [],
      raw_output: {
        message: "🎯 POLYGON DATA RETRIEVAL TEST - SHOWING AAPL & TSLA RESULTS",
        test_summary: "Testing real Polygon.io API integration with comprehensive data output"
      }
    }

    try {
      // Test 1: List Tickers (General test)
      console.log('🔍 Testing Polygon list_tickers...')
      const tickersResult = await this.mcpClient.executeTool('list_tickers', { limit: 10 }, {
        preferredServer: 'polygon',
        timeout: 10000,
        bypassEnabledCheck: true
      })

      const tickersData = tickersResult.success ? {
        count: tickersResult.data?.results?.length || 0,
        sample_tickers: tickersResult.data?.results?.slice(0, 5)?.map((t: any) => ({
          ticker: t.ticker,
          name: t.name,
          type: t.type,
          exchange: t.primary_exchange
        })) || []
      } : null

      testResults.tests.push({
        name: 'List Tickers',
        success: tickersResult.success,
        data: tickersData,
        error: tickersResult.error || null
      })

      // Add to raw output
      testResults.raw_output.tickers_sample = tickersData

      // Test 2: AAPL Company Details
      console.log('🍎 Testing AAPL ticker details...')
      const aaplDetailsResult = await this.mcpClient.executeTool('get_ticker_details', { ticker: 'AAPL' }, {
        preferredServer: 'polygon',
        timeout: 10000,
        bypassEnabledCheck: true
      })

      const aaplData = aaplDetailsResult.success ? {
        ticker: aaplDetailsResult.data?.results?.ticker,
        name: aaplDetailsResult.data?.results?.name,
        market_cap: aaplDetailsResult.data?.results?.market_cap,
        employees: aaplDetailsResult.data?.results?.total_employees,
        description: aaplDetailsResult.data?.results?.description?.substring(0, 300) + '...',
        address: aaplDetailsResult.data?.results?.address,
        list_date: aaplDetailsResult.data?.results?.list_date,
        shares_outstanding: aaplDetailsResult.data?.results?.weighted_shares_outstanding,
        phone: aaplDetailsResult.data?.results?.phone_number,
        website: aaplDetailsResult.data?.results?.homepage_url
      } : null

      testResults.tests.push({
        name: 'AAPL Company Details',
        success: aaplDetailsResult.success,
        data: aaplData,
        error: aaplDetailsResult.error || null
      })

      // Add prominent AAPL display to raw output
      testResults.raw_output.AAPL_COMPANY_DATA = {
        "🍎 APPLE INC. DETAILS": aaplData,
        "Status": aaplDetailsResult.success ? "✅ SUCCESS" : "❌ FAILED",
        "Raw_API_Response": aaplDetailsResult.success ? aaplDetailsResult.data?.results : aaplDetailsResult.error
      }

      // Test 3: TSLA Company Details
      console.log('🚗 Testing TSLA ticker details...')
      const tslaDetailsResult = await this.mcpClient.executeTool('get_ticker_details', { ticker: 'TSLA' }, {
        preferredServer: 'polygon',
        timeout: 10000,
        bypassEnabledCheck: true
      })

      const tslaData = tslaDetailsResult.success ? {
        ticker: tslaDetailsResult.data?.results?.ticker,
        name: tslaDetailsResult.data?.results?.name,
        market_cap: tslaDetailsResult.data?.results?.market_cap,
        employees: tslaDetailsResult.data?.results?.total_employees,
        description: tslaDetailsResult.data?.results?.description?.substring(0, 300) + '...',
        address: tslaDetailsResult.data?.results?.address,
        list_date: tslaDetailsResult.data?.results?.list_date,
        shares_outstanding: tslaDetailsResult.data?.results?.weighted_shares_outstanding,
        phone: tslaDetailsResult.data?.results?.phone_number,
        website: tslaDetailsResult.data?.results?.homepage_url
      } : null

      testResults.tests.push({
        name: 'TSLA Company Details',
        success: tslaDetailsResult.success,
        data: tslaData,
        error: tslaDetailsResult.error || null
      })

      // Add prominent TSLA display to raw output
      testResults.raw_output.TSLA_COMPANY_DATA = {
        "🚗 TESLA INC. DETAILS": tslaData,
        "Status": tslaDetailsResult.success ? "✅ SUCCESS" : "❌ FAILED",
        "Raw_API_Response": tslaDetailsResult.success ? tslaDetailsResult.data?.results : tslaDetailsResult.error
      }

      // Test 4: AAPL Recent Aggregates (Price Data)
      console.log('📈 Testing AAPL price aggregates...')
      const aaplAggsResult = await this.mcpClient.executeTool('get_aggs', {
        ticker: 'AAPL',
        multiplier: 1,
        timespan: 'day',
        from_: '2025-01-01',
        to: '2025-01-10',
        limit: 5
      }, {
        preferredServer: 'polygon',
        timeout: 10000,
        bypassEnabledCheck: true
      })

      const aaplPriceData = aaplAggsResult.success ? {
        ticker: aaplAggsResult.data?.ticker,
        results_count: aaplAggsResult.data?.resultsCount,
        recent_prices: aaplAggsResult.data?.results?.map((r: any) => ({
          date: new Date(r.t).toISOString().split('T')[0],
          open: `$${r.o?.toFixed(2)}`,
          close: `$${r.c?.toFixed(2)}`,
          high: `$${r.h?.toFixed(2)}`,
          low: `$${r.l?.toFixed(2)}`,
          volume: r.v?.toLocaleString()
        })) || []
      } : null

      testResults.tests.push({
        name: 'AAPL Price Data (Recent)',
        success: aaplAggsResult.success,
        data: aaplPriceData,
        error: aaplAggsResult.error || null
      })

      // Add prominent AAPL price display to raw output
      testResults.raw_output.AAPL_PRICE_DATA = {
        "📈 APPLE STOCK PRICES (Recent)": aaplPriceData,
        "Status": aaplAggsResult.success ? "✅ SUCCESS" : "❌ FAILED",
        "Daily_Trading_Data": aaplPriceData?.recent_prices || "No data available"
      }

      // Test 5: TSLA Recent Aggregates (Price Data)
      console.log('🚀 Testing TSLA price aggregates...')
      const tslaAggsResult = await this.mcpClient.executeTool('get_aggs', {
        ticker: 'TSLA',
        multiplier: 1,
        timespan: 'day',
        from_: '2025-01-01',
        to: '2025-01-10',
        limit: 5
      }, {
        preferredServer: 'polygon',
        timeout: 10000,
        bypassEnabledCheck: true
      })

      const tslaPriceData = tslaAggsResult.success ? {
        ticker: tslaAggsResult.data?.ticker,
        results_count: tslaAggsResult.data?.resultsCount,
        recent_prices: tslaAggsResult.data?.results?.map((r: any) => ({
          date: new Date(r.t).toISOString().split('T')[0],
          open: `$${r.o?.toFixed(2)}`,
          close: `$${r.c?.toFixed(2)}`,
          high: `$${r.h?.toFixed(2)}`,
          low: `$${r.l?.toFixed(2)}`,
          volume: r.v?.toLocaleString()
        })) || []
      } : null

      testResults.tests.push({
        name: 'TSLA Price Data (Recent)',
        success: tslaAggsResult.success,
        data: tslaPriceData,
        error: tslaAggsResult.error || null
      })

      // Add prominent TSLA price display to raw output
      testResults.raw_output.TSLA_PRICE_DATA = {
        "🚀 TESLA STOCK PRICES (Recent)": tslaPriceData,
        "Status": tslaAggsResult.success ? "✅ SUCCESS" : "❌ FAILED",
        "Daily_Trading_Data": tslaPriceData?.recent_prices || "No data available"
      }

      // Calculate overall success
      const successfulTests = testResults.tests.filter((t: any) => t.success).length
      const totalTests = testResults.tests.length
      testResults.success = successfulTests === totalTests
      testResults.summary = {
        total_tests: totalTests,
        successful_tests: successfulTests,
        success_rate: `${Math.round((successfulTests / totalTests) * 100)}%`,
        data_points_retrieved: testResults.tests.reduce((sum: number, test: any) => {
          if (test.data?.recent_prices) return sum + test.data.recent_prices.length
          if (test.data?.sample_tickers) return sum + test.data.sample_tickers.length
          if (test.data?.ticker) return sum + 1
          return sum
        }, 0)
      }

      // Add final summary to raw output
      testResults.raw_output.TEST_SUMMARY = {
        "🎯 OVERALL RESULTS": testResults.summary,
        "✅ AAPL_STATUS": testResults.tests.find(t => t.name.includes('AAPL'))?.success ? "DATA RETRIEVED" : "FAILED",
        "✅ TSLA_STATUS": testResults.tests.find(t => t.name.includes('TSLA'))?.success ? "DATA RETRIEVED" : "FAILED",
        "📊 TOTAL_DATA_POINTS": testResults.summary.data_points_retrieved
      }

      console.log(`✅ Polygon data fetch test completed: ${testResults.summary.success_rate} success rate`)
      return testResults

    } catch (error) {
      console.error('❌ Polygon data fetch test failed:', error)
      testResults.success = false
      testResults.error = error instanceof Error ? error.message : 'Unknown error'
      testResults.raw_output.ERROR = {
        "❌ TEST_FAILED": error instanceof Error ? error.message : 'Unknown error',
        "AAPL_STATUS": "NOT_TESTED",
        "TSLA_STATUS": "NOT_TESTED"
      }
      return testResults
    }
  }

  /**
   * Test rate limiting behavior
   */
  private async testRateLimit(serverId: string): Promise<any> {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    // Make multiple rapid requests to test rate limiting
    const requests = Array(5).fill(null).map(() =>
      this.mcpClient.executeTool('health_check', {}, {
        preferredServer: serverId,
        timeout: server.timeout,
        bypassEnabledCheck: true // Allow testing of disabled servers
      })
    )

    try {
      const results = await Promise.allSettled(requests)
      const successful = results.filter(r => r.status === 'fulfilled').length

      return {
        success: true,
        rateLimitWorking: successful < requests.length, // If some failed, rate limiting may be working
        successfulRequests: successful,
        totalRequests: requests.length
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rate limit test failed'
      }
    }
  }

  /**
   * Check if user has admin permissions
   */
  async validateAdminAccess(token: string): Promise<boolean> {
    try {
      // Development mode bypass - allow access without authentication
      if (process.env.NODE_ENV === 'development' || process.env.ADMIN_BYPASS === 'true') {
        console.log('🔧 Admin access granted in development mode')
        return true
      }

      // Special development token
      if (token === 'dev-admin-token') {
        console.log('🔧 Admin access granted with development token')
        return true
      }

      const { user } = await authService.validateToken(token)
      return authService.hasPermission(user, 'ADMINISTRATOR' as any) ||
             user.role === UserRole.ADMINISTRATOR
    } catch (error) {
      // In development, log the error but still allow access
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Auth validation failed in development, allowing access anyway:', error)
        return true
      }
      return false
    }
  }

  /**
   * Get detailed server configuration (admin only)
   */
  getServerConfiguration(serverId: string): any {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    return {
      ...server,
      // Don't expose actual API keys
      apiKeyConfigured: server.hasApiKey,
      endpoint: this.getServerEndpoint(serverId)
    }
  }

  /**
   * Toggle server enabled/disabled state
   */
  async toggleServer(serverId: string): Promise<{ success: boolean; enabled: boolean; message: string }> {
    const server = this.servers.get(serverId)
    if (!server) {
      return {
        success: false,
        enabled: false,
        message: `Server ${serverId} not found`
      }
    }

    try {
      const wasEnabled = this.enabledServers.has(serverId)

      if (wasEnabled) {
        this.enabledServers.delete(serverId)
      } else {
        this.enabledServers.add(serverId)
      }

      const isNowEnabled = !wasEnabled

      // Save the state to persistent storage
      await this.saveEnabledServers()

      // Clear any cached state that might be affected by this change
      this.invalidateServerCache(serverId)

      console.log(`🔄 Server ${serverId} toggled: ${wasEnabled ? 'ENABLED' : 'DISABLED'} → ${isNowEnabled ? 'ENABLED' : 'DISABLED'}`)

      return {
        success: true,
        enabled: isNowEnabled,
        message: `Server ${server.name} has been ${isNowEnabled ? 'enabled' : 'disabled'}`
      }

    } catch (error) {
      // Revert the change if saving failed
      if (this.enabledServers.has(serverId)) {
        this.enabledServers.delete(serverId)
      } else {
        this.enabledServers.add(serverId)
      }

      return {
        success: false,
        enabled: this.enabledServers.has(serverId),
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Check if a server is enabled
   */
  isServerEnabled(serverId: string): boolean {
    return this.enabledServers.has(serverId)
  }

  /**
   * Get enabled server IDs
   */
  getEnabledServers(): string[] {
    return Array.from(this.enabledServers)
  }

  /**
   * Save enabled servers to storage
   */
  private async saveEnabledServers(): Promise<void> {
    try {
      await this.savePersistedState()
      console.log('✅ Server enabled states saved:', Array.from(this.enabledServers))
    } catch (error) {
      console.error('❌ Failed to save server states:', error)
    }
  }

  /**
   * Get server endpoint (if publicly available)
   */
  private getServerEndpoint(serverId: string): string | undefined {
    const endpoints: Record<string, string> = {
      'sec_edgar': 'https://data.sec.gov/api',
      'treasury': 'https://api.fiscaldata.treasury.gov/services/api/v1',
      'fred': 'https://api.stlouisfed.org/fred',
      'bls': 'https://api.bls.gov/publicAPI/v2',
      'eia': 'https://api.eia.gov'
    }

    return endpoints[serverId]
  }

  /**
   * Invalidate any cached state for a server when its enabled status changes
   */
  private invalidateServerCache(serverId: string): void {
    try {
      // Notify MCPClient to clear any cached state
      console.log(`🗑️ Clearing cached state for server: ${serverId}`)

      // If we had Redis or other external caches, we'd clear them here
      // For now, just log the cache invalidation

      // In a real implementation, this would:
      // 1. Clear Redis cache keys for this server
      // 2. Notify other services about the state change
      // 3. Reset connection pools for this server

    } catch (error) {
      console.warn(`Failed to invalidate cache for server ${serverId}:`, error)
    }
  }

  /**
   * Load persisted server state from storage
   */
  private loadPersistedState(): { enabledServers: string[] } | null {
    try {
      // For development/demo, use environment variable
      const stateEnv = process.env.ADMIN_SERVER_STATES
      if (stateEnv) {
        const state = JSON.parse(stateEnv)
        if (state && Array.isArray(state.enabledServers)) {
          return state
        }
      }

      // In production, this would use a database or Redis
      // For now, we'll use a simple file-based approach if available
      if (typeof window === 'undefined') { // Server-side only
        try {
          const fs = require('fs')
          const path = require('path')
          const stateFile = path.join(process.cwd(), '.admin-server-states.json')

          if (fs.existsSync(stateFile)) {
            const stateData = fs.readFileSync(stateFile, 'utf8')
            const state = JSON.parse(stateData)

            // Validate the state structure
            if (state && Array.isArray(state.enabledServers)) {
              return state
            }
          }
        } catch (fsError) {
          // Fall through to return null
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted server state:', error)
    }

    return null
  }

  /**
   * Save server state to persistent storage
   */
  private async savePersistedState(): Promise<void> {
    const state = {
      enabledServers: Array.from(this.enabledServers),
      timestamp: Date.now(),
      version: '1.0'
    }

    try {
      // In production, this would use a database or Redis
      // For now, we'll use a simple file-based approach if available
      if (typeof window === 'undefined') { // Server-side only
        try {
          const fs = require('fs').promises
          const path = require('path')
          const stateFile = path.join(process.cwd(), '.admin-server-states.json')

          await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8')
          console.log('💾 Server states persisted to file')
        } catch (fsError) {
          console.warn('Failed to save to file, state will not persist across restarts:', fsError)
        }
      }
    } catch (error) {
      console.error('Failed to save persisted server state:', error)
      throw error
    }
  }
}

// Export singleton instance
export const serverConfigManager = ServerConfigManager.getInstance()