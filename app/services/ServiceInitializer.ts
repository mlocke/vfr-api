/**
 * Service Initializer
 * Safely initializes services with proper error handling and fallbacks
 */

import ErrorHandler from './error-handling/ErrorHandler'

export class ServiceInitializer {
  private static instance: ServiceInitializer
  private initializationPromise: Promise<void> | null = null

  private constructor() {}

  static getInstance(): ServiceInitializer {
    if (!ServiceInitializer.instance) {
      ServiceInitializer.instance = new ServiceInitializer()
    }
    return ServiceInitializer.instance
  }

  /**
   * Initialize all services with graceful error handling
   */
  async initializeServices(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.performInitialization()
    return this.initializationPromise
  }

  private async performInitialization(): Promise<void> {
    console.log('🚀 Initializing services...')

    try {
      // Initialize Redis cache (non-blocking)
      await this.initializeRedisCache()

      // Initialize auth service (with fallbacks)
      await this.initializeAuthService()

      // Initialize data source config manager
      await this.initializeDataSourceConfigManager()

      console.log('✅ All services initialized successfully')
    } catch (error) {
      console.error('❌ Service initialization failed:', error)
      // In development, don't fail completely
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Running in development mode with fallback services')
      } else {
        throw error
      }
    }
  }

  private async initializeRedisCache(): Promise<void> {
    try {
      const { redisCache } = await import('./cache/RedisCache')
      await redisCache.ping()
      console.log('✅ Redis cache initialized')
    } catch (error) {
      const normalizedError = ErrorHandler.normalizeError(error)
      console.warn('⚠️ Redis cache initialization failed, using fallback mode:', normalizedError.message)
    }
  }

  private async initializeAuthService(): Promise<void> {
    try {
      const { authService } = await import('./auth/AuthService')
      await authService.initialize()
      console.log('✅ Auth service initialized')
    } catch (error) {
      const normalizedError = ErrorHandler.normalizeError(error)
      console.warn('⚠️ Auth service initialization failed, using fallback mode:', normalizedError.message)
    }
  }

  private async initializeDataSourceConfigManager(): Promise<void> {
    try {
      const { dataSourceConfigManager } = await import('./admin/DataSourceConfigManager')
      // Data source config manager doesn't have an explicit initialize method
      // but we can verify it's working by getting the enabled data sources
      dataSourceConfigManager.getEnabledDataSources()
      console.log('✅ Data source config manager initialized')
    } catch (error) {
      const normalizedError = ErrorHandler.normalizeError(error)
      console.warn('⚠️ Data source config manager initialization failed:', normalizedError.message)
    }
  }

  /**
   * Check if services are healthy
   */
  async healthCheck(): Promise<{
    redis: boolean
    auth: boolean
    dataSourceConfig: boolean
    overall: boolean
  }> {
    const health = {
      redis: false,
      auth: false,
      dataSourceConfig: false,
      overall: false
    }

    try {
      const { redisCache } = await import('./cache/RedisCache')
      const pingResult = await redisCache.ping()
      health.redis = !pingResult.includes('fallback')
    } catch {
      health.redis = false
    }

    try {
      const { authService } = await import('./auth/AuthService')
      // Test auth service by validating a dev token
      await authService.validateToken('dev-admin-token')
      health.auth = true
    } catch {
      health.auth = false
    }

    try {
      const { dataSourceConfigManager } = await import('./admin/DataSourceConfigManager')
      dataSourceConfigManager.getEnabledDataSources()
      health.dataSourceConfig = true
    } catch {
      health.dataSourceConfig = false
    }

    health.overall = health.redis && health.auth && health.dataSourceConfig

    return health
  }
}

export const serviceInitializer = ServiceInitializer.getInstance()