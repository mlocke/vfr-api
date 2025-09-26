/**
 * Simple Cache Implementation - KISS principles
 * Replaces complex hierarchical caching with basic Redis + memory
 */

export class SimpleCache {
  private memoryCache = new Map<string, { data: any; expires: number }>()
  private maxMemoryItems = 1000
  private defaultTTL = 300 // 5 minutes

  /**
   * Get data from cache (memory first, then Redis fallback)
   */
  async get<T = any>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryItem = this.memoryCache.get(key)
    if (memoryItem && memoryItem.expires > Date.now()) {
      return memoryItem.data
    }

    // Clean up expired memory item
    if (memoryItem) {
      this.memoryCache.delete(key)
    }

    // TODO: Add Redis fallback when redisCache is simplified
    // For now, return null if not in memory
    return null
  }

  /**
   * Set data in cache (both memory and Redis)
   */
  async set(key: string, data: any, ttlSeconds = this.defaultTTL): Promise<void> {
    const expires = Date.now() + (ttlSeconds * 1000)

    // Store in memory cache
    this.memoryCache.set(key, { data, expires })

    // Clean up memory cache if too large
    if (this.memoryCache.size > this.maxMemoryItems) {
      this.cleanupMemoryCache()
    }

    // TODO: Store in Redis when redisCache is simplified
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key)
    // TODO: Delete from Redis when available
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()
    // TODO: Clear Redis when available
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now()
    let validItems = 0
    let expiredItems = 0

    for (const [, item] of Array.from(this.memoryCache)) {
      if (item.expires > now) {
        validItems++
      } else {
        expiredItems++
      }
    }

    return {
      memoryItems: this.memoryCache.size,
      validItems,
      expiredItems,
      hitRate: validItems / (validItems + expiredItems) || 0
    }
  }

  /**
   * Clean up expired items from memory cache
   */
  private cleanupMemoryCache(): void {
    const now = Date.now()
    const toDelete: string[] = []

    for (const [key, item] of Array.from(this.memoryCache)) {
      if (item.expires <= now) {
        toDelete.push(key)
      }
    }

    // Remove expired items
    toDelete.forEach(key => this.memoryCache.delete(key))

    // If still too large, remove oldest items
    if (this.memoryCache.size > this.maxMemoryItems) {
      const entries = Array.from(this.memoryCache.entries())
      entries.sort((a, b) => a[1].expires - b[1].expires)

      const itemsToRemove = this.memoryCache.size - this.maxMemoryItems + 100 // Remove extra buffer
      for (let i = 0; i < itemsToRemove && i < entries.length; i++) {
        this.memoryCache.delete(entries[i][0])
      }
    }
  }
}

// Simple singleton instance
export const simpleCache = new SimpleCache()