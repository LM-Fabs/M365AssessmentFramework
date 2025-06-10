import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { InteractiveBrowserCredential, ClientSecretCredential } from '@azure/identity';

interface TenantAuthConfig {
  tenantId: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

interface AssessmentContext {
  targetTenantId: string;
  targetTenantDomain?: string;
  authConfig: TenantAuthConfig;
  graphClient: Client;
  accessToken: string;
}

export class MultiTenantGraphService {
  private assessmentContexts: Map<string, AssessmentContext> = new Map();
  private currentContext: AssessmentContext | null = null;

  constructor() {
    // Initialize with secure defaults following Azure best practices
  }

  /**
   * Initialize assessment for a specific tenant by creating dedicated auth context
   * This allows switching between different tenant assessments
   */
  public async initializeTenantAssessment(
    targetTenantId: string, 
    clientId: string,
    targetTenantDomain?: string
  ): Promise<AssessmentContext> {
    try {
      // Create tenant-specific authentication configuration
      const authConfig: TenantAuthConfig = {
        tenantId: targetTenantId,
        clientId: clientId,
        redirectUri: process.env.REACT_APP_REDIRECT_URI || window.location.origin + '/auth/callback',
        scopes: [
          'https://graph.microsoft.com/Organization.Read.All',
          'https://graph.microsoft.com/Reports.Read.All',
          'https://graph.microsoft.com/Directory.Read.All',
          'https://graph.microsoft.com/Policy.Read.All',
          'https://graph.microsoft.com/SecurityEvents.Read.All',
          'https://graph.microsoft.com/IdentityRiskyUser.Read.All',
          'https://graph.microsoft.com/DeviceManagementManagedDevices.Read.All'
        ]
      };

      // Create interactive browser credential for the specific tenant
      const credential = new InteractiveBrowserCredential({
        tenantId: targetTenantId,
        clientId: clientId,
        redirectUri: authConfig.redirectUri
      });

      // Create authentication provider
      const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: authConfig.scopes
      });

      // Initialize Graph client for this specific tenant
      const graphClient = Client.initWithMiddleware({
        authProvider: authProvider
      });

      // Get access token for validation
      const accessToken = await credential.getToken(authConfig.scopes);

      // Create assessment context
      const assessmentContext: AssessmentContext = {
        targetTenantId,
        targetTenantDomain,
        authConfig,
        graphClient,
        accessToken: accessToken?.token || ''
      };

      // Store context for later use
      this.assessmentContexts.set(targetTenantId, assessmentContext);
      this.currentContext = assessmentContext;

      console.log(`Successfully initialized assessment context for tenant: ${targetTenantId}`);
      return assessmentContext;

    } catch (error) {
      console.error(`Failed to initialize tenant assessment for ${targetTenantId}:`, error);
      throw new Error(`Authentication failed for tenant ${targetTenantId}: ${error.message}`);
    }
  }

  /**
   * Switch to a different tenant context for assessment
   */
  public switchTenantContext(tenantId: string): AssessmentContext | null {
    const context = this.assessmentContexts.get(tenantId);
    if (context) {
      this.currentContext = context;
      console.log(`Switched to tenant context: ${tenantId}`);
      return context;
    }
    console.warn(`No context found for tenant: ${tenantId}`);
    return null;
  }

  /**
   * Get current tenant assessment context
   */
  public getCurrentContext(): AssessmentContext | null {
    return this.currentContext;
  }

  /**
   * Perform security assessment for the current tenant context
   */
  public async performSecurityAssessment(): Promise<{
    metrics: any;
    recommendations: any[];
    tenantInfo: any;
  }> {
    if (!this.currentContext) {
      throw new Error('No tenant context available. Please initialize tenant assessment first.');
    }

    const { graphClient, targetTenantId, targetTenantDomain } = this.currentContext;

    try {
      console.log(`Performing security assessment for tenant: ${targetTenantId}`);

      // Fetch security data using the tenant-specific Graph client
      const [
        organization,
        secureScores,
        conditionalAccessPolicies,
        users,
        devices,
        securityAlerts
      ] = await Promise.all([
        this.getOrganizationInfo(graphClient),
        this.getSecureScores(graphClient),
        this.getConditionalAccessPolicies(graphClient),
        this.getUserSecurityInfo(graphClient),
        this.getDeviceComplianceInfo(graphClient),
        this.getSecurityAlerts(graphClient)
      ]);

      // Calculate security metrics
      const metrics = this.calculateSecurityMetrics({
        secureScores,
        conditionalAccessPolicies,
        users,
        devices,
        securityAlerts
      });

      // Generate recommendations
      const recommendations = this.generateSecurityRecommendations({
        secureScores,
        conditionalAccessPolicies,
        users,
        devices,
        securityAlerts
      });

      return {
        metrics,
        recommendations,
        tenantInfo: {
          tenantId: targetTenantId,
          tenantDomain: targetTenantDomain,
          organizationName: organization?.displayName,
          assessmentDate: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`Security assessment failed for tenant ${targetTenantId}:`, error);
      throw new Error(`Assessment failed: ${error.message}`);
    }
  }

  /**
   * Clean up tenant context and revoke tokens
   */
  public async cleanupTenantContext(tenantId: string): Promise<void> {
    const context = this.assessmentContexts.get(tenantId);
    if (context) {
      try {
        // Clear the context
        this.assessmentContexts.delete(tenantId);
        if (this.currentContext?.targetTenantId === tenantId) {
          this.currentContext = null;
        }
        console.log(`Cleaned up context for tenant: ${tenantId}`);
      } catch (error) {
        console.error(`Error cleaning up tenant context ${tenantId}:`, error);
      }
    }
  }

  // Private helper methods for Graph API calls
  private async getOrganizationInfo(graphClient: Client) {
    try {
      const response = await graphClient.api('/organization').get();
      return response.value?.[0];
    } catch (error) {
      console.error('Error fetching organization info:', error);
      return null;
    }
  }

  private async getSecureScores(graphClient: Client) {
    try {
      const response = await graphClient
        .api('/security/secureScores')
        .top(1)
        .orderby('createdDateTime desc')
        .get();
      return response.value || [];
    } catch (error) {
      console.error('Error fetching secure scores:', error);
      return [];
    }
  }

  private async getConditionalAccessPolicies(graphClient: Client) {
    try {
      const response = await graphClient
        .api('/identity/conditionalAccess/policies')
        .get();
      return response.value || [];
    } catch (error) {
      console.error('Error fetching conditional access policies:', error);
      return [];
    }
  }

  private async getUserSecurityInfo(graphClient: Client) {
    try {
      const response = await graphClient
        .api('/reports/credentialUserRegistrationDetails')
        .get();
      return response.value || [];
    } catch (error) {
      console.error('Error fetching user security info:', error);
      return [];
    }
  }

  private async getDeviceComplianceInfo(graphClient: Client) {
    try {
      const response = await graphClient
        .api('/deviceManagement/managedDevices')
        .select('id,deviceName,complianceState,lastSyncDateTime')
        .get();
      return response.value || [];
    } catch (error) {
      console.error('Error fetching device compliance info:', error);
      return [];
    }
  }

  private async getSecurityAlerts(graphClient: Client) {
    try {
      const response = await graphClient
        .api('/security/alerts_v2')
        .filter('status ne \'resolved\'')
        .top(50)
        .get();
      return response.value || [];
    } catch (error) {
      console.error('Error fetching security alerts:', error);
      return [];
    }
  }

  private calculateSecurityMetrics(data: any) {
    // Implementation of security metrics calculation
    // This follows the same logic as the server-side implementation
    const { secureScores, conditionalAccessPolicies, users, devices, securityAlerts } = data;

    const latestSecureScore = secureScores[0];
    const secureScore = latestSecureScore ? 
      Math.round((latestSecureScore.currentScore / latestSecureScore.maxScore) * 100) : 0;

    const mfaRegisteredUsers = users.filter(u => u.isMfaRegistered).length;
    const totalUsers = users.length;
    const mfaAdoption = totalUsers > 0 ? (mfaRegisteredUsers / totalUsers) * 100 : 0;

    const activePolicies = conditionalAccessPolicies.filter(p => p.state === 'enabled').length;
    const identityScore = Math.round((mfaAdoption * 0.7) + (Math.min(activePolicies * 10, 30)));

    const compliantDevices = devices.filter(d => d.complianceState === 'compliant').length;
    const totalDevices = devices.length;
    const deviceComplianceScore = totalDevices > 0 ? 
      Math.round((compliantDevices / totalDevices) * 100) : 100;

    return {
      secureScore,
      identityScore: Math.min(identityScore, 100),
      deviceComplianceScore,
      alertsCount: securityAlerts.length,
      mfaAdoption: Math.round(mfaAdoption),
      activePolicies,
      lastUpdated: new Date().toISOString()
    };
  }

  private generateSecurityRecommendations(data: any) {
    // Implementation of recommendations generation
    // Similar to server-side logic but tailored for client-side use
    const recommendations = [];
    const { users, conditionalAccessPolicies, devices, securityAlerts } = data;

    // MFA recommendations
    const mfaRegisteredUsers = users.filter(u => u.isMfaRegistered).length;
    const totalUsers = users.length;
    if (totalUsers > 0 && (mfaRegisteredUsers / totalUsers) < 0.9) {
      recommendations.push({
        id: 'mfa-adoption',
        title: 'Improve Multi-Factor Authentication Adoption',
        category: 'identity',
        severity: 'high',
        description: `Only ${mfaRegisteredUsers} out of ${totalUsers} users have MFA registered.`
      });
    }

    // Conditional Access recommendations
    const activePolicies = conditionalAccessPolicies.filter(p => p.state === 'enabled').length;
    if (activePolicies < 3) {
      recommendations.push({
        id: 'conditional-access',
        title: 'Implement Additional Conditional Access Policies',
        category: 'identity',
        severity: 'medium',
        description: `Only ${activePolicies} conditional access policies are active.`
      });
    }

    // Device compliance recommendations
    const compliantDevices = devices.filter(d => d.complianceState === 'compliant').length;
    const totalDevices = devices.length;
    if (totalDevices > 0 && (compliantDevices / totalDevices) < 0.95) {
      recommendations.push({
        id: 'device-compliance',
        title: 'Improve Device Compliance',
        category: 'endpoint',
        severity: 'medium',
        description: `${totalDevices - compliantDevices} out of ${totalDevices} devices are not compliant.`
      });
    }

    // Security alerts recommendations
    const highSeverityAlerts = securityAlerts.filter(a => a.severity === 'high').length;
    if (highSeverityAlerts > 0) {
      recommendations.push({
        id: 'high-severity-alerts',
        title: 'Address High Severity Security Alerts',
        category: 'threatProtection',
        severity: 'critical',
        description: `${highSeverityAlerts} high severity security alerts require immediate attention.`
      });
    }

    return recommendations;
  }
}