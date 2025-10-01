-- ====================
-- ML FEATURE STORE OPTIMIZATIONS
-- ====================
-- Materialized views and covering indexes for high-performance feature retrieval
-- Target: <100ms for 25 symbols × 50 features

-- ====================
-- MATERIALIZED VIEWS
-- ====================

-- Daily Feature Aggregation
-- Pre-computed daily feature vectors for common queries
CREATE MATERIALIZED VIEW IF NOT EXISTS ml_daily_feature_vectors AS
SELECT
    fs.ticker,
    DATE_TRUNC('day', fs.timestamp) AS feature_date,
    fd.feature_type,
    jsonb_object_agg(fd.feature_name, fs.value) AS features,
    array_agg(DISTINCT fd.feature_name) AS feature_names,
    COUNT(DISTINCT fs.feature_id) AS feature_count,
    AVG(fs.confidence_score) AS avg_confidence,
    AVG(fs.data_quality_score) AS avg_quality,
    MAX(fs.timestamp) AS latest_timestamp
FROM ml_feature_store fs
INNER JOIN ml_feature_definitions fd ON fs.feature_id = fd.feature_id
WHERE fs.validation_status = 'valid'
  AND fs.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY fs.ticker, DATE_TRUNC('day', fs.timestamp), fd.feature_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_features_ticker_date_type
    ON ml_daily_feature_vectors (ticker, feature_date DESC, feature_type);

CREATE INDEX IF NOT EXISTS idx_daily_features_date
    ON ml_daily_feature_vectors (feature_date DESC);

-- Latest Features by Symbol
-- Optimized view for real-time feature retrieval
CREATE MATERIALIZED VIEW IF NOT EXISTS ml_latest_feature_vectors AS
SELECT DISTINCT ON (fs.ticker, fs.feature_id)
    fs.ticker,
    fs.feature_id,
    fd.feature_name,
    fd.feature_type,
    fs.value,
    fs.confidence_score,
    fs.data_quality_score,
    fs.source_provider,
    fs.timestamp,
    fs.validation_status
FROM ml_feature_store fs
INNER JOIN ml_feature_definitions fd ON fs.feature_id = fd.feature_id
WHERE fs.validation_status = 'valid'
  AND fs.timestamp >= NOW() - INTERVAL '7 days'
ORDER BY fs.ticker, fs.feature_id, fs.timestamp DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_latest_features_ticker_feature
    ON ml_latest_feature_vectors (ticker, feature_id);

CREATE INDEX IF NOT EXISTS idx_latest_features_type
    ON ml_latest_feature_vectors (feature_type, ticker);

CREATE INDEX IF NOT EXISTS idx_latest_features_timestamp
    ON ml_latest_feature_vectors (timestamp DESC);

-- Feature Quality Summary
-- Aggregated quality metrics per symbol
CREATE MATERIALIZED VIEW IF NOT EXISTS ml_feature_quality_summary AS
SELECT
    fs.ticker,
    COUNT(DISTINCT fs.feature_id) AS total_features,
    COUNT(DISTINCT CASE WHEN fs.validation_status = 'valid' THEN fs.feature_id END) AS valid_features,
    AVG(fs.data_quality_score) AS avg_quality,
    AVG(fs.confidence_score) AS avg_confidence,
    MAX(fs.timestamp) AS latest_update,
    EXTRACT(EPOCH FROM (NOW() - MAX(fs.timestamp))) / 60 AS minutes_since_update,
    (COUNT(DISTINCT fs.feature_id)::float /
     (SELECT COUNT(*) FROM ml_feature_definitions WHERE is_active = true)) AS completeness
FROM ml_feature_store fs
WHERE fs.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY fs.ticker;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quality_summary_ticker
    ON ml_feature_quality_summary (ticker);

CREATE INDEX IF NOT EXISTS idx_quality_summary_completeness
    ON ml_feature_quality_summary (completeness DESC);

-- ====================
-- COVERING INDEXES FOR HOT QUERIES
-- ====================

-- Covering index for feature matrix retrieval (includes all needed columns)
CREATE INDEX IF NOT EXISTS idx_feature_matrix_covering
    ON ml_feature_store (ticker, feature_id, timestamp DESC)
    INCLUDE (value, confidence_score, data_quality_score, validation_status)
    WHERE validation_status = 'valid';

-- Covering index for feature type queries
CREATE INDEX IF NOT EXISTS idx_feature_type_covering
    ON ml_feature_store (ticker, timestamp DESC)
    INCLUDE (feature_id, value, confidence_score, data_quality_score)
    WHERE validation_status = 'valid';

-- Covering index for batch symbol retrieval
CREATE INDEX IF NOT EXISTS idx_batch_symbols_covering
    ON ml_feature_store (feature_id, timestamp DESC)
    INCLUDE (ticker, value, data_quality_score, source_provider)
    WHERE validation_status = 'valid';

-- ====================
-- REFRESH FUNCTIONS
-- ====================

-- Function to refresh materialized views concurrently (non-blocking)
CREATE OR REPLACE FUNCTION refresh_ml_feature_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY ml_daily_feature_vectors;
    REFRESH MATERIALIZED VIEW CONCURRENTLY ml_latest_feature_vectors;
    REFRESH MATERIALIZED VIEW CONCURRENTLY ml_feature_quality_summary;

    RAISE NOTICE 'ML feature materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to refresh views for specific ticker (faster for single symbol updates)
CREATE OR REPLACE FUNCTION refresh_ticker_features(p_ticker VARCHAR)
RETURNS void AS $$
BEGIN
    -- Delete and reinsert for the specific ticker in latest features view
    DELETE FROM ml_latest_feature_vectors WHERE ticker = p_ticker;

    INSERT INTO ml_latest_feature_vectors
    SELECT DISTINCT ON (fs.ticker, fs.feature_id)
        fs.ticker,
        fs.feature_id,
        fd.feature_name,
        fd.feature_type,
        fs.value,
        fs.confidence_score,
        fs.data_quality_score,
        fs.source_provider,
        fs.timestamp,
        fs.validation_status
    FROM ml_feature_store fs
    INNER JOIN ml_feature_definitions fd ON fs.feature_id = fd.feature_id
    WHERE fs.ticker = p_ticker
      AND fs.validation_status = 'valid'
      AND fs.timestamp >= NOW() - INTERVAL '7 days'
    ORDER BY fs.ticker, fs.feature_id, fs.timestamp DESC;

    RAISE NOTICE 'Features refreshed for ticker: %', p_ticker;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- SCHEDULED REFRESH
-- ====================

-- Create a scheduled job to refresh views every 15 minutes
-- (Requires pg_cron extension - install if not already present)
-- SELECT cron.schedule('refresh-ml-features', '*/15 * * * *', 'SELECT refresh_ml_feature_views()');

-- Alternative: Manual refresh schedule
-- Call this from application code every 15 minutes:
-- SELECT refresh_ml_feature_views();

-- ====================
-- PERFORMANCE MONITORING
-- ====================

-- View to monitor feature store performance
CREATE OR REPLACE VIEW ml_feature_store_stats AS
SELECT
    'Total Features' AS metric,
    COUNT(*)::TEXT AS value,
    NOW() AS measured_at
FROM ml_feature_store
UNION ALL
SELECT
    'Valid Features (24h)' AS metric,
    COUNT(*)::TEXT AS value,
    NOW() AS measured_at
FROM ml_feature_store
WHERE validation_status = 'valid'
  AND timestamp >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'Unique Symbols' AS metric,
    COUNT(DISTINCT ticker)::TEXT AS value,
    NOW() AS measured_at
FROM ml_feature_store
WHERE timestamp >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'Average Quality Score' AS metric,
    ROUND(AVG(data_quality_score)::numeric, 4)::TEXT AS value,
    NOW() AS measured_at
FROM ml_feature_store
WHERE validation_status = 'valid'
  AND timestamp >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'Features per Symbol (Avg)' AS metric,
    ROUND(AVG(feature_count)::numeric, 2)::TEXT AS value,
    NOW() AS measured_at
FROM (
    SELECT ticker, COUNT(DISTINCT feature_id) AS feature_count
    FROM ml_feature_store
    WHERE timestamp >= NOW() - INTERVAL '24 hours'
    GROUP BY ticker
) AS symbol_counts;

-- ====================
-- QUERY EXAMPLES
-- ====================

-- Example 1: Get latest feature vector for a symbol (optimized)
/*
SELECT
    ticker,
    jsonb_object_agg(feature_name, value) AS features,
    array_agg(feature_name) AS feature_names,
    AVG(data_quality_score) AS quality_score
FROM ml_latest_feature_vectors
WHERE ticker = 'AAPL'
  AND feature_type = 'TECHNICAL'
GROUP BY ticker;
*/

-- Example 2: Get feature matrix for multiple symbols (batch optimized)
/*
SELECT
    ticker,
    feature_type,
    jsonb_object_agg(feature_name, value) AS features,
    AVG(confidence_score) AS avg_confidence,
    AVG(data_quality_score) AS avg_quality
FROM ml_latest_feature_vectors
WHERE ticker = ANY(ARRAY['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA'])
GROUP BY ticker, feature_type
ORDER BY ticker;
*/

-- Example 3: Get feature quality metrics
/*
SELECT
    ticker,
    completeness,
    avg_quality,
    valid_features,
    total_features,
    minutes_since_update
FROM ml_feature_quality_summary
WHERE ticker = ANY(ARRAY['AAPL', 'GOOGL', 'MSFT'])
ORDER BY completeness DESC;
*/

-- ====================
-- MAINTENANCE COMMANDS
-- ====================

-- Analyze tables for query optimization
ANALYZE ml_feature_store;
ANALYZE ml_feature_definitions;
ANALYZE ml_daily_feature_vectors;
ANALYZE ml_latest_feature_vectors;
ANALYZE ml_feature_quality_summary;

-- Check index usage
/*
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'ml_%'
ORDER BY idx_scan DESC;
*/

-- Vacuum for performance
VACUUM ANALYZE ml_feature_store;
VACUUM ANALYZE ml_feature_definitions;

COMMENT ON MATERIALIZED VIEW ml_daily_feature_vectors IS 'Pre-aggregated daily feature vectors for efficient historical queries';
COMMENT ON MATERIALIZED VIEW ml_latest_feature_vectors IS 'Latest feature values per symbol for real-time retrieval (<100ms target)';
COMMENT ON MATERIALIZED VIEW ml_feature_quality_summary IS 'Quality metrics summary per symbol for data validation';
COMMENT ON FUNCTION refresh_ml_feature_views() IS 'Refresh all ML feature materialized views concurrently';
COMMENT ON FUNCTION refresh_ticker_features(VARCHAR) IS 'Refresh features for a specific ticker (faster than full refresh)';
