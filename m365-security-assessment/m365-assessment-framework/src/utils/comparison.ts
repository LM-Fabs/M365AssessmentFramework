import { Assessment } from '../models/Assessment';
import { SecurityImpact } from '../shared/constants';

interface ComparisonGap {
  category: string;
  metric: string;
  current: number;
  target: number;
  gap: number;
  impact: SecurityImpact;
}

export const compareWithBestPractices = (metrics: Assessment['metrics']): ComparisonGap[] => {
  const gaps: ComparisonGap[] = [];

  // Identity Comparisons
  if (metrics.identity.mfaAdoption < 0.95) {
    gaps.push({
      category: 'Identity',
      metric: 'MFA Adoption',
      current: metrics.identity.mfaAdoption * 100,
      target: 95,
      gap: 95 - (metrics.identity.mfaAdoption * 100),
      impact: SecurityImpact.High
    });
  }

  if (metrics.identity.adminAccounts.protected / metrics.identity.adminAccounts.total < 1) {
    gaps.push({
      category: 'Identity',
      metric: 'Protected Admin Accounts',
      current: (metrics.identity.adminAccounts.protected / metrics.identity.adminAccounts.total) * 100,
      target: 100,
      gap: 100 - ((metrics.identity.adminAccounts.protected / metrics.identity.adminAccounts.total) * 100),
      impact: SecurityImpact.High
    });
  }

  // Data Protection Comparisons
  if (metrics.dataProtection.dlpPolicies.active / metrics.dataProtection.dlpPolicies.total < 0.8) {
    gaps.push({
      category: 'Data Protection',
      metric: 'Active DLP Policies',
      current: (metrics.dataProtection.dlpPolicies.active / metrics.dataProtection.dlpPolicies.total) * 100,
      target: 80,
      gap: 80 - ((metrics.dataProtection.dlpPolicies.active / metrics.dataProtection.dlpPolicies.total) * 100),
      impact: SecurityImpact.High
    });
  }

  // Endpoint Security Comparisons
  if (metrics.endpoint.deviceCompliance.compliant / metrics.endpoint.deviceCompliance.total < 0.9) {
    gaps.push({
      category: 'Endpoint Security',
      metric: 'Device Compliance',
      current: (metrics.endpoint.deviceCompliance.compliant / metrics.endpoint.deviceCompliance.total) * 100,
      target: 90,
      gap: 90 - ((metrics.endpoint.deviceCompliance.compliant / metrics.endpoint.deviceCompliance.total) * 100),
      impact: SecurityImpact.Medium
    });
  }

  if (!metrics.endpoint.defenderStatus.enabled || !metrics.endpoint.defenderStatus.upToDate) {
    gaps.push({
      category: 'Endpoint Security',
      metric: 'Defender Status',
      current: 0,
      target: 100,
      gap: 100,
      impact: SecurityImpact.High
    });
  }

  // Cloud Apps Security Comparisons
  if (metrics.cloudApps.oauthApps.highRisk / metrics.cloudApps.oauthApps.total > 0.05) {
    gaps.push({
      category: 'Cloud Apps Security',
      metric: 'High Risk OAuth Apps',
      current: (metrics.cloudApps.oauthApps.highRisk / metrics.cloudApps.oauthApps.total) * 100,
      target: 5,
      gap: ((metrics.cloudApps.oauthApps.highRisk / metrics.cloudApps.oauthApps.total) * 100) - 5,
      impact: SecurityImpact.High
    });
  }

  // Information Protection Comparisons
  if (metrics.informationProtection.aipLabels.applied / metrics.informationProtection.aipLabels.total < 0.7) {
    gaps.push({
      category: 'Information Protection',
      metric: 'AIP Labels Usage',
      current: (metrics.informationProtection.aipLabels.applied / metrics.informationProtection.aipLabels.total) * 100,
      target: 70,
      gap: 70 - ((metrics.informationProtection.aipLabels.applied / metrics.informationProtection.aipLabels.total) * 100),
      impact: SecurityImpact.Medium
    });
  }

  // Threat Protection Comparisons
  const resolvedAlerts = metrics.threatProtection.alerts.resolved;
  const totalAlerts = metrics.threatProtection.alerts.high + 
                     metrics.threatProtection.alerts.medium + 
                     metrics.threatProtection.alerts.low + 
                     resolvedAlerts;
  
  if (totalAlerts > 0 && (resolvedAlerts / totalAlerts) < 0.85) {
    gaps.push({
      category: 'Threat Protection',
      metric: 'Alert Resolution Rate',
      current: (resolvedAlerts / totalAlerts) * 100,
      target: 85,
      gap: 85 - ((resolvedAlerts / totalAlerts) * 100),
      impact: SecurityImpact.High
    });
  }

  return gaps;
};

export const compareAssessments = (
  currentAssessment: Assessment,
  previousAssessment: Assessment
): ComparisonGap[] => {
  const gaps: ComparisonGap[] = [];
  const scoreCategories = Object.keys(currentAssessment.metrics.score) as Array<keyof Assessment['metrics']['score']>;

  for (const category of scoreCategories) {
    if (category === 'overall') continue;

    const currentScore = currentAssessment.metrics.score[category];
    const previousScore = previousAssessment.metrics.score[category];
    const difference = currentScore - previousScore;

    if (Math.abs(difference) >= 10) {
      gaps.push({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        metric: 'Security Score',
        current: currentScore,
        target: previousScore,
        gap: difference,
        impact: Math.abs(difference) >= 20 ? SecurityImpact.High :
               Math.abs(difference) >= 15 ? SecurityImpact.Medium :
               SecurityImpact.Low
      });
    }
  }

  return gaps;
};

export const generateRecommendations = (gaps: ComparisonGap[]): Assessment['recommendations'] => {
  return gaps.map(gap => ({
    id: crypto.randomUUID(),
    category: gap.category,
    severity: gap.impact,
    title: `Improve ${gap.metric} in ${gap.category}`,
    description: `Current ${gap.metric} is at ${gap.current}%, which is ${Math.abs(gap.gap)}% ${gap.gap > 0 ? 'above' : 'below'} the ${gap.target}% target.`,
    impact: `${gap.impact} impact on overall security posture`,
    remediation: generateRemediation(gap),
    references: generateReferences(gap)
  }));
};

const generateRemediation = (gap: ComparisonGap): string => {
  const remediations: { [key: string]: string } = {
    'MFA Adoption': 'Implement conditional access policies requiring MFA for all users. Consider using risk-based authentication policies.',
    'Protected Admin Accounts': 'Enable Privileged Identity Management (PIM) for all admin accounts and implement just-in-time access.',
    'Active DLP Policies': 'Review and activate Data Loss Prevention policies across all workloads including Exchange, SharePoint, and OneDrive.',
    'Device Compliance': 'Enforce device compliance policies and implement automated remediation actions for non-compliant devices.',
    'Defender Status': 'Enable Microsoft Defender for Endpoint across all devices and ensure automatic updates are configured.',
    'High Risk OAuth Apps': 'Review and revoke permissions for high-risk OAuth applications. Implement app governance policies.',
    'AIP Labels Usage': 'Deploy sensitivity labels across the organization and configure auto-labeling policies for sensitive content.',
    'Alert Resolution Rate': 'Implement an incident response plan and establish SLAs for alert resolution. Consider security automation.'
  };

  return remediations[gap.metric] || 'Review current configuration and implement security best practices.';
};

const generateReferences = (gap: ComparisonGap): Array<{ title: string, url: string }> => {
  const references: { [key: string]: Array<{ title: string, url: string }> } = {
    'MFA Adoption': [
      {
        title: 'Planning a cloud-based Azure AD Multi-Factor Authentication deployment',
        url: 'https://docs.microsoft.com/en-us/azure/active-directory/authentication/howto-mfa-getstarted'
      }
    ],
    'Protected Admin Accounts': [
      {
        title: 'Securing privileged access for hybrid and cloud deployments in Azure AD',
        url: 'https://docs.microsoft.com/en-us/azure/active-directory/roles/security-planning'
      }
    ],
    'Active DLP Policies': [
      {
        title: 'Learn about data loss prevention',
        url: 'https://docs.microsoft.com/en-us/microsoft-365/compliance/dlp-learn-about-dlp'
      }
    ],
    'Device Compliance': [
      {
        title: 'Use compliance policies to set rules for devices you manage with Intune',
        url: 'https://docs.microsoft.com/en-us/mem/intune/protect/device-compliance-get-started'
      }
    ],
    'Defender Status': [
      {
        title: 'Deploy Microsoft Defender for Endpoint',
        url: 'https://docs.microsoft.com/en-us/microsoft-365/security/defender-endpoint/deployment-phases'
      }
    ],
    'High Risk OAuth Apps': [
      {
        title: 'Manage app access with Microsoft Cloud App Security',
        url: 'https://docs.microsoft.com/en-us/cloud-app-security/manage-app-permissions'
      }
    ],
    'AIP Labels Usage': [
      {
        title: 'Learn about sensitivity labels',
        url: 'https://docs.microsoft.com/en-us/microsoft-365/compliance/sensitivity-labels'
      }
    ],
    'Alert Resolution Rate': [
      {
        title: 'Security operations capabilities in Microsoft 365 Defender',
        url: 'https://docs.microsoft.com/en-us/microsoft-365/security/defender/security-operations'
      }
    ]
  };

  return references[gap.metric] || [];
};