@description('Name of the environment (e.g., dev, staging, prod)')
param environmentName string

@description('Primary location for all resources')
param location string = resourceGroup().location

@description('Azure tenant ID for Graph API access')
param azureTenantId string = ''

@description('Azure client ID for Graph API access')
param azureClientId string = ''

@description('Azure client secret for Graph API access')
@secure()
param azureClientSecret string = ''

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

// Cosmos DB for storing assessment data - temporarily disabled due to resource provider registration
// resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
//   name: '${resourcePrefix}-cosmos-${resourceToken}'
//   location: location
//   tags: tags
//   kind: 'GlobalDocumentDB'
//   properties: {
//     databaseAccountOfferType: 'Standard'
//     enableFreeTier: true
//     consistencyPolicy: {
//       defaultConsistencyLevel: 'Session'
//     }
//     locations: [
//       {
//         locationName: location
//         failoverPriority: 0
//         isZoneRedundant: false
//       }
//     ]
//     capabilities: [
//       {
//         name: 'EnableServerless'
//       }
//     ]
//     publicNetworkAccess: 'Enabled'
//     enableAnalyticalStorage: false
//     enableAutomaticFailover: false
//     enableMultipleWriteLocations: false
//     isVirtualNetworkFilterEnabled: false
//     virtualNetworkRules: []
//     ipRules: []
//     cors: []
//     backupPolicy: {
//       type: 'Periodic'
//       periodicModeProperties: {
//         backupIntervalInMinutes: 240
//         backupRetentionIntervalInHours: 8
//         backupStorageRedundancy: 'Local'
//       }
//     }
//   }
// }

// // Cosmos DB Database
// resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
//   parent: cosmosDbAccount
//   name: 'm365assessment'
//   properties: {
//     resource: {
//       id: 'm365assessment'
//     }
//   }
// }

// // Customers Container
// resource customersContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
//   parent: cosmosDatabase
//   name: 'customers'
//   properties: {
//     resource: {
//       id: 'customers'
//       partitionKey: {
//         paths: ['/tenantDomain']
//         kind: 'Hash'
//       }
//       indexingPolicy: {
//         indexingMode: 'consistent'
//         automatic: true
//         includedPaths: [
//           {
//             path: '/*'
//           }
//         ]
//         excludedPaths: [
//           {
//             path: '/"_etag"/?'
//           }
//         ]
//       }
//     }
//   }
// }

// // Assessments Container
// resource assessmentsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
//   parent: cosmosDatabase
//   name: 'assessments'
//   properties: {
//     resource: {
//       id: 'assessments'
//       partitionKey: {
//         paths: ['/customerId']
//         kind: 'Hash'
//       }
//       indexingPolicy: {
//         indexingMode: 'consistent'
//         automatic: true
//         includedPaths: [
//           {
//             path: '/*'
//           }
//         ]
//         excludedPaths: [
//           {
//             path: '/"_etag"/?'
//           }
//         ]
//       }
//     }
//   }
// }

// User Assigned Managed Identity for Function App
resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${resourcePrefix}-identity-${resourceToken}'
  location: location
  tags: tags
}

// App Service Plan for Function App
resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${resourcePrefix}-plan-${resourceToken}'
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
    size: 'Y1'
    family: 'Y'
    capacity: 0
  }
  properties: {
    reserved: false
  }
}

// Static Web App for frontend
resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: '${resourcePrefix}-frontend-${resourceToken}'
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
      apiLocation: ''
      outputLocation: 'build'
    }
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

// Function App
resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: '${resourcePrefix}-api-${resourceToken}'
  location: location
  tags: union(tags, {
    'azd-service-name': 'm365-assessment-api'
  })
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned,UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower('${resourcePrefix}-api-${resourceToken}')
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'KEY_VAULT_URL'
          value: keyVault.properties.vaultUri
        }
        {
          name: 'AZURE_CLIENT_ID'
          value: azureClientId
        }
        {
          name: 'AZURE_TENANT_ID'
          value: azureTenantId
        }
        {
          name: 'AZURE_CLIENT_SECRET'
          value: azureClientSecret
        }
        {
          name: 'FRONTEND_URL'
          value: 'https://${staticWebApp.properties.defaultHostname}'
        }
      ]
      cors: {
        allowedOrigins: [
          'https://${staticWebApp.properties.defaultHostname}'
          'http://localhost:3000'
        ]
        supportCredentials: false
      }
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      use32BitWorkerProcess: false
      netFrameworkVersion: 'v6.0'
    }
  }
}

// Role assignment for Function App to access Key Vault
resource keyVaultSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionApp.id, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Diagnostic settings for Function App
resource functionAppDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'default'
  scope: functionApp
  properties: {
    workspaceId: logAnalyticsWorkspace.id
    logs: [
      {
        category: 'FunctionAppLogs'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
  }
}

// Outputs for azure.yaml
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = subscription().tenantId
output REACT_APP_API_URL string = 'https://${functionApp.properties.defaultHostName}/api'
output APPLICATIONINSIGHTS_CONNECTION_STRING string = applicationInsights.properties.ConnectionString
output KEY_VAULT_URL string = keyVault.properties.vaultUri
output FUNCTION_APP_NAME string = functionApp.name
output STATIC_WEB_APP_NAME string = staticWebApp.name
