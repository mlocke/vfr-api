import requests
import pandas as pd
import time
import os
from typing import List, Dict

# Use environment variable for API key
API_KEY = os.getenv('POLYGON_API_KEY')
if not API_KEY:
    raise ValueError("POLYGON_API_KEY environment variable is required")

ARTICLES_PER_PAGE = 100  # Smaller for testing
DELAY_SECONDS = 1.5  # Faster for testing

def get_news_for_ticker_year(ticker: str, year: int) -> List[Dict]:
    start_date = f'{year}-01-01'
    end_date = f'{year}-12-31'
    base_url = "https://api.polygon.io/v2/reference/news"

    all_articles = []
    next_url = None
    page_count = 0

    print(f"📰 Fetching news for {ticker} in {year}...")
    print(f"   Date range: {start_date} to {end_date}")

    while True:
        page_count += 1

        # Use next_url if available, otherwise build initial request
        if next_url:
            # Polygon's next_url doesn't include API key, so append it
            separator = '&' if '?' in next_url else '?'
            url = f"{next_url}{separator}apiKey={API_KEY}"
            print(f"   📄 Page {page_count}: Using next_url cursor...")
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
                print(f"      Title: {sample.get('title', 'N/A')[:60]}...")
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

            # Limit to 3 pages for testing
            if page_count >= 3:
                print(f"   ℹ️  Stopping at page {page_count} for testing")
                break

        except requests.exceptions.Timeout:
            print(f"   ⚠️  Timeout, skipping...")
            break
        except Exception as e:
            print(f"   ❌ Unexpected error: {e}")
            break

    return all_articles

if __name__ == '__main__':
    print("🚀 Polygon News API Test")
    print(f"API Key: {'✅ Set' if API_KEY else '❌ Missing'}")
    print()

    # Test with TSLA for 2024
    ticker = 'TSLA'
    year = 2024

    articles = get_news_for_ticker_year(ticker, year)

    print(f"\n{'='*60}")
    print(f"📊 Results Summary")
    print(f"{'='*60}")
    print(f"Total articles: {len(articles)}")

    if articles:
        df = pd.DataFrame(articles)
        print(f"Unique publishers: {df['publisher'].nunique()}")
        print(f"Date range: {df['published_utc'].min()} to {df['published_utc'].max()}")
        print(f"\nTop 5 publishers:")
        print(df['publisher'].value_counts().head())

        # Save to CSV
        output_file = f"data/training/test_polygon_news_{ticker}_{year}.csv"
        os.makedirs("data/training", exist_ok=True)
        df.to_csv(output_file, index=False)
        print(f"\n✅ Saved to: {output_file}")
    else:
        print("❌ No articles retrieved")

    print("\n✨ Test complete!")
