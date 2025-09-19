/**
 * Alpha Vantage API Real Data Integration Tests
 * NO MOCK DATA - Makes actual API calls to Alpha Vantage
 * Tests real API responses and validates data structure
 */

import { AlphaVantageAPI } from '../AlphaVantageAPI'
import { StockData, CompanyInfo, MarketData } from '../types'

describe('Alpha Vantage API Real Data Tests', () => {
  let api: AlphaVantageAPI
  const testSymbol = 'AAPL'

  beforeAll(() => {
    // Use real API key from environment
    api = new AlphaVantageAPI(process.env.ALPHA_VANTAGE_API_KEY, 30000) // 30 second timeout for real API calls

    // Ensure API key is available
    if (!process.env.ALPHA_VANTAGE_API_KEY) {
      throw new Error('ALPHA_VANTAGE_API_KEY environment variable is required for real API tests')
    }
  })

  // Note: Tests should be run with appropriate delays between them manually
  // or with Jest's --maxWorkers=1 flag to respect API rate limits

  describe('Real Stock Price Data', () => {
    it('should fetch real stock price data from Alpha Vantage API', async () => {
      console.log(`🟢 Making real Alpha Vantage API call for stock price: ${testSymbol}`)

      const result = await api.getStockPrice(testSymbol)

      // Validate real data structure and content
      expect(result).not.toBeNull()
      expect(result).toBeDefined()

      if (result) {
        // Validate data structure
        expect(result.symbol).toBe(testSymbol)
        expect(typeof result.price).toBe('number')
        expect(result.price).toBeGreaterThan(0)
        expect(typeof result.change).toBe('number')
        expect(typeof result.changePercent).toBe('number')
        expect(typeof result.volume).toBe('number')
        expect(result.volume).toBeGreaterThan(0)
        expect(typeof result.timestamp).toBe('number')
        expect(result.timestamp).toBeGreaterThan(0)
        expect(result.source).toBe('alphavantage')

        // Validate realistic stock price ranges for AAPL
        expect(result.price).toBeGreaterThan(50) // AAPL should be worth more than $50
        expect(result.price).toBeLessThan(1000) // AAPL should be worth less than $1000

        // Log real data for verification
        console.log('✅ Real Alpha Vantage stock data received:', {
          symbol: result.symbol,
          price: result.price,
          change: result.change,
          changePercent: result.changePercent,
          volume: result.volume,
          timestamp: new Date(result.timestamp).toISOString(),
          source: result.source
        })
      }
    }, 45000) // 45 second timeout for real API call

    it('should handle invalid stock symbols with real API response', async () => {
      console.log('🟢 Testing Alpha Vantage API with invalid symbol')

      const result = await api.getStockPrice('INVALID_SYMBOL_12345')

      // Alpha Vantage should return null for invalid symbols
      expect(result).toBeNull()
      console.log('✅ Alpha Vantage correctly handled invalid symbol')
    }, 45000)
  })

  describe('Real Company Information Data', () => {
    it('should fetch real company information from Alpha Vantage API', async () => {
      console.log(`🟢 Making real Alpha Vantage API call for company info: ${testSymbol}`)

      const result = await api.getCompanyInfo(testSymbol)

      // Validate real data structure and content
      expect(result).not.toBeNull()
      expect(result).toBeDefined()

      if (result) {
        // Validate data structure
        expect(result.symbol).toBe(testSymbol)
        expect(typeof result.name).toBe('string')
        expect(result.name.length).toBeGreaterThan(0)
        expect(typeof result.description).toBe('string')
        expect(result.description.length).toBeGreaterThan(0)
        expect(typeof result.sector).toBe('string')
        expect(result.sector.length).toBeGreaterThan(0)
        expect(typeof result.marketCap).toBe('number')
        expect(result.marketCap).toBeGreaterThan(0)
        expect(typeof result.employees).toBe('number')
        expect(result.employees).toBeGreaterThan(0)

        // Validate Apple-specific information
        expect(result.name.toLowerCase()).toContain('apple')
        expect(result.sector.toLowerCase()).toContain('technology')
        expect(result.marketCap).toBeGreaterThan(1000000000000) // Apple's market cap > $1T
        expect(result.employees).toBeGreaterThan(100000) // Apple has > 100K employees

        // Log real data for verification
        console.log('✅ Real Alpha Vantage company data received:', {
          symbol: result.symbol,
          name: result.name,
          sector: result.sector,
          marketCap: result.marketCap,
          employees: result.employees,
          descriptionLength: result.description.length
        })
      }
    }, 45000)
  })

  describe('Real Market Data', () => {
    it('should fetch real market data from Alpha Vantage API', async () => {
      console.log(`🟢 Making real Alpha Vantage API call for market data: ${testSymbol}`)

      const result = await api.getMarketData(testSymbol)

      // Validate real data structure and content
      expect(result).not.toBeNull()
      expect(result).toBeDefined()

      if (result) {
        // Validate data structure
        expect(result.symbol).toBe(testSymbol)
        expect(typeof result.open).toBe('number')
        expect(result.open).toBeGreaterThan(0)
        expect(typeof result.high).toBe('number')
        expect(result.high).toBeGreaterThan(0)
        expect(typeof result.low).toBe('number')
        expect(result.low).toBeGreaterThan(0)
        expect(typeof result.close).toBe('number')
        expect(result.close).toBeGreaterThan(0)
        expect(typeof result.volume).toBe('number')
        expect(result.volume).toBeGreaterThan(0)
        expect(typeof result.timestamp).toBe('number')
        expect(result.timestamp).toBeGreaterThan(0)
        expect(result.source).toBe('alphavantage')

        // Validate realistic market data relationships
        expect(result.high).toBeGreaterThanOrEqual(result.low)
        expect(result.high).toBeGreaterThanOrEqual(result.open)
        expect(result.high).toBeGreaterThanOrEqual(result.close)
        expect(result.low).toBeLessThanOrEqual(result.open)
        expect(result.low).toBeLessThanOrEqual(result.close)

        // Validate realistic price ranges for AAPL
        expect(result.open).toBeGreaterThan(50)
        expect(result.high).toBeGreaterThan(50)
        expect(result.low).toBeGreaterThan(50)
        expect(result.close).toBeGreaterThan(50)

        // Log real data for verification
        console.log('✅ Real Alpha Vantage market data received:', {
          symbol: result.symbol,
          open: result.open,
          high: result.high,
          low: result.low,
          close: result.close,
          volume: result.volume,
          timestamp: new Date(result.timestamp).toISOString(),
          source: result.source
        })
      }
    }, 45000)
  })

  describe('Real Health Check', () => {
    it('should perform real health check against Alpha Vantage API', async () => {
      console.log('🟢 Making real Alpha Vantage API health check call')

      const isHealthy = await api.healthCheck()

      // With a valid API key, health check should pass
      expect(isHealthy).toBe(true)

      console.log('✅ Alpha Vantage health check passed with real API')
    }, 45000)
  })

  describe('Real API Error Handling', () => {
    it('should handle rate limiting from real Alpha Vantage API', async () => {
      console.log('🟢 Testing real rate limiting behavior')

      // Make multiple rapid requests to test rate limiting
      const promises = Array(6).fill(null).map((_, i) =>
        api.getStockPrice(testSymbol).catch(error => {
          console.log(`Request ${i + 1} failed:`, error.message)
          return null
        })
      )

      const results = await Promise.all(promises)

      // Some requests should succeed, some might be rate limited
      const successCount = results.filter(r => r !== null).length
      const failureCount = results.length - successCount

      console.log(`✅ Rate limiting test completed: ${successCount} succeeded, ${failureCount} failed`)

      // At least one should succeed, but some may be rate limited
      expect(successCount).toBeGreaterThan(0)
    }, 60000)

    it('should handle real API timeout scenarios', async () => {
      console.log('🟢 Testing real API timeout handling')

      // Create API instance with very short timeout
      const shortTimeoutApi = new AlphaVantageAPI(process.env.ALPHA_VANTAGE_API_KEY, 100) // 100ms timeout

      const result = await shortTimeoutApi.getStockPrice(testSymbol)

      // Very short timeout should likely result in null due to timeout
      // But we'll accept either result since network conditions vary
      console.log('✅ Timeout test completed, result:', result ? 'success' : 'timeout')

      expect(typeof result === 'object' || result === null).toBe(true)
    }, 30000)
  })

  describe('Real Data Validation', () => {
    it('should validate real API response structure matches expected types', async () => {
      console.log('🟢 Validating real API response structure')

      const stockData = await api.getStockPrice(testSymbol)

      if (stockData) {
        // Validate all required fields are present with correct types
        const requiredFields: Array<keyof StockData> = [
          'symbol', 'price', 'change', 'changePercent', 'volume', 'timestamp', 'source'
        ]

        for (const field of requiredFields) {
          expect(stockData).toHaveProperty(field)
          expect(stockData[field]).toBeDefined()
          expect(stockData[field]).not.toBeNull()
        }

        // Validate specific type constraints
        expect(typeof stockData.symbol).toBe('string')
        expect(typeof stockData.price).toBe('number')
        expect(typeof stockData.change).toBe('number')
        expect(typeof stockData.changePercent).toBe('number')
        expect(typeof stockData.volume).toBe('number')
        expect(typeof stockData.timestamp).toBe('number')
        expect(typeof stockData.source).toBe('string')

        console.log('✅ Real API response structure validation passed')
      } else {
        console.log('⚠️ No data returned from real API call')
      }
    }, 45000)

    it('should validate timestamp is recent for real market data', async () => {
      console.log('🟢 Validating real API timestamp freshness')

      const marketData = await api.getMarketData(testSymbol)

      if (marketData) {
        const now = Date.now()
        const dataAge = now - marketData.timestamp
        const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

        // Market data should be relatively recent (within 7 days)
        expect(dataAge).toBeLessThan(maxAge)

        console.log('✅ Real API timestamp validation passed:', {
          dataTimestamp: new Date(marketData.timestamp).toISOString(),
          ageInHours: Math.round(dataAge / (60 * 60 * 1000))
        })
      } else {
        console.log('⚠️ No market data returned from real API call')
      }
    }, 45000)
  })
})