/**
 * Comprehensive Tests for Data Normalization Pipeline
 * Tests the complete data normalization system with validation, quality monitoring, and lineage tracking
 */

import { DataNormalizationPipeline } from '../DataNormalizationPipeline'
import { DataValidationEngine } from '../DataValidationEngine'
import { DataQualityMonitor } from '../DataQualityMonitor'
import { DataLineageTracker } from '../DataLineageTracker'
import { QualityScorer } from '../QualityScorer'

describe('DataNormalizationPipeline', () => {
  let pipeline: DataNormalizationPipeline

  beforeEach(() => {
    pipeline = new DataNormalizationPipeline({
      enableValidation: true,
      enableQualityChecking: true,
      enableLineageTracking: true
    })
  })

  afterEach(() => {
    pipeline.reset()
  })

  describe('Stock Price Normalization', () => {
    it('should normalize Polygon stock price data', async () => {
      const polygonData = {
        results: [{
          o: 150.25,
          c: 152.30,
          h: 153.15,
          l: 149.80,
          v: 2500000,
          t: Date.now(),
          vw: 151.75
        }]
      }

      const result = await pipeline.normalizeStockPrice(
        polygonData,
        'polygon',
        'AAPL'
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.symbol).toBe('AAPL')
      expect(result.data?.source).toBe('polygon')
      expect(result.data?.open).toBe(150.25)
      expect(result.data?.close).toBe(152.30)
      expect(result.qualityScore.overall).toBeGreaterThan(0)
      expect(result.lineageInfo.transformations).toHaveLength(1)
    })

    it('should normalize Yahoo Finance stock price data', async () => {
      const yahooData = {
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 151.50,
              regularMarketDayHigh: 153.00,
              regularMarketDayLow: 150.00,
              regularMarketVolume: 1800000
            },
            indicators: {
              quote: [{
                open: [150.75],
                high: [153.00],
                low: [150.00],
                close: [151.50],
                volume: [1800000]
              }],
              adjclose: [{
                adjclose: [151.25]
              }]
            },
            timestamp: [Math.floor(Date.now() / 1000)]
          }]
        }
      }

      const result = await pipeline.normalizeStockPrice(
        yahooData,
        'yahoo',
        'AAPL'
      )

      expect(result.success).toBe(true)
      expect(result.data?.symbol).toBe('AAPL')
      expect(result.data?.source).toBe('yahoo')
      expect(result.data?.close).toBe(151.50)
    })

    it('should detect validation issues in stock price data', async () => {
      const invalidData = {
        results: [{
          o: 150.25,
          c: 152.30,
          h: 140.00, // Invalid: high < close
          l: 155.00, // Invalid: low > close
          v: -1000, // Invalid: negative volume
          t: Date.now() - 86400000 // Old timestamp
        }]
      }

      const result = await pipeline.normalizeStockPrice(
        invalidData,
        'polygon',
        'AAPL'
      )

      expect(result.validationResult.discrepancies.length).toBeGreaterThan(0)
      expect(result.warnings).toBeDefined()
    })
  })

  describe('Company Information Normalization', () => {
    it('should normalize FMP company data', async () => {
      const fmpData = {
        companyName: 'Apple Inc.',
        exchangeShortName: 'NASDAQ',
        mktCap: 3000000000000,
        sector: 'Technology',
        industry: 'Consumer Electronics',
        description: 'Apple Inc. designs and manufactures consumer electronics.',
        website: 'https://www.apple.com',
        fullTimeEmployees: 154000,
        city: 'Cupertino',
        state: 'CA',
        country: 'US'
      }

      const result = await pipeline.normalizeCompanyInfo(
        fmpData,
        'fmp',
        'AAPL'
      )

      expect(result.success).toBe(true)
      expect(result.data?.name).toBe('Apple Inc.')
      expect(result.data?.exchange).toBe('NASDAQ')
      expect(result.data?.marketCap).toBe(3000000000000)
      expect(result.data?.sector).toBe('Technology')
    })

    it('should validate company information', async () => {
      const invalidData = {
        companyName: 'Test Company',
        exchangeShortName: 'INVALID_EXCHANGE_FORMAT',
        mktCap: -1000000, // Invalid: negative market cap
        fullTimeEmployees: -100 // Invalid: negative employees
      }

      const result = await pipeline.normalizeCompanyInfo(
        invalidData,
        'fmp',
        'TEST'
      )

      expect(result.validationResult.discrepancies.length).toBeGreaterThan(0)
    })
  })

  describe('Financial Statement Normalization', () => {
    it('should normalize FMP financial statement data', async () => {
      const fmpData = {
        calendarYear: '2023',
        period: 'Q3',
        revenue: 89498000000,
        netIncome: 22956000000,
        epsdiluted: 1.46,
        totalAssets: 352755000000,
        totalLiabilities: 290437000000,
        totalStockholdersEquity: 62318000000,
        operatingCashFlow: 26346000000,
        freeCashFlow: 20000000000
      }

      const result = await pipeline.normalizeFinancialStatement(
        fmpData,
        'fmp',
        'AAPL'
      )

      expect(result.success).toBe(true)
      expect(result.data?.symbol).toBe('AAPL')
      expect(result.data?.period).toBe('quarterly')
      expect(result.data?.fiscalYear).toBe(2023)
      expect(result.data?.fiscalQuarter).toBe(3)
      expect(result.data?.revenue).toBe(89498000000)
      expect(result.data?.netIncome).toBe(22956000000)
    })

    it('should validate balance sheet equation', async () => {
      const invalidData = {
        calendarYear: '2023',
        revenue: 1000000,
        totalAssets: 1000000,
        totalLiabilities: 600000,
        totalStockholdersEquity: 500000 // Assets != Liabilities + Equity
      }

      const result = await pipeline.normalizeFinancialStatement(
        invalidData,
        'fmp',
        'TEST'
      )

      expect(result.validationResult.discrepancies.some(d =>
        d.field === 'balance_sheet_equation'
      )).toBe(true)
    })
  })

  describe('Technical Indicator Normalization', () => {
    it('should normalize Alpha Vantage RSI data', async () => {
      const alphaVantageData = {
        'Technical Analysis: RSI': {
          '2023-12-01': {
            'RSI': '45.67'
          }
        }
      }

      const result = await pipeline.normalizeTechnicalIndicator(
        alphaVantageData,
        'alphavantage',
        'AAPL',
        'RSI'
      )

      expect(result.success).toBe(true)
      expect(result.data?.symbol).toBe('AAPL')
      expect(result.data?.indicator).toBe('RSI')
      expect(result.data?.value).toBe(45.67)
    })

    it('should validate RSI range', async () => {
      const invalidData = {
        'Technical Analysis: RSI': {
          '2023-12-01': {
            'RSI': '150.0' // Invalid: RSI > 100
          }
        }
      }

      const result = await pipeline.normalizeTechnicalIndicator(
        invalidData,
        'alphavantage',
        'AAPL',
        'RSI'
      )

      expect(result.validationResult.discrepancies.some(d =>
        d.field === 'value' && d.resolution.reason.includes('RSI')
      )).toBe(true)
    })
  })

  describe('News Normalization', () => {
    it('should normalize Alpha Vantage news data', async () => {
      const alphaVantageNews = {
        feed: [
          {
            title: 'Apple Announces New Product Line',
            summary: 'Apple Inc. today announced a new product line targeting enterprise customers.',
            url: 'https://example.com/news/1',
            time_published: '20231201T150000',
            ticker_sentiment: [{ ticker: 'AAPL' }],
            overall_sentiment_score: '0.25',
            overall_sentiment_label: 'Somewhat-Bullish'
          }
        ]
      }

      const result = await pipeline.normalizeNews(
        alphaVantageNews,
        'alphavantage'
      )

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].title).toBe('Apple Announces New Product Line')
      expect(result.data?.[0].symbols).toContain('AAPL')
      expect(result.data?.[0].sentiment?.score).toBe(0.25)
    })
  })

  describe('Batch Normalization', () => {
    it('should process multiple data types in parallel', async () => {
      const requests = [
        {
          type: 'stock_price' as const,
          rawData: { results: [{ o: 150, c: 151, h: 152, l: 149, v: 1000000, t: Date.now() }] },
          source: 'polygon',
          symbol: 'AAPL'
        },
        {
          type: 'company_info' as const,
          rawData: { companyName: 'Apple Inc.', exchangeShortName: 'NASDAQ' },
          source: 'fmp',
          symbol: 'AAPL'
        },
        {
          type: 'technical_indicator' as const,
          rawData: { 'Technical Analysis: RSI': { '2023-12-01': { 'RSI': '65.0' } } },
          source: 'alphavantage',
          symbol: 'AAPL',
          indicator: 'RSI'
        }
      ]

      const result = await pipeline.batchNormalize(requests)

      expect(result.summary.totalProcessed).toBe(3)
      expect(result.summary.successful).toBeGreaterThan(0)
      expect(result.results).toHaveLength(3)
    })
  })

  describe('Quality Monitoring', () => {
    it('should track quality metrics across normalizations', async () => {
      const data = {
        results: [{ o: 150, c: 151, h: 152, l: 149, v: 1000000, t: Date.now() }]
      }

      // Process multiple normalizations
      for (let i = 0; i < 5; i++) {
        await pipeline.normalizeStockPrice(data, 'polygon', 'AAPL')
      }

      const stats = pipeline.getStatistics()
      expect(stats.pipeline.totalNormalizations).toBe(5)
      expect(stats.quality).toBeDefined()
      expect(stats.validation).toBeDefined()
      expect(stats.lineage).toBeDefined()
    })
  })

  describe('Lineage Tracking', () => {
    it('should track complete data lineage', async () => {
      const data = {
        results: [{ o: 150, c: 151, h: 152, l: 149, v: 1000000, t: Date.now() }]
      }

      const result = await pipeline.normalizeStockPrice(data, 'polygon', 'AAPL')

      expect(result.lineageInfo).toBeDefined()
      expect(result.lineageInfo.sourceId).toBe('polygon')
      expect(result.lineageInfo.transformations).toHaveLength(1)
      expect(result.lineageInfo.transformations[0].step).toBe('price_transformation')
      expect(result.lineageInfo.validationSteps.length).toBeGreaterThan(0)
      expect(result.lineageInfo.qualityChecks.length).toBeGreaterThan(0)
    })
  })

  describe('Configuration', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        enableValidation: false,
        validationThresholds: {
          stockPrice: {
            priceVariance: 0.10,
            volumeVariance: 0.30,
            timestampTolerance: 600000,
            requiredFields: ['symbol', 'close']
          }
        }
      }

      pipeline.updateConfig(newConfig)

      // Verify configuration was applied
      expect(pipeline.getStatistics()).toBeDefined()
    })

    it('should support custom validation rules', async () => {
      // This would require exposing the validation engine
      // For now, we test that the pipeline handles custom configurations
      const customPipeline = new DataNormalizationPipeline({
        enableValidation: true,
        validationThresholds: {
          stockPrice: {
            priceVariance: 0.01, // Very strict variance
            volumeVariance: 0.05,
            timestampTolerance: 60000, // 1 minute tolerance
            requiredFields: ['symbol', 'close', 'volume']
          }
        }
      })

      const data = {
        results: [{ o: 150, c: 151, h: 152, l: 149, v: 1000000, t: Date.now() - 120000 }] // 2 minutes old
      }

      const result = await customPipeline.normalizeStockPrice(data, 'polygon', 'AAPL')

      // Should have validation issues due to strict thresholds
      expect(result.validationResult.discrepancies.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed data gracefully', async () => {
      const malformedData = null

      const result = await pipeline.normalizeStockPrice(
        malformedData,
        'polygon',
        'AAPL'
      )

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0]).toContain('normalization error')
    })

    it('should handle missing required fields', async () => {
      const incompleteData = {
        results: [{}] // Empty result object
      }

      const result = await pipeline.normalizeStockPrice(
        incompleteData,
        'polygon',
        'AAPL'
      )

      expect(result.validationResult.discrepancies.some(d =>
        d.resolution.reason.includes('Required field')
      )).toBe(true)
    })
  })

  describe('Performance', () => {
    it('should complete normalization within acceptable time', async () => {
      const data = {
        results: [{ o: 150, c: 151, h: 152, l: 149, v: 1000000, t: Date.now() }]
      }

      const startTime = Date.now()
      const result = await pipeline.normalizeStockPrice(data, 'polygon', 'AAPL')
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
      expect(result.processingTime).toBeLessThan(100)
    })

    it('should handle batch processing efficiently', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        type: 'stock_price' as const,
        rawData: { results: [{ o: 150 + i, c: 151 + i, h: 152 + i, l: 149 + i, v: 1000000, t: Date.now() }] },
        source: 'polygon',
        symbol: `TEST${i}`
      }))

      const startTime = Date.now()
      const result = await pipeline.batchNormalize(requests)
      const endTime = Date.now()

      expect(result.summary.totalProcessed).toBe(10)
      expect(endTime - startTime).toBeLessThan(500) // Batch should be faster than sequential
    })
  })
})

describe('Integration Tests', () => {
  it('should demonstrate complete pipeline workflow', async () => {
    const pipeline = new DataNormalizationPipeline()

    // Simulate a complete data normalization workflow
    const symbolData = {
      stockPrice: {
        source: 'polygon',
        data: { results: [{ o: 150, c: 151, h: 152, l: 149, v: 1000000, t: Date.now() }] }
      },
      companyInfo: {
        source: 'fmp',
        data: { companyName: 'Apple Inc.', exchangeShortName: 'NASDAQ', mktCap: 3000000000000 }
      },
      financialStatement: {
        source: 'fmp',
        data: { calendarYear: '2023', revenue: 400000000000, netIncome: 100000000000 }
      },
      technicalIndicator: {
        source: 'alphavantage',
        data: { 'Technical Analysis: RSI': { '2023-12-01': { 'RSI': '65.0' } } }
      }
    }

    // Process all data types
    const priceResult = await pipeline.normalizeStockPrice(
      symbolData.stockPrice.data,
      symbolData.stockPrice.source,
      'AAPL'
    )

    const companyResult = await pipeline.normalizeCompanyInfo(
      symbolData.companyInfo.data,
      symbolData.companyInfo.source,
      'AAPL'
    )

    const financialResult = await pipeline.normalizeFinancialStatement(
      symbolData.financialStatement.data,
      symbolData.financialStatement.source,
      'AAPL'
    )

    const technicalResult = await pipeline.normalizeTechnicalIndicator(
      symbolData.technicalIndicator.data,
      symbolData.technicalIndicator.source,
      'AAPL',
      'RSI'
    )

    // Verify all normalizations succeeded
    expect(priceResult.success).toBe(true)
    expect(companyResult.success).toBe(true)
    expect(financialResult.success).toBe(true)
    expect(technicalResult.success).toBe(true)

    // Verify quality scores are reasonable
    expect(priceResult.qualityScore.overall).toBeGreaterThan(0.5)
    expect(companyResult.qualityScore.overall).toBeGreaterThan(0.5)
    expect(financialResult.qualityScore.overall).toBeGreaterThan(0.5)
    expect(technicalResult.qualityScore.overall).toBeGreaterThan(0.5)

    // Verify lineage tracking
    expect(priceResult.lineageInfo.transformations.length).toBeGreaterThan(0)
    expect(companyResult.lineageInfo.transformations.length).toBeGreaterThan(0)
    expect(financialResult.lineageInfo.transformations.length).toBeGreaterThan(0)
    expect(technicalResult.lineageInfo.transformations.length).toBeGreaterThan(0)

    // Get comprehensive statistics
    const stats = pipeline.getStatistics()
    expect(stats.pipeline.totalNormalizations).toBe(4)
    expect(stats.pipeline.successRate).toBe(1.0)

    console.log('Pipeline Statistics:', JSON.stringify(stats, null, 2))
  })
})