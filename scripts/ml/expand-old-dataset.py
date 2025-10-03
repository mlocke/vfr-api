#!/usr/bin/env python3
"""Add 15 new feature columns to old 1,051-example dataset"""

import pandas as pd

# Load old dataset
df = pd.read_csv('data/training/early-signal-combined-1051.csv')
print(f"Loaded {len(df)} examples with {len(df.columns)} columns")

# Add 15 new feature columns with placeholder zeros
new_features = [
    'fed_rate_change_30d',
    'unemployment_rate_change',
    'cpi_inflation_rate',
    'gdp_growth_rate',
    'treasury_yield_10y',
    'sec_insider_buying_ratio',
    'sec_institutional_ownership_change',
    'sec_8k_filing_count_30d',
    'analyst_price_target_change',
    'earnings_whisper_vs_estimate',
    'short_interest_change',
    'institutional_ownership_momentum',
    'options_put_call_ratio_change',
    'dividend_yield_change',
    'market_beta_30d'
]

# Insert new columns before 'label'
label_col = df['label']
df = df.drop('label', axis=1)

for feature in new_features:
    df[feature] = 0

df['label'] = label_col

print(f"Added {len(new_features)} new features (placeholders)")
print(f"New dataset has {len(df.columns)} columns")

# Save
df.to_csv('data/training/early-signal-combined-1051-v2.csv', index=False)
print("✓ Saved to early-signal-combined-1051-v2.csv")
