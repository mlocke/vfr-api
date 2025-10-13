#!/usr/bin/env python3
"""
Build Complete Parquet Feature Files from Cached Data

Takes cached price/volume/sentiment data and builds feature Parquet files
for all 13 placeholder features, enabling training without API calls.

Features Built:
- price_features.parquet (3 features: momentum, volume_trend, volatility)
- volume_features.parquet (3 features: institutional_ratio, concentration, dark_pool)
- advanced_volume_features.parquet (2 features: block_trade_ratio, vwap_deviation)
- options_features.parquet (1 feature: put_call_ratio) - placeholder
- congress_features.parquet (4 features) - placeholder zeros

Input: data/cache/polygon_prices/*.csv, data/cache/polygon_sentiment/*.json
Output: data/smart_money_features/*.parquet (updated with real data)
"""

import pandas as pd
import numpy as np
from pathlib import Path
import json
from datetime import datetime, timedelta

def calculate_price_momentum(df, window=20):
    """Calculate price momentum over window days"""
    if len(df) < window:
        return 0.0
    return (df['Close'].iloc[-1] / df['Close'].iloc[-window] - 1.0)

def calculate_volume_trend(df, window=30):
    """Calculate volume trend (current vs average)"""
    if len(df) < window:
        return 1.0
    recent_avg = df['Volume'].iloc[-7:].mean()
    baseline_avg = df['Volume'].iloc[-window:].mean()
    return recent_avg / baseline_avg if baseline_avg > 0 else 1.0

def calculate_volatility(df, window=30):
    """Calculate price volatility (std dev of returns)"""
    if len(df) < window:
        return 0.0
    returns = df['Close'].pct_change().iloc[-window:]
    return returns.std()

def calculate_volume_concentration(df, window=30):
    """Volume concentration (top day / avg)"""
    if len(df) < window:
        return 0.0
    volumes = df['Volume'].iloc[-window:]
    return volumes.max() / volumes.mean() if volumes.mean() > 0 else 0.0

def calculate_block_trade_ratio(df, window=30):
    """Estimate block trades (days with volume > 2x avg)"""
    if len(df) < window:
        return 0.0
    volumes = df['Volume'].iloc[-window:]
    avg_volume = volumes.mean()
    block_days = (volumes > 2 * avg_volume).sum()
    return block_days / window

def calculate_vwap_deviation(df, window=30):
    """VWAP deviation from close price"""
    if len(df) < window or 'Volume' not in df.columns:
        return 0.0

    recent_df = df.iloc[-window:].copy()
    # VWAP = sum(price * volume) / sum(volume)
    vwap = (recent_df['Close'] * recent_df['Volume']).sum() / recent_df['Volume'].sum()
    current_price = recent_df['Close'].iloc[-1]

    return (current_price - vwap) / vwap if vwap > 0 else 0.0

def load_cached_prices(cache_dir):
    """Load all cached price CSV files"""
    price_dir = Path(cache_dir) / 'polygon_prices'

    symbols_data = {}
    csv_files = list(price_dir.glob('*.csv'))

    print(f"\n📂 Loading cached price data from {len(csv_files)} symbols...")

    for csv_file in csv_files:
        try:
            # Extract symbol from filename (e.g., AAPL_2022-11-02_2025-10-23.csv)
            symbol = csv_file.stem.split('_')[0]

            # Load CSV
            df = pd.read_csv(csv_file)
            df['Date'] = pd.to_datetime(df['Date'])
            df = df.sort_values('Date')

            symbols_data[symbol] = df

        except Exception as e:
            print(f"  ⚠️  Failed to load {csv_file.name}: {e}")

    print(f"  ✅ Loaded price data for {len(symbols_data)} symbols")
    return symbols_data

def build_price_features(symbols_data):
    """Build price_features.parquet from cached price data"""
    print("\n🏗️  Building price_features.parquet...")

    records = []

    for symbol, df in symbols_data.items():
        # Generate samples every 7 days
        dates = df['Date'].values

        for i in range(30, len(dates), 7):  # Start at day 30 to have enough history
            date = pd.to_datetime(dates[i])
            date_str = date.strftime('%Y-%m-%d')

            # Get data up to this date
            hist_df = df[df['Date'] <= date].copy()

            # Calculate features
            momentum_20d = calculate_price_momentum(hist_df, 20)
            volume_trend_30d = calculate_volume_trend(hist_df, 30)
            volatility_30d = calculate_volatility(hist_df, 30)

            records.append({
                'symbol': symbol,
                'date': date_str,
                'price_momentum_20d': momentum_20d,
                'volume_trend_30d': volume_trend_30d,
                'price_volatility_30d': volatility_30d
            })

    df_features = pd.DataFrame(records)
    print(f"  ✅ Generated {len(df_features):,} price feature records")
    return df_features

def build_volume_features(symbols_data):
    """Build volume_features.parquet from cached price data"""
    print("\n🏗️  Building volume_features.parquet...")

    records = []

    for symbol, df in symbols_data.items():
        dates = df['Date'].values

        for i in range(30, len(dates), 7):
            date = pd.to_datetime(dates[i])
            date_str = date.strftime('%Y-%m-%d')

            hist_df = df[df['Date'] <= date].copy()

            # Calculate volume features
            volume_concentration = calculate_volume_concentration(hist_df, 30)

            # Institutional volume ratio (estimate: volume on up days / total)
            recent_df = hist_df.iloc[-30:]
            up_days_volume = recent_df[recent_df['Close'] > recent_df['Open']]['Volume'].sum()
            total_volume = recent_df['Volume'].sum()
            inst_ratio = up_days_volume / total_volume if total_volume > 0 else 0.5

            # Dark pool volume (estimate: use 10% of volume as proxy)
            dark_pool_volume = recent_df['Volume'].sum() * 0.10

            records.append({
                'symbol': symbol,
                'date': date_str,
                'institutional_volume_ratio': inst_ratio,
                'volume_concentration': volume_concentration,
                'dark_pool_volume': dark_pool_volume
            })

    df_features = pd.DataFrame(records)
    print(f"  ✅ Generated {len(df_features):,} volume feature records")
    return df_features

def build_advanced_volume_features(symbols_data):
    """Build advanced_volume_features.parquet"""
    print("\n🏗️  Building advanced_volume_features.parquet...")

    records = []

    for symbol, df in symbols_data.items():
        dates = df['Date'].values

        for i in range(30, len(dates), 7):
            date = pd.to_datetime(dates[i])
            date_str = date.strftime('%Y-%m-%d')

            hist_df = df[df['Date'] <= date].copy()

            block_ratio = calculate_block_trade_ratio(hist_df, 30)
            vwap_dev = calculate_vwap_deviation(hist_df, 30)

            records.append({
                'symbol': symbol,
                'date': date_str,
                'block_trade_ratio': block_ratio,
                'vwap_deviation': vwap_dev
            })

    df_features = pd.DataFrame(records)
    print(f"  ✅ Generated {len(df_features):,} advanced volume feature records")
    return df_features

def build_placeholder_features(symbols_data):
    """Build placeholder Parquet files for options and congress"""
    print("\n🏗️  Building placeholder features (options, congress)...")

    options_records = []
    congress_records = []

    for symbol, df in symbols_data.items():
        dates = df['Date'].values

        for i in range(7, len(dates), 7):
            date = pd.to_datetime(dates[i])
            date_str = date.strftime('%Y-%m-%d')

            # Options: put/call ratio placeholder (neutral 1.0)
            options_records.append({
                'symbol': symbol,
                'date': date_str,
                'put_call_ratio': 1.0
            })

            # Congress: all zeros (no trades)
            congress_records.append({
                'symbol': symbol,
                'date': date_str,
                'congress_buy_count': 0,
                'congress_sell_count': 0,
                'congress_net_value': 0.0,
                'congress_net_sentiment': 0.0
            })

    df_options = pd.DataFrame(options_records)
    df_congress = pd.DataFrame(congress_records)

    print(f"  ✅ Generated {len(df_options):,} options records (placeholder)")
    print(f"  ✅ Generated {len(df_congress):,} congress records (placeholder)")

    return df_options, df_congress

def save_parquet(df, filename, output_dir):
    """Save DataFrame to Parquet"""
    output_path = Path(output_dir) / filename
    df.to_parquet(output_path, index=False, compression='snappy')
    file_size = output_path.stat().st_size / 1024 / 1024
    print(f"  💾 Saved {filename}: {len(df):,} rows, {file_size:.2f} MB")

def main():
    print("="*80)
    print("BUILD PARQUET FEATURES FROM CACHED DATA")
    print("="*80)

    cache_dir = Path('data/cache')
    output_dir = Path('data/smart_money_features')
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load cached data
    symbols_data = load_cached_prices(cache_dir)

    if len(symbols_data) == 0:
        print("\n❌ No cached price data found!")
        return

    # Build all feature files
    df_price = build_price_features(symbols_data)
    df_volume = build_volume_features(symbols_data)
    df_advanced = build_advanced_volume_features(symbols_data)
    df_options, df_congress = build_placeholder_features(symbols_data)

    # Save to Parquet
    print("\n💾 Saving Parquet files...")
    save_parquet(df_price, 'price_features.parquet', output_dir)
    save_parquet(df_volume, 'volume_features.parquet', output_dir)
    save_parquet(df_advanced, 'advanced_volume_features.parquet', output_dir)
    save_parquet(df_options, 'options_features.parquet', output_dir)
    save_parquet(df_congress, 'congress_features.parquet', output_dir)

    print("\n" + "="*80)
    print("✅ PARQUET FILES BUILT SUCCESSFULLY")
    print("="*80)
    print(f"\nSymbols: {len(symbols_data)}")
    print(f"Output: {output_dir}")
    print(f"\nNext step: Generate training dataset with all 20 features")
    print(f"  python3 scripts/ml/smart-money-flow/generate-parquet-dataset.py --symbols={','.join(list(symbols_data.keys())[:10])}")

if __name__ == "__main__":
    main()
