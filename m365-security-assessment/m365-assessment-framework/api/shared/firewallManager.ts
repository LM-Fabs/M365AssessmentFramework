import { DefaultAzureCredential } from '@azure/identity';
import { PostgreSQLManagementClient } from '@azure/arm-postgresql-flexible';

/**
 * PostgreSQL Firewall Management Service
 * Automatically manages firewall rules for PostgreSQL Flexible Server
 */
export class PostgreSQLFirewallManager {
    private client: PostgreSQLManagementClient;
    private credential: DefaultAzureCredential;
    private subscriptionId: string;
    private resourceGroupName: string;
    private serverName: string;

    constructor() {
        this.credential = new DefaultAzureCredential();
        this.subscriptionId = process.env.AZURE_SUBSCRIPTION_ID || process.env.SUBSCRIPTION_ID || '200830ff-e2b0-4cd7-9fb8-b263090a28a3';
        this.resourceGroupName = process.env.AZURE_RESOURCE_GROUP || process.env.RESOURCE_GROUP || 'M365_Assessment';
        this.serverName = process.env.POSTGRES_SERVER_NAME || process.env.POSTGRES_HOST?.split('.')[0] || 'psql-c6qdbpkda5cvs';
        
        if (!this.subscriptionId) {
            console.warn('AZURE_SUBSCRIPTION_ID environment variable not set, using default');
        }
        
        this.client = new PostgreSQLManagementClient(this.credential, this.subscriptionId);
    }

    /**
     * Get the external IP address of the current Azure service
     */
    async getCurrentExternalIP(): Promise<string> {
        try {
            const response = await fetch('https://ipinfo.io/ip');
            const ip = await response.text();
            return ip.trim();
        } catch (error) {
            console.warn('Failed to get external IP:', error);
            return '0.0.0.0';
        }
    }

    /**
     * Check if a firewall rule exists
     */
    async firewallRuleExists(ruleName: string): Promise<boolean> {
        try {
            await this.client.firewallRules.get(
                this.resourceGroupName,
                this.serverName,
                ruleName
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Create a firewall rule if it doesn't exist
     */
    async createFirewallRule(ruleName: string, startIP: string, endIP: string = startIP): Promise<void> {
        try {
            const exists = await this.firewallRuleExists(ruleName);
            if (exists) {
                console.log(`Firewall rule '${ruleName}' already exists`);
                return;
            }

            await this.client.firewallRules.beginCreateOrUpdateAndWait(
                this.resourceGroupName,
                this.serverName,
                ruleName,
                {
                    startIpAddress: startIP,
                    endIpAddress: endIP
                }
            );
            
            console.log(`Created firewall rule '${ruleName}' for IP range ${startIP} - ${endIP}`);
        } catch (error) {
            console.error(`Failed to create firewall rule '${ruleName}':`, error);
            throw error;
        }
    }

    /**
     * Create comprehensive firewall rules for Azure services
     */
    async setupComprehensiveFirewallRules(): Promise<void> {
        console.log('Setting up comprehensive firewall rules...');
        
        const rules = [
            {
                name: 'AllowAllAzureServices',
                startIP: '0.0.0.0',
                endIP: '0.0.0.0',
                description: 'Allow all Azure services'
            },
            {
                name: 'AllowStaticWebAppsRange',
                startIP: '132.220.0.0',
                endIP: '132.220.255.255',
                description: 'Allow Azure Static Web Apps IP range'
            },
            {
                name: 'AllowAzureAppServices',
                startIP: '13.64.0.0',
                endIP: '13.107.255.255',
                description: 'Allow Azure App Services IP range'
            },
            {
                name: 'AllowAzureServices2',
                startIP: '20.0.0.0',
                endIP: '20.255.255.255',
                description: 'Allow additional Azure services IP range'
            },
            {
                name: 'AllowAzureDatacenters',
                startIP: '40.0.0.0',
                endIP: '40.255.255.255',
                description: 'Allow Azure datacenter IP range'
            },
            {
                name: 'AllowAzureCloudServices',
                startIP: '52.0.0.0',
                endIP: '52.255.255.255',
                description: 'Allow Azure cloud services IP range'
            }
        ];

        for (const rule of rules) {
            try {
                await this.createFirewallRule(rule.name, rule.startIP, rule.endIP);
            } catch (error) {
                console.error(`Failed to create rule ${rule.name}:`, error);
                // Continue with other rules even if one fails
            }
        }

        // Also add current IP for development/testing
        try {
            const currentIP = await this.getCurrentExternalIP();
            if (currentIP !== '0.0.0.0') {
                await this.createFirewallRule('AllowCurrentIP', currentIP);
            }
        } catch (error) {
            console.warn('Failed to add current IP to firewall rules:', error);
        }

        console.log('Comprehensive firewall rules setup completed');
    }

    /**
     * Add a specific IP address to the firewall
     */
    async addSpecificIP(ipAddress: string, ruleName?: string): Promise<void> {
        const defaultRuleName = `AllowIP_${ipAddress.replace(/\./g, '_')}_${Date.now()}`;
        const actualRuleName = ruleName || defaultRuleName;
        
        await this.createFirewallRule(actualRuleName, ipAddress);
        console.log(`Added IP ${ipAddress} to firewall as rule '${actualRuleName}'`);
    }

    /**
     * Handle connection errors by automatically adding the IP to firewall
     */
    async handleConnectionError(error: Error): Promise<boolean> {
        const errorMessage = error.message;
        
        // Check if it's a firewall-related error
        if (errorMessage.includes('pg_hba.conf') || errorMessage.includes('no entry for host')) {
            // Extract IP address from error message
            const ipMatch = errorMessage.match(/host\s+"([^"]+)"/);
            if (ipMatch) {
                const blockedIP = ipMatch[1];
                console.log(`Detected blocked IP: ${blockedIP}, attempting to add to firewall...`);
                
                try {
                    await this.addSpecificIP(blockedIP);
                    console.log(`Successfully added ${blockedIP} to firewall. Retrying connection...`);
                    return true; // Indicates that we should retry the connection
                } catch (firewallError) {
                    console.error('Failed to add IP to firewall:', firewallError);
                    return false;
                }
            }
        }
        
        return false; // Not a firewall error or couldn't extract IP
    }

    /**
     * List all current firewall rules
     */
    async listFirewallRules(): Promise<void> {
        try {
            const rules = await this.client.firewallRules.listByServer(
                this.resourceGroupName,
                this.serverName
            );
            
            console.log('\nCurrent firewall rules:');
            console.log('Name'.padEnd(30), 'Start IP'.padEnd(15), 'End IP'.padEnd(15));
            console.log('-'.repeat(60));
            
            for await (const rule of rules) {
                console.log(
                    (rule.name || '').padEnd(30),
                    (rule.startIpAddress || '').padEnd(15),
                    (rule.endIpAddress || '').padEnd(15)
                );
            }
        } catch (error) {
            console.error('Failed to list firewall rules:', error);
        }
    }

    /**
     * Clean up redundant firewall rules
     */
    async cleanupRedundantRules(): Promise<void> {
        console.log('Cleaning up redundant firewall rules...');
        
        try {
            const rules = await this.client.firewallRules.listByServer(
                this.resourceGroupName,
                this.serverName
            );
            
            const keepRules = [
                'AllowAllAzureServices',
                'AllowStaticWebAppsRange',
                'AllowAzureAppServices',
                'AllowAzureServices2',
                'AllowAzureDatacenters',
                'AllowAzureCloudServices',
                'AllowCurrentIP'
            ];
            
            for await (const rule of rules) {
                if (rule.name && !keepRules.includes(rule.name)) {
                    // Check if it's a specific IP rule we want to keep
                    if (!rule.name.startsWith('AllowIP_') && 
                        !rule.name.startsWith('ClientIPAddress_') &&
                        !rule.name.startsWith('AllowMyIP')) {
                        
                        try {
                            await this.client.firewallRules.beginDeleteAndWait(
                                this.resourceGroupName,
                                this.serverName,
                                rule.name
                            );
                            console.log(`Deleted redundant rule: ${rule.name}`);
                        } catch (error) {
                            console.warn(`Failed to delete rule ${rule.name}:`, error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to cleanup firewall rules:', error);
        }
    }
}

// Export singleton instance
let firewallManager: PostgreSQLFirewallManager | null = null;

export function getFirewallManager(): PostgreSQLFirewallManager {
    if (!firewallManager) {
        firewallManager = new PostgreSQLFirewallManager();
    }
    return firewallManager;
}

export default PostgreSQLFirewallManager;
