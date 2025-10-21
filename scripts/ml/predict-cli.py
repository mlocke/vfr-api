#!/usr/bin/env python3
"""
CLI-based LightGBM Prediction Script
Accepts command-line arguments for single predictions
Used by TypeScript ML services (VolatilityPredictionService, SmartMoneyFlowService)
"""

import sys
import json
import argparse
import numpy as np

try:
    import lightgbm as lgb
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "LightGBM not installed. Run: pip install lightgbm"
    }))
    sys.exit(1)


def load_normalizer(normalizer_path: str) -> dict:
    """Load normalizer parameters from JSON"""
    try:
        with open(normalizer_path, 'r') as f:
            normalizer_data = json.load(f)

        # Handle both array-based and dict-based formats
        if 'mean' in normalizer_data and ('std' in normalizer_data or 'scale' in normalizer_data):
            if 'scale' in normalizer_data and 'std' not in normalizer_data:
                normalizer_data['std'] = normalizer_data['scale']
            return normalizer_data
        elif 'params' in normalizer_data:
            # Dict-based format
            params = normalizer_data['params']
            mean_dict = {k: v['mean'] for k, v in params.items()}
            std_dict = {k: v['stdDev'] for k, v in params.items()}
            return {
                'mean': mean_dict,
                'std': std_dict,
                'feature_names': list(params.keys())
            }
        else:
            raise Exception('Unsupported normalizer format')
    except Exception as e:
        raise Exception(f'Failed to load normalizer from {normalizer_path}: {str(e)}')


def normalize_features(features: list, normalizer: dict) -> np.ndarray:
    """Apply z-score normalization to feature array"""
    mean = normalizer['mean']
    std = normalizer['std']

    # Convert to numpy array
    X = np.array(features).reshape(1, -1)

    # Handle dict-based normalizer
    if isinstance(mean, dict):
        # Extract mean and std as arrays in feature order
        feature_names = normalizer.get('feature_names', list(mean.keys()))
        mean_arr = np.array([mean[fname] for fname in feature_names])
        std_arr = np.array([std[fname] for fname in feature_names])
    else:
        mean_arr = np.array(mean)
        std_arr = np.array(std)

    # Validate dimensions
    if X.shape[1] != len(mean_arr):
        raise Exception(f'Feature count mismatch: got {X.shape[1]} features, expected {len(mean_arr)}')

    # Z-score normalization: (X - mean) / std
    X_norm = (X - mean_arr) / std_arr

    # Replace any NaN or inf with 0
    X_norm = np.nan_to_num(X_norm, nan=0.0, posinf=0.0, neginf=0.0)

    return X_norm


def predict(features: list, model_path: str, normalizer_path: str) -> dict:
    """Make prediction using LightGBM model"""
    try:
        # Load model
        model = lgb.Booster(model_file=model_path)

        # Load normalizer
        normalizer = load_normalizer(normalizer_path)

        # Normalize features
        X_norm = normalize_features(features, normalizer)

        # Make prediction
        raw_prediction = model.predict(X_norm)[0]

        # Handle different prediction types
        if isinstance(raw_prediction, np.ndarray):
            # Multi-class classification
            if len(raw_prediction) == 3:
                # 3-class: [prob_down, prob_neutral, prob_up]
                prob_down = float(raw_prediction[0])
                prob_neutral = float(raw_prediction[1])
                prob_up = float(raw_prediction[2])

                # Predicted class
                predicted_class = int(np.argmax(raw_prediction))
                value = float(predicted_class - 1)  # Map to -1, 0, 1
                confidence = float(np.max(raw_prediction))

                return {
                    'prediction': value,
                    'confidence': confidence,
                    'probability': {
                        'up': prob_up,
                        'down': prob_down,
                        'neutral': prob_neutral
                    }
                }
            elif len(raw_prediction) == 2:
                # Binary classification: [prob_class0, prob_class1]
                prob_negative = float(raw_prediction[0])
                prob_positive = float(raw_prediction[1])

                # Class 1 probability
                value = prob_positive
                confidence = max(prob_positive, prob_negative)

                return {
                    'prediction': 1 if prob_positive > 0.5 else 0,
                    'confidence': confidence,
                }
            else:
                raise Exception(f'Unexpected prediction array size: {len(raw_prediction)}')
        else:
            # Regression prediction (scalar value)
            prediction = float(raw_prediction)

            # For regression, confidence is based on prediction magnitude
            # Volatility predictions are percentage values (e.g., 25.5%)
            # Use a simple heuristic: higher values = higher confidence
            if prediction > 0:
                # For positive regression values
                confidence = min(abs(prediction) / 100.0, 1.0)
            else:
                confidence = 0.5

            return {
                'prediction': prediction,
                'confidence': max(0.3, min(confidence, 0.9))  # Clamp to [0.3, 0.9]
            }

    except Exception as e:
        raise Exception(f'Prediction failed: {str(e)}')


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='LightGBM CLI Prediction')
    parser.add_argument('--features', type=str, required=True, help='JSON array of features')
    parser.add_argument('--model-path', type=str, required=True, help='Path to model file')
    parser.add_argument('--normalizer-path', type=str, required=True, help='Path to normalizer JSON')

    args = parser.parse_args()

    try:
        # Parse features
        features = json.loads(args.features)

        if not isinstance(features, list):
            raise ValueError('Features must be a JSON array')

        # Make prediction
        result = predict(features, args.model_path, args.normalizer_path)

        # Output JSON result
        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        # Output error as JSON
        print(json.dumps({
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
