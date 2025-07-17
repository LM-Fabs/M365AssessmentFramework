# Private Endpoint Security Implementation Guide

## Overview

This guide provides a comprehensive solution for securing database access using Azure Private Endpoints, eliminating the need for external firewall rules while maintaining secure connectivity between your Azure Static Web Apps and PostgreSQL database.

## Security Architecture

### Current Implementation with Private Endpoints

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Static Web Apps   │    │   Virtual Network    │    │   PostgreSQL        │
│                     │    │                      │    │   Flexible Server   │
│  ┌───────────────┐  │    │  ┌─────────────────┐ │    │                     │
│  │   Frontend    │  │    │  │ Private Endpoint│ │    │  ┌───────────────┐  │
│  └───────────────┘  │◄──►│  │                 │ │◄──►│  │   Database    │  │
│  ┌───────────────┐  │    │  └─────────────────┘ │    │  └───────────────┘  │
│  │   API Functions │  │    │                      │    │                     │
│  └───────────────┘  │    │  ┌─────────────────┐ │    │  Public Access:     │
│                     │    │  │ Private DNS Zone│ │    │  ❌ DISABLED        │
│  VNet Integration   │    │  │                 │ │    │                     │
│  🔒 REQUIRED        │    │  └─────────────────┘ │    │  Private Access:    │
└─────────────────────┘    └──────────────────────┘    │  ✅ ENABLED         │
                                                       └─────────────────────┘
```

### Security Benefits

1. **Zero External Exposure**: PostgreSQL database has no public IP address
2. **Network Isolation**: Traffic flows through private Azure backbone
3. **DNS Security**: Private DNS zone prevents DNS hijacking
4. **Azure AD Authentication**: Service principal-based database access
5. **Managed Identity**: No stored credentials in application code

## Implementation Components

### 1. Infrastructure (Bicep Templates)

#### Main Template (`main.bicep`)
- Conditionally deploys private endpoints based on `enablePrivateEndpoints` parameter
- Automatically disables public network access when private endpoints are enabled
- Configures Azure AD authentication for PostgreSQL

#### Private Endpoint Template (`private-endpoint.bicep`)
- Creates Virtual Network with dedicated subnets
- Deploys Private Endpoint for PostgreSQL
- Configures Private DNS Zone for name resolution
- Sets up VNet Link for DNS resolution

### 2. Network Configuration

#### Virtual Network Subnets
```
VNet: 10.0.0.0/16
├── private-endpoints: 10.0.1.0/24 (Private Endpoint resources)
└── static-web-apps: 10.0.2.0/24 (Static Web Apps delegation)
```

#### DNS Configuration
- **Private DNS Zone**: `privatelink.postgres.database.azure.com`
- **Automatic Registration**: Private endpoint IP automatically registered
- **VNet Link**: Ensures proper name resolution within the virtual network

### 3. Application Configuration

#### Connection String Format
```javascript
// Updated connection string for private endpoint access
const connectionString = `postgresql://${username}@${privateEndpointFQDN}:5432/${database}?sslmode=require`;
```

#### Environment Variables
```bash
# Private endpoint configuration
POSTGRES_HOST=psql-xxxxxx.privatelink.postgres.database.azure.com
POSTGRES_PORT=5432
POSTGRES_DATABASE=m365_assessment
POSTGRES_USER=assessment_admin

# Azure authentication
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Deployment Instructions

### Option 1: Deploy New Infrastructure with Private Endpoints

```bash
# Deploy with private endpoints enabled
./deploy-private-endpoints.sh
```

### Option 2: Update Existing Infrastructure

1. **Update parameters file**:
   ```json
   {
     "enablePrivateEndpoints": {
       "value": true
     },
     "publicNetworkAccess": {
       "value": "Disabled"
     }
   }
   ```

2. **Deploy updates**:
   ```bash
   azd deploy --parameters ./infra/main.private-endpoints.parameters.json
   ```

### Option 3: Manual Azure CLI Deployment

```bash
# Create resource group
az group create --name rg-m365-assessment --location eastus

# Deploy infrastructure
az deployment group create \
  --resource-group rg-m365-assessment \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.private-endpoints.parameters.json
```

## Static Web Apps VNet Integration

### Requirements
- **SKU**: Standard or higher (Free tier doesn't support VNet integration)
- **Regional VNet Integration**: Required for private endpoint access

### Configuration Steps

1. **Enable VNet Integration** (Azure Portal):
   ```
   Static Web Apps → Networking → VNet Integration → Add VNet Integration
   ```

2. **Select Subnet**:
   - Choose the `static-web-apps` subnet created by the infrastructure
   - Ensure delegation to `Microsoft.Web/staticSites`

3. **Verify Connectivity**:
   ```bash
   # Test from Static Web Apps console
   nslookup psql-xxxxxx.privatelink.postgres.database.azure.com
   ```

## Security Validation

### 1. Network Access Test
```bash
# Should fail - no public access
psql -h psql-xxxxxx.postgres.database.azure.com -U assessment_admin -d m365_assessment

# Should succeed from within VNet
psql -h psql-xxxxxx.privatelink.postgres.database.azure.com -U assessment_admin -d m365_assessment
```

### 2. DNS Resolution Test
```bash
# From within VNet
nslookup psql-xxxxxx.privatelink.postgres.database.azure.com
# Should return private IP (10.0.1.x)

# From public internet
nslookup psql-xxxxxx.postgres.database.azure.com
# Should return public IP (but connection will fail)
```

### 3. Application Connectivity Test
```javascript
// Test database connection in API function
const testConnection = async () => {
  try {
    const client = new Client({
      connectionString: process.env.POSTGRES_CONNECTION_STRING
    });
    await client.connect();
    const result = await client.query('SELECT version()');
    console.log('✅ Database connection successful');
    await client.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
};
```

## Troubleshooting

### Common Issues

#### 1. Static Web Apps Cannot Connect to Database
**Symptoms**: Connection timeouts, DNS resolution failures
**Solutions**:
- Verify VNet integration is enabled and configured
- Check that Static Web Apps is using Standard SKU or higher
- Ensure subnet delegation is properly configured

#### 2. DNS Resolution Issues
**Symptoms**: Cannot resolve private endpoint FQDN
**Solutions**:
- Verify Private DNS Zone is linked to VNet
- Check DNS zone records for private endpoint
- Restart Static Web Apps to refresh DNS cache

#### 3. Authentication Failures
**Symptoms**: Authentication errors despite correct credentials
**Solutions**:
- Verify service principal has been created as PostgreSQL user
- Check Azure AD authentication is enabled on PostgreSQL server
- Validate Azure AD token acquisition in application logs

### Diagnostic Commands

```bash
# Check private endpoint status
az network private-endpoint show --name pe-postgres-xxxxx --resource-group rg-m365-assessment

# Check DNS zone records
az network private-dns zone show --name privatelink.postgres.database.azure.com --resource-group rg-m365-assessment

# Check VNet integration
az staticwebapp show --name swa-xxxxx --query "properties.virtualNetworkSubnetId"

# Test connectivity from Static Web Apps
# (Use the console in Azure Portal)
curl -v telnet://psql-xxxxx.privatelink.postgres.database.azure.com:5432
```

## Cost Considerations

### Private Endpoint Costs
- **Private Endpoint**: ~$7.30/month per endpoint
- **Data Processing**: $0.10/GB processed
- **VNet Integration**: Included with Standard Static Web Apps

### Cost Optimization
- Use single private endpoint for multiple database connections
- Monitor data transfer costs with Azure Cost Management
- Consider using Basic tier PostgreSQL for development environments

## Migration from Public Access

### 1. Preparation
```bash
# Backup current database
pg_dump -h current-server.postgres.database.azure.com -U admin -d m365_assessment > backup.sql
```

### 2. Deploy Private Endpoints
```bash
# Deploy with private endpoints
./deploy-private-endpoints.sh
```

### 3. Update Application Configuration
```bash
# Update environment variables
azd env set POSTGRES_HOST psql-xxxxx.privatelink.postgres.database.azure.com
```

### 4. Verify and Test
```bash
# Test application functionality
curl https://your-static-web-app.azurestaticapps.net/api/customers
```

## Best Practices

### Security
1. **Disable Public Access**: Always set `publicNetworkAccess` to `Disabled`
2. **Use Azure AD**: Prefer Azure AD authentication over SQL authentication
3. **Rotate Credentials**: Regularly rotate service principal credentials
4. **Monitor Access**: Use Azure Monitor to track database access patterns

### Network Design
1. **Subnet Planning**: Use dedicated subnets for private endpoints
2. **DNS Management**: Use Azure Private DNS for consistent name resolution
3. **Network Segmentation**: Implement network security groups for additional security

### Operational
1. **Monitoring**: Set up alerts for private endpoint connectivity
2. **Backup Strategy**: Ensure backup procedures work with private endpoints
3. **Disaster Recovery**: Plan for cross-region private endpoint deployment

## Additional Resources

- [Azure Private Endpoints Documentation](https://docs.microsoft.com/en-us/azure/private-link/private-endpoint-overview)
- [Static Web Apps VNet Integration](https://docs.microsoft.com/en-us/azure/static-web-apps/virtual-network-integration)
- [PostgreSQL Flexible Server Private Access](https://docs.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-private-access-vnet)
- [Azure AD Authentication for PostgreSQL](https://docs.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-azure-ad-authentication)

---

## Support

For issues with this implementation:
1. Check the troubleshooting section above
2. Review Azure Activity Logs for deployment errors
3. Use Azure Support for Azure-specific issues
4. Submit issues to the project repository for application-specific problems
