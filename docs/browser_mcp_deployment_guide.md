# Browser MCP Deployment Guide for Financial Intelligence

## Overview

This guide provides step-by-step instructions for deploying the Browser/Playwright MCP service for financial intelligence gathering in the VFR platform.

## Prerequisites

### System Requirements
- **Operating System**: macOS, Linux, or Windows
- **Python**: 3.8+ (for integration scripts)
- **Node.js**: 16+ (for MCP server)
- **Memory**: Minimum 4GB RAM (8GB+ recommended)
- **Storage**: 2GB+ free space for browser data

### Dependencies
```bash
# Python dependencies
pip install aiohttp asyncio dataclasses

# Node.js dependencies (for MCP server)
npm install @anthropic-ai/mcp
npm install playwright
npm install @playwright/test
```

## Installation Steps

### 1. MCP Server Setup

#### Install Better Playwright MCP Server
```bash
# Install the better-playwright MCP server
npm install -g @mcp/better-playwright

# Or clone and build from source
git clone https://github.com/anthropic/better-playwright-mcp
cd better-playwright-mcp
npm install
npm run build
```

#### Configure MCP Server
Create MCP configuration file:

```json
{
  "mcpServers": {
    "better-playwright": {
      "command": "npx",
      "args": ["@mcp/better-playwright"],
      "env": {
        "PLAYWRIGHT_BROWSERS_PATH": "/opt/playwright/browsers",
        "PLAYWRIGHT_HEADLESS": "true",
        "PLAYWRIGHT_TIMEOUT": "30000"
      }
    }
  }
}
```

### 2. Browser Configuration

#### Install Playwright Browsers
```bash
# Install all browser engines
npx playwright install

# Or install specific browsers
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
```

#### Configure Browser Settings
```javascript
// playwright.config.js
module.exports = {
  use: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    timeout: 30000,
    actionTimeout: 10000,
    navigationTimeout: 30000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    }
  ]
};
```

### 3. Financial Intelligence Integration

#### VFR Integration
```python
# Add to requirements.txt
aiohttp>=3.8.0
asyncio-mqtt>=0.13.0
pydantic>=1.10.0

# Environment configuration
BROWSER_MCP_ENABLED=true
BROWSER_MCP_MAX_PAGES=10
BROWSER_MCP_TIMEOUT=30000
BROWSER_MCP_RETRY_ATTEMPTS=3
```

#### Configuration File
```yaml
# config/browser_mcp.yaml
browser_mcp:
  enabled: true
  max_concurrent_pages: 10
  retry_attempts: 3
  timeout_ms: 30000
  
  data_sources:
    yahoo_finance:
      base_url: "https://finance.yahoo.com"
      rate_limit: 60  # requests per minute
      
    bloomberg:
      base_url: "https://www.bloomberg.com"
      rate_limit: 30
      
    sec_edgar:
      base_url: "https://www.sec.gov/edgar"
      rate_limit: 10

  monitoring:
    default_interval: 60  # seconds
    error_threshold: 5
    health_check_interval: 300
```

## Service Configuration

### 1. MCP Service Startup

#### System Service (Linux/macOS)
```bash
# Create service file: /etc/systemd/system/browser-mcp.service
[Unit]
Description=Browser MCP Service for Financial Intelligence
After=network.target

[Service]
Type=simple
User=stockpicker
WorkingDirectory=/opt/veritak-financial
ExecStart=/usr/bin/node /opt/veritak-financial/mcp-server/browser-mcp.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### Docker Deployment
```dockerfile
# Dockerfile.browser-mcp
FROM node:18-alpine

# Install Playwright dependencies
RUN apk add --no-cache \
    chromium \
    firefox \
    webkit

# Set up Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright/browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Install browsers
RUN npx playwright install --with-deps

EXPOSE 3000

CMD ["npm", "start"]
```

#### Docker Compose
```yaml
# docker-compose.browser-mcp.yml
version: '3.8'

services:
  browser-mcp:
    build:
      context: .
      dockerfile: Dockerfile.browser-mcp
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PLAYWRIGHT_HEADLESS=true
      - PLAYWRIGHT_TIMEOUT=30000
    volumes:
      - browser_data:/opt/playwright/browsers
      - ./config:/app/config
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  browser_data:
  redis_data:
```

### 2. Security Configuration

#### Network Security
```bash
# Firewall rules (UFW)
sudo ufw allow 3000/tcp  # MCP service port
sudo ufw deny 3000/tcp from any to any port 3000  # Restrict external access

# Use reverse proxy for external access
# nginx configuration in /etc/nginx/sites-available/browser-mcp
server {
    listen 443 ssl;
    server_name browser-mcp.stockpicker.internal;
    
    ssl_certificate /etc/ssl/certs/stockpicker.crt;
    ssl_certificate_key /etc/ssl/private/stockpicker.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Access Control
```javascript
// auth/middleware.js
const authenticateRequest = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || !validateApiKey(apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

## Monitoring and Logging

### 1. Health Monitoring

#### Health Check Endpoint
```javascript
// health.js
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      playwright: checkPlaywrightHealth(),
      browsers: checkBrowserHealth(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  };
  
  res.json(health);
});
```

#### Monitoring Dashboard
```python
# monitoring/dashboard.py
from flask import Flask, render_template
import requests
import json

app = Flask(__name__)

@app.route('/dashboard')
def monitoring_dashboard():
    # Get service health
    health_response = requests.get('http://localhost:3000/health')
    health_data = health_response.json()
    
    # Get active monitoring tasks
    tasks_response = requests.get('http://localhost:3000/api/monitoring/status')
    tasks_data = tasks_response.json()
    
    return render_template('dashboard.html', 
                         health=health_data, 
                         tasks=tasks_data)
```

### 2. Logging Configuration

#### Structured Logging
```javascript
// logging/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'browser-mcp' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

#### Log Analysis
```bash
# Log monitoring with logrotate
# /etc/logrotate.d/browser-mcp
/opt/veritak-financial/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 stockpicker stockpicker
    postrotate
        systemctl reload browser-mcp
    endscript
}
```

## Performance Optimization

### 1. Browser Optimization

#### Memory Management
```javascript
// config/browser-optimization.js
const browserConfig = {
  // Limit concurrent pages
  maxPages: 10,
  
  // Browser arguments for optimization
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--memory-pressure-off'
  ],
  
  // Page pool management
  pagePool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 300000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200
  }
};
```

### 2. Caching Strategy

#### Redis Caching
```javascript
// cache/redis-cache.js
const redis = require('redis');
const client = redis.createClient();

class DataCache {
  async get(key) {
    const cached = await client.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set(key, data, ttl = 300) {
    await client.setex(key, ttl, JSON.stringify(data));
  }
  
  async invalidate(pattern) {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  }
}
```

### 3. Load Balancing

#### Multiple Browser Instances
```yaml
# docker-compose.scaling.yml
version: '3.8'

services:
  browser-mcp-1:
    build: .
    environment:
      - INSTANCE_ID=1
      - PORT=3001
    ports:
      - "3001:3001"
      
  browser-mcp-2:
    build: .
    environment:
      - INSTANCE_ID=2
      - PORT=3002
    ports:
      - "3002:3002"
      
  nginx-lb:
    image: nginx:alpine
    ports:
      - "3000:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - browser-mcp-1
      - browser-mcp-2
```

## Deployment Checklist

### Pre-Deployment
- [ ] MCP server installed and configured
- [ ] Playwright browsers installed
- [ ] Network security configured
- [ ] SSL certificates installed
- [ ] Environment variables set
- [ ] Database connections tested

### Deployment
- [ ] Service deployed to production environment
- [ ] Health checks passing
- [ ] Monitoring systems active
- [ ] Logging configured
- [ ] Backup systems in place
- [ ] Load balancing configured (if applicable)

### Post-Deployment
- [ ] Smoke tests completed
- [ ] Performance metrics baseline established
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Incident response procedures documented

## Troubleshooting

### Common Issues

#### Browser Launch Failures
```bash
# Check browser installation
npx playwright install --with-deps

# Check permissions
chmod +x /opt/playwright/browsers/*/chrome-linux/chrome

# Test browser launch
npx playwright test --headed
```

#### Memory Issues
```bash
# Monitor memory usage
docker stats browser-mcp

# Adjust memory limits
docker run --memory=2g browser-mcp

# Browser memory optimization
export PLAYWRIGHT_BROWSER_ARGS="--memory-pressure-off --max_old_space_size=2048"
```

#### Network Connectivity
```bash
# Test MCP service
curl -f http://localhost:3000/health

# Check browser network access
docker exec browser-mcp curl -I https://finance.yahoo.com

# Verify DNS resolution
nslookup finance.yahoo.com
```

### Performance Issues

#### Slow Page Loads
```javascript
// Optimize page load timeouts
const pageConfig = {
  timeout: 30000,
  waitUntil: 'domcontentloaded', // instead of 'load'
  viewport: { width: 1024, height: 768 } // smaller viewport
};
```

#### High CPU Usage
```bash
# Monitor CPU usage
top -p $(pgrep -f browser-mcp)

# Limit concurrent operations
export MAX_CONCURRENT_PAGES=5

# Use headless mode
export PLAYWRIGHT_HEADLESS=true
```

## Maintenance

### Regular Maintenance Tasks

#### Daily
- Monitor service health and performance
- Check error logs for issues
- Verify data collection is working

#### Weekly
- Update browser versions
- Clean up temporary files
- Review performance metrics

#### Monthly
- Security updates
- Configuration review
- Capacity planning review

### Update Procedures

#### Browser Updates
```bash
# Update Playwright and browsers
npm update playwright
npx playwright install

# Test after updates
npm test
```

#### Service Updates
```bash
# Rolling update with zero downtime
docker-compose up -d --scale browser-mcp=2
docker-compose stop browser-mcp_1
docker-compose up -d --scale browser-mcp=1
```

## Security Best Practices

### Data Protection
- Use HTTPS for all communications
- Encrypt sensitive data at rest
- Implement proper access controls
- Regular security audits

### Compliance
- Respect robots.txt files
- Implement rate limiting
- Follow website terms of service
- Maintain audit logs

### Monitoring
- Real-time security monitoring
- Automated threat detection
- Incident response procedures
- Regular security assessments

## Support and Resources

### Documentation
- [Playwright Documentation](https://playwright.dev/)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [VFR Platform Documentation](./README.md)

### Monitoring Tools
- Grafana dashboards for metrics
- Prometheus for monitoring
- ELK stack for log analysis
- Custom health check endpoints

### Contact Information
- Technical Support: support@stockpicker.com
- Emergency Escalation: +1-555-STOCK-911
- Documentation Updates: docs@stockpicker.com

This deployment guide provides a comprehensive framework for implementing Browser/Playwright MCP capabilities in a production environment for financial intelligence gathering.