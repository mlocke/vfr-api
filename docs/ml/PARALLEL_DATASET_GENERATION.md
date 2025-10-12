# Parallel Dataset Generation Pattern

**READ THIS BEFORE GENERATING ANY DATASET**

This document establishes the standard pattern for parallel dataset generation across all ML training workflows. Follow this pattern for maximum performance and reliability.

## Overview

**Problem**: Sequential dataset generation is too slow (7-8 hours for 3,600 examples)

**Solution**: Split workload across N parallel processes for ~10-36x speedup

**Achieved**: 7-8 hours → 11 minutes (36.5x speedup) for smart-money-flow dataset

## Architecture Pattern

### 1. Parallel Generation Script (`generate-parallel.sh`)

**Core Structure**:
```bash
#!/bin/bash
set -e

# CRITICAL: Set project root directory first
cd "$(dirname "$0")/../../.."
PROJECT_ROOT=$(pwd)

# Define data universe (stocks, dates, features, etc.)
ITEMS=(
  "ITEM1" "ITEM2" "ITEM3" ...
)

TOTAL=${#ITEMS[@]}
NUM_PROCESSES=10
ITEMS_PER_PROCESS=$((TOTAL / NUM_PROCESSES))

# Create log directory
mkdir -p /tmp/parallel-dataset-logs

# Clean up existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "generate-dataset.ts" 2>/dev/null || true
sleep 2

# Launch parallel processes
PIDS=()
for i in $(seq 0 $((NUM_PROCESSES - 1))); do
  START=$((i * ITEMS_PER_PROCESS))
  END=$((START + ITEMS_PER_PROCESS - 1))

  # Handle last batch (may have remainder)
  if [ $i -eq $((NUM_PROCESSES - 1)) ]; then
    END=$((TOTAL - 1))
  fi

  # Extract subset
  SUBSET=()
  for j in $(seq $START $END); do
    SUBSET+=("${ITEMS[$j]}")
  done

  # Join array with commas
  ITEM_LIST=$(IFS=,; echo "${SUBSET[*]}")

  PROCESS_ID=$((i + 1))
  LOG_FILE="/tmp/parallel-dataset-logs/process-${PROCESS_ID}.log"

  # CRITICAL: Use index for last element (not ${SUBSET[-1]})
  LAST_IDX=$((${#SUBSET[@]} - 1))
  echo "Process $PROCESS_ID: Items $((START + 1))-$((END + 1)) (${SUBSET[0]} ... ${SUBSET[$LAST_IDX]})"

  # CRITICAL: Unique --name parameter per process
  DATASET_NAME="process-${PROCESS_ID}"
  npx tsx scripts/ml/your-dataset/generate-dataset.ts \
    --items "$ITEM_LIST" \
    --name "$DATASET_NAME" \
    > "$LOG_FILE" 2>&1 &

  PIDS+=($!)

  # Small delay to avoid API stampede
  sleep 1
done

# Wait for all processes with error tracking
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

if [ $FAILED -eq 0 ]; then
  echo "✅ All processes completed successfully!"
  echo "📦 Now combine the datasets:"
  echo "  npx tsx scripts/ml/your-dataset/combine-datasets.ts"
else
  echo "❌ $FAILED processes failed. Check logs in /tmp/parallel-dataset-logs/"
  exit 1
fi
```

### 2. Combine Datasets Script (`combine-datasets.ts`)

**Core Structure**:
```typescript
import fs from "fs";
import path from "path";

const TRAINING_DIR = path.join(process.cwd(), "data/training/your-dataset");

async function combineDatasets() {
  console.log("📦 Combining parallel datasets...\n");

  // Find all process CSV files
  const files = fs.readdirSync(TRAINING_DIR)
    .filter((f) => f.startsWith("process-") && f.endsWith(".csv"))
    .map((f) => path.join(TRAINING_DIR, f));

  if (files.length === 0) {
    throw new Error("No process CSV files found!");
  }

  console.log(`Found ${files.length} process datasets to combine\n`);

  // Read datasets
  const datasets: Array<{ path: string; rows: number; content: string }> = [];
  let header = "";

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.trim().split("\n");

    if (!header) {
      header = lines[0]; // Save header from first file
    }

    datasets.push({
      path: file,
      rows: lines.length - 1, // Exclude header
      content,
    });
  }

  // Validate no duplicates (optional, dataset-specific)
  console.log("✓ Validation passed\n");

  // Combine all data rows
  const allRows: string[] = [header];
  let totalRows = 0;

  for (const dataset of datasets) {
    const lines = dataset.content.trim().split("\n");

    // Skip header, add data rows
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        allRows.push(lines[i]);
        totalRows++;
      }
    }

    console.log(`  ${path.basename(dataset.path)}: ${dataset.rows} rows`);
  }

  // Write combined dataset
  const outputPath = path.join(TRAINING_DIR, "combined-dataset.csv");
  fs.writeFileSync(outputPath, allRows.join("\n"), "utf-8");

  console.log("\n" + "=".repeat(70));
  console.log("✅ Dataset combination complete!");
  console.log(`📊 Total rows: ${totalRows}`);
  console.log(`📁 Output: ${outputPath}`);
  console.log("=".repeat(70));
}

combineDatasets().catch(console.error);
```

### 3. Dataset Generator Modifications

**CRITICAL: Support `--name` parameter for unique output files**

```typescript
// Parse CLI arguments
const args = process.argv.slice(2);
const nameIndex = args.indexOf("--name");
const datasetName = nameIndex !== -1 ? args[nameIndex + 1] : "default";

// Use unique output file per process
const outputPath = path.join(
  TRAINING_DIR,
  `${datasetName}.csv`  // e.g., "process-1.csv", "process-2.csv"
);
```

## Critical Fixes Checklist

### ✅ 1. Working Directory
**Problem**: Script runs from wrong directory, breaking relative paths

**Fix**: Always set project root first
```bash
cd "$(dirname "$0")/../../.."
PROJECT_ROOT=$(pwd)
```

### ✅ 2. Bash Array Syntax
**Problem**: `${SUBSET[-1]}` not compatible with all bash versions

**Fix**: Use index calculation
```bash
LAST_IDX=$((${#SUBSET[@]} - 1))
echo "... (${SUBSET[0]} ... ${SUBSET[$LAST_IDX]})"
```

### ✅ 3. Output File Collision
**Problem**: All processes write to same file, losing data

**Fix**: Unique `--name` parameter per process
```bash
DATASET_NAME="process-${PROCESS_ID}"
npx tsx generate-dataset.ts --name "$DATASET_NAME"
```

### ✅ 4. Process Launch
**Problem**: Processes fail to start due to path issues

**Fix**: Use absolute paths, set working directory
```bash
cd "$(dirname "$0")/../../.."
npx tsx scripts/ml/dataset/generate-dataset.ts
```

## Best Practices

### 1. **Optimal Process Count**
- **10 processes** for 100 items (10 items each)
- **20 processes** for 500 items (25 items each)
- Balance: CPU cores, API rate limits, memory

### 2. **Startup Delays**
```bash
# Prevent API stampede
sleep 1  # 1 second between process launches
```

### 3. **Shared Cache**
- Redis cache shared across all processes
- High cache hit rate (95%+) accelerates subsequent runs
- Thread-safe operations

### 4. **Progress Monitoring**
```bash
# Monitor all logs
tail -f /tmp/parallel-dataset-logs/process-*.log

# Check specific process
tail -f /tmp/parallel-dataset-logs/process-1.log

# Count completed examples
grep -c "✓ Example generated" /tmp/parallel-dataset-logs/process-*.log
```

### 5. **Error Handling**
- Track exit codes per process
- Continue on individual failures
- Report failed processes at end
- Log files enable debugging

### 6. **Cleanup**
```bash
# Kill existing processes before starting
pkill -f "generate-dataset.ts" 2>/dev/null || true
sleep 2
```

## Performance Targets

### Expected Speedup
- **Linear scaling**: N processes = ~N× speedup
- **Super-linear**: With high cache hit rate, can exceed N× speedup
- **Smart Money Flow**: 10 processes = 36.5× speedup (7-8 hours → 11 minutes)

### Bottleneck Analysis
1. **API rate limits** - Mitigated by cache
2. **CPU** - Ensure processes < cores
3. **Memory** - Monitor with `htop`
4. **I/O** - Separate log files reduce contention

## Troubleshooting

### Process Hangs
```bash
# Check if processes running
ps aux | grep "generate-dataset.ts"

# Kill hung processes
pkill -9 -f "generate-dataset.ts"
```

### Missing Data
```bash
# Verify all process files created
ls -lh data/training/your-dataset/process-*.csv

# Count rows per file
wc -l data/training/your-dataset/process-*.csv
```

### API Rate Limits
- Add longer delays between launches: `sleep 2`
- Reduce process count
- Check API rate limit logs

### Memory Issues
- Reduce process count
- Add checkpointing within generator
- Monitor with: `htop` or `top`

## Workflow Summary

### Step 1: Generate in Parallel
```bash
cd /Users/michaellocke/WebstormProjects/Home/public/vfr-api
./scripts/ml/your-dataset/generate-parallel.sh
```

### Step 2: Monitor Progress
```bash
# Watch all processes
tail -f /tmp/parallel-dataset-logs/process-*.log

# Quick status check
grep "Total Examples:" /tmp/parallel-dataset-logs/process-*.log
```

### Step 3: Combine Results
```bash
npx tsx scripts/ml/your-dataset/combine-datasets.ts
```

### Step 4: Validate Output
```bash
# Check combined file
wc -l data/training/your-dataset/combined-dataset.csv
head -5 data/training/your-dataset/combined-dataset.csv
```

## Template Checklist

When creating a new parallel dataset generator:

- [ ] Copy `generate-parallel.sh` template
- [ ] Set project root: `cd "$(dirname "$0")/../../.."`
- [ ] Define data universe (stocks, dates, etc.)
- [ ] Calculate splits: `ITEMS_PER_PROCESS=$((TOTAL / NUM_PROCESSES))`
- [ ] Use index for last element: `LAST_IDX=$((${#SUBSET[@]} - 1))`
- [ ] Unique `--name` per process: `--name "process-${PROCESS_ID}"`
- [ ] Separate log files: `> /tmp/logs/process-${PROCESS_ID}.log 2>&1 &`
- [ ] Add startup delays: `sleep 1`
- [ ] Track process IDs: `PIDS+=($!)`
- [ ] Wait with error tracking: `wait $PID; EXIT_CODE=$?`
- [ ] Create `combine-datasets.ts` script
- [ ] Update generator to support `--name` parameter
- [ ] Test with small dataset first
- [ ] Document in this file

## Related Files

- `scripts/ml/smart-money-flow/generate-parallel.sh` - Reference implementation
- `scripts/ml/smart-money-flow/combine-datasets.ts` - Reference combiner
- `docs/ml/SMART_MONEY_CACHE_IMPLEMENTATION.md` - Cache architecture
- `docs/ml/plans/` - ML planning documents

## Success Metrics

**Smart Money Flow Dataset (Reference Implementation)**:
- ⚡ Speedup: 36.5× (7-8 hours → 11 minutes)
- 📊 Examples: 3,600 (100 stocks × 36 dates)
- 🔄 Processes: 10 parallel
- 💾 Cache hit rate: 95%+
- ✅ Success rate: 98.9% (3,560/3,600 examples)

---

**Last Updated**: 2025-10-10
**Pattern Version**: 1.0
**Reference Implementation**: smart-money-flow dataset generation
