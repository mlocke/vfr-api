#!/usr/bin/env python3
"""
Train Smart Money Flow Model (Lean 20-Feature Version)

Features (20 total):
- Congressional trading (4): buy_count, sell_count, net_sentiment, recent_activity_7d
- Volume analysis (3): institutional_volume_ratio, volume_concentration, dark_pool_volume_30d
- Price momentum (3): price_momentum_20d, volume_trend_30d, price_volatility_30d
- SEC Form 4 insider trading (4): buy_volume, sell_volume, buy_ratio, transaction_count
- SEC 13F institutional (3): ownership_pct, holders_count, ownership_change_qtd
- Polygon advanced volume (2): block_trade_ratio, vwap_deviation
- EODHD options flow (1): put_call_ratio

Usage:
    python3 scripts/ml/train-smart-money-lean.py
"""

import os
import json
import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
import matplotlib.pyplot as plt

# Paths
DATA_DIR = "data/training/smart-money-flow-lean"
MODEL_DIR = "models/smart-money-flow/v3.0.0"
TRAIN_FILE = f"{DATA_DIR}/train.csv"
VAL_FILE = f"{DATA_DIR}/val.csv"
TEST_FILE = f"{DATA_DIR}/test.csv"

# Feature names (must match CSV column order and LeanSmartMoneyFeatures interface)
FEATURE_NAMES = [
    # Original 10 features
    "congress_buy_count_90d",
    "congress_sell_count_90d",
    "congress_net_sentiment",
    "congress_recent_activity_7d",
    "institutional_volume_ratio",
    "volume_concentration",
    "dark_pool_volume_30d",
    "price_momentum_20d",
    "volume_trend_30d",
    "price_volatility_30d",
    # New 10 features (SEC EDGAR, Polygon, EODHD)
    "insider_buy_volume_30d",
    "insider_sell_volume_30d",
    "insider_buy_ratio_30d",
    "insider_transaction_count_30d",
    "inst_ownership_pct",
    "inst_holders_count",
    "inst_ownership_change_qtd",
    "block_trade_ratio_30d",
    "vwap_deviation_avg_30d",
    "options_put_call_ratio_7d",
]

def load_data():
    """Load and prepare training, validation, and test datasets"""
    print(f"Loading data from {DATA_DIR}...")

    train_df = pd.read_csv(TRAIN_FILE)
    val_df = pd.read_csv(VAL_FILE)
    test_df = pd.read_csv(TEST_FILE)

    print(f"Train set: {len(train_df)} samples")
    print(f"Val set: {len(val_df)} samples")
    print(f"Test set: {len(test_df)} samples")

    # Check label distribution
    print(f"\nLabel distribution (train):")
    print(train_df['label'].value_counts())
    print(f"\nLabel distribution (val):")
    print(val_df['label'].value_counts())

    # Separate features and labels
    X_train = train_df[FEATURE_NAMES].values
    y_train = train_df['label'].values
    X_val = val_df[FEATURE_NAMES].values
    y_val = val_df['label'].values
    X_test = test_df[FEATURE_NAMES].values
    y_test = test_df['label'].values

    return X_train, y_train, X_val, y_val, X_test, y_test

def calculate_normalizer_params(X_train):
    """Calculate z-score normalization parameters"""
    means = np.mean(X_train, axis=0)
    stds = np.std(X_train, axis=0)

    # Handle zero std (constant features)
    stds[stds == 0] = 1.0

    return means, stds

def normalize_features(X, means, stds):
    """Apply z-score normalization"""
    return (X - means) / stds

def train_model(X_train, y_train, X_val, y_val):
    """Train LightGBM model with class balancing"""
    print("\nTraining LightGBM model...")

    # Calculate class weights for imbalanced data
    class_counts = np.bincount(y_train)
    total = len(y_train)
    weight_for_0 = total / (2 * class_counts[0])
    weight_for_1 = total / (2 * class_counts[1])
    sample_weights = np.array([weight_for_0 if y == 0 else weight_for_1 for y in y_train])

    print(f"Class weights: 0={weight_for_0:.3f}, 1={weight_for_1:.3f}")

    # Create LightGBM datasets
    train_data = lgb.Dataset(
        X_train,
        label=y_train,
        weight=sample_weights,
        feature_name=FEATURE_NAMES
    )
    val_data = lgb.Dataset(
        X_val,
        label=y_val,
        reference=train_data,
        feature_name=FEATURE_NAMES
    )

    # Hyperparameters optimized for imbalanced binary classification
    params = {
        'objective': 'binary',
        'metric': 'auc',
        'boosting_type': 'gbdt',
        'num_leaves': 31,
        'learning_rate': 0.05,
        'max_depth': 6,
        'min_data_in_leaf': 20,
        'feature_fraction': 0.8,
        'bagging_fraction': 0.8,
        'bagging_freq': 5,
        'lambda_l1': 0.1,
        'lambda_l2': 0.1,
        'verbose': 1,
        'is_unbalance': True,  # Handle class imbalance
    }

    # Train with early stopping
    model = lgb.train(
        params,
        train_data,
        num_boost_round=500,
        valid_sets=[train_data, val_data],
        valid_names=['train', 'val'],
        callbacks=[
            lgb.early_stopping(stopping_rounds=50, verbose=True),
            lgb.log_evaluation(period=10)
        ]
    )

    return model

def evaluate_model(model, X, y, dataset_name):
    """Evaluate model performance"""
    print(f"\nEvaluating on {dataset_name} set...")

    # Get predictions
    y_pred_proba = model.predict(X, num_iteration=model.best_iteration)
    y_pred = (y_pred_proba > 0.5).astype(int)

    # Calculate metrics
    accuracy = accuracy_score(y, y_pred)

    # Handle edge cases where a class has no predictions
    precision = precision_score(y, y_pred, zero_division=0)
    recall = recall_score(y, y_pred, zero_division=0)
    f1 = f1_score(y, y_pred, zero_division=0)

    try:
        roc_auc = roc_auc_score(y, y_pred_proba)
    except ValueError:
        roc_auc = 0.5  # Only one class present

    cm = confusion_matrix(y, y_pred)

    print(f"Accuracy: {accuracy:.4f}")
    print(f"ROC-AUC: {roc_auc:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall: {recall:.4f}")
    print(f"F1 Score: {f1:.4f}")
    print(f"Confusion Matrix:\n{cm}")

    return {
        'accuracy': accuracy,
        'roc_auc': roc_auc,
        'precision': precision,
        'recall': recall,
        'f1_score': f1,
        'confusion_matrix': cm.tolist()
    }

def save_model(model, means, stds, train_metrics, val_metrics, test_metrics):
    """Save model, normalizer, and metadata"""
    print(f"\nSaving model to {MODEL_DIR}...")

    # Create directory
    os.makedirs(MODEL_DIR, exist_ok=True)

    # Save LightGBM model
    model_path = f"{MODEL_DIR}/model.txt"
    model.save_model(model_path)
    print(f"✅ Model saved: {model_path}")

    # Save normalizer parameters
    normalizer = {
        'means': means.tolist(),
        'stds': stds.tolist(),
        'features': FEATURE_NAMES,
        'num_features': len(FEATURE_NAMES)
    }
    normalizer_path = f"{MODEL_DIR}/normalizer.json"
    with open(normalizer_path, 'w') as f:
        json.dump(normalizer, f, indent=2)
    print(f"✅ Normalizer saved: {normalizer_path}")

    # Save metadata
    feature_importance = model.feature_importance(importance_type='gain')
    feature_importance_list = [
        {'feature': name, 'importance': float(importance)}
        for name, importance in zip(FEATURE_NAMES, feature_importance)
    ]
    feature_importance_list.sort(key=lambda x: x['importance'], reverse=True)

    metadata = {
        'model_type': 'LightGBM Binary Classifier',
        'model_version': 'v3.0.0',
        'trained_at': pd.Timestamp.now().isoformat(),
        'num_features': len(FEATURE_NAMES),
        'features': FEATURE_NAMES,
        'feature_importance': feature_importance_list,
        'train_metrics': train_metrics,
        'val_metrics': val_metrics,
        'test_metrics': test_metrics,
        'hyperparameters': model.params,
        'best_iteration': model.best_iteration,
        'total_iterations': model.num_trees()
    }

    metadata_path = f"{MODEL_DIR}/metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"✅ Metadata saved: {metadata_path}")

    # Plot feature importance
    plot_feature_importance(feature_importance_list)

def plot_feature_importance(feature_importance_list):
    """Plot and save feature importance"""
    features = [f['feature'] for f in feature_importance_list]
    importances = [f['importance'] for f in feature_importance_list]

    plt.figure(figsize=(12, 8))
    plt.barh(features, importances)
    plt.xlabel('Importance (Gain)')
    plt.title('Smart Money Flow - Feature Importance (Lean 20 Features)')
    plt.tight_layout()

    plot_path = f"{MODEL_DIR}/feature_importance.png"
    plt.savefig(plot_path, dpi=150, bbox_inches='tight')
    print(f"✅ Feature importance plot saved: {plot_path}")
    plt.close()

def main():
    """Main training pipeline"""
    print("=" * 60)
    print("Smart Money Flow Model Training (Lean 20 Features)")
    print("=" * 60)

    # Load data
    X_train, y_train, X_val, y_val, X_test, y_test = load_data()

    # Calculate normalization parameters
    print("\nCalculating normalization parameters...")
    means, stds = calculate_normalizer_params(X_train)

    # Normalize features
    print("Normalizing features...")
    X_train_norm = normalize_features(X_train, means, stds)
    X_val_norm = normalize_features(X_val, means, stds)
    X_test_norm = normalize_features(X_test, means, stds)

    # Train model
    model = train_model(X_train_norm, y_train, X_val_norm, y_val)

    # Evaluate on all datasets
    train_metrics = evaluate_model(model, X_train_norm, y_train, "train")
    val_metrics = evaluate_model(model, X_val_norm, y_val, "validation")
    test_metrics = evaluate_model(model, X_test_norm, y_test, "test")

    # Save everything
    save_model(model, means, stds, train_metrics, val_metrics, test_metrics)

    print("\n" + "=" * 60)
    print("✅ Training complete!")
    print("=" * 60)
    print(f"\nTest set performance:")
    print(f"  Accuracy: {test_metrics['accuracy']:.4f}")
    print(f"  ROC-AUC: {test_metrics['roc_auc']:.4f}")
    print(f"  Precision: {test_metrics['precision']:.4f}")
    print(f"  Recall: {test_metrics['recall']:.4f}")
    print(f"  F1 Score: {test_metrics['f1_score']:.4f}")

if __name__ == "__main__":
    main()
