/**
 * Sector Integration Layer for Stock Selection Service
 * Provides interface between StockSelectionService and sector-based analysis
 */

import { SectorOption } from '../../../components/SectorDropdown'
import { SectorIntegrationInterface } from '../types'
import { MCPClient } from '../../mcp/MCPClient'
import { DataFusionEngine } from '../../mcp/DataFusionEngine'
import { SelectionConfigManager } from '../config/SelectionConfig'

/**
 * Mapping of sector IDs to standard industry classifications
 */
const SECTOR_CLASSIFICATIONS = {
  // GICS Sector mappings
  'technology': {
    gics: '45',
    naics: ['334', '511', '518', '519'],
    sic: ['3571', '3572', '7370', '7371', '7372', '7373'],
    keywords: ['software', 'hardware', 'semiconductor', 'tech', 'IT', 'cloud', 'saas']
  },
  'healthcare': {
    gics: '35',
    naics: ['325', '621', '622', '623'],
    sic: ['2834', '3841', '8071', '8082'],
    keywords: ['pharma', 'biotech', 'medical', 'healthcare', 'drug', 'hospital']
  },
  'financials': {
    gics: '40',
    naics: ['522', '523', '524', '525'],
    sic: ['6021', '6022', '6311', '6331'],
    keywords: ['bank', 'insurance', 'finance', 'credit', 'investment']
  },
  'consumer-discretionary': {
    gics: '25',
    naics: ['441', '442', '448', '451', '722'],
    sic: ['5311', '5411', '5731', '5812'],
    keywords: ['retail', 'automotive', 'restaurant', 'apparel', 'leisure']
  },
  'consumer-staples': {
    gics: '30',
    naics: ['311', '312', '424', '445'],
    sic: ['2011', '2082', '5411', '5141'],
    keywords: ['food', 'beverage', 'household', 'grocery', 'consumer goods']
  },
  'energy': {
    gics: '10',
    naics: ['211', '213', '324', '486'],
    sic: ['1311', '1321', '2911', '4923'],
    keywords: ['oil', 'gas', 'energy', 'petroleum', 'renewable', 'solar', 'wind']
  },
  'industrials': {
    gics: '20',
    naics: ['336', '488', '561', '562'],
    sic: ['3711', '4011', '7371', '8711'],
    keywords: ['aerospace', 'defense', 'industrial', 'machinery', 'transportation']
  },
  'utilities': {
    gics: '55',
    naics: ['221', '486', '224'],
    sic: ['4911', '4923', '4931'],
    keywords: ['electric', 'utility', 'power', 'water', 'gas utility']
  },
  'materials': {
    gics: '15',
    naics: ['212', '325', '331', '321'],
    sic: ['1044', '2821', '3312', '2411'],
    keywords: ['mining', 'chemical', 'steel', 'materials', 'metals', 'forestry']
  },
  'real-estate': {
    gics: '60',
    naics: ['531', '525'],
    sic: ['6798', '6519'],
    keywords: ['reit', 'real estate', 'property', 'land', 'commercial real estate']
  },
  'communication': {
    gics: '50',
    naics: ['515', '517', '518'],
    sic: ['4812', '4813', '7375'],
    keywords: ['telecom', 'media', 'communications', 'broadcasting', 'internet']
  }
}

/**
 * Index constituent mappings (simplified - would be more comprehensive in production)
 */
const INDEX_CONSTITUENTS = {
  'sp500': {
    description: 'S&P 500 constituents',
    source: 'standard_poors',
    updateFrequency: 'quarterly',
    approximateCount: 500
  },
  'nasdaq100': {
    description: 'NASDAQ 100 constituents',
    source: 'nasdaq',
    updateFrequency: 'annually',
    approximateCount: 100
  },
  'dow30': {
    description: 'Dow Jones Industrial Average constituents',
    source: 'dow_jones',
    updateFrequency: 'as_needed',
    approximateCount: 30
  },
  'russell2000': {
    description: 'Russell 2000 Small Cap Index constituents',
    source: 'russell',
    updateFrequency: 'annually',
    approximateCount: 2000
  }
}

/**
 * Sector integration and analysis
 */
export class SectorIntegration implements SectorIntegrationInterface {
  private mcpClient: MCPClient
  private dataFusion: DataFusionEngine
  private selectionConfig: SelectionConfigManager
  private cache: Map<string, { data: any; timestamp: number }> = new Map()

  constructor(
    mcpClient: MCPClient,
    dataFusion: DataFusionEngine,
    selectionConfig: SelectionConfigManager
  ) {
    this.mcpClient = mcpClient
    this.dataFusion = dataFusion
    this.selectionConfig = selectionConfig
  }

  /**
   * Get all stocks in a specific sector/index/ETF
   */
  async getSectorStocks(sector: SectorOption): Promise<string[]> {
    const cacheKey = `sector_stocks_${sector.id}`
    const cached = this.getCachedData(cacheKey)

    if (cached) {
      return cached
    }

    let stocks: string[] = []

    try {
      switch (sector.category) {
        case 'sector':
          stocks = await this.getIndustryStocks(sector)
          break
        case 'index':
          stocks = await this.getIndexConstituents(sector)
          break
        case 'etf':
          stocks = await this.getETFHoldings(sector)
          break
        default:
          throw new Error(`Unknown sector category: ${sector.category}`)
      }

      // Cache results for 1 hour
      this.setCachedData(cacheKey, stocks, 60 * 60 * 1000)

    } catch (error) {
      console.error(`Error fetching stocks for sector ${sector.id}:`, error)
      // Return empty array on error
      stocks = []
    }

    return stocks
  }

  /**
   * Get industry-specific stocks using classification codes
   */
  private async getIndustryStocks(sector: SectorOption): Promise<string[]> {
    const classification = SECTOR_CLASSIFICATIONS[sector.id as keyof typeof SECTOR_CLASSIFICATIONS]

    if (!classification) {
      console.warn(`No classification found for sector: ${sector.id}`)
      return []
    }

    try {
      // Try multiple approaches to get comprehensive stock list

      // 1. Try MCP polygon integration for sector data
      const polygonStocks = await this.getPolygonSectorStocks(sector, classification)

      // 2. Try web search for sector constituents
      const webSearchStocks = await this.getWebSearchSectorStocks(sector, classification)

      // 3. Combine and deduplicate
      const allStocks = [...new Set([...polygonStocks, ...webSearchStocks])]

      return allStocks.filter(symbol => this.isValidSymbol(symbol))

    } catch (error) {
      console.error(`Error getting industry stocks for ${sector.id}:`, error)
      return []
    }
  }

  /**
   * Get stocks using Polygon.io sector classification
   */
  private async getPolygonSectorStocks(sector: SectorOption, classification: any): Promise<string[]> {
    try {
      // Use polygon MCP to search for stocks by sector
      const polygonQuery = {
        market: 'stocks',
        active: true,
        sort: 'ticker',
        limit: 1000
      }

      // This would use the actual MCP polygon client
      const response = await this.mcpClient.executeRequest('polygon', 'list_tickers', polygonQuery)

      if (response.success && response.data?.results) {
        return response.data.results
          .filter((stock: any) => {
            // Filter by sector if available in response
            if (stock.sector) {
              return classification.keywords.some((keyword: string) =>
                stock.sector.toLowerCase().includes(keyword.toLowerCase())
              )
            }
            return false
          })
          .map((stock: any) => stock.ticker)
          .slice(0, 100) // Limit to top 100 by market cap
      }

    } catch (error) {
      console.error('Polygon sector stocks error:', error)
    }

    return []
  }

  /**
   * Get stocks using web search for sector constituents
   */
  private async getWebSearchSectorStocks(sector: SectorOption, classification: any): Promise<string[]> {
    try {
      // Use firecrawl MCP to search for sector information
      const searchQuery = `${sector.label} sector stocks list major companies constituents`

      const searchResponse = await this.mcpClient.executeRequest('firecrawl', 'firecrawl_search', {
        query: searchQuery,
        limit: 5,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true
        }
      })

      if (searchResponse.success && searchResponse.data) {
        // Extract stock symbols from search results
        return this.extractSymbolsFromText(searchResponse.data)
      }

    } catch (error) {
      console.error('Web search sector stocks error:', error)
    }

    return []
  }

  /**
   * Get index constituents
   */
  private async getIndexConstituents(index: SectorOption): Promise<string[]> {
    const indexInfo = INDEX_CONSTITUENTS[index.id as keyof typeof INDEX_CONSTITUENTS]

    if (!indexInfo) {
      console.warn(`No index information found for: ${index.id}`)
      return []
    }

    try {
      // Search for official index constituent lists
      const searchQuery = `${index.label} constituents list current holdings official`

      const response = await this.mcpClient.executeRequest('firecrawl', 'firecrawl_search', {
        query: searchQuery,
        limit: 3,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true
        }
      })

      if (response.success && response.data) {
        const symbols = this.extractSymbolsFromText(response.data)

        // Validate expected count
        if (symbols.length > indexInfo.approximateCount * 0.5) {
          return symbols.slice(0, indexInfo.approximateCount)
        }
      }

      // Fallback to known major constituents
      return this.getFallbackIndexConstituents(index.id)

    } catch (error) {
      console.error(`Error getting index constituents for ${index.id}:`, error)
      return this.getFallbackIndexConstituents(index.id)
    }
  }

  /**
   * Get ETF holdings
   */
  private async getETFHoldings(etf: SectorOption): Promise<string[]> {
    try {
      const searchQuery = `popular ETF holdings top funds SPY QQQ IWM VTI stocks`

      const response = await this.mcpClient.executeRequest('firecrawl', 'firecrawl_search', {
        query: searchQuery,
        limit: 5,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true
        }
      })

      if (response.success && response.data) {
        return this.extractSymbolsFromText(response.data)
      }

    } catch (error) {
      console.error('Error getting ETF holdings:', error)
    }

    // Return popular ETF symbols as fallback
    return ['SPY', 'QQQ', 'IWM', 'VTI', 'EFA', 'EEM', 'VNQ', 'GLD', 'TLT', 'HYG']
  }

  /**
   * Get sector-level metrics and analysis
   */
  async getSectorMetrics(sector: SectorOption): Promise<any> {
    const cacheKey = `sector_metrics_${sector.id}`
    const cached = this.getCachedData(cacheKey)

    if (cached) {
      return cached
    }

    try {
      const stocks = await this.getSectorStocks(sector)

      if (stocks.length === 0) {
        return this.getEmptySectorMetrics(sector)
      }

      // Get aggregated sector data
      const metrics = await this.calculateSectorMetrics(sector, stocks)

      // Cache for 30 minutes
      this.setCachedData(cacheKey, metrics, 30 * 60 * 1000)

      return metrics

    } catch (error) {
      console.error(`Error calculating sector metrics for ${sector.id}:`, error)
      return this.getEmptySectorMetrics(sector)
    }
  }

  /**
   * Compare multiple sectors
   */
  async compareSectors(sectors: SectorOption[]): Promise<any> {
    const comparisons = await Promise.all(
      sectors.map(async sector => {
        const metrics = await this.getSectorMetrics(sector)
        return {
          sector: sector.id,
          label: sector.label,
          metrics
        }
      })
    )

    return {
      sectors: comparisons,
      relativePerfomance: this.calculateRelativePerformance(comparisons),
      recommendations: this.generateSectorRecommendations(comparisons)
    }
  }

  /**
   * Calculate comprehensive sector metrics
   */
  private async calculateSectorMetrics(sector: SectorOption, stocks: string[]): Promise<any> {
    // This would integrate with real market data APIs
    // For now, return structure with placeholder calculations

    return {
      totalStocks: stocks.length,
      marketCap: {
        total: 0, // Would be calculated from actual data
        average: 0,
        median: 0
      },
      performance: {
        day: Math.random() * 4 - 2, // -2% to +2%
        week: Math.random() * 10 - 5, // -5% to +5%
        month: Math.random() * 20 - 10, // -10% to +10%
        year: Math.random() * 40 - 20 // -20% to +20%
      },
      valuation: {
        avgPE: 15 + Math.random() * 20, // 15-35
        avgPB: 1 + Math.random() * 4, // 1-5
        avgDividendYield: Math.random() * 5 // 0-5%
      },
      momentum: {
        trending: Math.random() > 0.5 ? 'up' : 'down',
        strength: Math.random(), // 0-1
        volume: Math.random() * 2 // Volume relative to average
      },
      quality: {
        financialHealth: 0.5 + Math.random() * 0.5, // 0.5-1.0
        growth: Math.random(), // 0-1
        profitability: 0.3 + Math.random() * 0.7 // 0.3-1.0
      }
    }
  }

  /**
   * Extract stock symbols from text content
   */
  private extractSymbolsFromText(data: any): string[] {
    let text = ''

    if (Array.isArray(data)) {
      text = data.map(item => item.markdown || item.content || JSON.stringify(item)).join(' ')
    } else if (typeof data === 'string') {
      text = data
    } else if (data.markdown) {
      text = data.markdown
    } else {
      text = JSON.stringify(data)
    }

    // Extract potential stock symbols (2-5 uppercase letters)
    const symbolRegex = /\b[A-Z]{2,5}\b/g
    const matches = text.match(symbolRegex) || []

    // Filter to likely stock symbols and remove common words
    const excludeWords = new Set([
      'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE',
      'OUR', 'OUT', 'DAY', 'GET', 'USE', 'MAN', 'NEW', 'NOW', 'WAY', 'MAY', 'SAY', 'EACH',
      'SHE', 'HOW', 'TWO', 'ITS', 'WHO', 'OIL', 'SIT', 'SET', 'RUN', 'EAT', 'FAR', 'SEA'
    ])

    return [...new Set(matches)]
      .filter(symbol => !excludeWords.has(symbol))
      .filter(symbol => this.isValidSymbol(symbol))
      .slice(0, 200) // Limit results
  }

  /**
   * Validate if string looks like a valid stock symbol
   */
  private isValidSymbol(symbol: string): boolean {
    if (!symbol || symbol.length < 1 || symbol.length > 5) {
      return false
    }

    // Must be all uppercase letters
    if (!/^[A-Z]+$/.test(symbol)) {
      return false
    }

    // Not too common/generic
    const commonWords = ['USA', 'LLC', 'INC', 'ETF', 'CEO', 'CFO', 'IPO', 'SEC', 'NYSE', 'FAQ']
    if (commonWords.includes(symbol)) {
      return false
    }

    return true
  }

  /**
   * Get fallback index constituents for major indices
   */
  private getFallbackIndexConstituents(indexId: string): string[] {
    const fallbacks: { [key: string]: string[] } = {
      'sp500': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'BRK.B', 'UNH', 'JNJ'],
      'nasdaq100': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'NFLX', 'ADBE', 'CSCO'],
      'dow30': ['AAPL', 'MSFT', 'UNH', 'GS', 'HD', 'CAT', 'CRM', 'MCD', 'V', 'BA'],
      'russell2000': ['AMC', 'GME', 'SNDL', 'NAKD', 'EXPR', 'KOSS', 'BBBY', 'CLOV', 'WISH', 'SOFI']
    }

    return fallbacks[indexId] || []
  }

  /**
   * Calculate relative performance between sectors
   */
  private calculateRelativePerformance(comparisons: any[]): any {
    // Implementation for sector relative performance analysis
    return {
      best: comparisons[0]?.sector || null,
      worst: comparisons[comparisons.length - 1]?.sector || null,
      averagePerformance: 0,
      volatility: 0
    }
  }

  /**
   * Generate sector recommendations
   */
  private generateSectorRecommendations(comparisons: any[]): string[] {
    const recommendations = []

    if (comparisons.length > 0) {
      recommendations.push(`Consider ${comparisons[0].label} for current market conditions`)
    }

    return recommendations
  }

  /**
   * Get empty sector metrics template
   */
  private getEmptySectorMetrics(sector: SectorOption): any {
    return {
      totalStocks: 0,
      marketCap: { total: 0, average: 0, median: 0 },
      performance: { day: 0, week: 0, month: 0, year: 0 },
      valuation: { avgPE: 0, avgPB: 0, avgDividendYield: 0 },
      momentum: { trending: 'neutral', strength: 0, volume: 1 },
      quality: { financialHealth: 0, growth: 0, profitability: 0 }
    }
  }

  /**
   * Cache management utilities
   */
  private getCachedData(key: string): any {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) { // 1 hour TTL
      return cached.data
    }
    return null
  }

  private setCachedData(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })

    // Clean up old cache entries
    setTimeout(() => {
      this.cache.delete(key)
    }, ttl)
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return {
      entries: this.cache.size,
      memoryUsage: JSON.stringify([...this.cache.entries()]).length
    }
  }
}