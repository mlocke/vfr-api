# Dynamic Stock Selection Algorithm Integration Guide

This guide demonstrates how to integrate the dynamic stock selection algorithms with your existing DataFusionEngine and MCP infrastructure.

## Architecture Overview

The algorithm system consists of these key components:

- **AlgorithmEngine**: Core execution engine that integrates with DataFusionEngine
- **FactorLibrary**: Configurable factor calculations (35+ built-in factors)
- **AlgorithmCache**: Redis-based caching for performance optimization
- **AlgorithmScheduler**: Real-time execution with 30-second refresh cycles
- **AlgorithmConfigManager**: Configuration management with validation and templates
- **PerformanceMonitor**: System monitoring and optimization recommendations

## Integration with DataFusionEngine

```typescript
import { DataFusionEngine } from '../mcp/DataFusionEngine'
import { AlgorithmEngine } from './algorithms/AlgorithmEngine'
import { FactorLibrary } from './algorithms/FactorLibrary'
import { AlgorithmCache } from './algorithms/AlgorithmCache'
import { AlgorithmScheduler } from './algorithms/AlgorithmScheduler'

// Initialize existing DataFusionEngine
const dataFusion = new DataFusionEngine({
  defaultStrategy: 'highest_quality',
  sources: [
    { id: 'polygon', priority: 9, capabilities: ['market_data', 'fundamental_data'] },
    { id: 'alpha_vantage', priority: 8, capabilities: ['market_data', 'technical_data'] },
    { id: 'yahoo_finance', priority: 7, capabilities: ['market_data'] }
  ]
})

// Initialize algorithm components
const factorLibrary = new FactorLibrary()
const cache = new AlgorithmCache({
  redis: {
    host: 'localhost',
    port: 6379,
    db: 1,
    keyPrefix: 'algo:'
  },
  ttl: {
    stockScores: 300,      // 5 minutes
    marketData: 60,        // 1 minute
    fundamentalData: 3600  // 1 hour
  }
})

const algorithmEngine = new AlgorithmEngine(dataFusion, factorLibrary, cache)

const scheduler = new AlgorithmScheduler(
  algorithmEngine,
  cache,
  dataFusion,
  {
    minRefreshInterval: 30,        // 30 seconds minimum
    maxConcurrentAlgorithms: 5,    // Limit concurrent execution
    executionTimeout: 30000,       // 30 second timeout
    enableAdaptiveScheduling: true // Adjust based on market conditions
  }
)
```

## Creating Algorithm Configurations

### Using Configuration Manager

```typescript
import { AlgorithmConfigManager } from './algorithms/AlgorithmConfigManager'
import { AlgorithmType, SelectionCriteria } from './algorithms/types'

const configManager = new AlgorithmConfigManager(factorLibrary, cache)

// Create a momentum-based algorithm
const momentumConfig = await configManager.createConfiguration({
  name: 'High-Momentum Growth',
  description: 'Aggressive momentum strategy for growth stocks',
  type: AlgorithmType.MOMENTUM,
  enabled: true,
  selectionCriteria: SelectionCriteria.SCORE_BASED,

  // Universe constraints
  universe: {
    sectors: ['technology', 'healthcare', 'consumer_discretionary'],
    marketCapMin: 100000000, // $100M minimum
    maxPositions: 25,
    exchanges: ['NYSE', 'NASDAQ']
  },

  // Factor weights (must sum to 1.0)
  weights: [
    { factor: 'momentum_3m', weight: 0.3, enabled: true },
    { factor: 'momentum_1m', weight: 0.25, enabled: true },
    { factor: 'revenue_growth', weight: 0.2, enabled: true },
    { factor: 'rsi_14d', weight: 0.15, enabled: true },
    { factor: 'volatility_30d', weight: 0.1, enabled: true }
  ],

  // Selection parameters
  selection: {
    topN: 20,
    rebalanceFrequency: 86400, // Daily rebalancing (24 hours)
    minHoldingPeriod: 259200   // 3-day minimum hold
  },

  // Risk management
  risk: {
    maxSectorWeight: 0.4,     // Max 40% in any sector
    maxSinglePosition: 0.08,  // Max 8% per stock
    maxTurnover: 1.2          // 120% annual turnover limit
  },

  // Data fusion settings leveraging existing infrastructure
  dataFusion: {
    minQualityScore: 0.7,
    requiredSources: ['polygon', 'alpha_vantage'],
    conflictResolution: 'highest_quality',
    cacheTTL: 300
  }
}, 'user_123')

console.log(`Created algorithm: ${momentumConfig.name} (${momentumConfig.id})`)
```

### Using Templates for Quick Setup

```typescript
// Create from conservative value template
const valueStrategy = await configManager.createFromTemplate(
  'conservative_value',
  'Dividend Value Portfolio',
  {
    universe: { maxPositions: 15 }, // Override template default
    weights: [
      // Add dividend focus to value template
      ...configManager.getTemplates()[0].template.weights,
      { factor: 'dividend_yield', weight: 0.15, enabled: true }
    ]
  },
  'user_123'
)
```

## Scheduling Algorithm Execution

```typescript
// Start the scheduler
scheduler.start()

// Schedule algorithms for execution
await scheduler.scheduleAlgorithm(momentumConfig.id, momentumConfig)
await scheduler.scheduleAlgorithm(valueStrategy.id, valueStrategy)

// Monitor execution via WebSocket
const WebSocket = require('ws')
const ws = new WebSocket('ws://localhost:8080/algorithm-stream')

scheduler.addWebSocketClient(ws)

ws.on('message', (data) => {
  const message = JSON.parse(data)
  console.log(`Algorithm Update:`, message)

  switch (message.type) {
    case 'algorithm_start':
      console.log(`Started: ${message.data.config.name}`)
      break
    case 'selection_update':
      console.log(`Completed: ${message.data.selectionCount} selections`)
      break
    case 'error':
      console.error(`Error: ${message.data.error}`)
      break
  }
})
```

## Leveraging Existing MCP Infrastructure

### Market Data Integration

The system seamlessly integrates with your existing MCP tools:

```typescript
// The AlgorithmEngine automatically uses your MCP sources:
// - Polygon.io: 53 tools for market data, fundamentals, news
// - Alpha Vantage: 79 tools for technical indicators, fundamentals
// - Yahoo Finance: Price data, historical information

// Data fusion happens automatically based on configuration:
const marketDataFusion = await dataFusion.fuseData([
  { source: 'polygon', data: polygonData, quality: polygonQuality },
  { source: 'alpha_vantage', data: avData, quality: avQuality },
  { source: 'yahoo_finance', data: yahooData, quality: yahooQuality }
], {
  strategy: 'highest_quality',
  minQualityScore: 0.7,
  validateData: true
})
```

### Redis Cache Integration

The algorithm cache layers on top of your existing Redis setup:

```typescript
// Cache structure optimized for financial data patterns:
// algo:market:AAPL -> Market data with 1-minute TTL
// algo:fundamental:AAPL -> Fundamental data with 1-hour TTL
// algo:factor:momentum_3m:AAPL -> Factor calculations with 5-minute TTL
// algo:algorithm:scores:algo123:1234567890 -> Stock scores in 1-minute buckets
// algo:algorithm:selections:algo123:1234567890 -> Selection results in 5-minute buckets

// Performance optimization through intelligent caching:
const cacheStats = await cache.getStatistics()
console.log(`Cache hit rate: ${cacheStats.hitRate}%`)
console.log(`Memory usage: ${cacheStats.memoryUsage}`)
```

## Custom Factor Development

```typescript
// Add custom factors to the factor library
class CustomFactorLibrary extends FactorLibrary {
  async calculateFactor(factorName: string, symbol: string, marketData: any, fundamentalData?: any) {
    // Handle custom factors
    switch (factorName) {
      case 'social_sentiment':
        return this.calculateSocialSentiment(symbol)

      case 'analyst_revision_momentum':
        return this.calculateAnalystRevisions(symbol, fundamentalData)

      case 'options_flow_sentiment':
        return this.calculateOptionsFlow(symbol)

      default:
        // Fall back to built-in factors
        return super.calculateFactor(factorName, symbol, marketData, fundamentalData)
    }
  }

  private async calculateSocialSentiment(symbol: string): Promise<number> {
    // Integrate with social media APIs
    // Return sentiment score 0-1
    return 0.6
  }
}
```

## Performance Monitoring Integration

```typescript
import { PerformanceMonitor } from './algorithms/PerformanceMonitor'

const monitor = new PerformanceMonitor({
  // Financial system optimized thresholds
  executionTimeWarning: 10000,    // 10s for algorithm execution
  executionTimeCritical: 30000,   // 30s critical threshold
  dataQualityWarning: 0.7,        // 70% data quality minimum
  dataQualityCritical: 0.5,       // 50% critical threshold
  cacheHitRateWarning: 80,        // 80% cache hit rate target
  apiErrorRateWarning: 5          // 5% API error tolerance
})

// Start monitoring with 30-second intervals (matching refresh cycle)
monitor.start(30000)

// React to performance issues
monitor.on('alert', (alert) => {
  console.warn(`Performance Alert: ${alert.title}`)

  if (alert.severity === 'critical') {
    // Implement automatic remediation
    if (alert.metric === 'executionTime') {
      // Reduce algorithm complexity or increase timeout
      scheduler.pauseAlgorithm(alert.algorithmId!)
    } else if (alert.metric === 'dataQuality') {
      // Switch to backup data sources
      dataFusion.updateSourcePriorities({ 'backup_source': 10 })
    }
  }
})

// Get optimization recommendations
monitor.on('recommendation', (rec) => {
  console.log(`Optimization Recommendation: ${rec.title}`)
  console.log(`Impact: ${rec.impact}`)
  console.log(`Steps:`, rec.implementationSteps)
})
```

## Database Schema Integration

The algorithm schema integrates with your existing financial database:

```sql
-- Ensure TimescaleDB extension for time-series optimization
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Import algorithm schema
\i database/schema/algorithm_schema.sql

-- Create sample algorithm configuration
INSERT INTO algorithm_configurations (
  name, algorithm_type, universe_config, weights_config,
  selection_config, risk_config, data_fusion_config, created_by
) VALUES (
  'Sample Momentum Strategy',
  'momentum',
  '{"sectors": ["technology"], "maxPositions": 25, "marketCapMin": 1000000000}',
  '[{"factor": "momentum_3m", "weight": 0.4, "enabled": true}]',
  '{"topN": 20, "rebalanceFrequency": 86400}',
  '{"maxSectorWeight": 0.3, "maxSinglePosition": 0.08}',
  '{"minQualityScore": 0.7, "requiredSources": ["polygon", "alpha_vantage"]}',
  'system'
);

-- Query algorithm performance
SELECT
  ac.name,
  ap.annualized_return,
  ap.sharpe_ratio,
  ap.max_drawdown
FROM algorithm_configurations ac
JOIN algorithm_performance ap ON ac.id = ap.algorithm_id
WHERE ac.enabled = true
ORDER BY ap.sharpe_ratio DESC;
```

## Real-Time WebSocket API

```typescript
import express from 'express'
import WebSocket from 'ws'
import { createServer } from 'http'

const app = express()
const server = createServer(app)
const wss = new WebSocket.Server({ server })

// WebSocket endpoint for real-time algorithm updates
wss.on('connection', (ws) => {
  console.log('Client connected to algorithm stream')

  // Add client to scheduler for updates
  scheduler.addWebSocketClient(ws)

  // Send current status
  ws.send(JSON.stringify({
    type: 'status',
    data: scheduler.getStatus()
  }))
})

// REST API endpoints
app.get('/api/algorithms', async (req, res) => {
  const algorithms = await configManager.listConfigurations()
  res.json(algorithms)
})

app.get('/api/algorithms/:id/performance', async (req, res) => {
  const performance = monitor.getAlgorithmPerformance(req.params.id)
  res.json(performance)
})

app.post('/api/algorithms/:id/execute', async (req, res) => {
  try {
    await scheduler.forceExecuteAlgorithm(req.params.id)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

server.listen(8080, () => {
  console.log('Algorithm API server running on port 8080')
})
```

## Testing and Validation

```typescript
import { AlgorithmValidation } from './algorithms/types'

// Validate algorithm configuration
const validation: AlgorithmValidation = await configManager.validateConfiguration(momentumConfig)

if (!validation.configValidation.isValid) {
  console.error('Configuration errors:', validation.configValidation.errors)
  console.warn('Configuration warnings:', validation.configValidation.warnings)
} else {
  console.log('Configuration is valid!')

  if (validation.backtest) {
    console.log('Backtest results:')
    console.log(`Total Return: ${(validation.backtest.performance.returns.total * 100).toFixed(2)}%`)
    console.log(`Sharpe Ratio: ${validation.backtest.performance.returns.sharpe.toFixed(2)}`)
    console.log(`Max Drawdown: ${(validation.backtest.performance.returns.maxDrawdown * 100).toFixed(2)}%`)
  }
}

// Test factor calculations
const testStockData = {
  symbol: 'AAPL',
  price: 150.00,
  volume: 50000000,
  marketCap: 2500000000000,
  sector: 'Technology',
  exchange: 'NASDAQ',
  timestamp: Date.now()
}

const testFundamentalData = {
  symbol: 'AAPL',
  peRatio: 25.5,
  pbRatio: 12.8,
  debtToEquity: 1.73,
  roe: 0.61,
  revenueGrowth: 0.08
}

// Test individual factors
const momentumScore = await factorLibrary.calculateFactor(
  'momentum_3m',
  'AAPL',
  testStockData,
  testFundamentalData
)
console.log(`3-month momentum score for AAPL: ${momentumScore}`)

// Test composite factors
const qualityScore = await factorLibrary.calculateFactor(
  'quality_composite',
  'AAPL',
  testStockData,
  testFundamentalData
)
console.log(`Quality composite score for AAPL: ${qualityScore}`)
```

## Production Deployment Considerations

### Environment Configuration

```typescript
// Production configuration with environment variables
const productionConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_ALGO_DB || '1'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'algo:',
    maxRetries: 3,
    retryDelayOnFailover: 1000
  },
  scheduler: {
    minRefreshInterval: 30,
    maxConcurrentAlgorithms: parseInt(process.env.MAX_CONCURRENT_ALGOS || '10'),
    executionTimeout: parseInt(process.env.ALGO_TIMEOUT || '60000'),
    enableAdaptiveScheduling: process.env.ADAPTIVE_SCHEDULING !== 'false'
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    alertWebhook: process.env.ALERT_WEBHOOK_URL,
    metricsRetention: parseInt(process.env.METRICS_RETENTION_HOURS || '168') // 1 week
  }
}
```

### High Availability Setup

```typescript
// Multi-instance deployment with Redis Cluster
const cluster = require('cluster')
const numCPUs = require('os').cpus().length

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`)

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`)
    cluster.fork() // Restart failed worker
  })
} else {
  // Worker processes run the algorithm system
  const algorithmSystem = new AlgorithmSystem(productionConfig)
  algorithmSystem.start()

  console.log(`Worker ${process.pid} started`)
}
```

## Key Integration Benefits

1. **Seamless Data Fusion**: Leverages your existing 132+ MCP tools across Polygon.io, Alpha Vantage, and Yahoo Finance
2. **Quality-First Approach**: Built-in data quality scoring and conflict resolution using your DataFusionEngine
3. **Performance Optimized**: Redis caching strategy designed for financial data patterns with sub-second response times
4. **Real-Time Execution**: 30-second refresh cycles with adaptive scheduling based on market conditions
5. **Extensible Factor Library**: 35+ built-in factors with easy custom factor development
6. **Financial-Grade Monitoring**: Performance monitoring optimized for trading system requirements
7. **Database Integration**: TimescaleDB-optimized schema for time-series financial data
8. **Risk Management**: Built-in position sizing, sector limits, and turnover controls

The system is designed to scale with your existing infrastructure while providing the sophisticated algorithms needed for dynamic stock selection in modern financial markets.