import { Metrics } from './Metrics';

export interface Assessment {
  id: string;
  tenantId: string;
  assessmentDate: Date;
  assessor: {
    id: string;
    name: string;
    email: string;
  };
  metrics: Metrics;
  comparisonResults?: {
    previousAssessment?: {
      id: string;
      date: Date;
      overallScore: number;
    };
    bestPractices: {
      gaps: Array<{
        category: string;
        metric: string;
        current: number;
        target: number;
        impact: 'high' | 'medium' | 'low';
      }>;
    };
  };
  recommendations: Array<{
    id: string;
    category: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    remediation: string;
    references: Array<{
      title: string;
      url: string;
    }>;
  }>;
  status: 'draft' | 'completed' | 'archived';
  lastModified: Date;
}