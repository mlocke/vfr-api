import requests
import pandas as pd
import time
import os
from typing import List, Dict

# Use environment variable for API key
API_KEY = os.getenv('POLYGON_API_KEY')
if not API_KEY:
    raise ValueError("POLYGON_API_KEY environment variable is required")

YEARS = [2025]  # Only 2025 data
ARTICLES_PER_PAGE = 1000  # Polygon max is 1000
DELAY_SECONDS = 12.5  # Safe for free tier (5 calls/min = 12s between calls)

# Top 20 stocks by market cap (mix of S&P 500 and NASDAQ)
TOP_20_STOCKS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',
    'META', 'TSLA', 'BRK.B', 'LLY', 'AVGO',
    'JPM', 'V', 'WMT', 'UNH', 'XOM',
    'MA', 'JNJ', 'PG', 'ORCL', 'HD'
]

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

            # Get next_url for pagination
            next_url = data.get('next_url')
            if not next_url:
                break

            # Rate limiting delay
            time.sleep(DELAY_SECONDS)

        except requests.exceptions.Timeout:
            print(f"⚠️  Timeout for {ticker} {year}, skipping...")
            break
        except Exception as e:
            print(f"❌ Unexpected error for {ticker} {year}: {e}")
            break

    return all_articles

def save_news_to_csv():
    # Create output directory
    output_dir = "data/training"
    os.makedirs(output_dir, exist_ok=True)

    tickers = TOP_20_STOCKS
    print(f"\n📊 Starting news collection for {len(tickers)} tickers (Top 20 stocks)")
    print(f"⏱️  Estimated time: ~{len(tickers) * 10 * DELAY_SECONDS / 3600:.1f} hours (assuming 10 pages avg)")

    for year in YEARS:
        print(f"\n{'='*60}")
        print(f"Year: {year}")
        print(f"{'='*60}")

        all_data = []

        for i, ticker in enumerate(tickers, 1):
            print(f"\n[{i}/{len(tickers)}] Fetching {ticker} {year}...")
            articles = get_news_for_ticker_year(ticker, year)
            all_data.extend(articles)

            print(f"   ✅ {ticker}: {len(articles)} articles collected")

            # Save checkpoint every 5 tickers
            if i % 5 == 0:
                checkpoint_df = pd.DataFrame(all_data)
                checkpoint_file = f"{output_dir}/polygon_news_{year}_top20_checkpoint_{i}.csv"
                checkpoint_df.to_csv(checkpoint_file, index=False)
                print(f"\n💾 Checkpoint saved: {checkpoint_file} ({len(all_data)} articles)")
                print(f"   Progress: {i}/{len(tickers)} tickers ({i/len(tickers)*100:.1f}%)")
                print(f"   Unique tickers in dataset: {checkpoint_df['ticker'].nunique()}")
                print(f"   Unique publishers: {checkpoint_df['publisher'].nunique()}")

        # Save final file for this year
        df = pd.DataFrame(all_data)
        file_name = f"{output_dir}/polygon_news_{year}_top20.csv"
        df.to_csv(file_name, index=False)

        print(f"\n{'='*60}")
        print(f"✅ FINAL DATASET SAVED")
        print(f"{'='*60}")
        print(f"File: {file_name}")
        print(f"Total articles: {len(df)}")
        print(f"Unique tickers: {df['ticker'].nunique()}")
        print(f"Unique publishers: {df['publisher'].nunique()}")
        print(f"Date range: {df['published_utc'].min()} to {df['published_utc'].max()}")

if __name__ == '__main__':
    import sys

    print("🚀 Polygon News Scraper - Top 20 Stocks")
    print(f"API Key: {'✅ Set' if API_KEY else '❌ Missing'}")
    print(f"Rate limit: {DELAY_SECONDS}s between requests")
    print(f"Years: {YEARS}")
    print(f"Stocks: {', '.join(TOP_20_STOCKS)}")

    # Confirm before starting
    print("\n⚠️  This will take approximately 45 minutes to 1 hour.")
    print("Press Ctrl+C within 5 seconds to cancel...")

    try:
        time.sleep(5)
    except KeyboardInterrupt:
        print("\n❌ Cancelled by user")
        sys.exit(0)

    print("\n▶️  Starting data collection...")

    save_news_to_csv()

    print("\n✨ Done!")
