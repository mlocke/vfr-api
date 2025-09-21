/**
 * Timeout Handler Utility
 * Provides consistent timeout handling patterns across all financial data services
 * Built on KISS principles with configurable timeout strategies
 */

export interface TimeoutConfig {
  defaultTimeout: number
  maxTimeout: number
  retryTimeout: number
  connectTimeout: number
  readTimeout: number
}

export interface TimeoutOptions {
  timeout?: number
  signal?: AbortSignal
  retries?: number
  retryDelay?: number
  onTimeout?: (attempt: number) => void
}

export class TimeoutHandler {
  private static instance: TimeoutHandler
  private config: TimeoutConfig

  private constructor(config?: Partial<TimeoutConfig>) {
    this.config = {
      defaultTimeout: 15000,    // 15 seconds default
      maxTimeout: 60000,        // 60 seconds maximum
      retryTimeout: 5000,       // 5 seconds for retries
      connectTimeout: 10000,    // 10 seconds connection timeout
      readTimeout: 30000,       // 30 seconds read timeout
      ...config
    }
  }

  public static getInstance(config?: Partial<TimeoutConfig>): TimeoutHandler {
    if (!TimeoutHandler.instance) {
      TimeoutHandler.instance = new TimeoutHandler(config)
    }
    return TimeoutHandler.instance
  }

  /**
   * Execute promise with timeout
   */
  public async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs?: number,
    signal?: AbortSignal
  ): Promise<T> {
    const timeout = Math.min(
      timeoutMs || this.config.defaultTimeout,
      this.config.maxTimeout
    )

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`))
      }, timeout)

      // Clear timeout if signal is aborted
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId)
          reject(new Error('Operation was aborted'))
        })
      }
    })

    return Promise.race([promise, timeoutPromise])
  }

  /**
   * Execute promise with timeout and retry logic
   */
  public async withTimeoutAndRetry<T>(
    operation: () => Promise<T>,
    options: TimeoutOptions = {}
  ): Promise<T> {
    const maxRetries = options.retries || 0
    const retryDelay = options.retryDelay || 1000
    const timeout = options.timeout || this.config.defaultTimeout

    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const promise = operation()
        return await this.withTimeout(promise, timeout, options.signal)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if error is timeout-related
        const isTimeout = this.isTimeoutError(lastError)

        // Call timeout callback if provided
        if (isTimeout && options.onTimeout) {
          options.onTimeout(attempt + 1)
        }

        // Don't retry on non-timeout errors or if this was the last attempt
        if (!isTimeout || attempt === maxRetries) {
          throw lastError
        }

        // Wait before retry with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt)
        await this.delay(delay)
      }
    }

    throw lastError!
  }

  /**
   * Create AbortController with timeout
   */
  public createTimeoutController(timeoutMs?: number): {
    controller: AbortController
    timeoutId: NodeJS.Timeout
  } {
    const timeout = Math.min(
      timeoutMs || this.config.defaultTimeout,
      this.config.maxTimeout
    )

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeout)

    return { controller, timeoutId }
  }

  /**
   * Fetch with timeout configuration
   */
  public async fetchWithTimeout(
    url: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<Response> {
    const { timeout, ...fetchOptions } = options
    const timeoutMs = Math.min(
      timeout || this.config.defaultTimeout,
      this.config.maxTimeout
    )

    const { controller, timeoutId } = this.createTimeoutController(timeoutMs)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms`)
      }

      throw error
    }
  }

  /**
   * Create timeout promise that resolves after specified time
   */
  public createTimeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Race multiple promises with timeout
   */
  public async raceWithTimeout<T>(
    promises: Promise<T>[],
    timeoutMs?: number
  ): Promise<T> {
    const timeout = timeoutMs || this.config.defaultTimeout

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`No promise resolved within ${timeout}ms`))
      }, timeout)
    })

    return Promise.race([...promises, timeoutPromise])
  }

  /**
   * Execute promises in parallel with individual timeouts
   */
  public async allWithTimeout<T>(
    promises: Promise<T>[],
    timeoutMs?: number
  ): Promise<T[]> {
    const timeout = timeoutMs || this.config.defaultTimeout

    const wrappedPromises = promises.map(promise =>
      this.withTimeout(promise, timeout)
    )

    return Promise.all(wrappedPromises)
  }

  /**
   * Execute promises in parallel with timeout, returning settled results
   */
  public async allSettledWithTimeout<T>(
    promises: Promise<T>[],
    timeoutMs?: number
  ): Promise<PromiseSettledResult<T>[]> {
    const timeout = timeoutMs || this.config.defaultTimeout

    const wrappedPromises = promises.map(async (promise): Promise<T> => {
      try {
        return await this.withTimeout(promise, timeout)
      } catch (error) {
        throw error
      }
    })

    return Promise.allSettled(wrappedPromises)
  }

  /**
   * Check if error is timeout-related
   */
  public isTimeoutError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return (
      message.includes('timeout') ||
      message.includes('aborted') ||
      message.includes('etimedout') ||
      error.name === 'AbortError'
    )
  }

  /**
   * Get appropriate timeout for operation type
   */
  public getTimeoutForOperation(operationType: 'connect' | 'read' | 'retry' | 'default'): number {
    switch (operationType) {
      case 'connect':
        return this.config.connectTimeout
      case 'read':
        return this.config.readTimeout
      case 'retry':
        return this.config.retryTimeout
      default:
        return this.config.defaultTimeout
    }
  }

  /**
   * Create timeout configuration for HTTP requests
   */
  public getHttpTimeoutConfig(): {
    connect: number
    read: number
    total: number
  } {
    return {
      connect: this.config.connectTimeout,
      read: this.config.readTimeout,
      total: this.config.maxTimeout
    }
  }

  /**
   * Update timeout configuration
   */
  public updateConfig(newConfig: Partial<TimeoutConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current timeout configuration
   */
  public getConfig(): TimeoutConfig {
    return { ...this.config }
  }

  // Private helper methods

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export class and getInstance method
export default TimeoutHandler

// Export configuration constants for common use cases
export const TIMEOUT_CONFIGS = {
  FAST_API: {
    defaultTimeout: 5000,
    maxTimeout: 15000,
    retryTimeout: 2000,
    connectTimeout: 3000,
    readTimeout: 8000
  },
  STANDARD_API: {
    defaultTimeout: 15000,
    maxTimeout: 60000,
    retryTimeout: 5000,
    connectTimeout: 10000,
    readTimeout: 30000
  },
  SLOW_API: {
    defaultTimeout: 30000,
    maxTimeout: 120000,
    retryTimeout: 10000,
    connectTimeout: 15000,
    readTimeout: 60000
  }
} as const