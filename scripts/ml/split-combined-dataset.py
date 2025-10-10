#!/usr/bin/env python3
"""
Split Combined Dataset (FinBERT + Price Features)

Splits combined-finbert-price-features.csv into train/val/test sets
with stratification to maintain label balance.

Input:  data/training/combined-finbert-price-features.csv (1,472 rows, 46 features)
Output:
  - data/training/combined-train.csv (70% = ~1,030 rows)
  - data/training/combined-val.csv (15% = ~221 rows)
  - data/training/combined-test.csv (15% = ~221 rows)

Split: 70% train, 15% val, 15% test (stratified by label)

Usage:
    python3 scripts/ml/split-combined-dataset.py
"""

import pandas as pd
from sklearn.model_selection import train_test_split

def split_dataset():
    print("=" * 80)
    print("✂️  Splitting Combined Dataset (Train/Val/Test)")
    print("=" * 80)

    # Load combined dataset
    print("\n📂 Loading combined dataset...")
    df = pd.read_csv("data/training/combined-finbert-price-features.csv")
    print(f"✓ Loaded {len(df):,} rows with {len(df.columns)} columns")

    # Check label distribution
    print(f"\n🏷️  Label distribution:")
    label_counts = df['label'].value_counts()
    print(label_counts)
    print(f"\nProportions:")
    print((label_counts / len(df) * 100).round(1))

    # First split: 70% train, 30% temp (for val+test)
    print("\n✂️  Splitting dataset (70% train, 15% val, 15% test)...")
    train_df, temp_df = train_test_split(
        df,
        test_size=0.3,
        stratify=df['label'],
        random_state=42
    )

    # Second split: Split temp into 50% val, 50% test (15% each of original)
    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.5,
        stratify=temp_df['label'],
        random_state=42
    )

    print(f"\n✓ Split complete:")
    print(f"  Train: {len(train_df):,} rows ({len(train_df)/len(df)*100:.1f}%)")
    print(f"  Val:   {len(val_df):,} rows ({len(val_df)/len(df)*100:.1f}%)")
    print(f"  Test:  {len(test_df):,} rows ({len(test_df)/len(df)*100:.1f}%)")

    # Verify stratification
    print(f"\n📊 Label distribution after split:")
    print("\nTrain:")
    print(train_df['label'].value_counts())
    print("\nVal:")
    print(val_df['label'].value_counts())
    print("\nTest:")
    print(test_df['label'].value_counts())

    # Save splits
    print(f"\n💾 Saving splits...")
    train_df.to_csv("data/training/combined-train.csv", index=False)
    val_df.to_csv("data/training/combined-val.csv", index=False)
    test_df.to_csv("data/training/combined-test.csv", index=False)

    print(f"✓ Saved:")
    print(f"  data/training/combined-train.csv ({len(train_df):,} rows)")
    print(f"  data/training/combined-val.csv ({len(val_df):,} rows)")
    print(f"  data/training/combined-test.csv ({len(test_df):,} rows)")

    print("\n" + "=" * 80)
    print("✅ Dataset Split Complete!")
    print("=" * 80)

    print("\n💡 Next step:")
    print("  Train LightGBM: python3 scripts/ml/train-combined-lightgbm.py")
    print("=" * 80)

if __name__ == "__main__":
    split_dataset()
