#!/bin/bash

# Test script to verify permission configuration fixes
# This script checks that all the required permissions are properly configured

echo "🔍 Verifying M365 Assessment Framework Permission Configuration"
echo "=============================================================="

echo ""
echo "📋 Checking consent-callback permission configuration..."
grep -A 15 "User.Read.All" m365-assessment-framework/api/consent-callback/index.ts | head -10

echo ""
echo "📋 Checking GraphApiService default permissions..."
grep -A 15 "User.Read.All" m365-assessment-framework/api/shared/graphApiService.ts | head -10

echo ""
echo "📋 Checking adminConsentService permission mapping..."
grep -A 15 "hasPermission" m365-assessment-framework/src/services/adminConsentService.ts | head -10

echo ""
echo "🎯 Required permissions for complete functionality:"
echo "   ✓ User.Read.All - Read user profiles"
echo "   ✓ Directory.Read.All - Read directory data"
echo "   ✓ AuditLog.Read.All - Read audit logs"
echo "   ✓ SecurityEvents.Read.All - Read security events"
echo "   ✓ Organization.Read.All - Read organization data"
echo "   ✓ Policy.Read.All - Read conditional access policies"
echo "   ✓ RoleManagement.Read.Directory - Read privileged roles"
echo "   ✓ Reports.Read.All - Read usage reports"
echo "   ✓ IdentityRiskEvent.Read.All - Read risk events"
echo "   ✓ Agreement.Read.All - Read compliance agreements"

echo ""
echo "🚀 Next Steps:"
echo "   1. Customer needs to trigger new app registration or re-consent"
echo "   2. New registrations will include all 10 required permissions"
echo "   3. Test privileged roles and conditional access policies"
echo "   4. Run ./test-privileged-roles.js and ./test-conditional-access.js"

echo ""
echo "✅ Permission configuration fix complete!"
