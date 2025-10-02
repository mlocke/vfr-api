#!/usr/bin/env python3
"""
Early Signal Detection - LightGBM Model Training
Train a production-grade gradient boosting model
"""

import pandas as pd
import numpy as np
import lightgbm as lgb
import json
import os
from sklearn.metrics import accuracy_score, roc_auc_score, precision_score, recall_score, f1_score
from datetime import datetime

FEATURE_NAMES = [
    'price_change_5d',
    'price_change_10d',
    'price_change_20d',
    'volume_ratio',
    'volume_trend',
    'sentiment_news_delta',
    'sentiment_reddit_accel',
    'sentiment_options_shift',
    'earnings_surprise',
    'revenue_growth_accel',
    'analyst_coverage_change',
    'rsi_momentum',
    'macd_histogram_trend'
]

def load_data():
    """Load training and validation datasets"""
    print("Loading training data...")
    train_df = pd.read_csv('data/training/train.csv')
    val_df = pd.read_csv('data/training/val.csv')

    print(f"✓ Loaded {len(train_df)} training examples")
    print(f"✓ Loaded {len(val_df)} validation examples")

    return train_df, val_df

def prepare_data(train_df, val_df):
    """Prepare features and labels"""
    X_train = train_df[FEATURE_NAMES].values
    y_train = train_df['label'].values

    X_val = val_df[FEATURE_NAMES].values
    y_val = val_df['label'].values

    # Calculate normalization parameters from training data
    mean = X_train.mean(axis=0)
    std = X_train.std(axis=0)
    std[std == 0] = 1  # Prevent division by zero

    # Normalize
    X_train_norm = (X_train - mean) / std
    X_val_norm = (X_val - mean) / std

    print("\n✓ Features normalized (z-score)")

    return X_train_norm, y_train, X_val_norm, y_val, mean, std

def train_model(X_train, y_train, X_val, y_val):
    """Train LightGBM model"""
    print("\nTraining LightGBM model...")
    print("  Algorithm: Gradient Boosting")
    print("  Objective: Binary Classification")
    print("  Num leaves: 31")
    print("  Learning rate: 0.05")
    print("  Boosting rounds: 200")

    # Create LightGBM datasets
    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)

    # Training parameters
    params = {
        'objective': 'binary',
        'metric': ['binary_logloss', 'auc'],
        'num_leaves': 31,
        'learning_rate': 0.05,
        'feature_fraction': 0.8,
        'bagging_fraction': 0.8,
        'bagging_freq': 5,
        'verbose': -1
    }

    # Train with early stopping
    model = lgb.train(
        params,
        train_data,
        num_boost_round=200,
        valid_sets=[val_data],
        callbacks=[
            lgb.early_stopping(stopping_rounds=20),
            lgb.log_evaluation(period=50)
        ]
    )

    print("\n✓ Model training complete")
    print(f"  Best iteration: {model.best_iteration}")
    print(f"  Best score: {model.best_score['valid_0']['auc']:.4f}")

    return model

def evaluate_model(model, X_val, y_val):
    """Evaluate model on validation set"""
    print("\nValidating on validation set...")

    # Get predictions
    y_pred_proba = model.predict(X_val, num_iteration=model.best_iteration)
    y_pred = (y_pred_proba >= 0.5).astype(int)

    # Calculate metrics
    accuracy = accuracy_score(y_val, y_pred)
    auc = roc_auc_score(y_val, y_pred_proba)
    precision = precision_score(y_val, y_pred, zero_division=0)
    recall = recall_score(y_val, y_pred, zero_division=0)
    f1 = f1_score(y_val, y_pred, zero_division=0)

    print(f"  Validation Accuracy: {accuracy * 100:.1f}%")
    print(f"  AUC: {auc:.3f}")
    print(f"  Precision: {precision * 100:.1f}%")
    print(f"  Recall: {recall * 100:.1f}%")
    print(f"  F1 Score: {f1:.3f}")

    return {
        'accuracy': float(accuracy),
        'auc': float(auc),
        'precision': float(precision),
        'recall': float(recall),
        'f1': float(f1)
    }

def get_feature_importance(model):
    """Calculate feature importance"""
    importance = model.feature_importance(importance_type='gain')
    total = importance.sum()

    feature_importance = {}
    for i, name in enumerate(FEATURE_NAMES):
        feature_importance[name] = float(importance[i] / total)

    # Sort by importance
    sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)

    print("\nTop 5 Features:")
    for i, (name, imp) in enumerate(sorted_features[:5], 1):
        print(f"  {i}. {name}: {imp * 100:.1f}%")

    return feature_importance

def save_model(model, mean, std, feature_importance, metrics):
    """Save model and metadata"""
    print("\nSaving model...")

    model_dir = 'models/early-signal/v1.0.0'
    os.makedirs(model_dir, exist_ok=True)

    # Save LightGBM model
    model.save_model(os.path.join(model_dir, 'model.txt'))

    # Save normalizer
    normalizer = {
        'mean': mean.tolist(),
        'std': std.tolist()
    }
    with open(os.path.join(model_dir, 'normalizer.json'), 'w') as f:
        json.dump(normalizer, f, indent=2)

    # Save metadata
    metadata = {
        'version': '1.0.0',
        'algorithm': 'LightGBM Gradient Boosting',
        'trainedAt': datetime.now().isoformat(),
        'featureNames': FEATURE_NAMES,
        'featureImportance': feature_importance,
        'normalizationParams': normalizer,
        'validationMetrics': metrics
    }

    with open(os.path.join(model_dir, 'metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"✓ Model saved to {model_dir}/")
    print("  - model.txt (LightGBM model)")
    print("  - normalizer.json (normalization parameters)")
    print("  - metadata.json (model info and metrics)")

def main():
    print("🔮 ML Early Signal - LightGBM Model Training")
    print("=" * 80)

    # Load data
    train_df, val_df = load_data()

    # Prepare data
    X_train, y_train, X_val, y_val, mean, std = prepare_data(train_df, val_df)

    # Train model
    model = train_model(X_train, y_train, X_val, y_val)

    # Evaluate
    metrics = evaluate_model(model, X_val, y_val)

    # Feature importance
    feature_importance = get_feature_importance(model)

    # Save
    save_model(model, mean, std, feature_importance, metrics)

    print("\n" + "=" * 80)
    print("✅ LightGBM Model Training Complete")
    print("=" * 80)
    print("\n💡 Next step: Evaluate model on test set")
    print("   npx tsx scripts/ml/evaluate-early-signal-model.ts")
    print("=" * 80)

if __name__ == '__main__':
    main()
