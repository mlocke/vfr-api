# VFR ML Database Architecture - Production-Ready Schema Design

**Enterprise-Grade Database Design for Financial ML Feature Store and Model Management**

## Executive Summary

This document provides a comprehensive database architecture for VFR's ML prediction engine, built on the existing PostgreSQL + Redis + InfluxDB infrastructure. The design supports 10+ years of historical data, real-time feature serving with <100ms latency, and enterprise-grade model management with version control and performance tracking.

## Database Architecture Overview

### Multi-Tier Storage Strategy

```
Data Type           Storage Layer       Performance Target    Retention Policy
├── Real-time Features  → Redis Cache     → <10ms access      → 1 hour TTL
├── ML Models          → PostgreSQL      → <50ms load        → Permanent
├── Training Data      → PostgreSQL      → <2s batch query   → 10+ years
├── Predictions        → PostgreSQL      → <20ms lookup      → 90 days
├── Time-series        → InfluxDB        → <100ms aggregate  → 7 years
└── Large Datasets     → S3/DVC         → Background load   → Permanent
```

### Integration with Existing VFR Infrastructure

**Extends Current Architecture**:
- **PostgreSQL**: Primary storage for ML metadata, features, and results
- **Redis**: High-performance caching for predictions and features
- **InfluxDB**: Time-series storage for high-frequency market data (optional)
- **Connection Pooling**: Leverages existing database service patterns

## PostgreSQL Schema Design

### 1. Feature Store Schema

#### Core Feature Management

```sql
-- ====================
-- FEATURE DEFINITIONS
-- ====================

-- Feature metadata and configuration
CREATE TABLE ml_feature_definitions (
    feature_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name VARCHAR(255) NOT NULL UNIQUE,
    feature_type VARCHAR(50) NOT NULL CHECK (feature_type IN (
        'technical', 'fundamental', 'sentiment', 'macro', 'options', 'custom'
    )),
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN (
        'float', 'integer', 'boolean', 'categorical', 'vector'
    )),
    description TEXT,
    calculation_method TEXT,
    source_apis TEXT[], -- Array of API sources (Polygon, FMP, etc.)
    calculation_frequency VARCHAR(20) NOT NULL CHECK (calculation_frequency IN (
        '1m', '5m', '15m', '1h', '4h', '1d', 'weekly', 'monthly'
    )),
    lookback_window_days INTEGER DEFAULT 252, -- Trading days of history needed
    is_active BOOLEAN DEFAULT true,
    feature_version INTEGER DEFAULT 1,
    feature_schema JSONB, -- JSON schema for validation
    normalization_params JSONB, -- Min/max/mean/std for normalization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),

    -- Performance indexes
    INDEX idx_feature_type_active (feature_type, is_active),
    INDEX idx_feature_name_version (feature_name, feature_version),
    INDEX idx_source_apis_gin (source_apis) USING GIN,
    INDEX idx_frequency (calculation_frequency),

    -- Constraints
    CONSTRAINT chk_lookback_positive CHECK (lookback_window_days > 0),
    CONSTRAINT chk_version_positive CHECK (feature_version > 0)
);

-- Feature dependencies for complex features
CREATE TABLE ml_feature_dependencies (
    dependency_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_id UUID NOT NULL REFERENCES ml_feature_definitions(feature_id),
    depends_on_feature_id UUID NOT NULL REFERENCES ml_feature_definitions(feature_id),
    dependency_type VARCHAR(50) NOT NULL CHECK (dependency_type IN (
        'input', 'derived', 'aggregation', 'transformation'
    )),
    lag_periods INTEGER DEFAULT 0, -- How many periods back
    weight DECIMAL(5,4), -- For weighted dependencies
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(feature_id, depends_on_feature_id),
    INDEX idx_feature_deps (feature_id),
    INDEX idx_reverse_deps (depends_on_feature_id)
);
```

#### High-Performance Feature Storage

```sql
-- ====================
-- FEATURE STORE
-- ====================

-- Main ML enhancement storage with ticker×timestamp primary key
CREATE TABLE ml_enhancement_store (
    ticker VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    enhancement_id UUID NOT NULL REFERENCES ml_enhancement_definitions(enhancement_id),
    enhancement_value DECIMAL(20,8), -- High precision for ML enhancement values
    base_vfr_value DECIMAL(20,8), -- Original VFR factor value being enhanced
    enhanced_composite_value DECIMAL(20,8), -- Combined VFR + ML value
    confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    data_quality_score DECIMAL(5,4) CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    vfr_factor_name VARCHAR(100), -- technical, fundamental, sentiment, etc.
    enhancement_latency_ms INTEGER, -- Additional latency for ML enhancement
    models_used TEXT[], -- Array of model IDs used for enhancement
    fallback_mode BOOLEAN DEFAULT false, -- True if enhancement failed and fell back
    enhancement_weight DECIMAL(3,2) DEFAULT 0.10, -- Weight of ML in final score
    validation_status VARCHAR(20) DEFAULT 'pending' CHECK (validation_status IN (
        'pending', 'valid', 'invalid', 'fallback', 'partial'
    )),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Composite primary key for optimal performance
    PRIMARY KEY (ticker, timestamp, enhancement_id),

    -- Performance indexes for time-series queries
    INDEX idx_ticker_timestamp_desc (ticker, timestamp DESC),
    INDEX idx_enhancement_timestamp_desc (enhancement_id, timestamp DESC),
    INDEX idx_timestamp_only_desc (timestamp DESC),
    INDEX idx_ticker_enhancement_latest (ticker, enhancement_id, timestamp DESC),
    INDEX idx_vfr_factor_timestamp (vfr_factor_name, timestamp DESC),
    INDEX idx_quality_score (data_quality_score) WHERE data_quality_score < 0.8,
    INDEX idx_fallback_mode (fallback_mode) WHERE fallback_mode = true,

    -- Partial indexes for performance
    INDEX idx_active_enhancements (ticker, timestamp DESC, enhancement_id)
        WHERE validation_status = 'valid' AND timestamp >= NOW() - INTERVAL '30 days',

    -- Include columns for covering index
    INDEX idx_ticker_time_covering (ticker, timestamp DESC)
        INCLUDE (enhancement_id, enhancement_value, enhanced_composite_value, confidence_score)
);

-- Partition by month for optimal performance with large datasets
SELECT create_monthly_partitions('ml_enhancement_store', 'timestamp', 60); -- 5 years of partitions

-- Create specific partitions for recent data (more frequent access)
CREATE TABLE ml_enhancement_store_y2024m12 PARTITION OF ml_enhancement_store
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE ml_enhancement_store_y2025m01 PARTITION OF ml_enhancement_store
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

#### Feature Aggregation and Materialized Views

```sql
-- ====================
-- FEATURE AGGREGATIONS
-- ====================

-- Materialized view for daily features (most common access pattern)
CREATE MATERIALIZED VIEW mv_daily_features AS
SELECT
    ticker,
    DATE(timestamp) as trade_date,
    feature_id,
    value,
    confidence_score,
    data_quality_score,
    source_provider,
    RANK() OVER (PARTITION BY ticker, DATE(timestamp), feature_id ORDER BY timestamp DESC) as rank_latest
FROM ml_feature_store
WHERE timestamp >= CURRENT_DATE - INTERVAL '90 days'
  AND validation_status = 'valid'
WITH DATA;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_mv_daily_features_primary
    ON mv_daily_features (ticker, trade_date, feature_id, rank_latest);
CREATE INDEX idx_mv_daily_features_date ON mv_daily_features (trade_date DESC);

-- Refresh strategy (run every hour)
CREATE OR REPLACE FUNCTION refresh_daily_features()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_features;
END;
$$ LANGUAGE plpgsql;

-- Feature vectors for ML model input
CREATE MATERIALIZED VIEW mv_feature_vectors AS
SELECT
    ticker,
    timestamp,
    jsonb_object_agg(
        fd.feature_name,
        jsonb_build_object(
            'value', fs.value,
            'confidence', fs.confidence_score,
            'quality', fs.data_quality_score
        )
    ) as feature_vector,
    COUNT(*) as feature_count,
    AVG(fs.confidence_score) as avg_confidence,
    MIN(fs.data_quality_score) as min_quality
FROM ml_feature_store fs
JOIN ml_feature_definitions fd ON fs.feature_id = fd.feature_id
WHERE fs.timestamp >= CURRENT_DATE - INTERVAL '30 days'
  AND fs.validation_status = 'valid'
  AND fd.is_active = true
GROUP BY ticker, timestamp
HAVING COUNT(*) >= 10 -- Minimum feature count for valid vectors
WITH DATA;

CREATE INDEX idx_mv_feature_vectors_ticker_time
    ON mv_feature_vectors (ticker, timestamp DESC);
```

## Redis Cache Extensions - Preserving Existing Patterns

### ML Enhancement Caching (Extends Existing Redis Usage)

```typescript
// Redis key patterns for ML enhancements (extends existing VFR patterns)
interface MLCacheKeys {
  // Extend existing stock analysis cache
  enhanced_stock_analysis: `vfr:enhanced:${symbol}:${timestamp}` // 15-minute TTL
  ml_enhancement_only: `vfr:ml:enhancement:${symbol}:${factor}:${timestamp}` // 5-minute TTL
  ml_prediction_cache: `vfr:ml:prediction:${symbol}:${model}:${horizon}:${timestamp}` // 5-minute TTL
  ml_model_cache: `vfr:ml:model:${modelId}` // 1-hour TTL
  ml_feature_cache: `vfr:ml:features:${symbol}:${timestamp}` // 15-minute TTL

  // Fallback status tracking
  ml_fallback_status: `vfr:ml:fallback:${service}` // 1-minute TTL
  ml_health_status: `vfr:ml:health:${timestamp}` // 30-second TTL
}

// ML-enhanced cache service (extends existing RedisCache)
class MLEnhancedCacheService extends RedisCache {
  constructor() {
    super({
      keyPrefix: 'vfr:', // Maintain existing key prefix
      defaultTTL: 900,   // 15 minutes (same as existing analysis cache)
      compression: true  // Enable for larger ML payloads
    })
  }

  // Cache enhanced stock analysis (preserves existing format + ML enhancements)
  async cacheEnhancedAnalysis(
    symbol: string,
    analysis: EnhancedStockAnalysis,
    includeML: boolean = false
  ): Promise<void> {
    const cacheKey = includeML
      ? `enhanced:${symbol}:${Math.floor(Date.now() / 900000)}` // 15-min window
      : `classic:${symbol}:${Math.floor(Date.now() / 900000)}`  // Use existing pattern

    await this.setex(cacheKey, 900, analysis) // 15-minute TTL
  }

  // Get cached analysis with ML fallback logic
  async getCachedAnalysis(
    symbol: string,
    preferML: boolean = false
  ): Promise<EnhancedStockAnalysis | null> {
    const timeWindow = Math.floor(Date.now() / 900000)

    if (preferML) {
      // Try ML-enhanced first
      const enhanced = await this.get(`enhanced:${symbol}:${timeWindow}`)
      if (enhanced) return enhanced
    }

    // Fallback to classic analysis (existing pattern)
    const classic = await this.get(`classic:${symbol}:${timeWindow}`)
    return classic
  }

  // Cache ML-specific predictions (new functionality)
  async cacheMLPrediction(
    symbol: string,
    modelId: string,
    horizon: string,
    prediction: MLPrediction
  ): Promise<void> {
    const cacheKey = `ml:prediction:${symbol}:${modelId}:${horizon}:${Math.floor(Date.now() / 300000)}`
    await this.setex(cacheKey, 300, prediction) // 5-minute TTL for predictions
  }

  // Track ML service health in cache
  async setMLHealthStatus(serviceName: string, status: MLHealthStatus): Promise<void> {
    const cacheKey = `ml:health:${serviceName}`
    await this.setex(cacheKey, 30, status) // 30-second TTL for health status
  }

  // Cache fallback status to prevent repeated ML attempts
  async setFallbackStatus(reason: string, duration: number = 60): Promise<void> {
    const cacheKey = `ml:fallback:${reason}`
    await this.setex(cacheKey, duration, {
      timestamp: Date.now(),
      reason,
      fallback_active: true
    })
  }

  // Check if we should skip ML and use classic analysis
  async shouldUseFallback(): Promise<boolean> {
    const fallbackKeys = await this.keys('ml:fallback:*')
    return fallbackKeys.length > 0
  }
}

// Performance monitoring cache (tracks ML enhancement performance)
class MLPerformanceCacheService extends RedisCache {
  async trackEnhancementLatency(symbol: string, latency: number): Promise<void> {
    const key = `ml:perf:latency:${symbol}:${new Date().getHours()}`

    // Store hourly latency stats
    await this.pipeline([
      ['lpush', key, latency],
      ['ltrim', key, 0, 99], // Keep last 100 measurements
      ['expire', key, 3600]  // 1-hour expiry
    ])
  }

  async getAverageLatency(symbol: string): Promise<number> {
    const key = `ml:perf:latency:${symbol}:${new Date().getHours()}`
    const latencies = await this.lrange(key, 0, -1)

    if (latencies.length === 0) return 0

    const sum = latencies.reduce((a, b) => a + parseFloat(b), 0)
    return sum / latencies.length
  }
}
```

### Redis Data Structures for ML Extensions

```redis
# Enhanced stock analysis cache (extends existing pattern)
HSET vfr:enhanced:AAPL:1640995200
  "symbol" "AAPL"
  "compositeScore" "75.5"
  "recommendation" "BUY"
  "mlEnhanced" "true"
  "mlEnhancedScore" "78.2"
  "mlLatency" "85"
  "modelsUsed" "momentum-lstm,mean-reversion-xgb"
  "enhancementWeight" "0.10"

# ML prediction cache (5-minute windows)
HSET vfr:ml:prediction:AAPL:momentum-lstm:1w:1640995500
  "symbol" "AAPL"
  "modelId" "momentum-lstm"
  "horizon" "1w"
  "priceTarget" "180.50"
  "confidence" "0.78"
  "expectedReturn" "0.05"
  "generatedAt" "1640995500"

# ML service health tracking
HSET vfr:ml:health:prediction-service
  "status" "healthy"
  "avgLatency" "45"
  "cacheHitRatio" "0.85"
  "modelsLoaded" "3"
  "lastCheck" "1640995600"

# Fallback status (prevents repeated failed ML attempts)
HSET vfr:ml:fallback:model-unavailable
  "active" "true"
  "reason" "Primary model service unreachable"
  "timestamp" "1640995650"
  "estimatedRecovery" "1640995710"

# Performance metrics (sliding window)
LPUSH vfr:ml:perf:latency:AAPL:14 "85" "92" "78" "88" "95"
EXPIRE vfr:ml:perf:latency:AAPL:14 3600
```

### 2. Model Registry Schema

#### Model Management and Versioning

```sql
-- ====================
-- MODEL REGISTRY
-- ====================

-- Model definitions and metadata
CREATE TABLE ml_models (
    model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(255) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    model_type VARCHAR(100) NOT NULL CHECK (model_type IN (
        'linear_regression', 'logistic_regression', 'random_forest',
        'xgboost', 'lightgbm', 'catboost', 'lstm', 'transformer',
        'ensemble', 'meta_learner'
    )),
    algorithm_family VARCHAR(50) NOT NULL CHECK (algorithm_family IN (
        'tree_based', 'neural_network', 'linear', 'ensemble', 'time_series'
    )),
    objective VARCHAR(100) NOT NULL CHECK (objective IN (
        'price_prediction', 'direction_classification', 'volatility_forecast',
        'risk_assessment', 'anomaly_detection', 'portfolio_optimization'
    )),
    target_variable VARCHAR(255) NOT NULL,
    prediction_horizon VARCHAR(20) NOT NULL, -- '1d', '1w', '1m', etc.
    feature_set_id UUID REFERENCES ml_datasets(dataset_id),
    hyperparameters JSONB NOT NULL,
    training_config JSONB,
    model_artifact_path VARCHAR(500), -- S3/file system path
    model_size_mb DECIMAL(10,2),
    training_duration_minutes INTEGER,
    training_start_time TIMESTAMP WITH TIME ZONE,
    training_end_time TIMESTAMP WITH TIME ZONE,
    validation_score DECIMAL(10,6),
    test_score DECIMAL(10,6),
    cross_validation_scores DECIMAL(10,6)[],
    feature_importance JSONB, -- Feature importance scores
    model_metadata JSONB, -- Additional model-specific metadata
    git_commit_hash VARCHAR(40), -- Code version for reproducibility
    docker_image VARCHAR(255), -- Training environment
    environment_config JSONB, -- Python/package versions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    status VARCHAR(50) DEFAULT 'training' CHECK (status IN (
        'training', 'completed', 'failed', 'validated', 'deployed',
        'shadow', 'production', 'deprecated', 'archived'
    )),

    -- Unique constraint for model versioning
    UNIQUE(model_name, model_version),

    -- Performance indexes
    INDEX idx_model_name_version (model_name, model_version),
    INDEX idx_model_status_type (status, model_type),
    INDEX idx_model_objective (objective, prediction_horizon),
    INDEX idx_model_performance (validation_score DESC) WHERE status IN ('validated', 'deployed', 'production'),
    INDEX idx_model_created (created_at DESC),
    INDEX idx_git_commit (git_commit_hash),

    -- Constraints
    CONSTRAINT chk_scores_valid CHECK (
        validation_score >= 0 AND test_score >= 0 AND validation_score <= 1 AND test_score <= 1
    ),
    CONSTRAINT chk_training_time CHECK (training_end_time > training_start_time),
    CONSTRAINT chk_model_size CHECK (model_size_mb > 0)
);

-- Model performance metrics over time
CREATE TABLE ml_model_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ml_models(model_id),
    metric_name VARCHAR(100) NOT NULL CHECK (metric_name IN (
        'accuracy', 'precision', 'recall', 'f1_score', 'auc_roc', 'auc_pr',
        'mse', 'rmse', 'mae', 'mape', 'r_squared',
        'sharpe_ratio', 'sortino_ratio', 'max_drawdown', 'calmar_ratio',
        'hit_rate', 'profit_factor', 'win_loss_ratio'
    )),
    metric_value DECIMAL(15,8) NOT NULL,
    metric_std DECIMAL(15,8), -- Standard deviation for cross-validation
    dataset_type VARCHAR(20) NOT NULL CHECK (dataset_type IN (
        'train', 'validation', 'test', 'holdout', 'live'
    )),
    time_period_start DATE,
    time_period_end DATE,
    symbol_universe TEXT[], -- Symbols this metric applies to
    calculation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calculation_metadata JSONB, -- Additional calculation details

    -- Performance indexes
    INDEX idx_model_metric_name (model_id, metric_name),
    INDEX idx_model_dataset_type (model_id, dataset_type),
    INDEX idx_metric_value (metric_name, metric_value DESC),
    INDEX idx_calculation_time (calculation_timestamp DESC),

    -- Constraints
    CONSTRAINT chk_time_period CHECK (time_period_end >= time_period_start)
);

-- Model deployment tracking
CREATE TABLE ml_model_deployments (
    deployment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ml_models(model_id),
    environment VARCHAR(50) NOT NULL CHECK (environment IN (
        'development', 'staging', 'production', 'canary', 'shadow', 'a_b_test'
    )),
    deployment_strategy VARCHAR(50) CHECK (deployment_strategy IN (
        'blue_green', 'rolling', 'canary', 'shadow', 'a_b_split'
    )),
    traffic_percentage DECIMAL(5,2) DEFAULT 100.00 CHECK (
        traffic_percentage >= 0 AND traffic_percentage <= 100
    ),
    deployment_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    endpoint_url VARCHAR(500),
    health_check_url VARCHAR(500),
    model_config JSONB, -- Runtime configuration
    resource_allocation JSONB, -- CPU/memory/GPU allocation
    autoscaling_config JSONB,
    monitoring_config JSONB,
    is_active BOOLEAN DEFAULT true,
    deployment_notes TEXT,
    deployed_by VARCHAR(100),
    rollback_deployment_id UUID REFERENCES ml_model_deployments(deployment_id),

    -- Performance indexes
    INDEX idx_model_env_active (model_id, environment, is_active),
    INDEX idx_deployment_time (deployment_timestamp DESC),
    INDEX idx_active_deployments (is_active, environment) WHERE is_active = true,

    -- Constraints
    CONSTRAINT chk_traffic_percentage_valid CHECK (traffic_percentage BETWEEN 0 AND 100)
);

-- A/B testing framework
CREATE TABLE ml_ab_experiments (
    experiment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_name VARCHAR(255) NOT NULL UNIQUE,
    control_model_id UUID NOT NULL REFERENCES ml_models(model_id),
    treatment_model_id UUID NOT NULL REFERENCES ml_models(model_id),
    traffic_split DECIMAL(5,2) DEFAULT 50.00 CHECK (
        traffic_split >= 0 AND traffic_split <= 100
    ),
    symbols_filter TEXT[], -- Limit experiment to specific symbols
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'draft', 'active', 'paused', 'completed', 'stopped'
    )),
    success_metrics TEXT[] NOT NULL, -- Primary metrics to evaluate
    minimum_sample_size INTEGER DEFAULT 1000,
    confidence_level DECIMAL(3,2) DEFAULT 0.95,
    experiment_config JSONB,
    results JSONB, -- Statistical test results
    winner_model_id UUID REFERENCES ml_models(model_id),
    created_by VARCHAR(100),

    INDEX idx_experiment_status (status, start_date),
    INDEX idx_experiment_models (control_model_id, treatment_model_id),

    CONSTRAINT chk_different_models CHECK (control_model_id != treatment_model_id),
    CONSTRAINT chk_experiment_dates CHECK (end_date > start_date),
    CONSTRAINT chk_confidence_level CHECK (confidence_level BETWEEN 0.80 AND 0.99)
);
```

### 3. Training Data and Dataset Management

#### Dataset Versioning and Lineage

```sql
-- ====================
-- DATASET MANAGEMENT
-- ====================

-- Dataset definitions for reproducible ML
CREATE TABLE ml_datasets (
    dataset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_name VARCHAR(255) NOT NULL,
    dataset_version VARCHAR(50) NOT NULL,
    description TEXT,
    dataset_type VARCHAR(50) CHECK (dataset_type IN (
        'training', 'validation', 'test', 'holdout', 'benchmark'
    )),
    tickers TEXT[] NOT NULL, -- Symbols included in dataset
    feature_ids UUID[] NOT NULL, -- Features included
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    frequency VARCHAR(20) NOT NULL, -- Data frequency
    total_samples BIGINT,
    total_features INTEGER,
    missing_data_percentage DECIMAL(5,2),
    data_quality_score DECIMAL(5,4),
    splits JSONB NOT NULL, -- Train/validation/test splits
    preprocessing_config JSONB, -- Normalization, encoding, etc.
    data_storage_path VARCHAR(500), -- S3 or local path
    data_format VARCHAR(50) DEFAULT 'parquet' CHECK (data_format IN (
        'parquet', 'csv', 'hdf5', 'feather', 'tfrecord'
    )),
    compression_type VARCHAR(20),
    checksum VARCHAR(64), -- SHA256 for integrity
    dvc_file_path VARCHAR(500), -- DVC file for version control
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    is_active BOOLEAN DEFAULT true,

    -- Unique constraint for versioning
    UNIQUE(dataset_name, dataset_version),

    -- Performance indexes
    INDEX idx_dataset_name_version (dataset_name, dataset_version),
    INDEX idx_dataset_date_range (start_date, end_date),
    INDEX idx_dataset_type_active (dataset_type, is_active),
    INDEX idx_dataset_created (created_at DESC),

    -- GIN index for array searches
    INDEX idx_dataset_tickers (tickers) USING GIN,
    INDEX idx_dataset_features (feature_ids) USING GIN,

    -- Constraints
    CONSTRAINT chk_date_range CHECK (end_date > start_date),
    CONSTRAINT chk_positive_samples CHECK (total_samples > 0),
    CONSTRAINT chk_quality_score CHECK (data_quality_score BETWEEN 0 AND 1),
    CONSTRAINT chk_missing_data CHECK (missing_data_percentage BETWEEN 0 AND 100)
);

-- Feature engineering pipelines
CREATE TABLE ml_feature_pipelines (
    pipeline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_name VARCHAR(255) NOT NULL UNIQUE,
    pipeline_version VARCHAR(50) NOT NULL,
    description TEXT,
    input_features UUID[] NOT NULL, -- Base features required
    output_features UUID[] NOT NULL, -- Features produced
    pipeline_steps JSONB NOT NULL, -- Step-by-step transformation
    pipeline_code TEXT, -- SQL or Python code
    parameters JSONB, -- Configurable parameters
    validation_rules JSONB, -- Data validation rules
    execution_time_ms INTEGER,
    memory_usage_mb INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    is_active BOOLEAN DEFAULT true,

    INDEX idx_pipeline_name_version (pipeline_name, pipeline_version),
    INDEX idx_pipeline_features_gin (input_features, output_features) USING GIN,
    INDEX idx_pipeline_active (is_active) WHERE is_active = true
);

-- Data lineage tracking
CREATE TABLE ml_data_lineage (
    lineage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    downstream_dataset_id UUID REFERENCES ml_datasets(dataset_id),
    upstream_dataset_id UUID REFERENCES ml_datasets(dataset_id),
    transformation_type VARCHAR(100) CHECK (transformation_type IN (
        'feature_engineering', 'aggregation', 'filtering', 'join', 'union'
    )),
    transformation_config JSONB,
    pipeline_id UUID REFERENCES ml_feature_pipelines(pipeline_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_lineage_downstream (downstream_dataset_id),
    INDEX idx_lineage_upstream (upstream_dataset_id),
    INDEX idx_lineage_pipeline (pipeline_id)
);
```

### 4. Backtesting and Performance Tracking

#### Comprehensive Backtesting Schema

```sql
-- ====================
-- BACKTESTING FRAMEWORK
-- ====================

-- Backtesting experiments
CREATE TABLE ml_backtesting_experiments (
    experiment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_name VARCHAR(255) NOT NULL,
    model_id UUID NOT NULL REFERENCES ml_models(model_id),
    strategy_name VARCHAR(255) NOT NULL,
    strategy_config JSONB NOT NULL,
    universe_tickers TEXT[] NOT NULL,
    benchmark_ticker VARCHAR(20) DEFAULT 'SPY',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_capital DECIMAL(15,2) DEFAULT 100000.00,

    -- Transaction cost modeling
    commission_per_trade DECIMAL(8,4) DEFAULT 0.005, -- 0.5%
    commission_type VARCHAR(20) DEFAULT 'percentage' CHECK (commission_type IN (
        'percentage', 'fixed', 'tiered'
    )),
    bid_ask_spread_bps DECIMAL(6,2) DEFAULT 5.0, -- 5 basis points
    market_impact_config JSONB, -- Market impact modeling
    slippage_config JSONB, -- Slippage modeling

    -- Rebalancing and constraints
    rebalance_frequency VARCHAR(20) DEFAULT 'daily' CHECK (rebalance_frequency IN (
        'intraday', 'daily', 'weekly', 'monthly', 'quarterly'
    )),
    position_limits JSONB, -- Position size limits
    sector_limits JSONB, -- Sector exposure limits
    turnover_limit DECIMAL(5,2), -- Maximum daily turnover %
    leverage_limit DECIMAL(5,2) DEFAULT 1.0,

    -- Walk-forward analysis
    walk_forward_analysis BOOLEAN DEFAULT true,
    training_window_days INTEGER DEFAULT 252, -- 1 year
    retrain_frequency_days INTEGER DEFAULT 21, -- Monthly
    prediction_window_days INTEGER DEFAULT 21, -- 1 month ahead
    min_training_samples INTEGER DEFAULT 1000,

    -- Execution and status
    execution_status VARCHAR(50) DEFAULT 'pending' CHECK (execution_status IN (
        'pending', 'running', 'completed', 'failed', 'cancelled'
    )),
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    start_time TIMESTAMP WITH TIME ZONE,
    completion_time TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    total_trades INTEGER,
    total_symbols_traded INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),

    -- Performance indexes
    INDEX idx_experiment_model (model_id),
    INDEX idx_experiment_status (execution_status, created_at),
    INDEX idx_experiment_dates (start_date, end_date),
    INDEX idx_experiment_universe (universe_tickers) USING GIN,

    -- Constraints
    CONSTRAINT chk_experiment_dates CHECK (end_date > start_date),
    CONSTRAINT chk_positive_capital CHECK (initial_capital > 0),
    CONSTRAINT chk_commission_valid CHECK (commission_per_trade >= 0),
    CONSTRAINT chk_leverage_valid CHECK (leverage_limit > 0 AND leverage_limit <= 10),
    CONSTRAINT chk_progress_valid CHECK (progress_percentage BETWEEN 0 AND 100)
);

-- Detailed backtesting results
CREATE TABLE ml_backtesting_results (
    result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES ml_backtesting_experiments(experiment_id),
    trade_date DATE NOT NULL,
    ticker VARCHAR(20) NOT NULL,

    -- Position and trade details
    action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL', 'HOLD')),
    position_type VARCHAR(10) CHECK (position_type IN ('LONG', 'SHORT')),
    quantity DECIMAL(15,8) NOT NULL, -- Shares or contracts
    entry_price DECIMAL(12,4),
    exit_price DECIMAL(12,4),
    avg_fill_price DECIMAL(12,4), -- Average execution price

    -- Predictions and signals
    predicted_return DECIMAL(8,6), -- Model prediction
    predicted_direction VARCHAR(10), -- UP/DOWN/NEUTRAL
    prediction_confidence DECIMAL(5,4),
    signal_strength DECIMAL(5,4), -- Signal strength 0-1

    -- Performance metrics
    holding_period_days INTEGER,
    gross_pnl DECIMAL(15,4), -- Before costs
    net_pnl DECIMAL(15,4), -- After costs
    transaction_costs DECIMAL(15,4), -- Commissions + slippage
    market_impact DECIMAL(15,4), -- Market impact cost
    realized_return DECIMAL(8,6), -- Actual return achieved
    attribution_alpha DECIMAL(8,6), -- Alpha attribution
    attribution_beta DECIMAL(8,6), -- Beta attribution

    -- Portfolio context
    portfolio_weight DECIMAL(8,6), -- Position size as % of portfolio
    sector_exposure DECIMAL(8,6), -- Sector exposure at trade time
    portfolio_value DECIMAL(15,2), -- Total portfolio value
    cash_position DECIMAL(15,2), -- Cash position
    leverage_ratio DECIMAL(5,4), -- Portfolio leverage

    -- Risk metrics
    var_1d DECIMAL(10,4), -- 1-day Value at Risk
    expected_shortfall DECIMAL(10,4), -- Expected shortfall (CVaR)
    position_risk_score DECIMAL(5,4), -- Position-specific risk

    -- Market context
    market_regime VARCHAR(20), -- Bull/bear/sideways
    volatility_regime VARCHAR(20), -- Low/medium/high vol
    market_return DECIMAL(8,6), -- Market return on trade date
    sector_return DECIMAL(8,6), -- Sector return on trade date

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Composite primary key for performance
    PRIMARY KEY (experiment_id, trade_date, ticker),

    -- Performance indexes
    INDEX idx_experiment_date (experiment_id, trade_date),
    INDEX idx_experiment_ticker (experiment_id, ticker),
    INDEX idx_trade_performance (net_pnl DESC, trade_date),
    INDEX idx_realized_return (realized_return DESC),
    INDEX idx_prediction_accuracy (predicted_return, realized_return),

    -- Constraints
    CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_confidence_valid CHECK (prediction_confidence BETWEEN 0 AND 1),
    CONSTRAINT chk_portfolio_weight CHECK (ABS(portfolio_weight) <= 1),
    CONSTRAINT chk_leverage_reasonable CHECK (leverage_ratio BETWEEN 0 AND 10)
);

-- Aggregate performance metrics
CREATE TABLE ml_backtesting_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES ml_backtesting_experiments(experiment_id),

    -- Return metrics
    total_return DECIMAL(10,6) NOT NULL,
    annualized_return DECIMAL(10,6),
    benchmark_return DECIMAL(10,6),
    excess_return DECIMAL(10,6), -- Return - benchmark
    alpha DECIMAL(10,6), -- Risk-adjusted alpha
    beta DECIMAL(6,4), -- Market beta

    -- Risk metrics
    volatility DECIMAL(10,6), -- Annualized volatility
    downside_volatility DECIMAL(10,6), -- Downside deviation
    max_drawdown DECIMAL(6,4), -- Maximum drawdown %
    max_drawdown_duration_days INTEGER, -- Longest drawdown period
    value_at_risk_95 DECIMAL(10,6), -- 95% VaR
    expected_shortfall_95 DECIMAL(10,6), -- 95% Expected Shortfall

    -- Risk-adjusted performance
    sharpe_ratio DECIMAL(8,4), -- (Return - RiskFree) / Volatility
    sortino_ratio DECIMAL(8,4), -- Excess return / Downside deviation
    calmar_ratio DECIMAL(8,4), -- Annual return / Max drawdown
    information_ratio DECIMAL(8,4), -- Excess return / Tracking error
    treynor_ratio DECIMAL(8,4), -- Excess return / Beta

    -- Trading metrics
    total_trades INTEGER,
    win_rate DECIMAL(5,4), -- Percentage of profitable trades
    avg_win DECIMAL(10,6), -- Average winning trade
    avg_loss DECIMAL(10,6), -- Average losing trade
    profit_factor DECIMAL(8,4), -- Gross profit / Gross loss
    largest_win DECIMAL(10,6),
    largest_loss DECIMAL(10,6),
    avg_holding_period DECIMAL(8,2), -- Average holding period in days
    turnover_rate DECIMAL(6,4), -- Annual turnover rate

    -- Cost analysis
    total_transaction_costs DECIMAL(15,4),
    cost_as_percentage_of_returns DECIMAL(6,4),
    avg_cost_per_trade DECIMAL(10,4),
    market_impact_total DECIMAL(15,4),

    -- Consistency metrics
    monthly_win_rate DECIMAL(5,4), -- % of profitable months
    best_month DECIMAL(8,6), -- Best monthly return
    worst_month DECIMAL(8,6), -- Worst monthly return
    monthly_returns_std DECIMAL(8,6), -- Std dev of monthly returns
    skewness DECIMAL(6,4), -- Return distribution skewness
    kurtosis DECIMAL(6,4), -- Return distribution kurtosis

    -- Attribution analysis
    factor_exposures JSONB, -- Factor exposure breakdown
    sector_attribution JSONB, -- Sector performance attribution
    size_attribution JSONB, -- Size factor attribution

    calculation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Performance indexes
    INDEX idx_experiment_metrics (experiment_id),
    INDEX idx_sharpe_ratio (sharpe_ratio DESC),
    INDEX idx_max_drawdown (max_drawdown),
    INDEX idx_total_return (total_return DESC)
);
```

### 5. Real-time Prediction Storage

#### Prediction Results and Performance Tracking

```sql
-- ====================
-- PREDICTION STORAGE
-- ====================

-- Real-time predictions
CREATE TABLE ml_predictions (
    prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ml_models(model_id),
    ticker VARCHAR(20) NOT NULL,
    prediction_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Prediction details
    prediction_horizon VARCHAR(20) NOT NULL, -- '1d', '1w', '1m'
    prediction_type VARCHAR(50) NOT NULL CHECK (prediction_type IN (
        'price_target', 'direction', 'volatility', 'probability'
    )),
    predicted_value DECIMAL(15,8) NOT NULL, -- Main prediction
    confidence_score DECIMAL(5,4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    probability_up DECIMAL(5,4), -- Probability of price increase
    probability_down DECIMAL(5,4), -- Probability of price decrease

    -- Prediction bounds
    upper_bound DECIMAL(15,8), -- Confidence interval upper
    lower_bound DECIMAL(15,8), -- Confidence interval lower
    std_error DECIMAL(15,8), -- Standard error of prediction

    -- Context at prediction time
    current_price DECIMAL(12,4) NOT NULL,
    implied_return DECIMAL(8,6), -- Predicted return
    features_used TEXT[], -- Feature names used
    feature_vector JSONB, -- Actual feature values
    model_version VARCHAR(50),
    ensemble_weights JSONB, -- If ensemble prediction

    -- Performance tracking
    actual_value DECIMAL(15,8), -- Filled when actual known
    actual_timestamp TIMESTAMP WITH TIME ZONE, -- When actual measured
    prediction_error DECIMAL(15,8), -- Actual - Predicted
    squared_error DECIMAL(15,8), -- (Actual - Predicted)^2
    absolute_error DECIMAL(15,8), -- |Actual - Predicted|
    direction_correct BOOLEAN, -- Direction prediction correct

    -- Metadata
    execution_time_ms INTEGER, -- Prediction latency
    cache_hit BOOLEAN DEFAULT false, -- Whether from cache
    feature_freshness_seconds INTEGER, -- Age of newest feature
    data_quality_score DECIMAL(5,4), -- Input data quality

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Performance indexes optimized for time-series queries
    INDEX idx_predictions_ticker_time (ticker, prediction_timestamp DESC),
    INDEX idx_predictions_model_time (model_id, prediction_timestamp DESC),
    INDEX idx_predictions_horizon (prediction_horizon, prediction_timestamp DESC),
    INDEX idx_predictions_recent (prediction_timestamp DESC)
        WHERE prediction_timestamp >= NOW() - INTERVAL '7 days',
    INDEX idx_predictions_performance (ticker, prediction_timestamp DESC)
        INCLUDE (predicted_value, actual_value, confidence_score)
        WHERE actual_value IS NOT NULL,

    -- Partial indexes for common queries
    INDEX idx_high_confidence_predictions (confidence_score DESC, prediction_timestamp DESC)
        WHERE confidence_score >= 0.8,
    INDEX idx_large_errors (absolute_error DESC, prediction_timestamp DESC)
        WHERE actual_value IS NOT NULL AND absolute_error > 0.05,

    -- Constraints
    CONSTRAINT chk_prediction_bounds CHECK (
        (upper_bound IS NULL AND lower_bound IS NULL) OR
        (upper_bound > predicted_value AND lower_bound < predicted_value)
    ),
    CONSTRAINT chk_probabilities CHECK (
        (probability_up IS NULL AND probability_down IS NULL) OR
        (probability_up + probability_down <= 1.01 AND probability_up >= 0 AND probability_down >= 0)
    )
);

-- Partition predictions by month for performance
SELECT create_monthly_partitions('ml_predictions', 'prediction_timestamp', 12);

-- Real-time model performance aggregations
CREATE MATERIALIZED VIEW mv_model_performance AS
SELECT
    model_id,
    prediction_horizon,
    DATE_TRUNC('day', prediction_timestamp) as prediction_date,
    COUNT(*) as total_predictions,
    COUNT(actual_value) as predictions_with_actuals,
    AVG(CASE WHEN actual_value IS NOT NULL THEN confidence_score END) as avg_confidence,
    AVG(CASE WHEN actual_value IS NOT NULL THEN absolute_error END) as mean_absolute_error,
    SQRT(AVG(CASE WHEN actual_value IS NOT NULL THEN squared_error END)) as rmse,
    AVG(CASE WHEN actual_value IS NOT NULL AND direction_correct IS NOT NULL
        THEN CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END END) as direction_accuracy,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY absolute_error) as median_absolute_error,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY absolute_error) as p95_absolute_error,
    MAX(execution_time_ms) as max_latency_ms,
    AVG(execution_time_ms) as avg_latency_ms,
    AVG(CASE WHEN cache_hit THEN 1.0 ELSE 0.0 END) as cache_hit_rate
FROM ml_predictions
WHERE prediction_timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY model_id, prediction_horizon, DATE_TRUNC('day', prediction_timestamp)
WITH DATA;

CREATE UNIQUE INDEX idx_mv_model_performance_primary
    ON mv_model_performance (model_id, prediction_horizon, prediction_date);
```

## Redis Caching Architecture

### ML-Optimized Caching Strategy

```typescript
// ====================
// REDIS SCHEMA DESIGN
// ====================

interface MLRedisCacheSchema {
  // Prediction cache with 5-minute TTL
  predictions: {
    keyPattern: "ml:pred:{model_id}:{ticker}:{horizon}:{timestamp_floor}";
    ttl: 300; // 5 minutes
    dataType: "hash";
    fields: {
      predicted_value: string;
      confidence_score: string;
      probability_up: string;
      probability_down: string;
      features_hash: string;
      created_at: string;
    };
  };

  // Feature cache with variable TTL by type
  features: {
    keyPattern: "ml:feat:{ticker}:{feature_type}:{timestamp_floor}";
    ttl: {
      technical: 60;     // 1 minute
      fundamental: 3600; // 1 hour
      sentiment: 900;    // 15 minutes
      macro: 1800;       // 30 minutes
    };
    dataType: "hash";
    compression: true;
  };

  // Model metadata cache with 1-hour TTL
  models: {
    keyPattern: "ml:model:{model_id}";
    ttl: 3600; // 1 hour
    dataType: "hash";
    fields: {
      model_path: string;
      hyperparameters: string; // JSON
      feature_names: string;   // JSON array
      last_updated: string;
      performance_metrics: string; // JSON
    };
  };

  // Feature vectors for batch predictions
  feature_vectors: {
    keyPattern: "ml:fvec:{ticker}:{timestamp}";
    ttl: 900; // 15 minutes
    dataType: "string";
    compression: true; // Compress large vectors
  };

  // Model performance metrics
  performance: {
    keyPattern: "ml:perf:{model_id}:{date}";
    ttl: 86400; // 24 hours
    dataType: "hash";
    fields: {
      accuracy: string;
      mae: string;
      rmse: string;
      latency_p95: string;
      prediction_count: string;
    };
  };

  // Real-time rankings and scores
  rankings: {
    keyPattern: "ml:rank:{universe}:{model_id}:{timestamp}";
    ttl: 300; // 5 minutes
    dataType: "zset"; // Sorted set for rankings
  };

  // Cache warming status
  cache_status: {
    keyPattern: "ml:status:{service}";
    ttl: 60; // 1 minute
    dataType: "string";
  };
}

// Cache warming and management functions
class MLCacheManager {
  constructor(private redis: RedisClient) {}

  async warmPredictionCache(
    popularTickers: string[],
    activeModels: string[]
  ): Promise<void> {
    const warmingTasks = []

    for (const ticker of popularTickers) {
      for (const modelId of activeModels) {
        warmingTasks.push(
          this.warmSinglePrediction(ticker, modelId)
        )
      }
    }

    await Promise.allSettled(warmingTasks)
  }

  async optimizeCacheUsage(): Promise<void> {
    // Remove low-hit-rate cache entries
    const stats = await this.getCacheStatistics()

    for (const [pattern, hitRate] of Object.entries(stats)) {
      if (hitRate < 0.1) { // Less than 10% hit rate
        await this.evictLowPerformanceKeys(pattern)
      }
    }

    // Preload high-demand features
    await this.preloadHighDemandFeatures()
  }
}
```

## InfluxDB Time-Series Schema (Optional)

### High-Frequency Market Data Storage

```sql
-- ====================
-- INFLUXDB SCHEMA
-- ====================

-- Measurement: real_time_features
-- Tags: ticker, feature_name, source, model_id
-- Fields: value, confidence, quality_score, calculation_time_ms
-- Time: nanosecond precision

-- Retention policies for different data frequencies
CREATE RETENTION POLICY "real_time" ON "vfr_ml" DURATION 24h REPLICATION 1;
CREATE RETENTION POLICY "minute_data" ON "vfr_ml" DURATION 30d REPLICATION 1;
CREATE RETENTION POLICY "hourly_data" ON "vfr_ml" DURATION 90d REPLICATION 1;
CREATE RETENTION POLICY "daily_data" ON "vfr_ml" DURATION 2555d REPLICATION 1; -- 7 years

-- Continuous queries for automatic downsampling
CREATE CONTINUOUS QUERY "downsample_features_1m" ON "vfr_ml"
BEGIN
  SELECT
    last(value) as value,
    mean(confidence) as avg_confidence,
    min(quality_score) as min_quality,
    sum(calculation_time_ms) as total_calc_time
  INTO "minute_data"."features_1m"
  FROM "real_time"."real_time_features"
  GROUP BY time(1m), ticker, feature_name, source
END;

CREATE CONTINUOUS QUERY "downsample_predictions_1h" ON "vfr_ml"
BEGIN
  SELECT
    last(predicted_value) as predicted_value,
    mean(confidence_score) as avg_confidence,
    count(prediction_id) as prediction_count,
    mean(execution_time_ms) as avg_latency
  INTO "hourly_data"."predictions_1h"
  FROM "minute_data"."predictions_1m"
  GROUP BY time(1h), ticker, model_id, prediction_horizon
END;

-- Custom functions for financial calculations
CREATE CONTINUOUS QUERY "calculate_prediction_accuracy" ON "vfr_ml"
BEGIN
  SELECT
    mean(abs_error) as mae,
    sqrt(mean(squared_error)) as rmse,
    sum(direction_correct) / count(*) as direction_accuracy
  INTO "daily_data"."model_performance_daily"
  FROM "hourly_data"."predictions_1h"
  WHERE actual_value IS NOT NULL
  GROUP BY time(1d), model_id, prediction_horizon
END;
```

## Database Performance Optimization

### PostgreSQL Optimization Strategies

```sql
-- ====================
-- PERFORMANCE OPTIMIZATION
-- ====================

-- Connection pooling configuration
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '64MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Parallel processing for large queries
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET parallel_tuple_cost = 0.1;

-- Optimize for time-series workloads
ALTER SYSTEM SET random_page_cost = 1.1; -- SSD optimization
ALTER SYSTEM SET seq_page_cost = 1.0;

-- Partitioning function for automatic partition management
CREATE OR REPLACE FUNCTION create_monthly_partitions(
    table_name TEXT,
    column_name TEXT,
    months_ahead INTEGER
) RETURNS VOID AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INTEGER;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE - INTERVAL '12 months');

    FOR i IN -12..months_ahead LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := table_name || '_y' ||
                         EXTRACT(YEAR FROM start_date) || 'm' ||
                         LPAD(EXTRACT(MONTH FROM start_date)::TEXT, 2, '0');

        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
                       FOR VALUES FROM (%L) TO (%L)',
                      partition_name, table_name, start_date, end_date);

        -- Create indexes on each partition
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (%s DESC)',
                      'idx_' || partition_name || '_timestamp',
                      partition_name, column_name);

        start_date := end_date;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Advanced indexing strategies
CREATE INDEX CONCURRENTLY idx_feature_store_composite_covering
ON ml_feature_store (ticker, timestamp DESC, feature_id)
INCLUDE (value, confidence_score, data_quality_score, source_provider)
WHERE validation_status = 'valid' AND timestamp >= NOW() - INTERVAL '90 days';

-- Partial index for high-quality recent data
CREATE INDEX CONCURRENTLY idx_feature_store_high_quality
ON ml_feature_store (ticker, feature_id, timestamp DESC)
WHERE data_quality_score >= 0.9
  AND confidence_score >= 0.8
  AND timestamp >= NOW() - INTERVAL '30 days';

-- BRIN indexes for large time-series tables
CREATE INDEX idx_feature_store_timestamp_brin
ON ml_feature_store USING BRIN (timestamp);

CREATE INDEX idx_predictions_timestamp_brin
ON ml_predictions USING BRIN (prediction_timestamp);

-- Expression indexes for common calculations
CREATE INDEX idx_predictions_implied_return
ON ml_predictions ((predicted_value - current_price) / current_price)
WHERE actual_value IS NOT NULL;

CREATE INDEX idx_backtesting_returns
ON ml_backtesting_results (realized_return)
WHERE realized_return IS NOT NULL;
```

### Database Monitoring and Maintenance

```sql
-- ====================
-- MONITORING AND MAINTENANCE
-- ====================

-- Query performance monitoring
CREATE VIEW vw_slow_queries AS
SELECT
    query,
    calls,
    total_time,
    mean_time,
    min_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE mean_time > 100 -- Queries slower than 100ms
ORDER BY mean_time DESC;

-- Index usage statistics
CREATE VIEW vw_index_usage AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    CASE
        WHEN idx_tup_read = 0 THEN 0
        ELSE (idx_tup_fetch::float / idx_tup_read) * 100
    END as hit_rate
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY hit_rate ASC;

-- Table size monitoring
CREATE VIEW vw_table_sizes AS
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size,
    pg_total_relation_size(tablename::regclass) as size_bytes
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'ml_%'
ORDER BY size_bytes DESC;

-- Automated maintenance procedures
CREATE OR REPLACE FUNCTION maintain_ml_tables()
RETURNS void AS $$
BEGIN
    -- Update table statistics
    ANALYZE ml_feature_store;
    ANALYZE ml_predictions;
    ANALYZE ml_backtesting_results;

    -- Refresh materialized views
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_features;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_feature_vectors;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_performance;

    -- Clean up old partitions (older than 2 years for most tables)
    PERFORM drop_old_partitions('ml_feature_store', INTERVAL '2 years');
    PERFORM drop_old_partitions('ml_predictions', INTERVAL '1 year');

    -- Reindex heavily used tables
    REINDEX INDEX CONCURRENTLY idx_feature_store_ticker_time_feature;
    REINDEX INDEX CONCURRENTLY idx_predictions_ticker_time;
END;
$$ LANGUAGE plpgsql;

-- Schedule maintenance (run via cron or pg_cron)
SELECT cron.schedule('ml-maintenance', '0 2 * * 0', 'SELECT maintain_ml_tables();');
```

## Integration with VFR Database Services

### Extending Existing Database Service

```typescript
// ====================
// VFR DATABASE INTEGRATION
// ====================

// Extend existing HistoricalDataService for ML capabilities
export class MLDatabaseService extends HistoricalDataService {
  private featureStorePool: Pool
  private influxClient?: InfluxDB

  constructor() {
    super()

    // Dedicated connection pool for ML workloads
    this.featureStorePool = new Pool({
      connectionString: process.env.ML_DATABASE_URL || process.env.DATABASE_URL,
      max: 20, // Higher connection limit for ML operations
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000, // 30 second timeout for complex queries
      query_timeout: 30000
    })

    // Optional InfluxDB for high-frequency data
    if (process.env.INFLUXDB_URL) {
      this.influxClient = new InfluxDB({
        url: process.env.INFLUXDB_URL,
        token: process.env.INFLUXDB_TOKEN,
        org: process.env.INFLUXDB_ORG || 'VFR'
      })
    }
  }

  /**
   * High-performance feature storage with batch operations
   */
  async storeFeatureBatch(
    features: FeatureStorageRequest[]
  ): Promise<FeatureStorageResult> {
    if (features.length === 0) return { stored: 0, errors: [] }

    const client = await this.featureStorePool.connect()

    try {
      await client.query('BEGIN')

      // Use COPY for maximum performance
      const copyStream = client.query(copyFrom(
        'COPY ml_feature_store (ticker, timestamp, feature_id, value, confidence_score, data_quality_score, source_provider) FROM STDIN WITH (FORMAT csv)'
      ))

      // Convert features to CSV format
      const csvData = features.map(f =>
        `${f.ticker},${f.timestamp.toISOString()},${f.featureId},${f.value},${f.confidence},${f.quality},${f.source}`
      ).join('\n')

      copyStream.write(csvData)
      copyStream.end()

      await client.query('COMMIT')

      // Update Redis cache for real-time access
      await this.updateFeatureCache(features)

      return { stored: features.length, errors: [] }

    } catch (error) {
      await client.query('ROLLBACK')
      throw new MLDatabaseError(`Batch feature storage failed: ${error.message}`)
    } finally {
      client.release()
    }
  }

  /**
   * Optimized feature retrieval for ML predictions
   */
  async getFeatureMatrix(
    tickers: string[],
    featureIds: string[],
    asOfTime?: Date
  ): Promise<FeatureMatrix> {
    const timestamp = asOfTime || new Date()

    // Use materialized view for recent data
    const useMatView = timestamp >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const query = useMatView ? `
      SELECT ticker, feature_id, value, confidence_score
      FROM mv_daily_features mdf
      JOIN ml_feature_definitions fd ON fd.feature_name =
        (SELECT feature_name FROM ml_feature_definitions WHERE feature_id = mdf.feature_id)
      WHERE ticker = ANY($1)
        AND feature_id = ANY($2)
        AND trade_date = $3::date
        AND rank_latest = 1
    ` : `
      SELECT DISTINCT ON (ticker, feature_id)
        ticker, feature_id, value, confidence_score
      FROM ml_feature_store
      WHERE ticker = ANY($1)
        AND feature_id = ANY($2)
        AND timestamp <= $3
        AND validation_status = 'valid'
      ORDER BY ticker, feature_id, timestamp DESC
    `

    const result = await this.featureStorePool.query(query, [
      tickers,
      featureIds,
      timestamp
    ])

    return this.buildFeatureMatrix(result.rows, tickers, featureIds)
  }

  /**
   * Store ML predictions with performance tracking
   */
  async storePrediction(prediction: MLPredictionRecord): Promise<string> {
    const query = `
      INSERT INTO ml_predictions (
        model_id, ticker, prediction_timestamp, prediction_horizon,
        prediction_type, predicted_value, confidence_score,
        probability_up, probability_down, current_price,
        implied_return, features_used, feature_vector,
        execution_time_ms, cache_hit, feature_freshness_seconds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING prediction_id
    `

    const result = await this.featureStorePool.query(query, [
      prediction.modelId,
      prediction.ticker,
      prediction.timestamp,
      prediction.horizon,
      prediction.type,
      prediction.value,
      prediction.confidence,
      prediction.probabilityUp,
      prediction.probabilityDown,
      prediction.currentPrice,
      prediction.impliedReturn,
      prediction.featuresUsed,
      JSON.stringify(prediction.featureVector),
      prediction.executionTimeMs,
      prediction.cacheHit,
      prediction.featureFreshness
    ])

    const predictionId = result.rows[0].prediction_id

    // Cache prediction for fast retrieval
    await this.cachePrediction(predictionId, prediction)

    return predictionId
  }

  /**
   * Update prediction with actual results for performance tracking
   */
  async updatePredictionActual(
    predictionId: string,
    actualValue: number,
    actualTimestamp: Date
  ): Promise<void> {
    const query = `
      UPDATE ml_predictions
      SET
        actual_value = $2,
        actual_timestamp = $3,
        prediction_error = $2 - predicted_value,
        squared_error = POWER($2 - predicted_value, 2),
        absolute_error = ABS($2 - predicted_value),
        direction_correct = CASE
          WHEN (predicted_value > current_price AND $2 > current_price) OR
               (predicted_value < current_price AND $2 < current_price) OR
               (predicted_value = current_price AND $2 = current_price)
          THEN true
          ELSE false
        END
      WHERE prediction_id = $1
    `

    await this.featureStorePool.query(query, [predictionId, actualValue, actualTimestamp])

    // Trigger model performance recalculation
    await this.updateModelPerformanceMetrics(predictionId)
  }

  /**
   * High-performance backtesting data retrieval
   */
  async getBacktestingData(
    experiment: BacktestExperiment
  ): Promise<BacktestDataset> {
    // Use parallel queries for different data types
    const [priceData, features, benchmarkData] = await Promise.all([
      this.getPriceDataForBacktest(experiment),
      this.getFeatureDataForBacktest(experiment),
      this.getBenchmarkDataForBacktest(experiment)
    ])

    return {
      prices: priceData,
      features: features,
      benchmark: benchmarkData,
      metadata: {
        startDate: experiment.startDate,
        endDate: experiment.endDate,
        tickers: experiment.tickers,
        totalSamples: priceData.length
      }
    }
  }

  private async updateFeatureCache(features: FeatureStorageRequest[]): Promise<void> {
    const cacheOps = features.map(f => ({
      key: `ml:feat:${f.ticker}:${f.featureId}:${Math.floor(f.timestamp.getTime() / 60000)}`,
      value: {
        value: f.value,
        confidence: f.confidence,
        quality: f.quality,
        source: f.source,
        timestamp: f.timestamp.getTime()
      },
      ttl: 900 // 15 minutes
    }))

    await this.cache.mset(cacheOps)
  }

  private buildFeatureMatrix(
    rows: any[],
    tickers: string[],
    featureIds: string[]
  ): FeatureMatrix {
    const matrix: FeatureMatrix = {
      tickers,
      featureIds,
      data: new Map(),
      metadata: {
        completeness: 0,
        avgConfidence: 0,
        avgQuality: 0
      }
    }

    // Initialize matrix
    tickers.forEach(ticker => {
      matrix.data.set(ticker, new Map())
    })

    // Fill matrix with data
    let totalEntries = 0
    let totalConfidence = 0
    let totalQuality = 0

    rows.forEach(row => {
      const tickerMap = matrix.data.get(row.ticker)
      if (tickerMap) {
        tickerMap.set(row.feature_id, {
          value: parseFloat(row.value),
          confidence: parseFloat(row.confidence_score),
          quality: parseFloat(row.data_quality_score || 1.0)
        })
        totalEntries++
        totalConfidence += parseFloat(row.confidence_score)
        totalQuality += parseFloat(row.data_quality_score || 1.0)
      }
    })

    // Calculate metadata
    const expectedEntries = tickers.length * featureIds.length
    matrix.metadata.completeness = totalEntries / expectedEntries
    matrix.metadata.avgConfidence = totalEntries > 0 ? totalConfidence / totalEntries : 0
    matrix.metadata.avgQuality = totalEntries > 0 ? totalQuality / totalEntries : 0

    return matrix
  }
}
```

This comprehensive database architecture provides VFR with enterprise-grade ML infrastructure that scales with existing patterns while delivering the performance needed for sophisticated financial machine learning applications.