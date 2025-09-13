/**
 * WebSocket Manager for Real-Time Stock Data
 * Handles connection, reconnection, and data streaming for the stock ticker
 */

interface WebSocketMessage {
  type: 'stocks_update' | 'sector_change' | 'error' | 'heartbeat'
  sector?: string
  symbols?: any[]
  error?: string
  timestamp: number
}

interface WebSocketConfig {
  url: string
  reconnectInterval: number
  maxReconnectAttempts: number
  heartbeatTimeout: number
}

type MessageHandler = (message: WebSocketMessage) => void
type ConnectionHandler = (connected: boolean) => void
type ErrorHandler = (error: string) => void

export class WebSocketManager {
  private ws: WebSocket | null = null
  private config: WebSocketConfig
  private currentSector: string | null = null
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private isConnecting = false
  
  // Event handlers
  private messageHandlers: MessageHandler[] = []
  private connectionHandlers: ConnectionHandler[] = []
  private errorHandlers: ErrorHandler[] = []
  
  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: config.url || 'ws://localhost:3000/api/ws/stocks',
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatTimeout: config.heartbeatTimeout || 15000,
      ...config
    }
    
    console.log('📡 WebSocket Manager initialized:', this.config.url)
  }
  
  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }
      
      if (this.isConnecting) {
        reject(new Error('Connection already in progress'))
        return
      }
      
      this.isConnecting = true
      
      try {
        console.log(`🔌 Connecting to WebSocket: ${this.config.url}`)
        this.ws = new WebSocket(this.config.url)
        
        this.ws.onopen = () => {
          console.log('✅ WebSocket connected')
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.notifyConnectionHandlers(true)
          
          // Re-subscribe to current sector if any
          if (this.currentSector) {
            this.subscribeToSector(this.currentSector)
          }
          
          resolve()
        }
        
        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error)
            this.notifyErrorHandlers('Failed to parse message')
          }
        }
        
        this.ws.onclose = (event) => {
          console.log(`🔌 WebSocket disconnected (code: ${event.code})`)
          this.isConnecting = false
          this.stopHeartbeat()
          this.notifyConnectionHandlers(false)
          
          if (event.code !== 1000) { // Not a normal closure
            this.attemptReconnect()
          }
        }
        
        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
          this.isConnecting = false
          this.notifyErrorHandlers('Connection error')
          reject(error)
        }
        
      } catch (error) {
        this.isConnecting = false
        console.error('❌ Failed to create WebSocket connection:', error)
        reject(error)
      }
    })
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    console.log('🔌 Disconnecting WebSocket')
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    this.stopHeartbeat()
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    
    this.currentSector = null
    this.reconnectAttempts = 0
  }
  
  /**
   * Subscribe to a specific sector for real-time updates
   */
  subscribeToSector(sector: string) {
    this.currentSector = sector
    
    if (this.isConnected()) {
      console.log(`📊 Subscribing to sector: ${sector}`)
      this.send({
        type: 'subscribe',
        sector,
        timestamp: Date.now()
      })
    } else {
      console.log(`📊 Will subscribe to ${sector} when connected`)
    }
  }
  
  /**
   * Unsubscribe from current sector
   */
  unsubscribe() {
    if (this.isConnected()) {
      console.log('📊 Unsubscribing from current sector')
      this.send({
        type: 'unsubscribe',
        timestamp: Date.now()
      })
    }
    
    this.currentSector = null
  }
  
  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
  
  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected(),
      connecting: this.isConnecting,
      currentSector: this.currentSector,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.config.maxReconnectAttempts
    }
  }
  
  // Event handlers
  onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler)
  }
  
  onConnection(handler: ConnectionHandler) {
    this.connectionHandlers.push(handler)
  }
  
  onError(handler: ErrorHandler) {
    this.errorHandlers.push(handler)
  }
  
  // Private methods
  
  private send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }
  
  private handleMessage(message: WebSocketMessage) {
    // Reset heartbeat timer on any message
    if (message.type === 'heartbeat') {
      this.resetHeartbeatTimer()
      return
    }
    
    // Notify all message handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(message)
      } catch (error) {
        console.error('❌ Message handler error:', error)
      }
    })
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error(`❌ Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`)
      this.notifyErrorHandlers('Max reconnection attempts reached')
      return
    }
    
    this.reconnectAttempts++
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${this.config.reconnectInterval}ms`)
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('❌ Reconnection failed:', error)
      })
    }, this.config.reconnectInterval)
  }
  
  private startHeartbeat() {
    this.resetHeartbeatTimer()
  }
  
  private resetHeartbeatTimer() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
    }
    
    this.heartbeatTimer = setTimeout(() => {
      console.warn('⚠️ WebSocket heartbeat timeout')
      this.ws?.close(1001, 'Heartbeat timeout')
    }, this.config.heartbeatTimeout)
  }
  
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
  
  private notifyConnectionHandlers(connected: boolean) {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(connected)
      } catch (error) {
        console.error('❌ Connection handler error:', error)
      }
    })
  }
  
  private notifyErrorHandlers(error: string) {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error)
      } catch (error) {
        console.error('❌ Error handler error:', error)
      }
    })
  }
}

// Export singleton instance
export const webSocketManager = new WebSocketManager()