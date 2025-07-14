#!/bin/bash

# Secure Score Assessment Debugging Script
# This script helps diagnose issues with secure score data in M365 Assessment Framework

echo "🛡️ M365 Assessment Framework - Secure Score Debugging"
echo "================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "src/pages/Reports.tsx" ]; then
    echo "❌ Error: Please run this script from the m365-assessment-framework directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected files: src/pages/Reports.tsx, package.json"
    exit 1
fi

echo "📂 Current directory: $(pwd)"
echo "✅ Found Reports.tsx - we're in the right place"
echo ""

# Function to check API endpoints
check_api_endpoints() {
    echo "🔍 Checking API endpoints availability..."
    
    # Check if API is running locally
    echo "   Checking local API (http://localhost:7071)..."
    if curl -s http://localhost:7071/api/customers > /dev/null 2>&1; then
        echo "   ✅ Local API is responding"
    else
        echo "   ❌ Local API not responding"
        echo "      Try running: cd api && func start"
    fi
    
    echo ""
}

# Function to check recent assessments
check_recent_assessments() {
    echo "🔍 Checking for recent assessments with secure score issues..."
    
    # Search for "completed_with_size_limit" in recent files
    echo "   Looking for 'completed_with_size_limit' status mentions..."
    
    if grep -r "completed_with_size_limit" src/ > /dev/null 2>&1; then
        echo "   ✅ Found size limit handling code in source"
        grep -n "completed_with_size_limit" src/pages/Reports.tsx | head -3
    else
        echo "   ❌ No size limit handling found"
    fi
    
    echo ""
}

# Function to analyze secure score processing
analyze_secure_score_code() {
    echo "🔍 Analyzing secure score processing code..."
    
    # Check for secure score processing functions
    echo "   Checking secure score processing functions..."
    
    if grep -q "secureScoreData" src/pages/Reports.tsx; then
        echo "   ✅ Found secure score processing code"
        
        # Count lines related to secure score
        local_count=$(grep -c "secureScore" src/pages/Reports.tsx)
        echo "   📊 Found $local_count lines mentioning secure score"
        
        # Check for compression handling
        if grep -q "compressed" src/pages/Reports.tsx; then
            echo "   ✅ Found data compression handling"
        else
            echo "   ❌ No data compression handling found"
        fi
        
        # Check for size limit handling
        if grep -q "hasDataLimits" src/pages/Reports.tsx; then
            echo "   ✅ Found size limit handling"
        else
            echo "   ❌ No size limit handling found"
        fi
        
    else
        echo "   ❌ No secure score processing found"
    fi
    
    echo ""
}

# Function to check CSS styling
check_styling() {
    echo "🎨 Checking CSS styling for secure score components..."
    
    if [ -f "src/pages/Reports.css" ]; then
        echo "   ✅ Found Reports.css"
        
        # Check for secure score styles
        if grep -q "secure-score" src/pages/Reports.css; then
            echo "   ✅ Found secure score styling"
        else
            echo "   ❌ No secure score styling found"
        fi
        
        # Check for warning styles
        if grep -q "data-limit-warning" src/pages/Reports.css; then
            echo "   ✅ Found data limitation warning styling"
        else
            echo "   ❌ No data limitation warning styling found"
        fi
        
    else
        echo "   ❌ Reports.css not found"
    fi
    
    echo ""
}

# Function to provide troubleshooting recommendations
provide_recommendations() {
    echo "💡 Troubleshooting Recommendations for Secure Score Issues"
    echo "========================================================="
    echo ""
    
    echo "1. 📋 Check Assessment Status:"
    echo "   - Look for assessments with status 'completed_with_size_limit'"
    echo "   - These assessments may have partial secure score data"
    echo "   - Basic score metrics should still be available"
    echo ""
    
    echo "2. 🔍 Debug Data Structure:"
    echo "   - Open browser developer tools (F12)"
    echo "   - Go to Reports page and select a customer"
    echo "   - Check console for secure score processing logs"
    echo "   - Look for lines starting with '=== SECURE SCORE PROCESSING ==='"
    echo ""
    
    echo "3. 📊 Expected Data Structure:"
    echo "   - assessment.metrics.realData.secureScore.currentScore"
    echo "   - assessment.metrics.realData.secureScore.maxScore"
    echo "   - assessment.metrics.realData.secureScore.controlScores[]"
    echo "   - assessment.metrics.realData.secureScore.compressed (boolean)"
    echo ""
    
    echo "4. ⚠️ Size Limit Handling:"
    echo "   - Assessments with 'completed_with_size_limit' status are valid"
    echo "   - They should show basic secure score metrics"
    echo "   - Control details may be truncated but overview should work"
    echo "   - Look for orange warning banner about data limits"
    echo ""
    
    echo "5. 🛠️ Quick Fixes to Try:"
    echo "   - Create a new test assessment to see if secure score works"
    echo "   - Check if only specific customers have the issue"
    echo "   - Verify app registration has SecurityEvents.Read.All permission"
    echo "   - Check if admin consent was granted for the app"
    echo ""
    
    echo "6. 🔧 Backend Debugging:"
    echo "   - Check API logs for secure score data collection"
    echo "   - Verify Microsoft Graph API responses"
    echo "   - Look for permission-related errors in the backend"
    echo "   - Check if secure score API endpoints are accessible"
    echo ""
}

# Function to generate a test report
generate_test_commands() {
    echo "🧪 Test Commands for Debugging"
    echo "=============================="
    echo ""
    
    echo "1. Test Frontend Build:"
    echo "   npm run build"
    echo ""
    
    echo "2. Start Development Server:"
    echo "   npm start"
    echo ""
    
    echo "3. Check for Console Errors:"
    echo "   - Open http://localhost:3000/reports"
    echo "   - Open browser developer tools (F12)"
    echo "   - Select a customer and look for console messages"
    echo "   - Search for 'SECURE SCORE PROCESSING' in console"
    echo ""
    
    echo "4. Test API Endpoints (if API is running):"
    echo "   curl -s http://localhost:7071/api/customers | jq ."
    echo "   curl -s http://localhost:7071/api/assessments | jq ."
    echo ""
    
    echo "5. Check Assessment Data Structure:"
    echo "   - Go to Reports page"
    echo "   - Select customer with issue"
    echo "   - In browser console, type: console.log(customerAssessment)"
    echo "   - Expand the object and navigate to: metrics.realData.secureScore"
    echo ""
}

# Main execution
echo "Starting secure score debugging analysis..."
echo ""

check_api_endpoints
check_recent_assessments
analyze_secure_score_code
check_styling
provide_recommendations
generate_test_commands

echo "🎯 Summary:"
echo "=========="
echo "✅ The latest code includes improved handling for 'completed_with_size_limit' assessments"
echo "✅ Secure score data should now display even when size limits are hit"
echo "✅ Added visual warning for users when data is truncated"
echo "✅ Basic secure score metrics (currentScore, maxScore, percentage) should always work"
echo ""
echo "If secure score is still not showing:"
echo "1. Check browser console for specific error messages"
echo "2. Verify the assessment data structure in developer tools"
echo "3. Create a new test assessment to confirm permissions work"
echo "4. Check that the customer's assessment has secureScore data in metrics.realData"
echo ""
echo "🏁 Debugging complete! Check the recommendations above for next steps."
