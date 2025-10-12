#!/usr/bin/env python3
"""
Combine parallel-generated smart money flow datasets into a single master dataset.
Handles deduplication and proper header management.
"""

import pandas as pd
import os
from pathlib import Path

def combine_datasets():
    """Combine all process-*.csv files into a single dataset"""

    data_dir = Path("data/training/smart-money-flow")

    # Find all process files
    process_files = sorted(data_dir.glob("smart-money-flow-process-*.csv"))

    if not process_files:
        print("❌ No process files found!")
        return

    print(f"📊 Found {len(process_files)} process files to combine")

    # Load and combine all datasets
    all_data = []
    total_rows = 0

    for file_path in process_files:
        print(f"  Loading {file_path.name}...", end=" ")
        df = pd.read_csv(file_path)
        rows = len(df)
        total_rows += rows
        all_data.append(df)
        print(f"{rows:,} rows")

    # Combine all dataframes
    print(f"\n🔄 Combining {total_rows:,} total rows...")
    combined_df = pd.concat(all_data, ignore_index=True)

    # Remove duplicates (in case any symbol/date pairs overlap)
    original_size = len(combined_df)
    combined_df = combined_df.drop_duplicates(subset=['symbol', 'date'], keep='first')
    duplicates_removed = original_size - len(combined_df)

    if duplicates_removed > 0:
        print(f"  ⚠️  Removed {duplicates_removed:,} duplicate rows")

    # Sort by symbol and date for consistency
    combined_df = combined_df.sort_values(['symbol', 'date']).reset_index(drop=True)

    # Save combined dataset
    output_file = data_dir / "smart-money-flow-master.csv"
    combined_df.to_csv(output_file, index=False)

    print(f"\n✅ Combined dataset saved: {output_file}")
    print(f"   Total rows: {len(combined_df):,}")
    print(f"   Unique symbols: {combined_df['symbol'].nunique()}")
    print(f"   Date range: {combined_df['date'].min()} to {combined_df['date'].max()}")

    # Show label distribution
    label_dist = combined_df['label'].value_counts().sort_index()
    print(f"\n📈 Label distribution:")
    for label, count in label_dist.items():
        pct = (count / len(combined_df)) * 100
        print(f"   {label}: {count:,} ({pct:.1f}%)")

    # Data quality checks
    print(f"\n🔍 Data quality:")
    missing_pct = (combined_df.isnull().sum().sum() / (len(combined_df) * len(combined_df.columns))) * 100
    print(f"   Missing values: {missing_pct:.2f}%")

    # Feature statistics
    feature_cols = [col for col in combined_df.columns if col not in ['symbol', 'date', 'price_at_sample', 'price_after_14d', 'return_14d', 'label']]
    print(f"   Features: {len(feature_cols)}")

    return combined_df

if __name__ == "__main__":
    print("=" * 60)
    print("Smart Money Flow Dataset Combiner")
    print("=" * 60 + "\n")

    df = combine_datasets()

    print("\n" + "=" * 60)
    print("✅ Dataset combination complete!")
    print("=" * 60)
