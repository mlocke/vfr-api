#!/usr/bin/env python3
"""
Generic Model Prediction Server - Persistent Prediction Service
Loads LightGBM models dynamically and handles multiple predictions via stdin/stdout

Architecture:
- Persistent Python process (spawn once, use many times)
- Load model and normalizer from paths provided in request
- Z-score normalization using normalizer.json parameters
- JSON-based stdin/stdout communication
- Real LightGBM inference (NO MOCK DATA)

Request Format:
{
  "features": {"feature1": value1, "feature2": value2, ...},
  "modelPath": "/path/to/model.txt",
  "normalizerPath": "/path/to/normalizer.json"
}

Response Format:
{
  "success": true,
  "data": {
    "prediction": float,        # Raw prediction value (-1 to 1 for regression, 0-1 for classification)
    "confidence": float,        # Confidence score (0-1)
    "probability": {            # Class probabilities (for classification)
      "up": float,
      "down": float,
      "neutral": float
    }
  }
}
"""

import sys
import json
import lightgbm as lgb
import numpy as np
from typing import Dict, Any, Optional

class GenericPredictionServer:
    def __init__(self):
        """Initialize prediction server"""
        self.model_cache: Dict[str, lgb.Booster] = {}
        self.normalizer_cache: Dict[str, Dict[str, Any]] = {}
        sys.stderr.write('READY\n')
        sys.stderr.flush()

    def load_model(self, model_path: str) -> lgb.Booster:
        """Load LightGBM model from file (cached)"""
        if model_path in self.model_cache:
            return self.model_cache[model_path]

        try:
            model = lgb.Booster(model_file=model_path)
            self.model_cache[model_path] = model
            sys.stderr.write(f'Model loaded: {model_path}\n')
            sys.stderr.flush()
            return model
        except Exception as e:
            raise Exception(f'Failed to load model from {model_path}: {str(e)}')

    def load_normalizer(self, normalizer_path: str) -> Dict[str, Any]:
        """Load normalizer parameters from JSON (cached)"""
        if normalizer_path in self.normalizer_cache:
            return self.normalizer_cache[normalizer_path]

        try:
            with open(normalizer_path, 'r') as f:
                normalizer_data = json.load(f)

            # Handle both array-based and dict-based normalizer formats
            if 'mean' in normalizer_data and ('std' in normalizer_data or 'scale' in normalizer_data):
                # Array-based format: {"mean": [...], "std": [...]} or {"mean": [...], "scale": [...]}
                # Support both "std" and "scale" as they're equivalent (standard deviation)
                if 'scale' in normalizer_data and 'std' not in normalizer_data:
                    normalizer_data['std'] = normalizer_data['scale']
                self.normalizer_cache[normalizer_path] = normalizer_data
            elif 'params' in normalizer_data:
                # Dict-based format: {"params": {"feature1": {"mean": ..., "stdDev": ...}, ...}}
                params = normalizer_data['params']
                mean_dict = {k: v['mean'] for k, v in params.items()}
                std_dict = {k: v['stdDev'] for k, v in params.items()}
                self.normalizer_cache[normalizer_path] = {
                    'mean': mean_dict,
                    'std': std_dict,
                    'feature_names': list(params.keys())
                }
            else:
                raise Exception('Unsupported normalizer format')

            sys.stderr.write(f'Normalizer loaded: {normalizer_path}\n')
            sys.stderr.flush()
            return self.normalizer_cache[normalizer_path]
        except Exception as e:
            raise Exception(f'Failed to load normalizer from {normalizer_path}: {str(e)}')

    def normalize_features(
        self,
        features: Dict[str, float],
        normalizer: Dict[str, Any]
    ) -> np.ndarray:
        """Apply z-score normalization to features"""
        mean = normalizer['mean']
        std = normalizer['std']

        # Convert dict features to array in correct order
        if isinstance(mean, dict):
            # Dict-based normalizer
            feature_names = normalizer.get('feature_names', list(mean.keys()))
            normalized = []
            for fname in feature_names:
                if fname not in features:
                    raise Exception(f'Missing feature: {fname}')
                value = features[fname]
                mean_val = mean[fname]
                std_val = std[fname]
                # Z-score: (x - mean) / std
                normalized_val = (value - mean_val) / std_val if std_val != 0 else 0.0
                normalized.append(normalized_val)
            return np.array(normalized).reshape(1, -1)
        else:
            # Array-based normalizer - features dict must be in same order as arrays
            # Get feature names from dict keys (should be ordered)
            feature_names = list(features.keys())
            feature_values = [features[fname] for fname in feature_names]

            X = np.array(feature_values).reshape(1, -1)
            mean_arr = np.array(mean)
            std_arr = np.array(std)

            # Validate dimensions
            if X.shape[1] != len(mean_arr):
                raise Exception(f'Feature count mismatch: got {X.shape[1]} features, expected {len(mean_arr)}')

            # Z-score normalization
            X_norm = (X - mean_arr) / std_arr
            return X_norm

    def predict(
        self,
        features: Dict[str, float],
        model_path: str,
        normalizer_path: str
    ) -> Dict[str, Any]:
        """Make prediction using loaded model and normalizer"""
        # Load model and normalizer (cached)
        model = self.load_model(model_path)
        normalizer = self.load_normalizer(normalizer_path)

        # Normalize features
        X_norm = self.normalize_features(features, normalizer)

        # Make prediction
        raw_prediction = model.predict(X_norm)[0]

        # Handle multi-class vs binary classification vs regression
        if isinstance(raw_prediction, np.ndarray):
            # Multi-class classification: prediction is array of probabilities [prob_class0, prob_class1, prob_class2]
            # For 3-class (DOWN=0, NEUTRAL=1, UP=2)
            if len(raw_prediction) == 3:
                prob_down = float(raw_prediction[0])
                prob_neutral = float(raw_prediction[1])
                prob_up = float(raw_prediction[2])

                # Predicted class (argmax)
                predicted_class = int(np.argmax(raw_prediction))

                # Map class to value: DOWN=-1, NEUTRAL=0, UP=1
                value = float(predicted_class - 1)  # 0->-1, 1->0, 2->1

                # Confidence = max probability
                confidence = float(np.max(raw_prediction))

                probability = {
                    'up': prob_up,
                    'down': prob_down,
                    'neutral': prob_neutral
                }
            else:
                # Unexpected array size
                raise Exception(f'Unexpected prediction array size: {len(raw_prediction)}')
        else:
            # Scalar prediction (binary classification or regression)
            prediction = float(raw_prediction)

            # Calculate confidence and probabilities
            # For classification (binary): prediction is probability of class 1
            # For regression: prediction is raw value
            if prediction >= 0 and prediction <= 1:
                # Binary classification mode
                confidence = abs(prediction - 0.5) * 2  # Distance from 0.5, scaled to [0, 1]
                probability = {
                    'up': prediction,
                    'down': 1 - prediction,
                    'neutral': 0.0
                }
                # Raw prediction value (normalize to [-1, 1] range)
                value = (prediction - 0.5) * 2
            else:
                # Regression mode
                value = prediction
                # Calculate confidence based on prediction magnitude
                confidence = min(abs(value), 1.0)
                # Calculate probabilities from value
                if value > 0:
                    prob_up = min(0.5 + value * 0.3, 0.8)
                    prob_down = 1 - prob_up - 0.1
                    prob_neutral = 0.1
                elif value < 0:
                    prob_down = min(0.5 + abs(value) * 0.3, 0.8)
                    prob_up = 1 - prob_down - 0.1
                    prob_neutral = 0.1
                else:
                    prob_up = 0.33
                    prob_down = 0.33
                    prob_neutral = 0.34

                probability = {
                    'up': prob_up,
                    'down': prob_down,
                    'neutral': prob_neutral
                }

        return {
            'prediction': float(value),
            'confidence': float(confidence),
            'probability': probability
        }

    def run(self):
        """Run prediction server loop"""
        for line in sys.stdin:
            try:
                # Parse request
                request = json.loads(line.strip())
                features = request.get('features')
                model_path = request.get('modelPath')
                normalizer_path = request.get('normalizerPath')

                if not features:
                    response = {
                        'success': False,
                        'error': 'Missing required field: features'
                    }
                elif not model_path:
                    response = {
                        'success': False,
                        'error': 'Missing required field: modelPath'
                    }
                elif not normalizer_path:
                    response = {
                        'success': False,
                        'error': 'Missing required field: normalizerPath'
                    }
                else:
                    # Make prediction
                    result = self.predict(features, model_path, normalizer_path)
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
    server = GenericPredictionServer()
    server.run()
