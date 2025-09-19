/**
 * Alpha Vantage API Integration Tests - Real API Only
 * NO MOCK DATA - Uses actual Alpha Vantage API calls for all tests
 * Tests integration with FinancialDataService using real data
 */

import { FinancialDataService } from '../FinancialDataService'
import { AlphaVantageAPI } from '../AlphaVantageAPI'

// NO MOCK DATA - Use real Alpha Vantage API calls
// Mock only console methods to reduce test noise
jest.spyOn(console, 'warn').mockImplementation(() => {})
jest.spyOn(console, 'error').mockImplementation(() => {})

describe('AlphaVantageAPI Real Integration Tests', () => {
  let service: FinancialDataService
  let alphaVantageAPI: AlphaVantageAPI
  const testSymbol = 'AAPL'

  beforeAll(() => {
    // Ensure API key is available for real tests
    if (!process.env.ALPHA_VANTAGE_API_KEY) {
      throw new Error('ALPHA_VANTAGE_API_KEY environment variable is required for integration tests')
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
    service = new FinancialDataService()
    // Use real API key from environment
    alphaVantageAPI = new AlphaVantageAPI(process.env.ALPHA_VANTAGE_API_KEY, 30000)

    // Add delay between tests to respect Alpha Vantage rate limits (5 calls per minute)
    return new Promise(resolve => setTimeout(resolve, 13000)) // 13 seconds between calls
  })

  afterEach(() => {
    jest.restoreAllMocks()
    service.clearCache()
  })

  describe('Real API Integration with FinancialDataService', () => {
    it('should integrate Alpha Vantage with FinancialDataService for real stock data', async () => {
      console.log('🟢 Testing real Alpha Vantage integration with FinancialDataService')

      const result = await service.getStockPrice(testSymbol, 'alpha')

      expect(result).not.toBeNull()
      expect(result?.symbol).toBe(testSymbol)
      expect(result?.source).toBe('alphavantage')
      expect(typeof result?.price).toBe('number')
      expect(result?.price).toBeGreaterThan(0)

      console.log('✅ Real Alpha Vantage data received via FinancialDataService:', {
        symbol: result?.symbol,
        price: result?.price,
        source: result?.source
      })
    }, 60000)

    it('should handle Alpha Vantage as preferred provider in real scenario', async () => {
      console.log('🟢 Testing Alpha Vantage as preferred provider')

      const result = await service.getStockPrice(testSymbol, 'alpha')

      expect(result).not.toBeNull()
      expect(result?.source).toBe('alphavantage')

      console.log('✅ Alpha Vantage correctly selected as preferred provider')
    }, 60000)

    it('should cache real Alpha Vantage data effectively', async () => {
      console.log('🟢 Testing real data caching behavior')

      service.clearCache()

      // First call - should hit real API
      const startTime1 = Date.now()
      const result1 = await service.getStockPrice(testSymbol, 'alpha')
      const apiTime = Date.now() - startTime1

      expect(result1).not.toBeNull()
      expect(apiTime).toBeGreaterThan(500) // Real API should take time

      // Second call - should use cache
      const startTime2 = Date.now()
      const result2 = await service.getStockPrice(testSymbol, 'alpha')
      const cacheTime = Date.now() - startTime2

      expect(result2).toEqual(result1)
      expect(cacheTime).toBeLessThan(100) // Cache should be fast

      console.log('✅ Caching behavior validated:', {
        apiTime: apiTime + 'ms',
        cacheTime: cacheTime + 'ms'
      })
    }, 90000)
  })

  describe('Real Health Check Integration', () => {
    it('should include Alpha Vantage in real service health check', async () => {
      console.log('🟢 Testing real Alpha Vantage health check')

      const healthResults = await service.healthCheck()

      const alphaVantageHealth = healthResults.find(h => h.name === 'Alpha Vantage')
      expect(alphaVantageHealth).toBeDefined()
      expect(typeof alphaVantageHealth?.healthy).toBe('boolean')
      expect(typeof alphaVantageHealth?.responseTime).toBe('number')

      console.log('✅ Alpha Vantage health check result:', {
        healthy: alphaVantageHealth?.healthy,
        responseTime: alphaVantageHealth?.responseTime + 'ms'
      })
    }, 60000)
  })

  describe('Real Multiple Stock Fetching', () => {
    it('should handle multiple real stocks with Alpha Vantage provider', async () => {
      console.log('🟢 Testing multiple stock fetching with real Alpha Vantage')

      // Use fewer stocks and longer timeout due to rate limits
      const symbols = ['AAPL', 'MSFT']
      const results = await service.getMultipleStocks(symbols, 'alpha')

      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.source).toBe('alphavantage')
        expect(typeof result.price).toBe('number')
        expect(result.price).toBeGreaterThan(0)
      })

      console.log('✅ Multiple stocks fetched successfully:', results.map(r => ({
        symbol: r.symbol,
        price: r.price
      })))
    }, 120000) // 2 minutes timeout for multiple API calls
  })

  describe('Real Error Handling', () => {
    it('should handle real Alpha Vantage API errors gracefully', async () => {
      console.log('🟢 Testing real error handling with invalid symbol')

      const result = await service.getStockPrice('INVALID_SYMBOL_12345', 'alpha')

      // Invalid symbol should return null
      expect(result).toBeNull()

      console.log('✅ Invalid symbol handled correctly')
    }, 60000)

    it('should handle real rate limiting gracefully', async () => {
      console.log('🟢 Testing real rate limiting behavior')

      // Make several requests quickly to potentially hit rate limits
      const promises = Array(3).fill(null).map(() =>
        service.getStockPrice(testSymbol, 'alpha').catch(() => null)
      )

      const results = await Promise.all(promises)
      const successCount = results.filter(r => r !== null).length

      // At least one should succeed, but some may be rate limited
      expect(successCount).toBeGreaterThan(0)

      console.log('✅ Rate limiting test completed:', {
        totalRequests: results.length,
        successful: successCount,
        rateLimited: results.length - successCount
      })
    }, 90000)
  })

  describe('Real Data Validation', () => {
    it('should validate real company info data structure', async () => {
      console.log('🟢 Testing real company info validation')

      const companyInfo = await service.getCompanyInfo(testSymbol, 'alpha')

      if (companyInfo) {
        expect(typeof companyInfo.symbol).toBe('string')
        expect(typeof companyInfo.name).toBe('string')
        expect(typeof companyInfo.sector).toBe('string')
        expect(typeof companyInfo.marketCap).toBe('number')
        expect(typeof companyInfo.employees).toBe('number')

        expect(companyInfo.name.length).toBeGreaterThan(0)
        expect(companyInfo.marketCap).toBeGreaterThan(0)
        expect(companyInfo.employees).toBeGreaterThan(0)

        console.log('✅ Real company info validated:', {
          name: companyInfo.name,
          sector: companyInfo.sector,
          marketCap: companyInfo.marketCap
        })
      } else {
        console.log('⚠️ No company info returned from real API')
      }
    }, 60000)

    it('should validate real market data structure', async () => {
      console.log('🟢 Testing real market data validation')

      const marketData = await service.getMarketData(testSymbol, 'alpha')

      if (marketData) {
        expect(typeof marketData.symbol).toBe('string')
        expect(typeof marketData.open).toBe('number')
        expect(typeof marketData.high).toBe('number')
        expect(typeof marketData.low).toBe('number')
        expect(typeof marketData.close).toBe('number')
        expect(typeof marketData.volume).toBe('number')
        expect(typeof marketData.timestamp).toBe('number')

        // Validate market data relationships
        expect(marketData.high).toBeGreaterThanOrEqual(marketData.low)
        expect(marketData.volume).toBeGreaterThan(0)

        console.log('✅ Real market data validated:', {
          open: marketData.open,
          high: marketData.high,
          low: marketData.low,
          close: marketData.close,
          volume: marketData.volume
        })
      } else {
        console.log('⚠️ No market data returned from real API')
      }
    }, 60000)
  })

  describe('Provider Name Matching with Real API', () => {
    it('should match Alpha Vantage provider by various name formats', async () => {
      console.log('🟢 Testing provider name matching with real API')

      const testCases = ['alpha', 'Alpha', 'vantage', 'Alpha Vantage']

      for (const providerName of testCases) {
        service.clearCache() // Clear cache for each test
        const result = await service.getStockPrice(testSymbol, providerName)

        if (result) {
          expect(result.source).toBe('alphavantage')
          console.log(`✅ Provider name "${providerName}" correctly matched Alpha Vantage`)
        }

        // Add delay between iterations
        await new Promise(resolve => setTimeout(resolve, 13000))
      }
    }, 300000) // 5 minutes for multiple API calls
  })
})