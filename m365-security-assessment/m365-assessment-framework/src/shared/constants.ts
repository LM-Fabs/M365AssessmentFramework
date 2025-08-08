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
  // Minimal scopes for license and secure score assessment only
  'Organization.Read.All',      // Required for license data (/subscribedSkus)
  'SecurityEvents.Read.All'     // Required for secure score data (/security/secureScores, /security/secureScoreControlProfiles)
];

export const SCORE_THRESHOLDS = {
  good: 90,
  warning: 70,
  critical: 50
};

export const SECURITY_CATEGORIES = {
  license: 'License Usage & Management',
  secureScore: 'Microsoft Secure Score',
  identity: 'Identity & Access Management'
} as const;

export const METRIC_WEIGHTS = {
  license: 0.3,
  secureScore: 0.4,
  identity: 0.3
} as const;