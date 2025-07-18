targetScope = 'resourceGroup'

metadata description = 'M365 Security Assessment Framework - PostgreSQL Flexible Server Infrastructure'

@description('Environment name (e.g., dev, staging, prod)')
param environmentName string

@description('Azure region for resource deployment')
param location string = resourceGroup().location

@description('PostgreSQL administrator username')
param postgresqlAdminUsername string = 'assessment_admin'

@description('PostgreSQL administrator password')
@secure()
param postgresqlAdminPassword string

@description('PostgreSQL database name')
param databaseName string = 'm365_assessment'

@description('PostgreSQL server version')
param postgresqlVersion string = '16'

@description('PostgreSQL SKU name (Basic tier for cost optimization)')
param postgresqlSkuName string = 'Standard_B1ms'

@description('PostgreSQL storage size in GB')
param postgresqlStorageSize int = 32

@description('Backup retention days')
param backupRetentionDays int = 7

@description('Enable geo-redundant backup')
param geoRedundantBackup string = 'Disabled'

@description('Enable high availability')
param highAvailabilityMode string = 'Disabled'

@description('Enable public network access')
param publicNetworkAccess string = 'Enabled'

@description('Enable private endpoints for secure database access')
param enablePrivateEndpoints bool = false

@description('Static web app name')
param staticWebAppName string = 'swa-${environmentName}'

@description('Static web app SKU')
param staticWebAppSku string = 'Standard'

@description('Application Insights name')
param appInsightsName string = 'appi-${environmentName}'

@description('Log Analytics workspace name')
param logAnalyticsName string = 'law-${environmentName}'

@description('Key Vault name')
param keyVaultName string = 'kv-${environmentName}'

// Create resource token for unique naming
var resourceToken = toLower(uniqueString(subscription().id, environmentName))

// Resource names with resource token
var postgresqlServerName = 'psql-${resourceToken}'
var staticSiteName = '${staticWebAppName}-${resourceToken}'
var appInsightsResourceName = '${appInsightsName}-${resourceToken}'
var logAnalyticsResourceName = '${logAnalyticsName}-${resourceToken}'
var keyVaultResourceName = '${keyVaultName}-${resourceToken}'

// User-assigned managed identity for PostgreSQL authentication
var userAssignedIdentityName = 'id-${resourceToken}'

// Tags for all resources
var tags = {
  'azd-env-name': environmentName
  project: 'M365SecurityAssessment'
  environment: environmentName
  'deployment-tool': 'azd'
}

// Create User-Assigned Managed Identity
resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: userAssignedIdentityName
  location: location
  tags: tags
}

// Create Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsResourceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: 1
    }
  }
}

// Create Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsResourceName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: 30
    IngestionMode: 'LogAnalytics'
  }
}

// Create Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultResourceName
  location: location
  tags: tags
  properties: {
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: true  // Changed to true as required
    tenantId: subscription().tenantId
    accessPolicies: []
    sku: {
      name: 'standard'
      family: 'A'
    }
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
    publicNetworkAccess: 'Enabled'
    enableRbacAuthorization: true
  }
}

// Create PostgreSQL Flexible Server
resource postgresqlServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresqlServerName
  location: location
  tags: tags
  
  // Configure managed identity for authentication
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentity.id}': {}
    }
  }
  
  sku: {
    name: postgresqlSkuName
    tier: 'Burstable'
  }
  
  properties: {
    createMode: 'Default'
    version: postgresqlVersion
    administratorLogin: postgresqlAdminUsername
    administratorLoginPassword: postgresqlAdminPassword
    
    // Authentication configuration
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Enabled'
      tenantId: subscription().tenantId
    }
    
    // Storage configuration
    storage: {
      storageSizeGB: postgresqlStorageSize
      autoGrow: 'Enabled'
      tier: 'P4'
    }
    
    // Backup configuration
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: geoRedundantBackup
    }
    
    // High availability configuration
    highAvailability: {
      mode: highAvailabilityMode
    }
    
    // Network configuration
    network: {
      publicNetworkAccess: enablePrivateEndpoints ? 'Disabled' : publicNetworkAccess
    }
    
    // Maintenance window (optional)
    maintenanceWindow: {
      customWindow: 'Enabled'
      dayOfWeek: 6 // Saturday
      startHour: 3
      startMinute: 0
    }
  }
}

// Create PostgreSQL Database
resource postgresqlDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  name: databaseName
  parent: postgresqlServer
  properties: {
    charset: 'UTF8'
    collation: 'en_US.UTF8'
  }
}

// Create PostgreSQL Firewall Rules for Azure Services (only when private endpoints are disabled)
resource postgresqlFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = if (!enablePrivateEndpoints) {
  name: 'AllowAllAzureServices'
  parent: postgresqlServer
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Create Static Web App with managed identity
resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: staticSiteName
  location: location
  tags: union(tags, {
    'azd-service-name': 'm365-assessment-api'
  })
  
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentity.id}': {}
    }
  }
  
  sku: {
    name: staticWebAppSku
    tier: staticWebAppSku
  }
  
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    publicNetworkAccess: 'Enabled'
    enterpriseGradeCdnStatus: 'Disabled'
    
    // Build properties for the static web app
    buildProperties: {
      appLocation: '/m365-assessment-framework'
      apiLocation: '/m365-assessment-framework/api'
      outputLocation: 'build'
      appBuildCommand: 'npm run build'
      apiBuildCommand: 'npm run build'
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// Deploy private endpoints if enabled
module privateEndpoints 'private-endpoint.bicep' = if (enablePrivateEndpoints) {
  name: 'privateEndpoints'
  params: {
    location: location
    environmentName: environmentName
    postgresServerName: postgresqlServer.name
    postgresResourceGroup: resourceGroup().name
    subscriptionId: subscription().subscriptionId
    resourceToken: resourceToken
  }
}

// Store PostgreSQL connection string in Key Vault
resource postgresqlConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'postgresql-connection-string'
  parent: keyVault
  properties: {
    value: 'postgresql://${postgresqlAdminUsername}@${postgresqlServer.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'
    contentType: 'text/plain'
  }
}

// Role assignment: Key Vault Secrets User for Static Web App
resource keyVaultSecretsUserRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, userAssignedIdentity.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Configure Static Web App settings
resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2024-04-01' = {
  name: 'appsettings'
  parent: staticWebApp
  properties: {
    // PostgreSQL connection settings
    POSTGRES_HOST: postgresqlServer.properties.fullyQualifiedDomainName
    POSTGRES_PORT: '5432'
    POSTGRES_DATABASE: databaseName
    POSTGRES_USER: postgresqlAdminUsername
    NODE_ENV: 'production'
    
    // Azure services configuration
    AZURE_CLIENT_ID: userAssignedIdentity.properties.clientId
    AZURE_TENANT_ID: subscription().tenantId
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
    
    // Key Vault reference for connection string
    POSTGRES_CONNECTION_STRING: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=postgresql-connection-string)'
  }
}

// Outputs for deployment verification
output postgresqlServerName string = postgresqlServer.name
output postgresqlServerHost string = postgresqlServer.properties.fullyQualifiedDomainName
output postgresqlDatabaseName string = postgresqlDatabase.name
output staticWebAppName string = staticWebApp.name
output staticWebAppHostname string = staticWebApp.properties.defaultHostname
output userAssignedIdentityName string = userAssignedIdentity.name
output userAssignedIdentityClientId string = userAssignedIdentity.properties.clientId
output keyVaultName string = keyVault.name
output appInsightsName string = appInsights.name
output logAnalyticsName string = logAnalytics.name
output resourceGroupName string = resourceGroup().name
output environmentName string = environmentName

// Service-specific outputs for AZD
output POSTGRES_HOST string = postgresqlServer.properties.fullyQualifiedDomainName
output POSTGRES_PORT string = '5432'
output POSTGRES_DATABASE string = databaseName
output POSTGRES_USER string = postgresqlAdminUsername
output AZURE_CLIENT_ID string = userAssignedIdentity.properties.clientId
output AZURE_TENANT_ID string = subscription().tenantId
