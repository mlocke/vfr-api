# VFR ML Ensemble - Quick Reference

## TL;DR

✅ **VFR IS USING A TRUE ENSEMBLE** - 4 ML models combined via weighted voting (updated Oct 13, 2025)
⚠️ **BUT: Disabled by default** - Requires `include_ml=true` parameter

---

## Model Inventory

| Model | Weight | Purpose | Features | Status |
|-------|--------|---------|----------|--------|
| **Sentiment Fusion** | 45% | 3-day price direction (sentiment + technicals) | 45 | ✅ ACTIVE (v1.1.0) |
| **Price Prediction** | 27% | 1-week price movement (technical analysis) | 35 | ✅ ACTIVE (v1.1.0) |
| **Early Signal Detection** | 18% | Analyst upgrade predictions (2 weeks ahead) | 28 | ✅ ACTIVE (v1.0.0) |
| **Smart Money Flow** | 10% ✨ NEW | Institutional/insider trading activity | 27 | ✅ ACTIVE (v3.0.0) |

**Total:** 4 models (ALL 4 in ensemble)

**Breaking Change (Oct 13, 2025):** Smart Money Flow v3.0.0 has been integrated into the ensemble!

---

## Ensemble Flow (Simplified)

```
User Request (include_ml=true)
        │
        ▼
┌─────────────────────┐
│  VFR Analysis       │  85% weight (base score)
│  AlgorithmEngine    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  ML Ensemble (Parallel Execution)       │  15% weight (enhancement)
│  ┌───────────────────────────────────┐  │
│  │  Model 1: Sentiment Fusion        │  │
│  │  Model 2: Price Prediction        │  │
│  │  Model 3: Early Signal Detection  │  │
│  │  Model 4: Smart Money Flow ✨ NEW │  │
│  └───────────────────────────────────┘  │
│                  │                       │
│                  ▼                       │
│  ┌───────────────────────────────────┐  │
│  │  Weighted Voting Algorithm        │  │
│  │  • 45% Sentiment Fusion           │  │
│  │  • 27% Price Prediction           │  │
│  │  • 18% Early Signal               │  │
│  │  • 10% Smart Money Flow ✨ NEW    │  │
│  │  → Consensus: BULLISH/BEARISH     │  │
│  └───────────────────────────────────┘  │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  Final Score        │  = (VFR × 0.85) + (ML × 0.15)
│  Enhanced Response  │
└─────────────────────┘
```

---

## Weighted Voting Example

**Symbol:** AAPL

| Model | Vote | Confidence | Weight | Contribution |
|-------|------|-----------|--------|--------------|
| Sentiment Fusion | BULLISH | 0.72 | 45% | 0.324 |
| Price Prediction | BULLISH | 0.65 | 27% | 0.176 |
| Early Signal | NEUTRAL | 0.55 | 18% | 0.099 (neutral) |
| Smart Money Flow | BULLISH | 0.70 | 10% | 0.070 ✨ NEW |

**Result:**
- Bullish Score: 0.570 (57.0%)
- Neutral Score: 0.099 (9.9%)
- Bearish Score: 0.0 (0%)
- **Consensus: BULLISH @ 57.0% confidence**

---

## Key Files

| Component | File | Description |
|-----------|------|-------------|
| **API Entry** | `/app/api/stocks/analyze/route.ts` | Accepts `include_ml` parameter |
| **Ensemble Service** | `/app/services/stock-selection/MLEnhancedStockSelectionService.ts` | Orchestrates VFR + ML |
| **Voting Engine** | `/app/services/ml/prediction/RealTimePredictionEngine.ts` | Weighted voting algorithm |
| **Individual Models** | `/app/services/ml/{model-name}/{Model}Service.ts` | Individual model services |
| **Model Registry** | `/app/services/ml/models/ModelRegistry.ts` | PostgreSQL model tracking |
| **Ensemble Service** | `/app/services/ml/ensemble/EnsembleService.ts` | Alternative ensemble implementation |

---

## How to Enable Ensemble

### API Request
```bash
POST /api/stocks/analyze
Content-Type: application/json

{
  "mode": "single",
  "symbols": ["AAPL"],
  "include_ml": true,          # ← REQUIRED (default: false)
  "ml_horizon": "1w",          # Optional: 1h, 4h, 1d, 1w, 1m
  "ml_confidence_threshold": 0.5,
  "ml_weight": 0.15            # ML contribution (15%)
}
```

### Response Structure
```json
{
  "success": true,
  "data": {
    "stocks": [
      {
        "symbol": "AAPL",
        "compositeScore": 78.5,    # 85% VFR + 15% ML
        "mlPrediction": {          # Ensemble results
          "consensus": {
            "signal": "BULLISH",
            "confidence": 0.68,
            "score": 84
          },
          "votes": [               # Individual model votes
            {
              "modelName": "sentiment-fusion",
              "signal": "BULLISH",
              "confidence": 0.72,
              "prediction": 0.15
            },
            {
              "modelName": "price-prediction",
              "signal": "BULLISH",
              "confidence": 0.65,
              "prediction": 0.12
            },
            {
              "modelName": "early-signal-detection",
              "signal": "NEUTRAL",
              "confidence": 0.55,
              "prediction": 0.05
            },
            {
              "modelName": "smart-money-flow",
              "signal": "BULLISH",
              "confidence": 0.70,
              "prediction": 0.08
            }
          ],
          "breakdown": {
            "bullish": 0.67,
            "bearish": 0.00,
            "neutral": 0.33
          },
          "lowConsensus": false    # True if models disagree
        },
        "smart_money_flow": {      # Separate indicator
          "action": "BUY",
          "confidence": 0.72
        }
      }
    ],
    "metadata": {
      "mlEnhancement": {
        "mlEnabled": true,
        "mlAvailable": true,
        "mlPredictionsCount": 4,  ✨ UPDATED from 3 to 4
        "mlEnhancementApplied": true,
        "mlAverageConfidence": 0.66,
        "mlLatency": 450
      }
    }
  }
}
```

---

## Architecture Strengths

✅ **True ensemble learning** (weighted voting)
✅ **Parallel model execution** (Promise.all)
✅ **Confidence-based weighting** (not simple averaging)
✅ **Graceful degradation** (falls back to VFR if ML fails)
✅ **Model diversity** (different feature sets, prediction horizons)
✅ **Performance monitoring** (cache hits, latencies, failures)
✅ **Clean separation** (VFR works independently)

---

## Architecture Weaknesses

⚠️ **Disabled by default** (`include_ml: false`)
⚠️ **Duplicate prediction paths** (ensemble vs individual)
⚠️ **Hardcoded weights** (not performance-based)
⚠️ **No model registry sync** (manual weight updates)

---

## Quick Diagnostics

### Check if Ensemble is Running
```bash
# Check logs for ensemble activation
grep "predictEnsemble" logs/app.log

# Expected output (updated Oct 13, 2025):
[RealTimePredictionEngine] Starting ensemble prediction for AAPL
[RealTimePredictionEngine] Found 4 deployed models ✨ UPDATED
[RealTimePredictionEngine] sentiment-fusion: BULLISH (72% confident)
[RealTimePredictionEngine] price-prediction: BULLISH (65% confident)
[RealTimePredictionEngine] early-signal-detection: NEUTRAL (55% confident)
[RealTimePredictionEngine] smart-money-flow: BULLISH (70% confident) ✨ NEW
[RealTimePredictionEngine] Consensus for AAPL: BULLISH (68% confident)
```

### Check Model Registry
```sql
SELECT model_name, model_version, status
FROM ml_models
WHERE status = 'deployed';

-- Expected output (4 models as of Oct 13, 2025):
early-signal-detection  | v1.0.0 | deployed
price-prediction        | v1.1.0 | deployed
sentiment-fusion        | v1.1.0 | deployed
smart-money-flow        | v3.0.0 | deployed ✨ NEW
```

### Verify Model Files
```bash
ls -la models/*/v*/model.txt

# Expected output:
models/early-signal/v1.0.0/model.txt
models/price-prediction/v1.1.0/model.txt
models/sentiment-fusion/v1.1.0/model.txt
models/smart-money-flow/v3.0.0/model.txt
```

---

## Recommendations

### 1. Enable by Default (HIGH)
```typescript
// app/api/stocks/analyze/route.ts (line 45)
include_ml: z.boolean().optional().default(true),  // ← Change to true
```

### 2. Remove Individual Flags (MEDIUM)
Deprecate:
- `includeEarlySignal`
- `includePricePrediction`
- `includeSentimentFusion`

Keep only:
- `include_ml` (ensemble)
- `includeSmartMoneyFlow` (separate)

### 3. Dynamic Weights (MEDIUM)
Implement `WeightCalculator` to adjust weights based on historical accuracy.

### 4. Model Registry Integration (LOW)
Store weights in PostgreSQL `ml_models.weight` column.

---

## Comparison: Ensemble vs Individual Models

| Aspect | Ensemble (Recommended) | Individual Models (Legacy) |
|--------|----------------------|---------------------------|
| **Activation** | `include_ml: true` | `includeEarlySignal: true`, etc. |
| **Combination** | ✅ Weighted voting | ❌ No combination |
| **Confidence** | ✅ Consensus confidence | ❌ Independent |
| **Performance** | ✅ Better (reduced variance) | ⚠️ Higher variance |
| **Complexity** | Simple API | Multiple flags |
| **Status** | ✅ Current architecture | ⚠️ Legacy (should deprecate) |

---

## Recent Updates

### October 13, 2025 - Smart Money Flow Integration
- ✅ Smart Money Flow v3.0.0 integrated into ensemble
- ✅ Ensemble weight: 10% (specialized institutional activity signal)
- ✅ Model registered in ModelRegistry database
- ✅ Feature toggle: Changed defaultState from false → true
- ✅ Total ensemble models: 3 → 4

### Key Changes
- Ensemble voting weights rebalanced: 45% / 27% / 18% / 10%
- Model registry query now returns 4 deployed models
- Ensemble logs show "Found 4 deployed models"
- API responses include 4 model votes (was 3)

---

**Document Version:** 2.0
**Last Updated:** October 13, 2025 (Smart Money Flow Integration)
**Status:** ✅ TRUE ENSEMBLE CONFIRMED - 4 MODELS
