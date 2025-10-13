#!/usr/bin/env python3
"""
Generate Comprehensive Smart Money Flow Dataset

Uses ALL available data sources:
- SEC Form 4 (Insider Trading) from Parquet
- Polygon Flat Files (Price Data) - 502 daily files
- Polygon Cached Prices (data/cache/polygon_prices/)
- Congressional Trading Data
- SEC 13F Institutional Holdings (TODO: parse if needed)

Features (~15+):
- insider_buy_volume_30d
- insider_sell_volume_30d
- insider_buy_ratio_30d
- insider_transaction_count_30d
- congress_buy_count_90d
- congress_sell_count_90d
- congress_net_sentiment_90d
- price_momentum_14d
- price_volatility_30d
- volume_trend_30d
- (more features as data allows)

Usage:
    python3 scripts/ml/smart-money-flow/generate-comprehensive-dataset.py
    python3 scripts/ml/smart-money-flow/generate-comprehensive-dataset.py --symbols=100
    python3 scripts/ml/smart-money-flow/generate-comprehensive-dataset.py --name=full-model
"""

import pandas as pd
import pyarrow.parquet as pq
from pathlib import Path
import sys
import os
from datetime import datetime, timedelta
import gzip
import json
from collections import defaultdict
import numpy as np

class PolygonFlatFileReader:
    """Fast reader for Polygon flat files"""
    def __init__(self, flat_files_dir='datasets/polygon-flat-files/day_aggs'):
        self.flat_files_dir = Path(flat_files_dir)
        self.cache = {}
        print(f"📂 Indexing Polygon flat files from {self.flat_files_dir}")
        self.files = sorted(self.flat_files_dir.glob('*.csv.gz'))
        print(f"  ✅ Found {len(self.files)} daily files")

    def get_price_data(self, symbol, date_str):
        """Get price data for symbol on specific date and 14 days later"""
        try:
            sample_date = datetime.strptime(date_str, '%Y-%m-%d')
            future_date = sample_date + timedelta(days=14)

            # Load files for relevant dates (with buffer)
            buffer_days = 21  # Extra buffer for weekends/holidays
            date_range = pd.date_range(sample_date, sample_date + timedelta(days=buffer_days))

            prices = []
            for single_date in date_range:
                date_file = self.flat_files_dir / f"{single_date.strftime('%Y-%m-%d')}.csv.gz"
                if not date_file.exists():
                    continue

                # Read file if not cached
                if str(date_file) not in self.cache:
                    df = pd.read_csv(date_file, compression='gzip')
                    # Index by ticker for fast lookup
                    self.cache[str(date_file)] = df.set_index('ticker')

                df = self.cache[str(date_file)]
                if symbol in df.index:
                    row = df.loc[symbol]
                    prices.append({
                        'date': single_date,
                        'close': row['close'],
                        'high': row['high'],
                        'low': row['low'],
                        'volume': row['volume']
                    })

            if len(prices) < 2:
                return None

            # Find closest prices to sample and future dates
            prices_df = pd.DataFrame(prices)
            sample_bar = prices_df[prices_df['date'] >= sample_date].iloc[0] if len(prices_df[prices_df['date'] >= sample_date]) > 0 else None
            future_bar = prices_df[prices_df['date'] >= future_date].iloc[0] if len(prices_df[prices_df['date'] >= future_date]) > 0 else None

            if sample_bar is None or future_bar is None:
                return None

            return {
                'price_at_sample': sample_bar['close'],
                'price_after_14d': future_bar['close'],
                'prices': prices_df
            }

        except Exception as e:
            return None

class CachedPriceReader:
    """Read from cached Polygon prices"""
    def __init__(self, cache_dir='data/cache/polygon_prices'):
        self.cache_dir = Path(cache_dir)
        self.cache = {}
        if self.cache_dir.exists():
            files = list(self.cache_dir.glob('*.json'))
            print(f"📂 Found {len(files)} cached price files")

    def get_price_data(self, symbol, date_str):
        """Get price data from cache"""
        try:
            cache_file = self.cache_dir / f"{symbol}_prices.json"
            if not cache_file.exists():
                return None

            if str(cache_file) not in self.cache:
                with open(cache_file, 'r') as f:
                    self.cache[str(cache_file)] = json.load(f)

            data = self.cache[str(cache_file)]
            sample_date = datetime.strptime(date_str, '%Y-%m-%d')
            future_date = sample_date + timedelta(days=14)

            # Find matching prices
            sample_bar = None
            future_bar = None

            for bar in data.get('results', []):
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
        except Exception:
            return None

class CongressionalTradingData:
    """Load and query congressional trading data"""
    def __init__(self, csv_path='datasets/congress/Copy of congress-trading-all (3).csv'):
        self.csv_path = Path(csv_path)
        print(f"\n📂 Loading congressional trading data...")
        if not self.csv_path.exists():
            print(f"  ⚠️  Congressional data not found at {self.csv_path}")
            self.df = pd.DataFrame()
            return

        # Load with latin-1 encoding (per docs)
        self.df = pd.read_csv(self.csv_path, encoding='latin-1')
        self.df['Traded'] = pd.to_datetime(self.df['Traded'], errors='coerce')
        print(f"  ✅ Loaded {len(self.df):,} congressional trades from {self.df['Traded'].min()} to {self.df['Traded'].max()}")

    def get_features(self, symbol, date_str, window_days=90):
        """Get congressional trading features for symbol"""
        if self.df.empty:
            return {
                'congress_buy_count_90d': 0,
                'congress_sell_count_90d': 0,
                'congress_net_sentiment_90d': 0
            }

        try:
            end_date = datetime.strptime(date_str, '%Y-%m-%d')
            start_date = end_date - timedelta(days=window_days)

            # Filter for symbol and date range
            mask = (self.df['Ticker'] == symbol) & \
                   (self.df['Traded'] >= start_date) & \
                   (self.df['Traded'] <= end_date)
            trades = self.df[mask]

            if len(trades) == 0:
                return {
                    'congress_buy_count_90d': 0,
                    'congress_sell_count_90d': 0,
                    'congress_net_sentiment_90d': 0
                }

            buy_count = len(trades[trades['Transaction'] == 'Purchase'])
            sell_count = len(trades[trades['Transaction'] == 'Sale'])
            net_sentiment = (buy_count - sell_count) / len(trades) if len(trades) > 0 else 0

            return {
                'congress_buy_count_90d': buy_count,
                'congress_sell_count_90d': sell_count,
                'congress_net_sentiment_90d': net_sentiment
            }
        except Exception:
            return {
                'congress_buy_count_90d': 0,
                'congress_sell_count_90d': 0,
                'congress_net_sentiment_90d': 0
            }

def generate_dataset(max_symbols=None, output_name='comprehensive'):
    """Generate comprehensive training dataset from all sources"""
    print("\n" + "="*80)
    print("COMPREHENSIVE SMART MONEY FLOW DATASET GENERATION")
    print("="*80)
    print("\nData Sources:")
    print("  1. SEC Form 4 (Insider Trading) - Parquet features")
    print("  2. Polygon Flat Files - 502 daily price files")
    print("  3. Polygon Cached Prices - Fast price lookups")
    print("  4. Congressional Trading - Kaggle dataset")
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

    # Initialize data readers
    flat_reader = PolygonFlatFileReader()
    cached_reader = CachedPriceReader()
    congress_data = CongressionalTradingData()

    # Get unique symbols
    symbols = df['symbol'].unique()
    symbols = [s for s in symbols if len(s) <= 5 and s.isalpha() and s.isupper()]

    if max_symbols:
        symbols = symbols[:max_symbols]
        print(f"\n📊 Processing {len(symbols)} symbols (limited by --symbols flag)")
    else:
        print(f"\n📊 Processing all {len(symbols)} symbols")

    # Generate dataset
    print("\n🏗️  Generating training samples...")
    print("  Strategy: Sample every 30 days, calculate 14-day forward returns")
    print("  Features: Insider + Congressional + Price momentum/volatility\n")

    samples = []
    failed_count = 0
    price_source_stats = {'flat_files': 0, 'cache': 0, 'failed': 0}

    for i, symbol in enumerate(symbols, 1):
        if i % 50 == 0:
            print(f"  [{i}/{len(symbols)}] {i/len(symbols)*100:.1f}% | Samples: {len(samples)} | Failed: {failed_count}")
            print(f"    Price sources: Flat={price_source_stats['flat_files']}, Cache={price_source_stats['cache']}, Failed={price_source_stats['failed']}")

        # Get insider data for this symbol
        symbol_df = df[df['symbol'] == symbol].copy()
        symbol_df['date'] = pd.to_datetime(symbol_df['date'])
        symbol_df = symbol_df.sort_values('date')

        # Sample every 30 days
        min_date = symbol_df['date'].min()
        max_date = symbol_df['date'].max() - timedelta(days=14)

        current_date = min_date
        while current_date <= max_date:
            # Get 30-day window for insider features
            window_start = current_date - timedelta(days=30)
            window_end = current_date
            window_df = symbol_df[(symbol_df['date'] >= window_start) & (symbol_df['date'] <= window_end)]

            if len(window_df) == 0:
                current_date += timedelta(days=30)
                continue

            # Calculate insider features
            insider_buy_volume = window_df['insider_buy_value'].sum()
            insider_sell_volume = window_df['insider_sell_value'].sum()
            insider_transaction_count = window_df['insider_buy_count'].sum() + window_df['insider_sell_count'].sum()
            total_volume = insider_buy_volume + insider_sell_volume
            insider_buy_ratio = insider_buy_volume / total_volume if total_volume > 0 else 0.5

            # Get price data (try flat files first, then cache)
            date_str = current_date.strftime('%Y-%m-%d')
            price_data = flat_reader.get_price_data(symbol, date_str)

            if price_data:
                price_source_stats['flat_files'] += 1
            else:
                price_data = cached_reader.get_price_data(symbol, date_str)
                if price_data:
                    price_source_stats['cache'] += 1
                else:
                    price_source_stats['failed'] += 1
                    current_date += timedelta(days=30)
                    failed_count += 1
                    continue

            # Calculate 14-day forward return
            return_14d = (price_data['price_after_14d'] - price_data['price_at_sample']) / price_data['price_at_sample']
            label = 1 if return_14d > 0.05 else 0  # 1 if >5% gain

            # Get congressional features
            congress_features = congress_data.get_features(symbol, date_str)

            # Calculate additional price features if we have price history
            price_momentum_14d = 0
            price_volatility_30d = 0
            if 'prices' in price_data:
                prices_df = price_data['prices']
                if len(prices_df) >= 14:
                    # 14-day momentum
                    recent_14 = prices_df.tail(14)
                    price_momentum_14d = (recent_14.iloc[-1]['close'] - recent_14.iloc[0]['close']) / recent_14.iloc[0]['close']
                if len(prices_df) >= 30:
                    # 30-day volatility (std of returns)
                    recent_30 = prices_df.tail(30)
                    returns = recent_30['close'].pct_change().dropna()
                    price_volatility_30d = returns.std()

            # Add sample with ALL features
            sample = {
                'symbol': symbol,
                'date': date_str,
                'price_at_sample': price_data['price_at_sample'],
                'price_after_14d': price_data['price_after_14d'],
                'return_14d': return_14d,
                'label': label,
                # Insider features
                'insider_buy_volume_30d': insider_buy_volume,
                'insider_sell_volume_30d': insider_sell_volume,
                'insider_buy_ratio_30d': insider_buy_ratio,
                'insider_transaction_count_30d': insider_transaction_count,
                # Congressional features
                'congress_buy_count_90d': congress_features['congress_buy_count_90d'],
                'congress_sell_count_90d': congress_features['congress_sell_count_90d'],
                'congress_net_sentiment_90d': congress_features['congress_net_sentiment_90d'],
                # Price features
                'price_momentum_14d': price_momentum_14d,
                'price_volatility_30d': price_volatility_30d
            }

            samples.append(sample)
            current_date += timedelta(days=30)

    print(f"\n✅ Generated {len(samples):,} training samples from {len(symbols):,} symbols")
    print(f"⚠️  Failed: {failed_count:,} samples (no price data)")
    print(f"\n📊 Price data sources:")
    print(f"  Flat files: {price_source_stats['flat_files']:,} ({price_source_stats['flat_files']/(len(samples)+failed_count)*100:.1f}%)")
    print(f"  Cache: {price_source_stats['cache']:,} ({price_source_stats['cache']/(len(samples)+failed_count)*100:.1f}%)")
    print(f"  Failed: {price_source_stats['failed']:,}")

    # Save to CSV
    print("\n💾 Saving dataset...")
    output_dir = Path('data/training/smart-money-flow-comprehensive')
    output_dir.mkdir(parents=True, exist_ok=True)

    df_samples = pd.DataFrame(samples)
    output_path = output_dir / f'{output_name}.csv'
    df_samples.to_csv(output_path, index=False)

    print(f"  ✅ Saved to {output_path}")
    print(f"  📊 Size: {output_path.stat().st_size / 1024 / 1024:.2f} MB")

    # Feature summary
    print(f"\n📈 Features ({len(df_samples.columns) - 6}):")
    feature_cols = [c for c in df_samples.columns if c not in ['symbol', 'date', 'price_at_sample', 'price_after_14d', 'return_14d', 'label']]
    for col in feature_cols:
        mean = df_samples[col].mean()
        std = df_samples[col].std()
        nonzero = (df_samples[col] != 0).sum()
        print(f"  {col:30s}: mean={mean:10.4f}, std={std:10.4f}, nonzero={nonzero:6d} ({nonzero/len(df_samples)*100:5.1f}%)")

    # Label distribution
    label_counts = df_samples['label'].value_counts()
    print(f"\n📈 Label distribution:")
    print(f"  Bearish (0): {label_counts.get(0, 0):,} ({label_counts.get(0, 0)/len(df_samples)*100:.1f}%)")
    print(f"  Bullish (1): {label_counts.get(1, 0):,} ({label_counts.get(1, 0)/len(df_samples)*100:.1f}%)")

    print("\n" + "="*80)
    print("✅ COMPREHENSIVE DATASET GENERATION COMPLETE")
    print("="*80)
    print(f"\nNext steps:")
    print(f"  1. Split dataset: python3 scripts/ml/smart-money-flow/split-dataset.py {output_path}")
    print(f"  2. Train model: python3 scripts/ml/train-smart-money-comprehensive.py")

if __name__ == "__main__":
    # Parse arguments
    max_symbols = None
    output_name = 'comprehensive'

    for arg in sys.argv[1:]:
        if arg.startswith('--symbols='):
            max_symbols = int(arg.split('=')[1])
        elif arg.startswith('--name='):
            output_name = arg.split('=')[1]
        elif arg in ['-h', '--help']:
            print(__doc__)
            sys.exit(0)

    generate_dataset(max_symbols, output_name)
