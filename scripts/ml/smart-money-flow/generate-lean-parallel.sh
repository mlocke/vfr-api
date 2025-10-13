#!/bin/bash

# Smart Money Flow LEAN Dataset - Parallel Generation
# Splits 100 stocks across 10 parallel processes (10 stocks each) for ~10x speedup

set -e

# Change to project root directory
cd "$(dirname "$0")/../../.."
PROJECT_ROOT=$(pwd)

# Fetch top 500 stocks from stock-lists.ts dynamically (macOS bash 3 compatible)
echo "🔄 Loading top 500 stocks from stock-lists.ts..."
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
MAX_STOCKS_PER_PROCESS=30
MAX_PARALLEL_PROCESSES=4

# Each process handles exactly MAX_STOCKS_PER_PROCESS stocks
STOCKS_PER_PROCESS=$MAX_STOCKS_PER_PROCESS

# Calculate how many processes we need (max 4 parallel)
NUM_PROCESSES=$(((TOTAL + STOCKS_PER_PROCESS - 1) / STOCKS_PER_PROCESS))
if [ $NUM_PROCESSES -gt $MAX_PARALLEL_PROCESSES ]; then
  NUM_PROCESSES=$MAX_PARALLEL_PROCESSES
fi

# Calculate how many stocks we'll actually process (4 processes × 30 stocks = 120)
STOCKS_TO_PROCESS=$((NUM_PROCESSES * STOCKS_PER_PROCESS))

echo "🚀 Smart Money Flow LEAN Parallel Dataset Generation"
echo "========================================================================"
echo "Total Stocks:        $TOTAL"
echo "Processing:          $STOCKS_TO_PROCESS stocks (first batch)"
echo "Parallel Processes:  $NUM_PROCESSES (max $MAX_PARALLEL_PROCESSES to avoid rate limits)"
echo "Stocks per Process:  $STOCKS_PER_PROCESS (strictly enforced)"
echo "Expected Examples:   ~$((STOCKS_TO_PROCESS * 48)) ($STOCKS_TO_PROCESS stocks × ~48 dates)"
echo "Expected Time:       15-20 minutes (rate-limited for API stability)"
echo ""
echo "Note: To process all $TOTAL stocks, run script $((TOTAL / STOCKS_TO_PROCESS)) times"
echo "      or increase MAX_STOCKS_PER_PROCESS (may cause rate limits)"
echo "========================================================================"
echo ""

# Create log directory
mkdir -p /tmp/lean-parallel

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "generate-lean-dataset.ts" 2>/dev/null || true
sleep 2

# Launch parallel processes
echo "🔥 Launching $NUM_PROCESSES parallel processes..."
echo ""

PIDS=()
for i in $(seq 0 $((NUM_PROCESSES - 1))); do
  START=$((i * STOCKS_PER_PROCESS))
  END=$((START + STOCKS_PER_PROCESS - 1))

  # Enforce strict limit: never exceed MAX_STOCKS_PER_PROCESS per process
  if [ $END -ge $TOTAL ]; then
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
  LOG_FILE="/tmp/lean-parallel/process-${PROCESS_ID}.log"

  # Get last element of SUBSET array
  LAST_IDX=$((${#SUBSET[@]} - 1))
  echo "Process $PROCESS_ID: Stocks $((START + 1))-$((END + 1)) (${SUBSET[0]} ... ${SUBSET[$LAST_IDX]})"
  echo "  Log: $LOG_FILE"

  # Launch background process with unique output file
  DATASET_NAME="lean-process-${PROCESS_ID}"
  npx tsx scripts/ml/smart-money-flow/generate-lean-dataset.ts \
    --symbols="$SYMBOL_LIST" \
    --name="$DATASET_NAME" \
    > "$LOG_FILE" 2>&1 &

  PIDS+=($!)

  # Stagger process startup to avoid overwhelming APIs
  sleep 2
done

echo ""
echo "✅ All $NUM_PROCESSES processes launched!"
echo ""
echo "📊 Monitor progress:"
echo "  tail -f /tmp/lean-parallel/process-*.log"
echo ""
echo "🔍 Check individual process:"
echo "  tail -f /tmp/lean-parallel/process-1.log"
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
  echo "  npx tsx scripts/ml/smart-money-flow/combine-lean-datasets.ts"
else
  echo "❌ $FAILED processes failed. Check logs in /tmp/lean-parallel/"
  exit 1
fi

echo "========================================================================"
