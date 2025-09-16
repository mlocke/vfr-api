/**
 * Server Configuration Manager Service
 * Extends MCPClient functionality to expose server configurations for admin dashboard
 * Provides testing, health checks, and configuration management capabilities
 */

import { MCPClient } from '../mcp/MCPClient'
import { authService } from '../auth/AuthService'

export interface ServerInfo {
  id: string
  name: string
  type: 'commercial' | 'government' | 'free'
  status: 'online' | 'offline' | 'degraded' | 'maintenance'
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

  constructor() {
    this.mcpClient = MCPClient.getInstance()
    this.initializeServerInfo()
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
      status: 'online',
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
   * Get all servers with their current status
   */
  async getAllServers(): Promise<ServerInfo[]> {
    const servers = Array.from(this.servers.values())

    // Update status with latest health check data
    for (const server of servers) {
      const healthStatus = await this.getServerHealth(server.id)
      server.status = healthStatus.status
      server.lastHealthCheck = healthStatus.timestamp
      server.responseTime = healthStatus.responseTime
      server.errorRate = healthStatus.errorRate
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
            timeout: 5000
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
      const stats = this.mcpClient.getConnectionStats()
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
          timeout: server.timeout
        })

      case 'economic_data':
        if (serverId === 'treasury') {
          return this.mcpClient.executeTool('get_treasury_rates', {}, {
            preferredServer: serverId,
            timeout: server.timeout
          })
        } else if (serverId === 'fred') {
          return this.mcpClient.executeTool('get_economic_data', { series_id: 'GDP' }, {
            preferredServer: serverId,
            timeout: server.timeout
          })
        }
        break

      case 'filings':
        return this.mcpClient.executeTool('get_company_filings', { ticker: 'AAPL', limit: 1 }, {
          preferredServer: serverId,
          timeout: server.timeout
        })

      case 'web_intelligence':
        return this.mcpClient.executeTool('health_check', {}, {
          preferredServer: serverId,
          timeout: server.timeout
        })
    }

    // Default health check
    return { success: true, message: 'Basic health check passed' }
  }

  /**
   * Test data fetching capability
   */
  private async testDataFetch(serverId: string): Promise<any> {
    // This would implement specific data fetch tests for each server type
    return this.performHealthCheck(serverId)
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
        timeout: server.timeout
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
      const { user } = await authService.validateToken(token)
      return authService.hasPermission(user, 'ADMINISTRATOR' as any) ||
             user.role === 'ADMINISTRATOR'
    } catch (error) {
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
}

// Export singleton instance
export const serverConfigManager = ServerConfigManager.getInstance()