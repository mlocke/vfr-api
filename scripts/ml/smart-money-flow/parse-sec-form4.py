#!/usr/bin/env python3
"""
SEC Form 4 Parser - Insider Transactions

Purpose: Parse SEC Form 4 (insider trading) datasets into smart money features
Input: datasets/SEC/insider-transactions/*.zip
Output: Parquet files with insider features

Pattern: Follows the plan in docs/prebuilt-dataset-parquet/complete-doc.md
"""

import zipfile
import pandas as pd
import pyarrow.parquet as pq
import pyarrow as pa
from pathlib import Path
from typing import Dict, List
import sys

# Transaction codes that indicate buying
BUY_CODES = ['P', 'A', 'M', 'J', 'L']

# Transaction codes that indicate selling
SELL_CODES = ['S', 'D']

# All meaningful transaction codes
MEANINGFUL_CODES = BUY_CODES + SELL_CODES


def load_form4_tables(zip_path: str) -> Dict[str, pd.DataFrame]:
    """Load all TSV tables from a Form 4 ZIP file."""
    tables = {}

    print(f"📂 Loading {Path(zip_path).name}...")

    with zipfile.ZipFile(zip_path, 'r') as z:
        for fname in z.namelist():
            if fname.endswith('.tsv'):
                table_name = fname.replace('.tsv', '')

                try:
                    # Read TSV with proper date parsing
                    df = pd.read_csv(
                        z.open(fname),
                        sep='\t',
                        low_memory=False,
                        na_values=['', 'NA', 'N/A']
                    )

                    # Parse date columns
                    date_columns = ['FILING_DATE', 'PERIOD_OF_REPORT', 'TRANS_DATE']
                    for col in date_columns:
                        if col in df.columns:
                            df[col] = pd.to_datetime(df[col], format='%d-%b-%Y', errors='coerce')

                    tables[table_name] = df
                    print(f"  ✅ Loaded {table_name}: {len(df):,} rows")

                except Exception as e:
                    print(f"  ❌ Failed to load {table_name}: {e}")
                    continue

    return tables


def build_insider_features(tables: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Build insider trading features from Form 4 tables.

    Joins SUBMISSION, NONDERIV_TRANS, and REPORTINGOWNER tables
    to create aggregated insider features per symbol/date.
    """
    print("\n🔨 Building insider features...")

    # Join tables
    df = (
        tables['NONDERIV_TRANS']
        .merge(tables['SUBMISSION'], on='ACCESSION_NUMBER', how='inner')
        .merge(tables['REPORTINGOWNER'], on='ACCESSION_NUMBER', how='inner')
    )

    print(f"  📊 Joined tables: {len(df):,} total transactions")

    # Filter to meaningful transactions only
    df = df[df['TRANS_CODE'].isin(MEANINGFUL_CODES)].copy()
    print(f"  🎯 Filtered to meaningful codes: {len(df):,} transactions")

    # Filter out rows with missing critical fields
    df = df.dropna(subset=['TRANS_DATE', 'TRANS_SHARES', 'TRANS_PRICEPERSHARE'])
    print(f"  ✂️  Removed nulls: {len(df):,} transactions remain")

    # Calculate transaction value
    df['trans_value'] = df['TRANS_SHARES'] * df['TRANS_PRICEPERSHARE']

    # Separate buy and sell transactions
    df['is_buy'] = df['TRANS_CODE'].isin(BUY_CODES)
    df['is_sell'] = df['TRANS_CODE'].isin(SELL_CODES)

    # Calculate buy/sell metrics
    df['buy_shares'] = df.apply(lambda r: r['TRANS_SHARES'] if r['is_buy'] else 0, axis=1)
    df['buy_value'] = df.apply(lambda r: r['trans_value'] if r['is_buy'] else 0, axis=1)
    df['sell_shares'] = df.apply(lambda r: r['TRANS_SHARES'] if r['is_sell'] else 0, axis=1)
    df['sell_value'] = df.apply(lambda r: r['trans_value'] if r['is_sell'] else 0, axis=1)

    # Calculate net (buy - sell)
    df['net_shares'] = df['buy_shares'] - df['sell_shares']
    df['net_value'] = df['buy_value'] - df['sell_value']

    # Aggregate by symbol and date
    features = df.groupby(['ISSUERTRADINGSYMBOL', 'TRANS_DATE']).agg({
        'net_shares': 'sum',
        'net_value': 'sum',
        'buy_shares': 'sum',
        'buy_value': 'sum',
        'sell_shares': 'sum',
        'sell_value': 'sum',
        'is_buy': 'sum',
        'is_sell': 'sum'
    }).reset_index()

    # Rename columns
    features.columns = [
        'symbol',
        'date',
        'insider_net_shares',
        'insider_net_value',
        'insider_buy_shares',
        'insider_buy_value',
        'insider_sell_shares',
        'insider_sell_value',
        'insider_buy_count',
        'insider_sell_count'
    ]

    # Convert date to string format
    features['date'] = features['date'].dt.strftime('%Y-%m-%d')

    # Filter out rows with null symbols
    features = features[features['symbol'].notna()].copy()

    print(f"  ✅ Built features: {len(features):,} symbol-date pairs")
    print(f"  📈 Unique symbols: {features['symbol'].nunique():,}")

    return features


def main():
    """Process all Form 4 ZIP files and create Parquet feature store."""

    print("=" * 80)
    print("SEC FORM 4 PARSER - INSIDER TRANSACTIONS")
    print("=" * 80)

    # Paths
    insider_dir = Path('datasets/SEC/insider-transactions')
    output_dir = Path('data/smart_money_features')
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all ZIP files
    zip_files = sorted(insider_dir.glob('*.zip'))

    if not zip_files:
        print(f"\n❌ No ZIP files found in {insider_dir}")
        sys.exit(1)

    print(f"\n📦 Found {len(zip_files)} ZIP files to process\n")

    # Process each ZIP file
    all_features = []

    for zip_file in zip_files:
        try:
            # Load tables from ZIP
            tables = load_form4_tables(str(zip_file))

            # Check required tables exist
            required = ['SUBMISSION', 'NONDERIV_TRANS', 'REPORTINGOWNER']
            missing = [t for t in required if t not in tables]

            if missing:
                print(f"  ⚠️  Skipping {zip_file.name}: missing tables {missing}")
                continue

            # Build features
            features = build_insider_features(tables)
            all_features.append(features)

            print(f"  💾 Processed {zip_file.name}: {len(features):,} features\n")

        except Exception as e:
            print(f"  ❌ Failed to process {zip_file.name}: {e}\n")
            continue

    if not all_features:
        print("\n❌ No features extracted")
        sys.exit(1)

    # Combine all features
    print("\n🔗 Combining all features...")
    combined = pd.concat(all_features, ignore_index=True)

    # Remove duplicates (keep last if symbol-date appears multiple times)
    combined = combined.drop_duplicates(subset=['symbol', 'date'], keep='last')

    print(f"  ✅ Combined features: {len(combined):,} rows")
    print(f"  📊 Date range: {combined['date'].min()} to {combined['date'].max()}")
    print(f"  🏢 Unique symbols: {combined['symbol'].nunique():,}")

    # Save to Parquet
    output_file = output_dir / 'insider_features.parquet'
    combined.to_parquet(output_file, index=False, compression='snappy')

    file_size_mb = output_file.stat().st_size / (1024 * 1024)
    print(f"\n💾 Saved to {output_file}")
    print(f"  📦 File size: {file_size_mb:.2f} MB")
    print(f"  ✅ Compression: Snappy")

    # Show sample
    print("\n📋 Sample features:")
    print(combined.head(10).to_string())

    # Show statistics
    print("\n📊 Feature Statistics:")
    print(f"  Total features: {len(combined):,}")
    print(f"  Unique symbols: {combined['symbol'].nunique():,}")
    print(f"  Date range: {combined['date'].min()} to {combined['date'].max()}")
    print(f"  Avg net value: ${combined['insider_net_value'].mean():,.2f}")
    print(f"  Total buy value: ${combined['insider_buy_value'].sum():,.2f}")
    print(f"  Total sell value: ${combined['insider_sell_value'].sum():,.2f}")

    print("\n" + "=" * 80)
    print("✅ FORM 4 PARSING COMPLETE")
    print("=" * 80)


if __name__ == '__main__':
    main()
