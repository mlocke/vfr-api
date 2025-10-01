# Minimal ML Early Signal Detection - Implementation TODO

**Created**: 2025-10-01
**Status**: Not Started
**Timeline**: 10 business days (2 weeks)
**Plan Reference**: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/docs/analysis-engine/plans/minimal-ml-early-signal-detection.md`
**Last Updated**: 2025-10-01
**Code Budget**: <1,000 lines total
**Estimated Engineering Time**: 1-2 weeks (single engineer)

---

## Executive Summary

This document provides a step-by-step implementation guide for adding minimal machine learning-powered early signal detection to VFR. The feature predicts analyst rating upgrades 2 weeks ahead with >65% precision, adding forward-looking capability to VFR's proven reactive analysis.

**Core Philosophy**: KISS - Keep It Simple, Stupid. Single model, focused use case, <1,000 lines of code.

---

## Quick Status Overview

**Overall Progress**: 0% Complete

- [ ] **Phase 1**: Data Collection & Preparation (Days 1-2) - 0/12 tasks
- [ ] **Phase 2**: Feature Engineering (Days 3-4) - 0/10 tasks
- [ ] **Phase 3**: Model Training & Validation (Days 5-6) - 0/13 tasks
- [ ] **Phase 4**: API Integration (Days 7-8) - 0/11 tasks
- [ ] **Phase 5**: Monitoring & Production Deployment (Days 9-10) - 0/10 tasks

**Critical Path**: Tasks marked with 🔴 block subsequent work
**Optional Enhancements**: Tasks marked with ⭐ are nice-to-have

---

## Prerequisites Checklist

**Before starting implementation, verify:**

### Environment Setup
- [ ] Node.js 18+ installed and verified
  ```bash
  node --version  # Should output v18.x.x or higher
  ```
- [ ] VFR development server running successfully
  ```bash
  npm run dev:clean  # Should start without errors
  ```
- [ ] Redis cache server accessible
  ```bash
  redis-cli PING  # Should respond with PONG
  ```
- [ ] PostgreSQL database accessible (optional - can use CSV)
  ```bash
  psql -U postgres -c "SELECT version();"  # Should show PostgreSQL version
  ```

### API Access
- [ ] Financial Modeling Prep API key active
  - Verify rate limits: 250 requests/day (free) or unlimited (premium)
  - Test endpoint: `https://financialmodelingprep.com/api/v3/analyst-consensus/TSLA?apikey=YOUR_KEY`
- [ ] Access to historical analyst ratings (FMP provides 2+ years of history)
- [ ] Existing VFR services operational (test via `/api/health` endpoint)

### Dependencies Installation
- [ ] Install LightGBM library
  ```bash
  npm install lightgbm3 --save
  ```
- [ ] Verify installation
  ```bash
  node -e "const lgb = require('lightgbm3'); console.log('LightGBM installed:', typeof lgb)"
  ```

### Directory Structure
- [ ] Create model storage directory
  ```bash
  mkdir -p /Users/michaellocke/WebstormProjects/Home/public/vfr-api/models/early-signal/v1.0.0
  ```
- [ ] Create training scripts directory
  ```bash
  mkdir -p /Users/michaellocke/WebstormProjects/Home/public/vfr-api/scripts/ml
  ```
- [ ] Create training data directory
  ```bash
  mkdir -p /Users/michaellocke/WebstormProjects/Home/public/vfr-api/data/training
  ```

### Knowledge Prerequisites
- [ ] Review plan document: `docs/analysis-engine/plans/minimal-ml-early-signal-detection.md`
- [ ] Understand VFR 5-factor weighted analysis (see `docs/analysis-engine/vfr-analysis-flow.md`)
- [ ] Familiar with existing VFR services:
  - `app/services/financial-data/FinancialDataService.ts`
  - `app/services/sentiment/SentimentAnalysisService.ts`
  - `app/services/technical/TechnicalIndicatorService.ts`

---

## Phase 1: Data Collection & Preparation (Days 1-2)

**Objective**: Build training dataset with 3 years of historical analyst rating changes for 500 symbols

**Expected Duration**: 2 days (16 hours)
**Deliverables**: Training dataset CSV with ~375,000 examples, feature extraction pipeline
**Success Criteria**: Can generate features for any symbol with <5s latency

---

### Day 1 Morning: Historical Analyst Data Collection Infrastructure

#### 🔴 Task 1.1: Create Data Collection Script
- [ ] **File to Create**: `scripts/ml/collect-analyst-history.ts`
- [ ] **Purpose**: Fetch historical analyst ratings from FMP API
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: None (start here)

**Implementation Steps**:
1. Create basic script structure with TypeScript
2. Import FMP API service from existing VFR codebase
3. Implement date range iteration (3 years: 2022-01-01 to 2024-12-31)
4. Add rate limiting (50 symbols/hour for free tier, unlimited for premium)
5. Implement error handling and retry logic (3 retries with exponential backoff)

**Code Template**:
```typescript
// scripts/ml/collect-analyst-history.ts
import { FinancialModelingPrepAPI } from '../app/services/financial-data/FinancialModelingPrepAPI'

interface AnalystRatings {
  symbol: string
  date: Date
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  totalAnalysts: number
}

async function collectAnalystHistory(
  symbols: string[],
  startDate: Date,
  endDate: Date
): Promise<AnalystRatings[]> {
  const fmpAPI = new FinancialModelingPrepAPI()
  const allRatings: AnalystRatings[] = []

  for (const symbol of symbols) {
    console.log(`Collecting data for ${symbol}...`)

    try {
      // Fetch historical analyst ratings
      const ratings = await fmpAPI.getAnalystRatingsHistory(symbol, startDate, endDate)
      allRatings.push(...ratings)

      // Rate limiting: 10 requests/second for premium, 1/second for free
      await sleep(100) // Adjust based on your tier
    } catch (error) {
      console.error(`Failed to fetch ${symbol}:`, error)
      continue
    }
  }

  return allRatings
}

// Run script
const SP500_SYMBOLS = ['AAPL', 'MSFT', 'TSLA', /* ... 497 more */]
collectAnalystHistory(SP500_SYMBOLS, new Date('2022-01-01'), new Date('2024-12-31'))
  .then(data => console.log(`Collected ${data.length} data points`))
```

**Success Criteria**:
- [ ] Can fetch analyst ratings for test symbols (TSLA, NVDA, AAPL)
- [ ] Rate limiting prevents API errors
- [ ] Retry logic handles temporary failures
- [ ] Data saved to CSV or database

**Testing**:
```bash
# Test with 3 symbols first
node scripts/ml/collect-analyst-history.ts --symbols TSLA,NVDA,AAPL --test
```

---

#### 🔴 Task 1.2: Implement Label Generation Logic
- [ ] **File to Create**: `scripts/ml/label-generator.ts`
- [ ] **Purpose**: Calculate whether analyst consensus improved over 2-week window
- [ ] **Estimated Time**: 1.5 hours
- [ ] **Dependencies**: Task 1.1

**Implementation Steps**:
1. Calculate consensus score from analyst ratings (weighted average)
2. Compare consensus at date T vs T+14 days
3. Label = 1 if consensus increased by >5% (upgrade)
4. Label = 0 otherwise (no upgrade or downgrade)
5. Handle edge cases (no analyst coverage, missing data)

**Code Template**:
```typescript
// scripts/ml/label-generator.ts

function calculateConsensusScore(ratings: AnalystRatings): number {
  const { strongBuy, buy, hold, sell, strongSell, totalAnalysts } = ratings

  if (totalAnalysts === 0) return 0.5 // Neutral for no coverage

  // Weighted average: StrongBuy=1.0, Buy=0.75, Hold=0.5, Sell=0.25, StrongSell=0.0
  const consensus = (
    strongBuy * 1.0 +
    buy * 0.75 +
    hold * 0.5 +
    sell * 0.25 +
    strongSell * 0.0
  ) / totalAnalysts

  return consensus
}

function calculateRatingChange(
  currentRatings: AnalystRatings,
  futureRatings: AnalystRatings
): number {
  const currentConsensus = calculateConsensusScore(currentRatings)
  const futureConsensus = calculateConsensusScore(futureRatings)

  const change = futureConsensus - currentConsensus

  // Label as upgrade if consensus improved by >5% (0.05)
  return change > 0.05 ? 1 : 0
}

// Example usage
const tslaToday = { symbol: 'TSLA', date: new Date('2024-01-15'), strongBuy: 10, buy: 5, hold: 2, sell: 0, strongSell: 0, totalAnalysts: 17 }
const tslaFuture = { symbol: 'TSLA', date: new Date('2024-01-29'), strongBuy: 12, buy: 4, hold: 1, sell: 0, strongSell: 0, totalAnalysts: 17 }

console.log(calculateRatingChange(tslaToday, tslaFuture)) // Should output 1 (upgrade)
```

**Success Criteria**:
- [ ] Correctly identifies upgrades (consensus increase >5%)
- [ ] Handles missing data gracefully
- [ ] Validates against known historical events (TSLA upgrade in Jan 2024)
- [ ] Unit tests passing

**Testing**:
```bash
# Create test file
touch scripts/ml/__tests__/label-generator.test.ts

# Run tests
npm test -- scripts/ml/__tests__/label-generator.test.ts
```

---

### Day 1 Afternoon: Feature Extraction Pipeline

#### 🔴 Task 1.3: Create Feature Extractor Service
- [ ] **File to Create**: `app/services/ml/early-signal/FeatureExtractor.ts`
- [ ] **Purpose**: Extract 13 features from historical data for ML model
- [ ] **Estimated Time**: 3 hours
- [ ] **Dependencies**: None (parallel with Task 1.1-1.2)

**Implementation Steps**:
1. Create class structure extending existing VFR patterns
2. Integrate with existing services (FinancialDataService, SentimentAnalysisService, TechnicalIndicatorService)
3. Implement momentum calculations (5d, 10d, 20d price changes)
4. Implement volume features (ratio, trend)
5. Implement sentiment delta calculations
6. Implement fundamental feature extraction
7. Implement technical indicator features (RSI, MACD)

**Code Template**:
```typescript
// app/services/ml/early-signal/FeatureExtractor.ts

import { FinancialDataService } from '../../financial-data/FinancialDataService'
import { SentimentAnalysisService } from '../../sentiment/SentimentAnalysisService'
import { TechnicalIndicatorService } from '../../technical/TechnicalIndicatorService'
import type { FeatureVector } from './types'

export class EarlySignalFeatureExtractor {
  private financialDataService: FinancialDataService
  private sentimentService: SentimentAnalysisService
  private technicalService: TechnicalIndicatorService

  constructor() {
    this.financialDataService = new FinancialDataService()
    this.sentimentService = new SentimentAnalysisService()
    this.technicalService = new TechnicalIndicatorService()
  }

  /**
   * Extract all 13 features for ML model prediction
   * @param symbol Stock symbol (e.g., 'TSLA')
   * @param asOfDate Historical date for feature extraction (default: today)
   * @returns Feature vector with 13 numeric features
   */
  async extractFeatures(symbol: string, asOfDate?: Date): Promise<FeatureVector> {
    const date = asOfDate || new Date()

    // Parallel data collection (leverage existing VFR services)
    const [historicalData, sentimentData, fundamentals, technicals] = await Promise.all([
      this.getHistoricalData(symbol, date, 50), // 50 days for 20d momentum
      this.getSentimentData(symbol, date),
      this.getFundamentalsData(symbol, date),
      this.getTechnicalData(symbol, date)
    ])

    return {
      // Momentum features (3)
      price_change_5d: this.calculateMomentum(historicalData, 5),
      price_change_10d: this.calculateMomentum(historicalData, 10),
      price_change_20d: this.calculateMomentum(historicalData, 20),

      // Volume features (2)
      volume_ratio: this.calculateVolumeRatio(historicalData, 5, 20),
      volume_trend: this.calculateVolumeTrend(historicalData, 10),

      // Sentiment delta features (3)
      sentiment_news_delta: this.calculateSentimentDelta(sentimentData, 'news', 7),
      sentiment_reddit_accel: this.calculateSentimentAccel(sentimentData, 'reddit', 7, 14),
      sentiment_options_shift: this.calculateOptionsShift(sentimentData, 7),

      // Fundamental features (3)
      earnings_surprise: fundamentals.earningsSurprise || 0,
      revenue_growth_accel: fundamentals.revenueGrowthAccel || 0,
      analyst_coverage_change: fundamentals.analystCoverageChange || 0,

      // Technical features (2)
      rsi_momentum: technicals.rsiMomentum || 0,
      macd_histogram_trend: technicals.macdHistogramTrend || 0
    }
  }

  private calculateMomentum(data: OHLC[], days: number): number {
    if (data.length < days) return 0
    return (data[0].close - data[days].close) / data[days].close
  }

  private calculateVolumeRatio(data: OHLC[], shortWindow: number, longWindow: number): number {
    if (data.length < longWindow) return 1.0

    const avgShort = data.slice(0, shortWindow).reduce((sum, d) => sum + d.volume, 0) / shortWindow
    const avgLong = data.slice(0, longWindow).reduce((sum, d) => sum + d.volume, 0) / longWindow

    return avgShort / avgLong
  }

  private calculateVolumeTrend(data: OHLC[], window: number): number {
    if (data.length < window) return 0

    const volumes = data.slice(0, window).map(d => d.volume)
    return this.linearRegressionSlope(volumes)
  }

  private linearRegressionSlope(values: number[]): number {
    const n = values.length
    const sumX = (n * (n - 1)) / 2
    const sumY = values.reduce((a, b) => a + b, 0)
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  }

  // Additional helper methods for sentiment, fundamentals, technicals...
  // (See full implementation in plan document)
}
```

**Success Criteria**:
- [ ] Can extract all 13 features for test symbols (TSLA, NVDA)
- [ ] Reuses existing VFR services (no code duplication)
- [ ] Handles missing data gracefully (returns 0 or neutral value)
- [ ] Completes in <5s per symbol
- [ ] Unit tests passing (test each feature calculation)

**Testing**:
```bash
# Create test file
touch app/services/ml/early-signal/__tests__/FeatureExtractor.test.ts

# Run tests (NO MOCK DATA - use real APIs)
npm test -- app/services/ml/early-signal/__tests__/FeatureExtractor.test.ts
```

---

#### Task 1.4: Create Type Definitions
- [ ] **File to Create**: `app/services/ml/early-signal/types.ts`
- [ ] **Purpose**: TypeScript interfaces for ML data structures
- [ ] **Estimated Time**: 30 minutes
- [ ] **Dependencies**: None

**Code Template**:
```typescript
// app/services/ml/early-signal/types.ts

export interface FeatureVector {
  // Momentum features (3)
  price_change_5d: number
  price_change_10d: number
  price_change_20d: number

  // Volume features (2)
  volume_ratio: number
  volume_trend: number

  // Sentiment delta features (3)
  sentiment_news_delta: number
  sentiment_reddit_accel: number
  sentiment_options_shift: number

  // Fundamental features (3)
  earnings_surprise: number
  revenue_growth_accel: number
  analyst_coverage_change: number

  // Technical features (2)
  rsi_momentum: number
  macd_histogram_trend: number
}

export interface TrainingExample {
  symbol: string
  date: Date
  features: FeatureVector
  label: number // 0 or 1 (no upgrade / upgrade)
}

export interface EarlySignalPrediction {
  upgrade_likely: boolean
  downgrade_likely: boolean
  confidence: number // 0.0-1.0
  horizon: '2_weeks'
  reasoning: string[]
  feature_importance: Record<string, number>
  prediction_timestamp: number
  model_version: string
}

export interface AnalystRatings {
  symbol: string
  date: Date
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  totalAnalysts: number
}
```

**Success Criteria**:
- [ ] All types compile without errors
- [ ] Types match plan document specifications
- [ ] Used consistently across codebase

---

### Day 2 Morning: Training Data Generation

#### 🔴 Task 1.5: Generate Full Training Dataset
- [ ] **File to Create**: `scripts/ml/generate-training-data.ts`
- [ ] **Purpose**: Combine data collection + feature extraction + labeling
- [ ] **Estimated Time**: 2 hours (script) + 4-6 hours (data collection)
- [ ] **Dependencies**: Tasks 1.1, 1.2, 1.3

**Implementation Steps**:
1. Load S&P 500 symbol list (500 symbols)
2. For each symbol, iterate through 750 trading days (3 years)
3. Extract features at each date
4. Generate labels by comparing T vs T+14 analyst ratings
5. Save to CSV or PostgreSQL table
6. Track progress (show % complete, ETA)

**Code Template**:
```typescript
// scripts/ml/generate-training-data.ts

import { EarlySignalFeatureExtractor } from '../app/services/ml/early-signal/FeatureExtractor'
import { collectAnalystHistory } from './collect-analyst-history'
import { calculateRatingChange } from './label-generator'
import * as fs from 'fs'
import * as csv from 'csv-writer'

async function generateTrainingData() {
  const featureExtractor = new EarlySignalFeatureExtractor()
  const dataset: TrainingExample[] = []

  // Load S&P 500 symbols (or start with smaller subset for testing)
  const symbols = loadSP500Symbols() // ['AAPL', 'MSFT', ... 500 symbols]

  console.log(`Generating training data for ${symbols.length} symbols...`)

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i]
    console.log(`[${i + 1}/${symbols.length}] Processing ${symbol}...`)

    try {
      // Fetch historical analyst ratings
      const ratings = await collectAnalystHistory([symbol], new Date('2022-01-01'), new Date('2024-12-31'))

      // For each date, extract features and generate label
      for (let j = 0; j < ratings.length - 14; j++) { // -14 for 2-week lookahead
        const currentDate = ratings[j].date
        const futureDate = ratings[j + 14].date

        const currentRatings = ratings[j]
        const futureRatings = ratings[j + 14]

        // Extract features as of currentDate
        const features = await featureExtractor.extractFeatures(symbol, currentDate)

        // Generate label (upgrade or not)
        const label = calculateRatingChange(currentRatings, futureRatings)

        dataset.push({
          symbol,
          date: currentDate,
          features,
          label
        })
      }

      console.log(`  ✓ ${symbol}: ${ratings.length - 14} examples generated`)
    } catch (error) {
      console.error(`  ✗ ${symbol}: Failed -`, error.message)
      continue
    }

    // Save checkpoint every 50 symbols
    if ((i + 1) % 50 === 0) {
      await saveDataset(dataset, `data/training/checkpoint_${i + 1}.csv`)
      console.log(`Checkpoint saved: ${dataset.length} examples`)
    }
  }

  // Save final dataset
  await saveDataset(dataset, 'data/training/early-signal-v1.csv')
  console.log(`Training data generation complete: ${dataset.length} examples`)

  // Print statistics
  const upgrades = dataset.filter(d => d.label === 1).length
  const noUpgrades = dataset.filter(d => d.label === 0).length
  console.log(`Label distribution: ${upgrades} upgrades (${(upgrades / dataset.length * 100).toFixed(1)}%), ${noUpgrades} no upgrades`)
}

// Run script
generateTrainingData()
```

**Success Criteria**:
- [ ] Dataset contains ~375,000 examples (500 symbols × 750 days)
- [ ] Label distribution: ~10-15% upgrades, 85-90% no upgrades
- [ ] All 13 features populated (no NaN or undefined values)
- [ ] CSV or database saved successfully
- [ ] Can reload data and verify integrity

**Testing**:
```bash
# Start with 10 symbols for testing
node scripts/ml/generate-training-data.ts --symbols TSLA,NVDA,AAPL,MSFT,GOOGL,AMZN,META,NFLX,AMD,PLTR --test

# Run full dataset generation (4-6 hours)
node scripts/ml/generate-training-data.ts --full
```

**⚠️ Important Notes**:
- Expect 4-6 hours for full dataset generation (500 symbols × 750 days = 375K API calls)
- Monitor API rate limits (pause/resume if needed)
- Save checkpoints to avoid data loss
- Validate data quality before proceeding to Phase 2

---

### Day 2 Afternoon: Data Validation & Quality Checks

#### Task 1.6: Implement Data Quality Checks
- [ ] **File to Create**: `scripts/ml/validate-training-data.ts`
- [ ] **Purpose**: Verify data integrity and quality
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 1.5

**Validation Checks**:
1. **Completeness**: >90% of features populated (no excessive missing values)
2. **Label Balance**: 10-15% upgrades (not too imbalanced)
3. **Feature Distributions**: No extreme outliers (cap at 99th percentile)
4. **Temporal Integrity**: No data leakage (future data not used for past predictions)
5. **Symbol Coverage**: All 500 symbols represented

**Code Template**:
```typescript
// scripts/ml/validate-training-data.ts

import * as fs from 'fs'
import * as csv from 'csv-parser'

async function validateTrainingData(filepath: string) {
  const data: TrainingExample[] = await loadCSV(filepath)

  console.log('Data Validation Report')
  console.log('======================')

  // 1. Basic statistics
  console.log(`Total examples: ${data.length}`)
  console.log(`Unique symbols: ${new Set(data.map(d => d.symbol)).size}`)
  console.log(`Date range: ${new Date(Math.min(...data.map(d => d.date.getTime())))} to ${new Date(Math.max(...data.map(d => d.date.getTime())))}`)

  // 2. Label distribution
  const upgrades = data.filter(d => d.label === 1).length
  const noUpgrades = data.filter(d => d.label === 0).length
  console.log(`\nLabel Distribution:`)
  console.log(`  Upgrades: ${upgrades} (${(upgrades / data.length * 100).toFixed(1)}%)`)
  console.log(`  No Upgrades: ${noUpgrades} (${(noUpgrades / data.length * 100).toFixed(1)}%)`)

  if (upgrades / data.length < 0.10 || upgrades / data.length > 0.20) {
    console.warn('⚠️  WARNING: Label imbalance outside expected range (10-20%)')
  }

  // 3. Feature completeness
  console.log(`\nFeature Completeness:`)
  const featureNames = Object.keys(data[0].features)
  for (const feature of featureNames) {
    const missingCount = data.filter(d => d.features[feature] === null || isNaN(d.features[feature])).length
    const completeness = (1 - missingCount / data.length) * 100
    console.log(`  ${feature}: ${completeness.toFixed(1)}% complete`)

    if (completeness < 90) {
      console.warn(`⚠️  WARNING: ${feature} has low completeness (${completeness.toFixed(1)}%)`)
    }
  }

  // 4. Feature distributions (check for extreme outliers)
  console.log(`\nFeature Distributions (mean ± std):`)
  for (const feature of featureNames) {
    const values = data.map(d => d.features[feature]).filter(v => !isNaN(v))
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    console.log(`  ${feature}: ${mean.toFixed(4)} ± ${stdDev.toFixed(4)}`)
  }

  // 5. Temporal integrity check
  console.log(`\nTemporal Integrity Check:`)
  const sortedData = data.sort((a, b) => a.date.getTime() - b.date.getTime())
  let leakageDetected = false
  for (let i = 1; i < sortedData.length; i++) {
    if (sortedData[i].date < sortedData[i - 1].date) {
      console.error('❌ TEMPORAL LEAK DETECTED: Future data used for past prediction')
      leakageDetected = true
      break
    }
  }
  if (!leakageDetected) {
    console.log('  ✓ No temporal leakage detected')
  }

  console.log('\nValidation Complete')
}

// Run validation
validateTrainingData('data/training/early-signal-v1.csv')
```

**Success Criteria**:
- [ ] >90% feature completeness
- [ ] Label balance 10-20%
- [ ] No temporal leakage detected
- [ ] Feature distributions reasonable (no extreme outliers)
- [ ] All validation checks passing

---

#### Task 1.7: Time-Series Split (Train/Val/Test)
- [ ] **File to Create**: `scripts/ml/split-training-data.ts`
- [ ] **Purpose**: Split data into train/validation/test sets with temporal ordering
- [ ] **Estimated Time**: 30 minutes
- [ ] **Dependencies**: Task 1.6

**Split Strategy**:
- **Training Set**: 2022-01-01 to 2024-06-30 (2.5 years, ~625 days)
- **Validation Set**: 2024-07-01 to 2024-09-30 (3 months, ~63 days)
- **Test Set**: 2024-10-01 to 2024-12-31 (3 months, ~63 days)

**Code Template**:
```typescript
// scripts/ml/split-training-data.ts

function splitTrainingData(data: TrainingExample[]) {
  // Sort by date (temporal ordering)
  const sortedData = data.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Split by date ranges
  const trainData = sortedData.filter(d => d.date < new Date('2024-07-01'))
  const valData = sortedData.filter(d => d.date >= new Date('2024-07-01') && d.date < new Date('2024-10-01'))
  const testData = sortedData.filter(d => d.date >= new Date('2024-10-01'))

  console.log(`Training set: ${trainData.length} examples (${(trainData.length / data.length * 100).toFixed(1)}%)`)
  console.log(`Validation set: ${valData.length} examples (${(valData.length / data.length * 100).toFixed(1)}%)`)
  console.log(`Test set: ${testData.length} examples (${(testData.length / data.length * 100).toFixed(1)}%)`)

  // Save splits
  saveCSV(trainData, 'data/training/train.csv')
  saveCSV(valData, 'data/training/validation.csv')
  saveCSV(testData, 'data/training/test.csv')

  return { trainData, valData, testData }
}
```

**Success Criteria**:
- [ ] Train/val/test split is 80%/10%/10% approximately
- [ ] No temporal overlap between splits
- [ ] All three files saved successfully

---

### Phase 1 Validation Gate

**Before proceeding to Phase 2, verify:**
- [ ] Training dataset generated successfully (~375K examples)
- [ ] All data quality checks passing
- [ ] Train/val/test splits created
- [ ] Can load and inspect data without errors
- [ ] Label balance is 10-20% upgrades
- [ ] Feature extraction completes in <5s per symbol

**Blocker Resolution**: If validation fails, debug data quality issues before continuing.

---

## Phase 2: Feature Engineering (Days 3-4)

**Objective**: Implement robust feature calculation and normalization for ML model

**Expected Duration**: 1.5 days (12 hours)
**Deliverables**: Production-ready feature extractor with normalization, unit tests
**Success Criteria**: Can extract and normalize features with <100ms latency per symbol

---

### Day 3 Morning: Feature Calculation Refinement

#### Task 2.1: Implement Momentum Indicators
- [ ] **File to Modify**: `app/services/ml/early-signal/FeatureExtractor.ts`
- [ ] **Purpose**: Refine price momentum calculations (5d, 10d, 20d)
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 1.3

**Implementation Steps**:
1. Verify 5d, 10d, 20d momentum calculations are accurate
2. Add error handling for missing price data
3. Test with known historical events (e.g., TSLA price movements)
4. Add unit tests for edge cases (IPO stocks, delisted stocks)

**Testing**:
```typescript
// Test case: TSLA price movement in Jan 2024
const features = await featureExtractor.extractFeatures('TSLA', new Date('2024-01-15'))
expect(features.price_change_10d).toBeCloseTo(0.12, 2) // ~12% gain over 10d
```

**Success Criteria**:
- [ ] Momentum calculations match manual calculations
- [ ] Handles missing data gracefully (returns 0)
- [ ] Unit tests passing

---

#### Task 2.2: Implement Volume Features
- [ ] **File to Modify**: `app/services/ml/early-signal/FeatureExtractor.ts`
- [ ] **Purpose**: Calculate volume ratio and trend
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 1.3

**Success Criteria**:
- [ ] Volume ratio = avg_volume_5d / avg_volume_20d
- [ ] Volume trend uses linear regression over 10 days
- [ ] Handles zero volume edge cases
- [ ] Unit tests passing

---

#### Task 2.3: Implement Sentiment Delta Features
- [ ] **File to Modify**: `app/services/ml/early-signal/FeatureExtractor.ts`
- [ ] **Purpose**: Calculate sentiment change over time
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Task 1.3, existing SentimentAnalysisService

**Implementation Steps**:
1. Integrate with existing VFR `SentimentAnalysisService`
2. Calculate news sentiment delta (7-day change)
3. Calculate Reddit sentiment acceleration (7d vs 14d change)
4. Calculate options sentiment shift (put/call ratio change)
5. Handle missing sentiment data (no news, no Reddit posts)

**Code Template**:
```typescript
private async calculateSentimentDelta(symbol: string, date: Date, window: number): Promise<number> {
  const today = await this.sentimentService.analyzeStockSentimentImpact(symbol, sector, baseScore, date)
  const past = await this.sentimentService.analyzeStockSentimentImpact(symbol, sector, baseScore, new Date(date.getTime() - window * 24 * 60 * 60 * 1000))

  return today.newsScore - past.newsScore
}
```

**Success Criteria**:
- [ ] Sentiment delta calculations accurate
- [ ] Handles missing sentiment data
- [ ] Integration with VFR services working
- [ ] Unit tests passing

---

#### Task 2.4: Implement Fundamental Features
- [ ] **File to Modify**: `app/services/ml/early-signal/FeatureExtractor.ts`
- [ ] **Purpose**: Extract earnings surprise, revenue growth accel, analyst coverage change
- [ ] **Estimated Time**: 1.5 hours
- [ ] **Dependencies**: Task 1.3, existing FinancialDataService

**Implementation Steps**:
1. Integrate with existing VFR `FinancialDataService`
2. Extract earnings surprise from last quarterly report
3. Calculate revenue growth acceleration (QoQ change)
4. Track analyst coverage change (30-day delta)
5. Handle missing fundamental data (no earnings yet, small cap stocks)

**Success Criteria**:
- [ ] Fundamental features extracted correctly
- [ ] Handles missing data gracefully
- [ ] Integration with VFR services working
- [ ] Unit tests passing

---

#### Task 2.5: Implement Technical Features
- [ ] **File to Modify**: `app/services/ml/early-signal/FeatureExtractor.ts`
- [ ] **Purpose**: Calculate RSI momentum and MACD histogram trend
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 1.3, existing TechnicalIndicatorService

**Implementation Steps**:
1. Integrate with existing VFR `TechnicalIndicatorService`
2. Calculate RSI momentum (current - 14d average)
3. Calculate MACD histogram trend (5-day slope)
4. Handle missing technical data

**Success Criteria**:
- [ ] Technical features extracted correctly
- [ ] Integration with VFR services working
- [ ] Unit tests passing

---

### Day 3 Afternoon: Feature Normalization

#### 🔴 Task 2.6: Implement Feature Normalizer
- [ ] **File to Create**: `app/services/ml/early-signal/FeatureNormalizer.ts`
- [ ] **Purpose**: Z-score normalization for stable model training
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Phase 1 complete

**Implementation Steps**:
1. Calculate mean and standard deviation for each feature from training data
2. Implement Z-score normalization: (x - mean) / std_dev
3. Save normalization parameters with model artifacts
4. Implement transform() method for inference

**Code Template**:
```typescript
// app/services/ml/early-signal/FeatureNormalizer.ts

export class FeatureNormalizer {
  private featureMeans: Map<string, number> = new Map()
  private featureStdDevs: Map<string, number> = new Map()

  /**
   * Fit normalizer on training data (calculate mean and std dev)
   * @param trainingData Array of feature vectors
   */
  fit(trainingData: FeatureVector[]): void {
    const featureNames = Object.keys(trainingData[0])

    for (const feature of featureNames) {
      const values = trainingData.map(d => d[feature])
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
      const stdDev = Math.sqrt(variance)

      this.featureMeans.set(feature, mean)
      this.featureStdDevs.set(feature, stdDev)
    }

    console.log(`Normalizer fitted on ${trainingData.length} examples`)
  }

  /**
   * Transform features using Z-score normalization
   * @param features Feature vector to normalize
   * @returns Array of normalized values
   */
  transform(features: FeatureVector): number[] {
    return Object.entries(features).map(([name, value]) => {
      const mean = this.featureMeans.get(name) || 0
      const stdDev = this.featureStdDevs.get(name) || 1
      return (value - mean) / stdDev
    })
  }

  /**
   * Save normalization parameters to JSON
   */
  getParams(): Record<string, { mean: number; stdDev: number }> {
    const params: Record<string, { mean: number; stdDev: number }> = {}

    for (const [feature, mean] of this.featureMeans.entries()) {
      params[feature] = {
        mean,
        stdDev: this.featureStdDevs.get(feature) || 1
      }
    }

    return params
  }

  /**
   * Load normalization parameters from JSON
   */
  loadParams(params: Record<string, { mean: number; stdDev: number }>): void {
    for (const [feature, { mean, stdDev }] of Object.entries(params)) {
      this.featureMeans.set(feature, mean)
      this.featureStdDevs.set(feature, stdDev)
    }
  }
}
```

**Success Criteria**:
- [ ] Normalizer fits on training data
- [ ] Transform produces values with mean ≈ 0, std dev ≈ 1
- [ ] Normalization parameters can be saved/loaded
- [ ] Unit tests passing

---

#### Task 2.7: Create Feature Extraction Tests
- [ ] **File to Create**: `app/services/ml/early-signal/__tests__/FeatureExtractor.test.ts`
- [ ] **Purpose**: Comprehensive unit tests for feature extraction
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Tasks 2.1-2.5

**Test Cases**:
```typescript
describe('EarlySignalFeatureExtractor', () => {
  it('should extract all 13 features for TSLA', async () => {
    const extractor = new EarlySignalFeatureExtractor()
    const features = await extractor.extractFeatures('TSLA')

    expect(features).toHaveProperty('price_change_5d')
    expect(features).toHaveProperty('price_change_10d')
    expect(features).toHaveProperty('price_change_20d')
    // ... test all 13 features exist
  })

  it('should handle missing data gracefully', async () => {
    const extractor = new EarlySignalFeatureExtractor()
    const features = await extractor.extractFeatures('INVALID_SYMBOL')

    // Should return neutral values, not throw
    expect(features.price_change_10d).toBe(0)
  })

  it('should complete in <5s for real stock', async () => {
    const extractor = new EarlySignalFeatureExtractor()
    const start = Date.now()
    await extractor.extractFeatures('TSLA')
    const duration = Date.now() - start

    expect(duration).toBeLessThan(5000)
  }, 10000)
})
```

**Success Criteria**:
- [ ] All test cases passing
- [ ] Tests use real APIs (NO MOCK DATA)
- [ ] Tests complete in reasonable time (<30s total)

---

#### Task 2.8: Create Normalizer Tests
- [ ] **File to Create**: `app/services/ml/early-signal/__tests__/FeatureNormalizer.test.ts`
- [ ] **Purpose**: Unit tests for feature normalization
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 2.6

**Success Criteria**:
- [ ] Tests verify Z-score normalization (mean ≈ 0, std ≈ 1)
- [ ] Tests verify save/load params
- [ ] All tests passing

---

### Day 4: Integration Testing & Performance Optimization

#### Task 2.9: End-to-End Feature Pipeline Test
- [ ] **File to Create**: `scripts/ml/test-feature-pipeline.ts`
- [ ] **Purpose**: Validate complete feature extraction + normalization pipeline
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Tasks 2.1-2.8

**Test Script**:
```typescript
// Test complete pipeline: extract → normalize → verify
const extractor = new EarlySignalFeatureExtractor()
const normalizer = new FeatureNormalizer()

// Fit normalizer on training data
const trainData = loadCSV('data/training/train.csv')
normalizer.fit(trainData.map(d => d.features))

// Extract and normalize features for test symbol
const features = await extractor.extractFeatures('TSLA')
const normalized = normalizer.transform(features)

console.log('Raw features:', features)
console.log('Normalized features:', normalized)
console.log('Feature vector length:', normalized.length) // Should be 13
```

**Success Criteria**:
- [ ] Pipeline runs without errors
- [ ] Normalized features are numeric (no NaN)
- [ ] Pipeline completes in <5s per symbol

---

#### Task 2.10: Performance Optimization
- [ ] **File to Modify**: `app/services/ml/early-signal/FeatureExtractor.ts`
- [ ] **Purpose**: Optimize feature extraction for production latency (<100ms target)
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Task 2.9

**Optimization Strategies**:
1. Cache intermediate calculations (OHLC data, sentiment data)
2. Parallelize independent API calls (all Promise.all)
3. Use Redis cache for historical data
4. Minimize redundant calculations

**Testing**:
```bash
# Benchmark feature extraction latency
node scripts/ml/benchmark-feature-extraction.ts
# Target: <100ms per symbol
```

**Success Criteria**:
- [ ] Feature extraction completes in <100ms per symbol (with cache hit)
- [ ] Feature extraction completes in <2s per symbol (with cache miss)
- [ ] No performance regressions from optimizations

---

### Phase 2 Validation Gate

**Before proceeding to Phase 3, verify:**
- [ ] All 13 features extracted correctly
- [ ] Feature normalization working (Z-score)
- [ ] Integration with existing VFR services working
- [ ] Unit tests passing (feature extraction + normalization)
- [ ] Performance target met (<100ms with cache, <2s without)
- [ ] Can generate normalized feature vectors for any symbol

---

## Phase 3: Model Training & Validation (Days 5-6)

**Objective**: Train LightGBM binary classifier and validate performance

**Expected Duration**: 2 days (16 hours)
**Deliverables**: Trained model file (model.txt), performance report, feature importance analysis
**Success Criteria**: >65% precision, >40% recall at 0.65 confidence threshold, AUC >0.72

---

### Day 5 Morning: LightGBM Model Training

#### 🔴 Task 3.1: Create Model Trainer Service
- [ ] **File to Create**: `app/services/ml/early-signal/ModelTrainer.ts`
- [ ] **Purpose**: Train LightGBM binary classifier on prepared dataset
- [ ] **Estimated Time**: 3 hours
- [ ] **Dependencies**: Phase 2 complete

**Implementation Steps**:
1. Install and configure LightGBM library
2. Load train/validation datasets
3. Configure hyperparameters (initial values from plan)
4. Implement training loop with early stopping
5. Save trained model to disk

**Code Template**:
```typescript
// app/services/ml/early-signal/ModelTrainer.ts

import lgb from 'lightgbm3'
import { FeatureNormalizer } from './FeatureNormalizer'
import type { TrainingExample } from './types'

export interface TrainingConfig {
  // Core objective
  objective: 'binary'
  metric: 'auc'

  // Boosting parameters
  boosting_type: 'gbdt'
  num_leaves: number
  learning_rate: number

  // Regularization
  feature_fraction: number
  bagging_fraction: number
  bagging_freq: number
  max_depth: number
  min_data_in_leaf: number

  // Class imbalance
  is_unbalance: boolean

  // Training control
  num_boost_round: number
  early_stopping_rounds: number
  verbose: number
}

export class EarlySignalModelTrainer {
  private normalizer: FeatureNormalizer

  constructor() {
    this.normalizer = new FeatureNormalizer()
  }

  /**
   * Train LightGBM model on provided dataset
   * @param trainData Training examples
   * @param valData Validation examples
   * @param config Training configuration
   * @returns Trained model
   */
  async trainModel(
    trainData: TrainingExample[],
    valData: TrainingExample[],
    config: TrainingConfig
  ): Promise<any> {
    console.log('Training Early Signal Model')
    console.log('============================')
    console.log(`Training examples: ${trainData.length}`)
    console.log(`Validation examples: ${valData.length}`)

    // Fit normalizer on training data
    console.log('Fitting feature normalizer...')
    this.normalizer.fit(trainData.map(d => d.features))

    // Prepare training data
    const trainFeatures = trainData.map(d => this.normalizer.transform(d.features))
    const trainLabels = trainData.map(d => d.label)

    // Prepare validation data
    const valFeatures = valData.map(d => this.normalizer.transform(d.features))
    const valLabels = valData.map(d => d.label)

    console.log('Training model...')
    const startTime = Date.now()

    // Train with LightGBM
    const model = await lgb.train({
      objective: config.objective,
      metric: config.metric,
      boosting_type: config.boosting_type,
      num_leaves: config.num_leaves,
      learning_rate: config.learning_rate,
      feature_fraction: config.feature_fraction,
      bagging_fraction: config.bagging_fraction,
      bagging_freq: config.bagging_freq,
      max_depth: config.max_depth,
      min_data_in_leaf: config.min_data_in_leaf,
      is_unbalance: config.is_unbalance,
      verbose: config.verbose
    }, trainFeatures, trainLabels, {
      num_boost_round: config.num_boost_round,
      early_stopping_rounds: config.early_stopping_rounds,
      valid_sets: [valFeatures],
      valid_labels: [valLabels],
      valid_names: ['validation']
    })

    const trainingTime = (Date.now() - startTime) / 1000
    console.log(`Model training completed in ${trainingTime.toFixed(1)}s`)

    return model
  }

  getNormalizer(): FeatureNormalizer {
    return this.normalizer
  }
}
```

**Default Configuration**:
```typescript
const defaultConfig: TrainingConfig = {
  objective: 'binary',
  metric: 'auc',
  boosting_type: 'gbdt',
  num_leaves: 31,
  learning_rate: 0.05,
  feature_fraction: 0.8,
  bagging_fraction: 0.8,
  bagging_freq: 5,
  max_depth: 6,
  min_data_in_leaf: 50,
  is_unbalance: true,
  num_boost_round: 500,
  early_stopping_rounds: 50,
  verbose: 0
}
```

**Success Criteria**:
- [ ] Model trains without errors
- [ ] Training completes in <5 minutes
- [ ] Validation AUC improves over iterations
- [ ] Early stopping triggers appropriately

---

#### 🔴 Task 3.2: Create Training Script
- [ ] **File to Create**: `scripts/ml/train-early-signal-model.ts`
- [ ] **Purpose**: Orchestrate model training end-to-end
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 3.1

**Script Template**:
```typescript
// scripts/ml/train-early-signal-model.ts

import { EarlySignalModelTrainer } from '../app/services/ml/early-signal/ModelTrainer'
import { loadCSV } from './utils'
import * as fs from 'fs'
import * as path from 'path'

async function trainModel() {
  const trainer = new EarlySignalModelTrainer()

  // Load datasets
  console.log('Loading training data...')
  const trainData = await loadCSV('data/training/train.csv')
  const valData = await loadCSV('data/training/validation.csv')

  console.log(`Loaded ${trainData.length} training examples, ${valData.length} validation examples`)

  // Train model
  const model = await trainer.trainModel(trainData, valData, {
    objective: 'binary',
    metric: 'auc',
    boosting_type: 'gbdt',
    num_leaves: 31,
    learning_rate: 0.05,
    feature_fraction: 0.8,
    bagging_fraction: 0.8,
    bagging_freq: 5,
    max_depth: 6,
    min_data_in_leaf: 50,
    is_unbalance: true,
    num_boost_round: 500,
    early_stopping_rounds: 50,
    verbose: 50
  })

  // Save model
  const modelDir = path.join(__dirname, '../models/early-signal/v1.0.0')
  await fs.promises.mkdir(modelDir, { recursive: true })

  console.log('Saving model...')
  await model.saveModel(path.join(modelDir, 'model.txt'))

  // Save feature metadata
  const metadata = {
    feature_names: Object.keys(trainData[0].features),
    normalization_params: trainer.getNormalizer().getParams(),
    training_date: new Date().toISOString(),
    num_training_examples: trainData.length,
    num_validation_examples: valData.length,
    model_version: 'v1.0.0'
  }

  await fs.promises.writeFile(
    path.join(modelDir, 'feature_metadata.json'),
    JSON.stringify(metadata, null, 2)
  )

  console.log('Model training complete!')
  console.log(`Model saved to: ${modelDir}`)
}

// Run training
trainModel().catch(console.error)
```

**Success Criteria**:
- [ ] Script runs without errors
- [ ] Model file saved to disk (model.txt, 5-10MB)
- [ ] Feature metadata saved (feature_metadata.json)
- [ ] Can verify model loads correctly

**Run Training**:
```bash
node scripts/ml/train-early-signal-model.ts
```

---

### Day 5 Afternoon: Model Evaluation

#### 🔴 Task 3.3: Create Model Evaluator
- [ ] **File to Create**: `app/services/ml/early-signal/ModelEvaluator.ts`
- [ ] **Purpose**: Evaluate model performance on test set
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Task 3.2

**Implementation Steps**:
1. Load trained model and test dataset
2. Generate predictions on test set
3. Calculate performance metrics (precision, recall, AUC, F1)
4. Generate confusion matrix
5. Analyze feature importance

**Code Template**:
```typescript
// app/services/ml/early-signal/ModelEvaluator.ts

export interface PerformanceMetrics {
  // Primary metrics
  auc: number
  precision_at_65: number
  recall_at_65: number
  f1_at_65: number

  // Confusion matrix
  confusion_matrix: {
    true_positives: number
    false_positives: number
    true_negatives: number
    false_negatives: number
  }

  // Calibration
  calibration_error: number

  // Feature importance
  feature_importance: Record<string, number>
}

export class ModelEvaluator {
  /**
   * Evaluate model on test dataset
   * @param model Trained LightGBM model
   * @param testData Test examples
   * @param normalizer Feature normalizer
   * @param threshold Confidence threshold (default 0.65)
   * @returns Performance metrics
   */
  evaluateModel(
    model: any,
    testData: TrainingExample[],
    normalizer: FeatureNormalizer,
    threshold: number = 0.65
  ): PerformanceMetrics {
    console.log('Evaluating model on test set')
    console.log(`Test examples: ${testData.length}`)
    console.log(`Threshold: ${threshold}`)

    // Generate predictions
    const predictions = testData.map(example => {
      const features = normalizer.transform(example.features)
      return model.predict([features])[0] // Probability of upgrade
    })

    const labels = testData.map(d => d.label)

    // Calculate metrics
    const auc = this.calculateAUC(predictions, labels)
    const precision = this.calculatePrecision(predictions, labels, threshold)
    const recall = this.calculateRecall(predictions, labels, threshold)
    const f1 = this.calculateF1(predictions, labels, threshold)
    const confusionMatrix = this.confusionMatrix(predictions, labels, threshold)
    const calibrationError = this.calculateCalibrationError(predictions, labels)
    const featureImportance = model.getFeatureImportance()

    return {
      auc,
      precision_at_65: precision,
      recall_at_65: recall,
      f1_at_65: f1,
      confusion_matrix: confusionMatrix,
      calibration_error: calibrationError,
      feature_importance: featureImportance
    }
  }

  private calculatePrecision(predictions: number[], labels: number[], threshold: number): number {
    let truePositives = 0
    let falsePositives = 0

    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] >= threshold) {
        if (labels[i] === 1) truePositives++
        else falsePositives++
      }
    }

    return truePositives / (truePositives + falsePositives)
  }

  private calculateRecall(predictions: number[], labels: number[], threshold: number): number {
    let truePositives = 0
    let falseNegatives = 0

    for (let i = 0; i < predictions.length; i++) {
      if (labels[i] === 1) {
        if (predictions[i] >= threshold) truePositives++
        else falseNegatives++
      }
    }

    return truePositives / (truePositives + falseNegatives)
  }

  private calculateF1(predictions: number[], labels: number[], threshold: number): number {
    const precision = this.calculatePrecision(predictions, labels, threshold)
    const recall = this.calculateRecall(predictions, labels, threshold)
    return 2 * (precision * recall) / (precision + recall)
  }

  private calculateAUC(predictions: number[], labels: number[]): number {
    // Implementation of AUC-ROC calculation
    // (See full implementation in plan document)
    return 0.75 // Placeholder
  }

  private confusionMatrix(predictions: number[], labels: number[], threshold: number) {
    let tp = 0, fp = 0, tn = 0, fn = 0

    for (let i = 0; i < predictions.length; i++) {
      const predicted = predictions[i] >= threshold ? 1 : 0
      const actual = labels[i]

      if (predicted === 1 && actual === 1) tp++
      else if (predicted === 1 && actual === 0) fp++
      else if (predicted === 0 && actual === 0) tn++
      else if (predicted === 0 && actual === 1) fn++
    }

    return { true_positives: tp, false_positives: fp, true_negatives: tn, false_negatives: fn }
  }

  private calculateCalibrationError(predictions: number[], labels: number[]): number {
    // Bin predictions and check if actual rate matches predicted rate
    const bins = [0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95]
    let totalError = 0

    for (const bin of bins) {
      const inBin = predictions.map((p, i) => ({ pred: p, label: labels[i] }))
        .filter(({ pred }) => pred >= bin && pred < bin + 0.05)

      if (inBin.length === 0) continue

      const actualRate = inBin.filter(({ label }) => label === 1).length / inBin.length
      const error = Math.abs(actualRate - (bin + 0.025))
      totalError += error
    }

    return totalError / bins.length
  }
}
```

**Success Criteria**:
- [ ] Evaluator calculates all metrics correctly
- [ ] Metrics match expected ranges (>65% precision, >40% recall, >0.72 AUC)
- [ ] Confusion matrix sums to total test examples

---

#### 🔴 Task 3.4: Create Evaluation Script
- [ ] **File to Create**: `scripts/ml/evaluate-model.ts`
- [ ] **Purpose**: Run model evaluation and generate performance report
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 3.3

**Script Template**:
```typescript
// scripts/ml/evaluate-model.ts

import { ModelEvaluator } from '../app/services/ml/early-signal/ModelEvaluator'
import { FeatureNormalizer } from '../app/services/ml/early-signal/FeatureNormalizer'
import lgb from 'lightgbm3'
import { loadCSV } from './utils'
import * as fs from 'fs'

async function evaluateModel() {
  // Load model
  console.log('Loading model...')
  const model = await lgb.loadModel('models/early-signal/v1.0.0/model.txt')

  // Load feature metadata
  const metadata = JSON.parse(
    await fs.promises.readFile('models/early-signal/v1.0.0/feature_metadata.json', 'utf-8')
  )

  // Load normalizer
  const normalizer = new FeatureNormalizer()
  normalizer.loadParams(metadata.normalization_params)

  // Load test data
  console.log('Loading test data...')
  const testData = await loadCSV('data/training/test.csv')

  // Evaluate
  const evaluator = new ModelEvaluator()
  const metrics = evaluator.evaluateModel(model, testData, normalizer, 0.65)

  // Print report
  console.log('\nModel Performance Report')
  console.log('========================')
  console.log(`AUC: ${(metrics.auc * 100).toFixed(1)}%`)
  console.log(`Precision @ 65%: ${(metrics.precision_at_65 * 100).toFixed(1)}%`)
  console.log(`Recall @ 65%: ${(metrics.recall_at_65 * 100).toFixed(1)}%`)
  console.log(`F1 Score @ 65%: ${(metrics.f1_at_65 * 100).toFixed(1)}%`)
  console.log(`\nConfusion Matrix:`)
  console.log(`  True Positives: ${metrics.confusion_matrix.true_positives}`)
  console.log(`  False Positives: ${metrics.confusion_matrix.false_positives}`)
  console.log(`  True Negatives: ${metrics.confusion_matrix.true_negatives}`)
  console.log(`  False Negatives: ${metrics.confusion_matrix.false_negatives}`)
  console.log(`\nCalibration Error: ${(metrics.calibration_error * 100).toFixed(1)}%`)

  console.log(`\nTop 5 Feature Importance:`)
  const sortedFeatures = Object.entries(metrics.feature_importance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  for (const [feature, importance] of sortedFeatures) {
    console.log(`  ${feature}: ${(importance * 100).toFixed(1)}%`)
  }

  // Save report
  await fs.promises.writeFile(
    'models/early-signal/v1.0.0/performance_metrics.json',
    JSON.stringify(metrics, null, 2)
  )

  console.log('\nPerformance report saved to models/early-signal/v1.0.0/performance_metrics.json')
}

evaluateModel().catch(console.error)
```

**Success Criteria**:
- [ ] Evaluation completes without errors
- [ ] Performance metrics meet targets:
  - Precision @ 65%: >65%
  - Recall @ 65%: >40%
  - AUC: >0.72
- [ ] Feature importance makes intuitive sense (price momentum, sentiment should be top features)
- [ ] Performance report saved to disk

**Run Evaluation**:
```bash
node scripts/ml/evaluate-model.ts
```

---

### Day 6 Morning: Hyperparameter Tuning

#### ⭐ Task 3.5: Implement Grid Search (Optional)
- [ ] **File to Create**: `scripts/ml/hyperparameter-tuning.ts`
- [ ] **Purpose**: Find optimal hyperparameters via grid search
- [ ] **Estimated Time**: 2 hours (manual) + 4-6 hours (computation)
- [ ] **Dependencies**: Task 3.2

**Grid Search Parameters**:
```typescript
const paramGrid = {
  learning_rate: [0.01, 0.05, 0.1],
  num_leaves: [15, 31, 63],
  max_depth: [4, 6, 8]
}

// Total combinations: 3 × 3 × 3 = 27 models to train
```

**Success Criteria**:
- [ ] Grid search completes without errors
- [ ] Best parameters identified based on validation precision
- [ ] Retrain model with best parameters
- [ ] Document parameter selection rationale

**Note**: This task is optional - default parameters should achieve >65% precision. Only tune if initial model underperforms.

---

#### Task 3.6: Feature Importance Analysis
- [ ] **File to Create**: `scripts/ml/analyze-feature-importance.ts`
- [ ] **Purpose**: Understand which features drive predictions
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 3.4

**Analysis Steps**:
1. Load trained model
2. Extract feature importance scores
3. Visualize importance (console output)
4. Verify top features make intuitive sense
5. Document insights

**Expected Top Features**:
- Price momentum (10d, 20d) - should be top 2-3
- Sentiment delta (news, Reddit) - should be top 5
- Analyst coverage change - should be top 10
- Volume features - should contribute

**Success Criteria**:
- [ ] Feature importance extracted correctly
- [ ] Top 5 features make intuitive sense
- [ ] No single feature dominates (max importance <40%)
- [ ] Insights documented

---

### Day 6 Afternoon: Model Persistence & Validation

#### 🔴 Task 3.7: Save Model Artifacts
- [ ] **Files to Create**: Model artifacts in `models/early-signal/v1.0.0/`
- [ ] **Purpose**: Persist model and metadata for production use
- [ ] **Estimated Time**: 30 minutes
- [ ] **Dependencies**: Tasks 3.2, 3.4

**Artifacts to Save**:
1. **model.txt** - LightGBM model in text format (5-10MB)
2. **feature_metadata.json** - Feature names, normalization params
3. **training_config.json** - Hyperparameters used for training
4. **performance_metrics.json** - Test set performance
5. **README.md** - Model documentation

**Model Documentation Template**:
```markdown
# Early Signal Model v1.0.0

**Trained**: 2025-10-01
**Model Type**: LightGBM Binary Classifier
**Purpose**: Predict analyst rating upgrades 2 weeks ahead

## Performance Metrics (Test Set)
- **Precision @ 65%**: 68.5%
- **Recall @ 65%**: 42.3%
- **AUC**: 0.74
- **F1 Score**: 0.52

## Training Data
- **Examples**: 375,000 (500 symbols × 750 days)
- **Training Set**: 2022-01-01 to 2024-06-30
- **Validation Set**: 2024-07-01 to 2024-09-30
- **Test Set**: 2024-10-01 to 2024-12-31
- **Label Balance**: 12.5% upgrades, 87.5% no upgrades

## Features (13 total)
1. price_change_10d (importance: 28%)
2. sentiment_news_delta (importance: 19%)
3. analyst_coverage_change (importance: 15%)
4. volume_ratio (importance: 12%)
5. ...

## Usage
```typescript
const model = await lgb.loadModel('models/early-signal/v1.0.0/model.txt')
const prediction = await model.predict([normalizedFeatures])
```
```

**Success Criteria**:
- [ ] All artifacts saved to correct directory
- [ ] Model can be loaded and used for inference
- [ ] Documentation complete and accurate

---

#### 🔴 Task 3.8: Test Model Loading & Inference
- [ ] **File to Create**: `scripts/ml/test-model-inference.ts`
- [ ] **Purpose**: Verify saved model works for inference
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 3.7

**Test Script**:
```typescript
// scripts/ml/test-model-inference.ts

import lgb from 'lightgbm3'
import { FeatureNormalizer } from '../app/services/ml/early-signal/FeatureNormalizer'
import { EarlySignalFeatureExtractor } from '../app/services/ml/early-signal/FeatureExtractor'
import * as fs from 'fs'

async function testInference() {
  console.log('Testing model inference...')

  // Load model
  const model = await lgb.loadModel('models/early-signal/v1.0.0/model.txt')
  console.log('✓ Model loaded')

  // Load metadata
  const metadata = JSON.parse(
    await fs.promises.readFile('models/early-signal/v1.0.0/feature_metadata.json', 'utf-8')
  )
  console.log('✓ Metadata loaded')

  // Load normalizer
  const normalizer = new FeatureNormalizer()
  normalizer.loadParams(metadata.normalization_params)
  console.log('✓ Normalizer loaded')

  // Extract features for test symbol
  const extractor = new EarlySignalFeatureExtractor()
  const features = await extractor.extractFeatures('TSLA')
  console.log('✓ Features extracted')

  // Normalize features
  const normalized = normalizer.transform(features)
  console.log('✓ Features normalized')

  // Predict
  const startTime = Date.now()
  const probability = await model.predict([normalized])[0]
  const latency = Date.now() - startTime

  console.log('\nPrediction Results:')
  console.log(`Symbol: TSLA`)
  console.log(`Upgrade Probability: ${(probability * 100).toFixed(1)}%`)
  console.log(`Upgrade Likely: ${probability > 0.65 ? 'YES' : 'NO'}`)
  console.log(`Inference Latency: ${latency}ms`)

  if (latency > 100) {
    console.warn('⚠️  WARNING: Inference latency exceeds 100ms target')
  } else {
    console.log('✓ Inference latency within target')
  }
}

testInference().catch(console.error)
```

**Success Criteria**:
- [ ] Model loads without errors
- [ ] Can generate predictions for test symbols
- [ ] Inference latency <100ms
- [ ] Predictions are reasonable (0.0-1.0 range)

---

#### Task 3.9: Create Unit Tests for Model Components
- [ ] **File to Create**: `app/services/ml/early-signal/__tests__/ModelTrainer.test.ts`
- [ ] **File to Create**: `app/services/ml/early-signal/__tests__/ModelEvaluator.test.ts`
- [ ] **Purpose**: Unit tests for model training and evaluation
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Tasks 3.1, 3.3

**Success Criteria**:
- [ ] All tests passing
- [ ] Tests use real data (NO MOCK DATA)
- [ ] Tests complete in reasonable time

---

### Phase 3 Validation Gate

**Before proceeding to Phase 4, verify:**
- [ ] Model trained successfully (model.txt saved)
- [ ] Performance metrics meet targets:
  - Precision @ 65%: >65% ✅
  - Recall @ 65%: >40% ✅
  - AUC: >0.72 ✅
- [ ] Feature importance makes intuitive sense
- [ ] Model artifacts saved and documented
- [ ] Can load model and run inference (<100ms latency)
- [ ] Unit tests passing
- [ ] No data leakage detected (validation confirms)

**If validation fails**: Debug issues, retrain model, or adjust hyperparameters before proceeding.

---

## Phase 4: API Integration (Days 7-8)

**Objective**: Integrate early signal predictions into VFR `/api/stocks/select` endpoint

**Expected Duration**: 1.5 days (12 hours)
**Deliverables**: `EarlySignalService`, updated API endpoint, integration tests
**Success Criteria**: API returns early_signal field with <100ms additional latency

---

### Day 7 Morning: Early Signal Service Implementation

#### 🔴 Task 4.1: Create Early Signal Service
- [ ] **File to Create**: `app/services/ml/early-signal/EarlySignalService.ts`
- [ ] **Purpose**: Production service for generating early signal predictions
- [ ] **Estimated Time**: 3 hours
- [ ] **Dependencies**: Phase 3 complete

**Implementation Steps**:
1. Load model on service initialization (singleton pattern)
2. Integrate with FeatureExtractor and FeatureNormalizer
3. Implement prediction logic with caching
4. Generate reasoning from feature importance
5. Handle errors gracefully

**Code Template**:
```typescript
// app/services/ml/early-signal/EarlySignalService.ts

import lgb from 'lightgbm3'
import { EarlySignalFeatureExtractor } from './FeatureExtractor'
import { FeatureNormalizer } from './FeatureNormalizer'
import { RedisCache } from '../../cache/RedisCache'
import type { EarlySignalPrediction, FeatureVector } from './types'
import * as fs from 'fs'
import * as path from 'path'

export class EarlySignalService {
  private static modelInstance: any = null
  private static modelVersion: string = 'v1.0.0'

  private featureExtractor: EarlySignalFeatureExtractor
  private normalizer: FeatureNormalizer
  private cache: RedisCache

  constructor() {
    this.featureExtractor = new EarlySignalFeatureExtractor()
    this.normalizer = new FeatureNormalizer()
    this.cache = new RedisCache()
  }

  /**
   * Predict analyst rating change 2 weeks ahead
   * @param symbol Stock symbol
   * @param sector Stock sector (for sentiment analysis)
   * @returns Early signal prediction with confidence and reasoning
   */
  async predictAnalystChange(symbol: string, sector: string): Promise<EarlySignalPrediction | null> {
    try {
      // Check cache first (5min TTL)
      const cacheKey = `early_signal:${symbol}:${this.getTodayDateKey()}`
      const cached = await this.cache.get(cacheKey)

      if (cached) {
        console.log(`✅ Early signal cache hit for ${symbol}`)
        return JSON.parse(cached)
      }

      console.log(`🔮 Early signal cache miss for ${symbol}, predicting...`)

      // Load model (singleton, cached after first load)
      if (!EarlySignalService.modelInstance) {
        await this.loadModel()
      }

      // Extract features
      const features = await this.featureExtractor.extractFeatures(symbol)

      // Normalize features
      const normalizedFeatures = this.normalizer.transform(features)

      // Predict probability of upgrade
      const probability = await EarlySignalService.modelInstance.predict([normalizedFeatures])[0]

      // Only return prediction if confidence > 0.65 (high confidence)
      if (probability < 0.65 && probability > 0.35) {
        console.log(`Neutral prediction for ${symbol} (confidence: ${(probability * 100).toFixed(1)}%), skipping`)
        return null
      }

      // Generate reasoning from top features
      const featureImportance = EarlySignalService.modelInstance.getFeatureImportance()
      const reasoning = this.generateReasoning(features, featureImportance)

      const prediction: EarlySignalPrediction = {
        upgrade_likely: probability > 0.65,
        downgrade_likely: false, // Phase 2 feature
        confidence: probability,
        horizon: '2_weeks',
        reasoning,
        feature_importance: featureImportance,
        prediction_timestamp: Date.now(),
        model_version: EarlySignalService.modelVersion
      }

      // Cache for 5 minutes
      await this.cache.set(cacheKey, JSON.stringify(prediction), 300)

      return prediction
    } catch (error) {
      console.error(`Early signal prediction failed for ${symbol}:`, error)
      return null // Graceful degradation
    }
  }

  /**
   * Load model from disk (singleton pattern)
   */
  private async loadModel(): Promise<void> {
    const modelPath = path.join(__dirname, '../../../models/early-signal', EarlySignalService.modelVersion, 'model.txt')
    const metadataPath = path.join(__dirname, '../../../models/early-signal', EarlySignalService.modelVersion, 'feature_metadata.json')

    console.log(`Loading early signal model v${EarlySignalService.modelVersion}...`)

    // Load model
    EarlySignalService.modelInstance = await lgb.loadModel(modelPath)

    // Load normalizer parameters
    const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'))
    this.normalizer.loadParams(metadata.normalization_params)

    console.log(`✅ Early signal model v${EarlySignalService.modelVersion} loaded`)
  }

  /**
   * Generate human-readable reasoning from feature importance
   */
  private generateReasoning(features: FeatureVector, importance: Record<string, number>): string[] {
    // Get top 3 features by importance
    const topFeatures = Object.entries(importance)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    return topFeatures.map(([feature, imp]) => {
      const value = features[feature]
      return this.describeFeature(feature, value, imp)
    })
  }

  /**
   * Convert feature name and value to human-readable description
   */
  private describeFeature(feature: string, value: number, importance: number): string {
    const descriptions: Record<string, (v: number) => string> = {
      'price_change_10d': (v) => `Price momentum ${v > 0 ? 'accelerating' : 'decelerating'} (${(v * 100).toFixed(1)}% over 10 days)`,
      'price_change_20d': (v) => `20-day price trend ${v > 0 ? 'positive' : 'negative'} (${(v * 100).toFixed(1)}%)`,
      'sentiment_news_delta': (v) => `News sentiment ${v > 0 ? 'improving' : 'declining'} (+${v.toFixed(2)} delta)`,
      'sentiment_reddit_accel': (v) => `Reddit sentiment ${v > 0 ? 'accelerating' : 'declining'} (${v.toFixed(2)} change)`,
      'analyst_coverage_change': (v) => `Analyst coverage ${v > 0 ? 'increased' : 'decreased'} (${v > 0 ? '+' : ''}${v} analysts)`,
      'volume_ratio': (v) => `Volume ${v > 1 ? 'above' : 'below'} average (${v.toFixed(2)}x ratio)`,
      'rsi_momentum': (v) => `RSI momentum ${v > 0 ? 'strengthening' : 'weakening'} (${v > 0 ? '+' : ''}${v.toFixed(1)})`,
      'earnings_surprise': (v) => `Earnings ${v > 0 ? 'beat' : 'missed'} expectations (${(v * 100).toFixed(1)}% surprise)`,
      // Add more descriptions as needed
    }

    return descriptions[feature] ? descriptions[feature](value) : `${feature}: ${value.toFixed(2)}`
  }

  private getTodayDateKey(): string {
    return new Date().toISOString().split('T')[0] // YYYY-MM-DD
  }
}
```

**Success Criteria**:
- [ ] Service initializes without errors
- [ ] Model loads on first prediction (singleton pattern)
- [ ] Can generate predictions for test symbols
- [ ] Caching works (5min TTL)
- [ ] Reasoning is human-readable
- [ ] Graceful degradation on errors

---

#### Task 4.2: Create Service Unit Tests
- [ ] **File to Create**: `app/services/ml/early-signal/__tests__/EarlySignalService.test.ts`
- [ ] **Purpose**: Unit tests for EarlySignalService
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Task 4.1

**Test Cases**:
```typescript
describe('EarlySignalService', () => {
  it('should load model on initialization', async () => {
    const service = new EarlySignalService()
    const prediction = await service.predictAnalystChange('TSLA', 'Technology')
    expect(prediction).toBeDefined()
  })

  it('should return null for low confidence predictions', async () => {
    const service = new EarlySignalService()
    // Mock scenario where model returns 0.5 confidence (neutral)
    const prediction = await service.predictAnalystChange('LOW_CONFIDENCE_SYMBOL', 'Technology')
    expect(prediction).toBeNull()
  })

  it('should cache predictions', async () => {
    const service = new EarlySignalService()

    // First call (cache miss)
    const start1 = Date.now()
    await service.predictAnalystChange('TSLA', 'Technology')
    const latency1 = Date.now() - start1

    // Second call (cache hit)
    const start2 = Date.now()
    await service.predictAnalystChange('TSLA', 'Technology')
    const latency2 = Date.now() - start2

    expect(latency2).toBeLessThan(latency1 * 0.1) // Cache should be 10x faster
  })

  it('should complete in <100ms with cache hit', async () => {
    const service = new EarlySignalService()

    // Warm up cache
    await service.predictAnalystChange('TSLA', 'Technology')

    // Test latency
    const start = Date.now()
    await service.predictAnalystChange('TSLA', 'Technology')
    const latency = Date.now() - start

    expect(latency).toBeLessThan(100)
  })
})
```

**Success Criteria**:
- [ ] All tests passing
- [ ] Tests use real model (NO MOCK DATA)
- [ ] Latency tests confirm <100ms with cache

---

### Day 7 Afternoon: API Endpoint Integration

#### 🔴 Task 4.3: Extend `/api/stocks/select` Endpoint
- [ ] **File to Modify**: `app/api/stocks/select/route.ts`
- [ ] **Purpose**: Add early_signal field to API response
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Task 4.1

**Implementation Steps**:
1. Add `include_early_signal` parameter to request schema
2. Lazy-load EarlySignalService when needed
3. Call service in parallel with existing analysis
4. Attach `early_signal` field to response (optional)
5. Track latency in metadata

**Code Changes**:
```typescript
// app/api/stocks/select/route.ts

// Add to request schema
interface StockSelectionRequest {
  mode: 'single' | 'multi' | 'watchlist'
  symbols?: string[]
  include_early_signal?: boolean // NEW: Optional early signal flag
  // ... existing fields
}

// Add to response schema
interface StockSelectionResponse {
  success: boolean
  data: {
    stocks: Array<{
      symbol: string
      recommendation: string
      compositeScore: number
      // ... existing fields
      early_signal?: EarlySignalPrediction // NEW: Optional early signal
    }>
    metadata: {
      // ... existing fields
      early_signal_enabled?: boolean // NEW
      early_signal_latency_ms?: number // NEW
    }
  }
}

// In route handler
export async function POST(request: Request) {
  const body = await request.json()
  const { mode, symbols, include_early_signal = false } = body

  // ... existing analysis logic (Steps 1-3)

  // Step 4: Optional Early Signal Prediction
  if (include_early_signal) {
    console.log(`🔮 Step 4: Early signal prediction requested`)
    const signalStartTime = Date.now()

    // Lazy-load early signal service
    const { EarlySignalService } = await import('../../services/ml/early-signal/EarlySignalService')
    const earlySignalService = new EarlySignalService()

    // Predict for each stock in parallel
    const signalPromises = enhancedStocks.map(async (stock) => {
      try {
        const prediction = await earlySignalService.predictAnalystChange(stock.symbol, stock.sector)

        // Only attach if confidence > threshold (prediction is non-null)
        if (prediction) {
          stock.early_signal = prediction
        }
      } catch (error) {
        console.warn(`Early signal prediction failed for ${stock.symbol}:`, error)
        // Graceful degradation - no early_signal field if prediction fails
      }
    })

    await Promise.all(signalPromises)
    const signalLatency = Date.now() - signalStartTime

    // Add latency to metadata
    response.data.metadata.early_signal_enabled = true
    response.data.metadata.early_signal_latency_ms = signalLatency

    console.log(`✅ Early signal predictions completed in ${signalLatency}ms`)
  }

  return NextResponse.json(response)
}
```

**Success Criteria**:
- [ ] API accepts `include_early_signal` parameter
- [ ] API returns `early_signal` field when requested
- [ ] API response is backward compatible (existing clients unaffected)
- [ ] Latency increase <100ms
- [ ] Graceful degradation on errors (no user-facing errors)

---

#### Task 4.4: Update API Response Types
- [ ] **File to Modify**: `app/api/stocks/select/types.ts` (or equivalent)
- [ ] **Purpose**: Add TypeScript types for early signal
- [ ] **Estimated Time**: 30 minutes
- [ ] **Dependencies**: Task 4.3

**Type Additions**:
```typescript
// Add to existing types
export interface StockAnalysis {
  symbol: string
  recommendation: string
  compositeScore: number
  // ... existing fields
  early_signal?: EarlySignalPrediction // NEW
}

export interface StockSelectionMetadata {
  mode: string
  count: number
  timestamp: number
  // ... existing fields
  early_signal_enabled?: boolean // NEW
  early_signal_latency_ms?: number // NEW
}
```

**Success Criteria**:
- [ ] Types compile without errors
- [ ] Types match implementation

---

### Day 8 Morning: Integration Testing

#### 🔴 Task 4.5: Create Integration Tests
- [ ] **File to Create**: `app/api/stocks/select/__tests__/early-signal.test.ts`
- [ ] **Purpose**: Test early signal integration end-to-end
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Task 4.3

**Test Cases**:
```typescript
describe('API Early Signal Integration', () => {
  it('should return early_signal when include_early_signal is true', async () => {
    const response = await POST({
      mode: 'single',
      symbols: ['TSLA'],
      include_early_signal: true
    })

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.stocks[0].early_signal).toBeDefined()
    expect(data.data.metadata.early_signal_enabled).toBe(true)
  })

  it('should NOT return early_signal when include_early_signal is false', async () => {
    const response = await POST({
      mode: 'single',
      symbols: ['TSLA'],
      include_early_signal: false
    })

    const data = await response.json()
    expect(data.data.stocks[0].early_signal).toBeUndefined()
  })

  it('should add <100ms latency with early signal', async () => {
    // Baseline latency without early signal
    const start1 = Date.now()
    await POST({
      mode: 'single',
      symbols: ['TSLA'],
      include_early_signal: false
    })
    const baselineLatency = Date.now() - start1

    // Latency with early signal
    const start2 = Date.now()
    const response = await POST({
      mode: 'single',
      symbols: ['TSLA'],
      include_early_signal: true
    })
    const withSignalLatency = Date.now() - start2

    const data = await response.json()
    const signalLatency = data.data.metadata.early_signal_latency_ms

    expect(signalLatency).toBeLessThan(100)
  })

  it('should handle errors gracefully', async () => {
    // Test with invalid symbol
    const response = await POST({
      mode: 'single',
      symbols: ['INVALID_SYMBOL'],
      include_early_signal: true
    })

    const data = await response.json()
    expect(data.success).toBe(true) // Should not break API
    expect(data.data.stocks[0].early_signal).toBeUndefined() // No prediction if error
  })
})
```

**Success Criteria**:
- [ ] All integration tests passing
- [ ] Tests use real API calls (NO MOCK DATA)
- [ ] Tests verify backward compatibility

---

#### Task 4.6: Manual API Testing
- [ ] **Testing Method**: Use Postman or curl to test API manually
- [ ] **Purpose**: Verify API works end-to-end with real data
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 4.3

**Test Scenarios**:

1. **Basic Early Signal Request**:
```bash
curl -X POST http://localhost:3000/api/stocks/select \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "single",
    "symbols": ["TSLA"],
    "include_early_signal": true
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "stocks": [{
      "symbol": "TSLA",
      "recommendation": "BUY",
      "compositeScore": 72,
      "early_signal": {
        "upgrade_likely": true,
        "confidence": 0.73,
        "horizon": "2_weeks",
        "reasoning": [
          "Price momentum accelerating (+12.3% over 10 days)",
          "News sentiment improving (+0.15 delta)",
          "Analyst coverage increased (+3 analysts)"
        ]
      }
    }],
    "metadata": {
      "early_signal_enabled": true,
      "early_signal_latency_ms": 87
    }
  }
}
```

2. **Without Early Signal (Backward Compatibility)**:
```bash
curl -X POST http://localhost:3000/api/stocks/select \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "single",
    "symbols": ["TSLA"]
  }'
```

Expected: No `early_signal` field in response.

3. **Multiple Symbols**:
```bash
curl -X POST http://localhost:3000/api/stocks/select \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "multi",
    "symbols": ["TSLA", "NVDA", "AAPL"],
    "include_early_signal": true
  }'
```

Expected: Each stock has optional `early_signal` field.

**Success Criteria**:
- [ ] All test scenarios work as expected
- [ ] API responses are well-formed JSON
- [ ] Latency is acceptable (<3s total)
- [ ] Error handling works (invalid symbols don't break API)

---

### Day 8 Afternoon: Documentation & Finalization

#### Task 4.7: Update API Documentation
- [ ] **File to Modify**: API documentation (README or OpenAPI spec)
- [ ] **Purpose**: Document new `include_early_signal` parameter
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 4.3

**Documentation Sections**:

1. **Request Parameters**:
```markdown
### POST /api/stocks/select

**Request Body**:
- `mode` (required): Analysis mode ('single' | 'multi' | 'watchlist')
- `symbols` (optional): Array of stock symbols
- `include_early_signal` (optional, default: false): Enable ML-powered early signal detection
```

2. **Response Schema**:
```markdown
**Response Fields**:
- `early_signal` (optional): ML prediction of analyst rating change 2 weeks ahead
  - `upgrade_likely`: True if upgrade probability > 65%
  - `confidence`: Probability score (0.0-1.0)
  - `horizon`: Prediction timeframe (always '2_weeks')
  - `reasoning`: Top 3 feature contributions (human-readable)
  - `feature_importance`: Feature importance scores
  - `prediction_timestamp`: Unix timestamp
  - `model_version`: Model version (e.g., 'v1.0.0')
```

3. **Example**:
```markdown
**Example Request**:
```json
{
  "mode": "single",
  "symbols": ["TSLA"],
  "include_early_signal": true
}
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "stocks": [{
      "symbol": "TSLA",
      "recommendation": "BUY",
      "early_signal": {
        "upgrade_likely": true,
        "confidence": 0.73,
        "reasoning": ["Price momentum accelerating...", ...]
      }
    }]
  }
}
```
```

**Success Criteria**:
- [ ] API documentation updated
- [ ] Examples are accurate and tested
- [ ] Documentation is clear and actionable

---

#### Task 4.8: Create User-Facing Documentation
- [ ] **File to Create**: `docs/analysis-engine/machine-learning/early-signal-guide.md`
- [ ] **Purpose**: User guide explaining early signals
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 4.7

**Documentation Sections**:

1. **What are Early Signals?**
2. **How It Works** (simplified ML explanation)
3. **Interpreting Predictions** (confidence levels, reasoning)
4. **Use Cases** (when to act on signals)
5. **Limitations** (not financial advice, accuracy expectations)

**Success Criteria**:
- [ ] Documentation is user-friendly (non-technical language)
- [ ] Covers all key concepts
- [ ] Includes real examples

---

#### Task 4.9: Code Review Preparation
- [ ] **Purpose**: Prepare code for review
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: All Phase 4 tasks

**Checklist**:
- [ ] Code follows VFR style guidelines
- [ ] All console.log statements appropriate (not excessive)
- [ ] Error handling is comprehensive
- [ ] TypeScript types are correct
- [ ] No hardcoded values (use constants)
- [ ] Comments explain complex logic
- [ ] No dead code or TODOs

---

### Phase 4 Validation Gate

**Before proceeding to Phase 5, verify:**
- [ ] API accepts `include_early_signal` parameter
- [ ] API returns `early_signal` field correctly
- [ ] API is backward compatible (existing clients work)
- [ ] Latency target met (<100ms additional overhead)
- [ ] Integration tests passing
- [ ] Manual testing successful (Postman/curl)
- [ ] Documentation updated
- [ ] Code ready for review

---

## Phase 5: Monitoring & Production Deployment (Days 9-10)

**Objective**: Set up production monitoring, logging, and deploy with feature flag

**Expected Duration**: 1.5 days (12 hours)
**Deliverables**: Monitoring dashboard, validation script, production deployment
**Success Criteria**: Production deployment successful, monitoring active, zero incidents

---

### Day 9 Morning: Prediction Logging

#### Task 5.1: Create Prediction Logging Infrastructure
- [ ] **File to Modify**: `app/services/ml/early-signal/EarlySignalService.ts`
- [ ] **Purpose**: Log all predictions for accuracy tracking
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Phase 4 complete

**Implementation Steps**:
1. Create `prediction_logs` table in PostgreSQL (optional)
2. Add logging to EarlySignalService.predictAnalystChange()
3. Log prediction details (symbol, confidence, features, timestamp)
4. Add async logging (don't block prediction)

**Database Schema** (optional):
```sql
CREATE TABLE ml_prediction_logs (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  prediction_date TIMESTAMP NOT NULL,
  upgrade_likely BOOLEAN NOT NULL,
  confidence DECIMAL(5, 4) NOT NULL,
  features JSONB NOT NULL,
  feature_importance JSONB NOT NULL,
  model_version VARCHAR(20) NOT NULL,
  actual_outcome BOOLEAN NULL,  -- Filled in 2 weeks later
  actual_rating_change DECIMAL(5, 4) NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_prediction_symbol_date ON ml_prediction_logs(symbol, prediction_date);
CREATE INDEX idx_prediction_date ON ml_prediction_logs(prediction_date);
```

**Logging Code**:
```typescript
// In EarlySignalService.predictAnalystChange()
async logPrediction(prediction: EarlySignalPrediction, symbol: string): Promise<void> {
  try {
    // Async logging (don't await)
    this.db.insert('ml_prediction_logs', {
      symbol,
      prediction_date: new Date(),
      upgrade_likely: prediction.upgrade_likely,
      confidence: prediction.confidence,
      features: prediction.feature_importance,
      model_version: prediction.model_version
    }).catch(err => console.error('Failed to log prediction:', err))
  } catch (error) {
    // Silent fail - don't break predictions
    console.error('Prediction logging error:', error)
  }
}
```

**Success Criteria**:
- [ ] Prediction logs saved to database (if using PostgreSQL)
- [ ] Logging doesn't add latency (<5ms)
- [ ] Logging failures don't break predictions

---

#### Task 5.2: Create Accuracy Validation Script
- [ ] **File to Create**: `scripts/ml/validate-predictions.ts`
- [ ] **Purpose**: Validate predictions from 2 weeks ago against actual outcomes
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Task 5.1

**Script Logic**:
1. Query predictions from 14 days ago
2. Fetch current analyst ratings for those symbols
3. Compare predicted vs actual outcomes
4. Update prediction_logs with actual outcomes
5. Calculate accuracy metrics (precision, recall)

**Code Template**:
```typescript
// scripts/ml/validate-predictions.ts

import { FinancialModelingPrepAPI } from '../app/services/financial-data/FinancialModelingPrepAPI'
import { calculateRatingChange } from './label-generator'

async function validatePredictions() {
  console.log('Validating predictions from 2 weeks ago...')

  // Get predictions from 14 days ago
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const predictions = await db.query(`
    SELECT * FROM ml_prediction_logs
    WHERE prediction_date::date = $1 AND actual_outcome IS NULL
  `, [twoWeeksAgo.toISOString().split('T')[0]])

  console.log(`Found ${predictions.length} predictions to validate`)

  const fmpAPI = new FinancialModelingPrepAPI()
  let correct = 0
  let total = 0

  for (const pred of predictions) {
    try {
      // Fetch analyst ratings at prediction time and now
      const oldRatings = await fmpAPI.getAnalystRatings(pred.symbol, pred.prediction_date)
      const newRatings = await fmpAPI.getAnalystRatings(pred.symbol, new Date())

      // Calculate actual outcome
      const actualUpgrade = calculateRatingChange(oldRatings, newRatings) === 1

      // Update log
      await db.update('ml_prediction_logs', pred.id, {
        actual_outcome: actualUpgrade,
        actual_rating_change: calculateConsensusChange(oldRatings, newRatings)
      })

      // Track accuracy
      if (pred.upgrade_likely === actualUpgrade) {
        correct++
      }
      total++

      console.log(`${pred.symbol}: Predicted ${pred.upgrade_likely ? 'UPGRADE' : 'NO UPGRADE'}, Actual ${actualUpgrade ? 'UPGRADE' : 'NO UPGRADE'} ${pred.upgrade_likely === actualUpgrade ? '✓' : '✗'}`)
    } catch (error) {
      console.error(`Failed to validate ${pred.symbol}:`, error)
      continue
    }
  }

  const accuracy = total > 0 ? (correct / total * 100) : 0
  console.log(`\nValidation Complete: ${correct}/${total} correct (${accuracy.toFixed(1)}% accuracy)`)

  // Alert if accuracy below threshold
  if (accuracy < 60) {
    console.error('⚠️  WARNING: Model accuracy below 60% threshold!')
    // Send alert to engineering team
  }
}

// Run validation
validatePredictions().catch(console.error)
```

**Success Criteria**:
- [ ] Script runs without errors
- [ ] Predictions validated against actual outcomes
- [ ] Accuracy calculated correctly
- [ ] Alerts trigger if accuracy drops

**Set Up Cron Job** (weekly validation):
```bash
# Run every Monday at 2 AM
0 2 * * 1 node /path/to/scripts/ml/validate-predictions.ts
```

---

### Day 9 Afternoon: Monitoring Dashboard

#### Task 5.3: Add Early Signal Metrics to Admin Panel
- [ ] **File to Modify**: Admin panel (e.g., `app/admin/page.tsx`)
- [ ] **Purpose**: Display real-time early signal metrics
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Task 5.1

**Metrics to Display**:

1. **Performance Metrics** (updated weekly):
   - Precision @ 65% (rolling 30d)
   - Recall @ 65% (rolling 30d)
   - AUC (rolling 30d)
   - F1 Score (rolling 30d)

2. **Usage Metrics** (real-time):
   - Total predictions today
   - Cache hit rate
   - Adoption rate (% of API calls with early_signal)

3. **Reliability Metrics** (24h):
   - Uptime %
   - Error rate %
   - Latency (p50, p95, p99)

4. **Model Metadata**:
   - Current model version
   - Last training date
   - Next retraining date

**API Endpoint**:
```typescript
// app/api/admin/early-signal-metrics/route.ts

export async function GET(request: Request) {
  const metrics = {
    performance: {
      precision_30d: await calculatePrecision30d(),
      recall_30d: await calculateRecall30d(),
      auc_30d: await calculateAUC30d(),
      f1_30d: await calculateF130d()
    },
    usage: {
      predictions_today: await countPredictionsToday(),
      cache_hit_rate: await calculateCacheHitRate(),
      adoption_rate: await calculateAdoptionRate()
    },
    reliability: {
      uptime_24h: await calculateUptime24h(),
      error_rate_24h: await calculateErrorRate24h(),
      latency_p50: await calculateLatencyP50(),
      latency_p95: await calculateLatencyP95(),
      latency_p99: await calculateLatencyP99()
    },
    metadata: {
      model_version: 'v1.0.0',
      last_train_date: '2025-10-01',
      next_train_date: '2025-10-08'
    }
  }

  return NextResponse.json(metrics)
}
```

**Success Criteria**:
- [ ] Admin panel displays early signal metrics
- [ ] Metrics update in real-time
- [ ] Metrics are accurate

---

#### Task 5.4: Configure Alert Thresholds
- [ ] **File to Create**: `scripts/ml/monitor-early-signal.ts`
- [ ] **Purpose**: Monitor metrics and send alerts
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 5.3

**Alert Conditions**:
```yaml
alerts:
  - name: "Low Accuracy"
    condition: precision_30d < 0.60
    action: Email engineering team
    severity: HIGH

  - name: "High Latency"
    condition: latency_p95 > 150ms
    action: Slack notification
    severity: MEDIUM

  - name: "Low Uptime"
    condition: uptime_24h < 0.95
    action: Page on-call engineer
    severity: CRITICAL

  - name: "High False Positives"
    condition: false_positive_rate > 0.15
    action: Review model calibration
    severity: MEDIUM
```

**Success Criteria**:
- [ ] Alerts configured
- [ ] Alert notifications working (email/Slack)
- [ ] Alert thresholds appropriate

---

### Day 10: Production Deployment

#### 🔴 Task 5.5: Feature Flag Implementation
- [ ] **File to Create**: Feature flag configuration
- [ ] **Purpose**: Enable/disable early signals without code changes
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Phase 4 complete

**Feature Flag Options**:

**Option 1: Environment Variable**
```typescript
// .env
EARLY_SIGNAL_ENABLED=true

// In API route
const earlySignalEnabled = process.env.EARLY_SIGNAL_ENABLED === 'true'
if (include_early_signal && earlySignalEnabled) {
  // Run early signal prediction
}
```

**Option 2: Database Flag**
```sql
CREATE TABLE feature_flags (
  feature_name VARCHAR(50) PRIMARY KEY,
  enabled BOOLEAN NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO feature_flags (feature_name, enabled) VALUES ('early_signal', true);
```

**Success Criteria**:
- [ ] Feature flag controls early signal availability
- [ ] Can enable/disable without code deployment
- [ ] Flag persists across server restarts

---

#### 🔴 Task 5.6: Staging Deployment
- [ ] **Purpose**: Deploy to staging environment for final testing
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: All Phase 5 tasks

**Deployment Steps**:
1. Push code to staging branch
2. Deploy to staging server
3. Run smoke tests
4. Verify monitoring dashboard
5. Test with production-like data

**Smoke Test Checklist**:
- [ ] API health check passes
- [ ] Early signal predictions work
- [ ] Latency acceptable
- [ ] Cache working
- [ ] Logs appearing in monitoring
- [ ] No errors in logs

**Success Criteria**:
- [ ] Staging deployment successful
- [ ] All smoke tests passing
- [ ] No regressions detected

---

#### 🔴 Task 5.7: Production Deployment (Canary)
- [ ] **Purpose**: Deploy to production with 10% traffic
- [ ] **Estimated Time**: 2 hours
- [ ] **Dependencies**: Task 5.6

**Canary Deployment Strategy**:
1. Deploy to production
2. Enable feature flag for 10% of users
3. Monitor metrics for 24 hours
4. Compare canary vs control group
5. Rollout to 100% if metrics look good

**Canary Configuration**:
```typescript
// Canary routing logic
const isCanaryUser = Math.random() < 0.10 // 10% of users

if (include_early_signal && isCanaryUser) {
  // Use early signal prediction
} else {
  // Standard response (no early signal)
}
```

**Monitoring During Canary**:
- [ ] Latency p95 for canary group
- [ ] Error rate for canary group
- [ ] User feedback (if available)
- [ ] Cache hit rate
- [ ] Prediction volume

**Success Criteria**:
- [ ] Canary deployment successful
- [ ] Latency increase <100ms for canary group
- [ ] Error rate unchanged
- [ ] No user complaints

---

#### Task 5.8: Full Rollout
- [ ] **Purpose**: Enable early signals for 100% of users
- [ ] **Estimated Time**: 30 minutes
- [ ] **Dependencies**: Task 5.7 (after 24h canary monitoring)

**Rollout Steps**:
1. Verify canary metrics are good
2. Increase feature flag to 100%
3. Monitor for 24 hours
4. Verify adoption rate increases

**Success Criteria**:
- [ ] Feature enabled for all users
- [ ] No increase in errors or latency
- [ ] Monitoring shows increased usage
- [ ] Zero production incidents

---

#### Task 5.9: Create Runbook for Production Issues
- [ ] **File to Create**: `docs/analysis-engine/machine-learning/early-signal-runbook.md`
- [ ] **Purpose**: Troubleshooting guide for production issues
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Phase 5 complete

**Runbook Sections**:

1. **Common Issues & Solutions**
   - Model unavailable → Check model file exists
   - High latency → Check Redis cache
   - Low accuracy → Review recent predictions, consider retraining

2. **Emergency Procedures**
   - How to disable feature flag
   - How to rollback to previous model version
   - How to clear cache

3. **Monitoring & Alerting**
   - Where to find metrics
   - How to interpret alerts
   - Escalation procedures

4. **Contact Information**
   - On-call engineer
   - ML team contact
   - API team contact

**Success Criteria**:
- [ ] Runbook is comprehensive
- [ ] Procedures are tested
- [ ] Contact information is up-to-date

---

#### Task 5.10: Post-Deployment Review
- [ ] **Purpose**: Review deployment and document lessons learned
- [ ] **Estimated Time**: 1 hour
- [ ] **Dependencies**: Task 5.8

**Review Topics**:
- What went well?
- What could be improved?
- Any unexpected issues?
- Performance vs targets
- User feedback (if available)
- Next steps (model improvements, new features)

**Success Criteria**:
- [ ] Post-deployment review conducted
- [ ] Lessons learned documented
- [ ] Action items for improvements identified

---

### Phase 5 Validation Gate

**Before marking project complete, verify:**
- [ ] Prediction logging working
- [ ] Validation script runs weekly (cron job)
- [ ] Monitoring dashboard active
- [ ] Alerts configured and tested
- [ ] Feature flag implemented
- [ ] Staging deployment successful
- [ ] Production canary successful
- [ ] Full rollout complete
- [ ] Runbook created
- [ ] Post-deployment review completed
- [ ] **ZERO PRODUCTION INCIDENTS** ✅

---

## Production Readiness Checklist

**Final checklist before marking project complete:**

### Code Quality
- [ ] All unit tests passing (>80% coverage)
- [ ] All integration tests passing
- [ ] TypeScript types correct (no `any` types)
- [ ] Code follows VFR style guidelines
- [ ] No console.log in production code (use proper logging)
- [ ] Error handling comprehensive
- [ ] No hardcoded values (use constants/config)
- [ ] Code reviewed and approved

### Performance
- [ ] Model training time <5 minutes ✅
- [ ] Inference latency <100ms (with cache) ✅
- [ ] API response time increase <100ms ✅
- [ ] Memory usage <50MB additional ✅
- [ ] Cache hit rate >85% ✅

### Accuracy
- [ ] Model precision >65% @ 0.65 threshold ✅
- [ ] Model recall >40% @ 0.65 threshold ✅
- [ ] Model AUC >0.72 ✅
- [ ] Feature importance makes intuitive sense ✅
- [ ] No data leakage detected ✅

### Documentation
- [ ] API documentation updated
- [ ] User guide created
- [ ] Model documentation complete
- [ ] Runbook created
- [ ] Architecture diagrams updated (optional)

### Monitoring & Reliability
- [ ] Prediction logging active
- [ ] Validation script running weekly
- [ ] Monitoring dashboard live
- [ ] Alerts configured and tested
- [ ] Feature flag working
- [ ] Rollback plan tested
- [ ] Zero production incidents ✅

### Security & Compliance
- [ ] API keys secured (not in code)
- [ ] Model artifacts secured
- [ ] No sensitive data logged
- [ ] OWASP compliance maintained
- [ ] Rate limiting respected

---

## Rollback Plan

**If production issues arise, follow these steps:**

### Emergency Rollback Procedure

#### Option 1: Disable Feature Flag (Fastest - <5 minutes)
```bash
# Set environment variable
export EARLY_SIGNAL_ENABLED=false

# Or update database flag
psql -U postgres -d vfr_api -c "UPDATE feature_flags SET enabled = false WHERE feature_name = 'early_signal';"

# Restart API server
npm run dev:clean
```

#### Option 2: Rollback Code Deployment (<15 minutes)
```bash
# Revert to previous commit
git revert <commit_hash>
git push origin main

# Redeploy
npm run build
npm start
```

#### Option 3: Rollback Model Version (<10 minutes)
```bash
# Update symlink to previous model
cd models/early-signal
rm current
ln -s v0.9.0 current  # Previous stable version

# Clear cache
redis-cli FLUSHDB

# Restart server
npm run dev:clean
```

### Rollback Validation
After rollback, verify:
- [ ] API health check passes
- [ ] No early_signal field in responses (feature disabled)
- [ ] Latency returned to baseline
- [ ] Error rate returned to baseline
- [ ] No user-facing errors

### Post-Rollback Actions
- [ ] Investigate root cause
- [ ] Document issue in incident report
- [ ] Fix issue in development
- [ ] Test fix thoroughly before re-deploying
- [ ] Conduct post-mortem

---

## Optional Enhancements (Post-MVP)

**Future improvements to consider after initial deployment:**

### ⭐ Enhancement 1: Downgrade Predictions
- [ ] Extend model to predict downgrades (not just upgrades)
- [ ] Add `downgrade_likely` field to API response
- [ ] Train separate binary classifier or multi-class model

### ⭐ Enhancement 2: Multiple Prediction Horizons
- [ ] Add 1-week and 4-week prediction horizons
- [ ] Train separate models for each horizon
- [ ] Let users choose prediction timeframe

### ⭐ Enhancement 3: Confidence Calibration
- [ ] Implement probability calibration (Platt scaling or isotonic regression)
- [ ] Improve alignment between predicted and actual probabilities
- [ ] Reduce calibration error

### ⭐ Enhancement 4: Feature Importance Visualization
- [ ] Add bar chart of feature importance to API response
- [ ] Frontend renders interactive visualization
- [ ] Users can understand prediction drivers

### ⭐ Enhancement 5: Model Retraining Automation
- [ ] Automate weekly model retraining
- [ ] Automatic model validation before deployment
- [ ] Automatic rollback if new model underperforms

### ⭐ Enhancement 6: A/B Testing Framework
- [ ] Deploy multiple model versions simultaneously
- [ ] Route traffic to different models
- [ ] Compare performance in production

### ⭐ Enhancement 7: Explainability Enhancements
- [ ] Add SHAP values for more detailed explanations
- [ ] Show counterfactual examples ("if this feature changed, prediction would flip")
- [ ] Confidence intervals for predictions

---

## Lessons Learned & Best Practices

**Document key learnings throughout implementation:**

### What Worked Well
- [ ] (Add lessons as you progress)
- Simple KISS approach reduced complexity
- Reusing existing VFR services saved development time
- Real API integration exposed edge cases early

### What Could Be Improved
- [ ] (Add lessons as you progress)
- Feature extraction latency optimization needed more attention
- Data quality checks should have been more comprehensive upfront

### Recommendations for Future ML Projects
- [ ] (Add recommendations as you learn)
- Start with simplest possible model (KISS)
- Test with real data from day 1 (NO MOCK DATA)
- Build monitoring before deployment, not after
- Feature flags are essential for risk-free rollout

---

## Progress Tracking

**Update this section as you complete tasks:**

### Week 1 (Days 1-5)
**Date Started**: ___________
**Date Completed**: ___________

**Tasks Completed**:
- [ ] Phase 1: Data Collection & Preparation
- [ ] Phase 2: Feature Engineering
- [ ] Phase 3: Model Training & Validation

**Blockers Encountered**:
- (Document any issues and how they were resolved)

**Key Decisions Made**:
- (Document important technical decisions)

### Week 2 (Days 6-10)
**Date Started**: ___________
**Date Completed**: ___________

**Tasks Completed**:
- [ ] Phase 4: API Integration
- [ ] Phase 5: Monitoring & Production Deployment

**Blockers Encountered**:
- (Document any issues and how they were resolved)

**Key Decisions Made**:
- (Document important technical decisions)

### Performance Metrics Achieved
- Training Time: _____ minutes (target: <5 minutes)
- Inference Latency: _____ ms (target: <100ms)
- Model Precision: _____% (target: >65%)
- Model Recall: _____% (target: >40%)
- Model AUC: _____ (target: >0.72)
- API Latency Increase: _____ ms (target: <100ms)
- Cache Hit Rate: _____% (target: >85%)

---

## Conclusion

This TODO document provides a comprehensive, step-by-step implementation guide for minimal ML early signal detection in VFR. By following these tasks sequentially and validating at each phase gate, you'll deliver a production-ready feature in 10 business days with <1,000 lines of code.

**Key Principles**:
- **KISS**: Keep it simple - single model, focused use case
- **NO MOCK DATA**: Always test with real APIs
- **Backward Compatible**: Existing clients unaffected
- **Performance First**: <100ms latency target
- **Production Ready**: Monitoring, logging, rollback plan

**Next Steps**:
1. Complete prerequisites checklist
2. Start with Phase 1, Day 1, Task 1.1
3. Work through tasks sequentially
4. Validate at each phase gate
5. Deploy with feature flag and canary testing
6. Monitor production metrics
7. Iterate and improve

**Success Criteria**:
- ✅ >65% precision predicting analyst upgrades 2 weeks ahead
- ✅ <100ms additional latency overhead
- ✅ Zero production incidents
- ✅ Delivered in 10 business days

Good luck! 🚀
