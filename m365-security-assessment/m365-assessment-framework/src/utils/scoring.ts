import { Metrics } from '../models/Metrics';
import { METRIC_WEIGHTS } from '../shared/constants';

export const calculateOverallScore = (metrics: Metrics): number => {
  const scores = {
    identity: calculateIdentityScore(metrics.identity),
    dataProtection: calculateDataProtectionScore(metrics.dataProtection),
    endpoint: calculateEndpointScore(metrics.endpoint),
    cloudApps: calculateCloudAppsScore(metrics.cloudApps),
    informationProtection: calculateInformationProtectionScore(metrics.informationProtection),
    threatProtection: calculateThreatProtectionScore(metrics.threatProtection)
  };

  return Object.entries(scores).reduce((total, [category, score]) => {
    return total + score * METRIC_WEIGHTS[category as keyof typeof METRIC_WEIGHTS];
  }, 0);
};

const calculateIdentityScore = (metrics: Metrics['identity']): number => {
  const mfaScore = metrics.mfaAdoption * 100;
  const policiesScore = metrics.conditionalAccessPolicies > 0 ? 100 : 0;
  const adminScore = (metrics.adminAccounts.protected / metrics.adminAccounts.total) * 100;
  const guestScore = (metrics.guestAccess.reviewed / metrics.guestAccess.total) * 100;

  return (mfaScore * 0.4 + policiesScore * 0.3 + adminScore * 0.2 + guestScore * 0.1);
};

const calculateDataProtectionScore = (metrics: Metrics['dataProtection']): number => {
  const labelScore = (metrics.sensitivityLabels.inUse / metrics.sensitivityLabels.total) * 100;
  const dlpScore = (metrics.dlpPolicies.active / metrics.dlpPolicies.total) * 100;
  const sharingScore = !metrics.sharingSettings.anonymous ? 100 : 
    metrics.sharingSettings.external ? 50 : 0;

  return (labelScore * 0.4 + dlpScore * 0.4 + sharingScore * 0.2);
};

const calculateEndpointScore = (metrics: Metrics['endpoint']): number => {
  const complianceScore = (metrics.deviceCompliance.compliant / metrics.deviceCompliance.total) * 100;
  const defenderScore = metrics.defenderStatus.enabled && metrics.defenderStatus.upToDate ? 100 : 0;
  const updateScore = metrics.updateCompliance;

  return (complianceScore * 0.4 + defenderScore * 0.3 + updateScore * 0.3);
};

const calculateCloudAppsScore = (metrics: Metrics['cloudApps']): number => {
  const policyScore = (metrics.securityPolicies.active / metrics.securityPolicies.total) * 100;
  const appScore = (metrics.oauthApps.reviewed / metrics.oauthApps.total) * 100;
  const riskScore = Math.max(0, 100 - (metrics.oauthApps.highRisk / metrics.oauthApps.total * 100));

  return (policyScore * 0.4 + appScore * 0.3 + riskScore * 0.3);
};

const calculateInformationProtectionScore = (metrics: Metrics['informationProtection']): number => {
  const labelScore = (metrics.aipLabels.applied / metrics.aipLabels.total) * 100;
  const encryptionScore = metrics.encryption.enabled ? 100 : 0;
  const usageScore = metrics.encryption.usage * 100;

  return (labelScore * 0.4 + encryptionScore * 0.3 + usageScore * 0.3);
};

const calculateThreatProtectionScore = (metrics: Metrics['threatProtection']): number => {
  const resolvedAlerts = metrics.alerts.resolved;
  const totalAlerts = metrics.alerts.high + metrics.alerts.medium + metrics.alerts.low + resolvedAlerts;
  const alertResolutionScore = totalAlerts > 0 ? (resolvedAlerts / totalAlerts) * 100 : 100;
  
  const responseScore = Math.max(0, 100 - Math.min(metrics.incidentResponse.meanTimeToRespond, 72) * (100/72));
  const incidentScore = Math.max(0, 100 - metrics.incidentResponse.openIncidents * 10);

  return (alertResolutionScore * 0.4 + responseScore * 0.3 + incidentScore * 0.3);
};

export const getScoreColor = (score: number): string => {
  if (score >= 90) return '#107C10'; // Green
  if (score >= 70) return '#FFB900'; // Yellow
  return '#D83B01'; // Red
};

export const getScoreLabel = (score: number): string => {
  if (score >= 90) return 'Good';
  if (score >= 70) return 'Needs Attention';
  return 'Critical'
};