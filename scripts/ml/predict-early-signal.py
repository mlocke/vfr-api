#!/usr/bin/env python3
"""
Early Signal Detection - Persistent Prediction Server
Loads model once and handles multiple predictions via stdin/stdout
"""

import sys
import json
import lightgbm as lgb
import numpy as np

class PredictionServer:
    def __init__(self):
        """Initialize server and load model"""
        self.model = None
        self.normalizer = None
        self.mean = None
        self.std = None
        self._load_model()

    def _load_model(self):
        """Load model and normalization parameters (once)"""
        try:
            # Load LightGBM model
            self.model = lgb.Booster(model_file='models/early-signal/v1.0.0/model.txt')

            # Load normalizer
            with open('models/early-signal/v1.0.0/normalizer.json', 'r') as f:
                normalizer_data = json.load(f)

            # Extract mean and std from params structure
            params = normalizer_data['params']
            feature_names = [
                'price_change_5d', 'price_change_10d', 'price_change_20d',
                'volume_ratio', 'volume_trend',
                'sentiment_news_delta', 'sentiment_reddit_accel', 'sentiment_options_shift',
                'social_stocktwits_24h_change', 'social_stocktwits_hourly_momentum',
                'social_stocktwits_7d_trend', 'social_twitter_24h_change',
                'social_twitter_hourly_momentum', 'social_twitter_7d_trend',
                'earnings_surprise', 'revenue_growth_accel', 'analyst_coverage_change',
                'rsi_momentum', 'macd_histogram_trend'
            ]

            # Pre-convert to numpy arrays (19 features in order)
            self.mean = np.array([params[fname]['mean'] for fname in feature_names])
            self.std = np.array([params[fname]['stdDev'] for fname in feature_names])

            # Signal ready
            sys.stderr.write('READY\n')
            sys.stderr.flush()
        except Exception as e:
            sys.stderr.write(f'ERROR: {str(e)}\n')
            sys.stderr.flush()
            sys.exit(1)

    def predict(self, features: list) -> dict:
        """Make prediction on feature vector"""
        # Convert to numpy array
        X = np.array(features).reshape(1, -1)

        # Normalize using pre-loaded parameters
        X_norm = (X - self.mean) / self.std

        # Predict probability
        prob = self.model.predict(X_norm)[0]
        prediction = 1 if prob >= 0.5 else 0

        # Calculate confidence
        confidence = abs(prob - 0.5) * 2
        confidence_level = 'high' if confidence > 0.7 else 'medium' if confidence > 0.4 else 'low'

        return {
            'prediction': int(prediction),
            'probability': float(prob),
            'confidence': float(confidence),
            'confidenceLevel': confidence_level
        }

    def run(self):
        """Run prediction server loop"""
        for line in sys.stdin:
            try:
                # Parse request
                request = json.loads(line.strip())
                features = request.get('features')

                if not features or len(features) != 19:
                    response = {
                        'success': False,
                        'error': f'Expected 19 features, got {len(features) if features else 0}'
                    }
                else:
                    # Make prediction
                    result = self.predict(features)
                    response = {
                        'success': True,
                        'data': result
                    }

                # Send response
                print(json.dumps(response), flush=True)

            except Exception as e:
                response = {
                    'success': False,
                    'error': str(e)
                }
                print(json.dumps(response), flush=True)

if __name__ == '__main__':
    server = PredictionServer()
    server.run()
