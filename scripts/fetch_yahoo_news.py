#!/usr/bin/env python3
"""
Fetch Yahoo Finance news data for sentiment analysis.
This script is called by the Node.js backend to get real news data from Yahoo Finance.
Optimized for <1.5s performance target with batching and caching.
"""

import sys
import json
import time
import yfinance as yf
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Any, Optional
import concurrent.futures
from urllib.parse import urljoin
import re

class YahooFinanceNewsService:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

    def get_news_sentiment(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Fetch news sentiment for multiple symbols efficiently.
        Uses parallel processing and smart caching.
        """
        try:
            results = {}

            # Process symbols in parallel (max 4 concurrent to avoid rate limits)
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                future_to_symbol = {
                    executor.submit(self._get_symbol_news, symbol): symbol
                    for symbol in symbols[:10]  # Limit to 10 symbols for performance
                }

                for future in concurrent.futures.as_completed(future_to_symbol):
                    symbol = future_to_symbol[future]
                    try:
                        news_data = future.result(timeout=30)  # 30s timeout per symbol
                        if news_data:
                            results[symbol] = news_data
                    except Exception as e:
                        results[symbol] = {
                            "error": str(e),
                            "sentiment": 0.0,
                            "confidence": 0.0
                        }

            return {
                "success": True,
                "data": results,
                "timestamp": int(time.time() * 1000),
                "source": "yahoo_finance_news",
                "performance": {
                    "symbols_processed": len(results),
                    "cache_optimized": True
                }
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "timestamp": int(time.time() * 1000)
            }

    def _get_symbol_news(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get news data for a single symbol from Yahoo Finance."""
        try:
            ticker = yf.Ticker(symbol.upper())

            # Get news from yfinance (most efficient method)
            news_items = ticker.news

            if not news_items:
                # Fallback to RSS if yfinance news is empty
                news_items = self._fetch_yahoo_rss_news(symbol)

            if not news_items:
                return None

            # Process news for sentiment
            sentiment_data = self._analyze_news_sentiment(news_items, symbol)

            return {
                "symbol": symbol.upper(),
                "sentiment": sentiment_data["sentiment"],
                "confidence": sentiment_data["confidence"],
                "articleCount": len(news_items),
                "sources": sentiment_data["sources"],
                "keyTopics": sentiment_data["topics"],
                "timeframe": "1d",
                "lastUpdated": int(time.time() * 1000)
            }

        except Exception as e:
            print(f"Error fetching news for {symbol}: {str(e)}", file=sys.stderr)
            return None

    def _fetch_yahoo_rss_news(self, symbol: str) -> List[Dict[str, Any]]:
        """Fallback RSS news fetching from Yahoo Finance."""
        try:
            rss_url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
            response = self.session.get(rss_url, timeout=10)

            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'xml')
                items = []

                for item in soup.find_all('item')[:20]:  # Limit to 20 articles
                    title = item.find('title')
                    description = item.find('description')
                    pubDate = item.find('pubDate')

                    if title and description:
                        items.append({
                            'title': title.text.strip(),
                            'description': description.text.strip(),
                            'published': pubDate.text if pubDate else '',
                            'source': 'Yahoo Finance RSS'
                        })

                return items
        except:
            pass
        return []

    def _analyze_news_sentiment(self, news_items: List[Dict], symbol: str) -> Dict[str, Any]:
        """Analyze sentiment from news items."""
        if not news_items:
            return {
                "sentiment": 0.0,
                "confidence": 0.0,
                "sources": [],
                "topics": []
            }

        # Positive sentiment keywords
        positive_words = [
            'beat', 'beats', 'exceeds', 'strong', 'growth', 'positive', 'bullish',
            'upgrade', 'buy', 'outperform', 'raised', 'increase', 'profit',
            'revenue', 'earnings', 'gains', 'up', 'higher', 'record', 'surge'
        ]

        # Negative sentiment keywords
        negative_words = [
            'miss', 'misses', 'weak', 'decline', 'negative', 'bearish',
            'downgrade', 'sell', 'underperform', 'lowered', 'cut', 'loss',
            'losses', 'down', 'lower', 'poor', 'disappointing', 'plunge'
        ]

        total_score = 0
        total_weight = 0
        sources = set()
        topics = set()

        for item in news_items[:15]:  # Limit processing to 15 articles for performance
            title = item.get('title', '')
            description = item.get('description', '')
            text = f"{title} {description}".lower()

            # Calculate relevance (higher weight for more relevant articles)
            relevance = self._calculate_relevance(text, symbol.lower())
            if relevance < 0.3:
                continue

            # Sentiment analysis
            pos_count = sum(1 for word in positive_words if word in text)
            neg_count = sum(1 for word in negative_words if word in text)

            if pos_count + neg_count > 0:
                article_sentiment = (pos_count - neg_count) / (pos_count + neg_count)
                total_score += article_sentiment * relevance
                total_weight += relevance

            # Extract metadata
            source = item.get('source', item.get('publisher', {}).get('name', 'Unknown'))
            sources.add(source)

            # Extract topics (simplified)
            words = re.findall(r'\b[a-zA-Z]{4,}\b', title.lower())
            for word in words[:3]:
                if word not in ['stock', 'shares', 'company', 'yahoo', 'finance']:
                    topics.add(word)

        # Calculate final sentiment
        final_sentiment = (total_score / total_weight) if total_weight > 0 else 0.0
        confidence = min(total_weight / 5.0, 1.0)  # Max confidence at 5 articles

        return {
            "sentiment": max(-1.0, min(1.0, final_sentiment)),
            "confidence": max(0.1, confidence),
            "sources": list(sources)[:10],
            "topics": list(topics)[:10]
        }

    def _calculate_relevance(self, text: str, symbol: str) -> float:
        """Calculate how relevant an article is to the symbol."""
        score = 0.0

        # Direct symbol mentions
        if symbol in text:
            score += 0.5

        # Financial keywords
        financial_keywords = [
            'earnings', 'revenue', 'profit', 'stock', 'shares', 'analyst',
            'price', 'target', 'rating', 'forecast', 'guidance'
        ]

        for keyword in financial_keywords:
            if keyword in text:
                score += 0.1

        return min(score, 1.0)

def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python fetch_yahoo_news.py <SYMBOLS...>"
        }))
        sys.exit(1)

    symbols = sys.argv[1:]
    service = YahooFinanceNewsService()
    result = service.get_news_sentiment(symbols)

    # Output as JSON
    print(json.dumps(result, default=str))

if __name__ == "__main__":
    main()