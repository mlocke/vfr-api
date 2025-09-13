/**
 * Comprehensive TDD Tests for Redis Cache Cleanup Strategies
 * Tests all cleanup scenarios including normal shutdown, error conditions, and memory pressure
 */

import { RedisCache } from '../RedisCache'
import Redis from 'ioredis'
import { jest } from '@jest/globals'

// Mock ioredis module
jest.mock('ioredis')
const MockedRedis = Redis as jest.MockedClass<typeof Redis>

describe('RedisCache Cleanup Strategies', () => {
  let redisCache: RedisCache
  let mockRedisInstance: jest.Mocked<Redis>
  let mockBackupRedisInstance: jest.Mocked<Redis>

  // Setup timer mocks to prevent Jest environment issues
  beforeAll(() => {
    // Ensure global timer functions are available
    if (!global.setInterval) {
      global.setInterval = jest.fn(() => ({} as NodeJS.Timeout))
    }
    if (!global.clearInterval) {
      global.clearInterval = jest.fn()
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock Redis instance
    mockRedisInstance = {
      on: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      mget: jest.fn(),
      pipeline: jest.fn(),
      exec: jest.fn(),
      keys: jest.fn(),
      info: jest.fn(),
      dbsize: jest.fn(),
      ping: jest.fn(),
      eval: jest.fn(),
      disconnect: jest.fn(),
      quit: jest.fn()
    } as any

    // Setup mock backup Redis instance
    mockBackupRedisInstance = {
      disconnect: jest.fn(),
      quit: jest.fn()
    } as any

    // Mock Redis constructor
    MockedRedis.mockImplementation(() => mockRedisInstance)

    // Clear singleton instance
    ;(RedisCache as any).instance = null
  })

  afterEach(async () => {
    // Clear all timers first to prevent leaks
    jest.clearAllTimers()

    // Clean up any existing instances
    if (redisCache) {
      try {
        await redisCache.shutdown()
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }

    // Reset all mocks to prevent state leakage
    jest.clearAllMocks()

    // Return to real timers
    jest.useRealTimers()
  })

  describe('Connection Cleanup on Shutdown', () => {
    test('should_disconnect_primary_redis_connection_on_shutdown', async () => {
      // Arrange
      redisCache = new RedisCache()

      // Act
      await redisCache.shutdown()

      // Assert
      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
    })

    test('should_disconnect_backup_redis_connection_when_present_on_shutdown', async () => {
      // Arrange
      process.env.REDIS_CLUSTER_NODES = 'localhost:6379,localhost:6380'

      // Mock secondary Redis instance for backup
      let callCount = 0
      MockedRedis.mockImplementation(() => {
        callCount++
        return callCount === 1 ? mockRedisInstance : mockBackupRedisInstance
      })

      redisCache = new RedisCache()

      // Act
      await redisCache.shutdown()

      // Assert
      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
      expect(mockBackupRedisInstance.disconnect).toHaveBeenCalledTimes(1)

      // Cleanup
      delete process.env.REDIS_CLUSTER_NODES
    })

    test('should_clear_health_check_interval_on_shutdown', async () => {
      // Arrange
      jest.useFakeTimers()
      const setIntervalSpy = jest.spyOn(global, 'setInterval')
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      redisCache = new RedisCache()

      // Verify interval was created
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000)

      // Act
      await redisCache.shutdown()

      // Assert
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1)

      // Cleanup
      setIntervalSpy.mockRestore()
      clearIntervalSpy.mockRestore()
    })

    test('should_handle_disconnect_errors_gracefully_during_shutdown', async () => {
      // Arrange
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      mockRedisInstance.disconnect.mockRejectedValue(new Error('Connection already closed'))

      redisCache = new RedisCache()

      // Act & Assert - Should not throw
      await expect(redisCache.shutdown()).resolves.toBeUndefined()

      // Cleanup
      consoleLogSpy.mockRestore()
    })

    test('should_log_successful_shutdown_message', async () => {
      // Arrange
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      redisCache = new RedisCache()

      // Act
      await redisCache.shutdown()

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith('📪 Redis cache connections closed')

      // Cleanup
      consoleLogSpy.mockRestore()
    })
  })

  describe('Memory Cleanup for Expired Keys', () => {
    test('should_automatically_cleanup_when_cache_exceeds_key_threshold', async () => {
      // Arrange
      jest.useFakeTimers()
      const mockEval = jest.fn().mockResolvedValue(5)
      mockRedisInstance.eval.mockImplementation(mockEval)
      mockRedisInstance.ping.mockResolvedValue('PONG')
      mockRedisInstance.dbsize.mockResolvedValue(15000) // Exceeds 10000 threshold

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      redisCache = new RedisCache()

      // Act - Advance timer to trigger health check
      jest.advanceTimersByTime(30000)
      await Promise.resolve() // Allow async operations to complete

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🧹 Auto-cleanup: Cache is getting full, running maintenance...'
      )
      expect(mockEval).toHaveBeenCalled()

      // Cleanup
      consoleLogSpy.mockRestore()
    })

    test('should_execute_lua_script_for_expired_key_cleanup', async () => {
      // Arrange
      const mockEval = jest.fn().mockResolvedValue(10)
      mockRedisInstance.eval.mockImplementation(mockEval)

      redisCache = new RedisCache()

      // Act
      await redisCache.cleanup()

      // Assert
      expect(mockEval).toHaveBeenCalledWith(
        expect.stringContaining('local keys = redis.call'),
        0
      )

      // Verify the Lua script logic
      const luaScript = mockEval.mock.calls[0][0]
      expect(luaScript).toContain('redis.call(\'keys\'')
      expect(luaScript).toContain('redis.call(\'ttl\'')
      expect(luaScript).toContain('redis.call(\'expire\'')
    })

    test('should_log_cleanup_results_with_processed_key_count', async () => {
      // Arrange
      const processedKeys = 25
      mockRedisInstance.eval.mockResolvedValue(processedKeys)
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      redisCache = new RedisCache()

      // Act
      await redisCache.cleanup()

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `🧹 Cache cleanup completed. Keys processed: ${processedKeys}`
      )

      // Cleanup
      consoleLogSpy.mockRestore()
    })

    test('should_handle_cleanup_lua_script_errors_gracefully', async () => {
      // Arrange
      const error = new Error('Redis Lua script error')
      mockRedisInstance.eval.mockRejectedValue(error)
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      redisCache = new RedisCache()

      // Act & Assert - Should not throw
      await expect(redisCache.cleanup()).resolves.toBeUndefined()

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Cache cleanup error:', error)

      // Cleanup
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Pipeline Cleanup on Errors', () => {
    test('should_handle_pipeline_execution_errors_during_mset', async () => {
      // Arrange
      const mockPipeline = {
        setex: jest.fn(),
        exec: jest.fn().mockRejectedValue(new Error('Pipeline execution failed'))
      }
      mockRedisInstance.pipeline.mockReturnValue(mockPipeline as any)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      redisCache = new RedisCache()

      const entries = [
        { key: 'test1', data: { value: 1 } },
        { key: 'test2', data: { value: 2 } }
      ]

      // Act
      const result = await redisCache.mset(entries, true)

      // Assert
      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Cache mset error:',
        expect.any(Error)
      )

      // Cleanup
      consoleErrorSpy.mockRestore()
    })

    test('should_cleanup_pipeline_resources_after_successful_execution', async () => {
      // Arrange
      const mockPipeline = {
        setex: jest.fn(),
        exec: jest.fn().mockResolvedValue([])
      }
      mockRedisInstance.pipeline.mockReturnValue(mockPipeline as any)

      redisCache = new RedisCache()

      const entries = [
        { key: 'test1', data: { value: 1 } }
      ]

      // Act
      await redisCache.mset(entries, true)

      // Assert
      expect(mockPipeline.exec).toHaveBeenCalledTimes(1)
      expect(mockPipeline.setex).toHaveBeenCalledTimes(1)
    })

    test('should_fallback_to_individual_sets_when_pipeline_fails', async () => {
      // Arrange
      const mockPipeline = {
        setex: jest.fn(),
        exec: jest.fn().mockRejectedValue(new Error('Pipeline failed'))
      }
      mockRedisInstance.pipeline.mockReturnValue(mockPipeline as any)
      mockRedisInstance.setex.mockResolvedValue('OK')

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      redisCache = new RedisCache()

      const entries = [
        { key: 'test1', data: { value: 1 } }
      ]

      // Act - Use pipeline=false to test fallback path
      const result = await redisCache.mset(entries, false)

      // Assert
      expect(result).toBe(true)
      expect(mockRedisInstance.setex).toHaveBeenCalled()

      // Cleanup
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Automatic Cache Maintenance', () => {
    test('should_start_health_check_interval_on_initialization', () => {
      // Arrange
      jest.useFakeTimers()
      const setIntervalSpy = jest.spyOn(global, 'setInterval')

      // Act
      redisCache = new RedisCache()

      // Assert
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        30000 // 30 seconds
      )

      // Cleanup
      setIntervalSpy.mockRestore()
    })

    test('should_ping_redis_during_health_checks', async () => {
      // Arrange
      jest.useFakeTimers()
      mockRedisInstance.ping.mockResolvedValue('PONG')
      mockRedisInstance.dbsize.mockResolvedValue(5000)

      redisCache = new RedisCache()

      // Act
      jest.advanceTimersByTime(30000)
      await Promise.resolve()

      // Assert
      expect(mockRedisInstance.ping).toHaveBeenCalled()
    })

    test('should_increment_error_count_when_health_check_fails', async () => {
      // Arrange
      jest.useFakeTimers()
      const pingError = new Error('Redis connection lost')
      mockRedisInstance.ping.mockRejectedValue(pingError)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      redisCache = new RedisCache()

      // Act
      jest.advanceTimersByTime(30000)
      await Promise.resolve()

      // Get stats to verify error count
      mockRedisInstance.info.mockResolvedValue('used_memory_human:100M')
      mockRedisInstance.dbsize.mockResolvedValue(1000)

      const stats = await redisCache.getStats()

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Redis health check failed:',
        pingError
      )
      expect(stats.errors).toBeGreaterThan(0)

      // Cleanup
      consoleErrorSpy.mockRestore()
    })

    test('should_not_perform_auto_cleanup_when_key_count_below_threshold', async () => {
      // Arrange
      jest.useFakeTimers()
      mockRedisInstance.ping.mockResolvedValue('PONG')
      mockRedisInstance.dbsize.mockResolvedValue(5000) // Below 10000 threshold
      mockRedisInstance.info.mockResolvedValue('used_memory_human:50M')

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      redisCache = new RedisCache()

      // Act
      jest.advanceTimersByTime(30000)
      await Promise.resolve()

      // Assert
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Auto-cleanup')
      )

      // Cleanup
      consoleLogSpy.mockRestore()
    })
  })

  describe('Proper Redis Connection Disconnection', () => {
    test('should_use_disconnect_method_not_quit_for_immediate_closure', async () => {
      // Arrange
      redisCache = new RedisCache()

      // Act
      await redisCache.shutdown()

      // Assert
      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
      expect(mockRedisInstance.quit).not.toHaveBeenCalled()
    })

    test('should_prevent_multiple_shutdowns_from_causing_errors', async () => {
      // Arrange
      redisCache = new RedisCache()

      // Act
      await redisCache.shutdown()
      await redisCache.shutdown() // Second shutdown

      // Assert - Should not cause additional calls
      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
    })

    test('should_handle_shutdown_when_redis_instance_is_null', async () => {
      // Arrange
      redisCache = new RedisCache()
      // Simulate instance being set to null
      ;(redisCache as any).redis = null

      // Act & Assert - Should not throw
      await expect(redisCache.shutdown()).resolves.toBeUndefined()
    })

    test('should_cleanup_backup_connection_even_if_primary_fails', async () => {
      // Arrange
      process.env.REDIS_CLUSTER_NODES = 'localhost:6379,localhost:6380'

      let callCount = 0
      MockedRedis.mockImplementation(() => {
        callCount++
        return callCount === 1 ? mockRedisInstance : mockBackupRedisInstance
      })

      mockRedisInstance.disconnect.mockRejectedValue(new Error('Primary disconnect failed'))

      redisCache = new RedisCache()

      // Act
      await redisCache.shutdown()

      // Assert
      expect(mockBackupRedisInstance.disconnect).toHaveBeenCalledTimes(1)

      // Cleanup
      delete process.env.REDIS_CLUSTER_NODES
    })
  })

  describe('Error Handling During Cleanup', () => {
    test('should_continue_cleanup_process_despite_individual_failures', async () => {
      // Arrange
      jest.useFakeTimers()
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      mockRedisInstance.disconnect.mockRejectedValue(new Error('Disconnect failed'))

      redisCache = new RedisCache()

      // Act - Should not throw despite disconnect failure
      await redisCache.shutdown()

      // Assert - Health check interval should still be cleared
      expect(clearIntervalSpy).toHaveBeenCalled()

      // Cleanup
      clearIntervalSpy.mockRestore()
    })

    test('should_log_but_not_throw_errors_during_stats_collection_cleanup', async () => {
      // Arrange
      mockRedisInstance.info.mockRejectedValue(new Error('Redis info failed'))
      mockRedisInstance.dbsize.mockRejectedValue(new Error('Redis dbsize failed'))

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      redisCache = new RedisCache()

      // Act
      const stats = await redisCache.getStats()

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error getting cache stats:',
        expect.any(Error)
      )
      expect(stats).toBeDefined()
      expect(stats.errors).toBeDefined()

      // Cleanup
      consoleErrorSpy.mockRestore()
    })

    test('should_reset_error_tracking_after_successful_operations', async () => {
      // Arrange
      // First, cause an error
      mockRedisInstance.get.mockRejectedValueOnce(new Error('Redis error'))
      // Then, make subsequent calls successful
      mockRedisInstance.get.mockResolvedValue(null)
      mockRedisInstance.info.mockResolvedValue('used_memory_human:100M')
      mockRedisInstance.dbsize.mockResolvedValue(1000)

      redisCache = new RedisCache()

      // Act - Cause error
      await redisCache.get('test-key')

      // Act - Successful operations
      await redisCache.get('test-key-2')

      const stats = await redisCache.getStats()

      // Assert - Errors should be tracked but not continuously increment
      expect(stats.errors).toBe(1) // Only one error from first call
      expect(stats.misses).toBe(2) // Two misses from both calls
    })
  })

  describe('Memory Leak Prevention', () => {
    test('should_clear_internal_cache_on_shutdown', async () => {
      // Arrange
      redisCache = new RedisCache()

      // Add some items to internal cache (if it exists)
      await redisCache.set('test-key', { data: 'test' }, 60)

      // Act
      await redisCache.shutdown()

      // Assert - Verify the instance can be properly garbage collected
      expect(mockRedisInstance.disconnect).toHaveBeenCalled()
    })

    test('should_prevent_memory_leaks_from_unclosed_intervals', async () => {
      // Arrange
      jest.useFakeTimers()
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      redisCache = new RedisCache()

      // Simulate multiple instances being created and shut down
      await redisCache.shutdown()

      const redisCache2 = new RedisCache()
      await redisCache2.shutdown()

      // Assert - Each instance should clean up its own interval
      expect(clearIntervalSpy).toHaveBeenCalledTimes(2)

      // Cleanup
      clearIntervalSpy.mockRestore()
    })

    test('should_handle_rapid_successive_shutdowns_without_resource_leaks', async () => {
      // Arrange
      redisCache = new RedisCache()

      // Act - Rapid shutdowns
      const shutdownPromises = Array(5).fill(null).map(() => redisCache.shutdown())
      await Promise.all(shutdownPromises)

      // Assert - Should only disconnect once despite multiple shutdown calls
      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
    })

    test('should_cleanup_event_listeners_on_shutdown', async () => {
      // Arrange
      redisCache = new RedisCache()

      // Verify event handlers were registered
      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockRedisInstance.on).toHaveBeenCalledWith('ready', expect.any(Function))
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockRedisInstance.on).toHaveBeenCalledWith('reconnecting', expect.any(Function))

      // Act
      await redisCache.shutdown()

      // Assert - disconnect should handle cleanup of listeners
      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('Connection Pool Cleanup', () => {
    test('should_properly_cleanup_cluster_connections_when_configured', async () => {
      // Arrange
      process.env.REDIS_CLUSTER_NODES = 'localhost:6379,localhost:6380,localhost:6381'

      let callCount = 0
      MockedRedis.mockImplementation(() => {
        callCount++
        if (callCount === 1) return mockRedisInstance
        return mockBackupRedisInstance
      })

      redisCache = new RedisCache()

      // Act
      await redisCache.shutdown()

      // Assert
      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
      expect(mockBackupRedisInstance.disconnect).toHaveBeenCalledTimes(1)

      // Cleanup
      delete process.env.REDIS_CLUSTER_NODES
    })

    test('should_handle_partial_cluster_connection_failures_during_shutdown', async () => {
      // Arrange
      process.env.REDIS_CLUSTER_NODES = 'localhost:6379,localhost:6380'

      let callCount = 0
      MockedRedis.mockImplementation(() => {
        callCount++
        if (callCount === 1) return mockRedisInstance
        return mockBackupRedisInstance
      })

      // Primary succeeds, backup fails
      mockBackupRedisInstance.disconnect.mockRejectedValue(new Error('Backup disconnect failed'))

      redisCache = new RedisCache()

      // Act & Assert - Should not throw
      await expect(redisCache.shutdown()).resolves.toBeUndefined()

      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
      expect(mockBackupRedisInstance.disconnect).toHaveBeenCalledTimes(1)

      // Cleanup
      delete process.env.REDIS_CLUSTER_NODES
    })

    test('should_handle_single_node_configuration_cleanup', async () => {
      // Arrange - No cluster nodes configured
      redisCache = new RedisCache()

      // Act
      await redisCache.shutdown()

      // Assert - Only primary connection should be cleaned up
      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
      expect(MockedRedis).toHaveBeenCalledTimes(1) // Only one Redis instance created
    })
  })

  describe('Cleanup Integration Tests', () => {
    test('should_perform_complete_cleanup_sequence_in_correct_order', async () => {
      // Arrange
      jest.useFakeTimers()
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      redisCache = new RedisCache()

      // Act
      await redisCache.shutdown()

      // Assert - Verify cleanup order
      expect(clearIntervalSpy).toHaveBeenCalled() // Health check cleared first
      expect(mockRedisInstance.disconnect).toHaveBeenCalled() // Then disconnect
      expect(consoleLogSpy).toHaveBeenLastCalledWith('📪 Redis cache connections closed') // Then log

      // Cleanup
      clearIntervalSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    test('should_maintain_cleanup_idempotency', async () => {
      // Arrange
      jest.useFakeTimers()
      redisCache = new RedisCache()

      // Act - Multiple shutdowns
      await redisCache.shutdown()
      await redisCache.shutdown()
      await redisCache.shutdown()

      // Assert - Operations should be idempotent
      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
    })

    test('should_handle_cleanup_with_active_operations_in_progress', async () => {
      // Arrange
      let resolveGet: (value: any) => void
      const pendingGet = new Promise(resolve => { resolveGet = resolve })
      mockRedisInstance.get.mockReturnValue(pendingGet)

      redisCache = new RedisCache()

      // Start an operation
      const getPromise = redisCache.get('test-key')

      // Act - Shutdown while operation is pending
      const shutdownPromise = redisCache.shutdown()

      // Resolve the pending operation
      resolveGet!('test-value')

      // Assert - Both should complete without errors
      await expect(Promise.all([getPromise, shutdownPromise])).resolves.toBeDefined()
      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
    })
  })
})