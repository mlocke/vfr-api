#!/usr/bin/env python3
"""
Generate Price Prediction Dataset using yfinance

Uses yfinance for reliable historical data access.
Generates simplified feature set for price movement prediction.

⚠️ IMPORTANT: Before running this script, review the caching principles in:
   scripts/ml/CLAUDE.md - "CRITICAL: HISTORICAL DATA CACHING PRINCIPLE"

   Without caching, this script may make 73,200+ redundant API calls for
   historical data that never changes. Proper caching reduces this to ~100 calls
   on first run and 0 calls on subsequent runs.
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time

# Stock universe
SP500_TOP_100 = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B', 'UNH', 'JNJ',
    'V', 'XOM', 'WMT', 'JPM', 'LLY', 'MA', 'PG', 'AVGO', 'HD', 'CVX',
    'MRK', 'ABBV', 'PEP', 'COST', 'KO', 'ADBE', 'MCD', 'CSCO', 'CRM', 'TMO',
    'ACN', 'ABT', 'NFLX', 'DHR', 'WFC', 'VZ', 'TXN', 'PM', 'NEE', 'ORCL',
    'DIS', 'NKE', 'CMCSA', 'BMY', 'RTX', 'UNP', 'PFE', 'INTC', 'QCOM', 'COP',
    'LIN', 'AMD', 'HON', 'UPS', 'LOW', 'T', 'CAT', 'ELV', 'BA', 'INTU',
    'SBUX', 'DE', 'AXP', 'GS', 'AMGN', 'MS', 'SPGI', 'BLK', 'GILD', 'BKNG',
    'MDLZ', 'ADI', 'PLD', 'TJX', 'SYK', 'CVS', 'MMC', 'C', 'VRTX', 'ADP',
    'ISRG', 'ZTS', 'REGN', 'NOW', 'TMUS', 'MO', 'SCHW', 'CB', 'SO', 'DUK',
    'PGR', 'CI', 'BDX', 'CL', 'NOC', 'LRCX', 'BSX', 'EOG', 'ITW', 'GE'
]

def calculate_technical_features(df):
    """Calculate technical indicator features"""
    features = {}

    # RSI (14-day)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    features['rsi_14'] = 100 - (100 / (1 + rs))

    # Moving averages
    features['ema_20'] = df['Close'].ewm(span=20).mean()
    features['sma_50'] = df['Close'].rolling(50).mean()
    features['ema_20_distance'] = (df['Close'] - features['ema_20']) / features['ema_20']
    features['sma_50_distance'] = (df['Close'] - features['sma_50']) / features['sma_50']

    # Bollinger Bands
    sma20 = df['Close'].rolling(20).mean()
    std20 = df['Close'].rolling(20).std()
    upper_bb = sma20 + (2 * std20)
    lower_bb = sma20 - (2 * std20)
    features['bollinger_position'] = (df['Close'] - lower_bb) / (upper_bb - lower_bb)

    # MACD
    ema12 = df['Close'].ewm(span=12).mean()
    ema26 = df['Close'].ewm(span=26).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9).mean()
    features['macd_signal'] = macd - signal
    features['macd_histogram'] = macd - signal

    # ATR
    high_low = df['High'] - df['Low']
    high_close = np.abs(df['High'] - df['Close'].shift())
    low_close = np.abs(df['Low'] - df['Close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = ranges.max(axis=1)
    features['atr_14'] = true_range.rolling(14).mean()

    # ADX (simplified)
    features['adx_14'] = 25  # Placeholder

    # Stochastic K%
    low_14 = df['Low'].rolling(14).min()
    high_14 = df['High'].rolling(14).max()
    features['stochastic_k'] = 100 * (df['Close'] - low_14) / (high_14 - low_14)

    # Williams %R
    features['williams_r'] = -100 * (high_14 - df['Close']) / (high_14 - low_14)

    return pd.DataFrame(features)

def calculate_volume_features(df):
    """Calculate volume-based features"""
    features = {}

    # Volume ratios
    features['volume_ratio_5d'] = df['Volume'] / df['Volume'].rolling(5).mean()
    features['volume_spike'] = (df['Volume'] > 2 * df['Volume'].rolling(20).mean()).astype(int)
    features['relative_volume'] = df['Volume'] / df['Volume'].rolling(20).mean()

    # Volume trend
    vol_series = df['Volume'].rolling(10)
    x = np.arange(10)
    def calc_slope(y):
        if len(y) < 10:
            return 0
        return np.polyfit(x, y, 1)[0]
    features['volume_trend_10d'] = df['Volume'].rolling(10).apply(calc_slope, raw=False)

    # Volume acceleration
    vol_trend_5d = df['Volume'].rolling(5).apply(lambda y: np.polyfit(np.arange(len(y)), y, 1)[0] if len(y) == 5 else 0, raw=False)
    features['volume_acceleration'] = features['volume_trend_10d'] - vol_trend_5d

    # Dark pool ratio (placeholder)
    features['dark_pool_ratio'] = 0

    return pd.DataFrame(features)

def calculate_price_action_features(df):
    """Calculate price action features"""
    features = {}

    # Price momentum
    features['price_momentum_5d'] = df['Close'].pct_change(5)
    features['price_momentum_10d'] = df['Close'].pct_change(10)
    features['price_momentum_20d'] = df['Close'].pct_change(20)
    features['price_acceleration'] = features['price_momentum_5d'] - features['price_momentum_10d']

    # Gap
    features['gap_percent'] = (df['Open'] - df['Close'].shift(1)) / df['Close'].shift(1)

    # Intraday volatility
    features['intraday_volatility'] = (df['High'] - df['Low']) / df['Open']

    # Overnight return
    features['overnight_return'] = (df['Open'] - df['Close'].shift(1)) / df['Close'].shift(1)

    # Distance from 52-week high
    high_52w = df['High'].rolling(252).max()
    features['week_high_distance'] = (high_52w - df['Close']) / high_52w

    return pd.DataFrame(features)

def calculate_label(df, threshold=2.0):
    """Calculate price movement label (UP/DOWN/NEUTRAL)"""
    # 7-day forward return
    future_return = df['Close'].pct_change(7).shift(-7) * 100

    labels = []
    for ret in future_return:
        if pd.isna(ret):
            labels.append(None)
        elif ret > threshold:
            labels.append('UP')
        elif ret < -threshold:
            labels.append('DOWN')
        else:
            labels.append('NEUTRAL')

    return pd.Series(labels, index=df.index)

def generate_dataset(symbols, start_date, end_date, output_file, checkpoint_freq=10):
    """Generate complete training dataset"""
    print(f"🚀 Price Prediction Dataset Generation (yfinance)")
    print("=" * 80)
    print(f"  Symbols: {len(symbols)}")
    print(f"  Date Range: {start_date} to {end_date}")
    print(f"  Output: {output_file}")
    print("=" * 80)

    all_data = []
    successful = 0
    failed = []

    for i, symbol in enumerate(symbols):
        print(f"\n[{i+1}/{len(symbols)}] Processing {symbol}...")

        try:
            # Download data
            ticker = yf.Ticker(symbol)
            df = ticker.history(start=start_date, end=end_date)

            if len(df) < 60:  # Need minimum 60 days for indicators
                print(f"  ⚠️ Insufficient data ({len(df)} days)")
                failed.append(symbol)
                continue

            # Calculate features
            tech_features = calculate_technical_features(df)
            vol_features = calculate_volume_features(df)
            price_features = calculate_price_action_features(df)

            # Combine all features
            features_df = pd.concat([tech_features, vol_features, price_features], axis=1)

            # Add placeholders for missing features
            for col in ['put_call_ratio', 'put_call_ratio_change', 'unusual_options_activity',
                       'options_iv_rank', 'gamma_exposure', 'max_pain_distance', 'options_volume_ratio',
                       'institutional_net_flow', 'block_trade_volume', 'insider_buying_ratio',
                       'ownership_change_30d', 'news_sentiment_delta', 'social_momentum',
                       'analyst_target_distance', 'earnings_surprise_impact', 'sector_momentum_5d',
                       'spy_momentum_5d', 'vix_level', 'correlation_to_spy_20d']:
                if col == 'put_call_ratio':
                    features_df[col] = 1
                elif col == 'vix_level':
                    features_df[col] = 15
                elif col == 'correlation_to_spy_20d':
                    features_df[col] = 0.7
                else:
                    features_df[col] = 0

            # Calculate labels
            features_df['label'] = calculate_label(df)

            # Add symbol and date
            features_df['symbol'] = symbol
            features_df['date'] = df.index.strftime('%Y-%m-%d')

            # Remove rows with missing labels or key features
            features_df = features_df.dropna(subset=['label', 'rsi_14', 'price_momentum_5d'])

            if len(features_df) > 0:
                all_data.append(features_df)
                successful += 1
                print(f"  ✓ Generated {len(features_df)} examples")
            else:
                failed.append(symbol)
                print(f"  ⚠️ No valid examples generated")

            # Checkpoint
            if (i + 1) % checkpoint_freq == 0 and all_data:
                checkpoint_file = output_file.replace('.csv', f'_checkpoint_{i+1}.csv')
                combined = pd.concat(all_data, ignore_index=True)
                combined.to_csv(checkpoint_file, index=False)
                print(f"\n💾 Checkpoint saved: {checkpoint_file} ({len(combined)} rows)")

            # Rate limiting
            time.sleep(0.1)

        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
            failed.append(symbol)

    # Save final dataset
    if all_data:
        final_df = pd.concat(all_data, ignore_index=True)

        # Reorder columns
        col_order = ['symbol', 'date',
                    'volume_ratio_5d', 'volume_spike', 'volume_trend_10d', 'relative_volume',
                    'volume_acceleration', 'dark_pool_ratio',
                    'rsi_14', 'macd_signal', 'macd_histogram', 'bollinger_position',
                    'stochastic_k', 'adx_14', 'atr_14', 'ema_20_distance', 'sma_50_distance', 'williams_r',
                    'price_momentum_5d', 'price_momentum_10d', 'price_momentum_20d', 'price_acceleration',
                    'gap_percent', 'intraday_volatility', 'overnight_return', 'week_high_distance',
                    'put_call_ratio', 'put_call_ratio_change', 'unusual_options_activity', 'options_iv_rank',
                    'gamma_exposure', 'max_pain_distance', 'options_volume_ratio',
                    'institutional_net_flow', 'block_trade_volume', 'insider_buying_ratio', 'ownership_change_30d',
                    'news_sentiment_delta', 'social_momentum', 'analyst_target_distance', 'earnings_surprise_impact',
                    'sector_momentum_5d', 'spy_momentum_5d', 'vix_level', 'correlation_to_spy_20d',
                    'label']
        final_df = final_df[col_order]

        final_df.to_csv(output_file, index=False)

        print("\n" + "=" * 80)
        print("✅ Dataset Generation Complete")
        print("=" * 80)
        print(f"  Total Rows: {len(final_df):,}")
        print(f"  Successful Symbols: {successful}")
        print(f"  Failed Symbols: {len(failed)}")
        if failed:
            print(f"    {', '.join(failed[:10])}{'...' if len(failed) > 10 else ''}")
        print(f"  Output File: {output_file}")

        # Label distribution
        label_dist = final_df['label'].value_counts()
        print(f"\n  Label Distribution:")
        for label, count in label_dist.items():
            pct = 100 * count / len(final_df)
            print(f"    {label}: {count:,} ({pct:.1f}%)")
        print("=" * 80)
    else:
        print("\n❌ No data generated")

if __name__ == "__main__":
    # Generate dataset for top 100 stocks, 3 years
    generate_dataset(
        symbols=SP500_TOP_100,
        start_date='2022-01-01',
        end_date='2024-12-31',
        output_file='data/training/price-prediction-yf-top100.csv',
        checkpoint_freq=10
    )
