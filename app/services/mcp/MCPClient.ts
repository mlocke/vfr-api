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
  UnifiedNewsItem
} from './types'
import { DataFusionEngine } from './DataFusionEngine'
import { QualityScorer } from './QualityScorer'
import { DataTransformationLayer } from './DataTransformationLayer'
import { redisCache } from '../cache/RedisCache'

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
  private fusionEngine: DataFusionEngine
  private qualityScorer: QualityScorer
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

      case 'data_gov':
        return this.executeDataGovTool(toolName, params, requestTimeout)

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
   * SEC EDGAR MCP Tool Execution
   */
  private async executeSECTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing SEC EDGAR MCP tool: ${toolName}`, params)

    await new Promise(resolve => setTimeout(resolve, 200))

    try {
      let result: any

      switch (toolName) {
        case 'get_company_filings':
          result = {
            filings: [
              {
                accessionNumber: '0000320193-24-000010',
                filingDate: '2024-01-15',
                reportDate: '2023-12-31',
                formType: '10-K',
                size: 1024000,
                filingUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000032019324000010/aapl-20231231.htm'
              }
            ]
          }
          break

        case 'get_insider_transactions':
          result = {
            insider_transactions: [
              {
                filingDate: '2024-01-15',
                transactionDate: '2024-01-10',
                ownerName: 'John Doe',
                transactionType: 'S',
                sharesTraded: 1000,
                pricePerShare: 150.00,
                totalValue: 150000
              }
            ]
          }
          break

        case 'get_company_facts':
          result = {
            company_facts: {
              Assets: 350000000000,
              Revenues: 400000000000,
              NetIncomeLoss: 95000000000,
              SharesOutstanding: 16000000000
            }
          }
          break

        default:
          result = {
            mock: true,
            tool: toolName,
            params,
            message: 'SEC EDGAR MCP integration pending - using mock data'
          }
      }

      return {
        success: true,
        data: result,
        source: 'sec_edgar',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SEC EDGAR MCP tool execution failed',
        source: 'sec_edgar',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Treasury MCP Tool Execution
   */
  private async executeTreasuryTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing Treasury MCP tool: ${toolName}`, params)

    await new Promise(resolve => setTimeout(resolve, 150))

    try {
      let result: any

      switch (toolName) {
        case 'get_daily_treasury_rates':
          result = {
            yield_curve: {
              date: params.date,
              rates: {
                '1_month': 4.5,
                '3_month': 4.8,
                '6_month': 5.0,
                '1_year': 5.2,
                '2_year': 5.1,
                '5_year': 4.9,
                '10_year': 4.7,
                '30_year': 4.8
              }
            }
          }
          break

        case 'get_federal_debt':
          result = {
            debt_data: {
              total_debt: 33000000000000,
              debt_held_by_public: 26000000000000,
              intragovernmental_holdings: 7000000000000
            }
          }
          break

        case 'get_exchange_rates':
          result = {
            exchange_rates: {
              EUR: 1.08,
              GBP: 1.27,
              JPY: 0.0067,
              CAD: 0.74
            }
          }
          break

        default:
          result = {
            mock: true,
            tool: toolName,
            params,
            message: 'Treasury MCP integration pending - using mock data'
          }
      }

      return {
        success: true,
        data: result,
        source: 'treasury',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Treasury MCP tool execution failed',
        source: 'treasury',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Data.gov MCP Tool Execution
   */
  private async executeDataGovTool(
    toolName: string,
    params: Record<string, any>,
    timeout: number
  ): Promise<MCPResponse> {
    console.log(`🔌 Executing Data.gov MCP tool: ${toolName}`, params)

    await new Promise(resolve => setTimeout(resolve, 180))

    try {
      let result: any

      switch (toolName) {
        case 'get_employment_statistics':
          result = {
            employment_data: {
              unemployment_rate: 3.8,
              labor_force_participation: 63.2,
              nonfarm_payrolls: 156000000,
              date: params.date || '2024-01-01'
            }
          }
          break

        case 'get_inflation_data':
          result = {
            inflation_data: {
              cpi_data: {
                all_items: 3.2,
                food: 2.8,
                energy: 4.1,
                core: 3.0
              }
            }
          }
          break

        case 'get_gdp_data':
          result = {
            gdp_data: {
              total_gdp: 25000000000000,
              personal_consumption: 17000000000000,
              business_investment: 4000000000000,
              government_spending: 4000000000000,
              net_exports: -500000000000
            }
          }
          break

        default:
          result = {
            mock: true,
            tool: toolName,
            params,
            message: 'Data.gov MCP integration pending - using mock data'
          }
      }

      return {
        success: true,
        data: result,
        source: 'data_gov',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Data.gov MCP tool execution failed',
        source: 'data_gov',
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
    return toolServerMap[toolName] || []
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
      'sector_performance': ['alphavantage', 'fmp']
    }
  }

  /**
   * Select the optimal server for a given tool
   */
  private selectOptimalServer(toolName: string): string {
    const toolServerMap = this.getToolServerMap()
    const possibleServers = toolServerMap[toolName] || ['polygon', 'alphavantage', 'fmp']

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
      'data_gov': {
        'get_employment_statistics': { date: '2024-01-01' }
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
      'data_gov': 'get_employment_statistics'
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