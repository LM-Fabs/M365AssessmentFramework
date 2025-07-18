import { Client } from "@microsoft/microsoft-graph-client";
import { DefaultAzureCredential, ClientSecretCredential } from "@azure/identity";
import { Application, ServicePrincipal } from "@microsoft/microsoft-graph-types";
import * as https from 'https';

/**
 * Microsoft Graph API Service for Azure AD app registration management
 * Uses managed identity for authentication and implements proper error handling
 * Follows Azure best practices for Microsoft Graph API interactions
 * 
 * References:
 * - Microsoft Graph SDK: https://docs.microsoft.com/en-us/graph/sdks/sdks-overview
 * - App Registration API: https://docs.microsoft.com/en-us/graph/api/application-post-applications
 * - Service Principal API: https://docs.microsoft.com/en-us/graph/api/serviceprincipal-post-serviceprincipals
 */

/**
 * Helper function to make HTTPS requests without external dependencies
 */
function httpsRequest(url: string, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { timeout }, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                try {
                    if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } else {
                        reject(new Error(`HTTP ${response.statusCode}: ${data}`));
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse JSON response: ${parseError}`));
                }
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request timed out'));
        });
    });
}

export class GraphApiService {
    private graphClient: Client;
    private isInitialized = false;

    constructor() {
        // Check for required environment variables
        const requiredEnvVars = {
            AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
            AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
            AZURE_TENANT_ID: process.env.AZURE_TENANT_ID
        };

        const missingVars = Object.entries(requiredEnvVars)
            .filter(([, value]) => !value)
            .map(([key]) => key);

        if (missingVars.length > 0) {
            const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}. Please configure these in your Azure Static Web App settings or local.settings.json for local development.`;
            console.error('❌ GraphApiService:', errorMsg);
            throw new Error(errorMsg);
        }

        // Validate client secret format (ensure it's the value, not the ID)
        const clientSecret = process.env.AZURE_CLIENT_SECRET!;
        if (clientSecret.length < 30 || clientSecret.startsWith('~') === false) {
            console.warn('⚠️ GraphApiService: Client secret appears to be in wrong format. Expected a long secret value starting with ~, got:', clientSecret.substring(0, 10) + '...');
        }

        // Use service principal credentials for authentication
        const credential = new ClientSecretCredential(
            process.env.AZURE_TENANT_ID!,
            process.env.AZURE_CLIENT_ID!,
            clientSecret
        );
        
        console.log('✅ GraphApiService: Using service principal authentication');
        console.log('🔧 GraphApiService: Tenant ID:', process.env.AZURE_TENANT_ID);
        console.log('🔧 GraphApiService: Client ID:', process.env.AZURE_CLIENT_ID?.substring(0, 8) + '...');
        console.log('🔧 GraphApiService: Client Secret format check:', clientSecret.substring(0, 3) + '...' + clientSecret.substring(clientSecret.length - 3));
        
        // Initialize Microsoft Graph client with proper authentication
        this.graphClient = Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => {
                    try {
                        const tokenResponse = await credential.getToken(
                            "https://graph.microsoft.com/.default"
                        );
                        if (!tokenResponse?.token) {
                            throw new Error('Failed to obtain access token - empty response');
                        }
                        console.log('✅ GraphApiService: Access token obtained successfully');
                        return tokenResponse.token;
                    } catch (error) {
                        console.error('❌ GraphApiService: Failed to get access token:', error);
                        throw new Error(`Authentication failed: ${error instanceof Error ? error.message : error}. Check your service principal configuration.`);
                    }
                }
            }
        });
    }

    /**
     * Create multi-tenant Azure AD App Registration for customer tenant authentication
     * Creates app in our tenant that can be consented to by customer tenants
     * 
     * @param customerData Customer information for app naming and configuration
     * @returns App registration details including consent URL
     */
    async createMultiTenantAppRegistration(customerData: {
        tenantName: string;
        tenantDomain: string;
        targetTenantId: string;
        contactEmail?: string;
        requiredPermissions?: string[];
    }): Promise<{
        applicationId: string;
        clientId: string;
        servicePrincipalId: string;
        clientSecret: string;
        consentUrl: string;
        redirectUri: string;
        permissions: string[];
        resolvedTenantId: string;
    }> {
        try {
            console.log('🏢 GraphApiService: Creating multi-tenant app for:', customerData.tenantName);
            console.log('🔧 GraphApiService: Target tenant ID:', customerData.targetTenantId);
            console.log('🔧 GraphApiService: Target tenant domain:', customerData.tenantDomain);

            // Attempt to resolve domain to actual tenant ID if we have a domain
            let resolvedTenantId = customerData.targetTenantId;
            let domainResolutionAttempted = false;
            
            if (customerData.tenantDomain && customerData.tenantDomain !== 'unknown.onmicrosoft.com') {
                console.log('🔍 GraphApiService: Attempting to resolve domain to tenant ID...');
                domainResolutionAttempted = true;
                
                try {
                    const discoveredTenantId = await this.resolveDomainToTenantId(customerData.tenantDomain);
                    
                    if (discoveredTenantId && discoveredTenantId !== customerData.tenantDomain && 
                        discoveredTenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                        console.log('✅ GraphApiService: Domain resolved to tenant ID:', discoveredTenantId);
                        resolvedTenantId = discoveredTenantId;
                    } else {
                        console.log('⚠️ GraphApiService: Domain resolution did not return a GUID, using original identifier:', customerData.targetTenantId);
                    }
                } catch (resolutionError) {
                    console.error('❌ GraphApiService: Domain resolution failed:', resolutionError);
                    console.log('⚠️ GraphApiService: Falling back to original tenant identifier:', customerData.targetTenantId);
                }
            }

            // Define required permissions for security assessment (restored full set)
            const permissions = customerData.requiredPermissions || [
                'Organization.Read.All',
                'Directory.Read.All',
                'AuditLog.Read.All',
                'SecurityEvents.Read.All'
            ];

            // Create the app registration with multi-tenant configuration
            const appName = `M365-Security-Assessment-${customerData.tenantName.replace(/\s+/g, '-')}`;
            
            // Define proper redirect URIs for the application
            const redirectUris = [
                "https://portal.azure.com/",
                "https://login.microsoftonline.com/common/oauth2/nativeclient"
            ];
            
            // Use environment variable if provided, otherwise use Azure Portal
            const primaryRedirectUri = process.env.REDIRECT_URI || "https://portal.azure.com/";
            
            const applicationRequest = {
                displayName: appName,
                description: `M365 Security Assessment Application for ${customerData.tenantName} (${customerData.tenantDomain})`,
                signInAudience: "AzureADMultipleOrgs", // Multi-tenant application
                web: {
                    redirectUris: redirectUris,
                    implicitGrantSettings: {
                        enableAccessTokenIssuance: false,
                        enableIdTokenIssuance: true
                    }
                },
                requiredResourceAccess: [
                    {
                        resourceAppId: "00000003-0000-0000-c000-000000000000", // Microsoft Graph
                        resourceAccess: permissions
                            .map(permission => {
                                try {
                                    return {
                                        id: this.getPermissionId(permission),
                                        type: "Role" // Application permissions (not delegated)
                                    };
                                } catch (error) {
                                    console.warn(`⚠️ GraphApiService: Skipping invalid permission: ${permission}. Error: ${error}`);
                                    return null;
                                }
                            })
                            .filter(Boolean) // Remove null entries
                            .filter((permission, index, array) => {
                                // Remove duplicates by permission ID
                                return array.findIndex(p => p!.id === permission!.id) === index;
                            })
                    }
                ],
                tags: [
                    "M365Assessment",
                    "SecurityAssessment",
                    customerData.tenantDomain,
                    customerData.targetTenantId
                ].filter((tag, index, array) => array.indexOf(tag) === index) // Remove duplicates
            };

            console.log('📝 GraphApiService: Creating application with config:', JSON.stringify(applicationRequest, null, 2));

            // Create the application with retry logic
            let application: Application | undefined;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    application = await this.graphClient
                        .api('/applications')
                        .post(applicationRequest) as Application;
                    break; // Success, exit retry loop
                } catch (createError: any) {
                    retryCount++;
                    console.error(`❌ GraphApiService: Application creation attempt ${retryCount} failed:`, createError);
                    
                    if (retryCount >= maxRetries) {
                        if (createError.message?.includes('insufficient privileges')) {
                            throw new Error(`Insufficient permissions to create application. Ensure the service principal has Application.ReadWrite.All permission in Microsoft Graph. Error: ${createError.message}`);
                        } else if (createError.message?.includes('authentication')) {
                            throw new Error(`Authentication failed while creating application. Check service principal credentials. Error: ${createError.message}`);
                        } else {
                            throw new Error(`Failed to create application after ${maxRetries} attempts. Error: ${createError.message}`);
                        }
                    }
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }

            if (!application || !application.appId || !application.id) {
                throw new Error('Failed to create application - missing required IDs in response');
            }

            console.log('✅ GraphApiService: Application created:', application.appId);

            // Create service principal for the application
            const servicePrincipalRequest = {
                appId: application.appId,
                displayName: appName,
                tags: [
                    "WindowsAzureActiveDirectoryIntegratedApp",
                    "M365Assessment"
                ]
            };

            let servicePrincipal: ServicePrincipal;
            try {
                servicePrincipal = await this.graphClient
                    .api('/servicePrincipals')
                    .post(servicePrincipalRequest) as ServicePrincipal;
                
                console.log('✅ GraphApiService: Service principal created:', servicePrincipal.id);
            } catch (spError: any) {
                console.error('❌ GraphApiService: Failed to create service principal:', spError);
                throw new Error(`Failed to create service principal: ${spError.message}`);
            }

            // Generate client secret with 2-year expiry
            const passwordCredential = {
                displayName: `${appName}-Secret-${new Date().getTime()}`,
                endDateTime: new Date(Date.now() + (2 * 365 * 24 * 60 * 60 * 1000)).toISOString() // 2 years
            };

            let secretResponse: any;
            try {
                secretResponse = await this.graphClient
                    .api(`/applications/${application.id}/addPassword`)
                    .post(passwordCredential);
                
                console.log('✅ GraphApiService: Client secret generated');
                
                if (!secretResponse.secretText) {
                    throw new Error('Client secret was not returned in the response');
                }
            } catch (secretError: any) {
                console.error('❌ GraphApiService: Failed to create client secret:', secretError);
                throw new Error(`Failed to create client secret: ${secretError.message}`);
            }

            // Generate admin consent URL for the target tenant using resolved tenant ID
            const consentUrl = this.generateConsentUrl(
                application.appId,
                resolvedTenantId,
                permissions,
                primaryRedirectUri
            );

            const result = {
                applicationId: application.id,
                clientId: application.appId,
                servicePrincipalId: servicePrincipal.id || '',
                clientSecret: secretResponse.secretText,
                consentUrl,
                redirectUri: primaryRedirectUri,
                permissions,
                resolvedTenantId: resolvedTenantId // Include the resolved tenant ID
            };

            console.log('🎉 GraphApiService: Multi-tenant app created successfully');
            return result;

        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to create app registration:', error);
            
            // Handle specific Graph API errors
            if (error.code === 'Request_ResourceNotFound') {
                throw new Error('Invalid tenant ID or insufficient permissions to create app registration');
            }
            if (error.code === 'Authorization_RequestDenied') {
                throw new Error('Insufficient permissions to create app registration. Ensure Application.ReadWrite.All permission is granted.');
            }
            if (error.code === 'Request_BadRequest') {
                throw new Error(`Invalid app registration request: ${error.message}`);
            }
            
            throw new Error(`Failed to create app registration: ${error.message || error}`);
        }
    }

    /**
     * Get secure score data from Microsoft Graph for a customer tenant
     * Uses the customer's consented app credentials
     */
    async getSecureScore(tenantId: string, clientId: string, clientSecret: string): Promise<{
        currentScore: number;
        maxScore: number;
        percentage: number;
        controlScores: Array<{
            controlName: string;
            category: string;
            currentScore: number;
            maxScore: number;
            implementationStatus: string;
            actionType: string;
            remediation: string;
        }>;
        recommendedActions: Array<{
            title: string;
            action: string;
            category: string;
            priority: string;
        }>;
        lastUpdated: Date;
        totalControlsFound: number;
        controlsStoredCount: number;
    }> {
        try {
            console.log('🛡️ GraphApiService: Fetching secure score for tenant:', tenantId);

            // Create client for customer tenant using their credentials
            const customerCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
            const customerGraphClient = Client.initWithMiddleware({
                authProvider: {
                    getAccessToken: async () => {
                        const tokenResponse = await customerCredential.getToken("https://graph.microsoft.com/.default");
                        return tokenResponse?.token || "";
                    }
                }
            });

            // Fetch secure scores (latest first) - typically only a few results
            console.log('🛡️ GraphApiService: Fetching secure scores...');
            const secureScoresResponse = await customerGraphClient
                .api('/security/secureScores')
                .top(5) // Get the latest 5 secure scores
                .orderby('createdDateTime desc')
                .get();

            if (!secureScoresResponse.value || secureScoresResponse.value.length === 0) {
                throw new Error('No secure score data available for this tenant');
            }

            const latestScore = secureScoresResponse.value[0];
            console.log(`📊 GraphApiService: Found ${secureScoresResponse.value.length} secure score records. Using latest from ${latestScore.createdDateTime}`);
            console.log(`📊 GraphApiService: Latest score: ${latestScore.currentScore}/${latestScore.maxScore} (${Math.round(((latestScore.currentScore || 0) / (latestScore.maxScore || 1)) * 100)}%)`);

            // Fetch secure score control profiles for detailed breakdown with pagination support
            console.log('🔄 GraphApiService: Fetching secure score control profiles with pagination...');
            let allControlProfiles: any[] = [];
            let nextLink: string | undefined;
            let pageCount = 0;
            const maxPages = 20; // Increased to get more complete data with PostgreSQL
            const maxControlsPerPage = 100; // Restored to maximum for better data collection
            
            do {
                pageCount++;
                console.log(`📄 GraphApiService: Fetching control profiles page ${pageCount}...`);
                
                let currentPageResponse;
                if (nextLink) {
                    // Use the nextLink for subsequent pages
                    currentPageResponse = await customerGraphClient
                        .api(nextLink)
                        .get();
                } else {
                    // First page - use the base endpoint with pagination parameters
                    currentPageResponse = await customerGraphClient
                        .api('/security/secureScoreControlProfiles')
                        .top(maxControlsPerPage) // Reduced page size
                        .get();
                }

                if (currentPageResponse.value && Array.isArray(currentPageResponse.value)) {
                    allControlProfiles.push(...currentPageResponse.value);
                    console.log(`✅ GraphApiService: Page ${pageCount} retrieved ${currentPageResponse.value.length} control profiles. Total: ${allControlProfiles.length}`);
                    
                    // Check if we have enough data for meaningful analysis
                    if (allControlProfiles.length >= 500) {
                        console.log(`📊 GraphApiService: Retrieved ${allControlProfiles.length} controls - stopping for performance optimization.`);
                        break;
                    }
                }

                // Check for next page
                nextLink = currentPageResponse['@odata.nextLink'];
                
                // Safety check to prevent infinite loops
                if (pageCount >= maxPages) {
                    console.warn(`⚠️ GraphApiService: Reached maximum page limit (${maxPages}). Stopping pagination. Retrieved ${allControlProfiles.length} control profiles.`);
                    break;
                }
            } while (nextLink);

            console.log(`🎉 GraphApiService: Pagination complete. Retrieved ${allControlProfiles.length} total control profiles in ${pageCount} page(s).`);

            // Optimize control scores data for storage - keep essential information with PostgreSQL's unlimited storage
            const controlScores = allControlProfiles.map((control: any) => ({
                controlName: (control.title || control.controlName || 'Unknown Control').substring(0, 150), // Increased length for better descriptions
                category: (control.controlCategory || 'General').substring(0, 80), // Increased length for better categorization
                currentScore: control.score || 0,
                maxScore: control.maxScore || 0,
                implementationStatus: (control.implementationStatus || 'Not Implemented').substring(0, 50), // Increased length for better status
                actionType: (control.actionType || 'Other').substring(0, 50), // Add action type with increased length
                remediation: (control.remediation || 'No remediation information available').substring(0, 400) // Increased length for better remediation info
            })) || []; // Remove artificial limit to show all controls with PostgreSQL

            // Extract recommended actions from control profiles for the recommendations section
            const recommendedActions = allControlProfiles
                .filter((control: any) => control.implementationStatus !== 'Implemented' && control.remediation)
                .slice(0, 25) // Increased to show more recommendations with PostgreSQL
                .map((control: any) => ({
                    title: (control.title || control.controlName || 'Unknown Control').substring(0, 120),
                    action: (control.remediation || 'Review this security control').substring(0, 250),
                    category: (control.controlCategory || 'General').substring(0, 50),
                    priority: control.rank || 'Medium' // Use rank or default to medium
                }));

            console.log(`📊 GraphApiService: Optimized control scores to ${controlScores.length} controls for storage efficiency`);
            console.log(`📋 GraphApiService: Extracted ${recommendedActions.length} recommended actions from control profiles`);

            const result = {
                currentScore: latestScore.currentScore || 0,
                maxScore: latestScore.maxScore || 0,
                percentage: Math.round(((latestScore.currentScore || 0) / (latestScore.maxScore || 1)) * 100),
                controlScores,
                recommendedActions, // Add recommended actions to the result
                lastUpdated: new Date(latestScore.createdDateTime),
                totalControlsFound: allControlProfiles.length, // Keep track of total number
                controlsStoredCount: controlScores.length // Track how many we actually stored
            };

            console.log('✅ GraphApiService: Secure score retrieved successfully');
            console.log(`📊 GraphApiService: Final result - Score: ${result.currentScore}/${result.maxScore} (${result.percentage}%), Controls: ${result.controlScores.length}/${result.totalControlsFound}`);
            console.log(`💾 GraphApiService: Data size optimization - Stored ${result.controlsStoredCount} of ${result.totalControlsFound} total controls`);
            
            // Estimate data size for logging
            const estimatedSize = JSON.stringify(result).length;
            console.log(`📏 GraphApiService: Estimated result size: ${(estimatedSize / 1024).toFixed(2)} KB`);
            
            return result;

        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to fetch secure score:', error);
            console.error('❌ GraphApiService: Error details:', {
                message: error.message,
                code: error.code,
                statusCode: error.statusCode,
                response: error.response,
                stack: error.stack
            });
            
            if (error.code === 'Forbidden' || error.statusCode === 403) {
                throw new Error('Insufficient permissions to read secure score. Ensure SecurityEvents.Read.All permission is granted and consented.');
            }
            if (error.code === 'Unauthorized' || error.statusCode === 401) {
                throw new Error('Authentication failed. Please verify the app registration has been consented to by the customer tenant admin.');
            }
            if (error.code === 'NotFound' || error.statusCode === 404) {
                throw new Error('Secure score endpoint not found. This tenant may not have secure score data available.');
            }
            if (error.code === 'BadRequest' || error.statusCode === 400) {
                throw new Error('Bad request to secure score API. This may indicate an API version or endpoint issue.');
            }
            
            throw new Error(`Failed to fetch secure score: ${error.message || error} (Status: ${error.statusCode || 'Unknown'})`);
        }
    }

    /**
     * Get license information from Microsoft Graph for a customer tenant
     */
    async getLicenseInfo(tenantId: string, clientId: string, clientSecret: string): Promise<{
        totalLicenses: number;
        assignedLicenses: number;
        availableLicenses: number;
        licenseDetails: Array<{
            skuId: string;
            skuPartNumber: string;
            servicePlanName: string;
            totalUnits: number;
            assignedUnits: number;
            consumedUnits: number;
            capabilityStatus: string;
        }>;
    }> {
        try {
            console.log('📄 GraphApiService: Fetching license info for tenant:', tenantId);

            // Create client for customer tenant
            const customerCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
            const customerGraphClient = Client.initWithMiddleware({
                authProvider: {
                    getAccessToken: async () => {
                        const tokenResponse = await customerCredential.getToken("https://graph.microsoft.com/.default");
                        return tokenResponse?.token || "";
                    }
                }
            });

            // Fetch subscribedSkus (license information)
            const licensesResponse = await customerGraphClient
                .api('/subscribedSkus')
                .get();

            const licenseDetails = licensesResponse.value?.map((sku: any) => ({
                skuId: sku.skuId,
                skuPartNumber: sku.skuPartNumber,
                servicePlanName: sku.servicePlans?.[0]?.servicePlanName || sku.skuPartNumber,
                totalUnits: sku.prepaidUnits?.enabled || 0,
                assignedUnits: sku.consumedUnits || 0,
                consumedUnits: sku.consumedUnits || 0,
                capabilityStatus: sku.capabilityStatus || 'Unknown'
            })) || [];

            const totalLicenses = licenseDetails.reduce((sum: number, license: any) => sum + license.totalUnits, 0);
            const assignedLicenses = licenseDetails.reduce((sum: number, license: any) => sum + license.assignedUnits, 0);

            const result = {
                totalLicenses,
                assignedLicenses,
                availableLicenses: totalLicenses - assignedLicenses,
                licenseDetails
            };

            console.log('✅ GraphApiService: License info retrieved successfully');
            return result;

        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to fetch license info:', error);
            
            if (error.code === 'Forbidden') {
                throw new Error('Insufficient permissions to read license information. Ensure Organization.Read.All permission is granted and consented.');
            }
            if (error.code === 'Unauthorized') {
                throw new Error('Authentication failed. Please verify the app registration has been consented to by the customer tenant admin.');
            }
            
            throw new Error(`Failed to fetch license information: ${error.message || error}`);
        }
    }

    /**
     * Generate admin consent URL for multi-tenant app
     */
    private generateConsentUrl(clientId: string, tenantId: string, permissions: string[], redirectUri: string): string {
        // Determine the correct tenant identifier for the consent URL
        let consentTenantId = tenantId;
        
        // If the tenantId looks like a custom domain (contains dots but not onmicrosoft.com), 
        // use 'common' endpoint which allows consent from any tenant
        if (tenantId.includes('.') && !tenantId.includes('.onmicrosoft.com') && 
            !tenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            console.log('⚠️ GraphApiService: Using common consent endpoint for custom domain:', tenantId);
            consentTenantId = 'common';
        }
        
        // For admin consent, we use the standard admin consent endpoint
        return `https://login.microsoftonline.com/${consentTenantId}/adminconsent` +
            `?client_id=${clientId}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    }

    /**
     * Map permission names to Graph API permission IDs
     */
    private getPermissionId(permissionName: string): string {
        const permissionMap: Record<string, string> = {
            'Organization.Read.All': '498476ce-e0fe-48b0-b801-37ba7e2685c6',
            'Reports.Read.All': '230c1aed-a721-4c5d-9cb4-a90514e508ef',
            'Directory.Read.All': '7ab1d382-f21e-4acd-a863-ba3e13f7da61',
            'Policy.Read.All': '246dd0d5-5bd0-4def-940b-0421030a5b68',
            'SecurityEvents.Read.All': 'bf394140-e372-4bf9-a898-299cfc7564e5',
            'IdentityRiskyUser.Read.All': 'dc5007c0-2d7d-4c42-879c-2dab87571379',
            'DeviceManagementManagedDevices.Read.All': '2f51be20-0bb4-4fed-bf7b-db946066c75e',
            'AuditLog.Read.All': 'b0afded3-3588-46d8-8b3d-9842eff778da'
            // Removed invalid ThreatIndicators.Read.All permission
        };

        const permissionId = permissionMap[permissionName];
        if (!permissionId) {
            throw new Error(`Unknown permission: ${permissionName}`);
        }
        return permissionId;
    }

    /**
     * Update app permissions for an existing application
     */
    async updateAppPermissions(applicationId: string, permissions: string[]): Promise<void> {
        try {
            // Permission ID mapping for Microsoft Graph (consistent with getPermissionId)
            const permissionMap: Record<string, string> = {
                'Organization.Read.All': '498476ce-e0fe-48b0-b801-37ba7e2685c6',
                'Reports.Read.All': '230c1aed-a721-4c5d-9cb4-a90514e508ef',
                'Directory.Read.All': '7ab1d382-f21e-4acd-a863-ba3e13f7da61',
                'Policy.Read.All': '246dd0d5-5bd0-4def-940b-0421030a5b68',
                'SecurityEvents.Read.All': 'bf394140-e372-4bf9-a898-299cfc7564e5',
                'IdentityRiskyUser.Read.All': 'dc5007c0-2d7d-4c42-879c-2dab87571379',
                'DeviceManagementManagedDevices.Read.All': '2f51be20-0bb4-4fed-bf7b-db946066c75e',
                'AuditLog.Read.All': 'b0afded3-3588-46d8-8b3d-9842eff778da',
                'Directory.ReadWrite.All': '19dbc75e-c2e2-444c-a770-ec69d8559fc7'
                // Removed invalid ThreatIndicators.Read.All permission
            };

            const resourceAccess = permissions.map(permission => ({
                id: permissionMap[permission],
                type: "Role"
            })).filter(ra => ra.id); // Filter out unmapped permissions

            const updateRequest = {
                requiredResourceAccess: [
                    {
                        resourceAppId: "00000003-0000-0000-c000-000000000000", // Microsoft Graph
                        resourceAccess
                    }
                ]
            };

            await this.graphClient
                .api(`/applications/${applicationId}`)
                .patch(updateRequest);

        } catch (error) {
            throw new Error(`Failed to update app permissions: ${(error as Error).message}`);
        }
    }

    /**
     * Clean up - delete app registration (for development/testing)
     */
    async deleteAppRegistration(applicationId: string): Promise<void> {
        try {
            await this.graphClient.api(`/applications/${applicationId}`).delete();
            console.log('🗑️ GraphApiService: App registration deleted:', applicationId);
        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to delete app registration:', error);
            throw new Error(`Failed to delete app registration: ${error.message || error}`);
        }
    }

    /**
     * Rotate client secret for security
     * Should be called periodically for security best practices
     */
    async rotateClientSecret(applicationId: string, oldSecretKeyId?: string): Promise<string> {
        try {
            // Generate new client secret
            const passwordCredential = {
                displayName: `Rotated-Secret-${new Date().getTime()}`,
                endDateTime: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString() // 1 year expiry
            };

            const secretResponse = await this.graphClient
                .api(`/applications/${applicationId}/addPassword`)
                .post(passwordCredential);

            // Remove old secret if provided (after new one is successfully created)
            if (oldSecretKeyId) {
                try {
                    await this.graphClient
                        .api(`/applications/${applicationId}/removePassword`)
                        .post({ keyId: oldSecretKeyId });
                } catch (removeError) {
                    console.warn('Failed to remove old secret, but new secret was created successfully');
                }
            }

            return secretResponse.secretText;

        } catch (error) {
            throw new Error(`Failed to rotate client secret: ${(error as Error).message}`);
        }
    }

    /**
     * Get application details
     * Used for validation and monitoring
     */
    async getApplication(applicationId: string): Promise<Application | null> {
        try {
            const application = await this.graphClient
                .api(`/applications/${applicationId}`)
                .get() as Application;

            return application;
        } catch (error) {
            if ((error as any).code === 'Request_ResourceNotFound') {
                return null;
            }
            throw new Error(`Failed to get application: ${(error as Error).message}`);
        }
    }

    /**
     * Delete application registration
     * Used when customer is removed
     */
    async deleteApplication(applicationId: string): Promise<void> {
        try {
            await this.graphClient
                .api(`/applications/${applicationId}`)
                .delete();
        } catch (error) {
            if ((error as any).code !== 'Request_ResourceNotFound') {
                throw new Error(`Failed to delete application: ${(error as Error).message}`);
            }
        }
    }

    /**
     * Grant admin consent for application permissions
     * Note: This requires admin privileges in the target tenant
     */
    async grantAdminConsent(servicePrincipalId: string): Promise<void> {
        try {
            // This would typically be done through the Azure portal or PowerShell
            // by the customer's admin, but we can provide the URL for them
            const consentUrl = `https://login.microsoftonline.com/common/adminconsent?client_id=${servicePrincipalId}`;
            
            // Log the consent URL for customer admin to use
            console.log(`Admin consent required. Direct customer to: ${consentUrl}`);
            
            // In a real implementation, you might send this URL via email or store it for later retrieval
        } catch (error) {
            throw new Error(`Failed to initiate admin consent: ${(error as Error).message}`);
        }
    }

    /**
     * Create enterprise application in customer tenant after consent
     * This method creates a service principal in the customer's tenant
     * to represent our multi-tenant application
     */
    async createEnterpriseApplication(config: {
        tenantId: string;
        clientId: string;
        displayName: string;
        customerData: {
            customerId: string;
            tenantName: string;
            tenantDomain: string;
            contactEmail?: string;
        };
    }): Promise<{
        id: string;
        objectId: string;
        appId: string;
        displayName: string;
        servicePrincipalType: string;
        createdDateTime: string;
    }> {
        try {
            console.log('🏢 Creating enterprise application in customer tenant:', config.tenantId);

            // Create service principal for the existing multi-tenant application
            const servicePrincipalRequest = {
                appId: config.clientId,
                displayName: config.displayName,
                notes: `M365 Assessment Framework enterprise app for ${config.customerData.tenantName}`,
                // Add tags for identification and management
                tags: [
                    'WindowsAzureActiveDirectoryIntegratedApp',
                    'HideApp', // Hide from user app launcher
                    'M365AssessmentFramework'
                ],
                // Configure app role assignment required for security
                appRoleAssignmentRequired: true,
                // Set preferred single sign-on mode
                preferredSingleSignOnMode: 'saml'
            };

            console.log('📝 Enterprise app request:', JSON.stringify(servicePrincipalRequest, null, 2));

            // Create service principal with retry logic
            let servicePrincipal: ServicePrincipal | undefined;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    servicePrincipal = await this.graphClient
                        .api('/servicePrincipals')
                        .post(servicePrincipalRequest) as ServicePrincipal;
                    break;
                } catch (error: any) {
                    retryCount++;
                    
                    if (error.code === 'Request_BadRequest' && error.message?.includes('already exists')) {
                        // Service principal already exists, try to get it
                        console.log('ℹ️ Service principal already exists, attempting to retrieve it...');
                        
                        try {
                            const existingResponse = await this.graphClient
                                .api('/servicePrincipals')
                                .filter(`appId eq '${config.clientId}'`)
                                .get();
                            
                            if (existingResponse.value && existingResponse.value.length > 0) {
                                servicePrincipal = existingResponse.value[0];
                                console.log('✅ Retrieved existing service principal:', servicePrincipal?.id);
                                break;
                            }
                        } catch (getError) {
                            console.log('❌ Failed to retrieve existing service principal:', getError);
                        }
                    }
                    
                    if (retryCount >= maxRetries) {
                        throw error;
                    }
                    
                    // Wait before retry with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }

            if (!servicePrincipal || !servicePrincipal.id) {
                throw new Error('Failed to create or retrieve enterprise application - missing service principal ID');
            }

            console.log('✅ Enterprise application created/retrieved successfully:', servicePrincipal.id);

            // Optionally assign users or groups to the enterprise application
            // This would require additional permissions and user/group information
            
            return {
                id: servicePrincipal.id,
                objectId: servicePrincipal.id, // In Microsoft Graph, id and objectId are the same
                appId: servicePrincipal.appId || config.clientId,
                displayName: servicePrincipal.displayName || config.displayName,
                servicePrincipalType: servicePrincipal.servicePrincipalType || 'Application',
                createdDateTime: new Date().toISOString() // Use current timestamp since createdDateTime might not be available
            };

        } catch (error: any) {
            console.error('❌ Failed to create enterprise application:', error);
            
            // Enhanced error handling for common scenarios
            if (error.code === 'Forbidden' || error.code === 'Authorization_RequestDenied') {
                throw new Error('Insufficient permissions to create enterprise application. Ensure admin consent has been granted.');
            } else if (error.code === 'BadRequest' && error.message?.includes('appId')) {
                throw new Error('Invalid application ID. Verify the multi-tenant application exists and is properly configured.');
            } else if (error.code === 'TooManyRequests') {
                throw new Error('Rate limit exceeded. Please try again in a few minutes.');
            }
            
            throw new Error(`Failed to create enterprise application: ${error.message || error}`);
        }
    }

    /**
     * Validate application permissions
     * Used to ensure app has required permissions for assessment
     */
    async validatePermissions(applicationId: string, requiredPermissions: string[]): Promise<{
        hasAllPermissions: boolean;
        missingPermissions: string[];
    }> {
        try {
            const application = await this.getApplication(applicationId);
            if (!application) {
                throw new Error('Application not found');
            }

            const grantedPermissions = application.requiredResourceAccess?.[0]?.resourceAccess?.map(
                ra => this.getPermissionName(ra.id || '')
            ).filter(Boolean) || [];

            const missingPermissions = requiredPermissions.filter(
                permission => !grantedPermissions.includes(permission)
            );

            return {
                hasAllPermissions: missingPermissions.length === 0,
                missingPermissions
            };
        } catch (error) {
            throw new Error(`Failed to validate permissions: ${(error as Error).message}`);
        }
    }

    /**
     * Helper method to map permission IDs to names
     */
    private getPermissionName(permissionId: string): string {
        const permissionMap: Record<string, string> = {
            '7ab1d382-f21e-4acd-a863-ba3e13f7da61': 'Directory.Read.All',
            'dc5007c0-2d7d-4c42-879c-2dab87571379': 'SecurityEvents.Read.All',
            '246dd0d5-5bd0-4def-940b-0421030a5b68': 'Policy.Read.All',
            '498476ce-e0fe-48b0-b801-37ba7e2685c6': 'Organization.Read.All',
            '19dbc75e-c2e2-444c-a770-ec69d8559fc7': 'Directory.ReadWrite.All'
        };
        return permissionMap[permissionId] || '';
    }

    /**
     * Health check for Microsoft Graph API connectivity
     */
    async healthCheck(): Promise<boolean> {
        try {
            // Simple query to test connectivity
            await this.graphClient.api('/me').get();
            return true;
        } catch (error) {
            console.error('Microsoft Graph API health check failed:', error);
            return false;
        }
    }

    /**
     * Resolve a domain name to its Azure AD tenant ID
     * This method attempts to find the tenant ID associated with a domain
     */
    async resolveDomainToTenantId(domain: string): Promise<string | null> {
        try {
            console.log('🔍 GraphApiService: Attempting to resolve domain to tenant ID:', domain);
            
            // For well-known domains like *.onmicrosoft.com, extract tenant name
            if (domain.endsWith('.onmicrosoft.com')) {
                console.log('✅ GraphApiService: OnMicrosoft domain detected, using as-is');
                return domain;
            }
            
            // For custom domains, we'll try to resolve using the tenant info endpoint
            // This approach uses the public tenant discovery endpoint
            try {
                const tenantDiscoveryUrl = `https://login.microsoftonline.com/${domain}/v2.0/.well-known/openid_configuration`;
                console.log('🌐 GraphApiService: Trying tenant discovery for domain:', domain);
                
                // Use httpsRequest instead of fetch for better compatibility
                const config = await httpsRequest(tenantDiscoveryUrl, 10000) as { issuer?: string };
                
                // Extract tenant ID from the issuer URL
                const issuerMatch = config.issuer?.match(/https:\/\/login\.microsoftonline\.com\/([^\/]+)\/v2\.0/);
                if (issuerMatch && issuerMatch[1]) {
                    const tenantId = issuerMatch[1];
                    
                    // Validate it looks like a proper GUID
                    if (tenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                        console.log('✅ GraphApiService: Domain resolved to tenant ID:', tenantId);
                        return tenantId;
                    } else {
                        console.log('⚠️ GraphApiService: Resolved tenant ID does not appear to be a GUID:', tenantId);
                    }
                }
            } catch (discoveryError: any) {
                if (discoveryError.message?.includes('timed out') || discoveryError.message?.includes('timeout')) {
                    console.log('⚠️ GraphApiService: Tenant discovery timed out for domain:', domain);
                } else {
                    console.log('⚠️ GraphApiService: Tenant discovery failed for domain:', domain, discoveryError.message);
                }
            }
            
            // Alternative approach: Try to get tenant info from Microsoft's tenant resolution API
            try {
                console.log('🔍 GraphApiService: Trying alternative tenant resolution');
                
                const tenantResolveUrl = `https://login.microsoftonline.com/common/userrealm/${domain}?api-version=2.1`;
                
                const realmInfo = await httpsRequest(tenantResolveUrl, 5000) as { 
                    TenantId?: string;
                    account_type?: string;
                    cloud_instance_name?: string;
                };
                
                if (realmInfo.TenantId && realmInfo.TenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                    console.log('✅ GraphApiService: Domain resolved via realm API to tenant ID:', realmInfo.TenantId);
                    return realmInfo.TenantId;
                }
            } catch (realmError: any) {
                if (realmError.message?.includes('timed out') || realmError.message?.includes('timeout')) {
                    console.log('⚠️ GraphApiService: Realm API timed out for domain:', domain);
                } else {
                    console.log('⚠️ GraphApiService: Realm API failed for domain:', domain, realmError.message);
                }
            }
            
            console.log('⚠️ GraphApiService: Could not resolve domain to tenant ID, using domain as-is:', domain);
            return domain; // Return the domain as-is if resolution fails
            
        } catch (error) {
            console.error('❌ GraphApiService: Error resolving domain to tenant ID:', error);
            return domain; // Return the domain as-is if there's an error
        }
    }

    /**
     * Get detailed license usage report including user assignments and trends
     */
    async getDetailedLicenseReport(tenantId: string, clientId: string, clientSecret: string): Promise<{
        overview: {
            totalLicenses: number;
            assignedLicenses: number;
            availableLicenses: number;
            utilizationPercentage: number;
            totalCost: number; // Estimated based on license types
        };
        licenseTypes: Array<{
            skuId: string;
            skuPartNumber: string;
            servicePlanName: string;
            totalUnits: number;
            assignedUnits: number;
            consumedUnits: number;
            availableUnits: number;
            utilizationPercentage: number;
            category: 'Basic' | 'Standard' | 'Premium' | 'Enterprise' | 'Other';
            estimatedMonthlyCost: number;
            capabilityStatus: string;
            servicePlans: Array<{
                servicePlanId: string;
                servicePlanName: string;
                provisioningStatus: string;
            }>;
        }>;
        userAssignmentSummary: {
            totalUsers: number;
            licensedUsers: number;
            unlicensedUsers: number;
            usersWithMultipleLicenses: number;
        };
        recommendations: string[];
        lastUpdated: string;
    }> {
        try {
            console.log('📊 GraphApiService: Fetching detailed license report for tenant:', tenantId);

            // Create client for customer tenant
            const customerCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
            const customerGraphClient = Client.initWithMiddleware({
                authProvider: {
                    getAccessToken: async () => {
                        const tokenResponse = await customerCredential.getToken("https://graph.microsoft.com/.default");
                        return tokenResponse?.token || "";
                    }
                }
            });

            // Fetch subscribedSkus (license information)
            const licensesResponse = await customerGraphClient
                .api('/subscribedSkus')
                .get();

            // Fetch user count for better analysis
            let totalUsers = 0;
            let licensedUsers = 0;
            try {
                const usersResponse = await customerGraphClient
                    .api('/users')
                    .select('id,assignedLicenses')
                    .top(999)
                    .get();
                
                totalUsers = usersResponse.value?.length || 0;
                licensedUsers = usersResponse.value?.filter((user: any) => 
                    user.assignedLicenses && user.assignedLicenses.length > 0
                ).length || 0;
            } catch (userError) {
                console.warn('⚠️ Could not fetch user information:', userError);
            }

            // Process license data with enhanced categorization
            const licenseTypes = licensesResponse.value?.map((sku: any) => {
                const totalUnits = sku.prepaidUnits?.enabled || 0;
                const assignedUnits = sku.consumedUnits || 0;
                const availableUnits = totalUnits - assignedUnits;
                const utilizationPercentage = totalUnits > 0 ? Math.round((assignedUnits / totalUnits) * 100) : 0;

                // Categorize license type
                let category: 'Basic' | 'Standard' | 'Premium' | 'Enterprise' | 'Other' = 'Other';
                let estimatedMonthlyCost = 0;

                const skuName = sku.skuPartNumber?.toUpperCase() || '';
                if (skuName.includes('E1') || skuName.includes('BASIC')) {
                    category = 'Basic';
                    estimatedMonthlyCost = totalUnits * 6; // Estimated $6/month
                } else if (skuName.includes('E3') || skuName.includes('STANDARD')) {
                    category = 'Standard';
                    estimatedMonthlyCost = totalUnits * 22; // Estimated $22/month
                } else if (skuName.includes('E5') || skuName.includes('PREMIUM')) {
                    category = 'Premium';
                    estimatedMonthlyCost = totalUnits * 38; // Estimated $38/month
                } else if (skuName.includes('ENTERPRISE') || skuName.includes('BUSINESS_PREMIUM')) {
                    category = 'Enterprise';
                    estimatedMonthlyCost = totalUnits * 32; // Estimated $32/month
                }

                return {
                    skuId: sku.skuId,
                    skuPartNumber: sku.skuPartNumber,
                    servicePlanName: sku.servicePlans?.[0]?.servicePlanName || sku.skuPartNumber,
                    totalUnits,
                    assignedUnits,
                    consumedUnits: sku.consumedUnits || 0,
                    availableUnits,
                    utilizationPercentage,
                    category,
                    estimatedMonthlyCost,
                    capabilityStatus: sku.capabilityStatus || 'Unknown',
                    servicePlans: sku.servicePlans?.map((plan: any) => ({
                        servicePlanId: plan.servicePlanId,
                        servicePlanName: plan.servicePlanName,
                        provisioningStatus: plan.provisioningStatus
                    })) || []
                };
            }) || [];

            // Calculate overview metrics
            const totalLicenses = licenseTypes.reduce((sum: number, license: any) => sum + license.totalUnits, 0);
            const assignedLicenses = licenseTypes.reduce((sum: number, license: any) => sum + license.assignedUnits, 0);
            const availableLicenses = totalLicenses - assignedLicenses;
            const utilizationPercentage = totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 0;
            const totalCost = licenseTypes.reduce((sum: number, license: any) => sum + license.estimatedMonthlyCost, 0);

            // Generate recommendations
            const recommendations: string[] = [];
            
            if (utilizationPercentage < 40) {
                recommendations.push(`Low license utilization (${utilizationPercentage}%). Consider reducing unused licenses to optimize costs.`);
            } else if (utilizationPercentage > 90) {
                recommendations.push(`High license utilization (${utilizationPercentage}%). Consider purchasing additional licenses.`);
            }

            const unusedLicenses = licenseTypes.filter((license: any) => license.utilizationPercentage < 50);
            if (unusedLicenses.length > 0) {
                recommendations.push(`${unusedLicenses.length} license type(s) have low utilization. Review: ${unusedLicenses.map((l: any) => l.skuPartNumber).join(', ')}`);
            }

            const premiumLicenses = licenseTypes.filter((license: any) => license.category === 'Premium');
            if (premiumLicenses.length > 0) {
                recommendations.push('Premium licenses detected. Ensure advanced security features are being utilized.');
            }

            if (totalUsers > 0 && licensedUsers / totalUsers < 0.8) {
                recommendations.push(`${totalUsers - licensedUsers} users may not have proper license assignments.`);
            }

            const result = {
                overview: {
                    totalLicenses,
                    assignedLicenses,
                    availableLicenses,
                    utilizationPercentage,
                    totalCost: Math.round(totalCost)
                },
                licenseTypes,
                userAssignmentSummary: {
                    totalUsers,
                    licensedUsers,
                    unlicensedUsers: totalUsers - licensedUsers,
                    usersWithMultipleLicenses: 0 // Would need more detailed analysis
                },
                recommendations,
                lastUpdated: new Date().toISOString()
            };

            console.log('✅ GraphApiService: Detailed license report generated successfully');
            return result;

        } catch (error: any) {
            console.error('❌ GraphApiService: Failed to fetch detailed license report:', error);
            
            if (error.code === 'Forbidden') {
                throw new Error('Insufficient permissions to read license and user information. Ensure Organization.Read.All and User.Read.All permissions are granted and consented.');
            }
            if (error.code === 'Unauthorized') {
                throw new Error('Authentication failed. Please verify the app registration has been consented to by the customer tenant admin.');
            }
            
            throw new Error(`Failed to fetch detailed license report: ${error.message || error}`);
        }
    }
}

// Singleton instance for reuse across functions
let graphApiServiceInstance: GraphApiService;

export function getGraphApiService(): GraphApiService {
    if (!graphApiServiceInstance) {
        graphApiServiceInstance = new GraphApiService();
    }
    return graphApiServiceInstance;
}