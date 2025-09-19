#!/bin/bash

# Development Process Monitor
# Prevents multiple dev server spawning and monitors for anomalies

MONITOR_INTERVAL=5  # Check every 5 seconds
MAX_DEV_PROCESSES=1
LOG_FILE="/tmp/vfr-api-monitor.log"
ALERT_FILE="/tmp/vfr-api-alerts.log"

# Function to log with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to log alerts
log_alert() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $1" | tee -a "$ALERT_FILE" -a "$LOG_FILE"
}

# Function to check for multiple dev processes
check_multiple_processes() {
    local dev_count
    dev_count=$(pgrep -f "next dev" 2>/dev/null | wc -l | tr -d ' ')

    if [ "$dev_count" -gt "$MAX_DEV_PROCESSES" ]; then
        log_alert "Multiple dev servers detected ($dev_count processes)"

        # Get process details
        pgrep -f "next dev" | while read pid; do
            if [ -n "$pid" ]; then
                process_info=$(ps -p "$pid" -o pid,ppid,lstart,command 2>/dev/null | tail -n 1)
                log_alert "Process: $process_info"
            fi
        done

        # Auto-remediation: kill extra processes
        if [ "$dev_count" -gt 2 ]; then
            log_alert "Auto-remediation: Killing extra dev processes"
            pgrep -f "next dev" | tail -n +2 | xargs kill -15 2>/dev/null || true
            sleep 2
            pgrep -f "next dev" | tail -n +2 | xargs kill -9 2>/dev/null || true
        fi

        return 1
    fi

    return 0
}

# Function to check for port conflicts
check_port_conflicts() {
    local port_3000_count port_3002_count

    port_3000_count=$(lsof -ti:3000 2>/dev/null | wc -l | tr -d ' ')
    port_3002_count=$(lsof -ti:3002 2>/dev/null | wc -l | tr -d ' ')

    if [ "$port_3000_count" -gt 1 ]; then
        log_alert "Multiple processes using port 3000 ($port_3000_count processes)"
        lsof -i:3000 | tail -n +2 | while read line; do
            log_alert "Port 3000: $line"
        done
        return 1
    fi

    if [ "$port_3002_count" -gt 1 ]; then
        log_alert "Multiple processes using port 3002 ($port_3002_count processes)"
        lsof -i:3002 | tail -n +2 | while read line; do
            log_alert "Port 3002: $line"
        done
        return 1
    fi

    return 0
}

# Function to check for stale lock files
check_stale_locks() {
    if [ -f "/tmp/vfr-api-dev.lock" ]; then
        lock_pid=$(cat "/tmp/vfr-api-dev.lock" 2>/dev/null || echo "")
        if [ -n "$lock_pid" ] && ! kill -0 "$lock_pid" 2>/dev/null; then
            log_alert "Stale lock file detected (PID: $lock_pid)"
            rm -f "/tmp/vfr-api-dev.lock"
            log_message "Removed stale lock file"
        fi
    fi

    if [ -f "/tmp/vfr-api-dev.pid" ]; then
        dev_pid=$(cat "/tmp/vfr-api-dev.pid" 2>/dev/null || echo "")
        if [ -n "$dev_pid" ] && ! kill -0 "$dev_pid" 2>/dev/null; then
            log_alert "Stale PID file detected (PID: $dev_pid)"
            rm -f "/tmp/vfr-api-dev.pid"
            log_message "Removed stale PID file"
        fi
    fi
}

# Function to monitor resource usage
check_resource_usage() {
    local dev_pids memory_total

    dev_pids=$(pgrep -f "next dev" 2>/dev/null | tr '\n' ' ')
    if [ -n "$dev_pids" ]; then
        memory_total=0
        for pid in $dev_pids; do
            if [ -n "$pid" ]; then
                memory=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{print int($1/1024)}' || echo "0")
                memory_total=$((memory_total + memory))
            fi
        done

        # Alert if memory usage exceeds 1GB
        if [ "$memory_total" -gt 1024 ]; then
            log_alert "High memory usage: ${memory_total}MB across dev processes"
        fi
    fi
}

# Main monitoring function
monitor_development() {
    log_message "Starting development process monitor (PID: $$)"
    log_message "Monitor interval: ${MONITOR_INTERVAL}s, Max dev processes: $MAX_DEV_PROCESSES"

    while true; do
        check_stale_locks

        if ! check_multiple_processes; then
            sleep 10  # Wait longer after detecting issues
        fi

        check_port_conflicts
        check_resource_usage

        sleep "$MONITOR_INTERVAL"
    done
}

# Handle script termination
cleanup() {
    log_message "Development monitor stopped"
    exit 0
}

trap cleanup EXIT INT TERM

# Command line options
case "${1:-monitor}" in
    "monitor")
        monitor_development
        ;;
    "status")
        echo "=== Development Monitor Status ==="
        if pgrep -f "dev-monitor.sh" >/dev/null 2>&1; then
            echo "✅ Monitor is running"
            pgrep -f "dev-monitor.sh" | head -1 | xargs ps -p
        else
            echo "❌ Monitor is not running"
        fi

        if [ -f "$LOG_FILE" ]; then
            echo "📄 Recent log entries:"
            tail -5 "$LOG_FILE"
        fi

        if [ -f "$ALERT_FILE" ]; then
            echo "🚨 Recent alerts:"
            tail -3 "$ALERT_FILE"
        fi
        ;;
    "stop")
        echo "Stopping development monitor..."
        pkill -f "dev-monitor.sh" || echo "No monitor processes found"
        ;;
    "start")
        if pgrep -f "dev-monitor.sh" >/dev/null 2>&1; then
            echo "Monitor is already running"
            exit 1
        fi
        echo "Starting development monitor in background..."
        nohup "$0" monitor >/dev/null 2>&1 &
        echo "Monitor started (PID: $!)"
        ;;
    *)
        echo "Usage: $0 {monitor|status|start|stop}"
        echo "  monitor - Run monitor in foreground"
        echo "  start   - Start monitor in background"
        echo "  stop    - Stop running monitor"
        echo "  status  - Show monitor status"
        exit 1
        ;;
esac