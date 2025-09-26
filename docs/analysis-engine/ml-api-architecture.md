# VFR ML Enhancement API Architecture - Modular Extension Specifications

**Production-Ready API Design for ML-Enhanced Financial Analysis System**

## Executive Summary

This document provides comprehensive API architecture specifications for VFR's ML enhancement layer, extending existing REST API patterns with optional machine learning capabilities. The design preserves all existing VFR functionality while adding enterprise-grade ML insights as optional enhancements, maintaining backward compatibility and zero breaking changes.

## API Architecture Overview

### Integration with Existing VFR API Structure - Enhancement Approach

```
Existing VFR API → ML-Enhanced API Architecture (Backward Compatible)
├── app/api/stocks/              ├── app/api/stocks/ (Enhanced with optional ML parameters)
├── app/api/admin/               ├── app/api/admin/ (Extended with ML monitoring options)
├── app/api/health/              ├── app/api/health/ (Includes ML health status)
├── app/api/user_auth/           ├── app/api/user_auth/ (Unchanged - same authentication)
└── app/api/economic/            ├── app/api/economic/ (Unchanged)
                                 └── app/api/ml/ (NEW - Optional ML-specific endpoints)
```

### API Design Principles

1. **Backward Compatibility**: All existing API contracts preserved unchanged
2. **Optional Enhancement**: ML features available as opt-in parameters
3. **Graceful Degradation**: Full VFR functionality maintained if ML fails
4. **Zero Breaking Changes**: Existing clients continue working without modification
5. **Performance-Optimized**: <100ms additional latency for ML enhancements
6. **Security-Preserved**: Leverages existing SecurityValidator and JWT patterns

## Enhanced Existing API Endpoints

### 1. Enhanced Stock Selection API

#### **POST /api/stocks/select** (Enhanced with optional ML)

**Purpose**: Existing stock selection endpoint enhanced with optional ML insights, maintains full backward compatibility

```typescript
// Enhanced Request Schema (Backward Compatible)
interface EnhancedStockSelectionRequest {
  // Existing VFR parameters (unchanged)
  symbols?: string[]                       // Array of stock symbols
  sector?: string                          // Sector filter
  limit?: number                          // Number of results

  // NEW: Optional ML enhancement parameters
  include_ml?: boolean                     // Optional: Enable ML enhancements
  ml_models?: string[]                     // Optional: Specific models to use
  ml_horizon?: PredictionHorizon           // Optional: ML prediction timeframe
  ml_confidence_threshold?: number         // Optional: Minimum ML confidence filter
  include_ml_explanation?: boolean         // Optional: Include ML reasoning
}

type PredictionHorizon = '1h' | '4h' | '1d' | '1w' | '1m' | '3m'
type EnsembleMethod = 'weighted' | 'voting' | 'stacking' | 'meta_learning'
type CachePreference = 'prefer_cache' | 'prefer_fresh' | 'cache_only'

// Enhanced Response Schema (Backward Compatible)
interface EnhancedStockSelectionResponse {
  success: boolean
  data: {
    stocks: EnhancedStockAnalysis[]          // Enhanced existing format
    analysis_metadata: AnalysisMetadata      // Existing metadata enhanced
    performance: PerformanceMetrics          // Existing + ML performance
    warnings?: string[]                      // ML-related warnings if any
  }
  error?: APIError
  request_id: string
  timestamp: number
  enhanced_with_ml: boolean                  // Indicates if ML was used
}

interface EnhancedStockAnalysis {
  // Existing VFR analysis fields (unchanged)
  symbol: string
  currentPrice: number
  compositeScore: number                   // Existing VFR score
  recommendation: 'BUY' | 'SELL' | 'HOLD'  // Existing VFR recommendation
  confidence: number                       // Existing VFR confidence
  factors: {
    technical: number                      // Existing factor scores
    fundamental: number
    macroeconomic: number
    sentiment: number
    extendedMarket: number
  }

  // NEW: Optional ML enhancement fields (only present if include_ml=true)
  mlEnhancement?: {
    enhancedScore: number                  // ML-enhanced composite score
    mlPrediction: {
      [horizon: string]: {
        priceTarget: number
        direction: 'up' | 'down' | 'neutral'
        confidence: number
        expectedReturn: number
        riskScore: number
      }
    }
    mlFactorContribution: number           // ML contribution to enhanced score (typically 10%)
    modelMetadata: {
      modelsUsed: string[]
      ensembleMethod: string
      predictionLatency: number
    }
    explanation?: {
      keyFactors: string[]
      riskFactors: string[]
      supportingEvidence: string[]
    }
  }
}

interface ScenarioOutcome {
  probability: number
  price_target: number
  key_drivers: string[]
}

interface AnalysisMetadata {
  // Existing VFR metadata (preserved)
  analysisType: 'vfr_classic' | 'vfr_ml_enhanced'
  dataSourcesUsed: string[]
  analysisLatency: number
  cacheHitRatio: number

  // NEW: ML-specific metadata (only if ML was used)
  mlMetadata?: {
    modelsUsed: string[]
    featuresCount: number
    mlLatency: number
    ensembleMethod: string
    fallbackMode: boolean
    mlConfidence: number
  }
}

interface PerformanceMetrics {
  total_latency_ms: number
  feature_extraction_ms: number
  model_inference_ms: number
  ensemble_combination_ms: number
  cache_lookup_ms: number
}
```

#### **Implementation Example**

```typescript
// app/api/stocks/select/route.ts (Enhanced, not replaced)
import { NextRequest, NextResponse } from 'next/server'
import { MLEnhancedStockSelectionService } from '@/app/services/stock-selection/MLEnhancedStockSelectionService'
import { SecurityValidator } from '@/app/services/security/SecurityValidator'
import { AuthService } from '@/app/services/auth/AuthService'

export async function POST(request: NextRequest) {
  const startTime = performance.now()

  try {
    // Existing authentication (unchanged)
    const authResult = await AuthService.validateJWT(request)
    if (!authResult.isValid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Existing request validation (unchanged)
    const body = await request.json()
    const validation = SecurityValidator.validateStockSelectionRequest(body)

    if (!validation.isValid) {
      return NextResponse.json({ success: false, error: validation.errors }, { status: 400 })
    }

    // Enhanced service that preserves existing functionality
    const stockSelectionService = new MLEnhancedStockSelectionService()

    // Analyze stocks with optional ML enhancement
    const result = await stockSelectionService.analyzeStocks(body.symbols || [], {
      includeML: body.include_ml || false,
      mlModels: body.ml_models,
      mlHorizon: body.ml_horizon || '1w',
      mlConfidenceThreshold: body.ml_confidence_threshold || 0.5
    })

    const totalLatency = performance.now() - startTime

    return NextResponse.json({
      success: true,
      data: {
        stocks: result,
        analysis_metadata: {
          analysisType: body.include_ml ? 'vfr_ml_enhanced' : 'vfr_classic',
          analysisLatency: totalLatency,
          dataSourcesUsed: await stockSelectionService.getDataSourcesUsed(),
          mlMetadata: body.include_ml ? {
            modelsUsed: result[0]?.mlEnhancement?.modelMetadata?.modelsUsed || [],
            mlLatency: result[0]?.mlEnhancement?.modelMetadata?.predictionLatency || 0,
            fallbackMode: false
          } : undefined
        }
      },
      request_id: generateRequestId(),
      timestamp: Date.now(),
      enhanced_with_ml: body.include_ml || false
    })

  } catch (error) {
    console.error('Stock analysis failed:', error)

    // Graceful fallback to classic VFR analysis
    return await this.fallbackToClassicAnalysis(body, authResult, startTime)
  }
}

// Graceful fallback mechanism
async function fallbackToClassicAnalysis(
  body: any,
  authResult: any,
  startTime: number
): Promise<NextResponse> {
  try {
    // Use original VFR StockSelectionService as fallback
    const classicService = new StockSelectionService()
    const result = await classicService.analyzeStocks(body.symbols || [])

    const totalLatency = performance.now() - startTime

    return NextResponse.json({
      success: true,
      data: {
        stocks: result,
        analysis_metadata: {
          analysisType: 'vfr_classic',
          analysisLatency: totalLatency,
          dataSourcesUsed: await classicService.getDataSourcesUsed()
        }
      },
      warnings: ['ML enhancement temporarily unavailable, analysis completed using VFR classic methodology'],
      request_id: generateRequestId(),
      timestamp: Date.now(),
      enhanced_with_ml: false
    })
  } catch (fallbackError) {
    return NextResponse.json(
      { success: false, error: 'Analysis service temporarily unavailable' },
      { status: 503 }
    )
  }
}
```

### 2. Enhanced Health Check API

#### **GET /api/health** (Enhanced with ML status)

**Purpose**: Existing health check endpoint enhanced with optional ML service status

```typescript
// Enhanced Health Response (Backward Compatible)
interface EnhancedHealthResponse {
  // Existing health check fields (unchanged)
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: number
  database: 'connected' | 'disconnected'
  redis: 'connected' | 'disconnected'

  // NEW: Optional ML service status
  ml_services?: {
    ml_prediction_service: 'healthy' | 'degraded' | 'unavailable'
    feature_engineering: 'healthy' | 'degraded' | 'unavailable'
    model_registry: 'healthy' | 'degraded' | 'unavailable'
    enhancement_layer: 'active' | 'inactive'
  }

  // Existing services (unchanged)
  data_sources: {
    [source: string]: 'healthy' | 'degraded' | 'unavailable'
  }
}

// Implementation preserves existing functionality
export async function GET(request: NextRequest) {
  try {
    // Existing health checks (unchanged)
    const healthStatus = await HealthService.checkSystemHealth()

    // Optional ML health checks (non-blocking)
    let mlStatus = undefined
    try {
      mlStatus = await MLHealthService.checkMLServices()
    } catch (mlError) {
      console.warn('ML health check failed:', mlError)
      // ML failure doesn't affect overall system health
    }

    return NextResponse.json({
      ...healthStatus,
      ml_services: mlStatus,
      timestamp: Date.now()
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: Date.now()
    }, { status: 503 })
  }
}
```

### 3. Enhanced Admin API

#### **GET /api/admin/data-sources** (Enhanced with ML monitoring)

**Purpose**: Existing admin endpoint enhanced with optional ML service monitoring

```typescript
// Enhanced Admin Response (Backward Compatible)
interface EnhancedDataSourceStatus {
  // Existing data source status (unchanged)
  financial_apis: {
    [provider: string]: {
      status: 'healthy' | 'degraded' | 'unavailable'
      last_check: number
      response_time_ms: number
      error_rate: number
    }
  }

  // NEW: Optional ML service status
  ml_services?: {
    prediction_service: {
      status: 'active' | 'inactive' | 'error'
      last_prediction: number
      avg_latency_ms: number
      cache_hit_ratio: number
      models_loaded: number
    }
    enhancement_layer: {
      status: 'enabled' | 'disabled'
      usage_rate: number
      fallback_rate: number
      enhancement_latency_ms: number
    }
  }
}
```

## Optional ML-Specific Endpoints

### 4. ML-Specific Prediction API (Optional)

#### **POST /api/ml/predict** (New endpoint for ML-specific requests)

**Purpose**: Dedicated ML endpoint for users who want ML-only predictions (not mixed with VFR analysis)

```typescript
interface MLOnlyPredictionRequest {
  symbols: string[]
  models?: string[]
  horizon?: PredictionHorizon
  ensemble_method?: EnsembleMethod
  include_explanation?: boolean
}

interface MLOnlyPredictionResponse {
  success: boolean
  data: {
    predictions: MLPrediction[]
    metadata: MLMetadata
    performance: MLPerformanceMetrics
  }
  fallback_available: boolean  // Indicates if VFR fallback is available
}
```

### 5. ML Model Management API (Admin)

#### **GET /api/ml/models** (New endpoint for model management)

**Purpose**: Model registry and management for administrators

```typescript
interface ModelListResponse {
  success: boolean
  data: {
    models: ModelInfo[]
    active_models: string[]
    deployment_status: DeploymentStatus
  }
}

interface ModelInfo {
  model_id: string
  name: string
  version: string
  algorithm: string
  status: 'active' | 'inactive' | 'training' | 'deployed'
  performance_metrics: {
    accuracy: number
    latency_ms: number
    last_evaluation: number
  }
  deployment_info: {
    environment: 'staging' | 'production'
    traffic_percentage: number
    deployed_at: number
  }
}
```

## API Usage Patterns

### 1. Backward Compatible Usage (Existing clients)

```typescript
// Existing clients continue working unchanged
const response = await fetch('/api/stocks/select', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    symbols: ['AAPL', 'GOOGL'],
    limit: 10
  })
})

// Response identical to existing format
const data = await response.json()
console.log(data.data.stocks) // Same structure as before
```

### 2. Enhanced Usage (New ML features)

```typescript
// New clients can opt-in to ML enhancements
const response = await fetch('/api/stocks/select', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    symbols: ['AAPL', 'GOOGL'],
    limit: 10,
    include_ml: true,           // NEW: Enable ML enhancements
    ml_horizon: '1w',           // NEW: ML prediction timeframe
    ml_confidence_threshold: 0.7 // NEW: ML confidence filter
  })
})

const data = await response.json()
console.log(data.enhanced_with_ml) // true
console.log(data.data.stocks[0].mlEnhancement) // ML insights
```

### 3. ML-Only Usage (Advanced users)

```typescript
// Advanced users can use ML-specific endpoints
const response = await fetch('/api/ml/predict', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    symbols: ['AAPL'],
    models: ['momentum-lstm', 'mean-reversion-xgb'],
    horizon: '1w',
    ensemble_method: 'weighted'
  })
})

const mlPredictions = await response.json()
```

## Error Handling and Fallback Patterns

### 1. Graceful Degradation

```typescript
// When ML services fail, API automatically falls back
{
  "success": true,
  "data": {
    "stocks": [...], // VFR classic analysis results
    "analysis_metadata": {
      "analysisType": "vfr_classic",
      "analysisLatency": 1234
    }
  },
  "warnings": ["ML enhancement temporarily unavailable"],
  "enhanced_with_ml": false
}
```

### 2. Partial Enhancement Failure

```typescript
// When some ML components fail, partial enhancement provided
{
  "success": true,
  "data": {
    "stocks": [{
      // Standard VFR fields present
      "symbol": "AAPL",
      "compositeScore": 75,
      // Partial ML enhancement
      "mlEnhancement": {
        "enhancedScore": 78, // Only basic ML enhancement
        // Advanced features omitted due to partial failure
      }
    }]
  },
  "enhanced_with_ml": true,
  "warnings": ["Advanced ML features temporarily unavailable"]
}
```

## Performance Characteristics

### Response Time Targets

| Endpoint | Without ML | With ML Enhancement | ML-Only |
|----------|------------|-------------------|---------|
| `/api/stocks/select` | <2s (existing) | <2.5s (+500ms) | N/A |
| `/api/ml/predict` | N/A | N/A | <1s |
| `/api/health` | <100ms (existing) | <150ms (+50ms) | N/A |

### Rate Limiting

```typescript
// Rate limits by user tier
interface RateLimits {
  basic_users: {
    stocks_select: 100, // requests per hour
    ml_enhanced: 20,    // ML enhancements per hour
    ml_only: 0          // No ML-only access
  }
  premium_users: {
    stocks_select: 500,
    ml_enhanced: 200,
    ml_only: 50
  }
  enterprise_users: {
    stocks_select: 'unlimited',
    ml_enhanced: 'unlimited',
    ml_only: 500
  }
}
```

This API architecture ensures VFR's ML enhancement layer integrates seamlessly with existing functionality while providing sophisticated ML capabilities as optional enhancements, maintaining zero breaking changes and complete backward compatibility.
    // 1. Authentication and rate limiting (leveraging existing patterns)
    const authResult = await AuthService.validateJWT(request)
    if (!authResult.isValid) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid authentication' } },
        { status: 401 }
      )
    }

    // 2. Rate limiting for ML predictions
    const rateLimitResult = await AuthService.checkMLRateLimit(authResult.userId, 'predictions')
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'ML prediction rate limit exceeded',
            retry_after: rateLimitResult.retryAfter
          }
        },
        { status: 429 }
      )
    }

    // 3. Request validation
    const body = await request.json()
    const validationResult = SecurityValidator.validateMLPredictionRequest(body)

    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: validationResult.errors
          }
        },
        { status: 400 }
      )
    }

    // 4. Execute ML prediction
    const predictionService = new MLPredictionService()
    const result = await predictionService.predictStocks({
      ...body,
      userId: authResult.userId,
      userTier: authResult.tier
    })

    // 5. Performance tracking
    const totalLatency = performance.now() - startTime

    return NextResponse.json({
      success: true,
      data: result.data,
      request_id: generateRequestId(),
      timestamp: Date.now(),
      performance: {
        ...result.performance,
        total_latency_ms: totalLatency
      }
    })

  } catch (error) {
    console.error('ML Prediction API error:', error)

    // Fallback to classic VFR analysis
    const fallbackResult = await this.fallbackToClassicAnalysis(body, authResult)

    return NextResponse.json({
      success: true,
      data: fallbackResult,
      request_id: generateRequestId(),
      timestamp: Date.now(),
      warnings: ['ML service unavailable, using classic analysis']
    })
  }
}
```

### 2. Model Management API

#### **GET /api/ml/models**

**Purpose**: List available ML models with performance metrics

```typescript
interface ModelListRequest {
  status?: ModelStatus[]
  objective?: string[]
  algorithm?: string[]
  sort_by?: 'performance' | 'created_at' | 'name'
  limit?: number
  offset?: number
}

type ModelStatus = 'training' | 'active' | 'deprecated' | 'experimental'

interface ModelListResponse {
  success: boolean
  data: {
    models: ModelSummary[]
    total_count: number
    pagination: PaginationInfo
  }
}

interface ModelSummary {
  model_id: string
  name: string
  version: string
  status: ModelStatus
  algorithm: string
  objective: string
  performance: {
    accuracy: number
    precision: number
    recall: number
    f1_score: number
    sharpe_ratio?: number
    max_drawdown?: number
    last_updated: number
  }
  deployment: {
    environment: string
    traffic_percentage: number
    endpoint_url?: string
  }
  metadata: {
    created_at: number
    model_size_mb: number
    inference_latency_p95: number
    feature_count: number
  }
}
```

#### **POST /api/ml/models**

**Purpose**: Register new ML model (Admin only)

```typescript
interface ModelRegistrationRequest {
  name: string
  version: string
  algorithm: string
  objective: string
  model_artifact_path: string
  hyperparameters: Record<string, any>
  feature_schema: FeatureSchema
  training_config: TrainingConfig
  performance_metrics: PerformanceMetrics
}

interface FeatureSchema {
  features: {
    [feature_name: string]: {
      type: 'numeric' | 'categorical' | 'boolean'
      required: boolean
      min_value?: number
      max_value?: number
      categories?: string[]
    }
  }
  version: string
}
```

#### **GET /api/ml/models/{model_id}**

**Purpose**: Get detailed model information

```typescript
interface ModelDetailResponse {
  success: boolean
  data: {
    model: DetailedModelInfo
    performance_history: PerformanceHistory[]
    deployment_history: DeploymentHistory[]
  }
}

interface DetailedModelInfo extends ModelSummary {
  description: string
  hyperparameters: Record<string, any>
  feature_importance: Record<string, number>
  training_details: {
    training_duration_minutes: number
    training_samples: number
    validation_samples: number
    cross_validation_scores: number[]
  }
  drift_detection: {
    feature_drift_score: number
    prediction_drift_score: number
    last_check: number
    status: 'healthy' | 'warning' | 'critical'
  }
}
```

### 3. Backtesting API

#### **POST /api/ml/backtest**

**Purpose**: Create and execute backtesting experiments

```typescript
interface BacktestRequest {
  name: string
  model_id: string
  universe: {
    symbols?: string[]
    sector?: string
    market_cap_range?: [number, number]
    filters?: UniverseFilter[]
  }
  time_period: {
    start_date: string
    end_date: string
  }
  strategy: {
    rebalance_frequency: 'daily' | 'weekly' | 'monthly'
    position_sizing: 'equal_weight' | 'market_cap' | 'risk_parity' | 'ml_confidence'
    max_position_size: number
    stop_loss?: number
    take_profit?: number
  }
  transaction_costs: {
    commission_rate: number
    bid_ask_spread_bps: number
    market_impact_model: 'linear' | 'square_root' | 'custom'
  }
  benchmark: string
  walk_forward?: {
    enabled: boolean
    training_window_months: number
    retraining_frequency_months: number
  }
}

interface BacktestResponse {
  success: boolean
  data: {
    experiment_id: string
    status: 'queued' | 'running' | 'completed' | 'failed'
    estimated_completion_time?: number
    progress_url: string
  }
}
```

#### **GET /api/ml/backtest/{experiment_id}**

**Purpose**: Get backtesting results and progress

```typescript
interface BacktestResultResponse {
  success: boolean
  data: {
    experiment: BacktestExperiment
    status: 'queued' | 'running' | 'completed' | 'failed'
    progress: number // 0-100
    results?: BacktestResults
    error?: string
  }
}

interface BacktestResults {
  performance: {
    total_return: number
    annualized_return: number
    volatility: number
    sharpe_ratio: number
    sortino_ratio: number
    max_drawdown: number
    calmar_ratio: number
    win_rate: number
    profit_factor: number
  }
  benchmark_comparison: {
    benchmark_return: number
    excess_return: number
    tracking_error: number
    information_ratio: number
    beta: number
    alpha: number
  }
  risk_metrics: {
    var_95: number
    cvar_95: number
    downside_deviation: number
    maximum_consecutive_losses: number
    average_drawdown_duration: number
  }
  trading_metrics: {
    total_trades: number
    avg_holding_period: number
    turnover_rate: number
    transaction_costs_total: number
    cost_percentage_of_returns: number
  }
  monthly_returns: MonthlyReturn[]
  equity_curve: EquityCurvePoint[]
  drawdown_periods: DrawdownPeriod[]
  trade_analysis: TradeAnalysis
}
```

### 4. Feature Engineering API

#### **POST /api/ml/features/generate**

**Purpose**: Generate features for specific symbols and time periods

```typescript
interface FeatureGenerationRequest {
  symbols: string[]
  feature_types: FeatureType[]
  time_range: {
    start_date: string
    end_date: string
  }
  frequency: 'daily' | 'hourly' | 'minute'
  custom_features?: CustomFeatureDefinition[]
  output_format: 'json' | 'csv' | 'parquet'
}

type FeatureType = 'technical' | 'fundamental' | 'sentiment' | 'macro' | 'options' | 'alternative'

interface CustomFeatureDefinition {
  name: string
  calculation: string // SQL expression or Python code
  dependencies: string[]
  parameters?: Record<string, any>
}

interface FeatureGenerationResponse {
  success: boolean
  data: {
    job_id: string
    status: 'queued' | 'processing' | 'completed' | 'failed'
    estimated_completion: number
    download_url?: string
    feature_count: number
    sample_preview?: Record<string, any>
  }
}
```

#### **GET /api/ml/features/definitions**

**Purpose**: Get available feature definitions and metadata

```typescript
interface FeatureDefinitionsResponse {
  success: boolean
  data: {
    features: FeatureDefinition[]
    categories: FeatureCategory[]
  }
}

interface FeatureDefinition {
  name: string
  category: string
  description: string
  data_type: 'numeric' | 'categorical' | 'boolean'
  calculation_method: string
  dependencies: string[]
  update_frequency: string
  source_apis: string[]
  historical_availability: {
    start_date: string
    coverage_percentage: number
  }
}
```

### 5. Model Monitoring API

#### **GET /api/ml/monitoring/models/{model_id}/performance**

**Purpose**: Real-time model performance monitoring

```typescript
interface ModelPerformanceRequest {
  time_range: TimeRange
  metrics: string[]
  granularity: 'hour' | 'day' | 'week'
}

interface ModelPerformanceResponse {
  success: boolean
  data: {
    metrics: {
      [metric_name: string]: TimeSeriesData[]
    }
    alerts: PerformanceAlert[]
    summary: PerformanceSummary
  }
}

interface TimeSeriesData {
  timestamp: number
  value: number
  confidence_interval?: [number, number]
}

interface PerformanceAlert {
  type: 'drift' | 'degradation' | 'latency' | 'error_rate'
  severity: 'info' | 'warning' | 'critical'
  message: string
  timestamp: number
  affected_metrics: string[]
  suggested_actions: string[]
}
```

#### **POST /api/ml/monitoring/models/{model_id}/retrain**

**Purpose**: Trigger model retraining (Admin only)

```typescript
interface RetrainingRequest {
  trigger_reason: 'scheduled' | 'drift_detected' | 'performance_degradation' | 'manual'
  training_config?: Partial<TrainingConfig>
  notification_settings?: NotificationSettings
}

interface RetrainingResponse {
  success: boolean
  data: {
    training_job_id: string
    estimated_duration: number
    status_url: string
  }
}
```

## Authentication and Authorization

### 1. Extended JWT Claims for ML Features

```typescript
interface MLJWTClaims extends StandardJWTClaims {
  ml_tier: 'free' | 'premium' | 'enterprise'
  ml_permissions: MLPermission[]
  rate_limits: {
    predictions_per_day: number
    models_access: string[]
    batch_size_limit: number
    backtest_concurrent: number
  }
}

type MLPermission =
  | 'predict:basic'
  | 'predict:advanced'
  | 'backtest:run'
  | 'models:view'
  | 'models:deploy'
  | 'features:generate'
  | 'monitoring:view'
  | 'admin:full'
```

### 2. ML-Specific Rate Limiting

```typescript
interface MLRateLimits {
  free: {
    predictions_per_hour: 100
    batch_size_max: 5
    models_concurrent: 1
    backtest_per_month: 1
    features_per_day: 10
  }
  premium: {
    predictions_per_hour: 1000
    batch_size_max: 25
    models_concurrent: 3
    backtest_per_month: 10
    features_per_day: 100
  }
  enterprise: {
    predictions_per_hour: 10000
    batch_size_max: 100
    models_concurrent: 10
    backtest_per_month: 50
    features_per_day: 1000
  }
}

// Rate limiting implementation
class MLRateLimiter extends RateLimiter {
  async checkMLLimit(
    userId: string,
    operation: 'prediction' | 'backtest' | 'features',
    quantity: number = 1
  ): Promise<RateLimitResult> {
    const userTier = await this.getUserTier(userId)
    const limits = MLRateLimits[userTier]

    const key = `ml:${operation}:${userId}`
    const current = await this.redis.get(key) || 0

    const limit = this.getLimitForOperation(operation, limits)
    const window = this.getWindowForOperation(operation)

    if (current + quantity > limit) {
      return {
        allowed: false,
        remaining: Math.max(0, limit - current),
        resetTime: await this.getResetTime(key, window),
        retryAfter: await this.getRetryAfter(key, window)
      }
    }

    await this.redis.incrby(key, quantity)
    await this.redis.expire(key, window)

    return {
      allowed: true,
      remaining: limit - current - quantity,
      resetTime: await this.getResetTime(key, window)
    }
  }
}
```

## Error Handling and Status Codes

### 1. ML-Specific Error Codes

```typescript
enum MLErrorCodes {
  // Prediction Errors (4000-4099)
  MODEL_UNAVAILABLE = 4001,
  FEATURE_GENERATION_FAILED = 4002,
  PREDICTION_TIMEOUT = 4003,
  INSUFFICIENT_DATA = 4004,
  MODEL_OVERLOADED = 4005,

  // Training Errors (4100-4199)
  TRAINING_FAILED = 4101,
  INVALID_TRAINING_DATA = 4102,
  TRAINING_TIMEOUT = 4103,
  INSUFFICIENT_TRAINING_DATA = 4104,

  // Backtesting Errors (4200-4299)
  BACKTEST_FAILED = 4201,
  INVALID_UNIVERSE = 4202,
  INSUFFICIENT_HISTORICAL_DATA = 4203,

  // Rate Limiting (4300-4399)
  ML_RATE_LIMIT_EXCEEDED = 4301,
  CONCURRENT_LIMIT_EXCEEDED = 4302,
  QUOTA_EXHAUSTED = 4303,

  // System Errors (5000-5099)
  ML_SERVICE_UNAVAILABLE = 5001,
  MODEL_LOAD_FAILED = 5002,
  MEMORY_EXHAUSTED = 5003,
  INFRASTRUCTURE_ERROR = 5004
}

interface MLAPIError {
  code: MLErrorCodes
  message: string
  details?: Record<string, any>
  timestamp: number
  request_id: string
  fallback_available?: boolean
  retry_after?: number
  documentation_url?: string
}
```

### 2. Graceful Degradation Strategy

```typescript
// app/services/ml/MLErrorHandler.ts
class MLErrorHandler extends ErrorHandler {
  async handleMLError(
    error: MLError,
    request: MLRequest,
    context: RequestContext
  ): Promise<MLResponse> {
    const errorCode = this.classifyError(error)

    switch (errorCode) {
      case MLErrorCodes.MODEL_UNAVAILABLE:
        // Fallback to ensemble of available models
        return await this.fallbackToAvailableModels(request, context)

      case MLErrorCodes.FEATURE_GENERATION_FAILED:
        // Use cached features or simplified feature set
        return await this.fallbackToSimpleFeatures(request, context)

      case MLErrorCodes.PREDICTION_TIMEOUT:
        // Return cached prediction or fast estimation
        return await this.fallbackToCachedOrEstimate(request, context)

      case MLErrorCodes.ML_SERVICE_UNAVAILABLE:
        // Complete fallback to VFR classic analysis
        return await this.fallbackToClassicAnalysis(request, context)

      default:
        throw new APIError(
          500,
          'ML service error',
          { originalError: error.message, code: errorCode }
        )
    }
  }

  private async fallbackToClassicAnalysis(
    request: MLRequest,
    context: RequestContext
  ): Promise<MLResponse> {
    console.warn('ML service unavailable, falling back to classic analysis')

    // Use existing VFR analysis services
    const classicResults = await this.stockSelectionService.analyzeStocks(request.symbols)

    // Convert to ML response format
    return this.convertClassicToMLFormat(classicResults, {
      fallback_mode: true,
      fallback_reason: 'ml_service_unavailable',
      original_request: request
    })
  }
}
```

## API Versioning Strategy

### 1. Semantic Versioning for ML APIs

```typescript
// URL-based versioning
const ML_API_ROUTES = {
  v1: {
    basePath: '/api/ml/v1',
    supported: true,
    deprecated: false,
    sunset_date: null
  },
  v2: {
    basePath: '/api/ml/v2',
    supported: false, // Future version
    deprecated: false,
    sunset_date: null
  }
}

// Header-based versioning (alternative)
interface APIVersionHeaders {
  'X-ML-API-Version': '1.0' | '1.1' | '2.0'
  'X-Feature-Flags'?: string[] // Optional feature toggles
}
```

### 2. Feature Flags for ML Capabilities

```typescript
interface MLFeatureFlags {
  ensemble_predictions: boolean
  transformer_models: boolean
  options_features: boolean
  real_time_sentiment: boolean
  advanced_backtesting: boolean
  model_explanations: boolean
}

// Feature flag middleware
class MLFeatureFlagMiddleware {
  static async checkFeatureAccess(
    userId: string,
    feature: keyof MLFeatureFlags,
    request: NextRequest
  ): Promise<boolean> {
    const userFlags = await this.getUserFeatureFlags(userId)
    const globalFlags = await this.getGlobalFeatureFlags()

    return userFlags[feature] && globalFlags[feature]
  }
}
```

## Performance and Caching

### 1. API-Level Caching Strategy

```typescript
interface MLCacheStrategy {
  predictions: {
    ttl: 300, // 5 minutes
    keyPattern: 'ml:pred:{model_id}:{symbols_hash}:{horizon}',
    invalidation: 'time_based'
  },

  model_metadata: {
    ttl: 3600, // 1 hour
    keyPattern: 'ml:model:{model_id}:meta',
    invalidation: 'event_based'
  },

  features: {
    ttl: 900, // 15 minutes
    keyPattern: 'ml:feat:{symbols_hash}:{feature_types}',
    invalidation: 'time_based'
  },

  backtests: {
    ttl: 86400, // 24 hours
    keyPattern: 'ml:backtest:{experiment_id}',
    invalidation: 'manual'
  }
}
```

### 2. Response Compression and Optimization

```typescript
// app/api/ml/middleware.ts
export async function mlApiMiddleware(request: NextRequest) {
  const response = await processMLRequest(request)

  // Response optimization
  if (response.headers.get('content-type')?.includes('application/json')) {
    // Compress large responses
    if (response.headers.get('content-length') > '10000') {
      response.headers.set('content-encoding', 'gzip')
    }

    // Add performance headers
    response.headers.set('X-Prediction-Latency', `${getLatency()}ms`)
    response.headers.set('X-Cache-Status', getCacheStatus())
    response.headers.set('X-Model-Version', getModelVersion())
  }

  return response
}
```

## API Documentation and OpenAPI Specification

### 1. OpenAPI 3.0 Specification Excerpt

```yaml
openapi: 3.0.3
info:
  title: VFR ML Prediction API
  version: 1.0.0
  description: Machine Learning prediction endpoints for financial analysis

servers:
  - url: https://api.vfr.com/ml/v1
    description: Production ML API
  - url: https://staging-api.vfr.com/ml/v1
    description: Staging ML API

paths:
  /predict:
    post:
      summary: Generate ML predictions for stocks
      operationId: predictStocks
      tags:
        - Predictions
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MLPredictionRequest'
      responses:
        '200':
          description: Successful prediction
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MLPredictionResponse'
        '400':
          description: Invalid request
        '401':
          description: Unauthorized
        '429':
          description: Rate limit exceeded
        '500':
          description: Internal server error

components:
  schemas:
    MLPredictionRequest:
      type: object
      required:
        - symbols
      properties:
        symbols:
          type: array
          items:
            type: string
          minItems: 1
          maxItems: 100
          example: ["AAPL", "GOOGL", "MSFT"]
        models:
          type: array
          items:
            type: string
          example: ["momentum-lstm", "mean-reversion-xgb"]
        horizon:
          type: string
          enum: ["1h", "4h", "1d", "1w", "1m", "3m"]
          default: "1d"
        confidence_threshold:
          type: number
          minimum: 0
          maximum: 1
          default: 0.5
```

## Testing and Validation

### 1. API Testing Framework

```typescript
// __tests__/api/ml/predict.test.ts
describe('ML Prediction API', () => {
  describe('POST /api/ml/predict', () => {
    it('should return predictions within 100ms for single symbol', async () => {
      const startTime = performance.now()

      const response = await request(app)
        .post('/api/ml/predict')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          symbols: ['AAPL'],
          horizon: '1d'
        })

      const endTime = performance.now()
      const latency = endTime - startTime

      expect(response.status).toBe(200)
      expect(latency).toBeLessThan(100)
      expect(response.body.success).toBe(true)
      expect(response.body.data.predictions).toHaveLength(1)
    })

    it('should handle rate limiting correctly', async () => {
      // Exceed rate limit
      const promises = Array(200).fill(null).map(() =>
        request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({ symbols: ['AAPL'] })
      )

      const responses = await Promise.allSettled(promises)
      const rateLimited = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      )

      expect(rateLimited.length).toBeGreaterThan(0)
    })

    it('should fallback gracefully when ML service unavailable', async () => {
      // Mock ML service failure
      jest.spyOn(MLPredictionService.prototype, 'predictStocks')
        .mockRejectedValue(new Error('Service unavailable'))

      const response = await request(app)
        .post('/api/ml/predict')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          symbols: ['AAPL'],
          horizon: '1d'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.warnings).toContain('ML service unavailable, using classic analysis')
    })
  })
})
```

## Deployment and Monitoring

### 1. API Health Checks

```typescript
// app/api/ml/health/route.ts
export async function GET() {
  const healthChecks = await Promise.allSettled([
    checkModelServiceHealth(),
    checkFeatureServiceHealth(),
    checkCacheHealth(),
    checkDatabaseHealth()
  ])

  const overallHealth = healthChecks.every(check =>
    check.status === 'fulfilled' && check.value.healthy
  )

  return NextResponse.json({
    status: overallHealth ? 'healthy' : 'degraded',
    timestamp: Date.now(),
    services: {
      models: healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : { healthy: false },
      features: healthChecks[1].status === 'fulfilled' ? healthChecks[1].value : { healthy: false },
      cache: healthChecks[2].status === 'fulfilled' ? healthChecks[2].value : { healthy: false },
      database: healthChecks[3].status === 'fulfilled' ? healthChecks[3].value : { healthy: false }
    },
    version: process.env.ML_API_VERSION || '1.0.0'
  }, {
    status: overallHealth ? 200 : 503
  })
}
```

### 2. Metrics Collection

```typescript
// API metrics collection
class MLAPIMetrics {
  static collectRequestMetrics(
    endpoint: string,
    method: string,
    statusCode: number,
    latency: number,
    userId: string
  ): void {
    // Collect metrics for monitoring
    metrics.increment('ml_api_requests_total', {
      endpoint,
      method,
      status_code: statusCode.toString(),
      user_tier: getUserTier(userId)
    })

    metrics.histogram('ml_api_request_duration_ms', latency, {
      endpoint,
      method
    })

    if (statusCode >= 400) {
      metrics.increment('ml_api_errors_total', {
        endpoint,
        status_code: statusCode.toString()
      })
    }
  }
}
```

This comprehensive API architecture provides VFR with enterprise-grade ML prediction capabilities while maintaining the platform's proven security, performance, and reliability standards.