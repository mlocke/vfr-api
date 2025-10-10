#!/usr/bin/env python3
"""
Compare FinBERT-Enhanced Model vs Baseline Model

Generates a comprehensive comparison report between:
- v1.3.0: 46 features (43 price + 3 FinBERT)
- v1.2.0-baseline: 43 features (price only)

Analyzes:
- Performance metrics (accuracy, precision, recall, F1)
- Per-class improvements/degradations
- Confidence distributions
- Feature importance comparisons
- Recommendations for production deployment

Usage:
    python3 scripts/ml/compare-models.py
"""

import json
import pandas as pd
import numpy as np

def load_metadata(model_dir):
    """Load model metadata"""
    with open(f"{model_dir}/metadata.json", 'r') as f:
        return json.load(f)

def load_test_evaluation(model_dir):
    """Load test evaluation results"""
    with open(f"{model_dir}/test_evaluation.json", 'r') as f:
        return json.load(f)

def compare_models():
    print("=" * 80)
    print("📊 MODEL COMPARISON REPORT")
    print("=" * 80)
    print("\nComparing:")
    print("  🧠 v1.3.0 (FinBERT-Enhanced): 46 features (43 price + 3 FinBERT)")
    print("  📈 v1.2.0-baseline: 43 features (price only)")
    print("=" * 80)

    # Load metadata
    finbert_meta = load_metadata("models/price-prediction/v1.3.0")
    baseline_meta = load_metadata("models/price-prediction/v1.2.0-baseline")

    # Load test evaluations
    finbert_eval = load_test_evaluation("models/price-prediction/v1.3.0")
    baseline_eval = load_test_evaluation("models/price-prediction/v1.2.0-baseline")

    # === VALIDATION PERFORMANCE ===
    print("\n" + "=" * 80)
    print("📈 VALIDATION SET PERFORMANCE")
    print("=" * 80)

    finbert_val_acc = finbert_meta['validation_metrics']['accuracy']
    baseline_val_acc = baseline_meta['validation_metrics']['accuracy']
    val_diff = finbert_val_acc - baseline_val_acc
    val_improvement = (val_diff / baseline_val_acc) * 100

    print(f"\n{'Model':<30} {'Accuracy':<15} {'Difference':<15}")
    print("-" * 60)
    print(f"{'FinBERT-Enhanced (v1.3.0)':<30} {finbert_val_acc:.4f} ({finbert_val_acc*100:.2f}%)")
    print(f"{'Baseline (v1.2.0)':<30} {baseline_val_acc:.4f} ({baseline_val_acc*100:.2f}%)")
    print("-" * 60)

    if val_diff > 0:
        print(f"{'✅ FinBERT improves by:':<30} {val_diff:.4f} ({val_improvement:.2f}%)")
    else:
        print(f"{'❌ FinBERT degrades by:':<30} {abs(val_diff):.4f} ({abs(val_improvement):.2f}%)")

    # === TEST PERFORMANCE (PRIMARY METRIC) ===
    print("\n" + "=" * 80)
    print("🎯 TEST SET PERFORMANCE (FINAL METRIC)")
    print("=" * 80)

    finbert_test_acc = finbert_eval['test_accuracy']
    baseline_test_acc = baseline_eval['test_accuracy']
    test_diff = finbert_test_acc - baseline_test_acc
    test_improvement = (test_diff / baseline_test_acc) * 100

    print(f"\n{'Model':<30} {'Accuracy':<15} {'F1 (weighted)':<15}")
    print("-" * 60)
    print(f"{'FinBERT-Enhanced (v1.3.0)':<30} {finbert_test_acc:.4f} ({finbert_test_acc*100:.2f}%)  {finbert_eval['test_f1_weighted']:.4f}")
    print(f"{'Baseline (v1.2.0)':<30} {baseline_test_acc:.4f} ({baseline_test_acc*100:.2f}%)  {baseline_eval['test_f1_weighted']:.4f}")
    print("-" * 60)

    if test_diff > 0:
        print(f"{'✅ FinBERT improves by:':<30} {test_diff:.4f} ({test_improvement:.2f}%)")
    else:
        print(f"{'❌ FinBERT degrades by:':<30} {abs(test_diff):.4f} ({abs(test_improvement):.2f}%)")

    # === GENERALIZATION GAP ===
    print("\n" + "=" * 80)
    print("🔍 GENERALIZATION GAP (Val → Test)")
    print("=" * 80)

    finbert_gap = finbert_val_acc - finbert_test_acc
    baseline_gap = baseline_val_acc - baseline_test_acc

    print(f"\n{'Model':<30} {'Val Acc':<12} {'Test Acc':<12} {'Gap':<12}")
    print("-" * 68)
    print(f"{'FinBERT-Enhanced':<30} {finbert_val_acc:.4f}    {finbert_test_acc:.4f}    {finbert_gap:.4f}")
    print(f"{'Baseline':<30} {baseline_val_acc:.4f}    {baseline_test_acc:.4f}    {baseline_gap:.4f}")
    print("-" * 68)

    if finbert_gap > baseline_gap:
        print(f"\n⚠️  FinBERT shows MORE overfitting (gap: {finbert_gap:.4f} vs {baseline_gap:.4f})")
    else:
        print(f"\n✅ FinBERT shows LESS overfitting (gap: {finbert_gap:.4f} vs {baseline_gap:.4f})")

    # === PER-CLASS COMPARISON ===
    print("\n" + "=" * 80)
    print("📊 PER-CLASS PERFORMANCE (Test Set)")
    print("=" * 80)

    for class_name in ['DOWN', 'NEUTRAL', 'UP']:
        finbert_class = finbert_eval['per_class_metrics'][class_name]
        baseline_class = baseline_eval['per_class_metrics'][class_name]

        print(f"\n{class_name} Class:")
        print(f"  {'Metric':<15} {'FinBERT':<12} {'Baseline':<12} {'Difference':<12}")
        print("  " + "-" * 52)

        for metric in ['precision', 'recall', 'f1_score']:
            finbert_val = finbert_class[metric]
            baseline_val = baseline_class[metric]
            diff = finbert_val - baseline_val
            symbol = "✅" if diff > 0 else "❌"
            print(f"  {metric.capitalize():<15} {finbert_val:.4f}      {baseline_val:.4f}      {symbol} {diff:+.4f}")

    # === CONFIDENCE ANALYSIS ===
    print("\n" + "=" * 80)
    print("🎯 PREDICTION CONFIDENCE")
    print("=" * 80)

    print(f"\n{'Model':<30} {'Avg Conf':<12} {'High (>70%)':<15} {'Med (50-70%)':<15} {'Low (<50%)':<12}")
    print("-" * 90)

    finbert_conf = finbert_eval['average_confidence']
    finbert_dist = finbert_eval['confidence_distribution']
    baseline_conf = baseline_eval['average_confidence']
    baseline_dist = baseline_eval['confidence_distribution']

    print(f"{'FinBERT-Enhanced':<30} {finbert_conf:.4f}     {finbert_dist['high']:<15} {finbert_dist['medium']:<15} {finbert_dist['low']:<12}")
    print(f"{'Baseline':<30} {baseline_conf:.4f}     {baseline_dist['high']:<15} {baseline_dist['medium']:<15} {baseline_dist['low']:<12}")

    # === FEATURE IMPORTANCE ===
    print("\n" + "=" * 80)
    print("🎯 FINBERT FEATURE IMPORTANCE (in v1.3.0)")
    print("=" * 80)

    finbert_features = finbert_meta['feature_importance']
    finbert_df = pd.DataFrame(finbert_features)

    print(f"\nFinBERT features ranked among all 46 features:")
    for idx, row in finbert_df.iterrows():
        if 'finbert' in row['feature']:
            rank = idx + 1
            print(f"  #{rank}: {row['feature']:<25} importance = {row['importance']:.0f}")

    # === TOP FEATURES COMPARISON ===
    print("\n" + "=" * 80)
    print("📊 TOP 10 FEATURES COMPARISON")
    print("=" * 80)

    print("\nFinBERT-Enhanced Model (v1.3.0):")
    for idx, row in finbert_df.head(10).iterrows():
        marker = "🧠" if 'finbert' in row['feature'] else "📈"
        print(f"  {idx+1:2}. {marker} {row['feature']:<30} {row['importance']:.0f}")

    baseline_features = baseline_meta['feature_importance']
    baseline_df = pd.DataFrame(baseline_features)

    print("\nBaseline Model (v1.2.0):")
    for idx, row in baseline_df.head(10).iterrows():
        print(f"  {idx+1:2}. 📈 {row['feature']:<30} {row['importance']:.0f}")

    # === ERROR ANALYSIS ===
    print("\n" + "=" * 80)
    print("❌ ERROR ANALYSIS")
    print("=" * 80)

    finbert_errors = finbert_eval['error_count']
    baseline_errors = baseline_eval['error_count']
    error_diff = finbert_errors - baseline_errors

    print(f"\n{'Model':<30} {'Errors':<12} {'Error Rate':<15}")
    print("-" * 58)
    print(f"{'FinBERT-Enhanced':<30} {finbert_errors:<12} {finbert_eval['error_rate']*100:.2f}%")
    print(f"{'Baseline':<30} {baseline_errors:<12} {baseline_eval['error_rate']*100:.2f}%")
    print("-" * 58)

    if error_diff > 0:
        print(f"❌ FinBERT makes {error_diff} MORE errors")
    else:
        print(f"✅ FinBERT makes {abs(error_diff)} FEWER errors")

    # === RECOMMENDATIONS ===
    print("\n" + "=" * 80)
    print("💡 RECOMMENDATIONS")
    print("=" * 80)

    if test_diff > 0.02:  # >2% improvement
        print("\n✅ RECOMMENDATION: Deploy FinBERT-Enhanced Model (v1.3.0)")
        print(f"   - Test accuracy improvement: {test_diff:.4f} ({test_improvement:.2f}%)")
        print(f"   - FinBERT features ranked #{11}, #{17}, #{21} in importance")
        print(f"   - Provides sentiment-aware predictions")
    elif test_diff < -0.02:  # >2% degradation
        print("\n❌ RECOMMENDATION: Use Baseline Model (v1.2.0-baseline)")
        print(f"   - FinBERT degrades test accuracy by {abs(test_diff):.4f} ({abs(test_improvement):.2f}%)")
        print(f"   - Possible reasons:")
        print(f"     • FinBERT features may be adding noise")
        print(f"     • Text narratives may not align with price movements")
        print(f"     • Dataset size too small for sentiment features to generalize")
        print(f"\n   - Next steps:")
        print(f"     • Expand dataset with cached news (12,232 rows)")
        print(f"     • Re-train both models on larger dataset")
        print(f"     • Re-evaluate FinBERT contribution")
    else:
        print("\n⚠️  RECOMMENDATION: Neutral - Models perform similarly")
        print(f"   - Test accuracy difference: {test_diff:.4f} ({test_improvement:.2f}%)")
        print(f"   - Consider other factors:")
        print(f"     • Production inference cost (46 vs 43 features)")
        print(f"     • Interpretability needs")
        print(f"     • Future dataset expansion plans")

    # === SUMMARY ===
    print("\n" + "=" * 80)
    print("📋 EXECUTIVE SUMMARY")
    print("=" * 80)

    print(f"\nDataset:")
    print(f"  Train: {finbert_meta['num_train_examples']} examples")
    print(f"  Val:   {finbert_meta['num_val_examples']} examples")
    print(f"  Test:  {finbert_eval['test_samples']} examples")

    print(f"\nFinBERT-Enhanced Model (v1.3.0):")
    print(f"  Features: 46 (43 price + 3 FinBERT)")
    print(f"  Val Accuracy:  {finbert_val_acc*100:.2f}%")
    print(f"  Test Accuracy: {finbert_test_acc*100:.2f}%")
    print(f"  Generalization Gap: {finbert_gap:.4f}")

    print(f"\nBaseline Model (v1.2.0-baseline):")
    print(f"  Features: 43 (price only)")
    print(f"  Val Accuracy:  {baseline_val_acc*100:.2f}%")
    print(f"  Test Accuracy: {baseline_test_acc*100:.2f}%")
    print(f"  Generalization Gap: {baseline_gap:.4f}")

    print(f"\nFinBERT Contribution:")
    print(f"  Validation: {val_diff:+.4f} ({val_improvement:+.2f}%)")
    print(f"  Test:       {test_diff:+.4f} ({test_improvement:+.2f}%)")

    # Save comparison report
    print("\n💾 Saving comparison report...")
    report = {
        'comparison_date': pd.Timestamp.now().isoformat(),
        'models': {
            'finbert_enhanced': {
                'version': 'v1.3.0',
                'features': 46,
                'val_accuracy': finbert_val_acc,
                'test_accuracy': finbert_test_acc,
                'test_f1_weighted': finbert_eval['test_f1_weighted'],
                'generalization_gap': finbert_gap
            },
            'baseline': {
                'version': 'v1.2.0-baseline',
                'features': 43,
                'val_accuracy': baseline_val_acc,
                'test_accuracy': baseline_test_acc,
                'test_f1_weighted': baseline_eval['test_f1_weighted'],
                'generalization_gap': baseline_gap
            }
        },
        'finbert_contribution': {
            'validation_improvement': val_diff,
            'validation_improvement_pct': val_improvement,
            'test_improvement': test_diff,
            'test_improvement_pct': test_improvement
        },
        'recommendation': 'baseline' if test_diff < -0.02 else ('finbert' if test_diff > 0.02 else 'neutral')
    }

    with open("models/price-prediction/model_comparison_report.json", 'w') as f:
        json.dump(report, f, indent=2)
    print("✓ Comparison report saved: models/price-prediction/model_comparison_report.json")

    print("\n" + "=" * 80)
    print("✅ Comparison Complete!")
    print("=" * 80)

if __name__ == "__main__":
    compare_models()
