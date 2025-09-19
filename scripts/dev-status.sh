#!/bin/bash

# Development Environment Status and Health Check Script
# Monitors and reports on development server status

echo "🔍 VFR API Development Environment Status"
echo "========================================"

# Check for lock files
echo "📋 Lock File Status:"
if [ -f "/tmp/vfr-api-dev.lock" ]; then
    LOCK_PID=$(cat "/tmp/vfr-api-dev.lock" 2>/dev/null || echo "unknown")
    if kill -0 "$LOCK_PID" 2>/dev/null; then
        echo "  🔒 Lock file active (PID: $LOCK_PID)"
    else
        echo "  🗑️ Stale lock file detected (PID: $LOCK_PID - not running)"
    fi
else
    echo "  ✅ No lock file present"
fi

# Check PID file
echo "📋 PID File Status:"
if [ -f "/tmp/vfr-api-dev.pid" ]; then
    DEV_PID=$(cat "/tmp/vfr-api-dev.pid" 2>/dev/null || echo "unknown")
    if kill -0 "$DEV_PID" 2>/dev/null; then
        echo "  🚀 Dev server running (PID: $DEV_PID)"

        # Check memory usage
        MEMORY=$(ps -o rss= -p "$DEV_PID" 2>/dev/null | awk '{print int($1/1024)}')
        if [ -n "$MEMORY" ]; then
            echo "  💾 Memory usage: ${MEMORY}MB"
        fi
    else
        echo "  ❌ Stale PID file (PID: $DEV_PID - not running)"
    fi
else
    echo "  ✅ No PID file present"
fi

# Check port usage
echo "📋 Port Status:"
for port in 3000 3002; do
    if lsof -i:$port >/dev/null 2>&1; then
        PROCESS_INFO=$(lsof -i:$port | tail -n 1 | awk '{print $2 " (" $1 ")"}')
        echo "  🔴 Port $port: OCCUPIED by PID $PROCESS_INFO"
    else
        echo "  ✅ Port $port: AVAILABLE"
    fi
done

# Check for multiple dev processes
echo "📋 Development Processes:"
DEV_PROCESSES=$(pgrep -f "next dev" 2>/dev/null || true)
if [ -n "$DEV_PROCESSES" ]; then
    COUNT=$(echo "$DEV_PROCESSES" | wc -l | tr -d ' ')
    echo "  🔥 Found $COUNT Next.js dev process(es):"
    echo "$DEV_PROCESSES" | while read pid; do
        if [ -n "$pid" ]; then
            PROCESS_INFO=$(ps -p "$pid" -o pid,ppid,command 2>/dev/null | tail -n 1)
            echo "    - $PROCESS_INFO"
        fi
    done

    if [ "$COUNT" -gt 1 ]; then
        echo "  ⚠️  WARNING: Multiple dev servers detected!"
    fi
else
    echo "  ✅ No Next.js dev processes running"
fi

# Check npm dev processes
NPM_DEV_PROCESSES=$(pgrep -f "npm.*dev" 2>/dev/null || true)
if [ -n "$NPM_DEV_PROCESSES" ]; then
    COUNT=$(echo "$NPM_DEV_PROCESSES" | wc -l | tr -d ' ')
    echo "  📦 Found $COUNT npm dev process(es)"
    if [ "$COUNT" -gt 1 ]; then
        echo "  ⚠️  WARNING: Multiple npm dev processes detected!"
    fi
else
    echo "  ✅ No npm dev processes running"
fi

# Check cache status
echo "📋 Cache Status:"
if [ -d ".next" ]; then
    SIZE=$(du -sh .next 2>/dev/null | cut -f1)
    echo "  📂 .next cache: $SIZE"
else
    echo "  ✅ No .next cache"
fi

if [ -f "tsconfig.tsbuildinfo" ]; then
    SIZE=$(ls -lh tsconfig.tsbuildinfo | awk '{print $5}')
    echo "  📄 TypeScript cache: $SIZE"
else
    echo "  ✅ No TypeScript cache"
fi

# Network connectivity check
echo "📋 Network Status:"
if curl -s --connect-timeout 3 http://localhost:3000 >/dev/null 2>&1; then
    echo "  🌐 Port 3000: RESPONDING"
else
    echo "  🔴 Port 3000: NOT RESPONDING"
fi

# Recommendations
echo ""
echo "💡 Recommendations:"

# Check for issues and provide recommendations
ISSUES_FOUND=false

if [ -f "/tmp/vfr-api-dev.lock" ] && [ -f "/tmp/vfr-api-dev.pid" ]; then
    LOCK_PID=$(cat "/tmp/vfr-api-dev.lock" 2>/dev/null)
    DEV_PID=$(cat "/tmp/vfr-api-dev.pid" 2>/dev/null)
    if ! kill -0 "$LOCK_PID" 2>/dev/null || ! kill -0 "$DEV_PID" 2>/dev/null; then
        echo "  🧹 Clean up stale files: rm -f /tmp/vfr-api-dev.{lock,pid}"
        ISSUES_FOUND=true
    fi
fi

if [ -n "$(pgrep -f "next dev" 2>/dev/null)" ]; then
    COUNT=$(pgrep -f "next dev" | wc -l | tr -d ' ')
    if [ "$COUNT" -gt 1 ]; then
        echo "  🚨 Multiple dev servers running - run: ./scripts/emergency-cleanup.sh"
        ISSUES_FOUND=true
    fi
fi

if ! $ISSUES_FOUND; then
    echo "  ✅ Environment looks healthy!"
fi

echo ""
echo "🛠️  Available Commands:"
echo "  npm run dev:clean     - Clean start development server"
echo "  npm run dev:kill      - Kill all dev processes"
echo "  npm run dev:port-check - Check port availability"
echo "  ./scripts/emergency-cleanup.sh - Emergency cleanup"
echo "  ./scripts/dev-status.sh - This status check"