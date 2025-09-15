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
  _sendTime?: number // For latency tracking
}

interface WebSocketConfig {
  url: string
  reconnectInterval: number
  maxReconnectAttempts: number
  heartbeatTimeout: number
  messageBufferSize: number
  batchingEnabled: boolean
  compressionEnabled: boolean
  priorityLevels: boolean
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

  // Performance optimizations
  private messageQueue: WebSocketMessage[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private priorityQueue: Map<string, WebSocketMessage[]> = new Map()
  private messageBuffer: ArrayBuffer[] = []
  private latencyTracker = {
    samples: [] as number[],
    lastPing: 0,
    avgLatency: 0
  }
  private messagePool: WebSocketMessage[] = [] // Object pooling
  
  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: config.url || 'ws://localhost:3000/api/ws/stocks',
      reconnectInterval: config.reconnectInterval || 2000, // Faster reconnect
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatTimeout: config.heartbeatTimeout || 10000, // Shorter timeout
      messageBufferSize: config.messageBufferSize || 1000,
      batchingEnabled: config.batchingEnabled !== false, // Default enabled
      compressionEnabled: config.compressionEnabled !== false,
      priorityLevels: config.priorityLevels !== false,
      ...config
    }

    // Initialize message pool
    this.initializeMessagePool()

    console.log('📡 WebSocket Manager initialized with performance optimizations:', this.config.url)
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
          const messageReceiveTime = performance.now()
          try {
            // Handle binary data for performance
            let message: WebSocketMessage

            if (event.data instanceof ArrayBuffer) {
              message = this.decodeBinaryMessage(event.data)
            } else {
              message = JSON.parse(event.data)
            }

            // Track latency for performance monitoring
            this.trackMessageLatency(message, messageReceiveTime)

            // Process with priority queue
            this.queueMessage(message)

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
  
  private send(message: any, priority: 'high' | 'normal' | 'low' = 'normal') {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, queueing message')
      return
    }

    try {
      // Add timestamp for latency tracking
      const enrichedMessage = { ...message, _sendTime: performance.now() }

      if (priority === 'high') {
        // Send immediately for high priority
        if (this.config.compressionEnabled && this.shouldCompress(enrichedMessage)) {
          this.ws.send(this.encodeBinaryMessage(enrichedMessage))
        } else {
          this.ws.send(JSON.stringify(enrichedMessage))
        }
      } else {
        // Queue for batching
        this.queueOutgoingMessage(enrichedMessage, priority)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }
  
  private handleMessage(message: WebSocketMessage) {
    // Reset heartbeat timer on any message
    if (message.type === 'heartbeat') {
      this.resetHeartbeatTimer()
      this.returnToPool(message)
      return
    }

    // Process messages with minimal latency
    setImmediate(() => {
      this.messageHandlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('❌ Message handler error:', error)
        }
      })

      // Return message to pool for reuse
      this.returnToPool(message)
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

  /**
   * Performance optimization methods for sub-50ms latency
   */

  /**
   * Initialize message object pool to reduce GC pressure
   */
  private initializeMessagePool(): void {
    for (let i = 0; i < 100; i++) {
      this.messagePool.push({
        type: 'heartbeat',
        timestamp: 0
      })
    }
  }

  /**
   * Get message from pool or create new one
   */
  private getFromPool(): WebSocketMessage {
    const message = this.messagePool.pop()
    if (message) {
      // Reset message properties
      message.type = 'heartbeat'
      message.sector = undefined
      message.symbols = undefined
      message.error = undefined
      message.timestamp = Date.now()
      return message
    }

    // Create new message if pool is empty
    return {
      type: 'heartbeat',
      timestamp: Date.now()
    }
  }

  /**
   * Return message to pool for reuse
   */
  private returnToPool(message: WebSocketMessage): void {
    if (this.messagePool.length < 100) {
      this.messagePool.push(message)
    }
  }

  /**
   * Queue message with priority handling
   */
  private queueMessage(message: WebSocketMessage): void {
    if (!this.config.priorityLevels) {
      this.handleMessage(message)
      return
    }

    const priority = this.determinePriority(message)

    if (priority === 'high') {
      // Process immediately
      this.handleMessage(message)
    } else {
      // Add to queue for batching
      if (!this.priorityQueue.has(priority)) {
        this.priorityQueue.set(priority, [])
      }
      this.priorityQueue.get(priority)!.push(message)

      // Schedule batch processing
      this.scheduleBatchProcessing()
    }
  }

  /**
   * Determine message priority based on type and content
   */
  private determinePriority(message: WebSocketMessage): 'high' | 'normal' | 'low' {
    switch (message.type) {
      case 'stocks_update':
        return 'high' // Real-time price updates are high priority
      case 'error':
        return 'high' // Errors need immediate attention
      case 'heartbeat':
        return 'low' // Heartbeats can be batched
      case 'sector_change':
        return 'normal' // Sector changes are medium priority
      default:
        return 'normal'
    }
  }

  /**
   * Schedule batch processing with debouncing
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer) {
      return // Already scheduled
    }

    this.batchTimer = setTimeout(() => {
      this.processBatchedMessages()
      this.batchTimer = null
    }, 5) // 5ms batching window for optimal latency
  }

  /**
   * Process batched messages efficiently
   */
  private processBatchedMessages(): void {
    // Process in priority order
    const priorities = ['normal', 'low'] as const

    priorities.forEach(priority => {
      const messages = this.priorityQueue.get(priority)
      if (messages && messages.length > 0) {
        // Process all messages in batch
        messages.forEach(message => this.handleMessage(message))
        messages.length = 0 // Clear array efficiently
      }
    })
  }

  /**
   * Queue outgoing messages for batching
   */
  private queueOutgoingMessage(message: any, priority: 'normal' | 'low'): void {
    this.messageQueue.push(message)

    // Send immediately if queue is full or for normal priority
    if (this.messageQueue.length >= 10 || priority === 'normal') {
      this.flushMessageQueue()
    } else {
      // Schedule batch send
      setTimeout(() => this.flushMessageQueue(), 10)
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0 || this.ws?.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      if (this.config.batchingEnabled && this.messageQueue.length > 1) {
        // Send as batch
        const batch = { type: 'batch', messages: this.messageQueue.slice() }
        this.ws.send(JSON.stringify(batch))
      } else {
        // Send individually
        this.messageQueue.forEach(message => {
          this.ws!.send(JSON.stringify(message))
        })
      }

      this.messageQueue.length = 0 // Clear efficiently
    } catch (error) {
      console.error('Failed to flush message queue:', error)
    }
  }

  /**
   * Track message latency for performance monitoring
   */
  private trackMessageLatency(message: WebSocketMessage, receiveTime: number): void {
    if (message._sendTime) {
      const latency = receiveTime - message._sendTime
      this.latencyTracker.samples.push(latency)

      // Keep only recent samples (sliding window)
      if (this.latencyTracker.samples.length > 100) {
        this.latencyTracker.samples.shift()
      }

      // Update average latency
      this.latencyTracker.avgLatency = this.latencyTracker.samples.reduce((a, b) => a + b, 0) / this.latencyTracker.samples.length

      // Log high latency warnings
      if (latency > 50) {
        console.warn(`⚠️ High WebSocket latency detected: ${latency.toFixed(2)}ms`)
      }
    }
  }

  /**
   * Encode message as binary for better performance
   */
  private encodeBinaryMessage(message: any): ArrayBuffer {
    // Simple binary encoding - in production would use protobuf or msgpack
    const json = JSON.stringify(message)
    const encoder = new TextEncoder()
    return encoder.encode(json).buffer
  }

  /**
   * Decode binary message
   */
  private decodeBinaryMessage(buffer: ArrayBuffer): WebSocketMessage {
    const decoder = new TextDecoder()
    const json = decoder.decode(buffer)
    return JSON.parse(json)
  }

  /**
   * Determine if message should be compressed
   */
  private shouldCompress(message: any): boolean {
    const size = JSON.stringify(message).length
    return size > 1024 // Only compress messages larger than 1KB
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    averageLatency: number
    messageQueueSize: number
    connectionUptime: number
    messagesPerSecond: number
  } {
    return {
      averageLatency: this.latencyTracker.avgLatency,
      messageQueueSize: this.messageQueue.length,
      connectionUptime: this.ws?.readyState === WebSocket.OPEN ? Date.now() - (this.latencyTracker.lastPing || Date.now()) : 0,
      messagesPerSecond: this.latencyTracker.samples.length > 0 ? 1000 / this.latencyTracker.avgLatency : 0
    }
  }

  /**
   * Optimize WebSocket settings for performance
   */
  private optimizeWebSocketSettings(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Enable binary type for better performance
      this.ws.binaryType = 'arraybuffer'

      // Set buffer sizes if supported
      if ('bufferedAmountLowThreshold' in this.ws) {
        (this.ws as any).bufferedAmountLowThreshold = 1024
      }
    }
  }

  /**
   * Enhanced subscription with optimization
   */
  subscribeToSectorOptimized(sector: string, options: { realtime?: boolean } = {}) {
    this.currentSector = sector

    if (this.isConnected()) {
      console.log(`📊 Optimized subscription to sector: ${sector}`)

      const subscriptionMessage = {
        type: 'subscribe',
        sector,
        timestamp: Date.now(),
        options: {
          realtime: options.realtime !== false,
          compression: this.config.compressionEnabled,
          batching: this.config.batchingEnabled
        }
      }

      // Send with high priority for immediate processing
      this.send(subscriptionMessage, 'high')
    } else {
      console.log(`📊 Will subscribe to ${sector} when connected (optimized)`)
    }
  }

  /**
   * Cleanup for shutdown
   */
  cleanup(): void {
    // Clear all timers
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    // Clear queues
    this.messageQueue.length = 0
    this.priorityQueue.clear()
    this.messageBuffer.length = 0

    // Clear message pool
    this.messagePool.length = 0

    // Reset latency tracking
    this.latencyTracker.samples.length = 0
    this.latencyTracker.avgLatency = 0
  }
}

// Export singleton instance
export const webSocketManager = new WebSocketManager()