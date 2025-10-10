# ML Model Loading and Ensemble Confidence Architecture

**Last Updated:** 2025-10-10
**Status:** PRODUCTION
**Author:** VFR ML Team

## Table of Contents

1. [Overview](#overview)
2. [Critical Bug Fix: Model Loading Independence](#critical-bug-fix-model-loading-independence)
3. [Model Directory Structure](#model-directory-structure)
4. [Model Path Resolution](#model-path-resolution)
5. [Ensemble Voting System](#ensemble-voting-system)
6. [Database Schema](#database-schema)
7. [Adding New Models](#adding-new-models)
8. [Troubleshooting](#troubleshooting)
9. [Performance Considerations](#performance-considerations)

---

## Overview

The VFR API uses a **multi-model ensemble architecture** where three independent ML models work together to generate stock predictions:

1. **sentiment-fusion** (v1.1.0) - News sentiment + price analysis (50% weight)
2. **price-prediction** (v1.1.0) - Technical + fundamental analysis (30% weight)
3. **early-signal-detection** (v1.0.0) - Analyst rating predictions (20% weight)

Each model:
- **Loads independently** from its own directory
- **Runs its own inference** using Python LightGBM
- **Contributes a weighted vote** to the final ensemble prediction
- **Maintains its own normalizer** for feature preprocessing

The ensemble system combines these independent predictions into a consensus signal (BULLISH/BEARISH/NEUTRAL) with confidence scoring.

---

## Critical Bug Fix: Model Loading Independence

### The Problem (RESOLVED)

**Date Discovered:** 2025-10-10
**Severity:** CRITICAL
**Impact:** All 3 models were loading the SAME model file, producing identical 41% confidence predictions

**Root Cause:**
The `ml_models` PostgreSQL table does NOT have an `artifact_path` column. When all models had `artifactPath` undefined, the fallback path construction in `RealTimePredictionEngine.ts` was using a **static base path** that didn't incorporate the model-specific `modelName`.

**Incorrect Code (BEFORE):**
```typescript
// Line 999-1003 in RealTimePredictionEngine.ts (WRONG)
const modelPath = model.artifactPath ||
  path.join(process.cwd(), `models/sentiment-fusion/v1.1.0/model.txt`);
```

All three models would fallback to the same hard-coded path, loading `sentiment-fusion` for every prediction.

### The Fix

**Correct Code (AFTER):**
```typescript
// Line 999-1003 in RealTimePredictionEngine.ts (CORRECT)
const modelPath = model.artifactPath ||
  path.join(process.cwd(), `models/${model.modelName}/${model.modelVersion}/model.txt`);
```

**Key Changes:**
1. **Dynamic path construction** using `model.modelName` and `model.modelVersion`
2. Each model loads from its own directory: `models/{modelName}/{modelVersion}/model.txt`
3. Each model uses its own normalizer: `models/{modelName}/{modelVersion}/normalizer.json`

**Result:**
- ✅ sentiment-fusion loads from `models/sentiment-fusion/v1.1.0/model.txt`
- ✅ price-prediction loads from `models/price-prediction/v1.1.0/model.txt`
- ✅ early-signal loads from `models/early-signal/v1.0.0/model.txt`
- ✅ Each model produces **independent predictions** with **different confidence values**

---

## Model Directory Structure

### Required Directory Layout

```
models/
├── sentiment-fusion/
│   └── v1.1.0/
│       ├── model.txt              # LightGBM model file
│       ├── normalizer.json        # Feature normalization params
│       ├── metadata.json          # Model metadata
│       ├── feature_importance.csv # Feature rankings
│       └── test_evaluation.json   # Performance metrics
│
├── price-prediction/
│   └── v1.1.0/
│       ├── model.txt
│       ├── normalizer.json
│       ├── metadata.json
│       ├── feature_importance.csv
│       └── test_evaluation.json
│
└── early-signal/
    └── v1.0.0/
        ├── model.txt
        ├── normalizer.json
        ├── metadata.json
        ├── feature_importance.csv
        └── test_evaluation.json
```

### File Descriptions

#### model.txt
**Format:** LightGBM text format
**Purpose:** Serialized gradient boosting model
**Size:** ~10-500MB depending on complexity

**Loading:**
```python
import lightgbm as lgb
model = lgb.Booster(model_file='model.txt')
```

#### normalizer.json
**Format:** JSON
**Purpose:** Feature normalization parameters (z-score)
**Schema:**
```json
{
  "feature_name": {
    "mean": 0.0245,
    "std": 0.0892
  },
  "another_feature": {
    "mean": -0.15,
    "std": 0.34
  }
}
```

**Usage:**
```python
normalized_value = (raw_value - mean) / std
```

#### metadata.json
**Format:** JSON
**Purpose:** Model training metadata and performance metrics
**Schema:**
```json
{
  "model_version": "v1.1.0",
  "model_type": "sentiment-fusion",
  "algorithm": "LightGBM",
  "objective": "multiclass",
  "num_classes": 3,
  "classes": ["DOWN", "NEUTRAL", "UP"],
  "training_date": "2025-10-09T21:09:18.536489",
  "training_examples": 34846,
  "validation_examples": 7467,
  "num_features": 45,
  "performance": {
    "validation_accuracy": 0.5379670550421857,
    "best_iteration": 1000,
    "total_iterations": 1000
  },
  "top_features": [
    {"feature": "volatility_20d", "importance": 5206},
    {"feature": "atr_14", "importance": 4420}
  ]
}
```

---

## Model Path Resolution

### Database Schema

**Table:** `ml_models`

```sql
CREATE TABLE ml_models (
    model_id UUID PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL,     -- e.g., "sentiment-fusion"
    model_version VARCHAR(50) NOT NULL,    -- e.g., "v1.1.0"
    model_type VARCHAR(100) NOT NULL,      -- e.g., "lightgbm"
    objective VARCHAR(100) NOT NULL,       -- e.g., "price_prediction"
    target_variable VARCHAR(255) NOT NULL,
    prediction_horizon VARCHAR(20) NOT NULL,
    validation_score DECIMAL(10,6),
    test_score DECIMAL(10,6),
    tier_requirement VARCHAR(20) DEFAULT 'premium',
    status VARCHAR(50) DEFAULT 'deployed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(model_name, model_version)
);
```

**IMPORTANT:** There is **NO `artifact_path` column** in the database.

### Path Resolution Logic

**Location:** `app/services/ml/prediction/RealTimePredictionEngine.ts` (lines 999-1003)

```typescript
private async runInference(
  model: ModelMetadata,
  features: MLFeatureVector
): Promise<{
  value: number;
  confidence: number;
  probability?: { up: number; down: number; neutral: number };
}> {
  try {
    // Ensure Python subprocess is running
    await this.ensurePythonProcess();

    // CRITICAL: Dynamic path construction using model metadata
    const modelPath = model.artifactPath ||
      path.join(process.cwd(), `models/${model.modelName}/${model.modelVersion}/model.txt`);

    const normalizerPath = path.join(path.dirname(modelPath), "normalizer.json");

    // Call Python for real model inference
    const prediction = await this.callPython(features.features, modelPath, normalizerPath);

    return prediction;
  } catch (error) {
    throw new Error(
      `Inference failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
```

### Fallback Path Construction

**Format:**
```
{projectRoot}/models/{modelName}/{modelVersion}/model.txt
```

**Examples:**
```typescript
// sentiment-fusion model
path.join(process.cwd(), `models/sentiment-fusion/v1.1.0/model.txt`)
// → /Users/user/project/models/sentiment-fusion/v1.1.0/model.txt

// price-prediction model
path.join(process.cwd(), `models/price-prediction/v1.1.0/model.txt`)
// → /Users/user/project/models/price-prediction/v1.1.0/model.txt

// early-signal model
path.join(process.cwd(), `models/early-signal/v1.0.0/model.txt`)
// → /Users/user/project/models/early-signal/v1.0.0/model.txt
```

### Why No artifact_path Column?

**Design Decision:**
1. **Convention over configuration** - Standard directory structure enforces consistency
2. **Simplifies deployment** - No need to update database paths when deploying new models
3. **Version control friendly** - Model versions are part of directory structure
4. **Reduces errors** - Can't accidentally point to wrong model file

**Alternative Approach (NOT USED):**
If you needed custom paths, you could:
1. Add `artifact_path` column to `ml_models` table
2. Update model registration to set custom paths
3. Fallback would still work for backwards compatibility

---

## Ensemble Voting System

### Weighted Voting Architecture

**Location:** `app/services/ml/prediction/RealTimePredictionEngine.ts` (lines 596-664)

```typescript
private calculateConsensus(votes: ModelVote[]): {
  signal: MLSignal;
  confidence: number;
  score: number;
} {
  // Weight models based on their purpose and reliability
  const weights: Record<string, number> = {
    "sentiment-fusion": 0.5,      // 50% weight - most comprehensive
    "price-prediction": 0.3,      // 30% weight - baseline price model
    "early-signal-detection": 0.2 // 20% weight - analyst signals
  };

  let bullishScore = 0;
  let bearishScore = 0;
  let neutralScore = 0;
  let totalWeight = 0;

  // Accumulate weighted votes
  votes.forEach(vote => {
    const weight = weights[vote.modelName] || 0.33; // Default equal weight
    const confidenceWeight = weight * vote.confidence;

    if (vote.signal === "BULLISH") {
      bullishScore += confidenceWeight;
    } else if (vote.signal === "BEARISH") {
      bearishScore += confidenceWeight;
    } else {
      neutralScore += confidenceWeight;
    }

    totalWeight += weight;
  });

  // Normalize scores (0-1 range)
  if (totalWeight > 0) {
    bullishScore /= totalWeight;
    bearishScore /= totalWeight;
    neutralScore /= totalWeight;
  }

  // Determine consensus (highest weighted score wins)
  const maxScore = Math.max(bullishScore, bearishScore, neutralScore);
  let signal: MLSignal;
  let confidence: number;

  if (maxScore === bullishScore) {
    signal = "BULLISH";
    confidence = bullishScore;
  } else if (maxScore === bearishScore) {
    signal = "BEARISH";
    confidence = bearishScore;
  } else {
    signal = "NEUTRAL";
    confidence = neutralScore;
  }

  // Calculate 0-100 composite score
  // BULLISH: 50-100, BEARISH: 0-50, NEUTRAL: 50
  let score: number;
  if (signal === "BULLISH") {
    score = 50 + confidence * 50; // Maps [0,1] to [50,100]
  } else if (signal === "BEARISH") {
    score = 50 - confidence * 50; // Maps [0,1] to [0,50]
  } else {
    score = 50; // Neutral baseline
  }

  return { signal, confidence, score };
}
```

### Model Weights Explained

**sentiment-fusion (50%)**
- **Why 50%:** Combines news sentiment AND price technicals
- **Features:** 45 features including sentiment scores + technical indicators
- **Best for:** Capturing market sentiment shifts and news-driven moves
- **Accuracy:** 53.8% validation accuracy (v1.1.0)

**price-prediction (30%)**
- **Why 30%:** Pure technical + fundamental analysis
- **Features:** Price momentum, volume, technical indicators, fundamentals
- **Best for:** Traditional price trend analysis
- **Accuracy:** Varies by version

**early-signal-detection (20%)**
- **Why 20%:** Specialized analyst upgrade/downgrade predictions
- **Features:** 28 features including analyst coverage, institutional flow
- **Best for:** Early detection of analyst rating changes
- **Accuracy:** Focused on specific event prediction

### Confidence Weighting

Each model's confidence score multiplies its base weight:

```typescript
// Example calculation
const sentimentVote = {
  modelName: "sentiment-fusion",
  signal: "BULLISH",
  confidence: 0.75
};

const effectiveWeight = 0.5 * 0.75 = 0.375; // 37.5% contribution
```

If all models are highly confident:
- sentiment-fusion @ 0.9 confidence → 0.5 * 0.9 = 0.45
- price-prediction @ 0.8 confidence → 0.3 * 0.8 = 0.24
- early-signal @ 0.7 confidence → 0.2 * 0.7 = 0.14
- **Total confidence:** 0.83 (normalized by sum of weights)

### Signal Mapping

**Location:** `app/services/ml/prediction/RealTimePredictionEngine.ts` (lines 579-592)

```typescript
private mapPredictionToSignal(value: number, modelName: string): MLSignal {
  // Early-signal-detection: positive value = analyst upgrade likely
  if (modelName.includes("early-signal")) {
    if (value > 0.6) return "BULLISH";  // High confidence upgrade
    if (value < -0.6) return "BEARISH"; // High confidence downgrade
    return "NEUTRAL";
  }

  // Price-prediction and sentiment-fusion: prediction is price direction
  // Positive = UP (BULLISH), Negative = DOWN (BEARISH)
  if (value > 0.15) return "BULLISH";  // Strong upward prediction
  if (value < -0.15) return "BEARISH"; // Strong downward prediction
  return "NEUTRAL"; // Mixed or uncertain
}
```

**Threshold Rationale:**
- **±0.15:** ~15% expected price movement required for strong signal
- **±0.6:** Higher threshold for early-signal due to different objective
- **Between thresholds:** Conservative NEUTRAL to avoid false signals

### Example Ensemble Calculation

**Scenario:** AAPL prediction with all 3 models

| Model | Signal | Raw Confidence | Base Weight | Weighted Vote |
|-------|--------|----------------|-------------|---------------|
| sentiment-fusion | BULLISH | 0.78 | 0.5 | 0.39 |
| price-prediction | BULLISH | 0.65 | 0.3 | 0.195 |
| early-signal | NEUTRAL | 0.52 | 0.2 | 0.104 (neutral) |

**Calculation:**
```
Bullish Score = (0.39 + 0.195) / 1.0 = 0.585
Neutral Score = 0.104 / 1.0 = 0.104
Bearish Score = 0.0 / 1.0 = 0.0

Max Score = 0.585 (Bullish)
Consensus = BULLISH with 58.5% confidence
Composite Score = 50 + (0.585 * 50) = 79.25
```

**Result:**
```json
{
  "consensus": {
    "signal": "BULLISH",
    "confidence": 0.585,
    "score": 79.25
  },
  "votes": [
    {
      "modelName": "sentiment-fusion",
      "modelVersion": "v1.1.0",
      "signal": "BULLISH",
      "confidence": 0.78
    },
    {
      "modelName": "price-prediction",
      "modelVersion": "v1.1.0",
      "signal": "BULLISH",
      "confidence": 0.65
    },
    {
      "modelName": "early-signal-detection",
      "modelVersion": "v1.0.0",
      "signal": "NEUTRAL",
      "confidence": 0.52
    }
  ],
  "breakdown": {
    "bullish": 0.67,  // 2 out of 3 models
    "bearish": 0.0,
    "neutral": 0.33   // 1 out of 3 models
  }
}
```

---

## Database Schema

### ml_models Table

**Current Schema:**

```sql
CREATE TABLE ml_models (
    model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(255) NOT NULL,      -- "sentiment-fusion", "price-prediction", "early-signal"
    model_version VARCHAR(50) NOT NULL,     -- "v1.1.0", "v1.0.0"
    model_type VARCHAR(100) NOT NULL,       -- "lightgbm"
    objective VARCHAR(100) NOT NULL,        -- "price_prediction", "direction_classification"
    target_variable VARCHAR(255) NOT NULL,  -- e.g., "price_return_5d"
    prediction_horizon VARCHAR(20) NOT NULL, -- "1w", "1d", "1m"

    -- Performance Metrics
    validation_score DECIMAL(10,6),
    test_score DECIMAL(10,6),

    -- Tier Management
    tier_requirement VARCHAR(20) DEFAULT 'premium',

    -- Deployment Status
    status VARCHAR(50) DEFAULT 'deployed',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(model_name, model_version)
);
```

**Key Points:**
- ❌ **NO artifact_path column** - paths are constructed dynamically
- ✅ **UNIQUE(model_name, model_version)** - prevents duplicate registrations
- ✅ **status** - tracks deployment state (training, validated, deployed, shadow, deprecated)

### Model Registration Example

```sql
-- Register sentiment-fusion v1.1.0
INSERT INTO ml_models (
    model_name,
    model_version,
    model_type,
    objective,
    target_variable,
    prediction_horizon,
    validation_score,
    test_score,
    tier_requirement,
    status
) VALUES (
    'sentiment-fusion',
    'v1.1.0',
    'lightgbm',
    'direction_classification',
    'price_direction_3d',
    '1w',
    0.5380,  -- 53.8% accuracy
    0.5250,
    'premium',
    'deployed'
);

-- Register price-prediction v1.1.0
INSERT INTO ml_models (
    model_name,
    model_version,
    model_type,
    objective,
    target_variable,
    prediction_horizon,
    validation_score,
    tier_requirement,
    status
) VALUES (
    'price-prediction',
    'v1.1.0',
    'lightgbm',
    'price_prediction',
    'price_return_5d',
    '1w',
    0.6200,
    'premium',
    'deployed'
);

-- Register early-signal v1.0.0
INSERT INTO ml_models (
    model_name,
    model_version,
    model_type,
    objective,
    target_variable,
    prediction_horizon,
    validation_score,
    tier_requirement,
    status
) VALUES (
    'early-signal-detection',
    'v1.0.0',
    'lightgbm',
    'direction_classification',
    'analyst_rating_change',
    '2w',
    0.5800,
    'premium',
    'deployed'
);
```

### Querying Deployed Models

```sql
-- Get all deployed models
SELECT
    model_name,
    model_version,
    validation_score,
    status,
    created_at
FROM ml_models
WHERE status = 'deployed'
ORDER BY created_at DESC;

-- Get specific model details
SELECT *
FROM ml_models
WHERE model_name = 'sentiment-fusion'
  AND model_version = 'v1.1.0';

-- Check model history
SELECT
    model_name,
    model_version,
    validation_score,
    status,
    created_at
FROM ml_models
WHERE model_name = 'sentiment-fusion'
ORDER BY created_at DESC;
```

---

## Adding New Models

### Step-by-Step Guide

#### 1. Train and Export Model

```bash
# Train new model using Python
python3 scripts/ml/train-new-model.py

# Expected output files:
# - models/{model-name}/{version}/model.txt
# - models/{model-name}/{version}/normalizer.json
# - models/{model-name}/{version}/metadata.json
```

#### 2. Create Model Directory Structure

```bash
# Example: Adding "volatility-forecast" v1.0.0
mkdir -p models/volatility-forecast/v1.0.0

# Move trained model files
mv /tmp/model.txt models/volatility-forecast/v1.0.0/
mv /tmp/normalizer.json models/volatility-forecast/v1.0.0/
mv /tmp/metadata.json models/volatility-forecast/v1.0.0/
```

**Required Files:**
- ✅ `model.txt` - LightGBM model file
- ✅ `normalizer.json` - Feature normalization parameters
- ✅ `metadata.json` - Model metadata and performance metrics

**Optional Files:**
- `feature_importance.csv` - Feature rankings
- `test_evaluation.json` - Test set performance
- `training_args.bin` - Hyperparameters

#### 3. Register Model in Database

```typescript
// scripts/ml/register-new-model.ts
import { ModelRegistry, ModelType, ModelObjective, ModelStatus, TierRequirement } from '../app/services/ml/models/ModelRegistry';

async function registerNewModel() {
  const registry = ModelRegistry.getInstance();
  await registry.initialize();

  const result = await registry.registerModel({
    modelName: 'volatility-forecast',
    modelVersion: 'v1.0.0',
    modelType: ModelType.LIGHTGBM,
    objective: ModelObjective.VOLATILITY_FORECAST,
    targetVariable: 'volatility_30d',
    predictionHorizon: '1m',
    validationScore: 0.6750,
    testScore: 0.6500,
    tierRequirement: TierRequirement.PREMIUM,
    status: ModelStatus.DEPLOYED
  });

  if (result.success) {
    console.log('Model registered:', result.data.modelId);
  } else {
    console.error('Registration failed:', result.error);
  }
}

registerNewModel();
```

```bash
# Run registration
npx ts-node scripts/ml/register-new-model.ts
```

#### 4. Update Ensemble Weights (if adding to ensemble)

**Location:** `app/services/ml/prediction/RealTimePredictionEngine.ts` (line 603)

```typescript
private calculateConsensus(votes: ModelVote[]): {
  signal: MLSignal;
  confidence: number;
  score: number;
} {
  // Add new model to weights
  const weights: Record<string, number> = {
    "sentiment-fusion": 0.45,        // Reduced from 0.5
    "price-prediction": 0.25,        // Reduced from 0.3
    "early-signal-detection": 0.15,  // Reduced from 0.2
    "volatility-forecast": 0.15      // NEW MODEL (15%)
  };

  // Rest of consensus calculation...
}
```

**Weight Allocation Principles:**
1. **Total must equal 1.0** (or close to it for normalization)
2. **Higher weight** = More influential in consensus
3. **Consider accuracy** - Better performing models should have higher weight
4. **Consider objective** - Broader objectives (sentiment-fusion) deserve higher weight
5. **Start conservative** - Begin with 10-15% weight, increase if model proves reliable

#### 5. Update Signal Mapping (if needed)

If your model has a unique output format or interpretation:

```typescript
private mapPredictionToSignal(value: number, modelName: string): MLSignal {
  // Existing models...
  if (modelName.includes("early-signal")) {
    if (value > 0.6) return "BULLISH";
    if (value < -0.6) return "BEARISH";
    return "NEUTRAL";
  }

  // NEW: volatility-forecast uses different thresholds
  if (modelName.includes("volatility-forecast")) {
    // High volatility = NEUTRAL (uncertain), Low volatility = depends on direction
    if (value > 0.5) return "NEUTRAL";  // High volatility
    // Use price direction for low volatility periods
    // ... (implement your logic)
  }

  // Default price/sentiment models
  if (value > 0.15) return "BULLISH";
  if (value < -0.15) return "BEARISH";
  return "NEUTRAL";
}
```

#### 6. Verify Model Loading

```bash
# Test model loading
npx ts-node scripts/ml/test-model-loading.ts
```

**Test Script Example:**
```typescript
// scripts/ml/test-model-loading.ts
import { RealTimePredictionEngine } from '../app/services/ml/prediction/RealTimePredictionEngine';
import { ModelRegistry } from '../app/services/ml/models/ModelRegistry';

async function testModelLoading() {
  const registry = ModelRegistry.getInstance();
  await registry.initialize();

  // Get deployed models
  const result = await registry.getDeployedModels();

  if (result.success && result.data) {
    console.log(`Found ${result.data.length} deployed models:`);
    result.data.forEach(model => {
      const expectedPath = `models/${model.modelName}/${model.modelVersion}/model.txt`;
      console.log(`  - ${model.modelName} v${model.modelVersion}`);
      console.log(`    Expected path: ${expectedPath}`);

      // Verify files exist
      const fs = require('fs');
      const path = require('path');
      const fullPath = path.join(process.cwd(), expectedPath);

      if (fs.existsSync(fullPath)) {
        console.log(`    ✅ Model file found`);
      } else {
        console.log(`    ❌ Model file NOT found`);
      }

      const normalizerPath = path.join(process.cwd(), `models/${model.modelName}/${model.modelVersion}/normalizer.json`);
      if (fs.existsSync(normalizerPath)) {
        console.log(`    ✅ Normalizer found`);
      } else {
        console.log(`    ❌ Normalizer NOT found`);
      }
    });
  }
}

testModelLoading();
```

#### 7. Integration Testing

```bash
# Test ensemble prediction with new model
curl -X POST http://localhost:3000/api/stocks/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL"],
    "include_ml": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "consensus": {
      "signal": "BULLISH",
      "confidence": 0.72,
      "score": 86
    },
    "votes": [
      {
        "modelName": "sentiment-fusion",
        "modelVersion": "v1.1.0",
        "signal": "BULLISH",
        "confidence": 0.78
      },
      {
        "modelName": "price-prediction",
        "modelVersion": "v1.1.0",
        "signal": "BULLISH",
        "confidence": 0.68
      },
      {
        "modelName": "early-signal-detection",
        "modelVersion": "v1.0.0",
        "signal": "NEUTRAL",
        "confidence": 0.55
      },
      {
        "modelName": "volatility-forecast",
        "modelVersion": "v1.0.0",
        "signal": "BULLISH",
        "confidence": 0.82
      }
    ],
    "breakdown": {
      "bullish": 0.75,
      "bearish": 0.0,
      "neutral": 0.25
    }
  }
}
```

---

## Troubleshooting

### Model Not Loading

**Symptom:** Error "Model not found" or "Failed to load model"

**Diagnosis:**
```bash
# 1. Check if model directory exists
ls -la models/sentiment-fusion/v1.1.0/

# 2. Check if model.txt exists
ls -lh models/sentiment-fusion/v1.1.0/model.txt

# 3. Check database registration
psql -d vfr_api -c "SELECT model_name, model_version, status FROM ml_models WHERE model_name = 'sentiment-fusion';"

# 4. Check logs
tail -f logs/ml-predictions.log | grep "model loading"
```

**Common Causes:**
1. **Missing model files** - Run training script to generate model.txt
2. **Wrong directory structure** - Must be `models/{modelName}/{modelVersion}/model.txt`
3. **Not registered in database** - Run registration script
4. **Status not 'deployed'** - Update status to 'deployed'
5. **Permissions** - Ensure model files are readable by application

**Fix:**
```bash
# Ensure proper directory structure
mkdir -p models/sentiment-fusion/v1.1.0

# Copy model files
cp /path/to/model.txt models/sentiment-fusion/v1.1.0/
cp /path/to/normalizer.json models/sentiment-fusion/v1.1.0/

# Fix permissions
chmod 644 models/sentiment-fusion/v1.1.0/*

# Register or update model
npx ts-node scripts/ml/register-sentiment-fusion-model.ts
```

### All Models Return Same Prediction

**Symptom:** All 3 models show identical confidence values (e.g., all 41%)

**Diagnosis:**
```typescript
// Add debug logging in RealTimePredictionEngine.ts
console.log('[DEBUG] Model path:', modelPath);
console.log('[DEBUG] Model name:', model.modelName);
console.log('[DEBUG] Model version:', model.modelVersion);
```

**Common Causes:**
1. **Static path fallback** - Path construction not using dynamic model name
2. **All models loading same file** - Check path construction logic
3. **Cached Python process** - Python subprocess caching wrong model

**Fix:**
```typescript
// CORRECT path construction
const modelPath = model.artifactPath ||
  path.join(process.cwd(), `models/${model.modelName}/${model.modelVersion}/model.txt`);

// WRONG - Static path
const modelPath = model.artifactPath ||
  path.join(process.cwd(), `models/sentiment-fusion/v1.1.0/model.txt`);
```

**Verify Fix:**
```bash
# Restart Python subprocess
pkill -f "predict-generic.py"

# Test prediction again
curl -X POST http://localhost:3000/api/stocks/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["AAPL"], "include_ml": true}'

# Check logs for different model paths
tail -f logs/ml-predictions.log | grep "model path"
```

### Low Consensus Confidence

**Symptom:** Ensemble confidence always below 50%

**Diagnosis:**
```sql
-- Check model performance scores
SELECT
    model_name,
    model_version,
    validation_score,
    test_score
FROM ml_models
WHERE status = 'deployed'
ORDER BY validation_score DESC;
```

**Common Causes:**
1. **Models disagree** - One says BULLISH, one says BEARISH (expected for NEUTRAL stocks)
2. **Low individual confidence** - All models uncertain
3. **Wrong signal thresholds** - Thresholds too conservative

**Solutions:**
1. **Accept low confidence** for neutral/uncertain stocks
2. **Adjust signal thresholds** if too conservative:
   ```typescript
   // Relax thresholds
   if (value > 0.10) return "BULLISH";  // Was 0.15
   if (value < -0.10) return "BEARISH"; // Was -0.15
   ```
3. **Improve model training** if consistently low confidence
4. **Check feature quality** - Ensure features are being computed correctly

### Python Subprocess Timeout

**Symptom:** "Python prediction timeout (5s)" errors

**Diagnosis:**
```bash
# Check Python process
ps aux | grep predict-generic.py

# Check Python logs
tail -f logs/python-predictions.log
```

**Common Causes:**
1. **Model file too large** - Loading takes >5s
2. **First prediction** - Cold start penalty
3. **Feature extraction slow** - Too many features
4. **Python process crashed** - Not responding

**Fix:**
```typescript
// Increase timeout for model initialization
const mlTimeout = options.ml_timeout ?? 10000; // 10 seconds instead of 5

// In RealTimePredictionEngine.ts
await this.ensurePythonProcess(); // Ensure process ready before timeout starts
```

### Normalizer Not Found

**Symptom:** "Normalizer file not found" or normalization errors

**Diagnosis:**
```bash
# Check if normalizer.json exists
ls -la models/*/v*/normalizer.json

# Check normalizer format
cat models/sentiment-fusion/v1.1.0/normalizer.json | jq .
```

**Common Causes:**
1. **Missing normalizer.json** - Training script didn't generate it
2. **Wrong format** - Not valid JSON
3. **Empty normalizer** - No feature normalization params

**Fix:**
```bash
# Regenerate normalizer from training data
python3 scripts/ml/generate-normalizer.py \
  --input data/training/sentiment-fusion-train.csv \
  --output models/sentiment-fusion/v1.1.0/normalizer.json

# Verify format
cat models/sentiment-fusion/v1.1.0/normalizer.json | python3 -m json.tool
```

**Expected Format:**
```json
{
  "sentiment_positive": {
    "mean": 0.245,
    "std": 0.187
  },
  "sentiment_negative": {
    "mean": 0.132,
    "std": 0.098
  }
}
```

---

## Performance Considerations

### Model Loading Performance

**Cold Start (First Prediction):**
- Python subprocess startup: ~2-5 seconds
- Model loading (LightGBM): ~500ms - 2s per model
- **Total first prediction:** ~5-10 seconds

**Warm Predictions (Subprocess Running):**
- Feature extraction: ~100-300ms
- Model inference: ~10-50ms per model
- Ensemble voting: ~1-5ms
- **Total warm prediction:** ~150-500ms

**Optimization:**
1. **Keep Python subprocess alive** - Persistent process maintains loaded models
2. **Cache predictions** - 5-minute TTL in Redis
3. **Parallel model inference** - All 3 models run concurrently
4. **Async logging** - Don't wait for database writes

### Memory Usage

**Per Model:**
- sentiment-fusion (45 features): ~50MB in memory
- price-prediction (35 features): ~40MB
- early-signal (28 features): ~30MB
- **Total:** ~120MB for all 3 models

**Scaling:**
- Each additional model: +30-50MB
- Python subprocess overhead: ~100MB
- **Total per instance:** ~250MB for ML layer

### Cache Strategy

**Prediction Caching:**
```typescript
// 5-minute TTL for predictions
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache key format
const cacheKey = `ml:ensemble:${symbol}:${horizon}`;
```

**When to Cache:**
- ✅ Confidence >= 0.5 (threshold configurable)
- ✅ All models succeeded
- ✅ Recent data (< 10 minutes old)

**When NOT to Cache:**
- ❌ Low confidence (< 0.5)
- ❌ Any model failed
- ❌ Fallback mode used
- ❌ Stale features

### Scaling Considerations

**Single Instance:**
- Max 10 concurrent predictions
- ~250MB memory overhead
- ~500ms average latency (warm)

**Horizontal Scaling:**
- Each instance loads own models
- Redis shared cache across instances
- Database connection pooling required

**Model Updates:**
- Deploy new version to new directory
- Update database registration
- Gradual rollout (shadow mode)
- Monitor performance before full deployment

---

## Related Documentation

- **Model Training:** `docs/ml/continuous-improvement-strategy.md`
- **Feature Engineering:** `app/services/ml/CLAUDE.md`
- **API Integration:** `docs/api/API_ARCHITECTURE_REPORT.md`
- **Database Schema:** `database/CLAUDE.md`
- **Python Inference:** `scripts/ml/predict-generic.py`

---

## Changelog

**2025-10-10:**
- 🐛 **CRITICAL FIX:** Model path resolution bug causing all models to load same file
- ✅ Implemented dynamic path construction using `model.modelName` and `model.modelVersion`
- ✅ Verified each model loads independently from own directory
- ✅ Documented ensemble voting weights and consensus calculation
- ✅ Created comprehensive troubleshooting guide
