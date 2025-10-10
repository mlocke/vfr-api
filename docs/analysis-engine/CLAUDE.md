# VFR Analysis Engine - AI Assistant Context Guide

## Quick Start for AI Assistants

This document provides immediate context for AI assistants working on VFR's financial analysis engine. Read this first before making any changes.

## What is VFR?

**VFR (Value For Results)** is an intelligent financial research platform that democratizes institutional-grade stock analysis for individual investors. Think "Bloomberg Terminal meets AI" but accessible to everyone.

### Core Mission
Transform fragmented financial data from 12+ sources into actionable investment insights in under 3 seconds.

## System Architecture at a Glance

```
User Input (Stock Symbol)
    ↓
API Gateway (/api/stocks/analyze)
    ↓
Stock Selection Service (Orchestrator)
    ↓
┌─────────────────────────────────────────────────────┐
│  Multi-Source Data Integration (Parallel)           │
├─────────────────────────────────────────────────────┤
│ • Financial Modeling Prep (Primary)                 │
│ • Polygon.io (Technical + News)                     │
│ • EODHD (Options Data)                              │
│ • FRED/BLS/EIA (Macro)                              │
│ • Reddit/Yahoo Finance (Sentiment)                  │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  Analysis Engines (Parallel Processing)             │
├─────────────────────────────────────────────────────┤
│ 1. Technical Analysis (40% weight)                  │
│ 2. Fundamental Analysis (25% weight)                │
│ 3. Macroeconomic Analysis (20% weight)              │
│ 4. Sentiment Analysis (10% weight)                  │
│ 5. Alternative Data (5% weight)                     │
│ 6. ML Predictions (Optional Enhancement)            │
└─────────────────────────────────────────────────────┘
    ↓
Algorithm Engine (Composite Scoring)
    ↓
ML Enhancement Layer (Optional)
    ↓
Response (7-tier recommendation: STRONG_BUY → STRONG_SELL)
```

## Critical File Locations

### Services Architecture
```
app/services/
├── stock-selection/
│   ├── StockSelectionService.ts          # Core orchestration
│   ├── MLEnhancedStockSelectionService.ts # ML-enhanced version
│   └── types.ts                           # Type definitions
├── algorithms/
│   ├── AlgorithmEngine.ts                 # Multi-factor scoring
│   ├── FactorLibrary.ts                   # Factor calculations
│   └── types.ts                           # Algorithm types
├── financial-data/
│   ├── FinancialModelingPrepAPI.ts       # Primary data source
│   ├── PolygonAPI.ts                     # Technical + news
│   ├── EODHDAPI.ts                       # Options data
│   ├── FREDAPI.ts                        # Federal Reserve data
│   └── [50+ other services]
├── ml/
│   ├── prediction/
│   │   ├── RealTimePredictionEngine.ts   # <100ms inference
│   │   └── PredictionLogger.ts
│   └── sentiment-fusion/                 # Sentiment models
├── cache/
│   ├── RedisCache.ts                     # Primary caching
│   ├── OptionsCache.ts                   # Options-specific
│   └── HistoricalDataCache.ts            # Historical data
└── admin/
    └── MLFeatureToggleService.ts         # Feature flags
```

### API Endpoints
```
app/api/stocks/
├── analyze/route.ts                       # Main analysis endpoint
├── search/route.ts                        # Stock search
└── sentiment-fusion/route.ts              # Sentiment analysis

app/api/admin/
├── ml-feature-toggles/[featureId]/route.ts # ML toggles
└── [20+ other admin endpoints]
```

### Frontend Components
```
app/components/
├── StockRecommendationCard.tsx            # Results display
├── admin/
│   ├── AnalysisEngineTest.tsx            # Testing interface
│   ├── MLFeatureTogglePanel.tsx          # ML controls
│   └── AnalysisResults.tsx               # Results viewer
└── ScoreBreakdown.tsx                     # Score visualization
```

## Key Concepts

### 1. Multi-Factor Scoring System
The algorithm engine combines 5 core factors into a composite score (0-100):

| Factor | Weight | Key Metrics |
|--------|--------|-------------|
| **Technical** | 40% | RSI, MACD, Bollinger Bands, VWAP, Volume |
| **Fundamental** | 25% | P/E, P/B, ROE, Debt/Equity, Growth rates |
| **Macroeconomic** | 20% | Fed rates, VIX, Yield curve, Unemployment |
| **Sentiment** | 10% | News sentiment, Reddit mentions, Analyst ratings |
| **Alternative** | 5% | Options flow, Insider trading, 13F holdings |

**Score → Recommendation Mapping:**
- 85-100: STRONG_BUY
- 70-84: BUY
- 55-69: WEAK_BUY
- 45-54: HOLD
- 30-44: WEAK_SELL
- 15-29: SELL
- 0-14: STRONG_SELL

### 2. ML Enhancement Layer (Optional)
Three production ML models:

**Early Signal Detection (v1.0.0)** - LightGBM
- Purpose: Predict analyst rating upgrades 2 weeks ahead
- Accuracy: 97.6% test accuracy, 100% recall
- Status: ✅ Production-ready

**Price Prediction (v1.2.0)** - LightGBM
- Purpose: Predict price movements across multiple horizons
- Dataset: 73,200 training examples
- Status: 🔄 Model trained, integration pending

**Sentiment Fusion (v1.0.0)** - FinBERT + LightGBM
- Purpose: Advanced sentiment analysis from news
- Status: 🔄 Experimental, accuracy improvement needed

### 3. Caching Strategy
**Three-tier caching architecture:**

1. **Redis (L1)** - Hot cache, 5-15 minute TTL
   - Quote data: 5 minutes
   - Analysis results: 15 minutes
   - Features: 15 minutes

2. **PostgreSQL (L2)** - Warm cache, daily updates
   - Fundamental data: 24 hours
   - Historical prices: 24 hours
   - Macro indicators: 24 hours

3. **In-Memory (L3)** - Ultra-hot cache, session-level
   - Model predictions: 5 minutes
   - Frequently accessed symbols: Session

**Cache Hit Rate Target:** 82%+ (currently achieving)

### 4. Data Sources

**Premium APIs:**
- Financial Modeling Prep ($22/mo) - Primary fundamentals, quotes, financials
- Polygon.io ($29/mo) - Technical data, news, 5-year history
- EODHD - Options chains, Greeks, IV data

**Government APIs (Free):**
- FRED - Federal Reserve economic data
- BLS - Bureau of Labor Statistics (unemployment, CPI)
- EIA - Energy Information Administration

**Alternative Data (Free):**
- Reddit API - Social sentiment (r/wallstreetbets, r/stocks)
- Yahoo Finance - Real-time quotes, news sentiment

## Performance Requirements

### Latency Targets
| Operation | Target | Current |
|-----------|--------|---------|
| **Full stock analysis** | <3s | ~2.5s ✅ |
| **ML prediction (single)** | <100ms | ~80ms ✅ |
| **Cache retrieval** | <10ms | ~8ms ✅ |
| **Feature engineering** | <500ms | ~400ms ✅ |

### Reliability Targets
- **Uptime:** 99.9%
- **Cache hit rate:** 82%+
- **Error rate:** <1%
- **Data freshness:** <5 minutes

## Common Development Patterns

### 1. Adding a New Data Source

```typescript
// 1. Create service in app/services/financial-data/
export class NewDataService {
  constructor(private cache: RedisCache) {}

  async fetchData(symbol: string): Promise<DataType> {
    // Check cache first
    const cached = await this.cache.get(`new-data:${symbol}`);
    if (cached) return cached;

    // Fetch from API
    const data = await this.callAPI(symbol);

    // Cache result
    await this.cache.setex(`new-data:${symbol}`, 900, data);

    return data;
  }
}

// 2. Register in StockSelectionService
// 3. Add to algorithm scoring weights
// 4. Update tests
```

### 2. Adding ML Model

```typescript
// 1. Train model using scripts/ml/
// 2. Save to models/{model-name}/
// 3. Register in database:
//    INSERT INTO ml_models (name, version, type, status, config)
// 4. Create service in app/services/ml/
// 5. Integrate with RealTimePredictionEngine
```

### 3. Error Handling Pattern

```typescript
// VFR uses graceful degradation everywhere
try {
  const result = await primaryDataSource.fetch(symbol);
  return result;
} catch (error) {
  console.warn('Primary failed, trying fallback:', error);
  try {
    return await fallbackDataSource.fetch(symbol);
  } catch (fallbackError) {
    // Return cached or default values
    return await this.getCachedOrDefault(symbol);
  }
}
```

## Testing Guidelines

### Test Structure
```
__tests__/
├── unit/                    # Pure function tests
├── integration/             # Service integration tests
└── e2e/                     # Full flow tests
```

### Test Coverage Requirements
- Core services: 85%+
- ML services: 75%+
- API endpoints: 90%+

### Running Tests
```bash
npm test                     # All tests
npm run test:unit           # Unit only
npm run test:integration    # Integration only
npm run test:coverage       # With coverage report
```

## ML Training & Deployment

### Training Pipeline
```bash
# 1. Generate training data
npx tsx scripts/ml/generate-training-data.ts

# 2. Train model
python scripts/ml/train-{model-name}.py

# 3. Evaluate
python scripts/ml/evaluate-{model-name}.py

# 4. Register in database
npx tsx scripts/ml/register-model.ts

# 5. Deploy via admin dashboard
# Navigate to /admin → ML Feature Toggles
```

### Model Registry (PostgreSQL)
```sql
ml_models
  ├── name (e.g., 'price-prediction')
  ├── version (e.g., 'v1.2.0')
  ├── type (e.g., 'regression', 'classification')
  ├── status ('active', 'inactive', 'testing')
  ├── config (JSON model parameters)
  ├── metrics (JSON performance metrics)
  └── file_path (path to model file)
```

## Environment & Configuration

### Required Environment Variables
```bash
# Financial APIs
FINANCIAL_MODELING_PREP_API_KEY=
POLYGON_API_KEY=
EODHD_API_KEY=

# Database
DATABASE_URL=
REDIS_URL=

# ML
PYTHON_PATH=python3

# Feature Flags
ENABLE_ML_PREDICTIONS=true
ENABLE_OPTIONS_ANALYSIS=true
```

### Development Setup
```bash
# Install dependencies
npm install
pip3 install -r requirements.txt

# Start development server
npm run dev

# Start Redis (required)
redis-server

# PostgreSQL must be running
```

## Admin Dashboard

**URL:** `/admin`

**Key Features:**
- ML Feature Toggles (enable/disable models)
- Analysis Engine Testing
- Performance Monitoring
- Cache Statistics
- Error Logs
- Model Performance Metrics

## Documentation Structure

```
docs/
├── analysis-engine/
│   ├── CLAUDE.md (this file)               # AI context
│   ├── machine-learning/                   # ML architecture
│   │   ├── ml-architecture.md
│   │   ├── ml-implementation-roadmap.md
│   │   └── training/
│   ├── roadmap/                            # Future plans
│   ├── feedback-loop.md                    # Continuous improvement
│   └── technical/                          # Technical specs
├── core-context/
│   └── vision.md                           # Product vision
├── ml/                                     # ML-specific docs
│   ├── MODEL_REGISTRATION_GUIDE.md
│   ├── sentiment-fusion/
│   └── plans/
└── api/                                    # API documentation
```

## Common Issues & Solutions

### Issue: "Model not loading"
**Solution:**
1. Check `ml_models` table in PostgreSQL
2. Verify model file exists in `models/` directory
3. Check `status` field is 'active'
4. Restart server to reload model cache

### Issue: "Cache not working"
**Solution:**
1. Verify Redis is running: `redis-cli ping`
2. Check REDIS_URL environment variable
3. Check cache hit metrics in admin dashboard

### Issue: "Slow analysis (>3s)"
**Solution:**
1. Check which API calls are slow (add timing logs)
2. Verify cache hit rate (should be 82%+)
3. Consider disabling slow data sources temporarily
4. Check API rate limits

## Making Changes Safely

### Before You Code:
1. ✅ Read this CLAUDE.md file
2. ✅ Check `docs/core-context/vision.md` for product context
3. ✅ Review related tests in `__tests__/`
4. ✅ Check git status for related changes

### Development Workflow:
1. **Never** break backward compatibility
2. **Always** add tests for new features
3. **Always** use graceful degradation for new data sources
4. **Always** cache expensive API calls
5. **Never** expose API keys in code

### Code Review Checklist:
- [ ] Tests pass (`npm test`)
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] No API keys in code
- [ ] Error handling includes fallbacks
- [ ] Caching implemented for expensive operations
- [ ] Performance targets met (<3s for analysis)
- [ ] Documentation updated

## Key Philosophy: "Enhance, Don't Replace"

VFR follows a **modular enhancement** approach:

```typescript
// ✅ GOOD: Enhance existing functionality
async analyzeStock(symbol: string, options?: { includeML?: boolean }) {
  // Core analysis (always runs)
  const analysis = await this.runCoreAnalysis(symbol);

  // Optional ML enhancement
  if (options?.includeML) {
    try {
      analysis.mlPrediction = await this.mlService.predict(symbol);
    } catch (error) {
      // Graceful degradation - return core analysis
      console.warn('ML enhancement failed, using core analysis');
    }
  }

  return analysis;
}

// ❌ BAD: Replace core functionality
async analyzeStock(symbol: string) {
  // Only ML-based analysis - fails if ML breaks
  return await this.mlService.predict(symbol);
}
```

## Quick Reference Commands

```bash
# Development
npm run dev                              # Start dev server
npm run dev:clean                        # Clean start (clear cache)
npm run type-check                       # TypeScript validation

# Testing
npm test                                 # Run all tests
npm run test:coverage                    # Coverage report

# ML Operations
npx tsx scripts/ml/predict-generic.py    # Test prediction
npx tsx scripts/check-ml-models.ts       # Verify models

# Database
npx tsx scripts/ml/warm-ohlcv-cache.ts   # Warm up cache
```

## Questions to Ask When Working on VFR

1. **Does this enhance or replace?** (Always enhance)
2. **What happens if this fails?** (Always have fallback)
3. **Is this cached?** (Expensive operations must be cached)
4. **How does this affect performance?** (Target: <3s total)
5. **Are there tests?** (Yes, always)
6. **Is this documented?** (Update docs/)

## Getting Help

1. Check `/docs/analysis-engine/` for technical details
2. Review existing tests for patterns
3. Check git history for similar changes
4. Review admin dashboard for production behavior

---

**Last Updated:** 2025-10-10
**VFR Version:** 1.2.0
**Key Contact Points:** `docs/core-context/vision.md`, `app/services/stock-selection/`
