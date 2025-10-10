#!/usr/bin/env python3
"""
Generate Price Features for Polygon News Dataset

Generates 43 price/technical features for each (ticker, date) pair from the
sentiment-scored news dataset.

CRITICAL OPTIMIZATION: Fetches historical price data ONCE per ticker and caches
it to disk. This prevents redundant API calls for historical data.

Input:
  - data/training/polygon_news_with_sentiment.csv (118K articles with sentiment)

Output:
  - data/training/polygon_price_features.csv (unique ticker-date pairs with 43 features + label)

Cache:
  - data/cache/polygon_prices/ (historical OHLCV data per ticker)

Features (43 total):
  - Volume (6): ratios, spikes, trends, acceleration, dark pool (placeholder)
  - Technical (10): RSI, MACD, Bollinger, Stochastic, ADX, ATR, EMAs, Williams %R
  - Price action (8): momentum, acceleration, gaps, volatility, overnight
  - Options (7): put/call ratio, unusual activity, IV rank (placeholders)
  - Institutional (4): net flow, block trades, insider buying (placeholders)
  - Sentiment (4): news sentiment, social, analyst targets (from news data)
  - Macro (4): sector/SPY momentum, VIX, correlation (placeholders)

Label:
  - UP: price change > 2% in next 7 trading days
  - DOWN: price change < -2% in next 7 trading days
  - NEUTRAL: price change between -2% and 2%

Usage:
    python3 scripts/ml/generate-polygon-price-features.py
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
import sys
import json
from tqdm import tqdm

# Feature calculation functions
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
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    features['atr_14'] = true_range.rolling(14).mean()

    # ADX (simplified placeholder)
    features['adx_14'] = 25

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

    # Volume trend (simplified)
    features['volume_trend'] = df['Volume'].pct_change(periods=10)

    # Volume acceleration
    features['volume_acceleration'] = df['Volume'].diff().rolling(5).mean()

    # Dark pool activity (placeholder)
    features['dark_pool_ratio'] = 0.3

    return pd.DataFrame(features)

def calculate_price_action_features(df):
    """Calculate price action features"""
    features = {}

    # Momentum
    features['price_momentum_5d'] = df['Close'].pct_change(periods=5)
    features['price_momentum_10d'] = df['Close'].pct_change(periods=10)
    features['price_momentum_20d'] = df['Close'].pct_change(periods=20)

    # Price acceleration
    features['price_acceleration'] = df['Close'].pct_change().diff()

    # Gap analysis
    features['gap_size'] = (df['Open'] - df['Close'].shift()) / df['Close'].shift()

    # Volatility
    features['volatility_20d'] = df['Close'].pct_change().rolling(20).std()

    # Overnight moves
    features['overnight_return'] = (df['Open'] - df['Close'].shift()) / df['Close'].shift()

    # Intraday range
    features['intraday_range'] = (df['High'] - df['Low']) / df['Open']

    return pd.DataFrame(features)

def calculate_placeholder_features():
    """Placeholder features for options, institutional, macro"""
    return {
        # Options flow (7 features) - placeholders
        'options_put_call_ratio': 0.8,
        'options_unusual_activity': 0.0,
        'options_iv_rank': 50.0,
        'options_call_volume': 1000,
        'options_put_volume': 800,
        'options_oi_put_call': 0.85,
        'options_gamma_exposure': 0.0,

        # Institutional (4 features) - placeholders
        'institutional_net_flow': 0.0,
        'institutional_block_trades': 0,
        'institutional_ownership_pct': 0.7,
        'insider_buying_ratio': 0.5,

        # Macro (4 features) - placeholders
        'sector_momentum': 0.0,
        'spy_correlation': 0.5,
        'vix_level': 20.0,
        'sector_relative_strength': 0.0,
    }

def get_historical_prices(ticker, start_date, end_date, cache_dir='data/cache/polygon_prices'):
    """Fetch historical prices with disk caching"""
    os.makedirs(cache_dir, exist_ok=True)

    # Normalize ticker for BRK.B -> BRK-B
    yf_ticker = ticker.replace('.', '-')

    cache_file = os.path.join(cache_dir, f"{yf_ticker}_{start_date}_{end_date}.csv")

    # Check cache first
    if os.path.exists(cache_file):
        df = pd.read_csv(cache_file, index_col=0, parse_dates=True)
        df.index = pd.to_datetime(df.index)
        return df

    # Cache miss - fetch from yfinance
    try:
        df = yf.download(yf_ticker, start=start_date, end=end_date, progress=False)

        if len(df) == 0:
            return None

        # Flatten multi-level columns if present (yfinance sometimes returns these)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Ensure index is datetime
        df.index = pd.to_datetime(df.index)

        # Save to cache with clean format
        df.to_csv(cache_file)

        return df
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return None

def generate_label(df, target_date, lookahead_days=7, threshold=0.02):
    """Generate UP/DOWN/NEUTRAL label based on future price movement"""
    try:
        # Use get_indexer for pandas 2.x compatibility (get_loc doesn't support method='nearest')
        idx_pos = df.index.get_indexer([target_date], method='nearest')[0]

        if idx_pos == -1:
            return 'NEUTRAL'  # Date not found

        if idx_pos + lookahead_days >= len(df):
            return 'NEUTRAL'  # Not enough future data

        current_price = df.iloc[idx_pos]['Close']
        future_price = df.iloc[idx_pos + lookahead_days]['Close']

        pct_change = (future_price - current_price) / current_price

        if pct_change > threshold:
            return 'UP'
        elif pct_change < -threshold:
            return 'DOWN'
        else:
            return 'NEUTRAL'
    except:
        return 'NEUTRAL'

def generate_polygon_price_features():
    """Main function to generate price features"""

    print("=" * 80)
    print("GENERATE PRICE FEATURES FOR POLYGON NEWS DATASET")
    print("=" * 80)
    print()

    # Load sentiment-scored news dataset
    input_file = "data/training/polygon_news_with_sentiment.csv"

    if not os.path.exists(input_file):
        print(f"❌ Error: {input_file} not found")
        print("Run: python3 scripts/ml/score-polygon-sentiment.py first")
        sys.exit(1)

    print(f"📂 Loading sentiment-scored news: {input_file}")
    df_news = pd.read_csv(input_file)
    df_news['published_utc'] = pd.to_datetime(df_news['published_utc'])
    df_news['date'] = df_news['published_utc'].dt.date
    print(f"   ✓ Loaded {len(df_news):,} news articles")
    print()

    # Extract unique (ticker, date) pairs
    print("🔍 Extracting unique (ticker, date) pairs...")
    unique_pairs = df_news[['ticker', 'date']].drop_duplicates().reset_index(drop=True)
    unique_pairs = unique_pairs.sort_values(['ticker', 'date']).reset_index(drop=True)
    print(f"   ✓ Found {len(unique_pairs):,} unique (ticker, date) pairs")
    print(f"   Date range: {unique_pairs['date'].min()} to {unique_pairs['date'].max()}")
    print(f"   Unique tickers: {unique_pairs['ticker'].nunique()}")
    print()

    # Get date range for price data (extend backward for lookback, forward for labels)
    min_date = unique_pairs['date'].min()
    max_date = unique_pairs['date'].max()
    start_date = (pd.to_datetime(min_date) - timedelta(days=60)).strftime('%Y-%m-%d')
    end_date = (pd.to_datetime(max_date) + timedelta(days=14)).strftime('%Y-%m-%d')

    print(f"📅 Fetching price data from {start_date} to {end_date}")
    print(f"   (includes 60-day lookback for indicators + 14-day lookahead for labels)")
    print()

    # Fetch price data per ticker (with caching)
    print("=" * 80)
    print("PHASE 1: FETCH HISTORICAL PRICE DATA (CACHE PER TICKER)")
    print("=" * 80)
    print()

    unique_tickers = sorted(unique_pairs['ticker'].unique())
    ticker_price_cache = {}

    for idx, ticker in enumerate(unique_tickers, 1):
        print(f"[{idx}/{len(unique_tickers)}] Fetching prices for {ticker}...")
        df_prices = get_historical_prices(ticker, start_date, end_date)

        if df_prices is None or len(df_prices) == 0:
            print(f"   ⚠️  No price data available for {ticker}")
            continue

        ticker_price_cache[ticker] = df_prices
        print(f"   ✓ Cached {len(df_prices)} trading days")

    print()
    print(f"✅ Price data fetched for {len(ticker_price_cache)} tickers")
    print()

    # Generate features for each (ticker, date) pair
    print("=" * 80)
    print("PHASE 2: CALCULATE FEATURES FOR EACH (TICKER, DATE) PAIR")
    print("=" * 80)
    print()

    results = []

    for idx, row in tqdm(unique_pairs.iterrows(), total=len(unique_pairs), desc="Generating features"):
        ticker = row['ticker']
        target_date_str = row['date']
        target_date = pd.to_datetime(target_date_str).normalize()  # Normalize to midnight

        # Get cached price data
        df_prices = ticker_price_cache.get(ticker)

        if df_prices is None:
            continue  # Skip if no price data

        # Normalize price index to dates only (remove time component)
        df_prices_normalized = df_prices.copy()
        df_prices_normalized.index = df_prices_normalized.index.normalize()

        # Find target date in price data
        try:
            if target_date not in df_prices_normalized.index:
                # Find nearest trading day (within 5 days)
                nearest_dates = df_prices_normalized.index[
                    (df_prices_normalized.index >= target_date - pd.Timedelta(days=5)) &
                    (df_prices_normalized.index <= target_date + pd.Timedelta(days=5))
                ]
                if len(nearest_dates) == 0:
                    continue
                target_date = nearest_dates[0]
        except:
            continue  # Skip if date not found

        # Calculate technical features
        tech_features = calculate_technical_features(df_prices)
        volume_features = calculate_volume_features(df_prices)
        price_features = calculate_price_action_features(df_prices)

        # Get features for target date
        try:
            target_idx = df_prices.index.get_loc(target_date)

            features = {
                'ticker': ticker,
                'date': target_date.strftime('%Y-%m-%d'),
            }

            # Add technical features
            for col in tech_features.columns:
                features[col] = tech_features.iloc[target_idx][col]

            # Add volume features
            for col in volume_features.columns:
                features[col] = volume_features.iloc[target_idx][col]

            # Add price action features
            for col in price_features.columns:
                features[col] = price_features.iloc[target_idx][col]

            # Add placeholder features
            features.update(calculate_placeholder_features())

            # Generate label (use normalized dataframe with normalized target_date)
            features['label'] = generate_label(df_prices_normalized, target_date, lookahead_days=7, threshold=0.02)

            results.append(features)

        except Exception as e:
            continue  # Skip on error

    print()
    print(f"✅ Generated features for {len(results):,} (ticker, date) pairs")
    print()

    # Create dataframe
    df_features = pd.DataFrame(results)

    # Save to CSV
    output_file = "data/training/polygon_price_features.csv"
    print(f"💾 Saving price features dataset: {output_file}")
    df_features.to_csv(output_file, index=False)

    file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"   ✓ Saved {len(df_features):,} rows, {len(df_features.columns)} columns")
    print(f"   File size: {file_size_mb:.1f} MB")
    print()

    # Statistics
    print("=" * 80)
    print("DATASET SUMMARY")
    print("=" * 80)
    print()

    print(f"Total examples: {len(df_features):,}")
    print(f"Unique tickers: {df_features['ticker'].nunique()}")
    print(f"Date range: {df_features['date'].min()} to {df_features['date'].max()}")
    print(f"Total features: {len(df_features.columns) - 3}")  # Exclude ticker, date, label
    print()

    print("Label distribution:")
    print(df_features['label'].value_counts().sort_index())
    label_pcts = df_features['label'].value_counts(normalize=True).sort_index() * 100
    for label, pct in label_pcts.items():
        print(f"  {label}: {pct:.1f}%")
    print()

    print("Top 10 tickers by example count:")
    print(df_features['ticker'].value_counts().head(10))
    print()

    print("=" * 80)
    print("✅ COMPLETE - PRICE FEATURES GENERATION")
    print("=" * 80)
    print()
    print("Next steps:")
    print("  1. Merge with sentiment features: python3 scripts/ml/merge-polygon-features.py")
    print("  2. Split dataset: python3 scripts/ml/split-polygon-dataset.py")
    print("  3. Train model: python3 scripts/ml/train-polygon-model.py")
    print()


if __name__ == "__main__":
    generate_polygon_price_features()
