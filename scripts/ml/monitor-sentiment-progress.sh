#!/bin/bash
# Monitor sentiment fusion dataset generation progress

LOG_FILE="dataset-generation.log"

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo "========================================================================"
echo "SENTIMENT FUSION DATASET GENERATION - PROGRESS MONITOR"
echo "========================================================================"
echo ""

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${RED}❌ Log file not found: $LOG_FILE${NC}"
    exit 1
fi

# Get latest progress
LATEST=$(grep -oE '\[[0-9]+/2400\]' "$LOG_FILE" | tail -1)
CURRENT=$(echo "$LATEST" | sed 's/\[//;s/\/2400\]//')

if [ -z "$CURRENT" ]; then
    echo "⏳ Waiting for dataset generation to start..."
    exit 0
fi

# Calculate progress
TOTAL=2400
PERCENT=$(awk "BEGIN {printf \"%.2f\", ($CURRENT/$TOTAL)*100}")
REMAINING=$((TOTAL - CURRENT))

# Calculate rate and ETA
START_TIME=$(stat -f %m "$LOG_FILE")
CURRENT_TIME=$(date +%s)
ELAPSED_SEC=$((CURRENT_TIME - START_TIME))
ELAPSED_MIN=$(awk "BEGIN {printf \"%.1f\", $ELAPSED_SEC/60}")

if [ "$CURRENT" -gt "0" ]; then
    RATE=$(awk "BEGIN {printf \"%.2f\", $CURRENT/$ELAPSED_MIN}")
    if (( $(echo "$RATE > 0" | bc -l) )); then
        ETA_MIN=$(awk "BEGIN {printf \"%.0f\", $REMAINING/$RATE}")
        ETA_HR=$(awk "BEGIN {printf \"%.1f\", $ETA_MIN/60}")
    else
        RATE="calculating..."
        ETA_MIN="calculating..."
        ETA_HR="calculating..."
    fi
else
    RATE="calculating..."
    ETA_MIN="calculating..."
    ETA_HR="calculating..."
fi

# Progress bar
BAR_WIDTH=50
FILLED=$(awk "BEGIN {printf \"%.0f\", ($PERCENT/100)*$BAR_WIDTH}")
EMPTY=$((BAR_WIDTH - FILLED))
BAR=$(printf "%${FILLED}s" | tr ' ' '█')$(printf "%${EMPTY}s" | tr ' ' '░')

echo -e "${BLUE}Progress:${NC} $CURRENT / $TOTAL examples generated"
echo -e "${GREEN}[$BAR]${NC} ${PERCENT}%"
echo ""
echo "Elapsed Time:       ${ELAPSED_MIN} minutes"
echo "Processing Rate:    ${RATE} examples/minute"
echo "Remaining:          ${REMAINING} examples"
echo "Estimated Time:     ${ETA_MIN} minutes (${ETA_HR} hours)"
echo ""

# Show latest symbol being processed
LATEST_ENTRY=$(grep -E '\[[0-9]+/2400\]' "$LOG_FILE" | tail -1)
SYMBOL=$(echo "$LATEST_ENTRY" | grep -oE '[A-Z]{1,5}' | head -1)
DATE=$(echo "$LATEST_ENTRY" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
echo -e "${YELLOW}Current:${NC} $SYMBOL @ $DATE"
echo ""

# Label distribution
BULLISH=$(grep "Label: BULLISH" "$LOG_FILE" | wc -l | tr -d ' ')
BEARISH=$(grep "Label: BEARISH" "$LOG_FILE" | wc -l | tr -d ' ')
NEUTRAL=$(grep "Label: NEUTRAL" "$LOG_FILE" | wc -l | tr -d ' ')
LABELED=$((BULLISH + BEARISH + NEUTRAL))

if [ "$LABELED" -gt "0" ]; then
    BULLISH_PCT=$(awk "BEGIN {printf \"%.1f\", ($BULLISH/$LABELED)*100}")
    BEARISH_PCT=$(awk "BEGIN {printf \"%.1f\", ($BEARISH/$LABELED)*100}")
    NEUTRAL_PCT=$(awk "BEGIN {printf \"%.1f\", ($NEUTRAL/$LABELED)*100}")

    echo "Label Distribution:"
    echo "  BULLISH:  $BULLISH ($BULLISH_PCT%)"
    echo "  BEARISH:  $BEARISH ($BEARISH_PCT%)"
    echo "  NEUTRAL:  $NEUTRAL ($NEUTRAL_PCT%)"
    echo ""
fi

# Cache stats - yearly caching
YEARLY_CACHE_DIR="data/cache/historical/news/yearly"
if [ -d "$YEARLY_CACHE_DIR" ]; then
    CACHE_SIZE=$(du -sh "$YEARLY_CACHE_DIR" 2>/dev/null | awk '{print $1}')
    CACHE_FILES=$(ls "$YEARLY_CACHE_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
    echo "Yearly Cache Size:  ${CACHE_SIZE}"
    echo "Yearly Cache Files: ${CACHE_FILES}"
    echo ""
fi

# Cache hit rate
CACHE_HITS=$(grep "Yearly cache HIT" "$LOG_FILE" | wc -l | tr -d ' ')
CACHE_MISSES=$(grep "Yearly cache MISS" "$LOG_FILE" | wc -l | tr -d ' ')
TOTAL_CACHE=$((CACHE_HITS + CACHE_MISSES))

if [ "$TOTAL_CACHE" -gt "0" ]; then
    HIT_RATE=$(awk "BEGIN {printf \"%.1f\", ($CACHE_HITS/$TOTAL_CACHE)*100}")
    echo "Cache Performance:"
    echo "  Hits:     $CACHE_HITS"
    echo "  Misses:   $CACHE_MISSES"
    echo "  Hit Rate: ${HIT_RATE}%"
    echo ""
fi

echo "========================================================================"
echo "💡 Tip: Run 'tail -f dataset-generation.log' to see live output"
echo "========================================================================"
