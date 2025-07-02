# Security Deployment Guide for M365 Assessment Framework

## Overview

This guide ensures secure deployment of the M365 Assessment Framework to Azure Static Web Apps without triggering GitHub secret scanning alerts or exposing sensitive credentials.

## Security Best Practices Implemented

### 1. Secret Management
- **GitHub Secrets**: All sensitive credentials are stored as GitHub repository secrets
- **No Hardcoded Secrets**: No secrets are embedded in source code or configuration files
- **Environment Variables**: Secrets are injected as environment variables during deployment

### 2. Infrastructure as Code (IaC) Security
- **Bicep Templates**: Infrastructure is defined in Bicep without exposing secrets
- **Separation of Concerns**: Service principal credentials are configured separately from infrastructure

### 3. Deployment Pipeline Security
- **Federated Identity**: Supports both federated credentials and service principal authentication
- **Secure Configuration**: Secrets are configured in Azure resources post-deployment

## Required Environment Variables

The following environment variables must be configured in Azure Static Web App:

### Authentication & Authorization
```
AZURE_CLIENT_ID=<your-service-principal-client-id>
AZURE_CLIENT_SECRET=<your-service-principal-client-secret>
AZURE_TENANT_ID=<your-azure-tenant-id>
```

### Azure Services
```
AZURE_STORAGE_CONNECTION_STRING=<auto-configured-by-bicep>
KEY_VAULT_URL=<auto-configured-by-bicep>
APPLICATIONINSIGHTS_CONNECTION_STRING=<auto-configured-by-bicep>
```

## Deployment Process

### Prerequisites
1. Azure subscription with appropriate permissions
2. GitHub repository with required secrets configured
3. Service principal with necessary Azure permissions

### Step 1: Configure GitHub Secrets
Configure the following secrets in your GitHub repository:

```
AZURE_CLIENT_ID - Service principal client ID
AZURE_CLIENT_SECRET - Service principal client secret
AZURE_TENANT_ID - Azure tenant ID
AZURE_SUBSCRIPTION_ID - Azure subscription ID
AZURE_ENV_NAME - Environment name (e.g., dev, prod)
AZURE_LOCATION - Azure region (e.g., eastus)
```

### Step 2: Automated Deployment
The GitHub Actions workflow will:
1. Authenticate with Azure using stored secrets
2. Provision infrastructure using Bicep templates
3. Deploy the application to Azure Static Web Apps
4. Configure environment variables securely

### Step 3: Manual Configuration (If Needed)
If the automated configuration fails, manually set environment variables:

```bash
# Get resource information
STATIC_WEB_APP_NAME="m365-assessment-framework"
RESOURCE_GROUP="<your-resource-group>"

# Configure environment variables
az staticwebapp appsettings set \
  --name "$STATIC_WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --setting-names \
    AZURE_CLIENT_ID="<your-client-id>" \
    AZURE_CLIENT_SECRET="<your-client-secret>"
```

## Security Considerations

### What's Secure ✅
- Service principal credentials stored as GitHub secrets
- Environment variables configured in Azure (not in code)
- Storage and Application Insights connection strings auto-generated
- Key Vault URL provided without exposing secrets

### What to Avoid ❌
- Never commit secrets to source control
- Never output secrets in build logs
- Never include secrets in Bicep template outputs
- Never expose secrets in client-side code

### GitHub Secret Scanning Protection
This configuration prevents GitHub secret scanning alerts by:
- Using environment variable names in configuration files (not values)
- Storing actual secrets only in GitHub repository secrets
- Configuring secrets in Azure resources post-deployment
- Not outputting sensitive information in workflow logs

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Check Azure Static Web App configuration in Azure Portal
   - Verify GitHub secrets are properly configured
   - Review deployment logs for configuration errors

2. **Authentication Failures**
   - Verify service principal has correct permissions
   - Check that AZURE_CLIENT_ID and AZURE_CLIENT_SECRET are set
   - Confirm AZURE_TENANT_ID matches your Azure tenant

3. **GitHub Secret Scanning Alerts**
   - Ensure no secrets are hardcoded in source files
   - Remove any exposed secrets from git history
   - Use environment variable references, not actual values

### Validation Commands

```bash
# Check Static Web App configuration
az staticwebapp appsettings list \
  --name "m365-assessment-framework" \
  --resource-group "<your-resource-group>"

# Test API endpoint
curl https://<your-static-web-app>.azurestaticapps.net/api/test

# Check application logs
az staticwebapp logs show \
  --name "m365-assessment-framework" \
  --resource-group "<your-resource-group>"
```

## Additional Security Recommendations

### Enhanced Security Options
1. **Managed Identity**: Consider using managed identity for Azure service connections
2. **Key Vault References**: Store secrets in Key Vault and reference them in app settings
3. **Network Security**: Implement IP restrictions and VNet integration if needed
4. **Monitoring**: Enable Application Insights for security monitoring

### Key Vault Integration (Optional)
For enhanced security, store secrets in Key Vault:

```bash
# Store secrets in Key Vault
az keyvault secret set \
  --vault-name "<your-key-vault>" \
  --name "azure-client-secret" \
  --value "<your-client-secret>"

# Reference from Static Web App
az staticwebapp appsettings set \
  --name "m365-assessment-framework" \
  --resource-group "<your-resource-group>" \
  --setting-names AZURE_CLIENT_SECRET="@Microsoft.KeyVault(VaultName=<your-key-vault>;SecretName=azure-client-secret)"
```

## Compliance and Auditing

- All secrets are managed through Azure Key Vault or GitHub secrets
- Deployment activities are logged in Azure Activity Logs
- Application access is monitored through Application Insights
- Authentication flows are tracked for compliance requirements

## Support

For deployment issues or security concerns:
1. Check Azure Portal for resource status and logs
2. Review GitHub Actions workflow runs for errors
3. Validate environment variable configuration
4. Ensure service principal permissions are correct

---

**Important**: Never share or commit actual secret values. This guide provides the framework for secure deployment while protecting sensitive credentials.
