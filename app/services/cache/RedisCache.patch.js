/**
 * Cache Health Check Patch
 * Adds missing ping method to RedisCache for health checks
 */

// Add ping method to RedisCache prototype if it doesn't exist
const { RedisCache } = require('../app/services/cache/RedisCache');

if (RedisCache.prototype && !RedisCache.prototype.ping) {
  RedisCache.prototype.ping = async function() {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping failed:', error);
      return false;
    }
  };

  console.log('✅ Added ping method to RedisCache');
}

module.exports = { RedisCache };
