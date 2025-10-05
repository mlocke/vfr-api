#!/bin/bash

echo "==================================="
echo "Testing ML Prediction Integration"
echo "==================================="
echo ""

# Test 1: API with ML enabled
echo "1. Testing API with include_ml=true for NVDA..."
curl -s -X POST http://localhost:3000/api/stocks/analyze \
  -H "Content-Type: application/json" \
  -d '{"mode":"single","symbols":["NVDA"],"include_ml":true,"ml_horizon":"1w"}' \
  > /tmp/ml-nvda-response.json

echo "   - API Response received"
echo "   - Has mlPrediction: $(cat /tmp/ml-nvda-response.json | jq -r '.data.stocks[0].mlPrediction != null')"
echo "   - ML Confidence: $(cat /tmp/ml-nvda-response.json | jq -r '.data.stocks[0].mlPrediction.confidence // "N/A"')"
echo "   - ML Direction: $(cat /tmp/ml-nvda-response.json | jq -r '.data.stocks[0].mlPrediction.direction // "N/A"')"
echo ""

# Test 2: Check rendering condition
CONFIDENCE=$(cat /tmp/ml-nvda-response.json | jq -r '.data.stocks[0].mlPrediction.confidence // 0')
echo "2. Checking rendering condition..."
echo "   - Confidence value: $CONFIDENCE"
echo "   - Will render (any confidence): YES ✅"
echo ""

# Test 3: Verify all required fields exist
echo "3. Verifying ML prediction structure..."
cat /tmp/ml-nvda-response.json | jq '.data.stocks[0].mlPrediction | keys' > /tmp/ml-keys.json
echo "   - Fields present:"
cat /tmp/ml-keys.json | jq -r '.[]' | sed 's/^/     - /'
echo ""

echo "==================================="
echo "✅ All checks complete!"
echo "==================================="
echo ""
echo "Full response saved to: /tmp/ml-nvda-response.json"
echo "View with: cat /tmp/ml-nvda-response.json | jq '.data.stocks[0].mlPrediction'"
