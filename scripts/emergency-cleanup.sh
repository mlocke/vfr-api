#!/bin/bash

# Emergency Development Environment Cleanup Script
# Use this when experiencing multiple dev server issues

echo "🚨 EMERGENCY CLEANUP: Stopping all development processes..."

# Kill all Next.js and npm development processes aggressively
pkill -f "next dev" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true

# Kill any processes using ports 3000-3010 (common dev ports)
for port in {3000..3010}; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "🔫 Killing processes on port $port"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    fi
done

# Wait for processes to die
sleep 3

# Verify cleanup
if pgrep -f "next dev" >/dev/null 2>&1; then
    echo "❌ Some Next.js processes still running. Manual intervention required."
    echo "Running processes:"
    pgrep -f "next dev" | xargs ps -p
    exit 1
fi

# Clear all Next.js caches
echo "🗑️ Clearing all caches..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf tsconfig.tsbuildinfo

echo "✅ Emergency cleanup completed. All dev processes terminated."
echo "🚀 You can now safely run 'npm run dev' or 'npm run dev:clean'"