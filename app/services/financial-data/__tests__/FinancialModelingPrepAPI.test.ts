import { FinancialModelingPrepAPI } from '../FinancialModelingPrepAPI'

// Mock fetch for unit tests
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

// Mock only console methods to reduce test noise
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

describe('FinancialModelingPrepAPI', () => {
  let api: FinancialModelingPrepAPI

  beforeEach(() => {
    jest.clearAllMocks()
    // Use test API key for unit tests
    api = new FinancialModelingPrepAPI('test-api-key', 30000)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with provided API key and timeout', () => {
      const customApi = new FinancialModelingPrepAPI('custom-key', 10000)
      expect(customApi.name).toBe('Financial Modeling Prep')
      expect((customApi as any).apiKey).toBe('custom-key')
      expect((customApi as any).timeout).toBe(10000)
    })

    it('should use environment variable for API key when not provided', () => {
      const originalEnv = process.env.FMP_API_KEY
      process.env.FMP_API_KEY = 'env-key'
      const envApi = new FinancialModelingPrepAPI()
      expect((envApi as any).apiKey).toBe('env-key')
      process.env.FMP_API_KEY = originalEnv
    })

    it('should use default timeout when not provided', () => {
      const defaultApi = new FinancialModelingPrepAPI('key')
      expect((defaultApi as any).timeout).toBe(15000)
    })

    it('should handle missing API key gracefully', () => {
      const originalEnv = process.env.FMP_API_KEY
      delete process.env.FMP_API_KEY
      const noKeyApi = new FinancialModelingPrepAPI()
      expect((noKeyApi as any).apiKey).toBe('')
      process.env.FMP_API_KEY = originalEnv
    })
  })

  describe('getStockPrice', () => {
    const mockQuoteResponse = [
      {
        symbol: 'AAPL',
        price: 150.25,
        change: 2.50,
        changesPercentage: 1.69,
        volume: 50000000,
        timestamp: 1642291200
      }
    ]

    it('should fetch and parse stock price data successfully', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuoteResponse
      })

      const result = await api.getStockPrice('AAPL')

      expect(result).toEqual({
        symbol: 'AAPL',
        price: 150.25,
        change: 2.50,
        changePercent: 1.69,
        volume: 50000000,
        timestamp: new Date(1642291200 * 1000).getTime(),
        source: 'fmp'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v3/quote/AAPL'),
        expect.objectContaining({
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'VFR-API/1.0'
          }
        })
      )
    })

    it('should convert symbol to uppercase', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuoteResponse
      })

      await api.getStockPrice('aapl')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v3/quote/AAPL'),
        expect.anything()
      )
    })

    it('should return null when API key is missing', async () => {
      const originalEnv = process.env.FMP_API_KEY
      delete process.env.FMP_API_KEY
      const noKeyApi = new FinancialModelingPrepAPI('')
      const result = await noKeyApi.getStockPrice('AAPL')

      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()

      process.env.FMP_API_KEY = originalEnv
    })

    it('should return null when API response is unsuccessful', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      const result = await api.getStockPrice('INVALID')
      expect(result).toBeNull()
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await api.getStockPrice('AAPL')

      expect(result).toBeNull()
    })

    it('should handle HTTP errors', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      const result = await api.getStockPrice('AAPL')
      expect(result).toBeNull()
    })

    it('should handle API error messages', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'Error Message': 'Invalid API call'
        })
      })

      const result = await api.getStockPrice('INVALID')
      expect(result).toBeNull()
    })

    it('should handle rate limit messages', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => 'You have reached the limit of API calls'
      })

      const result = await api.getStockPrice('AAPL')
      expect(result).toBeNull()
    })
  })

  describe('getCompanyInfo', () => {
    const mockProfileResponse = [
      {
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        description: 'Apple Inc. designs and manufactures consumer electronics...',
        sector: 'Technology',
        mktCap: '2800000000000',
        fullTimeEmployees: '164000',
        website: 'https://www.apple.com'
      }
    ]

    it('should fetch and parse company information successfully', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfileResponse
      })

      const result = await api.getCompanyInfo('AAPL')

      expect(result).toEqual({
        symbol: 'AAPL',
        name: 'Apple Inc.',
        description: 'Apple Inc. designs and manufactures consumer electronics...',
        sector: 'Technology',
        marketCap: 2800000000000,
        employees: 164000,
        website: 'https://www.apple.com'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v3/profile/AAPL'),
        expect.anything()
      )
    })

    it('should return null when API key is missing', async () => {
      const originalEnv = process.env.FMP_API_KEY
      delete process.env.FMP_API_KEY
      const noKeyApi = new FinancialModelingPrepAPI('')
      const result = await noKeyApi.getCompanyInfo('AAPL')

      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()

      process.env.FMP_API_KEY = originalEnv
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await api.getCompanyInfo('AAPL')

      expect(result).toBeNull()
    })
  })

  describe('getMarketData', () => {
    const mockHistoricalResponse = {
      historical: [
        {
          date: '2024-01-15',
          open: 150.00,
          high: 155.00,
          low: 149.50,
          close: 154.25,
          volume: 45000000
        }
      ]
    }

    it('should fetch and parse market data successfully', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistoricalResponse
      })

      const result = await api.getMarketData('AAPL')

      expect(result).toEqual({
        symbol: 'AAPL',
        open: 150.00,
        high: 155.00,
        low: 149.50,
        close: 154.25,
        volume: 45000000,
        timestamp: new Date('2024-01-15').getTime(),
        source: 'fmp'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v3/historical-price-full/AAPL'),
        expect.anything()
      )
    })

    it('should return null when API key is missing', async () => {
      const originalEnv = process.env.FMP_API_KEY
      delete process.env.FMP_API_KEY
      const noKeyApi = new FinancialModelingPrepAPI('')
      const result = await noKeyApi.getMarketData('AAPL')

      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()

      process.env.FMP_API_KEY = originalEnv
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await api.getMarketData('AAPL')

      expect(result).toBeNull()
    })
  })

  describe('healthCheck', () => {
    it('should return true when API is healthy', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            symbol: 'AAPL',
            price: 150.00
          }
        ]
      })

      const result = await api.healthCheck()
      expect(result).toBe(true)
    })

    it('should return false when API key is missing', async () => {
      const originalEnv = process.env.FMP_API_KEY
      delete process.env.FMP_API_KEY
      const noKeyApi = new FinancialModelingPrepAPI('')
      const result = await noKeyApi.healthCheck()
      expect(result).toBe(false)
      process.env.FMP_API_KEY = originalEnv
    })

    it('should return false when API returns error message', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'Error Message': 'Invalid API call'
        })
      })

      const result = await api.healthCheck()
      expect(result).toBe(false)
    })

    it('should return false on network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await api.healthCheck()
      expect(result).toBe(false)
    })
  })

  describe('getStocksBySector', () => {
    const mockScreenerResponse = [
      {
        symbol: 'AAPL',
        price: 150.25,
        change: 2.50,
        changesPercentage: 1.69,
        volume: 50000000
      },
      {
        symbol: 'MSFT',
        price: 310.50,
        change: 5.25,
        changesPercentage: 1.72,
        volume: 35000000
      }
    ]

    it('should fetch and parse sector stocks successfully', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockScreenerResponse
      })

      const result = await api.getStocksBySector('Technology', 20)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        symbol: 'AAPL',
        price: 150.25,
        change: 2.50,
        changePercent: 1.69,
        volume: 50000000,
        timestamp: expect.any(Number),
        source: 'fmp'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v3/stock-screener?sector=Technology&limit=20'),
        expect.anything()
      )
    })

    it('should return empty array when API key is missing', async () => {
      const originalEnv = process.env.FMP_API_KEY
      delete process.env.FMP_API_KEY
      const noKeyApi = new FinancialModelingPrepAPI('')
      const result = await noKeyApi.getStocksBySector('Technology')

      expect(result).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()

      process.env.FMP_API_KEY = originalEnv
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await api.getStocksBySector('Technology')

      expect(result).toEqual([])
    })

    it('should filter out invalid stocks', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { symbol: 'AAPL', price: 150.25, change: 2.50, changesPercentage: 1.69, volume: 50000000 },
          { symbol: '', price: 0, change: 0, changesPercentage: 0, volume: 0 }, // Invalid stock
          { symbol: 'MSFT', price: 310.50, change: 5.25, changesPercentage: 1.72, volume: 35000000 }
        ]
      })

      const result = await api.getStocksBySector('Technology', 20)

      expect(result).toHaveLength(2)
      expect(result.every(stock => stock.symbol && stock.price > 0)).toBe(true)
    })
  })
})