#!/usr/bin/env python3
"""
Split Sentiment Fusion Dataset
Split training dataset into train/validation/test sets (70/15/15)
"""

import pandas as pd
from sklearn.model_selection import train_test_split
import os

# File paths
INPUT_FILE = "data/training/sentiment-fusion-training.csv"
OUTPUT_DIR = "data/training"
TRAIN_FILE = os.path.join(OUTPUT_DIR, "sentiment-fusion-train.csv")
VAL_FILE = os.path.join(OUTPUT_DIR, "sentiment-fusion-val.csv")
TEST_FILE = os.path.join(OUTPUT_DIR, "sentiment-fusion-test.csv")

# Split ratios
TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
TEST_RATIO = 0.15

print("=" * 80)
print("Sentiment Fusion Dataset Splitter")
print("=" * 80)
print()

# Load dataset
print(f"📂 Loading dataset from {INPUT_FILE}")
df = pd.read_csv(INPUT_FILE)
print(f"✓ Loaded {len(df)} examples")
print()

# Display label distribution
print("📊 Original Label Distribution:")
label_counts = df['label'].value_counts().sort_index()
for label, count in label_counts.items():
    label_name = ["BEARISH", "NEUTRAL", "BULLISH"][label]
    percentage = (count / len(df)) * 100
    print(f"  {label} ({label_name}): {count:,} ({percentage:.1f}%)")
print()

# First split: train vs (val + test)
train_df, temp_df = train_test_split(
    df,
    test_size=(VAL_RATIO + TEST_RATIO),
    random_state=42,
    stratify=df['label']  # Maintain label balance
)

# Second split: val vs test
val_df, test_df = train_test_split(
    temp_df,
    test_size=TEST_RATIO / (VAL_RATIO + TEST_RATIO),
    random_state=42,
    stratify=temp_df['label']
)

print(f"✂️  Split Strategy:")
print(f"  Train:      {len(train_df):,} examples ({len(train_df)/len(df)*100:.1f}%)")
print(f"  Validation: {len(val_df):,} examples ({len(val_df)/len(df)*100:.1f}%)")
print(f"  Test:       {len(test_df):,} examples ({len(test_df)/len(df)*100:.1f}%)")
print()

# Verify label distribution in each split
print("📊 Label Distribution Per Split:")
print()

for split_name, split_df in [("Train", train_df), ("Validation", val_df), ("Test", test_df)]:
    print(f"{split_name}:")
    split_counts = split_df['label'].value_counts().sort_index()
    for label, count in split_counts.items():
        label_name = ["BEARISH", "NEUTRAL", "BULLISH"][label]
        percentage = (count / len(split_df)) * 100
        print(f"  {label} ({label_name}): {count:,} ({percentage:.1f}%)")
    print()

# Save splits
print("💾 Saving split datasets...")
train_df.to_csv(TRAIN_FILE, index=False)
print(f"✓ Saved training set: {TRAIN_FILE}")

val_df.to_csv(VAL_FILE, index=False)
print(f"✓ Saved validation set: {VAL_FILE}")

test_df.to_csv(TEST_FILE, index=False)
print(f"✓ Saved test set: {TEST_FILE}")
print()

print("=" * 80)
print("✅ Dataset Split Complete!")
print("=" * 80)
print()
print("📝 Next Steps:")
print("  1. Fine-tune FinBERT: python3 scripts/ml/sentiment-fusion/train-finbert.py")
print("  2. Evaluate test set: python3 scripts/ml/sentiment-fusion/evaluate-test-set.py")
print("=" * 80)
