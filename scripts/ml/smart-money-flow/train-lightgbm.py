#!/usr/bin/env python3
"""
Train LightGBM model for smart money flow prediction
"""

import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import matplotlib.pyplot as plt
import seaborn as sns
import json
import os
from pathlib import Path
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Configuration
DATA_DIR = Path('data/training/smart-money-flow')
MODEL_DIR = Path('app/services/ml/smart-money-flow/models')
PLOTS_DIR = Path('app/services/ml/smart-money-flow/plots')

# Create directories
MODEL_DIR.mkdir(parents=True, exist_ok=True)
PLOTS_DIR.mkdir(parents=True, exist_ok=True)

# Target column
TARGET_COL = 'return_14d'

# Columns to exclude from features
EXCLUDE_COLS = ['symbol', 'date', 'price_at_sample', 'price_after_14d', TARGET_COL, 'label']

def load_data():
    """Load train, validation, and test datasets"""
    print("📊 Loading datasets...")

    train_df = pd.read_csv(DATA_DIR / 'train.csv')
    val_df = pd.read_csv(DATA_DIR / 'val.csv')
    test_df = pd.read_csv(DATA_DIR / 'test.csv')

    print(f"   ✓ Train: {len(train_df):,} samples")
    print(f"   ✓ Val:   {len(val_df):,} samples")
    print(f"   ✓ Test:  {len(test_df):,} samples")
    print()

    return train_df, val_df, test_df

def prepare_features(train_df, val_df, test_df):
    """Prepare feature matrices and target vectors"""
    print("🔧 Preparing features...")

    # Get feature columns (exclude metadata and target)
    feature_cols = [col for col in train_df.columns if col not in EXCLUDE_COLS]

    print(f"   ✓ Using {len(feature_cols)} features")
    print(f"   ✓ Target: {TARGET_COL}")

    # Separate features and target
    X_train = train_df[feature_cols]
    y_train = train_df[TARGET_COL]

    X_val = val_df[feature_cols]
    y_val = val_df[TARGET_COL]

    X_test = test_df[feature_cols]
    y_test = test_df[TARGET_COL]

    # Check for missing values
    if X_train.isnull().sum().sum() > 0:
        print("   ⚠️  Warning: Missing values detected, filling with 0")
        X_train = X_train.fillna(0)
        X_val = X_val.fillna(0)
        X_test = X_test.fillna(0)

    print()
    return X_train, y_train, X_val, y_val, X_test, y_test, feature_cols

def train_model(X_train, y_train, X_val, y_val):
    """Train LightGBM model with optimal hyperparameters"""
    print("🚀 Training LightGBM model...")
    print()

    # LightGBM parameters
    params = {
        'objective': 'regression',
        'metric': 'rmse',
        'boosting_type': 'gbdt',
        'num_leaves': 31,
        'learning_rate': 0.05,
        'feature_fraction': 0.9,
        'bagging_fraction': 0.8,
        'bagging_freq': 5,
        'verbose': -1,
        'max_depth': -1,
        'min_child_samples': 20,
        'reg_alpha': 0.1,
        'reg_lambda': 0.1,
    }

    # Create datasets
    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)

    # Train model
    print("   Training progress:")
    callbacks = [
        lgb.log_evaluation(period=100),
        lgb.early_stopping(stopping_rounds=50, verbose=True)
    ]

    model = lgb.train(
        params,
        train_data,
        num_boost_round=1000,
        valid_sets=[train_data, val_data],
        valid_names=['train', 'val'],
        callbacks=callbacks
    )

    print()
    print(f"   ✓ Best iteration: {model.best_iteration}")
    print(f"   ✓ Best score: {model.best_score['val']['rmse']:.6f}")
    print()

    return model

def evaluate_model(model, X_train, y_train, X_val, y_val, X_test, y_test):
    """Evaluate model performance on all datasets"""
    print("📈 Evaluating model performance...")
    print()

    # Make predictions
    train_pred = model.predict(X_train, num_iteration=model.best_iteration)
    val_pred = model.predict(X_val, num_iteration=model.best_iteration)
    test_pred = model.predict(X_test, num_iteration=model.best_iteration)

    # Calculate metrics
    metrics = {}

    for name, y_true, y_pred in [
        ('train', y_train, train_pred),
        ('val', y_val, val_pred),
        ('test', y_test, test_pred)
    ]:
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        mae = mean_absolute_error(y_true, y_pred)
        r2 = r2_score(y_true, y_pred)

        metrics[name] = {
            'rmse': float(rmse),
            'mae': float(mae),
            'r2': float(r2)
        }

        print(f"   {name.upper():5s} - RMSE: {rmse:.6f} | MAE: {mae:.6f} | R²: {r2:.6f}")

    print()
    return metrics, test_pred

def plot_feature_importance(model, feature_cols, top_n=20):
    """Plot top N most important features"""
    print(f"📊 Generating feature importance plot (top {top_n})...")

    # Get feature importance
    importance_df = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importance(importance_type='gain')
    }).sort_values('importance', ascending=False)

    # Plot top N features
    plt.figure(figsize=(12, 8))
    top_features = importance_df.head(top_n)

    sns.barplot(data=top_features, y='feature', x='importance', palette='viridis')
    plt.title(f'Top {top_n} Most Important Features (LightGBM)', fontsize=16, fontweight='bold')
    plt.xlabel('Feature Importance (Gain)', fontsize=12)
    plt.ylabel('Feature', fontsize=12)
    plt.tight_layout()

    # Save plot
    plot_path = PLOTS_DIR / 'feature_importance.png'
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    print(f"   ✓ Saved to: {plot_path}")
    plt.close()

    # Save full importance to CSV
    importance_path = PLOTS_DIR / 'feature_importance.csv'
    importance_df.to_csv(importance_path, index=False)
    print(f"   ✓ Full importance saved to: {importance_path}")
    print()

    return importance_df

def plot_predictions(y_test, test_pred):
    """Plot actual vs predicted values"""
    print("📊 Generating prediction plot...")

    fig, axes = plt.subplots(1, 2, figsize=(16, 6))

    # Scatter plot
    axes[0].scatter(y_test, test_pred, alpha=0.5, s=1)
    axes[0].plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--', lw=2)
    axes[0].set_xlabel('Actual Return', fontsize=12)
    axes[0].set_ylabel('Predicted Return', fontsize=12)
    axes[0].set_title('Actual vs Predicted Returns', fontsize=14, fontweight='bold')
    axes[0].grid(True, alpha=0.3)

    # Residual plot
    residuals = y_test - test_pred
    axes[1].scatter(test_pred, residuals, alpha=0.5, s=1)
    axes[1].axhline(y=0, color='r', linestyle='--', lw=2)
    axes[1].set_xlabel('Predicted Return', fontsize=12)
    axes[1].set_ylabel('Residuals', fontsize=12)
    axes[1].set_title('Residual Plot', fontsize=14, fontweight='bold')
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()

    # Save plot
    plot_path = PLOTS_DIR / 'predictions.png'
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    print(f"   ✓ Saved to: {plot_path}")
    plt.close()
    print()

def save_model(model, metrics, feature_cols):
    """Save model and metadata"""
    print("💾 Saving model...")

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # Save model
    model_path = MODEL_DIR / 'smart_money_flow_model.txt'
    model.save_model(str(model_path))
    print(f"   ✓ Model saved to: {model_path}")

    # Save metadata
    metadata = {
        'timestamp': timestamp,
        'best_iteration': int(model.best_iteration),
        'metrics': metrics,
        'feature_cols': feature_cols,
        'num_features': len(feature_cols),
        'model_type': 'LightGBM',
        'target': TARGET_COL
    }

    metadata_path = MODEL_DIR / 'model_metadata.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, indent=2, fp=f)
    print(f"   ✓ Metadata saved to: {metadata_path}")
    print()

def main():
    """Main training pipeline"""
    print("=" * 60)
    print("🎯 SMART MONEY FLOW MODEL TRAINING (LightGBM)")
    print("=" * 60)
    print()

    # Load data
    train_df, val_df, test_df = load_data()

    # Prepare features
    X_train, y_train, X_val, y_val, X_test, y_test, feature_cols = prepare_features(
        train_df, val_df, test_df
    )

    # Train model
    model = train_model(X_train, y_train, X_val, y_val)

    # Evaluate
    metrics, test_pred = evaluate_model(
        model, X_train, y_train, X_val, y_val, X_test, y_test
    )

    # Plot feature importance
    importance_df = plot_feature_importance(model, feature_cols, top_n=20)

    # Plot predictions
    plot_predictions(y_test, test_pred)

    # Save model
    save_model(model, metrics, feature_cols)

    print("=" * 60)
    print("✅ TRAINING COMPLETE!")
    print("=" * 60)
    print()
    print("📂 Output files:")
    print(f"   - Model: {MODEL_DIR / 'smart_money_flow_model.txt'}")
    print(f"   - Metadata: {MODEL_DIR / 'model_metadata.json'}")
    print(f"   - Feature importance: {PLOTS_DIR / 'feature_importance.png'}")
    print(f"   - Predictions: {PLOTS_DIR / 'predictions.png'}")
    print()
    print("🎯 Test Set Performance:")
    print(f"   - RMSE: {metrics['test']['rmse']:.6f}")
    print(f"   - MAE:  {metrics['test']['mae']:.6f}")
    print(f"   - R²:   {metrics['test']['r2']:.6f}")
    print()

if __name__ == '__main__':
    main()
