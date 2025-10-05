# API Rate Limits and Endpoint Availability Reference

**Document Version:** 1.0
**Last Updated:** October 5, 2025
**Purpose:** Comprehensive reference for rate limits and endpoint availability across financial data APIs

---

## Table of Contents

1. [Financial Modeling Prep (FMP) - Starter Plan](#1-financial-modeling-prep-fmp---starter-plan)
2. [EODHD API](#2-eodhd-api)
3. [FRED API (Federal Reserve Economic Data)](#3-fred-api-federal-reserve-economic-data)
4. [Alpha Vantage API - Free Tier](#4-alpha-vantage-api---free-tier)
5. [Yahoo Finance (yfinance Python Library)](#5-yahoo-finance-yfinance-python-library)
6. [Rate Limit Comparison Table](#6-rate-limit-comparison-table)
7. [Best Practices and Recommendations](#7-best-practices-and-recommendations)

---

## 1. Financial Modeling Prep (FMP) - Starter Plan

### Rate Limits

| Metric | Limit |
|--------|-------|
| **API Calls per Minute** | 300 requests/minute |
| **Bandwidth Limit** | 20GB (30-day trailing window) |
| **Daily Call Limit** | No explicit daily limit (bandwidth-limited) |

**Important:** FMP primarily uses bandwidth-based rate limiting rather than traditional request counts. Monitor your 30-day trailing bandwidth usage.

### Pricing

- **Cost:** $22.00/month (billed annually)
- **Plan:** Starter

### Available Endpoints

#### Stock Quotes
- **Real-time Quote:** `https://financialmodelingprep.com/stable/quote?symbol=AAPL`
- **Short Quote:** `https://financialmodelingprep.com/stable/quote-short?symbol=AAPL`

#### Historical Prices
- **End-of-Day Light:** `https://financialmodelingprep.com/stable/historical-price-eod/light?symbol=AAPL`
- **End-of-Day Full:** `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=AAPL`
- **Historical Range:** Up to 5 years

#### Insider Trades
- **Latest Insider Trades:** `https://financialmodelingprep.com/stable/insider-trading/latest?page=0&limit=100`
- **Search Insider Trades:** `https://financialmodelingprep.com/stable/insider-trading/search?page=0&limit=100`

#### Analyst Ratings
- **Stock Grades:** `https://financialmodelingprep.com/stable/grades?symbol=AAPL`
- **Price Target Summary:** `https://financialmodelingprep.com/stable/price-target-summary?symbol=AAPL`

#### Fundamentals
- **Income Statement:** `https://financialmodelingprep.com/stable/income-statement?symbol=AAPL`
- **Balance Sheet:** `https://financialmodelingprep.com/stable/balance-sheet-statement?symbol=AAPL`
- **Annual Fundamentals and Ratios:** Available
- **Company Profiles:** Available

### Starter Plan Restrictions

- **Market Coverage:** Limited to US exchanges
- **Sample Symbol Restrictions:** Some endpoints restricted to sample symbols (AAPL, TSLA, AMZN)
- **Partial Coverage:** Company and fundamental data may have partial coverage
- **Bulk APIs:** Advanced bulk endpoints (e.g., Company Profile Bulk API) restricted to higher-tier plans

### Data Coverage

- US Market Coverage
- Stock Quotes (Real-time and EOD)
- Financial Statements
- Historical Stock Prices
- Financial Market News
- Crypto and Forex Data

---

## 2. EODHD API

### Rate Limits

| Tier | Daily Limit | Per-Minute Limit | Cost |
|------|-------------|------------------|------|
| **Free** | 20 calls/day | 50 requests/minute | $0 |
| **EOD Historical Data** | 100,000 calls/day | 1,000 requests/minute | $19.99/month |
| **EOD+Intraday** | 100,000 calls/day | 1,000 requests/minute | $29.99/month |
| **Fundamentals Feed** | 100,000 calls/day | 1,000 requests/minute | $59.99/month |
| **All-In-One** | 100,000 calls/day | 1,000 requests/minute | $99.99/month |

### API Consumption Rates

**Important:** Different endpoints consume different numbers of API calls:

| Endpoint Type | API Calls Consumed |
|---------------|-------------------|
| **Standard Symbol Request** | 1 API call |
| **Fundamental API** | 10 API calls per request |
| **Options API** | 10 API calls per request |
| **Bond API** | 10 API calls per request |
| **Technical API** | 5 API calls per request |
| **Intraday API** | 5 API calls per request |
| **News API** | 5 API calls per request |
| **Bulk Exchange Request** | 100 API calls + additional per symbol |

### Options Chain Endpoints

**Endpoint:** `https://eodhd.com/api/options/[TICKER].US?api_token={YOUR_API_KEY}`

**Example:** `https://eodhd.com/api/options/AAPL.US?api_token=demo`

#### Options API Pricing
- **Standalone Options Package:** $29.99/month
- **Available via:** Marketplace or included in All-In-One package

#### Options Data Coverage
- **Symbols Covered:** 6,000+ top-traded US stocks
- **Historical Range:** Nearly 2 years of historical options data
- **Update Frequency:** Daily (EOD)
- **Data Points:** 40+ fields per options trade including:
  - Bid/Ask Prices
  - Trading Volume
  - Open Interest
  - Greeks (Delta, Gamma, Theta, Vega)
  - Implied Volatility
  - Contract Details

#### Options API Consumption
- Each options request consumes **10 API calls**
- With 100,000 daily limit: Maximum **10,000 options requests per day**

### Historical Data Endpoints

**Available in all paid tiers:**
- End-of-Day (EOD) Historical Data
- Historical Prices and Volumes
- Coverage: 60+ exchanges worldwide

**Intraday Data:**
- Available in EOD+Intraday tier and above
- Minute-level granularity

### Rate Limit Headers

EODHD provides rate limit information in response headers:
- `X-RateLimit-Limit: 1000` (requests per minute)
- `X-RateLimit-Remaining: [number]` (remaining requests)

### Reset Schedule

- **Subscription Plans:** Daily limit resets at midnight GMT
- **Marketplace Products:** Resets 24 hours after first request (rolling window)

### Additional Features

- Extra API calls can be purchased as a buffer
- Detailed usage statistics available in user dashboard
- Annual billing provides ~17% discount

---

## 3. FRED API (Federal Reserve Economic Data)

### Rate Limits

| Metric | Limit |
|--------|-------|
| **Requests per Minute** | ~120 requests/minute* |
| **Daily Limit** | No explicit daily limit |
| **Observations per Request** | 100,000 maximum |

**Note:** The 120 requests/minute limit is not officially documented by the Federal Reserve Bank of St. Louis but is widely observed and documented by third-party implementations (e.g., fredr R package).

### HTTP Status Codes

- **429 Too Many Requests:** Returned when rate limit exceeded
- **400 Bad Request:** Invalid parameters or API key

### Available Economic Data Series

The FRED API provides access to:
- **Total Series:** 841,000+ economic time series
- **Data Sources:** 118+ sources
- **Geographic Coverage:** US and international data
- **Update Frequency:** Varies by series (daily, weekly, monthly, quarterly, annual)

### Main API Endpoint Categories

1. **Categories**
   - Browse data by category hierarchy
   - Get category information and child categories

2. **Releases**
   - Access data organized by release schedules
   - Get release information and dates

3. **Series**
   - Core endpoint for time series data
   - Search, retrieve, and filter series

4. **Sources**
   - Information about data sources
   - Filter series by source

5. **Tags**
   - Tag-based search and filtering
   - Related tags discovery

6. **Maps API**
   - Geographic data visualization support

### Key Series Endpoints

- **Get Series Data:** Retrieve specific time series
- **Search Series:** Search across all series
- **Get Series Categories:** Category information for series
- **Get Series Observations:** Time series data points
- **Get Series Updates:** Recently updated series
- **Get Series Vintage Dates:** Historical revision dates

### API Key Requirements

- **Required:** Yes, free API key required
- **Registration:** Available at https://fred.stlouisfed.org/docs/api/api_key.html
- **Usage:** Append `?api_key={YOUR_API_KEY}` to requests

### Restrictions

- The Federal Reserve Bank may impose or adjust limits at their discretion
- Contact FRED support for requests exceeding standard limits
- API intended for research and educational purposes

### Base URL

`https://api.stlouisfed.org/fred/`

---

## 4. Alpha Vantage API - Free Tier

### Rate Limits - Free Tier

| Metric | Limit |
|--------|-------|
| **Requests per Minute** | 5 API requests/minute |
| **Requests per Day** | 25 API requests/day |
| **Monthly Limit** | ~750 requests/month |

**Critical Notes:**
- Rate limits enforced **per IP address** (not per API key)
- Cycling multiple API keys from same IP does not bypass limits
- Exceeding limits returns error: "Our standard API call frequency is 5 calls per minute and 500 calls per day"

**Recent Update (2025):** Free tier appears to have been reduced from 500 calls/day to 25 calls/day based on current documentation.

### Premium Tier Comparison

| Tier | Cost/Month | Calls/Minute | Daily Limit |
|------|------------|--------------|-------------|
| **Free** | $0 | 5 | 25 |
| **Premium (Basic)** | $49.99 | 75 | No limit |
| **Premium (Standard)** | Higher tiers | Higher | No limit |

### Available Endpoints - Free Tier

#### Time Series Data (Stock Data)
- **Intraday:** `TIME_SERIES_INTRADAY`
- **Daily:** `TIME_SERIES_DAILY`
- **Daily Adjusted:** `TIME_SERIES_DAILY_ADJUSTED`
- **Weekly:** `TIME_SERIES_WEEKLY`
- **Weekly Adjusted:** `TIME_SERIES_WEEKLY_ADJUSTED`
- **Monthly:** `TIME_SERIES_MONTHLY`
- **Monthly Adjusted:** `TIME_SERIES_MONTHLY_ADJUSTED`

#### Quote Endpoints
- **Global Quote:** `GLOBAL_QUOTE`
- **Realtime Bulk Quotes:** Premium only

#### Utility Endpoints
- **Symbol Search:** `SYMBOL_SEARCH`
- **Market Status:** `MARKET_STATUS`

#### News & Sentiment
- **Market News & Sentiment API:** `NEWS_SENTIMENT`
  - Filter by tickers
  - Filter by topics
  - Filter by time range
  - Multiple sorting options

**Available on free tier with rate limits**

#### Options Data
- **Realtime Options:** Premium only
- **Historical Options:** Premium only

### Base URL

`https://www.alphavantage.co/query`

### Request Format

```
https://www.alphavantage.co/query?function={FUNCTION}&symbol={SYMBOL}&apikey={YOUR_API_KEY}
```

### Best Practices for Free Tier

- **Wait Time Between Requests:** 12 seconds minimum (to stay under 5/minute)
- **Daily Planning:** Prioritize essential calls (only 25/day)
- **Caching:** Cache responses aggressively
- **Error Handling:** Implement exponential backoff for rate limit errors

### Restrictions

- Historical data range may be limited on free tier
- Real-time data may have delays
- Premium features (bulk quotes, options) not available
- Strict enforcement of IP-based rate limiting

---

## 5. Yahoo Finance (yfinance Python Library)

### Rate Limits

**Status:** No officially documented rate limits

**Practical Limits:**
- Yahoo Finance does not publish official API documentation or rate limits
- Rate limiting is **dynamically enforced** based on usage patterns
- Aggressive usage results in **HTTP 429 errors** or **IP blocking**

### Recent Issues (2024-2025)

- **Increased Restrictions:** Yahoo tightened limits in early 2024
- **IP Blocking:** Reports of temporary and permanent IP bans
- **YFRateLimitError:** Common error message "Too Many Requests. Rate limited. Try after a while."
- **Pattern Detection:** Yahoo flags suspicious request patterns (even from different API endpoints)

### yfinance Library Details

**Library Type:** Web scraper (not official API)
- **Affiliation:** Not affiliated, endorsed, or vetted by Yahoo, Inc.
- **Method:** Loads Yahoo Finance endpoints and parses JSON/HTML
- **Purpose:** Research and educational use
- **Status:** Open-source community project

**Installation:**
```bash
pip install yfinance
```

### Available Historical Data

Through yfinance, you can access:

#### Stock Data
- **Historical Prices:** OHLCV data
- **Dividends:** Historical dividend payments
- **Stock Splits:** Split history
- **Corporate Actions:** Mergers, acquisitions

#### Time Periods
- **Intraday:** 1m, 2m, 5m, 15m, 30m, 60m, 90m intervals
- **Daily and Above:** 1d, 5d, 1wk, 1mo, 3mo
- **Historical Range:** Varies by symbol (often 10+ years for major stocks)

#### Fundamental Data
- **Financial Statements:** Income statement, balance sheet, cash flow
- **Company Info:** Sector, industry, description
- **Key Statistics:** Market cap, P/E ratio, etc.
- **Options Chains:** Current options data
- **Earnings:** Historical and upcoming earnings

### Restrictions and Limitations

1. **No Official Support:** Yahoo provides no guarantees or support
2. **Breaking Changes:** API structure can change without notice
3. **Data Accuracy:** Data provided "as-is" without accuracy guarantees
4. **Personal Use Only:** Terms suggest personal use only
5. **Rate Limiting:** Unpredictable and can change at any time
6. **IP Blocking Risk:** Aggressive usage may result in temporary or permanent blocks

### Best Practices for yfinance

**To Minimize Rate Limit Issues:**

1. **Implement Delays:**
   ```python
   import time
   time.sleep(2)  # Wait 2 seconds between requests
   ```

2. **Batch Requests:**
   - Use bulk ticker downloads where possible
   - Download multiple symbols in single session

3. **Cache Data:**
   - Store historical data locally
   - Avoid repeated requests for same data

4. **Respect Usage Patterns:**
   - Avoid parallel requests
   - Spread requests over time
   - Don't scrape entire markets

5. **Error Handling:**
   ```python
   import yfinance as yf
   from requests.exceptions import HTTPError

   try:
       data = yf.download("AAPL", period="1mo")
   except HTTPError as e:
       if e.response.status_code == 429:
           print("Rate limited - waiting...")
           time.sleep(60)
   ```

6. **Use Intervals Wisely:**
   - Longer intervals = less data = lower likelihood of rate limiting
   - Request only necessary date ranges

7. **Consider Alternatives:**
   - For production use, consider paid APIs with guaranteed rate limits
   - yfinance best suited for research and backtesting

### Alternative Solutions

If yfinance rate limiting becomes problematic:
- **Financial Modeling Prep:** Starter plan ($22/month)
- **Alpha Vantage:** Free tier (limited) or premium
- **EODHD:** Starting at $19.99/month
- **IEX Cloud:** Flexible pricing
- **Polygon.io:** Real-time and historical data

### Data Access Methods

**Basic Example:**
```python
import yfinance as yf

# Single ticker
ticker = yf.Ticker("AAPL")
hist = ticker.history(period="1mo")

# Multiple tickers
data = yf.download("AAPL MSFT GOOGL", start="2024-01-01", end="2024-12-31")

# Options data
options = ticker.options  # Get available expiration dates
chain = ticker.option_chain('2024-12-20')
```

---

## 6. Rate Limit Comparison Table

### Requests Per Minute

| API | Free Tier | Paid Tier (Entry) | Notes |
|-----|-----------|-------------------|-------|
| **FMP** | N/A | 300/min | Starter plan $22/mo |
| **EODHD** | 50/min | 1,000/min | Paid $19.99/mo+ |
| **FRED** | ~120/min | ~120/min | Same for all users |
| **Alpha Vantage** | 5/min | 75/min | Premium $49.99/mo |
| **Yahoo Finance** | Undefined | N/A | No official limits |

### Requests Per Day

| API | Free Tier | Paid Tier (Entry) | Notes |
|-----|-----------|-------------------|-------|
| **FMP** | N/A | Bandwidth-limited | 20GB/30-day window |
| **EODHD** | 20/day | 100,000/day | Major increase on paid |
| **FRED** | No limit | No limit | Rate/minute enforced |
| **Alpha Vantage** | 25/day | No limit | Severely restricted free tier |
| **Yahoo Finance** | Undefined | N/A | Dynamic enforcement |

### Cost Comparison

| API | Free Option | Cheapest Paid | Premium Features |
|-----|-------------|---------------|------------------|
| **FMP** | Limited free tier | $22/mo | Insider trades, analyst ratings |
| **EODHD** | 20 calls/day | $19.99/mo | Most affordable for volume |
| **FRED** | Free forever | Free | Government data source |
| **Alpha Vantage** | 25 calls/day | $49.99/mo | Higher cost for volume |
| **Yahoo Finance** | Free (unofficial) | N/A | No official API |

---

## 7. Best Practices and Recommendations

### For Different Use Cases

#### Research & Backtesting (Low Volume)
**Recommended:** FRED (free) + yfinance (free) + Alpha Vantage free tier
- **Cost:** $0/month
- **Limitations:** 25 Alpha Vantage calls/day, yfinance unpredictable
- **Best for:** Historical analysis, small-scale research

#### Development & Testing (Medium Volume)
**Recommended:** EODHD ($19.99/mo) or FMP Starter ($22/mo)
- **Cost:** ~$20/month
- **Benefits:** Reliable rate limits, comprehensive data
- **Best for:** Building applications, consistent testing

#### Production Applications (High Volume)
**Recommended:** EODHD All-In-One ($99.99/mo) or FMP Premium
- **Cost:** $50-100+/month
- **Benefits:** High rate limits, all data types, support
- **Best for:** Live trading apps, data-intensive platforms

#### Economic Data Only
**Recommended:** FRED (free)
- **Cost:** $0/month
- **Benefits:** Authoritative source, generous limits
- **Best for:** Economic indicators, macro analysis

### Implementation Best Practices

#### 1. Rate Limit Handling

**Implement Exponential Backoff:**
```typescript
async function fetchWithRetry(apiCall: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.status === 429) {
        const delay = Math.pow(2, i) * 1000; // Exponential: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

#### 2. Request Queuing

**Implement Queue System:**
```typescript
class RateLimitedQueue {
  private queue: Array<() => Promise<any>> = [];
  private requestsPerMinute: number;
  private interval: number;

  constructor(requestsPerMinute: number) {
    this.requestsPerMinute = requestsPerMinute;
    this.interval = 60000 / requestsPerMinute; // ms between requests
  }

  async enqueue(apiCall: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await apiCall();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) return;

    const apiCall = this.queue.shift()!;
    await apiCall();

    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), this.interval);
    }
  }
}
```

#### 3. Response Caching

**Implement Caching Layer:**
```typescript
class CachedAPIClient {
  private cache = new Map<string, {data: any, timestamp: number}>();
  private cacheDuration = 60000; // 1 minute default

  async get(endpoint: string, ttl = this.cacheDuration): Promise<any> {
    const cached = this.cache.get(endpoint);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    const data = await this.fetchFromAPI(endpoint);
    this.cache.set(endpoint, {data, timestamp: Date.now()});

    return data;
  }

  private async fetchFromAPI(endpoint: string): Promise<any> {
    // Actual API call implementation
  }
}
```

#### 4. Monitor Usage

**Track API Usage:**
```typescript
class APIUsageMonitor {
  private usage = {
    callsToday: 0,
    callsThisMinute: 0,
    bandwidthUsed: 0,
    lastReset: Date.now()
  };

  recordCall(responseSize: number) {
    this.usage.callsToday++;
    this.usage.callsThisMinute++;
    this.usage.bandwidthUsed += responseSize;

    // Reset minute counter
    setTimeout(() => {
      this.usage.callsThisMinute = 0;
    }, 60000);
  }

  canMakeRequest(apiLimits: {perMinute: number, perDay: number}): boolean {
    return this.usage.callsThisMinute < apiLimits.perMinute &&
           this.usage.callsToday < apiLimits.perDay;
  }
}
```

### Bandwidth Optimization (Especially for FMP)

1. **Request only required fields:**
   - Use "light" endpoints when available
   - Filter response data

2. **Compress responses:**
   - Enable GZIP compression
   - Most APIs support `Accept-Encoding: gzip`

3. **Batch requests:**
   - Use bulk endpoints where available
   - Combine symbol requests

4. **Monitor bandwidth:**
   - Track response sizes
   - Calculate 30-day rolling totals (for FMP)

### Multi-API Strategy

**Fallback Chain:**
```typescript
class MultiAPIClient {
  async getStockQuote(symbol: string): Promise<any> {
    try {
      // Try primary API (FMP)
      return await this.fmpClient.getQuote(symbol);
    } catch (error) {
      console.log('FMP failed, trying EODHD...');
      try {
        return await this.eodhdClient.getQuote(symbol);
      } catch (error) {
        console.log('EODHD failed, trying yfinance...');
        return await this.yfinanceClient.getQuote(symbol);
      }
    }
  }
}
```

### Error Handling

**Comprehensive Error Handler:**
```typescript
function handleAPIError(error: any, apiName: string): void {
  switch (error.status) {
    case 429:
      console.error(`${apiName}: Rate limit exceeded`);
      // Implement backoff strategy
      break;
    case 401:
      console.error(`${apiName}: Invalid API key`);
      break;
    case 403:
      console.error(`${apiName}: Forbidden - check subscription tier`);
      break;
    case 404:
      console.error(`${apiName}: Endpoint not found`);
      break;
    case 500:
      console.error(`${apiName}: Server error`);
      // Retry with exponential backoff
      break;
    default:
      console.error(`${apiName}: Unknown error`, error);
  }
}
```

### Testing Rate Limits

**Important:** When testing API integrations:

1. **Start with free tiers** to understand behavior
2. **Monitor response headers** for rate limit info
3. **Test edge cases** (what happens at exactly the limit?)
4. **Document actual limits** (may differ from documentation)
5. **Plan for limit increases** as your application scales

### Cost Optimization

**Strategies to minimize API costs:**

1. **Cache aggressively:**
   - Stock quotes: 1-15 minute cache
   - Historical data: Cache until market close
   - Fundamentals: Cache for 24 hours
   - Economic data: Cache for hours/days

2. **Use appropriate data frequency:**
   - Don't request minute data when daily suffices
   - Align update frequency with actual needs

3. **Combine free tiers strategically:**
   - FRED for economic data
   - yfinance for bulk historical downloads
   - Paid APIs for critical real-time data

4. **Monitor and optimize:**
   - Track which endpoints consume most calls
   - Identify redundant requests
   - Optimize query patterns

---

## Summary

### Quick Reference by API

| API | Best For | Rate Limit | Cost | Reliability |
|-----|----------|------------|------|-------------|
| **FMP Starter** | Comprehensive US market data | 300/min, 20GB/30d | $22/mo | High |
| **EODHD** | Best value for volume | 1000/min, 100K/day | $19.99/mo | High |
| **FRED** | Economic indicators | ~120/min | Free | Very High |
| **Alpha Vantage** | Light usage, testing | 5/min, 25/day | Free/$49.99 | Medium |
| **yfinance** | Research, backtesting | Undefined | Free | Low-Medium |

### Endpoint Availability Summary

| Data Type | FMP | EODHD | FRED | Alpha Vantage | yfinance |
|-----------|-----|-------|------|---------------|----------|
| Stock Quotes | ✅ | ✅ | ❌ | ✅ | ✅ |
| Historical Prices | ✅ (5yr) | ✅ | ❌ | ✅ | ✅ |
| Insider Trades | ✅ | ❌ | ❌ | ❌ | ❌ |
| Analyst Ratings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Fundamentals | ✅ | ✅ | ❌ | ✅ | ✅ |
| Options Data | ⚠️ | ✅ ($29.99) | ❌ | Premium | ✅ |
| Economic Data | ❌ | ❌ | ✅ | ✅ | ❌ |
| News/Sentiment | ✅ | ✅ | ❌ | ✅ | ❌ |

**Legend:**
- ✅ Available
- ❌ Not available
- ⚠️ Limited or higher tier only

---

## Additional Resources

### Official Documentation Links

- **FMP:** https://site.financialmodelingprep.com/developer/docs
- **EODHD:** https://eodhd.com/financial-apis
- **FRED:** https://fred.stlouisfed.org/docs/api/fred/
- **Alpha Vantage:** https://www.alphavantage.co/documentation/
- **yfinance:** https://pypi.org/project/yfinance/

### Support Channels

- **FMP:** support@financialmodelingprep.com
- **EODHD:** Contact form on website
- **FRED:** https://fred.stlouisfed.org/contactus/
- **Alpha Vantage:** support@alphavantage.co
- **yfinance:** GitHub issues only (community support)

---

**Document Maintenance:**
This document should be reviewed and updated quarterly or when significant API changes are announced. Always verify current rate limits with official documentation before making architectural decisions.
