-- =====================================================================================
-- VFR API PostgreSQL Database Setup Script
-- Veritak Financial Research LLC - Financial Analysis Platform
-- Optimized for high-frequency financial data processing and real-time analytics
-- =====================================================================================

-- =====================================================================================
-- DATABASE AND ROLE CREATION
-- =====================================================================================

-- Create the main database (run as superuser)
-- Note: This should be run separately or with appropriate privileges
-- CREATE DATABASE vfr_api WITH
--     ENCODING 'UTF8'
--     LC_COLLATE 'en_US.UTF-8'
--     LC_CTYPE 'en_US.UTF-8'
--     TEMPLATE template0
--     CONNECTION LIMIT -1;

-- Create application role for secure database access
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vfr_app_role') THEN
        CREATE ROLE vfr_app_role LOGIN PASSWORD 'vfr_secure_app_password_2024';
    END IF;
END
$$;

-- Create read-only role for reporting and analytics
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vfr_read_role') THEN
        CREATE ROLE vfr_read_role LOGIN PASSWORD 'vfr_read_password_2024';
    END IF;
END
$$;

-- =====================================================================================
-- ESSENTIAL EXTENSIONS FOR FINANCIAL DATA PROCESSING
-- =====================================================================================

-- UUID generation for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Advanced indexing capabilities
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- JSON/JSONB indexing and operations
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Time-series data optimization (if TimescaleDB is available)
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Statistical functions for financial calculations
CREATE EXTENSION IF NOT EXISTS tablefunc;

-- Cryptographic functions for secure data handling
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================================
-- CORE FINANCIAL DATA TABLES
-- =====================================================================================

-- Market data and securities master
CREATE TABLE IF NOT EXISTS securities_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    exchange VARCHAR(20) NOT NULL,
    sector VARCHAR(100),
    industry VARCHAR(150),
    market_cap BIGINT,
    currency VARCHAR(3) DEFAULT 'USD',
    country VARCHAR(2) DEFAULT 'US',
    is_active BOOLEAN DEFAULT true,
    listing_date DATE,
    delisting_date DATE,

    -- Financial classification
    asset_class VARCHAR(20) CHECK (asset_class IN ('equity', 'bond', 'commodity', 'fx', 'crypto', 'derivative')),
    security_type VARCHAR(30),

    -- Trading information
    primary_exchange VARCHAR(20),
    tick_size DECIMAL(10,6),
    lot_size INTEGER DEFAULT 1,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data_source VARCHAR(50),

    -- Compliance and regulatory
    regulatory_status VARCHAR(20),
    compliance_notes TEXT
);

-- High-performance indexes for securities lookup
CREATE INDEX IF NOT EXISTS idx_securities_symbol ON securities_master(symbol);
CREATE INDEX IF NOT EXISTS idx_securities_exchange ON securities_master(exchange);
CREATE INDEX IF NOT EXISTS idx_securities_sector ON securities_master(sector);
CREATE INDEX IF NOT EXISTS idx_securities_active ON securities_master(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_securities_market_cap ON securities_master(market_cap DESC) WHERE market_cap IS NOT NULL;

-- Time-series market data (OHLCV)
CREATE TABLE IF NOT EXISTS market_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    interval_type VARCHAR(10) NOT NULL CHECK (interval_type IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M')),

    -- OHLCV data
    open_price DECIMAL(15,6) NOT NULL,
    high_price DECIMAL(15,6) NOT NULL,
    low_price DECIMAL(15,6) NOT NULL,
    close_price DECIMAL(15,6) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,

    -- Additional market data
    adjusted_close DECIMAL(15,6),
    vwap DECIMAL(15,6), -- Volume Weighted Average Price
    trade_count INTEGER,

    -- Data quality and source tracking
    data_source VARCHAR(50) NOT NULL,
    data_quality_score DECIMAL(4,3) CHECK (data_quality_score >= 0 AND data_quality_score <= 1),

    -- Regulatory and compliance
    is_official BOOLEAN DEFAULT true,
    exchange_timestamp TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure no duplicate data points
    CONSTRAINT unique_market_data UNIQUE (symbol, timestamp, interval_type, data_source)
);

-- High-performance indexes for market data queries
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_time ON market_data(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_time ON market_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_interval ON market_data(interval_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_volume ON market_data(volume DESC) WHERE volume > 0;

-- If TimescaleDB is available, convert to hypertable for optimal time-series performance
-- SELECT create_hypertable('market_data', 'timestamp', chunk_time_interval => INTERVAL '1 day');

-- Fundamental data storage
CREATE TABLE IF NOT EXISTS fundamental_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    period_end_date DATE NOT NULL,
    period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('Q', 'A', 'TTM')), -- Quarterly, Annual, Trailing Twelve Months

    -- Income Statement
    revenue BIGINT,
    gross_profit BIGINT,
    operating_income BIGINT,
    ebitda BIGINT,
    net_income BIGINT,
    eps DECIMAL(10,4),
    shares_outstanding BIGINT,

    -- Balance Sheet
    total_assets BIGINT,
    total_liabilities BIGINT,
    shareholders_equity BIGINT,
    cash_and_equivalents BIGINT,
    total_debt BIGINT,

    -- Cash Flow
    operating_cash_flow BIGINT,
    investing_cash_flow BIGINT,
    financing_cash_flow BIGINT,
    free_cash_flow BIGINT,

    -- Key Ratios
    pe_ratio DECIMAL(10,4),
    pb_ratio DECIMAL(10,4),
    debt_to_equity DECIMAL(10,4),
    roe DECIMAL(10,6),
    roa DECIMAL(10,6),
    current_ratio DECIMAL(10,4),

    -- Data quality and metadata
    data_source VARCHAR(50) NOT NULL,
    filing_date DATE,
    is_restated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_fundamental_data UNIQUE (symbol, period_end_date, period_type, data_source)
);

CREATE INDEX IF NOT EXISTS idx_fundamental_symbol_date ON fundamental_data(symbol, period_end_date DESC);
CREATE INDEX IF NOT EXISTS idx_fundamental_period_type ON fundamental_data(period_type, period_end_date DESC);

-- Economic indicators (FRED, BLS, etc.)
CREATE TABLE IF NOT EXISTS economic_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indicator_code VARCHAR(50) NOT NULL,
    indicator_name VARCHAR(200) NOT NULL,
    value DECIMAL(20,8) NOT NULL,
    date DATE NOT NULL,
    frequency VARCHAR(10) NOT NULL CHECK (frequency IN ('D', 'W', 'M', 'Q', 'A')),
    unit VARCHAR(50),

    -- Data source and quality
    data_source VARCHAR(50) NOT NULL,
    source_dataset VARCHAR(100),
    is_preliminary BOOLEAN DEFAULT false,
    is_revised BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ,

    CONSTRAINT unique_economic_indicator UNIQUE (indicator_code, date, data_source)
);

CREATE INDEX IF NOT EXISTS idx_economic_indicators_code_date ON economic_indicators(indicator_code, date DESC);
CREATE INDEX IF NOT EXISTS idx_economic_indicators_date ON economic_indicators(date DESC);
CREATE INDEX IF NOT EXISTS idx_economic_indicators_source ON economic_indicators(data_source);

-- =====================================================================================
-- USER MANAGEMENT AND AUTHENTICATION
-- =====================================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),

    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    email_verified_at TIMESTAMPTZ,

    -- Role and permissions
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'analyst', 'readonly')),
    permissions JSONB DEFAULT '[]',

    -- Security
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Preferences
    timezone VARCHAR(50) DEFAULT 'UTC',
    preferences JSONB DEFAULT '{}',

    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,

    -- Compliance
    terms_accepted_at TIMESTAMPTZ,
    privacy_accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;

-- User sessions for JWT token management
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- =====================================================================================
-- CACHE AND PERFORMANCE OPTIMIZATION TABLES
-- =====================================================================================

-- Application cache table for non-Redis fallback
CREATE TABLE IF NOT EXISTS app_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_cache_expires ON app_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_app_cache_accessed ON app_cache(last_accessed DESC);

-- API rate limiting and usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    response_time_ms INTEGER,
    status_code INTEGER,
    ip_address INET,
    user_agent TEXT,
    request_size INTEGER,
    response_size INTEGER
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_time ON api_usage(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage(timestamp DESC);

-- =====================================================================================
-- FINANCIAL CALCULATION AND ANALYTICS SUPPORT
-- =====================================================================================

-- Pre-calculated financial metrics cache
CREATE TABLE IF NOT EXISTS calculated_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20,8),
    calculation_date DATE NOT NULL,
    period_type VARCHAR(10) CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual')),

    -- Calculation metadata
    calculation_method VARCHAR(100),
    data_sources TEXT[],
    confidence_score DECIMAL(4,3),

    -- Performance tracking
    calculation_time_ms INTEGER,
    cache_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_calculated_metric UNIQUE (symbol, metric_name, calculation_date, period_type)
);

CREATE INDEX IF NOT EXISTS idx_calculated_metrics_symbol ON calculated_metrics(symbol, calculation_date DESC);
CREATE INDEX IF NOT EXISTS idx_calculated_metrics_name ON calculated_metrics(metric_name, calculation_date DESC);

-- =====================================================================================
-- AUDIT AND COMPLIANCE TABLES
-- =====================================================================================

-- Comprehensive audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    session_id UUID,

    -- Compliance fields
    reason TEXT,
    approval_required BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(changed_by, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON audit_log(changed_at DESC);

-- =====================================================================================
-- VIEWS FOR COMMON FINANCIAL QUERIES
-- =====================================================================================

-- Latest market data view
CREATE OR REPLACE VIEW v_latest_market_data AS
SELECT DISTINCT ON (symbol, interval_type)
    symbol,
    timestamp,
    interval_type,
    open_price,
    high_price,
    low_price,
    close_price,
    volume,
    adjusted_close,
    vwap,
    data_source,
    data_quality_score
FROM market_data
ORDER BY symbol, interval_type, timestamp DESC;

-- Securities with latest prices
CREATE OR REPLACE VIEW v_securities_with_prices AS
SELECT
    sm.*,
    md.close_price as last_price,
    md.volume as last_volume,
    md.timestamp as last_updated,
    md.data_quality_score
FROM securities_master sm
LEFT JOIN v_latest_market_data md ON sm.symbol = md.symbol AND md.interval_type = '1d'
WHERE sm.is_active = true;

-- =====================================================================================
-- FUNCTIONS FOR FINANCIAL CALCULATIONS
-- =====================================================================================

-- Calculate simple returns
CREATE OR REPLACE FUNCTION calculate_return(start_price DECIMAL, end_price DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF start_price IS NULL OR start_price = 0 OR end_price IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN (end_price - start_price) / start_price;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate log returns
CREATE OR REPLACE FUNCTION calculate_log_return(start_price DECIMAL, end_price DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF start_price IS NULL OR start_price <= 0 OR end_price IS NULL OR end_price <= 0 THEN
        RETURN NULL;
    END IF;
    RETURN LN(end_price / start_price);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to relevant tables
CREATE TRIGGER update_securities_master_timestamp
    BEFORE UPDATE ON securities_master
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- =====================================================================================
-- PERFORMANCE OPTIMIZATION
-- =====================================================================================

-- Analyze tables for optimal query planning
ANALYZE securities_master;
ANALYZE market_data;
ANALYZE fundamental_data;
ANALYZE economic_indicators;

-- =====================================================================================
-- SECURITY AND PERMISSIONS
-- =====================================================================================

-- Grant permissions to application role
GRANT CONNECT ON DATABASE vfr_api TO vfr_app_role;
GRANT USAGE ON SCHEMA public TO vfr_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vfr_app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vfr_app_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO vfr_app_role;

-- Grant read-only permissions to read role
GRANT CONNECT ON DATABASE vfr_api TO vfr_read_role;
GRANT USAGE ON SCHEMA public TO vfr_read_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO vfr_read_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO vfr_read_role;

-- Ensure future tables inherit permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vfr_app_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO vfr_read_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO vfr_app_role;

-- =====================================================================================
-- MAINTENANCE AND MONITORING
-- =====================================================================================

-- Create maintenance function for cleanup
CREATE OR REPLACE FUNCTION maintenance_cleanup()
RETURNS void AS $$
BEGIN
    -- Clean expired cache entries
    DELETE FROM app_cache WHERE expires_at < NOW();

    -- Clean old user sessions
    DELETE FROM user_sessions WHERE expires_at < NOW() OR (last_accessed < NOW() - INTERVAL '30 days' AND is_active = false);

    -- Archive old API usage data (keep 90 days)
    DELETE FROM api_usage WHERE timestamp < NOW() - INTERVAL '90 days';

    -- Update table statistics
    ANALYZE securities_master;
    ANALYZE market_data;
    ANALYZE fundamental_data;
    ANALYZE users;

    RAISE NOTICE 'Maintenance cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================================================
-- INITIAL DATA AND CONFIGURATION
-- =====================================================================================

-- Insert default admin user (password should be changed immediately)
INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified, email_verified_at, terms_accepted_at, privacy_accepted_at)
VALUES (
    'admin@veritak.com',
    crypt('change_this_password_immediately', gen_salt('bf', 12)),
    'System',
    'Administrator',
    'admin',
    true,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- =====================================================================================
-- COMPLETION MESSAGE
-- =====================================================================================

DO $$
BEGIN
    RAISE NOTICE '==================================================================================';
    RAISE NOTICE 'VFR API Database Setup Completed Successfully';
    RAISE NOTICE '==================================================================================';
    RAISE NOTICE 'Database: vfr_api';
    RAISE NOTICE 'Application Role: vfr_app_role';
    RAISE NOTICE 'Read-Only Role: vfr_read_role';
    RAISE NOTICE '==================================================================================';
    RAISE NOTICE 'IMPORTANT SECURITY NOTES:';
    RAISE NOTICE '1. Change default passwords immediately';
    RAISE NOTICE '2. Review and update role permissions as needed';
    RAISE NOTICE '3. Configure SSL/TLS for database connections';
    RAISE NOTICE '4. Set up regular backups and monitoring';
    RAISE NOTICE '==================================================================================';
END;
$$;