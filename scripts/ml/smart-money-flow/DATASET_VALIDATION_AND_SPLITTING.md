# Smart Money Flow - Dataset Validation and Splitting

This document describes the dataset validation and splitting scripts for the Smart Money Flow ML model.

## Overview

These scripts are part of **Phase 1: Data Collection & Feature Engineering** of the Smart Money Flow implementation (TODO lines 229-289).

## Scripts

### 1. validate-dataset.ts - Dataset Validation

**Purpose**: Validate training dataset quality before model training

**Location**: `/scripts/ml/smart-money-flow/validate-dataset.ts`

**Reference**: `/scripts/ml/validate-training-data.ts` (Early Signal validation)

#### Validation Checks

The script performs 6 comprehensive validation checks:

1. **Completeness** (>85% features populated)
   - Checks that at least 85% of all feature values are non-null/non-NaN
   - Severity: CRITICAL if failed
   - Recommendation: Re-generate dataset with better error handling

2. **Label Balance** (30-70% bullish)
   - Ensures labels aren't extremely imbalanced
   - Target: 30-70% bullish (1) vs bearish (0)
   - Severity: WARNING if failed
   - Recommendation: Adjust label generation logic or use composite labeling

3. **Feature Distributions** (No extreme outliers)
   - Detects outliers beyond 1st/99th percentile
   - Acceptable: <5% outlier rate
   - Severity: WARNING if failed
   - Recommendation: Winsorize features or investigate data quality

4. **Temporal Integrity** (No lookahead bias)
   - Verifies dates are in chronological order per symbol
   - Ensures no future data used for past predictions
   - Severity: CRITICAL if failed
   - Recommendation: Fix data collection temporal ordering

5. **Missing Data Per Feature** (<10% missing)
   - Checks that each individual feature has <10% missing values
   - Severity: WARNING if failed
   - Recommendation: Implement median imputation or investigate data sources

6. **Symbol Coverage** (All 500 stocks represented)
   - Verifies all expected stocks have training examples
   - Checks for low-coverage stocks (<10 samples)
   - Severity: WARNING if failed
   - Recommendation: Ensure dataset generation covers all target stocks

#### Feature Statistics

The script also generates detailed statistics for all 27 features:
- Mean
- Standard deviation
- Min/max range

This helps identify features with unusual distributions or poor data quality.

#### Usage

```bash
# Validate default dataset
npx tsx scripts/ml/smart-money-flow/validate-dataset.ts

# Validate specific file
npx tsx scripts/ml/smart-money-flow/validate-dataset.ts --input data/training/smart-money-flow/custom-dataset.csv
```

#### Output

The script generates a comprehensive validation report:

```
================================================================================
Smart Money Flow - Training Dataset Validation
Phase 1: Dataset Validation (TODO lines 229-258)
================================================================================

Input file: data/training/smart-money-flow/full-dataset.csv
File size: 2345.67 KB

Loading dataset...
✓ Loaded 18000 training examples

================================================================================
Running validation checks...
================================================================================

1. Completeness: [PASS]
   92.45% features populated (446640/483000). Target: >85%

2. Label Balance: [PASS]
   45.23% bullish labels (8141/18000). Target: 30-70%

3. Outlier Detection: [PASS]
   2.34% outliers detected. Within acceptable range.

4. Temporal Integrity: [PASS]
   No temporal leakage detected. Dates are in chronological order.

5. Missing Data Per Feature: [PASS]
   All features have <10% missing data. Max: congress_buy_count_90d (7.23%)

6. Symbol Coverage: [PASS]
   500 unique symbols (target: 500). All symbols represented.

================================================================================
Feature Statistics:
================================================================================
  insider_buy_ratio_30d: mean=0.523, std=0.234, range=[0.000, 1.000]
  insider_buy_volume_30d: mean=12345.678, std=23456.789, range=[0.000, 123456.000]
  ...

================================================================================
Validation Summary
================================================================================

✓ Passed: 6/6 checks

All validation checks passed! Dataset is ready for model training.

Next step: Split dataset into train/val/test (Task: Dataset Splitting)
   python scripts/ml/smart-money-flow/split-dataset.py
```

#### Exit Codes

- **0**: All checks passed or only warnings
- **1**: Critical validation failures detected

---

### 2. split-dataset.py - Dataset Splitting

**Purpose**: Split dataset into train/val/test sets with stratified sampling

**Location**: `/scripts/ml/smart-money-flow/split-dataset.py`

**Reference**: `/scripts/ml/split-new-dataset.py` (Early Signal splitting)

#### Split Strategy

The script implements a stratified split to maintain label balance:

1. **70% Training** (~12,600 examples from 18,000)
   - Used for model learning
   - Contains same label distribution as full dataset

2. **15% Validation** (~2,700 examples)
   - Used for hyperparameter tuning and early stopping
   - Maintains label balance

3. **15% Test** (~2,700 examples)
   - Used for final model evaluation
   - Held-out set, never seen during training

#### Stratification

Uses `sklearn.model_selection.train_test_split` with `stratify=df['label']` to ensure:
- Label distribution maintained across all splits (within 2% tolerance)
- No class imbalance in validation/test sets
- Fair evaluation of model performance

#### Usage

```bash
# Split default dataset
python scripts/ml/smart-money-flow/split-dataset.py

# Split specific file
python scripts/ml/smart-money-flow/split-dataset.py --input data/training/smart-money-flow/custom-dataset.csv

# Show help
python scripts/ml/smart-money-flow/split-dataset.py --help
```

#### Output

The script creates 3 CSV files and prints comprehensive statistics:

```
================================================================================
Smart Money Flow - Dataset Splitting
Phase 1: Dataset Splitting (TODO lines 261-289)
================================================================================

Input file: data/training/smart-money-flow/full-dataset.csv
File size: 2345.67 KB

Loading dataset...
✓ Loaded 18000 training examples
✓ Features: 27 (symbol, date, label excluded)

Label distribution:
  BULLISH (1): 8141 examples (45.23%)
  BEARISH (0): 9859 examples (54.77%)

✓ Dataset shuffled with random_state=42

================================================================================
Split Statistics
================================================================================

Train set: 12600 examples (70.0%)
  BULLISH: 5699 (45.23%)
  BEARISH: 6901 (54.77%)

Validation set: 2700 examples (15.0%)
  BULLISH: 1221 (45.22%)
  BEARISH: 1479 (54.78%)

Test set: 2700 examples (15.0%)
  BULLISH: 1221 (45.22%)
  BEARISH: 1479 (54.78%)

================================================================================
Stratification Verification
================================================================================

Bullish % (target: 45.23%):
  Train: 45.23% (diff: 0.00%)
  Val:   45.22% (diff: 0.01%)
  Test:  45.22% (diff: 0.01%)

✓ Stratification successful: Max difference 0.01% < 2.0%

================================================================================
Saving splits to CSV files...
================================================================================

✓ Saved train set: data/training/smart-money-flow/train.csv
✓ Saved validation set: data/training/smart-money-flow/val.csv
✓ Saved test set: data/training/smart-money-flow/test.csv

================================================================================
Split Complete!
================================================================================

Total examples: 18000
  Train:      12600 (70.0%)
  Validation: 2700 (15.0%)
  Test:       2700 (15.0%)

Label balance maintained across all splits

Next step: Train Smart Money Flow model (Phase 2)
   python scripts/ml/smart-money-flow/train-model.py

================================================================================
```

#### Output Files

- `data/training/smart-money-flow/train.csv` - Training set (70%)
- `data/training/smart-money-flow/val.csv` - Validation set (15%)
- `data/training/smart-money-flow/test.csv` - Test set (15%)

Each file contains the same columns as the input dataset:
- `symbol` - Stock ticker
- `date` - Sample date
- 27 feature columns (insider, institutional, congressional, hedge fund, ETF)
- `label` - Binary label (0=BEARISH, 1=BULLISH)

#### Exit Codes

- **0**: Successful split
- **1**: Error during splitting (file not found, invalid data, etc.)

---

## Workflow Integration

These scripts are part of the complete Smart Money Flow training pipeline:

### Full Pipeline

```bash
# Step 1: Generate dataset (not yet implemented)
npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --top1000 --monthly

# Step 2: Validate dataset quality
npx tsx scripts/ml/smart-money-flow/validate-dataset.ts

# Step 3: Split into train/val/test
python scripts/ml/smart-money-flow/split-dataset.py

# Step 4: Train model (not yet implemented)
python scripts/ml/smart-money-flow/train-model.py

# Step 5: Evaluate on test set (not yet implemented)
python scripts/ml/smart-money-flow/evaluate-test-set.py

# Step 6: Register model (not yet implemented)
npx tsx scripts/ml/smart-money-flow/register-model.ts --version v1.0.0
```

---

## Feature Set (27 Features)

### Insider Trading Features (8)
1. `insider_buy_ratio_30d` - Buy/total transactions ratio (30 days)
2. `insider_buy_volume_30d` - Total shares purchased
3. `insider_sell_volume_30d` - Total shares sold
4. `insider_net_flow_30d` - Net buy/sell volume
5. `insider_cluster_score` - Multiple insiders buying within 7 days
6. `insider_ownership_change_90d` - Ownership change (90 days)
7. `insider_avg_premium` - Average premium paid above market
8. `c_suite_activity_ratio` - C-level transactions ratio

### Institutional Ownership Features (7)
9. `inst_ownership_pct` - % held by institutions
10. `inst_ownership_change_1q` - Quarterly ownership change
11. `inst_new_positions_count` - New institutional buyers
12. `inst_closed_positions_count` - Institutions that exited
13. `inst_avg_position_size_change` - Average position size change
14. `inst_concentration_top10` - Top 10 institutions ownership %
15. `inst_momentum_score` - Weighted momentum score

### Congressional Trading Features (4)
16. `congress_buy_count_90d` - Buy transactions (90 days)
17. `congress_sell_count_90d` - Sell transactions (90 days)
18. `congress_net_sentiment` - Buy minus sell count
19. `congress_recent_activity_7d` - Activity in past 7 days (boolean)

### Hedge Fund Holdings Features (5)
20. `hedgefund_top20_exposure` - Top 20 hedge funds ownership %
21. `hedgefund_net_change_1q` - Quarterly holdings change
22. `hedgefund_new_entry_count` - New hedge fund positions
23. `hedgefund_exit_count` - Hedge funds that exited
24. `hedgefund_conviction_score` - Weighted conviction score

### ETF Holdings Features (3)
25. `etf_ownership_pct` - % held by ETFs
26. `etf_flow_30d` - Net ETF buying/selling
27. `etf_concentration` - Top 5 ETFs ownership %

---

## Dataset Requirements

For successful validation and splitting:

### Minimum Requirements

- **Total examples**: 1,000+ (18,000 target)
- **Completeness**: >85% features populated
- **Label balance**: 30-70% bullish
- **Missing data**: <10% per feature
- **Symbol coverage**: All 500 S&P 500 stocks

### Recommended Dataset Size

- **500 stocks** × **36 months** = **18,000 examples**
- Ensures robust model generalization
- Provides sufficient validation/test sets

---

## Troubleshooting

### Validation Failures

**CRITICAL: Completeness < 85%**
- Issue: Too many missing values
- Fix: Re-generate dataset with better error handling
- Fix: Implement median imputation for missing features

**CRITICAL: Temporal Leakage**
- Issue: Dates not in chronological order
- Fix: Check data collection logic
- Fix: Ensure features don't use future data

**WARNING: Label Imbalance**
- Issue: Labels too skewed (e.g., 90% bullish)
- Fix: Adjust label generation logic
- Fix: Use composite labeling method (price + smart money signals)

**WARNING: Excessive Outliers**
- Issue: >5% outliers detected
- Fix: Winsorize features at 1st/99th percentile
- Fix: Investigate data source quality

### Splitting Failures

**File Not Found**
- Issue: Input dataset doesn't exist
- Fix: Run dataset generation first
- Fix: Check file path

**Stratification Warning**
- Issue: Label balance difference >2%
- Fix: Check if dataset is too small
- Fix: Verify label distribution in input

**Low Example Count**
- Issue: <100 examples in dataset
- Fix: Generate more training data
- Fix: Extend date range or increase stock universe

---

## Related Documentation

- **TODO**: `/docs/ml/todos/SMART_MONEY_FLOW_TODO.md` (lines 229-289)
- **Plan**: `/docs/ml/plans/SMART_MONEY_FLOW_PLAN.md`
- **Types**: `/app/services/ml/smart-money-flow/types.ts`
- **Reference**: `/scripts/ml/validate-training-data.ts` (Early Signal validation)
- **Reference**: `/scripts/ml/split-new-dataset.py` (Early Signal splitting)

---

## Next Steps

After successful validation and splitting:

1. **Train model** (Phase 2):
   ```bash
   python scripts/ml/smart-money-flow/train-model.py
   ```

2. **Evaluate on test set** (Phase 2):
   ```bash
   python scripts/ml/smart-money-flow/evaluate-test-set.py
   ```

3. **Register model** (Phase 4):
   ```bash
   npx tsx scripts/ml/smart-money-flow/register-model.ts --version v1.0.0
   ```

---

**Created**: 2025-10-10
**Status**: Complete (Phase 1 - TODO lines 229-289)
**Next Phase**: Model Training (Phase 2)
