/**
 * Historical Financial Data Database Service
 * Optimized caching layer for multi-source financial data
 * Integrates with existing FinancialDataService for intelligent fallback
 */

import { Pool, PoolClient } from 'pg'
import { MarketData, StockData } from '../financial-data/types'

// Enhanced types for historical data
export interface HistoricalMarketData extends MarketData {
  id?: string
  dateOnly: string
  timeframe: string
  adjustedClose?: number
  splitFactor?: number
  dividendAmount?: number
  vwap?: number
  tradeCount?: number
  bidPrice?: number
  askPrice?: number
  spread?: number

  // Data quality and source tracking
  primarySource: string
  sourcePriority: number
  dataQualityScore?: number
  confidenceLevel?: number
  isValidated: boolean
  hasAnomaly: boolean
  anomalyType?: string

  // Caching metadata
  cacheCreatedAt: Date
  cacheExpiresAt?: Date
  lastUpdatedAt: Date
  updateFrequency: string
  sourceTimestamp?: Date
  sourceResponseTimeMs?: number
  sourceApiVersion?: string
  sourceRequestId?: string
  batchId?: string
  ingestionMethod: 'api' | 'batch' | 'manual' | 'backfill'

  // Market context
  marketHoursFlag: boolean
  afterHoursFlag: boolean
  regulatoryHalt: boolean
}

export interface DataSource {
  id: string
  name: string
  providerType: 'premium' | 'free' | 'government'
  isActive: boolean
  isHealthy: boolean
  reliabilityScore: number
  dataQualityRating: number
  averageResponseTimeMs?: number
  rateLimitRequests: number
  rateLimitWindowSeconds: number
  supportedTimeframes: string[]
  maxHistoricalYears: number
}

export interface DataFreshnessInfo {
  symbol: string
  timeframe: string
  dataSource: string
  latestDataTimestamp?: Date
  lastSuccessfulUpdate?: Date
  nextScheduledUpdate?: Date
  completenessRatio?: number
  averageDataQuality?: number
  status: 'active' | 'paused' | 'error' | 'deprecated'
}

export interface ConflictResolution {
  symbol: string
  timestamp: Date
  timeframe: string
  conflictType: string
  variancePercentage: number
  primaryValue: number
  conflictingValue: number
  resolutionStrategy: string
  resolvedValue: number
  resolutionConfidence: number
}

export interface BulkDataJob {
  id: string
  jobName: string
  jobType: 'backfill' | 'migration' | 'reconciliation' | 'cleanup'
  symbols: string[]
  startDate: Date
  endDate: Date
  timeframes: string[]
  dataSources: string[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
  totalItems: number
  processedItems: number
  successfulItems: number
  failedItems: number
  progress: number
}

/**
 * Database connection and query service for historical financial data
 */
class DatabaseConnection {
  private pool: Pool
  private isConnected: boolean = false

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'vfr_api',
      user: process.env.DB_USER || 'vfr_app_role',
      password: process.env.DB_PASSWORD,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })

    this.pool.on('error', (err) => {
      console.error('Database pool error:', err)
      this.isConnected = false
    })
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect()
      client.release()
      this.isConnected = true
    } catch (error) {
      console.error('Database connection failed:', error)
      this.isConnected = false
      throw error
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    if (!this.isConnected) {
      await this.connect()
    }

    const start = Date.now()
    try {
      const result = await this.pool.query(text, params)
      const duration = Date.now() - start

      if (duration > 1000) {
        console.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100))
      }

      return result.rows
    } catch (error) {
      console.error('Database query error:', error)
      throw error
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
    this.isConnected = false
  }

  get healthy(): boolean {
    return this.isConnected
  }
}

/**
 * Main historical data service class
 */
export class HistoricalDataService {
  private db: DatabaseConnection
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes for in-memory cache

  constructor() {
    this.db = new DatabaseConnection()
  }

  /**
   * Initialize the service and ensure database connection
   */
  async initialize(): Promise<void> {
    await this.db.connect()
  }

  /**
   * Get historical market data with intelligent caching
   */
  async getHistoricalData(
    symbol: string,
    timeframe: string = '1d',
    startDate?: Date,
    endDate?: Date,
    preferredSource?: string
  ): Promise<HistoricalMarketData[]> {
    const cacheKey = `hist_${symbol}_${timeframe}_${startDate?.toISOString()}_${endDate?.toISOString()}_${preferredSource}`

    // Check in-memory cache first
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    let query = `
      SELECT
        id, symbol, timestamp, date_only as "dateOnly", timeframe,
        open_price as "openPrice", high_price as "highPrice",
        low_price as "lowPrice", close_price as "closePrice",
        volume, adjusted_close as "adjustedClose", vwap,
        primary_source as "primarySource", source_priority as "sourcePriority",
        data_quality_score as "dataQualityScore", confidence_level as "confidenceLevel",
        is_validated as "isValidated", has_anomaly as "hasAnomaly",
        anomaly_type as "anomalyType", cache_created_at as "cacheCreatedAt",
        cache_expires_at as "cacheExpiresAt", last_updated_at as "lastUpdatedAt",
        market_hours_flag as "marketHoursFlag", after_hours_flag as "afterHoursFlag"
      FROM historical_market_data
      WHERE symbol = $1 AND timeframe = $2
    `

    const params = [symbol.toUpperCase(), timeframe]
    let paramIndex = 3

    if (startDate) {
      query += ` AND timestamp >= $${paramIndex}`
      params.push(startDate.toISOString())
      paramIndex++
    }

    if (endDate) {
      query += ` AND timestamp <= $${paramIndex}`
      params.push(endDate.toISOString())
      paramIndex++
    }

    if (preferredSource) {
      query += ` AND primary_source = $${paramIndex}`
      params.push(preferredSource)
      paramIndex++
    }

    // Prioritize by data quality and source priority
    query += `
      ORDER BY
        CASE WHEN cache_expires_at IS NULL OR cache_expires_at > NOW() THEN 0 ELSE 1 END,
        data_quality_score DESC NULLS LAST,
        source_priority ASC,
        timestamp DESC
    `

    try {
      const results = await this.db.query<HistoricalMarketData>(query, params)

      // Cache the results
      this.setCache(cacheKey, results)

      return results
    } catch (error) {
      console.error('Error fetching historical data:', error)
      return []
    }
  }

  /**
   * Store historical market data with conflict detection
   */
  async storeHistoricalData(
    data: Omit<HistoricalMarketData, 'id' | 'cacheCreatedAt' | 'lastUpdatedAt'>,
    detectConflicts: boolean = true
  ): Promise<string | null> {
    if (detectConflicts) {
      await this.detectAndResolveConflicts(data)
    }

    const query = `
      INSERT INTO historical_market_data (
        symbol, timestamp, date_only, timeframe, open_price, high_price,
        low_price, close_price, volume, adjusted_close, vwap, trade_count,
        primary_source, source_priority, data_quality_score, confidence_level,
        is_validated, has_anomaly, anomaly_type, cache_expires_at,
        update_frequency, source_timestamp, source_response_time_ms,
        source_api_version, source_request_id, batch_id, ingestion_method,
        market_hours_flag, after_hours_flag, regulatory_halt
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
      )
      ON CONFLICT (symbol, timestamp, timeframe, primary_source)
      DO UPDATE SET
        open_price = EXCLUDED.open_price,
        high_price = EXCLUDED.high_price,
        low_price = EXCLUDED.low_price,
        close_price = EXCLUDED.close_price,
        volume = EXCLUDED.volume,
        data_quality_score = EXCLUDED.data_quality_score,
        last_updated_at = NOW()
      RETURNING id
    `

    const params = [
      data.symbol.toUpperCase(),
      data.timestamp,
      data.dateOnly,
      data.timeframe,
      data.open,
      data.high,
      data.low,
      data.close,
      data.volume,
      data.adjustedClose,
      data.vwap,
      data.tradeCount,
      data.primarySource,
      data.sourcePriority,
      data.dataQualityScore,
      data.confidenceLevel,
      data.isValidated,
      data.hasAnomaly,
      data.anomalyType,
      data.cacheExpiresAt,
      data.updateFrequency,
      data.sourceTimestamp,
      data.sourceResponseTimeMs,
      data.sourceApiVersion,
      data.sourceRequestId,
      data.batchId,
      data.ingestionMethod,
      data.marketHoursFlag,
      data.afterHoursFlag,
      data.regulatoryHalt
    ]

    try {
      const result = await this.db.query<{ id: string }>(query, params)
      return result[0]?.id || null
    } catch (error) {
      console.error('Error storing historical data:', error)
      return null
    }
  }

  /**
   * Bulk store historical data with transaction support
   */
  async bulkStoreHistoricalData(
    dataArray: Omit<HistoricalMarketData, 'id' | 'cacheCreatedAt' | 'lastUpdatedAt'>[],
    batchSize: number = 1000
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0
    let failed = 0

    // Process in batches
    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize)

      try {
        await this.db.transaction(async (client) => {
          for (const data of batch) {
            try {
              await this.storeHistoricalData(data, false) // Skip conflict detection in bulk mode
              successful++
            } catch (error) {
              console.error(`Error storing data for ${data.symbol}:`, error)
              failed++
            }
          }
        })
      } catch (error) {
        console.error('Bulk insert transaction failed:', error)
        failed += batch.length
      }
    }

    return { successful, failed }
  }

  /**
   * Check data freshness and determine if refresh is needed
   */
  async checkDataFreshness(symbol: string, timeframe: string, source?: string): Promise<DataFreshnessInfo | null> {
    const query = `
      SELECT
        symbol, timeframe, data_source as "dataSource",
        latest_data_timestamp as "latestDataTimestamp",
        last_successful_update as "lastSuccessfulUpdate",
        next_scheduled_update as "nextScheduledUpdate",
        completeness_ratio as "completenessRatio",
        average_data_quality as "averageDataQuality",
        status
      FROM data_freshness_tracking
      WHERE symbol = $1 AND timeframe = $2
      ${source ? 'AND data_source = $3' : ''}
      ORDER BY average_data_quality DESC NULLS LAST
      LIMIT 1
    `

    const params = [symbol.toUpperCase(), timeframe]
    if (source) params.push(source)

    try {
      const result = await this.db.query<DataFreshnessInfo>(query, params)
      return result[0] || null
    } catch (error) {
      console.error('Error checking data freshness:', error)
      return null
    }
  }

  /**
   * Get data quality metrics for a symbol and source
   */
  async getDataQualityMetrics(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    source: string
    qualityScore: number
    completeness: number
    anomalyCount: number
    recommendation: string
  }>> {
    const query = `
      SELECT * FROM assess_data_quality($1, $2, $3, $4)
    `

    try {
      const result = await this.db.query(query, [symbol.toUpperCase(), timeframe, startDate, endDate])
      return result
    } catch (error) {
      console.error('Error getting data quality metrics:', error)
      return []
    }
  }

  /**
   * Invalidate stale cache entries
   */
  async invalidateStaleCache(): Promise<number> {
    try {
      const result = await this.db.query<{ invalidate_stale_cache: number }>('SELECT invalidate_stale_cache()')
      return result[0]?.invalidate_stale_cache || 0
    } catch (error) {
      console.error('Error invalidating stale cache:', error)
      return 0
    }
  }

  /**
   * Get active data sources with health status
   */
  async getDataSources(): Promise<DataSource[]> {
    const query = `
      SELECT
        id, name, provider_type as "providerType", is_active as "isActive",
        is_healthy as "isHealthy", reliability_score as "reliabilityScore",
        data_quality_rating as "dataQualityRating",
        average_response_time_ms as "averageResponseTimeMs",
        rate_limit_requests as "rateLimitRequests",
        rate_limit_window_seconds as "rateLimitWindowSeconds",
        supported_timeframes as "supportedTimeframes",
        max_historical_years as "maxHistoricalYears"
      FROM data_sources
      WHERE is_active = true
      ORDER BY reliability_score DESC, data_quality_rating DESC
    `

    try {
      return await this.db.query<DataSource>(query)
    } catch (error) {
      console.error('Error fetching data sources:', error)
      return []
    }
  }

  /**
   * Create bulk data job for historical data population
   */
  async createBulkDataJob(
    jobName: string,
    jobType: 'backfill' | 'migration' | 'reconciliation' | 'cleanup',
    symbols: string[],
    startDate: Date,
    endDate: Date,
    timeframes: string[] = ['1d'],
    dataSources: string[] = []
  ): Promise<string | null> {
    const query = `
      INSERT INTO bulk_data_jobs (
        job_name, job_type, symbols, start_date, end_date,
        timeframes, data_sources, total_items
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `

    const totalItems = symbols.length * timeframes.length * (dataSources.length || 1)

    try {
      const result = await this.db.query<{ id: string }>(query, [
        jobName, jobType, symbols, startDate, endDate,
        timeframes, dataSources, totalItems
      ])
      return result[0]?.id || null
    } catch (error) {
      console.error('Error creating bulk data job:', error)
      return null
    }
  }

  /**
   * Get bulk job status
   */
  async getBulkJobStatus(jobId: string): Promise<BulkDataJob | null> {
    const query = `
      SELECT
        id, job_name as "jobName", job_type as "jobType",
        symbols, start_date as "startDate", end_date as "endDate",
        timeframes, data_sources as "dataSources", status,
        total_items as "totalItems", processed_items as "processedItems",
        successful_items as "successfulItems", failed_items as "failedItems",
        CASE
          WHEN total_items > 0 THEN ROUND((processed_items::DECIMAL / total_items) * 100, 2)
          ELSE 0
        END as progress
      FROM bulk_data_jobs
      WHERE id = $1
    `

    try {
      const result = await this.db.query<BulkDataJob>(query, [jobId])
      return result[0] || null
    } catch (error) {
      console.error('Error getting bulk job status:', error)
      return null
    }
  }

  /**
   * Detect and resolve data conflicts between sources
   */
  private async detectAndResolveConflicts(
    newData: Omit<HistoricalMarketData, 'id' | 'cacheCreatedAt' | 'lastUpdatedAt'>
  ): Promise<void> {
    // Check for existing data at the same timestamp
    const existingQuery = `
      SELECT primary_source, close_price, volume, data_quality_score
      FROM historical_market_data
      WHERE symbol = $1 AND timestamp = $2 AND timeframe = $3 AND primary_source != $4
      ORDER BY data_quality_score DESC, source_priority ASC
      LIMIT 1
    `

    try {
      const existing = await this.db.query(existingQuery, [
        newData.symbol.toUpperCase(),
        newData.timestamp,
        newData.timeframe,
        newData.primarySource
      ])

      if (existing.length > 0) {
        const existingData = existing[0]
        const priceVariance = Math.abs(newData.close - existingData.close_price) / existingData.close_price
        const volumeVariance = Math.abs(newData.volume - existingData.volume) / Math.max(existingData.volume, 1)

        // Log significant variances for review
        if (priceVariance > 0.02 || volumeVariance > 0.1) { // 2% price or 10% volume variance
          await this.logDataConflict(
            newData.symbol,
            newData.timestamp,
            newData.timeframe,
            'price_variance',
            priceVariance,
            existingData.close_price,
            newData.close,
            newData.primarySource,
            existingData.primary_source
          )
        }
      }
    } catch (error) {
      console.error('Error detecting conflicts:', error)
    }
  }

  /**
   * Log data conflicts for review
   */
  private async logDataConflict(
    symbol: string,
    timestamp: Date,
    timeframe: string,
    conflictType: string,
    variancePercentage: number,
    primaryValue: number,
    conflictingValue: number,
    primarySource: string,
    conflictingSource: string
  ): Promise<void> {
    const query = `
      INSERT INTO data_source_conflicts (
        symbol, timestamp, timeframe, conflict_type, variance_percentage,
        primary_value, conflicting_value, primary_source, conflicting_source,
        resolution_strategy, resolved_value, resolution_confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `

    // Simple resolution strategy: use higher quality source
    const resolvedValue = primaryValue // Default to primary for now
    const resolutionStrategy = 'use_primary'
    const resolutionConfidence = 0.8

    try {
      await this.db.query(query, [
        symbol.toUpperCase(), timestamp, timeframe, conflictType, variancePercentage,
        primaryValue, conflictingValue, primarySource, conflictingSource,
        resolutionStrategy, resolvedValue, resolutionConfidence
      ])
    } catch (error) {
      console.error('Error logging data conflict:', error)
    }
  }

  /**
   * In-memory cache helpers
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key)
      return null
    }

    return cached.data as T
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    this.cache.clear()
    await this.invalidateStaleCache()
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.db.healthy
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.db.close()
  }
}

// Singleton instance
export const historicalDataService = new HistoricalDataService()