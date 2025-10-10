# VFR Analysis Engine: 6-Model ML Integration Plan

**Document Created**: 2025-10-05
**Target Completion**: 2025-12-31 (12 weeks)
**Status**: Planning Phase
**Philosophy**: KISS Principles, Graceful Degradation, Production-First

---

## Executive Summary

### Context
The VFR Analysis Engine is a production financial analysis platform with a 7-tier recommendation system (STRONG_BUY → STRONG_SELL) powered by weighted factor analysis across 50+ factors. Currently integrates 2 ML models:
- **Early Signal Detection** (v1.0.0): Analyst upgrade predictions (97.6% accuracy, deployed Oct 2, 2025)
- **Price Prediction** (v1.1.0): 1-week price movement predictions (46% accuracy, deployed Oct 5, 2025)

Both models follow established patterns: LightGBM-based, <100ms inference latency, 5-minute Redis caching, graceful fallback to VFR scoring, and 90% VFR + 10% ML weight distribution.

### Objective
Integrate 6 additional ML models to enhance stock selection across multiple dimensions while maintaining:
- **Performance**: <100ms additional latency per model (cumulative <600ms for all 6)
- **Reliability**: Each model independent, can fail without breaking the system
- **Modularity**: Models deploy separately, integrate via EnsembleService
- **Conservative Enhancement**: 90% VFR weight + 10% ML weight (consensus across models)

### Success Criteria
- ✅ All 6 models deployed to production with A/B testing capability
- ✅ <600ms cumulative latency across all models (with caching)
- ✅ >80% cache hit rate during market hours
- ✅ Graceful fallback on model failures (no impact to VFR scores)
- ✅ Feature toggle control for each model independently
- ✅ Performance metrics tracked per model (accuracy, latency, confidence)
- ✅ Ensemble weighting optimization based on model performance

---

## Architecture Overview

### Integration Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                    StockSelectionService.ts                      │
│  (Main orchestration service - 7-tier recommendation system)    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                ┌──────────▼──────────┐
                │  EnsembleService    │ ← NEW: Orchestrates all ML models
                │  (NOT IMPLEMENTED)  │    Weighted consensus algorithm
                └──────────┬──────────┘
                           │
    ┌──────────────────────┼──────────────────────┬────────────────┬─────────────────┬─────────────────┬─────────────────┐
    │                      │                      │                │                 │                 │                 │
┌───▼───┐            ┌────▼────┐           ┌────▼────┐      ┌────▼────┐      ┌────▼────┐      ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
│ Early │            │ Price   │           │Analyst  │      │ Options │      │ Social  │      │Institu- │      │Earnings │      │ Macro   │
│Signal │            │Predict  │           │Sentiment│      │  Flow   │      │Sentiment│      │ tional  │      │Surprise │      │ Regime  │
│(v1.0) │            │ (v1.1)  │           │ Model   │      │  Model  │      │  Accel  │      │  Flow   │      │  Model  │      │Detection│
│       │            │         │           │ (NEW 1) │      │ (NEW 2) │      │ (NEW 3) │      │ (NEW 4) │      │ (NEW 5) │      │ (NEW 6) │
└───┬───┘            └────┬────┘           └────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘
    │                     │                     │                │                │                │                │                │
    │                     │                     │                │                │                │                │                │
┌───▼─────────────────────▼─────────────────────▼────────────────▼────────────────▼────────────────▼────────────────▼────────────────▼───┐
│                                          MLFeatureToggleService                                                                           │
│                         (Centralized feature flag management - Redis-backed, audit logging)                                              │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Request arrives at /api/stocks/select (StockSelectionService)
   ↓
2. Check MLFeatureToggleService for enabled models
   ↓
3. EnsembleService orchestrates parallel model execution
   ↓
4. Each model:
   a. Check Redis cache (5-minute TTL)
   b. If miss: Extract features → Normalize → Predict (Python subprocess)
   c. Apply confidence filtering (skip low-confidence predictions)
   d. Cache result
   ↓
5. EnsembleService aggregates predictions (weighted consensus)
   ↓
6. Return to StockSelectionService with 10% ML weight + 90% VFR weight
   ↓
7. Generate 7-tier recommendation (STRONG_BUY → STRONG_SELL)
```

### Error Boundaries

Each layer implements graceful degradation:

| Layer | Failure Mode | Fallback Strategy | User Impact |
|-------|--------------|-------------------|-------------|
| **Individual Model** | Prediction fails | Skip model, continue ensemble | Reduced ML signal (still gets other models) |
| **Feature Extraction** | Data source timeout | Use zero/null features, continue | Lower confidence prediction |
| **Python Subprocess** | Process crash | Restart process, retry once | 1-2 second delay, then skip |
| **Redis Cache** | Cache unavailable | Compute fresh prediction | Higher latency (500ms vs 50ms) |
| **EnsembleService** | All models fail | Return null, fallback to pure VFR | Zero ML weight (100% VFR scoring) |
| **StockSelectionService** | Timeout (>30s) | Return partial results with warnings | Best-effort results |

### Performance Targets

| Component | Target | Measurement |
|-----------|--------|-------------|
| **Feature Extraction** | <200ms | Per model, per symbol |
| **Model Inference (cached)** | <50ms | Python subprocess (model in memory) |
| **Model Inference (uncached)** | <500ms | First-time prediction (cold start) |
| **Ensemble Aggregation** | <50ms | Weighted consensus algorithm |
| **Total ML Enhancement** | <600ms | All 6 new models combined (parallel execution) |
| **Cache Hit Rate** | >80% | During market hours (9:30 AM - 4:00 PM ET) |
| **Redis Operation** | <10ms | GET/SET operations |

---

## Model Specifications

### Model 1: Analyst Sentiment Model

#### Prediction Target
**Analyst sentiment changes** (3-week horizon):
- `UPGRADE_EXPECTED`: Predicts analyst upgrades/positive revisions
- `DOWNGRADE_EXPECTED`: Predicts analyst downgrades/negative revisions
- `NEUTRAL`: No significant sentiment change expected

**Confidence Threshold**: Skip predictions with 0.35 < confidence < 0.65

#### Data Sources & Features (32 features)

**FMP API** (FinancialModelingPrepAPI.ts):
```typescript
// Analyst Coverage (8 features)
- analyst_count_change_30d: Change in number of covering analysts
- analyst_consensus_trend: Trend in consensus rating (1=improving, -1=deteriorating, 0=stable)
- analyst_target_change_rate: Rate of price target changes
- analyst_upgrade_count_30d: Number of upgrades in last 30 days
- analyst_downgrade_count_30d: Number of downgrades in last 30 days
- analyst_initiation_count_30d: New coverage initiations
- analyst_coverage_concentration: HHI index of analyst firm concentration
- analyst_surprise_history: Historical beat/miss on estimates

// Price & Momentum (6 features)
- price_to_target_gap: Current price vs average analyst target
- price_momentum_vs_sector: Relative momentum vs sector peers
- price_vs_52week_high: Distance from 52-week high
- earnings_revision_momentum: Rate of earnings estimate revisions
- revenue_revision_momentum: Rate of revenue estimate revisions
- forward_pe_vs_sector: Forward P/E vs sector average
```

**InstitutionalDataService.ts** (13F filings):
```typescript
// Institutional Activity (8 features)
- institutional_ownership_change_qoq: Quarter-over-quarter ownership change
- institutional_new_positions_count: Number of new institutional positions
- institutional_closed_positions_count: Number of closed positions
- institutional_avg_cost_basis_change: Change in average cost basis
- institutional_concentration_change: Change in ownership concentration
- top10_holders_activity: Activity of top 10 institutional holders
- insider_buying_ratio: Insider buy/sell ratio (SEC Form 4)
- institutional_sentiment_score: Composite sentiment from holdings changes
```

**OptionsDataService.ts** (EODHD):
```typescript
// Options Flow (8 features)
- options_volume_surge: Unusual options volume (>2 std dev)
- put_call_ratio_change: Change in put/call ratio
- options_iv_rank_change: Change in implied volatility rank
- call_volume_otm_spike: Out-of-money call volume spikes (bullish)
- put_volume_otm_spike: Out-of-money put volume spikes (bearish)
- options_open_interest_change: Change in open interest
- max_pain_price_distance: Distance to options max pain price
- gamma_exposure_change: Change in dealer gamma exposure
```

**SentimentAnalysisService.ts**:
```typescript
// News Sentiment (8 features)
- news_sentiment_delta_7d: 7-day news sentiment change
- news_volume_spike: Unusual news volume
- news_source_quality_score: Weighted by source credibility
- news_topic_concentration: Focus on specific topics (earnings, M&A, etc.)
- analyst_mentions_in_news: Analyst mentions in recent news
- controversy_score: Negative news concentration
- forward_looking_statements: Presence of forward guidance
- management_tone_shift: Change in management communication tone
```

#### Model Type
**LightGBM Gradient Boosting Classifier**
- **Hyperparameters**:
  ```python
  {
    "objective": "multiclass",
    "num_class": 3,
    "metric": "multi_logloss",
    "max_depth": 6,
    "num_leaves": 31,
    "learning_rate": 0.05,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "verbose": -1
  }
  ```
- **Training Data**: S&P 500 stocks, 3 years (2022-2024), ~50K examples
- **Expected Accuracy**: 60-70% (baseline: 33% random)

#### Integration Points

**Service File**: `app/services/ml/analyst-sentiment/AnalystSentimentService.ts`
```typescript
export class AnalystSentimentService {
  private static modelVersion = "v1.0.0"
  private featureExtractor: AnalystSentimentFeatureExtractor
  private cache: RedisCache
  private config: AnalystSentimentConfig

  async predictAnalystSentiment(
    symbol: string,
    sector: string
  ): Promise<AnalystSentimentPrediction | null>

  // Returns null if:
  // - Confidence too low (0.35-0.65 range)
  // - Feature extraction fails
  // - Model prediction fails
  // - Symbol not covered by analysts
}
```

**Feature Extractor**: `app/services/ml/features/AnalystSentimentFeatureExtractor.ts`
```typescript
export class AnalystSentimentFeatureExtractor {
  private fmpAPI: FinancialModelingPrepAPI
  private institutionalService: InstitutionalDataService
  private optionsService: OptionsDataService
  private sentimentService: SentimentAnalysisService

  async extractFeatures(symbol: string): Promise<AnalystSentimentFeatures>
  // Returns 32-feature object
}
```

**Model Path**: `models/analyst-sentiment/v1.0.0/`
- `model.txt` - LightGBM model file
- `normalizer.json` - Feature normalization parameters (z-score)
- `metadata.json` - Model performance, features, training date

**Cache Key**: `analyst_sentiment:{symbol}`
**Cache TTL**: 300 seconds (5 minutes)

#### Performance Targets
- **Feature Extraction**: <150ms (4 data sources, parallel fetching)
- **Inference (cached)**: <30ms
- **Inference (uncached)**: <400ms
- **Cache Hit Rate**: >85% (analysts update infrequently)

#### Error Handling
```typescript
// Graceful degradation
try {
  const prediction = await service.predictAnalystSentiment(symbol, sector)
  if (prediction && prediction.confidence > 0.65) {
    // Use prediction
  } else {
    // Skip low-confidence prediction
  }
} catch (error) {
  console.error("Analyst sentiment prediction failed:", error)
  // Continue without this model signal
  return null
}
```

---

### Model 2: Options Flow Model

#### Prediction Target
**Unusual options activity** (1-week horizon):
- `BULLISH_FLOW`: Unusual call buying, institutional positioning (expect upward move)
- `BEARISH_FLOW`: Unusual put buying, hedging activity (expect downward move)
- `NEUTRAL`: Normal options flow, no unusual activity

**Confidence Threshold**: Skip predictions with 0.40 < confidence < 0.70 (higher threshold due to noisy options data)

#### Data Sources & Features (28 features)

**OptionsDataService.ts** (EODHD - primary source):
```typescript
// Volume & Open Interest (8 features)
- call_volume_ratio: Call volume vs 20-day average
- put_volume_ratio: Put volume vs 20-day average
- total_options_volume_spike: Total volume vs 20-day average
- call_oi_change: Change in call open interest
- put_oi_change: Change in put open interest
- total_oi_change: Total open interest change
- volume_to_oi_ratio: Volume/OI ratio (turnover)
- unusual_contracts_count: Number of contracts with >10x normal volume

// Greeks & IV (8 features)
- call_delta_weighted_volume: Volume-weighted call delta
- put_delta_weighted_volume: Volume-weighted put delta
- net_gamma_exposure: Dealer net gamma (GEX)
- vanna_exposure: Vanna (delta sensitivity to IV)
- charm_exposure: Charm (delta decay over time)
- implied_volatility_rank: IV rank (0-100 percentile)
- iv_skew: Put IV - Call IV (fear gauge)
- iv_term_structure: Near-term IV vs long-term IV

// Strike Analysis (6 features)
- atm_call_volume: At-the-money call volume
- atm_put_volume: At-the-money put volume
- otm_call_volume_ratio: Out-of-money call volume (bullish speculation)
- otm_put_volume_ratio: Out-of-money put volume (bearish hedging)
- max_pain_price: Options max pain price
- max_pain_distance: Current price vs max pain (dealer hedging pressure)

// Flow Characteristics (6 features)
- large_block_trades_count: Blocks >$100K premium
- sweep_orders_count: Multi-exchange sweeps (institutional aggression)
- premium_spent_ratio: Call premium vs put premium
- average_trade_size: Average contract size (retail vs institutional)
- bid_ask_spread_quality: Tight spreads = liquid markets
- time_of_day_concentration: Concentration in opening/closing hours
```

**TechnicalIndicatorService.ts**:
```typescript
// Price Context (6 features)
- price_vs_max_pain: Price distance to max pain
- volatility_regime: Historical volatility percentile
- price_momentum_5d: 5-day price momentum
- support_resistance_proximity: Distance to key levels
- bollinger_band_position: Price position in Bollinger Bands
- atr_normalized: ATR / price (normalized volatility)
```

#### Model Type
**XGBoost Gradient Boosting Classifier** (better for options flow patterns)
- **Hyperparameters**:
  ```python
  {
    "objective": "multi:softmax",
    "num_class": 3,
    "max_depth": 8,
    "learning_rate": 0.03,
    "n_estimators": 300,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "gamma": 0.1,
    "min_child_weight": 3,
    "eval_metric": "mlogloss"
  }
  ```
- **Training Data**: Liquid options (>10K daily volume), 2 years, ~40K examples
- **Expected Accuracy**: 55-65% (baseline: 33% random, options data is noisy)

#### Integration Points

**Service File**: `app/services/ml/options-flow/OptionsFlowService.ts`
```typescript
export class OptionsFlowService {
  private static modelVersion = "v1.0.0"
  private featureExtractor: OptionsFlowFeatureExtractor
  private cache: RedisCache
  private config: OptionsFlowConfig

  async predictOptionsFlow(
    symbol: string,
    sector: string
  ): Promise<OptionsFlowPrediction | null>

  // Returns null if:
  // - Confidence too low (0.40-0.70 range)
  // - No options data available (illiquid stock)
  // - Options volume < 100 contracts/day
  // - Feature extraction fails
}
```

**Feature Extractor**: `app/services/ml/features/OptionsFlowFeatureExtractor.ts`
```typescript
export class OptionsFlowFeatureExtractor {
  private optionsService: OptionsDataService
  private technicalService: TechnicalIndicatorService

  async extractFeatures(symbol: string): Promise<OptionsFlowFeatures>
  // Returns 28-feature object
  // Throws if options data unavailable
}
```

**Model Path**: `models/options-flow/v1.0.0/`
- `model.xgb` - XGBoost model file
- `normalizer.json` - Feature normalization parameters
- `metadata.json` - Model performance, features, training date

**Cache Key**: `options_flow:{symbol}`
**Cache TTL**: 60 seconds (1 minute - options flow changes rapidly)

#### Performance Targets
- **Feature Extraction**: <250ms (options chains are large, requires filtering)
- **Inference (cached)**: <40ms
- **Inference (uncached)**: <500ms
- **Cache Hit Rate**: >70% (options flow changes frequently, lower cache hit rate)

#### Error Handling
```typescript
// Graceful degradation with options-specific checks
try {
  // Pre-check: Does stock have liquid options?
  const optionsSummary = await optionsService.getOptionsSummary(symbol)
  if (!optionsSummary || optionsSummary.totalContracts < 100) {
    console.log(`Options flow unavailable for ${symbol} (illiquid)`)
    return null
  }

  const prediction = await service.predictOptionsFlow(symbol, sector)
  if (prediction && prediction.confidence > 0.70) {
    // High-confidence unusual flow detected
  }
} catch (error) {
  console.error("Options flow prediction failed:", error)
  return null
}
```

---

### Model 3: Social Sentiment Acceleration Model

#### Prediction Target
**Social sentiment momentum** (1-week horizon):
- `ACCELERATING_POSITIVE`: Social sentiment rapidly improving (viral bullish narrative)
- `ACCELERATING_NEGATIVE`: Social sentiment rapidly declining (viral bearish narrative)
- `NEUTRAL`: No unusual social momentum

**Confidence Threshold**: Skip predictions with 0.30 < confidence < 0.60 (lower threshold - social can be early signal)

#### Data Sources & Features (24 features)

**Reddit API** (existing integration via SentimentAnalysisService.ts):
```typescript
// Volume Metrics (6 features)
- reddit_mention_count_24h: Mentions in last 24 hours
- reddit_mention_acceleration: Hour-over-hour mention growth
- reddit_mention_velocity: Rate of change in mentions
- reddit_unique_subreddits: Number of subreddits discussing stock
- reddit_post_upvote_ratio: Average upvote ratio (quality signal)
- reddit_comment_depth: Average comment thread depth (engagement)

// Sentiment Metrics (6 features)
- reddit_sentiment_score: Weighted sentiment (-1 to +1)
- reddit_sentiment_delta_24h: 24-hour sentiment change
- reddit_sentiment_momentum: Hour-over-hour sentiment acceleration
- reddit_bull_bear_ratio: Bullish vs bearish comments
- reddit_emoji_sentiment: Emoji-based sentiment (🚀, 💎, 📉)
- reddit_profanity_ratio: Profanity level (emotion intensity)

// Influence Metrics (6 features)
- reddit_top_contributor_sentiment: Sentiment of high-karma users
- reddit_wsb_specific_sentiment: WallStreetBets-specific sentiment
- reddit_award_count: Total awards on posts (strong conviction)
- reddit_cross_post_count: Cross-posting to other subreddits
- reddit_mod_interaction: Moderator engagement (controversial topics)
- reddit_new_account_ratio: Ratio of new accounts (potential manipulation)
```

**SentimentAnalysisService.ts** (news sentiment):
```typescript
// News Correlation (6 features)
- news_social_correlation: Correlation between news and social sentiment
- news_social_lag: Time lag between news and social reaction
- social_leading_indicator: Social sentiment leads news sentiment
- controversy_index: Disagreement between sources
- narrative_strength: Consistency of sentiment across sources
- viral_coefficient: Social amplification of news stories
```

#### Model Type
**LSTM Neural Network** (time-series momentum patterns)
- **Architecture**:
  ```python
  {
    "layers": [
      {"type": "LSTM", "units": 64, "return_sequences": True},
      {"type": "Dropout", "rate": 0.3},
      {"type": "LSTM", "units": 32},
      {"type": "Dropout", "rate": 0.3},
      {"type": "Dense", "units": 16, "activation": "relu"},
      {"type": "Dense", "units": 3, "activation": "softmax"}
    ],
    "optimizer": "adam",
    "loss": "categorical_crossentropy",
    "metrics": ["accuracy"]
  }
  ```
- **Sequence Length**: 24 hours (hourly snapshots)
- **Training Data**: Meme stocks + high-social-volume stocks, 2 years, ~30K examples
- **Expected Accuracy**: 50-60% (baseline: 33% random, social data is extremely noisy)

#### Integration Points

**Service File**: `app/services/ml/social-sentiment/SocialSentimentAccelService.ts`
```typescript
export class SocialSentimentAccelService {
  private static modelVersion = "v1.0.0"
  private featureExtractor: SocialSentimentFeatureExtractor
  private cache: RedisCache
  private config: SocialSentimentConfig

  async predictSocialMomentum(
    symbol: string,
    sector: string
  ): Promise<SocialSentimentPrediction | null>

  // Returns null if:
  // - Confidence too low (0.30-0.60 range)
  // - Social mention count < 10 in 24h (too low signal)
  // - Reddit API unavailable
  // - Feature extraction fails
}
```

**Feature Extractor**: `app/services/ml/features/SocialSentimentFeatureExtractor.ts`
```typescript
export class SocialSentimentFeatureExtractor {
  private sentimentService: SentimentAnalysisService
  private redditAPI: RedditAPI // Existing integration

  async extractFeatures(symbol: string): Promise<SocialSentimentFeatures>
  // Returns 24-feature object
  // Requires 24-hour historical social data
}
```

**Model Path**: `models/social-sentiment/v1.0.0/`
- `model.h5` - Keras LSTM model file
- `normalizer.json` - Feature normalization parameters
- `metadata.json` - Model performance, features, training date

**Cache Key**: `social_sentiment:{symbol}`
**Cache TTL**: 300 seconds (5 minutes - social changes rapidly but not second-by-second)

#### Performance Targets
- **Feature Extraction**: <200ms (Reddit API can be slow)
- **Inference (cached)**: <50ms
- **Inference (uncached)**: <600ms (LSTM inference slower than tree models)
- **Cache Hit Rate**: >75% (social data doesn't change every second)

#### Error Handling
```typescript
// Graceful degradation with social-specific checks
try {
  // Pre-check: Does stock have sufficient social volume?
  const mentionCount = await sentimentService.getRedditMentionCount(symbol, 24)
  if (mentionCount < 10) {
    console.log(`Social volume too low for ${symbol} (${mentionCount} mentions)`)
    return null
  }

  const prediction = await service.predictSocialMomentum(symbol, sector)
  if (prediction && prediction.confidence > 0.60) {
    // High-confidence social momentum detected
  }
} catch (error) {
  console.error("Social sentiment prediction failed:", error)
  return null
}
```

---

### Model 4: Institutional Flow Model

#### Prediction Target
**Smart money institutional flow** (4-week horizon):
- `ACCUMULATION`: Institutional buying detected (expect upward pressure)
- `DISTRIBUTION`: Institutional selling detected (expect downward pressure)
- `NEUTRAL`: No significant institutional flow

**Confidence Threshold**: Skip predictions with 0.40 < confidence < 0.65

#### Data Sources & Features (26 features)

**InstitutionalDataService.ts** (13F filings, Form 4):
```typescript
// 13F Holdings Changes (10 features)
- institutional_ownership_change_qoq: Quarter-over-quarter total ownership change
- institutional_new_positions_count: Number of new positions opened
- institutional_closed_positions_count: Number of positions closed
- institutional_increased_positions_count: Number of positions increased
- institutional_decreased_positions_count: Number of positions decreased
- institutional_concentration_hhi: Herfindahl index of holder concentration
- top10_ownership_change: Top 10 holders ownership change
- activist_investor_activity: Activist fund activity (13D filings)
- hedge_fund_ownership_change: Hedge fund-specific ownership change
- mutual_fund_ownership_change: Mutual fund-specific ownership change

// Form 4 Insider Trading (8 features)
- insider_buy_transactions_count: Number of insider buy transactions
- insider_sell_transactions_count: Number of insider sell transactions
- insider_net_buying_ratio: (Buys - Sells) / (Buys + Sells)
- insider_buy_volume_usd: Dollar volume of insider buys
- insider_sell_volume_usd: Dollar volume of insider sells
- insider_large_transaction_count: Transactions >$1M
- c_suite_buying_ratio: C-level executive buying ratio
- director_buying_ratio: Board director buying ratio

// Dark Pool & Block Trades (4 features)
- dark_pool_volume_ratio: Dark pool volume / total volume
- block_trade_count: Number of block trades (>10K shares)
- block_trade_volume_ratio: Block trade volume / total volume
- vwap_execution_quality: Execution vs VWAP (institutional efficiency)
```

**OptionsDataService.ts**:
```typescript
// Institutional Options Positioning (4 features)
- long_dated_call_volume: LEAPS call volume (>6 months, bullish institutions)
- long_dated_put_volume: LEAPS put volume (hedging)
- institutional_options_signature: Call/put ratio for >100 contracts
- options_skew_institutional: IV skew indicating institutional positioning
```

#### Model Type
**Random Forest Classifier** (robust to missing 13F data, handles non-linearity)
- **Hyperparameters**:
  ```python
  {
    "n_estimators": 200,
    "max_depth": 10,
    "min_samples_split": 10,
    "min_samples_leaf": 5,
    "max_features": "sqrt",
    "bootstrap": True,
    "class_weight": "balanced",
    "random_state": 42
  }
  ```
- **Training Data**: S&P 500 stocks, 5 years (13F quarterly filings), ~8K examples
- **Expected Accuracy**: 65-75% (baseline: 33% random, institutional data is high-signal)

#### Integration Points

**Service File**: `app/services/ml/institutional-flow/InstitutionalFlowService.ts`
```typescript
export class InstitutionalFlowService {
  private static modelVersion = "v1.0.0"
  private featureExtractor: InstitutionalFlowFeatureExtractor
  private cache: RedisCache
  private config: InstitutionalFlowConfig

  async predictInstitutionalFlow(
    symbol: string,
    sector: string
  ): Promise<InstitutionalFlowPrediction | null>

  // Returns null if:
  // - Confidence too low (0.40-0.65 range)
  // - No 13F data available (stock too small)
  // - 13F data stale (>95 days old)
  // - Feature extraction fails
}
```

**Feature Extractor**: `app/services/ml/features/InstitutionalFlowFeatureExtractor.ts`
```typescript
export class InstitutionalFlowFeatureExtractor {
  private institutionalService: InstitutionalDataService
  private optionsService: OptionsDataService
  private vwapService: VWAPService

  async extractFeatures(symbol: string): Promise<InstitutionalFlowFeatures>
  // Returns 26-feature object
  // Handles missing 13F data gracefully (quarterly filings)
}
```

**Model Path**: `models/institutional-flow/v1.0.0/`
- `model.pkl` - Scikit-learn Random Forest model file
- `normalizer.json` - Feature normalization parameters
- `metadata.json` - Model performance, features, training date

**Cache Key**: `institutional_flow:{symbol}`
**Cache TTL**: 3600 seconds (1 hour - 13F data updates quarterly, can cache longer)

#### Performance Targets
- **Feature Extraction**: <300ms (13F parsing can be slow)
- **Inference (cached)**: <40ms
- **Inference (uncached)**: <500ms
- **Cache Hit Rate**: >90% (institutional data changes infrequently)

#### Error Handling
```typescript
// Graceful degradation with institutional-specific checks
try {
  // Pre-check: Does stock have institutional coverage?
  const holdings = await institutionalService.getInstitutionalHoldings(symbol)
  if (!holdings || holdings.length === 0) {
    console.log(`No institutional data for ${symbol}`)
    return null
  }

  // Check data freshness (13F filings are quarterly)
  const latestFilingAge = Date.now() - holdings[0].filingDate
  if (latestFilingAge > 95 * 24 * 60 * 60 * 1000) { // >95 days
    console.log(`Stale institutional data for ${symbol}`)
    return null
  }

  const prediction = await service.predictInstitutionalFlow(symbol, sector)
  if (prediction && prediction.confidence > 0.65) {
    // High-confidence institutional flow detected
  }
} catch (error) {
  console.error("Institutional flow prediction failed:", error)
  return null
}
```

---

### Model 5: Earnings Surprise Model

#### Prediction Target
**Earnings beat/miss probability** (1 quarter ahead):
- `BEAT_EXPECTED`: Predicts earnings beat (actual > estimate)
- `MISS_EXPECTED`: Predicts earnings miss (actual < estimate)
- `NEUTRAL`: In-line earnings expected

**Confidence Threshold**: Skip predictions with 0.40 < confidence < 0.65

#### Data Sources & Features (30 features)

**FMP API** (FinancialModelingPrepAPI.ts):
```typescript
// Historical Earnings Performance (8 features)
- earnings_surprise_avg_4q: Average earnings surprise last 4 quarters
- earnings_surprise_consistency: Standard deviation of surprises
- revenue_surprise_avg_4q: Average revenue surprise last 4 quarters
- earnings_beat_streak: Consecutive quarters of beats
- earnings_miss_streak: Consecutive quarters of misses
- earnings_guidance_accuracy: Guidance vs actual (management credibility)
- whisper_number_delta: Whisper number vs consensus (sentiment)
- analyst_estimate_dispersion: Standard deviation of estimates (uncertainty)

// Earnings Revisions (6 features)
- eps_revision_trend_30d: 30-day EPS estimate revision trend
- eps_revision_magnitude: Magnitude of revisions
- revenue_revision_trend_30d: Revenue estimate revision trend
- analyst_coverage_change_90d: Change in number of covering analysts
- estimate_revision_velocity: Rate of estimate changes
- positive_revision_ratio: Positive revisions / total revisions

// Fundamental Trends (8 features)
- revenue_growth_qoq: Quarter-over-quarter revenue growth
- revenue_growth_acceleration: Change in revenue growth rate
- operating_margin_trend: Operating margin trend (improving/declining)
- free_cash_flow_trend: FCF trend
- inventory_turnover_change: Inventory efficiency change
- receivables_growth_vs_revenue: Receivables growth vs revenue growth (quality)
- capex_to_revenue_ratio: Capital expenditure intensity
- rnd_efficiency: R&D spending efficiency
```

**MacroeconomicAnalysisService.ts** (FRED, BLS):
```typescript
// Macro Context (4 features)
- gdp_growth_qoq: GDP growth (macro headwinds/tailwinds)
- consumer_confidence_delta: Consumer confidence change
- sector_pmi: Sector-specific PMI (manufacturing/services)
- credit_spread: BBB credit spread (financial conditions)
```

**SentimentAnalysisService.ts**:
```typescript
// Sentiment Leading Indicators (4 features)
- earnings_preview_sentiment: News sentiment in pre-earnings period
- management_tone_shift: Change in management communication tone
- competitor_earnings_performance: How competitors performed
- supply_chain_sentiment: Supply chain disruption mentions
```

#### Model Type
**LightGBM Gradient Boosting Classifier**
- **Hyperparameters**:
  ```python
  {
    "objective": "multiclass",
    "num_class": 3,
    "metric": "multi_logloss",
    "max_depth": 7,
    "num_leaves": 63,
    "learning_rate": 0.04,
    "feature_fraction": 0.85,
    "bagging_fraction": 0.85,
    "bagging_freq": 5,
    "min_data_in_leaf": 20,
    "verbose": -1
  }
  ```
- **Training Data**: S&P 500 stocks, 10 years (40 quarters), ~20K examples
- **Expected Accuracy**: 60-70% (baseline: 33% random, historical surprises are predictive)

#### Integration Points

**Service File**: `app/services/ml/earnings-surprise/EarningsSurpriseService.ts`
```typescript
export class EarningsSurpriseService {
  private static modelVersion = "v1.0.0"
  private featureExtractor: EarningsSurpriseFeatureExtractor
  private cache: RedisCache
  private config: EarningsSurpriseConfig

  async predictEarningsSurprise(
    symbol: string,
    sector: string
  ): Promise<EarningsSurprisePrediction | null>

  // Returns null if:
  // - Confidence too low (0.40-0.65 range)
  // - No earnings date scheduled (>90 days away)
  // - Insufficient historical earnings data (<4 quarters)
  // - Feature extraction fails
}
```

**Feature Extractor**: `app/services/ml/features/EarningsSurpriseFeatureExtractor.ts`
```typescript
export class EarningsSurpriseFeatureExtractor {
  private fmpAPI: FinancialModelingPrepAPI
  private macroService: MacroeconomicAnalysisService
  private sentimentService: SentimentAnalysisService

  async extractFeatures(symbol: string): Promise<EarningsSurpriseFeatures>
  // Returns 30-feature object
  // Requires earnings calendar and historical surprises
}
```

**Model Path**: `models/earnings-surprise/v1.0.0/`
- `model.txt` - LightGBM model file
- `normalizer.json` - Feature normalization parameters
- `metadata.json` - Model performance, features, training date

**Cache Key**: `earnings_surprise:{symbol}`
**Cache TTL**: 1800 seconds (30 minutes - earnings estimates update infrequently)

#### Performance Targets
- **Feature Extraction**: <200ms (FMP API has earnings data cached)
- **Inference (cached)**: <35ms
- **Inference (uncached)**: <450ms
- **Cache Hit Rate**: >85% (earnings data changes infrequently)

#### Error Handling
```typescript
// Graceful degradation with earnings-specific checks
try {
  // Pre-check: Is earnings date approaching?
  const earningsCalendar = await fmpAPI.getEarningsCalendar(symbol)
  if (!earningsCalendar || earningsCalendar.daysUntil > 90) {
    console.log(`Earnings too far out for ${symbol} (${earningsCalendar?.daysUntil} days)`)
    return null
  }

  // Check historical earnings data
  const historicalSurprises = await fmpAPI.getHistoricalEarningsSurprises(symbol)
  if (historicalSurprises.length < 4) {
    console.log(`Insufficient earnings history for ${symbol}`)
    return null
  }

  const prediction = await service.predictEarningsSurprise(symbol, sector)
  if (prediction && prediction.confidence > 0.65) {
    // High-confidence earnings surprise prediction
  }
} catch (error) {
  console.error("Earnings surprise prediction failed:", error)
  return null
}
```

---

### Model 6: Macro Regime Detection Model

#### Prediction Target
**Market regime classification** (30-day horizon):
- `RISK_ON`: Bull market, low volatility, growth-favorable (favor growth stocks)
- `RISK_OFF`: Bear market, high volatility, defensive regime (favor defensive stocks)
- `TRANSITIONAL`: Regime change in progress (mixed signals)

**Confidence Threshold**: Skip predictions with 0.35 < confidence < 0.60

**Note**: This is a **market-level** model, not stock-specific. Predictions apply to all stocks but with sector-specific adjustments.

#### Data Sources & Features (35 features)

**FREDAPI.ts** (Federal Reserve Economic Data):
```typescript
// Interest Rates & Monetary Policy (8 features)
- fed_funds_rate: Current federal funds rate
- fed_funds_rate_change_30d: 30-day change in fed funds rate
- fed_funds_rate_change_90d: 90-day change (trend)
- treasury_yield_2y: 2-year treasury yield
- treasury_yield_10y: 10-year treasury yield
- yield_curve_slope: 10Y - 2Y spread (recession indicator)
- real_interest_rate: Fed funds - CPI inflation
- rate_change_momentum: Acceleration of rate changes

// Economic Growth (8 features)
- gdp_growth_qoq: Quarter-over-quarter GDP growth
- gdp_growth_acceleration: Change in GDP growth rate
- industrial_production_growth: Industrial production MoM
- retail_sales_growth: Retail sales MoM
- durable_goods_orders_growth: Durable goods orders MoM
- manufacturing_pmi: ISM Manufacturing PMI
- services_pmi: ISM Services PMI
- coincident_economic_index: Composite economic index
```

**BLSAPI.ts** (Bureau of Labor Statistics):
```typescript
// Inflation & Employment (6 features)
- cpi_inflation_rate: Consumer Price Index YoY
- cpi_inflation_momentum: Change in inflation rate
- core_pce_inflation: Core PCE (Fed's preferred inflation measure)
- unemployment_rate: Current unemployment rate
- unemployment_rate_change: 3-month change
- labor_force_participation_rate: Participation rate
```

**MarketIndicesService.ts**:
```typescript
// Market Indicators (8 features)
- spy_momentum_20d: S&P 500 20-day momentum
- spy_volatility_30d: 30-day realized volatility
- vix_level: VIX index (fear gauge)
- vix_change_30d: 30-day VIX change
- market_breadth: Advance/decline ratio
- new_highs_new_lows: NH-NL indicator
- put_call_ratio_market: Market-wide put/call ratio
- skew_index: CBOE SKEW index (tail risk)
```

**CurrencyDataService.ts** & **EIAAPI.ts**:
```typescript
// Global Risk Indicators (5 features)
- dxy_dollar_index: US dollar strength (risk-off = strong dollar)
- dxy_change_30d: Dollar momentum
- gold_price_change: Gold as safe haven
- crude_oil_price_change: Oil as growth proxy
- copper_gold_ratio: Copper/gold (growth vs safety)
```

#### Model Type
**LightGBM Gradient Boosting Classifier**
- **Hyperparameters**:
  ```python
  {
    "objective": "multiclass",
    "num_class": 3,
    "metric": "multi_logloss",
    "max_depth": 5,
    "num_leaves": 31,
    "learning_rate": 0.05,
    "feature_fraction": 0.9,
    "bagging_fraction": 0.9,
    "bagging_freq": 5,
    "min_data_in_leaf": 30,
    "verbose": -1
  }
  ```
- **Training Data**: 20 years of macro data (1995-2024), labeled by market regimes, ~250 examples
- **Expected Accuracy**: 70-80% (baseline: 33% random, macro regimes are persistent)

#### Integration Points

**Service File**: `app/services/ml/macro-regime/MacroRegimeService.ts`
```typescript
export class MacroRegimeService {
  private static modelVersion = "v1.0.0"
  private featureExtractor: MacroRegimeFeatureExtractor
  private cache: RedisCache
  private config: MacroRegimeConfig
  private currentRegime: MacroRegimePrediction | null = null

  async predictMacroRegime(): Promise<MacroRegimePrediction | null>
  // No symbol parameter - this is market-level

  async getRegimeForSymbol(
    symbol: string,
    sector: string
  ): Promise<MacroRegimePrediction | null>
  // Adjusts market regime for sector-specific factors

  // Returns null if:
  // - Confidence too low (0.35-0.60 range)
  // - Macro data unavailable (FRED/BLS API down)
  // - Feature extraction fails
}
```

**Feature Extractor**: `app/services/ml/features/MacroRegimeFeatureExtractor.ts`
```typescript
export class MacroRegimeFeatureExtractor {
  private fredAPI: FREDAPI
  private blsAPI: BLSAPI
  private marketIndicesService: MarketIndicesService
  private currencyService: CurrencyDataService
  private eiaAPI: EIAAPI

  async extractFeatures(): Promise<MacroRegimeFeatures>
  // Returns 35-feature object
  // No symbol parameter - market-level features
}
```

**Model Path**: `models/macro-regime/v1.0.0/`
- `model.txt` - LightGBM model file
- `normalizer.json` - Feature normalization parameters
- `metadata.json` - Model performance, features, training date

**Cache Key**: `macro_regime:global`
**Cache TTL**: 7200 seconds (2 hours - macro data changes slowly)

#### Performance Targets
- **Feature Extraction**: <400ms (multiple government APIs)
- **Inference (cached)**: <30ms
- **Inference (uncached)**: <600ms
- **Cache Hit Rate**: >95% (macro regime changes slowly, 2-hour cache)

#### Sector-Specific Adjustments
```typescript
// Adjust macro regime for sector characteristics
const sectorAdjustments = {
  "Technology": {
    "RISK_ON": 1.2,    // Tech outperforms in RISK_ON
    "RISK_OFF": 0.7,   // Tech underperforms in RISK_OFF
    "TRANSITIONAL": 1.0
  },
  "Utilities": {
    "RISK_ON": 0.8,    // Utilities underperform in RISK_ON
    "RISK_OFF": 1.3,   // Utilities outperform in RISK_OFF
    "TRANSITIONAL": 1.0
  },
  // ... other sectors
}
```

#### Error Handling
```typescript
// Graceful degradation with macro-specific checks
try {
  // Macro regime is global - fetch once, cache for 2 hours
  const prediction = await service.predictMacroRegime()

  if (prediction && prediction.confidence > 0.60) {
    // Apply sector-specific adjustment
    const adjustedPrediction = service.getRegimeForSymbol(symbol, sector)
    // Use adjusted regime signal
  }
} catch (error) {
  console.error("Macro regime prediction failed:", error)
  // Fallback to neutral regime assumption
  return { regime: "TRANSITIONAL", confidence: 0.5 }
}
```

---

## EnsembleService Implementation

**File**: `app/services/ml/ensemble/MLEnsembleService.ts`

### Purpose
Orchestrate all ML models, aggregate predictions via weighted consensus, and integrate with StockSelectionService.

### Architecture

```typescript
export interface ModelPrediction {
  modelId: string
  prediction: string // UP/DOWN/NEUTRAL, UPGRADE_EXPECTED/DOWNGRADE_EXPECTED, etc.
  confidence: number
  probabilities: Record<string, number>
  reasoning: string[]
  latency: number
  timestamp: number
}

export interface EnsemblePrediction {
  symbol: string
  consensusPrediction: string // Final aggregated prediction
  consensusConfidence: number
  modelPredictions: ModelPrediction[]
  weights: Record<string, number> // Model weights used
  reasoning: string[]
  metadata: {
    modelsUsed: number
    modelsFailed: number
    averageLatency: number
    cacheHitRate: number
  }
  timestamp: number
}

export class MLEnsembleService {
  private earlySignalService: EarlySignalService
  private pricePredictionService: PricePredictionService
  private analystSentimentService: AnalystSentimentService
  private optionsFlowService: OptionsFlowService
  private socialSentimentService: SocialSentimentAccelService
  private institutionalFlowService: InstitutionalFlowService
  private earningsSurpriseService: EarningsSurpriseService
  private macroRegimeService: MacroRegimeService
  private toggleService: MLFeatureToggleService
  private cache: RedisCache

  /**
   * Predict with all enabled models in parallel
   * Apply weighted consensus algorithm
   * Handle failures gracefully (skip failed models)
   */
  async predictEnsemble(
    symbol: string,
    sector: string
  ): Promise<EnsemblePrediction | null>

  /**
   * Weighted consensus algorithm
   *
   * Strategy:
   * 1. Group predictions by direction (UP/DOWN/NEUTRAL)
   * 2. Apply model-specific weights (higher weight = more trusted)
   * 3. Apply confidence-based weighting (higher confidence = more weight)
   * 4. Calculate weighted vote for each direction
   * 5. Return direction with highest weighted vote
   */
  private calculateConsensus(
    predictions: ModelPrediction[],
    weights: Record<string, number>
  ): { prediction: string; confidence: number }

  /**
   * Get model weights (dynamic, based on recent performance)
   * Default weights if no performance history
   */
  private getModelWeights(): Record<string, number>

  /**
   * Generate ensemble reasoning (why this consensus?)
   */
  private generateReasoning(
    predictions: ModelPrediction[],
    consensus: string
  ): string[]
}
```

### Weighted Consensus Algorithm

```typescript
/**
 * Weighted Consensus Algorithm
 *
 * Input: ModelPrediction[] (e.g., 6 models with predictions)
 * Output: { prediction: string, confidence: number }
 *
 * Algorithm:
 * 1. For each model prediction:
 *    - Map prediction to direction (UP/DOWN/NEUTRAL)
 *    - Weight = model_weight * confidence
 * 2. Aggregate weights by direction:
 *    - UP_weight = sum(weights for UP predictions)
 *    - DOWN_weight = sum(weights for DOWN predictions)
 *    - NEUTRAL_weight = sum(weights for NEUTRAL predictions)
 * 3. Consensus = direction with max weight
 * 4. Consensus confidence = max_weight / total_weight
 *
 * Example:
 * Model 1 (Early Signal): UPGRADE_EXPECTED (0.85 conf) → UP, weight = 0.15 * 0.85 = 0.128
 * Model 2 (Price Prediction): UP (0.70 conf) → UP, weight = 0.15 * 0.70 = 0.105
 * Model 3 (Options Flow): BULLISH_FLOW (0.65 conf) → UP, weight = 0.12 * 0.65 = 0.078
 * Model 4 (Social Sentiment): NEUTRAL (0.55 conf) → NEUTRAL, weight = 0.10 * 0.55 = 0.055
 * Model 5 (Institutional): ACCUMULATION (0.75 conf) → UP, weight = 0.18 * 0.75 = 0.135
 * Model 6 (Macro Regime): RISK_ON (0.80 conf) → UP, weight = 0.10 * 0.80 = 0.080
 *
 * UP_weight = 0.128 + 0.105 + 0.078 + 0.135 + 0.080 = 0.526
 * NEUTRAL_weight = 0.055
 * DOWN_weight = 0
 * Total = 0.581
 *
 * Consensus: UP (0.526 / 0.581 = 0.905 confidence)
 */
private calculateConsensus(
  predictions: ModelPrediction[],
  weights: Record<string, number>
): { prediction: string; confidence: number } {
  // Map predictions to canonical directions
  const directionMap: Record<string, string> = {
    // Early Signal
    "UPGRADE_EXPECTED": "UP",
    "DOWNGRADE_EXPECTED": "DOWN",
    "NEUTRAL": "NEUTRAL",

    // Price Prediction
    "UP": "UP",
    "DOWN": "DOWN",

    // Analyst Sentiment
    "UPGRADE_EXPECTED": "UP",
    "DOWNGRADE_EXPECTED": "DOWN",

    // Options Flow
    "BULLISH_FLOW": "UP",
    "BEARISH_FLOW": "DOWN",

    // Social Sentiment
    "ACCELERATING_POSITIVE": "UP",
    "ACCELERATING_NEGATIVE": "DOWN",

    // Institutional Flow
    "ACCUMULATION": "UP",
    "DISTRIBUTION": "DOWN",

    // Earnings Surprise
    "BEAT_EXPECTED": "UP",
    "MISS_EXPECTED": "DOWN",

    // Macro Regime
    "RISK_ON": "UP",
    "RISK_OFF": "DOWN",
    "TRANSITIONAL": "NEUTRAL"
  }

  // Aggregate weighted votes
  const votes = { UP: 0, DOWN: 0, NEUTRAL: 0 }

  predictions.forEach(pred => {
    const direction = directionMap[pred.prediction] || "NEUTRAL"
    const modelWeight = weights[pred.modelId] || 0.1
    const weightedVote = modelWeight * pred.confidence
    votes[direction] += weightedVote
  })

  // Find consensus
  const totalWeight = votes.UP + votes.DOWN + votes.NEUTRAL
  const maxVote = Math.max(votes.UP, votes.DOWN, votes.NEUTRAL)

  let consensusPrediction = "NEUTRAL"
  if (maxVote === votes.UP) consensusPrediction = "UP"
  else if (maxVote === votes.DOWN) consensusPrediction = "DOWN"

  const consensusConfidence = totalWeight > 0 ? maxVote / totalWeight : 0

  return { prediction: consensusPrediction, confidence: consensusConfidence }
}
```

### Model Weights (Default)

```typescript
private readonly DEFAULT_WEIGHTS = {
  "early_signal": 0.15,        // High weight - proven accuracy (97.6%)
  "price_prediction": 0.15,    // High weight - direct price prediction
  "analyst_sentiment": 0.12,   // Medium weight - analyst data is delayed
  "options_flow": 0.12,        // Medium weight - noisy but valuable
  "social_sentiment": 0.10,    // Lower weight - very noisy, early signal
  "institutional_flow": 0.18,  // Highest weight - smart money, high signal
  "earnings_surprise": 0.12,   // Medium weight - quarterly only
  "macro_regime": 0.06         // Lowest weight - market-level, not stock-specific
}
// Total: 1.00
```

### Integration with StockSelectionService

```typescript
// File: app/services/stock-selection/StockSelectionService.ts

// Add EnsembleService dependency
constructor(
  // ... existing dependencies
  private ensembleService?: MLEnsembleService
) { ... }

// Modify selectStocks() method
async selectStocks(request: SelectionRequest): Promise<SelectionResponse> {
  // ... existing VFR analysis logic

  // Get ML ensemble prediction
  let mlPrediction: EnsemblePrediction | null = null
  if (this.ensembleService && request.options?.includeMLPredictions !== false) {
    try {
      mlPrediction = await this.ensembleService.predictEnsemble(
        symbol,
        sector
      )
    } catch (error) {
      console.error("ML ensemble prediction failed:", error)
      // Continue without ML predictions
    }
  }

  // Combine VFR score (90%) + ML score (10%)
  const finalScore = this.combineVFRandML(vfrScore, mlPrediction)

  // Generate 7-tier recommendation
  const recommendation = this.get7TierRecommendation(finalScore)

  return {
    // ... existing response
    mlPrediction, // Include ML predictions in response
    recommendation
  }
}

private combineVFRandML(
  vfrScore: number,
  mlPrediction: EnsemblePrediction | null
): number {
  if (!mlPrediction) return vfrScore // No ML signal, use 100% VFR

  // Map ML consensus to score adjustment
  const mlScoreAdjustment = this.mapMLToScore(mlPrediction)

  // 90% VFR + 10% ML
  return vfrScore * 0.9 + mlScoreAdjustment * 0.1
}

private mapMLToScore(prediction: EnsemblePrediction): number {
  const { consensusPrediction, consensusConfidence } = prediction

  // Map prediction to score multiplier
  if (consensusPrediction === "UP") {
    return 100 * consensusConfidence // 0-100
  } else if (consensusPrediction === "DOWN") {
    return -100 * consensusConfidence // -100 to 0
  } else {
    return 0 // NEUTRAL
  }
}
```

---

## Implementation Phases

### Overview
12-week implementation plan, broken into 2-week sprints. Each sprint delivers production-ready models with A/B testing capability.

**Total Duration**: 12 weeks (October 7, 2025 - December 31, 2025)

---

### Week 1-2: Foundation & Model 1 (Analyst Sentiment)

**Objectives:**
- ✅ Set up EnsembleService infrastructure
- ✅ Implement Model 1: Analyst Sentiment Model
- ✅ Establish testing & deployment patterns

**Deliverables:**

**1. EnsembleService Foundation** (Week 1, Days 1-3)
- Create `app/services/ml/ensemble/MLEnsembleService.ts`
  - Implement weighted consensus algorithm
  - Model orchestration (parallel execution)
  - Error boundary handling
  - Performance tracking
- Create `app/services/ml/ensemble/types.ts`
  - Interface definitions for predictions
  - Ensemble configuration types
- Add to MLFeatureToggleService:
  - `ensemble_enabled` toggle
  - Per-model toggles for 6 new models
- Unit tests: `app/services/ml/ensemble/__tests__/MLEnsembleService.test.ts`

**2. Analyst Sentiment Model** (Week 1 Day 4 - Week 2)
- Feature extractor: `app/services/ml/features/AnalystSentimentFeatureExtractor.ts`
  - 32 features (analyst coverage, institutional, options, sentiment)
  - Data source integration (FMP, InstitutionalDataService, OptionsDataService, SentimentAnalysisService)
  - Unit tests: `__tests__/AnalystSentimentFeatureExtractor.test.ts`
- Dataset generation: `scripts/ml/generate-analyst-sentiment-dataset.ts`
  - S&P 500 stocks, 3 years historical
  - Label: analyst upgrades/downgrades within 3 weeks
  - Target: 50K examples
- Dataset splitting: `scripts/ml/split-analyst-sentiment-dataset.py`
  - 70/15/15 train/val/test split
- Model training: `scripts/ml/train-analyst-sentiment-model.py`
  - LightGBM classifier
  - Hyperparameter tuning (Optuna)
  - Target accuracy: 60-70%
- Service implementation: `app/services/ml/analyst-sentiment/AnalystSentimentService.ts`
  - Prediction pipeline (cache → features → predict → cache)
  - Confidence filtering (0.35-0.65 skip)
  - Redis caching (5-minute TTL)
  - Unit tests: `__tests__/AnalystSentimentService.test.ts`
- Model registration: `scripts/ml/register-analyst-sentiment-model.ts`
  - Deploy to `models/analyst-sentiment/v1.0.0/`
  - Update metadata.json

**3. Integration & Testing** (Week 2, Days 4-5)
- Integrate Analyst Sentiment into EnsembleService
- Add feature toggle: `analyst_sentiment_enabled`
- End-to-end testing:
  - Test with 10 symbols (AAPL, GOOGL, MSFT, TSLA, etc.)
  - Verify <400ms latency (feature extraction + inference)
  - Verify >85% cache hit rate
- Performance baseline: `scripts/ml/benchmark-analyst-sentiment.ts`

**Files Created:**
```
app/services/ml/ensemble/
  ├── MLEnsembleService.ts
  ├── types.ts
  └── __tests__/MLEnsembleService.test.ts

app/services/ml/analyst-sentiment/
  ├── AnalystSentimentService.ts
  └── __tests__/AnalystSentimentService.test.ts

app/services/ml/features/
  ├── AnalystSentimentFeatureExtractor.ts
  └── __tests__/AnalystSentimentFeatureExtractor.test.ts

scripts/ml/
  ├── generate-analyst-sentiment-dataset.ts
  ├── split-analyst-sentiment-dataset.py
  ├── train-analyst-sentiment-model.py
  ├── register-analyst-sentiment-model.ts
  └── benchmark-analyst-sentiment.ts

models/analyst-sentiment/v1.0.0/
  ├── model.txt
  ├── normalizer.json
  └── metadata.json
```

---

### Week 3-4: Model 2 (Options Flow)

**Objectives:**
- ✅ Implement Model 2: Options Flow Model
- ✅ Handle options-specific edge cases (illiquid stocks)
- ✅ Optimize for options chain processing

**Deliverables:**

**1. Options Flow Feature Extractor** (Week 3, Days 1-2)
- Create `app/services/ml/features/OptionsFlowFeatureExtractor.ts`
  - 28 features (volume/OI, Greeks, strike analysis, flow characteristics)
  - Optimize options chain processing (<250ms target)
  - Handle missing options data gracefully
  - Unit tests: `__tests__/OptionsFlowFeatureExtractor.test.ts`

**2. Dataset Generation** (Week 3, Days 3-4)
- Script: `scripts/ml/generate-options-flow-dataset.ts`
  - Filter: stocks with >10K daily options volume
  - Time period: 2 years (2023-2024)
  - Label: price movement 1 week after unusual options flow
  - Target: 40K examples
- Split: `scripts/ml/split-options-flow-dataset.py`

**3. Model Training** (Week 3, Day 5 - Week 4, Day 1)
- Script: `scripts/ml/train-options-flow-model.py`
  - XGBoost classifier (better for options flow patterns)
  - Hyperparameter tuning
  - Target accuracy: 55-65%
- Evaluate: `scripts/ml/evaluate-options-flow-model.py`

**4. Service Implementation** (Week 4, Days 2-4)
- Service: `app/services/ml/options-flow/OptionsFlowService.ts`
  - Pre-check: options liquidity (>100 contracts/day)
  - Prediction pipeline
  - Redis caching (1-minute TTL - options change rapidly)
  - Unit tests: `__tests__/OptionsFlowService.test.ts`
- Model registration: `scripts/ml/register-options-flow-model.ts`

**5. Integration** (Week 4, Day 5)
- Integrate into EnsembleService
- Add feature toggle: `options_flow_enabled`
- Performance testing: target <500ms uncached latency
- Benchmark: `scripts/ml/benchmark-options-flow.ts`

**Files Created:**
```
app/services/ml/options-flow/
  ├── OptionsFlowService.ts
  └── __tests__/OptionsFlowService.test.ts

app/services/ml/features/
  ├── OptionsFlowFeatureExtractor.ts
  └── __tests__/OptionsFlowFeatureExtractor.test.ts

scripts/ml/
  ├── generate-options-flow-dataset.ts
  ├── split-options-flow-dataset.py
  ├── train-options-flow-model.py
  ├── evaluate-options-flow-model.py
  ├── register-options-flow-model.ts
  └── benchmark-options-flow.ts

models/options-flow/v1.0.0/
  ├── model.xgb
  ├── normalizer.json
  └── metadata.json
```

---

### Week 5-6: Model 3 (Social Sentiment Acceleration)

**Objectives:**
- ✅ Implement Model 3: Social Sentiment Acceleration Model
- ✅ Handle time-series LSTM architecture
- ✅ Integrate Reddit API for social data

**Deliverables:**

**1. Social Sentiment Feature Extractor** (Week 5, Days 1-2)
- Create `app/services/ml/features/SocialSentimentFeatureExtractor.ts`
  - 24 features (Reddit volume, sentiment, influence metrics)
  - 24-hour time-series data collection
  - Handle missing social data (stocks with low social volume)
  - Unit tests: `__tests__/SocialSentimentFeatureExtractor.test.ts`

**2. Dataset Generation** (Week 5, Days 3-5)
- Script: `scripts/ml/generate-social-sentiment-dataset.ts`
  - Filter: stocks with >10 Reddit mentions/24h
  - Focus: meme stocks + high-social-volume stocks
  - Time period: 2 years (2023-2024)
  - Label: price movement 1 week after social momentum
  - Target: 30K examples (smaller dataset, noisy data)
- Split: `scripts/ml/split-social-sentiment-dataset.py`

**3. Model Training** (Week 6, Days 1-2)
- Script: `scripts/ml/train-social-sentiment-model.py`
  - LSTM neural network (Keras/TensorFlow)
  - Sequence length: 24 hours (hourly snapshots)
  - Hyperparameter tuning
  - Target accuracy: 50-60% (social data is very noisy)
- Evaluate: `scripts/ml/evaluate-social-sentiment-model.py`

**4. Service Implementation** (Week 6, Days 3-4)
- Service: `app/services/ml/social-sentiment/SocialSentimentAccelService.ts`
  - Pre-check: social mention count >10 in 24h
  - LSTM inference (slower than tree models)
  - Redis caching (5-minute TTL)
  - Unit tests: `__tests__/SocialSentimentAccelService.test.ts`
- Model registration: `scripts/ml/register-social-sentiment-model.ts`

**5. Integration** (Week 6, Day 5)
- Integrate into EnsembleService
- Add feature toggle: `social_sentiment_enabled`
- Performance testing: target <600ms uncached latency (LSTM slower)
- Benchmark: `scripts/ml/benchmark-social-sentiment.ts`

**Files Created:**
```
app/services/ml/social-sentiment/
  ├── SocialSentimentAccelService.ts
  └── __tests__/SocialSentimentAccelService.test.ts

app/services/ml/features/
  ├── SocialSentimentFeatureExtractor.ts
  └── __tests__/SocialSentimentFeatureExtractor.test.ts

scripts/ml/
  ├── generate-social-sentiment-dataset.ts
  ├── split-social-sentiment-dataset.py
  ├── train-social-sentiment-model.py
  ├── evaluate-social-sentiment-model.py
  ├── register-social-sentiment-model.ts
  └── benchmark-social-sentiment.ts

models/social-sentiment/v1.0.0/
  ├── model.h5
  ├── normalizer.json
  └── metadata.json
```

---

### Week 7-8: Model 4 (Institutional Flow)

**Objectives:**
- ✅ Implement Model 4: Institutional Flow Model
- ✅ Handle 13F quarterly data (sparse, delayed)
- ✅ Parse SEC filings efficiently

**Deliverables:**

**1. Institutional Flow Feature Extractor** (Week 7, Days 1-2)
- Create `app/services/ml/features/InstitutionalFlowFeatureExtractor.ts`
  - 26 features (13F holdings, Form 4, dark pool, LEAPS)
  - Handle quarterly 13F data (sparse)
  - Data freshness checks (13F filings <95 days old)
  - Unit tests: `__tests__/InstitutionalFlowFeatureExtractor.test.ts`

**2. Dataset Generation** (Week 7, Days 3-5)
- Script: `scripts/ml/generate-institutional-flow-dataset.ts`
  - S&P 500 stocks (institutional coverage required)
  - Time period: 5 years (quarterly 13F filings)
  - Label: price movement 4 weeks after institutional flow change
  - Target: 8K examples (quarterly data = fewer examples)
- Split: `scripts/ml/split-institutional-flow-dataset.py`

**3. Model Training** (Week 8, Days 1-2)
- Script: `scripts/ml/train-institutional-flow-model.py`
  - Random Forest classifier (robust to missing 13F data)
  - Hyperparameter tuning
  - Target accuracy: 65-75% (institutional data is high-signal)
- Evaluate: `scripts/ml/evaluate-institutional-flow-model.py`

**4. Service Implementation** (Week 8, Days 3-4)
- Service: `app/services/ml/institutional-flow/InstitutionalFlowService.ts`
  - Pre-check: institutional coverage (13F filings exist)
  - Data freshness check (13F <95 days old)
  - Redis caching (1-hour TTL - institutional data changes slowly)
  - Unit tests: `__tests__/InstitutionalFlowService.test.ts`
- Model registration: `scripts/ml/register-institutional-flow-model.ts`

**5. Integration** (Week 8, Day 5)
- Integrate into EnsembleService
- Add feature toggle: `institutional_flow_enabled`
- Performance testing: target <500ms uncached latency
- Benchmark: `scripts/ml/benchmark-institutional-flow.ts`

**Files Created:**
```
app/services/ml/institutional-flow/
  ├── InstitutionalFlowService.ts
  └── __tests__/InstitutionalFlowService.test.ts

app/services/ml/features/
  ├── InstitutionalFlowFeatureExtractor.ts
  └── __tests__/InstitutionalFlowFeatureExtractor.test.ts

scripts/ml/
  ├── generate-institutional-flow-dataset.ts
  ├── split-institutional-flow-dataset.py
  ├── train-institutional-flow-model.py
  ├── evaluate-institutional-flow-model.py
  ├── register-institutional-flow-model.ts
  └── benchmark-institutional-flow.ts

models/institutional-flow/v1.0.0/
  ├── model.pkl
  ├── normalizer.json
  └── metadata.json
```

---

### Week 9-10: Model 5 (Earnings Surprise)

**Objectives:**
- ✅ Implement Model 5: Earnings Surprise Model
- ✅ Handle quarterly earnings data
- ✅ Integrate earnings calendar

**Deliverables:**

**1. Earnings Surprise Feature Extractor** (Week 9, Days 1-2)
- Create `app/services/ml/features/EarningsSurpriseFeatureExtractor.ts`
  - 30 features (historical surprises, revisions, fundamentals, macro, sentiment)
  - Earnings calendar integration (FMP API)
  - Historical earnings data (4+ quarters required)
  - Unit tests: `__tests__/EarningsSurpriseFeatureExtractor.test.ts`

**2. Dataset Generation** (Week 9, Days 3-5)
- Script: `scripts/ml/generate-earnings-surprise-dataset.ts`
  - S&P 500 stocks
  - Time period: 10 years (40 quarters)
  - Label: earnings beat/miss actual vs estimate
  - Target: 20K examples (quarterly earnings)
- Split: `scripts/ml/split-earnings-surprise-dataset.py`

**3. Model Training** (Week 10, Days 1-2)
- Script: `scripts/ml/train-earnings-surprise-model.py`
  - LightGBM classifier
  - Hyperparameter tuning
  - Target accuracy: 60-70% (historical surprises are predictive)
- Evaluate: `scripts/ml/evaluate-earnings-surprise-model.py`

**4. Service Implementation** (Week 10, Days 3-4)
- Service: `app/services/ml/earnings-surprise/EarningsSurpriseService.ts`
  - Pre-check: earnings date <90 days away
  - Pre-check: historical earnings data (4+ quarters)
  - Redis caching (30-minute TTL)
  - Unit tests: `__tests__/EarningsSurpriseService.test.ts`
- Model registration: `scripts/ml/register-earnings-surprise-model.ts`

**5. Integration** (Week 10, Day 5)
- Integrate into EnsembleService
- Add feature toggle: `earnings_surprise_enabled`
- Performance testing: target <450ms uncached latency
- Benchmark: `scripts/ml/benchmark-earnings-surprise.ts`

**Files Created:**
```
app/services/ml/earnings-surprise/
  ├── EarningsSurpriseService.ts
  └── __tests__/EarningsSurpriseService.test.ts

app/services/ml/features/
  ├── EarningsSurpriseFeatureExtractor.ts
  └── __tests__/EarningsSurpriseFeatureExtractor.test.ts

scripts/ml/
  ├── generate-earnings-surprise-dataset.ts
  ├── split-earnings-surprise-dataset.py
  ├── train-earnings-surprise-model.py
  ├── evaluate-earnings-surprise-model.py
  ├── register-earnings-surprise-model.ts
  └── benchmark-earnings-surprise.ts

models/earnings-surprise/v1.0.0/
  ├── model.txt
  ├── normalizer.json
  └── metadata.json
```

---

### Week 11-12: Model 6 (Macro Regime) & Final Integration

**Objectives:**
- ✅ Implement Model 6: Macro Regime Detection Model
- ✅ Complete EnsembleService integration
- ✅ Production deployment & A/B testing

**Deliverables:**

**1. Macro Regime Feature Extractor** (Week 11, Days 1-2)
- Create `app/services/ml/features/MacroRegimeFeatureExtractor.ts`
  - 35 features (interest rates, economic growth, inflation, market indicators, global risk)
  - Government API integration (FRED, BLS, EIA)
  - Market-level features (no symbol parameter)
  - Unit tests: `__tests__/MacroRegimeFeatureExtractor.test.ts`

**2. Dataset Generation** (Week 11, Days 3-4)
- Script: `scripts/ml/generate-macro-regime-dataset.ts`
  - Time period: 20 years (1995-2024)
  - Label: market regime (RISK_ON/RISK_OFF/TRANSITIONAL)
  - Regime labeling: VIX, SPY momentum, yield curve
  - Target: 250 examples (market-level, monthly snapshots)
- Split: `scripts/ml/split-macro-regime-dataset.py`

**3. Model Training** (Week 11, Day 5 - Week 12, Day 1)
- Script: `scripts/ml/train-macro-regime-model.py`
  - LightGBM classifier
  - Hyperparameter tuning
  - Target accuracy: 70-80% (macro regimes are persistent)
- Evaluate: `scripts/ml/evaluate-macro-regime-model.py`

**4. Service Implementation** (Week 12, Days 2-3)
- Service: `app/services/ml/macro-regime/MacroRegimeService.ts`
  - Market-level prediction (cached globally for 2 hours)
  - Sector-specific adjustments (tech vs utilities vs defensives)
  - Redis caching (2-hour TTL - macro changes slowly)
  - Unit tests: `__tests__/MacroRegimeService.test.ts`
- Model registration: `scripts/ml/register-macro-regime-model.ts`

**5. Final EnsembleService Integration** (Week 12, Days 4-5)
- Integrate all 8 models into EnsembleService:
  1. Early Signal Detection (existing)
  2. Price Prediction (existing)
  3. Analyst Sentiment (new)
  4. Options Flow (new)
  5. Social Sentiment (new)
  6. Institutional Flow (new)
  7. Earnings Surprise (new)
  8. Macro Regime (new)
- Complete weighted consensus algorithm
- Performance optimization:
  - Parallel model execution (Promise.allSettled)
  - Cache coordination (shared cache for common features)
  - Timeout handling (skip models that take >2s)
- Integration testing:
  - Test with 100 symbols across sectors
  - Verify <600ms cumulative latency (all 6 new models)
  - Verify >80% cache hit rate
- A/B testing setup:
  - Create `/api/stocks/select-ml-ab` endpoint
  - 50% traffic to ML-enhanced, 50% to pure VFR
  - Track performance metrics (accuracy, latency, user satisfaction)
- Production deployment:
  - Deploy all 6 models with feature toggles DISABLED
  - Enable one model at a time over 2 weeks
  - Monitor performance, error rates, latency

**Files Created:**
```
app/services/ml/macro-regime/
  ├── MacroRegimeService.ts
  └── __tests__/MacroRegimeService.test.ts

app/services/ml/features/
  ├── MacroRegimeFeatureExtractor.ts
  └── __tests__/MacroRegimeFeatureExtractor.test.ts

scripts/ml/
  ├── generate-macro-regime-dataset.ts
  ├── split-macro-regime-dataset.py
  ├── train-macro-regime-model.py
  ├── evaluate-macro-regime-model.py
  ├── register-macro-regime-model.ts
  └── benchmark-macro-regime.ts

models/macro-regime/v1.0.0/
  ├── model.txt
  ├── normalizer.json
  └── metadata.json

app/api/stocks/
  └── select-ml-ab/route.ts (A/B testing endpoint)
```

---

## Testing Strategy

### Unit Testing
**Tool**: Jest
**Coverage Target**: >80% code coverage for all ML services

**Test Categories:**

1. **Feature Extractors** (`app/services/ml/features/__tests__/`)
   - Test data source integration (FMP, EODHD, InstitutionalDataService, etc.)
   - Test feature calculation correctness
   - Test missing data handling (null/undefined)
   - Test edge cases (illiquid options, no analyst coverage, etc.)
   - Mock external APIs to avoid rate limits

2. **ML Services** (`app/services/ml/{model}/__tests__/`)
   - Test prediction pipeline (cache → features → predict → cache)
   - Test confidence filtering (skip 0.35-0.65 range)
   - Test error handling (API timeout, model failure, etc.)
   - Test cache behavior (hit/miss, TTL)
   - Mock Python subprocess for model inference

3. **EnsembleService** (`app/services/ml/ensemble/__tests__/`)
   - Test weighted consensus algorithm
   - Test partial model failures (skip failed models)
   - Test parallel execution (Promise.allSettled)
   - Test model weight adjustment
   - Test reasoning generation

**Example Test:**
```typescript
// app/services/ml/analyst-sentiment/__tests__/AnalystSentimentService.test.ts
describe("AnalystSentimentService", () => {
  let service: AnalystSentimentService
  let mockCache: jest.Mocked<RedisCache>
  let mockFeatureExtractor: jest.Mocked<AnalystSentimentFeatureExtractor>

  beforeEach(() => {
    mockCache = createMockRedisCache()
    mockFeatureExtractor = createMockFeatureExtractor()
    service = new AnalystSentimentService({
      cache: mockCache,
      featureExtractor: mockFeatureExtractor
    })
  })

  describe("predictAnalystSentiment", () => {
    it("should return cached prediction if available", async () => {
      const cachedPrediction = { ... }
      mockCache.get.mockResolvedValue(JSON.stringify(cachedPrediction))

      const result = await service.predictAnalystSentiment("AAPL", "Technology")

      expect(result).toEqual(cachedPrediction)
      expect(mockFeatureExtractor.extractFeatures).not.toHaveBeenCalled()
    })

    it("should skip low-confidence predictions", async () => {
      mockCache.get.mockResolvedValue(null)
      mockFeatureExtractor.extractFeatures.mockResolvedValue({ ... })
      // Mock Python subprocess to return low confidence (0.50)
      mockPythonSubprocess.mockResolvedValue({ prediction: 1, confidence: 0.50 })

      const result = await service.predictAnalystSentiment("AAPL", "Technology")

      expect(result).toBeNull() // Low confidence skipped
    })

    it("should handle feature extraction failure gracefully", async () => {
      mockCache.get.mockResolvedValue(null)
      mockFeatureExtractor.extractFeatures.mockRejectedValue(new Error("API timeout"))

      const result = await service.predictAnalystSentiment("AAPL", "Technology")

      expect(result).toBeNull() // Graceful fallback
    })
  })
})
```

### Integration Testing
**Tool**: Jest + Supertest (API testing)
**Environment**: Test database + Redis (local)

**Test Scenarios:**

1. **End-to-End Prediction** (10 symbols)
   - Test full pipeline: API request → EnsembleService → 8 models → weighted consensus → response
   - Verify response structure
   - Verify latency <600ms (cumulative)
   - Verify all models execute in parallel

2. **Cache Behavior**
   - Test cache hit (2nd request for same symbol)
   - Test cache miss (1st request)
   - Test cache invalidation (manual clear)
   - Test cache TTL expiration

3. **Error Scenarios**
   - Test API timeout (FMP, EODHD, FRED, BLS)
   - Test model failure (Python subprocess crash)
   - Test Redis failure (cache unavailable)
   - Test partial model failures (4/8 models succeed)
   - Verify graceful degradation (continue without failed models)

4. **Edge Cases**
   - Test illiquid stock (no options data)
   - Test small-cap stock (no analyst coverage, no 13F data)
   - Test meme stock (high social volume)
   - Test earnings date approaching (earnings surprise model active)
   - Test no earnings date (earnings surprise model skipped)

**Example Integration Test:**
```typescript
// app/api/stocks/__tests__/select-ml.integration.test.ts
describe("POST /api/stocks/select (with ML)", () => {
  it("should return ML-enhanced recommendation for AAPL", async () => {
    const response = await request(app)
      .post("/api/stocks/select")
      .send({
        scope: { mode: "SINGLE_STOCK", symbols: ["AAPL"] },
        options: { includeMLPredictions: true }
      })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.mlPrediction).toBeDefined()
    expect(response.body.mlPrediction.modelPredictions.length).toBeGreaterThan(0)
    expect(response.body.executionTime).toBeLessThan(1000) // <1s total
  })

  it("should handle partial model failures gracefully", async () => {
    // Mock Options Flow to fail
    jest.spyOn(optionsFlowService, "predictOptionsFlow").mockRejectedValue(new Error("API timeout"))

    const response = await request(app)
      .post("/api/stocks/select")
      .send({
        scope: { mode: "SINGLE_STOCK", symbols: ["AAPL"] },
        options: { includeMLPredictions: true }
      })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.mlPrediction.metadata.modelsFailed).toBe(1)
    expect(response.body.mlPrediction.metadata.modelsUsed).toBeGreaterThan(0)
  })
})
```

### Performance Testing
**Tool**: Artillery.io (load testing)
**Environment**: Staging (production-like)

**Test Scenarios:**

1. **Latency Benchmarking**
   - Test 100 symbols sequentially
   - Measure per-model latency (cached vs uncached)
   - Measure ensemble aggregation latency
   - Target: <600ms cumulative (all 6 new models)

2. **Cache Hit Rate**
   - Simulate market hours traffic (100 requests/min)
   - Measure cache hit rate over 1 hour
   - Target: >80% cache hit rate

3. **Load Testing**
   - Simulate 1000 concurrent users
   - 100 requests/second for 10 minutes
   - Measure latency percentiles (p50, p95, p99)
   - Measure error rate
   - Target: p95 <1s, error rate <1%

4. **Redis Performance**
   - Measure Redis GET/SET latency
   - Test Redis failover (backup Redis)
   - Test Redis unavailability (fallback to fresh predictions)

**Example Artillery Config:**
```yaml
# scripts/ml/load-test-ml-ensemble.yml
config:
  target: "https://vfr-api.staging.com"
  phases:
    - duration: 600 # 10 minutes
      arrivalRate: 100 # 100 requests/second
  processor: "./load-test-processor.js"

scenarios:
  - name: "ML-Enhanced Stock Selection"
    flow:
      - post:
          url: "/api/stocks/select"
          json:
            scope:
              mode: "SINGLE_STOCK"
              symbols: ["{{ randomSymbol }}"] # Processor generates random symbol
            options:
              includeMLPredictions: true
          capture:
            - json: "$.executionTime"
              as: "latency"
            - json: "$.mlPrediction.metadata.cacheHitRate"
              as: "cacheHitRate"
          expect:
            - statusCode: 200
            - contentType: json
            - hasProperty: "mlPrediction"
      - think: 1 # 1 second between requests
```

### Model Validation Testing
**Tool**: Python (scikit-learn, pandas)
**Environment**: Local (model training)

**Test Scenarios:**

1. **Holdout Set Evaluation**
   - Test on 15% holdout set (never seen during training)
   - Metrics: accuracy, precision, recall, F1, ROC-AUC
   - Confusion matrix
   - Feature importance analysis

2. **Cross-Validation**
   - 5-fold time-series cross-validation
   - Verify model generalizes across time periods
   - Detect overfitting

3. **Backtesting**
   - Test on historical data (2024 YTD)
   - Compare predictions to actual outcomes
   - Calculate Sharpe ratio, win rate, avg gain/loss

**Example Evaluation Script:**
```python
# scripts/ml/evaluate-analyst-sentiment-model.py
import lightgbm as lgb
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Load test set
test_df = pd.read_csv("data/training/analyst-sentiment-test.csv")
X_test = test_df.drop(["label", "symbol", "timestamp"], axis=1)
y_test = test_df["label"]

# Load model
model = lgb.Booster(model_file="models/analyst-sentiment/v1.0.0/model.txt")

# Predict
y_pred = model.predict(X_test)
y_pred_class = y_pred.argmax(axis=1)

# Evaluate
accuracy = accuracy_score(y_test, y_pred_class)
print(f"Test Accuracy: {accuracy:.2%}")
print("\nClassification Report:")
print(classification_report(y_test, y_pred_class, target_names=["DOWN", "NEUTRAL", "UP"]))
print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred_class))

# Feature importance
feature_importance = model.feature_importance(importance_type="gain")
features = X_test.columns
importance_df = pd.DataFrame({
    "feature": features,
    "importance": feature_importance
}).sort_values("importance", ascending=False)
print("\nTop 10 Features:")
print(importance_df.head(10))
```

---

## Deployment Strategy

### A/B Testing Framework

**Objective**: Gradually roll out 6 new ML models with performance monitoring and rollback capability.

**Approach**:
1. Deploy all models with feature toggles DISABLED
2. Enable one model at a time (1 per week)
3. Monitor performance metrics (accuracy, latency, error rate)
4. Rollback if performance degrades
5. After 6 weeks, all models enabled for 100% traffic

**A/B Testing Infrastructure:**

**1. Feature Toggle Management** (`MLFeatureToggleService.ts`)
```typescript
// Add new feature toggles for 6 models
private static readonly FEATURES = {
  // Existing
  EARLY_SIGNAL_DETECTION: { ... },
  PRICE_PREDICTION: { ... },

  // New (Week 1-2)
  ANALYST_SENTIMENT: {
    id: "analyst_sentiment",
    name: "Analyst Sentiment Model",
    description: "ML-powered analyst sentiment change predictions (3-week horizon)",
    defaultState: false, // Start disabled
  },

  // New (Week 3-4)
  OPTIONS_FLOW: {
    id: "options_flow",
    name: "Options Flow Model",
    description: "Unusual options activity detection (1-week horizon)",
    defaultState: false,
  },

  // New (Week 5-6)
  SOCIAL_SENTIMENT: {
    id: "social_sentiment",
    name: "Social Sentiment Acceleration Model",
    description: "Social sentiment momentum detection (1-week horizon)",
    defaultState: false,
  },

  // New (Week 7-8)
  INSTITUTIONAL_FLOW: {
    id: "institutional_flow",
    name: "Institutional Flow Model",
    description: "Smart money tracking (4-week horizon)",
    defaultState: false,
  },

  // New (Week 9-10)
  EARNINGS_SURPRISE: {
    id: "earnings_surprise",
    name: "Earnings Surprise Model",
    description: "Earnings beat/miss predictions (1 quarter ahead)",
    defaultState: false,
  },

  // New (Week 11-12)
  MACRO_REGIME: {
    id: "macro_regime",
    name: "Macro Regime Detection Model",
    description: "Market regime classification (30-day horizon)",
    defaultState: false,
  }
}
```

**2. A/B Testing API Endpoint** (`app/api/stocks/select-ml-ab/route.ts`)
```typescript
// New endpoint for A/B testing
// Randomly assigns traffic: 50% ML-enhanced, 50% pure VFR

export async function POST(request: Request) {
  const { scope, options } = await request.json()

  // Randomly assign A/B bucket
  const bucket = Math.random() < 0.5 ? "ml_enhanced" : "pure_vfr"

  // Track bucket assignment
  await analytics.track({
    event: "ab_test_assignment",
    bucket,
    symbol: scope.symbols[0],
    timestamp: Date.now()
  })

  // Execute request based on bucket
  if (bucket === "ml_enhanced") {
    // Use ML-enhanced path
    const result = await stockSelectionService.selectStocks({
      ...scope,
      options: { ...options, includeMLPredictions: true }
    })
    return Response.json({ ...result, abBucket: bucket })
  } else {
    // Use pure VFR path
    const result = await stockSelectionService.selectStocks({
      ...scope,
      options: { ...options, includeMLPredictions: false }
    })
    return Response.json({ ...result, abBucket: bucket })
  }
}
```

**3. Performance Tracking** (`app/services/ml/analytics/MLPerformanceTracker.ts`)
```typescript
export class MLPerformanceTracker {
  private cache: RedisCache

  /**
   * Track model prediction performance
   */
  async trackPrediction(prediction: ModelPrediction, symbol: string) {
    const key = `ml_performance:${prediction.modelId}:${symbol}:${Date.now()}`
    await this.cache.set(key, JSON.stringify({
      modelId: prediction.modelId,
      symbol,
      prediction: prediction.prediction,
      confidence: prediction.confidence,
      latency: prediction.latency,
      timestamp: prediction.timestamp
    }), 2592000) // 30-day retention
  }

  /**
   * Track actual outcome (7 days later)
   */
  async trackOutcome(symbol: string, actualOutcome: string, timestamp: number) {
    // Match predictions to outcomes
    const predictions = await this.getPredictionsForSymbol(symbol, timestamp - 7 * 24 * 60 * 60 * 1000)

    for (const pred of predictions) {
      const correct = this.isCorrect(pred.prediction, actualOutcome)
      await this.recordAccuracy(pred.modelId, correct)
    }
  }

  /**
   * Get model accuracy statistics
   */
  async getModelStats(modelId: string): Promise<ModelStats> {
    // Calculate accuracy, precision, recall, F1, latency
    // from last 30 days of predictions
  }
}
```

### Rollout Schedule (Post-Implementation)

**Week 13-18**: Gradual model enablement (1 model per week)

| Week | Action | Model Enabled | Target Metrics |
|------|--------|---------------|----------------|
| **13** | Enable Analyst Sentiment | analyst_sentiment | Accuracy >60%, Latency <400ms, Error rate <1% |
| **14** | Enable Options Flow | options_flow | Accuracy >55%, Latency <500ms, Error rate <2% |
| **15** | Enable Social Sentiment | social_sentiment | Accuracy >50%, Latency <600ms, Error rate <3% |
| **16** | Enable Institutional Flow | institutional_flow | Accuracy >65%, Latency <500ms, Error rate <1% |
| **17** | Enable Earnings Surprise | earnings_surprise | Accuracy >60%, Latency <450ms, Error rate <1% |
| **18** | Enable Macro Regime | macro_regime | Accuracy >70%, Latency <600ms, Error rate <1% |

**Monitoring per Week:**
- Daily accuracy tracking (compare predictions to actual outcomes 7 days later)
- Latency monitoring (p50, p95, p99)
- Error rate tracking (% of failed predictions)
- Cache hit rate tracking
- User feedback (optional: survey users on recommendation quality)

**Rollback Criteria** (per model):
- Accuracy drops >10% below target
- Latency increases >50% above target
- Error rate >5%
- User complaints spike (>10% increase)

**Rollback Procedure**:
1. Disable feature toggle via Admin UI
2. Investigate root cause (model drift, API changes, data quality issues)
3. Retrain model if necessary
4. Re-enable after fix validated

### Production Deployment Checklist

**Pre-Deployment:**
- [ ] All 6 models trained and validated (accuracy targets met)
- [ ] All models registered in `models/{model}/v1.0.0/`
- [ ] All feature toggles created in `MLFeatureToggleService.ts` (default: DISABLED)
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing (end-to-end)
- [ ] Performance tests passing (<600ms cumulative latency)
- [ ] A/B testing endpoint deployed (`/api/stocks/select-ml-ab`)
- [ ] Performance tracking deployed (`MLPerformanceTracker.ts`)
- [ ] Admin UI updated (toggle management panel)
- [ ] Documentation updated (`docs/ml/MULTI_MODEL_INTEGRATION_PLAN.md`)

**Deployment Steps:**
1. Deploy code to staging environment
   - Run full test suite
   - Verify all 6 models loadable
   - Verify feature toggles work
2. Load testing on staging (1000 concurrent users)
   - Verify latency <600ms (p95)
   - Verify error rate <1%
   - Verify cache hit rate >80%
3. Deploy to production (blue-green deployment)
   - Deploy new code alongside existing code
   - Route 5% traffic to new code
   - Monitor for 1 hour
   - If stable, route 100% traffic
4. Enable feature toggles (1 per week)
   - Week 1: Enable `analyst_sentiment`
   - Week 2: Enable `options_flow`
   - Week 3: Enable `social_sentiment`
   - Week 4: Enable `institutional_flow`
   - Week 5: Enable `earnings_surprise`
   - Week 6: Enable `macro_regime`
5. Monitor production metrics
   - Daily accuracy tracking
   - Latency monitoring
   - Error rate tracking
   - User feedback

**Post-Deployment:**
- [ ] Monitor for 30 days (accuracy, latency, error rate)
- [ ] Collect user feedback (optional survey)
- [ ] Analyze A/B test results (ML-enhanced vs pure VFR)
- [ ] Optimize model weights based on performance
- [ ] Retrain models if accuracy degrades
- [ ] Update documentation with production insights

---

## Success Metrics

### Model-Level Metrics

**Track per model:**

| Model | Accuracy Target | Latency Target (uncached) | Cache Hit Rate Target | Error Rate Target |
|-------|-----------------|---------------------------|-----------------------|-------------------|
| **Analyst Sentiment** | 60-70% | <400ms | >85% | <1% |
| **Options Flow** | 55-65% | <500ms | >70% | <2% |
| **Social Sentiment** | 50-60% | <600ms | >75% | <3% |
| **Institutional Flow** | 65-75% | <500ms | >90% | <1% |
| **Earnings Surprise** | 60-70% | <450ms | >85% | <1% |
| **Macro Regime** | 70-80% | <600ms | >95% | <1% |

**Measurement:**
- **Accuracy**: % of correct predictions (compare prediction to actual outcome 7 days later)
- **Latency**: p95 latency (95% of requests complete within target)
- **Cache Hit Rate**: % of requests served from cache (during market hours 9:30 AM - 4:00 PM ET)
- **Error Rate**: % of requests that fail (API timeout, model failure, etc.)

### Ensemble-Level Metrics

**Track for EnsembleService:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Consensus Accuracy** | 65-75% | % of correct consensus predictions (7 days later) |
| **Cumulative Latency** | <600ms | p95 latency for all 6 new models (parallel execution) |
| **Model Availability** | >95% | % of requests where at least 4/8 models succeed |
| **Weighted Vote Quality** | >0.70 | Average consensus confidence (0-1 scale) |
| **Cache Hit Rate** | >80% | % of ensemble requests served from cache |

### Business-Level Metrics

**Track for VFR platform:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Recommendation Accuracy** | 60-70% | % of STRONG_BUY/BUY recommendations that outperform market 7 days later |
| **User Satisfaction** | >4.0/5.0 | User survey rating (optional) |
| **API Latency** | <1.5s | p95 latency for full stock selection request (VFR + ML) |
| **Error Rate** | <0.5% | % of API requests that fail completely |
| **Throughput** | >100 req/s | Requests per second (during market hours) |

**ROI Metrics** (optional):
- Cost per prediction (API costs, compute costs)
- Revenue impact (if VFR is paid service)
- User retention (if ML improves recommendations)

### Continuous Monitoring

**Daily Dashboard** (Grafana/DataDog):
- Model accuracy (per model, rolling 7-day window)
- Latency (p50, p95, p99) per model
- Error rate per model
- Cache hit rate per model
- Consensus accuracy (ensemble)
- API throughput (requests/second)
- Cost tracking (API calls, compute)

**Weekly Review**:
- Model performance trends (improving/degrading)
- Feature importance drift (are features still predictive?)
- Data quality issues (API failures, missing data)
- User feedback analysis

**Monthly Review**:
- Retrain decision (accuracy < target)
- Model weight adjustment (optimize ensemble weights)
- Feature engineering improvements (add new features)
- Cost optimization (reduce API calls, optimize caching)

---

## Risk Mitigation

### Technical Risks

**Risk 1: Model Accuracy Below Target**

**Likelihood**: Medium
**Impact**: High (poor recommendations damage user trust)

**Mitigation**:
- **Pre-deployment**: Validate on holdout set (15% test set)
- **Post-deployment**: Daily accuracy tracking (compare predictions to actual outcomes 7 days later)
- **Threshold**: If accuracy drops >10% below target, disable model and retrain
- **Fallback**: Ensemble continues without failed model (graceful degradation)

**Risk 2: API Latency Exceeds Target (<600ms)**

**Likelihood**: Medium
**Impact**: Medium (slow API hurts user experience)

**Mitigation**:
- **Pre-deployment**: Performance testing (Artillery.io load testing)
- **Post-deployment**: Latency monitoring (p95 latency per model)
- **Optimization**:
  - Parallel model execution (Promise.allSettled)
  - Aggressive caching (5-minute TTL, >80% hit rate)
  - Timeout handling (skip models that take >2s)
  - Feature caching (cache common features across models)
- **Threshold**: If p95 latency >600ms, investigate bottleneck and optimize

**Risk 3: API Rate Limits (FMP, EODHD, FRED, BLS)**

**Likelihood**: High
**Impact**: Medium (data unavailable, predictions fail)

**Mitigation**:
- **Rate Limit Management**:
  - FMP: 300 req/min, burst control (50 req/10s)
  - EODHD: Subscription-dependent, monitor usage
  - FRED: 120 req/min, add delays
  - BLS: 500 req/day (unregistered), cache aggressively
- **Caching Strategy**:
  - Cache API responses (not just predictions)
  - Shared cache across models (e.g., FMP analyst data used by 3 models)
  - Longer TTL for infrequent data (13F filings: 1-hour cache)
- **Fallback**: Skip model if API unavailable, continue ensemble

**Risk 4: Python Subprocess Crashes**

**Likelihood**: Low
**Impact**: Medium (all predictions fail)

**Mitigation**:
- **Pre-deployment**: Stress testing (1000 requests/s)
- **Post-deployment**: Process monitoring (restart on crash)
- **Implementation**:
  - Persistent Python subprocess (reuse model in memory)
  - Heartbeat check (ping subprocess every 1 minute)
  - Auto-restart on crash (spawn new subprocess)
  - Timeout handling (kill stuck subprocess after 5 seconds)
- **Threshold**: If subprocess crashes >3 times in 1 hour, disable model and alert

**Risk 5: Redis Cache Unavailable**

**Likelihood**: Low
**Impact**: Medium (higher latency, more API calls)

**Mitigation**:
- **Pre-deployment**: Redis failover testing
- **Post-deployment**: Redis health monitoring
- **Implementation**:
  - Backup Redis instance (automatic failover)
  - In-memory fallback (LRU cache in Node.js)
  - Graceful degradation (compute fresh predictions if cache unavailable)
- **Threshold**: If Redis unavailable >5 minutes, alert and investigate

### Data Quality Risks

**Risk 6: Missing/Stale Data (13F filings, earnings data)**

**Likelihood**: Medium
**Impact**: Medium (predictions less accurate)

**Mitigation**:
- **Pre-checks**:
  - 13F data freshness check (skip if >95 days old)
  - Earnings data check (skip if no earnings date scheduled)
  - Options liquidity check (skip if <100 contracts/day)
- **Fallback**: Skip model if data unavailable, continue ensemble
- **Monitoring**: Track data freshness per model (alert if stale data increasing)

**Risk 7: Model Drift (features become less predictive over time)**

**Likelihood**: High
**Impact**: Medium (accuracy degrades gradually)

**Mitigation**:
- **Pre-deployment**: Temporal cross-validation (test on recent data)
- **Post-deployment**: Monthly accuracy review (compare to baseline)
- **Retraining Schedule**:
  - Quarterly retraining (every 3 months)
  - Ad-hoc retraining if accuracy drops >10%
- **Feature Monitoring**: Track feature importance drift (alert if top features change)

### Operational Risks

**Risk 8: Feature Toggle Misconfiguration**

**Likelihood**: Low
**Impact**: High (accidentally enable/disable models in production)

**Mitigation**:
- **Access Control**: Only admins can toggle features
- **Audit Logging**: Track all toggle changes (who, when, why)
- **Confirmation**: Require confirmation before toggling in production
- **Rollback**: Quick rollback button (disable all ML models instantly)

**Risk 9: Cost Overruns (API costs, compute costs)**

**Likelihood**: Medium
**Impact**: Medium (budget exceeded)

**Mitigation**:
- **Cost Tracking**: Daily API usage monitoring (FMP, EODHD, FRED, BLS)
- **Budget Alerts**: Alert if costs exceed 80% of budget
- **Optimization**:
  - Aggressive caching (reduce API calls)
  - Batch requests (combine multiple symbols)
  - Off-peak processing (generate datasets during weekends)
- **Cost Caps**: Hard limits on API calls (e.g., max 10K FMP calls/day)

**Risk 10: Model Complexity (hard to maintain)**

**Likelihood**: Medium
**Impact**: Medium (slower development, higher bug risk)

**Mitigation**:
- **KISS Principles**: Keep implementations simple
- **Code Reuse**: Shared feature extractors, common patterns
- **Documentation**: Comprehensive docs for each model (this document!)
- **Testing**: >80% code coverage, integration tests
- **Monitoring**: Clear dashboards for each model (accuracy, latency, errors)

---

## Appendix

### File Structure

```
vfr-api/
├── app/
│   ├── services/
│   │   ├── ml/
│   │   │   ├── ensemble/
│   │   │   │   ├── MLEnsembleService.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── __tests__/MLEnsembleService.test.ts
│   │   │   ├── analyst-sentiment/
│   │   │   │   ├── AnalystSentimentService.ts
│   │   │   │   └── __tests__/AnalystSentimentService.test.ts
│   │   │   ├── options-flow/
│   │   │   │   ├── OptionsFlowService.ts
│   │   │   │   └── __tests__/OptionsFlowService.test.ts
│   │   │   ├── social-sentiment/
│   │   │   │   ├── SocialSentimentAccelService.ts
│   │   │   │   └── __tests__/SocialSentimentAccelService.test.ts
│   │   │   ├── institutional-flow/
│   │   │   │   ├── InstitutionalFlowService.ts
│   │   │   │   └── __tests__/InstitutionalFlowService.test.ts
│   │   │   ├── earnings-surprise/
│   │   │   │   ├── EarningsSurpriseService.ts
│   │   │   │   └── __tests__/EarningsSurpriseService.test.ts
│   │   │   ├── macro-regime/
│   │   │   │   ├── MacroRegimeService.ts
│   │   │   │   └── __tests__/MacroRegimeService.test.ts
│   │   │   ├── features/
│   │   │   │   ├── AnalystSentimentFeatureExtractor.ts
│   │   │   │   ├── OptionsFlowFeatureExtractor.ts
│   │   │   │   ├── SocialSentimentFeatureExtractor.ts
│   │   │   │   ├── InstitutionalFlowFeatureExtractor.ts
│   │   │   │   ├── EarningsSurpriseFeatureExtractor.ts
│   │   │   │   ├── MacroRegimeFeatureExtractor.ts
│   │   │   │   └── __tests__/
│   │   │   │       ├── AnalystSentimentFeatureExtractor.test.ts
│   │   │   │       ├── OptionsFlowFeatureExtractor.test.ts
│   │   │   │       ├── SocialSentimentFeatureExtractor.test.ts
│   │   │   │       ├── InstitutionalFlowFeatureExtractor.test.ts
│   │   │   │       ├── EarningsSurpriseFeatureExtractor.test.ts
│   │   │   │       └── MacroRegimeFeatureExtractor.test.ts
│   │   │   ├── analytics/
│   │   │   │   └── MLPerformanceTracker.ts
│   │   │   ├── early-signal/ (existing)
│   │   │   ├── price-prediction/ (existing)
│   │   │   └── admin/ (existing - MLFeatureToggleService.ts)
│   ├── api/
│   │   └── stocks/
│   │       └── select-ml-ab/
│   │           └── route.ts
├── scripts/
│   ├── ml/
│   │   ├── generate-analyst-sentiment-dataset.ts
│   │   ├── split-analyst-sentiment-dataset.py
│   │   ├── train-analyst-sentiment-model.py
│   │   ├── evaluate-analyst-sentiment-model.py
│   │   ├── register-analyst-sentiment-model.ts
│   │   ├── benchmark-analyst-sentiment.ts
│   │   ├── generate-options-flow-dataset.ts
│   │   ├── split-options-flow-dataset.py
│   │   ├── train-options-flow-model.py
│   │   ├── evaluate-options-flow-model.py
│   │   ├── register-options-flow-model.ts
│   │   ├── benchmark-options-flow.ts
│   │   ├── generate-social-sentiment-dataset.ts
│   │   ├── split-social-sentiment-dataset.py
│   │   ├── train-social-sentiment-model.py
│   │   ├── evaluate-social-sentiment-model.py
│   │   ├── register-social-sentiment-model.ts
│   │   ├── benchmark-social-sentiment.ts
│   │   ├── generate-institutional-flow-dataset.ts
│   │   ├── split-institutional-flow-dataset.py
│   │   ├── train-institutional-flow-model.py
│   │   ├── evaluate-institutional-flow-model.py
│   │   ├── register-institutional-flow-model.ts
│   │   ├── benchmark-institutional-flow.ts
│   │   ├── generate-earnings-surprise-dataset.ts
│   │   ├── split-earnings-surprise-dataset.py
│   │   ├── train-earnings-surprise-model.py
│   │   ├── evaluate-earnings-surprise-model.py
│   │   ├── register-earnings-surprise-model.ts
│   │   ├── benchmark-earnings-surprise.ts
│   │   ├── generate-macro-regime-dataset.ts
│   │   ├── split-macro-regime-dataset.py
│   │   ├── train-macro-regime-model.py
│   │   ├── evaluate-macro-regime-model.py
│   │   ├── register-macro-regime-model.ts
│   │   ├── benchmark-macro-regime.ts
│   │   └── load-test-ml-ensemble.yml
├── models/
│   ├── analyst-sentiment/
│   │   └── v1.0.0/
│   │       ├── model.txt
│   │       ├── normalizer.json
│   │       └── metadata.json
│   ├── options-flow/
│   │   └── v1.0.0/
│   │       ├── model.xgb
│   │       ├── normalizer.json
│   │       └── metadata.json
│   ├── social-sentiment/
│   │   └── v1.0.0/
│   │       ├── model.h5
│   │       ├── normalizer.json
│   │       └── metadata.json
│   ├── institutional-flow/
│   │   └── v1.0.0/
│   │       ├── model.pkl
│   │       ├── normalizer.json
│   │       └── metadata.json
│   ├── earnings-surprise/
│   │   └── v1.0.0/
│   │       ├── model.txt
│   │       ├── normalizer.json
│   │       └── metadata.json
│   ├── macro-regime/
│   │   └── v1.0.0/
│   │       ├── model.txt
│   │       ├── normalizer.json
│   │       └── metadata.json
│   ├── early-signal/ (existing)
│   └── price-prediction/ (existing)
├── data/
│   ├── training/
│   │   ├── analyst-sentiment-train.csv
│   │   ├── analyst-sentiment-val.csv
│   │   ├── analyst-sentiment-test.csv
│   │   ├── options-flow-train.csv
│   │   ├── options-flow-val.csv
│   │   ├── options-flow-test.csv
│   │   ├── social-sentiment-train.csv
│   │   ├── social-sentiment-val.csv
│   │   ├── social-sentiment-test.csv
│   │   ├── institutional-flow-train.csv
│   │   ├── institutional-flow-val.csv
│   │   ├── institutional-flow-test.csv
│   │   ├── earnings-surprise-train.csv
│   │   ├── earnings-surprise-val.csv
│   │   ├── earnings-surprise-test.csv
│   │   ├── macro-regime-train.csv
│   │   ├── macro-regime-val.csv
│   │   └── macro-regime-test.csv
└── docs/
    └── ml/
        └── MULTI_MODEL_INTEGRATION_PLAN.md (this document)
```

### Technology Stack

**Backend:**
- **Language**: TypeScript (Node.js)
- **ML Framework**: Python (scikit-learn, LightGBM, XGBoost, Keras/TensorFlow)
- **Cache**: Redis (ioredis client)
- **Database**: PostgreSQL (ml_enhancement_store table)
- **API Framework**: Next.js 14 (App Router, API routes)

**ML Training:**
- **LightGBM**: Tree-based models (Analyst Sentiment, Earnings Surprise, Macro Regime)
- **XGBoost**: Options Flow model (better for noisy data)
- **Random Forest**: Institutional Flow model (robust to missing data)
- **LSTM**: Social Sentiment model (time-series patterns)
- **Feature Engineering**: pandas, numpy, ta-lib (technical indicators)
- **Hyperparameter Tuning**: Optuna
- **Evaluation**: scikit-learn metrics

**Data Sources:**
- **FMP API** (FinancialModelingPrepAPI.ts): Stock data, analyst coverage, earnings, fundamentals
- **EODHD API** (EODHDAPI.ts): Options chains, Greeks, extended market data
- **FRED API** (FREDAPI.ts): Federal Reserve economic data (GDP, inflation, rates)
- **BLS API** (BLSAPI.ts): Bureau of Labor Statistics (employment, CPI)
- **EIA API** (EIAAPI.ts): Energy Information Administration (oil, gas prices)
- **Reddit API**: Social sentiment (via SentimentAnalysisService.ts)
- **InstitutionalDataService.ts**: 13F filings, Form 4 insider trades

**Testing:**
- **Unit Tests**: Jest
- **Integration Tests**: Jest + Supertest
- **Load Testing**: Artillery.io
- **Coverage**: Istanbul (nyc)

**Monitoring:**
- **Metrics**: Grafana/DataDog (TBD)
- **Logging**: Winston/Bunyan (TBD)
- **Alerting**: PagerDuty (TBD)

**Deployment:**
- **Environment**: AWS/Vercel (TBD)
- **CI/CD**: GitHub Actions (TBD)
- **Feature Flags**: MLFeatureToggleService.ts (Redis-backed)

### Reference Documentation

**Existing ML Documentation:**
- `docs/ml/FEATURE_ENHANCEMENT_PLAN.md` - Feature engineering guidelines
- `docs/ml/PRICE_PREDICTION_MODEL_PLAN.md` - Price prediction model design
- `docs/ml/PRICE_PREDICTION_PROGRESS.md` - Price prediction implementation progress
- `docs/ml/SESSION_SUMMARY.md` - Previous ML session summary
- `app/services/ml/CLAUDE.md` - ML services architecture overview
- `app/services/stock-selection/CLAUDE.md` - Stock selection service overview
- `app/services/financial-data/CLAUDE.md` - Data sources overview
- `docs/API_RATE_LIMITS_REFERENCE.md` - API rate limits reference

**Existing Model Implementations:**
- `app/services/ml/early-signal/EarlySignalDetectionService.ts` - Early Signal model (v1.0.0)
- `app/services/ml/price-prediction/PricePredictionService.ts` - Price prediction model (v1.1.0)
- `app/services/ml/features/PricePredictionFeatureExtractor.ts` - Feature extraction example

**Code Quality Rules:**
- `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/code-rules.md` - NO ASSUMPTIONS, KISS principles, no patches

---

## Summary

This plan provides a comprehensive, actionable roadmap for integrating 6 new ML models into the VFR Analysis Engine. Key highlights:

- ✅ **12-week implementation** (Oct 7 - Dec 31, 2025) with 2-week sprints
- ✅ **6 new models**: Analyst Sentiment, Options Flow, Social Sentiment, Institutional Flow, Earnings Surprise, Macro Regime
- ✅ **EnsembleService**: Weighted consensus algorithm for 8 total models (2 existing + 6 new)
- ✅ **Performance targets**: <600ms cumulative latency, >80% cache hit rate
- ✅ **Graceful degradation**: Each model independent, system continues if models fail
- ✅ **A/B testing**: Gradual rollout with performance monitoring
- ✅ **KISS principles**: Simple, modular, maintainable code
- ✅ **Production-ready**: Comprehensive testing, monitoring, rollback capability

This plan is immediately actionable for AI agents to implement. Each model follows the same proven pattern established by Early Signal Detection and Price Prediction models. All integration points are clearly defined with exact file paths, method signatures, and data flows.

**Next Steps:**
1. Review and approve this plan
2. Begin Week 1-2 implementation (EnsembleService + Analyst Sentiment Model)
3. Iterate through 12-week implementation schedule
4. Deploy to production with gradual model enablement (Week 13-18)
5. Monitor and optimize based on production metrics

---

**Document Version**: 1.0
**Last Updated**: 2025-10-05
**Author**: Claude Code (AI Agent)
**Status**: Planning Phase - Awaiting Approval
