/**
 * Base class for financial data providers with common patterns
 * Reduces duplication across API implementations
 */

import { ApiResponse } from './types'

export interface ApiKeyConfig {
  apiKey?: string
  timeout?: number
  throwErrors?: boolean
}

export abstract class BaseFinancialDataProvider {
  protected apiKey: string
  protected timeout: number
  protected throwErrors: boolean
  protected baseUrl: string

  abstract name: string

  constructor(config: ApiKeyConfig & { baseUrl: string }) {
    this.apiKey = config.apiKey || ''
    this.timeout = config.timeout || 15000
    this.throwErrors = config.throwErrors || false
    this.baseUrl = config.baseUrl
  }

  /**
   * Common API key validation pattern
   */
  protected validateApiKey(): void {
    if (!this.apiKey) {
      const error = new Error(`${this.name} API key not configured`)
      console.warn(error.message)
      if (this.throwErrors) throw error
      throw error // Always throw for missing API key
    }
  }

  /**
   * Common error handling pattern for API methods
   */
  protected handleApiError<T>(error: any, symbol: string, operation: string, defaultValue: T): T {
    console.error(`${this.name} ${operation} error for ${symbol}:`, error)
    if (this.throwErrors) throw error
    return defaultValue
  }

  /**
   * Common response validation pattern
   */
  protected validateResponse(response: ApiResponse<any>, expectedDataType: 'array' | 'object' = 'array'): boolean {
    if (!response.success) {
      const error = new Error(response.error || `${this.name} API request failed`)
      if (this.throwErrors) throw error
      return false
    }

    if (expectedDataType === 'array') {
      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        const error = new Error(`Invalid response format from ${this.name} API`)
        if (this.throwErrors) throw error
        return false
      }
    } else {
      if (!response.data || typeof response.data !== 'object') {
        const error = new Error(`Invalid response format from ${this.name} API`)
        if (this.throwErrors) throw error
        return false
      }
    }

    return true
  }

  /**
   * Common numeric parsing with validation
   */
  protected parseNumeric(value: any, defaultValue = 0): number {
    if (value === null || value === undefined || value === '') {
      return defaultValue
    }

    const parsed = typeof value === 'number' ? value : parseFloat(value)
    return isNaN(parsed) ? defaultValue : parsed
  }

  /**
   * Common integer parsing with validation
   */
  protected parseInt(value: any, defaultValue = 0): number {
    if (value === null || value === undefined || value === '') {
      return defaultValue
    }

    const parsed = typeof value === 'number' ? Math.floor(value) : parseInt(value)
    return isNaN(parsed) ? defaultValue : parsed
  }

  /**
   * Common symbol normalization
   */
  protected normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase().trim()
  }

  /**
   * Standard HTTP request method with timeout and error handling
   */
  protected async makeHttpRequest(url: string, options: RequestInit = {}): Promise<ApiResponse<any>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VFR-API/1.0',
          ...options.headers
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Common error patterns across APIs
      if (data?.['Error Message']) {
        throw new Error(data['Error Message'])
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      // Rate limit detection
      if (typeof data === 'string' && data.includes('limit')) {
        throw new Error('API rate limit exceeded')
      }

      return {
        success: true,
        data,
        source: this.getSourceIdentifier(),
        timestamp: Date.now()
      }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: this.getSourceIdentifier(),
        timestamp: Date.now()
      }
    }
  }

  /**
   * Get the source identifier for this provider
   */
  protected abstract getSourceIdentifier(): string

  /**
   * Build URL with query parameters
   */
  protected buildUrl(endpoint: string, params: Record<string, string> = {}): string {
    const url = new URL(`${this.baseUrl}${endpoint}`)

    // Add API key if present
    if (this.apiKey) {
      url.searchParams.append('apikey', this.apiKey)
    }

    // Add additional parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    return url.toString()
  }
}