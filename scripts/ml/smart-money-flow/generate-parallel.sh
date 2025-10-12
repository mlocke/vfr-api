#!/bin/bash

# Smart Money Flow Dataset - Parallel Generation
# Splits 500 stocks across 10 parallel processes for ~10x speedup

set -e

# Change to project root directory
cd "$(dirname "$0")/../../.."
PROJECT_ROOT=$(pwd)

# Fetch 500 stocks from stock-lists.ts dynamically (macOS bash 3 compatible)
echo "🔄 Loading 500 stocks from stock-lists.ts..."
STOCKS_JSON=$(npx tsx -e "
import { getTop500Stocks } from './scripts/ml/smart-money-flow/stock-lists';
const stocks = getTop500Stocks();
process.stdout.write(JSON.stringify(stocks));
" 2>/dev/null)

# Convert JSON array to bash array (bash 3 compatible)
if command -v jq &> /dev/null; then
    # Use jq if available
    STOCKS_STR=$(echo "$STOCKS_JSON" | jq -r '.[]' | tr '\n' ' ')
else
    # Fallback: simple JSON parsing
    STOCKS_STR=$(echo "$STOCKS_JSON" | sed 's/\[//g' | sed 's/\]//g' | sed 's/"//g' | sed 's/,/ /g')
fi

# Convert to array
IFS=' ' read -r -a STOCKS <<< "$STOCKS_STR"

TOTAL=${#STOCKS[@]}
NUM_PROCESSES=10
STOCKS_PER_PROCESS=$((TOTAL / NUM_PROCESSES))

echo "🚀 Smart Money Flow Parallel Dataset Generation"
echo "========================================================================"
echo "Total Stocks:        $TOTAL"
echo "Parallel Processes:  $NUM_PROCESSES"
echo "Stocks per Process:  $STOCKS_PER_PROCESS"
echo "Expected Examples:   ~18,000 (500 stocks × 36 months)"
echo "Expected Time:       2-3 hours (10x speedup from parallelization)"
echo "========================================================================"
echo ""

# Create log directory
mkdir -p /tmp/smart-money-parallel

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "generate-dataset.ts" 2>/dev/null || true
sleep 2

# Launch parallel processes
echo "🔥 Launching $NUM_PROCESSES parallel processes..."
echo ""

PIDS=()
for i in $(seq 0 $((NUM_PROCESSES - 1))); do
  START=$((i * STOCKS_PER_PROCESS))
  END=$((START + STOCKS_PER_PROCESS - 1))

  # Handle last batch (may have remainder stocks)
  if [ $i -eq $((NUM_PROCESSES - 1)) ]; then
    END=$((TOTAL - 1))
  fi

  # Extract stock subset
  SUBSET=()
  for j in $(seq $START $END); do
    SUBSET+=("${STOCKS[$j]}")
  done

  # Join array with commas
  SYMBOL_LIST=$(IFS=,; echo "${SUBSET[*]}")

  PROCESS_ID=$((i + 1))
  LOG_FILE="/tmp/smart-money-parallel/process-${PROCESS_ID}.log"

  # Get last element of SUBSET array
  LAST_IDX=$((${#SUBSET[@]} - 1))
  echo "Process $PROCESS_ID: Stocks $((START + 1))-$((END + 1)) (${SUBSET[0]} ... ${SUBSET[$LAST_IDX]})"
  echo "  Symbols: $SYMBOL_LIST"
  echo "  Log: $LOG_FILE"

  # Launch background process with unique output file
  DATASET_NAME="process-${PROCESS_ID}"
  npx tsx scripts/ml/smart-money-flow/generate-dataset.ts \
    --symbols "$SYMBOL_LIST" \
    --name "$DATASET_NAME" \
    > "$LOG_FILE" 2>&1 &

  PIDS+=($!)

  # Small delay to avoid overwhelming Redis on startup
  sleep 1
done

echo ""
echo "✅ All $NUM_PROCESSES processes launched!"
echo ""
echo "📊 Monitor progress:"
echo "  tail -f /tmp/smart-money-parallel/process-*.log"
echo ""
echo "🔍 Check individual process:"
echo "  tail -f /tmp/smart-money-parallel/process-1.log"
echo ""
echo "⏳ Waiting for all processes to complete..."
echo ""

# Wait for all processes to complete
FAILED=0
for i in "${!PIDS[@]}"; do
  PID=${PIDS[$i]}
  PROCESS_ID=$((i + 1))

  wait $PID
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Process $PROCESS_ID (PID $PID) completed successfully"
  else
    echo "❌ Process $PROCESS_ID (PID $PID) failed with exit code $EXIT_CODE"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "========================================================================"

if [ $FAILED -eq 0 ]; then
  echo "✅ All processes completed successfully!"
  echo ""
  echo "📦 Now combine the datasets:"
  echo "  npx tsx scripts/ml/smart-money-flow/combine-datasets.ts"
else
  echo "❌ $FAILED processes failed. Check logs in /tmp/smart-money-parallel/"
  exit 1
fi

echo "========================================================================"
