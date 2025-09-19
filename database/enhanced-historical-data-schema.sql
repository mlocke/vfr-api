-- =====================================================================================
-- Enhanced Historical Financial Data Cache Schema
-- Veritak Financial Research LLC - Optimized for Multi-Source Historical Data
-- Builds upon existing schema with specialized historical data structures
-- =====================================================================================

-- =====================================================================================
-- ENHANCED TIME-SERIES DATA STRUCTURES
-- =====================================================================================

-- Enhanced market data table with better source tracking and data quality
-- This extends the existing market_data table with additional optimizations
CREATE TABLE IF NOT EXISTS historical_market_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    date_only DATE NOT NULL GENERATED ALWAYS AS (timestamp::date) STORED,

    -- Timeframe classification
    timeframe VARCHAR(10) NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M', '1Q', '1Y')),

    -- Core OHLCV data with high precision
    open_price DECIMAL(18,8) NOT NULL,
    high_price DECIMAL(18,8) NOT NULL,
    low_price DECIMAL(18,8) NOT NULL,
    close_price DECIMAL(18,8) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,

    -- Additional market metrics
    adjusted_close DECIMAL(18,8),
    split_factor DECIMAL(10,6) DEFAULT 1.0,
    dividend_amount DECIMAL(10,6) DEFAULT 0.0,
    vwap DECIMAL(18,8), -- Volume Weighted Average Price
    trade_count INTEGER,

    -- Advanced market data
    bid_price DECIMAL(18,8),
    ask_price DECIMAL(18,8),
    spread DECIMAL(18,8),

    -- Data source and quality tracking
    primary_source VARCHAR(50) NOT NULL,
    source_priority INTEGER NOT NULL DEFAULT 5, -- 1=highest, 10=lowest
    data_quality_score DECIMAL(5,4) CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    confidence_level DECIMAL(3,2) CHECK (confidence_level >= 0 AND confidence_level <= 1),

    -- Data validation flags
    is_validated BOOLEAN DEFAULT false,
    has_anomaly BOOLEAN DEFAULT false,
    anomaly_type VARCHAR(50), -- 'price_spike', 'volume_spike', 'missing_data', etc.

    -- Caching and freshness
    cache_created_at TIMESTAMPTZ DEFAULT NOW(),
    cache_expires_at TIMESTAMPTZ,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    update_frequency INTERVAL DEFAULT '1 day', -- How often this data should be refreshed

    -- Source metadata
    source_timestamp TIMESTAMPTZ, -- Original timestamp from source
    source_response_time_ms INTEGER,
    source_api_version VARCHAR(20),

    -- Data lineage and audit
    source_request_id UUID,
    batch_id UUID,
    ingestion_method VARCHAR(20) DEFAULT 'api' CHECK (ingestion_method IN ('api', 'batch', 'manual', 'backfill')),

    -- Compliance and regulatory
    market_hours_flag BOOLEAN DEFAULT true, -- true if during market hours
    after_hours_flag BOOLEAN DEFAULT false,
    regulatory_halt BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate data from same source
    CONSTRAINT unique_historical_market_data UNIQUE (symbol, timestamp, timeframe, primary_source)
);

-- =====================================================================================
-- DATA SOURCE MANAGEMENT AND METADATA
-- =====================================================================================

-- Data source registry with health tracking
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    provider_type VARCHAR(50) NOT NULL, -- 'premium', 'free', 'government'

    -- API Configuration
    base_url VARCHAR(500),
    api_version VARCHAR(20),
    requires_auth BOOLEAN DEFAULT true,

    -- Rate limiting
    rate_limit_requests INTEGER DEFAULT 100,
    rate_limit_window_seconds INTEGER DEFAULT 60,
    daily_quota INTEGER,
    monthly_quota INTEGER,

    -- Data capabilities
    supports_real_time BOOLEAN DEFAULT false,
    supports_historical BOOLEAN DEFAULT true,
    max_historical_years INTEGER DEFAULT 20,
    supported_timeframes TEXT[], -- Array of supported intervals
    supported_symbols TEXT[], -- Array of supported symbol patterns

    -- Quality and reliability metrics
    reliability_score DECIMAL(3,2) DEFAULT 0.50 CHECK (reliability_score >= 0 AND reliability_score <= 1),
    average_response_time_ms INTEGER,
    uptime_percentage DECIMAL(5,2),
    data_quality_rating DECIMAL(3,2) DEFAULT 0.50,

    -- Operational status
    is_active BOOLEAN DEFAULT true,
    is_healthy BOOLEAN DEFAULT true,
    last_health_check TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,
    max_failures_before_disable INTEGER DEFAULT 5,

    -- Cost tracking
    cost_per_request DECIMAL(10,6),
    cost_per_symbol DECIMAL(10,6),
    monthly_cost_limit DECIMAL(10,2),
    current_monthly_cost DECIMAL(10,2) DEFAULT 0,

    -- Metadata
    description TEXT,
    documentation_url VARCHAR(500),
    terms_of_service_url VARCHAR(500),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- DATA FRESHNESS AND CACHE MANAGEMENT
-- =====================================================================================

-- Cache invalidation tracking
CREATE TABLE IF NOT EXISTS cache_invalidation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_name VARCHAR(100) NOT NULL UNIQUE,

    -- Rule conditions
    applies_to_symbol_pattern VARCHAR(50), -- SQL LIKE pattern for symbols
    applies_to_timeframe VARCHAR(10),
    applies_to_source VARCHAR(50),

    -- Invalidation triggers
    max_age_seconds INTEGER, -- Invalidate after N seconds
    market_event_trigger BOOLEAN DEFAULT false, -- Invalidate on market events
    trading_hours_only BOOLEAN DEFAULT true,

    -- Refresh strategy
    refresh_strategy VARCHAR(20) DEFAULT 'lazy' CHECK (refresh_strategy IN ('eager', 'lazy', 'scheduled')),
    refresh_priority INTEGER DEFAULT 5, -- 1=highest, 10=lowest

    -- Rule metadata
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data freshness tracking per symbol/timeframe
CREATE TABLE IF NOT EXISTS data_freshness_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    data_source VARCHAR(50) NOT NULL,

    -- Freshness metrics
    latest_data_timestamp TIMESTAMPTZ,
    last_successful_update TIMESTAMPTZ,
    last_update_attempt TIMESTAMPTZ,
    consecutive_update_failures INTEGER DEFAULT 0,

    -- Update scheduling
    next_scheduled_update TIMESTAMPTZ,
    update_frequency INTERVAL DEFAULT '1 hour',
    priority_score INTEGER DEFAULT 5, -- For update queue prioritization

    -- Data completeness
    expected_data_points INTEGER, -- Expected data points for timeframe
    actual_data_points INTEGER DEFAULT 0,
    completeness_ratio DECIMAL(5,4), -- actual/expected

    -- Quality metrics
    average_data_quality DECIMAL(5,4),
    anomaly_detection_score DECIMAL(5,4),

    -- Status tracking
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error', 'deprecated')),
    last_error_message TEXT,
    error_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_freshness_tracking UNIQUE (symbol, timeframe, data_source)
);

-- =====================================================================================
-- MULTI-SOURCE DATA CONFLICT RESOLUTION
-- =====================================================================================

-- Data source conflicts and resolution
CREATE TABLE IF NOT EXISTS data_source_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    timeframe VARCHAR(10) NOT NULL,

    -- Conflicting sources
    primary_source VARCHAR(50) NOT NULL,
    conflicting_source VARCHAR(50) NOT NULL,

    -- Conflict details
    conflict_type VARCHAR(50) NOT NULL, -- 'price_variance', 'volume_variance', 'missing_data'
    variance_percentage DECIMAL(8,4),
    primary_value DECIMAL(18,8),
    conflicting_value DECIMAL(18,8),

    -- Resolution
    resolution_strategy VARCHAR(50), -- 'use_primary', 'use_average', 'use_highest_quality', 'manual_review'
    resolved_value DECIMAL(18,8),
    resolved_by VARCHAR(50), -- 'system' or user_id
    resolution_confidence DECIMAL(3,2),

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
    requires_manual_review BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Data quality aggregation by source and symbol
CREATE TABLE IF NOT EXISTS data_quality_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20),
    data_source VARCHAR(50) NOT NULL,
    timeframe VARCHAR(10),
    date_period DATE NOT NULL, -- Daily aggregation

    -- Quality metrics
    total_data_points INTEGER DEFAULT 0,
    valid_data_points INTEGER DEFAULT 0,
    anomalous_data_points INTEGER DEFAULT 0,
    missing_data_points INTEGER DEFAULT 0,

    -- Performance metrics
    average_response_time_ms INTEGER,
    success_rate DECIMAL(5,4),
    error_rate DECIMAL(5,4),

    -- Variance and accuracy
    price_variance_vs_consensus DECIMAL(8,4),
    volume_variance_vs_consensus DECIMAL(8,4),

    -- Derived scores
    overall_quality_score DECIMAL(5,4),
    reliability_score DECIMAL(5,4),
    timeliness_score DECIMAL(5,4),

    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_quality_metrics UNIQUE (symbol, data_source, timeframe, date_period)
);

-- =====================================================================================
-- BULK DATA OPERATIONS AND BATCH PROCESSING
-- =====================================================================================

-- Batch job tracking for bulk operations
CREATE TABLE IF NOT EXISTS bulk_data_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(200) NOT NULL,
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('backfill', 'migration', 'reconciliation', 'cleanup')),

    -- Job parameters
    symbols TEXT[], -- Array of symbols to process
    start_date DATE,
    end_date DATE,
    timeframes TEXT[], -- Array of timeframes
    data_sources TEXT[], -- Array of sources

    -- Job configuration
    batch_size INTEGER DEFAULT 1000,
    parallel_workers INTEGER DEFAULT 4,
    retry_attempts INTEGER DEFAULT 3,
    priority INTEGER DEFAULT 5,

    -- Progress tracking
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    successful_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    skipped_items INTEGER DEFAULT 0,

    -- Status and timing
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_completion TIMESTAMPTZ,

    -- Error handling
    last_error_message TEXT,
    error_log_location VARCHAR(500),

    -- Metadata
    created_by UUID REFERENCES users(id),
    configuration JSONB, -- Flexible job configuration
    results_summary JSONB, -- Job completion summary

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detailed job execution log
CREATE TABLE IF NOT EXISTS bulk_job_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES bulk_data_jobs(id) ON DELETE CASCADE,

    -- Log entry details
    log_level VARCHAR(10) NOT NULL CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
    message TEXT NOT NULL,

    -- Context
    symbol VARCHAR(20),
    timeframe VARCHAR(10),
    data_source VARCHAR(50),
    batch_number INTEGER,
    item_index INTEGER,

    -- Metrics
    execution_time_ms INTEGER,
    memory_usage_mb INTEGER,

    -- Additional data
    metadata JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- =====================================================================================

-- Critical indexes for historical_market_data
CREATE INDEX IF NOT EXISTS idx_historical_symbol_date_timeframe ON historical_market_data(symbol, date_only DESC, timeframe);
CREATE INDEX IF NOT EXISTS idx_historical_timestamp_desc ON historical_market_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_historical_symbol_timeframe_source ON historical_market_data(symbol, timeframe, primary_source);
CREATE INDEX IF NOT EXISTS idx_historical_cache_expires ON historical_market_data(cache_expires_at) WHERE cache_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_historical_quality_score ON historical_market_data(data_quality_score DESC) WHERE data_quality_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_historical_anomaly ON historical_market_data(symbol, has_anomaly) WHERE has_anomaly = true;

-- Indexes for data source management
CREATE INDEX IF NOT EXISTS idx_data_sources_active ON data_sources(is_active, is_healthy) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_data_sources_reliability ON data_sources(reliability_score DESC);

-- Indexes for freshness tracking
CREATE INDEX IF NOT EXISTS idx_freshness_symbol_timeframe ON data_freshness_tracking(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_freshness_next_update ON data_freshness_tracking(next_scheduled_update) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_freshness_priority ON data_freshness_tracking(priority_score, next_scheduled_update);

-- Indexes for conflict resolution
CREATE INDEX IF NOT EXISTS idx_conflicts_pending ON data_source_conflicts(status, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_conflicts_symbol_timestamp ON data_source_conflicts(symbol, timestamp DESC);

-- Indexes for bulk operations
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status ON bulk_data_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_job_log_job_level ON bulk_job_log(job_id, log_level, created_at DESC);

-- =====================================================================================
-- PARTITIONING STRATEGY FOR LARGE DATASETS
-- =====================================================================================

-- Create partitioned table for high-volume intraday data
-- This will be manually partitioned by date ranges
CREATE TABLE IF NOT EXISTS historical_intraday_data (
    LIKE historical_market_data INCLUDING ALL
) PARTITION BY RANGE (date_only);

-- Create monthly partitions for current and future data
-- Example partitions (would be created dynamically)
-- CREATE TABLE historical_intraday_data_2024_01 PARTITION OF historical_intraday_data
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- =====================================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================================================

-- Latest data by symbol and timeframe
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_latest_historical_data AS
SELECT DISTINCT ON (symbol, timeframe)
    symbol,
    timeframe,
    timestamp,
    close_price,
    volume,
    primary_source,
    data_quality_score,
    last_updated_at
FROM historical_market_data
WHERE data_quality_score > 0.8
ORDER BY symbol, timeframe, timestamp DESC;

CREATE UNIQUE INDEX ON mv_latest_historical_data(symbol, timeframe);

-- Data completeness summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_data_completeness AS
SELECT
    symbol,
    timeframe,
    primary_source,
    DATE_TRUNC('month', date_only) as month,
    COUNT(*) as total_records,
    COUNT(CASE WHEN data_quality_score > 0.8 THEN 1 END) as high_quality_records,
    AVG(data_quality_score) as avg_quality_score,
    MAX(timestamp) as latest_data,
    MIN(timestamp) as earliest_data
FROM historical_market_data
GROUP BY symbol, timeframe, primary_source, DATE_TRUNC('month', date_only);

CREATE INDEX ON mv_data_completeness(symbol, timeframe, month DESC);

-- =====================================================================================
-- STORED PROCEDURES FOR CACHE MANAGEMENT
-- =====================================================================================

-- Intelligent cache invalidation procedure
CREATE OR REPLACE FUNCTION invalidate_stale_cache()
RETURNS INTEGER AS $$
DECLARE
    invalidated_count INTEGER := 0;
    rule RECORD;
BEGIN
    -- Process each invalidation rule
    FOR rule IN SELECT * FROM cache_invalidation_rules WHERE is_active = true LOOP

        -- Apply time-based invalidation
        IF rule.max_age_seconds IS NOT NULL THEN
            WITH invalidated AS (
                UPDATE historical_market_data
                SET cache_expires_at = NOW()
                WHERE cache_expires_at > NOW()
                  AND (symbol LIKE COALESCE(rule.applies_to_symbol_pattern, '%'))
                  AND (timeframe = COALESCE(rule.applies_to_timeframe, timeframe))
                  AND (primary_source = COALESCE(rule.applies_to_source, primary_source))
                  AND (EXTRACT(EPOCH FROM (NOW() - cache_created_at)) > rule.max_age_seconds)
                RETURNING 1
            )
            SELECT COUNT(*) FROM invalidated INTO invalidated_count;
        END IF;

    END LOOP;

    RETURN invalidated_count;
END;
$$ LANGUAGE plpgsql;

-- Data quality assessment procedure
CREATE OR REPLACE FUNCTION assess_data_quality(
    p_symbol VARCHAR(20),
    p_timeframe VARCHAR(10),
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE(
    source VARCHAR(50),
    quality_score DECIMAL(5,4),
    completeness DECIMAL(5,4),
    anomaly_count INTEGER,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH source_stats AS (
        SELECT
            primary_source,
            COUNT(*) as total_points,
            AVG(data_quality_score) as avg_quality,
            COUNT(CASE WHEN has_anomaly THEN 1 END) as anomalies,
            -- Calculate expected data points based on timeframe
            CASE
                WHEN p_timeframe = '1d' THEN (p_end_date - p_start_date + 1)
                WHEN p_timeframe = '1h' THEN (p_end_date - p_start_date + 1) * 24
                ELSE (p_end_date - p_start_date + 1) * 390 -- Assuming 6.5 hour trading day for minute data
            END as expected_points
        FROM historical_market_data
        WHERE symbol = p_symbol
          AND timeframe = p_timeframe
          AND date_only BETWEEN p_start_date AND p_end_date
        GROUP BY primary_source
    )
    SELECT
        ss.primary_source::VARCHAR(50),
        ROUND(ss.avg_quality, 4)::DECIMAL(5,4),
        ROUND(ss.total_points::DECIMAL / GREATEST(ss.expected_points, 1), 4)::DECIMAL(5,4),
        ss.anomalies::INTEGER,
        CASE
            WHEN ss.avg_quality > 0.9 AND (ss.total_points::DECIMAL / ss.expected_points) > 0.95 THEN 'Excellent - Primary source candidate'
            WHEN ss.avg_quality > 0.8 AND (ss.total_points::DECIMAL / ss.expected_points) > 0.85 THEN 'Good - Suitable for most analysis'
            WHEN ss.avg_quality > 0.6 OR (ss.total_points::DECIMAL / ss.expected_points) > 0.70 THEN 'Fair - Use with caution'
            ELSE 'Poor - Consider alternative source'
        END::TEXT
    FROM source_stats ss
    ORDER BY ss.avg_quality DESC, (ss.total_points::DECIMAL / ss.expected_points) DESC;
END;
$$ LANGUAGE plpgsql;

-- Bulk data population procedure
CREATE OR REPLACE FUNCTION populate_historical_data(
    p_job_id UUID,
    p_symbols TEXT[],
    p_start_date DATE,
    p_end_date DATE,
    p_timeframes TEXT[] DEFAULT ARRAY['1d'],
    p_batch_size INTEGER DEFAULT 1000
)
RETURNS BOOLEAN AS $$
DECLARE
    total_combinations INTEGER;
    processed_count INTEGER := 0;
    success_count INTEGER := 0;
    symbol VARCHAR(20);
    timeframe VARCHAR(10);
BEGIN
    -- Calculate total work
    total_combinations := array_length(p_symbols, 1) * array_length(p_timeframes, 1);

    -- Update job status
    UPDATE bulk_data_jobs
    SET status = 'running',
        started_at = NOW(),
        total_items = total_combinations
    WHERE id = p_job_id;

    -- Process each symbol/timeframe combination
    FOREACH symbol IN ARRAY p_symbols LOOP
        FOREACH timeframe IN ARRAY p_timeframes LOOP
            BEGIN
                -- This would call external API and insert data
                -- For now, just log the attempt
                INSERT INTO bulk_job_log (job_id, log_level, message, symbol, timeframe)
                VALUES (p_job_id, 'INFO', 'Processing historical data', symbol, timeframe);

                processed_count := processed_count + 1;
                success_count := success_count + 1;

                -- Update progress periodically
                IF processed_count % 100 = 0 THEN
                    UPDATE bulk_data_jobs
                    SET processed_items = processed_count,
                        successful_items = success_count,
                        updated_at = NOW()
                    WHERE id = p_job_id;
                END IF;

            EXCEPTION WHEN OTHERS THEN
                INSERT INTO bulk_job_log (job_id, log_level, message, symbol, timeframe)
                VALUES (p_job_id, 'ERROR', SQLERRM, symbol, timeframe);

                processed_count := processed_count + 1;
            END;
        END LOOP;
    END LOOP;

    -- Complete the job
    UPDATE bulk_data_jobs
    SET status = 'completed',
        completed_at = NOW(),
        processed_items = processed_count,
        successful_items = success_count,
        failed_items = processed_count - success_count
    WHERE id = p_job_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================================
-- TRIGGERS FOR AUTOMATED MAINTENANCE
-- =====================================================================================

-- Update data freshness tracking when new data is inserted
CREATE OR REPLACE FUNCTION update_freshness_tracking()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO data_freshness_tracking (
        symbol, timeframe, data_source, latest_data_timestamp,
        last_successful_update, actual_data_points
    )
    VALUES (
        NEW.symbol, NEW.timeframe, NEW.primary_source, NEW.timestamp,
        NOW(), 1
    )
    ON CONFLICT (symbol, timeframe, data_source)
    DO UPDATE SET
        latest_data_timestamp = GREATEST(data_freshness_tracking.latest_data_timestamp, NEW.timestamp),
        last_successful_update = NOW(),
        actual_data_points = data_freshness_tracking.actual_data_points + 1,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_freshness_tracking
    AFTER INSERT ON historical_market_data
    FOR EACH ROW EXECUTE FUNCTION update_freshness_tracking();

-- Auto-expire cache based on rules
CREATE OR REPLACE FUNCTION auto_expire_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Set cache expiration based on data age and timeframe
    NEW.cache_expires_at := CASE
        WHEN NEW.timeframe IN ('1m', '5m') THEN NEW.cache_created_at + INTERVAL '5 minutes'
        WHEN NEW.timeframe IN ('15m', '30m') THEN NEW.cache_created_at + INTERVAL '15 minutes'
        WHEN NEW.timeframe = '1h' THEN NEW.cache_created_at + INTERVAL '1 hour'
        WHEN NEW.timeframe = '1d' THEN NEW.cache_created_at + INTERVAL '1 day'
        ELSE NEW.cache_created_at + INTERVAL '1 hour'
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_expire_cache
    BEFORE INSERT ON historical_market_data
    FOR EACH ROW EXECUTE FUNCTION auto_expire_cache();

-- =====================================================================================
-- INITIAL DATA POPULATION
-- =====================================================================================

-- Insert initial data source configurations
INSERT INTO data_sources (name, provider_type, supports_real_time, supports_historical, reliability_score, data_quality_rating) VALUES
    ('Polygon', 'premium', true, true, 0.95, 0.98),
    ('Alpha Vantage', 'premium', true, true, 0.90, 0.85),
    ('Financial Modeling Prep', 'premium', false, true, 0.85, 0.80),
    ('Yahoo Finance', 'free', true, true, 0.75, 0.70),
    ('Twelve Data', 'premium', true, true, 0.88, 0.82)
ON CONFLICT (name) DO UPDATE SET
    updated_at = NOW();

-- Insert default cache invalidation rules
INSERT INTO cache_invalidation_rules (rule_name, applies_to_timeframe, max_age_seconds, refresh_strategy) VALUES
    ('Intraday High Frequency', '1m', 300, 'eager'),      -- 5 minutes for 1-minute data
    ('Intraday Medium Frequency', '5m', 900, 'eager'),    -- 15 minutes for 5-minute data
    ('Hourly Data', '1h', 3600, 'lazy'),                  -- 1 hour for hourly data
    ('Daily Data', '1d', 86400, 'scheduled'),             -- 1 day for daily data
    ('Weekly Data', '1w', 604800, 'scheduled')            -- 1 week for weekly data
ON CONFLICT (rule_name) DO NOTHING;

-- =====================================================================================
-- COMPLETION AND MONITORING
-- =====================================================================================

-- Create a monitoring view for system health
CREATE OR REPLACE VIEW v_system_health AS
SELECT
    'Data Sources' as component,
    COUNT(*) as total,
    COUNT(CASE WHEN is_healthy THEN 1 END) as healthy,
    ROUND(AVG(reliability_score), 3) as avg_reliability
FROM data_sources WHERE is_active = true
UNION ALL
SELECT
    'Cache Hit Rate' as component,
    COUNT(*) as total,
    COUNT(CASE WHEN cache_expires_at > NOW() THEN 1 END) as cached,
    ROUND(COUNT(CASE WHEN cache_expires_at > NOW() THEN 1 END)::DECIMAL / COUNT(*), 3) as cache_ratio
FROM historical_market_data
WHERE created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT
    'Data Quality' as component,
    COUNT(*) as total,
    COUNT(CASE WHEN data_quality_score > 0.8 THEN 1 END) as high_quality,
    ROUND(AVG(data_quality_score), 3) as avg_quality
FROM historical_market_data
WHERE created_at > NOW() - INTERVAL '24 hours';

RAISE NOTICE '==================================================================================';
RAISE NOTICE 'Enhanced Historical Financial Data Cache Schema Completed';
RAISE NOTICE '==================================================================================';
RAISE NOTICE 'Key Features:';
RAISE NOTICE '- Multi-source historical data caching with conflict resolution';
RAISE NOTICE '- Intelligent cache invalidation and freshness tracking';
RAISE NOTICE '- Data quality scoring and source reliability metrics';
RAISE NOTICE '- Bulk data operations with batch job tracking';
RAISE NOTICE '- Performance-optimized indexes and partitioning support';
RAISE NOTICE '- Automated maintenance and monitoring capabilities';
RAISE NOTICE '==================================================================================';