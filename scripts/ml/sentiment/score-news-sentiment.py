#!/usr/bin/env python3
"""
News Sentiment Scoring Service
===============================

Purpose: Long-lived subprocess that scores news sentiment using pre-trained FinBERT

Protocol:
- Reads JSON requests from stdin (one per line)
- Writes JSON responses to stdout (one per line)
- Runs continuously until stdin closes

Request Format:
{
    "command": "score",
    "text": "Apple announces record earnings..."
}

OR for batch scoring:
{
    "command": "score_batch",
    "articles": [
        {"title": "...", "description": "..."},
        {"title": "...", "description": "..."}
    ]
}

Response Format:
{
    "success": true,
    "score": 0.742,
    "confidence": 0.856,
    "label": "positive",
    "probabilities": {
        "negative": 0.082,
        "neutral": 0.062,
        "positive": 0.856
    }
}

OR for batch:
{
    "success": true,
    "results": [
        {"score": 0.742, "confidence": 0.856, "label": "positive", ...},
        {"score": -0.234, "confidence": 0.654, "label": "negative", ...}
    ]
}

Usage:
    python3 scripts/ml/sentiment/score-news-sentiment.py
"""

import sys
import json
import traceback
from datetime import datetime

try:
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    import torch
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"Missing dependencies: {e}",
        "message": "Install: pip install transformers torch"
    }), flush=True)
    sys.exit(1)


class NewsSentimentScorer:
    """Sentiment scorer using pre-trained FinBERT"""

    def __init__(self):
        """Load model on initialization"""
        self.model_name = "ProsusAI/finbert"
        self.tokenizer = None
        self.model = None
        self.load_model()

    def load_model(self):
        """Load pre-trained FinBERT model"""
        try:
            self.log("Loading pre-trained FinBERT model...")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
            self.model.eval()
            self.log("Model loaded successfully")
        except Exception as e:
            self.log(f"Error loading model: {e}")
            raise

    def log(self, message: str):
        """Log to stderr (stdout is reserved for JSON responses)"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}", file=sys.stderr, flush=True)

    def score_text(self, text: str) -> dict:
        """
        Score a single text

        Args:
            text: News headline or article text

        Returns:
            {
                'score': float (-1 to +1),
                'confidence': float (0 to 1),
                'label': str ('positive'|'negative'|'neutral'),
                'probabilities': dict
            }
        """
        if not text or not text.strip():
            return {
                'score': 0.0,
                'confidence': 0.0,
                'label': 'neutral',
                'probabilities': {'negative': 0.33, 'neutral': 0.34, 'positive': 0.33}
            }

        try:
            # Tokenize
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
                'score': round(score, 4),
                'confidence': round(confidence, 4),
                'label': label,
                'probabilities': {
                    'negative': round(negative, 4),
                    'neutral': round(neutral, 4),
                    'positive': round(positive, 4)
                }
            }

        except Exception as e:
            self.log(f"Error scoring text: {e}")
            return {
                'score': 0.0,
                'confidence': 0.0,
                'label': 'neutral',
                'error': str(e)
            }

    def score_batch(self, articles: list) -> list:
        """
        Score multiple articles

        Args:
            articles: List of dicts with 'title' and optional 'description'

        Returns:
            List of sentiment dicts
        """
        results = []
        for article in articles:
            # Combine title and description
            text = article.get('title', '')
            if article.get('description'):
                text += ". " + article['description']

            sentiment = self.score_text(text)
            results.append(sentiment)

        return results

    def handle_request(self, request: dict) -> dict:
        """Handle a single request"""
        command = request.get('command')

        if command == 'score':
            text = request.get('text', '')
            result = self.score_text(text)
            return {
                'success': True,
                **result
            }

        elif command == 'score_batch':
            articles = request.get('articles', [])
            results = self.score_batch(articles)
            return {
                'success': True,
                'results': results
            }

        elif command == 'ping':
            return {
                'success': True,
                'message': 'pong',
                'model': self.model_name
            }

        elif command == 'shutdown':
            self.log("Shutdown requested")
            return {
                'success': True,
                'message': 'shutting down'
            }

        else:
            return {
                'success': False,
                'error': f"Unknown command: {command}",
                'supported_commands': ['score', 'score_batch', 'ping', 'shutdown']
            }

    def run(self):
        """Main loop: read requests from stdin, write responses to stdout"""
        self.log("News Sentiment Scorer ready. Waiting for requests...")

        try:
            for line in sys.stdin:
                if not line.strip():
                    continue

                try:
                    # Parse request
                    request = json.loads(line)

                    # Handle request
                    response = self.handle_request(request)

                    # Write response
                    print(json.dumps(response), flush=True)

                    # Check for shutdown
                    if request.get('command') == 'shutdown':
                        break

                except json.JSONDecodeError as e:
                    error_response = {
                        'success': False,
                        'error': f"Invalid JSON: {e}"
                    }
                    print(json.dumps(error_response), flush=True)

                except Exception as e:
                    error_response = {
                        'success': False,
                        'error': str(e),
                        'traceback': traceback.format_exc()
                    }
                    print(json.dumps(error_response), flush=True)
                    self.log(f"Error processing request: {e}")

        except KeyboardInterrupt:
            self.log("Interrupted by user")
        except Exception as e:
            self.log(f"Fatal error: {e}")
            traceback.print_exc(file=sys.stderr)
        finally:
            self.log("Shutting down")


def main():
    """Entry point"""
    try:
        scorer = NewsSentimentScorer()
        scorer.run()
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f"Failed to initialize: {e}"
        }), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
