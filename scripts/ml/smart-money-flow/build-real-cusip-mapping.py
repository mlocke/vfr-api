#!/usr/bin/env python3
"""
Build Real CUSIP → Ticker Mapping from SEC Data

Strategy:
1. Load all 13F INFOTABLE files to get CUSIP → Company Name
2. Download SEC company tickers to get CIK → Ticker
3. Match company names to create CUSIP → Ticker mapping
4. Save to Parquet for fast lookups
"""

import zipfile
import pandas as pd
from io import StringIO
import requests
import json
from pathlib import Path
import re

def download_sec_tickers():
    """Download SEC company tickers (CIK → Ticker mapping)"""
    print("\n📥 Downloading SEC company tickers...")

    url = "https://www.sec.gov/files/company_tickers.json"
    headers = {
        "User-Agent": "Smart Money Research ml@example.com",
        "Accept-Encoding": "gzip, deflate",
        "Host": "www.sec.gov"
    }

    response = requests.get(url, headers=headers)
    response.raise_for_status()

    data = response.json()

    # Create ticker → company name mapping
    ticker_to_name = {}
    name_to_ticker = {}

    for key in data:
        company = data[key]
        ticker = company['ticker']
        name = company['title'].upper().strip()

        ticker_to_name[ticker] = name
        name_to_ticker[name] = ticker

    print(f"  ✅ Downloaded {len(ticker_to_name)} company tickers")
    return ticker_to_name, name_to_ticker

def normalize_company_name(name):
    """Normalize company name for matching"""
    # Remove common suffixes
    name = name.upper().strip()
    name = re.sub(r'\s+(INC|CORP|LTD|LLC|CO|COMPANY|CORPORATION|INCORPORATED|LIMITED)\.?$', '', name)
    name = re.sub(r'\s+', ' ', name)  # Normalize whitespace
    return name.strip()

def load_cusip_from_13f(zip_path):
    """Load CUSIP → Company Name from 13F filings"""
    cusip_to_name = {}

    with zipfile.ZipFile(zip_path, 'r') as z:
        if 'INFOTABLE.tsv' in z.namelist():
            with z.open('INFOTABLE.tsv') as file:
                content = file.read().decode('utf-8', errors='ignore')
                df = pd.read_csv(StringIO(content), sep='\t')

                for _, row in df.iterrows():
                    cusip = row['CUSIP']
                    name = str(row['NAMEOFISSUER']).upper().strip()

                    if cusip and cusip != 'nan':
                        cusip_to_name[cusip] = name

    return cusip_to_name

def build_mapping():
    """Build complete CUSIP → Ticker mapping"""
    print("\n" + "="*80)
    print("BUILD REAL CUSIP → TICKER MAPPING")
    print("="*80)

    # Download SEC tickers
    ticker_to_name, name_to_ticker = download_sec_tickers()

    # Load all 13F files
    print("\n📂 Loading 13F filings...")
    cusip_to_name = {}

    form13f_dir = Path('datasets/SEC/13F')
    zip_files = list(form13f_dir.glob('*.zip'))

    print(f"  Found {len(zip_files)} 13F archives")

    for i, zip_path in enumerate(zip_files, 1):
        print(f"  [{i}/{len(zip_files)}] Processing {zip_path.name}...")
        cusip_data = load_cusip_from_13f(zip_path)
        cusip_to_name.update(cusip_data)
        print(f"    Added {len(cusip_data)} CUSIPs (total: {len(cusip_to_name)})")

    print(f"\n  ✅ Loaded {len(cusip_to_name)} unique CUSIPs from 13F filings")

    # Match CUSIPs to tickers
    print("\n🔗 Matching CUSIPs to tickers...")
    mappings = []
    matched = 0
    unmatched = 0

    for cusip, company_name in cusip_to_name.items():
        normalized_name = normalize_company_name(company_name)

        # Try exact match first
        ticker = name_to_ticker.get(company_name)

        if not ticker:
            # Try normalized match
            ticker = name_to_ticker.get(normalized_name)

        if not ticker:
            # Try fuzzy match (check if any ticker's company name contains the normalized name)
            for t, full_name in ticker_to_name.items():
                if normalized_name in normalize_company_name(full_name) or \
                   normalize_company_name(full_name) in normalized_name:
                    ticker = t
                    break

        if ticker:
            mappings.append({
                'cusip': cusip,
                'ticker': ticker,
                'company_name': company_name
            })
            matched += 1
        else:
            unmatched += 1
            # Still add it with empty ticker for reference
            mappings.append({
                'cusip': cusip,
                'ticker': '',
                'company_name': company_name
            })

    print(f"  ✅ Matched {matched} CUSIPs to tickers ({matched/len(cusip_to_name)*100:.1f}%)")
    print(f"  ⚠️  Unmatched: {unmatched} CUSIPs ({unmatched/len(cusip_to_name)*100:.1f}%)")

    # Save to Parquet
    print("\n💾 Saving to Parquet...")
    df = pd.DataFrame(mappings)

    output_dir = Path('data/smart_money_features')
    output_dir.mkdir(parents=True, exist_ok=True)

    parquet_path = output_dir / 'cusip_ticker_mapping.parquet'
    df.to_parquet(parquet_path, index=False, compression='snappy')

    print(f"  ✅ Saved {len(df)} CUSIP mappings to {parquet_path}")

    # Also save as CSV for easy inspection
    csv_path = output_dir / 'cusip_ticker_mapping.csv'
    df.to_csv(csv_path, index=False)
    print(f"  ✅ Saved CSV to {csv_path}")

    # Statistics
    print("\n" + "="*80)
    print("MAPPING STATISTICS")
    print("="*80)
    print(f"Total CUSIPs: {len(df)}")
    print(f"Matched to tickers: {matched} ({matched/len(df)*100:.1f}%)")
    print(f"Unmatched: {unmatched} ({unmatched/len(df)*100:.1f}%)")
    print(f"\nSample mappings:")
    print(df[df['ticker'] != ''].head(10))

    print("\n" + "="*80)
    print("✅ CUSIP MAPPING COMPLETE")
    print("="*80)

if __name__ == "__main__":
    build_mapping()
