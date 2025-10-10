#!/usr/bin/env python3
"""
Evaluate Polygon Sentiment-Fusion Model on Test Set

Evaluates the trained LightGBM model on the held-out test set to assess
final performance and generalization.

Usage:
    python3 scripts/ml/evaluate-polygon-model.py
"""

import pandas as pd
import numpy as np
from lightgbm import Booster
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score
)
from sklearn.preprocessing import label_binarize
import json
import os

def evaluate_polygon_model():
    """Evaluate model on test set"""

    print("=" * 80)
    print("EVALUATE POLYGON SENTIMENT-FUSION MODEL")
    print("=" * 80)
    print()

    # Load test data
    test_file = "data/training/polygon-test.csv"
    model_dir = "models/sentiment-fusion/v1.0.0"

    if not os.path.exists(test_file):
        print("❌ Error: Test data not found")
        print("Run: python3 scripts/ml/split-polygon-dataset.py first")
        return

    if not os.path.exists(model_dir):
        print("❌ Error: Model not found")
        print("Run: python3 scripts/ml/train-polygon-model.py first")
        return

    print(f"📂 Loading test data...")
    df_test = pd.read_csv(test_file)
    print(f"   ✓ Test: {len(df_test):,} examples")
    print()

    # Load model
    print(f"🤖 Loading model from {model_dir}...")
    model_file = os.path.join(model_dir, "model.txt")
    normalizer_file = os.path.join(model_dir, "normalizer.json")
    metadata_file = os.path.join(model_dir, "metadata.json")

    booster = Booster(model_file=model_file)

    with open(normalizer_file, 'r') as f:
        normalizer_params = json.load(f)

    with open(metadata_file, 'r') as f:
        metadata = json.load(f)

    print(f"   ✓ Model version: {metadata['model_version']}")
    print(f"   ✓ Training accuracy: {metadata['performance']['validation_accuracy']:.4f}")
    print()

    # Prepare test data
    feature_cols = normalizer_params['feature_names']
    X_test = df_test[feature_cols].values
    y_test = df_test['label'].values

    # Handle missing values (same as training)
    fill_values = np.array(normalizer_params['fill_values'])
    for i in range(X_test.shape[1]):
        X_test[np.isnan(X_test[:, i]), i] = fill_values[i]

    # Normalize
    mean = np.array(normalizer_params['mean'])
    scale = np.array(normalizer_params['scale'])
    X_test_scaled = (X_test - mean) / scale

    print("🧪 Running predictions on test set...")

    # Predict
    y_pred_proba = booster.predict(X_test_scaled)
    y_pred = np.argmax(y_pred_proba, axis=1)

    # Map predictions to labels
    label_map = {0: 'DOWN', 1: 'NEUTRAL', 2: 'UP'}
    y_pred_labels = np.array([label_map[i] for i in y_pred])

    print(f"   ✓ Predictions complete")
    print()

    # Calculate metrics
    print("=" * 80)
    print("TEST SET PERFORMANCE")
    print("=" * 80)
    print()

    accuracy = accuracy_score(y_test, y_pred_labels)
    print(f"📊 Overall Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
    print()

    # Baseline comparison
    baseline_random = 1/3  # Random guess for 3 classes
    baseline_majority = max(pd.Series(y_test).value_counts()) / len(y_test)

    print(f"📐 Baseline Comparisons:")
    print(f"   Random Baseline: {baseline_random:.4f} ({baseline_random*100:.2f}%)")
    print(f"   Majority Class Baseline: {baseline_majority:.4f} ({baseline_majority*100:.2f}%)")
    print(f"   Model Improvement over Random: +{(accuracy - baseline_random)*100:.2f} percentage points")
    print(f"   Model Improvement over Majority: {(accuracy - baseline_majority)*100:+.2f} percentage points")
    print()

    # Per-class metrics
    print("📋 Classification Report:")
    print(classification_report(y_test, y_pred_labels, target_names=['DOWN', 'NEUTRAL', 'UP'], digits=4))

    # Confusion matrix
    print("🔲 Confusion Matrix:")
    cm = confusion_matrix(y_test, y_pred_labels, labels=['DOWN', 'NEUTRAL', 'UP'])

    print()
    print("                 Predicted")
    print("              DOWN   NEUTRAL    UP     Total")
    total_per_class = cm.sum(axis=1)
    for i, label in enumerate(['DOWN', 'NEUTRAL', 'UP']):
        row = cm[i]
        print(f"   Actual {label:8s} {row[0]:5d}   {row[1]:7d}  {row[2]:5d}   {total_per_class[i]:5d}")
    print()

    # Per-class accuracy
    print("Per-class Accuracy (recall):")
    for i, label in enumerate(['DOWN', 'NEUTRAL', 'UP']):
        class_acc = cm[i, i] / total_per_class[i]
        print(f"   {label}: {class_acc:.4f} ({class_acc*100:.2f}%)")
    print()

    # Precision, Recall, F1 per class
    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, y_pred_labels, labels=['DOWN', 'NEUTRAL', 'UP']
    )

    print("Detailed Metrics by Class:")
    print("   Class     Precision  Recall    F1-Score  Support")
    for i, label in enumerate(['DOWN', 'NEUTRAL', 'UP']):
        print(f"   {label:8s}  {precision[i]:.4f}     {recall[i]:.4f}    {f1[i]:.4f}    {support[i]}")
    print()

    # Prediction distribution
    print("Prediction Distribution:")
    pred_counts = pd.Series(y_pred_labels).value_counts().sort_index()
    for label in ['DOWN', 'NEUTRAL', 'UP']:
        count = pred_counts.get(label, 0)
        pct = count / len(y_pred_labels) * 100
        print(f"   {label}: {count} ({pct:.1f}%)")
    print()

    # True label distribution
    print("True Label Distribution:")
    true_counts = pd.Series(y_test).value_counts().sort_index()
    for label in ['DOWN', 'NEUTRAL', 'UP']:
        count = true_counts.get(label, 0)
        pct = count / len(y_test) * 100
        print(f"   {label}: {count} ({pct:.1f}%)")
    print()

    # Calculate multi-class ROC AUC
    try:
        # Binarize labels for ROC AUC
        y_test_bin = label_binarize(y_test, classes=['DOWN', 'NEUTRAL', 'UP'])

        # ROC AUC for each class (one-vs-rest)
        roc_auc_scores = {}
        for i, label in enumerate(['DOWN', 'NEUTRAL', 'UP']):
            roc_auc = roc_auc_score(y_test_bin[:, i], y_pred_proba[:, i])
            roc_auc_scores[label] = roc_auc

        # Macro average
        macro_roc_auc = np.mean(list(roc_auc_scores.values()))

        print("ROC AUC Scores (One-vs-Rest):")
        for label, score in roc_auc_scores.items():
            print(f"   {label}: {score:.4f}")
        print(f"   Macro Average: {macro_roc_auc:.4f}")
        print()
    except Exception as e:
        print(f"⚠️  Could not calculate ROC AUC: {e}")
        print()

    # Error analysis
    print("=" * 80)
    print("ERROR ANALYSIS")
    print("=" * 80)
    print()

    errors = y_test != y_pred_labels
    error_rate = errors.sum() / len(y_test)
    print(f"Total Errors: {errors.sum():,} / {len(y_test):,} ({error_rate*100:.2f}%)")
    print()

    # Most common misclassifications
    print("Most Common Misclassifications:")
    misclass_pairs = []
    for true_label in ['DOWN', 'NEUTRAL', 'UP']:
        for pred_label in ['DOWN', 'NEUTRAL', 'UP']:
            if true_label != pred_label:
                count = ((y_test == true_label) & (y_pred_labels == pred_label)).sum()
                if count > 0:
                    misclass_pairs.append((true_label, pred_label, count))

    misclass_pairs.sort(key=lambda x: x[2], reverse=True)
    for true_label, pred_label, count in misclass_pairs[:5]:
        pct = count / len(y_test) * 100
        print(f"   {true_label} → {pred_label}: {count} ({pct:.2f}%)")
    print()

    # Save evaluation results
    eval_file = os.path.join(model_dir, "test_evaluation.json")
    eval_results = {
        'test_examples': len(df_test),
        'accuracy': float(accuracy),
        'baseline_random': float(baseline_random),
        'baseline_majority': float(baseline_majority),
        'improvement_over_random': float(accuracy - baseline_random),
        'improvement_over_majority': float(accuracy - baseline_majority),
        'per_class_metrics': {
            label: {
                'precision': float(precision[i]),
                'recall': float(recall[i]),
                'f1_score': float(f1[i]),
                'support': int(support[i])
            }
            for i, label in enumerate(['DOWN', 'NEUTRAL', 'UP'])
        },
        'confusion_matrix': cm.tolist(),
        'prediction_distribution': pred_counts.to_dict(),
        'true_distribution': true_counts.to_dict(),
        'roc_auc_scores': roc_auc_scores if 'roc_auc_scores' in locals() else None,
        'macro_roc_auc': float(macro_roc_auc) if 'macro_roc_auc' in locals() else None
    }

    with open(eval_file, 'w') as f:
        json.dump(eval_results, f, indent=2)

    print(f"💾 Evaluation results saved to: {eval_file}")
    print()

    print("=" * 80)
    print("✅ COMPLETE - TEST SET EVALUATION")
    print("=" * 80)
    print()
    print("Summary:")
    print(f"   Test Accuracy: {accuracy*100:.2f}%")
    print(f"   Improvement over Random: +{(accuracy - baseline_random)*100:.2f}pp")
    print(f"   Best Performing Class: {['DOWN', 'NEUTRAL', 'UP'][np.argmax(recall)]}")
    print(f"   Worst Performing Class: {['DOWN', 'NEUTRAL', 'UP'][np.argmin(recall)]}")
    print()


if __name__ == "__main__":
    evaluate_polygon_model()
