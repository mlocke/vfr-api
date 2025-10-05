-- ====================
-- ML Outcomes Tracking - Phase 1 Production Feedback Loop
-- ====================
-- Extends ml_predictions table with outcome tracking
-- Enables real-world performance measurement

-- ML Outcomes table
-- Tracks actual stock performance vs predictions
CREATE TABLE IF NOT EXISTS ml_outcomes (
    outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID NOT NULL REFERENCES ml_predictions(prediction_id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,

    -- Timeframes
    prediction_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    outcome_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    days_elapsed INTEGER NOT NULL,

    -- Prediction values (copied from ml_predictions for convenience)
    predicted_direction VARCHAR(10) NOT NULL, -- UP, DOWN, NEUTRAL
    predicted_value DECIMAL(15,8),
    predicted_confidence DECIMAL(5,4) NOT NULL,

    -- Actual outcomes
    initial_price DECIMAL(12,4) NOT NULL,
    final_price DECIMAL(12,4) NOT NULL,
    actual_return DECIMAL(10,6) NOT NULL, -- (final - initial) / initial
    actual_direction VARCHAR(10) NOT NULL, -- UP, DOWN, NEUTRAL

    -- Performance metrics
    direction_correct BOOLEAN NOT NULL,
    return_error DECIMAL(10,6), -- abs(predicted - actual)
    confidence_calibration DECIMAL(5,4), -- How well confidence matched accuracy

    -- Context
    market_return DECIMAL(10,6), -- SPY return for same period
    sector_return DECIMAL(10,6), -- Sector return for same period
    relative_performance DECIMAL(10,6), -- Stock return - market return

    -- Quality
    data_complete BOOLEAN DEFAULT true,
    outlier_flag BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_returns CHECK (
        actual_return BETWEEN -1.0 AND 10.0 AND
        (market_return IS NULL OR market_return BETWEEN -1.0 AND 10.0) AND
        (sector_return IS NULL OR sector_return BETWEEN -1.0 AND 10.0)
    )
);

-- Indexes for ml_outcomes
CREATE INDEX IF NOT EXISTS idx_outcomes_ticker_time ON ml_outcomes (ticker, outcome_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_prediction ON ml_outcomes (prediction_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_direction_correct ON ml_outcomes (direction_correct, outcome_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_days_elapsed ON ml_outcomes (days_elapsed);

-- Model Performance Summary (Materialized View)
-- Daily aggregated performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS ml_daily_performance AS
SELECT
    DATE(outcome_timestamp) as date,
    COUNT(*) as total_predictions,

    -- Direction accuracy
    SUM(CASE WHEN direction_correct THEN 1 ELSE 0 END) as correct_predictions,
    ROUND(AVG(CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END), 4) as direction_accuracy,

    -- Return metrics
    AVG(actual_return) as avg_actual_return,
    AVG(market_return) as avg_market_return,
    AVG(relative_performance) as avg_relative_performance,

    -- Error metrics
    AVG(ABS(return_error)) as mean_absolute_error,
    STDDEV(return_error) as return_error_stddev,

    -- Confidence analysis
    AVG(predicted_confidence) as avg_confidence,

    -- By confidence buckets
    AVG(CASE WHEN predicted_confidence >= 0.8 THEN CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END END) as high_confidence_accuracy,
    AVG(CASE WHEN predicted_confidence < 0.6 THEN CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END END) as low_confidence_accuracy,

    -- Sharpe-like metric (return / volatility)
    CASE
        WHEN STDDEV(actual_return) > 0 THEN AVG(actual_return) / STDDEV(actual_return)
        ELSE NULL
    END as sharpe_ratio

FROM ml_outcomes
WHERE data_complete = true AND outlier_flag = false
GROUP BY DATE(outcome_timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_daily_perf_date ON ml_daily_performance(date DESC);

-- Stock-level performance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS ml_stock_performance AS
SELECT
    ticker,
    COUNT(*) as total_predictions,
    AVG(CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END) as direction_accuracy,
    AVG(actual_return) as avg_return,
    AVG(relative_performance) as avg_relative_performance,
    MAX(outcome_timestamp) as last_outcome_timestamp
FROM ml_outcomes
WHERE data_complete = true AND outlier_flag = false
GROUP BY ticker
HAVING COUNT(*) >= 3; -- Only stocks with 3+ predictions

CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_stock_perf_ticker ON ml_stock_performance(ticker);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_ml_performance_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY ml_daily_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY ml_stock_performance;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE ml_outcomes IS 'Production feedback loop - tracks actual outcomes vs ML predictions';
COMMENT ON COLUMN ml_outcomes.direction_correct IS 'True if predicted direction matched actual direction';
COMMENT ON COLUMN ml_outcomes.confidence_calibration IS 'Measures if confidence scores are well-calibrated';
COMMENT ON COLUMN ml_outcomes.relative_performance IS 'Stock return minus market return (alpha)';
COMMENT ON MATERIALIZED VIEW ml_daily_performance IS 'Daily aggregated ML model performance metrics';
COMMENT ON MATERIALIZED VIEW ml_stock_performance IS 'Per-stock ML prediction performance';
