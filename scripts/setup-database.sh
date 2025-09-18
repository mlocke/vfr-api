#!/bin/bash

# =====================================================================================
# VFR API Database Setup Script
# Veritak Financial Research LLC - Database Initialization
# =====================================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="vfr_api"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
APP_ROLE="vfr_app_role"
READ_ROLE="vfr_read_role"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATABASE_DIR="$PROJECT_DIR/database"

echo -e "${BLUE}==================================================================================${NC}"
echo -e "${BLUE}VFR API Database Setup Script${NC}"
echo -e "${BLUE}Veritak Financial Research LLC${NC}"
echo -e "${BLUE}==================================================================================${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if PostgreSQL is running
check_postgres() {
    print_status "Checking PostgreSQL service..."
    if ! pg_isready -h $DB_HOST -p $DB_PORT > /dev/null 2>&1; then
        print_error "PostgreSQL is not running or not accessible"
        print_status "Please start PostgreSQL and try again:"
        echo "  sudo systemctl start postgresql"
        echo "  # or on macOS:"
        echo "  brew services start postgresql"
        exit 1
    fi
    print_status "PostgreSQL is running"
}

# Function to check if database exists
check_database_exists() {
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
        return 0
    else
        return 1
    fi
}

# Function to create database
create_database() {
    print_status "Creating database: $DB_NAME"

    if check_database_exists; then
        print_warning "Database $DB_NAME already exists"
        read -p "Do you want to drop and recreate it? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Dropping existing database..."
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;"
        else
            print_status "Using existing database"
            return 0
        fi
    fi

    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "
        CREATE DATABASE $DB_NAME WITH
            ENCODING 'UTF8'
            LC_COLLATE 'en_US.UTF-8'
            LC_CTYPE 'en_US.UTF-8'
            TEMPLATE template0
            CONNECTION LIMIT -1;
    "
    print_status "Database $DB_NAME created successfully"
}

# Function to run SQL script
run_sql_script() {
    local script_path=$1
    local description=$2

    if [ ! -f "$script_path" ]; then
        print_error "SQL script not found: $script_path"
        exit 1
    fi

    print_status "$description"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$script_path"

    if [ $? -eq 0 ]; then
        print_status "Successfully executed: $script_path"
    else
        print_error "Failed to execute: $script_path"
        exit 1
    fi
}

# Function to test database connection
test_connection() {
    print_status "Testing database connection..."

    # Test basic connection
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null 2>&1; then
        print_status "Database connection successful"
    else
        print_error "Failed to connect to database"
        exit 1
    fi

    # Test application role
    if psql -h $DB_HOST -p $DB_PORT -U $APP_ROLE -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
        print_status "Application role connection successful"
    else
        print_warning "Application role connection failed - check password"
    fi
}

# Function to display database info
show_database_info() {
    print_status "Database Information:"

    echo "  Database: $DB_NAME"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  Application Role: $APP_ROLE"
    echo "  Read-Only Role: $READ_ROLE"
    echo ""

    # Show table count
    local table_count=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    " | tr -d ' ')

    echo "  Tables created: $table_count"

    # Show extensions
    print_status "Installed Extensions:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT name, default_version, installed_version
        FROM pg_available_extensions
        WHERE installed_version IS NOT NULL
        ORDER BY name;
    "
}

# Function to setup environment
setup_environment() {
    print_status "Setting up environment configuration..."

    # Check if .env file exists
    local env_file="$PROJECT_DIR/.env"
    if [ -f "$env_file" ]; then
        # Verify DATABASE_URL is correct
        if grep -q "DATABASE_URL=.*vfr_api" "$env_file"; then
            print_status "Environment configuration is already correct"
        else
            print_warning "DATABASE_URL in .env may need updating"
            echo "  Expected: DATABASE_URL=postgresql://user:password@localhost:5432/vfr_api"
        fi
    else
        print_warning ".env file not found"
        echo "  Please create .env file with DATABASE_URL configuration"
    fi
}

# Function to run post-setup validations
validate_setup() {
    print_status "Validating database setup..."

    # Check critical tables exist
    local tables=("users" "securities_master" "market_data" "fundamental_data")
    for table in "${tables[@]}"; do
        local exists=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = '$table'
            );
        " | tr -d ' ')

        if [ "$exists" = "t" ]; then
            print_status "Table '$table' exists"
        else
            print_error "Table '$table' missing"
        fi
    done

    # Check indexes
    local index_count=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
    " | tr -d ' ')

    print_status "Indexes created: $index_count"

    # Check functions
    local function_count=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public';
    " | tr -d ' ')

    print_status "Functions created: $function_count"
}

# Main execution
main() {
    echo -e "${BLUE}Starting VFR API database setup...${NC}"
    echo

    # Check prerequisites
    check_postgres

    # Create database
    create_database

    # Run setup scripts
    if [ -f "$DATABASE_DIR/setup-database.sql" ]; then
        run_sql_script "$DATABASE_DIR/setup-database.sql" "Running main database setup script..."
    else
        print_error "Main setup script not found: $DATABASE_DIR/setup-database.sql"
        exit 1
    fi

    # Run algorithm schema if it exists
    if [ -f "$DATABASE_DIR/schema/algorithm_schema.sql" ]; then
        print_status "Found algorithm schema, installing..."
        run_sql_script "$DATABASE_DIR/schema/algorithm_schema.sql" "Installing algorithm schema..."
    else
        print_warning "Algorithm schema not found, skipping..."
    fi

    # Test connections
    test_connection

    # Setup environment
    setup_environment

    # Validate setup
    validate_setup

    # Show database info
    show_database_info

    echo
    echo -e "${GREEN}==================================================================================${NC}"
    echo -e "${GREEN}VFR API Database Setup Completed Successfully!${NC}"
    echo -e "${GREEN}==================================================================================${NC}"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Update passwords for application roles:"
    echo "   ALTER ROLE vfr_app_role PASSWORD 'your_secure_password';"
    echo "   ALTER ROLE vfr_read_role PASSWORD 'your_read_password';"
    echo
    echo "2. Update .env file with new credentials:"
    echo "   DATABASE_URL=postgresql://vfr_app_role:password@localhost:5432/vfr_api"
    echo
    echo "3. Apply PostgreSQL optimization configuration:"
    echo "   sudo cp database/postgresql-optimization.conf /etc/postgresql/15/main/conf.d/"
    echo "   sudo systemctl restart postgresql"
    echo
    echo "4. Set up regular backups and monitoring"
    echo
    echo -e "${GREEN}Database is ready for use!${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Consider running as postgres user instead."
fi

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --check        Only check prerequisites"
        echo "  --validate     Only validate existing setup"
        exit 0
        ;;
    --check)
        check_postgres
        exit 0
        ;;
    --validate)
        validate_setup
        exit 0
        ;;
    *)
        main
        ;;
esac