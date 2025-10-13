#!/usr/bin/env python3
"""
SEC Form 13F Parser - Institutional Holdings

Purpose: Parse SEC Form 13F (institutional holdings) datasets into smart money features
Input: datasets/SEC/13F/*.zip
Output: Parquet files with institutional holding changes

Pattern: Follows the plan in docs/prebuilt-dataset-parquet/complete-doc.md
"""

import zipfile
import pandas as pd
import pyarrow.parquet as pq
import pyarrow as pa
from pathlib import Path
from typing import Dict, List, Optional
import sys
import json
from difflib import SequenceMatcher


def load_13f_tables(zip_path: str) -> Dict[str, pd.DataFrame]:
    """Load all TSV tables from a 13F ZIP file."""
    tables = {}

    print(f"📂 Loading {Path(zip_path).name}...")

    with zipfile.ZipFile(zip_path, 'r') as z:
        for fname in z.namelist():
            if fname.endswith('.tsv'):
                table_name = fname.replace('.tsv', '')

                try:
                    # Read TSV
                    df = pd.read_csv(
                        z.open(fname),
                        sep='\t',
                        low_memory=False,
                        na_values=['', 'NA', 'N/A']
                    )

                    # Parse date columns
                    date_columns = ['FILING_DATE', 'PERIODOFREPORT', 'REPORTCALENDARORQUARTER']
                    for col in date_columns:
                        if col in df.columns:
                            df[col] = pd.to_datetime(df[col], format='%d-%b-%Y', errors='coerce')

                    tables[table_name] = df
                    print(f"  ✅ Loaded {table_name}: {len(df):,} rows")

                except Exception as e:
                    print(f"  ❌ Failed to load {table_name}: {e}")
                    continue

    return tables


def load_company_tickers() -> Dict[str, str]:
    """Load company tickers mapping from SEC JSON."""
    tickers_path = Path('datasets/SEC/company_tickers.json')

    print(f"\n📋 Loading company tickers from {tickers_path}...")

    with open(tickers_path) as f:
        data = json.load(f)

    # Build title→ticker mapping (lowercase for fuzzy matching)
    title_to_ticker = {}
    for company in data.values():
        title = company.get('title', '').upper()
        ticker = company.get('ticker', '')
        if title and ticker:
            title_to_ticker[title] = ticker

    print(f"  ✅ Loaded {len(title_to_ticker):,} company mappings")
    return title_to_ticker


def map_cusip_to_symbol(df: pd.DataFrame, title_to_ticker: Dict[str, str]) -> pd.DataFrame:
    """Add symbol column by mapping CUSIP → NAMEOFISSUER → Ticker."""
    print("\n🔗 Mapping CUSIPs to ticker symbols...")

    # Create CUSIP → most common company name mapping
    cusip_to_name = df.groupby('CUSIP')['NAMEOFISSUER'].agg(
        lambda x: x.mode()[0] if len(x.mode()) > 0 else x.iloc[0]
    ).to_dict()

    print(f"  📊 Found {len(cusip_to_name):,} unique CUSIPs")

    # Map company name to ticker
    cusip_to_symbol = {}
    matched = 0
    unmatched = []

    for cusip, company_name in cusip_to_name.items():
        company_upper = company_name.upper()

        # Try exact match first
        if company_upper in title_to_ticker:
            cusip_to_symbol[cusip] = title_to_ticker[company_upper]
            matched += 1
        else:
            # Try fuzzy match (>90% similarity)
            best_match = None
            best_ratio = 0

            for title, ticker in title_to_ticker.items():
                ratio = SequenceMatcher(None, company_upper, title).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match = ticker

            if best_ratio > 0.9:
                cusip_to_symbol[cusip] = best_match
                matched += 1
            else:
                unmatched.append((cusip, company_name))

    print(f"  ✅ Matched {matched:,} CUSIPs to tickers")
    if unmatched:
        print(f"  ⚠️  Unmatched: {len(unmatched):,} CUSIPs")
        print(f"     (First 5: {[name for _, name in unmatched[:5]]})")

    return cusip_to_symbol


def build_13f_features(
    tables: Dict[str, pd.DataFrame],
    cusip_to_symbol: Dict[str, str],
    prev_quarter: Optional[pd.DataFrame] = None
) -> pd.DataFrame:
    """
    Build institutional holding features from 13F tables.

    Calculates quarter-over-quarter changes to detect institutional buying/selling.
    """
    print("\n🔨 Building institutional features...")

    # Join INFOTABLE with SUBMISSION to get filing dates
    df = tables['INFOTABLE'].merge(
        tables['SUBMISSION'],
        on='ACCESSION_NUMBER',
        how='inner'
    )

    print(f"  📊 Joined tables: {len(df):,} holdings")

    # Filter to shares only (not principal amounts)
    df = df[df['SSHPRNAMTTYPE'] == 'SH'].copy()
    print(f"  🎯 Filtered to shares: {len(df):,} holdings")

    # Filter out rows with missing CUSIP or values
    df = df.dropna(subset=['CUSIP', 'SSHPRNAMT', 'VALUE'])
    print(f"  ✂️  Removed nulls: {len(df):,} holdings remain")

    # Get quarter date (use the most common PERIODOFREPORT date)
    quarter_date = df['PERIODOFREPORT'].mode()[0]
    quarter_str = quarter_date.strftime('%Y-%m-%d')

    print(f"  📅 Quarter end date: {quarter_str}")

    # Aggregate by CUSIP
    current = df.groupby('CUSIP').agg({
        'VALUE': 'sum',
        'SSHPRNAMT': 'sum',
        'CIK': 'count'  # Number of institutions holding
    }).reset_index()

    current.columns = ['cusip', 'total_value', 'total_shares', 'num_institutions']
    current['quarter_date'] = quarter_str

    # Add symbol column by mapping CUSIP
    current['symbol'] = current['cusip'].map(cusip_to_symbol)

    # Count how many we successfully mapped
    mapped_count = current['symbol'].notna().sum()
    print(f"  🔗 Mapped {mapped_count:,} / {len(current):,} CUSIPs to symbols ({mapped_count/len(current)*100:.1f}%)")

    print(f"  📊 Aggregated to {len(current):,} unique CUSIPs")

    # Calculate changes if previous quarter available
    if prev_quarter is not None:
        print("  📈 Calculating quarter-over-quarter changes...")

        changes = current.merge(
            prev_quarter[['cusip', 'total_shares', 'total_value']],
            on='cusip',
            how='outer',
            suffixes=('', '_prev')
        )

        # Fill NaN with 0 (new or closed positions)
        changes['total_shares'] = changes['total_shares'].fillna(0)
        changes['total_value'] = changes['total_value'].fillna(0)
        changes['total_shares_prev'] = changes['total_shares_prev'].fillna(0)
        changes['total_value_prev'] = changes['total_value_prev'].fillna(0)
        changes['num_institutions'] = changes['num_institutions'].fillna(0)

        # Calculate changes
        changes['share_change'] = changes['total_shares'] - changes['total_shares_prev']
        changes['value_change'] = changes['total_value'] - changes['total_value_prev']

        # Fill quarter_date for new positions
        changes['quarter_date'] = changes['quarter_date'].fillna(quarter_str)

        # Select final columns
        result = changes[[
            'cusip',
            'symbol',
            'quarter_date',
            'total_shares',
            'total_value',
            'num_institutions',
            'share_change',
            'value_change'
        ]]

        print(f"  ✅ Calculated changes for {len(result):,} CUSIPs")
        print(f"    📈 Net buying: {(result['share_change'] > 0).sum():,}")
        print(f"    📉 Net selling: {(result['share_change'] < 0).sum():,}")

        return result

    else:
        # First quarter - no changes to calculate
        current['share_change'] = 0
        current['value_change'] = 0

        # Reorder columns to match
        current = current[[
            'cusip',
            'symbol',
            'quarter_date',
            'total_shares',
            'total_value',
            'num_institutions',
            'share_change',
            'value_change'
        ]]

        print(f"  ✅ First quarter baseline: {len(current):,} CUSIPs")

        return current


def main():
    """Process all 13F ZIP files and create Parquet feature store."""

    print("=" * 80)
    print("SEC FORM 13F PARSER - INSTITUTIONAL HOLDINGS")
    print("=" * 80)

    # Paths
    f13_dir = Path('datasets/SEC/13F')
    output_dir = Path('data/smart_money_features')
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all ZIP files (sorted by date)
    zip_files = sorted(f13_dir.glob('*.zip'))

    if not zip_files:
        print(f"\n❌ No ZIP files found in {f13_dir}")
        sys.exit(1)

    print(f"\n📦 Found {len(zip_files)} ZIP files to process\n")

    # Load company tickers mapping
    title_to_ticker = load_company_tickers()

    # Build CUSIP → symbol mapping from first ZIP file
    print(f"\n📋 Building CUSIP → symbol mapping from first ZIP file...")
    first_tables = load_13f_tables(str(zip_files[0]))
    cusip_to_symbol = map_cusip_to_symbol(first_tables['INFOTABLE'], title_to_ticker)

    # Process each ZIP file sequentially (need previous quarter for changes)
    all_features = []
    prev_quarter = None

    for zip_file in zip_files:
        try:
            # Load tables from ZIP
            tables = load_13f_tables(str(zip_file))

            # Check required tables exist
            required = ['SUBMISSION', 'INFOTABLE']
            missing = [t for t in required if t not in tables]

            if missing:
                print(f"  ⚠️  Skipping {zip_file.name}: missing tables {missing}")
                continue

            # Build features with symbol mapping
            features = build_13f_features(tables, cusip_to_symbol, prev_quarter)
            all_features.append(features)

            print(f"  💾 Processed {zip_file.name}: {len(features):,} features\n")

            # Save for next iteration
            prev_quarter = features.copy()

        except Exception as e:
            print(f"  ❌ Failed to process {zip_file.name}: {e}\n")
            continue

    if not all_features:
        print("\n❌ No features extracted")
        sys.exit(1)

    # Combine all features
    print("\n🔗 Combining all features...")
    combined = pd.concat(all_features, ignore_index=True)

    print(f"  ✅ Combined features: {len(combined):,} rows")
    print(f"  📊 Date range: {combined['quarter_date'].min()} to {combined['quarter_date'].max()}")
    print(f"  🏢 Unique CUSIPs: {combined['cusip'].nunique():,}")

    # Save to Parquet
    output_file = output_dir / 'institutional_features.parquet'
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
    print(f"  Unique CUSIPs: {combined['cusip'].nunique():,}")
    print(f"  Quarters: {combined['quarter_date'].nunique()}")
    print(f"  Avg institutions per CUSIP: {combined['num_institutions'].mean():.1f}")
    print(f"  Total value: ${combined['total_value'].sum():,.2f}")
    print(f"  Net buying (by value): ${combined[combined['value_change'] > 0]['value_change'].sum():,.2f}")
    print(f"  Net selling (by value): ${abs(combined[combined['value_change'] < 0]['value_change'].sum()):,.2f}")

    print("\n✅ NOTE: Features include both CUSIP and ticker symbol columns.")
    print(f"   Mapped symbols: {combined['symbol'].notna().sum():,} / {len(combined):,} rows")

    print("\n" + "=" * 80)
    print("✅ FORM 13F PARSING COMPLETE")
    print("=" * 80)


if __name__ == '__main__':
    main()
