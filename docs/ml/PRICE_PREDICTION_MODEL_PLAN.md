# Price Prediction Model - Implementation Plan

**Status**: IN PROGRESS - Training Phase
**Current State**: Dataset generation complete (73,200 examples), ready for model training
**Target**: Dedicated price movement prediction model with >60% accuracy
**Timeline**: 1.5 weeks remaining (dataset phase complete)

---

## Problem Statement

### Current Issues
1. ❌ **Model Mismatch**: ESD model trained to predict analyst upgrades, not price movements
2. ❌ **Low Confidence**: 10-12% confidence due to wrong model usage
3. ❌ **Wrong Features**: Using analyst-relevant features (analyst coverage change) for price prediction
4. ❌ **Wrong Labels**: Model trained on "analyst upgrade in 7 days" not "price up in 7 days"
5. ⚠️ **Misleading UI**: Showing price predictions with high accuracy claims from analyst model

### Root Cause
The ESD (Early Signal Detection) model was designed and trained to predict:
- **Target**: "Will analysts upgrade this stock in the next 7 days?"
- **Performance**: 97.6% accuracy for analyst upgrades
- **Features**: Optimized for analyst behavior signals

We're currently using it to predict:
- **Wrong Target**: "Will the stock price go up in the next 7 days?"
- **Result**: ~10% confidence (essentially random)

---

## Solution Architecture

### Model Comparison

| Aspect | ESD (Analyst) Model | Price Prediction Model |
|--------|---------------------|------------------------|
| **Target Variable** | Analyst upgrade (binary) | Price movement % (regression) or direction (classification) |
| **Primary Features** | Analyst coverage, earnings surprise, sentiment | Volume profile, technical indicators, options flow |
| **Label Definition** | Upgrade within 7 days | Price change >2% within 7 days |
| **Use Case** | Predict analyst actions | Predict price movements |
| **Current Accuracy** | 97.6% (for analyst upgrades) | N/A (not trained yet) |
| **Target Accuracy** | N/A | >60% for price direction |

### Recommended Model Type

**Classification Model (Preferred)**:
- **Output**: 3 classes (UP, DOWN, NEUTRAL)
- **Label**: Price change >2% up (UP), <-2% down (DOWN), else (NEUTRAL)
- **Advantage**: Clear actionable signals
- **Evaluation**: Accuracy, precision, recall, F1

**Alternative - Regression Model**:
- **Output**: Predicted price change %
- **Label**: Actual price change % over 7 days
- **Advantage**: Magnitude estimation
- **Evaluation**: RMSE, MAE, R²

**Recommended**: Start with classification (simpler, more actionable)

---

## Feature Engineering for Price Prediction

### High-Priority Features (Proven Predictive Power)

#### 1. Volume Profile (Critical)
```typescript
- volume_ratio_5d: Current volume / 5-day average
- volume_spike: Volume > 2x average (binary)
- volume_trend_10d: Volume trend slope
- relative_volume: Volume vs sector average
- dark_pool_volume_ratio: Dark pool / total volume
```

#### 2. Technical Indicators (Critical)
```typescript
- rsi_14: Relative Strength Index
- macd_signal: MACD - Signal line
- macd_histogram: Rate of change
- bollinger_position: (Price - Lower) / (Upper - Lower)
- stochastic_k: Stochastic oscillator
- adx_14: Average Directional Index (trend strength)
- atr_14: Average True Range (volatility)
```

#### 3. Options Flow (High Value)
```typescript
- put_call_ratio_change: Change in put/call ratio
- unusual_options_activity: Volume > 2x OI
- options_iv_rank: Implied volatility percentile
- gamma_exposure: Market maker gamma hedging pressure
- max_pain_distance: Price distance to max pain level
```

#### 4. Price Action (Essential)
```typescript
- price_momentum_5d: 5-day return
- price_momentum_10d: 10-day return
- price_momentum_20d: 20-day return
- price_acceleration: (5d momentum - 10d momentum)
- gap_up_down: Gap % from previous close
- intraday_volatility: High-Low / Open
```

#### 5. Institutional Flow (Important)
```typescript
- institutional_net_flow: Buy pressure - sell pressure
- block_trade_volume: Large trades > 10k shares
- insider_buying_ratio: Insider buys / sells
- 13f_ownership_change: Institutional ownership Δ
```

#### 6. Market Microstructure (Advanced)
```typescript
- bid_ask_spread: Spread / midpoint (liquidity)
- order_imbalance: Buy volume - sell volume
- vwap_deviation: Price / VWAP - 1
- tick_direction: Up ticks / total ticks
```

#### 7. Sentiment (Moderate)
```typescript
- news_sentiment_delta: Change in news sentiment
- social_momentum: Twitter/Reddit volume change
- analyst_price_target_distance: (Target - Price) / Price
```

#### 8. Macro Context (Low Weight)
```typescript
- sector_momentum_5d: Sector ETF 5-day return
- market_momentum_spy: SPY 5-day return
- vix_level: Market volatility
- correlation_to_spy: Rolling correlation
```

### Feature Set Summary
- **Total Features**: ~35-40 (vs 31 in ESD model)
- **Volume/Technical**: 60% weight
- **Options Flow**: 20% weight
- **Institutional**: 10% weight
- **Sentiment/Macro**: 10% weight

---

## Label Generation Strategy

### Classification Labels (Recommended)

```typescript
interface PriceLabel {
  symbol: string
  date: string
  current_price: number
  future_price_7d: number
  price_change_pct: number
  label: 'UP' | 'DOWN' | 'NEUTRAL'
}

function generateLabel(currentPrice: number, futurePrice: number): string {
  const changePercent = ((futurePrice - currentPrice) / currentPrice) * 100

  if (changePercent > 2.0) return 'UP'      // Significant upward movement
  if (changePercent < -2.0) return 'DOWN'   // Significant downward movement
  return 'NEUTRAL'                          // Sideways/noise
}
```

**Threshold Selection**:
- **2% threshold**: Filters out noise, focuses on meaningful moves
- **Alternative**: Use volatility-adjusted thresholds (1.5 × ATR)
- **Alternative**: Use percentile-based (top 33% = UP, bottom 33% = DOWN)

### Label Balance Strategy
```typescript
Target distribution:
- UP: 30-35%
- DOWN: 30-35%
- NEUTRAL: 30-40%

Strategy to achieve:
- Sample across different market conditions (bull, bear, sideways)
- Include multiple timeframes (2020-2024)
- Ensure sector diversity
```

---

## Training Data Generation - ✅ COMPLETE

### Critical Update: Switched to yfinance
**Problem**: Original TypeScript script (`generate-price-prediction-dataset.ts`) failed due to FMP API limitations with historical data
**Solution**: Created Python script using yfinance library for reliable historical data access

### Production Script: `scripts/ml/generate-price-dataset-yfinance.py`

```typescript
interface PricePredictionDataRow {
  // Metadata
  symbol: string
  date: string

  // Volume features (6)
  volume_ratio_5d: number
  volume_spike: number
  volume_trend_10d: number
  relative_volume: number
  dark_pool_ratio: number
  volume_acceleration: number

  // Technical indicators (10)
  rsi_14: number
  macd_signal: number
  macd_histogram: number
  bollinger_position: number
  stochastic_k: number
  adx_14: number
  atr_14: number
  ema_20_distance: number
  sma_50_distance: number
  williams_r: number

  // Price action (8)
  price_momentum_5d: number
  price_momentum_10d: number
  price_momentum_20d: number
  price_acceleration: number
  gap_percent: number
  intraday_volatility: number
  overnight_return: number
  week_high_distance: number

  // Options flow (7)
  put_call_ratio: number
  put_call_ratio_change: number
  unusual_options_activity: number
  options_iv_rank: number
  gamma_exposure: number
  max_pain_distance: number
  options_volume_ratio: number

  // Institutional (4)
  institutional_net_flow: number
  block_trade_volume: number
  insider_buying_ratio: number
  ownership_change_30d: number

  // Sentiment (4)
  news_sentiment_delta: number
  social_momentum: number
  analyst_target_distance: number
  earnings_surprise_impact: number

  // Macro (4)
  sector_momentum_5d: number
  spy_momentum_5d: number
  vix_level: number
  correlation_to_spy_20d: number

  // Label
  label: 'UP' | 'DOWN' | 'NEUTRAL'
}
```

### Data Collection Strategy - ✅ IMPLEMENTED

**Stock Universe**: Top 100 S&P 500 stocks (by market cap)
- Largest, most liquid stocks for reliable data
- Diverse across sectors
- High-quality price and volume data

**Actual Dataset Generated**:
```
Date range: 2022-01-01 to 2024-12-31 (3 years)
Sampling frequency: Daily (with feature calculation)
Total examples: 73,200 (73,201 including header)
Average per stock: 732 examples

Historical integrity:
- ✅ Use only data available at sample date (no lookahead)
- ✅ Calculate labels using price 7 days after sample date
- ✅ Exclude last 7 days of dataset (no future price available)
```

**Market Conditions Coverage** - ✅ Achieved:
- 2022: Bear market (inflation, rate hikes) - captures DOWN moves
- 2023: Recovery rally - captures UP moves
- 2024: Current market - captures recent patterns

**Label Distribution** - ✅ Well Balanced:
- NEUTRAL: 28,555 (39.0%)
- UP: 24,728 (33.8%)
- DOWN: 19,917 (27.2%)

### Implementation Steps - PROGRESS UPDATE

```bash
# 1. Create feature extraction service
# ✅ COMPLETE - app/services/ml/features/PricePredictionFeatureExtractor.ts

# 2. Generate dataset using yfinance (checkpoint every 10 stocks)
# ✅ COMPLETE - python scripts/ml/generate-price-dataset-yfinance.py
# Result: 73,200 examples in data/training/price-prediction-yf-top100.csv

# 3. Validate dataset quality
# ✅ COMPLETE - Manual validation, label distribution confirmed balanced

# 4. Split into train/val/test (70/15/15)
# ✅ COMPLETE - python scripts/ml/split-price-dataset.py
# Results:
#   - price-train.csv (51,240 examples)
#   - price-val.csv (10,980 examples)
#   - price-test.csv (10,980 examples)

# 5. Train LightGBM model
# 🔄 NEXT - python scripts/ml/train-price-prediction-model.py
# Expected: v1.1.0 with 55-65% accuracy

# 6. Backtest on test set
# ⏳ PENDING - python scripts/ml/backtest-price-model.py

# 7. Register model
# ⏳ PENDING - npx tsx scripts/ml/register-price-model.ts --version v1.1.0
```

---

## Model Training Configuration

### LightGBM Configuration (Multi-Class Classification)

```python
from lightgbm import LGBMClassifier

model = LGBMClassifier(
    objective='multiclass',
    num_class=3,  # UP, DOWN, NEUTRAL
    metric='multi_logloss',
    boosting_type='gbdt',
    num_leaves=31,
    learning_rate=0.05,
    n_estimators=300,  # More trees for complex patterns
    max_depth=8,       # Deeper for price patterns
    min_child_samples=30,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=0.1,
    class_weight='balanced',  # Handle class imbalance
    random_state=42
)
```

### Training Process

```python
# 1. Load data
train = pd.read_csv('data/training/price-train.csv')
val = pd.read_csv('data/training/price-val.csv')

# 2. Separate features and labels
X_train = train.drop(['symbol', 'date', 'label'], axis=1)
y_train = train['label'].map({'UP': 2, 'NEUTRAL': 1, 'DOWN': 0})

X_val = val.drop(['symbol', 'date', 'label'], axis=1)
y_val = val['label'].map({'UP': 2, 'NEUTRAL': 1, 'DOWN': 0})

# 3. Normalize features (z-score)
from sklearn.preprocessing import StandardScaler
scaler = StandardScaler()
X_train_norm = scaler.fit_transform(X_train)
X_val_norm = scaler.transform(X_val)

# 4. Train with early stopping
model.fit(
    X_train_norm, y_train,
    eval_set=[(X_val_norm, y_val)],
    eval_metric='multi_logloss',
    early_stopping_rounds=30,
    verbose=50
)

# 5. Save model and scaler
model.booster_.save_model('models/price-prediction/v1.0.0/model.txt')
joblib.dump(scaler, 'models/price-prediction/v1.0.0/scaler.pkl')
```

---

## Validation & Backtesting

### Performance Metrics

```python
from sklearn.metrics import classification_report, confusion_matrix

# Predictions
y_pred = model.predict(X_test_norm)
y_pred_proba = model.predict_proba(X_test_norm)

# Classification report
print(classification_report(y_test, y_pred,
                          target_names=['DOWN', 'NEUTRAL', 'UP']))

# Confusion matrix
print(confusion_matrix(y_test, y_pred))

# Per-class accuracy
print(f"UP accuracy: {accuracy_score(y_test[y_test==2], y_pred[y_test==2])}")
print(f"DOWN accuracy: {accuracy_score(y_test[y_test==0], y_pred[y_test==0])}")
```

### Target Performance

```
Overall Accuracy: >55%
UP Precision: >60% (avoid false buy signals)
DOWN Precision: >60% (avoid false sell signals)
UP Recall: >50%
DOWN Recall: >50%
```

### Backtesting Framework

```typescript
interface BacktestResult {
  totalTrades: number
  winRate: number
  avgReturn: number
  sharpeRatio: number
  maxDrawdown: number
  profitFactor: number
}

// Strategy: Buy on UP, Sell on DOWN, Hold on NEUTRAL
async function backtest(
  predictions: PricePrediction[],
  actualPrices: Map<string, number[]>
): Promise<BacktestResult> {
  // Simulate trading based on predictions
  // Calculate P&L, win rate, Sharpe ratio
}
```

---

## Integration Plan - UPDATED STATUS

### Phase 1: Model Development (Week 1-2) - ✅ MOSTLY COMPLETE
- [x] Create price feature extraction service ✅
- [x] Generate training dataset (73k examples) ✅
- [x] Validate dataset quality ✅
- [x] Split dataset (train/val/test) ✅
- [ ] Train production LightGBM model 🔄 (next step)
- [ ] Evaluate on test set ⏳
- [ ] Iterate on features/hyperparameters (if needed) ⏳

### Phase 2: Backtesting (Week 2)
- [ ] Implement backtesting framework
- [ ] Run historical simulations
- [ ] Calculate performance metrics
- [ ] Compare vs. buy-and-hold baseline
- [ ] Identify failure modes

### Phase 3: Production Integration (Week 3)
- [ ] Register model in ModelRegistry
- [ ] Update RealTimePredictionEngine to support model selection
- [ ] Add confidence thresholds (only show predictions >60% confidence)
- [ ] Update composite scoring weights
- [ ] Add performance monitoring

### Phase 4: Monitoring (Ongoing)
- [ ] Track real-time prediction accuracy
- [ ] Log predictions to database
- [ ] Calculate actual outcomes after 7 days
- [ ] Build performance dashboard
- [ ] Set up alerts for accuracy degradation

---

## Code Changes Required

### 1. New Feature Extractor

**File**: `app/services/ml/features/PricePredictionFeatureExtractor.ts`

```typescript
export class PricePredictionFeatureExtractor {
  async extractFeatures(symbol: string, date: Date): Promise<PriceFeatureVector> {
    // Volume features (using existing VWAP, volume services)
    // Technical indicators (using TechnicalIndicatorService)
    // Options flow (using OptionsDataService)
    // Institutional flow (using InstitutionalDataService)
    // Sentiment (using SentimentAnalysisService)
  }
}
```

### 2. Update RealTimePredictionEngine

**File**: `app/services/ml/prediction/RealTimePredictionEngine.ts`

```typescript
async predict(request: PredictionRequest): Promise<PredictionResult> {
  // Determine which model to use
  const modelType = this.selectModelType(request)

  if (modelType === 'PRICE_PREDICTION') {
    return this.predictPriceMovement(request)
  } else if (modelType === 'ANALYST_PREDICTION') {
    return this.predictAnalystUpgrade(request)
  }
}

private selectModelType(request: PredictionRequest): ModelType {
  // Use price prediction model for price-related queries
  // Use analyst model for analyst-related queries
}
```

### 3. Update Composite Scoring

**File**: `app/services/stock-selection/EnhancedScoringEngine.ts`

```typescript
// Adjust weights based on model confidence
if (mlPrediction.confidence > 0.6) {
  mlWeight = 0.20  // Increase ML weight for high confidence
} else if (mlPrediction.confidence < 0.4) {
  mlWeight = 0.05  // Reduce ML weight for low confidence
}
```

### 4. Add Model Performance Tracking

**File**: `app/services/ml/monitoring/ModelPerformanceTracker.ts`

```typescript
export class ModelPerformanceTracker {
  async logPrediction(prediction: PredictionResult): Promise<void> {
    // Store prediction in database
  }

  async checkOutcome(predictionId: string): Promise<PredictionOutcome> {
    // After 7 days, fetch actual price and calculate accuracy
  }

  async getModelStats(modelId: string): Promise<ModelStats> {
    // Return accuracy, precision, recall over time
  }
}
```

---

## Success Criteria

### Minimum Viable Product (MVP)
- ✅ Model trained on 100k+ examples
- ✅ Overall accuracy >55%
- ✅ UP/DOWN precision >60%
- ✅ Integrated into RealTimePredictionEngine
- ✅ Confidence-based weighting implemented

### Production Ready
- ✅ Backtested on 2+ years of data
- ✅ Sharpe ratio >1.0 in backtests
- ✅ Performance monitoring dashboard
- ✅ Accuracy >60% on live predictions
- ✅ Documentation complete

### Stretch Goals
- ✅ Ensemble with multiple models (LightGBM + XGBoost + Neural Network)
- ✅ Multi-horizon predictions (1-day, 3-day, 7-day, 30-day)
- ✅ Regression model for price target estimation
- ✅ Sector-specific models

---

## Risk Mitigation

### Risk 1: Low Initial Accuracy
- **Mitigation**: Start with well-known predictive features (volume, RSI, MACD)
- **Fallback**: Keep using VFR scores if model underperforms

### Risk 2: Overfitting
- **Mitigation**: Use train/val/test split, early stopping, regularization
- **Validation**: Backtest on unseen time periods

### Risk 3: Data Quality
- **Mitigation**: Implement data validation, handle missing values gracefully
- **Monitoring**: Track feature completeness over time

### Risk 4: Market Regime Changes
- **Mitigation**: Retrain monthly on rolling window
- **Monitoring**: Track accuracy by market condition (bull/bear/sideways)

---

## Timeline

| Week | Milestone |
|------|-----------|
| 1 | Feature extraction complete, dataset generation started |
| 2 | Model training complete, initial accuracy >50% |
| 3 | Backtesting complete, production integration started |
| 4 | Live monitoring, performance tracking dashboard |

**Target Completion**: 3-4 weeks from start

---

## Next Steps (Immediate Actions)

1. **Create PricePredictionFeatureExtractor service** (Day 1-2)
2. **Generate small test dataset** (100 stocks × 1 year) (Day 2-3)
3. **Train initial model and evaluate** (Day 3-4)
4. **If accuracy >50%, scale up to full dataset** (Day 5-7)
5. **Implement backtesting framework** (Week 2)
6. **Production integration** (Week 3)

---

**Status**: Ready to begin implementation
**Owner**: ML Team
**Priority**: P0 (Critical)
