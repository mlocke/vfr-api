/**
 * Types for direct financial API services
 * Simplified data models following KISS principles
 */

export interface StockData {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  averageVolume?: number
  bid?: number
  ask?: number
  vwap?: number
  timestamp: number
  source: string
}

export interface CompanyInfo {
  symbol: string
  name: string
  description: string
  sector: string
  marketCap: number
  employees?: number
  website?: string
}

export interface MarketData {
  symbol: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
  source: string
}

export interface FinancialDataProvider {
  name: string
  getStockPrice(symbol: string): Promise<StockData | null>
  getCompanyInfo(symbol: string): Promise<CompanyInfo | null>
  getMarketData(symbol: string): Promise<MarketData | null>
  healthCheck(): Promise<boolean>
}

export interface ProviderConfig {
  apiKey: string
  baseUrl: string
  timeout: number
  rateLimit: {
    requests: number
    window: number // in milliseconds
  }
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  source: string
  timestamp: number
  cached?: boolean
}