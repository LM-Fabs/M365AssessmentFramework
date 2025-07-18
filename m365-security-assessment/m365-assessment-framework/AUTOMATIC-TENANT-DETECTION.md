# Automatic Tenant ID Detection for OAuth2 Consent Flow

## Overview

The M365 Security Assessment Framework now automatically detects the tenant ID from the authenticated user's OAuth2 session, eliminating the need for manual tenant ID entry in most scenarios. This feature significantly improves the user experience when generating admin consent URLs for customer tenants.

## How It Works

### 1. Authentication Data Sources

The system attempts to extract tenant information from multiple sources in the following order of preference:

#### Primary Method: Azure Static Web Apps Authentication
- **Endpoint**: `/.auth/me`
- **Data Source**: Azure Static Web Apps built-in authentication
- **Claims Extracted**:
  - `tid` - Tenant ID
  - `oid` - Object ID (User's unique ID in tenant)
  - `upn` - User Principal Name
  - `userId` - User identifier
  - `identityProvider` - Authentication provider (e.g., "aad")

#### Fallback Method: MSAL Browser Session
- **Data Source**: Browser localStorage/sessionStorage
- **Storage Keys**: `msal.account.keys`
- **Properties**: `tenantId`, `realm`

#### Final Fallback: URL Parameters
- **Parameters**: `tenant`, `tenantId`
- **Source**: Current page URL parameters

### 2. Automatic Detection Process

```typescript
// 1. Try Azure Static Web Apps authentication
const userTenantInfo = await adminConsentService.getCurrentUserTenantInfo();

// 2. Fallback to MSAL browser session
if (!userTenantInfo?.tenantId) {
    const tenantId = adminConsentService.getTenantIdFromMSAL();
}

// 3. Final fallback to URL parameters
if (!tenantId) {
    const urlParams = new URLSearchParams(window.location.search);
    const tenantId = urlParams.get('tenant') || urlParams.get('tenantId');
}
```

## Implementation Details

### AdminConsentService Enhancements

#### New Methods Added

**`getCurrentUserTenantInfo(): Promise<UserTenantInfo | null>`**
- Extracts tenant information from Azure Static Web Apps authentication
- Returns comprehensive user tenant data including tenant ID, UPN, and object ID
- Handles multiple claim type formats for cross-compatibility

**`getTenantIdFromMSAL(): string | null`**
- Extracts tenant ID from MSAL browser session storage
- Checks both localStorage and sessionStorage
- Provides fallback for applications using MSAL.js

**`generateConsentUrlWithAutoTenant(clientId, redirectUri, customerId, scope?)`**
- Automatically determines tenant ID using all available methods
- Returns both the generated URL and metadata about detection method
- Provides comprehensive error handling and fallback mechanisms

**`validateCurrentUserAdminStatus(): Promise<AdminValidationResult>`**
- Validates that the current user has appropriate admin permissions
- Checks for work/school account vs personal account
- Provides recommendations for resolving admin access issues

### Frontend Integration

#### ConsentUrlGenerator Component Updates

**Auto-Detect Button**
- Visual indicator (🔍) next to tenant ID field
- Automatically populates tenant ID from current user session
- Loading state with spinner during detection
- Error handling with user-friendly messages

**Automatic Population**
- Tenant ID automatically populated on component load if user is authenticated
- Integrates with existing `useAuth` hook
- Seamless fallback to manual entry if auto-detection fails

**Enhanced UX**
```tsx
// Auto-populate from current user
const { user } = useAuth();
const [formData, setFormData] = useState({
  tenantId: user?.tenantId || '', // Auto-populate from current user
  // ... other fields
});

// Auto-detect functionality
const handleAutoDetectTenant = async () => {
  const userTenantInfo = await adminConsentService.getCurrentUserTenantInfo();
  if (userTenantInfo?.tenantId) {
    setFormData(prev => ({ ...prev, tenantId: userTenantInfo.tenantId! }));
  }
};
```

## User Experience

### For Assessment Framework Administrators

1. **Sign In**: Admin signs in with their work/school account
2. **Navigate**: Go to Settings → Generate Consent URL
3. **Auto-Detect**: Click the 🔍 button or tenant ID is auto-populated
4. **Generate**: System creates consent URL with detected tenant ID
5. **Share**: Send URL to customer admin for consent

### For Customer Administrators

1. **Receive URL**: Get consent URL from assessment framework admin
2. **Click URL**: Opens Microsoft consent page with correct tenant context
3. **Grant Consent**: Review and approve permissions
4. **Automatic Setup**: Enterprise app is automatically created in their tenant

## Configuration

### Environment Variables

```bash
# Optional: Override default redirect URI
REACT_APP_CONSENT_REDIRECT_URI=https://yourdomain.com/api/consent-callback

# Required: Application client ID for consent URLs
REACT_APP_CLIENT_ID=your-application-client-id
```

### Supported Claim Types

The system recognizes multiple claim type formats:

```typescript
// Tenant ID Claims
'tid'                                           // Short form
'http://schemas.microsoft.com/identity/claims/tenantid'  // Full URI

// Object ID Claims  
'oid'                                           // Short form
'http://schemas.microsoft.com/identity/claims/objectidentifier'  // Full URI

// UPN Claims
'upn'                                           // Short form
'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn'  // Full URI
```

## Security Considerations

### Data Privacy
- Tenant information is only extracted from authenticated sessions
- No tenant data is stored permanently in browser storage
- All communication with authentication endpoints uses HTTPS

### Access Control
- Auto-detection only works for authenticated users
- Validates that accounts are work/school accounts (not personal)
- Provides warnings for personal account usage

### Error Handling
- Graceful fallback to manual entry if auto-detection fails
- Clear error messages for troubleshooting
- No exposure of sensitive authentication data in error logs

## API Reference

### UserTenantInfo Interface

```typescript
interface UserTenantInfo {
  tenantId: string | null;           // Azure AD tenant ID
  tenantName?: string;               // Tenant display name (if available)
  userPrincipalName: string;         // User's UPN (email)
  objectId: string;                  // User's object ID in tenant
  displayName: string;               // User's display name
  userId: string;                    // Unique user identifier
  identityProvider: string;          // Auth provider (e.g., "aad")
  domain?: string;                   // Domain extracted from UPN
}
```

### AdminValidationResult Interface

```typescript
interface AdminValidationResult {
  isValid: boolean;                  // Whether user appears to have admin capabilities
  errors: string[];                  // Any validation errors found
  warnings?: string[];               // Warnings about account type or permissions
  userInfo: UserTenantInfo | null;   // Extracted user information
  recommendations?: string[];        // Suggestions for resolving issues
}
```

## Testing

### Automated Testing

Run the automatic tenant detection test suite:

```bash
./test-auto-tenant-detection.sh
```

This script tests:
- Authentication endpoint availability
- Tenant ID extraction from multiple sources
- Consent URL generation with auto-detected tenant
- Frontend component integration
- End-to-end workflow simulation

### Manual Testing Steps

1. **Local Development**:
   ```bash
   npm start  # Start React app
   cd api && npm start  # Start Azure Functions
   ```

2. **Authentication Setup**:
   - Ensure Azure Static Web Apps authentication is configured
   - Sign in with a work/school account that has Global Admin permissions

3. **Test Auto-Detection**:
   - Navigate to Settings → App Registrations
   - Click "Generate Consent URL"
   - Verify tenant ID is auto-populated or click 🔍 to auto-detect

4. **Test Consent Flow**:
   - Generate consent URL with auto-detected tenant
   - Open URL in incognito window
   - Complete consent process as customer admin

## Troubleshooting

### Common Issues

**"Could not automatically detect your tenant ID"**
- Verify you're signed in with a work/school account
- Check that Azure Static Web Apps authentication is properly configured
- Try refreshing the page and signing in again

**"Authentication failed" during consent**
- Verify the application is configured as multi-tenant
- Check that all required permissions are configured in Azure AD
- Ensure the redirect URI matches exactly

**Auto-detect button not working**
- Check browser console for JavaScript errors
- Verify the `.auth/me` endpoint is accessible
- Try manually entering the tenant ID as fallback

### Debug Information

Enable debug logging by setting:
```javascript
localStorage.setItem('debug', 'consent:*');
```

This will log detailed information about:
- Tenant detection attempts
- Authentication data extraction
- Consent URL generation
- Error details and stack traces

## Migration Guide

### From Manual Tenant Entry

Existing installations automatically gain auto-detection capability:

1. **Update Dependencies**: Ensure latest version of AdminConsentService
2. **UI Enhancement**: Auto-detect button appears automatically
3. **Backward Compatibility**: Manual entry still works as before
4. **Gradual Rollout**: Users can choose auto-detect or manual entry

### Configuration Updates

No breaking changes to existing configuration. New optional settings:

```typescript
// Optional: Customize auto-detection behavior
const adminConsentService = AdminConsentService.getInstance();

// Disable MSAL fallback if not needed
adminConsentService.disableMSALDetection = true;

// Custom claim type mappings
adminConsentService.customClaimMappings = {
  tenantId: ['tid', 'custom_tenant_claim'],
  objectId: ['oid', 'custom_object_claim']
};
```

## Performance Impact

- **Authentication Call**: Single HTTP request to `/.auth/me` endpoint
- **Browser Storage**: Minimal localStorage/sessionStorage access for MSAL fallback
- **Memory Usage**: Negligible additional memory footprint
- **Network**: No additional network requests beyond existing authentication flow

## Future Enhancements

### Planned Features

1. **Tenant Validation**: Real-time validation of detected tenant ID
2. **Multi-Tenant Context**: Support for users with access to multiple tenants
3. **Admin Role Detection**: Automatic detection of Global Admin permissions
4. **Cached Detection**: Cache tenant information for improved performance
5. **Custom Claim Mapping**: Support for custom claim type configurations

### Integration Opportunities

1. **Microsoft Graph**: Enhanced user/tenant information via Graph API
2. **Azure CLI**: Integration with Azure CLI authentication
3. **Visual Studio**: Support for Visual Studio authentication context
4. **Teams**: Integration with Microsoft Teams app authentication

---

## Conclusion

The automatic tenant ID detection feature significantly improves the user experience for generating admin consent URLs. By leveraging OAuth2 authentication data already available in the user's session, we eliminate manual data entry while maintaining security and providing robust fallback mechanisms.

The implementation is designed to be:
- **User-Friendly**: One-click tenant detection
- **Secure**: No additional authentication required
- **Reliable**: Multiple fallback methods ensure compatibility
- **Future-Proof**: Extensible architecture for additional detection methods

This enhancement makes the M365 Security Assessment Framework more accessible to both assessment framework administrators and customer administrators, reducing setup time and potential errors in the consent flow.
