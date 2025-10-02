# Fix Fundamental Feature Extraction - Model v2.0

**Created**: 2025-10-02
**Priority**: HIGH
**Goal**: Fix feature extraction to properly populate earnings_surprise and revenue_growth_accel
**Target**: Reduce zeros from 92% to <20%, improve model precision to 75-80%

## Problem Statement

**Current State** (Model v1.0.0):
- `earnings_surprise`: 92.3% zeros (410/444 examples)
- `revenue_growth_accel`: 84.5% zeros (375/444 examples)
- Model relies 100% on sentiment/technical features
- Precision: 66.7% (1 in 3 predictions are false positives)

**Root Cause**:
- FeatureExtractor calls `fmpAPI.getEarningsSurprises()` and `fmpAPI.getIncomeStatement()`
- These methods may not be implemented or returning empty data
- Fallback to 0 is too aggressive (should distinguish between "no data" vs "neutral")

**Impact**:
- Model cannot learn from fundamental deterioration signals
- Over-reliance on sentiment creates false positives
- Missing 25% of potential model accuracy

---

## Investigation Tasks

### Task 1: Verify FMP API Methods Exist ⏳
**Status**: Pending
**Time**: 30 minutes

**Action**:
```bash
# Check if getEarningsSurprises exists
grep -r "getEarningsSurprises" app/services/financial-data/

# Check if getIncomeStatement exists
grep -r "getIncomeStatement" app/services/financial-data/

# Test API responses manually
npx tsx -e "
import { FinancialModelingPrepAPI } from './app/services/financial-data/FinancialModelingPrepAPI.js'
const fmp = new FinancialModelingPrepAPI()
const earnings = await fmp.getEarningsSurprises('AAPL', 4)
console.log('Earnings:', earnings)
const income = await fmp.getIncomeStatement('AAPL', 'quarterly', 8)
console.log('Income:', income)
"
```

**Success Criteria**:
- [ ] Confirm methods exist in FinancialModelingPrepAPI
- [ ] Verify API returns data (not empty arrays)
- [ ] Document actual API response format

---

### Task 2: Identify Why Data Returns Zeros ⏳
**Status**: Pending
**Time**: 1 hour

**Possible Causes**:
1. **API methods don't exist** → Need to implement them
2. **API methods return wrong format** → Need to fix parsing
3. **asOfDate filtering too aggressive** → Returns no matches
4. **FMP API key doesn't have access** → Need different data source

**Debug Steps**:
```typescript
// Add logging to FeatureExtractor.ts
private async calculateEarningsSurprise(fmpAPI: any, symbol: string, asOfDate: Date): Promise<number> {
  try {
    console.log(`[DEBUG] Fetching earnings for ${symbol}, asOfDate: ${asOfDate}`)
    const earnings = await fmpAPI.getEarningsSurprises(symbol, 4)
    console.log(`[DEBUG] Raw earnings response:`, JSON.stringify(earnings, null, 2))

    if (!earnings || earnings.length === 0) {
      console.warn(`[DEBUG] No earnings data returned for ${symbol}`)
      return 0
    }
    // ... rest of logic
  }
}
```

**Success Criteria**:
- [ ] Identify exact point where data becomes 0
- [ ] Understand API response format
- [ ] Document fix required

---

### Task 3: Test with Known Earnings Data ⏳
**Status**: Pending
**Time**: 30 minutes

**Test Symbols** (known to have earnings data):
- AAPL: Quarterly earnings every Jan, Apr, Jul, Oct
- TSLA: Quarterly earnings
- NVDA: Quarterly earnings

**Test Script**:
```typescript
const testDates = [
  { symbol: 'AAPL', date: new Date('2024-02-01'), expectedSurprise: 'positive' },
  { symbol: 'TSLA', date: new Date('2024-01-25'), expectedSurprise: 'positive' },
  { symbol: 'NVDA', date: new Date('2024-02-22'), expectedSurprise: 'beat expectations' }
]

for (const test of testDates) {
  const features = await extractor.extractFeatures(test.symbol, test.date)
  console.log(`${test.symbol} on ${test.date}: earnings_surprise = ${features.earnings_surprise}`)
  if (features.earnings_surprise === 0) {
    console.error(`❌ FAILED: Expected non-zero earnings surprise`)
  }
}
```

**Success Criteria**:
- [ ] At least 1 symbol returns non-zero earnings_surprise
- [ ] Earnings surprise value is reasonable (-50% to +100%)
- [ ] Date filtering works correctly

---

## Implementation Tasks

### Task 4: Implement Missing API Methods ⏳
**Status**: Pending
**Time**: 2-3 hours
**Priority**: HIGH

**If methods don't exist, implement them**:

**Option A: Use FMP Earnings Surprises API**
```typescript
// Add to FinancialModelingPrepAPI.ts
async getEarningsSurprises(symbol: string, limit: number = 4): Promise<any[]> {
  const url = `https://financialmodelingprep.com/api/v3/earnings-surprises/${symbol}?limit=${limit}&apikey=${this.apiKey}`
  const response = await fetch(url)
  return response.json()
}
```

**Option B: Use FMP Earnings Calendar Historical**
```typescript
async getEarningsHistory(symbol: string, from: string, to: string): Promise<any[]> {
  const url = `https://financialmodelingprep.com/api/v3/historical/earning_calendar/${symbol}?from=${from}&to=${to}&apikey=${this.apiKey}`
  const response = await fetch(url)
  return response.json()
}
```

**Option C: Calculate from Income Statement**
```typescript
async getIncomeStatement(symbol: string, period: 'quarterly' | 'annual' = 'quarterly', limit: number = 8): Promise<any[]> {
  const url = `https://financialmodelingprep.com/api/v3/income-statement/${symbol}?period=${period}&limit=${limit}&apikey=${this.apiKey}`
  const response = await fetch(url)
  return response.json()
}
```

**Success Criteria**:
- [ ] API methods implemented and tested
- [ ] Returns data for major symbols (AAPL, TSLA, NVDA)
- [ ] Response format documented
- [ ] Error handling for API failures

---

### Task 5: Fix Feature Extraction Logic ⏳
**Status**: Pending
**Time**: 1-2 hours

**Changes to FeatureExtractor.ts**:

1. **Better error handling**:
```typescript
private async calculateEarningsSurprise(fmpAPI: any, symbol: string, asOfDate: Date): Promise<number> {
  try {
    const earnings = await fmpAPI.getEarningsSurprises(symbol, 8) // Increase from 4 to 8

    if (!earnings || earnings.length === 0) {
      console.warn(`No earnings data for ${symbol} - API may not have historical data`)
      return 0 // Explicitly return 0 only if NO data exists
    }

    // More flexible date filtering (within 90 days instead of exact match)
    const relevantEarnings = earnings.filter((e: any) => {
      const earnDate = new Date(e.date)
      const daysDiff = (asOfDate.getTime() - earnDate.getTime()) / (1000 * 60 * 60 * 24)
      return daysDiff >= 0 && daysDiff <= 90 // Within last 90 days
    })

    // ... rest of logic
  }
}
```

2. **Distinguish "no data" from "neutral"**:
```typescript
// Option: Use NaN for "no data", 0 for "neutral surprise"
earnings_surprise: fundamentals?.earningsSurprise ?? NaN // NaN means no data
// Then in training, filter out NaN rows OR impute with mean
```

**Success Criteria**:
- [ ] Earnings surprise calculated correctly for test symbols
- [ ] Revenue growth calculated correctly
- [ ] Date filtering works for historical dates
- [ ] Fewer than 20% zeros in new training data

---

### Task 6: Validate with Manual Testing ⏳
**Status**: Pending
**Time**: 30 minutes

**Test Script**:
```bash
# Generate small test dataset
npx tsx scripts/ml/generate-training-data.ts --symbols AAPL,TSLA,NVDA --start 2023-01-01 --end 2024-12-31 --output data/training/test-fundamentals.csv

# Check for zeros
npx tsx -e "
const fs = require('fs');
const csv = fs.readFileSync('data/training/test-fundamentals.csv', 'utf-8');
const lines = csv.split('\n').filter(l => l.trim());
const headers = lines[0].split(',');
const earningsIdx = headers.indexOf('earnings_surprise');

let zeros = 0;
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  if (cols[earningsIdx] === '0') zeros++;
}

console.log('Zeros:', zeros, '/', lines.length - 1, '(' + ((zeros/(lines.length-1))*100).toFixed(1) + '%)');
"
```

**Success Criteria**:
- [ ] <20% zeros for earnings_surprise
- [ ] <20% zeros for revenue_growth_accel
- [ ] Values are realistic (-50% to +100% for earnings)
- [ ] At least 3 symbols have non-zero values

---

## Model Retraining Tasks

### Task 7: Regenerate Full Training Dataset ⏳
**Status**: Pending
**Time**: 2-4 hours
**Depends On**: Task 5

**Command**:
```bash
npx tsx scripts/ml/generate-training-data.ts --full --output data/training/early-signal-v2.1.csv
```

**Success Criteria**:
- [ ] 600+ training examples generated
- [ ] earnings_surprise: <20% zeros
- [ ] revenue_growth_accel: <20% zeros
- [ ] All 13 features show realistic variation

---

### Task 8: Retrain Model v2.0 ⏳
**Status**: Pending
**Time**: 30 minutes
**Depends On**: Task 7

**Command**:
```bash
python scripts/ml/train-lightgbm.py \
  --input data/training/early-signal-v2.1.csv \
  --output models/early-signal/v2.0.0/
```

**Expected Improvements**:
- Precision: 75-80% (up from 66.7%)
- Recall: 85-95% (down from 100%, acceptable trade-off)
- AUC: 0.93+ (maintain or improve)
- Feature importance: More balanced (fundamentals 20-30%, sentiment 40-50%, technical 30%)

**Success Criteria**:
- [ ] Model trains without errors
- [ ] Precision ≥ 75%
- [ ] Recall ≥ 85%
- [ ] AUC ≥ 0.90
- [ ] Fundamental features show >0% importance

---

### Task 9: Validate v2.0 Performance ⏳
**Status**: Pending
**Time**: 1 hour

**Validation Script**:
```bash
# Test on hold-out data
python scripts/ml/evaluate-model.py \
  --model models/early-signal/v2.0.0/model.txt \
  --test data/training/test.csv
```

**Metrics to Track**:
- Precision, Recall, F1, AUC
- Confusion matrix
- Feature importance rankings
- Calibration curve

**Success Criteria**:
- [ ] All metrics meet targets
- [ ] Feature importance balanced
- [ ] Performance improvement over v1.0.0 documented

---

### Task 10: Deploy v2.0 to Production ⏳
**Status**: Pending
**Time**: 30 minutes

**Steps**:
1. Update model version in EarlySignalService.ts
2. Copy v2.0.0 model files to production location
3. Run integration tests
4. Update user guide documentation

**Success Criteria**:
- [ ] Integration tests pass
- [ ] API returns v2.0.0 predictions
- [ ] Documentation updated with v2.0.0 metrics

---

## Success Metrics

**Model v2.0.0 Targets**:
- ✅ Precision: 75-80% (up from 66.7%)
- ✅ Recall: 85-95% (down from 100%, acceptable)
- ✅ AUC: ≥0.90 (maintain excellence)
- ✅ Fundamental features: >0% importance
- ✅ Training data: <20% zeros in fundamentals

**Timeline**: 1-2 weeks (2-3 hours per task)

---

## Related Documents

- **Current Model**: `models/early-signal/v1.0.0/metadata.json`
- **User Guide**: `docs/user-guides/early-signal-detection.md`
- **Feature Extractor**: `app/services/ml/early-signal/FeatureExtractor.ts`
- **FMP API**: `app/services/financial-data/FinancialModelingPrepAPI.ts`
