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

# Top 20 already collected - EXCLUDE these
ALREADY_COLLECTED = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',
    'META', 'TSLA', 'BRK.B', 'LLY', 'AVGO',
    'JPM', 'V', 'WMT', 'UNH', 'XOM',
    'MA', 'JNJ', 'PG', 'ORCL', 'HD'
]

# Full S&P 500 top 100
TOP_SP500 = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'LLY', 'AVGO',
    'JPM', 'V', 'WMT', 'UNH', 'XOM', 'MA', 'JNJ', 'PG', 'ORCL', 'HD',
    'COST', 'ABBV', 'NFLX', 'BAC', 'CVX', 'MRK', 'CRM', 'KO', 'AMD', 'ADBE',
    'PEP', 'TMO', 'CSCO', 'ACN', 'LIN', 'MCD', 'ABT', 'WFC', 'PM', 'INTU',
    'DIS', 'CMCSA', 'NKE', 'VZ', 'DHR', 'TXN', 'UNP', 'AMGN', 'QCOM', 'NEE',
    'IBM', 'SPGI', 'RTX', 'HON', 'COP', 'GE', 'LOW', 'AMAT', 'CAT', 'UPS',
    'PFE', 'SCHW', 'ELV', 'SBUX', 'BA', 'AXP', 'DE', 'BKNG', 'GILD', 'ADI',
    'BLK', 'MDLZ', 'LMT', 'TJX', 'SYK', 'ISRG', 'ADP', 'VRTX', 'PLD', 'MMC',
    'C', 'CVS', 'REGN', 'TMUS', 'MO', 'BX', 'ZTS', 'ETN', 'CB', 'NOW',
    'DUK', 'SO', 'LRCX', 'PGR', 'GS', 'KLAC', 'CI', 'EQIX', 'SLB', 'FI'
]

# Full NASDAQ top 100
TOP_NASDAQ = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'COST', 'NFLX',
    'AMD', 'ADBE', 'PEP', 'CSCO', 'CMCSA', 'INTU', 'QCOM', 'TXN', 'AMGN', 'HON',
    'AMAT', 'SBUX', 'BKNG', 'GILD', 'ADI', 'ISRG', 'VRTX', 'REGN', 'LRCX', 'KLAC',
    'ADP', 'MDLZ', 'MELI', 'PANW', 'SNPS', 'PYPL', 'MAR', 'CDNS', 'ABNB', 'ORLY',
    'CRWD', 'ASML', 'WDAY', 'FTNT', 'MNST', 'CSX', 'CHTR', 'ADSK', 'NXPI', 'CTAS',
    'MRVL', 'AZN', 'CPRT', 'PCAR', 'DXCM', 'ROST', 'PAYX', 'MCHP', 'ODFL', 'KDP',
    'TTD', 'MRNA', 'KHC', 'IDXX', 'BKR', 'TEAM', 'AEP', 'FAST', 'VRSK', 'EA',
    'CTSH', 'GEHC', 'DDOG', 'LULU', 'ANSS', 'ON', 'BIIB', 'CCEP', 'XEL', 'EXC',
    'ZS', 'CSGP', 'WBD', 'FANG', 'CDW', 'GFS', 'TTWO', 'DLTR', 'ILMN', 'MDB',
    'WBA', 'EBAY', 'ZM', 'ENPH', 'SIRI', 'ALGN', 'LCID', 'RIVN', 'DOCU', 'SGEN'
]

def get_remaining_tickers():
    """Get combined list excluding already collected top 20"""
    # Combine and deduplicate
    combined = list(dict.fromkeys(TOP_SP500 + TOP_NASDAQ))

    # Remove already collected
    remaining = [t for t in combined if t not in ALREADY_COLLECTED]

    print(f"✅ Remaining tickers to collect: {len(remaining)}")
    print(f"   Total unique tickers: {len(combined)}")
    print(f"   Already collected: {len(ALREADY_COLLECTED)}")
    print(f"   Remaining: {len(remaining)}")
    return remaining

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

            next_url = data.get('next_url')
            if not next_url:
                break

            time.sleep(DELAY_SECONDS)

        except requests.exceptions.Timeout:
            print(f"⚠️  Timeout for {ticker} {year}, skipping...")
            break
        except Exception as e:
            print(f"❌ Unexpected error for {ticker} {year}: {e}")
            break

    return all_articles

def save_news_to_csv():
    output_dir = "data/training"
    os.makedirs(output_dir, exist_ok=True)

    tickers = get_remaining_tickers()
    print(f"\n📊 Starting news collection for {len(tickers)} remaining tickers")
    print(f"⏱️  Estimated time: ~{len(tickers) * 5 * DELAY_SECONDS / 3600:.1f} hours")

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

            # Save checkpoint every 10 tickers
            if i % 10 == 0:
                checkpoint_df = pd.DataFrame(all_data)
                checkpoint_file = f"{output_dir}/polygon_news_{year}_remaining_checkpoint_{i}.csv"
                checkpoint_df.to_csv(checkpoint_file, index=False)
                print(f"\n💾 Checkpoint saved: {checkpoint_file} ({len(all_data)} articles)")
                print(f"   Progress: {i}/{len(tickers)} tickers ({i/len(tickers)*100:.1f}%)")
                print(f"   Unique tickers: {checkpoint_df['ticker'].nunique()}")

        # Save final file
        df = pd.DataFrame(all_data)
        file_name = f"{output_dir}/polygon_news_{year}_remaining.csv"
        df.to_csv(file_name, index=False)

        print(f"\n{'='*60}")
        print(f"✅ REMAINING DATASET SAVED")
        print(f"{'='*60}")
        print(f"File: {file_name}")
        print(f"Total articles: {len(df)}")
        print(f"Unique tickers: {df['ticker'].nunique()}")

        # Now combine with top 20
        print(f"\n{'='*60}")
        print(f"🔄 COMBINING WITH TOP 20 DATASET")
        print(f"{'='*60}")

        top20_file = f"{output_dir}/polygon_news_{year}_top20.csv"
        if os.path.exists(top20_file):
            top20_df = pd.read_csv(top20_file)
            print(f"✅ Loaded top 20 dataset: {len(top20_df)} articles")

            combined_df = pd.concat([top20_df, df], ignore_index=True)
            combined_file = f"{output_dir}/polygon_news_{year}_complete.csv"
            combined_df.to_csv(combined_file, index=False)

            print(f"\n{'='*60}")
            print(f"✅ COMPLETE COMBINED DATASET")
            print(f"{'='*60}")
            print(f"File: {combined_file}")
            print(f"Total articles: {len(combined_df):,}")
            print(f"Unique tickers: {combined_df['ticker'].nunique()}")
            print(f"Unique publishers: {combined_df['publisher'].nunique()}")
            print(f"Date range: {combined_df['published_utc'].min()} to {combined_df['published_utc'].max()}")
        else:
            print(f"⚠️  Top 20 file not found: {top20_file}")

if __name__ == '__main__':
    print("🚀 Polygon News Scraper - Remaining 145 Stocks")
    print(f"API Key: {'✅ Set' if API_KEY else '❌ Missing'}")
    print(f"Rate limit: {DELAY_SECONDS}s between requests")
    print(f"Years: {YEARS}")
    print()

    save_news_to_csv()

    print("\n✨ Done!")
