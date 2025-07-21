"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerGraphService = void 0;
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
const azureTokenCredentials_1 = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");
const identity_1 = require("@azure/identity");
class ServerGraphService {
    constructor() {
        // Use Azure Managed Identity for secure authentication
        this.credential = new identity_1.DefaultAzureCredential();
        // Create authentication provider using managed identity
        const authProvider = new azureTokenCredentials_1.TokenCredentialAuthenticationProvider(this.credential, {
            scopes: ['https://graph.microsoft.com/.default']
        });
        // Initialize Graph client with authentication provider
        this.graphClient = microsoft_graph_client_1.Client.initWithMiddleware({
            authProvider: authProvider
        });
    }
    async getSecurityAssessment() {
        try {
            // Fetch real security data from Microsoft Graph
            const [secureScores, secureScoreControlProfiles, conditionalAccessPolicies, devices, alerts, users] = await Promise.all([
                this.getSecureScores(),
                this.getSecureScoreControlProfiles(),
                this.getConditionalAccessPolicies(),
                this.getDeviceComplianceStatus(),
                this.getSecurityAlerts(),
                this.getUserMfaStatus()
            ]);
            // Calculate real security metrics
            const metrics = this.calculateSecurityMetrics({
                secureScores,
                conditionalAccessPolicies,
                devices,
                alerts,
                users
            });
            // Generate real recommendations based on current state
            const recommendations = this.generateRecommendations({
                secureScoreControlProfiles,
                conditionalAccessPolicies,
                devices,
                alerts,
                users
            });
            return {
                metrics,
                recommendations,
                lastUpdated: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Error fetching security assessment:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to perform security assessment: ${errorMessage}`);
        }
    }
    async getSecureScores() {
        try {
            const response = await this.graphClient
                .api('/security/secureScores')
                .top(1)
                .orderby('createdDateTime desc')
                .get();
            return response.value || [];
        }
        catch (error) {
            console.error('Error fetching secure scores:', error);
            return [];
        }
    }
    async getSecureScoreControlProfiles() {
        try {
            const response = await this.graphClient
                .api('/security/secureScoreControlProfiles')
                .get();
            return response.value || [];
        }
        catch (error) {
            console.error('Error fetching secure score control profiles:', error);
            return [];
        }
    }
    async getConditionalAccessPolicies() {
        try {
            const response = await this.graphClient
                .api('/identity/conditionalAccess/policies')
                .get();
            return response.value || [];
        }
        catch (error) {
            console.error('Error fetching conditional access policies:', error);
            return [];
        }
    }
    async getDeviceComplianceStatus() {
        try {
            const response = await this.graphClient
                .api('/deviceManagement/managedDevices')
                .select('id,deviceName,complianceState,lastSyncDateTime')
                .get();
            return response.value || [];
        }
        catch (error) {
            console.error('Error fetching device compliance status:', error);
            return [];
        }
    }
    async getSecurityAlerts() {
        try {
            const response = await this.graphClient
                .api('/security/alerts_v2')
                .filter('status ne \'resolved\'')
                .top(100)
                .get();
            return response.value || [];
        }
        catch (error) {
            console.error('Error fetching security alerts:', error);
            return [];
        }
    }
    async getUserMfaStatus() {
        try {
            const response = await this.graphClient
                .api('/reports/credentialUserRegistrationDetails')
                .get();
            return response.value || [];
        }
        catch (error) {
            console.error('Error fetching user MFA status:', error);
            return [];
        }
    }
    calculateSecurityMetrics(data) {
        const { secureScores, conditionalAccessPolicies, devices, alerts, users } = data;
        // Calculate secure score from latest entry
        const latestSecureScore = secureScores[0];
        const secureScore = latestSecureScore ?
            Math.round((latestSecureScore.currentScore / latestSecureScore.maxScore) * 100) : 0;
        // Calculate identity score based on MFA adoption and conditional access
        const mfaRegisteredUsers = users.filter((u) => u.isMfaRegistered).length;
        const totalUsers = users.length;
        const mfaAdoption = totalUsers > 0 ? (mfaRegisteredUsers / totalUsers) * 100 : 0;
        const activePolicies = conditionalAccessPolicies.filter((p) => p.state === 'enabled').length;
        const identityScore = Math.round((mfaAdoption * 0.7) + (Math.min(activePolicies * 10, 30)));
        // Calculate device compliance score
        const compliantDevices = devices.filter((d) => d.complianceState === 'compliant').length;
        const totalDevices = devices.length;
        const deviceComplianceScore = totalDevices > 0 ?
            Math.round((compliantDevices / totalDevices) * 100) : 100;
        // Data protection score (simplified calculation)
        const dataProtectionScore = Math.round(secureScore * 0.8 + (activePolicies > 0 ? 20 : 0));
        return {
            secureScore,
            identityScore: Math.min(identityScore, 100),
            deviceComplianceScore,
            dataProtectionScore: Math.min(dataProtectionScore, 100),
            alertsCount: alerts.length,
            recommendationsCount: 0 // Will be calculated based on recommendations generated
        };
    }
    generateRecommendations(data) {
        const { secureScoreControlProfiles, conditionalAccessPolicies, devices, alerts, users } = data;
        const recommendations = [];
        // Check MFA registration
        const mfaRegisteredUsers = users.filter((u) => u.isMfaRegistered).length;
        const totalUsers = users.length;
        if (totalUsers > 0 && (mfaRegisteredUsers / totalUsers) < 0.9) {
            recommendations.push({
                id: 'mfa-adoption',
                title: 'Improve Multi-Factor Authentication Adoption',
                category: 'identity',
                severity: 'high',
                description: `Only ${mfaRegisteredUsers} out of ${totalUsers} users have MFA registered. Increase MFA adoption to improve security.`,
                implementationUrl: 'https://docs.microsoft.com/en-us/azure/active-directory/authentication/concept-mfa-howitworks'
            });
        }
        // Check conditional access policies
        const activePolicies = conditionalAccessPolicies.filter((p) => p.state === 'enabled').length;
        if (activePolicies < 3) {
            recommendations.push({
                id: 'conditional-access',
                title: 'Implement Additional Conditional Access Policies',
                category: 'identity',
                severity: 'medium',
                description: `Only ${activePolicies} conditional access policies are active. Consider implementing more comprehensive policies.`,
                implementationUrl: 'https://docs.microsoft.com/en-us/azure/active-directory/conditional-access/'
            });
        }
        // Check device compliance
        const compliantDevices = devices.filter((d) => d.complianceState === 'compliant').length;
        const totalDevices = devices.length;
        if (totalDevices > 0 && (compliantDevices / totalDevices) < 0.95) {
            recommendations.push({
                id: 'device-compliance',
                title: 'Improve Device Compliance',
                category: 'endpoint',
                severity: 'medium',
                description: `${totalDevices - compliantDevices} out of ${totalDevices} devices are not compliant. Review and remediate non-compliant devices.`,
                implementationUrl: 'https://docs.microsoft.com/en-us/mem/intune/protect/device-compliance-get-started'
            });
        }
        // Check for high severity alerts
        const highSeverityAlerts = alerts.filter((a) => a.severity === 'high').length;
        if (highSeverityAlerts > 0) {
            recommendations.push({
                id: 'high-severity-alerts',
                title: 'Address High Severity Security Alerts',
                category: 'threatProtection',
                severity: 'critical',
                description: `${highSeverityAlerts} high severity security alerts require immediate attention.`,
                implementationUrl: 'https://docs.microsoft.com/en-us/microsoft-365/security/defender/investigate-alerts'
            });
        }
        // Add recommendations from secure score control profiles
        const incompleteControls = secureScoreControlProfiles.filter((control) => control.implementationStatus !== 'Implemented' &&
            (control.rank ?? 999) <= 10 // Focus on top 10 priority controls
        );
        incompleteControls.forEach((control) => {
            recommendations.push({
                id: `secure-score-${control.id}`,
                title: control.title || 'Security Control Recommendation',
                category: this.mapControlCategory(control.controlCategory || ''),
                severity: this.mapControlSeverity(control.rank || 999),
                description: control.userImpact || 'Implement this security control to improve your overall security posture.',
                implementationUrl: control.implementationUrl
            });
        });
        return recommendations.slice(0, 10); // Return top 10 recommendations
    }
    mapControlCategory(category) {
        const categoryMap = {
            'Identity': 'secureScore',
            'Data': 'secureScore',
            'Device': 'secureScore',
            'Apps': 'secureScore',
            'Infrastructure': 'secureScore',
            'License': 'license'
        };
        return categoryMap[category] || 'secureScore';
    }
    mapControlSeverity(rank) {
        if (rank <= 3)
            return 'critical';
        if (rank <= 6)
            return 'high';
        if (rank <= 8)
            return 'medium';
        return 'low';
    }
}
exports.ServerGraphService = ServerGraphService;
//# sourceMappingURL=serverGraphService.js.map