// filepath: /m365-assessment-framework/m365-assessment-framework/api/shared/types.ts

export interface Assessment {
    id: string;
    tenantId: string;
    date: string;
    score: number;
    metrics: Metrics;
    recommendations: string[];
}

export interface Metrics {
    securityBaseline: number;
    complianceScore: number;
    userTraining: number;
    incidentResponse: number;
}

export interface Tenant {
    id: string;
    name: string;
    createdDate: string;
    lastAssessmentDate: string;
    assessments: Assessment[];
}