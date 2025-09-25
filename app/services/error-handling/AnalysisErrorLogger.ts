/**
 * Analysis Error Logger
 * Provides detailed logging for analysis failures with categorized reasons
 * Helps distinguish between expected issues (rate limits) and serious problems
 */

export interface AnalysisError {
  symbol?: string
  service?: string
  errorType: 'RATE_LIMIT' | 'API_UNAVAILABLE' | 'INVALID_RESPONSE' | 'TIMEOUT' | 'CONFIGURATION' | 'DATA_QUALITY' | 'UNKNOWN'
  originalError: string
  reason: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  retryable: boolean
  timestamp: number
  requestId?: string
}

export interface AnalysisErrorSummary {
  totalErrors: number
  errorsByType: Record<string, number>
  errorsBySeverity: Record<string, number>
  retryableErrors: number
  criticalErrors: AnalysisError[]
  rateLimitErrors: AnalysisError[]
  serviceUnavailableErrors: AnalysisError[]
}

export class AnalysisErrorLogger {
  private errors: AnalysisError[] = []

  /**
   * Log an analysis error with detailed categorization
   */
  logError(
    originalError: string,
    symbol?: string,
    service?: string,
    requestId?: string
  ): AnalysisError {
    const analysisError = this.categorizeError(originalError, symbol, service, requestId)
    this.errors.push(analysisError)

    // Log to console with appropriate level
    this.logToConsole(analysisError)

    return analysisError
  }

  /**
   * Categorize error based on error message patterns
   */
  private categorizeError(
    originalError: string,
    symbol?: string,
    service?: string,
    requestId?: string
  ): AnalysisError {
    const errorLower = originalError.toLowerCase()

    // Rate limit detection patterns
    if (this.isRateLimitError(errorLower)) {
      return {
        symbol,
        service,
        errorType: 'RATE_LIMIT',
        originalError,
        reason: this.getRateLimitReason(originalError, service),
        severity: 'LOW',
        retryable: true,
        timestamp: Date.now(),
        requestId
      }
    }

    // API unavailability detection
    if (this.isApiUnavailableError(errorLower)) {
      return {
        symbol,
        service,
        errorType: 'API_UNAVAILABLE',
        originalError,
        reason: this.getApiUnavailableReason(originalError, service),
        severity: 'MEDIUM',
        retryable: true,
        timestamp: Date.now(),
        requestId
      }
    }

    // Timeout detection
    if (this.isTimeoutError(errorLower)) {
      return {
        symbol,
        service,
        errorType: 'TIMEOUT',
        originalError,
        reason: `Request timeout for ${service || 'unknown service'} - likely due to high API load`,
        severity: 'MEDIUM',
        retryable: true,
        timestamp: Date.now(),
        requestId
      }
    }

    // Invalid response detection
    if (this.isInvalidResponseError(errorLower)) {
      return {
        symbol,
        service,
        errorType: 'INVALID_RESPONSE',
        originalError,
        reason: this.getInvalidResponseReason(originalError, service),
        severity: 'HIGH',
        retryable: false,
        timestamp: Date.now(),
        requestId
      }
    }

    // Configuration errors
    if (this.isConfigurationError(errorLower)) {
      return {
        symbol,
        service,
        errorType: 'CONFIGURATION',
        originalError,
        reason: `Configuration error for ${service || 'service'} - check API keys and endpoints`,
        severity: 'CRITICAL',
        retryable: false,
        timestamp: Date.now(),
        requestId
      }
    }

    // Data quality issues
    if (this.isDataQualityError(errorLower)) {
      return {
        symbol,
        service,
        errorType: 'DATA_QUALITY',
        originalError,
        reason: this.getDataQualityReason(originalError, symbol, service),
        severity: 'MEDIUM',
        retryable: false,
        timestamp: Date.now(),
        requestId
      }
    }

    // Unknown error
    return {
      symbol,
      service,
      errorType: 'UNKNOWN',
      originalError,
      reason: `Unexpected error in ${service || 'service'}: ${originalError}`,
      severity: 'HIGH',
      retryable: false,
      timestamp: Date.now(),
      requestId
    }
  }

  /**
   * Rate limit error detection patterns
   */
  private isRateLimitError(errorLower: string): boolean {
    const rateLimitPatterns = [
      'rate limit',
      'too many requests',
      '429',
      'quota exceeded',
      'api limit reached',
      'requests per',
      'throttle',
      'frequency limit'
    ]
    return rateLimitPatterns.some(pattern => errorLower.includes(pattern))
  }

  /**
   * API unavailability detection patterns
   */
  private isApiUnavailableError(errorLower: string): boolean {
    const unavailablePatterns = [
      'service unavailable',
      '503',
      'connection refused',
      'network error',
      'fetch failed',
      'getaddrinfo enotfound',
      'connect econnrefused',
      'socket timeout',
      'bad gateway',
      '502',
      '500'
    ]
    return unavailablePatterns.some(pattern => errorLower.includes(pattern))
  }

  /**
   * Timeout error detection patterns
   */
  private isTimeoutError(errorLower: string): boolean {
    const timeoutPatterns = [
      'timeout',
      'timed out',
      'request timeout',
      'etimedout',
      'socket hang up'
    ]
    return timeoutPatterns.some(pattern => errorLower.includes(pattern))
  }

  /**
   * Invalid response detection patterns
   */
  private isInvalidResponseError(errorLower: string): boolean {
    const invalidResponsePatterns = [
      'invalid json',
      'unexpected token',
      'malformed response',
      'parse error',
      'invalid response format',
      'missing required field',
      'invalid data structure'
    ]
    return invalidResponsePatterns.some(pattern => errorLower.includes(pattern))
  }

  /**
   * Configuration error detection patterns
   */
  private isConfigurationError(errorLower: string): boolean {
    const configPatterns = [
      'unauthorized',
      '401',
      'forbidden',
      '403',
      'invalid api key',
      'authentication failed',
      'access denied',
      'not found',
      '404'
    ]
    return configPatterns.some(pattern => errorLower.includes(pattern))
  }

  /**
   * Data quality error detection patterns
   */
  private isDataQualityError(errorLower: string): boolean {
    const dataQualityPatterns = [
      'missing core financial data',
      'incomplete data',
      'no data available',
      'insufficient data',
      'data not found',
      'empty response'
    ]
    return dataQualityPatterns.some(pattern => errorLower.includes(pattern))
  }

  /**
   * Get detailed rate limit reason
   */
  private getRateLimitReason(originalError: string, service?: string): string {
    const serviceNames = {
      'AlphaVantageAPI': 'Alpha Vantage (500 requests/day)',
      'PolygonAPI': 'Polygon.io (5000 requests/day)',
      'FMPAPI': 'Financial Modeling Prep (250 requests/day)',
      'TwelveDataAPI': 'TwelveData (800 requests/day)',
      'NewsAPI': 'NewsAPI (1000 requests/day)'
    }

    const serviceName = serviceNames[service as keyof typeof serviceNames] || service || 'API service'

    if (originalError.includes('429')) {
      return `Rate limit exceeded for ${serviceName}. This is expected during high usage periods. Data will resume when limit resets.`
    }

    if (originalError.toLowerCase().includes('quota')) {
      return `Daily quota exceeded for ${serviceName}. Service will resume tomorrow or upgrade plan if needed.`
    }

    return `Rate limiting active for ${serviceName}. This is normal behavior to prevent service overuse.`
  }

  /**
   * Get detailed API unavailable reason
   */
  private getApiUnavailableReason(originalError: string, service?: string): string {
    if (originalError.includes('503')) {
      return `${service || 'Service'} temporarily unavailable (503). This is usually temporary maintenance or high load.`
    }

    if (originalError.includes('connection refused') || originalError.includes('ECONNREFUSED')) {
      return `Cannot connect to ${service || 'service'}. Service may be down or network connectivity issue.`
    }

    if (originalError.includes('fetch failed')) {
      return `Network request failed for ${service || 'service'}. Check network connectivity or service status.`
    }

    return `${service || 'Service'} is currently unavailable. This may be temporary - service should recover automatically.`
  }

  /**
   * Get detailed invalid response reason
   */
  private getInvalidResponseReason(originalError: string, service?: string): string {
    if (originalError.includes('JSON')) {
      return `${service || 'Service'} returned malformed JSON response. This may indicate an API change or service issue.`
    }

    if (originalError.includes('missing required field')) {
      return `${service || 'Service'} response missing expected data fields. API format may have changed.`
    }

    return `${service || 'Service'} returned unexpected response format. This may require code updates.`
  }

  /**
   * Get detailed data quality reason
   */
  private getDataQualityReason(originalError: string, symbol?: string, service?: string): string {
    if (originalError.includes('missing core financial data')) {
      return `Symbol ${symbol || 'unknown'} lacks fundamental financial data from ${service || 'service'}. This could be due to:
        - Stock is too new or recently listed
        - Data provider doesn't cover this symbol
        - Temporary data synchronization issue
        - Symbol may be delisted or inactive`
    }

    if (originalError.includes('no data available')) {
      return `No data found for ${symbol || 'symbol'} from ${service || 'service'}. Symbol may be invalid or not supported.`
    }

    return `Data quality issue for ${symbol || 'symbol'} from ${service || 'service'}: ${originalError}`
  }

  /**
   * Log to console with appropriate level
   */
  private logToConsole(error: AnalysisError): void {
    const logMessage = `🔍 Analysis Error - ${error.errorType} (${error.severity}): ${error.reason}`

    switch (error.severity) {
      case 'CRITICAL':
        console.error(`🚨 ${logMessage}`)
        break
      case 'HIGH':
        console.error(`❌ ${logMessage}`)
        break
      case 'MEDIUM':
        console.warn(`⚠️ ${logMessage}`)
        break
      case 'LOW':
        console.log(`ℹ️ ${logMessage}`)
        break
    }
  }

  /**
   * Get error summary for reporting
   */
  getErrorSummary(): AnalysisErrorSummary {
    const errorsByType = this.errors.reduce((acc, error) => {
      acc[error.errorType] = (acc[error.errorType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const errorsBySeverity = this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalErrors: this.errors.length,
      errorsByType,
      errorsBySeverity,
      retryableErrors: this.errors.filter(e => e.retryable).length,
      criticalErrors: this.errors.filter(e => e.severity === 'CRITICAL'),
      rateLimitErrors: this.errors.filter(e => e.errorType === 'RATE_LIMIT'),
      serviceUnavailableErrors: this.errors.filter(e => e.errorType === 'API_UNAVAILABLE')
    }
  }

  /**
   * Get errors for specific symbol or service
   */
  getErrorsFor(symbol?: string, service?: string): AnalysisError[] {
    return this.errors.filter(error =>
      (!symbol || error.symbol === symbol) &&
      (!service || error.service === service)
    )
  }

  /**
   * Clear all logged errors
   */
  clearErrors(): void {
    this.errors = []
  }

  /**
   * Get all errors
   */
  getAllErrors(): AnalysisError[] {
    return [...this.errors]
  }
}