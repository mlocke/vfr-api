# ML Model Confidence Improvement Plan

**Created**: 2025-10-04
**Current Confidence**: 30.5% (0.305)
**Target Confidence**: 60-80%
**Estimated Timeline**: 2-4 weeks

---

## Problem Analysis

### Critical Finding: 20/34 Features Have Zero Importance

**Working Features (5)**:
1. `earnings_surprise` - 36.7% importance
2. `macd_histogram_trend` - 30.0% importance
3. `rsi_momentum` - 22.4% importance
4. `analyst_coverage_change` - 4.2% importance
5. `volume_trend` - 2.1% importance

**Dead Features (20)** - All showing 0% importance:
- Sentiment: `sentiment_news_delta`, `sentiment_reddit_accel`, `sentiment_options_shift`
- Social: All 6 StockTwits/Twitter features
- Macro: All 5 Fed/unemployment/CPI/GDP/treasury features
- SEC: All 3 insider/institutional/8-K features
- Premium: All 4 analyst/whisper/short interest features

**Root Cause**: Features are returning constant values (likely all zeros) due to:
1. API data not being fetched
2. Feature extraction methods returning defaults
3. Normalization params show `std: 1.0` for dead features (no variation)

---

## Phase 1: Fix Dead Features (Week 1)

### 1.1 Audit Feature Extraction Pipeline

**Goal**: Identify which features are actually being collected

**Action Items**:

1. **Add Feature Extraction Logging**
   ```typescript
   // In FeatureExtractor.ts
   public async extractFeatures(symbol: string): Promise<FeatureVector> {
     const features = await this.calculateAllFeatures(symbol);

     // Log feature statistics
     const stats = {
       total: Object.keys(features).length,
       nonZero: Object.values(features).filter(v => v !== 0).length,
       null: Object.values(features).filter(v => v === null || v === undefined).length
     };

     this.logger.info(`Feature extraction for ${symbol}:`, stats);
     return features;
   }
   ```

2. **Create Feature Validation Script**
   - Location: `scripts/ml/validate-features.ts`
   - Test 10 diverse symbols (AAPL, TSLA, NVDA, etc.)
   - Report which features are always zero
   - Check API response success rates

3. **Fix Missing Data Sources**
   - Priority order based on importance potential:
     1. Macro features (Fed rate, unemployment, CPI, GDP)
     2. SEC features (insider buying, institutional ownership)
     3. Sentiment features (news sentiment delta)
     4. Social features (StockTwits, Twitter)

**Expected Impact**: +10-15% confidence by activating 5-10 new features

**Files to Modify**:
- `app/services/ml/early-signal/FeatureExtractor.ts` (add logging)
- `scripts/ml/validate-features.ts` (create new)

---

### 1.2 Implement Missing API Integrations

**Macro Features** (Highest Priority):
```typescript
// Fed Rate Change
async calculateFedRateChange30d(): Promise<number> {
  const fredData = await this.macroService.getFederalFundsRate();
  if (!fredData || fredData.length < 2) return 0;

  const latest = fredData[0].value;
  const prev = fredData[1].value;
  return latest - prev; // Actual change, not zero
}

// Unemployment Rate Change
async calculateUnemploymentRateChange(): Promise<number> {
  const blsData = await this.macroService.getUnemploymentRate();
  // Similar implementation
}
```

**SEC Features**:
- Use SEC EDGAR API for 8-K filings (available via EDGARDataService)
- Extract insider buying from Form 4 filings
- Track institutional ownership changes

**Sentiment Features**:
- Integrate with existing SentimentAnalysisService
- Calculate news sentiment delta (current vs 7-day average)
- Reddit acceleration from RedditAPI

**Expected Impact**: +15-20% confidence by adding macro/SEC signals

---

### 1.3 Add Feature Quality Checks

**Pre-training Validation**:
```python
# scripts/ml/train-early-signal.py

def validate_feature_quality(df):
    """Check feature variance before training"""
    dead_features = []

    for col in df.columns:
        if df[col].std() < 0.01:  # Essentially constant
            dead_features.append(col)
            print(f"WARNING: {col} has near-zero variance (std={df[col].std():.6f})")

    if dead_features:
        print(f"\n⚠️ Found {len(dead_features)} dead features - excluding from model")
        df = df.drop(columns=dead_features)

    return df
```

**Expected Impact**: Cleaner model with only useful features

---

## Phase 2: Enhance High-Impact Features (Week 2)

### 2.1 Improve Earnings Surprise Calculation

**Current**: 36.7% importance (dominant feature)

**Enhancement**:
```typescript
// Add earnings momentum and trend
interface EnhancingsData {
  surprise: number;              // Current
  surpriseMomentum: number;      // NEW: 3-quarter trend
  consecutiveSurprises: number;  // NEW: Streak of positive surprises
  surpriseVolatility: number;    // NEW: Consistency measure
}

async calculateEarningsFeatures(symbol: string): Promise<EarningsData> {
  const earnings = await this.getEarningsHistory(symbol);

  return {
    surprise: this.calculateSurprise(earnings[0]),
    surpriseMomentum: this.calculateMomentum(earnings.slice(0, 3)),
    consecutiveSurprises: this.countStreak(earnings),
    surpriseVolatility: this.calculateVolatility(earnings.slice(0, 4))
  };
}
```

**Expected Impact**: +5-10% confidence by improving dominant feature

---

### 2.2 Add Technical Indicator Combinations

**Current**: MACD (30%) and RSI (22.4%) are strong predictors

**Enhancement - Add Confirmation Signals**:
```typescript
// Bollinger Band breakout with volume confirmation
calculateTechnicalConfirmation(): number {
  const macdSignal = this.macdHistogramTrend > 0 ? 1 : -1;
  const rsiSignal = this.rsiMomentum > 0 ? 1 : -1;
  const bbSignal = this.bollingerBreakout();
  const volumeConfirm = this.volumeTrend > 1.2;

  // Only confident if multiple indicators align
  if (macdSignal === rsiSignal && volumeConfirm) {
    return macdSignal; // Strong signal
  }

  return 0; // Conflicting signals = low confidence
}
```

**Expected Impact**: +5-8% confidence by reducing false signals

---

## Phase 3: Retrain Model with Better Data (Week 3)

### 3.1 Expand Training Dataset

**Current**: Unknown size (likely <1000 samples based on small test set)

**Actions**:
1. **Collect Historical Data**
   - Scrape 3-5 years of analyst rating changes
   - Match with 34 features at time of change
   - Target: 5,000+ training samples

2. **Balance Dataset**
   - Current: Likely imbalanced (more MAINTAIN than UPGRADE)
   - Use SMOTE or undersampling to balance classes
   - Ratio: 40% UPGRADE, 40% MAINTAIN, 20% DOWNGRADE

3. **Add More Recent Data**
   - Model trained 2025-10-04
   - Add continuous learning with monthly retraining

**Expected Impact**: +10-15% confidence from more training data

---

### 3.2 Hyperparameter Tuning

**Current Settings** (likely defaults):
```python
# scripts/ml/train-early-signal.py
model = lgb.LGBMClassifier(
    # Unknown current settings
)
```

**Optimized Settings**:
```python
# Use GridSearchCV or Optuna for tuning
param_grid = {
    'num_leaves': [31, 63, 127],  # Complexity
    'learning_rate': [0.01, 0.05, 0.1],
    'n_estimators': [100, 200, 500],
    'min_child_samples': [20, 50, 100],
    'max_depth': [5, 10, 15, -1],
    'colsample_bytree': [0.7, 0.8, 1.0],

    # Calibration for better confidence
    'is_unbalance': [True],
    'objective': ['binary'],  # or 'multiclass' for 3 classes
}

# Add probability calibration
from sklearn.calibration import CalibratedClassifierCV
calibrated_model = CalibratedClassifierCV(model, method='isotonic', cv=5)
```

**Expected Impact**: +5-10% confidence from better model architecture

---

## Phase 4: Ensemble & Calibration (Week 4)

### 4.1 Build Model Ensemble

**Strategy**: Combine multiple models for robust predictions

```python
# scripts/ml/train-ensemble.py

# Train multiple models
models = {
    'lgbm': LGBMClassifier(...),
    'xgboost': XGBClassifier(...),
    'random_forest': RandomForestClassifier(...),
    'logistic': LogisticRegression(...)  # Baseline
}

# Stacking ensemble with meta-learner
from sklearn.ensemble import StackingClassifier

ensemble = StackingClassifier(
    estimators=[(name, model) for name, model in models.items()],
    final_estimator=LogisticRegression(),
    cv=5
)

# This improves confidence through consensus
```

**Expected Impact**: +5-10% confidence from ensemble agreement

---

### 4.2 Probability Calibration

**Current Issue**: Raw LightGBM probabilities may not be well-calibrated

**Solution - Platt Scaling**:
```python
from sklearn.calibration import CalibratedClassifierCV

# Calibrate model probabilities
calibrated_model = CalibratedClassifierCV(
    base_model,
    method='sigmoid',  # Platt scaling for small datasets
    cv=5
)

# Evaluate calibration
from sklearn.calibration import calibration_curve
prob_true, prob_pred = calibration_curve(y_test, probs, n_bins=10)

# Well-calibrated: prob_true ≈ prob_pred
```

**Expected Impact**: +5-8% confidence from better-calibrated probabilities

---

## Summary: Expected Confidence Improvements

| Phase | Actions | Expected Gain | Cumulative Confidence |
|-------|---------|---------------|----------------------|
| **Baseline** | Current model | - | 30% |
| **Phase 1.1** | Fix dead features | +10-15% | 40-45% |
| **Phase 1.2** | Add missing APIs | +15-20% | 55-65% |
| **Phase 2** | Enhance top features | +10-18% | 65-83% |
| **Phase 3** | Retrain with more data | +10-15% | 75-98% |
| **Phase 4** | Ensemble + calibration | +5-10% | 80-108% |

**Realistic Target**: **60-80% confidence** after Phases 1-3 (3 weeks)

---

## Quick Wins (This Week)

### Priority 1: Fix Feature Extraction
1. Run feature validation on 10 test symbols
2. Identify which features are returning zeros
3. Fix top 3 broken features (likely macro/sentiment/SEC)

### Priority 2: Add Logging
```typescript
// Add to FeatureExtractor.ts
private logFeatureStats(symbol: string, features: FeatureVector) {
  const stats = {
    nonZeroCount: Object.values(features).filter(v => v !== 0).length,
    avgAbsValue: Object.values(features).reduce((sum, v) => sum + Math.abs(v), 0) / Object.keys(features).length
  };

  if (stats.nonZeroCount < 10) {
    this.logger.warn(`Only ${stats.nonZeroCount}/34 features non-zero for ${symbol}!`);
  }
}
```

### Priority 3: Create Feature Validation Script
- File: `scripts/ml/validate-features.ts`
- Test AAPL, TSLA, NVDA, GOOGL, MSFT
- Report to console which features are always zero

---

## Monitoring

### Add to MLMonitoringService

```typescript
interface ConfidenceMetrics {
  avgConfidence: number;
  confidenceDistribution: {
    low: number;    // <0.3
    medium: number; // 0.3-0.7
    high: number;   // >0.7
  };
  featureUtilization: {
    nonZeroFeatures: number;
    avgFeatureValue: number;
  };
}

async trackConfidenceMetrics(predictions: PredictionResult[]) {
  // Track over time to measure improvement
}
```

---

## Next Actions

1. **Create feature validation script** (30 min)
2. **Run validation on test symbols** (15 min)
3. **Fix top 3 broken features** (2-4 hours)
4. **Retrain model with fixed features** (1 hour)
5. **Deploy and test new model** (1 hour)

**Expected First Iteration Impact**: +15-25% confidence improvement
**Timeline**: 1 week for Phases 1.1-1.2

Would you like me to create the feature validation script to get started?
