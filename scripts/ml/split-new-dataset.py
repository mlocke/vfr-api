#!/usr/bin/env python3
"""Split the new dataset into train/val/test"""

import pandas as pd

# Load dataset
df = pd.read_csv('data/training/early-signal-v2-fixed-macro.csv')
print(f"Total examples: {len(df)}")

# Shuffle for random split
df_shuffled = df.sample(frac=1, random_state=42).reset_index(drop=True)

# Split: 80% train, 10% val, 10% test
train_size = int(0.8 * len(df_shuffled))
val_size = int(0.1 * len(df_shuffled))

train_df = df_shuffled[:train_size]
val_df = df_shuffled[train_size:train_size + val_size]
test_df = df_shuffled[train_size + val_size:]

print(f"Train: {len(train_df)} examples ({len(train_df)/len(df)*100:.1f}%)")
print(f"Val: {len(val_df)} examples ({len(val_df)/len(df)*100:.1f}%)")
print(f"Test: {len(test_df)} examples ({len(test_df)/len(df)*100:.1f}%)")

# Save
train_df.to_csv('data/training/train.csv', index=False)
val_df.to_csv('data/training/val.csv', index=False)
test_df.to_csv('data/training/test.csv', index=False)

print("\n✓ Saved train.csv, val.csv, test.csv")
