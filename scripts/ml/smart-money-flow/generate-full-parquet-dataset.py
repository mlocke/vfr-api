#!/usr/bin/env python3
"""
Generate Complete Training Dataset from Parquet Features (NO API CALLS)

Reads 18 features from Parquet files for 153 symbols with complete data:
- 4 SEC insider features
- 9 price/volume features (from cache)
- 4 congress features (placeholder)
- 1 options feature (placeholder)

Output: Complete training CSV with labels for model training
"""

import pandas as pd
import pyarrow.parquet as pq
from pathlib import Path
import sys

def load_parquet_features():
    """Load all Parquet feature files"""
    print("\n📂 Loading Parquet feature files...")

    parquet_dir = Path('data/smart_money_features')

    # Load each feature file
    df_insider = pq.read_table(parquet_dir / 'insider_features.parquet').to_pandas()
    df_price = pq.read_table(parquet_dir / 'price_features.parquet').to_pandas()
    df_volume = pq.read_table(parquet_dir / 'volume_features.parquet').to_pandas()
    df_advanced = pq.read_table(parquet_dir / 'advanced_volume_features.parquet').to_pandas()
    df_options = pq.read_table(parquet_dir / 'options_features.parquet').to_pandas()
    df_congress = pq.read_table(parquet_dir / 'congress_features.parquet').to_pandas()

    print(f"  ✅ Loaded insider: {len(df_insider):,} rows")
    print(f"  ✅ Loaded price: {len(df_price):,} rows")
    print(f"  ✅ Loaded volume: {len(df_volume):,} rows")
    print(f"  ✅ Loaded advanced: {len(df_advanced):,} rows")
    print(f"  ✅ Loaded options: {len(df_options):,} rows")
    print(f"  ✅ Loaded congress: {len(df_congress):,} rows")

    return df_insider, df_price, df_volume, df_advanced, df_options, df_congress

def find_common_symbols(df_insider, df_price):
    """Find symbols present in both insider and price data"""
    insider_symbols = set(df_insider['symbol'].unique())
    price_symbols = set(df_price['symbol'].unique())

    common = sorted(insider_symbols & price_symbols)

    print(f"\n🔍 Symbol overlap:")
    print(f"  Insider symbols: {len(insider_symbols):,}")
    print(f"  Price symbols: {len(price_symbols):,}")
    print(f"  Common symbols: {len(common):,}")

    return common

def load_cached_prices():
    """Load cached price CSVs for forward return calculation"""
    print("\n📂 Loading cached price data for forward returns...")

    cache_dir = Path('data/cache/polygon_prices')
    prices_by_symbol = {}

    for csv_file in cache_dir.glob('*.csv'):
        symbol = csv_file.stem.split('_')[0]
        df = pd.read_csv(csv_file)
        df['Date'] = pd.to_datetime(df['Date'])
        prices_by_symbol[symbol] = df.set_index('Date')['Close']

    print(f"  ✅ Loaded prices for {len(prices_by_symbol)} symbols")
    return prices_by_symbol

def generate_dataset(common_symbols, df_insider, df_price, df_volume, df_advanced, df_options, df_congress, prices_by_symbol):
    """Generate complete training dataset"""
    print("\n🏗️  Generating training samples...")

    samples = []
    failed = 0

    for i, symbol in enumerate(common_symbols):
        if (i + 1) % 20 == 0:
            print(f"  [{i+1}/{len(common_symbols)}] Progress: {(i+1)/len(common_symbols)*100:.1f}% | Samples: {len(samples)}")

        # Get all features for this symbol
        symbol_insider = df_insider[df_insider['symbol'] == symbol]
        symbol_price = df_price[df_price['symbol'] == symbol]
        symbol_volume = df_volume[df_volume['symbol'] == symbol]
        symbol_advanced = df_advanced[df_advanced['symbol'] == symbol]
        symbol_options = df_options[df_options['symbol'] == symbol]
        symbol_congress = df_congress[df_congress['symbol'] == symbol]

        # Get price series for forward returns
        if symbol not in prices_by_symbol:
            continue
        price_series = prices_by_symbol[symbol]

        # Get common dates (where we have all features)
        dates_insider = set(symbol_insider['date'].values)
        dates_price = set(symbol_price['date'].values)
        common_dates = sorted(dates_insider & dates_price)

        for date_str in common_dates:
            try:
                date = pd.to_datetime(date_str)

                # Check if we have 14-day forward price
                future_date = date + pd.Timedelta(days=14)
                if date not in price_series.index or future_date not in price_series.index:
                    failed += 1
                    continue

                # Get price at sample and 14 days later
                price_at_sample = price_series.loc[date]
                price_after_14d = price_series.loc[future_date]
                return_14d = (price_after_14d - price_at_sample) / price_at_sample
                label = 1 if return_14d > 0.05 else 0

                # Extract insider features (aggregate if multiple on same day)
                insider_day = symbol_insider[symbol_insider['date'] == date_str]
                insider_buy_volume = insider_day['insider_buy_value'].sum()
                insider_sell_volume = insider_day['insider_sell_value'].sum()
                insider_count = insider_day['insider_buy_count'].sum() + insider_day['insider_sell_count'].sum()
                insider_buy_ratio = insider_buy_volume / (insider_buy_volume + insider_sell_volume) if (insider_buy_volume + insider_sell_volume) > 0 else 0.5

                # Extract other features
                price_row = symbol_price[symbol_price['date'] == date_str].iloc[0]
                volume_row = symbol_volume[symbol_volume['date'] == date_str].iloc[0]
                advanced_row = symbol_advanced[symbol_advanced['date'] == date_str].iloc[0]
                options_row = symbol_options[symbol_options['date'] == date_str].iloc[0] if len(symbol_options[symbol_options['date'] == date_str]) > 0 else None
                congress_row = symbol_congress[symbol_congress['date'] == date_str].iloc[0] if len(symbol_congress[symbol_congress['date'] == date_str]) > 0 else None

                # Build sample
                sample = {
                    'symbol': symbol,
                    'date': date_str,
                    'price_at_sample': price_at_sample,
                    'price_after_14d': price_after_14d,
                    'return_14d': return_14d,
                    'label': label,
                    # Insider features (4)
                    'insider_buy_volume_30d': insider_buy_volume,
                    'insider_sell_volume_30d': insider_sell_volume,
                    'insider_buy_ratio_30d': insider_buy_ratio,
                    'insider_transaction_count_30d': insider_count,
                    # Price features (3)
                    'price_momentum_20d': price_row['price_momentum_20d'],
                    'volume_trend_30d': price_row['volume_trend_30d'],
                    'price_volatility_30d': price_row['price_volatility_30d'],
                    # Volume features (3)
                    'institutional_volume_ratio': volume_row['institutional_volume_ratio'],
                    'volume_concentration': volume_row['volume_concentration'],
                    'dark_pool_volume_30d': volume_row['dark_pool_volume'],
                    # Advanced volume features (2)
                    'block_trade_ratio_30d': advanced_row['block_trade_ratio'],
                    'vwap_deviation_avg_30d': advanced_row['vwap_deviation'],
                    # Options feature (1)
                    'options_put_call_ratio_7d': options_row['put_call_ratio'] if options_row is not None else 1.0,
                    # Congress features (4) - placeholder
                    'congress_buy_count_90d': congress_row['congress_buy_count'] if congress_row is not None else 0,
                    'congress_sell_count_90d': congress_row['congress_sell_count'] if congress_row is not None else 0,
                    'congress_net_sentiment': congress_row['congress_net_sentiment'] if congress_row is not None else 0.0,
                    'congress_recent_activity_7d': 0
                }

                samples.append(sample)

            except Exception as e:
                failed += 1
                continue

    print(f"\n✅ Generated {len(samples):,} training samples")
    print(f"⚠️  Failed: {failed:,} samples")

    return pd.DataFrame(samples)

def main():
    print("="*80)
    print("GENERATE COMPLETE TRAINING DATASET FROM PARQUET (NO API CALLS)")
    print("="*80)

    # Load all Parquet features
    df_insider, df_price, df_volume, df_advanced, df_options, df_congress = load_parquet_features()

    # Find common symbols
    common_symbols = find_common_symbols(df_insider, df_price)

    if len(common_symbols) == 0:
        print("\n❌ No common symbols found!")
        sys.exit(1)

    # Load cached prices for forward returns
    prices_by_symbol = load_cached_prices()

    # Generate dataset
    df_samples = generate_dataset(common_symbols, df_insider, df_price, df_volume, df_advanced, df_options, df_congress, prices_by_symbol)

    # Save to CSV
    output_dir = Path('data/training/smart-money-flow-18features')
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / 'dataset.csv'
    df_samples.to_csv(output_path, index=False)

    print(f"\n💾 Saved dataset:")
    print(f"  Path: {output_path}")
    print(f"  Size: {output_path.stat().st_size / 1024 / 1024:.2f} MB")
    print(f"  Samples: {len(df_samples):,}")

    # Label distribution
    print(f"\n📈 Label distribution:")
    label_counts = df_samples['label'].value_counts()
    print(f"  Bearish (0): {label_counts.get(0, 0):,} ({label_counts.get(0, 0)/len(df_samples)*100:.1f}%)")
    print(f"  Bullish (1): {label_counts.get(1, 0):,} ({label_counts.get(1, 0)/len(df_samples)*100:.1f}%)")

    print("\n" + "="*80)
    print("✅ DATASET GENERATION COMPLETE")
    print("="*80)
    print("\nNext steps:")
    print(f"  1. Split: python3 scripts/ml/smart-money-flow/split-dataset.py {output_path}")
    print(f"  2. Train: python3 scripts/ml/train-18feature-model.py")

if __name__ == "__main__":
    main()
