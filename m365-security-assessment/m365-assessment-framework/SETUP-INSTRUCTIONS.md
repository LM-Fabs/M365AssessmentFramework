# M365 Assessment Framework - Setup Instructions

## Azure Service Principal Setup

To enable the multi-tenant app registration functionality, you need to configure a service principal in your partner tenant with the necessary permissions.

### 1. Create Service Principal

```bash
# Login to your partner tenant
az login --tenant YOUR_PARTNER_TENANT_ID

# Create service principal for app registration management
az ad sp create-for-rbac --name "M365AssessmentFramework-AppRegistration" \
  --role "Application Administrator" \
  --scopes "/subscriptions/YOUR_SUBSCRIPTION_ID"
```

### 2. Grant Required Microsoft Graph API Permissions

The service principal needs the following Microsoft Graph API permissions to create app registrations:

- `Application.ReadWrite.All` (Application permission)
- `AppRoleAssignment.ReadWrite.All` (Application permission)
- `Directory.Read.All` (Application permission)

#### Using Azure CLI:
```bash
# Get the service principal object ID
SP_OBJECT_ID=$(az ad sp show --id YOUR_CLIENT_ID --query id -o tsv)

# Grant Microsoft Graph API permissions
az ad app permission add --id YOUR_CLIENT_ID --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions 1bfefb4e-e0b5-418b-a88f-73c46d2cc8e9=Role \
  --api-permissions 06b708a9-e830-4db3-a914-8e69da51d44f=Role \
  --api-permissions 7ab1d382-f21e-4acd-a863-ba3e13f7da61=Role

# Grant admin consent for the permissions
az ad app permission admin-consent --id YOUR_CLIENT_ID
```

#### Using Azure Portal:
1. Go to Azure Portal → Azure Active Directory → App registrations
2. Find your service principal app
3. Go to API permissions → Add a permission → Microsoft Graph → Application permissions
4. Add the required permissions listed above
5. Click "Grant admin consent for [Your Tenant]"

### 3. Configure Local Settings

Update your `api/local.settings.json` with the service principal credentials:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "AZURE_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsFeatureFlags": "EnableWorkerIndexing",
    
    "KEY_VAULT_URL": "https://your-keyvault.vault.azure.net/",
    
    "FRONTEND_URL": "https://localhost:3000",
    "BACKEND_URL": "https://localhost:7071",
    
    "AZURE_CLIENT_ID": "YOUR_SERVICE_PRINCIPAL_CLIENT_ID",
    "AZURE_CLIENT_SECRET": "YOUR_SERVICE_PRINCIPAL_CLIENT_SECRET", 
    "AZURE_TENANT_ID": "YOUR_PARTNER_TENANT_ID"
  },
  "Host": {
    "CORS": "*"
  }
}
```

### 4. Test the Configuration

1. Start the API: `npm start` in the `api/` folder
2. Start the frontend: `npm start` in the root folder
3. Navigate to Settings → Customer Management
4. Create a test customer and try the "Create App Registration" button

### 5. Security Considerations

⚠️ **Important Security Notes:**
- The client secret should eventually be stored in Azure Key Vault, not in local settings
- Implement credential rotation for production deployments
- Monitor and audit app registration activities
- Use least privilege principle for service principal permissions

## Key Vault Setup (Optional but Recommended)

For production, store the client secret in Azure Key Vault:

1. Create a Key Vault in your Azure subscription
2. Add the client secret as a secret
3. Grant your service principal "Key Vault Secrets User" role
4. Update the `keyVaultService.ts` to retrieve the secret instead of using environment variables

## Troubleshooting

### Common Issues:

1. **"Insufficient privileges" error**: 
   - Ensure your service principal has "Application Administrator" role
   - Verify Microsoft Graph API permissions are granted with admin consent

2. **"Authentication failed" error**:
   - Check that AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID are correct
   - Verify the service principal credentials are not expired

3. **"Consent URL not opening" error**:
   - Check browser popup blocker settings
   - Verify the frontend can reach the backend API

4. **"Customer tenant not found" error**:
   - Ensure the customer tenant domain is correct
   - Verify the customer tenant exists and is accessible