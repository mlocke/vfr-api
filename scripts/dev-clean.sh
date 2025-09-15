#!/bin/bash

# Clean Development Server Startup Script
# Ensures port 3000 is available and starts a clean development server

echo "🧹 Cleaning up development environment..."

# Check if port 3000 is in use
if lsof -i:3000 >/dev/null 2>&1; then
    echo "🚫 Port 3000 is in use. Attempting to free it..."

    # Kill processes using port 3000
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true

    # Wait a moment for processes to die
    sleep 2

    # Verify port is now free
    if lsof -i:3000 >/dev/null 2>&1; then
        echo "❌ Unable to free port 3000. Manual intervention required."
        echo "Run: lsof -i:3000 to see what's using the port"
        exit 1
    else
        echo "✅ Port 3000 is now available"
    fi
else
    echo "✅ Port 3000 is available"
fi

# Kill any stray npm/next development processes
echo "🔄 Cleaning up any stray development processes..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true

# Wait for cleanup
sleep 1

# Clear Next.js cache
echo "🗑️ Clearing Next.js cache..."
rm -rf .next

# Start fresh development server
echo "🚀 Starting clean development server on port 3000..."
npm run dev