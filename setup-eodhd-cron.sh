#!/bin/bash
#
# Setup EODHD Options Dataset Nightly Cron Job
#
# This script sets up a cron job to run the dataset builder every night at 2 AM
#

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "================================================================================"
echo "EODHD Options Dataset - Nightly Cron Setup"
echo "================================================================================"
echo ""

# Get the absolute path to this directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "📁 Project directory: $SCRIPT_DIR"

# Check if Python3 is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 not found. Please install Python3 first.${NC}"
    exit 1
fi

# Check if the nightly script exists
if [ ! -f "$SCRIPT_DIR/build-eodhd-nightly.py" ]; then
    echo -e "${RED}❌ build-eodhd-nightly.py not found${NC}"
    exit 1
fi

# Check if the dataset builder exists
if [ ! -f "$SCRIPT_DIR/build-eodhd-options-dataset-fixed.py" ]; then
    echo -e "${RED}❌ build-eodhd-options-dataset-fixed.py not found${NC}"
    exit 1
fi

# Create data directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/data/eodhd_options"

echo ""
echo "🔍 Current cron jobs:"
crontab -l 2>/dev/null || echo "(no crontab entries)"

echo ""
echo "⏰ Setting up nightly cron job to run at 2:00 AM daily..."
echo ""

# Create the cron job entry
CRON_JOB="0 2 * * * cd $SCRIPT_DIR && /usr/bin/python3 build-eodhd-nightly.py >> data/eodhd_options/nightly_build.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -F "build-eodhd-nightly.py" > /dev/null; then
    echo -e "${YELLOW}⚠️  Cron job already exists. Removing old entry...${NC}"
    crontab -l 2>/dev/null | grep -v "build-eodhd-nightly.py" | crontab -
fi

# Add the new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo -e "${GREEN}✅ Cron job installed successfully!${NC}"
echo ""
echo "📋 Cron schedule: Every day at 2:00 AM"
echo "📁 Working directory: $SCRIPT_DIR"
echo "📝 Log file: $SCRIPT_DIR/data/eodhd_options/nightly_build.log"
echo "📊 Progress file: $SCRIPT_DIR/data/eodhd_options/progress.json"
echo ""
echo "================================================================================"
echo "Configuration"
echo "================================================================================"
echo ""
echo "Batch size: 50 tickers per night"
echo "API limit per night: 95,000 calls"
echo "Estimated completion: 10-15 nights (for 500 tickers)"
echo ""
echo "================================================================================"
echo "Monitoring"
echo "================================================================================"
echo ""
echo "View progress:"
echo "  cat $SCRIPT_DIR/data/eodhd_options/progress.json"
echo ""
echo "View log:"
echo "  tail -f $SCRIPT_DIR/data/eodhd_options/nightly_build.log"
echo ""
echo "Check if complete:"
echo "  ls $SCRIPT_DIR/data/eodhd_options/BUILD_COMPLETE.txt"
echo ""
echo "Manual run (test):"
echo "  cd $SCRIPT_DIR && python3 build-eodhd-nightly.py"
echo ""
echo "================================================================================"
echo "Cron Management"
echo "================================================================================"
echo ""
echo "List cron jobs:"
echo "  crontab -l"
echo ""
echo "Edit cron jobs:"
echo "  crontab -e"
echo ""
echo "Remove this cron job:"
echo "  crontab -l | grep -v 'build-eodhd-nightly.py' | crontab -"
echo ""
echo -e "${GREEN}✅ Setup complete! The nightly build will start at 2:00 AM.${NC}"
echo ""
echo "💡 Tip: Run a test now with:"
echo "   cd $SCRIPT_DIR && python3 build-eodhd-nightly.py"
echo ""
