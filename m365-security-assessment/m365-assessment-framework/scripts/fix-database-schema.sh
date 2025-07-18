#!/bin/bash

# Database Schema Fix Script for M365 Assessment Framework
# This script fixes the PostgreSQL database schema to match code expectations

echo "🔧 M365 Assessment Framework - Database Schema Fix"
echo "=================================================="

# Check if required environment variables are set
if [ -z "$POSTGRES_HOST" ] || [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_DATABASE" ]; then
    echo "❌ Error: Required environment variables not set"
    echo "Please set:"
    echo "  - POSTGRES_HOST"
    echo "  - POSTGRES_USER" 
    echo "  - POSTGRES_DATABASE"
    echo "  - POSTGRES_PASSWORD (will be prompted)"
    exit 1
fi

echo "🔍 Database connection details:"
echo "  Host: $POSTGRES_HOST"
echo "  User: $POSTGRES_USER"
echo "  Database: $POSTGRES_DATABASE"
echo ""

echo "⚠️  WARNING: This will DROP and RECREATE all tables!"
echo "   This will DELETE ALL EXISTING DATA!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Operation cancelled."
    exit 1
fi

echo ""
echo "🗄️  Applying database schema fix..."

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Apply the schema fix
if psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" -f "scripts/fix-database-schema.sql"; then
    echo ""
    echo "✅ Database schema fixed successfully!"
    echo ""
    echo "📊 Verifying schema..."
    
    # Verify the schema
    psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" -c "
    \d customers;
    \d assessments;
    \d assessment_history;
    "
    
    echo ""
    echo "🎉 Schema fix completed!"
    echo ""
    echo "Next steps:"
    echo "1. Deploy your application"
    echo "2. Test customer creation/update functionality"
    echo "3. Verify app registration updates work correctly"
    
else
    echo "❌ Error: Failed to apply schema fix"
    echo "Please check the database connection and permissions"
    exit 1
fi
