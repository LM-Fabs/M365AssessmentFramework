# Application ID Configuration Guide

## Understanding the Multi-Tenant Flow

### 1. **Your Master Application (Pre-Consent)**
```
Your Tenant: contoso.onmicrosoft.com
├── App Registration: "M365 Security Assessment Framework"
│   ├── Application (client) ID: 12345678-abcd-1234-5678-1234567890ab
│   ├── Multi-tenant: Yes (Any organizational directory)
│   └── Permissions: Microsoft Graph API permissions
```

### 2. **Customer Consent URL Generation**
```typescript
// Use YOUR application's client ID in the consent URL
const consentUrl = `https://login.microsoftonline.com/common/adminconsent
  ?client_id=12345678-abcd-1234-5678-1234567890ab  // YOUR app's client ID
  &redirect_uri=https://yourapp.com/consent-callback
  &scope=https://graph.microsoft.com/.default`
```

### 3. **After Customer Consent**
```
Customer Tenant: customer.onmicrosoft.com  
├── Enterprise Application: "M365 Security Assessment Framework"
│   ├── Service Principal ID: 87654321-dcba-4321-8765-210987654321  // NEW ID
│   ├── App ID: 12345678-abcd-1234-5678-1234567890ab              // SAME as your client ID
│   └── Permissions: Granted by admin
```

## Where to Get Your Application (Client) ID

### Option 1: Azure Portal
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your M365 Assessment Framework app
4. Copy the **Application (client) ID**

### Option 2: Environment Variables
```bash
# In your .env file
REACT_APP_CLIENT_ID=12345678-abcd-1234-5678-1234567890ab
AZURE_CLIENT_ID=12345678-abcd-1234-5678-1234567890ab
```

### Option 3: Configuration File
```typescript
// In your auth config
export const authConfig = {
  clientId: process.env.REACT_APP_CLIENT_ID || 'your-client-id-here',
  // other config...
};
```

## Implementation in AdminConsentService

The Application ID should be configured at the application level, not per customer:

```typescript
// Wrong approach - different client ID per customer
const consentUrl = generateConsent(customer.clientId, ...)

// Correct approach - same client ID for all customers  
const consentUrl = generateConsent(APP_CLIENT_ID, ...)
```

## Why This Works

1. **Single Application Registration**: You register ONE multi-tenant app in your tenant
2. **Multiple Enterprise Apps**: After consent, it appears as an Enterprise App in each customer tenant
3. **Consistent Client ID**: The Application (client) ID remains the same across all tenants
4. **Per-Tenant Service Principals**: Each customer tenant gets its own Service Principal with the same App ID

## Configuration in Your Code

Update your consent URL generation to use a centralized client ID:

```typescript
export const M365_ASSESSMENT_CONFIG = {
  // Your master application's client ID
  clientId: process.env.REACT_APP_CLIENT_ID || '12345678-abcd-1234-5678-1234567890ab',
  
  // Standard permissions your app needs
  requiredPermissions: [
    'User.Read.All',
    'Directory.Read.All',
    'Reports.Read.All',
    // ... other permissions
  ],
  
  // Where customers are redirected after consent
  defaultRedirectUri: process.env.REACT_APP_CONSENT_REDIRECT_URI || 
                     'https://yourapp.azurewebsites.net/api/consent-callback'
} as const;
```

## Summary

- **Application (Client) ID**: Get this from YOUR app registration in YOUR Azure AD tenant
- **Use everywhere**: Same client ID for all customer consent URLs
- **Enterprise App ID**: Generated automatically in customer tenants after consent
- **Not customer-specific**: You don't need different client IDs per customer
