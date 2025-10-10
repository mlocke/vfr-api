# FinBERT Sentiment Model Performance Fix

**Status**: TODO
**Priority**: HIGH
**Current Performance**: 44% accuracy, 0.44 F1-score
**Target Performance**: 65% accuracy, 0.63 F1-score

## Problem Summary

The FinBERT sentiment fusion model trained on 5,214 examples achieves only 44% accuracy (worse than random guessing for 3 classes). Root cause analysis identified 5 critical issues.

## Root Causes

### 1. Label Misalignment (CRITICAL)
**Problem**: Text describes backward-looking data (past 7 days), but label is forward-looking (future 14 days).

Example:
```
Text: "Stock fell 2.5% in recent trading"
Label: BULLISH (because it rose 4% in NEXT 14 days)
```

The model learns past movements don't correlate with future movements.

### 2. Generic Template Text (73% Noise)
**Problem**: 3,811 of 5,214 examples (73%) contain identical text: "Market sentiment appears mixed based on recent price and volume dynamics."

This provides zero discriminative signal for the model to learn from.

### 3. Missing Real News Content
**Problem**: `[NEWS]` section contains price movement summaries, not actual news headlines.

Currently:
```
[NEWS] Stock fell 2.5% in recent trading, Market sentiment appears mixed...
```

Should be:
```
[NEWS] FDA approves new drug; Analyst upgrades to Buy; Q3 earnings beat by 12%
```

### 4. Insufficient Training Volume
**Problem**: 5,214 examples insufficient for 109M parameter FinBERT model.

- FinBERT requires 10,000-50,000+ examples for effective fine-tuning
- Small datasets cause overfitting

### 5. Weak Feature-Label Correlation
**Problem**: Features extracted (analyst consensus, put/call ratio, VIX) have weak 14-day predictive power.

- Analyst consensus changes slowly (monthly/quarterly)
- Options sentiment is often contrarian
- VIX reflects current volatility, not directional moves

## Fix Plan

### Step 1: Add Real News Headlines
**File**: `app/services/ml/sentiment-fusion/SentimentFusionFeatureExtractor.ts`

**Change**: Modify `extractNewsText()` method to fetch actual Polygon news headlines.

**Implementation**:
```typescript
// Current (wrong):
return "Stock fell 2.5% in recent trading, Market sentiment appears mixed...";

// Fixed:
const news = await this.polygonAPI.getNews(symbol, asOfDate, 5);
const headlines = news.map(n => n.title).slice(0, 3).join("; ");
return `Recent headlines: ${headlines}`;
```

**Expected outcome**: Real sentiment-bearing text for FinBERT to analyze.

### Step 2: Align Text with Labels
**File**: `app/services/ml/sentiment-fusion/SentimentFusionFeatureExtractor.ts`

**Change**: Remove backward-looking price narratives. Focus on forward-looking signals.

**Remove**:
- "Stock fell 2.5% last week" (backward-looking)
- "Market sentiment appears mixed" (generic noise)

**Add**:
- Analyst upgrades/downgrades and price target changes
- Earnings surprises and guidance revisions
- News sentiment score from real headlines
- Unusual options activity (directional bets)

**Expected outcome**: Text correlates with what we're predicting (future direction).

### Step 3: Generate 4x More Training Data
**File**: `scripts/ml/sentiment-fusion/generate-dataset.ts`

**Changes**:
1. Expand symbol universe: `SP500_TOP_100` → `SP500_TOP_300`
2. Increase sampling frequency: monthly → bi-weekly
3. Date range: 2023-01-01 to 2024-12-31 (2 years)

**Command**:
```bash
npx tsx scripts/ml/sentiment-fusion/generate-dataset.ts --symbols 300 --biweekly
```

**Target**: 300 symbols × 48 bi-weekly samples = 14,400+ examples

**Expected outcome**: Sufficient data for FinBERT to learn generalizable patterns.

### Step 4: Improve Label Quality
**File**: `scripts/ml/sentiment-fusion/generate-dataset.ts`

**Change**: Use ±5% thresholds instead of ±3% for clearer signal.

```typescript
// Current:
private calculateLabel(priceChange: number): number {
  if (priceChange > 3.0) return 2; // BULLISH
  if (priceChange < -3.0) return 0; // BEARISH
  return 1; // NEUTRAL
}

// Fixed:
private calculateLabel(priceChange: number): number {
  if (priceChange > 5.0) return 2; // BULLISH (strong upward)
  if (priceChange < -5.0) return 0; // BEARISH (strong downward)
  return 1; // NEUTRAL (true sideways)
}
```

**Expected distribution**: ~25% BULLISH, ~50% NEUTRAL, ~25% BEARISH

### Step 5: Add Forward-Looking Features
**File**: `app/services/ml/sentiment-fusion/SentimentFusionFeatureExtractor.ts`

**Add to text generation**:
- Upcoming earnings dates (within 7 days = high impact)
- Analyst estimate revision trends (upgrades vs downgrades)
- Institutional ownership changes (buying/selling momentum)
- Short interest changes (potential squeeze signals)

**Expected outcome**: Model learns from actual predictive signals.

## Implementation Checklist

- [ ] Step 1: Add real news headlines to `SentimentFusionFeatureExtractor.ts`
- [ ] Step 2: Remove backward-looking text, add forward-looking features
- [ ] Step 4: Change label thresholds from ±3% to ±5%
- [ ] Step 5: Add earnings calendar, analyst revisions, institutional flow
- [ ] Step 3: Generate 14,400+ training examples (6-8 hours overnight)
- [ ] Split dataset: `python scripts/ml/split-price-dataset.py`
- [ ] Train model: `python3.11 scripts/ml/sentiment-fusion/train-finbert-v2.py` (8-12 hours)
- [ ] Evaluate: Compare v1.1.0 vs v1.2.0 on test set
- [ ] Register model if 65%+ accuracy achieved

## Expected Results

**Before (v1.1.0)**:
- Training examples: 5,214
- Accuracy: 44.0%
- F1-Score: 0.442
- Bearish F1: 0.404
- Neutral F1: 0.477
- Bullish F1: 0.420

**After (v1.2.0 - projected)**:
- Training examples: 14,400+
- Accuracy: 65%+
- F1-Score: 0.63+
- Bearish F1: 0.60+
- Neutral F1: 0.65+
- Bullish F1: 0.60+

## Timeline

1. Code changes (Steps 1, 2, 4, 5): **2 hours**
2. Data generation (Step 3): **6-8 hours** (overnight, unattended)
3. Model training: **8-12 hours** (overnight, unattended)
4. Evaluation and comparison: **30 minutes**

**Total elapsed time**: ~2 days (mostly unattended)

## Files to Modify

1. `app/services/ml/sentiment-fusion/SentimentFusionFeatureExtractor.ts` - Feature extraction logic
2. `scripts/ml/sentiment-fusion/generate-dataset.ts` - Dataset generation parameters
3. `scripts/ml/sentiment-fusion/train-finbert-v2.py` - Already working (no changes needed)

## Success Criteria

- [ ] Accuracy ≥65% on validation set
- [ ] F1-Score ≥0.63 on validation set
- [ ] All per-class F1 scores ≥0.60
- [ ] Model generalizes to test set (within 5% of validation performance)

## Notes

- Follow KISS principles: Make minimal, targeted changes
- Follow code-rules.md: Edit existing files, don't create new ones
- Test each step incrementally before proceeding
- Save checkpoints every 50 examples during data generation
- **REQUIRED: Python 3.10+** for training (transformers library uses `int | None` syntax)
- Python 3.9 will fail with TypeError - version check enforced in training script
