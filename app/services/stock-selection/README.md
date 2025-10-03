# Stock Selection Service

Flexible stock analysis service supporting single stock, sector, and multi-stock analysis modes.

## Architecture

```
StockSelectionService
├── types.ts                    # Core TypeScript interfaces
├── StockSelectionService.ts    # Main service class
├── config/
│   └── SelectionConfig.ts      # Configuration system
└── integration/
    ├── AlgorithmIntegration.ts # Algorithm engine interface
    └── SectorIntegration.ts    # Sector analysis interface
```

## Key Features

- **Multiple Analysis Modes**: Single stock, sector analysis, multi-stock portfolio
- **Algorithm Integration**: Seamless integration with AlgorithmEngine
- **Sector Support**: Full sector classification and analysis
- **Data Fusion**: Multi-source data quality and conflict resolution
- **Caching**: Intelligent caching with configurable TTL
- **Real-time Options**: Support for real-time vs cached data preferences
- **Error Handling**: Comprehensive error handling and fallback mechanisms

## Usage Examples

```typescript
import { StockSelectionService, SelectionMode } from "./StockSelectionService";

// Single stock analysis
const singleStockRequest = {
	scope: {
		mode: SelectionMode.SINGLE_STOCK,
		symbols: ["AAPL"],
	},
	options: {
		useRealTimeData: true,
		includeSentiment: true,
	},
};

// Sector analysis
const sectorRequest = {
	scope: {
		mode: SelectionMode.SECTOR_ANALYSIS,
		sector: { id: "technology", label: "Technology", category: "sector" },
		maxResults: 20,
	},
	options: {
		algorithmId: "momentum",
		riskTolerance: "moderate",
	},
};

// Multi-stock portfolio analysis
const portfolioRequest = {
	scope: {
		mode: SelectionMode.MULTIPLE_STOCKS,
		symbols: ["AAPL", "GOOGL", "MSFT", "AMZN"],
	},
};

// Execute analysis
const service = new StockSelectionService(financialDataService, dataFusion, factorLibrary, cache);
const result = await service.selectStocks(singleStockRequest);
```

## Configuration

Environment-based configuration with production-ready defaults:

```typescript
// Development
{
  cache: { enabled: true, ttl: { singleStock: 120000 } },
  limits: { maxSymbolsPerRequest: 20 },
  quality: { minDataQuality: 0.5 }
}

// Production
{
  cache: { enabled: true, ttl: { singleStock: 600000 } },
  limits: { maxSymbolsPerRequest: 100 },
  quality: { minDataQuality: 0.8 }
}
```

## Integration Points

- **AlgorithmEngine**: Core stock scoring and selection algorithms
- **DataFusionEngine**: Multi-source data quality and fusion
- **SectorDropdown**: UI component for sector selection
- **FinancialDataService**: Direct API integration with financial data providers
- **RedisCache**: High-performance caching layer

## Response Format

```typescript
{
  success: true,
  requestId: "req_123",
  executionTime: 1500,

  // Mode-specific results
  singleStock?: EnhancedStockResult,
  sectorAnalysis?: SectorAnalysisResult,
  multiStockAnalysis?: MultiStockAnalysisResult,

  // Unified top selections
  topSelections: EnhancedStockResult[],

  // Execution metadata
  metadata: {
    algorithmUsed: "composite",
    dataSourcesUsed: ["polygon", "fmp", "yahoo"],
    qualityScore: 0.85
  }
}
```

## Error Handling

- Automatic fallback to secondary algorithms
- Graceful degradation with partial results
- Comprehensive error reporting and logging
- Request timeout and cancellation support

## Performance Features

- Intelligent caching with cache hit tracking
- Parallel data fetching where possible
- Request deduplication and batching
- Configurable timeouts and limits
- Health monitoring and statistics
