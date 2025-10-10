import requests
import pandas as pd
import time
import random

API_KEY = 'YOUR_POLYGON_API_KEY'  # 🔁 Replace this
YEARS = [2022, 2023, 2024]
ARTICLES_PER_PAGE = 100
DELAY_SECONDS = 1.5

# ---------------------
# Fetch S&P 500 and NASDAQ-100 tickers
# ---------------------
def get_dynamic_tickers():
    sp500_url = "https://datahub.io/core/s-and-p-500-companies/r/constituents.csv"
    nasdaq_url = "https://pkgstore.datahub.io/core/nasdaq-listings/nasdaq-listed_csv/data/cb7b0c0cd9de92d3f7b7c77b2cceecec/nasdaq-listed_csv.csv"

    sp500_df = pd.read_csv(sp500_url)
    nasdaq_df = pd.read_csv(nasdaq_url)

    sp500_tickers = sp500_df['Symbol'].dropna().unique().tolist()
    nasdaq_tickers = nasdaq_df['Symbol'].dropna().unique().tolist()

    # Sample a mix
    random.seed(42)
    sampled_sp500 = random.sample(sp500_tickers, 50)
    sampled_nasdaq = random.sample(nasdaq_tickers, 50)

    combined = list(set(sampled_sp500 + sampled_nasdaq))
    print(f"Using {len(combined)} tickers dynamically fetched.")
    return combined

# ---------------------
# Pull Polygon.io news
# ---------------------
def get_news_for_ticker_year(ticker, year):
    start_date = f'{year}-01-01'
    end_date = f'{year}-12-31'
    url = f"https://api.polygon.io/v2/reference/news"

    all_articles = []
    page = 1
    while True:
        params = {
            'ticker': ticker,
            'published_utc.gte': start_date,
            'published_utc.lte': end_date,
            'order': 'asc',
            'limit': ARTICLES_PER_PAGE,
            'apiKey': API_KEY,
            'page': page
        }
        response = requests.get(url, params=params)
        if response.status_code != 200:
            print(f"❌ Error: {response.status_code} for {ticker} {year}")
            break

        data = response.json()
        articles = data.get('results', [])
        if not articles:
            break

        for article in articles:
            all_articles.append({
                'ticker': ticker,
                'published_utc': article.get('published_utc'),
                'title': article.get('title'),
                'summary': article.get('summary'),
                'article_url': article.get('article_url'),
                'sentiment': article.get('sentiment', {}).get('score')  # Optional
            })

        print(f"{ticker} {year}: Retrieved {len(articles)} articles (page {page})")
        page += 1
        time.sleep(DELAY_SECONDS)

    return all_articles

# ---------------------
# Main run logic
# ---------------------
def save_news_to_csv():
    tickers = get_dynamic_tickers()
    for year in YEARS:
        all_data = []
        for ticker in tickers:
            articles = get_news_for_ticker_year(ticker, year)
            all_data.extend(articles)

        df = pd.DataFrame(all_data)
        file_name = f"polygon_news_{year}.csv"
        df.to_csv(file_name, index=False)
        print(f"✅ Saved {len(df)} articles to {file_name}")

if __name__ == '__main__':
    save_news_to_csv()
