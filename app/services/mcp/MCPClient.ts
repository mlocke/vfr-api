/**
 * Unified MCP Client Service
 * Handles connections to multiple MCP servers with intelligent routing and error handling
 */

interface MCPServerConfig {
  name: string
  endpoint?: string
  apiKey?: string
  rateLimit: number // requests per minute
  timeout: number // milliseconds
  retryAttempts: number
}

interface MCPResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  source: string
  timestamp: number
  cached?: boolean
}

interface ConnectionStats {
  connected: boolean
  lastConnected?: number
  requestCount: number
  errorCount: number
  avgResponseTime: number
}

export class MCPClient {
  private static instance: MCPClient
  private servers: Map<string, MCPServerConfig> = new Map()
  private connections: Map<string, ConnectionStats> = new Map()
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()
  private requestQueue: Map<string, Promise<any>> = new Map()

  constructor() {
    this.initializeServers()
    this.startHealthChecks()
  }

  static getInstance(): MCPClient {
    if (!MCPClient.instance) {
      MCPClient.instance = new MCPClient()
    }
    return MCPClient.instance
  }

  private initializeServers() {
    // Polygon.io MCP Server Configuration
    this.servers.set('polygon', {
      name: 'Polygon.io MCP',
      apiKey: process.env.POLYGON_API_KEY,
      rateLimit: 1000, // requests per minute
      timeout: 5000,
      retryAttempts: 3
    })

    // Alpha Vantage MCP Server Configuration
    this.servers.set('alphavantage', {
      name: 'Alpha Vantage MCP',
      apiKey: process.env.ALPHA_VANTAGE_API_KEY,
      rateLimit: 500, // free tier: 500 per day, premium: unlimited
      timeout: 10000,
      retryAttempts: 2
    })

    // Financial Modeling Prep MCP Server Configuration
    this.servers.set('fmp', {
      name: 'Financial Modeling Prep MCP',
      apiKey: process.env.FMP_API_KEY,
      rateLimit: 250, // requests per minute
      timeout: 8000,
      retryAttempts: 3
    })

    // Firecrawl MCP Server Configuration
    this.servers.set('firecrawl', {
      name: 'Firecrawl MCP',
      apiKey: process.env.FIRECRAWL_API_KEY,
      rateLimit: 100, // requests per minute
      timeout: 15000,
      retryAttempts: 2
    })

    // Initialize connection stats
    this.servers.forEach((config, serverId) => {
      this.connections.set(serverId, {
        connected: false,
        requestCount: 0,
        errorCount: 0,
        avgResponseTime: 0
      })
    })
  }

  /**
   * Execute MCP tool with intelligent server routing
   */
  async executeTool<T = any>(
    toolName: string, 
    params: Record<string, any> = {},
    options: {
      preferredServer?: string
      cacheTTL?: number
      priority?: 'high' | 'medium' | 'low'
      timeout?: number
    } = {}
  ): Promise<MCPResponse<T>> {
    const startTime = Date.now()
    const cacheKey = `${toolName}:${JSON.stringify(params)}`
    
    // Check cache first
    if (options.cacheTTL && options.cacheTTL > 0) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return {
          success: true,
          data: cached,
          source: 'cache',
          timestamp: Date.now(),
          cached: true
        }
      }
    }

    // Determine best server for this tool
    const serverId = options.preferredServer || this.selectOptimalServer(toolName)
    const server = this.servers.get(serverId)
    
    if (!server) {
      return {
        success: false,
        error: `Server ${serverId} not configured`,
        source: serverId,
        timestamp: Date.now()
      }
    }

    try {
      // Check if we should queue this request
      const queueKey = `${serverId}:${toolName}`
      if (this.requestQueue.has(queueKey)) {
        console.log(`⏳ Deduplicating request: ${queueKey}`)
        const result = await this.requestQueue.get(queueKey)
        return result
      }

      // Execute the MCP tool
      const requestPromise = this.makeRequest(serverId, toolName, params, options.timeout)
      this.requestQueue.set(queueKey, requestPromise)

      const result = await requestPromise
      this.requestQueue.delete(queueKey)

      // Update connection stats
      const stats = this.connections.get(serverId)!
      stats.requestCount++
      stats.avgResponseTime = (stats.avgResponseTime + (Date.now() - startTime)) / 2
      stats.connected = true
      stats.lastConnected = Date.now()

      // Cache the result if requested
      if (options.cacheTTL && options.cacheTTL > 0 && result.success) {
        this.setCache(cacheKey, result.data, options.cacheTTL)
      }

      return {
        ...result,
        source: serverId,
        timestamp: Date.now()
      }

    } catch (error) {
      this.requestQueue.delete(`${serverId}:${toolName}`)
      
      // Update error stats
      const stats = this.connections.get(serverId)!
      stats.errorCount++
      stats.connected = false

      console.error(`❌ MCP ${serverId} error for ${toolName}:`, error)

      // Try fallback server if available
      const fallbackServer = this.getFallbackServer(serverId, toolName)
      if (fallbackServer && fallbackServer !== serverId) {
        console.log(`🔄 Trying fallback server: ${fallbackServer}`)
        return this.executeTool(toolName, params, { 
          ...options, 
          preferredServer: fallbackServer 
        })
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown MCP error',
        source: serverId,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Make the actual MCP request
   * This is where we'll integrate with the actual MCP client libraries
   */
  private async makeRequest(
    serverId: string, 
    toolName: string, 
    params: Record<string, any>,
    timeout?: number
  ): Promise<MCPResponse> {
    const server = this.servers.get(serverId)!
    const requestTimeout = timeout || server.timeout

    // For now, we'll create a mock implementation that can be replaced with real MCP calls
    // In production, this would use the actual MCP client libraries
    
    switch (serverId) {
      case 'polygon':
        return this.executePolygonTool(toolName, params, requestTimeout)
      
      case 'alphavantage':
        return this.executeAlphaVantageTool(toolName, params, requestTimeout)
      
      case 'fmp':
        return this.executeFMPTool(toolName, params, requestTimeout)
      
      case 'firecrawl':
        return this.executeFirecrawlTool(toolName, params, requestTimeout)
      
      default:
        throw new Error(`Unsupported server: ${serverId}`)
    }
  }

  /**
   * Polygon.io MCP Tool Execution
   */
  private async executePolygonTool(
    toolName: string, 
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing Polygon MCP tool: ${toolName}`, params)
    
    try {
      // In production, these would call the actual MCP polygon tools
      // For now, we simulate the call and return structured mock data
      
      let result: any
      
      switch (toolName) {
        case 'list_tickers':
          // Simulate Polygon list_tickers response
          result = {
            results: [
              { ticker: 'AAPL', name: 'Apple Inc.', primary_exchange: 'NASDAQ', type: 'CS' },
              { ticker: 'MSFT', name: 'Microsoft Corporation', primary_exchange: 'NASDAQ', type: 'CS' },
              { ticker: 'GOOGL', name: 'Alphabet Inc.', primary_exchange: 'NASDAQ', type: 'CS' }
            ],
            status: 'OK',
            count: 3
          }
          break
          
        case 'get_ticker_details':
          // Simulate Polygon ticker details response
          result = {
            results: {
              ticker: params.ticker,
              name: `${params.ticker} Company`,
              market_cap: Math.floor(Math.random() * 1000000000000),
              sic_description: 'Technology',
              active: true
            },
            status: 'OK'
          }
          break
          
        case 'get_aggs':
          // Simulate Polygon aggregates response
          result = {
            results: [{
              o: 150 + Math.random() * 50,
              c: 150 + Math.random() * 50,
              h: 160 + Math.random() * 40,
              l: 140 + Math.random() * 40,
              v: Math.floor(Math.random() * 10000000),
              t: Date.now()
            }],
            status: 'OK'
          }
          break
          
        default:
          throw new Error(`Unsupported Polygon MCP tool: ${toolName}`)
      }
      
      return {
        success: true,
        data: result,
        source: 'polygon',
        timestamp: Date.now()
      }
      
    } catch (error) {
      console.error(`❌ Polygon MCP error for ${toolName}:`, error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Polygon MCP tool execution failed',
        source: 'polygon',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Alpha Vantage MCP Tool Execution
   */
  private async executeAlphaVantageTool(
    toolName: string, 
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    // TODO: Replace with actual Alpha Vantage MCP client
    console.log(`🔌 Executing Alpha Vantage MCP tool: ${toolName}`, params)
    
    await new Promise(resolve => setTimeout(resolve, 150))
    
    return {
      success: true,
      data: { 
        mock: true, 
        tool: toolName, 
        params,
        message: 'Alpha Vantage MCP integration pending - using mock data'
      },
      source: 'alphavantage',
      timestamp: Date.now()
    }
  }

  /**
   * Financial Modeling Prep MCP Tool Execution
   */
  private async executeFMPTool(
    toolName: string, 
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    // TODO: Replace with actual FMP MCP client
    console.log(`🔌 Executing FMP MCP tool: ${toolName}`, params)
    
    await new Promise(resolve => setTimeout(resolve, 120))
    
    return {
      success: true,
      data: { 
        mock: true, 
        tool: toolName, 
        params,
        message: 'FMP MCP integration pending - using mock data'
      },
      source: 'fmp',
      timestamp: Date.now()
    }
  }

  /**
   * Firecrawl MCP Tool Execution
   */
  private async executeFirecrawlTool(
    toolName: string, 
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing Firecrawl MCP tool: ${toolName}`, params)
    
    try {
      // In production, these would call the actual MCP firecrawl tools
      // For now, we simulate the call and return structured mock data
      
      let result: any
      
      switch (toolName) {
        case 'firecrawl_search':
          // Simulate Firecrawl search response
          result = {
            results: [
              {
                title: `${params.query} - Financial News Article`,
                description: `Latest news about ${params.query} market developments and analysis`,
                url: 'https://example.com/news/1',
                markdown: `# ${params.query} Market Update\n\nRecent developments in the ${params.query} sector show positive trends...`,
                source: 'Financial Times'
              },
              {
                title: `${params.query} Sector Analysis`,
                description: `Comprehensive analysis of ${params.query} investment opportunities`,
                url: 'https://example.com/analysis/1',
                markdown: `# ${params.query} Investment Outlook\n\nAnalysts are bullish on ${params.query} stocks...`,
                source: 'Market Watch'
              }
            ],
            status: 'success',
            total: 2
          }
          break
          
        case 'firecrawl_scrape':
          // Simulate Firecrawl scrape response
          result = {
            data: {
              markdown: `# Web Page Content\n\nScraped content from ${params.url}`,
              title: 'Financial News Page',
              description: 'Latest financial market updates and analysis'
            },
            status: 'success'
          }
          break
          
        default:
          throw new Error(`Unsupported Firecrawl MCP tool: ${toolName}`)
      }
      
      return {
        success: true,
        data: result,
        source: 'firecrawl',
        timestamp: Date.now()
      }
      
    } catch (error) {
      console.error(`❌ Firecrawl MCP error for ${toolName}:`, error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Firecrawl MCP tool execution failed',
        source: 'firecrawl',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Select the optimal server for a given tool
   */
  private selectOptimalServer(toolName: string): string {
    // Tool to server mapping based on capabilities
    const toolServerMap: Record<string, string[]> = {
      // Stock data tools
      'get_ticker_details': ['polygon', 'alphavantage', 'fmp'],
      'list_tickers': ['polygon', 'fmp'],
      'get_aggs': ['polygon', 'alphavantage'],
      'get_daily_open_close': ['polygon', 'alphavantage'],
      
      // Technical analysis tools
      'technical_indicators': ['alphavantage', 'polygon'],
      'moving_averages': ['alphavantage'],
      'rsi': ['alphavantage'],
      'macd': ['alphavantage'],
      
      // Fundamental data tools
      'company_profile': ['fmp', 'alphavantage'],
      'financial_statements': ['fmp', 'alphavantage'],
      'analyst_ratings': ['fmp'],
      'insider_trading': ['fmp'],
      
      // News and sentiment tools
      'news_sentiment': ['alphavantage', 'firecrawl'],
      'market_news': ['firecrawl', 'alphavantage'],
      'scrape_content': ['firecrawl'],
      
      // Market data tools
      'market_status': ['polygon', 'alphavantage'],
      'market_holidays': ['polygon'],
      'sector_performance': ['alphavantage', 'fmp']
    }

    const possibleServers = toolServerMap[toolName] || ['polygon', 'alphavantage', 'fmp']
    
    // Select the server with best connection stats
    return possibleServers.reduce((best, serverId) => {
      const stats = this.connections.get(serverId)
      const bestStats = this.connections.get(best)
      
      if (!stats) return best
      if (!bestStats) return serverId
      
      // Prefer connected servers with lower error rates
      if (stats.connected && !bestStats.connected) return serverId
      if (bestStats.connected && !stats.connected) return best
      
      const errorRate = stats.errorCount / Math.max(stats.requestCount, 1)
      const bestErrorRate = bestStats.errorCount / Math.max(bestStats.requestCount, 1)
      
      return errorRate < bestErrorRate ? serverId : best
    }, possibleServers[0])
  }

  /**
   * Get fallback server for failed requests
   */
  private getFallbackServer(failedServer: string, toolName: string): string | null {
    const toolServerMap: Record<string, string[]> = {
      'get_ticker_details': ['polygon', 'alphavantage', 'fmp'],
      'get_aggs': ['polygon', 'alphavantage'],
      'company_profile': ['fmp', 'alphavantage'],
      'news_sentiment': ['alphavantage', 'firecrawl']
    }

    const possibleServers = toolServerMap[toolName] || []
    const alternatives = possibleServers.filter(s => s !== failedServer)
    
    return alternatives.length > 0 ? alternatives[0] : null
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }

  private setCache(key: string, data: any, ttl: number) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * Health checks and monitoring
   */
  private startHealthChecks() {
    // Check server health every 30 seconds
    setInterval(() => {
      this.performHealthChecks()
    }, 30000)
  }

  private async performHealthChecks() {
    console.log('🔍 Performing MCP server health checks...')
    
    this.servers.forEach(async (config, serverId) => {
      try {
        // Simple health check - get server status
        await this.executeTool('health_check', {}, { 
          preferredServer: serverId,
          timeout: 3000 
        })
      } catch (error) {
        console.warn(`⚠️ Health check failed for ${serverId}:`, error)
      }
    })
  }

  /**
   * Get connection statistics
   */
  getStats(): Record<string, ConnectionStats> {
    const stats: Record<string, ConnectionStats> = {}
    this.connections.forEach((stat, serverId) => {
      stats[serverId] = { ...stat }
    })
    return stats
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear()
    console.log('🧹 MCP cache cleared')
  }
}

// Export singleton instance
export const mcpClient = MCPClient.getInstance()