#!/usr/bin/env python3
"""
Build comprehensive options dataset from Polygon.io API

Uses your existing Polygon API access to download options data
Alternative to EODHD Options API

Usage:
    python3 build-polygon-options-dataset.py
    python3 build-polygon-options-dataset.py --tickers AAPL MSFT TSLA
"""

import requests
import json
import csv
import os
import time
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

POLYGON_API_KEY = os.getenv('POLYGON_API_KEY', 'ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr')
BASE_URL = 'https://api.polygon.io'
OUTPUT_DIR = './data/polygon_options'
DELAY_MS = 0.2  # 200ms delay between requests


class PolygonOptionsDatasetBuilder:
    def __init__(self):
        self.api_call_count = 0
        self.start_time = time.time()
        self.success_count = 0
        self.error_count = 0

        # Create output directory
        Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

    def get_tickers_list(self) -> List[str]:
        """Get list of tickers to process"""

        # Try to load from financials.csv if it exists
        if os.path.exists('financials.csv'):
            print("📋 Loading tickers from financials.csv...")
            tickers = []
            with open('financials.csv', 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    tickers.append(row['Symbol'])
            print(f"   Found {len(tickers)} S&P 500 tickers")
            return tickers

        # Default major tickers
        major_tickers = [
            'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD',
            'NFLX', 'DIS', 'V', 'MA', 'JPM', 'BAC', 'WFC', 'GS',
            'SPY', 'QQQ', 'IWM', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLU',
            'INTC', 'CSCO', 'ORCL', 'CRM', 'ADBE', 'PYPL', 'UBER',
            'F', 'GM', 'T', 'VZ', 'KO', 'PEP', 'WMT', 'TGT', 'HD', 'LOW'
        ]

        print(f"📋 Using {len(major_tickers)} default tickers")
        return major_tickers

    def get_options_contracts(self, ticker: str, limit: int = 1000) -> Optional[List[Dict]]:
        """Get options contracts for a ticker"""
        try:
            url = f"{BASE_URL}/v3/reference/options/contracts"
            params = {
                'underlying_ticker': ticker,
                'limit': limit,
                'apiKey': POLYGON_API_KEY
            }

            response = requests.get(url, params=params, timeout=30)
            self.api_call_count += 1

            if response.status_code == 200:
                data = response.json()
                if data.get('results'):
                    contracts = data['results']
                    print(f"  ✅ {ticker}: {len(contracts)} options contracts")
                    return contracts
                else:
                    print(f"  ⚠️  {ticker}: No contracts found")
                    return None
            elif response.status_code == 429:
                print(f"  🚫 Rate limit reached")
                time.sleep(60)  # Wait 1 minute
                return self.get_options_contracts(ticker, limit)
            else:
                print(f"  ❌ {ticker}: HTTP {response.status_code}")
                return None

        except Exception as e:
            print(f"  ❌ {ticker}: {str(e)}")
            return None

    def get_option_details(self, option_ticker: str, date: Optional[str] = None) -> Optional[Dict]:
        """Get detailed options data including Greeks, IV, etc."""
        try:
            # Get snapshot for current data
            url = f"{BASE_URL}/v3/snapshot/options/{option_ticker}"
            params = {'apiKey': POLYGON_API_KEY}

            response = requests.get(url, params=params, timeout=10)
            self.api_call_count += 1

            if response.status_code == 200:
                data = response.json()
                if data.get('results'):
                    return data['results']

            return None

        except Exception as e:
            return None

    def save_to_json(self, ticker: str, data: List[Dict], date: str):
        """Save options data to JSON file"""
        filename = os.path.join(OUTPUT_DIR, f"{ticker}_{date}.json")
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)

    def save_to_csv(self, ticker: str, data: List[Dict], date: str):
        """Save options data to CSV file"""
        if not data or len(data) == 0:
            return

        filename = os.path.join(OUTPUT_DIR, f"{ticker}_{date}.csv")

        # Get all unique keys
        keys = set()
        for option in data:
            keys.update(option.keys())
        keys = sorted(list(keys))

        # Write CSV
        with open(filename, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(data)

    def build_dataset(self, tickers: Optional[List[str]] = None, format: str = 'both',
                     detailed: bool = False):
        """Build current options dataset"""
        print('=' * 80)
        print('POLYGON.IO OPTIONS DATASET BUILDER')
        print('=' * 80)
        print(f'\n📊 Output directory: {OUTPUT_DIR}')
        print(f'📁 Format: {format}')
        print(f'📈 Detailed data (Greeks/IV): {detailed}')
        print()

        # Get tickers
        if tickers is None:
            tickers = self.get_tickers_list()

        today = datetime.now().strftime('%Y-%m-%d')

        for i, ticker in enumerate(tickers):
            print(f'\n[{i+1}/{len(tickers)}] Processing {ticker}...')

            # Get contracts
            contracts = self.get_options_contracts(ticker)

            if contracts and len(contracts) > 0:
                # If detailed, get snapshot data for each contract (slower but more data)
                if detailed and len(contracts) <= 100:  # Limit to avoid too many calls
                    print(f"     Fetching detailed data for {len(contracts)} contracts...")
                    detailed_data = []
                    for contract in contracts[:50]:  # Limit to first 50 for speed
                        details = self.get_option_details(contract['ticker'])
                        if details:
                            detailed_data.append({**contract, **details})
                        time.sleep(0.1)

                    if detailed_data:
                        contracts = detailed_data

                # Save data
                if format in ['json', 'both']:
                    self.save_to_json(ticker, contracts, today)
                if format in ['csv', 'both']:
                    self.save_to_csv(ticker, contracts, today)

                self.success_count += 1
            else:
                self.error_count += 1

            # Rate limiting delay
            time.sleep(DELAY_MS)

        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print execution summary"""
        duration = (time.time() - self.start_time) / 60

        print('\n' + '=' * 80)
        print('✨ DATASET BUILD COMPLETE')
        print('=' * 80)
        print(f'✅ Success: {self.success_count} tickers')
        print(f'❌ Errors: {self.error_count} tickers')
        print(f'📞 API calls used: {self.api_call_count:,}')
        print(f'⏱️  Duration: {duration:.2f} minutes')
        print(f'📁 Files saved to: {OUTPUT_DIR}')
        print()
        print('💡 Next steps:')
        print('  1. Convert CSV to Parquet for efficient storage')
        print('  2. Import to PostgreSQL database')
        print('  3. Combine with Kaggle options datasets')
        print('  4. Build ML features from options data')


def main():
    parser = argparse.ArgumentParser(
        description='Build Polygon options dataset',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Build current options for default tickers
  python3 build-polygon-options-dataset.py

  # Build for specific tickers
  python3 build-polygon-options-dataset.py --tickers AAPL MSFT TSLA

  # Get detailed data with Greeks (slower)
  python3 build-polygon-options-dataset.py --tickers AAPL --detailed

  # JSON only
  python3 build-polygon-options-dataset.py --format json
        """
    )

    parser.add_argument('--tickers', nargs='+', help='List of ticker symbols')
    parser.add_argument('--format', choices=['json', 'csv', 'both'], default='both',
                        help='Output format (default: both)')
    parser.add_argument('--detailed', action='store_true',
                        help='Get detailed snapshot data (Greeks, IV) - slower')

    args = parser.parse_args()

    builder = PolygonOptionsDatasetBuilder()
    builder.build_dataset(tickers=args.tickers, format=args.format, detailed=args.detailed)


if __name__ == '__main__':
    main()
