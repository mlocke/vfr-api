# VFR Analysis Engine Technical Specification
## Comprehensive Data Output Structure for AI Agent Interface Design

**Document Version**: 1.0
**Last Updated**: 2025-01-23
**Target Audience**: AI Agents designing Analysis Cards and User Interfaces
**Context**: Production-grade financial analysis platform with real-time multi-source data integration

---

## Executive Context

### System Identity
**Platform**: VFR Financial Analysis Engine - Enterprise-grade stock intelligence democratization
**Architecture**: Next.js 15 + TypeScript service-oriented platform with parallel API processing
**Data Philosophy**: NO MOCK DATA - Real API integration with multi-tier fallback strategies
**Processing Model**: 83.8% performance improvement through Promise.allSettled parallel execution

### Critical Success Factors
- **Data Integrity**: Real-time API integration across 15+ financial data sources
- **Performance**: Sub-3-second composite analysis with intelligent caching (Redis primary + in-memory fallback)
- **Reliability**: 99.5% uptime via graceful degradation and circuit breaker patterns
- **Security**: OWASP Top 10 compliance with input validation and error sanitization

---

## Composite Scoring Algorithm

### Architecture Fix: Sentiment Integration (September 2024)

**Problem Solved**: GME analysis showed 0% sentiment utilization despite sentiment data (0.52) being calculated.

**Root Cause**: Sentiment analysis occurred AFTER composite algorithm execution in the data flow pipeline.

**Solution Implemented**:
- **Pre-fetch Architecture**: Modified `AlgorithmEngine.calculateSingleStockScore()` to pre-fetch sentiment data before composite calculation
- **Direct Integration**: Added sentiment parameter to `FactorLibrary.calculateMainComposite()` method
- **Performance Optimized**: Maintains sub-3-second analysis target through intelligent caching and parallel processing

**Technical Implementation**:
```typescript
// AlgorithmEngine.ts (lines 446-456)
// 🆕 PRE-FETCH SENTIMENT DATA for composite algorithm
let sentimentScore: number | undefined
try {
  console.log(`📰 Pre-fetching sentiment data for ${symbol}...`)
  const sentimentResult = await this.sentimentService.getSentimentIndicators(symbol)
  sentimentScore = sentimentResult ? sentimentResult.aggregatedScore : undefined
  console.log(`📰 Sentiment pre-fetched for ${symbol}: ${sentimentScore}`)
} catch (sentimentError) {
  console.warn(`Failed to fetch sentiment for ${symbol}:`, sentimentError)
  sentimentScore = undefined // Will use fallback in FactorLibrary
}

// FactorLibrary.ts (lines 1666-1676)
// 🆕 SENTIMENT ANALYSIS (weight: 0.10) - NEW INTEGRATION!
if (sentimentScore !== undefined && sentimentScore !== null) {
  console.log(`📰 Sentiment Analysis: ${sentimentScore.toFixed(3)} (weight: 0.10) - INTEGRATED!`)
  totalScore += sentimentScore * 0.10
  totalWeight += 0.10
  factorContributions.push('sentimentAnalysis', 'sentiment_composite')
} else {
  console.log('📰 Sentiment Analysis: No data (fallback to neutral 0.5)')
  totalScore += 0.5 * 0.10
  totalWeight += 0.10
}
```

**Result**: GME sentiment score (0.52) now actively contributes 10% weight to composite scoring instead of 0% utilization.

### Weight Distribution (Total: 100%)
```typescript
interface CompositeWeights {
  technicalAnalysis: 35%      // Reduced from 40% to accommodate sentiment integration
  fundamentalAnalysis: 25%    // Maintained - core financial health metrics
  macroeconomicAnalysis: 20%  // Economic environment and sector impact
  sentimentAnalysis: 10%      // ✅ ACTIVE INTEGRATION - News + Reddit WSB sentiment
  extendedMarketData: 5%      // Pre/post market activity + liquidity metrics
  alternativeData: 5%         // ESG (3%) + Short Interest (2%)
}
```

### Score Calculation Logic
```typescript
function calculateCompositeScore(stock: EnhancedStockData): number {
  let score = 0
  let totalWeight = 0

  // Technical Analysis (35% - most reliable for short-term signals)
  if (stock.technicalAnalysis?.score) {
    score += stock.technicalAnalysis.score * 0.35
    totalWeight += 0.35
  }

  // Fundamental Analysis (25% - core business health)
  if (stock.fundamentals) {
    const fundamentalScore = calculateFundamentalScore(stock.fundamentals)
    score += fundamentalScore * 0.25
    totalWeight += 0.25
  }

  // Macroeconomic Analysis (20% - sector and economic environment)
  if (stock.macroeconomicAnalysis?.score) {
    score += stock.macroeconomicAnalysis.score * 0.20
    totalWeight += 0.20
  }

  // Sentiment Analysis (10% - news and social sentiment) - ✅ ACTIVE INTEGRATION
  if (stock.sentimentAnalysis?.adjustedScore) {
    score += stock.sentimentAnalysis.adjustedScore * 0.10
    totalWeight += 0.10
    console.log(`📰 Sentiment contribution: ${stock.sentimentAnalysis.adjustedScore * 0.10} (10% weight)`);
  }

  // Extended Market Data (5% - liquidity and extended hours activity)
  const extendedScore = calculateExtendedMarketScore(stock)
  score += extendedScore * 0.05
  totalWeight += 0.05

  // Alternative Data: ESG (3%)
  if (stock.esgAnalysis?.score) {
    score += stock.esgAnalysis.score * 0.03
    totalWeight += 0.03
  }

  // Alternative Data: Short Interest (2%)
  if (stock.shortInterestAnalysis?.score) {
    score += stock.shortInterestAnalysis.score * 0.02
    totalWeight += 0.02
  }

  // Normalize by actual weights used
  return totalWeight > 0 ? (score / totalWeight * 100) : 50 // Default neutral
}
```

### Recommendation Thresholds
```typescript
function getRecommendation(score: number): 'BUY' | 'SELL' | 'HOLD' {
  if (score >= 70) return 'BUY'      // Strong conviction threshold
  if (score <= 30) return 'SELL'     // Risk mitigation threshold
  return 'HOLD'                      // Neutral/uncertain territory
}
```

---

## Complete Data Structure Specification

### Primary Response Interface
```typescript
interface EnhancedStockData extends StockData {
  // Core Financial Data (Always Present)
  symbol: string                    // Stock ticker symbol
  price: number                     // Current price
  change: number                    // Price change from previous close
  changePercent: number             // Percentage change
  volume: number                    // Current volume
  timestamp: number                 // Unix timestamp
  source: string                    // Primary data source identifier
  sector?: string                   // Business sector classification

  // Extended Market Data (5% Weight)
  bid?: number                      // Current bid price
  ask?: number                      // Current ask price
  preMarketPrice?: number           // Pre-market trading price
  preMarketChange?: number          // Pre-market price change
  preMarketChangePercent?: number   // Pre-market percentage change
  afterHoursPrice?: number          // After-hours trading price
  afterHoursChange?: number         // After-hours price change
  afterHoursChangePercent?: number  // After-hours percentage change

  // Analysis Components (Dynamic Availability)
  technicalAnalysis?: TechnicalAnalysisResult
  fundamentals?: FundamentalRatios
  analystRating?: AnalystRatings
  priceTarget?: PriceTarget
  sentimentAnalysis?: SentimentAnalysisResult
  macroeconomicAnalysis?: MacroeconomicAnalysisResult
  esgAnalysis?: ESGAnalysisResult
  shortInterestAnalysis?: ShortInterestAnalysisResult
  extendedMarketData?: ExtendedMarketDataResult
  currencyData?: CurrencyAnalysisResult

  // Composite Results
  compositeScore?: number           // 0-100 final weighted score
  recommendation?: 'BUY' | 'SELL' | 'HOLD'
}
```

### Technical Analysis Component (35% Weight)
```typescript
interface TechnicalAnalysisResult {
  score: number                     // 0-100 overall technical score

  trend: {
    direction: 'bullish' | 'bearish' | 'neutral'
    strength: number                // 0-1 trend strength
    confidence: number              // 0-1 confidence in trend analysis
  }

  momentum: {
    signal: 'buy' | 'sell' | 'hold'
    strength: number                // 0-1 momentum strength
  }

  summary: string                   // Human-readable technical summary

  // Detailed Technical Indicators (Available in full analysis)
  indicators?: {
    rsi: number                     // Relative Strength Index (0-100)
    macd: {
      macd: number
      signal: number
      histogram: number
    }
    movingAverages: {
      sma20: number                 // 20-day Simple Moving Average
      sma50: number                 // 50-day Simple Moving Average
      ema12: number                 // 12-day Exponential Moving Average
      ema26: number                 // 26-day Exponential Moving Average
    }
    bollinger: {
      upper: number
      middle: number
      lower: number
      position: number              // Price position within bands (0-1)
    }
    vwap?: {                        // Volume Weighted Average Price
      current: number
      deviation: number
      deviationPercent: number
      signal: 'above' | 'below' | 'at'
      strength: 'weak' | 'moderate' | 'strong'
    }
  }
}
```

### Fundamental Analysis Component (25% Weight)
```typescript
interface FundamentalRatios {
  symbol: string

  // Valuation Ratios
  peRatio?: number                  // Price-to-Earnings ratio
  pegRatio?: number                 // PEG ratio (growth-adjusted P/E)
  pbRatio?: number                  // Price-to-Book ratio
  priceToSales?: number             // Price-to-Sales ratio
  priceToFreeCashFlow?: number      // Price-to-Free-Cash-Flow ratio

  // Financial Health Ratios
  debtToEquity?: number             // Debt-to-Equity ratio
  currentRatio?: number             // Current ratio (liquidity)
  quickRatio?: number               // Quick ratio (acid test)

  // Profitability Ratios
  roe?: number                      // Return on Equity
  roa?: number                      // Return on Assets
  grossProfitMargin?: number        // Gross profit margin
  operatingMargin?: number          // Operating margin
  netProfitMargin?: number          // Net profit margin

  // Dividend Information
  dividendYield?: number            // Dividend yield
  payoutRatio?: number              // Dividend payout ratio

  // Metadata
  period: 'annual' | 'quarterly' | 'ttm'
  timestamp: number
  source: string
}
```

### Macroeconomic Analysis Component (20% Weight)
```typescript
interface MacroeconomicAnalysisResult {
  score: number                     // 0-100 macro environment score
  cyclephase: string                // Economic cycle phase
  sectorImpact: string              // Sector-specific impact assessment
  adjustedScore: number             // Stock score adjusted for macro factors
  economicRisk: number              // Economic risk assessment (0-1)
  summary: string                   // Human-readable macro summary

  // Detailed Analysis (Available in full response)
  indicators?: {
    gdp: {
      growth: number                // GDP growth rate
      trend: 'expanding' | 'contracting' | 'stable'
    }
    inflation: {
      current: number               // Current inflation rate
      trend: 'rising' | 'falling' | 'stable'
      impact: 'positive' | 'negative' | 'neutral'
    }
    interestRates: {
      fedFunds: number              // Federal Funds Rate
      treasury10y: number           // 10-year Treasury yield
      yieldCurveSlope: number       // Yield curve slope
      isInverted: boolean           // Yield curve inversion flag
    }
    employment: {
      unemploymentRate: number      // Unemployment rate
      trend: 'improving' | 'deteriorating' | 'stable'
    }
  }

  sectorSensitivity: {
    interestRates: number           // -1 to 1 (sensitivity to rate changes)
    inflation: number               // -1 to 1 (sensitivity to inflation)
    gdpGrowth: number              // -1 to 1 (sensitivity to GDP growth)
    dollarStrength: number          // -1 to 1 (sensitivity to USD strength)
  }
}
```

### Sentiment Analysis Component (10% Weight) - ✅ ACTIVELY INTEGRATED

**Status**: Production-ready sentiment integration with architecture fix implemented September 2024.

**Integration Pattern**: Pre-fetch sentiment data in `AlgorithmEngine` before composite calculation to ensure proper utilization.

```typescript
interface SentimentAnalysisResult {
  score: number                     // 0-100 overall sentiment score
  impact: 'positive' | 'negative' | 'neutral'
  confidence: number                // 0-1 confidence in sentiment analysis
  newsVolume: number                // Number of news articles analyzed
  adjustedScore: number             // Stock score adjusted for sentiment - ✅ UTILIZED IN COMPOSITE
  summary: string                   // Human-readable sentiment summary

  // Detailed Sentiment Breakdown
  components?: {
    yahooFinanceNews: {
      sentiment: number             // Yahoo Finance news sentiment (-1 to 1)
      confidence: number            // News confidence (0-1)
      articleCount: number          // Articles analyzed
      sources: string[]             // News sources (Yahoo Finance API)
      keyTopics: string[]           // Main topics mentioned
      responseTime: number          // API response time in ms
    }
    reddit?: {
      sentiment: number             // Reddit sentiment (0-1)
      confidence: number            // Reddit confidence (0-1)
      postCount: number             // Posts analyzed
      avgScore: number              // Average Reddit score
      avgUpvoteRatio: number        // Average upvote ratio
      subredditBreakdown: Array<{
        subreddit: string
        sentiment: number
        postCount: number
        weight: number
      }>
      enhancedAPI: boolean          // Using RedditAPIEnhanced
    }
  }

  trends?: {
    trend: 'improving' | 'declining' | 'stable'
    changePercent: number           // Recent sentiment change
    timeframe: string               // Analysis timeframe
  }
}
```

### ESG Analysis Component (3% Weight)
```typescript
interface ESGAnalysisResult {
  score: number                     // 0-100 overall ESG score
  impact: 'positive' | 'negative' | 'neutral'
  factors: string[]                 // Key ESG factors identified
  confidence: number                // 0-1 confidence in ESG analysis
  adjustedScore: number             // Stock score adjusted for ESG
  summary: string                   // Human-readable ESG summary

  // ESG Breakdown
  components?: {
    environmental: number           // Environmental score (0-100)
    social: number                  // Social score (0-100)
    governance: number              // Governance score (0-100)
  }

  risks?: string[]                  // ESG-related risks
  opportunities?: string[]          // ESG-related opportunities
}
```

### Short Interest Analysis Component (2% Weight)
```typescript
interface ShortInterestAnalysisResult {
  score: number                     // 0-100 overall short interest score
  impact: 'positive' | 'negative' | 'neutral'
  factors: string[]                 // Key short interest factors
  confidence: number                // 0-1 confidence in analysis
  shortInterestRatio: number        // Short interest as % of float
  adjustedScore: number             // Stock score adjusted for short interest
  summary: string                   // Human-readable short interest summary

  // Short Interest Details
  metrics?: {
    shortInterest: number           // Current short interest shares
    floatShort: number              // Percentage of float sold short
    shortRatio: number              // Days to cover ratio
    shortChange: number             // Change from previous period
  }

  analysis?: {
    squeezeRisk: 'high' | 'medium' | 'low'
    trend: 'increasing' | 'decreasing' | 'stable'
    significance: string            // Impact assessment
  }
}
```

### Analyst Intelligence
```typescript
interface AnalystRatings {
  symbol: string
  consensus: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'

  // Rating Distribution
  strongBuy: number                 // Count of Strong Buy ratings
  buy: number                       // Count of Buy ratings
  hold: number                      // Count of Hold ratings
  sell: number                      // Count of Sell ratings
  strongSell: number                // Count of Strong Sell ratings
  totalAnalysts: number             // Total analyst count

  sentimentScore: number            // 1-5 scale (1=Strong Sell, 5=Strong Buy)
  timestamp: number
  source: string
}

interface PriceTarget {
  symbol: string
  targetHigh: number                // Highest price target
  targetLow: number                 // Lowest price target
  targetConsensus: number           // Consensus price target
  targetMedian: number              // Median price target
  currentPrice?: number             // Current price for reference
  upside?: number                   // Percentage upside to consensus

  // Analyst Coverage Metrics
  lastMonthCount?: number           // Targets set in last month
  lastQuarterCount?: number         // Targets set in last quarter
  lastYearCount?: number            // Targets set in last year

  timestamp: number
  source: string
}
```

---

## Data Quality and Confidence Metrics

### Quality Score Structure
```typescript
interface DataQuality {
  overall: number                   // 0-1 overall quality score
  metrics: {
    freshness: number               // 0-1 (how recent is the data)
    completeness: number            // 0-1 (percentage of fields populated)
    accuracy: number                // 0-1 (estimated accuracy)
    sourceReputation: number        // 0-1 (reliability of data sources)
    latency: number                 // Milliseconds (response time)
  }
  timestamp: number
  source: string
}

interface ConfidenceMetrics {
  technical: number                 // 0-1 confidence in technical analysis
  fundamental: number               // 0-1 confidence in fundamental data
  sentiment: number                 // 0-1 confidence in sentiment analysis
  macro: number                     // 0-1 confidence in macro analysis
  overall: number                   // 0-1 overall confidence
}
```

### Source Attribution
```typescript
interface SourceBreakdown {
  stockPrice: string                // Primary price data source
  companyInfo: string               // Company information source
  marketData: string                // Market data source
  fundamentalRatios: string         // Fundamental ratios source
  analystRatings: string           // Analyst ratings source
  priceTargets: string             // Price targets source
  technicalAnalysis: string        // Technical analysis source
  sentiment: string                 // Sentiment analysis source
  macro: string                     // Macroeconomic data source
  esg: string                      // ESG data source
  shortInterest: string            // Short interest data source
}
```

---

## Cache Strategy and Refresh Rates

### Cache TTL Configuration
```typescript
interface CacheTTLSettings {
  // Real-time Data (High Frequency Updates)
  stockPrices: 60000               // 1 minute
  marketData: 60000                // 1 minute
  extendedHoursData: 120000        // 2 minutes

  // Analysis Data (Medium Frequency Updates)
  technicalAnalysis: 300000        // 5 minutes
  sentimentAnalysis: 600000        // 10 minutes

  // Fundamental Data (Low Frequency Updates)
  fundamentalRatios: 3600000       // 1 hour
  analystRatings: 3600000          // 1 hour
  macroeconomicData: 1800000       // 30 minutes

  // Alternative Data (Very Low Frequency Updates)
  esgData: 86400000               // 24 hours
  shortInterestData: 3600000       // 1 hour
}
```

### Data Source Priority Matrix
| Tier | Sources | Rate Limit | Reliability | Use Case |
|------|---------|------------|-------------|----------|
| **Premium** | Polygon.io, Alpha Vantage, FMP | 5000/day, 500/day, 250/day | 99.9%, 99.5%, 99.7% | Real-time prices, VWAP, fundamentals |
| **Enhanced** | EODHD, TwelveData | 100k/day, 800/day | 99.0%, 98.5% | International data, technical indicators |
| **Government** | SEC EDGAR, FRED, BLS, EIA | Unlimited | 99.9%, 99.9%, 99.8%, 99.7% | Regulatory filings, economic data |
| **Social Intel** | Yahoo Finance Sentiment, Reddit WSB Enhanced | N/A, OAuth2 | 95.0%, 98.0% | High-performance sentiment analysis |
| **Primary** | Yahoo Finance REST API | N/A | 92.0% | Direct stock data, fundamentals |
| **Backup** | Yahoo Finance | N/A | 90.0% | Emergency fallback |

---

## Performance Characteristics

### Response Time Targets
```typescript
interface PerformanceTargets {
  singleStockAnalysis: 3000        // 3 seconds maximum
  multipleStockAnalysis: 5000      // 5 seconds for up to 10 stocks
  sectorAnalysis: 8000             // 8 seconds for sector-wide analysis

  componentBreakdown: {
    dataFetch: 1000                // 1 second for parallel data fetching
    technicalAnalysis: 500         // 500ms for technical calculations
    sentimentProcessing: 800       // 800ms for sentiment analysis
    scoring: 200                   // 200ms for composite scoring
    caching: 100                   // 100ms for cache operations
  }
}
```

### Memory Management
```typescript
interface MemoryConfiguration {
  jestHeapSize: 4096              // 4GB heap allocation for testing
  maxWorkersTest: 1               // Single worker to prevent memory pressure
  gcExplicit: true                // Explicit garbage collection enabled
  requestConcurrency: 10          // Maximum concurrent analysis requests

  cacheLimits: {
    redisMaxMemory: '2gb'         // Redis memory limit
    inMemoryFallback: '500mb'     // In-memory cache limit
    requestBuffer: '100mb'        // Buffer for active requests
  }
}
```

---

## Error Handling and Graceful Degradation

### Error Response Structure
```typescript
interface AnalysisErrorResponse {
  success: false
  error: string                   // Sanitized error message
  partialData?: Partial<EnhancedStockData>
  degradedServices: string[]      // List of unavailable services
  fallbacksUsed: string[]         // List of fallback sources used
  timestamp: number
}
```

### Graceful Degradation Patterns
```typescript
interface DegradationStrategy {
  // Service Unavailable Fallbacks
  technicalAnalysis: {
    primary: 'TechnicalIndicatorService'
    fallback: 'simplified_indicators'
    gracefulFail: 'exclude_from_composite'
  }

  sentimentAnalysis: {
    primary: 'NewsAPI + Reddit'
    fallback: 'NewsAPI_only'
    gracefulFail: 'neutral_sentiment_assumption'
  }

  fundamentalData: {
    primary: 'FMP + AlphaVantage'
    fallback: 'single_source'
    gracefulFail: 'exclude_fundamental_component'
  }

  // Composite Score Rebalancing
  rebalancing: {
    missingTechnical: 'redistribute_to_fundamental_and_macro'
    missingSentiment: 'redistribute_to_technical_and_fundamental'
    missingMacro: 'redistribute_to_technical_analysis'
  }
}
```

---

## AI Agent Interface Design Guidelines

### Visual Priority Hierarchy
```typescript
interface VisualPriority {
  // Primary Display (Always Visible)
  level1: {
    compositeScore: number        // Large, prominent display (0-100)
    recommendation: string        // BUY/SELL/HOLD with color coding
    currentPrice: number          // Real-time price with change indicator
    confidence: number            // Overall confidence in analysis
  }

  // Secondary Display (Expandable Sections)
  level2: {
    technicalSummary: string      // Brief technical outlook
    fundamentalHighlights: string[] // Key fundamental metrics
    sentimentOverview: string     // Sentiment summary
    macroImpact: string          // Economic environment impact
  }

  // Detailed Display (Drill-down Views)
  level3: {
    fullTechnicalAnalysis: TechnicalAnalysisResult
    completeFundamentals: FundamentalRatios
    detailedSentiment: SentimentAnalysisResult
    macroBreakdown: MacroeconomicAnalysisResult
    analystIntelligence: AnalystRatings & PriceTarget
  }
}
```

### Card Design Specifications
```typescript
interface AnalysisCardConfig {
  // Card Types
  summary: {
    height: '300px'
    components: ['score', 'recommendation', 'price', 'change', 'summary']
    updateFrequency: 'real-time'
  }

  technical: {
    height: '400px'
    components: ['trend', 'momentum', 'indicators', 'vwap', 'summary']
    visualizations: ['candlestick', 'volume', 'moving_averages']
  }

  fundamental: {
    height: '350px'
    components: ['ratios', 'health_score', 'peer_comparison', 'trends']
    layout: 'grid_2x3'
  }

  sentiment: {
    height: '300px'
    components: ['sentiment_gauge', 'news_volume', 'reddit_activity', 'trends']
    realTimeUpdates: true
  }

  // Interactive Elements
  interactions: {
    expandable: boolean           // Can expand to show detailed view
    drilling: 'component' | 'full' // Drill-down capability
    refresh: 'manual' | 'auto'    // Refresh mechanism
    export: boolean               // Export functionality
  }
}
```

### State Management
```typescript
interface AnalysisState {
  // Loading States
  loading: {
    initial: boolean              // First load
    refresh: boolean              // Refreshing data
    partial: string[]             // Components still loading
  }

  // Error States
  error: {
    global: string | null         // Global error message
    components: Record<string, string> // Component-specific errors
    retryable: boolean            // Whether retry is possible
  }

  // Data States
  data: {
    lastUpdated: number           // Last successful update
    staleness: 'fresh' | 'stale' | 'expired'
    completeness: number          // 0-1 completeness score
  }

  // User Interaction States
  ui: {
    expandedSections: string[]    // Currently expanded sections
    selectedTimeframe: string     // Selected analysis timeframe
    preferences: UserPreferences  // User display preferences
  }
}
```

---

## Extensibility Framework

### Plugin Architecture
```typescript
interface AnalysisPlugin {
  id: string                      // Unique plugin identifier
  name: string                    // Human-readable name
  version: string                 // Plugin version
  weight: number                  // Weight in composite score (0-1)

  analyze(stock: StockData): Promise<PluginResult>

  config: {
    dependencies: string[]        // Required services/data
    cacheSettings: {
      ttl: number                 // Cache TTL in milliseconds
      strategy: 'aggressive' | 'conservative'
    }
    visualization: {
      cardType: string            // Preferred card visualization
      priority: number            // Display priority (1-10)
    }
  }
}

interface PluginResult {
  score: number                   // 0-100 plugin-specific score
  impact: 'positive' | 'negative' | 'neutral'
  confidence: number              // 0-1 confidence in result
  insights: string[]              // Key insights from analysis
  data: Record<string, any>       // Plugin-specific data
  visualization?: ComponentConfig // Optional visualization config
}
```

### Future Enhancement Hooks
```typescript
interface ExtensibilityHooks {
  // Pre-analysis Hooks
  beforeDataFetch: (symbols: string[]) => Promise<void>
  beforeAnalysis: (stockData: StockData[]) => Promise<StockData[]>

  // Analysis Enhancement Hooks
  enhanceTechnical: (technical: TechnicalAnalysisResult) => TechnicalAnalysisResult
  enhanceFundamental: (fundamental: FundamentalRatios) => FundamentalRatios
  enhanceSentiment: (sentiment: SentimentAnalysisResult) => SentimentAnalysisResult

  // Post-analysis Hooks
  afterScoring: (score: number, components: any) => number
  beforeResponse: (response: EnhancedStockData) => EnhancedStockData

  // Custom Scoring Algorithms
  customCompositeScoring?: (components: ScoringComponents) => number
  riskAdjustments?: (score: number, riskFactors: RiskFactors) => number
}
```

---

## Implementation Context for AI Agents

### Key Implementation Files
```typescript
interface ImplementationPaths {
  // Core Service Layer
  stockSelection: 'app/services/stock-selection/StockSelectionService.ts'
  apiEndpoint: 'app/api/stocks/select/route.ts'

  // Analysis Components with Sentiment Integration
  algorithmEngine: 'app/services/algorithms/AlgorithmEngine.ts' // ✅ Sentiment pre-fetch integration (lines 446-470)
  factorLibrary: 'app/services/algorithms/FactorLibrary.ts'     // ✅ Composite sentiment integration (lines 1614-1676)
  technicalService: 'app/services/technical-analysis/TechnicalIndicatorService.ts'
  sentimentService: 'app/services/financial-data/SentimentAnalysisService.ts' // ✅ Production-ready sentiment analysis
  macroService: 'app/services/financial-data/MacroeconomicAnalysisService.ts'

  // Data Providers
  financialData: 'app/services/financial-data/index.ts'
  polygonAPI: 'app/services/financial-data/PolygonAPI.ts'
  alphaVantage: 'app/services/financial-data/AlphaVantageAPI.ts'

  // Type Definitions
  coreTypes: 'app/services/financial-data/types.ts'
  sentimentTypes: 'app/services/financial-data/types/sentiment-types.ts'
  macroTypes: 'app/services/financial-data/types/macroeconomic-types.ts'

  // Caching and Performance
  redisCache: 'app/services/cache/RedisCache.ts'
  errorHandling: 'app/services/error-handling/ErrorHandler.ts'
  security: 'app/services/security/SecurityValidator.ts'
}
```

### Development Standards
```typescript
interface DevelopmentContext {
  // Non-Negotiable Rules
  principles: [
    'NO_MOCK_DATA',              // Always use real APIs
    'TYPESCRIPT_STRICT',         // Strict type checking required
    'PERFORMANCE_FIRST',         // Optimize for Core Web Vitals
    'GRACEFUL_DEGRADATION',      // Handle failures gracefully
    'SECURITY_BY_DESIGN'         // OWASP Top 10 compliance
  ]

  // Testing Requirements
  testing: {
    framework: 'Jest'
    memoryConfig: '4096MB heap, maxWorkers: 1'
    timeout: '300000ms (5 minutes)'
    coverage: 'Service layer comprehensive coverage'
    realAPIs: true              // NO MOCK DATA in tests
  }

  // Performance Requirements
  performance: {
    analysisTime: '< 3 seconds'
    cacheHitRate: '> 85%'
    errorRate: '< 1%'
    memoryUsage: '< 4GB'
  }
}
```

---

## Conclusion

This technical specification provides the complete data model and implementation context for designing AI-powered Analysis Cards within the VFR Financial Analysis Platform. The specification emphasizes:

1. **Real-time Data Integration**: No mock data - all analysis based on live financial markets
2. **Composite Intelligence**: Six-component scoring system with intelligent weight distribution
3. **Graceful Degradation**: Robust fallback strategies maintaining service availability
4. **Performance Optimization**: Sub-3-second analysis with intelligent caching
5. **Extensibility**: Plugin architecture supporting future enhancement
6. **Production Readiness**: Enterprise-grade security, error handling, and monitoring

AI agents should use this specification to create user interfaces that surface actionable investment insights while maintaining data integrity and performance standards. The modular design allows for progressive enhancement and customization based on user needs and market conditions.

**Reference Integration**: Use Context7 MCP for real-time API documentation and the codebase structure detailed in this specification for implementation guidance.