#!/usr/bin/env python3
"""
Smart Money Flow Dataset Splitting Script

Task: Dataset Splitting (Phase 1 - TODO lines 261-289)
Purpose: Split dataset into train/val/test with stratified sampling

Requirements:
1. Stratified split maintaining label balance:
   - Train: 70% (12,600 examples)
   - Validation: 15% (2,700 examples)
   - Test: 15% (2,700 examples)
2. Use sklearn.model_selection.train_test_split with stratification
3. Export to CSV files in data/training/smart-money-flow/
4. Print split statistics (size, label balance per split)

Usage:
    python scripts/ml/smart-money-flow/split-dataset.py
    python scripts/ml/smart-money-flow/split-dataset.py --input data/training/smart-money-flow/custom-dataset.csv
"""

import pandas as pd
import sys
import os
from sklearn.model_selection import train_test_split

def split_dataset(input_path: str):
    """
    Split Smart Money Flow dataset into stratified train/val/test sets

    Args:
        input_path: Path to full dataset CSV
    """
    print("=" * 80)
    print("Smart Money Flow - Dataset Splitting")
    print("Phase 1: Dataset Splitting (TODO lines 261-289)")
    print("=" * 80)

    # Check if input file exists
    if not os.path.exists(input_path):
        print(f"\nERROR: Input file not found: {input_path}")
        print("\nGenerate training data first:")
        print("   npx tsx scripts/ml/smart-money-flow/generate-dataset.ts")
        sys.exit(1)

    print(f"\nInput file: {input_path}")
    print(f"File size: {os.path.getsize(input_path) / 1024:.2f} KB")

    # Load dataset
    print("\nLoading dataset...")
    df = pd.read_csv(input_path)
    print(f"✓ Loaded {len(df)} training examples")
    print(f"✓ Features: {len(df.columns) - 3} (symbol, date, label excluded)")

    # Display label distribution
    label_counts = df['label'].value_counts().sort_index()
    print(f"\nLabel distribution:")
    for label, count in label_counts.items():
        label_name = "BULLISH" if label == 1 else "BEARISH"
        percentage = (count / len(df)) * 100
        print(f"  {label_name} ({label}): {count} examples ({percentage:.2f}%)")

    # Check if dataset has enough examples
    if len(df) < 100:
        print(f"\nWARNING: Dataset has only {len(df)} examples. Recommended minimum: 1,000")
        print("Consider generating more training data before splitting.")

    # Shuffle dataset for randomness
    df_shuffled = df.sample(frac=1, random_state=42).reset_index(drop=True)
    print("\n✓ Dataset shuffled with random_state=42")

    # First split: 70% train, 30% temp (for val + test)
    train_df, temp_df = train_test_split(
        df_shuffled,
        test_size=0.30,
        stratify=df_shuffled['label'],
        random_state=42
    )

    # Second split: Split temp into 50% val, 50% test (15% each of original)
    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.50,
        stratify=temp_df['label'],
        random_state=42
    )

    print("\n" + "=" * 80)
    print("Split Statistics")
    print("=" * 80)

    # Print split statistics
    print(f"\nTrain set: {len(train_df)} examples ({len(train_df)/len(df)*100:.1f}%)")
    train_label_counts = train_df['label'].value_counts().sort_index()
    for label, count in train_label_counts.items():
        label_name = "BULLISH" if label == 1 else "BEARISH"
        percentage = (count / len(train_df)) * 100
        print(f"  {label_name}: {count} ({percentage:.2f}%)")

    print(f"\nValidation set: {len(val_df)} examples ({len(val_df)/len(df)*100:.1f}%)")
    val_label_counts = val_df['label'].value_counts().sort_index()
    for label, count in val_label_counts.items():
        label_name = "BULLISH" if label == 1 else "BEARISH"
        percentage = (count / len(val_df)) * 100
        print(f"  {label_name}: {count} ({percentage:.2f}%)")

    print(f"\nTest set: {len(test_df)} examples ({len(test_df)/len(df)*100:.1f}%)")
    test_label_counts = test_df['label'].value_counts().sort_index()
    for label, count in test_label_counts.items():
        label_name = "BULLISH" if label == 1 else "BEARISH"
        percentage = (count / len(test_df)) * 100
        print(f"  {label_name}: {count} ({percentage:.2f}%)")

    # Verify stratification worked
    print("\n" + "=" * 80)
    print("Stratification Verification")
    print("=" * 80)

    # Calculate label balance differences
    full_bullish_pct = (df['label'] == 1).sum() / len(df) * 100
    train_bullish_pct = (train_df['label'] == 1).sum() / len(train_df) * 100
    val_bullish_pct = (val_df['label'] == 1).sum() / len(val_df) * 100
    test_bullish_pct = (test_df['label'] == 1).sum() / len(test_df) * 100

    print(f"\nBullish % (target: {full_bullish_pct:.2f}%):")
    print(f"  Train: {train_bullish_pct:.2f}% (diff: {abs(train_bullish_pct - full_bullish_pct):.2f}%)")
    print(f"  Val:   {val_bullish_pct:.2f}% (diff: {abs(val_bullish_pct - full_bullish_pct):.2f}%)")
    print(f"  Test:  {test_bullish_pct:.2f}% (diff: {abs(test_bullish_pct - full_bullish_pct):.2f}%)")

    # Verify all splits maintain balance within 2% tolerance
    max_diff = max(
        abs(train_bullish_pct - full_bullish_pct),
        abs(val_bullish_pct - full_bullish_pct),
        abs(test_bullish_pct - full_bullish_pct)
    )

    if max_diff < 2.0:
        print(f"\n✓ Stratification successful: Max difference {max_diff:.2f}% < 2.0%")
    else:
        print(f"\n⚠ Stratification warning: Max difference {max_diff:.2f}% >= 2.0%")

    # Create output directory if it doesn't exist
    output_dir = "data/training/smart-money-flow"
    os.makedirs(output_dir, exist_ok=True)

    # Save splits to CSV files
    print("\n" + "=" * 80)
    print("Saving splits to CSV files...")
    print("=" * 80)

    train_path = os.path.join(output_dir, "train.csv")
    val_path = os.path.join(output_dir, "val.csv")
    test_path = os.path.join(output_dir, "test.csv")

    train_df.to_csv(train_path, index=False)
    print(f"\n✓ Saved train set: {train_path}")

    val_df.to_csv(val_path, index=False)
    print(f"✓ Saved validation set: {val_path}")

    test_df.to_csv(test_path, index=False)
    print(f"✓ Saved test set: {test_path}")

    # Final summary
    print("\n" + "=" * 80)
    print("Split Complete!")
    print("=" * 80)
    print(f"\nTotal examples: {len(df)}")
    print(f"  Train:      {len(train_df)} ({len(train_df)/len(df)*100:.1f}%)")
    print(f"  Validation: {len(val_df)} ({len(val_df)/len(df)*100:.1f}%)")
    print(f"  Test:       {len(test_df)} ({len(test_df)/len(df)*100:.1f}%)")
    print(f"\nLabel balance maintained across all splits")

    print("\nNext step: Train Smart Money Flow model (Phase 2)")
    print("   python scripts/ml/smart-money-flow/train-model.py")
    print("\n" + "=" * 80)


def main():
    """Main execution"""
    # Parse command-line arguments
    input_path = "data/training/smart-money-flow/full-dataset.csv"

    if len(sys.argv) > 1:
        if sys.argv[1] == "--input" and len(sys.argv) > 2:
            input_path = sys.argv[2]
        elif sys.argv[1] in ["-h", "--help"]:
            print(__doc__)
            sys.exit(0)
        else:
            input_path = sys.argv[1]

    try:
        split_dataset(input_path)
    except Exception as e:
        print(f"\nERROR: Dataset splitting failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
