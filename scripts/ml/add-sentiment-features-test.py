#!/usr/bin/env python3
"""
Add News Sentiment Features (TEST VERSION - OPTIMIZED WITH CACHING)
====================================================================

Processes only first 1000 rows to validate caching optimization.
Uses the same caching strategy as the full script.

Performance:
- Old approach: ~100 API calls, ~1 hour
- New approach: ~3-10 API calls (unique symbols), ~5 minutes

Usage:
    python3 scripts/ml/add-sentiment-features-test.py
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import requests
import os
import sys
import json
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import time
import statistics

class NewsSentimentScorer:
    """Score news sentiment using pre-trained FinBERT"""

    def __init__(self):
        print("📦 Loading pre-trained FinBERT model...")
        self.tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
        self.model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
        self.model.eval()
        print("✓ Model loaded\n")

    def score_text(self, text: str) -> dict:
        """Score a single text"""
        if not text or not text.strip():
            return {'score': 0.0, 'confidence': 0.0, 'label': 'neutral'}

        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=512, padding=True)

        with torch.no_grad():
            outputs = self.model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=-1)

        probs = probabilities[0].tolist()
        negative, neutral, positive = probs
        score = positive - negative

        return {'score': round(score, 4), 'confidence': round(max(probs), 4)}

class PolygonNewsClient:
    """Fetch news from Polygon.io API with disk-based caching"""

    def __init__(self, cache_dir: str = "data/cache/news"):
        self.api_key = os.getenv('POLYGON_API_KEY')
        if not self.api_key:
            raise ValueError("POLYGON_API_KEY not found")
        self.base_url = "https://api.polygon.io"
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def _get_cache_path(self, symbol: str, start_date: str, end_date: str) -> str:
        return os.path.join(self.cache_dir, f"{symbol}_{start_date}_{end_date}.json")

    def get_all_news_for_symbol(self, symbol: str, start_date: str, end_date: str) -> list:
        """Fetch ALL news for symbol's date range (with caching)"""
        cache_path = self._get_cache_path(symbol, start_date, end_date)

        # Check disk cache
        if os.path.exists(cache_path):
            print(f"   ✅ Cache HIT: {symbol}")
            with open(cache_path, 'r') as f:
                return json.load(f)

        # Cache miss - fetch from API
        print(f"   ❌ Cache MISS: {symbol} - Fetching from API...")
        url = f"{self.base_url}/v2/reference/news"
        params = {
            'ticker': symbol,
            'published_utc.gte': start_date,
            'published_utc.lte': end_date,
            'limit': 1000,
            'apiKey': self.api_key
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            articles = data.get('results', [])

            # Save to cache
            with open(cache_path, 'w') as f:
                json.dump(articles, f)

            print(f"      📦 Cached {len(articles)} articles")
            time.sleep(0.5)  # Rate limiting
            return articles
        except Exception as e:
            print(f"      ⚠️  Error: {e}")
            return []

    def get_news_for_date(self, symbol: str, target_date: datetime, all_news: list, days_back: int = 30) -> list:
        """Filter cached news to specific date window"""
        end_date = target_date
        start_date = end_date - timedelta(days=days_back)

        filtered = []
        for article in all_news:
            try:
                pub_date = datetime.fromisoformat(article['published_utc'].replace('Z', '+00:00'))
                pub_date = pub_date.replace(tzinfo=None)
                if start_date <= pub_date <= end_date:
                    filtered.append(article)
            except:
                continue

        return filtered

def calculate_features(scored_articles: list, target_date: datetime) -> dict:
    """Calculate 5 sentiment features"""
    if not scored_articles:
        return {
            'news_sentiment_24h': 0.0,
            'news_sentiment_7d': 0.0,
            'news_sentiment_30d': 0.0,
            'news_sentiment_momentum': 0.0,
            'news_volume_24h': 0
        }

    # Parse dates
    for article in scored_articles:
        try:
            article['datetime'] = datetime.fromisoformat(article['published'].replace('Z', '+00:00'))
            article['hours_ago'] = (target_date - article['datetime'].replace(tzinfo=None)).total_seconds() / 3600
        except:
            article['hours_ago'] = 999

    # Filter by time
    articles_24h = [a for a in scored_articles if 0 <= a['hours_ago'] <= 24]
    articles_7d = [a for a in scored_articles if 0 <= a['hours_ago'] <= 168]
    articles_30d = [a for a in scored_articles if 0 <= a['hours_ago'] <= 720]

    # Averages
    avg = lambda arts: statistics.mean([a['score'] for a in arts]) if arts else 0.0

    sentiment_24h = avg(articles_24h)
    sentiment_7d = avg(articles_7d)
    sentiment_30d = avg(articles_30d)

    # Momentum
    if len(articles_7d) >= 4:
        mid = len(articles_7d) // 2
        momentum = avg(articles_7d[:mid]) - avg(articles_7d[mid:])
    else:
        momentum = 0.0

    return {
        'news_sentiment_24h': round(sentiment_24h, 4),
        'news_sentiment_7d': round(sentiment_7d, 4),
        'news_sentiment_30d': round(sentiment_30d, 4),
        'news_sentiment_momentum': round(momentum, 4),
        'news_volume_24h': len(articles_24h)
    }

def main():
    print("=" * 80)
    print("ADD SENTIMENT FEATURES (TEST - OPTIMIZED WITH CACHING)")
    print("=" * 80)
    print()

    input_file = "data/training/price-prediction-yf-top100.csv"
    output_file = "data/training/price-prediction-with-sentiment-test.csv"

    # Load dataset
    print(f"📂 Loading dataset: {input_file}")
    df = pd.read_csv(input_file)
    print(f"   Total rows: {len(df)}")

    # Take first 1000 rows only
    df = df.head(1000)
    print(f"   Processing: {len(df)} rows (test sample)")
    print()

    # Get date range
    min_date = df['date'].min()
    max_date = df['date'].max()
    extended_min_date = (datetime.strptime(min_date, '%Y-%m-%d') - timedelta(days=30)).strftime('%Y-%m-%d')

    print(f"📅 Date range: {extended_min_date} to {max_date} (includes 30-day lookback)")
    print()

    # Initialize
    scorer = NewsSentimentScorer()
    news_client = PolygonNewsClient()

    # Get unique symbols
    unique_symbols = df['symbol'].unique()
    print(f"🎯 Processing {len(unique_symbols)} unique symbols")
    print()

    # STEP 1: Fetch & cache news (ONCE per symbol)
    print("=" * 80)
    print("STEP 1: FETCH & CACHE NEWS")
    print("=" * 80)
    print()

    symbol_news_cache = {}
    for idx, symbol in enumerate(unique_symbols, 1):
        print(f"[{idx}/{len(unique_symbols)}] {symbol}...")
        all_news = news_client.get_all_news_for_symbol(symbol, extended_min_date, max_date)
        symbol_news_cache[symbol] = all_news

    print()
    print(f"✅ News fetching complete! Cached {len(symbol_news_cache)} symbols")
    print()

    # STEP 2: Calculate features using cached news
    print("=" * 80)
    print("STEP 2: CALCULATE SENTIMENT FEATURES")
    print("=" * 80)
    print()

    unique_pairs = df[['symbol', 'date']].drop_duplicates()
    print(f"📊 Processing {len(unique_pairs)} unique (symbol, date) pairs")
    print()

    sentiment_cache = {}

    for idx, (_, row) in enumerate(unique_pairs.iterrows()):
        symbol = row['symbol']
        date_str = row['date']
        target_date = datetime.strptime(date_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
        cache_key = f"{symbol}_{date_str}"

        if (idx + 1) % 20 == 0:
            print(f"   [{idx+1}/{len(unique_pairs)}] {symbol} @ {date_str}...")

        # Get cached news
        all_news = symbol_news_cache.get(symbol, [])
        articles = news_client.get_news_for_date(symbol, target_date, all_news, days_back=30)

        if not articles:
            sentiment_cache[cache_key] = {
                'news_sentiment_24h': 0.0,
                'news_sentiment_7d': 0.0,
                'news_sentiment_30d': 0.0,
                'news_sentiment_momentum': 0.0,
                'news_volume_24h': 0
            }
            continue

        # Score articles
        scored = []
        for article in articles[:10]:  # Limit to 10 for speed
            text = article.get('title', '')
            if article.get('description'):
                text += ". " + article['description']
            sentiment = scorer.score_text(text)
            scored.append({**sentiment, 'published': article['published_utc']})

        # Calculate features
        features = calculate_features(scored, target_date)
        sentiment_cache[cache_key] = features

    print()
    print("✅ Sentiment feature calculation complete")
    print()

    # Add to dataframe
    print("📝 Adding features...")
    df['news_sentiment_24h'] = df.apply(lambda row: sentiment_cache.get(f"{row['symbol']}_{row['date']}", {}).get('news_sentiment_24h', 0.0), axis=1)
    df['news_sentiment_7d'] = df.apply(lambda row: sentiment_cache.get(f"{row['symbol']}_{row['date']}", {}).get('news_sentiment_7d', 0.0), axis=1)
    df['news_sentiment_30d'] = df.apply(lambda row: sentiment_cache.get(f"{row['symbol']}_{row['date']}", {}).get('news_sentiment_30d', 0.0), axis=1)
    df['news_sentiment_momentum'] = df.apply(lambda row: sentiment_cache.get(f"{row['symbol']}_{row['date']}", {}).get('news_sentiment_momentum', 0.0), axis=1)
    df['news_volume_24h'] = df.apply(lambda row: sentiment_cache.get(f"{row['symbol']}_{row['date']}", {}).get('news_volume_24h', 0), axis=1)

    # Save
    print(f"💾 Saving: {output_file}")
    df.to_csv(output_file, index=False)
    print(f"   Saved {len(df)} rows, {len(df.columns)} columns")
    print()

    # Stats
    print("=" * 80)
    print("PERFORMANCE STATISTICS")
    print("=" * 80)
    print()
    print(f"Unique symbols:          {len(unique_symbols)}")
    print(f"Unique (symbol, date):   {len(unique_pairs)}")
    print(f"Total rows:              {len(df)}")
    print()
    print("API Call Reduction:")
    old_calls = len(unique_pairs)
    new_calls = len(unique_symbols)
    reduction = ((old_calls - new_calls) / old_calls) * 100
    print(f"  Old approach:  {old_calls} API calls")
    print(f"  New approach:  {new_calls} API calls")
    print(f"  Reduction:     {reduction:.1f}%")
    print()

    print("=" * 80)
    print("SENTIMENT FEATURE STATISTICS")
    print("=" * 80)
    for col in ['news_sentiment_24h', 'news_sentiment_7d', 'news_sentiment_30d', 'news_sentiment_momentum', 'news_volume_24h']:
        print(f"{col:30s} mean={df[col].mean():+.4f}, std={df[col].std():.4f}")
    print()
    print("✅ TEST COMPLETE")
    print()
    print("Cache location: data/cache/news/")
    print("  - Run again to see 100% cache hit rate (0 API calls)")
    print()
    print("If results look good, run full dataset (100 symbols, 2-3 hours):")
    print("  python3 scripts/ml/add-sentiment-features.py")
    print()

if __name__ == "__main__":
    main()
