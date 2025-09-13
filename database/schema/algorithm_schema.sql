-- Dynamic Stock Selection Algorithm Database Schema
-- Optimized for high-frequency trading and real-time analytics
-- Integrates with existing DataFusionEngine for multi-source data quality

-- =====================================================================================
-- ALGORITHM CONFIGURATION TABLES
-- =====================================================================================

CREATE TABLE algorithm_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    algorithm_type VARCHAR(20) NOT NULL CHECK (algorithm_type IN
        ('momentum', 'mean_reversion', 'quality', 'value', 'growth', 'dividend', 'volatility', 'composite', 'custom')),
    enabled BOOLEAN DEFAULT true,
    selection_criteria VARCHAR(20) NOT NULL CHECK (selection_criteria IN
        ('score_based', 'rank_based', 'quantile_based', 'threshold_based')),

    -- Universe configuration (JSON for flexibility)
    universe_config JSONB NOT NULL,

    -- Algorithm weights (JSON array)
    weights_config JSONB NOT NULL,

    -- Selection parameters
    selection_config JSONB NOT NULL,

    -- Risk management parameters
    risk_config JSONB NOT NULL,

    -- Data fusion settings
    data_fusion_config JSONB NOT NULL,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL,
    version INTEGER DEFAULT 1,
    backtested_from TIMESTAMPTZ,
    backtested_to TIMESTAMPTZ,
    live_from TIMESTAMPTZ,

    -- Performance tracking
    is_active BOOLEAN DEFAULT false,
    last_execution TIMESTAMPTZ,
    execution_count BIGINT DEFAULT 0,

    CONSTRAINT valid_universe_config CHECK (
        universe_config ? 'maxPositions' AND
        (universe_config->>'maxPositions')::int > 0
    ),
    CONSTRAINT valid_selection_config CHECK (
        selection_config ? 'rebalanceFrequency' AND
        (selection_config->>'rebalanceFrequency')::int > 0
    )
);

-- Indexes for algorithm configuration queries
CREATE INDEX idx_algorithm_configs_type ON algorithm_configurations(algorithm_type);
CREATE INDEX idx_algorithm_configs_enabled ON algorithm_configurations(enabled) WHERE enabled = true;
CREATE INDEX idx_algorithm_configs_active ON algorithm_configurations(is_active) WHERE is_active = true;
CREATE INDEX idx_algorithm_configs_created_by ON algorithm_configurations(created_by);
CREATE INDEX idx_algorithm_configs_universe_gin ON algorithm_configurations USING GIN (universe_config);

-- =====================================================================================
-- STOCK SCORING AND RANKING TABLES
-- =====================================================================================

CREATE TABLE stock_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    algorithm_id UUID NOT NULL REFERENCES algorithm_configurations(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    overall_score NUMERIC(10,6) NOT NULL,

    -- Factor scores (JSON object)
    factor_scores JSONB NOT NULL,

    -- Data quality metrics from fusion engine
    data_quality_overall NUMERIC(4,3) NOT NULL CHECK (data_quality_overall >= 0 AND data_quality_overall <= 1),
    data_quality_metrics JSONB NOT NULL,
    data_quality_source VARCHAR(50) NOT NULL,

    -- Market data snapshot
    price NUMERIC(12,4) NOT NULL,
    volume BIGINT NOT NULL,
    market_cap BIGINT,
    sector VARCHAR(50),
    exchange VARCHAR(10),

    -- Algorithm-specific metrics
    algorithm_metrics JSONB NOT NULL,

    -- Timing
    score_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Composite index for primary queries
    CONSTRAINT unique_algorithm_symbol_timestamp UNIQUE (algorithm_id, symbol, score_timestamp)
);

-- High-performance indexes for stock scores
CREATE INDEX idx_stock_scores_algorithm_timestamp ON stock_scores(algorithm_id, score_timestamp DESC);
CREATE INDEX idx_stock_scores_symbol_timestamp ON stock_scores(symbol, score_timestamp DESC);
CREATE INDEX idx_stock_scores_overall_score ON stock_scores(algorithm_id, overall_score DESC, score_timestamp DESC);
CREATE INDEX idx_stock_scores_sector ON stock_scores(sector, score_timestamp DESC);
CREATE INDEX idx_stock_scores_data_quality ON stock_scores(data_quality_overall) WHERE data_quality_overall >= 0.7;
CREATE INDEX idx_stock_scores_factor_gin ON stock_scores USING GIN (factor_scores);

-- Partitioning by date for performance (monthly partitions)
SELECT create_hypertable('stock_scores', 'score_timestamp', chunk_time_interval => INTERVAL '1 month');

-- =====================================================================================
-- SELECTION RESULTS AND EXECUTION TRACKING
-- =====================================================================================

CREATE TABLE algorithm_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    algorithm_id UUID NOT NULL REFERENCES algorithm_configurations(id) ON DELETE CASCADE,
    run_id VARCHAR(50) NOT NULL,

    -- Execution context
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    execution_time_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN
        ('pending', 'running', 'completed', 'failed', 'cancelled')),

    -- Market context at execution time
    market_data JSONB,
    data_status JSONB,

    -- Current positions (for rebalancing algorithms)
    current_positions JSONB,

    -- Error information
    error_message TEXT,
    error_details JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE selection_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES algorithm_executions(id) ON DELETE CASCADE,
    algorithm_id UUID NOT NULL REFERENCES algorithm_configurations(id) ON DELETE CASCADE,

    -- Result metadata
    result_timestamp TIMESTAMPTZ NOT NULL,
    total_stocks_evaluated INTEGER NOT NULL,

    -- Performance metrics
    average_data_quality NUMERIC(4,3) NOT NULL,
    cache_hit_rate NUMERIC(4,3),
    data_fusion_conflicts INTEGER DEFAULT 0,

    -- Quality indicators
    data_completeness NUMERIC(4,3) NOT NULL,
    source_agreement NUMERIC(4,3) NOT NULL,
    freshness_score NUMERIC(4,3) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE selection_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    selection_result_id UUID NOT NULL REFERENCES selection_results(id) ON DELETE CASCADE,

    -- Stock selection
    symbol VARCHAR(10) NOT NULL,
    overall_score NUMERIC(10,6) NOT NULL,
    weight NUMERIC(6,4) NOT NULL CHECK (weight >= 0 AND weight <= 1),
    action VARCHAR(4) NOT NULL CHECK (action IN ('BUY', 'SELL', 'HOLD')),
    confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

    -- Reference to detailed score
    stock_score_id UUID REFERENCES stock_scores(id),

    -- Position details
    target_allocation NUMERIC(6,4),
    current_allocation NUMERIC(6,4),
    allocation_change NUMERIC(6,4),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for execution and results tracking
CREATE INDEX idx_algorithm_executions_algorithm_start ON algorithm_executions(algorithm_id, start_time DESC);
CREATE INDEX idx_algorithm_executions_status ON algorithm_executions(status, start_time DESC);
CREATE INDEX idx_algorithm_executions_run_id ON algorithm_executions(run_id);

CREATE INDEX idx_selection_results_algorithm_timestamp ON selection_results(algorithm_id, result_timestamp DESC);
CREATE INDEX idx_selection_results_execution ON selection_results(execution_id);
CREATE INDEX idx_selection_results_quality ON selection_results(average_data_quality DESC);

CREATE INDEX idx_selection_details_result ON selection_details(selection_result_id);
CREATE INDEX idx_selection_details_symbol ON selection_details(symbol);
CREATE INDEX idx_selection_details_action ON selection_details(action) WHERE action IN ('BUY', 'SELL');

-- =====================================================================================
-- PERFORMANCE TRACKING AND ANALYTICS
-- =====================================================================================

CREATE TABLE algorithm_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    algorithm_id UUID NOT NULL REFERENCES algorithm_configurations(id) ON DELETE CASCADE,

    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    measurement_type VARCHAR(20) NOT NULL CHECK (measurement_type IN
        ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'inception')),

    -- Return metrics
    total_return NUMERIC(10,6),
    annualized_return NUMERIC(10,6),
    sharpe_ratio NUMERIC(8,4),
    max_drawdown NUMERIC(8,4),
    volatility NUMERIC(8,4),

    -- Risk metrics
    beta NUMERIC(8,4),
    tracking_error NUMERIC(8,4),
    information_ratio NUMERIC(8,4),
    var_95 NUMERIC(8,4),
    expected_shortfall NUMERIC(8,4),

    -- Algorithm-specific metrics
    turnover NUMERIC(8,4),
    average_holding_period INTEGER, -- days
    win_rate NUMERIC(4,3),
    average_win NUMERIC(8,4),
    average_loss NUMERIC(8,4),
    data_quality_score NUMERIC(4,3),

    -- Attribution analysis (JSON)
    factor_attribution JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_period CHECK (period_end > period_start),
    CONSTRAINT unique_algorithm_period UNIQUE (algorithm_id, period_start, period_end, measurement_type)
);

CREATE INDEX idx_algorithm_performance_algorithm ON algorithm_performance(algorithm_id, period_end DESC);
CREATE INDEX idx_algorithm_performance_returns ON algorithm_performance(annualized_return DESC) WHERE annualized_return IS NOT NULL;
CREATE INDEX idx_algorithm_performance_sharpe ON algorithm_performance(sharpe_ratio DESC) WHERE sharpe_ratio IS NOT NULL;

-- =====================================================================================
-- FACTOR DEFINITIONS AND CALCULATIONS
-- =====================================================================================

CREATE TABLE factor_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    category VARCHAR(30) NOT NULL CHECK (category IN
        ('momentum', 'value', 'quality', 'growth', 'volatility', 'technical', 'fundamental', 'alternative')),
    description TEXT,

    -- Calculation requirements
    required_market_data TEXT[], -- Array of required market data fields
    required_fundamental_data TEXT[], -- Array of required fundamental fields
    required_technical_data TEXT[], -- Array of required technical indicators

    -- Caching configuration
    cache_enabled BOOLEAN DEFAULT true,
    cache_ttl_seconds INTEGER DEFAULT 300, -- 5 minutes default

    -- Computation complexity (for resource allocation)
    computation_complexity VARCHAR(10) CHECK (computation_complexity IN ('low', 'medium', 'high')),

    -- Enable/disable
    enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate common factors
INSERT INTO factor_definitions (name, category, description, required_market_data, computation_complexity) VALUES
('momentum_1m', 'momentum', '1-month price momentum', ARRAY['close'], 'low'),
('momentum_3m', 'momentum', '3-month price momentum', ARRAY['close'], 'low'),
('momentum_12m', 'momentum', '12-month price momentum', ARRAY['close'], 'low'),
('rsi_14d', 'technical', '14-day Relative Strength Index', ARRAY['close'], 'medium'),
('pe_ratio', 'value', 'Price-to-Earnings ratio', ARRAY['close'], 'low'),
('pb_ratio', 'value', 'Price-to-Book ratio', ARRAY['close'], 'low'),
('debt_equity', 'quality', 'Debt-to-Equity ratio', ARRAY[], 'low'),
('roe', 'quality', 'Return on Equity', ARRAY[], 'low'),
('revenue_growth', 'growth', 'Revenue growth rate', ARRAY[], 'medium'),
('volatility_30d', 'volatility', '30-day historical volatility', ARRAY['close'], 'medium');

-- =====================================================================================
-- CACHING AND OPTIMIZATION TABLES
-- =====================================================================================

CREATE TABLE algorithm_cache_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(200) NOT NULL,
    cache_type VARCHAR(20) NOT NULL CHECK (cache_type IN
        ('config', 'scores', 'selections', 'market_data', 'data_quality')),

    -- Cache performance metrics
    hit_count BIGINT DEFAULT 0,
    miss_count BIGINT DEFAULT 0,
    eviction_count BIGINT DEFAULT 0,
    average_fetch_time_ms NUMERIC(8,2),

    -- Last access
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_cache_key UNIQUE (cache_key)
);

-- =====================================================================================
-- MATERIALIZED VIEWS FOR COMMON QUERIES
-- =====================================================================================

-- Latest scores by algorithm
CREATE MATERIALIZED VIEW mv_latest_stock_scores AS
SELECT DISTINCT ON (algorithm_id, symbol)
    algorithm_id,
    symbol,
    overall_score,
    factor_scores,
    data_quality_overall,
    price,
    volume,
    market_cap,
    sector,
    score_timestamp
FROM stock_scores
ORDER BY algorithm_id, symbol, score_timestamp DESC;

CREATE UNIQUE INDEX idx_mv_latest_scores_pk ON mv_latest_stock_scores(algorithm_id, symbol);
CREATE INDEX idx_mv_latest_scores_score ON mv_latest_stock_scores(algorithm_id, overall_score DESC);

-- Algorithm performance summary
CREATE MATERIALIZED VIEW mv_algorithm_performance_summary AS
SELECT
    ac.id as algorithm_id,
    ac.name,
    ac.algorithm_type,
    ac.enabled,
    ac.is_active,
    COUNT(ae.id) as total_executions,
    COUNT(CASE WHEN ae.status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN ae.status = 'failed' THEN 1 END) as failed_executions,
    AVG(ae.execution_time_ms) as avg_execution_time_ms,
    MAX(ae.start_time) as last_execution,
    AVG(sr.average_data_quality) as avg_data_quality,
    AVG(sr.cache_hit_rate) as avg_cache_hit_rate
FROM algorithm_configurations ac
LEFT JOIN algorithm_executions ae ON ac.id = ae.algorithm_id
LEFT JOIN selection_results sr ON ae.id = sr.execution_id
GROUP BY ac.id, ac.name, ac.algorithm_type, ac.enabled, ac.is_active;

CREATE UNIQUE INDEX idx_mv_algorithm_summary_pk ON mv_algorithm_performance_summary(algorithm_id);

-- =====================================================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_algorithm_configurations_updated_at
    BEFORE UPDATE ON algorithm_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_factor_definitions_updated_at
    BEFORE UPDATE ON factor_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Refresh materialized views function
CREATE OR REPLACE FUNCTION refresh_algorithm_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_latest_stock_scores;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_algorithm_performance_summary;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================================
-- PARTITIONING AND RETENTION POLICIES
-- =====================================================================================

-- Retention policy for stock_scores (keep 1 year of detailed scores)
SELECT add_retention_policy('stock_scores', INTERVAL '1 year');

-- Continuous aggregates for time-based analytics
CREATE MATERIALIZED VIEW stock_scores_hourly
WITH (timescaledb.continuous) AS
SELECT
    algorithm_id,
    time_bucket('1 hour', score_timestamp) as hour_bucket,
    COUNT(*) as scores_calculated,
    AVG(overall_score) as avg_score,
    AVG(data_quality_overall) as avg_data_quality,
    MAX(score_timestamp) as latest_timestamp
FROM stock_scores
GROUP BY algorithm_id, time_bucket('1 hour', score_timestamp);

-- Automatically refresh the continuous aggregate
SELECT add_continuous_aggregate_policy('stock_scores_hourly',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes');

-- =====================================================================================
-- SECURITY AND ACCESS CONTROL
-- =====================================================================================

-- Row Level Security for multi-tenant support
ALTER TABLE algorithm_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE algorithm_executions ENABLE ROW LEVEL SECURITY;

-- Create policy for user access (assuming user_id context)
CREATE POLICY algorithm_user_access ON algorithm_configurations
    FOR ALL USING (created_by = current_setting('app.current_user', true));

-- Grant permissions to application role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_role;

-- =====================================================================================
-- MONITORING AND MAINTENANCE
-- =====================================================================================

-- View for monitoring algorithm performance
CREATE OR REPLACE VIEW v_algorithm_monitoring AS
SELECT
    ac.id,
    ac.name,
    ac.algorithm_type,
    ac.is_active,
    COUNT(ae.id) FILTER (WHERE ae.start_time >= NOW() - INTERVAL '24 hours') as executions_24h,
    COUNT(ae.id) FILTER (WHERE ae.status = 'failed' AND ae.start_time >= NOW() - INTERVAL '24 hours') as failures_24h,
    AVG(ae.execution_time_ms) FILTER (WHERE ae.start_time >= NOW() - INTERVAL '24 hours') as avg_execution_time_24h,
    MAX(ae.start_time) as last_execution,
    AVG(sr.average_data_quality) FILTER (WHERE sr.created_at >= NOW() - INTERVAL '24 hours') as avg_data_quality_24h
FROM algorithm_configurations ac
LEFT JOIN algorithm_executions ae ON ac.id = ae.algorithm_id
LEFT JOIN selection_results sr ON ae.id = sr.execution_id
WHERE ac.enabled = true
GROUP BY ac.id, ac.name, ac.algorithm_type, ac.is_active;

-- Index usage monitoring
CREATE OR REPLACE VIEW v_index_usage AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND (tablename LIKE '%algorithm%' OR tablename LIKE '%stock_scores%' OR tablename LIKE '%selection%')
ORDER BY idx_scan DESC;

COMMENT ON SCHEMA public IS 'Dynamic Stock Selection Algorithm Database Schema - Optimized for real-time trading and multi-source data fusion';