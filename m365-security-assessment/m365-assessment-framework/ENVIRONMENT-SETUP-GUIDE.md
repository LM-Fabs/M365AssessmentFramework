# Environment Configuration Guide

## Required Environment Variables

Your M365 Assessment Framework needs these environment variables to function properly:

### Core Azure AD Configuration

```bash
# Your Azure AD Application (Client) ID
# This is the ID of YOUR multi-tenant app registration in YOUR Azure AD tenant
REACT_APP_CLIENT_ID=12345678-abcd-1234-5678-1234567890ab

# Alternative variable name (for backend compatibility)
AZURE_CLIENT_ID=12345678-abcd-1234-5678-1234567890ab

# Your Azure AD Client Secret (for backend API calls)
AZURE_CLIENT_SECRET=your-client-secret-here

# Your Azure AD Tenant ID (where your app is registered)
AZURE_TENANT_ID=87654321-dcba-4321-8765-210987654321

# Consent redirect URI (where customers are sent after granting consent)
REACT_APP_CONSENT_REDIRECT_URI=https://yourapp.azurewebsites.net/api/consent-callback
```

## How to Get Your Application (Client) ID

### Step 1: Find Your Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your "M365 Security Assessment Framework" app (or create one if it doesn't exist)

### Step 2: Copy the Application (Client) ID

```
App Registration Overview
├── Application (client) ID: 12345678-abcd-1234-5678-1234567890ab  ← COPY THIS
├── Directory (tenant) ID: 87654321-dcba-4321-8765-210987654321
└── Object ID: abcdef12-3456-7890-abcd-ef1234567890
```

### Step 3: Ensure Multi-Tenant Configuration

Your app registration must be configured for multi-tenant access:

```
Authentication Settings
├── Supported account types: 
│   └── ✅ Accounts in any organizational directory (Any Azure AD directory - Multitenant)
│   └── ❌ Accounts in this organizational directory only (Single tenant)
└── Redirect URIs:
    └── https://yourapp.azurewebsites.net/api/consent-callback
```

## Setting Up Environment Variables

### For Local Development

Create a `.env.local` file in your project root:

```bash
# .env.local (for local development)
REACT_APP_CLIENT_ID=your-actual-client-id-here
AZURE_CLIENT_ID=your-actual-client-id-here
AZURE_CLIENT_SECRET=your-client-secret-here
AZURE_TENANT_ID=your-tenant-id-here
REACT_APP_CONSENT_REDIRECT_URI=http://localhost:3000/api/consent-callback
```

### For Azure Static Web Apps

Set these in your Azure Static Web App configuration:

1. Go to **Azure Portal** → **Static Web Apps** → Your app
2. Navigate to **Configuration** → **Application settings**
3. Add these settings:

```
REACT_APP_CLIENT_ID = your-actual-client-id-here
AZURE_CLIENT_ID = your-actual-client-id-here  
AZURE_CLIENT_SECRET = your-client-secret-here
AZURE_TENANT_ID = your-tenant-id-here
REACT_APP_CONSENT_REDIRECT_URI = https://yourapp.azurewebsites.net/api/consent-callback
```

### For GitHub Actions (CI/CD)

Add these as repository secrets:

1. Go to **GitHub** → Your repository → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:

```
AZURE_CLIENT_ID = your-actual-client-id-here
AZURE_CLIENT_SECRET = your-client-secret-here  
AZURE_TENANT_ID = your-tenant-id-here
REACT_APP_CLIENT_ID = your-actual-client-id-here
REACT_APP_CONSENT_REDIRECT_URI = https://yourapp.azurewebsites.net/api/consent-callback
```

## Testing Your Configuration

### Test 1: Check if Client ID is loaded

```typescript
import { M365_ASSESSMENT_CONFIG } from './src/services/adminConsentService';

console.log('Client ID:', M365_ASSESSMENT_CONFIG.clientId);
// Should show your actual client ID, not 'your-client-id'
```

### Test 2: Generate a test consent URL

```typescript
const consentService = AdminConsentService.getInstance();

const testUrl = consentService.generateAdminConsentUrl({
  clientId: M365_ASSESSMENT_CONFIG.clientId,
  redirectUri: M365_ASSESSMENT_CONFIG.defaultRedirectUri,
  scope: 'https://graph.microsoft.com/.default'
});

console.log('Test consent URL:', testUrl);
// Should contain your actual client ID in the URL
```

### Test 3: Auto-detect current user tenant

```typescript
const consentService = AdminConsentService.getInstance();

consentService.getCurrentUserTenantInfo().then(userInfo => {
  console.log('Current user tenant:', userInfo);
  // Should show your tenant information when logged in
});
```

## Common Issues and Solutions

### Issue: "Using fallback client ID" warning

**Problem**: The app is using the hardcoded fallback client ID instead of your actual one.

**Solution**: 
1. Verify `REACT_APP_CLIENT_ID` is set in your environment
2. Check that the value is not 'your-client-id' (the default placeholder)
3. Restart your application after setting environment variables

### Issue: "Could not automatically determine tenant ID"

**Problem**: Auto-detection of tenant ID fails.

**Solution**:
1. Ensure you're logged in to the application
2. Check that Azure Static Web Apps authentication is configured
3. Verify the `/.auth/me` endpoint is accessible

### Issue: Consent URL doesn't work

**Problem**: Customers get errors when clicking the consent URL.

**Solution**:
1. Verify your app is configured for multi-tenant access
2. Check that the redirect URI matches your configuration
3. Ensure required permissions are configured in your app registration

## Security Best Practices

### 1. Never Commit Secrets

```bash
# ❌ Never commit these files
.env
.env.local
.env.production

# ✅ Use .gitignore
echo ".env*" >> .gitignore
```

### 2. Use Different Values for Different Environments

```bash
# Development
REACT_APP_CONSENT_REDIRECT_URI=http://localhost:3000/api/consent-callback

# Staging  
REACT_APP_CONSENT_REDIRECT_URI=https://yourapp-staging.azurewebsites.net/api/consent-callback

# Production
REACT_APP_CONSENT_REDIRECT_URI=https://yourapp.azurewebsites.net/api/consent-callback
```

### 3. Validate Configuration on Startup

```typescript
// Add this to your app initialization
if (!M365_ASSESSMENT_CONFIG.clientId || M365_ASSESSMENT_CONFIG.clientId === 'your-client-id') {
  console.error('❌ REACT_APP_CLIENT_ID is not configured properly');
  throw new Error('Missing required configuration: REACT_APP_CLIENT_ID');
}
```

## Summary

The key points to remember:

1. **Application (Client) ID**: This comes from YOUR Azure AD app registration, not from customers
2. **Same ID for all customers**: You use the same client ID for all customer consent URLs
3. **Enterprise App created after consent**: The customer's tenant gets a Service Principal with the same App ID
4. **Environment variables**: Set `REACT_APP_CLIENT_ID` to your actual Azure AD application client ID
5. **Multi-tenant configuration**: Your app must be configured to support "Any organizational directory"
