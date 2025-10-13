#!/usr/bin/env python3
"""
Generate Smart Money Flow Dataset - Insider Features Only

Uses: 4 real features from SEC Form 4 insider trading data
Symbols: 5,316 with real insider trading data
Performance: Fast generation from Parquet

Features (4):
- insider_buy_volume_30d
- insider_sell_volume_30d
- insider_buy_ratio_30d
- insider_transaction_count_30d

Usage:
    python3 scripts/ml/smart-money-flow/generate-insider-only-dataset.py
    python3 scripts/ml/smart-money-flow/generate-insider-only-dataset.py --symbols=100
"""

import pandas as pd
import pyarrow.parquet as pq
from pathlib import Path
import sys
from datetime import datetime, timedelta
import requests

def get_polygon_price_data(symbol, date_str, api_key):
    """Get price data from Polygon for forward return calculation"""
    try:
        # Calculate dates
        sample_date = datetime.strptime(date_str, '%Y-%m-%d')
        future_date = sample_date + timedelta(days=14)
        buffer_date = future_date + timedelta(days=7)

        # Format dates for Polygon
        from_date = sample_date.strftime('%Y-%m-%d')
        to_date = buffer_date.strftime('%Y-%m-%d')

        url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/1/day/{from_date}/{to_date}"
        params = {"apiKey": api_key, "adjusted": "true", "sort": "asc"}

        response = requests.get(url, params=params, timeout=10)
        if response.status_code != 200:
            return None

        data = response.json()
        if 'results' not in data or len(data['results']) < 2:
            return None

        # Find bars closest to sample and future dates
        bars = data['results']
        sample_bar = None
        future_bar = None

        for bar in bars:
            bar_date = datetime.fromtimestamp(bar['t'] / 1000)
            if bar_date >= sample_date and not sample_bar:
                sample_bar = bar
            if bar_date >= future_date and not future_bar:
                future_bar = bar

        if not sample_bar or not future_bar:
            return None

        return {
            'price_at_sample': sample_bar['c'],
            'price_after_14d': future_bar['c']
        }

    except Exception as e:
        return None

def generate_dataset(max_symbols=None, output_name='insider-only'):
    """Generate training dataset from insider Parquet features"""
    print("\n" + "="*80)
    print("SMART MONEY FLOW - INSIDER FEATURES ONLY DATASET")
    print("="*80)

    # Load insider features
    print("\n📂 Loading insider features from Parquet...")
    parquet_path = Path('data/smart_money_features/insider_features.parquet')
    if not parquet_path.exists():
        print(f"❌ Error: Insider features not found at {parquet_path}")
        sys.exit(1)

    table = pq.read_table(parquet_path)
    df = table.to_pandas()

    print(f"  ✅ Loaded {len(df):,} insider transactions")
    print(f"  ✅ Unique symbols: {df['symbol'].nunique():,}")

    # Get Polygon API key
    polygon_key = os.environ.get('POLYGON_API_KEY')
    if not polygon_key:
        print("  ⚠️  Warning: POLYGON_API_KEY not set, will skip symbols without cached prices")

    # Get unique symbols
    symbols = df['symbol'].unique()
    symbols = [s for s in symbols if len(s) <= 5 and s.isalpha() and s.isupper()]  # Filter valid tickers

    if max_symbols:
        symbols = symbols[:max_symbols]
        print(f"\n📊 Processing {len(symbols)} symbols (limited by --symbols flag)")
    else:
        print(f"\n📊 Processing all {len(symbols)} symbols")

    # Generate dataset
    print("\n🏗️  Generating training samples...")
    print("  Strategy: Sample every 30 days, calculate 14-day forward returns")

    samples = []
    failed_count = 0

    for i, symbol in enumerate(symbols, 1):
        if i % 100 == 0:
            print(f"  [{i}/{len(symbols)}] Progress: {i/len(symbols)*100:.1f}% | Samples: {len(samples)} | Failed: {failed_count}")

        # Get insider data for this symbol
        symbol_df = df[df['symbol'] == symbol].copy()
        symbol_df['date'] = pd.to_datetime(symbol_df['date'])
        symbol_df = symbol_df.sort_values('date')

        # Sample every 30 days to avoid data leakage
        min_date = symbol_df['date'].min()
        max_date = symbol_df['date'].max() - timedelta(days=14)  # Need 14 days for forward return

        current_date = min_date
        while current_date <= max_date:
            # Get 30-day window
            window_start = current_date - timedelta(days=30)
            window_end = current_date

            window_df = symbol_df[(symbol_df['date'] >= window_start) & (symbol_df['date'] <= window_end)]

            if len(window_df) == 0:
                current_date += timedelta(days=30)
                continue

            # Calculate features
            insider_buy_volume = window_df['insider_buy_value'].sum()
            insider_sell_volume = window_df['insider_sell_value'].sum()
            insider_transaction_count = window_df['insider_buy_count'].sum() + window_df['insider_sell_count'].sum()

            # Calculate buy ratio
            total_volume = insider_buy_volume + insider_sell_volume
            insider_buy_ratio = insider_buy_volume / total_volume if total_volume > 0 else 0.5

            # Get price data for forward return
            date_str = current_date.strftime('%Y-%m-%d')
            price_data = get_polygon_price_data(symbol, date_str, polygon_key) if polygon_key else None

            if not price_data:
                current_date += timedelta(days=30)
                failed_count += 1
                continue

            # Calculate 14-day forward return
            return_14d = (price_data['price_after_14d'] - price_data['price_at_sample']) / price_data['price_at_sample']
            label = 1 if return_14d > 0.05 else 0  # 1 if >5% gain

            # Add sample
            samples.append({
                'symbol': symbol,
                'date': date_str,
                'price_at_sample': price_data['price_at_sample'],
                'price_after_14d': price_data['price_after_14d'],
                'return_14d': return_14d,
                'label': label,
                'insider_buy_volume_30d': insider_buy_volume,
                'insider_sell_volume_30d': insider_sell_volume,
                'insider_buy_ratio_30d': insider_buy_ratio,
                'insider_transaction_count_30d': insider_transaction_count
            })

            current_date += timedelta(days=30)

    print(f"\n✅ Generated {len(samples):,} training samples from {len(symbols):,} symbols")
    print(f"⚠️  Failed: {failed_count:,} samples (no price data)")

    # Save to CSV
    print("\n💾 Saving dataset...")
    output_dir = Path('data/training/smart-money-flow-insider')
    output_dir.mkdir(parents=True, exist_ok=True)

    df_samples = pd.DataFrame(samples)
    output_path = output_dir / f'{output_name}.csv'
    df_samples.to_csv(output_path, index=False)

    print(f"  ✅ Saved to {output_path}")
    print(f"  📊 Size: {output_path.stat().st_size / 1024 / 1024:.2f} MB")

    # Label distribution
    label_counts = df_samples['label'].value_counts()
    print(f"\n📈 Label distribution:")
    print(f"  Bearish (0): {label_counts.get(0, 0):,} ({label_counts.get(0, 0)/len(df_samples)*100:.1f}%)")
    print(f"  Bullish (1): {label_counts.get(1, 0):,} ({label_counts.get(1, 0)/len(df_samples)*100:.1f}%)")

    print("\n" + "="*80)
    print("✅ DATASET GENERATION COMPLETE")
    print("="*80)
    print(f"\nNext step: Split dataset")
    print(f"  python3 scripts/ml/smart-money-flow/split-dataset.py {output_path}")

if __name__ == "__main__":
    import os

    # Parse arguments
    max_symbols = None
    output_name = 'insider-only'

    for arg in sys.argv[1:]:
        if arg.startswith('--symbols='):
            max_symbols = int(arg.split('=')[1])
        elif arg.startswith('--name='):
            output_name = arg.split('=')[1]
        elif arg in ['-h', '--help']:
            print(__doc__)
            sys.exit(0)

    generate_dataset(max_symbols, output_name)
