#!/usr/bin/env python3
"""
Split smart money flow dataset into train/validation/test sets.
Ensures proper temporal ordering and label distribution.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split

def split_dataset(
    input_file: str = "data/training/smart-money-flow/smart-money-flow-master.csv",
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    random_state: int = 42
):
    """
    Split dataset into train/val/test sets with temporal awareness.

    Args:
        input_file: Path to master dataset
        train_ratio: Proportion for training set (default 70%)
        val_ratio: Proportion for validation set (default 15%)
        test_ratio: Proportion for test set (default 15%)
        random_state: Random seed for reproducibility
    """

    print(f"📖 Loading dataset from {input_file}...")
    df = pd.read_csv(input_file)

    print(f"   Total rows: {len(df):,}")
    print(f"   Features: {len([col for col in df.columns if col not in ['symbol', 'date', 'label']]):,}")

    # Ensure ratios sum to 1.0
    assert abs(train_ratio + val_ratio + test_ratio - 1.0) < 0.001, "Ratios must sum to 1.0"

    # Sort by date to maintain temporal ordering
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)

    print(f"   Date range: {df['date'].min()} to {df['date'].max()}")

    # Split by date ranges (temporal split to prevent data leakage)
    n = len(df)
    train_end_idx = int(n * train_ratio)
    val_end_idx = int(n * (train_ratio + val_ratio))

    train_df = df.iloc[:train_end_idx].copy()
    val_df = df.iloc[train_end_idx:val_end_idx].copy()
    test_df = df.iloc[val_end_idx:].copy()

    print(f"\n📊 Split sizes (temporal split):")
    print(f"   Train: {len(train_df):,} rows ({len(train_df)/len(df)*100:.1f}%)")
    print(f"   Val:   {len(val_df):,} rows ({len(val_df)/len(df)*100:.1f}%)")
    print(f"   Test:  {len(test_df):,} rows ({len(test_df)/len(df)*100:.1f}%)")

    # Show date ranges for each split
    print(f"\n📅 Date ranges:")
    print(f"   Train: {train_df['date'].min()} to {train_df['date'].max()}")
    print(f"   Val:   {val_df['date'].min()} to {val_df['date'].max()}")
    print(f"   Test:  {test_df['date'].min()} to {test_df['date'].max()}")

    # Show label distribution for each split
    print(f"\n📈 Label distribution:")
    for split_name, split_df in [("Train", train_df), ("Val", val_df), ("Test", test_df)]:
        label_dist = split_df['label'].value_counts().sort_index()
        dist_str = ", ".join([f"{label}={count:,}" for label, count in label_dist.items()])
        print(f"   {split_name}: {dist_str}")

    # Save splits
    output_dir = Path("data/training/smart-money-flow")
    output_dir.mkdir(parents=True, exist_ok=True)

    train_file = output_dir / "train.csv"
    val_file = output_dir / "val.csv"
    test_file = output_dir / "test.csv"

    print(f"\n💾 Saving splits...")
    train_df.to_csv(train_file, index=False)
    print(f"   ✓ {train_file}")

    val_df.to_csv(val_file, index=False)
    print(f"   ✓ {val_file}")

    test_df.to_csv(test_file, index=False)
    print(f"   ✓ {test_file}")

    # Generate dataset statistics
    print(f"\n📊 Dataset Statistics:")
    print(f"   Total samples: {len(df):,}")
    print(f"   Unique symbols: {df['symbol'].nunique()}")

    feature_cols = [col for col in df.columns
                   if col not in ['symbol', 'date', 'price_at_sample', 'price_after_14d', 'return_14d', 'label']]

    print(f"   Feature columns: {len(feature_cols)}")
    print(f"\n   Features:")
    for col in feature_cols:
        print(f"     - {col}")

    # Check for missing values
    missing_counts = df[feature_cols].isnull().sum()
    if missing_counts.sum() > 0:
        print(f"\n   ⚠️  Missing values detected:")
        for col, count in missing_counts[missing_counts > 0].items():
            pct = (count / len(df)) * 100
            print(f"     - {col}: {count:,} ({pct:.2f}%)")
    else:
        print(f"\n   ✓ No missing values")

    return train_df, val_df, test_df

if __name__ == "__main__":
    print("=" * 70)
    print("Smart Money Flow Dataset Splitter")
    print("=" * 70 + "\n")

    train_df, val_df, test_df = split_dataset()

    print("\n" + "=" * 70)
    print("✅ Dataset split complete!")
    print("=" * 70)
    print("\nNext steps:")
    print("  1. Train model: python scripts/ml/train-smart-money-model.py")
    print("  2. Evaluate: python scripts/ml/evaluate-smart-money-model.py")
    print("  3. Deploy: Update API to use new model")
