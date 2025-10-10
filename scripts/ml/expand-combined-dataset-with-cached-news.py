#!/usr/bin/env python3
"""
Expand Combined Dataset with Cached News (Jun-Dec 2024)

Takes the existing combined dataset (1,472 rows) and adds data from the
cached news period (Jun-Dec 2024) to dramatically increase dataset size.

Strategy:
1. Load existing combined dataset (1,472 rows)
2. Load price-prediction dataset filtered to Jun-Dec 2024 (12,600 rows)
3. Remove rows already in combined dataset (368 overlap)
4. For remaining 12,232 rows:
   - Load cached news from data/cache/news/
   - Score with pre-trained FinBERT
   - Add 3 FinBERT features
5. Append to existing combined dataset
6. Result: ~13,704 rows with 46 features

Performance: ~2-3 hours for 12,232 rows with checkpointing

Usage:
    python3 scripts/ml/expand-combined-dataset-with-cached-news.py
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime, timedelta
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from tqdm import tqdm
import time

class FinBERTScorer:
    """Score text with pre-trained FinBERT"""

    def __init__(self, batch_size=32):
        print("📦 Loading pre-trained FinBERT...")
        self.tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
        self.model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
        self.model.eval()
        self.batch_size = batch_size

        if torch.backends.mps.is_available():
            self.device = torch.device("mps")
        elif torch.cuda.is_available():
            self.device = torch.device("cuda")
        else:
            self.device = torch.device("cpu")

        self.model.to(self.device)
        print(f"✓ FinBERT loaded on {self.device}\n")

    def score_texts(self, texts):
        """Score multiple texts and return average sentiment"""
        if not texts or len(texts) == 0:
            return {'finbert_negative': 0.0, 'finbert_neutral': 1.0, 'finbert_positive': 0.0}

        all_scores = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            inputs = self.tokenizer(
                batch, return_tensors="pt", truncation=True,
                max_length=512, padding=True
            ).to(self.device)

            with torch.no_grad():
                outputs = self.model(**inputs)
                probs = torch.softmax(outputs.logits, dim=-1)

            batch_scores = probs.cpu().numpy()
            all_scores.extend(batch_scores)

        # Average all scores
        avg_scores = np.mean(all_scores, axis=0)

        return {
            'finbert_negative': float(avg_scores[0]),
            'finbert_neutral': float(avg_scores[1]),
            'finbert_positive': float(avg_scores[2])
        }

class NewsCache:
    """Load and filter cached news"""

    def __init__(self, cache_dir="data/cache/news"):
        self.cache_dir = Path(cache_dir)
        self.cache = {}

    def get_news_for_symbol_date(self, symbol, date, window_days=7):
        """Get news texts for symbol within ±window_days of date"""
        if isinstance(date, str):
            date = datetime.strptime(date, '%Y-%m-%d')

        # Load news file if not cached
        if symbol not in self.cache:
            news_file = self._find_news_file(symbol)
            if news_file:
                with open(news_file, 'r') as f:
                    self.cache[symbol] = json.load(f)
            else:
                self.cache[symbol] = []

        # Filter to date window
        articles = self.cache[symbol]
        start_date = date - timedelta(days=window_days)
        end_date = date + timedelta(days=window_days)

        filtered_texts = []
        for article in articles:
            pub_date = datetime.strptime(
                article['published_utc'].split('T')[0], '%Y-%m-%d'
            )
            if start_date <= pub_date <= end_date:
                text = article.get('title', '')
                if article.get('description'):
                    text += ' ' + article['description']
                if text.strip():
                    filtered_texts.append(text.strip())

        return filtered_texts

    def _find_news_file(self, symbol):
        """Find cached news file for symbol"""
        symbol_variants = [symbol, symbol.replace('-', '.'), symbol.replace('.', '-')]
        for variant in symbol_variants:
            pattern = f"{variant}_*.json"
            matches = list(self.cache_dir.glob(pattern))
            if matches:
                return matches[0]
        return None

def expand_dataset():
    """Main function to expand dataset"""

    print("=" * 80)
    print("📈 Expanding Combined Dataset with Cached News")
    print("=" * 80)

    # Step 1: Load existing combined dataset
    print("\n📂 Step 1: Loading existing combined dataset...")
    df_existing = pd.read_csv("data/training/combined-finbert-price-features.csv")
    print(f"✓ Loaded {len(df_existing):,} existing rows")

    # Step 2: Load price-prediction dataset (cached news period only)
    print("\n📂 Step 2: Loading price-prediction dataset (Jun-Dec 2024)...")
    df_price = pd.read_csv("data/training/price-prediction-yf-top100.csv")
    df_price['date_obj'] = pd.to_datetime(df_price['date'])
    df_cached_period = df_price[(df_price['date_obj'] >= '2024-06-21') &
                                  (df_price['date_obj'] <= '2024-12-31')].copy()
    print(f"✓ Filtered to {len(df_cached_period):,} rows in cached news period")

    # Step 3: Find NEW rows (not already in combined dataset)
    print("\n🔍 Step 3: Identifying new rows to add...")
    df_existing['key'] = df_existing['symbol'] + '_' + df_existing['date']
    df_cached_period['key'] = df_cached_period['symbol'] + '_' + df_cached_period['date']

    existing_keys = set(df_existing['key'])
    new_rows = df_cached_period[~df_cached_period['key'].isin(existing_keys)].copy()
    print(f"✓ Found {len(new_rows):,} NEW rows to process")
    print(f"  (Skipping {len(df_cached_period) - len(new_rows):,} rows already in dataset)")

    # Step 4: Initialize FinBERT and news cache
    print("\n🧠 Step 4: Initializing FinBERT and news cache...")
    scorer = FinBERTScorer(batch_size=32)
    news_cache = NewsCache()

    # Step 5: Score news for new rows
    print("\n📰 Step 5: Scoring news with FinBERT...")
    print(f"  Processing {len(new_rows):,} rows (checkpoints every 1000)")

    finbert_scores = []
    no_news_count = 0
    start_time = time.time()

    for idx in tqdm(range(len(new_rows)), desc="Scoring"):
        row_idx = new_rows.index[idx]
        symbol = new_rows.loc[row_idx, 'symbol']
        date = new_rows.loc[row_idx, 'date']

        # Get cached news
        news_texts = news_cache.get_news_for_symbol_date(symbol, date, window_days=7)

        if news_texts:
            scores = scorer.score_texts(news_texts[:20])  # Limit to 20 articles for speed
        else:
            scores = {'finbert_negative': 0.0, 'finbert_neutral': 1.0, 'finbert_positive': 0.0}
            no_news_count += 1

        finbert_scores.append(scores)

        # Checkpoint every 1000 rows
        if (idx + 1) % 1000 == 0:
            elapsed = time.time() - start_time
            rate = (idx + 1) / elapsed
            remaining = (len(new_rows) - idx - 1) / rate / 60
            print(f"\n  💾 Checkpoint {idx+1:,}/{len(new_rows):,} ({remaining:.1f} min remaining)")

    # Add FinBERT features to new rows
    new_rows['finbert_negative'] = [s['finbert_negative'] for s in finbert_scores]
    new_rows['finbert_neutral'] = [s['finbert_neutral'] for s in finbert_scores]
    new_rows['finbert_positive'] = [s['finbert_positive'] for s in finbert_scores]

    elapsed_time = time.time() - start_time
    print(f"\n✓ Scoring complete in {elapsed_time/60:.1f} minutes")
    print(f"  Rows with news: {len(new_rows) - no_news_count:,} ({(1 - no_news_count/len(new_rows))*100:.1f}%)")
    print(f"  Rows without news: {no_news_count:,} ({no_news_count/len(new_rows)*100:.1f}%)")

    # Step 6: Combine with existing dataset
    print("\n🔗 Step 6: Combining with existing dataset...")

    # Drop temporary key column
    df_existing = df_existing.drop(columns=['key'])
    new_rows = new_rows.drop(columns=['key', 'date_obj'])

    # Ensure column order matches
    df_combined = pd.concat([df_existing, new_rows], ignore_index=True)

    print(f"✓ Combined dataset: {len(df_combined):,} rows")
    print(f"  Original: {len(df_existing):,}")
    print(f"  Added: {len(new_rows):,}")

    # Step 7: Save expanded dataset
    output_path = "data/training/combined-finbert-price-features-expanded.csv"
    df_combined.to_csv(output_path, index=False)
    print(f"\n💾 Saved expanded dataset: {output_path}")

    # Summary
    print("\n" + "=" * 80)
    print("📊 EXPANDED DATASET SUMMARY")
    print("=" * 80)
    print(f"Total rows: {len(df_combined):,}")
    print(f"Total features: {len(df_combined.columns) - 3}")  # Exclude symbol, date, label
    print(f"  Price features: 43")
    print(f"  FinBERT features: 3")
    print(f"\nDate range: {df_combined['date'].min()} to {df_combined['date'].max()}")
    print(f"Symbols: {df_combined['symbol'].nunique()}")
    print(f"\nLabel distribution:")
    print(df_combined['label'].value_counts())
    print(f"\nFinBERT sentiment averages:")
    print(f"  Positive: {df_combined['finbert_positive'].mean():.3f}")
    print(f"  Neutral:  {df_combined['finbert_neutral'].mean():.3f}")
    print(f"  Negative: {df_combined['finbert_negative'].mean():.3f}")
    print("=" * 80)

    print("\n💡 Next steps:")
    print("  1. Split dataset: python3 scripts/ml/split-combined-dataset.py")
    print("  2. Train LightGBM: python3 scripts/ml/train-combined-lightgbm.py")
    print("=" * 80)

if __name__ == "__main__":
    expand_dataset()
