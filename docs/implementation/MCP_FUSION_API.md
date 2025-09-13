# MCP Fusion API Reference

## executeWithFusion()

Enhanced MCP client method for multi-source data fusion.

### Syntax
```typescript
mcpClient.executeWithFusion<T>(
  toolName: string,
  params: Record<string, any>,
  options: FusionOptions
): Promise<FusedMCPResponse<T>>
```

### Parameters

#### toolName: string
MCP tool identifier. Examples:
- `'get_ticker_details'`
- `'get_historical_stock_prices'`
- `'get_options_chain'`
- `'financial_statements'`

#### params: Record<string, any>
Tool parameters:
```typescript
{ ticker: 'AAPL' }
{ symbol: 'MSFT', period: 'annual' }
```

#### options: FusionOptions
```typescript
{
  sources?: string[]                    // ['polygon', 'alphavantage', 'yahoo']
  strategy?: ConflictResolutionStrategy // 'highest_quality' (default)
  validateData?: boolean                // true (default)
  requireConsensus?: boolean            // false (default)
  minQualityScore?: number              // 0.5 (default)
  timeout?: number                      // 10000ms (default)
  parallel?: boolean                    // true (default)
  cacheFusion?: boolean                 // true (default)
  includeMetadata?: boolean             // true (default)
}
```

### Response

```typescript
{
  success: boolean
  data?: T
  error?: string
  source: string                        // Primary source used
  timestamp: number
  cached?: boolean
  fusion?: {
    sources: string[]                   // All contributing sources
    primarySource: string
    qualityScore: QualityScore
    conflicts: number
    resolutionStrategy: string
    validationResult?: ValidationResult
    fusionTimestamp: number
    cacheTTL?: number
  }
}
```

### Examples

#### Basic Fusion
```typescript
const result = await mcpClient.executeWithFusion('get_ticker_details',
  { ticker: 'AAPL' }
)
// Uses all available sources with highest quality strategy
```

#### Custom Configuration
```typescript
const result = await mcpClient.executeWithFusion('get_historical_stock_prices',
  { symbol: 'AAPL', period: '1y' },
  {
    sources: ['yahoo', 'alphavantage'],
    strategy: ConflictResolutionStrategy.WEIGHTED_AVERAGE,
    minQualityScore: 0.8,
    requireConsensus: true
  }
)
```

#### Price Validation
```typescript
const result = await mcpClient.executeWithFusion('get_aggs',
  { ticker: 'AAPL', multiplier: 1, timespan: 'day', from: '2023-01-01', to: '2023-12-31' },
  {
    validateData: true,
    strategy: ConflictResolutionStrategy.CONSENSUS
  }
)

if (!result.fusion?.validationResult?.isValid) {
  console.log('Price discrepancies detected:', result.fusion.validationResult.discrepancies)
}
```

## Quality Score Structure

```typescript
interface QualityScore {
  overall: number                       // 0-1 weighted composite score
  metrics: {
    freshness: number                   // Data recency (0-1)
    completeness: number                // Field availability (0-1)
    accuracy: number                    // Cross-validation result (0-1)
    sourceReputation: number            // Historical performance (0-1)
    latency: number                     // Response time score (0-1)
  }
  timestamp: number
  source: string
}
```

## Source Capabilities

| Tool | Polygon | Alpha Vantage | Yahoo | FMP |
|------|---------|---------------|--------|-----|
| get_ticker_details | ✅ | ✅ | ✅ | ✅ |
| get_historical_stock_prices | ✅ | ✅ | ✅ | ❌ |
| get_options_chain | ❌ | ❌ | ✅ | ❌ |
| financial_statements | ❌ | ✅ | ✅ | ✅ |
| technical_indicators | ✅ | ✅ | ❌ | ❌ |

## Error Handling

```typescript
try {
  const result = await mcpClient.executeWithFusion('get_ticker_details',
    { ticker: 'INVALID' }
  )

  if (!result.success) {
    console.error('Fusion failed:', result.error)
    return
  }

  if (result.fusion?.conflicts > 0) {
    console.warn(`${result.fusion.conflicts} conflicts resolved using ${result.fusion.resolutionStrategy}`)
  }

} catch (error) {
  console.error('Request failed:', error)
}
```

## Performance Optimization

- Use `parallel: true` for speed (default)
- Set `minQualityScore` to filter low-quality sources
- Enable `cacheFusion` for repeated requests
- Specify `sources` array to limit API calls