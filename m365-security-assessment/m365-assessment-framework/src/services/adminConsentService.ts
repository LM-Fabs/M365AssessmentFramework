import { Client } from "@microsoft/microsoft-graph-client";
import { AuthenticationProvider } from "@microsoft/microsoft-graph-client";

/**
 * Service for handling multi-tenant Azure AD admin consent workflow
 * Implements the OAuth 2.0 admin consent flow for enterprise app registration
 * Automatically extracts tenant information from authenticated user sessions
 */
export class AdminConsentService {
  private static instance: AdminConsentService;
  private readonly baseConsentUrl = 'https://login.microsoftonline.com/common/adminconsent';

  private constructor() {}

  public static getInstance(): AdminConsentService {
    if (!AdminConsentService.instance) {
      AdminConsentService.instance = new AdminConsentService();
    }
    return AdminConsentService.instance;
  }

  /**
   * Generates an admin consent URL for multi-tenant app registration
   * This allows external tenant admins to consent and register your enterprise app
   */
  public generateAdminConsentUrl(config: AdminConsentConfig): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      ...(config.state && { state: config.state }),
      ...(config.prompt && { prompt: config.prompt }),
      ...(config.scope && { scope: config.scope })
    });

    return `${this.baseConsentUrl}?${params.toString()}`;
  }

  /**
   * Automatically extracts tenant ID from the current user's OAuth2 session
   * Uses the Azure Static Web Apps authentication data
   */
  public async getCurrentUserTenantInfo(): Promise<UserTenantInfo | null> {
    try {
      const response = await fetch('/.auth/me');
      
      if (!response.ok) {
        console.warn('Could not fetch current user authentication data');
        return null;
      }

      const authData = await response.json();
      
      if (!authData.clientPrincipal) {
        console.warn('No authenticated user found');
        return null;
      }

      // Extract tenant ID from claims
      const tenantIdClaim = authData.clientPrincipal.claims?.find(
        (claim: any) => claim.typ === 'tid' || claim.typ === 'http://schemas.microsoft.com/identity/claims/tenantid'
      );

      // Extract object ID (user's unique ID in the tenant)
      const objectIdClaim = authData.clientPrincipal.claims?.find(
        (claim: any) => claim.typ === 'oid' || claim.typ === 'http://schemas.microsoft.com/identity/claims/objectidentifier'
      );

      // Extract UPN (User Principal Name)
      const upnClaim = authData.clientPrincipal.claims?.find(
        (claim: any) => claim.typ === 'upn' || claim.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn'
      );

      return {
        tenantId: tenantIdClaim?.val || null,
        objectId: objectIdClaim?.val || authData.clientPrincipal.userId,
        userPrincipalName: upnClaim?.val || authData.clientPrincipal.userDetails,
        displayName: authData.clientPrincipal.userDetails,
        userId: authData.clientPrincipal.userId,
        identityProvider: authData.clientPrincipal.identityProvider
      };

    } catch (error) {
      console.error('Error extracting user tenant info:', error);
      return null;
    }
  }

  /**
   * Generates a consent URL automatically using the current user's tenant information
   * This is useful when generating consent URLs for the user's own organization
   */
  public async generateConsentUrlForCurrentUser(config: Omit<CustomerConsentConfig, 'customerTenantId'>): Promise<string | null> {
    const userTenantInfo = await this.getCurrentUserTenantInfo();
    
    if (!userTenantInfo?.tenantId) {
      console.warn('Could not determine current user tenant ID');
      return null;
    }

    return this.generateCustomerConsentUrl({
      ...config,
      customerTenantId: userTenantInfo.tenantId
    });
  }

  /**
   * Alternative method to extract tenant ID from MSAL browser session
   * This works with MSAL.js when using browser-based authentication
   */
  public getTenantIdFromMSAL(): string | null {
    try {
      // Try to get tenant ID from MSAL cache
      const accounts = window.localStorage.getItem('msal.account.keys');
      if (accounts) {
        const accountKeys = JSON.parse(accounts);
        if (accountKeys.length > 0) {
          const accountData = window.localStorage.getItem(accountKeys[0]);
          if (accountData) {
            const account = JSON.parse(accountData);
            return account.tenantId || account.realm || null;
          }
        }
      }

      // Alternative: Check session storage
      const sessionAccount = window.sessionStorage.getItem('msal.account.keys');
      if (sessionAccount) {
        const sessionKeys = JSON.parse(sessionAccount);
        if (sessionKeys.length > 0) {
          const sessionData = window.sessionStorage.getItem(sessionKeys[0]);
          if (sessionData) {
            const account = JSON.parse(sessionData);
            return account.tenantId || account.realm || null;
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to extract tenant ID from MSAL session:', error);
      return null;
    }
  }

  /**
   * Generates a consent URL with automatic tenant detection from current session
   * Tries multiple methods to determine the current user's tenant ID
   */
  public async generateConsentUrlWithAutoTenant(
    clientId: string,
    redirectUri: string,
    customerId: string,
    scope?: string
  ): Promise<{ url: string | null; tenantId: string | null; method: string }> {
    let tenantId: string | null = null;
    let method = 'none';

    // Method 1: Try Azure Static Web Apps auth endpoint
    try {
      const userTenantInfo = await this.getCurrentUserTenantInfo();
      if (userTenantInfo?.tenantId) {
        tenantId = userTenantInfo.tenantId;
        method = 'static-web-apps';
      }
    } catch (error) {
      console.debug('Static Web Apps auth method failed:', error);
    }

    // Method 2: Try MSAL browser session if the first method fails
    if (!tenantId) {
      tenantId = this.getTenantIdFromMSAL();
      if (tenantId) {
        method = 'msal-browser';
      }
    }

    // Method 3: Try to extract from current URL if it contains tenant info
    if (!tenantId) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTenantId = urlParams.get('tenant') || urlParams.get('tenantId');
      if (urlTenantId) {
        tenantId = urlTenantId;
        method = 'url-parameter';
      }
    }

    if (!tenantId) {
      console.warn('Could not automatically determine tenant ID');
      return { url: null, tenantId: null, method };
    }

    const url = this.generateCustomerConsentUrl({
      clientId,
      redirectUri,
      customerId,
      customerTenantId: tenantId,
      scope
    });

    return { url, tenantId, method };
  }

  /**
   * Generates consent URL for external customer tenant with automatic current user context
   * Automatically includes the current user's tenant information in the state for tracking
   */
  public async generateCustomerConsentUrlWithCurrentUser(config: {
    clientId: string;
    redirectUri: string;
    customerId: string;
    customerTenantId: string;
    scope?: string;
  }): Promise<string | null> {
    const currentUserInfo = await this.getCurrentUserTenantInfo();
    
    if (!currentUserInfo) {
      console.warn('Could not extract current user information for consent URL generation');
      return null;
    }

    // Enhanced state with both customer and current user context
    const stateData = {
      customerId: config.customerId,
      customerTenantId: config.customerTenantId,
      currentUserTenantId: currentUserInfo.tenantId,
      currentUserId: currentUserInfo.userId,
      currentUserUPN: currentUserInfo.userPrincipalName,
      timestamp: Date.now(),
      requestId: this.generateRequestId()
    };

    const encodedState = encodeURIComponent(JSON.stringify(stateData));

    return this.generateAdminConsentUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state: encodedState,
      scope: config.scope || 'https://graph.microsoft.com/.default'
    });
  }

  /**
   * Validates that the current user has appropriate permissions to initiate admin consent
   * Checks if the user is likely an admin in their tenant
   */
  public async validateCurrentUserAdminStatus(): Promise<AdminValidationResult> {
    const userInfo = await this.getCurrentUserTenantInfo();
    
    if (!userInfo) {
      return {
        isValid: false,
        errors: ['Could not determine current user information'],
        userInfo: null
      };
    }

    const errors: string[] = [];
    let warnings: string[] = [];

    // Basic validations
    if (!userInfo.tenantId) {
      errors.push('Current user tenant ID could not be determined');
    }

    if (!userInfo.userPrincipalName || !userInfo.userPrincipalName.includes('@')) {
      errors.push('Current user principal name is invalid');
    }

    // Check if UPN suggests this is a work/school account (not personal)
    if (userInfo.userPrincipalName?.includes('@outlook.com') || 
        userInfo.userPrincipalName?.includes('@hotmail.com') || 
        userInfo.userPrincipalName?.includes('@gmail.com')) {
      warnings.push('Personal account detected - admin consent requires work/school account');
    }

    // Additional checks could be added here for admin roles
    // Note: Full admin role validation would require Graph API calls with appropriate permissions

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      userInfo,
      recommendations: errors.length > 0 ? [
        'Ensure you are signed in with a work or school account',
        'Verify that your account has Global Administrator privileges',
        'Contact your IT administrator if you need admin access'
      ] : []
    };
  }

  /**
   * Generates a consent URL with customer-specific state for tracking
   */
  public generateCustomerConsentUrl(config: CustomerConsentConfig): string {
    // Encode customer information in state parameter for callback tracking
    const stateData = {
      customerId: config.customerId,
      customerTenant: config.customerTenantId,
      timestamp: Date.now(),
      requestId: this.generateRequestId()
    };

    const encodedState = encodeURIComponent(JSON.stringify(stateData));

    return this.generateAdminConsentUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state: encodedState,
      scope: config.scope || 'https://graph.microsoft.com/.default'
    });
  }

  /**
   * Parses the callback parameters from admin consent flow
   */
  public parseConsentCallback(url: string): ConsentCallbackResult {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const adminConsent = params.get('admin_consent') === 'True';
    const tenant = params.get('tenant');
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const state = params.get('state');

    let stateData: any = null;
    if (state) {
      try {
        stateData = JSON.parse(decodeURIComponent(state));
      } catch (e) {
        console.warn('Failed to parse state parameter:', e);
      }
    }

    return {
      success: adminConsent && !error,
      adminConsent,
      tenantId: tenant,
      error,
      errorDescription,
      stateData
    };
  }

  /**
   * Validates that the application is properly configured for multi-tenant consent
   */
  public async validateMultiTenantConfiguration(
    clientId: string,
    graphClient: Client
  ): Promise<MultiTenantValidationResult> {
    try {
      const app = await graphClient
        .api(`/applications`)
        .filter(`appId eq '${clientId}'`)
        .get();

      if (!app.value || app.value.length === 0) {
        return {
          isValid: false,
          errors: ['Application not found']
        };
      }

      const application = app.value[0];
      const errors: string[] = [];

      // Check if app supports multi-tenant
      const isMultiTenant = application.signInAudience === 'AzureADMultipleOrgs' || 
                           application.signInAudience === 'AzureADandPersonalMicrosoftAccount';
      
      if (!isMultiTenant) {
        errors.push('Application must be configured for multi-tenant access');
      }

      // Check required API permissions
      const requiredPermissions = [
        'User.Read.All',                    // Read user profiles
        'Directory.Read.All',               // Read directory data
        'Reports.Read.All',                 // Read usage reports
        'Policy.Read.All',                  // Read security policies
        'SecurityEvents.Read.All',          // Read security events
        'IdentityRiskEvent.Read.All',       // Read identity risk events
        'Agreement.Read.All',               // Read terms of use agreements
        'AuditLog.Read.All',                // Read audit logs
        'Organization.Read.All',            // Read organization info
        'RoleManagement.Read.Directory'     // Read role assignments - CRITICAL for privileged roles
      ];

      const grantedPermissions = application.requiredResourceAccess
        ?.find((ra: any) => ra.resourceAppId === '00000003-0000-0000-c000-000000000000') // Microsoft Graph
        ?.resourceAccess?.map((access: any) => access.id) || [];

      const missingPermissions = requiredPermissions.filter(
        perm => !this.hasPermission(perm, grantedPermissions)
      );

      if (missingPermissions.length > 0) {
        errors.push(`Missing required permissions: ${missingPermissions.join(', ')}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        application
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error}`]
      };
    }
  }

  /**
   * Feature-based permission groups for least privilege approach
   * Each group represents a specific assessment feature and its required permissions
   */
  public static readonly FEATURE_PERMISSION_GROUPS = {
    // Core user and directory information - Always required
    core: {
      name: 'Core Assessment',
      description: 'Basic user and directory information',
      permissions: [
        'User.Read.All',           // Read user profiles
        'Directory.Read.All',      // Read directory data
        'Organization.Read.All'    // Read organization info
      ],
      required: true
    },
    
    // Security reports and compliance data
    reports: {
      name: 'Security Reports',
      description: 'Access to security reports and compliance data',
      permissions: [
        'Reports.Read.All',        // Read usage reports
        'SecurityEvents.Read.All'  // Read security events
      ],
      required: false
    },
    
    // Conditional Access Policies - CRITICAL for your issue
    policies: {
      name: 'Security Policies',
      description: 'Access to conditional access and security policies',
      permissions: [
        'Policy.Read.All'          // Read security policies - FIXES CA policies issue
      ],
      required: false
    },
    
    // Privileged Identity Management - CRITICAL for your issue
    privilegedRoles: {
      name: 'Privileged Roles',
      description: 'Access to privileged role assignments and PIM data',
      permissions: [
        'RoleManagement.Read.Directory'  // Read role assignments - FIXES privileged roles issue
      ],
      required: false
    },
    
    // Risk and threat intelligence
    riskIntelligence: {
      name: 'Risk Intelligence',
      description: 'Identity risk events and threat intelligence',
      permissions: [
        'IdentityRiskEvent.Read.All'  // Read identity risk events
      ],
      required: false
    },
    
    // Compliance and audit logs
    compliance: {
      name: 'Compliance & Audit',
      description: 'Audit logs and compliance agreements',
      permissions: [
        'AuditLog.Read.All',       // Read audit logs
        'Agreement.Read.All'       // Read terms of use agreements
      ],
      required: false
    }
  } as const;

  /**
   * Gets the current permissions granted to the app registration
   */
  public async getCurrentAppPermissions(
    clientId: string,
    accessToken: string
  ): Promise<{ success: boolean; permissions?: string[]; error?: string }> {
    try {
      // Get current app registration
      const appResponse = await fetch(
        `https://graph.microsoft.com/v1.0/applications?$filter=appId eq '${clientId}'`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!appResponse.ok) {
        throw new Error(`Failed to get app registration: ${appResponse.statusText}`);
      }

      const appData = await appResponse.json();
      if (!appData.value || appData.value.length === 0) {
        throw new Error('App registration not found');
      }

      const application = appData.value[0];
      
      // Get current Microsoft Graph permissions
      const currentGraphPermissions = application.requiredResourceAccess?.find(
        (ra: any) => ra.resourceAppId === '00000003-0000-0000-c000-000000000000'
      );

      const currentPermissionIds = currentGraphPermissions?.resourceAccess?.map(
        (access: any) => access.id
      ) || [];

      // Map permission IDs back to permission names
      const permissionMapping = this.getPermissionMapping();
      const reverseMapping = Object.fromEntries(
        Object.entries(permissionMapping).map(([name, id]) => [id, name])
      );

      const currentPermissionNames = currentPermissionIds
        .map((id: string) => reverseMapping[id])
        .filter(Boolean);

      return {
        success: true,
        permissions: currentPermissionNames
      };

    } catch (error) {
      console.error('❌ Error getting current app permissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Analyzes which feature groups are currently enabled based on granted permissions
   */
  public analyzeEnabledFeatures(currentPermissions: string[]): FeatureAnalysis {
    const enabledFeatures: string[] = [];
    const partialFeatures: string[] = [];
    const missingFeatures: string[] = [];

    for (const [groupKey, group] of Object.entries(AdminConsentService.FEATURE_PERMISSION_GROUPS)) {
      const hasAllPermissions = group.permissions.every(perm => 
        currentPermissions.includes(perm)
      );
      const hasSomePermissions = group.permissions.some(perm => 
        currentPermissions.includes(perm)
      );

      if (hasAllPermissions) {
        enabledFeatures.push(groupKey);
      } else if (hasSomePermissions) {
        partialFeatures.push(groupKey);
      } else {
        missingFeatures.push(groupKey);
      }
    }

    return {
      enabledFeatures,
      partialFeatures,
      missingFeatures,
      currentPermissions
    };
  }

  /**
   * Updates app registration permissions with specific feature groups (LEAST PRIVILEGE APPROACH)
   * Only adds the permissions for the selected features, maintaining existing permissions
   */
  public async updateAppRegistrationPermissions(
    clientId: string,
    accessToken: string,
    options: {
      featureGroups?: string[];           // Feature groups to enable (e.g., ['policies', 'privilegedRoles'])
      additionalPermissions?: string[];   // Individual permissions to add
      replaceAll?: boolean;               // If true, replaces all permissions; if false, adds to existing
    } = {}
  ): Promise<PermissionUpdateResult> {
    try {
      console.log('🔄 Updating app registration permissions...');
      console.log('📋 Client ID:', clientId);
      console.log('📋 Feature groups:', options.featureGroups);
      console.log('📋 Additional permissions:', options.additionalPermissions);

      // Step 1: Get current app registration
      const appResponse = await fetch(
        `https://graph.microsoft.com/v1.0/applications?$filter=appId eq '${clientId}'`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!appResponse.ok) {
        throw new Error(`Failed to get app registration: ${appResponse.statusText}`);
      }

      const appData = await appResponse.json();
      if (!appData.value || appData.value.length === 0) {
        throw new Error('App registration not found');
      }

      const application = appData.value[0];
      const objectId = application.id;

      // Step 2: Get current permissions (if not replacing all)
      let existingPermissions: string[] = [];
      if (!options.replaceAll) {
        const currentPermsResult = await this.getCurrentAppPermissions(clientId, accessToken);
        if (currentPermsResult.success) {
          existingPermissions = currentPermsResult.permissions || [];
        }
      }

      // Step 3: Collect permissions from selected feature groups
      const featurePermissions: string[] = [];
      if (options.featureGroups) {
        for (const groupKey of options.featureGroups) {
          const group = AdminConsentService.FEATURE_PERMISSION_GROUPS[groupKey as keyof typeof AdminConsentService.FEATURE_PERMISSION_GROUPS];
          if (group) {
            featurePermissions.push(...group.permissions);
          }
        }
      }

      // Step 4: Always include core permissions (required for basic functionality)
      const corePermissions = AdminConsentService.FEATURE_PERMISSION_GROUPS.core.permissions;

      // Step 5: Combine all permissions
      const allPermissions = [
        ...existingPermissions,           // Keep existing (unless replaceAll is true)
        ...corePermissions,              // Always include core
        ...featurePermissions,           // Add selected feature permissions
        ...(options.additionalPermissions || [])  // Add any additional permissions
      ];

      // Remove duplicates
      const uniquePermissions = Array.from(new Set(allPermissions));

      // Step 6: Map permissions to Graph API resource access format
      const permissionMapping = this.getPermissionMapping();
      const resourceAccess = uniquePermissions.map(permission => {
        const permissionId = permissionMapping[permission];
        if (!permissionId) {
          throw new Error(`Unknown permission: ${permission}`);
        }
        return {
          id: permissionId,
          type: 'Role' // Application permissions
        };
      });

      // Step 7: Preserve other existing resource access (non-Graph APIs)
      const otherResourceAccess = application.requiredResourceAccess?.filter(
        (ra: any) => ra.resourceAppId !== '00000003-0000-0000-c000-000000000000'
      ) || [];

      // Step 8: Update app registration
      const updatePayload = {
        requiredResourceAccess: [
          {
            resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
            resourceAccess: resourceAccess
          },
          ...otherResourceAccess
        ]
      };

      console.log('📋 Updating app registration with permissions:', uniquePermissions);

      const updateResponse = await fetch(
        `https://graph.microsoft.com/v1.0/applications/${objectId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatePayload)
        }
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`Failed to update app registration: ${errorData.error?.message || updateResponse.statusText}`);
      }

      // Step 9: Analyze what changed
      const newPermissions = uniquePermissions.filter(p => !existingPermissions.includes(p));
      const enabledFeatures = this.analyzeEnabledFeatures(uniquePermissions);

      console.log('✅ App registration updated successfully');
      console.log('📋 Total permissions:', uniquePermissions.length);
      console.log('📋 New permissions added:', newPermissions);
      console.log('⚠️  IMPORTANT: Admin consent is required for new permissions');
      console.log('🔗 Grant admin consent in Azure Portal: API permissions > Grant admin consent');

      return {
        success: true,
        permissions: uniquePermissions,
        newPermissions,
        enabledFeatures: enabledFeatures.enabledFeatures,
        partialFeatures: enabledFeatures.partialFeatures,
        consentsRequired: newPermissions.length > 0
      };

    } catch (error) {
      console.error('❌ Error updating app registration permissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generates a consent URL for specific feature groups
   * This allows customers to consent only to the permissions they need
   */
  public async generateFeatureBasedConsentUrl(
    clientId: string,
    redirectUri: string,
    customerId: string,
    featureGroups: string[]
  ): Promise<{ url: string | null; permissions: string[]; features: string[] }> {
    // Collect permissions for selected features
    const permissions: string[] = [];
    const corePermissions = AdminConsentService.FEATURE_PERMISSION_GROUPS.core.permissions;
    permissions.push(...corePermissions); // Always include core

    for (const groupKey of featureGroups) {
      const group = AdminConsentService.FEATURE_PERMISSION_GROUPS[groupKey as keyof typeof AdminConsentService.FEATURE_PERMISSION_GROUPS];
      if (group) {
        permissions.push(...group.permissions);
      }
    }

    const uniquePermissions = Array.from(new Set(permissions));

    // Create state with feature information
    const stateData = {
      customerId,
      featureGroups,
      permissions: uniquePermissions,
      timestamp: Date.now(),
      requestId: this.generateRequestId()
    };

    const consentResult = await this.generateConsentUrlWithAutoTenant(
      clientId,
      redirectUri,
      customerId,
      'https://graph.microsoft.com/.default'
    );

    if (consentResult.url) {
      // Add our feature state to the URL
      const url = new URL(consentResult.url);
      url.searchParams.set('state', encodeURIComponent(JSON.stringify(stateData)));
      
      return {
        url: url.toString(),
        permissions: uniquePermissions,
        features: featureGroups
      };
    }

    return {
      url: null,
      permissions: uniquePermissions,
      features: featureGroups
    };
  }

  /**
   * Gets the complete permission mapping for Microsoft Graph API
   */
  private getPermissionMapping(): Record<string, string> {
    return {
      'User.Read.All': 'df021288-bdef-4463-88db-98f22de89214',
      'Directory.Read.All': '7ab1d382-f21e-4acd-a863-ba3e13f7da61',
      'Reports.Read.All': '230c1aed-a721-4c5d-9cb4-a90514e508ef',
      'Policy.Read.All': '246dd0d5-5bd0-4def-940b-0421030a5b68',
      'SecurityEvents.Read.All': 'bf394140-e372-4bf9-a898-299cfc7564e5',
      'IdentityRiskEvent.Read.All': '6e472fd1-ad78-48da-a0f0-97ab2c6b769e',
      'Agreement.Read.All': 'ef4b5d93-3104-4867-9b0b-5cd61b5ffb6f',
      'AuditLog.Read.All': 'b0afded3-3588-46d8-8b3d-9842eff778da',
      'Organization.Read.All': '498476ce-e0fe-48b0-b801-37ba7e2685c6',
      'RoleManagement.Read.Directory': '483bed4a-2ad3-4361-a73b-c83ccdbdc53c'
    };
  }

  /**
   * Creates an enterprise application in the customer tenant after consent
   * This is called from the backend after successful admin consent
   */
  public async createEnterpriseApplication(
    customerTenantId: string,
    clientId: string,
    accessToken: string
  ): Promise<EnterpriseAppResult> {
    try {
      // Create service principal (enterprise app) in customer tenant
      const servicePrincipalData = {
        appId: clientId,
        displayName: 'M365 Security Assessment Framework',
        description: 'Enterprise application for M365 security assessments and compliance reporting',
        tags: [
          'WindowsAzureActiveDirectoryIntegratedApp',
          'SecurityAssessment',
          'ComplianceReporting'
        ]
      };

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/servicePrincipals`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(servicePrincipalData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create service principal: ${errorData.error?.message || response.statusText}`);
      }

      const servicePrincipal = await response.json();

      return {
        success: true,
        servicePrincipalId: servicePrincipal.id,
        appId: servicePrincipal.appId,
        displayName: servicePrincipal.displayName,
        createdDateTime: servicePrincipal.createdDateTime
      };

    } catch (error) {
      console.error('Error creating enterprise application:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private hasPermission(permissionName: string, grantedPermissionIds: string[]): boolean {
    // Complete mapping of permission names to Graph API permission IDs
    // Based on Microsoft Graph permissions reference
    const permissionMap: Record<string, string> = {
      'User.Read': 'e1fe6dd8-ba31-4d61-89e7-88639da4683d',
      'User.Read.All': 'df021288-bdef-4463-88db-98f22de89214',
      'Directory.Read.All': '7ab1d382-f21e-4acd-a863-ba3e13f7da61',
      'Reports.Read.All': '230c1aed-a721-4c5d-9cb4-a90514e508ef',
      'Policy.Read.All': '246dd0d5-5bd0-4def-940b-0421030a5b68',
      'SecurityEvents.Read.All': 'bf394140-e372-4bf9-a898-299cfc7564e5',
      'IdentityRiskEvent.Read.All': '6e472fd1-ad78-48da-a0f0-97ab2c6b769e',
      'Agreement.Read.All': 'ef4b5d93-3104-4867-9b0b-5cd61b5ffb6f',
      'AuditLog.Read.All': 'b0afded3-3588-46d8-8b3d-9842eff778da',
      'Organization.Read.All': '498476ce-e0fe-48b0-b801-37ba7e2685c6',
      'RoleManagement.Read.Directory': '483bed4a-2ad3-4361-a73b-c83ccdbdc53c'
    };

    const permissionId = permissionMap[permissionName];
    return permissionId ? grantedPermissionIds.includes(permissionId) : false;
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}

// Types and interfaces

/**
 * Result of analyzing which features are enabled based on current permissions
 */
export interface FeatureAnalysis {
  enabledFeatures: string[];        // Feature groups that have all required permissions
  partialFeatures: string[];       // Feature groups with some but not all permissions
  missingFeatures: string[];       // Feature groups with no permissions granted
  currentPermissions: string[];    // All currently granted permissions
}

/**
 * Result of updating app registration permissions
 */
export interface PermissionUpdateResult {
  success: boolean;
  error?: string;
  permissions?: string[];          // All permissions after update
  newPermissions?: string[];       // Permissions that were newly added
  enabledFeatures?: string[];      // Feature groups now fully enabled
  partialFeatures?: string[];     // Feature groups partially enabled
  consentsRequired?: boolean;      // Whether admin consent is needed for new permissions
}

export interface AdminValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  userInfo: UserTenantInfo | null;
  recommendations?: string[];
}

export interface UserTenantInfo {
  tenantId: string | null;
  tenantName?: string;
  userPrincipalName: string;
  objectId: string;
  displayName: string;
  userId: string;
  identityProvider: string;
  domain?: string;
}

export interface AdminConsentConfig {
  clientId: string;
  redirectUri: string;
  state?: string;
  prompt?: 'admin_consent' | 'consent';
  scope?: string;
}

export interface CustomerConsentConfig {
  clientId: string;
  redirectUri: string;
  customerId: string;
  customerTenantId: string;
  scope?: string;
}

export interface ConsentCallbackResult {
  success: boolean;
  adminConsent: boolean;
  tenantId: string | null;
  error: string | null;
  errorDescription: string | null;
  stateData: any;
}

export interface MultiTenantValidationResult {
  isValid: boolean;
  errors: string[];
  application?: any;
}

export interface EnterpriseAppResult {
  success: boolean;
  servicePrincipalId?: string;
  appId?: string;
  displayName?: string;
  createdDateTime?: string;
  error?: string;
}

/**
 * Configuration for M365 Assessment Framework multi-tenant setup
 */
export const M365_ASSESSMENT_CONFIG = {
  // Your master application's client ID - get this from YOUR Azure AD app registration
  // This is the same ID for ALL customers - it identifies YOUR multi-tenant app
  get clientId(): string {
    // Check for environment variable first (production/deployed apps)
    const envClientId = process.env.REACT_APP_CLIENT_ID || process.env.AZURE_CLIENT_ID;
    if (envClientId && envClientId !== 'your-client-id') {
      console.log('✅ Using environment client ID:', envClientId.substring(0, 8) + '...');
      return envClientId;
    }
    
    // Fallback to hardcoded ID for development (replace with your actual client ID)
    // TODO: Replace this with your actual Azure AD application client ID
    const fallbackClientId = 'd1cc9e16-9194-4892-92c5-473c9f65dcb3';
    
    console.warn('⚠️ Using fallback client ID. For production, set REACT_APP_CLIENT_ID environment variable.');
    console.log('🔧 Available env vars:', {
      REACT_APP_CLIENT_ID: process.env.REACT_APP_CLIENT_ID ? 'SET' : 'NOT SET',
      AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID ? 'SET' : 'NOT SET'
    });
    return fallbackClientId;
  },
  
  // Standard permissions required for security assessment
  requiredPermissions: [
    'User.Read.All',                    // Read user profiles
    'Directory.Read.All',               // Read directory data
    'Reports.Read.All',                 // Read usage reports
    'Policy.Read.All',                  // Read security policies
    'SecurityEvents.Read.All',          // Read security events
    'IdentityRiskEvent.Read.All',       // Read identity risk events
    'Agreement.Read.All',               // Read terms of use agreements
    'AuditLog.Read.All',                // Read audit logs
    'Organization.Read.All',            // Read organization info
    'RoleManagement.Read.Directory'     // Read role assignments
  ],
  
  // Default redirect URI for production - where customers land after consent
  get defaultRedirectUri(): string {
    const envRedirectUri = process.env.REACT_APP_CONSENT_REDIRECT_URI;
    if (envRedirectUri) {
      return envRedirectUri;
    }
    
    // Use the correct Azure Static Web Apps URL for production
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000';
    if (origin.includes('azurestaticapps.net')) {
      return 'https://victorious-pond-069956e03.6.azurestaticapps.net/api/consent-callback';
    }
    
    // Fallback for local development
    return `${origin}/api/consent-callback`;
  },
  
  // Application display name in customer tenants
  applicationDisplayName: 'M365 Security Assessment Framework',
  
  // Description shown during consent
  applicationDescription: 'Comprehensive security assessment and compliance reporting for Microsoft 365 environments'
} as const;
