# ESGDataService Usage Guide

## Overview

The ESGDataService provides Environmental, Social, and Governance (ESG) data analysis for stock evaluation, contributing 5% alternative data weight to composite scoring. The service follows the VFR platform patterns with graceful degradation when no API key is available.

## Key Features

- **Graceful Degradation**: Works without API key using realistic baseline defaults
- **Industry Baselines**: Sector-specific ESG score baselines for accurate fallback data
- **5% Weight Integration**: Designed for 5% alternative data contribution to stock analysis
- **Comprehensive Analysis**: Risk factors, insights, and materiality assessments
- **Production Ready**: Follows KISS principles with robust error handling

## Quick Start

```typescript
import ESGDataService from './app/services/financial-data/ESGDataService'

// Initialize service (works with or without API key)
const esgService = new ESGDataService({
  apiKey: process.env.ESG_API_KEY, // Optional
  timeout: 10000,
  throwErrors: false
})

// Analyze ESG impact for a single stock
const esgImpact = await esgService.analyzeStockESGImpact('AAPL', 'technology', 0.75)

if (esgImpact) {
  console.log(`ESG Score: ${esgImpact.esgScore.overall}/100 (${esgImpact.esgScore.grade})`)
  console.log(`Adjusted Score: ${esgImpact.adjustedScore}`)
  console.log(`ESG Weight: ${esgImpact.esgWeight * 100}%`)
}
```

## Bulk Analysis

```typescript
const stocks = [
  { symbol: 'AAPL', sector: 'technology', baseScore: 0.75 },
  { symbol: 'XOM', sector: 'energy', baseScore: 0.65 },
  { symbol: 'JPM', sector: 'financials', baseScore: 0.70 }
]

const bulkResult = await esgService.analyzeBulkESGImpact(stocks)

if (bulkResult.success) {
  console.log(`Average ESG Score: ${bulkResult.data!.averageESGScore}`)
  console.log(`Best ESG: ${bulkResult.data!.highestESGStock}`)
  console.log(`Worst ESG: ${bulkResult.data!.lowestESGStock}`)
}
```

## Stock Analysis Integration

```typescript
// Integration method for stock analysis engine
const esgIntegration = await esgService.getESGImpactForStock('TSLA', 'technology', 0.80)

console.log(`Impact: ${esgIntegration.impact}`) // 'positive', 'negative', or 'neutral'
console.log(`Factors: ${esgIntegration.factors.join(', ')}`)
console.log(`Confidence: ${esgIntegration.confidence}`)
```

## Industry Baselines

The service includes realistic industry baselines for graceful degradation:

- **Technology**: 72 (Generally higher ESG scores)
- **Healthcare**: 68
- **Financials**: 65
- **Energy**: 48 (Traditionally lower ESG scores)
- **Materials**: 52
- **Utilities**: 60

## ESG Score Components

```typescript
interface ESGScore {
  environmental: number // 0-100 score
  social: number       // 0-100 score
  governance: number   // 0-100 score
  overall: number      // 0-100 composite
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  percentile: number   // 0-100 ranking
  timestamp: number
}
```

## Risk Factors Analysis

The service provides comprehensive risk assessment:

- **Controversies**: Level assessment and impact analysis
- **Carbon Footprint**: Emissions tracking and industry comparison
- **Governance**: Board diversity and executive compensation analysis
- **Social**: Workplace safety and community impact metrics

## Health Check

```typescript
const healthCheck = await esgService.healthCheck()

console.log(`Status: ${healthCheck.status}`)
console.log(`API Key Configured: ${healthCheck.details.apiKeyConfigured}`)
console.log(`Fallback Mode: ${healthCheck.details.fallbackMode}`)
```

## Configuration

Environment variables (all optional):

```bash
ESG_API_KEY=your_sustainalytics_api_key  # Optional - service works without it
REDIS_HOST=localhost                      # For caching
REDIS_PORT=6379                          # For caching
```

## Error Handling

The service follows VFR platform error handling patterns:

- Returns `null` for invalid inputs
- Graceful degradation for API failures
- Comprehensive logging with security validation
- Circuit breaker patterns for resilience

## Performance

- **Target Response Time**: <200ms for single stock analysis
- **Cache Strategy**: 4-hour TTL for ESG data (changes slowly)
- **Memory Optimization**: Compatible with platform memory constraints
- **Batch Processing**: Efficient handling of multiple stock analysis

## Testing

Comprehensive test suite included:

```bash
npm test -- ESGDataService.test.ts
```

Tests cover:
- Service initialization (with/without API key)
- ESG score generation and validation
- Industry baseline accuracy
- Security validation
- Cache integration
- Performance targets
- Error handling and resilience