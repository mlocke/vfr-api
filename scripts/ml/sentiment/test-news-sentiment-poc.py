#!/usr/bin/env python3
"""
News Sentiment Proof of Concept
================================

Purpose: Validate that pre-trained FinBERT can score real Polygon news headlines
and produce meaningful sentiment aggregations.

What this tests:
1. Load pre-trained FinBERT model
2. Score actual news headlines from Polygon API
3. Aggregate into 5 numerical features
4. Show feature values for 5-10 stocks

Expected runtime: 2-3 minutes
Expected outcome: Sentiment scores that make intuitive sense

Usage:
    python3 scripts/ml/sentiment/test-news-sentiment-poc.py
"""

from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import json
import requests
import os
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

class NewsSentimentScorer:
    """Score news sentiment using pre-trained FinBERT"""

    def __init__(self):
        print("📦 Loading pre-trained FinBERT model...")
        self.tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
        self.model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
        self.model.eval()
        print("✓ Model loaded successfully\n")

    def score_text(self, text: str) -> dict:
        """
        Score a single text (headline or summary)

        Returns:
            {
                'score': -1.0 to +1.0 (negative to positive),
                'confidence': 0.0 to 1.0,
                'label': 'positive' | 'negative' | 'neutral'
            }
        """
        # Tokenize and truncate
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=True
        )

        # Get predictions
        with torch.no_grad():
            outputs = self.model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=-1)

        # Extract probabilities
        probs = probabilities[0].tolist()
        negative, neutral, positive = probs

        # Calculate sentiment score (-1 to +1)
        score = positive - negative
        confidence = max(probs)

        # Determine label
        if score > 0.2:
            label = 'positive'
        elif score < -0.2:
            label = 'negative'
        else:
            label = 'neutral'

        return {
            'score': round(score, 3),
            'confidence': round(confidence, 3),
            'label': label,
            'probabilities': {
                'negative': round(negative, 3),
                'neutral': round(neutral, 3),
                'positive': round(positive, 3)
            }
        }

    def score_articles(self, articles: list) -> list:
        """Score multiple articles"""
        results = []
        for article in articles:
            # Combine headline and description for better context
            text = article['title']
            if article.get('description'):
                text += ". " + article['description']

            sentiment = self.score_text(text)
            results.append({
                **sentiment,
                'title': article['title'],
                'published': article['published_utc']
            })

        return results

class PolygonNewsClient:
    """Fetch news from Polygon.io API"""

    def __init__(self):
        self.api_key = os.getenv('POLYGON_API_KEY')
        if not self.api_key:
            raise ValueError("POLYGON_API_KEY not found in environment")
        self.base_url = "https://api.polygon.io"

    def get_news(self, symbol: str, days_back: int = 30) -> list:
        """Fetch news articles for a symbol"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)

        url = f"{self.base_url}/v2/reference/news"
        params = {
            'ticker': symbol,
            'published_utc.gte': start_date.strftime('%Y-%m-%d'),
            'published_utc.lte': end_date.strftime('%Y-%m-%d'),
            'limit': 100,
            'apiKey': self.api_key
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('results', [])
        except Exception as e:
            print(f"⚠️  Error fetching news for {symbol}: {e}")
            return []

class SentimentFeatureAggregator:
    """Aggregate sentiment scores into numerical features"""

    @staticmethod
    def calculate_features(scored_articles: list) -> dict:
        """
        Generate 5 numerical features from scored articles

        Returns:
            {
                'news_sentiment_24h': float,
                'news_sentiment_7d': float,
                'news_sentiment_30d': float,
                'news_sentiment_momentum': float,
                'news_volume_24h': int
            }
        """
        if not scored_articles:
            return {
                'news_sentiment_24h': 0.0,
                'news_sentiment_7d': 0.0,
                'news_sentiment_30d': 0.0,
                'news_sentiment_momentum': 0.0,
                'news_volume_24h': 0
            }

        # Parse dates and sort by time
        now = datetime.now()
        for article in scored_articles:
            article['datetime'] = datetime.fromisoformat(article['published'].replace('Z', '+00:00'))
            article['hours_ago'] = (now - article['datetime'].replace(tzinfo=None)).total_seconds() / 3600

        scored_articles.sort(key=lambda x: x['hours_ago'])

        # Filter by time windows
        articles_24h = [a for a in scored_articles if a['hours_ago'] <= 24]
        articles_7d = [a for a in scored_articles if a['hours_ago'] <= 168]  # 7 days
        articles_30d = scored_articles  # All articles

        # Calculate averages
        def avg_score(articles):
            if not articles:
                return 0.0
            return statistics.mean([a['score'] for a in articles])

        sentiment_24h = avg_score(articles_24h)
        sentiment_7d = avg_score(articles_7d)
        sentiment_30d = avg_score(articles_30d)

        # Calculate momentum (7-day trend)
        # Compare first half vs second half of 7-day window
        if len(articles_7d) >= 4:
            mid_point = len(articles_7d) // 2
            recent_half = articles_7d[:mid_point]  # More recent
            older_half = articles_7d[mid_point:]   # Older

            recent_avg = avg_score(recent_half)
            older_avg = avg_score(older_half)
            momentum = recent_avg - older_avg
        else:
            momentum = 0.0

        return {
            'news_sentiment_24h': round(sentiment_24h, 4),
            'news_sentiment_7d': round(sentiment_7d, 4),
            'news_sentiment_30d': round(sentiment_30d, 4),
            'news_sentiment_momentum': round(momentum, 4),
            'news_volume_24h': len(articles_24h)
        }

def run_proof_of_concept():
    """
    Main POC function

    Tests sentiment scoring on 5-10 stocks and shows:
    1. Individual article scores
    2. Aggregated features
    3. Interpretation
    """
    print("=" * 70)
    print("NEWS SENTIMENT PROOF OF CONCEPT")
    print("=" * 70)
    print()

    # Test stocks (mix of sectors and sentiment profiles)
    test_symbols = ['AAPL', 'TSLA', 'NVDA', 'JPM', 'XOM', 'PFE', 'DIS', 'AMZN']

    # Initialize components
    scorer = NewsSentimentScorer()
    news_client = PolygonNewsClient()
    aggregator = SentimentFeatureAggregator()

    results = {}

    for symbol in test_symbols:
        print(f"📰 Processing {symbol}...")

        # Fetch news
        articles = news_client.get_news(symbol, days_back=30)

        if not articles:
            print(f"   ⚠️  No news found, skipping\n")
            continue

        print(f"   Found {len(articles)} articles")

        # Score articles
        scored = scorer.score_articles(articles)

        # Show sample articles (first 3)
        print(f"\n   Sample Headlines:")
        for i, article in enumerate(scored[:3], 1):
            emoji = "📈" if article['label'] == 'positive' else "📉" if article['label'] == 'negative' else "➡️"
            print(f"   {i}. {emoji} [{article['label'].upper():8s}] {article['score']:+.3f} | {article['title'][:60]}...")

        # Calculate features
        features = aggregator.calculate_features(scored)

        # Store results
        results[symbol] = {
            'article_count': len(articles),
            'features': features,
            'sample_articles': scored[:3]
        }

        # Display features
        print(f"\n   📊 Aggregated Features:")
        print(f"      24h sentiment: {features['news_sentiment_24h']:+.3f}  (last 1 day)")
        print(f"      7d sentiment:  {features['news_sentiment_7d']:+.3f}  (last 7 days)")
        print(f"      30d sentiment: {features['news_sentiment_30d']:+.3f}  (last 30 days)")
        print(f"      Momentum:      {features['news_sentiment_momentum']:+.3f}  (trend direction)")
        print(f"      24h volume:    {features['news_volume_24h']}  (article count)")

        # Interpretation
        overall = features['news_sentiment_7d']
        momentum = features['news_sentiment_momentum']

        if overall > 0.2 and momentum > 0.1:
            interpretation = "🟢 BULLISH - Positive sentiment with improving trend"
        elif overall < -0.2 and momentum < -0.1:
            interpretation = "🔴 BEARISH - Negative sentiment with deteriorating trend"
        elif overall > 0.1:
            interpretation = "🟡 CAUTIOUSLY BULLISH - Positive but weak trend"
        elif overall < -0.1:
            interpretation = "🟠 CAUTIOUSLY BEARISH - Negative but weak trend"
        else:
            interpretation = "⚪ NEUTRAL - Mixed or unclear sentiment"

        print(f"\n   💡 Interpretation: {interpretation}")
        print()
        print("-" * 70)
        print()

    # Summary table
    print("=" * 70)
    print("SUMMARY - NEWS SENTIMENT FEATURES FOR ALL STOCKS")
    print("=" * 70)
    print()
    print(f"{'Symbol':<8} {'24h':>8} {'7d':>8} {'30d':>8} {'Momentum':>10} {'Volume':>8}")
    print("-" * 70)

    for symbol, data in results.items():
        f = data['features']
        print(
            f"{symbol:<8} "
            f"{f['news_sentiment_24h']:>+8.3f} "
            f"{f['news_sentiment_7d']:>+8.3f} "
            f"{f['news_sentiment_30d']:>+8.3f} "
            f"{f['news_sentiment_momentum']:>+10.3f} "
            f"{f['news_volume_24h']:>8}"
        )

    print()
    print("=" * 70)
    print("✅ PROOF OF CONCEPT COMPLETE")
    print("=" * 70)
    print()
    print("Next Steps:")
    print("1. Review sentiment scores - do they make intuitive sense?")
    print("2. Check feature ranges - reasonable values for ML model?")
    print("3. If results look good, integrate into feature extraction pipeline")
    print("4. Add these 5 features to your price-prediction dataset")
    print("5. Retrain LightGBM model with enhanced features")
    print()

    return results

if __name__ == "__main__":
    try:
        results = run_proof_of_concept()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
