/**
 * Secure Score Formatting Utilities
 * Provides human-readable formatting for Microsoft Secure Score controls
 */

/**
 * Map of cryptic control names to human-readable titles
 */
export const CONTROL_NAME_MAPPING: Record<string, string> = {
  // Identity Controls
  'mfa_for_all_users': 'Multi-Factor Authentication for All Users',
  'mfa_for_admin_users': 'Multi-Factor Authentication for Admin Users',
  'aad_limited_administrative_roles': 'Limit Administrative Roles in Azure AD',
  'aad_risky_users': 'Monitor and Remediate Risky Users',
  'aad_risky_sign_ins': 'Monitor and Block Risky Sign-ins',
  'password_protection': 'Enable Azure AD Password Protection',
  'conditional_access_baseline': 'Configure Baseline Conditional Access Policies',
  'conditional_access_legacy_auth': 'Block Legacy Authentication',
  'pim_eligible_roles': 'Enable Privileged Identity Management',
  'identity_protection': 'Enable Azure AD Identity Protection',
  'guest_user_access_review': 'Regular Guest User Access Reviews',
  'password_writeback': 'Enable Password Writeback',
  
  // Data Protection Controls
  'information_protection_labels': 'Configure Information Protection Labels',
  'dlp_policies': 'Data Loss Prevention Policies',
  'retention_policies': 'Configure Email Retention Policies',
  'office_cloud_policy': 'Office Cloud Policy Service',
  'aip_unified_labels': 'Azure Information Protection Unified Labels',
  'sensitivity_labels': 'Configure Sensitivity Labels',
  'auto_classification': 'Automatic Data Classification',
  'rights_management': 'Azure Rights Management Service',
  
  // Device Controls
  'device_compliance': 'Device Compliance Policies',
  'device_enrollment': 'Device Enrollment Restrictions',
  'conditional_access_devices': 'Device-based Conditional Access',
  'mobile_app_management': 'Mobile Application Management',
  'windows_defender_atp': 'Microsoft Defender for Endpoint',
  'bitlocker_encryption': 'BitLocker Drive Encryption',
  'windows_hello': 'Windows Hello for Business',
  'app_protection_policies': 'App Protection Policies',
  
  // Apps Controls
  'cloud_app_security': 'Microsoft Cloud App Security',
  'oauth_app_governance': 'OAuth Application Governance',
  'third_party_app_review': 'Third-party Application Reviews',
  'app_consent_policies': 'Application Consent Policies',
  'defender_for_office365': 'Microsoft Defender for Office 365',
  'safe_attachments': 'Safe Attachments Policy',
  'safe_links': 'Safe Links Policy',
  'anti_phishing': 'Anti-phishing Policies',
  
  // Infrastructure Controls
  'azure_security_center': 'Microsoft Defender for Cloud',
  'network_security_groups': 'Network Security Groups',
  'azure_firewall': 'Azure Firewall Configuration',
  'just_in_time_access': 'Just-in-Time VM Access',
  'security_monitoring': 'Security Monitoring and Alerting',
  'backup_protection': 'Azure Backup Protection',
  'vulnerability_assessment': 'Vulnerability Assessment',
  'secure_score_improvement': 'Continuous Security Improvement',
  
  // General Controls
  'security_defaults': 'Enable Security Defaults',
  'incident_response': 'Incident Response Procedures',
  'security_awareness': 'Security Awareness Training',
  'threat_intelligence': 'Threat Intelligence Integration',
  'audit_logging': 'Comprehensive Audit Logging',
  'monitoring_alerts': 'Security Monitoring and Alerts'
};

/**
 * Get human-readable control name
 */
export function getReadableControlName(controlName: string, description?: string): string {
  // First try direct mapping
  if (CONTROL_NAME_MAPPING[controlName]) {
    return CONTROL_NAME_MAPPING[controlName];
  }
  
  // Try to find partial matches
  const lowerName = controlName.toLowerCase();
  for (const [key, value] of Object.entries(CONTROL_NAME_MAPPING)) {
    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
      return value;
    }
  }
  
  // If description is available and looks better than control name, use it
  if (description && description.length > 10 && !description.includes('Microsoft') && description !== controlName) {
    return description;
  }
  
  // Fall back to formatting the control name
  return formatControlName(controlName);
}

/**
 * Format cryptic control names into readable text
 */
function formatControlName(controlName: string): string {
  if (!controlName) return 'Unknown Control';
  
  return controlName
    // Replace underscores and hyphens with spaces
    .replace(/[_-]/g, ' ')
    // Split camelCase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Capitalize first letter of each word
    .replace(/\b\w/g, l => l.toUpperCase())
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Standardize implementation status values
 */
export function getStandardizedStatus(status: string): {
  standardStatus: string;
  displayStatus: string;
  statusClass: string;
} {
  const normalizedStatus = (status || '').toLowerCase().trim();
  
  if (normalizedStatus.includes('implement') || normalizedStatus.includes('complete') || normalizedStatus.includes('enabled')) {
    return {
      standardStatus: 'Implemented',
      displayStatus: 'Implemented',
      statusClass: 'implemented'
    };
  }
  
  if (normalizedStatus.includes('partial') || normalizedStatus.includes('progress') || normalizedStatus.includes('ongoing')) {
    return {
      standardStatus: 'Partial',
      displayStatus: 'Partially Implemented',
      statusClass: 'partial'
    };
  }
  
  if (normalizedStatus.includes('not') || normalizedStatus.includes('pending') || normalizedStatus.includes('missing')) {
    return {
      standardStatus: 'Not Implemented',
      displayStatus: 'Not Implemented',
      statusClass: 'not-implemented'
    };
  }
  
  if (normalizedStatus.includes('review') || normalizedStatus.includes('attention')) {
    return {
      standardStatus: 'Needs Review',
      displayStatus: 'Needs Review',
      statusClass: 'needs-review'
    };
  }
  
  // Default case
  return {
    standardStatus: 'Unknown',
    displayStatus: status || 'Unknown Status',
    statusClass: 'unknown'
  };
}

/**
 * Determine action type from control name and description
 */
export function determineActionType(controlName: string, description?: string): string {
  const text = `${controlName} ${description || ''}`.toLowerCase();
  
  if (text.includes('policy') || text.includes('rule') || text.includes('restriction')) {
    return 'Policy';
  }
  
  if (text.includes('enable') || text.includes('configure') || text.includes('setup')) {
    return 'Configuration';
  }
  
  if (text.includes('review') || text.includes('monitor') || text.includes('assess')) {
    return 'Review';
  }
  
  if (text.includes('training') || text.includes('awareness') || text.includes('education')) {
    return 'Training';
  }
  
  if (text.includes('update') || text.includes('patch') || text.includes('upgrade')) {
    return 'Update';
  }
  
  return 'Other';
}

/**
 * Calculate maximum score based on current score and typical patterns
 * This is a fallback when maxScore is not available from the API
 */
export function calculateMaxScore(currentScore: number, controlName: string): number {
  // Common max score patterns for different control types
  const highValueControls = [
    'mfa', 'conditional_access', 'privileged', 'admin', 'identity_protection'
  ];
  
  const mediumValueControls = [
    'compliance', 'monitoring', 'logging', 'backup', 'encryption'
  ];
  
  const controlText = controlName.toLowerCase();
  
  // High-value security controls typically have max scores of 8-12
  if (highValueControls.some(keyword => controlText.includes(keyword))) {
    return Math.max(currentScore, Math.ceil(currentScore * 1.2) || 10);
  }
  
  // Medium-value controls typically have max scores of 5-8
  if (mediumValueControls.some(keyword => controlText.includes(keyword))) {
    return Math.max(currentScore, Math.ceil(currentScore * 1.1) || 6);
  }
  
  // Default calculation: assume current score is 70-80% of max
  if (currentScore > 0) {
    return Math.ceil(currentScore / 0.75);
  }
  
  // Fallback for zero scores
  return 5;
}

/**
 * Generate appropriate remediation text
 */
export function generateRemediationText(controlName: string, description: string, status: string): string {
  const statusInfo = getStandardizedStatus(status);
  
  if (statusInfo.standardStatus === 'Implemented') {
    return 'Control is properly implemented. Monitor regularly and maintain current configuration.';
  }
  
  if (statusInfo.standardStatus === 'Partial') {
    return `Complete the implementation of this control. Review configuration and extend to all applicable areas. ${description ? `Focus on: ${description}` : ''}`;
  }
  
  // Generate specific remediation based on control type
  const controlText = controlName.toLowerCase();
  
  if (controlText.includes('mfa')) {
    return 'Enable Multi-Factor Authentication for all users through Azure AD. Configure authentication methods and enforce policies.';
  }
  
  if (controlText.includes('conditional_access')) {
    return 'Configure Conditional Access policies to control access based on user, device, location, and risk factors.';
  }
  
  if (controlText.includes('admin') || controlText.includes('privileged')) {
    return 'Review and limit administrative privileges. Enable Privileged Identity Management (PIM) for elevated access.';
  }
  
  if (controlText.includes('device')) {
    return 'Implement device compliance policies and mobile device management to secure corporate data.';
  }
  
  if (controlText.includes('policy') || controlText.includes('protection')) {
    return 'Configure and deploy the necessary policies through the Microsoft 365 security center.';
  }
  
  // Generic remediation text
  return `Implement this security control as recommended by Microsoft Secure Score. ${description ? `Details: ${description}` : 'Consult Microsoft documentation for specific implementation steps.'}`;
}
