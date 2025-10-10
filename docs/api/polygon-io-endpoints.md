# Polygon.io Stock Starter API - Endpoint Reference

**API Key**: `ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr`
**Plan**: Stock Starter ($29/month)
**Base URL**: `https://api.polygon.io`

## Plan Features

- All US Stocks Tickers
- Unlimited API Calls
- 5 Years Historical Data
- 100% Market Coverage
- 15-minute Delayed Data
- Unlimited File Downloads
- Reference Data
- Corporate Actions
- Technical Indicators
- Minute Aggregates
- WebSockets
- Snapshots
- Second Aggregates

## Authentication

All requests require authentication via API key. Include your API key as a query parameter:

```
?apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr
```

## Endpoints

### 1. Tickers & Reference Data

#### 1.1 Get All Tickers

**Endpoint**: `GET /v3/reference/tickers`

**Description**: Retrieve a comprehensive list of ticker symbols supported by Polygon.io.

**Query Parameters**:
- `ticker` (string, optional): Specify a ticker symbol
- `type` (string, optional): Filter by ticker type
- `market` (string, optional): Filter by market type
- `exchange` (string, optional): Filter by exchange MIC
- `active` (boolean, optional): Filter for actively traded tickers (default: true)
- `limit` (integer, optional): Limit results (default: 100, max: 1000)

**Example Request**:
```bash
curl "https://api.polygon.io/v3/reference/tickers?active=true&limit=100&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Use Cases**:
- Retrieve all stock tickers
- Filter tickers by specific market or exchange
- Search for tickers matching certain criteria

---

#### 1.2 Get Ticker Details

**Endpoint**: `GET /v3/reference/tickers/{ticker}`

**Description**: Retrieve comprehensive details for a single ticker.

**Path Parameters**:
- `ticker` (string, required): Case-sensitive ticker symbol (e.g., "AAPL")

**Query Parameters**:
- `date` (string, optional): Specify a point in time for historical ticker information (YYYY-MM-DD)

**Example Request**:
```bash
curl "https://api.polygon.io/v3/reference/tickers/AAPL?apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Response Includes**:
- Company details
- Market information
- Branding assets
- Fundamental attributes
- Identifiers (CIK, FIGI)

**Use Cases**:
- Company research
- Data integration
- Due diligence & compliance

---

### 2. Aggregate Bars (OHLC)

#### 2.1 Get Aggregate Bars

**Endpoint**: `GET /v2/aggs/ticker/{stocksTicker}/range/{multiplier}/{timespan}/{from}/{to}`

**Description**: Retrieve historical OHLC (Open, High, Low, Close) and volume data for stocks over a custom time range.

**Path Parameters**:
- `stocksTicker` (string, required): Case-sensitive ticker symbol (e.g., "AAPL")
- `multiplier` (integer, required): Size of timespan multiplier
- `timespan` (string, required): Time window size (minute, hour, day, week, month, quarter, year)
- `from` (string, required): Start date (YYYY-MM-DD) or timestamp
- `to` (string, required): End date (YYYY-MM-DD) or timestamp

**Query Parameters**:
- `adjusted` (boolean, optional): Adjust for splits (default: true)
- `sort` (string, optional): Sort results by timestamp (asc or desc)
- `limit` (integer, optional): Limit base aggregates (max: 50000, default: 5000)

**Example Request**:
```bash
curl "https://api.polygon.io/v2/aggs/ticker/AAPL/range/1/day/2023-01-01/2023-12-31?adjusted=true&sort=asc&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Use Cases**:
- Historical price analysis
- Backtesting trading strategies
- Chart data visualization

---

#### 2.2 Get Daily Open/Close

**Endpoint**: `GET /v1/open-close/{stocksTicker}/{date}`

**Description**: Retrieve the open, close, high, low prices and volume for a specific date.

**Path Parameters**:
- `stocksTicker` (string, required): Case-sensitive ticker symbol (e.g., "AAPL")
- `date` (string, required): Date in YYYY-MM-DD format

**Query Parameters**:
- `adjusted` (boolean, optional): Adjust for splits (default: true)

**Example Request**:
```bash
curl "https://api.polygon.io/v1/open-close/AAPL/2023-06-15?apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Response Attributes**:
- `open`: Opening price
- `close`: Closing price
- `high`: Highest price
- `low`: Lowest price
- `volume`: Trading volume
- `preMarket`: Pre-market opening price
- `afterHours`: After-hours closing price

**Use Cases**:
- Daily performance analysis
- Historical data collection
- After-hours insights
- Portfolio tracking

---

### 3. Snapshots

#### 3.1 Get All Tickers Snapshot

**Endpoint**: `GET /v2/snapshot/locale/us/markets/stocks/tickers`

**Description**: Retrieve a comprehensive snapshot of the U.S. stock market covering 10,000+ actively traded tickers.

**Query Parameters**:
- `tickers` (string, optional): Comma-separated list of stock tickers (e.g., "AAPL,TSLA,GOOG")
- `include_otc` (boolean, optional): Include OTC securities (default: false)

**Example Request**:
```bash
curl "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=AAPL,TSLA&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Key Features**:
- Snapshot data refreshed daily at 3:30 AM EST
- Provides pricing, volume, and trade activity
- Over 10,000+ actively traded tickers

**Use Cases**:
- Market overview
- Bulk data processing
- Heat maps/dashboards
- Automated market monitoring

---

#### 3.2 Get Top Gainers/Losers

**Endpoint**: `GET /v2/snapshot/locale/us/markets/stocks/{direction}`

**Description**: Retrieve snapshot data highlighting the top 20 gainers or losers in the U.S. stock market.

**Path Parameters**:
- `direction` (string, required): Direction of results (gainers or losers)

**Query Parameters**:
- `include_otc` (boolean, optional): Include OTC securities (default: false)

**Example Request**:
```bash
curl "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Key Details**:
- Only includes tickers with minimum trading volume of 10,000
- Snapshot data cleared daily at 3:30 AM EST
- Repopulates around 4:00 AM EST

**Use Cases**:
- Market movers identification
- Trading strategies
- Market sentiment analysis
- Portfolio adjustments

---

### 4. Trades & Quotes

#### 4.1 Get Last Trade

**Endpoint**: `GET /v2/last/trade/{stocksTicker}`

**Description**: Retrieve the latest available trade for a specified stock ticker.

**Path Parameters**:
- `stocksTicker` (string, required): Case-sensitive ticker symbol (e.g., "AAPL")

**Example Request**:
```bash
curl "https://api.polygon.io/v2/last/trade/AAPL?apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Response Attributes**:
- `p`: Trade price
- `s`: Trade size
- `t`: SIP timestamp
- `x`: Exchange ID
- `i`: Unique Trade ID

**Use Cases**:
- Trade monitoring
- Price updates
- Market snapshot

**Note**: Data availability varies by plan (15-minute delayed to real-time)

---

#### 4.2 Get Quotes (NBBO)

**Endpoint**: `GET /v3/quotes/{stockTicker}`

**Description**: Retrieve National Best Bid and Offer (NBBO) quotes for a specified stock ticker.

**Path Parameters**:
- `stockTicker` (string, required): Case-sensitive ticker symbol (e.g., "AAPL")

**Query Parameters**:
- `timestamp` (string, optional): Date (YYYY-MM-DD) or nanosecond timestamp
- `order` (string, optional): Sort order
- `limit` (integer, optional): Number of results (default: 1000, max: 50000)
- `sort` (string, optional): Sorting field

**Example Request**:
```bash
curl "https://api.polygon.io/v3/quotes/AAPL?timestamp=2023-06-15&limit=100&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Use Cases**:
- Historical quote analysis
- Liquidity evaluation
- Algorithmic backtesting
- Trading strategy refinement

---

### 5. Corporate Actions

#### 5.1 Get Stock Splits

**Endpoint**: `GET /v3/reference/splits`

**Description**: Retrieve historical stock split events with execution dates and ratio factors.

**Query Parameters**:
- `ticker` (string, optional): Case-sensitive stock symbol (e.g., AAPL)
- `execution_date` (string, optional): Date of split in YYYY-MM-DD format
- `reverse_split` (boolean, optional): Filter reverse splits
- `order` (string, optional): Sort order
- `limit` (integer, optional): Number of results (default: 10, max: 1000)
- `sort` (string, optional): Field to sort results

**Example Request**:
```bash
curl "https://api.polygon.io/v3/reference/splits?ticker=AAPL&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Response Attributes**:
- `execution_date`: Date of stock split
- `id`: Unique split identifier
- `split_from`: Second number in split ratio
- `split_to`: First number in split ratio
- `ticker`: Stock symbol

**Use Cases**:
- Historical analysis
- Price adjustments
- Data consistency
- Financial modeling

---

#### 5.2 Get Dividends

**Endpoint**: `GET /v3/reference/dividends`

**Description**: Retrieve historical cash dividend distributions for a given ticker.

**Query Parameters**:
- `ticker` (string, required): Stock ticker symbol
- `ex_dividend_date` (string, optional): Filter by ex-dividend date (YYYY-MM-DD)
- `record_date` (string, optional): Filter by record date (YYYY-MM-DD)
- `declaration_date` (string, optional): Filter by declaration date (YYYY-MM-DD)
- `pay_date` (string, optional): Filter by pay date (YYYY-MM-DD)
- `frequency` (integer, optional): Dividend payment frequency (0, 1, 2, 4, 12, 24, 52)
- `cash_amount` (number, optional): Dividend cash amount
- `dividend_type` (string, optional): Dividend type (CD, SC, LT, ST)

**Example Request**:
```bash
curl "https://api.polygon.io/v3/reference/dividends?ticker=AAPL&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Response Includes**:
- Declaration date
- Ex-dividend date
- Record date
- Pay date
- Payout amounts
- Frequency

**Use Cases**:
- Income analysis
- Total return calculations
- Dividend strategies
- Tax planning

---

### 6. Technical Indicators

#### 6.1 Simple Moving Average (SMA)

**Endpoint**: `GET /v1/indicators/sma/{stockTicker}`

**Description**: Retrieve the Simple Moving Average (SMA) for a specified ticker.

**Path Parameters**:
- `stockTicker` (string, required): Case-sensitive ticker symbol (e.g., "AAPL")

**Query Parameters**:
- `timespan` (string, optional): Size of aggregate time window (minute, hour, day, week, month, quarter, year)
- `window` (integer, optional): Window size for SMA calculation
- `series_type` (string, optional): Price type used to calculate SMA (close, open, high, low)
- `adjusted` (boolean, optional): Adjust for splits
- `limit` (integer, optional): Number of results (default: 10, max: 5000)

**Example Request**:
```bash
curl "https://api.polygon.io/v1/indicators/sma/AAPL?timespan=day&window=50&series_type=close&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Use Cases**:
- Trend analysis
- Trading signal generation
- Support/resistance levels
- Entry/exit timing

---

#### 6.2 Exponential Moving Average (EMA)

**Endpoint**: `GET /v1/indicators/ema/{stockTicker}`

**Description**: Retrieve the Exponential Moving Average (EMA) for a specified ticker.

**Path Parameters**:
- `stockTicker` (string, required): Case-sensitive ticker symbol

**Query Parameters**: (Same as SMA)

**Example Request**:
```bash
curl "https://api.polygon.io/v1/indicators/ema/AAPL?timespan=day&window=20&series_type=close&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

---

#### 6.3 Moving Average Convergence Divergence (MACD)

**Endpoint**: `GET /v1/indicators/macd/{stockTicker}`

**Description**: Retrieve the MACD indicator for a specified ticker.

**Path Parameters**:
- `stockTicker` (string, required): Case-sensitive ticker symbol

**Query Parameters**:
- `timespan` (string, optional): Size of aggregate time window
- `short_window` (integer, optional): Short EMA window (default: 12)
- `long_window` (integer, optional): Long EMA window (default: 26)
- `signal_window` (integer, optional): Signal line window (default: 9)
- `series_type` (string, optional): Price type
- `adjusted` (boolean, optional): Adjust for splits
- `limit` (integer, optional): Number of results

**Example Request**:
```bash
curl "https://api.polygon.io/v1/indicators/macd/AAPL?timespan=day&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

---

#### 6.4 Relative Strength Index (RSI)

**Endpoint**: `GET /v1/indicators/rsi/{stockTicker}`

**Description**: Retrieve the RSI indicator for a specified ticker.

**Path Parameters**:
- `stockTicker` (string, required): Case-sensitive ticker symbol

**Query Parameters**:
- `timespan` (string, optional): Size of aggregate time window
- `window` (integer, optional): RSI window size (default: 14)
- `series_type` (string, optional): Price type
- `adjusted` (boolean, optional): Adjust for splits
- `limit` (integer, optional): Number of results

**Example Request**:
```bash
curl "https://api.polygon.io/v1/indicators/rsi/AAPL?timespan=day&window=14&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

---

### 7. News

#### 7.1 Get Ticker News

**Endpoint**: `GET /v2/reference/news`

**Description**: Retrieve the most recent news articles related to a specified ticker.

**Query Parameters**:
- `ticker` (string, optional): Case-sensitive ticker symbol
- `published_utc` (string, optional): Filter by publication date
- `order` (string, optional): Order results (asc or desc)
- `limit` (integer, optional): Limit results (default: 10, max: 1000)
- `sort` (string, optional): Sort field

**Example Request**:
```bash
curl "https://api.polygon.io/v2/reference/news?ticker=AAPL&limit=10&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

**Response Attributes**:
- `count`: Total number of results
- `next_url`: URL for next page
- `results`: Array of news articles with:
  - `title`
  - `article_url`
  - `published_utc`
  - `tickers`
  - `publisher` information
  - `description`
  - `insights`

**Use Cases**:
- Market sentiment analysis
- Investment research
- Automated monitoring
- Portfolio strategy refinement

---

### 8. Market Information

#### 8.1 Get Market Status

**Endpoint**: `GET /v1/marketstatus/now`

**Description**: Retrieve the current trading status of the markets.

**Example Request**:
```bash
curl "https://api.polygon.io/v1/marketstatus/now?apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

---

#### 8.2 Get Market Holidays

**Endpoint**: `GET /v1/marketstatus/upcoming`

**Description**: Retrieve upcoming market holidays and closures.

**Example Request**:
```bash
curl "https://api.polygon.io/v1/marketstatus/upcoming?apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

---

#### 8.3 Get Exchanges

**Endpoint**: `GET /v3/reference/exchanges`

**Description**: Retrieve a list of stock exchanges supported by Polygon.io.

**Example Request**:
```bash
curl "https://api.polygon.io/v3/reference/exchanges?asset_class=stocks&apiKey=ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"
```

---

## Data Considerations

### Plan Limitations

- **Data Delay**: 15-minute delayed data
- **Historical Data**: 5 years of historical data
- **API Calls**: Unlimited
- **Coverage**: 100% U.S. market coverage

### Best Practices

1. **Rate Limiting**: While unlimited, implement reasonable rate limiting to avoid overwhelming the API
2. **Caching**: Cache frequently accessed data to improve performance
3. **Error Handling**: Implement robust error handling for network issues and API errors
4. **Pagination**: Use pagination parameters (limit, offset) for large datasets
5. **Date Formats**: Always use ISO 8601 format (YYYY-MM-DD) for dates

### Common Response Codes

- `200`: Success
- `401`: Unauthorized (invalid API key)
- `403`: Forbidden (plan limitations)
- `404`: Not Found (invalid ticker or endpoint)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

---

## TypeScript/JavaScript Examples

### Basic Request Example

```typescript
const POLYGON_API_KEY = 'ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr';
const BASE_URL = 'https://api.polygon.io';

async function getTickerDetails(ticker: string) {
  const response = await fetch(
    `${BASE_URL}/v3/reference/tickers/${ticker}?apiKey=${POLYGON_API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

// Usage
const appleDetails = await getTickerDetails('AAPL');
console.log(appleDetails);
```

### Aggregate Bars Example

```typescript
async function getAggregates(
  ticker: string,
  from: string,
  to: string,
  timespan: string = 'day',
  multiplier: number = 1
) {
  const url = new URL(
    `${BASE_URL}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}`
  );

  url.searchParams.append('adjusted', 'true');
  url.searchParams.append('sort', 'asc');
  url.searchParams.append('apiKey', POLYGON_API_KEY);

  const response = await fetch(url.toString());
  const data = await response.json();

  return data.results;
}

// Usage: Get daily AAPL data for 2023
const dailyData = await getAggregates('AAPL', '2023-01-01', '2023-12-31');
```

### News Feed Example

```typescript
async function getTickerNews(ticker: string, limit: number = 10) {
  const url = new URL(`${BASE_URL}/v2/reference/news`);

  url.searchParams.append('ticker', ticker);
  url.searchParams.append('limit', limit.toString());
  url.searchParams.append('apiKey', POLYGON_API_KEY);

  const response = await fetch(url.toString());
  const data = await response.json();

  return data.results;
}

// Usage
const news = await getTickerNews('AAPL', 5);
```

---

## Additional Resources

- **Official Documentation**: https://polygon.io/docs/stocks
- **API Status**: https://status.polygon.io
- **Support**: support@polygon.io
- **Dashboard**: https://polygon.io/dashboard

---

## Notes

- This API key is for the Stock Starter plan with 15-minute delayed data
- All endpoints support JSON responses
- Case-sensitive ticker symbols (use uppercase: "AAPL" not "aapl")
- Store API key securely and use environment variables in production
- Consider upgrading plan for real-time data or additional features

---

**Last Updated**: October 7, 2025
**API Version**: v3 (primary), v2 (legacy), v1 (indicators)
