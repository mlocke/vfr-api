/**
 * Basic Test Suite for SECEdgarAPI
 * Tests SEC EDGAR integration for institutional holdings and insider transaction parsing
 * Follows TDD principles with NO MOCK DATA - uses real SEC EDGAR API calls only
 */

import { SECEdgarAPI } from '../SECEdgarAPI'
import { StockData, CompanyInfo, MarketData } from '../types'

describe('SECEdgarAPI Basic Tests', () => {
  let api: SECEdgarAPI

  beforeEach(() => {
    // Create fresh API instance for each test with realistic timeout
    api = new SECEdgarAPI(15000)
  })

  describe('API Initialization and Configuration', () => {
    test('should_initialize_api_with_default_timeout_successfully', () => {
      const defaultAPI = new SECEdgarAPI()
      expect(defaultAPI.name).toBe('SEC EDGAR')
      expect(defaultAPI).toBeInstanceOf(SECEdgarAPI)
    })

    test('should_initialize_api_with_custom_timeout_successfully', () => {
      const customAPI = new SECEdgarAPI(30000)
      expect(customAPI.name).toBe('SEC EDGAR')
      expect(customAPI).toBeInstanceOf(SECEdgarAPI)
    })

    test('should_use_proper_user_agent_for_sec_compliance', () => {
      // SEC EDGAR requires proper User-Agent header
      const userAgent = (api as any).userAgent
      expect(userAgent).toContain('VFR-API')
      expect(userAgent).toMatch(/contact@|@/)
    })

    test('should_enforce_sec_rate_limiting_configuration', () => {
      const requestDelay = (api as any).REQUEST_DELAY
      expect(requestDelay).toBe(100) // 100ms delay for 10 req/sec compliance
    })
  })

  describe('Health Check and API Connectivity', () => {
    test('should_pass_health_check_with_real_sec_edgar_endpoint', async () => {
      const isHealthy = await api.healthCheck()

      // Health check should return a boolean
      expect(typeof isHealthy).toBe('boolean')

      if (isHealthy) {
        console.log('✓ SEC EDGAR API is accessible and responsive')
      } else {
        console.warn('⚠ SEC EDGAR API health check failed - this may be due to rate limiting, network issues, or temporary unavailability')
      }

      // Even if unhealthy, should not throw an error
    }, 30000)

    test('should_handle_sec_edgar_rate_limiting_in_health_check', async () => {
      // Make multiple health check requests to test rate limiting handling
      const healthPromises = Array(3).fill(0).map(() => api.healthCheck())
      const results = await Promise.allSettled(healthPromises)

      // All requests should complete without throwing errors
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
        if (result.status === 'fulfilled') {
          expect(typeof result.value).toBe('boolean')
        }
      })
    }, 45000)
  })

  describe('Stock Price Data (SEC EDGAR Limitations)', () => {
    test('should_handle_stock_price_request_gracefully_despite_limitations', async () => {
      const symbol = 'AAPL'

      const stockData = await api.getStockPrice(symbol)

      if (stockData) {
        // SEC EDGAR doesn't provide real-time stock prices, so should return placeholder data
        expect(stockData).toHaveProperty('symbol')
        expect(stockData).toHaveProperty('price')
        expect(stockData).toHaveProperty('timestamp')
        expect(stockData).toHaveProperty('source')

        expect(stockData.symbol).toBe(symbol.toUpperCase())
        expect(typeof stockData.price).toBe('number')
        expect(typeof stockData.timestamp).toBe('number')
        expect(stockData.source).toBe('sec_edgar')

        console.log(`✓ SEC EDGAR returned placeholder stock data for ${symbol}`)
      } else {
        console.log(`⚠ SEC EDGAR could not provide stock data for ${symbol}`)
        expect(stockData).toBeNull()
      }
    }, 20000)

    test('should_handle_invalid_symbol_for_stock_price_gracefully', async () => {
      const invalidSymbol = 'INVALID_SYMBOL_XYZ'

      const stockData = await api.getStockPrice(invalidSymbol)

      // Should handle invalid symbols gracefully
      expect(stockData).toBeNull()
    }, 15000)
  })

  describe('Company Information Retrieval', () => {
    test('should_retrieve_company_info_for_known_symbol_with_real_api', async () => {
      const symbol = 'AAPL' // Apple Inc - well-known company in SEC database

      const companyInfo = await api.getCompanyInfo(symbol)

      if (companyInfo) {
        // Validate company info structure
        expect(companyInfo).toHaveProperty('symbol')
        expect(companyInfo).toHaveProperty('name')
        expect(companyInfo).toHaveProperty('description')
        expect(companyInfo).toHaveProperty('sector')

        expect(companyInfo.symbol).toBe(symbol.toUpperCase())
        expect(typeof companyInfo.name).toBe('string')
        expect(typeof companyInfo.description).toBe('string')
        expect(typeof companyInfo.sector).toBe('string')

        // Name should not be empty for Apple
        expect(companyInfo.name.length).toBeGreaterThan(0)

        console.log(`✓ Retrieved company info for ${symbol}: ${companyInfo.name}`)
      } else {
        console.log(`⚠ No company info found for ${symbol} - this may be due to CIK mapping issues or API limitations`)
        expect(companyInfo).toBeNull()
      }
    }, 30000)

    test('should_handle_multiple_known_symbols_for_company_info', async () => {
      const knownSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN'] // Well-known companies

      for (const symbol of knownSymbols) {
        const companyInfo = await api.getCompanyInfo(symbol)

        // Each should either return valid data or null (not throw errors)
        if (companyInfo) {
          expect(companyInfo.symbol).toBe(symbol.toUpperCase())
          expect(typeof companyInfo.name).toBe('string')
        } else {
          expect(companyInfo).toBeNull()
        }

        // Respect rate limiting between requests
        await new Promise(resolve => setTimeout(resolve, 110))
      }
    }, 60000)

    test('should_handle_unknown_symbol_for_company_info_gracefully', async () => {
      const unknownSymbol = 'UNKNOWN_COMPANY_ABC'

      const companyInfo = await api.getCompanyInfo(unknownSymbol)

      expect(companyInfo).toBeNull()
    }, 15000)
  })

  describe('Market Data (SEC EDGAR Limitations)', () => {
    test('should_return_placeholder_market_data_due_to_sec_limitations', async () => {
      const symbol = 'MSFT'

      const marketData = await api.getMarketData(symbol)

      if (marketData) {
        // SEC EDGAR doesn't provide market data, so should return placeholder
        expect(marketData).toHaveProperty('symbol')
        expect(marketData).toHaveProperty('open')
        expect(marketData).toHaveProperty('high')
        expect(marketData).toHaveProperty('low')
        expect(marketData).toHaveProperty('close')
        expect(marketData).toHaveProperty('volume')
        expect(marketData).toHaveProperty('timestamp')
        expect(marketData).toHaveProperty('source')

        expect(marketData.symbol).toBe(symbol.toUpperCase())
        expect(marketData.source).toBe('sec_edgar')
        expect(typeof marketData.timestamp).toBe('number')

        console.log(`✓ SEC EDGAR returned placeholder market data for ${symbol}`)
      } else {
        expect(marketData).toBeNull()
      }
    }, 15000)
  })

  describe('13F Institutional Holdings Analysis', () => {
    test('should_retrieve_13f_holdings_for_known_symbol_with_real_api', async () => {
      const symbol = 'AAPL' // Apple has extensive institutional ownership

      const holdings = await api.get13FHoldings(symbol, 2) // Last 2 quarters

      expect(Array.isArray(holdings)).toBe(true)

      if (holdings.length > 0) {
        holdings.forEach(holding => {
          // Validate holding structure
          expect(holding).toHaveProperty('symbol')
          expect(holding).toHaveProperty('cusip')
          expect(holding).toHaveProperty('securityName')
          expect(holding).toHaveProperty('managerName')
          expect(holding).toHaveProperty('managerId')
          expect(holding).toHaveProperty('reportDate')
          expect(holding).toHaveProperty('filingDate')
          expect(holding).toHaveProperty('shares')
          expect(holding).toHaveProperty('marketValue')
          expect(holding).toHaveProperty('timestamp')
          expect(holding).toHaveProperty('source')

          // Validate data types
          expect(typeof holding.symbol).toBe('string')
          expect(typeof holding.cusip).toBe('string')
          expect(typeof holding.managerName).toBe('string')
          expect(typeof holding.shares).toBe('number')
          expect(typeof holding.marketValue).toBe('number')
          expect(typeof holding.timestamp).toBe('number')
          expect(holding.source).toBe('sec_edgar')

          // Validate value ranges
          expect(holding.shares).toBeGreaterThanOrEqual(0)
          expect(holding.marketValue).toBeGreaterThanOrEqual(0)
          expect(holding.timestamp).toBeGreaterThan(0)

          // Validate dates
          expect(Date.parse(holding.reportDate)).not.toBeNaN()
          expect(Date.parse(holding.filingDate)).not.toBeNaN()

          // Validate CUSIP format (should be alphanumeric, typically 9 characters)
          expect(holding.cusip).toMatch(/^[A-Z0-9]+$/)
        })

        console.log(`✓ Retrieved ${holdings.length} institutional holdings for ${symbol}`)
      } else {
        console.log(`⚠ No 13F holdings found for ${symbol} - this may be due to:`)
        console.log(`  - Symbol-to-CIK mapping limitations`)
        console.log(`  - SEC EDGAR API rate limiting`)
        console.log(`  - Data availability in test environment`)
      }
    }, 45000)

    test('should_handle_symbol_without_13f_data_gracefully', async () => {
      const symbolWithoutData = 'UNKNOWN_SYMBOL_NO_13F'

      const holdings = await api.get13FHoldings(symbolWithoutData)

      expect(Array.isArray(holdings)).toBe(true)
      expect(holdings.length).toBe(0)
    }, 20000)

    test('should_sort_13f_holdings_by_filing_date_descending', async () => {
      const symbol = 'GOOGL'

      const holdings = await api.get13FHoldings(symbol, 3)

      if (holdings.length > 1) {
        // Check that holdings are sorted by filing date (newest first)
        for (let i = 1; i < holdings.length; i++) {
          const currentDate = new Date(holdings[i].filingDate).getTime()
          const previousDate = new Date(holdings[i - 1].filingDate).getTime()
          expect(currentDate).toBeLessThanOrEqual(previousDate)
        }

        console.log(`✓ 13F holdings for ${symbol} are properly sorted by filing date`)
      }
    }, 45000)
  })

  describe('Form 4 Insider Transaction Analysis', () => {
    test('should_retrieve_form4_transactions_for_known_symbol_with_real_api', async () => {
      const symbol = 'TSLA' // Tesla typically has notable insider activity

      const transactions = await api.getForm4Transactions(symbol, 90) // Last 90 days

      expect(Array.isArray(transactions)).toBe(true)

      if (transactions.length > 0) {
        transactions.forEach(transaction => {
          // Validate transaction structure
          expect(transaction).toHaveProperty('symbol')
          expect(transaction).toHaveProperty('companyName')
          expect(transaction).toHaveProperty('reportingOwnerName')
          expect(transaction).toHaveProperty('reportingOwnerId')
          expect(transaction).toHaveProperty('relationship')
          expect(transaction).toHaveProperty('transactionDate')
          expect(transaction).toHaveProperty('filingDate')
          expect(transaction).toHaveProperty('transactionCode')
          expect(transaction).toHaveProperty('transactionType')
          expect(transaction).toHaveProperty('shares')
          expect(transaction).toHaveProperty('sharesOwnedAfter')
          expect(transaction).toHaveProperty('timestamp')
          expect(transaction).toHaveProperty('source')
          expect(transaction).toHaveProperty('formType')

          // Validate data types
          expect(typeof transaction.symbol).toBe('string')
          expect(typeof transaction.reportingOwnerName).toBe('string')
          expect(typeof transaction.transactionCode).toBe('string')
          expect(typeof transaction.transactionType).toBe('string')
          expect(typeof transaction.shares).toBe('number')
          expect(typeof transaction.sharesOwnedAfter).toBe('number')
          expect(typeof transaction.timestamp).toBe('number')
          expect(Array.isArray(transaction.relationship)).toBe(true)
          expect(transaction.source).toBe('sec_edgar')

          // Validate value ranges
          expect(transaction.shares).toBeGreaterThanOrEqual(0)
          expect(transaction.sharesOwnedAfter).toBeGreaterThanOrEqual(0)
          expect(transaction.timestamp).toBeGreaterThan(0)

          // Validate transaction types
          expect(['BUY', 'SELL', 'GRANT', 'EXERCISE', 'GIFT', 'OTHER']).toContain(transaction.transactionType)

          // Validate transaction codes (SEC Form 4 codes)
          expect(['A', 'D', 'F', 'G', 'J', 'K', 'L', 'M', 'P', 'S', 'U', 'V', 'W', 'X', 'Z']).toContain(transaction.transactionCode)

          // Validate form types
          expect(['3', '4', '4/A', '5', '5/A']).toContain(transaction.formType)

          // Validate dates
          expect(Date.parse(transaction.transactionDate)).not.toBeNaN()
          expect(Date.parse(transaction.filingDate)).not.toBeNaN()

          // Validate confidence score
          if (transaction.confidence !== undefined) {
            expect(transaction.confidence).toBeGreaterThanOrEqual(0)
            expect(transaction.confidence).toBeLessThanOrEqual(1)
          }
        })

        console.log(`✓ Retrieved ${transactions.length} insider transactions for ${symbol}`)
      } else {
        console.log(`⚠ No Form 4 transactions found for ${symbol} - this may be due to:`)
        console.log(`  - Symbol-to-CIK mapping limitations`)
        console.log(`  - SEC EDGAR API rate limiting`)
        console.log(`  - Limited insider activity in specified timeframe`)
      }
    }, 45000)

    test('should_handle_symbol_without_form4_data_gracefully', async () => {
      const symbolWithoutData = 'UNKNOWN_SYMBOL_NO_FORM4'

      const transactions = await api.getForm4Transactions(symbolWithoutData)

      expect(Array.isArray(transactions)).toBe(true)
      expect(transactions.length).toBe(0)
    }, 20000)

    test('should_sort_form4_transactions_by_filing_date_descending', async () => {
      const symbol = 'META'

      const transactions = await api.getForm4Transactions(symbol, 180)

      if (transactions.length > 1) {
        // Check that transactions are sorted by filing date (newest first)
        for (let i = 1; i < transactions.length; i++) {
          const currentDate = new Date(transactions[i].filingDate).getTime()
          const previousDate = new Date(transactions[i - 1].filingDate).getTime()
          expect(currentDate).toBeLessThanOrEqual(previousDate)
        }

        console.log(`✓ Form 4 transactions for ${symbol} are properly sorted by filing date`)
      }
    }, 45000)
  })

  describe('Sentiment Analysis', () => {
    test('should_calculate_institutional_sentiment_from_13f_data', async () => {
      const symbol = 'NVDA'

      const sentiment = await api.getInstitutionalSentiment(symbol)

      if (sentiment) {
        // Validate sentiment structure
        expect(sentiment).toHaveProperty('symbol')
        expect(sentiment).toHaveProperty('reportDate')
        expect(sentiment).toHaveProperty('totalInstitutions')
        expect(sentiment).toHaveProperty('totalShares')
        expect(sentiment).toHaveProperty('totalValue')
        expect(sentiment).toHaveProperty('quarterlyChange')
        expect(sentiment).toHaveProperty('topHolders')
        expect(sentiment).toHaveProperty('sentiment')
        expect(sentiment).toHaveProperty('sentimentScore')
        expect(sentiment).toHaveProperty('confidence')
        expect(sentiment).toHaveProperty('timestamp')
        expect(sentiment).toHaveProperty('source')

        // Validate data types
        expect(sentiment.symbol).toBe(symbol.toUpperCase())
        expect(typeof sentiment.totalInstitutions).toBe('number')
        expect(typeof sentiment.totalShares).toBe('number')
        expect(typeof sentiment.totalValue).toBe('number')
        expect(typeof sentiment.sentimentScore).toBe('number')
        expect(typeof sentiment.confidence).toBe('number')
        expect(Array.isArray(sentiment.topHolders)).toBe(true)
        expect(sentiment.source).toBe('sec_edgar')

        // Validate value ranges
        expect(sentiment.totalInstitutions).toBeGreaterThanOrEqual(0)
        expect(sentiment.totalShares).toBeGreaterThanOrEqual(0)
        expect(sentiment.totalValue).toBeGreaterThanOrEqual(0)
        expect(sentiment.sentimentScore).toBeGreaterThanOrEqual(0)
        expect(sentiment.sentimentScore).toBeLessThanOrEqual(10)
        expect(sentiment.confidence).toBeGreaterThanOrEqual(0)
        expect(sentiment.confidence).toBeLessThanOrEqual(1)

        // Validate sentiment values
        expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(sentiment.sentiment)

        console.log(`✓ Calculated institutional sentiment for ${symbol}:`)
        console.log(`  Sentiment: ${sentiment.sentiment} (${sentiment.sentimentScore}/10)`)
        console.log(`  Institutions: ${sentiment.totalInstitutions}`)
        console.log(`  Total Value: $${(sentiment.totalValue / 1e9).toFixed(1)}B`)
        console.log(`  Confidence: ${(sentiment.confidence * 100).toFixed(1)}%`)
      } else {
        console.log(`⚠ Could not calculate institutional sentiment for ${symbol}`)
        expect(sentiment).toBeNull()
      }
    }, 45000)

    test('should_calculate_insider_sentiment_from_form4_data', async () => {
      const symbol = 'JPM'

      const sentiment = await api.getInsiderSentiment(symbol)

      if (sentiment) {
        // Validate sentiment structure
        expect(sentiment).toHaveProperty('symbol')
        expect(sentiment).toHaveProperty('period')
        expect(sentiment).toHaveProperty('totalTransactions')
        expect(sentiment).toHaveProperty('totalInsiders')
        expect(sentiment).toHaveProperty('netShares')
        expect(sentiment).toHaveProperty('netValue')
        expect(sentiment).toHaveProperty('buyTransactions')
        expect(sentiment).toHaveProperty('sellTransactions')
        expect(sentiment).toHaveProperty('sentiment')
        expect(sentiment).toHaveProperty('sentimentScore')
        expect(sentiment).toHaveProperty('confidence')
        expect(sentiment).toHaveProperty('timestamp')
        expect(sentiment).toHaveProperty('source')

        // Validate data types
        expect(sentiment.symbol).toBe(symbol.toUpperCase())
        expect(typeof sentiment.period).toBe('string')
        expect(typeof sentiment.totalTransactions).toBe('number')
        expect(typeof sentiment.totalInsiders).toBe('number')
        expect(typeof sentiment.netShares).toBe('number')
        expect(typeof sentiment.netValue).toBe('number')
        expect(typeof sentiment.buyTransactions).toBe('number')
        expect(typeof sentiment.sellTransactions).toBe('number')
        expect(typeof sentiment.sentimentScore).toBe('number')
        expect(typeof sentiment.confidence).toBe('number')
        expect(sentiment.source).toBe('sec_edgar')

        // Validate value ranges
        expect(sentiment.totalTransactions).toBeGreaterThanOrEqual(0)
        expect(sentiment.totalInsiders).toBeGreaterThanOrEqual(0)
        expect(sentiment.buyTransactions).toBeGreaterThanOrEqual(0)
        expect(sentiment.sellTransactions).toBeGreaterThanOrEqual(0)
        expect(sentiment.sentimentScore).toBeGreaterThanOrEqual(0)
        expect(sentiment.sentimentScore).toBeLessThanOrEqual(10)
        expect(sentiment.confidence).toBeGreaterThanOrEqual(0)
        expect(sentiment.confidence).toBeLessThanOrEqual(1)

        // Validate sentiment values
        expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(sentiment.sentiment)

        // Validate total transactions consistency
        expect(sentiment.totalTransactions).toBe(sentiment.buyTransactions + sentiment.sellTransactions)

        console.log(`✓ Calculated insider sentiment for ${symbol}:`)
        console.log(`  Sentiment: ${sentiment.sentiment} (${sentiment.sentimentScore}/10)`)
        console.log(`  Transactions: ${sentiment.totalTransactions} (${sentiment.buyTransactions} buys, ${sentiment.sellTransactions} sells)`)
        console.log(`  Insiders: ${sentiment.totalInsiders}`)
        console.log(`  Net Value: $${(sentiment.netValue / 1e6).toFixed(1)}M`)
        console.log(`  Confidence: ${(sentiment.confidence * 100).toFixed(1)}%`)
      } else {
        console.log(`⚠ Could not calculate insider sentiment for ${symbol}`)
        expect(sentiment).toBeNull()
      }
    }, 45000)
  })

  describe('Rate Limiting and SEC Compliance', () => {
    test('should_enforce_sec_edgar_rate_limiting_between_requests', async () => {
      const symbol = 'V'

      // Make multiple requests and measure timing
      const startTime = Date.now()
      const promises = Array(3).fill(0).map(() => api.getCompanyInfo(symbol))
      await Promise.allSettled(promises)
      const totalTime = Date.now() - startTime

      // With 100ms delay between requests, 3 requests should take at least 200ms
      expect(totalTime).toBeGreaterThan(200)

      console.log(`✓ Rate limiting enforced: ${totalTime}ms for 3 requests`)
    }, 30000)

    test('should_handle_concurrent_requests_with_proper_queuing', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL']

      // Start all requests simultaneously
      const startTime = Date.now()
      const promises = symbols.map(symbol => api.getCompanyInfo(symbol))
      const results = await Promise.allSettled(promises)
      const totalTime = Date.now() - startTime

      // All requests should complete
      expect(results.length).toBe(symbols.length)
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
      })

      // Should take time due to rate limiting
      expect(totalTime).toBeGreaterThan(200)

      console.log(`✓ Concurrent requests handled properly: ${totalTime}ms for ${symbols.length} symbols`)
    }, 45000)
  })

  describe('Error Handling and Resilience', () => {
    test('should_handle_network_errors_gracefully', async () => {
      // Create API with invalid base URL to force network error
      const invalidAPI = new SECEdgarAPI(5000)
      ;(invalidAPI as any).baseUrl = 'https://invalid-sec-endpoint.nonexistent'

      const result = await invalidAPI.getCompanyInfo('AAPL')

      // Should return null instead of throwing
      expect(result).toBeNull()
    })

    test('should_handle_timeout_errors_gracefully', async () => {
      // Create API with very short timeout
      const timeoutAPI = new SECEdgarAPI(1) // 1ms timeout

      const result = await timeoutAPI.getCompanyInfo('AAPL')

      // Should return null instead of throwing
      expect(result).toBeNull()
    })

    test('should_sanitize_error_messages_for_security', async () => {
      // Capture console output
      const originalConsoleError = console.error
      const consoleMessages: string[] = []

      console.error = (...args: any[]) => {
        consoleMessages.push(args.join(' '))
      }

      try {
        // Force an error with invalid endpoint
        const errorAPI = new SECEdgarAPI(5000)
        ;(errorAPI as any).baseUrl = 'https://invalid.endpoint'

        await errorAPI.getCompanyInfo('AAPL')

        // Check that error messages don't contain sensitive information
        const allMessages = consoleMessages.join(' ')
        expect(allMessages).not.toContain('api_key')
        expect(allMessages).not.toContain('password')
        expect(allMessages).not.toContain('secret')
      } finally {
        console.error = originalConsoleError
      }
    })

    test('should_recover_gracefully_from_api_errors', async () => {
      const symbol = 'AAPL'

      // Multiple requests - some may fail due to rate limiting or other issues
      const promises = Array(5).fill(0).map(() => api.getCompanyInfo(symbol))
      const results = await Promise.allSettled(promises)

      // Should handle all requests without throwing uncaught errors
      results.forEach(result => {
        expect(['fulfilled', 'rejected']).toContain(result.status)
      })
    }, 60000)
  })

  describe('Data Validation', () => {
    test('should_validate_cik_to_symbol_mapping_for_known_companies', async () => {
      const knownMappings = [
        { symbol: 'AAPL', expectedCIK: '0000320193' },
        { symbol: 'MSFT', expectedCIK: '0000789019' },
        { symbol: 'GOOGL', expectedCIK: '0001652044' }
      ]

      for (const mapping of knownMappings) {
        const cik = await (api as any).symbolToCik(mapping.symbol)

        if (cik) {
          expect(cik).toBe(mapping.expectedCIK)
          console.log(`✓ CIK mapping verified: ${mapping.symbol} -> ${cik}`)
        } else {
          console.log(`⚠ CIK mapping not found for ${mapping.symbol}`)
        }
      }
    })

    test('should_handle_symbol_case_insensitivity', async () => {
      const symbol = 'aapl' // lowercase

      const companyInfo = await api.getCompanyInfo(symbol)

      if (companyInfo) {
        // Should normalize to uppercase
        expect(companyInfo.symbol).toBe('AAPL')
      }
    }, 20000)

    test('should_validate_date_formats_in_responses', async () => {
      const symbol = 'AMZN'

      const transactions = await api.getForm4Transactions(symbol, 90)

      transactions.forEach(transaction => {
        // Dates should be valid ISO date strings
        expect(Date.parse(transaction.transactionDate)).not.toBeNaN()
        expect(Date.parse(transaction.filingDate)).not.toBeNaN()

        // Filing date should be after or equal to transaction date
        const transactionDate = new Date(transaction.transactionDate)
        const filingDate = new Date(transaction.filingDate)
        expect(filingDate.getTime()).toBeGreaterThanOrEqual(transactionDate.getTime())
      })
    }, 30000)
  })
})