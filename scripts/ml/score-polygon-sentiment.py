#!/usr/bin/env python3
"""
Score Polygon News Articles with FinBERT Sentiment Analysis

Uses pre-trained FinBERT to score 118K+ Polygon news articles.
CRITICAL: Each article is scored EXACTLY ONCE and cached to disk.

Three-Phase Optimization:
  Phase 1: Load combined Polygon dataset
  Phase 2: Score unique articles with FinBERT (cache to disk)
  Phase 3: Save sentiment-scored dataset

Input:
  - data/training/polygon_news_combined_2023-2025.csv (118K articles)

Output:
  - data/training/polygon_news_with_sentiment.csv (118K articles + sentiment scores)
  - data/cache/polygon_sentiment/ (cached FinBERT scores per ticker)

Performance:
  - First run: ~20-30 minutes (score 118K articles)
  - Cached runs: <1 minute (load from disk)

Usage:
    python3 scripts/ml/score-polygon-sentiment.py
"""

import pandas as pd
import numpy as np
import os
import json
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from tqdm import tqdm
import sys

class FinBERTScorer:
    """Batch sentiment scoring with pre-trained FinBERT"""

    def __init__(self, batch_size=32):
        print("📦 Loading pre-trained FinBERT model...")
        self.tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
        self.model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
        self.model.eval()
        self.batch_size = batch_size

        # Use GPU/MPS if available
        if torch.backends.mps.is_available():
            self.device = torch.device("mps")
        elif torch.cuda.is_available():
            self.device = torch.device("cuda")
        else:
            self.device = torch.device("cpu")

        self.model.to(self.device)
        print(f"✓ FinBERT loaded on {self.device} (batch size: {batch_size})\n")

    def score_batch(self, texts: list) -> list:
        """Score multiple texts in batches for performance"""
        if not texts:
            return []

        results = []

        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]

            # Filter empty texts
            valid_indices = [j for j, text in enumerate(batch) if text and text.strip()]
            valid_texts = [batch[j] for j in valid_indices]

            if not valid_texts:
                results.extend([{'negative': 0.0, 'neutral': 0.5, 'positive': 0.0, 'score': 0.0}] * len(batch))
                continue

            # Tokenize batch
            inputs = self.tokenizer(
                valid_texts,
                return_tensors="pt",
                truncation=True,
                max_length=512,
                padding=True
            ).to(self.device)

            # Inference
            with torch.no_grad():
                outputs = self.model(**inputs)
                probabilities = torch.softmax(outputs.logits, dim=-1)

            # Process results
            batch_results = []
            valid_idx = 0

            for j in range(len(batch)):
                if j in valid_indices:
                    probs = probabilities[valid_idx].cpu().tolist()
                    negative, neutral, positive = probs
                    score = positive - negative  # Range: -1 (very negative) to +1 (very positive)

                    batch_results.append({
                        'negative': round(negative, 4),
                        'neutral': round(neutral, 4),
                        'positive': round(positive, 4),
                        'score': round(score, 4)
                    })
                    valid_idx += 1
                else:
                    batch_results.append({'negative': 0.0, 'neutral': 0.5, 'positive': 0.0, 'score': 0.0})

            results.extend(batch_results)

        return results


def score_polygon_sentiment():
    """Score all Polygon articles with FinBERT"""

    print("=" * 80)
    print("SCORE POLYGON NEWS WITH FINBERT SENTIMENT (OPTIMIZED CACHING)")
    print("=" * 80)
    print()

    # Load combined dataset
    input_file = "data/training/polygon_news_combined_2023-2025.csv"

    if not os.path.exists(input_file):
        print(f"❌ Error: {input_file} not found")
        print("Run: python3 scripts/ml/combine-polygon-datasets.py first")
        sys.exit(1)

    print(f"📂 Loading combined dataset: {input_file}")
    df = pd.read_csv(input_file)
    print(f"   ✓ Loaded {len(df):,} articles")
    print(f"   Unique tickers: {df['ticker'].nunique()}")
    print()

    # Initialize FinBERT scorer
    scorer = FinBERTScorer(batch_size=32)

    # Create cache directory
    cache_dir = "data/cache/polygon_sentiment"
    os.makedirs(cache_dir, exist_ok=True)

    # Get unique tickers
    unique_tickers = sorted(df['ticker'].unique())
    print(f"🎯 Processing {len(unique_tickers)} unique tickers")
    print()

    # PHASE 1: Score articles per ticker (with caching)
    print("=" * 80)
    print("PHASE 1: SCORE ARTICLES WITH FINBERT (CACHE PER TICKER)")
    print("=" * 80)
    print()

    ticker_sentiment_cache = {}
    total_cached = 0
    total_scored = 0

    for idx, ticker in enumerate(unique_tickers, 1):
        cache_file = os.path.join(cache_dir, f"{ticker}_sentiments.json")

        # Check cache first
        if os.path.exists(cache_file):
            print(f"[{idx}/{len(unique_tickers)}] ✅ Cache HIT: {ticker}")
            with open(cache_file, 'r') as f:
                ticker_sentiment_cache[ticker] = json.load(f)
            total_cached += len(ticker_sentiment_cache[ticker])
            continue

        # Cache miss - score articles
        print(f"[{idx}/{len(unique_tickers)}] ❌ Cache MISS: {ticker} - Scoring articles...")

        ticker_articles = df[df['ticker'] == ticker].copy()
        n_articles = len(ticker_articles)

        # Build texts for scoring
        texts = []
        for _, row in ticker_articles.iterrows():
            text = row.get('title', '')
            if pd.notna(row.get('description')):
                text += ". " + row['description']
            texts.append(text)

        # Batch score all articles for this ticker
        sentiments = scorer.score_batch(texts)

        # Build article_id → sentiment mapping
        article_sentiments = {}
        for i, (_, row) in enumerate(ticker_articles.iterrows()):
            # Use article_url as unique ID
            article_id = row.get('article_url', f"{ticker}_{i}")
            article_sentiments[article_id] = {
                **sentiments[i],
                'published_utc': row['published_utc'],
                'ticker': ticker
            }

        ticker_sentiment_cache[ticker] = article_sentiments

        # Save to cache immediately
        with open(cache_file, 'w') as f:
            json.dump(article_sentiments, f)

        print(f"      📦 Cached {len(article_sentiments)} articles for {ticker}")
        total_scored += len(article_sentiments)

    print()
    print(f"✅ Sentiment scoring complete!")
    print(f"   Cached articles: {total_cached:,}")
    print(f"   Newly scored: {total_scored:,}")
    print(f"   Total: {total_cached + total_scored:,}")
    print()

    # PHASE 2: Add sentiment columns to dataframe
    print("=" * 80)
    print("PHASE 2: ADD SENTIMENT SCORES TO DATASET")
    print("=" * 80)
    print()

    print("📝 Merging sentiment scores into dataframe...")

    # Initialize sentiment columns
    df['sentiment_negative'] = 0.0
    df['sentiment_neutral'] = 0.5
    df['sentiment_positive'] = 0.0
    df['sentiment_score'] = 0.0

    # Add sentiment scores
    for idx, row in tqdm(df.iterrows(), total=len(df), desc="Adding scores"):
        ticker = row['ticker']
        article_id = row.get('article_url', f"{ticker}_{idx}")

        sentiment = ticker_sentiment_cache.get(ticker, {}).get(article_id)

        if sentiment:
            df.at[idx, 'sentiment_negative'] = sentiment['negative']
            df.at[idx, 'sentiment_neutral'] = sentiment['neutral']
            df.at[idx, 'sentiment_positive'] = sentiment['positive']
            df.at[idx, 'sentiment_score'] = sentiment['score']

    print(f"   ✓ Added sentiment scores to {len(df):,} articles")
    print()

    # Save sentiment-scored dataset
    output_file = "data/training/polygon_news_with_sentiment.csv"
    print(f"💾 Saving sentiment-scored dataset: {output_file}")
    df.to_csv(output_file, index=False)

    file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"   ✓ Saved {len(df):,} articles with sentiment scores")
    print(f"   File size: {file_size_mb:.1f} MB")
    print()

    # STATISTICS
    print("=" * 80)
    print("SENTIMENT STATISTICS")
    print("=" * 80)
    print()

    print(f"Sentiment Score Distribution:")
    print(f"  Mean:   {df['sentiment_score'].mean():.4f}")
    print(f"  Median: {df['sentiment_score'].median():.4f}")
    print(f"  Std:    {df['sentiment_score'].std():.4f}")
    print(f"  Min:    {df['sentiment_score'].min():.4f}")
    print(f"  Max:    {df['sentiment_score'].max():.4f}")
    print()

    # Sentiment distribution
    positive_count = (df['sentiment_score'] > 0.2).sum()
    neutral_count = ((df['sentiment_score'] >= -0.2) & (df['sentiment_score'] <= 0.2)).sum()
    negative_count = (df['sentiment_score'] < -0.2).sum()

    print(f"Article Sentiment Breakdown:")
    print(f"  Positive (>0.2):  {positive_count:,} ({positive_count/len(df)*100:.1f}%)")
    print(f"  Neutral (-0.2 to 0.2): {neutral_count:,} ({neutral_count/len(df)*100:.1f}%)")
    print(f"  Negative (<-0.2): {negative_count:,} ({negative_count/len(df)*100:.1f}%)")
    print()

    # Top positive/negative tickers
    ticker_sentiment = df.groupby('ticker')['sentiment_score'].mean().sort_values()
    print("Top 5 Most Negative Tickers:")
    print(ticker_sentiment.head(5))
    print()
    print("Top 5 Most Positive Tickers:")
    print(ticker_sentiment.tail(5))
    print()

    print("=" * 80)
    print("✅ COMPLETE - POLYGON SENTIMENT SCORING")
    print("=" * 80)
    print()
    print("Cache Location:")
    print(f"  {cache_dir}/")
    print(f"  - Sentiment scores cached per ticker")
    print(f"  - Each article scored EXACTLY ONCE")
    print(f"  - Clear cache: rm -rf {cache_dir}/")
    print()
    print("Next steps:")
    print("  1. Generate price features for (ticker, date) pairs")
    print("  2. Merge sentiment + price features")
    print("  3. Train LightGBM model")
    print()


if __name__ == "__main__":
    score_polygon_sentiment()
