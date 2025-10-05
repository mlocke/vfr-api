/**
 * Prediction Logger - Phase 1 Production Feedback Loop
 *
 * Logs ML predictions to database for outcome tracking and performance analysis.
 * Integrates with ml_predictions table for comprehensive prediction history.
 */

import { Pool } from 'pg';
import { Logger } from '../../error-handling/Logger';
import { PredictionResult } from './RealTimePredictionEngine';
import { MLPredictionHorizon } from '../types/MLTypes';

export interface PredictionLogEntry {
    ticker: string;
    prediction_timestamp: Date;
    enhancement_id: string;

    // Prediction details
    prediction_horizon: string;
    prediction_type: 'direction' | 'price_target' | 'probability';
    predicted_value: number;
    confidence_score: number;
    predicted_direction: 'UP' | 'DOWN' | 'NEUTRAL';

    // Context
    current_price: number;
    base_vfr_score?: number;
    enhanced_score?: number;

    // Metadata
    execution_time_ms?: number;
    cache_hit?: boolean;
    tier_used?: string;
}

export interface PredictionLogResult {
    success: boolean;
    prediction_id?: string;
    error?: string;
}

/**
 * PredictionLogger
 *
 * Handles logging of ML predictions to PostgreSQL for:
 * - Performance tracking
 * - Outcome analysis
 * - Model evaluation
 * - Production monitoring
 */
export class PredictionLogger {
    private static instance: PredictionLogger;
    private pool: Pool;
    private logger: Logger;
    private enhancementId: string; // Default enhancement_id for early signal

    private constructor() {
        this.logger = Logger.getInstance('PredictionLogger');

        // Initialize PostgreSQL connection pool
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Use existing enhancement_id or create default
        this.enhancementId = 'early_signal_1w'; // Maps to existing enhancement definition

        this.logger.info('PredictionLogger initialized');
    }

    public static getInstance(): PredictionLogger {
        if (!PredictionLogger.instance) {
            PredictionLogger.instance = new PredictionLogger();
        }
        return PredictionLogger.instance;
    }

    /**
     * Log a prediction to database
     */
    async logPrediction(entry: PredictionLogEntry): Promise<PredictionLogResult> {
        const startTime = Date.now();

        try {
            // Ensure enhancement_id exists
            await this.ensureEnhancementExists();

            const query = `
                INSERT INTO ml_predictions (
                    ticker,
                    prediction_timestamp,
                    enhancement_id,
                    prediction_horizon,
                    prediction_type,
                    predicted_value,
                    confidence_score,
                    current_price,
                    base_vfr_score,
                    enhanced_score,
                    execution_time_ms,
                    cache_hit,
                    tier_used
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING prediction_id
            `;

            const values = [
                entry.ticker,
                entry.prediction_timestamp,
                entry.enhancement_id || this.enhancementId,
                entry.prediction_horizon,
                entry.prediction_type,
                entry.predicted_value,
                entry.confidence_score,
                entry.current_price,
                entry.base_vfr_score,
                entry.enhanced_score,
                entry.execution_time_ms,
                entry.cache_hit || false,
                entry.tier_used || 'free'
            ];

            const result = await this.pool.query(query, values);
            const prediction_id = result.rows[0]?.prediction_id;

            const latency = Date.now() - startTime;
            this.logger.debug(
                `Logged prediction for ${entry.ticker}: ${entry.predicted_direction} (${(entry.confidence_score * 100).toFixed(0)}% confidence) - ${latency}ms`
            );

            return {
                success: true,
                prediction_id
            };
        } catch (error) {
            this.logger.error(
                `Failed to log prediction for ${entry.ticker}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Log multiple predictions in batch
     */
    async logPredictionBatch(entries: PredictionLogEntry[]): Promise<{
        success: boolean;
        logged: number;
        failed: number;
        errors: string[];
    }> {
        const results = await Promise.allSettled(
            entries.map(entry => this.logPrediction(entry))
        );

        let logged = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.success) {
                logged++;
            } else {
                failed++;
                if (result.status === 'rejected') {
                    errors.push(result.reason?.message || 'Unknown error');
                } else if (result.status === 'fulfilled') {
                    errors.push(result.value.error || 'Unknown error');
                }
            }
        }

        this.logger.info(`Batch logged ${logged}/${entries.length} predictions`);

        return {
            success: failed === 0,
            logged,
            failed,
            errors
        };
    }

    /**
     * Convert PredictionResult to PredictionLogEntry
     */
    convertPredictionToLogEntry(
        ticker: string,
        prediction: PredictionResult,
        options: {
            currentPrice: number;
            baseVfrScore?: number;
            enhancedScore?: number;
            executionTimeMs?: number;
            cacheHit?: boolean;
            tierUsed?: string;
        }
    ): PredictionLogEntry {
        // Map direction to predicted_value for direction predictions
        let predicted_value: number;
        if (prediction.direction === 'UP') {
            predicted_value = prediction.probability || 1.0;
        } else if (prediction.direction === 'DOWN') {
            predicted_value = -(prediction.probability || 1.0);
        } else {
            predicted_value = 0.0;
        }

        return {
            ticker,
            prediction_timestamp: new Date(prediction.timestamp),
            enhancement_id: this.enhancementId,

            prediction_horizon: prediction.horizon,
            prediction_type: 'direction',
            predicted_value,
            confidence_score: prediction.confidence,
            predicted_direction: prediction.direction,

            current_price: options.currentPrice,
            base_vfr_score: options.baseVfrScore,
            enhanced_score: options.enhancedScore,

            execution_time_ms: options.executionTimeMs,
            cache_hit: options.cacheHit,
            tier_used: options.tierUsed
        };
    }

    /**
     * Ensure enhancement_id exists in database
     */
    private async ensureEnhancementExists(): Promise<void> {
        try {
            const query = `
                INSERT INTO ml_enhancement_definitions (
                    enhancement_name,
                    enhancement_type,
                    target_factor,
                    prediction_horizon,
                    enhancement_weight,
                    tier_requirement
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (enhancement_name) DO NOTHING
            `;

            await this.pool.query(query, [
                'early_signal_1w',
                'composite_enhancement',
                'composite',
                '1w',
                0.15,
                'free'
            ]);
        } catch (error) {
            // Ignore error if already exists
            this.logger.debug('Enhancement definition already exists');
        }
    }

    /**
     * Get recent predictions for a ticker
     */
    async getRecentPredictions(ticker: string, limit: number = 10): Promise<any[]> {
        try {
            const query = `
                SELECT
                    prediction_id,
                    ticker,
                    prediction_timestamp,
                    prediction_horizon,
                    predicted_value,
                    confidence_score,
                    current_price,
                    base_vfr_score,
                    enhanced_score
                FROM ml_predictions
                WHERE ticker = $1
                ORDER BY prediction_timestamp DESC
                LIMIT $2
            `;

            const result = await this.pool.query(query, [ticker, limit]);
            return result.rows;
        } catch (error) {
            this.logger.error(
                `Failed to get recent predictions for ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return [];
        }
    }

    /**
     * Get prediction statistics
     */
    async getPredictionStats(since?: Date): Promise<{
        total_predictions: number;
        avg_confidence: number;
        predictions_by_direction: {
            UP: number;
            DOWN: number;
            NEUTRAL: number;
        };
    }> {
        try {
            const sinceClause = since ? 'WHERE prediction_timestamp >= $1' : '';
            const params = since ? [since] : [];

            const query = `
                SELECT
                    COUNT(*) as total_predictions,
                    AVG(confidence_score) as avg_confidence,
                    SUM(CASE WHEN predicted_value > 0 THEN 1 ELSE 0 END) as up_predictions,
                    SUM(CASE WHEN predicted_value < 0 THEN 1 ELSE 0 END) as down_predictions,
                    SUM(CASE WHEN predicted_value = 0 THEN 1 ELSE 0 END) as neutral_predictions
                FROM ml_predictions
                ${sinceClause}
            `;

            const result = await this.pool.query(query, params);
            const row = result.rows[0];

            return {
                total_predictions: parseInt(row.total_predictions) || 0,
                avg_confidence: parseFloat(row.avg_confidence) || 0,
                predictions_by_direction: {
                    UP: parseInt(row.up_predictions) || 0,
                    DOWN: parseInt(row.down_predictions) || 0,
                    NEUTRAL: parseInt(row.neutral_predictions) || 0
                }
            };
        } catch (error) {
            this.logger.error(
                `Failed to get prediction stats: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return {
                total_predictions: 0,
                avg_confidence: 0,
                predictions_by_direction: { UP: 0, DOWN: 0, NEUTRAL: 0 }
            };
        }
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        await this.pool.end();
        this.logger.info('PredictionLogger closed');
    }
}
