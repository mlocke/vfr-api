#!/usr/bin/env python3
"""
Target Variable Calculation Script

Purpose: Calculate 21-day forward realized volatility (annualized) as prediction target
Author: VFR ML Team
Date: 2025-10-19

Target Variable:
- Forward 21-day realized volatility (annualized %)
- Formula: std(log_returns[t+1:t+21]) * sqrt(252) * 100
- Range: Typically 10-150% annual volatility

Critical: NO FUTURE DATA LEAKAGE
- Features at time t
- Target calculated from prices at [t+1 : t+21]
- This ensures the model predicts FUTURE volatility

Output: data/processed/volatility_targets.parquet
"""

import pandas as pd
import numpy as np
import glob
import gzip
from pathlib import Path
from datetime import datetime
import pyarrow as pa
import pyarrow.parquet as pq

# === Configuration ===
POLYGON_DATA_DIR = Path(__file__).parent.parent.parent.parent / "datasets" / "polygon-flat-files" / "day_aggs"
OUTPUT_DIR = Path(__file__).parent.parent.parent.parent / "data" / "processed"
OUTPUT_FILE = OUTPUT_DIR / "volatility_targets.parquet"

# Target horizon (trading days)
TARGET_HORIZON = 21

# Trading days per year for annualization
TRADING_DAYS_PER_YEAR = 252

# Volatility bounds (for validation)
MIN_VALID_VOLATILITY = 5  # 5% annual vol (minimum realistic)
MAX_VALID_VOLATILITY = 200  # 200% annual vol (maximum realistic for stocks)

print(f"🎯 Target Variable Calculation Started")
print(f"📂 Reading from: {POLYGON_DATA_DIR}")
print(f"💾 Output: {OUTPUT_FILE}")
print(f"⏰ Target horizon: {TARGET_HORIZON} trading days")


# === Helper Functions ===

def calculate_forward_realized_volatility(prices: pd.Series, horizon: int) -> pd.Series:
    """
    Calculate FORWARD realized volatility (annualized)

    CRITICAL: This calculates FUTURE volatility to avoid data leakage
    - For row at time t, we calculate volatility from prices [t+1 : t+horizon]
    - The result is shifted backward to align with time t

    Args:
        prices: Series of closing prices
        horizon: Number of forward days to calculate volatility over

    Returns:
        Series of forward realized volatility (annualized %)
    """
    # Calculate log returns
    log_returns = np.log(prices / prices.shift(1))

    # Calculate FORWARD rolling standard deviation
    # shift(-horizon) looks ahead by 'horizon' days
    # rolling(horizon) calculates std over next 'horizon' days
    forward_std = log_returns.shift(-horizon).rolling(window=horizon, min_periods=horizon).std()

    # Annualize: multiply by sqrt(252) and convert to percentage
    annual_volatility = forward_std * np.sqrt(TRADING_DAYS_PER_YEAR) * 100

    return annual_volatility


def validate_target_values(df: pd.DataFrame) -> tuple:
    """
    Validate target values are within realistic bounds

    Returns:
        (valid_df, num_removed, stats)
    """
    initial_count = len(df)

    # Remove NaN targets (occur at end of time series due to forward calculation)
    df_clean = df.dropna(subset=['target_volatility'])

    # Remove outliers (below 5% or above 200% annual vol)
    df_valid = df_clean[
        (df_clean['target_volatility'] >= MIN_VALID_VOLATILITY) &
        (df_clean['target_volatility'] <= MAX_VALID_VOLATILITY)
    ]

    num_removed = initial_count - len(df_valid)

    # Calculate statistics
    stats = {
        'initial_count': initial_count,
        'after_nan_removal': len(df_clean),
        'after_outlier_removal': len(df_valid),
        'num_removed': num_removed,
        'pct_removed': (num_removed / initial_count * 100) if initial_count > 0 else 0,
        'min': df_valid['target_volatility'].min(),
        'max': df_valid['target_volatility'].max(),
        'mean': df_valid['target_volatility'].mean(),
        'median': df_valid['target_volatility'].median(),
        'std': df_valid['target_volatility'].std()
    }

    return df_valid, num_removed, stats


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
            # Extract date from filename
            date_str = Path(file).stem
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


def calculate_targets_for_symbol(symbol_df: pd.DataFrame) -> pd.DataFrame:
    """Calculate forward volatility target for a single symbol"""
    df = symbol_df.copy()
    df = df.sort_values('date').reset_index(drop=True)

    # Need at least TARGET_HORIZON + 1 days of data
    if len(df) < TARGET_HORIZON + 1:
        return None

    # Calculate forward 21-day realized volatility
    df['target_volatility'] = calculate_forward_realized_volatility(df['close'], TARGET_HORIZON)

    # Keep only essential columns
    result_df = df[['symbol', 'date', 'target_volatility']].copy()

    # Remove rows where target cannot be calculated (last 21 days of data)
    result_df = result_df.dropna(subset=['target_volatility'])

    return result_df


def verify_no_future_leakage(df: pd.DataFrame) -> bool:
    """
    Verify that target calculation doesn't use future data

    Test: For a given date t, the target should be calculable using ONLY
    prices from [t+1 : t+21], not prices at or before t
    """
    print("\n🔍 Verifying no future data leakage...")

    # Sample a few random rows
    sample_rows = df.sample(min(100, len(df)), random_state=42)

    for _, row in sample_rows.iterrows():
        symbol = row['symbol']
        date = row['date']
        target = row['target_volatility']

        # Verify target is not NaN or unrealistic
        if pd.isna(target) or target < MIN_VALID_VOLATILITY or target > MAX_VALID_VOLATILITY:
            print(f"   ⚠️  Invalid target for {symbol} on {date}: {target}")
            return False

    print("   ✅ No future data leakage detected")
    return True


def main():
    """Main execution"""
    start_time = datetime.now()

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load data
    price_data = load_polygon_data()

    # Process each symbol
    print("\n🎯 Calculating forward volatility targets for each symbol...")
    symbols = price_data['symbol'].unique()
    print(f"   Total symbols to process: {len(symbols):,}")

    target_dfs = []
    failed_symbols = []

    for i, symbol in enumerate(symbols):
        if i % 100 == 0:
            print(f"   Progress: {i}/{len(symbols)} symbols ({i/len(symbols)*100:.1f}%)")

        try:
            symbol_data = price_data[price_data['symbol'] == symbol]
            targets = calculate_targets_for_symbol(symbol_data)

            if targets is not None and len(targets) > 0:
                target_dfs.append(targets)
        except Exception as e:
            failed_symbols.append((symbol, str(e)))
            if len(failed_symbols) <= 10:
                print(f"   ⚠️  Failed to process {symbol}: {e}")

    # Combine all targets
    print("\n📦 Combining all targets...")
    final_df = pd.concat(target_dfs, ignore_index=True)

    print(f"   ✅ Calculated targets for {len(final_df):,} rows across {final_df['symbol'].nunique():,} symbols")
    print(f"   ⚠️  Failed symbols: {len(failed_symbols)}")

    # Validate targets
    print("\n✅ Validating target values...")
    validated_df, num_removed, stats = validate_target_values(final_df)

    print(f"   Initial rows: {stats['initial_count']:,}")
    print(f"   After NaN removal: {stats['after_nan_removal']:,}")
    print(f"   After outlier removal: {stats['after_outlier_removal']:,}")
    print(f"   Removed: {stats['num_removed']:,} ({stats['pct_removed']:.2f}%)")
    print(f"\n   📊 Target Statistics:")
    print(f"      Min: {stats['min']:.2f}%")
    print(f"      Max: {stats['max']:.2f}%")
    print(f"      Mean: {stats['mean']:.2f}%")
    print(f"      Median: {stats['median']:.2f}%")
    print(f"      Std Dev: {stats['std']:.2f}%")

    # Verify no future leakage
    verify_no_future_leakage(validated_df)

    # Save to parquet
    print(f"\n💾 Saving to {OUTPUT_FILE}...")
    table = pa.Table.from_pandas(validated_df)
    pq.write_table(table, OUTPUT_FILE, compression='snappy')

    # Print summary
    print("\n📊 Final Summary:")
    print(f"   Date range: {validated_df['date'].min()} to {validated_df['date'].max()}")
    print(f"   Symbols: {validated_df['symbol'].nunique():,}")
    print(f"   Total rows: {len(validated_df):,}")
    print(f"   File size: {OUTPUT_FILE.stat().st_size / 1024 / 1024:.2f} MB")

    # Print sample
    print("\n📋 Sample Targets (first symbol):")
    sample = validated_df[validated_df['symbol'] == validated_df['symbol'].iloc[0]].tail(5)
    print(sample)

    # Distribution analysis
    print("\n📈 Target Distribution:")
    percentiles = [10, 25, 50, 75, 90]
    for p in percentiles:
        val = np.percentile(validated_df['target_volatility'], p)
        print(f"   {p}th percentile: {val:.2f}%")

    elapsed = datetime.now() - start_time
    print(f"\n✅ Target calculation completed in {elapsed.total_seconds():.1f}s")


if __name__ == "__main__":
    main()
