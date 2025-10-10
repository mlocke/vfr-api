import requests
import pandas as pd
import time
import os
from typing import List, Dict
from datetime import datetime

# Use environment variable for API key
API_KEY = os.getenv('POLYGON_API_KEY')
if not API_KEY:
    raise ValueError("POLYGON_API_KEY environment variable is required")

ARTICLES_PER_PAGE = 100
DELAY_SECONDS = 1.5

def get_news_for_ticker_daterange(ticker: str, start_date: str, end_date: str, max_pages: int = 5) -> List[Dict]:
    base_url = "https://api.polygon.io/v2/reference/news"

    all_articles = []
    next_url = None
    page_count = 0

    print(f"📰 Fetching news for {ticker}...")
    print(f"   Date range: {start_date} to {end_date}")

    while True:
        page_count += 1

        # Use next_url if available, otherwise build initial request
        if next_url:
            separator = '&' if '?' in next_url else '?'
            url = f"{next_url}{separator}apiKey={API_KEY}"
            print(f"   📄 Page {page_count}: Using next_url cursor...")
        else:
            params = {
                'ticker': ticker,
                'published_utc.gte': start_date,
                'published_utc.lte': end_date,
                'order': 'desc',  # Most recent first
                'limit': ARTICLES_PER_PAGE,
                'apiKey': API_KEY,
            }
            url = f"{base_url}?{requests.compat.urlencode(params)}"
            print(f"   📄 Page {page_count}: Initial request...")

        try:
            response = requests.get(url, timeout=30)

            if response.status_code == 429:
                print(f"   ⚠️  Rate limited, waiting 60s...")
                time.sleep(60)
                continue

            if response.status_code != 200:
                print(f"   ❌ Error: HTTP {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                break

            data = response.json()

            # Check for error in response
            if data.get('status') == 'ERROR':
                print(f"   ❌ API Error: {data.get('message', 'Unknown error')}")
                break

            articles = data.get('results', [])
            if not articles:
                print(f"   ℹ️  No more articles found")
                break

            # Sample first article for inspection
            if page_count == 1 and articles:
                print(f"\n   📋 Sample article:")
                sample = articles[0]
                print(f"      Title: {sample.get('title', 'N/A')[:70]}...")
                print(f"      Published: {sample.get('published_utc', 'N/A')}")
                print(f"      Publisher: {sample.get('publisher', {}).get('name', 'N/A')}")
                print()

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

            print(f"   ✅ Page {page_count}: Retrieved {len(articles)} articles (total: {len(all_articles)})")

            # Get next_url for pagination
            next_url = data.get('next_url')
            if not next_url:
                print(f"   ℹ️  No next_url, pagination complete")
                break

            # Rate limiting delay
            time.sleep(DELAY_SECONDS)

            # Limit pages for testing
            if page_count >= max_pages:
                print(f"   ℹ️  Stopping at page {page_count} (max pages limit)")
                break

        except requests.exceptions.Timeout:
            print(f"   ⚠️  Timeout, skipping...")
            break
        except Exception as e:
            print(f"   ❌ Unexpected error: {e}")
            break

    return all_articles

if __name__ == '__main__':
    print("🚀 Polygon News API Test - 2025 Data")
    print(f"API Key: {'✅ Set' if API_KEY else '❌ Missing'}")
    print(f"Current date: {datetime.now().strftime('%Y-%m-%d')}")
    print()

    # Test with TSLA for Jan-Sep 2025
    ticker = 'TSLA'
    start_date = '2025-01-01'
    end_date = '2025-09-30'

    articles = get_news_for_ticker_daterange(ticker, start_date, end_date, max_pages=10)

    print(f"\n{'='*60}")
    print(f"📊 Results Summary")
    print(f"{'='*60}")
    print(f"Total articles: {len(articles)}")

    if articles:
        df = pd.DataFrame(articles)

        # Parse dates
        df['date'] = pd.to_datetime(df['published_utc'])

        print(f"Unique publishers: {df['publisher'].nunique()}")
        print(f"Date range: {df['published_utc'].min()} to {df['published_utc'].max()}")

        # Monthly breakdown
        print(f"\n📅 Monthly breakdown:")
        monthly = df.groupby(df['date'].dt.to_period('M')).size()
        print(monthly)

        print(f"\n📰 Top publishers:")
        print(df['publisher'].value_counts().head(10))

        # Sample recent headlines
        print(f"\n📋 Sample recent headlines (last 5):")
        for idx, row in df.head(5).iterrows():
            print(f"\n  [{row['published_utc'][:10]}] {row['publisher']}")
            print(f"  {row['title'][:80]}...")

        # Save to CSV
        output_file = f"data/training/test_polygon_news_{ticker}_2025_jan-sep.csv"
        os.makedirs("data/training", exist_ok=True)
        df.to_csv(output_file, index=False)
        print(f"\n✅ Saved to: {output_file}")
    else:
        print("❌ No articles retrieved - likely no data available for this date range")

    print("\n✨ Test complete!")
