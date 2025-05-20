// filepath: /m365-assessment-framework/m365-assessment-framework/src/models/Metrics.ts

export interface SecurityMetrics {
    tenantId: string;
    assessmentDate: string;
    score: number;
    metrics: {
        [key: string]: number; // Key-value pairs for various security metrics
    };
    recommendations: string[];
    healthStatus: 'Healthy' | 'Warning' | 'Critical';
}

export interface Metrics {
  identity: {
    mfaAdoption: number;
    conditionalAccessPolicies: number;
    passwordPolicies: {
      complexity: boolean;
      expiration: boolean;
      mfaRequired: boolean;
    };
    adminAccounts: {
      total: number;
      protected: number;
    };
    guestAccess: {
      total: number;
      reviewed: number;
    };
  };
  dataProtection: {
    sensitivityLabels: {
      total: number;
      inUse: number;
    };
    dlpPolicies: {
      total: number;
      active: number;
    };
    sharingSettings: {
      external: boolean;
      anonymous: boolean;
      restrictions: string[];
    };
  };
  endpoint: {
    deviceCompliance: {
      total: number;
      compliant: number;
    };
    defenderStatus: {
      enabled: boolean;
      upToDate: boolean;
    };
    updateCompliance: number;
  };
  cloudApps: {
    securityPolicies: {
      total: number;
      active: number;
    };
    oauthApps: {
      total: number;
      reviewed: number;
      highRisk: number;
    };
  };
  informationProtection: {
    aipLabels: {
      total: number;
      applied: number;
    };
    encryption: {
      enabled: boolean;
      usage: number;
    };
  };
  threatProtection: {
    alerts: {
      high: number;
      medium: number;
      low: number;
      resolved: number;
    };
    incidentResponse: {
      meanTimeToRespond: number;
      openIncidents: number;
    };
  };
  score: {
    overall: number;
    identity: number;
    dataProtection: number;
    endpoint: number;
    cloudApps: number;
    informationProtection: number;
    threatProtection: number;
  };
  lastUpdated: Date;
}