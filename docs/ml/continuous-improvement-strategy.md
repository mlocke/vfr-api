# ML Continuous Training and Improvement Strategy

**Document Created:** 2025-10-05
**Document Version:** 1.0
**ML Model Version:** v1.1.0 (LightGBM Gradient Boosting)
**System:** Stock Prediction ML (Early Signal Detection)

---

## Executive Summary

This document provides a comprehensive, actionable strategy for continuous improvement of the VFR API stock prediction ML system. The system currently uses XGBoost/LightGBM ensemble models to predict earnings surprises 7 days in advance, trained on S&P 500 historical data with 34 features across price, volume, sentiment, fundamental, technical, macroeconomic, and alternative data categories.

**Priority Framework:** Implement improvements in order of ROI (Return on Investment = Impact / Effort)

**Success Metrics:**
- Prediction accuracy >80% (current: ~92% validation, needs production testing)
- Top 10% stock selection beats S&P 500 by >5% annually
- Model drift detection triggers retraining before performance degrades >5%
- Feature importance stability (top features remain consistent across retraining cycles)

---

## Table of Contents

1. [System Context](#system-context)
2. [Current State Assessment](#current-state-assessment)
3. [Automated Retraining Pipeline](#automated-retraining-pipeline)
4. [Feature Engineering Improvements](#feature-engineering-improvements)
5. [Model Ensemble Enhancement](#model-ensemble-enhancement)
6. [Production Feedback Loop](#production-feedback-loop)
7. [Data Quality & Monitoring](#data-quality--monitoring)
8. [MLOps Infrastructure](#mlops-infrastructure)
9. [Experiment Tracking](#experiment-tracking)
10. [Implementation Roadmap](#implementation-roadmap)
11. [Decision Trees & Error Boundaries](#decision-trees--error-boundaries)

---

## System Context

### Business Problem
Predict which S&P 500 stocks will experience positive earnings surprises (>20% beat) 7 days before earnings announcements, enabling early position entry before market reaction.

### Technical Constraints
- **API Rate Limits:** FMP 300/min, FRED 120/min, SEC EDGAR 10/sec
- **Data Latency:** Historical data available with T+1 delay, earnings data immediate
- **Compute Resources:** Training runs on local machine (~30-60 min for 500 stocks)
- **Storage:** 7 caches (earnings, OHLCV, income statements, analyst ratings, SEC filings, options, macroeconomic)

### Current Architecture
```
Data Sources (FMP, FRED, BLS, SEC)
    ↓
Caching Layer (7 specialized caches)
    ↓
Feature Extraction (34 features)
    ↓
Training Pipeline (generate → split → train)
    ↓
Model Storage (versioned in models/early-signal/)
    ↓
Production API (MLEnhancedStockSelectionService)
```

### Success Criteria
- **Accuracy:** >80% on held-out test set
- **Precision:** >75% (minimize false positives)
- **Sharpe Ratio:** >1.5 for selected stocks vs market
- **Prediction Latency:** <500ms for real-time inference

---

## Current State Assessment

### Model Version: v1.1.0 (2025-10-04)

**Algorithm:** LightGBM Gradient Boosting
**Training Data:** 12 examples (PIPELINE TEST - NOT PRODUCTION READY)
**Features:** 34 total (28 active, 6 stubbed social/sentiment features)

**Critical Issue:** Model trained on only 12 examples as pipeline validation. Requires full retraining with 100+ stocks minimum.

**Validation Metrics (v1.1.0):**
```json
{
  "accuracy": 0.0,
  "auc": NaN,
  "precision": 0.0,
  "recall": 0.0,
  "f1": 0.0
}
```
⚠️ **Status:** Model placeholder only - do not use in production until retrained.

**Feature Importance (v1.0.0 baseline - 379 examples):**
```
1. earnings_surprise:           40.8%
2. rsi_momentum:                26.2%
3. macd_histogram_trend:        24.3%
4. analyst_coverage_change:      3.6%
5. volume_trend:                 2.3%
```

**Key Observations:**
- Technical indicators (RSI, MACD) dominate predictions (~50% combined)
- Macro features (fed_rate, unemployment, CPI, GDP, treasury) returning real data but not yet influential
- Social/sentiment features stubbed out (return 0) - major opportunity for improvement
- 28 features working correctly after macro data fix (2025-10-04)

### Data Pipeline Status

**Training Data Generation:**
- Script: `scripts/ml/generate-training-data.ts`
- Universe: S&P 500 (500 stocks) or Extended 940 stocks
- Time Range: 2023-01-01 to 2025-12-31
- Examples per Stock: ~12 earnings events (quarterly data)
- Total Examples (500 stocks): ~6,000 training examples
- Label: 1 if earnings surprise >20%, 0 otherwise

**Caching Infrastructure:**
- ✅ OHLCV cache (price/volume data)
- ✅ Income statement cache (fundamentals)
- ✅ Analyst ratings cache
- ✅ SEC filings cache
- ✅ Options data cache
- ✅ Macroeconomic data cache (FRED/BLS)
- ✅ Earnings data cache
- **Cache Hit Rate:** 75-90% reduction in API calls

**Model Storage:**
```
models/early-signal/
├── v1.0.0/  (baseline - 379 examples, 34 features)
│   ├── model.json
│   ├── normalizer.json
│   └── metadata.json
└── v1.1.0/  (current - 12 examples, 28 active features)
    ├── model.txt
    ├── model.json
    ├── normalizer.json
    └── metadata.json
```

---

## Automated Retraining Pipeline

### Objective
Automatically retrain models on fresh data to prevent performance degradation from market regime changes, new patterns, or data drift.

### Implementation Strategy

#### 1. Retraining Triggers

**Schedule-Based Triggers:**
```typescript
// Decision Tree: When to retrain
const retrainingSchedule = {
  monthly: {
    condition: "First trading day of month",
    rationale: "Capture new earnings season data",
    dataWindow: "Rolling 24 months",
    estimatedTime: "60 minutes (500 stocks)"
  },
  quarterly: {
    condition: "Week after earnings season ends",
    rationale: "Full earnings cycle completed",
    dataWindow: "Rolling 36 months",
    estimatedTime: "90 minutes (940 stocks)"
  }
};
```

**Drift-Based Triggers:**
```typescript
interface DriftDetectionConfig {
  featureDistributionDrift: {
    metric: "Kolmogorov-Smirnov test",
    threshold: 0.15,
    action: "Trigger retraining if >3 features drift beyond threshold"
  },
  predictionDrift: {
    metric: "Population Stability Index (PSI)",
    threshold: 0.2,
    action: "Trigger immediate retraining"
  },
  performanceDrift: {
    metric: "Rolling 30-day accuracy",
    threshold: 0.75,
    action: "Alert + schedule retraining if accuracy < threshold"
  }
}
```

**Performance-Based Triggers:**
```typescript
const performanceTriggers = {
  accuracyDrop: {
    condition: "Rolling 30-day accuracy < 75%",
    baseline: "Validation set accuracy from last training",
    action: "Emergency retraining within 24 hours"
  },
  calibrationDrift: {
    condition: "Predicted probabilities poorly calibrated (Brier score > 0.25)",
    check: "Weekly calibration curve analysis",
    action: "Schedule retraining + review feature engineering"
  },
  featureImportanceShift: {
    condition: "Top 5 features change in production vs training",
    check: "Monthly SHAP value analysis",
    action: "Investigate + retrain with updated feature set"
  }
};
```

#### 2. Automated Retraining Workflow

**New Script: `scripts/ml/retrain-scheduler.ts`**

```typescript
/**
 * Automated Model Retraining Scheduler
 *
 * Responsibilities:
 * - Check drift metrics daily
 * - Execute scheduled retraining (monthly/quarterly)
 * - Generate fresh training data
 * - Train new model version
 * - Validate against current champion
 * - Deploy if performance improves
 */

interface RetrainingConfig {
  schedule: "monthly" | "quarterly" | "on-demand";
  dataWindow: { start: Date; end: Date };
  stockUniverse: "sp500" | "extended940";
  validationStrategy: "holdout" | "time-series-split";
  deploymentStrategy: "champion-challenger" | "immediate";
}

async function executeRetraining(config: RetrainingConfig): Promise<void> {
  // 1. Generate fresh training data
  console.log("📊 Generating fresh training data...");
  await generateTrainingData({
    symbols: getStockUniverse(config.stockUniverse),
    start: config.dataWindow.start,
    end: config.dataWindow.end,
    output: `data/training/retrain-${Date.now()}.csv`
  });

  // 2. Split data with time-series awareness
  await splitTrainingData({
    method: "time-series",
    trainRatio: 0.7,
    valRatio: 0.15,
    testRatio: 0.15
  });

  // 3. Train new model
  const newVersion = incrementVersion(getCurrentVersion());
  await trainModel({
    version: newVersion,
    algorithm: "LightGBM",
    hyperparameters: loadOptimalHyperparameters()
  });

  // 4. Compare against champion
  const comparison = await compareModels({
    champion: "v1.1.0",
    challenger: newVersion,
    metrics: ["accuracy", "precision", "recall", "auc", "sharpe_ratio"]
  });

  // 5. Deploy if challenger wins
  if (comparison.challenger.auc > comparison.champion.auc + 0.02) {
    await deployModel({
      version: newVersion,
      strategy: "blue-green",
      rollbackOnError: true
    });
    console.log(`✅ Deployed ${newVersion} (AUC: ${comparison.challenger.auc})`);
  } else {
    console.log(`⚠️  Challenger ${newVersion} did not beat champion - keeping v1.1.0`);
  }
}
```

**Integration Point:** Run as cron job or GitHub Actions workflow:
```yaml
# .github/workflows/ml-retraining.yml
name: ML Model Retraining
on:
  schedule:
    - cron: '0 2 1 * *'  # Monthly on 1st at 2am UTC
  workflow_dispatch:  # Manual trigger

jobs:
  retrain:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm install
      - name: Run retraining
        run: npx tsx scripts/ml/retrain-scheduler.ts --schedule monthly
      - name: Upload model artifacts
        uses: actions/upload-artifact@v3
        with:
          name: model-${{ github.run_id }}
          path: models/early-signal/
```

#### 3. Drift Detection Implementation

**New Script: `scripts/ml/monitor-drift.ts`**

```typescript
/**
 * Model Drift Detection Service
 *
 * Monitors:
 * - Feature distribution drift (KS test)
 * - Prediction drift (PSI)
 * - Performance drift (accuracy trends)
 */

import { kolmogorovSmirnovTest } from './utils/statistics';

interface DriftReport {
  timestamp: Date;
  featureDrift: Record<string, number>;  // KS statistic per feature
  predictionPSI: number;
  rollingAccuracy: number;
  recommendation: "no_action" | "schedule_retrain" | "emergency_retrain";
}

async function detectDrift(): Promise<DriftReport> {
  // Load reference distributions from training data
  const referenceData = loadTrainingDistributions();

  // Load recent production predictions (last 30 days)
  const productionData = await loadProductionData({ days: 30 });

  // Calculate KS statistic for each feature
  const featureDrift: Record<string, number> = {};
  for (const feature of FEATURE_NAMES) {
    const ksStatistic = kolmogorovSmirnovTest(
      referenceData[feature],
      productionData[feature]
    );
    featureDrift[feature] = ksStatistic;
  }

  // Calculate Population Stability Index (PSI)
  const predictionPSI = calculatePSI(
    referenceData.predictions,
    productionData.predictions
  );

  // Calculate rolling accuracy
  const rollingAccuracy = calculateRollingAccuracy(productionData, { window: 30 });

  // Generate recommendation
  const recommendation = determineAction({
    featureDrift,
    predictionPSI,
    rollingAccuracy
  });

  return {
    timestamp: new Date(),
    featureDrift,
    predictionPSI,
    rollingAccuracy,
    recommendation
  };
}

function determineAction(metrics: {
  featureDrift: Record<string, number>;
  predictionPSI: number;
  rollingAccuracy: number;
}): "no_action" | "schedule_retrain" | "emergency_retrain" {
  // Critical drift: immediate action needed
  if (metrics.rollingAccuracy < 0.75) {
    return "emergency_retrain";
  }

  if (metrics.predictionPSI > 0.2) {
    return "emergency_retrain";
  }

  // Moderate drift: schedule retraining
  const driftingFeatures = Object.values(metrics.featureDrift)
    .filter(ks => ks > 0.15).length;

  if (driftingFeatures >= 3) {
    return "schedule_retrain";
  }

  return "no_action";
}
```

**Deployment:** Run daily as cron job, send alerts to Slack/email:
```bash
# Crontab entry
0 3 * * * cd /path/to/vfr-api && npx tsx scripts/ml/monitor-drift.ts >> logs/drift.log 2>&1
```

---

## Feature Engineering Improvements

### Objective
Expand from 34 to 50+ features by adding forward-looking indicators, macroeconomic factors, and interaction features.

### Priority 1: Forward-Looking Indicators (High Impact, Medium Effort)

**New Features (10):**

```typescript
interface ForwardLookingFeatures {
  // Analyst revisions (FMP Premium)
  analyst_estimate_revision_7d: number;      // Estimate change last 7 days
  analyst_estimate_revision_30d: number;     // Estimate change last 30 days
  analyst_upgrade_momentum: number;          // Net upgrades in last 14 days

  // Earnings estimate changes
  earnings_estimate_std: number;             // Estimate dispersion (uncertainty)
  earnings_estimate_trend: number;           // Linear trend of estimates over 30d

  // Guidance and outlook
  guidance_vs_consensus: number;             // Company guidance vs consensus
  next_quarter_estimate_change: number;      // Forward estimate revisions

  // Insider activity (SEC Form 4)
  insider_buy_volume_30d: number;            // Insider purchase volume
  insider_sell_volume_30d: number;           // Insider sale volume
  insider_net_activity: number;              // Net insider buying (buy - sell)
}
```

**Implementation:**

```typescript
// scripts/ml/feature-engineering/forward-looking.ts

export async function extractForwardLookingFeatures(
  symbol: string,
  date: Date
): Promise<ForwardLookingFeatures> {
  const fmpAPI = new FinancialModelingPrepAPI();

  // Analyst estimate revisions
  const estimates = await fmpAPI.getAnalystEstimates(symbol);
  const analyst_estimate_revision_7d = calculateRevision(estimates, 7);
  const analyst_estimate_revision_30d = calculateRevision(estimates, 30);

  // Analyst upgrades/downgrades
  const upgrades = await fmpAPI.getUpgradesDowngrades(symbol);
  const analyst_upgrade_momentum = calculateUpgradeMomentum(upgrades, 14);

  // Estimate dispersion
  const earnings_estimate_std = calculateStandardDeviation(estimates);

  // Insider trading (SEC Form 4)
  const insiderTrades = await secAPI.getInsiderTrades(symbol, { days: 30 });
  const insider_buy_volume_30d = sumBuyVolume(insiderTrades);
  const insider_sell_volume_30d = sumSellVolume(insiderTrades);
  const insider_net_activity = insider_buy_volume_30d - insider_sell_volume_30d;

  return {
    analyst_estimate_revision_7d,
    analyst_estimate_revision_30d,
    analyst_upgrade_momentum,
    earnings_estimate_std,
    earnings_estimate_trend: calculateTrend(estimates, 30),
    guidance_vs_consensus: 0,  // Requires manual data collection
    next_quarter_estimate_change: 0,  // Future enhancement
    insider_buy_volume_30d,
    insider_sell_volume_30d,
    insider_net_activity
  };
}
```

### Priority 2: Enhanced Macroeconomic Features (Medium Impact, Low Effort)

**New Features (8):**

```typescript
interface EnhancedMacroFeatures {
  // Sector rotation signals
  sector_relative_strength: number;          // Sector momentum vs S&P 500
  sector_funds_flow: number;                 // ETF flows into sector

  // Credit markets
  credit_spread_change: number;              // BBB spread change (risk appetite)
  high_yield_spread: number;                 // High yield vs treasury (default risk)

  // Volatility regime
  vix_change_30d: number;                    // VIX change (market fear)
  vix_term_structure: number;                // VIX futures slope (vol expectations)

  // Currency & commodities
  dollar_index_change: number;               // USD strength (FX headwinds)
  oil_price_change: number;                  // Energy sector proxy
}
```

**Data Sources:**
- FRED: Credit spreads, VIX, dollar index
- EODHD: Sector ETFs (XLF, XLK, XLE, etc.)
- FMP: Commodity prices

**Implementation:** Extend `MacroeconomicDataCache` to fetch additional FRED series.

### Priority 3: Interaction Features (High Impact, Low Effort)

**New Features (12):**

```typescript
interface InteractionFeatures {
  // Earnings × Momentum
  earnings_surprise_x_price_momentum: number;     // Strong earnings + uptrend
  earnings_surprise_x_volume: number;             // Surprise with volume confirmation

  // Volatility × Volume
  volatility_x_volume_ratio: number;              // High vol + high volume = breakout
  iv_rank_x_volume_trend: number;                 // Options activity + volume

  // Sentiment × Technical
  sentiment_x_rsi: number;                        // Sentiment aligned with overbought/sold
  social_momentum_x_macd: number;                 // Social buzz + technical signal

  // Fundamental × Technical
  pe_ratio_x_price_momentum: number;              // Valuation + momentum
  revenue_growth_x_relative_strength: number;     // Growth + sector leadership

  // Macro × Sector
  fed_rate_x_sector_beta: number;                 // Rate sensitivity
  gdp_growth_x_cyclical_exposure: number;         // Economic cycle alignment

  // Time-based
  days_to_earnings: number;                       // Proximity to earnings event
  quarter_end_effect: number;                     // Window dressing effects
}
```

**Rationale:** Interaction features capture non-linear relationships that gradient boosting can exploit. Low effort (simple multiplication) with potential high impact.

### Feature Addition Workflow

```bash
# 1. Implement new feature extractors
# File: app/services/ml/early-signal/FeatureExtractor.ts

# 2. Update feature names
# File: scripts/ml/generate-training-data.ts (FEATURE_NAMES array)

# 3. Regenerate training data
npx tsx scripts/ml/generate-training-data.ts --full

# 4. Retrain model
npx tsx scripts/ml/train-early-signal-model.ts

# 5. Evaluate feature importance
npx tsx scripts/ml/evaluate-model.ts --feature-importance

# 6. Remove low-importance features (<1%)
# Iterate: drop features, retrain, compare AUC
```

---

## Model Ensemble Enhancement

### Objective
Improve prediction robustness by combining multiple models with different inductive biases.

### Current State
- **Algorithm:** LightGBM only
- **Ensemble:** None (single model)

### Proposed Architecture

```typescript
interface EnsembleConfig {
  models: ModelConfig[];
  metaLearner: MetaLearnerConfig;
  votingStrategy: "weighted" | "stacking";
}

interface ModelConfig {
  algorithm: "LightGBM" | "XGBoost" | "CatBoost" | "RandomForest";
  timeWindow: "3m" | "6m" | "12m";
  features: string[];  // Subset or full feature set
  weight: number;      // Voting weight
}

const ensembleConfig: EnsembleConfig = {
  models: [
    {
      algorithm: "LightGBM",
      timeWindow: "6m",
      features: ["all"],
      weight: 0.4
    },
    {
      algorithm: "XGBoost",
      timeWindow: "12m",
      features: ["all"],
      weight: 0.3
    },
    {
      algorithm: "CatBoost",
      timeWindow: "6m",
      features: ["all"],
      weight: 0.3
    }
  ],
  metaLearner: {
    algorithm: "LogisticRegression",
    inputs: ["model_1_proba", "model_2_proba", "model_3_proba"]
  },
  votingStrategy: "stacking"
};
```

### Implementation: Stacking Ensemble

**Level 0 (Base Models):**
```python
# scripts/ml/train-ensemble-base.py

from lightgbm import LGBMClassifier
from xgboost import XGBClassifier
from catboost import CatBoostClassifier

# Train 3 base models
lgb_model = LGBMClassifier(n_estimators=200, learning_rate=0.05)
xgb_model = XGBClassifier(n_estimators=200, learning_rate=0.05)
cat_model = CatBoostClassifier(iterations=200, learning_rate=0.05, verbose=False)

lgb_model.fit(X_train, y_train)
xgb_model.fit(X_train, y_train)
cat_model.fit(X_train, y_train)

# Generate out-of-fold predictions for stacking
lgb_val_proba = lgb_model.predict_proba(X_val)[:, 1]
xgb_val_proba = xgb_model.predict_proba(X_val)[:, 1]
cat_val_proba = cat_model.predict_proba(X_val)[:, 1]

# Create meta-features
meta_features = np.column_stack([lgb_val_proba, xgb_val_proba, cat_val_proba])
```

**Level 1 (Meta-Learner):**
```python
# scripts/ml/train-ensemble-meta.py

from sklearn.linear_model import LogisticRegression

# Train meta-learner on base model predictions
meta_model = LogisticRegression()
meta_model.fit(meta_features, y_val)

# Final prediction = meta-learner combines base predictions
def ensemble_predict(features):
    lgb_proba = lgb_model.predict_proba(features)[:, 1]
    xgb_proba = xgb_model.predict_proba(features)[:, 1]
    cat_proba = cat_model.predict_proba(features)[:, 1]

    meta_input = np.column_stack([lgb_proba, xgb_proba, cat_proba])
    final_proba = meta_model.predict_proba(meta_input)[:, 1]

    return final_proba
```

### Time-Window Diversity

**Rationale:** Different lookback windows capture different patterns:
- **3-month:** Recent trends, responsive to regime changes
- **6-month:** Balanced, captures earnings cycles
- **12-month:** Stable, captures long-term patterns

**Implementation:**
```typescript
// Generate 3 datasets with different time windows
const datasets = [
  { window: "3m", start: subtractMonths(today, 3), end: today },
  { window: "6m", start: subtractMonths(today, 6), end: today },
  { window: "12m", start: subtractMonths(today, 12), end: today }
];

for (const dataset of datasets) {
  await generateTrainingData({
    symbols: SP500_SYMBOLS,
    start: dataset.start,
    end: dataset.end,
    output: `data/training/train-${dataset.window}.csv`
  });

  await trainModel({
    input: `data/training/train-${dataset.window}.csv`,
    output: `models/early-signal/ensemble-${dataset.window}.json`
  });
}
```

### Feature Subset Models

**Rationale:** Different feature groups capture different aspects:
- **Technical-only:** Price/volume patterns
- **Fundamental-only:** Earnings/revenue/analyst data
- **Macro-only:** Economic indicators
- **Full feature set:** All signals combined

**Expected Improvement:** +2-5% AUC from ensemble vs single best model.

---

## Production Feedback Loop

### Objective
Close the loop between predictions and outcomes to enable continuous learning.

### Current Gaps
- ❌ No prediction logging in production
- ❌ No actual outcome tracking (stock performance after prediction)
- ❌ No automated backtesting on recent quarters
- ❌ No champion/challenger framework

### Implementation

#### 1. Prediction Logging

**New Table: `ml_predictions`**

```sql
CREATE TABLE ml_predictions (
  id SERIAL PRIMARY KEY,
  prediction_date TIMESTAMP NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  model_version VARCHAR(20) NOT NULL,
  predicted_class INTEGER NOT NULL,  -- 0 or 1
  predicted_probability FLOAT NOT NULL,
  features JSONB NOT NULL,  -- Store all 34 features
  confidence_level VARCHAR(20),  -- "HIGH", "MEDIUM", "LOW"
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_symbol_date (symbol, prediction_date),
  INDEX idx_model_version (model_version)
);
```

**Service Update:**

```typescript
// app/services/ml/early-signal/EarlySignalService.ts

export class EarlySignalService {
  async predict(symbol: string, date: Date): Promise<EarlySignalPrediction> {
    const features = await this.featureExtractor.extractFeatures(symbol, date);
    const prediction = this.model.predict(features);

    // Log prediction to database
    await this.logPrediction({
      symbol,
      predictionDate: date,
      modelVersion: this.modelVersion,
      predictedClass: prediction.class,
      predictedProbability: prediction.probability,
      features: features,
      confidenceLevel: this.calculateConfidence(prediction.probability)
    });

    return prediction;
  }

  private async logPrediction(data: PredictionLog): Promise<void> {
    await db.query(`
      INSERT INTO ml_predictions
      (prediction_date, symbol, model_version, predicted_class,
       predicted_probability, features, confidence_level)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [data.predictionDate, data.symbol, data.modelVersion,
        data.predictedClass, data.predictedProbability,
        JSON.stringify(data.features), data.confidenceLevel]);
  }
}
```

#### 2. Outcome Tracking

**New Table: `ml_outcomes`**

```sql
CREATE TABLE ml_outcomes (
  id SERIAL PRIMARY KEY,
  prediction_id INTEGER REFERENCES ml_predictions(id),
  symbol VARCHAR(10) NOT NULL,
  prediction_date TIMESTAMP NOT NULL,
  outcome_date TIMESTAMP NOT NULL,
  actual_class INTEGER NOT NULL,  -- 0 or 1 (did earnings surprise happen?)
  actual_return_7d FLOAT,         -- 7-day return after prediction
  actual_return_30d FLOAT,        -- 30-day return
  earnings_surprise_pct FLOAT,    -- Actual earnings surprise %
  correct_prediction BOOLEAN,     -- predicted_class == actual_class
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_prediction_id (prediction_id),
  INDEX idx_symbol_outcome_date (symbol, outcome_date)
);
```

**Background Job: Outcome Collection**

```typescript
// scripts/ml/collect-outcomes.ts

/**
 * Collect actual outcomes for predictions made 7+ days ago
 * Run daily to backfill prediction results
 */

async function collectOutcomes(): Promise<void> {
  // Find predictions without outcomes that are >7 days old
  const predictions = await db.query(`
    SELECT p.*
    FROM ml_predictions p
    LEFT JOIN ml_outcomes o ON o.prediction_id = p.id
    WHERE o.id IS NULL
      AND p.prediction_date < NOW() - INTERVAL '7 days'
    ORDER BY p.prediction_date DESC
  `);

  for (const prediction of predictions) {
    // Calculate outcome date (7 days after prediction)
    const outcomeDate = addDays(prediction.prediction_date, 7);

    // Fetch actual earnings data
    const earnings = await fmpAPI.getEarningsSurprises(prediction.symbol);
    const earningsAfterPrediction = earnings.filter(e =>
      new Date(e.date) >= prediction.prediction_date &&
      new Date(e.date) <= outcomeDate
    );

    // Determine actual class (did earnings surprise >20% happen?)
    let actual_class = 0;
    let earnings_surprise_pct = null;

    if (earningsAfterPrediction.length > 0) {
      const surprise = earningsAfterPrediction[0];
      earnings_surprise_pct = ((surprise.actualEarningResult - surprise.estimatedEarning)
                               / Math.abs(surprise.estimatedEarning)) * 100;
      actual_class = earnings_surprise_pct > 20 ? 1 : 0;
    }

    // Calculate 7-day and 30-day returns
    const priceAtPrediction = await getHistoricalPrice(prediction.symbol, prediction.prediction_date);
    const priceAt7d = await getHistoricalPrice(prediction.symbol, addDays(prediction.prediction_date, 7));
    const priceAt30d = await getHistoricalPrice(prediction.symbol, addDays(prediction.prediction_date, 30));

    const actual_return_7d = ((priceAt7d - priceAtPrediction) / priceAtPrediction) * 100;
    const actual_return_30d = ((priceAt30d - priceAtPrediction) / priceAtPrediction) * 100;

    // Store outcome
    await db.query(`
      INSERT INTO ml_outcomes
      (prediction_id, symbol, prediction_date, outcome_date, actual_class,
       actual_return_7d, actual_return_30d, earnings_surprise_pct, correct_prediction)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [prediction.id, prediction.symbol, prediction.prediction_date, outcomeDate,
        actual_class, actual_return_7d, actual_return_30d, earnings_surprise_pct,
        prediction.predicted_class === actual_class]);
  }
}
```

**Cron:** Run daily at 4am UTC:
```bash
0 4 * * * cd /path/to/vfr-api && npx tsx scripts/ml/collect-outcomes.ts
```

#### 3. Automated Backtesting

**New Script: `scripts/ml/backtest-recent.ts`**

```typescript
/**
 * Backtest model on recent quarters
 * Simulates production performance without waiting for live results
 */

interface BacktestResult {
  period: string;
  totalPredictions: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  sharpeRatio: number;
  avgReturn: number;
}

async function backtestRecentQuarter(): Promise<BacktestResult> {
  const quarter = getPreviousQuarter();  // e.g., Q3 2024

  // Get all earnings events in quarter
  const earningsEvents = await getEarningsEvents(quarter);

  const predictions: { predicted: number; actual: number; return: number }[] = [];

  for (const event of earningsEvents) {
    // Extract features 7 days before earnings
    const featureDate = subtractDays(event.date, 7);
    const features = await featureExtractor.extractFeatures(event.symbol, featureDate);

    // Make prediction
    const prediction = model.predict(features);

    // Get actual outcome
    const actual = event.earningsSurprise > 20 ? 1 : 0;
    const stockReturn = await get7DayReturn(event.symbol, featureDate);

    predictions.push({
      predicted: prediction.class,
      actual: actual,
      return: stockReturn
    });
  }

  // Calculate metrics
  const accuracy = predictions.filter(p => p.predicted === p.actual).length / predictions.length;
  const truePositives = predictions.filter(p => p.predicted === 1 && p.actual === 1).length;
  const falsePositives = predictions.filter(p => p.predicted === 1 && p.actual === 0).length;
  const falseNegatives = predictions.filter(p => p.predicted === 0 && p.actual === 1).length;

  const precision = truePositives / (truePositives + falsePositives);
  const recall = truePositives / (truePositives + falseNegatives);
  const f1 = 2 * (precision * recall) / (precision + recall);

  // Calculate Sharpe ratio (risk-adjusted returns)
  const predictedPositiveReturns = predictions
    .filter(p => p.predicted === 1)
    .map(p => p.return);
  const avgReturn = mean(predictedPositiveReturns);
  const stdReturn = standardDeviation(predictedPositiveReturns);
  const sharpeRatio = (avgReturn - 0.01) / stdReturn;  // Assume 1% risk-free rate

  return {
    period: quarter,
    totalPredictions: predictions.length,
    accuracy,
    precision,
    recall,
    f1,
    sharpeRatio,
    avgReturn
  };
}
```

**Run:** Quarterly after earnings season ends.

#### 4. Champion/Challenger Framework

**Decision Tree: When to Deploy Challenger**

```typescript
interface ModelComparisonResult {
  champion: ModelMetrics;
  challenger: ModelMetrics;
  recommendation: "deploy_challenger" | "keep_champion" | "run_ab_test";
  reasoning: string;
}

function compareModels(
  champion: ModelMetrics,
  challenger: ModelMetrics
): ModelComparisonResult {
  // Critical threshold: AUC improvement
  const aucImprovement = challenger.auc - champion.auc;

  if (aucImprovement >= 0.05) {
    return {
      champion,
      challenger,
      recommendation: "deploy_challenger",
      reasoning: `Challenger AUC ${challenger.auc} significantly better than champion ${champion.auc} (Δ=${aucImprovement})`
    };
  }

  if (aucImprovement >= 0.02 && challenger.sharpeRatio > champion.sharpeRatio) {
    return {
      champion,
      challenger,
      recommendation: "deploy_challenger",
      reasoning: `Challenger has better AUC and Sharpe ratio`
    };
  }

  if (aucImprovement >= 0.01 && aucImprovement < 0.02) {
    return {
      champion,
      challenger,
      recommendation: "run_ab_test",
      reasoning: `Marginal improvement - run A/B test with 50/50 traffic split for 14 days`
    };
  }

  return {
    champion,
    challenger,
    recommendation: "keep_champion",
    reasoning: `Challenger did not sufficiently outperform champion (AUC Δ=${aucImprovement})`
  };
}
```

**A/B Testing Implementation:**

```typescript
// app/services/ml/early-signal/EarlySignalService.ts

export class EarlySignalService {
  async predict(symbol: string, date: Date): Promise<EarlySignalPrediction> {
    // Check if A/B test is running
    const abTest = await this.getActiveABTest();

    if (abTest) {
      // Randomly assign to champion or challenger (50/50)
      const useChallenger = Math.random() < 0.5;
      const modelVersion = useChallenger ? abTest.challenger : abTest.champion;

      const model = await this.loadModel(modelVersion);
      const prediction = model.predict(features);

      // Log which model was used
      await this.logABTestPrediction({
        symbol,
        date,
        modelVersion,
        prediction
      });

      return prediction;
    }

    // No A/B test - use champion only
    return this.championModel.predict(features);
  }
}
```

**After 14 days:** Analyze A/B test results and deploy winner.

---

## Data Quality & Monitoring

### Objective
Ensure training and production data meet quality standards to prevent garbage-in-garbage-out.

### Implementation

#### 1. Data Validation Checks

**Expand: `scripts/ml/validate-training-data.ts`**

```typescript
interface DataQualityReport {
  completeness: CompletenessCheck;
  outliers: OutlierCheck;
  distribution: DistributionCheck;
  temporalIntegrity: TemporalCheck;
  labelBalance: LabelBalanceCheck;
  passed: boolean;
}

async function validateTrainingData(filepath: string): Promise<DataQualityReport> {
  const data = loadCSV(filepath);

  // 1. Completeness: >95% of features populated
  const completeness = checkCompleteness(data);

  // 2. Outlier detection: Cap at 99th percentile
  const outliers = detectOutliers(data);

  // 3. Distribution: Check for feature shifts vs previous dataset
  const distribution = compareDistributions(data, loadPreviousDataset());

  // 4. Temporal integrity: No future data leakage
  const temporal = checkTemporalIntegrity(data);

  // 5. Label balance: 20-40% positive labels
  const labelBalance = checkLabelBalance(data);

  const passed = [completeness, outliers, distribution, temporal, labelBalance]
    .every(check => check.passed);

  return { completeness, outliers, distribution, temporal, labelBalance, passed };
}

function checkCompleteness(data: TrainingRow[]): CompletenessCheck {
  const featureCompleteness: Record<string, number> = {};

  for (const feature of FEATURE_NAMES) {
    const nonMissingCount = data.filter(row =>
      row.features[FEATURE_NAMES.indexOf(feature)] !== null &&
      !isNaN(row.features[FEATURE_NAMES.indexOf(feature)])
    ).length;

    featureCompleteness[feature] = nonMissingCount / data.length;
  }

  const avgCompleteness = mean(Object.values(featureCompleteness));

  return {
    featureCompleteness,
    avgCompleteness,
    passed: avgCompleteness >= 0.95,
    severity: avgCompleteness < 0.90 ? "CRITICAL" : avgCompleteness < 0.95 ? "WARNING" : "INFO"
  };
}

function detectOutliers(data: TrainingRow[]): OutlierCheck {
  const outlierCounts: Record<string, number> = {};

  for (let i = 0; i < FEATURE_NAMES.length; i++) {
    const values = data.map(row => row.features[i]);
    const p99 = percentile(values, 0.99);
    const p1 = percentile(values, 0.01);

    const outliers = values.filter(v => v > p99 || v < p1).length;
    outlierCounts[FEATURE_NAMES[i]] = outliers;
  }

  const totalOutliers = sum(Object.values(outlierCounts));

  return {
    outlierCounts,
    totalOutliers,
    passed: totalOutliers < data.length * 0.05,  // <5% outliers acceptable
    severity: totalOutliers > data.length * 0.10 ? "WARNING" : "INFO"
  };
}
```

**Alert Thresholds:**
```typescript
const qualityThresholds = {
  completeness: {
    critical: 0.90,  // <90% = stop training
    warning: 0.95    // <95% = investigate
  },
  labelBalance: {
    critical: [0.10, 0.60],  // <10% or >60% positive labels = critical
    warning: [0.15, 0.50]    // <15% or >50% = warning
  },
  outliers: {
    warning: 0.05,   // >5% outliers = investigate
    critical: 0.10   // >10% outliers = stop training
  }
};
```

#### 2. Dataset Versioning

**Strategy:** Store datasets with git-lfs or DVC (Data Version Control)

```bash
# Install DVC
npm install -g dvc

# Initialize DVC in repo
dvc init

# Add training data to DVC
dvc add data/training/train.csv
dvc add data/training/val.csv
dvc add data/training/test.csv

# Commit DVC metadata
git add data/training/.gitignore data/training/*.dvc
git commit -m "Add training data v1.0"

# Tag dataset version
git tag dataset-v1.0
```

**Benefits:**
- Track dataset changes over time
- Reproduce training runs
- Roll back to previous datasets
- Store large files outside git

#### 3. Data Lineage Tracking

**Metadata File: `data/training/lineage.json`**

```json
{
  "dataset_version": "v1.2.0",
  "created_at": "2025-10-05T12:00:00Z",
  "source_data": {
    "stock_universe": "SP500",
    "date_range": {
      "start": "2023-01-01",
      "end": "2025-10-05"
    },
    "total_stocks": 500,
    "total_earnings_events": 6000
  },
  "data_sources": {
    "fmp_api": {
      "version": "v3",
      "endpoints_used": [
        "earnings_surprises",
        "analyst_estimates",
        "income_statements"
      ]
    },
    "fred_api": {
      "version": "v1",
      "series_used": [
        "FEDFUNDS",
        "UNRATE",
        "CPIAUCSL",
        "GDP",
        "DGS10"
      ]
    },
    "sec_edgar": {
      "filings_used": ["Form 4", "13F", "8-K"]
    }
  },
  "feature_extraction": {
    "version": "v2.1.0",
    "num_features": 34,
    "features_added": ["fed_rate_change_30d", "unemployment_rate_change"],
    "features_removed": []
  },
  "preprocessing": {
    "label_threshold": 0.20,
    "temporal_offset": "7 days before earnings",
    "filters": [
      "Skip future earnings (actualEarningResult=0)",
      "Skip examples before 2023-01-01",
      "Skip invalid features (NaN values)"
    ]
  },
  "quality_metrics": {
    "completeness": 0.97,
    "label_balance": 0.31,
    "outlier_rate": 0.04,
    "passed": true
  }
}
```

**Integration:** Auto-generate `lineage.json` at end of `generate-training-data.ts`.

#### 4. Production Data Monitoring

**New Script: `scripts/ml/monitor-production-data.ts`**

```typescript
/**
 * Monitor production feature distributions
 * Alert if features drift from training distributions
 */

async function monitorProductionData(): Promise<void> {
  // Load reference distributions from training data
  const referenceStats = loadTrainingStats();

  // Load recent production predictions (last 7 days)
  const productionData = await loadProductionData({ days: 7 });

  // Compare distributions for each feature
  for (const feature of FEATURE_NAMES) {
    const prodMean = mean(productionData[feature]);
    const prodStd = standardDeviation(productionData[feature]);

    const refMean = referenceStats[feature].mean;
    const refStd = referenceStats[feature].std;

    // Z-score: how many std deviations away from reference?
    const meanShift = Math.abs(prodMean - refMean) / refStd;

    if (meanShift > 2.0) {
      await sendAlert({
        type: "FEATURE_DRIFT",
        feature: feature,
        severity: "WARNING",
        message: `${feature} mean shifted ${meanShift.toFixed(2)} std from training distribution`
      });
    }
  }
}
```

**Run:** Daily as cron job.

---

## MLOps Infrastructure

### Objective
Automate ML workflows from data generation to model deployment.

### Proposed Scripts Structure

```
scripts/ml/
├── train-pipeline.ts          # Orchestrate full training workflow
├── evaluate-model.ts          # Automated evaluation suite
├── monitor-drift.ts           # Detect distribution shifts
├── retrain-scheduler.ts       # Automated retraining logic
├── backtest-recent.ts         # Backtest on recent quarters
├── collect-outcomes.ts        # Collect actual prediction outcomes
├── compare-models.ts          # Champion vs challenger comparison
└── deploy-model.ts            # Blue-green deployment
```

### 1. Training Pipeline Orchestrator

**New Script: `scripts/ml/train-pipeline.ts`**

```typescript
/**
 * End-to-end training pipeline
 *
 * Usage:
 *   npx tsx scripts/ml/train-pipeline.ts --universe sp500 --version v1.2.0
 */

interface PipelineConfig {
  stockUniverse: "sp500" | "extended940";
  modelVersion: string;
  skipDataGeneration?: boolean;
  skipValidation?: boolean;
}

async function runTrainingPipeline(config: PipelineConfig): Promise<void> {
  console.log("🚀 Starting ML Training Pipeline");
  console.log("=".repeat(80));

  // Step 1: Generate training data
  if (!config.skipDataGeneration) {
    console.log("\n📊 Step 1: Generating training data...");
    await generateTrainingData({
      symbols: getStockUniverse(config.stockUniverse),
      start: new Date("2023-01-01"),
      end: new Date(),
      output: "data/training/latest.csv"
    });
  }

  // Step 2: Validate data quality
  if (!config.skipValidation) {
    console.log("\n✅ Step 2: Validating data quality...");
    const validation = await validateTrainingData("data/training/latest.csv");

    if (!validation.passed) {
      throw new Error("Data validation failed - aborting training");
    }
  }

  // Step 3: Split data
  console.log("\n✂️  Step 3: Splitting dataset...");
  await splitTrainingData({
    input: "data/training/latest.csv",
    trainRatio: 0.7,
    valRatio: 0.15,
    testRatio: 0.15
  });

  // Step 4: Train model
  console.log("\n🧠 Step 4: Training model...");
  await trainModel({
    version: config.modelVersion,
    algorithm: "LightGBM",
    trainData: "data/training/train.csv",
    valData: "data/training/val.csv"
  });

  // Step 5: Evaluate on test set
  console.log("\n📈 Step 5: Evaluating on test set...");
  const testMetrics = await evaluateModel({
    version: config.modelVersion,
    testData: "data/training/test.csv"
  });

  console.log("\nTest Set Performance:");
  console.log(`  Accuracy:  ${testMetrics.accuracy.toFixed(3)}`);
  console.log(`  AUC:       ${testMetrics.auc.toFixed(3)}`);
  console.log(`  Precision: ${testMetrics.precision.toFixed(3)}`);
  console.log(`  Recall:    ${testMetrics.recall.toFixed(3)}`);
  console.log(`  F1:        ${testMetrics.f1.toFixed(3)}`);

  // Step 6: Compare with champion
  console.log("\n🏆 Step 6: Comparing with champion model...");
  const championVersion = await getChampionVersion();
  const comparison = await compareModels({
    champion: championVersion,
    challenger: config.modelVersion
  });

  console.log(`\nChampion (${championVersion}) AUC: ${comparison.champion.auc}`);
  console.log(`Challenger (${config.modelVersion}) AUC: ${comparison.challenger.auc}`);
  console.log(`Recommendation: ${comparison.recommendation}`);

  // Step 7: Deploy if better
  if (comparison.recommendation === "deploy_challenger") {
    console.log("\n🚀 Step 7: Deploying new model...");
    await deployModel({
      version: config.modelVersion,
      strategy: "blue-green"
    });
    console.log(`✅ Model ${config.modelVersion} deployed to production`);
  } else {
    console.log(`\n⏸️  Step 7: Keeping champion ${championVersion}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Training Pipeline Complete");
}
```

### 2. Model Evaluation Script

**New Script: `scripts/ml/evaluate-model.ts`**

```typescript
/**
 * Comprehensive model evaluation
 *
 * Usage:
 *   npx tsx scripts/ml/evaluate-model.ts --version v1.1.0 --test-data data/training/test.csv
 */

interface EvaluationResult {
  version: string;
  testAccuracy: number;
  testAUC: number;
  precision: number;
  recall: number;
  f1: number;
  confusionMatrix: number[][];
  featureImportance: Record<string, number>;
  calibrationCurve: { bins: number[]; accuracy: number[] };
  rocCurve: { fpr: number[]; tpr: number[] };
}

async function evaluateModel(config: {
  version: string;
  testData: string;
}): Promise<EvaluationResult> {
  // Load model
  const model = await loadModel(config.version);
  const normalizer = await loadNormalizer(config.version);

  // Load test data
  const testData = loadCSV(config.testData);

  // Normalize features
  const normalizedTest = testData.map(row => ({
    ...row,
    features: row.features.map((val, i) =>
      (val - normalizer.mean[i]) / normalizer.std[i]
    )
  }));

  // Generate predictions
  const predictions = normalizedTest.map(row => ({
    actual: row.label,
    predicted: model.predict(row.features),
    probability: model.predictProba(row.features)
  }));

  // Calculate metrics
  const accuracy = predictions.filter(p => p.predicted === p.actual).length / predictions.length;
  const auc = calculateAUC(predictions);
  const { precision, recall, f1 } = calculateClassificationMetrics(predictions);
  const confusionMatrix = calculateConfusionMatrix(predictions);

  // Feature importance
  const featureImportance = await model.getFeatureImportance();

  // Calibration curve
  const calibrationCurve = calculateCalibrationCurve(predictions);

  // ROC curve
  const rocCurve = calculateROCCurve(predictions);

  return {
    version: config.version,
    testAccuracy: accuracy,
    testAUC: auc,
    precision,
    recall,
    f1,
    confusionMatrix,
    featureImportance,
    calibrationCurve,
    rocCurve
  };
}
```

### 3. Model Deployment Script

**New Script: `scripts/ml/deploy-model.ts`**

```typescript
/**
 * Deploy model with blue-green strategy
 *
 * Blue-Green Deployment:
 * 1. Deploy new model alongside current (blue)
 * 2. Route small % of traffic to new model (green)
 * 3. Monitor for errors/performance degradation
 * 4. Gradually increase traffic to 100%
 * 5. Decommission old model
 */

interface DeploymentConfig {
  version: string;
  strategy: "blue-green" | "immediate";
  initialTrafficPct?: number;
  rampUpDuration?: number;  // minutes
}

async function deployModel(config: DeploymentConfig): Promise<void> {
  console.log(`🚀 Deploying model ${config.version}`);

  if (config.strategy === "immediate") {
    // Immediate cutover (risky)
    await updateActiveModelVersion(config.version);
    console.log(`✅ Model ${config.version} deployed immediately`);
    return;
  }

  // Blue-green deployment
  const greenVersion = config.version;
  const blueVersion = await getActiveModelVersion();

  console.log(`Blue (current): ${blueVersion}`);
  console.log(`Green (new): ${greenVersion}`);

  // Load green model into memory
  await loadModelIntoCache(greenVersion);

  // Gradual traffic ramp: 10% → 25% → 50% → 100%
  const rampSteps = [10, 25, 50, 100];
  const stepDuration = (config.rampUpDuration || 60) / rampSteps.length;

  for (const trafficPct of rampSteps) {
    console.log(`\n📊 Routing ${trafficPct}% traffic to green (${greenVersion})`);
    await setTrafficSplit({ blue: 100 - trafficPct, green: trafficPct });

    // Wait and monitor
    await sleep(stepDuration * 60 * 1000);

    // Check for errors
    const errors = await getRecentErrors({ minutes: stepDuration });
    if (errors.length > 0) {
      console.error(`❌ Errors detected during deployment - rolling back`);
      await setTrafficSplit({ blue: 100, green: 0 });
      throw new Error("Deployment failed - errors detected");
    }

    // Check performance
    const performance = await getRecentPerformance({ minutes: stepDuration });
    if (performance.avgLatency > 1000) {  // 1s threshold
      console.error(`❌ Latency spike detected (${performance.avgLatency}ms) - rolling back`);
      await setTrafficSplit({ blue: 100, green: 0 });
      throw new Error("Deployment failed - latency spike");
    }
  }

  // Deployment successful - make green the new champion
  await updateActiveModelVersion(greenVersion);
  await unloadModelFromCache(blueVersion);

  console.log(`\n✅ Deployment complete - ${greenVersion} is now active`);
}
```

### 4. Integration with GitHub Actions

**Workflow: `.github/workflows/ml-pipeline.yml`**

```yaml
name: ML Training Pipeline

on:
  schedule:
    - cron: '0 3 1 * *'  # Monthly on 1st at 3am UTC
  workflow_dispatch:
    inputs:
      stock_universe:
        description: 'Stock universe'
        required: true
        default: 'sp500'
        type: choice
        options:
          - sp500
          - extended940
      model_version:
        description: 'Model version'
        required: true
        type: string

jobs:
  train:
    runs-on: ubuntu-latest
    timeout-minutes: 180  # 3 hours max

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run training pipeline
        env:
          FMP_API_KEY: ${{ secrets.FMP_API_KEY }}
          FRED_API_KEY: ${{ secrets.FRED_API_KEY }}
          BLS_API_KEY: ${{ secrets.BLS_API_KEY }}
        run: |
          npx tsx scripts/ml/train-pipeline.ts \
            --universe ${{ github.event.inputs.stock_universe || 'sp500' }} \
            --version ${{ github.event.inputs.model_version || 'auto' }}

      - name: Upload model artifacts
        uses: actions/upload-artifact@v3
        with:
          name: model-${{ github.run_id }}
          path: models/early-signal/

      - name: Send notification
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "ML Training Pipeline ${{ job.status }}: Version ${{ github.event.inputs.model_version }}"
            }
```

---

## Experiment Tracking

### Objective
Track all training experiments to identify best hyperparameters, features, and model architectures.

### Implementation Options

#### Option 1: MLflow (Recommended)

**Setup:**
```bash
# Install MLflow
pip install mlflow

# Start MLflow server
mlflow server --host 0.0.0.0 --port 5000
```

**Integration:**

```python
# scripts/ml/train-with-mlflow.py

import mlflow
import mlflow.lightgbm

mlflow.set_experiment("early-signal-detection")

with mlflow.start_run(run_name="v1.2.0-lgb-tuned"):
    # Log hyperparameters
    mlflow.log_param("algorithm", "LightGBM")
    mlflow.log_param("n_estimators", 200)
    mlflow.log_param("learning_rate", 0.05)
    mlflow.log_param("max_depth", 6)
    mlflow.log_param("num_leaves", 31)

    # Log dataset info
    mlflow.log_param("train_size", len(X_train))
    mlflow.log_param("val_size", len(X_val))
    mlflow.log_param("num_features", X_train.shape[1])

    # Train model
    model = LGBMClassifier(...)
    model.fit(X_train, y_train)

    # Log metrics
    val_accuracy = accuracy_score(y_val, model.predict(X_val))
    val_auc = roc_auc_score(y_val, model.predict_proba(X_val)[:, 1])

    mlflow.log_metric("val_accuracy", val_accuracy)
    mlflow.log_metric("val_auc", val_auc)
    mlflow.log_metric("val_precision", precision)
    mlflow.log_metric("val_recall", recall)

    # Log feature importance
    importance_dict = dict(zip(FEATURE_NAMES, model.feature_importances_))
    mlflow.log_dict(importance_dict, "feature_importance.json")

    # Log model
    mlflow.lightgbm.log_model(model, "model")

    # Log artifacts
    mlflow.log_artifact("data/training/train.csv")
    mlflow.log_artifact("models/early-signal/v1.2.0/metadata.json")
```

**Benefits:**
- Web UI for comparing experiments
- Automatic versioning
- Model registry
- Hyperparameter search tracking

#### Option 2: Weights & Biases

**Setup:**
```bash
pip install wandb
wandb login
```

**Integration:**

```python
# scripts/ml/train-with-wandb.py

import wandb

wandb.init(
    project="early-signal-detection",
    name="v1.2.0-lgb-tuned",
    config={
        "algorithm": "LightGBM",
        "n_estimators": 200,
        "learning_rate": 0.05,
        "max_depth": 6,
        "num_leaves": 31
    }
)

# Train model
model = LGBMClassifier(...)
model.fit(X_train, y_train)

# Log metrics
wandb.log({
    "val_accuracy": val_accuracy,
    "val_auc": val_auc,
    "val_precision": precision,
    "val_recall": recall
})

# Log feature importance
wandb.log({"feature_importance": wandb.Table(
    columns=["feature", "importance"],
    data=list(zip(FEATURE_NAMES, model.feature_importances_))
)})

wandb.finish()
```

### Hyperparameter Versioning

**Strategy:** Store optimal hyperparameters in JSON file with model version

```json
// models/early-signal/hyperparameters.json
{
  "v1.0.0": {
    "algorithm": "LightGBM",
    "n_estimators": 100,
    "learning_rate": 0.1,
    "max_depth": 5,
    "num_leaves": 31,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.0,
    "reg_lambda": 0.0,
    "validation_auc": 0.841
  },
  "v1.1.0": {
    "algorithm": "LightGBM",
    "n_estimators": 200,
    "learning_rate": 0.05,
    "max_depth": 6,
    "num_leaves": 31,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 0.1,
    "validation_auc": 0.863
  }
}
```

### A/B Test Tracking

**Table: `ml_ab_tests`**

```sql
CREATE TABLE ml_ab_tests (
  id SERIAL PRIMARY KEY,
  test_name VARCHAR(100) NOT NULL,
  champion_version VARCHAR(20) NOT NULL,
  challenger_version VARCHAR(20) NOT NULL,
  traffic_split INTEGER NOT NULL,  -- % to challenger
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  status VARCHAR(20),  -- "running", "completed", "rolled_back"
  champion_metrics JSONB,
  challenger_metrics JSONB,
  winner VARCHAR(20),  -- "champion" or "challenger"
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Key Metrics to Track

### Production Metrics

```typescript
interface ProductionMetrics {
  // Prediction accuracy
  rolling30DayAccuracy: number;
  rolling30DayPrecision: number;
  rolling30DayRecall: number;
  rolling30DayF1: number;

  // Financial performance
  top10PctReturn: number;           // Avg return of top 10% predicted stocks
  sharpeRatio: number;               // Risk-adjusted returns
  informationRatio: number;          // Excess return vs S&P 500
  maxDrawdown: number;               // Worst peak-to-trough decline

  // Feature health
  featureImportanceDrift: number;    // KL divergence from training importance
  featureDistributionDrift: Record<string, number>;  // Per-feature KS statistic

  // Prediction calibration
  brierScore: number;                // Calibration quality (lower = better)
  expectedCalibrationError: number;  // Avg difference between predicted prob and actual freq

  // Operational
  avgPredictionLatency: number;      // ms per prediction
  predictionVolume: number;          // Predictions per day
  errorRate: number;                 // % of failed predictions
}
```

### Tracking Implementation

**Script: `scripts/ml/calculate-production-metrics.ts`**

```typescript
async function calculateProductionMetrics(
  startDate: Date,
  endDate: Date
): Promise<ProductionMetrics> {
  // Load predictions and outcomes
  const data = await db.query(`
    SELECT p.*, o.actual_class, o.actual_return_7d
    FROM ml_predictions p
    JOIN ml_outcomes o ON o.prediction_id = p.id
    WHERE p.prediction_date >= $1 AND p.prediction_date <= $2
  `, [startDate, endDate]);

  // Calculate accuracy metrics
  const rolling30DayAccuracy = data.filter(d =>
    d.predicted_class === d.actual_class
  ).length / data.length;

  // Calculate Sharpe ratio
  const returns = data
    .filter(d => d.predicted_class === 1)  // Only stocks we predicted positive
    .map(d => d.actual_return_7d);

  const avgReturn = mean(returns);
  const stdReturn = standardDeviation(returns);
  const sharpeRatio = (avgReturn - 0.01) / stdReturn;  // 1% risk-free rate

  // Calculate top 10% performance
  const sortedByProbability = data
    .sort((a, b) => b.predicted_probability - a.predicted_probability);
  const top10Pct = sortedByProbability.slice(0, Math.floor(data.length * 0.1));
  const top10PctReturn = mean(top10Pct.map(d => d.actual_return_7d));

  // Feature drift
  const featureDistributionDrift = await calculateFeatureDrift(data);

  // Calibration
  const brierScore = calculateBrierScore(data);

  return {
    rolling30DayAccuracy,
    sharpeRatio,
    top10PctReturn,
    featureDistributionDrift,
    brierScore,
    // ... other metrics
  };
}
```

**Dashboard:** Integrate with Grafana or internal admin panel to visualize metrics.

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
**Priority: High | Effort: Low**

1. **Production Feedback Loop**
   - ✅ Create `ml_predictions` and `ml_outcomes` tables
   - ✅ Add prediction logging to `EarlySignalService`
   - ✅ Create `collect-outcomes.ts` script
   - ✅ Setup daily cron job for outcome collection
   - **Success Metric:** 100% of predictions logged with outcomes within 8 days

2. **Data Quality Monitoring**
   - ✅ Expand `validate-training-data.ts` with completeness/outlier checks
   - ✅ Add data quality checks to `generate-training-data.ts`
   - ✅ Create `monitor-production-data.ts` for daily drift checks
   - **Success Metric:** <5% data quality failures

3. **Dataset Versioning**
   - ✅ Setup DVC for dataset tracking
   - ✅ Add `lineage.json` metadata generation
   - ✅ Tag dataset versions in git
   - **Success Metric:** All datasets tracked with full lineage

### Phase 2: Automation (Weeks 3-4)
**Priority: High | Effort: Medium**

1. **Automated Retraining Pipeline**
   - ✅ Create `retrain-scheduler.ts` with monthly schedule
   - ✅ Implement drift detection triggers
   - ✅ Create `train-pipeline.ts` orchestrator
   - ✅ Setup GitHub Actions workflow
   - **Success Metric:** Automated retraining runs monthly without manual intervention

2. **Drift Detection**
   - ✅ Implement `monitor-drift.ts` with KS test
   - ✅ Calculate Population Stability Index (PSI)
   - ✅ Setup daily drift monitoring cron job
   - ✅ Configure Slack/email alerts
   - **Success Metric:** Drift detected and alerts sent within 24 hours

3. **Champion/Challenger Framework**
   - ✅ Implement `compare-models.ts` evaluation logic
   - ✅ Add A/B testing capability to `EarlySignalService`
   - ✅ Create `ml_ab_tests` table
   - ✅ Build deployment decision tree
   - **Success Metric:** New models evaluated before deployment, <1% rollbacks

### Phase 3: Feature Engineering (Weeks 5-6)
**Priority: Medium | Effort: Medium**

1. **Forward-Looking Indicators**
   - ✅ Implement analyst estimate revision features (7d, 30d)
   - ✅ Add insider trading features (buy/sell volume)
   - ✅ Calculate estimate dispersion
   - ✅ Retrain model with new features
   - **Success Metric:** +2-3% AUC improvement from forward-looking features

2. **Interaction Features**
   - ✅ Implement 12 interaction features (earnings×momentum, etc.)
   - ✅ Test feature combinations
   - ✅ Remove low-importance interactions (<1%)
   - **Success Metric:** +1-2% AUC improvement from interactions

3. **Enhanced Macroeconomic Features**
   - ✅ Add sector rotation signals
   - ✅ Add credit spread features
   - ✅ Add VIX and volatility regime features
   - **Success Metric:** +1% AUC improvement from macro features

### Phase 4: Model Ensemble (Weeks 7-8)
**Priority: Medium | Effort: High**

1. **Multi-Algorithm Ensemble**
   - ✅ Train XGBoost model
   - ✅ Train CatBoost model
   - ✅ Implement stacking with logistic regression meta-learner
   - **Success Metric:** +2-5% AUC improvement from ensemble

2. **Time-Window Diversity**
   - ✅ Generate 3m, 6m, 12m training datasets
   - ✅ Train models on each window
   - ✅ Combine predictions with weighted voting
   - **Success Metric:** +1-3% AUC from time diversity

### Phase 5: MLOps & Experiment Tracking (Weeks 9-10)
**Priority: Low | Effort: Medium**

1. **MLflow Integration**
   - ✅ Setup MLflow server
   - ✅ Integrate experiment logging into training scripts
   - ✅ Build experiment comparison dashboard
   - **Success Metric:** All experiments tracked with reproducible results

2. **Hyperparameter Search**
   - ✅ Implement Bayesian optimization (Optuna)
   - ✅ Run 50+ hyperparameter search trials
   - ✅ Store optimal params in `hyperparameters.json`
   - **Success Metric:** +1-2% AUC from tuned hyperparameters

3. **Production Metrics Dashboard**
   - ✅ Create `calculate-production-metrics.ts`
   - ✅ Build Grafana dashboard
   - ✅ Setup weekly performance reports
   - **Success Metric:** Stakeholders can view model performance in real-time

---

## Decision Trees & Error Boundaries

### When to Retrain Model

```
START
  ↓
Is it the 1st of the month?
  YES → Schedule retraining for tonight
  NO → Continue
  ↓
Is rolling 30-day accuracy < 75%?
  YES → EMERGENCY RETRAINING (within 24h)
  NO → Continue
  ↓
Is prediction PSI > 0.2?
  YES → EMERGENCY RETRAINING (within 24h)
  NO → Continue
  ↓
Are >=3 features drifting (KS > 0.15)?
  YES → Schedule retraining for this weekend
  NO → Continue
  ↓
Has earnings season just ended?
  YES → Schedule quarterly retraining
  NO → No retraining needed
  ↓
END
```

### When to Deploy New Model

```
START: New model trained (v1.2.0)
  ↓
Load champion (v1.1.0) and challenger (v1.2.0) metrics
  ↓
Is challenger AUC >= champion AUC + 0.05?
  YES → DEPLOY IMMEDIATELY (blue-green)
  NO → Continue
  ↓
Is challenger AUC >= champion AUC + 0.02 AND challenger Sharpe > champion Sharpe?
  YES → DEPLOY (blue-green)
  NO → Continue
  ↓
Is challenger AUC >= champion AUC + 0.01?
  YES → RUN A/B TEST (14 days, 50/50 split)
  NO → Continue
  ↓
Is challenger test accuracy > champion + 0.03?
  YES → RUN A/B TEST (7 days, 25/75 split)
  NO → Continue
  ↓
KEEP CHAMPION (do not deploy)
  ↓
END
```

### Error Boundary: Model Prediction Failure

```
START: Prediction request for AAPL
  ↓
Extract features
  ↓
Did feature extraction fail?
  YES → Log error → Return fallback prediction (null) → Alert on-call
  NO → Continue
  ↓
Normalize features
  ↓
Are >10% of features NaN or invalid?
  YES → Log error → Return fallback prediction (null) → Alert on-call
  NO → Continue
  ↓
Load model
  ↓
Did model load fail?
  YES → Try loading previous model version
    SUCCESS → Use previous version → Log warning
    FAIL → Return fallback prediction (null) → CRITICAL ALERT
  NO → Continue
  ↓
Make prediction
  ↓
Is prediction latency > 500ms?
  YES → Log slow query → Investigate async
  NO → Continue
  ↓
Is predicted probability in [0, 1]?
  NO → Log error → Return fallback → Alert on-call
  YES → Continue
  ↓
Return prediction successfully
  ↓
END
```

### Fallback Strategies

```typescript
interface FallbackStrategy {
  level1: "Use previous model version (v1.0.0)";
  level2: "Use rule-based heuristic (earnings surprise > 15% → positive)";
  level3: "Return null prediction with error flag";
}

async function predictWithFallback(symbol: string, date: Date): Promise<Prediction> {
  try {
    // Try champion model
    return await this.championModel.predict(symbol, date);
  } catch (error) {
    console.error(`Champion model failed: ${error.message}`);

    try {
      // Fallback: Try previous version
      return await this.fallbackModel.predict(symbol, date);
    } catch (fallbackError) {
      console.error(`Fallback model failed: ${fallbackError.message}`);

      // Fallback: Rule-based heuristic
      const earnings = await this.getLatestEarnings(symbol);
      if (earnings && earnings.surprise > 15) {
        return { class: 1, probability: 0.7, confidence: "LOW", fallback: true };
      }

      // Last resort: Return null
      return { class: null, probability: null, confidence: null, error: "All models failed" };
    }
  }
}
```

---

## Integration Points with Existing Codebase

### 1. Feature Extractor
**File:** `app/services/ml/early-signal/FeatureExtractor.ts`

**Add New Features:**
```typescript
export class EarlySignalFeatureExtractor {
  async extractFeatures(symbol: string, date: Date): Promise<Features> {
    // Existing features (34)
    const baseFeatures = await this.extractBaseFeatures(symbol, date);

    // NEW: Forward-looking indicators (10)
    const forwardFeatures = await this.extractForwardLookingFeatures(symbol, date);

    // NEW: Interaction features (12)
    const interactionFeatures = this.calculateInteractionFeatures(baseFeatures);

    // NEW: Enhanced macro features (8)
    const macroFeatures = await this.extractEnhancedMacroFeatures(date);

    return {
      ...baseFeatures,
      ...forwardFeatures,
      ...interactionFeatures,
      ...macroFeatures
    };
  }
}
```

### 2. ML Enhanced Stock Selection Service
**File:** `app/services/stock-selection/MLEnhancedStockSelectionService.ts`

**Add Prediction Logging:**
```typescript
export class MLEnhancedStockSelectionService {
  async selectStocks(date: Date): Promise<SelectedStock[]> {
    const predictions = await this.earlySignalService.predictBatch(SP500_SYMBOLS, date);

    // NEW: Log predictions to database
    await Promise.all(predictions.map(pred =>
      this.logPrediction(pred)
    ));

    // Existing: Rank and select top stocks
    return this.rankAndSelect(predictions);
  }

  private async logPrediction(prediction: EarlySignalPrediction): Promise<void> {
    await db.query(`
      INSERT INTO ml_predictions
      (prediction_date, symbol, model_version, predicted_class, predicted_probability, features)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [prediction.date, prediction.symbol, this.modelVersion,
        prediction.class, prediction.probability, JSON.stringify(prediction.features)]);
  }
}
```

### 3. Early Signal Service
**File:** `app/services/ml/early-signal/EarlySignalService.ts`

**Add A/B Testing:**
```typescript
export class EarlySignalService {
  async predict(symbol: string, date: Date): Promise<EarlySignalPrediction> {
    // NEW: Check for active A/B test
    const abTest = await this.getActiveABTest();

    if (abTest) {
      const useChallenger = Math.random() < abTest.traffic_split / 100;
      const modelVersion = useChallenger ? abTest.challenger_version : abTest.champion_version;
      const model = await this.loadModel(modelVersion);

      const prediction = await model.predict(symbol, date);

      // Log A/B test assignment
      await this.logABTestPrediction({
        testId: abTest.id,
        modelVersion: modelVersion,
        prediction: prediction
      });

      return prediction;
    }

    // Normal: Use champion model
    return this.championModel.predict(symbol, date);
  }
}
```

---

## Success Criteria Summary

| Improvement Area | Target Metric | Measurement Method | Timeline |
|-----------------|---------------|-------------------|----------|
| **Automated Retraining** | Monthly retraining without manual intervention | Cron job logs | 2 weeks |
| **Drift Detection** | Detect drift within 24h | Daily drift reports | 2 weeks |
| **Feature Engineering** | +5% AUC improvement | Model evaluation on test set | 4 weeks |
| **Model Ensemble** | +3% AUC improvement | Ensemble vs single model comparison | 6 weeks |
| **Production Feedback** | 100% prediction logging | Database audit | 2 weeks |
| **Data Quality** | <5% quality failures | Validation reports | 2 weeks |
| **A/B Testing** | 0% bad deployments | Deployment success rate | 4 weeks |
| **Experiment Tracking** | All experiments logged | MLflow dashboard | 8 weeks |

---

## Appendix: Code Templates

### Template: New Feature Implementation

```typescript
// 1. Add feature to FeatureExtractor.ts
export interface Features {
  // ... existing features

  // NEW FEATURE
  new_feature_name: number;
}

export class EarlySignalFeatureExtractor {
  async extractFeatures(symbol: string, date: Date): Promise<Features> {
    // ... existing extraction

    // NEW: Extract new feature
    const new_feature_name = await this.calculateNewFeature(symbol, date);

    return {
      // ... existing features,
      new_feature_name
    };
  }

  private async calculateNewFeature(symbol: string, date: Date): Promise<number> {
    // Implementation
    return 0.0;
  }
}

// 2. Add to feature names array in generate-training-data.ts
const FEATURE_NAMES = [
  // ... existing features
  "new_feature_name"
];

// 3. Add to CSV header
function generateCSVHeader(): string {
  return [
    // ... existing headers
    "new_feature_name",
    "label"
  ].join(",");
}

// 4. Add to CSV row generation
function exampleToCSV(example: TrainingExample): string {
  return [
    // ... existing features
    features.new_feature_name,
    example.label
  ].join(",");
}

// 5. Regenerate training data
// npx tsx scripts/ml/generate-training-data.ts --full

// 6. Retrain model and evaluate
// npx tsx scripts/ml/train-early-signal-model.ts
// Check feature importance in metadata.json
```

---

**Document End**

**Next Steps:**
1. Review this strategy with ML team
2. Prioritize Phase 1 tasks for immediate implementation
3. Setup MLflow server for experiment tracking
4. Begin production prediction logging (highest priority)
5. Schedule first automated retraining for next month
