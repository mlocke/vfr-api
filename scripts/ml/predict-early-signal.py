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
                self.normalizer = json.load(f)

            # Pre-convert to numpy for faster predictions
            self.mean = np.array(self.normalizer['mean'])
            self.std = np.array(self.normalizer['std'])

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
