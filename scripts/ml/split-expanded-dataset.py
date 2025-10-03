#!/usr/bin/env python3
"""Split the expanded 1,051-example dataset into train/val/test with temporal ordering"""

import pandas as pd

# Load expanded dataset
df = pd.read_csv('data/training/early-signal-combined-1051-v2.csv')
print(f"Loaded {len(df)} examples with {len(df.columns)} columns")

# Sort by date for temporal split (prevents data leakage)
df['date'] = pd.to_datetime(df['date'])
df_sorted = df.sort_values('date').reset_index(drop=True)

# Temporal split: 80% train, 10% val, 10% test
train_size = int(0.8 * len(df_sorted))
val_size = int(0.1 * len(df_sorted))

train_df = df_sorted[:train_size]
val_df = df_sorted[train_size:train_size + val_size]
test_df = df_sorted[train_size + val_size:]

print(f"\nTrain: {len(train_df)} examples ({len(train_df)/len(df)*100:.1f}%)")
print(f"  Date range: {train_df['date'].min()} to {train_df['date'].max()}")
print(f"Val: {len(val_df)} examples ({len(val_df)/len(df)*100:.1f}%)")
print(f"  Date range: {val_df['date'].min()} to {val_df['date'].max()}")
print(f"Test: {len(test_df)} examples ({len(test_df)/len(df)*100:.1f}%)")
print(f"  Date range: {test_df['date'].min()} to {test_df['date'].max()}")

# Check label distribution
print(f"\nLabel distribution:")
print(f"Train: {train_df['label'].sum()} upgrades ({train_df['label'].sum()/len(train_df)*100:.1f}%)")
print(f"Val: {val_df['label'].sum()} upgrades ({val_df['label'].sum()/len(val_df)*100:.1f}%)")
print(f"Test: {test_df['label'].sum()} upgrades ({test_df['label'].sum()/len(test_df)*100:.1f}%)")

# Save
train_df.to_csv('data/training/train.csv', index=False)
val_df.to_csv('data/training/val.csv', index=False)
test_df.to_csv('data/training/test.csv', index=False)

print("\n✓ Saved train.csv, val.csv, test.csv")
