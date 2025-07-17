# Quick Deployment Commands

## Deploy with Private Endpoints (Secure Configuration)

```bash
# Initialize environment (if not already done)
azd init

# Deploy with private endpoints enabled
azd deploy --parameters ./infra/main.private-endpoints.parameters.json

# Or use the convenience script
./deploy-private-endpoints.sh
```

## Deploy with Public Access (Development/Testing)

```bash
# Initialize environment (if not already done)
azd init

# Deploy with default parameters (public access)
azd deploy
```

## Switch Between Configurations

### Enable Private Endpoints
```bash
azd deploy --parameters ./infra/main.private-endpoints.parameters.json
```

### Disable Private Endpoints (Re-enable Public Access)
```bash
azd deploy --parameters ./infra/main.parameters.json
```

## Environment Variables

After deployment, get the required environment variables:
```bash
azd env get-values
```

Key variables for database connection:
- `POSTGRES_HOST`: Database hostname (private or public)
- `AZURE_CLIENT_ID`: Service principal client ID
- `AZURE_TENANT_ID`: Azure tenant ID

## Validation

Test the deployment:
```bash
# Check if API is responding
curl https://$(azd env get-value STATIC_WEB_APP_HOSTNAME)/api/health

# Check database connectivity (from Azure portal console)
# Navigate to your Static Web App → Functions → Console
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DATABASE
```
