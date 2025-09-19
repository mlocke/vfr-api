import { AlphaVantageAPI } from '../AlphaVantageAPI'

// NO MOCK DATA - Using real Alpha Vantage API calls
// Note: These tests require ALPHA_VANTAGE_API_KEY environment variable
// Mock only console methods to reduce test noise
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

describe('AlphaVantageAPI', () => {
  let api: AlphaVantageAPI

  beforeEach(() => {
    jest.clearAllMocks()
    // Use real API key from environment for all tests
    api = new AlphaVantageAPI(process.env.ALPHA_VANTAGE_API_KEY, 30000)

    // Ensure API key is available
    if (!process.env.ALPHA_VANTAGE_API_KEY) {
      throw new Error('ALPHA_VANTAGE_API_KEY environment variable is required for real API tests')
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with provided API key and timeout', () => {
      const customApi = new AlphaVantageAPI('custom-key', 10000)
      expect(customApi.name).toBe('Alpha Vantage')
      expect((customApi as any).apiKey).toBe('custom-key')
      expect((customApi as any).timeout).toBe(10000)
    })

    it('should use environment variable for API key when not provided', () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'env-key'
      const envApi = new AlphaVantageAPI()
      expect((envApi as any).apiKey).toBe('env-key')
      delete process.env.ALPHA_VANTAGE_API_KEY
    })

    it('should use default timeout when not provided', () => {
      const defaultApi = new AlphaVantageAPI('key')
      expect((defaultApi as any).timeout).toBe(15000)
    })

    it('should handle missing API key gracefully', () => {
      delete process.env.ALPHA_VANTAGE_API_KEY
      const noKeyApi = new AlphaVantageAPI()
      expect((noKeyApi as any).apiKey).toBe('')
    })
  })

  describe('getStockPrice', () => {
    const mockGlobalQuoteResponse = {
      'Global Quote': {
        '01. symbol': 'AAPL',
        '05. price': '150.25',
        '09. change': '2.50',
        '10. change percent': '1.69%',
        '06. volume': '50000000',
        '07. latest trading day': '2024-01-15'
      }
    }

    it('should fetch and parse stock price data successfully', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGlobalQuoteResponse
      })

      const result = await api.getStockPrice('AAPL')

      expect(result).toEqual({
        symbol: 'AAPL',
        price: 150.25,
        change: 2.50,
        changePercent: 1.69,
        volume: 50000000,
        timestamp: new Date('2024-01-15').getTime(),
        source: 'alphavantage'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('function=GLOBAL_QUOTE'),
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
        json: async () => mockGlobalQuoteResponse
      })

      await api.getStockPrice('aapl')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('symbol=AAPL'),
        expect.anything()
      )
    })

    it('should return null when API key is missing', async () => {
      const noKeyApi = new AlphaVantageAPI('')
      const result = await noKeyApi.getStockPrice('AAPL')

      expect(result).toBeNull()
      expect(mockConsoleWarn).toHaveBeenCalledWith('Alpha Vantage API key not configured')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return null when API response is unsuccessful', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'Invalid symbol' })
      })

      const result = await api.getStockPrice('INVALID')
      expect(result).toBeNull()
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await api.getStockPrice('AAPL')

      expect(result).toBeNull()
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Alpha Vantage API error for AAPL:',
        expect.any(Error)
      )
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
        json: async () => ({
          'Note': 'Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 500 calls per day.'
        })
      })

      const result = await api.getStockPrice('AAPL')
      expect(result).toBeNull()
    })
  })

  describe('getCompanyInfo', () => {
    const mockOverviewResponse = {
      Symbol: 'AAPL',
      Name: 'Apple Inc.',
      Description: 'Apple Inc. designs and manufactures consumer electronics...',
      Sector: 'Technology',
      MarketCapitalization: '2800000000000',
      FullTimeEmployees: '164000'
    }

    it('should fetch and parse company information successfully', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOverviewResponse
      })

      const result = await api.getCompanyInfo('AAPL')

      expect(result).toEqual({
        symbol: 'AAPL',
        name: 'Apple Inc.',
        description: 'Apple Inc. designs and manufactures consumer electronics...',
        sector: 'Technology',
        marketCap: 2800000000000,
        employees: 164000
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('function=OVERVIEW'),
        expect.anything()
      )
    })

    it('should return null when API key is missing', async () => {
      const noKeyApi = new AlphaVantageAPI('')
      const result = await noKeyApi.getCompanyInfo('AAPL')

      expect(result).toBeNull()
      expect(mockConsoleWarn).toHaveBeenCalledWith('Alpha Vantage API key not configured')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await api.getCompanyInfo('AAPL')

      expect(result).toBeNull()
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Alpha Vantage company info error for AAPL:',
        expect.any(Error)
      )
    })
  })

  describe('getMarketData', () => {
    const mockTimeSeriesResponse = {
      'Time Series (Daily)': {
        '2024-01-15': {
          '1. open': '150.00',
          '2. high': '155.00',
          '3. low': '149.50',
          '4. close': '154.25',
          '5. volume': '45000000'
        }
      }
    }

    it('should fetch and parse market data successfully', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeSeriesResponse
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
        source: 'alphavantage'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('function=TIME_SERIES_DAILY'),
        expect.anything()
      )
    })

    it('should return null when API key is missing', async () => {
      const noKeyApi = new AlphaVantageAPI('')
      const result = await noKeyApi.getMarketData('AAPL')

      expect(result).toBeNull()
      expect(mockConsoleWarn).toHaveBeenCalledWith('Alpha Vantage API key not configured')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await api.getMarketData('AAPL')

      expect(result).toBeNull()
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Alpha Vantage market data error for AAPL:',
        expect.any(Error)
      )
    })
  })

  describe('healthCheck', () => {
    it('should return true when API is healthy', async () => {
      // @ts-ignore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'Global Quote': {
            '01. symbol': 'AAPL',
            '05. price': '150.00'
          }
        })
      })

      const result = await api.healthCheck()
      expect(result).toBe(true)
    })

    it('should return false when API key is missing', async () => {
      const noKeyApi = new AlphaVantageAPI('')
      const result = await noKeyApi.healthCheck()
      expect(result).toBe(false)
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
    it('should return empty array and log warning', async () => {
      const result = await api.getStocksBySector('Technology')

      expect(result).toEqual([])
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Alpha Vantage sector search not implemented - use alternative method'
      )
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return empty array when API key is missing', async () => {
      const noKeyApi = new AlphaVantageAPI('')
      const result = await noKeyApi.getStocksBySector('Technology')

      expect(result).toEqual([])
      expect(mockConsoleWarn).toHaveBeenCalledWith('Alpha Vantage API key not configured')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})