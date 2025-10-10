# EODHD Options API - UnicornBay Marketplace Reference

**API Key**: `68cf08e135b402.52970225`
**Provider**: EODHD Financial APIs
**Marketplace Add-on**: UnicornBay Options Data
**Base URL**: `https://eodhd.com/api`

## Plan Features

### Standard EODHD Features
- End-of-Day Historical Stock Market Data
- Real-Time Data via WebSockets
- Intraday Historical Stock Price Data
- Fundamental Data for Stocks, ETFs, Mutual Funds
- Corporate Actions (Splits/Dividends)
- Stock Market Screener
- Technical Analysis Indicators
- Economic Events & Macro Indicators
- Financial News

### UnicornBay Options Add-On (Your Subscription)
- **Daily Updated Options Data** for 6,000+ top-traded US stocks
- **40+ Fields Per Contract** including:
  - Bid/Ask prices
  - Greeks (Delta, Gamma, Theta, Vega, Rho)
  - Implied Volatility metrics
  - Volume and Open Interest
  - Contract details
  - Liquidity scores
  - Moneyness ratios
  - Theoretical pricing
- **Historical Options Data** for the past year
- **JSON Format** for easy integration
- **Advanced Risk Metrics** for trading strategies

## Authentication

All requests require authentication via API token. Include your API token as a query parameter:

```
?api_token=68cf08e135b402.52970225
```

---

## Endpoints

### 1. Real-Time Stock Data

#### 1.1 Get Real-Time Quote

**Endpoint**: `GET /real-time/{symbol}.US`

**Description**: Retrieve real-time stock quote with current price, volume, and daily changes.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol (e.g., "AAPL")

**Query Parameters**:
- `api_token` (string, required): Your API key
- `fmt` (string, optional): Response format (default: "json")

**Example Request**:
```bash
curl "https://eodhd.com/api/real-time/AAPL.US?api_token=68cf08e135b402.52970225&fmt=json"
```

**Response Structure**:
```json
{
  "code": "AAPL.US",
  "timestamp": 1704470400,
  "gmtoffset": -18000,
  "open": 185.28,
  "high": 186.50,
  "low": 184.35,
  "close": 185.92,
  "volume": 45678900,
  "previousClose": 184.25,
  "change": 1.67,
  "change_p": 0.91
}
```

**Response Attributes**:
- `code`: Ticker symbol with exchange
- `timestamp`: Unix timestamp
- `gmtoffset`: GMT offset in seconds
- `open`: Opening price
- `high`: Day's high price
- `low`: Day's low price
- `close`: Current/closing price
- `volume`: Trading volume
- `previousClose`: Previous day's close
- `change`: Price change in dollars
- `change_p`: Price change percentage

**Use Cases**:
- Real-time portfolio tracking
- Price alerts
- Trading signals
- Market monitoring

---

### 2. Fundamental Data

#### 2.1 Get Company Fundamentals

**Endpoint**: `GET /fundamentals/{symbol}.US`

**Description**: Retrieve comprehensive fundamental data including financials, ratios, highlights, and valuation.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `api_token` (string, required): Your API key
- `fmt` (string, optional): Response format (default: "json")

**Example Request**:
```bash
curl "https://eodhd.com/api/fundamentals/AAPL.US?api_token=68cf08e135b402.52970225&fmt=json"
```

**Response Structure** (abbreviated):
```json
{
  "General": {
    "Name": "Apple Inc",
    "Description": "Apple Inc. designs...",
    "Sector": "Technology",
    "Industry": "Consumer Electronics",
    "EmployeeCount": 164000,
    "WebURL": "https://www.apple.com"
  },
  "Highlights": {
    "MarketCapitalization": 2950000000000,
    "PERatio": 29.5,
    "PEGRatio": 2.8,
    "DividendYield": 0.0045,
    "ReturnOnEquityTTM": 1.473,
    "ProfitMarginTTM": 0.253
  },
  "Valuation": {
    "TrailingPE": 29.5,
    "PriceBookMRQ": 45.8,
    "PriceSalesTTM": 7.5
  },
  "Financials": {
    "Income_Statement": {
      "quarterly": [...],
      "yearly": [...]
    },
    "Balance_Sheet": {
      "quarterly": [...],
      "yearly": [...]
    },
    "Cash_Flow": {
      "quarterly": [...],
      "yearly": [...]
    }
  }
}
```

**Key Sections**:
- **General**: Company information, sector, industry, employees
- **Highlights**: Key financial metrics and ratios
- **Valuation**: Valuation multiples
- **Technicals**: Technical indicators
- **SharesStats**: Share-related statistics
- **Financials**: Complete financial statements
- **SplitsDividends**: Historical splits and dividends

**Use Cases**:
- Fundamental analysis
- Valuation modeling
- Company research
- Financial screening

---

### 3. Options Data (UnicornBay Marketplace)

#### 3.1 Get Options Chain (UnicornBay Enhanced)

**Endpoint**: `GET /mp/unicornbay/options/contracts`

**Description**: Retrieve enhanced options chain data with 40+ fields per contract including advanced Greeks, liquidity metrics, and theoretical pricing.

**Query Parameters**:
- `filter[underlying_symbol]` (string, required): Stock ticker symbol (URL-encoded: `filter%5Bunderlying_symbol%5D`)
- `filter[exp_date]` (string, optional): Specific expiration date (YYYY-MM-DD)
- `filter[exp_date_from]` (string, optional): Start date for expiration range
- `filter[exp_date_to]` (string, optional): End date for expiration range
- `filter[strike_gte]` (number, optional): Minimum strike price
- `filter[strike_lte]` (number, optional): Maximum strike price
- `filter[type]` (string, optional): Option type ("CALL" or "PUT")
- `page[limit]` (integer, optional): Number of contracts to return (default: 200, max: 1000)
- `sort` (string, optional): Sort field (e.g., "exp_date", "strike")
- `api_token` (string, required): Your API key

**Example Request**:
```bash
curl "https://eodhd.com/api/mp/unicornbay/options/contracts?filter%5Bunderlying_symbol%5D=AAPL&filter%5Bexp_date_from%5D=2024-01-01&page%5Blimit%5D=200&sort=exp_date&api_token=68cf08e135b402.52970225"
```

**Example with Specific Expiration**:
```bash
curl "https://eodhd.com/api/mp/unicornbay/options/contracts?filter%5Bunderlying_symbol%5D=AAPL&filter%5Bexp_date%5D=2024-03-15&api_token=68cf08e135b402.52970225"
```

**Example with Strike Range**:
```bash
curl "https://eodhd.com/api/mp/unicornbay/options/contracts?filter%5Bunderlying_symbol%5D=AAPL&filter%5Bstrike_gte%5D=180&filter%5Bstrike_lte%5D=200&api_token=68cf08e135b402.52970225"
```

**Response Structure** (JSON:API format):
```json
{
  "data": [
    {
      "id": "1234567",
      "type": "option_contract",
      "attributes": {
        "symbol": "AAPL240315C00185000",
        "underlying_symbol": "AAPL",
        "exp_date": "2024-03-15",
        "type": "Call",
        "strike": 185.0,
        "exchange": "CBOE",
        "currency": "USD",

        "open": 5.20,
        "high": 5.85,
        "low": 5.10,
        "last": 5.65,
        "bid": 5.60,
        "ask": 5.70,
        "volume": 2500,
        "open_interest": 15000,

        "delta": 0.55,
        "gamma": 0.045,
        "theta": -0.08,
        "vega": 0.12,
        "rho": 0.025,

        "implied_volatility": 0.28,
        "iv_change": 0.02,
        "iv_change_percent": 7.14,

        "midpoint": 5.65,
        "theoretical_price": 5.63,
        "moneyness_ratio": 0.995,
        "days_to_expiration": 45,
        "trade_count": 180,
        "bid_size": 50,
        "ask_size": 75,
        "spread": 0.10,
        "spread_percent": 1.77,

        "last_trade_time": "2024-01-30T20:00:00Z",
        "timestamp": 1706644800
      }
    }
  ],
  "meta": {
    "total": 156,
    "page": 1,
    "per_page": 200,
    "timestamp": 1706644800
  }
}
```

**40+ Fields Available**:

**Basic Contract Details**:
- `symbol`: Options contract symbol
- `underlying_symbol`: Stock ticker
- `exp_date`: Expiration date
- `type`: "Call" or "Put"
- `strike`: Strike price
- `exchange`: Trading exchange
- `currency`: Currency

**Price Metrics**:
- `open`: Opening price
- `high`: Day's high
- `low`: Day's low
- `last`: Last traded price
- `bid`: Current bid price
- `ask`: Current ask price
- `volume`: Trading volume
- `open_interest`: Open interest

**Greeks (Risk Metrics)**:
- `delta`: Delta (price sensitivity)
- `gamma`: Gamma (delta sensitivity)
- `theta`: Theta (time decay)
- `vega`: Vega (volatility sensitivity)
- `rho`: Rho (interest rate sensitivity)

**Volatility Metrics**:
- `implied_volatility`: IV (annualized)
- `iv_change`: IV change from previous day
- `iv_change_percent`: IV change percentage

**Advanced Metrics**:
- `midpoint`: Bid-ask midpoint
- `theoretical_price`: Black-Scholes theoretical value
- `moneyness_ratio`: Strike/underlying price ratio
- `days_to_expiration`: Days until expiration
- `trade_count`: Number of trades
- `bid_size`: Contracts at bid
- `ask_size`: Contracts at ask
- `spread`: Bid-ask spread
- `spread_percent`: Spread as percentage

**Timestamps**:
- `last_trade_time`: Last trade timestamp (ISO 8601)
- `timestamp`: Data timestamp (Unix)

**Use Cases**:
- Options trading strategies
- Risk management
- Volatility analysis
- Greeks hedging
- Liquidity screening
- Arbitrage opportunities

---

#### 3.2 Get Standard Options Chain

**Endpoint**: `GET /options/{symbol}.US`

**Description**: Retrieve standard options chain data (if available on your plan).

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `date` (string, optional): Expiration date (YYYY-MM-DD)
- `api_token` (string, required): Your API key
- `fmt` (string, optional): Response format

**Example Request**:
```bash
curl "https://eodhd.com/api/options/AAPL.US?date=2024-03-15&api_token=68cf08e135b402.52970225&fmt=json"
```

**Response Structure**:
```json
{
  "symbol": "AAPL",
  "expiration": "2024-03-15",
  "calls": [
    {
      "symbol": "AAPL240315C00185000",
      "contractName": "AAPL Mar 15 2024 185.00 Call",
      "strike": 185.0,
      "expiration": "2024-03-15",
      "type": "call",
      "lastPrice": 5.65,
      "bid": 5.60,
      "ask": 5.70,
      "volume": 2500,
      "openInterest": 15000,
      "impliedVolatility": 0.28,
      "delta": 0.55,
      "gamma": 0.045,
      "theta": -0.08,
      "vega": 0.12,
      "change": 0.15,
      "changePercent": 2.73,
      "inTheMoney": false,
      "contractSize": 100,
      "timestamp": 1706644800
    }
  ],
  "puts": [
    {
      "symbol": "AAPL240315P00185000",
      "contractName": "AAPL Mar 15 2024 185.00 Put",
      "strike": 185.0,
      "expiration": "2024-03-15",
      "type": "put",
      "lastPrice": 4.25,
      "bid": 4.20,
      "ask": 4.30,
      "volume": 1800,
      "openInterest": 12000,
      "impliedVolatility": 0.26,
      "delta": -0.45,
      "gamma": 0.045,
      "theta": -0.07,
      "vega": 0.11,
      "change": -0.10,
      "changePercent": -2.30,
      "inTheMoney": false,
      "contractSize": 100,
      "timestamp": 1706644800
    }
  ],
  "timestamp": 1706644800
}
```

**Note**: Standard options endpoint may require higher-tier subscription. UnicornBay endpoint is recommended for enhanced data.

---

### 4. Historical Data

#### 4.1 Get End-of-Day Historical Prices

**Endpoint**: `GET /eod/{symbol}.US`

**Description**: Retrieve historical end-of-day price data.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)
- `period` (string, optional): Data period ("d" for daily, "w" for weekly, "m" for monthly)
- `api_token` (string, required): Your API key
- `fmt` (string, optional): Response format

**Example Request**:
```bash
curl "https://eodhd.com/api/eod/AAPL.US?from=2023-01-01&to=2023-12-31&period=d&api_token=68cf08e135b402.52970225&fmt=json"
```

**Response Structure**:
```json
[
  {
    "date": "2023-12-29",
    "open": 193.90,
    "high": 194.40,
    "low": 191.73,
    "close": 192.53,
    "adjusted_close": 192.53,
    "volume": 42628200
  },
  {
    "date": "2023-12-28",
    "open": 194.14,
    "high": 194.66,
    "low": 193.17,
    "close": 193.58,
    "adjusted_close": 193.58,
    "volume": 34049900
  }
]
```

**Use Cases**:
- Historical backtesting
- Long-term analysis
- Performance tracking
- Chart generation

---

#### 4.2 Get Intraday Historical Data

**Endpoint**: `GET /intraday/{symbol}.US`

**Description**: Retrieve intraday price data at various intervals.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `interval` (string, optional): Time interval ("5m", "1h", etc.) (default: "5m")
- `from` (integer, optional): Unix timestamp for start
- `to` (integer, optional): Unix timestamp for end
- `api_token` (string, required): Your API key
- `fmt` (string, optional): Response format

**Example Request**:
```bash
curl "https://eodhd.com/api/intraday/AAPL.US?interval=5m&api_token=68cf08e135b402.52970225&fmt=json"
```

**Response Structure**:
```json
[
  {
    "datetime": "2024-01-30 09:30:00",
    "gmtoffset": -18000,
    "open": 185.50,
    "high": 185.85,
    "low": 185.35,
    "close": 185.70,
    "volume": 250000
  },
  {
    "datetime": "2024-01-30 09:35:00",
    "gmtoffset": -18000,
    "open": 185.70,
    "high": 185.95,
    "low": 185.60,
    "close": 185.85,
    "volume": 180000
  }
]
```

**Use Cases**:
- Intraday trading
- Short-term analysis
- Pattern recognition
- Scalping strategies

---

### 5. Corporate Actions

#### 5.1 Get Dividend History

**Endpoint**: `GET /div/{symbol}.US`

**Description**: Retrieve historical dividend payments.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)
- `api_token` (string, required): Your API key
- `fmt` (string, optional): Response format

**Example Request**:
```bash
curl "https://eodhd.com/api/div/AAPL.US?api_token=68cf08e135b402.52970225&fmt=json"
```

**Response Structure**:
```json
[
  {
    "date": "2023-11-10",
    "declarationDate": "2023-11-02",
    "recordDate": "2023-11-13",
    "paymentDate": "2023-11-16",
    "value": 0.24,
    "currency": "USD"
  }
]
```

---

#### 5.2 Get Stock Splits

**Endpoint**: `GET /splits/{symbol}.US`

**Description**: Retrieve historical stock split events.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `from` (string, optional): Start date
- `to` (string, optional): End date
- `api_token` (string, required): Your API key

**Example Request**:
```bash
curl "https://eodhd.com/api/splits/AAPL.US?api_token=68cf08e135b402.52970225&fmt=json"
```

**Response Structure**:
```json
[
  {
    "date": "2020-08-31",
    "split": "4/1"
  }
]
```

---

### 6. Bulk and Utility APIs

#### 6.1 Get Exchange List

**Endpoint**: `GET /exchanges-list`

**Description**: Retrieve list of supported exchanges.

**Query Parameters**:
- `api_token` (string, required): Your API key
- `fmt` (string, optional): Response format

**Example Request**:
```bash
curl "https://eodhd.com/api/exchanges-list?api_token=68cf08e135b402.52970225&fmt=json"
```

---

#### 6.2 Get Exchange Symbols

**Endpoint**: `GET /exchange-symbol-list/{exchange}`

**Description**: Retrieve list of symbols for a specific exchange.

**Path Parameters**:
- `exchange` (string, required): Exchange code (e.g., "US", "NASDAQ")

**Query Parameters**:
- `api_token` (string, required): Your API key
- `fmt` (string, optional): Response format

**Example Request**:
```bash
curl "https://eodhd.com/api/exchange-symbol-list/US?api_token=68cf08e135b402.52970225&fmt=json"
```

---

#### 6.3 Search Instruments

**Endpoint**: `GET /search/{query}`

**Description**: Search for tickers, company names, or ISINs.

**Path Parameters**:
- `query` (string, required): Search query

**Query Parameters**:
- `api_token` (string, required): Your API key
- `type` (string, optional): Asset type filter
- `exchange` (string, optional): Exchange filter
- `limit` (integer, optional): Number of results

**Example Request**:
```bash
curl "https://eodhd.com/api/search/Apple?api_token=68cf08e135b402.52970225"
```

---

## UnicornBay Options Analysis Functions

### 7.1 Put/Call Ratio Analysis

**Description**: Calculate put/call ratios from options chain data for sentiment analysis.

**Calculated Metrics**:
- `volumeRatio`: Total put volume / Total call volume
- `openInterestRatio`: Total put OI / Total call OI
- `liquidVolumeRatio`: Liquid put volume / Liquid call volume (filtered by liquidity score > 2)
- `dataCompleteness`: Data quality indicator (0.0 to 1.0)

**Interpretation**:
- **Ratio > 1.2**: Bearish sentiment (more puts than calls)
- **Ratio < 0.8**: Bullish sentiment (more calls than puts)
- **Ratio 0.8-1.2**: Neutral sentiment

**Use Cases**:
- Market sentiment analysis
- Contrarian indicators
- Fear/greed assessment

---

### 7.2 Options Flow Analysis

**Description**: Track institutional options flow and unusual activity.

**Calculated Metrics**:
- `callFlow`: Dollar volume of call options
- `putFlow`: Dollar volume of put options
- `netFlow`: Call flow - Put flow
- `flowRatio`: Call flow / Put flow
- `unusualActivity`: Boolean flag for unusual volume/liquidity
- `institutionalSentiment`: "bullish", "bearish", or "neutral"

**Detection Criteria**:
- Unusual activity: Average liquidity score > 7 OR flow ratio deviation > 2
- Bullish sentiment: Flow ratio > 1.5
- Bearish sentiment: Flow ratio < 0.67

**Use Cases**:
- Smart money tracking
- Institutional positioning
- Large order detection
- Market maker activity

---

### 7.3 Greeks Portfolio Analysis

**Description**: Aggregate portfolio-level Greeks for risk management.

**Calculated Metrics**:
- `totalDelta`: Sum of all deltas (directional risk)
- `totalGamma`: Sum of all gammas (convexity risk)
- `totalTheta`: Sum of all thetas (time decay)
- `totalVega`: Sum of all vegas (volatility risk)
- `totalRho`: Sum of all rhos (interest rate risk)
- `netGamma`: Call gamma - Put gamma
- `gammaExposure`: Market maker exposure estimate
- `pinRisk`: Concentration around specific strikes
- `gammaSqueezeRisk`: Potential for gamma squeeze
- `volatilityRisk`: "low", "medium", or "high"

**Use Cases**:
- Portfolio hedging
- Risk management
- Exposure monitoring
- Tail risk assessment

---

### 7.4 Implied Volatility Surface

**Description**: Analyze IV across strikes and expirations for volatility trading.

**Calculated Metrics**:
- `ivSurface`: Grid of IV by strike and expiration
- `atmIV`: At-the-money implied volatility
- `ivRank`: IV percentile (estimated)
- `termStructure`: "normal", "inverted", or "flat"
- `skew`: Put IV vs Call IV difference
- `skewDirection`: "put", "call", or "neutral"

**Analysis Features**:
- Moneyness calculation (strike/current price)
- Days to expiration
- IV term structure
- Volatility skew analysis

**Use Cases**:
- Volatility trading
- Option pricing
- Skew trading strategies
- Relative value analysis

---

### 7.5 Liquidity Scoring

**Description**: Custom liquidity score calculation for contract selection.

**Scoring Factors**:
- **Volume Score** (40% weight): Volume / 1000 (normalized to 0-1)
- **Open Interest Score** (40% weight): Open Interest / 5000 (normalized to 0-1)
- **Spread Score** (20% weight): 1 - (Spread % / 10) (inverse relationship)

**Score Range**: 0-10

**Quality Tiers**:
- **High Liquidity**: Score ≥ 7 (tight spreads, high volume)
- **Medium Liquidity**: Score 3-7 (moderate trading)
- **Low Liquidity**: Score < 3 (wide spreads, low volume)

**Use Cases**:
- Contract filtering
- Execution quality
- Slippage minimization
- Risk assessment

---

## Rate Limiting

**Limits**:
- Varies by subscription plan
- Monitor `X-RateLimit-*` headers in responses
- Implement exponential backoff on 429 errors

**Best Practices**:
1. Cache responses appropriately
2. Use bulk endpoints when available
3. Implement request queuing
4. Monitor API usage
5. Handle rate limit errors gracefully

---

## Error Handling

**HTTP Status Codes**:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid API token)
- `403`: Forbidden (plan limitation or marketplace access required)
- `404`: Not Found (invalid endpoint or symbol)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error
- `503`: Service Unavailable

**Error Response Format**:
```json
{
  "error": "Invalid API token",
  "message": "The provided API token is not valid"
}
```

**Handling Strategies**:
1. **401 Errors**: Verify API token
2. **403 Errors**: Check plan limits and marketplace subscriptions
3. **404 Errors**: Validate symbol/endpoint before retry
4. **429 Errors**: Implement exponential backoff (wait 1s, 2s, 4s, etc.)
5. **500 Errors**: Retry with exponential backoff (max 3 retries)

---

## TypeScript/JavaScript Examples

### Basic Quote Request

```typescript
const EODHD_API_KEY = '68cf08e135b402.52970225';
const BASE_URL = 'https://eodhd.com/api';

async function getRealTimeQuote(symbol: string) {
  const response = await fetch(
    `${BASE_URL}/real-time/${symbol}.US?api_token=${EODHD_API_KEY}&fmt=json`
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// Usage
const quote = await getRealTimeQuote('AAPL');
console.log(`${quote.code}: $${quote.close}`);
```

### UnicornBay Options Chain Request

```typescript
async function getUnicornBayOptionsChain(
  symbol: string,
  options?: {
    expiration?: string;
    strikeMin?: number;
    strikeMax?: number;
    type?: 'call' | 'put';
  }
) {
  // Build URL with proper encoding
  let url = `${BASE_URL}/mp/unicornbay/options/contracts?filter%5Bunderlying_symbol%5D=${symbol}`;

  if (options?.expiration) {
    url += `&filter%5Bexp_date%5D=${options.expiration}`;
  } else {
    // Filter for active contracts only
    const today = new Date().toISOString().split('T')[0];
    url += `&filter%5Bexp_date_from%5D=${today}`;
  }

  if (options?.strikeMin) {
    url += `&filter%5Bstrike_gte%5D=${options.strikeMin}`;
  }

  if (options?.strikeMax) {
    url += `&filter%5Bstrike_lte%5D=${options.strikeMax}`;
  }

  if (options?.type) {
    url += `&filter%5Btype%5D=${options.type.toUpperCase()}`;
  }

  url += `&page%5Blimit%5D=200&sort=exp_date&api_token=${EODHD_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  return data;
}

// Usage
const optionsChain = await getUnicornBayOptionsChain('AAPL', {
  strikeMin: 180,
  strikeMax: 200
});

console.log(`Retrieved ${optionsChain.data.length} contracts`);
```

### Put/Call Ratio Analysis

```typescript
async function calculatePutCallRatio(symbol: string) {
  const optionsData = await getUnicornBayOptionsChain(symbol);

  // Separate calls and puts
  const calls = optionsData.data.filter(
    (c: any) => c.attributes.type === 'Call'
  );
  const puts = optionsData.data.filter(
    (p: any) => p.attributes.type === 'Put'
  );

  // Calculate volume ratios
  const totalCallVolume = calls.reduce(
    (sum: number, c: any) => sum + (c.attributes.volume || 0),
    0
  );
  const totalPutVolume = puts.reduce(
    (sum: number, p: any) => sum + (p.attributes.volume || 0),
    0
  );

  const volumeRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;

  // Calculate OI ratios
  const totalCallOI = calls.reduce(
    (sum: number, c: any) => sum + (c.attributes.open_interest || 0),
    0
  );
  const totalPutOI = puts.reduce(
    (sum: number, p: any) => sum + (p.attributes.open_interest || 0),
    0
  );

  const oiRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

  return {
    symbol,
    volumeRatio,
    openInterestRatio: oiRatio,
    totalCallVolume,
    totalPutVolume,
    totalCallOpenInterest: totalCallOI,
    totalPutOpenInterest: totalPutOI,
    sentiment: volumeRatio > 1.2 ? 'bearish' : volumeRatio < 0.8 ? 'bullish' : 'neutral'
  };
}

// Usage
const ratio = await calculatePutCallRatio('AAPL');
console.log(`Put/Call Ratio: ${ratio.volumeRatio.toFixed(2)} (${ratio.sentiment})`);
```

### Greeks Analysis

```typescript
async function analyzeGreeks(symbol: string) {
  const optionsData = await getUnicornBayOptionsChain(symbol);

  const calls = optionsData.data.filter(
    (c: any) => c.attributes.type === 'Call'
  );
  const puts = optionsData.data.filter(
    (p: any) => p.attributes.type === 'Put'
  );

  // Calculate portfolio Greeks
  const totalDelta = [...calls, ...puts].reduce(
    (sum: number, contract: any) => {
      const attrs = contract.attributes;
      return sum + (attrs.delta || 0) * (attrs.volume || 0);
    },
    0
  );

  const totalGamma = [...calls, ...puts].reduce(
    (sum: number, contract: any) => {
      const attrs = contract.attributes;
      return sum + (attrs.gamma || 0) * (attrs.volume || 0);
    },
    0
  );

  const totalTheta = [...calls, ...puts].reduce(
    (sum: number, contract: any) => {
      const attrs = contract.attributes;
      return sum + (attrs.theta || 0) * (attrs.volume || 0);
    },
    0
  );

  const totalVega = [...calls, ...puts].reduce(
    (sum: number, contract: any) => {
      const attrs = contract.attributes;
      return sum + (attrs.vega || 0) * (attrs.volume || 0);
    },
    0
  );

  return {
    symbol,
    totalDelta,
    totalGamma,
    totalTheta,
    totalVega,
    interpretation: {
      directionalBias: totalDelta > 0 ? 'bullish' : totalDelta < 0 ? 'bearish' : 'neutral',
      volatilityExposure: Math.abs(totalVega),
      timeDecay: totalTheta
    }
  };
}

// Usage
const greeks = await analyzeGreeks('AAPL');
console.log(`Portfolio Delta: ${greeks.totalDelta.toFixed(2)}`);
console.log(`Directional Bias: ${greeks.interpretation.directionalBias}`);
```

### Historical Data with Date Range

```typescript
async function getHistoricalData(
  symbol: string,
  from: string,
  to: string
) {
  const url = `${BASE_URL}/eod/${symbol}.US?from=${from}&to=${to}&period=d&api_token=${EODHD_API_KEY}&fmt=json`;

  const response = await fetch(url);
  return await response.json();
}

// Usage: Get 2023 data
const historicalData = await getHistoricalData(
  'AAPL',
  '2023-01-01',
  '2023-12-31'
);
```

### Error Handling with Retry

```typescript
async function makeRequestWithRetry(
  url: string,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        // Rate limited - wait longer
        const waitTime = delayMs * Math.pow(2, i);
        console.log(`Rate limited. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const waitTime = delayMs * Math.pow(2, i);
      console.log(`Request failed. Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}
```

---

## Data Considerations

### UnicornBay Options Data

**Coverage**:
- 6,000+ top-traded US stocks
- Daily updates
- 1 year historical data
- 40+ fields per contract

**Data Quality**:
- Bid/ask spreads reflect market liquidity
- Greeks calculated using standard models
- Theoretical pricing based on Black-Scholes
- Liquidity scores for contract filtering

**Limitations**:
- Data may be delayed (check plan details)
- Low-volume contracts may have stale data
- Historical data limited to 1 year
- Some symbols may have incomplete chains

### Best Practices

1. **Caching Strategy**:
   - Cache real-time quotes for 1-5 minutes
   - Cache options chains for 5-15 minutes
   - Cache fundamentals for 24 hours
   - Cache historical data indefinitely

2. **Request Optimization**:
   - Use filters to reduce payload size
   - Request only needed date ranges
   - Filter by liquidity for trading
   - Batch similar requests

3. **Error Recovery**:
   - Implement exponential backoff
   - Log failed requests
   - Have fallback data sources
   - Cache last successful responses

4. **Data Validation**:
   - Check for null/undefined values
   - Verify data freshness (timestamps)
   - Validate Greeks ranges
   - Cross-reference with other sources

---

## Additional Resources

- **Official Documentation**: https://eodhd.com/financial-apis
- **UnicornBay Options**: https://eodhd.com/marketplace/unicornbay/options
- **API Status**: https://status.eodhd.com
- **Support Email**: support@eodhd.com
- **Dashboard**: https://eodhd.com/cp

---

## Security Notes

- Store API token in environment variables
- Never commit API tokens to version control
- Use HTTPS for all requests
- Implement request signing if available
- Rotate API tokens periodically
- Monitor API usage for anomalies
- Never expose API token in client-side code

---

## Plan Upgrade Considerations

If you need more features:
- **Higher rate limits**: Upgrade subscription tier
- **Real-time data**: Upgrade for live streaming
- **More historical data**: Enterprise plans offer extended history
- **Additional exchanges**: Global plans cover international markets
- **Custom solutions**: Contact sales for enterprise needs

---

**Last Updated**: October 7, 2025
**API Version**: Latest
**Marketplace Add-on**: UnicornBay Options Data
