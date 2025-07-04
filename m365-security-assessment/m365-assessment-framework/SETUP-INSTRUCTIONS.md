# Local Development Setup Instructions

This guide helps you set up the M365 Assessment Framework for local development.

## Prerequisites

1. Node.js (version 18 or higher)
2. Azure Functions Core Tools v4
3. Azure CLI
4. An Azure subscription with appropriate permissions

## Azure Service Principal Setup

Before running locally, you need to create an Azure Service Principal that can create app registrations.

### 1. Create Service Principal

```bash
# Login to Azure
az login

# Create service principal with Contributor role
az ad sp create-for-rbac \
  --name "M365AssessmentFramework-Dev" \
  --role "Contributor" \
  --scopes "/subscriptions/YOUR_SUBSCRIPTION_ID"
```

### 2. Grant Additional Permissions

The service principal needs permission to create app registrations:

```bash
# Get the service principal ID
$spId = az ad sp list --display-name "M365AssessmentFramework-Dev" --query "[0].id" -o tsv

# Grant Application.ReadWrite.All permission (requires admin consent)
az ad app permission add \
  --id YOUR_SP_CLIENT_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions 1bfefb4e-e0b5-418b-a88f-73c46d2cc8e9=Role

# Grant admin consent (requires Global Administrator role)
az ad app permission admin-consent --id YOUR_SP_CLIENT_ID
```

## Local Configuration

### 1. Update local.settings.json

Edit `api/local.settings.json` and replace the placeholder values:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "AZURE_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsFeatureFlags": "EnableWorkerIndexing",
    
    "AZURE_CLIENT_ID": "your-actual-client-id-here",
    "AZURE_CLIENT_SECRET": "your-actual-client-secret-here", 
    "AZURE_TENANT_ID": "your-actual-tenant-id-here"
  }
}
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install API dependencies
cd api
npm install
cd ..
```

## Running the Application

### 1. Start the Azure Functions API

```bash
cd api
func start
```

The API will be available at `http://localhost:7071`

### 2. Start the React Frontend

In a new terminal:

```bash
npm start
```

The frontend will be available at `http://localhost:3000`

## Testing the Setup

1. Open `http://localhost:3000` in your browser
2. Navigate to Settings page
3. Try creating a new customer with:
   - Tenant Name: "Test Company"
   - Tenant Domain: "testcompany.onmicrosoft.com"
   - Tenant ID: Leave empty (it will use the domain)
4. Click "Create App Registration" to test the Azure AD integration

## Configuration Check

Visit `http://localhost:7071/api/azure-config` to verify your Azure configuration is correct.

Expected response for properly configured environment:
```json
{
  "success": true,
  "message": "All Azure services configured correctly",
  "data": {
    "environment": {
      "AZURE_CLIENT_ID": "SET",
      "AZURE_CLIENT_SECRET": "SET", 
      "AZURE_TENANT_ID": "SET"
    }
  }
}
```

## Troubleshooting

### "Missing required environment variables" Error

- Check that all three Azure credentials are set in `api/local.settings.json`
- Restart the Azure Functions host after updating the file
- Verify the service principal exists: `az ad sp show --id YOUR_CLIENT_ID`

### "Failed to create multi-tenant app" Error

- Ensure the service principal has `Application.ReadWrite.All` permission
- Check that admin consent has been granted
- Verify the service principal is not disabled or expired

### "Authentication failed" Error

- Verify the client secret is correct and not expired
- Check that the tenant ID matches your Azure AD tenant
- Ensure the client ID is correct

### Permission Issues

If you get permission errors:
1. Verify you have Global Administrator role or Application Administrator role
2. Check that the service principal permissions are granted
3. Ensure admin consent has been provided for the Microsoft Graph permissions

## Next Steps

After successful local setup:
1. Test customer creation and app registration creation
2. Review the generated consent URLs
3. Test the assessment flow with a real Microsoft 365 tenant
4. Deploy to Azure using the GitHub Actions workflow

For production deployment, see `DEPLOYMENT.md`.
