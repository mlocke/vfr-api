#!/usr/bin/env python3
"""
Merge Options Features with Existing Smart Money Flow Training Data
Adds options features to train/val/test datasets
"""

import pandas as pd
import numpy as np
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# Directories
LEAN_DIR = Path('data/training/smart-money-flow-lean')
OPTIONS_FEATURES = LEAN_DIR / 'options_features.csv'
OUTPUT_DIR = Path('data/training/smart-money-flow-with-options')

def load_datasets():
    """Load train, val, test datasets"""
    print("📂 Loading existing datasets...")

    train_df = pd.read_csv(LEAN_DIR / 'train.csv')
    val_df = pd.read_csv(LEAN_DIR / 'val.csv')
    test_df = pd.read_csv(LEAN_DIR / 'test.csv')

    print(f"   ✓ Train: {len(train_df):,} samples")
    print(f"   ✓ Val:   {len(val_df):,} samples")
    print(f"   ✓ Test:  {len(test_df):,} samples")
    print()

    return train_df, val_df, test_df

def load_options_features():
    """Load options features lookup table"""
    print("📂 Loading options features...")

    if not OPTIONS_FEATURES.exists():
        print(f"   ❌ Options features not found: {OPTIONS_FEATURES}")
        print(f"   Run extract-options-features.py first!")
        exit(1)

    options_df = pd.read_csv(OPTIONS_FEATURES)
    print(f"   ✓ Loaded features for {len(options_df)} tickers")
    print(f"   ✓ Features: {len(options_df.columns) - 1} options metrics")
    print()

    return options_df

def merge_options_features(df, options_df):
    """Merge options features into dataset by ticker symbol"""
    print(f"🔗 Merging options features...")

    # Get initial counts
    initial_rows = len(df)
    initial_features = len(df.columns)

    # Merge on symbol (left join to keep all rows)
    merged_df = df.merge(options_df, on='symbol', how='left')

    # Fill missing options features with 0 (for tickers without options data)
    options_cols = [col for col in options_df.columns if col != 'symbol']
    merged_df[options_cols] = merged_df[options_cols].fillna(0.0)

    final_rows = len(merged_df)
    final_features = len(merged_df.columns)

    print(f"   ✓ Rows: {initial_rows:,} → {final_rows:,}")
    print(f"   ✓ Features: {initial_features} → {final_features} (+{final_features - initial_features} options features)")
    print()

    # Show which tickers got options data
    tickers_with_options = merged_df[merged_df[options_cols[0]] != 0]['symbol'].nunique()
    total_tickers = merged_df['symbol'].nunique()
    print(f"   ℹ️  Tickers with options data: {tickers_with_options}/{total_tickers}")
    print()

    return merged_df

def save_datasets(train_df, val_df, test_df):
    """Save merged datasets"""
    print("💾 Saving merged datasets...")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    train_df.to_csv(OUTPUT_DIR / 'train.csv', index=False)
    val_df.to_csv(OUTPUT_DIR / 'val.csv', index=False)
    test_df.to_csv(OUTPUT_DIR / 'test.csv', index=False)

    print(f"   ✓ Saved to: {OUTPUT_DIR}/")
    print(f"   ✓ train.csv: {len(train_df):,} rows × {len(train_df.columns)} features")
    print(f"   ✓ val.csv:   {len(val_df):,} rows × {len(val_df.columns)} features")
    print(f"   ✓ test.csv:  {len(test_df):,} rows × {len(test_df.columns)} features")
    print()

def main():
    """Main merge pipeline"""
    print("=" * 70)
    print("🔗 MERGING OPTIONS FEATURES WITH TRAINING DATA")
    print("=" * 70)
    print()

    # Load datasets
    train_df, val_df, test_df = load_datasets()

    # Load options features
    options_df = load_options_features()

    # Merge options features into each dataset
    train_merged = merge_options_features(train_df, options_df)
    val_merged = merge_options_features(val_df, options_df)
    test_merged = merge_options_features(test_df, options_df)

    # Save merged datasets
    save_datasets(train_merged, val_merged, test_merged)

    # Show final feature list
    print("📋 Final Feature List:")
    print()
    feature_cols = [col for col in train_merged.columns if col not in ['symbol', 'date', 'price_at_sample', 'price_after_14d', 'return_14d', 'label']]
    for i, col in enumerate(feature_cols, 1):
        is_options = col in options_df.columns
        marker = "🆕" if is_options else "  "
        print(f"   {marker} {i:2d}. {col}")

    print()
    print(f"   Total: {len(feature_cols)} features")
    print()

    print("=" * 70)
    print("✅ MERGE COMPLETE")
    print("=" * 70)
    print()
    print(f"Next step: python scripts/ml/smart-money-flow/train-lightgbm.py {OUTPUT_DIR}")
    print()

if __name__ == '__main__':
    main()
