#!/bin/bash

# Test script for PostgreSQL connection
# This script tests the database connection and basic functionality

set -e

echo "🧪 Testing PostgreSQL database connection..."

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

# Set the password for psql
export PGPASSWORD="$POSTGRES_ADMIN_PASSWORD"

echo "📊 Testing connection to: $POSTGRES_HOST"
echo "👤 User: $POSTGRES_USER"
echo "🗄️ Database: $POSTGRES_DATABASE"

# Test basic connection
echo "🔗 Testing basic connection..."
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" -c "SELECT 'Connection successful!' as status;"

# Test table existence
echo "📋 Checking table structure..."
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" -c "
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN ('customers', 'assessments', 'assessment_history')
ORDER BY table_name, ordinal_position;"

# Test insert and select
echo "🧪 Testing CRUD operations..."
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" -c "
-- Insert a test customer
INSERT INTO customers (name, display_name, domain, tenant_id) 
VALUES ('test-customer', 'Test Customer', 'test.com', gen_random_uuid())
ON CONFLICT (domain) DO UPDATE SET 
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    updated_at = CURRENT_TIMESTAMP;

-- Select the customer
SELECT 
    name, 
    display_name, 
    domain, 
    created_at 
FROM customers 
WHERE domain = 'test.com';

-- Clean up test data
DELETE FROM customers WHERE domain = 'test.com';

SELECT 'CRUD operations successful!' as status;
"

echo "✅ All database tests passed!"
echo "🎉 PostgreSQL database is working correctly!"
