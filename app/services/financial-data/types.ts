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

export interface FundamentalRatios {
  symbol: string
  peRatio?: number
  pegRatio?: number
  pbRatio?: number
  priceToSales?: number
  priceToFreeCashFlow?: number
  debtToEquity?: number
  currentRatio?: number
  quickRatio?: number
  roe?: number  // Return on Equity
  roa?: number  // Return on Assets
  grossProfitMargin?: number
  operatingMargin?: number
  netProfitMargin?: number
  dividendYield?: number
  payoutRatio?: number
  timestamp: number
  source: string
  period?: 'annual' | 'quarterly' | 'ttm'
}

export interface FinancialDataProvider {
  name: string
  getStockPrice(symbol: string): Promise<StockData | null>
  getCompanyInfo(symbol: string): Promise<CompanyInfo | null>
  getMarketData(symbol: string): Promise<MarketData | null>
  getFundamentalRatios?(symbol: string): Promise<FundamentalRatios | null>
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

export interface OptionsContract {
  symbol: string
  strike: number
  expiration: string // ISO date string
  type: 'call' | 'put'
  volume: number
  openInterest: number
  impliedVolatility?: number
  delta?: number
  gamma?: number
  theta?: number
  vega?: number
  bid?: number
  ask?: number
  lastPrice?: number
  change?: number
  changePercent?: number
  timestamp: number
  source: string
}

export interface OptionsChain {
  symbol: string
  calls: OptionsContract[]
  puts: OptionsContract[]
  expirationDates: string[]
  strikes: number[]
  timestamp: number
  source: string
}

export interface PutCallRatio {
  symbol: string
  volumeRatio: number // puts volume / calls volume
  openInterestRatio: number // puts OI / calls OI
  totalPutVolume: number
  totalCallVolume: number
  totalPutOpenInterest: number
  totalCallOpenInterest: number
  date: string // ISO date string
  timestamp: number
  source: string
}

export interface OptionsAnalysis {
  symbol: string
  currentRatio: PutCallRatio
  historicalRatios: PutCallRatio[]
  trend: 'bullish' | 'bearish' | 'neutral'
  sentiment: 'fear' | 'greed' | 'balanced'
  confidence: number // 0-1 scale
  analysis: string
  timestamp: number
  source: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  source: string
  timestamp: number
  cached?: boolean
}