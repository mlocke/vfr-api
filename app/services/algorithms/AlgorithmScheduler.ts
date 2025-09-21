/**
 * Algorithm Scheduler for Real-Time Stock Selection
 * Manages 30-second refresh cycles and algorithm execution coordination
 */

import { AlgorithmEngine } from './AlgorithmEngine'
import { AlgorithmCache } from './AlgorithmCache'
import { FallbackDataService } from '../financial-data/FallbackDataService'
import {
  AlgorithmConfiguration,
  AlgorithmContext,
  SelectionResult,
  AlgorithmStreamMessage,
  AlgorithmExecution
} from './types'

import { EventEmitter } from 'events'
import { WebSocket } from 'ws'

interface ScheduledExecution {
  algorithmId: string
  nextExecution: number
  isRunning: boolean
  lastExecution?: number
  executionCount: number
  failureCount: number
  averageExecutionTime: number
}

interface MarketContext {
  isMarketOpen: boolean
  marketHours: {
    open: number  // UTC timestamp
    close: number // UTC timestamp
  }
  timezone: string
  volatilityIndex: number
  lastMarketData: number
}

interface SchedulerConfig {
  minRefreshInterval: number    // 30 seconds minimum
  maxConcurrentAlgorithms: number
  executionTimeout: number      // Max execution time before timeout
  retryAttempts: number
  retryDelayMs: number
  marketDataStaleThreshold: number // Max age for market data
  enableAdaptiveScheduling: boolean
  performanceMonitoring: boolean
}

export class AlgorithmScheduler extends EventEmitter {
  private engine: AlgorithmEngine
  private cache: AlgorithmCache
  private fallbackDataService: FallbackDataService
  private config: SchedulerConfig

  private scheduledAlgorithms = new Map<string, ScheduledExecution>()
  private runningExecutions = new Map<string, AlgorithmExecution>()
  private schedulerInterval: NodeJS.Timeout | null = null
  private marketContext: MarketContext
  private websocketClients = new Set<WebSocket>()

  // Performance metrics
  private metrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
    peakConcurrency: 0,
    lastExecutionBatch: 0
  }

  constructor(
    engine: AlgorithmEngine,
    cache: AlgorithmCache,
    fallbackDataService: FallbackDataService,
    config: SchedulerConfig
  ) {
    super()

    this.engine = engine
    this.cache = cache
    this.fallbackDataService = fallbackDataService
    this.config = config

    this.marketContext = {
      isMarketOpen: false,
      marketHours: { open: 0, close: 0 },
      timezone: 'America/New_York',
      volatilityIndex: 0,
      lastMarketData: 0
    }

    this.updateMarketContext()
  }

  /**
   * Start the algorithm scheduler
   */
  start(): void {
    if (this.schedulerInterval) {
      console.warn('Scheduler already running')
      return
    }

    console.log('Starting Algorithm Scheduler...')

    // Main scheduling loop - runs every 5 seconds to check for due executions
    this.schedulerInterval = setInterval(async () => {
      try {
        await this.executeSchedulingCycle()
      } catch (error) {
        console.error('Error in scheduling cycle:', error)
        this.emit('error', error)
      }
    }, 5000)

    // Market context update loop - runs every 30 seconds
    setInterval(async () => {
      await this.updateMarketContext()
    }, 30000)

    this.emit('started')
    console.log('Algorithm Scheduler started')
  }

  /**
   * Stop the algorithm scheduler
   */
  stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval)
      this.schedulerInterval = null
    }

    // Wait for running executions to complete or timeout
    const runningCount = this.runningExecutions.size
    if (runningCount > 0) {
      console.log(`Waiting for ${runningCount} running executions to complete...`)

      setTimeout(() => {
        // Force cancel any still-running executions
        this.runningExecutions.forEach((_, executionId) => {
          this.engine.cancelExecution(executionId)
        })
        this.runningExecutions.clear()
      }, this.config.executionTimeout)
    }

    this.emit('stopped')
    console.log('Algorithm Scheduler stopped')
  }

  /**
   * Schedule algorithm for execution
   */
  async scheduleAlgorithm(algorithmId: string, config: AlgorithmConfiguration): Promise<void> {
    // Validate minimum refresh interval
    const refreshInterval = Math.max(
      config.selection.rebalanceFrequency,
      this.config.minRefreshInterval
    )

    const scheduledExecution: ScheduledExecution = {
      algorithmId,
      nextExecution: Date.now() + refreshInterval * 1000,
      isRunning: false,
      executionCount: 0,
      failureCount: 0,
      averageExecutionTime: 0
    }

    this.scheduledAlgorithms.set(algorithmId, scheduledExecution)

    // Cache the configuration
    await this.cache.setConfiguration(algorithmId, config)

    console.log(`Scheduled algorithm ${config.name} (${algorithmId}) with ${refreshInterval}s refresh interval`)
    this.emit('algorithmScheduled', { algorithmId, config })
  }

  /**
   * Unschedule algorithm
   */
  async unscheduleAlgorithm(algorithmId: string): Promise<void> {
    this.scheduledAlgorithms.delete(algorithmId)

    // Cancel if currently running
    const runningExecution = Array.from(this.runningExecutions.values())
      .find(exec => exec.config.id === algorithmId)

    if (runningExecution) {
      this.engine.cancelExecution(`${algorithmId}_${runningExecution.context.runId}`)
    }

    // Invalidate cache
    await this.cache.invalidateAlgorithm(algorithmId)

    console.log(`Unscheduled algorithm ${algorithmId}`)
    this.emit('algorithmUnscheduled', { algorithmId })
  }

  /**
   * Main scheduling cycle - check for due executions
   */
  private async executeSchedulingCycle(): Promise<void> {
    const now = Date.now()
    const dueAlgorithms: string[] = []

    // Find algorithms due for execution
    this.scheduledAlgorithms.forEach((scheduled, algorithmId) => {
      if (!scheduled.isRunning && now >= scheduled.nextExecution) {
        // Check if we have capacity for more concurrent executions
        if (this.runningExecutions.size < this.config.maxConcurrentAlgorithms) {
          dueAlgorithms.push(algorithmId)
        }
      }
    })

    if (dueAlgorithms.length === 0) return

    // Update market context before executing algorithms
    await this.updateMarketContext()

    // Execute due algorithms
    console.log(`Executing ${dueAlgorithms.length} due algorithms`)
    const executionPromises = dueAlgorithms.map(algorithmId =>
      this.executeAlgorithm(algorithmId)
    )

    // Track peak concurrency
    this.metrics.peakConcurrency = Math.max(
      this.metrics.peakConcurrency,
      this.runningExecutions.size + dueAlgorithms.length
    )

    this.metrics.lastExecutionBatch = Date.now()

    // Execute in parallel but don't wait for completion
    Promise.allSettled(executionPromises).then(results => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Algorithm execution failed for ${dueAlgorithms[index]}:`, result.reason)
        }
      })
    })
  }

  /**
   * Execute a single algorithm
   */
  private async executeAlgorithm(algorithmId: string): Promise<void> {
    const scheduled = this.scheduledAlgorithms.get(algorithmId)
    if (!scheduled) return

    const config = await this.cache.getConfiguration(algorithmId)
    if (!config) {
      console.error(`No configuration found for algorithm ${algorithmId}`)
      return
    }

    // Mark as running
    scheduled.isRunning = true
    scheduled.lastExecution = Date.now()
    scheduled.executionCount++

    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const executionId = `${algorithmId}_${runId}`

    try {
      // Create execution context
      const context: AlgorithmContext = {
        algorithmId,
        runId,
        startTime: Date.now(),
        marketData: {
          timestamp: this.marketContext.lastMarketData,
          marketOpen: this.marketContext.isMarketOpen,
          volatilityIndex: this.marketContext.volatilityIndex,
          sectorRotation: await this.getSectorRotation()
        },
        dataStatus: await this.getDataSourceStatus(),
        currentPositions: await this.getCurrentPositions(algorithmId)
      }

      // Register execution
      const execution: AlgorithmExecution = {
        context,
        config,
        status: 'running'
      }
      this.runningExecutions.set(executionId, execution)

      // Broadcast start event
      this.broadcastMessage({
        type: 'algorithm_start',
        algorithmId,
        timestamp: Date.now(),
        data: { runId, config: { id: config.id, name: config.name, type: config.type } }
      })

      console.log(`Starting algorithm execution: ${config.name} (${runId})`)

      // Execute algorithm with timeout
      const result = await Promise.race([
        this.engine.executeAlgorithm(config, context),
        this.createTimeoutPromise(executionId)
      ])

      // Update metrics
      const executionTime = Date.now() - context.startTime
      scheduled.averageExecutionTime = (
        (scheduled.averageExecutionTime * (scheduled.executionCount - 1)) + executionTime
      ) / scheduled.executionCount

      this.metrics.totalExecutions++
      this.metrics.successfulExecutions++
      this.metrics.averageExecutionTime = (
        (this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1)) + executionTime
      ) / this.metrics.totalExecutions

      // Broadcast result
      this.broadcastMessage({
        type: 'selection_update',
        algorithmId,
        timestamp: Date.now(),
        data: {
          runId,
          selectionCount: result.selections.length,
          executionTime: result.executionTime,
          quality: result.quality
        }
      })

      // Store result in database (implementation-specific)
      await this.storeExecutionResult(algorithmId, execution, result)

      console.log(`Algorithm execution completed: ${config.name} (${runId}) - ${result.selections.length} selections in ${executionTime}ms`)

      // Schedule next execution
      this.scheduleNextExecution(algorithmId, config, executionTime)

    } catch (error) {
      console.error(`Algorithm execution failed: ${algorithmId}`, error)

      scheduled.failureCount++
      this.metrics.totalExecutions++
      this.metrics.failedExecutions++

      // Broadcast error
      this.broadcastMessage({
        type: 'error',
        algorithmId,
        timestamp: Date.now(),
        data: {
          runId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })

      // Handle retry logic
      await this.handleExecutionFailure(algorithmId, scheduled, error)

    } finally {
      // Clean up
      scheduled.isRunning = false
      this.runningExecutions.delete(executionId)
    }
  }

  /**
   * Schedule next execution with adaptive scheduling
   */
  private scheduleNextExecution(
    algorithmId: string,
    config: AlgorithmConfiguration,
    lastExecutionTime: number
  ): void {
    const scheduled = this.scheduledAlgorithms.get(algorithmId)
    if (!scheduled) return

    let nextInterval = config.selection.rebalanceFrequency

    if (this.config.enableAdaptiveScheduling) {
      // Adaptive scheduling based on execution time and market conditions
      const baseInterval = config.selection.rebalanceFrequency

      // Increase interval if execution is taking too long
      if (lastExecutionTime > 10000) { // 10 seconds
        nextInterval = Math.min(baseInterval * 1.5, baseInterval * 2)
      }

      // Decrease interval during high volatility periods
      if (this.marketContext.volatilityIndex > 0.8) {
        nextInterval = Math.max(baseInterval * 0.8, this.config.minRefreshInterval)
      }

      // Increase interval during market close
      if (!this.marketContext.isMarketOpen) {
        nextInterval = Math.max(baseInterval * 2, 300) // At least 5 minutes when closed
      }
    }

    // Ensure minimum interval is respected
    nextInterval = Math.max(nextInterval, this.config.minRefreshInterval)

    scheduled.nextExecution = Date.now() + (nextInterval * 1000)

    console.log(`Next execution for ${algorithmId} scheduled in ${nextInterval} seconds`)
  }

  /**
   * Handle execution failures with retry logic
   */
  private async handleExecutionFailure(
    algorithmId: string,
    scheduled: ScheduledExecution,
    error: any
  ): Promise<void> {
    if (scheduled.failureCount <= this.config.retryAttempts) {
      // Schedule retry with exponential backoff
      const retryDelay = this.config.retryDelayMs * Math.pow(2, scheduled.failureCount - 1)
      scheduled.nextExecution = Date.now() + retryDelay

      console.log(`Scheduling retry for ${algorithmId} in ${retryDelay}ms (attempt ${scheduled.failureCount})`)
    } else {
      // Too many failures - disable algorithm temporarily
      const config = await this.cache.getConfiguration(algorithmId)
      if (config) {
        console.error(`Algorithm ${config.name} disabled due to repeated failures`)

        // Schedule next attempt in longer interval
        scheduled.nextExecution = Date.now() + (300 * 1000) // 5 minutes
        scheduled.failureCount = 0 // Reset failure count
      }
    }
  }

  /**
   * Update market context information
   */
  private async updateMarketContext(): Promise<void> {
    try {
      // Update market hours and open status
      const now = new Date()
      const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))

      const marketOpen = new Date(nyTime)
      marketOpen.setHours(9, 30, 0, 0) // 9:30 AM EST

      const marketClose = new Date(nyTime)
      marketClose.setHours(16, 0, 0, 0) // 4:00 PM EST

      const isWeekday = nyTime.getDay() >= 1 && nyTime.getDay() <= 5
      const isDuringHours = nyTime >= marketOpen && nyTime <= marketClose

      this.marketContext.isMarketOpen = isWeekday && isDuringHours
      this.marketContext.marketHours = {
        open: marketOpen.getTime(),
        close: marketClose.getTime()
      }

      // Update volatility index (would fetch from real source)
      this.marketContext.volatilityIndex = await this.fetchVolatilityIndex()

      // Update last market data timestamp
      this.marketContext.lastMarketData = Date.now()

    } catch (error) {
      console.error('Error updating market context:', error)
    }
  }

  /**
   * Create timeout promise for execution
   */
  private createTimeoutPromise(executionId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Algorithm execution timeout: ${executionId}`))
      }, this.config.executionTimeout)
    })
  }

  /**
   * Store execution result in database
   */
  private async storeExecutionResult(
    algorithmId: string,
    execution: AlgorithmExecution,
    result: SelectionResult
  ): Promise<void> {
    try {
      // Store in cache
      await this.cache.setSelectionResult(algorithmId, result)

      // Store in database (implementation would depend on your database choice)
      // This is where you'd insert into algorithm_executions, selection_results, etc.

      console.log(`Stored execution result for algorithm ${algorithmId}`)
    } catch (error) {
      console.error('Error storing execution result:', error)
    }
  }

  /**
   * WebSocket connection management
   */
  addWebSocketClient(ws: WebSocket): void {
    this.websocketClients.add(ws)

    ws.on('close', () => {
      this.websocketClients.delete(ws)
    })

    // Send current status
    ws.send(JSON.stringify({
      type: 'status',
      data: {
        scheduledAlgorithms: Array.from(this.scheduledAlgorithms.keys()),
        runningExecutions: this.runningExecutions.size,
        marketContext: this.marketContext,
        metrics: this.metrics
      }
    }))
  }

  /**
   * Broadcast message to all WebSocket clients
   */
  private broadcastMessage(message: AlgorithmStreamMessage): void {
    const messageStr = JSON.stringify(message)

    this.websocketClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr)
        } catch (error) {
          console.error('Error sending WebSocket message:', error)
          this.websocketClients.delete(client)
        }
      }
    })

    // Emit as event for internal listeners
    this.emit('message', message)
  }

  // ==================== UTILITY METHODS ====================

  private async getSectorRotation(): Promise<{ [sector: string]: number }> {
    // Calculate sector rotation scores (implementation-specific)
    return {
      'Technology': 0.2,
      'Healthcare': 0.1,
      'Finance': -0.1,
      'Energy': -0.2,
      'Consumer': 0.0
    }
  }

  private async getDataSourceStatus(): Promise<any> {
    // Get status of data sources from FallbackDataService
    const healthy = await this.fallbackDataService.healthCheck()
    return {
      healthy,
      serviceName: this.fallbackDataService.name,
      lastCheck: Date.now()
    }
  }

  private async getCurrentPositions(algorithmId: string): Promise<any> {
    // Get current positions for rebalancing algorithms
    // This would query your portfolio management system
    return {}
  }

  private async fetchVolatilityIndex(): Promise<number> {
    // Fetch VIX or calculate market volatility
    // For demonstration, return a mock value
    return 0.3 + Math.random() * 0.4 // 0.3 to 0.7
  }

  // ==================== PUBLIC API METHODS ====================

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.schedulerInterval !== null,
      scheduledAlgorithms: Array.from(this.scheduledAlgorithms.entries()).map(([id, scheduled]) => ({
        algorithmId: id,
        nextExecution: scheduled.nextExecution,
        isRunning: scheduled.isRunning,
        executionCount: scheduled.executionCount,
        failureCount: scheduled.failureCount,
        averageExecutionTime: scheduled.averageExecutionTime
      })),
      runningExecutions: this.runningExecutions.size,
      marketContext: this.marketContext,
      metrics: this.metrics,
      websocketClients: this.websocketClients.size
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalExecutions > 0
        ? this.metrics.successfulExecutions / this.metrics.totalExecutions
        : 0,
      uptime: this.schedulerInterval ? Date.now() - this.metrics.lastExecutionBatch : 0
    }
  }

  /**
   * Force execute algorithm (for testing/debugging)
   */
  async forceExecuteAlgorithm(algorithmId: string): Promise<void> {
    const scheduled = this.scheduledAlgorithms.get(algorithmId)
    if (!scheduled) {
      throw new Error(`Algorithm ${algorithmId} not scheduled`)
    }

    if (scheduled.isRunning) {
      throw new Error(`Algorithm ${algorithmId} is already running`)
    }

    // Override next execution time
    scheduled.nextExecution = Date.now()

    console.log(`Force executing algorithm ${algorithmId}`)
  }

  /**
   * Pause/resume algorithm scheduling
   */
  pauseAlgorithm(algorithmId: string): void {
    const scheduled = this.scheduledAlgorithms.get(algorithmId)
    if (scheduled) {
      scheduled.nextExecution = Number.MAX_SAFE_INTEGER // Far future
      console.log(`Paused algorithm ${algorithmId}`)
    }
  }

  resumeAlgorithm(algorithmId: string, config?: AlgorithmConfiguration): void {
    const scheduled = this.scheduledAlgorithms.get(algorithmId)
    if (scheduled) {
      const interval = config?.selection.rebalanceFrequency || this.config.minRefreshInterval
      scheduled.nextExecution = Date.now() + (interval * 1000)
      console.log(`Resumed algorithm ${algorithmId}`)
    }
  }

  /**
   * Get algorithm execution history
   */
  async getExecutionHistory(algorithmId: string, limit: number = 10): Promise<SelectionResult[]> {
    return this.cache.getRecentSelectionResults(algorithmId, limit)
  }
}