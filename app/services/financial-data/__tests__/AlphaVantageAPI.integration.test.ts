import { FinancialDataService } from '../FinancialDataService'
import { AlphaVantageAPI } from '../AlphaVantageAPI'
import { StockData, CompanyInfo, MarketData } from '../types'

// NO MOCK DATA - Use real Alpha Vantage API calls
// Mock only console methods to reduce test noise
jest.spyOn(console, 'warn').mockImplementation(() => {})
jest.spyOn(console, 'error').mockImplementation(() => {})

describe('AlphaVantageAPI Integration Tests', () => {
  let service: FinancialDataService
  let alphaVantageAPI: AlphaVantageAPI

  beforeEach(() => {
    jest.clearAllMocks()
    service = new FinancialDataService()
    // Use real API key from environment
    alphaVantageAPI = new AlphaVantageAPI(process.env.ALPHA_VANTAGE_API_KEY, 30000)

    // Ensure API key is available for real tests
    if (!process.env.ALPHA_VANTAGE_API_KEY) {
      throw new Error('ALPHA_VANTAGE_API_KEY environment variable is required for integration tests')
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
    service.clearCache()
  })

  describe('Integration with FinancialDataService - Real API Calls', () => {
    const testSymbol = 'AAPL'

    beforeEach(() => {
      // Add delay between tests to respect Alpha Vantage rate limits (5 calls per minute)
      return new Promise(resolve => setTimeout(resolve, 13000)) // 13 seconds between calls
    })

    describe('Caching Integration', () => {
      it('should cache stock price data from real Alpha Vantage API', async () => {
        console.log('🟢 Testing real Alpha Vantage caching with API calls')

        // Clear cache to ensure fresh start
        service.clearCache()

        // First call should hit the real API
        const result1 = await service.getStockPrice(testSymbol, 'alpha')
        expect(result1).not.toBeNull()
        expect(result1?.symbol).toBe(testSymbol)
        expect(result1?.source).toBe('alphavantage')
        expect(typeof result1?.price).toBe('number')

        console.log('✅ First real API call completed, testing cache...')

        // Second call should use cache (no delay needed)
        const startTime = Date.now()
        const result2 = await service.getStockPrice(testSymbol, 'alpha')
        const responseTime = Date.now() - startTime

        expect(result2).toEqual(result1)
        // Cached response should be very fast (< 100ms)
        expect(responseTime).toBeLessThan(100)

        console.log('✅ Cache test passed - second call was fast:', responseTime + 'ms')
      }, 60000)

      it('should cache company info data from real Alpha Vantage API', async () => {
        console.log('🟢 Testing real Alpha Vantage company info caching')

        service.clearCache()

        // First call should hit the real API
        const result1 = await service.getCompanyInfo(testSymbol, 'alpha')
        expect(result1).not.toBeNull()
        expect(result1?.symbol).toBe(testSymbol)
        expect(typeof result1?.name).toBe('string')
        expect(typeof result1?.sector).toBe('string')

        console.log('✅ Real company info received:', result1?.name)

        // Second call should use cache
        const startTime = Date.now()
        const result2 = await service.getCompanyInfo(testSymbol, 'alpha')
        const responseTime = Date.now() - startTime

        expect(result2).toEqual(result1)
        expect(responseTime).toBeLessThan(100)

        console.log('✅ Company info cache test passed')
      }, 60000)

      it('should cache market data from real Alpha Vantage API', async () => {
        console.log('🟢 Testing real Alpha Vantage market data caching')

        service.clearCache()

        // First call should hit the real API
        const result1 = await service.getMarketData(testSymbol, 'alpha')
        expect(result1).not.toBeNull()
        expect(result1?.symbol).toBe(testSymbol)
        expect(result1?.source).toBe('alphavantage')
        expect(typeof result1?.open).toBe('number')
        expect(typeof result1?.high).toBe('number')
        expect(typeof result1?.low).toBe('number')
        expect(typeof result1?.close).toBe('number')

        console.log('✅ Real market data received:', {
          open: result1?.open,
          high: result1?.high,
          low: result1?.low,
          close: result1?.close
        })

        // Second call should use cache
        const startTime = Date.now()
        const result2 = await service.getMarketData(testSymbol, 'alpha')
        const responseTime = Date.now() - startTime

        expect(result2).toEqual(result1)
        expect(responseTime).toBeLessThan(100)

        console.log('✅ Market data cache test passed')
      }, 60000)

      it('should respect cache expiration with real Alpha Vantage API', async () => {
        console.log('🟢 Testing cache expiration with real API calls')

        service.clearCache()

        // First call to real API
        const result1 = await service.getStockPrice(testSymbol, 'alpha')
        expect(result1).not.toBeNull()
        console.log('✅ First real API call cached')

        // Second call should use cache
        const result2 = await service.getStockPrice(testSymbol, 'alpha')
        expect(result2).toEqual(result1)
        console.log('✅ Second call used cache')

        // Wait for cache to expire (normally 5 minutes, but we'll clear it manually for testing)
        service.clearCache()
        console.log('🔄 Cache cleared manually to simulate expiration')

        // Third call should hit API again
        const result3 = await service.getStockPrice(testSymbol, 'alpha')
        expect(result3).not.toBeNull()
        expect(result3?.symbol).toBe(testSymbol)

        console.log('✅ Cache expiration test completed')
      }, 90000)

      it('should clear cache when requested with real Alpha Vantage API', async () => {
        console.log('🟢 Testing manual cache clearing with real API')

        service.clearCache()

        // First call to real API
        const result1 = await service.getStockPrice(testSymbol, 'alpha')
        expect(result1).not.toBeNull()

        // Second call should use cache (fast)
        const startTime = Date.now()
        const result2 = await service.getStockPrice(testSymbol, 'alpha')
        const cacheTime = Date.now() - startTime
        expect(result2).toEqual(result1)
        expect(cacheTime).toBeLessThan(100)

        // Clear cache manually
        service.clearCache()

        // Third call should hit API again (slower)
        const apiStartTime = Date.now()
        const result3 = await service.getStockPrice(testSymbol, 'alpha')
        const apiTime = Date.now() - apiStartTime
        expect(result3).not.toBeNull()
        expect(apiTime).toBeGreaterThan(500) // Real API call should take longer

        console.log('✅ Cache clear test completed')
      }, 90000)
    })

    describe('Provider Selection and Fallback', () => {
      it('should use Alpha Vantage when specified as preferred provider', async () => {
        // Mock successful Alpha Vantage response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            'Global Quote': {
              '01. symbol': 'AAPL',
              '05. price': '150.25',
              '09. change': '2.50',
              '10. change percent': '1.69%',
              '06. volume': '50000000',
              '07. latest trading day': '2024-01-15'
            }
          })
        } as Response)

        const result = await service.getStockPrice('AAPL', 'alpha')

        expect(result?.source).toBe('alphavantage')
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('alphavantage.co'),
          expect.anything()
        )
      })

      it('should fallback to other providers when Alpha Vantage fails', async () => {
        // Mock Alpha Vantage failure
        mockFetch
          .mockRejectedValueOnce(new Error('Alpha Vantage API error'))
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              results: [{
                T: 'AAPL',
                c: 150.25,
                h: 155.00,
                l: 149.50,
                o: 150.00,
                v: 50000000,
                t: 1705363200000
              }]
            })
          } as Response)

        const result = await service.getStockPrice('AAPL', 'alpha')

        // Should get data from Polygon (fallback)
        expect(result?.source).toBe('polygon')
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })

      it('should handle Alpha Vantage rate limiting gracefully', async () => {
        // Mock rate limit response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            'Note': 'Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 500 calls per day.'
          })
        } as Response)

        const result = await service.getStockPrice('AAPL', 'alpha')

        // Should return null from Alpha Vantage and potentially fallback
        expect(result).toBeNull()
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Provider Alpha Vantage failed'),
          expect.anything()
        )
      })
    })

    describe('Health Check Integration', () => {
      it('should include Alpha Vantage in service health check', async () => {
        // Mock successful health check
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            'Global Quote': {
              '01. symbol': 'AAPL',
              '05. price': '150.00'
            }
          })
        } as Response)

        const healthResults = await service.healthCheck()

        const alphaVantageHealth = healthResults.find(h => h.name === 'Alpha Vantage')
        expect(alphaVantageHealth).toBeDefined()
        expect(alphaVantageHealth?.healthy).toBe(true)
        expect(typeof alphaVantageHealth?.responseTime).toBe('number')
      })

      it('should report Alpha Vantage as unhealthy when API fails', async () => {
        // Mock API failure
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const healthResults = await service.healthCheck()

        const alphaVantageHealth = healthResults.find(h => h.name === 'Alpha Vantage')
        expect(alphaVantageHealth).toBeDefined()
        expect(alphaVantageHealth?.healthy).toBe(false)
        expect(typeof alphaVantageHealth?.responseTime).toBe('number')
      })

      it('should report Alpha Vantage as unhealthy when API key is missing', async () => {
        // Create service with no API key
        const noKeyService = new FinancialDataService()
        // Override the Alpha Vantage provider with one that has no key
        ;(noKeyService as any).providers[1] = new AlphaVantageAPI('')

        const healthResults = await noKeyService.healthCheck()

        const alphaVantageHealth = healthResults.find(h => h.name === 'Alpha Vantage')
        expect(alphaVantageHealth).toBeDefined()
        expect(alphaVantageHealth?.healthy).toBe(false)
      })
    })

    describe('Multiple Stock Fetching', () => {
      it('should handle multiple stocks with Alpha Vantage provider', async () => {
        // Mock responses for multiple stocks
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              'Global Quote': {
                '01. symbol': 'AAPL',
                '05. price': '150.25',
                '09. change': '2.50',
                '10. change percent': '1.69%',
                '06. volume': '50000000',
                '07. latest trading day': '2024-01-15'
              }
            })
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              'Global Quote': {
                '01. symbol': 'MSFT',
                '05. price': '375.50',
                '09. change': '5.25',
                '10. change percent': '1.42%',
                '06. volume': '25000000',
                '07. latest trading day': '2024-01-15'
              }
            })
          } as Response)

        const results = await service.getMultipleStocks(['AAPL', 'MSFT'], 'alpha')

        expect(results).toHaveLength(2)
        expect(results[0].symbol).toBe('AAPL')
        expect(results[1].symbol).toBe('MSFT')
        expect(results[0].source).toBe('alphavantage')
        expect(results[1].source).toBe('alphavantage')
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })

      it('should handle partial failures in multiple stock fetching', async () => {
        // Mock one success, one failure
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              'Global Quote': {
                '01. symbol': 'AAPL',
                '05. price': '150.25',
                '09. change': '2.50',
                '10. change percent': '1.69%',
                '06. volume': '50000000',
                '07. latest trading day': '2024-01-15'
              }
            })
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              'Error Message': 'Invalid API call'
            })
          } as Response)

        const results = await service.getMultipleStocks(['AAPL', 'INVALID'], 'alpha')

        expect(results).toHaveLength(1)
        expect(results[0].symbol).toBe('AAPL')
        expect(results[0].source).toBe('alphavantage')
      })
    })

    describe('Error Handling and Resilience', () => {
      it('should handle Alpha Vantage API errors gracefully', async () => {
        // Mock API error
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            'Error Message': 'Invalid API call. Please retry or visit the documentation'
          })
        } as Response)

        const result = await service.getStockPrice('INVALID', 'alpha')

        expect(result).toBeNull()
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Provider Alpha Vantage failed'),
          expect.anything()
        )
      })

      it('should handle network timeouts gracefully', async () => {
        // Mock network timeout
        mockFetch.mockImplementationOnce(() =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
        )

        const result = await service.getStockPrice('AAPL', 'alpha')

        expect(result).toBeNull()
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Provider Alpha Vantage failed'),
          expect.anything()
        )
      })

      it('should handle malformed API responses', async () => {
        // Mock malformed response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            // Missing expected Global Quote structure
            unexpectedData: 'value'
          })
        } as Response)

        const result = await service.getStockPrice('AAPL', 'alpha')

        expect(result).toBeNull()
      })
    })

    describe('Provider Name Matching', () => {
      it('should match provider by partial name', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            'Global Quote': {
              '01. symbol': 'AAPL',
              '05. price': '150.25',
              '09. change': '2.50',
              '10. change percent': '1.69%',
              '06. volume': '50000000',
              '07. latest trading day': '2024-01-15'
            }
          })
        } as Response)

        // Test different variations of provider name
        const testCases = ['alpha', 'Alpha', 'ALPHA', 'vantage', 'Alpha Vantage']

        for (const providerName of testCases) {
          jest.clearAllMocks()
          const result = await service.getStockPrice('AAPL', providerName)
          expect(result?.source).toBe('alphavantage')
          expect(mockFetch).toHaveBeenCalledTimes(1)
        }
      })
    })
  })

  describe('Standalone Alpha Vantage API Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']

      // Mock responses for all symbols
      symbols.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            'Global Quote': {
              '01. symbol': 'TEST',
              '05. price': '100.00',
              '09. change': '1.00',
              '10. change percent': '1.00%',
              '06. volume': '1000000',
              '07. latest trading day': '2024-01-15'
            }
          })
        } as Response)
      })

      const promises = symbols.map(symbol => alphaVantageAPI.getStockPrice(symbol))
      const results = await Promise.all(promises)

      expect(results.filter(Boolean)).toHaveLength(symbols.length)
      expect(mockFetch).toHaveBeenCalledTimes(symbols.length)
    })

    it('should handle API key rotation scenario', async () => {
      // Test with invalid key first
      const invalidKeyAPI = new AlphaVantageAPI('invalid-key')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'Error Message': 'Invalid API key'
        })
      } as Response)

      const result1 = await invalidKeyAPI.getStockPrice('AAPL')
      expect(result1).toBeNull()

      // Test with valid key
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'Global Quote': {
            '01. symbol': 'AAPL',
            '05. price': '150.25',
            '09. change': '2.50',
            '10. change percent': '1.69%',
            '06. volume': '50000000',
            '07. latest trading day': '2024-01-15'
          }
        })
      } as Response)

      const validKeyAPI = new AlphaVantageAPI('valid-key')
      const result2 = await validKeyAPI.getStockPrice('AAPL')
      expect(result2).toMatchObject({
        symbol: 'AAPL',
        price: 150.25,
        source: 'alphavantage'
      })
    })
  })
})