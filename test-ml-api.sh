#!/bin/bash

echo "Testing /api/stocks/analyze with ML enabled..."
echo ""

curl -s -X POST http://localhost:3000/api/stocks/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "single",
    "symbols": ["AAPL"],
    "include_ml": true,
    "ml_horizon": "1w"
  }' > /tmp/ml-test-response.json

echo "=== Checking for mlPrediction field ==="
cat /tmp/ml-test-response.json | jq '.data.stocks[0] | keys' | grep -i mlPrediction && echo "✅ mlPrediction FOUND" || echo "❌ mlPrediction NOT FOUND"

echo ""
echo "=== Checking for early_signal field ==="
cat /tmp/ml-test-response.json | jq '.data.stocks[0] | keys' | grep -i early_signal && echo "✅ early_signal FOUND" || echo "❌ early_signal NOT FOUND"

echo ""
echo "=== All stock object keys ==="
cat /tmp/ml-test-response.json | jq '.data.stocks[0] | keys'

echo ""
echo "=== Full response saved to /tmp/ml-test-response.json ==="
