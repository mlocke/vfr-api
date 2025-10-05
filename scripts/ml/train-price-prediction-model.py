#!/usr/bin/env python3
"""
Price Prediction Model Training Script

Trains a LightGBM multi-class classifier to predict price movements:
- UP: Price increase >2% in 7 days
- DOWN: Price decrease <-2% in 7 days
- NEUTRAL: Price change between -2% and +2%

Features: 43 price-relevant features
Target: 3-class classification (UP, DOWN, NEUTRAL)
Model: LightGBM gradient boosting

Usage:
    python scripts/ml/train-price-prediction-model.py
"""

import pandas as pd
import numpy as np
from lightgbm import LGBMClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
import json
import os
from datetime import datetime

# Paths
DATA_DIR = "data/training"
MODEL_DIR = "models/price-prediction/v1.1.0"  # Production model version
TRAIN_FILE = f"{DATA_DIR}/price-train.csv"
VAL_FILE = f"{DATA_DIR}/price-val.csv"
TEST_FILE = f"{DATA_DIR}/price-test.csv"

# Feature columns (43 features)
FEATURE_COLUMNS = [
    # Volume features (6)
    "volume_ratio_5d",
    "volume_spike",
    "volume_trend_10d",
    "relative_volume",
    "volume_acceleration",
    "dark_pool_ratio",
    # Technical indicators (10)
    "rsi_14",
    "macd_signal",
    "macd_histogram",
    "bollinger_position",
    "stochastic_k",
    "adx_14",
    "atr_14",
    "ema_20_distance",
    "sma_50_distance",
    "williams_r",
    # Price action (8)
    "price_momentum_5d",
    "price_momentum_10d",
    "price_momentum_20d",
    "price_acceleration",
    "gap_percent",
    "intraday_volatility",
    "overnight_return",
    "week_high_distance",
    # Options flow (7)
    "put_call_ratio",
    "put_call_ratio_change",
    "unusual_options_activity",
    "options_iv_rank",
    "gamma_exposure",
    "max_pain_distance",
    "options_volume_ratio",
    # Institutional flow (4)
    "institutional_net_flow",
    "block_trade_volume",
    "insider_buying_ratio",
    "ownership_change_30d",
    # Sentiment (4)
    "news_sentiment_delta",
    "social_momentum",
    "analyst_target_distance",
    "earnings_surprise_impact",
    # Macro context (4)
    "sector_momentum_5d",
    "spy_momentum_5d",
    "vix_level",
    "correlation_to_spy_20d",
]

# Label mapping
LABEL_MAP = {"DOWN": 0, "NEUTRAL": 1, "UP": 2}
LABEL_MAP_REVERSE = {0: "DOWN", 1: "NEUTRAL", 2: "UP"}


def load_dataset(filepath, dataset_name):
    """Load a single dataset file"""
    print(f"\nLoading {dataset_name} from {filepath}...")
    df = pd.read_csv(filepath)

    print(f"✓ Loaded {len(df)} examples")

    # Check for missing features
    missing_features = set(FEATURE_COLUMNS) - set(df.columns)
    if missing_features:
        print(f"⚠️  Missing features: {missing_features}")

    # Separate features and labels
    X = df[FEATURE_COLUMNS].copy()
    y = df["label"].map(LABEL_MAP)

    # Check for missing values
    missing_count = X.isnull().sum().sum()
    if missing_count > 0:
        print(f"⚠️  Found {missing_count} missing values, filling with 0")
        X = X.fillna(0)

    # Label distribution
    print(f"  Label Distribution:")
    for label, count in df["label"].value_counts().items():
        pct = (count / len(df)) * 100
        print(f"    {label}: {count} ({pct:.1f}%)")

    return X, y


def load_data():
    """Load pre-split train/val/test datasets"""
    print(f"\nDataset Configuration:")
    print(f"  Features: {len(FEATURE_COLUMNS)}")

    # Load train set
    X_train, y_train = load_dataset(TRAIN_FILE, "Training set")

    # Load validation set
    X_val, y_val = load_dataset(VAL_FILE, "Validation set")

    # Load test set
    X_test, y_test = load_dataset(TEST_FILE, "Test set")

    print(f"\n✓ Total examples: {len(X_train) + len(X_val) + len(X_test)}")

    return X_train, X_val, X_test, y_train, y_val, y_test


def normalize_features(X_train, X_val, X_test):
    """Normalize features using StandardScaler (z-score)"""
    print(f"\nNormalizing features...")

    scaler = StandardScaler()
    X_train_norm = scaler.fit_transform(X_train)
    X_val_norm = scaler.transform(X_val)
    X_test_norm = scaler.transform(X_test)

    print(f"✓ Features normalized (mean=0, std=1)")

    return X_train_norm, X_val_norm, X_test_norm, scaler


def train_model(X_train, y_train, X_val, y_val):
    """Train LightGBM multi-class classifier"""
    print(f"\nTraining LightGBM model...")
    print(f"  Algorithm: LightGBM Multi-Class Classifier")
    print(f"  Objective: multiclass")
    print(f"  Classes: 3 (DOWN, NEUTRAL, UP)")
    print(f"  Learning rate: 0.05")
    print(f"  Max iterations: 300")

    model = LGBMClassifier(
        objective="multiclass",
        num_class=3,
        metric="multi_logloss",
        boosting_type="gbdt",
        num_leaves=31,
        learning_rate=0.05,
        n_estimators=300,
        max_depth=8,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=0.1,
        class_weight="balanced",
        random_state=42,
        verbose=-1,
    )

    # Train with early stopping
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        eval_metric="multi_logloss",
        callbacks=[],  # Remove verbose callback for cleaner output
    )

    print(f"✓ Model trained successfully")
    print(f"  Best iteration: {model.best_iteration_}")

    return model


def evaluate_model(model, X_test, y_test):
    """Evaluate model on test set"""
    print(f"\nEvaluating on test set...")

    # Predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)

    # Overall accuracy
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\n✅ Overall Accuracy: {accuracy:.3f} ({accuracy*100:.1f}%)")

    # Classification report
    print(f"\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["DOWN", "NEUTRAL", "UP"]))

    # Confusion matrix
    print(f"Confusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    print(cm)
    print(f"  Rows: Actual, Columns: Predicted")
    print(f"  [DOWN, NEUTRAL, UP]")

    # Per-class metrics
    print(f"\nPer-Class Accuracy:")
    for i, label_name in enumerate(["DOWN", "NEUTRAL", "UP"]):
        class_mask = y_test == i
        if class_mask.sum() > 0:
            class_accuracy = accuracy_score(y_test[class_mask], y_pred[class_mask])
            print(f"  {label_name}: {class_accuracy:.3f} ({class_accuracy*100:.1f}%)")

    # Feature importance
    print(f"\nTop 10 Most Important Features:")
    feature_importance = pd.DataFrame(
        {"feature": FEATURE_COLUMNS, "importance": model.feature_importances_}
    ).sort_values("importance", ascending=False)

    for idx, row in feature_importance.head(10).iterrows():
        print(f"  {idx+1}. {row['feature']}: {row['importance']:.4f}")

    return {
        "accuracy": accuracy,
        "confusion_matrix": cm.tolist(),
        "feature_importance": feature_importance.to_dict("records"),
        "classification_report": classification_report(
            y_test, y_pred, target_names=["DOWN", "NEUTRAL", "UP"], output_dict=True
        ),
    }


def save_model(model, scaler, metrics):
    """Save model, scaler, and metadata"""
    print(f"\nSaving model...")

    # Create model directory
    os.makedirs(MODEL_DIR, exist_ok=True)

    # Save LightGBM model
    model_path = f"{MODEL_DIR}/model.txt"
    model.booster_.save_model(model_path)
    print(f"✓ Model saved: {model_path}")

    # Save scaler (normalizer)
    scaler_data = {
        "mean": scaler.mean_.tolist(),
        "std": scaler.scale_.tolist(),
        "feature_names": FEATURE_COLUMNS,
    }
    scaler_path = f"{MODEL_DIR}/normalizer.json"
    with open(scaler_path, "w") as f:
        json.dump(scaler_data, f, indent=2)
    print(f"✓ Scaler saved: {scaler_path}")

    # Save metadata
    metadata = {
        "version": "1.1.0",
        "model_type": "price_prediction",
        "algorithm": "LightGBM Multi-Class Classifier",
        "objective": "multiclass",
        "num_classes": 3,
        "class_labels": ["DOWN", "NEUTRAL", "UP"],
        "trained_at": datetime.now().isoformat(),
        "num_features": len(FEATURE_COLUMNS),
        "feature_names": FEATURE_COLUMNS,
        "metrics": metrics,
        "hyperparameters": {
            "objective": "multiclass",
            "num_class": 3,
            "learning_rate": 0.05,
            "n_estimators": 300,
            "max_depth": 8,
            "num_leaves": 31,
            "min_child_samples": 20,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "reg_alpha": 0.1,
            "reg_lambda": 0.1,
        },
    }

    metadata_path = f"{MODEL_DIR}/metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"✓ Metadata saved: {metadata_path}")


def main():
    """Main training pipeline"""
    print("=" * 80)
    print("🎯 Price Prediction Model Training v1.1.0 (Production)")
    print("=" * 80)

    # Load pre-split data
    X_train, X_val, X_test, y_train, y_val, y_test = load_data()

    # Normalize features
    X_train_norm, X_val_norm, X_test_norm, scaler = normalize_features(
        X_train, X_val, X_test
    )

    # Train model
    model = train_model(X_train_norm, y_train, X_val_norm, y_val)

    # Evaluate model
    metrics = evaluate_model(model, X_test_norm, y_test)

    # Save model
    save_model(model, scaler, metrics)

    print("\n" + "=" * 80)
    print("✅ Training Complete!")
    print("=" * 80)
    print(f"\nModel v1.1.0 saved to: {MODEL_DIR}/")
    print(f"  - model.txt (LightGBM model)")
    print(f"  - normalizer.json (feature scaling parameters)")
    print(f"  - metadata.json (model info and metrics)")
    print("\n💡 Next steps:")
    print("  1. Review model performance metrics above")
    print("  2. Update RealTimePredictionEngine for model selection")
    print("  3. Integrate price prediction model into production")
    print("=" * 80)


if __name__ == "__main__":
    main()
