# Stock Selection API Endpoint

## Overview

Unified RESTful API endpoint for all stock selection operations. Supports single stock analysis, multi-stock comparison, and sector-based selection with performance optimization and streaming responses.

**Endpoint:** `/api/stocks/select`
**Methods:** `POST`, `GET`, `DELETE`
**Version:** 2.0.0

## Request Structure

### POST /api/stocks/select

Main selection endpoint with comprehensive request validation and performance optimization.

#### Request Schema

```typescript
interface SelectionRequest {
  scope: AnalysisScope
  options?: SelectionOptions
  requestId?: string
  userId?: string
}

interface AnalysisScope {
  mode: SelectionMode
  symbols?: string[]
  sector?: SectorOption
  excludeSymbols?: string[]
  maxResults?: number // 1-100
  timeframe?: Timeframe
}

interface SelectionOptions {
  algorithmId?: string
  useRealTimeData?: boolean
  includeSentiment?: boolean
  includeNews?: boolean
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive'
  dataPreferences?: DataPreferences
  customWeights?: CustomWeights
  timeout?: number // 1000-300000ms
  parallel?: boolean
}

enum SelectionMode {
  SINGLE_STOCK = 'single_stock',
  MULTIPLE_STOCKS = 'multiple_stocks',
  SECTOR_ANALYSIS = 'sector_analysis',
  INDEX_ANALYSIS = 'index_analysis',
  ETF_ANALYSIS = 'etf_analysis'
}
```

#### Example Requests

**Single Stock Analysis:**
```json
{
  "scope": {
    "mode": "single_stock",
    "symbols": ["AAPL"]
  },
  "options": {
    "useRealTimeData": true,
    "includeSentiment": true,
    "riskTolerance": "moderate"
  }
}
```

**Multi-Stock Comparison:**
```json
{
  "scope": {
    "mode": "multiple_stocks",
    "symbols": ["AAPL", "GOOGL", "MSFT", "TSLA"],
    "maxResults": 20
  },
  "options": {
    "algorithmId": "enhanced_scoring_v2",
    "customWeights": {
      "technical": 0.3,
      "fundamental": 0.4,
      "sentiment": 0.2,
      "momentum": 0.1
    }
  }
}
```

**Sector Analysis:**
```json
{
  "scope": {
    "mode": "sector_analysis",
    "sector": {
      "id": "technology",
      "label": "Technology",
      "category": "equity"
    },
    "maxResults": 50
  },
  "options": {
    "includeNews": true,
    "dataPreferences": {
      "minQualityScore": 0.8,
      "maxLatency": 1000
    }
  }
}
```

## Response Structure

### Standard Response

```typescript
interface SelectionResponse {
  success: boolean
  requestId: string
  timestamp: number
  executionTime: number

  // Mode-specific results
  singleStock?: EnhancedStockResult
  sectorAnalysis?: SectorAnalysisResult
  multiStockAnalysis?: MultiStockAnalysisResult

  // Unified results
  topSelections: EnhancedStockResult[]

  // Metadata
  metadata: ResponseMetadata
  performance: PerformanceBreakdown
  errors?: string[]
}

interface EnhancedStockResult {
  symbol: string
  score: StockScore
  weight: number
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number

  context: {
    sector: string
    marketCap: number
    priceChange24h: number
    volumeChange24h: number
    beta: number
  }

  reasoning: {
    primaryFactors: string[]
    warnings: string[]
    opportunities: string[]
  }

  dataQuality: QualityScore
}
```

### Example Response

```json
{
  "success": true,
  "requestId": "req_1726398765432_abc123",
  "timestamp": 1726398765432,
  "executionTime": 2847,

  "topSelections": [
    {
      "symbol": "AAPL",
      "score": {
        "overallScore": 0.842,
        "factorScores": {
          "technical": 0.78,
          "fundamental": 0.91,
          "sentiment": 0.76,
          "momentum": 0.88
        }
      },
      "weight": 1.0,
      "action": "BUY",
      "confidence": 0.87,

      "context": {
        "sector": "Technology",
        "marketCap": 3200000000000,
        "priceChange24h": 2.34,
        "volumeChange24h": 0.15,
        "beta": 1.21
      },

      "reasoning": {
        "primaryFactors": ["Strong earnings growth", "Technical momentum", "Market leadership"],
        "warnings": ["High valuation multiple"],
        "opportunities": ["AI integration potential", "Services growth"]
      },

      "dataQuality": {
        "overall": 0.92,
        "metrics": {
          "freshness": 0.95,
          "completeness": 0.89,
          "accuracy": 0.94,
          "sourceReputation": 0.88,
          "latency": 145
        },
        "timestamp": 1726398765430,
        "source": "fusion_engine"
      }
    }
  ],

  "metadata": {
    "algorithmUsed": "enhanced_scoring_v2",
    "dataSourcesUsed": ["polygon", "alpha_vantage", "yahoo_finance"],
    "cacheHitRate": 0.75,
    "analysisMode": "single_stock",
    "qualityScore": { /* overall quality */ }
  },

  "performance": {
    "dataFetchTime": 854,
    "analysisTime": 1423,
    "fusionTime": 427,
    "cacheTime": 143
  }
}
```

## Performance Features

### Response Streaming

Large datasets use NDJSON streaming for reduced perceived latency:

```bash
# Request header
Accept: application/x-ndjson

# Response chunks
{"type":"metadata","data":{"requestId":"...","timestamp":...}}
{"type":"selection","index":0,"data":{"symbol":"AAPL",...}}
{"type":"selection","index":1,"data":{"symbol":"GOOGL",...}}
{"type":"complete"}
```

### Caching Strategy

- **Cache Keys:** Generated from request scope + options
- **TTL:** 300s for real-time, 3600s for historical
- **Hit Rate Target:** 75%+ for repeated queries
- **Invalidation:** Automatic on market close/open

### Request Prioritization

```typescript
// Priority calculation
function calculatePriority(request: SelectionRequest): number {
  let priority = 1

  if (request.scope.mode === 'single_stock') priority += 2  // Fast queries
  if (request.options?.useRealTimeData) priority += 1       // Real-time requests
  if (request.scope.symbols?.length > 10) priority -= 1     // Large requests

  return Math.max(1, priority)
}
```

## Rate Limiting

- **Window:** 60 seconds
- **Limit:** 30 requests per window
- **Burst Capacity:** 10 additional requests for high-priority
- **Identifier:** IP + User-Agent combination

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "requestId": "req_1726398765432_abc123",
  "timestamp": 1726398765432,
  "executionTime": 157,
  "error": "Request timeout",
  "message": "Request exceeded 30s timeout limit",
  "topSelections": [],
  "metadata": { /* error metadata */ },
  "performance": { /* zero values */ }
}
```

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid request format | Request validation failed |
| 408 | Request timeout | Analysis exceeded timeout |
| 429 | Rate limit exceeded | Too many requests |
| 503 | Service unavailable | Service initialization failed |

## Additional Endpoints

### GET /api/stocks/select

Health check and service statistics:

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime": 86400,
  "performance": {
    "responseTime": 23,
    "memoryUsage": {
      "heapUsed": 256,
      "heapTotal": 512,
      "utilization": 50
    },
    "optimization": {
      "connectionPooling": true,
      "requestQueuing": true,
      "responseStreaming": true,
      "predictiveCaching": true
    }
  },
  "stats": {
    "totalRequests": 1247,
    "successRate": 0.987,
    "averageExecutionTime": 2341,
    "cacheHitRate": 0.78
  },
  "supportedModes": ["single_stock", "multiple_stocks", "sector_analysis"],
  "rateLimits": {
    "window": 60000,
    "maxRequests": 30,
    "burstCapacity": 10
  }
}
```

### DELETE /api/stocks/select?requestId={id}

Cancel active request:

```json
{
  "success": true,
  "message": "Request cancelled successfully",
  "requestId": "req_1726398765432_abc123",
  "responseTime": 12
}
```

## Integration Examples

### cURL Examples

```bash
# Single stock analysis
curl -X POST http://localhost:3000/api/stocks/select \
  -H "Content-Type: application/json" \
  -d '{
    "scope": {
      "mode": "single_stock",
      "symbols": ["AAPL"]
    },
    "options": {
      "useRealTimeData": true
    }
  }'

# Health check
curl http://localhost:3000/api/stocks/select

# Cancel request
curl -X DELETE "http://localhost:3000/api/stocks/select?requestId=req_123"
```

### TypeScript Client

```typescript
import { SelectionRequest, SelectionResponse } from './types'

class StockSelectionClient {
  private baseUrl = '/api/stocks/select'

  async selectStocks(request: SelectionRequest): Promise<SelectionResponse> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      throw new Error(`Selection failed: ${response.status}`)
    }

    return response.json()
  }

  async selectStocksStreaming(
    request: SelectionRequest,
    onChunk: (chunk: any) => void
  ): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/x-ndjson'
      },
      body: JSON.stringify(request)
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    while (reader) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const data = JSON.parse(chunk)
      onChunk(data)
    }
  }
}
```

## Performance Benchmarks

| Operation | Target Time | Actual (P95) | Cache Hit Rate |
|-----------|-------------|--------------|----------------|
| Single stock | <5s | 2.8s | 85% |
| Multi-stock (10) | <15s | 11.2s | 72% |
| Sector analysis | <30s | 24.1s | 68% |
| Health check | <100ms | 23ms | - |

## Monitoring & Observability

**Response Headers:**
- `X-Request-ID`: Unique request identifier
- `X-Processing-Time`: Total processing time in ms
- `X-Streaming`: Whether response used streaming
- `X-Performance-Optimized`: Optimization status

**Metrics Tracked:**
- Request volume and success rate
- Response time distribution
- Cache hit/miss rates
- Memory usage and optimization effectiveness
- Error rates by type and endpoint