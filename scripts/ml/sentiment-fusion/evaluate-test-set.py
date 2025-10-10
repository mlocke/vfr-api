#!/usr/bin/env python3
"""
FinBERT Sentiment Fusion Model - Test Set Evaluation
Evaluate the fine-tuned model on held-out test data
"""

import os
import json
import pandas as pd
import numpy as np
from datetime import datetime
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    classification_report,
    roc_auc_score
)
import torch

# Paths
TEST_FILE = "data/training/sentiment-fusion-test.csv"
MODEL_DIR = "models/sentiment-fusion/v1.1.0"
MAX_LENGTH = 512

print("=" * 80)
print("FinBERT Sentiment Fusion Model - Test Set Evaluation")
print("=" * 80)
print(f"Test file: {TEST_FILE}")
print(f"Model directory: {MODEL_DIR}")
print("=" * 80)
print()

# Load test dataset
print("📂 Loading test dataset...")
test_df = pd.read_csv(TEST_FILE)
print(f"✓ Test examples: {len(test_df):,}")
print()

# Display label distribution
print("📊 Test Set Label Distribution:")
label_names = ["BEARISH", "NEUTRAL", "BULLISH"]
for label in sorted(test_df['label'].unique()):
    count = (test_df['label'] == label).sum()
    percentage = (count / len(test_df)) * 100
    print(f"  {label} ({label_names[label]}): {count:,} ({percentage:.1f}%)")
print()

# Load tokenizer
print(f"🔤 Loading tokenizer from {MODEL_DIR}...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
print("✓ Tokenizer loaded")
print()

# Load model
print(f"🤖 Loading fine-tuned FinBERT model from {MODEL_DIR}...")
model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
model.eval()  # Set to evaluation mode
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model.to(device)
print(f"✓ Model loaded on {device}")
print()

# Tokenize test dataset
print("🔤 Tokenizing test dataset...")
test_encodings = tokenizer(
    test_df['text'].tolist(),
    truncation=True,
    padding=True,
    max_length=MAX_LENGTH,
    return_tensors='pt'
)
print("✓ Tokenization complete")
print()

# Run inference
print("🔮 Running inference on test set...")
predictions = []
probabilities = []

with torch.no_grad():
    # Process in batches to avoid memory issues
    batch_size = 32
    num_batches = (len(test_df) + batch_size - 1) // batch_size

    for i in range(num_batches):
        start_idx = i * batch_size
        end_idx = min((i + 1) * batch_size, len(test_df))

        batch = {
            key: val[start_idx:end_idx].to(device)
            for key, val in test_encodings.items()
        }

        outputs = model(**batch)
        logits = outputs.logits
        probs = torch.softmax(logits, dim=-1)
        preds = torch.argmax(logits, dim=-1)

        predictions.extend(preds.cpu().numpy().tolist())
        probabilities.extend(probs.cpu().numpy().tolist())

        if (i + 1) % 10 == 0 or (i + 1) == num_batches:
            print(f"  Processed {end_idx}/{len(test_df)} examples ({(end_idx/len(test_df)*100):.1f}%)")

print("✓ Inference complete")
print()

# Convert to numpy arrays
y_true = test_df['label'].values
y_pred = np.array(predictions)
y_probs = np.array(probabilities)

# Calculate metrics
print("=" * 80)
print("📊 Test Set Performance Metrics")
print("=" * 80)
print()

# Overall accuracy
accuracy = accuracy_score(y_true, y_pred)
print(f"Overall Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
print()

# Per-class metrics
precision, recall, f1, support = precision_recall_fscore_support(
    y_true, y_pred, average=None, zero_division=0
)

print("Per-Class Metrics:")
print("-" * 80)
print(f"{'Class':<12} {'Precision':<12} {'Recall':<12} {'F1-Score':<12} {'Support':<10}")
print("-" * 80)
for i, label_name in enumerate(label_names):
    print(f"{label_name:<12} {precision[i]:<12.4f} {recall[i]:<12.4f} {f1[i]:<12.4f} {support[i]:<10}")
print("-" * 80)
print()

# Weighted average metrics
precision_weighted, recall_weighted, f1_weighted, _ = precision_recall_fscore_support(
    y_true, y_pred, average='weighted', zero_division=0
)
print("Weighted Average Metrics:")
print(f"  Precision: {precision_weighted:.4f}")
print(f"  Recall:    {recall_weighted:.4f}")
print(f"  F1-Score:  {f1_weighted:.4f}")
print()

# ROC-AUC (multi-class)
try:
    roc_auc = roc_auc_score(y_true, y_probs, multi_class='ovr', average='weighted')
    print(f"ROC-AUC (weighted): {roc_auc:.4f}")
    print()
except Exception as e:
    print(f"⚠️  Could not calculate ROC-AUC: {e}")
    print()

# Confusion matrix
print("Confusion Matrix:")
print("-" * 80)
cm = confusion_matrix(y_true, y_pred)
print(f"{'':>12}", end='')
for label in label_names:
    print(f"{label:>12}", end='')
print()
for i, label in enumerate(label_names):
    print(f"{label:>12}", end='')
    for j in range(len(label_names)):
        print(f"{cm[i][j]:>12}", end='')
    print()
print("-" * 80)
print()

# Classification report
print("Detailed Classification Report:")
print("-" * 80)
print(classification_report(y_true, y_pred, target_names=label_names, zero_division=0))
print("-" * 80)
print()

# Analyze misclassifications
print("=" * 80)
print("🔍 Misclassification Analysis")
print("=" * 80)
print()

misclassified_indices = np.where(y_true != y_pred)[0]
print(f"Total misclassifications: {len(misclassified_indices)} / {len(test_df)} ({len(misclassified_indices)/len(test_df)*100:.1f}%)")
print()

# Show confusion patterns
print("Most Common Confusion Patterns:")
confusion_patterns = {}
for i in range(len(label_names)):
    for j in range(len(label_names)):
        if i != j and cm[i][j] > 0:
            pattern = f"{label_names[i]} → {label_names[j]}"
            confusion_patterns[pattern] = cm[i][j]

sorted_patterns = sorted(confusion_patterns.items(), key=lambda x: x[1], reverse=True)
for pattern, count in sorted_patterns[:5]:
    percentage = (count / len(test_df)) * 100
    print(f"  {pattern}: {count} ({percentage:.1f}%)")
print()

# Show sample misclassifications
print("Sample Misclassifications (first 5):")
print("-" * 80)
for idx in misclassified_indices[:5]:
    true_label = label_names[y_true[idx]]
    pred_label = label_names[y_pred[idx]]
    confidence = y_probs[idx][y_pred[idx]]
    text_preview = test_df.iloc[idx]['text'][:200] + "..." if len(test_df.iloc[idx]['text']) > 200 else test_df.iloc[idx]['text']

    print(f"\nExample {idx}:")
    print(f"  True: {true_label}")
    print(f"  Predicted: {pred_label} (confidence: {confidence:.3f})")
    print(f"  Text: {text_preview}")
print("-" * 80)
print()

# Performance summary
print("=" * 80)
print("🎯 Target Assessment")
print("=" * 80)
print()

# Check accuracy target
accuracy_pct = accuracy * 100
if accuracy_pct >= 70:
    print(f"✅ EXCELLENT - Accuracy {accuracy_pct:.1f}% ≥ 70% (Stretch goal: 65-70%, Minimum: 60%)")
elif accuracy_pct >= 65:
    print(f"✅ EXCELLENT - Accuracy {accuracy_pct:.1f}% ≥ 65% (Target: 65%, Minimum: 60%)")
elif accuracy_pct >= 60:
    print(f"✅ GOOD - Accuracy {accuracy_pct:.1f}% ≥ 60% (Minimum target met)")
else:
    print(f"⚠️  BELOW TARGET - Accuracy {accuracy_pct:.1f}% < 60%")
    print("    Recommendations:")
    print("    - Analyze misclassified examples for patterns")
    print("    - Consider adjusting learning rate or training epochs")
    print("    - Refine text formatting and feature extraction")
print()

# Check F1-score target
if f1_weighted >= 0.68:
    print(f"✅ EXCELLENT - F1-Score {f1_weighted:.3f} ≥ 0.68 (Target: 0.63, Minimum: 0.58)")
elif f1_weighted >= 0.63:
    print(f"✅ EXCELLENT - F1-Score {f1_weighted:.3f} ≥ 0.63 (Target: 0.63, Minimum: 0.58)")
elif f1_weighted >= 0.58:
    print(f"✅ GOOD - F1-Score {f1_weighted:.3f} ≥ 0.58 (Minimum target met)")
else:
    print(f"⚠️  BELOW TARGET - F1-Score {f1_weighted:.3f} < 0.58")
print()

# Save evaluation results
print("=" * 80)
print("💾 Saving Evaluation Results")
print("=" * 80)
print()

results = {
    "evaluation_date": datetime.now().isoformat(),
    "model_version": "1.0.0",
    "test_examples": len(test_df),
    "metrics": {
        "accuracy": float(accuracy),
        "precision_weighted": float(precision_weighted),
        "recall_weighted": float(recall_weighted),
        "f1_weighted": float(f1_weighted),
        "roc_auc_weighted": float(roc_auc) if 'roc_auc' in locals() else None
    },
    "per_class_metrics": {
        label_names[i]: {
            "precision": float(precision[i]),
            "recall": float(recall[i]),
            "f1_score": float(f1[i]),
            "support": int(support[i])
        }
        for i in range(len(label_names))
    },
    "confusion_matrix": cm.tolist(),
    "label_distribution": {
        label_names[i]: int((test_df['label'] == i).sum())
        for i in range(len(label_names))
    },
    "target_assessment": {
        "accuracy_target_met": accuracy >= 0.60,
        "accuracy_stretch_met": accuracy >= 0.65,
        "f1_target_met": f1_weighted >= 0.58,
        "f1_stretch_met": f1_weighted >= 0.63
    }
}

results_path = os.path.join(MODEL_DIR, "test_evaluation.json")
with open(results_path, 'w') as f:
    json.dump(results, f, indent=2)
print(f"✓ Evaluation results saved to {results_path}")
print()

# Save predictions
predictions_df = test_df.copy()
predictions_df['predicted_label'] = y_pred
predictions_df['predicted_class'] = [label_names[p] for p in y_pred]
predictions_df['true_class'] = [label_names[t] for t in y_true]
predictions_df['correct'] = (y_true == y_pred)
predictions_df['confidence'] = [y_probs[i][y_pred[i]] for i in range(len(y_pred))]

for i, label_name in enumerate(label_names):
    predictions_df[f'prob_{label_name.lower()}'] = y_probs[:, i]

predictions_path = os.path.join(MODEL_DIR, "test_predictions.csv")
predictions_df.to_csv(predictions_path, index=False)
print(f"✓ Predictions saved to {predictions_path}")
print()

# Final summary
print("=" * 80)
print("📋 Evaluation Summary")
print("=" * 80)
print(f"✓ Test Accuracy: {accuracy_pct:.2f}%")
print(f"✓ F1-Score: {f1_weighted:.3f}")
print(f"✓ ROC-AUC: {roc_auc:.3f}" if 'roc_auc' in locals() else "✓ ROC-AUC: N/A")
print(f"✓ Total Test Examples: {len(test_df):,}")
print(f"✓ Misclassifications: {len(misclassified_indices):,} ({len(misclassified_indices)/len(test_df)*100:.1f}%)")
print()

print("=" * 80)
print("📝 Next Steps:")
if accuracy >= 0.60 and f1_weighted >= 0.58:
    print("  ✅ Model performance meets targets!")
    print("  1. Review Task 1.8: Create SentimentFusionService.ts")
    print("  2. Create Task 1.9: Python inference script")
    print("  3. Test Task 1.10: End-to-end prediction flow")
else:
    print("  ⚠️  Model performance below targets")
    print("  1. Analyze misclassifications for patterns")
    print("  2. Consider retraining with adjusted hyperparameters")
    print("  3. Refine text formatting and feature extraction")
print("=" * 80)
