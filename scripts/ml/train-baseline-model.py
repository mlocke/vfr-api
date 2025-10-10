#!/usr/bin/env python3
"""
Train Baseline LightGBM Model (43 Price Features Only)

Trains a LightGBM classifier on ONLY the 43 price/technical features,
excluding the 3 FinBERT sentiment features. This provides a baseline
to measure the contribution of FinBERT features.

Model: LightGBM Gradient Boosting Classifier
Features: 43 (price/technical only, NO FinBERT)
Labels: UP (>2%), DOWN (<-2%), NEUTRAL (-2% to +2%)
Dataset: Same combined dataset, but FinBERT features excluded

Output:
  - models/price-prediction/v1.2.0-baseline/model.txt (LightGBM model)
  - models/price-prediction/v1.2.0-baseline/normalizer.json (feature scaling params)
  - models/price-prediction/v1.2.0-baseline/metadata.json (training metrics)

Usage:
    python3 scripts/ml/train-baseline-model.py
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
from lightgbm import LGBMClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import json
import os
from datetime import datetime

def train_baseline_model():
    print("=" * 80)
    print("🚀 Training Baseline LightGBM (43 Features - NO FinBERT)")
    print("=" * 80)

    # Load datasets
    print("\n📂 Loading datasets...")
    train_df = pd.read_csv("data/training/combined-train.csv")
    val_df = pd.read_csv("data/training/combined-val.csv")
    print(f"✓ Train: {len(train_df):,} rows")
    print(f"✓ Val:   {len(val_df):,} rows")

    # Separate features and labels - EXCLUDE FinBERT features
    print("\n🔧 Preparing features (EXCLUDING FinBERT)...")
    all_feature_cols = [c for c in train_df.columns if c not in ['symbol', 'date', 'label']]

    # Filter out FinBERT features
    feature_cols = [c for c in all_feature_cols if 'finbert' not in c]
    finbert_features = [c for c in all_feature_cols if 'finbert' in c]

    print(f"✓ Total features: {len(all_feature_cols)}")
    print(f"  Using: {len(feature_cols)} (price/technical)")
    print(f"  Excluded: {len(finbert_features)} (FinBERT)")
    print(f"    {', '.join(finbert_features)}")

    X_train = train_df[feature_cols].values
    y_train = train_df['label'].values

    X_val = val_df[feature_cols].values
    y_val = val_df['label'].values

    # Encode labels
    label_encoder = LabelEncoder()
    y_train_encoded = label_encoder.fit_transform(y_train)
    y_val_encoded = label_encoder.transform(y_val)

    print(f"\n🏷️  Label mapping:")
    for i, label in enumerate(label_encoder.classes_):
        print(f"  {i} → {label}")

    # Feature normalization (z-score)
    print("\n📊 Normalizing features (z-score)...")
    means = X_train.mean(axis=0)
    stds = X_train.std(axis=0)
    stds[stds == 0] = 1  # Avoid division by zero

    X_train_normalized = (X_train - means) / stds
    X_val_normalized = (X_val - means) / stds
    print("✓ Features normalized")

    # Train LightGBM with SAME hyperparameters as combined model
    print("\n🌳 Training Baseline LightGBM...")
    print("  (Using same hyperparameters as v1.3.0 for fair comparison)")
    model = LGBMClassifier(
        objective='multiclass',
        num_class=3,
        metric='multi_logloss',
        learning_rate=0.05,
        max_depth=8,
        n_estimators=300,
        num_leaves=31,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=0.1,
        random_state=42,
        verbose=-1
    )

    model.fit(
        X_train_normalized,
        y_train_encoded,
        eval_set=[(X_val_normalized, y_val_encoded)],
        eval_metric='multi_logloss'
    )

    print("✓ Training complete")

    # Evaluate on validation set
    print("\n📊 Validation Performance:")
    y_val_pred = model.predict(X_val_normalized)
    y_val_pred_labels = label_encoder.inverse_transform(y_val_pred)

    accuracy = accuracy_score(y_val, y_val_pred_labels)
    print(f"\n  Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")

    print("\n  Classification Report:")
    print(classification_report(y_val, y_val_pred_labels, digits=4))

    print("  Confusion Matrix:")
    print(confusion_matrix(y_val, y_val_pred_labels))

    # Feature importance
    print("\n🎯 Top 20 Feature Importances:")
    feature_importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)

    for idx, row in feature_importance.head(20).iterrows():
        print(f"  📈 {row['feature']}: {row['importance']:.4f}")

    # Save model
    print("\n💾 Saving baseline model...")
    output_dir = "models/price-prediction/v1.2.0-baseline"
    os.makedirs(output_dir, exist_ok=True)

    # Save LightGBM model
    model_path = os.path.join(output_dir, "model.txt")
    model.booster_.save_model(model_path)
    print(f"✓ Model saved: {model_path}")

    # Save normalizer params
    normalizer_path = os.path.join(output_dir, "normalizer.json")
    normalizer = {
        'means': means.tolist(),
        'stds': stds.tolist(),
        'feature_names': feature_cols
    }
    with open(normalizer_path, 'w') as f:
        json.dump(normalizer, f, indent=2)
    print(f"✓ Normalizer saved: {normalizer_path}")

    # Save metadata
    metadata_path = os.path.join(output_dir, "metadata.json")
    metadata = {
        'model_name': 'LightGBM_Price_Prediction_Baseline',
        'version': 'v1.2.0-baseline',
        'description': 'Baseline model with 43 price features only (NO FinBERT)',
        'training_date': datetime.now().isoformat(),
        'num_train_examples': len(train_df),
        'num_val_examples': len(val_df),
        'num_features': len(feature_cols),
        'excluded_features': finbert_features,
        'hyperparameters': {
            'learning_rate': 0.05,
            'max_depth': 8,
            'n_estimators': 300,
            'num_leaves': 31,
            'min_child_samples': 20,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'reg_alpha': 0.1,
            'reg_lambda': 0.1
        },
        'validation_metrics': {
            'accuracy': float(accuracy)
        },
        'label_mapping': {str(i): label for i, label in enumerate(label_encoder.classes_)},
        'feature_importance': feature_importance.head(20).to_dict('records')
    }
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"✓ Metadata saved: {metadata_path}")

    print("\n" + "=" * 80)
    print("✅ Baseline Model Training Complete!")
    print("=" * 80)
    print(f"\nModel: {output_dir}")
    print(f"Validation Accuracy: {accuracy*100:.2f}%")
    print("\n💡 Next steps:")
    print("  1. Evaluate baseline on test set: python3 scripts/ml/evaluate-baseline-model.py")
    print("  2. Compare baseline vs FinBERT-enhanced model")
    print("=" * 80)

if __name__ == "__main__":
    train_baseline_model()
