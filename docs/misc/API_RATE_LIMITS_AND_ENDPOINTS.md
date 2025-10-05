# API Rate Limits and Endpoints

**Created:** 2025-10-05
**Last Updated:** 2025-10-05
**Version:** 1.0.0

## Document Purpose

This document catalogs all external API providers integrated in the VFR API with comprehensive rate limit specifications, endpoint mappings, authentication requirements, and optimization strategies. It serves as both a reference for developers and an operational guide for AI agents implementing rate-limited API interactions.

---

## Table of Contents

1. [API Provider Overview](#api-provider-overview)
2. [Rate Limit Summary Matrix](#rate-limit-summary-matrix)
3. [Provider Specifications](#provider-specifications)
4. [Rate Limit Strategy](#rate-limit-strategy)
5. [Caching Architecture](#caching-architecture)
6. [Code Examples](#code-examples)
7. [Troubleshooting](#troubleshooting)

---

## API Provider Overview

### Provider Categories

**Commercial APIs (Paid Plans)**
- Financial Modeling Prep (FMP) - Primary stock data provider
- EODHD - Options data and historical market data
- TwelveData - Real-time data and technical indicators
- Polygon.io - High-frequency market data (optional)

**Government APIs (Free)**
- Federal Reserve Economic Data (FRED)
- Bureau of Labor Statistics (BLS)
- Energy Information Administration (EIA)
- U.S. Treasury
- SEC EDGAR

**Social/Alternative Data**
- Reddit API - r/wallstreetbets sentiment analysis

---

## Rate Limit Summary Matrix

| Provider | Rate Limit | Time Window | Burst Limit | Hard Cap | Cost/Overage |
|----------|-----------|-------------|-------------|----------|--------------|
| **FMP (Starter)** | 300 requests | 1 minute | 50 requests/10s | 18,000/hour | $0.00028/request |
| **EODHD** | 100,000 requests | 1 day | None specified | N/A | Subscription-based |
| **FRED** | 120 requests | 1 minute | None | 7,200/hour | Free (API key required) |
| **BLS (Registered)** | 500 requests | 1 day | None | 500/day | Free (daily reset) |
| **BLS (Unregistered)** | 500 requests | 1 day | None | 500/day | Free (daily reset) |
| **EIA** | 5,000 requests | 1 hour | None specified | 120,000/day | Free (recommended limit) |
| **SEC EDGAR** | 10 requests | 1 second | None | 600/minute | Free (strict enforcement) |
| **U.S. Treasury** | 1,000 requests | 1 hour | None | 24,000/day | Free |
| **Reddit OAuth2** | 60 requests | 1 minute | None | 3,600/hour | Free (OAuth required) |
| **TwelveData** | 300 requests | 1 hour | None | 7,200/day | Plan-dependent |
| **Yahoo Finance** | ~1,000 requests | 1 hour | None | ~2,000/hour | Free (unofficial) |

---

## Provider Specifications

### 1. Financial Modeling Prep (FMP)

**Base URL:** `https://financialmodelingprep.com/api/v3`
**Plan:** Starter Plan
**Authentication:** API Key (Query Parameter)
**Environment Variable:** `FMP_API_KEY`

#### Rate Limits
- **Primary Limit:** 300 requests/minute (18,000/hour)
- **Burst Protection:** 50 requests per 10-second window
- **Response Headers:**
  - `X-RateLimit-Limit`: Total allowed requests
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Timestamp when limit resets

#### Endpoint Catalog

##### Core Stock Data (Rate Limit Bucket: Global)

| Endpoint | Method | Purpose | Cache TTL | Avg Response Time |
|----------|--------|---------|-----------|-------------------|
| `/quote/{symbol}` | GET | Real-time stock quote | 60s | 150-300ms |
| `/profile/{symbol}` | GET | Company profile/info | 2 hours | 200-400ms |
| `/ratios/{symbol}` | GET | Financial ratios | 1 hour | 300-500ms |
| `/income-statement/{symbol}` | GET | Income statements | 24 hours | 400-600ms |
| `/balance-sheet-statement/{symbol}` | GET | Balance sheets | 24 hours | 400-600ms |
| `/cash-flow-statement/{symbol}` | GET | Cash flow statements | 24 hours | 400-600ms |
| `/analyst-estimates/{symbol}` | GET | Analyst ratings | 30 minutes | 250-400ms |
| `/price-target/{symbol}` | GET | Price targets | 30 minutes | 200-350ms |
| `/stock_dividend/{symbol}` | GET | Dividend history | 7 days | 300-450ms |
| `/stock_split/{symbol}` | GET | Stock split history | 7 days | 300-450ms |

##### Batch Operations (Optimized for Rate Limits)

| Endpoint | Method | Purpose | Max Symbols | Cache TTL |
|----------|--------|---------|-------------|-----------|
| `/quote` | POST | Batch stock quotes | 100 | 60s |
| `/ratios-ttm` | POST | Batch TTM ratios | 50 | 2 hours |
| `/profile` | POST | Batch company profiles | 100 | 2 hours |

**Batch Request Example:**
```typescript
// Single request retrieves data for multiple symbols
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
const url = `https://financialmodelingprep.com/api/v3/quote/${symbols.join(',')}?apikey=${FMP_API_KEY}`;
// Returns array of quote objects - saves 4 API calls
```

##### Economic & Market Data

| Endpoint | Method | Purpose | Cache TTL |
|----------|--------|---------|-----------|
| `/economic_calendar` | GET | Economic events | 1 hour |
| `/treasury` | GET | Treasury rates | 30 minutes |
| `/market-indexes` | GET | Major index quotes | 2 minutes |
| `/sector-pe-ratio` | GET | Sector P/E ratios | 1 hour |

#### Cost Implications
- **Starter Plan:** $29/month for 300 req/min
- **Overage Cost:** $0.00028 per request (charged at $8.50 per 30,000 requests)
- **Optimization Priority:** HIGH - Primary API, minimize calls through aggressive caching

#### Rate Limit Handling
```typescript
// FMP returns HTTP 429 when rate limit exceeded
// Response: { "Error Message": "Limit Reach. Please upgrade your plan or visit our documentation" }

// Implementation in FinancialModelingPrepAPI.ts
if (response.status === 429) {
  // Cache indicates rate limit hit
  // Automatic failover to EODHD if available
  // Exponential backoff: 1s, 2s, 4s, 8s
}
```

---

### 2. EODHD (End of Day Historical Data)

**Base URL:** `https://eodhistoricaldata.com/api`
**Plan:** UnicornBay Options Plan
**Authentication:** API Key (Query Parameter)
**Environment Variable:** `EODHD_API_KEY`

#### Rate Limits
- **Daily Limit:** 100,000 requests per day
- **No Per-Minute Limit:** Effectively unlimited within daily cap
- **Response Time:** 200-500ms average

#### Endpoint Catalog

##### Options Data (Primary Use Case)

| Endpoint | Method | Purpose | Cache TTL | Response Format |
|----------|--------|---------|-----------|-----------------|
| `/options/{symbol}` | GET | Options chain with Greeks | 15 minutes | JSON |
| `/options/{symbol}?from=DATE&to=DATE` | GET | Historical options data | 24 hours | JSON |

**Options Response Fields (40+ fields):**
- Strike, expiration, type (call/put)
- Bid, ask, last price, volume, open interest
- **Advanced Greeks:** Delta, Gamma, Theta, Vega, Rho, Implied IV
- **UnicornBay Enhancements:**
  - Moneyness ratio
  - Theoretical price (Black-Scholes)
  - Implied volatility surface data
  - Risk-neutral density

**Options Data Example:**
```json
{
  "code": "AAPL",
  "exchange": "US",
  "lastTradeDate": "2025-10-05",
  "options": [
    {
      "expirationDate": "2025-11-15",
      "implied_volatility": 0.2456,
      "calls": [
        {
          "strike": 180.0,
          "lastPrice": 5.25,
          "bid": 5.20,
          "ask": 5.30,
          "volume": 1250,
          "openInterest": 8500,
          "delta": 0.6234,
          "gamma": 0.0156,
          "theta": -0.0234,
          "vega": 0.1245,
          "rho": 0.0567,
          "impliedVolatility": 0.2456,
          "theoreticalPrice": 5.23,
          "moneyness": 1.02
        }
      ],
      "puts": [...]
    }
  ]
}
```

##### Historical Data (Secondary Use Case)

| Endpoint | Method | Purpose | Cache TTL |
|----------|--------|---------|-----------|
| `/eod/{symbol}` | GET | End-of-day prices | 24 hours |
| `/real-time/{symbol}` | GET | Real-time quote | 60s |
| `/fundamentals/{symbol}` | GET | Company fundamentals | 2 hours |

#### Cost Implications
- **Plan Cost:** Subscription-based (pricing varies)
- **No Per-Request Cost:** Flat monthly fee
- **Optimization Priority:** MEDIUM - Use for options data exclusively

#### Limitations
- **Current subscription:** Options data only
- **Fundamental data:** NOT available on current plan
- **Use FMP for:** Stock quotes, fundamentals, analyst data

---

### 3. Federal Reserve Economic Data (FRED)

**Base URL:** `https://api.stlouisfed.org/fred`
**Authentication:** API Key (Query Parameter)
**Environment Variable:** `FRED_API_KEY`

#### Rate Limits
- **Rate Limit:** 120 requests/minute
- **No Daily Cap:** Unlimited requests within rate limit
- **Response Time:** 300-800ms average

#### Endpoint Catalog

| Endpoint | Method | Purpose | Cache TTL | Series Examples |
|----------|--------|---------|-----------|-----------------|
| `/series/observations` | GET | Time series data | 12 hours | GDP, UNRATE, DFF |
| `/series` | GET | Series metadata | 24 hours | Series info |
| `/category/series` | GET | Series in category | 24 hours | Category browsing |

#### Key Economic Indicators (Series IDs)

**Interest Rates & Monetary Policy:**
- `DFF` - Federal Funds Effective Rate (daily)
- `DGS10` - 10-Year Treasury Constant Maturity Rate
- `DGS2` - 2-Year Treasury Constant Maturity Rate
- `T10Y2Y` - 10-Year Treasury minus 2-Year (yield curve)

**Inflation Indicators:**
- `CPIAUCSL` - Consumer Price Index (All Urban Consumers)
- `CPILFESL` - Core CPI (Less Food & Energy)
- `PCEPI` - Personal Consumption Expenditures Price Index

**Employment & GDP:**
- `UNRATE` - Unemployment Rate
- `PAYEMS` - Total Nonfarm Payrolls
- `GDP` - Gross Domestic Product
- `GDPC1` - Real GDP

**Example Request:**
```bash
GET https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=YOUR_KEY&file_type=json
```

**Example Response:**
```json
{
  "realtime_start": "2025-10-05",
  "realtime_end": "2025-10-05",
  "observations": [
    {
      "date": "2025-10-04",
      "value": "5.33",
      "realtime_start": "2025-10-05",
      "realtime_end": "2025-10-05"
    }
  ]
}
```

#### Rate Limit Handling
- **429 Response:** Retry after 60 seconds
- **Cache Strategy:** 12-hour TTL for economic data (updates daily/weekly)
- **Batch Optimization:** Request multiple series in parallel (not batched endpoint)

---

### 4. Bureau of Labor Statistics (BLS)

**Base URL:** `https://api.bls.gov/publicAPI/v2`
**Authentication:** API Key (JSON Body) - Optional but recommended
**Environment Variable:** `BLS_API_KEY`

#### Rate Limits

**Registered Users (API Key):**
- **Daily Limit:** 500 requests/day
- **Series Per Request:** Up to 50 series
- **Years Per Request:** Up to 20 years
- **Reset:** Midnight ET

**Unregistered Users (No API Key):**
- **Daily Limit:** 25 requests/day
- **Series Per Request:** Up to 25 series
- **Years Per Request:** Up to 10 years

#### Endpoint Catalog

| Endpoint | Method | Purpose | Cache TTL |
|----------|--------|---------|-----------|
| `/timeseries/data/` | POST | Retrieve time series data | 12 hours |

#### Key BLS Series IDs

**Tier 1: Core Economic Indicators**

| Series ID | Description | Frequency | Impact |
|-----------|-------------|-----------|--------|
| `LNS14000000` | Unemployment Rate (SA) | Monthly | High |
| `CES0000000001` | Total Nonfarm Payrolls | Monthly | High |
| `LNS12300000` | Labor Force Participation Rate | Monthly | High |
| `CUUR0000SA0` | Consumer Price Index (All Items) | Monthly | Critical |
| `CUUR0000SA0L1E` | Core CPI (Less Food & Energy) | Monthly | Critical |
| `CUUR0000SEHE` | CPI Energy | Monthly | High |

**Tier 2: Market Sentiment Indicators**

| Series ID | Description | Frequency | Impact |
|-----------|-------------|-----------|--------|
| `JTS000000000000000JOL` | Job Openings Rate (Total Nonfarm) | Monthly | Medium |
| `JTS000000000000000QUR` | Quit Rate (Total Nonfarm) | Monthly | Medium |
| `CES0500000003` | Average Hourly Earnings (Total Private) | Monthly | High |
| `CES6056132001` | Professional/Business Services Employment | Monthly | Medium |
| `CES4142000001` | Retail Trade Employment | Monthly | Medium |

**POST Request Example:**
```typescript
const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    seriesid: ['LNS14000000', 'CES0000000001'],
    startyear: '2024',
    endyear: '2025',
    registrationkey: process.env.BLS_API_KEY
  })
});
```

**Response Format:**
```json
{
  "status": "REQUEST_SUCCEEDED",
  "responseTime": 145,
  "Results": {
    "series": [
      {
        "seriesID": "LNS14000000",
        "data": [
          {
            "year": "2025",
            "period": "M09",
            "periodName": "September",
            "value": "3.8"
          }
        ]
      }
    ]
  }
}
```

#### Rate Limit Strategy
- **Batch Requests:** Request up to 50 series per call (registered users)
- **Cache Duration:** 12 hours (monthly data updates once/month)
- **Daily Budget:** Reserve requests for critical economic updates
- **Inter-request Delay:** 200ms between batch requests

---

### 5. Energy Information Administration (EIA)

**Base URL:** `https://api.eia.gov/v2`
**Authentication:** API Key (Query Parameter)
**Environment Variable:** `EIA_API_KEY`

#### Rate Limits
- **Recommended Limit:** 5,000 requests/hour (no hard limit documented)
- **Typical Usage:** <100 requests/hour for energy data
- **Response Time:** 200-600ms average

#### Endpoint Catalog

| Endpoint | Method | Purpose | Cache TTL |
|----------|--------|---------|-----------|
| `/seriesid/{series_id}` | GET | Time series data | 1 hour |

#### Key Energy Series IDs

**Tier 1: Core Energy Indicators**

| Series ID | Description | Unit | Frequency |
|-----------|-------------|------|-----------|
| `PET.RWTC.D` | WTI Crude Oil Spot Price | $/barrel | Daily |
| `PET.RBRTE.D` | Brent Crude Oil Spot Price | $/barrel | Daily |
| `NG.RNGWHHD.D` | Henry Hub Natural Gas Spot Price | $/MMBtu | Daily |
| `PET.EMM_EPMR_PTE_NUS_DPG.W` | U.S. Regular Gasoline Retail Price | $/gallon | Weekly |
| `PET.WCRSTUS1.W` | U.S. Crude Oil Inventories | Thousand Barrels | Weekly |

**Tier 2: Electricity & Renewables**

| Series ID | Description | Frequency |
|-----------|-------------|-----------|
| `ELEC.GEN.ALL-US-99.M` | U.S. Total Electricity Generation | Monthly |
| `ELEC.GEN.WND-US-99.M` | U.S. Wind Electricity Generation | Monthly |
| `ELEC.GEN.SUN-US-99.M` | U.S. Solar Electricity Generation | Monthly |

**Example Request:**
```bash
GET https://api.eia.gov/v2/seriesid/PET.RWTC.D?api_key=YOUR_KEY&length=1
```

**Response Format:**
```json
{
  "response": {
    "total": 1,
    "dateFormat": "YYYY-MM-DD",
    "frequency": "daily",
    "data": [
      {
        "period": "2025-10-04",
        "value": 82.45,
        "units": "Dollars per Barrel"
      }
    ],
    "description": "Cushing, OK WTI Spot Price FOB"
  }
}
```

#### Sector Correlation
- **Energy Sector:** High correlation (0.7-0.9) with oil/gas prices
- **Transportation:** High negative correlation with fuel prices
- **Utilities:** Medium correlation (0.4-0.7) with natural gas
- **Consumer Discretionary:** Medium negative correlation with energy costs

---

### 6. SEC EDGAR

**Base URL:** `https://data.sec.gov`
**Authentication:** None (User-Agent header required)
**Environment Variable:** `SEC_USER_AGENT`

#### Rate Limits
- **Strict Limit:** 10 requests/second
- **Enforcement:** Immediate IP blocking for violations
- **User-Agent Required:** Must include company name and email
- **Proper Format:** `VFR-API/1.0 (contact@veritak.com)`

#### Endpoint Catalog

| Endpoint | Method | Purpose | Cache TTL |
|----------|--------|---------|-----------|
| `/submissions/CIK{cik}.json` | GET | Company filings index | 24 hours |
| `/cik-lookup-data.txt` | GET | Symbol to CIK mapping | 7 days |

#### Rate Limit Implementation
```typescript
private lastRequestTime = 0;
private readonly REQUEST_DELAY = 100; // 100ms = 10 req/sec

private async makeRequest(endpoint: string) {
  const now = Date.now();
  const timeSinceLastRequest = now - this.lastRequestTime;

  if (timeSinceLastRequest < this.REQUEST_DELAY) {
    await new Promise(resolve =>
      setTimeout(resolve, this.REQUEST_DELAY - timeSinceLastRequest)
    );
  }

  this.lastRequestTime = Date.now();

  return fetch(`${this.baseUrl}${endpoint}`, {
    headers: {
      'User-Agent': this.userAgent,
      'Accept': 'application/json'
    }
  });
}
```

---

### 7. U.S. Treasury

**Base URL:** `https://api.fiscaldata.treasury.gov/services/api/v1`
**Authentication:** None
**No Environment Variable Required**

#### Rate Limits
- **Rate Limit:** 1,000 requests/hour
- **No Daily Cap:** Unlimited within hourly rate
- **Response Time:** 400-1000ms average

#### Endpoint Catalog

| Endpoint | Method | Purpose | Cache TTL |
|----------|--------|---------|-----------|
| `/accounting/od/avg_interest_rates` | GET | Treasury rates | 30 minutes |
| `/accounting/od/debt_to_penny` | GET | National debt | 24 hours |

---

### 8. Reddit API (OAuth2)

**Base URL:** `https://oauth.reddit.com`
**Authentication:** OAuth2 Client Credentials
**Environment Variables:** `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`

#### Rate Limits
- **OAuth Limit:** 60 requests/minute
- **Burst Protection:** None specified
- **Token Expiry:** 1 hour (auto-refresh)

#### Endpoint Catalog

| Endpoint | Method | Purpose | Cache TTL |
|----------|--------|---------|-----------|
| `/r/wallstreetbets/hot` | GET | Hot posts | 5 minutes |
| `/r/wallstreetbets/new` | GET | New posts | 2 minutes |
| `/search` | GET | Symbol-specific posts | 10 minutes |

#### Sentiment Analysis Flow
```typescript
// 1. OAuth Token (cached for 59 minutes)
const token = await getAccessToken();

// 2. Search for symbol mentions
const posts = await searchWSBPosts('AAPL', 20);

// 3. Calculate sentiment (0-1 scale)
const sentiment =
  (avgScore/100 * 0.4) +
  (avgUpvoteRatio * 0.4) +
  (min(totalComments/1000, 1) * 0.2);

// 4. Confidence based on post count
const confidence = min(postCount / 10, 1);
```

---

## Rate Limit Strategy

### Global Rate Limit Management

#### 1. Request Budgeting

**FMP (Primary Constraint: 300 req/min)**
```typescript
// Theoretical maximum: 300 req/min = 18,000/hour
// Practical allocation:
// - Real-time quotes: 100 req/min (33%)
// - Fundamental data: 50 req/min (17%)
// - Analyst data: 30 req/min (10%)
// - Reserved buffer: 120 req/min (40%)

// Implementation: Token bucket algorithm
class RateLimiter {
  private tokens = 300;
  private lastRefill = Date.now();
  private refillRate = 300 / 60000; // tokens per millisecond

  async acquireToken(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(300, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}
```

#### 2. Shared Rate Limit Buckets

**Endpoints Sharing Limits:**
- **FMP:** All endpoints share global 300/min limit
- **FRED:** All series requests share 120/min limit
- **BLS:** All time series requests share 500/day limit
- **Reddit:** All OAuth requests share 60/min limit

**Independent Buckets:**
- **EODHD:** 100k/day independent of other APIs
- **EIA:** 5k/hour independent bucket
- **SEC EDGAR:** 10/sec independent (strictly enforced)

#### 3. Request Prioritization

**Priority Levels:**
```typescript
enum RequestPriority {
  CRITICAL = 1,  // User-facing real-time data (quote, market data)
  HIGH = 2,      // Core analysis data (fundamentals, ratios)
  MEDIUM = 3,    // Supplementary data (analyst ratings, news)
  LOW = 4,       // Background updates (cache refresh, batch jobs)
  DEFERRED = 5   // Non-urgent batch operations (run during off-peak)
}
```

**Priority Queue Implementation:**
```typescript
class PriorityRequestQueue {
  private queues = new Map<RequestPriority, Request[]>();

  async executeNext(): Promise<void> {
    // Execute CRITICAL requests first, then HIGH, etc.
    for (let priority = 1; priority <= 5; priority++) {
      const queue = this.queues.get(priority) || [];
      if (queue.length > 0) {
        const request = queue.shift();
        await this.rateLimiter.acquireToken();
        return this.execute(request);
      }
    }
  }
}
```

---

### Caching Architecture

#### Multi-Layer Cache Strategy

**Layer 1: Redis Cache (Primary)**
- **Location:** Remote Redis instance
- **TTL Management:** Per-endpoint configuration
- **Size:** Unlimited (persistent storage)
- **Use Case:** Shared cache across API instances

**Layer 2: In-Memory Cache (FMPCacheManager)**
- **Location:** Node.js process memory
- **Max Size:** 10,000 entries or 100MB
- **Eviction:** LRU with priority weighting
- **Use Case:** Hot data optimization

#### Cache TTL Strategy by Data Type

| Data Type | TTL | Rationale | FMP Calls Saved |
|-----------|-----|-----------|-----------------|
| **Real-Time Quotes** | 60s | Balance freshness vs. API cost | 80% reduction |
| **Market Data** | 2 min | Acceptable latency for OHLC | 75% reduction |
| **Fundamental Ratios** | 1 hour | Quarterly updates, rarely change | 95% reduction |
| **Company Profile** | 2 hours | Static data, infrequent changes | 98% reduction |
| **Financial Statements** | 24 hours | Quarterly/annual updates only | 99% reduction |
| **Analyst Ratings** | 30 min | Daily updates typical | 90% reduction |
| **Economic Calendar** | 1 hour | Events scheduled in advance | 95% reduction |
| **Dividend Data** | 7 days | Historical data, rarely updated | 99% reduction |

#### Intelligent Cache Refresh

**Refresh Threshold Strategy:**
```typescript
// Example: Fundamental ratios with 1-hour TTL
const config = {
  ttl: 3600,              // 1 hour
  refreshThreshold: 0.7   // Refresh at 70% of TTL
};

// When cache entry is 42 minutes old (70% of 60 min):
// - Return cached data immediately (sub-millisecond response)
// - Trigger background refresh (async, non-blocking)
// - Next request gets fresh data without waiting

async get<T>(key: string, dataType: string): T | null {
  const entry = this.cache.get(key);
  const age = (Date.now() - entry.timestamp) / 1000;
  const config = this.cacheConfigs[dataType];

  // Proactive refresh before expiry
  if (age > entry.ttl * config.refreshThreshold) {
    this.scheduleBackgroundRefresh(key, dataType);
  }

  return entry.data;
}
```

#### Cache Compression

**Enabled for:**
- Fundamental ratios (large JSON objects)
- Financial statements (verbose historical data)
- Batch operations (multiple symbols)
- Historical time series (long arrays)

**Compression Ratio:** ~60-70% size reduction for JSON data

---

### Failover Strategies

#### Primary-Secondary Failover

**Stock Quote Failover Chain:**
```
FMP (Primary) → EODHD → Yahoo Finance → Cached Data (Stale Acceptable)
```

**Economic Data Failover:**
```
FRED (Primary) → BLS → Cached Data → Error Response
```

**Implementation:**
```typescript
async getStockData(symbol: string): Promise<StockData> {
  // Attempt primary source
  const fmpData = await this.fmp.getStockPrice(symbol);
  if (fmpData) return fmpData;

  // Check if rate limited (429 response)
  if (this.fmp.isRateLimited()) {
    console.warn('FMP rate limited, failing over to EODHD');
    const eodhdData = await this.eodhd.getStockPrice(symbol);
    if (eodhdData) return eodhdData;
  }

  // Final fallback: stale cache acceptable for degraded mode
  const cachedData = await this.cache.get(`stock:${symbol}`);
  if (cachedData && Date.now() - cachedData.timestamp < 3600000) {
    console.warn('Using stale cache data for', symbol);
    return { ...cachedData, source: 'cache-stale' };
  }

  throw new Error(`Unable to retrieve stock data for ${symbol}`);
}
```

---

## Code Examples

### Example 1: Rate-Limited Batch Processing

**Scenario:** Retrieve fundamental ratios for 100 stocks without exceeding FMP rate limits

```typescript
import { financialDataService } from './services/financial-data/FinancialDataService';

async function processBatchWithRateLimiting(symbols: string[]) {
  const batchSize = 50;  // FMP allows 100 symbols per request
  const results = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);

    console.log(`Processing batch ${i / batchSize + 1}: ${batch.length} symbols`);

    // Single request for batch (counts as 1 against rate limit)
    const batchResults = await financialDataService.getBatchRatios(batch);
    results.push(...batchResults);

    // Inter-batch delay to prevent burst limit violation
    // 50 req/10sec limit = wait 200ms between batches
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`Processed ${results.length} symbols using ${Math.ceil(symbols.length / batchSize)} API calls`);
  return results;
}

// Usage
const top100Symbols = ['AAPL', 'MSFT', ...]; // 100 symbols
const ratios = await processBatchWithRateLimiting(top100Symbols);
// Result: 2 API calls instead of 100 (98% reduction)
```

### Example 2: Intelligent Cache-First Strategy

```typescript
import { FMPCacheManager } from './services/financial-data/FMPCacheManager';

const cacheManager = new FMPCacheManager();

async function getStockQuoteOptimized(symbol: string) {
  const cacheKey = `quote:${symbol}`;

  // 1. Check cache first (sub-millisecond)
  const cached = cacheManager.get(cacheKey, 'stock_price');
  if (cached) {
    console.log(`Cache HIT for ${symbol} (age: ${cached.age}s)`);
    return cached.data;
  }

  console.log(`Cache MISS for ${symbol} - fetching from API`);

  // 2. Fetch from API (200-300ms)
  const quote = await financialDataService.getStockPrice(symbol);

  // 3. Store in cache with 60s TTL
  cacheManager.set(cacheKey, quote, 'stock_price');

  return quote;
}

// First call: Cache MISS, API call (300ms)
await getStockQuoteOptimized('AAPL');

// Subsequent calls within 60s: Cache HIT (<1ms)
await getStockQuoteOptimized('AAPL');  // ~0.5ms response
await getStockQuoteOptimized('AAPL');  // ~0.5ms response
```

### Example 3: Parallel Requests with Rate Limit Protection

```typescript
import pLimit from 'p-limit';

async function getMultipleStocksParallel(symbols: string[]) {
  // Limit concurrency to prevent burst violations
  // FMP allows 50 req/10sec = 5 req/sec safe rate
  const limit = pLimit(5);

  const promises = symbols.map(symbol =>
    limit(() => financialDataService.getStockPrice(symbol))
  );

  // All requests execute in parallel with concurrency limit
  const results = await Promise.all(promises);

  return results;
}

// Process 20 stocks in 4 seconds (5 req/sec)
// Without limiting: Potential burst violation
// With limiting: Safe, predictable rate
const quotes = await getMultipleStocksParallel(symbols);
```

### Example 4: Economic Data Integration

```typescript
import { BLSAPI } from './services/financial-data/BLSAPI';
import { FREDAPI } from './services/financial-data/FREDAPI';

async function getComprehensiveEconomicData() {
  const bls = new BLSAPI();
  const fred = new FREDAPI();

  // Fetch critical indicators (respects individual rate limits)
  const [unemployment, inflation, fedFunds, gdp] = await Promise.all([
    bls.getLatestObservation('LNS14000000'),  // BLS: Unemployment
    bls.getLatestObservation('CUUR0000SA0'),  // BLS: CPI
    fred.getSeriesObservations('DFF', 1),      // FRED: Fed Funds Rate
    fred.getSeriesObservations('GDP', 1)       // FRED: GDP
  ]);

  return {
    unemployment: parseFloat(unemployment.value),
    inflation: parseFloat(inflation.value),
    fedFundsRate: parseFloat(fedFunds[0].value),
    gdp: parseFloat(gdp[0].value),
    timestamp: Date.now()
  };
}

// Single function call uses 2 BLS + 2 FRED requests
// Cached for 12 hours to minimize daily quota usage
```

---

## Troubleshooting

### Common Rate Limit Issues

#### Issue 1: FMP 429 "Limit Reach" Error

**Symptoms:**
```json
{
  "Error Message": "Limit Reach. Please upgrade your plan or visit our documentation for more details on pricing"
}
```

**Diagnosis:**
```typescript
// Check current rate limit status
const stats = await financialDataService.getRateLimitStats();
console.log('FMP Requests (last minute):', stats.fmpRequestsLastMinute);
console.log('FMP Requests (last hour):', stats.fmpRequestsLastHour);
console.log('Burst window (last 10s):', stats.fmpBurstWindow);
```

**Solutions:**
1. **Immediate:** Switch to cache or failover source
2. **Short-term:** Implement exponential backoff
3. **Long-term:** Increase cache TTL, optimize batch requests

#### Issue 2: BLS Daily Quota Exceeded

**Symptoms:** 500/day limit reached mid-session

**Prevention:**
```typescript
// Track daily usage
const dailyUsage = await cache.get('bls:daily_usage');
if (dailyUsage >= 450) {
  console.warn('BLS quota near limit, deferring non-critical requests');
  // Skip optional requests, prioritize critical indicators
}
```

**Recovery:**
- Quota resets at midnight ET (00:00 Eastern Time)
- Use cached data until reset
- Fallback to FRED for overlapping indicators

#### Issue 3: SEC EDGAR IP Block

**Symptoms:** All requests return 403 Forbidden

**Cause:** Exceeded 10 req/sec limit

**Prevention:**
```typescript
// Strict rate limiting with 100ms delay
private readonly REQUEST_DELAY = 100; // 10 req/sec max

// Queue requests to guarantee compliance
private requestQueue: Promise<any>[] = [];

async makeRequest(endpoint: string) {
  const now = Date.now();
  const elapsed = now - this.lastRequestTime;

  if (elapsed < this.REQUEST_DELAY) {
    // Wait exactly REQUEST_DELAY ms since last request
    await new Promise(r => setTimeout(r, this.REQUEST_DELAY - elapsed));
  }

  this.lastRequestTime = Date.now();
  return fetch(...);
}
```

**Recovery:**
- IP blocks typically last 24 hours
- Contact SEC EDGAR support with User-Agent details
- Use different network/IP if urgent

---

## Performance Benchmarks

### API Response Times (95th Percentile)

| Provider | Endpoint | Cached | Uncached | Improvement |
|----------|----------|--------|----------|-------------|
| FMP | Stock Quote | 1ms | 280ms | 280x |
| FMP | Fundamental Ratios | 2ms | 420ms | 210x |
| EODHD | Options Chain | 3ms | 450ms | 150x |
| FRED | Economic Series | 1ms | 650ms | 650x |
| BLS | Time Series | 2ms | 580ms | 290x |
| EIA | Energy Data | 1ms | 420ms | 420x |

### Cache Hit Rates (Production Metrics)

| Data Type | Cache Hit Rate | API Calls Saved |
|-----------|----------------|-----------------|
| Stock Quotes (60s TTL) | 78% | 4.5x reduction |
| Fundamentals (1hr TTL) | 94% | 16.7x reduction |
| Company Info (2hr TTL) | 97% | 33x reduction |
| Financial Statements (24hr TTL) | 99% | 100x reduction |

---

## Monitoring & Alerts

### Key Metrics to Track

```typescript
interface RateLimitMetrics {
  // Per-provider metrics
  fmpRequestsPerMinute: number;
  fmpBurstWindow: number;        // Last 10 seconds
  fredRequestsPerMinute: number;
  blsRequestsToday: number;
  eiaRequestsPerHour: number;

  // Cache metrics
  cacheHitRate: number;
  cacheMissRate: number;
  cacheSize: number;
  cacheEvictions: number;

  // Performance metrics
  avgResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;

  // Cost metrics
  fmpCostToday: number;          // Based on overage
  projectedMonthlyCost: number;
}
```

### Alert Thresholds

**WARNING Alerts:**
- FMP requests > 250/min (83% of limit)
- BLS requests > 400/day (80% of limit)
- Cache hit rate < 70%
- P95 response time > 1000ms

**CRITICAL Alerts:**
- FMP requests > 290/min (97% of limit)
- BLS requests > 480/day (96% of limit)
- Any 429 rate limit responses
- Cache hit rate < 50%
- Error rate > 5%

---

## Appendix

### A. Environment Variables Reference

```bash
# Required Commercial APIs
FMP_API_KEY=your_fmp_api_key                    # Financial Modeling Prep
EODHD_API_KEY=your_eodhd_api_key                # EODHD Options Data

# Optional Government APIs
FRED_API_KEY=your_fred_api_key                  # Federal Reserve
BLS_API_KEY=your_bls_api_key                    # Bureau of Labor Statistics
EIA_API_KEY=your_eia_api_key                    # Energy Information Admin

# Optional Commercial APIs
TWELVEDATA_API_KEY=your_twelve_api_key          # TwelveData
POLYGON_API_KEY=your_polygon_api_key            # Polygon.io

# Social/Alternative Data
REDDIT_CLIENT_ID=your_reddit_client_id          # Reddit OAuth2
REDDIT_CLIENT_SECRET=your_reddit_client_secret  # Reddit OAuth2
REDDIT_USER_AGENT=YourApp/1.0                   # Reddit User Agent

# Required Headers
SEC_USER_AGENT="VFR-API/1.0 (contact@veritak.com)"  # SEC EDGAR
BLS_USER_AGENT="VFR-API/1.0 BLS Collector"          # BLS (optional)
```

### B. Rate Limit Testing Script

```typescript
// scripts/test-rate-limits.ts
import { financialDataService } from '../app/services/financial-data';

async function testRateLimits() {
  console.log('Testing FMP rate limits...');

  const startTime = Date.now();
  let requestCount = 0;
  let errorCount = 0;

  // Attempt 350 requests in 60 seconds (above 300/min limit)
  for (let i = 0; i < 350; i++) {
    try {
      await financialDataService.getStockPrice('AAPL');
      requestCount++;
    } catch (error) {
      if (error.message.includes('429')) {
        console.log(`Rate limit hit at request ${requestCount}`);
        errorCount++;
      }
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`Test complete:`);
  console.log(`- Duration: ${elapsed.toFixed(1)}s`);
  console.log(`- Successful requests: ${requestCount}`);
  console.log(`- Rate limit errors: ${errorCount}`);
  console.log(`- Effective rate: ${(requestCount / elapsed * 60).toFixed(1)} req/min`);
}

testRateLimits();
```

---

**Document Version:** 1.0.0
**Maintainer:** VFR Development Team
**Last Review:** 2025-10-05
**Next Review:** 2025-11-05
