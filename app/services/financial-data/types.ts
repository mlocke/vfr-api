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

export interface AnalystRatings {
  symbol: string
  consensus: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  totalAnalysts: number
  sentimentScore: number // 1-5 scale (1=Strong Sell, 5=Strong Buy)
  timestamp: number
  source: string
}

export interface PriceTarget {
  symbol: string
  targetHigh: number
  targetLow: number
  targetConsensus: number
  targetMedian: number
  currentPrice?: number
  upside?: number // percentage upside to consensus target
  lastMonthCount?: number
  lastQuarterCount?: number
  lastYearCount?: number
  timestamp: number
  source: string
}

export interface RatingChange {
  symbol: string
  publishedDate: string
  analystName: string
  analystCompany: string
  newGrade?: string
  previousGrade?: string
  action: 'upgrade' | 'downgrade' | 'initiate' | 'maintain'
  priceTarget?: number
  priceWhenPosted?: number
  newsTitle?: string
  newsURL?: string
  timestamp: number
  source: string
}

export interface HistoricalOHLC {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  date: string // ISO date string for convenience
}

export interface FinancialDataProvider {
  name: string
  getStockPrice(symbol: string): Promise<StockData | null>
  getCompanyInfo(symbol: string): Promise<CompanyInfo | null>
  getMarketData(symbol: string): Promise<MarketData | null>
  getHistoricalOHLC?(symbol: string, days?: number): Promise<HistoricalOHLC[]>
  getFundamentalRatios?(symbol: string): Promise<FundamentalRatios | null>
  getAnalystRatings?(symbol: string): Promise<AnalystRatings | null>
  getPriceTargets?(symbol: string): Promise<PriceTarget | null>
  getRecentRatingChanges?(symbol: string, limit?: number): Promise<RatingChange[]>
  getStocksBySector?(sector: string, limit?: number): Promise<StockData[]>
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
  metadata?: {
    dataCompleteness?: number // 0-1 scale
    contractsProcessed?: number
    freeTierOptimized?: boolean
    rateLimitStatus?: {
      requestsInLastMinute: number
      remainingRequests: number
      resetTime: number
    }
  }
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
  freeTierLimited?: boolean
}

/**
 * Institutional Holdings Interface for 13F Filings
 * Tracks quarterly holdings of institutional investment managers
 */
export interface InstitutionalHolding {
  symbol: string
  cusip: string
  securityName: string
  managerName: string
  managerId: string // SEC CIK number
  reportDate: string // ISO date string for quarter end
  filingDate: string // ISO date string when filed
  shares: number
  marketValue: number // in USD
  percentOfPortfolio: number // 0-100 percentage
  sharesChange?: number // change from previous quarter
  sharesChangePercent?: number // percentage change from previous quarter
  valueChange?: number // dollar change from previous quarter
  valueChangePercent?: number // percentage change from previous quarter
  isNewPosition: boolean
  isClosedPosition: boolean
  rank: number // position rank in manager's portfolio
  securityType: 'COM' | 'PRF' | 'PUT' | 'CALL' | 'NOTE' | 'BOND' | 'OTHER'
  votingAuthority?: {
    sole: number
    shared: number
    none: number
  }
  investmentDiscretion: 'SOLE' | 'SHARED' | 'OTHER'
  timestamp: number
  source: string
  accessionNumber?: string // SEC filing identifier
}

/**
 * Insider Transaction Interface for Form 4 Filings
 * Tracks insider trading activity within companies
 */
export interface InsiderTransaction {
  symbol: string
  companyName: string
  reportingOwnerName: string
  reportingOwnerTitle?: string
  reportingOwnerId: string // CIK or other identifier
  relationship: string[] // Director, Officer, 10% Owner, etc.
  transactionDate: string // ISO date string
  filingDate: string // ISO date string
  transactionCode: 'A' | 'D' | 'F' | 'G' | 'J' | 'K' | 'L' | 'M' | 'P' | 'S' | 'U' | 'V' | 'W' | 'X' | 'Z'
  transactionType: 'BUY' | 'SELL' | 'GRANT' | 'EXERCISE' | 'GIFT' | 'OTHER'
  securityTitle: string
  shares: number
  pricePerShare?: number
  transactionValue?: number // shares * price
  sharesOwnedAfter: number
  ownershipType: 'D' | 'I' // Direct or Indirect
  ownershipNature?: string // Nature of beneficial ownership
  isAmendment: boolean
  isDerivative: boolean
  exercisePrice?: number // for derivative securities
  expirationDate?: string // for derivative securities
  underlyingSecurityTitle?: string // for derivative securities
  underlyingShares?: number // for derivative securities
  confidence: number // 0-1 confidence score for data quality
  timestamp: number
  source: string
  accessionNumber?: string // SEC filing identifier
  formType: '3' | '4' | '4/A' | '5' | '5/A'
}

/**
 * Aggregated Institutional Sentiment for a Security
 * Derived from multiple 13F filings and position changes
 */
export interface InstitutionalSentiment {
  symbol: string
  reportDate: string // quarter end date
  totalInstitutions: number
  totalShares: number
  totalValue: number
  averagePosition: number // average position size in USD
  institutionalOwnership: number // percentage of float owned by institutions
  quarterlyChange: {
    newPositions: number // count of new institutional positions
    closedPositions: number // count of closed institutional positions
    increasedPositions: number // count of increased positions
    decreasedPositions: number // count of decreased positions
    netSharesChange: number // net change in institutional shares
    netValueChange: number // net change in institutional value
    flowScore: number // -1 to 1 sentiment score based on flows
  }
  topHolders: Array<{
    managerName: string
    managerId: string
    shares: number
    value: number
    percentOfTotal: number
    changeFromPrevious?: number
  }>
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  sentimentScore: number // 0-10 scale (0=Very Bearish, 10=Very Bullish)
  confidence: number // 0-1 confidence score
  timestamp: number
  source: string
}

/**
 * Aggregated Insider Sentiment for a Security
 * Derived from Form 4 insider trading patterns
 */
export interface InsiderSentiment {
  symbol: string
  period: string // time period analyzed (e.g., '90D', '180D', '1Y')
  totalTransactions: number
  totalInsiders: number
  netShares: number // net shares bought/sold
  netValue: number // net dollar value bought/sold
  buyTransactions: number
  sellTransactions: number
  buyValue: number
  sellValue: number
  averageTransactionSize: number
  insiderTypes: {
    officers: { transactions: number; netShares: number; netValue: number }
    directors: { transactions: number; netShares: number; netValue: number }
    tenPercentOwners: { transactions: number; netShares: number; netValue: number }
    other: { transactions: number; netShares: number; netValue: number }
  }
  recentActivity: Array<{
    date: string
    insiderName: string
    relationship: string
    transactionType: 'BUY' | 'SELL'
    shares: number
    value?: number
    significance: 'HIGH' | 'MEDIUM' | 'LOW' // based on size relative to position
  }>
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  sentimentScore: number // 0-10 scale (0=Very Bearish, 10=Very Bullish)
  confidence: number // 0-1 confidence score
  timestamp: number
  source: string
}

/**
 * Combined Institutional & Insider Intelligence
 * Composite view for investment decision support
 */
export interface InstitutionalIntelligence {
  symbol: string
  reportDate: string
  institutionalSentiment?: InstitutionalSentiment
  insiderSentiment?: InsiderSentiment
  compositeScore: number // 0-10 combined sentiment score
  weightedSentiment: 'VERY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'VERY_BEARISH'
  keyInsights: string[] // array of narrative insights
  riskFactors: string[] // potential concerns or risks
  opportunities: string[] // potential opportunities
  dataQuality: {
    institutionalDataAvailable: boolean
    insiderDataAvailable: boolean
    dataFreshness: number // days since last update
    completeness: number // 0-1 score for data completeness
  }
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

// Missing types for InstitutionalDataService
export interface InstitutionalAnalysis {
  symbol: string
  institutionalOwnership: number
  topHolders: Array<{
    name: string
    shares: number
    percentage: number
    marketValue: number
  }>
  recentChanges: Array<{
    institution: string
    changeType: string
    changeShares: number
    changePercent: number
    newPercentage: number
  }>
  insiderActivity: any
  confidenceScore: number
  lastUpdated: number
  dataCompleteness: {
    thirteenFCoverage: number
    insiderCoverage: number
    totalInstitutions: number
    totalInsiders: number
  }
}

export interface InsiderTrading {
  type: 'BUY' | 'SELL'
  shares: number
  value: number
  date: string
  insider: string
}

/**
 * Currency Data Service Types
 * Supporting currency analysis and sector correlation intelligence
 */

export interface CurrencyContext {
  dxyStrength: number        // Dollar Index strength 0-10
  currencyTrend: string      // 'strengthening', 'weakening', 'stable'
  sectorImpacts: Record<string, number> // Sector-specific multipliers
  confidence: number         // Data quality confidence 0-1
  lastUpdate: string         // ISO timestamp
}

export interface CurrencyPair {
  symbol: string             // e.g., 'EURUSD', 'USDJPY'
  rate: number              // Current exchange rate
  change: number            // Change from previous close
  changePercent: number     // Percentage change
  bid?: number              // Bid price
  ask?: number              // Ask price
  timestamp: number         // Unix timestamp
  source: string            // Data source identifier
}

export interface DollarIndex {
  value: number             // Current DXY value
  change: number            // Change from previous close
  changePercent: number     // Percentage change
  strength: number          // Normalized strength score 0-10
  trend: 'strengthening' | 'weakening' | 'stable'
  timestamp: number         // Unix timestamp
  source: string            // Data source identifier
}

export interface CurrencyStrength {
  currency: string          // Currency code (USD, EUR, JPY, etc.)
  strengthScore: number     // Relative strength 0-10
  momentum: number          // Recent momentum -10 to +10
  volatility: number        // Volatility measure 0-10
  trend: 'bullish' | 'bearish' | 'neutral'
  lastUpdate: number        // Unix timestamp
}

export interface SectorCurrencyImpact {
  sector: string            // Sector name
  currencyExposure: number  // Currency exposure coefficient -1 to +1
  usdStrengthMultiplier: number // Impact multiplier when USD strengthens
  correlationScore: number  // Historical correlation strength 0-1
  impactDescription: string // Human-readable impact explanation
  riskLevel: 'low' | 'medium' | 'high'
}

export interface CurrencyAnalysis {
  dxyIndex: DollarIndex
  majorPairs: CurrencyPair[]
  currencyStrengths: CurrencyStrength[]
  sectorImpacts: SectorCurrencyImpact[]
  marketSentiment: {
    riskOn: boolean         // Risk-on vs risk-off sentiment
    flightToQuality: number // Safe haven demand 0-10
    carryTradeViability: number // Carry trade attractiveness 0-10
  }
  timestamp: number
  confidence: number        // Overall data confidence 0-1
  source: string
}

/**
 * VWAP (Volume Weighted Average Price) Data Types
 * Supporting advanced trading features and execution analysis
 */

export interface VWAPData {
  symbol: string
  vwap: number
  timestamp: number
  volume: number
  timespan: 'minute' | 'hour' | 'day'
  source: string
}

export interface VWAPAnalysis {
  symbol: string
  currentPrice: number
  vwap: number
  deviation: number
  deviationPercent: number
  signal: 'above' | 'below' | 'at'
  strength: 'weak' | 'moderate' | 'strong'
  timestamp: number
}