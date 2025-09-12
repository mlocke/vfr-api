'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface StockData {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: number
  sector: string
}

interface UseRealTimeStocksReturn {
  stocks: StockData[]
  isConnected: boolean
  isLoading: boolean
  error: string | null
  subscribe: (sector: string) => void
  unsubscribe: (sector: string) => void
  reconnect: () => void
}

const WEBSOCKET_URL = 'ws://localhost:3001'
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 5

export function useRealTimeStocks(): UseRealTimeStocksReturn {
  const [stocks, setStocks] = useState<StockData[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentSectorRef = useRef<string | null>(null)
  
  // WebSocket connection management
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return // Already connected
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const ws = new WebSocket(WEBSOCKET_URL)
      wsRef.current = ws
      
      ws.onopen = () => {
        console.log('📡 WebSocket connected')
        setIsConnected(true)
        setIsLoading(false)
        setError(null)
        reconnectAttemptsRef.current = 0
        
        // Re-subscribe to current sector if any
        if (currentSectorRef.current) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            sector: currentSectorRef.current
          }))
        }
      }
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          switch (message.type) {
            case 'sector_update':
            case 'real_time_update':
              if (message.stocks && Array.isArray(message.stocks)) {
                setStocks(message.stocks)
              }
              break
              
            case 'pong':
              // Handle ping response
              break
              
            default:
              console.log('Unknown message type:', message.type)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }
      
      ws.onclose = (event) => {
        console.log('📡 WebSocket disconnected:', event.code, event.reason)
        setIsConnected(false)
        
        // Attempt reconnection if not a manual close
        if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          setError(`Connection lost. Reconnecting... (${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`)
          reconnectAttemptsRef.current++
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, RECONNECT_DELAY)
        } else {
          setError('Connection failed. Please refresh the page.')
          setIsLoading(false)
        }
      }
      
      ws.onerror = (error) => {
        console.error('📡 WebSocket error:', error)
        setError('WebSocket connection error')
        setIsLoading(false)
      }
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setError('Failed to establish connection')
      setIsLoading(false)
    }
  }, [])
  
  // Subscribe to sector updates
  const subscribe = useCallback((sector: string) => {
    currentSectorRef.current = sector
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        sector: sector
      }))
      console.log(`📊 Subscribed to sector: ${sector}`)
    } else {
      // Connect and subscribe when ready
      connect()
    }
  }, [connect])
  
  // Unsubscribe from sector updates
  const unsubscribe = useCallback((sector: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        sector: sector
      }))
      console.log(`📊 Unsubscribed from sector: ${sector}`)
    }
    
    if (currentSectorRef.current === sector) {
      currentSectorRef.current = null
      setStocks([])
    }
  }, [])
  
  // Manual reconnection
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    reconnectAttemptsRef.current = 0
    connect()
  }, [connect])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting')
      }
    }
  }, [])
  
  // Ping to keep connection alive
  useEffect(() => {
    if (!isConnected) return
    
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // Ping every 30 seconds
    
    return () => clearInterval(pingInterval)
  }, [isConnected])
  
  return {
    stocks,
    isConnected,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    reconnect
  }
}