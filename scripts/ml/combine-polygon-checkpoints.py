#!/usr/bin/env python3
"""
Combine Polygon news checkpoint files into a single dataset.
Removes duplicates and sorts by published date.
"""

import pandas as pd
import glob
import os

def combine_checkpoints(pattern: str, output_file: str):
    """Combine checkpoint files matching the pattern."""

    # Find all checkpoint files
    checkpoint_files = sorted(glob.glob(pattern))

    if not checkpoint_files:
        print(f"❌ No checkpoint files found matching: {pattern}")
        return

    print(f"📊 Found {len(checkpoint_files)} checkpoint files")
    print(f"   First: {os.path.basename(checkpoint_files[0])}")
    print(f"   Last:  {os.path.basename(checkpoint_files[-1])}")

    # Read and combine all checkpoints
    dfs = []
    total_rows = 0

    for i, file in enumerate(checkpoint_files, 1):
        try:
            df = pd.read_csv(file)
            rows = len(df)
            total_rows += rows
            dfs.append(df)
            print(f"   [{i}/{len(checkpoint_files)}] {os.path.basename(file)}: {rows:,} rows")
        except Exception as e:
            print(f"   ⚠️  Error reading {file}: {e}")

    if not dfs:
        print("❌ No data to combine")
        return

    # Combine all dataframes
    print("\n🔄 Combining datasets...")
    combined_df = pd.concat(dfs, ignore_index=True)
    print(f"   Total rows before deduplication: {len(combined_df):,}")

    # Remove duplicates (same ticker + published_utc + title)
    print("🔄 Removing duplicates...")
    before_dedup = len(combined_df)
    combined_df = combined_df.drop_duplicates(subset=['ticker', 'published_utc', 'title'], keep='last')
    after_dedup = len(combined_df)
    duplicates_removed = before_dedup - after_dedup
    print(f"   Removed {duplicates_removed:,} duplicates")
    print(f"   Final row count: {after_dedup:,}")

    # Sort by published date
    print("🔄 Sorting by published date...")
    combined_df['published_utc'] = pd.to_datetime(combined_df['published_utc'])
    combined_df = combined_df.sort_values('published_utc')

    # Save combined dataset
    print(f"\n💾 Saving to {output_file}...")
    combined_df.to_csv(output_file, index=False)

    file_size = os.path.getsize(output_file) / (1024 * 1024)  # MB
    print(f"✅ Saved {len(combined_df):,} articles to {output_file}")
    print(f"   File size: {file_size:.1f} MB")
    print(f"   Unique tickers: {combined_df['ticker'].nunique()}")
    print(f"   Date range: {combined_df['published_utc'].min()} to {combined_df['published_utc'].max()}")
    print(f"   Publishers: {combined_df['publisher'].nunique()}")

if __name__ == '__main__':
    import sys

    # Get year from command line argument (default 2024)
    year = sys.argv[1] if len(sys.argv) > 1 else '2024'

    # Combine checkpoints for specified year
    combine_checkpoints(
        pattern=f'data/training/polygon_news_{year}_checkpoint_*.csv',
        output_file=f'data/training/polygon_news_{year}.csv'
    )

    print("\n✨ Done!")
