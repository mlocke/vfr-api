#!/usr/bin/env python3
"""
Extract Smart Money Flow Features from EODHD Options Data
Calculates unusual options activity, positioning metrics, and smart money signals
"""

import pandas as pd
import numpy as np
from pathlib import Path
import json
import warnings
warnings.filterwarnings('ignore')

# Directories
OPTIONS_DIR = Path('data/eodhd_options')
OUTPUT_FILE = Path('data/training/smart-money-flow-lean/options_features.csv')

def load_options_data(ticker: str) -> pd.DataFrame:
    """Load options data for a given ticker"""
    csv_files = list(OPTIONS_DIR.glob(f'{ticker}_*.csv'))
    if not csv_files:
        return None

    # Use most recent file
    csv_file = sorted(csv_files)[-1]
    df = pd.read_csv(csv_file)
    return df

def calculate_options_features(df: pd.DataFrame, ticker: str) -> dict:
    """Calculate smart money options features from options chain data"""

    if df is None or len(df) == 0:
        return None

    features = {}

    try:
        # Separate calls and puts
        calls = df[df['type'] == 'call'].copy()
        puts = df[df['type'] == 'put'].copy()

        # === Volume & Open Interest Metrics ===
        total_call_volume = calls['volume'].fillna(0).sum()
        total_put_volume = puts['volume'].fillna(0).sum()
        total_call_oi = calls['open_interest'].fillna(0).sum()
        total_put_oi = puts['open_interest'].fillna(0).sum()

        # Put/Call Ratios
        features['put_call_volume_ratio'] = total_put_volume / total_call_volume if total_call_volume > 0 else 1.0
        features['put_call_oi_ratio'] = total_put_oi / total_call_oi if total_call_oi > 0 else 1.0

        # === Unusual Activity Detection ===
        # Large blocks (>100 contracts threshold)
        large_call_volume = calls[calls['volume'] > 100]['volume'].fillna(0).sum()
        large_put_volume = puts[puts['volume'] > 100]['volume'].fillna(0).sum()

        features['large_block_call_pct'] = large_call_volume / total_call_volume if total_call_volume > 0 else 0.0
        features['large_block_put_pct'] = large_put_volume / total_put_volume if total_put_volume > 0 else 0.0

        # Premium paid above midpoint (smart money willing to pay up)
        calls['premium_above_mid'] = ((calls['last'] - calls['midpoint']) / calls['midpoint']).fillna(0)
        puts['premium_above_mid'] = ((puts['last'] - puts['midpoint']) / puts['midpoint']).fillna(0)

        features['avg_call_premium_above_mid'] = calls[calls['volume'] > 0]['premium_above_mid'].mean()
        features['avg_put_premium_above_mid'] = puts[puts['volume'] > 0]['premium_above_mid'].mean()

        # === Positioning Metrics ===
        # OI skew (call bias vs put bias)
        features['oi_skew_call_put'] = (total_call_oi - total_put_oi) / (total_call_oi + total_put_oi) if (total_call_oi + total_put_oi) > 0 else 0.0

        # Near-the-money concentration (within 5% of current price)
        # Estimate current price from ATM options
        atm_price = calls['strike'].median()  # Rough estimate
        near_money_range = (atm_price * 0.95, atm_price * 1.05)

        near_money_calls = calls[(calls['strike'] >= near_money_range[0]) & (calls['strike'] <= near_money_range[1])]
        near_money_call_oi = near_money_calls['open_interest'].fillna(0).sum()
        features['near_money_call_concentration'] = near_money_call_oi / total_call_oi if total_call_oi > 0 else 0.0

        # Far OTM call activity (>20% OTM) - lottery tickets or insider info
        far_otm_calls = calls[calls['strike'] > atm_price * 1.2]
        far_otm_call_volume = far_otm_calls['volume'].fillna(0).sum()
        features['far_otm_call_activity'] = far_otm_call_volume / total_call_volume if total_call_volume > 0 else 0.0

        # Protective put buildup (ATM/OTM puts)
        protective_puts = puts[puts['strike'] <= atm_price]
        protective_put_oi = protective_puts['open_interest'].fillna(0).sum()
        features['protective_put_ratio'] = protective_put_oi / total_put_oi if total_put_oi > 0 else 0.0

        # === Greeks Analysis (Smart Money Signals) ===
        # High delta call volume (delta > 0.7 = stock replacement)
        high_delta_calls = calls[calls['delta'].abs() > 0.7]
        high_delta_call_volume = high_delta_calls['volume'].fillna(0).sum()
        features['high_delta_call_volume_pct'] = high_delta_call_volume / total_call_volume if total_call_volume > 0 else 0.0

        # Long-dated options (>90 DTE = conviction)
        long_dated_calls = calls[calls['dte'] > 90]
        long_dated_call_volume = long_dated_calls['volume'].fillna(0).sum()
        features['long_dated_call_ratio'] = long_dated_call_volume / total_call_volume if total_call_volume > 0 else 0.0

        # Net gamma exposure (absolute value)
        total_gamma = calls['gamma'].fillna(0).sum() - puts['gamma'].fillna(0).sum()
        features['net_gamma_exposure'] = abs(total_gamma)

        # === Volatility Signals ===
        # IV rank approximation (current vs range in data)
        all_iv = pd.concat([calls['volatility'], puts['volatility']]).dropna()
        if len(all_iv) > 0:
            current_iv = all_iv.median()
            iv_min = all_iv.min()
            iv_max = all_iv.max()
            features['iv_rank_percentile'] = (current_iv - iv_min) / (iv_max - iv_min) if (iv_max - iv_min) > 0 else 0.5
        else:
            features['iv_rank_percentile'] = 0.5

        # IV skew (put IV vs call IV at 25 delta)
        call_25delta = calls[calls['delta'].abs().between(0.2, 0.3)]
        put_25delta = puts[puts['delta'].abs().between(0.2, 0.3)]

        if len(call_25delta) > 0 and len(put_25delta) > 0:
            features['iv_skew_25delta'] = put_25delta['volatility'].mean() - call_25delta['volatility'].mean()
        else:
            features['iv_skew_25delta'] = 0.0

        # === Volume/OI Ratio (Unusual activity indicator) ===
        # High volume relative to OI = new positions being opened
        calls['vol_oi_ratio'] = calls['volume'] / calls['open_interest'].replace(0, np.nan)
        puts['vol_oi_ratio'] = puts['volume'] / puts['open_interest'].replace(0, np.nan)

        features['avg_call_vol_oi_ratio'] = calls['vol_oi_ratio'].median()
        features['avg_put_vol_oi_ratio'] = puts['vol_oi_ratio'].median()

        # Fill NaN/inf values with 0
        for key in features:
            if pd.isna(features[key]) or np.isinf(features[key]):
                features[key] = 0.0

        return features

    except Exception as e:
        print(f"   ⚠️  Error calculating features for {ticker}: {e}")
        return None

def main():
    """Main extraction pipeline"""
    print("=" * 70)
    print("📊 EXTRACTING OPTIONS FEATURES FROM EODHD DATA")
    print("=" * 70)
    print()

    # Get all ticker CSV files
    csv_files = sorted(OPTIONS_DIR.glob('*.csv'))
    csv_files = [f for f in csv_files if not f.name.startswith(('nightly', 'progress'))]

    print(f"📂 Found {len(csv_files)} options files in {OPTIONS_DIR}")
    print()

    all_features = []

    for csv_file in csv_files:
        ticker = csv_file.stem.split('_')[0]  # Extract ticker from filename
        print(f"⚙️  Processing {ticker}...", end=' ')

        df = load_options_data(ticker)
        if df is None:
            print("❌ No data")
            continue

        features = calculate_options_features(df, ticker)
        if features is None:
            print("❌ Failed")
            continue

        features['symbol'] = ticker
        all_features.append(features)
        print(f"✅ ({len(df):,} contracts)")

    print()
    print(f"✅ Successfully extracted features for {len(all_features)} tickers")
    print()

    # Create DataFrame
    features_df = pd.DataFrame(all_features)

    # Reorder columns (symbol first, then features)
    cols = ['symbol'] + [col for col in features_df.columns if col != 'symbol']
    features_df = features_df[cols]

    # Save to CSV
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    features_df.to_csv(OUTPUT_FILE, index=False)
    print(f"💾 Saved options features to: {OUTPUT_FILE}")
    print(f"   - Tickers: {len(features_df)}")
    print(f"   - Features per ticker: {len(features_df.columns) - 1}")
    print()

    # Display summary statistics
    print("📈 Feature Summary Statistics:")
    print()
    print(features_df.describe().round(4).to_string())
    print()

    print("=" * 70)
    print("✅ OPTIONS FEATURE EXTRACTION COMPLETE")
    print("=" * 70)
    print()
    print(f"Next step: Run merge script to combine with training data")
    print()

if __name__ == '__main__':
    main()
