# VFR Financial Analysis Platform - Deployment & Configuration

## Overview

This document provides comprehensive deployment and configuration guidance for the VFR Financial Analysis Platform, covering development, staging, and production environments with Docker containerization, infrastructure requirements, and operational procedures.

## Infrastructure Architecture

### System Requirements

#### Minimum Production Requirements

```yaml
Hardware:
    CPU: 4 cores (Intel Xeon or AMD EPYC recommended)
    Memory: 8GB RAM (16GB recommended)
    Storage: 100GB SSD (NVMe preferred)
    Network: 1Gbps bandwidth

Software:
    OS: Ubuntu 20.04+ LTS / CentOS 8+ / RHEL 8+
    Node.js: 18.x LTS
    Docker: 20.10+
    Docker Compose: 2.0+
```

#### Recommended Production Infrastructure

```yaml
Application Server:
    CPU: 8 cores
    Memory: 16GB RAM
    Storage: 500GB NVMe SSD
    Network: 10Gbps

Database Servers:
    PostgreSQL:
        CPU: 4 cores
        Memory: 8GB RAM
        Storage: 200GB SSD
    Redis:
        CPU: 2 cores
        Memory: 4GB RAM
        Storage: 50GB SSD
    InfluxDB (Optional):
        CPU: 4 cores
        Memory: 8GB RAM
        Storage: 1TB SSD
```

### Network Architecture

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    │   (Nginx/HAProxy) │
                    └─────────┬───────┘
                              │
                    ┌─────────┴───────┐
                    │  Application    │
                    │  Servers        │
                    │  (Next.js)      │
                    └─────────┬───────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌───────┴────┐    ┌───────┴────┐    ┌───────┴────┐
    │ PostgreSQL │    │   Redis    │    │  InfluxDB  │
    │ (Primary)  │    │  (Cache)   │    │(Time Series)│
    └────────────┘    └────────────┘    └────────────┘
```

---

## Environment Configuration

### Environment Variables

#### Core Configuration

```bash
# Application Environment
NODE_ENV=production                          # development|staging|production
PORT=3000                                   # Application port
HOST=0.0.0.0                               # Host binding

# Security Configuration
JWT_SECRET=your_super_secure_jwt_secret_here # 64+ characters recommended
BCRYPT_ROUNDS=12                            # Password hashing rounds
SESSION_SECRET=your_session_secret_here      # Session encryption key

# Feature Flags
ENABLE_ADMIN_AUTO_ACCESS=false              # Auto-admin access (dev only)
ENABLE_PERFORMANCE_MONITORING=true          # Performance tracking
ENABLE_DEBUG_LOGGING=false                  # Debug log level
ENABLE_RATE_LIMITING=true                   # API rate limiting
```

#### Financial Data API Keys

```bash
# Primary Commercial APIs
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
POLYGON_API_KEY=your_polygon_io_key
FMP_API_KEY=your_financial_modeling_prep_key
EODHD_API_KEY=your_eodhd_key
TWELVE_DATA_API_KEY=your_twelve_data_key

# Government Data Sources (Free)
FRED_API_KEY=your_federal_reserve_key       # Federal Reserve Economic Data
BLS_API_KEY=your_bureau_labor_stats_key     # Bureau of Labor Statistics
EIA_API_KEY=your_energy_info_admin_key      # Energy Information Administration

# News & Social Intelligence
NEWS_API_KEY=your_news_api_key
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=VFR-API/1.0
```

#### Database Configuration

```bash
# PostgreSQL (Primary Database)
DATABASE_URL=postgresql://username:password@host:5432/database_name
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vfr_financial_platform
DB_USERNAME=vfr_user
DB_PASSWORD=secure_database_password
DB_SSL=require                              # require|prefer|disable

# Redis (Cache & Sessions)
REDIS_URL=redis://username:password@host:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secure_redis_password
REDIS_DB=0
REDIS_TLS=false                             # Enable for production

# InfluxDB (Time Series - Optional)
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your_influxdb_token
INFLUXDB_ORG=veritak_financial
INFLUXDB_BUCKET=market_data
```

#### Performance & Monitoring

```bash
# Memory Management
NODE_OPTIONS=--max-old-space-size=4096      # 4GB heap size
MAX_CONCURRENT_REQUESTS=10                  # Concurrent API requests
REQUEST_TIMEOUT=30000                       # 30s request timeout
CACHE_TTL_DEFAULT=600                       # 10 minutes default cache TTL

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000               # 1 hour window
RATE_LIMIT_MAX_REQUESTS=1000               # 1000 requests per hour
RATE_LIMIT_SKIP_FAILED_REQUESTS=true       # Skip failed requests in count

# Monitoring & Logging
LOG_LEVEL=info                             # error|warn|info|debug
LOG_FORMAT=json                            # json|text
METRICS_ENABLED=true                       # Enable metrics collection
HEALTH_CHECK_INTERVAL=30000                # 30s health check interval
```

### Environment-Specific Configurations

#### Development Environment (`.env.development`)

```bash
NODE_ENV=development
ENABLE_ADMIN_AUTO_ACCESS=true
ENABLE_DEBUG_LOGGING=true
CACHE_TTL_DEFAULT=120                      # 2 minutes for rapid development
LOG_LEVEL=debug
RATE_LIMIT_MAX_REQUESTS=10000              # Relaxed rate limits
```

#### Staging Environment (`.env.staging`)

```bash
NODE_ENV=staging
ENABLE_ADMIN_AUTO_ACCESS=false
ENABLE_DEBUG_LOGGING=false
CACHE_TTL_DEFAULT=300                      # 5 minutes
LOG_LEVEL=info
RATE_LIMIT_MAX_REQUESTS=5000               # Moderate rate limits
```

#### Production Environment (`.env.production`)

```bash
NODE_ENV=production
ENABLE_ADMIN_AUTO_ACCESS=false
ENABLE_DEBUG_LOGGING=false
CACHE_TTL_DEFAULT=600                      # 10 minutes
LOG_LEVEL=warn
RATE_LIMIT_MAX_REQUESTS=1000               # Strict rate limits
DB_SSL=require
REDIS_TLS=true
```

---

## Docker Deployment

### Development Docker Compose

#### Infrastructure Services (`docker-compose.dev.yml`)

```yaml
version: "3.8"

services:
    postgres:
        image: postgres:15
        container_name: vfr_postgres_dev
        environment:
            POSTGRES_DB: vfr_financial_platform
            POSTGRES_USER: vfr_user
            POSTGRES_PASSWORD: dev_password_123
        ports:
            - "5432:5432"
        volumes:
            - postgres_data:/var/lib/postgresql/data
            - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
        restart: unless-stopped
        healthcheck:
            test: ["CMD-SHELL", "pg_isready -U vfr_user -d vfr_financial_platform"]
            interval: 10s
            timeout: 5s
            retries: 5

    redis:
        image: redis:7-alpine
        container_name: vfr_redis_dev
        ports:
            - "6379:6379"
        volumes:
            - redis_data:/data
            - ./config/redis.conf:/usr/local/etc/redis/redis.conf
        command: redis-server /usr/local/etc/redis/redis.conf
        restart: unless-stopped
        healthcheck:
            test: ["CMD", "redis-cli", "ping"]
            interval: 10s
            timeout: 3s
            retries: 5

    influxdb:
        image: influxdb:2
        container_name: vfr_influxdb_dev
        environment:
            INFLUXDB_DB: vfr_market_data
            INFLUXDB_ADMIN_USER: admin
            INFLUXDB_ADMIN_PASSWORD: dev_password_123
            INFLUXDB_USER: vfr_user
            INFLUXDB_USER_PASSWORD: dev_password_123
        ports:
            - "8086:8086"
        volumes:
            - influxdb_data:/var/lib/influxdb2
            - influxdb_config:/etc/influxdb2
        restart: unless-stopped
        healthcheck:
            test: ["CMD", "influx", "ping"]
            interval: 30s
            timeout: 10s
            retries: 5

volumes:
    postgres_data:
        driver: local
    redis_data:
        driver: local
    influxdb_data:
        driver: local
    influxdb_config:
        driver: local

networks:
    default:
        name: vfr_network
```

#### Application Dockerfile

```dockerfile
# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY .. .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Production Docker Compose

#### Full Production Stack (`docker-compose.prod.yml`)

```yaml
version: "3.8"

services:
    app:
        build:
            context: .
            dockerfile: Dockerfile
            target: runner
        container_name: vfr_app_prod
        environment:
            NODE_ENV: production
            DATABASE_URL: postgresql://vfr_user:${DB_PASSWORD}@postgres:5432/vfr_financial_platform
            REDIS_URL: redis://redis:6379/0
            INFLUXDB_URL: http://influxdb:8086
        env_file:
            - .env.production
        depends_on:
            postgres:
                condition: service_healthy
            redis:
                condition: service_healthy
        restart: unless-stopped
        healthcheck:
            test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
            interval: 30s
            timeout: 10s
            retries: 3
        networks:
            - app_network

    nginx:
        image: nginx:alpine
        container_name: vfr_nginx_prod
        ports:
            - "80:80"
            - "443:443"
        volumes:
            - ./config/nginx.conf:/etc/nginx/nginx.conf
            - ./config/ssl:/etc/nginx/ssl
        depends_on:
            - app
        restart: unless-stopped
        networks:
            - app_network

    postgres:
        image: postgres:15
        container_name: vfr_postgres_prod
        environment:
            POSTGRES_DB: vfr_financial_platform
            POSTGRES_USER: vfr_user
            POSTGRES_PASSWORD: ${DB_PASSWORD}
        volumes:
            - postgres_data:/var/lib/postgresql/data
            - ./backups:/backups
        restart: unless-stopped
        healthcheck:
            test: ["CMD-SHELL", "pg_isready -U vfr_user -d vfr_financial_platform"]
            interval: 10s
            timeout: 5s
            retries: 5
        networks:
            - app_network

    redis:
        image: redis:7-alpine
        container_name: vfr_redis_prod
        command: redis-server --requirepass ${REDIS_PASSWORD}
        volumes:
            - redis_data:/data
        restart: unless-stopped
        healthcheck:
            test: ["CMD", "redis-cli", "auth", "${REDIS_PASSWORD}", "ping"]
            interval: 10s
            timeout: 3s
            retries: 5
        networks:
            - app_network

    influxdb:
        image: influxdb:2
        container_name: vfr_influxdb_prod
        environment:
            INFLUXDB_DB: vfr_market_data
            INFLUXDB_ADMIN_USER: admin
            INFLUXDB_ADMIN_PASSWORD: ${INFLUXDB_PASSWORD}
        volumes:
            - influxdb_data:/var/lib/influxdb2
            - influxdb_config:/etc/influxdb2
        restart: unless-stopped
        healthcheck:
            test: ["CMD", "influx", "ping"]
            interval: 30s
            timeout: 10s
            retries: 5
        networks:
            - app_network

volumes:
    postgres_data:
        driver: local
    redis_data:
        driver: local
    influxdb_data:
        driver: local
    influxdb_config:
        driver: local

networks:
    app_network:
        driver: bridge
```

---

## Database Setup & Migration

### PostgreSQL Configuration

#### Database Initialization Script (`scripts/init-db.sql`)

```sql
-- Create application database
CREATE DATABASE vfr_financial_platform;

-- Create application user
CREATE USER vfr_user WITH ENCRYPTED PASSWORD 'secure_password_here';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE vfr_financial_platform TO vfr_user;

-- Connect to application database
\c vfr_financial_platform;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application schema
CREATE SCHEMA IF NOT EXISTS app_data;
CREATE SCHEMA IF NOT EXISTS cache_data;
CREATE SCHEMA IF NOT EXISTS audit_logs;

-- Grant schema permissions
GRANT ALL ON SCHEMA app_data TO vfr_user;
GRANT ALL ON SCHEMA cache_data TO vfr_user;
GRANT ALL ON SCHEMA audit_logs TO vfr_user;

-- Create tables
CREATE TABLE app_data.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE app_data.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES app_data.users(id),
    api_key VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    rate_limit INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

CREATE TABLE cache_data.stock_analysis_cache (
    symbol VARCHAR(10) NOT NULL,
    analysis_type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    PRIMARY KEY (symbol, analysis_type)
);

CREATE TABLE audit_logs.api_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    user_id UUID REFERENCES app_data.users(id),
    ip_address INET,
    response_time INTEGER,
    status_code INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_stock_analysis_cache_expires ON cache_data.stock_analysis_cache(expires_at);
CREATE INDEX idx_api_requests_created_at ON audit_logs.api_requests(created_at);
CREATE INDEX idx_api_requests_user_id ON audit_logs.api_requests(user_id);
```

#### Database Migration Service

```typescript
// app/services/database/DatabaseMigrationService.ts
export class DatabaseMigrationService {
	async runMigrations(): Promise<void> {
		const migrations = [
			"001_initial_schema.sql",
			"002_add_user_management.sql",
			"003_add_caching_tables.sql",
			"004_add_audit_logging.sql",
		];

		for (const migration of migrations) {
			await this.runMigration(migration);
		}
	}

	private async runMigration(filename: string): Promise<void> {
		const sql = await fs.readFile(`./migrations/${filename}`, "utf8");
		await this.database.query(sql);
		console.log(`✅ Migration ${filename} completed`);
	}
}
```

### Redis Configuration

#### Redis Configuration File (`config/redis.conf`)

```bash
# Network
bind 0.0.0.0
port 6379
protected-mode yes

# Memory Management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Security
requirepass your_redis_password_here

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Performance
tcp-keepalive 300
timeout 0
```

---

## Load Balancing & Reverse Proxy

### Nginx Configuration

#### Main Configuration (`config/nginx.conf`)

```nginx
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # MIME Types
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=1r/s;

    # Upstream Configuration
    upstream vfr_app {
        least_conn;
        server app1:3000 weight=1 max_fails=3 fail_timeout=30s;
        server app2:3000 weight=1 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # Main Server Block
    server {
        listen 80;
        listen 443 ssl http2;
        server_name your-domain.com www.your-domain.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;

        # Security Headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

        # API Routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://vfr_app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # Timeouts
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Static Assets
        location /_next/static/ {
            proxy_pass http://vfr_app;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Main Application
        location / {
            limit_req zone=general burst=10 nodelay;

            proxy_pass http://vfr_app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Health Check
        location /health {
            access_log off;
            return 200 "healthy\\n";
            add_header Content-Type text/plain;
        }
    }
}
```

---

## Deployment Procedures

### Development Deployment

#### Local Development Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd vfr-api

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 4. Start infrastructure services
docker-compose -f docker-compose.dev.yml up -d

# 5. Run database migrations
npm run migrate

# 6. Start development server
npm run dev:clean
```

### Staging Deployment

#### Automated Staging Pipeline

```bash
#!/bin/bash
# scripts/deploy-staging.sh

set -e

echo "🚀 Starting staging deployment..."

# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm ci --only=production

# 3. Run tests
npm run test:production

# 4. Build application
npm run build

# 5. Update staging environment
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.staging.yml up -d --build

# 6. Run health checks
sleep 30
curl -f http://staging.your-domain.com/api/health || exit 1

echo "✅ Staging deployment completed successfully"
```

### Production Deployment

#### Blue-Green Deployment Strategy

```bash
#!/bin/bash
# scripts/deploy-production.sh

set -e

# Configuration
BLUE_COMPOSE_FILE="docker-compose.blue.yml"
GREEN_COMPOSE_FILE="docker-compose.green.yml"
HEALTH_CHECK_URL="http://localhost:3000/api/health"

echo "🚀 Starting blue-green production deployment..."

# 1. Determine current environment
if docker-compose -f $BLUE_COMPOSE_FILE ps | grep -q "Up"; then
    CURRENT="blue"
    TARGET="green"
    TARGET_COMPOSE_FILE=$GREEN_COMPOSE_FILE
else
    CURRENT="green"
    TARGET="blue"
    TARGET_COMPOSE_FILE=$BLUE_COMPOSE_FILE
fi

echo "📍 Current environment: $CURRENT"
echo "🎯 Target environment: $TARGET"

# 2. Deploy to target environment
docker-compose -f $TARGET_COMPOSE_FILE down
docker-compose -f $TARGET_COMPOSE_FILE up -d --build

# 3. Health check
echo "🏥 Performing health checks..."
for i in {1..10}; do
    if curl -f $HEALTH_CHECK_URL; then
        echo "✅ Health check passed"
        break
    fi

    if [ $i -eq 10 ]; then
        echo "❌ Health check failed after 10 attempts"
        docker-compose -f $TARGET_COMPOSE_FILE down
        exit 1
    fi

    echo "⏳ Attempt $i/10: Waiting for service to be ready..."
    sleep 30
done

# 4. Update load balancer
echo "🔄 Updating load balancer configuration..."
# Update nginx upstream configuration to point to target environment

# 5. Graceful shutdown of previous environment
echo "🛑 Gracefully shutting down $CURRENT environment..."
sleep 60  # Allow active requests to complete
docker-compose -f $CURRENT_COMPOSE_FILE down

echo "✅ Production deployment completed successfully"
echo "🌟 Application is now running on $TARGET environment"
```

---

## Monitoring & Observability

### Health Monitoring

#### Application Health Checks

```typescript
// app/api/health/route.ts
export async function GET() {
	const health = {
		status: "healthy",
		timestamp: new Date().toISOString(),
		version: process.env.npm_package_version,
		environment: process.env.NODE_ENV,
		uptime: process.uptime(),
		memory: {
			used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
			total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
		},
		services: {
			database: await checkDatabase(),
			redis: await checkRedis(),
			externalAPIs: await checkExternalAPIs(),
		},
	};

	const statusCode = health.services.database && health.services.redis ? 200 : 503;
	return new Response(JSON.stringify(health), { status: statusCode });
}
```

#### Infrastructure Monitoring

```yaml
# docker-compose.monitoring.yml
version: "3.8"

services:
    prometheus:
        image: prom/prometheus:latest
        container_name: vfr_prometheus
        ports:
            - "9090:9090"
        volumes:
            - ./config/prometheus.yml:/etc/prometheus/prometheus.yml
            - prometheus_data:/prometheus

    grafana:
        image: grafana/grafana:latest
        container_name: vfr_grafana
        ports:
            - "3001:3000"
        environment:
            GF_SECURITY_ADMIN_PASSWORD: admin
        volumes:
            - grafana_data:/var/lib/grafana
            - ./config/grafana:/etc/grafana/provisioning

    node-exporter:
        image: prom/node-exporter:latest
        container_name: vfr_node_exporter
        ports:
            - "9100:9100"

volumes:
    prometheus_data:
    grafana_data:
```

### Logging Configuration

#### Structured Logging

```typescript
// app/services/error-handling/Logger.ts
export class Logger {
	private static instance: Logger;

	log(level: "info" | "warn" | "error", message: string, meta?: any) {
		const logEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			meta,
			service: "vfr-api",
			version: process.env.npm_package_version,
			environment: process.env.NODE_ENV,
		};

		if (process.env.LOG_FORMAT === "json") {
			console.log(JSON.stringify(logEntry));
		} else {
			console.log(`[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}`);
		}
	}
}
```

---

## Security Configuration

### SSL/TLS Configuration

#### Certificate Management

```bash
# Generate self-signed certificates for development
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout config/ssl/key.pem \
  -out config/ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Production: Use Let's Encrypt
certbot --nginx -d your-domain.com -d www.your-domain.com
```

### Environment Security

#### Production Security Checklist

```bash
# 1. Update all default passwords
# 2. Enable database SSL connections
# 3. Configure Redis AUTH
# 4. Set up firewall rules
# 5. Enable log monitoring
# 6. Configure intrusion detection
# 7. Set up automated backups
# 8. Enable security headers
# 9. Configure rate limiting
# 10. Set up SSL/TLS certificates
```

---

## Backup & Recovery

### Database Backup Strategy

#### Automated Backup Script

```bash
#!/bin/bash
# scripts/backup-database.sh

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="vfr_financial_platform"

# Create backup
pg_dump -h postgres -U vfr_user -d $DB_NAME > $BACKUP_DIR/db_backup_$TIMESTAMP.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$TIMESTAMP.sql

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "✅ Database backup completed: db_backup_$TIMESTAMP.sql.gz"
```

#### Recovery Procedure

```bash
#!/bin/bash
# scripts/restore-database.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# Restore database
gunzip -c $BACKUP_FILE | psql -h postgres -U vfr_user -d vfr_financial_platform

echo "✅ Database restored from $BACKUP_FILE"
```

This deployment and configuration documentation provides comprehensive guidance for deploying and maintaining the VFR Financial Analysis Platform across all environments with enterprise-grade reliability and security standards.
