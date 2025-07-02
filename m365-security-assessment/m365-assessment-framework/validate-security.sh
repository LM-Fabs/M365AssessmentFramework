#!/bin/bash

# Security Validation Script for M365 Assessment Framework
# This script checks for potential security issues that could trigger GitHub secret scanning

set -e

echo "🔒 M365 Assessment Framework - Security Validation"
echo "=================================================="

PROJECT_ROOT="$(dirname "$0")"
cd "$PROJECT_ROOT"

EXIT_CODE=0

# Function to check if a file contains potential secrets
check_file_for_secrets() {
    local file="$1"
    local issues=0
    
    # Only check for actual secret values, not variable names or placeholders
    # These patterns look for real secret values, not just variable declarations
    declare -a PATTERNS=(
        "client_secret[\"']*[:=][\"']*[a-zA-Z0-9]{32,}"
        "password[\"']*[:=][\"']*[a-zA-Z0-9~!@#$%^&*()_+]{12,}"
        "AccountKey=[a-zA-Z0-9+/]{76,}=="
        "SharedAccessKey=[a-zA-Z0-9+/]{32,}="
        "InstrumentationKey=[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}"
    )
    
    for pattern in "${PATTERNS[@]}"; do
        if grep -qE "$pattern" "$file" 2>/dev/null; then
            echo "   ⚠️  Potential actual secret found in $file"
            issues=$((issues + 1))
        fi
    done
    
    return $issues
}

echo "🔍 Checking source files for potential secret exposure..."

# Check specific file types for secret patterns
declare -a FILE_TYPES=(
    "*.ts"
    "*.tsx" 
    "*.js"
    "*.jsx"
    "*.json"
    "*.yaml" 
    "*.yml"
    "*.md"
    "*.bicep"
)

FILES_WITH_ISSUES=0

for file_type in "${FILE_TYPES[@]}"; do
    while IFS= read -r -d '' file; do
        # Skip node_modules and build directories
        if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"build/"* ]] || [[ "$file" == *".azure/"* ]]; then
            continue
        fi
        
        # Skip the local.settings.json example file (it's meant to show the format)
        if [[ "$file" == *"local.settings.json.example"* ]]; then
            continue
        fi
        
        echo "   Checking: $file"
        if check_file_for_secrets "$file"; then
            echo "   ❌ Issues found in: $file"
            FILES_WITH_ISSUES=$((FILES_WITH_ISSUES + 1))
            EXIT_CODE=1
        fi
    done < <(find . -name "$file_type" -type f -print0)
done

echo ""
echo "📋 Security Checklist:"

# Check if local.settings.json exists and warn about it
if [ -f "api/local.settings.json" ]; then
    echo "   ⚠️  api/local.settings.json exists - ensure it's in .gitignore"
    if grep -q "api/local.settings.json" .gitignore; then
        echo "   ✅ api/local.settings.json is in .gitignore"
    else
        echo "   ❌ api/local.settings.json is NOT in .gitignore"
        EXIT_CODE=1
    fi
else
    echo "   ✅ No local.settings.json file found"
fi

# Check .gitignore for important patterns
echo "   🔍 Checking .gitignore coverage..."
declare -a GITIGNORE_PATTERNS=(
    "local.settings.json"
    ".env"
    ".azure"
    "node_modules"
)

for pattern in "${GITIGNORE_PATTERNS[@]}"; do
    if grep -q "$pattern" .gitignore; then
        echo "   ✅ .gitignore includes: $pattern"
    else
        echo "   ⚠️  .gitignore missing: $pattern"
    fi
done

# Check GitHub workflow files
echo "   🔍 Checking GitHub workflows..."
if [ -d ".github/workflows" ]; then
    WORKFLOW_ISSUES=0
    for workflow in .github/workflows/*.yml .github/workflows/*.yaml; do
        if [ -f "$workflow" ]; then
            echo "   Checking workflow: $workflow"
            # Check if secrets are referenced properly
            if grep -q '\${{ secrets\.' "$workflow"; then
                echo "   ✅ Uses GitHub secrets syntax in: $workflow"
            fi
            
            # Check for hardcoded secrets (this would be bad)
            if check_file_for_secrets "$workflow"; then
                echo "   ❌ Potential hardcoded secrets in: $workflow"
                WORKFLOW_ISSUES=$((WORKFLOW_ISSUES + 1))
                EXIT_CODE=1
            fi
        fi
    done
    
    if [ $WORKFLOW_ISSUES -eq 0 ]; then
        echo "   ✅ GitHub workflows look secure"
    fi
else
    echo "   ℹ️  No GitHub workflows found"
fi

# Check Bicep templates
echo "   🔍 Checking Infrastructure as Code files..."
if [ -d "infra" ]; then
    BICEP_ISSUES=0
    for bicep_file in infra/*.bicep; do
        if [ -f "$bicep_file" ]; then
            echo "   Checking Bicep file: $bicep_file"
            
            # Check for secure parameter handling
            if grep -q "@secure()" "$bicep_file"; then
                echo "   ✅ Uses @secure() decorator in: $bicep_file"
            fi
            
            # Check for hardcoded secrets
            if check_file_for_secrets "$bicep_file"; then
                echo "   ❌ Potential hardcoded secrets in: $bicep_file"
                BICEP_ISSUES=$((BICEP_ISSUES + 1))
                EXIT_CODE=1
            fi
        fi
    done
    
    if [ $BICEP_ISSUES -eq 0 ]; then
        echo "   ✅ Bicep templates look secure"
    fi
else
    echo "   ℹ️  No infra directory found"
fi

echo ""
echo "📊 Validation Summary:"
echo "======================="

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Security validation PASSED"
    echo "   - No obvious secret exposure detected"
    echo "   - Configuration follows security best practices"
    echo "   - Safe for GitHub commit and deployment"
else
    echo "❌ Security validation FAILED"
    echo "   - $FILES_WITH_ISSUES files contain potential security issues"
    echo "   - Review and fix issues before committing"
    echo "   - See SECURITY-DEPLOYMENT-GUIDE.md for guidance"
fi

echo ""
echo "🔒 Security Recommendations:"
echo "- Store secrets only in GitHub repository secrets"
echo "- Use environment variables in Azure Static Web App settings"
echo "- Never commit local.settings.json with real values"
echo "- Use the configure-deployment.sh script for post-deployment setup"
echo "- Regularly audit access and rotate credentials"

echo ""
echo "📚 Documentation:"
echo "- Security Guide: SECURITY-DEPLOYMENT-GUIDE.md"
echo "- Configuration Script: ./configure-deployment.sh"
echo "- Local Settings Example: api/local.settings.json.example"

exit $EXIT_CODE
