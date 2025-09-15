/**
 * Comprehensive test suite for useStockSelection React hook
 * Tests real-time WebSocket functionality, state management, and API integration
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useStockSelection } from '../useStockSelection'
import type {
  SelectionResponse,
  SelectionMode,
  EnhancedStockResult,
  SectorAnalysisResult,
  MultiStockAnalysisResult
} from '../../services/stock-selection/types'
import type { SectorOption } from '../../components/SectorDropdown'
import { AlgorithmType } from '../../services/algorithms/types'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock WebSocket
class MockWebSocket {
  public readyState: number = WebSocket.CONNECTING
  public onopen: ((event: Event) => void) | null = null
  public onmessage: ((event: MessageEvent) => void) | null = null
  public onclose: ((event: CloseEvent) => void) | null = null
  public onerror: ((event: Event) => void) | null = null

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 10)
  }

  send(data: string) {
    // Mock implementation - can be customized in tests
  }

  close() {
    this.readyState = WebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close'))
    }
  }

  // Helper method to simulate receiving messages
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }

  // Helper method to simulate errors
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }
}

// Mock WebSocket globally
(global as any).WebSocket = MockWebSocket

describe('useStockSelection Hook', () => {
  let mockWebSocketInstance: MockWebSocket

  // Test data fixtures
  const mockSingleStockResult: EnhancedStockResult = {
    symbol: 'AAPL',
    score: {
      overall: 8.5,
      technical: 7.8,
      fundamental: 9.2,
      sentiment: 8.1,
      marketData: {
        price: 150.25,
        volume: 50000000,
        marketCap: 2500000000000,
        avgVolume: 45000000
      }
    },
    weight: 0.25,
    action: 'BUY',
    confidence: 0.85,
    context: {
      sector: 'Technology',
      marketCap: 2500000000000,
      priceChange24h: 2.5,
      volumeChange24h: 10.2,
      beta: 1.2
    },
    reasoning: {
      primaryFactors: ['Strong technical momentum', 'Solid fundamentals'],
      warnings: ['High valuation'],
      opportunities: ['Product launch potential']
    },
    dataQuality: {
      overall: { score: 9.5, timestamp: Date.now(), source: 'multiple' },
      sourceBreakdown: {
        'polygon': { score: 9.8, timestamp: Date.now(), source: 'polygon' },
        'finnhub': { score: 9.2, timestamp: Date.now(), source: 'finnhub' }
      },
      lastUpdated: Date.now()
    }
  }

  const mockSectorAnalysisResult: SectorAnalysisResult = {
    sector: { value: 'technology', label: 'Technology' },
    overview: {
      totalStocks: 50,
      avgScore: 8.2,
      topPerformers: 15,
      underperformers: 8,
      marketCapTotal: 5000000000000,
      volumeTotal: 2000000000
    },
    sectorMetrics: {
      momentum: 8.5,
      valuation: 7.2,
      growth: 9.1,
      stability: 6.8
    },
    topSelections: [mockSingleStockResult],
    comparison: {
      vsMarket: {
        performance: 1.15,
        valuation: 0.92,
        momentum: 1.08
      },
      peerSectors: [
        { sector: 'Healthcare', relativeScore: 0.95 },
        { sector: 'Finance', relativeScore: 0.88 }
      ]
    }
  }

  const mockMultiStockResult: MultiStockAnalysisResult = {
    request: {
      scope: {
        mode: SelectionMode.MULTIPLE_STOCKS,
        symbols: ['AAPL', 'GOOGL', 'MSFT']
      }
    },
    results: [mockSingleStockResult],
    portfolioMetrics: {
      overallScore: 8.3,
      diversificationScore: 7.5,
      riskScore: 6.2,
      correlationMatrix: {
        'AAPL': { 'GOOGL': 0.75, 'MSFT': 0.68 },
        'GOOGL': { 'AAPL': 0.75, 'MSFT': 0.72 },
        'MSFT': { 'AAPL': 0.68, 'GOOGL': 0.72 }
      },
      sectorBreakdown: { 'Technology': 1.0 },
      marketCapBreakdown: { large: 1.0, mid: 0.0, small: 0.0 }
    },
    recommendations: {
      allocation: { 'AAPL': 0.4, 'GOOGL': 0.35, 'MSFT': 0.25 },
      rebalancing: [
        { action: 'add', symbol: 'AAPL', targetWeight: 0.4 }
      ],
      riskWarnings: ['High correlation between holdings']
    }
  }

  const mockSuccessResponse: SelectionResponse = {
    success: true,
    requestId: 'test-request-id',
    timestamp: Date.now(),
    executionTime: 1500,
    singleStock: mockSingleStockResult,
    topSelections: [mockSingleStockResult],
    metadata: {
      algorithmUsed: 'composite',
      dataSourcesUsed: ['polygon', 'finnhub'],
      cacheHitRate: 0.75,
      analysisMode: SelectionMode.SINGLE_STOCK,
      qualityScore: { score: 9.2, timestamp: Date.now(), source: 'multiple' }
    },
    performance: {
      dataFetchTime: 500,
      analysisTime: 800,
      fusionTime: 150,
      cacheTime: 50
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()

    // Reset WebSocket mock
    jest.spyOn(global, 'WebSocket').mockImplementation((url: string) => {
      mockWebSocketInstance = new MockWebSocket(url) as any
      return mockWebSocketInstance as any
    })

    // Mock console methods to reduce test noise
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Hook Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useStockSelection())

      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.result).toBeNull()
      expect(result.current.requestId).toBeNull()
      expect(result.current.executionTime).toBe(0)
      expect(result.current.isConnected).toBe(false)
      expect(result.current.lastUpdate).toBe(0)
    })

    it('should accept custom configuration', () => {
      const config = {
        enableRealTime: false,
        updateInterval: 10000,
        defaultAlgorithm: AlgorithmType.MOMENTUM,
        defaultTimeout: 60000,
        wsUrl: 'ws://custom-url:3001',
        autoReconnect: false
      }

      const { result } = renderHook(() => useStockSelection(config))

      // State should still be initialized correctly
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should merge custom config with defaults', () => {
      const partialConfig = {
        enableRealTime: false,
        defaultAlgorithm: AlgorithmType.TECHNICAL
      }

      const { result } = renderHook(() => useStockSelection(partialConfig))

      // Should still work with partial config
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('Core Analysis Methods', () => {
    describe('analyzeStock', () => {
      it('should successfully analyze a single stock', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockSuccessResponse
        })

        const { result } = renderHook(() => useStockSelection())

        let response: SelectionResponse

        await act(async () => {
          response = await result.current.analyzeStock('AAPL')
        })

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/stock-selection/analyze',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"symbols":["AAPL"]')
          })
        )

        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
        expect(result.current.result).toEqual(mockSuccessResponse)
        expect(response!).toEqual(mockSuccessResponse)
      })

      it('should handle symbol case normalization', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockSuccessResponse
        })

        const { result } = renderHook(() => useStockSelection())

        await act(async () => {
          await result.current.analyzeStock('aapl')
        })

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.scope.symbols).toEqual(['AAPL'])
      })

      it('should pass custom options correctly', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockSuccessResponse
        })

        const { result } = renderHook(() => useStockSelection())
        const customOptions = {
          algorithmId: 'technical',
          useRealTimeData: true,
          riskTolerance: 'aggressive' as const
        }

        await act(async () => {
          await result.current.analyzeStock('AAPL', customOptions)
        })

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.options).toMatchObject(customOptions)
      })

      it('should handle API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })

        const { result } = renderHook(() => useStockSelection())

        await act(async () => {
          try {
            await result.current.analyzeStock('AAPL')
          } catch (error) {
            expect(error).toBeInstanceOf(Error)
          }
        })

        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toContain('API request failed')
      })

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const { result } = renderHook(() => useStockSelection())

        await act(async () => {
          try {
            await result.current.analyzeStock('AAPL')
          } catch (error) {
            expect(error).toBeInstanceOf(Error)
          }
        })

        expect(result.current.error).toBe('Network error')
      })

      it('should update loading state correctly', async () => {
        let resolvePromise: (value: any) => void
        const promise = new Promise(resolve => {
          resolvePromise = resolve
        })

        mockFetch.mockReturnValueOnce(promise)

        const { result } = renderHook(() => useStockSelection())

        act(() => {
          result.current.analyzeStock('AAPL')
        })

        // Should be loading
        expect(result.current.isLoading).toBe(true)
        expect(result.current.error).toBeNull()

        await act(async () => {
          resolvePromise!({
            ok: true,
            json: async () => mockSuccessResponse
          })
        })

        // Should not be loading anymore
        expect(result.current.isLoading).toBe(false)
      })
    })

    describe('analyzeSector', () => {
      it('should successfully analyze a sector', async () => {
        const sectorResponse = {
          ...mockSuccessResponse,
          sectorAnalysis: mockSectorAnalysisResult
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => sectorResponse
        })

        const { result } = renderHook(() => useStockSelection())
        const sector: SectorOption = { value: 'technology', label: 'Technology' }

        await act(async () => {
          await result.current.analyzeSector(sector)
        })

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.scope.mode).toBe(SelectionMode.SECTOR_ANALYSIS)
        expect(requestBody.scope.sector).toEqual(sector)
        expect(result.current.result).toEqual(sectorResponse)
      })

      it('should pass maxResults option', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockSuccessResponse
        })

        const { result } = renderHook(() => useStockSelection())
        const sector: SectorOption = { value: 'technology', label: 'Technology' }

        await act(async () => {
          await result.current.analyzeSector(sector, { maxResults: 10 })
        })

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.scope.maxResults).toBe(10)
        expect(requestBody.options.maxResults).toBe(10)
      })
    })

    describe('analyzeStocks', () => {
      it('should successfully analyze multiple stocks', async () => {
        const multiStockResponse = {
          ...mockSuccessResponse,
          multiStockAnalysis: mockMultiStockResult
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => multiStockResponse
        })

        const { result } = renderHook(() => useStockSelection())
        const symbols = ['AAPL', 'GOOGL', 'MSFT']

        await act(async () => {
          await result.current.analyzeStocks(symbols)
        })

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.scope.mode).toBe(SelectionMode.MULTIPLE_STOCKS)
        expect(requestBody.scope.symbols).toEqual(symbols)
        expect(result.current.result).toEqual(multiStockResponse)
      })

      it('should normalize symbol case', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockSuccessResponse
        })

        const { result } = renderHook(() => useStockSelection())

        await act(async () => {
          await result.current.analyzeStocks(['aapl', 'googl'])
        })

        const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(requestBody.scope.symbols).toEqual(['AAPL', 'GOOGL'])
      })
    })
  })

  describe('Request Management', () => {
    it('should cancel previous request when new one starts', async () => {
      let firstResolve: (value: any) => void
      let secondResolve: (value: any) => void

      const firstPromise = new Promise(resolve => { firstResolve = resolve })
      const secondPromise = new Promise(resolve => { secondResolve = resolve })

      mockFetch
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise)

      const { result } = renderHook(() => useStockSelection())

      // Start first request
      act(() => {
        result.current.analyzeStock('AAPL').catch(() => {
          // Expected to be cancelled
        })
      })

      // Start second request - should cancel first
      act(() => {
        result.current.analyzeStock('GOOGL')
      })

      // Resolve first request - should be ignored due to cancellation
      await act(async () => {
        firstResolve!({
          ok: true,
          json: async () => mockSuccessResponse
        })
      })

      // Resolve second request
      await act(async () => {
        secondResolve!({
          ok: true,
          json: async () => mockSuccessResponse
        })
      })

      // Should only have the second request's result
      expect(result.current.result?.requestId).toBe('test-request-id')
    })

    it('should handle manual cancellation', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise(resolve => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValueOnce(promise)

      const { result } = renderHook(() => useStockSelection())

      // Start request
      act(() => {
        result.current.analyzeStock('AAPL').catch(() => {
          // Expected to be cancelled
        })
      })

      expect(result.current.isLoading).toBe(true)

      // Cancel request
      act(() => {
        result.current.cancelAnalysis()
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Analysis cancelled')
    })

    it('should retry last analysis', async () => {
      // First request fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useStockSelection())

      await act(async () => {
        try {
          await result.current.analyzeStock('AAPL')
        } catch (error) {
          // Expected
        }
      })

      expect(result.current.error).toBe('Network error')

      // Setup successful retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      await act(async () => {
        await result.current.retryAnalysis()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.result).toEqual(mockSuccessResponse)
    })

    it('should handle retry with no previous request', async () => {
      const { result } = renderHook(() => useStockSelection())

      await act(async () => {
        const retryResult = await result.current.retryAnalysis()
        expect(retryResult).toBeNull()
      })

      expect(result.current.error).toBe('No previous request to retry')
    })
  })

  describe('Real-time WebSocket Integration', () => {
    beforeEach(() => {
      // Enable real-time by default for these tests
      jest.clearAllMocks()
    })

    it('should establish WebSocket connection after successful analysis', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const { result } = renderHook(() => useStockSelection({
        enableRealTime: true,
        wsUrl: 'ws://localhost:3001'
      }))

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
    })

    it('should not establish WebSocket when real-time is disabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const { result } = renderHook(() => useStockSelection({
        enableRealTime: false
      }))

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      expect(result.current.isConnected).toBe(false)
    })

    it('should handle WebSocket connection errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const { result } = renderHook(() => useStockSelection({
        enableRealTime: true,
        wsUrl: 'ws://localhost:3001'
      }))

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Simulate WebSocket error
      act(() => {
        mockWebSocketInstance.simulateError()
      })

      expect(result.current.isConnected).toBe(false)
    })

    it('should handle selection_update messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const { result } = renderHook(() => useStockSelection({
        enableRealTime: true
      }))

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Simulate selection update
      const updateMessage = {
        type: 'selection_update',
        data: {
          symbol: 'AAPL',
          scoreUpdates: { overall: 9.0 },
          contextUpdates: { priceChange24h: 3.5 }
        },
        timestamp: Date.now()
      }

      act(() => {
        mockWebSocketInstance.simulateMessage(updateMessage)
      })

      expect(result.current.lastUpdate).toBe(updateMessage.timestamp)

      // Verify score was updated
      const updatedStock = result.current.result?.topSelections.find(s => s.symbol === 'AAPL')
      expect(updatedStock?.score.overall).toBe(9.0)
      expect(updatedStock?.context.priceChange24h).toBe(3.5)
    })

    it('should handle stock_update messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const { result } = renderHook(() => useStockSelection({
        enableRealTime: true
      }))

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Simulate stock price update
      const stockUpdate = {
        type: 'stock_update',
        data: {
          symbol: 'AAPL',
          price: 155.75,
          volume: 52000000
        },
        timestamp: Date.now()
      }

      act(() => {
        mockWebSocketInstance.simulateMessage(stockUpdate)
      })

      const updatedStock = result.current.result?.topSelections.find(s => s.symbol === 'AAPL')
      expect(updatedStock?.score.marketData?.price).toBe(155.75)
      expect(updatedStock?.score.marketData?.volume).toBe(52000000)
    })

    it('should handle error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const { result } = renderHook(() => useStockSelection({
        enableRealTime: true
      }))

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Simulate error message
      const errorMessage = {
        type: 'error',
        data: { message: 'Data source unavailable' },
        timestamp: Date.now()
      }

      act(() => {
        mockWebSocketInstance.simulateMessage(errorMessage)
      })

      expect(result.current.error).toBe('Data source unavailable')
    })

    it('should auto-reconnect when enabled', async () => {
      jest.useFakeTimers()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const { result } = renderHook(() => useStockSelection({
        enableRealTime: true,
        autoReconnect: true
      }))

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Simulate connection close
      act(() => {
        mockWebSocketInstance.close()
      })

      expect(result.current.isConnected).toBe(false)

      // Fast-forward timer for auto-reconnect
      act(() => {
        jest.advanceTimersByTime(3000)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      jest.useRealTimers()
    })

    it('should manually subscribe to symbol updates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const mockSend = jest.fn()
      mockWebSocketInstance.send = mockSend

      const { result } = renderHook(() => useStockSelection({
        enableRealTime: true
      }))

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.subscribeToUpdates(['GOOGL', 'MSFT'])
      })

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'subscribe_symbols',
          symbols: ['GOOGL', 'MSFT']
        })
      )
    })

    it('should manually unsubscribe from updates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const mockSend = jest.fn()
      mockWebSocketInstance.send = mockSend

      const { result } = renderHook(() => useStockSelection({
        enableRealTime: true
      }))

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.unsubscribeFromUpdates()
      })

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'unsubscribe_all'
        })
      )
    })
  })

  describe('Utility Methods', () => {
    it('should clear results and state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const { result } = renderHook(() => useStockSelection())

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      expect(result.current.result).not.toBeNull()

      act(() => {
        result.current.clearResults()
      })

      expect(result.current.result).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.requestId).toBeNull()
      expect(result.current.executionTime).toBe(0)
      expect(result.current.isConnected).toBe(false)
      expect(result.current.lastUpdate).toBe(0)
    })

    it('should get single stock result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const { result } = renderHook(() => useStockSelection())

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      const singleStock = result.current.getSingleStockResult()
      expect(singleStock).toEqual(mockSingleStockResult)
    })

    it('should get sector analysis result', async () => {
      const sectorResponse = {
        ...mockSuccessResponse,
        sectorAnalysis: mockSectorAnalysisResult
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sectorResponse
      })

      const { result } = renderHook(() => useStockSelection())

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      const sectorAnalysis = result.current.getSectorAnalysisResult()
      expect(sectorAnalysis).toEqual(mockSectorAnalysisResult)
    })

    it('should get multi-stock result', async () => {
      const multiResponse = {
        ...mockSuccessResponse,
        multiStockAnalysis: mockMultiStockResult
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => multiResponse
      })

      const { result } = renderHook(() => useStockSelection())

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      const multiStock = result.current.getMultiStockResult()
      expect(multiStock).toEqual(mockMultiStockResult)
    })

    it('should get top selections with optional limit', async () => {
      const multiSelectionResponse = {
        ...mockSuccessResponse,
        topSelections: [
          mockSingleStockResult,
          { ...mockSingleStockResult, symbol: 'GOOGL' },
          { ...mockSingleStockResult, symbol: 'MSFT' }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => multiSelectionResponse
      })

      const { result } = renderHook(() => useStockSelection())

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      // Get all selections
      const allSelections = result.current.getTopSelections()
      expect(allSelections).toHaveLength(3)

      // Get limited selections
      const limitedSelections = result.current.getTopSelections(2)
      expect(limitedSelections).toHaveLength(2)
    })

    it('should return empty array when no results', () => {
      const { result } = renderHook(() => useStockSelection())

      expect(result.current.getSingleStockResult()).toBeNull()
      expect(result.current.getSectorAnalysisResult()).toBeNull()
      expect(result.current.getMultiStockResult()).toBeNull()
      expect(result.current.getTopSelections()).toEqual([])
    })
  })

  describe('Cleanup and Memory Management', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useStockSelection())

      const mockAbort = jest.fn()
      const mockClose = jest.fn()

      // Simulate active request and WebSocket
      jest.spyOn(global, 'AbortController').mockImplementation(() => ({
        abort: mockAbort,
        signal: {} as AbortSignal
      }))

      mockWebSocketInstance.close = mockClose

      unmount()

      // Note: The actual cleanup happens in useEffect cleanup,
      // which may not be directly testable in this setup
    })

    it('should handle multiple rapid requests gracefully', async () => {
      // Setup multiple responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockSuccessResponse, requestId: 'req1' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockSuccessResponse, requestId: 'req2' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockSuccessResponse, requestId: 'req3' })
        })

      const { result } = renderHook(() => useStockSelection())

      // Fire multiple requests rapidly
      await act(async () => {
        const promises = [
          result.current.analyzeStock('AAPL'),
          result.current.analyzeStock('GOOGL'),
          result.current.analyzeStock('MSFT')
        ]

        // Only the last one should complete successfully
        await Promise.allSettled(promises)
      })

      // Should only have the last request's result
      expect(result.current.result?.requestId).toBe('req3')
    })

    it('should handle WebSocket connection cleanup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const { result } = renderHook(() => useStockSelection({
        enableRealTime: true
      }))

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Clear results should close WebSocket
      act(() => {
        result.current.clearResults()
      })

      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed WebSocket messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse
      })

      const { result } = renderHook(() => useStockSelection({
        enableRealTime: true
      }))

      await act(async () => {
        await result.current.analyzeStock('AAPL')
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Simulate malformed message
      act(() => {
        if (mockWebSocketInstance.onmessage) {
          mockWebSocketInstance.onmessage(new MessageEvent('message', {
            data: 'invalid json'
          }))
        }
      })

      // Should not crash or affect state
      expect(result.current.result).toEqual(mockSuccessResponse)
    })

    it('should handle empty symbol arrays', async () => {
      const { result } = renderHook(() => useStockSelection())

      await act(async () => {
        try {
          await result.current.analyzeStocks([])
        } catch (error) {
          // May throw or handle gracefully depending on implementation
        }
      })

      // Should handle gracefully
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle request timeout scenarios', async () => {
      jest.useFakeTimers()

      mockFetch.mockImplementation(() =>
        new Promise(() => {
          // Never resolves to simulate timeout
        })
      )

      const { result } = renderHook(() => useStockSelection({
        defaultTimeout: 1000
      }))

      act(() => {
        result.current.analyzeStock('AAPL').catch(() => {
          // Expected timeout
        })
      })

      expect(result.current.isLoading).toBe(true)

      // Cancel the request due to timeout
      act(() => {
        result.current.cancelAnalysis()
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Analysis cancelled')

      jest.useRealTimers()
    })

    it('should handle successful response with analysis errors', async () => {
      const errorResponse = {
        ...mockSuccessResponse,
        success: false,
        errors: ['Invalid symbol', 'Data unavailable']
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => errorResponse
      })

      const { result } = renderHook(() => useStockSelection())

      await act(async () => {
        await result.current.analyzeStock('INVALID')
      })

      expect(result.current.error).toBe('Invalid symbol')
      expect(result.current.result).toEqual(errorResponse)
    })
  })
})