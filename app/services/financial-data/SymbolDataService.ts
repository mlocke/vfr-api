/**
 * Symbol Data Service for VFR Financial Analysis Platform
 *
 * Manages daily auto-refresh of stock symbols from multiple sources:
 * 1. Alpha Vantage LISTING_STATUS (Primary - works with demo key)
 * 2. NASDAQ FTP (Secondary - official source)
 * 3. SEC Company Tickers (Tertiary - government source)
 *
 * Features:
 * - Daily auto-refresh triggered by first lookup
 * - Multi-source fallback strategy
 * - Redis caching with 24hr TTL
 * - Static JSON fallback for reliability
 * - Performance optimized for client-side search
 */

import { redisCache } from '../cache/RedisCache'
import ErrorHandler from '../error-handling/ErrorHandler'
import { promises as fs } from 'fs'
import path from 'path'

export interface StockSymbol {
  symbol: string
  name: string
  exchange: string
  type: 'Stock' | 'ETF' | 'Index'
  status: 'Active' | 'Delisted'
  ipoDate?: string
  delistingDate?: string
  sector?: string
  marketCap?: number
}

export interface SymbolDataSource {
  name: string
  url: string
  format: 'csv' | 'json'
  parser: (data: string) => StockSymbol[]
  isAvailable: () => Promise<boolean>
}

interface SymbolRefreshMetadata {
  lastRefresh: number
  nextRefresh: number
  source: string
  totalSymbols: number
  status: 'success' | 'partial' | 'failed'
  errors: string[]
}

export class SymbolDataService {
  private static instance: SymbolDataService
  private readonly CACHE_KEY = 'stock-symbols-data'
  private readonly METADATA_KEY = 'stock-symbols-metadata'
  private readonly SYMBOLS_FILE_PATH = path.join(process.cwd(), 'public/data/symbols.json')
  private readonly REFRESH_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours
  private readonly MARKET_TIMEZONE = 'America/New_York'

  private dataSources: SymbolDataSource[] = [
    {
      name: 'Alpha Vantage LISTING_STATUS',
      url: `https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=${process.env.ALPHA_VANTAGE_API_KEY || 'demo'}`,
      format: 'csv',
      parser: this.parseAlphaVantageCSV.bind(this),
      isAvailable: this.checkAlphaVantageAvailability.bind(this)
    },
    {
      name: 'NASDAQ FTP',
      url: 'ftp://ftp.nasdaqtrader.com/SymbolDirectory/nasdaqlisted.txt',
      format: 'csv',
      parser: this.parseNASDAQCSV.bind(this),
      isAvailable: this.checkNASDAQAvailability.bind(this)
    },
    {
      name: 'SEC Company Tickers',
      url: 'https://www.sec.gov/files/company_tickers.json',
      format: 'json',
      parser: this.parseSECJSON.bind(this),
      isAvailable: this.checkSECAvailability.bind(this)
    }
  ]

  private constructor() {}

  static getInstance(): SymbolDataService {
    if (!SymbolDataService.instance) {
      SymbolDataService.instance = new SymbolDataService()
    }
    return SymbolDataService.instance
  }

  /**
   * Get all stock symbols with automatic daily refresh
   * This is the main entry point - triggers refresh if needed
   */
  async getSymbols(forceRefresh = false): Promise<StockSymbol[]> {
    try {
      // Check if refresh is needed
      if (forceRefresh || await this.isRefreshNeeded()) {
        console.log('🔄 Symbol data refresh needed, starting background update...')
        // Start refresh in background - don't block current request
        this.refreshSymbolsBackground().catch(error => {
          console.error('❌ Background symbol refresh failed:', error)
        })
      }

      // Get current symbols (may be from cache or file)
      const symbols = await this.getCachedSymbols()

      if (symbols.length === 0) {
        console.warn('⚠️ No symbols available, attempting immediate refresh...')
        return await this.forceRefreshSymbols()
      }

      return symbols
    } catch (error) {
      console.error('❌ Error getting symbols:', error)
      // Fallback to static file
      return await this.getStaticSymbols()
    }
  }

  /**
   * Check if symbol data needs refresh
   */
  private async isRefreshNeeded(): Promise<boolean> {
    try {
      const metadata = await redisCache.get<SymbolRefreshMetadata>(this.METADATA_KEY)

      if (!metadata) {
        console.log('📋 No refresh metadata found, refresh needed')
        return true
      }

      const now = Date.now()
      const isExpired = now > metadata.nextRefresh

      if (isExpired) {
        console.log(`📅 Symbol data expired (${new Date(metadata.lastRefresh).toLocaleString()}), refresh needed`)
        return true
      }

      // Check if it's a new trading day (after market close ET)
      if (await this.isNewTradingDay(metadata.lastRefresh)) {
        console.log('🌅 New trading day detected, refresh needed')
        return true
      }

      return false
    } catch (error) {
      console.error('❌ Error checking refresh status:', error)
      return true // Err on side of refresh
    }
  }

  /**
   * Get cached symbols from Redis or file
   */
  private async getCachedSymbols(): Promise<StockSymbol[]> {
    try {
      // Try Redis first
      const cachedSymbols = await redisCache.get<StockSymbol[]>(this.CACHE_KEY)
      if (cachedSymbols && cachedSymbols.length > 0) {
        console.log(`✅ Retrieved ${cachedSymbols.length} symbols from Redis cache`)
        return cachedSymbols
      }

      // Fallback to file
      console.log('📁 Redis cache empty, trying static file...')
      return await this.getStaticSymbols()
    } catch (error) {
      console.error('❌ Error getting cached symbols:', error)
      return []
    }
  }

  /**
   * Background refresh - non-blocking
   */
  private async refreshSymbolsBackground(): Promise<void> {
    try {
      console.log('🚀 Starting background symbol refresh...')
      const symbols = await this.downloadSymbolsFromSources()

      if (symbols.length > 0) {
        await this.cacheSymbols(symbols)
        await this.saveStaticSymbols(symbols)
        console.log(`✅ Background refresh complete: ${symbols.length} symbols updated`)
      } else {
        console.warn('⚠️ Background refresh returned no symbols')
      }
    } catch (error) {
      console.error('❌ Background symbol refresh failed:', error)
      // Update metadata to reflect failure
      await this.updateRefreshMetadata('failed', 0, 'background-refresh', [error instanceof Error ? error.message : 'Unknown error'])
    }
  }

  /**
   * Force immediate refresh (blocking)
   */
  private async forceRefreshSymbols(): Promise<StockSymbol[]> {
    try {
      console.log('⚡ Force refreshing symbols...')
      const symbols = await this.downloadSymbolsFromSources()

      if (symbols.length > 0) {
        await this.cacheSymbols(symbols)
        await this.saveStaticSymbols(symbols)
        console.log(`✅ Force refresh complete: ${symbols.length} symbols`)
        return symbols
      } else {
        console.warn('⚠️ Force refresh failed, using static fallback')
        return await this.getStaticSymbols()
      }
    } catch (error) {
      console.error('❌ Force refresh failed:', error)
      return await this.getStaticSymbols()
    }
  }

  /**
   * Download symbols from all sources with fallback chain
   */
  private async downloadSymbolsFromSources(): Promise<StockSymbol[]> {
    const errors: string[] = []

    for (const source of this.dataSources) {
      try {
        console.log(`📡 Trying ${source.name}...`)

        if (!(await source.isAvailable())) {
          console.warn(`⚠️ ${source.name} not available, skipping`)
          errors.push(`${source.name}: Not available`)
          continue
        }

        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'VFR-API/1.0 (Financial Analysis Platform)',
            'Accept': source.format === 'json' ? 'application/json' : 'text/csv'
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.text()
        const symbols = source.parser(data)

        if (symbols.length > 0) {
          console.log(`✅ Successfully downloaded ${symbols.length} symbols from ${source.name}`)
          await this.updateRefreshMetadata('success', symbols.length, source.name, errors)
          return symbols
        } else {
          errors.push(`${source.name}: No symbols returned`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ ${source.name} failed:`, errorMsg)
        errors.push(`${source.name}: ${errorMsg}`)
      }
    }

    // All sources failed
    await this.updateRefreshMetadata('failed', 0, 'all-sources-failed', errors)
    throw new Error(`All symbol data sources failed: ${errors.join(', ')}`)
  }

  /**
   * Parse Alpha Vantage LISTING_STATUS CSV
   */
  private parseAlphaVantageCSV(csvData: string): StockSymbol[] {
    try {
      const lines = csvData.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',')
      const symbols: StockSymbol[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',')
        if (values.length < headers.length) continue

        const symbol = values[0]?.trim()
        const name = values[1]?.trim()
        const exchange = values[2]?.trim()
        const assetType = values[3]?.trim()
        const ipoDate = values[4]?.trim()
        const delistingDate = values[5]?.trim()
        const status = values[6]?.trim()

        if (symbol && name) {
          symbols.push({
            symbol: symbol.toUpperCase(),
            name: name.replace(/['"]/g, ''),
            exchange: exchange || 'UNKNOWN',
            type: assetType === 'Stock' ? 'Stock' : assetType === 'ETF' ? 'ETF' : 'Stock',
            status: status === 'Active' ? 'Active' : 'Delisted',
            ipoDate: ipoDate || undefined,
            delistingDate: delistingDate || undefined
          })
        }
      }

      return symbols.filter(s => s.status === 'Active') // Only return active symbols
    } catch (error) {
      console.error('❌ Error parsing Alpha Vantage CSV:', error)
      return []
    }
  }

  /**
   * Parse NASDAQ CSV
   */
  private parseNASDAQCSV(csvData: string): StockSymbol[] {
    try {
      const lines = csvData.split('\n').filter(line => line.trim())
      const symbols: StockSymbol[] = []

      for (let i = 1; i < lines.length; i++) { // Skip header
        const values = lines[i].split('|') // NASDAQ uses pipe delimiter
        if (values.length < 4) continue

        const symbol = values[0]?.trim()
        const name = values[1]?.trim()
        const exchange = 'NASDAQ'
        const isETF = values[3]?.trim() === 'Y'

        if (symbol && name) {
          symbols.push({
            symbol: symbol.toUpperCase(),
            name: name.replace(/['"]/g, ''),
            exchange,
            type: isETF ? 'ETF' : 'Stock',
            status: 'Active'
          })
        }
      }

      return symbols
    } catch (error) {
      console.error('❌ Error parsing NASDAQ CSV:', error)
      return []
    }
  }

  /**
   * Parse SEC Company Tickers JSON
   */
  private parseSECJSON(jsonData: string): StockSymbol[] {
    try {
      const data = JSON.parse(jsonData)
      const symbols: StockSymbol[] = []

      if (data.data) {
        Object.values(data.data).forEach((company: any) => {
          if (company.ticker && company.title) {
            symbols.push({
              symbol: company.ticker.toUpperCase(),
              name: company.title.replace(/['"]/g, ''),
              exchange: 'US',
              type: 'Stock',
              status: 'Active'
            })
          }
        })
      }

      return symbols
    } catch (error) {
      console.error('❌ Error parsing SEC JSON:', error)
      return []
    }
  }

  /**
   * Cache symbols in Redis
   */
  private async cacheSymbols(symbols: StockSymbol[]): Promise<void> {
    try {
      const success = await redisCache.set(
        this.CACHE_KEY,
        symbols,
        this.REFRESH_INTERVAL / 1000, // Convert to seconds
        {
          source: 'symbol-data-service',
          version: '1.0.0'
        }
      )

      if (success) {
        console.log(`✅ Cached ${symbols.length} symbols in Redis`)
      } else {
        console.warn('⚠️ Failed to cache symbols in Redis')
      }
    } catch (error) {
      console.error('❌ Error caching symbols:', error)
    }
  }

  /**
   * Save symbols to static file
   */
  private async saveStaticSymbols(symbols: StockSymbol[]): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.SYMBOLS_FILE_PATH)
      await fs.mkdir(dir, { recursive: true })

      // Optimize for client-side search - only essential fields
      const optimizedSymbols = symbols.map(s => ({
        symbol: s.symbol,
        name: s.name,
        exchange: s.exchange,
        type: s.type
      }))

      const fileData = {
        lastUpdated: new Date().toISOString(),
        totalSymbols: symbols.length,
        symbols: optimizedSymbols
      }

      await fs.writeFile(this.SYMBOLS_FILE_PATH, JSON.stringify(fileData, null, 2))
      console.log(`✅ Saved ${symbols.length} symbols to static file`)
    } catch (error) {
      console.error('❌ Error saving static symbols file:', error)
    }
  }

  /**
   * Get symbols from static file
   */
  private async getStaticSymbols(): Promise<StockSymbol[]> {
    try {
      const fileContent = await fs.readFile(this.SYMBOLS_FILE_PATH, 'utf-8')
      const fileData = JSON.parse(fileContent)

      console.log(`📁 Loaded ${fileData.symbols?.length || 0} symbols from static file (updated: ${fileData.lastUpdated})`)
      return fileData.symbols || []
    } catch (error) {
      console.error('❌ Error reading static symbols file:', error)
      // Return empty array - this will trigger a force refresh
      return []
    }
  }

  /**
   * Update refresh metadata
   */
  private async updateRefreshMetadata(
    status: 'success' | 'partial' | 'failed',
    totalSymbols: number,
    source: string,
    errors: string[]
  ): Promise<void> {
    try {
      const now = Date.now()
      const metadata: SymbolRefreshMetadata = {
        lastRefresh: now,
        nextRefresh: now + this.REFRESH_INTERVAL,
        source,
        totalSymbols,
        status,
        errors
      }

      await redisCache.set(this.METADATA_KEY, metadata, this.REFRESH_INTERVAL / 1000)
      console.log(`📋 Updated refresh metadata: ${status}, ${totalSymbols} symbols from ${source}`)
    } catch (error) {
      console.error('❌ Error updating refresh metadata:', error)
    }
  }

  /**
   * Check if it's a new trading day (after market close ET)
   */
  private async isNewTradingDay(lastRefresh: number): Promise<boolean> {
    try {
      const lastRefreshDate = new Date(lastRefresh)
      const now = new Date()

      // Simple check: different date
      return lastRefreshDate.toDateString() !== now.toDateString()
    } catch (error) {
      console.error('❌ Error checking trading day:', error)
      return false
    }
  }

  /**
   * Availability checkers for each source
   */
  private async checkAlphaVantageAvailability(): Promise<boolean> {
    try {
      // Alpha Vantage LISTING_STATUS works with demo key
      return true
    } catch {
      return false
    }
  }

  private async checkNASDAQAvailability(): Promise<boolean> {
    try {
      // Check if NASDAQ FTP is available
      const response = await fetch('https://www.nasdaqtrader.com/', {
        method: 'HEAD'
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async checkSECAvailability(): Promise<boolean> {
    try {
      const response = await fetch('https://www.sec.gov/', {
        method: 'HEAD'
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get refresh status and metadata
   */
  async getRefreshStatus(): Promise<SymbolRefreshMetadata | null> {
    try {
      return await redisCache.get<SymbolRefreshMetadata>(this.METADATA_KEY)
    } catch (error) {
      console.error('❌ Error getting refresh status:', error)
      return null
    }
  }

  /**
   * Manual refresh trigger (for admin use)
   */
  async forceRefresh(): Promise<StockSymbol[]> {
    console.log('🔧 Manual refresh triggered')
    return await this.forceRefreshSymbols()
  }
}

// Export singleton instance
export const symbolDataService = SymbolDataService.getInstance()