/**
 * Real-Time Manager for Stock Selection
 * Manages WebSocket subscriptions, real-time data streaming, and live updates
 * Integrates with existing WebSocket infrastructure and selection services
 */

import { EventEmitter } from 'events'
import {
  SelectionRequest,
  SelectionResponse,
  EnhancedStockResult,
  SelectionMode
} from './types'
import { WebSocketManager } from '../websocket/WebSocketManager'
import { DataFlowManager } from './DataFlowManager'
import { StockSelectionService } from './StockSelectionService'
import { RedisCache } from '../cache/RedisCache'
import { SectorOption } from '../../components/SectorDropdown'

interface RealTimeConfig {
  updateInterval: number // Milliseconds between updates
  maxSubscriptions: number // Maximum concurrent subscriptions
  enableBatching: boolean // Batch updates for efficiency
  batchSize: number // Size of update batches
  enableAdaptiveRates: boolean // Adjust update rates based on activity
  priorityLevels: {
    high: string[] // High priority symbols/sectors
    medium: string[] // Medium priority symbols/sectors
    low: string[] // Low priority symbols/sectors
  }
}

interface SubscriptionOptions {
  symbols?: string[]
  sector?: SectorOption
  updateFrequency?: 'realtime' | 'fast' | 'normal' | 'slow'
  includeMarketData?: boolean
  includeSentiment?: boolean
  includeNews?: boolean
  priority?: 'high' | 'medium' | 'low'
}

interface Subscription {
  id: string
  clientId: string
  type: 'stocks' | 'sector' | 'portfolio'
  symbols: string[]
  sector?: SectorOption
  options: SubscriptionOptions
  lastUpdate: number
  updateCount: number
  isActive: boolean
  webSocketConnection?: any
}

interface RealTimeUpdate {
  subscriptionId: string
  type: 'price_update' | 'selection_update' | 'market_update' | 'news_update'
  data: any
  timestamp: number
  symbols: string[]
}

interface MarketDataSnapshot {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: number
  source: string
}

interface LiveSelectionResult {
  symbol: string
  currentScore: number
  previousScore?: number
  trend: 'up' | 'down' | 'stable'
  confidence: number
  lastUpdated: number
  factors: {
    [factor: string]: {
      value: number
      change: number
      impact: 'positive' | 'negative' | 'neutral'
    }
  }
}

/**
 * Real-Time Manager
 * Handles live data streaming and real-time selection updates
 */
export class RealTimeManager extends EventEmitter {
  private config: RealTimeConfig
  private subscriptions: Map<string, Subscription> = new Map()
  private clientSubscriptions: Map<string, Set<string>> = new Map()
  private webSocketManager: WebSocketManager
  private dataFlowManager: DataFlowManager
  private stockSelectionService: StockSelectionService
  private cache: RedisCache
  private updateTimers: Map<string, NodeJS.Timeout> = new Map()
  private marketDataCache: Map<string, MarketDataSnapshot> = new Map()
  private selectionResultsCache: Map<string, LiveSelectionResult> = new Map()
  private isRunning: boolean = false

  constructor(
    webSocketManager: WebSocketManager,
    dataFlowManager: DataFlowManager,
    stockSelectionService: StockSelectionService,
    cache: RedisCache,
    config?: Partial<RealTimeConfig>
  ) {
    super()

    this.webSocketManager = webSocketManager
    this.dataFlowManager = dataFlowManager
    this.stockSelectionService = stockSelectionService
    this.cache = cache

    this.config = {
      updateInterval: 5000, // 5 seconds default
      maxSubscriptions: 100,
      enableBatching: true,
      batchSize: 10,
      enableAdaptiveRates: true,
      priorityLevels: {
        high: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
        medium: [],
        low: []
      },
      ...config
    }

    this.setupWebSocketHandlers()
    this.setupDataFlowHandlers()
  }

  /**
   * Start the real-time manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 Real-time manager already running')
      return
    }

    try {
      console.log('🚀 Starting Real-Time Manager...')

      // Connect to WebSocket
      await this.webSocketManager.connect()

      // Start update loop
      this.startUpdateLoop()

      // Set up cleanup intervals
      this.setupCleanupIntervals()

      this.isRunning = true
      this.emit('manager_started')

      console.log('✅ Real-Time Manager started successfully')
    } catch (error) {
      console.error('❌ Failed to start Real-Time Manager:', error)
      throw error
    }
  }

  /**
   * Stop the real-time manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    console.log('🛑 Stopping Real-Time Manager...')

    // Stop all timers
    for (const timer of this.updateTimers.values()) {
      clearTimeout(timer)
    }
    this.updateTimers.clear()

    // Close all subscriptions
    for (const subscription of this.subscriptions.values()) {
      await this.unsubscribe(subscription.id)
    }

    // Disconnect WebSocket
    this.webSocketManager.disconnect()

    this.isRunning = false
    this.emit('manager_stopped')

    console.log('✅ Real-Time Manager stopped')
  }

  /**
   * Create a new subscription
   */
  async subscribe(
    clientId: string,
    options: SubscriptionOptions
  ): Promise<string> {
    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      throw new Error('Maximum subscription limit reached')
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Determine subscription type and symbols
    let type: 'stocks' | 'sector' | 'portfolio' = 'stocks'
    let symbols: string[] = []

    if (options.symbols && options.symbols.length > 0) {
      type = options.symbols.length === 1 ? 'stocks' : 'portfolio'
      symbols = options.symbols
    } else if (options.sector) {
      type = 'sector'
      // Get sector stocks (this would be implemented based on your sector logic)
      symbols = await this.getSectorSymbols(options.sector)
    } else {
      throw new Error('Subscription requires either symbols or sector')
    }

    const subscription: Subscription = {
      id: subscriptionId,
      clientId,
      type,
      symbols,
      sector: options.sector,
      options,
      lastUpdate: 0,
      updateCount: 0,
      isActive: true
    }

    // Store subscription
    this.subscriptions.set(subscriptionId, subscription)

    // Track client subscriptions
    if (!this.clientSubscriptions.has(clientId)) {
      this.clientSubscriptions.set(clientId, new Set())
    }
    this.clientSubscriptions.get(clientId)!.add(subscriptionId)

    // Subscribe to WebSocket updates for symbols
    for (const symbol of symbols) {
      this.webSocketManager.subscribeToSector(symbol) // Adapt based on your WebSocket API
    }

    // Schedule initial update
    await this.scheduleUpdate(subscription)

    this.emit('subscription_created', { subscriptionId, clientId, symbols })

    console.log(`📡 Created subscription ${subscriptionId} for client ${clientId} (${symbols.length} symbols)`)

    return subscriptionId
  }

  /**
   * Remove a subscription
   */
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      return false
    }

    // Cancel timer
    const timer = this.updateTimers.get(subscriptionId)
    if (timer) {
      clearTimeout(timer)
      this.updateTimers.delete(subscriptionId)
    }

    // Remove from client tracking
    const clientSubs = this.clientSubscriptions.get(subscription.clientId)
    if (clientSubs) {
      clientSubs.delete(subscriptionId)
      if (clientSubs.size === 0) {
        this.clientSubscriptions.delete(subscription.clientId)
      }
    }

    // Remove subscription
    this.subscriptions.delete(subscriptionId)

    this.emit('subscription_removed', { subscriptionId, clientId: subscription.clientId })

    console.log(`📡 Removed subscription ${subscriptionId}`)

    return true
  }

  /**
   * Get all subscriptions for a client
   */
  getClientSubscriptions(clientId: string): Subscription[] {
    const subscriptionIds = this.clientSubscriptions.get(clientId)
    if (!subscriptionIds) {
      return []
    }

    return Array.from(subscriptionIds)
      .map(id => this.subscriptions.get(id))
      .filter(sub => sub !== undefined) as Subscription[]
  }

  /**
   * Update subscription options
   */
  async updateSubscription(
    subscriptionId: string,
    options: Partial<SubscriptionOptions>
  ): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      return false
    }

    // Update options
    subscription.options = { ...subscription.options, ...options }

    // Reschedule updates if frequency changed
    if (options.updateFrequency) {
      await this.scheduleUpdate(subscription)
    }

    this.emit('subscription_updated', { subscriptionId, options })

    return true
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(subscriptionId: string): any {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      return null
    }

    return {
      id: subscription.id,
      clientId: subscription.clientId,
      type: subscription.type,
      symbols: subscription.symbols,
      isActive: subscription.isActive,
      lastUpdate: subscription.lastUpdate,
      updateCount: subscription.updateCount,
      options: subscription.options
    }
  }

  /**
   * Get manager statistics
   */
  getStatistics(): any {
    return {
      isRunning: this.isRunning,
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(s => s.isActive).length,
      totalClients: this.clientSubscriptions.size,
      cachedMarketData: this.marketDataCache.size,
      cachedSelectionResults: this.selectionResultsCache.size,
      updateTimers: this.updateTimers.size,
      config: this.config
    }
  }

  /**
   * Private methods
   */

  private setupWebSocketHandlers(): void {
    this.webSocketManager.onMessage((message) => {
      this.handleWebSocketMessage(message)
    })

    this.webSocketManager.onConnection((connected) => {
      if (!connected) {
        console.warn('⚠️ WebSocket disconnected, pausing real-time updates')
        this.pauseAllUpdates()
      } else {
        console.log('✅ WebSocket reconnected, resuming real-time updates')
        this.resumeAllUpdates()
      }
    })

    this.webSocketManager.onError((error) => {
      console.error('❌ WebSocket error in RealTimeManager:', error)
      this.emit('websocket_error', { error })
    })
  }

  private setupDataFlowHandlers(): void {
    this.dataFlowManager.on('pipeline_complete', (event) => {
      this.handleDataFlowUpdate(event)
    })

    this.dataFlowManager.on('pipeline_error', (event) => {
      console.error('❌ Data flow error:', event)
    })
  }

  private async handleWebSocketMessage(message: any): Promise<void> {
    try {
      if (message.type === 'stocks_update') {
        await this.processMarketDataUpdate(message)
      } else if (message.type === 'sector_change') {
        await this.processSectorUpdate(message)
      }
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error)
    }
  }

  private async handleDataFlowUpdate(event: any): Promise<void> {
    // Update selection results when data flow completes
    for (const symbol of event.symbols || []) {
      // This would trigger selection re-calculation for affected subscriptions
      await this.updateSelectionResult(symbol)
    }
  }

  private async processMarketDataUpdate(message: any): Promise<void> {
    if (!message.symbols || !Array.isArray(message.symbols)) {
      return
    }

    for (const symbolData of message.symbols) {
      const snapshot: MarketDataSnapshot = {
        symbol: symbolData.symbol,
        price: symbolData.price,
        change: symbolData.change,
        changePercent: symbolData.changePercent,
        volume: symbolData.volume,
        timestamp: Date.now(),
        source: 'websocket'
      }

      this.marketDataCache.set(symbolData.symbol, snapshot)

      // Trigger updates for subscriptions watching this symbol
      await this.triggerSymbolUpdates(symbolData.symbol, snapshot)
    }
  }

  private async processSectorUpdate(message: any): Promise<void> {
    if (!message.sector) {
      return
    }

    // Trigger updates for sector subscriptions
    for (const subscription of this.subscriptions.values()) {
      if (subscription.type === 'sector' && subscription.sector?.id === message.sector) {
        await this.sendSubscriptionUpdate(subscription, {
          type: 'market_update',
          data: message,
          timestamp: Date.now()
        })
      }
    }
  }

  private async triggerSymbolUpdates(symbol: string, snapshot: MarketDataSnapshot): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.symbols.includes(symbol) && subscription.isActive) {
        await this.sendSubscriptionUpdate(subscription, {
          type: 'price_update',
          data: snapshot,
          timestamp: Date.now()
        })
      }
    }
  }

  private async scheduleUpdate(subscription: Subscription): Promise<void> {
    // Cancel existing timer
    const existingTimer = this.updateTimers.get(subscription.id)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Calculate update interval based on frequency and priority
    const interval = this.calculateUpdateInterval(subscription)

    // Schedule next update
    const timer = setTimeout(async () => {
      if (subscription.isActive) {
        await this.performSubscriptionUpdate(subscription)
        await this.scheduleUpdate(subscription) // Reschedule
      }
    }, interval)

    this.updateTimers.set(subscription.id, timer)
  }

  private calculateUpdateInterval(subscription: Subscription): number {
    let baseInterval = this.config.updateInterval

    // Adjust based on frequency setting
    switch (subscription.options.updateFrequency) {
      case 'realtime':
        baseInterval = 1000 // 1 second
        break
      case 'fast':
        baseInterval = 5000 // 5 seconds
        break
      case 'normal':
        baseInterval = 15000 // 15 seconds
        break
      case 'slow':
        baseInterval = 60000 // 1 minute
        break
    }

    // Adjust based on priority
    if (subscription.options.priority === 'high') {
      baseInterval *= 0.5
    } else if (subscription.options.priority === 'low') {
      baseInterval *= 2
    }

    // Adaptive rates based on symbol priority
    const hasHighPrioritySymbols = subscription.symbols.some(symbol =>
      this.config.priorityLevels.high.includes(symbol)
    )

    if (hasHighPrioritySymbols) {
      baseInterval *= 0.7
    }

    return Math.max(1000, baseInterval) // Minimum 1 second
  }

  private async performSubscriptionUpdate(subscription: Subscription): Promise<void> {
    try {
      let updateData: any = null

      switch (subscription.type) {
        case 'stocks':
        case 'portfolio':
          updateData = await this.generateStockUpdate(subscription)
          break
        case 'sector':
          updateData = await this.generateSectorUpdate(subscription)
          break
      }

      if (updateData) {
        await this.sendSubscriptionUpdate(subscription, {
          type: 'selection_update',
          data: updateData,
          timestamp: Date.now()
        })

        subscription.lastUpdate = Date.now()
        subscription.updateCount++
      }

    } catch (error) {
      console.error(`❌ Update failed for subscription ${subscription.id}:`, error)
    }
  }

  private async generateStockUpdate(subscription: Subscription): Promise<any> {
    const results: LiveSelectionResult[] = []

    for (const symbol of subscription.symbols) {
      // Get latest market data
      const marketData = this.marketDataCache.get(symbol)
      if (!marketData) continue

      // Get or calculate selection result
      let selectionResult = this.selectionResultsCache.get(symbol)
      if (!selectionResult || Date.now() - selectionResult.lastUpdated > 30000) {
        selectionResult = await this.updateSelectionResult(symbol)
      }

      if (selectionResult) {
        results.push(selectionResult)
      }
    }

    return {
      symbols: subscription.symbols,
      results,
      marketData: subscription.symbols.map(symbol => this.marketDataCache.get(symbol)).filter(Boolean),
      timestamp: Date.now()
    }
  }

  private async generateSectorUpdate(subscription: Subscription): Promise<any> {
    if (!subscription.sector) {
      return null
    }

    // This would generate sector-specific updates
    return {
      sector: subscription.sector,
      topStocks: subscription.symbols.slice(0, 10),
      sectorMetrics: {
        avgChange: Math.random() * 4 - 2,
        momentum: Math.random() * 2 - 1,
        volume: Math.random() * 1000000000
      },
      timestamp: Date.now()
    }
  }

  private async updateSelectionResult(symbol: string): Promise<LiveSelectionResult | null> {
    try {
      // This would use the StockSelectionService to get updated scores
      // For now, we'll simulate the result
      const previousResult = this.selectionResultsCache.get(symbol)
      const currentScore = 0.3 + Math.random() * 0.7

      const result: LiveSelectionResult = {
        symbol,
        currentScore,
        previousScore: previousResult?.currentScore,
        trend: previousResult ?
          (currentScore > previousResult.currentScore ? 'up' :
           currentScore < previousResult.currentScore ? 'down' : 'stable') : 'stable',
        confidence: Math.random(),
        lastUpdated: Date.now(),
        factors: {
          technical: {
            value: Math.random(),
            change: Math.random() * 0.2 - 0.1,
            impact: Math.random() > 0.5 ? 'positive' : 'negative'
          },
          fundamental: {
            value: Math.random(),
            change: Math.random() * 0.2 - 0.1,
            impact: Math.random() > 0.5 ? 'positive' : 'negative'
          }
        }
      }

      this.selectionResultsCache.set(symbol, result)
      return result

    } catch (error) {
      console.error(`❌ Failed to update selection result for ${symbol}:`, error)
      return null
    }
  }

  private async sendSubscriptionUpdate(subscription: Subscription, update: RealTimeUpdate): Promise<void> {
    update.subscriptionId = subscription.id
    update.symbols = subscription.symbols

    // Emit update event
    this.emit('subscription_update', {
      subscription,
      update
    })

    // Send via WebSocket if connected
    if (this.webSocketManager.isConnected()) {
      // This would send to the specific client WebSocket connection
      // Implementation depends on your WebSocket architecture
      console.log(`📡 Sending update to subscription ${subscription.id}:`, {
        type: update.type,
        symbolCount: update.symbols.length
      })
    }
  }

  private async getSectorSymbols(sector: SectorOption): Promise<string[]> {
    // This would integrate with your sector logic
    // For now, return some sample symbols
    return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'].slice(0, Math.floor(Math.random() * 5) + 1)
  }

  private startUpdateLoop(): void {
    // This could implement a global update loop if needed
    console.log('🔄 Starting real-time update loop')
  }

  private pauseAllUpdates(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.isActive = false
    }
  }

  private resumeAllUpdates(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.isActive = true
      this.scheduleUpdate(subscription)
    }
  }

  private setupCleanupIntervals(): void {
    // Clean up old market data every 5 minutes
    setInterval(() => {
      const now = Date.now()
      const maxAge = 10 * 60 * 1000 // 10 minutes

      for (const [symbol, snapshot] of this.marketDataCache.entries()) {
        if (now - snapshot.timestamp > maxAge) {
          this.marketDataCache.delete(symbol)
        }
      }
    }, 5 * 60 * 1000)

    // Clean up old selection results every minute
    setInterval(() => {
      const now = Date.now()
      const maxAge = 5 * 60 * 1000 // 5 minutes

      for (const [symbol, result] of this.selectionResultsCache.entries()) {
        if (now - result.lastUpdated > maxAge) {
          this.selectionResultsCache.delete(symbol)
        }
      }
    }, 60 * 1000)
  }
}

export default RealTimeManager