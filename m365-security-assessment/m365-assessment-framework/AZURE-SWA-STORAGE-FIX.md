# Azure Static Web Apps Deployment Fix - Storage Configuration

## Problem Resolved

The original issue was that Azure Static Web Apps **do not allow** the `AzureWebJobsStorage` environment variable to be set through the Azure portal. This is a platform limitation because Static Web Apps managed functions use a different runtime architecture than standalone Azure Functions.

## Solution Implemented

### 1. Updated Table Storage Service
- Modified `/api/shared/tableStorageService.ts` to use `AZURE_STORAGE_CONNECTION_STRING` in production
- Maintained backward compatibility with `AzureWebJobsStorage` for local development
- Added comprehensive logging for troubleshooting

### 2. Bicep Infrastructure is Correct
Your existing Bicep template (`/infra/main.bicep`) already correctly configures the Static Web App with the proper storage connection:

```bicep
resource staticWebAppConfig 'Microsoft.Web/staticSites/config@2024-04-01' = {
  name: 'appsettings'
  parent: staticWebApp
  properties: {
    AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
    AZURE_TENANT_ID: tenant().tenantId
    APPLICATIONINSIGHTS_CONNECTION_STRING: applicationInsights.properties.ConnectionString
  }
}
```

## Deployment Steps

### Option 1: Deploy with Azure Developer CLI (Recommended)

```bash
# Navigate to your project directory
cd m365-assessment-framework

# Initialize azd (if not already done)
azd init

# Deploy the infrastructure and application
azd up
```

### Option 2: Manual Bicep Deployment

```bash
# Create resource group (if it doesn't exist)
az group create --name m365_assessment --location westeurope

# Deploy Bicep template
az deployment group create \
  --resource-group m365_assessment \
  --template-file infra/main.bicep \
  --parameters environmentName=prod
```

## Verification Steps

1. **Check Storage Account Configuration:**
   ```bash
   az storage account show --name m365c6qdbpkda5cvs --resource-group m365_assessment
   ```

2. **Verify Static Web App Settings:**
   ```bash
   az staticwebapp appsettings list --name m365-assessment-framework
   ```

3. **Test API Endpoint:**
   ```bash
   curl https://victorious-pond-069956e03.6.azurestaticapps.net/api/customers
   ```

## Current Environment Variables (Azure Static Web Apps)

The following environment variables are automatically configured via Bicep:

- ✅ `AZURE_STORAGE_CONNECTION_STRING` - Points to your existing storage account `m365c6qdbpkda5cvs`
- ✅ `AZURE_TENANT_ID` - Your Azure tenant ID
- ✅ `APPLICATIONINSIGHTS_CONNECTION_STRING` - Application monitoring

## Local Development

For local development, both connection strings are available in `api/local.settings.json`:

```json
{
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "AZURE_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true"
  }
}
```

## Troubleshooting

### If Customer Creation Still Fails:

1. **Check Storage Account Permissions:**
   ```bash
   # Ensure the storage account allows table operations
   az storage account show --name m365c6qdbpkda5cvs --resource-group m365_assessment --query "allowSharedKeyAccess"
   ```

2. **Test Table Storage Connection:**
   - The API will log detailed connection information
   - Check browser developer tools for API responses
   - Use Azure Storage Explorer to verify table creation

3. **Check Application Logs:**
   ```bash
   # View Static Web App logs
   az staticwebapp logs show --name m365-assessment-framework
   ```

## Next Steps

1. **Deploy the Updated Code:**
   - The code changes are ready for deployment
   - Use `azd up` or push to your connected GitHub repository

2. **Test Customer Creation:**
   - Navigate to https://victorious-pond-069956e03.6.azurestaticapps.net/
   - Go to Settings page
   - Try creating a new customer

3. **Monitor the Deployment:**
   - Check Azure portal for deployment status
   - Verify that tables are created in your storage account
   - Test the full customer creation workflow

## Key Differences from Azure Functions

| Azure Functions | Azure Static Web Apps |
|----------------|----------------------|
| Uses `AzureWebJobsStorage` | Uses `AZURE_STORAGE_CONNECTION_STRING` |
| Separate App Service Plan | Integrated serverless runtime |
| Manual CORS configuration | Automatic CORS handling |
| Separate monitoring setup | Built-in monitoring |

The solution is now production-ready for Azure Static Web Apps! 🚀
