# Azure Static Web Apps Configuration

## Environment Variables Required for Production Deployment

When deploying to Azure Static Web Apps, configure these environment variables in the Azure portal:

### Required Storage Configuration
```
AzureWebJobsStorage = <your-azure-storage-connection-string>
```

### Optional Azure Identity Configuration
```
AZURE_CLIENT_ID = <your-app-registration-client-id>
AZURE_CLIENT_SECRET = <your-app-registration-client-secret>
AZURE_TENANT_ID = <your-azure-tenant-id>
KEY_VAULT_URL = <your-key-vault-url>
```

### How to Configure:

1. **Azure Storage Account**:
   - Create an Azure Storage Account in your resource group
   - Go to "Access keys" and copy the connection string
   - Set `AzureWebJobsStorage` to this connection string

2. **Azure Static Web Apps Environment Variables**:
   - Go to your Static Web App in Azure Portal
   - Navigate to "Configuration" → "Application settings"
   - Add the environment variables above

### Database Tables

The application will automatically create these tables in your Azure Storage Account:
- `customers` - Customer information and app registrations
- `assessments` - Assessment data and results
- `assessmenthistory` - Historical assessment data

### API Endpoints

The following API endpoints will be available at `/api/`:
- `GET/POST /api/customers` - Customer management
- `GET/DELETE /api/customers/{id}` - Individual customer operations
- `GET /api/diagnostics` - System diagnostics
- `GET /api/test` - Health check

### Testing the Deployment

1. **Health Check**: Visit `https://your-app.azurestaticapps.net/api/test`
2. **Diagnostics**: Visit `https://your-app.azurestaticapps.net/api/diagnostics`
3. **Customer Creation**: Use the frontend form to create a test customer

### Differences from Local Development

| Aspect | Local Development | Azure Static Web Apps |
|--------|------------------|----------------------|
| API URL | `http://localhost:7072/api` | `/api` (automatic routing) |
| Storage | Development emulator | Azure Storage Account |
| CORS | Manual headers | Automatic handling |
| Authentication | Optional | Integrated with Azure AD |
| Environment | NODE_ENV=development | NODE_ENV=production |

## Troubleshooting

### Storage Connection Issues
- Verify the `AzureWebJobsStorage` connection string is correct
- Check that the storage account is in the same region as the Static Web App
- Ensure the storage account allows public access or configure appropriate network rules

### API Function Issues
- Check the Function App logs in the Azure Portal
- Verify all required environment variables are set
- Test individual API endpoints using the diagnostics endpoint

### Frontend API Communication
- Browser DevTools → Network tab to see API calls
- Check console for any CORS or connection errors
- Verify the API base URL is correctly set to `/api` in production
