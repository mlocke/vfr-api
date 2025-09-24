# VFR Financial Analysis Platform - API Documentation

## Overview

The VFR Financial Analysis Platform provides RESTful APIs for comprehensive stock analysis, market intelligence, and administrative management. All APIs follow enterprise security patterns with JWT authentication, rate limiting, and input validation.

## API Architecture

### Base Configuration
- **Base URL**: `https://your-domain.com/api`
- **Authentication**: JWT Bearer tokens
- **Rate Limiting**: Circuit breaker patterns with automatic throttling
- **Request Timeout**: 30 seconds default, configurable per endpoint
- **Response Format**: JSON with consistent error handling

### Security Features
- **OWASP Top 10 Protection**: Input validation, XSS prevention, SQL injection protection
- **Rate Limiting**: Request throttling with exponential backoff
- **Input Sanitization**: Symbol validation and parameter sanitization
- **Error Handling**: Secure error messages preventing information disclosure

---

## Stock Analysis APIs

### POST /api/stocks/select

**Purpose**: Comprehensive stock analysis with multi-modal intelligence aggregation including active sentiment integration.

**Business Context**: Primary endpoint for institutional-grade stock intelligence combining fundamental, technical, sentiment, macroeconomic, and institutional analysis. **Architecture Enhancement**: Sentiment data now actively contributes 10% weight to composite scoring through pre-fetch integration (fixes previous 0% utilization bug).

#### Request Schema
```typescript
interface StockSelectionRequest {
  mode: 'single' | 'sector' | 'multiple';
  symbols?: string[];        // Required for 'single' and 'multiple' modes
  sector?: string;           // Required for 'sector' mode
  limit?: number;            // Default: 10, Max: 50
  config?: {
    symbol?: string;         // Backward compatibility
    preferredDataSources?: string[];
    timeout?: number;
  };
}
```

#### Request Examples

**Single Stock Analysis**:
```json
{
  "mode": "single",
  "symbols": ["AAPL"],
  "limit": 1
}
```

**Sector Analysis**:
```json
{
  "mode": "sector",
  "sector": "Technology",
  "limit": 10
}
```

**Multiple Stock Comparison**:
```json
{
  "mode": "multiple",
  "symbols": ["AAPL", "MSFT", "GOOGL", "AMZN"],
  "limit": 4
}
```

#### Response Schema
```typescript
interface StockSelectionResponse {
  success: boolean;
  data?: {
    stocks: EnhancedStockData[];
    metadata: {
      mode: string;
      count: number;
      timestamp: number;
      sources: string[];
      technicalAnalysisEnabled: boolean;
      fundamentalDataEnabled: boolean;
      analystDataEnabled: boolean;
      sentimentAnalysisEnabled: boolean;
      macroeconomicAnalysisEnabled: boolean;
      vwapAnalysisEnabled: boolean;
      esgAnalysisEnabled: boolean;
      shortInterestAnalysisEnabled: boolean;
      extendedMarketDataEnabled: boolean;
      currencyAnalysisEnabled: boolean;
    };
  };
  error?: string;
}

interface EnhancedStockData {
  // Core Market Data
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
  source: string;

  // Technical Analysis (35% weight) - Reduced to accommodate sentiment integration
  technicalAnalysis?: {
    score: number;              // 0-100 overall technical score
    trend: {
      direction: 'bullish' | 'bearish' | 'neutral';
      strength: number;         // 0-1.0 strength indicator
      confidence: number;       // 0-1.0 confidence level
    };
    momentum: {
      signal: 'buy' | 'sell' | 'hold';
      strength: number;         // 0-1.0 momentum strength
    };
    summary: string;
  };

  // Sentiment Analysis (10% weight) - ✅ ACTIVELY INTEGRATED IN COMPOSITE SCORING
  sentimentAnalysis?: {
    score: number;              // 0-100 overall sentiment score (e.g., 0.52 for GME)
    impact: 'positive' | 'negative' | 'neutral';
    confidence: number;         // 0-1.0 confidence level
    newsVolume: number;         // News article count
    adjustedScore: number;      // Sentiment score contributing 10% to composite (FIXED: no longer 0% utilization)
    summary: string;
    utilization: number;        // 0.10 (10% weight in composite) - Architecture fix implemented
  };

  // Macroeconomic Analysis (20% weight)
  macroeconomicAnalysis?: {
    score: number;              // 0-100 overall macro score
    cyclephase: string;         // Economic cycle phase
    sectorImpact: string;       // Sector-specific economic impact
    adjustedScore: number;      // Macro-adjusted composite score
    economicRisk: number;       // 0-1.0 economic risk factor
    summary: string;
  };

  // Fundamental Analysis (25% weight)
  fundamentals?: FundamentalRatios;
  analystRating?: AnalystRatings;
  priceTarget?: PriceTarget;

  // Composite Analysis
  compositeScore?: number;      // 0-100 overall investment score
  recommendation?: 'BUY' | 'SELL' | 'HOLD';
  sector?: string;
}
```

#### Performance Characteristics
- **Response Time**: <2s for single stock, <5s for sector analysis
- **Cache TTL**: 2 minutes (development), 10 minutes (production)
- **Rate Limit**: 100 requests/hour per API key
- **Concurrent Processing**: Up to 5 parallel API calls per request
- **Sentiment Integration**: Pre-fetch architecture ensures sentiment data contributes 10% weight to composite scoring
- **Architecture Fix**: Resolved 0% sentiment utilization bug through AlgorithmEngine pre-processing (September 2024)

---

### GET /api/stocks/by-sector

**Purpose**: Retrieve stocks by sector with optional filtering and ranking.

#### Query Parameters
```typescript
interface SectorQuery {
  sector: string;              // Required: sector name
  limit?: number;              // Default: 20, Max: 100
  sortBy?: 'marketCap' | 'volume' | 'changePercent';
  order?: 'asc' | 'desc';     // Default: 'desc'
}
```

#### Example Request
```
GET /api/stocks/by-sector?sector=Technology&limit=10&sortBy=marketCap&order=desc
```

#### Response Format
```typescript
interface SectorStocksResponse {
  success: boolean;
  data?: {
    sector: string;
    stocks: StockData[];
    metadata: {
      totalCount: number;
      limit: number;
      sortBy: string;
      order: string;
      timestamp: number;
    };
  };
  error?: string;
}
```

---

## Market Intelligence APIs

### GET /api/market/sentiment

**Purpose**: Real-time market sentiment analysis from news and social sources.

#### Query Parameters
```typescript
interface SentimentQuery {
  symbols?: string[];          // Optional: specific symbols
  timeframe?: '1h' | '4h' | '1d' | '1w';  // Default: '1d'
  sources?: 'news' | 'social' | 'all';   // Default: 'all'
}
```

#### Example Request
```
GET /api/market/sentiment?symbols=AAPL,MSFT&timeframe=1d&sources=all
```

#### Response Format
```typescript
interface MarketSentimentResponse {
  success: boolean;
  data?: {
    overall: {
      score: number;            // -1.0 to 1.0 (bearish to bullish)
      confidence: number;       // 0-1.0 confidence level
      volume: number;           // Total sentiment data points
    };
    symbols: SymbolSentiment[];
    sources: {
      news: SentimentScore;
      social: SentimentScore;
      combined: SentimentScore;
    };
    timestamp: number;
  };
  error?: string;
}
```

---

### GET /api/market/sectors

**Purpose**: Sector performance and rotation analysis.

#### Response Format
```typescript
interface SectorPerformanceResponse {
  success: boolean;
  data?: {
    sectors: SectorPerformance[];
    rotation: {
      trending: string[];       // Sectors gaining momentum
      declining: string[];      // Sectors losing momentum
      stable: string[];         // Sectors with neutral momentum
    };
    timestamp: number;
  };
  error?: string;
}

interface SectorPerformance {
  name: string;
  changePercent: number;
  volume: number;
  marketCap: number;
  topStocks: string[];         // Top 3 performing stocks
  momentum: 'bullish' | 'bearish' | 'neutral';
}
```

---

## Economic Data APIs

### GET /api/economic

**Purpose**: Macroeconomic indicators affecting market conditions.

#### Query Parameters
```typescript
interface EconomicQuery {
  indicators?: string[];       // Specific indicators (GDP, CPI, unemployment, etc.)
  period?: 'current' | '1m' | '3m' | '1y';  // Default: 'current'
  format?: 'summary' | 'detailed';          // Default: 'summary'
}
```

#### Example Request
```
GET /api/economic?indicators=GDP,CPI,unemployment&period=3m&format=detailed
```

#### Response Format
```typescript
interface EconomicDataResponse {
  success: boolean;
  data?: {
    indicators: EconomicIndicator[];
    summary: {
      economicPhase: string;    // Expansion, Peak, Contraction, Trough
      riskLevel: number;        // 0-1.0 economic risk assessment
      outlook: string;          // Economic outlook summary
    };
    marketImpact: {
      sectors: SectorImpact[];  // Sector-specific economic impact
      overall: number;          // -1.0 to 1.0 overall market impact
    };
    timestamp: number;
  };
  error?: string;
}
```

---

### GET /api/economic/calendar

**Purpose**: Economic calendar with upcoming events and market impact assessment.

#### Query Parameters
```typescript
interface CalendarQuery {
  days?: number;               // Days ahead to fetch (default: 7, max: 30)
  importance?: 'low' | 'medium' | 'high' | 'all';  // Default: 'medium'
  categories?: string[];       // Event categories to include
}
```

#### Response Format
```typescript
interface EconomicCalendarResponse {
  success: boolean;
  data?: {
    events: EconomicEvent[];
    summary: {
      highImpactCount: number;
      mediumImpactCount: number;
      lowImpactCount: number;
      totalEvents: number;
    };
    marketImpactForecast: {
      overall: number;          // Expected market impact (-1.0 to 1.0)
      sectors: SectorForecast[];
    };
    timestamp: number;
  };
  error?: string;
}
```

---

## Currency Data APIs

### GET /api/currency

**Purpose**: International currency data and foreign exchange analysis.

#### Query Parameters
```typescript
interface CurrencyQuery {
  pairs?: string[];           // Currency pairs (e.g., ['USD/EUR', 'USD/JPY'])
  base?: string;              // Base currency (default: 'USD')
  timeframe?: '1d' | '1w' | '1m' | '3m';  // Default: '1d'
}
```

#### Response Format
```typescript
interface CurrencyDataResponse {
  success: boolean;
  data?: {
    rates: CurrencyRate[];
    trends: {
      strongest: string[];      // Strongest currencies vs base
      weakest: string[];        // Weakest currencies vs base
    };
    marketImpact: {
      exporters: string[];      // Sectors benefiting from currency trends
      importers: string[];      // Sectors negatively impacted
    };
    timestamp: number;
  };
  error?: string;
}
```

---

## News and Sentiment APIs

### GET /api/news/sentiment

**Purpose**: Financial news sentiment analysis with stock-specific impact assessment.

#### Query Parameters
```typescript
interface NewsSentimentQuery {
  symbols?: string[];          // Specific symbols for news filtering
  hours?: number;              // Hours of news history (default: 24, max: 168)
  sources?: string[];          // News source filtering
  minConfidence?: number;      // Minimum sentiment confidence (0-1.0)
}
```

#### Response Format
```typescript
interface NewsSentimentResponse {
  success: boolean;
  data?: {
    articles: NewsArticle[];
    sentiment: {
      overall: SentimentScore;
      bySymbol: SymbolSentiment[];
      trending: {
        positive: string[];     // Symbols with positive news trends
        negative: string[];     // Symbols with negative news trends
      };
    };
    sources: SourceMetadata[];
    timestamp: number;
  };
  error?: string;
}
```

---

## System APIs

### GET /api/health

**Purpose**: System health monitoring and service status verification.

#### No Parameters Required

#### Response Format
```typescript
interface HealthCheckResponse {
  success: boolean;
  timestamp: number;
  environment: string;
  services: {
    overall: boolean;
    database: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime: number;     // milliseconds
      details?: string;
    };
    cache: {
      status: 'healthy' | 'degraded' | 'down';
      redis: boolean;
      inMemory: boolean;
      responseTime: number;
    };
    externalAPIs: {
      polygon: APIStatus;
      alphaVantage: APIStatus;
      fmp: APIStatus;
      fred: APIStatus;
      // ... other APIs
    };
  };
  uptime: number;              // seconds
  memory: {
    used: number;              // MB
    total: number;             // MB
  };
}
```

---

## Admin APIs

### GET /api/admin/data-sources

**Purpose**: Administrative interface for data source management and monitoring.

**Authentication**: Requires admin JWT token.

#### Query Parameters
```typescript
interface AdminDataSourceQuery {
  type?: 'commercial' | 'government' | 'free';
  category?: 'stock_data' | 'economic_data' | 'web_intelligence' | 'filings';
  status?: 'active' | 'inactive' | 'error';
}
```

#### Request Headers
```
Authorization: Bearer <admin_jwt_token>
```

#### Response Format
```typescript
interface AdminDataSourceResponse {
  success: boolean;
  data?: {
    dataSources: DataSource[];
    summary: {
      total: number;
      active: number;
      inactive: number;
      errors: number;
    };
    performance: {
      avgResponseTime: number;
      successRate: number;
      lastChecked: number;
    };
  };
  error?: string;
}

interface DataSource {
  id: string;
  name: string;
  type: 'commercial' | 'government' | 'free';
  category: string;
  status: 'active' | 'inactive' | 'error';
  lastChecked: number;
  responseTime: number;
  successRate: number;
  rateLimit: {
    limit: number;
    remaining: number;
    resetTime: number;
  };
  config: {
    enabled: boolean;
    priority: number;
    timeout: number;
  };
}
```

---

### POST /api/admin/data-sources/[dataSourceId]/test

**Purpose**: Test individual data source connectivity and performance.

**Authentication**: Requires admin JWT token.

#### Path Parameters
- `dataSourceId`: Unique identifier of the data source to test

#### Request Body
```typescript
interface DataSourceTestRequest {
  testType: 'connection' | 'data' | 'performance' | 'comprehensive';
  symbol?: string;             // Optional test symbol
  timeout?: number;            // Test timeout override
}
```

#### Response Format
```typescript
interface DataSourceTestResponse {
  success: boolean;
  data?: {
    dataSourceId: string;
    testType: string;
    result: {
      status: 'pass' | 'fail' | 'warning';
      responseTime: number;
      dataQuality: number;     // 0-1.0 quality score
      details: TestDetail[];
    };
    timestamp: number;
  };
  error?: string;
}
```

---

### POST /api/admin/data-sources/[dataSourceId]/toggle

**Purpose**: Enable or disable specific data sources.

**Authentication**: Requires admin JWT token.

#### Request Body
```typescript
interface DataSourceToggleRequest {
  enabled: boolean;
  reason?: string;             // Optional reason for status change
}
```

#### Response Format
```typescript
interface DataSourceToggleResponse {
  success: boolean;
  data?: {
    dataSourceId: string;
    previousStatus: boolean;
    newStatus: boolean;
    timestamp: number;
    reason?: string;
  };
  error?: string;
}
```

---

## Error Handling

### Standard Error Response Format
```typescript
interface ErrorResponse {
  success: false;
  error: string;               // User-friendly error message
  code?: string;               // Internal error code
  timestamp: number;
  details?: any;               // Additional error context (development only)
}
```

### HTTP Status Codes
| Status | Description | Usage |
|--------|-------------|-------|
| 200 | Success | Successful request with data |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Categories
1. **Validation Errors**: Invalid input parameters
2. **Authentication Errors**: Missing or invalid credentials
3. **Authorization Errors**: Insufficient permissions
4. **Rate Limit Errors**: Request throttling
5. **API Errors**: External API failures
6. **System Errors**: Internal service failures

---

## Rate Limiting

### Rate Limit Headers
All API responses include rate limiting information:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
X-RateLimit-Retry-After: 60
```

### Rate Limit Tiers
| Tier | Requests/Hour | Concurrent | Description |
|------|---------------|------------|-------------|
| Free | 100 | 2 | Basic access |
| Standard | 1,000 | 5 | Standard usage |
| Professional | 10,000 | 10 | High-volume usage |
| Enterprise | Unlimited | 20 | Enterprise customers |

---

## API Integration Patterns

### Fallback Strategy
All APIs implement automatic fallback patterns:
1. **Primary API** → **Secondary API** → **Cache** → **Error Response**
2. Circuit breaker patterns prevent cascading failures
3. Graceful degradation maintains service availability

### Caching Strategy
- **Response Caching**: 2-10 minute TTL based on data type
- **CDN Integration**: Static content and frequent queries
- **Cache Invalidation**: Real-time updates trigger cache refresh

### Security Patterns
- **Input Validation**: All parameters validated and sanitized
- **Output Sanitization**: Sensitive data removed from responses
- **Rate Limiting**: Automatic request throttling
- **Audit Logging**: All admin actions logged and monitored

This API documentation provides comprehensive guidance for integrating with the VFR Financial Analysis Platform's RESTful APIs.