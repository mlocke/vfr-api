/**
 * ML Outcome Tracker - Phase 1 Production Feedback Loop
 *
 * Tracks actual stock performance vs ML predictions to measure model accuracy.
 * Run daily via cron to update outcomes for predictions made 7, 30, 60, 90 days ago.
 *
 * Usage:
 *   npx tsx scripts/ml/track-outcomes.ts
 *   npx tsx scripts/ml/track-outcomes.ts --days 30 --limit 100
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Prediction {
    prediction_id: string;
    ticker: string;
    prediction_timestamp: Date;
    predicted_value: number;
    confidence_score: number;
    current_price: number;
    prediction_horizon: string;
}

interface OutcomeData {
    ticker: string;
    initial_price: number;
    final_price: number;
    market_return?: number;
    sector_return?: number;
}

/**
 * OutcomeTracker
 *
 * Fetches actual stock performance and logs outcomes for predictions
 */
class OutcomeTracker {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 5
        });
    }

    /**
     * Main tracking loop
     */
    async track(options: {
        daysAgo: number[];
        limit?: number;
    }): Promise<void> {
        console.log(`📊 Starting outcome tracking for ${options.daysAgo.join(', ')} days ago...`);

        for (const days of options.daysAgo) {
            await this.trackOutcomesForTimeframe(days, options.limit);
        }

        console.log('✅ Outcome tracking complete');
    }

    /**
     * Track outcomes for predictions made N days ago
     */
    private async trackOutcomesForTimeframe(daysAgo: number, limit?: number): Promise<void> {
        console.log(`\n📅 Processing predictions from ${daysAgo} days ago...`);

        // Get predictions that don't have outcomes yet
        const predictions = await this.getPredictionsNeedingOutcomes(daysAgo, limit);

        if (predictions.length === 0) {
            console.log(`  No predictions found needing outcomes`);
            return;
        }

        console.log(`  Found ${predictions.length} predictions to process`);

        let processed = 0;
        let errors = 0;

        for (const prediction of predictions) {
            try {
                const outcome = await this.fetchOutcomeData(prediction, daysAgo);

                if (outcome) {
                    await this.logOutcome(prediction, outcome, daysAgo);
                    processed++;
                } else {
                    console.warn(`  ⚠️  No outcome data for ${prediction.ticker}`);
                    errors++;
                }
            } catch (error) {
                console.error(
                    `  ❌ Error processing ${prediction.ticker}: ${error instanceof Error ? error.message : 'Unknown'}`
                );
                errors++;
            }
        }

        console.log(`  ✅ Processed ${processed}/${predictions.length} outcomes (${errors} errors)`);

        // Refresh materialized views
        await this.refreshPerformanceViews();
    }

    /**
     * Get predictions that need outcomes
     */
    private async getPredictionsNeedingOutcomes(
        daysAgo: number,
        limit?: number
    ): Promise<Prediction[]> {
        const query = `
            SELECT
                p.prediction_id,
                p.ticker,
                p.prediction_timestamp,
                p.predicted_value,
                p.confidence_score,
                p.current_price,
                p.prediction_horizon
            FROM ml_predictions p
            LEFT JOIN ml_outcomes o ON p.prediction_id = o.prediction_id
            WHERE
                p.prediction_timestamp >= NOW() - INTERVAL '${daysAgo + 1} days'
                AND p.prediction_timestamp < NOW() - INTERVAL '${daysAgo} days'
                AND o.outcome_id IS NULL
            ORDER BY p.prediction_timestamp DESC
            ${limit ? `LIMIT ${limit}` : ''}
        `;

        const result = await this.pool.query(query);
        return result.rows;
    }

    /**
     * Fetch actual outcome data for a prediction
     */
    private async fetchOutcomeData(
        prediction: Prediction,
        daysAgo: number
    ): Promise<OutcomeData | null> {
        try {
            // Get historical price data from market_data table
            const priceQuery = `
                SELECT
                    close_price
                FROM market_data
                WHERE
                    symbol = $1
                    AND interval_type = '1d'
                    AND timestamp >= $2::timestamp - INTERVAL '1 day'
                    AND timestamp <= $2::timestamp + INTERVAL '1 day'
                ORDER BY ABS(EXTRACT(EPOCH FROM (timestamp - $2::timestamp)))
                LIMIT 1
            `;

            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - 1); // Yesterday (outcome date)

            const result = await this.pool.query(priceQuery, [
                prediction.ticker,
                targetDate
            ]);

            if (result.rows.length === 0) {
                return null;
            }

            const final_price = parseFloat(result.rows[0].close_price);

            // Get market return (SPY as proxy)
            const marketReturn = await this.getMarketReturn(
                prediction.prediction_timestamp,
                targetDate
            );

            return {
                ticker: prediction.ticker,
                initial_price: prediction.current_price,
                final_price,
                market_return: marketReturn ?? undefined,
                sector_return: undefined // Could fetch sector ETF return here
            };
        } catch (error) {
            console.error(
                `Error fetching outcome data for ${prediction.ticker}: ${error instanceof Error ? error.message : 'Unknown'}`
            );
            return null;
        }
    }

    /**
     * Get market return for timeframe (SPY)
     */
    private async getMarketReturn(startDate: Date, endDate: Date): Promise<number | null> {
        try {
            const query = `
                SELECT
                    (SELECT close_price FROM market_data
                     WHERE symbol = 'SPY' AND interval_type = '1d'
                     AND timestamp <= $1
                     ORDER BY timestamp DESC LIMIT 1) as start_price,
                    (SELECT close_price FROM market_data
                     WHERE symbol = 'SPY' AND interval_type = '1d'
                     AND timestamp <= $2
                     ORDER BY timestamp DESC LIMIT 1) as end_price
            `;

            const result = await this.pool.query(query, [startDate, endDate]);

            if (result.rows.length > 0 && result.rows[0].start_price && result.rows[0].end_price) {
                const start = parseFloat(result.rows[0].start_price);
                const end = parseFloat(result.rows[0].end_price);
                return (end - start) / start;
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Log outcome to database
     */
    private async logOutcome(
        prediction: Prediction,
        outcome: OutcomeData,
        daysAgo: number
    ): Promise<void> {
        const actual_return = (outcome.final_price - outcome.initial_price) / outcome.initial_price;

        // Determine actual direction
        let actual_direction: 'UP' | 'DOWN' | 'NEUTRAL';
        if (actual_return > 0.001) {
            actual_direction = 'UP';
        } else if (actual_return < -0.001) {
            actual_direction = 'DOWN';
        } else {
            actual_direction = 'NEUTRAL';
        }

        // Determine predicted direction from predicted_value
        let predicted_direction: 'UP' | 'DOWN' | 'NEUTRAL';
        if (prediction.predicted_value > 0.001) {
            predicted_direction = 'UP';
        } else if (prediction.predicted_value < -0.001) {
            predicted_direction = 'DOWN';
        } else {
            predicted_direction = 'NEUTRAL';
        }

        const direction_correct = predicted_direction === actual_direction;
        const return_error = Math.abs(prediction.predicted_value - actual_return);

        const relative_performance = outcome.market_return
            ? actual_return - outcome.market_return
            : null;

        const query = `
            INSERT INTO ml_outcomes (
                prediction_id,
                ticker,
                prediction_timestamp,
                outcome_timestamp,
                days_elapsed,
                predicted_direction,
                predicted_value,
                predicted_confidence,
                initial_price,
                final_price,
                actual_return,
                actual_direction,
                direction_correct,
                return_error,
                market_return,
                sector_return,
                relative_performance,
                data_complete
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT (prediction_id) DO NOTHING
        `;

        await this.pool.query(query, [
            prediction.prediction_id,
            prediction.ticker,
            prediction.prediction_timestamp,
            new Date(),
            daysAgo,
            predicted_direction,
            prediction.predicted_value,
            prediction.confidence_score,
            outcome.initial_price,
            outcome.final_price,
            actual_return,
            actual_direction,
            direction_correct,
            return_error,
            outcome.market_return,
            outcome.sector_return,
            relative_performance,
            true
        ]);

        const accuracy = direction_correct ? '✅' : '❌';
        console.log(
            `  ${accuracy} ${prediction.ticker}: ${predicted_direction} → ${actual_direction} ` +
            `(return: ${(actual_return * 100).toFixed(2)}%, conf: ${(prediction.confidence_score * 100).toFixed(0)}%)`
        );
    }

    /**
     * Refresh materialized views
     */
    private async refreshPerformanceViews(): Promise<void> {
        try {
            await this.pool.query('SELECT refresh_ml_performance_views()');
            console.log('  ♻️  Refreshed performance views');
        } catch (error) {
            console.error('  ⚠️  Failed to refresh views:', error);
        }
    }

    /**
     * Get performance summary
     */
    async getPerformanceSummary(): Promise<void> {
        console.log('\n📈 Performance Summary (Last 30 Days)');
        console.log('═'.repeat(60));

        const query = `
            SELECT
                COUNT(*) as total_predictions,
                ROUND(AVG(CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END) * 100, 2) as direction_accuracy,
                ROUND(AVG(actual_return) * 100, 2) as avg_return,
                ROUND(AVG(market_return) * 100, 2) as avg_market_return,
                ROUND(AVG(relative_performance) * 100, 2) as avg_alpha,
                ROUND(AVG(predicted_confidence) * 100, 2) as avg_confidence
            FROM ml_outcomes
            WHERE outcome_timestamp >= NOW() - INTERVAL '30 days'
              AND data_complete = true
        `;

        const result = await this.pool.query(query);
        const stats = result.rows[0];

        if (stats.total_predictions > 0) {
            console.log(`Total Predictions:     ${stats.total_predictions}`);
            console.log(`Direction Accuracy:    ${stats.direction_accuracy}%`);
            console.log(`Average Return:        ${stats.avg_return}%`);
            console.log(`Market Return:         ${stats.avg_market_return}%`);
            console.log(`Average Alpha:         ${stats.avg_alpha}%`);
            console.log(`Average Confidence:    ${stats.avg_confidence}%`);
        } else {
            console.log('No outcomes tracked yet');
        }

        console.log('═'.repeat(60));
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        await this.pool.end();
    }
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);

    // Parse command line arguments
    let daysAgo = [7, 30, 60, 90]; // Default timeframes
    let limit: number | undefined;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--days' && args[i + 1]) {
            daysAgo = args[i + 1].split(',').map(d => parseInt(d.trim()));
            i++;
        } else if (args[i] === '--limit' && args[i + 1]) {
            limit = parseInt(args[i + 1]);
            i++;
        }
    }

    const tracker = new OutcomeTracker();

    try {
        // Track outcomes
        await tracker.track({ daysAgo, limit });

        // Show summary
        await tracker.getPerformanceSummary();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await tracker.close();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

export { OutcomeTracker };
