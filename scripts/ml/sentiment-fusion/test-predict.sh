#!/bin/bash
# Test FinBERT prediction server

MODEL_DIR="models/sentiment-fusion/v1.0.0"
SCRIPT="scripts/ml/sentiment-fusion/predict-sentiment-fusion.py"

echo "Testing FinBERT Prediction Server..."
echo "Model dir: $MODEL_DIR"
echo ""

# Test input
TEST_TEXT='{"text":"[NEWS] Apple reported strong Q3 earnings with 15% revenue growth. Positive analyst sentiment. [ANALYST] Consensus rating: bullish, +20% upside to price target. [OPTIONS] Put/Call ratio: 0.7, bullish positioning. [MARKET] Low volatility regime, VIX at 15. [PRICE] Stock up 5% in last week, strong momentum."}'

echo "Sending test request..."
echo "$TEST_TEXT" | python3 "$SCRIPT" --model-dir "$MODEL_DIR"
