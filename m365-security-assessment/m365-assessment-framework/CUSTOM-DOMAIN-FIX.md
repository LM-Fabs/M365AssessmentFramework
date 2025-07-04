# Azure AD App Registration - Custom Domain Fix

## Issue Identified

The multi-tenant app registration was failing when only a domain (not a tenant ID) was provided, specifically for custom domains like `modernworkplace.tips`. The error occurred because:

1. ✅ **Customer creation** worked correctly - it properly used the domain as a tenant identifier
2. ❌ **App registration creation** failed - the consent URL generation was broken for custom domains

## Root Cause

The `generateConsentUrl` method in `GraphApiService` was creating invalid consent URLs for custom domains:

**❌ Invalid URL (before fix):**
```
https://login.microsoftonline.com/modernworkplace.tips/adminconsent?client_id=...
```

**Problem**: Custom domains like `modernworkplace.tips` are not valid tenant identifiers for the Microsoft login endpoints. The consent endpoint expects:
- Tenant ID (GUID format): `12345678-1234-1234-1234-123456789012`
- OnMicrosoft domain: `contoso.onmicrosoft.com`
- Common endpoint: `common` (for multi-tenant apps)

## Solution Implemented

### 1. **Fixed Consent URL Generation**
Updated `GraphApiService.generateConsentUrl()` to detect custom domains and use the `common` endpoint:

```typescript
// Determine the correct tenant identifier for the consent URL
let consentTenantId = tenantId;

// If the tenantId looks like a custom domain (contains dots but not onmicrosoft.com), 
// use 'common' endpoint which allows consent from any tenant
if (tenantId.includes('.') && !tenantId.includes('.onmicrosoft.com') && 
    !tenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    console.log('⚠️ GraphApiService: Using common consent endpoint for custom domain:', tenantId);
    consentTenantId = 'common';
}
```

**✅ Valid URL (after fix):**
```
https://login.microsoftonline.com/common/adminconsent?client_id=...
```

### 2. **Fixed Auth URL Generation**
Applied the same logic to the authorization URL generation in `createMultiTenantAppHandler`:

```typescript
// Determine the correct tenant identifier for auth URLs
let authTenantId = finalTenantId;
if (finalTenantId.includes('.') && !finalTenantId.includes('.onmicrosoft.com') && 
    !finalTenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    context.log('⚠️ Using common auth endpoint for custom domain:', finalTenantId);
    authTenantId = 'common';
}
```

### 3. **Enhanced Logging**
Added detailed logging to help with debugging:
- Log the target tenant identifier being used
- Log when switching to common endpoint for custom domains
- Log tenant domain information

## How the Fix Works

### Domain Type Detection
The code now detects three types of tenant identifiers:

1. **Tenant ID (GUID)**: `12345678-1234-1234-1234-123456789012`
   - Used as-is in URLs
   
2. **OnMicrosoft Domain**: `contoso.onmicrosoft.com`
   - Used as-is in URLs
   
3. **Custom Domain**: `modernworkplace.tips`
   - Replaced with `common` in URLs

### Multi-Tenant App Consent
Using the `common` endpoint is the correct approach for multi-tenant applications because:
- ✅ Allows consent from any Azure AD tenant
- ✅ Works with custom domains
- ✅ Standard Microsoft recommendation for multi-tenant apps
- ✅ The admin can still consent from their specific tenant

## Testing Scenarios

### Scenario 1: Custom Domain (Fixed)
**Input:**
```json
{
    "targetTenantDomain": "modernworkplace.tips",
    "tenantName": "Modern Workplace Tips"
}
```

**Expected Result:** ✅ **SUCCESS**
- App registration created successfully
- Consent URL: `https://login.microsoftonline.com/common/adminconsent?client_id=...`
- Auth URL: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`

### Scenario 2: OnMicrosoft Domain
**Input:**
```json
{
    "targetTenantDomain": "contoso.onmicrosoft.com",
    "tenantName": "Contoso"
}
```

**Expected Result:** ✅ **SUCCESS**
- App registration created successfully
- Consent URL: `https://login.microsoftonline.com/contoso.onmicrosoft.com/adminconsent?client_id=...`
- Auth URL: `https://login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0/authorize`

### Scenario 3: Tenant ID Provided
**Input:**
```json
{
    "targetTenantId": "12345678-1234-1234-1234-123456789012",
    "tenantName": "Test Company"
}
```

**Expected Result:** ✅ **SUCCESS**
- App registration created successfully
- Consent URL: `https://login.microsoftonline.com/12345678-1234-1234-1234-123456789012/adminconsent?client_id=...`
- Auth URL: `https://login.microsoftonline.com/12345678-1234-1234-1234-123456789012/oauth2/v2.0/authorize`

## Files Modified

### 1. `/api/shared/graphApiService.ts`
- Updated `generateConsentUrl()` method to handle custom domains
- Added domain type detection logic
- Enhanced logging for debugging

### 2. `/api/index.ts`
- Updated `createMultiTenantAppHandler` to apply same logic for auth URLs
- Added detailed logging for tenant identifier resolution
- Ensured consistent handling between consent and auth URLs

## Benefits of This Fix

1. **✅ Works with Custom Domains**: No longer requires tenant IDs for companies with custom domains
2. **✅ Maintains Backwards Compatibility**: Still works with tenant IDs and onmicrosoft.com domains
3. **✅ Follows Microsoft Best Practices**: Uses `common` endpoint for multi-tenant apps
4. **✅ Better Error Handling**: Clear logging helps with troubleshooting
5. **✅ Consistent Behavior**: Customer creation and app registration now both work with domains

## Admin Consent Process

After the fix, the admin consent process works as follows:

1. **App Registration Created**: Multi-tenant app is created in our tenant
2. **Consent URL Generated**: URL uses appropriate endpoint (`common` for custom domains)
3. **Admin Clicks Consent**: URL redirects to Microsoft login
4. **Admin Signs In**: Admin signs into their own tenant (any tenant)
5. **Admin Grants Consent**: Permissions are granted for their tenant
6. **Assessment Can Begin**: App can now access their tenant's data

## Deployment Notes

- ✅ **No Breaking Changes**: Existing app registrations continue to work
- ✅ **No Database Changes**: Only logic changes in the API
- ✅ **Immediate Effect**: Fix takes effect as soon as API is deployed
- ✅ **Backwards Compatible**: All existing functionality preserved

## Future Improvements

Consider implementing these enhancements in the future:
1. **Domain-to-Tenant Resolution**: Use Microsoft Graph to resolve custom domains to actual tenant IDs
2. **Tenant Validation**: Verify that custom domains actually exist in Azure AD
3. **Enhanced Error Messages**: Provide domain-specific guidance to users
4. **Consent Status Tracking**: Track which tenants have completed consent

## Summary

This fix resolves the critical issue where app registration failed for custom domains. The solution:
- ✅ Detects custom domains automatically
- ✅ Uses appropriate Microsoft endpoints for each domain type
- ✅ Maintains full backwards compatibility
- ✅ Follows Microsoft's recommended practices for multi-tenant applications
- ✅ Provides better logging and debugging capabilities

The M365 Assessment Framework now works seamlessly with all types of tenant identifiers, making it much more user-friendly for organizations with custom domains.
