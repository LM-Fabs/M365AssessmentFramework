@description('Name of the environment (e.g., dev, staging, prod)')
param environmentName string

@description('Primary location for all resources')
param location string = resourceGroup().location

@description('Admin username for SQL Server')
param sqlAdminUsername string = 'sqladmin'

@description('Admin password for SQL Server')
@secure()
param sqlAdminPassword string

@description('User-assigned managed identity ID')
param userAssignedIdentityId string

@description('User-assigned managed identity principal ID')
param userAssignedIdentityPrincipalId string

// Generate a unique suffix based on environment and subscription
var resourceToken = toLower(uniqueString(subscription().id, environmentName))
var resourcePrefix = 'm365'

// Tags for all resources
var tags = {
  'azd-env-name': environmentName
  project: 'M365SecurityAssessment'
  environment: environmentName
}

// SQL Server
resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: '${resourcePrefix}-sql-${resourceToken}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentityId}': {}
    }
  }
  properties: {
    administratorLogin: sqlAdminUsername
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'Application'
      login: 'ManagedIdentity'
      sid: userAssignedIdentityPrincipalId
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: false
    }
  }
}

// SQL Database - Serverless
resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: '${resourcePrefix}-assessment-db-${resourceToken}'
  location: location
  tags: tags
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 1
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 34359738368 // 32 GB
    catalogCollation: 'SQL_Latin1_General_CP1_CI_AS'
    zoneRedundant: false
    readScale: 'Disabled'
    requestedBackupStorageRedundancy: 'Local'
    autoPauseDelay: 60 // Auto-pause after 1 hour of inactivity
    minCapacity: json('0.5') // Minimum 0.5 vCores
  }
}

// Allow Azure services to access the SQL Server
resource sqlFirewallRule 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Output values
output sqlServerName string = sqlServer.name
output sqlDatabaseName string = sqlDatabase.name
output sqlConnectionString string = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${sqlDatabase.name};Authentication=Active Directory Managed Identity;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
