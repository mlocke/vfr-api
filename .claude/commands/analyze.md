---
name: analyze
description: Runs a stock or symbol through the analysis engine and displays findings.
arguments:
  - name: symbol
    description: The stock symbol to analyze (e.g., AAPL, TSLA).
    required: true
---

## Context
Run manual analysis on a stock symbol using the analysis engine to collect and display data from all integrated sources.

## Instructions
1. **Run** `{{symbol}}` through the analysis engine.
2. **Collect** raw data from all integrated sources.
3. **Display** initial findings with key metrics.
4. **Identify** any discrepancies or anomalies in the data.
