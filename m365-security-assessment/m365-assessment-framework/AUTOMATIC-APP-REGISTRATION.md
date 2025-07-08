# Automatic App Registration Feature

## Overview

The M365 Assessment Framework now automatically creates Azure AD app registrations when new customers are registered, eliminating the need for manual setup and ensuring real data collection from the start.

## How It Works

### 1. Customer Registration Flow

When a new customer is registered through the API (`POST /api/customers`), the following automated process occurs:

1. **Initial Customer Creation**: Customer record is created with placeholder app registration
2. **Automatic App Registration**: Real Azure AD app registration is immediately created
3. **Secret Storage**: Client secret is securely stored in Key Vault (if available) 
4. **Customer Update**: Customer record is updated with real app registration details

### 2. App Registration Details

Each automatically created app registration includes:

- **Multi-tenant configuration**: Works across customer tenants
- **Comprehensive permissions**: All required Microsoft Graph API permissions
- **Secure client secret**: 2-year expiry, stored securely
- **Admin consent URL**: Direct link for customer admin approval

### 3. Required Permissions

The app registration is created with these Microsoft Graph permissions:

- `Organization.Read.All` - License and organization data
- `SecurityEvents.Read.All` - Security score and events
- `Reports.Read.All` - Usage and activity reports
- `Directory.Read.All` - User and group information
- `Policy.Read.All` - Conditional access policies
- `IdentityRiskyUser.Read.All` - Identity protection data
- `AuditLog.Read.All` - Audit logs and compliance data

## Backend Implementation

### Key Components

1. **GraphApiService.createMultiTenantAppRegistration()**: Creates the Azure AD app registration
2. **KeyVaultService**: Securely stores client secrets
3. **Customer Creation Endpoint**: Orchestrates the automatic process

### Error Handling

The system includes robust error handling:

- **Validation**: Environment variables and required fields
- **Retry Logic**: Handles transient Azure API failures
- **Fallback**: Creates customer record even if app registration fails
- **Troubleshooting**: Detailed error messages and resolution steps

### Security Features

- **Secret Protection**: Client secrets stored in Key Vault when available
- **Secret Validation**: Warns if secret ID is used instead of value
- **Secure Transmission**: Secrets never logged in plain text
- **Expiry Management**: 2-year secret expiry with renewal tracking

## Configuration Requirements

### Environment Variables

```bash
# Required for app registration creation
AZURE_CLIENT_ID=<service-principal-client-id>
AZURE_CLIENT_SECRET=<service-principal-secret>
AZURE_TENANT_ID=<azure-tenant-id>

# Optional for Key Vault storage
KEY_VAULT_URL=<key-vault-url>

# Optional custom redirect URI
REDIRECT_URI=<custom-redirect-uri>
```

### Service Principal Permissions

The service principal must have these permissions in Microsoft Graph:

- `Application.ReadWrite.All` - Create app registrations
- `Directory.Read.All` - Read tenant information
- `User.Read.All` - Basic user access

## Testing

### Automated Test Script

Run the comprehensive test:

```bash
./test-automatic-app-registration.sh
```

This test:
- Creates a new customer with automatic app registration
- Verifies real Azure AD app registration is created
- Checks client secret handling
- Validates permissions configuration
- Tests assessment creation flow

### Manual Testing

1. **Create Customer via API**:
   ```bash
   curl -X POST https://your-api.azurestaticapps.net/api/customers \
     -H "Content-Type: application/json" \
     -d '{"tenantName":"Test Company","tenantDomain":"test.onmicrosoft.com"}'
   ```

2. **Verify App Registration**:
   - Check Azure Portal → App registrations
   - Look for `M365-Security-Assessment-Test-Company`
   - Verify multi-tenant configuration and permissions

3. **Grant Admin Consent**:
   - Use the `consentUrl` from the API response
   - Grant admin consent for all requested permissions

4. **Test Assessment**:
   - Create assessment via API or UI
   - Verify real data collection (not fallback data)

## Troubleshooting

### Common Issues

1. **"Insufficient permissions" Error**:
   - Verify service principal has `Application.ReadWrite.All`
   - Check admin consent for service principal

2. **"Authentication failed" Error**:
   - Verify `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
   - Check service principal secret expiry

3. **"Key Vault not available" Warning**:
   - Normal in development environments
   - Secret stored in database as fallback

4. **Client Secret Issues**:
   - System warns if secret ID used instead of value
   - Check for proper secret extraction in app registration

### Debug Information

The system provides detailed logging:
- App registration creation steps
- Permission validation
- Secret storage attempts
- Error details with resolution steps

### Frontend Behavior

- **No Fallback Data**: UI only shows real assessment data
- **Error Display**: Clear messaging for app registration issues
- **Admin Guidance**: Step-by-step consent instructions

## Monitoring

### Success Indicators

- Customer created with real `clientId` (GUID format)
- Client secret stored securely (Key Vault or encrypted database)
- Consent URL provided for admin approval
- Assessment data shows real metrics (not placeholder)

### Health Checks

- Monitor app registration creation success rate
- Check Key Vault connectivity
- Validate service principal permissions
- Track assessment data quality

## Security Considerations

1. **Least Privilege**: App registrations only request necessary permissions
2. **Secret Rotation**: 2-year expiry with renewal notifications
3. **Audit Trail**: All app registration actions logged
4. **Secure Storage**: Client secrets never exposed in logs or UI
5. **Multi-tenant Isolation**: Each customer gets separate app registration

## Future Enhancements

- **Automatic Secret Rotation**: Proactive secret renewal
- **Permission Optimization**: Dynamic permission requests based on assessment needs
- **Consent Automation**: Streamlined admin consent flow
- **Health Monitoring**: Automated app registration health checks
