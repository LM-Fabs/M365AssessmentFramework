#!/bin/bash

# Post-Deployment Configuration Script for M365 Assessment Framework
# This script securely configures environment variables in Azure Static Web App
# without exposing secrets in source code or triggering GitHub secret scanning

set -e

echo "🔧 M365 Assessment Framework - Post-Deployment Configuration"
echo "============================================================"

# Check if required environment variables are set
if [ -z "$AZURE_CLIENT_ID" ]; then
    echo "❌ Error: AZURE_CLIENT_ID environment variable is not set"
    echo "Please set this variable with your service principal client ID"
    exit 1
fi

if [ -z "$AZURE_CLIENT_SECRET" ]; then
    echo "❌ Error: AZURE_CLIENT_SECRET environment variable is not set"
    echo "Please set this variable with your service principal client secret"
    exit 1
fi

# Get Azure resource information
echo "📋 Getting Azure resource information..."

# Try to get resource information from azd first
if command -v azd &> /dev/null; then
    echo "Using Azure Developer CLI (azd) to get resource information..."
    
    # Change to the correct directory
    cd "$(dirname "$0")"
    
    STATIC_WEB_APP_NAME=$(azd env get-values | grep STATIC_WEB_APP_NAME | cut -d'=' -f2 | tr -d '"' || echo "")
    RESOURCE_GROUP=$(azd env get-values | grep AZURE_RESOURCE_GROUP | cut -d'=' -f2 | tr -d '"' || echo "")
    
    if [ -z "$STATIC_WEB_APP_NAME" ]; then
        echo "⚠️  Could not get Static Web App name from azd, using default..."
        STATIC_WEB_APP_NAME="m365-assessment-framework"
    fi
    
    if [ -z "$RESOURCE_GROUP" ]; then
        echo "⚠️  Could not get resource group from azd"
        echo "Please provide the resource group name:"
        read -r RESOURCE_GROUP
    fi
else
    echo "Azure Developer CLI (azd) not found, using manual input..."
    STATIC_WEB_APP_NAME="m365-assessment-framework"
    echo "Please provide the Azure resource group name:"
    read -r RESOURCE_GROUP
fi

echo "📊 Configuration Details:"
echo "   Static Web App: $STATIC_WEB_APP_NAME"
echo "   Resource Group: $RESOURCE_GROUP"

# Verify Azure CLI is installed and authenticated
if ! command -v az &> /dev/null; then
    echo "❌ Error: Azure CLI is not installed"
    echo "Please install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if user is logged in to Azure CLI
if ! az account show &> /dev/null; then
    echo "❌ Error: Not authenticated with Azure CLI"
    echo "Please run: az login"
    exit 1
fi

echo "✅ Azure CLI authentication verified"

# Check if the Static Web App exists
echo "🔍 Verifying Static Web App exists..."
if ! az staticwebapp show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo "❌ Error: Static Web App '$STATIC_WEB_APP_NAME' not found in resource group '$RESOURCE_GROUP'"
    echo "Please verify the names and ensure the app is deployed"
    exit 1
fi

echo "✅ Static Web App found"

# Configure environment variables
echo "⚙️  Configuring environment variables..."

# First, let's see what's currently configured
echo "📋 Current app settings:"
az staticwebapp appsettings list \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --output table

# Configure the required environment variables
echo "🔐 Setting AZURE_CLIENT_ID and AZURE_CLIENT_SECRET..."

az staticwebapp appsettings set \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --setting-names \
        AZURE_CLIENT_ID="$AZURE_CLIENT_ID" \
        AZURE_CLIENT_SECRET="$AZURE_CLIENT_SECRET"

if [ $? -eq 0 ]; then
    echo "✅ Environment variables configured successfully!"
else
    echo "❌ Error: Failed to configure environment variables"
    exit 1
fi

# Verify configuration
echo "🔍 Verifying configuration..."
CONFIGURED_SETTINGS=$(az staticwebapp appsettings list \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties" \
    --output json)

# Check if required settings are present (without showing values)
REQUIRED_SETTINGS=("AZURE_CLIENT_ID" "AZURE_CLIENT_SECRET" "AZURE_TENANT_ID" "AZURE_STORAGE_CONNECTION_STRING" "APPLICATIONINSIGHTS_CONNECTION_STRING" "KEY_VAULT_URL")

echo "📊 Configuration Status:"
for setting in "${REQUIRED_SETTINGS[@]}"; do
    if echo "$CONFIGURED_SETTINGS" | grep -q "\"$setting\""; then
        echo "   ✅ $setting: Configured"
    else
        echo "   ❌ $setting: Missing"
    fi
done

# Get the application URL for testing
APP_URL=$(az staticwebapp show \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "defaultHostname" \
    --output tsv)

echo ""
echo "🎉 Configuration completed!"
echo "============================================"
echo "Application URL: https://$APP_URL"
echo "API Test URL: https://$APP_URL/api/test"
echo ""
echo "🧪 Test your deployment:"
echo "   curl https://$APP_URL/api/test"
echo ""
echo "🔍 Monitor your application:"
echo "   Azure Portal: https://portal.azure.com"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Static Web App: $STATIC_WEB_APP_NAME"
echo ""
echo "⚠️  Security Notes:"
echo "   - Secrets are now configured in Azure (not in source code)"
echo "   - Monitor application logs for any authentication issues"
echo "   - Ensure service principal has required permissions"
echo ""
echo "📚 For troubleshooting, see: SECURITY-DEPLOYMENT-GUIDE.md"
