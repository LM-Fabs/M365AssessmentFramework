import axios from 'axios';
import { Client } from "@microsoft/microsoft-graph-client";
import { AuthCodeMSALBrowserAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/authCodeMsalBrowser";
import { InteractionType, PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginRequest } from "../config/auth";
import { Metrics } from '../models/Metrics';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';

const GRAPH_API_BASE_URL = 'https://graph.microsoft.com/v1.0';

export const fetchTenantData = async (tenantId: string, accessToken: string) => {
    try {
        const response = await axios.get(`${GRAPH_API_BASE_URL}/tenants/${tenantId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching tenant data:', error);
        throw error;
    }
};

export const fetchSecurityMetrics = async (tenantId: string, accessToken: string) => {
    try {
        const response = await axios.get(`${GRAPH_API_BASE_URL}/security/metrics/${tenantId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching security metrics:', error);
        throw error;
    }
};

// Additional functions for interacting with Microsoft Graph API can be added here

export class GraphService {
  private static instance: GraphService;
  private msalInstance: PublicClientApplication;
  private graphClient: Client | null = null;

  private constructor() {
    this.msalInstance = new PublicClientApplication(msalConfig);
  }

  public static getInstance(): GraphService {
    if (!GraphService.instance) {
      GraphService.instance = new GraphService();
    }
    return GraphService.instance;
  }

  public async initializeGraphClient(): Promise<void> {
    const account = this.msalInstance.getAllAccounts()[0];
    if (!account) {
      throw new Error("No active account! Verify a user has been signed in and setActiveAccount has been called.");
    }

    const authProvider = new AuthCodeMSALBrowserAuthenticationProvider(this.msalInstance, {
      account: account,
      scopes: loginRequest.scopes,
      interactionType: InteractionType.Popup
    });

    this.graphClient = Client.initWithMiddleware({
      authProvider
    });
  }

  public async getSecurityMetrics(): Promise<Metrics> {
    const [
      mfaReport,
      secureScoreControlProfiles,
      devices,
      conditionalAccessPolicies,
      adminUsers,
      guestUsers,
      dlpPolicies,
      alerts
    ] = await Promise.all([
      this.getMfaReport(),
      this.getSecureScore(),
      this.getDevices(),
      this.getConditionalAccessPolicies(),
      this.getAdminUsers(),
      this.getGuestUsers(),
      this.getDlpPolicies(),
      this.getSecurityAlerts()
    ]);

    // Calculate identity metrics
    const identity = {
      mfaAdoption: this.calculateMfaAdoption(mfaReport),
      conditionalAccessPolicies: conditionalAccessPolicies.length,
      passwordPolicies: {
        complexity: true, // Would be fetched from policy
        expiration: true, // Would be fetched from policy
        mfaRequired: conditionalAccessPolicies.some(p => p.grantControls?.builtInControls?.includes('mfa'))
      },
      adminAccounts: {
        total: adminUsers.length,
        protected: adminUsers.filter(u => u.isProtected).length
      },
      guestAccess: {
        total: guestUsers.length,
        reviewed: guestUsers.filter(u => u.reviewedDate).length
      }
    };

    // Calculate data protection metrics
    const dataProtection = {
      sensitivityLabels: {
        total: secureScoreControlProfiles.filter(p => p.category === 'DataProtection').length,
        inUse: secureScoreControlProfiles.filter(p => p.category === 'DataProtection' && p.score > 0).length
      },
      dlpPolicies: {
        total: dlpPolicies.length,
        active: dlpPolicies.filter(p => p.status === 'enabled').length
      },
      sharingSettings: {
        external: true, // Would be fetched from tenant settings
        anonymous: false, // Would be fetched from tenant settings
        restrictions: ['requireEmailVerification'] // Would be fetched from tenant settings
      }
    };

    // Calculate endpoint metrics
    const endpoint = {
      deviceCompliance: {
        total: devices.length,
        compliant: devices.filter(d => d.complianceState === 'compliant').length
      },
      defenderStatus: {
        enabled: true, // Would be fetched from Defender settings
        upToDate: true // Would be fetched from Defender settings
      },
      updateCompliance: 95 // Would be calculated from update reports
    };

    // Calculate cloud apps metrics
    const cloudApps = {
      securityPolicies: {
        total: secureScoreControlProfiles.filter(p => p.category === 'CloudApps').length,
        active: secureScoreControlProfiles.filter(p => p.category === 'CloudApps' && p.score > 0).length
      },
      oauthApps: {
        total: 100, // Would be fetched from OAuth apps
        reviewed: 80, // Would be fetched from OAuth apps
        highRisk: 5 // Would be fetched from OAuth apps
      }
    };

    // Calculate information protection metrics
    const informationProtection = {
      aipLabels: {
        total: 10, // Would be fetched from AIP settings
        applied: 7 // Would be fetched from AIP usage stats
      },
      encryption: {
        enabled: true, // Would be fetched from encryption settings
        usage: 0.8 // Would be calculated from usage stats
      }
    };

    // Calculate threat protection metrics
    const threatProtection = {
      alerts: {
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length,
        resolved: alerts.filter(a => a.status === 'resolved').length
      },
      incidentResponse: {
        meanTimeToRespond: 24, // Would be calculated from incident response times
        openIncidents: alerts.filter(a => a.status === 'open').length
      }
    };

    return {
      identity,
      dataProtection,
      endpoint,
      cloudApps,
      informationProtection,
      threatProtection,
      score: await this.calculateScores({
        identity,
        dataProtection,
        endpoint,
        cloudApps,
        informationProtection,
        threatProtection
      } as Metrics),
      lastUpdated: new Date()
    };
  }

  private async getMfaReport(): Promise<any[]> {
    const response = await this.graphClient
      .api('/reports/credentialUserRegistrationDetails')
      .get();
    return response.value;
  }

  private async getSecureScore(): Promise<any[]> {
    const response = await this.graphClient
      .api('/security/secureScoreControlProfiles')
      .get();
    return response.value;
  }

  private async getDevices(): Promise<any[]> {
    const response = await this.graphClient
      .api('/devices')
      .get();
    return response.value;
  }

  private async getConditionalAccessPolicies(): Promise<any[]> {
    const response = await this.graphClient
      .api('/identity/conditionalAccess/policies')
      .get();
    return response.value;
  }

  private async getAdminUsers(): Promise<any[]> {
    const response = await this.graphClient
      .api('/users')
      .filter('assignedRoles/any()')
      .get();
    return response.value;
  }

  private async getGuestUsers(): Promise<any[]> {
    const response = await this.graphClient
      .api('/users')
      .filter('userType eq \'Guest\'')
      .get();
    return response.value;
  }

  private async getDlpPolicies(): Promise<any[]> {
    const response = await this.graphClient
      .api('/security/dlpPolicies')
      .get();
    return response.value;
  }

  private async getSecurityAlerts(): Promise<any[]> {
    const response = await this.graphClient
      .api('/security/alerts')
      .get();
    return response.value;
  }

  private calculateMfaAdoption(mfaReport: any[]): number {
    const totalUsers = mfaReport.length;
    const mfaRegisteredUsers = mfaReport.filter(user => user.isRegistered).length;
    return mfaRegisteredUsers / totalUsers;
  }

  private async calculateScores(metrics: Metrics): Promise<{
    overall: number;
    identity: number;
    dataProtection: number;
    endpoint: number;
    cloudApps: number;
    informationProtection: number;
    threatProtection: number;
  }> {
    // This would typically fetch secure scores from Microsoft 365
    // For now, we'll calculate based on our metrics
    const scores = {
      identity: 85,
      dataProtection: 78,
      endpoint: 92,
      cloudApps: 88,
      informationProtection: 75,
      threatProtection: 82
    };

    return {
      ...scores,
      overall: Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length
    };
  }
}