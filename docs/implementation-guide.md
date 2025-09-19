# Historical Financial Data Cache - Implementation Guide

## Quick Start

This guide will help you implement the historical financial data caching system in your VFR API platform.

## Prerequisites

1. PostgreSQL 13+ installed and running
2. Node.js 18+ with TypeScript support
3. Environment variables configured
4. API keys for financial data providers

## Step 1: Database Setup

### 1.1 Install and Configure PostgreSQL

```bash
# macOS (using Homebrew)
brew install postgresql
brew services start postgresql

# Create database and user
createdb vfr_api
psql vfr_api -c "CREATE USER vfr_app_role WITH PASSWORD 'your_secure_password';"
psql vfr_api -c "GRANT ALL PRIVILEGES ON DATABASE vfr_api TO vfr_app_role;"
```

### 1.2 Run Database Migrations

```bash
# Run the existing schema first
psql vfr_api -f database/setup-database.sql

# Run the enhanced historical data schema
psql vfr_api -f database/enhanced-historical-data-schema.sql
```

### 1.3 Verify Installation

```sql
-- Connect to database and verify tables
\c vfr_api
\dt

-- Should show tables including:
-- historical_market_data
-- data_sources
-- data_freshness_tracking
-- data_source_conflicts
-- bulk_data_jobs
```

## Step 2: Environment Configuration

### 2.1 Update `.env` File

```bash
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vfr_api
DB_USER=vfr_app_role
DB_PASSWORD=your_secure_password

# Existing API keys (keep your current ones)
POLYGON_API_KEY=your_polygon_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
YAHOO_FINANCE_API_KEY=your_yahoo_key
# ... other API keys
```

### 2.2 Install Required Dependencies

```bash
# Add PostgreSQL client (if not already installed)
npm install pg @types/pg

# Verify existing dependencies are sufficient
npm ls | grep -E "(pg|typescript|zod)"
```

## Step 3: Integration with Existing Services

### 3.1 Update Your Financial Data Service

Edit `/app/services/financial-data/FinancialDataService.ts`:

```typescript
import { financialDataCacheService } from '../database/FinancialDataCacheService'

export class FinancialDataService {
  // ... existing code ...

  /**
   * Enhanced getStockPrice with caching
   */
  async getStockPrice(symbol: string, preferredProvider?: string): Promise<StockData | null> {
    try {
      // Try cache first
      const cachedResponse = await financialDataCacheService.getStockPrice(symbol, preferredProvider)

      if (cachedResponse.freshness > 0.8) {
        return cachedResponse.data[0]
      }
    } catch (error) {
      console.warn('Cache lookup failed, falling back to API:', error)
    }

    // Fallback to existing logic
    const cacheKey = `stock_${symbol.toUpperCase()}`

    // Check in-memory cache first
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    // ... rest of existing implementation
  }

  /**
   * Enhanced getMarketData with caching
   */
  async getMarketData(symbol: string, preferredProvider?: string): Promise<MarketData | null> {
    try {
      // Try database cache first
      const cachedResponse = await financialDataCacheService.getMarketData({
        symbol,
        timeframe: '1d',
        preferredSource: preferredProvider
      })

      if (cachedResponse.freshness > 0.7) {
        const data = cachedResponse.data[0]
        return {
          symbol: data.symbol,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: data.volume,
          timestamp: new Date(data.timestamp).getTime(),
          source: data.primarySource
        }
      }
    } catch (error) {
      console.warn('Cache lookup failed, falling back to API:', error)
    }

    // Fallback to existing implementation
    // ... rest of existing code
  }
}
```

### 3.2 Initialize Services in Your Application

Create or update `/app/services/initialization.ts`:

```typescript
import { financialDataCacheService } from './database/FinancialDataCacheService'
import { databaseMigrationService } from './database/DatabaseMigrationService'

let servicesInitialized = false

export async function initializeServices(): Promise<void> {
  if (servicesInitialized) return

  try {
    console.log('Initializing financial data cache services...')

    // Initialize cache service
    await financialDataCacheService.initialize()

    // Run any pending migrations
    const migrationResult = await databaseMigrationService.runInitialMigration()

    if (!migrationResult.success) {
      throw new Error(`Migration failed: ${migrationResult.message}`)
    }

    servicesInitialized = true
    console.log('Financial data cache system initialized successfully')

  } catch (error) {
    console.error('Failed to initialize services:', error)
    throw error
  }
}

// Call this in your application startup
export { initializeServices }
```

### 3.3 Update Application Entry Point

In your main application file (e.g., `/app/layout.tsx` or startup script):

```typescript
import { initializeServices } from './services/initialization'

// Initialize services when the application starts
if (typeof window === 'undefined') { // Server-side only
  initializeServices().catch(error => {
    console.error('Service initialization failed:', error)
    process.exit(1)
  })
}
```

## Step 4: API Integration

### 4.1 Add the Historical Data Endpoint

The endpoint is already created at `/app/api/historical-data/route.ts`. Test it:

```bash
# Test the endpoint
curl "http://localhost:3000/api/historical-data?symbol=AAPL&timeframe=1d"

# Expected response structure:
{
  "success": true,
  "data": [...],
  "metadata": {
    "symbol": "AAPL",
    "source": "cache", // or "api"
    "cached": true,
    "freshness": 0.95,
    "quality": 0.92,
    "responseTime": 45
  }
}
```

### 4.2 Add Cache Management to Admin Panel

Update your admin API routes to include cache management:

```typescript
// In /app/api/admin/cache/route.ts
import { financialDataCacheService } from '../../../services/database/FinancialDataCacheService'

export async function GET() {
  try {
    const metrics = await financialDataCacheService.getCacheMetrics()
    const health = await financialDataCacheService.healthCheck()

    return NextResponse.json({
      success: true,
      metrics,
      health
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')

    await financialDataCacheService.clearCache(symbol)

    return NextResponse.json({
      success: true,
      message: symbol ? `Cache cleared for ${symbol}` : 'All caches cleared'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

## Step 5: Data Population

### 5.1 Initial Data Backfill

Create a script to populate historical data:

```typescript
// scripts/populate-historical-data.ts
import { databaseMigrationService } from '../app/services/database/DatabaseMigrationService'

async function populateData() {
  try {
    // Define symbols to backfill
    const symbols = [
      // Major tech stocks
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA',
      // Financial sector
      'JPM', 'BAC', 'WFC', 'GS', 'MS',
      // Healthcare
      'JNJ', 'UNH', 'PFE', 'ABBV',
      // Add more symbols as needed
    ]

    const backfillOptions = {
      symbols,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      timeframes: ['1d'], // Start with daily data
      batchSize: 20, // Smaller batches to respect rate limits
      delayBetweenBatches: 2000, // 2 second delay
      preferredSources: ['Polygon', 'Alpha Vantage', 'Yahoo Finance'],
      validateData: true,
      skipExisting: true
    }

    console.log(`Starting backfill for ${symbols.length} symbols...`)

    const result = await databaseMigrationService.backfillHistoricalData(backfillOptions)

    console.log('Backfill completed:', result.message)
    console.log(`Duration: ${result.duration}ms`)
    console.log(`Records processed: ${result.recordsProcessed}`)

    if (result.errors && result.errors.length > 0) {
      console.log('Errors encountered:', result.errors)
    }

  } catch (error) {
    console.error('Backfill failed:', error)
    process.exit(1)
  }
}

// Run the script
populateData().then(() => {
  console.log('Data population completed')
  process.exit(0)
})
```

### 5.2 Run the Population Script

```bash
# Make the script executable
npx tsx scripts/populate-historical-data.ts

# Or add to package.json scripts:
# "populate-data": "tsx scripts/populate-historical-data.ts"
npm run populate-data
```

### 5.3 Monitor Progress

```sql
-- Check data population progress
SELECT
  symbol,
  COUNT(*) as record_count,
  MIN(timestamp) as earliest_date,
  MAX(timestamp) as latest_date,
  primary_source
FROM historical_market_data
WHERE timeframe = '1d'
GROUP BY symbol, primary_source
ORDER BY symbol, primary_source;

-- Check bulk job status
SELECT
  job_name,
  status,
  processed_items,
  total_items,
  ROUND((processed_items::DECIMAL / total_items) * 100, 2) as progress_percent
FROM bulk_data_jobs
ORDER BY created_at DESC;
```

## Step 6: Testing and Validation

### 6.1 Test Cache Performance

```typescript
// test-cache-performance.ts
import { financialDataCacheService } from '../app/services/database/FinancialDataCacheService'

async function testCachePerformance() {
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']

  console.log('Testing cache performance...')

  for (const symbol of symbols) {
    // First request (cache miss)
    const start1 = Date.now()
    const response1 = await financialDataCacheService.getMarketData({
      symbol,
      timeframe: '1d'
    })
    const time1 = Date.now() - start1

    // Second request (cache hit)
    const start2 = Date.now()
    const response2 = await financialDataCacheService.getMarketData({
      symbol,
      timeframe: '1d'
    })
    const time2 = Date.now() - start2

    console.log(`${symbol}:`)
    console.log(`  First request: ${time1}ms (${response1.source})`)
    console.log(`  Second request: ${time2}ms (${response2.source})`)
    console.log(`  Speedup: ${Math.round(time1 / time2)}x`)
  }
}

testCachePerformance()
```

### 6.2 Validate Data Quality

```sql
-- Run data quality assessment
SELECT symbol, source, quality_score, completeness, recommendation
FROM assess_data_quality('AAPL', '1d', '2024-01-01', '2024-12-31');

-- Check for anomalies
SELECT symbol, timestamp, anomaly_type, close_price
FROM historical_market_data
WHERE has_anomaly = true
ORDER BY symbol, timestamp DESC
LIMIT 10;

-- Verify data consistency
SELECT
  symbol,
  COUNT(*) as total_records,
  COUNT(DISTINCT primary_source) as source_count,
  AVG(data_quality_score) as avg_quality
FROM historical_market_data
WHERE timeframe = '1d'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY symbol
ORDER BY avg_quality DESC;
```

## Step 7: Monitoring and Maintenance

### 7.1 Set Up Monitoring

Create a monitoring dashboard endpoint:

```typescript
// /app/api/admin/monitoring/route.ts
import { financialDataCacheService } from '../../../services/database/FinancialDataCacheService'
import { historicalDataService } from '../../../services/database/HistoricalDataService'

export async function GET() {
  try {
    const [metrics, health, sources] = await Promise.all([
      financialDataCacheService.getCacheMetrics(),
      financialDataCacheService.healthCheck(),
      historicalDataService.getDataSources()
    ])

    // Database statistics
    const stats = await historicalDataService.query(`
      SELECT
        (SELECT COUNT(*) FROM historical_market_data) as total_records,
        (SELECT COUNT(DISTINCT symbol) FROM historical_market_data) as unique_symbols,
        (SELECT COUNT(*) FROM historical_market_data WHERE created_at > NOW() - INTERVAL '24 hours') as records_last_24h,
        (SELECT AVG(data_quality_score) FROM historical_market_data WHERE data_quality_score IS NOT NULL) as avg_quality
    `)

    return NextResponse.json({
      success: true,
      metrics,
      health,
      sources: sources.map(s => ({
        name: s.name,
        healthy: s.isHealthy,
        reliability: s.reliabilityScore,
        quality: s.dataQualityRating
      })),
      database: stats[0]
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

### 7.2 Automated Maintenance

Create a maintenance cron job:

```typescript
// scripts/daily-maintenance.ts
import { databaseMigrationService } from '../app/services/database/DatabaseMigrationService'
import { financialDataCacheService } from '../app/services/database/FinancialDataCacheService'

async function runDailyMaintenance() {
  try {
    console.log('Starting daily maintenance...')

    // Run database maintenance
    const maintenanceResult = await databaseMigrationService.runMaintenance({
      cleanupOldData: true,
      cleanupOlderThanDays: 90,
      optimizeIndexes: false, // Weekly task
      updateStatistics: true,
      validateDataIntegrity: false, // Weekly task
      compactTables: false // Weekly task
    })

    console.log('Database maintenance:', maintenanceResult.message)

    // Invalidate stale cache
    const invalidated = await financialDataCacheService.clearAllCaches()
    console.log('Cache maintenance completed')

    // Get performance metrics
    const metrics = await financialDataCacheService.getCacheMetrics()
    console.log('Cache hit rate:', `${(metrics.hitRate * 100).toFixed(1)}%`)
    console.log('Average response time:', `${metrics.avgResponseTime}ms`)

  } catch (error) {
    console.error('Daily maintenance failed:', error)
    process.exit(1)
  }
}

runDailyMaintenance()
```

### 7.3 Schedule Maintenance

```bash
# Add to crontab (run daily at 2 AM)
0 2 * * * cd /path/to/vfr-api && npm run maintenance:daily

# Add scripts to package.json
{
  "scripts": {
    "maintenance:daily": "tsx scripts/daily-maintenance.ts",
    "maintenance:weekly": "tsx scripts/weekly-maintenance.ts",
    "monitoring:report": "tsx scripts/monitoring-report.ts"
  }
}
```

## Troubleshooting Common Issues

### Issue 1: Slow Query Performance

```sql
-- Check for missing indexes
EXPLAIN ANALYZE SELECT * FROM historical_market_data
WHERE symbol = 'AAPL' AND timestamp > '2024-01-01';

-- If you see "Seq Scan", add appropriate indexes
CREATE INDEX IF NOT EXISTS idx_symbol_timestamp
ON historical_market_data(symbol, timestamp);
```

### Issue 2: High Cache Miss Rate

```typescript
// Check cache configuration
const metrics = await financialDataCacheService.getCacheMetrics()
console.log('Cache hit rate:', metrics.hitRate)

// If < 70%, consider:
// 1. Increasing cache TTL
// 2. Pre-warming cache with popular symbols
// 3. Adjusting cache strategies
```

### Issue 3: Data Quality Issues

```sql
-- Find data quality problems
SELECT
  symbol,
  primary_source,
  COUNT(*) as issues,
  AVG(data_quality_score) as avg_quality
FROM historical_market_data
WHERE data_quality_score < 0.8 OR has_anomaly = true
GROUP BY symbol, primary_source
ORDER BY issues DESC;
```

### Issue 4: Database Connection Issues

```typescript
// Check database health
const health = await financialDataCacheService.healthCheck()
if (!health.database) {
  console.error('Database connection failed')
  // Check connection string, credentials, network connectivity
}
```

## Performance Optimization Tips

1. **Index Optimization**
   - Monitor slow query log
   - Create covering indexes for frequent queries
   - Drop unused indexes to improve write performance

2. **Connection Pooling**
   - Use appropriate pool size (start with 20)
   - Monitor connection usage
   - Set reasonable timeouts

3. **Cache Strategy**
   - Tune TTL based on usage patterns
   - Implement cache warming for popular symbols
   - Use lazy loading for less frequent data

4. **Query Optimization**
   - Use prepared statements
   - Implement pagination for large result sets
   - Batch operations when possible

5. **Data Archival**
   - Archive old minute-level data after 30 days
   - Keep daily data for 2+ years
   - Use table partitioning for large datasets

This implementation guide should get you up and running with the historical financial data caching system. The key is to start simple and gradually optimize based on your actual usage patterns and performance requirements.