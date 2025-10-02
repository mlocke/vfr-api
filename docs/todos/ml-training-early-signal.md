# ML Early Signal Detection - Training TODO

**Status:** Waiting for training data generation to complete
**Dataset:** `data/training/early-signal-v2.1.csv`
**Goal:** Train and deploy Early Signal Detection model (v1.0.0)

---

## Prerequisites

- [ ] Wait for training data generation script to complete (currently processing 100 S&P stocks)
- [ ] Verify `data/training/early-signal-v2.1.csv` exists
- [ ] Check dataset has sufficient examples (target: ~6000 rows, minimum: 1000)

---

## Phase 1: Data Validation & Splitting

### Task 1.1: Validate Generated Dataset
**Script:** Manual inspection
**Commands:**
```bash
# Check file exists and size
ls -lh data/training/early-signal-v2.1.csv

# View first 10 rows
head -10 data/training/early-signal-v2.1.csv

# Count total rows (subtract 1 for header)
wc -l data/training/early-signal-v2.1.csv
```

**Validation Criteria:**
- [ ] File exists and is >1MB
- [ ] Contains 22 columns (symbol, date, 20 features, label)
- [ ] Has >1000 data rows (excluding header)
- [ ] No obvious data corruption (inspect random sample)

---

### Task 1.2: Split into Train/Val/Test Sets
**Script:** `scripts/ml/split-training-data.ts`
**Command:**
```bash
npx tsx scripts/ml/split-training-data.ts \
  --input data/training/early-signal-v2.1.csv \
  --output-dir data/training
```

**Expected Outputs:**
- [ ] `data/training/train.csv` (~80% of data, dates: 2022-01-01 to 2024-06-30)
- [ ] `data/training/val.csv` (~10% of data, dates: 2024-07-01 to 2024-09-30)
- [ ] `data/training/test.csv` (~10% of data, dates: 2024-10-01 to 2024-12-31)

**Success Criteria:**
- [ ] All three files created
- [ ] Temporal split verified (no overlap between sets)
- [ ] Split ratio is approximately 80/10/10
- [ ] Each file has consistent 22 columns with header

---

## Phase 2: Model Training

### Task 2.1: Train Logistic Regression Model
**Script:** `scripts/ml/train-early-signal-model.ts`
**Location:** `scripts/ml/train-early-signal-model.ts:203-313`
**Command:**
```bash
npx tsx scripts/ml/train-early-signal-model.ts
```

**Training Configuration:**
- Algorithm: Logistic Regression (gradient descent)
- Learning rate: 0.01
- Max iterations: 1000
- Features: 20 (normalized with z-score)
- Normalization: Mean=0, Std=1

**Expected Model Outputs:**
Model saved to `models/early-signal/v1.0.0/`:
- [ ] `model.json` - Contains weights (20 values) + bias (1 value)
- [ ] `normalizer.json` - Mean and std for each of 20 features
- [ ] `metadata.json` - Model info, feature importance, training metrics

**Success Criteria:**
- [ ] Training completes without errors
- [ ] Validation accuracy >= 70%
- [ ] Loss decreases over iterations
- [ ] All 3 files created in models directory
- [ ] Feature importance calculated and saved

**Key Metrics to Check:**
- Validation Accuracy: ___% (target: >70%)
- Training Loss (final): ___
- Top 5 Important Features:
  1. _________________ : ___%
  2. _________________ : ___%
  3. _________________ : ___%
  4. _________________ : ___%
  5. _________________ : ___%

---

## Phase 3: Model Evaluation (Optional)

### Task 3.1: Evaluate on Test Set
**Script:** Create if needed or manual evaluation
**Reference:** `app/services/ml/models/ModelEvaluator.ts`

**If evaluation script exists:**
```bash
npx tsx scripts/ml/evaluate-early-signal-model.ts
```

**Manual Evaluation Process:**
1. Load test.csv
2. Load model.json + normalizer.json
3. Normalize test features using saved mean/std
4. Make predictions using model weights
5. Calculate metrics:
   - Accuracy
   - Precision
   - Recall
   - F1 Score
   - Confusion Matrix

**Success Criteria:**
- [ ] Test accuracy within 5% of validation accuracy
- [ ] No significant overfitting (train >> test performance)
- [ ] Confusion matrix shows balanced performance
- [ ] Metrics documented for future comparison

**Test Set Metrics:**
- Test Accuracy: ___% (should be close to validation)
- Precision: ___%
- Recall: ___%
- F1 Score: ___%
- True Positives: ___
- True Negatives: ___
- False Positives: ___
- False Negatives: ___

---

## Phase 4: Model Registration & Deployment (Optional)

### Task 4.1: Register Model in ModelRegistry
**Service:** `app/services/ml/models/ModelRegistry.ts`
**Location:** `app/services/ml/models/ModelRegistry.ts:236-285`

**Manual Registration Steps:**
1. Open ModelRegistry service
2. Call `registerModel()` with metadata:
   - modelName: "early-signal-detection"
   - modelVersion: "1.0.0"
   - modelType: LOGISTIC_REGRESSION
   - objective: CLASSIFICATION
   - targetVariable: "analyst_upgrade"
   - predictionHorizon: "30d"
   - validationScore: (from training)
   - testScore: (from evaluation)
   - tierRequirement: PREMIUM
   - status: VALIDATED

**Success Criteria:**
- [ ] Model registered in ModelRegistry
- [ ] Model ID generated
- [ ] Metadata stored correctly
- [ ] Status set to VALIDATED

---

### Task 4.2: Deploy Model (Production)
**Service:** `app/services/ml/models/TrainingOrchestrator.ts`

**Deployment Options:**

**Option A: Manual Deployment**
- Copy model files to production model directory
- Update model path in production config
- Restart production services

**Option B: Automated Deployment (via TrainingOrchestrator)**
```typescript
// In production code
await trainingOrchestrator.submitTrainingJob({
  jobId: 'early-signal-v1.0.0-deployment',
  modelName: 'early-signal-detection',
  modelVersion: '1.0.0',
  // ... config
  autoDeploy: true
});
```

**Success Criteria:**
- [ ] Model deployed to production environment
- [ ] Model accessible via API endpoint
- [ ] Health check passes
- [ ] Prediction latency < 100ms
- [ ] Monitoring enabled

---

## Phase 5: Integration Testing

### Task 5.1: API Integration Test
**Endpoint:** `POST /api/stocks/ml-enhance` or early signal endpoint

**Test Request:**
```bash
curl -X POST http://localhost:3000/api/stocks/early-signal \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "date": "2024-11-01"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "prediction": 0 or 1,
    "probability": 0.0 - 1.0,
    "confidence": "high|medium|low",
    "topFeatures": [...]
  }
}
```

**Success Criteria:**
- [ ] API endpoint responds successfully
- [ ] Predictions are valid (0 or 1)
- [ ] Probability is between 0 and 1
- [ ] Response time < 100ms
- [ ] Error handling works correctly

---

### Task 5.2: Production Validation
**Run on live data:**
1. Test with 10-20 different symbols
2. Verify predictions are reasonable
3. Check feature extraction is working
4. Monitor for any errors or warnings

**Success Criteria:**
- [ ] All test symbols return predictions
- [ ] No errors or crashes
- [ ] Feature extraction working correctly
- [ ] Predictions align with expected patterns
- [ ] Logs show proper execution

---

## Troubleshooting

### Issue: Low Validation Accuracy (<70%)
**Possible causes:**
- Insufficient training data
- Feature quality issues
- Class imbalance
- Poor hyperparameters

**Solutions:**
- Generate more training data
- Review feature engineering
- Apply class balancing techniques
- Tune learning rate or iterations

---

### Issue: Overfitting (Train >> Test)
**Possible causes:**
- Too many features
- Too few training examples
- Features leaking future information

**Solutions:**
- Feature selection/reduction
- Add more training data
- Add regularization (L1/L2)
- Review feature extraction logic

---

### Issue: Model Files Not Created
**Possible causes:**
- Directory permissions
- Disk space
- Path errors

**Solutions:**
```bash
# Create directory manually
mkdir -p models/early-signal/v1.0.0

# Check permissions
ls -ld models/early-signal/

# Check disk space
df -h
```

---

## Next Steps After Completion

1. **Document Results**
   - Record all metrics in this file
   - Create performance baseline
   - Document any issues encountered

2. **Baseline Comparison**
   - Compare with random baseline (50% accuracy)
   - Compare with simple heuristics
   - Document improvement

3. **Production Monitoring**
   - Set up model performance tracking
   - Monitor prediction distribution
   - Track accuracy over time
   - Set up alerts for degradation

4. **Iteration Planning**
   - Identify improvement opportunities
   - Plan feature engineering enhancements
   - Consider advanced algorithms (XGBoost, LightGBM)
   - Schedule retraining cadence

---

## Additional Resources

### Key Files Reference
- Training Script: `scripts/ml/train-early-signal-model.ts:203-313`
- Split Script: `scripts/ml/split-training-data.ts:68-206`
- Model Evaluator: `app/services/ml/models/ModelEvaluator.ts:102-688`
- Model Registry: `app/services/ml/models/ModelRegistry.ts:236-285`
- Training Orchestrator: `app/services/ml/models/TrainingOrchestrator.ts:227-371`

### Feature Names (20 total)
```
price_change_5d, price_change_10d, price_change_20d,
volume_ratio, volume_trend,
sentiment_news_delta, sentiment_reddit_accel, sentiment_options_shift,
social_stocktwits_24h_change, social_stocktwits_hourly_momentum, social_stocktwits_7d_trend,
social_twitter_24h_change, social_twitter_hourly_momentum, social_twitter_7d_trend,
earnings_surprise, revenue_growth_accel,
analyst_coverage_change,
rsi_momentum, macd_histogram_trend
```

---

**Last Updated:** 2025-10-02
**Author:** VFR ML Team
**Model Version:** v1.0.0 (Early Signal Detection)
