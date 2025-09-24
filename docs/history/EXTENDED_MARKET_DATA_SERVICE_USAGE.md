# ExtendedMarketDataService Usage Guide

The ExtendedMarketDataService provides advanced trading features including pre/post-market data, bid/ask spread analysis, and liquidity metrics. It follows the established VFR platform patterns and integrates seamlessly with existing services.

## Quick Start

```typescript
import { ExtendedMarketDataService } from '../services/financial-data/ExtendedMarketDataService'
import { PolygonAPI } from '../services/financial-data/PolygonAPI'
import { RedisCache } from '../services/cache/RedisCache'

// Initialize service
const polygonAPI = new PolygonAPI()
const cache = new RedisCache()
const extendedMarketService = new ExtendedMarketDataService(polygonAPI, cache)

// Get comprehensive market data
const extendedData = await extendedMarketService.getExtendedMarketData('AAPL')
```

## Core Features

### 1. Extended Market Data

Get comprehensive data including regular trading, extended hours, and liquidity metrics:

```typescript
const data = await extendedMarketService.getExtendedMarketData('AAPL')

if (data) {
  console.log('Regular Data:', data.regularData.price)
  console.log('Market Status:', data.extendedHours.marketStatus)
  console.log('Pre-market Price:', data.extendedHours.preMarketPrice)
  console.log('Liquidity Score:', data.liquidityMetrics?.liquidityScore)
}
```

### 2. Bid/Ask Spread Analysis

Analyze bid/ask spreads for liquidity assessment:

```typescript
const spread = await extendedMarketService.getBidAskSpread('AAPL')

if (spread) {
  console.log('Bid:', spread.bid)
  console.log('Ask:', spread.ask)
  console.log('Spread %:', spread.spreadPercent)
  console.log('Midpoint:', spread.midpoint)
}
```

### 3. Extended Hours Trading

Get pre-market and after-hours data:

```typescript
const extendedHours = await extendedMarketService.getExtendedHoursData('AAPL')

if (extendedHours) {
  console.log('Market Status:', extendedHours.marketStatus)
  if (extendedHours.preMarketPrice) {
    console.log('Pre-market:', extendedHours.preMarketPrice)
    console.log('Change:', extendedHours.preMarketChangePercent + '%')
  }
}
```

### 4. Batch Liquidity Analysis

Analyze liquidity for multiple symbols efficiently:

```typescript
const symbols = ['AAPL', 'MSFT', 'TSLA']
const liquidityMap = await extendedMarketService.getBatchLiquidityMetrics(symbols)

liquidityMap.forEach((metrics, symbol) => {
  if (metrics) {
    console.log(`${symbol}: Liquidity Score ${metrics.liquidityScore}/10`)
  }
})
```

## Integration with StockSelectionService

### Adding to Constructor

```typescript
import { ExtendedMarketDataService } from '../financial-data/ExtendedMarketDataService'

export class StockSelectionService {
  private extendedMarketService?: ExtendedMarketDataService

  constructor(
    // ... existing parameters
    extendedMarketService?: ExtendedMarketDataService
  ) {
    // ... existing initialization
    this.extendedMarketService = extendedMarketService
  }
}
```

### Integration in Analysis

```typescript
// In your analysis method
private async enhanceWithExtendedMarketData(symbol: string, analysis: any): Promise<any> {
  if (!this.extendedMarketService) return analysis

  try {
    const extendedData = await this.extendedMarketService.getExtendedMarketData(symbol)

    if (extendedData) {
      // Add liquidity score to technical analysis
      const liquidityScore = this.extendedMarketService.calculateExtendedMarketScore(extendedData)

      analysis.technicalScore = (analysis.technicalScore * 0.9) + (liquidityScore * 0.1)

      // Add extended hours insights
      if (extendedData.extendedHours.preMarketChangePercent) {
        analysis.insights.push({
          type: 'extended_hours',
          message: `Pre-market change: ${extendedData.extendedHours.preMarketChangePercent.toFixed(2)}%`,
          impact: Math.abs(extendedData.extendedHours.preMarketChangePercent) > 2 ? 'high' : 'medium'
        })
      }

      // Add liquidity warnings
      if (extendedData.liquidityMetrics?.liquidityScore < 3) {
        analysis.warnings.push({
          type: 'liquidity',
          message: 'Low liquidity detected - wider spreads expected',
          severity: 'medium'
        })
      }
    }
  } catch (error) {
    console.error(`ExtendedMarketData enhancement error for ${symbol}:`, error)
  }

  return analysis
}
```

## Data Types

### ExtendedMarketData
```typescript
interface ExtendedMarketData {
  symbol: string
  regularData: StockData          // Standard stock data
  extendedHours: ExtendedHoursData // Pre/post market data
  bidAskSpread: BidAskSpread | null // Spread analysis
  liquidityMetrics: LiquidityMetrics | null // Liquidity scoring
  timestamp: number
  source: string
}
```

### LiquidityMetrics
```typescript
interface LiquidityMetrics {
  symbol: string
  bidAskSpread: number           // Absolute spread
  spreadPercent: number          // Percentage spread
  averageSpread: number          // Historical average
  spreadVolatility: number       // Spread consistency
  liquidityScore: number         // 0-10 score (10 = most liquid)
  marketMakingActivity: number   // Market maker presence
  timestamp: number
  source: string
}
```

## Performance Considerations

### Caching Strategy
- **Extended Market Data**: 30 seconds TTL
- **Bid/Ask Spreads**: 15 seconds TTL
- **Extended Hours**: 60 seconds TTL

### Rate Limiting
The service respects Polygon API rate limits and handles errors gracefully:

```typescript
// Service handles rate limiting automatically
const data = await extendedMarketService.getExtendedMarketData('AAPL')
// Returns null if rate limited, cached data if available
```

### Memory Management
- Uses existing RedisCache infrastructure
- Implements intelligent cache keys
- Handles partial data availability gracefully

## Error Handling

The service follows VFR error handling patterns:

```typescript
// Always returns null on error, never throws
const data = await extendedMarketService.getExtendedMarketData('INVALID')
if (!data) {
  console.log('No data available or error occurred')
}
```

## Market Status Integration

```typescript
const marketStatus = await extendedMarketService.getMarketStatus()

switch (marketStatus) {
  case 'pre-market':
    // Handle pre-market logic
    break
  case 'market-hours':
    // Handle regular hours logic
    break
  case 'after-hours':
    // Handle after hours logic
    break
  case 'closed':
    // Handle market closed logic
    break
}
```

## Best Practices

1. **Check for null returns**: Always handle cases where data is unavailable
2. **Use appropriate timeframes**: Consider market status when requesting data
3. **Respect rate limits**: Service handles this automatically but be aware
4. **Cache strategy**: Leverage built-in caching for performance
5. **Gradual enhancement**: Add extended data as optional enhancement to existing analysis

## Integration Example

Complete integration example for StockSelectionService:

```typescript
// In StockSelectionService.ts
import { ExtendedMarketDataService } from '../financial-data/ExtendedMarketDataService'

// Add to constructor
constructor(
  // ... existing parameters
  extendedMarketService?: ExtendedMarketDataService
) {
  // ... existing code
  this.extendedMarketService = extendedMarketService
}

// Use in analysis
async analyzeStock(symbol: string): Promise<SelectionResult> {
  // ... existing analysis logic

  // Enhance with extended market data
  if (this.extendedMarketService) {
    const extendedData = await this.extendedMarketService.getExtendedMarketData(symbol)
    if (extendedData) {
      // Add liquidity component to technical score
      const liquidityScore = this.extendedMarketService.calculateExtendedMarketScore(extendedData)
      result.technicalScore = (result.technicalScore * 0.85) + (liquidityScore * 0.15)

      // Add market status insights
      result.insights.push({
        type: 'market_session',
        data: extendedData.extendedHours.marketStatus,
        confidence: 1.0
      })
    }
  }

  return result
}
```

This service provides institutional-grade trading features while maintaining the VFR platform's KISS principles and robust error handling.