# Market Intelligence Backend Data Flow

## When You Enter "AAPL" and Click "Run Deep Analysis"

### 1️⃣ Frontend (app/stock-intelligence/page.tsx)
```javascript
handleConfirm() → {
  request: {
    scope: {
      mode: 'single_stock',
      symbols: ['AAPL'],
      maxResults: 10
    },
    options: {
      useRealTimeData: true,
      includeSentiment: true,
      includeNews: true
    }
  }
} → POST /api/stocks/select
```

### 2️⃣ API Route (app/api/stocks/select/route.ts)

#### Step 2.1: Request Validation
- Validates request structure using Zod schemas
- Rate limiting check (30 req/min per IP)
- Request queuing with priority (single stock = high priority)

#### Step 2.2: Cache Check
```javascript
cacheKey = "selection:single_stock:AAPL:10:{options}:v2"
cached = await redisCache.get(cacheKey)
// If hit, return immediately (target: 75% hit rate)
```

#### Step 2.3: Service Pool Initialization
```javascript
ServicePool.getInstance() → {
  MCPClient → MCP servers (10 financial servers + 2 utility servers)
  DataFusionEngine → Combines multiple data sources
  FactorLibrary → Technical/fundamental analysis algorithms
  DataFlowManager → Orchestrates data flow
  StockSelectionService → Main analysis engine
}
```

### 3️⃣ Stock Selection Service (StockSelectionService.ts)

#### Step 3.1: Data Collection Phase
```javascript
// Parallel data fetching from 10 financial MCP servers
Promise.all([
  // Stock Market Data (4 servers)
  polygonClient.getQuote('AAPL'),         // Real-time market data
  alphaVantageClient.getTechnicals('AAPL'), // Technical indicators
  fmpClient.getFinancials('AAPL'),        // Financial Modeling Prep
  yahooClient.getStockInfo('AAPL'),       // Yahoo Finance (free)

  // News & Intelligence (2 servers)
  firecrawlClient.searchNews('AAPL'),     // Web scraping for news
  dappierClient.getIntelligence('AAPL'), // AI-powered web intelligence

  // Government Financial Data (4 servers)
  secEdgarClient.getFilings('AAPL'),      // SEC EDGAR filings
  treasuryClient.getRates(),              // Treasury rates
  fredClient.getEconomicData(),           // Federal Reserve data
  blsClient.getEmploymentData(),          // Bureau of Labor Statistics
  eisClient.getEnergyData()               // Energy Information Administration
])
```

**Actual Data Fetched:**
- **Price Data**: Current price, volume, day range, 52-week range
- **Fundamentals**: P/E ratio, EPS, market cap, revenue, profit margins
- **Technicals**: RSI, MACD, moving averages, Bollinger Bands
- **Sentiment**: News sentiment score, social media buzz, analyst ratings

#### Step 3.2: Data Fusion (DataFusionEngine.ts)
```javascript
fusedData = {
  symbol: 'AAPL',
  price: {
    current: 178.45,
    change: +2.34,
    changePercent: 1.33,
    volume: 58234000
  },
  fundamentals: {
    peRatio: 29.8,
    eps: 6.13,
    marketCap: 2.98e12,
    revenueGrowth: 0.045
  },
  technicals: {
    rsi: 58.3,           // Neutral
    macd: { signal: 'bullish' },
    ma50: 175.20,
    ma200: 168.45
  },
  sentiment: {
    newsScore: 0.72,     // Positive
    analystRating: 'Buy',
    socialBuzz: 'high'
  },
  qualityScore: {
    overall: 0.92,       // High quality data
    freshness: 0.95,     // Very recent
    completeness: 0.89   // Most metrics available
  }
}
```

### 4️⃣ Algorithm Processing (AlgorithmIntegration.ts)

#### Step 4.1: Factor Analysis
```javascript
factors = {
  value: calculateValueScore(fusedData),      // P/E, P/B ratios
  growth: calculateGrowthScore(fusedData),    // Revenue, earnings growth
  momentum: calculateMomentumScore(fusedData), // Price trends, RSI
  quality: calculateQualityScore(fusedData),  // Margins, ROE
  sentiment: normalizeSentiment(fusedData)    // News, social sentiment
}
```

#### Step 4.2: Weighted Scoring
```javascript
weights = {
  fundamental: 0.35,
  technical: 0.25,
  sentiment: 0.20,
  momentum: 0.20
}

finalScore = Σ(factors[i] * weights[i]) // e.g., 0.78 (78%)
```

#### Step 4.3: Generate Recommendation
```javascript
recommendation = {
  action: score > 0.70 ? 'BUY' : score > 0.40 ? 'HOLD' : 'SELL',
  confidence: calculateConfidence(dataQuality, volatility),
  reasoning: generateReasoning(factors, dominantFactors)
}
```

### 5️⃣ Response Assembly

```javascript
response = {
  success: true,
  topSelections: [{
    symbol: 'AAPL',
    score: 0.78,
    recommendation: {
      action: 'BUY',
      confidence: 'High',
      timeHorizon: 'medium-term'
    },
    analysis: {
      reasoning: "Strong momentum with RSI at 58, solid fundamentals...",
      primaryFactors: ['momentum', 'quality', 'sentiment'],
      risks: ['valuation', 'market_volatility']
    },
    fundamentals: { /* all metrics */ },
    technicals: { /* all indicators */ },
    context: {
      sector: 'Technology',
      industry: 'Consumer Electronics',
      marketConditions: 'bullish'
    }
  }],
  metadata: {
    algorithmUsed: 'multi-factor-v2',
    dataSourcesUsed: ['polygon', 'alphavantage', 'fmp', 'yahoo', 'firecrawl', 'dappier', 'sec_edgar', 'treasury', 'fred', 'bls'],
    cacheHitRate: 0.75,
    analysisMode: 'single_stock',
    qualityScore: { overall: 0.92 }
  },
  performance: {
    dataFetchTime: 450,  // ms
    analysisTime: 120,   // ms
    fusionTime: 35,      // ms
    totalTime: 605       // ms
  }
}
```

### 6️⃣ Frontend Display (Results Component)

The response is displayed showing:
- **Score**: 78% (visual progress bar)
- **Recommendation**: BUY with High confidence
- **Key Metrics**: P/E, Market Cap, RSI, etc.
- **Reasoning**: AI-generated explanation
- **Risk Factors**: Identified concerns

## Complete MCP Server Architecture

### Financial MCP Servers (10 Total)

#### Stock Market Data (4 servers)
1. **Polygon MCP** - Real-time market data, quotes, historical data
2. **Alpha Vantage MCP** - Technical indicators, company overviews
3. **Financial Modeling Prep MCP** - Company financials, analyst ratings
4. **Yahoo Finance MCP** - Free stock data, financial statements

#### News & Intelligence (2 servers)
5. **Firecrawl MCP** - Web scraping for financial news and analysis
6. **Dappier MCP** - AI-powered web intelligence and sentiment analysis

#### Government Financial Data (4 servers)
7. **SEC EDGAR MCP** - Company filings, insider transactions, financial facts
8. **Treasury MCP** - Treasury rates, federal debt, exchange rates
9. **FRED MCP** - Federal Reserve economic data (800,000+ data series)
10. **BLS MCP** - Bureau of Labor Statistics (employment, CPI, wages)
11. **EIA MCP** - Energy Information Administration (oil, gas, electricity)

*Note: That's actually 11 total financial servers, not 10 as originally documented.*

### Utility MCP Servers (2 servers, excluded from financial analysis)
- **GitHub MCP** - Code repository intelligence (blacklisted for financial analysis)
- **Context7 MCP** - Documentation lookup (blacklisted for financial analysis)

## Data Sources Configuration

### Required Environment Variables:
```bash
# Stock Market Data MCP Servers
POLYGON_API_KEY=your_key
ALPHA_VANTAGE_API_KEY=your_key
FMP_API_KEY=your_key

# News & Intelligence MCP Servers
FIRECRAWL_API_KEY=your_key
DAPPIER_API_KEY=your_key

# Government Data MCP Servers (some require API keys)
FRED_API_KEY=E093a281de7f0d224ed51ad0842fc393
BLS_API_KEY=e168db38c47449c8a41e031171deeb19
EIA_API_KEY=your_key

# Cache
REDIS_URL=redis://localhost:6379

# Optional
OPENAI_API_KEY=your_key  # For enhanced analysis
```

## Performance Metrics

- **Cache Hit Rate**: 75% target (5min TTL)
- **Response Time**: <5s single stock, <30s multi-stock
- **Data Freshness**: Real-time where available, <15min delay otherwise
- **Concurrent Requests**: 10 max, with priority queue
- **Rate Limiting**: 30 requests/minute per IP

## Debugging Tips

1. **Check Service Health**: `GET /api/stocks/select`
2. **Monitor Logs**: Backend console shows data flow
3. **Cache Status**: Redis MONITOR command
4. **API Keys**: Verify all services configured
5. **Network Tab**: Browser DevTools shows request/response