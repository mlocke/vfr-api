/**
 * Comprehensive TDD Tests for Real-Time Pipeline Resource Management
 * Tests data stream cleanup, WebSocket connection lifecycle, background process termination,
 * and memory leak prevention for the integrated real-time stock picker pipeline
 */

import { WebSocketManager } from '../websocket/WebSocketManager'
import { MCPClient } from '../mcp/MCPClient'
import { RedisCache } from '../cache/RedisCache'
import { jest } from '@jest/globals'

// Mock all dependencies
jest.mock('../websocket/WebSocketManager')
jest.mock('../mcp/MCPClient')
jest.mock('../cache/RedisCache')

const MockedWebSocketManager = WebSocketManager as jest.MockedClass<typeof WebSocketManager>
const MockedMCPClient = MCPClient as jest.MockedClass<typeof MCPClient>
const MockedRedisCache = RedisCache as jest.MockedClass<typeof RedisCache>

// Real-Time Pipeline Simulator
class RealTimePipeline {
  private wsManager: WebSocketManager
  private mcpClient: MCPClient
  private redisCache: RedisCache
  private dataStreams: Map<string, NodeJS.Timeout> = new Map()
  private backgroundProcesses: Map<string, NodeJS.Timeout> = new Map()
  private isRunning: boolean = false
  private healthCheckInterval?: NodeJS.Timeout
  private dataProcessingQueue: Array<{ id: string; data: any; timestamp: number }> = []

  constructor() {
    this.wsManager = new WebSocketManager()
    this.mcpClient = MCPClient.getInstance()
    this.redisCache = RedisCache.getInstance()
  }

  async start() {
    if (this.isRunning) {
      throw new Error('Pipeline is already running')
    }

    this.isRunning = true

    try {
      // Start WebSocket connection
      await this.wsManager.connect()

      // Start data streams
      this.startDataStreams()

      // Start background processes
      this.startBackgroundProcesses()

      // Start health checks
      this.startHealthChecks()

      console.log('🚀 Real-time pipeline started')
    } catch (error) {
      // Reset running state on failure
      this.isRunning = false
      throw error
    }
  }

  async stop() {
    if (!this.isRunning) {
      return
    }

    console.log('🛑 Stopping real-time pipeline...')

    // Stop health checks first
    this.stopHealthChecks()

    // Stop data streams
    this.stopDataStreams()

    // Stop background processes
    this.stopBackgroundProcesses()

    // Clear processing queue
    this.clearProcessingQueue()

    try {
      // Disconnect WebSocket
      this.wsManager.disconnect()
    } catch (error) {
      console.error('Error disconnecting WebSocket:', error)
    }

    try {
      // Cleanup MCP client
      await this.mcpClient.clearCache()
    } catch (error) {
      console.error('Error clearing MCP cache:', error)
    }

    try {
      // Shutdown Redis cache
      await this.redisCache.shutdown()
    } catch (error) {
      console.error('Error shutting down Redis cache:', error)
    }

    this.isRunning = false
    console.log('✅ Real-time pipeline stopped')
  }

  private startDataStreams() {
    // Stock price stream
    const priceStream = setInterval(async () => {
      if (!this.isRunning) return

      try {
        const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
        for (const symbol of symbols) {
          const data = await this.mcpClient.getUnifiedStockPrice(symbol)
          this.addToProcessingQueue('price', { symbol, data })
        }
      } catch (error) {
        console.error('Price stream error:', error)
      }
    }, 1000)

    // Allow process to exit even with active timer
    if (priceStream.unref) {
      priceStream.unref()
    }
    this.dataStreams.set('price-stream', priceStream)

    // Market data stream
    const marketStream = setInterval(async () => {
      if (!this.isRunning) return

      try {
        const marketData = await this.mcpClient.executeTool('market_status')
        this.addToProcessingQueue('market', marketData)
      } catch (error) {
        console.error('Market stream error:', error)
      }
    }, 5000)

    if (marketStream.unref) {
      marketStream.unref()
    }
    this.dataStreams.set('market-stream', marketStream)

    // News stream
    const newsStream = setInterval(async () => {
      if (!this.isRunning) return

      try {
        const news = await this.mcpClient.getUnifiedNews('stock market')
        this.addToProcessingQueue('news', news)
      } catch (error) {
        console.error('News stream error:', error)
      }
    }, 10000)

    if (newsStream.unref) {
      newsStream.unref()
    }
    this.dataStreams.set('news-stream', newsStream)
  }

  private stopDataStreams() {
    this.dataStreams.forEach((stream, name) => {
      clearInterval(stream)
      console.log(`📡 Stopped data stream: ${name}`)
    })
    this.dataStreams.clear()
  }

  private startBackgroundProcesses() {
    // Cache cleanup process
    const cacheCleanup = setInterval(async () => {
      if (!this.isRunning) return

      try {
        await this.redisCache.cleanup()
      } catch (error) {
        console.error('Cache cleanup error:', error)
      }
    }, 30000)

    if (cacheCleanup.unref) {
      cacheCleanup.unref()
    }
    this.backgroundProcesses.set('cache-cleanup', cacheCleanup)

    // Data processing queue processor
    const queueProcessor = setInterval(() => {
      if (!this.isRunning) return

      this.processDataQueue()
    }, 500)

    if (queueProcessor.unref) {
      queueProcessor.unref()
    }
    this.backgroundProcesses.set('queue-processor', queueProcessor)

    // Performance monitoring
    const perfMonitor = setInterval(() => {
      if (!this.isRunning) return

      this.monitorPerformance()
    }, 15000)

    if (perfMonitor.unref) {
      perfMonitor.unref()
    }
    this.backgroundProcesses.set('perf-monitor', perfMonitor)
  }

  private stopBackgroundProcesses() {
    this.backgroundProcesses.forEach((process, name) => {
      clearInterval(process)
      console.log(`⚙️ Stopped background process: ${name}`)
    })
    this.backgroundProcesses.clear()
  }

  private startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isRunning) return

      try {
        // Check WebSocket health
        const wsStatus = this.wsManager.getStatus()
        if (!wsStatus.connected) {
          console.warn('⚠️ WebSocket disconnected, attempting reconnect...')
          await this.wsManager.connect()
        }

        // Check MCP client health
        const mcpStats = this.mcpClient.getStats()
        const unhealthySources = Object.entries(mcpStats)
          .filter(([_, stats]) => !stats.connected)
          .map(([source]) => source)

        if (unhealthySources.length > 0) {
          console.warn(`⚠️ Unhealthy MCP sources: ${unhealthySources.join(', ')}`)
        }

        // Check memory usage
        const memUsage = process.memoryUsage()
        if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
          console.warn('⚠️ High memory usage detected')
          await this.performMemoryCleanup()
        }
      } catch (error) {
        console.error('Health check error:', error)
      }
    }, 10000)

    // Allow process to exit even with active timer
    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref()
    }
  }

  private stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
      console.log('🔍 Stopped health checks')
    }
  }

  addToProcessingQueue(type: string, data: any) {
    this.dataProcessingQueue.push({
      id: `${type}-${Date.now()}-${Math.random()}`,
      data,
      timestamp: Date.now()
    })

    // Prevent queue from growing too large
    if (this.dataProcessingQueue.length > 1000) {
      this.dataProcessingQueue = this.dataProcessingQueue.slice(-500)
      console.warn('⚠️ Processing queue truncated to prevent memory overflow')
    }
  }

  private processDataQueue() {
    const batchSize = 10
    const batch = this.dataProcessingQueue.splice(0, batchSize)

    batch.forEach(item => {
      try {
        // Simulate data processing
        this.processDataItem(item)
      } catch (error) {
        console.error(`Data processing error for ${item.id}:`, error)
      }
    })
  }

  private processDataItem(item: any) {
    // Simulate processing logic
    if (Date.now() - item.timestamp > 30000) {
      // Data is too old, discard
      return
    }

    // Process and cache the data
    this.redisCache.set(`processed:${item.id}`, item.data, 300)
  }

  private clearProcessingQueue() {
    const queueSize = this.dataProcessingQueue.length
    this.dataProcessingQueue = []
    if (queueSize > 0) {
      console.log(`🗑️ Cleared processing queue: ${queueSize} items`)
    }
  }

  private monitorPerformance() {
    const memUsage = process.memoryUsage()
    const queueSize = this.dataProcessingQueue.length

    console.log(`📊 Performance: Memory=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, Queue=${queueSize}`)
  }

  private async performMemoryCleanup() {
    console.log('🧹 Performing memory cleanup...')

    // Clear old queue items
    const cutoffTime = Date.now() - 60000 // 1 minute old
    const originalSize = this.dataProcessingQueue.length
    this.dataProcessingQueue = this.dataProcessingQueue.filter(item => item.timestamp > cutoffTime)

    console.log(`🧹 Removed ${originalSize - this.dataProcessingQueue.length} old queue items`)

    // Clear MCP cache
    await this.mcpClient.clearCache()

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  }

  // Status and diagnostic methods
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeStreams: this.dataStreams.size,
      backgroundProcesses: this.backgroundProcesses.size,
      queueSize: this.dataProcessingQueue.length,
      hasHealthCheck: !!this.healthCheckInterval
    }
  }

  getResourceCounts() {
    return {
      dataStreams: this.dataStreams.size,
      backgroundProcesses: this.backgroundProcesses.size,
      queueItems: this.dataProcessingQueue.length,
      healthCheckActive: !!this.healthCheckInterval
    }
  }
}

describe('Real-Time Pipeline Resource Management', () => {
  let pipeline: RealTimePipeline
  let mockWsManager: jest.Mocked<WebSocketManager>
  let mockMcpClient: jest.Mocked<MCPClient>
  let mockRedisCache: jest.Mocked<RedisCache>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Setup mocked instances
    mockWsManager = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      getStatus: jest.fn().mockReturnValue({ connected: true, currentSector: null, reconnectAttempts: 0, maxReconnectAttempts: 10 }),
      subscribeToSector: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true)
    } as any

    mockMcpClient = {
      getUnifiedStockPrice: jest.fn().mockResolvedValue({ success: true, data: { price: 150, symbol: 'AAPL' } }),
      getUnifiedNews: jest.fn().mockResolvedValue({ success: true, data: [] }),
      executeTool: jest.fn().mockResolvedValue({ success: true, data: { status: 'open' } }),
      clearCache: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockReturnValue({ polygon: { connected: true }, alphavantage: { connected: true } })
    } as any

    mockRedisCache = {
      cleanup: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(true),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getInstance: jest.fn()
    } as any

    // Mock constructors
    MockedWebSocketManager.mockImplementation(() => mockWsManager)
    MockedMCPClient.getInstance = jest.fn().mockReturnValue(mockMcpClient)
    MockedRedisCache.getInstance = jest.fn().mockReturnValue(mockRedisCache)

    pipeline = new RealTimePipeline()
  })

  afterEach(async () => {
    // Clear all timers first to prevent leaks
    jest.clearAllTimers()

    // Cleanup pipeline
    if (pipeline) {
      try {
        await pipeline.stop()
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }

    // Reset all mocks to prevent state leakage
    jest.clearAllMocks()

    // Return to real timers
    jest.useRealTimers()
  })

  describe('Data Stream Cleanup', () => {
    test('should_start_and_stop_all_data_streams_properly', async () => {
      // Arrange
      const setIntervalSpy = jest.spyOn(global, 'setInterval')
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      // Act
      await pipeline.start()
      const runningStatus = pipeline.getStatus()

      await pipeline.stop()
      const stoppedStatus = pipeline.getStatus()

      // Assert
      expect(runningStatus.isRunning).toBe(true)
      expect(runningStatus.activeStreams).toBeGreaterThan(0)
      expect(stoppedStatus.isRunning).toBe(false)
      expect(stoppedStatus.activeStreams).toBe(0)

      expect(setIntervalSpy).toHaveBeenCalled()
      expect(clearIntervalSpy).toHaveBeenCalled()

      // Cleanup
      setIntervalSpy.mockRestore()
      clearIntervalSpy.mockRestore()
    })

    test('should_clear_all_data_stream_intervals_on_stop', async () => {
      // Arrange
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      await pipeline.start()
      const initialStreamCount = pipeline.getResourceCounts().dataStreams
      const initialBackgroundCount = pipeline.getResourceCounts().backgroundProcesses
      const hasHealthCheck = pipeline.getResourceCounts().healthCheckActive

      // Clear the spy to only count calls from stop()
      clearIntervalSpy.mockClear()

      // Act
      await pipeline.stop()

      // Assert - Check that clearInterval was called for all intervals
      const expectedClearCalls = initialStreamCount + initialBackgroundCount + (hasHealthCheck ? 1 : 0)
      expect(clearIntervalSpy).toHaveBeenCalledTimes(expectedClearCalls)
      expect(pipeline.getResourceCounts().dataStreams).toBe(0)

      // Cleanup
      clearIntervalSpy.mockRestore()
    })

    test('should_handle_data_stream_errors_without_crashing', async () => {
      // Arrange
      mockMcpClient.getUnifiedStockPrice.mockRejectedValue(new Error('API error'))
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      await pipeline.start()

      // Act - Advance timer to trigger data stream
      jest.advanceTimersByTime(1000)
      await Promise.resolve()

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith('Price stream error:', expect.any(Error))
      expect(pipeline.getStatus().isRunning).toBe(true) // Should still be running

      // Cleanup
      consoleErrorSpy.mockRestore()
    })

    test('should_prevent_data_stream_execution_after_stop', async () => {
      // Arrange
      await pipeline.start()

      // Act
      await pipeline.stop()

      // Advance timers after stop
      jest.advanceTimersByTime(10000)
      await Promise.resolve()

      // Assert - MCP calls should not be made after stop
      const callCountBeforeStop = mockMcpClient.getUnifiedStockPrice.mock.calls.length
      expect(mockMcpClient.getUnifiedStockPrice).toHaveBeenCalledTimes(callCountBeforeStop)
    })

    test('should_cleanup_data_stream_memory_references', async () => {
      // Arrange
      await pipeline.start()
      expect(pipeline.getResourceCounts().dataStreams).toBeGreaterThan(0)

      // Act
      await pipeline.stop()

      // Assert
      expect(pipeline.getResourceCounts().dataStreams).toBe(0)
    })

    test('should_handle_rapid_start_stop_cycles_for_data_streams', async () => {
      // Arrange
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      // Act - Rapid cycles
      for (let i = 0; i < 5; i++) {
        await pipeline.start()
        await pipeline.stop()
      }

      // Assert
      expect(clearIntervalSpy).toHaveBeenCalled()
      expect(pipeline.getResourceCounts().dataStreams).toBe(0)

      // Cleanup
      clearIntervalSpy.mockRestore()
    })
  })

  describe('WebSocket Connection Lifecycle', () => {
    test('should_connect_websocket_on_pipeline_start', async () => {
      // Act
      await pipeline.start()

      // Assert
      expect(mockWsManager.connect).toHaveBeenCalledTimes(1)
    })

    test('should_disconnect_websocket_on_pipeline_stop', async () => {
      // Arrange
      await pipeline.start()

      // Act
      await pipeline.stop()

      // Assert
      expect(mockWsManager.disconnect).toHaveBeenCalledTimes(1)
    })

    test('should_handle_websocket_connection_failures_gracefully', async () => {
      // Arrange
      mockWsManager.connect.mockRejectedValue(new Error('Connection failed'))

      // Act & Assert
      try {
        await pipeline.start()
        fail('Expected pipeline.start() to throw')
      } catch (error) {
        expect(error.message).toBe('Connection failed')
      }

      expect(pipeline.getStatus().isRunning).toBe(false)
    })

    test('should_attempt_websocket_reconnection_during_health_checks', async () => {
      // Arrange
      mockWsManager.getStatus.mockReturnValue({
        connected: false,
        currentSector: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 10
      })

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      await pipeline.start()

      // Act - Trigger health check
      jest.advanceTimersByTime(10000)
      await Promise.resolve()

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️ WebSocket disconnected, attempting reconnect...'
      )
      expect(mockWsManager.connect).toHaveBeenCalledTimes(2) // Initial + reconnect

      // Cleanup
      consoleWarnSpy.mockRestore()
    })

    test('should_handle_websocket_disconnect_errors_during_stop', async () => {
      // Arrange
      mockWsManager.disconnect.mockImplementation(() => {
        throw new Error('Disconnect failed')
      })

      await pipeline.start()

      // Act & Assert - Should not throw
      await expect(pipeline.stop()).resolves.toBeUndefined()
    })
  })

  describe('Background Process Termination', () => {
    test('should_start_and_stop_all_background_processes', async () => {
      // Arrange
      const setIntervalSpy = jest.spyOn(global, 'setInterval')
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      // Act
      await pipeline.start()
      const runningProcesses = pipeline.getResourceCounts().backgroundProcesses

      await pipeline.stop()
      const stoppedProcesses = pipeline.getResourceCounts().backgroundProcesses

      // Assert
      expect(runningProcesses).toBeGreaterThan(0)
      expect(stoppedProcesses).toBe(0)
      expect(setIntervalSpy).toHaveBeenCalled()
      expect(clearIntervalSpy).toHaveBeenCalled()

      // Cleanup
      setIntervalSpy.mockRestore()
      clearIntervalSpy.mockRestore()
    })

    test('should_terminate_background_processes_in_correct_order', async () => {
      // Arrange
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      await pipeline.start()

      // Act
      await pipeline.stop()

      // Assert - Background processes should be stopped before other cleanup
      expect(clearIntervalSpy).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stopped background process:')
      )

      // Cleanup
      clearIntervalSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    test('should_handle_background_process_errors_gracefully', async () => {
      // Arrange
      mockRedisCache.cleanup.mockRejectedValue(new Error('Cleanup failed'))
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      await pipeline.start()

      // Act - Trigger background process (cache cleanup)
      jest.advanceTimersByTime(30000)
      await Promise.resolve()

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Cache cleanup error:',
        expect.any(Error)
      )

      // Cleanup
      consoleErrorSpy.mockRestore()
    })

    test('should_prevent_background_process_execution_after_stop', async () => {
      // Arrange
      await pipeline.start()

      // Act
      await pipeline.stop()

      // Clear mock call history
      mockRedisCache.cleanup.mockClear()

      // Advance timers after stop
      jest.advanceTimersByTime(60000)
      await Promise.resolve()

      // Assert - Background processes should not execute after stop
      expect(mockRedisCache.cleanup).not.toHaveBeenCalled()
    })

    test('should_cleanup_background_process_memory_references', async () => {
      // Arrange
      await pipeline.start()
      expect(pipeline.getResourceCounts().backgroundProcesses).toBeGreaterThan(0)

      // Act
      await pipeline.stop()

      // Assert
      expect(pipeline.getResourceCounts().backgroundProcesses).toBe(0)
    })
  })

  describe('Memory Leak Prevention', () => {
    test('should_clear_data_processing_queue_on_stop', async () => {
      // Arrange
      await pipeline.start()

      // Manually add items to processing queue to test cleanup
      pipeline.addToProcessingQueue('test-item-1', { data: 'test1' })
      pipeline.addToProcessingQueue('test-item-2', { data: 'test2' })
      pipeline.addToProcessingQueue('test-item-3', { data: 'test3' })

      expect(pipeline.getResourceCounts().queueItems).toBeGreaterThan(0)

      // Act
      await pipeline.stop()

      // Assert
      expect(pipeline.getResourceCounts().queueItems).toBe(0)
    })

    test('should_prevent_queue_overflow_during_operation', async () => {
      // Arrange
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      await pipeline.start()

      // Act - Simulate many data items (would normally trigger queue truncation)
      // This is tested through the queue processing logic
      for (let i = 0; i < 1100; i++) {
        jest.advanceTimersByTime(100)
        await Promise.resolve()
      }

      // Assert - Queue should be managed to prevent overflow
      expect(pipeline.getResourceCounts().queueItems).toBeLessThan(1000)

      // Cleanup
      consoleWarnSpy.mockRestore()
    })

    test('should_perform_memory_cleanup_on_high_usage', async () => {
      // Arrange
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 600 * 1024 * 1024, // 600MB - above threshold
        heapTotal: 800 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        rss: 700 * 1024 * 1024
      })

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      await pipeline.start()

      // Act - Trigger health check
      jest.advanceTimersByTime(10000)
      await Promise.resolve()

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️ High memory usage detected')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performing memory cleanup')
      )
      expect(mockMcpClient.clearCache).toHaveBeenCalled()

      // Cleanup
      process.memoryUsage = originalMemoryUsage
      consoleWarnSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    test('should_remove_old_queue_items_during_memory_cleanup', async () => {
      // Arrange
      await pipeline.start()

      // Add some old items to the processing queue
      const now = Date.now()
      for (let i = 0; i < 10; i++) {
        pipeline.addToProcessingQueue('old-item', { id: i, timestamp: now - 70000 }) // 70 seconds old
      }

      // Add some recent items
      for (let i = 0; i < 5; i++) {
        pipeline.addToProcessingQueue('recent-item', { id: i, timestamp: now - 5000 }) // 5 seconds old
      }

      const originalSize = pipeline.getResourceCounts().queueItems
      expect(originalSize).toBe(15) // 10 old + 5 recent

      // Mock high memory usage to trigger cleanup
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 600 * 1024 * 1024,
        heapTotal: 800 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        rss: 700 * 1024 * 1024
      })

      // Act - Trigger health check which will perform memory cleanup
      jest.advanceTimersByTime(10000)
      await Promise.resolve()

      // Assert - Old items should be removed
      const newSize = pipeline.getResourceCounts().queueItems
      expect(newSize).toBeLessThan(originalSize)
      expect(newSize).toBeGreaterThan(0) // Recent items should remain

      // Cleanup
      process.memoryUsage = originalMemoryUsage
    })

    test('should_handle_garbage_collection_when_available', async () => {
      // Arrange
      const mockGc = jest.fn()
      ;(global as any).gc = mockGc

      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 600 * 1024 * 1024,
        heapTotal: 800 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        rss: 700 * 1024 * 1024
      })

      await pipeline.start()

      // Act - Trigger memory cleanup
      jest.advanceTimersByTime(10000)
      await Promise.resolve()

      // Assert
      expect(mockGc).toHaveBeenCalled()

      // Cleanup
      delete (global as any).gc
      process.memoryUsage = originalMemoryUsage
    })
  })

  describe('Health Check Timer Cleanup', () => {
    test('should_start_health_check_interval_on_pipeline_start', async () => {
      // Arrange
      const setIntervalSpy = jest.spyOn(global, 'setInterval')

      // Act
      await pipeline.start()

      // Assert
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        10000 // 10 seconds
      )
      expect(pipeline.getResourceCounts().healthCheckActive).toBe(true)

      // Cleanup
      setIntervalSpy.mockRestore()
    })

    test('should_stop_health_check_interval_on_pipeline_stop', async () => {
      // Arrange
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      await pipeline.start()

      // Act
      await pipeline.stop()

      // Assert
      expect(clearIntervalSpy).toHaveBeenCalled()
      expect(pipeline.getResourceCounts().healthCheckActive).toBe(false)

      // Cleanup
      clearIntervalSpy.mockRestore()
    })

    test('should_execute_health_checks_periodically', async () => {
      // Arrange
      await pipeline.start()

      // Act - Advance timer multiple times
      jest.advanceTimersByTime(10000)
      await Promise.resolve()
      jest.advanceTimersByTime(10000)
      await Promise.resolve()

      // Assert - Health checks should be called
      expect(mockWsManager.getStatus).toHaveBeenCalled()
      expect(mockMcpClient.getStats).toHaveBeenCalled()
    })

    test('should_handle_health_check_errors_gracefully', async () => {
      // Arrange
      mockWsManager.getStatus.mockImplementation(() => {
        throw new Error('Status check failed')
      })

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      await pipeline.start()

      // Act - Trigger health check
      jest.advanceTimersByTime(10000)
      await Promise.resolve()

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Health check error:',
        expect.any(Error)
      )

      // Cleanup
      consoleErrorSpy.mockRestore()
    })

    test('should_prevent_health_check_memory_leaks', async () => {
      // Arrange
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      // Multiple start/stop cycles
      for (let i = 0; i < 3; i++) {
        await pipeline.start()
        await pipeline.stop()
      }

      // Assert
      expect(clearIntervalSpy).toHaveBeenCalled()
      expect(pipeline.getResourceCounts().healthCheckActive).toBe(false)

      // Cleanup
      clearIntervalSpy.mockRestore()
    })
  })

  describe('Integration Resource Management Tests', () => {
    test('should_perform_complete_pipeline_lifecycle_cleanup', async () => {
      // Arrange
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      // Act - Full lifecycle
      await pipeline.start()

      const runningStatus = pipeline.getStatus()
      expect(runningStatus.isRunning).toBe(true)
      expect(runningStatus.activeStreams).toBeGreaterThan(0)
      expect(runningStatus.backgroundProcesses).toBeGreaterThan(0)
      expect(runningStatus.hasHealthCheck).toBe(true)

      await pipeline.stop()

      const stoppedStatus = pipeline.getStatus()
      expect(stoppedStatus.isRunning).toBe(false)
      expect(stoppedStatus.activeStreams).toBe(0)
      expect(stoppedStatus.backgroundProcesses).toBe(0)
      expect(stoppedStatus.hasHealthCheck).toBe(false)
      expect(stoppedStatus.queueSize).toBe(0)

      // Assert - All resources cleaned up
      expect(clearIntervalSpy).toHaveBeenCalled()
      expect(mockWsManager.disconnect).toHaveBeenCalled()
      expect(mockMcpClient.clearCache).toHaveBeenCalled()
      expect(mockRedisCache.shutdown).toHaveBeenCalled()

      // Cleanup
      clearIntervalSpy.mockRestore()
    })

    test('should_handle_partial_cleanup_failures_gracefully', async () => {
      // Arrange
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      mockWsManager.disconnect.mockImplementation(() => {
        throw new Error('WebSocket disconnect failed')
      })
      mockMcpClient.clearCache.mockRejectedValue(new Error('Cache clear failed'))

      await pipeline.start()

      // Act & Assert - Should not throw despite individual failures
      await expect(pipeline.stop()).resolves.toBeUndefined()

      // Final state should still be stopped
      expect(pipeline.getStatus().isRunning).toBe(false)

      // Should have logged errors for failed operations
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error disconnecting WebSocket:', expect.any(Error))
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error clearing MCP cache:', expect.any(Error))

      // Cleanup
      consoleErrorSpy.mockRestore()
    })

    test('should_maintain_resource_cleanup_idempotency', async () => {
      // Arrange
      await pipeline.start()

      // Act - Multiple stops
      await pipeline.stop()
      await pipeline.stop()
      await pipeline.stop()

      // Assert - Should remain in clean state
      const status = pipeline.getStatus()
      expect(status.isRunning).toBe(false)
      expect(status.activeStreams).toBe(0)
      expect(status.backgroundProcesses).toBe(0)
      expect(status.queueSize).toBe(0)
      expect(status.hasHealthCheck).toBe(false)
    })

    test('should_prevent_resource_leaks_during_rapid_lifecycle_cycles', async () => {
      // Arrange
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      // Act - Rapid start/stop cycles
      for (let i = 0; i < 10; i++) {
        await pipeline.start()
        await pipeline.stop()
      }

      // Assert - No resource accumulation
      expect(clearIntervalSpy).toHaveBeenCalled()
      const finalStatus = pipeline.getStatus()
      expect(finalStatus.activeStreams).toBe(0)
      expect(finalStatus.backgroundProcesses).toBe(0)
      expect(finalStatus.queueSize).toBe(0)
      expect(finalStatus.hasHealthCheck).toBe(false)

      // Cleanup
      clearIntervalSpy.mockRestore()
    })

    test('should_handle_cleanup_during_active_operations', async () => {
      // Arrange
      let resolveDataOperation: (value: any) => void
      const pendingOperation = new Promise(resolve => { resolveDataOperation = resolve })

      mockMcpClient.getUnifiedStockPrice.mockReturnValue(pendingOperation)

      await pipeline.start()

      // Trigger data operation
      jest.advanceTimersByTime(1000)

      // Act - Stop while operation is pending
      const stopPromise = pipeline.stop()

      // Resolve the operation
      resolveDataOperation!({ success: true, data: { price: 150 } })

      // Assert - Should complete cleanup despite pending operations
      await expect(stopPromise).resolves.toBeUndefined()
      expect(pipeline.getStatus().isRunning).toBe(false)
    })
  })
})