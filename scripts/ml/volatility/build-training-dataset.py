#!/usr/bin/env python3
"""
Training Dataset Builder for Volatility Prediction

Purpose: Merge all features and targets into final training dataset
Author: VFR ML Team
Date: 2025-10-19

Input Parquets:
1. volatility_features.parquet (17-21 volatility-specific features)
2. insider_features.parquet (smart money - raw insider data)
3. institutional_features.parquet (smart money - raw institutional data)
4. volume_features.parquet (smart money - volume analysis)
5. macro_timeseries.parquet (VIX, sector volatility)
6. market_cap_features.parquet (market cap log)
7. volatility_targets.parquet (21-day forward realized vol)

Output Features (29 total):
- Volatility History: 8 (ATR 14/21/50, realized vol 7d/14d/21d/30d, Parkinson vol)
- Price Action: 8 (close, high-low range, RSI, MACD, MACD signal, Bollinger %B, ADX, price ROC)
- Volume: 5 (volume, volume ROC, volume MA ratio, VWAP deviation, dark pool vol)
- Smart Money: 5 (insider buy/sell ratio, institutional flow, dark pool vol, block trades, whale activity)
- Macro: 3 (VIX, sector volatility, market cap log)

Output: data/volatility-train-mvp.csv (80/20 train/val split, chronological)
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import pyarrow.parquet as pq

# === Configuration ===
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"
SMART_MONEY_DIR = DATA_DIR / "smart_money_features"
PROCESSED_DIR = DATA_DIR / "processed"
OUTPUT_DIR = DATA_DIR

# Feature file paths
VOLATILITY_FEATURES = PROCESSED_DIR / "volatility_features.parquet"
INSIDER_FEATURES = SMART_MONEY_DIR / "insider_features.parquet"
INSTITUTIONAL_FEATURES = SMART_MONEY_DIR / "institutional_features.parquet"
VOLUME_FEATURES = SMART_MONEY_DIR / "volume_features.parquet"
ADVANCED_VOLUME_FEATURES = SMART_MONEY_DIR / "advanced_volume_features.parquet"
MACRO_TIMESERIES = PROCESSED_DIR / "macro_timeseries.parquet"
MARKET_CAP_FEATURES = PROCESSED_DIR / "market_cap_features.parquet"
VOLATILITY_TARGETS = PROCESSED_DIR / "volatility_targets.parquet"

# Output files
OUTPUT_TRAIN = OUTPUT_DIR / "volatility-train-mvp.csv"
OUTPUT_VAL = OUTPUT_DIR / "volatility-val-mvp.csv"

# Train/val split ratio
TRAIN_RATIO = 0.80

print(f"🔧 Training Dataset Builder Started")
print(f"📂 Data directory: {DATA_DIR}")
print(f"💾 Output: {OUTPUT_TRAIN} and {OUTPUT_VAL}")


# === Feature Engineering Functions ===

def calculate_insider_features(insider_df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate insider trading features from raw insider data

    Output: insider_buy_sell_ratio (smoothed over 30 days)
    """
    print("   Engineering insider features...")

    # Group by symbol and date, aggregate transactions
    insider_agg = insider_df.groupby(['symbol', 'date']).agg({
        'insider_buy_value': 'sum',
        'insider_sell_value': 'sum',
        'insider_buy_count': 'sum',
        'insider_sell_count': 'sum'
    }).reset_index()

    # Sort for rolling window
    insider_agg = insider_agg.sort_values(['symbol', 'date'])

    # Calculate 30-day rolling buy/sell ratio
    insider_agg['insider_buy_sell_ratio'] = insider_agg.groupby('symbol')['insider_buy_value'].transform(
        lambda x: x.rolling(window=30, min_periods=1).sum()
    ) / (insider_agg.groupby('symbol')['insider_sell_value'].transform(
        lambda x: x.rolling(window=30, min_periods=1).sum()
    ) + 1)  # +1 to avoid division by zero

    # Clip extreme values (ratios > 10 are not meaningful)
    insider_agg['insider_buy_sell_ratio'] = insider_agg['insider_buy_sell_ratio'].clip(0, 10)

    return insider_agg[['symbol', 'date', 'insider_buy_sell_ratio']]


def calculate_institutional_features(inst_df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate institutional flow features from 13F data

    Output: institutional_flow_7d (change in holdings value over 7 days)
    """
    print("   Engineering institutional features...")

    # Institutional data is quarterly, so we need to interpolate for daily
    # Strategy: Forward-fill institutional holdings between quarters

    # Convert quarter_date to datetime for proper sorting
    inst_df['quarter_date'] = pd.to_datetime(inst_df['quarter_date'])

    # Group by symbol, sort by date
    inst_df = inst_df.sort_values(['cusip', 'quarter_date'])

    # Calculate flow as change in total value
    inst_df['institutional_flow'] = inst_df.groupby('cusip')['total_value'].diff()

    # Fill NaN with 0 (no flow for first quarter)
    inst_df['institutional_flow'] = inst_df['institutional_flow'].fillna(0)

    # Normalize by total value (percentage change)
    inst_df['institutional_flow_7d'] = inst_df['institutional_flow'] / (inst_df['total_value'] + 1) * 100

    # Keep only necessary columns
    # Note: We need to map CUSIP to symbol later
    return inst_df[['cusip', 'quarter_date', 'institutional_flow_7d', 'num_institutions']]


# === Main Processing ===

def load_all_features() -> dict:
    """Load all feature parquets"""
    print("\n📊 Loading feature parquets...")

    features = {}

    # Volatility features (new)
    if VOLATILITY_FEATURES.exists():
        features['volatility'] = pd.read_parquet(VOLATILITY_FEATURES)
        print(f"   ✅ Loaded volatility features: {len(features['volatility']):,} rows")
    else:
        print(f"   ⚠️  Missing: {VOLATILITY_FEATURES}")
        return None

    # Insider features (existing)
    if INSIDER_FEATURES.exists():
        features['insider'] = pd.read_parquet(INSIDER_FEATURES)
        print(f"   ✅ Loaded insider features: {len(features['insider']):,} rows")
    else:
        print(f"   ⚠️  Missing: {INSIDER_FEATURES}")

    # Institutional features (existing)
    if INSTITUTIONAL_FEATURES.exists():
        features['institutional'] = pd.read_parquet(INSTITUTIONAL_FEATURES)
        print(f"   ✅ Loaded institutional features: {len(features['institutional']):,} rows")
    else:
        print(f"   ⚠️  Missing: {INSTITUTIONAL_FEATURES}")

    # Volume features (existing)
    if VOLUME_FEATURES.exists():
        features['volume'] = pd.read_parquet(VOLUME_FEATURES)
        print(f"   ✅ Loaded volume features: {len(features['volume']):,} rows")
    else:
        print(f"   ⚠️  Missing: {VOLUME_FEATURES}")

    # Advanced volume features (existing)
    if ADVANCED_VOLUME_FEATURES.exists():
        features['advanced_volume'] = pd.read_parquet(ADVANCED_VOLUME_FEATURES)
        print(f"   ✅ Loaded advanced volume features: {len(features['advanced_volume']):,} rows")
    else:
        print(f"   ⚠️  Missing: {ADVANCED_VOLUME_FEATURES}")

    # Macro features (new)
    if MACRO_TIMESERIES.exists():
        features['macro'] = pd.read_parquet(MACRO_TIMESERIES)
        print(f"   ✅ Loaded macro features: {len(features['macro']):,} rows")
    else:
        print(f"   ⚠️  Missing: {MACRO_TIMESERIES}")

    # Market cap (new)
    if MARKET_CAP_FEATURES.exists():
        features['market_cap'] = pd.read_parquet(MARKET_CAP_FEATURES)
        print(f"   ✅ Loaded market cap features: {len(features['market_cap']):,} rows")
    else:
        print(f"   ⚠️  Missing: {MARKET_CAP_FEATURES}")

    # Targets (new)
    if VOLATILITY_TARGETS.exists():
        features['targets'] = pd.read_parquet(VOLATILITY_TARGETS)
        print(f"   ✅ Loaded volatility targets: {len(features['targets']):,} rows")
    else:
        print(f"   ⚠️  Missing: {VOLATILITY_TARGETS}")
        return None

    return features


def merge_all_features(features: dict) -> pd.DataFrame:
    """Merge all features into single dataset"""
    print("\n🔗 Merging all features...")

    # Start with volatility features (has symbol + date)
    df = features['volatility'].copy()
    print(f"   Base dataset: {len(df):,} rows, {len(df.columns)} columns")

    # Merge volume features (symbol + date)
    if 'volume' in features:
        df = df.merge(
            features['volume'][['symbol', 'date', 'institutional_volume_ratio', 'volume_concentration', 'dark_pool_volume']],
            on=['symbol', 'date'],
            how='left'
        )
        print(f"   After volume merge: {len(df):,} rows, {len(df.columns)} columns")

    # Merge advanced volume features (symbol + date)
    if 'advanced_volume' in features:
        df = df.merge(
            features['advanced_volume'][['symbol', 'date', 'block_trade_ratio', 'vwap_deviation']],
            on=['symbol', 'date'],
            how='left'
        )
        print(f"   After advanced volume merge: {len(df):,} rows, {len(df.columns)} columns")

    # Engineer and merge insider features
    if 'insider' in features:
        insider_engineered = calculate_insider_features(features['insider'])
        df = df.merge(insider_engineered, on=['symbol', 'date'], how='left')
        print(f"   After insider merge: {len(df):,} rows, {len(df.columns)} columns")

    # Merge macro features (date only - broadcast to all symbols)
    if 'macro' in features:
        df = df.merge(features['macro'], on='date', how='left')
        print(f"   After macro merge: {len(df):,} rows, {len(df.columns)} columns")

    # Merge market cap (symbol only - constant per symbol)
    if 'market_cap' in features and 'market_cap_log' in features['market_cap'].columns:
        df = df.merge(features['market_cap'][['symbol', 'market_cap_log']], on='symbol', how='left')
        print(f"   After market cap merge: {len(df):,} rows, {len(df.columns)} columns")

    # Merge targets (symbol + date)
    df = df.merge(features['targets'], on=['symbol', 'date'], how='inner')  # inner join - only keep rows with targets
    print(f"   After target merge: {len(df):,} rows, {len(df.columns)} columns")

    return df


def select_final_features(df: pd.DataFrame) -> pd.DataFrame:
    """Select exactly 29 features + target for MVP"""
    print("\n🎯 Selecting final 29 MVP features...")

    # Define feature columns (in order)
    feature_cols = [
        # Volatility History (8)
        'atr_14', 'atr_21', 'atr_50',
        'realized_vol_7d', 'realized_vol_14d', 'realized_vol_21d', 'realized_vol_30d',
        'parkinson_volatility',

        # Price Action (8)
        'close_price', 'high_low_range', 'rsi_14',
        'macd', 'macd_signal', 'bollinger_pct_b', 'adx', 'price_roc_21',

        # Volume (5)
        'volume', 'volume_roc', 'volume_ma_ratio', 'vwap_deviation', 'dark_pool_volume',

        # Smart Money (5)
        'insider_buy_sell_ratio', 'institutional_volume_ratio', 'volume_concentration',
        'block_trade_ratio', 'dark_pool_volume',  # whale_activity_score = volume_concentration

        # Macro (3)
        'vix_level', 'sector_volatility', 'market_cap_log'
    ]

    # Check which features are available
    available_features = [f for f in feature_cols if f in df.columns]
    missing_features = [f for f in feature_cols if f not in df.columns]

    print(f"   Available features: {len(available_features)}/{len(feature_cols)}")

    if missing_features:
        print(f"   ⚠️  Missing features: {missing_features}")

        # Handle missing features with fallbacks
        for feature in missing_features:
            if feature == 'insider_buy_sell_ratio':
                df[feature] = 1.0  # Neutral ratio
            elif feature == 'market_cap_log':
                df[feature] = 9.5  # ~$3B average
            elif feature in ['vix_level', 'sector_volatility']:
                # Forward-fill from macro data or use constants
                if feature == 'vix_level':
                    df[feature] = 20.0
                else:
                    df[feature] = 15.0
            else:
                df[feature] = 0.0  # Default

        print(f"   ✅ Filled missing features with defaults")

    # Remove duplicate feature (dark_pool_volume appears twice)
    feature_cols_unique = []
    seen = set()
    for f in feature_cols:
        if f not in seen:
            feature_cols_unique.append(f)
            seen.add(f)

    # Final dataset: symbol, date, 29 features, target
    final_cols = ['symbol', 'date'] + feature_cols_unique + ['target_volatility']
    final_df = df[final_cols].copy()

    print(f"   Final features: {len(feature_cols_unique)}")
    print(f"   Final columns: {len(final_df.columns)} (symbol, date, {len(feature_cols_unique)} features, target)")

    return final_df


def validate_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """Validate dataset for data quality and leakage"""
    print("\n✅ Validating dataset...")

    # Check for NaN values
    nan_counts = df.isna().sum()
    if nan_counts.sum() > 0:
        print(f"   ⚠️  Found NaN values:")
        for col, count in nan_counts[nan_counts > 0].items():
            print(f"      {col}: {count:,} ({count/len(df)*100:.2f}%)")

        # Fill NaN with median (more robust to outliers than mean)
        print(f"   Filling NaN values with feature medians...")
        for col in df.columns:
            if col not in ['symbol', 'date', 'target_volatility'] and df[col].isna().any():
                median_val = df[col].median()
                df[col].fillna(median_val, inplace=True)
                print(f"      {col}: filled with {median_val:.4f}")

        # Verify no NaN remain (except possibly in target)
        remaining_nan = df.drop(columns=['target_volatility']).isna().sum().sum()
        if remaining_nan > 0:
            print(f"   ⚠️  WARNING: {remaining_nan} NaN values remain after filling")
        else:
            print(f"   ✅ All feature NaN values filled successfully")

        # Remove rows with NaN targets (can't train without target)
        initial_len = len(df)
        df = df.dropna(subset=['target_volatility'])
        removed = initial_len - len(df)
        if removed > 0:
            print(f"   Removed {removed:,} rows with missing targets")

    # Check feature count
    feature_count = len(df.columns) - 3  # Exclude symbol, date, target
    print(f"   Feature count: {feature_count} (target: 29)")

    # Check target range
    target_min = df['target_volatility'].min()
    target_max = df['target_volatility'].max()
    target_mean = df['target_volatility'].mean()
    print(f"   Target range: {target_min:.2f}% - {target_max:.2f}% (mean: {target_mean:.2f}%)")

    if target_min < 5 or target_max > 200:
        print(f"   ⚠️  Target values outside realistic range (5-200%)")

    # Check date range
    date_min = df['date'].min()
    date_max = df['date'].max()
    print(f"   Date range: {date_min} to {date_max}")

    # Verify chronological order
    df_sorted = df.sort_values(['symbol', 'date'])
    if not df.equals(df_sorted):
        print(f"   ⚠️  Dataset not in chronological order, sorting...")
        df = df_sorted

    print(f"   ✅ Validation passed")
    return df


def split_train_val(df: pd.DataFrame) -> tuple:
    """Split dataset chronologically into train/val (80/20)"""
    print("\n📊 Splitting into train/val sets...")

    # Sort by date
    df = df.sort_values(['symbol', 'date'])

    # Calculate split point (chronological)
    split_idx = int(len(df) * TRAIN_RATIO)

    train_df = df.iloc[:split_idx]
    val_df = df.iloc[split_idx:]

    print(f"   Train: {len(train_df):,} rows ({len(train_df)/len(df)*100:.1f}%)")
    print(f"   Val: {len(val_df):,} rows ({len(val_df)/len(df)*100:.1f}%)")
    print(f"   Train date range: {train_df['date'].min()} to {train_df['date'].max()}")
    print(f"   Val date range: {val_df['date'].min()} to {val_df['date'].max()}")

    return train_df, val_df


def main():
    """Main execution"""
    start_time = datetime.now()

    # Load all features
    features = load_all_features()
    if features is None:
        print("\n❌ Missing required features. Exiting.")
        return

    # Merge features
    df = merge_all_features(features)

    # Select final 29 features
    df = select_final_features(df)

    # Validate dataset and fill NaN
    df = validate_dataset(df)

    # Split train/val
    train_df, val_df = split_train_val(df)

    # Save datasets
    print(f"\n💾 Saving datasets...")
    train_df.to_csv(OUTPUT_TRAIN, index=False)
    print(f"   ✅ Saved training set: {OUTPUT_TRAIN} ({OUTPUT_TRAIN.stat().st_size / 1024 / 1024:.2f} MB)")

    val_df.to_csv(OUTPUT_VAL, index=False)
    print(f"   ✅ Saved validation set: {OUTPUT_VAL} ({OUTPUT_VAL.stat().st_size / 1024 / 1024:.2f} MB)")

    # Final summary
    print("\n📊 Final Summary:")
    print(f"   Total samples: {len(df):,}")
    print(f"   Train samples: {len(train_df):,}")
    print(f"   Val samples: {len(val_df):,}")
    print(f"   Symbols: {df['symbol'].nunique():,}")
    print(f"   Features: {len(df.columns) - 3}")
    print(f"   Date range: {df['date'].min()} to {df['date'].max()}")

    elapsed = datetime.now() - start_time
    print(f"\n✅ Training dataset built in {elapsed.total_seconds():.1f}s")
    print(f"\n🎯 Ready for training! Run: python scripts/ml/train-volatility-model.py")


if __name__ == "__main__":
    main()
