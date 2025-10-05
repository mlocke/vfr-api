/**
 * ML Metrics API - Production Feedback Loop Metrics
 *
 * Provides real-world performance metrics for ML predictions:
 * - Prediction accuracy (direction correctness)
 * - Return performance (actual vs predicted)
 * - Confidence calibration
 * - Daily/stock-level aggregates
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5
});

/**
 * GET /api/ml/metrics
 * Get ML prediction performance metrics
 *
 * Query Parameters:
 * - timeframe: 7d | 30d | 90d | all (default: 30d)
 * - ticker: Filter by specific ticker
 * - groupBy: daily | stock | none (default: daily)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const timeframe = searchParams.get('timeframe') || '30d';
        const ticker = searchParams.get('ticker');
        const groupBy = searchParams.get('groupBy') || 'daily';

        // Parse timeframe to days
        const daysMap: Record<string, number | null> = {
            '7d': 7,
            '30d': 30,
            '90d': 90,
            'all': null
        };

        const days = daysMap[timeframe] || 30;

        // Build WHERE clause
        const whereConditions = ['data_complete = true', 'outlier_flag = false'];
        const queryParams: any[] = [];

        if (days) {
            whereConditions.push(`outcome_timestamp >= NOW() - INTERVAL '${days} days'`);
        }

        if (ticker) {
            queryParams.push(ticker);
            whereConditions.push(`ticker = $${queryParams.length}`);
        }

        const whereClause = whereConditions.join(' AND ');

        let data: any = {};

        if (groupBy === 'daily') {
            // Get daily metrics
            const query = `
                SELECT
                    date,
                    total_predictions,
                    correct_predictions,
                    direction_accuracy,
                    avg_actual_return,
                    avg_market_return,
                    avg_relative_performance,
                    mean_absolute_error,
                    avg_confidence,
                    high_confidence_accuracy,
                    low_confidence_accuracy,
                    sharpe_ratio
                FROM ml_daily_performance
                ${days ? `WHERE date >= CURRENT_DATE - INTERVAL '${days} days'` : ''}
                ORDER BY date DESC
            `;

            const result = await pool.query(query);
            data.daily = result.rows;

        } else if (groupBy === 'stock') {
            // Get stock-level metrics
            const query = `
                SELECT
                    ticker,
                    total_predictions,
                    direction_accuracy,
                    avg_return,
                    avg_relative_performance,
                    last_outcome_timestamp
                FROM ml_stock_performance
                ${ticker ? `WHERE ticker = $1` : ''}
                ORDER BY total_predictions DESC
                LIMIT 100
            `;

            const result = await pool.query(query, ticker ? [ticker] : []);
            data.byStock = result.rows;

        } else {
            // Get aggregate metrics
            const query = `
                SELECT
                    COUNT(*) as total_predictions,
                    SUM(CASE WHEN direction_correct THEN 1 ELSE 0 END) as correct_predictions,
                    ROUND(AVG(CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END), 4) as direction_accuracy,
                    ROUND(AVG(actual_return), 6) as avg_actual_return,
                    ROUND(AVG(market_return), 6) as avg_market_return,
                    ROUND(AVG(relative_performance), 6) as avg_relative_performance,
                    ROUND(AVG(ABS(return_error)), 6) as mean_absolute_error,
                    ROUND(STDDEV(return_error), 6) as return_error_stddev,
                    ROUND(AVG(predicted_confidence), 4) as avg_confidence,
                    ROUND(AVG(CASE WHEN predicted_confidence >= 0.8 THEN
                        CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END
                    END), 4) as high_confidence_accuracy,
                    ROUND(AVG(CASE WHEN predicted_confidence < 0.6 THEN
                        CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END
                    END), 4) as low_confidence_accuracy,
                    ROUND(
                        CASE
                            WHEN STDDEV(actual_return) > 0
                            THEN AVG(actual_return) / STDDEV(actual_return)
                            ELSE NULL
                        END,
                        4
                    ) as sharpe_ratio
                FROM ml_outcomes
                WHERE ${whereClause}
            `;

            const result = await pool.query(query, queryParams);
            data.summary = result.rows[0];
        }

        // Get recent predictions count
        const recentQuery = `
            SELECT COUNT(*) as count
            FROM ml_predictions
            WHERE prediction_timestamp >= NOW() - INTERVAL '24 hours'
        `;
        const recentResult = await pool.query(recentQuery);

        return NextResponse.json({
            success: true,
            data,
            metadata: {
                timeframe,
                groupBy,
                ticker: ticker || 'all',
                recentPredictions24h: parseInt(recentResult.rows[0].count)
            },
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ ML metrics retrieval failed:', error);

        return NextResponse.json({
            success: false,
            error: 'Failed to retrieve ML metrics',
            details: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
        }, { status: 500 });
    }
}

/**
 * POST /api/ml/metrics
 * Trigger metrics refresh (refresh materialized views)
 */
export async function POST(request: NextRequest) {
    try {
        // Refresh materialized views
        await pool.query('SELECT refresh_ml_performance_views()');

        // Get updated summary
        const summaryQuery = `
            SELECT
                COUNT(*) as total_outcomes,
                AVG(CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END) as direction_accuracy,
                AVG(actual_return) as avg_return
            FROM ml_outcomes
            WHERE data_complete = true
              AND outcome_timestamp >= NOW() - INTERVAL '30 days'
        `;

        const result = await pool.query(summaryQuery);

        return NextResponse.json({
            success: true,
            message: 'Metrics refreshed successfully',
            summary: result.rows[0],
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ ML metrics refresh failed:', error);

        return NextResponse.json({
            success: false,
            error: 'Failed to refresh ML metrics',
            details: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
        }, { status: 500 });
    }
}
