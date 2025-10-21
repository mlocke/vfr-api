#!/usr/bin/env python3
"""
LightGBM Volatility Prediction Model Training Script

Purpose: Train volatility prediction model using prepared dataset
Author: VFR ML Team
Date: 2025-10-19

Input: data/volatility-train-mvp.csv, data/volatility-val-mvp.csv
Output: models/volatility-prediction/v1.0.0/ (model.txt, normalizer.json, metadata.json)

Target Performance:
- R² > 0.65 on validation set
- MAE < 5% (absolute volatility points)
- Inference latency < 100ms
"""

import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
from pathlib import Path
import json
from datetime import datetime
import matplotlib.pyplot as plt

# === Configuration ===
DATA_DIR = Path(__file__).parent.parent.parent / "data"
MODEL_DIR = Path(__file__).parent.parent.parent / "models" / "volatility-prediction" / "v1.0.0"

TRAIN_FILE = DATA_DIR / "volatility-train-mvp.csv"
VAL_FILE = DATA_DIR / "volatility-val-mvp.csv"

# LightGBM hyperparameters (optimized for regression)
LGBM_PARAMS = {
    'objective': 'regression',
    'metric': 'rmse',
    'boosting_type': 'gbdt',
    'num_leaves': 31,
    'learning_rate': 0.05,
    'feature_fraction': 0.8,
    'bagging_fraction': 0.8,
    'bagging_freq': 5,
    'verbose': -1,
    'min_data_in_leaf': 50,
    'lambda_l1': 0.1,  # L1 regularization
    'lambda_l2': 0.1,  # L2 regularization
    'max_depth': -1,   # No limit
    'min_gain_to_split': 0.01
}

NUM_BOOST_ROUNDS = 500
EARLY_STOPPING_ROUNDS = 50

print(f"🚀 Volatility Prediction Model Training")
print(f"📂 Data: {DATA_DIR}")
print(f"💾 Output: {MODEL_DIR}")


# === Load Data ===

def load_training_data():
    """Load and validate training/validation datasets"""
    print("\n📊 Loading training data...")

    # Load train
    if not TRAIN_FILE.exists():
        raise FileNotFoundError(f"Training file not found: {TRAIN_FILE}")

    train_df = pd.read_csv(TRAIN_FILE)
    print(f"   ✅ Train: {len(train_df):,} rows, {len(train_df.columns)} columns")

    # Load validation
    if not VAL_FILE.exists():
        raise FileNotFoundError(f"Validation file not found: {VAL_FILE}")

    val_df = pd.read_csv(VAL_FILE)
    print(f"   ✅ Val: {len(val_df):,} rows, {len(val_df.columns)} columns")

    return train_df, val_df


def prepare_features_and_target(df):
    """Separate features from target and metadata"""
    # Remove metadata columns
    metadata_cols = ['symbol', 'date']
    target_col = 'target_volatility'

    feature_cols = [c for c in df.columns if c not in metadata_cols + [target_col]]

    X = df[feature_cols]
    y = df[target_col]

    return X, y, feature_cols


# === Normalization ===

def calculate_normalization_stats(X_train):
    """Calculate z-score normalization statistics"""
    print("\n📐 Calculating normalization statistics...")

    normalizer = {
        'mean': X_train.mean().to_dict(),
        'std': X_train.std().to_dict(),
        'feature_names': X_train.columns.tolist()
    }

    print(f"   Features: {len(normalizer['feature_names'])}")
    return normalizer


def normalize_features(X, normalizer):
    """Apply z-score normalization"""
    X_norm = (X - pd.Series(normalizer['mean'])) / pd.Series(normalizer['std'])
    # Clip extreme outliers (>5 sigma)
    X_norm = X_norm.clip(-5, 5)
    return X_norm


# === Training ===

def train_model(X_train, y_train, X_val, y_val):
    """Train LightGBM model with early stopping"""
    print("\n🔧 Training LightGBM model...")

    # Create LightGBM datasets
    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)

    # Train
    print(f"   Parameters: {LGBM_PARAMS}")
    print(f"   Boost rounds: {NUM_BOOST_ROUNDS}, Early stopping: {EARLY_STOPPING_ROUNDS}")

    model = lgb.train(
        LGBM_PARAMS,
        train_data,
        num_boost_round=NUM_BOOST_ROUNDS,
        valid_sets=[train_data, val_data],
        valid_names=['train', 'val'],
        callbacks=[
            lgb.early_stopping(EARLY_STOPPING_ROUNDS),
            lgb.log_evaluation(50)
        ]
    )

    print(f"   ✅ Training completed")
    print(f"   Best iteration: {model.best_iteration}")

    return model


# === Evaluation ===

def evaluate_model(model, X_train, y_train, X_val, y_val):
    """Evaluate model performance"""
    print("\n📊 Evaluating model performance...")

    # Train predictions
    y_train_pred = model.predict(X_train)
    train_r2 = r2_score(y_train, y_train_pred)
    train_mae = mean_absolute_error(y_train, y_train_pred)
    train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))

    # Validation predictions
    y_val_pred = model.predict(X_val)
    val_r2 = r2_score(y_val, y_val_pred)
    val_mae = mean_absolute_error(y_val, y_val_pred)
    val_rmse = np.sqrt(mean_squared_error(y_val, y_val_pred))

    print(f"\n   📈 Train Metrics:")
    print(f"      R²: {train_r2:.4f}")
    print(f"      MAE: {train_mae:.2f}%")
    print(f"      RMSE: {train_rmse:.2f}%")

    print(f"\n   📈 Validation Metrics:")
    print(f"      R²: {val_r2:.4f}")
    print(f"      MAE: {val_mae:.2f}%")
    print(f"      RMSE: {val_rmse:.2f}%")

    # Check if targets met
    target_r2 = 0.65
    target_mae = 5.0

    if val_r2 >= target_r2:
        print(f"   ✅ R² target met: {val_r2:.4f} >= {target_r2}")
    else:
        print(f"   ⚠️  R² below target: {val_r2:.4f} < {target_r2}")

    if val_mae <= target_mae:
        print(f"   ✅ MAE target met: {val_mae:.2f}% <= {target_mae}%")
    else:
        print(f"   ⚠️  MAE above target: {val_mae:.2f}% > {target_mae}%")

    metrics = {
        'train': {'r2': train_r2, 'mae': train_mae, 'rmse': train_rmse},
        'val': {'r2': val_r2, 'mae': val_mae, 'rmse': val_rmse}
    }

    return metrics, y_val_pred


# === Feature Importance ===

def analyze_feature_importance(model, feature_names):
    """Analyze and print feature importance"""
    print("\n🎯 Feature Importance (Top 10):")

    importance = model.feature_importance(importance_type='gain')
    feature_importance = sorted(
        zip(feature_names, importance),
        key=lambda x: x[1],
        reverse=True
    )

    for i, (feature, score) in enumerate(feature_importance[:10]):
        print(f"   {i+1:2d}. {feature:30s}: {score:10.0f}")

    return feature_importance


# === Visualization ===

def create_validation_plots(y_val, y_val_pred, output_dir):
    """Create validation visualizations"""
    print("\n📊 Creating validation plots...")

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Scatter plot: Predicted vs Actual
    axes[0].scatter(y_val, y_val_pred, alpha=0.5, s=10)
    axes[0].plot([y_val.min(), y_val.max()], [y_val.min(), y_val.max()], 'r--', lw=2)
    axes[0].set_xlabel('Actual Volatility (%)')
    axes[0].set_ylabel('Predicted Volatility (%)')
    axes[0].set_title('Predicted vs Actual Volatility')
    axes[0].grid(True, alpha=0.3)

    # Residual plot
    residuals = y_val - y_val_pred
    axes[1].scatter(y_val_pred, residuals, alpha=0.5, s=10)
    axes[1].axhline(0, color='red', linestyle='--', lw=2)
    axes[1].set_xlabel('Predicted Volatility (%)')
    axes[1].set_ylabel('Residuals (%)')
    axes[1].set_title('Residual Plot')
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    plot_path = output_dir / "validation_plots.png"
    plt.savefig(plot_path, dpi=150)
    print(f"   ✅ Saved validation plots: {plot_path}")

    plt.close()


# === Save Model ===

def save_model_artifacts(model, normalizer, metrics, feature_importance, output_dir):
    """Save model, normalizer, and metadata"""
    print("\n💾 Saving model artifacts...")

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save model
    model_path = output_dir / "model.txt"
    model.save_model(str(model_path))
    print(f"   ✅ Saved model: {model_path}")

    # Save normalizer
    normalizer_path = output_dir / "normalizer.json"
    with open(normalizer_path, 'w') as f:
        json.dump(normalizer, f, indent=2)
    print(f"   ✅ Saved normalizer: {normalizer_path}")

    # Save metadata
    metadata = {
        'version': '1.0.0',
        'model_type': 'regression',
        'framework': 'lightgbm',
        'trained_date': datetime.now().isoformat(),
        'metrics': metrics,
        'feature_count': len(normalizer['feature_names']),
        'feature_names': normalizer['feature_names'],
        'feature_importance': [
            {'feature': f, 'importance': float(i)}
            for f, i in feature_importance
        ],
        'target_variable': 'forward_21d_realized_volatility',
        'prediction_horizon_days': 21,
        'hyperparameters': LGBM_PARAMS
    }

    metadata_path = output_dir / "metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"   ✅ Saved metadata: {metadata_path}")


# === Main ===

def main():
    """Main execution"""
    start_time = datetime.now()

    # Load data
    train_df, val_df = load_training_data()

    # Prepare features and target
    X_train, y_train, feature_names = prepare_features_and_target(train_df)
    X_val, y_val, _ = prepare_features_and_target(val_df)

    print(f"\n📋 Dataset Summary:")
    print(f"   Train samples: {len(X_train):,}")
    print(f"   Val samples: {len(X_val):,}")
    print(f"   Features: {len(feature_names)}")

    # Calculate normalization
    normalizer = calculate_normalization_stats(X_train)

    # Normalize features
    X_train_norm = normalize_features(X_train, normalizer)
    X_val_norm = normalize_features(X_val, normalizer)

    # Train model
    model = train_model(X_train_norm, y_train, X_val_norm, y_val)

    # Evaluate
    metrics, y_val_pred = evaluate_model(model, X_train_norm, y_train, X_val_norm, y_val)

    # Feature importance
    feature_importance = analyze_feature_importance(model, feature_names)

    # Create validation plots
    create_validation_plots(y_val, y_val_pred, MODEL_DIR)

    # Save artifacts
    save_model_artifacts(model, normalizer, metrics, feature_importance, MODEL_DIR)

    elapsed = datetime.now() - start_time
    print(f"\n✅ Training completed in {elapsed.total_seconds():.1f}s")
    print(f"\n🎯 Next steps:")
    print(f"   1. Review validation plots: {MODEL_DIR}/validation_plots.png")
    print(f"   2. Register model: node scripts/ml/register-volatility-model.ts")
    print(f"   3. Integrate into RealTimePredictionEngine")


if __name__ == "__main__":
    main()
