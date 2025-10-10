`# Sentiment Fusion Model - Technical Implementation Plan

**Created:** 2025-10-06
**Model Type:** Sentiment Fusion - Multi-Source Sentiment Aggregation
**Prediction Horizon:** 2 weeks ahead
**Pattern:** Follow Early Signal Detection architecture
**Integration:** EnsembleService + RealTimePredictionEngine

---

## Context and Purpose

**Problem**: Existing Early Signal and Price Prediction models lack comprehensive sentiment context from news, analyst opinions, and market psychology indicators.

**Solution**: Sentiment Fusion Model aggregates sentiment from multiple sources (FMP news, analyst consensus, options sentiment, macro indicators) to predict near-term price direction with sentiment-aware confidence scores.

**Business Impact**: Enhances prediction accuracy by 5-10% through sentiment-aware context, particularly during earnings, news events, and analyst rating changes.

**Success Criteria**:
- 60%+ accuracy on 2-week price direction
- <100ms cached latency
- Seamless integration with existing ensemble (no breaking changes)
- Degrades gracefully when sentiment data unavailable

---

## Data Sources and Caching Strategy

### Primary Data Sources (All Free/Existing APIs)

| Source | Endpoint | Data Type | Refresh Rate | Cache TTL | API Limit | Status |
|--------|----------|-----------|--------------|-----------|-----------|--------|
| **Polygon News** | `/v2/reference/news` | Financial news (PRIMARY) | 15 min | Production: 15 min, Training: INFINITE | Check docs | CRITICAL |
| **FMP News** | `/api/v3/stock_news` | Financial news (FALLBACK) | 15 min | 15 min | 300/min | BROKEN |
| **FMP Analyst Consensus** | `/api/v3/rating/{symbol}` | Analyst ratings | Daily | Production: 24h, Training: INFINITE | 300/min | Active |
| **FMP Price Targets** | `/api/v3/price-target` | Price targets | Daily | Production: 24h, Training: INFINITE | 300/min | Active |
| **EODHD Sentiment** | `/api/sentiments` | Aggregated sentiment | 1-3 hours | 3 hours | 20/day* | Active |
| **EODHD Options** | `/api/mp/unicornbay/options/eod` | Options IV/PCR | Daily | Production: 24h, Training: SKIP | 20/day* | Active |
| **FRED VIX** | `/api/series` | Market volatility | Daily | Production: 24h, Training: INFINITE | 120/min | Active |
| **Existing VFR Services** | - | Technical/Fundamental | Real-time | 5 min | - | Active |

**CRITICAL CONTEXT**:
- **Polygon News API is PRIMARY**: FMP News extraction is broken (100% "No recent news available" in training data)
- **Training vs Production Cache Strategy**: Historical data cached forever (file-based), production data uses Redis TTL
- **API Coordination**: Polygon for news, FMP for fundamentals, EODHD minimal usage
- *EODHD calls minimized through aggressive caching of slow-moving data

### Caching Architecture

**3-Tier Caching Strategy**:
1. **Immutable Historical Data (Training)**: File-based cache (Parquet/SQLite) - **NEVER EXPIRES**
   - **Storage Location**: `data/cache/historical/`
   - **Use Case**: ALL training dataset generation (2023-2024 data)
   - **Rationale**: Historical news/prices never change, no reason to re-fetch
   - **Format**: Parquet for structured data, SQLite index for fast lookups
   - **Scope**: Polygon News, FMP Analyst, FRED VIX, historical OHLCV

2. **Daily Updated Data (Production)**: Redis cache - 24 hour TTL (analyst ratings, options, VIX)
   - **Use Case**: Production predictions with daily refresh requirements
   - **Scope**: Analyst ratings, options data (not time-critical)

3. **Intraday Data (Production)**: Redis cache - 15 minute TTL (news, real-time sentiment)
   - **Use Case**: Production predictions requiring recent data
   - **Scope**: Polygon News (production), EODHD sentiment

**Critical Distinction**:
- **Training Mode**: Fetch historical data once → File cache → Never expire
- **Production Mode**: Fetch recent data → Redis cache → 15-min or 24h TTL

**Rate Limit Optimization Strategy**:
- **Polygon News (Training)**: 100-500 articles per symbol, cached forever (file-based)
- **Polygon News (Production)**: 10-20 calls/day, 15-min TTL (Redis)
- **FMP Analyst (Training)**: 1 call per symbol per date, cached forever
- **FMP Analyst (Production)**: 50-100 calls/day, 24h TTL
- **EODHD Sentiment (Training)**: Skip during training (use cached only if available)
- **EODHD Options (Training)**: Skip during training (not time-critical for historical analysis)
- **EODHD Sentiment (Production)**: Fetch once per 3 hours maximum, <10 calls/day
- **EODHD Options (Production)**: 1-2 calls/day, 24h TTL

**API Usage Coordination Across Three APIs**:
```
Training Phase (one-time historical fetch):
- Polygon News: 5,000-10,000 calls (500 stocks × 10-20 articles) → Cached FOREVER
- FMP Analyst: 500-1,000 calls (500 stocks × 1-2 historical snapshots) → Cached FOREVER
- EODHD: 0 calls (skip during training, production-only data)

Production Phase (daily):
- Polygon News: 10-20 calls/day (top watchlist symbols, 15-min refresh)
- FMP Analyst: 50-100 calls/day (portfolio symbols, daily refresh)
- EODHD Sentiment: 3-5 calls/day (minimal usage, 3-hour refresh)
- EODHD Options: 1-2 calls/day (market-wide metrics, daily refresh)
```

**Cache-First Logic**:
Training scripts MUST check file cache before making ANY API calls. This ensures:
- Zero redundant API calls for historical data
- Faster dataset regeneration (seconds vs hours)
- API limits preserved for production usage

---

## Feature Engineering Approach

### Input Format: Text-Based Sentiment Context

**FinBERT Input Strategy**: Instead of numerical features, FinBERT processes structured text that combines sentiment information from multiple sources into a single context string.

**Text Template Structure**:
```
[COMPANY] {company_name} ({symbol})
[NEWS] {aggregated_news_sentiment_7d}
[ANALYST] {analyst_consensus_summary}
[OPTIONS] {options_sentiment_summary}
[MARKET] {macro_sentiment_context}
[PRICE] {price_momentum_context}
```

### Text Feature Components

**News Sentiment Text (from Polygon News API - PRIMARY SOURCE)**:
- **API**: Polygon.io `/v2/reference/news` endpoint
- **Capability**: 1000 articles/request, 5-year history, publisher info, sentiment insights
- **Training**: Fetch historical news once, cache forever in file-based storage (Parquet)
- **Production**: Refresh every 15 minutes, Redis cache
- **Why Critical**: Only reliable news source; FMP News API is broken (100% "No recent news available")
- Aggregate last 7 days of financial news headlines
- Example: "Recent news: positive earnings beat (+15%), product launch success, analyst upgrades. Sentiment trend: improving."
- **Fallback**: FMP News API (only if Polygon unavailable)

**Analyst Consensus Text (from FMP Analyst APIs)**:
- Summarize analyst ratings and price targets
- Example: "Analyst consensus: 12 Buy, 3 Hold, 1 Sell. Average target: $180 (+12% upside). Recent upgrades from Goldman Sachs, Morgan Stanley."

**Options Sentiment Text (from EODHD Options API)**:
- Describe options market sentiment
- Example: "Options market: Put/Call ratio 0.65 (bullish). IV rank 45th percentile. Elevated call volume."

**Macro Sentiment Text (from FRED VIX + Sector Data)**:
- Market regime and sector context
- Example: "Market regime: bullish (VIX: 14.2, -3% this week). Technology sector strong (+2.5% this week)."

**Price Context Text (from existing VFR services)**:
- Recent price action summary
- Example: "Price action: +8.5% last 7 days, breaking above 52-week high. Volume surge: +35% vs average."

### Feature Extraction Pattern

```typescript
// Text-based feature extraction for FinBERT
class SentimentFusionFeatureExtractor {
  private fmpAPI: FinancialModelingPrepAPI;
  private sentimentService: SentimentAnalysisService;
  private optionsService: OptionsDataService;
  private macroService: MacroeconomicAnalysisService;
  private cache: RedisCache;

  async extractFeatures(symbol: string, asOfDate?: Date): Promise<SentimentTextInput> {
    // Parallel extraction (existing pattern from EarlySignalFeatureExtractor)
    const [newsText, analystText, optionsText, macroText, priceText, companyInfo] =
      await Promise.all([
        this.extractNewsText(symbol, asOfDate),
        this.extractAnalystText(symbol, asOfDate),
        this.extractOptionsText(symbol, asOfDate),
        this.extractMacroText(asOfDate),
        this.extractPriceText(symbol, asOfDate),
        this.getCompanyInfo(symbol)
      ]);

    return this.formatFinBERTInput({
      companyInfo,
      newsText,
      analystText,
      optionsText,
      macroText,
      priceText
    });
  }

  private formatFinBERTInput(components: SentimentComponents): string {
    return `[COMPANY] ${components.companyInfo.name} (${components.companyInfo.symbol})
[NEWS] ${components.newsText}
[ANALYST] ${components.analystText}
[OPTIONS] ${components.optionsText}
[MARKET] ${components.macroText}
[PRICE] ${components.priceText}`;
  }
}
```

**Token Limit**: FinBERT has a 512 token limit. Feature extractor truncates each section to fit within this constraint (~100 tokens per section).

---

## Model Architecture (FinBERT-Based)

**Model Type**: FinBERT - BERT-based Transformer Fine-tuned for Financial Sentiment

**Why FinBERT**:
- Pretrained on financial text corpus (10-K, 10-Q, earnings calls, financial news)
- Superior semantic understanding of financial language vs traditional ML
- Handles context, negation, and financial terminology effectively
- Already installed in project dependencies
- Strong performance on financial sentiment benchmarks (80%+ accuracy)

**Architecture**:
```
Input: Structured text context (max 512 tokens)
  ↓
FinBERT Tokenizer (BERT WordPiece)
  ↓
FinBERT Transformer (12 layers, 768 hidden units)
  ↓
Classification Head (fine-tuned)
  ↓
Output: [P(Bullish), P(Neutral), P(Bearish)]
  ↓
Confidence Filtering: Skip if max(P) < 0.65
  ↓
Final Prediction: {class: BULLISH/NEUTRAL/BEARISH, confidence: 0.XX}
```

**Model Details**:
- **Base Model**: `ProsusAI/finbert` (HuggingFace)
- **Architecture**: BERT-base (110M parameters)
- **Max Sequence Length**: 512 tokens
- **Output**: 3-class sentiment classification

**Fine-tuning Configuration**:
```python
from transformers import AutoModelForSequenceClassification, TrainingArguments

training_args = TrainingArguments(
  output_dir='./models/sentiment-fusion/v1.0.0',
  num_train_epochs=3,
  per_device_train_batch_size=16,
  per_device_eval_batch_size=32,
  learning_rate=2e-5,
  weight_decay=0.01,
  warmup_steps=500,
  evaluation_strategy='steps',
  eval_steps=500,
  save_strategy='steps',
  save_steps=1000,
  load_best_model_at_end=True,
  metric_for_best_model='f1',
  logging_steps=100
)

# Load pretrained FinBERT and fine-tune on our dataset
model = AutoModelForSequenceClassification.from_pretrained(
  'ProsusAI/finbert',
  num_labels=3,  # Bullish, Neutral, Bearish
  problem_type='single_label_classification'
)
```

**Trade-offs vs LightGBM**:
| Aspect | FinBERT | LightGBM |
|--------|---------|----------|
| **Inference Latency** | 100-200ms | <50ms |
| **Memory Usage** | ~500MB | ~10MB |
| **Semantic Understanding** | Excellent | None |
| **Missing Data Handling** | Poor (requires imputation) | Excellent |
| **Interpretability** | Attention weights | Feature importance |
| **Training Time** | 2-4 hours | 10-20 minutes |

**No Over-Engineering**: Single fine-tuned FinBERT model, no complex ensembles, no custom architectures.

---

## Integration Steps with Existing Ensemble

### Phase 1: Standalone Service (Week 1)

**Step 1.1**: Create `SentimentFusionFeatureExtractor.ts`
- Copy pattern from `EarlySignalFeatureExtractor.ts`
- Add analyst, news, options feature extraction
- Reuse existing VFR services (no new API integrations)
- **Time**: 4 hours

**Step 1.2.5**: Implement historical data cache layer (file-based Parquet/SQLite) - **NEW TASK**
- Create cache utilities for permanent storage: `app/services/cache/HistoricalDataCache.ts`
- Implement cache-first API wrapper pattern
- Add cache management scripts in `scripts/ml/sentiment-fusion/cache-utils.ts`
- Create directory structure: `data/cache/historical/{news,analyst,options,index.db}`
- **Time**: 2 hours
- **Dependencies**: None (can run in parallel with 1.1)

**Step 1.2**: Generate training dataset
- Script: `scripts/ml/sentiment-fusion/generate-dataset.ts`
- Target: 10,000-20,000 examples (S&P 500, 2023-2024)
- Format: CSV with columns: `text` (structured context), `label` (0=Bearish, 1=Neutral, 2=Bullish)
- Labels: 2-week forward price change (>+3% = BULLISH, <-3% = BEARISH, else NEUTRAL)
- **Time**: 6 hours (includes API rate limit handling)

**Step 1.3**: Fine-tune FinBERT model
- Script: `scripts/ml/sentiment-fusion/train-finbert.py`
- Load pretrained `ProsusAI/finbert` from HuggingFace
- Fine-tune on training dataset (3 epochs, batch size 16)
- Output: `models/sentiment-fusion/v1.0.0/` (PyTorch model + tokenizer)
- **Time**: 3-4 hours (includes training time on GPU/CPU)

**Step 1.4**: Create `SentimentFusionService.ts`
- Copy pattern from `EarlySignalService.ts`
- Python inference via persistent subprocess (HuggingFace Transformers)
- Redis caching (15 min TTL - longer due to slower inference)
- Confidence filtering (>0.65)
- Handle FinBERT-specific concerns (512 token limit, tokenization)
- **Time**: 5 hours

### Phase 2: Ensemble Integration (Week 2)

**Step 2.1**: Register model in `ModelRegistry.ts`
- Script: `scripts/ml/sentiment-fusion/register-model.ts`
- Model metadata: name, version, performance, features
- **Time**: 1 hour

**Step 2.2**: Add to `RealTimePredictionEngine.ts`
```typescript
// In loadModel()
if (model.data.modelName === 'sentiment-fusion') {
  return SentimentFusionService.getInstance();
}
```
- **Time**: 30 minutes

**Step 2.3**: Configure ensemble weights in `EnsembleService.ts`
```typescript
const ensembleWeights = {
  'early-signal': 0.35,
  'price-prediction': 0.30,
  'sentiment-fusion': 0.25,  // NEW
  'other-models': 0.10
};
```
- **Time**: 1 hour (includes testing)

**Step 2.4**: Update `WeightCalculator.ts` for dynamic weighting
- Include sentiment-fusion in confidence-based weight adjustment
- **Time**: 1 hour

### Phase 3: Production Deployment (Week 2, Day 4-5)

**Step 3.1**: Performance validation
- Test latency: <200ms cached, <800ms uncached (FinBERT slower than LightGBM)
- Test accuracy: >=60% on holdout test set (target: 65-70% with FinBERT)
- Load test: 50 concurrent predictions (lower due to memory constraints)
- **Time**: 2 hours

**Step 3.2**: Monitoring setup
- Add to `AnalyticsService.ts` metrics tracking
- Alert thresholds: latency >800ms, accuracy <55%, error rate >1%
- Monitor memory usage (FinBERT uses ~500MB per process)
- **Time**: 2 hours

**Step 3.3**: Deploy to production
- Upload model artifacts
- Register in production DB
- Enable in ensemble
- Verify health checks
- **Time**: 1 hour

---

## Implementation Phases with Clear Tasks

### Week 1: Core Model Development

| Task | Description | Time | Dependency | Output | Status |
|------|-------------|------|------------|--------|--------|
| 1.1 | Create `SentimentFusionFeatureExtractor.ts` (text-based) | 5h | None | Text feature extractor service | COMPLETED ✅ |
| 1.2.5 | Implement historical data cache layer (file-based) | 2h | None | Cache utilities + directory structure | Pending |
| 1.2 | Create dataset generation script | 3h | 1.1, 1.2.5 | Training data script | Pending |
| 1.3 | Generate training dataset (S&P 500, 2023-2024) | 6h | 1.2 | `data/training/sentiment-fusion-*.csv` | Pending |
| 1.4 | Split train/val/test sets | 1h | 1.3 | Train/val/test CSVs | Pending |
| 1.5 | Fine-tune FinBERT model | 4h | 1.4 | `models/sentiment-fusion/v1.0.0/` | Pending |
| 1.6 | Evaluate test set performance | 1h | 1.5 | Metrics report (target: 60%+ accuracy) | Pending |
| 1.7 | **CRITICAL FIX: Replace FMP News with Polygon News API** | Variable | 1.6 | Fixed news extraction + retrained model | REQUIRED |
| 1.7.1 | Integrate Polygon News API in FeatureExtractor | 3h | 1.6 | Polygon News service | Pending |
| 1.7.2 | Update feature extractor to use Polygon with file cache | 2h | 1.7.1, 1.2.5 | Cache-first news extraction | Pending |
| 1.7.3 | Regenerate training dataset with Polygon News | 4h | 1.7.2 | New training dataset with real news | Pending |
| 1.7.4 | Re-train model with corrected dataset | 4h | 1.7.3 | Retrained model v1.1.0 | Pending |
| 1.7.5 | Re-evaluate to verify ≥60% accuracy | 1h | 1.7.4 | Validation report | Pending |
| 1.8 | Create `SentimentFusionService.ts` | 5h | 1.7.5 | Inference service | Pending |
| 1.9 | Create Python inference script (HuggingFace) | 2h | 1.5 | `predict-sentiment-fusion.py` | Pending |
| 1.10 | Test end-to-end prediction flow | 2h | 1.8, 1.9 | Validated predictions | Pending |

**Week 1 Total**: 29 hours (~4 days)

### Week 2: Integration and Deployment

| Task | Description | Time | Dependency | Output |
|------|-------------|------|------------|--------|
| 2.1 | Register model in `ModelRegistry` | 1h | Week 1 | Model registered |
| 2.2 | Integrate with `RealTimePredictionEngine` | 1h | 2.1 | Engine loads model |
| 2.3 | Configure ensemble weights | 1h | 2.2 | Ensemble config updated |
| 2.4 | Update `WeightCalculator` for dynamic weighting | 1h | 2.3 | Dynamic weights enabled |
| 2.5 | End-to-end ensemble testing | 2h | 2.4 | Ensemble predictions working |
| 2.6 | Performance validation (latency, accuracy) | 2h | 2.5 | Performance report |
| 2.7 | Setup monitoring and alerts | 2h | 2.6 | Monitoring active |
| 2.8 | Production deployment | 1h | 2.7 | Model live in production |
| 2.9 | Post-deployment verification | 1h | 2.8 | Health checks passing |

**Week 2 Total**: 12 hours (~2 days)

**Project Total**: 41 hours (~1.75 weeks)

---

## Performance Targets and Success Metrics

### Accuracy Targets

| Metric | Minimum | Target | Excellent |
|--------|---------|--------|-----------|
| **Test Set Accuracy** | 60% | 65% | 70% |
| **Precision (Bullish)** | 0.55 | 0.60 | 0.65 |
| **Precision (Bearish)** | 0.55 | 0.60 | 0.65 |
| **F1-Score (Weighted)** | 0.58 | 0.63 | 0.68 |
| **ROC-AUC (Multi-class)** | 0.65 | 0.70 | 0.75 |

### Latency Targets

| Operation | Target (p95) | Maximum (p99) |
|-----------|--------------|---------------|
| **Feature Extraction** | 200ms | 500ms |
| **Model Inference (cached)** | 150ms | 200ms |
| **Model Inference (uncached)** | 500ms | 800ms |
| **Total Latency (cached)** | 200ms | 300ms |
| **Total Latency (uncached)** | 600ms | 1000ms |

**Note**: FinBERT inference is significantly slower than LightGBM due to transformer architecture. Caching becomes critical for production performance.

### Cache Performance

| Metric | Target |
|--------|--------|
| **Cache Hit Rate (market hours)** | >90% (critical for FinBERT latency) |
| **Cache TTL** | 15 minutes (longer due to slower inference) |
| **Cache Key Format** | `sentiment_fusion:{symbol}:{date}:{modelVersion}` |

### API Usage Targets

| API | Training (one-time) | Production (daily) | Rate Limit | Cache Strategy | Priority |
|-----|---------------------|--------------------|-----------|--------------------|----------|
| **Polygon News** | 5,000-10,000 (cached forever) | 10-20 | Check docs | File cache + Redis | CRITICAL |
| **FMP News** | 0 (fallback only) | 0-5 (backup) | 300/min | Fallback only | LOW |
| **FMP Analyst** | 500-1,000 (cached forever) | 50-100 | 300/min | File + Redis | HIGH |
| **EODHD Sentiment** | 0 (skip training) | 3-5 | 20/day | Redis only | MEDIUM |
| **EODHD Options** | 0 (skip training) | 1-2 | 20/day | Redis only | MEDIUM |
| **FRED VIX** | 500-1,000 (cached forever) | 1 | 120/min | File + Redis | HIGH |

### Ensemble Integration Targets

| Metric | Target |
|--------|--------|
| **Ensemble Weight** | 20-25% |
| **Contribution to Accuracy** | +3-5% |
| **Error Rate** | <1% |
| **Graceful Degradation** | 100% (no breaking changes) |

### Production Health Metrics

| Alert Threshold | Warning | Critical |
|-----------------|---------|----------|
| **Latency p95** | >800ms | >1500ms |
| **Accuracy (7-day rolling)** | <55% | <50% |
| **Error Rate** | >1% | >5% |
| **Cache Hit Rate** | <85% | <70% |
| **Python Process Restarts** | >3/hour | >10/hour |
| **Memory Usage** | >700MB | >1GB |

---

## File Structure

```
vfr-api/
├── app/services/ml/
│   ├── sentiment-fusion/
│   │   ├── SentimentFusionService.ts          # Main service (mirrors EarlySignalService)
│   │   ├── SentimentFusionFeatureExtractor.ts # Feature extraction
│   │   ├── types.ts                           # TypeScript interfaces
│   │   └── __tests__/
│   │       ├── SentimentFusionService.test.ts
│   │       └── FeatureExtractor.test.ts
│   ├── cache/
│   │   └── HistoricalDataCache.ts             # File-based cache for training data
│   ├── financial-data/
│   │   └── PolygonAPI.ts                      # Polygon.io integration
│   └── ensemble/
│       └── EnsembleService.ts                  # Updated with sentiment-fusion
│
├── scripts/ml/sentiment-fusion/
│   ├── generate-dataset.ts                     # Training data generation (text format)
│   ├── train-finbert.py                        # FinBERT fine-tuning
│   ├── predict-sentiment-fusion.py             # Python inference (HuggingFace)
│   ├── register-model.ts                       # Model registration
│   ├── evaluate-test-set.py                    # Test evaluation
│   ├── validate-performance.ts                 # Performance testing
│   ├── check-cache.ts                          # Check historical cache status
│   ├── warm-historical-cache.ts                # Warm cache with historical data
│   ├── rebuild-cache.ts                        # Clear and rebuild cache
│   ├── test-polygon-news.ts                    # Test Polygon News API
│   └── cache-utils.ts                          # Cache management utilities
│
├── models/sentiment-fusion/
│   └── v1.0.0/
│       ├── pytorch_model.bin                   # Fine-tuned FinBERT weights
│       ├── config.json                         # Model configuration
│       ├── tokenizer_config.json               # Tokenizer configuration
│       ├── vocab.txt                           # BERT vocabulary
│       └── metadata.json                       # Model metadata
│
├── data/
│   ├── training/
│   │   ├── sentiment-fusion-training.csv       # Full training dataset
│   │   ├── sentiment-fusion-train.csv          # Train split (70%)
│   │   ├── sentiment-fusion-val.csv            # Validation split (15%)
│   │   └── sentiment-fusion-test.csv           # Test split (15%)
│   └── cache/
│       └── historical/
│           ├── news/                           # Polygon news (Parquet files)
│           ├── analyst/                        # FMP analyst data
│           ├── macro/                          # FRED/VIX data
│           └── index.db                        # SQLite index for fast lookups
│
└── docs/ml/
    ├── plans/
    │   └── SENTIMENT_FUSION_PLAN.md            # This document
    └── sentiment-fusion/
        ├── FEATURE_SPECIFICATION.md            # Feature definitions
        ├── TRAINING_REPORT.md                  # Training results
        └── PRODUCTION_GUIDE.md                 # Operations guide
```

---

## Risk Mitigation

### Risk 1: API Rate Limit Collisions (Polygon + FMP + EODHD)
**Likelihood**: Medium
**Impact**: High
**Mitigation**:
- **Historical Training Data**: Fetch once, cache forever (file-based storage)
- **Coordinate API Usage**: Polygon for news, FMP for fundamentals, EODHD minimal
- **Implement Request Queuing**: Backoff strategies across all APIs
- **Monitor Daily Usage**: Per-API tracking in admin dashboard
- **Training vs Production Separation**: Different rate limit budgets
**Contingency**:
- Prioritize Polygon News (most critical for sentiment fusion)
- Skip EODHD if needed (lowest priority, production-only)
- Use FMP News fallback only if Polygon unavailable
- Reduce training dataset scope if rate limits hit during generation

### Risk 2: Insufficient Training Data Quality
**Likelihood**: Medium
**Impact**: High
**Mitigation**:
- Validate label distribution (ensure 20-40% per class)
- Check feature correlation to avoid multicollinearity
- Filter symbols with insufficient analyst coverage (<3 analysts)
- Manual spot-checking of edge cases
**Contingency**: Iterate on feature engineering, extend date range for more data

### Risk 3: Model Accuracy Below 60%
**Likelihood**: Low (FinBERT pretrained on financial text)
**Impact**: High
**Mitigation**:
- Analyze misclassifications and refine text formatting
- Experiment with learning rate and training epochs
- Enhance text context with more structured information
- Try different confidence thresholds (0.60-0.70)
**Contingency**: Reduce ensemble weight to 10-15%, continue iterating

### Risk 4: High Latency (>800ms uncached)
**Likelihood**: Medium (transformers are inherently slower)
**Impact**: High
**Mitigation**:
- Optimize feature extraction (parallelize API calls)
- Increase cache TTL to 15-30 minutes
- Consider model quantization (INT8) for faster inference
- Use batch inference when possible
**Contingency**: Async prediction mode (return cached, update in background)

### Risk 5: High Memory Usage (>1GB)
**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:
- Monitor memory usage per subprocess
- Implement process pooling with max instances
- Use model quantization to reduce memory footprint
- Limit concurrent predictions
**Contingency**: Reduce to single inference process, queue predictions

### Risk 6: Python Process Instability
**Likelihood**: Low
**Impact**: Medium
**Mitigation**:
- Copy proven subprocess pattern from EarlySignalService
- Implement auto-restart on failure
- Health check monitoring
- Preload model on process startup to avoid lazy loading issues
**Contingency**: Graceful degradation to ensemble without sentiment-fusion

---

## Key Implementation Decisions

### Why FinBERT Over LightGBM?
- **Superior Semantic Understanding**: FinBERT understands financial language context, negation, and nuance that gradient boosting cannot capture
- **Pretrained Knowledge**: Already trained on millions of financial documents (10-K, 10-Q, earnings calls)
- **Proven Financial Sentiment Performance**: 80%+ accuracy on financial sentiment benchmarks
- **Already Available**: Installed in project dependencies (no new installations)
- **Trade-off Accepted**: Slower inference (100-200ms) is acceptable with aggressive caching

### Why Text-Based Input Over Numerical Features?
- **Leverages Pretrained Knowledge**: FinBERT's pretraining on financial text provides immediate value
- **Simpler Feature Engineering**: No need to engineer 25+ numerical features and normalize them
- **Better Context**: Text naturally captures relationships and nuances between sentiment signals
- **Flexible Structure**: Easy to add new sentiment sources by extending text template

### Why 2-Week Prediction Horizon?
- **Sentiment Decay**: Sentiment signal degrades after ~2 weeks
- **Alignment**: Matches analyst sentiment TODO (2-week horizon)
- **Trading Relevance**: Practical for swing trading strategies

### Why Multiclass (Bullish/Neutral/Bearish) Not Binary?
- **Neutral Class**: Critical for low-conviction periods (avoids false signals)
- **Confidence Filtering**: Skip neutral predictions (0.35-0.65 range)
- **Better Calibration**: More accurate probability estimates

---

## Success Validation Checklist

### Training Phase
- [ ] Dataset contains 10,000+ examples
- [ ] Label distribution balanced (20-40% per class)
- [ ] No data leakage (time-series split, no future data)
- [ ] Historical data cache implemented (file-based storage)
- [ ] Training dataset generation uses cache-first approach
- [ ] Polygon News API integrated and working
- [ ] Zero redundant API calls for historical data
- [ ] Test accuracy ≥60%
- [ ] F1-score ≥0.58 per class
- [ ] Feature importance logical (sentiment features weighted high)

### Integration Phase
- [ ] Model loads successfully in RealTimePredictionEngine
- [ ] Predictions return in <500ms (uncached)
- [ ] Cache hit rate >80% during testing
- [ ] Ensemble weights configured correctly
- [ ] No breaking changes to existing predictions
- [ ] Error handling: graceful degradation when sentiment data unavailable

### Production Phase
- [ ] Health checks passing
- [ ] Monitoring active (latency, accuracy, error rate)
- [ ] Alert thresholds configured
- [ ] EODHD API usage <10 calls/day
- [ ] 7-day rolling accuracy ≥55%
- [ ] Production latency p95 <100ms (cached)

---

## Next Steps (Immediate Actions)

### 1. Validate EODHD API Access (30 minutes)
```bash
# Test EODHD sentiment endpoint
curl "https://eodhd.com/api/sentiments?s=AAPL.US&api_token=$EODHD_API_KEY"

# Test options endpoint
curl "https://eodhd.com/api/mp/unicornbay/options/eod?api_token=$EODHD_API_KEY"
```

### 2. Create Feature Specification Document (1 hour)
- Document each of 25 features with exact calculation
- Identify data source and API endpoint
- Define normalization strategy (z-score or min-max)
- Save as `docs/ml/sentiment-fusion/FEATURE_SPECIFICATION.md`

### 3. Prototype Feature Extractor (2 hours)
```bash
# Create feature extractor
npx ts-node scripts/ml/sentiment-fusion/test-feature-extraction.ts --symbol AAPL

# Verify all 25 features extract successfully
# Check for missing values or API errors
```

### 4. Generate Small Test Dataset (2 hours)
```bash
# Generate 100 examples for validation
npx ts-node scripts/ml/sentiment-fusion/generate-dataset.ts --symbols AAPL,TSLA,NVDA --test

# Validate label distribution and feature quality
# Iterate on feature engineering if needed
```

### 5. Kickoff Week 1 Tasks
- Start with Task 1.1 (Feature Extractor)
- Follow implementation phases sequentially
- Daily progress tracking via todo list

---

## Command Reference

### Development Workflow
```bash
# Historical cache management
npx tsx scripts/ml/sentiment-fusion/check-cache.ts
npx tsx scripts/ml/sentiment-fusion/warm-historical-cache.ts --symbols SP500
npx tsx scripts/ml/sentiment-fusion/rebuild-cache.ts

# Feature extraction testing
npx ts-node scripts/ml/sentiment-fusion/test-feature-extraction.ts --symbol AAPL

# Test Polygon News API integration
npx tsx scripts/ml/sentiment-fusion/test-polygon-news.ts --symbol AAPL

# Dataset generation (test with cache)
npx ts-node scripts/ml/sentiment-fusion/generate-dataset.ts --symbols AAPL,TSLA --test --use-cache

# Dataset generation (full with cache-first)
npx ts-node scripts/ml/sentiment-fusion/generate-dataset.ts --full --use-cache

# Split datasets
python3 scripts/ml/sentiment-fusion/split-dataset.py

# Fine-tune FinBERT model
python3 scripts/ml/sentiment-fusion/train-finbert.py

# Evaluate test set
python3 scripts/ml/sentiment-fusion/evaluate-test-set.py

# Register model
npx ts-node scripts/ml/sentiment-fusion/register-model.ts

# Test service
npx ts-node scripts/ml/sentiment-fusion/test-service.ts --symbol AAPL

# Validate performance
npx ts-node scripts/ml/sentiment-fusion/validate-performance.ts

# Deploy to production
npx ts-node scripts/ml/sentiment-fusion/deploy-production.ts
```

### Monitoring Commands
```bash
# Check model health
curl http://localhost:3000/api/health/sentiment-fusion

# Check ensemble status
curl http://localhost:3000/api/admin/ensemble/status

# View metrics
curl http://localhost:3000/api/admin/metrics/sentiment-fusion

# Check API usage
curl http://localhost:3000/api/admin/api-usage
```

---

**END OF PLAN**
