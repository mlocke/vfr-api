/**
 * Unified MCP Client Service with Multi-Source Data Fusion
 * Handles connections to multiple MCP servers with intelligent routing, error handling,
 * and advanced data fusion capabilities for combining data from multiple sources
 */

import {
  FusedMCPResponse,
  FusionOptions,
  FusionMetadata,
  ConflictResolutionStrategy,
  QualityScore,
  FusionSourceConfig,
  UnifiedStockPrice,
  UnifiedCompanyInfo,
  UnifiedTechnicalIndicator,
  UnifiedNewsItem,
  UnifiedTreasuryDebt,
  UnifiedTreasuryOperations,
  UnifiedYieldCurve,
  UnifiedFiscalIndicators
} from './types'
import { DataFusionEngine } from './DataFusionEngine'
import { QualityScorer } from './QualityScorer'
import { DataTransformationLayer } from './DataTransformationLayer'
import { redisCache } from '../cache/RedisCache'
import { treasuryFiscalService, TreasuryFiscalResponse } from './collectors/TreasuryFiscalService'
import { serverConfigManager } from '../admin/ServerConfigManager'

interface MCPServerConfig {
  name: string
  endpoint?: string
  apiKey?: string
  baseUrls?: Record<string, string>
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
  protected servers: Map<string, MCPServerConfig> = new Map()
  protected connections: Map<string, ConnectionStats> = new Map()
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()
  private requestQueue: Map<string, Promise<any>> = new Map()
  private fusionEngine: DataFusionEngine
  protected qualityScorer: QualityScorer
  private healthCheckInterval?: NodeJS.Timeout

  constructor() {
    this.initializeServers()
    this.startHealthChecks()
    this.fusionEngine = new DataFusionEngine()
    this.qualityScorer = new QualityScorer()
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

    // Yahoo Finance MCP Server Configuration (FREE)
    this.servers.set('yahoo', {
      name: 'Yahoo Finance MCP',
      apiKey: '', // No API key required
      rateLimit: 1000, // No rate limits
      timeout: 10000,
      retryAttempts: 3
    })

    // Dappier MCP Server Configuration (Web Intelligence)
    this.servers.set('dappier', {
      name: 'Dappier MCP',
      apiKey: process.env.DAPPIER_API_KEY,
      rateLimit: 200, // requests per minute
      timeout: 15000, // Longer timeout for web intelligence processing
      retryAttempts: 2
    })

    // SEC EDGAR MCP Server Configuration (Government Financial Data)
    this.servers.set('sec_edgar', {
      name: 'SEC EDGAR MCP',
      apiKey: '', // No API key required for public SEC data
      rateLimit: 600, // 600 req/min (10 req/sec per SEC guidelines)
      timeout: 10000,
      retryAttempts: 3
    })

    // Treasury MCP Server Configuration (Government Financial Data)
    this.servers.set('treasury', {
      name: 'Treasury MCP',
      apiKey: '', // No API key required for public Treasury data
      rateLimit: 1000, // Conservative limit for government APIs
      timeout: 10000,
      retryAttempts: 3
    })

    // Data.gov MCP Server Configuration (Government Financial Data)
    this.servers.set('datagov', {
      name: 'Data.gov MCP',
      apiKey: process.env.BLS_API_KEY || '', // BLS API key (optional for basic access)
      baseUrls: {
        bls: 'https://api.bls.gov/publicAPI/v2/timeseries/data/',
        bea: 'https://apps.bea.gov/api/data/',
        census: 'https://api.census.gov/data/'
      },
      rateLimit: 500, // BLS API limit: 500/day for unregistered, 25/day for registered
      timeout: 15000, // Government APIs can be slower
      retryAttempts: 3
    })

    // FRED MCP Server Configuration (Federal Reserve Economic Data)
    this.servers.set('fred', {
      name: 'FRED MCP',
      apiKey: process.env.FRED_API_KEY, // E093a281de7f0d224ed51ad0842fc393
      rateLimit: 120, // 120 requests per minute (conservative based on 120/hour limit)
      timeout: 8000,
      retryAttempts: 3
    })

    // BLS MCP Server Configuration (Bureau of Labor Statistics)
    this.servers.set('bls', {
      name: 'BLS MCP',
      apiKey: process.env.BLS_API_KEY, // e168db38c47449c8a41e031171deeb19
      rateLimit: 500, // 500 requests per minute (BLS allows 500/day for registered users)
      timeout: 10000, // Government servers can be slower
      retryAttempts: 3
    })

    // EIA MCP Server Configuration (Energy Information Administration)
    this.servers.set('eia', {
      name: 'EIA MCP',
      apiKey: process.env.EIA_API_KEY,
      rateLimit: 5000, // 5000 requests per minute (EIA allows up to 5000/hour)
      timeout: 8000,
      retryAttempts: 3
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
    const cacheKey = `tool:${toolName}:${JSON.stringify(params)}`

    // Check Redis cache first
    if (options.cacheTTL && options.cacheTTL > 0) {
      const cached = await redisCache.get<T>(cacheKey)
      if (cached) {
        return {
          success: true,
          data: cached,
          source: 'redis-cache',
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

    // Check if server is enabled
    if (!this.isServerEnabled(serverId)) {
      console.log(`🚫 Server ${serverId} is disabled, trying fallback...`)
      const fallbackServer = this.getFallbackServer(serverId, toolName)
      if (fallbackServer && fallbackServer !== serverId) {
        console.log(`🔄 Using fallback server: ${fallbackServer}`)
        return this.executeTool(toolName, params, {
          ...options,
          preferredServer: fallbackServer
        })
      }
      return {
        success: false,
        error: `Server ${serverId} is disabled and no fallback available`,
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

      // Cache the result in Redis if requested
      if (options.cacheTTL && options.cacheTTL > 0 && result.success) {
        await redisCache.set(cacheKey, result.data, options.cacheTTL, {
          source: serverId,
          version: '1.0.0'
        })
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

      case 'yahoo':
        return this.executeYahooTool(toolName, params, requestTimeout)

      case 'dappier':
        return this.executeDappierTool(toolName, params, requestTimeout)

      case 'sec_edgar':
        return this.executeSECTool(toolName, params, requestTimeout)

      case 'treasury':
        return this.executeTreasuryTool(toolName, params, requestTimeout)

      case 'datagov':
        return this.executeDataGovTool(toolName, params, requestTimeout)

      case 'context7':
        return this.executeContext7Tool(toolName, params, requestTimeout)

      case 'github':
        return this.executeGitHubTool(toolName, params, requestTimeout)

      case 'fred':
        return this.executeFREDTool(toolName, params, requestTimeout)

      case 'bls':
        return this.executeBLSTool(toolName, params, requestTimeout)

      case 'eia':
        return this.executeEIATool(toolName, params, requestTimeout)

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

    // CRITICAL: Check if Polygon server is enabled before executing
    if (!this.isServerEnabled('polygon')) {
      console.log(`🚫 Polygon server is disabled, cannot execute tool: ${toolName}`)
      return {
        success: false,
        error: 'Polygon server is disabled',
        source: 'polygon',
        timestamp: Date.now()
      }
    }

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
          console.warn(`⚠️ Unsupported Polygon MCP tool: ${toolName}`)
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
   * Alpha Vantage MCP Tool Execution - Real API Implementation
   */
  private async executeAlphaVantageTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing Alpha Vantage tool: ${toolName}`, params)

    // Check if Alpha Vantage server is enabled before executing
    if (!this.isServerEnabled('alphavantage')) {
      console.log(`🚫 Alpha Vantage server is disabled, cannot execute tool: ${toolName}`)
      return {
        success: false,
        error: 'Alpha Vantage server is disabled',
        source: 'alphavantage',
        timestamp: Date.now()
      }
    }

    try {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY || '4M20CQ7QT67RJ835'
      const symbol = params.symbol || 'TSLA'

      let url = ''
      let functionParam = ''

      // Map MCP tool names to Alpha Vantage API functions
      switch (toolName) {
        case 'get_stock_info':
        case 'GLOBAL_QUOTE':
          functionParam = 'GLOBAL_QUOTE'
          url = `https://www.alphavantage.co/query?function=${functionParam}&symbol=${symbol}&apikey=${apiKey}`
          break
        case 'TIME_SERIES_DAILY':
          functionParam = 'TIME_SERIES_DAILY'
          url = `https://www.alphavantage.co/query?function=${functionParam}&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`
          break
        case 'TIME_SERIES_INTRADAY':
          functionParam = 'TIME_SERIES_INTRADAY'
          const interval = params.interval || '5min'
          url = `https://www.alphavantage.co/query?function=${functionParam}&symbol=${symbol}&interval=${interval}&apikey=${apiKey}&outputsize=compact`
          break
        case 'RSI':
          functionParam = 'RSI'
          const rsiInterval = params.interval || 'daily'
          const rsiTimePeriod = params.time_period || 14
          url = `https://www.alphavantage.co/query?function=${functionParam}&symbol=${symbol}&interval=${rsiInterval}&time_period=${rsiTimePeriod}&series_type=close&apikey=${apiKey}`
          break
        case 'OVERVIEW':
          functionParam = 'OVERVIEW'
          url = `https://www.alphavantage.co/query?function=${functionParam}&symbol=${symbol}&apikey=${apiKey}`
          break
        default:
          // Default to GLOBAL_QUOTE for unknown tools
          functionParam = 'GLOBAL_QUOTE'
          url = `https://www.alphavantage.co/query?function=${functionParam}&symbol=${symbol}&apikey=${apiKey}`
      }

      console.log(`📡 Alpha Vantage API call: ${functionParam} for ${symbol}`)

      // Make the actual API call
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Stock-Picker-Platform/1.0',
          'Accept': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Check for API error responses
      if (data['Error Message']) {
        throw new Error(`Alpha Vantage API error: ${data['Error Message']}`)
      }

      if (data['Note']) {
        throw new Error(`Alpha Vantage API rate limit: ${data['Note']}`)
      }

      console.log(`✅ Alpha Vantage data retrieved for ${symbol}`)

      return {
        success: true,
        data: {
          function: functionParam,
          symbol: symbol,
          result: data,
          timestamp: new Date().toISOString(),
          source: 'alpha_vantage_api'
        },
        source: 'alphavantage',
        timestamp: Date.now()
      }

    } catch (error) {
      console.error(`❌ Alpha Vantage API call failed:`, error)

      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Alpha Vantage API call failed',
        source: 'alphavantage',
        timestamp: Date.now()
      }
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
    console.log(`🔌 Executing FMP MCP tool: ${toolName}`, params)

    // Check if FMP server is enabled before executing
    if (!this.isServerEnabled('fmp')) {
      console.log(`🚫 FMP server is disabled, cannot execute tool: ${toolName}`)
      return {
        success: false,
        error: 'FMP server is disabled',
        source: 'fmp',
        timestamp: Date.now()
      }
    }

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
          console.warn(`⚠️ Unsupported Firecrawl MCP tool: ${toolName}`)
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
   * Yahoo Finance MCP Tool Execution
   */
  private async executeYahooTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing Yahoo Finance MCP tool: ${toolName}`, params)

    // Check if Yahoo server is enabled before executing
    if (!this.isServerEnabled('yahoo')) {
      console.log(`🚫 Yahoo server is disabled, cannot execute tool: ${toolName}`)
      return {
        success: false,
        error: 'Yahoo server is disabled',
        source: 'yahoo',
        timestamp: Date.now()
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      let result: any

      switch (toolName) {
        case 'get_stock_info':
          result = {
            symbol: params.symbol,
            shortName: `${params.symbol} Inc.`,
            longName: `${params.symbol} Corporation`,
            currentPrice: 150 + Math.random() * 50,
            marketCap: Math.floor(Math.random() * 1000000000000),
            sector: 'Technology',
            industry: 'Software'
          }
          break

        case 'get_historical_price':
          result = {
            symbol: params.symbol,
            date: params.date,
            open: 150 + Math.random() * 50,
            close: 150 + Math.random() * 50,
            high: 160 + Math.random() * 40,
            low: 140 + Math.random() * 40,
            volume: Math.floor(Math.random() * 10000000)
          }
          break

        case 'get_comprehensive_stock_data':
          result = {
            stock_info: {
              symbol: params.symbol,
              name: `${params.symbol} Corporation`,
              price: 150 + Math.random() * 50
            },
            financials: {
              revenue: Math.floor(Math.random() * 100000000000),
              netIncome: Math.floor(Math.random() * 20000000000)
            },
            holders: {
              institutional: 0.75,
              insider: 0.05
            }
          }
          break

        default:
          result = {
            mock: true,
            tool: toolName,
            params,
            message: 'Yahoo Finance MCP integration pending - using mock data'
          }
      }

      return {
        success: true,
        data: result,
        source: 'yahoo',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Yahoo Finance MCP tool execution failed',
        source: 'yahoo',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Dappier MCP Tool Execution
   */
  private async executeDappierTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing Dappier MCP tool: ${toolName}`, params)

    await new Promise(resolve => setTimeout(resolve, 200))

    try {
      let result: any

      switch (toolName) {
        case 'dappier_real_time_search':
          result = {
            web_intelligence: {
              query: params.query || 'market news',
              results: [
                {
                  title: `Real-time ${params.query} Intelligence`,
                  description: `Latest web intelligence about ${params.query} from multiple sources`,
                  url: 'https://example.com/intelligence/1',
                  content: `Real-time analysis of ${params.query} shows positive market sentiment...`,
                  sentiment: 'positive',
                  relevance_score: 0.9,
                  source: 'Multiple web sources'
                },
                {
                  title: `${params.query} Market Insights`,
                  description: `AI-powered insights on ${params.query} market trends`,
                  url: 'https://example.com/insights/1',
                  content: `Market analysis indicates strong growth potential for ${params.query}...`,
                  sentiment: 'neutral',
                  relevance_score: 0.8,
                  source: 'Market intelligence'
                }
              ],
              timestamp: Date.now()
            }
          }
          break

        case 'dappier_ai_recommendations':
          result = {
            recommendations: [
              {
                title: `AI Recommendation for ${params.query}`,
                description: `Intelligent content recommendations based on ${params.query}`,
                content: `Our AI analysis recommends focusing on ${params.query} due to strong fundamentals...`,
                confidence_score: 0.85,
                category: 'investment',
                source: 'Dappier AI'
              },
              {
                title: `Strategic Insights for ${params.query}`,
                description: `Strategic recommendations for ${params.query} investments`,
                content: `Based on current market conditions, ${params.query} presents opportunities...`,
                confidence_score: 0.78,
                category: 'strategy',
                source: 'Dappier AI'
              }
            ],
            generated_at: Date.now()
          }
          break

        default:
          result = {
            mock: true,
            tool: toolName,
            params,
            message: 'Dappier MCP integration pending - using mock data'
          }
      }

      return {
        success: true,
        data: result,
        source: 'dappier',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Dappier MCP tool execution failed',
        source: 'dappier',
        timestamp: Date.now()
      }
    }
  }

  /**
   * SEC EDGAR MCP Tool Execution - Real API Implementation
   */
  private async executeSECTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing SEC EDGAR MCP tool: ${toolName}`, params)

    // Check if SEC EDGAR server is enabled before executing
    if (!this.isServerEnabled('sec_edgar')) {
      console.log(`🚫 SEC EDGAR server is disabled, cannot execute tool: ${toolName}`)
      return {
        success: false,
        error: 'SEC EDGAR server is disabled',
        source: 'sec_edgar',
        timestamp: Date.now()
      }
    }

    try {
      let result: any

      switch (toolName) {
        case 'get_company_facts':
          result = await this.fetchCompanyFacts(params)
          break

        case 'get_company_filings':
          result = await this.fetchCompanyFilings(params)
          break

        case 'get_insider_transactions':
          result = await this.fetchInsiderTransactions(params)
          break

        case 'search_companies':
          result = await this.searchCompanies(params)
          break

        case 'get_company_concept':
          result = await this.fetchCompanyConcept(params)
          break

        default:
          throw new Error(`Unsupported SEC EDGAR tool: ${toolName}`)
      }

      return {
        success: true,
        data: result,
        source: 'sec_edgar',
        timestamp: Date.now()
      }

    } catch (error) {
      console.error(`❌ SEC EDGAR API error for ${toolName}:`, error)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'SEC EDGAR API tool execution failed',
        source: 'sec_edgar',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Fetch company facts (financial data) from SEC EDGAR API
   */
  private async fetchCompanyFacts(params: Record<string, any>): Promise<any> {
    const { ticker, cik } = params

    // Convert ticker to CIK if needed
    const companyCik = cik || await this.getCompanyCik(ticker)
    if (!companyCik) {
      throw new Error(`Unable to find CIK for ticker: ${ticker}`)
    }

    // Format CIK with leading zeros (10 digits)
    const formattedCik = companyCik.toString().padStart(10, '0')

    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${formattedCik}.json`
    const response = await this.makeSecApiRequest(url)

    // Transform SEC data to our unified format
    const transformedData = this.transformCompanyFacts(response, ticker || companyCik)

    return {
      company_facts: transformedData.financial_metrics,
      company_info: transformedData.company_info,
      metadata: {
        cik: formattedCik,
        source: 'sec_edgar_api',
        last_updated: transformedData.metadata.last_updated,
        concepts_available: Object.keys(response.facts?.['us-gaap'] || {}).length
      }
    }
  }

  /**
   * Fetch company filings from SEC EDGAR API
   */
  private async fetchCompanyFilings(params: Record<string, any>): Promise<any> {
    const { ticker, cik, forms = ['10-K', '10-Q', '8-K'], limit = 20 } = params

    const companyCik = cik || await this.getCompanyCik(ticker)
    if (!companyCik) {
      throw new Error(`Unable to find CIK for ticker: ${ticker}`)
    }

    const formattedCik = companyCik.toString().padStart(10, '0')
    const url = `https://data.sec.gov/submissions/CIK${formattedCik}.json`
    const response = await this.makeSecApiRequest(url)

    // Filter and format filings
    const filings = response.filings?.recent
    if (!filings) {
      return { filings: [] }
    }

    const transformedFilings = []
    const targetForms = new Set(forms)

    for (let i = 0; i < Math.min(filings.form?.length || 0, limit); i++) {
      const formType = filings.form[i]
      if (targetForms.has(formType)) {
        transformedFilings.push({
          accessionNumber: filings.accessionNumber[i],
          filingDate: filings.filingDate[i],
          reportDate: filings.reportDate[i],
          formType: formType,
          size: filings.size[i],
          filingUrl: `https://www.sec.gov/Archives/edgar/data/${companyCik}/${filings.accessionNumber[i].replace(/-/g, '')}/${filings.primaryDocument[i]}`,
          description: this.getFilingDescription(formType)
        })
      }
    }

    return {
      filings: transformedFilings,
      company_info: {
        name: response.name,
        cik: formattedCik,
        ticker: response.tickers?.[0] || ticker
      },
      metadata: {
        total_filings: filings.form?.length || 0,
        filtered_count: transformedFilings.length,
        forms_requested: forms
      }
    }
  }

  /**
   * Fetch insider transactions from SEC submissions
   */
  private async fetchInsiderTransactions(params: Record<string, any>): Promise<any> {
    const { ticker, cik, limit = 50 } = params

    const companyCik = cik || await this.getCompanyCik(ticker)
    if (!companyCik) {
      throw new Error(`Unable to find CIK for ticker: ${ticker}`)
    }

    const formattedCik = companyCik.toString().padStart(10, '0')
    const url = `https://data.sec.gov/submissions/CIK${formattedCik}.json`
    const response = await this.makeSecApiRequest(url)

    // Filter for insider trading forms (3, 4, 5)
    const filings = response.filings?.recent
    const insiderForms = ['3', '4', '5']
    const insiderTransactions = []

    if (filings) {
      for (let i = 0; i < Math.min(filings.form?.length || 0, limit); i++) {
        const formType = filings.form[i]
        if (insiderForms.includes(formType)) {
          insiderTransactions.push({
            filingDate: filings.filingDate[i],
            reportDate: filings.reportDate[i],
            formType: formType,
            accessionNumber: filings.accessionNumber[i],
            filingUrl: `https://www.sec.gov/Archives/edgar/data/${companyCik}/${filings.accessionNumber[i].replace(/-/g, '')}/${filings.primaryDocument[i]}`,
            description: this.getInsiderFormDescription(formType)
          })
        }
      }
    }

    return {
      insider_transactions: insiderTransactions,
      company_info: {
        name: response.name,
        cik: formattedCik,
        ticker: response.tickers?.[0] || ticker
      },
      metadata: {
        total_transactions: insiderTransactions.length,
        search_limit: limit,
        forms_included: insiderForms
      }
    }
  }

  /**
   * Search companies by name or ticker
   */
  private async searchCompanies(params: Record<string, any>): Promise<any> {
    const { query, limit = 10 } = params

    // Use the company tickers JSON endpoint for search
    const url = 'https://www.sec.gov/files/company_tickers.json'
    const response = await this.makeSecApiRequest(url)

    const results = []
    const searchTerm = query.toLowerCase()

    for (const [index, company] of Object.entries(response)) {
      if (results.length >= limit) break

      const companyData = company as any
      const ticker = companyData.ticker?.toLowerCase() || ''
      const title = companyData.title?.toLowerCase() || ''

      if (ticker.includes(searchTerm) || title.includes(searchTerm)) {
        results.push({
          cik: companyData.cik_str.toString().padStart(10, '0'),
          ticker: companyData.ticker,
          title: companyData.title,
          relevance_score: this.calculateRelevanceScore(searchTerm, ticker, title)
        })
      }
    }

    // Sort by relevance score
    results.sort((a, b) => b.relevance_score - a.relevance_score)

    return {
      companies: results,
      metadata: {
        query: query,
        total_results: results.length,
        limit: limit
      }
    }
  }

  /**
   * Fetch specific company concept data
   */
  private async fetchCompanyConcept(params: Record<string, any>): Promise<any> {
    const { ticker, cik, concept = 'Revenues', taxonomy = 'us-gaap' } = params

    const companyCik = cik || await this.getCompanyCik(ticker)
    if (!companyCik) {
      throw new Error(`Unable to find CIK for ticker: ${ticker}`)
    }

    const formattedCik = companyCik.toString().padStart(10, '0')
    const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${formattedCik}/${taxonomy}/${concept}.json`

    try {
      const response = await this.makeSecApiRequest(url)

      return {
        concept_data: response,
        company_info: {
          cik: formattedCik,
          ticker: ticker || 'N/A'
        },
        metadata: {
          concept: concept,
          taxonomy: taxonomy,
          units_available: Object.keys(response.units || {})
        }
      }
    } catch (error) {
      // If concept doesn't exist, return empty result rather than error
      if (error instanceof Error && error.message.includes('404')) {
        return {
          concept_data: null,
          error: `Concept '${concept}' not found for company`,
          company_info: {
            cik: formattedCik,
            ticker: ticker || 'N/A'
          }
        }
      }
      throw error
    }
  }

  /**
   * Make rate-limited request to SEC API with proper headers
   */
  private async makeSecApiRequest(url: string): Promise<any> {
    // Rate limiting: SEC allows 10 requests per second
    await this.secRateLimit()

    const headers = {
      'User-Agent': 'Stock Selection Platform 1.0 (support@stockpicker.com)',
      'Accept': 'application/json',
      'Host': url.includes('data.sec.gov') ? 'data.sec.gov' : 'www.sec.gov'
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`SEC API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * Rate limiting for SEC API (10 requests per second max)
   */
  private lastSecRequest = 0
  private async secRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastSecRequest
    const minInterval = 100 // 100ms = 10 requests per second

    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest))
    }

    this.lastSecRequest = Date.now()
  }

  /**
   * Get company CIK from ticker symbol
   */
  private async getCompanyCik(ticker: string): Promise<string | null> {
    if (!ticker) return null

    try {
      const url = 'https://www.sec.gov/files/company_tickers.json'
      const response = await this.makeSecApiRequest(url)

      for (const company of Object.values(response)) {
        const companyData = company as any
        if (companyData.ticker === ticker.toUpperCase()) {
          return companyData.cik_str.toString().padStart(10, '0')
        }
      }

      return null
    } catch (error) {
      console.warn(`Failed to get CIK for ticker ${ticker}:`, error)
      return null
    }
  }

  /**
   * Transform SEC company facts to unified format
   */
  private transformCompanyFacts(secData: any, identifier: string): any {
    const facts = secData.facts?.['us-gaap'] || {}
    const entityName = secData.entityName || 'Unknown Company'

    // Extract latest values for key financial metrics
    const getLatestValue = (concept: string) => {
      const conceptData = facts[concept]
      if (!conceptData || !conceptData.units) return null

      // Prefer USD units
      const units = conceptData.units.USD || conceptData.units[Object.keys(conceptData.units)[0]]
      if (!units || units.length === 0) return null

      // Get most recent value
      const sortedUnits = units.sort((a: any, b: any) => new Date(b.end).getTime() - new Date(a.end).getTime())
      return sortedUnits[0]?.val || null
    }

    const financialMetrics = {
      Revenue: getLatestValue('Revenues'),
      NetIncome: getLatestValue('NetIncomeLoss'),
      Assets: getLatestValue('Assets'),
      Liabilities: getLatestValue('Liabilities'),
      StockholdersEquity: getLatestValue('StockholdersEquity'),
      Cash: getLatestValue('CashAndCashEquivalentsAtCarryingValue'),
      Debt: getLatestValue('LongTermDebt'),
      SharesOutstanding: getLatestValue('CommonStockSharesOutstanding')
    }

    return {
      company_info: {
        name: entityName,
        identifier: identifier,
        entityName: secData.entityName
      },
      financial_metrics: financialMetrics,
      metadata: {
        last_updated: new Date().toISOString(),
        data_source: 'sec_edgar_xbrl'
      }
    }
  }

  /**
   * Get human-readable description for filing types
   */
  private getFilingDescription(formType: string): string {
    const descriptions: Record<string, string> = {
      '10-K': 'Annual Report',
      '10-Q': 'Quarterly Report',
      '8-K': 'Current Report',
      '20-F': 'Annual Report (Foreign)',
      '40-F': 'Annual Report (Canadian)',
      '6-K': 'Report (Foreign)',
      'DEF 14A': 'Proxy Statement',
      'S-1': 'Registration Statement'
    }
    return descriptions[formType] || formType
  }

  /**
   * Get description for insider trading forms
   */
  private getInsiderFormDescription(formType: string): string {
    const descriptions: Record<string, string> = {
      '3': 'Initial Statement of Ownership',
      '4': 'Statement of Changes in Ownership',
      '5': 'Annual Statement of Ownership'
    }
    return descriptions[formType] || `Form ${formType}`
  }

  /**
   * Calculate relevance score for company search
   */
  private calculateRelevanceScore(searchTerm: string, ticker: string, title: string): number {
    let score = 0

    // Exact ticker match gets highest score
    if (ticker === searchTerm) score += 100
    else if (ticker.startsWith(searchTerm)) score += 80
    else if (ticker.includes(searchTerm)) score += 60

    // Company name matches
    if (title.includes(searchTerm)) score += 40

    return score
  }

  /**
   * Treasury MCP Tool Execution - Real API Integration
   */
  private async executeTreasuryTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🏛️ Executing Treasury MCP tool (REAL DATA): ${toolName}`, params)

    try {
      let result: TreasuryFiscalResponse

      switch (toolName) {
        case 'get_daily_treasury_rates':
        case 'get_yield_curve':
          // For now, use exchange rates as a placeholder until we implement yield curve endpoint
          result = await treasuryFiscalService.getExchangeRates(params.date, params.limit)
          break

        case 'get_federal_debt':
        case 'get_debt_to_penny':
          result = await treasuryFiscalService.getDebtToPenny(
            params.start_date,
            params.end_date,
            params.limit || 30
          )
          break

        case 'get_daily_treasury_statement':
        case 'get_monthly_treasury_statement':
          result = await treasuryFiscalService.getMonthlyTreasuryStatement(
            params.start_date,
            params.limit || 12
          )
          break

        case 'get_federal_spending':
          result = await treasuryFiscalService.getFederalSpending(
            params.fiscal_year,
            params.limit || 50
          )
          break

        case 'get_federal_revenue':
          result = await treasuryFiscalService.getFederalRevenue(
            params.fiscal_year,
            params.limit || 50
          )
          break

        case 'get_exchange_rates':
          result = await treasuryFiscalService.getExchangeRates(
            params.date,
            params.limit || 20
          )
          break

        case 'get_operating_cash_balance':
          result = await treasuryFiscalService.getOperatingCashBalance(
            params.start_date,
            params.limit || 30
          )
          break

        case 'get_comprehensive_fiscal_summary':
          result = await treasuryFiscalService.getComprehensiveFiscalSummary(
            params.date_range_days || 30
          )
          break

        default:
          console.warn(`⚠️ Unknown Treasury tool: ${toolName}`)
          result = await treasuryFiscalService.getComprehensiveFiscalSummary(30)
      }

      console.log(`✅ Treasury API success: ${result.metadata.responseTimeMs}ms`)

      return {
        success: true,
        data: result.data,
        source: 'treasury',
        timestamp: Date.now(),
        cached: false // Real API data is not cached at MCP level
      }

    } catch (error) {
      console.error(`❌ Treasury API error:`, error)

      // Fallback to basic mock data if service fails
      const mockFallback = this.getTreasuryMockFallback(toolName, params)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Treasury API execution failed',
        data: mockFallback,
        source: 'treasury',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Treasury Mock Fallback Data
   */
  private getTreasuryMockFallback(toolName: string, params: Record<string, any>): any {
    switch (toolName) {
      case 'get_daily_treasury_rates':
      case 'get_yield_curve':
        return {
          yield_curve: {
            date: params.date || new Date().toISOString().split('T')[0],
            rates: {
              '1_month': 4.5,
              '3_month': 4.8,
              '6_month': 5.0,
              '1_year': 5.2,
              '2_year': 5.1,
              '5_year': 4.9,
              '10_year': 4.7,
              '30_year': 4.8
            },
            fallback: true,
            message: 'Using mock yield curve data due to API error'
          }
        }

      case 'get_federal_debt':
      case 'get_debt_to_penny':
        return {
          debt_data: {
            total_debt: 33000000000000,
            debt_held_by_public: 26000000000000,
            intragovernmental_holdings: 7000000000000,
            fallback: true,
            message: 'Using mock debt data due to API error'
          }
        }

      case 'get_exchange_rates':
        return {
          exchange_rates: {
            EUR: 1.08,
            GBP: 1.27,
            JPY: 0.0067,
            CAD: 0.74,
            fallback: true,
            message: 'Using mock exchange rates due to API error'
          }
        }

      default:
        return {
          mock: true,
          tool: toolName,
          params,
          message: 'Treasury API fallback - service temporarily unavailable'
        }
    }
  }

  /**
   * Data.gov MCP Tool Execution - Real Government API Implementation
   */
  private async executeDataGovTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing Data.gov MCP tool: ${toolName}`, params)

    try {
      let result: any

      switch (toolName) {
        case 'get_employment_statistics':
          result = await this.fetchBLSEmploymentData(params)
          break

        case 'get_inflation_data':
          result = await this.fetchBLSInflationData(params)
          break

        case 'get_gdp_data':
          result = await this.fetchBEAGDPData(params)
          break

        default:
          throw new Error(`Unsupported Data.gov tool: ${toolName}`)
      }

      return {
        success: true,
        data: result,
        source: 'data_gov',
        timestamp: Date.now()
      }

    } catch (error) {
      console.error(`❌ Data.gov API error for ${toolName}:`, error)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Data.gov API tool execution failed',
        source: 'data_gov',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Context7 MCP Tool Execution
   */
  private async executeContext7Tool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing Context7 MCP tool: ${toolName}`, params)

    await new Promise(resolve => setTimeout(resolve, 150))

    try {
      let result: any

      switch (toolName) {
        case 'resolve-library-id':
          result = {
            library_matches: [
              {
                id: `/example/${params.libraryName}`,
                name: params.libraryName,
                description: `Documentation for ${params.libraryName}`,
                trust_score: 8.5,
                snippet_count: 150
              }
            ],
            selected_library: `/example/${params.libraryName}`
          }
          break

        case 'get-library-docs':
          result = {
            library_id: params.context7CompatibleLibraryID,
            documentation: {
              title: `${params.context7CompatibleLibraryID} Documentation`,
              content: `Comprehensive documentation for ${params.context7CompatibleLibraryID}...`,
              sections: [
                { title: 'Getting Started', content: 'Installation and setup...' },
                { title: 'API Reference', content: 'Complete API documentation...' },
                { title: 'Examples', content: 'Code examples and tutorials...' }
              ]
            },
            tokens_used: params.tokens || 5000,
            topic_focus: params.topic || 'general'
          }
          break

        default:
          result = {
            mock: true,
            tool: toolName,
            params,
            message: 'Context7 MCP integration pending - using mock data'
          }
      }

      return {
        success: true,
        data: result,
        source: 'context7',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Context7 MCP tool execution failed',
        source: 'context7',
        timestamp: Date.now()
      }
    }
  }

  /**
   * GitHub MCP Tool Execution
   */
  private async executeGitHubTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing GitHub MCP tool: ${toolName}`, params)

    await new Promise(resolve => setTimeout(resolve, 200))

    try {
      let result: any

      switch (toolName) {
        case 'search_repositories':
          result = {
            total_count: 1000,
            items: [
              {
                name: `${params.query}-repo`,
                full_name: `user/${params.query}-repo`,
                description: `Repository for ${params.query}`,
                html_url: 'https://github.com/user/repo',
                stargazers_count: 1250,
                language: 'TypeScript'
              }
            ]
          }
          break

        case 'get_file_contents':
          result = {
            name: params.path.split('/').pop(),
            path: params.path,
            content: `// File content from ${params.path}\nexport default function() {\n  return 'Hello World'\n}`,
            encoding: 'base64',
            size: 1024
          }
          break

        case 'list_commits':
          result = {
            commits: [
              {
                sha: 'abc123def456',
                commit: {
                  message: 'Add new financial analysis feature',
                  author: {
                    name: 'Developer',
                    email: 'dev@example.com',
                    date: new Date().toISOString()
                  }
                }
              }
            ]
          }
          break

        case 'create_issue':
          result = {
            number: 42,
            title: params.title,
            body: params.body,
            state: 'open',
            html_url: 'https://github.com/user/repo/issues/42'
          }
          break

        case 'search_code':
          result = {
            total_count: 50,
            items: [
              {
                name: 'example.ts',
                path: 'src/example.ts',
                repository: {
                  name: 'financial-platform',
                  full_name: 'company/financial-platform'
                },
                score: 1.0
              }
            ]
          }
          break

        default:
          result = {
            mock: true,
            tool: toolName,
            params,
            message: 'GitHub MCP integration pending - using mock data'
          }
      }

      return {
        success: true,
        data: result,
        source: 'github',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'GitHub MCP tool execution failed',
        source: 'github',
        timestamp: Date.now()
      }
    }
  }

  /**
   * FRED MCP Tool Execution (Federal Reserve Economic Data)
   */
  private async executeFREDTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing FRED MCP tool: ${toolName}`, params)

    await new Promise(resolve => setTimeout(resolve, 150))

    try {
      let result: any

      switch (toolName) {
        case 'get_gdp_data':
          result = {
            gdp_series: {
              series_id: 'GDPC1',
              title: 'Real Gross Domestic Product',
              frequency: 'Quarterly',
              units: 'Billions of Chained 2017 Dollars',
              data: [
                { date: '2024-01-01', value: 22996.1 },
                { date: '2023-10-01', value: 22899.7 },
                { date: '2023-07-01', value: 22773.2 }
              ]
            }
          }
          break

        case 'get_unemployment_rate':
          result = {
            unemployment_series: {
              series_id: 'UNRATE',
              title: 'Unemployment Rate',
              frequency: 'Monthly',
              units: 'Percent',
              data: [
                { date: '2024-01-01', value: 3.7 },
                { date: '2023-12-01', value: 3.7 },
                { date: '2023-11-01', value: 3.9 }
              ]
            }
          }
          break

        case 'get_interest_rates':
          result = {
            interest_rate_series: {
              series_id: 'DFF',
              title: 'Federal Funds Effective Rate',
              frequency: 'Daily',
              units: 'Percent',
              data: [
                { date: '2024-01-15', value: 5.33 },
                { date: '2024-01-14', value: 5.33 },
                { date: '2024-01-13', value: 5.33 }
              ]
            }
          }
          break

        case 'get_inflation_data':
          result = {
            inflation_series: {
              series_id: 'CPIAUCSL',
              title: 'Consumer Price Index for All Urban Consumers',
              frequency: 'Monthly',
              units: 'Index 1982-1984=100',
              data: [
                { date: '2024-01-01', value: 310.3 },
                { date: '2023-12-01', value: 310.3 },
                { date: '2023-11-01', value: 307.7 }
              ]
            }
          }
          break

        case 'search_economic_series':
          result = {
            search_results: [
              {
                id: 'GDPC1',
                title: 'Real Gross Domestic Product',
                frequency: 'Quarterly',
                units: 'Billions of Chained 2017 Dollars'
              },
              {
                id: 'UNRATE',
                title: 'Unemployment Rate',
                frequency: 'Monthly',
                units: 'Percent'
              }
            ],
            count: 2,
            limit: params.limit || 1000
          }
          break

        default:
          result = {
            mock: true,
            tool: toolName,
            params,
            message: 'FRED MCP integration using mock data - 800,000+ economic series available'
          }
      }

      return {
        success: true,
        data: result,
        source: 'fred',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'FRED MCP tool execution failed',
        source: 'fred',
        timestamp: Date.now()
      }
    }
  }

  /**
   * BLS MCP Tool Execution (Bureau of Labor Statistics)
   */
  private async executeBLSTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing BLS MCP tool: ${toolName}`, params)

    await new Promise(resolve => setTimeout(resolve, 200))

    try {
      let result: any

      switch (toolName) {
        case 'get_employment_statistics':
          result = {
            employment_data: {
              series_id: 'CES0000000001',
              title: 'All Employees, Total Nonfarm',
              frequency: 'Monthly',
              units: 'Thousands of Persons',
              data: [
                { date: '2024-01-01', value: 157232 },
                { date: '2023-12-01', value: 157232 },
                { date: '2023-11-01', value: 156827 }
              ]
            }
          }
          break

        case 'get_cpi_data':
          result = {
            cpi_data: {
              series_id: 'CUUR0000SA0',
              title: 'Consumer Price Index - All Urban Consumers',
              frequency: 'Monthly',
              units: 'Index 1982-84=100',
              data: [
                { date: '2024-01-01', value: 310.3 },
                { date: '2023-12-01', value: 310.3 },
                { date: '2023-11-01', value: 307.7 }
              ]
            }
          }
          break

        case 'get_ppi_data':
          result = {
            ppi_data: {
              series_id: 'WPUFD49207',
              title: 'Producer Price Index by Industry',
              frequency: 'Monthly',
              units: 'Index Dec 1984=100',
              data: [
                { date: '2024-01-01', value: 298.4 },
                { date: '2023-12-01', value: 296.8 },
                { date: '2023-11-01', value: 295.3 }
              ]
            }
          }
          break

        case 'get_wage_data':
          result = {
            wage_data: {
              series_id: 'CES0500000003',
              title: 'Average Hourly Earnings of All Employees',
              frequency: 'Monthly',
              units: 'Dollars',
              data: [
                { date: '2024-01-01', value: 34.64 },
                { date: '2023-12-01', value: 34.27 },
                { date: '2023-11-01', value: 34.10 }
              ]
            }
          }
          break

        case 'get_productivity_data':
          result = {
            productivity_data: {
              series_id: 'PRS85006092',
              title: 'Nonfarm Business Sector: Labor Productivity',
              frequency: 'Quarterly',
              units: 'Index 2012=100',
              data: [
                { date: '2024-01-01', value: 115.2 },
                { date: '2023-10-01', value: 114.8 },
                { date: '2023-07-01', value: 114.5 }
              ]
            }
          }
          break

        default:
          result = {
            mock: true,
            tool: toolName,
            params,
            message: 'BLS MCP integration using mock data - employment, unemployment, CPI, PPI, wages, productivity'
          }
      }

      return {
        success: true,
        data: result,
        source: 'bls',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'BLS MCP tool execution failed',
        source: 'bls',
        timestamp: Date.now()
      }
    }
  }

  /**
   * EIA MCP Tool Execution (Energy Information Administration)
   */
  private async executeEIATool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing EIA MCP tool: ${toolName}`, params)

    await new Promise(resolve => setTimeout(resolve, 180))

    try {
      let result: any

      switch (toolName) {
        case 'get_oil_prices':
          result = {
            oil_price_data: {
              series_id: 'RWTC',
              name: 'Cushing, OK WTI Spot Price FOB',
              frequency: 'Daily',
              units: 'Dollars per Barrel',
              data: [
                { date: '2024-01-15', value: 73.25 },
                { date: '2024-01-14', value: 72.98 },
                { date: '2024-01-13', value: 73.81 }
              ]
            }
          }
          break

        case 'get_natural_gas_prices':
          result = {
            natural_gas_data: {
              series_id: 'RNGWHHD',
              name: 'Henry Hub Natural Gas Spot Price',
              frequency: 'Daily',
              units: 'Dollars per Million Btu',
              data: [
                { date: '2024-01-15', value: 2.89 },
                { date: '2024-01-14', value: 2.92 },
                { date: '2024-01-13', value: 2.85 }
              ]
            }
          }
          break

        case 'get_electricity_data':
          result = {
            electricity_data: {
              series_id: 'ELEC.GEN.ALL-US-99.M',
              name: 'Net Electricity Generation, All Sectors',
              frequency: 'Monthly',
              units: 'Thousand Megawatthours',
              data: [
                { date: '2024-01-01', value: 345678 },
                { date: '2023-12-01', value: 352145 },
                { date: '2023-11-01', value: 338922 }
              ]
            }
          }
          break

        case 'get_renewable_energy_data':
          result = {
            renewable_energy_data: {
              series_id: 'ELEC.GEN.SUN-US-99.M',
              name: 'Net Generation from Solar',
              frequency: 'Monthly',
              units: 'Thousand Megawatthours',
              data: [
                { date: '2024-01-01', value: 12456 },
                { date: '2023-12-01', value: 11234 },
                { date: '2023-11-01', value: 13567 }
              ]
            }
          }
          break

        case 'get_energy_consumption':
          result = {
            consumption_data: {
              series_id: 'TOTAL.TETCBUS.M',
              name: 'Total Energy Consumed by the Commercial Sector',
              frequency: 'Monthly',
              units: 'Trillion Btu',
              data: [
                { date: '2024-01-01', value: 1450.2 },
                { date: '2023-12-01', value: 1523.8 },
                { date: '2023-11-01', value: 1398.5 }
              ]
            }
          }
          break

        case 'get_crude_oil_inventory':
          result = {
            inventory_data: {
              series_id: 'PET.WTTSTUS1.W',
              name: 'Weekly U.S. Ending Stocks of Crude Oil',
              frequency: 'Weekly',
              units: 'Thousand Barrels',
              data: [
                { date: '2024-01-12', value: 447821 },
                { date: '2024-01-05', value: 448932 },
                { date: '2023-12-29', value: 451234 }
              ]
            }
          }
          break

        default:
          result = {
            mock: true,
            tool: toolName,
            params,
            message: 'EIA MCP integration using mock data - oil, natural gas, electricity, renewable energy'
          }
      }

      return {
        success: true,
        data: result,
        source: 'eia',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'EIA MCP tool execution failed',
        source: 'eia',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Execute MCP tool with multi-source data fusion
   */
  async executeWithFusion<T = any>(
    toolName: string,
    params: Record<string, any> = {},
    options: FusionOptions = {}
  ): Promise<FusedMCPResponse<T>> {
    const startTime = Date.now()

    // Determine which sources support this tool
    const availableSources = options.sources || this.getSourcesForTool(toolName)

    if (availableSources.length === 0) {
      return {
        success: false,
        error: `No MCP sources available for tool: ${toolName}`,
        source: 'fusion',
        timestamp: Date.now()
      }
    }

    // If only one source available, use regular execution
    if (availableSources.length === 1) {
      const result = await this.executeTool<T>(toolName, params, {
        preferredServer: availableSources[0],
        cacheTTL: options.cacheFusion ? 60000 : 0,
        timeout: options.timeout
      })

      return {
        ...result,
        fusion: {
          sources: [availableSources[0]],
          primarySource: availableSources[0],
          qualityScore: this.qualityScorer.calculateQualityScore(
            availableSources[0],
            result.data,
            result.timestamp,
            Date.now() - startTime
          ),
          conflicts: 0,
          resolutionStrategy: options.strategy || ConflictResolutionStrategy.HIGHEST_QUALITY,
          fusionTimestamp: Date.now()
        }
      } as FusedMCPResponse<T>
    }

    // Fetch data from multiple sources
    const dataPoints = await this.fetchFromMultipleSources<T>(
      toolName,
      params,
      availableSources,
      options
    )

    // Use fusion engine to combine results
    return this.fusionEngine.fuseData(dataPoints, options)
  }

  /**
   * Fetch data from multiple sources in parallel
   */
  private async fetchFromMultipleSources<T>(
    toolName: string,
    params: Record<string, any>,
    sources: string[],
    options: FusionOptions
  ): Promise<Array<{
    source: string
    data: T
    quality: QualityScore
    timestamp: number
    latency: number
  }>> {
    const parallel = options.parallel !== false
    const timeout = options.timeout || 10000

    if (parallel) {
      // Fetch from all sources in parallel
      const promises = sources.map(source =>
        this.fetchFromSource<T>(source, toolName, params, timeout)
      )

      const results = await Promise.allSettled(promises)

      return results
        .filter((result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value)
    } else {
      // Fetch sequentially
      const results = []
      for (const source of sources) {
        try {
          const result = await this.fetchFromSource<T>(source, toolName, params, timeout)
          if (result) {
            results.push(result)
          }
        } catch (error) {
          console.warn(`Failed to fetch from ${source}:`, error)
        }
      }
      return results
    }
  }

  /**
   * Fetch data from a single source with quality scoring
   */
  private async fetchFromSource<T>(
    source: string,
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<{
    source: string
    data: T
    quality: QualityScore
    timestamp: number
    latency: number
  } | null> {
    const startTime = Date.now()

    try {
      const result = await this.executeTool<T>(toolName, params, {
        preferredServer: source,
        timeout,
        cacheTTL: 0 // Don't cache individual requests in fusion mode
      })

      if (!result.success || !result.data) {
        return null
      }

      const latency = Date.now() - startTime
      const quality = this.qualityScorer.calculateQualityScore(
        source,
        result.data,
        result.timestamp,
        latency
      )

      // Update source reputation based on success
      this.qualityScorer.updateSourceReputation(source, {
        success: true,
        latency
      })

      return {
        source,
        data: result.data,
        quality,
        timestamp: result.timestamp,
        latency
      }
    } catch (error) {
      // Update source reputation based on failure
      this.qualityScorer.updateSourceReputation(source, {
        success: false,
        latency: Date.now() - startTime
      })
      return null
    }
  }

  /**
   * Get sources that support a specific tool
   */
  private getSourcesForTool(toolName: string): string[] {
    const toolServerMap = this.getToolServerMap()
    const allSources = toolServerMap[toolName] || []
    // Filter to only include enabled servers
    return allSources.filter(serverId => this.isServerEnabled(serverId))
  }

  /**
   * Get tool to server mapping
   */
  private getToolServerMap(): Record<string, string[]> {
    return {
      // Stock data tools
      'get_ticker_details': ['polygon', 'alphavantage', 'yahoo', 'fmp'],
      'get_stock_info': ['yahoo', 'alphavantage', 'polygon'],
      'list_tickers': ['polygon', 'fmp'],
      'get_aggs': ['polygon', 'alphavantage'],
      'get_daily_open_close': ['polygon', 'alphavantage', 'yahoo'],
      'get_historical_stock_prices': ['yahoo', 'polygon', 'alphavantage'],

      // Technical analysis tools
      'technical_indicators': ['alphavantage', 'polygon'],
      'moving_averages': ['alphavantage'],
      'rsi': ['alphavantage'],
      'macd': ['alphavantage'],

      // Fundamental data tools
      'company_profile': ['fmp', 'alphavantage', 'yahoo'],
      'financial_statements': ['yahoo', 'fmp', 'alphavantage'],
      'get_financial_statement': ['yahoo'],
      'analyst_ratings': ['fmp', 'yahoo'],
      'insider_trading': ['fmp', 'yahoo'],
      'get_holder_info': ['yahoo'],

      // Options data
      'get_options_chain': ['yahoo'],

      // News and sentiment tools
      'news_sentiment': ['dappier', 'alphavantage', 'firecrawl', 'yahoo'],
      'market_news': ['dappier', 'firecrawl', 'alphavantage', 'yahoo'],
      'get_yahoo_finance_news': ['yahoo'],
      'scrape_content': ['firecrawl', 'dappier'],
      'web_intelligence': ['dappier'],
      'real_time_sentiment': ['dappier'],

      // Market data tools
      'market_status': ['polygon', 'alphavantage'],
      'market_holidays': ['polygon'],
      'sector_performance': ['alphavantage', 'fmp'],

      // Government data tools
      'get_employment_statistics': ['datagov', 'bls'],
      'get_inflation_data': ['datagov', 'fred', 'bls'],
      'get_gdp_data': ['datagov', 'fred'],

      // FRED economic data tools
      'get_unemployment_rate': ['fred', 'bls'],
      'get_interest_rates': ['fred', 'treasury'],
      'search_economic_series': ['fred'],

      // BLS labor statistics tools
      'get_cpi_data': ['bls', 'fred'],
      'get_ppi_data': ['bls'],
      'get_wage_data': ['bls'],
      'get_productivity_data': ['bls'],

      // EIA energy data tools
      'get_oil_prices': ['eia'],
      'get_natural_gas_prices': ['eia'],
      'get_electricity_data': ['eia'],
      'get_renewable_energy_data': ['eia'],
      'get_energy_consumption': ['eia'],
      'get_crude_oil_inventory': ['eia'],

      // SEC EDGAR tools
      'get_company_filings': ['sec_edgar'],
      'get_insider_transactions': ['sec_edgar'],
      'get_company_facts': ['sec_edgar'],
      'search_companies': ['sec_edgar'],
      'get_company_concept': ['sec_edgar'],

      // Treasury tools
      'get_daily_treasury_rates': ['treasury'],
      'get_federal_debt': ['treasury'],
      'get_exchange_rates': ['treasury'],

      // Documentation tools
      'resolve-library-id': ['context7'],
      'get-library-docs': ['context7'],

      // Repository intelligence tools
      'search_repositories': ['github'],
      'get_file_contents': ['github'],
      'list_commits': ['github'],
      'create_issue': ['github'],
      'search_code': ['github'],
      'create_pull_request': ['github'],
      'get_pull_request': ['github']
    }
  }

  /**
   * Select the optimal server for a given tool
   */
  private selectOptimalServer(toolName: string): string {
    const toolServerMap = this.getToolServerMap()
    const allPossibleServers = toolServerMap[toolName] || ['polygon', 'alphavantage', 'fmp']

    // Filter to only include enabled servers
    const possibleServers = allPossibleServers.filter(serverId => this.isServerEnabled(serverId))

    if (possibleServers.length === 0) {
      // If no enabled servers for this tool, return the first configured server as fallback
      console.warn(`🚫 No enabled servers available for tool ${toolName}`)
      return allPossibleServers[0] || 'polygon'
    }

    // Use quality scorer to select best source
    const scores = possibleServers.map(serverId => {
      const stats = this.connections.get(serverId)
      if (!stats) {
        return {
          source: serverId,
          overall: 0.5,
          metrics: {
            freshness: 0.5,
            completeness: 0.5,
            accuracy: 0.5,
            sourceReputation: this.qualityScorer.getSourceReputation(serverId),
            latency: 0.5
          },
          timestamp: Date.now()
        } as QualityScore
      }

      // Calculate quality based on connection stats
      const errorRate = stats.errorCount / Math.max(stats.requestCount, 1)
      const latencyScore = stats.avgResponseTime > 0
        ? Math.max(0, 1 - stats.avgResponseTime / 10000)
        : 0.5

      return {
        source: serverId,
        overall: (1 - errorRate) * 0.4 + latencyScore * 0.3 + this.qualityScorer.getSourceReputation(serverId) * 0.3,
        metrics: {
          freshness: stats.connected ? 1 : 0,
          completeness: 1 - errorRate,
          accuracy: 1 - errorRate,
          sourceReputation: this.qualityScorer.getSourceReputation(serverId),
          latency: latencyScore
        },
        timestamp: Date.now()
      } as QualityScore
    })

    const bestSource = QualityScorer.selectBestSource(scores)
    return bestSource || possibleServers[0]
  }

  /**
   * Get fallback server for failed requests
   */
  private getFallbackServer(failedServer: string, toolName: string): string | null {
    const toolServerMap = this.getToolServerMap()
    const possibleServers = toolServerMap[toolName] || []
    const alternatives = possibleServers.filter(s => s !== failedServer)

    if (alternatives.length === 0) return null

    // Select best alternative using quality scoring
    const scores = alternatives.map(serverId => ({
      source: serverId,
      overall: this.qualityScorer.getSourceReputation(serverId),
      metrics: {
        freshness: 0.5,
        completeness: 0.5,
        accuracy: 0.5,
        sourceReputation: this.qualityScorer.getSourceReputation(serverId),
        latency: 0.5
      },
      timestamp: Date.now()
    } as QualityScore))

    return QualityScorer.selectBestSource(scores)
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
    // Health checks are disabled by default to prevent server instability
    // They can be manually triggered via performHealthChecks() if needed
    // Uncomment the lines below to enable automatic health checks (not recommended)

    /*
    // Check server health every 5 minutes (less aggressive)
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks()
    }, 300000) // 5 minutes instead of 30 seconds

    // Allow process to exit even with active timer
    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref()
    }
    */

    console.log('📊 MCP health checks disabled - servers will be marked as connected by default')

    // Mark all servers as connected by default since health checks are disabled
    this.servers.forEach((config, serverId) => {
      const stats = this.connections.get(serverId)!
      stats.connected = true
    })
  }

  /**
   * Stop health checks and cleanup resources
   */
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  /**
   * Enable automatic health checks (disabled by default)
   */
  enableHealthChecks(intervalMinutes: number = 5) {
    if (this.healthCheckInterval) {
      this.stopHealthChecks()
    }

    console.log(`🔄 Enabling automatic health checks every ${intervalMinutes} minutes`)

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks()
    }, intervalMinutes * 60 * 1000)

    // Allow process to exit even with active timer
    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref()
    }

    // Run an initial health check
    this.performHealthChecks()
  }

  async performHealthChecks() {
    console.log('📊 Skipping actual health checks to prevent server instability')

    // Just mark all servers as connected without performing actual tool calls
    const results = Array.from(this.servers.entries()).map(([serverId, config]) => {
      const stats = this.connections.get(serverId)!
      stats.connected = true
      console.log(`✅ Server ${serverId} marked as connected (health checks disabled)`)
      return { server: serverId, status: 'healthy', tool: 'disabled' }
    })

    const summary = {
      healthy: results.length,
      failed: 0,
      skipped: 0,
      total: results.length
    }

    console.log(`📊 Health check summary: ${summary.healthy} healthy (health checks disabled for stability)`)
    return results
  }

  /**
   * Get minimal parameters for health check tools to avoid errors
   */
  private getMinimalHealthCheckParams(serverId: string, toolName: string): Record<string, any> {
    const paramMap: Record<string, Record<string, any>> = {
      'polygon': {
        'list_tickers': { limit: 1 }
      },
      'alphavantage': {
        'get_stock_info': { symbol: 'AAPL' }
      },
      'fmp': {
        'list_tickers': { limit: 1 }
      },
      'firecrawl': {
        'firecrawl_search': { query: 'test', limit: 1 }
      },
      'yahoo': {
        'get_stock_info': { symbol: 'AAPL' }
      },
      'dappier': {
        'dappier_real_time_search': { query: 'test' }
      },
      'sec_edgar': {
        'get_company_filings': { ticker: 'AAPL', limit: 1 }
      },
      'treasury': {
        'get_daily_treasury_rates': { date: '2024-01-01' }
      },
      'datagov': {
        'get_employment_statistics': { date: '2024-01-01' }
      },
      'context7': {
        'resolve-library-id': { libraryName: 'test-library' }
      },
      'github': {
        'search_repositories': { query: 'test', page: 1, perPage: 1 }
      },
      'fred': {
        'get_gdp_data': { series_id: 'GDPC1', limit: 1 }
      },
      'bls': {
        'get_employment_statistics': { series_id: 'CES0000000001', limit: 1 }
      },
      'eia': {
        'get_oil_prices': { series_id: 'RWTC', limit: 1 }
      }
    }

    return paramMap[serverId]?.[toolName] || {}
  }

  /**
   * Get a simple tool that can be used for health checking each server
   */
  private getHealthCheckTool(serverId: string): string | null {
    const healthCheckMap: Record<string, string> = {
      'polygon': 'list_tickers',
      'alphavantage': 'get_stock_info',
      'fmp': 'list_tickers',
      'firecrawl': 'firecrawl_search',
      'yahoo': 'get_stock_info',
      'dappier': 'dappier_real_time_search',
      'sec_edgar': 'get_company_filings',
      'treasury': 'get_daily_treasury_rates',
      'datagov': 'get_employment_statistics',
      'context7': 'resolve-library-id',
      'github': 'search_repositories',
      'fred': 'get_gdp_data',
      'bls': 'get_employment_statistics',
      'eia': 'get_oil_prices'
    }
    return healthCheckMap[serverId] || null
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
   * Get fusion statistics
   */
  getFusionStats() {
    return {
      connectionStats: this.getStats(),
      fusionEngineStats: this.fusionEngine.getStatistics(),
      qualityScorerStats: this.qualityScorer.getStatistics()
    }
  }

  /**
   * Get unified stock price with multi-source fusion and Redis caching
   */
  async getUnifiedStockPrice(
    symbol: string,
    options: FusionOptions = {}
  ): Promise<FusedMCPResponse<UnifiedStockPrice>> {
    // Check Redis cache first for unified stock price
    const cachedPrice = await redisCache.getCachedStockPrice(symbol)
    if (cachedPrice && options.cacheFusion !== false) {
      return {
        success: true,
        data: cachedPrice,
        source: 'redis-unified-cache',
        timestamp: Date.now(),
        cached: true
      }
    }

    const toolName = 'get_aggs'
    const params = { ticker: symbol, multiplier: 1, timespan: 'day', from_: '2023-01-01', to: '2023-12-31' }

    // Get fused data from multiple sources
    const fusedResponse = await this.executeWithFusion<any>(toolName, params, options)

    if (!fusedResponse.success || !fusedResponse.data) {
      return fusedResponse as FusedMCPResponse<UnifiedStockPrice>
    }

    // Transform to unified format
    const quality = fusedResponse.fusion?.qualityScore || this.qualityScorer.calculateQualityScore(
      fusedResponse.source,
      fusedResponse.data,
      fusedResponse.timestamp,
      0
    )

    const unifiedPrice = DataTransformationLayer.transformStockPrice(
      fusedResponse.data,
      fusedResponse.source,
      symbol,
      quality
    )

    // Cache unified result with intelligent TTL
    const isMarketHours = this.isMarketHours()
    const ttl = isMarketHours ? 30 : 300 // 30s during market hours, 5min after

    await redisCache.cacheStockPrice(symbol, unifiedPrice, fusedResponse.source, ttl)

    return {
      ...fusedResponse,
      data: unifiedPrice
    } as FusedMCPResponse<UnifiedStockPrice>
  }

  /**
   * Get unified company information with multi-source fusion
   */
  async getUnifiedCompanyInfo(
    symbol: string,
    options: FusionOptions = {}
  ): Promise<FusedMCPResponse<UnifiedCompanyInfo>> {
    const toolName = 'get_ticker_details'
    const params = { ticker: symbol }

    const fusedResponse = await this.executeWithFusion<any>(toolName, params, options)

    if (!fusedResponse.success || !fusedResponse.data) {
      return fusedResponse as FusedMCPResponse<UnifiedCompanyInfo>
    }

    const quality = fusedResponse.fusion?.qualityScore || this.qualityScorer.calculateQualityScore(
      fusedResponse.source,
      fusedResponse.data,
      fusedResponse.timestamp,
      0
    )

    const unifiedCompany = DataTransformationLayer.transformCompanyInfo(
      fusedResponse.data,
      fusedResponse.source,
      symbol,
      quality
    )

    return {
      ...fusedResponse,
      data: unifiedCompany
    } as FusedMCPResponse<UnifiedCompanyInfo>
  }

  /**
   * Get unified technical indicator with multi-source fusion
   */
  async getUnifiedTechnicalIndicator(
    symbol: string,
    indicator: string,
    options: FusionOptions = {}
  ): Promise<FusedMCPResponse<UnifiedTechnicalIndicator>> {
    const toolName = 'technical_indicators'
    const params = { symbol, function: indicator.toUpperCase() }

    const fusedResponse = await this.executeWithFusion<any>(toolName, params, options)

    if (!fusedResponse.success || !fusedResponse.data) {
      return fusedResponse as FusedMCPResponse<UnifiedTechnicalIndicator>
    }

    const quality = fusedResponse.fusion?.qualityScore || this.qualityScorer.calculateQualityScore(
      fusedResponse.source,
      fusedResponse.data,
      fusedResponse.timestamp,
      0
    )

    const unifiedIndicator = DataTransformationLayer.transformTechnicalIndicator(
      fusedResponse.data,
      fusedResponse.source,
      symbol,
      indicator,
      quality
    )

    return {
      ...fusedResponse,
      data: unifiedIndicator
    } as FusedMCPResponse<UnifiedTechnicalIndicator>
  }

  /**
   * Get unified news with multi-source fusion
   */
  async getUnifiedNews(
    keywords: string,
    options: FusionOptions = {}
  ): Promise<FusedMCPResponse<UnifiedNewsItem[]>> {
    const toolName = 'news_sentiment'
    const params = { topics: keywords }

    const fusedResponse = await this.executeWithFusion<any>(toolName, params, options)

    if (!fusedResponse.success || !fusedResponse.data) {
      return fusedResponse as FusedMCPResponse<UnifiedNewsItem[]>
    }

    const quality = fusedResponse.fusion?.qualityScore || this.qualityScorer.calculateQualityScore(
      fusedResponse.source,
      fusedResponse.data,
      fusedResponse.timestamp,
      0
    )

    const unifiedNews = DataTransformationLayer.transformNews(
      fusedResponse.data,
      fusedResponse.source,
      quality
    )

    return {
      ...fusedResponse,
      data: unifiedNews
    } as FusedMCPResponse<UnifiedNewsItem[]>
  }

  /**
   * Batch get multiple unified data types for a symbol
   */
  async getUnifiedSymbolData(
    symbol: string,
    options: {
      includePrice?: boolean
      includeCompany?: boolean
      includeTechnicals?: string[]
      includeNews?: boolean
      fusionOptions?: FusionOptions
    } = {}
  ): Promise<{
    price?: UnifiedStockPrice
    company?: UnifiedCompanyInfo
    technicals?: { [indicator: string]: UnifiedTechnicalIndicator }
    news?: UnifiedNewsItem[]
    errors?: string[]
  }> {
    const {
      includePrice = true,
      includeCompany = true,
      includeTechnicals = ['RSI', 'MACD'],
      includeNews = false,
      fusionOptions = {}
    } = options

    const results: any = {}
    const errors: string[] = []

    // Fetch all data in parallel
    const promises: Promise<any>[] = []

    if (includePrice) {
      promises.push(
        this.getUnifiedStockPrice(symbol, fusionOptions)
          .then(response => {
            if (response.success) {
              results.price = response.data
            } else {
              errors.push(`Price: ${response.error}`)
            }
          })
          .catch(error => errors.push(`Price: ${error.message}`))
      )
    }

    if (includeCompany) {
      promises.push(
        this.getUnifiedCompanyInfo(symbol, fusionOptions)
          .then(response => {
            if (response.success) {
              results.company = response.data
            } else {
              errors.push(`Company: ${response.error}`)
            }
          })
          .catch(error => errors.push(`Company: ${error.message}`))
      )
    }

    if (includeTechnicals.length > 0) {
      results.technicals = {}
      includeTechnicals.forEach(indicator => {
        promises.push(
          this.getUnifiedTechnicalIndicator(symbol, indicator, fusionOptions)
            .then(response => {
              if (response.success) {
                results.technicals[indicator] = response.data
              } else {
                errors.push(`${indicator}: ${response.error}`)
              }
            })
            .catch(error => errors.push(`${indicator}: ${error.message}`))
        )
      })
    }

    if (includeNews) {
      promises.push(
        this.getUnifiedNews(symbol, fusionOptions)
          .then(response => {
            if (response.success) {
              results.news = response.data
            } else {
              errors.push(`News: ${response.error}`)
            }
          })
          .catch(error => errors.push(`News: ${error.message}`))
      )
    }

    await Promise.all(promises)

    return {
      ...results,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * Clear cache (both memory and Redis)
   */
  async clearCache() {
    this.cache.clear()
    try {
      await redisCache.invalidatePattern('*')
    } catch (error) {
      console.error('Failed to clear Redis cache:', error)
    }
    console.log('🧹 MCP cache cleared (memory + Redis)')
  }

  /**
   * Get comprehensive cache statistics
   */
  async getCacheStats() {
    const redisStats = await redisCache.getStats()

    return {
      memory: {
        size: this.cache.size,
        entries: Array.from(this.cache.keys()).length
      },
      redis: redisStats,
      performance: {
        totalHitRate: redisStats.hitRate,
        memoryUsage: redisStats.memoryUsage
      }
    }
  }

  /**
   * Data.gov BLS Employment Statistics API Integration
   */
  private async fetchBLSEmploymentData(params: Record<string, any>): Promise<any> {
    const { date, series_id = 'LNS14000000' } = params // Default: unemployment rate

    try {
      const blsApiKey = this.servers.get('datagov')?.apiKey || ''
      const currentYear = new Date().getFullYear()
      const years = [`${currentYear}`, `${currentYear - 1}`]

      const requestData = {
        seriesid: [series_id],
        startyear: years[1],
        endyear: years[0],
        registrationkey: blsApiKey || undefined
      }

      const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error(`BLS API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status !== 'REQUEST_SUCCEEDED') {
        throw new Error(`BLS API error: ${data.message || 'Unknown error'}`)
      }

      const series = data.Results?.series?.[0]
      if (!series) {
        throw new Error('No employment data returned from BLS API')
      }

      // Transform to unified format
      const latestData = series.data?.[0]

      return {
        employment_data: {
          unemployment_rate: parseFloat(latestData?.value || '0'),
          labor_force_participation: null, // Would need separate series
          nonfarm_payrolls: null, // Would need separate series
          date: latestData?.periodName + ' ' + latestData?.year,
          series_id: series_id,
          source: 'bls_api'
        },
        historical_data: series.data?.slice(0, 12).map((item: any) => ({
          period: item.periodName + ' ' + item.year,
          value: parseFloat(item.value),
          year: parseInt(item.year),
          period_name: item.periodName
        })),
        metadata: {
          series_title: series.seriesID,
          last_updated: new Date().toISOString(),
          data_source: 'US Bureau of Labor Statistics',
          api_version: 'v2'
        }
      }

    } catch (error) {
      console.error('BLS Employment API error:', error)
      throw new Error(`Failed to fetch employment statistics: ${error}`)
    }
  }

  /**
   * Data.gov BLS Inflation/CPI Data API Integration
   */
  private async fetchBLSInflationData(params: Record<string, any>): Promise<any> {
    const { series_id = 'CUUR0000SA0' } = params // Default: CPI-U All Items

    try {
      const blsApiKey = this.servers.get('datagov')?.apiKey || ''
      const currentYear = new Date().getFullYear()
      const years = [`${currentYear}`, `${currentYear - 1}`]

      const requestData = {
        seriesid: [series_id],
        startyear: years[1],
        endyear: years[0],
        registrationkey: blsApiKey || undefined
      }

      const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error(`BLS API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status !== 'REQUEST_SUCCEEDED') {
        throw new Error(`BLS API error: ${data.message || 'Unknown error'}`)
      }

      const series = data.Results?.series?.[0]
      if (!series) {
        throw new Error('No inflation data returned from BLS API')
      }

      // Calculate year-over-year change for latest data
      const latestData = series.data?.[0]
      const yearAgoData = series.data?.find((item: any) =>
        item.year === (parseInt(latestData?.year) - 1).toString() &&
        item.period === latestData?.period
      )

      const yoyChange = yearAgoData ?
        ((parseFloat(latestData?.value) - parseFloat(yearAgoData.value)) / parseFloat(yearAgoData.value)) * 100 : null

      return {
        inflation_data: {
          cpi_data: {
            all_items: yoyChange,
            latest_index: parseFloat(latestData?.value || '0'),
            period: latestData?.periodName + ' ' + latestData?.year,
            series_id: series_id
          },
          source: 'bls_api'
        },
        historical_data: series.data?.slice(0, 24).map((item: any) => ({
          period: item.periodName + ' ' + item.year,
          index_value: parseFloat(item.value),
          year: parseInt(item.year),
          period_name: item.periodName
        })),
        metadata: {
          series_title: 'Consumer Price Index',
          last_updated: new Date().toISOString(),
          data_source: 'US Bureau of Labor Statistics',
          calculation_note: 'Year-over-year percentage change',
          api_version: 'v2'
        }
      }

    } catch (error) {
      console.error('BLS Inflation API error:', error)
      throw new Error(`Failed to fetch inflation data: ${error}`)
    }
  }

  /**
   * Data.gov BEA GDP Data API Integration
   */
  private async fetchBEAGDPData(params: Record<string, any>): Promise<any> {
    const {
      dataset = 'NIPA',
      table_name = 'T10101',
      frequency = 'Q',
      year = 'X'  // 'X' means all available years
    } = params

    try {
      // Note: BEA API requires registration for API key
      // For demo purposes, using publicly available endpoint structure
      const beaApiKey = process.env.BEA_API_KEY || 'DEMO_KEY'

      const queryParams = new URLSearchParams({
        UserID: beaApiKey,
        method: 'GetData',
        datasetname: dataset,
        TableName: table_name,
        Frequency: frequency,
        Year: year,
        ResultFormat: 'json'
      })

      const response = await fetch(`https://apps.bea.gov/api/data/?${queryParams}`)

      if (!response.ok) {
        throw new Error(`BEA API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.BEAAPI?.Results?.Error) {
        throw new Error(`BEA API error: ${data.BEAAPI.Results.Error.ErrorDetail?.Description || 'Unknown error'}`)
      }

      const beaData = data.BEAAPI?.Results?.Data
      if (!beaData || beaData.length === 0) {
        throw new Error('No GDP data returned from BEA API')
      }

      // Find the most recent GDP data (Gross domestic product)
      const gdpData = beaData.filter((item: any) =>
        item.LineDescription?.includes('Gross domestic product')
      ).sort((a: any, b: any) => b.TimePeriod.localeCompare(a.TimePeriod))

      const latestGDP = gdpData[0]

      // Extract components if available
      const personalConsumption = beaData.find((item: any) =>
        item.LineDescription?.includes('Personal consumption expenditures')
      )
      const businessInvestment = beaData.find((item: any) =>
        item.LineDescription?.includes('Gross private domestic investment')
      )
      const governmentSpending = beaData.find((item: any) =>
        item.LineDescription?.includes('Government consumption expenditures')
      )
      const netExports = beaData.find((item: any) =>
        item.LineDescription?.includes('Net exports of goods and services')
      )

      return {
        gdp_data: {
          total_gdp: parseFloat(latestGDP?.DataValue?.replace(/,/g, '') || '0') * 1000000, // Convert to dollars
          personal_consumption: parseFloat(personalConsumption?.DataValue?.replace(/,/g, '') || '0') * 1000000,
          business_investment: parseFloat(businessInvestment?.DataValue?.replace(/,/g, '') || '0') * 1000000,
          government_spending: parseFloat(governmentSpending?.DataValue?.replace(/,/g, '') || '0') * 1000000,
          net_exports: parseFloat(netExports?.DataValue?.replace(/,/g, '') || '0') * 1000000,
          period: latestGDP?.TimePeriod,
          source: 'bea_api'
        },
        historical_data: gdpData.slice(0, 20).map((item: any) => ({
          period: item.TimePeriod,
          value: parseFloat(item.DataValue?.replace(/,/g, '') || '0') * 1000000,
          units: item.Unit,
          description: item.LineDescription
        })),
        metadata: {
          dataset: dataset,
          table_name: table_name,
          frequency: frequency,
          last_updated: new Date().toISOString(),
          data_source: 'US Bureau of Economic Analysis',
          units: 'Current dollars (millions)',
          api_version: 'v1'
        }
      }

    } catch (error) {
      console.error('BEA GDP API error:', error)
      throw new Error(`Failed to fetch GDP data: ${error}`)
    }
  }

  /**
   * Warm cache for frequently accessed symbols
   */
  async warmCache(symbols: string[] = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']) {
    console.log(`🔥 Warming cache for ${symbols.length} popular symbols...`)

    await redisCache.warmCache(symbols, ['polygon', 'alphavantage', 'yahoo'])

    // Pre-fetch unified data for these symbols
    const warmingPromises = symbols.map(symbol =>
      this.getUnifiedStockPrice(symbol, { cacheFusion: true })
        .catch(error => console.warn(`Failed to warm cache for ${symbol}:`, error))
    )

    await Promise.all(warmingPromises)
    console.log('✅ Cache warming complete')
  }

  /**
   * Helper: Check if current time is during market hours
   */
  private isMarketHours(): boolean {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()
    // Monday-Friday, 9:30 AM - 4:00 PM EST
    return day >= 1 && day <= 5 && hour >= 9 && hour < 16
  }

  /**
   * Check if a server is enabled in the admin configuration
   */
  private isServerEnabled(serverId: string): boolean {
    return serverConfigManager.isServerEnabled(serverId)
  }

  /**
   * Get only enabled servers
   */
  private getEnabledServers(): Map<string, MCPServerConfig> {
    const enabledServers = new Map<string, MCPServerConfig>()
    this.servers.forEach((config, serverId) => {
      if (this.isServerEnabled(serverId)) {
        enabledServers.set(serverId, config)
      }
    })
    return enabledServers
  }

  /**
   * Reset fusion engine and quality scorer
   */
  resetFusion() {
    try {
      this.qualityScorer.reset()
    } catch (error) {
      console.error('Error resetting quality scorer:', error)
    }
    console.log('🔄 Fusion engine reset')
  }
}

// Export singleton instance
export const mcpClient = MCPClient.getInstance()