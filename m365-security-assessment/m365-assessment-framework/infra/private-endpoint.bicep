@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name')
param environmentName string

@description('PostgreSQL server name')
param postgresServerName string

@description('PostgreSQL resource group name')
param postgresResourceGroup string

@description('Subscription ID where PostgreSQL server exists')
param subscriptionId string

@description('Resource token for unique naming')
param resourceToken string

// Create Virtual Network for private endpoints
resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'vnet-${resourceToken}'
  location: location
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'private-endpoints'
        properties: {
          addressPrefix: '10.0.1.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
          privateLinkServiceNetworkPolicies: 'Enabled'
        }
      }
      {
        name: 'static-web-apps'
        properties: {
          addressPrefix: '10.0.2.0/24'
          delegations: [
            {
              name: 'Microsoft.Web.staticSites'
              properties: {
                serviceName: 'Microsoft.Web/staticSites'
              }
            }
          ]
        }
      }
    ]
  }
}

// Create Private DNS Zone for PostgreSQL
resource privateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
  tags: {
    'azd-env-name': environmentName
  }
}

// Link VNet to Private DNS Zone
resource vnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: privateDnsZone
  name: 'vnet-link-${resourceToken}'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

// Create Private Endpoint for PostgreSQL
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-postgres-${resourceToken}'
  location: location
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    subnet: {
      id: '${vnet.id}/subnets/private-endpoints'
    }
    privateLinkServiceConnections: [
      {
        name: 'postgres-connection'
        properties: {
          privateLinkServiceId: '/subscriptions/${subscriptionId}/resourceGroups/${postgresResourceGroup}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${postgresServerName}'
          groupIds: [
            'postgresqlServer'
          ]
        }
      }
    ]
    customDnsConfigs: [
      {
        fqdn: '${postgresServerName}.privatelink.postgres.database.azure.com'
      }
    ]
  }
}

// Create DNS Zone Group for automatic DNS registration
resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'postgres-config'
        properties: {
          privateDnsZoneId: privateDnsZone.id
        }
      }
    ]
  }
}

// Outputs
output vnetId string = vnet.id
output privateEndpointId string = privateEndpoint.id
output privateDnsZoneId string = privateDnsZone.id
output staticWebAppsSubnetId string = '${vnet.id}/subnets/static-web-apps'
output vnetResourceToken string = resourceToken
