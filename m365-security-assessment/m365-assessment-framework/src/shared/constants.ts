export const API_BASE_URL = '/api';

export enum AssessmentStatus {
  Draft = 'draft',
  Completed = 'completed',
  Archived = 'archived'
}

export enum SecurityImpact {
  High = 'high',
  Medium = 'medium',
  Low = 'low'
}

export const GRAPH_SCOPES = [
  'User.Read',
  'Organization.Read.All',
  'Reports.Read.All',
  'SecurityEvents.Read.All',
  'Directory.Read.All',
  'Policy.Read.All',
  'Application.ReadWrite.All'
];

export const SCORE_THRESHOLDS = {
  good: 90,
  warning: 70,
  critical: 50
};

export const SECURITY_CATEGORIES = {
  identity: 'Identity & Access Management',
  dataProtection: 'Data Protection',
  endpoint: 'Endpoint Security',
  cloudApps: 'Cloud Apps Security',
  informationProtection: 'Information Protection',
  threatProtection: 'Threat Protection'
} as const;

export const METRIC_WEIGHTS = {
  identity: 0.25,
  dataProtection: 0.2,
  endpoint: 0.15,
  cloudApps: 0.15,
  informationProtection: 0.15,
  threatProtection: 0.1
} as const;