/**
 * Retry Handler Utility
 * Provides standardized retry mechanisms for API calls across financial data services
 * Built on KISS principles with configurable retry strategies
 */

import { ErrorType, ErrorCode } from './ErrorHandler'
import TimeoutHandler from './TimeoutHandler'

export enum RetryStrategy {
  NONE = 'NONE',
  FIXED = 'FIXED',
  EXPONENTIAL = 'EXPONENTIAL',
  LINEAR = 'LINEAR',
  CUSTOM = 'CUSTOM'
}

export interface RetryConfig {
  maxAttempts: number
  strategy: RetryStrategy
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitter: boolean
  retryableErrors: (ErrorType | ErrorCode)[]
  shouldRetry?: (error: any, attempt: number) => boolean
  onRetry?: (error: any, attempt: number, nextDelay: number) => void
}

export interface RetryOptions {
  timeout?: number
  signal?: AbortSignal
  context?: string
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: any
  attempts: number
  totalTime: number
  retryHistory: RetryAttempt[]
}

export interface RetryAttempt {
  attempt: number
  timestamp: number
  error?: any
  delay: number
  success: boolean
}

export class RetryHandler {
  private static instance: RetryHandler
  private defaultConfig: RetryConfig
  private timeoutHandler: TimeoutHandler

  private constructor(config?: Partial<RetryConfig>) {
    this.timeoutHandler = TimeoutHandler.getInstance()
    this.defaultConfig = {
      maxAttempts: 3,
      strategy: RetryStrategy.EXPONENTIAL,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        ErrorType.TIMEOUT_ERROR,
        ErrorType.NETWORK_ERROR,
        ErrorType.RATE_LIMIT_ERROR,
        ErrorType.API_ERROR,
        ErrorCode.CONNECTION_TIMEOUT,
        ErrorCode.REQUEST_TIMEOUT,
        ErrorCode.NETWORK_UNAVAILABLE,
        ErrorCode.API_UNAVAILABLE,
        ErrorCode.RATE_LIMIT_EXCEEDED
      ],
      ...config
    }
  }

  public static getInstance(config?: Partial<RetryConfig>): RetryHandler {
    if (!RetryHandler.instance) {
      RetryHandler.instance = new RetryHandler(config)
    }
    return RetryHandler.instance
  }

  /**
   * Execute operation with retry logic
   */
  public async execute<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>,
    options?: RetryOptions
  ): Promise<RetryResult<T>> {
    const retryConfig = { ...this.defaultConfig, ...config }
    const startTime = Date.now()
    const retryHistory: RetryAttempt[] = []

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      const attemptStart = Date.now()

      try {
        // Apply timeout if specified
        const result = options?.timeout
          ? await this.timeoutHandler.withTimeout(operation(), options.timeout, options.signal)
          : await operation()

        // Success
        retryHistory.push({
          attempt,
          timestamp: attemptStart,
          delay: 0,
          success: true
        })

        return {
          success: true,
          data: result,
          attempts: attempt,
          totalTime: Date.now() - startTime,
          retryHistory
        }
      } catch (error) {
        const isLastAttempt = attempt === retryConfig.maxAttempts
        const shouldRetry = !isLastAttempt && this.shouldRetryError(error, attempt, retryConfig)

        // Calculate next delay
        const nextDelay = shouldRetry ? this.calculateDelay(attempt, retryConfig) : 0

        // Record attempt
        retryHistory.push({
          attempt,
          timestamp: attemptStart,
          error: this.sanitizeError(error),
          delay: nextDelay,
          success: false
        })

        // Check if we should stop retrying
        if (!shouldRetry) {
          return {
            success: false,
            error,
            attempts: attempt,
            totalTime: Date.now() - startTime,
            retryHistory
          }
        }

        // Call retry callback if provided
        if (retryConfig.onRetry) {
          retryConfig.onRetry(error, attempt, nextDelay)
        }

        // Wait before next attempt
        await this.delay(nextDelay)

        // Check if operation was aborted during delay
        if (options?.signal?.aborted) {
          return {
            success: false,
            error: new Error('Operation aborted during retry'),
            attempts: attempt,
            totalTime: Date.now() - startTime,
            retryHistory
          }
        }
      }
    }

    // This should never be reached, but included for completeness
    return {
      success: false,
      error: new Error('Maximum retry attempts reached'),
      attempts: retryConfig.maxAttempts,
      totalTime: Date.now() - startTime,
      retryHistory
    }
  }

  /**
   * Execute multiple operations with retry logic in parallel
   */
  public async executeParallel<T>(
    operations: (() => Promise<T>)[],
    config?: Partial<RetryConfig>,
    options?: RetryOptions
  ): Promise<RetryResult<T>[]> {
    const promises = operations.map(operation =>
      this.execute(operation, config, options)
    )

    return Promise.all(promises)
  }

  /**
   * Execute multiple operations with retry logic, settling all
   */
  public async executeAllSettled<T>(
    operations: (() => Promise<T>)[],
    config?: Partial<RetryConfig>,
    options?: RetryOptions
  ): Promise<RetryResult<T>[]> {
    const promises = operations.map(operation =>
      this.execute(operation, config, options)
    )

    const results = await Promise.allSettled(promises)
    return results.map(result =>
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: result.reason,
        attempts: 1,
        totalTime: 0,
        retryHistory: []
      }
    )
  }

  /**
   * Execute operation with exponential backoff
   */
  public async withExponentialBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000,
    options?: RetryOptions
  ): Promise<T> {
    const result = await this.execute(operation, {
      maxAttempts,
      strategy: RetryStrategy.EXPONENTIAL,
      baseDelay
    }, options)

    if (result.success) {
      return result.data!
    }

    throw result.error
  }

  /**
   * Execute operation with linear backoff
   */
  public async withLinearBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000,
    options?: RetryOptions
  ): Promise<T> {
    const result = await this.execute(operation, {
      maxAttempts,
      strategy: RetryStrategy.LINEAR,
      baseDelay
    }, options)

    if (result.success) {
      return result.data!
    }

    throw result.error
  }

  /**
   * Execute operation with fixed delay
   */
  public async withFixedDelay<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000,
    options?: RetryOptions
  ): Promise<T> {
    const result = await this.execute(operation, {
      maxAttempts,
      strategy: RetryStrategy.FIXED,
      baseDelay: delay
    }, options)

    if (result.success) {
      return result.data!
    }

    throw result.error
  }

  /**
   * Create retry configuration for API calls
   */
  public createApiRetryConfig(maxAttempts: number = 3): RetryConfig {
    return {
      maxAttempts,
      strategy: RetryStrategy.EXPONENTIAL,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        ErrorType.TIMEOUT_ERROR,
        ErrorType.NETWORK_ERROR,
        ErrorType.RATE_LIMIT_ERROR,
        ErrorCode.CONNECTION_TIMEOUT,
        ErrorCode.REQUEST_TIMEOUT,
        ErrorCode.NETWORK_UNAVAILABLE,
        ErrorCode.RATE_LIMIT_EXCEEDED
      ]
    }
  }

  /**
   * Create retry configuration for critical operations
   */
  public createCriticalRetryConfig(): RetryConfig {
    return {
      maxAttempts: 5,
      strategy: RetryStrategy.EXPONENTIAL,
      baseDelay: 2000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        ErrorType.TIMEOUT_ERROR,
        ErrorType.NETWORK_ERROR,
        ErrorType.RATE_LIMIT_ERROR,
        ErrorType.API_ERROR
      ]
    }
  }

  /**
   * Create retry configuration for fast operations
   */
  public createFastRetryConfig(): RetryConfig {
    return {
      maxAttempts: 2,
      strategy: RetryStrategy.FIXED,
      baseDelay: 500,
      maxDelay: 2000,
      backoffMultiplier: 1,
      jitter: false,
      retryableErrors: [
        ErrorType.TIMEOUT_ERROR,
        ErrorType.NETWORK_ERROR
      ]
    }
  }

  /**
   * Update default retry configuration
   */
  public updateDefaultConfig(config: Partial<RetryConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config }
  }

  /**
   * Get current default configuration
   */
  public getDefaultConfig(): RetryConfig {
    return { ...this.defaultConfig }
  }

  // Private helper methods

  private shouldRetryError(error: any, attempt: number, config: RetryConfig): boolean {
    // Use custom shouldRetry function if provided
    if (config.shouldRetry) {
      return config.shouldRetry(error, attempt)
    }

    // Check if error is in retryable list
    if (error && typeof error === 'object') {
      if (error.type && config.retryableErrors.includes(error.type)) {
        return true
      }
      if (error.code && config.retryableErrors.includes(error.code)) {
        return true
      }
    }

    // Check error message for retryable patterns
    const message = this.extractErrorMessage(error).toLowerCase()
    const retryablePatterns = [
      'timeout',
      'etimedout',
      'econnrefused',
      'enotfound',
      'network',
      'rate limit',
      '429',
      '502',
      '503',
      '504'
    ]

    return retryablePatterns.some(pattern => message.includes(pattern))
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number

    switch (config.strategy) {
      case RetryStrategy.FIXED:
        delay = config.baseDelay
        break

      case RetryStrategy.LINEAR:
        delay = config.baseDelay * attempt
        break

      case RetryStrategy.EXPONENTIAL:
        delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)
        break

      default:
        delay = config.baseDelay
    }

    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelay)

    // Apply jitter if enabled
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5) // 50-100% of calculated delay
    }

    return Math.floor(delay)
  }

  private extractErrorMessage(error: any): string {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    if (error && typeof error === 'object' && error.message) {
      return error.message
    }
    return 'Unknown error'
  }

  private sanitizeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message
      }
    }
    if (typeof error === 'string') {
      return { message: error }
    }
    if (error && typeof error === 'object') {
      return {
        ...error,
        stack: undefined // Remove stack trace for storage
      }
    }
    return error
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export class and getInstance method
export default RetryHandler

// Export predefined configurations
export const RETRY_CONFIGS = {
  API_STANDARD: {
    maxAttempts: 3,
    strategy: RetryStrategy.EXPONENTIAL,
    baseDelay: 1000,
    maxDelay: 30000
  },
  API_FAST: {
    maxAttempts: 2,
    strategy: RetryStrategy.FIXED,
    baseDelay: 500,
    maxDelay: 2000
  },
  API_CRITICAL: {
    maxAttempts: 5,
    strategy: RetryStrategy.EXPONENTIAL,
    baseDelay: 2000,
    maxDelay: 60000
  },
  API_AGGRESSIVE: {
    maxAttempts: 7,
    strategy: RetryStrategy.EXPONENTIAL,
    baseDelay: 100,
    maxDelay: 10000
  }
} as const