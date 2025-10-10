#!/usr/bin/env python3
"""
Evaluate Baseline Model on Test Set (43 Price Features Only)

Evaluates the baseline LightGBM model (v1.2.0-baseline) on the held-out test set.
This baseline excludes FinBERT features to measure their contribution.

Input:
  - data/training/combined-test.csv (221 rows)
  - models/price-prediction/v1.2.0-baseline/model.txt
  - models/price-prediction/v1.2.0-baseline/normalizer.json

Output:
  - Comprehensive test metrics (accuracy, precision, recall, F1)
  - Confusion matrix
  - Per-class performance breakdown

Usage:
    python3 scripts/ml/evaluate-baseline-model.py
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
from lightgbm import Booster
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    precision_recall_fscore_support
)
import json
import os

def load_normalizer(normalizer_path):
    """Load feature normalizer parameters"""
    with open(normalizer_path, 'r') as f:
        normalizer = json.load(f)
    return normalizer

def normalize_features(X, normalizer):
    """Apply z-score normalization using saved parameters"""
    means = np.array(normalizer['means'])
    stds = np.array(normalizer['stds'])
    return (X - means) / stds

def evaluate_baseline():
    print("=" * 80)
    print("📊 Evaluating Baseline Model on Test Set (43 Features - NO FinBERT)")
    print("=" * 80)

    # Load test dataset
    print("\n📂 Loading test dataset...")
    test_df = pd.read_csv("data/training/combined-test.csv")
    print(f"✓ Loaded {len(test_df):,} test examples")

    # Load normalizer to get feature list (without FinBERT)
    print("\n📥 Loading normalizer...")
    normalizer_path = "models/price-prediction/v1.2.0-baseline/normalizer.json"
    normalizer = load_normalizer(normalizer_path)
    feature_cols = normalizer['feature_names']
    print(f"✓ Normalizer loaded with {len(feature_cols)} features")

    # Separate features and labels - use SAME features as baseline model
    print("\n🔧 Preparing features (EXCLUDING FinBERT)...")
    X_test = test_df[feature_cols].values
    y_test = test_df['label'].values

    print(f"✓ Features: {len(feature_cols)} (price/technical only)")

    # Encode labels
    label_encoder = LabelEncoder()
    y_test_encoded = label_encoder.fit_transform(y_test)

    print(f"\n🏷️  Label distribution in test set:")
    for label in label_encoder.classes_:
        count = np.sum(y_test == label)
        pct = count / len(y_test) * 100
        print(f"  {label}: {count} ({pct:.1f}%)")

    # Normalize features
    print("\n📊 Normalizing features...")
    X_test_normalized = normalize_features(X_test, normalizer)
    print("✓ Features normalized")

    # Load model
    print("\n🧠 Loading baseline model...")
    model_path = "models/price-prediction/v1.2.0-baseline/model.txt"
    model = Booster(model_file=model_path)
    print(f"✓ Model loaded from {model_path}")

    # Make predictions
    print("\n🔮 Making predictions on test set...")
    y_pred_probs = model.predict(X_test_normalized)
    y_pred_encoded = np.argmax(y_pred_probs, axis=1)
    y_pred = label_encoder.inverse_transform(y_pred_encoded)
    print("✓ Predictions complete")

    # Calculate metrics
    print("\n" + "=" * 80)
    print("📈 BASELINE TEST SET PERFORMANCE")
    print("=" * 80)

    # Overall accuracy
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\n✨ Overall Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")

    # Per-class metrics
    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, y_pred, labels=label_encoder.classes_, zero_division=0
    )

    print(f"\n📊 Per-Class Performance:")
    print(f"{'Class':<10} {'Precision':<12} {'Recall':<12} {'F1-Score':<12} {'Support':<10}")
    print("-" * 60)
    for i, label in enumerate(label_encoder.classes_):
        print(f"{label:<10} {precision[i]:<12.4f} {recall[i]:<12.4f} {f1[i]:<12.4f} {support[i]:<10}")

    # Weighted averages
    print(f"\n📊 Weighted Averages:")
    precision_avg, recall_avg, f1_avg, _ = precision_recall_fscore_support(
        y_test, y_pred, average='weighted', zero_division=0
    )
    print(f"  Precision: {precision_avg:.4f}")
    print(f"  Recall:    {recall_avg:.4f}")
    print(f"  F1-Score:  {f1_avg:.4f}")

    # Confusion matrix
    print(f"\n🔍 Confusion Matrix:")
    cm = confusion_matrix(y_test, y_pred, labels=label_encoder.classes_)
    print(f"\n{'':>10} Predicted →")
    print(f"{'':>10} {' '.join([f'{l:<10}' for l in label_encoder.classes_])}")
    print("Actual ↓")
    for i, label in enumerate(label_encoder.classes_):
        row_str = ' '.join([f'{cm[i][j]:<10}' for j in range(len(label_encoder.classes_))])
        print(f"{label:<10} {row_str}")

    # Classification report
    print(f"\n📋 Detailed Classification Report:")
    print(classification_report(y_test, y_pred, digits=4, zero_division=0))

    # Prediction confidence analysis
    print(f"\n🎯 Prediction Confidence Analysis:")
    max_probs = np.max(y_pred_probs, axis=1)
    avg_confidence = np.mean(max_probs)
    print(f"  Average confidence: {avg_confidence:.4f} ({avg_confidence*100:.2f}%)")
    print(f"  Min confidence: {np.min(max_probs):.4f}")
    print(f"  Max confidence: {np.max(max_probs):.4f}")

    # Confidence distribution
    high_conf = np.sum(max_probs > 0.7)
    med_conf = np.sum((max_probs >= 0.5) & (max_probs <= 0.7))
    low_conf = np.sum(max_probs < 0.5)
    print(f"\n  Confidence distribution:")
    print(f"    High (>70%):  {high_conf} ({high_conf/len(max_probs)*100:.1f}%)")
    print(f"    Med (50-70%): {med_conf} ({med_conf/len(max_probs)*100:.1f}%)")
    print(f"    Low (<50%):   {low_conf} ({low_conf/len(max_probs)*100:.1f}%)")

    # Error analysis
    print(f"\n❌ Error Analysis:")
    errors = y_test != y_pred
    error_count = np.sum(errors)
    print(f"  Total errors: {error_count} ({error_count/len(y_test)*100:.1f}%)")

    # Save evaluation results
    print("\n💾 Saving evaluation results...")
    output_dir = "models/price-prediction/v1.2.0-baseline"
    eval_results_path = os.path.join(output_dir, "test_evaluation.json")

    eval_results = {
        'test_accuracy': float(accuracy),
        'test_precision_weighted': float(precision_avg),
        'test_recall_weighted': float(recall_avg),
        'test_f1_weighted': float(f1_avg),
        'test_samples': len(y_test),
        'per_class_metrics': {
            label: {
                'precision': float(precision[i]),
                'recall': float(recall[i]),
                'f1_score': float(f1[i]),
                'support': int(support[i])
            }
            for i, label in enumerate(label_encoder.classes_)
        },
        'confusion_matrix': cm.tolist(),
        'average_confidence': float(avg_confidence),
        'confidence_distribution': {
            'high': int(high_conf),
            'medium': int(med_conf),
            'low': int(low_conf)
        },
        'error_count': int(error_count),
        'error_rate': float(error_count / len(y_test))
    }

    with open(eval_results_path, 'w') as f:
        json.dump(eval_results, f, indent=2)
    print(f"✓ Evaluation results saved: {eval_results_path}")

    print("\n" + "=" * 80)
    print("✅ Baseline Test Evaluation Complete!")
    print("=" * 80)
    print(f"\nKey Results:")
    print(f"  Test Accuracy: {accuracy*100:.2f}%")
    print(f"  Test F1 (weighted): {f1_avg:.4f}")
    print(f"  Test Samples: {len(y_test)}")
    print(f"  Average Confidence: {avg_confidence*100:.2f}%")
    print("\n💡 Next step:")
    print("  Compare vs FinBERT model: python3 scripts/ml/compare-models.py")
    print("=" * 80)

if __name__ == "__main__":
    evaluate_baseline()
