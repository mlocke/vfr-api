# Options Analysis Weight Calculation - Technical Documentation

## Overview

The VFR Financial Analysis Platform integrates options data as a critical component of its institutional-grade technical analysis engine. Options analysis contributes **15% weight** to the overall technical analysis score, providing sophisticated intelligence on market sentiment, volatility expectations, and institutional positioning.

This document details the mathematical framework for combining short-term and long-term options data into weighted analysis scores.

## System Architecture

### Primary Weight Allocation

Options analysis is integrated into the Enhanced Technical Analysis system with the following weight structure:

```
Enhanced Technical Analysis (40% of total composite score)
├── Traditional Technical Analysis: 85% weight
└── Options Intelligence: 15% weight
    ├── Put/Call Ratio: 30%
    ├── IV Percentile: 25%
    ├── Options Flow: 20%
    ├── Max Pain: 15%
    ├── Greeks Analysis: 10%
    └── Volume Divergence: 10%
```

### Implementation Reference
- **Primary Calculation**: `FactorLibrary.ts:1205`
- **Options Scoring**: `FactorLibrary.ts:1225-1294`
- **Time-Based Analysis**: `OptionsDataService.ts:762-1094`

## Time-Based Options Categorization

The system categorizes options contracts by time to expiration to capture different market sentiment layers:

### Time Periods

| Period | Days to Expiry | Purpose | Sentiment Indicators |
|--------|----------------|---------|---------------------|
| **Short-term** | 1-30 days | Immediate sentiment & volatility | P/C > 1.2 = bearish, < 0.8 = bullish |
| **Medium-term** | 31-90 days | Institutional positioning | P/C > 1.1 = bearish, < 0.9 = bullish |
| **Long-term** | 91+ days | Strategic confidence (LEAPS) | P/C > 1.05 = bearish, < 0.95 = bullish |

### Categorization Logic

```typescript
// Contract categorization by expiration
allContracts.forEach(contract => {
  const expiryDate = new Date(contract.expiration)
  const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysToExpiry <= 30) {
    shortTerm.push({...contract, daysToExpiry})
  } else if (daysToExpiry <= 90) {
    mediumTerm.push({...contract, daysToExpiry})
  } else {
    longTerm.push({...contract, daysToExpiry})
  }
})
```

## Mathematical Weight Calculation

### Step 1: Component Score Calculation

Each of the six options components is calculated independently:

#### 1. Put/Call Ratio Score (30% weight)
```typescript
function calculatePutCallRatioScore(putCallRatio: number): number {
  if (putCallRatio <= 0.7) {
    return 0.8 + (0.7 - putCallRatio) * 0.4  // Very bullish: 0.8-1.0
  } else if (putCallRatio <= 1.0) {
    return 0.6 + (1.0 - putCallRatio) * 0.67  // Bullish: 0.6-0.8
  } else if (putCallRatio <= 1.3) {
    return 0.4 + (1.3 - putCallRatio) * 0.67  // Neutral: 0.4-0.6
  } else {
    return Math.max(0, 0.4 - (putCallRatio - 1.3) * 0.3)  // Bearish: 0.0-0.4
  }
}
```

#### 2. Implied Volatility Percentile Score (25% weight)
```typescript
function calculateIVPercentileScore(ivPercentile: number): number {
  if (ivPercentile <= 20) {
    return 0.6 + ivPercentile * 0.005      // Low vol breakout: 0.6-0.7
  } else if (ivPercentile <= 40) {
    return 0.5 + (ivPercentile - 20) * 0.005  // Normal: 0.5-0.6
  } else if (ivPercentile <= 60) {
    return 0.4 + (60 - ivPercentile) * 0.005  // Elevated: 0.4-0.5
  } else if (ivPercentile <= 80) {
    return 0.3 + (80 - ivPercentile) * 0.005  // High: 0.3-0.4
  } else {
    return 0.2 + (100 - ivPercentile) * 0.005  // Extreme: 0.2-0.3
  }
}
```

### Step 2: Composite Options Score

```typescript
function calculateOptionsScore(optionsData: OptionsDataPoint): number {
  let totalScore = 0
  let totalWeight = 0

  // Component scoring with weights
  const components = [
    { score: calculatePutCallRatioScore(optionsData.putCallRatio), weight: 0.30 },
    { score: calculateIVPercentileScore(optionsData.impliedVolatilityPercentile), weight: 0.25 },
    { score: calculateOptionsFlowScore(optionsData.optionsFlow), weight: 0.20 },
    { score: calculateMaxPainScore(optionsData.maxPain), weight: 0.15 },
    { score: calculateGreeksScore(optionsData.greeks), weight: 0.10 },
    { score: calculateVolumeDivergenceScore(optionsData.volumeDivergence), weight: 0.10 }
  ]

  components.forEach(component => {
    if (component.score !== null) {
      totalScore += component.score * component.weight
      totalWeight += component.weight
    }
  })

  return totalWeight > 0 ? totalScore / totalWeight : 0.5  // Neutral fallback
}
```

### Step 3: Enhanced Technical Integration

```typescript
function calculateEnhancedTechnicalScore(symbol: string): number {
  const traditionalTechnicalScore = calculateTechnicalOverallScore(symbol)  // 85% weight
  const optionsScore = calculateOptionsScore(optionsData)                   // 15% weight

  return (traditionalTechnicalScore * 0.85) + (optionsScore * 0.15)
}
```

## Time-Based Sentiment Analysis

### Confidence Scoring by Timeframe

Different timeframes use different confidence thresholds to account for liquidity and institutional activity:

```typescript
// Short-term confidence (1-30 days)
const shortTermConfidence = Math.min((callVolume + putVolume) / 1000, 1)

// Medium-term confidence (31-90 days)
const mediumTermConfidence = Math.min((callVolume + putVolume) / 5000, 1)

// Long-term confidence (91+ days)
const longTermConfidence = Math.min((callVolume + putVolume) / 10000, 1)
```

### Sentiment Determination

Each timeframe has calibrated thresholds for sentiment classification:

```typescript
function determineSentiment(volumeRatio: number, timeframe: string): string {
  const thresholds = {
    shortTerm: { bearish: 1.2, bullish: 0.8 },
    mediumTerm: { bearish: 1.1, bullish: 0.9 },
    longTerm: { bearish: 1.05, bullish: 0.95 }
  }

  const threshold = thresholds[timeframe]

  if (volumeRatio > threshold.bearish) return 'bearish'
  if (volumeRatio < threshold.bullish) return 'bullish'
  return 'neutral'
}
```

## LEAPS Analysis Integration

For long-term options (365+ days to expiration), the system performs specialized LEAPS analysis:

```typescript
function generateLeapsAnalysis(leaps: OptionsContract[]): string {
  if (leaps.length === 0) return 'No LEAPS available'

  const calls = leaps.filter(c => c.type === 'call')
  const puts = leaps.filter(c => c.type === 'put')

  const callOI = calls.reduce((sum, c) => sum + (c.openInterest || 0), 0)
  const putOI = puts.reduce((sum, c) => sum + (c.openInterest || 0), 0)

  const totalOI = callOI + putOI
  if (totalOI === 0) return 'LEAPS present but no significant open interest'

  const sentiment = callOI > putOI ? 'bullish' : 'bearish'
  const confidence = callOI > putOI ? (callOI / totalOI) : (putOI / totalOI)

  return `${leaps.length} LEAPS with ${totalOI.toLocaleString()} total OI showing ${sentiment} long-term confidence (${(confidence * 100).toFixed(1)}%)`
}
```

## Institutional Signal Detection

The system identifies institutional activity patterns within time-based analysis:

### Signal Detection Criteria

1. **Large Open Interest**: Contracts with >1,000 open interest
2. **Unusual Volume**: Contracts with >500 volume
3. **Strike Clustering**: 4+ contracts at same strike (support/resistance)
4. **Institutional Hedges**: Balanced call/put activity at same strike
5. **Fresh Positioning**: High volume-to-OI ratio (>0.5)

### Implementation

```typescript
function detectInstitutionalSignals(contracts: OptionsContract[]): string[] {
  const signals: string[] = []

  // Large OI concentrations
  const highOIContracts = contracts.filter(c => (c.openInterest || 0) > 1000)
  if (highOIContracts.length > 0) {
    signals.push(`${highOIContracts.length} contracts with >1K open interest`)
  }

  // Unusual volume spikes
  const highVolumeContracts = contracts.filter(c => (c.volume || 0) > 500)
  if (highVolumeContracts.length > 0) {
    signals.push(`${highVolumeContracts.length} contracts with unusual volume`)
  }

  return signals
}
```

## Performance Optimization

### Caching Strategy

Dynamic TTL based on market conditions:

```typescript
function getOptimalTTL(): number {
  const now = new Date()
  const hour = now.getUTCHours() - 5  // EST adjustment
  const day = now.getUTCDay()

  if (day === 0 || day === 6) return 1800      // Weekend: 30 min
  if (hour >= 9 && hour < 16) return 30        // Market hours: 30 sec
  return 300                                    // After hours: 5 min
}
```

### Memory Optimization

Contract field reduction from 40+ fields to 14 essential fields:

```typescript
const ESSENTIAL_FIELDS = [
  'strike', 'bid', 'ask', 'volume', 'openInterest',
  'impliedVolatility', 'delta', 'gamma', 'theta', 'vega',
  'inTheMoney', 'lastPrice', 'change', 'percentChange'
]
```

## Example Calculation

### Sample Data
```typescript
const optionsData = {
  putCallRatio: 0.85,              // Bullish signal
  impliedVolatilityPercentile: 35, // Normal volatility
  optionsFlow: { sentiment: 0.7 }, // Positive flow
  maxPain: 150,                    // Market maker level
  greeks: { delta: 0.5 },          // Balanced delta
  volumeDivergence: 0.2            // Slight divergence
}
```

### Calculation Steps

1. **Component Scores**:
   - P/C Ratio (0.85): `0.6 + (1.0 - 0.85) * 0.67 = 0.70`
   - IV Percentile (35): `0.5 + (35 - 20) * 0.005 = 0.575`
   - Options Flow (0.7): `0.7` (normalized)
   - Max Pain: `0.5` (placeholder)
   - Greeks: `0.6` (calculated from delta)
   - Volume Divergence (0.2): `0.55`

2. **Weighted Score**:
   ```
   totalScore = (0.70 × 0.30) + (0.575 × 0.25) + (0.7 × 0.20) +
                (0.5 × 0.15) + (0.6 × 0.10) + (0.55 × 0.10)
              = 0.21 + 0.144 + 0.14 + 0.075 + 0.06 + 0.055
              = 0.684
   ```

3. **Final Integration**:
   ```
   enhancedTechnicalScore = (traditionalTechnical × 0.85) + (0.684 × 0.15)
   ```

## Conclusion

The options analysis weight calculation system provides a sophisticated mathematical framework for integrating short-term market sentiment with long-term institutional positioning. By weighting different time horizons and options components appropriately, the system delivers institutional-grade intelligence that enhances traditional technical analysis with options market insights.

The 15% allocation ensures options data meaningfully contributes to analysis without overwhelming fundamental and technical factors, while the six-component internal weighting captures the full spectrum of options intelligence from put/call ratios to Greeks analysis.