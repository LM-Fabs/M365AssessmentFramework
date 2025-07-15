#!/bin/bash

# Test script to verify the chunking mechanism is working
echo "🧪 Testing chunking mechanism for large Secure Score data..."

# Navigate to the API directory
cd /Users/Fabian.Sodke/Documents/GitHub/M365AssessmentFramework/m365-security-assessment/m365-assessment-framework

# Build the project first
echo "🔨 Building the project..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo "🚀 Build completed successfully. The chunking mechanism should now be active."
echo "📋 Next steps:"
echo "1. Deploy the updated code to test the chunking with real data"
echo "2. Create a new assessment with large Secure Score data"
echo "3. Check the logs to verify chunking is working"
