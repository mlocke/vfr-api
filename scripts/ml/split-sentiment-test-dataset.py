#!/usr/bin/env python3
"""
Split sentiment test dataset (1,000 rows) into train/val/test sets
"""

import pandas as pd
from sklearn.model_selection import train_test_split

# Load dataset
print("Loading dataset...")
df = pd.read_csv("data/training/price-prediction-with-sentiment-test.csv")
print(f"✓ Loaded {len(df)} rows, {len(df.columns)} columns")

# Check label distribution
print("\nLabel Distribution:")
print(df['label'].value_counts())
print(df['label'].value_counts(normalize=True))

# Split: 70% train, 15% val, 15% test
# First split: 70% train, 30% temp
train_df, temp_df = train_test_split(
    df,
    test_size=0.3,
    random_state=42,
    stratify=df['label']
)

# Second split: 50% val, 50% test (from the 30% temp)
val_df, test_df = train_test_split(
    temp_df,
    test_size=0.5,
    random_state=42,
    stratify=temp_df['label']
)

print(f"\n✓ Train: {len(train_df)} rows")
print(f"✓ Val:   {len(val_df)} rows")
print(f"✓ Test:  {len(test_df)} rows")

# Save splits
train_df.to_csv("data/training/price-sentiment-test-train.csv", index=False)
val_df.to_csv("data/training/price-sentiment-test-val.csv", index=False)
test_df.to_csv("data/training/price-sentiment-test-test.csv", index=False)

print("\n✅ Splits saved:")
print("  - data/training/price-sentiment-test-train.csv")
print("  - data/training/price-sentiment-test-val.csv")
print("  - data/training/price-sentiment-test-test.csv")
