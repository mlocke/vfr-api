#!/usr/bin/env python3
"""
Split Polygon Training Dataset

Splits the unified polygon_training_dataset.csv into train (70%), validation (15%),
and test (15%) sets with label stratification.

Usage:
    python3 scripts/ml/split-polygon-dataset.py
"""

import pandas as pd
from sklearn.model_selection import train_test_split
import os

def split_polygon_dataset():
    """Split dataset into train/val/test with stratification"""

    print("=" * 80)
    print("SPLIT POLYGON TRAINING DATASET")
    print("=" * 80)
    print()

    # Load unified dataset
    input_file = "data/training/polygon_training_dataset.csv"

    if not os.path.exists(input_file):
        print(f"❌ Error: {input_file} not found")
        print("Run: python3 scripts/ml/merge-polygon-features.py first")
        return

    print(f"📂 Loading dataset: {input_file}")
    df = pd.read_csv(input_file)
    print(f"   ✓ Loaded {len(df):,} examples")
    print()

    # Split: 70% train, 15% val, 15% test (stratified by label)
    print("🔀 Splitting dataset...")
    print("   Strategy: 70% train, 15% validation, 15% test")
    print("   Stratification: By label (DOWN/NEUTRAL/UP)")
    print()

    # First split: 70% train, 30% temp
    train_df, temp_df = train_test_split(
        df,
        test_size=0.30,
        random_state=42,
        stratify=df['label']
    )

    # Second split: 50/50 of temp = 15% val, 15% test
    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.50,
        random_state=42,
        stratify=temp_df['label']
    )

    print(f"   ✓ Train set: {len(train_df):,} examples ({len(train_df)/len(df)*100:.1f}%)")
    print(f"   ✓ Validation set: {len(val_df):,} examples ({len(val_df)/len(df)*100:.1f}%)")
    print(f"   ✓ Test set: {len(test_df):,} examples ({len(test_df)/len(df)*100:.1f}%)")
    print()

    # Verify label distribution is preserved
    print("Label distribution verification:")
    print()
    print("  Original:")
    original_dist = df['label'].value_counts(normalize=True).sort_index() * 100
    for label, pct in original_dist.items():
        print(f"    {label}: {pct:.1f}%")
    print()

    print("  Train:")
    train_dist = train_df['label'].value_counts(normalize=True).sort_index() * 100
    for label, pct in train_dist.items():
        print(f"    {label}: {pct:.1f}%")
    print()

    print("  Validation:")
    val_dist = val_df['label'].value_counts(normalize=True).sort_index() * 100
    for label, pct in val_dist.items():
        print(f"    {label}: {pct:.1f}%")
    print()

    print("  Test:")
    test_dist = test_df['label'].value_counts(normalize=True).sort_index() * 100
    for label, pct in test_dist.items():
        print(f"    {label}: {pct:.1f}%")
    print()

    # Save splits
    train_file = "data/training/polygon-train.csv"
    val_file = "data/training/polygon-val.csv"
    test_file = "data/training/polygon-test.csv"

    print("💾 Saving dataset splits...")
    train_df.to_csv(train_file, index=False)
    print(f"   ✓ {train_file}")

    val_df.to_csv(val_file, index=False)
    print(f"   ✓ {val_file}")

    test_df.to_csv(test_file, index=False)
    print(f"   ✓ {test_file}")
    print()

    print("=" * 80)
    print("✅ COMPLETE - DATASET SPLIT")
    print("=" * 80)
    print()
    print("Next steps:")
    print("  1. Train model: python3 scripts/ml/train-polygon-model.py")
    print("  2. Evaluate on test set")
    print()


if __name__ == "__main__":
    split_polygon_dataset()
