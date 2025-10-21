#!/usr/bin/env python3
"""
Volatility Feature Extraction Script

Purpose: Extract volatility-specific technical indicators and features from Polygon price data
Author: VFR ML Team
Date: 2025-10-19

Features Extracted (15-17 features):
1. Volatility History (7): ATR 14/21/50, Realized vol 7d/14d/21d, Parkinson vol
2. Price Action (7): Close, High-Low range, RSI 14, MACD, MACD signal, Bollinger %B, ADX, Price ROC 21
3. Volume (3): Volume, Volume ROC, Volume MA ratio

Output: data/processed/volatility_features.parquet
"""

import pandas as pd
import numpy as np
import glob
import gzip
from pathlib import Path
from datetime import datetime, timedelta
import pyarrow as pa
import pyarrow.parquet as pq

# === Configuration ===
POLYGON_DATA_DIR = Path(__file__).parent.parent.parent.parent / "datasets" / "polygon-flat-files" / "day_aggs"
OUTPUT_DIR = Path(__file__).parent.parent.parent.parent / "data" / "processed"
OUTPUT_FILE = OUTPUT_DIR / "volatility_features.parquet"

# Indicator periods
ATR_PERIODS = [14, 21, 50]
REALIZED_VOL_PERIODS = [7, 14, 21, 30]
RSI_PERIOD = 14
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9
BOLLINGER_PERIOD = 20
BOLLINGER_STD = 2
ADX_PERIOD = 14
PRICE_ROC_PERIOD = 21
VOLUME_MA_PERIOD = 20

# Trading days per year for annualization
TRADING_DAYS_PER_YEAR = 252

print(f"🚀 Volatility Feature Extraction Started")
print(f"📂 Reading from: {POLYGON_DATA_DIR}")
print(f"💾 Output: {OUTPUT_FILE}")


# === Helper Functions ===

def calculate_atr(df: pd.DataFrame, period: int) -> pd.Series:
    """Calculate Average True Range"""
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - df['close'].shift(1))
    low_close = np.abs(df['low'] - df['close'].shift(1))

    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    atr = true_range.rolling(window=period, min_periods=period).mean()

    return atr


def calculate_realized_volatility(df: pd.DataFrame, period: int) -> pd.Series:
    """Calculate realized volatility (annualized) from log returns"""
    log_returns = np.log(df['close'] / df['close'].shift(1))
    realized_vol = log_returns.rolling(window=period, min_periods=period).std() * np.sqrt(TRADING_DAYS_PER_YEAR)

    return realized_vol


def calculate_parkinson_volatility(df: pd.DataFrame, period: int = 20) -> pd.Series:
    """
    Calculate Parkinson volatility (high-low range based)
    More efficient than close-to-close volatility
    """
    log_hl = np.log(df['high'] / df['low'])
    parkinson_var = (log_hl ** 2) / (4 * np.log(2))
    parkinson_vol = parkinson_var.rolling(window=period, min_periods=period).mean() ** 0.5
    parkinson_vol = parkinson_vol * np.sqrt(TRADING_DAYS_PER_YEAR)  # Annualize

    return parkinson_vol


def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Calculate Relative Strength Index"""
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period, min_periods=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period, min_periods=period).mean()

    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))

    return rsi


def calculate_macd(df: pd.DataFrame, fast=12, slow=26, signal=9) -> tuple:
    """Calculate MACD, MACD Signal, and MACD Histogram"""
    exp_fast = df['close'].ewm(span=fast, adjust=False).mean()
    exp_slow = df['close'].ewm(span=slow, adjust=False).mean()

    macd_line = exp_fast - exp_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()

    return macd_line, signal_line


def calculate_bollinger_bands(df: pd.DataFrame, period=20, num_std=2) -> pd.Series:
    """Calculate Bollinger Band %B (position within bands)"""
    sma = df['close'].rolling(window=period, min_periods=period).mean()
    std = df['close'].rolling(window=period, min_periods=period).std()

    upper_band = sma + (std * num_std)
    lower_band = sma - (std * num_std)

    # %B = (Price - Lower Band) / (Upper Band - Lower Band)
    bollinger_pct_b = (df['close'] - lower_band) / (upper_band - lower_band)

    return bollinger_pct_b


def calculate_adx(df: pd.DataFrame, period=14) -> pd.Series:
    """Calculate Average Directional Index"""
    # Calculate +DM and -DM
    high_diff = df['high'].diff()
    low_diff = -df['low'].diff()

    plus_dm = np.where((high_diff > low_diff) & (high_diff > 0), high_diff, 0)
    minus_dm = np.where((low_diff > high_diff) & (low_diff > 0), low_diff, 0)

    # Calculate ATR
    atr = calculate_atr(df, period)

    # Calculate +DI and -DI
    plus_di = 100 * pd.Series(plus_dm).rolling(window=period, min_periods=period).mean() / atr
    minus_di = 100 * pd.Series(minus_dm).rolling(window=period, min_periods=period).mean() / atr

    # Calculate DX
    dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di)

    # Calculate ADX (smoothed DX)
    adx = dx.rolling(window=period, min_periods=period).mean()

    return adx


def calculate_price_roc(df: pd.DataFrame, period: int) -> pd.Series:
    """Calculate Price Rate of Change"""
    roc = ((df['close'] - df['close'].shift(period)) / df['close'].shift(period)) * 100
    return roc


def calculate_volume_roc(df: pd.DataFrame, period: int) -> pd.Series:
    """Calculate Volume Rate of Change"""
    roc = ((df['volume'] - df['volume'].shift(period)) / df['volume'].shift(period)) * 100
    return roc


def calculate_volume_ma_ratio(df: pd.DataFrame, period: int) -> pd.Series:
    """Calculate Volume / Volume Moving Average Ratio"""
    volume_ma = df['volume'].rolling(window=period, min_periods=period).mean()
    ratio = df['volume'] / volume_ma
    return ratio


# === Main Processing ===

def load_polygon_data() -> pd.DataFrame:
    """Load all Polygon day_aggs data"""
    print("📊 Loading Polygon price data...")

    all_files = sorted(glob.glob(str(POLYGON_DATA_DIR / "*.csv.gz")))
    print(f"   Found {len(all_files)} daily files")

    dfs = []
    for i, file in enumerate(all_files):
        if i % 50 == 0:
            print(f"   Processing file {i+1}/{len(all_files)}...")

        try:
            df = pd.read_csv(gzip.open(file))
            # Extract date from filename (e.g., "2023-01-03.csv.gz")
            date_str = Path(file).stem  # Remove .csv.gz
            df['date'] = date_str
            dfs.append(df)
        except Exception as e:
            print(f"   ⚠️  Error reading {file}: {e}")
            continue

    combined_df = pd.concat(dfs, ignore_index=True)
    print(f"   ✅ Loaded {len(combined_df):,} rows across {combined_df['ticker'].nunique():,} symbols")

    # Rename ticker to symbol for consistency
    combined_df.rename(columns={'ticker': 'symbol'}, inplace=True)

    # Sort by symbol and date
    combined_df.sort_values(['symbol', 'date'], inplace=True)

    return combined_df


def extract_features_for_symbol(symbol_df: pd.DataFrame) -> pd.DataFrame:
    """Extract all volatility features for a single symbol"""
    df = symbol_df.copy()
    df = df.sort_values('date').reset_index(drop=True)

    # Skip if insufficient data (need at least 90 days for 50-period ATR)
    if len(df) < 90:
        return None

    # === Volatility History (7 features) ===
    for period in ATR_PERIODS:
        df[f'atr_{period}'] = calculate_atr(df, period)

    for period in REALIZED_VOL_PERIODS:
        df[f'realized_vol_{period}d'] = calculate_realized_volatility(df, period)

    df['parkinson_volatility'] = calculate_parkinson_volatility(df, period=20)

    # === Price Action (7 features) ===
    df['close_price'] = df['close']  # Keep raw close
    df['high_low_range'] = df['high'] - df['low']
    df['rsi_14'] = calculate_rsi(df, RSI_PERIOD)

    macd, macd_signal = calculate_macd(df, MACD_FAST, MACD_SLOW, MACD_SIGNAL)
    df['macd'] = macd
    df['macd_signal'] = macd_signal

    df['bollinger_pct_b'] = calculate_bollinger_bands(df, BOLLINGER_PERIOD, BOLLINGER_STD)
    df['adx'] = calculate_adx(df, ADX_PERIOD)
    df['price_roc_21'] = calculate_price_roc(df, PRICE_ROC_PERIOD)

    # === Volume (3 features) ===
    df['volume_roc'] = calculate_volume_roc(df, PRICE_ROC_PERIOD)
    df['volume_ma_ratio'] = calculate_volume_ma_ratio(df, VOLUME_MA_PERIOD)

    # Keep only essential columns
    feature_cols = [
        'symbol', 'date',
        # Volatility history
        'atr_14', 'atr_21', 'atr_50',
        'realized_vol_7d', 'realized_vol_14d', 'realized_vol_21d', 'realized_vol_30d',
        'parkinson_volatility',
        # Price action
        'close_price', 'high_low_range', 'rsi_14', 'macd', 'macd_signal',
        'bollinger_pct_b', 'adx', 'price_roc_21',
        # Volume
        'volume', 'volume_roc', 'volume_ma_ratio'
    ]

    result_df = df[feature_cols].copy()

    # Drop rows with NaN (due to rolling windows at the start)
    result_df.dropna(inplace=True)

    return result_df


def main():
    """Main execution"""
    start_time = datetime.now()

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load data
    price_data = load_polygon_data()

    # Process each symbol
    print("\n🔧 Extracting features for each symbol...")
    symbols = price_data['symbol'].unique()
    print(f"   Total symbols to process: {len(symbols):,}")

    feature_dfs = []
    failed_symbols = []

    for i, symbol in enumerate(symbols):
        if i % 100 == 0:
            print(f"   Progress: {i}/{len(symbols)} symbols ({i/len(symbols)*100:.1f}%)")

        try:
            symbol_data = price_data[price_data['symbol'] == symbol]
            features = extract_features_for_symbol(symbol_data)

            if features is not None:
                feature_dfs.append(features)
        except Exception as e:
            failed_symbols.append((symbol, str(e)))
            if len(failed_symbols) <= 10:  # Only print first 10 failures
                print(f"   ⚠️  Failed to process {symbol}: {e}")

    # Combine all features
    print("\n📦 Combining all features...")
    final_df = pd.concat(feature_dfs, ignore_index=True)

    print(f"   ✅ Extracted features for {len(final_df):,} rows across {final_df['symbol'].nunique():,} symbols")
    print(f"   ⚠️  Failed symbols: {len(failed_symbols)}")

    # Save to parquet
    print(f"\n💾 Saving to {OUTPUT_FILE}...")
    table = pa.Table.from_pandas(final_df)
    pq.write_table(table, OUTPUT_FILE, compression='snappy')

    # Print summary statistics
    print("\n📊 Summary Statistics:")
    print(f"   Date range: {final_df['date'].min()} to {final_df['date'].max()}")
    print(f"   Symbols: {final_df['symbol'].nunique():,}")
    print(f"   Total rows: {len(final_df):,}")
    print(f"   Features per row: {len(final_df.columns) - 2}")  # Exclude symbol, date
    print(f"   File size: {OUTPUT_FILE.stat().st_size / 1024 / 1024:.2f} MB")

    # Print sample
    print("\n📋 Sample Features (first symbol):")
    sample = final_df[final_df['symbol'] == final_df['symbol'].iloc[0]].tail(3)
    print(sample.to_string(max_cols=10))

    elapsed = datetime.now() - start_time
    print(f"\n✅ Feature extraction completed in {elapsed.total_seconds():.1f}s")


if __name__ == "__main__":
    main()
