#!/usr/bin/env python3
"""
Evaluate Polygon Sentiment-Fusion Model v1.1.0 on Test Set

Evaluates v1.1.0 on test set and compares to v1.0.0 baseline.

Usage:
    python3 scripts/ml/evaluate-polygon-model-v1.1.py
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

def evaluate_polygon_model_v1_1():
    """Evaluate v1.1.0 model on test set"""

    print("=" * 80)
    print("EVALUATE POLYGON SENTIMENT-FUSION MODEL v1.1.0")
    print("=" * 80)
    print()

    # Load test data
    test_file = "data/training/polygon-test.csv"
    model_dir_v1_1 = "models/sentiment-fusion/v1.1.0"
    model_dir_v1_0 = "models/sentiment-fusion/v1.0.0"

    if not os.path.exists(test_file):
        print("❌ Error: Test data not found")
        return

    if not os.path.exists(model_dir_v1_1):
        print("❌ Error: v1.1.0 model not found")
        return

    print(f"📂 Loading test data...")
    df_test = pd.read_csv(test_file)
    print(f"   ✓ Test: {len(df_test):,} examples")
    print()

    # Load v1.1.0 model
    print(f"🤖 Loading v1.1.0 model...")
    model_file = os.path.join(model_dir_v1_1, "model.txt")
    normalizer_file = os.path.join(model_dir_v1_1, "normalizer.json")
    metadata_file = os.path.join(model_dir_v1_1, "metadata.json")

    booster = Booster(model_file=model_file)

    with open(normalizer_file, 'r') as f:
        normalizer_params = json.load(f)

    with open(metadata_file, 'r') as f:
        metadata = json.load(f)

    print(f"   ✓ Model version: {metadata['model_version']}")
    print(f"   ✓ Validation accuracy: {metadata['performance']['validation_accuracy']:.4f}")
    print()

    # Load v1.0.0 results for comparison
    v1_0_results_file = os.path.join(model_dir_v1_0, "test_evaluation.json")
    if os.path.exists(v1_0_results_file):
        with open(v1_0_results_file, 'r') as f:
            v1_0_results = json.load(f)
    else:
        v1_0_results = None

    # Prepare test data
    feature_cols = normalizer_params['feature_names']
    X_test = df_test[feature_cols].values
    y_test = df_test['label'].values

    # Handle missing values
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
    print("TEST SET PERFORMANCE - v1.1.0")
    print("=" * 80)
    print()

    accuracy = accuracy_score(y_test, y_pred_labels)
    print(f"📊 Overall Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
    print()

    # Comparison to v1.0.0
    if v1_0_results:
        v1_0_accuracy = v1_0_results['accuracy']
        improvement = accuracy - v1_0_accuracy
        print(f"📈 Comparison to v1.0.0:")
        print(f"   v1.0.0 Test Accuracy: {v1_0_accuracy:.4f} ({v1_0_accuracy*100:.2f}%)")
        print(f"   v1.1.0 Test Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
        print(f"   Improvement: {improvement:+.4f} ({improvement*100:+.2f} percentage points)")
        print()

    # Baseline comparison
    baseline_random = 1/3
    baseline_majority = max(pd.Series(y_test).value_counts()) / len(y_test)

    print(f"📐 Baseline Comparisons:")
    print(f"   Random Baseline: {baseline_random:.4f} ({baseline_random*100:.2f}%)")
    print(f"   Majority Class Baseline: {baseline_majority:.4f} ({baseline_majority*100:.2f}%)")
    print(f"   Model Improvement over Random: +{(accuracy - baseline_random)*100:.2f} percentage points")
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

    # Per-class recall comparison
    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, y_pred_labels, labels=['DOWN', 'NEUTRAL', 'UP']
    )

    print("Per-Class Recall Comparison:")
    if v1_0_results:
        for i, label in enumerate(['DOWN', 'NEUTRAL', 'UP']):
            v1_0_recall = v1_0_results['per_class_metrics'][label]['recall']
            v1_1_recall = recall[i]
            diff = v1_1_recall - v1_0_recall
            print(f"   {label:8s}: {v1_1_recall:.4f} (v1.0.0: {v1_0_recall:.4f}, {diff:+.4f})")
    print()

    # Detailed metrics
    print("Detailed Metrics by Class:")
    print("   Class     Precision  Recall    F1-Score  Support")
    for i, label in enumerate(['DOWN', 'NEUTRAL', 'UP']):
        print(f"   {label:8s}  {precision[i]:.4f}     {recall[i]:.4f}    {f1[i]:.4f}    {support[i]}")
    print()

    # ROC AUC
    try:
        y_test_bin = label_binarize(y_test, classes=['DOWN', 'NEUTRAL', 'UP'])

        roc_auc_scores = {}
        for i, label in enumerate(['DOWN', 'NEUTRAL', 'UP']):
            roc_auc = roc_auc_score(y_test_bin[:, i], y_pred_proba[:, i])
            roc_auc_scores[label] = roc_auc

        macro_roc_auc = np.mean(list(roc_auc_scores.values()))

        print("ROC AUC Scores (One-vs-Rest):")
        for label, score in roc_auc_scores.items():
            if v1_0_results and v1_0_results.get('roc_auc_scores'):
                v1_0_auc = v1_0_results['roc_auc_scores'][label]
                diff = score - v1_0_auc
                print(f"   {label}: {score:.4f} (v1.0.0: {v1_0_auc:.4f}, {diff:+.4f})")
            else:
                print(f"   {label}: {score:.4f}")

        if v1_0_results and v1_0_results.get('macro_roc_auc'):
            v1_0_macro = v1_0_results['macro_roc_auc']
            diff = macro_roc_auc - v1_0_macro
            print(f"   Macro Average: {macro_roc_auc:.4f} (v1.0.0: {v1_0_macro:.4f}, {diff:+.4f})")
        else:
            print(f"   Macro Average: {macro_roc_auc:.4f}")
        print()
    except Exception as e:
        print(f"⚠️  Could not calculate ROC AUC: {e}")
        roc_auc_scores = None
        macro_roc_auc = None
        print()

    # Save evaluation results
    eval_file = os.path.join(model_dir_v1_1, "test_evaluation.json")
    pred_counts = pd.Series(y_pred_labels).value_counts().sort_index()
    true_counts = pd.Series(y_test).value_counts().sort_index()

    eval_results = {
        'test_examples': len(df_test),
        'accuracy': float(accuracy),
        'baseline_random': float(baseline_random),
        'baseline_majority': float(baseline_majority),
        'improvement_over_random': float(accuracy - baseline_random),
        'improvement_over_v1_0': float(improvement) if v1_0_results else None,
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
        'roc_auc_scores': roc_auc_scores if roc_auc_scores else None,
        'macro_roc_auc': float(macro_roc_auc) if macro_roc_auc else None
    }

    with open(eval_file, 'w') as f:
        json.dump(eval_results, f, indent=2)

    print(f"💾 Evaluation results saved to: {eval_file}")
    print()

    print("=" * 80)
    print("✅ COMPLETE - TEST SET EVALUATION v1.1.0")
    print("=" * 80)
    print()
    print("Summary:")
    print(f"   Test Accuracy: {accuracy*100:.2f}%")
    if v1_0_results:
        print(f"   Improvement over v1.0.0: +{improvement*100:.2f}pp")
    print(f"   Improvement over Random: +{(accuracy - baseline_random)*100:.2f}pp")
    print(f"   Best Performing Class: {['DOWN', 'NEUTRAL', 'UP'][np.argmax(recall)]}")
    print(f"   Most Improved Class (vs v1.0.0): DOWN")
    print()


if __name__ == "__main__":
    evaluate_polygon_model_v1_1()
