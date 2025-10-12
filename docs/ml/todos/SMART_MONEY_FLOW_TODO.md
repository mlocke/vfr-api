
# Smart Money Flow ML Model - Detailed TODO

**Created:** 2025-10-10
**Last Updated:** 2025-10-10
**Status:** Phase 1 Complete - Ready for Dataset Generation and Phase 2 Training
**Reference:** [SMART_MONEY_FLOW_PLAN.md](../plans/SMART_MONEY_FLOW_PLAN.md)

---

## TODO Overview

This document breaks down the Smart Money Flow implementation into actionable tasks organized by phase. Each task includes acceptance criteria, estimated effort, and dependencies.

**Total Estimated Effort:** 120-240 hours (4-6 weeks)

---

## Current Status (Updated 2025-10-10)

✅ **Phase 1: COMPLETE** (40-50 hours estimated, COMPLETED)
- All infrastructure, feature extraction, and dataset generation scripts implemented
- Cache system implemented (targeting 99%+ API reduction)
- All code files created and validated
- Ready to generate training dataset

⏳ **Next: Generate Dataset & Begin Phase 2**
- Run dataset generation script (estimated 2-3 hours with caching)
- Validate dataset quality and distribution
- Split into train/val/test sets
- Begin Phase 2: Model Training

---

## Phase 1: Data Collection & Feature Engineering (Week 1-2)

### 1.1 Setup Infrastructure

#### Task: Create Smart Money Flow Directory Structure ✅
- [x] Create `/app/services/ml/smart-money-flow/` directory
- [x] Create `/scripts/ml/smart-money-flow/` directory
- [x] Create `/models/smart-money-flow/v1.0.0/` directory (ready for model files)
- [x] Create `/data/training/smart-money-flow/` directory (ready for datasets)
- [x] Add `.gitkeep` files to preserve directory structure
- [x] Add `/models/smart-money-flow/` to `.gitignore` (except metadata)

**Estimated Effort:** 15 minutes

**Acceptance Criteria:**
- ✅ Directory structure matches existing models (early-signal, price-prediction, sentiment-fusion)
- ✅ Git tracks structure but not large model files

---

#### Task: Setup FMP API Service for Insider/Institutional Data ✅
- [x] Review `/docs/api/fmp-endpoints.md` for available endpoints
- [x] Verify FMP API key in `.env` file
- [x] Create `app/services/financial-data/SmartMoneyDataService.ts`
- [x] Implement methods:
  - `getInsiderTrading(symbol, startDate, endDate)` - `/v4/insider-trading`
  - `getInstitutionalOwnership(symbol, limit)` - `/v4/institutional-ownership/symbol-ownership`
  - `getCongressionalTrades(symbol, startDate, endDate)` - `/v4/senate-trading` + `/v4/house-disclosure`
  - `getETFHoldings(symbol)` - `/v3/etf-holder/{symbol}`
- [x] Add rate limiting (300 requests/minute)
- [x] Add error handling and retries
- [x] Add response validation (Zod schemas)

**Estimated Effort:** 4 hours

**Acceptance Criteria:**
- ✅ All 4 FMP endpoints callable via service methods
- ✅ Rate limiting prevents 429 errors
- ✅ Error handling returns graceful failures
- ✅ Response validation catches malformed data

**Files to Create:**
- `/app/services/financial-data/SmartMoneyDataService.ts`

**Files to Reference:**
- `/app/services/financial-data/FinancialDataService.ts` (pattern to follow)
- `/docs/api/fmp-endpoints.md` (API documentation)

---

### 1.2 Feature Extraction

#### Task: Implement Smart Money Flow Feature Extractor ✅
- [x] Create `app/services/ml/smart-money-flow/SmartMoneyFlowFeatureExtractor.ts`
- [x] Define `SmartMoneyFeatures` interface (27 features)
- [x] Implement insider trading features (8 features):
  - `insider_buy_ratio_30d`
  - `insider_buy_volume_30d`
  - `insider_sell_volume_30d`
  - `insider_net_flow_30d`
  - `insider_cluster_score`
  - `insider_ownership_change_90d`
  - `insider_avg_premium`
  - `c_suite_activity_ratio`
- [x] Implement institutional ownership features (7 features):
  - `inst_ownership_pct`
  - `inst_ownership_change_1q`
  - `inst_new_positions_count`
  - `inst_closed_positions_count`
  - `inst_avg_position_size_change`
  - `inst_concentration_top10`
  - `inst_momentum_score`
- [x] Implement congressional trading features (4 features):
  - `congress_buy_count_90d`
  - `congress_sell_count_90d`
  - `congress_net_sentiment`
  - `congress_recent_activity_7d`
- [x] Implement hedge fund features (5 features):
  - `hedgefund_top20_exposure`
  - `hedgefund_net_change_1q`
  - `hedgefund_new_entry_count`
  - `hedgefund_exit_count`
  - `hedgefund_conviction_score`
- [x] Implement ETF flow features (3 features):
  - `etf_ownership_pct`
  - `etf_flow_30d`
  - `etf_concentration`
- [x] Add missing data handling (median imputation)
- [x] Add temporal validation (no lookahead bias)
- [x] Add comprehensive logging

**Estimated Effort:** 16 hours

**Acceptance Criteria:**
- ✅ All 27 features extracted correctly
- ✅ Handles missing data gracefully (median imputation)
- ✅ No lookahead bias (uses only historical data up to sample date)
- ✅ Feature values in reasonable ranges (no extreme outliers)
- ✅ Extraction time <5 seconds per stock

**Files to Create:**
- `/app/services/ml/smart-money-flow/SmartMoneyFlowFeatureExtractor.ts`
- `/app/services/ml/smart-money-flow/types.ts`

**Files to Reference:**
- `/app/services/ml/early-signal/FeatureExtractor.ts` (pattern to follow)
- `/app/services/ml/sentiment-fusion/SentimentFusionFeatureExtractor.ts` (pattern to follow)

---

#### Task: Implement Historical Data Caching ✅
- [x] Review `/scripts/ml/CLAUDE.md` - CRITICAL: HISTORICAL DATA CACHING PRINCIPLE section
- [x] Create `app/services/cache/SmartMoneyDataCache.ts`
- [x] Implement cache key format: `{symbol}_{start_date}_{end_date}_{data_type}`
- [x] Implement cache methods:
  - `get(cacheKey)` - Check cache first
  - `set(cacheKey, data, ttl)` - Save to cache after API call
  - `clear(symbol)` - Clear cache for symbol
  - `getOrFetch(cacheKey, fetchFn)` - Cache-first pattern
- [x] Add cache statistics tracking (hits, misses, hit rate)
- [x] Use disk-based cache (JSON files)
- [x] Set TTL: 7 days for historical data

**Estimated Effort:** 4 hours

**Acceptance Criteria:**
- ✅ Cache checked BEFORE every API call
- ✅ Cache saved immediately after API call
- ✅ Cache hit rate >95% on second dataset generation run
- ✅ Cache statistics logged (hits, misses, hit rate)

**Files to Create:**
- `/app/services/cache/SmartMoneyDataCache.ts`

**Files to Reference:**
- `/docs/ml/SENTIMENT_CACHING_OPTIMIZATION.md` (99.86% API reduction strategy)
- `/app/services/cache/HistoricalDataCache.ts` (if exists)

---

### 1.3 Dataset Generation

#### Task: Implement Label Generator ✅
- [x] Create `scripts/ml/smart-money-flow/label-generator.ts`
- [x] Define labeling window (14 days after sample date)
- [x] Implement label calculation logic:
  - **Option A (Price-based):** ✅ IMPLEMENTED
    - Label = 1 if price increases >5% in 14 days
    - Label = 0 if price decreases <-2% or stays flat
  - **Option B (Composite):**
    - Label = 1 if price outperforms sector >3% AND (insider buy ratio >2:1 OR inst ownership up >2%)
    - Label = 0 if price underperforms sector >3% OR (insider sell ratio >2:1 OR inst ownership down >2%)
- [x] Add sector performance benchmarking (for Option B if needed)
- [x] Add label validation (30-70% bullish target)
- [x] Export label generation function for dataset script

**Estimated Effort:** 4 hours

**Acceptance Criteria:**
- ✅ Labels generated correctly for known test cases
- ✅ No lookahead bias (uses only future price data for labels)
- ✅ Label distribution 30-70% bullish (not too imbalanced)
- ✅ Validation catches extreme imbalance

**Files to Create:**
- `/scripts/ml/smart-money-flow/label-generator.ts`

**Files to Reference:**
- `/scripts/ml/label-generator.ts` (analyst upgrade labels - pattern to follow)

---

#### Task: Implement Dataset Generation Script ✅
- [x] Create `scripts/ml/smart-money-flow/generate-dataset.ts`
- [x] Define stock universe:
  - Start with **Top 500 S&P 500** stocks (high institutional coverage)
  - Exclude stocks with <5% institutional ownership
  - Exclude stocks with no insider activity in past year
- [x] Define temporal sampling:
  - Date range: 2022-01-01 to 2024-12-31 (3 years)
  - Sampling frequency: Monthly (15th of each month)
  - Total target: 500 stocks × 36 months = 18,000 examples
- [x] Implement dataset generation loop:
  1. For each stock in universe
  2. For each sample date (monthly 15th)
  3. Check cache for historical data (cache-first pattern)
  4. Extract 27 features using `SmartMoneyFlowFeatureExtractor`
  5. Generate label using `label-generator`
  6. Append to dataset CSV
  7. Save checkpoint every 50 stocks
- [x] Add progress tracking (% complete, ETA)
- [x] Add error handling and recovery (resume from checkpoint)
- [x] Add final validation (completeness, label balance)

**Estimated Effort:** 8 hours

**Acceptance Criteria:**
- ✅ Generates 18,000+ training examples
- ✅ Dataset completeness >85% (< 15% missing data)
- ✅ Label balance 30-70% bullish
- ✅ Checkpoint saves every 50 stocks
- ✅ Resumable from checkpoint on failure
- ✅ Cache hit rate >95% on second run

**Files to Create:**
- `/scripts/ml/smart-money-flow/generate-dataset.ts`

**Files to Reference:**
- `/scripts/ml/generate-training-data.ts` (early-signal dataset generation)
- `/scripts/ml/generate-price-dataset-yfinance.py` (price prediction dataset generation)

---

#### Task: Implement Dataset Validation Script ✅
- [x] Create `scripts/ml/smart-money-flow/validate-dataset.ts`
- [x] Implement validation checks:
  1. **Completeness**: >85% of features populated
  2. **Label Balance**: 30-70% bullish (not extreme imbalance)
  3. **Feature Distributions**: No extreme outliers (>99th percentile)
  4. **Temporal Integrity**: No lookahead bias (features before labels)
  5. **Missing Data**: <10% missing per feature
  6. **Symbol Coverage**: All 500 stocks represented
- [x] Generate validation report:
  - Overall pass/fail status
  - Per-check results (PASS, WARNING, FAIL)
  - Detailed statistics (mean, std, min, max per feature)
  - Recommended fixes for failures
- [x] Add severity levels (CRITICAL, WARNING, INFO)

**Estimated Effort:** 4 hours

**Acceptance Criteria:**
- ✅ All validation checks implemented
- ✅ Clear pass/fail status with severity
- ✅ Detailed report generated
- ✅ Catches common dataset issues (imbalance, missing data, outliers)

**Files to Create:**
- `/scripts/ml/smart-money-flow/validate-dataset.ts`

**Files to Reference:**
- `/scripts/ml/validate-training-data.ts` (early-signal validation)

---

#### Task: Implement Dataset Splitting Script ✅
- [x] Create `scripts/ml/smart-money-flow/split-dataset.py`
- [x] Implement stratified split:
  - **70% Training** (12,600 examples)
  - **15% Validation** (2,700 examples)
  - **15% Test** (2,700 examples)
- [x] Use `sklearn.model_selection.train_test_split` with stratification
- [x] Maintain label balance across all splits
- [x] Export to CSV files:
  - `data/training/smart-money-flow/train.csv`
  - `data/training/smart-money-flow/val.csv`
  - `data/training/smart-money-flow/test.csv`
- [x] Print split statistics (size, label balance per split)

**Estimated Effort:** 2 hours

**Acceptance Criteria:**
- ✅ Splits maintain label balance (stratification works)
- ✅ Train/val/test ratios correct (70/15/15)
- ✅ All splits saved to CSV correctly
- ✅ Statistics printed (size, label counts)

**Files to Create:**
- `/scripts/ml/smart-money-flow/split-dataset.py`

**Files to Reference:**
- `/scripts/ml/split-training-data.ts` (TypeScript version)
- `/scripts/ml/split-new-dataset.py` (Python version)

---

### Phase 1 Deliverables Checklist

- [x] `SmartMoneyDataService.ts` - FMP API integration ✅
- [x] `SmartMoneyFlowFeatureExtractor.ts` - 27 feature extraction ✅
- [x] `SmartMoneyDataCache.ts` - Historical data caching ✅
- [x] `types.ts` - TypeScript interfaces ✅
- [x] `label-generator.ts` - Label calculation logic ✅
- [x] `generate-dataset.ts` - Dataset generation script ✅
- [x] `validate-dataset.ts` - Dataset validation script ✅
- [x] `split-dataset.py` - Dataset splitting script ✅
- [ ] Dataset files (ready to generate):
  - `smart-money-flow-full.csv` (18,000 examples) - ⏳ Ready to run
  - `smart-money-flow/train.csv` (12,600 examples) - ⏳ Will be created after generation
  - `smart-money-flow/val.csv` (2,700 examples) - ⏳ Will be created after generation
  - `smart-money-flow/test.csv` (2,700 examples) - ⏳ Will be created after generation

**Phase 1 Total Estimated Effort:** 40-50 hours
**Phase 1 Status:** ✅ COMPLETE (All code implementation finished)

---

## Phase 2: Model Training (Week 2-3)

### 2.1 Model Training

#### Task: Implement Training Script
- [ ] Create `scripts/ml/smart-money-flow/train-model.py`
- [ ] Load train and validation datasets
- [ ] Implement feature normalization (z-score):
  ```python
  from sklearn.preprocessing import StandardScaler
  scaler = StandardScaler()
  X_train_normalized = scaler.fit_transform(X_train)
  X_val_normalized = scaler.transform(X_val)
  ```
- [ ] Configure LightGBM model:
  ```python
  from lightgbm import LGBMClassifier

  model = LGBMClassifier(
      objective='binary',
      metric='auc',
      boosting_type='gbdt',
      num_leaves=31,
      learning_rate=0.05,
      n_estimators=200,
      max_depth=6,
      min_child_samples=20,
      subsample=0.8,
      colsample_bytree=0.8,
      reg_alpha=0.1,
      reg_lambda=0.1,
      class_weight='balanced',
      random_state=42
  )
  ```
- [ ] Train with early stopping (20 rounds patience)
- [ ] Evaluate on validation set:
  - Accuracy
  - ROC AUC
  - Precision (bullish class)
  - Recall (bullish class)
  - F1 Score
  - Confusion matrix
- [ ] Extract feature importance (top 15 features)
- [ ] Save model artifacts:
  - `models/smart-money-flow/v1.0.0/model.txt` (LightGBM model)
  - `models/smart-money-flow/v1.0.0/normalizer.json` (scaler parameters)
  - `models/smart-money-flow/v1.0.0/metadata.json` (training metrics, feature importance)

**Estimated Effort:** 8 hours

**Acceptance Criteria:**
- ✅ Model trains without errors
- ✅ Validation accuracy >70%
- ✅ ROC AUC >0.75
- ✅ Feature importance makes logical sense (e.g., insider buying, inst ownership top features)
- ✅ All artifacts saved correctly

**Files to Create:**
- `/scripts/ml/smart-money-flow/train-model.py`

**Files to Reference:**
- `/scripts/ml/train-lightgbm.py` (early-signal training script)
- `/scripts/ml/train-price-prediction-model.py` (price prediction training script)

---

#### Task: Hyperparameter Tuning (Optional)
- [ ] Implement grid search or Optuna for hyperparameter optimization
- [ ] Search space:
  - `learning_rate`: [0.01, 0.05, 0.1]
  - `max_depth`: [4, 6, 8]
  - `num_leaves`: [31, 50, 75]
  - `n_estimators`: [100, 200, 300]
- [ ] Use 5-fold cross-validation
- [ ] Track best hyperparameters
- [ ] Retrain with best params

**Estimated Effort:** 4 hours (optional)

**Acceptance Criteria:**
- ✅ Grid search completes
- ✅ Best hyperparameters logged
- ✅ Model performance improves >2% over baseline

**Files to Create:**
- `/scripts/ml/smart-money-flow/tune-hyperparameters.py`

---

#### Task: Implement Test Set Evaluation
- [ ] Create `scripts/ml/smart-money-flow/evaluate-test-set.py`
- [ ] Load test dataset (2,700 examples)
- [ ] Load trained model and normalizer
- [ ] Normalize test features
- [ ] Generate predictions
- [ ] Calculate metrics:
  - Accuracy
  - ROC AUC
  - Precision
  - Recall
  - F1 Score
  - Confusion matrix
- [ ] Generate visualizations:
  - ROC curve
  - Precision-Recall curve
  - Confusion matrix heatmap
  - Feature importance bar chart
- [ ] Save evaluation report as PDF/HTML

**Estimated Effort:** 4 hours

**Acceptance Criteria:**
- ✅ Test accuracy within 2% of validation accuracy (no overfitting)
- ✅ ROC AUC >0.75
- ✅ Visualizations saved
- ✅ Comprehensive evaluation report generated

**Files to Create:**
- `/scripts/ml/smart-money-flow/evaluate-test-set.py`

**Files to Reference:**
- `/scripts/ml/evaluate-test-set.py` (early-signal evaluation)

---

### 2.2 Feature Analysis

#### Task: Feature Importance Analysis
- [ ] Create `scripts/ml/smart-money-flow/analyze-features.py`
- [ ] Extract feature importance from trained model
- [ ] Rank features by importance (top 15)
- [ ] Validate that top features make logical sense:
  - Expected: `insider_buy_ratio_30d`, `inst_ownership_change_1q`, `congress_net_sentiment`
  - Unexpected: `etf_concentration`, `hedgefund_exit_count` (should be lower)
- [ ] Generate feature importance plot
- [ ] Analyze feature correlations (detect multicollinearity)
- [ ] Recommend features to remove if redundant

**Estimated Effort:** 3 hours

**Acceptance Criteria:**
- ✅ Top 10 features make logical sense
- ✅ Feature importance plot generated
- ✅ Correlation matrix generated
- ✅ Recommendations for feature pruning (if needed)

**Files to Create:**
- `/scripts/ml/smart-money-flow/analyze-features.py`

---

### Phase 2 Deliverables Checklist

- [ ] `train-model.py` - Model training script
- [ ] `tune-hyperparameters.py` - Hyperparameter optimization (optional)
- [ ] `evaluate-test-set.py` - Test set evaluation
- [ ] `analyze-features.py` - Feature importance analysis
- [ ] Model artifacts:
  - `models/smart-money-flow/v1.0.0/model.txt`
  - `models/smart-money-flow/v1.0.0/normalizer.json`
  - `models/smart-money-flow/v1.0.0/metadata.json`
- [ ] Evaluation report (PDF/HTML)
- [ ] Feature importance visualizations

**Phase 2 Total Estimated Effort:** 15-20 hours

---

## Phase 3: Integration (Week 3-4)

### 3.1 Prediction Service

#### Task: Implement Smart Money Flow Prediction Service
- [ ] Create `app/services/ml/smart-money-flow/SmartMoneyFlowService.ts`
- [ ] Implement service methods:
  - `predict(symbol: string, date?: string)` - Main prediction method
  - `predictBatch(symbols: string[])` - Batch predictions
  - `extractFeatures(symbol: string, date: string)` - Feature extraction wrapper
- [ ] Load model and normalizer on service initialization
- [ ] Implement prediction pipeline:
  1. Extract 27 features using `SmartMoneyFlowFeatureExtractor`
  2. Normalize features using saved normalizer params
  3. Generate prediction using LightGBM model
  4. Calculate conviction score (0-100)
  5. Determine confidence level (HIGH/MEDIUM/LOW)
  6. Generate human-readable signals (insider activity, institutional flow, etc.)
- [ ] Add prediction caching (cache by symbol + date)
- [ ] Add error handling and logging
- [ ] Add performance monitoring (latency tracking)

**Estimated Effort:** 12 hours

**Acceptance Criteria:**
- ✅ Predictions generated correctly for known test cases
- ✅ Prediction latency <500ms (p95)
- ✅ Caching reduces repeated prediction time to <50ms
- ✅ Error handling returns graceful failures

**Files to Create:**
- `/app/services/ml/smart-money-flow/SmartMoneyFlowService.ts`

**Files to Reference:**
- `/app/services/ml/early-signal/EarlySignalService.ts` (similar architecture)
- `/app/services/ml/price-prediction/PricePredictionService.ts` (similar architecture)

---

#### Task: Implement Python Prediction Script (Alternative)
- [ ] Create `scripts/ml/smart-money-flow/predict.py`
- [ ] Implement persistent Python process (like early-signal)
- [ ] Accept JSON input via stdin (symbol, features)
- [ ] Load model and normalizer once on startup
- [ ] Generate predictions and return JSON via stdout
- [ ] Handle multiple predictions in loop

**Estimated Effort:** 4 hours (optional - if Python process preferred)

**Acceptance Criteria:**
- ✅ Python process stays alive (persistent)
- ✅ JSON input/output works correctly
- ✅ Predictions match TypeScript service

**Files to Create:**
- `/scripts/ml/smart-money-flow/predict.py`

**Files to Reference:**
- `/scripts/ml/predict-early-signal.py` (persistent Python process pattern)
- `/scripts/ml/sentiment-fusion/predict-sentiment-fusion.py` (similar pattern)

---

### 3.2 API Endpoint

#### Task: Create Smart Money Flow API Endpoint
- [ ] Create `app/api/ml/smart-money-flow/route.ts`
- [ ] Implement POST handler:
  ```typescript
  export async function POST(request: NextRequest) {
    // 1. Validate request (Zod schema)
    // 2. Call SmartMoneyFlowService.predict()
    // 3. Return prediction response
  }
  ```
- [ ] Define request schema (Zod):
  ```typescript
  const SmartMoneyFlowRequestSchema = z.object({
    symbol: z.string().min(1).max(10),
    features: z.array(z.number()).length(27).optional(),
    date: z.string().optional()
  })
  ```
- [ ] Define response format:
  ```typescript
  {
    success: true,
    data: {
      symbol: string,
      predicted_conviction: 'BULLISH' | 'BEARISH',
      conviction_score: number,
      confidence: 'HIGH' | 'MEDIUM' | 'LOW',
      features: { ... },
      signals: { ... },
      model: { version, accuracy },
      timestamp: number
    }
  }
  ```
- [ ] Add error handling (400, 500 errors)
- [ ] Add request validation
- [ ] Add response caching headers (2-5 min cache)

**Estimated Effort:** 4 hours

**Acceptance Criteria:**
- ✅ API endpoint returns correct response format
- ✅ Request validation catches invalid inputs
- ✅ Error handling returns helpful messages
- ✅ Caching headers set correctly

**Files to Create:**
- `/app/api/ml/smart-money-flow/route.ts`

**Files to Reference:**
- `/app/api/ml/early-signal/route.ts` (similar endpoint)

---

### 3.3 Feature Toggle Integration

#### Task: Add Smart Money Flow Feature Toggle
- [ ] Update `app/services/admin/MLFeatureToggleService.ts`:
  - Add `SMART_MONEY_FLOW` to feature registry:
    ```typescript
    SMART_MONEY_FLOW: {
      id: "smart_money_flow",
      name: "Smart Money Flow",
      description: "Institutional/insider trading conviction signals (14-day horizon)",
      defaultState: false  // Start disabled
    }
    ```
  - Add methods:
    - `isSmartMoneyFlowEnabled(): Promise<boolean>`
    - `setSmartMoneyFlowEnabled(enabled: boolean, userId?: string, reason?: string): Promise<void>`
- [ ] Update `app/components/admin/MLFeatureTogglePanel.tsx`:
  - Add new feature card in UI
  - Icon: 💼 (briefcase)
  - Toggle switch (enabled/disabled)
  - Display metadata (last modified, enabled by)

**Estimated Effort:** 2 hours

**Acceptance Criteria:**
- ✅ Feature appears in admin dashboard
- ✅ Toggle switch works (enable/disable)
- ✅ State persists to Redis
- ✅ Audit log tracks changes

**Files to Modify:**
- `/app/services/admin/MLFeatureToggleService.ts`
- `/app/components/admin/MLFeatureTogglePanel.tsx`

---

### 3.4 Stock Selection Service Integration

#### Task: Integrate Smart Money Flow into Stock Selection
- [ ] Update `app/services/stock-selection/StockSelectionService.ts`:
  - Add `include_smart_money?: boolean` to `AnalysisRequest` interface
  - Check feature toggle: `await MLFeatureToggleService.getInstance().isSmartMoneyFlowEnabled()`
  - If enabled and requested, call `SmartMoneyFlowService.predict(symbol)`
  - Add `smart_money_flow` to `EnhancedStockData` response
- [ ] Update `app/types/stock-selection.ts`:
  - Add `SmartMoneyFlowPrediction` interface:
    ```typescript
    interface SmartMoneyFlowPrediction {
      predicted_conviction: 'BULLISH' | 'BEARISH',
      conviction_score: number,
      confidence: 'HIGH' | 'MEDIUM' | 'LOW',
      features: { ... },
      signals: {
        insider_activity: 'bullish' | 'neutral' | 'bearish',
        institutional_flow: 'accumulation' | 'distribution' | 'neutral',
        congressional_sentiment: 'positive' | 'neutral' | 'negative',
        hedge_fund_positioning: 'long' | 'short' | 'neutral'
      },
      model: { version: string, accuracy: number }
    }
    ```
  - Add `smart_money_flow?: SmartMoneyFlowPrediction` to `EnhancedStockData`

**Estimated Effort:** 4 hours

**Acceptance Criteria:**
- ✅ Smart money predictions appear in stock analysis results
- ✅ Feature toggle correctly enables/disables predictions
- ✅ Predictions don't slow down analysis significantly (<500ms added)
- ✅ Response format matches interface definition

**Files to Modify:**
- `/app/services/stock-selection/StockSelectionService.ts`
- `/app/types/stock-selection.ts`

**Files to Reference:**
- `/app/services/stock-selection/CLAUDE.md` (integration patterns)

---

### 3.5 Frontend Display

#### Task: Add Smart Money Flow Section to Stock Intelligence UI
- [ ] Update `app/stock-intelligence/page.tsx` or `app/components/admin/AnalysisResults.tsx`:
  - Add "Smart Money Flow" section to analysis results
  - Display conviction gauge (bullish/bearish indicator)
  - Show conviction score (0-100 progress bar)
  - Display signal breakdown:
    - Insider Activity: 🟢 Bullish / 🟡 Neutral / 🔴 Bearish
    - Institutional Flow: Accumulation / Distribution / Neutral
    - Congressional Sentiment: Positive / Neutral / Negative
    - Hedge Fund Positioning: Long / Short / Neutral
  - Show confidence badge (HIGH/MEDIUM/LOW)
  - Display model version and accuracy
- [ ] Add styling consistent with existing ML sections
- [ ] Add tooltips explaining each signal

**Estimated Effort:** 6 hours

**Acceptance Criteria:**
- ✅ Smart money section displays correctly
- ✅ Visual styling matches existing UI patterns
- ✅ Tooltips provide helpful explanations
- ✅ Section only appears when feature is enabled

**Files to Modify:**
- `/app/stock-intelligence/page.tsx` or `/app/components/admin/AnalysisResults.tsx`

**Files to Reference:**
- Existing ML sections (early-signal, price-prediction, sentiment-fusion displays)

---

### Phase 3 Deliverables Checklist

- [ ] `SmartMoneyFlowService.ts` - Prediction service
- [ ] `predict.py` - Python prediction script (optional)
- [ ] `/api/ml/smart-money-flow/route.ts` - API endpoint
- [ ] Feature toggle integration:
  - `MLFeatureToggleService.ts` updated
  - `MLFeatureTogglePanel.tsx` updated
- [ ] Stock selection integration:
  - `StockSelectionService.ts` updated
  - `stock-selection.ts` types updated
- [ ] Frontend display:
  - Smart Money Flow section in UI

**Phase 3 Total Estimated Effort:** 28-32 hours

---

## Phase 4: Testing & Deployment (Week 4-5)

### 4.1 Unit Testing

#### Task: Feature Extraction Tests
- [ ] Create `app/services/ml/smart-money-flow/__tests__/SmartMoneyFlowFeatureExtractor.test.ts`
- [ ] Test cases:
  - ✅ Extracts all 27 features correctly
  - ✅ Handles missing insider data (median imputation)
  - ✅ Handles missing institutional data
  - ✅ Handles missing congressional data
  - ✅ No lookahead bias (uses only historical data)
  - ✅ Feature values in reasonable ranges
- [ ] Use mock data (avoid real API calls)

**Estimated Effort:** 4 hours

**Files to Create:**
- `/app/services/ml/smart-money-flow/__tests__/SmartMoneyFlowFeatureExtractor.test.ts`

---

#### Task: Prediction Service Tests
- [ ] Create `app/services/ml/smart-money-flow/__tests__/SmartMoneyFlowService.test.ts`
- [ ] Test cases:
  - ✅ Prediction returns correct format
  - ✅ Confidence levels calculated correctly
  - ✅ Caching works (second prediction <50ms)
  - ✅ Error handling works (invalid symbol)
  - ✅ Batch predictions work

**Estimated Effort:** 3 hours

**Files to Create:**
- `/app/services/ml/smart-money-flow/__tests__/SmartMoneyFlowService.test.ts`

---

#### Task: API Endpoint Tests
- [ ] Create `app/api/ml/smart-money-flow/__tests__/route.test.ts`
- [ ] Test cases:
  - ✅ Valid request returns 200 + correct format
  - ✅ Invalid symbol returns 400
  - ✅ Missing symbol returns 400
  - ✅ Server error returns 500
  - ✅ Caching headers set correctly

**Estimated Effort:** 2 hours

**Files to Create:**
- `/app/api/ml/smart-money-flow/__tests__/route.test.ts`

---

### 4.2 Integration Testing

#### Task: End-to-End Prediction Test
- [ ] Create `app/services/ml/smart-money-flow/__tests__/e2e.test.ts`
- [ ] Test full prediction pipeline:
  1. Call API endpoint with real symbol (e.g., AAPL)
  2. Verify feature extraction
  3. Verify prediction generation
  4. Verify response format
  5. Verify prediction makes logical sense

**Estimated Effort:** 2 hours

**Files to Create:**
- `/app/services/ml/smart-money-flow/__tests__/e2e.test.ts`

---

#### Task: Stock Selection Integration Test
- [ ] Create `app/services/stock-selection/__tests__/smart-money-integration.test.ts`
- [ ] Test cases:
  - ✅ Smart money predictions appear in stock analysis
  - ✅ Feature toggle correctly enables/disables predictions
  - ✅ Analysis flow still works if smart money fails

**Estimated Effort:** 2 hours

**Files to Create:**
- `/app/services/stock-selection/__tests__/smart-money-integration.test.ts`

---

### 4.3 Performance Testing

#### Task: Load Testing
- [ ] Test prediction throughput (predictions/second)
- [ ] Test latency under load (p50, p95, p99)
- [ ] Test cache effectiveness (hit rate)
- [ ] Test memory usage (feature extraction + prediction)

**Estimated Effort:** 2 hours

**Acceptance Criteria:**
- ✅ Throughput >50 predictions/sec
- ✅ Latency p95 <800ms
- ✅ Cache hit rate >80%
- ✅ Memory usage <500MB

---

### 4.4 Model Deployment

#### Task: Register Model in Registry
- [ ] Create `scripts/ml/smart-money-flow/register-model.ts`
- [ ] Register model in database:
  - Model ID: `smart_money_flow`
  - Version: `v1.0.0`
  - Algorithm: `LightGBM`
  - Features: 27
  - Accuracy: (from training)
  - Deployment date: Current timestamp
- [ ] Update model registry to include smart money flow

**Estimated Effort:** 2 hours

**Acceptance Criteria:**
- ✅ Model registered in database
- ✅ Model appears in `/api/ml/models` endpoint
- ✅ Model metadata correct

**Files to Create:**
- `/scripts/ml/smart-money-flow/register-model.ts`

**Files to Reference:**
- `/scripts/ml/register-early-signal-model.ts`
- `/docs/ml/MODEL_REGISTRATION_GUIDE.md`

---

#### Task: Production Deployment
- [ ] Ensure model files exist in production:
  - `models/smart-money-flow/v1.0.0/model.txt`
  - `models/smart-money-flow/v1.0.0/normalizer.json`
  - `models/smart-money-flow/v1.0.0/metadata.json`
- [ ] Enable feature toggle in admin dashboard (production)
- [ ] Verify API endpoint accessible in production
- [ ] Monitor logs for errors (first 24 hours)

**Estimated Effort:** 2 hours

**Acceptance Criteria:**
- ✅ Model deployed to production
- ✅ Feature toggle enabled
- ✅ No errors in production logs
- ✅ Predictions working correctly

---

### 4.5 Documentation

#### Task: Code Documentation
- [ ] Add JSDoc comments to all service methods
- [ ] Add inline comments explaining complex logic
- [ ] Add README to `/app/services/ml/smart-money-flow/`
- [ ] Add README to `/scripts/ml/smart-money-flow/`

**Estimated Effort:** 2 hours

**Acceptance Criteria:**
- ✅ All public methods documented
- ✅ Complex logic explained
- ✅ READMEs provide clear usage instructions

---

#### Task: User Documentation
- [ ] Create admin dashboard guide:
  - How to enable/disable smart money flow
  - How to interpret predictions
  - What each signal means
- [ ] Create frontend user guide:
  - What is smart money flow?
  - How to use the signals
  - What do conviction scores mean?

**Estimated Effort:** 2 hours

**Files to Create:**
- `/docs/user-guides/smart-money-flow-admin-guide.md`
- `/docs/user-guides/smart-money-flow-user-guide.md`

---

#### Task: Technical Documentation
- [ ] Create model architecture document:
  - Feature engineering details
  - Label generation logic
  - Model training process
  - Hyperparameter choices
- [ ] Create deployment guide:
  - How to retrain model
  - How to deploy new version
  - How to rollback if needed

**Estimated Effort:** 3 hours

**Files to Create:**
- `/docs/ml/smart-money-flow/ARCHITECTURE.md`
- `/docs/ml/smart-money-flow/DEPLOYMENT_GUIDE.md`

---

### Phase 4 Deliverables Checklist

- [ ] Unit tests:
  - Feature extractor tests
  - Prediction service tests
  - API endpoint tests
- [ ] Integration tests:
  - End-to-end prediction test
  - Stock selection integration test
- [ ] Performance tests:
  - Load testing results
- [ ] Model deployment:
  - Model registered in registry
  - Production deployment complete
- [ ] Documentation:
  - Code documentation (JSDoc)
  - User guides (admin + frontend)
  - Technical documentation (architecture + deployment)

**Phase 4 Total Estimated Effort:** 20-24 hours

---

## Summary of Deliverables

### Code Files
1. **Services** (10 files):
   - `SmartMoneyDataService.ts` - FMP API integration
   - `SmartMoneyFlowFeatureExtractor.ts` - Feature extraction
   - `SmartMoneyDataCache.ts` - Historical data caching
   - `SmartMoneyFlowService.ts` - Prediction service
   - `types.ts` - TypeScript interfaces

2. **Scripts** (8 files):
   - `label-generator.ts` - Label calculation
   - `generate-dataset.ts` - Dataset generation
   - `validate-dataset.ts` - Dataset validation
   - `split-dataset.py` - Dataset splitting
   - `train-model.py` - Model training
   - `evaluate-test-set.py` - Test evaluation
   - `analyze-features.py` - Feature analysis
   - `register-model.ts` - Model registration

3. **API** (1 file):
   - `/api/ml/smart-money-flow/route.ts` - API endpoint

4. **Tests** (5 files):
   - Feature extractor tests
   - Prediction service tests
   - API endpoint tests
   - E2E tests
   - Integration tests

### Data Files
- `smart-money-flow-full.csv` (18,000 examples)
- `smart-money-flow/train.csv` (12,600 examples)
- `smart-money-flow/val.csv` (2,700 examples)
- `smart-money-flow/test.csv` (2,700 examples)

### Model Files
- `models/smart-money-flow/v1.0.0/model.txt`
- `models/smart-money-flow/v1.0.0/normalizer.json`
- `models/smart-money-flow/v1.0.0/metadata.json`

### Documentation
- PLAN (this document)
- TODO (this document)
- Admin guide
- User guide
- Architecture document
- Deployment guide

---

## Total Estimated Effort Summary

| Phase | Estimated Effort |
|-------|------------------|
| **Phase 1: Data Collection** | 40-50 hours |
| **Phase 2: Model Training** | 15-20 hours |
| **Phase 3: Integration** | 28-32 hours |
| **Phase 4: Testing & Deployment** | 20-24 hours |
| **Total** | **103-126 hours** |

**Time Estimate:** 4-6 weeks (assuming 20-25 hours/week)

---

## Critical Path

1. ✅ Implement feature extractor (Week 1) - COMPLETE
2. ✅ Implement caching (Week 1) - COMPLETE
3. ⏳ Generate dataset (Week 1-2) - READY TO RUN
4. ⏳ Validate dataset (Week 2) - READY TO RUN
5. ⬜ Train model (Week 2)
6. ⬜ Build prediction service (Week 3)
7. ⬜ Create API endpoint (Week 3)
8. ⬜ Integrate into stock selection (Week 3-4)
9. ⬜ Test and deploy (Week 4-5)

---

## Risk Mitigation Checklist

- [x] **Low insider activity for stocks**: Focus on S&P 500 (high activity) ✅
- [x] **Missing congressional trades**: Handle as missing feature (median imputation) ✅
- [x] **FMP API rate limits**: Implement caching (99%+ reduction in API calls) ✅
- [ ] **Class imbalance**: Use `class_weight='balanced'` in LightGBM (Phase 2)
- [ ] **Overfitting**: Use validation set + early stopping + regularization (Phase 2)
- [ ] **Production errors**: Start with feature toggle disabled, gradual rollout (Phase 4)

---

## Next Steps

1. ✅ Review PLAN and TODO with stakeholders - COMPLETE
2. ✅ Approve architecture (LightGBM only, no FinBERT) - COMPLETE
3. ✅ Allocate resources (developer time, API budget) - COMPLETE
4. ✅ Begin Phase 1: Data Collection - COMPLETE
5. ✅ Implement all Phase 1 infrastructure and scripts - COMPLETE
6. ⏳ **NEXT: Run Dataset Generation**
   - Execute: `npm run generate-smart-money-dataset` or `ts-node scripts/ml/smart-money-flow/generate-dataset.ts`
   - Expected runtime: 2-3 hours (with caching)
   - Output: `data/training/smart-money-flow-full.csv`
7. ⏳ **Then: Validate and Split Dataset**
   - Run validation: `ts-node scripts/ml/smart-money-flow/validate-dataset.ts`
   - Run splitting: `python scripts/ml/smart-money-flow/split-dataset.py`
8. ⬜ **Begin Phase 2: Model Training**

---

**Created By:** Claude (AI Assistant)
**Last Updated:** 2025-10-10
**Status:** Phase 1 Complete - Ready for Dataset Generation
