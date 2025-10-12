# Smart Money Flow ML Model - Implementation Plan

**Created:** 2025-10-10
**Status:** Planning Phase
**Model Type:** Insider/Institutional Trading Signal Detection

---

## Executive Summary

The Smart Money Flow ML model analyzes insider trading, congressional trades, hedge fund holdings, and institutional ownership to generate "smart money conviction" signals. This model follows the proven architecture pattern of existing models (early-signal, price-prediction, sentiment-fusion) while introducing new feature categories focused on trading activity by informed market participants.

**Key Value Proposition:**
- Detect institutional accumulation/distribution before major price moves
- Track insider buying/selling patterns as leading indicators
- Monitor congressional trading activity (STOCK Act disclosures)
- Identify hedge fund positioning changes via 13F filings
- Generate conviction signals based on smart money alignment

---

## 1. Model Purpose & Value Proposition

### Problem Statement
Current models focus on technical indicators, news sentiment, and price forecasts but lack insight into what sophisticated investors are actually doing with their capital. Smart money (insiders, institutions, hedge funds, Congress members) has informational advantages and track records of profitable positioning.

### Solution
A dedicated ML model that analyzes FMP's comprehensive insider/institutional data to generate conviction signals indicating when smart money is bullish or bearish on a stock.

### Business Value
- **Early Warning System**: Detect institutional positioning changes 2-4 weeks before price impact
- **Risk Management**: Identify when smart money is exiting (warning signal)
- **Conviction Signals**: Quantify alignment across multiple smart money categories
- **Complement Existing Models**: Adds fundamental positioning layer to technical/sentiment models

### Use Cases
1. **Pre-earnings Intelligence**: Detect unusual insider buying before positive earnings
2. **Institutional Rotation**: Track when hedge funds are rotating into/out of sectors
3. **Political Intelligence**: Monitor congressional trading patterns (e.g., defense stocks before contracts)
4. **Risk Alerts**: Flag when all insiders are selling (potential red flag)

---

## 2. Data Sources & Feature Engineering

### FMP API Endpoints Available

All endpoints use **Starter Plan** ($22/month) with 300 requests/minute limit.

#### 2.1 Insider Trading (`/v4/insider-trading`)
**Description**: Form 4 filings showing insider buy/sell transactions

**Key Fields:**
- `transactionType`: P (Purchase), S (Sale), A (Award), etc.
- `securitiesTransacted`: Number of shares
- `price`: Transaction price
- `securitiesOwned`: Total ownership after transaction
- `typeOfOwner`: Director, Officer, 10% Owner

**Features to Extract (8):**
- `insider_buy_ratio_30d`: Buy transactions / total transactions (30 days)
- `insider_buy_volume_30d`: Total shares purchased (30 days)
- `insider_sell_volume_30d`: Total shares sold (30 days)
- `insider_net_flow_30d`: Buy volume - Sell volume
- `insider_cluster_score`: Clustering metric (multiple insiders buying within 7 days)
- `insider_ownership_change_90d`: Change in total insider ownership (90 days)
- `insider_avg_premium`: Average % premium paid above market price
- `c_suite_activity_ratio`: C-level transactions / all insider transactions

#### 2.2 Institutional Ownership (`/v4/institutional-ownership/symbol-ownership`)
**Description**: 13F filings showing institutional holdings

**Key Fields:**
- `investorName`: Institution name
- `shares`: Number of shares held
- `change`: Change in shares from previous quarter
- `changePercent`: % change in position
- `marketValue`: Dollar value of holding

**Features to Extract (7):**
- `inst_ownership_pct`: % of shares held by institutions
- `inst_ownership_change_1q`: Change in ownership (1 quarter)
- `inst_new_positions_count`: Number of new institutional buyers
- `inst_closed_positions_count`: Number of institutions that exited
- `inst_avg_position_size_change`: Average % change in position sizes
- `inst_concentration_top10`: % held by top 10 institutions
- `inst_momentum_score`: Weighted score based on recent changes

#### 2.3 Congressional Trading (`/v4/senate-trading` & `/v4/house-disclosure`)
**Description**: STOCK Act disclosures showing Congressional trades

**Key Fields:**
- `transactionType`: Purchase, Sale
- `amount`: Transaction amount range
- `transactionDate`: Date of trade
- `representative`: Member of Congress

**Features to Extract (4):**
- `congress_buy_count_90d`: Number of buy transactions (90 days)
- `congress_sell_count_90d`: Number of sell transactions (90 days)
- `congress_net_sentiment`: Buy count - Sell count
- `congress_recent_activity_7d`: Boolean (any activity in past 7 days)

#### 2.4 Hedge Fund Holdings (via 13F aggregation)
**Features to Extract (5):**
- `hedgefund_top20_exposure`: % ownership by top 20 hedge funds
- `hedgefund_net_change_1q`: Net change in hedge fund holdings (1 quarter)
- `hedgefund_new_entry_count`: Number of new hedge fund positions
- `hedgefund_exit_count`: Number of hedge funds that exited
- `hedgefund_conviction_score`: Weighted score (larger funds = higher weight)

#### 2.5 ETF Holdings (`/v3/etf-holder/{symbol}`)
**Features to Extract (3):**
- `etf_ownership_pct`: % held by ETFs
- `etf_flow_30d`: Net ETF buying/selling
- `etf_concentration`: % held by top 5 ETFs

### Feature Summary

**Total Features: 27**

| Category | Count | Purpose |
|----------|-------|---------|
| Insider Trading | 8 | Direct corporate insider buy/sell signals |
| Institutional Ownership | 7 | Mutual fund, pension fund positioning |
| Congressional Trading | 4 | Political insider intelligence |
| Hedge Fund Holdings | 5 | Smart money positioning |
| ETF Flows | 3 | Passive flow analysis |

### Feature Engineering Strategy

#### Temporal Windows
- **7 days**: Recent clustering detection
- **30 days**: Short-term momentum
- **90 days**: Medium-term trend
- **1 quarter**: Quarterly 13F filing cycle

#### Normalization
- Z-score normalization (mean=0, std=1)
- Per-feature scaling to handle different magnitudes
- Handle missing data (institutions that don't file 13F)

#### Composite Scores
- **Smart Money Alignment Score**: Weighted average across all categories
- **Conviction Strength**: Magnitude of positioning changes
- **Timing Signal**: Recency-weighted activity

---

## 3. Architecture Decision: LightGBM (No FinBERT)

### Rationale

**Why NOT FinBERT + LightGBM (sentiment-fusion approach)?**

The sentiment-fusion model uses FinBERT because it processes **unstructured text** (news articles) and needs natural language understanding. Smart Money Flow data is **structured numerical/categorical data** (transaction counts, share volumes, ownership percentages) that doesn't require NLP.

**Decision: Pure LightGBM Gradient Boosting**

✅ **Advantages:**
- **Simpler pipeline**: Single model, no text processing
- **Faster training**: LightGBM trains in minutes vs. hours for FinBERT fine-tuning
- **Lower compute**: No GPU required, runs on CPU efficiently
- **Easier debugging**: Interpretable tree-based model with feature importance
- **Proven pattern**: Matches early-signal model architecture (97.6% accuracy)
- **Better for tabular data**: LightGBM designed for structured features

❌ **No text processing needed:**
- Form 4 filings are structured (shares, prices, transaction types)
- 13F filings are tabular (holdings, changes, amounts)
- Congressional disclosures are categorical (buy/sell, amount ranges)

### Architecture Comparison

| Model | Input Type | Architecture | Use Case |
|-------|-----------|--------------|----------|
| **sentiment-fusion** | News text | FinBERT → embeddings → LightGBM | Unstructured text sentiment |
| **early-signal** | Structured features | LightGBM only | Technical/fundamental indicators |
| **price-prediction** | Structured features | LightGBM only | Price forecasting |
| **smart-money-flow** | Structured features | **LightGBM only** | Trading activity analysis |

### Model Configuration

```python
LGBMClassifier(
    objective='binary',           # Binary: bullish (1) vs. bearish (0)
    metric='auc',
    boosting_type='gbdt',
    num_leaves=31,
    learning_rate=0.05,
    n_estimators=200,
    max_depth=6,
    min_child_samples=20,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,                # L1 regularization
    reg_lambda=0.1,               # L2 regularization
    class_weight='balanced'       # Handle class imbalance
)
```

**Key Parameters:**
- `objective='binary'`: Bullish (smart money buying) vs. Bearish (smart money selling)
- `class_weight='balanced'`: Handle imbalanced labels (fewer bullish signals)
- `learning_rate=0.05`: Conservative learning for generalization
- `n_estimators=200`: Sufficient boosting rounds with early stopping

---

## 4. Label Definition

### Smart Money Conviction Label

**Binary Classification:**
- **1 (BULLISH)**: Strong smart money conviction (price likely to rise)
- **0 (BEARISH)**: Weak/negative smart money conviction (price likely to fall)

### Label Calculation Logic

**Labeling Window:** 14 days (2 weeks) after sample date

**Bullish Criteria (label = 1):**
1. **Price Performance**: Stock outperforms sector by >3% in 14 days, OR
2. **Strong Signals**:
   - Insider buying > selling (ratio >2:1) AND
   - Institutional ownership increased >2% AND
   - Congressional net sentiment positive (buy count > sell count)

**Bearish Criteria (label = 0):**
1. **Price Performance**: Stock underperforms sector by >3% in 14 days, OR
2. **Weak/Negative Signals**:
   - Insider selling > buying (ratio >2:1) OR
   - Institutional ownership decreased >2% OR
   - Congressional net sentiment negative (sell count > buy count)

### Label Distribution Target
- **40-60% bullish**: Balanced dataset
- **Class weighting**: Handle imbalance if needed
- **Stratified split**: Maintain balance in train/val/test sets

### Alternative Labeling Approach (Simpler)

**Price-Based Only:**
- **1 (BULLISH)**: Price increases >5% in 14 days
- **0 (BEARISH)**: Price decreases <-2% or stays flat

This is simpler but may miss cases where smart money is correct but price hasn't moved yet (informational lag). Recommend starting with price-based and iterating to composite criteria.

---

## 5. Integration Points

### 5.1 Admin Dashboard Toggle

**Location:** `/app/components/admin/MLFeatureTogglePanel.tsx`

**Add New Feature:**
```typescript
SMART_MONEY_FLOW: {
  id: "smart_money_flow",
  name: "Smart Money Flow",
  description: "Institutional/insider trading conviction signals (14-day horizon)",
  defaultState: false,  // Start disabled until production-ready
}
```

**UI Display:**
- Icon: 💼 (briefcase for institutional)
- Toggle switch (enabled/disabled)
- Metadata: Last modified, enabled by, version
- Status indicator (production/beta/disabled)

**Service Methods:**
```typescript
// In MLFeatureToggleService.ts
public async isSmartMoneyFlowEnabled(): Promise<boolean>
public async setSmartMoneyFlowEnabled(enabled: boolean, userId?: string, reason?: string): Promise<void>
```

### 5.2 Analysis Flow Integration

**StockSelectionService Enhancement:**

```typescript
// In app/services/stock-selection/StockSelectionService.ts

interface EnhancedStockData {
  // ... existing fields ...

  // Add Smart Money Flow prediction
  smart_money_flow?: {
    predicted_conviction: 'BULLISH' | 'BEARISH',
    conviction_score: number,        // 0-100
    confidence: 'HIGH' | 'MEDIUM' | 'LOW',
    features: {
      insider_buy_ratio_30d: number,
      inst_ownership_change_1q: number,
      congress_net_sentiment: number,
      // ... all 27 features
    },
    signals: {
      insider_activity: 'bullish' | 'neutral' | 'bearish',
      institutional_flow: 'accumulation' | 'distribution' | 'neutral',
      congressional_sentiment: 'positive' | 'neutral' | 'negative',
      hedge_fund_positioning: 'long' | 'short' | 'neutral'
    },
    model: {
      version: string,
      accuracy: number
    }
  }
}
```

**API Request Integration:**

```typescript
interface AnalysisRequest {
  // ... existing fields ...
  include_smart_money?: boolean,     // Enable Smart Money Flow predictions
}

// Check feature toggle
const smartMoneyEnabled = await MLFeatureToggleService.getInstance().isSmartMoneyFlowEnabled()

if (request.include_smart_money && smartMoneyEnabled) {
  const smartMoneyPrediction = await SmartMoneyFlowService.predict(symbol)
  stockData.smart_money_flow = smartMoneyPrediction
}
```

### 5.3 API Endpoints

**New Endpoint:** `POST /api/ml/smart-money-flow`

**Request Schema:**
```typescript
{
  symbol: string,              // Required (1-10 chars)
  features?: number[],         // Optional: Pre-extracted 27 features
  date?: string                // Optional: Date for historical prediction
}
```

**Response Format:**
```typescript
{
  success: true,
  data: {
    symbol: string,
    predicted_conviction: 'BULLISH' | 'BEARISH',
    conviction_score: number,     // 0-100
    confidence: 'HIGH' | 'MEDIUM' | 'LOW',
    features: { ... },            // All 27 features
    signals: {
      insider_activity: string,
      institutional_flow: string,
      congressional_sentiment: string,
      hedge_fund_positioning: string
    },
    model: {
      version: 'v1.0.0',
      algorithm: 'LightGBM',
      accuracy: number
    },
    timestamp: number
  }
}
```

### 5.4 Frontend Display

**Stock Intelligence Page:**
- Add "Smart Money Flow" section to analysis results
- Display conviction gauge (bullish/bearish)
- Show breakdown by category (insiders, institutions, congress, hedge funds)
- Highlight recent significant activity
- Timeline of smart money actions

**Admin Dashboard:**
- Feature toggle for enable/disable
- Performance metrics (accuracy, predictions made)
- Model version and deployment status
- Audit log of toggle changes

---

## 6. Dataset Building Approach

### 6.1 Training Dataset Generation

**Script:** `scripts/ml/generate-smart-money-dataset.ts`

**Stock Universe:**
- **Top 500 S&P 500 stocks**: Start with large-cap for data availability
- **Exclude**: Stocks with low institutional ownership (<5%), insufficient insider activity

**Temporal Sampling:**
- **Date Range**: 2022-01-01 to 2024-12-31 (3 years)
- **Sampling Frequency**: Monthly (15th of each month)
- **Total Examples**: 500 stocks × 36 months = 18,000 examples

**Data Collection Process:**

1. **For each stock × date:**
   - Fetch insider trades (90 days before sample date)
   - Fetch institutional ownership (2 most recent quarters)
   - Fetch congressional trades (90 days before sample date)
   - Fetch hedge fund holdings (most recent 13F)
   - Fetch ETF holdings

2. **Extract 27 features** using `SmartMoneyFlowFeatureExtractor`

3. **Generate label** using 14-day forward-looking window

4. **Save checkpoint** every 50 stocks to prevent data loss

**Caching Strategy (CRITICAL):**

Following the [HISTORICAL DATA CACHING PRINCIPLE](/Users/michaellocke/WebstormProjects/Home/public/vfr-api/scripts/ml/CLAUDE.md#️-critical-historical-data-caching-principle):

```typescript
// Cache key format: {symbol}_{start_date}_{end_date}_{data_type}
const cacheKey = `AAPL_2022-01-01_2024-12-31_insider_trades`

// Check cache FIRST
const cachedData = await cache.get(cacheKey)
if (cachedData) {
  return cachedData  // 99.8% faster than API call
}

// Only make API call on cache miss
const data = await fmpApi.getInsiderTrading(symbol, startDate, endDate)

// Save to cache immediately
await cache.set(cacheKey, data, { ttl: '7d' })
```

**Why Caching Matters:**
- Without: 18,000 samples × 5 API calls = 90,000 API calls (~75 hours)
- With: 500 stocks × 5 API calls = 2,500 API calls (~2 hours first run, 20 min cached)

### 6.2 Dataset Validation

**Script:** `scripts/ml/validate-smart-money-dataset.ts`

**Validation Checks:**
1. **Completeness**: >85% of features populated (some stocks may lack congressional trades)
2. **Label Balance**: 30-70% bullish (avoid extreme imbalance)
3. **Feature Distributions**: Reasonable ranges, no extreme outliers (>99th percentile)
4. **Temporal Integrity**: No lookahead bias (all features use only past data)
5. **Missing Data**: <10% missing per feature (handle with median imputation)

### 6.3 Dataset Splitting

**Script:** `scripts/ml/split-smart-money-dataset.py`

**Split Strategy:**
- **70% Training** (12,600 examples): Model learning
- **15% Validation** (2,700 examples): Hyperparameter tuning, early stopping
- **15% Test** (2,700 examples): Final performance evaluation

**Stratification:** Maintain label balance across splits

**Outputs:**
- `data/training/smart-money-train.csv`
- `data/training/smart-money-val.csv`
- `data/training/smart-money-test.csv`

---

## 7. Model Development Phases

### Phase 1: Data Collection (Week 1-2)

**Deliverables:**
1. Implement `SmartMoneyFlowFeatureExtractor` service
2. Create `generate-smart-money-dataset.ts` script
3. Implement caching layer for historical data
4. Generate initial dataset (500 stocks, 18,000 examples)
5. Validate dataset quality

**Success Criteria:**
- Dataset completeness >85%
- Label balance 30-70%
- Cache hit rate >95% on second run

### Phase 2: Model Training (Week 2-3)

**Deliverables:**
1. Implement `train-smart-money-model.py` script
2. Train LightGBM model with grid search for hyperparameters
3. Evaluate on validation set
4. Generate feature importance analysis
5. Save model, normalizer, and metadata

**Success Criteria:**
- Validation accuracy >70%
- ROC AUC >0.75
- Reasonable feature importance (top 10 features make sense)

### Phase 3: Integration (Week 3-4)

**Deliverables:**
1. Implement `SmartMoneyFlowService` (prediction service)
2. Create `/api/ml/smart-money-flow` endpoint
3. Add feature toggle to admin dashboard
4. Integrate into `StockSelectionService`
5. Update frontend display

**Success Criteria:**
- Prediction latency <500ms
- Feature toggle works correctly
- API endpoint returns correct format
- Frontend displays predictions

### Phase 4: Testing & Deployment (Week 4-5)

**Deliverables:**
1. Unit tests for feature extraction
2. Integration tests for prediction service
3. End-to-end tests for API endpoint
4. Performance testing (load, latency)
5. Production deployment

**Success Criteria:**
- All tests passing
- Model registered in registry
- Feature toggle enabled in production
- Documentation complete

---

## 8. Performance Expectations

### Model Performance Targets

| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| Accuracy | >70% | >75% |
| ROC AUC | >0.75 | >0.80 |
| Precision (Bullish) | >70% | >75% |
| Recall (Bullish) | >65% | >70% |
| F1 Score | >0.68 | >0.72 |

### Prediction Performance

| Metric | Target |
|--------|--------|
| Latency (p50) | <300ms |
| Latency (p95) | <800ms |
| Throughput | >50 predictions/sec |
| Cache Hit Rate | >80% |

### Data Quality Metrics

| Metric | Target |
|--------|--------|
| Feature Completeness | >85% |
| Label Balance | 30-70% |
| Missing Data | <10% per feature |
| Dataset Size | 18,000+ examples |

---

## 9. KISS Principles Applied

### Simplicity Wins

1. **No FinBERT**: Use LightGBM only (structured data doesn't need NLP)
2. **Binary Classification**: Bullish vs. Bearish (not multi-class)
3. **Proven Architecture**: Copy early-signal model pattern (97.6% accuracy)
4. **FMP API Only**: Single data source (no multi-source complexity)
5. **Monthly Sampling**: Not daily (reduces dataset size, still effective)

### Avoid Over-Engineering

❌ **Don't Do:**
- Custom neural networks (LightGBM works great)
- Real-time streaming from SEC EDGAR (batch FMP API sufficient)
- Complex ensemble models (single model first)
- Text mining Form 4 filings (use structured FMP fields)
- Multi-horizon predictions (14-day window only)

✅ **Do:**
- Copy existing model patterns
- Use proven libraries (LightGBM, pandas, scikit-learn)
- Start simple, iterate based on results
- Leverage existing infrastructure (caching, feature toggles, admin UI)

### Reuse Existing Patterns

| Component | Reuse From | Modification |
|-----------|-----------|--------------|
| Feature Extractor | `EarlySignalFeatureExtractor` | Add smart money features |
| Training Script | `train-lightgbm.py` | Adjust hyperparameters |
| Prediction Service | `EarlySignalService` | Copy architecture |
| Feature Toggle | `MLFeatureToggleService` | Add new feature ID |
| Admin UI | `MLFeatureTogglePanel` | Add new toggle |
| API Endpoint | `/api/ml/early-signal` | Create `/api/ml/smart-money-flow` |

---

## 10. Risk Mitigation

### Data Risks

| Risk | Mitigation |
|------|------------|
| Low insider activity for small caps | Focus on S&P 500 (high activity) |
| Delayed 13F filings (45 days) | Use most recent available data |
| Missing congressional trades | Handle as missing feature (median imputation) |
| FMP API rate limits (300/min) | Implement caching, request queuing |

### Model Risks

| Risk | Mitigation |
|------|------------|
| Class imbalance (fewer bullish signals) | Use `class_weight='balanced'` |
| Overfitting to historical data | Validation set, early stopping, L1/L2 regularization |
| Feature collinearity | Feature importance analysis, remove redundant features |
| Poor generalization | Large dataset (18,000 examples), diverse stocks |

### Integration Risks

| Risk | Mitigation |
|------|------------|
| Feature toggle doesn't work | Unit tests, admin UI testing |
| API endpoint errors | Error handling, validation, logging |
| Frontend display issues | Integration tests, manual QA |
| Production deployment failure | Staged rollout, feature flag disabled by default |

---

## 11. Success Metrics

### Model Metrics (Phase 2)
- ✅ Validation accuracy >70%
- ✅ ROC AUC >0.75
- ✅ Feature importance makes logical sense

### Integration Metrics (Phase 3)
- ✅ Prediction latency <500ms
- ✅ API endpoint returns correct format
- ✅ Feature toggle works in admin dashboard
- ✅ Frontend displays predictions

### Production Metrics (Phase 4)
- ✅ Model registered in registry
- ✅ All tests passing (unit, integration, e2e)
- ✅ Documentation complete
- ✅ Feature toggle enabled in production

### Business Metrics (Post-Launch)
- Track prediction accuracy over time
- Monitor user engagement with smart money signals
- Measure impact on stock selection quality
- Collect user feedback on feature usefulness

---

## 12. Timeline Estimate

| Phase | Duration | Effort |
|-------|----------|--------|
| **Phase 1: Data Collection** | 1-2 weeks | 40-80 hours |
| **Phase 2: Model Training** | 1 week | 20-40 hours |
| **Phase 3: Integration** | 1-2 weeks | 40-80 hours |
| **Phase 4: Testing & Deployment** | 1 week | 20-40 hours |
| **Total** | **4-6 weeks** | **120-240 hours** |

**Critical Path:**
1. Implement feature extractor (Week 1)
2. Generate dataset (Week 1-2)
3. Train model (Week 2)
4. Build prediction service (Week 3)
5. Integrate into analysis flow (Week 3-4)
6. Test and deploy (Week 4-5)

**Contingency:** Add 20% buffer for unexpected issues (1 week)

---

## 13. Documentation Requirements

### Code Documentation
- Feature extractor docstrings
- Training script usage guide
- Prediction service API docs
- Integration points documentation

### User Documentation
- Admin dashboard guide (how to toggle)
- Frontend display explanation
- Interpretation guide (what signals mean)

### Technical Documentation
- Model architecture overview
- Feature engineering details
- Label generation logic
- Performance benchmarks

### Operational Documentation
- Deployment guide
- Monitoring setup
- Troubleshooting guide
- Rollback procedures

---

## 14. Next Steps

1. **Review this plan** with stakeholders
2. **Approve architecture decision** (LightGBM only, no FinBERT)
3. **Prioritize phases** (all 4 phases or MVP first?)
4. **Assign resources** (developer time, API budget)
5. **Create detailed TODO** (see companion TODO document)

---

## Related Documentation

- `/scripts/ml/CLAUDE.md` - ML training pipeline overview
- `/app/services/ml/early-signal/CLAUDE.md` - Early Signal Service architecture (similar pattern)
- `/docs/api/fmp-endpoints.md` - FMP API endpoint documentation
- `/docs/ml/MODEL_REGISTRATION_GUIDE.md` - Model registry integration

---

**Author:** Claude (AI Assistant)
**Reviewed By:** [To be filled]
**Approved By:** [To be filled]
**Last Updated:** 2025-10-10
