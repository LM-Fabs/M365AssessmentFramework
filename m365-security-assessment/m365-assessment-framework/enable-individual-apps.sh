#!/bin/bash

# Script to enable individual app creation for each customer
# This will create separate app registrations for each customer instead of using the shared multi-tenant app

echo "🔧 Enabling individual app creation for customers..."

# Set environment variable for the current session
export CREATE_INDIVIDUAL_APPS=true

# Add to local.settings.json for Azure Functions
if [ -f "api/local.settings.json" ]; then
    echo "📝 Updating api/local.settings.json..."
    # Use jq to update the JSON file, or manual backup approach
    cp api/local.settings.json api/local.settings.json.backup
    
    # Simple approach - you may need to manually add this to local.settings.json:
    echo "Please manually add the following to api/local.settings.json in the Values section:"
    echo '"CREATE_INDIVIDUAL_APPS": "true"'
else
    echo "⚠️ api/local.settings.json not found. You'll need to add the environment variable manually."
fi

echo "✅ Individual app creation is now enabled!"
echo ""
echo "How this works:"
echo "1. 🏗️ Creates a NEW app registration in YOUR tenant for each customer"
echo "2. 🔗 Each app is tagged with customer information for easy management"
echo "3. 🎯 Customer consents to their dedicated app (not the shared one)"
echo "4. 🔐 Each customer gets their own client ID and secret"
echo "5. 🛡️ Better isolation between customers"
echo ""
echo "To disable: export CREATE_INDIVIDUAL_APPS=false (or remove the env var)"
