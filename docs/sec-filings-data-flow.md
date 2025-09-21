# SEC Filings Data Flow Architecture

## Overview

This document details the data flow architecture for processing SEC 13F institutional holdings and Form 4 insider trading data in the VFR platform. The design emphasizes real-time processing, compliance with SEC EDGAR requirements, and integration with existing financial analysis pipelines.

## Data Sources and Flow Patterns

### 1. SEC EDGAR API Data Flow

```
SEC EDGAR API (data.sec.gov)
    ↓
Rate-Limited Request Queue (10 req/sec)
    ↓
CIK Resolution Service
    ↓
Parallel Filing Retrieval
    ↓
Data Processing Pipeline
    ↓
Validation & Security Checks
    ↓
Sentiment Analysis Engine
    ↓
Cache Layer (Redis)
    ↓
API Response / Analysis Integration
```

### 2. EdgarTools Python Integration Flow

```
Python EdgarTools Library
    ↓
Form Detection & Retrieval
    ↓
Structured Data Extraction
    ↓
TypeScript Interface Mapping
    ↓
VFR Data Pipeline Integration
```

## Detailed Data Flow Components

### 1. 13F Filings Processing Flow

#### A. Discovery Phase
```typescript
// Step 1: Symbol to CIK Resolution
async resolveCIK(symbol: string): Promise<string | null> {
  // Cache check first
  if (this.symbolToCikCache.has(symbol)) {
    return this.symbolToCikCache.get(symbol)!
  }

  // Fetch company tickers mapping
  const response = await this.makeSecRequest('/files/company_tickers.json')
  // Cache all mappings for efficiency
  this.cacheTickerMappings(response.data)

  return this.symbolToCikCache.get(symbol) || null
}

// Step 2: 13F Filing Discovery
async discover13FFilings(symbol: string, quarters: number): Promise<FilingReference[]> {
  const filings = await this.searchFilings({
    form: ['13F-HR', '13F-HR/A'],
    entityName: await this.getCompanyName(symbol),
    dateRange: this.getQuarterlyDateRange(quarters)
  })

  return filings.sort((a, b) =>
    new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime()
  )
}
```

#### B. Data Extraction Phase
```typescript
// Step 3: Parallel Filing Processing
async process13FFilings(filings: FilingReference[], targetSymbol: string): Promise<InstitutionalHolding[]> {
  const concurrencyLimit = 3 // Respect SEC rate limits
  const holdings: InstitutionalHolding[] = []

  const processingPromises = filings.map(filing =>
    this.rateLimitedProcessor.queue(async () => {
      try {
        const filingData = await this.fetchFiling(filing.accessionNumber)
        const parsedHoldings = await this.parse13FFiling(filingData, targetSymbol)
        return parsedHoldings
      } catch (error) {
        this.errorHandler.logger.warn(`Failed to process 13F filing ${filing.accessionNumber}`, { error })
        return []
      }
    })
  )

  const results = await Promise.allSettled(processingPromises)
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      holdings.push(...result.value)
    }
  })

  return this.deduplicateAndRank(holdings)
}

// Step 4: XML/XBRL Parsing with Memory Optimization
async parse13FFiling(filingData: string, targetSymbol: string): Promise<InstitutionalHolding[]> {
  // Memory check before parsing large filings
  if (filingData.length > this.memoryThreshold) {
    return this.parseStreamingXML(filingData, targetSymbol)
  }

  // Standard parsing for smaller filings
  const parsed = this.xmlParser.parse(filingData)
  return this.extractHoldingsFromXBRL(parsed, targetSymbol)
}
```

#### C. Data Transformation Phase
```typescript
// Step 5: Holdings Data Transformation
private transformHoldingData(rawHolding: any, filing: FilingReference): InstitutionalHolding {
  return {
    symbol: this.normalizeSymbol(rawHolding.issuerName),
    cusip: rawHolding.cusip,
    securityName: rawHolding.nameOfIssuer,
    managerName: filing.companyName,
    managerId: filing.cik,
    reportDate: filing.periodOfReport,
    filingDate: filing.filingDate,
    shares: this.parseInt(rawHolding.shrsOrPrnAmt?.sshPrnamt),
    marketValue: this.parseNumeric(rawHolding.value) * 1000, // SEC reports in thousands
    percentOfPortfolio: this.calculatePortfolioPercentage(rawHolding.value, filing.totalValue),
    isNewPosition: this.isNewPosition(rawHolding, filing.previousFiling),
    isClosedPosition: false,
    rank: 0, // Will be calculated after aggregation
    securityType: this.mapSecurityType(rawHolding.titleOfClass),
    votingAuthority: {
      sole: this.parseInt(rawHolding.votingAuthority?.sole),
      shared: this.parseInt(rawHolding.votingAuthority?.shared),
      none: this.parseInt(rawHolding.votingAuthority?.none)
    },
    investmentDiscretion: this.mapInvestmentDiscretion(rawHolding.investmentDiscretion),
    timestamp: Date.now(),
    source: this.getSourceIdentifier(),
    accessionNumber: filing.accessionNumber
  }
}
```

### 2. Form 4 Insider Trading Processing Flow

#### A. Discovery & Retrieval Phase
```typescript
// Step 1: Form 4 Filing Discovery
async discoverForm4Filings(cik: string, days: number): Promise<FilingReference[]> {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))

  const filings = await this.searchFilings({
    form: ['4', '4/A', '5', '5/A'],
    cik: cik,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  })

  return filings.sort((a, b) =>
    new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime()
  )
}

// Step 2: Real-time Form 4 Processing
async processForm4Filings(filings: FilingReference[], targetSymbol: string): Promise<InsiderTransaction[]> {
  const transactions: InsiderTransaction[] = []

  // Higher concurrency for smaller Form 4 documents
  const concurrencyLimit = 5

  const processingPromises = filings.map(filing =>
    this.rateLimitedProcessor.queue(async () => {
      try {
        const filingData = await this.fetchFiling(filing.accessionNumber)
        const parsedTransactions = await this.parseForm4Filing(filingData, targetSymbol, filing)
        return parsedTransactions
      } catch (error) {
        this.errorHandler.logger.warn(`Failed to process Form 4 filing ${filing.accessionNumber}`, { error })
        return []
      }
    })
  )

  const results = await Promise.allSettled(processingPromises)
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      transactions.push(...result.value)
    }
  })

  return this.sortTransactionsByDate(transactions)
}
```

#### B. Transaction Data Extraction
```typescript
// Step 3: Form 4 XML/XBRL Parsing
async parseForm4Filing(
  filingData: string,
  targetSymbol: string,
  filing: FilingReference
): Promise<InsiderTransaction[]> {
  const parsed = this.xmlParser.parse(filingData)
  const form4 = parsed.ownershipDocument || parsed.form4

  if (!form4) {
    throw new Error('Invalid Form 4 structure')
  }

  const transactions: InsiderTransaction[] = []

  // Handle multiple transactions in single filing
  const transactionEntries = Array.isArray(form4.nonDerivativeTable?.nonDerivativeTransaction)
    ? form4.nonDerivativeTable.nonDerivativeTransaction
    : [form4.nonDerivativeTable?.nonDerivativeTransaction].filter(Boolean)

  for (const transaction of transactionEntries) {
    const transformedTransaction = this.transformTransactionData(
      transaction,
      form4.reportingOwner,
      form4.issuer,
      filing
    )

    if (transformedTransaction && transformedTransaction.symbol === targetSymbol) {
      transactions.push(transformedTransaction)
    }
  }

  // Handle derivative transactions
  const derivativeEntries = Array.isArray(form4.derivativeTable?.derivativeTransaction)
    ? form4.derivativeTable.derivativeTransaction
    : [form4.derivativeTable?.derivativeTransaction].filter(Boolean)

  for (const derivative of derivativeEntries) {
    const transformedDerivative = this.transformDerivativeData(
      derivative,
      form4.reportingOwner,
      form4.issuer,
      filing
    )

    if (transformedDerivative && transformedDerivative.symbol === targetSymbol) {
      transactions.push(transformedDerivative)
    }
  }

  return transactions
}

// Step 4: Transaction Data Transformation
private transformTransactionData(
  transaction: any,
  reportingOwner: any,
  issuer: any,
  filing: FilingReference
): InsiderTransaction {
  const transactionCode = transaction.transactionCode?.value || transaction.transactionCode

  return {
    symbol: this.normalizeSymbol(issuer.issuerTradingSymbol),
    companyName: issuer.issuerName,
    reportingOwnerName: `${reportingOwner.reportingOwnerId?.rptOwnerName}`,
    reportingOwnerTitle: reportingOwner.reportingOwnerRelationship?.officerTitle,
    reportingOwnerId: reportingOwner.reportingOwnerId?.rptOwnerCik,
    relationship: this.extractRelationships(reportingOwner.reportingOwnerRelationship),
    transactionDate: transaction.transactionDate?.value,
    filingDate: filing.filingDate,
    transactionCode: transactionCode,
    transactionType: this.mapTransactionType(transactionCode),
    securityTitle: transaction.securityTitle?.value,
    shares: this.parseNumeric(transaction.transactionAmounts?.transactionShares?.value),
    pricePerShare: this.parseNumeric(transaction.transactionAmounts?.transactionPricePerShare?.value),
    transactionValue: this.calculateTransactionValue(
      transaction.transactionAmounts?.transactionShares?.value,
      transaction.transactionAmounts?.transactionPricePerShare?.value
    ),
    sharesOwnedAfter: this.parseNumeric(transaction.postTransactionAmounts?.sharesOwnedFollowingTransaction?.value),
    ownershipType: transaction.ownershipNature?.directOrIndirectOwnership?.value === 'D' ? 'D' : 'I',
    ownershipNature: transaction.ownershipNature?.natureOfOwnership?.value,
    isAmendment: filing.formType?.includes('/A') || false,
    isDerivative: false,
    confidence: this.calculateDataConfidence(transaction, filing),
    timestamp: Date.now(),
    source: this.getSourceIdentifier(),
    accessionNumber: filing.accessionNumber,
    formType: filing.formType as '3' | '4' | '4/A' | '5' | '5/A'
  }
}
```

### 3. Real-time Data Processing Pipeline

#### A. Streaming Data Pipeline
```typescript
class RealTimeFilingProcessor {
  private websocketConnection?: WebSocket
  private processingQueue: FilingReference[] = []
  private isProcessing = false

  // Real-time filing monitoring (future enhancement)
  async initializeRealTimeMonitoring(): Promise<void> {
    // Monitor for new filings via RSS feeds or WebSocket when available
    const rssFeeds = [
      'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&output=atom',
      'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=13F&output=atom'
    ]

    for (const feed of rssFeeds) {
      this.monitorRSSFeed(feed)
    }
  }

  // Batch processing for efficiency
  async processBatch(filings: FilingReference[]): Promise<void> {
    if (this.isProcessing) {
      this.processingQueue.push(...filings)
      return
    }

    this.isProcessing = true

    try {
      const batchSize = 10
      for (let i = 0; i < filings.length; i += batchSize) {
        const batch = filings.slice(i, i + batchSize)
        await this.processBatchChunk(batch)

        // Rate limiting between batches
        if (i + batchSize < filings.length) {
          await this.delay(this.RATE_LIMIT_DELAY * batchSize)
        }
      }
    } finally {
      this.isProcessing = false

      // Process queued filings
      if (this.processingQueue.length > 0) {
        const queued = [...this.processingQueue]
        this.processingQueue = []
        setImmediate(() => this.processBatch(queued))
      }
    }
  }
}
```

#### B. Data Quality and Validation Pipeline
```typescript
class DataQualityProcessor {
  // Multi-stage validation pipeline
  async validateAndEnrich(data: InstitutionalHolding | InsiderTransaction): Promise<ValidationResult> {
    const validationStages = [
      this.validateDataStructure,
      this.validateBusinessRules,
      this.detectAnomalies,
      this.enrichWithMetadata,
      this.calculateConfidenceScore
    ]

    let validatedData = { ...data }
    const validationResults = []

    for (const stage of validationStages) {
      try {
        const result = await stage(validatedData)
        validatedData = result.data
        validationResults.push(result.metadata)
      } catch (error) {
        this.errorHandler.logger.warn(`Validation stage failed`, { error, stage: stage.name })
        validationResults.push({ stage: stage.name, error: error.message })
      }
    }

    return {
      data: validatedData,
      isValid: validationResults.every(r => !r.error),
      validationResults,
      confidence: this.calculateOverallConfidence(validationResults)
    }
  }

  // Business rule validation
  private async validateBusinessRules(data: any): Promise<ValidationStageResult> {
    const rules = []

    if ('shares' in data) {
      rules.push(this.validateShareCount(data.shares))
      rules.push(this.validateMarketValue(data.marketValue, data.shares))
    }

    if ('transactionDate' in data) {
      rules.push(this.validateTransactionDate(data.transactionDate))
      rules.push(this.validateFilingDelay(data.transactionDate, data.filingDate))
    }

    const ruleResults = await Promise.allSettled(rules)
    const failures = ruleResults.filter(r => r.status === 'rejected')

    return {
      data,
      metadata: {
        stage: 'businessRules',
        rulesChecked: rules.length,
        ruleFailures: failures.length,
        issues: failures.map(f => f.reason)
      }
    }
  }
}
```

### 4. Performance Optimization Patterns

#### A. Memory Management for Large Filings
```typescript
class MemoryOptimizedParser {
  private readonly MEMORY_THRESHOLD = 100 * 1024 * 1024 // 100MB

  async parseOptimized(filingData: string, targetSymbol: string): Promise<any[]> {
    if (filingData.length > this.MEMORY_THRESHOLD) {
      return this.parseStreaming(filingData, targetSymbol)
    }

    return this.parseInMemory(filingData, targetSymbol)
  }

  // Streaming parser for large 13F filings
  private async parseStreaming(content: string, targetSymbol: string): Promise<any[]> {
    const results = []
    const chunkSize = 1024 * 1024 // 1MB chunks

    for (let offset = 0; offset < content.length; offset += chunkSize) {
      const chunk = content.substring(offset, offset + chunkSize)
      const chunkResults = await this.parseChunk(chunk, targetSymbol)
      results.push(...chunkResults)

      // Garbage collection hint for large chunks
      if (global.gc && offset % (chunkSize * 10) === 0) {
        global.gc()
      }
    }

    return results
  }
}
```

#### B. Intelligent Caching Strategy
```typescript
class IntelligentCache {
  // Dynamic TTL based on data characteristics
  calculateOptimalTTL(data: any, dataType: string): number {
    const baseTTL = {
      'institutional_holdings': 6 * 3600,    // 6 hours
      'insider_transactions': 2 * 3600,      // 2 hours
      'composite_intelligence': 4 * 3600     // 4 hours
    }

    // Factors affecting cache duration
    const factors = {
      dataFreshness: this.calculateFreshnessFactor(data),
      dataVolume: this.calculateVolumeFactor(data),
      marketHours: this.isMarketHours() ? 0.5 : 1.0,
      dataQuality: data.confidence || 0.8
    }

    // Weighted TTL calculation
    const weightedMultiplier = Object.values(factors).reduce((acc, factor) => acc * factor, 1)
    const adjustedTTL = baseTTL[dataType] * Math.max(0.1, Math.min(2.0, weightedMultiplier))

    return Math.floor(adjustedTTL)
  }

  // Cache warming for frequently accessed data
  async warmCache(symbols: string[]): Promise<void> {
    const warmingPromises = symbols.map(async symbol => {
      try {
        // Pre-fetch and cache frequently requested data
        const intelligence = await this.institutionalService.getInstitutionalIntelligence(symbol)
        const cacheKey = `institutional:intelligence:${symbol}`
        const ttl = this.calculateOptimalTTL(intelligence, 'composite_intelligence')

        await redisCache.set(cacheKey, intelligence, ttl, {
          source: 'cache_warming',
          version: '1.0.0'
        })
      } catch (error) {
        this.errorHandler.logger.warn(`Cache warming failed for ${symbol}`, { error })
      }
    })

    await Promise.allSettled(warmingPromises)
  }
}
```

### 5. Error Recovery and Resilience

#### A. Circuit Breaker Pattern
```typescript
class SECEdgarCircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  async executeWithCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.RECOVERY_TIMEOUT) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN - SEC EDGAR temporarily unavailable')
      }
    }

    try {
      const result = await operation()

      if (this.state === 'HALF_OPEN') {
        this.reset()
      }

      return result
    } catch (error) {
      this.recordFailure()

      if (this.failureCount >= this.FAILURE_THRESHOLD) {
        this.state = 'OPEN'
        this.lastFailureTime = Date.now()
      }

      throw error
    }
  }

  private reset(): void {
    this.failureCount = 0
    this.state = 'CLOSED'
  }

  private recordFailure(): void {
    this.failureCount++
  }
}
```

#### B. Graceful Degradation
```typescript
class GracefulDegradationHandler {
  async getInstitutionalDataWithFallback(symbol: string): Promise<InstitutionalIntelligence | null> {
    const fallbackStrategies = [
      () => this.getFromPrimarySource(symbol),
      () => this.getFromCache(symbol, true), // Allow stale cache
      () => this.getFromSecondarySource(symbol),
      () => this.generateMinimalIntelligence(symbol)
    ]

    for (const strategy of fallbackStrategies) {
      try {
        const result = await strategy()
        if (result) {
          return result
        }
      } catch (error) {
        this.errorHandler.logger.warn('Fallback strategy failed', { error, strategy: strategy.name })
        continue
      }
    }

    return null
  }

  private async generateMinimalIntelligence(symbol: string): Promise<InstitutionalIntelligence> {
    // Return basic structure with neutral sentiment when all else fails
    return {
      symbol,
      reportDate: new Date().toISOString().split('T')[0],
      compositeScore: 5, // Neutral score
      weightedSentiment: 'NEUTRAL',
      keyInsights: ['Institutional data temporarily unavailable'],
      riskFactors: ['Data completeness limited'],
      opportunities: [],
      dataQuality: {
        institutionalDataAvailable: false,
        insiderDataAvailable: false,
        dataFreshness: 999,
        completeness: 0
      },
      timestamp: Date.now(),
      source: 'fallback_generator'
    }
  }
}
```

## Data Flow Summary

The SEC filings data flow architecture provides:

1. **Compliant Access**: Respects SEC EDGAR rate limits and access patterns
2. **Real-time Processing**: Handles Form 4 filings within hours of submission
3. **Scalable Architecture**: Processes large 13F filings efficiently
4. **Robust Error Handling**: Circuit breakers and graceful degradation
5. **Performance Optimization**: Memory management and intelligent caching
6. **Data Quality**: Multi-stage validation and confidence scoring
7. **Integration Ready**: Seamless integration with existing VFR systems

This architecture ensures reliable, performant access to institutional and insider trading data while maintaining compliance with SEC requirements and integrating smoothly with the existing financial analysis platform.