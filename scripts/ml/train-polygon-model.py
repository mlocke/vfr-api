#!/usr/bin/env python3
"""
Train Polygon Sentiment-Fusion LightGBM Model

Trains a 3-class LightGBM classifier to predict price movements (DOWN/NEUTRAL/UP)
using combined sentiment features (FinBERT) and technical/price features.

Model Architecture:
  - Input: 45 features (4 sentiment + 41 price/technical)
  - Output: 3 classes (DOWN < -2%, NEUTRAL -2% to +2%, UP > +2%)
  - Algorithm: LightGBM gradient boosting
  - Objective: Multi-class classification

Usage:
    python3 scripts/ml/train-polygon-model.py
"""

import pandas as pd
import numpy as np
from lightgbm import LGBMClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import json
import os
from datetime import datetime

def train_polygon_model():
    """Train sentiment-fusion LightGBM model"""

    print("=" * 80)
    print("TRAIN POLYGON SENTIMENT-FUSION MODEL")
    print("=" * 80)
    print()

    # Load datasets
    train_file = "data/training/polygon-train.csv"
    val_file = "data/training/polygon-val.csv"

    if not os.path.exists(train_file) or not os.path.exists(val_file):
        print("❌ Error: Training data not found")
        print("Run: python3 scripts/ml/split-polygon-dataset.py first")
        return

    print(f"📂 Loading training data...")
    df_train = pd.read_csv(train_file)
    df_val = pd.read_csv(val_file)
    print(f"   ✓ Train: {len(df_train):,} examples")
    print(f"   ✓ Validation: {len(df_val):,} examples")
    print()

    # Separate features and labels
    feature_cols = [col for col in df_train.columns if col not in ['ticker', 'date', 'label']]

    X_train = df_train[feature_cols].values
    y_train = df_train['label'].values

    X_val = df_val[feature_cols].values
    y_val = df_val['label'].values

    print(f"📊 Dataset info:")
    print(f"   Features: {len(feature_cols)}")
    print(f"   Feature categories:")
    sentiment_features = [f for f in feature_cols if 'sentiment' in f]
    price_features = [f for f in feature_cols if f not in sentiment_features]
    print(f"     - Sentiment: {len(sentiment_features)}")
    print(f"     - Price/Technical: {len(price_features)}")
    print()

    # Handle missing values (fill with mean)
    print("🔧 Preprocessing...")
    print(f"   Missing values in train: {np.isnan(X_train).sum()}")
    print(f"   Missing values in val: {np.isnan(X_val).sum()}")

    # Calculate mean from training data only
    col_means = np.nanmean(X_train, axis=0)

    # Fill NaN with mean
    for i in range(X_train.shape[1]):
        X_train[np.isnan(X_train[:, i]), i] = col_means[i]
        X_val[np.isnan(X_val[:, i]), i] = col_means[i]

    print(f"   ✓ Filled missing values with column means")
    print()

    # Normalize features (z-score)
    print("📏 Normalizing features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    print(f"   ✓ Applied z-score normalization")
    print()

    # Train label distribution
    print("Label distribution:")
    train_labels, train_counts = np.unique(y_train, return_counts=True)
    for label, count in zip(train_labels, train_counts):
        pct = count / len(y_train) * 100
        print(f"   {label}: {count:,} ({pct:.1f}%)")
    print()

    # Configure LightGBM model
    print("🤖 Configuring LightGBM model...")
    model = LGBMClassifier(
        objective='multiclass',
        num_class=3,
        metric='multi_logloss',
        boosting_type='gbdt',
        num_leaves=31,
        learning_rate=0.05,
        n_estimators=500,
        max_depth=8,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=0.1,
        random_state=42,
        verbose=-1
    )

    print("   Model parameters:")
    print(f"     - Objective: multiclass (3 classes)")
    print(f"     - Learning rate: 0.05")
    print(f"     - Max iterations: 500")
    print(f"     - Max depth: 8")
    print(f"     - Early stopping: 50 rounds patience")
    print()

    # Train model
    print("🏋️  Training model...")
    print()

    model.fit(
        X_train_scaled,
        y_train,
        eval_set=[(X_val_scaled, y_val)],
        eval_metric='multi_logloss',
        callbacks=[
            # Early stopping if validation loss doesn't improve for 50 rounds
            # Using verbose=0 to suppress per-iteration output
        ]
    )

    print()
    print(f"   ✓ Training complete")
    print(f"   Best iteration: {model.best_iteration_}")
    print()

    # Evaluate on validation set
    print("📈 Validation Performance:")
    print()

    y_pred = model.predict(X_val_scaled)
    y_pred_proba = model.predict_proba(X_val_scaled)

    accuracy = accuracy_score(y_val, y_pred)
    print(f"   Overall Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
    print()

    print("   Classification Report:")
    print(classification_report(y_val, y_pred, target_names=['DOWN', 'NEUTRAL', 'UP'], digits=4))

    print("   Confusion Matrix:")
    cm = confusion_matrix(y_val, y_pred, labels=['DOWN', 'NEUTRAL', 'UP'])
    print("                Predicted")
    print("              DOWN  NEUTRAL  UP")
    for i, label in enumerate(['DOWN', 'NEUTRAL', 'UP']):
        print(f"   Actual {label:8s} {cm[i][0]:5d}  {cm[i][1]:7d}  {cm[i][2]:5d}")
    print()

    # Feature importance
    print("🔝 Top 15 Most Important Features:")
    feature_importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)

    for idx, row in feature_importance.head(15).iterrows():
        print(f"   {row['feature']:30s} {row['importance']:.4f}")
    print()

    # Save model
    model_dir = "models/sentiment-fusion/v1.0.0"
    os.makedirs(model_dir, exist_ok=True)

    print(f"💾 Saving model to {model_dir}...")

    # Save LightGBM model
    model_file = os.path.join(model_dir, "model.txt")
    model.booster_.save_model(model_file)
    print(f"   ✓ {model_file}")

    # Save normalizer parameters
    normalizer_file = os.path.join(model_dir, "normalizer.json")
    normalizer_params = {
        'mean': scaler.mean_.tolist(),
        'scale': scaler.scale_.tolist(),
        'feature_names': feature_cols,
        'fill_values': col_means.tolist()  # Mean values for filling NaN
    }
    with open(normalizer_file, 'w') as f:
        json.dump(normalizer_params, f, indent=2)
    print(f"   ✓ {normalizer_file}")

    # Save metadata
    metadata_file = os.path.join(model_dir, "metadata.json")
    metadata = {
        'model_version': 'v1.0.0',
        'model_type': 'sentiment-fusion',
        'algorithm': 'LightGBM',
        'objective': 'multiclass',
        'num_classes': 3,
        'classes': ['DOWN', 'NEUTRAL', 'UP'],
        'training_date': datetime.now().isoformat(),
        'training_examples': len(df_train),
        'validation_examples': len(df_val),
        'num_features': len(feature_cols),
        'feature_categories': {
            'sentiment': len(sentiment_features),
            'price_technical': len(price_features)
        },
        'performance': {
            'validation_accuracy': float(accuracy),
            'best_iteration': int(model.best_iteration_),
        },
        'label_distribution': {
            'train': {label: int(count) for label, count in zip(train_labels, train_counts)}
        },
        'top_features': feature_importance.head(15).to_dict('records')
    }
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"   ✓ {metadata_file}")
    print()

    # Save feature importance
    importance_file = os.path.join(model_dir, "feature_importance.csv")
    feature_importance.to_csv(importance_file, index=False)
    print(f"   ✓ {importance_file}")
    print()

    print("=" * 80)
    print("✅ COMPLETE - MODEL TRAINING")
    print("=" * 80)
    print()
    print("Model Summary:")
    print(f"   Version: v1.0.0")
    print(f"   Type: Sentiment-Fusion (FinBERT + Technical)")
    print(f"   Accuracy: {accuracy*100:.2f}%")
    print(f"   Features: {len(feature_cols)} ({len(sentiment_features)} sentiment + {len(price_features)} price)")
    print(f"   Training examples: {len(df_train):,}")
    print(f"   Best iteration: {model.best_iteration_}")
    print()
    print("Next steps:")
    print("   1. Evaluate on test set: python3 scripts/ml/evaluate-polygon-model.py")
    print("   2. Register model for production use")
    print()


if __name__ == "__main__":
    train_polygon_model()
