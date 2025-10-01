/**
 * ML Enhancement Store
 *
 * Persistence layer for ML enhancements to VFR factor scores.
 * Stores enhancement values, confidence scores, and performance metrics in PostgreSQL.
 *
 * Key Responsibilities:
 * - Store ML enhancement values linked to VFR factors
 * - Track enhancement performance and fallback usage
 * - Provide retrieval methods for historical enhancements
 * - Support batch storage for efficiency
 * - Track data quality and confidence scores
 *
 * Database Schema: ml_enhancement_store table
 */

import { Pool, PoolClient } from 'pg';
import { Logger } from '../../error-handling/Logger';
import { ErrorHandler, ErrorType } from '../../error-handling/ErrorHandler';

/**
 * Enhancement record for storage
 */
export interface EnhancementRecord {
  ticker: string;
  timestamp: number;
  enhancementId: string;
  baseVfrValue: number;
  enhancedValue: number;
  enhancedCompositeValue: number;
  confidenceScore: number;
  dataQualityScore: number;
  vfrFactorName: string;
  enhancementWeight: number;
  enhancementLatencyMs: number;
  modelsUsed: string[];
  fallbackMode: boolean;
  validationStatus: 'pending' | 'valid' | 'invalid' | 'fallback' | 'partial';
}

/**
 * Enhancement retrieval options
 */
export interface EnhancementRetrievalOptions {
  ticker?: string;
  enhancementId?: string;
  vfrFactorName?: string;
  startTime?: number;
  endTime?: number;
  validationStatus?: string[];
  fallbackMode?: boolean;
  limit?: number;
}

/**
 * Enhancement statistics
 */
export interface EnhancementStatistics {
  ticker: string;
  totalEnhancements: number;
  validEnhancements: number;
  fallbackCount: number;
  avgConfidence: number;
  avgDataQuality: number;
  avgLatency: number;
  successRate: number;
  lastUpdated: number;
}

/**
 * Store configuration
 */
export interface MLEnhancementStoreConfig {
  databaseUrl: string;
  maxRetries: number;
  batchSize: number;
  connectionPoolSize: number;
}

const DEFAULT_CONFIG: MLEnhancementStoreConfig = {
  databaseUrl: process.env.DATABASE_URL || '',
  maxRetries: 3,
  batchSize: 100,
  connectionPoolSize: 10
};

export class MLEnhancementStore {
  private static instance: MLEnhancementStore;
  private pool: Pool;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private config: MLEnhancementStoreConfig;
  private initialized = false;

  private constructor(config?: Partial<MLEnhancementStoreConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };

    this.pool = new Pool({
      connectionString: this.config.databaseUrl,
      max: this.config.connectionPoolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    this.logger = Logger.getInstance('MLEnhancementStore');
    this.errorHandler = ErrorHandler.getInstance();

    this.logger.info('MLEnhancementStore initialized', {
      poolSize: this.config.connectionPoolSize
    });
  }

  public static getInstance(config?: Partial<MLEnhancementStoreConfig>): MLEnhancementStore {
    if (!MLEnhancementStore.instance) {
      MLEnhancementStore.instance = new MLEnhancementStore(config);
    }
    return MLEnhancementStore.instance;
  }

  /**
   * Initialize the store and verify database connectivity
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.initialized = true;
      this.logger.info('MLEnhancementStore database connection verified');
    } catch (error) {
      this.logger.error('Failed to initialize MLEnhancementStore', { error });
      throw error;
    }
  }

  /**
   * Store a single enhancement record
   */
  public async storeEnhancement(record: EnhancementRecord): Promise<void> {
    const startTime = Date.now();

    try {
      const query = `
        INSERT INTO ml_enhancement_store (
          ticker,
          timestamp,
          enhancement_id,
          base_vfr_value,
          enhanced_value,
          enhanced_composite_value,
          confidence_score,
          data_quality_score,
          vfr_factor_name,
          enhancement_weight,
          enhancement_latency_ms,
          models_used,
          fallback_mode,
          validation_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (ticker, timestamp, enhancement_id)
        DO UPDATE SET
          base_vfr_value = EXCLUDED.base_vfr_value,
          enhanced_value = EXCLUDED.enhanced_value,
          enhanced_composite_value = EXCLUDED.enhanced_composite_value,
          confidence_score = EXCLUDED.confidence_score,
          data_quality_score = EXCLUDED.data_quality_score,
          vfr_factor_name = EXCLUDED.vfr_factor_name,
          enhancement_weight = EXCLUDED.enhancement_weight,
          enhancement_latency_ms = EXCLUDED.enhancement_latency_ms,
          models_used = EXCLUDED.models_used,
          fallback_mode = EXCLUDED.fallback_mode,
          validation_status = EXCLUDED.validation_status
      `;

      const values = [
        record.ticker,
        new Date(record.timestamp),
        record.enhancementId,
        record.baseVfrValue,
        record.enhancedValue,
        record.enhancedCompositeValue,
        record.confidenceScore,
        record.dataQualityScore,
        record.vfrFactorName,
        record.enhancementWeight,
        record.enhancementLatencyMs,
        record.modelsUsed,
        record.fallbackMode,
        record.validationStatus
      ];

      await this.pool.query(query, values);

      const latency = Date.now() - startTime;
      this.logger.debug('Enhancement stored', {
        ticker: record.ticker,
        enhancementId: record.enhancementId,
        latency
      });
    } catch (error) {
      this.logger.error('Failed to store enhancement', {
        ticker: record.ticker,
        error
      });
      throw error;
    }
  }

  /**
   * Store multiple enhancement records in batch
   */
  public async storeEnhancementBatch(records: EnhancementRecord[]): Promise<void> {
    const startTime = Date.now();

    if (records.length === 0) {
      return;
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Process in batches to avoid overwhelming the database
      for (let i = 0; i < records.length; i += this.config.batchSize) {
        const batch = records.slice(i, i + this.config.batchSize);

        const values: any[] = [];
        const placeholders: string[] = [];

        batch.forEach((record, idx) => {
          const offset = idx * 14;
          placeholders.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`
          );

          values.push(
            record.ticker,
            new Date(record.timestamp),
            record.enhancementId,
            record.baseVfrValue,
            record.enhancedValue,
            record.enhancedCompositeValue,
            record.confidenceScore,
            record.dataQualityScore,
            record.vfrFactorName,
            record.enhancementWeight,
            record.enhancementLatencyMs,
            record.modelsUsed,
            record.fallbackMode,
            record.validationStatus
          );
        });

        const query = `
          INSERT INTO ml_enhancement_store (
            ticker,
            timestamp,
            enhancement_id,
            base_vfr_value,
            enhanced_value,
            enhanced_composite_value,
            confidence_score,
            data_quality_score,
            vfr_factor_name,
            enhancement_weight,
            enhancement_latency_ms,
            models_used,
            fallback_mode,
            validation_status
          ) VALUES ${placeholders.join(', ')}
          ON CONFLICT (ticker, timestamp, enhancement_id) DO NOTHING
        `;

        await client.query(query, values);
      }

      await client.query('COMMIT');

      const latency = Date.now() - startTime;
      this.logger.info('Enhancement batch stored', {
        count: records.length,
        latency
      });
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to store enhancement batch', {
        count: records.length,
        error
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve enhancements based on filter criteria
   */
  public async getEnhancements(options: EnhancementRetrievalOptions): Promise<EnhancementRecord[]> {
    const startTime = Date.now();

    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCounter = 1;

      // Build WHERE clause
      if (options.ticker) {
        conditions.push(`ticker = $${paramCounter++}`);
        values.push(options.ticker);
      }

      if (options.enhancementId) {
        conditions.push(`enhancement_id = $${paramCounter++}`);
        values.push(options.enhancementId);
      }

      if (options.vfrFactorName) {
        conditions.push(`vfr_factor_name = $${paramCounter++}`);
        values.push(options.vfrFactorName);
      }

      if (options.startTime) {
        conditions.push(`timestamp >= $${paramCounter++}`);
        values.push(new Date(options.startTime));
      }

      if (options.endTime) {
        conditions.push(`timestamp <= $${paramCounter++}`);
        values.push(new Date(options.endTime));
      }

      if (options.validationStatus && options.validationStatus.length > 0) {
        conditions.push(`validation_status = ANY($${paramCounter++})`);
        values.push(options.validationStatus);
      }

      if (options.fallbackMode !== undefined) {
        conditions.push(`fallback_mode = $${paramCounter++}`);
        values.push(options.fallbackMode);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = options.limit || 1000;

      const query = `
        SELECT
          ticker,
          EXTRACT(EPOCH FROM timestamp) * 1000 as timestamp,
          enhancement_id,
          base_vfr_value,
          enhanced_value,
          enhanced_composite_value,
          confidence_score,
          data_quality_score,
          vfr_factor_name,
          enhancement_weight,
          enhancement_latency_ms,
          models_used,
          fallback_mode,
          validation_status
        FROM ml_enhancement_store
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;

      const result = await this.pool.query(query, values);

      const enhancements: EnhancementRecord[] = result.rows.map(row => ({
        ticker: row.ticker,
        timestamp: Number(row.timestamp),
        enhancementId: row.enhancement_id,
        baseVfrValue: Number(row.base_vfr_value),
        enhancedValue: Number(row.enhanced_value),
        enhancedCompositeValue: Number(row.enhanced_composite_value),
        confidenceScore: Number(row.confidence_score),
        dataQualityScore: Number(row.data_quality_score),
        vfrFactorName: row.vfr_factor_name,
        enhancementWeight: Number(row.enhancement_weight),
        enhancementLatencyMs: row.enhancement_latency_ms,
        modelsUsed: row.models_used,
        fallbackMode: row.fallback_mode,
        validationStatus: row.validation_status
      }));

      const latency = Date.now() - startTime;
      this.logger.debug('Enhancements retrieved', {
        count: enhancements.length,
        latency
      });

      return enhancements;
    } catch (error) {
      this.logger.error('Failed to retrieve enhancements', { options, error });
      throw error;
    }
  }

  /**
   * Get statistics for a ticker
   */
  public async getStatistics(ticker: string, timeRange?: { start: number; end: number }): Promise<EnhancementStatistics> {
    try {
      const conditions: string[] = ['ticker = $1'];
      const values: any[] = [ticker];
      let paramCounter = 2;

      if (timeRange) {
        conditions.push(`timestamp >= $${paramCounter++}`);
        values.push(new Date(timeRange.start));
        conditions.push(`timestamp <= $${paramCounter++}`);
        values.push(new Date(timeRange.end));
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const query = `
        SELECT
          COUNT(*) as total_enhancements,
          COUNT(*) FILTER (WHERE validation_status = 'valid') as valid_enhancements,
          COUNT(*) FILTER (WHERE fallback_mode = true) as fallback_count,
          AVG(confidence_score) as avg_confidence,
          AVG(data_quality_score) as avg_data_quality,
          AVG(enhancement_latency_ms) as avg_latency,
          MAX(EXTRACT(EPOCH FROM timestamp) * 1000) as last_updated
        FROM ml_enhancement_store
        ${whereClause}
      `;

      const result = await this.pool.query(query, values);
      const row = result.rows[0];

      const totalEnhancements = Number(row.total_enhancements);
      const validEnhancements = Number(row.valid_enhancements);

      return {
        ticker,
        totalEnhancements,
        validEnhancements,
        fallbackCount: Number(row.fallback_count),
        avgConfidence: Number(row.avg_confidence) || 0,
        avgDataQuality: Number(row.avg_data_quality) || 0,
        avgLatency: Number(row.avg_latency) || 0,
        successRate: totalEnhancements > 0 ? validEnhancements / totalEnhancements : 0,
        lastUpdated: Number(row.last_updated) || Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to get statistics', { ticker, error });
      throw error;
    }
  }

  /**
   * Get latest enhancement for a ticker
   */
  public async getLatestEnhancement(ticker: string, enhancementId?: string): Promise<EnhancementRecord | null> {
    try {
      const conditions = ['ticker = $1'];
      const values: any[] = [ticker];

      if (enhancementId) {
        conditions.push('enhancement_id = $2');
        values.push(enhancementId);
      }

      const query = `
        SELECT
          ticker,
          EXTRACT(EPOCH FROM timestamp) * 1000 as timestamp,
          enhancement_id,
          base_vfr_value,
          enhanced_value,
          enhanced_composite_value,
          confidence_score,
          data_quality_score,
          vfr_factor_name,
          enhancement_weight,
          enhancement_latency_ms,
          models_used,
          fallback_mode,
          validation_status
        FROM ml_enhancement_store
        WHERE ${conditions.join(' AND ')}
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        ticker: row.ticker,
        timestamp: Number(row.timestamp),
        enhancementId: row.enhancement_id,
        baseVfrValue: Number(row.base_vfr_value),
        enhancedValue: Number(row.enhanced_value),
        enhancedCompositeValue: Number(row.enhanced_composite_value),
        confidenceScore: Number(row.confidence_score),
        dataQualityScore: Number(row.data_quality_score),
        vfrFactorName: row.vfr_factor_name,
        enhancementWeight: Number(row.enhancement_weight),
        enhancementLatencyMs: row.enhancement_latency_ms,
        modelsUsed: row.models_used,
        fallbackMode: row.fallback_mode,
        validationStatus: row.validation_status
      };
    } catch (error) {
      this.logger.error('Failed to get latest enhancement', { ticker, error });
      throw error;
    }
  }

  /**
   * Health check for the store
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.pool.query('SELECT 1');

      return {
        status: 'healthy',
        latency: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }

  /**
   * Close the database pool
   */
  public async close(): Promise<void> {
    await this.pool.end();
    this.initialized = false;
    this.logger.info('MLEnhancementStore closed');
  }
}
