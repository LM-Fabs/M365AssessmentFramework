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
  license: 'License Usage & Management',
  secureScore: 'Microsoft Secure Score'
} as const;

export const METRIC_WEIGHTS = {
  license: 0.4,
  secureScore: 0.6
} as const;