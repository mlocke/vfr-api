# MCP Data Fusion Implementation

## Purpose
Multi-source data fusion system for combining financial data from Polygon, Alpha Vantage, Yahoo Finance MCP servers with quality scoring and conflict resolution.

## Architecture

```
app/services/mcp/
├── MCPClient.ts         # Enhanced with executeWithFusion()
├── DataFusionEngine.ts  # Core fusion logic
├── QualityScorer.ts     # Data quality assessment
├── types.ts            # Fusion interfaces and models
└── __tests__/
    └── DataFusion.test.ts
```

## Key Components

### DataFusionEngine
- **Location**: `app/services/mcp/DataFusionEngine.ts`
- **Strategies**: HIGHEST_QUALITY, MOST_RECENT, CONSENSUS, WEIGHTED_AVERAGE
- **Validation**: Cross-source discrepancy detection with configurable thresholds

### QualityScorer
- **Location**: `app/services/mcp/QualityScorer.ts`
- **Metrics**: freshness (0.3), completeness (0.25), accuracy (0.25), reputation (0.15), latency (0.05)
- **Source Defaults**: polygon (0.95), alphavantage (0.85), yahoo (0.75)

### MCPClient Enhancements
- **New Method**: `executeWithFusion<T>(toolName, params, options)`
- **Sources**: polygon, alphavantage, yahoo, fmp, firecrawl
- **Fetching**: Parallel by default, sequential option available

## Usage

```typescript
// Single source (existing)
const result = await mcpClient.executeTool('get_ticker_details',
  { ticker: 'AAPL' }
)

// Multi-source fusion (new)
const fusedResult = await mcpClient.executeWithFusion('get_ticker_details',
  { ticker: 'AAPL' },
  {
    sources: ['polygon', 'alphavantage', 'yahoo'],
    strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
    validateData: true,
    minQualityScore: 0.7,
    parallel: true
  }
)

// Response structure
{
  success: true,
  data: { /* merged data */ },
  fusion: {
    sources: ['polygon', 'alphavantage'],
    qualityScore: { overall: 0.95 },
    conflicts: 2,
    resolutionStrategy: 'highest_quality',
    validationResult: { isValid: true, discrepancies: [] }
  }
}
```

## Configuration

### Fusion Options
```typescript
interface FusionOptions {
  sources?: string[]                          // Default: all applicable
  strategy?: ConflictResolutionStrategy       // Default: highest_quality
  validateData?: boolean                      // Default: true
  requireConsensus?: boolean                  // Default: false
  minQualityScore?: number                    // Default: 0.5
  timeout?: number                            // Default: 10000ms
  parallel?: boolean                          // Default: true
}
```

### Validation Thresholds
- **Price variance**: 0.1%
- **Volume variance**: 5%
- **Market cap variance**: 1%
- **Default variance**: 2%

## Tool-to-Source Mapping

```typescript
'get_ticker_details': ['polygon', 'alphavantage', 'yahoo', 'fmp']
'get_historical_stock_prices': ['yahoo', 'polygon', 'alphavantage']
'get_options_chain': ['yahoo']  // Yahoo exclusive
'financial_statements': ['yahoo', 'fmp', 'alphavantage']
'technical_indicators': ['alphavantage', 'polygon']
```

## Testing

```bash
# Run fusion tests
npm test app/services/mcp/__tests__/DataFusion.test.ts

# Test coverage areas:
- Single/multi-source scenarios
- All resolution strategies
- Data validation logic
- Quality scoring algorithms
- Source reputation updates
```

## Performance

- **Parallel fetching**: ~300ms for 3 sources
- **Quality calculation**: <5ms per source
- **Fusion processing**: <10ms for typical data
- **Cache TTL**: 60 seconds for fused results

## Error Handling

- Low quality sources automatically filtered
- Failed sources excluded from fusion
- Automatic fallback to best available source
- Consensus failure returns detailed validation report