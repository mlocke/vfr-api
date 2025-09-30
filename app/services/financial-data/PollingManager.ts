/**
 * Polling Manager for optimized data fetching intervals
 * Handles market hours detection and smart polling schedules
 */

import { FinancialModelingPrepAPI } from './FinancialModelingPrepAPI'
import { StockData } from './types'

export interface PollingConfig {
  marketHoursInterval: number  // Interval during market hours (ms)
  afterHoursInterval: number    // Interval after market hours (ms)
  preMarketInterval: number     // Interval during pre-market (ms)
  weekendInterval: number       // Interval during weekends (ms)
}

export class PollingManager {
  private polygonAPI: FinancialModelingPrepAPI
  private config: PollingConfig
  private activePolls: Map<string, NodeJS.Timeout> = new Map()
  private callbacks: Map<string, (data: StockData | null) => void> = new Map()

  constructor(polygonAPI: FinancialModelingPrepAPI, config?: Partial<PollingConfig>) {
    this.polygonAPI = polygonAPI
    this.config = {
      marketHoursInterval: config?.marketHoursInterval || 30000,      // 30 seconds
      afterHoursInterval: config?.afterHoursInterval || 300000,       // 5 minutes
      preMarketInterval: config?.preMarketInterval || 60000,          // 1 minute
      weekendInterval: config?.weekendInterval || 3600000,            // 1 hour
      ...config
    }
  }

  /**
   * Determine current market period
   */
  private getMarketPeriod(): 'market' | 'premarket' | 'afterhours' | 'weekend' {
    const now = new Date()
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
    const day = easternTime.getDay()
    const hours = easternTime.getHours()
    const minutes = easternTime.getMinutes()
    const totalMinutes = hours * 60 + minutes

    // Weekend check (Saturday = 6, Sunday = 0)
    if (day === 0 || day === 6) {
      return 'weekend'
    }

    // Pre-market: 4:00 AM - 9:30 AM ET
    if (totalMinutes >= 240 && totalMinutes < 570) {
      return 'premarket'
    }

    // Market hours: 9:30 AM - 4:00 PM ET
    if (totalMinutes >= 570 && totalMinutes < 960) {
      return 'market'
    }

    // After-hours: 4:00 PM - 8:00 PM ET
    if (totalMinutes >= 960 && totalMinutes < 1200) {
      return 'afterhours'
    }

    // Late night/early morning
    return 'afterhours'
  }

  /**
   * Get appropriate polling interval based on market period
   */
  private getPollingInterval(): number {
    const period = this.getMarketPeriod()

    switch (period) {
      case 'market':
        return this.config.marketHoursInterval
      case 'premarket':
        return this.config.preMarketInterval
      case 'afterhours':
        return this.config.afterHoursInterval
      case 'weekend':
        return this.config.weekendInterval
      default:
        return this.config.afterHoursInterval
    }
  }

  /**
   * Start polling for a symbol
   */
  startPolling(symbol: string, callback: (data: StockData | null) => void): void {
    // Stop existing poll if any
    this.stopPolling(symbol)

    // Store callback
    this.callbacks.set(symbol, callback)

    // Start polling
    const poll = async () => {
      try {
        // Use stock price data for all periods (FMP doesn't have separate latest trade endpoint)
        const data = await this.polygonAPI.getStockPrice(symbol)

        // Call the callback with the data
        const cb = this.callbacks.get(symbol)
        if (cb) cb(data)

        // Schedule next poll with appropriate interval
        const interval = this.getPollingInterval()
        const timeout = setTimeout(poll, interval)
        this.activePolls.set(symbol, timeout)

      } catch (error) {
        console.error(`Polling error for ${symbol}:`, error)

        // Retry with longer interval on error
        const timeout = setTimeout(poll, this.config.afterHoursInterval)
        this.activePolls.set(symbol, timeout)
      }
    }

    // Initial poll
    poll()
  }

  /**
   * Start batch polling for multiple symbols (more efficient)
   */
  startBatchPolling(symbols: string[], callback: (data: Map<string, StockData>) => void): void {
    // Stop individual polls for these symbols
    symbols.forEach(symbol => this.stopPolling(symbol))

    const batchKey = symbols.join(',')

    // Start batch polling
    const poll = async () => {
      try {
        const data = await this.polygonAPI.getBatchPrices(symbols)
        callback(data)

        // Schedule next poll
        const interval = this.getPollingInterval()
        const timeout = setTimeout(poll, interval)
        this.activePolls.set(batchKey, timeout)

      } catch (error) {
        console.error('Batch polling error:', error)

        // Retry with longer interval
        const timeout = setTimeout(poll, this.config.afterHoursInterval)
        this.activePolls.set(batchKey, timeout)
      }
    }

    // Initial poll
    poll()
  }

  /**
   * Stop polling for a symbol
   */
  stopPolling(symbol: string): void {
    const timeout = this.activePolls.get(symbol)
    if (timeout) {
      clearTimeout(timeout)
      this.activePolls.delete(symbol)
      this.callbacks.delete(symbol)
    }
  }

  /**
   * Stop all active polls
   */
  stopAllPolling(): void {
    this.activePolls.forEach((timeout) => clearTimeout(timeout))
    this.activePolls.clear()
    this.callbacks.clear()
  }

  /**
   * Get current market status
   */
  getMarketStatus(): {
    period: string
    nextInterval: number
    isMarketOpen: boolean
  } {
    const period = this.getMarketPeriod()
    const nextInterval = this.getPollingInterval()

    return {
      period,
      nextInterval,
      isMarketOpen: period === 'market'
    }
  }
}