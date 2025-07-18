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
        'User.Read',
        'Directory.Read.All',
        'Reports.Read.All'
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
    // Map permission names to IDs (simplified - in production, use Microsoft Graph permission reference)
    const permissionMap: Record<string, string> = {
      'User.Read': 'e1fe6dd8-ba31-4d61-89e7-88639da4683d',
      'Directory.Read.All': '7ab1d382-f21e-4acd-a863-ba3e13f7da61',
      'Reports.Read.All': '02e97553-ed7b-43d0-ab3c-f8bace0d040c'
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
    
    // Construct from current origin for dynamic environments
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000';
    return `${origin}/api/consent-callback`;
  },
  
  // Application display name in customer tenants
  applicationDisplayName: 'M365 Security Assessment Framework',
  
  // Description shown during consent
  applicationDescription: 'Comprehensive security assessment and compliance reporting for Microsoft 365 environments'
} as const;
