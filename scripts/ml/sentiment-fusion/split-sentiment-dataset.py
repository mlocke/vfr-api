#!/usr/bin/env python3
"""
Split sentiment fusion dataset into train/validation/test sets
Maintains label stratification for balanced splits
"""

import os
import pandas as pd
from sklearn.model_selection import train_test_split

# Paths
INPUT_FILE = "data/training/sentiment-fusion-training.csv"
TRAIN_FILE = "data/training/sentiment-fusion-train.csv"
VAL_FILE = "data/training/sentiment-fusion-val.csv"
TEST_FILE = "data/training/sentiment-fusion-test.csv"

# Split ratios
TRAIN_RATIO = 0.70  # 70%
VAL_RATIO = 0.15    # 15%
TEST_RATIO = 0.15   # 15%

print("=" * 80)
print("Sentiment Fusion Dataset Splitter")
print("=" * 80)
print(f"Input: {INPUT_FILE}")
print(f"Train: {TRAIN_FILE} ({TRAIN_RATIO*100:.0f}%)")
print(f"Val: {VAL_FILE} ({VAL_RATIO*100:.0f}%)")
print(f"Test: {TEST_FILE} ({TEST_RATIO*100:.0f}%)")
print("=" * 80)
print()

# Load dataset
print("📂 Loading dataset...")
df = pd.read_csv(INPUT_FILE)
print(f"✓ Loaded {len(df):,} examples")
print()

# Check label distribution
print("📊 Original Label Distribution:")
label_names = {0: "BEARISH", 1: "NEUTRAL", 2: "BULLISH"}
for label_val, label_name in label_names.items():
    count = (df['label'] == label_val).sum()
    percentage = (count / len(df)) * 100
    print(f"  {label_val} ({label_name}): {count:,} ({percentage:.1f}%)")
print()

# First split: separate test set
print("🔪 Splitting dataset...")
train_val_df, test_df = train_test_split(
    df,
    test_size=TEST_RATIO,
    random_state=42,
    stratify=df['label']
)

# Second split: separate train and validation
val_ratio_adjusted = VAL_RATIO / (TRAIN_RATIO + VAL_RATIO)
train_df, val_df = train_test_split(
    train_val_df,
    test_size=val_ratio_adjusted,
    random_state=42,
    stratify=train_val_df['label']
)

print(f"✓ Train: {len(train_df):,} examples")
print(f"✓ Val: {len(val_df):,} examples")
print(f"✓ Test: {len(test_df):,} examples")
print()

# Verify label distribution in each split
print("📊 Split Label Distributions:")
for split_name, split_df in [("Train", train_df), ("Val", val_df), ("Test", test_df)]:
    print(f"\n{split_name} set:")
    for label_val, label_name in label_names.items():
        count = (split_df['label'] == label_val).sum()
        percentage = (count / len(split_df)) * 100
        print(f"  {label_val} ({label_name}): {count:,} ({percentage:.1f}%)")

print()

# Save splits
print("💾 Saving split datasets...")
train_df.to_csv(TRAIN_FILE, index=False)
val_df.to_csv(VAL_FILE, index=False)
test_df.to_csv(TEST_FILE, index=False)

print(f"✓ Train saved to {TRAIN_FILE}")
print(f"✓ Val saved to {VAL_FILE}")
print(f"✓ Test saved to {TEST_FILE}")
print()

print("=" * 80)
print("✅ Dataset splitting complete!")
print("=" * 80)
print()
print("📝 Next Steps:")
print("  1. Train model: python3 scripts/ml/sentiment-fusion/train-finbert.py")
print("  2. Evaluate model: python3 scripts/ml/sentiment-fusion/evaluate-test-set.py")
print("=" * 80)
