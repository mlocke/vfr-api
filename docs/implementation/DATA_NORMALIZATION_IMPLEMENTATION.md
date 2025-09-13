# Data Normalization Pipeline Implementation Guide

## Overview

The Data Normalization Pipeline provides a comprehensive system for normalizing, validating, and monitoring financial data from multiple MCP sources. It ensures data quality, tracks lineage, and provides unified data formats across all financial intelligence operations.

## Architecture Components

### Core Components

1. **DataNormalizationPipeline** - Main orchestrator
2. **DataTransformationLayer** - Handles source-specific transformations
3. **DataValidationEngine** - Validates normalized data
4. **DataQualityMonitor** - Tracks quality metrics and trends
5. **DataLineageTracker** - Tracks data flow and transformations

### Data Flow

```
Raw MCP Data → Transformation → Validation → Quality Scoring → Unified Data
                    ↓              ↓             ↓
               Lineage Tracking ← Quality Monitoring ← Alerts
```

## Supported Data Types

### 1. Stock Price Data (UnifiedStockPrice)
- Sources: Polygon, Alpha Vantage, Yahoo Finance
- Fields: open, high, low, close, volume, timestamp, adjustedClose
- Validation: Price ranges, volume consistency, timestamp freshness

### 2. Company Information (UnifiedCompanyInfo)
- Sources: FMP, Yahoo Finance, Polygon
- Fields: name, exchange, marketCap, sector, industry, description
- Validation: Symbol format, market cap range, employee count

### 3. Financial Statements (UnifiedFinancialStatement)
- Sources: FMP, Yahoo Finance, Alpha Vantage
- Fields: revenue, netIncome, eps, totalAssets, totalLiabilities, totalEquity
- Validation: Balance sheet equation, profit margins, fiscal periods

### 4. Technical Indicators (UnifiedTechnicalIndicator)
- Sources: Alpha Vantage, Polygon
- Fields: indicator type, value/values, timestamp, parameters
- Validation: Indicator-specific ranges (RSI 0-100, etc.)

### 5. News Items (UnifiedNewsItem)
- Sources: Alpha Vantage, Firecrawl, Yahoo Finance
- Fields: title, description, url, publishedAt, sentiment, symbols
- Validation: URL format, sentiment ranges, timestamp freshness

## Implementation Guide

### Basic Setup

```typescript
import { DataNormalizationPipeline } from '../services/mcp/DataNormalizationPipeline'

// Initialize with default configuration
const pipeline = DataNormalizationPipeline.getInstance()

// Or with custom configuration
const customPipeline = new DataNormalizationPipeline({
  enableValidation: true,
  enableQualityChecking: true,
  enableLineageTracking: true,
  validationThresholds: {
    stockPrice: {
      priceVariance: 0.05, // 5% max variance
      volumeVariance: 0.20, // 20% max variance
      timestampTolerance: 300000, // 5 minutes
      requiredFields: ['symbol', 'close', 'timestamp']
    }
  },
  qualityThresholds: {
    overall: 0.7, // 70% minimum quality
    freshness: 0.8,
    completeness: 0.9,
    accuracy: 0.8,
    sourceReputation: 0.6,
    latency: 5000 // 5 seconds max
  }
})
```

### Single Data Type Normalization

```typescript
// Normalize stock price data
const priceResult = await pipeline.normalizeStockPrice(
  polygonRawData,
  'polygon',
  'AAPL'
)

if (priceResult.success) {
  const unifiedPrice = priceResult.data
  console.log('Quality Score:', priceResult.qualityScore.overall)
  console.log('Processing Time:', priceResult.processingTime, 'ms')
  console.log('Transformations:', priceResult.lineageInfo.transformations.length)
} else {
  console.error('Normalization failed:', priceResult.errors)
}
```

### Batch Normalization

```typescript
// Process multiple data types for a symbol
const requests = [
  {
    type: 'stock_price' as const,
    rawData: polygonPriceData,
    source: 'polygon',
    symbol: 'AAPL'
  },
  {
    type: 'company_info' as const,
    rawData: fmpCompanyData,
    source: 'fmp',
    symbol: 'AAPL'
  },
  {
    type: 'financial_statement' as const,
    rawData: fmpFinancialData,
    source: 'fmp',
    symbol: 'AAPL'
  },
  {
    type: 'technical_indicator' as const,
    rawData: alphaVantageRSI,
    source: 'alphavantage',
    symbol: 'AAPL',
    indicator: 'RSI'
  }
]

const batchResult = await pipeline.batchNormalize(requests)

console.log('Batch Summary:', batchResult.summary)
// {
//   totalProcessed: 4,
//   successful: 3,
//   failed: 1,
//   avgProcessingTime: 45,
//   avgQualityScore: 0.85
// }
```

### Integration with MCPClient

```typescript
import { mcpClient } from '../services/mcp/MCPClient'
import { dataNormalizationPipeline } from '../services/mcp/DataNormalizationPipeline'

// Enhanced MCP client method with normalization
async function getUnifiedStockDataWithNormalization(symbol: string) {
  try {
    // Fetch raw data from MCP
    const rawPriceData = await mcpClient.executeTool('get_aggs', {
      ticker: symbol,
      multiplier: 1,
      timespan: 'day',
      from_: '2023-01-01',
      to: '2023-12-31'
    })

    if (!rawPriceData.success) {
      throw new Error(`MCP call failed: ${rawPriceData.error}`)
    }

    // Normalize the data
    const normalizationResult = await dataNormalizationPipeline.normalizeStockPrice(
      rawPriceData.data,
      rawPriceData.source,
      symbol
    )

    if (!normalizationResult.success) {
      throw new Error(`Normalization failed: ${normalizationResult.errors?.join(', ')}`)
    }

    return {
      price: normalizationResult.data,
      quality: normalizationResult.qualityScore,
      lineage: normalizationResult.lineageInfo,
      processingTime: normalizationResult.processingTime
    }
  } catch (error) {
    console.error('Error getting unified stock data:', error)
    throw error
  }
}
```

## Validation Configuration

### Custom Validation Rules

```typescript
import { DataValidationEngine } from '../services/mcp/DataValidationEngine'

// Add custom validation rule
const validationEngine = new DataValidationEngine(thresholds)

validationEngine.addValidationRule('stock_price', {
  name: 'market_hours_check',
  field: 'timestamp',
  validator: (timestamp) => {
    const date = new Date(timestamp)
    const hour = date.getHours()
    const day = date.getDay()
    // Check if during market hours (9:30 AM - 4:00 PM EST, weekdays)
    return day >= 1 && day <= 5 && hour >= 9 && hour < 16
  },
  severity: 'warning',
  message: 'Stock price data outside market hours'
})
```

### Validation Thresholds

```typescript
const customThresholds = {
  stockPrice: {
    priceVariance: 0.03, // 3% max variance between OHLC
    volumeVariance: 0.15, // 15% max volume variance
    timestampTolerance: 180000, // 3 minutes
    requiredFields: ['symbol', 'close', 'volume', 'timestamp']
  },
  companyInfo: {
    requiredFields: ['symbol', 'name', 'exchange'],
    marketCapVariance: 0.08, // 8% variance
    nameMatchThreshold: 0.9 // 90% name similarity
  },
  financialStatement: {
    revenueVariance: 0.02, // 2% max variance
    requiredFields: ['symbol', 'period', 'fiscalYear', 'revenue'],
    periodValidation: true // Validate fiscal periods
  },
  technicalIndicator: {
    valueVariance: 0.05, // 5% variance
    timestampTolerance: 300000, // 5 minutes
    requiredFields: ['symbol', 'indicator', 'value', 'timestamp']
  },
  newsItem: {
    requiredFields: ['title', 'url', 'publishedAt', 'source'],
    sentimentVariance: 0.2, // 20% sentiment variance
    timestampTolerance: 86400000 // 24 hours
  }
}
```

## Quality Monitoring

### Quality Metrics Tracking

```typescript
import { DataQualityMonitor } from '../services/mcp/DataQualityMonitor'

// Get quality statistics
const qualityStats = pipeline.getStatistics().quality

console.log('Overall Quality:', qualityStats.averageQualityScore)
console.log('Source Performance:', qualityStats.sourcePerformance)
console.log('Data Type Performance:', qualityStats.dataTypePerformance)

// Generate comprehensive quality report
const qualityReport = qualityMonitor.generateQualityReport()

console.log('Quality Summary:', qualityReport.summary)
console.log('Active Alerts:', qualityReport.alerts.length)
console.log('Quality Trends:', qualityReport.trends.length)
console.log('Recommendations:', qualityReport.recommendations)
```

### Quality Alerts

```typescript
// Get active quality alerts
const activeAlerts = qualityMonitor.getActiveAlerts()

activeAlerts.forEach(alert => {
  console.log(`${alert.severity.toUpperCase()}: ${alert.message}`)
  console.log(`Source: ${alert.source}, Data Type: ${alert.dataType}`)
  console.log(`Current: ${alert.currentValue}, Threshold: ${alert.threshold}`)
})

// Resolve an alert
qualityMonitor.resolveAlert(alert.id)
```

## Lineage Tracking

### Query Data Lineage

```typescript
import { DataLineageTracker } from '../services/mcp/DataLineageTracker'

const lineageTracker = new DataLineageTracker()

// Query lineage by source
const polygonLineage = lineageTracker.queryLineage({
  sourceId: 'polygon',
  timeRange: {
    start: Date.now() - 86400000, // Last 24 hours
    end: Date.now()
  },
  includeTransformations: true,
  includeValidations: true,
  includeQualityChecks: true
})

// Query lineage by symbol
const appleLineage = lineageTracker.queryLineage({
  symbol: 'AAPL',
  dataType: 'stock_price'
})

// Get lineage graph for visualization
const lineageGraph = lineageTracker.getLineageGraph({
  sourceId: 'polygon',
  timeRange: { start: Date.now() - 3600000, end: Date.now() }
})
```

### Export Lineage Data

```typescript
// Export as JSON
const jsonExport = lineageTracker.exportLineageData('json')

// Export as CSV
const csvExport = lineageTracker.exportLineageData('csv')

// Save to file
import { writeFileSync } from 'fs'
writeFileSync('lineage-export.json', jsonExport)
writeFileSync('lineage-export.csv', csvExport)
```

## Performance Optimization

### Configuration for Performance

```typescript
const performanceConfig = {
  enableValidation: true, // Keep validation for data quality
  enableQualityChecking: false, // Disable for high-throughput scenarios
  enableLineageTracking: false, // Disable for minimal overhead
  validationThresholds: {
    // Relaxed thresholds for faster validation
    stockPrice: {
      priceVariance: 0.10,
      volumeVariance: 0.30,
      timestampTolerance: 600000,
      requiredFields: ['symbol', 'close'] // Minimal required fields
    }
  }
}

const fastPipeline = new DataNormalizationPipeline(performanceConfig)
```

### Batch Processing for High Volume

```typescript
// Process large batches efficiently
async function processLargeDataset(symbols: string[]) {
  const BATCH_SIZE = 50
  const results = []

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE)

    const batchRequests = batch.map(symbol => ({
      type: 'stock_price' as const,
      rawData: await fetchRawData(symbol),
      source: 'polygon',
      symbol
    }))

    const batchResult = await pipeline.batchNormalize(batchRequests)
    results.push(...batchResult.results)

    // Optional: Add delay to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}
```

## Error Handling

### Comprehensive Error Handling

```typescript
async function robustNormalization(rawData: any, source: string, symbol: string) {
  try {
    const result = await pipeline.normalizeStockPrice(rawData, source, symbol)

    if (!result.success) {
      // Log validation errors
      if (result.validationResult.discrepancies.length > 0) {
        console.warn('Validation issues:', result.validationResult.discrepancies)
      }

      // Log processing errors
      if (result.errors) {
        console.error('Processing errors:', result.errors)
      }

      return null
    }

    // Check quality score
    if (result.qualityScore.overall < 0.5) {
      console.warn(`Low quality score: ${result.qualityScore.overall}`)
    }

    return result.data
  } catch (error) {
    console.error('Normalization failed:', error)

    // Fallback to basic transformation without validation
    try {
      return DataTransformationLayer.transformStockPrice(
        rawData,
        source,
        symbol,
        { overall: 0.5, metrics: { freshness: 0, completeness: 0, accuracy: 0, sourceReputation: 0, latency: 0 }, timestamp: Date.now(), source }
      )
    } catch (fallbackError) {
      console.error('Fallback transformation failed:', fallbackError)
      return null
    }
  }
}
```

## Testing

### Unit Testing

```typescript
// Test individual components
describe('DataNormalizationPipeline', () => {
  it('should normalize Polygon stock price data', async () => {
    const pipeline = new DataNormalizationPipeline()
    const mockData = { /* mock Polygon data */ }

    const result = await pipeline.normalizeStockPrice(mockData, 'polygon', 'AAPL')

    expect(result.success).toBe(true)
    expect(result.data.symbol).toBe('AAPL')
    expect(result.qualityScore.overall).toBeGreaterThan(0)
  })
})
```

### Integration Testing

```typescript
// Test complete workflow
it('should process complete symbol data workflow', async () => {
  const pipeline = new DataNormalizationPipeline()

  // Test all data types for a symbol
  const requests = [/* stock price, company info, financials, technicals */]
  const result = await pipeline.batchNormalize(requests)

  expect(result.summary.totalProcessed).toBe(4)
  expect(result.summary.successful).toBeGreaterThan(2)

  // Verify lineage tracking
  const stats = pipeline.getStatistics()
  expect(stats.lineage.totalOperations).toBe(4)
})
```

## Production Deployment

### Environment Configuration

```typescript
// production.config.ts
export const productionConfig = {
  enableValidation: true,
  enableQualityChecking: true,
  enableLineageTracking: true,
  validationThresholds: {
    // Production-ready thresholds
    stockPrice: { priceVariance: 0.05, volumeVariance: 0.20, timestampTolerance: 300000, requiredFields: ['symbol', 'close', 'timestamp'] },
    companyInfo: { requiredFields: ['symbol', 'name'], marketCapVariance: 0.10, nameMatchThreshold: 0.8 },
    financialStatement: { revenueVariance: 0.05, requiredFields: ['symbol', 'period', 'fiscalYear'], periodValidation: true },
    technicalIndicator: { valueVariance: 0.10, timestampTolerance: 300000, requiredFields: ['symbol', 'indicator', 'value'] },
    newsItem: { requiredFields: ['title', 'url', 'publishedAt'], sentimentVariance: 0.3, timestampTolerance: 86400000 }
  },
  qualityThresholds: {
    overall: 0.7,
    freshness: 0.8,
    completeness: 0.9,
    accuracy: 0.8,
    sourceReputation: 0.6,
    latency: 5000
  }
}
```

### Monitoring and Alerting

```typescript
// Set up quality monitoring
setInterval(async () => {
  const qualityReport = pipeline.getStatistics().quality

  // Check for critical quality issues
  if (qualityReport.averageQualityScore < 0.5) {
    await sendAlert('CRITICAL: Data quality below threshold', qualityReport)
  }

  // Check for source failures
  Object.entries(qualityReport.sourcePerformance).forEach(([source, stats]) => {
    if (stats.averageScore < 0.6) {
      console.warn(`Quality issue with ${source}: ${stats.averageScore}`)
    }
  })
}, 60000) // Check every minute
```

## Best Practices

1. **Configure appropriate thresholds** for your use case
2. **Monitor quality metrics** regularly and adjust thresholds
3. **Use batch processing** for high-volume operations
4. **Implement proper error handling** with fallbacks
5. **Track lineage** for debugging and compliance
6. **Test thoroughly** with real data from all sources
7. **Monitor performance** and optimize for your workload
8. **Set up alerting** for quality issues and failures

## Conclusion

The Data Normalization Pipeline provides a robust foundation for ensuring data quality and consistency across your MCP financial intelligence platform. By following this implementation guide, you can achieve reliable, high-quality data normalization with comprehensive monitoring and validation.