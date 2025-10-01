-- ====================
-- ML ENHANCEMENT SCHEMA - PHASE 1 (Fixed PostgreSQL Syntax)
-- ====================
-- Modular enhancement layer for VFR platform
-- Preserves existing functionality, adds ML as optional 6th factor

-- ML Enhancement Definitions
-- Stores ML enhancement configurations and metadata
CREATE TABLE IF NOT EXISTS ml_enhancement_definitions (
    enhancement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enhancement_name VARCHAR(255) NOT NULL UNIQUE,
    enhancement_type VARCHAR(50) NOT NULL CHECK (enhancement_type IN (
        'price_prediction', 'direction_classification', 'volatility_forecast',
        'factor_enhancement', 'composite_enhancement'
    )),
    target_factor VARCHAR(50) CHECK (target_factor IN (
        'technical', 'fundamental', 'sentiment', 'macro', 'options', 'composite'
    )),
    prediction_horizon VARCHAR(20) NOT NULL CHECK (prediction_horizon IN (
        '1h', '4h', '1d', '1w', '1m', '3m'
    )),
    enhancement_weight DECIMAL(3,2) DEFAULT 0.10 CHECK (enhancement_weight BETWEEN 0 AND 1),
    min_confidence_threshold DECIMAL(5,4) DEFAULT 0.50,
    is_active BOOLEAN DEFAULT true,
    tier_requirement VARCHAR(20) DEFAULT 'premium' CHECK (tier_requirement IN (
        'free', 'premium', 'enterprise'
    )),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enhancement_active ON ml_enhancement_definitions (is_active, enhancement_type);
CREATE INDEX IF NOT EXISTS idx_enhancement_factor ON ml_enhancement_definitions (target_factor, is_active);

-- ML Enhancement Store
-- Main storage for ML enhancements to VFR scores
CREATE TABLE IF NOT EXISTS ml_enhancement_store (
    ticker VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    enhancement_id UUID NOT NULL REFERENCES ml_enhancement_definitions(enhancement_id),

    -- VFR Integration Fields
    base_vfr_value DECIMAL(20,8),           -- Original VFR factor value
    enhanced_value DECIMAL(20,8),           -- ML-enhanced value
    enhanced_composite_value DECIMAL(20,8), -- Combined VFR + ML value

    -- ML Metadata
    confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    data_quality_score DECIMAL(5,4) CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    vfr_factor_name VARCHAR(100),           -- Which VFR factor was enhanced
    enhancement_weight DECIMAL(3,2) DEFAULT 0.10, -- Weight of ML in final score

    -- Performance Tracking
    enhancement_latency_ms INTEGER,
    models_used TEXT[],                     -- Array of model IDs used
    fallback_mode BOOLEAN DEFAULT false,    -- True if ML failed, used VFR only

    -- Validation and Audit
    validation_status VARCHAR(20) DEFAULT 'pending' CHECK (validation_status IN (
        'pending', 'valid', 'invalid', 'fallback', 'partial'
    )),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (ticker, timestamp, enhancement_id)
);

-- Performance indexes for ml_enhancement_store
CREATE INDEX IF NOT EXISTS idx_ticker_timestamp_desc ON ml_enhancement_store (ticker, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_enhancement_timestamp_desc ON ml_enhancement_store (enhancement_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vfr_factor_timestamp ON ml_enhancement_store (vfr_factor_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fallback_mode ON ml_enhancement_store (fallback_mode) WHERE fallback_mode = true;
CREATE INDEX IF NOT EXISTS idx_active_enhancements ON ml_enhancement_store (ticker, timestamp DESC, enhancement_id)
    WHERE validation_status = 'valid';

-- Feature Definitions
-- Defines features used by ML models
CREATE TABLE IF NOT EXISTS ml_feature_definitions (
    feature_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name VARCHAR(255) NOT NULL UNIQUE,
    feature_type VARCHAR(50) NOT NULL CHECK (feature_type IN (
        'technical', 'fundamental', 'sentiment', 'macro', 'options', 'custom'
    )),
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN (
        'float', 'integer', 'boolean', 'categorical', 'vector'
    )),
    description TEXT,
    source_apis TEXT[],                     -- Which VFR APIs provide this feature
    calculation_frequency VARCHAR(20) NOT NULL CHECK (calculation_frequency IN (
        '1m', '5m', '15m', '1h', '4h', '1d', 'weekly', 'monthly'
    )),
    is_active BOOLEAN DEFAULT true,
    feature_version INTEGER DEFAULT 1,
    normalization_params JSONB,             -- Min/max/mean/std for normalization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_type_active ON ml_feature_definitions (feature_type, is_active);
CREATE INDEX IF NOT EXISTS idx_source_apis_gin ON ml_feature_definitions USING GIN (source_apis);

-- Feature Store
-- Stores calculated features for ML models
CREATE TABLE IF NOT EXISTS ml_feature_store (
    ticker VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    feature_id UUID NOT NULL REFERENCES ml_feature_definitions(feature_id),
    value DECIMAL(20,8),
    confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    data_quality_score DECIMAL(5,4) CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    source_provider VARCHAR(100),           -- Which API provided the data
    validation_status VARCHAR(20) DEFAULT 'pending' CHECK (validation_status IN (
        'pending', 'valid', 'invalid', 'stale'
    )),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (ticker, timestamp, feature_id)
);

-- Performance indexes for ml_feature_store
CREATE INDEX IF NOT EXISTS idx_ticker_feature_timestamp ON ml_feature_store (ticker, feature_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_timestamp_desc ON ml_feature_store (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_quality_score ON ml_feature_store (data_quality_score) WHERE data_quality_score < 0.8;

-- ML Predictions
-- Stores ML prediction results
CREATE TABLE IF NOT EXISTS ml_predictions (
    prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(20) NOT NULL,
    prediction_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    enhancement_id UUID NOT NULL REFERENCES ml_enhancement_definitions(enhancement_id),

    -- Prediction Details
    prediction_horizon VARCHAR(20) NOT NULL,
    prediction_type VARCHAR(50) NOT NULL CHECK (prediction_type IN (
        'price_target', 'direction', 'volatility', 'probability'
    )),
    predicted_value DECIMAL(15,8) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),

    -- Context
    current_price DECIMAL(12,4) NOT NULL,
    base_vfr_score DECIMAL(10,4),           -- VFR score at prediction time
    enhanced_score DECIMAL(10,4),           -- Enhanced score with ML

    -- Performance Tracking
    actual_value DECIMAL(15,8),             -- Filled when actual known
    actual_timestamp TIMESTAMP WITH TIME ZONE,
    prediction_error DECIMAL(15,8),
    direction_correct BOOLEAN,

    -- Metadata
    execution_time_ms INTEGER,
    cache_hit BOOLEAN DEFAULT false,
    tier_used VARCHAR(20),                  -- Which tier made this prediction

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ml_predictions
CREATE INDEX IF NOT EXISTS idx_predictions_ticker_time ON ml_predictions (ticker, prediction_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_horizon ON ml_predictions (prediction_horizon, prediction_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_high_confidence ON ml_predictions (confidence_score DESC, prediction_timestamp DESC)
    WHERE confidence_score >= 0.8;

-- ML Models Registry
-- Tracks ML models available for predictions
CREATE TABLE IF NOT EXISTS ml_models (
    model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(255) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    model_type VARCHAR(100) NOT NULL CHECK (model_type IN (
        'linear_regression', 'logistic_regression', 'random_forest',
        'xgboost', 'lightgbm', 'lstm', 'transformer', 'ensemble'
    )),
    objective VARCHAR(100) NOT NULL CHECK (objective IN (
        'price_prediction', 'direction_classification', 'volatility_forecast',
        'factor_enhancement'
    )),
    target_variable VARCHAR(255) NOT NULL,
    prediction_horizon VARCHAR(20) NOT NULL,

    -- Performance Metrics
    validation_score DECIMAL(10,6),
    test_score DECIMAL(10,6),

    -- Tier Management
    tier_requirement VARCHAR(20) DEFAULT 'premium' CHECK (tier_requirement IN (
        'free', 'premium', 'enterprise'
    )),

    -- Status
    status VARCHAR(50) DEFAULT 'training' CHECK (status IN (
        'training', 'validated', 'deployed', 'shadow', 'deprecated'
    )),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(model_name, model_version)
);

CREATE INDEX IF NOT EXISTS idx_model_status ON ml_models (status, model_type);
CREATE INDEX IF NOT EXISTS idx_model_tier ON ml_models (tier_requirement, status);

-- User ML Tier Management
-- Extends existing user management with ML tiers
CREATE TABLE IF NOT EXISTS ml_user_tiers (
    user_id UUID PRIMARY KEY,
    ml_tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (ml_tier IN (
        'free', 'premium', 'enterprise'
    )),
    predictions_per_day INTEGER DEFAULT 100,
    max_symbols_per_request INTEGER DEFAULT 5,
    models_access TEXT[],                   -- Which models can be accessed
    enhancement_weight_override DECIMAL(3,2), -- Custom enhancement weight

    -- Usage Tracking
    predictions_used_today INTEGER DEFAULT 0,
    last_prediction_timestamp TIMESTAMP WITH TIME ZONE,
    total_predictions_lifetime INTEGER DEFAULT 0,

    -- Subscription
    tier_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tier_end_date DATE,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tier_active ON ml_user_tiers (ml_tier, is_active);
CREATE INDEX IF NOT EXISTS idx_usage_tracking ON ml_user_tiers (predictions_used_today, last_prediction_timestamp);

-- ML Performance Metrics
-- Tracks ML system performance
CREATE TABLE IF NOT EXISTS ml_performance_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL,

    -- Prediction Metrics
    total_predictions INTEGER DEFAULT 0,
    successful_predictions INTEGER DEFAULT 0,
    fallback_predictions INTEGER DEFAULT 0,

    -- Performance Metrics
    avg_latency_ms DECIMAL(10,2),
    p95_latency_ms DECIMAL(10,2),
    avg_confidence_score DECIMAL(5,4),
    cache_hit_ratio DECIMAL(5,4),

    -- Accuracy Metrics (when actuals available)
    direction_accuracy DECIMAL(5,4),
    mean_absolute_error DECIMAL(15,8),

    -- Usage by Tier
    free_tier_predictions INTEGER DEFAULT 0,
    premium_tier_predictions INTEGER DEFAULT 0,
    enterprise_tier_predictions INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(metric_date)
);

CREATE INDEX IF NOT EXISTS idx_metric_date ON ml_performance_metrics (metric_date DESC);

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
DROP TRIGGER IF EXISTS update_ml_enhancement_definitions_updated_at ON ml_enhancement_definitions;
CREATE TRIGGER update_ml_enhancement_definitions_updated_at
    BEFORE UPDATE ON ml_enhancement_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_ml_feature_definitions_updated_at ON ml_feature_definitions;
CREATE TRIGGER update_ml_feature_definitions_updated_at
    BEFORE UPDATE ON ml_feature_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_ml_models_updated_at ON ml_models;
CREATE TRIGGER update_ml_models_updated_at
    BEFORE UPDATE ON ml_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_ml_user_tiers_updated_at ON ml_user_tiers;
CREATE TRIGGER update_ml_user_tiers_updated_at
    BEFORE UPDATE ON ml_user_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Initial data for ML enhancement definitions
INSERT INTO ml_enhancement_definitions (
    enhancement_name,
    enhancement_type,
    target_factor,
    prediction_horizon,
    enhancement_weight,
    tier_requirement
) VALUES
    ('technical_1d_enhancement', 'factor_enhancement', 'technical', '1d', 0.10, 'premium'),
    ('sentiment_1w_enhancement', 'factor_enhancement', 'sentiment', '1w', 0.10, 'premium'),
    ('composite_1w_enhancement', 'composite_enhancement', 'composite', '1w', 0.10, 'enterprise'),
    ('price_direction_1d', 'direction_classification', NULL, '1d', 0.10, 'free')
ON CONFLICT (enhancement_name) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE ml_enhancement_store IS 'Modular ML enhancement layer - stores ML enhancements to VFR scores with 10% weight';
COMMENT ON TABLE ml_feature_store IS 'Feature store leveraging existing VFR 15+ API integrations';
COMMENT ON TABLE ml_predictions IS 'ML prediction results with fallback tracking';
COMMENT ON TABLE ml_user_tiers IS 'User tier management for ML upsell features';
COMMENT ON COLUMN ml_enhancement_store.enhancement_weight IS 'ML contribution weight (default 10% to maintain VFR dominance)';
COMMENT ON COLUMN ml_enhancement_store.fallback_mode IS 'True when ML fails and system uses VFR classic analysis';
