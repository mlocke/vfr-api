import requests
import pandas as pd
import time
import random
import os
from typing import List, Dict

# Use environment variable for API key
API_KEY = os.getenv('POLYGON_API_KEY')
if not API_KEY:
    raise ValueError("POLYGON_API_KEY environment variable is required")

YEARS = [2025]  # Only 2025 data
ARTICLES_PER_PAGE = 1000  # Polygon max is 1000
DELAY_SECONDS = 12.5  # Safe for free tier (5 calls/min = 12s between calls)

# ---------------------
# Hardcoded ticker list (same 160 stocks from 2024 dataset)
# ---------------------
def get_dynamic_tickers():
    """Returns the same 160 tickers used in 2024 dataset."""
    tickers = [
        'AAPL', 'ABBV', 'ABNB', 'ABT', 'ACN', 'ADBE', 'ADI', 'ADP', 'ADSK', 'AEP',
        'AMAT', 'AMD', 'AMGN', 'AMZN', 'ANSS', 'ASML', 'AVGO', 'AXP', 'AZN', 'BA',
        'BAC', 'BIIB', 'BKNG', 'BKR', 'BLK', 'BRK.B', 'BX', 'C', 'CAT', 'CB',
        'CCEP', 'CDNS', 'CDW', 'CHTR', 'CI', 'CMCSA', 'COP', 'COST', 'CPRT', 'CRM',
        'CRWD', 'CSCO', 'CSGP', 'CSX', 'CTAS', 'CTSH', 'CVS', 'CVX', 'DDOG', 'DE',
        'DHR', 'DIS', 'DLTR', 'DUK', 'DXCM', 'EA', 'EBAY', 'ELV', 'EQIX', 'ETN',
        'EXC', 'FANG', 'FAST', 'FI', 'FTNT', 'GE', 'GEHC', 'GFS', 'GILD', 'GOOGL',
        'GS', 'HD', 'HON', 'IBM', 'IDXX', 'ILMN', 'INTU', 'ISRG', 'JNJ', 'JPM',
        'KDP', 'KHC', 'KLAC', 'KO', 'LIN', 'LLY', 'LMT', 'LOW', 'LRCX', 'LULU',
        'MA', 'MAR', 'MCD', 'MCHP', 'MDB', 'MDLZ', 'MELI', 'META', 'MMC', 'MNST',
        'MO', 'MRK', 'MRNA', 'MRVL', 'MSFT', 'NEE', 'NFLX', 'NKE', 'NOW', 'NVDA',
        'NXPI', 'ODFL', 'ON', 'ORCL', 'ORLY', 'PANW', 'PAYX', 'PCAR', 'PEP', 'PFE',
        'PG', 'PGR', 'PLD', 'PM', 'PYPL', 'QCOM', 'REGN', 'ROST', 'RTX', 'SBUX',
        'SCHW', 'SLB', 'SNPS', 'SO', 'SPGI', 'SYK', 'TEAM', 'TJX', 'TMO', 'TMUS',
        'TSLA', 'TTD', 'TTWO', 'TXN', 'UNH', 'UNP', 'UPS', 'V', 'VRSK', 'VRTX',
        'VZ', 'WBA', 'WBD', 'WDAY', 'WFC', 'WMT', 'XEL', 'XOM', 'ZS', 'ZTS',
    ]
    print(f"✅ Using {len(tickers)} hardcoded tickers (same as 2024 dataset)")
    return tickers

# ---------------------
# Pull Polygon.io news (FIXED PAGINATION)
# ---------------------
def get_news_for_ticker_year(ticker: str, year: int) -> List[Dict]:
    start_date = f'{year}-01-01'
    end_date = f'{year}-12-31'
    base_url = "https://api.polygon.io/v2/reference/news"

    all_articles = []
    next_url = None
    page_count = 0

    while True:
        page_count += 1

        # Use next_url if available, otherwise build initial request
        if next_url:
            # Polygon's next_url doesn't include API key, so append it
            separator = '&' if '?' in next_url else '?'
            url = f"{next_url}{separator}apiKey={API_KEY}"
        else:
            params = {
                'ticker': ticker,
                'published_utc.gte': start_date,
                'published_utc.lte': end_date,
                'order': 'asc',
                'limit': ARTICLES_PER_PAGE,
                'apiKey': API_KEY,
            }
            url = f"{base_url}?{requests.compat.urlencode(params)}"

        try:
            response = requests.get(url, timeout=30)

            if response.status_code == 429:
                print(f"⚠️  Rate limited for {ticker} {year}, waiting 60s...")
                time.sleep(60)
                continue

            if response.status_code != 200:
                print(f"❌ Error: {response.status_code} for {ticker} {year}")
                break

            data = response.json()

            # Check for error in response
            if data.get('status') == 'ERROR':
                print(f"❌ API Error for {ticker} {year}: {data.get('message', 'Unknown error')}")
                break

            articles = data.get('results', [])
            if not articles:
                break

            for article in articles:
                all_articles.append({
                    'ticker': ticker,
                    'published_utc': article.get('published_utc'),
                    'title': article.get('title'),
                    'description': article.get('description'),
                    'article_url': article.get('article_url'),
                    'publisher': article.get('publisher', {}).get('name'),
                    'image_url': article.get('image_url'),
                })

            print(f"  {ticker} {year}: Retrieved {len(articles)} articles (page {page_count}, total: {len(all_articles)})")

            # Get next_url for pagination (CORRECT APPROACH)
            next_url = data.get('next_url')
            if not next_url:
                break  # No more pages

            # Rate limiting delay
            time.sleep(DELAY_SECONDS)

        except requests.exceptions.Timeout:
            print(f"⚠️  Timeout for {ticker} {year}, skipping...")
            break
        except Exception as e:
            print(f"❌ Unexpected error for {ticker} {year}: {e}")
            break

    return all_articles

# ---------------------
# Main run logic
# ---------------------
def save_news_to_csv():
    # Create output directory
    output_dir = "data/training"
    os.makedirs(output_dir, exist_ok=True)

    tickers = get_dynamic_tickers()
    print(f"📊 Starting news collection for {len(tickers)} tickers across {len(YEARS)} years")

    for year in YEARS:
        print(f"\n{'='*60}")
        print(f"Year: {year}")
        print(f"{'='*60}")

        all_data = []

        for i, ticker in enumerate(tickers, 1):
            print(f"[{i}/{len(tickers)}] Fetching {ticker} {year}...")
            articles = get_news_for_ticker_year(ticker, year)
            all_data.extend(articles)

            # Save checkpoint every 10 tickers
            if i % 10 == 0:
                checkpoint_df = pd.DataFrame(all_data)
                checkpoint_file = f"{output_dir}/polygon_news_{year}_checkpoint_{i}.csv"
                checkpoint_df.to_csv(checkpoint_file, index=False)
                print(f"💾 Checkpoint saved: {checkpoint_file} ({len(all_data)} articles)")

        # Save final file for this year
        df = pd.DataFrame(all_data)
        file_name = f"{output_dir}/polygon_news_{year}.csv"
        df.to_csv(file_name, index=False)
        print(f"\n✅ Saved {len(df)} articles to {file_name}")
        print(f"   Unique tickers: {df['ticker'].nunique() if len(df) > 0 else 0}")

if __name__ == '__main__':
    print("🚀 Polygon News Scraper")
    print(f"API Key: {'✅ Set' if API_KEY else '❌ Missing'}")
    print(f"Rate limit: {DELAY_SECONDS}s between requests")
    print(f"Years: {YEARS}")
    print()

    save_news_to_csv()

    print("\n✨ Done!")
