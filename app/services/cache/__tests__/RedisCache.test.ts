/**
 * Unit tests for Redis Cache Service
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { RedisCache } from '../RedisCache'

// Mock Redis client
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    mget: jest.fn(),
    keys: jest.fn(),
    dbsize: jest.fn(),
    info: jest.fn(),
    ping: jest.fn(),
    pipeline: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    eval: jest.fn()
  }

  const mockPipeline = {
    setex: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([])
  }

  mockRedis.pipeline.mockReturnValue(mockPipeline)

  return jest.fn(() => mockRedis)
})

describe('RedisCache', () => {
  let cache: RedisCache
  let mockRedis: any

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()

    cache = new RedisCache({
      host: 'localhost',
      port: 6379,
      keyPrefix: 'test:',
      defaultTTL: 300
    })

    // Get the mocked Redis instance
    const Redis = require('ioredis')
    mockRedis = new Redis()
  })

  afterEach(async () => {
    await cache.shutdown()
  })

  describe('Basic Cache Operations', () => {
    it('should get data from cache', async () => {
      const testData = { price: 150.50, volume: 1000000 }
      const cacheEntry = JSON.stringify({
        data: testData,
        timestamp: Date.now(),
        ttl: 300,
        source: 'test',
        version: '1.0.0'
      })

      mockRedis.get.mockResolvedValue(cacheEntry)

      const result = await cache.get('test-key')

      expect(mockRedis.get).toHaveBeenCalledWith('test-key')
      expect(result).toEqual(testData)
    })

    it('should return null for cache miss', async () => {
      mockRedis.get.mockResolvedValue(null)

      const result = await cache.get('missing-key')

      expect(result).toBeNull()
    })

    it('should return null for expired data', async () => {
      const expiredEntry = JSON.stringify({
        data: { price: 150 },
        timestamp: Date.now() - 400000, // 400 seconds ago
        ttl: 300, // 300 second TTL
        source: 'test',
        version: '1.0.0'
      })

      mockRedis.get.mockResolvedValue(expiredEntry)
      mockRedis.del.mockResolvedValue(1)

      const result = await cache.get('expired-key')

      expect(result).toBeNull()
      expect(mockRedis.del).toHaveBeenCalledWith('expired-key')
    })

    it('should set data in cache with TTL', async () => {
      const testData = { price: 150.50 }
      mockRedis.setex.mockResolvedValue('OK')

      const success = await cache.set('test-key', testData, 600, {
        source: 'test',
        version: '1.0.0'
      })

      expect(success).toBe(true)
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        600,
        expect.stringContaining('"price":150.5')
      )
    })

    it('should delete data from cache', async () => {
      mockRedis.del.mockResolvedValue(1)

      const success = await cache.delete('test-key')

      expect(success).toBe(true)
      expect(mockRedis.del).toHaveBeenCalledWith('test-key')
    })
  })

  describe('Multi-Key Operations', () => {
    it('should get multiple keys in parallel', async () => {
      const data1 = JSON.stringify({
        data: { price: 150 },
        timestamp: Date.now(),
        ttl: 300,
        source: 'test',
        version: '1.0.0'
      })

      const data2 = JSON.stringify({
        data: { price: 200 },
        timestamp: Date.now(),
        ttl: 300,
        source: 'test',
        version: '1.0.0'
      })

      mockRedis.mget.mockResolvedValue([data1, data2, null])

      const result = await cache.mget(['key1', 'key2', 'key3'])

      expect(result).toEqual({
        key1: { price: 150 },
        key2: { price: 200 },
        key3: null
      })
    })

    it('should set multiple keys with pipeline', async () => {
      const entries = [
        { key: 'key1', data: { price: 150 }, ttl: 300 },
        { key: 'key2', data: { price: 200 }, ttl: 400 }
      ]

      const mockPipeline = mockRedis.pipeline()
      mockPipeline.exec.mockResolvedValue([])

      const success = await cache.mset(entries, true)

      expect(success).toBe(true)
      expect(mockPipeline.setex).toHaveBeenCalledTimes(2)
      expect(mockPipeline.exec).toHaveBeenCalled()
    })
  })

  describe('Financial Data Caching', () => {
    it('should cache stock price with source metadata', async () => {
      const stockData = { open: 150, close: 151, volume: 1000000 }
      mockRedis.setex.mockResolvedValue('OK')

      await cache.cacheStockPrice('AAPL', stockData, 'polygon', 60)

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'stock:price:AAPL:polygon',
        60,
        expect.stringContaining('"source":"polygon"')
      )
    })

    it('should get cached stock price with fallback sources', async () => {
      const polygonData = JSON.stringify({
        data: { price: 150.50 },
        timestamp: Date.now(),
        ttl: 60,
        source: 'polygon',
        version: '1.0.0'
      })

      mockRedis.mget.mockResolvedValue([polygonData, null, null])

      const result = await cache.getCachedStockPrice('AAPL', ['polygon', 'alphavantage', 'yahoo'])

      expect(result).toEqual({ price: 150.50 })
      expect(mockRedis.mget).toHaveBeenCalledWith(
        'stock:price:AAPL:polygon',
        'stock:price:AAPL:alphavantage',
        'stock:price:AAPL:yahoo'
      )
    })

    it('should use different TTL for market hours', async () => {
      // Mock market hours (Monday 10 AM)
      const marketHourDate = new Date('2023-10-16T14:00:00Z') // UTC time for 10 AM EST
      const originalDate = global.Date

      // Mock the Date constructor to return our market hour date
      global.Date = jest.fn(() => marketHourDate) as any
      global.Date.now = jest.fn(() => marketHourDate.getTime())

      mockRedis.setex.mockResolvedValue('OK')

      await cache.cacheMarketData('quotes', 'AAPL', { price: 150 }, 'polygon')

      // Should use shorter TTL (30s) during market hours
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'market:quotes:AAPL:polygon',
        30,
        expect.any(String)
      )

      // Restore Date
      global.Date = originalDate
    })
  })

  describe('Cache Management', () => {
    it('should invalidate cache by pattern', async () => {
      mockRedis.keys.mockResolvedValue(['test:key1', 'test:key2', 'test:key3'])
      mockRedis.del.mockResolvedValue(3)

      const deletedCount = await cache.invalidatePattern('key*')

      expect(deletedCount).toBe(3)
      expect(mockRedis.keys).toHaveBeenCalledWith('test:key*')
      expect(mockRedis.del).toHaveBeenCalledWith('test:key1', 'test:key2', 'test:key3')
    })

    it('should warm cache for multiple symbols', async () => {
      const symbols = ['AAPL', 'MSFT']
      const sources = ['polygon', 'alphavantage']

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await cache.warmCache(symbols, sources)

      // Should log warming messages for each symbol-source combination
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should get cache statistics', async () => {
      mockRedis.info.mockResolvedValue('used_memory_human:1.5M\nother_stats:value')
      mockRedis.dbsize.mockResolvedValue(1234)

      const stats = await cache.getStats()

      expect(stats.memoryUsage).toBe('1.5M')
      expect(stats.totalKeys).toBe(1234)
      expect(stats.hitRate).toBeDefined()
      expect(stats.hits).toBeDefined()
      expect(stats.misses).toBeDefined()
    })

    it('should perform cleanup of expired keys', async () => {
      mockRedis.eval.mockResolvedValue(5)

      await cache.cleanup()

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        0
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))

      const result = await cache.get('test-key')

      expect(result).toBeNull()
    })

    it('should handle set operation failures', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis write failed'))

      const success = await cache.set('test-key', { data: 'test' })

      expect(success).toBe(false)
    })

    it('should handle delete operation failures', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis delete failed'))

      const success = await cache.delete('test-key')

      expect(success).toBe(false)
    })
  })

  describe('Performance Tracking', () => {
    it('should track hit and miss rates', async () => {
      const now = 1696579200000 // Fixed timestamp
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now)

      // Simulate hits
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        data: { price: 150 },
        timestamp: now,
        ttl: 300,
        source: 'test',
        version: '1.0.0'
      }))

      await cache.get('hit-key')

      // Simulate miss
      mockRedis.get.mockResolvedValueOnce(null)
      await cache.get('miss-key')

      const initialStats = await cache.getStats()
      expect(initialStats.hits).toBe(1)
      expect(initialStats.misses).toBe(1)
      expect(initialStats.hitRate).toBe(50)

      dateSpy.mockRestore()
    })

    it('should track cache operations counts', async () => {
      mockRedis.setex.mockResolvedValue('OK')
      mockRedis.del.mockResolvedValue(1)

      await cache.set('test-key', { data: 'test' })
      await cache.delete('test-key')

      const stats = await cache.getStats()
      expect(stats.sets).toBe(1)
      expect(stats.deletes).toBe(1)
    })
  })
})