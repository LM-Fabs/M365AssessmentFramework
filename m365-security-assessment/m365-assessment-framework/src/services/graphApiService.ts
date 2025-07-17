import { Assessment } from '../models/Assessment';
import { Customer } from './customerService';

/**
 * Client-side Microsoft Graph API service for Free tier
 * Performs real M365 security assessments directly from the browser
 */
export class GraphApiService {
  private accessToken: string | null = null;
  private readonly GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

  /**
   * Initialize the service with an access token
   */
  public async initialize(accessToken: string): Promise<void> {
    this.accessToken = accessToken;
    console.log('🔗 GraphApiService: Initialized with access token');
  }

  /**
   * Get organization profile information
   */
  public async getOrganizationProfile(): Promise<any> {
    return this.makeGraphRequest('/organization');
  }

  /**
   * Perform a comprehensive M365 security assessment
   */
  public async performSecurityAssessment(customer: Customer): Promise<Assessment> {
    if (!this.accessToken) {
      throw new Error('GraphApiService not initialized with access token');
    }

    console.log('🔍 GraphApiService: Starting security assessment for', customer.tenantName);

    const assessmentId = this.generateId();
    const startTime = new Date();

    try {
      // Collect security data from various Graph API endpoints
      const [
        organization,
        conditionalAccessPolicies,
        users,
        groups,
        applications,
        devices,
        securityDefaults,
        directoryRoles
      ] = await Promise.allSettled([
        this.getOrganizationInfo(),
        this.getConditionalAccessPolicies(),
        this.getUsers(),
        this.getGroups(),
        this.getApplications(),
        this.getDevices(),
        this.getSecurityDefaults(),
        this.getDirectoryRoles()
      ]);

      // Calculate security scores and findings
      const findings = this.analyzeSecurityData({
        organization: this.getSettledValue(organization),
        conditionalAccessPolicies: this.getSettledValue(conditionalAccessPolicies),
        users: this.getSettledValue(users),
        groups: this.getSettledValue(groups),
        applications: this.getSettledValue(applications),
        devices: this.getSettledValue(devices),
        securityDefaults: this.getSettledValue(securityDefaults),
        directoryRoles: this.getSettledValue(directoryRoles)
      });

      const overallScore = this.calculateOverallScore(findings);

      const assessment: Assessment = {
        id: assessmentId,
        tenantId: customer.tenantId,
        assessmentDate: startTime,
        assessor: {
          id: 'system',
          name: 'M365 Assessment Framework',
          email: customer.contactEmail || 'noreply@m365assessment.local'
        },
        metrics: this.generateMetrics(findings, overallScore),
        recommendations: this.generateRecommendations(findings),
        status: 'completed',
        lastModified: new Date()
      };

      console.log('✅ GraphApiService: Assessment completed successfully', {
        score: overallScore,
        findings: findings.length
      });

      return assessment;
    } catch (error) {
      console.error('❌ GraphApiService: Assessment failed:', error);
      throw error;
    }
  }

  // Private methods for data collection

  private async getOrganizationInfo(): Promise<any> {
    return this.makeGraphRequest('/organization');
  }

  private async getConditionalAccessPolicies(): Promise<any> {
    return this.makeGraphRequest('/identity/conditionalAccess/policies');
  }

  private async getUsers(): Promise<any> {
    return this.makeGraphRequest('/users?$select=id,displayName,userPrincipalName,accountEnabled,signInActivity,lastSignInDateTime&$top=100');
  }

  private async getGroups(): Promise<any> {
    return this.makeGraphRequest('/groups?$select=id,displayName,groupTypes,securityEnabled&$top=100');
  }

  private async getApplications(): Promise<any> {
    return this.makeGraphRequest('/applications?$select=id,displayName,publisherDomain,signInAudience&$top=100');
  }

  private async getDevices(): Promise<any> {
    return this.makeGraphRequest('/devices?$select=id,displayName,operatingSystem,trustType,isCompliant&$top=100');
  }

  private async getSecurityDefaults(): Promise<any> {
    try {
      return await this.makeGraphRequest('/policies/identitySecurityDefaultsEnforcementPolicy');
    } catch (error) {
      console.warn('⚠️ Could not retrieve security defaults policy:', error);
      return null;
    }
  }

  private async getDirectoryRoles(): Promise<any> {
    return this.makeGraphRequest('/directoryRoles?$expand=members');
  }

  // Security analysis methods

  private analyzeSecurityData(data: any): any[] {
    const findings: any[] = [];

    // Analyze Conditional Access Policies
    findings.push(...this.analyzeConditionalAccess(data.conditionalAccessPolicies));

    // Analyze User Security
    findings.push(...this.analyzeUserSecurity(data.users));

    // Analyze Application Security
    findings.push(...this.analyzeApplicationSecurity(data.applications));

    // Analyze Device Compliance
    findings.push(...this.analyzeDeviceCompliance(data.devices));

    // Analyze Security Defaults
    findings.push(...this.analyzeSecurityDefaults(data.securityDefaults));

    // Analyze Privileged Access
    findings.push(...this.analyzePrivilegedAccess(data.directoryRoles));

    return findings;
  }

  private analyzeConditionalAccess(policies: any): any[] {
    const findings: any[] = [];

    if (!policies || !policies.value || policies.value.length === 0) {
      findings.push({
        id: this.generateId(),
        category: 'Conditional Access',
        severity: 'High',
        title: 'No Conditional Access Policies Found',
        description: 'No conditional access policies are configured, which leaves the tenant vulnerable to unauthorized access.',
        recommendation: 'Implement conditional access policies to control access based on user, location, device, and application risk.',
        score: 0
      });
    } else {
      // Analyze existing policies
      const enabledPolicies = policies.value.filter((p: any) => p.state === 'enabled').length;
      const score = Math.min(enabledPolicies * 20, 100);
      
      findings.push({
        id: this.generateId(),
        category: 'Conditional Access',
        severity: score >= 80 ? 'Info' : score >= 60 ? 'Medium' : 'High',
        title: `${enabledPolicies} Conditional Access Policies Active`,
        description: `Found ${policies.value.length} total policies, ${enabledPolicies} are enabled.`,
        recommendation: enabledPolicies < 3 ? 'Consider implementing additional conditional access policies for comprehensive coverage.' : 'Good conditional access policy coverage.',
        score
      });
    }

    return findings;
  }

  private analyzeUserSecurity(users: any): any[] {
    const findings: any[] = [];

    if (users && users.value) {
      const totalUsers = users.value.length;
      const activeUsers = users.value.filter((u: any) => u.accountEnabled).length;
      const recentSignIns = users.value.filter((u: any) => {
        if (!u.signInActivity?.lastSignInDateTime) return false;
        const lastSignIn = new Date(u.signInActivity.lastSignInDateTime);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return lastSignIn > thirtyDaysAgo;
      }).length;

      findings.push({
        id: this.generateId(),
        category: 'User Management',
        severity: activeUsers === totalUsers ? 'Low' : 'Medium',
        title: 'User Account Status',
        description: `${activeUsers} of ${totalUsers} user accounts are enabled. ${recentSignIns} users have signed in within the last 30 days.`,
        recommendation: activeUsers < totalUsers ? 'Review and disable unused user accounts to reduce attack surface.' : 'User account management appears appropriate.',
        score: Math.round((activeUsers / totalUsers) * 100)
      });
    }

    return findings;
  }

  private analyzeApplicationSecurity(applications: any): any[] {
    const findings: any[] = [];

    if (applications && applications.value) {
      const totalApps = applications.value.length;
      const publicApps = applications.value.filter((app: any) => 
        app.signInAudience && app.signInAudience.includes('AzureADMultipleOrgs')
      ).length;

      findings.push({
        id: this.generateId(),
        category: 'Application Security',
        severity: publicApps > totalApps * 0.3 ? 'Medium' : 'Low',
        title: 'Application Registration Analysis',
        description: `${totalApps} applications registered, ${publicApps} allow external users.`,
        recommendation: publicApps > 0 ? 'Review multi-tenant applications and ensure they follow least privilege principles.' : 'Application security configuration appears appropriate.',
        score: Math.max(100 - (publicApps * 20), 0)
      });
    }

    return findings;
  }

  private analyzeDeviceCompliance(devices: any): any[] {
    const findings: any[] = [];

    if (devices && devices.value) {
      const totalDevices = devices.value.length;
      const compliantDevices = devices.value.filter((d: any) => d.isCompliant).length;
      const managedDevices = devices.value.filter((d: any) => d.trustType === 'Workplace').length;

      if (totalDevices > 0) {
        const complianceScore = Math.round((compliantDevices / totalDevices) * 100);
        
        findings.push({
          id: this.generateId(),
          category: 'Device Management',
          severity: complianceScore >= 80 ? 'Low' : complianceScore >= 60 ? 'Medium' : 'High',
          title: 'Device Compliance Status',
          description: `${compliantDevices} of ${totalDevices} devices are compliant. ${managedDevices} devices are workplace-managed.`,
          recommendation: complianceScore < 80 ? 'Implement device compliance policies and ensure all devices meet security requirements.' : 'Device compliance appears satisfactory.',
          score: complianceScore
        });
      }
    }

    return findings;
  }

  private analyzeSecurityDefaults(securityDefaults: any): any[] {
    const findings: any[] = [];

    if (securityDefaults) {
      const isEnabled = securityDefaults.isEnabled;
      
      findings.push({
        id: this.generateId(),
        category: 'Security Defaults',
        severity: isEnabled ? 'Info' : 'High',
        title: 'Security Defaults Status',
        description: `Security defaults are ${isEnabled ? 'enabled' : 'disabled'}.`,
        recommendation: isEnabled ? 'Security defaults provide baseline protection.' : 'Enable security defaults or implement comprehensive conditional access policies for baseline security.',
        score: isEnabled ? 80 : 20
      });
    }

    return findings;
  }

  private analyzePrivilegedAccess(directoryRoles: any): any[] {
    const findings: any[] = [];

    if (directoryRoles && directoryRoles.value) {
      const adminRoles = directoryRoles.value.filter((role: any) => 
        role.displayName && (
          role.displayName.includes('Administrator') || 
          role.displayName.includes('Admin')
        )
      );

      const totalAdmins = adminRoles.reduce((sum: number, role: any) => 
        sum + (role.members ? role.members.length : 0), 0
      );

      findings.push({
        id: this.generateId(),
        category: 'Privileged Access',
        severity: totalAdmins > 10 ? 'Medium' : 'Low',
        title: 'Administrative Role Assignments',
        description: `${totalAdmins} users have administrative roles across ${adminRoles.length} admin role types.`,
        recommendation: totalAdmins > 10 ? 'Review and minimize administrative role assignments. Consider implementing Privileged Identity Management (PIM).' : 'Administrative access appears appropriately controlled.',
        score: Math.max(100 - totalAdmins * 5, 50)
      });
    }

    return findings;
  }

  // Utility methods

  private async makeGraphRequest(endpoint: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const url = `${this.GRAPH_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Graph API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Graph API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  private getSettledValue(settledResult: any): any {
    return settledResult.status === 'fulfilled' ? settledResult.value : null;
  }

  private calculateOverallScore(findings: any[]): number {
    if (findings.length === 0) return 0;
    
    const totalScore = findings.reduce((sum, finding) => sum + (finding.score || 0), 0);
    return Math.round(totalScore / findings.length);
  }

  private generateRecommendations(findings: any[]): Array<{
    id: string;
    category: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    remediation: string;
    references: Array<{ title: string; url: string; }>;
  }> {
    return findings
      .filter(f => f.recommendation && f.severity !== 'Info')
      .slice(0, 10) // Top 10 recommendations
      .map(finding => ({
        id: this.generateId(),
        category: finding.category || 'General',
        severity: this.mapSeverity(finding.severity),
        title: finding.title || 'Security Recommendation',
        description: finding.description || '',
        impact: this.generateImpactDescription(finding.severity),
        remediation: finding.recommendation || '',
        references: [
          {
            title: 'Microsoft 365 Security Best Practices',
            url: 'https://docs.microsoft.com/en-us/microsoft-365/security/'
          }
        ]
      }));
  }

  private generateMetrics(findings: any[], overallScore: number): any {
    const categories = this.categorizeFindgs(findings);
    
    return {
      license: {
        totalLicenses: 0,
        assignedLicenses: 0,
        utilizationRate: 0,
        licenseDetails: [],
        summary: 'License information not available in client-side assessment'
      },
      secureScore: {
        percentage: overallScore,
        currentScore: overallScore,
        maxScore: 100,
        controlScores: findings.map(f => ({
          controlName: f.title || 'Unknown Control',
          category: f.category || 'General',
          implementationStatus: f.score >= 80 ? 'Implemented' : f.score >= 60 ? 'Partial' : 'Not Implemented',
          score: f.score || 0,
          maxScore: 100
        })),
        summary: `Security score: ${overallScore}% based on ${findings.length} security controls`
      },
      score: {
        overall: overallScore,
        license: 0,
        secureScore: overallScore
      },
      lastUpdated: new Date(),
      recommendations: findings.map(f => f.recommendation).filter(Boolean),
      realData: {
        clientSideAssessment: true,
        graphApiEndpoints: this.getUsedEndpoints(),
        assessmentDate: new Date().toISOString()
      }
    };
  }

  private mapSeverity(severity: string): 'high' | 'medium' | 'low' {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'high';
      case 'medium':
      case 'warning':
        return 'medium';
      default:
        return 'low';
    }
  }

  private generateImpactDescription(severity: string): string {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'High impact on security posture. Immediate attention required.';
      case 'medium':
      case 'warning':
        return 'Medium impact on security. Should be addressed in near term.';
      default:
        return 'Low impact on security. Consider addressing as part of routine maintenance.';
    }
  }

  private determineComplianceStatus(findings: any[]): string {
    const highSeverityCount = findings.filter(f => f.severity === 'High').length;
    const mediumSeverityCount = findings.filter(f => f.severity === 'Medium').length;

    if (highSeverityCount === 0 && mediumSeverityCount <= 2) return 'Compliant';
    if (highSeverityCount <= 2) return 'Partially Compliant';
    return 'Non-Compliant';
  }

  private determineRiskLevel(score: number): string {
    if (score >= 80) return 'Low';
    if (score >= 60) return 'Medium';
    if (score >= 40) return 'High';
    return 'Critical';
  }

  private categorizeFindgs(findings: any[]): any {
    const categories: any = {};
    
    findings.forEach(finding => {
      const category = finding.category || 'General';
      if (!categories[category]) {
        categories[category] = {
          total: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0
        };
      }
      
      categories[category].total++;
      const severity = finding.severity?.toLowerCase() || 'low';
      if (categories[category][severity] !== undefined) {
        categories[category][severity]++;
      }
    });

    return categories;
  }

  private getUsedEndpoints(): string[] {
    return [
      '/organization',
      '/identity/conditionalAccess/policies',
      '/users',
      '/groups',
      '/applications',
      '/devices',
      '/policies/identitySecurityDefaultsEnforcementPolicy',
      '/directoryRoles'
    ];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const graphApiService = new GraphApiService();
