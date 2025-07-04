# Azure AD App Registration - Automatic Domain Resolution

## Overview

The M365 Assessment Framework now includes automatic domain-to-tenant-ID resolution for Azure AD app registration. This enhancement makes the system more robust and user-friendly by automatically discovering the actual Azure AD tenant ID associated with custom domains.

## How It Works

### 1. **Domain Resolution Process**

When creating an Azure AD app registration, the system now follows this enhanced flow:

1. **Input Processing**: Accepts either a tenant ID or domain name
2. **Domain Detection**: Identifies if the input is a custom domain
3. **Tenant Discovery**: Attempts to resolve the domain to its actual Azure AD tenant ID
4. **App Registration**: Creates the app registration using the resolved tenant ID
5. **URL Generation**: Generates consent and auth URLs using the appropriate tenant identifier

### 2. **Resolution Methods**

The system uses multiple approaches to resolve domains to tenant IDs:

#### **Method 1: OpenID Connect Discovery (Primary)**
```
GET https://login.microsoftonline.com/{domain}/v2.0/.well-known/openid_configuration
```
- **Advantage**: Public endpoint, no authentication required
- **Works with**: Most domains configured in Azure AD
- **Returns**: Tenant ID from the issuer claim

#### **Method 2: Microsoft Graph API (Fallback)**
```
GET https://graph.microsoft.com/v1.0/domains?$filter=id eq '{domain}'
```
- **Advantage**: Official Graph API method
- **Limitation**: Requires cross-tenant permissions (limited success)
- **Returns**: Domain configuration details

#### **Method 3: Graceful Degradation**
- If resolution fails, the system falls back to using the domain as-is
- Maintains backwards compatibility
- Uses `common` endpoint for multi-tenant scenarios

### 3. **Domain Type Handling**

The system intelligently handles different domain types:

| Domain Type | Example | Resolution Behavior |
|-------------|---------|-------------------|
| **Tenant GUID** | `12345678-1234-1234-1234-123456789012` | Used as-is (no resolution needed) |
| **OnMicrosoft Domain** | `contoso.onmicrosoft.com` | Used as-is (already valid) |
| **Custom Domain** | `modernworkplace.tips` | **Resolved to actual tenant ID** |
| **Custom Subdomain** | `mail.contoso.com` | Resolved to parent domain's tenant |

## Implementation Details

### **GraphApiService Enhancement**

Added new method `resolveDomainToTenantId()`:

```typescript
async resolveDomainToTenantId(domain: string): Promise<string | null> {
    // 1. Handle OnMicrosoft domains
    if (domain.endsWith('.onmicrosoft.com')) {
        return domain;
    }
    
    // 2. Try OpenID Connect discovery
    const tenantDiscoveryUrl = `https://login.microsoftonline.com/${domain}/v2.0/.well-known/openid_configuration`;
    const response = await fetch(tenantDiscoveryUrl);
    
    if (response.ok) {
        const config = await response.json();
        const issuerMatch = config.issuer?.match(/https:\/\/login\.microsoftonline\.com\/([^\/]+)\/v2\.0/);
        if (issuerMatch) {
            return issuerMatch[1]; // Return actual tenant ID
        }
    }
    
    // 3. Fallback to domain as-is
    return domain;
}
```

### **Enhanced App Registration Flow**

The `createMultiTenantAppRegistration()` method now:

1. **Resolves Domain**: Calls `resolveDomainToTenantId()` for custom domains
2. **Uses Resolved ID**: Creates app registration with actual tenant ID
3. **Generates URLs**: Uses appropriate endpoints for consent and auth
4. **Returns Details**: Includes both original and resolved tenant IDs

## API Response Enhancement

The app registration API now returns additional information:

```json
{
  "success": true,
  "data": {
    "clientId": "12345678-abcd-...",
    "tenantId": "87654321-dcba-...",
    "originalTenantId": "modernworkplace.tips",
    "consentUrl": "https://login.microsoftonline.com/87654321-dcba-.../adminconsent?...",
    "authUrl": "https://login.microsoftonline.com/87654321-dcba-.../oauth2/v2.0/authorize",
    "domainResolved": true,
    "isReal": true
  },
  "message": "Azure AD app registration created successfully. Domain 'modernworkplace.tips' was resolved to tenant ID '87654321-dcba-...'."
}
```

### **New Response Fields**

- `tenantId`: The actual tenant ID (resolved from domain if applicable)
- `originalTenantId`: The original input (domain or tenant ID)
- `domainResolved`: Boolean indicating if domain resolution occurred
- `isReal`: Boolean indicating this is a real (not mock) app registration

## Benefits

### 1. **Improved User Experience**
- ✅ Users can provide just their domain name
- ✅ No need to find and provide tenant IDs
- ✅ Works with corporate domains and subdomains

### 2. **Enhanced Reliability**
- ✅ Uses actual tenant IDs for API calls
- ✅ Generates correct consent URLs
- ✅ Reduces authentication failures

### 3. **Better Integration**
- ✅ Proper tenant identification for Graph API calls
- ✅ Correct URL generation for admin consent
- ✅ Improved multi-tenant app functionality

### 4. **Backwards Compatibility**
- ✅ Still works with tenant IDs
- ✅ OnMicrosoft domains work as before
- ✅ Graceful fallback for resolution failures

## Usage Examples

### **Example 1: Custom Domain**
**Input:**
```json
{
  "targetTenantDomain": "modernworkplace.tips",
  "tenantName": "Modern Workplace Tips"
}
```

**Process:**
1. Domain `modernworkplace.tips` is detected as custom domain
2. System calls OpenID discovery endpoint
3. Tenant ID `87654321-dcba-1234-5678-123456789012` is resolved
4. App registration created with actual tenant ID
5. Consent URL: `https://login.microsoftonline.com/87654321-dcba-1234-5678-123456789012/adminconsent`

### **Example 2: OnMicrosoft Domain**
**Input:**
```json
{
  "targetTenantDomain": "contoso.onmicrosoft.com",
  "tenantName": "Contoso"
}
```

**Process:**
1. Domain `contoso.onmicrosoft.com` is detected as OnMicrosoft domain
2. No resolution needed (already valid)
3. App registration created with domain as tenant ID
4. Consent URL: `https://login.microsoftonline.com/contoso.onmicrosoft.com/adminconsent`

### **Example 3: Tenant ID Provided**
**Input:**
```json
{
  "targetTenantId": "12345678-1234-1234-1234-123456789012",
  "tenantName": "Test Company"
}
```

**Process:**
1. Tenant ID provided directly
2. No resolution needed (already a GUID)
3. App registration created with provided tenant ID
4. Consent URL: `https://login.microsoftonline.com/12345678-1234-1234-1234-123456789012/adminconsent`

## Error Handling

### **Resolution Failures**
If domain resolution fails:
1. **Logs Warning**: Records the failure in application logs
2. **Uses Fallback**: Uses the domain as-is for tenant identification
3. **Common Endpoint**: Switches to `common` endpoint for consent URLs
4. **Continues Processing**: Does not block app registration creation

### **Network Issues**
- Handles network timeouts gracefully
- Falls back to original domain if discovery fails
- Logs detailed error information for troubleshooting

## Monitoring and Debugging

### **Log Messages**
The system provides detailed logging:

```
🔍 GraphApiService: Attempting to resolve domain to tenant ID: modernworkplace.tips
🌐 GraphApiService: Trying tenant discovery for domain: modernworkplace.tips
✅ GraphApiService: Domain resolved to tenant ID: 87654321-dcba-1234-5678-123456789012
🎯 Actual tenant ID to use: 87654321-dcba-1234-5678-123456789012
```

### **Success Indicators**
- `domainResolved: true` in API response
- Success message includes resolution details
- Logs show actual vs. original tenant IDs

### **Troubleshooting**
Common issues and solutions:

1. **Domain Not Configured**: Domain not set up in Azure AD
   - **Solution**: Verify domain is added to target tenant
   
2. **Network Restrictions**: Firewall blocking discovery endpoint
   - **Solution**: Allow access to `login.microsoftonline.com`
   
3. **Invalid Domain**: Domain doesn't exist or has no Azure AD
   - **Solution**: System falls back gracefully, uses common endpoint

## Security Considerations

### **Public Endpoint Usage**
- Uses only public Microsoft endpoints
- No authentication required for discovery
- No sensitive data exposed in resolution process

### **Tenant Validation**
- Validates resolved tenant IDs before use
- Falls back to safe defaults if resolution fails
- Logs all resolution attempts for audit

### **Privacy Protection**
- Does not store or cache resolved tenant IDs
- Resolution occurs only during app registration
- No persistent tenant mapping maintained

## Future Enhancements

Potential improvements for future versions:

1. **Caching**: Cache resolved tenant IDs for performance
2. **Bulk Resolution**: Resolve multiple domains in batch
3. **Advanced Validation**: Verify domain ownership in target tenant
4. **Regional Endpoints**: Support for regional Azure clouds
5. **Custom Discovery**: Support for custom discovery endpoints

## Summary

The automatic domain resolution feature significantly improves the user experience of the M365 Assessment Framework by:

- ✅ **Eliminating the need for users to find tenant IDs**
- ✅ **Automatically discovering the correct tenant information**
- ✅ **Generating proper consent and authentication URLs**
- ✅ **Maintaining full backwards compatibility**
- ✅ **Providing detailed logging and error handling**

This enhancement makes the framework more accessible to organizations using custom domains while maintaining the robustness and security required for enterprise applications.
