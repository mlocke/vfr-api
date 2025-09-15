# Port Management - Development Workflow

## Overview
This document outlines the proper workflow to prevent port conflicts during development.

## Standard Configuration
- **Development Port**: `3000` (enforced via .env.local)
- **Application URL**: `http://localhost:3000`

## Available Commands

### Recommended Workflow
```bash
# 1. Clean start (recommended for new sessions)
npm run dev:clean

# 2. Standard start (when no conflicts exist)
npm run dev

# 3. Check port availability
npm run dev:port-check

# 4. Emergency cleanup
npm run dev:kill
```

### Command Details

#### `npm run dev:clean`
- **Purpose**: Clean development server start with automatic port cleanup
- **Use when**: Starting a new development session or after errors
- **What it does**:
  1. Checks if port 3000 is in use
  2. Kills any processes using port 3000
  3. Cleans up stray npm/next processes
  4. Clears Next.js cache
  5. Starts fresh server on port 3000

#### `npm run dev`
- **Purpose**: Standard development server start
- **Use when**: Port 3000 is already available
- **What it does**: Starts development server on port 3000 (enforced via .env.local)

#### `npm run dev:port-check`
- **Purpose**: Verify port 3000 availability
- **Use when**: Troubleshooting or before starting development
- **What it does**: Shows what's using port 3000 or confirms it's available

#### `npm run dev:kill`
- **Purpose**: Emergency process cleanup
- **Use when**: Development server won't start or is stuck
- **What it does**: Kills all npm dev and next dev processes

## Troubleshooting

### Problem: "EADDRINUSE: address already in use :::3000"
**Solution**:
```bash
npm run dev:clean
```

### Problem: Multiple development servers running
**Solution**:
```bash
npm run dev:kill
sleep 2
npm run dev:clean
```

### Problem: WebStorm/IDE auto-starting servers
**Solution**:
1. Check IDE run configurations
2. Disable auto-restart features
3. Use `npm run dev:clean` as default start command

## Prevention Best Practices

### 1. Always Use Standard Commands
❌ **Don't do**: `next dev -p 3001`, `npm run dev -- -p 3002`
✅ **Do**: `npm run dev` or `npm run dev:clean`

### 2. Start Development Sessions Clean
❌ **Don't do**: Assume port 3000 is available
✅ **Do**: Start with `npm run dev:clean` for new sessions

### 3. Stop Servers Properly
❌ **Don't do**: Force quit terminal without stopping server
✅ **Do**: Use Ctrl+C to stop server gracefully

### 4. Check Status Before Starting
```bash
# Check what's running
npm run dev:port-check

# If unclear, clean start
npm run dev:clean
```

## IDE Integration

### VS Code
- Terminal inherits PORT=3000 from .env.local
- Run configuration enforces port 3000

### WebStorm
- Set run configuration to use `npm run dev:clean`
- Disable auto-restart on file changes if causing conflicts

## Environment Variables

The following environment variables enforce port 3000:

```bash
# .env.local
PORT=3000
NEXT_PUBLIC_PORT=3000
NEXT_DEV_PORT_STRICT=true
```

## Monitoring

### Check Development Server Status
```bash
# See what's running on port 3000
lsof -i:3000

# See all development processes
ps aux | grep "next dev"

# Check multiple ports at once
lsof -i:3000,3001,3002
```

### Memory and Performance
```bash
# Monitor development server resources
npm run dev:clean
# Server will show memory usage in logs
```

## When Things Go Wrong

### Nuclear Option (Clean Everything)
```bash
# Kill all Node.js processes (use carefully)
pkill -f node

# Clear all caches
rm -rf .next node_modules/.cache

# Reinstall and restart
npm install
npm run dev:clean
```

### Port Debugging
```bash
# See detailed port usage
netstat -tulpn | grep :3000

# See process tree
ps auxf | grep -E "(npm|next|node)"
```

## Summary

**Golden Rule**: Always use `npm run dev:clean` when in doubt. It's better to take 10 extra seconds for a clean start than to debug port conflicts for 10 minutes.