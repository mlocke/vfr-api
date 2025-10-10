#!/usr/bin/env python3
"""Quick diagnostic to test sentiment scoring"""

from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import requests
import os
from datetime import datetime, timedelta

# Load model
print("Loading FinBERT...")
tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
model.eval()

# Test scoring
test_headlines = [
    "Apple announces record quarterly earnings, beating analyst estimates",
    "Stock plunges on weak guidance and disappointing results",
    "Company maintains neutral outlook amid market uncertainty"
]

print("\nTesting sentiment scoring:")
print("=" * 70)
for headline in test_headlines:
    inputs = tokenizer(headline, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=-1)[0].tolist()

    neg, neu, pos = probs
    score = pos - neg
    print(f"\nHeadline: {headline}")
    print(f"Probs: neg={neg:.3f}, neu={neu:.3f}, pos={pos:.3f}")
    print(f"Score: {score:+.3f}")

# Test with real Polygon data
print("\n" + "=" * 70)
print("Testing with real Polygon news (AAPL, 2022-01-21):")
print("=" * 70)

api_key = os.getenv('POLYGON_API_KEY')
if not api_key:
    print("POLYGON_API_KEY not set")
    exit(1)

target_date = datetime(2022, 1, 21)
start_date = target_date - timedelta(days=30)

url = "https://api.polygon.io/v2/reference/news"
params = {
    'ticker': 'AAPL',
    'published_utc.gte': start_date.strftime('%Y-%m-%d'),
    'published_utc.lte': target_date.strftime('%Y-%m-%d'),
    'limit': 5,
    'apiKey': api_key
}

response = requests.get(url, params=params, timeout=10)
articles = response.json().get('results', [])

print(f"\nFound {len(articles)} articles")
print()

for i, article in enumerate(articles, 1):
    text = article.get('title', '')
    published = article.get('published_utc', '')

    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=-1)[0].tolist()

    neg, neu, pos = probs
    score = pos - neg

    print(f"Article {i}:")
    print(f"  Title: {text[:60]}...")
    print(f"  Published: {published}")
    print(f"  Score: {score:+.4f} (neg={neg:.3f}, neu={neu:.3f}, pos={pos:.3f})")
    print()

print("If all scores are near 0.000, there's a problem with the scoring logic")
print("If scores vary, the issue is in the aggregation/filtering logic")
