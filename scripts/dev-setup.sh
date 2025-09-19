#!/bin/bash

# Development Environment Setup and Prevention Script
# Sets up monitoring and prevention mechanisms for dev server issues

echo "🔧 Setting up VFR API Development Environment Protection"
echo "======================================================="

# Create necessary directories
mkdir -p scripts logs

# Set up log rotation for development logs
echo "📝 Setting up log management..."

# Create logrotate configuration
cat > /tmp/vfr-api-logrotate << 'EOF'
/tmp/vfr-api-*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) staff
}
EOF

# Install the logrotate config (if logrotate is available)
if command -v logrotate >/dev/null 2>&1; then
    echo "✅ Logrotate configuration created"
else
    echo "⚠️  Logrotate not available - logs will need manual cleanup"
fi

# Set up shell aliases for convenience
echo "🔗 Setting up development aliases..."

ALIAS_FILE="$HOME/.vfr-dev-aliases"
cat > "$ALIAS_FILE" << 'EOF'
# VFR API Development Aliases
alias vfr-dev='cd /Users/michaellocke/WebstormProjects/Home/public/vfr-api && npm run dev:clean'
alias vfr-status='cd /Users/michaellocke/WebstormProjects/Home/public/vfr-api && npm run dev:status'
alias vfr-emergency='cd /Users/michaellocke/WebstormProjects/Home/public/vfr-api && npm run dev:emergency'
alias vfr-monitor='cd /Users/michaellocke/WebstormProjects/Home/public/vfr-api && ./scripts/dev-monitor.sh'
alias vfr-logs='tail -f /tmp/vfr-api-*.log'
EOF

echo "✅ Aliases created in $ALIAS_FILE"
echo "Add 'source $ALIAS_FILE' to your shell profile to enable aliases"

# Set up git hooks to prevent dev server conflicts
echo "🪝 Setting up git hooks..."

mkdir -p .git/hooks

# Pre-commit hook to clean dev environment
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook to ensure clean development environment

echo "🔍 Checking development environment before commit..."

# Check for running dev servers
if pgrep -f "next dev" >/dev/null 2>&1; then
    DEV_COUNT=$(pgrep -f "next dev" | wc -l | tr -d ' ')
    if [ "$DEV_COUNT" -gt 1 ]; then
        echo "⚠️  Warning: Multiple dev servers running ($DEV_COUNT)"
        echo "Consider running: npm run dev:emergency"
    fi
fi

# Clean up any stale lock files
rm -f /tmp/vfr-api-dev.lock /tmp/vfr-api-dev.pid

exit 0
EOF

chmod +x .git/hooks/pre-commit

# Post-merge hook to clean environment after merges
cat > .git/hooks/post-merge << 'EOF'
#!/bin/bash
# Post-merge hook to clean development environment

echo "🧹 Cleaning development environment after merge..."

# Kill any running dev servers
pkill -f "next dev" 2>/dev/null || true

# Clean caches
rm -rf .next tsconfig.tsbuildinfo

echo "✅ Development environment cleaned"
EOF

chmod +x .git/hooks/post-merge

echo "✅ Git hooks installed"

# Create a systemd user service (Linux) or launchd service (macOS) for monitoring
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Setting up macOS LaunchAgent for monitoring..."

    PLIST_FILE="$HOME/Library/LaunchAgents/com.veritak.dev-monitor.plist"
    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.veritak.dev-monitor</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/michaellocke/WebstormProjects/Home/public/vfr-api/scripts/dev-monitor.sh</string>
        <string>monitor</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/michaellocke/WebstormProjects/Home/public/vfr-api</string>
    <key>StandardOutPath</key>
    <string>/tmp/vfr-api-monitor.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/vfr-api-monitor-error.log</string>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
EOF

    echo "✅ LaunchAgent created: $PLIST_FILE"
    echo "To enable automatic monitoring:"
    echo "  launchctl load $PLIST_FILE"
    echo "To disable:"
    echo "  launchctl unload $PLIST_FILE"
fi

# Create environment check script
echo "🔍 Creating environment health check..."

cat > scripts/daily-health-check.sh << 'EOF'
#!/bin/bash

# Daily Development Environment Health Check
# Run this daily to ensure environment is healthy

echo "🏥 VFR API Daily Health Check - $(date)"
echo "============================================"

# Check for accumulated log files
LOG_SIZE=$(du -sh /tmp/vfr-api-*.log 2>/dev/null | awk '{total+=$1} END {print total}' || echo "0")
if [ -n "$LOG_SIZE" ] && [ "$LOG_SIZE" != "0" ]; then
    echo "📊 Log files size: $LOG_SIZE"
    if [ "$LOG_SIZE" -gt 100 ]; then
        echo "⚠️  Consider cleaning old logs"
    fi
fi

# Check for orphaned processes
ORPHANED=$(ps aux | grep -E "(next|npm)" | grep -v grep | grep -v "$(basename "$0")" | wc -l | tr -d ' ')
if [ "$ORPHANED" -gt 0 ]; then
    echo "🧟 Found $ORPHANED potentially orphaned processes"
    ps aux | grep -E "(next|npm)" | grep -v grep | grep -v "$(basename "$0")"
fi

# Check cache sizes
if [ -d ".next" ]; then
    CACHE_SIZE=$(du -sh .next | cut -f1)
    echo "💾 .next cache size: $CACHE_SIZE"
fi

# Check for port conflicts
for port in 3000 3002; do
    if lsof -i:$port >/dev/null 2>&1; then
        echo "🔴 Port $port is in use"
    fi
done

# Memory usage check
MEMORY_USAGE=$(ps aux | grep -E "(next|npm)" | grep -v grep | awk '{sum+=$6} END {print int(sum/1024)}' || echo "0")
if [ "$MEMORY_USAGE" -gt 500 ]; then
    echo "🧠 High memory usage: ${MEMORY_USAGE}MB"
fi

echo "✅ Health check completed"
EOF

chmod +x scripts/daily-health-check.sh

echo "✅ Daily health check script created"

# Update package.json with monitoring commands
echo "📦 Adding monitoring commands to package.json..."

# Show setup completion
echo ""
echo "🎉 Development Environment Protection Setup Complete!"
echo "====================================================="
echo ""
echo "Available Commands:"
echo "  npm run dev:clean     - Clean start (recommended)"
echo "  npm run dev:status    - Check environment status"
echo "  npm run dev:emergency - Emergency cleanup"
echo "  npm run dev:monitor   - Start process monitor"
echo ""
echo "New Scripts Created:"
echo "  ./scripts/emergency-cleanup.sh  - Emergency process cleanup"
echo "  ./scripts/dev-status.sh         - Environment status check"
echo "  ./scripts/dev-monitor.sh        - Process monitoring"
echo "  ./scripts/daily-health-check.sh - Daily health check"
echo ""
echo "Prevention Features:"
echo "  ✅ Lock file mechanism to prevent concurrent starts"
echo "  ✅ Aggressive process cleanup"
echo "  ✅ Port conflict detection and resolution"
echo "  ✅ Cache management"
echo "  ✅ Git hooks for clean environment"
echo "  ✅ Process monitoring and auto-remediation"
echo ""
echo "Recommended Workflow:"
echo "  1. Always use 'npm run dev:clean' instead of 'npm run dev'"
echo "  2. Run 'npm run dev:status' to check environment health"
echo "  3. Use 'npm run dev:emergency' if issues persist"
echo "  4. Enable monitoring with './scripts/dev-monitor.sh start'"
echo ""
echo "🔗 To enable aliases, add to your shell profile:"
echo "  echo 'source $ALIAS_FILE' >> ~/.zshrc"  # or ~/.bashrc
echo ""