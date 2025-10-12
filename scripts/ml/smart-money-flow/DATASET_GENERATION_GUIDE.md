# Smart Money Flow Dataset Generation Guide

## Overview

This guide explains how to use `generate-dataset.ts` to create training datasets for the Smart Money Flow ML model.

## Script Features

- **Stock Universe**: Top 500 S&P 500 stocks with high institutional coverage
- **Temporal Sampling**: Monthly sampling on the 15th of each month (avoiding month-end volatility)
- **Date Range**: 2022-01-01 to 2024-12-31 (3 years, 36 months)
- **Total Examples**: 500 stocks × 36 months = 18,000 training examples
- **Features**: 27 Smart Money features (insider, institutional, congressional, hedge fund, ETF)
- **Labels**: Binary classification (1 = price increase >5% in 14 days, 0 = otherwise)
- **Checkpointing**: Saves progress every 50 examples to prevent data loss
- **Caching**: Uses SmartMoneyDataCache for 97% API call reduction

## Critical: Historical Data Caching

**BEFORE RUNNING THIS SCRIPT**, understand the caching principle:

### Why Caching Matters

Without caching:
- **API Calls**: 18,000 samples × 5 data types = 90,000 API calls
- **Duration**: ~75 hours
- **Cost**: 360 days of API quota

With caching:
- **API Calls**: 500 stocks × 5 data types = 2,500 API calls (first run)
- **Duration**: ~2 hours (first run), ~20 minutes (cached rerun)
- **Cost**: 10 days of API quota
- **Improvement**: 97% fewer API calls

### How Caching Works

1. **Cache Check**: For each (symbol, dateRange, dataType), check cache FIRST
2. **Cache Hit**: Return cached data (99.8% faster than API call)
3. **Cache Miss**: Call API, save to cache immediately
4. **Cache Storage**: Permanent disk-based JSON files in `data/cache/smart-money/`

### Cache Hit Rate Monitoring

Target: >95% cache hit rate on second run

```bash
# First run: Many cache misses (building cache)
Cache MISS: AAPL_2022-01-01_2024-12-31_insider_trades
Cache SET: AAPL_2022-01-01_2024-12-31_insider_trades (45.23 KB)

# Second run: All cache hits
Cache HIT: AAPL_2022-01-01_2024-12-31_insider_trades
Cache HIT: AAPL_2022-01-01_2024-12-31_institutional_ownership
```

## Usage

### Test Mode (Quick Validation)

Test with 3 symbols (TSLA, NVDA, AAPL) to validate the pipeline:

```bash
npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --test
```

**Output**: `data/training/smart-money-flow/smart-money-flow-test.csv`
**Examples**: ~108 (3 stocks × 36 months)
**Duration**: ~5-10 minutes

### Specific Symbols

Generate dataset for custom symbols:

```bash
npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --symbols AAPL,GOOGL,MSFT,TSLA
```

**Output**: `data/training/smart-money-flow/smart-money-flow-custom.csv`
**Examples**: 4 stocks × 36 months = ~144
**Duration**: ~10-15 minutes

### Top 50 S&P 500

Generate dataset for top 50 S&P 500 stocks:

```bash
npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --top50
```

**Output**: `data/training/smart-money-flow/smart-money-flow-top50.csv`
**Examples**: 50 stocks × 36 months = ~1,800
**Duration**: ~30-45 minutes (first run), ~5 minutes (cached)

### Top 100 S&P 500

Generate dataset for top 100 S&P 500 stocks:

```bash
npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --top100
```

**Output**: `data/training/smart-money-flow/smart-money-flow-top100.csv`
**Examples**: 100 stocks × 36 months = ~3,600
**Duration**: ~1 hour (first run), ~10 minutes (cached)

### Full Dataset (Top 500)

Generate FULL production dataset for top 500 S&P 500 stocks:

```bash
npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --top500
```

**Output**: `data/training/smart-money-flow/smart-money-flow-full.csv`
**Examples**: 500 stocks × 36 months = ~18,000
**Duration**: ~2 hours (first run), ~20 minutes (cached)

## Output Format

### CSV Structure

The output CSV contains the following columns:

#### Metadata (5 columns)
- `symbol`: Stock ticker (e.g., "AAPL")
- `date`: Sample date in YYYY-MM-DD format (e.g., "2022-01-15")
- `price_at_sample`: Price on sample date
- `price_after_14d`: Price 14 days later
- `return_14d`: 14-day return (decimal, e.g., 0.07 = 7%)

#### Insider Trading Features (8 columns)
- `insider_buy_ratio_30d`: Buy transactions / total transactions (0-1)
- `insider_buy_volume_30d`: Total shares purchased
- `insider_sell_volume_30d`: Total shares sold
- `insider_net_flow_30d`: Buy volume - Sell volume
- `insider_cluster_score`: Count of 7-day windows with multiple insiders buying
- `insider_ownership_change_90d`: Net change in insider ownership
- `insider_avg_premium`: Average % premium paid above market price
- `c_suite_activity_ratio`: C-level transactions / all transactions (0-1)

#### Institutional Ownership Features (7 columns)
- `inst_ownership_pct`: % of shares held by institutions (0-1)
- `inst_ownership_change_1q`: Change in institutional ownership
- `inst_new_positions_count`: New institutional buyers
- `inst_closed_positions_count`: Institutions that exited
- `inst_avg_position_size_change`: Average % change in position sizes
- `inst_concentration_top10`: % held by top 10 institutions (0-1)
- `inst_momentum_score`: Weighted score based on recent changes

#### Congressional Trading Features (4 columns)
- `congress_buy_count_90d`: Congressional buy transactions in 90 days
- `congress_sell_count_90d`: Congressional sell transactions in 90 days
- `congress_net_sentiment`: Buy count - Sell count
- `congress_recent_activity_7d`: 1 if activity in last 7 days, 0 otherwise

#### Hedge Fund Holdings Features (5 columns)
- `hedgefund_top20_exposure`: % ownership by top 20 hedge funds (0-1)
- `hedgefund_net_change_1q`: Net change in hedge fund holdings
- `hedgefund_new_entry_count`: New hedge fund positions
- `hedgefund_exit_count`: Hedge funds that exited
- `hedgefund_conviction_score`: Weighted score (larger funds = higher weight)

#### ETF Flow Features (3 columns)
- `etf_ownership_pct`: % held by ETFs (0-1)
- `etf_flow_30d`: Net ETF buying/selling in 30 days
- `etf_concentration`: % held by top 5 ETFs (0-1)

#### Label (1 column)
- `label`: Binary classification (1 = BULLISH, 0 = BEARISH)
  - **1 (BULLISH)**: Price increased >5% in 14 days
  - **0 (BEARISH)**: Price stayed flat or decreased (<5% gain)

### Example Rows

```csv
symbol,date,price_at_sample,price_after_14d,return_14d,insider_buy_ratio_30d,...,label
AAPL,2022-01-15,172.17,174.78,0.0152,0.4,12000,8000,4000,2,5000,0.02,0.6,0.72,0.01,3,2,0.005,0.35,0.15,1,0,1,1,0.18,0.02,2,1,0.12,0.15,0,0.52,0
TSLA,2022-01-15,1031.00,1088.12,0.0554,0.7,25000,5000,20000,3,15000,0.05,0.8,0.68,0.03,5,1,0.015,0.28,0.25,2,1,2,0,0.22,0.04,3,0,0.18,0.12,100,0.48,1
```

## Checkpointing & Resume

### Automatic Checkpoints

The script saves checkpoints every 50 examples:

```
data/training/smart-money-flow/
├── checkpoint_test_50.csv
├── checkpoint_test_100.csv
├── checkpoint_test_150.csv
└── smart-money-flow-test.csv (final)
```

### Resume from Checkpoint

If the script crashes or is interrupted:

1. **Identify last checkpoint**:
   ```bash
   ls -lh data/training/smart-money-flow/checkpoint_*.csv
   ```

2. **Manually resume** (not automated - would need to extend script):
   - Start with symbols not yet processed
   - Or re-run entire script (cache will make it fast)

### Recommendation

**For long-running jobs (>100 stocks)**, monitor progress in real-time:

```bash
# Run in tmux/screen session
tmux new -s dataset-gen
npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --top500

# Detach: Ctrl+B, then D
# Reattach: tmux attach -t dataset-gen
```

## Validation

### Automatic Validation

The script automatically validates the dataset:

1. **Completeness Check**: >85% of expected examples generated
2. **Label Balance Check**: 30-70% bullish labels (not too imbalanced)
3. **Missing Data Check**: <15% of examples with missing features

### Example Output

```
================================================================================
📊 Dataset Validation
================================================================================
✅ Completeness: 92.3% (target: >85%)
✅ Label Balance: 42.1% bullish (target: 30-70%)
✅ Missing Data: 8.7% (target: <15%)

✅ Dataset validation PASSED
```

### What to Do if Validation Fails

#### Completeness <85%

**Cause**: Too many API errors or missing data
**Fix**:
1. Check API keys are valid (FMP_API_KEY, etc.)
2. Review error logs for specific symbols failing
3. Exclude problematic symbols and re-run

#### Label Balance <30% or >70%

**Cause**: Market conditions during date range (e.g., bull market = many bullish labels)
**Fix**:
1. Adjust label thresholds in `label-generator.ts` (e.g., change >5% to >7%)
2. Extend date range to include more market conditions
3. Accept imbalance and use class weighting in model training

#### Missing Data >15%

**Cause**: Insufficient historical data for many stocks
**Fix**:
1. Extend date range to ensure sufficient lookback
2. Filter stock universe to only include stocks with complete data
3. Use median imputation (already implemented in FeatureExtractor)

## Cache Management

### View Cache Statistics

During and after generation, cache stats are logged:

```
================================================================================
SMART MONEY CACHE STATISTICS
================================================================================
Cache Hits:        4,523
Cache Misses:      127
Hit Rate:          97.27%
Total Entries:     127
Cache Size:        45.67 MB
================================================================================
```

### Clear Cache (Use with Caution!)

To force fresh API calls (e.g., after API data corrections):

```typescript
import { smartMoneyCache } from "../../../app/services/cache/SmartMoneyDataCache";

// Clear specific symbol
await smartMoneyCache.clear("AAPL");

// Clear specific symbol + data type
await smartMoneyCache.clear("AAPL", "insider_trades");

// Clear ALL cache (DANGER!)
await smartMoneyCache.clearAll();
```

**WARNING**: Clearing cache means next run will take 2+ hours instead of 20 minutes.

## Performance Optimization Tips

### 1. Run During Off-Peak Hours

API rate limits are more lenient during off-peak hours:
- **Best**: 6pm - 6am EST (market closed)
- **Avoid**: 9:30am - 4pm EST (market hours)

### 2. Use Caching Effectively

- **First run**: Accept 2-hour duration to build cache
- **Subsequent runs**: Leverage cache for 20-minute reruns
- **Never clear cache** unless absolutely necessary

### 3. Start Small, Scale Up

1. **Test mode** (3 stocks): Validate pipeline
2. **Top 50** (50 stocks): Test cache efficiency
3. **Top 100** (100 stocks): Medium-scale dataset
4. **Top 500** (500 stocks): Full production dataset

### 4. Monitor Progress

Use `tail -f` to monitor logs in real-time:

```bash
npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --top500 2>&1 | tee dataset-gen.log

# In another terminal:
tail -f dataset-gen.log
```

## Expected Results

### Test Mode (3 Stocks)

```
Total Examples:    ~108
Duration:          5-10 minutes
Cache Hits:        0% (first run), 100% (second run)
Completeness:      95%+
Label Balance:     35-65%
Output Size:       ~50 KB
```

### Top 50 (Production Subset)

```
Total Examples:    ~1,800
Duration:          30-45 minutes (first run), 5 minutes (cached)
Cache Hits:        0% (first run), 95%+ (second run)
Completeness:      90%+
Label Balance:     30-70%
Output Size:       ~2 MB
```

### Top 500 (Full Dataset)

```
Total Examples:    ~18,000
Duration:          2 hours (first run), 20 minutes (cached)
Cache Hits:        0% (first run), 95%+ (second run)
Completeness:      85%+
Label Balance:     30-70%
Output Size:       ~20 MB
```

## Troubleshooting

### Issue: "API rate limit exceeded"

**Symptoms**:
```
Error: API rate limit exceeded (300 calls/minute)
```

**Solutions**:
1. Increase sleep delay in script (currently 200ms)
2. Run during off-peak hours
3. Upgrade FMP API plan

### Issue: "No data found for symbol X"

**Symptoms**:
```
[TSLA] ✗ No label data available
[TSLA] ✗ No insider transactions found, using median values
```

**Solutions**:
1. **Normal**: Some stocks lack institutional data (low coverage)
2. **Check symbol**: Ensure ticker is valid S&P 500 stock
3. **Date range**: Extend date range if stock is too recent

### Issue: "Cache hit rate <50%"

**Symptoms**:
```
Cache Hits:        234
Cache Misses:      456
Hit Rate:          33.91%
```

**Solutions**:
1. **First run**: This is expected (building cache)
2. **Second run**: Check cache directory exists and is writable
3. **Permissions**: Ensure `data/cache/smart-money/` is writable

### Issue: Script crashes after hours

**Symptoms**:
```
[500/18000] (2.78%) AAPL @ 2023-06-15
Error: ENOMEM (out of memory)
```

**Solutions**:
1. **Increase Node.js memory**:
   ```bash
   NODE_OPTIONS="--max-old-space-size=8192" npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --top500
   ```
2. **Use checkpoints**: Resume from last checkpoint
3. **Process in batches**: Run top50 → top100 → top500

## Next Steps

After generating the dataset:

### 1. Split Dataset

Split into train/val/test sets (70/15/15):

```bash
python scripts/ml/smart-money-flow/split-dataset.py
```

**Output**:
- `data/training/smart-money-flow/train.csv`
- `data/training/smart-money-flow/val.csv`
- `data/training/smart-money-flow/test.csv`

### 2. Train Model

Train LightGBM model on training set:

```bash
python scripts/ml/smart-money-flow/train-model.py
```

**Output**:
- `models/smart-money-flow/v1.0.0/model.txt`
- `models/smart-money-flow/v1.0.0/normalizer.json`
- `models/smart-money-flow/v1.0.0/metadata.json`

### 3. Evaluate Model

Test model performance on held-out test set:

```bash
python scripts/ml/smart-money-flow/evaluate-model.py
```

**Output**:
- Accuracy, Precision, Recall, F1, ROC-AUC
- Confusion matrix
- Feature importance

## References

- **Caching Strategy**: `scripts/ml/CLAUDE.md` (HISTORICAL DATA CACHING PRINCIPLE)
- **Implementation Plan**: `docs/ml/plans/SMART_MONEY_FLOW_PLAN.md`
- **TODO Tracking**: `docs/ml/todos/SMART_MONEY_FLOW_TODO.md`
- **Feature Extractor**: `app/services/ml/smart-money-flow/SmartMoneyFlowFeatureExtractor.ts`
- **Label Generator**: `scripts/ml/smart-money-flow/label-generator.ts`
- **Cache Service**: `app/services/cache/SmartMoneyDataCache.ts`
