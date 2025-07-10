# Secure Score Backend Debugging Summary

## Issue Identified

The console logs show that the frontend is working correctly - it only displays real secure score data when available. However, the backend API is returning:

```json
{
  "unavailable": true, 
  "reason": "Secure score not available or insufficient permissions"
}
```

This indicates the problem is in the backend Microsoft Graph API call, specifically in the `getSecureScore` method.

## Root Cause Analysis

### 1. API Call Location
- **File**: `/api/shared/graphApiService.ts`
- **Method**: `getSecureScore(tenantId, clientId, clientSecret)`
- **Graph Endpoints**: 
  - `/security/secureScores` 
  - `/security/secureScoreControlProfiles`

### 2. Required Permission
- **Permission**: `SecurityEvents.Read.All`
- **Type**: Application permission (not delegated)
- **Admin Consent**: Required by customer tenant Global Administrator

### 3. Potential Issues

#### A. Permission Not Granted
The app registration may not have `SecurityEvents.Read.All` permission:
- Check Azure Portal → App registrations → API permissions
- Verify `SecurityEvents.Read.All` is listed under Microsoft Graph

#### B. Admin Consent Not Provided
Even if permission is granted, admin consent is required:
- Customer tenant Global Administrator must grant consent
- Check Azure Portal → Enterprise applications → Permissions tab
- Status should show "Granted for [Organization]"

#### C. Authentication Failure
App registration credentials may be incorrect:
- Verify `clientId` and `clientSecret` are valid
- Check if secret has expired (max 2 years)
- Ensure tenant ID is correct

## Solution Steps

### Step 1: Create Secure Score Debug Function

Add a specific endpoint to test secure score API connectivity and permissions.

### Step 2: Verify App Registration Permissions

Ensure the app registration has all required permissions:

```text
Required Microsoft Graph Application Permissions:
✅ Organization.Read.All        (for license data)
❌ SecurityEvents.Read.All      (for secure score) ← LIKELY MISSING
✅ Reports.Read.All            (for usage reports)
✅ Directory.Read.All          (for user/group data)
✅ Policy.Read.All             (for conditional access)
✅ IdentityRiskyUser.Read.All  (for identity protection)
✅ AuditLog.Read.All           (for audit logs)
```

### Step 3: Verify Admin Consent

The customer tenant administrator must grant consent:

1. Use the consent URL provided during customer registration
2. Global Administrator must approve all permissions
3. Check Enterprise applications in customer tenant for confirmation

### Step 4: Test Manual API Call

Test the Graph API call manually to isolate the issue:

```bash
# Get access token
curl -X POST "https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id={CLIENT_ID}&scope=https://graph.microsoft.com/.default&client_secret={CLIENT_SECRET}&grant_type=client_credentials"

# Test secure score API
curl -X GET "https://graph.microsoft.com/v1.0/security/secureScores?$top=1&$orderby=createdDateTime desc" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

### Step 5: Update Frontend Message

Until backend is fixed, update frontend to show a more helpful message when secure score is unavailable.

## Next Actions

1. **Immediate**: Add debug logging to identify specific Graph API error
2. **Short-term**: Check and fix app registration permissions
3. **Medium-term**: Automate permission verification in the debug function
4. **Long-term**: Add permission health monitoring

## Expected Outcome

Once permissions and admin consent are properly configured:
- Secure score data will be returned from the Graph API
- Frontend will display the secure score table with real data
- "Unavailable" message will disappear

## Files to Investigate

1. **Backend API**: `/api/shared/graphApiService.ts` (lines 362-416)
2. **Error Handling**: `/api/index.ts` (lines 1305, 2607)
3. **App Registration**: Check Azure Portal for customer's app registration
4. **Admin Consent**: Check customer tenant's Enterprise applications
