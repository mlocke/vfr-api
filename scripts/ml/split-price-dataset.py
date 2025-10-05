#!/usr/bin/env python3
"""
Split price prediction dataset into train/val/test sets

70% train, 15% val, 15% test with stratification
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split

def split_dataset(input_file, output_dir='data/training'):
    print("🔀 Splitting Price Prediction Dataset")
    print("=" * 80)

    # Load dataset
    df = pd.read_csv(input_file)
    print(f"  Total Examples: {len(df):,}")

    # Check label distribution
    print(f"\n  Label Distribution:")
    label_dist = df['label'].value_counts()
    for label, count in label_dist.items():
        pct = 100 * count / len(df)
        print(f"    {label}: {count:,} ({pct:.1f}%)")

    # Split: 70% train, 30% temp (which becomes 15% val + 15% test)
    train_df, temp_df = train_test_split(
        df,
        test_size=0.3,
        stratify=df['label'],
        random_state=42
    )

    # Split temp into val and test (50/50 = 15% each of total)
    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.5,
        stratify=temp_df['label'],
        random_state=42
    )

    # Save splits
    train_file = f'{output_dir}/price-train.csv'
    val_file = f'{output_dir}/price-val.csv'
    test_file = f'{output_dir}/price-test.csv'

    train_df.to_csv(train_file, index=False)
    val_df.to_csv(val_file, index=False)
    test_df.to_csv(test_file, index=False)

    print(f"\n  Split Sizes:")
    print(f"    Train: {len(train_df):,} ({100*len(train_df)/len(df):.1f}%)")
    print(f"    Val:   {len(val_df):,} ({100*len(val_df)/len(df):.1f}%)")
    print(f"    Test:  {len(test_df):,} ({100*len(test_df)/len(df):.1f}%)")

    print(f"\n  Train Label Distribution:")
    train_label_dist = train_df['label'].value_counts()
    for label, count in train_label_dist.items():
        pct = 100 * count / len(train_df)
        print(f"    {label}: {count:,} ({pct:.1f}%)")

    print(f"\n  Output Files:")
    print(f"    {train_file}")
    print(f"    {val_file}")
    print(f"    {test_file}")
    print("=" * 80)
    print("✅ Dataset Split Complete")

if __name__ == "__main__":
    split_dataset('data/training/price-prediction-yf-top100.csv')
