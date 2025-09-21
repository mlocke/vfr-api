/**
 * Error Handling Module
 * Centralized export for all error handling utilities
 */

// Core error handling
export { default as ErrorHandler, ErrorType, ErrorCode, ErrorSeverity } from './ErrorHandler'
export type { ErrorResponse, ErrorHandlerConfig } from './ErrorHandler'

// Timeout handling
export { default as TimeoutHandler, TIMEOUT_CONFIGS } from './TimeoutHandler'
export type { TimeoutConfig, TimeoutOptions } from './TimeoutHandler'

// Retry mechanisms
export { default as RetryHandler, RetryStrategy, RETRY_CONFIGS } from './RetryHandler'
export type {
  RetryConfig,
  RetryOptions,
  RetryResult,
  RetryAttempt
} from './RetryHandler'

// Logging utilities
export {
  Logger,
  LogLevel,
  LOG_LEVELS,
  createServiceLogger,
  createApiLogger,
  createSecurityLogger
} from './Logger'
export type { LogEntry, LoggerConfig } from './Logger'

// Convenience factory functions
export const createStandardizedErrorHandler = (serviceName: string) => {
  const errorHandler = ErrorHandler.getInstance()
  const logger = createServiceLogger(serviceName)
  const retryHandler = RetryHandler.getInstance()
  const timeoutHandler = TimeoutHandler.getInstance()

  return {
    errorHandler,
    logger,
    retryHandler,
    timeoutHandler,

    // Convenient wrapper methods
    async handleApiCall<T>(
      operation: () => Promise<T>,
      options: {
        timeout?: number
        retries?: number
        requestId?: string
        context?: string
      } = {}
    ): Promise<T> {
      const startTime = Date.now()

      try {
        logger.debug(`Starting API call: ${options.context || 'unknown'}`, {
          timeout: options.timeout,
          retries: options.retries
        }, options.requestId)

        const result = await retryHandler.execute(
          () => timeoutHandler.withTimeout(operation(), options.timeout),
          options.retries ? { maxAttempts: options.retries } : undefined,
          { timeout: options.timeout, context: options.context }
        )

        if (result.success) {
          const duration = Date.now() - startTime
          logger.logPerformance(
            options.context || 'api_call',
            duration,
            options.requestId,
            { attempts: result.attempts }
          )
          return result.data!
        } else {
          throw result.error
        }
      } catch (error) {
        const duration = Date.now() - startTime
        const errorResponse = errorHandler.createErrorResponse(
          error,
          serviceName,
          options.requestId
        )

        logger.error(
          `API call failed: ${options.context || 'unknown'}`,
          {
            error: errorResponse.error,
            duration,
            context: options.context
          },
          options.requestId
        )

        throw error
      }
    },

    validateAndExecute<T>(
      operation: () => Promise<T>,
      symbols?: string[],
      options: {
        timeout?: number
        retries?: number
        requestId?: string
        context?: string
      } = {}
    ): Promise<T> {
      return errorHandler.handleAsync(
        async () => {
          // Validate operation first
          const validationError = await errorHandler.validateOperation(serviceName, symbols)
          if (validationError) {
            throw new Error(validationError.error.message)
          }

          // Execute with standard handling
          return this.handleApiCall(operation, options)
        },
        serviceName,
        options.requestId,
        {
          timeout: options.timeout,
          retries: options.retries
        }
      ) as Promise<T>
    }
  }
}

// Export utility functions for common patterns
export const createApiErrorHandler = (apiName: string) => {
  const handler = createStandardizedErrorHandler(`api.${apiName}`)
  return handler
}

export const createServiceErrorHandler = (serviceName: string) => {
  const handler = createStandardizedErrorHandler(serviceName)
  return handler
}

// Error handling middleware for async operations
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  serviceName: string,
  options: {
    timeout?: number
    retries?: number
    logLevel?: 'error' | 'warn' | 'info' | 'debug'
  } = {}
) => {
  const handler = createStandardizedErrorHandler(serviceName)

  return async (...args: T): Promise<R> => {
    try {
      return await handler.handleApiCall(
        () => fn(...args),
        {
          timeout: options.timeout,
          retries: options.retries,
          context: fn.name || 'anonymous_function'
        }
      )
    } catch (error) {
      // Log at specified level
      const logLevel = options.logLevel || 'error'
      handler.logger[logLevel](
        `Function ${fn.name || 'anonymous'} failed`,
        { error, args: args.length }
      )
      throw error
    }
  }
}

// Type guards for error handling
export const isErrorResponse = (value: any): value is ErrorResponse => {
  return value &&
         typeof value === 'object' &&
         value.success === false &&
         value.error &&
         typeof value.error === 'object'
}

export const isRetryableError = (error: any): boolean => {
  if (isErrorResponse(error)) {
    return error.error.retryable
  }

  const retryHandler = RetryHandler.getInstance()
  const config = retryHandler.getDefaultConfig()

  // Simple check for common retryable error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return ['timeout', 'network', 'rate limit', 'econnrefused'].some(
      pattern => message.includes(pattern)
    )
  }

  return false
}

// Helper to extract error information
export const extractErrorInfo = (error: any) => {
  if (isErrorResponse(error)) {
    return {
      type: error.error.type,
      code: error.error.code,
      message: error.error.message,
      severity: error.error.severity,
      retryable: error.error.retryable,
      retryAfter: error.error.retryAfter
    }
  }

  if (error instanceof Error) {
    return {
      type: 'INTERNAL_ERROR',
      message: error.message,
      retryable: isRetryableError(error)
    }
  }

  return {
    type: 'UNKNOWN_ERROR',
    message: String(error),
    retryable: false
  }
}