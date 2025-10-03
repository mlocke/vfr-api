#!/usr/bin/env python3
"""Evaluate trained LightGBM model on test set"""

import lightgbm as lgb
import pandas as pd
import numpy as np
import json
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

# Load test data
print("Loading test data...")
test_df = pd.read_csv('data/training/test.csv')

# Extract features and labels
feature_names = [
    'price_change_5d', 'price_change_10d', 'price_change_20d',
    'volume_ratio', 'volume_trend',
    'sentiment_news_delta', 'sentiment_reddit_accel', 'sentiment_options_shift',
    'social_stocktwits_24h_change', 'social_stocktwits_hourly_momentum', 'social_stocktwits_7d_trend',
    'social_twitter_24h_change', 'social_twitter_hourly_momentum', 'social_twitter_7d_trend',
    'earnings_surprise', 'revenue_growth_accel', 'analyst_coverage_change',
    'rsi_momentum', 'macd_histogram_trend',
    'fed_rate_change_30d', 'unemployment_rate_change', 'cpi_inflation_rate',
    'gdp_growth_rate', 'treasury_yield_10y',
    'sec_insider_buying_ratio', 'sec_institutional_ownership_change', 'sec_8k_filing_count_30d',
    'analyst_price_target_change', 'earnings_whisper_vs_estimate',
    'short_interest_change', 'institutional_ownership_momentum',
    'options_put_call_ratio_change', 'dividend_yield_change', 'market_beta_30d'
]

X_test = test_df[feature_names].values
y_test = test_df['label'].values

print(f"✓ Loaded {len(X_test)} test examples")

# Load normalizer
with open('models/early-signal/v1.0.0/normalizer.json', 'r') as f:
    normalizer = json.load(f)

# Normalize features
X_test_norm = (X_test - np.array(normalizer['mean'])) / np.array(normalizer['std'])

# Load model
model = lgb.Booster(model_file='models/early-signal/v1.0.0/model.txt')

# Make predictions
y_pred_proba = model.predict(X_test_norm)
y_pred = (y_pred_proba > 0.5).astype(int)

# Calculate metrics
accuracy = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
auc = roc_auc_score(y_test, y_pred_proba)

# Confusion matrix
cm = confusion_matrix(y_test, y_pred)

print("\n" + "="*80)
print("📊 TEST SET EVALUATION")
print("="*80)
print(f"Test Set Size: {len(X_test)} examples")
print(f"Label Distribution: {y_test.sum()} upgrades ({y_test.sum()/len(y_test)*100:.1f}%)")
print()
print(f"Accuracy:  {accuracy*100:.1f}%")
print(f"AUC:       {auc:.3f}")
print(f"Precision: {precision*100:.1f}%")
print(f"Recall:    {recall*100:.1f}%")
print(f"F1 Score:  {f1:.3f}")
print()
print("Confusion Matrix:")
print(f"  TN: {cm[0,0]:3d}  |  FP: {cm[0,1]:3d}")
print(f"  FN: {cm[1,0]:3d}  |  TP: {cm[1,1]:3d}")
print("="*80)
print("✅ Model evaluation complete")
print("="*80)
