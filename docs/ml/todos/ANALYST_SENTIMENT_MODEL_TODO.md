# Analyst Sentiment Model Implementation TODO

**Created:** October 5, 2025
**Model Type:** Analyst Sentiment Prediction (Upgrades/Downgrades)
**Prediction Horizon:** 2 weeks ahead
**Pattern:** Follow Early Signal Detection model architecture
**Integration:** Via EnsembleService for multi-model predictions

---

## Table of Contents

1. [Prerequisites & Validation](#prerequisites--validation)
2. [Phase 1: Data Collection & Feature Engineering](#phase-1-data-collection--feature-engineering)
3. [Phase 2: Model Training](#phase-2-model-training)
4. [Phase 3: Service Integration](#phase-3-service-integration)
5. [Phase 4: Ensemble Integration](#phase-4-ensemble-integration)
6. [Phase 5: Production Deployment](#phase-5-production-deployment)
6. [Reference Files](#reference-files)

---

## Prerequisites & Validation

### TASK 0.1: Verify FMP Analyst Ratings API Access
**Priority:** CRITICAL
**Estimated Time:** 30 minutes
**Dependencies:** None
**Location:** Test script or API console

**Objective:** Confirm FMP analyst ratings API works with current Starter plan subscription

**Steps:**
1. Create test script: `scripts/ml/analyst-sentiment/verify-fmp-analyst-api.ts`
2. Test `getAnalystRatings()` for 10 sample symbols (AAPL, TSLA, NVDA, MSFT, GOOGL, AMZN, META, NFLX, AMD, INTC)
3. Test `getPriceTargets()` for same symbols
4. Test `getRecentRatingChanges()` for same symbols
5. Verify data structure and completeness
6. Check rate limits (300/min for FMP Starter)
7. Validate historical availability (check date ranges)

**Acceptance Criteria:**
- ✅ All 3 FMP endpoints return valid data
- ✅ Analyst ratings include: buy/hold/sell/strong buy/strong sell counts
- ✅ Price targets include: consensus, high, low, median
- ✅ Rating changes include: date, old rating, new rating, analyst firm
- ✅ No rate limit errors during test
- ✅ Data available for at least 90 days historical

**Verification:**
```typescript
// Test output should show:
// - Total analysts count > 0
// - Rating distribution (buy/sell/hold percentages)
// - Price target consensus
// - Recent rating change dates and values
```

**Fallback Plan:**
If FMP Starter plan lacks analyst data:
- Document limitation
- Evaluate upgrade to FMP Professional plan ($99/mo)
- Consider alternative: Alpha Vantage Fundamental Data (Premium required)
- Defer model until API access secured

---

### TASK 0.2: Define Analyst Sentiment Features
**Priority:** HIGH
**Estimated Time:** 1 hour
**Dependencies:** Task 0.1 complete
**Location:** `docs/ml/analyst-sentiment/feature-specification.md`

**Objective:** Design feature set optimized for analyst sentiment prediction

**Feature Categories (Target: 20-30 features):**

**Analyst Rating Features (8-10 features):**
- `analyst_buy_ratio`: % of buy ratings vs total
- `analyst_sell_ratio`: % of sell/strong sell ratings
- `analyst_consensus_change_30d`: Change in consensus rating
- `analyst_coverage_change_30d`: Change in number of covering analysts
- `analyst_upgrade_momentum`: Recent upgrade trend (7d, 14d)
- `analyst_downgrade_momentum`: Recent downgrade trend
- `analyst_price_target_vs_current`: (Target - Current) / Current
- `analyst_target_revision_trend`: Price target revision direction
- `analyst_firm_tier_weight`: Weighted by analyst firm prestige/accuracy
- `analyst_coverage_expansion`: New analysts initiating coverage

**Price Action Features (5 features):**
- `price_momentum_7d`: 7-day price change
- `price_momentum_14d`: 14-day price change
- `volume_surge_7d`: Volume spike indicator
- `price_vs_target_gap`: How far current price from analyst target
- `volatility_14d`: Price volatility indicator

**Fundamental Signals (5 features):**
- `earnings_surprise_recent`: Latest earnings beat/miss
- `revenue_growth_trend`: Revenue acceleration
- `margin_expansion`: Operating margin trend
- `guidance_revision`: Forward guidance changes
- `peer_performance`: Performance vs sector peers

**Market Sentiment (5 features):**
- `institutional_flow`: Institutional buying/selling
- `short_interest_trend`: Short interest change
- `options_sentiment`: Put/call ratio changes
- `news_sentiment_delta`: News sentiment shift
- `social_sentiment_momentum`: Reddit/Twitter momentum

**Macro Context (3-5 features):**
- `sector_rotation_signal`: Sector momentum
- `market_regime`: Bull/bear/neutral classification
- `risk_appetite`: VIX or market volatility proxy

**Acceptance Criteria:**
- ✅ Feature list documented with clear definitions
- ✅ Data source identified for each feature
- ✅ Features extractable from existing VFR services
- ✅ No features requiring unavailable APIs
- ✅ Feature engineering logic specified

---

## Phase 1: Data Collection & Feature Engineering

### TASK 1.1: Create Analyst Sentiment Feature Extractor
**Priority:** HIGH
**Estimated Time:** 4 hours
**Dependencies:** Task 0.2 complete
**Location:** `app/services/ml/analyst-sentiment/FeatureExtractor.ts`
**Pattern:** Copy from `app/services/ml/early-signal/FeatureExtractor.ts`

**Objective:** Build feature extraction service for analyst sentiment prediction

**Implementation Steps:**
1. Copy Early Signal FeatureExtractor.ts as template
2. Define AnalystSentimentFeatureVector interface in `types.ts`
3. Implement analyst rating feature extraction methods:
   - `getAnalystRatingFeatures()`: Extract from FMP analyst ratings
   - `getPriceTargetFeatures()`: Extract from FMP price targets
   - `getRatingChangeFeatures()`: Extract from FMP rating changes
4. Implement price action feature extraction (reuse from Early Signal)
5. Implement fundamental feature extraction (reuse from Early Signal)
6. Implement market sentiment features (reuse from Early Signal)
7. Add macro context features (reuse from Early Signal)
8. Create `extractFeatures()` orchestrator method

**Key Methods:**
```typescript
interface AnalystSentimentFeatureVector {
  // Analyst features
  analyst_buy_ratio: number;
  analyst_sell_ratio: number;
  analyst_consensus_change_30d: number;
  analyst_coverage_change_30d: number;
  // ... (20-30 total features)
}

class AnalystSentimentFeatureExtractor {
  async extractFeatures(
    symbol: string,
    asOfDate?: Date
  ): Promise<AnalystSentimentFeatureVector>;

  private async getAnalystRatingFeatures(symbol: string): Promise<...>;
  private async getPriceTargetFeatures(symbol: string): Promise<...>;
  private async getRatingChangeFeatures(symbol: string, days: number): Promise<...>;
}
```

**Acceptance Criteria:**
- ✅ FeatureExtractor class created following Early Signal pattern
- ✅ All 20-30 features extractable from available APIs
- ✅ Features return numeric values (normalized -1 to 1 or 0 to 1)
- ✅ Graceful handling when data unavailable (return 0 or neutral value)
- ✅ TypeScript strict mode passes
- ✅ Unit tests cover feature extraction logic

**Verification:**
```bash
npx ts-node scripts/ml/analyst-sentiment/test-feature-extraction.ts --symbol AAPL
```

---

### TASK 1.2: Generate Analyst Sentiment Training Labels
**Priority:** HIGH
**Estimated Time:** 3 hours
**Dependencies:** Task 1.1 complete
**Location:** `scripts/ml/analyst-sentiment/generate-labels.ts`

**Objective:** Create labels for analyst sentiment prediction (upgrade/downgrade/neutral)

**Label Definition:**
- **Target Variable:** `analyst_sentiment_change_2w` (2 weeks forward-looking)
- **Label Classes:**
  - `1` (Upgrade): Net positive analyst rating changes in next 14 days
  - `0` (Neutral): No significant analyst rating changes
  - `-1` (Downgrade): Net negative analyst rating changes in next 14 days

**Labeling Logic:**
1. For each historical date T:
   - Get analyst ratings at date T
   - Get analyst ratings at date T+14 days
   - Calculate net rating change (upgrades - downgrades)
   - Apply threshold (e.g., >= 2 net upgrades = 1, <= -2 downgrades = -1)

**Implementation Steps:**
1. Create label generation script
2. Query FMP rating changes for each symbol/date
3. Calculate 14-day forward analyst sentiment change
4. Apply classification thresholds
5. Handle edge cases (IPOs, recent listings, low coverage)
6. Validate label distribution (check class balance)

**Acceptance Criteria:**
- ✅ Labels generated for training dataset
- ✅ Label distribution reasonably balanced (20-40% each class)
- ✅ Edge cases handled (no future data leakage)
- ✅ Labels validated against known analyst events
- ✅ CSV output with symbol, date, features, label

**Verification:**
```bash
npx ts-node scripts/ml/analyst-sentiment/generate-labels.ts --symbols AAPL,TSLA --date-range 2023-01-01:2024-12-31
# Output: Label distribution, sample records
```

---

### TASK 1.3: Generate Analyst Sentiment Training Dataset
**Priority:** HIGH
**Estimated Time:** 6 hours (4-8 hours for full dataset)
**Dependencies:** Task 1.1, Task 1.2 complete
**Location:** `scripts/ml/analyst-sentiment/generate-dataset.ts`
**Pattern:** Copy from `scripts/ml/generate-training-data.ts`

**Objective:** Create comprehensive training dataset with features and labels

**Dataset Specifications:**
- **Symbols:** S&P 500 or top 200 liquid stocks
- **Time Period:** 2 years (2023-01-01 to 2024-12-31)
- **Sampling:** Daily or every 3 days (balance data size vs coverage)
- **Minimum Coverage:** Symbol must have >=5 analyst ratings
- **Output:** CSV with features + label

**Implementation Steps:**
1. Copy Early Signal dataset generation script as template
2. Initialize AnalystSentimentFeatureExtractor
3. Load symbol universe (S&P 500 or custom list)
4. Iterate through date range:
   - Extract features at date T
   - Generate label for T+14 days
   - Filter symbols with insufficient analyst coverage
5. Implement checkpoint saving (every 50 symbols)
6. Add retry logic for API failures
7. Validate dataset quality (check for NaN, outliers)

**Rate Limit Management:**
- FMP: 300 req/min (sleep between batches)
- Implement exponential backoff on 429 errors
- Cache analyst data to reduce API calls

**Acceptance Criteria:**
- ✅ Dataset contains 5,000-20,000 examples
- ✅ No missing values in critical features
- ✅ Labels balanced (not >70% one class)
- ✅ Checkpoint files saved every 50 symbols
- ✅ Dataset quality report generated
- ✅ CSV formatted for Python training scripts

**Verification:**
```bash
npx ts-node scripts/ml/analyst-sentiment/generate-dataset.ts --full
# Output: data/training/analyst-sentiment-training.csv
```

**Output Format:**
```csv
symbol,date,analyst_buy_ratio,analyst_sell_ratio,...,label
AAPL,2023-01-15,0.65,0.10,...,1
TSLA,2023-01-15,0.45,0.25,...,0
```

---

### TASK 1.4: Split Training/Validation/Test Sets
**Priority:** MEDIUM
**Estimated Time:** 1 hour
**Dependencies:** Task 1.3 complete
**Location:** `scripts/ml/analyst-sentiment/split-dataset.py`
**Pattern:** Copy from `scripts/ml/split-new-dataset.py`

**Objective:** Split dataset into train/val/test sets with proper time-series handling

**Split Strategy:**
- **Train:** 70% (oldest data)
- **Validation:** 15% (middle data)
- **Test:** 15% (most recent data)
- **Method:** Time-based split (no random shuffle to prevent data leakage)

**Implementation:**
```python
import pandas as pd
from sklearn.model_selection import train_test_split

df = pd.read_csv('data/training/analyst-sentiment-training.csv')
df = df.sort_values('date')  # Sort by date

# Time-based split
train_size = int(len(df) * 0.70)
val_size = int(len(df) * 0.15)

train_df = df[:train_size]
val_df = df[train_size:train_size + val_size]
test_df = df[train_size + val_size:]

# Save splits
train_df.to_csv('data/training/analyst-sentiment-train.csv', index=False)
val_df.to_csv('data/training/analyst-sentiment-val.csv', index=False)
test_df.to_csv('data/training/analyst-sentiment-test.csv', index=False)
```

**Acceptance Criteria:**
- ✅ Three CSV files created (train/val/test)
- ✅ Time-series order preserved
- ✅ No data leakage between sets
- ✅ Split sizes approximately 70/15/15
- ✅ Label distribution maintained in all sets

**Verification:**
```bash
python3 scripts/ml/analyst-sentiment/split-dataset.py
# Output: Split sizes and label distributions
```

---

## Phase 2: Model Training

### TASK 2.1: Train LightGBM Analyst Sentiment Model
**Priority:** HIGH
**Estimated Time:** 3 hours
**Dependencies:** Task 1.4 complete
**Location:** `scripts/ml/analyst-sentiment/train-model.py`
**Pattern:** Copy from `scripts/ml/train-lightgbm.py`

**Objective:** Train gradient boosting classifier for analyst sentiment prediction

**Model Configuration:**
```python
import lightgbm as lgb

params = {
    'objective': 'multiclass',  # 3-class: upgrade/neutral/downgrade
    'num_class': 3,
    'metric': 'multi_logloss',
    'boosting_type': 'gbdt',
    'num_leaves': 31,
    'learning_rate': 0.05,
    'feature_fraction': 0.8,
    'bagging_fraction': 0.8,
    'bagging_freq': 5,
    'verbose': 0,
    'max_depth': 6,
    'min_data_in_leaf': 20,
    'lambda_l1': 0.1,
    'lambda_l2': 0.1
}

model = lgb.train(
    params,
    train_data,
    num_boost_round=1000,
    valid_sets=[train_data, val_data],
    early_stopping_rounds=50
)
```

**Implementation Steps:**
1. Copy LightGBM training script from Early Signal
2. Load train/val datasets
3. Configure LightGBM for multiclass classification
4. Train model with early stopping
5. Calculate feature importance
6. Generate classification metrics (accuracy, precision, recall, F1)
7. Save model artifacts:
   - `models/analyst-sentiment/v1.0.0/model.txt`
   - `models/analyst-sentiment/v1.0.0/normalizer.json`
   - `models/analyst-sentiment/v1.0.0/metadata.json`

**Acceptance Criteria:**
- ✅ Model trains without errors
- ✅ Validation accuracy > 60% (baseline)
- ✅ F1-score > 0.55 for each class
- ✅ No severe class imbalance in predictions
- ✅ Feature importance calculated and saved
- ✅ Model artifacts saved to disk

**Verification:**
```bash
python3 scripts/ml/analyst-sentiment/train-model.py
# Output: Training metrics, feature importance, saved model paths
```

**Performance Targets:**
- **Minimum Viable:** 60% accuracy, 0.55 F1-score
- **Production Quality:** 70% accuracy, 0.65 F1-score
- **Excellent:** 75%+ accuracy, 0.70+ F1-score

---

### TASK 2.2: Evaluate Model on Test Set
**Priority:** MEDIUM
**Estimated Time:** 1 hour
**Dependencies:** Task 2.1 complete
**Location:** `scripts/ml/analyst-sentiment/evaluate-test-set.py`
**Pattern:** Copy from `scripts/ml/evaluate-test-set.py`

**Objective:** Validate model performance on held-out test set

**Evaluation Metrics:**
- **Accuracy:** Overall correct predictions
- **Precision/Recall/F1:** Per-class performance
- **Confusion Matrix:** Error analysis
- **ROC-AUC:** Multi-class ROC curves
- **Calibration:** Probability calibration check

**Implementation:**
```python
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

# Load test data and model
test_df = pd.read_csv('data/training/analyst-sentiment-test.csv')
model = lgb.Booster(model_file='models/analyst-sentiment/v1.0.0/model.txt')

# Make predictions
y_true = test_df['label']
y_pred = model.predict(X_test)
y_pred_class = np.argmax(y_pred, axis=1) - 1  # Convert to -1/0/1

# Calculate metrics
print(classification_report(y_true, y_pred_class,
                            target_names=['Downgrade', 'Neutral', 'Upgrade']))
print(confusion_matrix(y_true, y_pred_class))
```

**Acceptance Criteria:**
- ✅ Test accuracy ≥ validation accuracy (no overfitting)
- ✅ Per-class F1-scores balanced (no class ignored)
- ✅ Confusion matrix shows reasonable error distribution
- ✅ ROC-AUC > 0.65 for multi-class
- ✅ Evaluation report saved to `models/analyst-sentiment/v1.0.0/evaluation.json`

**Verification:**
```bash
python3 scripts/ml/analyst-sentiment/evaluate-test-set.py
# Output: Test metrics, confusion matrix, evaluation report
```

---

### TASK 2.3: Register Model in Model Registry
**Priority:** MEDIUM
**Estimated Time:** 1 hour
**Dependencies:** Task 2.2 complete
**Location:** `scripts/ml/analyst-sentiment/register-model.ts`
**Pattern:** Copy from `scripts/ml/register-early-signal-model.ts`

**Objective:** Register trained model in production model registry

**Registration Details:**
```typescript
const modelMetadata: RegisterModelInput = {
  modelName: 'analyst-sentiment',
  modelVersion: 'v1.0.0',
  modelType: ModelType.LIGHTGBM,
  objective: ModelObjective.DIRECTION_CLASSIFICATION,
  targetVariable: 'analyst_sentiment_change_2w',
  predictionHorizon: '2_weeks',
  validationScore: 0.72,  // From training
  testScore: 0.70,  // From evaluation
  tierRequirement: TierRequirement.PREMIUM,
  status: ModelStatus.VALIDATED,
  artifactPath: 'models/analyst-sentiment/v1.0.0',
  hyperparameters: { /* LightGBM params */ },
  featureImportance: { /* Top features */ },
  trainingMetrics: { /* Full metrics */ }
};

await modelRegistry.registerModel(modelMetadata);
```

**Acceptance Criteria:**
- ✅ Model registered in `ml_models` table
- ✅ Model status set to `VALIDATED`
- ✅ All metadata fields populated
- ✅ Feature importance stored
- ✅ Model retrievable by name/version

**Verification:**
```bash
npx ts-node scripts/ml/analyst-sentiment/register-model.ts
# Output: Model ID, registration confirmation
```

---

## Phase 3: Service Integration

### TASK 3.1: Create Analyst Sentiment Service
**Priority:** HIGH
**Estimated Time:** 4 hours
**Dependencies:** Task 2.3 complete
**Location:** `app/services/ml/analyst-sentiment/AnalystSentimentService.ts`
**Pattern:** Copy from `app/services/ml/early-signal/EarlySignalService.ts`

**Objective:** Build production service for analyst sentiment predictions

**Service Architecture:**
```typescript
export class AnalystSentimentService {
  private static modelInstance: any = null;
  private static pythonProcess: any = null;
  private static modelVersion: string = "v1.0.0";
  private featureExtractor: AnalystSentimentFeatureExtractor;
  private normalizer: FeatureNormalizer;
  private cache: RedisCache;
  private config: AnalystSentimentConfig;

  async predictAnalystChange(
    symbol: string,
    sector: string
  ): Promise<AnalystSentimentPrediction | null> {
    // 1. Check Redis cache (5min TTL)
    // 2. Load model if not loaded
    // 3. Extract features
    // 4. Normalize features
    // 5. Make prediction via Python subprocess
    // 6. Filter low-confidence predictions
    // 7. Generate reasoning
    // 8. Cache result
    // 9. Return prediction
  }

  private async loadModel(): Promise<void> {
    // Spawn persistent Python process
    // Load LightGBM model from model.txt
    // Load normalizer from normalizer.json
  }

  private async predict(features: number[]): Promise<{
    class: number;
    probabilities: number[];
    confidence: number;
  }> {
    // Send features to Python process
    // Receive prediction + probabilities
  }

  private generateReasoning(
    features: AnalystSentimentFeatureVector,
    prediction: number,
    confidence: number
  ): string[] {
    // Generate human-readable explanation
  }
}
```

**Key Features:**
- Singleton pattern for model instance
- Persistent Python subprocess (reuse from Early Signal)
- Redis caching (5-minute TTL)
- Confidence filtering (skip 0.35-0.65 range)
- Human-readable reasoning generation
- Error handling with graceful degradation

**Acceptance Criteria:**
- ✅ Service follows Early Signal architecture exactly
- ✅ Model loaded once, reused for all predictions
- ✅ Python subprocess persists between predictions
- ✅ Cache hit rate >80% during testing
- ✅ Predictions return in <100ms (cached) or <500ms (uncached)
- ✅ Low-confidence predictions filtered out
- ✅ TypeScript strict mode passes

**Verification:**
```bash
npx ts-node scripts/ml/analyst-sentiment/test-service.ts --symbol AAPL
# Output: Prediction, confidence, reasoning, latency
```

---

### TASK 3.2: Create Python Inference Script
**Priority:** HIGH
**Estimated Time:** 2 hours
**Dependencies:** Task 3.1 in progress
**Location:** `scripts/ml/analyst-sentiment/predict-analyst-sentiment.py`
**Pattern:** Copy from `scripts/ml/predict-early-signal.py`

**Objective:** Create persistent Python inference server for low-latency predictions

**Implementation:**
```python
import sys
import json
import lightgbm as lgb
import numpy as np

# Load model and normalizer at startup
model = lgb.Booster(model_file='models/analyst-sentiment/v1.0.0/model.txt')
with open('models/analyst-sentiment/v1.0.0/normalizer.json', 'r') as f:
    normalizer_params = json.load(f)['params']

print("READY", file=sys.stderr, flush=True)

# Listen for requests on stdin
for line in sys.stdin:
    try:
        request = json.loads(line)
        features = request['features']

        # Normalize features
        normalized = normalize_features(features, normalizer_params)

        # Predict
        probabilities = model.predict([normalized])[0]
        predicted_class = int(np.argmax(probabilities)) - 1  # -1/0/1
        confidence = float(np.max(probabilities))

        response = {
            'success': True,
            'data': {
                'class': predicted_class,
                'probabilities': probabilities.tolist(),
                'confidence': confidence,
                'confidenceLevel': get_confidence_level(confidence)
            }
        }
        print(json.dumps(response), flush=True)

    except Exception as e:
        error_response = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_response), flush=True)
```

**Acceptance Criteria:**
- ✅ Script loads model at startup (not per prediction)
- ✅ Persistent process listens on stdin
- ✅ JSON request/response format
- ✅ Feature normalization applied
- ✅ Returns class + probabilities + confidence
- ✅ Error handling returns JSON errors
- ✅ <50ms inference latency

**Verification:**
```bash
echo '{"features": [0.5, -0.2, ...]}' | python3 scripts/ml/analyst-sentiment/predict-analyst-sentiment.py
# Output: {"success": true, "data": {"class": 1, "confidence": 0.85, ...}}
```

---

### TASK 3.3: Add Redis Caching Layer
**Priority:** MEDIUM
**Estimated Time:** 1.5 hours
**Dependencies:** Task 3.1 complete
**Location:** `app/services/ml/analyst-sentiment/AnalystSentimentService.ts` (within)

**Objective:** Implement caching to achieve <100ms response time target

**Cache Strategy:**
- **Key Format:** `analyst_sentiment:{symbol}:{date}:{modelVersion}`
- **TTL:** 300 seconds (5 minutes)
- **Invalidation:** Time-based only (no manual invalidation)
- **Cache Hit Target:** >80% during market hours

**Implementation:**
```typescript
private async getCachedPrediction(symbol: string): Promise<AnalystSentimentPrediction | null> {
  const cacheKey = this.getCacheKey(symbol);
  const cached = await this.cache.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  return null;
}

private async cachePrediction(symbol: string, prediction: AnalystSentimentPrediction): Promise<void> {
  const cacheKey = this.getCacheKey(symbol);
  await this.cache.set(cacheKey, JSON.stringify(prediction), this.config.cacheTTL);
}

private getCacheKey(symbol: string): string {
  const dateKey = new Date().toISOString().split("T")[0];
  return `analyst_sentiment:${symbol}:${dateKey}:${AnalystSentimentService.modelVersion}`;
}
```

**Acceptance Criteria:**
- ✅ Cache implemented using RedisCache
- ✅ Cache keys include symbol + date + model version
- ✅ TTL set to 5 minutes
- ✅ Cache hit logged for monitoring
- ✅ Cache miss triggers fresh prediction
- ✅ Cache errors handled gracefully (fall through to prediction)

**Verification:**
```bash
# First call (cache miss)
npx ts-node scripts/ml/analyst-sentiment/test-cache.ts --symbol AAPL
# Output: Latency ~400ms, fromCache: false

# Second call within 5min (cache hit)
npx ts-node scripts/ml/analyst-sentiment/test-cache.ts --symbol AAPL
# Output: Latency <50ms, fromCache: true
```

---

### TASK 3.4: Implement Error Handling & Fallbacks
**Priority:** MEDIUM
**Estimated Time:** 2 hours
**Dependencies:** Task 3.1 complete
**Location:** `app/services/ml/analyst-sentiment/AnalystSentimentService.ts`

**Objective:** Ensure graceful degradation when model fails

**Error Scenarios & Handling:**

1. **Feature Extraction Fails:**
   - Return neutral features (zeros)
   - Log warning
   - Continue with prediction

2. **Model Loading Fails:**
   - Retry once with 1s delay
   - If still fails, return null
   - Log error to monitoring

3. **Python Process Dies:**
   - Restart process automatically
   - Retry prediction once
   - If fails, return null

4. **Prediction Timeout (>1s):**
   - Kill Python process
   - Restart process
   - Return null for this request

5. **Low Confidence (<0.35 or 0.35-0.65):**
   - Return null (filtered out)
   - Log for monitoring

**Implementation:**
```typescript
async predictAnalystChange(symbol: string, sector: string): Promise<AnalystSentimentPrediction | null> {
  try {
    // ... prediction logic ...
  } catch (error) {
    this.logger.error(`Analyst sentiment prediction failed for ${symbol}:`, error);

    // Attempt recovery
    if (error.message.includes('Python process')) {
      await this.restartPythonProcess();
    }

    // Return null for graceful degradation
    return null;
  }
}

private async restartPythonProcess(): Promise<void> {
  if (AnalystSentimentService.pythonProcess) {
    AnalystSentimentService.pythonProcess.kill();
  }

  AnalystSentimentService.pythonProcess = null;
  await this.loadModel();
}
```

**Acceptance Criteria:**
- ✅ All error scenarios handled gracefully
- ✅ No uncaught exceptions
- ✅ Service returns null on failure (not throwing errors)
- ✅ Python process auto-restarts on failure
- ✅ Errors logged with context for debugging
- ✅ Monitoring metrics track error rates

**Verification:**
```bash
# Test error scenarios
npx ts-node scripts/ml/analyst-sentiment/test-error-handling.ts
# Output: All error scenarios handled, no crashes
```

---

## Phase 4: Ensemble Integration

### TASK 4.1: Register with Ensemble Service
**Priority:** HIGH
**Estimated Time:** 2 hours
**Dependencies:** Task 3.4 complete
**Location:** `app/services/ml/ensemble/EnsembleService.ts` (modify)

**Objective:** Integrate Analyst Sentiment model into multi-model ensemble

**Integration Steps:**

1. **Register Model in Model Registry:**
```typescript
// Already done in Task 2.3
const modelId = await modelRegistry.getModelByNameVersion(
  'analyst-sentiment',
  'v1.0.0'
);
```

2. **Add to RealTimePredictionEngine:**
```typescript
// In RealTimePredictionEngine.ts
private async loadModel(modelId: string): Promise<any> {
  const model = await this.modelRegistry.getModel(modelId);

  if (model.data.modelName === 'analyst-sentiment') {
    // Load AnalystSentimentService
    return AnalystSentimentService.getInstance();
  }
  // ... other models ...
}
```

3. **Configure Ensemble Weights:**
```typescript
// In EnsembleService.ts config
const ensembleWeights = {
  'early-signal': 0.35,
  'analyst-sentiment': 0.30,  // NEW
  'price-prediction': 0.25,
  'other-model': 0.10
};
```

**Acceptance Criteria:**
- ✅ Analyst Sentiment model registered in production registry
- ✅ Model loadable via RealTimePredictionEngine
- ✅ Ensemble weights configured
- ✅ Model predictions included in ensemble output
- ✅ TypeScript strict mode passes

**Verification:**
```bash
npx ts-node scripts/ml/ensemble/test-ensemble.ts --symbol AAPL
# Output: Ensemble prediction with analyst sentiment contribution
```

---

### TASK 4.2: Configure Dynamic Weighting Strategy
**Priority:** MEDIUM
**Estimated Time:** 1.5 hours
**Dependencies:** Task 4.1 complete
**Location:** `app/services/ml/ensemble/WeightCalculator.ts` (modify)

**Objective:** Enable dynamic weight adjustment based on model performance

**Weighting Strategy:**
- **Initial Weights:** analyst-sentiment = 0.30
- **Adjustment Factors:**
  - Historical accuracy (higher accuracy = higher weight)
  - Prediction confidence (high confidence predictions weighted more)
  - Recency of training data (newer models weighted slightly higher)

**Implementation:**
```typescript
// In WeightCalculator.ts
async calculateWeights(request: WeightCalculationRequest): Promise<MLServiceResponse<WeightCalculationResult>> {
  const weights = new Map<string, ModelWeight>();

  for (const modelId of request.modelIds) {
    const performance = await this.performanceTracker.getModelPerformance(modelId, 30);
    const confidence = request.confidenceScores?.get(modelId) || 0.5;

    // Calculate weight based on accuracy + confidence
    const baseWeight = performance.data.accuracy;
    const confidenceBoost = (confidence - 0.5) * 0.2; // Max 10% boost
    const finalWeight = baseWeight + confidenceBoost;

    weights.set(modelId, {
      weight: finalWeight,
      confidence: confidence,
      source: 'hybrid'
    });
  }

  // Normalize weights to sum to 1.0
  return this.normalizeWeights(weights);
}
```

**Acceptance Criteria:**
- ✅ Analyst Sentiment model included in weight calculation
- ✅ Weights adjust based on accuracy metrics
- ✅ Confidence scores influence weighting
- ✅ Weights sum to 1.0
- ✅ Weight calculation <10ms

**Verification:**
```bash
npx ts-node scripts/ml/ensemble/test-weighting.ts
# Output: Weight distribution, adjustment factors
```

---

### TASK 4.3: Setup A/B Testing Framework
**Priority:** LOW
**Estimated Time:** 3 hours
**Dependencies:** Task 4.2 complete
**Location:** `app/services/ml/ensemble/ABTestingService.ts` (create)

**Objective:** Enable A/B testing between analyst sentiment v1.0.0 and future versions

**A/B Test Configuration:**
```typescript
interface ABTestConfig {
  championModelId: string;  // analyst-sentiment v1.0.0
  challengerModelId: string;  // analyst-sentiment v1.1.0
  trafficSplit: number;  // 0.0 to 1.0 (e.g., 0.1 = 10% to challenger)
  startDate: Date;
  endDate: Date;
  metrics: string[];  // ['accuracy', 'precision', 'latency']
}
```

**Implementation:**
1. Create ABTestingService class
2. Implement traffic splitting logic (hash-based or random)
3. Track predictions from both models
4. Compare performance metrics
5. Generate A/B test report

**Acceptance Criteria:**
- ✅ A/B test configurable via admin API
- ✅ Traffic split implemented (e.g., 90/10)
- ✅ Both models tracked independently
- ✅ Metrics collected for comparison
- ✅ A/B test report generated

**Verification:**
```bash
# Start A/B test
curl -X POST /api/admin/ab-tests -d '{"champion": "analyst-sentiment-v1.0.0", "challenger": "analyst-sentiment-v1.1.0", "split": 0.1}'

# Get A/B test results
curl /api/admin/ab-tests/latest
# Output: Metrics comparison, winner recommendation
```

---

## Phase 5: Production Deployment

### TASK 5.1: Performance Validation
**Priority:** HIGH
**Estimated Time:** 2 hours
**Dependencies:** Task 4.2 complete
**Location:** `scripts/ml/analyst-sentiment/validate-performance.ts`

**Objective:** Validate production performance meets requirements

**Performance Requirements:**
- **Latency:**
  - Cached predictions: <100ms (p95)
  - Uncached predictions: <500ms (p95)
- **Accuracy:**
  - Test set accuracy: >=60%
  - Production accuracy (1 week): >=55%
- **Availability:**
  - Uptime: >=99.5%
  - Error rate: <1%

**Validation Tests:**
1. **Latency Test:**
   - Run 1000 predictions
   - Measure p50, p95, p99 latency
   - Verify <100ms cached, <500ms uncached

2. **Accuracy Test:**
   - Compare predictions to actual analyst changes (7-day lag)
   - Calculate rolling accuracy
   - Alert if accuracy <55%

3. **Load Test:**
   - Simulate 100 concurrent requests
   - Verify no degradation
   - Check Python process stability

4. **Error Rate Test:**
   - Inject failure scenarios
   - Verify graceful degradation
   - Check error handling

**Implementation:**
```bash
npx ts-node scripts/ml/analyst-sentiment/validate-performance.ts --test-all
# Output: Latency metrics, accuracy report, load test results
```

**Acceptance Criteria:**
- ✅ Latency requirements met (p95 <100ms cached)
- ✅ Accuracy >= 60% on test set
- ✅ Load test passes (100 concurrent requests)
- ✅ Error rate <1%
- ✅ Performance report generated

---

### TASK 5.2: Setup Monitoring & Alerts
**Priority:** HIGH
**Estimated Time:** 3 hours
**Dependencies:** Task 5.1 complete
**Location:** `app/services/ml/monitoring/AnalystSentimentMonitor.ts`

**Objective:** Implement production monitoring and alerting

**Metrics to Monitor:**
1. **Prediction Metrics:**
   - Prediction count (per hour/day)
   - Prediction latency (p50/p95/p99)
   - Cache hit rate
   - Confidence distribution

2. **Model Performance:**
   - Rolling accuracy (daily)
   - Precision/recall per class
   - Feature drift detection
   - Prediction drift (distribution changes)

3. **System Health:**
   - Python process uptime
   - Model load errors
   - Feature extraction errors
   - Cache errors

**Alert Thresholds:**
- Latency p95 >500ms (warn), >1000ms (critical)
- Accuracy <55% for 24h (warn), <50% (critical)
- Error rate >1% (warn), >5% (critical)
- Cache hit rate <70% (warn)
- Python process restart >3 times/hour (warn)

**Implementation:**
```typescript
class AnalystSentimentMonitor {
  async trackPrediction(result: AnalystSentimentPrediction, latency: number): Promise<void> {
    // Track metrics
    await this.metricsService.recordPrediction({
      model: 'analyst-sentiment',
      latency,
      confidence: result.confidence,
      cacheHit: result.fromCache
    });

    // Check alert thresholds
    if (latency > 1000) {
      await this.alertService.sendAlert({
        severity: 'critical',
        message: `Analyst sentiment prediction latency >1s: ${latency}ms`
      });
    }
  }
}
```

**Acceptance Criteria:**
- ✅ All metrics tracked in monitoring system
- ✅ Alerts configured with proper thresholds
- ✅ Dashboard created for visualization
- ✅ Alert notifications working (email/Slack)
- ✅ Historical metrics retained for 30 days

**Verification:**
```bash
# View metrics
curl /api/admin/metrics/analyst-sentiment
# Output: Prediction count, latency, accuracy, cache hit rate

# Test alerts
curl -X POST /api/admin/metrics/test-alert
# Output: Alert sent successfully
```

---

### TASK 5.3: Create Production Documentation
**Priority:** MEDIUM
**Estimated Time:** 2 hours
**Dependencies:** Task 5.2 complete
**Location:** `docs/ml/analyst-sentiment/PRODUCTION_GUIDE.md`

**Objective:** Document production deployment and operations

**Documentation Sections:**
1. **Model Overview:**
   - Purpose and prediction target
   - Training data and features
   - Performance metrics
   - Version history

2. **Service Architecture:**
   - Component diagram
   - Data flow
   - API endpoints
   - Integration points

3. **Operations Guide:**
   - Deployment procedure
   - Model update process
   - Troubleshooting guide
   - Performance tuning

4. **Monitoring & Alerts:**
   - Key metrics
   - Alert thresholds
   - Incident response

5. **API Reference:**
   - Request/response formats
   - Error codes
   - Rate limits
   - Examples

**Acceptance Criteria:**
- ✅ Complete production documentation created
- ✅ Architecture diagrams included
- ✅ API examples provided
- ✅ Troubleshooting guide comprehensive
- ✅ Ops team can deploy using docs alone

---

### TASK 5.4: Deploy to Production
**Priority:** HIGH
**Estimated Time:** 1 hour
**Dependencies:** Task 5.3 complete
**Location:** Production environment

**Objective:** Deploy Analyst Sentiment model to production

**Deployment Checklist:**
1. ✅ Model artifacts uploaded to production:
   - `models/analyst-sentiment/v1.0.0/model.txt`
   - `models/analyst-sentiment/v1.0.0/normalizer.json`
   - `models/analyst-sentiment/v1.0.0/metadata.json`

2. ✅ Python inference script deployed:
   - `scripts/ml/analyst-sentiment/predict-analyst-sentiment.py`

3. ✅ Service code deployed:
   - `app/services/ml/analyst-sentiment/AnalystSentimentService.ts`
   - `app/services/ml/analyst-sentiment/FeatureExtractor.ts`

4. ✅ Model registered in production database:
   - Entry in `ml_models` table
   - Status: `DEPLOYED`

5. ✅ Ensemble integration activated:
   - Model included in ensemble predictions
   - Weights configured

6. ✅ Monitoring enabled:
   - Metrics collection active
   - Alerts configured

7. ✅ Health checks passing:
   - Model loading successfully
   - Predictions working
   - Cache working

**Deployment Steps:**
```bash
# 1. Deploy model artifacts
scp models/analyst-sentiment/v1.0.0/* production:/var/models/analyst-sentiment/v1.0.0/

# 2. Deploy code
git push production main

# 3. Run migrations
npm run migrate:prod

# 4. Register model
npx ts-node scripts/ml/analyst-sentiment/deploy-production.ts

# 5. Verify deployment
curl https://api.vfr.com/health/analyst-sentiment
# Output: {"status": "healthy", "model": "v1.0.0"}

# 6. Test prediction
curl -X POST https://api.vfr.com/api/ml/analyst-sentiment/predict \
  -d '{"symbol": "AAPL"}'
# Output: Prediction with confidence and reasoning
```

**Acceptance Criteria:**
- ✅ All artifacts deployed successfully
- ✅ Model registered and activated
- ✅ Health checks passing
- ✅ Test predictions working
- ✅ Monitoring showing data
- ✅ No errors in logs

**Rollback Plan:**
If deployment fails:
1. Set model status to `DEPRECATED` in database
2. Remove from ensemble model list
3. Revert code deployment
4. Investigate errors and fix
5. Redeploy when ready

---

## Reference Files

### Existing Patterns to Follow

**Early Signal Detection Service:**
- Service: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/ml/early-signal/EarlySignalService.ts`
- Feature Extractor: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/ml/early-signal/FeatureExtractor.ts`
- Types: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/ml/early-signal/types.ts`

**Model Training Scripts:**
- Dataset Generation: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/scripts/ml/generate-training-data.ts`
- Training: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/scripts/ml/train-lightgbm.py`
- Evaluation: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/scripts/ml/evaluate-test-set.py`
- Registration: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/scripts/ml/register-early-signal-model.ts`

**Ensemble Integration:**
- Ensemble Service: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/ml/ensemble/EnsembleService.ts`
- Model Registry: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/ml/models/ModelRegistry.ts`
- Prediction Engine: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/ml/prediction/RealTimePredictionEngine.ts`

**API Integration:**
- FMP API: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/financial-data/FinancialModelingPrepAPI.ts`
- Rate Limits: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/docs/API_RATE_LIMITS_REFERENCE.md`

---

## Success Metrics

**Phase Completion Criteria:**

**Phase 1 (Data Collection):**
- ✅ Dataset with 5,000-20,000 examples
- ✅ Features extracted from FMP analyst API
- ✅ Labels balanced across 3 classes
- ✅ Data quality validated

**Phase 2 (Model Training):**
- ✅ Model accuracy >=60% on test set
- ✅ F1-score >=0.55 per class
- ✅ Model registered in registry
- ✅ Evaluation report generated

**Phase 3 (Service Integration):**
- ✅ Service latency <100ms (cached)
- ✅ Python inference working
- ✅ Redis caching operational
- ✅ Error handling complete

**Phase 4 (Ensemble Integration):**
- ✅ Model integrated into ensemble
- ✅ Dynamic weighting configured
- ✅ A/B testing framework ready
- ✅ Ensemble predictions working

**Phase 5 (Production Deployment):**
- ✅ Performance requirements met
- ✅ Monitoring and alerts active
- ✅ Documentation complete
- ✅ Model deployed to production

**Overall Success:**
- ✅ Analyst sentiment predictions available via ensemble API
- ✅ Prediction accuracy >=60%
- ✅ Latency <100ms (p95, cached)
- ✅ Error rate <1%
- ✅ Monitoring showing healthy metrics

---

## Risk Mitigation

**Risk 1: FMP Starter Plan Limitations**
- **Mitigation:** Verify API access in Task 0.1
- **Contingency:** Upgrade to FMP Professional or use alternative API

**Risk 2: Insufficient Analyst Coverage**
- **Mitigation:** Filter symbols with >=5 analyst ratings
- **Contingency:** Reduce minimum coverage to 3 analysts

**Risk 3: Poor Model Performance (<60% accuracy)**
- **Mitigation:** Feature engineering iteration
- **Contingency:** Ensemble with other models to boost accuracy

**Risk 4: High Latency (>500ms uncached)**
- **Mitigation:** Optimize feature extraction, use caching
- **Contingency:** Async prediction mode (return cached, update background)

**Risk 5: Python Process Instability**
- **Mitigation:** Auto-restart on failure
- **Contingency:** Health checks and monitoring

---

## Appendix: Command Reference

### Quick Start Commands
```bash
# Prerequisites
npx ts-node scripts/ml/analyst-sentiment/verify-fmp-analyst-api.ts

# Data Generation
npx ts-node scripts/ml/analyst-sentiment/generate-dataset.ts --full
python3 scripts/ml/analyst-sentiment/split-dataset.py

# Training
python3 scripts/ml/analyst-sentiment/train-model.py
python3 scripts/ml/analyst-sentiment/evaluate-test-set.py
npx ts-node scripts/ml/analyst-sentiment/register-model.ts

# Service Testing
npx ts-node scripts/ml/analyst-sentiment/test-service.ts --symbol AAPL
npx ts-node scripts/ml/analyst-sentiment/test-cache.ts --symbol AAPL

# Ensemble Integration
npx ts-node scripts/ml/ensemble/test-ensemble.ts --symbol AAPL

# Production Deployment
npx ts-node scripts/ml/analyst-sentiment/validate-performance.ts
npx ts-node scripts/ml/analyst-sentiment/deploy-production.ts
```

---

**END OF TODO**
