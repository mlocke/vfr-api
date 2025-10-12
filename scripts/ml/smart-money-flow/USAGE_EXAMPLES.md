# Smart Money Flow Label Generator - Usage Examples

This document provides practical examples for using the Smart Money Flow label generator.

## Quick Start

### 1. Single Label Generation

Generate a label for one symbol and date:

```bash
npx tsx scripts/ml/smart-money-flow/label-generator.ts --symbol=AAPL --date=2024-01-15
```

**Output:**
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

### 2. Run Test Suite

Execute the quick test suite:

```bash
npx tsx scripts/ml/smart-money-flow/test-label-generator.ts
```

**Output:**
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

## Programmatic Usage

### Example 1: Generate Single Label

```typescript
import { generateLabel } from './label-generator';

async function example1() {
  // Generate label for AAPL on 2024-01-15
  const label = await generateLabel('AAPL', '2024-01-15');

  if (label) {
    console.log(`Symbol: ${label.symbol}`);
    console.log(`Sample Date: ${label.sampleDate}`);
    console.log(`14-Day Return: ${(label.return14d * 100).toFixed(2)}%`);
    console.log(`Label: ${label.label} (${label.label === 1 ? 'BULLISH' : 'BEARISH'})`);
  }
}

// Output:
// Symbol: AAPL
// Sample Date: 2024-01-12
// 14-Day Return: 3.13%
// Label: 0 (BEARISH)
```

### Example 2: Generate Time Series

```typescript
import { generateLabelsForSymbol } from './label-generator';

async function example2() {
  // Generate weekly labels for Q1 2024
  const labels = await generateLabelsForSymbol(
    'TSLA',
    new Date('2024-01-01'),
    new Date('2024-03-31'),
    'weekly'
  );

  console.log(`Generated ${labels.length} labels for TSLA`);

  // Show first few samples
  labels.slice(0, 3).forEach(label => {
    console.log(
      `${label.sampleDate}: ${(label.return14d * 100).toFixed(2)}% → ` +
      `Label ${label.label}`
    );
  });
}

// Output:
// Generated 13 labels for TSLA
// 2024-01-02: 8.42% → Label 1
// 2024-01-09: -1.23% → Label 0
// 2024-01-16: 12.67% → Label 1
```

### Example 3: Validate Label Distribution

```typescript
import { generateLabelsForSymbol, validateLabelDistribution } from './label-generator';

async function example3() {
  // Generate labels for multiple symbols
  const symbols = ['AAPL', 'GOOGL', 'MSFT'];
  const allLabels = [];

  for (const symbol of symbols) {
    const labels = await generateLabelsForSymbol(
      symbol,
      new Date('2024-01-01'),
      new Date('2024-03-31'),
      'monthly'
    );
    allLabels.push(...labels);
  }

  // Validate distribution
  const validation = validateLabelDistribution(allLabels);

  console.log(`Total Labels: ${validation.total}`);
  console.log(`Bullish: ${validation.bullishCount} (${validation.bullishPercent.toFixed(1)}%)`);
  console.log(`Bearish: ${validation.bearishCount} (${validation.bearishPercent.toFixed(1)}%)`);
  console.log(validation.message);

  if (!validation.isValid) {
    console.warn('⚠️ Dataset needs rebalancing!');
  }
}

// Output:
// Total Labels: 9
// Bullish: 4 (44.4%)
// Bearish: 5 (55.6%)
// ✅ Label distribution is balanced (44.4% bullish)
```

### Example 4: Calculate Statistics

```typescript
import { generateLabelsForSymbol, calculateLabelStatistics } from './label-generator';

async function example4() {
  // Generate labels
  const labels = await generateLabelsForSymbol(
    'NVDA',
    new Date('2024-01-01'),
    new Date('2024-06-30'),
    'weekly'
  );

  // Calculate statistics
  const stats = calculateLabelStatistics(labels);

  console.log('Bullish Class Statistics:');
  console.log(`  Count: ${stats.bullish.count}`);
  console.log(`  Avg Return: ${(stats.bullish.avgReturn * 100).toFixed(2)}%`);
  console.log(`  Min Return: ${(stats.bullish.minReturn * 100).toFixed(2)}%`);
  console.log(`  Max Return: ${(stats.bullish.maxReturn * 100).toFixed(2)}%`);

  console.log('\nBearish Class Statistics:');
  console.log(`  Count: ${stats.bearish.count}`);
  console.log(`  Avg Return: ${(stats.bearish.avgReturn * 100).toFixed(2)}%`);
  console.log(`  Min Return: ${(stats.bearish.minReturn * 100).toFixed(2)}%`);
  console.log(`  Max Return: ${(stats.bearish.maxReturn * 100).toFixed(2)}%`);
}

// Output:
// Bullish Class Statistics:
//   Count: 15
//   Avg Return: 9.23%
//   Min Return: 5.12%
//   Max Return: 18.45%
//
// Bearish Class Statistics:
//   Count: 11
//   Avg Return: 1.67%
//   Min Return: -4.23%
//   Max Return: 4.89%
```

### Example 5: Dataset Generation Pattern

```typescript
import { generateLabel } from './label-generator';

async function example5() {
  // Pattern for dataset generation script
  const dataset = [];
  const symbols = ['AAPL', 'GOOGL', 'MSFT'];
  const sampleDates = [
    '2024-01-15',
    '2024-02-15',
    '2024-03-15'
  ];

  for (const symbol of symbols) {
    for (const sampleDate of sampleDates) {
      // 1. Extract features (implement in feature-extractor.ts)
      // const features = await extractFeatures(symbol, sampleDate);

      // 2. Generate label
      const labelData = await generateLabel(symbol, sampleDate);

      if (labelData) {
        // 3. Combine into training example
        dataset.push({
          symbol: labelData.symbol,
          sampleDate: labelData.sampleDate,
          // ...features,  // Add features here
          label: labelData.label
        });
      }
    }
  }

  console.log(`Generated ${dataset.length} training examples`);
  console.log('Sample:', dataset[0]);
}

// Output:
// Generated 9 training examples
// Sample: { symbol: 'AAPL', sampleDate: '2024-01-12', label: 0 }
```

## Advanced Usage

### Custom Date Ranges

```typescript
import { generateLabelsForSymbol } from './label-generator';

async function customDateRange() {
  // Generate labels for entire 2023
  const labels = await generateLabelsForSymbol(
    'TSLA',
    new Date('2023-01-01'),
    new Date('2023-12-31'),
    'weekly'
  );

  console.log(`Generated ${labels.length} weekly labels for 2023`);

  // Filter to specific months
  const q4Labels = labels.filter(l => {
    const month = parseInt(l.sampleDate.split('-')[1]);
    return month >= 10; // Oct, Nov, Dec
  });

  console.log(`Q4 2023: ${q4Labels.length} labels`);
}
```

### Batch Processing

```typescript
import { generateLabel } from './label-generator';

async function batchProcess() {
  const symbolDatePairs = [
    { symbol: 'AAPL', date: '2024-01-15' },
    { symbol: 'GOOGL', date: '2024-01-15' },
    { symbol: 'MSFT', date: '2024-01-15' },
    { symbol: 'TSLA', date: '2024-02-01' },
    { symbol: 'NVDA', date: '2024-02-01' }
  ];

  const results = [];

  for (const pair of symbolDatePairs) {
    const label = await generateLabel(pair.symbol, pair.date);
    if (label) {
      results.push(label);
    }

    // Rate limiting: 250ms between requests
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  console.log(`Processed ${results.length} labels`);

  // Count by label
  const bullishCount = results.filter(r => r.label === 1).length;
  console.log(`Bullish: ${bullishCount}, Bearish: ${results.length - bullishCount}`);
}
```

### Error Handling

```typescript
import { generateLabel } from './label-generator';

async function withErrorHandling() {
  try {
    const label = await generateLabel('INVALID', '2024-01-15');

    if (label === null) {
      console.log('❌ Failed to generate label (insufficient data)');
      return;
    }

    console.log(`✅ Label: ${label.label}`);
  } catch (error) {
    console.error('Error generating label:', error);
  }
}
```

## Integration Examples

### With Feature Extraction

```typescript
import { generateLabel } from './label-generator';
// import { extractFeatures } from './feature-extractor'; // To be implemented

async function integratedExample() {
  const symbol = 'AAPL';
  const sampleDate = '2024-01-15';

  // Extract features (only using data up to sample date)
  // const features = await extractFeatures(symbol, sampleDate);

  // Generate label (using future price data)
  const labelData = await generateLabel(symbol, sampleDate);

  if (labelData) {
    const trainingExample = {
      // ...features,  // Features extracted from past data
      label: labelData.label,  // Label from future data
      return14d: labelData.return14d  // For analysis (not a feature!)
    };

    console.log('Training Example:', trainingExample);
  }
}
```

### With Dataset Validation

```typescript
import {
  generateLabelsForSymbol,
  validateLabelDistribution,
  calculateLabelStatistics
} from './label-generator';

async function validateDataset() {
  // Generate dataset
  const labels = await generateLabelsForSymbol(
    'AAPL',
    new Date('2023-01-01'),
    new Date('2024-12-31'),
    'weekly'
  );

  // Validate distribution
  const validation = validateLabelDistribution(labels);

  if (!validation.isValid) {
    console.error('❌ Dataset imbalanced:', validation.message);
    console.log('Consider adjusting thresholds or date range');
    return false;
  }

  // Calculate statistics
  const stats = calculateLabelStatistics(labels);

  console.log('✅ Dataset validated successfully');
  console.log(`Total: ${validation.total}`);
  console.log(`Bullish: ${validation.bullishPercent.toFixed(1)}%`);
  console.log(`Avg Bullish Return: ${(stats.bullish.avgReturn * 100).toFixed(2)}%`);
  console.log(`Avg Bearish Return: ${(stats.bearish.avgReturn * 100).toFixed(2)}%`);

  return true;
}
```

## Performance Tips

### 1. Use Caching

The label generator automatically uses the FMP API's historical data cache:

```typescript
// First call: Fetches from API (~250ms)
await generateLabel('AAPL', '2024-01-15');

// Second call: Uses cache (~50ms)
await generateLabel('AAPL', '2024-02-15'); // Same symbol, cache hit!
```

### 2. Batch by Symbol

Process all dates for one symbol before moving to the next:

```typescript
// ✅ GOOD: High cache hit rate
for (const symbol of symbols) {
  for (const date of dates) {
    await generateLabel(symbol, date);
  }
}

// ❌ BAD: Low cache hit rate
for (const date of dates) {
  for (const symbol of symbols) {
    await generateLabel(symbol, date);
  }
}
```

### 3. Use Time Series Function

For multiple dates, use `generateLabelsForSymbol()`:

```typescript
// ✅ GOOD: Built-in rate limiting and batching
const labels = await generateLabelsForSymbol(
  'AAPL',
  new Date('2024-01-01'),
  new Date('2024-12-31'),
  'weekly'
);

// ❌ LESS EFFICIENT: Manual looping
const labels = [];
for (let date = start; date <= end; date += 7) {
  labels.push(await generateLabel('AAPL', date));
}
```

## Troubleshooting

### Issue: "Insufficient historical data"

**Cause:** Not enough historical price data for the symbol

**Solution:** Check if the symbol is valid and has trading history

```typescript
const label = await generateLabel('NEWTICKER', '2024-01-15');
// May return null if IPO was recent
```

### Issue: "No future price data"

**Cause:** Sample date is too recent (within 14 days of today)

**Solution:** Use older sample dates that have complete 14-day forward data

```typescript
// ❌ May fail if today is 2024-01-20
await generateLabel('AAPL', '2024-01-15');

// ✅ Use dates with complete forward data
await generateLabel('AAPL', '2023-12-15');
```

### Issue: Label distribution too imbalanced

**Cause:** Market conditions in date range are strongly trending

**Solution:** Adjust thresholds or expand date range

```typescript
// Check distribution
const validation = validateLabelDistribution(labels);

if (validation.bullishPercent > 70) {
  console.log('⚠️ Too bullish - consider:');
  console.log('  1. Expanding date range to include bear markets');
  console.log('  2. Increasing bullish threshold (>5%)');
  console.log('  3. Using different time period');
}
```

## Next Steps

After generating labels, proceed to:

1. **Feature Extraction** - Implement `feature-extractor.ts`
2. **Dataset Generation** - Combine features + labels
3. **Model Training** - Train LightGBM classifier

See `README.md` for detailed next steps.

## Reference

- **Main Implementation:** `label-generator.ts`
- **Tests:** `test-label-generator.ts`
- **Documentation:** `README.md`
- **Summary:** `IMPLEMENTATION_SUMMARY.md`
