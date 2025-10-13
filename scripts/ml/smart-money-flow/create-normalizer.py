#!/usr/bin/env python3
"""
Create normalizer.json for Smart Money Flow model from training data
"""

import pandas as pd
import json
from pathlib import Path

# Load training data
TRAIN_DATA = Path('data/training/smart-money-flow-with-options/train.csv')
OUTPUT_FILE = Path('models/smart-money-flow/v3.0.0/normalizer.json')

print("📊 Creating normalizer from training data...")
print()

# Load train dataset
train_df = pd.read_csv(TRAIN_DATA)

# Get feature columns (exclude metadata and target)
EXCLUDE_COLS = ['symbol', 'date', 'price_at_sample', 'price_after_14d', 'return_14d', 'label']
feature_cols = [col for col in train_df.columns if col not in EXCLUDE_COLS]

print(f"   ✓ Loaded {len(train_df):,} training samples")
print(f"   ✓ Extracting statistics for {len(feature_cols)} features")
print()

# Calculate mean and std for each feature
normalizer = {}

for col in feature_cols:
    mean = float(train_df[col].mean())
    std = float(train_df[col].std())

    # Handle zero std (constant features)
    if std == 0 or pd.isna(std):
        std = 1.0

    normalizer[col] = {
        "mean": mean,
        "std": std
    }

# Save normalizer
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT_FILE, 'w') as f:
    json.dump(normalizer, f, indent=2)

print(f"💾 Saved normalizer to: {OUTPUT_FILE}")
print()

# Display sample
print("📋 Sample normalizer values:")
print()
for i, (feature, stats) in enumerate(list(normalizer.items())[:5]):
    print(f"   {feature:35s} → mean: {stats['mean']:10.6f}, std: {stats['std']:10.6f}")

print(f"   ... ({len(normalizer) - 5} more features)")
print()
print("✅ Normalizer created successfully!")
print()
