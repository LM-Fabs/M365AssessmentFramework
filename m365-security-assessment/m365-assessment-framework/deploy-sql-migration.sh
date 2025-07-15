#!/bin/bash

# Azure SQL Database Migration Deployment Script
# This script automates the deployment of SQL Database infrastructure and migration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
RESOURCE_GROUP=""
ENVIRONMENT_NAME=""
LOCATION=""
USE_SQL_DATABASE=true
SKIP_MIGRATION=false

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

# Function to show usage
show_usage() {
    echo "Usage: $0 -g <resource-group> -e <environment-name> -l <location> [options]"
    echo ""
    echo "Required parameters:"
    echo "  -g, --resource-group    Azure resource group name"
    echo "  -e, --environment       Environment name (dev, staging, prod)"
    echo "  -l, --location          Azure region (e.g., eastus, westus2)"
    echo ""
    echo "Optional parameters:"
    echo "  -s, --skip-migration    Skip data migration step"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -g my-rg -e dev -l eastus"
    echo "  $0 -g my-rg -e prod -l westus2 --skip-migration"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -g|--resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT_NAME="$2"
            shift 2
            ;;
        -l|--location)
            LOCATION="$2"
            shift 2
            ;;
        -s|--skip-migration)
            SKIP_MIGRATION=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$RESOURCE_GROUP" || -z "$ENVIRONMENT_NAME" || -z "$LOCATION" ]]; then
    print_error "Missing required parameters"
    show_usage
    exit 1
fi

print_status "Starting Azure SQL Database migration deployment"
print_status "Resource Group: $RESOURCE_GROUP"
print_status "Environment: $ENVIRONMENT_NAME"
print_status "Location: $LOCATION"

# Check if Azure CLI is installed and logged in
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    print_error "Please log in to Azure CLI first: az login"
    exit 1
fi

# Check if resource group exists
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    print_error "Resource group '$RESOURCE_GROUP' does not exist"
    exit 1
fi

# Change to infrastructure directory
if [[ ! -d "infra" ]]; then
    print_error "Infrastructure directory 'infra' not found. Please run from the project root."
    exit 1
fi

cd infra

# Step 1: Deploy infrastructure
print_status "Step 1: Deploying Azure SQL Database infrastructure..."

DEPLOYMENT_NAME="sql-migration-$(date +%Y%m%d-%H%M%S)"

az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file main-with-sql.bicep \
    --parameters useSqlDatabase=$USE_SQL_DATABASE \
    --parameters location="$LOCATION" \
    --parameters environmentName="$ENVIRONMENT_NAME" \
    --name "$DEPLOYMENT_NAME" \
    --output table

if [[ $? -eq 0 ]]; then
    print_status "Infrastructure deployment completed successfully"
else
    print_error "Infrastructure deployment failed"
    exit 1
fi

# Get deployment outputs
print_status "Retrieving deployment outputs..."

SQL_SERVER_NAME=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query 'properties.outputs.SQL_SERVER_NAME.value' -o tsv)

SQL_DATABASE_NAME=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query 'properties.outputs.SQL_DATABASE_NAME.value' -o tsv)

SQL_SERVER_FQDN=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query 'properties.outputs.SQL_SERVER_FQDN.value' -o tsv)

print_status "SQL Server: $SQL_SERVER_NAME"
print_status "Database: $SQL_DATABASE_NAME"
print_status "Server FQDN: $SQL_SERVER_FQDN"

# Step 2: Initialize database schema
print_status "Step 2: Initializing database schema..."

# Check if sqlcmd is available
if ! command -v sqlcmd &> /dev/null; then
    print_warning "sqlcmd not found. Please install SQL Server command-line tools."
    print_warning "You can install them from: https://docs.microsoft.com/en-us/sql/tools/sqlcmd-utility"
    print_warning "For macOS: brew install mssql-tools"
    print_warning "For Ubuntu: sudo apt-get install mssql-tools"
    print_warning "Then run: sqlcmd -S $SQL_SERVER_FQDN -d $SQL_DATABASE_NAME -i sql-schema.sql -G"
else
    # Apply database schema
    sqlcmd -S "$SQL_SERVER_FQDN" -d "$SQL_DATABASE_NAME" -i sql-schema.sql -G
    
    if [[ $? -eq 0 ]]; then
        print_status "Database schema initialized successfully"
    else
        print_error "Database schema initialization failed"
        exit 1
    fi
fi

# Step 3: Install dependencies
print_status "Step 3: Installing application dependencies..."

cd ..

# Check if package.json exists
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found. Please run from the project root."
    exit 1
fi

# Install SQL Server dependencies
npm install mssql @azure/identity

if [[ $? -eq 0 ]]; then
    print_status "Dependencies installed successfully"
else
    print_error "Dependency installation failed"
    exit 1
fi

# Step 4: Data migration (optional)
if [[ "$SKIP_MIGRATION" == false ]]; then
    print_status "Step 4: Running data migration..."
    
    # Check if migration service exists
    if [[ -f "api/src/migrationService.js" ]]; then
        node api/src/migrationService.js
        
        if [[ $? -eq 0 ]]; then
            print_status "Data migration completed successfully"
        else
            print_error "Data migration failed"
            exit 1
        fi
    else
        print_warning "Migration service not found. Please run migration manually."
    fi
else
    print_warning "Skipping data migration as requested"
fi

# Step 5: Final verification
print_status "Step 5: Verifying deployment..."

# Check if SQL Database is accessible
if command -v sqlcmd &> /dev/null; then
    TABLE_COUNT=$(sqlcmd -S "$SQL_SERVER_FQDN" -d "$SQL_DATABASE_NAME" -Q "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'" -h -1 -G 2>/dev/null | tr -d ' ')
    
    if [[ "$TABLE_COUNT" -gt 0 ]]; then
        print_status "Database verification successful - $TABLE_COUNT tables found"
    else
        print_warning "Database verification failed - no tables found"
    fi
fi

# Summary
print_status "Migration deployment completed!"
echo ""
echo "Next steps:"
echo "1. Update your application configuration to use DATABASE_TYPE=SQL"
echo "2. Test the application with the new SQL Database"
echo "3. Monitor performance and costs"
echo "4. Consider removing old Table Storage resources if migration is successful"
echo ""
echo "Connection details:"
echo "  SQL Server: $SQL_SERVER_FQDN"
echo "  Database: $SQL_DATABASE_NAME"
echo "  Authentication: Managed Identity"
echo ""
echo "For troubleshooting, check the migration guide: MIGRATION-TO-SQL-DATABASE.md"

print_status "Deployment script completed successfully!"
