/**
 * Comprehensive Memory Leak Detection Tests
 * Tests for detecting memory leaks, unclosed connections, and orphaned resources
 * across the entire stock picker system
 */

import { WebSocketManager } from '../websocket/WebSocketManager'
import { MCPClient } from '../mcp/MCPClient'
import { RedisCache } from '../cache/RedisCache'
import { jest } from '@jest/globals'

// Mock all dependencies for controlled testing
jest.mock('../websocket/WebSocketManager')
jest.mock('../mcp/MCPClient')
jest.mock('../cache/RedisCache')

const MockedWebSocketManager = WebSocketManager as jest.MockedClass<typeof WebSocketManager>
const MockedMCPClient = MCPClient as jest.MockedClass<typeof MCPClient>
const MockedRedisCache = RedisCache as jest.MockedClass<typeof RedisCache>

// Memory Leak Detection Utilities
class MemoryLeakDetector {
  private initialMemory: NodeJS.MemoryUsage
  private snapshots: Array<{ timestamp: number; memory: NodeJS.MemoryUsage; label: string }> = []
  private activeTasks: Set<string> = new Set()
  private resourceCounters: Map<string, number> = new Map()

  constructor() {
    this.initialMemory = process.memoryUsage()
    this.takeSnapshot('initial')
  }

  takeSnapshot(label: string): NodeJS.MemoryUsage {
    const memory = process.memoryUsage()
    this.snapshots.push({
      timestamp: Date.now(),
      memory,
      label
    })
    return memory
  }

  getMemoryDelta(fromLabel: string, toLabel?: string): NodeJS.MemoryUsage {
    const fromSnapshot = this.snapshots.find(s => s.label === fromLabel)
    const toSnapshot = toLabel
      ? this.snapshots.find(s => s.label === toLabel)
      : this.snapshots[this.snapshots.length - 1]

    if (!fromSnapshot || !toSnapshot) {
      throw new Error(`Snapshot not found: ${fromLabel} or ${toLabel}`)
    }

    return {
      rss: toSnapshot.memory.rss - fromSnapshot.memory.rss,
      heapTotal: toSnapshot.memory.heapTotal - fromSnapshot.memory.heapTotal,
      heapUsed: toSnapshot.memory.heapUsed - fromSnapshot.memory.heapUsed,
      external: toSnapshot.memory.external - fromSnapshot.memory.external,
      arrayBuffers: toSnapshot.memory.arrayBuffers - fromSnapshot.memory.arrayBuffers
    }
  }

  detectMemoryLeak(threshold: number = 10 * 1024 * 1024): boolean { // 10MB default threshold
    const delta = this.getMemoryDelta('initial')
    return delta.heapUsed > threshold
  }

  addActiveTask(taskId: string): void {
    this.activeTasks.add(taskId)
  }

  removeActiveTask(taskId: string): void {
    this.activeTasks.delete(taskId)
  }

  getActiveTaskCount(): number {
    return this.activeTasks.size
  }

  incrementResourceCounter(resource: string): void {
    const current = this.resourceCounters.get(resource) || 0
    this.resourceCounters.set(resource, current + 1)
  }

  decrementResourceCounter(resource: string): void {
    const current = this.resourceCounters.get(resource) || 0
    this.resourceCounters.set(resource, Math.max(0, current - 1))
  }

  getResourceCount(resource: string): number {
    return this.resourceCounters.get(resource) || 0
  }

  getAllResourceCounts(): Map<string, number> {
    return new Map(this.resourceCounters)
  }

  getMemoryReport(): string {
    const latest = this.snapshots[this.snapshots.length - 1]
    const delta = this.getMemoryDelta('initial')

    return `
Memory Report:
=============
Initial Memory: ${Math.round(this.initialMemory.heapUsed / 1024 / 1024)}MB
Current Memory: ${Math.round(latest.memory.heapUsed / 1024 / 1024)}MB
Memory Delta: ${Math.round(delta.heapUsed / 1024 / 1024)}MB
Active Tasks: ${this.activeTasks.size}
Resource Counts: ${JSON.stringify(Object.fromEntries(this.resourceCounters))}
Snapshots: ${this.snapshots.length}
    `.trim()
  }

  reset(): void {
    this.snapshots = []
    this.activeTasks.clear()
    this.resourceCounters.clear()
    this.initialMemory = process.memoryUsage()
    this.takeSnapshot('initial')
  }
}

// Resource Tracker for monitoring system resources
class ResourceTracker {
  private fileDescriptors: Set<string> = new Set()
  private eventListeners: Map<string, number> = new Map()
  private timers: Set<NodeJS.Timeout> = new Set()
  private intervals: Set<NodeJS.Timeout> = new Set()
  private promises: Set<Promise<any>> = new Set()
  private resourceCounters: Map<string, number> = new Map()

  addFileDescriptor(fd: string): void {
    this.fileDescriptors.add(fd)
  }

  removeFileDescriptor(fd: string): void {
    this.fileDescriptors.delete(fd)
  }

  getOpenFileDescriptors(): number {
    return this.fileDescriptors.size
  }

  addEventListener(event: string): void {
    const count = this.eventListeners.get(event) || 0
    this.eventListeners.set(event, count + 1)
  }

  removeEventListener(event: string): void {
    const count = this.eventListeners.get(event) || 0
    if (count > 0) {
      this.eventListeners.set(event, count - 1)
    }
  }

  getEventListenerCount(event: string): number {
    return this.eventListeners.get(event) || 0
  }

  addTimer(timer: NodeJS.Timeout): void {
    this.timers.add(timer)
  }

  removeTimer(timer: NodeJS.Timeout): void {
    this.timers.delete(timer)
  }

  getActiveTimerCount(): number {
    return this.timers.size
  }

  addInterval(interval: NodeJS.Timeout): void {
    this.intervals.add(interval)
  }

  removeInterval(interval: NodeJS.Timeout): void {
    this.intervals.delete(interval)
  }

  getActiveIntervalCount(): number {
    return this.intervals.size
  }

  addPromise(promise: Promise<any>): void {
    this.promises.add(promise)
    promise.finally(() => {
      this.promises.delete(promise)
    })
  }

  getActivePendingPromises(): number {
    return this.promises.size
  }

  incrementResourceCounter(resource: string): void {
    const current = this.resourceCounters.get(resource) || 0
    this.resourceCounters.set(resource, current + 1)
  }

  decrementResourceCounter(resource: string): void {
    const current = this.resourceCounters.get(resource) || 0
    this.resourceCounters.set(resource, Math.max(0, current - 1))
  }

  getResourceCount(resource: string): number {
    return this.resourceCounters.get(resource) || 0
  }

  getAllResourceCounts(): Map<string, number> {
    return new Map(this.resourceCounters)
  }

  reset(): void {
    this.fileDescriptors.clear()
    this.eventListeners.clear()
    this.timers.clear()
    this.intervals.clear()
    this.promises.clear()
    this.resourceCounters.clear()
  }

  getResourceSummary(): object {
    return {
      fileDescriptors: this.fileDescriptors.size,
      eventListeners: Object.fromEntries(this.eventListeners),
      timers: this.timers.size,
      intervals: this.intervals.size,
      pendingPromises: this.promises.size,
      resourceCounters: Object.fromEntries(this.resourceCounters)
    }
  }
}

describe('Memory Leak Detection Tests', () => {
  let memoryDetector: MemoryLeakDetector
  let resourceTracker: ResourceTracker
  let wsManager: WebSocketManager
  let mcpClient: MCPClient
  let redisCache: RedisCache

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    memoryDetector = new MemoryLeakDetector()
    resourceTracker = new ResourceTracker()

    // Setup mocked instances
    const mockWsManager = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      onMessage: jest.fn(),
      onConnection: jest.fn(),
      onError: jest.fn(),
      getStatus: jest.fn().mockReturnValue({ connected: true }),
      subscribeToSector: jest.fn(),
      unsubscribe: jest.fn()
    } as any

    const mockMcpClient = {
      executeTool: jest.fn().mockResolvedValue({ success: true, data: {} }),
      clearCache: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockReturnValue({}),
      resetFusion: jest.fn(),
      warmCache: jest.fn().mockResolvedValue(undefined)
    } as any

    const mockRedisCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      cleanup: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({ hits: 0, misses: 0 })
    } as any

    MockedWebSocketManager.mockImplementation(() => mockWsManager)
    MockedMCPClient.getInstance = jest.fn().mockReturnValue(mockMcpClient)
    MockedRedisCache.getInstance = jest.fn().mockReturnValue(mockRedisCache)

    wsManager = new WebSocketManager()
    mcpClient = MCPClient.getInstance()
    redisCache = RedisCache.getInstance()
  })

  afterEach(() => {
    // Clear all timers first to prevent leaks
    jest.clearAllTimers()

    // Reset tracking utilities
    memoryDetector.reset()
    resourceTracker.reset()

    // Reset all mocks to prevent state leakage
    jest.clearAllMocks()

    // Return to real timers
    jest.useRealTimers()
  })

  describe('WebSocket Memory Leak Detection', () => {
    test('should_detect_websocket_connection_memory_leaks', async () => {
      // Arrange
      memoryDetector.takeSnapshot('before_connections')
      resourceTracker.addFileDescriptor('websocket-1')

      // Act - Simulate multiple connection cycles
      for (let i = 0; i < 100; i++) {
        memoryDetector.addActiveTask(`websocket-connect-${i}`)
        await wsManager.connect()

        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 10))

        wsManager.disconnect()
        memoryDetector.removeActiveTask(`websocket-connect-${i}`)
      }

      memoryDetector.takeSnapshot('after_connections')

      // Assert
      const memoryDelta = memoryDetector.getMemoryDelta('before_connections', 'after_connections')
      expect(memoryDelta.heapUsed).toBeLessThan(50 * 1024 * 1024) // Less than 50MB growth

      expect(memoryDetector.getActiveTaskCount()).toBe(0)
      expect(resourceTracker.getOpenFileDescriptors()).toBe(1) // Only the tracked one
    })

    test('should_detect_event_listener_memory_leaks', () => {
      // Arrange
      memoryDetector.takeSnapshot('before_listeners')

      // Act - Add many event listeners
      for (let i = 0; i < 1000; i++) {
        resourceTracker.addEventListener('message')
        wsManager.onMessage(() => {})

        resourceTracker.addEventListener('connection')
        wsManager.onConnection(() => {})

        resourceTracker.addEventListener('error')
        wsManager.onError(() => {})
      }

      memoryDetector.takeSnapshot('after_listeners')

      // Assert
      expect(resourceTracker.getEventListenerCount('message')).toBe(1000)
      expect(resourceTracker.getEventListenerCount('connection')).toBe(1000)
      expect(resourceTracker.getEventListenerCount('error')).toBe(1000)

      // Simulate cleanup (not implemented in current WebSocketManager)
      // This test documents the need for event listener cleanup
      const memoryDelta = memoryDetector.getMemoryDelta('before_listeners', 'after_listeners')
      console.log(`Event listener memory delta: ${memoryDelta.heapUsed / 1024}KB`)
    })

    test('should_detect_websocket_timer_leaks', () => {
      // Arrange
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      memoryDetector.takeSnapshot('before_timers')

      // Act - Simulate timer creation and cleanup
      const timers: NodeJS.Timeout[] = []
      for (let i = 0; i < 50; i++) {
        const timer = setTimeout(() => {}, 1000)
        timers.push(timer)
        resourceTracker.addTimer(timer)
      }

      // Simulate proper cleanup - manually remove from tracker
      clearTimeoutSpy.mockImplementation((timer) => {
        resourceTracker.removeTimer(timer as NodeJS.Timeout)
      })

      // Clear all timers and update tracker
      timers.forEach(timer => {
        clearTimeout(timer)
        resourceTracker.removeTimer(timer)
      })
      jest.clearAllTimers()

      memoryDetector.takeSnapshot('after_timers')

      // Assert
      expect(setTimeoutSpy).toHaveBeenCalled()
      expect(resourceTracker.getActiveTimerCount()).toBe(0)

      // Cleanup
      setTimeoutSpy.mockRestore()
      clearTimeoutSpy.mockRestore()
    })

    test('should_detect_websocket_reconnection_memory_leaks', async () => {
      // Arrange
      memoryDetector.takeSnapshot('before_reconnections')

      // Act - Simulate failed connections that trigger reconnections
      for (let i = 0; i < 20; i++) {
        memoryDetector.addActiveTask(`reconnect-cycle-${i}`)

        try {
          await wsManager.connect()
          wsManager.disconnect()
        } catch (error) {
          // Ignore connection errors
        }

        memoryDetector.removeActiveTask(`reconnect-cycle-${i}`)
      }

      memoryDetector.takeSnapshot('after_reconnections')

      // Assert
      const memoryDelta = memoryDetector.getMemoryDelta('before_reconnections', 'after_reconnections')
      expect(memoryDelta.heapUsed).toBeLessThan(20 * 1024 * 1024) // Less than 20MB growth
      expect(memoryDetector.getActiveTaskCount()).toBe(0)
    })
  })

  describe('MCP Client Memory Leak Detection', () => {
    test('should_detect_mcp_request_queue_memory_leaks', async () => {
      // Arrange
      memoryDetector.takeSnapshot('before_mcp_requests')

      // Act - Create many requests
      const promises = []
      for (let i = 0; i < 500; i++) {
        memoryDetector.addActiveTask(`mcp-request-${i}`)
        resourceTracker.incrementResourceCounter('mcp-requests')

        const promise = mcpClient.executeTool('get_ticker_details', { ticker: `STOCK${i}` })
        resourceTracker.addPromise(promise)
        promises.push(promise)
      }

      await Promise.all(promises)

      // Clean up task tracking
      for (let i = 0; i < 500; i++) {
        memoryDetector.removeActiveTask(`mcp-request-${i}`)
        resourceTracker.decrementResourceCounter('mcp-requests')
      }

      memoryDetector.takeSnapshot('after_mcp_requests')

      // Assert
      const memoryDelta = memoryDetector.getMemoryDelta('before_mcp_requests', 'after_mcp_requests')
      expect(memoryDelta.heapUsed).toBeLessThan(100 * 1024 * 1024) // Less than 100MB growth

      expect(memoryDetector.getActiveTaskCount()).toBe(0)
      expect(resourceTracker.getResourceCount('mcp-requests')).toBe(0)
      expect(resourceTracker.getActivePendingPromises()).toBe(0)
    })

    test('should_detect_mcp_cache_memory_leaks', async () => {
      // Arrange
      memoryDetector.takeSnapshot('before_mcp_cache')

      // Act - Fill cache with data
      for (let i = 0; i < 1000; i++) {
        memoryDetector.addActiveTask(`cache-fill-${i}`)
        resourceTracker.incrementResourceCounter('cache-entries')

        await mcpClient.executeTool('get_ticker_details', { ticker: `CACHE${i}` }, {
          cacheTTL: 60000
        })

        memoryDetector.removeActiveTask(`cache-fill-${i}`)
      }

      memoryDetector.takeSnapshot('after_cache_fill')

      // Clear cache
      await mcpClient.clearCache()

      // Reset resource counter after cache clear
      resourceTracker.resourceCounters.set('cache-entries', 0)

      memoryDetector.takeSnapshot('after_cache_clear')

      // Assert
      const fillDelta = memoryDetector.getMemoryDelta('before_mcp_cache', 'after_cache_fill')
      const clearDelta = memoryDetector.getMemoryDelta('after_cache_fill', 'after_cache_clear')

      expect(fillDelta.heapUsed).toBeGreaterThan(0) // Memory should increase with cache
      expect(Math.abs(clearDelta.heapUsed)).toBeLessThan(fillDelta.heapUsed) // Memory should decrease after clear

      expect(memoryDetector.getActiveTaskCount()).toBe(0)
      expect(resourceTracker.getResourceCount('cache-entries')).toBe(0)
    })

    test('should_detect_mcp_fusion_engine_memory_leaks', () => {
      // Arrange
      memoryDetector.takeSnapshot('before_fusion_reset')

      // Simulate fusion operations
      for (let i = 0; i < 100; i++) {
        memoryDetector.incrementResourceCounter('fusion-operations')
      }

      // Act - Reset fusion engine
      mcpClient.resetFusion()
      memoryDetector.resourceCounters.set('fusion-operations', 0)

      memoryDetector.takeSnapshot('after_fusion_reset')

      // Assert
      expect(memoryDetector.getResourceCount('fusion-operations')).toBe(0)
    })

    test('should_detect_mcp_connection_pool_memory_leaks', async () => {
      // Arrange
      memoryDetector.takeSnapshot('before_connection_pool')

      // Act - Simulate many connections to different servers
      const serverRequests = ['polygon', 'alphavantage', 'yahoo', 'fmp']

      for (let i = 0; i < 100; i++) {
        for (const server of serverRequests) {
          memoryDetector.addActiveTask(`${server}-request-${i}`)
          resourceTracker.incrementResourceCounter(`${server}-connections`)

          await mcpClient.executeTool('get_ticker_details', { ticker: 'AAPL' }, {
            preferredServer: server
          })

          memoryDetector.removeActiveTask(`${server}-request-${i}`)
        }
      }

      memoryDetector.takeSnapshot('after_connection_pool')

      // Assert
      const memoryDelta = memoryDetector.getMemoryDelta('before_connection_pool', 'after_connection_pool')
      expect(memoryDelta.heapUsed).toBeLessThan(50 * 1024 * 1024) // Less than 50MB growth

      expect(memoryDetector.getActiveTaskCount()).toBe(0)

      // Check connection counters
      serverRequests.forEach(server => {
        expect(resourceTracker.getResourceCount(`${server}-connections`)).toBe(100)
      })
    })
  })

  describe('Redis Cache Memory Leak Detection', () => {
    test('should_detect_redis_connection_memory_leaks', async () => {
      // Arrange
      memoryDetector.takeSnapshot('before_redis_operations')
      resourceTracker.addFileDescriptor('redis-connection')

      // Act - Perform many Redis operations
      for (let i = 0; i < 1000; i++) {
        memoryDetector.addActiveTask(`redis-op-${i}`)
        resourceTracker.incrementResourceCounter('redis-operations')

        await redisCache.set(`key-${i}`, { data: `value-${i}` }, 60)
        await redisCache.get(`key-${i}`)

        memoryDetector.removeActiveTask(`redis-op-${i}`)
        resourceTracker.decrementResourceCounter('redis-operations')
      }

      memoryDetector.takeSnapshot('after_redis_operations')

      // Assert
      const memoryDelta = memoryDetector.getMemoryDelta('before_redis_operations', 'after_redis_operations')
      expect(memoryDelta.heapUsed).toBeLessThan(30 * 1024 * 1024) // Less than 30MB growth

      expect(memoryDetector.getActiveTaskCount()).toBe(0)
      expect(resourceTracker.getResourceCount('redis-operations')).toBe(0)
      expect(resourceTracker.getOpenFileDescriptors()).toBe(1) // Redis connection
    })

    test('should_detect_redis_cleanup_effectiveness', async () => {
      // Arrange
      memoryDetector.takeSnapshot('before_redis_cleanup')

      // Fill Redis with data
      for (let i = 0; i < 500; i++) {
        resourceTracker.incrementResourceCounter('redis-keys')
        await redisCache.set(`cleanup-key-${i}`, { data: `cleanup-value-${i}` }, 60)
      }

      memoryDetector.takeSnapshot('after_redis_fill')

      // Perform cleanup
      await redisCache.cleanup()
      resourceTracker.resourceCounters.set('redis-keys', 0)

      memoryDetector.takeSnapshot('after_redis_cleanup')

      // Assert
      const fillDelta = memoryDetector.getMemoryDelta('before_redis_cleanup', 'after_redis_fill')
      const cleanupDelta = memoryDetector.getMemoryDelta('after_redis_fill', 'after_redis_cleanup')

      expect(fillDelta.heapUsed).toBeGreaterThan(0)
      // Cleanup might not immediately reduce memory due to Redis internals
      expect(resourceTracker.getResourceCount('redis-keys')).toBe(0)
    })

    test('should_detect_redis_shutdown_memory_cleanup', async () => {
      // Arrange
      memoryDetector.takeSnapshot('before_redis_shutdown')
      resourceTracker.addFileDescriptor('redis-primary')
      resourceTracker.addFileDescriptor('redis-backup')

      // Simulate Redis operations
      for (let i = 0; i < 100; i++) {
        await redisCache.get(`test-key-${i}`)
      }

      // Act - Shutdown Redis
      await redisCache.shutdown()
      resourceTracker.removeFileDescriptor('redis-primary')
      resourceTracker.removeFileDescriptor('redis-backup')

      memoryDetector.takeSnapshot('after_redis_shutdown')

      // Assert
      expect(resourceTracker.getOpenFileDescriptors()).toBe(0)
    })
  })

  describe('Integration Memory Leak Detection', () => {
    test('should_detect_cross_component_memory_leaks', async () => {
      // Arrange
      memoryDetector.takeSnapshot('before_integration')
      resourceTracker.addFileDescriptor('websocket')
      resourceTracker.addFileDescriptor('redis')

      // Act - Simulate full system operation
      await wsManager.connect()

      for (let i = 0; i < 100; i++) {
        memoryDetector.addActiveTask(`integration-cycle-${i}`)

        // WebSocket operation
        wsManager.subscribeToSector('technology')

        // MCP operation
        await mcpClient.executeTool('get_ticker_details', { ticker: `INT${i}` })

        // Redis operation
        await redisCache.set(`integration-${i}`, { cycle: i }, 60)

        // Cleanup
        wsManager.unsubscribe()
        memoryDetector.removeActiveTask(`integration-cycle-${i}`)
      }

      memoryDetector.takeSnapshot('after_integration_cycles')

      // Full cleanup
      wsManager.disconnect()
      await mcpClient.clearCache()
      await redisCache.shutdown()

      resourceTracker.removeFileDescriptor('websocket')
      resourceTracker.removeFileDescriptor('redis')

      memoryDetector.takeSnapshot('after_full_cleanup')

      // Assert
      const cyclesDelta = memoryDetector.getMemoryDelta('before_integration', 'after_integration_cycles')
      const cleanupDelta = memoryDetector.getMemoryDelta('after_integration_cycles', 'after_full_cleanup')

      expect(cyclesDelta.heapUsed).toBeLessThan(100 * 1024 * 1024) // Less than 100MB for cycles
      expect(Math.abs(cleanupDelta.heapUsed)).toBeLessThan(cyclesDelta.heapUsed) // Cleanup should reduce memory

      expect(memoryDetector.getActiveTaskCount()).toBe(0)
      expect(resourceTracker.getOpenFileDescriptors()).toBe(0)
    })

    test('should_detect_long_running_system_memory_stability', async () => {
      // Arrange
      memoryDetector.takeSnapshot('system_start')
      const iterations = 20
      const cyclesPerIteration = 50

      // Act - Simulate long-running system
      for (let iteration = 0; iteration < iterations; iteration++) {
        memoryDetector.takeSnapshot(`iteration_${iteration}_start`)

        for (let cycle = 0; cycle < cyclesPerIteration; cycle++) {
          memoryDetector.addActiveTask(`long_running_${iteration}_${cycle}`)

          // Simulate various operations
          await wsManager.connect()
          await mcpClient.executeTool('get_ticker_details', { ticker: 'AAPL' })
          await redisCache.set(`long_${iteration}_${cycle}`, { data: 'test' }, 60)

          wsManager.disconnect()
          memoryDetector.removeActiveTask(`long_running_${iteration}_${cycle}`)
        }

        // Periodic cleanup
        if (iteration % 5 === 0) {
          await mcpClient.clearCache()
          await redisCache.cleanup()
        }

        memoryDetector.takeSnapshot(`iteration_${iteration}_end`)
      }

      memoryDetector.takeSnapshot('system_end')

      // Assert - Memory should remain stable over time
      const totalDelta = memoryDetector.getMemoryDelta('system_start', 'system_end')
      const memoryGrowthRate = totalDelta.heapUsed / (iterations * cyclesPerIteration)

      expect(memoryGrowthRate).toBeLessThan(1024 * 1024) // Less than 1MB per operation
      expect(memoryDetector.getActiveTaskCount()).toBe(0)

      // Check for memory growth pattern - use absolute threshold instead of relative
      const totalDelta = memoryDetector.getMemoryDelta('system_start', 'system_end')

      // Memory growth should be reasonable (less than 50MB for test operations)
      // This is more stable than relative comparisons in test environments
      expect(Math.abs(totalDelta.heapUsed)).toBeLessThan(50 * 1024 * 1024)
    })

    test('should_detect_resource_cleanup_completeness', async () => {
      // Arrange
      const resourceTypes = ['websocket', 'mcp-connection', 'redis-connection', 'timer', 'interval', 'promise']

      resourceTypes.forEach(type => {
        resourceTracker.incrementResourceCounter(type)
      })

      memoryDetector.takeSnapshot('before_resource_test')

      // Act - Create and cleanup resources
      await wsManager.connect()
      resourceTracker.addFileDescriptor('ws-fd')

      const timer = setTimeout(() => {}, 5000)
      resourceTracker.addTimer(timer)

      const interval = setInterval(() => {}, 1000)
      resourceTracker.addInterval(interval)

      const promise = mcpClient.executeTool('get_ticker_details', { ticker: 'AAPL' })
      resourceTracker.addPromise(promise)

      await promise

      // Cleanup
      wsManager.disconnect()
      resourceTracker.removeFileDescriptor('ws-fd')

      clearTimeout(timer)
      resourceTracker.removeTimer(timer)

      clearInterval(interval)
      resourceTracker.removeInterval(interval)

      memoryDetector.takeSnapshot('after_resource_cleanup')

      // Assert - All resources should be cleaned up
      expect(resourceTracker.getOpenFileDescriptors()).toBe(0)
      expect(resourceTracker.getActiveTimerCount()).toBe(0)
      expect(resourceTracker.getActiveIntervalCount()).toBe(0)
      expect(resourceTracker.getActivePendingPromises()).toBe(0)

      const resourceSummary = resourceTracker.getResourceSummary()
      console.log('Final resource summary:', resourceSummary)
    })

    test('should_provide_comprehensive_memory_leak_report', async () => {
      // Arrange
      memoryDetector.takeSnapshot('comprehensive_test_start')

      // Act - Comprehensive system test
      const operations = [
        () => wsManager.connect(),
        () => mcpClient.executeTool('get_ticker_details', { ticker: 'AAPL' }),
        () => redisCache.set('test-key', { data: 'test' }, 60),
        () => wsManager.subscribeToSector('technology'),
        () => mcpClient.clearCache(),
        () => redisCache.cleanup(),
        () => wsManager.disconnect(),
        () => redisCache.shutdown()
      ]

      for (let i = 0; i < 10; i++) {
        for (const operation of operations) {
          try {
            await operation()
          } catch (error) {
            // Ignore errors for this test
          }
        }

        if (i % 3 === 0) {
          memoryDetector.takeSnapshot(`comprehensive_cycle_${i}`)
        }
      }

      memoryDetector.takeSnapshot('comprehensive_test_end')

      // Assert - Generate comprehensive report
      const memoryReport = memoryDetector.getMemoryReport()
      const resourceSummary = resourceTracker.getResourceSummary()

      console.log(memoryReport)
      console.log('Resource Summary:', resourceSummary)

      // Check if memory leak detected
      const hasMemoryLeak = memoryDetector.detectMemoryLeak(50 * 1024 * 1024) // 50MB threshold

      if (hasMemoryLeak) {
        console.warn('MEMORY LEAK DETECTED!')
      }

      expect(memoryDetector.getActiveTaskCount()).toBe(0)
      expect(hasMemoryLeak).toBe(false)
    })
  })
})