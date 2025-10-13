# Financial Modeling Prep (FMP) API Usage Documentation

**Created**: 2025-10-13
**Version**: 1.0
**Status**: Production
**API Provider**: [Financial Modeling Prep](https://financialmodelingprep.com/)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Complete Usage Inventory](#complete-usage-inventory)
4. [Service Layer Documentation](#service-layer-documentation)
5. [Analysis Engine Integration](#analysis-engine-integration)
6. [ML Model Building](#ml-model-building)
7. [API Routes](#api-routes)
8. [Frontend Components](#frontend-components)
9. [Configuration](#configuration)
10. [Dependencies and Related Services](#dependencies-and-related-services)
11. [Rate Limiting and Performance](#rate-limiting-and-performance)
12. [Best Practices](#best-practices)

---

## Overview

### What is FMP API?

Financial Modeling Prep is a comprehensive financial data API that provides:
- Real-time and historical stock prices
- Fundamental data (income statements, balance sheets, cash flow)
- Company profiles and information
- Analyst ratings and price targets
- Institutional ownership and insider trading data
- Economic indicators (treasury rates, Fed funds rate)
- ESG ratings
- Social sentiment data
- Stock news and market data

### Why FMP in This Project?

FMP serves as the **primary data source** for the VFR Financial Analysis Platform with the following advantages:

1. **Comprehensive Data Coverage**: Single API for most financial data needs
2. **Reliable Performance**: 300 requests/minute on starter plan
3. **Data Quality**: Institutional-grade accuracy
4. **Cost Efficiency**: Better price/feature ratio than alternatives
5. **API Stability**: Well-documented with consistent endpoints

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VFR Analysis Platform                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         FinancialDataService (Orchestrator)          │  │
│  │              - Multi-source failover                  │  │
│  │              - Rate limit management                  │  │
│  │              - Request queueing                       │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │       FinancialModelingPrepAPI (Main Module)        │  │
│  │              - Central orchestrator                   │  │
│  │              - Delegates to domain modules            │  │
│  └──┬───────────────────┬────────────────┬──────────────┘  │
│     │                   │                │                  │
│  ┌──▼──────────┐  ┌────▼─────────┐  ┌──▼─────────────┐   │
│  │ FMPMarket   │  │ FMPFundamen  │  │ FMPInstitution │   │
│  │ DataAPI     │  │ talsAPI      │  │ alAPI          │   │
│  │             │  │              │  │                │   │
│  │ - Prices    │  │ - Ratios     │  │ - Analysts     │   │
│  │ - OHLCV     │  │ - Statements │  │ - Ownership    │   │
│  │ - Historical│  │ - Dividends  │  │ - Insiders     │   │
│  └─────────────┘  └──────────────┘  └────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            FMPCacheManager (Optimization)            │  │
│  │              - Intelligent TTL management             │  │
│  │              - Priority-based eviction                │  │
│  │              - Compression for large datasets         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Benefits

- **Single Primary Source**: 90%+ of financial data needs covered by FMP
- **Modular Architecture**: Domain-specific APIs for maintainability
- **Intelligent Caching**: Variable TTLs based on data volatility
- **Rate Limit Optimization**: 300 req/min managed efficiently
- **Real API Testing**: No mock data in production code

---

## Architecture

### Module Organization

The FMP integration is organized into **four core modules**:

```
app/services/financial-data/
├── FinancialModelingPrepAPI.ts    # Main orchestrator
├── FMPCacheManager.ts              # Caching optimization
└── fmp/
    ├── FMPMarketDataAPI.ts         # Price & OHLCV data
    ├── FMPFundamentalsAPI.ts       # Financial statements & ratios
    └── FMPInstitutionalAPI.ts      # Analyst & ownership data
```

#### 1. **FinancialModelingPrepAPI** (Main Orchestrator)

**Location**: `/app/services/financial-data/FinancialModelingPrepAPI.ts` (731 lines)

**Purpose**: Central coordination and delegation

**Responsibilities**:
- Delegates to domain-specific modules
- Implements economic data endpoints (treasury rates, Fed funds)
- Provides comprehensive data aggregation
- Maintains backward compatibility
- Health check orchestration

**Key Methods**:
```typescript
// Market Data (Delegated)
getStockPrice(symbol: string): Promise<StockData | null>
getMarketData(symbol: string): Promise<MarketData | null>
getHistoricalData(symbol: string, limit?: number): Promise<MarketData[]>
getBatchPrices(symbols: string[]): Promise<Map<string, StockData>>

// Fundamentals (Delegated)
getCompanyInfo(symbol: string): Promise<CompanyInfo | null>
getFundamentalRatios(symbol: string): Promise<FundamentalRatios | null>
getIncomeStatement(symbol: string): Promise<FinancialStatement[]>
getBalanceSheet(symbol: string): Promise<BalanceSheet[]>
getCashFlowStatement(symbol: string): Promise<CashFlowStatement[]>
getEarningsCalendar(symbol: string): Promise<Array<{...}>>

// Institutional (Delegated)
getAnalystRatings(symbol: string): Promise<AnalystRatings | null>
getPriceTargets(symbol: string): Promise<PriceTarget | null>
getInstitutionalOwnership(symbol: string): Promise<{...} | null>
getInsiderTrading(symbol: string): Promise<{...} | null>

// Economic Data (Direct Implementation)
getEconomicCalendar(from?: string, to?: string): Promise<EconomicEvent[]>
getTreasuryRates(from?: string, to?: string): Promise<TreasuryRate[]>
getFederalFundsRate(from?: string, to?: string): Promise<Array<{...}>>

// Multi-Module Orchestration
getComprehensiveFinancialData(symbol: string, options?: {...}): Promise<{...}>
healthCheck(): Promise<boolean>
```

#### 2. **FMPMarketDataAPI** (Domain Module)

**Location**: `/app/services/financial-data/fmp/FMPMarketDataAPI.ts` (534 lines)

**Purpose**: Real-time and historical price data

**Data Types**:
- Current stock prices (quote endpoint)
- OHLCV historical data
- Batch price requests
- Market data with volume

**Features**:
- Redis caching with 30-day TTL for historical data
- Plan-aware batch processing (basic/starter/professional)
- Enhanced error detection (rate limits, invalid keys)
- Cache-first strategy for immutable historical data

**Performance Optimizations**:
```typescript
// Plan-specific batch configurations
const config = {
  basic: {
    batchSize: 10,
    maxConcurrentBatches: 1,
    requestInterval: 100,
    utilizationTarget: 70
  },
  starter: {
    batchSize: 25,
    maxConcurrentBatches: 2,
    requestInterval: 50,
    utilizationTarget: 80
  },
  professional: {
    batchSize: 50,
    maxConcurrentBatches: 3,
    requestInterval: 20,
    utilizationTarget: 90
  }
};
```

#### 3. **FMPFundamentalsAPI** (Domain Module)

**Location**: `/app/services/financial-data/fmp/FMPFundamentalsAPI.ts` (1042 lines)

**Purpose**: Company fundamentals and financial statements

**Data Types**:
- Company profiles
- Financial ratios (PE, PB, debt/equity, margins)
- Income statements (annual/quarterly)
- Balance sheets
- Cash flow statements
- Dividends and stock splits
- ESG ratings
- Earnings surprises and calendar

**Security Features**:
- Input validation with SecurityValidator
- Numeric validation with bounds checking
- Field-level sanitization
- Error message sanitization

**Batch Processing**:
- Adaptive delay between batches
- Success rate tracking
- Utilization efficiency metrics
- Graceful degradation on partial failures

#### 4. **FMPInstitutionalAPI** (Domain Module)

**Location**: `/app/services/financial-data/fmp/FMPInstitutionalAPI.ts` (1027 lines)

**Purpose**: Analyst and institutional data

**Data Types**:
- Analyst ratings and consensus
- Price targets (high/low/consensus/median)
- Rating changes (upgrades/downgrades)
- Institutional ownership (13F filings)
- Insider trading (Form 4 filings)
- Social sentiment (StockTwits, Twitter)
- Stock news

**Intelligent Fallback**:
- Multiple endpoint attempts (v3, v4, bulk)
- Synthetic ratings from price targets
- Informed placeholders for major stocks
- Sentiment-driven rating generation

#### 5. **FMPCacheManager** (Optimization Module)

**Location**: `/app/services/financial-data/FMPCacheManager.ts` (460 lines)

**Purpose**: FMP-specific caching optimization

**Features**:
- Variable TTLs based on data volatility
- Priority-based eviction (critical > high > medium > low)
- Compression for large datasets (>1KB)
- Usage-based cache retention
- Proactive refresh notifications

**Cache Configurations**:

| Data Type | TTL | Priority | Compression | Refresh Threshold |
|-----------|-----|----------|-------------|-------------------|
| stock_price | 60s | high | No | 80% |
| market_data | 2m | high | No | 80% |
| fundamental_ratios | 1h | critical | Yes | 70% |
| company_info | 2h | medium | Yes | 60% |
| analyst_ratings | 30m | medium | Yes | 70% |
| income_statement | 24h | critical | Yes | 30% |
| dividend_data | 7d | medium | Yes | 20% |
| esg_rating | 3d | low | Yes | 30% |

---

## Complete Usage Inventory

### Service Layer (Core Integrations)

#### Primary FMP Services

1. **FinancialModelingPrepAPI.ts** (731 lines)
   - Main orchestrator
   - All methods listed in Architecture section
   - Lines: 1-731

2. **FMPMarketDataAPI.ts** (534 lines)
   - Market data module
   - Lines: 1-534

3. **FMPFundamentalsAPI.ts** (1042 lines)
   - Fundamentals module
   - Lines: 1-1042

4. **FMPInstitutionalAPI.ts** (1027 lines)
   - Institutional data module
   - Lines: 1-1027

5. **FMPCacheManager.ts** (460 lines)
   - Cache optimization
   - Lines: 1-460

#### Service Integrations

6. **FinancialDataService.ts** (Lines 20, 64, 77-78)
   - Imports and initializes FMP as primary data source
   - Feature flag: `ENABLE_FMP`
   - Manages 300 req/min rate limit
   ```typescript
   if (process.env.FMP_API_KEY && isFmpEnabled) {
     this.dataSources.push({
       name: "Financial Modeling Prep",
       provider: new FinancialModelingPrepAPI(),
       priority: 1,
       rateLimit: 300
     });
   }
   ```

7. **InstitutionalDataService.ts** (Lines 22, 77)
   - Uses FMP for institutional ownership
   - Insider trading data
   - 13F filings

8. **VWAPService.ts** (Line 7)
   - Volume-weighted average price calculations
   - Uses FMP historical data

9. **DataSourceManager.ts** (Lines 7, 166)
   - Multi-source orchestration
   - Registers FMP provider

10. **MarketIndicesService.ts** (Lines 8, 92, 98)
    - Market indices data
    - S&P 500, NASDAQ, etc.

11. **SectorDataService.ts** (Lines 6, 62, 64)
    - Sector screening
    - Industry performance

12. **ExtendedMarketDataService.ts** (Line 8)
    - Extended market hours data

13. **ESGDataService.ts** (Line 250)
    - ESG ratings fallback

14. **PollingManager.ts** (Line 6)
    - Real-time data polling

### Analysis Engine Integration

15. **AlgorithmEngine.ts** (Line 760)
    - Factor calculation
    - Multi-factor scoring
    - Real-time price data for algorithms

16. **FactorLibrary.ts**
    - Technical factors
    - Fundamental factors
    - Uses FMP for raw data

17. **StockSelectionService.ts** (Line 2662)
    - Stock universe screening
    - Shared FMP instance
    ```typescript
    sharedFmpAPI = new FinancialModelingPrepAPI();
    ```

### ML Feature Engineering

18. **FeatureEngineeringService.ts** (Lines 5, 49)
    - Feature extraction for ML models
    - VWAP features
    ```typescript
    this.vwapService = new VWAPService(new FinancialModelingPrepAPI(), this.cache);
    ```

19. **PricePredictionFeatureExtractor.ts** (Lines 24, 117)
    - Price prediction model features
    - Historical price patterns
    - Volume analysis

20. **FeatureExtractor.ts (Early Signal)** (Lines 15, 57)
    - Early signal detection features
    - Momentum indicators
    - Earnings surprises

21. **FundamentalFeatureIntegrator.ts** (Lines 17, 111)
    - Fundamental ratio features
    - Financial statement metrics
    - Growth rates

22. **TechnicalFeatureIntegrator.ts** (Lines 21, 132)
    - Technical indicator features
    - RSI, MACD, Bollinger Bands
    - Price patterns

23. **SentimentFusionFeatureExtractor.ts**
    - Sentiment analysis features
    - News sentiment integration

### ML Training Scripts

24. **generate-multi-source-datasets.ts** (Lines 45, 176, 221)
    - Multi-source dataset generation
    - Combines FMP with other sources
    - Training data pipeline

25. **generate-price-labels.ts** (Lines 14, 37)
    - Price movement labels
    - Future price predictions
    ```typescript
    const fmpAPI = new FinancialModelingPrepAPI();
    ```

26. **collect-analyst-history.ts** (Lines 11, 45)
    - Historical analyst ratings
    - Rating change tracking
    - Consensus history

27. **quick-test-labels.ts** (Lines 6, 9)
    - Label verification
    - Data quality checks

28. **label-generator.ts (Smart Money Flow)** (Lines 19, 96)
    - Smart money flow labels
    - Institutional activity signals

### API Routes (Next.js)

29. **/api/stocks/analyze/route.ts** (Lines 25, 101, 130)
    - Main stock analysis endpoint
    - Comprehensive data aggregation
    ```typescript
    const fmpAPI = new FinancialModelingPrepAPI(process.env.FMP_API_KEY);
    const vwapService = new VWAPService(fmpAPI);
    ```

30. **/api/stocks/analysis-frontend/route.ts** (Lines 26, 152, 181)
    - Frontend-specific analysis
    - Lightweight data for UI

31. **/api/admin/analysis/route.ts** (Lines 25, 232, 241)
    - Admin dashboard analysis
    - Extended metrics
    - Performance monitoring

32. **/api/admin/test-data-sources/route.ts** (Lines 10, 313, 348, 383, 772, 1374, 1397)
    - Data source testing
    - Health checks
    - API validation
    ```typescript
    apiInstance = new FinancialModelingPrepAPI(undefined, timeout, true);
    ```

33. **/api/stocks/search/route.ts**
    - Stock symbol search
    - Company lookup

34. **/api/market/sectors/route.ts**
    - Sector performance data

### Smart Money Flow ML Services

35. **HybridSmartMoneyDataService.ts** (Lines 26, 60)
    - Smart money flow detection
    - Institutional tracking
    - Options flow analysis

36. **SmartMoneyFlowFeatureExtractor.ts**
    - Smart money features
    - Flow indicators

### Frontend Components

37. **Stock Intelligence Page** (`/app/stock-intelligence`)
    - Uses analysis API which consumes FMP data
    - Real-time stock quotes

38. **Admin Dashboard** (`/app/admin`)
    - API testing interface
    - Performance monitoring
    - Rate limit tracking

39. **StockRecommendationCard.tsx**
    - Displays FMP-derived recommendations
    - Buy/Sell/Hold signals

40. **AnalysisProgress.tsx**
    - Shows FMP data fetching progress

41. **AnalysisResults.tsx**
    - Displays comprehensive FMP analysis

### Test Files

42. **verify-fmp-premium.ts** (Lines 2, 5)
    - Verifies FMP plan tier
    - Tests premium endpoints

43. **Test Scripts Archive** (`scripts/archive/ml/`)
    - test-fmp-upgrades.ts
    - test-fmp-fed-rate.ts
    - test-fmp-tier.ts

### Configuration Files

44. **README.md** (Line 94)
    - Environment setup
    ```bash
    FMP_API_KEY=your_key_here
    FMP_PLAN=starter  # or professional
    ENABLE_FMP=true
    ```

45. **.env.example**
    - FMP configuration template

### Supporting Services

46. **SmartMoneyDataService.ts**
    - Aggregates institutional data
    - Uses FMP institutional endpoints

47. **CongressionalTradingService.ts**
    - Congressional stock trades
    - May use FMP fallback

48. **CurrencyDataService.ts**
    - Currency exchange rates
    - FMP forex endpoints

49. **EarningsTranscriptService.ts**
    - Earnings call transcripts
    - FMP earnings data

50. **EnhancedSentimentAnalysisService.ts**
    - Social sentiment
    - FMP sentiment endpoints

---

## Service Layer Documentation

### Core API Methods

#### Market Data Methods

```typescript
// Get current stock price
async getStockPrice(symbol: string): Promise<StockData | null>
// Returns: { symbol, price, change, changePercent, volume, timestamp, source }
// Endpoint: /v3/quote/{symbol}
// Cache: 60 seconds (FMPCacheManager)
// Validation: Symbol format, price > 0, timestamp validity

// Get detailed OHLCV market data
async getMarketData(symbol: string): Promise<MarketData | null>
// Returns: { symbol, open, high, low, close, volume, timestamp, source }
// Endpoint: /v3/historical-price-full?symbol={symbol}&limit=365
// Cache: 2 minutes
// Note: Fetches 365 days but returns most recent

// Get historical price data
async getHistoricalData(
  symbol: string,
  limit: number = 365,
  endDate?: Date
): Promise<MarketData[]>
// Returns: Array of OHLCV data points
// Endpoint: /v3/historical-price-full/{symbol}
// Cache: 30 days (Redis - immutable historical data)
// Features:
//   - Cache-first strategy
//   - Date range support
//   - Optimized for ML training

// Batch price requests
async getBatchPrices(
  symbols: string[],
  options?: {
    planType?: "basic" | "starter" | "professional";
    priorityMode?: boolean;
  }
): Promise<Map<string, StockData>>
// Returns: Map of symbol -> StockData
// Endpoint: /v3/quote/{symbol1,symbol2,symbol3}
// Optimization:
//   - Plan-aware batching
//   - Adaptive delays
//   - Success rate tracking
```

#### Fundamental Data Methods

```typescript
// Get company profile
async getCompanyInfo(symbol: string): Promise<CompanyInfo | null>
// Returns: { symbol, name, description, sector, marketCap, employees, website }
// Endpoint: /v3/profile/{symbol}
// Cache: 2 hours

// Get financial ratios
async getFundamentalRatios(symbol: string): Promise<FundamentalRatios | null>
// Returns: PE, PB, P/S, debt/equity, ROE, ROA, margins, etc.
// Endpoints:
//   - /v3/ratios/{symbol}?limit=1
//   - /v3/key-metrics/{symbol}?limit=1
// Cache: 1 hour
// Security: Numeric validation with bounds checking

// Batch fundamental ratios
async getBatchFundamentalRatios(
  symbols: string[],
  options?: {
    planType?: "basic" | "starter" | "professional";
    rateLimit?: number;
    priorityMode?: boolean;
  }
): Promise<Map<string, FundamentalRatios>>
// Features:
//   - Adaptive batch processing
//   - Parallel requests with delays
//   - Utilization efficiency tracking
//   - Graceful degradation

// Get income statement
async getIncomeStatement(
  symbol: string,
  period: "annual" | "quarterly" = "annual",
  limit = 5
): Promise<FinancialStatement[]>
// Returns: Revenue, costs, operating income, net income, EPS, etc.
// Endpoint: /v3/income-statement/{symbol}?period={period}&limit={limit}
// Cache: 24 hours

// Get balance sheet
async getBalanceSheet(
  symbol: string,
  period: "annual" | "quarterly" = "annual",
  limit = 5
): Promise<BalanceSheet[]>
// Returns: Assets, liabilities, equity breakdown
// Endpoint: /v3/balance-sheet-statement/{symbol}
// Cache: 24 hours

// Get cash flow statement
async getCashFlowStatement(
  symbol: string,
  period: "annual" | "quarterly" = "annual",
  limit = 5
): Promise<CashFlowStatement[]>
// Returns: Operating, investing, financing cash flows
// Endpoint: /v3/cash-flow-statement/{symbol}
// Cache: 24 hours

// Get dividend data
async getDividendData(
  symbol: string,
  from?: string,
  to?: string
): Promise<DividendData[]>
// Endpoint: /v3/historical-price-full/stock_dividend/{symbol}
// Cache: 7 days

// Get stock splits
async getStockSplitData(
  symbol: string,
  from?: string,
  to?: string
): Promise<StockSplit[]>
// Endpoint: /v3/historical-price-full/stock_split/{symbol}
// Cache: 7 days

// Get ESG ratings
async getESGRating(symbol: string): Promise<ESGRating | null>
// Returns: Environmental, Social, Governance scores and grades
// Endpoint: /v3/esg-score?symbol={symbol}
// Cache: 3 days

// Get earnings surprises
async getEarningsSurprises(
  symbol: string,
  limit = 60
): Promise<Array<{ date, actualEarningResult, estimatedEarning }>>
// Derived from quarterly income statements
// Cache: 1 hour

// Get earnings calendar
async getEarningsCalendar(symbol: string): Promise<Array<{...}>>
// Returns: Upcoming earnings dates, EPS estimates, timing
// Endpoint: /v3/historical/earning_calendar/{symbol}
// Cache: 1 hour
```

#### Institutional Data Methods

```typescript
// Get analyst ratings
async getAnalystRatings(symbol: string): Promise<AnalystRatings | null>
// Returns: { consensus, strongBuy, buy, hold, sell, strongSell, totalAnalysts, sentimentScore }
// Endpoints (with fallback):
//   1. /v4/upgrades-downgrades-consensus?symbol={symbol}
//   2. /v3/rating/{symbol}
//   3. Synthetic from price targets
//   4. Informed placeholder for major stocks
// Cache: 30 minutes
// Features: Intelligent fallback chain

// Get price targets
async getPriceTargets(symbol: string): Promise<PriceTarget | null>
// Returns: { targetHigh, targetLow, targetConsensus, targetMedian, currentPrice, upside }
// Endpoint: /v3/price-target-consensus?symbol={symbol}
// Cache: 30 minutes

// Get rating changes
async getRecentRatingChanges(
  symbol: string,
  limit = 10
): Promise<RatingChange[]>
// Returns: Recent analyst upgrades/downgrades with analysts and reasoning
// Endpoint: /v3/price-target-latest-news?symbol={symbol}
// Cache: 30 minutes

// Get institutional ownership
async getInstitutionalOwnership(
  symbol: string,
  limit = 20
): Promise<{...} | null>
// Returns: 13F holders with shares, value, changes
// Endpoint: /v4/institutional-ownership/symbol-ownership?symbol={symbol}
// Cache: 1 hour

// Get insider trading
async getInsiderTrading(
  symbol: string,
  limit = 100
): Promise<{...} | null>
// Returns: Form 4 transactions with buy/sell classification and significance
// Endpoint: /v4/insider-trading?symbol={symbol}
// Cache: 1 hour

// Get 13F filing dates
async get13FFilingDates(
  symbol: string,
  limit = 20
): Promise<{...} | null>
// Returns: Filing history with total institutions, shares, value
// Endpoint: /v4/form-thirteen-date?symbol={symbol}
// Cache: 1 hour

// Get comprehensive institutional data
async getComprehensiveInstitutionalData(symbol: string): Promise<{...} | null>
// Returns: Complete institutional intelligence with sentiment analysis
// Combines: ownership + insider trading + filing history
// Features:
//   - Composite sentiment calculation
//   - Net insider sentiment (bullish/neutral/bearish)
//   - Institutional sentiment analysis
//   - Confidence scoring

// Get social sentiment
async getSocialSentiment(
  symbol: string,
  page = 0
): Promise<Array<{...}>>
// Returns: StockTwits and Twitter metrics
// Endpoint: /v4/historical/social-sentiment?symbol={symbol}
// Cache: 30 minutes

// Get stock news
async getStockNews(
  symbol: string,
  limit = 50
): Promise<Array<{...}>>
// Returns: News articles with title, text, URL, date
// Endpoint: /v3/stock_news?tickers={symbol}
// Cache: 30 minutes
```

#### Economic Data Methods

```typescript
// Get economic calendar
async getEconomicCalendar(
  from?: string,
  to?: string
): Promise<EconomicEvent[]>
// Returns: Economic events with previous, estimate, actual values
// Endpoint: /v3/economic_calendar
// Cache: 1 hour

// Get treasury rates
async getTreasuryRates(
  from?: string,
  to?: string
): Promise<TreasuryRate[]>
// Returns: All treasury maturities (1m to 30y)
// Endpoint: /v3/treasury
// Cache: 30 minutes

// Get Federal Funds Rate
async getFederalFundsRate(
  from?: string,
  to?: string
): Promise<Array<{ date, value }>>
// Endpoint: /v4/economic?name=federalFunds
// Cache: 1 hour

// Get Federal Funds Rate at specific date
async getFederalFundsRateAtDate(date: Date): Promise<{ date, value } | null>
// Fetches 90-day window to ensure data availability
// Cache: 1 hour
```

#### Comprehensive Data Methods

```typescript
// Get comprehensive financial data
async getComprehensiveFinancialData(
  symbol: string,
  options?: {
    includeAnnual?: boolean;
    includeQuarterly?: boolean;
    includeDividends?: boolean;
    includeSplits?: boolean;
    includeESG?: boolean;
    limit?: number;
  }
): Promise<{...}>
// Returns: Complete financial package
// Combines:
//   - Income statements (annual + quarterly)
//   - Balance sheets (annual + quarterly)
//   - Cash flow statements (annual + quarterly)
//   - Dividends
//   - Stock splits
//   - ESG ratings
// Features:
//   - Parallel fetching with Promise.allSettled
//   - Graceful degradation on partial failures
//   - Error tracking per data type
// Cache: 12 hours

// Health check
async healthCheck(): Promise<boolean>
// Tests: Market data, fundamentals, institutional endpoints
// Returns: true if all domains healthy
// Used for: Monitoring, failover decisions
```

### Error Handling

All FMP methods implement:

1. **API Key Validation**: `validateApiKey()` before requests
2. **Response Validation**: `validateResponse(response, expectedType)`
3. **Enhanced Error Detection**:
   - Rate limit errors
   - Invalid API key
   - Symbol not found
   - HTTP errors
4. **Security Validation** (SecurityValidator):
   - Symbol format validation
   - Numeric bounds checking
   - Error message sanitization
5. **Timeout Handling**: AbortController with configurable timeout (default 15s)
6. **Graceful Degradation**: Returns null/empty array on failures (unless throwErrors=true)

### Authentication

```typescript
// Environment variable
FMP_API_KEY=your_key_here

// Constructor usage
new FinancialModelingPrepAPI(apiKey?, timeout?, throwErrors?)

// Defaults
apiKey: process.env.FMP_API_KEY
timeout: 15000 (15 seconds)
throwErrors: false (graceful degradation)
```

### Request Format

All FMP endpoints follow this pattern:

```typescript
const url = new URL(`${baseUrl}${endpoint}`);
url.searchParams.append("apikey", this.apiKey);

const response = await fetch(url.toString(), {
  signal: controller.signal,
  headers: {
    Accept: "application/json",
    "User-Agent": "VFR-API/1.0"
  }
});
```

Base URLs:
- v3: `https://financialmodelingprep.com/api/v3`
- v4: `https://financialmodelingprep.com/api/v4`

---

## Analysis Engine Integration

### Factor Calculation

FMP data feeds into the **FactorLibrary** for multi-factor scoring:

#### Technical Factors

```typescript
// Uses FMP market data
- Price momentum
- Volume trends
- Volatility patterns
- Price vs moving averages
```

#### Fundamental Factors

```typescript
// Uses FMP fundamental ratios
- Value metrics (PE, PB, P/S)
- Quality metrics (ROE, ROA, margins)
- Growth metrics (revenue growth, EPS growth)
- Financial health (debt/equity, current ratio)
```

#### Analyst Factors

```typescript
// Uses FMP institutional data
- Analyst consensus
- Price target upside
- Rating changes
- Institutional ownership trends
```

### Stock Selection Service

**Location**: `app/services/stock-selection/StockSelectionService.ts`

FMP integration points:

1. **Universe Screening** (Line 2662)
   ```typescript
   sharedFmpAPI = new FinancialModelingPrepAPI();
   ```

2. **Batch Data Fetching**
   - Parallel fundamental ratio requests
   - Batch price updates
   - Efficient sector screening

3. **Real-time Analysis**
   - Price updates for live scoring
   - Volume confirmation
   - Market data validation

### Algorithm Engine

**Location**: `app/services/algorithms/AlgorithmEngine.ts`

FMP data flow:

```typescript
// Step 1: Get universe
const universe = await getStockUniverse(config, context);

// Step 2: Fetch market data (FMP)
const marketData = await fetchMarketData(universe, config);

// Step 3: Fetch fundamental data (FMP)
const fundamentalData = await fetchFundamentalData(universe, config);

// Step 4: Calculate factors
const scores = await calculateFactorScores(marketData, fundamentalData);

// Step 5: Rank and select
const results = await rankAndSelectStocks(scores);
```

---

## ML Model Building

### Feature Engineering

FMP provides **primary features** for all ML models:

#### 1. Price Prediction Features

**Service**: `PricePredictionFeatureExtractor.ts`

**FMP Features**:
```typescript
// Historical price patterns
- 5/10/20/50/200 day moving averages
- Price momentum indicators
- Volume trends
- Volatility measures
- Support/resistance levels

// Fundamental features
- PE ratio trends
- Price/Book evolution
- Debt/equity changes
- Margin trends
```

#### 2. Early Signal Detection Features

**Service**: `FeatureExtractor.ts` (Early Signal)

**FMP Features**:
```typescript
// Earnings-based signals
- Earnings surprises
- Earnings momentum
- EPS growth rates
- Revenue growth

// Price reactions
- Post-earnings price movement
- Pre-earnings positioning
```

#### 3. Sentiment Fusion Features

**Service**: `SentimentFusionFeatureExtractor.ts`

**FMP Features**:
```typescript
// Analyst sentiment
- Rating consensus
- Rating changes
- Price target changes

// Social sentiment
- StockTwits sentiment
- Twitter sentiment
- News sentiment
```

#### 4. Smart Money Flow Features

**Service**: `SmartMoneyFlowFeatureExtractor.ts`

**FMP Features**:
```typescript
// Institutional activity
- 13F holder changes
- Total institutional ownership
- Ownership concentration

// Insider activity
- Insider buy/sell ratios
- Transaction significance
- Insider sentiment score
```

### Training Data Generation

#### Multi-Source Dataset Generator

**Script**: `scripts/ml/generate-multi-source-datasets.ts`

**FMP Usage**:
```typescript
const fmpAPI = new FinancialModelingPrepAPI();

// Historical data extraction
for (const symbol of symbols) {
  // 1. Price history
  const prices = await fmpAPI.getHistoricalData(symbol, 365);

  // 2. Fundamental ratios
  const ratios = await fmpAPI.getFundamentalRatios(symbol);

  // 3. Financial statements
  const income = await fmpAPI.getIncomeStatement(symbol, "quarterly", 8);

  // 4. Analyst data
  const ratings = await fmpAPI.getAnalystRatings(symbol);

  // 5. Institutional data
  const ownership = await fmpAPI.getInstitutionalOwnership(symbol);
}
```

**Output**: CSV datasets with 50+ features per symbol

#### Label Generation

**Scripts**:
- `generate-price-labels.ts` - Future price movement labels
- `label-generator.ts` - Smart money flow labels
- `quick-test-labels.ts` - Label verification

**FMP Usage for Labels**:
```typescript
// Future price calculation
const historicalPrices = await fmpAPI.getHistoricalData(symbol);

// Calculate labels
const labels = calculatePriceMovementLabels(historicalPrices, {
  horizons: ['1d', '5d', '10d', '20d'],
  thresholds: [0.02, 0.05, 0.10] // 2%, 5%, 10% movements
});
```

### Model Integration

All ML models consume FMP data:

1. **Sentiment Fusion Model** (v1.2.0)
   - Analyst consensus from FMP
   - Social sentiment from FMP
   - News sentiment integration

2. **Price Prediction Model** (In Development)
   - OHLCV historical data
   - Volume patterns
   - Fundamental ratios

3. **Early Signal Detection Model**
   - Earnings data
   - Price reactions
   - Volume spikes

4. **Smart Money Flow Model**
   - 13F filings
   - Form 4 insider transactions
   - Institutional changes

---

## API Routes

### Main Analysis Endpoints

#### 1. `/api/stocks/analyze` (POST)

**Purpose**: Comprehensive single-stock analysis

**FMP Usage**:
```typescript
const fmpAPI = new FinancialModelingPrepAPI(process.env.FMP_API_KEY);

// VWAP analysis
const vwapService = new VWAPService(fmpAPI);
const vwapAnalysis = await vwapService.analyzeSymbol(symbol);

// Fundamental analysis
const fundamentals = await fmpAPI.getFundamentalRatios(symbol);
const companyInfo = await fmpAPI.getCompanyInfo(symbol);

// Analyst data
const ratings = await fmpAPI.getAnalystRatings(symbol);
const priceTargets = await fmpAPI.getPriceTargets(symbol);

// Institutional data
const ownership = await fmpAPI.getInstitutionalOwnership(symbol);
const insiders = await fmpAPI.getInsiderTrading(symbol);
```

**Response Example**:
```json
{
  "symbol": "AAPL",
  "recommendation": "BUY",
  "confidence": 0.85,
  "price": 175.43,
  "fundamentals": {
    "peRatio": 28.5,
    "pbRatio": 40.2,
    "roe": 0.36,
    "debtToEquity": 1.8
  },
  "analysts": {
    "consensus": "Buy",
    "targetHigh": 220,
    "targetLow": 150,
    "targetConsensus": 185
  },
  "institutional": {
    "totalHolders": 3245,
    "ownershipPercent": 61.2,
    "sentiment": "BULLISH"
  }
}
```

#### 2. `/api/stocks/analysis-frontend` (POST)

**Purpose**: Lightweight analysis for frontend

**FMP Usage**: Same as analyze but with reduced data load

#### 3. `/api/admin/analysis` (POST)

**Purpose**: Admin dashboard with extended metrics

**FMP Usage**: All comprehensive endpoints + performance metrics

### Admin Testing Endpoints

#### 4. `/api/admin/test-data-sources` (POST)

**Purpose**: Test FMP endpoints and health

**Tests**:
```typescript
// Basic connectivity
const healthCheck = await fmpAPI.healthCheck();

// Price data
const price = await fmpAPI.getStockPrice("AAPL");

// Fundamentals
const ratios = await fmpAPI.getFundamentalRatios("AAPL");

// Batch operations
const batchPrices = await fmpAPI.getBatchPrices(["AAPL", "MSFT", "GOOGL"]);

// Rate limit tracking
const rateLimitStatus = getRateLimitStatus();
```

**Response**:
```json
{
  "source": "fmp",
  "status": "healthy",
  "tests": {
    "connectivity": "PASS",
    "priceData": "PASS",
    "fundamentals": "PASS",
    "batchOperations": "PASS"
  },
  "performance": {
    "averageLatency": "245ms",
    "successRate": "99.2%"
  },
  "rateLimit": {
    "remaining": 287,
    "total": 300,
    "resetTime": "2025-10-13T14:35:00Z"
  }
}
```

### Search Endpoints

#### 5. `/api/stocks/search` (GET)

**Purpose**: Symbol search and company lookup

**FMP Usage**:
```typescript
// Company profile search
const companies = await fmpAPI.getCompanyInfo(query);
```

### Market Data Endpoints

#### 6. `/api/market/sectors` (GET)

**Purpose**: Sector performance data

**FMP Usage**:
```typescript
const sectorData = await fmpAPI.getStocksBySector(sector, limit);
```

---

## Frontend Components

### Direct FMP Data Display

1. **StockRecommendationCard** (`/app/components/StockRecommendationCard.tsx`)
   - Displays buy/sell/hold recommendations derived from FMP
   - Shows price targets
   - Analyst consensus
   - Confidence scores

2. **AnalysisResults** (`/app/components/admin/AnalysisResults.tsx`)
   - Comprehensive analysis view
   - All FMP data categories
   - Interactive data tables

3. **AnalysisProgress** (`/app/components/admin/AnalysisProgress.tsx`)
   - Real-time progress during FMP data fetching
   - Stage indicators (market data, fundamentals, institutional)

### Pages Using FMP Data

4. **Stock Intelligence** (`/app/stock-intelligence/page.tsx`)
   - Main user-facing analysis interface
   - Calls `/api/stocks/analyze` which uses FMP

5. **Admin Dashboard** (`/app/admin/page.tsx`)
   - API testing interface
   - Performance monitoring
   - Data source status (FMP highlighted as primary)

---

## Configuration

### Environment Variables

```bash
# Required
FMP_API_KEY=your_fmp_api_key_here

# Optional
FMP_PLAN=starter                # Plan tier: basic, starter, professional
ENABLE_FMP=true                 # Feature flag to enable/disable FMP
```

### Application Configuration

**Location**: `app/services/financial-data/FinancialDataService.ts`

```typescript
// FMP initialization
if (process.env.FMP_API_KEY && process.env.ENABLE_FMP === 'true') {
  this.dataSources.push({
    name: "Financial Modeling Prep",
    provider: new FinancialModelingPrepAPI(),
    priority: 1,              // Primary source
    isFree: false,
    rateLimit: 300,           // 300 requests/minute (starter plan)
    dailyLimit: undefined     // No daily limit on paid plans
  });
}
```

### Rate Limiting Configuration

**Location**: `app/services/financial-data/fmp/FMPMarketDataAPI.ts` & `FMPFundamentalsAPI.ts`

```typescript
// Plan-specific configurations
const config = {
  basic: {
    batchSize: 10,
    maxConcurrentBatches: 1,
    requestInterval: 100,      // ms between requests
    batchInterval: 250,        // ms between batches
    utilizationTarget: 70      // % of rate limit to use
  },
  starter: {
    batchSize: 25,
    maxConcurrentBatches: 2,
    requestInterval: 50,
    batchInterval: 150,
    utilizationTarget: 80
  },
  professional: {
    batchSize: 50,
    maxConcurrentBatches: 3,
    requestInterval: 20,
    batchInterval: 75,
    utilizationTarget: 90
  }
};
```

### Cache Configuration

**Location**: `app/services/financial-data/FMPCacheManager.ts`

```typescript
// Cache TTLs by data type
const cacheConfigs = {
  stock_price: {
    ttl: 60,                   // 60 seconds
    priority: "high",
    compressionEnabled: false,
    refreshThreshold: 0.8      // Refresh at 80% of TTL
  },
  fundamental_ratios: {
    ttl: 3600,                 // 1 hour
    priority: "critical",
    compressionEnabled: true,
    refreshThreshold: 0.7
  },
  income_statement: {
    ttl: 86400,                // 24 hours
    priority: "critical",
    compressionEnabled: true,
    refreshThreshold: 0.3
  },
  // ... more configurations
};
```

### API Endpoints Base URLs

```typescript
// v3 API (most endpoints)
const baseUrlV3 = "https://financialmodelingprep.com/api/v3";

// v4 API (newer endpoints - institutional data)
const baseUrlV4 = "https://financialmodelingprep.com/api/v4";
```

### Timeout Configuration

```typescript
// Default timeout: 15 seconds
const timeout = 15000;

// Can be customized per instance
const fmpAPI = new FinancialModelingPrepAPI(apiKey, customTimeout);
```

### Error Handling Configuration

```typescript
// Constructor parameter
const throwErrors = false; // Default: graceful degradation

// When true: throws errors instead of returning null/empty
const fmpAPI = new FinancialModelingPrepAPI(apiKey, timeout, true);
```

---

## Dependencies and Related Services

### Caching Services

#### 1. **RedisCache**

**Integration**: Historical data caching

```typescript
// In FMPMarketDataAPI
import { redisCache } from "../../cache/RedisCache";

// Cache historical data (immutable)
const cacheKey = `fmp:historical:${symbol}:${limit}:${dateKey}`;
const cached = await redisCache.get<MarketData[]>(cacheKey);

if (!cached) {
  const data = await fetchFromAPI();
  await redisCache.set(cacheKey, data, 2592000); // 30 days
}
```

#### 2. **FMPCacheManager**

**Integration**: FMP-specific in-memory caching

```typescript
// In all FMP modules
private fmpCache = new FMPCacheManager();

// Get with auto-refresh
const ratios = this.fmpCache.get<FundamentalRatios>(key, 'fundamental_ratios');

// Set with priority
this.fmpCache.set(key, ratios, 'fundamental_ratios');
```

### Security Services

#### 3. **SecurityValidator**

**Integration**: Input validation and sanitization

```typescript
import securityValidator from "../../security/SecurityValidator";

// Symbol validation
const symbolValidation = securityValidator.validateSymbol(symbol);
if (!symbolValidation.isValid) {
  return null;
}

// Numeric validation
const validation = securityValidator.validateNumeric(value, {
  allowNegative: true,
  allowZero: true,
  min: 0,
  max: 100,
  decimalPlaces: 6
});

// API response validation
const apiValidation = securityValidator.validateApiResponse(data, []);

// Error sanitization
const sanitizedError = securityValidator.sanitizeErrorMessage(error);
```

### Error Handling Services

#### 4. **ErrorHandler**

**Integration**: Centralized error logging

```typescript
import { createApiErrorHandler } from "../error-handling";

private errorHandler = createApiErrorHandler("fmp-market-data");

// API error logging
this.errorHandler.logger.logApiError("GET", "market_data", error, undefined, {
  symbol,
  endpoint: "/quote"
});

// Info logging
this.errorHandler.logger.info("Batch processing completed", {
  requested: symbols.length,
  retrieved: results.size
});

// Warning logging
this.errorHandler.logger.warn("Cache entry expired", {
  key,
  age: `${age}s`
});
```

### Fallback Services

#### 5. **EODHDAPI**

**Integration**: Fallback data source (options-specific)

```typescript
// In FinancialDataService
if (process.env.FMP_API_KEY) {
  this.dataSources.push({
    name: "Financial Modeling Prep",
    priority: 1
  });
}

// EODHD used only for options data, not as fallback for FMP
```

### Complementary Services

#### 6. **VWAPService**

**Depends On**: FMP historical data

```typescript
import { FinancialModelingPrepAPI } from "./FinancialModelingPrepAPI";

export class VWAPService {
  constructor(
    private fmpAPI: FinancialModelingPrepAPI,
    private cache: RedisCache
  ) {}

  async analyzeSymbol(symbol: string): Promise<VWAPAnalysis> {
    // Uses FMP historical data for VWAP calculation
    const historical = await this.fmpAPI.getHistoricalData(symbol, 20);
    return this.calculateVWAP(historical);
  }
}
```

#### 7. **InstitutionalDataService**

**Depends On**: FMP institutional endpoints

```typescript
import { FinancialModelingPrepAPI } from "./FinancialModelingPrepAPI";

export class InstitutionalDataService {
  private fmpAPI: FinancialModelingPrepAPI | null;

  constructor() {
    const isFmpEnabled = process.env.ENABLE_FMP === 'true';
    this.fmpAPI = isFmpEnabled ? new FinancialModelingPrepAPI() : null;
  }

  async getInstitutionalIntelligence(symbol: string) {
    if (!this.fmpAPI) return null;

    // Uses FMP comprehensive institutional data
    return await this.fmpAPI.getComprehensiveInstitutionalData(symbol);
  }
}
```

#### 8. **SectorDataService**

**Depends On**: FMP sector screening

```typescript
import { FinancialModelingPrepAPI } from "./FinancialModelingPrepAPI";

export class SectorDataService {
  private fmp: FinancialModelingPrepAPI;

  async getSectorPerformance(sector: string) {
    return await this.fmp.getStocksBySector(sector, 50);
  }
}
```

### Data Flow Dependencies

```
FMP API
  ↓
FinancialModelingPrepAPI (orchestrator)
  ↓
FMPMarketDataAPI / FMPFundamentalsAPI / FMPInstitutionalAPI
  ↓
FMPCacheManager (in-memory) + RedisCache (persistent)
  ↓
FinancialDataService (multi-source coordinator)
  ↓
├─→ AlgorithmEngine (factor calculation)
├─→ StockSelectionService (universe screening)
├─→ FeatureEngineeringService (ML features)
├─→ VWAPService (technical analysis)
├─→ InstitutionalDataService (smart money)
└─→ API Routes (user-facing endpoints)
     ↓
  Frontend Components (UI display)
```

---

## Rate Limiting and Performance

### Rate Limits by Plan

| Plan | Requests/Minute | Requests/Hour | Daily Limit | Cost |
|------|-----------------|---------------|-------------|------|
| Free | 250 | 15,000 | 250,000 | $0 |
| Starter | 300 | 18,000 | Unlimited | ~$15/mo |
| Professional | 600 | 36,000 | Unlimited | ~$50/mo |
| Enterprise | Custom | Custom | Unlimited | Custom |

**Current Plan**: Starter (300 req/min)

### Rate Limit Management

#### Request Queueing

**Location**: `FinancialDataService.ts`

```typescript
private fmpRequestQueue: Array<{
  resolve: Function;
  reject: Function;
  timestamp: number;
}> = [];

private async queueFMPRequest<T>(
  requestFn: () => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    this.fmpRequestQueue.push({
      resolve: () => resolve(requestFn()),
      reject,
      timestamp: Date.now()
    });

    if (!this.fmpProcessingQueue) {
      this.processFMPQueue();
    }
  });
}

private async processFMPQueue(): Promise<void> {
  this.fmpProcessingQueue = true;

  while (this.fmpRequestQueue.length > 0) {
    const request = this.fmpRequestQueue.shift();

    try {
      await request.resolve();
    } catch (error) {
      request.reject(error);
    }

    // Delay to respect rate limits (200ms = ~300 req/min)
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  this.fmpProcessingQueue = false;
}
```

#### Batch Optimization

**Adaptive Batching** based on plan:

```typescript
private calculateOptimalBatchConfig(
  planType: "basic" | "starter" | "professional",
  totalSymbols: number,
  priorityMode = false
) {
  // Starter plan example
  if (planType === "starter") {
    return {
      batchSize: 25,              // 25 symbols per batch
      maxConcurrentBatches: 2,    // 2 batches in parallel
      requestInterval: 50,         // 50ms between requests
      batchInterval: 150,          // 150ms between batches
      utilizationTarget: 80        // Use 80% of rate limit
    };
  }
}
```

**Effective Rate**:
- Starter plan: 240 requests/minute (80% utilization)
- Buffer: 60 requests/minute for bursts
- Concurrent batches: 2 (50 symbols processing simultaneously)

### Performance Metrics

#### Caching Effectiveness

```typescript
// FMPCacheManager stats
const stats = fmpCache.getStats();

// Example output
{
  totalEntries: 1542,
  totalSize: 8432640,              // ~8.4 MB
  hitRate: 87.3,                   // 87.3% cache hits
  totalHits: 12847,
  totalMisses: 1863,
  memoryUsage: 8432640,
  oldestEntry: 1697186400000,
  newestEntry: 1697208000000
}
```

#### API Latency

**Measured Averages**:

| Endpoint Type | Average Latency | 95th Percentile |
|---------------|-----------------|-----------------|
| Stock Price | 180ms | 320ms |
| Historical Data (cached) | 15ms | 35ms |
| Historical Data (API) | 450ms | 850ms |
| Fundamental Ratios | 320ms | 580ms |
| Batch Prices (25 symbols) | 890ms | 1,450ms |
| Comprehensive Data | 2,100ms | 3,200ms |

#### Cache TTL Optimization

**Data Volatility vs Cache Duration**:

```
High Volatility (Short TTL):
├─ Stock Price: 60s
├─ Market Data: 120s
└─ Social Sentiment: 1800s

Medium Volatility (Moderate TTL):
├─ Analyst Ratings: 1800s
├─ Price Targets: 1800s
└─ Company Info: 7200s

Low Volatility (Long TTL):
├─ Financial Statements: 86400s
├─ Dividends: 604800s
└─ ESG Ratings: 259200s
```

### Performance Best Practices

1. **Use Batch Endpoints**
   ```typescript
   // Good: Batch request
   const prices = await fmpAPI.getBatchPrices(symbols);

   // Bad: Sequential requests
   for (const symbol of symbols) {
     const price = await fmpAPI.getStockPrice(symbol);
   }
   ```

2. **Check Cache First**
   ```typescript
   // Historical data caching
   const cacheKey = `fmp:historical:${symbol}:${limit}`;
   const cached = await redisCache.get(cacheKey);
   if (cached) return cached;

   const data = await fmpAPI.getHistoricalData(symbol, limit);
   await redisCache.set(cacheKey, data, 2592000); // 30 days
   ```

3. **Use Comprehensive Endpoints**
   ```typescript
   // Good: Single comprehensive call
   const data = await fmpAPI.getComprehensiveFinancialData(symbol, {
     includeAnnual: true,
     includeQuarterly: true
   });

   // Bad: Multiple separate calls
   const income = await fmpAPI.getIncomeStatement(symbol);
   const balance = await fmpAPI.getBalanceSheet(symbol);
   const cashFlow = await fmpAPI.getCashFlowStatement(symbol);
   ```

4. **Implement Priority Modes**
   ```typescript
   // Priority mode: Reduced concurrency for critical requests
   const ratios = await fmpAPI.getBatchFundamentalRatios(symbols, {
     planType: "starter",
     priorityMode: true  // Reduces rate to prevent quota exhaustion
   });
   ```

5. **Monitor Rate Limits**
   ```typescript
   // Track request counts
   const requestCount = this.getRequestCount("fmp");
   const percentUsed = (requestCount / 300) * 100;

   if (percentUsed > 90) {
     console.warn("FMP rate limit approaching 90%");
     // Implement backoff or queue requests
   }
   ```

---

## Best Practices

### 1. **Always Use the Main Orchestrator**

```typescript
// Good: Use the main orchestrator
import { FinancialModelingPrepAPI } from "../financial-data/FinancialModelingPrepAPI";
const fmpAPI = new FinancialModelingPrepAPI();

// Bad: Directly import domain modules
import { FMPMarketDataAPI } from "../financial-data/fmp/FMPMarketDataAPI";
```

**Reason**: Orchestrator provides unified error handling, caching, and health checks

### 2. **Leverage Caching Layers**

```typescript
// Best: Check both cache layers
const cacheKey = fmpCache.generateKey(symbol, 'fundamental_ratios');

// Check in-memory cache first
let ratios = fmpCache.get<FundamentalRatios>(cacheKey, 'fundamental_ratios');

if (!ratios) {
  // Check Redis cache
  ratios = await redisCache.get<FundamentalRatios>(cacheKey);

  if (!ratios) {
    // Finally, fetch from API
    ratios = await fmpAPI.getFundamentalRatios(symbol);

    // Store in both caches
    await redisCache.set(cacheKey, ratios, 3600);
    fmpCache.set(cacheKey, ratios, 'fundamental_ratios');
  }
}
```

### 3. **Batch Operations for Multiple Symbols**

```typescript
// Good: Single batch request
const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];
const prices = await fmpAPI.getBatchPrices(symbols, {
  planType: "starter",
  priorityMode: false
});

// Bad: Loop with individual requests (consumes 5x more quota)
for (const symbol of symbols) {
  const price = await fmpAPI.getStockPrice(symbol);
}
```

**Quota Savings**: 5 requests → 1 request (80% reduction)

### 4. **Use Comprehensive Endpoints**

```typescript
// Good: One comprehensive call
const data = await fmpAPI.getComprehensiveFinancialData(symbol, {
  includeAnnual: true,
  includeDividends: true,
  includeESG: true,
  limit: 3
});

// Bad: Multiple individual calls (uses 5+ requests)
const income = await fmpAPI.getIncomeStatement(symbol, "annual", 3);
const balance = await fmpAPI.getBalanceSheet(symbol, "annual", 3);
const cashFlow = await fmpAPI.getCashFlowStatement(symbol, "annual", 3);
const dividends = await fmpAPI.getDividendData(symbol);
const esg = await fmpAPI.getESGRating(symbol);
```

**Quota Savings**: 5-8 requests → ~3 requests (parallel execution)

### 5. **Implement Graceful Degradation**

```typescript
// Good: Handle missing data gracefully
const ratios = await fmpAPI.getFundamentalRatios(symbol);

if (!ratios) {
  // Use fallback or estimated values
  return {
    symbol,
    peRatio: estimateFromHistory(symbol),
    confidence: 0.3,  // Low confidence
    source: "estimated"
  };
}

return {
  ...ratios,
  confidence: 0.9,
  source: "fmp"
};
```

### 6. **Validate Inputs**

```typescript
// Always validate symbols
import securityValidator from "../security/SecurityValidator";

const symbolValidation = securityValidator.validateSymbol(symbol);
if (!symbolValidation.isValid) {
  throw new Error(`Invalid symbol: ${symbolValidation.errors.join(", ")}`);
}

const sanitizedSymbol = symbolValidation.sanitized;
```

### 7. **Use TypeScript Types**

```typescript
// Import type definitions
import {
  StockData,
  MarketData,
  FundamentalRatios,
  CompanyInfo
} from "../financial-data/types";

// Type-safe API calls
const price: StockData | null = await fmpAPI.getStockPrice(symbol);
const ratios: FundamentalRatios | null = await fmpAPI.getFundamentalRatios(symbol);
```

### 8. **Implement Timeout Handling**

```typescript
// Good: Use timeouts
const fmpAPI = new FinancialModelingPrepAPI(
  process.env.FMP_API_KEY,
  15000  // 15 second timeout
);

// For critical operations, reduce timeout
const fmpAPIQuick = new FinancialModelingPrepAPI(
  process.env.FMP_API_KEY,
  5000  // 5 second timeout for real-time operations
);
```

### 9. **Monitor Performance**

```typescript
// Track request timing
const startTime = Date.now();
const data = await fmpAPI.getHistoricalData(symbol, 365);
const duration = Date.now() - startTime;

if (duration > 1000) {
  console.warn(`Slow FMP request: ${duration}ms for ${symbol}`);
}

// Log cache effectiveness
const stats = fmpCache.getStats();
if (stats.hitRate < 70) {
  console.warn(`Low cache hit rate: ${stats.hitRate}%`);
}
```

### 10. **Error Handling Patterns**

```typescript
// Good: Comprehensive error handling
try {
  const ratios = await fmpAPI.getFundamentalRatios(symbol);

  if (!ratios) {
    // Data not available, not an error
    return { success: false, reason: "no_data" };
  }

  return { success: true, data: ratios };

} catch (error) {
  // Check error type
  if (error.message.includes("rate limit")) {
    // Implement backoff
    await sleep(60000);
    return retryRequest();
  }

  if (error.message.includes("Invalid API key")) {
    // Critical error, alert admin
    alertAdmin("FMP API key invalid");
  }

  // Log and return gracefully
  console.error("FMP error:", error);
  return { success: false, error: sanitizeError(error) };
}
```

### 11. **Avoid Redundant Requests**

```typescript
// Bad: Fetching same data multiple times
const price1 = await fmpAPI.getStockPrice(symbol);
// ... some code ...
const price2 = await fmpAPI.getStockPrice(symbol);  // Redundant!

// Good: Fetch once and reuse
const price = await fmpAPI.getStockPrice(symbol);
const analysis1 = analyzePrice(price);
const analysis2 = comparePrice(price);
```

### 12. **Use Environment-Based Configuration**

```typescript
// Good: Environment-based setup
const planType = process.env.FMP_PLAN as "basic" | "starter" | "professional";

const fmpAPI = new FinancialModelingPrepAPI(
  process.env.FMP_API_KEY,
  parseInt(process.env.FMP_TIMEOUT || "15000"),
  process.env.NODE_ENV === "production"  // throwErrors in production
);

// Configure batch sizes based on plan
const batchSize = planType === "professional" ? 50 :
                  planType === "starter" ? 25 : 10;
```

---

## Conclusion

Financial Modeling Prep serves as the **primary data backbone** of the VFR Financial Analysis Platform, providing comprehensive financial data through a well-architected, modular integration. The implementation prioritizes:

- **Performance**: Intelligent caching, batch operations, rate limit management
- **Reliability**: Multi-layer fallbacks, graceful degradation, health monitoring
- **Maintainability**: Domain-specific modules, clear separation of concerns
- **Security**: Input validation, error sanitization, bounds checking
- **Scalability**: Plan-aware batching, adaptive configurations

This documentation serves as the definitive reference for FMP API usage throughout the codebase. For questions or clarifications, refer to the specific service implementations listed in the **Complete Usage Inventory** section.

---

**Document Maintained By**: VFR Development Team
**Last Updated**: 2025-10-13
**Next Review**: 2025-11-13 (Monthly)
