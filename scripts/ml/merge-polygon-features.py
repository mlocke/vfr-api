#!/usr/bin/env python3
"""
Merge Polygon Sentiment Features + Price Features

Combines sentiment-scored news with price features to create a unified
training dataset with 48 total features.

Input:
  - data/training/polygon_news_with_sentiment.csv (118K articles with 4 sentiment features)
  - data/training/polygon_price_features.csv (unique ticker-date pairs with 43 price features + label)

Output:
  - data/training/polygon_training_dataset.csv (unified dataset with 48 features + label)

Features (48 total):
  - Sentiment (4): negative, neutral, positive, score
  - Price/Technical (43): volume, RSI, MACD, momentum, etc.
  - Label: UP/DOWN/NEUTRAL

Merge Strategy:
  1. Aggregate news sentiment features by (ticker, date)
  2. Merge with price features on (ticker, date)
  3. Result: One row per unique (ticker, date) with all features

Usage:
    python3 scripts/ml/merge-polygon-features.py
"""

import pandas as pd
import numpy as np
import os
import sys

def aggregate_sentiment_by_date(df_news):
    """
    Aggregate multiple news articles per (ticker, date) into single sentiment scores.

    Multiple articles on the same day are averaged to create daily sentiment features.
    """
    print("📊 Aggregating sentiment features by (ticker, date)...")

    # Group by ticker and date, aggregate sentiment scores
    agg_funcs = {
        'sentiment_negative': 'mean',
        'sentiment_neutral': 'mean',
        'sentiment_positive': 'mean',
        'sentiment_score': 'mean'
    }

    df_agg = df_news.groupby(['ticker', 'date']).agg(agg_funcs).reset_index()

    print(f"   ✓ Aggregated {len(df_news):,} articles into {len(df_agg):,} unique (ticker, date) pairs")
    print()

    return df_agg

def merge_polygon_features():
    """Main function to merge sentiment + price features"""

    print("=" * 80)
    print("MERGE POLYGON SENTIMENT + PRICE FEATURES")
    print("=" * 80)
    print()

    # Load sentiment-scored news
    sentiment_file = "data/training/polygon_news_with_sentiment.csv"

    if not os.path.exists(sentiment_file):
        print(f"❌ Error: {sentiment_file} not found")
        print("Run: python3 scripts/ml/score-polygon-sentiment.py first")
        sys.exit(1)

    print(f"📂 Loading sentiment dataset: {sentiment_file}")
    df_sentiment = pd.read_csv(sentiment_file)
    df_sentiment['published_utc'] = pd.to_datetime(df_sentiment['published_utc'])
    df_sentiment['date'] = df_sentiment['published_utc'].dt.date.astype(str)
    print(f"   ✓ Loaded {len(df_sentiment):,} news articles with sentiment scores")
    print()

    # Aggregate sentiment by (ticker, date)
    df_sentiment_agg = aggregate_sentiment_by_date(df_sentiment)

    # Load price features
    price_file = "data/training/polygon_price_features.csv"

    if not os.path.exists(price_file):
        print(f"❌ Error: {price_file} not found")
        print("Run: python3 scripts/ml/generate-polygon-price-features.py first")
        sys.exit(1)

    print(f"📂 Loading price features: {price_file}")
    df_price = pd.read_csv(price_file)
    print(f"   ✓ Loaded {len(df_price):,} (ticker, date) pairs with 43 price features")
    print()

    # Merge datasets on (ticker, date)
    print("🔗 Merging sentiment + price features...")
    df_merged = df_price.merge(
        df_sentiment_agg,
        on=['ticker', 'date'],
        how='inner',  # Only keep rows with both sentiment AND price data
        suffixes=('', '_sentiment')
    )

    print(f"   ✓ Merged {len(df_merged):,} rows")
    print(f"   Match rate: {len(df_merged) / len(df_price) * 100:.1f}% of price data")
    print(f"   Match rate: {len(df_merged) / len(df_sentiment_agg) * 100:.1f}% of sentiment data")
    print()

    # Reorder columns: ticker, date, sentiment features, price features, label
    sentiment_cols = ['sentiment_negative', 'sentiment_neutral', 'sentiment_positive', 'sentiment_score']
    price_cols = [col for col in df_price.columns if col not in ['ticker', 'date', 'label']]

    final_cols = ['ticker', 'date'] + sentiment_cols + price_cols + ['label']
    df_final = df_merged[final_cols]

    # Save merged dataset
    output_file = "data/training/polygon_training_dataset.csv"
    print(f"💾 Saving merged training dataset: {output_file}")
    df_final.to_csv(output_file, index=False)

    file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"   ✓ Saved {len(df_final):,} rows, {len(df_final.columns)} columns")
    print(f"   File size: {file_size_mb:.1f} MB")
    print()

    # Dataset summary
    print("=" * 80)
    print("DATASET SUMMARY")
    print("=" * 80)
    print()

    print(f"Total examples: {len(df_final):,}")
    print(f"Unique tickers: {df_final['ticker'].nunique()}")
    print(f"Date range: {df_final['date'].min()} to {df_final['date'].max()}")
    print(f"Total features: {len(df_final.columns) - 3}")  # Exclude ticker, date, label
    print(f"  Sentiment features: {len(sentiment_cols)}")
    print(f"  Price features: {len(price_cols)}")
    print()

    # Label distribution
    print("Label distribution:")
    label_counts = df_final['label'].value_counts().sort_index()
    print(label_counts)
    print()
    label_pcts = df_final['label'].value_counts(normalize=True).sort_index() * 100
    for label, pct in label_pcts.items():
        print(f"  {label}: {pct:.1f}%")
    print()

    # Top tickers
    print("Top 10 tickers by example count:")
    print(df_final['ticker'].value_counts().head(10))
    print()

    # Feature statistics (sample)
    print("Sample feature statistics:")
    feature_cols = sentiment_cols + price_cols[:5]  # First 5 price features
    for col in feature_cols:
        mean_val = df_final[col].mean()
        std_val = df_final[col].std()
        print(f"  {col}: mean={mean_val:.4f}, std={std_val:.4f}")
    print()

    # Missing data check
    missing_count = df_final.isnull().sum().sum()
    if missing_count > 0:
        print(f"⚠️  Missing data detected: {missing_count:,} null values")
        print("   Missing values by column:")
        for col in df_final.columns:
            null_count = df_final[col].isnull().sum()
            if null_count > 0:
                print(f"      {col}: {null_count:,} ({null_count/len(df_final)*100:.1f}%)")
        print()
    else:
        print("✅ No missing data")
        print()

    print("=" * 80)
    print("✅ COMPLETE - FEATURE MERGE")
    print("=" * 80)
    print()
    print("Next steps:")
    print("  1. Split dataset: python3 scripts/ml/split-polygon-dataset.py")
    print("  2. Train model: python3 scripts/ml/train-polygon-model.py")
    print("  3. Evaluate performance")
    print()


if __name__ == "__main__":
    merge_polygon_features()
