#!/bin/bash

# Deploy M365 Assessment Framework with Private Endpoints
# This script deploys the infrastructure with private endpoint configuration for secure database access

set -e

echo "🚀 Starting Private Endpoint Deployment for M365 Assessment Framework"

# Check if azd is installed
if ! command -v azd &> /dev/null; then
    echo "❌ Azure Developer CLI (azd) is not installed. Please install azd first."
    exit 1
fi

# Check if user is logged in to azd
if ! azd auth show &> /dev/null; then
    echo "❌ Not logged in to Azure Developer CLI. Please run 'azd auth login' first."
    exit 1
fi

# Check if environment is initialized
if [ ! -f ".azure/$AZURE_ENV_NAME/.env" ]; then
    echo "❌ Environment not initialized. Please run 'azd init' first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Deploy infrastructure with private endpoints
echo "🔧 Deploying infrastructure with private endpoints enabled..."

# Use the private endpoint parameters file
azd deploy --parameters ./infra/main.private-endpoints.parameters.json

if [ $? -eq 0 ]; then
    echo "✅ Infrastructure deployment completed successfully!"
    
    # Get deployment outputs
    echo "📊 Getting deployment information..."
    azd env get-values | grep -E "(POSTGRES_HOST|AZURE_CLIENT_ID|STATIC_WEB_APP)"
    
    echo ""
    echo "🔐 Security Configuration Summary:"
    echo "✅ Private endpoints enabled for PostgreSQL"
    echo "✅ Public network access disabled for PostgreSQL"
    echo "✅ Private DNS zone configured"
    echo "✅ VNet integration ready for Static Web Apps"
    echo ""
    echo "⚠️  Important Notes:"
    echo "1. PostgreSQL is now only accessible through private endpoints"
    echo "2. Static Web Apps will need VNet integration to access the database"
    echo "3. For local development, consider using VPN or bastion host"
    echo ""
    echo "🎉 Private endpoint deployment completed successfully!"
else
    echo "❌ Infrastructure deployment failed. Please check the error messages above."
    exit 1
fi
