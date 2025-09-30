/**
 * Simple Technical Indicators Test Service
 * KISS-compliant testing for technical indicators
 * Uses existing services without rebuilding infrastructure
 */

import { TechnicalIndicatorService } from '../technical-analysis/TechnicalIndicatorService'
import { FinancialDataService } from '../financial-data/FinancialDataService'
import { RedisCache } from '../cache/RedisCache'
import { TechnicalAnalysisInput } from '../technical-analysis/types'

export interface SimpleTestResult {
  symbol: string
  success: boolean
  responseTime: number
  error?: string
  indicators?: {
    rsi: number
    macd: any
    sma20: number
    volume: string
  }
}

export class SimpleTechnicalTestService {
  private technicalService: TechnicalIndicatorService
  private dataService: FinancialDataService

  constructor(cache: RedisCache) {
    this.technicalService = new TechnicalIndicatorService(cache)
    this.dataService = new FinancialDataService()
  }

  /**
   * Test technical indicators for a single symbol
   */
  async testSymbol(symbol: string): Promise<SimpleTestResult> {
    const startTime = Date.now()

    try {
      // Get stock data
      const stockData = await this.dataService.getStockPrice(symbol.toUpperCase())

      if (!stockData) {
        return {
          symbol: symbol.toUpperCase(),
          success: false,
          responseTime: Date.now() - startTime,
          error: 'No stock data available'
        }
      }

      // Generate simple OHLC data from current price
      const currentPrice = stockData.price
      const ohlcData = this.generateSimpleOHLC(currentPrice)

      // Calculate indicators
      const input: TechnicalAnalysisInput = {
        symbol: symbol.toUpperCase(),
        ohlcData,
        timeframe: '1d'
      }

      const analysis = await this.technicalService.calculateAllIndicators(input)

      return {
        symbol: symbol.toUpperCase(),
        success: true,
        responseTime: Date.now() - startTime,
        indicators: {
          rsi: analysis.momentum.indicators.rsi.value,
          macd: analysis.trend.indicators.macd,
          sma20: analysis.trend.indicators.sma.find(s => s.period === 20)?.value || 0,
          volume: analysis.volume.trend
        }
      }

    } catch (error) {
      return {
        symbol: symbol.toUpperCase(),
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Test multiple symbols
   */
  async testSymbols(symbols: string[]): Promise<SimpleTestResult[]> {
    const results: SimpleTestResult[] = []

    for (const symbol of symbols) {
      const result = await this.testSymbol(symbol)
      results.push(result)
    }

    return results
  }

  /**
   * Generate simple OHLC data for testing
   */
  private generateSimpleOHLC(currentPrice: number): any[] {
    const periods = 50
    const data = []
    let price = currentPrice

    for (let i = periods - 1; i >= 0; i--) {
      const timestamp = Date.now() - i * 24 * 60 * 60 * 1000
      const change = (Math.random() - 0.5) * 0.02 * price // 2% random movement
      const newPrice = Math.max(price + change, 0.01)

      const open = price
      const close = newPrice
      const high = Math.max(open, close) * (1 + Math.random() * 0.01)
      const low = Math.min(open, close) * (1 - Math.random() * 0.01)
      const volume = Math.floor(1000000 + Math.random() * 2000000)

      data.push({
        timestamp,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume
      })

      price = newPrice
    }

    // Ensure last close matches current price
    if (data.length > 0) {
      data[data.length - 1].close = currentPrice
    }

    return data.sort((a, b) => a.timestamp - b.timestamp)
  }
}