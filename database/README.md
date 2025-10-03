# VFR API Database Setup Guide

## Overview

This guide provides comprehensive instructions for setting up PostgreSQL for the VFR API (Veritak Financial Research) platform. The database is optimized for high-frequency financial data processing, real-time analytics, and regulatory compliance.

## Prerequisites

- PostgreSQL 14+ (recommended: PostgreSQL 15 or 16)
- Minimum 8GB RAM (16GB+ recommended for production)
- SSD storage for optimal performance
- TimescaleDB extension (optional, for enhanced time-series performance)

## Quick Start

### 1. Create Database and User

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create the database
CREATE DATABASE vfr_api WITH
    ENCODING 'UTF8'
    LC_COLLATE 'en_US.UTF-8'
    LC_CTYPE 'en_US.UTF-8'
    TEMPLATE template0
    CONNECTION LIMIT -1;

# Exit and reconnect to the new database
\q
sudo -u postgres psql -d vfr_api
```

### 2. Run Setup Script

```bash
# Execute the main setup script
\i database/setup-database.sql
```

### 3. Load Algorithm Schema (Optional)

```bash
# If using the existing algorithm schema
\i database/schema/algorithm_schema.sql
```

### 4. Apply PostgreSQL Optimization

```bash
# Copy the optimization configuration
sudo cp database/postgresql-optimization.conf /etc/postgresql/15/main/conf.d/

# Restart PostgreSQL
sudo systemctl restart postgresql
```

## Detailed Setup Instructions

### Environment Configuration

The `.env` file has been updated with the correct database configuration:

```env
DATABASE_URL=postgresql://postgres:dev_password_123@localhost:5432/vfr_api
```

### Security Configuration

1. **Change Default Passwords**

    ```sql
    -- Change application role password
    ALTER ROLE vfr_app_role PASSWORD 'your_secure_password_here';

    -- Change read-only role password
    ALTER ROLE vfr_read_role PASSWORD 'your_read_password_here';

    -- Change default admin user password
    UPDATE users SET password_hash = crypt('your_admin_password', gen_salt('bf', 12))
    WHERE email = 'admin@veritak.com';
    ```

2. **Update Environment Variables**
    ```env
    # Update .env with new passwords
    DATABASE_URL=postgresql://vfr_app_role:your_secure_password_here@localhost:5432/vfr_api
    ```

### Database Schema Overview

The database includes optimized tables for:

#### Core Financial Data

- **securities_master**: Securities reference data with exchange, sector, market cap
- **market_data**: High-frequency OHLCV data with multiple timeframes
- **fundamental_data**: Income statement, balance sheet, cash flow data
- **economic_indicators**: FRED, BLS, and other economic data sources

#### User Management

- **users**: User accounts with role-based access control
- **user_sessions**: JWT token management and session tracking

#### Algorithm Integration

- **algorithm_configurations**: Stock selection algorithm settings
- **stock_scores**: Multi-factor scoring results
- **selection_results**: Algorithm execution results and performance tracking

#### Performance & Monitoring

- **app_cache**: Application-level caching for Redis fallback
- **api_usage**: Rate limiting and usage analytics
- **audit_log**: Comprehensive audit trail for compliance

### Performance Optimization

#### Indexing Strategy

- **B-tree indexes**: Primary keys, foreign keys, common WHERE clauses
- **GIN indexes**: JSON/JSONB columns for flexible queries
- **Composite indexes**: Multi-column queries (symbol + timestamp)
- **Partial indexes**: Filtered indexes for active records only

#### Memory Configuration

```sql
-- Current settings for 8GB RAM system
shared_buffers = '2GB'
work_mem = '128MB'
maintenance_work_mem = '512MB'
effective_cache_size = '6GB'
```

#### Query Optimization Features

- **Materialized views**: Pre-calculated common queries
- **Continuous aggregates**: Real-time time-series aggregations (with TimescaleDB)
- **Partition pruning**: Date-based partitioning for large tables
- **JIT compilation**: Accelerated complex analytical queries

### High-Frequency Data Considerations

#### Time-Series Optimization

```sql
-- If using TimescaleDB
SELECT create_hypertable('market_data', 'timestamp', chunk_time_interval => INTERVAL '1 day');
SELECT add_retention_policy('market_data', INTERVAL '2 years');
```

#### Data Quality Management

- **Source tracking**: Every record includes data_source field
- **Quality scoring**: Data quality metrics (0.0-1.0 scale)
- **Conflict resolution**: Multi-source data fusion capabilities
- **Freshness tracking**: Created/updated timestamps for all records

### Connection Management

#### Connection Pooling (Recommended)

```bash
# Install PgBouncer for production
sudo apt-get install pgbouncer

# Example pgbouncer.ini configuration
[databases]
vfr_api = host=localhost port=5432 dbname=vfr_api

[pgbouncer]
listen_port = 6432
listen_addr = localhost
auth_type = md5
auth_file = userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
max_db_connections = 100
```

#### Application Connection String

```env
# Direct connection
DATABASE_URL=postgresql://vfr_app_role:password@localhost:5432/vfr_api

# With PgBouncer
DATABASE_URL=postgresql://vfr_app_role:password@localhost:6432/vfr_api
```

### Backup and Recovery

#### Automated Backup Script

```bash
#!/bin/bash
# backup-vfr-api.sh

BACKUP_DIR="/var/backups/vfr_api"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="vfr_api"

# Create backup directory
mkdir -p $BACKUP_DIR

# Full database backup
pg_dump -h localhost -U vfr_app_role -d $DB_NAME -f $BACKUP_DIR/vfr_api_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/vfr_api_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: vfr_api_$DATE.sql.gz"
```

#### Point-in-Time Recovery Setup

```bash
# Enable WAL archiving in postgresql.conf
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/archive/%f'
wal_level = replica
```

### Monitoring and Maintenance

#### Essential Monitoring Queries

```sql
-- Active connections
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';

-- Database size
SELECT pg_size_pretty(pg_database_size('vfr_api')) as database_size;

-- Top 10 largest tables
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- Slow queries (requires pg_stat_statements)
SELECT
    query,
    mean_time,
    calls,
    total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

#### Automated Maintenance

```sql
-- Set up automated maintenance
SELECT cron.schedule('vfr-maintenance', '0 2 * * *', 'SELECT maintenance_cleanup();');
```

### Development vs Production

#### Development Environment

- Relaxed security settings
- Verbose logging enabled
- Local connections only
- Smaller memory allocation

#### Production Checklist

- [ ] Enable SSL/TLS encryption
- [ ] Configure firewall rules
- [ ] Set up connection pooling
- [ ] Enable WAL archiving
- [ ] Configure monitoring and alerting
- [ ] Set up replication for HA
- [ ] Review and harden security settings
- [ ] Implement backup automation
- [ ] Configure log rotation
- [ ] Set up performance monitoring

### Troubleshooting

#### Common Issues

1. **Connection Refused**

    ```bash
    # Check PostgreSQL status
    sudo systemctl status postgresql

    # Check port binding
    sudo netstat -tlnp | grep 5432
    ```

2. **Out of Memory Errors**

    ```sql
    -- Check current memory usage
    SELECT name, setting FROM pg_settings WHERE name LIKE '%mem%';

    -- Adjust work_mem for specific session
    SET work_mem = '256MB';
    ```

3. **Slow Query Performance**

    ```sql
    -- Analyze query performance
    EXPLAIN (ANALYZE, BUFFERS) SELECT ...;

    -- Update table statistics
    ANALYZE table_name;
    ```

#### Performance Tuning

1. **Index Analysis**

    ```sql
    -- Find unused indexes
    SELECT schemaname, tablename, indexname, idx_scan
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0;

    -- Find missing indexes
    SELECT * FROM pg_stat_user_tables WHERE seq_scan > 1000;
    ```

2. **Memory Optimization**
    ```sql
    -- Check buffer hit ratio (should be >95%)
    SELECT
        round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) as hit_ratio
    FROM pg_stat_database;
    ```

### Integration with VFR API

The database integrates seamlessly with the VFR API application:

- **Authentication**: JWT-based user management
- **Caching**: Redis primary, PostgreSQL fallback
- **Data Sources**: 12+ financial data providers
- **Real-time Processing**: Optimized for high-frequency updates
- **Compliance**: Audit logging and data retention policies

### Next Steps

1. **Run the setup script** to create all tables and configurations
2. **Apply the optimization configuration** for your system
3. **Test the connection** from your application
4. **Set up monitoring** and backup procedures
5. **Load initial data** from your financial data sources
6. **Configure security** settings for your environment

For additional support or questions, refer to the VFR API documentation or contact the development team.
