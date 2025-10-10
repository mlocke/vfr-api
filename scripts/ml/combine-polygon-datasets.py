#!/usr/bin/env python3
"""
Combine Polygon News Datasets (2023, 2024, 2025)

Merges three yearly Polygon news datasets into a single consolidated file.

Input:
  - data/training/polygon_news_2023.csv (~109,906 articles)
  - data/training/polygon_news_2024.csv (~40MB)
  - data/training/polygon_news_2025.csv (~24,775 articles)

Output:
  - data/training/polygon_news_combined_2023-2025.csv (~135,000+ articles)

Usage:
    python3 scripts/ml/combine-polygon-datasets.py
"""

import pandas as pd
import os
from datetime import datetime

def combine_polygon_datasets():
    """Combine 2023, 2024, 2025 Polygon news datasets"""

    print("=" * 80)
    print("COMBINE POLYGON NEWS DATASETS (2023-2025)")
    print("=" * 80)
    print()

    # File paths
    files = {
        '2023': 'data/training/polygon_news_2023.csv',
        '2024': 'data/training/polygon_news_2024.csv',
        '2025': 'data/training/polygon_news_2025.csv'
    }

    # Load each dataset
    dataframes = []
    total_articles = 0

    for year, filepath in files.items():
        print(f"📂 Loading {year} dataset...")

        if not os.path.exists(filepath):
            print(f"   ⚠️  File not found: {filepath}")
            print(f"   Skipping {year}")
            continue

        df = pd.read_csv(filepath)
        print(f"   ✓ Loaded {len(df):,} articles")
        print(f"   Columns: {list(df.columns)}")
        print(f"   Date range: {df['published_utc'].min() if 'published_utc' in df.columns else 'N/A'} to {df['published_utc'].max() if 'published_utc' in df.columns else 'N/A'}")
        print(f"   Unique tickers: {df['ticker'].nunique() if 'ticker' in df.columns else 'N/A'}")
        print()

        dataframes.append(df)
        total_articles += len(df)

    # Combine all dataframes
    print("🔗 Combining datasets...")
    df_combined = pd.concat(dataframes, ignore_index=True)

    print(f"   ✓ Combined {len(df_combined):,} total articles")
    print()

    # Remove duplicates (same article might appear in multiple years)
    print("🧹 Removing duplicate articles...")
    initial_count = len(df_combined)

    # Drop duplicates based on article_url (most reliable unique identifier)
    if 'article_url' in df_combined.columns:
        df_combined = df_combined.drop_duplicates(subset=['article_url'], keep='first')
    elif 'published_utc' in df_combined.columns and 'ticker' in df_combined.columns and 'title' in df_combined.columns:
        # Fallback: use combination of published_utc, ticker, title
        df_combined = df_combined.drop_duplicates(subset=['published_utc', 'ticker', 'title'], keep='first')

    duplicates_removed = initial_count - len(df_combined)
    print(f"   ✓ Removed {duplicates_removed:,} duplicates")
    print(f"   Final count: {len(df_combined):,} unique articles")
    print()

    # Sort by published date
    if 'published_utc' in df_combined.columns:
        print("📅 Sorting by published date...")
        # Handle mixed date formats (2023: ISO8601 with Z, 2024: space-separated with +00:00, 2025: ISO8601 with Z)
        df_combined['published_utc'] = pd.to_datetime(df_combined['published_utc'], format='mixed', utc=True)
        df_combined = df_combined.sort_values('published_utc')
        print(f"   ✓ Sorted chronologically")
        print()

    # Data quality checks
    print("=" * 80)
    print("DATASET SUMMARY")
    print("=" * 80)
    print()
    print(f"Total articles: {len(df_combined):,}")

    if 'ticker' in df_combined.columns:
        print(f"Unique tickers: {df_combined['ticker'].nunique()}")
        print(f"Top 10 tickers by article count:")
        print(df_combined['ticker'].value_counts().head(10))

    if 'published_utc' in df_combined.columns:
        print(f"\nDate range: {df_combined['published_utc'].min()} to {df_combined['published_utc'].max()}")

        # Monthly breakdown
        df_combined['year_month'] = df_combined['published_utc'].dt.to_period('M')
        print(f"\nArticles per month:")
        monthly_counts = df_combined.groupby('year_month').size().sort_index()
        for period, count in monthly_counts.items():
            print(f"  {period}: {count:,}")

    if 'publisher' in df_combined.columns:
        print(f"\nUnique publishers: {df_combined['publisher'].nunique()}")
        print(f"Top 10 publishers:")
        print(df_combined['publisher'].value_counts().head(10))

    # Check for missing data
    print(f"\n📊 Missing data:")
    for col in df_combined.columns:
        missing_count = df_combined[col].isna().sum()
        missing_pct = (missing_count / len(df_combined)) * 100
        if missing_count > 0:
            print(f"  {col}: {missing_count:,} ({missing_pct:.1f}%)")

    # Save combined dataset
    output_path = 'data/training/polygon_news_combined_2023-2025.csv'
    print(f"\n💾 Saving combined dataset: {output_path}")

    # Drop temporary year_month column if it exists
    if 'year_month' in df_combined.columns:
        df_combined = df_combined.drop(columns=['year_month'])

    df_combined.to_csv(output_path, index=False)

    # Get file size
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"   ✓ Saved {len(df_combined):,} articles")
    print(f"   File size: {file_size_mb:.1f} MB")
    print()

    print("=" * 80)
    print("✅ DATASET CONSOLIDATION COMPLETE")
    print("=" * 80)
    print()
    print("Next steps:")
    print("  1. Score articles with FinBERT sentiment analysis")
    print("  2. Generate price features for matching (symbol, date) pairs")
    print("  3. Merge sentiment + price features for training")
    print()

if __name__ == "__main__":
    combine_polygon_datasets()
