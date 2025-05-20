// filepath: /m365-assessment-framework/m365-assessment-framework/src/models/Tenant.ts
export interface Tenant {
    id: string;
    name: string;
    securityScore: number;
    metrics: Record<string, any>;
    lastAssessmentDate: Date;
    recommendations: string[];
}