# Early Signal Detection - Reality Plan

**Created**: 2025-10-01
**Status**: Active
**Goal**: Make `docs/user-guides/early-signal-detection.md` represent REALITY, not vision
**Timeline**: 8-12 hours of focused work

---

## Current State Assessment

### ✅ What Works (Infrastructure)
- EarlySignalService (349 lines) - production-ready
- FeatureExtractor (436 lines) - all 13 features working
- FeatureNormalizer (140 lines) - fit/transform/save/load working
- API Integration complete - /api/stocks/select endpoint ready
- Training infrastructure - ModelTrainer (755 lines), ModelEvaluator (688 lines)
- Training scripts - generate-training-data.ts, validate-training-data.ts
- Test coverage >90% across all components

### ❌ What's Broken (Reality Gap)
- **CRITICAL**: Training data has mostly ZERO values (old bug, never regenerated)
- **CRITICAL**: Model is a placeholder (hardcoded weights, not trained)
- **CRITICAL**: No real performance metrics (precision/recall/AUC unknown)
- **CRITICAL**: User guide makes claims we can't deliver yet

### 📊 Training Data Analysis
```csv
Current: AAPL,2022-01-27,0,0,0,1,0,0.5,0.33,0.82,0,0,0,0,0,1
              └─ 9 of 13 features are ZERO (momentum/volume broken)

Expected: AAPL,2022-01-27,0.02,-0.04,0.08,1.15,0.03,0.5,0.33,0.82,5.2,3.1,10,2.3,-0.15,1
               └─ All 13 features with real values
```

**Root Cause**: Training data generated BEFORE historical OHLC bug fix (Phase 1)

---

## The Vision (User Guide Goals)

From `docs/user-guides/early-signal-detection.md`:

### Performance Targets
- **Precision**: 65-75% @ high confidence (>65%)
- **Recall**: 40-50% @ high confidence
- **AUC**: 0.72-0.80
- **Latency**: <100ms with cache, <5s without
- **Horizon**: 2-week analyst upgrade predictions

### Feature Claims
- 13-feature ML system (momentum, volume, sentiment, fundamentals, technical)
- LightGBM gradient boosting model
- Confidence-calibrated predictions
- Historical accuracy validation
- Production-grade infrastructure

### User Experience
- High-confidence predictions only (filter 35-65% uncertain range)
- Human-readable reasoning from top features
- Feature importance rankings
- Real-world use cases validated

---

## Reality Plan - 10 Steps to Truth

### Phase 1: Clean Data Foundation (3-4 hours)

#### Step 1: Regenerate Training Data ⚡ CRITICAL
**Task**: Generate fresh training data with FIXED FeatureExtractor
**Command**:
```bash
# Start with 10 high-volume symbols for quick validation
npx tsx scripts/ml/generate-training-data.ts \
  --symbols TSLA,NVDA,AAPL,MSFT,GOOGL,AMZN,META,NFLX,AMD,PLTR \
  --output data/training/early-signal-v2.csv

# Expected output: ~600 examples (10 symbols × 60 quarters)
```

**Success Criteria**:
- All 13 features populated (no zeros for momentum/volume)
- 600+ examples generated
- Label balance 10-50% positive
- No NaN values
- Chronological ordering verified

**Validation**:
```bash
npx tsx scripts/ml/validate-training-data.ts \
  --input data/training/early-signal-v2.csv
```

**Time**: 2 hours (API rate limits, 200ms between calls)

---

#### Step 2: Data Quality Validation
**Task**: Verify all features showing real variation
**Script**:
```bash
# Check feature statistics
npx tsx scripts/ml/test-all-13-features.ts

# Expected: All features non-zero with realistic ranges
# price_change_20d: -20% to +30%
# volume_ratio: 0.5 to 2.5
# earnings_surprise: -50% to +100%
# etc.
```

**Success Criteria**:
- Feature completeness: 100% (no zeros except neutral cases)
- Feature variation: All features showing realistic distributions
- Outlier detection: <1% extreme values
- Temporal leakage: NONE (chronological order maintained)

**Time**: 30 minutes

---

#### Step 3: Train/Val/Test Split
**Task**: Create clean temporal splits
**Command**:
```bash
npx tsx scripts/ml/split-training-data.ts \
  --input data/training/early-signal-v2.csv \
  --output data/training/v2/

# Split strategy:
# Train: 2022-01-01 to 2024-06-30 (83.3%)
# Val: 2024-07-01 to 2024-09-30 (8.3%)
# Test: 2024-10-01 to 2024-12-31 (8.3%)
```

**Success Criteria**:
- No temporal overlap
- Chronological ordering maintained
- Train: ~500 examples, Val: ~50, Test: ~50

**Time**: 15 minutes

---

### Phase 2: Model Training (2-3 hours)

#### Step 4: Install LightGBM Dependency
**Task**: Add ML library to project
**Command**:
```bash
npm install lightgbm3 --save

# Verify installation
node -e "const lgb = require('lightgbm3'); console.log('LightGBM OK')"
```

**Fallback**: If LightGBM installation fails (common on macOS), use logistic regression
- Simpler model, faster training
- Still production-ready
- Easier to interpret
- Good for MVP

**Time**: 15 minutes (or 1 hour if troubleshooting needed)

---

#### Step 5: Train Model Using ModelTrainer
**Task**: Use existing infrastructure to train LightGBM model
**Script**: Create `scripts/ml/train-early-signal-model.ts`

```typescript
import { ModelTrainer } from '@/app/services/ml/models/ModelTrainer'
import { FeatureNormalizer } from '@/app/services/ml/early-signal/FeatureNormalizer'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'

async function trainEarlySignalModel() {
  console.log('Training Early Signal Detection Model...')

  // Load training data
  const trainData = parse(fs.readFileSync('data/training/v2/train.csv', 'utf-8'), {
    columns: true,
    skip_empty_lines: true
  })

  const valData = parse(fs.readFileSync('data/training/v2/val.csv', 'utf-8'), {
    columns: true,
    skip_empty_lines: true
  })

  // Prepare feature matrix and labels
  const featureNames = [
    'price_change_5d', 'price_change_10d', 'price_change_20d',
    'volume_ratio', 'volume_trend',
    'sentiment_news_delta', 'sentiment_reddit_accel', 'sentiment_options_shift',
    'earnings_surprise', 'revenue_growth_accel', 'analyst_coverage_change',
    'rsi_momentum', 'macd_histogram_trend'
  ]

  const trainFeatures = trainData.map(row =>
    featureNames.map(f => parseFloat(row[f]))
  )
  const trainLabels = trainData.map(row => parseInt(row.label))

  const valFeatures = valData.map(row =>
    featureNames.map(f => parseFloat(row[f]))
  )
  const valLabels = valData.map(row => parseInt(row.label))

  // Normalize features
  const normalizer = new FeatureNormalizer()
  const trainFeaturesNorm = normalizer.fitTransform(trainFeatures.map(f =>
    Object.fromEntries(featureNames.map((name, i) => [name, f[i]]))
  ))

  const valFeaturesNorm = valFeatures.map(f =>
    normalizer.transform(Object.fromEntries(featureNames.map((name, i) => [name, f[i]])))
  )

  // Save normalizer parameters
  fs.writeFileSync(
    'models/early-signal/v1.0.0/normalizer.json',
    JSON.stringify({
      version: '1.0.0',
      params: normalizer.getParams(),
      trained_date: new Date().toISOString()
    }, null, 2)
  )

  // Train LightGBM model
  const lgb = require('lightgbm3')

  const config = {
    task: 'train',
    objective: 'binary',
    metric: ['binary_logloss', 'auc', 'binary_error'],
    num_leaves: 31,
    learning_rate: 0.05,
    feature_fraction: 0.8,
    bagging_fraction: 0.8,
    bagging_freq: 5,
    verbose: 1,
    num_iterations: 200,
    early_stopping_round: 20
  }

  console.log('Training LightGBM model...')
  const model = await lgb.train(config, {
    data: trainFeaturesNorm,
    labels: trainLabels
  }, {
    validationData: valFeaturesNorm,
    validationLabels: valLabels
  })

  // Save model
  model.save('models/early-signal/v1.0.0/model.txt')

  // Calculate feature importance
  const importance = model.featureImportance()
  const featureImportance = Object.fromEntries(
    featureNames.map((name, i) => [name, importance[i]])
  )

  // Save model metadata
  fs.writeFileSync(
    'models/early-signal/v1.0.0/model.json',
    JSON.stringify({
      version: '1.0.0',
      algorithm: 'lightgbm',
      trained_date: new Date().toISOString(),
      training_examples: trainData.length,
      validation_examples: valData.length,
      feature_importance: featureImportance,
      config
    }, null, 2)
  )

  console.log('✅ Model trained successfully!')
  console.log('Feature Importance:', featureImportance)
}

trainEarlySignalModel().catch(console.error)
```

**Success Criteria**:
- Model trains without errors
- Validation loss decreases
- Early stopping triggers (prevents overfitting)
- Model saved to `models/early-signal/v1.0.0/model.txt`
- Normalizer saved to `models/early-signal/v1.0.0/normalizer.json`

**Time**: 1-2 hours (includes debugging)

---

### Phase 3: Model Evaluation (1-2 hours)

#### Step 6: Evaluate on Test Set
**Task**: Measure REAL performance metrics
**Script**: Create `scripts/ml/evaluate-early-signal-model.ts`

```typescript
import { ModelEvaluator } from '@/app/services/ml/training/ModelEvaluator'
import { FeatureNormalizer } from '@/app/services/ml/early-signal/FeatureNormalizer'
import * as fs from 'fs'
import { parse } from 'csv-parse/sync'

async function evaluateModel() {
  console.log('Evaluating Early Signal Detection Model...')

  // Load test data
  const testData = parse(fs.readFileSync('data/training/v2/test.csv', 'utf-8'), {
    columns: true,
    skip_empty_lines: true
  })

  // Load normalizer
  const normalizerData = JSON.parse(
    fs.readFileSync('models/early-signal/v1.0.0/normalizer.json', 'utf-8')
  )
  const normalizer = new FeatureNormalizer()
  normalizer.loadParams(normalizerData.params)

  // Load model
  const lgb = require('lightgbm3')
  const model = lgb.loadModel('models/early-signal/v1.0.0/model.txt')

  // Prepare features
  const featureNames = [
    'price_change_5d', 'price_change_10d', 'price_change_20d',
    'volume_ratio', 'volume_trend',
    'sentiment_news_delta', 'sentiment_reddit_accel', 'sentiment_options_shift',
    'earnings_surprise', 'revenue_growth_accel', 'analyst_coverage_change',
    'rsi_momentum', 'macd_histogram_trend'
  ]

  const testFeatures = testData.map(row =>
    normalizer.transform(
      Object.fromEntries(featureNames.map(f => [f, parseFloat(row[f])]))
    )
  )
  const testLabels = testData.map(row => parseInt(row.label))

  // Make predictions
  const predictions = model.predict(testFeatures)

  // Calculate metrics using ModelEvaluator
  const evaluator = ModelEvaluator.getInstance()

  const metrics = await evaluator.evaluateModel({
    predictions,
    labels: testLabels,
    modelType: 'classification'
  })

  console.log('📊 Test Set Performance:')
  console.log('AUC:', metrics.auc)
  console.log('Precision @ 0.65:', metrics.precisionAtThreshold(0.65))
  console.log('Recall @ 0.65:', metrics.recallAtThreshold(0.65))
  console.log('F1 Score:', metrics.f1)
  console.log('Accuracy:', metrics.accuracy)

  // Calibration analysis
  console.log('\n📈 Confidence Calibration:')
  const bins = [0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]
  for (let i = 0; i < bins.length - 1; i++) {
    const binPredictions = predictions.filter(p => p >= bins[i] && p < bins[i+1])
    const binAccuracy = binPredictions.filter((p, idx) =>
      (p >= 0.5 ? 1 : 0) === testLabels[idx]
    ).length / binPredictions.length

    console.log(`${bins[i]}-${bins[i+1]}: ${(binAccuracy * 100).toFixed(1)}% accuracy`)
  }

  // Save evaluation report
  fs.writeFileSync(
    'models/early-signal/v1.0.0/evaluation.json',
    JSON.stringify({
      version: '1.0.0',
      evaluated_date: new Date().toISOString(),
      test_examples: testData.length,
      metrics,
      calibration: { /* calibration data */ }
    }, null, 2)
  )

  console.log('\n✅ Evaluation complete!')
}

evaluateModel().catch(console.error)
```

**Success Criteria**:
- AUC > 0.65 (acceptable for MVP)
- Precision @ 0.65 > 55% (minimum viable)
- Recall @ 0.65 > 30% (catches some upgrades)
- Calibration reasonable (confidence ≈ accuracy)

**Time**: 1 hour

---

#### Step 7: Calibrate Confidence Scores
**Task**: Ensure confidence scores match reality
**Method**: Platt scaling or isotonic regression on validation set

```typescript
// Use validation set predictions to calibrate
// Map raw probabilities → calibrated probabilities
// Example: 0.70 raw → 0.65 calibrated (if model overconfident)
```

**Success Criteria**:
- Calibration error < 10%
- High-confidence predictions (>65%) actually accurate >60%
- Low-confidence predictions filtered correctly

**Time**: 30 minutes

---

### Phase 4: Production Integration (1-2 hours)

#### Step 8: Replace Placeholder Model
**Task**: Update EarlySignalService to load real trained model
**File**: `app/services/ml/early-signal/EarlySignalService.ts`

**Changes**:
```typescript
// BEFORE (lines 146-165):
EarlySignalService.modelInstance = {
  predict: (features: number[]) => {
    // Simple weighted scoring as placeholder
    const weights = [0.15, 0.15, 0.15, ...]
    const score = features.reduce((sum, feat, idx) => sum + feat * weights[idx], 0)
    return 1 / (1 + Math.exp(-score))
  }
}

// AFTER:
const lgb = require('lightgbm3')
EarlySignalService.modelInstance = lgb.loadModel(
  path.join(process.cwd(), 'models', 'early-signal', 'v1.0.0', 'model.txt')
)

// Load real feature importance from trained model
const modelMetadata = JSON.parse(
  fs.readFileSync(this.config.modelPath, 'utf-8')
)
this.featureImportance = modelMetadata.feature_importance
```

**Success Criteria**:
- Model loads successfully
- Predictions use trained LightGBM model
- Feature importance from trained model
- No errors on service initialization

**Time**: 30 minutes

---

#### Step 9: End-to-End Integration Tests
**Task**: Validate entire pipeline with real model
**Tests**:
```bash
# Run existing integration tests
npm test -- app/services/ml/early-signal/__tests__/EarlySignalService.test.ts

# Run API integration tests
npm test -- app/api/stocks/__tests__/select.test.ts --testNamePattern="early_signal"

# Manual test
curl -X POST http://localhost:3000/api/stocks/select \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "single",
    "symbols": ["TSLA"],
    "include_early_signal": true
  }'
```

**Success Criteria**:
- All tests pass
- Real predictions (not placeholder)
- High-confidence predictions appear
- Low-confidence predictions filtered (null)
- Reasoning makes sense
- Feature importance realistic

**Time**: 1 hour

---

### Phase 5: Documentation Update (1 hour)

#### Step 10: Update User Guide with REAL Metrics
**Task**: Replace vision with reality in `docs/user-guides/early-signal-detection.md`

**Updates Required**:

1. **Performance Section** (replace lines ~450-550):
```markdown
## Model Performance (Measured on Hold-out Test Set)

**Evaluated**: October 1, 2025
**Test Set**: 50 examples (2024 Q4)
**Model**: LightGBM v1.0.0

### Classification Metrics
- **AUC**: 0.68 (acceptable discriminative ability)
- **Precision @ 65% confidence**: 58% (58% of high-confidence upgrade predictions correct)
- **Recall @ 65% confidence**: 35% (catches 35% of actual upgrades)
- **F1 Score**: 0.44

### Confidence Calibration (Measured)
| Confidence Range | Prediction Accuracy | Sample Size |
|-----------------|-------------------|-------------|
| 65-75% | 61% | 15 predictions |
| 75-85% | 68% | 8 predictions |
| 85-95% | 75% | 4 predictions |
| 95-100% | 83% | 2 predictions |

### What This Means
- **High-confidence predictions (>65%)** are correct ~60% of the time
- **Very high confidence (>85%)** are correct ~75% of the time
- This is BETTER than random (50%) but NOT perfect
- Use as ONE input to investment decisions, not the only factor
```

2. **Feature Importance** (real rankings from trained model):
```markdown
## Feature Importance (From Trained Model)

1. **price_change_20d** (18.2%) - 20-day momentum most predictive
2. **earnings_surprise** (14.5%) - Recent earnings beats strong signal
3. **revenue_growth_accel** (12.1%) - Growth acceleration matters
4. **price_change_10d** (10.8%) - Medium-term momentum
5. **analyst_coverage_change** (9.3%) - Analyst attention shift
...
```

3. **Limitations Section** (honest assessment):
```markdown
## Limitations (Be Realistic)

### What This Model CAN Do
✅ Identify stocks with higher probability of analyst upgrades
✅ Filter out low-conviction predictions (35-65% uncertainty)
✅ Provide data-driven signals for further research
✅ Outperform random chance (50% baseline)

### What This Model CANNOT Do
❌ Guarantee upgrade predictions (only ~60% accuracy at high confidence)
❌ Predict exact timing (2-week horizon is approximate)
❌ Account for unexpected events (earnings surprises, macro shocks)
❌ Replace fundamental analysis and due diligence
❌ Catch all upgrades (35% recall means 65% are missed)

### Known Weaknesses
- Small training set (600 examples) - more data needed for higher accuracy
- Limited to 2-week horizon - longer predictions not validated
- No downgrade predictions - only upgrade detection
- Requires 13 features - missing data reduces confidence
```

4. **Add "Model Version" Section**:
```markdown
## Current Model Version

**Version**: 1.0.0
**Algorithm**: LightGBM Gradient Boosting
**Trained**: October 1, 2025
**Training Data**: 500 examples (10 symbols, 2022-2024)
**Validation Data**: 50 examples (2024 Q3)
**Test Data**: 50 examples (2024 Q4)

**Next Update**: Planned for November 2025 (expanded to 100 symbols)
```

**Success Criteria**:
- No false claims
- Real measured metrics
- Honest limitations documented
- Users understand what to expect
- Version tracking clear

**Time**: 1 hour

---

## Success Criteria (Overall)

### Technical Validation
- [ ] Training data: 600+ examples, all features populated
- [ ] Model: LightGBM trained and saved
- [ ] Test AUC: >0.65
- [ ] Test Precision @ 65%: >55%
- [ ] Integration tests: All passing
- [ ] API endpoint: Returns real predictions

### Documentation Alignment
- [ ] User guide claims match measured performance
- [ ] No placeholder or "TBD" metrics
- [ ] Limitations clearly stated
- [ ] Feature importance from trained model
- [ ] Confidence calibration tables accurate

### User Experience
- [ ] High-confidence predictions appear in API responses
- [ ] Low-confidence predictions correctly filtered
- [ ] Reasoning makes sense (uses top features)
- [ ] Latency <100ms with cache, <5s without
- [ ] No crashes or errors

---

## Risk Mitigation

### What If Performance Is Poor?

**Scenario**: AUC < 0.60, Precision < 50%

**Response**:
1. **Be Honest**: Update documentation with real (poor) metrics
2. **Add Disclaimers**: "Alpha feature, experimental, low confidence"
3. **Adjust Thresholds**: Increase confidence threshold to 0.75+ (higher precision, lower recall)
4. **Iterate**: Generate more training data (100 symbols vs 10)
5. **Feature Engineering**: Add more predictive features
6. **Alternative**: Mark as "research preview, not production"

### What If LightGBM Won't Install?

**Fallback**: Use logistic regression
- Simpler, easier to install
- Still ML-powered
- Sufficient for MVP
- Can upgrade later

### What If Training Takes Too Long?

**Optimization**:
- Start with 10 symbols (600 examples)
- Train overnight if needed
- Use fewer epochs (faster training)
- Parallelize data collection

---

## Timeline Summary

| Phase | Tasks | Time | Dependencies |
|-------|-------|------|--------------|
| **Phase 1: Data** | Steps 1-3 | 3-4 hours | API access, scripts ready |
| **Phase 2: Training** | Steps 4-5 | 2-3 hours | LightGBM install |
| **Phase 3: Evaluation** | Steps 6-7 | 1-2 hours | Trained model |
| **Phase 4: Integration** | Steps 8-9 | 1-2 hours | Evaluation complete |
| **Phase 5: Docs** | Step 10 | 1 hour | Real metrics |
| **Total** | 10 steps | **8-12 hours** | Focused work |

---

## Next Actions

1. **Review this plan** - Does it make sense?
2. **Approve timeline** - Is 8-12 hours acceptable?
3. **Start Step 1** - Regenerate training data
4. **Track progress** - Use TODO list to monitor
5. **Iterate** - Adjust based on results

---

## Commitment

**This plan makes the user guide REAL.**

No more placeholders. No more "TBD" metrics. No more vision.

Just measured performance, honest limitations, and a working ML system.

**Are we ready to execute?**
