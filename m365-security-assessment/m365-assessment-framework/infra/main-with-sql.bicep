@description('Name of the environment (e.g., dev, staging, prod)')
param environmentName string

@description('Primary location for all resources')
param location string = resourceGroup().location

@description('Whether to use SQL Database instead of Table Storage')
param useSqlDatabase bool = false

@description('SQL Admin username (required if useSqlDatabase is true)')
param sqlAdminUsername string = 'sqladmin'

@description('SQL Admin password (required if useSqlDatabase is true)')
@secure()
param sqlAdminPassword string = ''

// Generate a unique suffix based on environment and subscription
var resourceToken = toLower(uniqueString(subscription().id, environmentName))
var resourcePrefix = 'm365'

// Tags for all resources
var tags = {
  'azd-env-name': environmentName
  project: 'M365SecurityAssessment'
  environment: environmentName
}

// Log Analytics Workspace for monitoring
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${resourcePrefix}-logs-${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      searchVersion: 1
    }
  }
}

// Application Insights for application monitoring
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${resourcePrefix}-insights-${resourceToken}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Storage Account for Azure Functions
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${resourcePrefix}${resourceToken}'
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    encryption: {
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

// Key Vault for storing secrets
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${resourcePrefix}-kv-${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enableRbacAuthorization: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

// User Assigned Managed Identity for Function App
resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${resourcePrefix}-identity-${resourceToken}'
  location: location
  tags: tags
}

// SQL Server and Database (conditional)
module sqlDatabase 'sql-database.bicep' = if (useSqlDatabase) {
  name: 'sqlDatabase'
  params: {
    environmentName: environmentName
    location: location
    sqlAdminUsername: sqlAdminUsername
    sqlAdminPassword: sqlAdminPassword
    userAssignedIdentityId: userAssignedIdentity.id
    userAssignedIdentityPrincipalId: userAssignedIdentity.properties.principalId
  }
}

// Static Web App for frontend
resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: 'm365-assessment-framework'
  location: location
  tags: union(tags, {
    'azd-service-name': 'm365-assessment-frontend'
  })
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/'
      apiLocation: 'api'
      outputLocation: 'build'
    }
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

// Configure application settings for Static Web App API functions
resource staticWebAppConfigTableStorage 'Microsoft.Web/staticSites/config@2024-04-01' = if (!useSqlDatabase) {
  name: 'appsettings'
  parent: staticWebApp
  properties: {
    AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
    AZURE_TENANT_ID: tenant().tenantId
    APPLICATIONINSIGHTS_CONNECTION_STRING: applicationInsights.properties.ConnectionString
    KEY_VAULT_URL: keyVault.properties.vaultUri
    DATABASE_TYPE: 'TABLE_STORAGE'
  }
}

resource staticWebAppConfigSql 'Microsoft.Web/staticSites/config@2024-04-01' = if (useSqlDatabase) {
  name: 'appsettings'
  parent: staticWebApp
  properties: {
    AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
    AZURE_TENANT_ID: tenant().tenantId
    APPLICATIONINSIGHTS_CONNECTION_STRING: applicationInsights.properties.ConnectionString
    KEY_VAULT_URL: keyVault.properties.vaultUri
    DATABASE_TYPE: 'SQL'
    SQL_SERVER_NAME: useSqlDatabase ? sqlDatabase!.outputs.sqlServerFqdn : ''
    SQL_DATABASE_NAME: useSqlDatabase ? sqlDatabase!.outputs.sqlDatabaseName : ''
    SQL_CONNECTION_STRING: useSqlDatabase ? sqlDatabase!.outputs.sqlConnectionString : ''
  }
}

// Role assignments for managed identity
resource keyVaultSecretsUserRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User
}

resource storageTableDataContributorRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3' // Storage Table Data Contributor
}

// Assign Key Vault Secrets User role to managed identity
resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, userAssignedIdentity.id, keyVaultSecretsUserRole.id)
  properties: {
    roleDefinitionId: keyVaultSecretsUserRole.id
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Storage Table Data Contributor role to managed identity (for Table Storage)
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!useSqlDatabase) {
  scope: storageAccount
  name: guid(storageAccount.id, userAssignedIdentity.id, storageTableDataContributorRole.id)
  properties: {
    roleDefinitionId: storageTableDataContributorRole.id
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// SQL Database Reader role assignment (conditional)
resource sqlDbContributorRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = if (useSqlDatabase) {
  scope: subscription()
  name: '9b7fa17d-e63e-47b0-bb0a-15c516ac86ec' // SQL DB Contributor
}

resource sqlRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (useSqlDatabase) {
  scope: resourceGroup()
  name: guid(resourceGroup().id, userAssignedIdentity.id, sqlDbContributorRole.id)
  properties: {
    roleDefinitionId: sqlDbContributorRole.id
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Output values
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_STORAGE_CONNECTION_STRING string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
output APPLICATIONINSIGHTS_CONNECTION_STRING string = applicationInsights.properties.ConnectionString
output KEY_VAULT_URL string = keyVault.properties.vaultUri
output DATABASE_TYPE string = useSqlDatabase ? 'SQL' : 'TABLE_STORAGE'
output STATIC_WEB_APP_NAME string = staticWebApp.name
output STATIC_WEB_APP_URL string = 'https://${staticWebApp.properties.defaultHostname}'
output USER_ASSIGNED_IDENTITY_ID string = userAssignedIdentity.id
output USER_ASSIGNED_IDENTITY_CLIENT_ID string = userAssignedIdentity.properties.clientId

// Conditional SQL outputs
output SQL_SERVER_NAME string = useSqlDatabase ? sqlDatabase!.outputs.sqlServerName : ''
output SQL_DATABASE_NAME string = useSqlDatabase ? sqlDatabase!.outputs.sqlDatabaseName : ''
output SQL_CONNECTION_STRING string = useSqlDatabase ? sqlDatabase!.outputs.sqlConnectionString : ''
output SQL_SERVER_FQDN string = useSqlDatabase ? sqlDatabase!.outputs.sqlServerFqdn : ''
