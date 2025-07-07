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
  license: {
    totalLicenses: number;
    assignedLicenses: number;
    utilizationRate: number;
    licenseDetails: Array<{
      skuPartNumber: string;
      skuDisplayName: string;
      totalLicenses: number;
      assignedLicenses: number;
    }>;
    summary: string;
  };
  secureScore: {
    percentage: number;
    currentScore: number;
    maxScore: number;
    controlScores: Array<{
      controlName: string;
      category: string;
      implementationStatus: string;
      score: number;
      maxScore: number;
    }>;
    summary: string;
  };
  score: {
    overall: number;
    license: number;
    secureScore: number;
  };
  lastUpdated: Date;
  // Add missing properties for real assessment data
  recommendations?: string[];
  realData?: {
    licenseInfo?: any;
    secureScore?: any;
    dataSource?: string;
    lastUpdated?: string;
    tenantInfo?: any;
  };
  assessmentType?: string;
  dataCollected?: boolean;
}