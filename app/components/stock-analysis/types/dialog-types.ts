/**
 * Type definitions for Stock Analysis Dialog components
 * These types match the data structure used in stock-intelligence/page.tsx
 */

export interface DialogStockScore {
  overall: number
  technical: number
  fundamental: number
  sentiment: number
  macro?: number
  alternative?: number
}

export interface DialogStockData {
  symbol: string
  score: DialogStockScore
  weight?: number
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  context: {
    sector: string
    marketCap: number
    priceChange24h?: number
    volumeChange24h?: number
    beta?: number
  }
  reasoning: {
    primaryFactors: string[]
    warnings?: string[]
    opportunities?: string[]
  }
  dataQuality: {
    overall: {
      overall: number
      timestamp: number
      source: string
      metrics: {
        freshness: number
        completeness: number
        accuracy: number
        sourceReputation: number
        latency: number
      }
    }
    lastUpdated: number
  }
  sentimentBreakdown?: {
    newsScore: number
    redditScore: number
    analystScore: number
  }
}