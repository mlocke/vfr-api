#!/bin/bash

# Enhanced Clean Development Server Startup Script
# Prevents multiple dev server spawning and ensures clean startup

set -e  # Exit on any error

LOCKFILE="/tmp/vfr-api-dev.lock"
PID_FILE="/tmp/vfr-api-dev.pid"
PORT=3000

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up on exit..."
    rm -f "$LOCKFILE" "$PID_FILE"
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Check if another dev-clean process is already running
if [ -f "$LOCKFILE" ]; then
    LOCK_PID=$(cat "$LOCKFILE" 2>/dev/null || echo "")
    if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
        echo "❌ Another dev-clean process is already running (PID: $LOCK_PID)"
        echo "Wait for it to complete or run: kill $LOCK_PID"
        exit 1
    else
        echo "🗑️ Removing stale lock file"
        rm -f "$LOCKFILE"
    fi
fi

# Create lock file with current PID
echo $$ > "$LOCKFILE"

echo "🧹 Enhanced development environment cleanup..."

# Kill ALL related processes more aggressively
echo "🔄 Terminating all development processes..."

# Kill by process name patterns
pkill -f "next dev" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true
pkill -f "node.*next.*dev" 2>/dev/null || true

# Kill processes using development ports (3000-3010)
for port in {3000..3010}; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "🔫 Killing processes on port $port"
        lsof -ti:$port | xargs kill -15 2>/dev/null || true
        sleep 1
        # Force kill if still running
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    fi
done

# Wait for processes to fully terminate
echo "⏳ Waiting for processes to terminate..."
sleep 3

# Verify port 3000 is available
for i in {1..5}; do
    if ! lsof -i:$PORT >/dev/null 2>&1; then
        echo "✅ Port $PORT is now available"
        break
    fi
    if [ $i -eq 5 ]; then
        echo "❌ Unable to free port $PORT after 5 attempts"
        echo "Processes still using port $PORT:"
        lsof -i:$PORT
        exit 1
    fi
    echo "⏳ Attempt $i/5: Waiting for port $PORT to be freed..."
    sleep 2
done

# Comprehensive cache cleanup
echo "🗑️ Comprehensive cache cleanup..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf tsconfig.tsbuildinfo
rm -rf .turbo

# Clear npm cache if it seems corrupted
if [ -f "package-lock.json" ]; then
    npm cache verify >/dev/null 2>&1 || {
        echo "🔧 Clearing npm cache..."
        npm cache clean --force
    }
fi

# Store PID for monitoring
echo "🚀 Starting clean development server on port $PORT..."
npm run dev &
DEV_PID=$!
echo $DEV_PID > "$PID_FILE"

# Monitor the process for a few seconds to ensure it starts successfully
sleep 5
if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "❌ Development server failed to start"
    exit 1
fi

echo "✅ Development server started successfully (PID: $DEV_PID)"
echo "🔍 Monitor with: tail -f /tmp/vfr-api-dev.log"

# Wait for the dev server process
wait $DEV_PID