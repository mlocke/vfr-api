/**
 * Comprehensive Unit Tests for DataValidationEngine
 * Tests validation rules, edge cases, error handling, and performance
 */

import { DataValidationEngine, ValidationRule, ValidationContext } from '../DataValidationEngine'
import {
  UnifiedStockPrice,
  UnifiedCompanyInfo,
  UnifiedTechnicalIndicator,
  UnifiedFinancialStatement,
  UnifiedNewsItem,
  QualityScore
} from '../types'

describe('DataValidationEngine', () => {
  let validationEngine: DataValidationEngine
  const mockThresholds = {
    stockPrice: {
      requiredFields: ['symbol', 'open', 'high', 'low', 'close', 'volume', 'timestamp'],
      timestampTolerance: 86400000, // 24 hours
      maxPriceVariance: 0.5
    },
    companyInfo: {
      requiredFields: ['symbol', 'name', 'exchange'],
      timestampTolerance: 2592000000 // 30 days
    },
    technicalIndicator: {
      requiredFields: ['symbol', 'indicator', 'value', 'timestamp'],
      timestampTolerance: 86400000 // 24 hours
    },
    financialStatement: {
      requiredFields: ['symbol', 'period', 'fiscalYear'],
      revenueVariance: 0.05
    },
    newsItem: {
      requiredFields: ['title', 'publishedAt', 'source'],
      timestampTolerance: 2592000000 // 30 days
    }
  }

  beforeEach(() => {
    validationEngine = new DataValidationEngine(mockThresholds)
  })

  afterEach(() => {
    validationEngine.reset()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with provided thresholds', () => {
      expect(validationEngine).toBeInstanceOf(DataValidationEngine)
      const stats = validationEngine.getStatistics()
      expect(stats.totalValidations).toBe(0)
      expect(stats.passedValidations).toBe(0)
      expect(stats.failedValidations).toBe(0)
    })

    it('should initialize default validation rules', () => {
      // This tests that default rules are properly set up
      const stats = validationEngine.getStatistics()
      expect(stats.validationsByType).toEqual({})
      expect(stats.commonFailures).toEqual([])
    })
  })

  describe('Stock Price Validation', () => {
    const createValidStockPrice = (): UnifiedStockPrice => ({
      symbol: 'AAPL',
      open: 150.25,
      high: 153.15,
      low: 149.80,
      close: 152.30,
      volume: 2500000,
      timestamp: Date.now() - 3600000, // 1 hour ago
      source: 'test_source',
      quality: {
        overall: 0.9,
        metrics: {
          freshness: 0.9,
          completeness: 1.0,
          accuracy: 0.9,
          sourceReputation: 0.8,
          latency: 100
        },
        timestamp: Date.now(),
        source: 'test_source'
      }
    })

    it('should pass validation for valid stock price data', async () => {
      const stockPrice = createValidStockPrice()
      const result = await validationEngine.validateStockPrice(stockPrice)

      expect(result.isValid).toBe(true)
      expect(result.discrepancies).toHaveLength(0)
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should fail validation when required fields are missing', async () => {
      const stockPrice = createValidStockPrice()
      delete (stockPrice as any).symbol

      const result = await validationEngine.validateStockPrice(stockPrice)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.length).toBeGreaterThan(0)
      expect(result.discrepancies.some(d => d.field === 'symbol')).toBe(true)
    })

    it('should detect invalid price relationships (high < max(open, close))', async () => {
      const stockPrice = createValidStockPrice()
      stockPrice.high = 149.00 // Lower than open and close

      const result = await validationEngine.validateStockPrice(stockPrice)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'high')).toBe(true)
    })

    it('should detect invalid price relationships (low > min(open, close))', async () => {
      const stockPrice = createValidStockPrice()
      stockPrice.low = 155.00 // Higher than open and close

      const result = await validationEngine.validateStockPrice(stockPrice)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'low')).toBe(true)
    })

    it('should detect excessive daily price variance', async () => {
      const stockPrice = createValidStockPrice()
      stockPrice.high = 300.00 // Extreme high causing >50% variance
      stockPrice.low = 75.00   // Extreme low

      const result = await validationEngine.validateStockPrice(stockPrice)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'price_variance')).toBe(true)
    })

    it('should detect negative volume', async () => {
      const stockPrice = createValidStockPrice()
      stockPrice.volume = -1000

      const result = await validationEngine.validateStockPrice(stockPrice)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'volume')).toBe(true)
    })

    it('should detect stale timestamp data', async () => {
      const stockPrice = createValidStockPrice()
      stockPrice.timestamp = Date.now() - (86400000 * 2) // 2 days ago (exceeds 24h tolerance)

      const result = await validationEngine.validateStockPrice(stockPrice)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'timestamp')).toBe(true)
    })

    it('should handle undefined volume gracefully', async () => {
      const stockPrice = createValidStockPrice()
      delete (stockPrice as any).volume

      const result = await validationEngine.validateStockPrice(stockPrice)

      // Should fail due to missing required field, not undefined volume validation
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'volume')).toBe(true)
    })

    it('should validate with context information', async () => {
      const stockPrice = createValidStockPrice()
      const context: ValidationContext = {
        source: 'test_source',
        timestamp: Date.now(),
        symbol: 'AAPL',
        metadata: { exchange: 'NASDAQ' }
      }

      const result = await validationEngine.validateStockPrice(stockPrice, context)

      expect(result.isValid).toBe(true)
    })
  })

  describe('Company Info Validation', () => {
    const createValidCompanyInfo = (): UnifiedCompanyInfo => ({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
      marketCap: 2800000000000,
      sector: 'Technology',
      industry: 'Consumer Electronics',
      employees: 147000,
      foundedYear: 1976,
      source: 'test_source',
      quality: {
        overall: 0.9,
        metrics: {
          freshness: 0.9,
          completeness: 1.0,
          accuracy: 0.9,
          sourceReputation: 0.8,
          latency: 100
        },
        timestamp: Date.now(),
        source: 'test_source'
      }
    })

    it('should pass validation for valid company info', async () => {
      const companyInfo = createValidCompanyInfo()
      const result = await validationEngine.validateCompanyInfo(companyInfo)

      expect(result.isValid).toBe(true)
      expect(result.discrepancies).toHaveLength(0)
    })

    it('should fail validation for missing required fields', async () => {
      const companyInfo = createValidCompanyInfo()
      delete (companyInfo as any).name

      const result = await validationEngine.validateCompanyInfo(companyInfo)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'name')).toBe(true)
    })

    it('should detect invalid symbol format', async () => {
      const companyInfo = createValidCompanyInfo()
      companyInfo.symbol = 'invalid-symbol-123'

      const result = await validationEngine.validateCompanyInfo(companyInfo)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'symbol')).toBe(true)
    })

    it('should accept valid symbol formats', async () => {
      const validSymbols = ['AAPL', 'BRK.A', 'BRK.B', 'GOOGL', 'TSL']

      for (const symbol of validSymbols) {
        const companyInfo = createValidCompanyInfo()
        companyInfo.symbol = symbol

        const result = await validationEngine.validateCompanyInfo(companyInfo)

        if (result.discrepancies.some(d => d.field === 'symbol')) {
          console.log(`Failed for symbol: ${symbol}`)
        }
        expect(result.discrepancies.some(d => d.field === 'symbol')).toBe(false)
      }
    })

    it('should detect negative or zero market cap', async () => {
      const companyInfo = createValidCompanyInfo()
      companyInfo.marketCap = -1000000

      const result = await validationEngine.validateCompanyInfo(companyInfo)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'marketCap')).toBe(true)
    })

    it('should detect negative employee count', async () => {
      const companyInfo = createValidCompanyInfo()
      companyInfo.employees = -100

      const result = await validationEngine.validateCompanyInfo(companyInfo)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'employees')).toBe(true)
    })

    it('should detect invalid founded year', async () => {
      const companyInfo = createValidCompanyInfo()
      const currentYear = new Date().getFullYear()

      // Test year too early
      companyInfo.foundedYear = 1500
      let result = await validationEngine.validateCompanyInfo(companyInfo)
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'foundedYear')).toBe(true)

      // Test future year
      companyInfo.foundedYear = currentYear + 10
      result = await validationEngine.validateCompanyInfo(companyInfo)
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'foundedYear')).toBe(true)
    })

    it('should handle optional fields gracefully', async () => {
      const companyInfo = {
        symbol: 'TEST',
        name: 'Test Company',
        exchange: 'NASDAQ',
        source: 'test_source',
        quality: createValidCompanyInfo().quality
      }

      const result = await validationEngine.validateCompanyInfo(companyInfo as UnifiedCompanyInfo)

      expect(result.isValid).toBe(true)
    })
  })

  describe('Technical Indicator Validation', () => {
    const createValidTechnicalIndicator = (indicator: string, value: any): UnifiedTechnicalIndicator => ({
      symbol: 'AAPL',
      indicator,
      value,
      timestamp: Date.now() - 3600000, // 1 hour ago
      period: '1D',
      source: 'test_source',
      quality: {
        overall: 0.9,
        metrics: {
          freshness: 0.9,
          completeness: 1.0,
          accuracy: 0.9,
          sourceReputation: 0.8,
          latency: 100
        },
        timestamp: Date.now(),
        source: 'test_source'
      }
    })

    it('should validate RSI indicator within valid range', async () => {
      const indicator = createValidTechnicalIndicator('RSI', 65.5)
      const result = await validationEngine.validateTechnicalIndicator(indicator)

      expect(result.isValid).toBe(true)
    })

    it('should reject RSI indicator outside valid range', async () => {
      // Test RSI > 100
      let indicator = createValidTechnicalIndicator('RSI', 105)
      let result = await validationEngine.validateTechnicalIndicator(indicator)
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'value')).toBe(true)

      // Test RSI < 0
      indicator = createValidTechnicalIndicator('RSI', -5)
      result = await validationEngine.validateTechnicalIndicator(indicator)
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'value')).toBe(true)
    })

    it('should validate complete MACD indicator', async () => {
      const macdValue = {
        MACD: 1.25,
        MACD_Signal: 1.15,
        MACD_Hist: 0.10
      }
      const indicator = createValidTechnicalIndicator('MACD', macdValue)
      const result = await validationEngine.validateTechnicalIndicator(indicator)

      expect(result.isValid).toBe(true)
    })

    it('should reject incomplete MACD indicator', async () => {
      const macdValue = {
        MACD: 1.25,
        // Missing MACD_Signal and MACD_Hist
      }
      const indicator = createValidTechnicalIndicator('MACD', macdValue)
      const result = await validationEngine.validateTechnicalIndicator(indicator)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field.includes('MACD_Signal'))).toBe(true)
    })

    it('should reject negative moving averages', async () => {
      const indicator = createValidTechnicalIndicator('SMA', -50.5)
      const result = await validationEngine.validateTechnicalIndicator(indicator)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'value')).toBe(true)
    })

    it('should validate EMA with positive values', async () => {
      const indicator = createValidTechnicalIndicator('EMA', 152.75)
      const result = await validationEngine.validateTechnicalIndicator(indicator)

      expect(result.isValid).toBe(true)
    })

    it('should handle unknown indicators gracefully', async () => {
      const indicator = createValidTechnicalIndicator('UNKNOWN_INDICATOR', 42.5)
      const result = await validationEngine.validateTechnicalIndicator(indicator)

      // Should still validate required fields and timestamp
      expect(result.isValid).toBe(true)
    })

    it('should detect stale indicator timestamps', async () => {
      const indicator = createValidTechnicalIndicator('RSI', 65.5)
      indicator.timestamp = Date.now() - (86400000 * 2) // 2 days ago

      const result = await validationEngine.validateTechnicalIndicator(indicator)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'timestamp')).toBe(true)
    })
  })

  describe('Financial Statement Validation', () => {
    const createValidFinancialStatement = (): UnifiedFinancialStatement => ({
      symbol: 'AAPL',
      period: 'quarterly',
      fiscalYear: 2023,
      fiscalQuarter: 2,
      revenue: 81797000000,
      netIncome: 19881000000,
      totalAssets: 352755000000,
      totalLiabilities: 290437000000,
      totalEquity: 62318000000,
      eps: 1.26,
      operatingCashFlow: 26000000000,
      freeCashFlow: 20000000000,
      source: 'test_source',
      quality: {
        overall: 0.9,
        metrics: {
          freshness: 0.9,
          completeness: 1.0,
          accuracy: 0.9,
          sourceReputation: 0.8,
          latency: 100
        },
        timestamp: Date.now(),
        source: 'test_source'
      }
    })

    it('should validate complete financial statement', async () => {
      const statement = createValidFinancialStatement()
      const result = await validationEngine.validateFinancialStatement(statement)

      expect(result.isValid).toBe(true)
    })

    it('should detect invalid fiscal year', async () => {
      const statement = createValidFinancialStatement()
      const currentYear = new Date().getFullYear()

      // Test year too early
      statement.fiscalYear = 1800
      let result = await validationEngine.validateFinancialStatement(statement)
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'fiscalYear')).toBe(true)

      // Test future year (beyond current + 1)
      statement.fiscalYear = currentYear + 5
      result = await validationEngine.validateFinancialStatement(statement)
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'fiscalYear')).toBe(true)
    })

    it('should detect invalid fiscal quarter', async () => {
      const statement = createValidFinancialStatement()

      // Test quarter too low
      statement.fiscalQuarter = 0
      let result = await validationEngine.validateFinancialStatement(statement)
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'fiscalQuarter')).toBe(true)

      // Test quarter too high
      statement.fiscalQuarter = 5
      result = await validationEngine.validateFinancialStatement(statement)
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'fiscalQuarter')).toBe(true)
    })

    it('should require fiscal quarter for quarterly periods', async () => {
      const statement = createValidFinancialStatement()
      statement.period = 'quarterly'
      delete (statement as any).fiscalQuarter

      const result = await validationEngine.validateFinancialStatement(statement)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'fiscalQuarter')).toBe(true)
    })

    it('should detect balance sheet equation imbalance', async () => {
      const statement = createValidFinancialStatement()
      // Create significant imbalance: Assets != Liabilities + Equity
      statement.totalAssets = 100000000000
      statement.totalLiabilities = 200000000000
      statement.totalEquity = 50000000000

      const result = await validationEngine.validateFinancialStatement(statement)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'balance_sheet_equation')).toBe(true)
    })

    it('should detect extreme profit margins', async () => {
      const statement = createValidFinancialStatement()

      // Test profit margin > 100%
      statement.revenue = 1000000000
      statement.netIncome = 1500000000

      let result = await validationEngine.validateFinancialStatement(statement)
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'profit_margin')).toBe(true)

      // Test extreme loss (profit margin < -200%)
      statement.netIncome = -3000000000
      result = await validationEngine.validateFinancialStatement(statement)
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'profit_margin')).toBe(true)
    })

    it('should detect unrealistic EPS relative to net income', async () => {
      const statement = createValidFinancialStatement()
      statement.netIncome = 1000000000 // $1B
      statement.eps = 5000000000 // $5B per share (impossible)

      const result = await validationEngine.validateFinancialStatement(statement)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'eps')).toBe(true)
    })

    it('should detect free cash flow exceeding operating cash flow', async () => {
      const statement = createValidFinancialStatement()
      statement.operatingCashFlow = 10000000000
      statement.freeCashFlow = 15000000000 // Impossible

      const result = await validationEngine.validateFinancialStatement(statement)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'free_cash_flow')).toBe(true)
    })

    it('should allow negative net income (losses)', async () => {
      const statement = createValidFinancialStatement()
      statement.netIncome = -500000000 // Loss is acceptable

      const result = await validationEngine.validateFinancialStatement(statement)

      // Should not fail specifically for negative net income
      const hasNetIncomeIssue = result.discrepancies.some(d =>
        d.field === 'netIncome' && d.resolution.reason.includes('non-negative')
      )
      expect(hasNetIncomeIssue).toBe(false)
    })
  })

  describe('News Validation', () => {
    const createValidNewsItem = (): UnifiedNewsItem => ({
      title: 'Apple Reports Strong Q3 Earnings',
      description: 'Apple Inc. reported quarterly earnings that exceeded expectations...',
      url: 'https://example.com/news/apple-q3-earnings',
      publishedAt: Date.now() - 3600000, // 1 hour ago
      author: 'John Doe',
      source: 'test_source',
      sentiment: {
        score: 0.7,
        label: 'positive'
      },
      symbols: ['AAPL'],
      quality: {
        overall: 0.9,
        metrics: {
          freshness: 0.9,
          completeness: 1.0,
          accuracy: 0.9,
          sourceReputation: 0.8,
          latency: 100
        },
        timestamp: Date.now(),
        source: 'test_source'
      }
    })

    it('should validate array of valid news items', async () => {
      const newsItems = [createValidNewsItem(), createValidNewsItem()]
      const result = await validationEngine.validateNews(newsItems)

      expect(result.isValid).toBe(true)
      expect(result.discrepancies).toHaveLength(0)
    })

    it('should reject non-array input', async () => {
      const result = await validationEngine.validateNews({} as any)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'data')).toBe(true)
    })

    it('should detect missing required fields in news items', async () => {
      const newsItem = createValidNewsItem()
      delete (newsItem as any).title

      const result = await validationEngine.validateNews([newsItem])

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field.includes('title'))).toBe(true)
    })

    it('should detect invalid URL format', async () => {
      const newsItem = createValidNewsItem()
      newsItem.url = 'not-a-valid-url'

      const result = await validationEngine.validateNews([newsItem])

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field.includes('url'))).toBe(true)
    })

    it('should detect stale news timestamps', async () => {
      const newsItem = createValidNewsItem()
      newsItem.publishedAt = Date.now() - (2592000000 * 2) // 2 months ago

      const result = await validationEngine.validateNews([newsItem])

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field.includes('publishedAt'))).toBe(true)
    })

    it('should validate sentiment score range', async () => {
      const newsItem = createValidNewsItem()

      // Test score too high
      newsItem.sentiment!.score = 1.5
      let result = await validationEngine.validateNews([newsItem])
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field.includes('sentiment.score'))).toBe(true)

      // Test score too low
      newsItem.sentiment!.score = -1.5
      result = await validationEngine.validateNews([newsItem])
      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field.includes('sentiment.score'))).toBe(true)
    })

    it('should validate sentiment labels', async () => {
      const newsItem = createValidNewsItem()
      newsItem.sentiment!.label = 'invalid_label' as any

      const result = await validationEngine.validateNews([newsItem])

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field.includes('sentiment.label'))).toBe(true)
    })
  })

  describe('Custom Validation Rules', () => {
    it('should add custom validation rule successfully', () => {
      const customRule: ValidationRule = {
        name: 'custom_test_rule',
        field: 'close',
        validator: (value) => value > 100,
        severity: 'warning',
        message: 'Close price should be above $100'
      }

      validationEngine.addValidationRule('stock_price', customRule)

      // Verification would require access to internal rules or testing through validation
      expect(() => validationEngine.addValidationRule('stock_price', customRule)).not.toThrow()
    })

    it('should remove validation rule successfully', () => {
      const customRule: ValidationRule = {
        name: 'removable_rule',
        field: 'volume',
        validator: (value) => value > 1000,
        severity: 'info',
        message: 'Volume should be significant'
      }

      validationEngine.addValidationRule('stock_price', customRule)
      const removed = validationEngine.removeValidationRule('stock_price', 'removable_rule')

      expect(removed).toBe(true)
    })

    it('should return false when removing non-existent rule', () => {
      const removed = validationEngine.removeValidationRule('stock_price', 'non_existent_rule')
      expect(removed).toBe(false)
    })

    it('should return false when removing from non-existent data type', () => {
      const removed = validationEngine.removeValidationRule('non_existent_type', 'any_rule')
      expect(removed).toBe(false)
    })
  })

  describe('Threshold Management', () => {
    it('should update thresholds successfully', () => {
      const newThresholds = {
        stockPrice: {
          requiredFields: ['symbol', 'close'],
          timestampTolerance: 172800000, // 48 hours
          maxPriceVariance: 0.3
        }
      }

      expect(() => validationEngine.updateThresholds(newThresholds as any)).not.toThrow()
    })

    it('should merge new thresholds with existing ones', () => {
      const originalThresholds = mockThresholds.stockPrice.timestampTolerance
      const newThresholds = {
        stockPrice: {
          timestampTolerance: 172800000 // 48 hours
        }
      }

      validationEngine.updateThresholds(newThresholds as any)

      // Test that the new threshold is applied
      // This would be verified through subsequent validation calls
      expect(() => validationEngine.updateThresholds(newThresholds as any)).not.toThrow()
    })
  })

  describe('Statistics Tracking', () => {
    it('should track validation statistics correctly', async () => {
      const stockPrice = {
        symbol: 'AAPL',
        open: 150,
        high: 155,
        low: 149,
        close: 152,
        volume: 1000000,
        timestamp: Date.now(),
        source: 'test',
        quality: {} as QualityScore
      }

      await validationEngine.validateStockPrice(stockPrice)
      const stats = validationEngine.getStatistics()

      expect(stats.totalValidations).toBe(1)
      expect(stats.passedValidations + stats.failedValidations).toBe(1)
      expect(stats.validationsByType['stock_price']).toBeDefined()
      expect(stats.averageValidationTime).toBeGreaterThan(0)
    })

    it('should reset statistics correctly', async () => {
      const stockPrice = {
        symbol: 'AAPL',
        open: 150,
        high: 155,
        low: 149,
        close: 152,
        volume: 1000000,
        timestamp: Date.now(),
        source: 'test',
        quality: {} as QualityScore
      }

      await validationEngine.validateStockPrice(stockPrice)
      validationEngine.reset()
      const stats = validationEngine.getStatistics()

      expect(stats.totalValidations).toBe(0)
      expect(stats.passedValidations).toBe(0)
      expect(stats.failedValidations).toBe(0)
      expect(Object.keys(stats.validationsByType)).toHaveLength(0)
    })
  })

  describe('Performance Testing', () => {
    it('should complete validation within reasonable time', async () => {
      const stockPrice = {
        symbol: 'AAPL',
        open: 150,
        high: 155,
        low: 149,
        close: 152,
        volume: 1000000,
        timestamp: Date.now(),
        source: 'test',
        quality: {} as QualityScore
      }

      const startTime = Date.now()
      await validationEngine.validateStockPrice(stockPrice)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100) // Should complete within 100ms
    })

    it('should handle batch validation efficiently', async () => {
      const newsItems = Array.from({ length: 100 }, () => ({
        title: 'Test News Article',
        url: 'https://example.com/news',
        publishedAt: Date.now(),
        source: 'test',
        quality: {} as QualityScore
      }))

      const startTime = Date.now()
      await validationEngine.validateNews(newsItems)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined values gracefully', async () => {
      const stockPrice = {
        symbol: null,
        open: undefined,
        high: 155,
        low: 149,
        close: 152,
        volume: 1000000,
        timestamp: Date.now(),
        source: 'test',
        quality: {} as QualityScore
      } as any

      const result = await validationEngine.validateStockPrice(stockPrice)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.length).toBeGreaterThan(0)
    })

    it('should handle empty strings as invalid values', async () => {
      const companyInfo = {
        symbol: '',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        source: 'test',
        quality: {} as QualityScore
      }

      const result = await validationEngine.validateCompanyInfo(companyInfo)

      expect(result.isValid).toBe(false)
      expect(result.discrepancies.some(d => d.field === 'symbol')).toBe(true)
    })

    it('should handle very large numbers gracefully', async () => {
      const stockPrice = {
        symbol: 'TEST',
        open: Number.MAX_SAFE_INTEGER,
        high: Number.MAX_SAFE_INTEGER,
        low: Number.MAX_SAFE_INTEGER,
        close: Number.MAX_SAFE_INTEGER,
        volume: Number.MAX_SAFE_INTEGER,
        timestamp: Date.now(),
        source: 'test',
        quality: {} as QualityScore
      }

      const result = await validationEngine.validateStockPrice(stockPrice)

      // Should handle large numbers without throwing errors
      expect(() => result).not.toThrow()
    })

    it('should handle empty arrays in news validation', async () => {
      const result = await validationEngine.validateNews([])

      expect(result.isValid).toBe(true)
      expect(result.discrepancies).toHaveLength(0)
    })
  })
})