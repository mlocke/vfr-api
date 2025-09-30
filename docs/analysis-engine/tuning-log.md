# Weight Tuning Log
**Date**: September 30, 2025

---

## Iteration 1: NVDA - Sentiment Weight Boost (FAILED)

### Hypothesis
Boost sentiment weight from 18% to 22% (+4pp) to better capture "overwhelming positive" consensus for high-conviction stocks like NVDA.

### Changes Made
- `baseFundamentalWeight`: 0.280 → 0.240 (-4pp)
- `adjustedSentimentWeight`: 0.180 → 0.220 (+4pp)
- File: `app/services/algorithms/FactorLibrary.ts:2168-2195`

### Results
- **Baseline Score**: 0.7797 (77.97%)
- **Tuned Score**: 0.7623 (76.23%)
- **Change**: -0.0174 (-1.74%) ❌ **WORSE**

### Component Breakdown

| Component | Baseline Weight | Tuned Weight | Score | Impact |
|-----------|----------------|--------------|-------|--------|
| Technical | 23.5% | 23.7% | 0.500 | Minimal change |
| Fundamental | 33.1% | 28.6% | 0.981 | **Reduced excellent score** ⚠️ |
| Sentiment | 17.8% | 21.9% | 0.580 | Increased low score |
| Macro | 19.7% | 19.9% | 1.000 | Minimal change |
| Alternative | 5.9% | 5.9% | ~0.65 | No change |

### Root Cause Analysis

**Why it failed:**
1. **Reduced high-performing component**: Fundamental score (0.981) is excellent, reducing its weight from 33.1% to 28.6% lost ~0.04 points
2. **Increased low-performing component**: Sentiment score (0.580) is moderate, increasing its weight couldn't compensate
3. **Math**: Lost (0.981 × -0.045) = -0.044 points, gained (0.580 × +0.041) = +0.024 points, net = -0.020 points

**The real problem:**
- Sentiment **SCORE** is too low (0.580), not the weight
- 79 analysts with 3.7/5 rating = "overwhelming positive" but scores only 0.580
- This is a **calculation issue**, not a weight issue

### Decision
**REVERT** weight changes. The baseline (0.7797) is better than the tuned version (0.7623).

### Lessons Learned
1. Don't reduce weight of high-scoring components to boost low-scoring ones
2. If a score seems wrong, fix the **calculation**, not just adjust the weight
3. Sentiment mapping: 3.7/5 → 0.580 seems too conservative for "Strong Buy" consensus

### Next Steps
Options to explore:
1. **Fix sentiment score calculation** - Investigate how 3.7/5 maps to 0-1 scale
2. **Boost technical score** - Technical at 0.500 also seems low for "near all-time highs"
3. **Accept baseline** - 0.7797 may be appropriate given mixed component signals

---

## Status
- ✅ Iteration 1 completed
- ✅ Changes reverted
- ⏸️ Tuning paused for analysis
- 📊 Need to investigate sentiment score calculation methodology
