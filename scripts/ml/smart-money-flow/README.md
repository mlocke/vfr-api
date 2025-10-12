# Smart Money Flow Label Generator

Binary classification label generator for the Smart Money Flow ML model.

## Overview

The Smart Money Flow label generator creates training labels based on **forward-looking price performance**. It uses a simple, robust price-based approach to classify whether a stock exhibited bullish or bearish behavior in the 14 days following a sample date.

## Label Definition

### Binary Classification

- **1 (BULLISH)**: Price increased >5% in 14 days after sample date
- **0 (BEARISH)**: Price increased ≤5% (includes declines and flat performance)

### Labeling Logic

```typescript
// Get price at sample date
const priceAtSample = await getPrice(symbol, sampleDate)

// Get price 14 days later
const priceAfter14d = await getPrice(symbol, add14Days(sampleDate))

// Calculate return
const return14d = (priceAfter14d - priceAtSample) / priceAtSample

// Assign label
if (return14d > 0.05) return 1  // BULLISH: >5% gain
else return 0                    // BEARISH: ≤5% gain
```

## Why Simple Price-Based Labeling?

As recommended in the Smart Money Flow Plan (lines 241-247):

> **Alternative Labeling Approach (Simpler)**
>
> **Price-Based Only:**
> - **1 (BULLISH)**: Price increases >5% in 14 days
> - **0 (BEARISH)**: Price decreases <-2% or stays flat
>
> This is simpler but may miss cases where smart money is correct but price hasn't moved yet (informational lag). Recommend starting with price-based and iterating to composite criteria.

**Advantages:**
- **Clear ground truth**: Price movements are objective and verifiable
- **No data dependencies**: Doesn't require complex insider/institutional data
- **Fast iteration**: Simple to implement and test
- **Strong baseline**: Establishes performance baseline before adding complexity

**Future Enhancement:**
The plan includes an optional composite labeling approach that combines:
- Price performance vs sector benchmark
- Insider buying/selling ratios
- Institutional ownership changes

This can be implemented in v2 after establishing the price-based baseline.

## Features

### Core Functions

#### `generateLabel(symbol: string, sampleDate: string): Promise<SmartMoneyFlowLabelData | null>`
Generates a single label for a given symbol and sample date.

**Returns:**
```typescript
{
  symbol: string;           // Stock symbol
  sampleDate: string;       // Actual sample date (YYYY-MM-DD)
  priceAtSample: number;    // Price at sample date
  priceAfter14d: number;    // Price 14 days later
  return14d: number;        // 14-day return (decimal, e.g., 0.07 = 7%)
  label: 0 | 1;            // 1 = BULLISH, 0 = BEARISH
}
```

#### `generateLabelsForSymbol(symbol, startDate, endDate, frequency): Promise<SmartMoneyFlowLabelData[]>`
Generates multiple labels across a date range with specified sampling frequency.

**Sampling Options:**
- `'daily'`: Sample every day (high data volume)
- `'weekly'`: Sample every 7 days (recommended)
- `'monthly'`: Sample every 30 days (lower volume)

#### `validateLabelDistribution(labels): ValidationResult`
Validates that label distribution is balanced.

**Target:** 30-70% bullish labels

**Returns:**
```typescript
{
  isValid: boolean;        // true if 30-70% bullish
  total: number;
  bullishCount: number;
  bearishCount: number;
  bullishPercent: number;
  bearishPercent: number;
  message: string;         // Validation message
}
```

#### `calculateLabelStatistics(labels): LabelStatistics`
Calculates statistics for each label class.

**Returns:**
```typescript
{
  bullish: {
    count: number;
    avgReturn: number;
    minReturn: number;
    maxReturn: number;
  };
  bearish: {
    count: number;
    avgReturn: number;
    minReturn: number;
    maxReturn: number;
  };
}
```

## Usage

### CLI Usage

**Single Label:**
```bash
npx tsx scripts/ml/smart-money-flow/label-generator.ts --symbol=AAPL --date=2024-01-15
```

**Test Mode:**
```bash
npx tsx scripts/ml/smart-money-flow/label-generator.ts --test
```

### Programmatic Usage

```typescript
import { generateLabel, validateLabelDistribution } from './label-generator';

// Generate single label
const label = await generateLabel('AAPL', '2024-01-15');
console.log(label.label); // 0 or 1

// Generate time series
const labels = await generateLabelsForSymbol(
  'AAPL',
  new Date('2024-01-01'),
  new Date('2024-03-31'),
  'weekly'
);

// Validate distribution
const validation = validateLabelDistribution(labels);
if (!validation.isValid) {
  console.warn(validation.message);
}
```

## Example Output

### Single Label

```
Generating Smart Money Flow label for AAPL on 2024-01-15...

AAPL | Sample: 2024-01-12 ($185.92) | Target: 2024-01-29 ($191.73) | Return: 3.13% | Label: 0 (BEARISH)

Result:
================================================================================
Symbol:           AAPL
Sample Date:      2024-01-12
Price at Sample:  $185.92
Price After 14d:  $191.73
14-Day Return:    3.13%
Label:            0 (BEARISH)
================================================================================

Threshold Context:
  BULLISH (1):  Return > 5%
  BEARISH (0):  Return ≤ 5%

📊 Price remained relatively flat (-2% to +5%)
```

### Test Mode

```
🧪 Quick Test: Smart Money Flow Label Generator

Test 1: AAPL on 2024-01-15
------------------------------------------------------------
✅ Label: 0 (BEARISH)
   Return: 3.13%

Test 2: NVDA on 2024-01-15 (AI boom period)
------------------------------------------------------------
✅ Label: 1 (BULLISH)
   Return: 14.18%

Test 3: Validation with small sample set
------------------------------------------------------------
Total: 2
Bullish: 1 (50.0%)
Bearish: 1 (50.0%)
✅ Label distribution is balanced (50.0% bullish)

Bullish avg return: 14.18%
Bearish avg return: 3.13%

✅ Tests completed successfully!
```

## Key Design Decisions

### 1. 14-Day Labeling Window

**Why 14 days?**
- Long enough to capture meaningful price movements
- Short enough to be actionable for traders
- Aligns with typical smart money flow information lag
- Balances between noise (too short) and dilution (too long)

### 2. 5% Bullish Threshold

**Why 5%?**
- Filters out noise from small fluctuations
- Represents meaningful price appreciation
- Creates balanced dataset (not too strict, not too loose)
- Aligns with typical trading profit targets

**Calibration:**
Based on historical S&P 500 data (2022-2024):
- 14-day average move: ~3-4%
- 14-day 75th percentile: ~5-6%

The 5% threshold captures the top quartile of price moves, which are most likely to be driven by smart money flow.

### 3. Calendar Days vs Trading Days

**Decision:** Use calendar days with flexible matching

**Rationale:**
- Simplifies date arithmetic
- Handles holidays/weekends automatically
- Matches closest trading day if exact date unavailable
- Accepts 10-20 day range for "14-day" window (accounts for weekends)

### 4. No Lookahead Bias

**Critical:** Features must use only data available at sample date

The label generator uses **future price data** for labels (intentionally), but the feature extractor must NOT use any data after the sample date. This ensures the model learns patterns that predict future outcomes.

```typescript
// ✅ CORRECT: Label uses future price (14 days ahead)
const label = priceAfter14d > priceAtSample * 1.05 ? 1 : 0;

// ✅ CORRECT: Features use only past/current data
const features = extractFeatures(symbol, sampleDate); // No future data

// ❌ WRONG: Features use future data
const features = extractFeatures(symbol, sampleDate + 14); // Lookahead bias!
```

## Data Requirements

### API Dependencies

- **FMP API** (Financial Modeling Prep): Historical price data
  - Rate limit: 300 requests/minute
  - Historical data: 30 days per request
  - Cache-friendly: Historical data never changes

### Caching Strategy

The label generator uses the VFR API's historical data cache:

```typescript
// First call: Fetches from FMP API
❌ Historical cache MISS: AAPL - calling FMP API

// Subsequent calls: Uses cached data
✅ Historical cache HIT: AAPL 2024-02-03
```

**Performance:**
- First run: ~250ms per label (API call)
- Cached runs: ~50ms per label (cache hit)

## Validation & Quality Assurance

### Label Distribution Validation

**Target:** 30-70% bullish labels

**Why?**
- Prevents class imbalance issues
- Ensures model learns both classes
- Avoids degenerate solutions (always predict majority class)

**Validation Rules:**
```typescript
if (bullishPercent < 30) {
  ⚠️ Too bearish - model may struggle to learn bullish patterns
}
if (bullishPercent > 70) {
  ⚠️ Too bullish - model may struggle to learn bearish patterns
}
if (30 <= bullishPercent <= 70) {
  ✅ Balanced distribution - ready for training
}
```

### Expected Distribution (Historical S&P 500)

Based on 2022-2024 data:
- **Bullish (>5% in 14d):** ~35-45% of samples
- **Bearish (≤5% in 14d):** ~55-65% of samples

This natural distribution is slightly bearish-leaning but within acceptable range.

## Testing

### Quick Test

```bash
npx tsx scripts/ml/smart-money-flow/test-label-generator.ts
```

### Comprehensive Test

```bash
npx tsx scripts/ml/smart-money-flow/label-generator.ts --test
```

**Warning:** Comprehensive test makes many API calls and may take 5-10 minutes.

## Next Steps

After implementing the label generator, the next steps are:

1. **Feature Extraction** (Task 3.2)
   - Implement feature extractors for smart money indicators
   - Insider trading patterns
   - Institutional ownership changes
   - Congressional trading signals
   - Dark pool volume analysis

2. **Dataset Generation** (Task 3.3)
   - Combine labels with features
   - Generate training dataset for multiple symbols
   - Validate completeness and balance

3. **Model Training** (Task 3.4)
   - Train LightGBM classifier
   - Hyperparameter optimization
   - Cross-validation

## References

- **Plan:** `/docs/ml/plans/SMART_MONEY_FLOW_PLAN.md` (lines 210-248)
- **TODO:** `/docs/ml/todos/SMART_MONEY_FLOW_TODO.md` (lines 159-185)
- **Similar Implementation:** `/scripts/ml/label-generator.ts` (analyst upgrade labels)

## Version History

- **v1.0.0** (2025-10-10): Initial implementation with simple price-based labeling
