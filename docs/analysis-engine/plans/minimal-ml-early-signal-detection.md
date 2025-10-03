# Option A: Minimal Viable ML for VFR Early Signal Detection

**Created**: 2025-10-01 16:35:00
**Status**: Planning Phase
**Approach**: KISS-Focused Single-Model Implementation
**Timeline**: 1-2 weeks implementation
**Code Budget**: <1,000 lines total

---

## Executive Summary

### Problem Statement

VFR's current analysis engine is **highly accurate at capturing current market sentiment** (validated across TSLA, NVDA, QS), but it is fundamentally **reactive rather than predictive**. The system tells investors what the market thinks NOW, not what it will think in 1-2 weeks when analyst upgrades arrive and prices shift.

**Validation Evidence**:

- TSLA: VFR "HOLD" = Market "Hold/Mixed" ✅
- NVDA: VFR "BUY" = Market "Strong Buy" ✅
- QS: VFR "MODERATE_SELL" = Market "Hold but overvalued, 50% above target" ✅

**Business Impact**: Investors acting on VFR recommendations capture current value but miss the **2-week edge window** when early signals predict analyst upgrades before they occur. This is where actionable alpha exists.

### Solution Approach: Single Lightweight Predictive Model

Build ONE focused binary classifier that predicts "analyst upgrade likely" or "analyst downgrade likely" 2 weeks ahead, adding forward-looking capability without replacing VFR's proven reactive analysis.

**Core Philosophy**: KISS (Keep It Simple, Stupid) - reject the 33,000+ line ML infrastructure (Phase 1-3 complete) in favor of a single <1,000 line implementation that delivers immediate value.

**Key Differentiator**: This is NOT a replacement for VFR's 5-factor weighted analysis. It's an **optional enhancement flag** that adds predictive signals while preserving 100% backward compatibility.

### Business Value Proposition

1. **Actionable 2-Week Edge**: Predict analyst rating changes before they occur
2. **First-Mover Advantage**: Position before market consensus shifts
3. **Risk Mitigation**: Early warning of potential downgrades
4. **Confidence-Weighted Signals**: Only surface predictions with >65% confidence
5. **Zero Disruption**: Backward compatible, optional enhancement

### Timeline and Resource Estimate

- **Week 1**: Data collection, feature engineering, model training (3-4 days)
- **Week 2**: API integration, testing, validation (3-4 days)
- **Total**: 1-2 weeks end-to-end implementation
- **Resources**: 1 engineer, existing VFR infrastructure
- **Code Volume**: <1,000 lines (vs 33,000+ in rejected approach)

---

## Technical Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    VFR Analysis Engine (Existing)                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 5-Factor Weighted Analysis (Reactive, Accurate)          │   │
│  │ • Technical 40%  • Fundamental 25%  • Macro 20%          │   │
│  │ • Sentiment 10%  • Alternative 5%                        │   │
│  │ Output: STRONG_BUY ... STRONG_SELL (7-tier)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ NEW: Minimal Early Signal Detector (Predictive)          │   │
│  │ • Single LightGBM binary classifier                      │   │
│  │ • Input: Momentum, volume, sentiment delta, earnings     │   │
│  │ • Output: {upgrade_likely: true, confidence: 0.73}       │   │
│  │ • Latency: <100ms additional overhead                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Enhanced API Response (Backward Compatible)              │   │
│  │ {                                                        │   │
│  │   recommendation: "BUY",                                 │   │
│  │   compositeScore: 72,                                    │   │
│  │   early_signal: {                    ← NEW (optional)    │   │
│  │     upgrade_likely: true,                                │   │
│  │     confidence: 0.73,                                    │   │
│  │     horizon: "2_weeks",                                  │   │
│  │     reasoning: ["Momentum accelerating...", ...]         │   │
│  │   }                                                      │   │
│  │ }                                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Model Architecture

**Algorithm Choice**: LightGBM (Gradient Boosting Decision Trees)

**Rationale**:

- **Lightweight**: <50MB model size, <100ms inference
- **Tabular Data Optimized**: Perfect for financial features (price, volume, sentiment scores)
- **Interpretable**: Feature importance scores explain predictions
- **Production-Ready**: Mature library with TypeScript/Node.js support via `lightgbm3` npm package
- **Minimal Dependencies**: Single library vs TensorFlow's heavyweight stack

**Model Type**: Binary Classifier

**Prediction Target**:

- **Class 0**: No analyst rating change expected in 2 weeks
- **Class 1**: Analyst upgrade expected in 2 weeks (BUY/STRONG_BUY increase)
- **Class 2**: Analyst downgrade expected in 2 weeks (SELL increase) _(optional Phase 2)_

**Model Inputs** (13 features):

1. **Price Momentum** (3 features):
    - 5-day price change %
    - 10-day price change %
    - 20-day price change %

2. **Volume Patterns** (2 features):
    - Volume ratio (current 5d avg / 20d avg)
    - Volume trend (linear regression slope over 10 days)

3. **Sentiment Delta** (3 features):
    - News sentiment rate-of-change (7d delta)
    - Reddit sentiment acceleration (WSB score change)
    - Options sentiment shift (put/call ratio change)

4. **Fundamental Catalysts** (3 features):
    - Earnings surprise (last quarter % beat/miss)
    - Revenue growth acceleration (QoQ change)
    - Analyst coverage change (# analysts tracking, 30d delta)

5. **Technical Indicators** (2 features):
    - RSI momentum (current - 14d average)
    - MACD histogram trend (positive/negative acceleration)

**Model Output**:

```typescript
interface EarlySignalPrediction {
	upgrade_likely: boolean; // True if P(upgrade) > 0.65
	downgrade_likely: boolean; // True if P(downgrade) > 0.65
	confidence: number; // 0.0-1.0 probability score
	horizon: "2_weeks"; // Fixed 14-day prediction window
	reasoning: string[]; // Top 3 feature contributions
	feature_importance: {
		[feature: string]: number; // Normalized 0-1 importance
	};
}
```

### Feature Engineering Pipeline

**Data Sources** (all from existing VFR integrations):

- Historical prices: Financial Modeling Prep API (`FinancialModelingPrepAPI.ts`)
- Sentiment data: `SentimentAnalysisService.ts` (news + Reddit + options)
- Fundamentals: `FinancialDataService.ts` (earnings, revenue, analyst counts)
- Technical indicators: `TechnicalIndicatorService.ts` (RSI, MACD)

**Feature Calculation Example**:

```typescript
interface FeatureVector {
	// Momentum features
	price_change_5d: number; // (price_today - price_5d_ago) / price_5d_ago
	price_change_10d: number;
	price_change_20d: number;

	// Volume features
	volume_ratio: number; // avg_volume_5d / avg_volume_20d
	volume_trend: number; // linear regression slope of volume over 10d

	// Sentiment delta features
	sentiment_news_delta: number; // news_sentiment_today - news_sentiment_7d_ago
	sentiment_reddit_accel: number; // (reddit_today - reddit_7d) - (reddit_7d - reddit_14d)
	sentiment_options_shift: number; // put_call_ratio_change_7d

	// Fundamental features
	earnings_surprise: number; // (actual_eps - consensus_eps) / consensus_eps
	revenue_growth_accel: number; // revenue_growth_this_q - revenue_growth_last_q
	analyst_coverage_change: number; // num_analysts_now - num_analysts_30d_ago

	// Technical features
	rsi_momentum: number; // RSI_now - RSI_14d_avg
	macd_histogram_trend: number; // MACD_histogram slope over 5 days
}
```

**Feature Extraction Function** (simplified):

```typescript
async function extractEarlySignalFeatures(symbol: string): Promise<FeatureVector> {
	// Parallel data collection (leverage existing VFR services)
	const [historicalData, sentimentData, fundamentals, technicals] = await Promise.all([
		financialDataService.getHistoricalOHLC(symbol, 50), // 50 days for 20d momentum
		sentimentService.analyzeStockSentimentImpact(symbol, sector, baseScore),
		financialDataService.getFundamentalRatios(symbol),
		technicalService.calculateAllIndicators({ symbol, ohlcData }),
	]);

	return {
		price_change_5d: calculateMomentum(historicalData, 5),
		price_change_10d: calculateMomentum(historicalData, 10),
		price_change_20d: calculateMomentum(historicalData, 20),
		volume_ratio: calculateVolumeRatio(historicalData, 5, 20),
		volume_trend: calculateVolumeTrend(historicalData, 10),
		sentiment_news_delta: sentimentData.newsDelta,
		sentiment_reddit_accel: sentimentData.redditAccel,
		sentiment_options_shift: sentimentData.optionsShift,
		earnings_surprise: fundamentals.earningsSurprise,
		revenue_growth_accel: fundamentals.revenueGrowthAccel,
		analyst_coverage_change: fundamentals.analystCoverageChange,
		rsi_momentum: technicals.rsiMomentum,
		macd_histogram_trend: technicals.macdHistogramTrend,
	};
}
```

### Training Approach

**Training Data Collection**:

1. **Historical Window**: 3 years of daily data (750 trading days)
2. **Symbol Universe**: 500 most liquid US stocks (S&P 500)
3. **Label Generation Strategy**:

    ```
    For each (symbol, date) pair:
      - Collect analyst ratings at date T (from FMP Analyst Consensus API)
      - Collect analyst ratings at date T+14 (2 weeks later)
      - Label = 1 if rating improved (more BUY, fewer SELL)
      - Label = 0 if rating unchanged or worsened

    Example:
      TSLA on 2024-01-15: 10 BUY, 5 HOLD, 2 SELL → consensus = 0.65
      TSLA on 2024-01-29: 12 BUY, 4 HOLD, 1 SELL → consensus = 0.75
      Label = 1 (upgrade occurred)
    ```

4. **Data Split Strategy** (time-series aware, no data leakage):
    - **Training**: 2022-01-01 to 2024-06-30 (2.5 years, ~625 days)
    - **Validation**: 2024-07-01 to 2024-09-30 (3 months, ~63 days)
    - **Test**: 2024-10-01 to 2024-12-31 (3 months, ~63 days, future data)

5. **Class Balance**:
    - Expect ~10-15% upgrade events (natural imbalance)
    - Use class weights in LightGBM to handle imbalance
    - No synthetic oversampling (preserves temporal patterns)

**Model Training Configuration**:

```typescript
const lightgbmParams = {
	objective: "binary",
	metric: "auc",
	boosting_type: "gbdt",
	num_leaves: 31,
	learning_rate: 0.05,
	feature_fraction: 0.8,
	bagging_fraction: 0.8,
	bagging_freq: 5,
	max_depth: 6,
	min_data_in_leaf: 50,
	is_unbalance: true, // Handle class imbalance
	verbose: 0,
};

const trainingConfig = {
	num_boost_round: 500,
	early_stopping_rounds: 50,
	valid_sets: [validationData],
	valid_names: ["validation"],
	verbose_eval: 50,
};
```

**Validation Strategy** (walk-forward testing):

```
Training Set (2022-2024 Jun)     Validation (Jul-Sep 2024)    Test (Oct-Dec 2024)
    |--------------------------|-----------|-----------|
    Train model here ↑         Tune ↑     Evaluate ↑

Key Principle: NEVER use future data to predict past (temporal integrity)
```

**Performance Metrics**:

- **Primary**: Precision @ 65% confidence threshold (minimize false positives)
- **Secondary**: Recall (capture true upgrades)
- **Tertiary**: AUC-ROC (overall discrimination)
- **Target**: >65% precision, >40% recall at 0.65 threshold

### Inference Integration

**API Endpoint Extension** (`/api/stocks/select`):

**Request Schema** (backward compatible):

```typescript
// Existing request (unchanged)
POST /api/stocks/select
{
  mode: 'single',
  symbols: ['TSLA'],
  include_early_signal: true  // NEW: optional flag (default: false)
}
```

**Response Schema** (extended):

```typescript
{
  success: true,
  data: {
    stocks: [{
      symbol: 'TSLA',
      price: 242.50,
      recommendation: 'BUY',           // Existing VFR 7-tier
      compositeScore: 72,              // Existing VFR 0-100 score

      // NEW: Optional early signal field (only if include_early_signal: true)
      early_signal: {
        upgrade_likely: true,
        confidence: 0.73,
        horizon: '2_weeks',
        reasoning: [
          'Price momentum accelerating (+12% over 10d)',
          'Sentiment delta positive (+0.15 news sentiment)',
          'Analyst coverage increased (+3 analysts tracking)'
        ],
        feature_importance: {
          price_change_10d: 0.28,
          sentiment_news_delta: 0.19,
          analyst_coverage_change: 0.15,
          volume_ratio: 0.12,
          // ... remaining features
        },
        prediction_timestamp: 1696195200000,
        model_version: 'v1.0.0'
      }
    }],
    metadata: {
      mode: 'single',
      count: 1,
      timestamp: 1696195200000,
      early_signal_enabled: true,      // NEW
      early_signal_latency_ms: 87      // NEW
    }
  }
}
```

**Implementation Code** (added to `/api/stocks/select/route.ts`):

```typescript
// Step 4: Optional Early Signal Prediction (if include_early_signal is true)
if (include_early_signal) {
	console.log(`🔮 Step 4: Early signal prediction requested`);
	const signalStartTime = Date.now();

	// Lazy-load early signal service (only when needed)
	const { EarlySignalService } = await import("../../../services/ml/EarlySignalService");
	const earlySignalService = new EarlySignalService();

	// Predict for each stock in parallel
	const signalPromises = enhancedStocks.map(async stock => {
		try {
			const prediction = await earlySignalService.predictAnalystChange(
				stock.symbol,
				stock.sector
			);

			// Only attach if confidence > threshold (default 0.65)
			if (prediction.confidence >= 0.65) {
				stock.early_signal = prediction;
			}
		} catch (error) {
			console.warn(`Early signal prediction failed for ${stock.symbol}:`, error);
			// Graceful degradation - no early_signal field if prediction fails
		}
	});

	await Promise.all(signalPromises);
	const signalLatency = Date.now() - signalStartTime;

	// Add latency to metadata
	response.data.metadata.early_signal_enabled = true;
	response.data.metadata.early_signal_latency_ms = signalLatency;

	console.log(`✅ Early signal predictions completed in ${signalLatency}ms`);
}
```

### Storage Approach

**Model Artifact Storage**:

Option 1: **Local File System** (Recommended for MVP)

```
/Users/michaellocke/WebstormProjects/Home/public/vfr-api/models/
  early-signal/
    v1.0.0/
      model.txt                    # LightGBM model (text format, 5-10MB)
      feature_metadata.json        # Feature names, scaling params
      training_config.json         # Hyperparameters, training date
      performance_metrics.json     # Validation/test performance
```

Option 2: **AWS S3** (Future production)

```
s3://vfr-ml-models/early-signal/v1.0.0/
  model.txt
  feature_metadata.json
  ...
```

**Model Loading Strategy** (singleton pattern):

```typescript
class EarlySignalService {
	private static modelInstance: any = null;
	private static modelVersion: string = "v1.0.0";

	private async loadModel(): Promise<any> {
		if (EarlySignalService.modelInstance) {
			return EarlySignalService.modelInstance; // Cache hit
		}

		const modelPath = path.join(
			__dirname,
			"../../models/early-signal",
			this.modelVersion,
			"model.txt"
		);
		const model = await lgb.loadModel(modelPath);

		EarlySignalService.modelInstance = model; // Cache for future requests
		console.log(`✅ Early signal model v${this.modelVersion} loaded`);

		return model;
	}
}
```

**Prediction Caching Strategy**:

```typescript
// Cache predictions for 5 minutes (analyst ratings don't change intraday)
const cacheKey = `early_signal:${symbol}:${new Date().toISOString().split("T")[0]}`;
const cached = await redisCache.get(cacheKey);

if (cached) {
	return JSON.parse(cached); // Cache hit
}

const prediction = await this.model.predict(features);
await redisCache.set(cacheKey, JSON.stringify(prediction), 300); // 5min TTL

return prediction;
```

---

## Implementation Plan

### Phase 1: Data Collection and Labeling (3-4 days)

**Objective**: Build training dataset with historical analyst rating changes

**Tasks**:

1. **Data Collection Script** (1 day):

    ```typescript
    // Script: scripts/ml/collect-analyst-history.ts

    async function collectAnalystHistory(symbols: string[], startDate: Date, endDate: Date) {
    	const dataset: TrainingExample[] = [];

    	for (const symbol of symbols) {
    		const dailyData = await fetchDailyData(symbol, startDate, endDate);

    		for (let i = 0; i < dailyData.length - 14; i++) {
    			// -14 for 2-week lookahead
    			const currentDate = dailyData[i].date;
    			const futureDate = dailyData[i + 14].date;

    			const currentRatings = await fmpAPI.getAnalystRatings(symbol, currentDate);
    			const futureRatings = await fmpAPI.getAnalystRatings(symbol, futureDate);

    			const label = calculateRatingChange(currentRatings, futureRatings); // 0 or 1
    			const features = await extractEarlySignalFeatures(symbol, currentDate);

    			dataset.push({ symbol, date: currentDate, features, label });
    		}
    	}

    	return dataset;
    }
    ```

2. **Label Generation Logic** (0.5 days):

    ```typescript
    function calculateRatingChange(current: AnalystRatings, future: AnalystRatings): number {
    	// Calculate consensus score (weighted average)
    	const currentConsensus =
    		(current.strongBuy * 1.0 +
    			current.buy * 0.75 +
    			current.hold * 0.5 +
    			current.sell * 0.25 +
    			current.strongSell * 0.0) /
    		current.totalAnalysts;

    	const futureConsensus =
    		(future.strongBuy * 1.0 +
    			future.buy * 0.75 +
    			future.hold * 0.5 +
    			future.sell * 0.25 +
    			future.strongSell * 0.0) /
    		future.totalAnalysts;

    	const change = futureConsensus - currentConsensus;

    	// Label as upgrade if consensus improved by >5% (0.05)
    	return change > 0.05 ? 1 : 0;
    }
    ```

3. **Feature Engineering Implementation** (1-1.5 days):

    ```typescript
    // File: app/services/ml/EarlySignalFeatureExtractor.ts

    export class EarlySignalFeatureExtractor {
    	async extractFeatures(symbol: string, asOfDate?: Date): Promise<FeatureVector> {
    		const date = asOfDate || new Date();

    		// Leverage existing VFR services (no duplication)
    		const [historical, sentiment, fundamentals, technicals] = await Promise.all([
    			this.getHistoricalData(symbol, date, 50),
    			this.getSentimentData(symbol, date),
    			this.getFundamentalsData(symbol, date),
    			this.getTechnicalData(symbol, date),
    		]);

    		return {
    			price_change_5d: this.calculateMomentum(historical, 5),
    			price_change_10d: this.calculateMomentum(historical, 10),
    			price_change_20d: this.calculateMomentum(historical, 20),
    			volume_ratio: this.calculateVolumeRatio(historical, 5, 20),
    			volume_trend: this.calculateVolumeTrend(historical, 10),
    			sentiment_news_delta: this.calculateSentimentDelta(sentiment, "news", 7),
    			sentiment_reddit_accel: this.calculateSentimentAccel(sentiment, "reddit", 7, 14),
    			sentiment_options_shift: this.calculateOptionsShift(sentiment, 7),
    			earnings_surprise: fundamentals.earningsSurprise || 0,
    			revenue_growth_accel: fundamentals.revenueGrowthAccel || 0,
    			analyst_coverage_change: fundamentals.analystCoverageChange || 0,
    			rsi_momentum: technicals.rsiMomentum || 0,
    			macd_histogram_trend: technicals.macdHistogramTrend || 0,
    		};
    	}

    	private calculateMomentum(data: OHLC[], days: number): number {
    		if (data.length < days) return 0;
    		return (data[0].close - data[days].close) / data[days].close;
    	}

    	private calculateVolumeRatio(
    		data: OHLC[],
    		shortWindow: number,
    		longWindow: number
    	): number {
    		if (data.length < longWindow) return 1.0;

    		const avgShort =
    			data.slice(0, shortWindow).reduce((sum, d) => sum + d.volume, 0) / shortWindow;
    		const avgLong =
    			data.slice(0, longWindow).reduce((sum, d) => sum + d.volume, 0) / longWindow;

    		return avgShort / avgLong;
    	}

    	// Additional helper methods...
    }
    ```

4. **Data Persistence** (0.5 days):

    ```sql
    -- Optional: PostgreSQL table for training data (reuse existing schema or CSV)
    CREATE TABLE ml_training_data (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(10) NOT NULL,
      collection_date DATE NOT NULL,
      features JSONB NOT NULL,
      label INTEGER NOT NULL,  -- 0 or 1
      created_at TIMESTAMP DEFAULT NOW()
    )
    CREATE INDEX idx_training_symbol_date ON ml_training_data(symbol, collection_date)
    ```

5. **Validation and Quality Checks** (0.5 days):
    - Verify no data leakage (future data used to predict past)
    - Check feature distributions (no extreme outliers)
    - Validate label balance (expect 10-15% upgrades)
    - Test time-series split integrity

**Deliverables**:

- Training dataset with 500 symbols × 750 days = ~375,000 examples
- Feature extraction pipeline integrated with VFR services
- Data quality validation report

### Phase 2: Feature Engineering (1 day)

**Objective**: Implement robust feature calculation with VFR integration

**Tasks**:

1. **Feature Calculation Functions** (0.5 days):
    - Momentum indicators (price change %, volume ratios)
    - Sentiment deltas (news, Reddit, options)
    - Fundamental catalysts (earnings surprises, revenue growth)
    - Technical indicators (RSI momentum, MACD trends)

2. **VFR Service Integration** (0.25 days):
    - Reuse `TechnicalIndicatorService` for RSI/MACD
    - Reuse `SentimentAnalysisService` for sentiment data
    - Reuse `FinancialDataService` for fundamentals
    - No code duplication - call existing services

3. **Feature Normalization** (0.25 days):

    ```typescript
    class FeatureNormalizer {
    	// Store normalization parameters from training data
    	private featureMeans: Map<string, number> = new Map();
    	private featureStdDevs: Map<string, number> = new Map();

    	fit(trainingData: FeatureVector[]): void {
    		// Calculate mean and std dev for each feature
    		for (const feature of Object.keys(trainingData[0])) {
    			const values = trainingData.map(d => d[feature]);
    			const mean = values.reduce((a, b) => a + b, 0) / values.length;
    			const variance =
    				values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    			const stdDev = Math.sqrt(variance);

    			this.featureMeans.set(feature, mean);
    			this.featureStdDevs.set(feature, stdDev);
    		}
    	}

    	transform(features: FeatureVector): number[] {
    		// Z-score normalization: (x - mean) / std_dev
    		return Object.entries(features).map(([name, value]) => {
    			const mean = this.featureMeans.get(name) || 0;
    			const stdDev = this.featureStdDevs.get(name) || 1;
    			return (value - mean) / stdDev;
    		});
    	}
    }
    ```

**Deliverables**:

- `EarlySignalFeatureExtractor.ts` (200 lines)
- Feature normalization parameters saved with model
- Unit tests for feature calculations

### Phase 3: Model Training and Validation (2-3 days)

**Objective**: Train and validate LightGBM model with proper time-series split

**Tasks**:

1. **LightGBM Integration** (0.5 days):

    ```bash
    npm install lightgbm3 --save
    ```

    ```typescript
    // File: app/services/ml/ModelTrainer.ts

    import lgb from "lightgbm3";

    export class EarlySignalModelTrainer {
    	async trainModel(trainingData: TrainingExample[], validationData: TrainingExample[]) {
    		// Prepare data in LightGBM format
    		const trainFeatures = trainingData.map(d => Object.values(d.features));
    		const trainLabels = trainingData.map(d => d.label);

    		const valFeatures = validationData.map(d => Object.values(d.features));
    		const valLabels = validationData.map(d => d.label);

    		// Train model with early stopping
    		const model = await lgb.train(
    			{
    				objective: "binary",
    				metric: "auc",
    				boosting_type: "gbdt",
    				num_leaves: 31,
    				learning_rate: 0.05,
    				feature_fraction: 0.8,
    				bagging_fraction: 0.8,
    				bagging_freq: 5,
    				max_depth: 6,
    				min_data_in_leaf: 50,
    				is_unbalance: true,
    			},
    			trainFeatures,
    			trainLabels,
    			{
    				num_boost_round: 500,
    				early_stopping_rounds: 50,
    				valid_sets: [valFeatures],
    				valid_labels: [valLabels],
    			}
    		);

    		return model;
    	}
    }
    ```

2. **Hyperparameter Tuning** (1 day):
    - Grid search over learning_rate, num_leaves, max_depth
    - Target: maximize precision at 65% confidence threshold
    - Use validation set for selection (never test set)

3. **Model Evaluation** (0.5 days):

    ```typescript
    class ModelEvaluator {
    	evaluateModel(model: any, testData: TrainingExample[]): PerformanceMetrics {
    		const predictions = testData.map(example => {
    			const features = Object.values(example.features);
    			return model.predict(features)[0]; // Probability of upgrade
    		});

    		const labels = testData.map(d => d.label);

    		return {
    			auc: this.calculateAUC(predictions, labels),
    			precision_at_65: this.calculatePrecision(predictions, labels, 0.65),
    			recall_at_65: this.calculateRecall(predictions, labels, 0.65),
    			f1_at_65: this.calculateF1(predictions, labels, 0.65),
    			confusion_matrix: this.confusionMatrix(predictions, labels, 0.65),
    		};
    	}
    }
    ```

4. **Model Persistence** (0.5 days):

    ```typescript
    async saveModel(model: any, version: string): Promise<void> {
      const modelDir = path.join(__dirname, '../../models/early-signal', version)
      await fs.promises.mkdir(modelDir, { recursive: true })

      // Save model in LightGBM text format
      await model.saveModel(path.join(modelDir, 'model.txt'))

      // Save feature metadata
      const metadata = {
        feature_names: Object.keys(trainingData[0].features),
        normalization_params: this.featureNormalizer.getParams(),
        training_date: new Date().toISOString(),
        num_training_examples: trainingData.length,
        model_version: version
      }
      await fs.promises.writeFile(
        path.join(modelDir, 'feature_metadata.json'),
        JSON.stringify(metadata, null, 2)
      )
    }
    ```

5. **Performance Validation** (0.5 days):
    - Verify >65% precision at 0.65 threshold
    - Check feature importance (top features make sense)
    - Validate no data leakage (test set performance realistic)
    - Generate performance report

**Deliverables**:

- Trained LightGBM model (`model.txt`, 5-10MB)
- Feature metadata and normalization parameters
- Performance metrics report (precision, recall, AUC)
- Feature importance analysis

### Phase 4: API Integration (1-2 days)

**Objective**: Integrate early signal predictions into `/api/stocks/select` endpoint

**Tasks**:

1. **EarlySignalService Implementation** (0.5 days):

    ```typescript
    // File: app/services/ml/EarlySignalService.ts

    export class EarlySignalService {
    	private model: any = null;
    	private featureExtractor: EarlySignalFeatureExtractor;
    	private cache: RedisCache;

    	constructor() {
    		this.featureExtractor = new EarlySignalFeatureExtractor();
    		this.cache = new RedisCache();
    	}

    	async predictAnalystChange(symbol: string, sector: string): Promise<EarlySignalPrediction> {
    		// Check cache first (5min TTL)
    		const cacheKey = `early_signal:${symbol}:${this.getTodayDateKey()}`;
    		const cached = await this.cache.get(cacheKey);
    		if (cached) {
    			return JSON.parse(cached);
    		}

    		// Load model (singleton, cached after first load)
    		if (!this.model) {
    			this.model = await this.loadModel();
    		}

    		// Extract features
    		const features = await this.featureExtractor.extractFeatures(symbol);
    		const normalizedFeatures = this.featureNormalizer.transform(features);

    		// Predict
    		const probability = await this.model.predict([normalizedFeatures])[0];

    		// Generate reasoning
    		const featureImportance = this.model.getFeatureImportance();
    		const reasoning = this.generateReasoning(features, featureImportance);

    		const prediction: EarlySignalPrediction = {
    			upgrade_likely: probability > 0.65,
    			downgrade_likely: false, // Phase 2 feature
    			confidence: probability,
    			horizon: "2_weeks",
    			reasoning,
    			feature_importance: featureImportance,
    			prediction_timestamp: Date.now(),
    			model_version: "v1.0.0",
    		};

    		// Cache for 5 minutes
    		await this.cache.set(cacheKey, JSON.stringify(prediction), 300);

    		return prediction;
    	}

    	private generateReasoning(features: FeatureVector, importance: any): string[] {
    		// Get top 3 features by importance
    		const topFeatures = Object.entries(importance)
    			.sort((a, b) => b[1] - a[1])
    			.slice(0, 3);

    		return topFeatures.map(([feature, imp]) => {
    			const value = features[feature];
    			return this.describeFeature(feature, value, imp);
    		});
    	}

    	private describeFeature(feature: string, value: number, importance: number): string {
    		const descriptions = {
    			price_change_10d: `Price momentum ${value > 0 ? "accelerating" : "decelerating"} (${(value * 100).toFixed(1)}% over 10d)`,
    			sentiment_news_delta: `Sentiment ${value > 0 ? "improving" : "declining"} (${value.toFixed(2)} delta)`,
    			analyst_coverage_change: `Analyst coverage ${value > 0 ? "increased" : "decreased"} (${value} analysts)`,
    			// ... additional descriptions
    		};
    		return descriptions[feature] || `${feature}: ${value.toFixed(2)}`;
    	}
    }
    ```

2. **API Route Extension** (0.5 days):
    - Add `include_early_signal` parameter to request schema
    - Integrate EarlySignalService in parallel with existing analysis
    - Add `early_signal` field to response (optional)
    - Track latency in metadata

3. **Graceful Degradation** (0.25 days):

    ```typescript
    // Fallback behavior if early signal prediction fails
    try {
    	const prediction = await earlySignalService.predictAnalystChange(
    		stock.symbol,
    		stock.sector
    	);
    	if (prediction.confidence >= 0.65) {
    		stock.early_signal = prediction;
    	}
    } catch (error) {
    	console.warn(`Early signal prediction failed for ${stock.symbol}:`, error);
    	// No early_signal field if prediction fails - backward compatible
    }
    ```

4. **Integration Testing** (0.5 days):
    - Test with real stock symbols (TSLA, NVDA, QS)
    - Verify <100ms additional latency
    - Test cache hit/miss scenarios
    - Test graceful degradation (model unavailable)

**Deliverables**:

- `EarlySignalService.ts` (250 lines)
- Updated `/api/stocks/select/route.ts` (+50 lines)
- Integration tests (100 lines)

### Phase 5: Monitoring and Validation (1 day)

**Objective**: Track model performance in production and validate predictions

**Tasks**:

1. **Prediction Logging** (0.25 days):

    ```typescript
    // Log all predictions for accuracy tracking
    interface PredictionLog {
      symbol: string
      prediction_date: Date
      upgrade_likely: boolean
      confidence: number
      actual_outcome?: boolean  // Filled in 2 weeks later
      actual_rating_change?: number
    }

    async logPrediction(prediction: EarlySignalPrediction, symbol: string): Promise<void> {
      await this.db.insert('prediction_logs', {
        symbol,
        prediction_date: new Date(),
        upgrade_likely: prediction.upgrade_likely,
        confidence: prediction.confidence,
        features: prediction.feature_importance
      })
    }
    ```

2. **Accuracy Tracking** (0.25 days):

    ```typescript
    // Script: scripts/ml/validate-predictions.ts

    async function validatePredictions() {
    	// Get predictions from 2 weeks ago
    	const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    	const predictions = await db.query(
    		`
        SELECT * FROM prediction_logs
        WHERE prediction_date = $1 AND actual_outcome IS NULL
      `,
    		[twoWeeksAgo]
    	);

    	for (const pred of predictions) {
    		// Fetch actual analyst ratings change
    		const oldRatings = await fmpAPI.getAnalystRatings(pred.symbol, pred.prediction_date);
    		const newRatings = await fmpAPI.getAnalystRatings(pred.symbol, new Date());

    		const actualUpgrade = calculateRatingChange(oldRatings, newRatings) === 1;

    		// Update prediction log
    		await db.update("prediction_logs", pred.id, {
    			actual_outcome: actualUpgrade,
    			actual_rating_change: calculateConsensusChange(oldRatings, newRatings),
    		});
    	}

    	// Calculate accuracy
    	const accuracy = await db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN upgrade_likely = actual_outcome THEN 1 ELSE 0 END) as correct
        FROM prediction_logs
        WHERE actual_outcome IS NOT NULL
      `);

    	console.log(`Model accuracy: ${((accuracy.correct / accuracy.total) * 100).toFixed(1)}%`);
    }
    ```

3. **Model Drift Detection** (0.25 days):
    - Track rolling 30-day accuracy
    - Alert if accuracy drops below 60% (5% below target)
    - Monitor feature distribution shifts

4. **Performance Dashboard** (0.25 days):
    - Daily prediction volume
    - Accuracy trends (30d/90d rolling)
    - Latency percentiles (p50, p95, p99)
    - Cache hit rate

**Deliverables**:

- Prediction logging infrastructure
- Accuracy validation script (cron job, weekly)
- Model performance dashboard (admin panel)

---

## Data Requirements

### Training Data Sources

**Historical Analyst Ratings**:

- **Source**: Financial Modeling Prep API (`/v3/analyst-consensus/{symbol}`)
- **Coverage**: 3 years (2022-2024), 500 symbols
- **Frequency**: Daily snapshot
- **Cost**: Free tier (250 requests/day) or Premium ($30/month)
- **Data Points**: Strong Buy, Buy, Hold, Sell, Strong Sell counts

**Historical Price Data**:

- **Source**: VFR existing `FinancialDataService` (FMP primary)
- **Coverage**: 3 years, 50 days rolling window per prediction
- **Frequency**: Daily OHLCV
- **Cost**: Included in existing FMP subscription

**Historical Sentiment Data**:

- **Source**: VFR existing `SentimentAnalysisService`
- **Components**: News sentiment (Yahoo Finance), Reddit (WSB), Options (FMP)
- **Coverage**: 3 years (limited availability for historical Reddit)
- **Frequency**: Daily aggregates

**Historical Fundamentals**:

- **Source**: VFR existing `FinancialDataService`
- **Data**: Earnings surprises, revenue growth, analyst coverage
- **Frequency**: Quarterly (with daily updates for analyst coverage)

### Labeling Strategy

**Binary Classification Labels**:

```
Label = 1 (Upgrade):
  - Analyst consensus score increased by >5% over 2 weeks
  - Example: Consensus went from 0.60 (neutral) to 0.68 (buy-leaning)

Label = 0 (No Upgrade):
  - Analyst consensus unchanged or decreased
  - Example: Consensus stayed at 0.60 or dropped to 0.55
```

**Consensus Score Calculation**:

```typescript
function calculateConsensusScore(ratings: AnalystRatings): number {
	return (
		(ratings.strongBuy * 1.0 +
			ratings.buy * 0.75 +
			ratings.hold * 0.5 +
			ratings.sell * 0.25 +
			ratings.strongSell * 0.0) /
		ratings.totalAnalysts
	);
}
```

**Expected Label Distribution**:

- Upgrades (Label = 1): ~10-15% of examples
- No Upgrades (Label = 0): ~85-90% of examples
- **Imbalance Handling**: LightGBM `is_unbalance: true` parameter

### Feature Calculations

**Momentum Features** (3 features):

```typescript
price_change_5d = (price_today - price_5d_ago) / price_5d_ago;
price_change_10d = (price_today - price_10d_ago) / price_10d_ago;
price_change_20d = (price_today - price_20d_ago) / price_20d_ago;
```

**Volume Features** (2 features):

```typescript
volume_ratio = avg_volume_5d / avg_volume_20d;
volume_trend = linear_regression_slope(volumes_10d);
```

**Sentiment Delta Features** (3 features):

```typescript
sentiment_news_delta = news_sentiment_today - news_sentiment_7d_ago;
sentiment_reddit_accel = reddit_today - reddit_7d - (reddit_7d - reddit_14d);
sentiment_options_shift = put_call_ratio_today - put_call_ratio_7d_ago;
```

**Fundamental Features** (3 features):

```typescript
earnings_surprise = (actual_eps - consensus_eps) / consensus_eps;
revenue_growth_accel = revenue_growth_this_q - revenue_growth_last_q;
analyst_coverage_change = num_analysts_now - num_analysts_30d_ago;
```

**Technical Features** (2 features):

```typescript
rsi_momentum = RSI_now - RSI_14d_avg;
macd_histogram_trend = linear_regression_slope(MACD_histogram_5d);
```

### Validation Methodology

**Time-Series Split** (no data leakage):

```
|---- Training: 2022-01-01 to 2024-06-30 (2.5 years) ----|
                                                         |-- Validation: 2024-07-01 to 2024-09-30 (3 months) --|
                                                                                                              |-- Test: 2024-10-01 to 2024-12-31 (3 months) --|
```

**Walk-Forward Validation**:

- Train on historical data
- Validate on recent data (tune hyperparameters)
- Test on future data (never seen during training/tuning)
- Key Principle: **NEVER use future data to predict past**

**Cross-Validation Strategy**:

- **NOT USED**: Standard K-fold would violate temporal integrity
- **INSTEAD**: Single train/val/test split with strict time ordering

**Data Quality Checks**:

1. **Feature Completeness**: Require >90% of features populated (no missing data)
2. **Outlier Detection**: Cap extreme values at 99th percentile
3. **Label Quality**: Verify analyst rating data consistency
4. **Temporal Integrity**: Automated checks for data leakage

---

## Model Specifications

### Algorithm Choice: LightGBM

**Why LightGBM Over Alternatives**:

| Consideration         | LightGBM  | XGBoost   | TensorFlow | Decision    |
| --------------------- | --------- | --------- | ---------- | ----------- |
| **Model Size**        | 5-10MB    | 10-20MB   | 50-200MB   | ✅ LightGBM |
| **Inference Latency** | <100ms    | <150ms    | <500ms     | ✅ LightGBM |
| **Training Speed**    | Fast      | Medium    | Slow       | ✅ LightGBM |
| **Tabular Data**      | Excellent | Excellent | Good       | ✅ LightGBM |
| **Interpretability**  | High      | High      | Low        | ✅ LightGBM |
| **Dependencies**      | Minimal   | Minimal   | Heavy      | ✅ LightGBM |
| **Node.js Support**   | Good      | Limited   | Complex    | ✅ LightGBM |

**LightGBM Algorithm Details**:

- **Algorithm**: Gradient Boosting Decision Trees (GBDT)
- **Boosting Type**: Gradient-based one-side sampling (GOSS)
- **Split Strategy**: Leaf-wise growth (faster than level-wise)
- **Feature Importance**: Gain-based importance scores

### Hyperparameters

**Final Configuration** (after tuning):

```javascript
{
  // Core objective
  objective: 'binary',           // Binary classification (upgrade vs no upgrade)
  metric: 'auc',                 // Optimize for AUC-ROC

  // Boosting parameters
  boosting_type: 'gbdt',         // Gradient Boosting Decision Trees
  num_leaves: 31,                // Max leaves per tree (2^5 - 1)
  learning_rate: 0.05,           // Conservative learning rate

  // Regularization
  feature_fraction: 0.8,         // Use 80% of features per tree (prevent overfitting)
  bagging_fraction: 0.8,         // Use 80% of data per tree
  bagging_freq: 5,               // Resample every 5 iterations
  max_depth: 6,                  // Maximum tree depth
  min_data_in_leaf: 50,          // Minimum examples per leaf (prevent overfitting)

  // Class imbalance handling
  is_unbalance: true,            // Automatically balance class weights

  // Training control
  num_boost_round: 500,          // Max iterations
  early_stopping_rounds: 50,     // Stop if validation AUC doesn't improve for 50 rounds
  verbose: 0                     // Silent mode
}
```

**Hyperparameter Tuning Strategy**:

1. **Grid Search** over:
    - `learning_rate`: [0.01, 0.05, 0.1]
    - `num_leaves`: [15, 31, 63]
    - `max_depth`: [4, 6, 8]

2. **Optimization Metric**: Precision at 0.65 threshold (minimize false positives)

3. **Validation**: Use validation set performance (never test set)

### Training Frequency

**Retraining Schedule**: Weekly (every Monday at 2 AM EST)

**Rationale**:

- Analyst ratings don't change frequently (weekly cadence sufficient)
- 1 week of new data provides ~500 symbols × 5 days = 2,500 new examples
- Balances model freshness with training cost

**Retraining Process**:

```bash
# Cron job: 0 2 * * 1 (every Monday at 2 AM)
cd /Users/michaellocke/WebstormProjects/Home/public/vfr-api
node scripts/ml/retrain-early-signal.js
```

**Incremental Training** (future optimization):

- Add new data to existing training set (rolling 3-year window)
- Retrain from scratch (avoid incremental learning artifacts)
- Validate on recent 3 months before deployment

### Performance Metrics

**Primary Metrics**:

1. **Precision at 65% Threshold**:

    ```
    Precision = True Positives / (True Positives + False Positives)
    Target: >65%

    Interpretation: Of all predictions where confidence > 0.65,
                   >65% should result in actual analyst upgrades
    ```

2. **Recall at 65% Threshold**:

    ```
    Recall = True Positives / (True Positives + False Negatives)
    Target: >40%

    Interpretation: Of all actual upgrades, capture >40% with predictions
    ```

3. **AUC-ROC** (Area Under Curve):

    ```
    AUC = Overall discrimination ability
    Target: >0.72

    Interpretation: Model can distinguish upgrades from non-upgrades 72% of the time
    ```

**Secondary Metrics**:

4. **F1 Score** (harmonic mean of precision and recall):

    ```
    F1 = 2 × (Precision × Recall) / (Precision + Recall)
    Target: >0.50
    ```

5. **False Positive Rate**:
    ```
    FPR = False Positives / (False Positives + True Negatives)
    Target: <0.10 (less than 10% false alarms)
    ```

**Confusion Matrix Example** (at 0.65 threshold):

```
                Predicted Upgrade    Predicted No Upgrade
Actual Upgrade          130 (TP)            70 (FN)
Actual No Upgrade        70 (FP)          1,230 (TN)

Precision = 130 / (130 + 70) = 0.65 (65%) ✅
Recall = 130 / (130 + 70) = 0.65 (65%) ✅
FPR = 70 / (70 + 1,230) = 0.05 (5%) ✅
```

**Performance Monitoring** (production):

- Track rolling 30-day accuracy
- Alert if precision drops below 60% (5% below target)
- Weekly review of false positives (user feedback)

---

## Integration Design

### API Schema Extension

**Request Format** (backward compatible):

```typescript
// Existing request (unchanged)
POST /api/stocks/select
Content-Type: application/json

{
  mode: 'single',
  symbols: ['TSLA'],

  // NEW: Optional early signal flag (default: false)
  include_early_signal: true
}
```

**Response Format** (extended):

```typescript
{
  success: true,
  data: {
    stocks: [{
      // ===== EXISTING VFR FIELDS (unchanged) =====
      symbol: 'TSLA',
      price: 242.50,
      change: 3.45,
      changePercent: 1.44,
      recommendation: 'BUY',           // VFR 7-tier recommendation
      compositeScore: 72,              // VFR 0-100 composite score

      technicalAnalysis: { ... },      // Existing VFR technical analysis
      sentimentAnalysis: { ... },      // Existing VFR sentiment
      macroeconomicAnalysis: { ... },  // Existing VFR macro
      fundamentals: { ... },           // Existing VFR fundamentals
      analystRating: { ... },          // Existing VFR analyst data

      // ===== NEW: EARLY SIGNAL FIELD (optional) =====
      early_signal: {
        // Binary prediction
        upgrade_likely: true,          // True if P(upgrade) > 0.65
        downgrade_likely: false,       // Future: True if P(downgrade) > 0.65

        // Confidence and horizon
        confidence: 0.73,              // 0.0-1.0 probability score
        horizon: '2_weeks',            // Fixed 14-day prediction window

        // Explainability
        reasoning: [
          'Price momentum accelerating (+12% over 10d)',
          'Sentiment delta positive (+0.15 news sentiment)',
          'Analyst coverage increased (+3 analysts tracking)'
        ],

        // Feature importance (for advanced users)
        feature_importance: {
          price_change_10d: 0.28,
          sentiment_news_delta: 0.19,
          analyst_coverage_change: 0.15,
          volume_ratio: 0.12,
          rsi_momentum: 0.09,
          macd_histogram_trend: 0.07,
          earnings_surprise: 0.05,
          sentiment_reddit_accel: 0.03,
          price_change_5d: 0.02,
          price_change_20d: 0.00,
          volume_trend: 0.00,
          revenue_growth_accel: 0.00,
          sentiment_options_shift: 0.00
        },

        // Metadata
        prediction_timestamp: 1696195200000,  // Unix timestamp
        model_version: 'v1.0.0'              // Model version for tracking
      }
    }],

    metadata: {
      mode: 'single',
      count: 1,
      timestamp: 1696195200000,
      sources: ['fmp', 'yahoo', 'reddit'],

      // ===== NEW: EARLY SIGNAL METADATA =====
      early_signal_enabled: true,      // True if include_early_signal: true
      early_signal_latency_ms: 87      // Latency overhead for ML prediction
    }
  }
}
```

**Error Handling** (graceful degradation):

```typescript
// If early signal prediction fails, response omits early_signal field
{
  success: true,
  data: {
    stocks: [{
      symbol: 'TSLA',
      recommendation: 'BUY',
      compositeScore: 72,
      // No early_signal field if prediction failed
    }],
    metadata: {
      early_signal_enabled: false,     // False if prediction failed
      early_signal_error: 'Model unavailable'  // Optional error message
    }
  }
}
```

### Response Format Example

**Real-World Example** (TSLA with early signal):

```json
{
	"success": true,
	"data": {
		"stocks": [
			{
				"symbol": "TSLA",
				"price": 242.5,
				"change": 3.45,
				"changePercent": 1.44,
				"volume": 128450000,

				"recommendation": "BUY",
				"compositeScore": 72,

				"technicalAnalysis": {
					"score": 75,
					"trend": {
						"direction": "bullish",
						"strength": 0.68,
						"confidence": 0.82
					},
					"momentum": {
						"signal": "buy",
						"strength": 0.71
					},
					"summary": "Strong technical outlook. Trend: bullish (68% strength). Momentum: buy."
				},

				"sentimentAnalysis": {
					"score": 65,
					"impact": "positive",
					"confidence": 0.72,
					"newsVolume": 45,
					"adjustedScore": 67,
					"summary": "Positive sentiment with 72% confidence"
				},

				"fundamentals": {
					"peRatio": 68.5,
					"pbRatio": 12.3,
					"debtToEquity": 0.18,
					"currentRatio": 1.52,
					"roe": 0.28
				},

				"analystRating": {
					"totalAnalysts": 42,
					"strongBuy": 12,
					"buy": 18,
					"hold": 10,
					"sell": 2,
					"strongSell": 0,
					"sentimentScore": 0.71
				},

				"early_signal": {
					"upgrade_likely": true,
					"downgrade_likely": false,
					"confidence": 0.73,
					"horizon": "2_weeks",
					"reasoning": [
						"Price momentum accelerating (+12.3% over 10 days)",
						"News sentiment improving (+0.15 delta over 7 days)",
						"Analyst coverage increased (+3 analysts started tracking)"
					],
					"feature_importance": {
						"price_change_10d": 0.28,
						"sentiment_news_delta": 0.19,
						"analyst_coverage_change": 0.15,
						"volume_ratio": 0.12,
						"rsi_momentum": 0.09,
						"macd_histogram_trend": 0.07,
						"earnings_surprise": 0.05,
						"sentiment_reddit_accel": 0.03,
						"price_change_5d": 0.02,
						"price_change_20d": 0.0,
						"volume_trend": 0.0,
						"revenue_growth_accel": 0.0,
						"sentiment_options_shift": 0.0
					},
					"prediction_timestamp": 1696195200000,
					"model_version": "v1.0.0"
				}
			}
		],

		"metadata": {
			"mode": "single",
			"count": 1,
			"timestamp": 1696195200000,
			"sources": ["fmp", "yahoo", "reddit"],
			"technicalAnalysisEnabled": true,
			"fundamentalDataEnabled": true,
			"analystDataEnabled": true,
			"sentimentAnalysisEnabled": true,
			"early_signal_enabled": true,
			"early_signal_latency_ms": 87
		}
	}
}
```

### Caching Strategy

**Cache Key Design**:

```typescript
const cacheKey = `early_signal:${symbol}:${YYYY - MM - DD}`;

// Examples:
// early_signal:TSLA:2024-10-01
// early_signal:NVDA:2024-10-01
```

**Cache TTL**: 5 minutes (300 seconds)

**Rationale**:

- Analyst ratings don't change intraday (predictions stable throughout day)
- 5-minute TTL balances freshness with API load
- Cache resets daily (new date key) to capture overnight news/events

**Cache Implementation**:

```typescript
async predictAnalystChange(symbol: string, sector: string): Promise<EarlySignalPrediction> {
  // Check Redis cache first
  const cacheKey = `early_signal:${symbol}:${this.getTodayDateKey()}`
  const cached = await this.cache.get(cacheKey)

  if (cached) {
    console.log(`✅ Early signal cache hit for ${symbol}`)
    return JSON.parse(cached)
  }

  // Cache miss - run prediction
  console.log(`🔮 Early signal cache miss for ${symbol}, predicting...`)
  const prediction = await this.runPrediction(symbol, sector)

  // Store in cache with 5min TTL
  await this.cache.set(cacheKey, JSON.stringify(prediction), 300)

  return prediction
}

private getTodayDateKey(): string {
  return new Date().toISOString().split('T')[0]  // YYYY-MM-DD
}
```

**Cache Invalidation**:

- **Automatic**: Daily reset via date-based cache key
- **Manual**: Clear cache when model is retrained (new version deployed)
    ```typescript
    // On model deployment
    await redisCache.deleteByPattern("early_signal:*");
    ```

**Cache Performance Expectations**:

- **First Request** (cache miss): ~100ms (model inference + feature extraction)
- **Subsequent Requests** (cache hit): ~5ms (Redis lookup)
- **Expected Hit Rate**: >90% (most users check same stocks multiple times per day)

### Fallback Behavior

**Graceful Degradation Strategy**:

1. **Model Unavailable** (model file missing or corrupted):

    ```typescript
    try {
    	const prediction = await earlySignalService.predictAnalystChange(symbol, sector);
    	stock.early_signal = prediction;
    } catch (error) {
    	console.warn(`Early signal model unavailable for ${symbol}:`, error);
    	// Omit early_signal field - no error to user
    }
    ```

2. **Feature Extraction Fails** (missing data sources):

    ```typescript
    try {
    	const features = await featureExtractor.extractFeatures(symbol);
    } catch (error) {
    	console.warn(`Feature extraction failed for ${symbol}:`, error);
    	// Return null prediction (omit early_signal field)
    	return null;
    }
    ```

3. **Low Confidence Predictions** (confidence < 0.65):

    ```typescript
    const probability = await model.predict(features);

    if (probability < 0.65 && probability > 0.35) {
    	// Neutral prediction - omit early_signal field
    	return null;
    }

    return {
    	upgrade_likely: probability > 0.65,
    	confidence: probability,
    	// ... rest of prediction
    };
    ```

4. **Redis Cache Unavailable** (fallback to in-memory cache):

    ```typescript
    let cached = await this.redisCache.get(cacheKey);

    if (!cached && this.inMemoryCache.has(cacheKey)) {
    	cached = this.inMemoryCache.get(cacheKey);
    	console.log(`✅ Early signal in-memory cache hit for ${symbol}`);
    }
    ```

**User Impact**:

- **Zero Breaking Changes**: If early signal fails, user gets standard VFR response
- **Transparent Errors**: `early_signal_enabled: false` in metadata indicates failure
- **Debugging**: Detailed error logs for developers (not exposed to users)

---

## Success Metrics

### Primary Success Criteria

**1. Prediction Accuracy**:

- **Target**: >65% precision at 0.65 confidence threshold
- **Measurement**: Compare predictions to actual analyst rating changes 2 weeks later
- **Validation**: Weekly automated validation script
- **Threshold**: Alert if accuracy drops below 60% for 2 consecutive weeks

**2. Inference Latency**:

- **Target**: <100ms additional overhead per stock
- **Measurement**: Track `early_signal_latency_ms` in API response metadata
- **Baseline**: VFR current latency ~1.5-2.5s (comprehensive analysis)
- **Threshold**: Alert if p95 latency > 150ms

**3. Model Size**:

- **Target**: <1GB total model artifacts (model.txt + metadata)
- **Current**: LightGBM models typically 5-10MB for 13 features, 500 trees
- **Threshold**: Reject if model > 50MB (too complex, overfitting risk)

### Secondary Success Criteria

**4. User Feedback on Early Signal Value**:

- **Measurement**: Track user engagement with early signal predictions
    - % of API requests with `include_early_signal: true`
    - User surveys on signal usefulness
- **Target**: >30% adoption rate within 3 months
- **Threshold**: <10% adoption = feature not valuable, consider deprecation

**5. False Positive Rate**:

- **Target**: <10% false alarms (predictions that don't materialize)
- **Measurement**: FPR = False Positives / (False Positives + True Negatives)
- **Impact**: High FPR = user trust degradation
- **Threshold**: Alert if FPR > 15% for 2 consecutive weeks

**6. Cache Hit Rate**:

- **Target**: >85% cache hit rate for early signal predictions
- **Measurement**: Track Redis cache hits vs misses
- **Impact**: High cache hit rate = lower latency, reduced compute cost
- **Threshold**: Alert if cache hit rate < 70% (investigate cache TTL)

### Business Success Metrics

**7. Actionable Alpha Capture**:

- **Measurement**: Track user portfolios where early signal predictions preceded actual upgrades
- **Target**: Users acting on high-confidence signals (>0.75) capture 2-week edge >50% of the time
- **Validation**: Retrospective analysis of user trades vs predictions

**8. Production Reliability**:

- **Target**: >99% uptime for early signal predictions
- **Measurement**: Track prediction failures, model unavailability
- **Impact**: Low reliability = user trust issues
- **Threshold**: Alert if availability < 95% for 24 hours

**9. Zero Production Incidents**:

- **Target**: No early signal-related outages or VFR API degradation
- **Measurement**: Track errors, timeouts, cascade failures
- **Impact**: Any production incident = rollback early signal feature
- **Threshold**: Zero tolerance for user-facing errors

### Monitoring Dashboard

**Real-Time Metrics** (admin panel):

```typescript
interface EarlySignalMetrics {
	// Performance
	latency_p50_ms: number; // Median latency
	latency_p95_ms: number; // 95th percentile latency
	latency_p99_ms: number; // 99th percentile latency

	// Accuracy (updated weekly)
	precision_30d: number; // Rolling 30-day precision
	recall_30d: number; // Rolling 30-day recall
	auc_30d: number; // Rolling 30-day AUC

	// Usage
	requests_today: number; // Daily prediction volume
	cache_hit_rate: number; // Cache efficiency
	adoption_rate: number; // % of API calls with early_signal

	// Reliability
	uptime_24h: number; // 24-hour availability %
	error_rate_24h: number; // Error rate
	model_version: string; // Current model version
	last_retrain_date: Date; // Last training date
}
```

**Alert Thresholds**:

```yaml
alerts:
    - name: "Low Accuracy"
      condition: precision_30d < 0.60
      action: Email engineering team, review model performance

    - name: "High Latency"
      condition: latency_p95_ms > 150
      action: Investigate feature extraction performance

    - name: "Low Uptime"
      condition: uptime_24h < 0.95
      action: Page on-call engineer, investigate model availability

    - name: "High False Positives"
      condition: false_positive_rate > 0.15
      action: Review model calibration, consider retraining
```

---

## Risk Mitigation

### Overfitting Prevention

**Risk**: Model learns noise in training data rather than true patterns

**Mitigation Strategies**:

1. **Time-Series Validation** (no data leakage):
    - Strict temporal split: Train on past, validate on future
    - NEVER use future data to predict past
    - Automated checks for data leakage in training pipeline

2. **Simple Feature Set** (13 features only):
    - Avoid feature engineering complexity (no polynomial features, no interactions)
    - Limit to interpretable, business-logical features
    - Reject features with low predictive power in validation

3. **Regularization in LightGBM**:

    ```javascript
    {
      feature_fraction: 0.8,        // Use only 80% of features per tree
      bagging_fraction: 0.8,        // Use only 80% of data per tree
      max_depth: 6,                 // Limit tree depth
      min_data_in_leaf: 50,         // Require minimum examples per leaf
      early_stopping_rounds: 50     // Stop if validation performance plateaus
    }
    ```

4. **Monitoring Feature Importance**:
    - Track feature importance over time
    - Alert if importance distribution shifts dramatically (drift)
    - Reject features that contribute <1% importance

5. **Walk-Forward Validation**:
    - Retrain weekly and validate on most recent data
    - Compare new model performance to production model
    - Only deploy if validation accuracy > production accuracy

**Validation Checklist**:

- [ ] Training accuracy - Validation accuracy < 10% (no overfitting gap)
- [ ] Feature importance stable across training runs
- [ ] No single feature dominates (max importance < 40%)
- [ ] Test set performance within 5% of validation performance

### Model Drift Detection

**Risk**: Market regime changes make model predictions less accurate over time

**Mitigation Strategies**:

1. **Rolling Accuracy Tracking**:

    ```typescript
    // Weekly validation script
    async function detectModelDrift() {
    	const accuracy_30d = await calculateAccuracy(30); // Last 30 days
    	const accuracy_90d = await calculateAccuracy(90); // Last 90 days

    	if (accuracy_30d < accuracy_90d - 0.1) {
    		alert("Model drift detected: 30d accuracy dropped >10% vs 90d baseline");
    		triggerRetraining();
    	}
    }
    ```

2. **Feature Distribution Monitoring**:
    - Track feature distributions weekly (mean, std dev, min, max)
    - Alert if distribution shifts by >2 standard deviations
    - Example: If `price_change_10d` mean shifts from 0.02 to 0.15 (market regime change)

3. **Prediction Calibration Checks**:

    ```typescript
    // Are confidence scores well-calibrated?
    async function validateCalibration() {
    	// For predictions with confidence 0.70, do ~70% actually upgrade?
    	const bins = [0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];

    	for (const bin of bins) {
    		const predictions = await db.query(
    			`
          SELECT * FROM prediction_logs
          WHERE confidence >= $1 AND confidence < $2
        `,
    			[bin, bin + 0.05]
    		);

    		const actualRate =
    			predictions.filter(p => p.actual_outcome).length / predictions.length;

    		if (Math.abs(actualRate - bin) > 0.15) {
    			alert(`Calibration drift in bin ${bin}: predicted ${bin}, actual ${actualRate}`);
    		}
    	}
    }
    ```

4. **Automated Retraining Triggers**:
    - Weekly retraining by default
    - Emergency retraining if accuracy drops below 60%
    - Model version rollback if new model underperforms

**Drift Detection Dashboard**:

```typescript
interface DriftMetrics {
	accuracy_30d: number; // Rolling 30-day accuracy
	accuracy_90d: number; // Rolling 90-day accuracy
	accuracy_delta: number; // Drift magnitude (30d - 90d)

	feature_distributions: {
		[feature: string]: {
			mean: number;
			std_dev: number;
			drift_z_score: number; // # of std devs shifted
		};
	};

	calibration_error: number; // Mean absolute calibration error
	last_retrain_date: Date;
	model_version: string;
}
```

### Rollback Plan

**Risk**: New model version degrades performance or causes production issues

**Rollback Strategy**:

1. **Model Versioning**:

    ```
    /models/early-signal/
      v1.0.0/                        # Production model
        model.txt
        feature_metadata.json
      v1.1.0/                        # Candidate model (being validated)
        model.txt
        feature_metadata.json
    ```

2. **Canary Deployment**:

    ```typescript
    // Route 10% of traffic to new model, 90% to production model
    const modelVersion = Math.random() < 0.1 ? "v1.1.0" : "v1.0.0";
    const model = await this.loadModel(modelVersion);
    ```

3. **Automated Rollback Triggers**:

    ```typescript
    async function monitorCanaryDeployment() {
    	const v1_0_0_accuracy = await getAccuracy("v1.0.0", "24h");
    	const v1_1_0_accuracy = await getAccuracy("v1.1.0", "24h");

    	if (v1_1_0_accuracy < v1_0_0_accuracy - 0.05) {
    		// New model is >5% worse - rollback
    		await rollbackToVersion("v1.0.0");
    		alert("Model v1.1.0 rolled back due to performance degradation");
    	} else if (v1_1_0_accuracy >= v1_0_0_accuracy) {
    		// New model is better or equal - full deployment
    		await promoteToProduction("v1.1.0");
    		alert("Model v1.1.0 promoted to production");
    	}
    }
    ```

4. **Manual Rollback Procedure**:

    ```bash
    # Emergency rollback to v1.0.0
    cd /Users/michaellocke/WebstormProjects/Home/public/vfr-api/models/early-signal

    # Update symlink to production model
    rm current
    ln -s v1.0.0 current

    # Clear cache to force model reload
    redis-cli DEL early_signal:*

    # Restart API server
    npm run dev:clean
    ```

5. **Rollback Validation**:
    - Verify prediction latency returns to baseline (<100ms)
    - Verify prediction accuracy returns to production baseline
    - Verify no user-facing errors or API degradation

**Rollback Decision Matrix**:
| Condition | Action | Timeline |
|-----------|--------|----------|
| Accuracy drops >10% | Immediate rollback | <5 minutes |
| Latency increases >50% | Immediate rollback | <5 minutes |
| Production errors >1% | Immediate rollback + disable feature flag | <5 minutes |
| Accuracy drops 5-10% | Monitor for 24h, rollback if persists | <24 hours |
| User feedback negative | Review and consider rollback | <1 week |

### Explainability and Debugging

**Risk**: Users don't understand why predictions are made (black box problem)

**Mitigation Strategies**:

1. **Feature Importance Transparency**:

    ```typescript
    // Return top 3 features in reasoning
    reasoning: [
    	"Price momentum accelerating (+12.3% over 10 days)", // Top feature
    	"News sentiment improving (+0.15 delta over 7 days)", // 2nd feature
    	"Analyst coverage increased (+3 analysts started tracking)", // 3rd feature
    ];
    ```

2. **Natural Language Explanations**:

    ```typescript
    private describeFeature(feature: string, value: number, importance: number): string {
      const templates = {
        'price_change_10d': (v) => `Price momentum ${v > 0 ? 'accelerating' : 'decelerating'} (${(v * 100).toFixed(1)}% over 10d)`,
        'sentiment_news_delta': (v) => `Sentiment ${v > 0 ? 'improving' : 'declining'} (${v.toFixed(2)} delta)`,
        'analyst_coverage_change': (v) => `Analyst coverage ${v > 0 ? 'increased' : 'decreased'} (${v} analysts)`,
        // ... more templates
      }
      return templates[feature](value)
    }
    ```

3. **Feature Importance Visualization** (future enhancement):
    - Return full feature importance map in API response
    - Frontend can render bar chart of feature contributions
    - Users can understand which factors drove prediction

4. **Debugging Tools**:

    ```typescript
    // Admin endpoint for debugging predictions
    GET /api/admin/early-signal/debug?symbol=TSLA

    Response:
    {
      symbol: 'TSLA',
      prediction: {
        upgrade_likely: true,
        confidence: 0.73
      },
      feature_values: {
        price_change_10d: 0.123,
        sentiment_news_delta: 0.15,
        // ... all 13 features
      },
      feature_importance: {
        price_change_10d: 0.28,
        sentiment_news_delta: 0.19,
        // ... all 13 features
      },
      model_version: 'v1.0.0',
      cache_hit: false,
      latency_ms: 87
    }
    ```

5. **Prediction Logging for Retrospective Analysis**:
    - Log all predictions with features + outcome
    - Analyze false positives to identify systematic errors
    - Refine features or retrain model based on insights

**Explainability Checklist**:

- [ ] Top 3 features always returned in reasoning
- [ ] Feature importance values normalized to 0-1 scale
- [ ] Natural language explanations understandable to non-technical users
- [ ] Admin debugging tools available for engineering team

---

## Comparison to Rejected Approach

### Complexity Comparison

| Dimension                   | **Option A: Minimal ML**      | **Rejected: Full ML Infrastructure (Phase 1-3)**   | Advantage             |
| --------------------------- | ----------------------------- | -------------------------------------------------- | --------------------- |
| **Total Code Lines**        | <1,000 lines                  | 33,000+ lines (31,111 implementation + tests)      | ✅ **97% reduction**  |
| **Number of Files**         | 5 files                       | 31 files (services + tests)                        | ✅ **84% reduction**  |
| **Database Tables**         | 1 table (optional)            | 8 PostgreSQL tables with 32 indexes                | ✅ **87% reduction**  |
| **ML Libraries**            | 1 (LightGBM)                  | 3+ (LightGBM, XGBoost, TensorFlow.js)              | ✅ **67% reduction**  |
| **Services Created**        | 2 (FeatureExtractor, Service) | 15+ services (Registry, Store, Orchestrator, etc.) | ✅ **87% reduction**  |
| **API Endpoints**           | 0 new endpoints               | 8+ new ML endpoints                                | ✅ **100% reduction** |
| **Redis Cache Extensions**  | Reuse existing                | Custom compression + batch ops                     | ✅ Simpler            |
| **Infrastructure Overhead** | Minimal (single model file)   | Model versioning, S3 storage, batch inference      | ✅ Minimal            |

### Timeline Comparison

| Phase                            | **Option A: Minimal ML** | **Rejected: Full ML Infrastructure**             | Time Saved     |
| -------------------------------- | ------------------------ | ------------------------------------------------ | -------------- |
| **Phase 1: Data Collection**     | 3-4 days                 | 2 weeks (8 tables, complex schema)               | **60% faster** |
| **Phase 2: Feature Engineering** | 1 day                    | 3 weeks (3 extractors, integrator, store)        | **95% faster** |
| **Phase 3: Model Training**      | 2-3 days                 | 4 weeks (multi-algorithm support, orchestration) | **85% faster** |
| **Phase 4: Integration**         | 1-2 days                 | 3 weeks (enhanced service, scoring engine)       | **90% faster** |
| **Phase 5: Production**          | 1 day                    | 4 weeks (backtesting, monitoring, validation)    | **95% faster** |
| **Total Timeline**               | **1-2 weeks**            | **16+ weeks**                                    | **87% faster** |

### Risk Comparison

| Risk Factor              | **Option A: Minimal ML**                                | **Rejected: Full ML Infrastructure**                  | Risk Level   |
| ------------------------ | ------------------------------------------------------- | ----------------------------------------------------- | ------------ |
| **Overfitting**          | Low (13 features, simple model, time-series validation) | High (complex features, multi-model ensemble)         | ✅ **Lower** |
| **Maintenance Burden**   | Low (1 model, weekly retrain)                           | High (15+ services, complex orchestration)            | ✅ **Lower** |
| **Production Incidents** | Low (single point of failure, graceful degradation)     | High (complex dependencies, cascade failures)         | ✅ **Lower** |
| **Technical Debt**       | Low (<1,000 lines, KISS principles)                     | High (33,000+ lines, abstraction layers)              | ✅ **Lower** |
| **Data Leakage**         | Low (strict time-series split, automated checks)        | Medium (complex feature pipelines, manual validation) | ✅ **Lower** |
| **Model Drift**          | Low (simple features, weekly monitoring)                | Medium (complex features, drift harder to detect)     | ✅ **Lower** |
| **Breaking Changes**     | Zero (optional flag, backward compatible)               | Medium (new scoring engine, integration complexity)   | ✅ **Lower** |

### Value Delivery Comparison

| Business Value     | **Option A: Minimal ML**                | **Rejected: Full ML Infrastructure**          | Winner                    |
| ------------------ | --------------------------------------- | --------------------------------------------- | ------------------------- |
| **Time to Market** | 1-2 weeks                               | 16+ weeks                                     | ✅ **Option A**           |
| **Focus**          | Single use case (analyst upgrades)      | Multiple use cases (price, volatility, risk)  | ✅ **Option A** (focused) |
| **Actionability**  | High (2-week edge, >65% precision)      | Medium (multiple predictions, unclear value)  | ✅ **Option A**           |
| **Complexity**     | Low (engineers can understand in 1 day) | High (weeks to onboard, complex abstractions) | ✅ **Option A**           |
| **ROI**            | High (immediate value, low cost)        | Low (high upfront cost, uncertain value)      | ✅ **Option A**           |
| **User Trust**     | High (explainable, simple)              | Medium (black box, complex)                   | ✅ **Option A**           |

### Code Complexity Example

**Option A: Minimal ML** (EarlySignalService.ts - ~250 lines):

```typescript
export class EarlySignalService {
	private model: any = null;
	private featureExtractor: EarlySignalFeatureExtractor;
	private cache: RedisCache;

	async predictAnalystChange(symbol: string, sector: string): Promise<EarlySignalPrediction> {
		// 1. Check cache
		const cached = await this.cache.get(`early_signal:${symbol}:${this.getTodayDateKey()}`);
		if (cached) return JSON.parse(cached);

		// 2. Load model (singleton)
		if (!this.model) this.model = await this.loadModel();

		// 3. Extract features
		const features = await this.featureExtractor.extractFeatures(symbol);

		// 4. Predict
		const probability = await this.model.predict([Object.values(features)])[0];

		// 5. Generate reasoning
		const reasoning = this.generateReasoning(features, this.model.getFeatureImportance());

		// 6. Return prediction
		const prediction = {
			upgrade_likely: probability > 0.65,
			confidence: probability,
			horizon: "2_weeks",
			reasoning,
			// ... metadata
		};

		await this.cache.set(
			`early_signal:${symbol}:${this.getTodayDateKey()}`,
			JSON.stringify(prediction),
			300
		);
		return prediction;
	}
}
```

**Rejected: Full ML Infrastructure** (requires 15+ services):

```typescript
// ModelRegistry.ts (1,249 lines)
// ModelValidator.ts (992 lines)
// ModelCache.ts (692 lines)
// ModelTrainer.ts (755 lines)
// TrainingOrchestrator.ts (678 lines)
// ModelEvaluator.ts (688 lines)
// RealTimePredictionEngine.ts (591 lines)
// InferenceOptimizer.ts (418 lines)
// InferenceWorkerPool.ts (413 lines)
// MLEnhancementOrchestrator.ts (654 lines)
// MLEnhancementStore.ts (563 lines)
// FeatureStore.ts (584 lines)
// TechnicalFeatureExtractor.ts (1,075 lines)
// FundamentalFeatureExtractor.ts (677 lines)
// SentimentFeatureExtractor.ts (840 lines)
// ... and more

// Total: 31,111 lines across 31 files (excluding tests)
```

### Decision Matrix Summary

| Criteria                | Weight | Option A Score     | Rejected Score     | Weighted Score   |
| ----------------------- | ------ | ------------------ | ------------------ | ---------------- |
| **Time to Market**      | 30%    | 95/100 (1-2 weeks) | 20/100 (16 weeks)  | **28.5 vs 6.0**  |
| **Implementation Risk** | 25%    | 90/100 (low risk)  | 40/100 (high risk) | **22.5 vs 10.0** |
| **Maintenance Cost**    | 20%    | 95/100 (<1K lines) | 30/100 (33K lines) | **19.0 vs 6.0**  |
| **Business Value**      | 15%    | 80/100 (focused)   | 60/100 (diffuse)   | **12.0 vs 9.0**  |
| **Technical Debt**      | 10%    | 90/100 (KISS)      | 40/100 (complex)   | **9.0 vs 4.0**   |
| **TOTAL**               | 100%   | -                  | -                  | **91.0 vs 35.0** |

**Conclusion**: Option A delivers 2.6x more value with 87% less complexity and 87% faster timeline.

---

## Implementation Checklist

### Pre-Implementation Prerequisites

**Environment Setup**:

- [ ] Node.js 18+ installed and verified (`node --version`)
- [ ] PostgreSQL database accessible (optional, can use CSV for training data)
- [ ] Redis cache server running (`redis-cli PING`)
- [ ] Financial Modeling Prep API key active (verify rate limits)
- [ ] VFR API server running locally (`npm run dev`)

**Dependencies Installation**:

```bash
# Install LightGBM library
npm install lightgbm3 --save

# Verify installation
node -e "const lgb = require('lightgbm3'); console.log('LightGBM installed:', lgb)"
```

**Directory Structure**:

```bash
# Create model storage directory
mkdir -p /Users/michaellocke/WebstormProjects/Home/public/vfr-api/models/early-signal/v1.0.0

# Create training scripts directory
mkdir -p /Users/michaellocke/WebstormProjects/Home/public/vfr-api/scripts/ml
```

### Phase 1: Data Collection (3-4 days)

**Day 1-2: Historical Data Collection**

- [ ] Create `scripts/ml/collect-analyst-history.ts` script (2 hours)
- [ ] Implement `calculateRatingChange()` labeling logic (1 hour)
- [ ] Collect 3 years of analyst ratings for 500 symbols (4-6 hours)
    - Batch API calls (50 symbols per hour to respect rate limits)
    - Store in CSV or PostgreSQL table
- [ ] Validate data completeness (no missing dates, symbols) (1 hour)

**Day 2-3: Feature Engineering**

- [ ] Create `app/services/ml/EarlySignalFeatureExtractor.ts` (3 hours)
- [ ] Implement momentum calculations (`calculateMomentum`, `calculateVolumeRatio`) (1 hour)
- [ ] Implement sentiment delta calculations (integrate with `SentimentAnalysisService`) (2 hours)
- [ ] Implement fundamental feature extraction (earnings, revenue, analyst coverage) (2 hours)
- [ ] Implement technical feature extraction (RSI, MACD from `TechnicalIndicatorService`) (1 hour)
- [ ] Unit test feature calculations (verify correct 5d, 10d, 20d windows) (2 hours)

**Day 3-4: Data Preparation**

- [ ] Generate training dataset (500 symbols × 750 days = ~375K examples) (2-3 hours)
- [ ] Implement time-series split (train/val/test) (1 hour)
- [ ] Validate no data leakage (automated check for future data in training set) (1 hour)
- [ ] Calculate feature statistics (mean, std dev for normalization) (1 hour)
- [ ] Save training data to disk (`data/training/early-signal-v1.csv`) (0.5 hours)

**Deliverables**:

- [ ] Training dataset CSV/database with 375K examples
- [ ] Feature extraction pipeline integrated with VFR services
- [ ] Data quality validation report (label balance, feature distributions)

### Phase 2: Model Training (2-3 days)

**Day 1: LightGBM Integration**

- [ ] Create `app/services/ml/ModelTrainer.ts` (2 hours)
- [ ] Implement data loading and preprocessing (1 hour)
- [ ] Implement LightGBM training pipeline (2 hours)
- [ ] Configure hyperparameters (initial configuration) (0.5 hours)
- [ ] Test training on small dataset (100 examples) to verify setup (0.5 hours)

**Day 1-2: Hyperparameter Tuning**

- [ ] Implement grid search over `learning_rate`, `num_leaves`, `max_depth` (2 hours)
- [ ] Train models with different hyperparameter combinations (4-6 hours, can run overnight)
- [ ] Evaluate on validation set (precision, recall, AUC) (1 hour)
- [ ] Select best model based on precision at 0.65 threshold (0.5 hours)

**Day 2-3: Model Evaluation**

- [ ] Create `scripts/ml/evaluate-model.ts` (1 hour)
- [ ] Evaluate on test set (never seen during training/tuning) (0.5 hours)
- [ ] Generate performance report (precision, recall, AUC, confusion matrix) (1 hour)
- [ ] Analyze feature importance (verify top features make sense) (1 hour)
- [ ] Validate calibration (do 70% confidence predictions actually upgrade 70% of the time?) (1 hour)

**Day 3: Model Persistence**

- [ ] Save model to disk (`models/early-signal/v1.0.0/model.txt`) (0.5 hours)
- [ ] Save feature metadata and normalization parameters (0.5 hours)
- [ ] Save training configuration and performance metrics (0.5 hours)
- [ ] Test model loading and inference (verify saved model works) (0.5 hours)

**Deliverables**:

- [ ] Trained LightGBM model (model.txt, 5-10MB)
- [ ] Performance report (>65% precision, >40% recall, >0.72 AUC)
- [ ] Feature importance analysis
- [ ] Model artifacts saved to disk

### Phase 3: API Integration (1-2 days)

**Day 1: Service Implementation**

- [ ] Create `app/services/ml/EarlySignalService.ts` (3 hours)
- [ ] Implement model loading (singleton pattern) (1 hour)
- [ ] Implement prediction pipeline (feature extraction → normalization → inference) (2 hours)
- [ ] Implement reasoning generation (top 3 features) (1 hour)
- [ ] Implement caching (Redis with 5min TTL) (1 hour)

**Day 1-2: API Route Extension**

- [ ] Add `include_early_signal` parameter to `/api/stocks/select` request schema (0.5 hours)
- [ ] Integrate `EarlySignalService` in route handler (parallel execution) (1 hour)
- [ ] Add `early_signal` field to response schema (optional) (0.5 hours)
- [ ] Implement graceful degradation (no errors if prediction fails) (1 hour)
- [ ] Track latency in metadata (`early_signal_latency_ms`) (0.5 hours)

**Day 2: Testing**

- [ ] Create `app/services/ml/__tests__/EarlySignalService.test.ts` (2 hours)
- [ ] Test prediction pipeline with real stock data (TSLA, NVDA, QS) (1 hour)
- [ ] Test cache hit/miss scenarios (1 hour)
- [ ] Test graceful degradation (model unavailable, feature extraction fails) (1 hour)
- [ ] Test latency (<100ms target) (0.5 hours)
- [ ] Integration test with full `/api/stocks/select` endpoint (1 hour)

**Deliverables**:

- [ ] `EarlySignalService.ts` (250 lines)
- [ ] Updated `/api/stocks/select/route.ts` (+50 lines)
- [ ] Integration tests passing
- [ ] Latency benchmark (<100ms)

### Phase 4: Monitoring and Validation (1 day)

**Day 1: Prediction Logging**

- [ ] Create `prediction_logs` table (PostgreSQL) (0.5 hours)
- [ ] Implement prediction logging in `EarlySignalService` (1 hour)
- [ ] Create `scripts/ml/validate-predictions.ts` script (2 hours)
- [ ] Test validation script on historical predictions (1 hour)

**Day 1: Monitoring Dashboard**

- [ ] Add early signal metrics to admin panel (1 hour)
- [ ] Implement accuracy tracking (rolling 30d/90d) (1 hour)
- [ ] Implement latency tracking (p50/p95/p99) (0.5 hours)
- [ ] Implement cache hit rate tracking (0.5 hours)
- [ ] Set up alert thresholds (accuracy < 60%, latency > 150ms) (0.5 hours)

**Deliverables**:

- [ ] Prediction logging infrastructure
- [ ] Weekly validation script (cron job)
- [ ] Monitoring dashboard in admin panel
- [ ] Alert thresholds configured

### Phase 5: Documentation and Deployment (0.5 days)

**Documentation**:

- [ ] Update API documentation with `include_early_signal` parameter (0.5 hours)
- [ ] Create user-facing documentation explaining early signals (1 hour)
- [ ] Document model training procedure for future retraining (0.5 hours)
- [ ] Create runbook for production issues (0.5 hours)

**Deployment**:

- [ ] Test on staging environment (1 hour)
- [ ] Deploy to production with feature flag (0.5 hours)
- [ ] Monitor production metrics for 24 hours (ongoing)
- [ ] Enable feature flag for 10% of users (canary deployment) (0.5 hours)
- [ ] Full rollout if metrics look good (24-48 hours after canary)

**Deliverables**:

- [ ] Updated API documentation
- [ ] User-facing documentation
- [ ] Production deployment complete
- [ ] Monitoring active

### Post-Launch (Ongoing)

**Weekly Tasks**:

- [ ] Review accuracy metrics (precision, recall, AUC)
- [ ] Validate predictions from 2 weeks ago (actual outcomes)
- [ ] Check for model drift (30d vs 90d accuracy)
- [ ] Retrain model if accuracy drops below 60%

**Monthly Tasks**:

- [ ] Review user feedback and adoption rate
- [ ] Analyze false positives (which predictions didn't materialize)
- [ ] Consider feature additions based on performance analysis
- [ ] Update documentation based on learnings

---

## Estimated Timeline Summary

| Phase                        | Duration      | Key Deliverables                                              |
| ---------------------------- | ------------- | ------------------------------------------------------------- |
| **Phase 1: Data Collection** | 3-4 days      | Training dataset (375K examples), feature extraction pipeline |
| **Phase 2: Model Training**  | 2-3 days      | Trained LightGBM model (>65% precision, <10MB)                |
| **Phase 3: API Integration** | 1-2 days      | EarlySignalService, updated API endpoint, integration tests   |
| **Phase 4: Monitoring**      | 1 day         | Prediction logging, validation script, monitoring dashboard   |
| **Phase 5: Documentation**   | 0.5 days      | API docs, user guide, runbook                                 |
| **TOTAL**                    | **8-11 days** | **Production-ready early signal detection system**            |

**Contingency**: Add 2-3 days buffer for unexpected issues (API rate limits, data quality issues, etc.)

**Realistic Estimate**: **1.5-2 weeks** for single engineer working full-time

---

## Conclusion

**Option A: Minimal Viable ML for VFR Early Signal Detection** delivers a focused, production-ready solution that:

1. **Solves the Core Problem**: Predicts analyst upgrades 2 weeks ahead with >65% precision
2. **Respects KISS Principles**: <1,000 lines of code vs 33,000+ in rejected approach
3. **Fast Time to Market**: 1-2 weeks vs 16+ weeks for full ML infrastructure
4. **Zero Breaking Changes**: Backward compatible optional enhancement
5. **Explainable**: Clear reasoning for predictions, not a black box
6. **Low Maintenance**: Single model, weekly retrain, simple monitoring
7. **High ROI**: Immediate actionable value for investors with minimal complexity

**Next Steps**:

1. Approve plan and allocate 1-2 weeks for implementation
2. Begin Phase 1 (data collection) immediately
3. Track progress against implementation checklist
4. Launch with canary deployment (10% traffic) before full rollout

**Success Criteria**:

- > 65% precision predicting analyst upgrades 2 weeks ahead
- <100ms additional latency overhead
- > 30% user adoption within 3 months
- Zero production incidents

This plan prioritizes **simplicity, speed, and value delivery** over architectural sophistication, aligning with KISS principles and VFR's proven track record of accurate, actionable financial insights.
