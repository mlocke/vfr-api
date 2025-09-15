'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { SectorOption } from '../components/SectorDropdown'
import {
  SelectionRequest,
  SelectionResponse,
  SelectionMode,
  SelectionOptions,
  EnhancedStockResult,
  SectorAnalysisResult,
  MultiStockAnalysisResult
} from '../services/stock-selection/types'
import { AlgorithmType } from '../services/algorithms/types'

/**
 * Hook state interface
 */
interface UseStockSelectionState {
  // Core state
  isLoading: boolean
  error: string | null
  result: SelectionResponse | null

  // Execution tracking
  requestId: string | null
  executionTime: number

  // Real-time updates
  isConnected: boolean
  lastUpdate: number
}

/**
 * Hook configuration interface
 */
interface UseStockSelectionConfig {
  // Real-time updates
  enableRealTime?: boolean
  updateInterval?: number

  // Default options
  defaultAlgorithm?: AlgorithmType
  defaultTimeout?: number

  // WebSocket integration
  wsUrl?: string
  autoReconnect?: boolean
}

/**
 * Hook return interface with convenience methods
 */
interface UseStockSelectionReturn extends UseStockSelectionState {
  // Core analysis methods
  analyzeStock: (symbol: string, options?: SelectionOptions) => Promise<SelectionResponse>
  analyzeSector: (sector: SectorOption, options?: SelectionOptions) => Promise<SelectionResponse>
  analyzeStocks: (symbols: string[], options?: SelectionOptions) => Promise<SelectionResponse>

  // Utility methods
  cancelAnalysis: () => void
  retryAnalysis: () => Promise<SelectionResponse | null>
  clearResults: () => void

  // Real-time controls
  subscribeToUpdates: (symbols: string[]) => void
  unsubscribeFromUpdates: () => void

  // Getters for specific results
  getSingleStockResult: () => EnhancedStockResult | null
  getSectorAnalysisResult: () => SectorAnalysisResult | null
  getMultiStockResult: () => MultiStockAnalysisResult | null
  getTopSelections: (limit?: number) => EnhancedStockResult[]
}

/**
 * WebSocket message types for real-time updates
 */
interface StockSelectionWSMessage {
  type: 'selection_update' | 'stock_update' | 'sector_update' | 'error'
  data: any
  timestamp: number
  requestId?: string
}

const DEFAULT_CONFIG: UseStockSelectionConfig = {
  enableRealTime: true,
  updateInterval: 5000, // 5 seconds
  defaultAlgorithm: AlgorithmType.COMPOSITE,
  defaultTimeout: 30000, // 30 seconds
  wsUrl: 'ws://localhost:3001',
  autoReconnect: true
}

const STOCK_SELECTION_API_BASE = '/api/stock-selection'

/**
 * React hook for stock selection with convenience methods and real-time updates
 */
export function useStockSelection(config: UseStockSelectionConfig = {}): UseStockSelectionReturn {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  // Core state
  const [state, setState] = useState<UseStockSelectionState>({
    isLoading: false,
    error: null,
    result: null,
    requestId: null,
    executionTime: 0,
    isConnected: false,
    lastUpdate: 0
  })

  // Refs for managing requests and connections
  const currentRequestRef = useRef<AbortController | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const lastRequestRef = useRef<SelectionRequest | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Core API request function
   */
  const executeRequest = useCallback(async (request: SelectionRequest): Promise<SelectionResponse> => {
    // Cancel any existing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort()
    }

    // Create new abort controller
    const abortController = new AbortController()
    currentRequestRef.current = abortController
    lastRequestRef.current = request

    const startTime = Date.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      requestId,
      executionTime: 0
    }))

    try {
      const response = await fetch(`${STOCK_SELECTION_API_BASE}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          requestId,
          options: {
            timeout: finalConfig.defaultTimeout,
            ...request.options
          }
        }),
        signal: abortController.signal
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

      const result: SelectionResponse = await response.json()
      const executionTime = Date.now() - startTime

      setState(prev => ({
        ...prev,
        isLoading: false,
        result,
        executionTime,
        lastUpdate: Date.now(),
        error: result.success ? null : (result.errors?.[0] || 'Analysis failed')
      }))

      // Setup real-time updates if enabled
      if (finalConfig.enableRealTime && result.success) {
        setupRealTimeUpdates(result)
      }

      return result

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, don't update state
        return Promise.reject(new Error('Request cancelled'))
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const executionTime = Date.now() - startTime

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        executionTime
      }))

      throw error
    } finally {
      currentRequestRef.current = null
    }
  }, [finalConfig.defaultTimeout, finalConfig.enableRealTime])

  /**
   * Setup real-time WebSocket updates for selected stocks
   */
  const setupRealTimeUpdates = useCallback((result: SelectionResponse) => {
    if (!finalConfig.enableRealTime || !finalConfig.wsUrl) return

    try {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close()
      }

      const ws = new WebSocket(finalConfig.wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('📡 Stock selection WebSocket connected')
        setState(prev => ({ ...prev, isConnected: true }))

        // Subscribe to updates for top selections
        const symbols = result.topSelections.map(s => s.symbol)
        if (symbols.length > 0) {
          ws.send(JSON.stringify({
            type: 'subscribe_selection_updates',
            symbols,
            requestId: result.requestId
          }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const message: StockSelectionWSMessage = JSON.parse(event.data)
          handleRealTimeMessage(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = () => {
        console.log('📡 Stock selection WebSocket disconnected')
        setState(prev => ({ ...prev, isConnected: false }))

        // Auto-reconnect if enabled
        if (finalConfig.autoReconnect) {
          setTimeout(() => setupRealTimeUpdates(result), 3000)
        }
      }

      ws.onerror = (error) => {
        console.error('📡 Stock selection WebSocket error:', error)
        setState(prev => ({ ...prev, isConnected: false }))
      }

    } catch (error) {
      console.error('Failed to setup real-time updates:', error)
    }
  }, [finalConfig.enableRealTime, finalConfig.wsUrl, finalConfig.autoReconnect])

  /**
   * Handle real-time WebSocket messages
   */
  const handleRealTimeMessage = useCallback((message: StockSelectionWSMessage) => {
    switch (message.type) {
      case 'selection_update':
        setState(prev => {
          if (!prev.result) return prev

          // Update specific stock data
          const updatedSelections = prev.result.topSelections.map(stock => {
            if (stock.symbol === message.data.symbol) {
              return {
                ...stock,
                score: {
                  ...stock.score,
                  ...message.data.scoreUpdates
                },
                context: {
                  ...stock.context,
                  ...message.data.contextUpdates
                }
              }
            }
            return stock
          })

          return {
            ...prev,
            result: {
              ...prev.result,
              topSelections: updatedSelections
            },
            lastUpdate: message.timestamp
          }
        })
        break

      case 'stock_update':
        // Handle individual stock price/volume updates
        setState(prev => {
          if (!prev.result) return prev

          const updatedSelections = prev.result.topSelections.map(stock => {
            if (stock.symbol === message.data.symbol) {
              return {
                ...stock,
                score: {
                  ...stock.score,
                  marketData: {
                    ...stock.score.marketData,
                    price: message.data.price,
                    volume: message.data.volume
                  }
                }
              }
            }
            return stock
          })

          return {
            ...prev,
            result: {
              ...prev.result,
              topSelections: updatedSelections
            },
            lastUpdate: message.timestamp
          }
        })
        break

      case 'error':
        setState(prev => ({
          ...prev,
          error: message.data.message || 'Real-time update error'
        }))
        break
    }
  }, [])

  /**
   * Convenience method: Analyze single stock
   */
  const analyzeStock = useCallback(async (symbol: string, options?: SelectionOptions): Promise<SelectionResponse> => {
    const request: SelectionRequest = {
      scope: {
        mode: SelectionMode.SINGLE_STOCK,
        symbols: [symbol.toUpperCase()]
      },
      options: {
        algorithmId: finalConfig.defaultAlgorithm,
        ...options
      }
    }

    return executeRequest(request)
  }, [executeRequest, finalConfig.defaultAlgorithm])

  /**
   * Convenience method: Analyze sector
   */
  const analyzeSector = useCallback(async (sector: SectorOption, options?: SelectionOptions): Promise<SelectionResponse> => {
    const request: SelectionRequest = {
      scope: {
        mode: SelectionMode.SECTOR_ANALYSIS,
        sector,
        maxResults: options?.maxResults || 20
      },
      options: {
        algorithmId: finalConfig.defaultAlgorithm,
        ...options
      }
    }

    return executeRequest(request)
  }, [executeRequest, finalConfig.defaultAlgorithm])

  /**
   * Convenience method: Analyze multiple stocks
   */
  const analyzeStocks = useCallback(async (symbols: string[], options?: SelectionOptions): Promise<SelectionResponse> => {
    const request: SelectionRequest = {
      scope: {
        mode: SelectionMode.MULTIPLE_STOCKS,
        symbols: symbols.map(s => s.toUpperCase())
      },
      options: {
        algorithmId: finalConfig.defaultAlgorithm,
        ...options
      }
    }

    return executeRequest(request)
  }, [executeRequest, finalConfig.defaultAlgorithm])

  /**
   * Cancel current analysis
   */
  const cancelAnalysis = useCallback(() => {
    if (currentRequestRef.current) {
      currentRequestRef.current.abort()
      currentRequestRef.current = null
    }

    setState(prev => ({
      ...prev,
      isLoading: false,
      error: 'Analysis cancelled'
    }))
  }, [])

  /**
   * Retry last analysis
   */
  const retryAnalysis = useCallback(async (): Promise<SelectionResponse | null> => {
    if (!lastRequestRef.current) {
      setState(prev => ({ ...prev, error: 'No previous request to retry' }))
      return null
    }

    try {
      return await executeRequest(lastRequestRef.current)
    } catch (error) {
      return null
    }
  }, [executeRequest])

  /**
   * Clear all results and state
   */
  const clearResults = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      result: null,
      requestId: null,
      executionTime: 0,
      isConnected: false,
      lastUpdate: 0
    })

    lastRequestRef.current = null

    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  /**
   * Subscribe to real-time updates for specific symbols
   */
  const subscribeToUpdates = useCallback((symbols: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_symbols',
        symbols: symbols.map(s => s.toUpperCase())
      }))
    }
  }, [])

  /**
   * Unsubscribe from real-time updates
   */
  const unsubscribeFromUpdates = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe_all'
      }))
    }
  }, [])

  /**
   * Get single stock result
   */
  const getSingleStockResult = useCallback((): EnhancedStockResult | null => {
    return state.result?.singleStock || null
  }, [state.result])

  /**
   * Get sector analysis result
   */
  const getSectorAnalysisResult = useCallback((): SectorAnalysisResult | null => {
    return state.result?.sectorAnalysis || null
  }, [state.result])

  /**
   * Get multi-stock result
   */
  const getMultiStockResult = useCallback((): MultiStockAnalysisResult | null => {
    return state.result?.multiStockAnalysis || null
  }, [state.result])

  /**
   * Get top selections with optional limit
   */
  const getTopSelections = useCallback((limit?: number): EnhancedStockResult[] => {
    const selections = state.result?.topSelections || []
    return limit ? selections.slice(0, limit) : selections
  }, [state.result])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Cancel any active request
      if (currentRequestRef.current) {
        currentRequestRef.current.abort()
      }

      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close()
      }

      // Clear timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  return {
    // State
    ...state,

    // Core methods
    analyzeStock,
    analyzeSector,
    analyzeStocks,

    // Utility methods
    cancelAnalysis,
    retryAnalysis,
    clearResults,

    // Real-time methods
    subscribeToUpdates,
    unsubscribeFromUpdates,

    // Getters
    getSingleStockResult,
    getSectorAnalysisResult,
    getMultiStockResult,
    getTopSelections
  }
}

export default useStockSelection