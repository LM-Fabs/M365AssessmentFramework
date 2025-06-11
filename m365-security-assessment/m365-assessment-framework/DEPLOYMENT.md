# GitHub Actions Deployment Setup

This document explains how to set up GitHub Actions to deploy your M365 Assessment Framework to Azure and resolve the 404 API errors.

## Prerequisites

1. Azure subscription with appropriate permissions
2. GitHub repository with your code
3. Azure service principal or managed identity for authentication

## GitHub Repository Setup

### 1. Configure GitHub Secrets and Variables

#### Required GitHub Secrets:
Navigate to your repository → Settings → Secrets and variables → Actions

**Secrets:**
- `AZURE_CLIENT_ID`: Your Azure service principal client ID
- `AZURE_CLIENT_SECRET`: Your Azure service principal client secret  
- `AZURE_TENANT_ID`: Your Azure tenant ID
- `AZURE_SUBSCRIPTION_ID`: Your Azure subscription ID

**Variables:**
- `AZURE_ENV_NAME`: Environment name (e.g., "prod", "dev", "test")
- `AZURE_LOCATION`: Azure region (e.g., "eastus", "westeurope")

### 2. Create Azure Service Principal

Run this command in Azure CLI to create a service principal:

```bash
az ad sp create-for-rbac \
  --name "M365AssessmentFramework-GitHub" \
  --role "Contributor" \
  --scopes "/subscriptions/YOUR_SUBSCRIPTION_ID" \
  --sdk-auth
```

Use the output to populate your GitHub secrets.

### 3. Grant Additional Permissions

The service principal needs these additional role assignments:

```bash
# User Access Administrator (for role assignments in Bicep)
az role assignment create \
  --assignee YOUR_CLIENT_ID \
  --role "User Access Administrator" \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID"

# Key Vault Administrator (for managing Key Vault)
az role assignment create \
  --assignee YOUR_CLIENT_ID \
  --role "Key Vault Administrator" \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID"
```

## Deployment Process

### What the GitHub Action Does:

1. **Infrastructure Provisioning**: Creates all Azure resources using Bicep:
   - Azure Function App (for your API)
   - Static Web App (for your frontend)
   - Cosmos DB (for data storage)
   - Key Vault (for secrets)
   - Storage Account (for Function App)
   - Application Insights (for monitoring)

2. **Application Deployment**: 
   - Builds and deploys your React frontend
   - Builds and deploys your Azure Functions API
   - Configures CORS and environment variables

3. **Validation**: Checks deployment status and outputs URLs

### Triggering Deployment:

The workflow runs automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main`
- Manual trigger via GitHub Actions UI

## Resolving the 404 Error

The 404 error you're experiencing occurs because your Azure Functions API isn't deployed to Azure yet. This GitHub Actions workflow will:

1. **Deploy your Functions**: The API endpoints (`/api/customers`, etc.) will be available at your Function App URL
2. **Configure the frontend**: The React app will be configured with the correct API URL
3. **Set up CORS**: Proper cross-origin requests between frontend and API

After successful deployment, your customer creation will work because:
- The Function App will be running in Azure
- The `/api/customers` endpoint will be accessible
- The frontend will point to the correct Azure API URL instead of localhost

## Monitoring Deployment

1. Check GitHub Actions tab in your repository
2. Monitor the deployment logs
3. After successful deployment, the workflow outputs the application URLs
4. Test customer creation functionality with the deployed endpoints

## Environment Configuration

The deployment creates different environments based on the branch:
- `main` branch → `production` environment
- Other branches → `development` environment

Each environment can have different Azure resources and configurations.

## Troubleshooting

If deployment fails:
1. Check GitHub Actions logs for detailed error messages
2. Verify all secrets and variables are correctly set
3. Ensure service principal has required permissions
4. Check Azure resource quotas in your target region

The GitHub Actions workflow includes automatic log collection on failure to help with debugging.