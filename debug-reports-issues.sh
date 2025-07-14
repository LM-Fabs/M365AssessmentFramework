#!/bin/bash

# Debug script for "Completed with limits" status issues
# This script helps diagnose and fix assessment data collection problems

echo "🔍 M365 Assessment Framework - Debug 'Completed with limits' Issues"
echo "=================================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the m365-assessment-framework directory"
    exit 1
fi

echo "📋 Checking current assessment status..."

# Function to check API health
check_api_health() {
    echo "🔧 Checking API health..."
    
    # Check if local development server is running
    if curl -s http://localhost:7071/api/health > /dev/null 2>&1; then
        echo "✅ Local API server is running"
        API_BASE="http://localhost:7071/api"
    elif curl -s https://your-app.azurestaticapps.net/api/health > /dev/null 2>&1; then
        echo "✅ Production API is accessible"
        API_BASE="https://your-app.azurestaticapps.net/api"
    else
        echo "⚠️ API server may not be running or accessible"
        return 1
    fi
    
    return 0
}

# Function to check assessment data
check_assessment_data() {
    echo "📊 Analyzing assessment data structure..."
    
    # Check if we can access assessment data
    node -e "
    const fs = require('fs');
    const path = require('path');
    
    // Try to read any available assessment data files
    const dataDir = path.join(process.cwd(), 'data');
    if (fs.existsSync(dataDir)) {
        console.log('📁 Found data directory');
        const files = fs.readdirSync(dataDir);
        console.log('📄 Available files:', files);
    } else {
        console.log('⚠️ No local data directory found');
    }
    
    // Check environment configuration
    console.log('🔧 Environment check:');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
    console.log('REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL || 'not set');
    "
}

# Function to check for common issues
check_common_issues() {
    echo "🔍 Checking for common issues..."
    
    # Check package.json for dependencies
    echo "📦 Checking dependencies..."
    if ! npm list axios > /dev/null 2>&1; then
        echo "⚠️ axios dependency may be missing"
    fi
    
    # Check for build issues
    echo "🏗️ Testing build..."
    if npm run build > /dev/null 2>&1; then
        echo "✅ Build successful"
    else
        echo "❌ Build failed - this may cause runtime issues"
    fi
    
    # Check browser console logs hint
    echo "💡 To debug further:"
    echo "   1. Open browser developer tools (F12)"
    echo "   2. Go to Console tab"
    echo "   3. Look for error messages when loading reports"
    echo "   4. Check Network tab for failed API requests"
}

# Function to provide fixes
provide_fixes() {
    echo "🔧 Recommended fixes for 'Completed with limits' status:"
    echo ""
    
    echo "1. 📊 DATA SIZE OPTIMIZATION:"
    echo "   - Large tenants may exceed data storage limits"
    echo "   - Consider implementing data pagination"
    echo "   - Reduce the scope of data collection"
    echo ""
    
    echo "2. 🔄 RETRY LOGIC:"
    echo "   - Implement retry mechanisms for failed API calls"
    echo "   - Add exponential backoff for rate-limited requests"
    echo ""
    
    echo "3. 📝 BETTER ERROR HANDLING:"
    echo "   - Improve error messages for partial data"
    echo "   - Show which specific data failed to load"
    echo ""
    
    echo "4. 🎛️ CONFIGURATION OPTIONS:"
    echo "   - Add settings to control data collection scope"
    echo "   - Allow users to select specific modules to assess"
    echo ""
    
    echo "5. 💾 LOCAL DEVELOPMENT:"
    echo "   - Use sample data for testing"
    echo "   - Mock API responses for development"
}

# Main execution
main() {
    echo "Starting diagnosis..."
    echo ""
    
    check_api_health
    echo ""
    
    check_assessment_data
    echo ""
    
    check_common_issues
    echo ""
    
    provide_fixes
    echo ""
    
    echo "🎯 IMMEDIATE ACTIONS:"
    echo "1. Check browser console for specific error messages"
    echo "2. Verify API authentication is working"
    echo "3. Test with a smaller tenant if possible"
    echo "4. Consider implementing the data optimization fixes above"
    echo ""
    echo "📋 For more help, check the assessment logs in the browser console"
}

# Run the main function
main
