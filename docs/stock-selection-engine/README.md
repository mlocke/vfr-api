# Stock Selection Engine Technical Guide

## Architecture Overview

The Stock Selection Engine is a unified system for AI-native stock analysis, combining multiple selection modes, advanced algorithms, and multi-source data fusion. Built on the MCP infrastructure with performance optimization and streaming capabilities.

### Core Components

```
StockSelectionService (Orchestration)
├── AlgorithmIntegration (Algorithm Engine interface)
├── SectorIntegration (Sector-based analysis)
├── DataFlowManager (Request/response optimization)
├── SelectionConfigManager (Configuration management)
└── Integration layers (MCP, caching, fusion)
```

### Selection Modes

| Mode | Description | Input | Use Case |
|------|-------------|-------|----------|
| `SINGLE_STOCK` | Individual stock analysis | Single symbol | Deep stock research |
| `MULTIPLE_STOCKS` | Multi-stock comparison | Symbol array | Portfolio construction |
| `SECTOR_ANALYSIS` | Sector-wide screening | Sector specification | Sector rotation |
| `INDEX_ANALYSIS` | Index component analysis | Index specification | Index tracking |
| `ETF_ANALYSIS` | ETF holdings analysis | ETF specification | ETF evaluation |

## System Integration

### Data Flow Architecture

```typescript
Request → Validation → Priority Queue → Service Pool → Algorithm Engine
                                                    ↓
Cache ← Response Builder ← Data Fusion ← MCP Collectors ← Analysis Results
```

### Key Interfaces

```typescript
interface DataIntegrationInterface {
  fetchStockData(symbols: string[], options?: SelectionOptions): Promise<any>
  validateDataQuality(data: any): Promise<QualityScore>
  getCachedData(key: string): Promise<any>
  setCachedData(key: string, data: any, ttl: number): Promise<void>
}

interface SelectionRequest {
  scope: AnalysisScope
  options?: SelectionOptions
  requestId?: string
  userId?: string
}

interface SelectionResponse {
  success: boolean
  requestId: string
  timestamp: number
  executionTime: number
  topSelections: EnhancedStockResult[]
  metadata: ResponseMetadata
  performance: PerformanceBreakdown
  errors?: string[]
}
```

## Implementation Details

### Service Initialization

```typescript
// Factory pattern with dependency injection
export async function createStockSelectionService(
  mcpClient: MCPClient,
  dataFusion: DataFusionEngine,
  factorLibrary: FactorLibrary,
  cache: RedisCache
): Promise<StockSelectionService> {
  const service = new StockSelectionService(mcpClient, dataFusion, factorLibrary, cache)

  const health = await service.healthCheck()
  if (health.status === 'unhealthy') {
    console.warn('Service initialized with unhealthy dependencies:', health.details)
  }

  return service
}
```

### Performance Optimizations

#### 1. Service Pooling

```typescript
class ServicePool {
  private stockSelectionService: StockSelectionService | null = null
  private dataFlowManager: DataFlowManager | null = null
  private isInitializing = false

  async getServices(): Promise<{ stockSelectionService: StockSelectionService; dataFlowManager: DataFlowManager }> {
    if (this.stockSelectionService && this.dataFlowManager) {
      return { stockSelectionService: this.stockSelectionService, dataFlowManager: this.dataFlowManager }
    }

    // Handle concurrent initialization
    if (this.isInitializing && this.initPromise) {
      await this.initPromise
    }

    // Initialize services once
    await this.initializeServices()
    return { stockSelectionService: this.stockSelectionService!, dataFlowManager: this.dataFlowManager! }
  }
}
```

#### 2. Request Prioritization

```typescript
class PerformanceOptimizer {
  static optimizeRequestPriority(request: SelectionRequest): number {
    let priority = 1

    if (request.scope.mode === SelectionMode.SINGLE_STOCK) priority += 2  // Fast queries
    if (request.options?.useRealTimeData) priority += 1                   // Real-time priority
    if (request.scope.symbols && request.scope.symbols.length > 10) priority -= 1  // Large requests

    return Math.max(1, priority)
  }
}
```

#### 3. Response Streaming

```typescript
class ResponseStreamer {
  static createStreamingResponse(data: SelectionResponse): ReadableStream {
    return new ReadableStream({
      start(controller) {
        const chunks = [
          { type: 'metadata', data: { ...data, topSelections: undefined } },
          ...data.topSelections.map((selection, index) => ({
            type: 'selection',
            index,
            data: selection
          })),
          { type: 'complete' }
        ]

        chunks.forEach((chunk, i) => {
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk) + '\n'))
            if (i === chunks.length - 1) controller.close()
          }, i * 1)
        })
      }
    })
  }
}
```

### Algorithm Integration

#### AlgorithmIntegration Class

```typescript
export class AlgorithmIntegration {
  constructor(
    private dataFusion: DataFusionEngine,
    private factorLibrary: FactorLibrary,
    private algorithmCache: AlgorithmCache,
    private config: SelectionConfigManager
  ) {}

  async executeAnalysis(request: SelectionRequest): Promise<SelectionResult> {
    const algorithmId = request.options?.algorithmId || this.config.getConfig().defaultAlgorithmId
    const algorithm = await this.getAlgorithm(algorithmId)

    // Data preparation
    const stockData = await this.prepareStockData(request)
    const factors = await this.calculateFactors(stockData, request)

    // Algorithm execution
    const result = await algorithm.execute({
      stocks: stockData,
      factors,
      options: request.options
    })

    return this.enhanceResult(result, request)
  }

  private async prepareStockData(request: SelectionRequest): Promise<StockData[]> {
    const symbols = this.extractSymbols(request)
    return await this.dataFusion.fetchMultiSourceData(symbols, {
      includeRealTime: request.options?.useRealTimeData,
      qualityThreshold: request.options?.dataPreferences?.minQualityScore
    })
  }
}
```

### Configuration Management

```typescript
export class SelectionConfigManager {
  private config: SelectionConfig

  constructor() {
    this.config = {
      defaultAlgorithmId: 'enhanced_scoring_v2',
      limits: {
        maxSymbolsPerRequest: 50,
        maxConcurrentRequests: 10,
        defaultTimeout: 30000
      },
      caching: {
        ttl: {
          single_stock: 300,    // 5 minutes
          multiple_stocks: 300,
          sector_analysis: 600,  // 10 minutes
          index_analysis: 600,
          etf_analysis: 600
        }
      },
      dataSources: {
        polygon: { weight: 0.4, timeout: 5000 },
        alphaVantage: { weight: 0.3, timeout: 7000 },
        yahooFinance: { weight: 0.3, timeout: 3000 }
      }
    }
  }

  generateCacheKey(prefix: string, options?: SelectionOptions): string {
    const optionsHash = options ? this.hashOptions(options) : 'default'
    return `${prefix}:${optionsHash}:v2`
  }

  getCacheTTL(mode: SelectionMode): number {
    return this.config.caching.ttl[mode] || 300
  }
}
```

## Usage Patterns

### 1. Single Stock Analysis

```typescript
const request: SelectionRequest = {
  scope: {
    mode: SelectionMode.SINGLE_STOCK,
    symbols: ['AAPL']
  },
  options: {
    useRealTimeData: true,
    includeSentiment: true,
    riskTolerance: 'moderate'
  }
}

const response = await stockSelectionService.selectStocks(request)
const stockResult = response.singleStock
```

### 2. Multi-Stock Portfolio Construction

```typescript
const request: SelectionRequest = {
  scope: {
    mode: SelectionMode.MULTIPLE_STOCKS,
    symbols: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA'],
    maxResults: 20
  },
  options: {
    algorithmId: 'portfolio_optimization_v1',
    customWeights: {
      technical: 0.25,
      fundamental: 0.40,
      sentiment: 0.20,
      momentum: 0.15
    }
  }
}

const response = await stockSelectionService.selectStocks(request)
const portfolioAnalysis = response.multiStockAnalysis
```

### 3. Sector Screening

```typescript
const request: SelectionRequest = {
  scope: {
    mode: SelectionMode.SECTOR_ANALYSIS,
    sector: {
      id: 'technology',
      label: 'Technology',
      category: 'equity'
    },
    maxResults: 50
  },
  options: {
    includeNews: true,
    dataPreferences: {
      minQualityScore: 0.8,
      maxLatency: 1000
    }
  }
}

const response = await stockSelectionService.selectStocks(request)
const sectorAnalysis = response.sectorAnalysis
```

## Performance Characteristics

### Response Time Targets

| Operation | Target | Actual (P95) | Optimization |
|-----------|--------|--------------|-------------|
| Single stock | <5s | 2.8s | Cache + streaming |
| Multi-stock (10) | <15s | 11.2s | Parallel processing |
| Sector analysis | <30s | 24.1s | Progressive results |

### Caching Strategy

```typescript
// Cache key generation
function generateCacheKey(request: SelectionRequest): string {
  const keyParts = [
    request.scope.mode,
    request.scope.symbols?.sort().join(',') || '',
    request.scope.sector?.id || '',
    request.scope.maxResults || '10',
    JSON.stringify(request.options || {})
  ]
  return `selection:${keyParts.join(':')}:v2`
}

// TTL based on data freshness requirements
const cacheTTL = {
  realTimeData: 300,     // 5 minutes
  historicalData: 3600,  // 1 hour
  sectorData: 1800       // 30 minutes
}
```

### Memory Management

```typescript
class MemoryManager {
  private gcThreshold = 100 * 1024 * 1024 // 100MB

  performCleanup(): void {
    requestTracker.cleanup()

    const memUsage = process.memoryUsage()
    if (memUsage.heapUsed > this.gcThreshold && global.gc) {
      console.log('🧹 Triggering garbage collection')
      global.gc()
    }
  }
}
```

## Error Handling & Recovery

### Timeout Management

```typescript
async function executeWithTimeout<T>(
  operation: Promise<T>,
  timeout: number,
  fallback?: () => Promise<T>
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Operation timeout')), timeout)
  })

  try {
    return await Promise.race([operation, timeoutPromise])
  } catch (error) {
    if (fallback && error.message.includes('timeout')) {
      console.warn('Operation timed out, attempting fallback')
      return await fallback()
    }
    throw error
  }
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private lastFailTime = 0

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > 60000) { // 1 minute
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure(): void {
    this.failures++
    this.lastFailTime = Date.now()

    if (this.failures >= 5) {
      this.state = 'OPEN'
    }
  }
}
```

## Testing Approach

### Unit Testing

```typescript
describe('StockSelectionService', () => {
  let service: StockSelectionService
  let mockMCPClient: jest.Mocked<MCPClient>
  let mockDataFusion: jest.Mocked<DataFusionEngine>

  beforeEach(async () => {
    mockMCPClient = createMockMCPClient()
    mockDataFusion = createMockDataFusion()

    service = new StockSelectionService(
      mockMCPClient,
      mockDataFusion,
      new FactorLibrary(),
      new MockRedisCache()
    )
  })

  it('should handle single stock analysis', async () => {
    const request: SelectionRequest = {
      scope: { mode: SelectionMode.SINGLE_STOCK, symbols: ['AAPL'] }
    }

    mockDataFusion.fetchMultiSourceData.mockResolvedValue([mockStockData])

    const response = await service.selectStocks(request)

    expect(response.success).toBe(true)
    expect(response.singleStock).toBeDefined()
    expect(response.topSelections).toHaveLength(1)
  })
})
```

### Integration Testing

```typescript
describe('Stock Selection API Integration', () => {
  it('should handle end-to-end single stock request', async () => {
    const response = await request(app)
      .post('/api/stocks/select')
      .send({
        scope: { mode: 'single_stock', symbols: ['AAPL'] },
        options: { useRealTimeData: true }
      })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.topSelections).toHaveLength(1)
    expect(response.headers['x-request-id']).toBeDefined()
  })
})
```

### Performance Testing

```typescript
describe('Performance benchmarks', () => {
  it('should complete single stock analysis under 5s', async () => {
    const startTime = Date.now()

    const response = await service.selectStocks({
      scope: { mode: SelectionMode.SINGLE_STOCK, symbols: ['AAPL'] }
    })

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(5000)
    expect(response.executionTime).toBeLessThan(5000)
  })
})
```

## Monitoring & Observability

### Health Checks

```typescript
async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
  try {
    const mcpHealthy = await this.mcpClient.healthCheck?.() || true
    const cacheHealthy = await this.cache.ping() === 'PONG'
    const algorithmHealthy = await this.algorithmIntegration.healthCheck()

    return {
      status: mcpHealthy && cacheHealthy && algorithmHealthy ? 'healthy' : 'unhealthy',
      details: {
        mcp: mcpHealthy,
        cache: cacheHealthy,
        algorithms: algorithmHealthy,
        activeRequests: this.activeRequests.size,
        stats: this.stats
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: error.message }
    }
  }
}
```

### Metrics Collection

```typescript
interface SelectionServiceStats {
  totalRequests: number
  successRate: number
  averageExecutionTime: number
  cacheHitRate: number
  requestsByMode: Record<SelectionMode, number>
  algorithmUsage: Record<string, number>
  sourceStats: Record<string, any>
}
```

## Development Workflow

### 1. Adding New Selection Modes

```typescript
// 1. Add to SelectionMode enum
enum SelectionMode {
  // existing modes...
  CUSTOM_SCREENER = 'custom_screener'
}

// 2. Implement in executeAnalysis
private async executeAnalysis(request: SelectionRequest, requestId: string): Promise<any> {
  switch (request.scope.mode) {
    case SelectionMode.CUSTOM_SCREENER:
      return await this.executeCustomScreenerAnalysis(request, requestId)
    // other cases...
  }
}

// 3. Add validation in validateAnalysisScope
function validateAnalysisScope(scope: AnalysisScope): { valid: boolean; message?: string } {
  switch (scope.mode) {
    case SelectionMode.CUSTOM_SCREENER:
      if (!scope.customCriteria) {
        return { valid: false, message: 'Custom screener requires criteria specification' }
      }
      break
    // other validations...
  }
}
```

### 2. Algorithm Integration

```typescript
// Implement algorithm interface
interface Algorithm {
  id: string
  version: string
  execute(input: AlgorithmInput): Promise<AlgorithmResult>
  validate(input: AlgorithmInput): boolean
}

// Register with AlgorithmEngine
const newAlgorithm = new CustomScoringAlgorithm()
algorithmEngine.registerAlgorithm(newAlgorithm)
```

### 3. Performance Optimization

```typescript
// Add caching for new data types
async function getCachedResult(key: string, generator: () => Promise<any>, ttl: number): Promise<any> {
  const cached = await this.cache.get(key)
  if (cached) return cached

  const result = await generator()
  await this.cache.set(key, result, ttl)
  return result
}

// Implement request batching
async function batchRequests<T>(
  requests: T[],
  processor: (batch: T[]) => Promise<any[]>,
  batchSize: number = 10
): Promise<any[]> {
  const results = []

  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize)
    const batchResults = await processor(batch)
    results.push(...batchResults)
  }

  return results
}
```

## Deployment Considerations

### Environment Configuration

```typescript
// Environment-specific settings
const config = {
  development: {
    timeout: 60000,
    cacheEnabled: false,
    verboseLogging: true
  },
  production: {
    timeout: 30000,
    cacheEnabled: true,
    verboseLogging: false,
    rateLimiting: true
  }
}
```

### Scaling Considerations

- **Horizontal Scaling:** Service pool handles multiple instances
- **Cache Warming:** Pre-populate cache with popular requests
- **Load Balancing:** Distribute requests based on complexity
- **Circuit Breakers:** Prevent cascade failures across services

### Security Best Practices

- Input validation via Zod schemas
- Rate limiting per client identifier
- Request timeout enforcement
- Memory usage monitoring and cleanup
- Error information sanitization