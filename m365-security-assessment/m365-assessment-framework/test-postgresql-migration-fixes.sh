#!/bin/bash

echo "🔧 Testing PostgreSQL migration app registration fixes..."

# Set environment
export NODE_ENV=production

# Build the project
echo "📦 Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"

# Test the fix endpoint
echo "🧪 Testing fix app registrations endpoint..."

# You can test this endpoint by making a POST request to:
# https://your-function-app.azurewebsites.net/api/fix-app-registrations

echo "📝 You can now test the following endpoints:"
echo "1. POST /api/fix-app-registrations - Fix all corrupted app registrations"
echo "2. GET /api/diagnostics - Check database connectivity and basic info"
echo "3. GET /api/customers - List all customers (should now show fixed app registrations)"

echo ""
echo "🔍 To manually run the migration script:"
echo "node api/migrate-app-registrations.js"

echo ""
echo "✅ Setup completed! The following fixes have been applied:"
echo "   ✅ Enhanced app registration validation in hasRealAppReg function"
echo "   ✅ Added validateAppRegistration function to PostgreSQL service"
echo "   ✅ Updated all customer retrieval methods to use data validation"
echo "   ✅ Created fix-app-registrations endpoint for bulk fixes"
echo "   ✅ Created standalone migration script for manual execution"
echo "   ✅ Added comprehensive logging for debugging"

echo ""
echo "🚀 Next steps:"
echo "1. Deploy the updated functions to Azure"
echo "2. Test the /api/fix-app-registrations endpoint"
echo "3. Check the logs for any remaining data issues"
echo "4. Verify app registrations are now being detected correctly"
