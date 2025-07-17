import { DefaultAzureCredential } from '@azure/identity';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Simple PostgreSQL Firewall Manager using Azure CLI
 * This is a simplified version that uses Azure CLI commands instead of the SDK
 */
export class PostgreSQLFirewallManager {
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
     * Create a firewall rule using Azure CLI
     */
    async createFirewallRule(ruleName: string, startIP: string, endIP: string = startIP): Promise<void> {
        try {
            const command = `az postgres flexible-server firewall-rule create --name ${this.serverName} --resource-group ${this.resourceGroupName} --rule-name ${ruleName} --start-ip-address ${startIP} --end-ip-address ${endIP} --output none`;
            
            await execAsync(command);
            console.log(`Created firewall rule '${ruleName}' for IP range ${startIP} - ${endIP}`);
        } catch (error) {
            // Rule might already exist, which is fine
            if (error instanceof Error && error.message.includes('already exists')) {
                console.log(`Firewall rule '${ruleName}' already exists`);
            } else {
                console.error(`Failed to create firewall rule '${ruleName}':`, error);
            }
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
                name: 'AllowAzureCloudServices',
                startIP: '40.0.0.0',
                endIP: '40.255.255.255',
                description: 'Allow Azure cloud services IP range'
            }
        ];

        for (const rule of rules) {
            try {
                await this.createFirewallRule(rule.name, rule.startIP, rule.endIP);
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Failed to create rule ${rule.name}:`, error);
                // Continue with other rules even if one fails
            }
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
