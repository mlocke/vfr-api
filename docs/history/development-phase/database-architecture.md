# Historical Financial Data Database Architecture

## Overview

This document describes the comprehensive database architecture designed for caching historical financial data from multiple APIs (Polygon, Alpha Vantage, Yahoo Finance, etc.) to reduce API calls and improve performance for the VFR API platform.

## Architecture Components

### 1. Database Choice: PostgreSQL

**Why PostgreSQL?**
- Excellent time-series data handling with optional TimescaleDB extension
- Advanced indexing capabilities (B-tree, GiST, GIN)
- JSON/JSONB support for flexible metadata
- Strong ACID compliance for financial data integrity
- Powerful analytical functions and window operations
- Mature ecosystem and extensive monitoring tools

### 2. Core Database Schema

#### Enhanced Tables Structure

```sql
-- Core time-series data table
historical_market_data
├── Time-series OHLCV data with microsecond precision
├── Multi-source conflict resolution
├── Data quality scoring and anomaly detection
├── Intelligent cache expiration
└── Comprehensive audit trail

-- Data source management
data_sources
├── Provider reliability tracking
├── Rate limiting configuration
├── Cost management
├── Health monitoring
└── Capability mapping

-- Cache freshness tracking
data_freshness_tracking
├── Symbol-level freshness monitoring
├── Update scheduling
├── Completeness metrics
└── Quality assessment

-- Conflict resolution
data_source_conflicts
├── Automated conflict detection
├── Resolution strategies
├── Confidence scoring
└── Manual review queue
```

### 3. Key Design Decisions

#### Data Normalization Strategy
- **Denormalized time-series data** for query performance
- **Normalized reference data** for consistency
- **Hybrid approach** balancing storage and performance

#### Partitioning Strategy
```sql
-- Partition by date ranges for large datasets
CREATE TABLE historical_intraday_data_2024_01 PARTITION OF historical_intraday_data
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Benefits:
-- - Query pruning for date-range queries
-- - Parallel processing
-- - Easier maintenance and archival
-- - Improved backup/restore performance
```

#### Indexing Strategy
```sql
-- Primary performance indexes
idx_historical_symbol_date_timeframe    -- Core lookup pattern
idx_historical_timestamp_desc           -- Time-series queries
idx_historical_symbol_timeframe_source  -- Multi-source queries
idx_historical_cache_expires            -- Cache management
idx_historical_quality_score            -- Quality filtering
```

## Service Layer Architecture

### 1. HistoricalDataService
**Core database operations service**

```typescript
// Key capabilities:
- Direct database interaction
- Transaction management
- Bulk operations
- Data validation
- Conflict detection
```

**Usage Example:**
```typescript
import { historicalDataService } from './services/database/HistoricalDataService'

// Get historical data with quality filtering
const data = await historicalDataService.getHistoricalData(
  'AAPL',
  '1d',
  new Date('2024-01-01'),
  new Date('2024-12-31')
)
```

### 2. FinancialDataCacheService
**Intelligent caching orchestration**

```typescript
// Intelligent cache-first strategy:
1. Check cache freshness
2. Evaluate data quality
3. Apply cache strategy (eager/lazy/scheduled)
4. Fallback to API if needed
5. Background refresh for lazy strategy
```

**Usage Example:**
```typescript
import { financialDataCacheService } from './services/database/FinancialDataCacheService'

// Get market data with intelligent caching
const response = await financialDataCacheService.getMarketData({
  symbol: 'AAPL',
  timeframe: '1d',
  startDate: new Date('2024-01-01'),
  preferredSource: 'Polygon'
})

console.log(`Data source: ${response.source}`) // 'cache', 'api', or 'hybrid'
console.log(`Freshness: ${response.freshness}`) // 0-1 score
console.log(`Quality: ${response.quality}`) // 0-1 score
```

### 3. DatabaseMigrationService
**Database maintenance and population**

```typescript
// Capabilities:
- Schema migrations
- Historical data backfill
- Data validation
- Performance optimization
- Backup operations
```

## Cache Strategies

### 1. Timeframe-Based Strategies

| Timeframe | Max Age | Strategy | Priority | Use Case |
|-----------|---------|----------|----------|----------|
| 1m | 5 minutes | Eager | 1 | Real-time trading |
| 5m | 15 minutes | Eager | 2 | Short-term analysis |
| 1h | 1 hour | Lazy | 3 | Hourly analysis |
| 1d | 1 day | Scheduled | 4 | Daily reports |

### 2. Data Quality Management

```typescript
// Quality scoring factors:
- Source reliability (0-1)
- Data completeness (0-1)
- Anomaly detection (0-1)
- Timeliness (0-1)
- Conflict resolution confidence (0-1)

// Overall quality = weighted average of factors
```

### 3. Conflict Resolution

```typescript
// Resolution strategies:
'use_primary'        // Use highest priority source
'use_average'        // Average conflicting values
'use_highest_quality' // Use source with best quality score
'manual_review'      // Flag for human review
```

## Performance Optimizations

### 1. Database Level

```sql
-- Materialized views for common queries
mv_latest_historical_data        -- Latest data per symbol/timeframe
mv_data_completeness            -- Data coverage statistics

-- Partial indexes for filtered queries
CREATE INDEX idx_active_cache ON historical_market_data(cache_expires_at)
WHERE cache_expires_at > NOW();

-- Covering indexes to avoid table lookups
CREATE INDEX idx_symbol_ohlc_covering ON historical_market_data(symbol, timestamp)
INCLUDE (open_price, high_price, low_price, close_price, volume);
```

### 2. Application Level

```typescript
// Connection pooling
const pool = new Pool({
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Idle timeout
  connectionTimeoutMillis: 5000 // Connection timeout
})

// Query optimization
- Prepared statements for repeated queries
- Batch operations for bulk inserts
- Parallel processing for independent operations
- Connection reuse and proper cleanup
```

### 3. Caching Layers

```
Application Cache (In-Memory)
├── 5-minute TTL for frequently accessed data
├── LRU eviction policy
└── 100MB memory limit

Database Cache (PostgreSQL)
├── Historical data with configurable TTL
├── Intelligent expiration based on timeframe
└── Background refresh for stale data

Redis Cache (Optional)
├── Distributed caching for multiple instances
├── Session storage
└── Real-time analytics
```

## Data Quality & Validation

### 1. Input Validation

```typescript
function validateMarketData(data: MarketData): boolean {
  // Price relationship validation
  if (data.high < data.low) return false
  if (data.open > data.high || data.close > data.high) return false
  if (data.open < data.low || data.close < data.low) return false

  // Reasonable ranges
  if (data.open <= 0 || data.volume < 0) return false

  // Extreme outlier detection
  const priceRange = data.high - data.low
  const avgPrice = (data.high + data.low) / 2
  if (priceRange > avgPrice * 0.5) return false // 50% daily range seems extreme

  return true
}
```

### 2. Anomaly Detection

```sql
-- Statistical anomaly detection
WITH price_stats AS (
  SELECT symbol, timeframe,
    AVG(close_price) as avg_price,
    STDDEV(close_price) as std_price
  FROM historical_market_data
  WHERE timestamp > NOW() - INTERVAL '30 days'
  GROUP BY symbol, timeframe
)
UPDATE historical_market_data hmd
SET has_anomaly = true,
    anomaly_type = 'price_spike'
FROM price_stats ps
WHERE hmd.symbol = ps.symbol
  AND hmd.timeframe = ps.timeframe
  AND ABS(hmd.close_price - ps.avg_price) > 3 * ps.std_price;
```

### 3. Data Completeness Tracking

```sql
-- Calculate data completeness
UPDATE data_freshness_tracking dft
SET completeness_ratio = (
  SELECT COUNT(*)::DECIMAL / expected_points
  FROM historical_market_data hmd
  WHERE hmd.symbol = dft.symbol
    AND hmd.timeframe = dft.timeframe
    AND hmd.timestamp > NOW() - INTERVAL '30 days'
) / CASE
    WHEN dft.timeframe = '1d' THEN 22  -- Trading days per month
    WHEN dft.timeframe = '1h' THEN 22 * 6.5  -- Trading hours
    ELSE 22 * 6.5 * 60  -- Trading minutes
  END;
```

## API Integration

### 1. RESTful Endpoints

```typescript
// Get historical data
GET /api/historical-data?symbol=AAPL&timeframe=1d&startDate=2024-01-01

// Response structure
{
  "success": true,
  "data": [...],
  "metadata": {
    "source": "cache",     // cache, api, hybrid
    "cached": true,
    "freshness": 0.95,     // 0-1 score
    "quality": 0.92,       // 0-1 score
    "responseTime": 45,    // milliseconds
    "provider": "Polygon",
    "totalRecords": 252
  }
}
```

### 2. Bulk Operations

```typescript
// Backfill historical data
POST /api/historical-data/backfill
{
  "symbols": ["AAPL", "MSFT", "GOOGL"],
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "timeframes": ["1d", "1h"],
  "batchSize": 50,
  "preferredSources": ["Polygon", "Alpha Vantage"]
}
```

### 3. Cache Management

```typescript
// Clear cache
DELETE /api/historical-data/cache?symbol=AAPL&timeframe=1d

// Get cache metrics
GET /api/historical-data/cache/metrics
{
  "hitRate": 0.85,
  "avgResponseTime": 23,
  "totalCachedSymbols": 1247,
  "sourcesActive": 4
}
```

## Deployment & Maintenance

### 1. Database Setup

```bash
# 1. Install PostgreSQL
brew install postgresql

# 2. Create database and user
createdb vfr_api
psql vfr_api -c "CREATE USER vfr_app_role WITH PASSWORD 'secure_password';"

# 3. Run initial schema
psql vfr_api -f database/setup-database.sql
psql vfr_api -f database/enhanced-historical-data-schema.sql

# 4. Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=vfr_api
export DB_USER=vfr_app_role
export DB_PASSWORD=secure_password
```

### 2. Service Initialization

```typescript
// Initialize services in your application startup
import { financialDataCacheService } from './services/database/FinancialDataCacheService'
import { databaseMigrationService } from './services/database/DatabaseMigrationService'

async function initializeServices() {
  // Initialize cache service
  await financialDataCacheService.initialize()

  // Run any pending migrations
  await databaseMigrationService.runInitialMigration()

  console.log('Financial data cache system ready')
}
```

### 3. Monitoring & Maintenance

```typescript
// Daily maintenance routine
async function dailyMaintenance() {
  const maintenanceOptions = {
    cleanupOldData: true,
    cleanupOlderThanDays: 90,
    optimizeIndexes: true,
    updateStatistics: true,
    validateDataIntegrity: true,
    compactTables: false  // Weekly task
  }

  const result = await databaseMigrationService.runMaintenance(maintenanceOptions)
  console.log('Maintenance completed:', result.message)
}

// Schedule daily at 2 AM
setInterval(dailyMaintenance, 24 * 60 * 60 * 1000)
```

## Security Considerations

### 1. Database Security
- Use connection pooling with limited connections
- Implement role-based access control
- Enable SSL/TLS for database connections
- Regular security updates and patches
- Audit logging for sensitive operations

### 2. Data Protection
- Encrypt sensitive configuration data
- Implement rate limiting on API endpoints
- Validate all input parameters
- Use parameterized queries to prevent SQL injection
- Regular backup and disaster recovery testing

### 3. API Security
- JWT-based authentication
- Rate limiting per user/IP
- Input validation and sanitization
- CORS configuration
- API versioning and deprecation management

## Troubleshooting

### Common Issues

1. **Slow Query Performance**
   ```sql
   -- Check for missing indexes
   EXPLAIN ANALYZE SELECT * FROM historical_market_data
   WHERE symbol = 'AAPL' AND timestamp > '2024-01-01';

   -- Look for sequential scans
   ```

2. **Cache Miss Rate Too High**
   ```typescript
   // Check cache strategy configuration
   const metrics = await financialDataCacheService.getCacheMetrics()
   console.log('Hit rate:', metrics.hitRate)

   // Adjust cache TTL if needed
   ```

3. **Data Quality Issues**
   ```sql
   -- Run data validation
   SELECT * FROM assess_data_quality('AAPL', '1d', '2024-01-01', '2024-12-31');
   ```

4. **High Database Load**
   ```sql
   -- Check active connections
   SELECT count(*) FROM pg_stat_activity;

   -- Monitor slow queries
   SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC;
   ```

## Performance Benchmarks

### Expected Performance Metrics

| Operation | Target Response Time | Acceptable Load |
|-----------|---------------------|-----------------|
| Cache hit (single symbol) | < 50ms | 1000 req/sec |
| Cache miss (API fallback) | < 500ms | 100 req/sec |
| Bulk data insert | < 1s per 1000 records | 10k records/min |
| Data quality assessment | < 2s per symbol | 50 symbols/min |

### Scaling Considerations

- **Horizontal scaling**: Read replicas for analytics
- **Vertical scaling**: Memory and CPU optimization
- **Partitioning**: Time-based and symbol-based partitioning
- **Archival**: Move old data to cold storage
- **Caching**: Redis cluster for distributed caching

This architecture provides a robust, scalable foundation for historical financial data caching while maintaining data quality and performance standards required for financial applications.