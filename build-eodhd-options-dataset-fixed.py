#!/usr/bin/env python3
"""
Build comprehensive options dataset from EODHD Marketplace Options API

FIXED VERSION - Uses correct marketplace endpoint with proper URL encoding

With 100,000 calls/day, you can systematically download options data
for all 6,000+ tickers and save to JSON/CSV files

Usage:
    python3 build-eodhd-options-dataset-fixed.py
    python3 build-eodhd-options-dataset-fixed.py --tickers AAPL MSFT TSLA
    python3 build-eodhd-options-dataset-fixed.py --historical AAPL --start 2024-01-01 --end 2024-12-31
"""

import requests
import json
import csv
import os
import time
import argparse
import signal
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

EODHD_API_KEY = os.getenv('EODHD_API_KEY', '68ec0c6a3bd8a9.01565032')
BASE_URL = 'https://eodhd.com/api/mp/unicornbay'  # Marketplace endpoint!
OUTPUT_DIR = './data/eodhd_options'
RATE_LIMIT = 10000  # Daily limit in requests (100,000 credits ÷ 10 credits per options call)
DELAY_MS = 0.15  # 150ms delay between requests (~400 req/min, well under 1000/min limit)

# Timeout settings to prevent stuck processes
MAX_TICKER_RUNTIME_SECONDS = 600  # 10 minutes per ticker max
MAX_TOTAL_RUNTIME_SECONDS = 7200  # 2 hours total max
MAX_PAGES_PER_TICKER = 500  # Stop if a ticker has > 500k contracts (500 pages × 1000)


class EODHDOptionsDatasetBuilder:
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
            'NFLX', 'DIS', 'BABA', 'V', 'MA', 'JPM', 'BAC', 'WFC', 'GS',
            'SPY', 'QQQ', 'IWM', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLU',
            'INTC', 'CSCO', 'ORCL', 'CRM', 'ADBE', 'PYPL', 'UBER', 'LYFT',
            'F', 'GM', 'T', 'VZ', 'KO', 'PEP', 'WMT', 'TGT', 'HD', 'LOW',
            'MCD', 'SBUX', 'NKE', 'BA', 'CAT', 'DE', 'MMM', 'HON', 'UNP'
        ]

        print(f"📋 Using {len(major_tickers)} default tickers")
        return major_tickers

    def get_options_data(self, ticker: str, date: Optional[str] = None, limit: int = 1000) -> Optional[List[Dict]]:
        """Get ALL options data for a specific ticker using marketplace endpoint with pagination"""
        all_options = []
        page = 1
        total_contracts = 0
        ticker_start_time = time.time()

        try:
            while True:
                # Check rate limit before each page
                if self.api_call_count >= RATE_LIMIT * 0.95:
                    print(f"  ⚠️  Rate limit approaching, stopping pagination for {ticker}")
                    break

                # Check per-ticker timeout
                ticker_elapsed = time.time() - ticker_start_time
                if ticker_elapsed > MAX_TICKER_RUNTIME_SECONDS:
                    print(f"  ⏱️  {ticker}: Timeout after {ticker_elapsed:.1f}s ({len(all_options):,} contracts saved)")
                    break

                # Check page limit (prevents infinite pagination loops)
                if page > MAX_PAGES_PER_TICKER:
                    print(f"  ⚠️  {ticker}: Reached max page limit ({MAX_PAGES_PER_TICKER} pages, {len(all_options):,} contracts)")
                    break

                # Use marketplace endpoint
                url = f"{BASE_URL}/options/eod"

                # Build parameters with proper structure
                params = {
                    'filter[underlying_symbol]': ticker,
                    'api_token': EODHD_API_KEY,
                    'page[limit]': limit,  # Max 1000 per request
                    'page[number]': page
                }

                if date:
                    params['filter[tradetime_from]'] = date
                    params['filter[tradetime_to]'] = date

                # Make request with proper headers (EODHD blocks default Python User-Agent)
                headers = {
                    'User-Agent': 'curl/7.68.0',
                    'Accept': '*/*'
                }
                response = requests.get(url, params=params, headers=headers, timeout=30)
                self.api_call_count += 1

                if response.status_code == 200:
                    data = response.json()

                    if data and 'data' in data:
                        # Extract attributes from marketplace format
                        page_data = []
                        for item in data['data']:
                            if 'attributes' in item:
                                page_data.append(item['attributes'])
                            else:
                                page_data.append(item)

                        if not page_data:
                            # No more data
                            break

                        all_options.extend(page_data)
                        total_contracts = data.get('meta', {}).get('total', len(all_options))

                        print(f"  📄 {ticker} page {page}: {len(page_data)} contracts ({len(all_options):,}/{total_contracts:,})")

                        # Check if we got all data
                        if len(all_options) >= total_contracts or len(page_data) < limit:
                            break

                        page += 1
                        time.sleep(DELAY_MS)  # Delay between pages
                    else:
                        break

                elif response.status_code == 404:
                    if page == 1:
                        print(f"  ⚠️  {ticker}: No options data available")
                    break
                elif response.status_code == 429:
                    print(f"  🚫 Rate limit reached. Used {self.api_call_count} calls today.")
                    raise Exception('Rate limit exceeded')
                elif response.status_code == 402:
                    print(f"  🚫 Payment required - check subscription status")
                    raise Exception('Subscription issue')
                else:
                    print(f"  ❌ {ticker} page {page}: HTTP {response.status_code}")
                    break

            if all_options:
                print(f"  ✅ {ticker}: {len(all_options):,} total contracts retrieved")
                return all_options
            else:
                return None

        except requests.exceptions.Timeout:
            print(f"  ❌ {ticker}: Request timeout")
            return all_options if all_options else None
        except Exception as e:
            print(f"  ❌ {ticker}: {str(e)}")
            return all_options if all_options else None

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

    def build_dataset(self, tickers: Optional[List[str]] = None, format: str = 'both'):
        """Build current options dataset"""
        print('=' * 80)
        print('EODHD OPTIONS DATASET BUILDER (FIXED - Marketplace API)')
        print('=' * 80)
        print(f'\n📊 Output directory: {OUTPUT_DIR}')
        print(f'📁 Format: {format}')
        print(f'⚡ Daily limit: {RATE_LIMIT:,} API calls')
        print(f'⏱️  Max runtime: {MAX_TOTAL_RUNTIME_SECONDS/3600:.1f} hours')
        print(f'⏱️  Max per ticker: {MAX_TICKER_RUNTIME_SECONDS/60:.0f} minutes')
        print()

        # Get tickers
        if tickers is None:
            tickers = self.get_tickers_list()

        today = datetime.now().strftime('%Y-%m-%d')

        for i, ticker in enumerate(tickers):
            print(f'\n[{i+1}/{len(tickers)}] Processing {ticker}...')

            # Check total runtime timeout
            total_elapsed = time.time() - self.start_time
            if total_elapsed > MAX_TOTAL_RUNTIME_SECONDS:
                print(f'\n⏱️  Total runtime timeout ({total_elapsed/3600:.1f} hours). Stopping gracefully...')
                break

            # Check rate limit
            if self.api_call_count >= RATE_LIMIT * 0.95:
                print('\n⚠️  Approaching daily rate limit. Stopping...')
                break

            # Get data
            data = self.get_options_data(ticker)

            if data and len(data) > 0:
                # Save data
                if format in ['json', 'both']:
                    self.save_to_json(ticker, data, today)
                if format in ['csv', 'both']:
                    self.save_to_csv(ticker, data, today)

                self.success_count += 1
            else:
                self.error_count += 1

            # Rate limiting delay
            time.sleep(DELAY_MS)

        # Print summary
        self.print_summary()

    def build_historical_dataset(self, ticker: str, start_date: str, end_date: str):
        """Build historical dataset for a specific ticker"""
        print('=' * 80)
        print(f'BUILDING HISTORICAL DATASET FOR {ticker}')
        print('=' * 80)
        print(f'From: {start_date}')
        print(f'To: {end_date}')
        print()

        # Generate weekly dates
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        dates = []

        current = start
        while current <= end:
            dates.append(current.strftime('%Y-%m-%d'))
            current += timedelta(days=7)  # Weekly snapshots

        print(f'📅 Processing {len(dates)} weeks\n')

        for i, date in enumerate(dates):
            if self.api_call_count >= RATE_LIMIT * 0.95:
                print('\n⚠️  Approaching daily rate limit. Stopping...')
                break

            print(f'[{i+1}/{len(dates)}] {date}...')
            data = self.get_options_data(ticker, date)

            if data and len(data) > 0:
                self.save_to_json(ticker, data, date)
                self.save_to_csv(ticker, data, date)
                print(f'     ✅ {len(data)} contracts saved')
                self.success_count += 1
            else:
                self.error_count += 1

            time.sleep(DELAY_MS)

        self.print_summary()

    def print_summary(self):
        """Print execution summary"""
        duration = (time.time() - self.start_time) / 60

        print('\n' + '=' * 80)
        print('✨ DATASET BUILD COMPLETE')
        print('=' * 80)
        print(f'✅ Success: {self.success_count} tickers')
        print(f'❌ Errors: {self.error_count} tickers')
        print(f'📞 API calls used: {self.api_call_count:,} / {RATE_LIMIT:,}')
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
        description='Build EODHD options dataset (FIXED VERSION)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Build current options for default tickers
  python3 build-eodhd-options-dataset-fixed.py

  # Build for specific tickers
  python3 build-eodhd-options-dataset-fixed.py --tickers AAPL MSFT TSLA

  # Build historical dataset
  python3 build-eodhd-options-dataset-fixed.py --historical AAPL --start 2024-01-01 --end 2024-12-31

  # JSON only
  python3 build-eodhd-options-dataset-fixed.py --format json

  # Test with 5 tickers
  python3 build-eodhd-options-dataset-fixed.py --tickers AAPL MSFT GOOGL AMZN TSLA
        """
    )

    parser.add_argument('--tickers', nargs='+', help='List of ticker symbols')
    parser.add_argument('--format', choices=['json', 'csv', 'both'], default='both',
                        help='Output format (default: both)')
    parser.add_argument('--historical', help='Build historical dataset for this ticker')
    parser.add_argument('--start', help='Start date for historical data (YYYY-MM-DD)')
    parser.add_argument('--end', help='End date for historical data (YYYY-MM-DD)')

    args = parser.parse_args()

    builder = EODHDOptionsDatasetBuilder()

    if args.historical:
        if not args.start or not args.end:
            print("❌ Error: --start and --end are required for historical data")
            return
        builder.build_historical_dataset(args.historical, args.start, args.end)
    else:
        builder.build_dataset(tickers=args.tickers, format=args.format)


if __name__ == '__main__':
    main()
