# Financial Modeling Prep (FMP) API - Starter Plan Reference

**API Key**: `AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM`
**Plan**: Starter ($22/month, billed annually)
**Base URL**: `https://financialmodelingprep.com/api/v3`
**V4 Base URL**: `https://financialmodelingprep.com/api/v4`

## Plan Features

- **300 API Calls per Minute**
- **Up to 5 Years of Historical Data**
- **US Market Coverage**
- **Annual Fundamentals and Ratios**
- **Historical Stock Price Data**
- **Profile and Reference Data**
- **Financial Market News**
- **Crypto and Forex Data**
- **Real-time Data** (15-minute delayed)

## Authentication

All requests require authentication via API key. Include your API key as a query parameter:

```
?apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM
```

## Endpoints

### 1. Stock Quotes & Real-Time Data

#### 1.1 Get Stock Quote

**Endpoint**: `GET /v3/quote/{symbol}`

**Description**: Retrieve real-time stock quote including price, volume, and daily changes.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol (e.g., "AAPL")

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/quote/AAPL?apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `symbol`: Ticker symbol
- `price`: Current price
- `changesPercentage`: Percentage change
- `change`: Dollar change
- `dayLow`: Day's low price
- `dayHigh`: Day's high price
- `yearHigh`: 52-week high
- `yearLow`: 52-week low
- `marketCap`: Market capitalization
- `priceAvg50`: 50-day moving average
- `priceAvg200`: 200-day moving average
- `volume`: Trading volume
- `avgVolume`: Average volume
- `open`: Opening price
- `previousClose`: Previous close price
- `eps`: Earnings per share
- `pe`: Price-to-earnings ratio
- `earningsAnnouncement`: Next earnings date
- `sharesOutstanding`: Shares outstanding
- `timestamp`: Quote timestamp

**Use Cases**:
- Real-time price monitoring
- Portfolio valuation
- Trading alerts
- Market analysis

---

#### 1.2 Get Batch Stock Quotes

**Endpoint**: `GET /v3/quote/{symbols}`

**Description**: Retrieve quotes for multiple stocks in a single request.

**Path Parameters**:
- `symbols` (string, required): Comma-separated list of ticker symbols (e.g., "AAPL,MSFT,GOOGL")

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/quote/AAPL,MSFT,GOOGL?apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Use Cases**:
- Portfolio tracking
- Watchlist monitoring
- Bulk price updates

---

### 2. Company Information

#### 2.1 Get Company Profile

**Endpoint**: `GET /v3/profile/{symbol}`

**Description**: Retrieve comprehensive company information including description, sector, industry, CEO, and more.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `symbol`: Ticker symbol
- `companyName`: Company name
- `price`: Current price
- `currency`: Trading currency
- `exchange`: Exchange (e.g., NASDAQ)
- `exchangeShortName`: Exchange abbreviation
- `industry`: Industry classification
- `sector`: Sector classification
- `country`: Country of incorporation
- `website`: Company website
- `description`: Company description
- `ceo`: Chief Executive Officer name
- `fullTimeEmployees`: Number of employees
- `phone`: Company phone number
- `address`: Headquarters address
- `city`, `state`, `zip`: Location details
- `ipoDate`: Initial public offering date
- `image`: Company logo URL
- `isEtf`: Whether the symbol is an ETF
- `isActivelyTrading`: Trading status

**Use Cases**:
- Company research
- Due diligence
- Profile building
- Company comparisons

---

### 3. Historical Price Data

#### 3.1 Get Historical Daily Prices

**Endpoint**: `GET /v3/historical-price-full/{symbol}`

**Description**: Retrieve historical daily OHLCV (Open, High, Low, Close, Volume) data.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)
- `serietype` (string, optional): Series type (default: "line")
- `timeseries` (integer, optional): Number of data points to return (default: all)

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/historical-price-full/AAPL?from=2023-01-01&to=2023-12-31&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Structure**:
```json
{
  "symbol": "AAPL",
  "historical": [
    {
      "date": "2023-12-29",
      "open": 193.90,
      "high": 194.40,
      "low": 191.73,
      "close": 192.53,
      "adjClose": 192.53,
      "volume": 42628200,
      "unadjustedVolume": 42628200,
      "change": -1.37,
      "changePercent": -0.706,
      "vwap": 192.99,
      "label": "December 29, 23",
      "changeOverTime": -0.00706
    }
  ]
}
```

**Use Cases**:
- Historical analysis
- Backtesting strategies
- Chart generation
- Performance tracking

---

#### 3.2 Get Historical Chart (with Limit)

**Endpoint**: `GET /v3/historical-chart/{timeframe}/{symbol}`

**Description**: Retrieve historical price data at various timeframes (1min, 5min, 15min, 30min, 1hour, 4hour).

**Path Parameters**:
- `timeframe` (string, required): Time interval (1min, 5min, 15min, 30min, 1hour, 4hour)
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/historical-chart/5min/AAPL?apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Use Cases**:
- Intraday trading
- Short-term analysis
- Tick data analysis

---

### 4. Financial Statements

#### 4.1 Get Income Statement

**Endpoint**: `GET /v3/income-statement/{symbol}`

**Description**: Retrieve income statements for a company.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `period` (string, optional): "annual" or "quarter" (default: annual)
- `limit` (integer, optional): Number of periods to return (default: 40)
- `datatype` (string, optional): "csv" for CSV format

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/income-statement/AAPL?period=annual&limit=5&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Key Metrics Returned**:
- `date`: Statement date
- `symbol`: Ticker symbol
- `reportedCurrency`: Reporting currency
- `revenue`: Total revenue
- `costOfRevenue`: Cost of goods sold
- `grossProfit`: Gross profit
- `grossProfitRatio`: Gross profit margin
- `researchAndDevelopmentExpenses`: R&D expenses
- `sellingGeneralAndAdministrativeExpenses`: SG&A expenses
- `operatingIncome`: Operating income
- `operatingIncomeRatio`: Operating margin
- `netIncome`: Net income
- `netIncomeRatio`: Net profit margin
- `eps`: Earnings per share
- `epsdiluted`: Diluted EPS

**Use Cases**:
- Profitability analysis
- Trend analysis
- Margin analysis
- Earnings quality assessment

---

#### 4.2 Get Balance Sheet

**Endpoint**: `GET /v3/balance-sheet-statement/{symbol}`

**Description**: Retrieve balance sheet statements for a company.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `period` (string, optional): "annual" or "quarter"
- `limit` (integer, optional): Number of periods to return

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/balance-sheet-statement/AAPL?period=annual&limit=5&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Key Metrics Returned**:
- `totalAssets`: Total assets
- `totalCurrentAssets`: Current assets
- `totalNonCurrentAssets`: Non-current assets
- `totalLiabilities`: Total liabilities
- `totalCurrentLiabilities`: Current liabilities
- `totalNonCurrentLiabilities`: Non-current liabilities
- `totalStockholdersEquity`: Shareholders' equity
- `cashAndCashEquivalents`: Cash
- `shortTermInvestments`: Short-term investments
- `netReceivables`: Accounts receivable
- `inventory`: Inventory
- `totalDebt`: Total debt
- `shortTermDebt`: Short-term debt
- `longTermDebt`: Long-term debt

**Use Cases**:
- Liquidity analysis
- Solvency analysis
- Asset quality assessment
- Capital structure analysis

---

#### 4.3 Get Cash Flow Statement

**Endpoint**: `GET /v3/cash-flow-statement/{symbol}`

**Description**: Retrieve cash flow statements for a company.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `period` (string, optional): "annual" or "quarter"
- `limit` (integer, optional): Number of periods to return

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/cash-flow-statement/AAPL?period=annual&limit=5&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Key Metrics Returned**:
- `netIncome`: Net income
- `operatingCashFlow`: Cash from operations
- `capitalExpenditure`: CapEx
- `freeCashFlow`: Free cash flow
- `dividendsPaid`: Dividends paid
- `stockBasedCompensation`: Stock-based compensation
- `changeInWorkingCapital`: Working capital changes
- `cashAtBeginningOfPeriod`: Beginning cash
- `cashAtEndOfPeriod`: Ending cash

**Use Cases**:
- Cash generation analysis
- Investment analysis
- Dividend sustainability
- Financial health assessment

---

### 5. Financial Ratios & Metrics

#### 5.1 Get Key Metrics

**Endpoint**: `GET /v3/key-metrics/{symbol}`

**Description**: Retrieve key financial metrics and ratios.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `period` (string, optional): "annual" or "quarter"
- `limit` (integer, optional): Number of periods

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/key-metrics/AAPL?limit=1&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Key Metrics Returned**:
- `revenuePerShare`: Revenue per share
- `netIncomePerShare`: Net income per share
- `operatingCashFlowPerShare`: OCF per share
- `freeCashFlowPerShare`: FCF per share
- `cashPerShare`: Cash per share
- `bookValuePerShare`: Book value per share
- `tangibleBookValuePerShare`: Tangible book value per share
- `shareholdersEquityPerShare`: Equity per share
- `interestDebtPerShare`: Debt per share
- `marketCap`: Market capitalization
- `enterpriseValue`: Enterprise value
- `peRatio`: Price-to-earnings ratio
- `priceToSalesRatio`: Price-to-sales ratio
- `pocfratio`: Price-to-operating cash flow
- `pfcfRatio`: Price-to-free cash flow
- `pbRatio`: Price-to-book ratio
- `ptbRatio`: Price-to-tangible book
- `evToSales`: EV/Sales
- `enterpriseValueOverEBITDA`: EV/EBITDA
- `evToOperatingCashFlow`: EV/OCF
- `evToFreeCashFlow`: EV/FCF
- `earningsYield`: Earnings yield
- `freeCashFlowYield`: FCF yield
- `debtToEquity`: Debt-to-equity ratio
- `debtToAssets`: Debt-to-assets ratio
- `netDebtToEBITDA`: Net debt/EBITDA
- `currentRatio`: Current ratio
- `quickRatio`: Quick ratio
- `cashRatio`: Cash ratio
- `daysOfSalesOutstanding`: DSO
- `daysOfInventoryOutstanding`: DIO
- `operatingCycle`: Operating cycle
- `daysOfPayablesOutstanding`: DPO
- `cashConversionCycle`: Cash conversion cycle
- `grossProfitMargin`: Gross margin
- `operatingProfitMargin`: Operating margin
- `pretaxProfitMargin`: Pretax margin
- `netProfitMargin`: Net margin
- `effectiveTaxRate`: Tax rate
- `returnOnAssets`: ROA
- `returnOnEquity`: ROE
- `returnOnCapitalEmployed`: ROCE
- `dividendYield`: Dividend yield
- `payoutRatio`: Payout ratio

**Use Cases**:
- Valuation analysis
- Peer comparison
- Investment screening
- Performance evaluation

---

#### 5.2 Get Financial Ratios

**Endpoint**: `GET /v3/ratios/{symbol}`

**Description**: Retrieve comprehensive financial ratios.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `period` (string, optional): "annual" or "quarter"
- `limit` (integer, optional): Number of periods

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/ratios/AAPL?limit=1&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Use Cases**:
- Financial health assessment
- Comparative analysis
- Trend analysis
- Risk assessment

---

### 6. Analyst Ratings & Price Targets

#### 6.1 Get Analyst Price Target Consensus

**Endpoint**: `GET /v3/price-target-consensus`

**Description**: Retrieve analyst price target consensus for a stock.

**Query Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/price-target-consensus?symbol=AAPL&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `symbol`: Ticker symbol
- `targetHigh`: Highest price target
- `targetLow`: Lowest price target
- `targetConsensus`: Consensus target
- `targetMedian`: Median target

**Use Cases**:
- Analyst sentiment
- Upside/downside potential
- Investment decisions
- Valuation benchmarks

---

#### 6.2 Get Upgrades and Downgrades

**Endpoint**: `GET /v4/upgrades-downgrades-consensus`

**Description**: Retrieve recent analyst rating changes and upgrades/downgrades.

**Query Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v4/upgrades-downgrades-consensus?symbol=AAPL&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `symbol`: Ticker symbol
- `consensusRating`: Consensus rating (Buy, Hold, Sell)
- `strongBuy`: Number of Strong Buy ratings
- `buy`: Number of Buy ratings
- `hold`: Number of Hold ratings
- `sell`: Number of Sell ratings
- `strongSell`: Number of Strong Sell ratings

**Use Cases**:
- Rating change monitoring
- Sentiment tracking
- Market expectations
- Investment decisions

---

#### 6.3 Get Analyst Rating (v3)

**Endpoint**: `GET /v3/rating/{symbol}`

**Description**: Get analyst ratings and recommendations.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/rating/AAPL?apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

---

#### 6.4 Get Price Target Latest News

**Endpoint**: `GET /v3/price-target-latest-news`

**Description**: Get latest analyst price target changes with news.

**Query Parameters**:
- `_symbol_` (string, required): Stock ticker symbol
- `_limit_` (integer, optional): Number of results (default: 10)

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/price-target-latest-news?_symbol_=AAPL&_limit_=10&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

---

### 7. Corporate Actions

#### 7.1 Get Dividend History

**Endpoint**: `GET /v3/historical-price-full/stock_dividend/{symbol}`

**Description**: Retrieve historical dividend payments.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/AAPL?apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `date`: Ex-dividend date
- `label`: Date label
- `adjDividend`: Adjusted dividend
- `dividend`: Dividend amount
- `recordDate`: Record date
- `paymentDate`: Payment date
- `declarationDate`: Declaration date

**Use Cases**:
- Dividend yield calculation
- Income investing
- Payout ratio analysis
- Dividend growth tracking

---

#### 7.2 Get Stock Splits

**Endpoint**: `GET /v3/historical-price-full/stock_split/{symbol}`

**Description**: Retrieve historical stock split events.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/historical-price-full/stock_split/AAPL?apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `date`: Split date
- `label`: Date label
- `numerator`: Split ratio numerator
- `denominator`: Split ratio denominator

**Use Cases**:
- Price adjustment
- Historical data normalization
- Corporate action tracking

---

#### 7.3 Get Earnings Surprises

**Endpoint**: `GET /v3/income-statement/{symbol}`

**Description**: Retrieve earnings surprises and beats/misses.

**Path Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Query Parameters**:
- `period` (string): "quarter"
- `limit` (integer, optional): Number of quarters

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/income-statement/AAPL?period=quarter&limit=8&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Use Cases**:
- Earnings quality
- Analyst accuracy
- Market reaction analysis

---

### 8. Insider Trading & Institutional Holdings

#### 8.1 Get Institutional Ownership

**Endpoint**: `GET /v4/institutional-ownership/symbol-ownership`

**Description**: Retrieve institutional ownership data from 13F filings.

**Query Parameters**:
- `symbol` (string, required): Stock ticker symbol
- `limit` (integer, optional): Number of results (default: 100)

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v4/institutional-ownership/symbol-ownership?symbol=AAPL&limit=100&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `symbol`: Ticker symbol
- `cik`: Central Index Key (CIK) of institution
- `dateReported`: Reporting date
- `investorName`: Institution name
- `shares`: Number of shares held
- `change`: Change in shares
- `changePercent`: Percentage change
- `marketValue`: Market value of holding
- `avgPrice`: Average purchase price
- `putCallShare`: Put/call ratio

**Use Cases**:
- Institutional sentiment
- Smart money tracking
- Ownership concentration
- Investment trends

---

#### 8.2 Get Insider Trading

**Endpoint**: `GET /v4/insider-trading`

**Description**: Retrieve insider trading transactions (Form 4 filings).

**Query Parameters**:
- `symbol` (string, required): Stock ticker symbol
- `limit` (integer, optional): Number of results (default: 100)

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v4/insider-trading?symbol=AAPL&limit=100&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `symbol`: Ticker symbol
- `filingDate`: Filing date
- `transactionDate`: Transaction date
- `reportingCik`: Reporting person's CIK
- `reportingName`: Insider name
- `typeOfOwner`: Owner type (Director, Officer, 10% Owner, etc.)
- `transactionType`: Transaction type (P-Purchase, S-Sale, A-Award, etc.)
- `securitiesOwned`: Total securities owned after transaction
- `securitiesTransacted`: Number of securities transacted
- `price`: Transaction price
- `securityName`: Security name

**Use Cases**:
- Insider sentiment
- Early warning signals
- Executive compensation analysis
- Ownership tracking

---

#### 8.3 Get 13F Filing Dates

**Endpoint**: `GET /v4/form-thirteen-date`

**Description**: Retrieve dates when institutional investors filed 13F forms.

**Query Parameters**:
- `symbol` (string, required): Stock ticker symbol
- `limit` (integer, optional): Number of results

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v4/form-thirteen-date?symbol=AAPL&limit=20&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

---

### 9. Stock Screener

#### 9.1 Stock Screener

**Endpoint**: `GET /v3/stock-screener`

**Description**: Screen stocks based on various criteria.

**Query Parameters**:
- `sector` (string, optional): Filter by sector
- `industry` (string, optional): Filter by industry
- `marketCapMoreThan` (number, optional): Minimum market cap
- `marketCapLowerThan` (number, optional): Maximum market cap
- `priceMoreThan` (number, optional): Minimum price
- `priceLowerThan` (number, optional): Maximum price
- `betaMoreThan` (number, optional): Minimum beta
- `betaLowerThan` (number, optional): Maximum beta
- `volumeMoreThan` (number, optional): Minimum volume
- `volumeLowerThan` (number, optional): Maximum volume
- `dividendMoreThan` (number, optional): Minimum dividend yield
- `dividendLowerThan` (number, optional): Maximum dividend yield
- `limit` (integer, optional): Number of results (default: 100)

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/stock-screener?sector=Technology&marketCapMoreThan=10000000000&limit=20&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Use Cases**:
- Stock discovery
- Investment screening
- Sector analysis
- Portfolio construction

---

### 10. News & Sentiment

#### 10.1 Get Stock News

**Endpoint**: `GET /v3/stock_news`

**Description**: Retrieve recent news articles for specific stocks.

**Query Parameters**:
- `tickers` (string, required): Ticker symbol
- `limit` (integer, optional): Number of articles (default: 50)
- `page` (integer, optional): Page number for pagination

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/stock_news?tickers=AAPL&limit=10&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `symbol`: Ticker symbol
- `publishedDate`: Publication date
- `title`: Article title
- `image`: Article image URL
- `site`: News source
- `text`: Article summary
- `url`: Article URL

**Use Cases**:
- News monitoring
- Sentiment analysis
- Event detection
- Investment research

---

#### 10.2 Get Social Sentiment (v4)

**Endpoint**: `GET /v4/historical/social-sentiment`

**Description**: Retrieve historical social sentiment data from various platforms.

**Query Parameters**:
- `symbol` (string, required): Stock ticker symbol
- `page` (integer, optional): Page number for pagination

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v4/historical/social-sentiment?symbol=AAPL&page=0&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `date`: Sentiment date
- `symbol`: Ticker symbol
- `stocktwitsSentiment`: StockTwits sentiment score
- `stocktwitsComments`: Number of StockTwits comments
- `twitterSentiment`: Twitter sentiment score
- `twitterComments`: Number of tweets
- `totalSentiment`: Aggregate sentiment score

**Use Cases**:
- Social media sentiment tracking
- Alternative data analysis
- Retail investor sentiment
- Market mood indicators

---

### 11. Economic Data

#### 11.1 Get Economic Calendar

**Endpoint**: `GET /v3/economic_calendar`

**Description**: Retrieve upcoming economic events and indicators.

**Query Parameters**:
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/economic_calendar?from=2024-01-01&to=2024-01-31&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `event`: Event name
- `date`: Event date
- `country`: Country
- `actual`: Actual value
- `previous`: Previous value
- `estimate`: Estimated value
- `change`: Change from previous
- `changePercentage`: Percentage change
- `impact`: Impact level (Low, Medium, High)

**Use Cases**:
- Economic event tracking
- Macro analysis
- Market timing
- Risk management

---

#### 11.2 Get Treasury Rates

**Endpoint**: `GET /v4/treasury`

**Description**: Retrieve U.S. Treasury yield rates.

**Query Parameters**:
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v4/treasury?from=2024-01-01&to=2024-01-31&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `date`: Date
- `month1`: 1-month rate
- `month2`: 2-month rate
- `month3`: 3-month rate
- `month6`: 6-month rate
- `year1`: 1-year rate
- `year2`: 2-year rate
- `year3`: 3-year rate
- `year5`: 5-year rate
- `year7`: 7-year rate
- `year10`: 10-year rate
- `year20`: 20-year rate
- `year30`: 30-year rate

**Use Cases**:
- Yield curve analysis
- Interest rate tracking
- Economic forecasting
- Risk-free rate benchmarking

---

### 12. ESG Data

#### 12.1 Get ESG Score

**Endpoint**: `GET /v3/esg-score`

**Description**: Retrieve Environmental, Social, and Governance (ESG) ratings.

**Query Parameters**:
- `symbol` (string, required): Stock ticker symbol

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/esg-score?symbol=AAPL&apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

**Response Attributes**:
- `symbol`: Ticker symbol
- `companyName`: Company name
- `ESGScore`: Overall ESG score
- `environmentalScore`: Environmental pillar score
- `socialScore`: Social pillar score
- `governanceScore`: Governance pillar score

**Use Cases**:
- Sustainable investing
- ESG screening
- Corporate responsibility assessment
- Risk evaluation

---

### 13. Cryptocurrency & Forex

#### 13.1 Get Crypto Quote

**Endpoint**: `GET /v3/quote/{crypto_symbol}`

**Description**: Retrieve cryptocurrency prices and data.

**Path Parameters**:
- `crypto_symbol` (string, required): Crypto symbol (e.g., "BTCUSD")

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/quote/BTCUSD?apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

---

#### 13.2 Get Forex Quote

**Endpoint**: `GET /v3/quote/{forex_pair}`

**Description**: Retrieve foreign exchange rates.

**Path Parameters**:
- `forex_pair` (string, required): Currency pair (e.g., "EURUSD")

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/quote/EURUSD?apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

---

#### 13.3 Get Historical Forex

**Endpoint**: `GET /v3/historical-price-full/{forex_pair}`

**Description**: Retrieve historical forex data.

**Path Parameters**:
- `forex_pair` (string, required): Currency pair

**Example Request**:
```bash
curl "https://financialmodelingprep.com/api/v3/historical-price-full/EURUSD?apikey=AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM"
```

---

## Rate Limiting

**Limits**:
- 300 requests per minute
- Burst limit: ~50 requests per 10 seconds
- Recommended: Implement exponential backoff on 429 errors

**Rate Limit Headers** (if provided):
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the limit resets

**Best Practices**:
1. Cache responses when possible
2. Batch requests for multiple symbols
3. Implement request queuing
4. Monitor rate limit headers
5. Use webhooks for real-time data when available

---

## Error Handling

**Common HTTP Status Codes**:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid API key)
- `403`: Forbidden (plan limitation)
- `404`: Not Found (invalid endpoint or symbol)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error
- `503`: Service Unavailable

**Error Response Format**:
```json
{
  "Error Message": "Invalid API key"
}
```

**Handling Strategies**:
1. **429 Errors**: Implement exponential backoff (wait 1s, 2s, 4s, etc.)
2. **400 Errors**: Validate input parameters before making requests
3. **500 Errors**: Retry with exponential backoff (max 3 retries)
4. **Symbol Not Found**: Cache invalid symbols to avoid repeated requests

---

## TypeScript/JavaScript Examples

### Basic Request Example

```typescript
const FMP_API_KEY = 'AMqd7YZjJwNJb2SoZIvuhQT1SJs7BrtM';
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

async function getStockQuote(symbol: string) {
  const response = await fetch(
    `${BASE_URL}/quote/${symbol}?apikey=${FMP_API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data[0]; // FMP returns array with single quote
}

// Usage
const quote = await getStockQuote('AAPL');
console.log(`${quote.symbol}: $${quote.price}`);
```

### Historical Data Example

```typescript
async function getHistoricalData(
  symbol: string,
  from: string,
  to: string
) {
  const url = new URL(`${BASE_URL}/historical-price-full/${symbol}`);
  url.searchParams.append('from', from);
  url.searchParams.append('to', to);
  url.searchParams.append('apikey', FMP_API_KEY);

  const response = await fetch(url.toString());
  const data = await response.json();

  return data.historical;
}

// Usage: Get 2023 data
const historicalData = await getHistoricalData(
  'AAPL',
  '2023-01-01',
  '2023-12-31'
);
```

### Batch Quotes Example

```typescript
async function getBatchQuotes(symbols: string[]) {
  const symbolString = symbols.join(',');
  const response = await fetch(
    `${BASE_URL}/quote/${symbolString}?apikey=${FMP_API_KEY}`
  );

  return await response.json();
}

// Usage
const quotes = await getBatchQuotes(['AAPL', 'MSFT', 'GOOGL']);
```

### Financial Statements Example

```typescript
async function getFinancials(symbol: string, statement: string) {
  const response = await fetch(
    `${BASE_URL}/${statement}/${symbol}?period=annual&limit=5&apikey=${FMP_API_KEY}`
  );

  return await response.json();
}

// Usage
const income = await getFinancials('AAPL', 'income-statement');
const balance = await getFinancials('AAPL', 'balance-sheet-statement');
const cashFlow = await getFinancials('AAPL', 'cash-flow-statement');
```

### Rate Limit Management

```typescript
class FMPClient {
  private requestQueue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestsThisMinute = 0;
  private minuteStartTime = Date.now();

  async makeRequest(url: string) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          // Reset counter if minute has passed
          if (Date.now() - this.minuteStartTime > 60000) {
            this.requestsThisMinute = 0;
            this.minuteStartTime = Date.now();
          }

          // Wait if at rate limit
          if (this.requestsThisMinute >= 300) {
            const waitTime = 60000 - (Date.now() - this.minuteStartTime);
            await new Promise(r => setTimeout(r, waitTime));
            this.requestsThisMinute = 0;
            this.minuteStartTime = Date.now();
          }

          const response = await fetch(url);
          this.requestsThisMinute++;

          if (response.status === 429) {
            // Wait 60 seconds and retry
            await new Promise(r => setTimeout(r, 60000));
            return this.makeRequest(url);
          }

          resolve(await response.json());
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    this.processing = true;
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
        // Small delay between requests
        await new Promise(r => setTimeout(r, 200));
      }
    }
    this.processing = false;
  }
}

// Usage
const client = new FMPClient();
const quote = await client.makeRequest(
  `${BASE_URL}/quote/AAPL?apikey=${FMP_API_KEY}`
);
```

---

## Data Considerations

### Plan Limitations

- **Historical Data**: Up to 5 years
- **Data Delay**: Real-time with 15-minute delay (Starter plan)
- **Coverage**: US markets primarily
- **Rate Limit**: 300 requests/minute
- **Fundamentals**: Annual data (some quarterly available)

### Best Practices

1. **Caching Strategy**:
   - Cache quotes for 1-5 minutes
   - Cache company profiles for 24 hours
   - Cache financial statements for 90 days
   - Cache historical data indefinitely

2. **Request Optimization**:
   - Use batch endpoints when available
   - Request only required date ranges
   - Use limit parameter to reduce payload size
   - Implement request deduplication

3. **Error Recovery**:
   - Implement retry logic with exponential backoff
   - Log failed requests for debugging
   - Have fallback data sources
   - Cache last successful responses

4. **Data Quality**:
   - Validate responses before use
   - Check for null/undefined values
   - Verify data freshness (timestamp)
   - Cross-reference critical data

---

## Additional Resources

- **Official Documentation**: https://site.financialmodelingprep.com/developer/docs
- **API Status**: https://status.financialmodelingprep.com
- **Support Email**: support@financialmodelingprep.com
- **Dashboard**: https://site.financialmodelingprep.com/developer

---

## Security Notes

- Store API key in environment variables, never hardcode
- Use HTTPS for all requests
- Implement request signing for sensitive operations
- Rotate API keys periodically
- Monitor API usage for anomalies
- Never expose API key in client-side code
- Use backend proxy for client requests

---

## Migration Notes

If upgrading from another plan or API:
- Test all endpoints before production deployment
- Verify rate limits don't impact your use case
- Check historical data availability
- Validate data quality and completeness
- Update error handling for new response formats
- Review and update caching strategies

---

**Last Updated**: October 7, 2025
**API Version**: v3 (primary), v4 (advanced features)
**Plan**: Starter ($22/month billed annually)
