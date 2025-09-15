/**
 * MCP Client Extensions for Government Server Support
 * Extends the base MCPClient with government data source configurations and methods
 */

import { MCPClient } from './MCPClient'
import { QualityScore } from './types'

// Government server configurations
interface GovernmentServerConfig {
  name: string
  endpoint: string
  apiKey?: string
  rateLimit: number
  timeout: number
  retryAttempts: number
  dataTypes: string[]
  compliance: {
    rateLimitPerSecond: number
    requiresUserAgent: boolean
    termsOfService: string
  }
}

// Add government server support to MCPClient
declare module './MCPClient' {
  interface MCPClient {
    addGovernmentServers(): void
    getGovernmentServers(): Record<string, GovernmentServerConfig>
    getServerConfig(serverId: string): GovernmentServerConfig
    calculateDataQuality(data: any, source: string): QualityScore
    invalidateCacheOnMarketClose(symbol: string, closeTime: Date): Promise<void>
    invalidateCacheForEarnings(symbol: string, earningsDate: string): Promise<void>
    handleExpiredCache(key: string): Promise<{ shouldRefresh: boolean }>
    proactiveRefresh(symbol: string, toolName: string): Promise<void>
    prefetchRelatedData(symbol: string, tools: string[]): Promise<void>
    executeIntegratedAnalysis(symbol: string, options: {
      government_sources: string[]
      commercial_sources: string[]
      analysis_types: string[]
      fusion_strategy: any
    }): Promise<any>
  }
}

// Implementation of government server extensions
MCPClient.prototype.addGovernmentServers = function() {
  // SEC EDGAR Configuration
  this.servers.set('sec_edgar', {
    name: 'SEC EDGAR MCP',
    endpoint: 'https://data.sec.gov/api/xbrl',
    rateLimit: 600, // 10 requests/second = 600/minute
    timeout: 15000,
    retryAttempts: 3,
    dataTypes: ['filings', 'insider_trading', 'company_facts', 'mutual_fund_holdings'],
    compliance: {
      rateLimitPerSecond: 10,
      requiresUserAgent: true,
      termsOfService: 'https://www.sec.gov/developer'
    }
  } as any)

  // US Treasury Configuration
  this.servers.set('treasury', {
    name: 'US Treasury MCP',
    endpoint: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service',
    rateLimit: 1000,
    timeout: 10000,
    retryAttempts: 2,
    dataTypes: ['yield_curves', 'debt_data', 'exchange_rates', 'interest_rates'],
    compliance: {
      rateLimitPerSecond: 100,
      requiresUserAgent: false,
      termsOfService: 'https://fiscaldata.treasury.gov/api-documentation/'
    }
  } as any)

  // Data.gov Configuration
  this.servers.set('data_gov', {
    name: 'Data.gov Economic MCP',
    endpoint: 'https://api.data.gov',
    apiKey: process.env.DATA_GOV_API_KEY,
    rateLimit: 1000,
    timeout: 12000,
    retryAttempts: 3,
    dataTypes: ['economic_indicators', 'employment_data', 'inflation_data', 'gdp_data'],
    compliance: {
      rateLimitPerSecond: 50,
      requiresUserAgent: true,
      termsOfService: 'https://www.data.gov/developers/apis'
    }
  } as any)

  // Initialize connection stats for government servers
  const governmentServers = ['sec_edgar', 'treasury', 'data_gov']
  governmentServers.forEach(serverId => {
    this.connections.set(serverId, {
      connected: false,
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0
    })
  })

  console.log('✅ Government MCP servers configured: SEC EDGAR, Treasury, Data.gov')
}

MCPClient.prototype.getGovernmentServers = function(): Record<string, GovernmentServerConfig> {
  const governmentServers: Record<string, GovernmentServerConfig> = {}
  const govServerIds = ['sec_edgar', 'treasury', 'data_gov']

  govServerIds.forEach(serverId => {
    const serverConfig = this.servers.get(serverId)
    if (serverConfig) {
      governmentServers[serverId] = serverConfig as GovernmentServerConfig
    }
  })

  return governmentServers
}

MCPClient.prototype.getServerConfig = function(serverId: string): GovernmentServerConfig {
  const config = this.servers.get(serverId)
  if (!config) {
    throw new Error(`Server configuration not found for: ${serverId}`)
  }
  return config as GovernmentServerConfig
}

MCPClient.prototype.calculateDataQuality = function(data: any, source: string): QualityScore {
  return this.qualityScorer.calculateQualityScore(source, data, Date.now(), 0)
}

MCPClient.prototype.invalidateCacheOnMarketClose = async function(symbol: string, closeTime: Date): Promise<void> {
  const patterns = [
    `*${symbol}*price*`,
    `*${symbol}*quote*`,
    `*${symbol}*intraday*`
  ]

  for (const pattern of patterns) {
    await this.redisCache?.invalidatePattern(pattern)
  }

  console.log(`🧹 Cache invalidated for ${symbol} at market close`)
}

MCPClient.prototype.invalidateCacheForEarnings = async function(symbol: string, earningsDate: string): Promise<void> {
  const patterns = [
    `*${symbol}*financial*`,
    `*${symbol}*fundamentals*`,
    `*${symbol}*earnings*`,
    `*${symbol}*company*`
  ]

  for (const pattern of patterns) {
    await this.redisCache?.invalidatePattern(pattern)
  }

  console.log(`🧹 Cache invalidated for ${symbol} earnings on ${earningsDate}`)
}

MCPClient.prototype.handleExpiredCache = async function(key: string): Promise<{ shouldRefresh: boolean }> {
  const ttl = await this.redisCache?.ttl(key)
  return {
    shouldRefresh: ttl === -1 || ttl < 300 // Refresh if expired or less than 5 minutes remaining
  }
}

MCPClient.prototype.proactiveRefresh = async function(symbol: string, toolName: string): Promise<void> {
  const cacheKey = `tool:${toolName}:${JSON.stringify({ ticker: symbol })}`
  const { shouldRefresh } = await this.handleExpiredCache(cacheKey)

  if (shouldRefresh) {
    await this.executeTool(toolName, { ticker: symbol }, {
      cacheTTL: 3600000 // 1 hour
    })
    console.log(`🔄 Proactively refreshed cache for ${symbol}:${toolName}`)
  }
}

MCPClient.prototype.prefetchRelatedData = async function(symbol: string, tools: string[]): Promise<void> {
  const prefetchPromises = tools.map(toolName =>
    this.executeTool(toolName, { ticker: symbol }, {
      cacheTTL: 3600000,
      priority: 'low'
    }).catch(error => {
      console.warn(`Prefetch failed for ${symbol}:${toolName}:`, error.message)
    })
  )

  await Promise.allSettled(prefetchPromises)
  console.log(`🚀 Prefetched ${tools.length} related tools for ${symbol}`)
}

MCPClient.prototype.executeIntegratedAnalysis = async function(symbol: string, options: {
  government_sources: string[]
  commercial_sources: string[]
  analysis_types: string[]
  fusion_strategy: any
}): Promise<any> {
  const startTime = Date.now()

  // Execute analysis across all source types
  const analysisPromises = []

  // Government data analysis
  const govPromises = options.government_sources.map(source =>
    this.executeTool('get_government_data', {
      symbol,
      source,
      analysis_types: options.analysis_types
    }, { preferredServer: source })
  )

  // Commercial data analysis
  const commercialPromises = options.commercial_sources.map(source =>
    this.executeTool('get_commercial_data', {
      symbol,
      source,
      analysis_types: options.analysis_types
    }, { preferredServer: source })
  )

  const [governmentResults, commercialResults] = await Promise.allSettled([
    Promise.allSettled(govPromises),
    Promise.allSettled(commercialPromises)
  ])

  // Calculate consensus score
  const totalSources = options.government_sources.length + options.commercial_sources.length
  const successfulSources = [
    ...(governmentResults.status === 'fulfilled' ?
        governmentResults.value.filter(r => r.status === 'fulfilled').length : 0),
    ...(commercialResults.status === 'fulfilled' ?
        commercialResults.value.filter(r => r.status === 'fulfilled').length : 0)
  ].length

  const consensusScore = successfulSources / totalSources

  return {
    success: consensusScore > 0.5,
    government_data: governmentResults.status === 'fulfilled' ?
      governmentResults.value.filter(r => r.status === 'fulfilled').map(r => (r as any).value) : [],
    commercial_data: commercialResults.status === 'fulfilled' ?
      commercialResults.value.filter(r => r.status === 'fulfilled').map(r => (r as any).value) : [],
    fusion_metadata: {
      sources: [...options.government_sources, ...options.commercial_sources],
      consensus_score: consensusScore,
      analysis_time: Date.now() - startTime,
      strategy: options.fusion_strategy
    }
  }
}

// Note: Government servers are added manually in tests via addGovernmentServers()
// This avoids automatic initialization issues in the test environment

export { MCPClient }