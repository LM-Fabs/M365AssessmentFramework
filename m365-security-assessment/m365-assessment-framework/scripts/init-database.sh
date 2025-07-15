#!/bin/bash

# Database initialization script for M365 Assessment Framework
# This script initializes the PostgreSQL database schema

set -e

echo "🔄 Initializing PostgreSQL database schema..."

# Get environment variables
source .env 2>/dev/null || true

# Check if we have the required environment variables
if [ -z "$POSTGRES_HOST" ] || [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_DATABASE" ] || [ -z "$POSTGRES_ADMIN_PASSWORD" ]; then
    echo "❌ Missing required environment variables. Getting them from azd..."
    
    # Try to get values from azd
    if command -v azd &> /dev/null; then
        eval "$(azd env get-values)"
        
        if [ -z "$POSTGRES_HOST" ]; then
            echo "❌ Could not get PostgreSQL connection details from azd"
            echo "Please ensure you have run 'azd provision' first"
            exit 1
        fi
    else
        echo "❌ azd command not found. Please ensure Azure Developer CLI is installed"
        exit 1
    fi
fi

echo "📊 Database host: $POSTGRES_HOST"
echo "👤 Database user: $POSTGRES_USER"
echo "🗄️ Database name: $POSTGRES_DATABASE"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ psql command not found. Please install PostgreSQL client"
    echo "On macOS: brew install postgresql"
    echo "On Ubuntu/Debian: sudo apt-get install postgresql-client"
    exit 1
fi

# Set the password for psql
export PGPASSWORD="$POSTGRES_ADMIN_PASSWORD"

# Test connection
echo "🔗 Testing database connection..."
if ! psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Could not connect to database. Please check your credentials and firewall rules."
    echo "Make sure your IP address is allowed to connect to the PostgreSQL server."
    exit 1
fi

echo "✅ Database connection successful!"

# Run the initialization script
echo "🚀 Running database initialization script..."
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" -f scripts/init-database.sql

echo "✅ Database schema initialized successfully!"
echo ""
echo "🎉 PostgreSQL database is ready for the M365 Assessment Framework!"
echo ""
echo "Next steps:"
echo "1. Test the database connection with your application"
echo "2. Run 'azd deploy' to deploy the application"
echo "3. Access your application at: https://$staticWebAppHostname"
