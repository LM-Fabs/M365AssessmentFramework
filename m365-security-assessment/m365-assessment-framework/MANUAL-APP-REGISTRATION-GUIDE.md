# Manual App Registration Guide

This guide explains how to set up Azure AD app registrations manually for the M365 Assessment Framework. Manual setup is recommended for production environments due to its reliability and security.

## Overview

The M365 Assessment Framework supports two app registration workflows:

1. **Manual (Recommended)**: Admin manually creates app registration in Azure Portal
2. **Automatic**: System attempts to create app registration programmatically

Manual workflow is preferred because:
- More reliable (no dependency on service principal permissions)
- Better security control
- Clearer audit trail
- Easier troubleshooting

## Manual App Registration Process

### Step 1: Create the Customer Record

1. In the M365 Assessment Framework UI, go to the Assessment page
2. Click "Add New Customer" 
3. Fill in the tenant details:
   - **Tenant Name**: Display name for the organization
   - **Tenant Domain**: Customer's Microsoft 365 domain (e.g., `customer.onmicrosoft.com`)
   - **Tenant ID**: (Optional) Customer's Azure AD tenant ID
   - **Contact Email**: Primary contact email
4. Click "Create Customer"

The system will create a customer record with placeholder app registration values and provide setup instructions.

### Step 2: Create Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory > App registrations**
3. Click **New registration**
4. Configure the app registration:
   - **Name**: `M365 Assessment Framework - [Customer Name]`
   - **Supported account types**: Select **"Accounts in any organizational directory (Any Azure AD directory - Multitenant)"**
   - **Redirect URI**: Set to `https://portal.azure.com/` or your assessment tool's callback URL
5. Click **Register**

### Step 3: Configure API Permissions

After creating the app registration:

1. Go to **API permissions** in the app registration
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Application permissions**
5. Add the following permissions:

#### Required Permissions

| Permission | Purpose |
|------------|---------|
| `Organization.Read.All` | Read organization and license information |
| `SecurityEvents.Read.All` | Read security events and secure score |
| `Reports.Read.All` | Read usage and activity reports |
| `Directory.Read.All` | Read directory data (users, groups, etc.) |
| `Policy.Read.All` | Read conditional access and compliance policies |
| `IdentityRiskyUser.Read.All` | Read identity protection data |
| `AuditLog.Read.All` | Read audit logs and sign-in logs |

6. Click **Add permissions**
7. Click **Grant admin consent for [Organization]**
8. Confirm by clicking **Yes**

### Step 4: Create Client Secret

1. Go to **Certificates & secrets** in the app registration
2. Click **New client secret**
3. Add a description: `M365 Assessment Framework Secret`
4. Set expiration: **24 months** (recommended)
5. Click **Add**
6. **Important**: Copy the secret value immediately (it won't be shown again)

### Step 5: Update Customer Record

1. Go back to the M365 Assessment Framework
2. Navigate to the Reports page
3. Find the customer you created
4. Click **Edit** or **Update App Registration**
5. Fill in the values from your Azure AD app registration:
   - **Application ID**: From the app registration overview page
   - **Client ID**: Same as Application ID
   - **Client Secret**: The secret value you copied
   - **Service Principal ID**: From **Enterprise applications** (search for your app)

### Step 6: Provide Consent URL to Customer

1. Generate the admin consent URL using this template:
   ```
   https://login.microsoftonline.com/[CUSTOMER_TENANT_ID]/oauth2/v2.0/authorize?client_id=[YOUR_APP_CLIENT_ID]&response_type=code&redirect_uri=[YOUR_REDIRECT_URI]&response_mode=query&scope=https://graph.microsoft.com/.default&state=12345&prompt=admin_consent
   ```

2. Replace the placeholders:
   - `[CUSTOMER_TENANT_ID]`: Customer's Azure AD tenant ID
   - `[YOUR_APP_CLIENT_ID]`: Your app registration's client ID
   - `[YOUR_REDIRECT_URI]`: URL-encoded redirect URI (e.g., `https%3A//portal.azure.com/`)

3. Send this URL to the customer's Global Administrator

### Step 7: Customer Admin Consent

The customer's Global Administrator must:

1. Open the consent URL you provided
2. Sign in with their Global Administrator account
3. Review the requested permissions
4. Click **Accept** to grant consent

### Step 8: Test the Setup

1. In the M365 Assessment Framework, select the customer
2. Click **Run Assessment**
3. Verify that the assessment completes successfully
4. Check that data is retrieved from the customer's tenant

## Troubleshooting

### Common Issues

#### 1. "Insufficient privileges" error
- **Cause**: Admin consent not granted or granted by non-Global Admin
- **Solution**: Ensure customer's Global Administrator grants consent

#### 2. "Application not found" error
- **Cause**: Incorrect Application ID or Client ID
- **Solution**: Verify IDs match exactly from Azure Portal

#### 3. "Invalid client secret" error
- **Cause**: Wrong secret value or expired secret
- **Solution**: Generate new secret and update customer record

#### 4. "Tenant not found" error
- **Cause**: Incorrect tenant ID or domain
- **Solution**: Verify tenant ID and domain are correct

### Validation Steps

1. **Verify App Registration**: Check that app exists in Azure Portal
2. **Check Permissions**: Ensure all required permissions are granted
3. **Validate Secret**: Test with Graph Explorer or PowerShell
4. **Confirm Consent**: Check Enterprise Applications in customer tenant

### Getting Tenant Information

If you need to find the customer's tenant ID:

```powershell
# Using PowerShell
Invoke-RestMethod "https://login.microsoftonline.com/[domain]/.well-known/openid-configuration" | Select-Object issuer
```

```bash
# Using curl
curl "https://login.microsoftonline.com/[domain]/.well-known/openid-configuration" | jq '.issuer'
```

Replace `[domain]` with the customer's domain (e.g., `customer.onmicrosoft.com`).

## Security Best Practices

1. **Rotate Secrets**: Change client secrets every 12-24 months
2. **Principle of Least Privilege**: Only request necessary permissions
3. **Monitor Usage**: Regular review access logs and usage
4. **Secure Storage**: Store secrets in Azure Key Vault when possible
5. **Document Access**: Maintain records of who has access

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Azure AD audit logs
3. Test permissions with Microsoft Graph Explorer
4. Contact support with specific error messages and customer details

## Appendix: Permission Details

### Organization.Read.All
- Reads organization information
- Required for license and subscription data
- Used in compliance assessments

### SecurityEvents.Read.All
- Reads security events and alerts
- Required for Microsoft Secure Score
- Used in security posture analysis

### Reports.Read.All
- Reads usage and activity reports
- Required for user activity analysis
- Used in adoption and usage metrics

### Directory.Read.All
- Reads directory objects (users, groups, devices)
- Required for identity analysis
- Used in access reviews and permissions audit

### Policy.Read.All
- Reads conditional access policies
- Required for policy compliance checks
- Used in security configuration assessment

### IdentityRiskyUser.Read.All
- Reads identity protection data
- Required for risk analysis
- Used in threat detection assessment

### AuditLog.Read.All
- Reads audit and sign-in logs
- Required for activity monitoring
- Used in security incident analysis
