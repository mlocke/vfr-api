# Early Signal Detection - Future Enhancements

## Overview

This document tracks potential improvements to the Early Signal Detection ML model and training pipeline.

## Enhancement 1: Historical Sentiment Data Integration

### Current State (v1.0.0)

- **Training Data**: Uses neutral sentiment values (0) for all historical training examples
- **Rationale**: Live sentiment APIs (Reddit, News, Options) only return current sentiment, not historical
- **Impact**: Model learns to make predictions without heavy reliance on sentiment features
- **Benefits**:
    - Fast training data generation (~100ms per example vs 15-30s with live sentiment)
    - Robust predictions when sentiment APIs timeout or fail
    - No training-serving skew issues

### Proposed Enhancement

Integrate FMP's Historical Social Sentiment API into training data generation pipeline.

**API Endpoint**:

```
GET https://financialmodelingprep.com/api/v4/historical/social-sentiment?symbol=AAPL&page=0
```

**What It Provides**:

- Historical social sentiment from Reddit, StockTwits, Twitter, Yahoo Finance
- Time-series sentiment data for any historical date
- Sentiment scores and trends over time

### Implementation Plan

#### Phase 1: API Integration (2-3 hours)

1. Add `getHistoricalSocialSentiment()` method to `FinancialModelingPrepAPI`
2. Handle pagination to retrieve complete sentiment history
3. Add caching layer for historical sentiment (Redis TTL: 24 hours)
4. Map FMP sentiment scores to our feature format:
    - `sentiment_news_delta` → News/social sentiment change
    - `sentiment_reddit_accel` → Reddit sentiment acceleration
    - `sentiment_options_shift` → Market sentiment shift

#### Phase 2: Feature Extractor Update (1-2 hours)

1. Update `FeatureExtractor.getSentimentData()` to use historical API when in historical mode
2. Add date-based sentiment lookup (find sentiment closest to `asOfDate`)
3. Implement fallback: if historical sentiment unavailable, use neutral (0)
4. Add unit tests for historical sentiment feature extraction

#### Phase 3: Training Pipeline Update (1 hour)

1. Update `generate-training-data.ts` to use historical sentiment by default
2. Add `--skip-sentiment` flag for fast training without sentiment
3. Update dataset versioning: v2.0.0 → v2.1.0 (with historical sentiment)

#### Phase 4: Model Retraining & Evaluation (2-3 hours)

1. Generate new training dataset (v2.1.0) with historical sentiment
2. Train new model and compare performance metrics:
    - Accuracy
    - Precision/Recall
    - Feature importance (check if sentiment features become more important)
3. A/B test: v1.0.0 (no sentiment) vs v2.1.0 (with sentiment)
4. Deploy better-performing model

### Expected Impact

**Performance Improvements**:

- Potentially higher accuracy if sentiment is predictive of early signals
- Better feature importance distribution across all 13 features
- More realistic training data (sentiment included as originally designed)

**Trade-offs**:

- Slower training data generation (requires API calls for each example)
- Requires premium FMP API tier (verify cost/rate limits)
- More API quota consumption during training

### Cost Analysis

**API Usage**:

- Historical sentiment: ~100 API calls per symbol (pagination)
- Full S&P 100 training: 100 symbols × 12 earnings × ~5 sentiment calls = ~6,000 API calls
- FMP Rate Limit: 300 calls/minute (premium tier)
- Estimated Time: ~20 minutes for full dataset generation (vs current 2-3 hours with timeouts)

**API Tier Required**:

- Check if current FMP premium tier includes historical sentiment
- May require upgrade to higher tier

### Decision Criteria

Implement this enhancement if:

1. ✅ Current model (v1.0.0) shows good baseline performance without sentiment
2. ✅ We have budget/quota for premium historical sentiment API
3. ✅ A/B testing shows meaningful accuracy improvement (e.g., >2% gain)
4. ✅ Training time remains reasonable (<1 hour for full dataset)

Skip/Defer if:

- ❌ Sentiment features show low importance in current model
- ❌ API costs are prohibitive
- ❌ Training time becomes too slow for iteration

### Alternative Approaches

**Option A: News Article Sentiment (Free)**

- Use FMP's free News API with sentiment scores
- Parse historical news articles and compute sentiment
- Pro: Free, rich context
- Con: Slower, requires NLP processing

**Option B: Hybrid Approach**

- Use historical sentiment for training
- Use live sentiment for production predictions
- Pro: Best of both worlds
- Con: Training-serving skew if sentiment behavior changes

**Option C: Progressive Enhancement**

- Train v1.0.0 without sentiment (current)
- Train v2.0.0 with partial sentiment (high-volume stocks only)
- Train v3.0.0 with full sentiment (if v2.0.0 shows improvement)

---

## Enhancement 2: Additional Data Sources

### Proposed Features

- **Institutional Ownership Changes**: Track fund buying/selling patterns
- **Insider Trading Activity**: SEC Form 4 filings
- **Options Flow**: Unusual options activity (premium data source)
- **Macro Indicators**: VIX, sector rotation, market breadth

### Timeline

Q2 2025 - After v1.0.0 is validated in production

---

## Enhancement 3: Model Architecture Improvements

### Proposed Changes

- **Ensemble Methods**: Combine LightGBM with XGBoost and Neural Network
- **Feature Engineering**: Interaction terms, polynomial features
- **Time-Series Features**: Lag features, rolling windows
- **AutoML**: Hyperparameter optimization with Optuna

### Timeline

Q3 2025 - After sufficient production data collected

---

## Version Roadmap

- **v1.0.0** (Current): Baseline model without historical sentiment ✅
- **v1.1.0**: Bug fixes and performance optimizations
- **v2.0.0**: Historical sentiment integration (this document)
- **v2.1.0**: Additional data sources
- **v3.0.0**: Advanced model architectures

---

## Notes

- All enhancements should maintain or improve current inference speed (<3s target)
- Changes must be backward compatible with existing API contracts
- Each version requires full retraining and validation before production deployment
