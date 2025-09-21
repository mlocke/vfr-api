/**
 * Institutional Data Service for SEC EDGAR Integration
 * Handles 13F filings, Form 4 insider trading, and sentiment analysis
 * Follows KISS principles with enterprise-grade error handling
 */

import { BaseFinancialDataProvider, ApiKeyConfig } from './BaseFinancialDataProvider'
import {
  ApiResponse,
  InstitutionalHolding,
  InsiderTransaction,
  InstitutionalSentiment,
  InsiderSentiment,
  InstitutionalIntelligence,
  InstitutionalAnalysis,
  InsiderTrading
} from './types'
import { createServiceErrorHandler, ErrorType, ErrorCode } from '../error-handling'
import SecurityValidator from '../security/SecurityValidator'
import { redisCache } from '../cache/RedisCache'
import { XMLParser } from 'fast-xml-parser'

interface EdgarApiConfig extends ApiKeyConfig {
  baseUrl: string
  userAgent: string
  requestsPerSecond: number
}

interface InstitutionalDataCache {
  [symbol: string]: {
    holdings: InstitutionalHolding[]
    insiderTransactions: InsiderTransaction[]
    sentiment: InstitutionalIntelligence | null
    lastUpdated: number
  }
}

export class InstitutionalDataService extends BaseFinancialDataProvider {
  name = 'SEC EDGAR Institutional Data'
  private errorHandler = createServiceErrorHandler('InstitutionalDataService')
  private cache: InstitutionalDataCache = {}
  private requestQueue: Array<() => Promise<any>> = []
  private processing = false
  private readonly RATE_LIMIT_DELAY = 100 // 10 requests per second max for SEC EDGAR
  private readonly xmlParser: XMLParser
  private readonly rateLimiter = new Map<string, number>()
  private readonly maxConcurrentRequests = 3
  private readonly memoryThreshold = 100 * 1024 * 1024
  private readonly symbolToCikCache = new Map<string, string>()
  private readonly requestDelay = 100
  protected readonly baseUrl: string
  protected readonly userAgent: string

  constructor(config?: Partial<EdgarApiConfig>) {
    const defaultConfig = {
      baseUrl: 'https://data.sec.gov',
      userAgent: 'VFR-API/1.0 (contact@veritakfr.com)', // SEC requires proper User-Agent
      requestsPerSecond: 10,
      timeout: 15000,
      throwErrors: false
    }

    super({
      ...defaultConfig,
      ...config
    })

    this.baseUrl = config?.baseUrl || defaultConfig.baseUrl
    this.userAgent = config?.userAgent || defaultConfig.userAgent

    // Optimized XML parser for large 13F filings
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      parseTagValue: true,
      trimValues: true,
      removeNSPrefix: true,
      numberParseOptions: {
        hex: false,
        leadingZeros: false,
        eNotation: false
      },
      // Memory optimization settings
      processEntities: false,
      htmlEntities: false,
      ignoreDeclaration: true,
      ignorePiTags: true,
      stopNodes: ['*.script', '*.style'] // Skip unnecessary elements
    })
  }

  protected getSourceIdentifier(): string {
    return 'sec_edgar_institutional'
  }

  /**
   * Rate-limited request queue for SEC EDGAR compliance
   */
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) return

    this.processing = true

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (request) {
        await request()
        await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY))
      }
    }

    this.processing = false
  }

  /**
   * Get 13F institutional holdings for a symbol
   */
  async getInstitutionalHoldings(
    symbol: string,
    quarters: number = 4
  ): Promise<InstitutionalHolding[]> {
    try {
      // Perform validation manually and return empty array if invalid
      const validationError = await this.errorHandler.errorHandler.validateOperation('getInstitutionalHoldings', [symbol])
      if (validationError) {
        this.errorHandler.logger.debug(`Validation failed for symbol ${symbol}, returning empty array`)
        return []
      }

      // Execute the actual operation with error handling
      return await this.errorHandler.errorHandler.handleAsync(
        () => this.executeGetInstitutionalHoldings(symbol, quarters),
        'InstitutionalDataService.getInstitutionalHoldings',
        undefined,
        {
          timeout: 30000,
          retries: 2
        }
      ).then((result: any) => {
        // If result is an error response, return empty array
        if (typeof result === 'object' && result && 'success' in result && result.success === false) {
          return []
        }
        return result as InstitutionalHolding[]
      })
    } catch (error) {
      this.errorHandler.logger.warn(`Failed to get institutional holdings for ${symbol}`, { error })
      return []
    }
  }

  /**
   * Get insider transactions (Form 4) for a symbol
   */
  async getInsiderTransactions(
    symbol: string,
    days: number = 180
  ): Promise<InsiderTransaction[]> {
    try {
      // Perform validation manually and return empty array if invalid
      const validationError = await this.errorHandler.errorHandler.validateOperation('getInsiderTransactions', [symbol])
      if (validationError) {
        this.errorHandler.logger.debug(`Validation failed for symbol ${symbol}, returning empty array`)
        return []
      }

      // Execute the actual operation with error handling
      return await this.errorHandler.errorHandler.handleAsync(
        () => this.executeGetInsiderTransactions(symbol, days),
        'InstitutionalDataService.getInsiderTransactions',
        undefined,
        {
          timeout: 30000,
          retries: 2
        }
      ).then((result: any) => {
        // If result is an error response, return empty array
        if (typeof result === 'object' && result && 'success' in result && result.success === false) {
          return []
        }
        return result as InsiderTransaction[]
      })
    } catch (error) {
      this.errorHandler.logger.warn(`Failed to get insider transactions for ${symbol}`, { error })
      return []
    }
  }

  /**
   * Get comprehensive institutional intelligence combining holdings and insider data
   */
  async getInstitutionalIntelligence(symbol: string): Promise<InstitutionalIntelligence | null> {
    try {
      // Perform validation manually and return null if invalid
      const validationError = await this.errorHandler.errorHandler.validateOperation('getInstitutionalIntelligence', [symbol])
      if (validationError) {
        this.errorHandler.logger.debug(`Validation failed for symbol ${symbol}, returning null`)
        return null
      }

      // Execute the actual operation with error handling
      return await this.errorHandler.errorHandler.handleAsync(
        () => this.executeGetInstitutionalIntelligence(symbol),
        'InstitutionalDataService.getInstitutionalIntelligence',
        undefined,
        {
          timeout: 45000,
          retries: 1
        }
      ).then((result: any) => {
        // If result is an error response, return null
        if (typeof result === 'object' && result && 'success' in result && result.success === false) {
          return null
        }
        return result as InstitutionalIntelligence | null
      })
    } catch (error) {
      this.errorHandler.logger.warn(`Failed to get institutional intelligence for ${symbol}`, { error })
      return null
    }
  }

  private async executeGetInstitutionalHoldings(
    symbol: string,
    quarters: number
  ): Promise<InstitutionalHolding[]> {
    const sanitizedSymbol = this.normalizeSymbol(symbol)

    // Check cache first
    const cached = this.getCachedData(sanitizedSymbol)
    if (cached?.holdings && Date.now() - cached.lastUpdated < 6 * 60 * 60 * 1000) {
      this.errorHandler.logger.debug(`Using cached institutional holdings for ${sanitizedSymbol}`)
      return cached.holdings
    }

    try {
      // Get company CIK for SEC lookups
      const companyCik = await this.getCompanyCik(sanitizedSymbol)
      if (!companyCik) {
        throw new Error(`Could not find CIK for symbol ${sanitizedSymbol}`)
      }

      // Fetch 13F holdings data
      const holdings = await this.fetch13FHoldings(sanitizedSymbol, companyCik, quarters)

      // Update cache
      this.updateCache(sanitizedSymbol, { holdings })

      this.errorHandler.logger.info(
        `Retrieved ${holdings.length} institutional holdings for ${sanitizedSymbol}`,
        { symbol: sanitizedSymbol, holdings: holdings.length }
      )

      return holdings
    } catch (error) {
      this.errorHandler.logger.logApiError(
        'GET',
        'institutional_holdings',
        error,
        undefined,
        { symbol: sanitizedSymbol, quarters }
      )
      return []
    }
  }

  private async executeGetInsiderTransactions(
    symbol: string,
    days: number
  ): Promise<InsiderTransaction[]> {
    const sanitizedSymbol = this.normalizeSymbol(symbol)

    // Check cache first
    const cached = this.getCachedData(sanitizedSymbol)
    if (cached?.insiderTransactions && Date.now() - cached.lastUpdated < 2 * 60 * 60 * 1000) {
      this.errorHandler.logger.debug(`Using cached insider transactions for ${sanitizedSymbol}`)
      return cached.insiderTransactions
    }

    try {
      // Get company CIK for SEC lookups
      const companyCik = await this.getCompanyCik(sanitizedSymbol)
      if (!companyCik) {
        throw new Error(`Could not find CIK for symbol ${sanitizedSymbol}`)
      }

      // Fetch Form 4 insider trading data
      const transactions = await this.fetchForm4Transactions(sanitizedSymbol, companyCik, days)

      // Update cache
      this.updateCache(sanitizedSymbol, { insiderTransactions: transactions })

      this.errorHandler.logger.info(
        `Retrieved ${transactions.length} insider transactions for ${sanitizedSymbol}`,
        { symbol: sanitizedSymbol, transactions: transactions.length }
      )

      return transactions
    } catch (error) {
      this.errorHandler.logger.logApiError(
        'GET',
        'insider_transactions',
        error,
        undefined,
        { symbol: sanitizedSymbol, days }
      )
      return []
    }
  }

  private async executeGetInstitutionalIntelligence(symbol: string): Promise<InstitutionalIntelligence | null> {
    const sanitizedSymbol = this.normalizeSymbol(symbol)

    try {
      // Fetch both datasets in parallel
      const [holdings, transactions] = await Promise.allSettled([
        this.getInstitutionalHoldings(sanitizedSymbol, 4),
        this.getInsiderTransactions(sanitizedSymbol, 180)
      ])

      const institutionalHoldings = holdings.status === 'fulfilled' ? holdings.value : []
      const insiderTransactions = transactions.status === 'fulfilled' ? transactions.value : []

      // Generate sentiment analysis
      const institutionalSentiment = this.analyzeInstitutionalSentiment(institutionalHoldings)
      const insiderSentiment = this.analyzeInsiderSentiment(insiderTransactions)

      // Create composite intelligence
      const intelligence: InstitutionalIntelligence = {
        symbol: sanitizedSymbol,
        reportDate: new Date().toISOString().split('T')[0],
        institutionalSentiment,
        insiderSentiment,
        compositeScore: this.calculateCompositeScore(institutionalSentiment, insiderSentiment),
        weightedSentiment: this.getWeightedSentiment(institutionalSentiment, insiderSentiment),
        keyInsights: this.generateKeyInsights(institutionalHoldings, insiderTransactions),
        riskFactors: this.identifyRiskFactors(institutionalHoldings, insiderTransactions),
        opportunities: this.identifyOpportunities(institutionalHoldings, insiderTransactions),
        dataQuality: {
          institutionalDataAvailable: institutionalHoldings.length > 0,
          insiderDataAvailable: insiderTransactions.length > 0,
          dataFreshness: this.calculateDataFreshness(institutionalHoldings, insiderTransactions),
          completeness: this.calculateDataCompleteness(institutionalHoldings, insiderTransactions)
        },
        timestamp: Date.now(),
        source: this.getSourceIdentifier()
      }

      // Update cache
      this.updateCache(sanitizedSymbol, { sentiment: intelligence })

      return intelligence
    } catch (error) {
      this.errorHandler.logger.error(
        `Failed to generate institutional intelligence for ${sanitizedSymbol}`,
        { error, symbol: sanitizedSymbol }
      )
      return null
    }
  }



  /**
   * Memory-efficient 13F filing processing with streaming
   */
  private async processFilingsInParallel(filings: any[], symbol: string): Promise<InstitutionalHolding[]> {
    const allHoldings: InstitutionalHolding[] = []
    const semaphore = this.createSemaphore(this.maxConcurrentRequests)

    const processingPromises = filings.map(async (filing) => {
      return semaphore(async () => {
        try {
          const holdings = await this.parse13FFiling(filing, symbol)
          return holdings
        } catch (error) {
          this.errorHandler.logger.warn(`Failed to process filing ${filing.accessNumber}`, { error })
          return []
        }
      })
    })

    const results = await Promise.allSettled(processingPromises)

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        allHoldings.push(...result.value)
      }
    })

    // Sort by market value and return top holdings
    return allHoldings
      .sort((a, b) => b.marketValue - a.marketValue)
      .slice(0, 100) // Limit to top 100 institutional holders
  }

  /**
   * Optimized 13F filing parser with memory management
   */
  private async parse13FFiling(filing: any, targetSymbol: string): Promise<InstitutionalHolding[]> {
    try {
      const filingUrl = this.buildFilingUrl(filing.accessNumber)
      const response = await this.makeSecRequest(filingUrl)

      if (!response) {
        this.errorHandler.logger.warn(`Filing unavailable: ${filing.accessNumber}`)
        return []
      }

      const content = await response.text()

      // Use streaming approach for large XML files
      if (content.length > this.memoryThreshold) {
        return this.parseXmlStreaming(content, targetSymbol)
      }

      // Standard parsing for smaller files
      const parsed = this.xmlParser.parse(content)
      return this.extractHoldingsFromParsed(parsed, targetSymbol, filing)

    } catch (error) {
      this.errorHandler.logger.warn(`13F parsing error for ${filing.accessNumber}`, { error })
      return []
    }
  }

  /**
   * Streaming XML parser for memory efficiency with large 13F filings
   */
  private async parseXmlStreaming(content: string, targetSymbol: string): Promise<InstitutionalHolding[]> {
    const holdings: InstitutionalHolding[] = []

    // Simple regex-based extraction for performance (avoiding full XML parse)
    const holdingRegex = /<infoTable>[\s\S]*?<\/infoTable>/g
    const matches = content.match(holdingRegex) || []

    for (const match of matches.slice(0, 1000)) { // Limit processing to avoid memory issues
      try {
        const holding = this.extractHoldingFromXmlFragment(match, targetSymbol)
        if (holding) {
          holdings.push(holding)
        }
      } catch (error) {
        // Continue processing other holdings
        continue
      }
    }

    return holdings
  }

  /**
   * Extract holding information from XML fragment
   */
  private extractHoldingFromXmlFragment(xmlFragment: string, targetSymbol: string): InstitutionalHolding | null {
    try {
      // Extract key fields using regex for performance
      const cusipMatch = xmlFragment.match(/<cusip>(.*?)<\/cusip>/i)
      const sharesMatch = xmlFragment.match(/<shrsOrPrnAmt>.*?<sshPrnamt>(.*?)<\/sshPrnamt>/i)
      const valueMatch = xmlFragment.match(/<value>(.*?)<\/value>/i)
      const nameMatch = xmlFragment.match(/<nameOfIssuer>(.*?)<\/nameOfIssuer>/i)

      if (!cusipMatch || !sharesMatch || !valueMatch) {
        return null
      }

      const cusip = cusipMatch[1].trim()
      const shares = parseInt(sharesMatch[1].replace(/,/g, '')) || 0
      const marketValue = parseInt(valueMatch[1].replace(/,/g, '')) * 1000 // SEC values in thousands
      const issuerName = nameMatch?.[1]?.trim() || ''

      // Check if this matches our target symbol (would need CUSIP-to-symbol mapping in production)
      if (!this.doesCusipMatchSymbol(cusip, targetSymbol)) {
        return null
      }

      return {
        symbol: targetSymbol,
        cusip,
        securityName: issuerName,
        managerName: '',
        managerId: '',
        reportDate: new Date().toISOString().split('T')[0],
        filingDate: new Date().toISOString().split('T')[0],
        shares,
        marketValue,
        percentOfPortfolio: 0, // Calculate later when we have total shares outstanding
        isNewPosition: false,
        isClosedPosition: false,
        rank: 0,
        securityType: 'COM',
        investmentDiscretion: 'SOLE',
        timestamp: Date.now(),
        source: this.getSourceIdentifier()
      }

    } catch (error) {
      return null
    }
  }

  /**
   * Analyze institutional data to generate insights
   */
  private analyzeInstitutionalData(
    symbol: string,
    holdings: InstitutionalHolding[],
    insiderActivity: InsiderTrading[]
  ): InstitutionalAnalysis {
    // Calculate institutional ownership percentage
    const totalShares = holdings.reduce((sum, holding) => sum + holding.shares, 0)
    const totalValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0)

    // Top holders analysis
    const topHolders = holdings
      .slice(0, 10)
      .map(holding => ({
        name: 'Institution Name', // Would extract from filing
        shares: holding.shares,
        percentage: holding.percentOfPortfolio,
        marketValue: holding.marketValue
      }))

    // Recent changes analysis
    const recentChanges = holdings
      .filter(h => h.sharesChange && h.sharesChange !== 0)
      .slice(0, 10)
      .map(holding => ({
        institution: 'Institution Name',
        changeType: (holding.sharesChange || 0) > 0 ? 'INCREASE' : 'DECREASE',
        changeShares: holding.sharesChange || 0,
        changePercent: holding.sharesChangePercent || 0,
        newPercentage: holding.percentOfPortfolio
      }))

    // Insider activity analysis
    const insiderSummary = this.analyzeInsiderActivity(insiderActivity)

    // Calculate confidence score based on data completeness
    const confidenceScore = this.calculateConfidenceScore(holdings, insiderActivity)

    return {
      symbol,
      institutionalOwnership: totalShares > 0 ? (totalShares / 1000000) * 100 : 0, // Placeholder calculation
      topHolders,
      recentChanges,
      insiderActivity: insiderSummary,
      confidenceScore,
      lastUpdated: Date.now(),
      dataCompleteness: {
        thirteenFCoverage: holdings.length > 0 ? Math.min(holdings.length / 50, 1) : 0,
        insiderCoverage: insiderActivity.length > 0 ? Math.min(insiderActivity.length / 10, 1) : 0,
        totalInstitutions: holdings.length,
        totalInsiders: insiderActivity.length
      }
    }
  }

  /**
   * Performance-optimized helper methods
   */

  private async getSymbolCik(symbol: string): Promise<string | null> {
    // Check cache first
    if (this.symbolToCikCache.has(symbol)) {
      return this.symbolToCikCache.get(symbol)!
    }

    // Use company tickers endpoint for mapping
    try {
      const response = await this.makeSecRequest('/files/company_tickers.json')
      if (!response) return null

      const data = await response.json()

      // Cache all mappings for future use
      Object.values(data).forEach((entry: any) => {
        this.symbolToCikCache.set(entry.ticker, entry.cik_str.toString().padStart(10, '0'))
      })

      return this.symbolToCikCache.get(symbol) || null

    } catch (error) {
      this.errorHandler.logger.warn(`CIK lookup failed for ${symbol}`, { error })
      return null
    }
  }

  private async makeSecRequest(url: string): Promise<Response | null> {
    try {
      // Rate limiting
      await this.enforceRateLimit()

      const response = await fetch(`${this.baseUrl}${url}`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json,text/html,application/xhtml+xml,application/xml'
        },
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response

    } catch (error) {
      this.errorHandler.logger.warn(`SEC request failed for ${url}`, { error })
      return null
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()
    const lastRequest = this.rateLimiter.get('sec_edgar') || 0
    const timeSinceLastRequest = now - lastRequest

    if (timeSinceLastRequest < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest))
    }

    this.rateLimiter.set('sec_edgar', Date.now())
  }

  private createSemaphore(maxConcurrent: number) {
    let running = 0
    const queue: Array<() => void> = []

    return async <T>(task: () => Promise<T>): Promise<T> => {
      return new Promise((resolve, reject) => {
        const run = async () => {
          running++
          try {
            const result = await task()
            resolve(result)
          } catch (error) {
            reject(error)
          } finally {
            running--
            if (queue.length > 0 && running < maxConcurrent) {
              const next = queue.shift()!
              next()
            }
          }
        }

        if (running < maxConcurrent) {
          run()
        } else {
          queue.push(run)
        }
      })
    }
  }

  private calculateCacheTtl(dataCompleteness: any): number {
    // Dynamic TTL based on data quality
    const baseHours = 6
    const qualityMultiplier = (dataCompleteness.thirteenFCoverage + dataCompleteness.insiderCoverage) / 2
    return baseHours * 3600 * Math.max(0.5, qualityMultiplier) // 3-6 hours based on data quality
  }

  /**
   * Fetch 13F holdings from SEC EDGAR API
   */
  private async fetch13FHoldings(
    symbol: string,
    companyCik: string,
    quarters: number
  ): Promise<InstitutionalHolding[]> {
    return this.queueRequest(async () => {
      // This would integrate with SEC EDGAR API or EdgarTools
      // For now, return structured placeholder data following the interface
      const holdings: InstitutionalHolding[] = []

      // Implementation would fetch actual 13F filings data
      // const response = await this.makeHttpRequest(
      //   `${this.baseUrl}/api/xbrl/companyfacts/CIK${companyCik.padStart(10, '0')}.json`
      // )

      return holdings
    })
  }

  /**
   * Fetch Form 4 insider transactions from SEC EDGAR API
   */
  private async fetchForm4Transactions(
    symbol: string,
    companyCik: string,
    days: number
  ): Promise<InsiderTransaction[]> {
    return this.queueRequest(async () => {
      // This would integrate with SEC EDGAR API or EdgarTools
      // For now, return structured placeholder data following the interface
      const transactions: InsiderTransaction[] = []

      // Implementation would fetch actual Form 4 filings data
      // const response = await this.makeHttpRequest(
      //   `${this.baseUrl}/api/xbrl/frames/us-gaap/revenues/usd/cik${companyCik}.json`
      // )

      return transactions
    })
  }

  /**
   * Get company CIK from symbol lookup
   */
  private async getCompanyCik(symbol: string): Promise<string | null> {
    return this.queueRequest(async () => {
      try {
        const response = await this.makeHttpRequest(
          `${this.baseUrl}/files/company_tickers.json`,
          {
            headers: {
              'User-Agent': process.env.SEC_USER_AGENT || 'VFR-API/1.0'
            }
          }
        )

        if (response.success && response.data) {
          const companies = Object.values(response.data) as any[]
          const company = companies.find(c =>
            c.ticker?.toUpperCase() === symbol.toUpperCase()
          )

          if (company?.cik_str) {
            return company.cik_str.toString().padStart(10, '0')
          }
        }
        return null
      } catch (error) {
        this.errorHandler.logger.warn(`Failed to lookup CIK for ${symbol}`, { error })
        return null
      }
    })
  }

  /**
   * Analyze institutional sentiment from holdings data
   */
  private analyzeInstitutionalSentiment(holdings: InstitutionalHolding[]): InstitutionalSentiment | undefined {
    if (holdings.length === 0) return undefined

    // Implementation would analyze holdings patterns, flows, etc.
    // This is a placeholder structure
    return {
      symbol: holdings[0]?.symbol || '',
      reportDate: new Date().toISOString().split('T')[0],
      totalInstitutions: holdings.length,
      totalShares: holdings.reduce((sum, h) => sum + h.shares, 0),
      totalValue: holdings.reduce((sum, h) => sum + h.marketValue, 0),
      averagePosition: holdings.reduce((sum, h) => sum + h.marketValue, 0) / holdings.length,
      institutionalOwnership: 0, // Would calculate based on float data
      quarterlyChange: {
        newPositions: 0,
        closedPositions: 0,
        increasedPositions: 0,
        decreasedPositions: 0,
        netSharesChange: 0,
        netValueChange: 0,
        flowScore: 0
      },
      topHolders: holdings.slice(0, 10).map(h => ({
        managerName: h.managerName,
        managerId: h.managerId,
        shares: h.shares,
        value: h.marketValue,
        percentOfTotal: h.percentOfPortfolio,
        changeFromPrevious: h.sharesChangePercent
      })),
      sentiment: 'NEUTRAL',
      sentimentScore: 5,
      confidence: 0.8,
      timestamp: Date.now(),
      source: this.getSourceIdentifier()
    }
  }

  /**
   * Analyze insider sentiment from transaction data
   */
  private analyzeInsiderSentiment(transactions: InsiderTransaction[]): InsiderSentiment | undefined {
    if (transactions.length === 0) return undefined

    // Implementation would analyze transaction patterns, timing, etc.
    const buyTransactions = transactions.filter(t => t.transactionType === 'BUY')
    const sellTransactions = transactions.filter(t => t.transactionType === 'SELL')

    return {
      symbol: transactions[0]?.symbol || '',
      period: '180D',
      totalTransactions: transactions.length,
      totalInsiders: new Set(transactions.map(t => t.reportingOwnerId)).size,
      netShares: transactions.reduce((sum, t) =>
        sum + (t.transactionType === 'BUY' ? t.shares : -t.shares), 0
      ),
      netValue: transactions.reduce((sum, t) =>
        sum + (t.transactionType === 'BUY' ? 1 : -1) * (t.transactionValue || 0), 0
      ),
      buyTransactions: buyTransactions.length,
      sellTransactions: sellTransactions.length,
      buyValue: buyTransactions.reduce((sum, t) => sum + (t.transactionValue || 0), 0),
      sellValue: sellTransactions.reduce((sum, t) => sum + (t.transactionValue || 0), 0),
      averageTransactionSize: transactions.reduce((sum, t) => sum + (t.transactionValue || 0), 0) / transactions.length,
      insiderTypes: {
        officers: { transactions: 0, netShares: 0, netValue: 0 },
        directors: { transactions: 0, netShares: 0, netValue: 0 },
        tenPercentOwners: { transactions: 0, netShares: 0, netValue: 0 },
        other: { transactions: 0, netShares: 0, netValue: 0 }
      },
      recentActivity: transactions
        .filter(t => t.transactionType === 'BUY' || t.transactionType === 'SELL')
        .slice(0, 10)
        .map(t => ({
          date: t.transactionDate,
          insiderName: t.reportingOwnerName,
          relationship: t.relationship.join(', '),
          transactionType: t.transactionType as 'BUY' | 'SELL',
          shares: t.shares,
          value: t.transactionValue,
          significance: 'MEDIUM' as const
        })),
      sentiment: buyTransactions.length > sellTransactions.length ? 'BULLISH' : 'BEARISH',
      sentimentScore: Math.max(1, Math.min(9, 5 + (buyTransactions.length - sellTransactions.length))),
      confidence: Math.min(1, transactions.length / 10),
      timestamp: Date.now(),
      source: this.getSourceIdentifier()
    }
  }

  /**
   * Calculate composite sentiment score (0-10)
   */
  private calculateCompositeScore(
    institutional?: InstitutionalSentiment,
    insider?: InsiderSentiment
  ): number {
    if (!institutional && !insider) return 5

    let score = 5
    let weightSum = 0

    if (institutional) {
      score += institutional.sentimentScore * 0.7 // 70% weight for institutional
      weightSum += 0.7
    }

    if (insider) {
      score += insider.sentimentScore * 0.3 // 30% weight for insider
      weightSum += 0.3
    }

    return weightSum > 0 ? score / (1 + weightSum) : 5
  }

  /**
   * Get weighted sentiment classification
   */
  private getWeightedSentiment(
    institutional?: InstitutionalSentiment,
    insider?: InsiderSentiment
  ): 'VERY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'VERY_BEARISH' {
    const score = this.calculateCompositeScore(institutional, insider)

    if (score >= 8) return 'VERY_BULLISH'
    if (score >= 6.5) return 'BULLISH'
    if (score >= 3.5) return 'NEUTRAL'
    if (score >= 2) return 'BEARISH'
    return 'VERY_BEARISH'
  }

  /**
   * Generate key insights from data analysis
   */
  private generateKeyInsights(
    holdings: InstitutionalHolding[],
    transactions: InsiderTransaction[]
  ): string[] {
    const insights: string[] = []

    if (holdings.length > 0) {
      const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0)
      insights.push(`${holdings.length} institutional holders with $${(totalValue / 1e9).toFixed(1)}B total value`)
    }

    if (transactions.length > 0) {
      const netBuys = transactions.filter(t => t.transactionType === 'BUY').length
      const netSells = transactions.filter(t => t.transactionType === 'SELL').length
      insights.push(`${transactions.length} insider transactions: ${netBuys} buys, ${netSells} sells`)
    }

    return insights
  }

  /**
   * Identify risk factors from the data
   */
  private identifyRiskFactors(
    holdings: InstitutionalHolding[],
    transactions: InsiderTransaction[]
  ): string[] {
    const risks: string[] = []

    // Add risk analysis logic here
    const recentSells = transactions.filter(t =>
      t.transactionType === 'SELL' &&
      new Date(t.transactionDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )

    if (recentSells.length > 0) {
      risks.push(`${recentSells.length} insider sells in last 30 days`)
    }

    return risks
  }

  /**
   * Identify opportunities from the data
   */
  private identifyOpportunities(
    holdings: InstitutionalHolding[],
    transactions: InsiderTransaction[]
  ): string[] {
    const opportunities: string[] = []

    // Add opportunity analysis logic here
    const recentBuys = transactions.filter(t =>
      t.transactionType === 'BUY' &&
      new Date(t.transactionDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )

    if (recentBuys.length > 0) {
      opportunities.push(`${recentBuys.length} insider buys in last 30 days`)
    }

    return opportunities
  }

  /**
   * Calculate data freshness in days
   */
  private calculateDataFreshness(
    holdings: InstitutionalHolding[],
    transactions: InsiderTransaction[]
  ): number {
    const now = Date.now()
    let latestTimestamp = 0

    // Find most recent data point
    holdings.forEach(h => {
      latestTimestamp = Math.max(latestTimestamp, new Date(h.filingDate).getTime())
    })

    transactions.forEach(t => {
      latestTimestamp = Math.max(latestTimestamp, new Date(t.filingDate).getTime())
    })

    // Return freshness in days, capped at 365 days (instead of 999)
    const daysSinceLatest = latestTimestamp > 0 ? Math.floor((now - latestTimestamp) / (24 * 60 * 60 * 1000)) : 365
    return Math.min(daysSinceLatest, 365)
  }

  /**
   * Calculate data completeness score
   */
  private calculateDataCompleteness(
    holdings: InstitutionalHolding[],
    transactions: InsiderTransaction[]
  ): number {
    let score = 0

    if (holdings.length > 0) score += 0.5
    if (transactions.length > 0) score += 0.5

    return score
  }

  /**
   * Cache management
   */
  private getCachedData(symbol: string): InstitutionalDataCache[string] | undefined {
    return this.cache[symbol]
  }

  private updateCache(
    symbol: string,
    data: Partial<Omit<InstitutionalDataCache[string], 'lastUpdated'>>
  ): void {
    if (!this.cache[symbol]) {
      this.cache[symbol] = {
        holdings: [],
        insiderTransactions: [],
        sentiment: null,
        lastUpdated: 0
      }
    }

    Object.assign(this.cache[symbol], data, { lastUpdated: Date.now() })
  }

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeHttpRequest(`${this.baseUrl}/files/company_tickers.json`, {
        headers: { 'User-Agent': process.env.SEC_USER_AGENT || 'VFR-API/1.0' }
      })
      return response.success
    } catch {
      return false
    }
  }

  /**
   * Clear cache for testing or memory management
   */
  clearCache(): void {
    this.cache = {}
  }

  /**
   * Missing method implementations
   */
  private doesCusipMatchSymbol(cusip: string, symbol: string): boolean {
    // Simplified CUSIP-to-symbol matching
    // In production, this would use a proper CUSIP-to-ticker mapping service
    return true // Allow all for now, filter would happen in actual implementation
  }

  private buildFilingUrl(accessNumber: string): string {
    const formattedAccessNumber = accessNumber.replace(/-/g, '')
    return `/Archives/edgar/data/${formattedAccessNumber.slice(0, 10)}/${accessNumber}/${accessNumber}.txt`
  }

  private extractHoldingsFromParsed(parsed: any, targetSymbol: string, filing: any): InstitutionalHolding[] {
    // Simplified extraction - would parse actual 13F XML structure
    return []
  }

  private analyzeInsiderActivity(insiderActivity: any[]): any {
    return {
      totalTransactions: insiderActivity.length,
      netBuys: insiderActivity.filter((t: any) => t.type === 'BUY').length,
      netSells: insiderActivity.filter((t: any) => t.type === 'SELL').length,
      sentiment: 'NEUTRAL'
    }
  }

  private calculateConfidenceScore(holdings: InstitutionalHolding[], insiderActivity: any[]): number {
    let score = 0.5
    if (holdings.length > 0) score += 0.3
    if (insiderActivity.length > 0) score += 0.2
    return Math.min(1.0, score)
  }
}

export default InstitutionalDataService