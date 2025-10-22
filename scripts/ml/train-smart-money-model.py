#!/usr/bin/env python3
"""
Train LightGBM model for smart money flow prediction.

Model predicts if a stock will have a positive 14-day return (>2%) based on
smart money indicators: insider trading, institutional ownership, congressional
trades, hedge fund activity, and ETF flows.

Target: Binary classification (0 = negative/neutral, 1 = positive return >2%)
"""

import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.metrics import accuracy_score, roc_auc_score, precision_score, recall_score, f1_score, confusion_matrix
import json
from pathlib import Path
import sys
from datetime import datetime

def load_data():
    """Load train and validation datasets"""

    # Use comprehensive dataset with all available features
    train_path = "data/training/smart-money-flow-comprehensive/train.csv"
    val_path = "data/training/smart-money-flow-comprehensive/val.csv"

    print(f"📖 Loading datasets...")
    print(f"   Using comprehensive dataset with all features")

    if not Path(train_path).exists():
        print(f"❌ Train file not found: {train_path}")
        sys.exit(1)

    if not Path(val_path).exists():
        print(f"❌ Validation file not found: {val_path}")
        sys.exit(1)

    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)

    print(f"   ✓ Train: {len(train_df):,} rows")
    print(f"   ✓ Val: {len(val_df):,} rows")

    return train_df, val_df

def prepare_features(df):
    """Extract features and labels from dataframe"""

    # Identify feature columns (exclude metadata and target)
    exclude_cols = ['symbol', 'date', 'price_at_sample', 'price_after_14d', 'return_14d', 'label']
    feature_cols = [col for col in df.columns if col not in exclude_cols]

    X = df[feature_cols].values
    y = df['label'].values

    return X, y, feature_cols

def normalize_features(X_train, X_val):
    """Normalize features using z-score normalization"""

    print(f"\n🔢 Normalizing features...")

    # Calculate mean and std from training set only
    mean = np.mean(X_train, axis=0)
    std = np.std(X_train, axis=0)

    # Avoid division by zero
    std[std == 0] = 1.0

    # Normalize both sets using training statistics
    X_train_norm = (X_train - mean) / std
    X_val_norm = (X_val - mean) / std

    print(f"   ✓ Features normalized (z-score)")

    return X_train_norm, X_val_norm, mean.tolist(), std.tolist()

def train_model(X_train, y_train, X_val, y_val):
    """Train LightGBM model with early stopping and class balancing"""

    print(f"\n🎯 Training LightGBM model...")

    # Calculate class weights for imbalanced dataset
    unique, counts = np.unique(y_train, return_counts=True)
    class_counts = dict(zip(unique, counts))

    # Calculate scale_pos_weight (ratio of negative to positive)
    neg_count = class_counts.get(0, 1)
    pos_count = class_counts.get(1, 1)
    scale_pos_weight = neg_count / pos_count

    print(f"\n⚖️  Class Balance:")
    print(f"   Negative (0): {neg_count:,} ({neg_count/(neg_count+pos_count)*100:.1f}%)")
    print(f"   Positive (1): {pos_count:,} ({pos_count/(neg_count+pos_count)*100:.1f}%)")
    print(f"   Scale pos weight: {scale_pos_weight:.2f}")

    # Create LightGBM datasets
    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)

    # Model hyperparameters with class balancing
    params = {
        'objective': 'binary',
        'metric': 'auc',
        'boosting_type': 'gbdt',
        'num_leaves': 31,
        'learning_rate': 0.05,
        'feature_fraction': 0.8,
        'bagging_fraction': 0.8,
        'bagging_freq': 5,
        'max_depth': 6,
        'min_child_samples': 20,
        'lambda_l1': 0.1,
        'lambda_l2': 0.1,
        'verbose': 1,
        'force_col_wise': True,
        # CLASS BALANCING PARAMETER
        'scale_pos_weight': scale_pos_weight  # Weight positive class more heavily to handle imbalance
    }

    # Train with early stopping
    model = lgb.train(
        params,
        train_data,
        num_boost_round=500,
        valid_sets=[train_data, val_data],
        valid_names=['train', 'valid'],
        callbacks=[
            lgb.early_stopping(stopping_rounds=30),
            lgb.log_evaluation(period=50)
        ]
    )

    print(f"\n   ✓ Training complete")
    print(f"   Best iteration: {model.best_iteration}")

    return model

def evaluate_model(model, X, y, dataset_name="Dataset"):
    """Evaluate model performance"""

    # Get predictions
    y_pred_proba = model.predict(X, num_iteration=model.best_iteration)
    y_pred = (y_pred_proba >= 0.5).astype(int)

    # Calculate metrics
    accuracy = accuracy_score(y, y_pred)
    roc_auc = roc_auc_score(y, y_pred_proba)
    precision = precision_score(y, y_pred, zero_division=0)
    recall = recall_score(y, y_pred, zero_division=0)
    f1 = f1_score(y, y_pred, zero_division=0)

    # Confusion matrix
    cm = confusion_matrix(y, y_pred)

    print(f"\n📊 {dataset_name} Performance:")
    print(f"   Accuracy:  {accuracy:.4f}")
    print(f"   ROC AUC:   {roc_auc:.4f}")
    print(f"   Precision: {precision:.4f}")
    print(f"   Recall:    {recall:.4f}")
    print(f"   F1 Score:  {f1:.4f}")

    print(f"\n   Confusion Matrix:")
    print(f"   TN: {cm[0][0]:,}  FP: {cm[0][1]:,}")
    print(f"   FN: {cm[1][0]:,}  TP: {cm[1][1]:,}")

    return {
        'accuracy': float(accuracy),
        'roc_auc': float(roc_auc),
        'precision': float(precision),
        'recall': float(recall),
        'f1_score': float(f1),
        'confusion_matrix': cm.tolist()
    }

def get_feature_importance(model, feature_cols):
    """Get top features by importance"""

    importance = model.feature_importance(importance_type='gain')
    feature_importance = list(zip(feature_cols, importance))
    feature_importance.sort(key=lambda x: x[1], reverse=True)

    print(f"\n🔝 Top 10 Features by Importance:")
    for i, (feature, imp) in enumerate(feature_importance[:10], 1):
        print(f"   {i:2d}. {feature:<40} {imp:>10.0f}")

    return [{'feature': feat, 'importance': float(imp)} for feat, imp in feature_importance]

def save_model(model, mean, std, feature_cols, train_metrics, val_metrics, feature_importance):
    """Save model, normalizer, and metadata"""

    output_dir = Path("models/smart-money-flow/v2.0.0")
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n💾 Saving model...")

    # Save LightGBM model
    model_path = output_dir / "model.txt"
    model.save_model(str(model_path))
    print(f"   ✓ {model_path}")

    # Save normalizer parameters
    normalizer_path = output_dir / "normalizer.json"
    normalizer = {
        'mean': mean,
        'std': std,
        'features': feature_cols
    }
    with open(normalizer_path, 'w') as f:
        json.dump(normalizer, f, indent=2)
    print(f"   ✓ {normalizer_path}")

    # Save metadata
    metadata_path = output_dir / "metadata.json"
    metadata = {
        'model_type': 'LightGBM Binary Classifier',
        'model_version': 'v2.0.0',
        'trained_at': datetime.now().isoformat(),
        'num_features': len(feature_cols),
        'features': feature_cols,
        'feature_importance': feature_importance,
        'train_metrics': train_metrics,
        'val_metrics': val_metrics,
        'hyperparameters': {
            'objective': 'binary',
            'metric': 'auc',
            'num_leaves': 31,
            'learning_rate': 0.05,
            'max_depth': 6,
            'lambda_l1': 0.1,
            'lambda_l2': 0.1,
            'scale_pos_weight': 'dynamic (calculated from class distribution)'
        },
        'best_iteration': model.best_iteration,
        'total_iterations': model.num_trees()
    }
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"   ✓ {metadata_path}")

def main():
    print("=" * 70)
    print("Smart Money Flow Model Training")
    print("=" * 70 + "\n")

    # Load data
    train_df, val_df = load_data()

    # Prepare features
    X_train, y_train, feature_cols = prepare_features(train_df)
    X_val, y_val, _ = prepare_features(val_df)

    print(f"\n📊 Dataset Info:")
    print(f"   Features: {len(feature_cols)}")
    print(f"   Train samples: {len(X_train):,}")
    print(f"   Val samples: {len(X_val):,}")

    print(f"\n   Train label distribution:")
    train_label_counts = pd.Series(y_train).value_counts().sort_index()
    for label, count in train_label_counts.items():
        pct = (count / len(y_train)) * 100
        print(f"   {label}: {count:,} ({pct:.1f}%)")

    # Normalize features
    X_train_norm, X_val_norm, mean, std = normalize_features(X_train, X_val)

    # Train model
    model = train_model(X_train_norm, y_train, X_val_norm, y_val)

    # Evaluate
    train_metrics = evaluate_model(model, X_train_norm, y_train, "Training Set")
    val_metrics = evaluate_model(model, X_val_norm, y_val, "Validation Set")

    # Feature importance
    feature_importance = get_feature_importance(model, feature_cols)

    # Save model
    save_model(model, mean, std, feature_cols, train_metrics, val_metrics, feature_importance)

    print("\n" + "=" * 70)
    print("✅ Model training complete!")
    print("=" * 70)

    print(f"\nNext steps:")
    print(f"  1. Evaluate on test set: python scripts/ml/evaluate-smart-money-model.py")
    print(f"  2. Register model: npx tsx scripts/ml/register-smart-money-model.ts")
    print(f"  3. Deploy to production API")

if __name__ == "__main__":
    main()
