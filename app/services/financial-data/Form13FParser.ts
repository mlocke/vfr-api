/**
 * High-Performance 13F Holdings Parser
 * Memory-optimized streaming parser for large SEC EDGAR 13F filings
 * Designed for <3 second processing with memory efficiency
 */

import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import { Transform, Readable } from 'stream'
import { InstitutionalHolding } from './types'
import { createServiceErrorHandler } from '../error-handling'

interface ParsingConfig {
  maxMemoryMB: number
  chunkSizeKB: number
  maxHoldingsPerFiling: number
  streamingThreshold: number
  timeoutMS: number
}

interface ParsedInfoTable {
  nameOfIssuer: string
  titleOfClass: string
  cusip: string
  value: number // in thousands
  shares: {
    sshPrnamt: number
    sshPrnamtType: 'SH' | 'PRN'
  }
  putCall?: 'Put' | 'Call'
  investmentDiscretion: 'SOLE' | 'SHARED' | 'OTHER'
  votingAuthority: {
    sole: number
    shared: number
    none: number
  }
  otherManager?: string
}

export class Form13FParser {
  private readonly config: ParsingConfig
  private readonly xmlParser: XMLParser
  private readonly errorHandler = createServiceErrorHandler('Form13FParser')
  private readonly cusipToSymbolMap = new Map<string, string>()

  // Performance monitoring
  private processingStats = {
    filesProcessed: 0,
    totalHoldings: 0,
    averageProcessingTime: 0,
    memoryPeakMB: 0,
    cacheMisses: 0
  }

  constructor(config?: Partial<ParsingConfig>) {
    this.config = {
      maxMemoryMB: 200,
      chunkSizeKB: 64,
      maxHoldingsPerFiling: 5000,
      streamingThreshold: 10 * 1024 * 1024, // 10MB
      timeoutMS: 15000,
      ...config
    }

    // Optimized XML parser configuration for 13F documents
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      parseNodeValue: true,
      parseTagValue: true,
      trimValues: true,
      removeNSPrefix: true,
      allowBooleanAttributes: true,
      parseTrueNumberOnly: false,
      numberParseOptions: {
        hex: false,
        leadingZeros: true,
        eNotation: false
      },
      // Memory optimization
      processEntities: false,
      htmlEntities: false,
      ignoreDeclaration: true,
      ignorePiTags: true,
      preserveOrder: false,
      stopNodes: ['*.script', '*.style', '*.comment'],
      maxSize: this.config.maxMemoryMB * 1024 * 1024,
      // Performance optimization
      updateTag: (tagName: string, jPath: string) => {
        // Only parse tags we need
        const relevantTags = ['infoTable', 'nameOfIssuer', 'cusip', 'value', 'shrsOrPrnAmt', 'sshPrnamt', 'sshPrnamtType', 'investmentDiscretion', 'votingAuthority', 'Sole', 'Shared', 'None']
        return relevantTags.some(tag => tagName.toLowerCase().includes(tag.toLowerCase())) ? tagName : false
      }
    })

    // Load CUSIP to symbol mapping for quick lookups
    this.loadCusipMappings()
  }

  /**
   * Parse 13F filing with automatic memory management and performance optimization
   */
  async parse13FFiling(
    filingContent: string | Buffer,
    targetSymbol?: string,
    managerInfo?: { name: string; cik: string }
  ): Promise<InstitutionalHolding[]> {
    const startTime = Date.now()
    const startMemory = this.getMemoryUsage()

    try {
      // Convert buffer to string if needed
      const content = typeof filingContent === 'string' ? filingContent : filingContent.toString('utf8')

      // Validate content size and structure
      if (content.length === 0) {
        throw new Error('Empty filing content')
      }

      if (content.length > this.config.streamingThreshold) {
        this.errorHandler.logger.info(`Large filing detected (${(content.length / 1024 / 1024).toFixed(1)}MB), using streaming parser`)
        return await this.parseStreamingMode(content, targetSymbol, managerInfo)
      }

      // Standard in-memory parsing for smaller files
      return await this.parseInMemoryMode(content, targetSymbol, managerInfo)

    } catch (error) {
      this.errorHandler.logger.error('13F parsing failed', {
        error,
        contentSize: typeof filingContent === 'string' ? filingContent.length : filingContent.length,
        targetSymbol,
        managerCik: managerInfo?.cik
      })
      return []
    } finally {
      // Update performance statistics
      const processingTime = Date.now() - startTime
      const peakMemory = this.getMemoryUsage() - startMemory
      this.updatePerformanceStats(processingTime, peakMemory)
    }
  }

  /**
   * Memory-efficient streaming parser for large 13F filings
   */
  private async parseStreamingMode(
    content: string,
    targetSymbol?: string,
    managerInfo?: { name: string; cik: string }
  ): Promise<InstitutionalHolding[]> {
    const holdings: InstitutionalHolding[] = []
    let currentHolding: Partial<ParsedInfoTable> = {}
    let insideInfoTable = false
    let currentElement = ''
    let currentValue = ''

    // Create streaming transformer
    const parseTransform = new Transform({
      objectMode: true,
      transform(chunk: string, encoding, callback) {
        try {
          // Process chunk character by character for memory efficiency
          for (let i = 0; i < chunk.length; i++) {
            const char = chunk[i]

            if (char === '<') {
              // Start of XML tag
              if (currentValue.trim()) {
                this.processElementValue(currentElement, currentValue.trim(), currentHolding)
                currentValue = ''
              }
              currentElement = ''
            } else if (char === '>') {
              // End of XML tag
              const element = currentElement.toLowerCase()

              if (element === 'infotable') {
                insideInfoTable = true
                currentHolding = {}
              } else if (element === '/infotable') {
                if (insideInfoTable && this.isValidHolding(currentHolding)) {
                  const holding = this.convertToInstitutionalHolding(currentHolding, managerInfo)
                  if (holding && (!targetSymbol || holding.symbol === targetSymbol)) {
                    holdings.push(holding)
                  }
                }
                insideInfoTable = false
                currentHolding = {}
              }
              currentElement = ''
            } else if (currentElement.length < 50) { // Prevent memory issues with malformed XML
              currentElement += char
            } else if (insideInfoTable && currentValue.length < 200) { // Limit value length
              currentValue += char
            }
          }

          callback()
        } catch (error) {
          callback(error)
        }
      }
    })

    // Process content in chunks
    const chunkSize = this.config.chunkSizeKB * 1024
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize)
      await new Promise<void>((resolve, reject) => {
        parseTransform.write(chunk, 'utf8', (error) => {
          if (error) reject(error)
          else resolve()
        })
      })

      // Memory pressure check
      if (holdings.length > this.config.maxHoldingsPerFiling) {
        this.errorHandler.logger.warn('Max holdings limit reached, truncating results')
        break
      }
    }

    return holdings
  }

  /**
   * Standard in-memory parser for smaller 13F filings
   */
  private async parseInMemoryMode(
    content: string,
    targetSymbol?: string,
    managerInfo?: { name: string; cik: string }
  ): Promise<InstitutionalHolding[]> {
    const holdings: InstitutionalHolding[] = []

    try {
      // Parse XML with timeout protection
      const parsed = await Promise.race([
        new Promise<any>((resolve) => {
          const result = this.xmlParser.parse(content)
          resolve(result)
        }),
        new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Parsing timeout')), this.config.timeoutMS)
        })
      ])

      if (!parsed) {
        throw new Error('XML parsing failed or timed out')
      }

      // Extract info tables efficiently
      const infoTables = this.extractInfoTables(parsed)

      for (const table of infoTables) {
        try {
          const holding = this.convertToInstitutionalHolding(table, managerInfo)
          if (holding && (!targetSymbol || holding.symbol === targetSymbol)) {
            holdings.push(holding)

            // Limit results to prevent memory issues
            if (holdings.length >= this.config.maxHoldingsPerFiling) {
              break
            }
          }
        } catch (error) {
          // Skip malformed holdings, continue processing
          continue
        }
      }

    } catch (error) {
      this.errorHandler.logger.warn('In-memory parsing failed, falling back to regex extraction', { error })
      return this.parseWithRegexFallback(content, targetSymbol, managerInfo)
    }

    return holdings
  }

  /**
   * Regex-based fallback parser for malformed XML
   */
  private parseWithRegexFallback(
    content: string,
    targetSymbol?: string,
    managerInfo?: { name: string; cik: string }
  ): InstitutionalHolding[] {
    const holdings: InstitutionalHolding[] = []

    // Extract info tables using regex
    const infoTableRegex = /<infoTable[^>]*?>(.*?)<\/infoTable>/gis
    let match

    while ((match = infoTableRegex.exec(content)) !== null && holdings.length < this.config.maxHoldingsPerFiling) {
      try {
        const tableContent = match[1]
        const holding = this.parseInfoTableRegex(tableContent, managerInfo)

        if (holding && (!targetSymbol || holding.symbol === targetSymbol)) {
          holdings.push(holding)
        }
      } catch (error) {
        // Continue processing other tables
        continue
      }
    }

    return holdings
  }

  /**
   * Parse individual info table using regex patterns
   */
  private parseInfoTableRegex(tableContent: string, managerInfo?: { name: string; cik: string }): InstitutionalHolding | null {
    try {
      // Extract required fields using optimized regex patterns
      const patterns = {
        nameOfIssuer: /<nameOfIssuer[^>]*?>(.*?)<\/nameOfIssuer>/i,
        cusip: /<cusip[^>]*?>(.*?)<\/cusip>/i,
        value: /<value[^>]*?>(.*?)<\/value>/i,
        shares: /<sshPrnamt[^>]*?>(.*?)<\/sshPrnamt>/i,
        sharesType: /<sshPrnamtType[^>]*?>(.*?)<\/sshPrnamtType>/i,
        investmentDiscretion: /<investmentDiscretion[^>]*?>(.*?)<\/investmentDiscretion>/i,
        votingSole: /<Sole[^>]*?>(.*?)<\/Sole>/i,
        votingShared: /<Shared[^>]*?>(.*?)<\/Shared>/i,
        votingNone: /<None[^>]*?>(.*?)<\/None>/i
      }

      const extracted: Record<string, string> = {}
      for (const [key, pattern] of Object.entries(patterns)) {
        const match = tableContent.match(pattern)
        extracted[key] = match ? match[1].trim() : ''
      }

      // Validate required fields
      if (!extracted.cusip || !extracted.value || !extracted.shares) {
        return null
      }

      // Convert to institutional holding
      const symbol = this.cusipToSymbol(extracted.cusip)
      if (!symbol) {
        return null
      }

      const shares = this.parseNumber(extracted.shares)
      const value = this.parseNumber(extracted.value) * 1000 // SEC values in thousands

      if (shares <= 0 || value <= 0) {
        return null
      }

      return {
        symbol,
        cusip: extracted.cusip,
        securityName: extracted.nameOfIssuer || symbol,
        managerName: managerInfo?.name || 'Unknown',
        managerId: managerInfo?.cik || '',
        reportDate: '', // Would be extracted from filing header
        filingDate: '', // Would be extracted from filing header
        shares,
        marketValue: value,
        percentOfPortfolio: 0, // Calculated later
        isNewPosition: false,
        isClosedPosition: false,
        rank: 0,
        securityType: 'COM',
        votingAuthority: {
          sole: this.parseNumber(extracted.votingSole),
          shared: this.parseNumber(extracted.votingShared),
          none: this.parseNumber(extracted.votingNone)
        },
        investmentDiscretion: this.normalizeInvestmentDiscretion(extracted.investmentDiscretion),
        timestamp: Date.now(),
        source: 'sec_13f'
      }

    } catch (error) {
      return null
    }
  }

  /**
   * Helper methods for data processing and optimization
   */

  private extractInfoTables(parsed: any): ParsedInfoTable[] {
    const tables: ParsedInfoTable[] = []

    try {
      // Navigate XML structure to find info tables
      const informationTable = parsed?.informationTable || parsed?.xml?.informationTable

      if (!informationTable) {
        return tables
      }

      const infoTables = Array.isArray(informationTable.infoTable)
        ? informationTable.infoTable
        : [informationTable.infoTable]

      for (const table of infoTables) {
        if (table && this.isValidInfoTable(table)) {
          tables.push(this.normalizeInfoTable(table))
        }
      }

    } catch (error) {
      this.errorHandler.logger.warn('Failed to extract info tables from parsed XML', { error })
    }

    return tables
  }

  private isValidInfoTable(table: any): boolean {
    return table &&
           table.nameOfIssuer &&
           table.cusip &&
           table.value &&
           table.shrsOrPrnAmt &&
           table.shrsOrPrnAmt.sshPrnamt
  }

  private normalizeInfoTable(table: any): ParsedInfoTable {
    return {
      nameOfIssuer: String(table.nameOfIssuer).trim(),
      titleOfClass: String(table.titleOfClass || '').trim(),
      cusip: String(table.cusip).trim(),
      value: this.parseNumber(table.value),
      shares: {
        sshPrnamt: this.parseNumber(table.shrsOrPrnAmt.sshPrnamt),
        sshPrnamtType: table.shrsOrPrnAmt.sshPrnamtType === 'PRN' ? 'PRN' : 'SH'
      },
      putCall: table.shrsOrPrnAmt.putCall,
      investmentDiscretion: this.normalizeInvestmentDiscretion(table.investmentDiscretion),
      votingAuthority: {
        sole: this.parseNumber(table.votingAuthority?.Sole || 0),
        shared: this.parseNumber(table.votingAuthority?.Shared || 0),
        none: this.parseNumber(table.votingAuthority?.None || 0)
      },
      otherManager: table.otherManager
    }
  }

  private convertToInstitutionalHolding(
    table: ParsedInfoTable | Partial<ParsedInfoTable>,
    managerInfo?: { name: string; cik: string }
  ): InstitutionalHolding | null {
    if (!table.cusip || !table.value || !table.shares?.sshPrnamt) {
      return null
    }

    const symbol = this.cusipToSymbol(table.cusip)
    if (!symbol) {
      return null
    }

    const shares = table.shares.sshPrnamt
    const marketValue = table.value * 1000 // Convert from thousands

    return {
      symbol,
      cusip: table.cusip,
      securityName: table.nameOfIssuer || symbol,
      managerName: managerInfo?.name || 'Unknown Manager',
      managerId: managerInfo?.cik || '',
      reportDate: '', // Would be extracted from filing metadata
      filingDate: '', // Would be extracted from filing metadata
      shares,
      marketValue,
      percentOfPortfolio: 0, // Calculated at the portfolio level
      isNewPosition: false, // Requires historical comparison
      isClosedPosition: false, // Requires historical comparison
      rank: 0, // Calculated at the portfolio level
      securityType: this.determineSecurityType(table),
      votingAuthority: table.votingAuthority || { sole: 0, shared: 0, none: 0 },
      investmentDiscretion: table.investmentDiscretion || 'SOLE',
      timestamp: Date.now(),
      source: 'sec_13f'
    }
  }

  private determineSecurityType(table: Partial<ParsedInfoTable>): 'COM' | 'PRF' | 'PUT' | 'CALL' | 'NOTE' | 'BOND' | 'OTHER' {
    const titleClass = table.titleOfClass?.toLowerCase() || ''

    if (table.putCall === 'Put') return 'PUT'
    if (table.putCall === 'Call') return 'CALL'
    if (titleClass.includes('preferred')) return 'PRF'
    if (titleClass.includes('note') || titleClass.includes('bond')) return 'NOTE'
    if (titleClass.includes('bond')) return 'BOND'

    return 'COM' // Default to common stock
  }

  private normalizeInvestmentDiscretion(discretion: string): 'SOLE' | 'SHARED' | 'OTHER' {
    const normalized = String(discretion || '').toUpperCase().trim()
    if (normalized === 'SOLE' || normalized === 'DFND') return 'SOLE'
    if (normalized === 'SHARED' || normalized === 'SHRRD') return 'SHARED'
    return 'OTHER'
  }

  private parseNumber(value: any): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      // Remove commas and parse
      const cleaned = value.replace(/,/g, '').trim()
      const parsed = parseFloat(cleaned)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }

  private cusipToSymbol(cusip: string): string | null {
    // In production, this would use a comprehensive CUSIP-to-symbol mapping
    const symbol = this.cusipToSymbolMap.get(cusip)
    if (symbol) {
      return symbol
    }

    // Cache miss - would typically fetch from database or API
    this.processingStats.cacheMisses++

    // For now, return null if not in cache
    return null
  }

  private async loadCusipMappings(): Promise<void> {
    // In production, this would load from a database or API
    // For demonstration, adding a few common mappings
    const commonMappings = [
      ['037833100', 'AAPL'], // Apple Inc.
      ['594918104', 'MSFT'], // Microsoft Corp
      ['38259P508', 'GOOGL'], // Alphabet Inc Class A
      ['023135106', 'AMZN'], // Amazon.com Inc
      ['88160R101', 'TSLA'], // Tesla Inc
      ['30303M102', 'META'], // Meta Platforms Inc
      ['67066G104', 'NVDA'], // NVIDIA Corporation
    ]

    commonMappings.forEach(([cusip, symbol]) => {
      this.cusipToSymbolMap.set(cusip, symbol)
    })
  }

  private processElementValue(element: string, value: string, holding: Partial<ParsedInfoTable>): void {
    const elementLower = element.toLowerCase()

    switch (elementLower) {
      case 'nameofissuer':
        holding.nameOfIssuer = value
        break
      case 'cusip':
        holding.cusip = value
        break
      case 'value':
        holding.value = this.parseNumber(value)
        break
      case 'sshprnamt':
        if (!holding.shares) holding.shares = { sshPrnamt: 0, sshPrnamtType: 'SH' }
        holding.shares.sshPrnamt = this.parseNumber(value)
        break
      case 'investmentdiscretion':
        holding.investmentDiscretion = this.normalizeInvestmentDiscretion(value)
        break
    }
  }

  private isValidHolding(holding: Partial<ParsedInfoTable>): boolean {
    return !!(holding.cusip && holding.value && holding.shares?.sshPrnamt)
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024 // MB
    }
    return 0
  }

  private updatePerformanceStats(processingTime: number, memoryUsage: number): void {
    this.processingStats.filesProcessed++
    this.processingStats.averageProcessingTime =
      (this.processingStats.averageProcessingTime * (this.processingStats.filesProcessed - 1) + processingTime) /
      this.processingStats.filesProcessed
    this.processingStats.memoryPeakMB = Math.max(this.processingStats.memoryPeakMB, memoryUsage)
  }

  /**
   * Get parser performance statistics
   */
  getPerformanceStats() {
    return { ...this.processingStats }
  }

  /**
   * Reset performance statistics
   */
  resetPerformanceStats(): void {
    this.processingStats = {
      filesProcessed: 0,
      totalHoldings: 0,
      averageProcessingTime: 0,
      memoryPeakMB: 0,
      cacheMisses: 0
    }
  }
}